# Dillweed Protocol Steward — Review Report

**Date:** 2026-05-22
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

Seven of nine capability checks passed with full `sig_valid` + `sig_verified` trust signals. The three-service deployment is healthy, all version references are internally consistent, all tarball SHAs agree across README, release notes, and the GitHub Release body, and the trust-root public key SHA matches the canonical value in every document. Two findings require attention: (1) the `specs/` directory documented in the README as a dillweed.com mirror is an empty placeholder — no spec HTML files are present — making local drift detection against the website impossible; and (2) the Trust Architecture specification, claimed in both the release notes and GitHub Release body to have been published to dillweed.com, cannot be found at any URL on that site. The Resolver spec URL also uses the non-obvious name `dillclaw-spec.html` rather than `resolver-spec.html`, which may create friction for readers following the naming convention of other spec pages.

---

## Capability Pre-flight

All nine steward capabilities verified through DillClaw before step execution:

| Capability | Status | Trust Score | Trust Signals |
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
**Status:** FINDING

**Capability pre-flight:** `review.spec.read` + `review.website.fetch` — both VERIFIED.

**Specs/ directory state:** The `specs/` directory at `~/dillweed-namespace-repo/specs/` is empty. The README documents it as "spec documents (mirror of dillweed.com)" but contains no files. Local drift detection against the published spec pages cannot be performed. This is a documentation-vs-reality inconsistency.

**Spec pages found at dillweed.com (HTTP 200):**

| URL | Title |
|---|---|
| `registry-spec.html` | Dillweed Registry Specification v0.1.4 |
| `dillclaw-spec.html` | DillClaw™ Resolver — Technical Specification v0.1.3 |
| `anthill-spec.html` | Dillweed Anthill Observability Plane Specification v0.1.2 |
| `namespace-standard.html` | Dillweed Namespace Standard v0.4.3 |
| `implementing-dillweed.html` | Dillweed Namespace Project — Implementation Guide |
| `governance.html` | Governance Framework v1.1.3 |
| `dnso-operations-charter.html` | DNSO Operations Charter v1.0.3 |
| `continuity-protocol.html` | DNSO Continuity and Stewardship Transition Protocol GSP-01 v1.0.3 |
| `standards-overview.html` | Dillweed Namespace Stack — Standards-Facing Overview v1.0.10 |

**Spec pages not found (HTTP 404):**

| URL tried | Purpose |
|---|---|
| `resolver-spec.html` | Resolver spec (naming-convention equivalent) |
| `trust-arch.html`, `trust-architecture.html`, `trust-arch-spec.html` | Trust Architecture spec (all patterns tried) |

**Findings:**

- **F-001:** `specs/` directory is empty; the documented local mirror does not exist.
- **F-002:** Trust Architecture spec cannot be found at dillweed.com. The release notes and GitHub Release body both claim "five spec documents (Namespace, Registry, DillClaw Resolver, Anthill, and **Trust Architecture**)" were published on 2026-05-16. Four of the five are accessible; the Trust Architecture spec is not.
- **F-003 (Minor):** The Resolver spec URL is `dillclaw-spec.html`, not `resolver-spec.html`. This is internally consistent (DillClaw is the component's proper name) but diverges from the `<component>-spec.html` naming pattern used by Registry and Anthill pages. No link to `resolver-spec.html` returns HTTP 200.

---

### Step 2 — Version consistency
**Status:** PASS

**Capability pre-flight:** `review.repo.read` — VERIFIED.

Documents checked: `README.md`, `docs/release-notes/v1.0.0-release-notes.md`, `docs/operations-runbook.md`, `PROJECT_LEDGER.md`.

| Component | Expected | README | Release Notes | Runbook | Ledger |
|---|---|---|---|---|---|
| Registry | v0.2.8 | ✓ 0.2.8 | ✓ 0.2.8 | ✓ v0.2.8 | ✓ v0.2.8 |
| Resolver | v0.1.8 | ✓ 0.1.8 | ✓ 0.1.8 | ✓ v0.1.8 | ✓ v0.1.8 |
| Anthill | v0.1.5 | ✓ 0.1.5 | ✓ 0.1.5 | ✓ v0.1.5 | ✓ v0.1.5 |

All version references agree. No mismatch found.

Port assignments also consistent across runbook and deployment:
- Registry → port 9475 ✓
- Resolver → port 9474 ✓
- Anthill → port 9476 ✓

---

### Step 3 — SHA verification
**Status:** PASS

**Capability pre-flight:** `review.release.verify` — VERIFIED.

| Component | Expected SHA | README | Release Notes | GitHub Release Body |
|---|---|---|---|---|
| Registry v0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | ✓ | ✓ | ✓ |
| Resolver v0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | ✓ | ✓ | ✓ |
| Anthill v0.1.5 | `dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b` | ✓ | ✓ | ✓ |

All three SHA256 values are identical across all three surfaces. GitHub Release published at `2026-05-18T17:31:06Z`. Assets confirmed uploaded (state: `uploaded`) with sizes consistent with ledger records.

**Minor observation:** The GitHub Release body states "**Released:** 2026-05-17" but the GitHub API `published_at` timestamp is `2026-05-18T17:31:06Z`. The operational log entry for 2026-05-18 confirms the actual publication date. The "2026-05-17" date in the release body refers to the ship-verification date, not the GitHub publication date. This is not a hash integrity issue; noted for completeness.

---

### Step 4 — Trust root verification
**Status:** PASS

**Capability pre-flight:** `review.website.fetch` — VERIFIED.

Fetched `https://dillweed.com/dnso_public.pem` (HTTP 200, content-length 113 bytes, last-modified 2026-05-03).

**Computed SHA256 of fetched PEM (raw bytes):** `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33`

**Canonical SHA references across all documents:**

| Document | SHA Reference | Match |
|---|---|---|
| README.md | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✓ |
| v1.0.0 release notes | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✓ |
| Operations runbook | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✓ |
| GitHub Release body | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✓ |
| Fetched live from dillweed.com | `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | ✓ |

Trust root is consistent across all surfaces. PEM content:
```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAMrG71HBWCuT2InGL80qZerv0IWGdlt7B20dgAHl+DRQ=
-----END PUBLIC KEY-----
```

---

### Step 5 — Deployment health check
**Status:** PASS

**Capability pre-flight:** `review.repo.read` — VERIFIED.

All three services queried at time of review (approx. 2026-05-23T01:02Z):

| Service | Port | Status | Version Reported | Uptime |
|---|---|---|---|---|
| Registry | 9475 | `ok` | `dillweed-registry/0.2.8` | 42,904 s |
| Resolver | 9474 | `ok` | `dillclaw/0.1.8` | 38,680 s |
| Anthill | 9476 | `ok` | `dillweed-anthill/0.1.5` | — |

**Resolver-specific checks:**
- `registry.source`: `"remote"` ✓
- `dnso_key.configured`: `true` ✓
- `dnso_key.algorithm`: `ed25519` ✓
- `registry.last_error`: `null` ✓
- `registry.records`: 16 (matches Registry's reported capability count)
- `registry.url`: `http://localhost:9475` ✓

All three services healthy, all version numbers match expected v1 baseline, Resolver operating in remote mode with fully-configured trust root.

---

### Step 6 — Capability resolution verification
**Status:** PASS

**Capability pre-flight:** `review.release.verify` — VERIFIED.

All nine steward capabilities resolved through DillClaw and verified:

| Capability URI | sig_valid | sig_verified | Trust Score |
|---|---|---|---|
| `dillweed://review.spec.read` | ✓ | ✓ | 0.59 |
| `dillweed://review.repo.read` | ✓ | ✓ | 0.59 |
| `dillweed://review.website.fetch` | ✓ | ✓ | 0.59 |
| `dillweed://review.release.verify` | ✓ | ✓ | 0.59 |
| `dillweed://review.report.write` | ✓ | ✓ | 0.59 |
| `dillweed://review.issue.suggest` | ✓ | ✓ | 0.59 |
| `dillweed://review.issue.open` | ✓ | ✓ | 0.59 |
| `dillweed://review.patch.propose` | ✓ | ✓ | 0.59 |
| `dillweed://ledger.update.propose` | ✓ | ✓ | 0.59 |

All nine return `dnso_verified`, `sig_valid`, and `sig_verified` trust signals. No capability revoked. All `sig_verified` — signatures checked against the live DNSO public key.

---

### Step 7 — Write report
**Status:** PASS

Report written to `~/Dillweed-Agent/reports/steward-report-2026-05-22.md` (this document).

**Capability pre-flight:** `review.report.write` — VERIFIED.

---

## Findings

**Finding 1 (F-001) — specs/ directory is empty; documented local mirror absent**

Severity: LOW
Surface: Source repository

The `README.md` repository layout section documents `specs/` as containing "spec documents (mirror of dillweed.com)". The directory exists but contains no files. Because there is no local mirror, this review could not perform the intended content-level diff between published HTML and local copies. Any future drift between the site and a local reference would go undetected without this mirror.

---

**Finding 2 (F-002) — Trust Architecture spec not accessible at dillweed.com**

Severity: MEDIUM
Surface: Published specifications (dillweed.com)

Both the GitHub Release body and `docs/release-notes/v1.0.0-release-notes.md` state: *"Specifications were finalized 2026-05-16 with the publication of five spec documents (Namespace, Registry, DillClaw Resolver, Anthill, and Trust Architecture)."* Four of the five are accessible. The Trust Architecture specification returns HTTP 404 at every URL pattern attempted:
- `trust-arch.html`
- `trust-architecture.html`
- `trust-arch-spec.html`

No alternative URL was found. If this spec was published and subsequently removed, or was published under a URL not yet discovered, the release documentation is inaccurate. If it was never published, the release notes overclaim.

---

**Finding 3 (F-003) — Resolver spec URL does not follow component-spec.html naming convention**

Severity: INFO
Surface: Published specifications (dillweed.com)

The DillClaw Resolver specification is served at `dillclaw-spec.html`, not `resolver-spec.html`. The Registry and Anthill specs follow the `<component>-spec.html` convention (`registry-spec.html`, `anthill-spec.html`). The Resolver's URL uses the component's proper brand name ("DillClaw") rather than the role name ("resolver"). Any documentation or tooling that guesses the URL from the naming pattern would fail. The URL is correct and the spec is accessible — this is a discoverability/convention concern only.

---

## Suggested Issues

*(Prepared for human steward review — do NOT open without approval)*

---

**Issue draft for F-001:**

**Title:** `specs/` directory is empty — documented local mirror not populated

**Body:**
```
## Description

The repository layout documented in README.md describes the `specs/` directory
as "spec documents (mirror of dillweed.com)". The directory exists but contains
no files.

## Impact

The steward sweep cannot perform content-level diff between published spec HTML
and local copies. Drift between the website and a local reference would go
undetected.

## Suggested remediation

Populate `specs/` with the current published HTML from dillweed.com, or remove
the mirror claim from the README if a local mirror is not intended to be
maintained.

**Labels:** documentation, low-severity
```

---

**Issue draft for F-002:**

**Title:** Trust Architecture spec not accessible at dillweed.com — release notes overclaim or spec was removed

**Body:**
```
## Description

The v1.0.0 release notes and GitHub Release body both state:
> "Specifications were finalized 2026-05-16 with the publication of five spec
> documents (Namespace, Registry, DillClaw Resolver, Anthill, and Trust
> Architecture)."

Four of the five are accessible. The Trust Architecture spec returns HTTP 404
at all URL patterns tried:
- https://dillweed.com/trust-arch.html
- https://dillweed.com/trust-architecture.html
- https://dillweed.com/trust-arch-spec.html

## Impact

External readers following the release notes will be unable to find the Trust
Architecture specification. If the spec is referenced by installers or
implementations, they will encounter broken links.

## Suggested remediation

Either:
1. Publish the Trust Architecture spec at an accessible URL and update all
   references to point to it, or
2. Clarify in the release notes that Trust Architecture coverage is split across
   existing documents (Governance Framework, DNSO Operations Charter, etc.) and
   no standalone "Trust Architecture" document exists.

**Labels:** documentation, medium-severity, website
```

---

**Issue draft for F-003:**

**Title:** Resolver spec URL (`dillclaw-spec.html`) does not follow `<component>-spec.html` naming convention

**Body:**
```
## Description

Registry → `registry-spec.html`
Anthill  → `anthill-spec.html`
Resolver → `dillclaw-spec.html`  (uses brand name, not role name)

`resolver-spec.html` returns HTTP 404. Documentation or tooling guessing the URL
from the naming pattern will fail to find the Resolver spec.

## Suggested remediation

Add a redirect or alias from `resolver-spec.html` to `dillclaw-spec.html`, or
add an explicit note in the README listing the actual spec URL.

**Labels:** documentation, info-severity, website
```

---

## Proposed Ledger Entry

*(For human steward review — do NOT modify PROJECT_LEDGER.md without approval)*

```
### 2026-05-22 — Steward sweep v1 (automated review-and-recommend pass)

**Operator:** Dillweed Protocol Steward Agent (automated)
**Procedure executed:** Nine-step consistency sweep per steward-agent protocol
**Pre-condition versions:** Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.5
**Post-condition versions:** unchanged (review-only, no modifications)
**Anomalies encountered:** Three findings:
  F-001 (LOW) — specs/ directory empty; documented dillweed.com mirror absent
  F-002 (MEDIUM) — Trust Architecture spec not accessible at dillweed.com;
    release notes claim five specs published but only four found
  F-003 (INFO) — Resolver spec URL (dillclaw-spec.html) diverges from
    registry-spec.html/anthill-spec.html naming convention
**Notes:** All nine steward capabilities verified (sig_valid + sig_verified).
All three services healthy. Version consistency confirmed across all four
documents. All tarball SHAs match across README, release notes, and GitHub
Release body. Trust root SHA verified live against dillweed.com/dnso_public.pem
(909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33 — MATCH).
Report: ~/Dillweed-Agent/reports/steward-report-2026-05-22.md
```

---

*Dillweed Protocol Steward — Review Report*
*Date: 2026-05-22*
*Agent mode: review-and-recommend (read-only). No artifacts were modified.*
