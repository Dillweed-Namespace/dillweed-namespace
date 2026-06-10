#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  Dillweed Anthill™ — Test Suite (v0..6)
#  Run while the server is running:  bash test.sh
#
#  Covers Spec v0.1 conformance:
#    - §4  Signal validation (all errors simultaneously)
#    - §4  Nonce replay protection
#    - §4  Node sequence replay protection
#    - §5  Aggregation window endpoint
#    - §6  Summary endpoint
# ─────────────────────────────────────────────────────────────────────────────

PORT="${ANTHILL_PORT:-9476}"
BASE="http://localhost:$PORT"
TOKEN="${ANTHILL_ADMIN_TOKEN:-$(security find-generic-password -a anthill-admin -s dillweed-anthill -w 2>/dev/null || true)}"
# Round-2 review (AS2-003 fix): AUTH_HEADER companion to TOKEN. When the
# server is running in token-gated mode (ANTHILL_ADMIN_TOKEN set), every
# authenticated endpoint test must include the Bearer header. The
# ${AUTH_HEADER:+-H "$AUTH_HEADER"} idiom in round-1 fix tests references
# this variable; define it here so the expansion works.
AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi
PASS=0
FAIL=0

# Generate unique test nonces to avoid collisions across test runs
NONCE_PREFIX=$(node -e "const c=require('crypto');process.stdout.write(c.randomBytes(8).toString('hex'))")
# v0.1.6 patch (INST-006): unique originating_node values per test run.
# Hardcoded node names (test-resolver-001, REGISTRY, as005-node, etc.) collide
# with preserved high-water-marks in the node_sequences table when test.sh is
# re-run against an Anthill instance that wasn't reset to clean-slate (e.g.
# after an in-place upgrade). Appending NONCE_PREFIX ensures each test run
# uses fresh node identifiers that have no prior sequence state. The
# ANTHILL_AGGREGATOR-rejection test is intentionally NOT suffixed since it
# tests rejection of that exact reserved string.
NODE_SUFFIX="-${NONCE_PREFIX}"
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

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
  status=$(curl -s -o /tmp/anthill_test_body -w "%{http_code}" "$@")
  if [ "$status" = "$expected" ]; then
    ok "$label  (HTTP $status)"
  else
    fail "$label  (expected $expected, got $status)"
    echo "    Body: $(cat /tmp/anthill_test_body | head -c 300)"
  fi
}

run_auth() {
  local label="$1"; local expected="$2"; shift 2
  local status
  if [ -n "$TOKEN" ]; then
    status=$(curl -s -o /tmp/anthill_test_body -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$@")
  else
    status=$(curl -s -o /tmp/anthill_test_body -w "%{http_code}" "$@")
  fi
  if [ "$status" = "$expected" ]; then
    ok "$label  (HTTP $status)"
  else
    fail "$label  (expected $expected, got $status)"
    echo "    Body: $(cat /tmp/anthill_test_body | head -c 300)"
  fi
}

# ── Health ────────────────────────────────────────────────────────────────────
header "GET /health"
run "Health check" "200" "$BASE/health"

# ── Signal Submission — valid signals ─────────────────────────────────────────
header "POST /signal — valid signals"

run_auth "Submit ANT-TC signal (INFORMATIONAL)" "201" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-TC\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_tc_info_1\",
    \"node_sequence\":    1,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"capability_ref\":   \"research.market.intel.vendors\",
    \"severity\":         \"INFORMATIONAL\",
    \"signal_payload\":   {\"detail\": \"Trust tier drift observed\", \"drift_delta\": 0.12}
  }" "$BASE/signal"

run_auth "Submit ANT-DN signal (WARNING)" "201" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-DN\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_dn_warn_1\",
    \"node_sequence\":    2,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"capability_ref\":   null,
    \"severity\":         \"WARNING\",
    \"signal_payload\":   {\"detail\": \"Systematic probing of unregistered paths detected\", \"probe_count\": 47}
  }" "$BASE/signal"

run_auth "Submit ANT-EC signal (ADVISORY)" "201" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-EC\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_ec_adv_1\",
    \"node_sequence\":    3,
    \"originating_node\": \"REGISTRY${NODE_SUFFIX}\",
    \"capability_ref\":   null,
    \"severity\":         \"ADVISORY\",
    \"signal_payload\":   {\"detail\": \"Single provider approaching 40% of resolution volume\", \"provider\": \"example.com\", \"share\": 0.38}
  }" "$BASE/signal"

run_auth "Submit ANT-RC signal (CRITICAL)" "201" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-RC\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_rc_crit_1\",
    \"node_sequence\":    4,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"capability_ref\":   \"tools.search.web-retrieval\",
    \"severity\":         \"CRITICAL\",
    \"signal_payload\":   {\"detail\": \"Revoked record still being served after grace period\", \"revocation_age_seconds\": 4320}
  }" "$BASE/signal"

# ── Signal Submission — validation errors ─────────────────────────────────────
header "POST /signal — validation errors (Spec §4)"

run_auth "Missing signal_class → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_missing_class\",
    \"node_sequence\":    100,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"severity\":         \"INFORMATIONAL\",
    \"signal_payload\":   {}
  }" "$BASE/signal"

run_auth "Invalid signal_class → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-XX\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_bad_class\",
    \"node_sequence\":    101,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"severity\":         \"INFORMATIONAL\",
    \"signal_payload\":   {}
  }" "$BASE/signal"

run_auth "Invalid severity → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-TC\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_bad_severity\",
    \"node_sequence\":    102,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"severity\":         \"EXTREME\",
    \"signal_payload\":   {}
  }" "$BASE/signal"

run_auth "Bad timestamp format → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-TC\",
    \"signal_timestamp\": \"2026-05-04 10:00:00\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_bad_ts\",
    \"node_sequence\":    103,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"severity\":         \"INFORMATIONAL\",
    \"signal_payload\":   {}
  }" "$BASE/signal"

run_auth "signal_payload not object → 422" "422" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-TC\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_bad_payload\",
    \"node_sequence\":    104,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"severity\":         \"INFORMATIONAL\",
    \"signal_payload\":   \"not an object\"
  }" "$BASE/signal"

# ── Replay Protection ─────────────────────────────────────────────────────────
header "POST /signal — replay protection (Spec §4)"

# Nonce replay — submit same nonce as first test signal
run_auth "Duplicate nonce → 409 NONCE_COLLISION" "409" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-TC\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_tc_info_1\",
    \"node_sequence\":    999,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"severity\":         \"INFORMATIONAL\",
    \"signal_payload\":   {}
  }" "$BASE/signal"

# Node sequence replay — submit sequence lower than last accepted (4)
run_auth "Out-of-sequence node_sequence → 409 SEQUENCE_VIOLATION" "409" \
  -X POST -H "Content-Type: application/json" \
  -d "{
    \"signal_class\":     \"ANT-TC\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"${NONCE_PREFIX}_seq_replay\",
    \"node_sequence\":    2,
    \"originating_node\": \"test-resolver-001${NODE_SUFFIX}\",
    \"severity\":         \"INFORMATIONAL\",
    \"signal_payload\":   {}
  }" "$BASE/signal"

# ── Auth check ────────────────────────────────────────────────────────────────
if [ -n "$TOKEN" ]; then
  header "POST /signal — auth enforcement"
  # Submit without token
  STATUS=$(curl -s -o /tmp/anthill_test_body -w "%{http_code}" \
    -X POST -H "Content-Type: application/json" \
    -d "{\"signal_class\":\"ANT-TC\",\"signal_timestamp\":\"$TS\",\"signal_nonce\":\"${NONCE_PREFIX}_noauth\",\"node_sequence\":200,\"originating_node\":\"test\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{}}" \
    "$BASE/signal")
  if [ "$STATUS" = "401" ]; then
    ok "Signal without token → 401 UNAUTHORIZED  (HTTP 401)"
  else
    fail "Expected 401 for unauthenticated signal, got $STATUS"
  fi
fi

# ── List Signals ──────────────────────────────────────────────────────────────
header "GET /signals"
# Round-2 (AS2-003 fix): /signals now requires auth when ANTHILL_ADMIN_TOKEN
# is set (per AS-008). All /signals tests use run_auth, which conditionally
# adds the Bearer header. requireAuth runs before param parsing, so even
# error-path tests (400-expecting) need auth to reach the validation logic
# in token mode.
run_auth "List all signals"              "200" "$BASE/signals"
run_auth "Filter by class: ANT-TC"       "200" "$BASE/signals?class=ANT-TC"
run_auth "Filter by severity: WARNING"   "200" "$BASE/signals?severity=WARNING"
run_auth "Filter by class: ANT-DN"       "200" "$BASE/signals?class=ANT-DN"
run_auth "Pagination: limit=2"           "200" "$BASE/signals?limit=2&offset=0"
run_auth "Invalid class filter → 400"    "400" "$BASE/signals?class=ANT-XX"
run_auth "Invalid severity filter → 400" "400" "$BASE/signals?severity=EXTREME"

# ── Aggregate ─────────────────────────────────────────────────────────────────
header "GET /aggregate (Spec §5)"
run "Aggregation windows" "200" "$BASE/aggregate"

# Verify aggregation contains all six signal classes
AGG_BODY=$(curl -s "$BASE/aggregate")
ALL_CLASSES=1
for cls in ANT-TC ANT-RC ANT-DN ANT-RA ANT-WF ANT-EC; do
  if ! echo "$AGG_BODY" | grep -q "\"$cls\""; then
    ALL_CLASSES=0
    break
  fi
done
if [ "$ALL_CLASSES" = "1" ]; then
  ok "Aggregation contains all six signal classes"
else
  fail "Aggregation missing one or more signal classes"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
header "GET /summary (Spec §6)"
run_auth "Ecosystem health summary" "200" "$BASE/summary"

SUMMARY_BODY=$(curl -s ${TOKEN:+-H "Authorization: Bearer $TOKEN"} "$BASE/summary")
if echo "$SUMMARY_BODY" | grep -q '"total_signals"'; then
  ok "Summary contains total_signals field"
else
  fail "Summary missing total_signals field"
fi

# ── Unknown Routes ────────────────────────────────────────────────────────────
header "Unknown routes"
run "Unknown route → 404" "404" "$BASE/unknown"

# ══════════════════════════════════════════════════════════════════════════════
# PRE-REVIEW-1 SELF-AUDIT REGRESSION TESTS (AAS-PRE-001 through AAS-PRE-017)
# ══════════════════════════════════════════════════════════════════════════════
# Four self-audit fixes applied before round-1 external review:
#   AAS-PRE-001 — VERSION constant + reference at /health and banner
#   AAS-PRE-002 — strict numeric validation for limit/offset
#   AAS-PRE-003 — limit/offset bounds checking
#   AAS-PRE-017 — DB/log nonce consistency for aggregator-generated ANT-RA signal

header "Pre-review-1: VERSION constant + /health format"
HEALTH_BODY=$(curl -s "$BASE/health")
if echo "$HEALTH_BODY" | grep -q '"version"[[:space:]]*:[[:space:]]*"dillweed-anthill/0\.1\.6"'; then
  ok "/health returns version='dillweed-anthill/0.1.6' (AAS-PRE-001)"
else
  fail "/health version field does not match VERSION constant"
fi

header "Pre-review-1: pagination parameter validation (AAS-PRE-002)"
# parseInt permissiveness — '10abc' previously parsed as 10
run_auth "limit=10abc rejected as malformed → 400"      "400" "$BASE/signals?limit=10abc"
run_auth "limit=foo rejected as non-numeric → 400"      "400" "$BASE/signals?limit=foo"
run_auth "offset=5xyz rejected as malformed → 400"      "400" "$BASE/signals?offset=5xyz"

header "Pre-review-1: pagination bounds (AAS-PRE-003)"
# Previously: limit=0 returned empty results vacuously; limit=999 worked silently above 500
run_auth "limit=0 rejected (below minimum)  → 400"      "400" "$BASE/signals?limit=0"
run_auth "limit=999 rejected (above maximum) → 400"     "400" "$BASE/signals?limit=999"
run_auth "limit=500 accepted (maximum boundary)"        "200" "$BASE/signals?limit=500"
run_auth "limit=1 accepted (minimum boundary)"          "200" "$BASE/signals?limit=1"
run_auth "offset=0 accepted explicitly"                 "200" "$BASE/signals?offset=0"

# Note: AAS-PRE-017 (DB/log nonce consistency for aggregator ANT-RA signals)
# requires reading the signals.log file and the database. The signal-log
# replay-protection tests above already exercise the nonce collision path;
# manual verification of DB/log nonce equivalence is deferred to the
# install-testing pass on dill-p-001 where filesystem inspection is direct.

# ══════════════════════════════════════════════════════════════════════════════
# ROUND-1 REVIEWER FIX REGRESSION TESTS (AS-001 through AS-014)
# ══════════════════════════════════════════════════════════════════════════════
# Tests for the 14 findings from the round-1 external review. Two findings
# (AS-001 storage fault, requires injecting a write failure; AS-013/014
# README wording, not behavioral) are documentation-only or fault-injection
# only and not exercisable from test.sh — those are verified by inspection.

header "Round-1: max_severity ranking (AS-002)"
# Submit a WARNING and a CRITICAL ANT-RA signal, then check /aggregate
# reports max_severity = CRITICAL (not WARNING per the broken lex sort).
# We use ANT-RA because its window is 60s — most likely to capture
# both signals together. Both come from the same node with strictly
# monotonic sequence to satisfy replay protection.
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s -X POST "$BASE/signal" \
  -H 'Content-Type: application/json' \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "{
    \"signal_class\":     \"ANT-RA\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"as002-warning-nonce-$(date +%s%N)\",
    \"node_sequence\":    9001,
    \"originating_node\": \"as002-node-A${NODE_SUFFIX}\",
    \"severity\":         \"WARNING\",
    \"signal_payload\":   {\"test\":\"as002 warning\"}
  }" > /dev/null
curl -s -X POST "$BASE/signal" \
  -H 'Content-Type: application/json' \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d "{
    \"signal_class\":     \"ANT-RA\",
    \"signal_timestamp\": \"$TS\",
    \"signal_nonce\":     \"as002-critical-nonce-$(date +%s%N)\",
    \"node_sequence\":    9002,
    \"originating_node\": \"as002-node-A${NODE_SUFFIX}\",
    \"severity\":         \"CRITICAL\",
    \"signal_payload\":   {\"test\":\"as002 critical\"}
  }" > /dev/null

AGG_BODY=$(curl -s "$BASE/aggregate")
# Round-2 (AS2-002 Option C): /aggregate response shape now includes
# event_time and received_time sub-objects. AS-002 fix is verified by
# checking max_severity in BOTH sub-objects — both should report CRITICAL
# because the two test signals were submitted with the current timestamp
# AND received together.
AS002_EVENT_MAX=$(echo "$AGG_BODY" | python3 -c '
import sys, json
data = json.load(sys.stdin)
print(data["windows"]["ANT-RA"]["event_time"]["max_severity"])
' 2>/dev/null)
AS002_RECVD_MAX=$(echo "$AGG_BODY" | python3 -c '
import sys, json
data = json.load(sys.stdin)
print(data["windows"]["ANT-RA"]["received_time"]["max_severity"])
' 2>/dev/null)
if [ "$AS002_EVENT_MAX" = "CRITICAL" ]; then
  ok "/aggregate event_time max_severity = CRITICAL (AS-002 fix; was WARNING under lex sort)"
else
  fail "/aggregate ANT-RA event_time max_severity = '$AS002_EVENT_MAX' (expected CRITICAL)"
fi
if [ "$AS002_RECVD_MAX" = "CRITICAL" ]; then
  ok "/aggregate received_time max_severity = CRITICAL (AS-002 fix applied symmetrically)"
else
  fail "/aggregate ANT-RA received_time max_severity = '$AS002_RECVD_MAX' (expected CRITICAL)"
fi

header "Round-1: timestamp calendar/clock validity (AS-003)"
# Each of these passes the v0.1.4 pre-fix regex but is structurally impossible.
TS_BASE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
run "feb-31 rejected (impossible date)        → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"2026-02-31T12:00:00Z\",\"signal_nonce\":\"as003-feb31-$(date +%s%N)\",\"node_sequence\":1,\"originating_node\":\"as003-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"test\":1}}"
run "month=99 rejected                        → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"2026-99-15T12:00:00Z\",\"signal_nonce\":\"as003-m99-$(date +%s%N)\",\"node_sequence\":2,\"originating_node\":\"as003-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"test\":2}}"
run "hour=24 rejected (clock overflow)        → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"2026-01-15T24:00:00Z\",\"signal_nonce\":\"as003-h24-$(date +%s%N)\",\"node_sequence\":3,\"originating_node\":\"as003-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"test\":3}}"
run "minute=60 rejected (clock overflow)      → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"2026-01-15T12:60:00Z\",\"signal_nonce\":\"as003-m60-$(date +%s%N)\",\"node_sequence\":4,\"originating_node\":\"as003-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"test\":4}}"

header "Round-1: strict metadata type validation (AS-004)"
# Each of these passes the v0.1.4 pre-fix truthy check but is malformed.
run "signal_nonce={bad:true} rejected         → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":{\"bad\":true},\"node_sequence\":1,\"originating_node\":\"as004-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":1}}"
run "originating_node=[array] rejected        → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":\"as004b-$(date +%s%N)\",\"node_sequence\":2,\"originating_node\":[\"node-a\"],\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":2}}"
run "capability_ref={bad:true} rejected       → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":\"as004c-$(date +%s%N)\",\"node_sequence\":3,\"originating_node\":\"as004-node${NODE_SUFFIX}\",\"capability_ref\":{\"bad\":true},\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":3}}"
run "node_signature=[array] rejected          → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":\"as004d-$(date +%s%N)\",\"node_sequence\":4,\"originating_node\":\"as004-node${NODE_SUFFIX}\",\"node_signature\":[\"sig\"],\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":4}}"

header "Round-1: Content-Type enforcement on POST /signal (AS-005)"
run "missing Content-Type rejected            → 400" "400" "$BASE/signal" \
    -X POST ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":\"as005a-$(date +%s%N)\",\"node_sequence\":1,\"originating_node\":\"as005-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":1}}"
run "Content-Type: text/plain rejected        → 400" "400" "$BASE/signal" \
    -X POST -H "Content-Type: text/plain" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":\"as005b-$(date +%s%N)\",\"node_sequence\":2,\"originating_node\":\"as005-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":2}}"
run "Content-Type: app/json; charset=utf-8 ok → 201" "201" "$BASE/signal" \
    -X POST -H "Content-Type: application/json; charset=utf-8" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":\"as005c-$(date +%s%N)\",\"node_sequence\":3,\"originating_node\":\"as005-node${NODE_SUFFIX}\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":3}}"

header "Round-1: request body size limit (AS-006)"
# 300 KB body exceeds the 256 KB MAX_REQUEST_BODY_BYTES limit; expect 413.
# Write to a tempfile to avoid shell argv-length limits with large payloads.
BIG_PAD=$(head -c 300000 /dev/zero | tr '\0' 'A')
BIG_BODY_FILE=$(mktemp)
printf '{"signal_class":"ANT-DN","signal_timestamp":"%s","signal_nonce":"as006-%s","node_sequence":1,"originating_node":"as006-node%s","severity":"INFORMATIONAL","signal_payload":{"x":"%s"}}' \
    "$TS_BASE" "$(date +%s%N)" "$NODE_SUFFIX" "$BIG_PAD" > "$BIG_BODY_FILE"
run "body > 256KB rejected                    → 413" "413" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "@$BIG_BODY_FILE"
rm -f "$BIG_BODY_FILE"

header "Round-1: reserved originating_node (AS-007)"
run "originating_node=ANTHILL_AGGREGATOR rej. → 422" "422" "$BASE/signal" \
    -X POST -H "Content-Type: application/json" ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{\"signal_class\":\"ANT-DN\",\"signal_timestamp\":\"$TS_BASE\",\"signal_nonce\":\"as007-$(date +%s%N)\",\"node_sequence\":1,\"originating_node\":\"ANTHILL_AGGREGATOR\",\"severity\":\"INFORMATIONAL\",\"signal_payload\":{\"x\":1}}"

# Note: AS-008 auth gating on /signals and /summary is only observable when
# ANTHILL_ADMIN_TOKEN is configured. In default test.sh run (open mode),
# /signals returns 200 — same as before. The auth posture is verified by
# the existing auth-enforcement section above when AUTH_HEADER is set.

header "Round-1: 405 Method Not Allowed (AS-009)"
run "GET /signal → 405 (path exists, GET wrong)"   "405" "$BASE/signal"
run "POST /health → 405 (path exists, POST wrong)" "405" "$BASE/health" -X POST -H "Content-Type: application/json" -d "{}"
run "POST /summary → 405"                          "405" "$BASE/summary" -X POST -H "Content-Type: application/json" -d "{}"
run "PUT /unknown → 404 (path unknown)"            "404" "$BASE/unknown" -X PUT -H "Content-Type: application/json" -d "{}"

header "Round-1: VALIDATION_FAILED has message field (AS-010)"
VAL_BODY=$(curl -s -X POST "$BASE/signal" \
  -H 'Content-Type: application/json' \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  -d '{}')
if echo "$VAL_BODY" | grep -q '"message"[[:space:]]*:[[:space:]]*"Signal failed validation\."'; then
  ok "VALIDATION_FAILED response includes 'message' field"
else
  fail "VALIDATION_FAILED response missing 'message' field"
fi

header "Round-1: offset upper bound (AS-011)"
run_auth "offset=1000000 accepted (boundary)        → 200" "200" "$BASE/signals?offset=1000000"
run_auth "offset=1000001 rejected (above cap)       → 400" "400" "$BASE/signals?offset=1000001"

# Note: AS-001 (storage fault), AS-012 (PORT validation), AS-013/014
# (README wording) are not exercised here:
#   AS-001: requires injecting a filesystem write failure (e.g. read-only
#           logs/ dir or filesystem-full); deferred to dill-p-001
#   AS-012: invoked at process startup, not via HTTP; verified by static
#           inspection (parsePort + try/catch on PORT init)
#   AS-013, AS-014: README wording, verified by inspection

# ══════════════════════════════════════════════════════════════════════════════
# ROUND-2 REVIEWER FIX REGRESSION TESTS (AS2-001 through AS2-004)
# ══════════════════════════════════════════════════════════════════════════════

header "Round-2: DB returns received_at field (AS2-001)"
# AS2-001: insertSignal now binds received_at explicitly so it matches the
# JSONL value. Full equivalence requires diffing against logs/signals.log;
# we verify the DB at least exposes received_at and it parses as RFC 3339
# UTC second-precision. Cross-store equivalence is verified on dill-p-001.
LIST_BODY=$(curl -s ${TOKEN:+-H "Authorization: Bearer $TOKEN"} "$BASE/signals?limit=1")
if echo "$LIST_BODY" | grep -qE '"received_at"[[:space:]]*:[[:space:]]*"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z"'; then
  ok "DB-stored received_at is RFC 3339 UTC second-precision"
else
  fail "DB-stored received_at missing or not RFC 3339 second-precision"
  echo "    Body excerpt: $(echo "$LIST_BODY" | head -c 400)"
fi

header "Round-2: dual-window aggregation divergence (AS2-002 Option C)"
# Submit an ANT-RC signal with signal_timestamp 2 HOURS in the past while
# Anthill receives it now. The 1h ANT-RC window should exclude it under
# event_time semantics (2h > 1h) but include it under received_time
# semantics (just received). The divergence is the diagnostic value of
# returning both views.
TS_BACKDATED=$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-2H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
if [ -z "$TS_BACKDATED" ]; then
  # macOS/Linux date flag fallback already attempted; skip if neither worked
  fail "(setup) could not compute backdated timestamp for AS2-002 test"
else
  curl -s -X POST "$BASE/signal" \
    -H 'Content-Type: application/json' \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    -d "{
      \"signal_class\":     \"ANT-RC\",
      \"signal_timestamp\": \"$TS_BACKDATED\",
      \"signal_nonce\":     \"as2-002-backdated-$(date +%s%N)\",
      \"node_sequence\":    5001,
      \"originating_node\": \"as2-002-backdated-node${NODE_SUFFIX}\",
      \"severity\":         \"WARNING\",
      \"signal_payload\":   {\"test\":\"backdated 2h\"}
    }" > /dev/null

  AGG_BODY=$(curl -s "$BASE/aggregate")
  # Event-time total for ANT-RC: should NOT include our backdated signal
  # (2h > 1h window). Received-time total: SHOULD include it (just received).
  # We can't easily isolate just our signal, but received_time.total ≥
  # event_time.total + 1 (assuming no other test signals arrived in the
  # 1h-event-time window with received_time also in the 1h-received-time
  # window — true here because our backdated signal is the only one
  # diverging).
  AS2_002_EVT_TOTAL=$(echo "$AGG_BODY" | python3 -c '
import sys, json
data = json.load(sys.stdin)
print(data["windows"]["ANT-RC"]["event_time"]["total"])
' 2>/dev/null)
  AS2_002_RCV_TOTAL=$(echo "$AGG_BODY" | python3 -c '
import sys, json
data = json.load(sys.stdin)
print(data["windows"]["ANT-RC"]["received_time"]["total"])
' 2>/dev/null)
  if [ -n "$AS2_002_EVT_TOTAL" ] && [ -n "$AS2_002_RCV_TOTAL" ] && [ "$AS2_002_RCV_TOTAL" -gt "$AS2_002_EVT_TOTAL" ]; then
    ok "ANT-RC received_time.total ($AS2_002_RCV_TOTAL) > event_time.total ($AS2_002_EVT_TOTAL) — backdated signal correctly outside event-time window, inside received-time window"
  else
    fail "Expected received_time.total > event_time.total for ANT-RC; got received=$AS2_002_RCV_TOTAL event=$AS2_002_EVT_TOTAL"
  fi
fi

# AS2-002: /aggregate window basis decision — pending Richard's decision.
# AS2-003: This fix is itself test-infrastructure (AUTH_HEADER + run_auth on
#          /signals and /summary); validated by the suite running cleanly in
#          both open-mode and token-mode (TOKEN set in environment).
# AS2-004: signal_nonce framing — documentation in README, no behavioral
#          change.

# ── Per-IP rate limiting (W0 / v2 design §4.2.2) ──────────────────────────────
# Reads (/signals, /aggregate, /summary) and the ingestion write (POST /signal)
# draw from separate per-IP budgets; exceeding one yields 429 + Retry-After.
# /health is exempt. Burst sizes self-calibrate from the limits in /health.
header "Per-IP rate limiting (429 + Retry-After)  [v2 §4.2.2]"
rl_num() { grep -o "\"$1\"[[:space:]]*:[[:space:]]*[0-9]*" | grep -o '[0-9]*$' | head -1; }

RL_ENABLED=$(curl -s "$BASE/health" | grep -o '"enabled"[[:space:]]*:[[:space:]]*\(true\|false\)' | grep -o 'true\|false' | head -1)
READ_MAX=$(curl -s "$BASE/health" | rl_num read_max)
WRITE_MAX=$(curl -s "$BASE/health" | rl_num write_max)

if [ "$RL_ENABLED" != "true" ]; then
  ok "rate limiting reported disabled — 429 assertions skipped"
else
  # Read budget (GET /signals).
  R429=$(seq 1 $((READ_MAX + 15)) | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" "$BASE/signals" | grep -c '^429$')
  if [ "$R429" -ge 1 ]; then
    ok "read burst over budget → ${R429}×429 (read_max=$READ_MAX)"
  else
    fail "read burst should produce ≥1 429 (read_max=$READ_MAX, got $R429)"
  fi

  RA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/signals")
  RA=$(curl -s -o /dev/null -D - "$BASE/signals" | grep -i '^retry-after:' | tr -d '\r' | awk '{print $2}')
  if [ "$RA_STATUS" = "429" ] && [ -n "$RA" ]; then
    ok "429 response carries Retry-After (${RA}s)"
  else
    fail "saturated read expected 429 + Retry-After (status=$RA_STATUS, retry-after=$RA)"
  fi

  # Ingestion write budget (POST /signal). The limiter runs before auth/validation,
  # so an invalid/unauthenticated body still counts — no signal is actually stored.
  W429=$(seq 1 $((WRITE_MAX + 15)) | xargs -P 50 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
           -X POST -H "Content-Type: application/json" -d '{"bad":"body"}' "$BASE/signal" | grep -c '^429$')
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

# ── Results ───────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo "  Results:  $PASS passed  /  $FAIL failed"
echo "─────────────────────────────────────────"
echo ""
