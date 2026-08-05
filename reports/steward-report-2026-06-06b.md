# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-06 (second sweep)
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

The second 2026-06-06 sweep is largely clean. Two of the three findings from the earlier 2026-06-06 sweep have been resolved: the steward protocol document (`CLAUDE.md`) now carries the correct Anthill v0.1.6 expected SHA (`3bda022d…`), and the stray `EOF` marker in the PROJECT_LEDGER.md 2026-06-05 entry has been removed. One finding persists: the GitHub Release body still references Anthill v0.1.5 and its SHA in the integrity-verification block, despite the v0.1.6 tarball being attached as an asset. All eight specifications remain identical between dillweed.com and the repository. The trust root is unchanged. All three services are healthy at 1,052,450 seconds (~12.2 days) continuous uptime. All nine steward capabilities resolve with the required trust signals.

Note: the 2026-06-06 (first sweep) ledger entry has not yet been applied to PROJECT_LEDGER.md and remains pending steward action. The 2026-06-06 first-sweep report is at `steward-report-2026-06-06.md`.

## Step Results

### Step 1 — Spec drift detection
**Status:** PASS
**Capability:** `review.spec.read` + `review.website.fetch` (both ALLOWED, DillClaw verified)

All eight specification documents identical between `https://dillweed.com` and `~/dillweed-namespace-repo/specs/`. No change.

---

### Step 2 — Version consistency
**Status:** PASS
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)

All four documents agree on all three component versions:

| Document | Registry | Resolver | Anthill |
|---|---|---|---|
| README.md | 0.2.8 ✅ | 0.1.8 ✅ | 0.1.6 ✅ |
| v1.0.0-release-notes.md | 0.2.8 ✅ | 0.1.8 ✅ | 0.1.6 ✅ |
| operations-runbook.md | 0.2.8 ✅ | 0.1.8 ✅ | 0.1.6 ✅ |
| PROJECT_LEDGER.md | — | — | 0.1.5 (last release entry, sweeps recorded) ✅ |

PROJECT_LEDGER.md: the 2026-06-05 entry (last in the file) no longer contains the stray `EOF` marker — Finding 4 is confirmed resolved.

---

### Step 3 — SHA verification
**Status:** FINDING (persistent — Finding 2 from earlier 2026-06-06 sweep)
**Capability:** `review.release.verify` (ALLOWED, DillClaw verified)

**Registry and Resolver — all surfaces consistent:**

| Component | SHA256 | README | Release notes | GitHub body |
|---|---|---|---|---|
| Registry v0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | ✅ | ✅ | ✅ |
| Resolver v0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | ✅ | ✅ | ✅ |

**Anthill — partial:**

| Location | Version | SHA256 | Result |
|---|---|---|---|
| README.md | 0.1.6 | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | ✅ |
| v1.0.0-release-notes.md | 0.1.6 | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | ✅ |
| GitHub Release asset | 0.1.6 | `dillweed-anthill-v0.1.6.tar.gz` present | ✅ |
| GitHub Release body | **0.1.5** | `dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b` | ❌ stale |
| CLAUDE.md expected SHA | 0.1.6 | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | ✅ (resolved) |

**See Finding 2 (persistent).**

---

### Step 4 — Trust root verification
**Status:** PASS
**Capability:** `review.website.fetch` (ALLOWED, DillClaw verified)

| Location | SHA256 | Result |
|---|---|---|
| `https://dillweed.com/dnso_public.pem` | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |
| Registry keystore | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |
| Resolver keystore | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |

---

### Step 5 — Deployment health check
**Status:** PASS
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)
**Timestamp:** 2026-06-06T16:39:56Z

| Service | Port | status | Version | Notes |
|---|---|---|---|---|
| DillClaw Resolver | 9474 | ok ✅ | dillclaw/0.1.8 | registry.source=remote ✅, dnso_key.configured=true ✅ |
| Dillweed Registry | 9475 | ok ✅ | dillweed-registry/0.2.8 | 16 capabilities, authoritative |
| Dillweed Anthill | 9476 | ok ✅ | dillweed-anthill/0.1.6 | signals_received=117 (unchanged since 2026-06-02) |

**Uptime:** 1,052,450s (~12.2 days continuous).

---

### Step 6 — Capability resolution verification
**Status:** PASS
**Capability:** `review.release.verify` (ALLOWED, DillClaw verified)

All nine steward capabilities resolved with both required trust signals. Score stable at 0.596.

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

This document. Written to `~/Dillweed-Agent/reports/steward-report-2026-06-06b.md`.

---

## Finding Status Summary

| Finding | First raised | Status |
|---|---|---|
| F1 — Anthill version drift | 2026-06-02 | RESOLVED (2026-06-06) |
| F2 — GitHub Release body not updated | 2026-06-06 | **PERSISTENT** |
| F3 — CLAUDE.md stale Anthill SHA | 2026-06-06 | RESOLVED (2026-06-06b) |
| F4 — Stray EOF in PROJECT_LEDGER | 2026-06-06 | RESOLVED (2026-06-06b) |

---

## Findings

### Finding 2 — GitHub Release body not updated for Anthill v0.1.6 (Persistent)

**Severity:** Low
**First raised:** 2026-06-06 (first sweep)

The v1.0.0 GitHub Release body still instructs users to verify Anthill against the v0.1.5 SHA (`dda1430…`). The v0.1.6 tarball is attached as an asset, but the release description's SHA verification block has not been updated. This is a documentation inconsistency visible to any user who downloads the v0.1.6 tarball and follows the release's integrity-check instructions.

**Suggested remediation:** Update the v1.0.0 GitHub Release body to add a post-v1 patch section documenting the v0.1.6 tarball and SHA `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36`. The suggested issue body from the 2026-06-06 first-sweep report applies unchanged.

---

## Suggested Issues

No new issues. Finding 2 was already drafted in `steward-report-2026-06-06.md`. Issue #1 (Anthill version drift) was resolved and can be closed.

---

## Proposed Ledger Entry

*(Drafted under `ledger.update.propose` — APPROVAL REQUIRED per boundary policy.)*

Note: the 2026-06-06 first-sweep ledger entry (from `steward-report-2026-06-06.md`) is also pending. Both entries are presented here for convenience; they should be applied in order.

**Entry A — 2026-06-06 first sweep (pending from prior session):**

```markdown
### Steward sweep — 2026-06-06 (first)

- **Type:** Automated consistency sweep
- **Agent:** dillweed.protocol-steward (review-and-recommend mode)
- **Result:** 1 RESOLVED, 2 FINDINGS, 1 COSMETIC, 5 PASS, 0 BLOCKED

**Summary of checks:**
- Spec drift (Step 1): All 8 specs identical. PASS.
- Version consistency (Step 2): PASS — Finding 1 RESOLVED. All documents now
  reference Anthill v0.1.6. Issue #1 can be closed.
- SHA verification (Step 3): Registry and Resolver SHAs consistent. FINDING:
  GitHub Release body not updated with v0.1.6 SHA (Finding 2). FINDING:
  CLAUDE.md protocol has stale v0.1.5 expected SHA (Finding 3).
- Trust root (Step 4): Unchanged. PASS.
- Deployment health (Step 5): All three services healthy. Uptime ~12 days. PASS.
- Capability resolution (Step 6): All 9 steward capabilities sig_valid +
  sig_verified. Trust score 0.596. PASS.

**Cosmetic:** PROJECT_LEDGER 2026-06-05 entry had stray EOF marker and 2-space
indent (Finding 4).

**Report:** `~/Dillweed-Agent/reports/steward-report-2026-06-06.md`
```

**Entry B — 2026-06-06 second sweep (this sweep):**

```markdown
### Steward sweep — 2026-06-06 (second)

- **Type:** Automated consistency sweep
- **Agent:** dillweed.protocol-steward (review-and-recommend mode)
- **Result:** 2 RESOLVED, 1 FINDING (persistent), 6 PASS, 0 BLOCKED

**Summary of checks:**
- Spec drift (Step 1): All 8 specs identical. PASS.
- Version consistency (Step 2): PASS.
- SHA verification (Step 3): FINDING (persistent) — GitHub Release body still
  references Anthill v0.1.5 SHA (Finding 2). All other SHAs consistent. PASS.
- Trust root (Step 4): Unchanged. PASS.
- Deployment health (Step 5): All three services healthy. Uptime ~12.2 days. PASS.
- Capability resolution (Step 6): All 9 steward capabilities sig_valid +
  sig_verified. Trust score 0.596. PASS.

**Resolved:** Finding 3 (CLAUDE.md stale SHA) and Finding 4 (stray EOF in ledger).

**Report:** `~/Dillweed-Agent/reports/steward-report-2026-06-06b.md`
```
