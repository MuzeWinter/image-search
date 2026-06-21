# validate-configs.ps1
# Validates all project JSON configuration files for well-formed syntax and optional schema references.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/validate-configs.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."

$ConfigFiles = @(
    "automation.config.json",
    "src-tauri/tauri.conf.json",
    "package.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "schemas/automation.config.schema.json"
)

$AllOk = $true
$Checked = 0
$Failed = 0
$Skipped = 0

Write-Host "=== Config JSON Validation ===" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot`n"

foreach ($relativePath in $ConfigFiles) {
    $fullPath = Join-Path $ProjectRoot $relativePath

    if (-not (Test-Path $fullPath)) {
        Write-Host "  SKIP  $relativePath (file not found)" -ForegroundColor Yellow
        $Skipped++
        continue
    }

    try {
        $content = Get-Content -Path $fullPath -Raw -Encoding UTF8
        $json = $content | ConvertFrom-Json -ErrorAction Stop
        $Checked++

        $schema = ""
        try {
            $obj = $content | ConvertFrom-Json
            if ($obj.PSObject.Properties.Name -contains '$schema') {
                $schema = $obj.'$schema'
            }
        } catch { }

        if ($schema) {
            Write-Host "  OK    $relativePath  (schema: $schema)" -ForegroundColor Green
        } else {
            Write-Host "  OK    $relativePath" -ForegroundColor Green
        }
    } catch {
        Write-Host "  FAIL  $relativePath  $($_.Exception.Message)" -ForegroundColor Red
        $AllOk = $false
        $Failed++
    }
}

Write-Host ""
Write-Host "=== Result ===" -ForegroundColor Cyan
Write-Host "  Checked: $Checked"
Write-Host "  Skipped: $Skipped"
Write-Host "  Failed:  $Failed"
Write-Host ""

if ($AllOk) {
    Write-Host "All config JSON files are valid." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some config JSON files have errors!" -ForegroundColor Red
    exit 1
}
