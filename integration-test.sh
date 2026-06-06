#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Dillweed Namespace — Integration Test Suite
#
#  Exercises the full trust chain lifecycle across all three components:
#  Registry (9475) → Resolver (9474) → signature verification → revocation
#
#  Prerequisites:
#    - All three services running on localhost (9474, 9475, 9476)
#    - Registry admin token available (env var or Keychain)
#    - DNSO key pair configured on the Registry
#
#  Usage:
#    bash integration-test.sh
#
#  Exit codes:
#    0 — all tests passed
#    1 — one or more tests failed
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

REGISTRY_PORT="${REGISTRY_PORT:-9475}"
RESOLVER_PORT="${RESOLVER_PORT:-9474}"
ANTHILL_PORT="${ANTHILL_PORT:-9476}"

REGISTRY="http://localhost:$REGISTRY_PORT"
RESOLVER="http://localhost:$RESOLVER_PORT"
ANTHILL="http://localhost:$ANTHILL_PORT"

# Admin token: env var wins, then Keychain, then fail
TOKEN="${REGISTRY_ADMIN_TOKEN:-$(security find-generic-password -a registry-admin -s dillweed-registry -w 2>/dev/null || true)}"
if [ -z "$TOKEN" ]; then
  echo "ERROR: No Registry admin token found."
  echo "  Set REGISTRY_ADMIN_TOKEN or add to macOS Keychain."
  exit 1
fi

AUTH_HEADER="Authorization: Bearer $TOKEN"

# Test record — unique per run to avoid collisions
RUN_ID="inttest-$(date +%s)"
CAP_NAME="integration.test.${RUN_ID}"
CAP_URI="dillweed://${CAP_NAME}"

# Counters
PASSED=0
FAILED=0
TOTAL=0

# ── Test helpers ──────────────────────────────────────────────────────────────

pass() {
  PASSED=$((PASSED + 1))
  TOTAL=$((TOTAL + 1))
  echo "  ✓  $1"
}

fail() {
  FAILED=$((FAILED + 1))
  TOTAL=$((TOTAL + 1))
  echo "  ✗  $1"
  if [ -n "${2:-}" ]; then
    echo "      Detail: $2"
  fi
}

header() {
  echo ""
  echo "▶ $1"
}

# ── Cleanup function ──────────────────────────────────────────────────────────

cleanup() {
  # Attempt to revoke the test capability if it still exists
  curl -s -X POST "$REGISTRY/revoke" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$CAP_NAME\",\"version\":\"1.0.0\",\"reason\":\"Integration test cleanup\"}" \
    > /dev/null 2>&1 || true
}

# Always clean up, even on failure
trap cleanup EXIT

# ── Pre-flight: verify all services are healthy ───────────────────────────────

header "Pre-flight: service health checks"

REGISTRY_HEALTH=$(curl -s --max-time 5 "$REGISTRY/health" 2>/dev/null || echo "UNREACHABLE")
if echo "$REGISTRY_HEALTH" | grep -q '"status".*"ok"'; then
  pass "Registry healthy (port $REGISTRY_PORT)"
else
  fail "Registry not healthy (port $REGISTRY_PORT)" "$REGISTRY_HEALTH"
  echo "Cannot proceed without a healthy Registry. Exiting."
  exit 1
fi

RESOLVER_HEALTH=$(curl -s --max-time 5 "$RESOLVER/health" 2>/dev/null || echo "UNREACHABLE")
if echo "$RESOLVER_HEALTH" | grep -q '"status".*"ok"'; then
  pass "Resolver healthy (port $RESOLVER_PORT)"
else
  fail "Resolver not healthy (port $RESOLVER_PORT)" "$RESOLVER_HEALTH"
  echo "Cannot proceed without a healthy Resolver. Exiting."
  exit 1
fi

ANTHILL_HEALTH=$(curl -s --max-time 5 "$ANTHILL/health" 2>/dev/null || echo "UNREACHABLE")
if echo "$ANTHILL_HEALTH" | grep -q '"status".*"ok"'; then
  pass "Anthill healthy (port $ANTHILL_PORT)"
else
  fail "Anthill not healthy (port $ANTHILL_PORT)" "$ANTHILL_HEALTH"
  echo "Cannot proceed without a healthy Anthill. Exiting."
  exit 1
fi

# ── Step 1: Register a test capability ────────────────────────────────────────

header "Step 1: Register test capability"

REGISTER_BODY=$(cat <<ENDJSON
{
  "name": "$CAP_NAME",
  "description": "Integration test capability — created by integration-test.sh run $RUN_ID",
  "version": "1.0.0",
  "endpoint": "http://localhost/integration-test/$RUN_ID",
  "protocol": "rest",
  "permissions": ["query"],
  "schemas": {},
  "trust_tier": "experimental"
}
ENDJSON
)

REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$REGISTRY/register" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_BODY")

REGISTER_HTTP=$(echo "$REGISTER_RESPONSE" | tail -1)
REGISTER_JSON=$(echo "$REGISTER_RESPONSE" | sed '$d')

if [ "$REGISTER_HTTP" = "201" ]; then
  pass "Capability registered ($CAP_NAME) → HTTP 201"
else
  fail "Registration failed → HTTP $REGISTER_HTTP" "$REGISTER_JSON"
  echo "Cannot proceed without a registered capability. Exiting."
  exit 1
fi

# Verify the record has a signature
if echo "$REGISTER_JSON" | grep -q '"signature"'; then
  pass "Registered record includes DNSO signature"
else
  fail "Registered record missing signature" "$REGISTER_JSON"
fi

# ── Step 2: Verify signature via Registry /verify endpoint ────────────────────

header "Step 2: Verify signature at Registry"

VERIFY_RESPONSE=$(curl -s "$REGISTRY/verify/$CAP_NAME")

if echo "$VERIFY_RESPONSE" | grep -q '"signature_valid".*true'; then
  pass "Signature valid at Registry (/verify → signature_valid: true)"
else
  fail "Signature verification failed at Registry" "$VERIFY_RESPONSE"
fi

if echo "$VERIFY_RESPONSE" | grep -q '"algorithm".*"Ed25519"'; then
  pass "Signature algorithm is Ed25519"
else
  fail "Unexpected signature algorithm" "$VERIFY_RESPONSE"
fi

# ── Step 3: Resolve through DillClaw ──────────────────────────────────────────

header "Step 3: Resolve through DillClaw Resolver"

# Allow a brief pause for the Resolver to pick up the new record
# on its next registry fetch cycle
sleep 3

RESOLVE_RESPONSE=$(curl -s -X POST "$RESOLVER/resolve" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$CAP_URI\"}")

if echo "$RESOLVE_RESPONSE" | grep -q '"status".*"resolved"'; then
  pass "Capability resolved through DillClaw (status: resolved)"
else
  # The record may not have been fetched yet — retry after a longer wait
  echo "      (Record not yet cached — waiting 10s for registry refresh...)"
  sleep 10
  RESOLVE_RESPONSE=$(curl -s -X POST "$RESOLVER/resolve" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"$CAP_URI\"}")
  if echo "$RESOLVE_RESPONSE" | grep -q '"status".*"resolved"'; then
    pass "Capability resolved through DillClaw after retry (status: resolved)"
  else
    fail "Capability not resolved through DillClaw" "$RESOLVE_RESPONSE"
  fi
fi

# Check trust signals
if echo "$RESOLVE_RESPONSE" | grep -q '"sig_valid"'; then
  pass "Resolution includes sig_valid trust signal"
else
  fail "Resolution missing sig_valid trust signal" "$RESOLVE_RESPONSE"
fi

if echo "$RESOLVE_RESPONSE" | grep -q '"sig_verified"'; then
  pass "Resolution includes sig_verified trust signal"
else
  fail "Resolution missing sig_verified trust signal" "$RESOLVE_RESPONSE"
fi

# Note: dnso_verified is only present for verified/trusted tier records.
# Experimental-tier records get sig_valid + sig_verified but not dnso_verified.
if echo "$RESOLVE_RESPONSE" | grep -q '"experimental"'; then
  pass "Resolution includes experimental trust tier signal (expected for test record)"
else
  fail "Resolution missing expected trust tier signal"
fi

# Extract and display trust score
TRUST_SCORE=$(echo "$RESOLVE_RESPONSE" | grep -o '"trust_score"[[:space:]]*:[[:space:]]*[0-9.]*' | head -1 | sed 's/.*:[[:space:]]*//')
if [ -n "$TRUST_SCORE" ]; then
  pass "Trust score present: $TRUST_SCORE"
else
  fail "Trust score missing from resolution response"
fi

# ── Step 4: Verify capability name and endpoint match ─────────────────────────

header "Step 4: Verify resolved record matches registration"

if echo "$RESOLVE_RESPONSE" | grep -q "\"name\"[[:space:]]*:[[:space:]]*\"$CAP_NAME\""; then
  pass "Resolved name matches registered name"
else
  fail "Resolved name does not match registered name"
fi

if echo "$RESOLVE_RESPONSE" | grep -q "integration-test/$RUN_ID"; then
  pass "Resolved endpoint matches registered endpoint"
else
  fail "Resolved endpoint does not match registered endpoint"
fi

# ── Step 5: Revoke the capability ─────────────────────────────────────────────

header "Step 5: Revoke test capability"

REVOKE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$REGISTRY/revoke" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$CAP_NAME\",\"version\":\"1.0.0\",\"reason\":\"Integration test revocation\"}")

REVOKE_HTTP=$(echo "$REVOKE_RESPONSE" | tail -1)

if [ "$REVOKE_HTTP" = "200" ]; then
  pass "Capability revoked at Registry → HTTP 200"
else
  fail "Revocation failed → HTTP $REVOKE_HTTP" "$(echo "$REVOKE_RESPONSE" | sed '$d')"
fi

# Confirm revocation via Registry /lookup — expect 404 (record removed)
LOOKUP_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$REGISTRY/lookup/$CAP_NAME")
if [ "$LOOKUP_HTTP" = "404" ]; then
  pass "Registry /lookup returns 404 after revocation (record removed)"
else
  fail "Registry /lookup returned HTTP $LOOKUP_HTTP (expected 404)" ""
fi

# ── Step 6: Verify revocation propagates to Resolver ──────────────────────────

header "Step 6: Verify revocation propagation to Resolver"

echo "      Waiting for cache TTL expiry (documented in DillClaw spec §7.5)..."
echo "      (Default fetch interval: 60s — waiting 70s to ensure refresh)"
sleep 70

RESOLVE_AFTER_REVOKE=$(curl -s -X POST "$RESOLVER/resolve" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$CAP_URI\"}")

if echo "$RESOLVE_AFTER_REVOKE" | grep -q '"status".*"resolved"'; then
  # Still resolving after revocation + TTL — this is a failure
  fail "Revoked capability still resolves after TTL expiry" "$RESOLVE_AFTER_REVOKE"
else
  pass "Revoked capability no longer resolves through DillClaw"
fi

# Check that the Resolver returns an appropriate non-resolved status
if echo "$RESOLVE_AFTER_REVOKE" | grep -q '"NO_MATCH"\|"no_match"\|"not_found"\|"error"\|"results"[[:space:]]*:[[:space:]]*\[\]'; then
  pass "Resolver returns appropriate response for revoked capability"
else
  fail "Unexpected Resolver response for revoked capability" "$RESOLVE_AFTER_REVOKE"
fi

# ── Step 7: Verify re-registration works after revocation ─────────────────────

header "Step 7: Verify re-registration after revocation"

REREGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$REGISTRY/register" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_BODY")

REREGISTER_HTTP=$(echo "$REREGISTER_RESPONSE" | tail -1)

if [ "$REREGISTER_HTTP" = "201" ]; then
  pass "Capability re-registered after revocation → HTTP 201"
  # Clean up: revoke again so the test record doesn't persist
  curl -s -X POST "$REGISTRY/revoke" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$CAP_NAME\",\"version\":\"1.0.0\",\"reason\":\"Integration test final cleanup\"}" \
    > /dev/null 2>&1 || true
elif [ "$REREGISTER_HTTP" = "409" ]; then
  pass "Registry returns 409 (name still reserved after revocation — acceptable)"
else
  fail "Re-registration returned unexpected HTTP $REREGISTER_HTTP" "$(echo "$REREGISTER_RESPONSE" | sed '$d')"
fi

# ── Results ───────────────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────────────"
echo "  Results:  $PASSED passed  /  $FAILED failed  (of $TOTAL)"
echo "─────────────────────────────────────────"
echo ""
echo "  Run ID:     $RUN_ID"
echo "  Test record: $CAP_NAME"
echo ""

if [ "$FAILED" -gt 0 ]; then
  exit 1
else
  exit 0
fi
