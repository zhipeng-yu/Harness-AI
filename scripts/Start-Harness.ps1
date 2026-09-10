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
  $portInUse = Get-NetTCPConnection -State Listen -ErrorAction Stop |
    Where-Object { $_.LocalPort -eq 3001 } |
    Select-Object -First 1
  if ($null -ne $portInUse) {
    $listener = Get-CimInstance Win32_Process -Filter "ProcessId = $($portInUse.OwningProcess)"
    $serverPath = Join-Path $projectRoot 'node_modules\next\dist\server\lib\start-server.js'
    if ($portInUse.LocalAddress -ne '127.0.0.1' -or $listener.Name -ne 'node.exe' -or
        $listener.CommandLine -notlike "*`"$serverPath`"*") {
      throw "Port 3001 is in use by another application (PID $($portInUse.OwningProcess)). Close it first."
    }

    # Next dev runs the listener in a child; record its CLI parent when present.
    $existing = Get-Process -Id $listener.ProcessId
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.ParentProcessId)"
    if ($null -ne $parent -and $parent.Name -eq 'node.exe' -and
        $parent.CreationDate -le $listener.CreationDate -and
        $parent.CommandLine -match 'next[\\/]dist[\\/]bin[\\/]next"?\s+dev(?:\s|$)') {
      $existing = Get-Process -Id $parent.ProcessId
    }
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    @{
      pid = $existing.Id
      startTime = $existing.StartTime.ToUniversalTime().ToString('O')
    } | ConvertTo-Json | Set-Content -LiteralPath $serverFile -Encoding utf8
    if (-not $SkipBrowser) { Start-Process 'http://127.0.0.1:3001' }
    Write-Host 'Harness is already running at http://127.0.0.1:3001'
    exit 0
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
    if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
    Remove-Item -LiteralPath $serverFile -Force -ErrorAction SilentlyContinue
  }
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
