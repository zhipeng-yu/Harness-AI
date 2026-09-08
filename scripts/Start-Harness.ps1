param(
  [switch]$SkipBrowser,
  [ValidateRange(1, 60)][int]$ReadinessTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.runtime'
$serverFile = Join-Path $runtimeDir 'server.json'
$process = $null

try {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules') -PathType Container)) {
    throw 'Dependencies are missing. Run npm.cmd install in the project first.'
  }
  if (Test-Path -LiteralPath $serverFile) {
    throw 'A server record already exists. Run Stop-Harness.cmd first.'
  }

  $portInUse = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
    Where-Object { $_.Port -eq 3001 } |
    Select-Object -First 1
  if ($null -ne $portInUse) {
    throw 'Port 3001 is already in use.'
  }

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $process = Start-Process -FilePath $nodePath -ArgumentList @(
    'node_modules/next/dist/bin/next',
    'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3001'
  ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

  $deadline = [DateTime]::UtcNow.AddSeconds($ReadinessTimeoutSeconds)
  $ready = $false
  do {
    $process.Refresh()
    if ($process.HasExited) { throw 'The website process exited during startup.' }
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3001' -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -lt 500) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 150
    }
  } while ([DateTime]::UtcNow -lt $deadline)

  if (-not $ready) { throw 'The website did not become ready in time.' }

  New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
  @{
    pid = $process.Id
    startTime = $process.StartTime.ToUniversalTime().ToString('O')
  } | ConvertTo-Json | Set-Content -LiteralPath $serverFile -Encoding utf8

  if (-not $SkipBrowser) { Start-Process 'http://127.0.0.1:3001' }
  Write-Host 'Harness is running at http://127.0.0.1:3001'
} catch {
  if ($null -ne $process) {
    $process.Refresh()
    if (-not $process.HasExited) { Stop-Process -InputObject $process -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item -LiteralPath $serverFile -Force -ErrorAction SilentlyContinue
  Write-Error $_.Exception.Message
  exit 1
}
