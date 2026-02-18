# HardBrake — Windows Setup Script (PowerShell)
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
#
# Installs all prerequisites, builds the sidecar, and builds the Tauri app.

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "────────────────────────────────────────" -ForegroundColor Cyan
}

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

# ─── 1. Check for winget ─────────────────────────────────────────
Write-Step "Checking for winget..."
if (-not (Test-Command "winget")) {
    Write-Host "winget not found. It should be pre-installed on Windows 10/11." -ForegroundColor Red
    Write-Host "Please install 'App Installer' from the Microsoft Store:" -ForegroundColor Red
    Write-Host "  https://apps.microsoft.com/detail/9NBLGGH4NNS1" -ForegroundColor Yellow
    exit 1
}
Write-Host "  winget found." -ForegroundColor Green

# ─── 2. Install Rust (via rustup) ────────────────────────────────
Write-Step "Checking for Rust..."
if (-not (Test-Command "rustc")) {
    Write-Host "  Installing Rust via rustup..." -ForegroundColor Yellow
    # Download and run rustup-init silently
    $rustupUrl = "https://win.rustup.rs/x86_64"
    $rustupExe = "$env:TEMP\rustup-init.exe"
    Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupExe -UseBasicParsing
    & $rustupExe -y --default-toolchain stable
    # Add cargo to current session PATH
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
    Write-Host "  Rust installed." -ForegroundColor Green
} else {
    $rustVersion = rustc --version
    Write-Host "  $rustVersion" -ForegroundColor Green
}

# ─── 3. Install Bun ──────────────────────────────────────────────
Write-Step "Checking for Bun..."
if (-not (Test-Command "bun")) {
    Write-Host "  Installing Bun..." -ForegroundColor Yellow
    irm https://bun.sh/install.ps1 | iex
    # Add bun to current session PATH
    $env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
    Write-Host "  Bun installed." -ForegroundColor Green
} else {
    $bunVersion = bun --version
    Write-Host "  Bun v$bunVersion" -ForegroundColor Green
}

# ─── 4. Install Node.js (needed for npm/Vite) ────────────────────
Write-Step "Checking for Node.js..."
if (-not (Test-Command "node")) {
    Write-Host "  Installing Node.js via winget..." -ForegroundColor Yellow
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    Write-Host "  Node.js installed." -ForegroundColor Green
} else {
    $nodeVersion = node --version
    Write-Host "  Node $nodeVersion" -ForegroundColor Green
}

# ─── 5. Install Tauri CLI ────────────────────────────────────────
Write-Step "Checking for Tauri CLI..."
if (-not (Test-Command "cargo-tauri")) {
    # Check if it's available as `cargo tauri`
    $tauriCheck = cargo tauri --version 2>$null
    if (-not $tauriCheck) {
        Write-Host "  Installing @tauri-apps/cli via npm..." -ForegroundColor Yellow
        npm install -g @tauri-apps/cli
        Write-Host "  Tauri CLI installed." -ForegroundColor Green
    } else {
        Write-Host "  cargo-tauri found." -ForegroundColor Green
    }
} else {
    Write-Host "  Tauri CLI found." -ForegroundColor Green
}

# ─── 6. Install project dependencies ─────────────────────────────
Write-Step "Installing root dependencies..."
$rootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $rootDir
bun install
Write-Host "  Root deps installed." -ForegroundColor Green

Write-Step "Installing GUI dependencies..."
Push-Location "$rootDir\gui"
npm install
Write-Host "  GUI deps installed." -ForegroundColor Green
Pop-Location
Pop-Location

# ─── 7. Build sidecar ────────────────────────────────────────────
Write-Step "Building sidecar binary..."
Push-Location $rootDir

$binDir = "$rootDir\gui\src-tauri\binaries"
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }

# Detect architecture
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq "Arm64") { "aarch64" } else { "x86_64" }
$triple = "$arch-pc-windows-msvc"
$output = "$binDir\hardbrake-core-$triple.exe"

Write-Host "  Target: $triple" -ForegroundColor Gray
bun build src/bridge.ts --compile --outfile $output
Write-Host "  Sidecar built: $output" -ForegroundColor Green
Pop-Location

# ─── 8. Build Tauri app ──────────────────────────────────────────
Write-Step "Building HardBrake desktop app..."
Push-Location "$rootDir\gui"
npm run tauri build
Pop-Location

Write-Step "Done!"
Write-Host ""
Write-Host "  Build output:" -ForegroundColor Green
Write-Host "    $rootDir\gui\src-tauri\target\release\bundle\" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Look for .msi and .exe installers in the bundle folder." -ForegroundColor Gray
Write-Host ""
