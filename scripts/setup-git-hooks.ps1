# Install pre-commit hook that runs build + Python syntax check before each commit.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup-git-hooks.ps1

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$hooksDir = Join-Path $repoRoot ".git\hooks"
$hookFile = Join-Path $hooksDir "pre-commit"

New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null

$hookContent = @'
#!/bin/bash
# Pre-commit hook: build + Python syntax check
# Installed by scripts/setup-git-hooks.ps1 — re-run after cloning.
set -e

echo ""
echo "=== Pre-commit: Build check (tsc + vite) ==="
npm run build

echo ""
echo "=== Pre-commit: Python syntax check ==="
python -m compileall backend/ -q || {
    echo ""
    echo "ERROR: Python syntax errors found (see above)."
    echo "Fix syntax errors before committing."
    exit 1
}

echo ""
echo "Pre-commit checks passed."
'@

[System.IO.File]::WriteAllLines($hookFile, $hookContent)
Write-Host "Pre-commit hook installed to $hookFile"
