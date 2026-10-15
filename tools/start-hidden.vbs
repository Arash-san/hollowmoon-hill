' Runs tools\start.ps1 with no console window (used by the "Hollowmoon Hill" scheduled task at boot and logon).
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""& '" & root & "\tools\start.ps1' *> '" & root & "\.tmp\autostart.log'"""
CreateObject("WScript.Shell").Run cmd, 0, False
