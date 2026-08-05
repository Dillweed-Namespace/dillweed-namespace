# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-10
**Session:** Second sweep of the day (r2)
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

One finding: the operations runbook's Section 6.5 clean-install procedure
references `dillweed-anthill-v0.1.5.tar.gz` (with the v0.1.5 SHA) but the
v1.0.0 GitHub Release now carries only `dillweed-anthill-v0.1.6.tar.gz`.
An operator following that procedure would attempt to verify a tarball that
is no longer in the release. All other surfaces are consistent: all eight
specs now match between repo and dillweed.com (FINDING-1 from the earlier
2026-06-10 sweep is resolved — namespace-standard.html v0.4.4 was published
between the two sessions), all three service versions and component SHAs
check out, the trust-root PEM SHA is correct, all three services are healthy
with expected configuration, and all nine steward capabilities resolve with
`sig_valid` and `sig_verified`.

---

## Boundary Enforcement Summary

All nine steward capabilities checked against `enforce-boundary.sh` before
execution. All returned `ALLOWED` (Exit 0) or `APPROVAL NEEDED` (Exit 2).
None refused or failed DillClaw verification.

| Capability | Boundary result | DillClaw |
|---|---|---|
| review.spec.read | ALLOWED (Exit 0) | sig_valid, sig_verified |
| review.website.fetch | ALLOWED (Exit 0) | sig_valid, sig_verified |
| review.repo.read | ALLOWED (Exit 0) | sig_valid, sig_verified |
| review.release.verify | ALLOWED (Exit 0) | sig_valid, sig_verified |
| review.report.write | ALLOWED (Exit 0) | sig_valid, sig_verified |
| review.issue.suggest | ALLOWED (Exit 0) | sig_valid, sig_verified |
| review.issue.open | APPROVAL NEEDED (Exit 2) | sig_valid, sig_verified |
| review.patch.propose | ALLOWED (Exit 0) | sig_valid, sig_verified |
| ledger.update.propose | APPROVAL NEEDED (Exit 2) | sig_valid, sig_verified |

---

## Step Results

### Step 1 — Spec drift detection
**Capability:** `review.spec.read` + `review.website.fetch` — **ALLOWED**
**Status:** PASS

Compared all eight spec documents between local repo and dillweed.com.
All match. Notably, **namespace-standard.html is now v0.4.4 on dillweed.com**,
resolving FINDING-1 from the earlier 2026-06-10 report (which found the local
repo at v0.4.4 while the site still served v0.4.3). The spec was published
between the two sweeps today.

| Document | Local version | Published version | Match? |
|---|---|---|---|
| namespace-standard.html | v0.4.4 | v0.4.4 | yes |
| registry-spec.html | v0.1.5 | v0.1.5 | yes |
| dillclaw-spec.html | v0.1.7 | v0.1.7 | yes |
| anthill-spec.html | v0.1.3 | v0.1.3 | yes |
| standards-overview.html | v1.0.10 | v1.0.10 | yes |
| governance.html | v1.1.3 | v1.1.3 | yes |
| continuity-protocol.html | GSP-01 v1.0.3 | GSP-01 v1.0.3 | yes |
| dnso-operations-charter.html | v1.0.3 | v1.0.3 | yes |

---

### Step 2 — Version consistency
**Capability:** `review.repo.read` — **ALLOWED**
**Status:** FINDING

Top-level version references in README, release notes, and the runbook
deployment inventory all agree on v0.2.8 / v0.1.8 / v0.1.6.

| Document | Registry | Resolver | Anthill |
|---|---|---|---|
| README.md | v0.2.8 ✓ | v0.1.8 ✓ | v0.1.6 ✓ |
| docs/release-notes/v1.0.0-release-notes.md | v0.2.8 ✓ | v0.1.8 ✓ | v0.1.6 ✓ |
| docs/operations-runbook.md (Section 2 inventory, line 45) | v0.2.8 ✓ | v0.1.8 ✓ | v0.1.6 ✓ |
| PROJECT_LEDGER.md (header inventory) | v0.2.8 ✓ | v0.1.8 ✓ | v0.1.6 ✓ |

**FINDING — Runbook Section 6.5 stale Anthill tarball reference:**
`docs/operations-runbook.md` Section 6.5 "Extract and run the new installers"
contains the following:

```
# lines 536–537
shasum -a 256 dillweed-anthill-v0.1.5.tar.gz
# Expected: dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b

# line 547
tar -xzf dillweed-anthill-v0.1.5.tar.gz
```

The v1.0.0 GitHub Release carries **no** `dillweed-anthill-v0.1.5.tar.gz`
asset. The Anthill asset in the release is `dillweed-anthill-v0.1.6.tar.gz`
(SHA `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36`,
uploaded 2026-06-06). An operator following the runbook clean-install
procedure would find the v0.1.5 tarball missing and receive an incorrect
SHA to verify against.

The Section 2 deployment inventory table was updated to v0.1.6 in the
2026-05-25 reconciliation; Section 6.5 was not updated at that time.

---

### Step 3 — SHA verification
**Capability:** `review.release.verify` — **ALLOWED**
**Status:** PASS

All three tarball SHAs match across README, release notes, and GitHub
Release v1.0.0 asset digests.

| Component | Expected SHA256 | GitHub asset digest | Match? |
|---|---|---|---|
| Registry v0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | yes |
| Resolver v0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | yes |
| Anthill v0.1.6 | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | yes |

---

### Step 4 — Trust root verification
**Capability:** `review.website.fetch` — **ALLOWED**
**Status:** PASS

Live fetch of `https://dillweed.com/dnso_public.pem`:

```
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33  -
```

Canonical value per CLAUDE.md, README.md, and v1.0.0 release notes:
```
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

Match confirmed.

---

### Step 5 — Deployment health check
**Capability:** `review.repo.read` — **ALLOWED**
**Status:** PASS

**Registry** — `http://localhost:9475/health`
```json
{
  "status": "ok",
  "registry_version": "dillweed-registry/0.2.8",
  "capabilities": 27,
  "signing": "Ed25519 (DNSO)",
  "uptime_seconds": 607,
  "timestamp": "2026-06-10T11:20:01Z"
}
```
Version v0.2.8 ✓, status ok ✓.

**Resolver (DillClaw)** — `http://localhost:9474/health`
```json
{
  "status": "ok",
  "registry": { "source": "remote", "mode": "ok", "records": 27 },
  "dnso_key": { "configured": true, "algorithm": "ed25519" },
  "resolver_version": "dillclaw/0.1.8",
  "uptime_seconds": 607,
  "timestamp": "2026-06-10T11:20:01Z"
}
```
Version v0.1.8 ✓, `registry.source: "remote"` ✓, `dnso_key.configured: true` ✓, status ok ✓.

**Anthill** — `http://localhost:9476/health`
```json
{
  "status": "ok",
  "service": "dillweed-anthill",
  "version": "dillweed-anthill/0.1.6",
  "signals_received": 117,
  "auth": "token required",
  "spec": "https://dillweed.com/anthill-spec.html"
}
```
Version v0.1.6 ✓, status ok ✓.

All three services healthy with expected configuration.

---

### Step 6 — Capability resolution verification
**Capability:** `review.release.verify` — **ALLOWED**
**Status:** PASS

All nine steward capabilities resolved through DillClaw (verify-capability.sh,
port 9474). All nine returned `sig_valid` and `sig_verified`.

| Capability | Trust Score | Trust signals |
|---|---|---|
| dillweed://review.spec.read | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://review.repo.read | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://review.website.fetch | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://review.release.verify | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://review.report.write | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://review.issue.suggest | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://review.issue.open | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://review.patch.propose | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| dillweed://ledger.update.propose | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |

`endpoint_unchecked` is expected for steward agent capabilities (endpoints
are localhost-internal and not reachable by the health-probe path).

---

### Step 7 — Write report
**Capability:** `review.report.write` — **ALLOWED**
**Status:** PASS

This file.

---

### Step 8 — Issue suggestions
**Capability:** `review.issue.suggest` — **ALLOWED** (presented below)
**Capability:** `review.issue.open` — **APPROVAL NEEDED** (awaiting steward)

One finding warrants a suggested issue. See **Suggested Issues** section.

---

### Step 9 — Ledger entry proposal
**Capability:** `ledger.update.propose` — **APPROVAL NEEDED** (awaiting steward)

See **Proposed Ledger Entry** section.

---

## Findings

### FINDING-1 — Runbook Section 6.5 stale Anthill tarball reference

**Severity:** LOW (documentation error — no runtime or trust-chain impact,
but an operator doing a clean install from the runbook would encounter a
missing tarball and an incorrect SHA)

**Location:** `docs/operations-runbook.md`, Section 6.5, lines 536–537 and 547

**Current (stale) content:**
```
shasum -a 256 dillweed-anthill-v0.1.5.tar.gz
# Expected: dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b
...
tar -xzf dillweed-anthill-v0.1.5.tar.gz
```

**Should be:**
```
shasum -a 256 dillweed-anthill-v0.1.6.tar.gz
# Expected: 3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36
...
tar -xzf dillweed-anthill-v0.1.6.tar.gz
```

**Context:** Anthill was bumped to v0.1.6 (commits 7a553f1, da6ab0c) after the
initial v1.0.0 publication. The v1.0.0 GitHub Release was updated to replace the
v0.1.5 Anthill tarball with v0.1.6 (uploaded 2026-06-06). The runbook Section 2
deployment inventory table was updated to v0.1.6 during the 2026-05-25
reconciliation, but Section 6.5 was not updated at that time. There is no
`dillweed-anthill-v0.1.5.tar.gz` asset in the current GitHub Release.

---

## Suggested Issues

### Issue — Fix Runbook Section 6.5 stale Anthill tarball reference

**Title:** `Fix operations-runbook.md Section 6.5: Anthill tarball still references v0.1.5`

**Body:**
```
## Summary

`docs/operations-runbook.md` Section 6.5 "Extract and run the new
installers" still references `dillweed-anthill-v0.1.5.tar.gz` and the
v0.1.5 SHA. The v1.0.0 GitHub Release no longer contains a v0.1.5 Anthill
tarball — the current asset is `dillweed-anthill-v0.1.6.tar.gz`.

An operator following the clean-install procedure would be directed to
verify a tarball that does not exist in the release.

## Lines affected

`docs/operations-runbook.md`, Section 6.5 (approximately lines 536–537, 547):

**Current (stale):**
```
shasum -a 256 dillweed-anthill-v0.1.5.tar.gz
# Expected: dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b
...
tar -xzf dillweed-anthill-v0.1.5.tar.gz
```

**Correct:**
```
shasum -a 256 dillweed-anthill-v0.1.6.tar.gz
# Expected: 3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36
...
tar -xzf dillweed-anthill-v0.1.6.tar.gz
```

## Context

Anthill v0.1.6 was shipped post-v1.0.0 publication (commits 7a553f1, da6ab0c).
The Section 2 deployment inventory table was updated to v0.1.6 during the
2026-05-25 reconciliation, but Section 6.5 was not updated at that time.

**Detected by:** Dillweed Protocol Steward Agent — steward-report-2026-06-10-r2.md
```

**Labels:** `documentation`, `runbook`, `low`

---

## Proposed Ledger Entry

*(Requires human approval before adding to PROJECT_LEDGER.md —
`ledger.update.propose`, Exit 2)*

```markdown
### Steward sweep — 2026-06-10 (second)

- **Type:** Automated consistency sweep
- **Agent:** dillweed.protocol-steward (review-and-recommend mode)
- **Result:** 1 FINDING, 8 PASS, 0 BLOCKED

**Summary of checks:**
- Spec drift (Step 1): All 8 specs identical. PASS. Notably,
  namespace-standard.html v0.4.4 is now live on dillweed.com — resolving
  FINDING-1 from the earlier 2026-06-10 sweep (first session).
- Version consistency (Step 2): FINDING — `docs/operations-runbook.md`
  Section 6.5 clean-install procedure references `dillweed-anthill-v0.1.5.tar.gz`
  and the v0.1.5 SHA. The v1.0.0 GitHub Release carries only the v0.1.6 tarball.
  Section 2 inventory table correctly shows v0.1.6; Section 6.5 was not updated
  in the 2026-05-25 reconciliation.
- SHA verification (Step 3): All three component SHAs match GitHub Release
  asset digests. PASS.
- Trust root (Step 4): Unchanged. PASS.
- Deployment health (Step 5): All three services healthy (uptime ~607 s from
  last restart). Registry 0.2.8, Resolver 0.1.8 (registry.source: remote,
  dnso_key.configured: true), Anthill 0.1.6. PASS.
- Capability resolution (Step 6): All 9 steward capabilities sig_valid +
  sig_verified. Trust score 0.59. PASS.

**Report:** `~/Dillweed-Agent/reports/steward-report-2026-06-10-r2.md`
**Suggested issue:** Fix runbook Section 6.5 stale Anthill tarball reference
(awaiting steward approval to open)
```
