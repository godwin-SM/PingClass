# PingClass Zero-Local Backup
# Nightly JSON snapshot of every public table via the Supabase REST API (service-role key),
# uploaded straight to the PRIVATE GitHub repo godwin-SM/PingClass-backups via the GitHub API.
# Nothing is stored permanently on this computer: the snapshot lives in the temp folder during
# the run and is deleted the moment the upload succeeds.
#
# Credentials are read from .env (gitignored): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
# GITHUB_REPO, GITHUB_BACKUP_TOKEN.

param(
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $EnvFile)    { $EnvFile    = Join-Path $RepoDir ".env" }

# ---- 1. Load credentials from .env ----
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
    Write-Error "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in $EnvFile. Backup aborted."
    exit 1
}
if (-not $GitHubRepo -or -not $GitHubToken) {
    Write-Error "Missing GITHUB_REPO / GITHUB_BACKUP_TOKEN in $EnvFile. Backup aborted."
    exit 1
}

$ApiHeaders = @{
    Authorization = "Bearer $GitHubToken"
    "User-Agent"  = "pingclass-backup"
    Accept        = "application/vnd.github+json"
}

# ---- 2. Dump each known public table (paginated, 1000 rows per request) ----
$candidates = @(
    "users", "institutes", "students", "batches", "student_batches",
    "parent_student_links", "payments", "fees", "attendance", "announcements",
    "invite_tokens", "institute_settings", "notification_preferences",
    "notifications", "subscriptions", "push_subscriptions", "rate_limit_hits",
    "waitlist", "audit_log"
)
$tables = @()

Write-Host "PingClass Backup @ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan

$stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$tmpDir = Join-Path $env:TEMP "PingClassBackups"
$outDir = Join-Path $tmpDir $stamp
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$manifest = [ordered]@{
    timestamp   = (Get-Date).ToString("o")
    url         = $SupabaseUrl
    tables      = [ordered]@{}
    total_rows  = 0
}

$totalRows = 0
foreach ($t in $candidates) {
    $rows = @()
    try {
        $offset = 0
        $page   = 1000
        do {
            $r = Invoke-WebRequest -Uri "$SupabaseUrl/rest/v1/$t`?select=*&limit=$page&offset=$offset" `
                -Headers @{
                    "apikey"        = $ServiceKey
                    "Authorization" = "Bearer $ServiceKey"
                } -UseBasicParsing
            $parsed = $r.Content | ConvertFrom-Json
            $fetched = @($parsed).Count
            if ($fetched) { $rows += $parsed }
            $offset += $fetched
        } while ($fetched -ge $page -and $offset -lt 100000)
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) { continue }  # table doesn't exist (yet)
        throw
    }

    $tables += $t
    ConvertTo-Json -InputObject @($rows) -Depth 100 | Set-Content -LiteralPath (Join-Path $outDir "$t.json") -Encoding UTF8
    $manifest.tables[$t] = @($rows).Count
    $totalRows += @($rows).Count
    Write-Host ("  {0,-28} {1,6} rows" -f $t, @($rows).Count) -ForegroundColor Gray
}

$manifest.total_rows = $totalRows
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outDir "_manifest.json") -Encoding UTF8

# ---- 3. Upload the snapshot as ONE commit on main (flat history - same as the
#          server-side backup-snapshot function): each run is an orphan commit
#          + force update, so the repo keeps exactly the newest snapshot dir.
try {
    $branch = "main"

    $tree = @()
    foreach ($f in @(Get-ChildItem -LiteralPath $outDir -File)) {
        $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
        $b64   = [Convert]::ToBase64String($bytes)
        $blob  = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$GitHubRepo/git/blobs" `
            -Headers $ApiHeaders -ContentType "application/json" `
            -Body (@{ content = $b64; encoding = "base64" } | ConvertTo-Json -Compress)
        $tree += @{ path = "$stamp/$($f.Name)"; mode = "100644"; type = "blob"; sha = $blob.sha }
    }

    $newTree = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$GitHubRepo/git/trees" `
        -Headers $ApiHeaders -ContentType "application/json" `
        -Body (@{ tree = $tree } | ConvertTo-Json -Compress -Depth 10)

    $commit = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$GitHubRepo/git/commits" `
        -Headers $ApiHeaders -ContentType "application/json" `
        -Body (@{ message = "backup $stamp ($totalRows rows)"; tree = $newTree.sha; parents = @() } | ConvertTo-Json -Compress)

    Invoke-RestMethod -Method Patch -Uri "https://api.github.com/repos/$GitHubRepo/git/refs/heads/$branch" `
        -Headers $ApiHeaders -ContentType "application/json" `
        -Body (@{ sha = $commit.sha; force = $true } | ConvertTo-Json -Compress) | Out-Null

    Write-Host "Uploaded to private GitHub repo as commit $($commit.sha.Substring(0,7))." -ForegroundColor Green
    Write-Host "Deleting local copy..." -ForegroundColor Gray
    Remove-Item -LiteralPath $outDir -Recurse -Force
    Write-Host "Local copy removed - nothing permanent stored on this computer." -ForegroundColor Green
} catch {
    Write-Warning ("GitHub upload FAILED: " + $_.Exception.Message)
    Write-Warning "Snapshot PRESERVED at $outDir (will be kept until a later run uploads successfully)."
    exit 2
}

Write-Host "Backup complete: GitHub:$stamp ($totalRows rows, $($tables.Count) tables)" -ForegroundColor Green