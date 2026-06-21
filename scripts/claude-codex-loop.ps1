param(
  [string]$ProjectRoot = "",
  [string]$QueueDir = "docs/claude-tasks/queue",
  [string]$DoneDir = "docs/claude-tasks/done",
  [string]$FailedDir = "docs/claude-tasks/failed",
  [string]$LogDir = "docs/claude-tasks/logs",
  [int]$MaxRepairAttempts = 3,
  [string]$ClaudeCommand = "claude",
  [string]$PermissionMode = "bypassPermissions",
  [string]$ClaudeEffort = "high",
  [switch]$Once,
  [switch]$DryRun,
  [switch]$AllowDirtyStart
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

$QueueDir = Resolve-ProjectPath $QueueDir
$DoneDir = Resolve-ProjectPath $DoneDir
$FailedDir = Resolve-ProjectPath $FailedDir
$LogDir = Resolve-ProjectPath $LogDir
$ReviewScript = Join-Path $Root "scripts/codex-review-check.ps1"

function Write-Step { param([string]$Message) Write-Host "==> $Message" }
function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }
}
function Get-TimeStamp { (Get-Date).ToString("yyyyMMdd-HHmmss") }

function Invoke-Capture {
  param([string]$Title, [scriptblock]$Command, [string]$OutputFile)
  Write-Step $Title
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & $Command 2>&1
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  $ErrorActionPreference = $oldPreference
  $text = $output | Out-String
  Set-Content -LiteralPath $OutputFile -Value $text -Encoding UTF8
  [pscustomobject]@{ ExitCode = $exitCode; Output = $text }
}

function Move-TaskFile {
  param([string]$SourcePath, [string]$TargetDir, [string]$Suffix)
  Ensure-Directory $TargetDir
  $name = [System.IO.Path]::GetFileNameWithoutExtension($SourcePath)
  $target = Join-Path $TargetDir ("{0}-{1}.md" -f $name, $Suffix)
  if (Test-Path -LiteralPath $SourcePath) {
    Move-Item -LiteralPath $SourcePath -Destination $target -ErrorAction Stop
  } else {
    Write-Host "  (task file already moved, skipping Move-Item)"
  }
  $target
}

function New-ClaudePrompt {
  param([string]$TaskText, [string]$ReviewText, [int]$Attempt)

  $rules = @("AGENTS.md", "CLAUDE.md", "docs/AI-CODING-RULES.md") |
    Where-Object { Test-Path -LiteralPath (Join-Path $Root $_) }
  $ruleLines = if ($rules.Count -gt 0) {
    $rules | ForEach-Object { "- $_" }
  } else {
    @("- Follow all project documentation and existing conventions.")
  }

  $parts = @(
    "# Claude Code automated task",
    "",
    "## Role",
    "You are the implementation agent. Write and verify real project code.",
    "Read and follow these project rules:",
    ($ruleLines -join [Environment]::NewLine),
    "",
    "## Hard rules",
    "- Do not implement fake functionality or UI-only placeholders.",
    "- Do not swallow errors or delete unrelated behavior.",
    "- Do not weaken tests to make review pass.",
    "- Preserve existing architecture unless the task explicitly changes it.",
    "- Run every test required by the task.",
    "- Do not git commit. Do not git push.",
    "",
    "## Task",
    $TaskText
  )

  if (-not [string]::IsNullOrWhiteSpace($ReviewText)) {
    $parts += @(
      "",
      "## Codex review failure report",
      "This is repair attempt $Attempt. Fix the listed failures without expanding scope.",
      "",
      '```text',
      $ReviewText,
      '```'
    )
  }
  $parts -join [Environment]::NewLine
}

foreach ($dir in @($QueueDir, $DoneDir, $FailedDir, $LogDir)) { Ensure-Directory $dir }

if (-not (Get-Command $ClaudeCommand -ErrorAction SilentlyContinue)) {
  throw "Claude Code command not found: $ClaudeCommand"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git command not found."
}
if (-not (Test-Path -LiteralPath $ReviewScript)) {
  throw "Missing review script: $ReviewScript"
}

$initialStatus = git status --short
if ($LASTEXITCODE -ne 0) { throw "ProjectRoot is not a valid Git working tree: $Root" }
if (($initialStatus | Measure-Object).Count -gt 0 -and -not $AllowDirtyStart) {
  Write-Host "Working tree is dirty. Review it, then pass -AllowDirtyStart explicitly."
  Write-Host ($initialStatus | Out-String)
  exit 2
}

$tasks = @(Get-ChildItem -LiteralPath $QueueDir -Filter "*.md" -File | Sort-Object Name)
if ($tasks.Count -eq 0) {
  Write-Step "No queued tasks."
  exit 0
}

if ($DryRun) {
  Write-Step "Dry run. Tasks that would be processed:"
  $tasks | ForEach-Object { Write-Host " - $($_.Name)" }
  exit 0
}

$processed = 0
while ($tasks.Count -gt 0) {
  $task = $tasks[0]
  $taskName = [System.IO.Path]::GetFileNameWithoutExtension($task.Name)
  $stamp = Get-TimeStamp
  $taskLogDir = Join-Path $LogDir "$stamp-$taskName"
  Ensure-Directory $taskLogDir
  Write-Step "Task: $($task.Name)"

  $taskText = Get-Content -LiteralPath $task.FullName -Raw -Encoding UTF8
  $reviewText = ""
  $passed = $false

  for ($attempt = 0; $attempt -le $MaxRepairAttempts; $attempt++) {
    $attemptNumber = $attempt + 1
    $prompt = New-ClaudePrompt -TaskText $taskText -ReviewText $reviewText -Attempt $attempt
    $promptPath = Join-Path $taskLogDir "attempt-$attemptNumber-prompt.md"
    $claudeLog = Join-Path $taskLogDir "attempt-$attemptNumber-claude.log"
    $reviewLog = Join-Path $taskLogDir "attempt-$attemptNumber-codex-review.log"
    Set-Content -LiteralPath $promptPath -Value $prompt -Encoding UTF8

    $instruction = @(
      "Read the full task prompt from this UTF-8 Markdown file and execute it exactly:",
      $promptPath,
      "",
      "Do not ignore the file. Do not git commit. Do not git push."
    ) -join [Environment]::NewLine

    $claudeArgs = @("-p", "--permission-mode", $PermissionMode)
    if (-not [string]::IsNullOrWhiteSpace($ClaudeEffort)) {
      $claudeArgs += @("--effort", $ClaudeEffort)
    }
    $claudeArgs += $instruction

    $claudeResult = Invoke-Capture "Claude Code attempt $attemptNumber" {
      & $ClaudeCommand @claudeArgs
    } $claudeLog

    if ($claudeResult.ExitCode -ne 0) {
      $reviewText = "Claude Code failed with exit code $($claudeResult.ExitCode).`n`n$($claudeResult.Output)"
      if ($attempt -eq $MaxRepairAttempts) { break }
      continue
    }

    $reviewResult = Invoke-Capture "Codex review attempt $attemptNumber" {
      powershell -ExecutionPolicy Bypass -File $ReviewScript -ProjectRoot $Root
    } $reviewLog

    $reportPath = Join-Path $Root ".codex-review/review-report.md"
    if (Test-Path -LiteralPath $reportPath) {
      Copy-Item -LiteralPath $reportPath -Destination (Join-Path $taskLogDir "attempt-$attemptNumber-review-report.md") -Force
      $reviewText = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8
    } else {
      $reviewText = $reviewResult.Output
    }

    if ($reviewResult.ExitCode -eq 0 -and $reviewText -match "Status:\s+PASS") {
      $passed = $true
      break
    }
    if ($attempt -eq $MaxRepairAttempts) { break }
  }

  if ($passed) {
    $target = Move-TaskFile $task.FullName $DoneDir $stamp
    Write-Step "Task passed and moved to $target"
  } else {
    $target = Move-TaskFile $task.FullName $FailedDir $stamp
    Write-Step "Task failed and moved to $target"
    exit 1
  }

  $processed++
  if ($Once) { break }
  $tasks = @(Get-ChildItem -LiteralPath $QueueDir -Filter "*.md" -File | Sort-Object Name)
}

Write-Step "Loop finished. Processed tasks: $processed"

