#!/usr/bin/env bash
# HardBrake — Linux & macOS Setup Script
# Run: bash scripts/setup.sh
#
# Installs all prerequisites, builds the sidecar, and builds the Tauri app.

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() {
  echo ""
  echo -e "${CYAN}────────────────────────────────────────${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}────────────────────────────────────────${NC}"
}

ok()   { echo -e "  ${GREEN}$1${NC}"; }
warn() { echo -e "  ${YELLOW}$1${NC}"; }
fail() { echo -e "  ${RED}$1${NC}"; exit 1; }

has() { command -v "$1" &>/dev/null; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OS="$(uname -s)"

# ─── 1. Detect OS & package manager ──────────────────────────────
step "Detecting platform..."
if [[ "$OS" == "Darwin" ]]; then
  PLATFORM="macOS"
  if ! has brew; then
    warn "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for Apple Silicon
    if [[ -f /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
  fi
  PM="brew"
  PM_INSTALL="brew install"
elif [[ "$OS" == "Linux" ]]; then
  PLATFORM="Linux"
  if has apt-get; then
    PM="apt"
    PM_INSTALL="sudo apt-get install -y"
  elif has dnf; then
    PM="dnf"
    PM_INSTALL="sudo dnf install -y"
  elif has pacman; then
    PM="pacman"
    PM_INSTALL="sudo pacman -S --noconfirm"
  else
    fail "No supported package manager found (apt, dnf, pacman)."
  fi
else
  fail "Unsupported OS: $OS. Use setup.ps1 for Windows."
fi
ok "$PLATFORM detected (package manager: $PM)"

# ─── 2. Install system dependencies for Tauri (Linux only) ───────
if [[ "$PLATFORM" == "Linux" ]]; then
  step "Installing Linux system dependencies for Tauri..."
  case "$PM" in
    apt)
      sudo apt-get update
      sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        build-essential \
        curl \
        wget \
        file \
        libxdo-dev \
        libssl-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        pkg-config
      ;;
    dnf)
      sudo dnf install -y \
        webkit2gtk4.1-devel \
        openssl-devel \
        curl \
        wget \
        file \
        libxdo-devel \
        libappindicator-gtk3-devel \
        librsvg2-devel \
        gcc \
        pkg-config
      ;;
    pacman)
      sudo pacman -S --noconfirm \
        webkit2gtk-4.1 \
        base-devel \
        curl \
        wget \
        file \
        openssl \
        libxdo \
        libappindicator-gtk3 \
        librsvg \
        pkg-config
      ;;
  esac
  ok "System dependencies installed."
fi

# ─── 3. Install Rust ─────────────────────────────────────────────
step "Checking for Rust..."
if ! has rustc; then
  warn "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  ok "Rust installed."
else
  ok "$(rustc --version)"
fi

# ─── 4. Install Bun ──────────────────────────────────────────────
step "Checking for Bun..."
if ! has bun; then
  warn "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  # Source bun into current shell
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ok "Bun installed."
else
  ok "Bun $(bun --version)"
fi

# ─── 5. Install Node.js ──────────────────────────────────────────
step "Checking for Node.js..."
if ! has node; then
  warn "Installing Node.js..."
  if [[ "$PLATFORM" == "macOS" ]]; then
    brew install node
  else
    case "$PM" in
      apt)
        # Use NodeSource for latest LTS
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
        ;;
      dnf)  sudo dnf install -y nodejs ;;
      pacman) sudo pacman -S --noconfirm nodejs npm ;;
    esac
  fi
  ok "Node.js installed."
else
  ok "Node $(node --version)"
fi

# ─── 6. Install Tauri CLI ────────────────────────────────────────
step "Checking for Tauri CLI..."
if ! npm list -g @tauri-apps/cli &>/dev/null; then
  warn "Installing @tauri-apps/cli..."
  npm install -g @tauri-apps/cli
  ok "Tauri CLI installed."
else
  ok "Tauri CLI found."
fi

# ─── 7. Install project dependencies ─────────────────────────────
step "Installing dependencies..."
cd "$ROOT_DIR"
bun install
ok "Dependencies installed."

# ─── 8. Build sidecar ────────────────────────────────────────────
step "Building sidecar binary..."
cd "$ROOT_DIR"
./scripts/build-bridge
ok "Sidecar built."

# ─── 9. Build Tauri app ──────────────────────────────────────────
step "Building HardBrake desktop app..."
cd "$ROOT_DIR"
npm run tauri build

step "Done!"
echo ""
if [[ "$PLATFORM" == "macOS" ]]; then
  echo -e "  ${GREEN}Build output:${NC}"
  echo -e "  ${YELLOW}$ROOT_DIR/src-tauri/target/release/bundle/macos/HardBrake.app${NC}"
  echo -e "  ${YELLOW}$ROOT_DIR/src-tauri/target/release/bundle/dmg/HardBrake_*.dmg${NC}"
else
  echo -e "  ${GREEN}Build output:${NC}"
  echo -e "  ${YELLOW}$ROOT_DIR/src-tauri/target/release/bundle/deb/${NC}"
  echo -e "  ${YELLOW}$ROOT_DIR/src-tauri/target/release/bundle/appimage/${NC}"
fi
echo ""
