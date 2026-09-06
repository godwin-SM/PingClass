# PingClass Free Backup
# Nightly JSON snapshot of every public table via the Supabase REST API (service-role key).
# Zero cost: no PITR, no backup add-on. Best-effort disaster/export snapshot,
# NOT a byte-perfect time machine (see pingclass-restore.ps1).
#
# Credentials are read from .env (gitignored). Cannot run if .env is missing.

param(
    [string]$BackupRoot = "",
    [int]$RetentionDays = 14,
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $BackupRoot) { $BackupRoot = Join-Path $RepoDir "backups" }
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
if (-not $SupabaseUrl -or -not $ServiceKey) {
    Write-Error "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in $EnvFile. Backup aborted."
    exit 1
}

# ---- 2. Dump each known public table (paginated, 1000 rows per request) ----
$candidates = @(
    "users", "institutes", "students", "batches", "student_batches",
    "parent_student_links", "payments", "attendance", "announcements",
    "invite_tokens", "institute_settings", "notification_preferences",
    "notifications", "subscriptions", "rate_limit_hits"
)
$tables = @()

Write-Host "PingClass Backup @ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan

$stamp   = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir  = Join-Path $BackupRoot $stamp
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
    $rows | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath (Join-Path $outDir "$t.json") -Encoding UTF8
    $manifest.tables[$t] = @($rows).Count
    $totalRows += @($rows).Count
    Write-Host ("  {0,-28} {1,6} rows" -f $t, @($rows).Count) -ForegroundColor Gray
}

$manifest.total_rows = $totalRows
$manifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outDir "_manifest.json") -Encoding UTF8

# ---- 4. Retention: keep the last N days ----
Get-ChildItem -LiteralPath $BackupRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
    Remove-Item -Recurse -Force

Write-Host "Backup complete: $outDir ($totalRows rows, $($tables.Count) tables)" -ForegroundColor Green