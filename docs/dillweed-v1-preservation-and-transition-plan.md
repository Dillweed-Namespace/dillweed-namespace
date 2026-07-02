# Dillweed v1 Preservation and Transition Plan

---

## 1. Status and Document Control

| Field | Value | Verification status |
|---|---|---|
| Document status | DRAFT — becomes authoritative when merged as part of the preservation commit and the §29 manual-verification checklist is complete | — |
| Preparation date | 2026-07-02 | — |
| Repository | https://github.com/Dillweed-Namespace/dillweed-namespace | VERIFIED FROM REPOSITORY |
| Commit reviewed | `7eab9b598a511e99d945486d463634251c2a9920` ("docs: surface paper title in docs index entry") | VERIFIED FROM REPOSITORY |
| Current branch | `main` (also the default branch) | VERIFIED FROM REPOSITORY |
| Final behavioral implementation commit | `8c87a85` — "Post-review fix (r3 M-1): probeEndpoint honors liveness cache TTL" (2026-06-10). See §6 for the determination and the one judgment call it required | VERIFIED FROM REPOSITORY |
| Proposed preservation commit | The documentation-only commit that merges this plan, `PRESERVATION.md`, `ARCHIVAL_MANIFEST.json`, endpoint banners, README/docs-index updates, and issue-disposition records. Hash: `[PENDING — created by executing §14]` | PENDING MANUAL VERIFICATION |
| Proposed archival tag | `dillweed-v1-preservation-baseline` (applied to the preservation commit) | — |
| Component versions at review | Registry 0.2.8 · DillClaw Resolver 0.1.8 · Anthill 0.1.6 · MCP server 1.0.0 (`package.json` and in-source `VERSION` constants). **Caution:** the W0 hardening wave changed Registry and Resolver runtime behavior after the v1.0.0 tarballs were built without bumping these version strings (finding FDI-XST-007). Version strings alone do not identify the baseline; commits do | VERIFIED FROM REPOSITORY |
| Specification versions at review | Namespace Standard v0.4.4 · Registry Spec v0.1.6 · DillClaw Resolver Spec v0.1.8 · Anthill Spec v0.1.3 · Standards Overview v1.0.10 · Governance Framework v1.1.3 · DNSO Operations Charter v1.0.3 · Continuity Protocol (GSP-01) v1.0.3 (from `specs/*.html` title blocks) | VERIFIED FROM REPOSITORY |
| Git tags | `v1.0.0` → `52069ac` ("Initial commit: Dillweed Namespace v1.0.0") — the only tag | VERIFIED FROM REPOSITORY |
| GitHub releases | One: "Dillweed Namespace v1.0.0" (2026-05-18), three tarball assets | VERIFIED FROM REPOSITORY (via GitHub API) |
| Release checksums | All three v1.0.0 assets were downloaded and hashed on 2026-07-02; SHA256 values match the README, the release body, and `docs/release-notes/v1.0.0-release-notes.md` exactly (see §15) | VERIFIED FROM REPOSITORY |
| Test counts | **Not executed during this review.** v1.0.0-baseline counts (Registry 79/79, Resolver 65 integration + 29 unit, Anthill 58/58, lifecycle integration 19/19) and current-HEAD counts (Registry 98/98, Anthill 62/62, Resolver 77/77 unit, resolver integration 69 pass / 5 environmental failures) are as stated in `README.md` and `v2-tracker.md` | REPORTED BY PROJECT DOCUMENTATION, NOT INDEPENDENTLY VERIFIED |
| Unresolved CRITICAL findings | 1 — FDI-ANT-001 (Anthill `node_signature` stored but never verified; signals unauthenticated) | VERIFIED FROM REPOSITORY (index entry re-read; code claim not re-executed this session) |
| Unresolved HIGH-class findings | Per `docs/finding-disposition-index-2026-06.md` at `c999fdd`: 13 of 18 findings originally rated P0/HIGH remain open or deferred, including FDI-CRY-001, FDI-ID-001, FDI-ID-004, FDI-ANT-002, FDI-REG-001/002, FDI-XST-003 | REPORTED BY PROJECT DOCUMENTATION (the index), NOT INDEPENDENTLY RE-VERIFIED against code this session |
| Incomplete deployment profiles | Public read-only Resolver (Profile B — gated by Issue #2, unmet), public authoritative Registry, independent mirror (Profile C — no sync protocol exists), multi-organization production (Profile D). Only Profile A (local reference stack) is exercisable | VERIFIED FROM REPOSITORY (index §4; mirror gap report; Issue #2) |
| Artifacts not inspected | Contents of the three release tarballs (hashes verified; contents not extracted and diffed); the live dillweed.com website beyond the in-repo `specs/` mirror; the live deployment on dill-p-001; absent steward reports cited by the ledger (FDI-DOC-005); `patches/` directory (empty in git despite the README describing contents) | NOT AVAILABLE / PENDING MANUAL VERIFICATION |
| Live services tested | No. No running Registry, Resolver, Anthill, or MCP service was probed during this review | — |
| Release packages rebuilt | No | — |
| Post-v1 experimental material in repository | Yes: the v2 design document (`docs/dillweed-v2-design-2026-06-10.md`), `v2-tracker.md`, the W0 hardening code merged to `main` after the v1.0.0 tarballs were built, and the non-normative ANS capability-standing profile sketch (§19 of the ANS analysis). All are dispositioned in this plan | VERIFIED FROM REPOSITORY |
| Tracked file count | 84 files at `7eab9b5` (`git ls-files`) | VERIFIED FROM REPOSITORY |

---

## 2. Executive Summary

The Dillweed Namespace Project steward has decided that **Dillweed v1 is the final implementation state of the original parallel namespace architecture. There will be no W1 implementation phase and no continued development of that architecture.** This document records that decision and defines how it is executed: what is frozen, what is maintained only for reproducibility, what is superseded, what is deprecated, what survives as research material, and what a future reader may and may not conclude from the preserved repository.

The decision follows the project's own evidence chain. The strategic evaluation (2026-06-12) found the stack roughly three times broader than its defensible core and made continuation conditional on external facts that did not materialize. The ANS v2 boundary analysis (2026-07-01) found that most of the infrastructure layer — registration authority, identity, transparency logging, trust-root distribution, mirroring — is now addressed by institutionally stronger mechanisms, and that no evidence supports continuing an independent parallel architecture. The finding-disposition index records 70 canonical findings, of which one CRITICAL and a cluster of HIGH findings remain open at the endpoint, by design of this plan rather than by concealment.

What is preserved is substantial: a complete, locally runnable three-service reference implementation with SHA-pinned release artifacts; eight specification documents; a review and gap-analysis corpus of unusual candor; a finding-disposition discipline; a reusable review-methodology paper; and provenance for the project's independent convergence on problems that other industry efforts also recognize. What is not claimed is equally explicit: no production readiness, no standards adoption, no independent validation, no operating governance institutions, no public deployment, no security certification.

The plan's outputs: the archival tag `dillweed-v1-preservation-baseline` applied to a documentation-only preservation commit; a preservation manifest; a claim audit; an unresolved-risk register; a bounded maintenance policy; and completion criteria. The endpoint records the project honestly; it does not certify that every defect was resolved.

---

## 3. Final Endpoint Decision

The controlling decision, made by the project steward and recorded here as settled:

> Dillweed v1 is the final implementation state of the original Dillweed Namespace Project. There will be no W1 implementation phase and no continued development of the original parallel namespace architecture.

Consequences this plan enforces:

1. The W1 wave described in `docs/dillweed-v2-design-2026-06-10.md` and `v2-tracker.md` ("Next Step: … W1 decision remains pending") is **decided: not pursued**. The tracker's pending line is closed by banner, not by deletion.
2. Issue #4 (v2 architecture) and the v2 design document are dispositioned as superseded future architecture (§11, §23).
3. No new protocol behavior, trust semantics, governance authority, or feature work occurs in this repository or version lineage (§22).
4. Future research, if any, occurs only under the reactivation conditions of §25 — a new charter, a separate lineage, and materially new evidence — and cannot alter the preserved v1 baseline.

This document does not reopen the decision, does not evaluate alternatives to it, and does not treat preservation as a pause pending feature work.

---

## 4. Purpose and Non-Goals

**Purpose.** Turn the end of active v1 development into a defined, reproducible, historically accurate project endpoint: identify the final behavioral commit; define the documentation-only preservation commit and archival tag; assign exactly one primary disposition to every major artifact; disclose unresolved risks; reconcile public claims with evidence; bound post-transition maintenance; and state completion criteria.

**This document is not:** a new architecture; a specification; a capability-standing profile; an ANS integration proposal or competitive response; a marketing retrospective; a claim that every planned feature was completed; an instruction to delete unsuccessful work; or a declaration that the system was independently validated, standardized, or production-ready.

---

## 5. Preservation Baseline

The baseline is defined by three distinct references. Do not conflate them.

### 5.1 Final behavioral implementation commit — `8c87a85`

`8c87a85` ("Post-review fix (r3 M-1): probeEndpoint honors liveness cache TTL — no re-probe within 60s", 2026-06-10) is the last commit that changed executable runtime behavior (`resolver/server.js`, +6 lines). **VERIFIED FROM REPOSITORY** by walking `git log` over `registry/ resolver/ anthill/ mcp-server/ integration-test.sh`.

Two later commits touched files under implementation paths and were examined individually:

- `257a910` ("Fix r3 LOW items: test-suite headers and stale version citations") edited `registry/server.js`, `registry/rotate-key.js`, `registry/setup.js`, and two `test.sh` headers. The full diff was read: every hunk changes only comments, banner strings, and spec-section citations (v0.1.4→v0.1.5). One `console.log` banner string changed. **Judgment recorded:** this is classified as non-behavioral (no protocol, security-control, data-format, or runtime-operation change); a maximally strict reading that counts a banner string as behavior would make `257a910` the final behavioral commit. Both hashes are recorded in the manifest so the distinction is preserved either way.
- `0e2899c` edited `anthill/README.md` only (documentation).
- `3d6b159` ("W0: spec updates") changed `specs/*.html` only — normative text, not runtime behavior.

**Relationship to the v1.0.0 release artifacts:** the tarballs attached to the v1.0.0 release (2026-05-18) predate the W0 hardening wave. The source tree at the preservation baseline is v1.0.0 **plus** the W0 behavioral commits (`74cad67`, `25670a4`, `a1a95d1`, `4447c00`, `d25bf7b`, `e523652`, `d1466c0`, `8c87a85` — list REPORTED BY `v2-tracker.md`; the last seven verified reachable from `main`). The component `VERSION` strings were not bumped for W0 (FDI-XST-007), so **the repository source and the v1.0.0 tarballs carry identical version strings but different behavior**. The manifest (§15) records both artifacts; neither is erased.

### 5.2 Preservation commit — `[PENDING]`

A documentation-only commit (or short series concluding in one) that adds: this plan; `PRESERVATION.md`; `ARCHIVAL_MANIFEST.json`; endpoint banners (§16); the updated root README (§17); updated docs index; claim qualifications (§18); and issue-disposition records (§23). It must not alter intended v1 runtime behavior; §26's checklist requires diff-level confirmation (`git diff 8c87a85..<preservation-commit> -- registry/ resolver/ anthill/ mcp-server/ integration-test.sh` shows no functional change beyond the already-analyzed `257a910` string corrections).

### 5.3 Archival tag — `dillweed-v1-preservation-baseline`

Immutable reference to the completed preservation commit. Rationale and prerequisites in §14.

### 5.4 Historical review baselines

Earlier reviews are accurate for the commits they state, not for HEAD. The load-bearing ones: the six spec-consistency rounds and the 2026-06-10 architecture/trust-boundary/gap corpus (pre-W0 or mid-W0 baselines); the finding-disposition index at `c999fdd`; the ANS analysis at `310d503`; the methodology paper's case study at `110c4c1`. Banners already exist on most of these (commits `bf8dbe8`, `8a596d9`); §16 completes the set.

---

## 6. Verification Status and Evidence Limitations

Every exact factual item in this plan carries one of four labels: **VERIFIED FROM REPOSITORY** · **REPORTED BY PROJECT DOCUMENTATION, NOT INDEPENDENTLY VERIFIED** · **PENDING MANUAL VERIFICATION** · **NOT AVAILABLE**.

Verified during this review (2026-07-02, at `7eab9b5`): commit history and file-level diffs for the behavioral-commit determination; tag and release existence and assets via the GitHub API; SHA256 of all three release tarballs (downloaded and hashed — all match published values); component and spec version strings; issue states and bodies (#1–#4); the `.gitignore` key/trace exclusions; tracked-file count; the presence and framing of every document dispositioned in §9.

Explicitly **not** done: no test suite was executed; no live service was probed; tarball contents were not extracted or diffed against source; dillweed.com was not fetched; the ledger's 3,333 lines were sampled, not exhaustively re-audited; finding-index code citations (e.g., `registry/server.js:161–167` signed-field set) were not re-executed against HEAD — the index's own verification at `c999fdd` is relied on, and only documentation commits separate `c999fdd` from `7eab9b5` on implementation paths (verified via git log).

Inference rules honored throughout: a closed issue is not a closed finding; a historical test count is not a current test result; a checksum file is not a verified checksum (these were independently verified); installation instructions are not reproducibility evidence; local service code is not public deployment; governance prose is not an operating institution.

All residual exact-fact gaps are collected in §29.

---

## 7. Disposition Vocabulary

Five primary classifications. Every major artifact receives exactly one; secondary notes may add context but never a second primary label.

| Disposition | Meaning | Maintenance permitted |
|---|---|---|
| **PRESERVED UNCHANGED** | Frozen as part of the historical v1 record. Changing or removing it would damage provenance or reproducibility | Banner/metadata only |
| **MAINTAINED FOR REPRODUCIBILITY** | May receive narrowly bounded maintenance to keep the baseline inspectable or runnable: dependency-pin repair, broken-link repair, archival packaging, compatibility notes, security warnings, checksum correction with documented cause, test-harness repair that does not alter intended behavior, reproduction-doc correction | As listed; never architectural |
| **SUPERSEDED** | Its intended future role is better addressed elsewhere (a later project conclusion, established standards, ANS-class identity/transparency infrastructure, standard observability). Remains available as historical evidence; not the recommended future design | Banner only |
| **DEPRECATED** | Incomplete, unsuitable for prior claims, or unsafe for broader deployment; should not be used for new systems. Deprecation states reason, affected profiles, residual risk, whether local reproduction remains acceptable, and whether any maintenance continues | Warnings only |
| **RETAINED AS RESEARCH MATERIAL** | Useful for its problem formulation, hypotheses, failure analysis, methodology, or evidence of independent convergence. Not current operational guidance | Citation/factual correction |

---

## 8. Master Artifact-Disposition Table

The authoritative table. Appendix A carries the full item-level inventory; this table is decisive where they differ in granularity.

| Artifact / component | Current purpose | Primary disposition | Evidence supporting disposition | Maintenance after transition | Public-use warning | Reconsideration condition |
|---|---|---|---|---|---|---|
| Registry implementation (`registry/`) | Authoritative capability store, signer, lookup/verify | **MAINTAINED FOR REPRODUCIBILITY** | Runs locally; 19-step lifecycle depends on it; FDI-ID-001/CRY-003 make public/multi-org use unsafe | Reproduction-scoped only (§7) | Local reproduction only. Never accept public writes (fail-open token, root key in process) | New charter + identity substrate per §25 |
| DillClaw Resolver (`resolver/`) | Resolution, verification, caching, traces, scoring | **MAINTAINED FOR REPRODUCIBILITY** | Runs locally; Issue #2 gate unmet; scalar scoring deprecated (below) | Reproduction-scoped only | No public deployment (Issue #2 unmet: no TLS, no threat model, CORS/bind defaults). Do not use trust scores for authorization | §25 |
| Anthill service (`anthill/`) | Signal ingestion/aggregation | **DEPRECATED** | FDI-ANT-001 (CRITICAL, open): signals unauthenticated; FDI-ANT-002/003/004; own comparative review + ANS §12: superseded by OTel/standard observability + AIM-class designs | None beyond warnings; runnable for reproduction | Do not rely on Anthill signals as evidence for any decision; do not deploy beyond the local stack | None as a service; taxonomy survives as research (§10.3) |
| MCP adapter (`mcp-server/`) | MCP tool bridge to Resolver | **MAINTAINED FOR REPRODUCIBILITY** | Working demonstration; FDI-XST-005: passes results through without independent verification | Reproduction-scoped only | Demonstration only; no independent signature verification | §25 |
| Integration harness (`integration-test.sh`) | 19-check end-to-end lifecycle proof | **MAINTAINED FOR REPRODUCIBILITY** | Primary evidence the trust chain runs end-to-end locally | Harness repair that preserves intended behavior | Passing tests demonstrate behavior at the baseline, not security | — |
| Component test suites (`*/test.sh`, `resolver/unit-tests.js`) | Spec-conformance checks | **MAINTAINED FOR REPRODUCIBILITY** | In-tree; counts documented; 5 known environmental resolver failures (FDI-DOC-003) | Same as harness | Same as harness | — |
| Installers + launchd files (`*/install.sh`, `start.sh`, plists) | macOS local install | **MAINTAINED FOR REPRODUCIBILITY** | FDI-OPS-004: macOS-only, no CI; INST-011 plaintext tokens in plists | Pin/compat fixes only | Prominent warning: local reference use only; macOS-only; tokens in plists are plaintext | — |
| v1.0.0 release tarballs + checksums | Frozen release artifacts | **PRESERVED UNCHANGED** | SHA256 independently verified 2026-07-02 (all three match) | None; never re-upload | Pre-W0 behavior; differs from HEAD source at identical version strings | Never |
| Key-rotation utility (`registry/rotate-key.js`) | Planned-rotation tooling | **PRESERVED UNCHANGED** | FDI-CRY-005: never exercised end-to-end | None | Unexercised; do not treat as a tested rotation procedure | — |
| Mirror mode (Registry env-flag + spec §10.3) | Mirror freshness fields | **DEPRECATED** | FDI-REG-002: no sync protocol in spec or code; mirror gap report "no happy path"; FDI-DOC-007 tamper-evidence overclaim; ANS analysis: fully subsumed by transparency-log architecture | None | A mirror cannot be deployed from this repository; the spec's mirror tamper-evidence claim is retired (§18) | None under v1 |
| v2 design (`docs/dillweed-v2-design-2026-06-10.md`) | Former future architecture | **SUPERSEDED** | Endpoint decision (§3); ANS analysis §25.1: ANS covers the majority of Areas 1/2/5/6; FDI-XST-006 internal plan defect | Banner only | Not the recommended future architecture; W1–W4 will not be implemented | §25 (new charter only) |
| `v2-tracker.md` | W0 execution record; W1 pending line | **PRESERVED UNCHANGED** | Provenance of the W0 wave; its "W1 decision pending" line is closed by banner per §3 | Banner only | Historical record | — |
| Namespace Standard v0.4.4 | `dllwd://` root, L1–L4 stack | **SUPERSEDED** (as a live standards track) | ANS analysis §22.1: preserve as dated research document, stop presenting as live standards track; strategic eval retired the L1–L4 framing | Banner only | Not a standards submission; conceptual sections (§2, §7.3) remain citable research | §25 |
| Registry Spec v0.1.6, DillClaw Spec v0.1.8, Anthill Spec v0.1.3 | Frozen v1 behavior descriptions | **PRESERVED UNCHANGED** | They describe the implemented baseline; FDI-XST-003 (88 gaps, 9 blockers) makes them insufficient for independent reimplementation | Banner only | Authoritative only for the archival baseline; deprecated for new implementations; not an interoperable standard (§11) | Independent implementation evidence |
| Standards Overview v1.0.10 | Standards-facing framing | **SUPERSEDED** | Framing retired with the standards track (above) | Banner only | Historical framing document | — |
| Governance Framework v1.1.3, DNSO Operations Charter v1.0.3 | Governance intent | **PRESERVED UNCHANGED** | FDI-GOV-003: institutionalizes bodies that never existed; preserved as documented intent | "Governance intent" banner (§16) | Records intent; no council, participant body, or independent operator ever operated | §25 |
| Continuity Protocol GSP-01 v1.0.3 | Continuity/succession design | **RETAINED AS RESEARCH MATERIAL** | ANS analysis §14/§22: the most contribution-ready governance artifact; FDI-GOV-002: its own instruments unexecuted | Citation correction | Instruments (CDI, sealed materials, attorney custody) were never executed; a thought-through design, not an operating protocol | Generalized contribution under a new charter |
| Historical review corpus (3 architecture reviews, trust-boundary analysis, 6 consistency rounds, 4 gap reports, doc-set review) | Evidence of what was found, when | **PRESERVED UNCHANGED** | Banners largely in place (`bf8dbe8`, `8a596d9`); index supersedes their finding statuses | Banner completion only | Historical snapshots; consult the finding-disposition index for current status | Never |
| Finding-disposition index (`docs/finding-disposition-index-2026-06.md`) | Current finding status | **MAINTAINED FOR REPRODUCIBILITY** | The one status record that must be reconciled to the preservation baseline (§20), then frozen | One endpoint reconciliation pass, then banner | Authoritative for finding status at the endpoint | — |
| Strategic evaluation (2026-06-12) | Directional conclusion | **RETAINED AS RESEARCH MATERIAL** | Its month-6 disconfirmation logic is part of why the endpoint exists | Citation correction | Analysis, not status; superseded where it proposed continued operation | — |
| ANS v2 boundary analysis (2026-07) | Comparative conclusion | **RETAINED AS RESEARCH MATERIAL** | Primary evidence for the superseded dispositions; its 90-day plan is **not adopted** — §25 governs any future work | Citation correction | Its Option-C/B prototype path is a research option under §25, not a commitment | — |
| Review-methodology paper (ELTM) | Generalizable method | **RETAINED AS RESEARCH MATERIAL** | Value survives independently of Dillweed v1; self-discloses AI assistance and single-case derivation | Citation/author completion permitted | Working draft; not peer-reviewed | — |
| Research documents (`potential-research-areas.md`, `research-opportunities-summary.md`) | Hypotheses and project ideas | **RETAINED AS RESEARCH MATERIAL** | 18 falsifiable hypotheses; not an implementation roadmap | Citation correction | Research invitations, not roadmap; testbed sections describe the now-frozen stack | — |
| `PROJECT_LEDGER.md` | Decision/audit provenance | **PRESERVED UNCHANGED** | 3,333-line chronological record; the project's provenance spine | Endpoint entry appended (dated, additive) | Historical record; some entries carry stale statuses by design (see index FDI-DOC-010) | Never |
| Operations runbook | Local deployment/recovery procedures | **MAINTAINED FOR REPRODUCIBILITY** | Needed to reproduce the reference stack | Reproduction-doc correction | Describes the local reference deployment only | — |
| Release notes (`docs/release-notes/`) | v1.0.0 record | **PRESERVED UNCHANGED** | Historical release record; its "external audit" phrasing is qualified by banner, not edit (§18) | Banner only | See claim audit | — |
| Root README + docs index | Live navigation | **MAINTAINED FOR REPRODUCIBILITY** | Must present the endpoint truthfully (§17) | Status/navigation accuracy only | — | — |
| Repository metadata (description, topics, issue templates) | Public signal | **MAINTAINED FOR REPRODUCIBILITY** | §17, §28-B wording | Accuracy updates only | — | — |
| `patches/` directory | Described as historical patch artifacts | **NOT AVAILABLE** as content — the directory is empty in git (`git ls-files patches/` returns nothing; `.gitignore` excludes `*.tar.gz`); the README's description of its contents is qualified in §18 | Resolve in §29 | — | — |

---

## 9. Component Disposition Analysis

### 9.1 Registry — MAINTAINED FOR REPRODUCIBILITY

- **Authoritative-store role:** works locally (SQLite, single writer, no HA — FDI-REG-001). Preserved as the reference store; **future global-authority use is SUPERSEDED** — the ANS analysis (§22.1) classifies the registration-authority role as better served by ANS-class RA + transparency-log machinery, and the strategic evaluation reached the narrowing conclusion independently.
- **Registration / authentication model:** shared admin token, fail-open when unset, `0.0.0.0` bind, spoofable `caller` (FDI-ID-001, FDI-XST-004). **Public writes are DEPRECATED** — unsafe under any prior claim. Local reproduction acceptable.
- **Signing model / signed fields:** Ed25519 over a canonicalized 10-field subset. `registration_date` and `tags` are outside the signed set while `registration_date` feeds 30% of the trust score (FDI-CRY-001, verified in code at `c999fdd`). Canonicalization is top-level-only JS-stringify, a documented second-implementer blocker (FDI-CRY-002). Preserved as-is; documented as a known defect, not fixed at the endpoint.
- **Trust-root distribution:** one PEM over HTTPS plus a README SHA; installer check non-enforcing (FDI-CRY-006). **SUPERSEDED** by standard mechanisms (DNSSEC/DANE, TUF, transparency-log key history) per the project's own comparative reviews. The published key and SHA remain part of the preserved record.
- **Audit log:** append-only by convention; no tamper evidence (FDI-XST-002). The "append-only audit" claim is qualified in §18.
- **Lifecycle / revocation, mandatory revocation reasons:** implemented and locally demonstrated (register → resolve → revoke → propagation, 19-check harness). **Capability-level revocation semantics remain research-relevant** — the ANS analysis rates capability-granular lifecycle DISTINCT from ANS. The research value lives in the specs, traces, and analyses; it does not require further engineering of this Registry.
- **Mirror mode:** an env-var echo of freshness fields; no synchronization protocol exists in spec or code; the spec's "without trusting the mirror itself" claim was demonstrated false (FDI-REG-002, FDI-DOC-007, mirror gap report G-1..G-24). **DEPRECATED**, and the future mirror role is architecturally dissolved by transparency-log designs.
- **Tests / releases:** suite in tree (98/98 at HEAD — REPORTED); v0.2.8 tarball hash independently VERIFIED. Note again: tarball behavior ≠ HEAD behavior at the same version string.
- **Multi-organization suitability:** none; blocked by the identity, key-custody (root key inside the HTTP process, FDI-CRY-003), and HA findings. Never claimed at the endpoint.

### 9.2 DillClaw Resolver — MAINTAINED FOR REPRODUCIBILITY

- **Preserved runnable implementation:** candidate discovery, policy filtering, signature verification, TTL caching with stale-while-revalidate and a specified ≤30-minute adversarial-freeze bound (FDI-RES-008 documents the residual), revocation propagation via 60s jittered/backoff refresh (W0), SSRF-hardened optional liveness probing (W0, FDI-RES-002 CLOSED), decision traces, MCP consumption, and the integration-test role. All preserved and runnable locally.
- **Superseded trust-root and identity assumptions:** the DNSO-single-signer evidence base the resolver verifies against is SUPERSEDED (§9.1); the resolver's *evaluation-layer* design is the component the ANS analysis rates as having no external analog.
- **Deprecated scalar trust scoring:** the composite scalar and face-value trust tiers are **DEPRECATED** — forgeable inputs (unsigned `registration_date`, self-assigned `verified`/`canonical` tiers, FDI-CRY-001/FDI-ID-004), a demonstrated manipulation composite, and the ANS analysis's "retire the scalar" verdict. Do not use trust scores for authorization decisions. The structured signal vector and score breakdown remain research material.
- **Research value retained:** capability-level lifecycle handling and **reconstructable resolution evidence** (persisted decision traces) — the two assets every late-project analysis independently identified as durable. Retained as research questions, not as an implementation roadmap.
- **Known divergence preserved:** DillClaw spec v0.1.8 documents client-side conditional fetch that the implementation does not contain (FDI-DOC-008). Disclosed by banner; not fixed at the endpoint.
- **Freshness/determinism:** the spec's cross-resolver determinism guarantee is not achievable as specified (FDI-RES-003); the corresponding claim is retired in §18.

### 9.3 Anthill — DEPRECATED (as a running service)

- **Reason:** signals are unauthenticated — `node_signature` is stored, never verified, and not required; `originating_node` is free-form (FDI-ANT-001, the project's single open CRITICAL). Sequence-counter poisoning can suppress a victim's signals (FDI-ANT-002); nonce-replay reflection can frame one (FDI-ANT-003); signals are self-graded with no Registry corroboration (FDI-ANT-004). **Unresolved attribution defects block any reliance on Anthill evidence** for governance, escalation, or anomaly conclusions.
- **Escalation / anomaly-detection claims:** the detection/escalation/correlation engine was never built (FDI-ANT-009); the project's own documentation-set review re-labeled Anthill a "signal store." Claims are qualified accordingly (§18).
- **Superseded design role:** standard observability infrastructure (OpenTelemetry, Prometheus) plus AIM-class monitoring designs supersede the parallel-service approach — the conclusion of the project's own `anthill-vs-observability` review and the ANS analysis §12.
- **Affected profiles / residual risk:** deprecated for every profile beyond local reproduction; residual risk is fabricated governance evidence if anyone relies on its output.
- **Local reproduction:** acceptable; the service runs, its replay-protection mechanics (nonce + node-sequence) and dual-window aggregation are inspectable, and its test suite exists (62/62 at HEAD — REPORTED).
- **Retained as research material (secondary note):** the signal taxonomy (as a candidate semantic convention), the adversarial-reporter trust model, the corroboration idea, and the ANT-EC concentration-risk metric.
- **Maintenance:** none beyond warnings and reproducibility repair.

### 9.4 MCP adapter — MAINTAINED FOR REPRODUCIBILITY

A working historical integration demonstration: four MCP tools (`dillweed_resolve`, `dillweed_lookup`, `dillweed_verify`, `dillweed_health`) bridging MCP clients to the local stack. Not an actively maintained integration; not superseded in the strict sense (the ANS analysis rates it COMPLEMENTARY), but its planned evolution ends with the endpoint. Known limitation preserved: it trusts Resolver responses without independent signature verification (FDI-XST-005, Issue #4). Public-status wording: "reference MCP integration for the preserved local stack; performs no independent verification."

### 9.5 Tests, installers, and releases

- **Test suites and harness — MAINTAINED FOR REPRODUCIBILITY.** They are evidence of behavior at the preserved baseline and the primary reproduction instrument. Limitations stated plainly: they exercise the local happy path and specified error paths; the resolver in-repo suite carries 5 known environmental failures tied to the 7-record dev seed (REPORTED, FDI-DOC-003); **test success may not be described as security evidence** — the methodology paper itself states this. Maintenance: harness/runner compatibility repair that provably preserves intended behavior.
- **Installers and service-management files — MAINTAINED FOR REPRODUCIBILITY.** macOS-only (launchd, Keychain); no Linux path or CI (FDI-OPS-004, ACCEPTED FOR V1); plaintext tokens in plists (INST-011). They remain supported only in the reproduction-scoped sense. Local installation carries a prominent warning (§16 deprecated/reproduction banner + README §17).
- **Packaged releases and checksums — PRESERVED UNCHANGED.** The three v1.0.0 tarballs and their SHA256 values are the frozen artifact set; independently verified 2026-07-02. No re-packaging, no re-upload; any future archival copies must carry the same hashes.

---

## 10. Specification Disposition

Individual determinations (primary dispositions in §8):

| Spec | Frozen v1 description? | Sufficient for independent reimplementation? | Future-architecture status | Authoritative for |
|---|---|---|---|---|
| Registry Spec v0.1.6 | Yes | **No** — canonicalization (REG-01/02/05), serialization pinning (XC-01), mirror sync absent | Superseded (authority role) | Archival baseline only |
| DillClaw Spec v0.1.8 | Yes, with one documented divergence (client conditional fetch specified, not implemented — FDI-DOC-008) | No — determinism MUST unachievable as specified (FDI-RES-003); config reference gaps (G-1/G-2) | Evaluation-layer concepts remain research | Archival baseline only |
| Anthill Spec v0.1.3 | Partially — wire protocol under-specified (FDI-ANT-010); implemented rate limiting undocumented (FDI-DOC-006) | No — 3 second-implementer blockers | Superseded by OTel-convention approach | Archival baseline only |
| Namespace Standard v0.4.4 | Concept document more than implementation description | N/A | **Superseded** as a live standards track; §2/§7.3 concepts retained | Historical/research |
| Standards Overview v1.0.10 | Framing | N/A | Superseded | Historical |
| Governance / Charter / GSP-01 | Intent documents | N/A | See §12 | Historical intent / research |

Cross-cutting facts an implementer must know, preserved rather than repaired: normative requirements not implemented (client conditional fetch; parts of mirror §10.3; the determinism MUST); implemented behavior not fully specified (Anthill rate limiting; `/health` schemas — REG-26); canonicalization ambiguity (FDI-CRY-002); lifecycle ambiguity at the wire level for Anthill; version drift (W0 behavior at unchanged implementation versions — FDI-XST-007; no spec↔implementation version map). The second-implementer report's verdict stands at the endpoint: **88 gaps, 9 blockers; the specification set is not an interoperable standard, and no independent implementation evidence exists.** No specification receives further normative engineering.

---

## 11. Governance and Continuity Disposition

Documented intent vs. operating reality, stated plainly:

- **What operated:** a single steward (Richard McClelland), holding the sole DNSO signing key, maintaining a public ledger of decisions. That is the entirety of governance that ever functioned.
- **What never existed or was never exercised:** the Technical Steering Committee and Participant Council evolution stages (Governance Framework); trust-tier endorsement as a governed process (Charter §4 concedes tiers are self-declared in v1); dispute and transition mechanisms; independent or licensed neutral operators; mirror governance (no mirror ever existed); trustee designation, CDI execution, sealed recovery materials, and attorney custody (GSP-01 §11 lists these as open obligations — FDI-GOV-002: **unexecuted**); any key-custody transfer or rotation under the documented procedures (FDI-CRY-005).
- **Structural finding preserved:** single-steward, single-key construction contradicted the neutrality thesis (FDI-GOV-001); the governance corpus institutionalized bodies that did not exist (FDI-GOV-003).

Dispositions: **Governance Framework and DNSO Operations Charter — PRESERVED UNCHANGED** as historical governance intent, carrying the §16 "governance intent, not functioning institution" banner; deprecated as operational governance claims. **GSP-01 Continuity Protocol — RETAINED AS RESEARCH MATERIAL**: the ANS analysis identifies operator-continuity design (death/incapacity procedures, sealed-materials custody, neutrality covenants) as a genuinely under-supplied artifact generalizable beyond Dillweed; that generalization, if ever pursued, happens under §25 conditions. The neutral-operator aspiration is **SUPERSEDED** institutionally: multi-party role separation of the kind ANS engineers is stronger than any single-steward covenant.

No document in this repository establishes that councils, trustees, participant bodies, or independent operators functioned. This plan is the controlling statement of that fact.

---

## 12. Review and Research Corpus Disposition

- **Historical reviews — PRESERVED UNCHANGED:** the three architecture reviews, cross-service trust-boundary analysis, six spec-consistency rounds, four gap reports, and the documentation-set review. Accurate for their stated baselines; superseded on current status by the index. Their preservation does not imply every finding is still open, nor that their architectural recommendations remain current.
- **Current status record — MAINTAINED FOR REPRODUCIBILITY:** the finding-disposition index. It receives exactly one endpoint reconciliation pass (§20): re-pin to the preservation baseline, convert "DEFERRED TO V2" entries to "DEFERRED — NO IMPLEMENTATION PLANNED (endpoint)", record the register of §20. Then frozen with an archival-baseline banner.
- **Strategic conclusions — RETAINED AS RESEARCH MATERIAL:** the strategic evaluation and the ANS boundary analysis. These changed the recommended direction and are the documentary "why" of the endpoint. Their forward-looking plans (six-month plan; 90-day plan) are historical proposals, **not** adopted programs.
- **Generalizable methodology — RETAINED AS RESEARCH MATERIAL:** the ELTM methodology paper; the finding-disposition format itself; the gap-report and second-implementer practice; the canonicalization byte-equivalence test discipline. Value independent of Dillweed v1.
- **Research questions that remain open without implying implementation work:** capability-granular lifecycle; reconstructable resolution evidence consumed by policy engines; operator continuity; interoperability-conformance methodology; review-methodology validation. These live in the research documents and §25 — as questions.
- **Ledger and tracker — PRESERVED UNCHANGED** (provenance), with one additive, dated endpoint entry in the ledger recording this plan's adoption.

---

## 13. Archival Tag and Release Plan

*(§13 and §14 of the required structure are combined here; the numbering of this document's later sections follows the required order.)*

### 13.1 Tag selection

Existing convention: one semver tag, `v1.0.0`. A `v1.1.0`-style tag would imply a feature release; `stable`, `production`, `final-standard`, `certified`, and `release-1.0` are all unsupported by the evidence and excluded. Selected:

**Archival tag: `dillweed-v1-preservation-baseline`**

Applied to the final documentation-only preservation commit. The tag name communicates preservation without implying production readiness, certification, or standards status.

**GitHub release title:** `Dillweed v1 Preservation Baseline — Final Reference Implementation`

The release description uses §28-D. The release does **not** attach rebuilt tarballs; it references the immutable v1.0.0 assets and the manifest, and states the source-vs-tarball behavioral difference (§5.1).

### 13.2 Preconditions for tagging (ordered)

1. Final behavioral commit identified and recorded (`8c87a85`; done in this plan, confirmed at execution).
2. This plan merged.
3. `ARCHIVAL_MANIFEST.json` completed.
4. Component/spec version map verified against source and spec titles.
5. All component test suites executed at the preservation baseline; results recorded verbatim (including the known environmental failures).
6. `integration-test.sh` executed; result recorded.
7. Results written into `PRESERVATION.md` and the manifest.
8. Unresolved findings reconciled (§20 register matches the index after its endpoint pass).
9. Checksums re-verified (or explicitly marked unverified — currently verified 2026-07-02).
10. Historical banners completed (§16).
11. Root README updated (§17).
12. Docs index updated.
13. Public claims qualified or retired per §18.
14. Issue dispositions recorded (§23).
15. Final release notes written.
16. Preservation commit confirmed documentation-only (diff check, §5.2).
17. Tag signed if signing infrastructure exists (`git tag -s`); whether a suitable steward signing key exists for tags is PENDING MANUAL VERIFICATION — if none, an annotated tag with the manifest hash in the message is the fallback, recorded as such.

### 13.3 Why tag the preservation commit, not the behavioral commit

Tagging the preservation commit preserves both things a future reader needs: **exact runnable behavior** (reachable as `8c87a85`, recorded prominently in the tag message, manifest, and `PRESERVATION.md`) and **the final interpretive documentation** — this plan, the reconciled index, the banners, and the corrected claims — without which the behavioral tree would have to be interpreted through stale roadmaps and unqualified claims. The last behavioral commit is recorded separately and prominently in every archival artifact so the two are never conflated.

---

## 14. Preservation Manifest

*(Required-structure section 15.)*

Three artifacts, no more:

- **`PRESERVATION.md`** — authoritative human-readable status. **When information conflicts among archival artifacts, `PRESERVATION.md` controls.** Contains: the endpoint statement (§28-E), baseline identifiers, verified test results, the unresolved-risk register summary, supported/unsupported uses (§21 table), and reproduction instructions (or a pointer to the runbook section that provides them).
- **`ARCHIVAL_MANIFEST.json`** — machine-readable manifest (schema: Appendix B). Minimum contents: repository URL; archival tag; archival commit; last behavioral commit (`8c87a85`, with the `257a910` note); component versions (with the FDI-XST-007 caveat encoded as a field, not prose only); specification versions; release package filenames and SHA256 hashes (the three verified values); dependency versions (from `package.json`/lockfiles where tracked); runtime version (Node.js version used for the recorded test runs — PENDING at execution); OS assumptions (macOS/Apple Silicon reference deployment); default ports (Registry 9475, Resolver 9474, Anthill 9476); service startup order (Registry → Resolver → Anthill); cryptographic-key requirements (Ed25519 DNSO keypair; public-key SHA256 `909891e9…6f33`; dev keys git-ignored, regenerated at install); configuration files; test commands and recorded results; known unresolved findings (IDs from §20); unsupported deployment profiles (B, C, D, public writes); license (Apache-2.0) and NOTICE; review-provenance statement (reviews were AI-assisted and steward-commissioned — ledger AI-008); complete tracked-file inventory (84 files at `7eab9b5`; regenerate at the preservation commit).
- **`KNOWN_LIMITATIONS.md`** — only if the unresolved-risk material proves too long to keep legible inside `PRESERVATION.md`; otherwise do not create it. Redundant files are a maintenance liability in a frozen repository.

---

## 15. Historical-Banner Policy and Templates

*(Required-structure section 16.)*

Historical documents remain unchanged except for concise banners at the top. Many reviews already carry banners (commits `bf8dbe8`, `8a596d9`); the endpoint pass completes coverage and adds the endpoint pointer. Each banner carries: status · original date · original baseline · current disposition · current source of truth · link to this plan · link to the finding index where applicable. Templates in Appendix C; the six types:

1. **Historical review — status may have changed.** Accurate for its original baseline; not authoritative for current finding status; consult the finding-disposition index and this plan.
2. **Superseded architecture document.** Preserved for historical/research value; not the recommended future architecture; no implementation planned.
3. **Deprecated implementation or specification.** Retained for reproduction; not recommended for new deployment; known limitations apply (link).
4. **Research artifact.** Exploratory/analytical; not an operational specification; may contain unresolved hypotheses.
5. **Governance intent, not functioning institution.** Describes intended or founding-phase arrangements; does not establish that independent operators, councils, trustees, or multi-party governance existed.
6. **Archival baseline document.** Authoritative for final v1 preserved status; identifies its baseline and last review date.

Assignments: type 1 → the review corpus and gap reports; type 2 → v2 design, Namespace Standard, Standards Overview, mirror-mode spec sections (inline note), `v2-tracker.md` (plus the explicit "W1: decided not pursued" line); type 3 → Anthill service README, installer docs, trust-scoring sections; type 4 → research documents, strategic evaluation, ANS analysis, methodology paper, GSP-01; type 5 → Governance Framework, DNSO Charter (and GSP-01 in addition to type 4 — one combined banner; the primary disposition remains single); type 6 → this plan, `PRESERVATION.md`, the reconciled finding index.

No historical conclusion is rewritten. Banners state disposition; they do not edit findings.

---

## 16. README and Repository-Status Transition

*(Required-structure section 17.)*

Recommended root-README structure — first visible section (full notice text in §28-A):

1. **Status: preservation endpoint.** Dillweed v1 has reached a defined preservation endpoint; no W1 and no continued v1 architecture development is planned.
2. **What this repository is:** a reference implementation, research corpus, and review-methodology case study, preserved with verified artifacts.
3. **What it is not:** not recommended for production or new public trust deployments; no standards-adoption, independent-validation, or production-readiness claim.
4. **Superseded functions:** several original architectural functions (global registration authority, trust-root distribution, mirroring, parallel observability) are superseded by stronger or more institutionally supported infrastructure; see the ANS boundary analysis.
5. **Open research questions:** capability-level lifecycle and reconstructable resolution evidence remain research questions, not an implementation roadmap.
6. **Reproducible baseline:** archival tag `dillweed-v1-preservation-baseline`; last behavioral commit `8c87a85`; manifest in `ARCHIVAL_MANIFEST.json`.

Reader directions, in order: (1) this plan; (2) `ARCHIVAL_MANIFEST.json`; (3) known limitations (in `PRESERVATION.md`); (4) `docs/finding-disposition-index-2026-06.md`; (5) `docs/ans-v2-and-capability-standing-boundary-analysis-2026-06.md`; (6) `docs/independent-review-methodology-for-agentic-trust-infrastructure.md`; (7) reproduction instructions (runbook + install sections, retained below the notice).

Sections of the current README to update rather than delete: the "early stewardship phase" line (replaced by the preservation notice); "Linux support anticipated in a future release" (retired — §18); the Issue #2/#4 evaluator pointers (rewritten to their §23 dispositions); the "For researchers" section (retained — it is accurate and remains the repository's live purpose). The install, verification, and test-suite sections remain, under a "reproduction of the preserved baseline" heading with the local-use warning.

The intended message, verbatim: *the project completed a defined research and reference-implementation phase, preserved its evidence, documented its limitations, and stopped extending architecture that no longer justified independent continuation.*

---

## 17. Claim Audit

*(Required-structure section 18. Full table: Appendix D. Material claims and their controlling dispositions below; classifications are RETAIN / RETAIN WITH QUALIFICATION / HISTORICAL ONLY / RETIRE.)*

| Claim | Where | Disposition | Reason / replacement |
|---|---|---|---|
| "Neutral global namespace" / "neutral coordination root" (L1–L4) | Namespace Standard §9; Standards Overview | **RETIRE** | Single steward, single key, zero adopters; ANS analysis §23: no longer credible. Replacement: "a preserved research architecture for capability-level coordination." Historical occurrences remain with type-2 banners |
| "Publicly verifiable trust root" | Root README line 3 | **RETAIN WITH QUALIFICATION** | Root = one HTTPS-served PEM + published SHA. Replacement: "published trust root; record signatures independently verifiable against the published key" |
| Production readiness | Largely not claimed (doc-set review §8 confirms) | **RETAIN** (the absence) | The preservation wording must keep it absent |
| "Tamper evidence" for mirrors ("without trusting the mirror itself") | Registry Spec §2.2/§10.3 | **RETIRE** | Demonstrated false (FDI-DOC-007, mirror gap G-11). Spec text stays; inline caveat + banner |
| "Deterministic resolution" | DillClaw spec §3.3 | **RETIRE** | Not achievable as specified (FDI-RES-003). Replacement: "reconstructable, evidence-backed resolution decisions" |
| "Append-only audit" | Registry spec / README | **RETAIN WITH QUALIFICATION** | Append-only by convention; no cryptographic tamper evidence (FDI-XST-002) |
| Multi-organization operation; independent mirrors; global trust root | Specs, governance corpus | **HISTORICAL ONLY** | Never existed; profiles C/D blocked; type-2/5 banners |
| DNSO neutrality / independent governance / councils / trustees | Governance corpus | **HISTORICAL ONLY** | Intent documents; institutions never operated (§11) |
| Trust tiers; "verified capability standing" via tiers | Charter §4; specs; resolver | **RETIRE** (as trust signals) | Self-assigned, scored at face value (FDI-ID-004). Tier vocabulary suspended in outward-facing text |
| "Coordination above MCP and A2A" | Positioning text | **RETIRE** | Unsupported; replacement: "MCP-integrated capability resolution (demonstrated locally)" |
| Public Resolver (planned) | README, Issue #2 | **HISTORICAL ONLY** | No public deployment occurred or is planned; Issue #2 becomes a historical gate record |
| First-of-kind (any variant) | Any occurrence | **RETIRE** | ANS lineage predates publication; both converged on shared prior art. Temporal priority is not used as an argument anywhere in the preserved status wording |
| Standards status / interoperable standard | Standards Overview framing | **RETIRE** | No adoption, no independent implementation; 9 second-implementer blockers |
| "External review" / "external audit" / "each individually audit-cycled by external review" | README (already qualified at `4156c1d`); v1.0.0 release notes & release body (unqualified) | **RETAIN WITH QUALIFICATION** | Reviews were AI-assisted and steward-commissioned (ledger AI-008). README fixed; release notes get a banner; the GitHub release body should gain one qualifying line (release bodies are editable metadata, not history — record the edit in the ledger) |
| Independent assessment / third-party validation / peer review | Nowhere claimed directly; risk of inference | **RETAIN** (the absence) + explicit disclaimer in `PRESERVATION.md` (FDI-RESR-001: zero external validation on record) |
| Cross-vendor interoperability | Aspirational text | **RETIRE** | Replacement: "designed for cross-implementation conformance; blocked by documented gaps (spec-gap report)" |
| Revocation guarantees | DillClaw §7.5 | **RETAIN WITH QUALIFICATION** | Bounded-staleness propagation demonstrated locally; ≤30-min adversarial freeze documented (FDI-RES-008); no guarantee beyond the local profile |
| "Anthill integrity monitoring" / escalation / anomaly detection | Anthill spec/README | **RETIRE** | It is a signal store with unauthenticated inputs (FDI-ANT-001/009) |
| Deployability from specifications | Implied by spec framing | **RETIRE** | Second-implementer report: 9 blockers |
| Continuity guarantees | GSP-01 | **RETAIN WITH QUALIFICATION** | Design retained as research; instruments unexecuted (FDI-GOV-002) |
| "19/19 passing", test counts | README | **RETAIN WITH QUALIFICATION** | Pinned to stated baselines; re-run at the preservation baseline before tagging (§13.2) |
| "Linux support anticipated in a future release" | README install section | **RETIRE** | No feature releases will occur |
| "Remainder scheduled for v2 waves W1–W2" | README evaluation-readiness section | **RETIRE** | Contradicts the endpoint decision; replaced by pointer to §20 register |
| `patches/` "historical patch artifacts (v0.1.8, v0.2.8, v0.1.5)" | README repo layout | **RETAIN WITH QUALIFICATION** | Directory is empty in git (`*.tar.gz` ignored). Either annotate "not tracked in git; archived offline" or resolve in §29 |
| Website (dillweed.com) claims | Not in repo beyond specs mirror | **PENDING MANUAL VERIFICATION** | Reconcile site status text with §28 wording after tagging |

Distinctions preserved throughout all replacement wording: implemented ≠ specified ≠ proposed ≠ tested locally ≠ reproduced independently ≠ publicly deployed ≠ institutionally governed ≠ production ready.

---

## 18. Supportable Final Claims

*(Required-structure section 19.)* Claims that survive, phrased at the actually available evidence level:

1. The project produced an **independently developed reference architecture** for capability registration, resolution, and revocation (provenance: repository history, ledger, domain history; independence in the convergence sense, with ANS/AgentDNS cited as related work in Namespace Standard §1).
2. A **local three-service stack was implemented** (Registry 0.2.8, Resolver 0.1.8, Anthill 0.1.6) with SHA-pinned release artifacts whose checksums were independently re-verified on 2026-07-02.
3. **Capability-level registration, resolution, and revocation were demonstrated locally**, including a 19-check end-to-end lifecycle test (count as documented; re-execution required by §13.2 before tagging).
4. **Signed capability records and per-decision resolution traces were implemented** — with the signed-field-subset defect (FDI-CRY-001) documented rather than concealed.
5. The project created a **substantial review and gap-analysis corpus** — three architecture reviews, a cross-service trust-boundary analysis, six consistency rounds, four gap reports, a documentation-set review, and a 70-finding disposition index — produced with AI assistance and steward commissioning, and labeled as such.
6. **Unresolved risks were documented rather than concealed**, including one open CRITICAL finding disclosed in the project's own README.
7. The work **independently converged on problems also recognized by other industry and standards efforts** (agent/capability identity, lifecycle, transparency) — convergence, not priority, is the claim.
8. The project produced a **reusable methodology for reviewing agentic trust infrastructure** (the ELTM paper), explicitly not peer-reviewed and derived from a single case.
9. **Capability-granular lifecycle** and **reconstructable resolution evidence** remain defensible research questions (ANS analysis §9, §20).
10. The **continuity-protocol design and finding-disposition method** are potentially useful outside Dillweed, as unexecuted designs and demonstrated practice respectively.

---

## 19. Unresolved Findings and Residual Risks

*(Required-structure section 20.)* The preservation endpoint intentionally contains open findings. **The preservation endpoint records the project honestly; it does not certify that every defect was resolved.**

Source: `docs/finding-disposition-index-2026-06.md` (70 canonical findings at `c999fdd`: 30 OPEN, 22 DEFERRED TO V2, 6 PARTIALLY CLOSED, 5 CLOSED, 4 ACCEPTED FOR V1, 1 each SUPERSEDED / NOT A DEFECT / UNVERIFIED — REPORTED BY PROJECT DOCUMENTATION; the index's endpoint pass re-pins these to the preservation baseline). All former "DEFERRED TO V2" entries become **DEFERRED — NO IMPLEMENTATION PLANNED** at the endpoint. The register below carries the highest-consequence entries; the index remains the complete record.

| Finding | Title | Severity | Confidence | Component | Affected profiles | Endpoint disposition | Why unresolved | Archival consequence | Closure requirement |
|---|---|---|---|---|---|---|---|---|---|
| FDI-ANT-001 | `node_signature` never verified — signals unauthenticated | CRITICAL | High (code-verified at `c999fdd`) | Anthill | D + any Anthill reliance | OPEN — no implementation planned | Fix was W1 scope; W1 not pursued | Anthill deprecated; its evidence unusable | New charter + verified submitter identity |
| FDI-CRY-001 | `registration_date` outside signed field set → score forgeable | HIGH | High (code-verified) | Crypto/Registry | D; trust-score claims | OPEN — no implementation planned | W2 scope | Scalar scoring deprecated; claim retired | Signed-field redesign under new charter |
| FDI-ID-001 | No registrant identity; shared token; fail-open writes | HIGH | High | Identity | D (+B if writable) | OPEN — no implementation planned | W1–W2 scope | Public writes deprecated permanently | Identity substrate (e.g., ANS-class) under new charter |
| FDI-ID-004 | Self-assigned tiers scored at face value | HIGH | High | Identity/Resolver | D; tier claims | OPEN — no implementation planned | W2 scope | Tier vocabulary suspended | Verifiable attestations |
| FDI-ANT-002 | Sequence-counter poisoning suppresses victim signals | HIGH | High | Anthill | D | OPEN — no implementation planned | W1 scope | Included in Anthill deprecation | — |
| FDI-CRY-003 | Root signing key inside network-facing process | HIGH (P1) | High | Crypto | B(authoritative), D | OPEN — no implementation planned | W1 scope | No public authoritative deployment, ever, from this baseline | Key isolation under new charter |
| FDI-REG-002 | Mirror mode specified, not implemented; no sync protocol | P0 / 7×HIGH | High | Registry | C, D | OPEN — no implementation planned | W3 scope; superseded by TL architectures | Mirror mode deprecated; spec claim retired | — |
| FDI-XST-003 | Specs insufficient for independent second implementation (88 gaps, 9 blockers) | 9 blockers | High | Specs | C, D, 2nd impl | OPEN — documentation-honesty residual | Closing it = new spec engineering, excluded by endpoint | Specs authoritative for archival baseline only | Independent implementation evidence |
| FDI-XST-004 | Wildcard CORS + fail-open tokens + 0.0.0.0 binds | MEDIUM | High | Cross-stack | B | OPEN — acceptable for local reproduction | Design-W0 dropped it; endpoint freezes it | Prominent local-only warning | — |
| FDI-OPS-001/002 | No TLS between components; no threat model | Gate | High | Ops | B | OPEN — no deployment planned | Public resolver never shipped | Issue #2 closed as not pursued; gate record preserved | — |
| FDI-RES-003 | Determinism MUST not achievable as specified | P1 | High | Resolver spec | Claims | OPEN — claim retired instead | Spec fix would be normative engineering | §18 replacement wording | — |
| FDI-RES-004 | Unbounded synchronous trace writes | P1 | High | Resolver | B | OPEN — acceptable locally | Dropped from W0 | Local warning; disk-fill risk on any public node | — |
| FDI-DOC-008 | Spec documents client conditional fetch that code lacks | HIGH (doc) | High | DillClaw spec | Spec accuracy | OPEN — disclosed by banner | Code fix excluded by endpoint | Banner on spec + manifest note | — |
| FDI-XST-007 | No spec↔impl version map; W0 changed behavior at unchanged versions | MEDIUM | High | Cross-stack | Claims/repro | PARTIALLY CLOSED by this plan + manifest | Version strings frozen as-is | Manifest carries the commit-level map | — |
| FDI-DOC-005 | Cited steward reports absent from repo | MEDIUM | High | Docs | Provenance | OPEN — see §29 | Reports may exist offline | Audit chain for 3 W0 commits not independently readable | Deposit or mark NOT AVAILABLE |
| FDI-OPS-010 | Anthill release asset ~9.9 MB vs ~51 KB peers | LOW | Low | Release | Repro hygiene | UNVERIFIED — see §29 | Needs asset content audit | Manifest notes anomaly until audited | Extract + inventory the asset |
| FDI-GOV-001/002/003 | Single-steward contradiction; continuity instruments unexecuted; governance bodies never existed | Structural | High | Governance | D, claims | OPEN — resolved by disclosure, not repair | Institutions cannot be retro-created | §11 statements + type-5 banners | New charter with real parties |
| FDI-RESR-001 | Zero external validation on record | — | High | Research | Claims | OPEN — disclosed | External facts never materialized | Explicit disclaimer in `PRESERVATION.md` | Independent reproduction (§25 trigger) |

Profile-level meaning: acceptable for local reproduction (XST-004, RES-004, OPS-006); blocking public read deployment (OPS-001/002, XST-004, RES-004, ID-002); blocking public write deployment (ID-001, CRY-003); blocking multi-organization operation (the ANT/ID/CRY/REG cluster); blocking independent interoperability (XST-003, CRY-002); blocking production claims (all of the above + RES-003, XST-007); documentation-only residuals (DOC-003/004/005/009, XST-007 residue).

---

## 20. Supported and Unsupported Uses

*(Required-structure section 21.)*

| Use case | Supported at preservation endpoint | Evidence | Important limitations |
|---|---:|---|---|
| Reading the source | **Yes** | 84 tracked files, Apache-2.0 | — |
| Studying the architecture | **Yes** | Specs + review corpus + this plan | Reviews are historical; index is current |
| Reproducing the local reference stack | **Yes (macOS)** | Installers, runbook, verified tarballs | macOS-only; no CI; dependency drift possible over time (§22 maintenance) |
| Running the 19-check lifecycle test | **Yes** | `integration-test.sh` in tree | Requires local stack; counts re-verified at tagging |
| Studying capability-level revocation | **Yes** | Registry/DillClaw specs, lifecycle test, ANS analysis §10 | Research study, not operational guidance |
| Studying decision traces | **Yes** | Resolver trace design, `traces/` layout | Trace corpus itself is git-ignored; format is in code/spec |
| Studying review methodology | **Yes** | ELTM paper, disposition index, gap reports | Single-case, AI-assisted, not peer-reviewed |
| Studying governance/continuity proposals | **Yes** | Governance corpus, GSP-01 | Intent documents; institutions never operated |
| Using the code as a production trust service | **No** | §19 register (ID-001, CRY-003, ANT-001…) | Explicitly unsupported |
| Accepting public registrations | **No** | FDI-ID-001: fail-open shared-token writes | Deprecated permanently at this baseline |
| Operating a public Resolver | **No** | Issue #2 gate unmet (TLS, threat model, CORS/binds, traces) | Issue closed as not pursued |
| Operating an independent mirror | **No** | FDI-REG-002: no sync protocol exists | Mirror mode deprecated |
| Relying on Anthill signals | **No** | FDI-ANT-001 (CRITICAL): unauthenticated | Anthill deprecated for reliance of any kind |
| Deploying across organizations | **No** | Profile-D blocker cluster | — |
| Claiming neutral governance | **No** | FDI-GOV-001/003 | Claim retired |
| Using trust scores for authorization | **No** | FDI-CRY-001 + FDI-ID-004: forgeable inputs | Scalar scoring deprecated |
| Treating the specs as an interoperable standard | **No** | FDI-XST-003: 9 second-implementer blockers; zero independent implementations | Specs authoritative for the archival baseline only |
| Presenting the system as an ANS implementation | **No** | No formal ANS integration, contribution, adoption, or endorsement exists (§24) | The transition does not make v1 an ANS implementation |

---

## 21. Post-Transition Maintenance Policy

*(Required-structure section 22.)* Default repository state after transition: **Maintenance Mode.** The repository remains unarchived initially; architectural development is frozen.

| Category | Permitted | Prohibited |
|---|---|---|
| Documentation | Preservation-instruction correction; broken-link repair; factual corrections; citation correction; security-warning clarification; vulnerability notices; metadata required for preservation | Rewriting historical findings without documented disposition; claims of adoption/validation without evidence |
| Code | Dependency pinning required for reproduction; test-runner compatibility fixes proven behavior-preserving; archival packaging | New protocol behavior; new trust tiers; new namespace semantics; new mirror architecture; feature development; silent cryptographic changes; redesign under the v1 label |
| Release/artifacts | Checksum correction with documented cause; migration to archival hosting; external archival deposits | Replacing v1.0.0 assets; re-tagging; altering the archival tag |
| Governance | None | New governance authority; reopening W1/v2 in the preserved lineage |

**Compatibility-fix protocol:** dedicated maintenance branch or PR; explicit changelog entry; stated reason; tests executed and recorded; confirmation that intended behavior is unchanged; a new maintenance tag (`dillweed-v1-maintenance-YYYYMMDD`) when a fix lands after the archival tag; the original archival artifact remains accessible unchanged.

**Security vulnerabilities:** document promptly (repo security advisory or `PRESERVATION.md` notice); assess whether a behavior-preserving fix is possible; never silently alter the preservation baseline; issue a maintenance release only when preservation value outweighs the loss of exact reproducibility; the original tagged baseline is retained unchanged in all cases.

---

## 22. Issue and Repository Management

*(Required-structure sections 19/23 of the brief — repository transition and issue disposition.)*

### 22.1 Maintenance mode before GitHub archival

Formal GitHub **Archive this repository** is deliberately deferred. Reasons: the methodology paper and preserved research may generate legitimate questions; compatibility or archival fixes may be needed (§21); issue/PR history remains useful and linkable; formal archival disables normal interaction and sends a stronger finality signal than the observation period warrants; interaction can remain open without reopening architecture development, because the contribution rules below are strict.

**Accepted contributions:** reproducibility corrections; archival fixes; factual corrections; security notices; citation corrections; documentation clarifications.
**Rejected contributions:** new features; new protocol proposals; W1 or v2 implementation; revival of retired claims; new governance structures under the v1 lineage.

Formal archival may be reconsidered only after: the §26 checklist is complete; the repository has been stable for a defined observation period (recommended: two quarters); no compatibility maintenance is expected; open issues are dispositioned; external research interaction no longer requires repository participation; and the steward explicitly approves the archive action.

### 22.2 Issue disposition

Every open issue receives exactly one of: closed as completed before preservation · closed as superseded · closed as intentionally not pursued · retained open as an archival limitation · converted into a research question · transferred to a separate future research venue. No mass-closing with identical generic wording; each closure links issue ↔ canonical finding ↔ disposition ↔ plan section ↔ archival consequence. Comment templates: Appendix E.

Current issues (all four — VERIFIED via `gh`):

| Issue | State | Disposition |
|---|---|---|
| #1 (Anthill version refs) | CLOSED 2026-06-06 | Closed as completed before preservation; no action |
| #2 (pre-public-resolver hardening) | OPEN | **Close as intentionally not pursued.** No public Resolver will be deployed from this baseline. The three gate requirements (TLS, rate limiting, threat model) are preserved as the historical record of why; rate limiting was completed by W0 (FDI-XST-001, partial); the rest remain open by design. Links: FDI-OPS-001/002, §19, §20 |
| #3 (evaluation readiness) | CLOSED 2026-06-06 | Closed as completed before preservation; no action |
| #4 (v2 architecture) | OPEN | **Close as superseded** by the endpoint decision (§3) and the ANS boundary analysis. Its research-worthy elements (key hierarchy, attestation, MCP verification, rotation testing) are already reflected in the research documents and §25's research-question list — converted, not lost. Links: FDI-CRY-003/004/005, FDI-ID-005, FDI-XST-005, §25 |

Any future issue describing W1/v2 implementation is closed as intentionally not pursued or superseded unless it is genuinely a research question, in which case the template E-5 conversion applies.

---

## 23. Relationship to ANS and Existing Infrastructure

*(Required-structure section 24.)* Stated without rivalry or defeat framing, at the evidence level of the in-repo analysis:

- ANS v2 (an individual Internet-Draft with a multi-vendor reference implementation and a Linux Foundation **intent** announcement) materially overlaps the original global identity-and-discovery direction of this project.
- For several functions — registration-time validation, domain-anchored identity, transparency-logged metadata sealing, trust-root/key distribution, mirror/replication (dissolved by log architecture) — ANS and established infrastructure (DNS/DNSSEC, ACME, CT/SCITT-class logs, OTel) provide stronger or more institutionally supported mechanisms than this project's bespoke equivalents. This is the documented conclusion of the project's own comparative reviews, not an external imposition.
- Continued independent duplication of those functions is not justified; this conclusion contributed directly to selecting v1 as the endpoint.
- Capability-granular lifecycle and reconstructable resolution evidence remain potentially complementary research questions (ANS analysis §9/§20) — questions, not a program.
- **No claim of formal ANS integration, contribution, adoption, or endorsement exists.** No evidence in the repository supports any such claim, and none is made. Nothing implies ANS derived anything from Dillweed or vice versa; both visibly converged on shared prior art, and temporal priority is not used as an argument anywhere in this plan.
- The preserved v1 code does not become an ANS implementation through this transition.
- Dillweed v1 remains valuable as an independent case study, reference implementation, and provenance record of that convergence.

---

## 24. Future Research and Reactivation Conditions

*(Required-structure section 25.)* **There will be no W1 development. There is no implied v2 commitment.**

Future work may resume only on materially new evidence, such as: external researcher or maintainer interest; a concrete standards-extension opportunity; policy-engine demand for capability-resolution evidence; independent reproduction of the preserved baseline; an independent implementation attempt; funded research with defined scope; or evidence that a distinct problem remains unresolved elsewhere.

Any resumed work must: operate under a **new charter**; use a **separate branch, repository, or version lineage**; leave the v1 archival tag unchanged; reassess the then-current standards landscape; not automatically revive retired claims; define falsifiable hypotheses; carry explicit scope limits and kill criteria; and seek independent review where practical.

Open research questions preserved (as questions): capability-granular lifecycle semantics; reconstructable resolution evidence and its policy-engine consumers; operator-continuity protocols; conformance/gap-report methodology validation; the ELTM method's replication. The ANS analysis's profile sketch and 90-day plan are recorded proposals available to a future charter — nothing more.

Absence of these triggers means the v1 endpoint remains final.

---

## 25. Preservation Principles

*(Required-structure section 26.)*

1. **Preserve provenance.** The chronological record of what was built, reviewed, fixed, reconsidered, and superseded stays intact — ledger, tracker, reviews, and all.
2. **Do not rewrite history.** Banners, the disposition index, and this plan interpret; they never silently edit historical conclusions.
3. **Preserve negative results.** Gap reports, unresolved findings, incomplete deployment modes, and superseded designs are part of the research value.
4. **Preserve reproducibility.** Enough source, dependency, configuration, test, and release information remains for a competent researcher to recreate the final reference environment where practical.
5. **Separate preservation from endorsement.** An artifact may remain important without being recommended for use.
6. **Keep claims synchronized with evidence.** The final README and this plan govern how historical materials are interpreted.
7. **Freeze the endpoint.** The archival tag is immutable; future research cannot rewrite the preserved v1 baseline.

---

## 26. Completion Checklist

*(Required-structure section 27.)* No item is marked complete without evidence.

### Required before creating the archival tag

- [ ] Preservation and Transition Plan approved by the steward
- [ ] Final behavioral commit identified (`8c87a85`; `257a910` judgment recorded)
- [ ] Preservation commit confirmed documentation-only (diff check per §5.2)
- [ ] Component-version map verified (including the FDI-XST-007 caveat)
- [ ] Specification-version map verified
- [ ] All component test suites executed at the preservation baseline
- [ ] `integration-test.sh` executed
- [ ] Test results recorded verbatim in `PRESERVATION.md` + manifest
- [ ] Unresolved findings reconciled (index endpoint pass complete; §19 register matches)
- [ ] `ARCHIVAL_MANIFEST.json` generated
- [ ] Package checksums verified (done 2026-07-02; re-confirm) or marked unverified
- [ ] README status notice added (§28-A)
- [ ] Docs index updated
- [ ] Historical banners completed (§15 assignments)
- [ ] Unsupported claims removed or qualified (§17 / Appendix D)
- [ ] GitHub issues dispositioned (§22.2)
- [ ] Final release notes written
- [ ] Archival tag `dillweed-v1-preservation-baseline` created (signed if infrastructure exists)
- [ ] GitHub release created with the §28-C title and §28-D summary

### Recommended after tagging

- [ ] External archival copy deposited (independent of GitHub)
- [ ] Release archived in a preservation service
- [ ] Methodology prompt and provenance preserved (this plan's commissioning context recorded in the ledger)
- [ ] dillweed.com status reconciled with §28 wording
- [ ] Observation period defined for maintenance mode (recommended: two quarters)
- [ ] Formal GitHub-archive decision date set and reviewed

### Optional preservation enhancements

- [ ] Software Heritage (or equivalent long-term archive) submission
- [ ] Reproducibility walkthrough by an independent person — this would be the project's first independent reproduction and is the single most valuable optional item
- [ ] Independent checksum verification by a second party
- [ ] Containerized reproduction environment (breaks the macOS-only limitation without new architecture; qualifies as archival packaging under §21)
- [ ] Citation metadata / DOI deposit for the methodology paper and research corpus

---

## 27. Authoritative Final Status Wording

*(Required-structure section 28.)*

### A. Root README preservation notice

> **Project status: preserved (v1 endpoint).**
> Dillweed v1 is the final implementation state of this project. Development of the original parallel namespace architecture ended at a deliberate, documented endpoint; there is no W1 phase and no v1 feature roadmap. The repository is preserved as a reference implementation, research corpus, and review-methodology case study.
> The implementation is **not recommended for production use or new public trust deployments**. No standards adoption, independent validation, or production-readiness claim is made. Several original architectural functions are superseded by stronger, more institutionally supported infrastructure; capability-level lifecycle and reconstructable resolution evidence remain open research questions, not a roadmap.
> Reproducible baseline: tag `dillweed-v1-preservation-baseline` · last behavioral commit `8c87a85` · manifest: `ARCHIVAL_MANIFEST.json` · status and limitations: `PRESERVATION.md` · plan: `docs/dillweed-v1-preservation-and-transition-plan.md` · finding status: `docs/finding-disposition-index-2026-06.md`.

### B. GitHub repository description

> Preserved reference implementation and research corpus for capability registration, resolution, and revocation (Dillweed v1 — final). Not for production; see PRESERVATION.md for status, limitations, and the reproducible baseline.

### C. Archival release title

> Dillweed v1 Preservation Baseline — Final Reference Implementation

### D. Archival release summary

> This release marks the preservation endpoint of the Dillweed Namespace Project. It tags the documentation-only preservation commit that records the project's final status; the last behavioral commit is `8c87a85`, and the frozen v1.0.0 component tarballs (Registry 0.2.8, Resolver 0.1.8, Anthill 0.1.6, SHA256-pinned) remain attached to the v1.0.0 release. The source tree additionally contains the W0 hardening changes, which post-date those tarballs at unchanged version strings — see `ARCHIVAL_MANIFEST.json` for the commit-level map. This release makes no production, standards, validation, or security claim; unresolved findings, including one CRITICAL, are documented in the finding-disposition index and `PRESERVATION.md`.

### E. Final project-status statement

> The Dillweed Namespace Project designed and implemented a capability-registration, resolution, and revocation stack — a Registry, the DillClaw Resolver, the Anthill signal service, and an MCP adapter — with signed capability records, capability-granular revocation, per-decision resolution traces, and a locally demonstrated end-to-end lifecycle. It documented itself with unusual rigor: eight specifications, a multi-round review corpus, deployment and second-implementer gap reports, a 70-finding disposition index, and a reusable review-methodology paper.
>
> It did not achieve external adoption, independent implementation, public deployment, standards standing, or operating multi-party governance, and its reviews left one CRITICAL and several HIGH findings open at the endpoint — documented, not resolved.
>
> v1 development ended because the project's own evaluations concluded that most of its infrastructure layer is now better served by stronger, institutionally supported efforts, and that continued independent duplication was not justified. The steward selected v1 as the final implementation state; the planned W1 phase was not pursued.
>
> What is preserved: the complete runnable local reference stack, SHA-verified release artifacts, full provenance (ledger, reviews, findings, decisions), and the research corpus. What remains useful: the capability-standing problem formulation, capability-granular lifecycle semantics, reconstructable resolution evidence, the continuity-protocol design, and the review methodology. What is not recommended: any production, public, multi-organization, or trust-bearing deployment of this code, and any reliance on its trust scores or Anthill signals.
>
> Current status, limitations, and the reproducible baseline are recorded in `PRESERVATION.md`, `ARCHIVAL_MANIFEST.json`, the finding-disposition index, and the Preservation and Transition Plan. Future work, if it ever occurs, requires materially new evidence and a new charter, in a separate lineage; the preserved v1 baseline is final.

---

# Manual Verification Required Before Adoption

*(Required-structure section 29.)* This plan becomes authoritative only after each item is verified and recorded:

1. **Test execution at the preservation baseline.** Run all four suites (`registry/test.sh`, `resolver/test.sh`, `resolver/unit-tests.js`, `anthill/test.sh`) and `integration-test.sh`; record exact counts, Node.js version, and the environmental-failure set. All current counts are REPORTED, not verified. Command set is in the README §"Running test suites".
2. **Preservation-commit diff check.** After assembling the preservation commit: `git diff 8c87a85..HEAD -- registry/ resolver/ anthill/ mcp-server/ integration-test.sh` must show only the `257a910`/`ca1c590` non-behavioral changes plus nothing new.
3. **Tarball content audit (FDI-OPS-010).** Extract all three v1.0.0 assets; inventory contents; explain the Anthill asset's ~9.9 MB size vs ~51 KB peers (REPORTED anomaly, UNVERIFIED); record whether tarball source matches tag `v1.0.0` source.
4. **Absent steward reports (FDI-DOC-005).** Locate `steward-report-2026-06-10-r3` and `reports/steward-report-2026-06-11.md`; either deposit them (documentation-only) or mark them NOT AVAILABLE in the manifest so the W0 audit chain's gap is explicit.
5. **`patches/` directory.** Confirm whether patch artifacts exist offline; annotate the README layout description accordingly (currently empty in git).
6. **dillweed.com reconciliation.** Fetch the live site; confirm spec versions match `specs/`; update site status text to §28 wording; verify `dnso_public.pem` still serves with SHA256 `909891e9…6f33`.
7. **Live deployment disposition.** Decide and record the fate of the dill-p-001 reference deployment (keep running privately, or decommission with a dated ledger entry). Nothing in this plan requires it to keep running.
8. **Tag signing capability.** Determine whether a steward key suitable for `git tag -s` exists; record signed/annotated status in the manifest.
9. **Finding-index endpoint pass.** Re-pin the index to the preservation baseline; convert V2-deferred dispositions per §19; confirm the §19 register matches the reconciled index exactly.
10. **Dependency and runtime inventory.** Record exact Node.js and dependency versions used for the verification test runs in the manifest (lockfiles are partially git-ignored; capture versions at run time).
11. **GitHub release-body edit (claim qualification).** Add the AI-assisted-review qualification line to the v1.0.0 release body per §17, and record the edit in the ledger.
12. **License/NOTICE confirmation.** Confirm NOTICE attributions are current for the frozen dependency set.

---

## Appendix A — Full Artifact-Disposition Inventory

Items not individually rowed in §8 inherit the family disposition shown; exceptions are explicit.

**Implementations (MAINTAINED FOR REPRODUCIBILITY unless noted):** `registry/server.js`, `setup.js`, `install.sh`, `start.sh`, `test.sh`; `registry/resolver-patch.js` (PRESERVED UNCHANGED — unused artifact, INST-012, kept as shipped); `registry/rotate-key.js` (PRESERVED UNCHANGED — unexercised, FDI-CRY-005); `resolver/server.js`, `unit-tests.js`, `test.sh`, `install.sh`, `start.sh`, `registry.json`, `tools/generate-keys.js`; `resolver/traces/` (.gitkeep only — trace corpus never tracked); `anthill/*` (service DEPRECATED per §9.3; files maintained only for reproduction); `mcp-server/*`; `integration-test.sh`; launchd plists (shipped inside tarballs — PRESERVED UNCHANGED with the tarballs); mirror-mode code paths in `registry/server.js` (DEPRECATED); experimental/proposed v2 code: **none exists in the repository** (W0 was hardening, not protocol change; verified via the tracker and commit list).

**Specifications (dispositions per §8/§10):** `specs/namespace-standard.html` (SUPERSEDED as live track), `registry-spec.html`, `dillclaw-spec.html`, `anthill-spec.html` (PRESERVED UNCHANGED, archival-baseline authority only), `standards-overview.html` (SUPERSEDED), `governance.html`, `dnso-operations-charter.html` (PRESERVED UNCHANGED, intent), `continuity-protocol.html` (RETAINED AS RESEARCH MATERIAL). Schemas and protocol examples embedded in the specs share their host spec's disposition. MCP integration material in `mcp-server/README.md`: MAINTAINED FOR REPRODUCIBILITY.

**Governance and continuity concepts:** trustee/succession, trust-tier governance, participant/council structures, single-steward provisions, root-key custody procedures, mirror governance, dispute/transition mechanisms — all PRESERVED UNCHANGED as intent within their host documents, except continuity/succession design (RETAINED AS RESEARCH within GSP-01). None describes an institution that operated (§11).

**Review and research corpus (per §12):** six consistency rounds, three architecture reviews, trust-boundary analysis, four gap reports, registry-vs-infrastructure and anthill-vs-observability comparisons, documentation-set review — PRESERVED UNCHANGED. Finding-disposition index — MAINTAINED FOR REPRODUCIBILITY (one endpoint pass). Strategic evaluation, ANS boundary analysis, research documents, methodology paper — RETAINED AS RESEARCH MATERIAL. `PROJECT_LEDGER.md`, `v2-tracker.md`, `docs/dillweed-v2-design-2026-06-10.md` — PRESERVED UNCHANGED / PRESERVED UNCHANGED / SUPERSEDED respectively. `docs/operations-runbook.md` — MAINTAINED FOR REPRODUCIBILITY. `docs/release-notes/v1.0.0-release-notes.md` — PRESERVED UNCHANGED.

**Public and navigational material:** root `README.md`, `docs/README.md`, repository description, GitHub topics, issue templates (none currently exist — VERIFIED; add none), GitHub Discussions (not enabled at review — PENDING MANUAL VERIFICATION if enabled later), badges (none in README — VERIFIED), release descriptions, roadmap text, public-deployment claims — MAINTAINED FOR REPRODUCIBILITY as navigation, governed by §17/§18 wording. `LICENSE`, `NOTICE`, `.gitignore` — PRESERVED UNCHANGED (gitignore may receive reproduction-necessary fixes under §21).

## Appendix B — Archival Manifest Schema

```json
{
  "manifest_version": "1.0",
  "repository_url": "https://github.com/Dillweed-Namespace/dillweed-namespace",
  "archival_tag": "dillweed-v1-preservation-baseline",
  "archival_commit": "<preservation commit sha - PENDING>",
  "last_behavioral_commit": "8c87a85",
  "behavioral_commit_notes": "257a910 later changed comment/banner strings only; classified non-behavioral (plan §5.1)",
  "components": [
    {"name": "registry", "version": "0.2.8",
     "version_caveat": "W0 behavioral changes post-date the 0.2.8 tarball at unchanged version string (FDI-XST-007)",
     "spec": "registry-spec v0.1.6",
     "release_asset": "dillweed-registry-v0.2.8.tar.gz",
     "sha256": "f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a",
     "default_port": 9475}
    // resolver 0.1.8 / spec v0.1.8 / sha256 2e3376a5… / port 9474
    // anthill 0.1.6 / spec v0.1.3 / sha256 3bda022d… / port 9476
    // mcp-server 1.0.0 (no release asset)
  ],
  "specifications": {"namespace-standard": "v0.4.4", "standards-overview": "v1.0.10",
    "governance": "v1.1.3", "dnso-operations-charter": "v1.0.3", "continuity-protocol": "v1.0.3"},
  "trust_root": {"url": "https://dillweed.com/dnso_public.pem",
    "sha256": "909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33"},
  "runtime": {"node_version": "<PENDING - record at verification run>", "os": "macOS (Apple Silicon reference)",
    "startup_order": ["registry", "resolver", "anthill"]},
  "tests": {"commands": ["registry/test.sh", "resolver/test.sh", "node resolver/unit-tests.js",
    "anthill/test.sh", "bash integration-test.sh"],
    "results": "<PENDING - verbatim counts + environmental-failure set>"},
  "unresolved_findings": ["FDI-ANT-001 (CRITICAL)", "…full list from index endpoint pass"],
  "unsupported_profiles": ["public read-only resolver", "public authoritative registry",
    "independent mirror", "multi-organization production", "public writes"],
  "license": "Apache-2.0",
  "review_provenance": "Reviews AI-assisted, steward-commissioned (ledger AI-008); not independent third-party assessment",
  "file_inventory": ["<git ls-files at archival commit>"]
}
```

## Appendix C — Historical Banner Templates

Each ≤6 lines, placed at the top of the document, content untouched below it. `{…}` filled per document.

**C-1 Historical review:**
> **HISTORICAL REVIEW — findings may have changed.** Accurate for its baseline ({date}, commit `{sha}`). Not authoritative for current status. Current status: `docs/finding-disposition-index-2026-06.md`. Endpoint: `docs/dillweed-v1-preservation-and-transition-plan.md`.

**C-2 Superseded architecture:**
> **SUPERSEDED ARCHITECTURE — preserved for historical and research value.** Not the recommended future design; no implementation is planned (v1 endpoint, {date}). See the transition plan §8 and the ANS boundary analysis.

**C-3 Deprecated implementation/specification:**
> **DEPRECATED FOR NEW USE — retained for reproduction of the preserved v1 baseline.** Not recommended for new deployment. Known limitations: `PRESERVATION.md` and finding index ({finding IDs}). Transition plan: `docs/dillweed-v1-preservation-and-transition-plan.md`.

**C-4 Research artifact:**
> **RESEARCH ARTIFACT** ({date}, baseline `{sha}`). Exploratory/analytical; not an operational specification; may contain unresolved hypotheses. Interpretation governed by the transition plan.

**C-5 Governance intent:**
> **GOVERNANCE INTENT — not a functioning institution.** Describes intended or founding-phase arrangements. No independent operators, councils, trustees, or multi-party governance existed or operated. See transition plan §11.

**C-6 Archival baseline document:**
> **ARCHIVAL BASELINE DOCUMENT** — authoritative for the final preserved status of Dillweed v1. Baseline: tag `dillweed-v1-preservation-baseline` (commit `{sha}`); last behavioral commit `8c87a85`. Last reviewed {date}.

## Appendix D — Claim-Disposition Table

The §17 table is the controlling claim audit; this appendix adds only the source-location detail not already inline there. Sources per claim: README (`README.md` lines 3, 5, 20–22, 78, 171, 187), Namespace Standard §9 and §1, Standards Overview (framing throughout), Registry Spec §2.2/§10.3, DillClaw Spec §3.3/§6.4/§7.5, Anthill Spec/README, Charter §4, GSP-01 §10–11, v1.0.0 release notes ("External audit" section) and release body, repository description, `v2-tracker.md` header/Next-Step line. Badges: none exist. Issue descriptions: dispositioned in §22.2. Every RETIRE/HISTORICAL claim's historical occurrence **remains in place with a banner**; only living surfaces (README, docs index, repo description, release body metadata) receive replacement wording.

## Appendix E — Issue-Disposition Templates

**E-1 Closed as completed before preservation:**
> Closing as completed prior to the v1 preservation endpoint. Work: {summary + commits}. Canonical finding(s): {FDI-IDs}. Recorded in the transition plan §22.2.

**E-2 Closed as superseded:**
> Closing as superseded. The direction this issue tracked ({summary}) is superseded per the v1 endpoint decision and {evidence doc}. The underlying question(s) {are/are not} retained as research questions (plan §24). Findings: {FDI-IDs} — dispositions unchanged by this closure. Archival consequence: {one line}.

**E-3 Closed as intentionally not pursued:**
> Closing as intentionally not pursued. Dillweed v1 reached its preservation endpoint ({plan link}); the deployment/work this issue gates will not occur from this baseline. The requirements recorded here are preserved as the historical record of why: {list}. Related findings remain OPEN by design: {FDI-IDs} (plan §19).

**E-4 Retained open as archival limitation:**
> Retained open deliberately: this issue documents a limitation of the preserved baseline that closure would obscure. Status: {disposition}. See plan §19; finding {FDI-ID}. No implementation is planned.

**E-5 Converted to research question:**
> Converting to a research question. The implementation this issue proposed is not pursued (v1 endpoint), but the underlying question — {question} — is retained in {research doc} and plan §24. Any future work requires the plan's reactivation conditions.

**E-6 Transferred to a future research venue:**
> Transferring: this topic continues, if at all, under a separate charter/lineage per plan §24. Reference preserved here; the v1 baseline is unaffected.

---

*End of plan. Prepared 2026-07-02 against commit `7eab9b5`. This document participates in its own §5.2 definition: it is documentation-only and alters no intended v1 runtime behavior.*
