$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.local-music-runtime'
$sourceRoot = Join-Path $runtimeRoot 'go-music-api-source'
$apiExecutable = Join-Path $runtimeRoot 'go-music-api.exe'
$apiData = Join-Path $runtimeRoot 'api-data'
$gatewayData = Join-Path $runtimeRoot 'gateway-data'
$logRoot = Join-Path $runtimeRoot 'logs'
$pidFile = Join-Path $runtimeRoot 'processes.json'

function Test-LocalPort([int]$port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Test-Gateway {
  try {
    $result = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 2
    return $result.status -eq 'ok'
  } catch {
    return $false
  }
}

if (Test-Gateway) {
  Write-Host 'Local music service is already running.' -ForegroundColor Green
  exit 0
}

foreach ($directory in @($runtimeRoot, $apiData, $gatewayData, $logRoot)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

if (-not (Test-Path -LiteralPath $apiExecutable)) {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required to download the local music API.' }
  if (-not (Get-Command go -ErrorAction SilentlyContinue)) { throw 'Go is required to build the local music API.' }

  if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot '.git'))) {
    Write-Host 'First run: downloading the official music API...' -ForegroundColor Cyan
    git clone --depth 1 https://github.com/guohuiyuan/go-music-api.git $sourceRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not download the official music API. Check the network and retry.' }
  }

  Write-Host 'First run: building the local music API...' -ForegroundColor Cyan
  Push-Location $sourceRoot
  try {
    go build -o $apiExecutable .
    if ($LASTEXITCODE -ne 0) { throw 'Could not build the local music API.' }
  } finally {
    Pop-Location
  }
}

if (Test-LocalPort 8080) { throw 'Port 8080 is already in use.' }
if (Test-LocalPort 8787) { throw 'Port 8787 is already in use.' }

Write-Host 'Starting the local music API...' -ForegroundColor Cyan
$apiProcess = Start-Process -FilePath $apiExecutable -WorkingDirectory $apiData -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $logRoot 'api-output.log') `
  -RedirectStandardError (Join-Path $logRoot 'api-error.log')

$apiReady = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  if ($apiProcess.HasExited) { break }
  if (Test-LocalPort 8080) { $apiReady = $true; break }
  Start-Sleep -Milliseconds 500
}
if (-not $apiReady) {
  if (-not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force }
  throw "The local music API did not start. Check logs in $logRoot"
}

Write-Host 'Starting the local security gateway...' -ForegroundColor Cyan
$env:MUSIC_PUBLIC_UPSTREAM = 'http://127.0.0.1:8080'
$env:MUSIC_AUTH_UPSTREAM = 'http://127.0.0.1:8080'
$env:MUSIC_DATA_DIR = $gatewayData
$env:MUSIC_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
$env:MUSIC_COOKIE_SECURE = 'false'
$env:MUSIC_COOKIE_SAME_SITE = 'Lax'
$env:MUSIC_SESSION_TTL_DAYS = '90'
$gatewayScript = Join-Path $projectRoot 'music-gateway\src\server.mjs'
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$gatewayProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @($gatewayScript) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $logRoot 'gateway-output.log') `
  -RedirectStandardError (Join-Path $logRoot 'gateway-error.log')

$gatewayReady = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  if ($gatewayProcess.HasExited) { break }
  if (Test-Gateway) { $gatewayReady = $true; break }
  Start-Sleep -Milliseconds 500
}
if (-not $gatewayReady) {
  if (-not $gatewayProcess.HasExited) { Stop-Process -Id $gatewayProcess.Id -Force }
  if (-not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id -Force }
  throw "The local security gateway did not start. Check logs in $logRoot"
}

@{
  apiPid = $apiProcess.Id
  gatewayPid = $gatewayProcess.Id
} | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8

Write-Host 'Local music service started. Refresh the web page to scan.' -ForegroundColor Green
