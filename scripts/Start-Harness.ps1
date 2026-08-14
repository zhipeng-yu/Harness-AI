param(
  [switch]$SkipBrowser,
  [ValidateRange(1, 30)][int]$ReadinessTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

function Get-Utf8Text {
  param([Parameter(Mandatory = $true)][string]$Base64)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
}

function Assert-HarnessRuntimeDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeDir
  )

  if (-not (Test-Path -LiteralPath $RuntimeDir)) {
    New-Item -ItemType Directory -Path $RuntimeDir -ErrorAction Stop | Out-Null
  }
  $runtimeItem = Get-Item -LiteralPath $RuntimeDir -Force -ErrorAction Stop
  if (-not $runtimeItem.PSIsContainer -or ($runtimeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Runtime directory must be a direct non-reparse project directory.'
  }
  $resolvedRuntime = (Resolve-Path -LiteralPath $RuntimeDir -ErrorAction Stop).Path
  $expectedRuntime = Join-Path $ProjectRoot '.runtime'
  if (-not $resolvedRuntime.Equals($expectedRuntime, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Runtime directory must resolve directly inside the project.'
  }
  return $resolvedRuntime
}

function Get-HarnessRecordIdentity {
  param([Parameter(Mandatory = $true)][string]$Path)

  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Runtime record must be a regular non-reparse file.'
  }
  return [pscustomobject]@{
    Length = $item.Length
    CreationTicks = $item.CreationTimeUtc.Ticks
    LastWriteTicks = $item.LastWriteTimeUtc.Ticks
    Content = [IO.File]::ReadAllText($item.FullName, [Text.Encoding]::UTF8)
  }
}

function Test-HarnessRecordIdentity {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]$Identity
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  try {
    $current = Get-HarnessRecordIdentity -Path $Path
    return $current.Length -eq $Identity.Length -and
      $current.CreationTicks -eq $Identity.CreationTicks -and
      $current.LastWriteTicks -eq $Identity.LastWriteTicks -and
      $current.Content -ceq $Identity.Content
  } catch {
    return $false
  }
}

function Remove-HarnessOwnedRecord {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeDir,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]$Identity
  )

  [void](Assert-HarnessRuntimeDirectory -ProjectRoot $ProjectRoot -RuntimeDir $RuntimeDir)
  if (-not (Test-HarnessRecordIdentity -Path $Path -Identity $Identity)) {
    throw 'Runtime record identity changed; refusing cleanup.'
  }
  Remove-Item -LiteralPath $Path -Force
}

function Write-HarnessServerRecord {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeDir,
    [Parameter(Mandatory = $true)][string]$ServerFile,
    [Parameter(Mandatory = $true)]$Process
  )

  [void](Assert-HarnessRuntimeDirectory -ProjectRoot $ProjectRoot -RuntimeDir $RuntimeDir)
  if (Test-Path -LiteralPath $ServerFile) {
    throw 'Runtime server record already exists.'
  }
  $temporaryServerFile = Join-Path $RuntimeDir 'server.json.tmp'
  $serverJson = @{
    pid = $Process.Id
    startTime = $Process.StartTime.ToUniversalTime().ToString('O')
  } | ConvertTo-Json
  $temporaryIdentity = $null
  try {
    $stream = [IO.File]::Open(
      $temporaryServerFile,
      [IO.FileMode]::CreateNew,
      [IO.FileAccess]::Write,
      [IO.FileShare]::None
    )
    try {
      $bytes = [Text.UTF8Encoding]::new($false).GetBytes($serverJson)
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Flush($true)
    } finally {
      $stream.Dispose()
    }
    $temporaryIdentity = Get-HarnessRecordIdentity -Path $temporaryServerFile
    [void](Assert-HarnessRuntimeDirectory -ProjectRoot $ProjectRoot -RuntimeDir $RuntimeDir)
    if (Test-Path -LiteralPath $ServerFile) {
      throw 'Runtime server record appeared before rename.'
    }
    if (-not (Test-HarnessRecordIdentity -Path $temporaryServerFile -Identity $temporaryIdentity)) {
      throw 'Runtime temporary record identity changed before rename.'
    }
    Move-Item -LiteralPath $temporaryServerFile -Destination $ServerFile
    return Get-HarnessRecordIdentity -Path $ServerFile
  } catch {
    if ($null -ne $temporaryIdentity -and (Test-HarnessRecordIdentity -Path $temporaryServerFile -Identity $temporaryIdentity)) {
      Remove-Item -LiteralPath $temporaryServerFile -Force
    }
    throw
  }
}

function Stop-FailedHarnessStart {
  param(
    [Parameter(Mandatory = $true)]$Process,
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$RuntimeDir,
    [Parameter(Mandatory = $true)][string]$ServerFile,
    $ServerIdentity
  )

  $Process.Refresh()
  if ($Process.HasExited) {
    if ($null -ne $ServerIdentity) {
      Remove-HarnessOwnedRecord -ProjectRoot $ProjectRoot -RuntimeDir $RuntimeDir -Path $ServerFile -Identity $ServerIdentity
    }
    return
  }

  try {
    Stop-Process -InputObject $Process -ErrorAction Stop
    if (-not $Process.WaitForExit(10000)) {
      throw 'Process did not exit after stop.'
    }
  } catch {
    if ($null -eq $ServerIdentity) {
      $ServerIdentity = Write-HarnessServerRecord -ProjectRoot $ProjectRoot -RuntimeDir $RuntimeDir -ServerFile $ServerFile -Process $Process
    }
    throw (Get-Utf8Text '5ZCv5Yqo5ZCO5riF55CG5aSx6LSl44CC6L+Q6KGM6K6w5b2V5bey5L+d55WZ77yM6K+36L+Q6KGMIFN0b3AtSGFybmVzcy5jbWTjgII=')
  }

  if ($null -ne $ServerIdentity) {
    Remove-HarnessOwnedRecord -ProjectRoot $ProjectRoot -RuntimeDir $RuntimeDir -Path $ServerFile -Identity $ServerIdentity
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
  $serverIdentity = $null

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
  [void](Assert-HarnessRuntimeDirectory -ProjectRoot $projectRoot -RuntimeDir $runtimeDir)
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

    $serverIdentity = Write-HarnessServerRecord -ProjectRoot $projectRoot -RuntimeDir $runtimeDir -ServerFile $serverFile -Process $launchedProcess
    if (-not $SkipBrowser) {
      Start-Process 'http://127.0.0.1:3000'
    }
    Write-Host (Get-Utf8Text '5pys5Zyw572R56uZ5bey5ZCv5Yqo77yaaHR0cDovLzEyNy4wLjAuMTozMDAw')
  } catch {
    $startError = $_
    if ($null -ne $launchedProcess) {
      try {
        Stop-FailedHarnessStart -Process $launchedProcess -ProjectRoot $projectRoot -RuntimeDir $runtimeDir -ServerFile $serverFile -ServerIdentity $serverIdentity
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
