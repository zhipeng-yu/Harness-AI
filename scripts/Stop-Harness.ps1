$ErrorActionPreference = 'Stop'

function Get-Utf8Text {
  param([Parameter(Mandatory = $true)][string]$Base64)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Base64))
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

  $process = Get-Process -Id $recordedPid -ErrorAction Stop
  $actualStart = $process.StartTime.ToUniversalTime()
  if ([Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -gt 1) {
    throw (Get-Utf8Text 'UElEIOS4juWQr+WKqOaXtumXtOS4jeWMuemFje+8jOaLkue7neWBnOatouS7u+S9lei/m+eoi+OAgg==')
  }

  $process.Refresh()
  if ($process.HasExited) {
    throw (Get-Utf8Text '572R56uZ6L+b56iL5bey6YCA5Ye677yM5L+d55WZ6L+Q6KGM6K6w5b2V44CC')
  }
  $actualStart = $process.StartTime.ToUniversalTime()
  if ([Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -gt 1) {
    throw (Get-Utf8Text 'UElEIOS4juWQr+WKqOaXtumXtOS4jeWMuemFje+8jOaLkue7neWBnOatouS7u+S9lei/m+eoi+OAgg==')
  }

  Stop-Process -InputObject $process -ErrorAction Stop
  if (-not $process.WaitForExit(10000)) {
    throw (Get-Utf8Text '572R56uZ6L+b56iL5pyq6IO956Gu6K6k5YGc5q2i77yM5L+d55WZ6L+Q6KGM6K6w5b2V44CC')
  }

  Remove-Item -LiteralPath $resolvedServerFile -Force
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
