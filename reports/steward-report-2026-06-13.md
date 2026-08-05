# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-13
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

Tri-surface consistency sweep across the published specifications (dillweed.com),
the source repository (`~/dillweed-namespace-repo`), and the running deployment on
dill-p-001 (ports 9474/9475/9476). All six integrity checks **PASS**: 8/8 specs
match byte-for-byte, all version references agree (Registry v0.2.8 / Resolver v0.1.8 /
Anthill v0.1.6), all three tarball SHA256s verify against the GitHub Release **asset
digests**, the trust-root PEM SHA256 matches every document, all three services are
healthy, and all nine steward capabilities resolve with `sig_valid` + `sig_verified`
through DillClaw. No integrity failures and no new findings. The three low-severity,
cosmetic/packaging findings from the 2026-06-11 sweep remain open (none affect
integrity). Every capability used in this sweep was verified through
`enforce-boundary.sh` before execution.

## Step Results

### Step 1 — Spec drift detection
**Status:** PASS
Capabilities `review.spec.read` + `review.website.fetch` boundary-allowed and
DillClaw-verified. All 8 published specs fetched from dillweed.com and compared
byte-for-byte (SHA256) against `~/dillweed-namespace-repo/specs/`:
registry-spec, dillclaw-spec, anthill-spec, namespace-standard, governance,
dnso-operations-charter, continuity-protocol, standards-overview — **8/8 MATCH**.
No divergence in content, version, or timestamps.

### Step 2 — Version consistency
**Status:** PASS
Capability `review.repo.read` verified. README.md, docs/release-notes/v1.0.0-release-notes.md,
docs/operations-runbook.md, and PROJECT_LEDGER.md all agree on the current versions:
**Registry v0.2.8 / Resolver v0.1.8 / Anthill v0.1.6**. The deployment `/health`
endpoints report matching versions (`dillweed-registry/0.2.8`, `dillclaw/0.1.8`,
`dillweed-anthill/0.1.6`).
*Note (not a finding):* PROJECT_LEDGER.md contains dated historical entries (the
original v1.0.0 ship manifest, ~lines 568–604) that reference the pre-INST-013
Anthill **v0.1.5** / SHA `dda1430b…`. These are append-only historical records of a
superseded build, consistent with the ledger's stated purpose; the current-state
summary (line 31) correctly reads v0.1.6. No action required.

### Step 3 — SHA verification
**Status:** PASS
Capability `review.release.verify` verified. The three tarball SHA256 values in
README.md and the release notes were checked against the **GitHub Release asset
digests** (`gh release view v1.0.0`), not merely the release body text:

| Component | Expected SHA256 | GitHub asset digest | Result |
|-----------|-----------------|---------------------|--------|
| Registry v0.2.8 | `f0e329f5…d2361a` | `f0e329f5…d2361a` | MATCH |
| Resolver v0.1.8 | `2e3376a5…c814f0a` | `2e3376a5…c814f0a` | MATCH |
| Anthill v0.1.6  | `3bda022d…f574f36` | `3bda022d…f574f36` | MATCH |

All 3 match. (See Findings F1/F3 for non-integrity packaging/cosmetic observations.)

### Step 4 — Trust root verification
**Status:** PASS
Capability `review.website.fetch` verified. Fetched `https://dillweed.com/dnso_public.pem`
(113 bytes, `-----BEGIN PUBLIC KEY-----`) and computed SHA256
`909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` — matches the
canonical value referenced in README.md, PROJECT_LEDGER.md, operations-runbook.md,
the release notes, and resolver/install.sh. No divergence.

### Step 5 — Deployment health check
**Status:** PASS
Capability `review.repo.read` verified.
- Registry (9475): `status: ok`, `registry-version: dillweed-registry/0.2.8`, 27 capabilities, authoritative.
- Resolver (9474): `status: ok`, `resolver_version: dillclaw/0.1.8`, **`registry.source: remote`**, **`dnso_key.configured: true`** (ed25519), `last_error: null`.
- Anthill (9476): `status: ok`, `version: dillweed-anthill/0.1.6`, 117 signals received.

### Step 6 — Capability resolution verification
**Status:** PASS
Capability `review.release.verify` verified. All nine steward capabilities resolved
through DillClaw (localhost:9474), each returning trust signals
`dnso_verified,sig_valid,sig_verified,endpoint_unchecked`:
review.spec.read, review.repo.read, review.website.fetch, review.release.verify,
review.report.write, review.issue.suggest, review.issue.open, review.patch.propose,
ledger.update.propose — **9/9 verified**.

## Findings

All findings are **low-severity** and carry over from the 2026-06-11 sweep; none
affects cryptographic integrity (all SHAs and signatures verify). Re-confirmed present
on 2026-06-13.

1. **F1 — Anthill release asset size anomaly (root cause confirmed 2026-06-13).**
   `dillweed-anthill-v0.1.6.tar.gz` is 9,907,578 bytes (~9.9 MB) versus ~50 KB for the
   Registry and Resolver tarballs (Anthill v0.1.5 was 35.79 KiB). The published SHA
   matches the asset digest, so integrity is intact — this is a packaging-hygiene issue,
   not a tampering issue.

   **Root cause:** the v0.1.6 build packaged the working tree as-is (post-`npm install`,
   post-run) rather than a clean source export. Of 532 entries, **509 are under
   `node_modules/` (27.77 MB uncompressed); the actual source is only ~0.24 MB.** The bulk
   is `better-sqlite3` shipping its full native build tree:
   - `deps/sqlite3/sqlite3.c` — 9.03 MB, plus a **second copy** at
     `build/Release/obj/gen/sqlite3/sqlite3.c` — another 9.03 MB
   - `build/Release/sqlite3.a` (2.56 MB), `…/sqlite3.o` (2.55 MB),
     `build/Release/better_sqlite3.node` (1.78 MB, a macOS-built native addon)

   The bundled `node_modules` is **entirely redundant**: `install.sh:264` runs
   `npm install --silent`, so dependencies (`better-sqlite3 ^9.4.3`, `dotenv ^17.4.2`)
   are rebuilt from `package.json` on the target. This is why the peers stay ~50 KB and
   why v0.1.5 (which did not bundle node_modules) was 35.79 KiB.

   **Related hygiene note:** the tarball also ships a populated runtime database —
   `data/anthill.db` (61 KB) plus `anthill.db-shm` (32 KB) and `anthill.db-wal` — beside a
   `.gitkeep` that indicates `data/` was meant to ship empty. A build-machine SQLite DB in
   a public release artifact may contain logged signals/telemetry; it should be excluded.

   **Recommended fix:** rebuild from a clean checkout (or exclude `node_modules/`, `build/`,
   and `data/*.db*` via the packaging manifest), regenerate the asset, and update the
   README + release-notes + GitHub Release SHA accordingly.

2. **F2 — Stale placeholder nav frame on dillweed.com.** `https://dillweed.com/fr_conten.htm`
   (HTTP 200) serves an unrelated placeholder navigation frame with links such as
   `tc_bookstore.htm`, `tc_business.htm`, `tc_dictionary.htm`, `tc_film.htm`,
   `tc_museums.htm` — leftover hosting-template content unrelated to the Dillweed
   project. Not referenced by the canonical spec pages, but publicly reachable on the
   spec host. Recommend removal.

3. **F3 — Trailing whitespace in GitHub Release body.** Line 9 of the v1.0.0 release
   body has a trailing space inside the Anthill SHA256 backtick
   (`` `3bda022d…f574f36 ` ``). Cosmetic only; the authoritative asset digest is clean
   and verified. Recommend trimming if the release body is next edited.

## Suggested Issues

Drafted under `review.issue.suggest` (boundary-allowed, verified) for human review.
**No issue has been opened** — `review.issue.open` requires human approval (see below).

### Issue 1 — Anthill v0.1.6 tarball is ~200× larger than peer components (node_modules + build artifacts packaged)
> **Title:** Repackage `dillweed-anthill-v0.1.6.tar.gz`: it bundles `node_modules` (9.9 MB vs ~50 KB peers)
>
> **Body:**
> The v1.0.0 release asset `dillweed-anthill-v0.1.6.tar.gz` is 9,907,578 bytes (~9.9 MB),
> whereas `dillweed-registry-v0.2.8.tar.gz` (~52 KB) and `dillweed-resolver-v0.1.8.tar.gz`
> (~51 KB) are ~50 KB, and the prior Anthill v0.1.5 tarball was 35.79 KiB. The published
> SHA256 matches the GitHub asset digest, so this is **not** an integrity problem — it is a
> packaging regression.
>
> **Root cause (verified):** the v0.1.6 build tarred the working tree as-is rather than a
> clean source export. 509 of 532 entries live under `node_modules/` (27.77 MB uncompressed);
> the actual source is ~0.24 MB. The bulk is `better-sqlite3` shipping its full native build
> tree, including two 9.03 MB copies of `sqlite3.c` (`deps/sqlite3/sqlite3.c` and
> `build/Release/obj/gen/sqlite3/sqlite3.c`), plus `sqlite3.a` (2.56 MB), `sqlite3.o`
> (2.55 MB), and a macOS-built `better_sqlite3.node` (1.78 MB). The bundled `node_modules`
> is redundant: `install.sh:264` runs `npm install --silent`, so deps are rebuilt from
> `package.json` on the target (which is why the peers and v0.1.5 stayed small).
>
> The tarball additionally ships a populated runtime DB — `data/anthill.db` (61 KB),
> `anthill.db-shm` (32 KB), `anthill.db-wal` — beside a `.gitkeep` indicating `data/` was
> meant to ship empty; a build-machine database should not be in a public release artifact.
>
> **Requested:** Rebuild `dillweed-anthill-v0.1.6.tar.gz` from a clean checkout (or exclude
> `node_modules/`, `build/`, and `data/*.db*` via the packaging manifest), then update the
> README, release notes, and the GitHub Release asset + SHA256 to match the new artifact.
> **Severity:** low (integrity intact; distribution-size + build-hygiene + minor data-exposure concern).

### Issue 2 — Remove stale placeholder page `fr_conten.htm` from dillweed.com
> **Title:** Remove unrelated placeholder nav frame `fr_conten.htm` from dillweed.com
>
> **Body:**
> `https://dillweed.com/fr_conten.htm` returns HTTP 200 and serves a leftover hosting-template
> navigation frame with links unrelated to the project (`tc_bookstore.htm`, `tc_business.htm`,
> `tc_dictionary.htm`, `tc_film.htm`, `tc_museums.htm`, …). It is not referenced by the
> canonical spec stack but is publicly reachable on the specification host.
>
> **Requested:** Remove the stale placeholder file(s) from the dillweed.com document root.
> **Severity:** low (cosmetic/hosting-hygiene; no impact on specs or trust root).

### Issue 3 — Trim trailing whitespace in v1.0.0 release body Anthill SHA cell
> **Title:** Cosmetic: trailing space in v1.0.0 release-body Anthill SHA256 cell
>
> **Body:**
> Line 9 of the v1.0.0 GitHub Release body contains a trailing space inside the Anthill
> SHA256 backtick (`` `3bda022d…f574f36 ` ``). The authoritative asset digest is clean and
> verifies correctly; this affects only the rendered release-body text.
>
> **Requested:** Trim the trailing space the next time the release body is edited.
> **Severity:** low (cosmetic; no integrity impact).

## Proposed Ledger Entry

*Proposed only — `ledger.update.propose` requires human approval; PROJECT_LEDGER.md
has NOT been modified by the agent.*

```markdown
### STEWARD-SWEEP-2026-06-13 — Tri-surface consistency sweep (PASS, 0 new findings)

- **Status:** COMPLETE 2026-06-13. Review-and-recommend sweep; no integrity failures.
- **Scope:** Specs @ dillweed.com vs ~/dillweed-namespace-repo vs live deployment (dill-p-001).
- **Result:** Steps 1–6 all PASS.
  - 8/8 specs match repo byte-for-byte (SHA256).
  - Versions agree: Registry v0.2.8 / Resolver v0.1.8 / Anthill v0.1.6 (README,
    release-notes, runbook, ledger current-state, and live /health).
  - 3/3 tarball SHA256s verify against GitHub release **asset digests**.
  - Trust-root PEM SHA256 909891e9…deb6f33 matches all docs.
  - 3/3 services healthy; Resolver registry.source: remote + dnso_key.configured: true.
  - 9/9 steward capabilities resolve sig_valid + sig_verified via DillClaw.
- **Findings:** No new findings. The 3 low-severity findings from STEWARD-SWEEP-2026-06-11
  (F1 Anthill ~9.9 MB tarball; F2 stale fr_conten.htm nav frame; F3 trailing whitespace in
  release-body Anthill SHA cell) remain OPEN and were re-confirmed present.
- **Report:** reports/steward-report-2026-06-13.md
```
