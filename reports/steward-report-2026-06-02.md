# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-02
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

The 2026-06-02 consistency sweep across dillweed.com, the source repository, and the dill-p-001 deployment is largely clean. All eight specification documents are byte-for-byte identical between the live website and the local repository. The trust root (DNSO public key) matches its canonical SHA256 across all four locations checked: dillweed.com, the Registry keystore, the Resolver keystore, and both the README and release notes. All three services are healthy. All nine steward capabilities resolve through DillClaw with `sig_valid` and `sig_verified` trust signals. One FINDING is raised: Anthill v0.1.6 is running on the deployment and is correctly reflected in the operations runbook, but README.md, the v1.0.0 release notes, and PROJECT_LEDGER.md still reference Anthill v0.1.5, and no v0.1.6 tarball has been published to the GitHub Release.

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

No content, version number, or timestamp divergence detected.

---

### Step 2 — Version consistency
**Status:** FINDING
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)

Documents surveyed: `README.md`, `docs/release-notes/v1.0.0-release-notes.md`, `docs/operations-runbook.md`, `PROJECT_LEDGER.md`.

Expected versions per protocol: Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.6.

| Document | Registry | Resolver | Anthill |
|---|---|---|---|
| README.md | 0.2.8 ✅ | 0.1.8 ✅ | **0.1.5** ❌ |
| v1.0.0-release-notes.md | 0.2.8 ✅ | 0.1.8 ✅ | **0.1.5** ❌ |
| operations-runbook.md | 0.2.8 ✅ | 0.1.8 ✅ | 0.1.6 ✅ |
| PROJECT_LEDGER.md | — | — | **0.1.5** (last recorded release) ❌ |

The operations runbook correctly reflects the deployed version (v0.1.6). The README, release notes, and PROJECT_LEDGER.md do not. Additionally, no v0.1.6 Anthill tarball is published to the GitHub Release (`Dillweed-Namespace/dillweed-namespace`): the only Anthill asset attached to the v1.0.0 release remains `dillweed-anthill-v0.1.5.tar.gz`.

**See Finding 1.**

---

### Step 3 — SHA verification
**Status:** PASS
**Capability:** `review.release.verify` (ALLOWED, DillClaw verified)

SHA256 values for all three tarballs are consistent across README.md, v1.0.0-release-notes.md, and the GitHub Release body and assets:

| Component | Expected SHA256 | README | Release notes | GitHub Release |
|---|---|---|---|---|
| Registry v0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | ✅ | ✅ | ✅ |
| Resolver v0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | ✅ | ✅ | ✅ |
| Anthill v0.1.5 | `dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b` | ✅ | ✅ | ✅ |

Note: These SHAs correspond to the v0.1.5 Anthill tarball. No v0.1.6 tarball or SHA exists in the release. This is consistent with Finding 1 — the upgrade to v0.1.6 was applied in-place on the deployment without a corresponding release artifact.

---

### Step 4 — Trust root verification
**Status:** PASS
**Capability:** `review.website.fetch` (ALLOWED, DillClaw verified)

The DNSO public key was fetched from `https://dillweed.com/dnso_public.pem` and its SHA256 computed. All four locations agree:

| Location | SHA256 |
|---|---|
| `https://dillweed.com/dnso_public.pem` (live) | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` ✅ |
| Registry keystore (installed) | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` ✅ |
| Resolver keystore (installed) | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` ✅ |
| README.md reference | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` ✅ |
| v1.0.0-release-notes.md reference | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` ✅ |

Trust root is consistent and matches the canonical value.

---

### Step 5 — Deployment health check
**Status:** PASS
**Capability:** `review.repo.read` (ALLOWED, DillClaw verified)
**Timestamp:** 2026-06-02T22:07:45Z

| Service | Port | status | Version | Notes |
|---|---|---|---|---|
| DillClaw Resolver | 9474 | ok ✅ | dillclaw/0.1.8 | registry.source=remote ✅, dnso_key.configured=true ✅ |
| Dillweed Registry | 9475 | ok ✅ | dillweed-registry/0.2.8 | 16 capabilities, deployment_mode=authoritative |
| Dillweed Anthill | 9476 | ok ✅ | dillweed-anthill/0.1.6 | signals_received=117, auth=token required |

All three services returned `"status": "ok"`. Resolver-specific criteria (`registry.source: remote`, `dnso_key.configured: true`) both satisfied. Uptime: ~726,519 s (~8.4 days continuous).

---

### Step 6 — Capability resolution verification
**Status:** PASS
**Capability:** `review.release.verify` (ALLOWED, DillClaw verified)

All nine steward capabilities resolved through DillClaw (POST `/resolve`) with both required trust signals present:

| Capability | sig_valid | sig_verified | trust_score |
|---|---|---|---|
| dillweed://review.spec.read | ✅ | ✅ | 0.595 |
| dillweed://review.repo.read | ✅ | ✅ | 0.595 |
| dillweed://review.website.fetch | ✅ | ✅ | 0.595 |
| dillweed://review.release.verify | ✅ | ✅ | 0.595 |
| dillweed://review.report.write | ✅ | ✅ | 0.595 |
| dillweed://review.issue.suggest | ✅ | ✅ | 0.595 |
| dillweed://review.issue.open | ✅ | ✅ | 0.595 |
| dillweed://review.patch.propose | ✅ | ✅ | 0.595 |
| dillweed://ledger.update.propose | ✅ | ✅ | 0.595 |

All capabilities DillClaw-verified against the DNSO trust root. Scoring profile: `dillclaw-default-v1`.

---

### Step 7 — Write report
**Status:** PASS
**Capability:** `review.report.write` (ALLOWED, DillClaw verified)

This document. Written to `~/Dillweed-Agent/reports/steward-report-2026-06-02.md`.

---

## Findings

### Finding 1 — Anthill version drift: deployment is v0.1.6, documentation references v0.1.5

**Severity:** Low (operational continuity unaffected; deployment is healthy; INST-013 deferred fix is the anticipated driver of v0.1.6)

**Details:**

The Dillweed Anthill service on dill-p-001 (port 9476) reports `"version": "dillweed-anthill/0.1.6"`. The operations runbook correctly records this. However, three repo documents still reference v0.1.5:

- `README.md` — version table and install section both say `Anthill (v0.1.5)`
- `docs/release-notes/v1.0.0-release-notes.md` — component table says Anthill 0.1.5; the known-issue entry for INST-013 says "queued for v0.1.6" (suggesting v0.1.6 was anticipated but not yet released via the standard release process)
- `PROJECT_LEDGER.md` — last recorded Anthill milestone is the v0.1.5 patch (INST-006 closure); no v0.1.6 entry exists

The GitHub Release (`v1.0.0`) has no Anthill v0.1.6 tarball. The only Anthill asset is `dillweed-anthill-v0.1.5.tar.gz`. This means the v0.1.6 upgrade was applied in-place on the deployment without a corresponding release artifact, tarball SHA, or ledger entry.

**Affected surfaces:**
- `README.md` (version table, install section, patches directory comment)
- `docs/release-notes/v1.0.0-release-notes.md` (component table, validation summary, SHA block)
- `PROJECT_LEDGER.md` (no v0.1.6 patch entry)
- GitHub Release `v1.0.0` (no v0.1.6 tarball attached)

**Not affected:**
- `docs/operations-runbook.md` (already records v0.1.6 ✅)
- All eight published specifications (no version references to component tarballs)
- Trust root, SHAs for the three original v1.0.0 tarballs

---

## Suggested Issues

*(Drafted under `review.issue.suggest` — ALLOWED, DillClaw verified. Opening requires steward approval via `review.issue.open`.)*

### Issue 1

**Title:** `docs: update Anthill version references from v0.1.5 to v0.1.6`

**Body:**
```
## Summary

The Dillweed Anthill deployment on dill-p-001 was upgraded to v0.1.6, and
the operations runbook correctly reflects this, but three documents still
reference v0.1.5.

## Affected files

- `README.md` — version table (`| Anthill  | 0.1.5 |`) and install section
  (`### Anthill (v0.1.5)`, tarball name, SHA256 reference)
- `docs/release-notes/v1.0.0-release-notes.md` — component table and
  SHA verification block
- `PROJECT_LEDGER.md` — no v0.1.6 patch entry; last recorded Anthill
  milestone is the v0.1.5 INST-006 closure

## Missing artifact

No `dillweed-anthill-v0.1.6.tar.gz` tarball is attached to the v1.0.0
GitHub Release. Either:
- A tarball should be built, SHA-verified, and attached; or
- The release notes should be updated to document the in-place patch and
  note that no standalone tarball was cut for v0.1.6.

## Suggested resolution

1. Build and publish `dillweed-anthill-v0.1.6.tar.gz` with a documented SHA256
   (or confirm the in-place upgrade approach is intentional and document it).
2. Update `README.md` version table and install section.
3. Update `docs/release-notes/v1.0.0-release-notes.md` component table.
4. Add a PROJECT_LEDGER.md entry recording the v0.1.6 patch, the INST-013
   fix it closes, and the deployment date.

## Detected by

Dillweed Protocol Steward Agent — consistency sweep 2026-06-02.
Resolver: dillclaw/0.1.8. Trace IDs available on request.
```

---

## Proposed Ledger Entry

*(Drafted under `ledger.update.propose` — APPROVAL REQUIRED per boundary policy. Do NOT modify PROJECT_LEDGER.md directly. Present to human steward for review.)*

```markdown
### Steward sweep — 2026-06-02

- **Type:** Automated consistency sweep
- **Agent:** dillweed.protocol-steward (review-and-recommend mode)
- **Result:** 1 FINDING, 8 PASS, 0 BLOCKED

**Summary of checks:**
- Spec drift (Step 1): All 8 specs identical between dillweed.com and repo. PASS.
- Version consistency (Step 2): FINDING — Anthill v0.1.5 in README, release notes,
  and ledger; deployment and runbook report v0.1.6. See suggested issue.
- SHA verification (Step 3): Registry, Resolver, Anthill SHAs consistent across
  README, release notes, and GitHub Release. PASS.
- Trust root (Step 4): dnso_public.pem SHA matches canonical value in all locations. PASS.
- Deployment health (Step 5): All three services healthy (Resolver 9474, Registry 9475,
  Anthill 9476). Uptime ~8.4 days. PASS.
- Capability resolution (Step 6): All 9 steward capabilities resolve with sig_valid +
  sig_verified through DillClaw. Trust score 0.595 across all. PASS.

**Finding:** Anthill v0.1.6 is deployed but undocumented in README, release notes,
and ledger. No v0.1.6 tarball published to GitHub Release. Suggested issue drafted
for steward review.

**Report:** `~/Dillweed-Agent/reports/steward-report-2026-06-02.md`
```
