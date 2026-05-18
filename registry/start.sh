#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Dillweed Registry — Launcher
#  https://dillweed.com/registry-spec.html
# ─────────────────────────────────────────────────────────────────────────────

set -e

PORT="${REGISTRY_PORT:-9475}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Check Node.js ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo ""
  echo "  ERROR: Node.js is not installed."
  echo "  Install:  brew install node"
  echo ""
  exit 1
fi

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 14 ]; then
  echo ""
  echo "  ERROR: Node.js 14+ required. Found: $(node --version)"
  echo "  Upgrade: brew upgrade node"
  echo ""
  exit 1
fi

# ── Check better-sqlite3 ──────────────────────────────────────────────────────
if [ ! -d "$DIR/node_modules/better-sqlite3" ]; then
  echo ""
  echo "  better-sqlite3 not installed. Running npm install..."
  echo ""
  cd "$DIR" && npm install
  echo ""
fi

# ── Check setup has been run ──────────────────────────────────────────────────
if [ ! -f "$DIR/data/registry.db" ]; then
  echo ""
  echo "  Database not found. Running setup first..."
  echo ""
  node "$DIR/setup.js"
  echo ""
fi

if [ ! -f "$DIR/keys/dnso_private.pem" ]; then
  echo ""
  echo "  ERROR: DNSO keypair not found. Run:  node setup.js"
  echo ""
  exit 1
fi

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo "  Starting Dillweed Registry on port $PORT..."
echo "  Spec: https://dillweed.com/registry-spec.html"
echo ""

REGISTRY_PORT="$PORT" node "$DIR/server.js"
