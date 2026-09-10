$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$serverFile = Join-Path $projectRoot '.runtime\server.json'

try {
  if (-not (Test-Path -LiteralPath $serverFile -PathType Leaf)) {
    Write-Host 'Harness is already stopped.'
    exit 0
  }

  $record = Get-Content -LiteralPath $serverFile -Raw | ConvertFrom-Json
  $pidValue = 0
  if (-not [int]::TryParse([string]$record.pid, [ref]$pidValue) -or $pidValue -le 0) {
    throw 'The server record has an invalid PID.'
  }
  $recordedStart = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse([string]$record.startTime, [ref]$recordedStart)) {
    throw 'The server record has an invalid start time.'
  }

  $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    Remove-Item -LiteralPath $serverFile -Force
    Write-Host 'Harness was already stopped; stale state was removed.'
    exit 0
  }

  $difference = ($process.StartTime.ToUniversalTime() - $recordedStart.UtcDateTime).Duration()
  if ($difference.TotalSeconds -gt 1) {
    throw 'The PID now belongs to another process; nothing was stopped.'
  }

  & taskkill.exe /PID $process.Id /T /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'The website process tree could not be stopped.' }
  if (-not $process.WaitForExit(10000)) { throw 'The website process did not stop.' }
  Remove-Item -LiteralPath $serverFile -Force
  Write-Host 'Harness is stopped.'
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
