# Dillweed Protocol Steward — Review Report

**Date:** 2026-05-25
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

A full consistency sweep was performed across the three authoritative surfaces of
the Dillweed Namespace Project (published specifications at dillweed.com, the source
repository at `~/dillweed-namespace-repo`, and the running deployment on `dill-p-001`).
Five of the six checks passed cleanly. **One finding** was identified: the **Anthill
component version is inconsistent** across surfaces — the running deployment and the
component source (`server.js`) report **v0.1.6**, and the project ledger records a
v0.1.6 bump on 2026-05-24, but `anthill/package.json`, `README.md`, the v1.0.0 release
notes, and the operations runbook all still cite **v0.1.5**. Registry (v0.2.8) and
Resolver (v0.1.8) are fully consistent. All published specs are byte-identical to the
repository, all tarball SHAs match the GitHub Release (including the actual asset
digests), the trust root matches its canonical SHA everywhere, all three services are
healthy, and all nine steward capabilities resolve through DillClaw with valid,
verified DNSO signatures. One minor secondary observation is noted under Findings.

Every step was gated by `enforce-boundary.sh`; each required capability was
boundary-allowed and DillClaw-verified before execution.

## Step Results

### Step 1 — Spec drift detection
**Status:** PASS
**Capability:** `review.spec.read` + `review.website.fetch` (both ALLOWED + verified)

All eight published specs were fetched from dillweed.com and compared against
`~/dillweed-namespace-repo/specs/`. Top-level version numbers match on every document,
and a normalized content hash (whitespace-stripped, blank lines removed) of each
published page is **identical** to its repository source. The only byte-level delta is
a single trailing newline present in the local files and absent from the served copies
— not a content divergence.

| Spec | Repo version | Published version | Content |
|------|--------------|-------------------|---------|
| anthill-spec.html | v0.1.2 | v0.1.2 | identical |
| continuity-protocol.html | v1.0.3 | v1.0.3 | identical |
| dillclaw-spec.html | v0.1.3 | v0.1.3 | identical |
| dnso-operations-charter.html | v1.0.3 | v1.0.3 | identical |
| governance.html | v1.1.3 | v1.1.3 | identical |
| namespace-standard.html | v0.4.3 | v0.4.3 | identical |
| registry-spec.html | v0.1.4 | v0.1.4 | identical |
| standards-overview.html | v1.0.10 | v1.0.10 | identical |

No drift between website and repository. (See Finding 2 for a stale *internal*
component table inside the standards-overview document — present identically on both
surfaces, so not drift.)

### Step 2 — Version consistency
**Status:** FINDING
**Capability:** `review.repo.read` (ALLOWED + verified)

Expected current versions per project instructions: **Registry v0.2.8, Resolver
v0.1.8, Anthill v0.1.5**.

| Component | README | Release notes | Runbook | package.json | server.js / running | Ledger (latest) |
|-----------|--------|---------------|---------|--------------|---------------------|-----------------|
| Registry | 0.2.8 | 0.2.8 | 0.2.8 | 0.2.8 | 0.2.8 | 0.2.8 |
| Resolver | 0.1.8 | 0.1.8 | 0.1.8 | 0.1.8 | 0.1.8 | 0.1.8 |
| Anthill  | **0.1.5** | **0.1.5** | **0.1.5** | **0.1.5** | **0.1.6** | **0.1.6** |

Registry and Resolver agree on every surface. **Anthill does not.** The component has
been advanced to v0.1.6 in `anthill/server.js` (`const VERSION = 'dillweed-anthill/0.1.6'`),
the running deployment's `/health` endpoint reports `dillweed-anthill/0.1.6`, and the
ledger entry dated **2026-05-24** records "Anthill v0.1.6" with commits `7a553f1`
(AS-006 test fix, req.destroy fix, Keychain fallback) and `da6ab0c` (version bump).
However `anthill/package.json` still declares `"version": "0.1.5"`, and the three
human-facing documents (README, v1.0.0 release notes, operations runbook) all still
cite v0.1.5. See Finding 1.

### Step 3 — SHA verification
**Status:** PASS
**Capability:** `review.release.verify` (ALLOWED + verified)

All three tarball SHA256 values match across README, the v1.0.0 release notes, the
GitHub Release body, **and the actual GitHub Release asset digests** (computed by
GitHub from the uploaded files):

| Tarball | SHA256 | Match |
|---------|--------|-------|
| dillweed-registry-v0.2.8.tar.gz | f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a | ✅ all surfaces |
| dillweed-resolver-v0.1.8.tar.gz | 2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a | ✅ all surfaces |
| dillweed-anthill-v0.1.5.tar.gz  | dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b | ✅ all surfaces |

All three equal the expected canonical values. (These are the v0.1.5 Anthill release
assets; the v0.1.6 work noted in Finding 1 has not been cut as a release.)

### Step 4 — Trust root verification
**Status:** PASS
**Capability:** `review.website.fetch` (ALLOWED + verified)

`https://dillweed.com/dnso_public.pem` was fetched and its SHA256 computed over the
served bytes:

```
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

This equals the canonical value, and the same value is referenced — with no conflicting
hashes — in every document that cites it: `README.md`, `docs/operations-runbook.md`,
`docs/release-notes/v1.0.0-release-notes.md`, and `PROJECT_LEDGER.md`. The Registry's
own `/health` confirms `public_key_url: https://dillweed.com/dnso_public.pem`.

### Step 5 — Deployment health check
**Status:** PASS
**Capability:** `review.repo.read` (ALLOWED + verified)

| Service | Port | status | Version reported | Notes |
|---------|------|--------|------------------|-------|
| Registry | 9475 | ok | dillweed-registry/0.2.8 | 16 capabilities (1 experimental, 2 trusted, 13 verified); Ed25519 (DNSO) |
| Resolver | 9474 | ok | dillclaw/0.1.8 | `registry.source: remote` ✅, `dnso_key.configured: true` ✅, 16 records, no errors |
| Anthill  | 9476 | ok | dillweed-anthill/0.1.6 | 117 signals received; token required |

All three return `"status": "ok"`, and both Resolver conditions are met. The Anthill
version reported here (**0.1.6**) corroborates Finding 1.

### Step 6 — Capability resolution verification
**Status:** PASS
**Capability:** `review.release.verify` (ALLOWED + verified)

All nine steward capabilities resolve through DillClaw with both `sig_valid` and
`sig_verified` present (trust signals: `dnso_verified, sig_valid, sig_verified,
endpoint_unchecked`; trust_score 0.591):

| Capability | sig_valid | sig_verified |
|-----------|-----------|--------------|
| dillweed://review.spec.read | ✅ | ✅ |
| dillweed://review.repo.read | ✅ | ✅ |
| dillweed://review.website.fetch | ✅ | ✅ |
| dillweed://review.release.verify | ✅ | ✅ |
| dillweed://review.report.write | ✅ | ✅ |
| dillweed://review.issue.suggest | ✅ | ✅ |
| dillweed://review.issue.open | ✅ | ✅ |
| dillweed://review.patch.propose | ✅ | ✅ |
| dillweed://ledger.update.propose | ✅ | ✅ |

## Findings

1. **(MEDIUM) Anthill version is inconsistent across surfaces.** The running
   deployment and `anthill/server.js` report **v0.1.6**, and the ledger records a
   v0.1.6 bump on 2026-05-24 (commits `7a553f1`, `da6ab0c`), but `anthill/package.json`
   still declares `0.1.5` and the three human-facing documents — `README.md`,
   `docs/release-notes/v1.0.0-release-notes.md`, and `docs/operations-runbook.md` —
   all still cite v0.1.5. A reader trusting the published documentation would believe
   v0.1.5 is current; the deployment is actually one patch ahead. Most likely the
   version bump was applied to `server.js` (and recorded in the ledger) but
   `package.json` and the docs were not updated, and no v0.1.6 release was cut.
   - Sub-item (trivial): `anthill/server.js:855` carries a stale comment
     (`// 'dillweed-anthill/0.1.5' → '0.1.4'`) that no longer reflects the current
     `VERSION` constant.

2. **(LOW) `standards-overview.html` component table is stale.** The overview lists
   *Namespace Standard v0.4.2* and *Registry Specification v0.1.3*, while the actual
   published specs are *namespace-standard v0.4.3* and *registry-spec v0.1.4*. This is
   identical on both the website and the repo (so it is **not** website↔repo drift —
   Step 1 still passes), but it is an internal cross-reference that has fallen behind
   the specs it summarizes.

## Suggested Issues

### Issue 1 — Anthill version inconsistency (v0.1.5 vs v0.1.6) across docs and package.json
**Title:** Anthill version inconsistent: deployment/server.js report v0.1.6 but package.json, README, release notes, and runbook say v0.1.5

**Body:**
> The Anthill component version is reported inconsistently across the project's
> surfaces, discovered during the 2026-05-25 steward consistency sweep.
>
> **Reports v0.1.6:**
> - `anthill/server.js` — `const VERSION = 'dillweed-anthill/0.1.6'`
> - Running deployment on dill-p-001 — `GET http://localhost:9476/health` →
>   `"version": "dillweed-anthill/0.1.6"`
> - `PROJECT_LEDGER.md` — 2026-05-24 entry "Anthill v0.1.6" (commits `7a553f1`,
>   `da6ab0c`)
>
> **Still says v0.1.5:**
> - `anthill/package.json` — `"version": "0.1.5"`
> - `README.md` — Anthill row and install section
> - `docs/release-notes/v1.0.0-release-notes.md`
> - `docs/operations-runbook.md` — service inventory table and recovery steps
>
> **Recommendation:** Decide the intended current version. If v0.1.6 is the current
> patch, bump `anthill/package.json` to `0.1.6` and update README and the operations
> runbook to match (the v1.0.0 release notes are a frozen historical artifact and may
> legitimately remain at v0.1.5, with v0.1.6 documented in its own release notes). If
> v0.1.6 was not meant to ship, revert `server.js` and redeploy v0.1.5. Also fix the
> stale comment at `anthill/server.js:855`.
>
> *Filed by the Dillweed Protocol Steward (read-only review). No code changed.*

### Issue 2 — standards-overview component table lists outdated spec versions
**Title:** standards-overview.html lists Namespace Standard v0.4.2 / Registry Spec v0.1.3, but actual specs are v0.4.3 / v0.1.4

**Body:**
> During the 2026-05-25 steward sweep, the component/version table in
> `specs/standards-overview.html` (v1.0.10) was found to reference outdated spec
> versions:
>
> | Component | Overview says | Actual spec (web + repo) |
> |-----------|---------------|--------------------------|
> | Namespace Standard | v0.4.2 | v0.4.3 |
> | Registry Specification | v0.1.3 | v0.1.4 |
>
> Both the published page and the repository source agree with each other (so this is
> not website↔repo drift), but the overview's summary table has fallen behind the
> specifications it indexes.
>
> **Recommendation:** Update the standards-overview component table to v0.4.3
> (Namespace Standard) and v0.1.4 (Registry Specification), and bump the overview's own
> revision. Note that publishing a corrected page would require a `site.publish`
> action, which is outside the steward agent's boundary.
>
> *Filed by the Dillweed Protocol Steward (read-only review). No code changed.*

## Proposed Ledger Entry

> ### 2026-05-25 — Steward consistency sweep (review-only)
>
> **Operator:** Richard McClelland
> **Agent:** dillweed.protocol-steward (review-and-recommend, read-only)
>
> Full 6-check sweep across specs / repo / deployment. Result: 5 PASS, 1 FINDING.
>
> - **Step 1 Spec drift — PASS.** All 8 published specs byte-identical (normalized) to
>   `specs/`; all top-level versions match.
> - **Step 2 Version consistency — FINDING.** Registry v0.2.8 and Resolver v0.1.8
>   consistent everywhere. Anthill inconsistent: server.js + running deployment +
>   2026-05-24 ledger entry at **v0.1.6**, but package.json + README + v1.0.0 release
>   notes + operations runbook still at **v0.1.5**.
> - **Step 3 SHA verification — PASS.** All three tarball SHA256 match README, release
>   notes, GitHub Release body, and actual asset digests.
> - **Step 4 Trust root — PASS.** Served dnso_public.pem = canonical
>   `909891e9…6f33`; consistent across all referencing docs.
> - **Step 5 Deployment health — PASS.** All three services `status: ok`; Resolver
>   `registry.source=remote`, `dnso_key.configured=true`. Anthill /health reports
>   0.1.6 (corroborates the finding).
> - **Step 6 Capability resolution — PASS.** All 9 steward capabilities resolve with
>   `sig_valid` + `sig_verified`.
>
> Two issues drafted for steward review (Anthill version inconsistency; stale
> standards-overview component table). No artifacts modified; no commits, no publishes.
>
> *(Proposed by the steward agent — requires human approval before being written to
> PROJECT_LEDGER.md.)*
