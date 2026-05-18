#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  DillClaw Resolver — Installer
#  https://dillweed.com/dillclaw-spec.html
#
#  Usage:
#    bash install.sh            — install or upgrade
#    bash install.sh --uninstall — stop and remove the service
#
#  Requirements: macOS, Node.js 14+
# ─────────────────────────────────────────────────────────────────────────────

set -e

COMPONENT="resolver"
DISPLAY="DillClaw Resolver"
VERSION="0.1.8"
PORT=9474
INSTALL_DIR="/usr/local/dillweed/resolver/dillclaw-resolver"
PLIST_LABEL="com.dillweed.resolver"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

  if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    ok "Removed launchd plist"
  else
    warn "No launchd plist found at $PLIST_PATH"
  fi

  echo ""
  warn "Installation directory $INSTALL_DIR was NOT removed."
  warn "Remove manually if desired: sudo rm -rf /usr/local/dillweed/resolver"
  echo ""
  exit 0
fi

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  $DISPLAY  v$VERSION                      │"
echo "  │  dillweed.com/dillclaw-spec.html            │"
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

if [ ! -d "/usr/local/dillweed/resolver" ]; then
  sudo mkdir -p /usr/local/dillweed/resolver
  sudo chown "$(whoami):wheel" /usr/local/dillweed/resolver
  ok "Created /usr/local/dillweed/resolver"
fi

# ── Step 3: Stop existing service ─────────────────────────────────────────────
header "Step 3: Service State"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  warn "Stopped existing $DISPLAY service for upgrade"
else
  ok "No existing service — fresh install"
fi

# ── Step 4: Copy files ────────────────────────────────────────────────────────
header "Step 4: Install Files"

mkdir -p "$INSTALL_DIR/traces"

for f in server.js start.sh test.sh install.sh unit-tests.js package.json \
          registry.json LICENSE NOTICE README.md .env.example; do
  if [ -f "$SRC_DIR/$f" ]; then
    cp "$SRC_DIR/$f" "$INSTALL_DIR/$f"
  fi
done

# Preserve traces directory contents if upgrading
ok "Installed source files to $INSTALL_DIR"

# ── Step 5: DNSO Public Key ───────────────────────────────────────────────────
#
# v0.1.8 patch — addresses INST-004 (Resolver tarball previously shipped a
# wrong dnso_public.pem build artifact, and install.sh did not copy it).
# Trust root is now fetched from the canonical URL at install time. The URL
# is configurable via DNSO_PUBLIC_KEY_URL env var for non-canonical
# deployments (testing, private mirrors).
#
# On fetch failure, the script aborts (set -e) leaving the install in a
# partial state. To recover: fix network connectivity or set
# DNSO_PUBLIC_KEY_URL to an alternate source, then re-run install.sh.
# The re-run is safe — earlier steps are idempotent.
#
header "Step 5: DNSO Public Key"

DNSO_PUBLIC_KEY_URL="${DNSO_PUBLIC_KEY_URL:-https://dillweed.com/dnso_public.pem}"
DNSO_PUBLIC_KEY_PATH="$INSTALL_DIR/dnso_public.pem"

echo "  →  Fetching DNSO public key from: $DNSO_PUBLIC_KEY_URL"

if ! curl -fsSL --max-time 30 "$DNSO_PUBLIC_KEY_URL" -o "$DNSO_PUBLIC_KEY_PATH"; then
  fail "Failed to fetch DNSO public key from $DNSO_PUBLIC_KEY_URL"
  echo ""
  echo "  The Resolver requires the canonical DNSO public key to verify"
  echo "  capability signatures. Without it, the service will run in"
  echo "  unverified mode and refuse to validate signed records."
  echo ""
  echo "  To recover:"
  echo "    1. Verify network connectivity: curl -I $DNSO_PUBLIC_KEY_URL"
  echo "    2. Or set DNSO_PUBLIC_KEY_URL to an alternate source and re-run."
  echo "    3. Or manually place the key file at:"
  echo "         $DNSO_PUBLIC_KEY_PATH"
  echo "       then re-run install.sh."
  echo ""
  exit 1
fi

if [ ! -s "$DNSO_PUBLIC_KEY_PATH" ]; then
  fail "Fetched DNSO public key is empty"
  rm -f "$DNSO_PUBLIC_KEY_PATH"
  exit 1
fi

if ! head -1 "$DNSO_PUBLIC_KEY_PATH" | grep -q "BEGIN PUBLIC KEY"; then
  fail "Fetched DNSO public key does not look like a PEM-encoded public key"
  echo "  First line: $(head -1 "$DNSO_PUBLIC_KEY_PATH")"
  rm -f "$DNSO_PUBLIC_KEY_PATH"
  exit 1
fi

chmod 644 "$DNSO_PUBLIC_KEY_PATH"

DNSO_KEY_SHA=$(shasum -a 256 "$DNSO_PUBLIC_KEY_PATH" | awk '{print $1}')
ok "DNSO public key fetched and installed"
echo "  →  Path:  $DNSO_PUBLIC_KEY_PATH"
echo "  →  SHA256: $DNSO_KEY_SHA"
echo ""
echo "  Verify against canonical: https://dillweed.com/dnso_public.pem"
echo "  Expected SHA (current production trust root):"
echo "    909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33"
echo ""

# ── Step 6: Dependencies ──────────────────────────────────────────────────────
header "Step 6: Dependencies"

cd "$INSTALL_DIR"
# Resolver currently has no npm dependencies, but run install if package.json
# is present so any future-added dependencies are handled. Fail visibly on
# error rather than silently continuing — a partial install is worse than a
# clear failure.
if [ -f "package.json" ]; then
  npm install --silent
fi
ok "Dependencies installed"

# ── Step 7: launchd plist ─────────────────────────────────────────────────────
header "Step 7: launchd Auto-Start"

NODE_PATH=$(which node)
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p /usr/local/dillweed/logs

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
    <key>DILLCLAW_PORT</key>
    <string>${PORT}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/usr/local/dillweed/logs/resolver.log</string>

  <key>StandardErrorPath</key>
  <string>/usr/local/dillweed/logs/resolver-error.log</string>
</dict>
</plist>
PLIST

ok "Written launchd plist: $PLIST_PATH"

# Secure the plist — the resolver plist does not currently contain secrets,
# but apply the same permission discipline as the Registry and Anthill plists
# for consistent hygiene.
chmod 600 "$PLIST_PATH"
ok "Secured launchd plist permissions (mode 600)"

launchctl load "$PLIST_PATH"
ok "Service loaded with launchctl"

# ── Step 8: Verify ────────────────────────────────────────────────────────────
header "Step 8: Verification"

sleep 2
if curl -s "http://localhost:${PORT}/health" | grep -q '"ok"'; then
  ok "$DISPLAY is running on port $PORT"
else
  fail "$DISPLAY did not start. Check logs:"
  fail "  /usr/local/dillweed/logs/resolver-error.log"
  exit 1
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │  $DISPLAY  v$VERSION — Installed        │"
echo "  │                                             │"
echo "  │  Port:    $PORT                             │"
echo "  │  Start:   automatic (launchd)               │"
echo "  │  Logs:    /usr/local/dillweed/logs/         │"
echo "  │                                             │"
echo "  │  Spec: dillweed.com/dillclaw-spec.html      │"
echo "  └─────────────────────────────────────────────┘"
echo ""
