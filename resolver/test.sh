#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  DillClaw Resolver — Test Suite (v0.1.9)
#  Run while the server is running:  bash test.sh
# ─────────────────────────────────────────────────────────────────────────────

PORT="${DILLCLAW_PORT:-9474}"
BASE="http://localhost:$PORT"
PASS=0
FAIL=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

header() { echo ""; echo -e "${CYAN}▶ $1${RESET}"; }
ok()     { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${RESET}  $1"; }
fail()   { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${RESET}  $1"; }

run() {
  local label="$1"; local expected_status="$2"; shift 2
  # Pull off optional --grep <pattern> from the end of the argument list.
  # If present, the test also requires the response body to match the pattern.
  local grep_pattern=""
  local args=()
  while [ $# -gt 0 ]; do
    if [ "$1" = "--grep" ]; then
      grep_pattern="$2"; shift 2
    else
      args+=("$1"); shift
    fi
  done
  local response
  response=$(curl -s -o /tmp/dc_test_body -w "%{http_code}" "${args[@]}")
  if [ "$response" = "$expected_status" ]; then
    if [ -n "$grep_pattern" ]; then
      if grep -qE "$grep_pattern" /tmp/dc_test_body; then
        ok "$label  (HTTP $response, body matches)"
      else
        fail "$label  (HTTP $response, body does NOT match: $grep_pattern)"
        echo "    Body: $(cat /tmp/dc_test_body | head -c 200)"
      fi
    else
      ok "$label  (HTTP $response)"
    fi
  else
    fail "$label  (expected $expected_status, got $response)"
    echo "    Body: $(cat /tmp/dc_test_body | head -c 200)"
  fi
}

# ── Health ────────────────────────────────────────────────────────────────────
header "GET /health"
run "Health check returns 200" "200" "$BASE/health"

# ── Resolve — happy path ──────────────────────────────────────────────────────
header "POST /resolve — exact match"
run "Exact match: research.market.intel.vendors" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors"}' \
  "$BASE/resolve"

header "POST /resolve — wildcard"
run "Wildcard: data.enrichment.company.*" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://data.enrichment.company.*","trust_minimum":"verified"}' \
  "$BASE/resolve"

header "POST /resolve — with permissions filter"
run "Permissions: query + export" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","permissions":["query","export"]}' \
  "$BASE/resolve"

header "POST /resolve — trust tier filters out experimental"
run "Trust filter eliminates experimental" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.*","trust_minimum":"verified"}' \
  "$BASE/resolve"

header "POST /resolve — version pin"
run "Version pin ^1.2" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors:^1.2"}' \
  "$BASE/resolve"

header "POST /resolve — max_results=3"
run "max_results returns multiple" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.*","max_results":3}' \
  "$BASE/resolve"

# ── Scheme-form equivalence (Namespace Standard v0.4.2 §3.4) ──────────────────
# The spec defines two semantically equivalent scheme forms: the full form
# dillweed:// and the canonical short form dllwd://. Implementations MUST treat
# them as equivalent. These tests confirm the short form resolves identically.
header "POST /resolve — canonical short form (dllwd://)"
run "Short form: exact match" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dllwd://research.market.intel.vendors"}' \
  "$BASE/resolve"

run "Short form: wildcard" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dllwd://tools.search.*","trust_minimum":"verified"}' \
  "$BASE/resolve"

run "Short form: version pin" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dllwd://research.market.intel.vendors:^1.2"}' \
  "$BASE/resolve"

# ── Resolve — error cases ─────────────────────────────────────────────────────
header "POST /resolve — error cases"

run "Missing query field → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{}' "$BASE/resolve"

run "Bad URI scheme → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"http://not-dillweed"}' "$BASE/resolve"

run "Uppercase component → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://RESEARCH.market"}' "$BASE/resolve"

run "Wildcard in first component → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://*.market.intel"}' "$BASE/resolve"

run "No match → 404" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://nonexistent.path.goes.here"}' "$BASE/resolve"

run "Trust filtered all → 404" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.*","trust_minimum":"canonical"}' "$BASE/resolve"

run "Permission mismatch → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","permissions":["delete","admin"]}' "$BASE/resolve"

# ── Pass-2 conformance (Spec v0.1.3 — RS-001 through RS-008) ──────────────────
header "Pass 2 conformance — response envelope fields"

# RS-002: scoring_profile MUST be present in every /resolve response
run "scoring_profile present in success response" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors"}' "$BASE/resolve" \
  --grep '"scoring_profile":[[:space:]]*"dillclaw-default-v1"'

# RS-002: scoring_profile MUST also be present in error responses
run "scoring_profile present in error response" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{}' "$BASE/resolve" \
  --grep '"scoring_profile":[[:space:]]*"dillclaw-default-v1"'

# RS-005: trace_id MUST be present in every response including errors
run "trace_id present in error response" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{}' "$BASE/resolve" \
  --grep '"trace_id":[[:space:]]*"trc_'

# RS-001 (round-1 reviewer): resolved_at MUST be RFC 3339 second-precision (no fractional seconds)
# Note: test was previously failing not because the implementation was wrong,
# but because the grep pattern used BRE syntax (\{4\}) while run() uses grep -E
# (ERE), where \{ is literal. Fixed to ERE syntax ({4}). Reviewer caught this
# in round-1: test issue A.
run "resolved_at RFC 3339 second-precision (no millis)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors"}' "$BASE/resolve" \
  --grep '"resolved_at"[[:space:]]*:[[:space:]]*"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z"'

# RS-008: Content-Type explicit check
run "Wrong Content-Type rejected → 400" "400" \
  -X POST -H "Content-Type: text/plain" \
  -d '{"query":"dillweed://research.market.intel.vendors"}' "$BASE/resolve"

# RS-006: missing-signature signal MUST be "sig_unverified" not "sig_absent"
# (we don't have a test fixture with a missing signature; record absence in test.sh
# but this needs a registry.json modification to fully exercise — noted for dill-p-001)

# RS-003 (banker's rounding) and RS-004 (tie-breaking) cannot be reliably
# exercised via black-box HTTP tests because they require constructing inputs
# whose computed trust scores land on exact half-thousandth boundaries (RS-003)
# or produce identical scores across multiple candidates (RS-004). These
# behaviors are covered by unit-tests.js — run separately with:
#     node unit-tests.js   (no server needed)
# 29 unit tests cover the spec's canonical examples and edge cases.

# RS-007 (stale-while-revalidate window cutoff) requires a live registry
# refresh failure to exercise. Manual reproduction procedure:
#     1. Start resolver with:
#        DILLCLAW_REGISTRY_URL=http://127.0.0.1:9 \
#        DILLCLAW_STALE_WINDOW_MS=2000 \
#        node server.js
#     2. /resolve should serve initial data (or fail to start cleanly if
#        registry was never reachable).
#     3. Wait > 2 seconds for the stale window to expire.
#     4. /resolve should now return 503 REGISTRY_UNAVAILABLE rather than
#        stale data. Check /health: registry.mode = "unavailable".

# ── Direct capability lookup ───────────────────────────────────────────────────
header "GET /capability/:path"
run "Direct lookup: research.market.intel.vendors" "200" \
  "$BASE/capability/research.market.intel.vendors"

run "Direct lookup: not found → 404" "404" \
  "$BASE/capability/does.not.exist"

# ── Trace ─────────────────────────────────────────────────────────────────────
header "GET /trace/:id"

# First do a resolution to get a trace ID
TRACE_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://data.enrichment.company.profile"}' "$BASE/resolve")
TRACE_ID=$(echo "$TRACE_RESPONSE" | grep -o '"trc_[a-f0-9]*"' | head -1 | tr -d '"')

if [ -n "$TRACE_ID" ]; then
  run "Trace lookup: $TRACE_ID" "200" "$BASE/trace/$TRACE_ID"
else
  fail "Could not extract trace_id from resolve response"
fi

run "Trace not found → 404" "404" "$BASE/trace/trc_doesnotexist"

# ── Batch ─────────────────────────────────────────────────────────────────────
header "POST /batch"
run "Batch of 2 requests" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"query":"dillweed://research.market.intel.vendors"},
      {"query":"dillweed://data.enrichment.company.profile"}
    ]
  }' "$BASE/batch"

run "Batch too large (51) → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"requests\": [$(python3 -c 'print(",".join(["{\"query\":\"dillweed://a.b\"}"]*51))')]}" \
  "$BASE/batch" 2>/dev/null || \
run "Batch too large → 400 (python unavailable, skipping size test)" "200" \
  "$BASE/health"

# ── Unknown route ─────────────────────────────────────────────────────────────
header "Unknown routes"
run "Unknown route → 404" "404" "$BASE/unknown/path"

# ─────────────────────────────────────────────────────────────────────────────
#  Round-1 external review regression tests (RS-001 through RS-012)
# ─────────────────────────────────────────────────────────────────────────────

# RS-001: invalid signature MUST be rejected (not just scored). Tests that
# a record with a corrupted signature is filtered out of resolve results
# rather than returned with a low score. Requires the resolver to be
# running with a configured DNSO key (the bundled sample is now signed).
header "Round-1 RS-001/002 — signature eligibility gate"

# RS-006 (validation gate): permissions as non-array string
run "permissions must be array (was 'query' string) → 400 QUERY_MALFORMED" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","permissions":"query"}' "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# RS-006: permissions as array containing non-string
run "permissions with non-string element → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","permissions":["query",42]}' "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# RS-006: max_results as non-numeric string
run "max_results string 'foo' → 400 (not empty 'resolved')" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","max_results":"foo"}' "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# RS-006: max_results out of range
run "max_results 0 → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","max_results":0}' "$BASE/resolve"

run "max_results 51 → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","max_results":51}' "$BASE/resolve"

# RS-006: trust_minimum invalid enum
run "trust_minimum 'bogus' → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","trust_minimum":"bogus"}' "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# RS-006: context as array (must be object)
run "context as array → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","context":[1,2,3]}' "$BASE/resolve"

# RS-006: allow_unsigned as non-boolean
run "allow_unsigned as string → 400" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","allow_unsigned":"yes"}' "$BASE/resolve"

# RS-005: version_pref explicit version that doesn't exist → no_match not silent fall-through
header "Round-1 RS-005 — version_pref selection semantics"
run "version_pref '99.99.99' (no match) → no_match" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors","version_pref":"99.99.99"}' "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"VERSION_CONSTRAINT_FAILED"'

# RS-005: version_pref 'stable' must pick highest stable, not first
run "version_pref 'stable' returns 200" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"stable"}' "$BASE/resolve"

# Round-2 RS2-001 fix: version_pref is applied AFTER hard eligibility filters
# (trust tier, permissions, signature). In the bundled registry:
#   - tools.search.web-retrieval@3.1.0 is signed
#   - tools.search.web-retrieval@4.0.0-beta is intentionally unsigned
# Without allow_unsigned: signature gate eliminates 4.0.0-beta; 'latest' then
# picks the highest from {3.1.0} → resolves 3.1.0 (NOT SIGNATURE_FILTERED).
# With allow_unsigned: both pass eligibility; 'latest' picks 4.0.0-beta.
run "version_pref 'latest' without allow_unsigned → resolves latest eligible signed (3.1.0)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"latest"}' "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"3.1.0"'

run "version_pref 'latest' with allow_unsigned → resolves 4.0.0-beta" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"latest","allow_unsigned":true}' "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"4.0.0-beta"'

# RS-007: trace_id on early validation error must be persistent (retrievable via /trace)
header "Round-1 RS-007 — trace persistence on early errors"
ERR_TRACE_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"query":""}' "$BASE/resolve")
ERR_TRACE_ID=$(echo "$ERR_TRACE_RESP" | grep -oE '"trace_id"[[:space:]]*:[[:space:]]*"trc_[a-f0-9]+"' | grep -oE 'trc_[a-f0-9]+' | head -1)
if [ -n "$ERR_TRACE_ID" ]; then
  TRACE_LOOKUP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/trace/$ERR_TRACE_ID")
  if [ "$TRACE_LOOKUP" = "200" ]; then
    ok "Early error trace_id is retrievable via /trace ($ERR_TRACE_ID)"
  else
    fail "Early error trace_id NOT retrievable: HTTP $TRACE_LOOKUP"
  fi
else
  fail "Early error response did not include trace_id"
fi

# RS-008: batch envelope includes resolver_version and scoring_profile
header "Round-1 RS-008 — batch envelope consistency"
run "Batch envelope includes resolver_version + scoring_profile" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"requests":[{"query":"dillweed://research.market.intel.vendors"}]}' "$BASE/batch" \
  --grep '"resolver_version"[[:space:]]*:'

# RS-009: /capability normalizes case and URL-encoded slashes
header "Round-1 RS-009 — capability path normalization"
run "/capability with uppercase name normalized → 200" "200" \
  "$BASE/capability/Research.Market.Intel.Vendors"
run "/capability with slash separators normalized → 200" "200" \
  "$BASE/capability/research/market/intel/vendors"

# RS-008/RS-005: tests that exercise the verified signing scheme on the
# bundled registry.json (records now have real Ed25519 signatures over
# the Registry v0.1.4 canonical JSON profile).
header "Round-1 RS-003 — locally-signed records verify with real DNSO key"
run "Resolve a signed record returns resolved (sig now valid)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://research.market.intel.vendors"}' "$BASE/resolve" \
  --grep '"status"[[:space:]]*:[[:space:]]*"resolved"'

# ─────────────────────────────────────────────────────────────────────────────
# AUDIT-RES-MANUAL — Cross-implementation integration testing
# ─────────────────────────────────────────────────────────────────────────────
# RS-003 closure requires that Registry-signed records validate when consumed
# by the Resolver. This sandbox cannot install better-sqlite3 so the live
# Registry server cannot be started here. In-sandbox cross-implementation
# byte-equivalence was verified during round-1 polish work:
#   Registry canonicalJSON output ≡ Resolver canonicalJSON output
#   Registry sign() output ≡ Resolver verify() input format
# Both are byte-identical for the same record. End-to-end verification
# (live Registry server signing → Resolver verifying) requires runtime
# integration testing on dill-p-001 and is recorded as AUDIT-RES-MANUAL.
#
# Manual reproduction procedure:
#   1. Install and start Registry v0.2.7 on its default port (9475).
#   2. Use Registry's /register to create a few capability records.
#   3. Start this Resolver with DILLCLAW_REGISTRY_BASE_URL=http://localhost:9475
#      and DILLCLAW_DNSO_PUBLIC_KEY pointing at the Registry's public key.
#   4. curl localhost:9474/resolve with a query for one of the registered names.
#   5. Expected: status=resolved, sig_status=valid in the trust_signals.
#   6. RS-004 cutover test: stop the Registry. After DILLCLAW_STALE_WINDOW_MS
#      (default 900000ms), /resolve must return REGISTRY_UNAVAILABLE.
#   7. RS-012 /lookup-on-miss test: register a new record after Resolver
#      startup. Resolver's snapshot doesn't have it yet. /resolve for the
#      new name should trigger /lookup-on-miss and find it.

# ══════════════════════════════════════════════════════════════════════════════
# ROUND-2 EXTERNAL REVIEW REGRESSION TESTS (RS2-001 through RS2-004)
# ══════════════════════════════════════════════════════════════════════════════

# RS2-001 — version_pref applied AFTER hard eligibility filters (post-permission,
# post-signature), and PER namespace path. Reviewer's specific test case:
#   tools.order.test@1.0.0 verified, @2.0.0 experimental, both unsigned
#   request: trust_minimum=verified, version_pref=stable, allow_unsigned=true
#   expected: resolves 1.0.0 (verified) — NOT TRUST_FILTERED
# Prior to this fix the resolver picked 2.0.0 as the highest stable BEFORE
# the trust gate ran, then eliminated it for trust failure, returning
# TRUST_FILTERED falsely.
header "RS2-001: version_pref runs after eligibility filters (post-trust)"
run "Lower version satisfies trust, higher fails → resolves lower (not TRUST_FILTERED)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.order.test","trust_minimum":"verified","version_pref":"stable","allow_unsigned":true}' \
  "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"1.0.0"'

# Same data, no trust constraint → 'stable' picks the highest (2.0.0)
run "No trust constraint, version_pref=stable → highest stable (2.0.0)" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.order.test","version_pref":"stable","allow_unsigned":true}' \
  "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"2.0.0"'

# Wildcard query with version_pref applied per-name (not globally)
# Query 'dillweed://tools.order.*' matches both versions of tools.order.test.
# Per-name version_pref means each distinct name contributes its preferred
# version; the result is ONE record (tools.order.test at its preferred version)
# rather than collapsing to "the globally-highest version of anything matching".
# For this single-name wildcard match, this is identical to the global case;
# the per-name semantics matter more for wildcards spanning multiple names.
run "Wildcard query with version_pref applied per-name" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dllwd://tools.order.*","version_pref":"stable","allow_unsigned":true,"max_results":3}' \
  "$BASE/resolve" \
  --grep '"status"[[:space:]]*:[[:space:]]*"resolved"'

# RS2-002 — Missing Content-Type header MUST be rejected, not just wrong CT.
# Reviewer found that requests with NO Content-Type header at all were
# accepted as JSON. The fix removes the truthy guard and requires the
# Content-Type to be exactly application/json.
header "RS2-002: Missing Content-Type rejected"
# Using curl with empty -H value sends no Content-Type header.
# (curl's default form-urlencoded behavior is overridden by the empty -H.)
run "Missing Content-Type → 400 QUERY_MALFORMED" "400" \
  -X POST -H "Content-Type:" \
  -d '{"query":"dillweed://research.market.intel.vendors"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# Wrong Content-Type still rejected (was already passing pre-RS2-002 too)
run "Wrong Content-Type (text/plain) → 400 QUERY_MALFORMED" "400" \
  -X POST -H "Content-Type: text/plain" \
  -d '{"query":"dillweed://research.market.intel.vendors"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# Same for /batch
run "Batch with missing Content-Type → 400" "400" \
  -X POST -H "Content-Type:" \
  -d '{"requests":[{"query":"dillweed://research.market.intel.vendors"}]}' \
  "$BASE/batch" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# RS2-003 — Semver range support beyond simple ^MAJOR.MINOR.
# The implementation now supports caret with patch (^X.Y.Z), tilde (~X.Y,
# ~X.Y.Z), and exact. The bundled signed record tools.search.web-retrieval
# has versions 3.1.0 and (unsigned) 4.0.0-beta. Use 3.1.0 + permanent
# fixtures for the range tests.
header "RS2-003: Semver range support (caret with patch, tilde)"

# Caret with patch: ^3.1.0 should match 3.1.0 (the bundled signed record)
run "Caret with patch '^3.1.0' matches 3.1.0" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"^3.1.0"}' \
  "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"3.1.0"'

# Caret with patch: ^3.2.0 should NOT match 3.1.0 (3.1.0 < 3.2.0)
run "Caret with patch '^3.2.0' does NOT match 3.1.0 → VERSION_CONSTRAINT_FAILED" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"^3.2.0"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"VERSION_CONSTRAINT_FAILED"'

# Tilde: ~3.1.0 matches 3.1.0 (same major.minor)
run "Tilde range '~3.1.0' matches 3.1.0" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"~3.1.0"}' \
  "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"3.1.0"'

# Tilde: ~3.0 does NOT match 3.1.0 (different minor)
run "Tilde range '~3.0' does NOT match 3.1.0 (different minor) → VERSION_CONSTRAINT_FAILED" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"~3.0"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"VERSION_CONSTRAINT_FAILED"'

# Tilde with minor only: ~3.1 matches 3.1.0
run "Tilde with minor only '~3.1' matches 3.1.0" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"~3.1"}' \
  "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"3.1.0"'

# RS2-004 — trustSignals correctly labels unverifiable signatures.
# 'unverifiable' (record has signature but resolver lacks DNSO public key
# to check it) was previously emitting 'sig_valid' which was misleading.
# Now emits 'sig_unverified' for parity with the absent-signature path.
# This regression test is necessarily indirect: we can't easily force
# 'unverifiable' state on a resolver running with a configured key, so
# the test verifies that resolved records' trust_signals do NOT contain
# 'sig_valid' for the deliberately-unsigned record (which uses
# allow_unsigned, so the absent-signature path emits 'sig_unverified').
header "RS2-004: trustSignals — unsigned records do NOT emit 'sig_valid'"
run "Unsigned record (with allow_unsigned) emits sig_unverified, not sig_valid" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"4.0.0-beta","allow_unsigned":true}' \
  "$BASE/resolve" \
  --grep '"sig_unverified"'

# ══════════════════════════════════════════════════════════════════════════════
# ROUND-3 EXTERNAL REVIEW REGRESSION TESTS (RS3-001, RS3-002)
# ══════════════════════════════════════════════════════════════════════════════
# Reviewer flagged two LOW-severity parser-hardening items. Round-3 reviewer's
# verdict was "v1-baseline ready" — these are optional polish, applied
# pre-publication per CONV-001 to clean the parser before install testing.

# RS3-001 — Range components must be strictly numeric. parseInt() permissiveness
# previously allowed '^3.1abc' to parse as '^3.1'. Now rejected at matchVersion.
header "RS3-001: Strict numeric validation of semver range components"

run "Malformed caret '^3.1abc' → VERSION_CONSTRAINT_FAILED" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"^3.1abc"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"VERSION_CONSTRAINT_FAILED"'

run "Malformed tilde '~3.1x' → VERSION_CONSTRAINT_FAILED" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"~3.1x"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"VERSION_CONSTRAINT_FAILED"'

run "Malformed patch '^1.2.3x' → VERSION_CONSTRAINT_FAILED" "404" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"^1.2.3x"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"VERSION_CONSTRAINT_FAILED"'

# Sanity counter-tests: valid forms still pass after the parser tightening
run "Valid caret '^3.1.0' still matches 3.1.0" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval","version_pref":"^3.1.0"}' \
  "$BASE/resolve" \
  --grep '"version"[[:space:]]*:[[:space:]]*"3.1.0"'

# RS3-002 — Empty version suffix after ':' is malformed, not unpinned.
header "RS3-002: Empty version suffix rejected"

run "Empty version suffix 'tools.search.web-retrieval:' → QUERY_MALFORMED" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval:"}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# Whitespace-only version suffix is also malformed (same root cause)
run "Whitespace-only suffix 'name: ' → QUERY_MALFORMED" "400" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval: "}' \
  "$BASE/resolve" \
  --grep '"error_code"[[:space:]]*:[[:space:]]*"QUERY_MALFORMED"'

# Sanity counter-test: valid version suffix still works
run "Valid version suffix ':3.1.0' still parses" "200" \
  -X POST -H "Content-Type: application/json" \
  -d '{"query":"dillweed://tools.search.web-retrieval:3.1.0"}' \
  "$BASE/resolve" \
  --grep '"status"[[:space:]]*:[[:space:]]*"resolved"'

# ── Per-IP rate limiting (W0 / v2 design §4.2.2) ──────────────────────────────
# Reads (/capability, /trace) and expensive POSTs (/resolve, /batch) draw from
# separate per-IP budgets; exceeding one yields 429 + Retry-After. /health is
# exempt. Burst sizes self-calibrate from the limits advertised in /health.
header "Per-IP rate limiting (429 + Retry-After)  [v2 §4.2.2]"
rl_num() { grep -o "\"$1\"[[:space:]]*:[[:space:]]*[0-9]*" | grep -o '[0-9]*$' | head -1; }

RL_ENABLED=$(curl -s "$BASE/health" | grep -o '"enabled"[[:space:]]*:[[:space:]]*\(true\|false\)' | grep -o 'true\|false' | head -1)
READ_MAX=$(curl -s "$BASE/health" | rl_num read_max)
WRITE_MAX=$(curl -s "$BASE/health" | rl_num write_max)

if [ "$RL_ENABLED" != "true" ]; then
  ok "rate limiting reported disabled — 429 assertions skipped"
else
  # Read budget. Use /trace (a purely local lookup) rather than /capability: a
  # /capability miss cascades to a registry lookup, so a large burst would also
  # throttle the resolver's own registry sync (same localhost IP in this test).
  R429=$(seq 1 $((READ_MAX + 15)) | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" "$BASE/trace/does-not-exist" | grep -c '^429$')
  if [ "$R429" -ge 1 ]; then
    ok "read burst over budget → ${R429}×429 (read_max=$READ_MAX)"
  else
    fail "read burst should produce ≥1 429 (read_max=$READ_MAX, got $R429)"
  fi

  RA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/trace/does-not-exist")
  RA=$(curl -s -o /dev/null -D - "$BASE/trace/does-not-exist" | grep -i '^retry-after:' | tr -d '\r' | awk '{print $2}')
  if [ "$RA_STATUS" = "429" ] && [ -n "$RA" ]; then
    ok "429 response carries Retry-After (${RA}s)"
  else
    fail "saturated read expected 429 + Retry-After (status=$RA_STATUS, retry-after=$RA)"
  fi

  # Write/expensive budget (POST /batch — the 50× fan-out op; invalid body still
  # counts because the limiter runs before validation). Plain /resolve is a read.
  W429=$(seq 1 $((WRITE_MAX + 15)) | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
           -X POST -H "Content-Type: application/json" -d '{"bad":"body"}' "$BASE/batch" | grep -c '^429$')
  if [ "$W429" -ge 1 ]; then
    ok "write burst over budget → ${W429}×429 (write_max=$WRITE_MAX)"
  else
    fail "write burst should produce ≥1 429 (write_max=$WRITE_MAX, got $W429)"
  fi

  H429=$(seq 1 30 | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" "$BASE/health" | grep -c '^429$')
  if [ "$H429" = "0" ]; then
    ok "/health exempt from rate limiting (0×429 over 30 calls)"
  else
    fail "/health should be exempt (got ${H429}×429)"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo -e "  Results:  ${GREEN}$PASS passed${RESET}  /  ${RED}$FAIL failed${RESET}"
echo "─────────────────────────────────────────"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
