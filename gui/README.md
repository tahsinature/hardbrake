# HardBrake GUI

Desktop application for HardBrake — video & audio compression powered by HandBrakeCLI and ffmpeg.

Built with [Tauri v2](https://tauri.app/) + React + TypeScript.

## Quick Setup (one command)

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

### macOS / Linux

```sh
bash scripts/setup.sh
```

These scripts install **everything** needed (Rust, Bun, Node.js, Tauri CLI, system libraries) and build the app.

---

## Manual Setup

### Prerequisites

| Tool                           | Install                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [Rust](https://rustup.rs/)     | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh`                                                        |
| [Bun](https://bun.sh/)         | `curl -fsSL https://bun.sh/install \| bash`                                                                              |
| [Node.js](https://nodejs.org/) | LTS version via your package manager                                                                                     |
| **Linux only**: system libs    | `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config` |

### Build Steps

```sh
# 1. Install root dependencies
bun install

# 2. Install GUI dependencies
cd gui && npm install && cd ..

# 3. Build the sidecar binary
./scripts/build-bridge

# 4. Build the desktop app
cd gui && npm run tauri build
```

### Build Output

| Platform | Output                                                              |
| -------- | ------------------------------------------------------------------- |
| macOS    | `gui/src-tauri/target/release/bundle/macos/HardBrake.app`           |
| macOS    | `gui/src-tauri/target/release/bundle/dmg/HardBrake_*.dmg`           |
| Windows  | `gui\src-tauri\target\release\bundle\msi\HardBrake_*.msi`           |
| Windows  | `gui\src-tauri\target\release\bundle\nsis\HardBrake_*-setup.exe`    |
| Linux    | `gui/src-tauri/target/release/bundle/deb/hardbrake_*.deb`           |
| Linux    | `gui/src-tauri/target/release/bundle/appimage/HardBrake_*.AppImage` |

## Development

```sh
# Build sidecar first
./scripts/build-bridge

# Start dev server with hot reload
cd gui && npm run tauri dev
```

## Architecture

```
React (gui/src/)
  ↕  Command.sidecar() via Tauri shell plugin
hardbrake-core sidecar (src/bridge.ts → compiled binary)
  ↕  JSON events over stdout
TypeScript engine (src/engine.ts)
  ↕  spawns
HandBrakeCLI / ffmpeg (system binaries)
```

Rust (`gui/src-tauri/src/lib.rs`) is only a thin Tauri bootstrap — **all logic lives in TypeScript**, shared between CLI and GUI.

## Runtime Dependencies

The app will prompt you to install these if missing:

- **[HandBrakeCLI](https://handbrake.fr/)** — video compression
- **[ffmpeg](https://ffmpeg.org/)** — audio compression

Auto-install supported via: `brew` (macOS), `winget`/`choco` (Windows), `apt` (Linux).
