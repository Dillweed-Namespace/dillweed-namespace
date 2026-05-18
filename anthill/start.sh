#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Dillweed Anthill™ — Launcher
#  https://dillweed.com/anthill-spec.html
# ─────────────────────────────────────────────────────────────────────────────

set -e

PORT="${ANTHILL_PORT:-9476}"
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
if [ ! -f "$DIR/data/anthill.db" ]; then
  echo ""
  echo "  Database not found. Running setup first..."
  echo ""
  node "$DIR/setup.js"
  echo ""
fi

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo "  Starting Dillweed Anthill™ on port $PORT..."
echo "  Spec: https://dillweed.com/anthill-spec.html"
echo ""

# ── Load admin token from macOS Keychain if available ────────────────────────
TOKEN=$(security find-generic-password -a anthill-admin -s dillweed-anthill -w 2>/dev/null || true)
if [ -n "$TOKEN" ]; then
  echo "  Auth: token loaded from Keychain"
  ANTHILL_ADMIN_TOKEN="$TOKEN" ANTHILL_PORT="$PORT" node "$DIR/server.js"
else
  echo "  Auth: no token found in Keychain — signal submission is open"
  echo "  To secure: security add-generic-password -a anthill-admin -s dillweed-anthill -w <token>"
  echo ""
  ANTHILL_PORT="$PORT" node "$DIR/server.js"
fi
