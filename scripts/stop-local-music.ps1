$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.local-music-runtime'
$pidFile = Join-Path $runtimeRoot 'processes.json'

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Host 'No running local music service was found.'
  exit 0
}

$processes = Get-Content -LiteralPath $pidFile -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($processId in @($processes.gatewayPid, $processes.apiPid)) {
  if ($processId -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $processId -Force
  }
}
Remove-Item -LiteralPath $pidFile -Force
Write-Host 'Local music service stopped.' -ForegroundColor Green
