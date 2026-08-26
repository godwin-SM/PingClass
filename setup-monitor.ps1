# PingClass Monitor Setup
# Creates a Windows Task Scheduler task to run monitor.ps1 every hour

Write-Host "`n=== PingClass Monitor Setup ===" -ForegroundColor Cyan

$taskName = "PingClass-ProductionMonitor"
$scriptPath = Join-Path $PSScriptRoot "monitor.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force
    Write-Host "Task '$taskName' created successfully" -ForegroundColor Green
    Write-Host "Runs every hour, starting now" -ForegroundColor Gray
} catch {
    Write-Host "Failed to create task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Run this script as Administrator" -ForegroundColor Yellow
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
