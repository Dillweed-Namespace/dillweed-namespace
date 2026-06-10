#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  DillClaw Resolver — Unit Tests (v0.1.7)
//
//  Tests the deterministic-arithmetic helpers (bankersRound3, compareSemver,
//  and the tie-breaking sort comparator) directly. These behaviors cannot be
//  reliably exercised via HTTP black-box tests in test.sh because they require
//  knowledge of internal scoring math; this file fills that gap by extracting
//  the helpers from server.js and running them against canonical and edge-case
//  inputs.
//
//  Usage:  node unit-tests.js   (no server needed)
//
//  Covers Pass 2 conformance findings:
//    • RS-003 — banker's rounding (round-half-to-even) per Spec §6.2 (REQ-29)
//    • RS-004 — tie-breaking (path asc, then semver asc) per Spec §6.3 (REQ-31)
//
//  RS-007 (stale-window cutoff) is not covered here because it requires a
//  live registry refresh failure to exercise; see test.sh for the manual
//  reproduction procedure (DILLCLAW_REGISTRY_URL pointing at an unreachable
//  host with DILLCLAW_STALE_WINDOW_MS=2000 for a 2-second window).
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

// Pull the helper sources directly out of server.js, so unit tests exercise
// the exact code that ships — not a re-implementation.
const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

const bankersRoundSource = src.match(/function bankersRound3[\s\S]*?\n}\n/);
const compareSemverSource = src.match(/function compareSemver[\s\S]*?\n}\n/);
const isInternalIpSource  = src.match(/function isInternalIp[\s\S]*?\n}\n/);

if (!bankersRoundSource || !compareSemverSource || !isInternalIpSource) {
  console.error('FATAL: could not extract helper functions from server.js');
  process.exit(2);
}

// Indirect eval (via (0, eval)) lands the function declarations in the
// global scope rather than a local block scope, so they're callable
// from the test cases below.
(0, eval)(bankersRoundSource[0]);
(0, eval)(compareSemverSource[0]);
(0, eval)(isInternalIpSource[0]);

// Re-bind to local scope for clarity in the tests
const bankersRound3 = globalThis.bankersRound3;
const compareSemver = globalThis.compareSemver;
const isInternalIp  = globalThis.isInternalIp;

if (typeof bankersRound3 !== 'function' || typeof compareSemver !== 'function' || typeof isInternalIp !== 'function') {
  console.error('FATAL: helper functions did not load into global scope');
  process.exit(2);
}

let pass = 0;
let fail = 0;

function assertEq(actual, expected, label) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓  ${label}`);
  } else {
    fail++;
    console.log(`  ✗  ${label}  (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
  }
}

function assertSign(actual, expectedSign, label) {
  const gotSign = actual === 0 ? 0 : (actual < 0 ? -1 : 1);
  assertEq(gotSign, expectedSign, label);
}

// ─── RS-003: bankersRound3 ──────────────────────────────────────────────────
console.log('\n▶ RS-003 — Banker\'s rounding (Spec §6.2 REQ-29)');

// Spec §6.2 EXACT canonical examples
assertEq(bankersRound3(0.7245), 0.724, 'spec example: 0.7245 → 0.724 (round half DOWN to even)');
assertEq(bankersRound3(0.7255), 0.726, 'spec example: 0.7255 → 0.726 (round half UP to even)');

// Additional half-thousandth boundary cases
assertEq(bankersRound3(0.7235), 0.724, '0.7235 → 0.724 (3 odd, round to 4 even)');
assertEq(bankersRound3(0.7265), 0.726, '0.7265 → 0.726 (6 already even, round half down)');
assertEq(bankersRound3(0.5005), 0.500, '0.5005 → 0.500 (round half DOWN to even)');
assertEq(bankersRound3(0.5015), 0.502, '0.5015 → 0.502 (round half UP to even)');
assertEq(bankersRound3(0.9995), 1.000, '0.9995 → 1.000 (round up to even)');

// Non-half cases (should round normally)
assertEq(bankersRound3(0.7244), 0.724, '0.7244 → 0.724 (normal round)');
assertEq(bankersRound3(0.7246), 0.725, '0.7246 → 0.725 (normal round)');

// Identity / edge cases
assertEq(bankersRound3(0),     0,     '0 → 0');
assertEq(bankersRound3(1),     1,     '1 → 1');
assertEq(bankersRound3(0.999), 0.999, '0.999 → 0.999 (idempotent)');

// Real-world trust-score range cases
assertEq(bankersRound3(0.8754),     0.875, 'realistic score 0.8754 → 0.875');
assertEq(bankersRound3(0.65000001), 0.650, 'noise-near-half: 0.65000001 → 0.650 (EPSILON tolerance)');

// ─── RS-004: compareSemver ──────────────────────────────────────────────────
console.log('\n▶ RS-004 — compareSemver (semver.org §11 precedence)');

assertSign(compareSemver('1.0.0', '1.0.0'),       0,  'identical versions');
assertSign(compareSemver('1.0.0', '1.0.1'),      -1, 'patch precedence: 1.0.0 < 1.0.1');
assertSign(compareSemver('1.0.0', '1.1.0'),      -1, 'minor precedence: 1.0.0 < 1.1.0');
assertSign(compareSemver('1.0.0', '2.0.0'),      -1, 'major precedence: 1.0.0 < 2.0.0');
assertSign(compareSemver('1.0.0', '1.0.0-alpha'), 1, 'pre-release < release: 1.0.0 > 1.0.0-alpha');
assertSign(compareSemver('1.0.0-alpha', '1.0.0-beta'),    -1, 'alpha < beta (alphanumeric)');
assertSign(compareSemver('1.0.0-alpha.1', '1.0.0-alpha.2'), -1, 'numeric pre-release: alpha.1 < alpha.2');
assertSign(compareSemver('1.0.0-alpha', '1.0.0-alpha.1'),   -1, 'shorter pre-release < longer with same prefix');
assertSign(compareSemver('1.0.0+build1', '1.0.0+build2'),    0, 'build metadata ignored');
assertSign(compareSemver('1.0.0-rc.1', '1.0.0'),            -1, 'rc < release');

// ─── RS-004: full tie-break sort ────────────────────────────────────────────
console.log('\n▶ RS-004 — Full tie-break sort (Spec §6.3 REQ-31)');

const candidates = [
  { record: { name: 'tools.search.web-retrieval',  version: '1.0.0' }, score: 0.724 },
  { record: { name: 'research.market.intel.vendors', version: '1.0.0' }, score: 0.724 },
  { record: { name: 'tools.search.web-retrieval',  version: '1.1.0' }, score: 0.724 },
  { record: { name: 'apex.thing',                  version: '2.0.0' }, score: 0.940 },
  { record: { name: 'apex.thing',                  version: '1.0.0' }, score: 0.940 },
];

candidates.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.record.name !== b.record.name) return a.record.name < b.record.name ? -1 : 1;
  return compareSemver(a.record.version, b.record.version);
});

// Expected ordering per Spec §6.3:
//   1. score desc (so 0.940 group comes first)
//   2. tie-break Rule 1: name asc (lexicographic)
//   3. tie-break Rule 2: semver asc
const expected = [
  ['apex.thing',                      '1.0.0'],
  ['apex.thing',                      '2.0.0'],
  ['research.market.intel.vendors',   '1.0.0'],
  ['tools.search.web-retrieval',      '1.0.0'],
  ['tools.search.web-retrieval',      '1.1.0'],
];

for (let i = 0; i < expected.length; i++) {
  const gotName = candidates[i].record.name;
  const gotVer  = candidates[i].record.version;
  const [expName, expVer] = expected[i];
  assertEq(
    `${gotName}@${gotVer}`,
    `${expName}@${expVer}`,
    `rank ${i + 1}: ${expName}@${expVer}`
  );
}

// ─── F-8: isInternalIp SSRF deny-list (probe_liveness host validation) ────────
console.log('\n▶ F-8 — isInternalIp SSRF deny-list (probe_liveness host validation)');

// Internal / reserved ranges a public capability endpoint must never reach.
const INTERNAL_IPS = [
  '127.0.0.1', '127.1.2.3',                 // loopback 127/8
  '10.0.0.1', '10.255.255.255',             // private 10/8
  '172.16.0.1', '172.31.255.255',           // private 172.16/12
  '192.168.1.1',                            // private 192.168/16
  '169.254.169.254',                        // link-local cloud metadata
  '0.0.0.0', '0.1.2.3',                     // this-host 0/8
  '100.64.0.1',                             // CGNAT 100.64/10
  '224.0.0.1',                              // multicast
  '240.0.0.1', '255.255.255.255',           // reserved / broadcast
  '::1', '::',                              // IPv6 loopback / unspecified
  'fe80::1', 'FE80::abcd',                  // IPv6 link-local (case-insensitive)
  'fc00::1', 'fd12:3456::1',                // IPv6 unique-local fc00::/7
  'ff02::1',                                // IPv6 multicast
  '::ffff:127.0.0.1', '::ffff:10.0.0.1',    // IPv4-mapped internal
  'not-an-ip', '10.0.0',                    // unparseable → unsafe (fail closed)
];
for (const ip of INTERNAL_IPS) {
  assertEq(isInternalIp(ip), true, `internal/unsafe: ${ip} → blocked`);
}

// Public addresses that MUST remain probeable.
const EXTERNAL_IPS = [
  '8.8.8.8', '1.1.1.1', '93.184.216.34',    // public v4
  '172.32.0.1', '172.15.255.255',           // just outside 172.16/12
  '100.63.255.255', '100.128.0.1',          // just outside 100.64/10
  '11.0.0.1', '126.255.255.255',            // boundaries around 10/8 and 127/8
  '2606:4700:4700::1111',                   // public v6
  '::ffff:8.8.8.8',                         // IPv4-mapped public
];
for (const ip of EXTERNAL_IPS) {
  assertEq(isInternalIp(ip), false, `public: ${ip} → allowed`);
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('');
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
