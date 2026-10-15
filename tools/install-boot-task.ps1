# One time, as admin (it asks for UAC itself): make the "Hollowmoon Hill" task also start the game at boot, before
# anyone signs in (for example after a Windows update restart). Without admin the task can only run at logon.
#   powershell -ExecutionPolicy Bypass -File tools\install-boot-task.ps1
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  return
}
$vbs = Join-Path $PSScriptRoot 'start-hidden.vbs'
$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`""
$boot = New-ScheduledTaskTrigger -AtStartup; $boot.Delay = 'PT1M'
$logon = New-ScheduledTaskTrigger -AtLogOn -User 'YORHAPC\Yorha'; $logon.Delay = 'PT30S'
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0 -StartWhenAvailable -MultipleInstances IgnoreNew
$p = New-ScheduledTaskPrincipal -UserId 'YORHAPC\Yorha' -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName 'Hollowmoon Hill' -Action $a -Trigger $boot, $logon -Principal $p -Settings $s -Force `
  -Description 'Halloween game: game Ollama :11445, Kokoro :8834, game :8830 (tools/start.ps1)' | Out-Null
Write-Host 'Hollowmoon Hill now starts at boot and at logon.'
Start-Sleep 3
