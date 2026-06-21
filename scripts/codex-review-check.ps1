param(
  [string]$ProjectRoot = "",
  [string]$ConfigPath = "automation.config.json",
  [string]$ReportPath = ".codex-review/review-report.md"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Join-Path $PSScriptRoot ".."
}

$Root = (Resolve-Path -LiteralPath $ProjectRoot).Path
Set-Location -LiteralPath $Root

function Resolve-ProjectPath {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return Join-Path $Root $Path
}

$ResolvedConfig = Resolve-ProjectPath $ConfigPath
$ResolvedReport = Resolve-ProjectPath $ReportPath
if (-not (Test-Path -LiteralPath $ResolvedConfig)) {
  throw "Missing automation config: $ResolvedConfig"
}

try {
  $Config = Get-Content -LiteralPath $ResolvedConfig -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  throw "Invalid automation config JSON: $($_.Exception.Message)"
}

$ReportDir = Split-Path -Parent $ResolvedReport
if ($ReportDir -and -not (Test-Path -LiteralPath $ReportDir)) {
  New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
}

$Failures = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]
$Sections = New-Object System.Collections.Generic.List[string]

function Add-Section {
  param([string]$Title, [string]$Body)
  $Sections.Add("## $Title`n`n``````text`n$Body`n``````") | Out-Null
}

function Invoke-ReviewCommand {
  param([string]$Name, [string]$Command, [bool]$Required)

  Write-Host "==> $Name"
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & cmd.exe /d /s /c $Command 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $oldPreference
  $text = $output | Out-String
  Add-Section $Name "Command: $Command`nExit code: $exitCode`n$text"

  if ($exitCode -ne 0) {
    $message = "$Name failed with exit code $exitCode"
    if ($Required) { $Failures.Add($message) | Out-Null }
    else { $Warnings.Add($message) | Out-Null }
  }
}

if ($Config.requiredFiles) {
  foreach ($requiredFile in $Config.requiredFiles) {
    $candidate = Resolve-ProjectPath ([string]$requiredFile)
    if (-not (Test-Path -LiteralPath $candidate)) {
      $Failures.Add("Required file missing: $requiredFile") | Out-Null
    }
  }
}

if (-not $Config.reviewCommands -or $Config.reviewCommands.Count -eq 0) {
  $Failures.Add("No reviewCommands configured in automation.config.json") | Out-Null
} else {
  foreach ($step in $Config.reviewCommands) {
    $required = if ($null -eq $step.required) { $true } else { [bool]$step.required }
    Invoke-ReviewCommand -Name ([string]$step.name) -Command ([string]$step.command) -Required $required
  }
}

if ($Config.mojibakeScan -and [bool]$Config.mojibakeScan.enabled) {
  $badCodepoints = @(
    0xFFFD, 0x95C1, 0x9429, 0x935A, 0x93C6, 0x9225, 0x9359,
    0x941C, 0x95C7, 0x93C3, 0x93CD, 0x9286, 0x20AC
  )
  $pattern = (($badCodepoints | ForEach-Object {
    [regex]::Escape([string][char]$_)
  }) -join "|")
  $matches = New-Object System.Collections.Generic.List[string]
  $extensions = @($Config.mojibakeScan.extensions | ForEach-Object { [string]$_ })

  foreach ($scanPath in $Config.mojibakeScan.paths) {
    $resolved = Resolve-ProjectPath ([string]$scanPath)
    if (-not (Test-Path -LiteralPath $resolved)) {
      $Warnings.Add("Mojibake scan path missing: $scanPath") | Out-Null
      continue
    }

    $files = if ((Get-Item -LiteralPath $resolved).PSIsContainer) {
      Get-ChildItem -LiteralPath $resolved -Recurse -File | Where-Object {
        $_.FullName -notmatch "[\\/](node_modules|\.git|dist|build|target|coverage)[\\/]"
      }
    } else {
      @(Get-Item -LiteralPath $resolved)
    }

    foreach ($file in $files) {
      if ($extensions.Count -gt 0) {
        $accepted = $false
        foreach ($extension in $extensions) {
          if ($file.Name -like $extension) { $accepted = $true; break }
        }
        if (-not $accepted) { continue }
      }
      $hits = Select-String -LiteralPath $file.FullName -Pattern $pattern -Encoding UTF8 -ErrorAction SilentlyContinue
      foreach ($hit in $hits) {
        $relative = $file.FullName.Substring($Root.Length).TrimStart([char[]]@('\','/'))
        $matches.Add("${relative}:$($hit.LineNumber): $($hit.Line.Trim())") | Out-Null
      }
    }
  }

  $scanText = if ($matches.Count -eq 0) { "No suspicious mojibake markers found." } else { $matches -join "`n" }
  Add-Section "Mojibake Scan" $scanText
  if ($matches.Count -gt 0) {
    $Failures.Add("Mojibake scan found $($matches.Count) suspicious line(s)") | Out-Null
  }
}

$status = if ($Failures.Count -eq 0) { "PASS" } else { "FAIL" }
$failureText = if ($Failures.Count -eq 0) { "- None" } else { ($Failures | ForEach-Object { "- $_" }) -join "`n" }
$warningText = if ($Warnings.Count -eq 0) { "- None" } else { ($Warnings | ForEach-Object { "- $_" }) -join "`n" }

$report = @"
# Codex Review Report

Status: $status

Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Project: $Root

## Failures

$failureText

## Warnings

$warningText

$($Sections -join "`n`n")
"@

Set-Content -LiteralPath $ResolvedReport -Value $report -Encoding UTF8
Write-Host "Review report written to $ResolvedReport"

if ($Failures.Count -gt 0) { exit 1 }
exit 0
