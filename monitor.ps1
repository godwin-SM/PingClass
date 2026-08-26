# PingClass Production Monitor
# Run periodically to check system health

param(
    [string]$SupabaseUrl = "https://evrqzgjksmidqhzvckhq.supabase.co",
    [string]$SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnF6Z2prc21pZHFoenZja2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTE4MzksImV4cCI6MjEwMDEyNzgzOX0.UV4YLbfJwszr-zzzkpJgbLbQ4ZZhiGVYzlAHpst45mE"
)

Write-Host "`n=== PingClass Production Monitor ===" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# 1. Check site availability
Write-Host "`n1. Site Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://pingclass.vercel.app" -Method Head -TimeoutSec 10 -UseBasicParsing
    Write-Host "   Status: UP (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   Status: DOWN ($($_.Exception.Message))" -ForegroundColor Red
}

# 2. Check Supabase API
Write-Host "`n2. Supabase API Check" -ForegroundColor Yellow
try {
    $headers = @{
        "apikey" = $SupabaseKey
        "Authorization" = "Bearer $SupabaseKey"
    }
    $response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users?select=count" -Headers $headers -Method Head -TimeoutSec 10
    Write-Host "   Status: REACHABLE" -ForegroundColor Green
} catch {
    Write-Host "   Status: UNREACHABLE ($($_.Exception.Message))" -ForegroundColor Red
}

# 3. Check database health
Write-Host "`n3. Database Health" -ForegroundColor Yellow
try {
    $headers = @{
        "apikey" = $SupabaseKey
        "Authorization" = "Bearer $SupabaseKey"
        "Content-Type" = "application/json"
    }
    $body = '{"query": "SELECT public.health_check()"}'
    $response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/rpc/health_check" -Headers $headers -Method Post -TimeoutSec 10
    Write-Host "   Status: HEALTHY" -ForegroundColor Green
    Write-Host "   Users: $($response.users), Students: $($response.students), Batches: $($response.batches)" -ForegroundColor Gray
} catch {
    Write-Host "   Status: ERROR ($($_.Exception.Message))" -ForegroundColor Red
}

# 4. Check rate limits
Write-Host "`n4. Rate Limit Status" -ForegroundColor Yellow
try {
    $headers = @{
        "apikey" = $SupabaseKey
        "Authorization" = "Bearer $SupabaseKey"
    }
    $response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/rate_limit_hits?select=action,hits&bucket=gte.$(Get-Date (Get-Date).AddHours(-1) -Format 'yyyy-MM-ddTHH:mm:ss')" -Headers $headers -TimeoutSec 10
    if ($response.Count -eq 0) {
        Write-Host "   Status: OK (no recent rate limit hits)" -ForegroundColor Green
    } else {
        Write-Host "   Status: WARNING ($($response.Count) rate limit entries in last hour)" -ForegroundColor Yellow
        $response | ForEach-Object { Write-Host "     $($_.action): $($_.hits) hits" -ForegroundColor Gray }
    }
} catch {
    Write-Host "   Status: UNKNOWN ($($_.Exception.Message))" -ForegroundColor Yellow
}

# 5. Check recent auth activity
Write-Host "`n5. Recent Auth Activity" -ForegroundColor Yellow
try {
    $headers = @{
        "apikey" = $SupabaseKey
        "Authorization" = "Bearer $SupabaseKey"
    }
    $response = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/users?select=id,role,created_at&order=created_at.desc&limit=5" -Headers $headers -TimeoutSec 10
    Write-Host "   Recent users:" -ForegroundColor Gray
    $response | ForEach-Object {
        Write-Host "     $($_.role) - created $($_.created_at)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Status: ERROR ($($_.Exception.Message))" -ForegroundColor Red
}

Write-Host "`n=== Monitor Complete ===" -ForegroundColor Cyan
