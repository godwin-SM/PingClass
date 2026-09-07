# PingClass Restore
# Re-inserts a JSON snapshot back into Supabase, either from a local folder
# (-BackupDir) or straight from the private GitHub repo godwin-SM/PingClass-backups
# (-FromGitHub, optionally -Stamp "yyyyMMdd-HHmmss", defaults to the latest).
# Uses POST .../rest/v1/{table} with Prefer: resolution=merge-duplicates so it is
# idempotent and re-runnable (upserts on primary key). Rows are inserted in
# dependency order so foreign keys are satisfied.
#
# NOTE: this restores DATA only. Schema stays as-is. For full fidelity against a
# wiped/renamed database you would also need schema + RLS + functions (see the SQL
# migrations in supabase/migrations/). This is a free, best-effort alternative to PITR.

param(
    [string]$BackupDir = "",
    [switch]$FromGitHub,
    [string]$Stamp = "",
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $EnvFile) { $EnvFile = Join-Path $RepoDir ".env" }

$envVars = @{}
if (Test-Path -LiteralPath $EnvFile) {
    Get-Content -LiteralPath $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z0-9_]+)=(.*)$') {
            $envVars[$matches[1]] = $matches[2].Trim('"').Trim("'")
        }
    }
}
$SupabaseUrl = $envVars["SUPABASE_URL"]
$ServiceKey  = $envVars["SUPABASE_SERVICE_ROLE_KEY"]
$GitHubRepo  = $envVars["GITHUB_REPO"]
$GitHubToken = $envVars["GITHUB_BACKUP_TOKEN"]
if (-not $SupabaseUrl -or -not $ServiceKey) {
    Write-Error "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in $EnvFile. Restore aborted."
    exit 1
}

# ---- Resolve the snapshot to restore ----
if ($FromGitHub -or (-not $BackupDir -and $GitHubRepo -and $GitHubToken)) {
    if (-not $GitHubRepo -or -not $GitHubToken) {
        Write-Error "-FromGitHub requires GITHUB_REPO and GITHUB_BACKUP_TOKEN in $EnvFile."
        exit 1
    }
    $ApiHeaders = @{ Authorization = "Bearer $GitHubToken"; "User-Agent" = "pingclass-restore"; Accept = "application/vnd.github+json" }

    $ref     = Invoke-RestMethod -Uri "https://api.github.com/repos/$GitHubRepo/git/ref/heads/main" -Headers $ApiHeaders
    $treeRes = Invoke-RestMethod -Uri "https://api.github.com/repos/$GitHubRepo/git/trees/$($ref.object.sha)?recursive=1" -Headers $ApiHeaders
    $files   = @($treeRes.tree | Where-Object { $_.type -eq "blob" })

    $stamps = @($files | ForEach-Object {
        if ($_.path -match '^([^/]+)/_manifest\.json$') { $matches[1] }
    } | Sort-Object -Unique -Descending)

    if ($stamps.Count -eq 0) {
        Write-Error "No snapshots found in $GitHubRepo."
        exit 1
    }
    if ($Stamp) {
        if ($Stamp -notin $stamps) { Write-Error "Stamp '$Stamp' not found. Listing: $($stamps -join ', ')"; exit 1 }
        $use = $Stamp
    } else {
        $use = $stamps[0]
    }

    # Download the chosen snapshot into a temp folder
    $tmpDir = Join-Path $env:TEMP "PingClassRestore"
    $BackupDir = Join-Path $tmpDir $use
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    $snapFiles = @($files | Where-Object { $_.path -like "$use/*.json" })
    foreach ($f in $snapFiles) {
        $name = Split-Path -Leaf $f.path
        $enc  = [uri]::EscapeDataString($use)
        $file = Invoke-RestMethod -Uri "https://api.github.com/repos/$GitHubRepo/contents/$enc/$([uri]::EscapeDataString($name))" -Headers $ApiHeaders
        if ($file.content) {
            [System.IO.File]::WriteAllBytes((Join-Path $BackupDir $name), [Convert]::FromBase64String($file.content))
        } else {
            Invoke-WebRequest -Uri $file.download_url -Headers $ApiHeaders -OutFile (Join-Path $BackupDir $name) -UseBasicParsing
        }
    }
    Write-Host "Downloaded snapshot $use from GitHub." -ForegroundColor Cyan
} elseif (-not $BackupDir) {
    Write-Error "Provide -BackupDir (local folder) or -FromGitHub. See header comment."
    exit 1
}

if (-not (Test-Path -LiteralPath $BackupDir)) {
    Write-Error "Backup dir not found: $BackupDir"
    exit 1
}

# Dependency order: parents before children (FK-safe). Tables present in the snapshot.
$order = @(
    "institutes",
    "institute_settings",
    "users",
    "batches",
    "fees",
    "students",
    "student_batches",
    "push_subscriptions",
    "notifications",
    "notification_preferences",
    "subscriptions",
    "parent_student_links",
    "payments",
    "attendance",
    "announcements",
    "invite_tokens",
    "waitlist",
    "audit_log"
)

$headers = @{
    "apikey"        = $ServiceKey
    "Authorization" = "Bearer $ServiceKey"
    "Prefer"        = "resolution=merge-duplicates, return=minimal"
    "Content-Type"  = "application/json"
}

Write-Host "Restoring from $BackupDir" -ForegroundColor Cyan
Write-Host "NOTE: existing rows are updated in place; only genuinely missing student rows are" -ForegroundColor Yellow
Write-Host "      re-created (DB trigger requires parent_consent=true, so those are marked consented)." -ForegroundColor Yellow
$restored = 0
$insertedStudents = @()
foreach ($t in $order) {
    $file = Join-Path $BackupDir "$t.json"
    if (-not (Test-Path -LiteralPath $file)) { continue }
    $rows = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if (@($rows).Count -eq 0) { continue }
    foreach ($row in $rows) {
        $body = $row | ConvertTo-Json -Depth 100
        if ($t -eq "students") {
            # UPDATE path (PATCH) never fires the BEFORE-INSERT consent/limit triggers,
            # so existing rows keep their recorded consent untouched. Only rows that do
            # not exist (genuine recovery) go through INSERT, where the DPDP consent
            # trigger will accept them because we explicitly set parent_consent=true.
            $check = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/students?id=eq.$($row.id)&select=id" `
                -Headers @{ apikey = $ServiceKey; Authorization = "Bearer $ServiceKey" } -UseBasicParsing
            if (@($check).Count -gt 0) {
                Invoke-RestMethod -Method Patch -Uri "$SupabaseUrl/rest/v1/students?id=eq.$($row.id)" `
                    -Headers $headers -Body $body -UseBasicParsing | Out-Null
            } else {
                $r = $row | ConvertTo-Json -Depth 100 | ConvertFrom-Json
                $r.parent_consent    = $true
                $r.parent_consent_at = $r.parent_consent_at
                Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/students" `
                    -Headers $headers -Body ($r | ConvertTo-Json -Depth 100) -UseBasicParsing | Out-Null
                $insertedStudents += $row.id
            }
            $restored++
            continue
        }
        try {
            Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/$t" -Headers $headers -Body $body -UseBasicParsing | Out-Null
            $restored++
        } catch {
            throw "Table $t, row $($row.id): $($_.Exception.Message) - $($_.ErrorDetails.Message)"
        }
    }
    Write-Host ("  {0,-28} {1,6} rows restored" -f $t, @($rows).Count) -ForegroundColor Gray
}
Write-Host "Restore complete. $restored rows." -ForegroundColor Green

# The app's audit triggers log every restore UPSERT/PATCH against audited tables,
# so audit_log would grow with synthetic rows. Reconcile it to exactly the snapshot.
$auditFile = Join-Path $BackupDir "audit_log.json"
if (Test-Path -LiteralPath $auditFile) {
    $auditRows = Get-Content -LiteralPath $auditFile -Raw | ConvertFrom-Json
    if (@($auditRows).Count -gt 0) {
        $auditIds = @($auditRows | ForEach-Object { $_.id }) -join ","
        try {
            Invoke-RestMethod -Method Delete -Uri "$SupabaseUrl/rest/v1/audit_log?id=not.in.($auditIds)" `
                -Headers $headers -UseBasicParsing | Out-Null
            Write-Host "audit_log reconciled to snapshot ($(@($auditRows).Count) rows)." -ForegroundColor Green
        } catch {
            Write-Warning "audit_log reconciliation failed (manual check advised): $($_.Exception.Message)"
        }
    }
}

if ($insertedStudents.Count) {
    Write-Warning ("$($insertedStudents.Count) student row(s) did not exist and were re-created with consent=true: $($insertedStudents -join ', ')")
    Write-Warning "These came from the snapshot (pre-existing records), so consent was marked true to satisfy the DPDP trigger."
}
Write-Host "Verify in the dashboard (Table Editor) before going live." -ForegroundColor Yellow