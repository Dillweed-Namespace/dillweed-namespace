# PRESERVATION.md — Dillweed v1 Preservation Baseline

**Status:** FINAL — authoritative. Preservation content committed at 58e51e6 (2026-07-21); §29 checklist complete. The one deferred action is the GitHub release-body preservation note (§9), applied when the release is updated; it is outside this repository.
**Authoritative source:** This file is the authoritative human-readable status of the
preserved v1 baseline. Where it conflicts with `ARCHIVAL_MANIFEST.json`, this file governs
prose interpretation and the manifest governs machine-readable values; the two are kept in
agreement.
**See also:** `docs/dillweed-v1-preservation-and-transition-plan.md` (the full plan this
file executes), `docs/finding-disposition-index-2026-06.md`, `ARCHIVAL_MANIFEST.json`.

---

## 1. Baseline identification

| Field | Value | Verification |
|---|---|---|
| Repository | https://github.com/Dillweed-Namespace/dillweed-namespace | VERIFIED |
| Final behavioral commit | `8c87a85` (2026-06-10) | VERIFIED (plan §6) |
| Preservation commit | `58e51e6` (content) — this reference recorded in the immediately following commit | VERIFIED |
| Archival tag | `dillweed-v1-preservation-baseline` (annotated, unsigned; applied to the reference-recording commit) | APPLIED |
| Component versions | Registry 0.2.8 · Resolver 0.1.8 · Anthill 0.1.6 · MCP server 1.0.0 | VERIFIED |
| Version caveat (FDI-XST-007) | W0 hardening changed Registry and Resolver runtime behavior after the v1.0.0 tarballs were built, without bumping version strings. **Version strings do not identify the baseline; commits do.** | VERIFIED |
| Trust root | `https://dillweed.com/dnso_public.pem`, SHA-256 `909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33` | VERIFIED — live key re-fetched and hashed 2026-07-21, matches (item 6) |
| License | Apache-2.0 | VERIFIED |
| Review provenance | Reviews AI-assisted, steward-commissioned (ledger AI-008). **Not** independent third-party assessment or peer review. | VERIFIED |

---

## 2. Test execution at the preservation baseline

*Executed 2026-07-21 on dill-p-001 against the running reference deployment. This section
records the first independent execution of the suites for the preservation record; prior
counts in `README.md` / `v2-tracker.md` were REPORTED, not independently verified.*

**Runtime:** Node.js v22.22.2 (confirmed on dill-p-001 2026-07-21; matches v1.0.0 release notes), macOS (Apple Silicon reference host dill-p-001).

| Suite | Command | Result | Status |
|---|---|---|---|
| Registry | `bash registry/test.sh` (auth required — see below) | **79 passed / 0 failed** | CLEAN |
| Resolver unit | `node resolver/unit-tests.js` | **29 passed / 0 failed** | CLEAN |
| Anthill | `bash anthill/test.sh` | **58 passed / 0 failed** | CLEAN |
| Integration | `bash integration-test.sh` | **19 passed / 0 failed** | CLEAN — full lifecycle incl. 90 s revocation-propagation wait |
| Resolver conformance | `bash resolver/test.sh` | **63 passed / 2 failed** | 2 failures classified below — NOT resolver defects |

### 2.1 Reproduction note — registry tests require authentication

`registry/test.sh` reads `REGISTRY_ADMIN_TOKEN` from the environment. The running
deployment is token-gated, so without the token every write-endpoint test returns HTTP 401
(observed as 38 identical `UNAUTHORIZED` failures on the first run — an environmental
condition, not defects). Retrieve the token from the macOS Keychain and export it:

```bash
export REGISTRY_ADMIN_TOKEN=$(security find-generic-password -s "dillweed-registry" -a "registry-admin" -w)
bash registry/test.sh   # → 79/79
```

The registry write path is independently corroborated by `integration-test.sh`
(register / verify / revoke / re-register, 19/19).

### 2.2 Resolver conformance — 2 residual failures, both classified as non-defects

The `resolver/test.sh` suite on disk is labeled **v0.1.9**, one minor version ahead of the
shipped/tagged resolver **v0.1.8** (running server reports `resolver_version: dillclaw/0.1.8`).
This test-ahead-of-server drift is consistent with the FDI-XST-007 version-drift caveat.

Of the five failures on the first run:

- **Three (RS2-001 cluster)** failed with `NO_MATCH` because the `tools.order.test`
  @1.0.0 / @2.0.0 fixtures documented in the test's own manual setup block (lines 387–405)
  were not loaded. After registering those fixtures, RS2-001 passes 3/3. **Environmental —
  missing manual fixtures.**
- **Two (RS-005 `version_pref 'latest'`, RS2-004 `sig_unverified`)** remain after fixture
  loading. Both require a genuinely *unsigned* fixture record, which cannot be produced via
  registry `/register` — all registered records receive a DNSO signature. The test's setup
  block assumes unsigned fixtures the standard registration path does not create. **Not a
  resolver defect; a test-fixture / version-drift artifact.**

**No defect in the preserved v1 code is indicated by any suite.** Fixtures registered for
this verification were revoked afterward (registry returned to pre-test state; the
register/revoke actions remain in the append-only audit log by design).

---

## 3. Release asset audit (checklist item 3 / FDI-OPS-010)

*Performed 2026-07-21. All three v1.0.0 release assets authenticated against the SHA-256
values published in the GitHub release body and README.*

| Asset | SHA-256 | Size | Result |
|---|---|---|---|
| `dillweed-registry-v0.2.8.tar.gz` | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` | 50.79 KiB | Matches release; clean source-only (15 entries) |
| `dillweed-resolver-v0.1.8.tar.gz` | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` | 50.08 KiB | Matches release; clean source-only (16 entries) |
| `dillweed-anthill-v0.1.6.tar.gz` | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` | 9.44 MiB | Matches release; **bloated — see §3.1** |

### 3.1 Anthill v0.1.6 packaging anomaly — VERIFIED (FDI-OPS-010)

The asset SHA-256 matches the release, so **integrity is intact**; this is a
distribution-hygiene defect, not tampering. Of 532 tarball entries, **512 are under
`node_modules/`**, dominated by the `better-sqlite3` native build tree:

- Two identical 9,028,526-byte copies of `sqlite3.c`
  (`deps/sqlite3/sqlite3.c` and `build/Release/obj/gen/sqlite3/sqlite3.c`)
- `sqlite3.a` (2.56 MB), `sqlite3.o` (2.55 MB), the macOS-built `better_sqlite3.node`
  (1.78 MB), and duplicate `sqlite3.h` (642 KB ×2)

The tarball additionally ships a **populated runtime database**:
`anthill/data/anthill.db`, `anthill.db-wal`, `anthill.db-shm`. (Contents not audited for
this record — low severity: namespace signal telemetry, not credentials.)

**Cause:** the v0.1.6 packaging step tarred the post-`npm install` / post-run working tree
rather than a clean source export; the installer rebuilds these dependencies from
`package.json` on the target, so the bundled tree is entirely redundant. The clean
predecessor **v0.1.5 (36.7 KiB)** is retained locally as the last-good pre-regression state
— the bloat entered at the v0.1.5 → v0.1.6 packaging step, which post-dates the
reviewed/patched v0.1.5.

### 3.2 Related known findings cross-referenced

- **INST-008** (LOW, partial closure) — the resolver asset was renamed
  `dillclaw-resolver-v0.1.8.tar.gz` → `dillweed-resolver-v0.1.8.tar.gz` at v1.0.0
  publication. Both copies are byte-identical (SHA `2e3376a5…14f0a`, verified 2026-07-21).
  The tarball still extracts to a `dillclaw-resolver/` directory (cosmetic).
- **INST-012** (info) — the registry tarball ships an unused `resolver-patch.js` artifact
  (cosmetic; PRESERVED UNCHANGED per plan Appendix A).

---

## 4. Live site reconciliation (checklist item 6)

*Performed 2026-07-21 against the live dillweed.com.*

- **Trust root — VERIFIED.** `https://dillweed.com/dnso_public.pem` re-fetched and
  hashed; SHA-256 = `909891e9…6f33`, matching the manifest and the resolver's configured
  key exactly. The anchor of the trust model is confirmed live.
- **Published specs reconciled to repo** — all five core specs match their baseline versions:
  namespace-standard **v0.4.4**, registry-spec **v0.1.6**, dillclaw-resolver spec **v0.1.8**
  (served as `dillclaw-spec.html`), anthill-spec **v0.1.3**.
- **Naming note (long-standing, not new drift):** the resolver spec is published under the
  DillClaw component name (`dillclaw-spec.html`); `resolver-spec.html` returns a 301 redirect
  and `dillclaw-resolver-spec.html` returns 404. This condition was documented in the
  2026-05-22 steward sweeps (#1 and #2) and is consistent with the INST-008 DillClaw/resolver
  naming duality — not new drift.
- **Carried-forward cosmetic (F2):** `https://dillweed.com/fr_conten.htm` still returns HTTP
  200 (stale placeholder nav). Unchanged, non-blocking.
- **Spec publication (resolved at item 11):** the 2026-05-22 steward sweeps recorded a claim
  that a "Trust Architecture specification" was published on dillweed.com but absent from the
  site. The *current* v1.0.0 release body makes no such claim — it names eight specifications
  (Namespace Standard, Registry, DillClaw Resolver, Anthill, Standards Overview, Governance
  Framework, Continuity Protocol, DNSO Operations Charter), and all eight were confirmed live
  2026-07-21. Two are served under non-obvious filenames (`dillclaw-spec.html`,
  `governance.html`). No publication gap remains; see §9 for the item 11 claim review.

---

## 5. Reference deployment disposition (checklist item 7)

The reference deployment on dill-p-001 was **decommissioned on 2026-07-21** as part of v1
preservation. The decommission was performed as an actual event, not merely a declaration: all
three launchd services were stopped (verified down — registry health returned no response,
HTTP 000), after which the host operator independently elected to restart the preserved
software (verified up — registry, resolver, and anthill each returned HTTP 200 after the known
boot-order race self-resolved).

**The project asserts no operational deployment beyond this point.** Any continued execution of
the preserved software — including on the original host — is independent host-operator
activity, outside project scope. It is local-only (Profile A), carries no project support,
maintenance, or standing, and public exposure is not supported (the stack has a known open
CRITICAL, FDI-ANT-001, that matters for public/multi-org profiles). The decommission and the
independent restart are recorded in `PROJECT_LEDGER.md` (entry dated 2026-07-21).

---

## 6. Unresolved findings at the endpoint

The preservation endpoint intentionally freezes with open findings. This section summarizes;
the authoritative register is `docs/finding-disposition-index-2026-06.md` (reconciled to the
preservation baseline; the finding-disposition index was reconciled to this baseline on 2026-07-21 — FDI-DOC-005 resolved, FDI-OPS-010 verified-but-open, with dated preservation-endpoint notes preserving the c999fdd count snapshot).

- **1 CRITICAL — FDI-ANT-001**: Anthill `node_signature` stored but never verified; signals
  unauthenticated. Deferred to v2 (never pursued). Blocks any evidentiary/governance use of
  Anthill data in all profiles.
- **HIGH-class (open/deferred)**: FDI-CRY-001, FDI-ID-001, FDI-ID-004, FDI-ANT-002,
  FDI-REG-001, FDI-REG-002, FDI-XST-003, and others per the index.
- **FDI-OPS-010** (this document, §3.1): Anthill tarball packaging bloat — VERIFIED.

> The preservation endpoint records the project honestly; it does not certify that every
> defect was resolved.

---

## 7. Supported and unsupported use at the endpoint

| Use | Supported | Note |
|---|---|---|
| Read the source; study the architecture | Yes | — |
| Reproduce the local reference stack (Profile A) | Yes | macOS/Node reference host; see §2 reproduction notes |
| Reproduce the lifecycle test | Yes | `integration-test.sh`, 19/19 |
| Study capability-level revocation, decision traces, review methodology | Yes | Research use |
| Use as a production trust service | **No** | Profile A only; no HA, single authoritative instance |
| Accept public registrations / operate a public resolver | **No** | Issue #2 unmet; unauthenticated signals (FDI-ANT-001) |
| Operate an independent mirror | **No** | No sync protocol exists (FDI-REG-002) |
| Rely on Anthill signals | **No** | Unauthenticated (FDI-ANT-001) |
| Deploy across organizations | **No** | Profile D not supported |
| Treat specs as an interoperable standard | **No** | Second-implementer gaps (FDI-XST-003) |
| Present as an ANS implementation | **No** | Independent architecture; see ANS comparative analysis |

---

## 8. Verification progress against the plan's pending list

Work completed 2026-07-21 that updates the plan's front-matter "not inspected" / "not tested"
entries:

- **Live services tested** — plan said "No." Now: all three services probed; five test
  suites executed (§2). ✅
- **Release tarball contents** — plan said "hashes verified; contents not extracted." Now:
  all three extracted and inventoried; Anthill anomaly cause verified (§3). ✅
- **Package checksums** — re-confirmed 2026-07-21 against release-published values (§3). ✅
- **Node version** — captured: v22.22.2 (§2). ✅
- **Live site / trust root (item 6)** — trust root verified live; five specs reconciled (§4). ✅
- **Absent steward reports (item 4)** — located in `~/Dillweed-Agent/reports/` (15 reports +
  ledger patch), confirmed credential-free; to be committed into `reports/` in the preservation
  commit, resolving FDI-DOC-005. ✅
- **Deployment disposition (item 7)** — decommissioned and independently restarted; recorded
  in ledger (§5). ✅
- **Tag-signing capability (item 8)** — no signing key configured; archival tag will be
  annotated-unsigned (`git tag -a`), consistent with the existing unsigned `v1.0.0` tag. ✅

**All verification and decision items complete.** Remaining work is commit assembly (plan §29
items 2, 9, 12): preservation-commit diff check; NOTICE confirmation — followed by creating
the single preservation commit, applying the annotated tag
`dillweed-v1-preservation-baseline`, and writing the release (with the release-body preservation
note per §9). Item 9 (finding-index reconciliation) and item 11 (release-body claim
qualification, §9) are complete.

---

## 9. Claim corrections to the v1.0.0 release body (checklist item 11)

The v1.0.0 GitHub release body was published 2026-05-18, before this preservation
pass. Rather than silently rewrite that historical artifact, the corrections below
record where its claims require qualification. A dated preservation note will be
appended to the release body itself pointing here; the historical release text is
otherwise left intact.

**Correction 1 — "external review" / "external audit" (FDI-RESR-002).** The release
body states that each component was "audit-cycled by external review" and describes
the review rounds as "external audit." This overstates the provenance. The review
process was **AI-assisted and steward-commissioned** (project ledger AI-008), not
independent third-party assessment or peer review. The multi-round consistency
reviews, architecture reviews, gap analyses, and disposition work were performed by
AI reviewers under the steward's direction. Readers should interpret every use of
"external review"/"external audit" in the release body as AI-assisted, steward-
commissioned review. This is the correction most material to evaluating the
project's validation status.

**Correction 2 — operational currency.** The release body speaks in the present,
active voice of a live, validated reference deployment ("validated on the reference
deployment"). As of 2026-07-21 the reference deployment is decommissioned (§5); the
project asserts no operational deployment. The release body should be read as a
historical record of the system as it stood on 2026-05-18, not a statement of
current operational status.

**Correction 3 — test-count currency.** The release body's validation summary
predates independent execution of the suites. The authoritative verified counts are
in §2 of this document (registry 79/79, resolver-unit 29/29, anthill 58/58,
integration 19/19, resolver-conformance 63/2 with the two residual failures
classified as non-defects). Where the release body's figures differ or are partial
(e.g. the Resolver line), §2 governs.

**Minor note — spec filenames (not a correction).** The release body's claim that
eight specifications are published at dillweed.com is accurate: all eight were
confirmed live 2026-07-21. Two are served under non-obvious filenames — the DillClaw
Resolver Specification at `dillclaw-spec.html` (not `resolver-spec.html`) and the
Governance Framework at `governance.html` (not `governance-framework.html`). The
specs exist and resolve; only the filenames are non-obvious. Recorded for reader
convenience, not as a claim defect.

**Not corrected (accurate as written).** The release body's "Known issues" section
correctly scopes carried-forward findings; the trust-root SHA and asset checksums
are verified accurate (§3); and the README's open-findings statement (README line
187) already honestly scopes "no open HIGH/MEDIUM" to the spec-consistency series
and explicitly names the open CRITICAL (FDI-ANT-001) and HIGH findings — no
correction needed there.
