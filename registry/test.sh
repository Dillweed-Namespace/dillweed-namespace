#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Dillweed Registry — Test Suite (v0.2.8)
#  Run while the server is running:  bash test.sh
#
#  Covers v0.2 conformance:
#    - §5.2 signing-consistency round-trip (with and without schemas)
#    - §5.6 key-rotation endpoint (/pubkey?previous=true)
#    - §7   all-errors-simultaneously validation
#    - §8.1 immutable revoked row (re-registration inserts a new row)
# ─────────────────────────────────────────────────────────────────────────────

PORT="${REGISTRY_PORT:-9475}"
BASE="http://localhost:$PORT"
TOKEN="${REGISTRY_ADMIN_TOKEN:-}"
# v0.2.8 patch — INST-005: auth-token support adopted from Anthill's
# AS2-003 pattern. When the server runs in token-gated mode (the default
# install posture, with REGISTRY_ADMIN_TOKEN set in the launchd plist),
# every authenticated endpoint test must include the Bearer header.
# Setting the env var:
#   export REGISTRY_ADMIN_TOKEN=$(security find-generic-password \
#     -s "dillweed-registry" -a "registry-admin" -w)
#   bash test.sh
AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

header() { echo ""; echo -e "${CYAN}▶ $1${RESET}"; }
ok()     { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${RESET}  $1"; }
fail()   { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${RESET}  $1"; }

run() {
  local label="$1"; local expected="$2"; shift 2
  local status
  if [ -n "$TOKEN" ]; then
    status=$(curl -s -o /tmp/reg_test_body -w "%{http_code}" \
                  -H "Authorization: Bearer $TOKEN" "$@")
  else
    status=$(curl -s -o /tmp/reg_test_body -w "%{http_code}" "$@")
  fi
  if [ "$status" = "$expected" ]; then
    ok "$label  (HTTP $status)"
  else
    fail "$label  (expected $expected, got $status)"
    echo "    Body: $(cat /tmp/reg_test_body | head -c 300)"
  fi
}

# ── Health ────────────────────────────────────────────────────────────────────
header "GET /health"
run "Health check" "200" "$BASE/health"

# ── Public Key ────────────────────────────────────────────────────────────────
header "GET /pubkey"
run "Public key returns PEM" "200" "$BASE/pubkey"

# ── List ─────────────────────────────────────────────────────────────────────
header "GET /list"
run "List all records" "200" "$BASE/list"
run "List by tier: verified" "200" "$BASE/list?tier=verified"
run "List by tier: experimental" "200" "$BASE/list?tier=experimental"
run "List by tag: search" "200" "$BASE/list?tag=search"
run "List with pagination" "200" "$BASE/list?limit=2&offset=0"

# ── Log (Registry Spec v0.1.4 §04) ─────────────────────────────────────────────
header "GET /log"
run "Log: default (latest 100)" "200" "$BASE/log"
run "Log: pagination" "200" "$BASE/log?limit=10&offset=0"
run "Log: filter by action=register" "200" "$BASE/log?action=register"
run "Log: filter by action=revoke" "200" "$BASE/log?action=revoke"
run "Log: filter by name" "200" "$BASE/log?name=research.market.intel.vendors"
run "Log: filter by name + action" "200" "$BASE/log?name=research.market.intel.vendors&action=register"
run "Log: unknown action rejected" "400" "$BASE/log?action=invalid"
run "Log: invalid limit (too high) rejected" "400" "$BASE/log?limit=10000"
run "Log: negative offset rejected" "400" "$BASE/log?offset=-1"
run "Log: unknown parameters ignored" "200" "$BASE/log?bogus=xyz&limit=5"

# ── Lookup ────────────────────────────────────────────────────────────────────
header "GET /lookup/:path"
run "Lookup: research.market.intel.vendors" "200" \
  "$BASE/lookup/research.market.intel.vendors"

run "Lookup with version pin" "200" \
  "$BASE/lookup/tools.search.web-retrieval?version=3.1.0"

run "Lookup: not found → 404" "404" \
  "$BASE/lookup/does.not.exist"

# ── Verify ────────────────────────────────────────────────────────────────────
header "GET /verify/:path"
run "Verify signature: research.market.intel.vendors" "200" \
  "$BASE/verify/research.market.intel.vendors"

run "Verify: not found → 404" "404" \
  "$BASE/verify/no.such.capability"

# ── Register ──────────────────────────────────────────────────────────────────
header "POST /register"

TEST_NAME="test.capability.register.$(date +%s)"
run "Register new capability" "201" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"name\":        \"$TEST_NAME\",
    \"description\": \"Test capability registered by test.sh\",
    \"endpoint\":    \"https://test.example.com/capability\",
    \"protocol\":    \"rest\",
    \"trust_tier\":  \"experimental\",
    \"permissions\": [\"query\"],
    \"version\":     \"0.1.0\"
  }" "$BASE/register"

run "Duplicate register → 409" "409" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"name\":        \"$TEST_NAME\",
    \"description\": \"Duplicate\",
    \"endpoint\":    \"https://test.example.com/capability\",
    \"protocol\":    \"rest\",
    \"trust_tier\":  \"experimental\",
    \"permissions\": [\"query\"],
    \"version\":     \"0.1.0\"
  }" "$BASE/register"

run "Register: missing name → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d '{"description":"no name","endpoint":"https://example.com","protocol":"rest","trust_tier":"experimental","version":"1.0"}' \
  "$BASE/register"

run "Register: bad trust_tier → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"test.bad.tier","description":"d","endpoint":"https://example.com","protocol":"rest","trust_tier":"super_trusted","version":"1.0"}' \
  "$BASE/register"

run "Register: uppercase name → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"TEST.BadName","description":"d","endpoint":"https://example.com","protocol":"rest","trust_tier":"experimental","version":"1.0"}' \
  "$BASE/register"

run "Register: bad endpoint URL → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"test.bad.endpoint","description":"d","endpoint":"not-a-url","protocol":"rest","trust_tier":"experimental","version":"1.0"}' \
  "$BASE/register"

# ── v0.2.2: validation must report every failure simultaneously (Spec §7) ────
header "POST /register — all-errors-simultaneously (Spec §7)"

ALL_ERR_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d '{"name":"BAD.UPPER","description":"","endpoint":"nope","protocol":"telnet","trust_tier":"supreme","version":"1"}' \
  "$BASE/register")

ALL_ERR_STATUS=$(echo "$ALL_ERR_BODY" | grep -c '"error_code"[[:space:]]*:[[:space:]]*"VALIDATION_FAILED"' || true)
if [ "$ALL_ERR_STATUS" = "1" ]; then
  ok "422 VALIDATION_FAILED returned for multi-error body"
else
  fail "Expected VALIDATION_FAILED for multi-error body"
  echo "    Body: $(echo "$ALL_ERR_BODY" | head -c 400)"
fi

# Count distinct error messages — multiple independent failures must all appear
# in a single response, per Spec v0.1.4 §7.
ALL_ERR_COUNT=$(echo "$ALL_ERR_BODY" | tr ',' '\n' | grep -c -E '(description|endpoint|protocol|trust_tier|name)' || true)
if [ "$ALL_ERR_COUNT" -ge 3 ]; then
  ok "Multiple errors reported in one response (found $ALL_ERR_COUNT markers)"
else
  fail "Expected ≥3 independent error markers; found $ALL_ERR_COUNT"
  echo "    Body: $(echo "$ALL_ERR_BODY" | head -c 400)"
fi

# Verify the test record appeared in list
LOOKUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/lookup/$TEST_NAME")
if [ "$LOOKUP_STATUS" = "200" ]; then
  ok "Registered record is retrievable by lookup"
else
  fail "Registered record not found at /lookup/$TEST_NAME"
fi

# ── Post-review validation tests ─────────────────────────────────────────────
# These cover validation gaps caught by external review of v0.2.7. The
# original test suite had a structural blind spot: it tested happy-path
# registration but did not exercise the validation rules for individual
# fields against malformed input, so several format violations went
# uncaught. The tests below close that gap.

header "POST /register — endpoint scheme validation (AUDIT-REG-007)"
SCHEME_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"test.bad.scheme.$(date +%s)\",\"description\":\"x\",\"endpoint\":\"ftp://nope.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"1.0.0\"}" \
  "$BASE/register")
if echo "$SCHEME_BODY" | grep -q "scheme must be http or https"; then
  ok "Non-http(s) endpoint scheme rejected"
else
  fail "Non-http(s) endpoint scheme was accepted"
  echo "    Body: $(echo "$SCHEME_BODY" | head -c 300)"
fi

JS_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"test.js.scheme.$(date +%s)\",\"description\":\"x\",\"endpoint\":\"javascript:alert(1)\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"1.0.0\"}" \
  "$BASE/register")
if echo "$JS_BODY" | grep -q "scheme must be http or https"; then
  ok "javascript: endpoint rejected"
else
  fail "javascript: endpoint was accepted"
fi

header "POST /register — semver validation (AUDIT-REG-008)"
SEMVER_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"test.bad.semver.$(date +%s)\",\"description\":\"x\",\"endpoint\":\"https://x.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"banana\"}" \
  "$BASE/register")
if echo "$SEMVER_BODY" | grep -q "must be a semver-formatted"; then
  ok "Non-semver version rejected"
else
  fail "Non-semver version was accepted"
  echo "    Body: $(echo "$SEMVER_BODY" | head -c 300)"
fi

# Confirm valid semver forms still accepted
SEMVER_PRE_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"test.semver.beta.$(date +%s)\",\"description\":\"x\",\"endpoint\":\"https://x.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"2.3.1-beta\"}" \
  "$BASE/register")
if echo "$SEMVER_PRE_BODY" | grep -q '"status"[[:space:]]*:[[:space:]]*"registered"'; then
  ok "Semver with pre-release identifier (2.3.1-beta) accepted"
else
  fail "Semver with pre-release identifier rejected unexpectedly"
fi

header "POST /register — registration_date validation (AUDIT-REG-009)"
REGDATE_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"test.bad.regdate.$(date +%s)\",\"description\":\"x\",\"endpoint\":\"https://x.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"1.0.0\",\"registration_date\":\"yesterday\"}" \
  "$BASE/register")
if echo "$REGDATE_BODY" | grep -q "must be RFC 3339 full-date"; then
  ok "Malformed registration_date rejected"
else
  fail "Malformed registration_date was accepted"
  echo "    Body: $(echo "$REGDATE_BODY" | head -c 300)"
fi

# Post-review-3 test (AUDIT-REG-014): caller-supplied last_updated must pass
# calendar/clock-validity check, not just shape. Previously a shape-only regex
# allowed impossible values like 2026-99-99T99:99:99Z to validate. The
# isValidRfc3339UtcSecondPrecision helper rejects these via Date.UTC round-trip.
# Note: /register normally regenerates last_updated server-side, so callers
# can't normally force a stored bad value through /register; this test
# exercises the validation path that runs when callers explicitly supply it.
header "POST /register — last_updated calendar validity (AUDIT-REG-014)"
LU_BAD_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"test.bad.lu.$(date +%s)\",\"description\":\"x\",\"endpoint\":\"https://x.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"1.0.0\",\"last_updated\":\"2026-99-99T99:99:99Z\"}" \
  "$BASE/register")
if echo "$LU_BAD_BODY" | grep -q "calendar-valid components"; then
  ok "Impossible last_updated (2026-99-99T99:99:99Z) rejected"
else
  fail "Impossible last_updated was accepted (calendar check not active)"
  echo "    Body: $(echo "$LU_BAD_BODY" | head -c 300)"
fi

# Confirm valid date-time still accepted
LU_OK_BODY=$(curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"test.good.lu.$(date +%s)\",\"description\":\"x\",\"endpoint\":\"https://x.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"1.0.0\",\"last_updated\":\"2026-05-16T03:30:00Z\"}" \
  "$BASE/register")
if echo "$LU_OK_BODY" | grep -q '"status"[[:space:]]*:[[:space:]]*"registered"'; then
  ok "Valid last_updated (2026-05-16T03:30:00Z) accepted"
else
  fail "Valid last_updated unexpectedly rejected"
fi

# ── v0.2.2: Verify signature round-trip for API-registered record (Spec §5.2) ──
header "GET /verify — API-registered record (Spec §5.2 signing consistency)"

VERIFY_BODY=$(curl -s "$BASE/verify/$TEST_NAME?version=0.1.0")
if echo "$VERIFY_BODY" | grep -q '"signature_valid"[[:space:]]*:[[:space:]]*true'; then
  ok "API-registered record (no schemas) verifies successfully"
else
  fail "API-registered record (no schemas) failed signature verification"
  echo "    Body: $(echo "$VERIFY_BODY" | head -c 300)"
fi

# Register a second record WITH schemas and verify it too
TEST_NAME_SCHEMAS="test.capability.schemas.$(date +%s)"
curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{
    \"name\":        \"$TEST_NAME_SCHEMAS\",
    \"description\": \"Test capability with schemas\",
    \"endpoint\":    \"https://test.example.com/schemas\",
    \"protocol\":    \"rest\",
    \"trust_tier\":  \"experimental\",
    \"permissions\": [\"query\"],
    \"version\":     \"0.1.0\",
    \"input_schema\":  {\"type\":\"object\",\"properties\":{\"q\":{\"type\":\"string\"}}},
    \"output_schema\": {\"type\":\"object\",\"properties\":{\"r\":{\"type\":\"string\"}}}
  }" "$BASE/register" > /dev/null

VERIFY_S_BODY=$(curl -s "$BASE/verify/$TEST_NAME_SCHEMAS?version=0.1.0")
if echo "$VERIFY_S_BODY" | grep -q '"signature_valid"[[:space:]]*:[[:space:]]*true'; then
  ok "API-registered record (WITH schemas) verifies successfully"
else
  fail "API-registered record (WITH schemas) failed signature verification"
  echo "    Body: $(echo "$VERIFY_S_BODY" | head -c 300)"
fi

# ── Promote ───────────────────────────────────────────────────────────────────
header "POST /promote"
run "Promote test record to trusted" "200" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME\",\"version\":\"0.1.0\",\"trust_tier\":\"trusted\"}" \
  "$BASE/promote"

run "Promote: not found → 404" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"does.not.exist","version":"1.0.0","trust_tier":"verified"}' \
  "$BASE/promote"

# Post-review test (AUDIT-REG-005): after /promote re-signs the record, the
# stored signature must still verify against the new trust_tier. This test
# would have caught the bug where /promote updated trust_tier without
# re-signing — the stored signature would have signed the old trust_tier,
# and /verify would correctly report signature_valid=false.
header "GET /verify after /promote — re-signing consistency (AUDIT-REG-005)"
VERIFY_AFTER_PROMOTE=$(curl -s "$BASE/verify/$TEST_NAME?version=0.1.0")
if echo "$VERIFY_AFTER_PROMOTE" | grep -q '"signature_valid"[[:space:]]*:[[:space:]]*true'; then
  ok "Promoted record still verifies against the canonical signature"
else
  fail "Promoted record signature does NOT verify — /promote did not re-sign correctly"
  echo "    Body: $(echo "$VERIFY_AFTER_PROMOTE" | head -c 300)"
fi

# Post-review-3 test (AUDIT-REG-012): /promote must normalize caller-supplied
# names (lowercase, slash-to-dot) before lookup. Without normalization,
# operationally-equivalent inputs like "Foo.Bar" or "foo/bar" 404 against
# records stored as "foo.bar". /register normalizes at storage time; /promote
# must normalize at lookup time for parity.
UPPERCASE_NAME=$(echo "$TEST_NAME" | tr '[:lower:]' '[:upper:]')
run "Promote with uppercase name → 200 (normalization)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$UPPERCASE_NAME\",\"version\":\"0.1.0\",\"trust_tier\":\"verified\"}" \
  "$BASE/promote"

SLASH_NAME=$(echo "$TEST_NAME" | sed 's/\./\//g')
run "Promote with slash-separated name → 200 (normalization)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$SLASH_NAME\",\"version\":\"0.1.0\",\"trust_tier\":\"trusted\"}" \
  "$BASE/promote"

# ── Revoke ────────────────────────────────────────────────────────────────────
header "POST /revoke"

# Post-review test (AUDIT-REG-006): /revoke without reason must be rejected.
# Prior implementation defaulted to 'Revoked via API' if reason was missing,
# silently accepting the revoke without an audit-trail explanation.
run "Revoke without reason → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME\",\"version\":\"0.1.0\"}" \
  "$BASE/revoke"

run "Revoke with empty reason → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME\",\"version\":\"0.1.0\",\"reason\":\"\"}" \
  "$BASE/revoke"

run "Revoke test record" "200" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME\",\"version\":\"0.1.0\",\"reason\":\"Test cleanup\"}" \
  "$BASE/revoke"

run "Lookup revoked record → 404" "404" \
  "$BASE/lookup/$TEST_NAME"

run "Revoke: not found → 404" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"already.gone","reason":"test"}' \
  "$BASE/revoke"

# Post-review-3 test (AUDIT-REG-012, /revoke variant): /revoke must normalize
# caller-supplied names the same way /promote does. Register a fresh record,
# then revoke using an uppercase variant of the same name and confirm both
# the revoke succeeds AND a subsequent lookup with the lowercase name shows
# the record is gone — proving the normalized revoke targeted the right row.
NORM_NAME="test.norm.$(date +%s).cap"
NORM_UPPER=$(echo "$NORM_NAME" | tr '[:lower:]' '[:upper:]')
run "Register fresh record for /revoke normalization test" "201" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$NORM_NAME\",\"description\":\"Normalization test\",\"endpoint\":\"https://x.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"1.0.0\"}" \
  "$BASE/register"

run "Revoke with uppercase name → 200 (normalization)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"$NORM_UPPER\",\"version\":\"1.0.0\",\"reason\":\"Test normalization\"}" \
  "$BASE/revoke"

run "Lookup lowercased name → 404 (confirms normalized revoke hit the right row)" "404" \
  "$BASE/lookup/$NORM_NAME"

# ── v0.2.2: Re-registration of a revoked slot inserts a new row (Spec §8.1) ──
header "Re-register revoked slot (Spec §8.1 immutable revoked row)"

run "Re-register revoked name:version → 201" "201" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"name\":        \"$TEST_NAME\",
    \"description\": \"Re-registered after revocation\",
    \"endpoint\":    \"https://test.example.com/capability\",
    \"protocol\":    \"rest\",
    \"trust_tier\":  \"experimental\",
    \"permissions\": [\"query\"],
    \"version\":     \"0.1.0\"
  }" "$BASE/register"

run "Re-registered record is retrievable" "200" \
  "$BASE/lookup/$TEST_NAME?version=0.1.0"

# Revoke the re-registered slot so subsequent runs have a clean state
curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME\",\"version\":\"0.1.0\",\"reason\":\"test cleanup\"}" \
  "$BASE/revoke" > /dev/null

# Cleanup schemas record too
curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME_SCHEMAS\",\"version\":\"0.1.0\",\"reason\":\"test cleanup\"}" \
  "$BASE/revoke" > /dev/null

# ── v0.2.2: /pubkey?previous=true behavior (Spec §5.6) ────────────────────────
header "GET /pubkey?previous=true (Spec §5.6 rotation overlap)"

# When no overlap is active, /pubkey?previous=true must 404
run "Previous key without rotation → 404" "404" "$BASE/pubkey?previous=true"

# Primary /pubkey continues to work
run "Primary /pubkey still returns current key" "200" "$BASE/pubkey"

# Post-review-4 test (AUDIT-REG-015, issue A): version type guards on /promote
# and /revoke. Without these, malformed input like {version: {bad: true}}
# could fall through to driver-level errors instead of clean 400 responses.
header "POST /promote — version type guard (AUDIT-REG-015)"
run "Promote with non-string version → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"tools.search.web-retrieval","version":{"bad":true},"trust_tier":"trusted"}' \
  "$BASE/promote"

run "Promote with empty-string version → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"tools.search.web-retrieval","version":"   ","trust_tier":"trusted"}' \
  "$BASE/promote"

header "POST /revoke — version type guard (AUDIT-REG-015)"
run "Revoke with non-string version → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"already.gone","version":{"bad":true},"reason":"test"}' \
  "$BASE/revoke"

# Revoke without version is allowed (revokes all versions); only validate
# version type when supplied. Confirm omission still works (this test will
# fall through to "not found" because the name doesn't exist, which is the
# correct 404 — not a 400 type-guard rejection).
run "Revoke without version field → 404 not 400 (omission allowed)" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"does.not.exist","reason":"test"}' \
  "$BASE/revoke"

# Post-review-4 test (AUDIT-REG-016, issue B): read-path lowercase normalization.
# /lookup, /verify, and /log?name= now normalize uppercase input the same way
# /promote and /revoke do, matching against canonical lowercase storage form.
header "Read-path lowercase normalization (AUDIT-REG-016)"

# Register a fresh fixed-name record for the read-path tests
NORM_READ_NAME="test.norm.read.$(date +%s).cap"
NORM_READ_UPPER=$(echo "$NORM_READ_NAME" | tr '[:lower:]' '[:upper:]')
curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"$NORM_READ_NAME\",\"description\":\"Read-path normalization test\",\"endpoint\":\"https://x.example.com\",\"protocol\":\"rest\",\"trust_tier\":\"experimental\",\"version\":\"1.0.0\"}" \
  "$BASE/register" > /dev/null

run "/lookup with uppercase name → 200" "200" "$BASE/lookup/$NORM_READ_UPPER"
run "/verify with uppercase name → 200" "200" "$BASE/verify/$NORM_READ_UPPER?version=1.0.0"

# /log?name= with uppercase should return the record's entry (at least the register action)
LOG_BODY=$(curl -s "$BASE/log?name=$NORM_READ_UPPER")
if echo "$LOG_BODY" | grep -q "$NORM_READ_NAME"; then
  ok "/log?name= with uppercase finds entries (normalization works)"
else
  fail "/log?name= with uppercase returned no entries despite normalization"
  echo "    Body: $(echo "$LOG_BODY" | head -c 300)"
fi

# Cleanup
curl -s -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} -H "Content-Type: application/json" \
  -d "{\"name\":\"$NORM_READ_NAME\",\"version\":\"1.0.0\",\"reason\":\"Cleanup\"}" \
  "$BASE/revoke" > /dev/null

# Post-review-4 test (AUDIT-REG-017, issue C): /list pagination strict validation
# matching /log's pattern. Malformed values now rejected with 400 instead of
# being silently coerced (e.g. "abc" → NaN → null in response).
header "GET /list — pagination strict validation (AUDIT-REG-017)"
run "/list?limit=abc → 400" "400" "$BASE/list?limit=abc"
run "/list?limit=10abc → 400 (regex pre-check, post-review-5)" "400" "$BASE/list?limit=10abc"
run "/list?offset=1.5 → 400 (regex pre-check, post-review-5)" "400" "$BASE/list?offset=1.5"
run "/list?offset=0x10 → 400 (regex pre-check, post-review-5)" "400" "$BASE/list?offset=0x10"
run "/list?limit=0 → 400 (below range)" "400" "$BASE/list?limit=0"
run "/list?limit=501 → 400 (above range)" "400" "$BASE/list?limit=501"
run "/list?offset=-1 → 400 (negative)" "400" "$BASE/list?offset=-1"
run "/list?offset=abc → 400" "400" "$BASE/list?offset=abc"
run "/list?limit=50 → 200 (valid)" "200" "$BASE/list?limit=50"

# Post-review-5 test (AUDIT-REG-019): /log pagination must use the same
# strict regex pre-check that /list now uses. Wider-scope fix — round 4
# tightened both endpoints to parseInt-only; round 5 reviewer correctly
# noted parseInt accepts "10abc" as 10 in both. Same defect class.
header "GET /log — pagination strict validation (AUDIT-REG-019, wider-scope)"
run "/log?limit=10abc → 400" "400" "$BASE/log?limit=10abc"
run "/log?offset=1.5 → 400" "400" "$BASE/log?offset=1.5"
run "/log?offset=0x10 → 400" "400" "$BASE/log?offset=0x10"

# Post-review-5 test (AUDIT-REG-020): /list?tier=invalid must return 400
# rather than silently falling through to listAll(). Trust tier is a closed
# enum per Spec §3.1; invalid input is caller error, not "filter not applied."
header "GET /list — invalid tier rejection (AUDIT-REG-020)"
run "/list?tier=banana → 400 (invalid enum value rejected)" "400" "$BASE/list?tier=banana"
run "/list?tier=verified → 200 (valid enum value accepted)" "200" "$BASE/list?tier=verified"

# ── Unknown route ─────────────────────────────────────────────────────────────
header "Unknown routes"
run "Unknown route → 404" "404" "$BASE/unknown"

# ──────────────────────────────────────────────────────────────────────────────
# AUDIT-REG-013 — Mirror freshness value validation (manual reproduction)
# ──────────────────────────────────────────────────────────────────────────────
# Mirror mode validates that AUTHORITATIVE_SNAPSHOT_TIMESTAMP and
# AUTHORITATIVE_SIGNATURE_HASH are not just present but well-formed
# (RFC 3339 second-precision UTC date-time and lowercase hex SHA-256
# respectively). Cannot be exercised here because test.sh runs against a
# single already-started server. Manual reproduction:
#
#   1. Stop the registry.
#   2. Start with: REGISTRY_MODE=mirror \
#                  AUTHORITATIVE_SNAPSHOT_TIMESTAMP=banana \
#                  AUTHORITATIVE_SIGNATURE_HASH=not-a-sha256 \
#                  node server.js
#   3. curl http://localhost:9475/health
#   4. Expected: status: "degraded" with mirror_warning describing both
#      malformed values.
#   5. Try with valid values:
#      AUTHORITATIVE_SNAPSHOT_TIMESTAMP=2026-05-16T03:00:00Z
#      AUTHORITATIVE_SIGNATURE_HASH=$(printf "" | sha256sum | awk '{print $1}')
#      → status should be "ok".
#   6. Try with one valid one missing:
#      → status should be "degraded".

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo -e "  Results:  ${GREEN}$PASS passed${RESET}  /  ${RED}$FAIL failed${RESET}"
echo "─────────────────────────────────────────"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
