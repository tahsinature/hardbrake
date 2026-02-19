@echo off
REM Build the hardbrake-core sidecar binary for Windows.
REM Works in: CMD, PowerShell, Git Bash (via: cmd /c scripts\build-bridge.bat)
REM
REM Usage: scripts\build-bridge.bat

setlocal

pushd "%~dp0.."
set "ROOT_DIR=%CD%"
set "BIN_DIR=%ROOT_DIR%\src-tauri\binaries"

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

REM Detect architecture
set "ARCH=x86_64"
if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=aarch64"

set "TRIPLE=%ARCH%-pc-windows-msvc"
set "OUTPUT=%BIN_DIR%\hardbrake-core-%TRIPLE%.exe"

echo Building hardbrake-core sidecar...
echo   Source:  cli\bridge.ts
echo   Output:  %OUTPUT%
echo   Target:  %TRIPLE%

call bun build cli/bridge.ts --compile --outfile "%OUTPUT%"

echo.
echo Done! Sidecar binary: %OUTPUT%

popd
