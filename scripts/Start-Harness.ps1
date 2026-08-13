$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.runtime'
$serverFile = Join-Path $runtimeDir 'server.json'
$testMode = $env:HARNESS_LAUNCHER_TEST -eq '1'
$launchedProcess = $null
$ownsServerFile = $false

function Get-Utf8Text {
  param([Parameter(Mandatory = $true)][string]$Base64)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
}

function Write-TestEvent {
  param(
    [Parameter(Mandatory = $true)][string]$Event,
    [string[]]$Arguments
  )

  if (-not $testMode) { return }
  $payload = @{ event = $Event }
  if ($null -ne $Arguments) { $payload.arguments = $Arguments }
  $payload | ConvertTo-Json -Compress | Add-Content -LiteralPath $env:HARNESS_LAUNCHER_TEST_LOG -Encoding utf8
}

function Invoke-ProjectCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Event,
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(Mandatory = $true)][string]$FailureMessage
  )

  if ($testMode) {
    Write-TestEvent -Event $Event
    if ($env:HARNESS_LAUNCHER_TEST_FAIL_COMMAND -eq $Event) { throw $FailureMessage }
    if ($Event -eq 'db:backup') {
      $backupDirectory = Join-Path $projectRoot 'backups'
      New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
      Set-Content -LiteralPath (Join-Path $backupDirectory 'harness-test-verified.sqlite') -Value 'verified backup' -Encoding utf8
    }
    return
  }

  & npm.cmd run $Script
  if ($LASTEXITCODE) { throw $FailureMessage }
}

try {
  if ($testMode) {
    $nodePath = 'node.exe'
    $nodeMajor = [int]$env:HARNESS_LAUNCHER_TEST_NODE_MAJOR
  } else {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $nodeMajor = [int]((& $nodePath -p 'process.versions.node.split(".")[0]').Trim())
  }

  if ($nodeMajor -lt 24) { throw (Get-Utf8Text '6ZyA6KaBIE5vZGUuanMgMjQg5oiW5pu06auY54mI5pys44CC') }
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules') -PathType Container)) {
    throw (Get-Utf8Text '6K+35YWI5Zyo6aG555uu55uu5b2V6L+Q6KGMIG5wbS5jbWQgaW5zdGFsbOOAgg==')
  }

  Write-TestEvent -Event 'port-check'
  $portOccupied = if ($testMode) {
    $env:HARNESS_LAUNCHER_TEST_PORT_OCCUPIED -eq '1'
  } else {
    $null -ne (Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
  }
  if ($portOccupied) { throw (Get-Utf8Text '5pys5py656uv5Y+jIDMwMDAg5bey6KKr5Y2g55So44CC') }

  if (Test-Path -LiteralPath $serverFile) {
    throw (Get-Utf8Text '5qOA5rWL5Yiw5bey5pyJ6L+Q6KGM6K6w5b2V77yM6K+35YWI6L+Q6KGMIFN0b3AtSGFybmVzcy5jbWTjgII=')
  }

  Push-Location $projectRoot
  try {
    if (Test-Path -LiteralPath 'data\harness.sqlite' -PathType Leaf) {
      Invoke-ProjectCommand -Event 'db:backup' -Script 'db:backup' -FailureMessage (Get-Utf8Text '5aSH5Lu95aSx6LSl44CC')
    }
    Invoke-ProjectCommand -Event 'db:migrate' -Script 'db:migrate' -FailureMessage (Get-Utf8Text '5pWw5o2u5bqT6L+B56e75aSx6LSl44CC')
    Invoke-ProjectCommand -Event 'content:validate' -Script 'content:validate' -FailureMessage (Get-Utf8Text '6K++56iL5YaF5a655qCh6aqM5aSx6LSl44CC')
    Invoke-ProjectCommand -Event 'build' -Script 'build' -FailureMessage (Get-Utf8Text '572R56uZ5p6E5bu65aSx6LSl44CC')

    $childArguments = @(
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3000'
    )
    Write-TestEvent -Event 'start' -Arguments $childArguments
    if ($env:HARNESS_LAUNCHER_TEST_FAIL_COMMAND -eq 'start') { throw (Get-Utf8Text '572R56uZ5ZCv5Yqo5aSx6LSl44CC') }

    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    if ($testMode) {
      $recordedPid = [int]$env:HARNESS_LAUNCHER_TEST_PID
      $recordedStart = ([DateTimeOffset]::Parse($env:HARNESS_LAUNCHER_TEST_START_TIME)).UtcDateTime.ToString('O')
    } else {
      $launchedProcess = Start-Process -FilePath $nodePath -ArgumentList $childArguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
      Start-Sleep -Milliseconds 300
      $launchedProcess.Refresh()
      if ($launchedProcess.HasExited) { throw (Get-Utf8Text '572R56uZ5ZCv5Yqo5aSx6LSl44CC') }
      $recordedPid = $launchedProcess.Id
      $recordedStart = $launchedProcess.StartTime.ToUniversalTime().ToString('O')
    }

    $temporaryServerFile = Join-Path $runtimeDir 'server.json.tmp'
    $serverJson = @{ pid = $recordedPid; startTime = $recordedStart } | ConvertTo-Json
    [IO.File]::WriteAllText(
      $temporaryServerFile,
      $serverJson,
      [Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temporaryServerFile -Destination $serverFile
    $ownsServerFile = $true

    Write-TestEvent -Event 'browser'
    if (-not $testMode) { Start-Process 'http://127.0.0.1:3000' }
    Write-Host (Get-Utf8Text '5pys5Zyw572R56uZ5bey5ZCv5Yqo77yaaHR0cDovLzEyNy4wLjAuMTozMDAw')
  } finally {
    Pop-Location
  }
} catch {
  if ($launchedProcess -and -not $launchedProcess.HasExited) {
    Stop-Process -Id $launchedProcess.Id -ErrorAction SilentlyContinue
  }
  if ($ownsServerFile -and (Test-Path -LiteralPath $serverFile -PathType Leaf)) {
    Remove-Item -LiteralPath $serverFile -Force -ErrorAction SilentlyContinue
  }
  Write-Error $_.Exception.Message
  exit 1
}
