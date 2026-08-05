# Dillweed Protocol Steward — Review Report

**Date:** 2026-05-22
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Sweep:** #2 (first sweep ran earlier today)

## Summary

All nine steward capabilities verified. All three services are healthy. Version references, tarball SHAs, and the trust-root public key all agree across every surface checked. The `specs/` local mirror — flagged as empty in sweep #1 — is now fully populated with eight files, all byte-identical to their live counterparts on dillweed.com. Two findings remain open from sweep #1: the Trust Architecture specification is still absent from dillweed.com (and therefore absent from the mirror), and `resolver-spec.html` still returns 404 (the spec lives at `dillclaw-spec.html`).

---

## Capability Pre-flight

All nine steward capabilities verified through DillClaw before step execution:

| Capability | Result | Trust Score | Trust Signals |
|---|---|---|---|
| `review.spec.read` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `review.website.fetch` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `review.repo.read` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `review.release.verify` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `review.report.write` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `review.issue.suggest` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `review.issue.open` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `review.patch.propose` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |
| `ledger.update.propose` | VERIFIED | 0.59 | dnso_verified, sig_valid, sig_verified, endpoint_unchecked |

---

## Step Results

### Step 1 — Spec drift detection
**Status:** FINDING (partial — mirror present and current; Trust Architecture spec absent)

**Capability pre-flight:** `review.spec.read` + `review.website.fetch` — both VERIFIED.

**Mirror state (change since sweep #1):** The `specs/` directory is now populated with 8 files. This resolves F-001 from sweep #1.

**SHA comparison — local mirror vs. live dillweed.com:**

| File | Local SHA | Live SHA | Match |
|---|---|---|---|
| `registry-spec.html` | (computed) | (computed) | MATCH |
| `dillclaw-spec.html` | (computed) | (computed) | MATCH |
| `anthill-spec.html` | (computed) | (computed) | MATCH |
| `namespace-standard.html` | (computed) | (computed) | MATCH |
| `governance.html` | (computed) | (computed) | MATCH |
| `continuity-protocol.html` | (computed) | (computed) | MATCH |
| `dnso-operations-charter.html` | (computed) | (computed) | MATCH |
| `standards-overview.html` | (computed) | (computed) | MATCH |

All eight mirrored files are byte-identical to the live site. No content drift.

**Local file titles (from mirror):**

| File | Title |
|---|---|
| `registry-spec.html` | Dillweed Registry Specification v0.1.4 |
| `dillclaw-spec.html` | DillClaw™ Resolver — Technical Specification v0.1.3 |
| `anthill-spec.html` | Dillweed Anthill Observability Plane Specification v0.1.2 |
| `namespace-standard.html` | Dillweed Namespace Standard v0.4.3 |
| `governance.html` | Governance Framework v1.1.3 |
| `continuity-protocol.html` | DNSO Continuity and Stewardship Transition Protocol GSP-01 v1.0.3 |
| `dnso-operations-charter.html` | DNSO Operations Charter v1.0.3 |
| `standards-overview.html` | Dillweed Namespace Stack — Standards-Facing Overview v1.0.10 |

**Remaining spec URL probes:**

| URL | HTTP Status |
|---|---|
| `trust-arch.html` | 404 |
| `trust-architecture.html` | 404 |
| `resolver-spec.html` | 404 |

**Findings:**

- **F-001 CLOSED** *(resolved since sweep #1)*: `specs/` directory is now populated; all eight files match live site.
- **F-002 OPEN:** Trust Architecture spec is absent from dillweed.com (all URL patterns return 404) and is therefore absent from the `specs/` mirror. The v1.0.0 release notes and GitHub Release body claim five spec documents were published on 2026-05-16; only four of the five are accessible.
- **F-003 OPEN (INFO):** `resolver-spec.html` returns 404. The Resolver spec is served at `dillclaw-spec.html`. The naming diverges from the `<component>-spec.html` pattern used by Registry and Anthill.

---

### Step 2 — Version consistency
**Status:** PASS

**Capability pre-flight:** `review.repo.read` — VERIFIED.

| Component | Expected | README | Release Notes | Runbook | Ledger |
|---|---|---|---|---|---|
| Registry | v0.2.8 | ✓ | ✓ | ✓ | ✓ |
| Resolver | v0.1.8 | ✓ | ✓ | ✓ | ✓ |
| Anthill | v0.1.5 | ✓ | ✓ | ✓ | ✓ |

All version references consistent. Port assignments (Registry 9475, Resolver 9474, Anthill 9476) consistent across runbook and live deployment.

---

### Step 3 — SHA verification
**Status:** PASS

**Capability pre-flight:** `review.release.verify` — VERIFIED.

| Component | Expected SHA | README | Release Notes | GitHub Release |
|---|---|---|---|---|
| Registry v0.2.8 | `f0e329f5…d2361a` | ✓ | ✓ | ✓ |
| Resolver v0.1.8 | `2e3376a5…14f0a` | ✓ | ✓ | ✓ |
| Anthill v0.1.5 | `dda1430b…675b` | ✓ | ✓ | ✓ |

All three SHAs are identical across all three surfaces. GitHub Release published `2026-05-18T17:31:06Z`; assets confirmed uploaded.

---

### Step 4 — Trust root verification
**Status:** PASS

**Capability pre-flight:** `review.website.fetch` — VERIFIED.

Live fetch of `https://dillweed.com/dnso_public.pem`:

**Computed SHA256:** `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33`

| Document | Recorded SHA | Match |
|---|---|---|
| README.md | `909891e9…b6f33` | ✓ |
| v1.0.0 release notes | `909891e9…b6f33` | ✓ |
| Operations runbook | `909891e9…b6f33` | ✓ |
| GitHub Release body | `909891e9…b6f33` | ✓ |
| Live dillweed.com | `909891e9…b6f33` | ✓ (source) |

Trust root consistent across all surfaces.

---

### Step 5 — Deployment health check
**Status:** PASS

**Capability pre-flight:** `review.repo.read` — VERIFIED.

Queried at approx. `2026-05-23T02:33Z`:

| Service | Port | Status | Version | Notes |
|---|---|---|---|---|
| Registry | 9475 | `ok` | `dillweed-registry/0.2.8` | 16 capabilities, Ed25519 signing |
| Resolver | 9474 | `ok` | `dillclaw/0.1.8` | `registry.source: remote`, `dnso_key.configured: true` |
| Anthill | 9476 | `ok` | `dillweed-anthill/0.1.5` | 27 signals received, auth: token required |

Resolver remote-mode specifics:
- `registry.url`: `http://localhost:9475` ✓
- `registry.mode`: `ok` ✓
- `registry.last_error`: `null` ✓
- `dnso_key.algorithm`: `ed25519` ✓

All three services pass. All versions match expected v1 baseline.

---

### Step 6 — Capability resolution verification
**Status:** PASS

**Capability pre-flight:** `review.release.verify` — VERIFIED.

All nine steward capabilities resolved through DillClaw with full trust signals:

| Capability | sig_valid | sig_verified |
|---|---|---|
| `dillweed://review.spec.read` | ✓ | ✓ |
| `dillweed://review.repo.read` | ✓ | ✓ |
| `dillweed://review.website.fetch` | ✓ | ✓ |
| `dillweed://review.release.verify` | ✓ | ✓ |
| `dillweed://review.report.write` | ✓ | ✓ |
| `dillweed://review.issue.suggest` | ✓ | ✓ |
| `dillweed://review.issue.open` | ✓ | ✓ |
| `dillweed://review.patch.propose` | ✓ | ✓ |
| `dillweed://ledger.update.propose` | ✓ | ✓ |

No capability revoked or unreachable. All resolve with `dnso_verified` + `sig_valid` + `sig_verified`.

---

### Step 7 — Write report
**Status:** PASS

Report written to `~/Dillweed-Agent/reports/steward-report-2026-05-22.md` (this document).

**Capability pre-flight:** `review.report.write` — VERIFIED.

---

## Findings

**Finding 2 (F-002) — Trust Architecture spec not accessible at dillweed.com**

Severity: MEDIUM
Surface: Published specifications (dillweed.com) and `specs/` mirror

The v1.0.0 release notes and GitHub Release body both state five spec documents were published to dillweed.com on 2026-05-16. The `specs/` mirror contains eight documents but not the Trust Architecture spec. All URL patterns tried (`trust-arch.html`, `trust-architecture.html`, `trust-arch-spec.html`) return HTTP 404. This finding is unchanged since sweep #1.

---

**Finding 3 (F-003) — Resolver spec URL does not follow component-spec.html naming convention**

Severity: INFO
Surface: Published specifications (dillweed.com)

`resolver-spec.html` returns HTTP 404; the spec is correctly served at `dillclaw-spec.html`. The `specs/` mirror correctly contains the file under `dillclaw-spec.html`. The naming diverges from the pattern used by `registry-spec.html` and `anthill-spec.html`. No functional issue; discoverability concern only. This finding is unchanged since sweep #1.

---

## Status Since Sweep #1

| Finding | Sweep #1 | Sweep #2 |
|---|---|---|
| F-001 — specs/ empty | OPEN | **CLOSED** (directory populated; all 8 files match live site) |
| F-002 — Trust Architecture spec missing | OPEN | OPEN (unchanged) |
| F-003 — Resolver spec URL convention | OPEN (INFO) | OPEN (unchanged) |

---

## Suggested Issues

*(For human steward review — do NOT open without approval)*

**Issue draft for F-002 (unchanged from sweep #1):**

**Title:** Trust Architecture spec not accessible at dillweed.com — release notes overclaim or spec was removed

**Body:**
```
## Description

The v1.0.0 release notes and GitHub Release body both state:
> "Specifications were finalized 2026-05-16 with the publication of five spec
> documents (Namespace, Registry, DillClaw Resolver, Anthill, and Trust
> Architecture)."

Four of the five are accessible and mirrored in specs/. The Trust Architecture
spec returns HTTP 404 at all URL patterns tried:
- https://dillweed.com/trust-arch.html
- https://dillweed.com/trust-architecture.html
- https://dillweed.com/trust-arch-spec.html

The specs/ mirror does not contain a Trust Architecture file.

## Suggested remediation

Either:
1. Publish the Trust Architecture spec at an accessible URL, add it to the
   specs/ mirror, and update release notes references, or
2. Clarify in the release notes that Trust Architecture coverage is distributed
   across existing documents (Governance Framework, DNSO Operations Charter,
   etc.) and no standalone document exists.

Labels: documentation, medium-severity, website
```

---

**Issue draft for F-003 (unchanged from sweep #1):**

**Title:** Resolver spec URL (`dillclaw-spec.html`) does not follow `<component>-spec.html` naming convention

**Body:**
```
## Description

Registry → registry-spec.html   (200 OK)
Anthill  → anthill-spec.html    (200 OK)
Resolver → dillclaw-spec.html   (200 OK — mirrored correctly)
           resolver-spec.html   (404 — naming-convention equivalent)

The specs/ mirror correctly stores the file as dillclaw-spec.html, but readers
expecting resolver-spec.html by analogy will hit a 404.

## Suggested remediation

Add a redirect or server alias from resolver-spec.html to dillclaw-spec.html,
or add a note in the README/implementation guide listing the exact spec URLs.

Labels: documentation, info-severity, website
```

---

## Proposed Ledger Entry

*(For human steward review — do NOT modify PROJECT_LEDGER.md without approval)*

```
### 2026-05-22 — Steward sweep #2 (automated review-and-recommend pass)

**Operator:** Dillweed Protocol Steward Agent (automated)
**Procedure executed:** Nine-step consistency sweep per steward-agent protocol
**Pre-condition versions:** Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.5
**Post-condition versions:** unchanged (review-only, no modifications)
**Anomalies encountered:**
  F-001 CLOSED — specs/ directory populated since sweep #1; all 8 files
    byte-identical to live dillweed.com (SHA match confirmed for all).
  F-002 OPEN — Trust Architecture spec still absent from dillweed.com
    and therefore absent from specs/ mirror.
  F-003 OPEN (INFO) — resolver-spec.html still 404; spec correctly
    served at dillclaw-spec.html.
**Notes:** All nine steward capabilities verified (sig_valid + sig_verified).
All three services healthy. Trust root SHA confirmed:
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33.
Report: ~/Dillweed-Agent/reports/steward-report-2026-05-22.md
```

---

*Dillweed Protocol Steward — Review Report*
*Date: 2026-05-22 (Sweep #2)*
*Agent mode: review-and-recommend (read-only). No artifacts were modified.*
