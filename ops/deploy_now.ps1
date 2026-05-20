param(
  [switch]$SkipBuild,
  [switch]$IncludeEnv,
  [switch]$UploadBoardsData
)

$ErrorActionPreference = "Stop"

$ScriptPath = Join-Path $PSScriptRoot "deploy_board.ps1"
if (-not (Test-Path $ScriptPath)) {
  throw "Missing deploy script: $ScriptPath"
}

$ArgsList = @(
  "-ExecutionPolicy", "Bypass",
  "-File", $ScriptPath
)

if ($SkipBuild) { $ArgsList += "-SkipBuild" }
if ($IncludeEnv) { $ArgsList += "-IncludeEnv" }
if ($UploadBoardsData) { $ArgsList += "-UploadBoardsData" }

Write-Host "Running standard deploy..." -ForegroundColor Cyan
Write-Host "Command: powershell $($ArgsList -join ' ')" -ForegroundColor DarkGray

& powershell @ArgsList

if ($LASTEXITCODE -ne 0) {
  throw "deploy_now failed with exit code $LASTEXITCODE"
}

Write-Host "Standard deploy finished successfully." -ForegroundColor Green
