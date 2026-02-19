@echo off
REM ================================================================
REM  HardBrake — Windows Setup Script
REM  Works in: CMD, PowerShell, Git Bash (via: cmd /c scripts\setup.bat)
REM
REM  Usage:  scripts\setup.bat
REM
REM  Installs prerequisites, builds the sidecar, and builds the app.
REM ================================================================
setlocal enabledelayedexpansion

call :step "Checking for winget..."
where winget >nul 2>&1
if errorlevel 1 (
    echo [ERROR] winget not found. It should be pre-installed on Windows 10/11.
    echo         Install "App Installer" from the Microsoft Store:
    echo         https://apps.microsoft.com/detail/9NBLGGH4NNS1
    exit /b 1
)
echo   winget found.

REM ─── 1. Install Visual Studio Build Tools (C++ workload) ────────
call :step "Checking for Visual Studio Build Tools..."
where cl >nul 2>&1
if errorlevel 1 (
    echo   C++ compiler not found. Installing VS Build Tools...
    echo   This may take a while ^(several GB download^)...
    winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-source-agreements --accept-package-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    if errorlevel 1 (
        echo [WARN] VS Build Tools install may have failed. If the build fails later,
        echo        install manually from https://visualstudio.microsoft.com/visual-cpp-build-tools/
    ) else (
        echo   VS Build Tools installed.
    )
) else (
    echo   C++ compiler found.
)

REM ─── 2. Install Rust ───────────────────────────────────────────
call :step "Checking for Rust..."
where rustc >nul 2>&1
if errorlevel 1 (
    echo   Installing Rust via rustup...
    curl -sSf -o "%TEMP%\rustup-init.exe" https://win.rustup.rs/x86_64
    "%TEMP%\rustup-init.exe" -y --default-toolchain stable
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
    echo   Rust installed.
) else (
    rustc --version
)

REM ─── 3. Install Bun ───────────────────────────────────────────
call :step "Checking for Bun..."
where bun >nul 2>&1
if errorlevel 1 (
    echo   Installing Bun...
    powershell -Command "irm https://bun.sh/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    echo   Bun installed.
) else (
    echo   Bun found.
    bun --version
)

REM ─── 4. Install Node.js ───────────────────────────────────────
call :step "Checking for Node.js..."
where node >nul 2>&1
if errorlevel 1 (
    echo   Installing Node.js via winget...
    winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    REM Refresh PATH from system
    for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USR_PATH=%%B"
    set "PATH=!SYS_PATH!;!USR_PATH!;%PATH%"
    echo   Node.js installed.
) else (
    echo   Node.js found.
    node --version
)

REM ─── 5. Install project dependencies ──────────────────────────
REM Resolve the project root (scripts\ is one level down)
pushd "%~dp0.."
set "ROOT_DIR=%CD%"

call :step "Installing root dependencies..."
call bun install
echo   Root deps installed.

call :step "Installing GUI dependencies..."
pushd gui
call bun install
popd
echo   GUI deps installed.

REM ─── 6. Build sidecar ─────────────────────────────────────────
call :step "Building sidecar binary..."
set "BIN_DIR=%ROOT_DIR%\gui\src-tauri\binaries"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

REM Detect architecture
set "ARCH=x86_64"
if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=aarch64"

set "TRIPLE=%ARCH%-pc-windows-msvc"
set "OUTPUT=%BIN_DIR%\hardbrake-core-%TRIPLE%.exe"

echo   Target: %TRIPLE%
call bun build src/bridge.ts --compile --outfile "%OUTPUT%"
echo   Sidecar built: %OUTPUT%

REM ─── 7. Build Tauri app ───────────────────────────────────────
call :step "Building HardBrake desktop app..."
pushd gui
call bun run tauri build
popd

call :step "Done!"
echo.
echo   Build output:
echo     %ROOT_DIR%\gui\src-tauri\target\release\bundle\
echo.
echo   Look for .msi and .exe installers in the bundle folder.
echo.

popd
exit /b 0

:step
echo.
echo ========================================
echo   %~1
echo ========================================
exit /b 0
