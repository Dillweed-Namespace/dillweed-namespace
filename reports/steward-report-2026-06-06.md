# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-06
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

The 2026-06-06 sweep brings one resolved finding and two new ones. **Finding 1 (Anthill version drift, first raised 2026-06-02) is now resolved**: README.md, v1.0.0-release-notes.md, and the GitHub Release have all been updated to reference Anthill v0.1.6, and the v0.1.6 tarball (`dillweed-anthill-v0.1.6.tar.gz`, SHA `3bda022d…`) has been published. Issue #1 can be closed. All eight specifications remain identical between dillweed.com and the repository. The trust root is unchanged. All three services are healthy at 1,037,178 seconds (~12 days) continuous uptime. All nine steward capabilities resolve with the required trust signals.

Two new findings: the GitHub Release body was not updated when the v0.1.6 tarball was attached — the release description still references v0.1.5 in its SHA verification block — and the steward protocol document (`CLAUDE.md`) contains a stale expected Anthill SHA from v0.1.5. One minor formatting issue: the 2026-06-05 PROJECT_LEDGER entry has a stray `EOF` heredoc marker on its final line.

## Step Results

### Step 1 — Spec drift detection
**Status:** PASS
**Capability:** `review.spec.read` + `review.website.fetch` (both ALLOWED, DillClaw verified)

All eight specification documents are identical between `https://dillweed.com` and `~/dillweed-namespace-repo/specs/`. No change from prior sweeps.

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

---

### Step 2 — Version consistency
**Status:** PASS ✅ (Finding 1 RESOLVED)
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)

All four documents now agree on Anthill v0.1.6. Finding 1 from the 2026-06-02 and 2026-06-05 sweeps is resolved.

| Document | Registry | Resolver | Anthill |
|---|---|---|---|
| README.md | 0.2.8 ✅ | 0.1.8 ✅ | **0.1.6** ✅ |
| v1.0.0-release-notes.md | 0.2.8 ✅ | 0.1.8 ✅ | **0.1.6** ✅ |
| operations-runbook.md | 0.2.8 ✅ | 0.1.8 ✅ | 0.1.6 ✅ |
| PROJECT_LEDGER.md | — | — | 0.1.5 (last release entry), sweeps recorded ✅ |

The repo release notes also document the post-v1 patch: `Anthill v0.1.5 → v0.1.6 (commits 7a553f1, da6ab0c) — fixes AS-006`.

---

### Step 3 — SHA verification
**Status:** FINDING (2 issues)
**Capability:** `review.release.verify` (ALLOWED, DillClaw verified)

**Registry and Resolver SHAs — consistent across all surfaces:**

| Component | SHA256 | README | Release notes | GitHub Release |
|---|---|---|---|---|
| Registry v0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | ✅ | ✅ | ✅ |
| Resolver v0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | ✅ | ✅ | ✅ |

**Anthill v0.1.6 SHA — partially consistent:**

| Location | SHA256 | Result |
|---|---|---|
| README.md | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | ✅ |
| v1.0.0-release-notes.md (repo file) | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | ✅ |
| GitHub Release asset | `dillweed-anthill-v0.1.6.tar.gz` attached (9,907,578 bytes) | ✅ |
| GitHub Release body | SHA `3bda022d…` **not present** in release description | ❌ |
| CLAUDE.md Step 3 expected SHA | `dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b` (v0.1.5) | ❌ stale |

**See Finding 2 and Finding 3.**

---

### Step 4 — Trust root verification
**Status:** PASS
**Capability:** `review.website.fetch` (ALLOWED, DillClaw verified)

| Location | SHA256 | Result |
|---|---|---|
| `https://dillweed.com/dnso_public.pem` (live) | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |
| Registry keystore | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |
| Resolver keystore | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✅ |

Unchanged. Trust root is stable.

---

### Step 5 — Deployment health check
**Status:** PASS
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)
**Timestamp:** 2026-06-06T12:25:25Z

| Service | Port | status | Version | Notes |
|---|---|---|---|---|
| DillClaw Resolver | 9474 | ok ✅ | dillclaw/0.1.8 | registry.source=remote ✅, dnso_key.configured=true ✅ |
| Dillweed Registry | 9475 | ok ✅ | dillweed-registry/0.2.8 | 16 capabilities, authoritative |
| Dillweed Anthill | 9476 | ok ✅ | dillweed-anthill/0.1.6 | signals_received=117 (unchanged; see prior sweeps) |

**Uptime:** 1,037,178s (~12 days continuous). All three services healthy.

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
**Capability:** `review.report.write` (ALLOWED, DillClaw verified)

This document. Written to `~/Dillweed-Agent/reports/steward-report-2026-06-06.md`.

---

## Findings

### Finding 1 — RESOLVED ✅
**Anthill version drift** (first raised 2026-06-02, resolved 2026-06-06)

README.md, v1.0.0-release-notes.md, and the GitHub Release now all reference Anthill v0.1.6. The v0.1.6 tarball has been published. Issue #1 can be closed.

---

### Finding 2 — GitHub Release body not updated for Anthill v0.1.6

**Severity:** Low

The `dillweed-anthill-v0.1.6.tar.gz` tarball was attached to the v1.0.0 GitHub Release as an asset, but the release body (description) was not updated. The release description still references v0.1.5 in its SHA verification block. A user who reads the GitHub Release page and follows the integrity-verification instructions will be given the v0.1.5 SHA to check against, not the v0.1.6 SHA.

The SHA `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` is documented in the repo's `docs/release-notes/v1.0.0-release-notes.md` under a "Post-v1 patch" section, but not in the published GitHub Release description.

**Suggested remediation:** Update the GitHub Release body to add a "Post-v1 patches" section documenting the Anthill v0.1.5 → v0.1.6 update, the new tarball name, and the new SHA256.

---

### Finding 3 — Steward protocol document (CLAUDE.md) has stale Anthill expected SHA

**Severity:** Low (affects sweep accuracy, not deployment)

The steward protocol document (`~/Dillweed-Agent/CLAUDE.md`) Step 3 lists the following expected SHA for Anthill:

```
dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b  (v0.1.5)
```

The current expected SHA is:

```
3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36  (v0.1.6)
```

This protocol document is outside the repository and cannot be updated by the steward agent (read-only boundary). Future sweeps using the CLAUDE.md Step 3 expected SHA list will flag a mismatch unless the protocol is updated.

**Suggested remediation:** Update `~/Dillweed-Agent/CLAUDE.md` Step 3 expected SHA for Anthill to `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36`.

---

### Finding 4 — Stray `EOF` marker in PROJECT_LEDGER.md 2026-06-05 entry

**Severity:** Cosmetic

The 2026-06-05 steward sweep entry in `PROJECT_LEDGER.md` ends with a literal `  EOF` line (the heredoc terminator from the `cat >>` append command was accidentally included in the file). The entry is also indented by 2 spaces throughout, inconsistent with the formatting of other ledger entries.

**Suggested remediation:** Remove the trailing `  EOF` line and de-indent the 2026-06-05 entry to match the style of surrounding entries.

---

## Suggested Issues

*(Drafted under `review.issue.suggest` — ALLOWED, DillClaw verified.)*

### Issue for Finding 2

**Title:** `docs: update GitHub Release body with Anthill v0.1.6 SHA and post-v1 patch section`

**Body:**
```
The v0.1.6 Anthill tarball was uploaded to the v1.0.0 GitHub Release as an asset,
but the release description was not updated. Users following the integrity-verification
instructions in the release body will be given the v0.1.5 SHA, not the v0.1.6 SHA.

## Required change

Update the v1.0.0 GitHub Release description to add a "Post-v1 patches" section that:
- Documents the Anthill v0.1.5 → v0.1.6 patch (commits 7a553f1, da6ab0c, closes INST-013)
- Lists the v0.1.6 tarball name: `dillweed-anthill-v0.1.6.tar.gz`
- Provides the new SHA256: `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36`

## Reference

The new SHA is already documented in `docs/release-notes/v1.0.0-release-notes.md`
under the "Post-v1 patch" section — the GitHub Release body just needs to match.

Detected by: Dillweed Protocol Steward Agent — consistency sweep 2026-06-06.
```

### Issue for Finding 3

**Title:** `ops: update CLAUDE.md steward protocol with Anthill v0.1.6 expected SHA`

**Body:**
```
The steward protocol document (CLAUDE.md in ~/Dillweed-Agent/) Step 3 lists
the Anthill expected SHA as the v0.1.5 value:

  dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b

The current expected SHA (v0.1.6) is:

  3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36

## Required change

Update Step 3 in ~/Dillweed-Agent/CLAUDE.md:
  - Anthill: `dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b`
to:
  - Anthill: `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36`

Note: CLAUDE.md is outside the repository boundary and cannot be modified
by the steward agent (read-only mode). This is a manual steward action.

Detected by: Dillweed Protocol Steward Agent — consistency sweep 2026-06-06.
```

---

## Proposed Ledger Entry

*(Drafted under `ledger.update.propose` — APPROVAL REQUIRED per boundary policy.)*

```markdown
### Steward sweep — 2026-06-06

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

**Cosmetic:** PROJECT_LEDGER 2026-06-05 entry has stray EOF marker and 2-space
indent (Finding 4).

**Report:** `~/Dillweed-Agent/reports/steward-report-2026-06-06.md`
```
