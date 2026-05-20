param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$scriptPath = Join-Path $ProjectRoot "tools\vault-capture.js"
if (!(Test-Path $scriptPath)) {
  throw "Missing script: $scriptPath"
}

$profilePath = $PROFILE
$profileDir = Split-Path -Parent $profilePath
if (!(Test-Path $profileDir)) {
  New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}
if (!(Test-Path $profilePath)) {
  New-Item -ItemType File -Path $profilePath -Force | Out-Null
}

$markerStart = "# >>> boardai vault-capture >>>"
$markerEnd = "# <<< boardai vault-capture <<<"
$block = @"
$markerStart
function vault-capture {
  node "$scriptPath" @args
}
Set-Alias vault-add vault-capture -Scope Global
$markerEnd
"@

$current = Get-Content -Raw $profilePath -ErrorAction SilentlyContinue
if ($null -eq $current) {
  $current = ""
}
if ($current -match [regex]::Escape($markerStart)) {
  $pattern = "(?s)$([regex]::Escape($markerStart)).*?$([regex]::Escape($markerEnd))"
  $updated = [regex]::Replace($current, $pattern, $block)
} else {
  $updated = ($current.TrimEnd() + "`r`n`r`n" + $block + "`r`n")
}

Set-Content -Path $profilePath -Value $updated -Encoding UTF8

Write-Output "Installed vault-capture into profile: $profilePath"
Write-Output "Restart terminal or run: . `$PROFILE"
Write-Output ""
Write-Output "Example setup:"
Write-Output "vault-capture --save-config --server https://board.private-driver.ro --email you@example.com --password yourPass --source codex"
Write-Output ""
Write-Output "Example ingest:"
Write-Output 'vault-capture --project private-driver --text "OPENAI_API_KEY=sk-xxxx"'
