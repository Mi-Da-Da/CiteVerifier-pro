# CiteVerifier one-click launcher (PowerShell entry point)
#
# Usage: .\start.ps1
#
# Delegates to start.bat so behavior is identical in CMD and PowerShell.
# npm.cmd is used inside start.bat to avoid PowerShell execution-policy issues.

$ErrorActionPreference = "Stop"
$bat = Join-Path $PSScriptRoot "start.bat"

if (-not (Test-Path -LiteralPath $bat)) {
    Write-Error "start.bat not found next to start.ps1"
    exit 1
}

& cmd.exe /c "`"$bat`""
exit $LASTEXITCODE
