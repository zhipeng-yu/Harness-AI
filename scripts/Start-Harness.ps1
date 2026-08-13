param(
  [switch]$SkipBrowser,
  [ValidateRange(1, 30)][int]$ReadinessTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

function Get-Utf8Text {
  param([Parameter(Mandatory = $true)][string]$Base64)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
}

function Write-HarnessServerRecord {
  param(
    [Parameter(Mandatory = $true)][string]$RuntimeDir,
    [Parameter(Mandatory = $true)][string]$ServerFile,
    [Parameter(Mandatory = $true)]$Process
  )

  New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
  $temporaryServerFile = Join-Path $RuntimeDir 'server.json.tmp'
  $serverJson = @{
    pid = $Process.Id
    startTime = $Process.StartTime.ToUniversalTime().ToString('O')
  } | ConvertTo-Json
  [IO.File]::WriteAllText(
    $temporaryServerFile,
    $serverJson,
    [Text.UTF8Encoding]::new($false)
  )
  Move-Item -LiteralPath $temporaryServerFile -Destination $ServerFile -Force
}

function Stop-FailedHarnessStart {
  param(
    [Parameter(Mandatory = $true)]$Process,
    [Parameter(Mandatory = $true)][string]$RuntimeDir,
    [Parameter(Mandatory = $true)][string]$ServerFile
  )

  $Process.Refresh()
  if ($Process.HasExited) {
    if (Test-Path -LiteralPath $ServerFile -PathType Leaf) {
      Remove-Item -LiteralPath $ServerFile -Force
    }
    return
  }

  try {
    Stop-Process -InputObject $Process -ErrorAction Stop
    if (-not $Process.WaitForExit(10000)) {
      throw 'Process did not exit after stop.'
    }
  } catch {
    Write-HarnessServerRecord -RuntimeDir $RuntimeDir -ServerFile $ServerFile -Process $Process
    throw (Get-Utf8Text '5ZCv5Yqo5ZCO5riF55CG5aSx6LSl44CC6L+Q6KGM6K6w5b2V5bey5L+d55WZ77yM6K+36L+Q6KGMIFN0b3AtSGFybmVzcy5jbWTjgII=')
  }

  if (Test-Path -LiteralPath $ServerFile -PathType Leaf) {
    Remove-Item -LiteralPath $ServerFile -Force
  }
}

function Invoke-HarnessStart {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [switch]$SkipBrowser,
    [ValidateRange(1, 30)][int]$ReadinessTimeoutSeconds = 30
  )

  $projectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
  $runtimeDir = Join-Path $projectRoot '.runtime'
  $serverFile = Join-Path $runtimeDir 'server.json'
  $launchedProcess = $null

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $nodeMajor = [int]((& $nodePath -p "process.versions.node.split('.')[0]").Trim())
  if ($nodeMajor -lt 24) {
    throw (Get-Utf8Text '6ZyA6KaBIE5vZGUuanMgMjQg5oiW5pu06auY54mI5pys44CC')
  }
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules') -PathType Container)) {
    throw (Get-Utf8Text '6K+35YWI5Zyo6aG555uu55uu5b2V6L+Q6KGMIG5wbS5jbWQgaW5zdGFsbOOAgg==')
  }

  $portOccupied = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
    Where-Object { $_.Port -eq 3000 } |
    Select-Object -First 1
  if ($null -ne $portOccupied) {
    throw (Get-Utf8Text '5pys5py656uv5Y+jIDMwMDAg5bey6KKr5Y2g55So44CC')
  }
  if (Test-Path -LiteralPath $serverFile) {
    throw (Get-Utf8Text '5qOA5rWL5Yiw5bey5pyJ6L+Q6KGM6K6w5b2V77yM6K+35YWI6L+Q6KGMIFN0b3AtSGFybmVzcy5jbWTjgII=')
  }

  Push-Location $projectRoot
  try {
    if (Test-Path -LiteralPath 'data\harness.sqlite' -PathType Leaf) {
      & npm.cmd run db:backup
      if ($LASTEXITCODE) { throw (Get-Utf8Text '5aSH5Lu95aSx6LSl44CC') }
    }
    & npm.cmd run db:migrate
    if ($LASTEXITCODE) { throw (Get-Utf8Text '5pWw5o2u5bqT6L+B56e75aSx6LSl44CC') }
    & npm.cmd run content:validate
    if ($LASTEXITCODE) { throw (Get-Utf8Text '6K++56iL5YaF5a655qCh6aqM5aSx6LSl44CC') }
    & npm.cmd run build
    if ($LASTEXITCODE) { throw (Get-Utf8Text '572R56uZ5p6E5bu65aSx6LSl44CC') }

    $launchedProcess = Start-Process -FilePath $nodePath -ArgumentList @(
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3000'
    ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru

    $deadline = [DateTime]::UtcNow.AddSeconds($ReadinessTimeoutSeconds)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
      $launchedProcess.Refresh()
      if ($launchedProcess.HasExited) {
        throw (Get-Utf8Text '572R56uZ6L+b56iL5Zyo5bCx57uq5YmN6YCA5Ye644CC')
      }
      try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 1
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
          $ready = $true
          break
        }
      } catch {
        Start-Sleep -Milliseconds 100
      }
    }
    if (-not $ready) {
      throw (Get-Utf8Text '572R56uZ5pyq5Zyo6KeE5a6a5pe26Ze05YaF5bCx57uq44CC')
    }

    Write-HarnessServerRecord -RuntimeDir $runtimeDir -ServerFile $serverFile -Process $launchedProcess
    if (-not $SkipBrowser) {
      Start-Process 'http://127.0.0.1:3000'
    }
    Write-Host (Get-Utf8Text '5pys5Zyw572R56uZ5bey5ZCv5Yqo77yaaHR0cDovLzEyNy4wLjAuMTozMDAw')
  } catch {
    $startError = $_
    if ($null -ne $launchedProcess) {
      try {
        Stop-FailedHarnessStart -Process $launchedProcess -RuntimeDir $runtimeDir -ServerFile $serverFile
      } catch {
        throw
      }
    }
    throw $startError
  } finally {
    Pop-Location
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  try {
    $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
    Invoke-HarnessStart -ProjectRoot $projectRoot -SkipBrowser:$SkipBrowser -ReadinessTimeoutSeconds $ReadinessTimeoutSeconds
  } catch {
    Write-Error $_.Exception.Message
    exit 1
  }
}
