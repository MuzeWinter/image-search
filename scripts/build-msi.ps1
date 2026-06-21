# ZOOBET 检索 MSI 打包脚本
# 将 backend/ 复制到 src-tauri/ 下，运行 tauri build 生成 .msi

param(
  [switch]$SkipBuild,
  [switch]$CleanOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$BackendSrc = Join-Path $Root "backend"
$TauriDir = Join-Path $Root "src-tauri"
$BackendDest = Join-Path $TauriDir "backend"

Write-Host "=== ZOOBET MSI Packager ==="
Write-Host "Root: $Root"
Write-Host "Backend source: $BackendSrc"
Write-Host "Backend dest:   $BackendDest"
Write-Host ""

# Step 1: Clean previous backend copy
if (Test-Path -LiteralPath $BackendDest) {
  Write-Host "Removing previous backend copy..."
  Remove-Item -LiteralPath $BackendDest -Recurse -Force
}

if ($CleanOnly) {
  Write-Host "Clean complete."
  exit 0
}

# Step 2: Copy backend to src-tauri/ directory
Write-Host "Copying backend/ to src-tauri/backend/..."
Copy-Item -LiteralPath $BackendSrc -Destination $BackendDest -Recurse -Force

# Remove __pycache__ to reduce bundle size
$pycache = Join-Path $BackendDest "__pycache__"
if (Test-Path -LiteralPath $pycache) {
  Remove-Item -LiteralPath $pycache -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 3: Update tauri.conf.json resources config
$confPath = Join-Path $TauriDir "tauri.conf.json"
$conf = Get-Content -LiteralPath $confPath -Raw -Encoding UTF8 | ConvertFrom-Json
$conf.bundle | Add-Member -MemberType NoteProperty -Name "resources" -Value @{ "backend/" = "backend/" } -Force
$conf | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $confPath -Encoding UTF8
Write-Host "Updated tauri.conf.json resources config"

if ($SkipBuild) {
  Write-Host "Skipping build. Backend copied to src-tauri/backend/"
  exit 0
}

# Step 4: Build
Write-Host ""
Write-Host "Running: npm run tauri build"
npm run tauri build

# Step 5: Restore tauri.conf.json (remove resources so dev builds work)
$confRestored = Get-Content -LiteralPath $confPath -Raw -Encoding UTF8 | ConvertFrom-Json
$confRestored.bundle.PSObject.Properties.Remove("resources")
$confRestored | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $confPath -Encoding UTF8

# Step 6: Clean up the temp backend copy
if (Test-Path -LiteralPath $BackendDest) {
  Remove-Item -LiteralPath $BackendDest -Recurse -Force
}

Write-Host ""
Write-Host "=== MSI build complete ==="
$msiPath = Join-Path $TauriDir "target/release/bundle/msi"
if (Test-Path -LiteralPath $msiPath) {
  Get-ChildItem -LiteralPath $msiPath -Filter "*.msi" | ForEach-Object {
    Write-Host "Output: $($_.FullName)"
  }
}
