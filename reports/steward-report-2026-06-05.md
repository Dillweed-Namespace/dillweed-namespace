# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-05
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

The 2026-06-05 consistency sweep is largely clean, consistent with the 2026-06-02 sweep. All eight specification documents remain byte-for-byte identical between dillweed.com and the local repository. The trust root is unchanged. All three services are healthy with 997,393 seconds (~11.5 days) continuous uptime. All nine steward capabilities resolve with `sig_valid` and `sig_verified`. One finding from the previous sweep persists: Anthill v0.1.6 is running on the deployment and reflected in the operations runbook, but README.md, the v1.0.0 release notes, and PROJECT_LEDGER.md still reference Anthill v0.1.5, and no v0.1.6 tarball has been published to the GitHub Release. Issue #1 tracking this finding was opened on 2026-06-02 and remains open. No new findings.

One informational observation: the Anthill `signals_received` counter is unchanged at 117 between the 2026-06-02 and 2026-06-05 sweeps (3+ days). This likely reflects that no instrumented Resolvers are currently configured to submit signals rather than a service fault — the service itself is healthy — but is noted for completeness.

## Step Results

### Step 1 — Spec drift detection
**Status:** PASS
**Capability:** `review.spec.read` + `review.website.fetch` (both ALLOWED, DillClaw verified)

All eight specification documents are identical between `https://dillweed.com` and `~/dillweed-namespace-repo/specs/`:

| Spec file | Result |
|---|---|
| anthill-spec.html | IDENTICAL |
| continuity-protocol.html | IDENTICAL |
| dillclaw-spec.html | IDENTICAL |
| dnso-operations-charter.html | IDENTICAL |
| governance.html | IDENTICAL |
| namespace-standard.html | IDENTICAL |
| registry-spec.html | IDENTICAL |
| standards-overview.html | IDENTICAL |

No divergence from the 2026-06-02 sweep.

---

### Step 2 — Version consistency
**Status:** FINDING (persistent from 2026-06-02)
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)

Expected versions per protocol: Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.6.

| Document | Registry | Resolver | Anthill |
|---|---|---|---|
| README.md | 0.2.8 ✅ | 0.1.8 ✅ | **0.1.5** ❌ |
| v1.0.0-release-notes.md | 0.2.8 ✅ | 0.1.8 ✅ | **0.1.5** ❌ |
| operations-runbook.md | 0.2.8 ✅ | 0.1.8 ✅ | 0.1.6 ✅ |
| PROJECT_LEDGER.md | — | — | **0.1.5** (last recorded release) ❌ |

Unchanged from the 2026-06-02 sweep. No v0.1.6 Anthill tarball has been published to the GitHub Release. Issue #1 is open and tracking this.

**See Finding 1.**

---

### Step 3 — SHA verification
**Status:** PASS
**Capability:** `review.release.verify` (ALLOWED, DillClaw verified)

All SHA256 values are consistent across README.md, v1.0.0-release-notes.md, and the GitHub Release body and assets. Unchanged from the 2026-06-02 sweep.

| Component | SHA256 | README | Release notes | GitHub Release |
|---|---|---|---|---|
| Registry v0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | ✅ | ✅ | ✅ |
| Resolver v0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | ✅ | ✅ | ✅ |
| Anthill v0.1.5 | `dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b` | ✅ | ✅ | ✅ |

Note: no v0.1.6 Anthill tarball exists. The SHA check is consistent with the v0.1.5 release artifacts, which are all internally coherent.

---

### Step 4 — Trust root verification
**Status:** PASS
**Capability:** `review.website.fetch` (ALLOWED, DillClaw verified)

| Location | SHA256 | Result |
|---|---|---|
| `https://dillweed.com/dnso_public.pem` (live) | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |
| Registry keystore | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |
| Resolver keystore | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |

Unchanged from the 2026-06-02 sweep. Trust root is stable.

---

### Step 5 — Deployment health check
**Status:** PASS
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)
**Timestamp:** 2026-06-06T01:22:20Z

| Service | Port | status | Version | Notes |
|---|---|---|---|---|
| DillClaw Resolver | 9474 | ok ✅ | dillclaw/0.1.8 | registry.source=remote ✅, dnso_key.configured=true ✅ |
| Dillweed Registry | 9475 | ok ✅ | dillweed-registry/0.2.8 | 16 capabilities, deployment_mode=authoritative |
| Dillweed Anthill | 9476 | ok ✅ | dillweed-anthill/0.1.6 | signals_received=117 (see note), auth=token required |

**Uptime:** 997,393s (~11.5 days continuous).

**Informational — Anthill signal count unchanged:** `signals_received` is 117 in this sweep, identical to the 2026-06-02 sweep. This indicates no new signals were submitted to the Anthill during the intervening 3+ days. The service is healthy; the absence of new signals likely reflects that no instrumented Resolvers are currently configured to submit signals to this Anthill instance. Not a service fault, but noted as an operational observation.

---

### Step 6 — Capability resolution verification
**Status:** PASS
**Capability:** `review.release.verify` (ALLOWED, DillClaw verified)

All nine steward capabilities resolved through DillClaw with both required trust signals present. Trust scores increased marginally from 0.595 (2026-06-02) to 0.596, consistent with normal scoring variation.

| Capability | sig_valid | sig_verified | trust_score |
|---|---|---|---|
| dillweed://review.spec.read | ✅ | ✅ | 0.596 |
| dillweed://review.repo.read | ✅ | ✅ | 0.596 |
| dillweed://review.website.fetch | ✅ | ✅ | 0.596 |
| dillweed://review.release.verify | ✅ | ✅ | 0.596 |
| dillweed://review.report.write | ✅ | ✅ | 0.596 |
| dillweed://review.issue.suggest | ✅ | ✅ | 0.596 |
| dillweed://review.issue.open | ✅ | ✅ | 0.596 |
| dillweed://review.patch.propose | ✅ | ✅ | 0.596 |
| dillweed://ledger.update.propose | ✅ | ✅ | 0.596 |

---

### Step 7 — Write report
**Status:** PASS
**Capability:** `review.report.write` (ALLOWED, DillClaw verified)

This document. Written to `~/Dillweed-Agent/reports/steward-report-2026-06-05.md`.

---

## Findings

### Finding 1 — Anthill version drift (Persistent — first raised 2026-06-02)

**Severity:** Low
**Tracking:** GitHub Issue #1 — https://github.com/Dillweed-Namespace/dillweed-namespace/issues/1

The Anthill deployment reports v0.1.6. README.md, v1.0.0-release-notes.md, and PROJECT_LEDGER.md continue to reference v0.1.5. No v0.1.6 tarball has been published to the GitHub Release. The operations runbook correctly reflects v0.1.6.

No change from the 2026-06-02 sweep. Issue #1 is open and tracking the required remediation (update README, release notes, PROJECT_LEDGER, and publish a v0.1.6 tarball or document the in-place upgrade explicitly).

---

## Suggested Issues

No new issues to suggest. Finding 1 is already tracked under Issue #1. Issues #2 (hardening), #3 (evaluation readiness), and #4 (v2 architecture) were opened on 2026-06-05 and are not findings from this sweep.

---

## Proposed Ledger Entry

*(Drafted under `ledger.update.propose` — APPROVAL REQUIRED per boundary policy.)*

```markdown
### Steward sweep — 2026-06-05

- **Type:** Automated consistency sweep
- **Agent:** dillweed.protocol-steward (review-and-recommend mode)
- **Result:** 1 FINDING (persistent), 8 PASS, 0 BLOCKED

**Summary of checks:**
- Spec drift (Step 1): All 8 specs identical between dillweed.com and repo. PASS.
- Version consistency (Step 2): FINDING (persistent) — Anthill v0.1.5 in README,
  release notes, and ledger; deployment and runbook report v0.1.6. Issue #1 open.
- SHA verification (Step 3): All three tarball SHAs consistent. PASS.
- Trust root (Step 4): dnso_public.pem SHA matches canonical value. PASS.
- Deployment health (Step 5): All three services healthy. Uptime ~11.5 days. PASS.
  Informational: Anthill signals_received=117 unchanged since 2026-06-02 sweep.
- Capability resolution (Step 6): All 9 steward capabilities sig_valid + sig_verified.
  Trust score 0.596. PASS.

**Finding:** Anthill version drift persists (Issue #1, opened 2026-06-02, still open).
No new findings. Issues #2, #3, #4 opened on 2026-06-05 (pre-drafted by steward).

**Report:** `~/Dillweed-Agent/reports/steward-report-2026-06-05.md`
```
