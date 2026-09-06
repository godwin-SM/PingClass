# PingClass Restore
# Re-inserts a JSON snapshot taken by pingclass-backup.ps1 back into Supabase.
# Uses POST .../rest/v1/{table} with Prefer: resolution=merge-duplicates so it is
# idempotent and re-runnable (upserts on primary key). Rows are inserted in
# dependency order so foreign keys are satisfied.
#
# NOTE: this restores DATA only. Schema stays as-is. For full fidelity against a
# wiped/renamed database you would also need schema + RLS + functions (see the SQL
# migrations in supabase/migrations/). This is a free, best-effort alternative to PITR.

param(
    [Parameter(Mandatory = $true)]
    [string]$BackupDir,
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
if (-not $SupabaseUrl -or -not $ServiceKey) {
    Write-Error "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in $EnvFile. Restore aborted."
    exit 1
}
if (-not (Test-Path -LiteralPath $BackupDir)) {
    Write-Error "Backup dir not found: $BackupDir"
    exit 1
}

# Dependency order: parents before children (FK-safe). Tables present in the snapshot.
$order = @(
    "institutes",
    "users",
    "students",
    "batches",
    "student_batches",
    "parent_student_links",
    "payments",
    "attendance",
    "announcements",
    "invite_tokens",
    "institute_settings",
    "notification_preferences",
    "notifications",
    "subscriptions"
)

$headers = @{
    "apikey"        = $ServiceKey
    "Authorization" = "Bearer $ServiceKey"
    "Prefer"        = "resolution=merge-duplicates, return=minimal"
    "Content-Type"  = "application/json"
}

Write-Host "Restoring from $BackupDir" -ForegroundColor Cyan
$restored = 0
foreach ($t in $order) {
    $file = Join-Path $BackupDir "$t.json"
    if (-not (Test-Path -LiteralPath $file)) { continue }
    $rows = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if (@($rows).Count -eq 0) { continue }
    $body = $rows | ConvertTo-Json -Depth 100
    Invoke-RestMethod -Method Post -Uri "$SupabaseUrl/rest/v1/$t" -Headers $headers -Body $body -UseBasicParsing | Out-Null
    $restored += @($rows).Count
    Write-Host ("  {0,-28} {1,6} rows restored" -f $t, @($rows).Count) -ForegroundColor Gray
}
Write-Host "Restore complete. $restored rows." -ForegroundColor Green
Write-Host "Verify in the dashboard (Table Editor) before going live." -ForegroundColor Yellow