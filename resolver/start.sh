#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  DillClaw Resolver — Launcher
#  https://dillweed.com/dillclaw-spec.html
# ─────────────────────────────────────────────────────────────────────────────

set -e

PORT="${DILLCLAW_PORT:-9474}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Check Node.js ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo ""
  echo "  ERROR: Node.js is not installed."
  echo ""
  echo "  Install it via Homebrew:"
  echo "    brew install node"
  echo ""
  echo "  Or download from: https://nodejs.org"
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

# ── Ensure traces directory exists ────────────────────────────────────────────
mkdir -p "$DIR/traces"

# ── Launch ────────────────────────────────────────────────────────────────────
echo ""
echo "  Starting DillClaw Resolver on port $PORT..."
echo "  Spec:     https://dillweed.com/dillclaw-spec.html"
echo "  Registry: $DIR/registry.json"
echo ""

DILLCLAW_PORT="$PORT" node "$DIR/server.js"
