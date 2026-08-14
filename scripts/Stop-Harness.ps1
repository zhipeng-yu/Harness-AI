$ErrorActionPreference = 'Stop'

function Get-Utf8Text {
  param([Parameter(Mandatory = $true)][string]$Base64)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
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
    [Parameter(Mandatory = $true)][string]$ServerFile,
    [Parameter(Mandatory = $true)]$Identity
  )

  $runtimeItem = Get-Item -LiteralPath $RuntimeDir -Force -ErrorAction Stop
  if (-not $runtimeItem.PSIsContainer -or ($runtimeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Runtime directory identity changed; refusing cleanup.'
  }
  $resolvedRuntime = (Resolve-Path -LiteralPath $RuntimeDir -ErrorAction Stop).Path
  if (-not $resolvedRuntime.Equals((Join-Path $ProjectRoot '.runtime'), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Runtime directory moved outside the project; refusing cleanup.'
  }
  if (-not (Test-HarnessRecordIdentity -Path $ServerFile -Identity $Identity)) {
    throw 'Runtime record identity changed; refusing cleanup.'
  }
  Remove-Item -LiteralPath $ServerFile -Force
}

function Invoke-HarnessStop {
  param([Parameter(Mandatory = $true)][string]$ProjectRoot)

  $projectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
  $runtimeDir = Join-Path $projectRoot '.runtime'
  $serverFile = Join-Path $runtimeDir 'server.json'

  $currentPath = $projectRoot
  foreach ($segment in @('.runtime', 'server.json')) {
    $currentPath = Join-Path $currentPath $segment
    $item = Get-Item -LiteralPath $currentPath -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw (Get-Utf8Text '6L+Q6KGM6K6w5b2V55qE55yf5a6e6Lev5b6E5LiN5Zyo6aG555uu55uu5b2V5YaF77yM5ouS57ud5YGc5q2i5Lu75L2V6L+b56iL44CC')
    }
  }

  $resolvedServerFile = (Resolve-Path -LiteralPath $serverFile -ErrorAction Stop).Path
  $rootPrefix = $projectRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $resolvedServerFile.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw (Get-Utf8Text '6L+Q6KGM6K6w5b2V55qE55yf5a6e6Lev5b6E5LiN5Zyo6aG555uu55uu5b2V5YaF77yM5ouS57ud5YGc5q2i5Lu75L2V6L+b56iL44CC')
  }
  if (-not (Test-Path -LiteralPath $resolvedServerFile -PathType Leaf)) {
    throw (Get-Utf8Text '6L+Q6KGM6K6w5b2V5LiN5piv5pmu6YCa5paH5Lu277yM5ouS57ud5YGc5q2i5Lu75L2V6L+b56iL44CC')
  }
  $serverIdentity = Get-HarnessRecordIdentity -Path $resolvedServerFile

  try {
    $record = Get-Content -Raw -LiteralPath $resolvedServerFile -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw (Get-Utf8Text '6L+Q6KGM6K6w5b2V5peg5rOV5a6J5YWo6K+75Y+W77yM5ouS57ud5YGc5q2i5Lu75L2V6L+b56iL44CC')
  }

  $recordedPid = 0
  if (-not [int]::TryParse([string]$record.pid, [ref]$recordedPid) -or $recordedPid -le 0) {
    throw (Get-Utf8Text '6L+Q6KGM6K6w5b2V5Lit55qEIFBJRCDml6DmlYjvvIzmi5Lnu53lgZzmraLku7vkvZXov5vnqIvjgII=')
  }
  $recordedStart = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse([string]$record.startTime, [ref]$recordedStart)) {
    throw (Get-Utf8Text '6L+Q6KGM6K6w5b2V5Lit55qE5ZCv5Yqo5pe26Ze05peg5pWI77yM5ouS57ud5YGc5q2i5Lu75L2V6L+b56iL44CC')
  }
  $expectedStart = $recordedStart.ToUniversalTime().UtcDateTime

  try {
    $process = Get-Process -Id $recordedPid -ErrorAction Stop
  } catch {
    if ($_.FullyQualifiedErrorId -notlike 'NoProcessFoundForGivenId*') { throw }
    Remove-HarnessOwnedRecord -ProjectRoot $projectRoot -RuntimeDir $runtimeDir -ServerFile $resolvedServerFile -Identity $serverIdentity
    Write-Host (Get-Utf8Text '5pys5Zyw572R56uZ5bey5YGc5q2i77yM6ZmI5pen6K6w5b2V5bey5riF55CG44CC')
    return
  }
  $actualStart = $process.StartTime.ToUniversalTime()
  if ([Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -gt 1) {
    throw (Get-Utf8Text 'UElEIOS4juWQr+WKqOaXtumXtOS4jeWMuemFje+8jOaLkue7neWBnOatouS7u+S9lei/m+eoi+OAgg==')
  }

  $process.Refresh()
  if ($process.HasExited) {
    Remove-HarnessOwnedRecord -ProjectRoot $projectRoot -RuntimeDir $runtimeDir -ServerFile $resolvedServerFile -Identity $serverIdentity
    Write-Host (Get-Utf8Text '5pys5Zyw572R56uZ5bey5YGc5q2i77yM6ZmI5pen6K6w5b2V5bey5riF55CG44CC')
    return
  }
  $actualStart = $process.StartTime.ToUniversalTime()
  if ([Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -gt 1) {
    throw (Get-Utf8Text 'UElEIOS4juWQr+WKqOaXtumXtOS4jeWMuemFje+8jOaLkue7neWBnOatouS7u+S9lei/m+eoi+OAgg==')
  }

  Stop-Process -InputObject $process -ErrorAction Stop
  if (-not $process.WaitForExit(10000)) {
    throw (Get-Utf8Text '572R56uZ6L+b56iL5pyq6IO956Gu6K6k5YGc5q2i77yM5L+d55WZ6L+Q6KGM6K6w5b2V44CC')
  }

  Remove-HarnessOwnedRecord -ProjectRoot $projectRoot -RuntimeDir $runtimeDir -ServerFile $resolvedServerFile -Identity $serverIdentity
  Write-Host (Get-Utf8Text '5pys5Zyw572R56uZ5bey5YGc5q2i44CC')
}

if ($MyInvocation.InvocationName -ne '.') {
  try {
    $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
    Invoke-HarnessStop -ProjectRoot $projectRoot
  } catch {
    Write-Error $_.Exception.Message
    exit 1
  }
}
