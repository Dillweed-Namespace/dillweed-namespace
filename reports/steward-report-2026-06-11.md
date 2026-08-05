# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-11
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

A full consistency sweep across all three authoritative surfaces — published
specifications (dillweed.com), source repository (~/dillweed-namespace-repo),
and the running deployment (dill-p-001, ports 9474/9475/9476) — completed with
**all six verification steps passing**. All eight specification versions match
between repo and website; all current-version references agree (Registry
v0.2.8, Resolver v0.1.8, Anthill v0.1.6); all three release-tarball SHA256
values verify against the authoritative GitHub asset digests; the trust-root
public key SHA256 matches the canonical value in every document; all three
services report healthy; and all nine steward capabilities resolve through
DillClaw with valid, verified DNSO signatures.

No integrity or correctness failures were found. Three low-severity / cosmetic
observations are recorded as FINDINGs for follow-up — most notably an anomalous
size of the published Anthill v0.1.6 release asset (~9.9 MB vs ~50 KB peers),
which verifies by SHA but warrants a content audit.

## Step Results

### Step 1 — Spec drift detection
**Status:** PASS

All eight published specs at dillweed.com (served at root paths, e.g.
`/anthill-spec.html`) match the version of their counterpart in
`~/dillweed-namespace-repo/specs/`:

| Spec | Repo | Published | Match |
|------|------|-----------|-------|
| anthill-spec | v0.1.3 | v0.1.3 | ✅ |
| dillclaw-spec | v0.1.8 | v0.1.8 | ✅ |
| registry-spec | v0.1.6 | v0.1.6 | ✅ |
| namespace-standard | v0.4.4 | v0.4.4 | ✅ |
| governance | v1.1.3 | v1.1.3 | ✅ |
| continuity-protocol | v1.0.3 | v1.0.3 | ✅ |
| dnso-operations-charter | v1.0.3 | v1.0.3 | ✅ |
| standards-overview | v1.0.10 | v1.0.10 | ✅ |

Capability check: `review.spec.read` and `review.website.fetch` — both ALLOWED
+ DillClaw-verified. (See FINDING 2 for a site-hygiene observation noted during
this step.)

### Step 2 — Version consistency
**Status:** PASS

README.md, docs/release-notes/v1.0.0-release-notes.md, docs/operations-runbook.md,
and PROJECT_LEDGER.md all agree on the current component versions:
**Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.6**. Older version strings
present in PROJECT_LEDGER.md (e.g. 0.1.4 / 0.1.5 / 0.1.7) are historical
convergence-and-patch narrative entries, not current-version claims, and are
internally consistent with the documented post-v1 Anthill v0.1.5 → v0.1.6 patch.

Capability check: `review.repo.read` — ALLOWED + verified.

### Step 3 — SHA verification
**Status:** PASS

The three tarball SHA256 values in README.md and the v1.0.0 release notes match
each other, the GitHub Release body, and — decisively — the authoritative
GitHub release **asset digests**:

| Component | Documented SHA256 | GitHub asset digest | Match |
|-----------|-------------------|---------------------|-------|
| Registry  | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | identical | ✅ |
| Resolver  | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | identical | ✅ |
| Anthill   | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | identical | ✅ |

All three also match the expected canonical values in CLAUDE.md. Publication
integrity is intact. (See FINDING 1 and FINDING 3 for two cosmetic/anomaly
observations from this step.)

Capability check: `review.release.verify` — ALLOWED + verified.

### Step 4 — Trust root verification
**Status:** PASS

Fetched `https://dillweed.com/dnso_public.pem` (Ed25519 public key) byte-exact.
Computed SHA256:

```
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

This matches the canonical value referenced in every document: README.md (×2),
docs/operations-runbook.md (×7), docs/release-notes/v1.0.0-release-notes.md, and
PROJECT_LEDGER.md (×2). No divergence.

Capability check: `review.website.fetch` — ALLOWED + verified.

### Step 5 — Deployment health check
**Status:** PASS

| Service | Endpoint | status | Notes |
|---------|----------|--------|-------|
| Registry | localhost:9475/health | `ok` | `dillweed-registry/0.2.8`, mode `authoritative`, 27 capabilities |
| Resolver | localhost:9474/health | `ok` | `dillclaw/0.1.8`, `registry.source: "remote"` ✅, `dnso_key.configured: true` ✅, `last_error: null` |
| Anthill  | localhost:9476/health | `ok` | `dillweed-anthill/0.1.6`, 117 signals received |

All required conditions met, including the Resolver remote-source and
configured-trust-root checks.

Capability check: `review.repo.read` — ALLOWED + verified.

### Step 6 — Capability resolution verification
**Status:** PASS

All nine steward capabilities resolved through DillClaw (localhost:9474) and
returned `sig_valid` and `sig_verified` trust signals
(`dnso_verified,sig_valid,sig_verified,endpoint_unchecked`, exit 0):

- ✅ `dillweed://review.spec.read`
- ✅ `dillweed://review.repo.read`
- ✅ `dillweed://review.website.fetch`
- ✅ `dillweed://review.release.verify`
- ✅ `dillweed://review.report.write`
- ✅ `dillweed://review.issue.suggest`
- ✅ `dillweed://review.issue.open`
- ✅ `dillweed://review.patch.propose`
- ✅ `dillweed://ledger.update.propose`

Capability check: `review.release.verify` — ALLOWED + verified.

## Findings

1. **(LOW–MEDIUM) Anomalous Anthill v0.1.6 release-asset size.** The published
   `dillweed-anthill-v0.1.6.tar.gz` GitHub asset is **9,907,578 bytes (~9.9 MB)**,
   whereas the Registry (52,012 B) and Resolver (51,291 B) assets are ~50 KB and
   the previously documented Anthill v0.1.5 tarball was 35.79 KiB
   (PROJECT_LEDGER.md). A ~280× size increase for what the release notes
   describe as a cosmetic post-v1 patch (v0.1.5 → v0.1.6, fixing AS-006) is
   anomalous and suggests the tarball may have inadvertently bundled build
   artifacts or `node_modules`. The asset SHA256 matches all documentation, so
   publication integrity is intact — this is a content/packaging concern, not a
   tampering concern.

2. **(LOW / cosmetic) Stale public-site navigation frame.** dillweed.com is a
   frameset; the real content lives in `fr_main.htm` and the root-level spec
   pages. The navigation frame `fr_conten.htm` serves stale/placeholder
   directory links unrelated to the project (bookstore, film, museums,
   `cdnow.com`, `scout.cs.wisc.edu`) rather than links to the published
   specifications. Public-facing site-hygiene issue; no impact on spec content
   or trust root.

3. **(INFO / cosmetic) Trailing whitespace in release-body SHA cell.** The
   Anthill SHA256 cell in the v1.0.0 GitHub Release body table renders with a
   trailing space (`...574f36 `). The hash value itself is correct; cosmetic
   only, but could trip naive string-equality SHA comparisons.

## Suggested Issues

*(Draft text only — opening issues requires human approval per boundary policy.)*

**Issue A — Audit anomalous size of Anthill v0.1.6 release tarball**
> **Title:** Audit Anthill v0.1.6 release tarball — ~9.9 MB vs ~50 KB peers
>
> **Body:** The `dillweed-anthill-v0.1.6.tar.gz` v1.0.0 release asset is
> ~9.9 MB, versus ~50 KB for the Registry and Resolver assets and 35.79 KiB for
> the documented Anthill v0.1.5 build. The v0.1.5 → v0.1.6 change is documented
> as a cosmetic AS-006 fix, so this ~280× growth is unexpected. Please verify
> the tarball does not inadvertently include `node_modules`/build artifacts, and
> re-cut + re-publish (preserving documented SHA discipline) if it does. Asset
> SHA256 currently matches all docs, so this is a packaging concern, not an
> integrity concern.

**Issue B — Repair or remove stale dillweed.com navigation frame**
> **Title:** Public site nav frame (fr_conten.htm) serves unrelated placeholder links
>
> **Body:** The dillweed.com frameset's navigation frame `fr_conten.htm`
> currently lists unrelated directory links (bookstore, film, museums, cdnow.com,
> scout.cs.wisc.edu) instead of links to the eight published specifications.
> Recommend replacing it with a proper spec/nav index (or removing the frameset
> in favor of the working root-level pages).

**Issue C — Strip trailing whitespace from Anthill SHA in release body**
> **Title:** Trailing space in Anthill SHA256 cell of v1.0.0 release body
>
> **Body:** The Anthill SHA256 table cell in the v1.0.0 GitHub Release body has
> a trailing space after the hash. Cosmetic, but can break naive
> string-equality SHA checks. Trim it on the next release-notes edit.

## Proposed Ledger Entry

*(Draft only — modifying PROJECT_LEDGER.md requires human approval.)*

> #### Steward consistency sweep — 2026-06-11 (PASS, 3 low-severity findings)
>
> Full tri-surface consistency sweep (specs @ dillweed.com, repo, live
> deployment). Steps 1–6 all PASS: 8/8 spec versions match repo; current
> versions agree (Registry v0.2.8 / Resolver v0.1.8 / Anthill v0.1.6); 3/3
> tarball SHA256s verify against GitHub asset digests; trust-root PEM SHA256
> `909891…deb6f33` matches all docs; 3/3 services healthy (Resolver remote +
> dnso_key configured); 9/9 capabilities resolve `sig_valid`+`sig_verified`.
> Findings: (1) Anthill v0.1.6 release asset ~9.9 MB vs ~50 KB peers — packaging
> audit recommended (SHA matches docs); (2) stale dillweed.com nav frame
> `fr_conten.htm`; (3) trailing space in release-body Anthill SHA cell. No
> integrity failures. Report:
> reports/steward-report-2026-06-11.md.
