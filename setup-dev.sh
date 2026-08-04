#!/bin/bash
# Setup sidecar binary for development.
# Compiles the TypeScript bridge (src/bridge.ts) into a standalone
# binary that Tauri expects at src-tauri/binaries/hardbrake-core-<triple>.
#
# Run from the repo root:
#   ./setup-dev.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Building hardbrake-core sidecar for development…"
"$ROOT_DIR/scripts/build-bridge"
echo ""
echo "Done. You can now run: bun run dev:desktop"
