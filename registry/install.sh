#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Dillweed Registry — Installer
#  https://dillweed.com/registry-spec.html
#
#  Usage:
#    bash install.sh            — install or upgrade
#    bash install.sh --uninstall — stop and remove the service
#
#  Requirements: macOS, Node.js 14+, Homebrew (checked at install time)
# ─────────────────────────────────────────────────────────────────────────────

set -e

COMPONENT="registry"
DISPLAY="Dillweed Registry"
VERSION="0.2.8"
PORT=9475
INSTALL_DIR="/usr/local/dillweed/registry/dillweed-registry"
PLIST_LABEL="com.dillweed.registry"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
KEYCHAIN_SERVICE="dillweed-registry"
KEYCHAIN_ACCOUNT="registry-admin"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# v0.2.8 patch — INST-001: refuse to run install.sh from inside the install
# destination directory. cp would fail with "source and destination are
# identical" on most macOS/BSD systems, leaving the install in a partial state.
# Fail fast with explicit recovery instructions instead.
if [ "$SRC_DIR" = "$INSTALL_DIR" ]; then
  echo ""
  echo "  ✗  install.sh is being run from inside the install destination."
  echo "     $SRC_DIR"
  echo ""
  echo "  This causes 'cp: source and destination are identical' errors and"
  echo "  leaves the install in a partial state."
  echo ""
  echo "  Extract the tarball to a different location and run install.sh from"
  echo "  there. Recommended:"
  echo "    cd ~/Tar-Balls"
  echo "    tar -xzf dillweed-registry-v$VERSION.tar.gz"
  echo "    cd dillweed-registry"
  echo "    bash install.sh"
  echo ""
  exit 1
fi

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RESET='\033[0m'

ok()     { echo -e "  ${GREEN}✓${RESET}  $1"; }
fail()   { echo -e "  ${RED}✗${RESET}  $1"; }
info()   { echo -e "  ${CYAN}→${RESET}  $1"; }
warn()   { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
header() { echo ""; echo -e "${CYAN}── $1 ──────────────────────────────────────────${RESET}"; }

# ── Uninstall ─────────────────────────────────────────────────────────────────
if [ "${1}" = "--uninstall" ]; then
  echo ""
  echo "  Uninstalling $DISPLAY v$VERSION..."
  echo ""

  # Stop and unload launchd service
  if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    ok "Removed launchd plist"
  else
    warn "No launchd plist found at $PLIST_PATH"
  fi

  # Remove Keychain entry
  security delete-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$KEYCHAIN_SERVICE" 2>/dev/null && \
    ok "Removed Keychain token" || warn "No Keychain token found"

  echo ""
  warn "Installation directory $INSTALL_DIR was NOT removed."
  warn "Keys and database are preserved. Remove manually if desired:"
  warn "  sudo rm -rf /usr/local/dillweed/registry"
  echo ""
  exit 0
fi

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  $DISPLAY  v$VERSION                     │"
echo "  │  dillweed.com/registry-spec.html            │"
echo "  │  Installer                                  │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# ── Step 1: Prerequisites Check ───────────────────────────────────────────────
header "Step 1: Prerequisites Check"

PREREQ_FAILED=0

# Platform: macOS only
if [ "$(uname)" = "Darwin" ]; then
  ok "macOS detected: $(sw_vers -productVersion)"
else
  fail "This installer requires macOS."
  echo ""
  echo "  For Linux deployment, run manually:"
  echo "    npm install && node setup.js && node server.js"
  echo ""
  exit 1
fi

# Baseline utilities (these should always be present on macOS, but verify)
for util in curl sudo launchctl; do
  if command -v "$util" &>/dev/null; then
    ok "$util available"
  else
    fail "$util not found — this should never happen on macOS"
    PREREQ_FAILED=1
  fi
done

# macOS Keychain access (used for admin token storage)
if command -v security &>/dev/null; then
  ok "security (Keychain) available"
else
  fail "security command not found — this should never happen on macOS"
  PREREQ_FAILED=1
fi

# openssl (used for admin token generation)
if command -v openssl &>/dev/null; then
  ok "openssl available"
else
  fail "openssl not found"
  PREREQ_FAILED=1
fi

# Homebrew (recommended; required to install Node.js if not already present)
HAS_BREW=0
if command -v brew &>/dev/null; then
  ok "Homebrew available: $(brew --version | head -1)"
  HAS_BREW=1
else
  warn "Homebrew not found"
fi

# Node.js (required runtime; install via Homebrew if available)
HAS_NODE=0
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 14 ]; then
    fail "Node.js 14+ required. Found: $(node --version)"
    info "Upgrade with: brew upgrade node@22 && brew link node@22 --force --overwrite"
    PREREQ_FAILED=1
  else
    ok "Node.js $(node --version)"
    HAS_NODE=1
  fi
else
  warn "Node.js not found"
fi

# If Node.js is missing and Homebrew is present, offer to install it
if [ "$HAS_NODE" -eq 0 ]; then
  if [ "$HAS_BREW" -eq 1 ]; then
    info "Installing Node.js via Homebrew..."
    brew install node@22
    brew link node@22 --force --overwrite
    if command -v node &>/dev/null; then
      ok "Node.js $(node --version)"
      HAS_NODE=1
    else
      fail "Node.js install via Homebrew did not succeed"
      PREREQ_FAILED=1
    fi
  else
    PREREQ_FAILED=1
  fi
fi

# npm (should come with Node.js, but verify)
if [ "$HAS_NODE" -eq 1 ]; then
  if command -v npm &>/dev/null; then
    ok "npm $(npm --version)"
  else
    fail "npm not found despite Node.js being present"
    PREREQ_FAILED=1
  fi
fi

# If anything critical is missing, exit with clear remediation guidance
if [ "$PREREQ_FAILED" -ne 0 ]; then
  echo ""
  echo "  ┌─────────────────────────────────────────────────────────┐"
  echo "  │  Prerequisites are incomplete.                          │"
  echo "  └─────────────────────────────────────────────────────────┘"
  echo ""
  if [ "$HAS_BREW" -eq 0 ]; then
    echo "  Homebrew is required to install Node.js using this installer."
    echo "  To install Homebrew, run this command in a Terminal window:"
    echo ""
    echo '    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    echo ""
    echo "  After Homebrew completes installing (it may prompt for your"
    echo "  password and ask to install Xcode Command Line Tools), re-run"
    echo "  this installer."
    echo ""
    echo "  If you would prefer not to use Homebrew, install Node.js 14 or"
    echo "  higher from https://nodejs.org and then re-run this installer."
  else
    echo "  Install the missing prerequisites listed above and re-run this"
    echo "  installer."
  fi
  echo ""
  exit 1
fi

# ── Step 2: Create install directory ─────────────────────────────────────────
header "Step 2: Install Directory"

if [ ! -d "/usr/local/dillweed" ]; then
  sudo mkdir -p /usr/local/dillweed
  sudo chown "$(whoami):wheel" /usr/local/dillweed
  ok "Created /usr/local/dillweed"
fi

if [ ! -d "/usr/local/dillweed/registry" ]; then
  sudo mkdir -p /usr/local/dillweed/registry
  sudo chown "$(whoami):wheel" /usr/local/dillweed/registry
  ok "Created /usr/local/dillweed/registry"
fi

# ── Step 3: Stop existing service if running ──────────────────────────────────
header "Step 3: Service State"

WAS_RUNNING=0
if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null && WAS_RUNNING=1 || true
  warn "Stopped existing $DISPLAY service for upgrade"
else
  ok "No existing service — fresh install"
fi

# ── Step 4: Copy files ────────────────────────────────────────────────────────
header "Step 4: Install Files"

# Preserve keys and database if upgrading
KEYS_BACKUP=""
DB_BACKUP=""
if [ -d "$INSTALL_DIR/keys" ]; then
  KEYS_BACKUP=$(mktemp -d)
  cp -r "$INSTALL_DIR/keys" "$KEYS_BACKUP/"
  info "Preserved existing DNSO keypair"
fi
if [ -f "$INSTALL_DIR/data/registry.db" ]; then
  DB_BACKUP=$(mktemp -d)
  cp "$INSTALL_DIR/data/registry.db" "$DB_BACKUP/"
  info "Preserved existing database"
fi

# Copy source files (excluding sensitive/generated files)
mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/keys"
for f in server.js setup.js start.sh test.sh install.sh package.json \
          resolver-patch.js rotate-key.js LICENSE NOTICE README.md .env.example; do
  if [ -f "$SRC_DIR/$f" ]; then
    cp "$SRC_DIR/$f" "$INSTALL_DIR/$f"
  fi
done
ok "Installed source files to $INSTALL_DIR"

# Restore preserved files
if [ -n "$KEYS_BACKUP" ] && [ -d "$KEYS_BACKUP/keys" ]; then
  cp -r "$KEYS_BACKUP/keys/." "$INSTALL_DIR/keys/"
  ok "Restored DNSO keypair"
  rm -rf "$KEYS_BACKUP"
fi
if [ -n "$DB_BACKUP" ] && [ -f "$DB_BACKUP/registry.db" ]; then
  cp "$DB_BACKUP/registry.db" "$INSTALL_DIR/data/registry.db"
  ok "Restored database"
  rm -rf "$DB_BACKUP"
fi

# ── Step 5: npm install ───────────────────────────────────────────────────────
header "Step 5: Dependencies"

cd "$INSTALL_DIR"
npm install --silent
ok "Dependencies installed"

# ── Step 6: Setup (database + keys) ──────────────────────────────────────────
header "Step 6: Database and Keys"

node setup.js
# setup.js prints its own output

# ── Step 7: Admin token ───────────────────────────────────────────────────────
header "Step 7: Admin Token"

EXISTING_TOKEN=$(security find-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)
if [ -n "$EXISTING_TOKEN" ]; then
  ok "Existing admin token found in Keychain — preserved"
else
  NEW_TOKEN=$(openssl rand -hex 32)
  security add-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$KEYCHAIN_SERVICE" -w "$NEW_TOKEN"
  ok "Generated and stored new admin token in Keychain"
  echo ""
  warn "Save this token securely (e.g. LastPass):"
  echo "  $NEW_TOKEN"
  echo ""
  warn "Retrieve anytime: security find-generic-password -a $KEYCHAIN_ACCOUNT -s $KEYCHAIN_SERVICE -w"
fi

# ── Step 8: launchd plist ─────────────────────────────────────────────────────
header "Step 8: launchd Auto-Start"

NODE_PATH=$(which node)
TOKEN=$(security find-generic-password -a "$KEYCHAIN_ACCOUNT" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${INSTALL_DIR}/server.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>REGISTRY_PORT</key>
    <string>${PORT}</string>
    <key>REGISTRY_ADMIN_TOKEN</key>
    <string>${TOKEN}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/usr/local/dillweed/logs/registry.log</string>

  <key>StandardErrorPath</key>
  <string>/usr/local/dillweed/logs/registry-error.log</string>
</dict>
</plist>
PLIST

ok "Written launchd plist: $PLIST_PATH"

# Secure the plist — the file contains REGISTRY_ADMIN_TOKEN in its environment
# block, so restrict read access to the owner only.
chmod 600 "$PLIST_PATH"
ok "Secured launchd plist permissions (mode 600)"

# Ensure logs directory exists
mkdir -p /usr/local/dillweed/logs

# Load the service
launchctl load "$PLIST_PATH"
ok "Service loaded with launchctl"

# ── Step 9: Verify ───────────────────────────────────────────────────────────
header "Step 9: Verification"

sleep 2
if curl -s "http://localhost:${PORT}/health" | grep -q '"ok"'; then
  ok "$DISPLAY is running on port $PORT"
else
  fail "$DISPLAY did not start. Check logs:"
  fail "  /usr/local/dillweed/logs/registry-error.log"
  exit 1
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  $DISPLAY  v$VERSION — Installed       │"
echo "  │                                             │"
echo "  │  Port:    $PORT                             │"
echo "  │  Auth:    token (Keychain)                  │"
echo "  │  Start:   automatic (launchd)               │"
echo "  │  Logs:    /usr/local/dillweed/logs/         │"
echo "  │                                             │"
echo "  │  Spec: dillweed.com/registry-spec.html      │"
echo "  └─────────────────────────────────────────────┘"
echo ""
