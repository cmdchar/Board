param(
  [string]$Server = "root@private-driver.ro",
  [string]$Domain = "board.private-driver.ro",
  [string]$RemoteAppDir = "/var/www/board",
  [int]$BackendPort = 8925,
  [string]$ServiceName = "board-private-driver.service",
  [switch]$SkipBuild,
  [switch]$IncludeEnv,
  [switch]$UploadBoardsData
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Log-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode {
  param([string]$Action)
  if ($LASTEXITCODE -ne 0) {
    throw "$Action failed with exit code $LASTEXITCODE"
  }
}

Require-Command "ssh"
Require-Command "scp"
Require-Command "npm"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendDir = Join-Path $RepoRoot "backend"
$DistDir = Join-Path $FrontendDir "dist"

if (-not (Test-Path $FrontendDir)) { throw "Missing frontend directory: $FrontendDir" }
if (-not (Test-Path $BackendDir)) { throw "Missing backend directory: $BackendDir" }

if (-not $SkipBuild) {
  Log-Step "Building frontend"
  Push-Location $FrontendDir
  try {
    npm run build
    Assert-LastExitCode "Frontend build"
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $DistDir)) {
  throw "Missing frontend dist folder: $DistDir"
}

$RemoteBackendDir = "$RemoteAppDir/backend"
$RemoteDistDir = "$RemoteAppDir/dist"

Log-Step "Preparing remote directories on $Server"
ssh $Server "mkdir -p $RemoteBackendDir/data $RemoteDistDir"
Assert-LastExitCode "Remote directory preparation"

Log-Step "Uploading frontend dist"
scp -r "$DistDir/." "${Server}:${RemoteDistDir}/"
Assert-LastExitCode "Frontend upload"

$BackendFiles = @(
  (Join-Path $BackendDir "server.js")
  (Join-Path $BackendDir "package.json")
  (Join-Path $BackendDir "package-lock.json")
  (Join-Path $BackendDir ".env.example")
)

if ($IncludeEnv) {
  $EnvPath = Join-Path $BackendDir ".env"
  if (-not (Test-Path $EnvPath)) {
    throw "IncludeEnv was set but .env does not exist at: $EnvPath"
  }
  $BackendFiles += $EnvPath
}

Log-Step "Uploading backend runtime files"
scp $BackendFiles "${Server}:${RemoteBackendDir}/"
Assert-LastExitCode "Backend runtime upload"

$BackendServerDir = Join-Path $BackendDir "server"
if (Test-Path $BackendServerDir) {
  Log-Step "Uploading backend server modules"
  scp -r "$BackendServerDir" "${Server}:${RemoteBackendDir}/"
  Assert-LastExitCode "Backend server modules upload"
}

if ($UploadBoardsData) {
  $BoardsPath = Join-Path $BackendDir "data/boards.json"
  if (-not (Test-Path $BoardsPath)) {
    throw "UploadBoardsData was set but boards.json does not exist at: $BoardsPath"
  }
  Log-Step "Uploading boards.json (WARNING: overwrites server board data)"
  scp $BoardsPath "${Server}:${RemoteBackendDir}/data/boards.json"
  Assert-LastExitCode "boards.json upload"
}

$RemoteScriptTemplate = @'
set -euo pipefail

cd __REMOTE_BACKEND_DIR__
npm ci --omit=dev

# Ensure nginx can read deployed static assets and backend runtime files.
find __REMOTE_DIST_DIR__ -type d -exec chmod 755 {} \;
find __REMOTE_DIST_DIR__ -type f -exec chmod 644 {} \;
find __REMOTE_BACKEND_DIR__ -type d -exec chmod 755 {} \;
find __REMOTE_BACKEND_DIR__ -type f -exec chmod 644 {} \;
if [ -f "__REMOTE_BACKEND_DIR__/.env" ]; then
  chmod 600 __REMOTE_BACKEND_DIR__/.env
fi

systemctl restart __SERVICE_NAME__
systemctl is-active --quiet __SERVICE_NAME__

nginx -t
systemctl reload nginx

echo "LOCAL_HEALTH:"
ok_local=0
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:__BACKEND_PORT__/api/health >/tmp/board_local_health.json 2>/dev/null; then
    ok_local=1
    break
  fi
  sleep 1
done
if [ "$ok_local" -ne 1 ]; then
  echo "Local health check failed after retries" >&2
  exit 1
fi
cat /tmp/board_local_health.json
echo

echo "PUBLIC_HEALTH:"
ok_public=0
for i in $(seq 1 20); do
  if curl -fsS https://__DOMAIN__/api/health >/tmp/board_public_health.json 2>/dev/null; then
    ok_public=1
    break
  fi
  sleep 1
done
if [ "$ok_public" -ne 1 ]; then
  echo "Public health check failed after retries" >&2
  exit 1
fi
cat /tmp/board_public_health.json
echo

# Fail deployment if public homepage is not successful.
curl -fsS https://__DOMAIN__/ >/dev/null 2>&1

echo "PUBLIC_HEAD:"
curl -sSI https://__DOMAIN__/ | head -n 8
'@

$RemoteScript = $RemoteScriptTemplate.
  Replace("__REMOTE_BACKEND_DIR__", $RemoteBackendDir).
  Replace("__REMOTE_DIST_DIR__", $RemoteDistDir).
  Replace("__SERVICE_NAME__", $ServiceName).
  Replace("__BACKEND_PORT__", [string]$BackendPort).
  Replace("__DOMAIN__", $Domain)

$RemoteScriptB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($RemoteScript))

Log-Step "Running remote install/restart/smoke checks"
ssh $Server "echo $RemoteScriptB64 | base64 -d | bash"
Assert-LastExitCode "Remote install/restart/smoke checks"

Log-Step "Deploy complete"
Write-Host "Domain: https://$Domain" -ForegroundColor Green
Write-Host "Service: $ServiceName" -ForegroundColor Green
Write-Host "Remote app dir: $RemoteAppDir" -ForegroundColor Green
