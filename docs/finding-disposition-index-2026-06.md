# Finding Disposition and Evidence Index

**Status:** Authoritative finding-disposition index for the Dillweed Namespace Project. Supersedes the per-document finding statuses in every review published before this date; those documents remain valid as historical evidence of what was found at their stated baselines.
**Date:** 2026-06-12
**Repository baseline:** `main` @ `c999fdd8c1252a817054e03631448a737839081e` (2026-06-12)
**Component versions at baseline:** Registry 0.2.8 (post-W0 working code, spec v0.1.6) · DillClaw Resolver 0.1.8 (post-W0, spec v0.1.8) · Anthill 0.1.6 (spec v0.1.3) · MCP server 1.0.0
**Reviewer role:** Independent systems architect / security engineer / standards reviewer / configuration auditor / evidence-traceability analyst
**Mode:** review-and-index. The only repository artifact created is this document.

---

## 1. Method

1. **Inventory.** Every finding-bearing document was read: repo `README.md`, `PROJECT_LEDGER.md` (3,330 lines), `v2-tracker.md`, all eight specs in `specs/`, all 24 documents in `docs/` including the three architecture reviews, the cross-service trust-boundary analysis, four gap reports, six spec-consistency rounds, two comparative analyses, the v2 design, the documentation-set review (2026-06-11), the strategic evaluation (2026-06-12), the operations runbook, the v1.0.0 release notes, and all four GitHub issues.
2. **Normalization.** Overlapping findings (the same defect raised in an architecture review, the trust-boundary analysis, a gap report, and/or the ledger) were merged into one canonical entry, preserving every original source ID.
3. **Independent verification.** Every finding originally rated CRITICAL, HIGH, P0, P1, or "blocks deployment/evaluation" was checked against the current code, specs, tests, and git history at `c999fdd` — by reading `registry/server.js`, `resolver/server.js`, `anthill/server.js`, `mcp-server/server.js`, the test scripts, the spec HTML, `.gitignore`/`git check-ignore`, `git status`, the working tree (including `resolver/traces/` and `registry/keys/`), specific commits (`74cad67`, `25670a4`, `a1a95d1`, `4447c00`, `d25bf7b`, `e523652`, `d1466c0`, `8c87a85`, `3d6b159`, `b7fab11`), and the GitHub release assets and issue states via `gh`.
4. **What was *not* done.** Test suites were **not executed** in this session; test evidence below distinguishes "test exists in the tree" (verified by inspection) from "N/N passing" (a claim from `v2-tracker.md`/ledger, attributed as such). The live deployment on dill-p-001, the published dillweed.com site, and the contents of the release tarballs were not independently inspected (asset names/sizes were, via the GitHub API).
5. A prior report is treated as evidence a finding was *raised*, not that it is still open; a closed issue or ledger entry is treated as a *claim* of closure, verified independently before any finding here is marked CLOSED.

## 2. Controlled disposition vocabulary

| Disposition | Meaning |
|---|---|
| **OPEN** | No adequate mitigation has landed. |
| **PARTIALLY CLOSED** | Meaningful mitigation exists; the root risk remains. |
| **CLOSED** | Root issue resolved in code, spec, tests, and documentation as applicable to the finding's nature. |
| **ACCEPTED FOR V1** | Intentionally retained, disclosed reference-implementation limitation; no v2 wave assignment required for v1 validity. |
| **DEFERRED TO V2** | Unresolved and explicitly assigned to a v2 wave (W1–W4) or the v2 design. Functionally open today. |
| **SUPERSEDED** | Replaced by a more precise canonical finding. |
| **NOT A DEFECT** | Original finding was incorrect or out of declared scope. |
| **UNVERIFIED** | Evidence insufficient to determine current status. |

Impact vocabulary per profile: `BLOCKS` / `MATERIAL RISK` / `LIMITATION` / `NO CURRENT IMPACT` / `NOT APPLICABLE`. Profiles: **A** local reference stack · **B** public read-only Resolver · **C** independent mirror / institutional evaluation node · **D** multi-organization production.

A note on ID collision: the ledger's **F-003** (2026-05-24, a dillweed.com `.htaccess` redirect, CLOSED) is unrelated to the trust-boundary analysis's **F-3** (Anthill signature verification, the open CRITICAL). This index uses only `FDI-*` identifiers to avoid that class of collision.

---

## 3. Executive summary

**70 canonical findings** were normalized from roughly 230 raw findings across 14 finding-bearing documents, 4 GitHub issues, and the ledger. At `c999fdd`: **5 CLOSED, 6 PARTIALLY CLOSED, 30 OPEN, 22 DEFERRED TO V2, 4 ACCEPTED FOR V1, 1 SUPERSEDED, 1 NOT A DEFECT, 1 UNVERIFIED.**

The headline facts an evaluator needs:

1. **The single CRITICAL is real and unchanged.** Anthill stores but never verifies `node_signature`; `originating_node` is a free-form string; the field is not even required (`anthill/server.js:397–399, 595` — type-check only; absent from the required-field list at `:332–381`). Every Anthill-derived governance signal is forgeable (FDI-ANT-001). The README now discloses this (commit `b7fab11`, 2026-06-12).
2. **W0 genuinely closed its targets — verified in code, not just claimed.** SSRF hardening (off-by-default probe, internal-range deny-list, host pinning — `resolver/server.js:899–959`), SQL-level pagination + ETag/304 on Registry `/list`, per-IP rate limiting with 429 on all three services, refresh jitter/backoff, tag index, and resolver pagination-to-completion are all present in current code with tests in the tree.
3. **W0 also created the project's newest divergence:** DillClaw spec v0.1.8 says the resolver "SHOULD send If-None-Match"; `resolver/server.js` contains **zero** ETag/304 logic (verified by grep). The Registry's W0 ETag support has no consumer, so W0's headline polling-cost reduction is unrealized (FDI-DOC-008 / FDI-RES-001).
4. **The trust-integrity cluster is fully open:** unsigned `registration_date` feeding 30 % of the trust score (verified: `canonicalJSON` signs exactly 10 fields, `registry/server.js:161–167`; `usageScore` reads the unsigned field, `resolver/server.js:818`), self-assigned tiers scored at face value, shared-token write authority with fail-open defaults (`isAuthorized` returns `true` when no token, `registry/server.js:463–467`; binds `0.0.0.0`; CORS `*` on all three services).
5. **A mirror cannot be deployed.** Mirror mode remains an env-var echo (`registry/server.js:598–614`); no synchronization protocol exists in spec or code; the Registry spec still publishes the demonstrated-false claim that mirror freshness fields work "without trusting the mirror itself."
6. **Documentation candor is high and improving, but the review corpus still carries no disposition annotations** — an evaluator reading `docs/` alone would believe F-8 (SSRF) is open (it is closed) and could miss that F-3 is not. This index is the remediation for that gap; per-document banners remain to be added.

---

## 4. Current gates

Findings that genuinely gate each step. "Blocks" means the step should not proceed; "complicates" means it can proceed with the issue disclosed.

### Formal external evaluation (Profile A)
- **Blocks:** nothing. The local stack runs, tests exist, the trust chain is exercisable end-to-end (`integration-test.sh`, 19 checks).
- **Complicates:** FDI-DOC-001 (no disposition banners on stale reviews — mitigated by this index), FDI-DOC-005 (cited steward reports `steward-report-2026-06-10-r3` and `reports/steward-report-2026-06-11.md` absent from the repo — the audit chain for three W0-era commits cannot be independently read), FDI-DOC-003/004 (stale test counts, series-total arithmetic), FDI-RESR-002 (README's "external review" wording — the reviews were AI-assisted, as the ledger itself states in AI-008).

### Public read-only Resolver (Profile B)
- **Blocks (Issue #2's own gate, all verified still unmet):** FDI-OPS-001 (no TLS for cross-network links), FDI-OPS-002 (no `docs/threat-model.md`; the trust-boundary analysis partially substitutes), FDI-XST-004 (wildcard CORS + fail-open token defaults on a `0.0.0.0` bind), FDI-RES-004 (unbounded synchronous trace writes — a disk-fill DoS on a public node), FDI-ID-002 (no caller identity; rate limiting alone is the only abuse control).
- **Closed since the reviews:** rate limiting (FDI-XST-001, the second Issue-#2 item) and SSRF (FDI-RES-002) — the two worst single items.

### Public authoritative Registry
- **Blocks:** FDI-ID-001 (no registrant identity; fail-open writes; one god-token), FDI-CRY-003 (root key inside the public HTTP process), FDI-CRY-001/FDI-ID-004 (forgeable trust inputs), FDI-XST-004. Not gated by any project document yet because the project does not propose this deployment — correctly.

### Registry mirror (Profile C)
- **Blocks:** FDI-REG-002 (no sync protocol exists — spec or code; the mirror gap report's "no happy path at all" verdict remains accurate), FDI-XST-003 (response-body serialization unpinned, so `authoritative_signature_hash` is unimplementable), FDI-DOC-007 (spec §2.2's false tamper-evidence claim would mislead a mirror operator).

### Multi-organization production (Profile D)
- **Blocks:** FDI-ANT-001/002/003, FDI-ID-001/002/003/004, FDI-CRY-001/002/003/004, FDI-REG-001/002, FDI-XST-002. This is the v2 design's own premise; the verdict matches the project's.

### Production-grade claims
- **Blocks:** all Profile-D blockers, plus FDI-RES-003 (the published determinism MUST is not achievable as specified) and FDI-XST-007 (no spec↔implementation version mapping). The project largely does not make production-grade claims; see §15 for the four phrases that overreach.

---

## 5. Summary dashboards

### By disposition
| Disposition | Count |
|---|---|
| OPEN | 30 |
| DEFERRED TO V2 | 22 |
| PARTIALLY CLOSED | 6 |
| CLOSED | 5 |
| ACCEPTED FOR V1 | 4 |
| SUPERSEDED | 1 |
| NOT A DEFECT | 1 |
| UNVERIFIED | 1 |
| **Total** | **70** |

### By component
| Component | Findings | Open or deferred (excl. partially closed) |
|---|---|---|
| Registry | 4 (FDI-REG) | 2 |
| Resolver | 9 (FDI-RES) | 5 |
| Anthill | 11 (FDI-ANT) | 10 |
| Crypto / key management | 6 (FDI-CRY) | 6 |
| Identity / delegation | 5 (FDI-ID) | 5 |
| Cross-stack | 7 (FDI-XST) | 6 |
| Operations / deployment | 10 (FDI-OPS) | 3 |
| Documentation / drift | 12 (FDI-DOC) | 10 |
| Governance | 3 (FDI-GOV) | 3 |
| Research readiness | 3 (FDI-RESR) | 2 |

### By original severity (highest label any source applied)
| Original severity | Count | Still open/deferred |
|---|---|---|
| CRITICAL | 1 | 1 |
| P0 / HIGH | 18 | 13 |
| P1 / MEDIUM | 26 | 21 |
| P2 / LOW / INFO | 25 | 17 |

### Movement since the 2026-06-10 review corpus
- **Closed by W0 + follow-ups (verified):** SSRF (`F-8`/Res-S3), `/list` truncation (`F-10`), Registry `/list` full-scan + no-conditional-fetch *server side* (Reg-S3, partial), rate limiting (Reg-S4/Res-S2-half/Anth-S8, partial — Anthill spec undocumented), refresh herd behavior (Res-S1, partial).
- **Closed by documentation fixes:** README unscoped "no HIGH/MEDIUM open" claim (`b7fab11`, 2026-06-12).
- **Closed and discovered closed by this review:** semantic calendar-date validation (ledger AI-003 still says OPEN; the code implements it — `registry/server.js:434–451`).
- **New findings raised post-corpus (doc-set review 2026-06-11, strategic evaluation 2026-06-12, and this review):** resolver ETag client gap, Anthill-spec rate-limit silence, W0 definition drift, anthill/README self-describing as v0.1.4, Anthill release-asset size anomaly, delegation/counter-signature absent from any v2 wave, continuity instruments unexecuted.
- **Reopened:** none. **Insufficient evidence:** 1 (FDI-OPS-010).

---

## 6. Canonical finding index (compact)

Severity = original label(s). Disposition and Target are current. Full evidence in §7.
Blocks column: **E**=evaluation, **B**=public resolver, **C**=mirror, **D**=multi-org, **—**=none.

| ID | Title | Component | Sources | Severity | Disposition | Target | Blocks |
|---|---|---|---|---|---|---|---|
| FDI-REG-001 | Single authoritative instance, no replication/HA | Registry | arch-reg S1 | P0 | DEFERRED TO V2 | W3 | C, D |
| FDI-REG-002 | Mirror mode specified, not implemented; no sync protocol | Registry | arch-reg S2; mirror-gap G-1…G-24; spec-gap REG-21, XC-01 | P0 / 7×HIGH | DEFERRED TO V2 | W3 | C, D |
| FDI-REG-003 | `/list` full-scan, JS pagination, no conditional fetch (server side) | Registry | arch-reg S3; F-10 | P0 | PARTIALLY CLOSED | W0→W3 | — |
| FDI-REG-004 | Semantic (calendar) date validation absent | Registry | ledger AI-003 | LOW (enhancement) | CLOSED | v1 | — |
| FDI-RES-001 | Full-catalog 60s polling; no client conditional fetch; herd | Resolver | arch-res S1; v2 Area 2 | P0 | PARTIALLY CLOSED | W0→W3 | D |
| FDI-RES-002 | `probe_liveness` SSRF / amplification proxy | Resolver | arch-res S3; F-8 | P0 / MED | CLOSED | W0 | — |
| FDI-RES-003 | Determinism guarantee not achievable as specified | Resolver (spec) | arch-res S4; dillclaw-gap G-20; spec-gap RES-12/13; doc-set C10 | P1 | OPEN | v2 x-cutting | claim |
| FDI-RES-004 | Synchronous, unbounded trace writes; no 72h retention | Resolver | arch-res S5; design-W0 | P1 | OPEN | (design-W0, dropped) | B |
| FDI-RES-005 | Single-process sync I/O; local-mode re-read; linear match | Resolver | arch-res S6; doc-set C12 | P1 | ACCEPTED FOR V1 | W3 | D |
| FDI-RES-006 | lookup-on-miss: no coalescing or concurrency cap | Resolver | arch-res S7 | P2 | OPEN | none | — |
| FDI-RES-007 | Static DNSO key file; no rotation/reload path | Resolver | arch-res S8 | P2 | DEFERRED TO V2 | W1–W2 | D |
| FDI-RES-008 | Stale-window revocation freeze by on-path adversary | Resolver | F-7 | MEDIUM | DEFERRED TO V2 | W3 | claim |
| FDI-RES-009 | `/list` 500-record truncation of resolver worldview | Resolver | F-10; steward r3 H-3 | LOW/MED | CLOSED | W0 | — |
| FDI-ANT-001 | `node_signature` never verified — signals unauthenticated | Anthill | F-3; arch-ant S1; AUDIT-AS-001/AI-005; emitter GAP-03 | **CRITICAL** / P0 | DEFERRED TO V2 | W1 | D + any Anthill reliance |
| FDI-ANT-002 | Sequence-counter poisoning suppresses victim signals | Anthill | F-4 | HIGH | DEFERRED TO V2 | W1 | D |
| FDI-ANT-003 | Nonce-replay reflection frames victims (auto ANT-RA) | Anthill | F-5; arch-ant S5 | MEDIUM / P1 | DEFERRED TO V2 | W1 | D |
| FDI-ANT-004 | Self-graded severity/class; no Registry corroboration | Anthill | arch-ant S4 | P1 | DEFERRED TO V2 | W4 | D |
| FDI-ANT-005 | Single-writer SQLite; global invariants unshardable; no HA | Anthill | arch-ant S3 | P0 | DEFERRED TO V2 | W3 | D |
| FDI-ANT-006 | Synchronous JSONL append; unbounded log; manual reconcile | Anthill | arch-ant S6 (durability half) | P1 | OPEN | (design-W0, dropped) | B(n/a), D |
| FDI-ANT-007 | No retention/rollups; full-table scans on hot paths | Anthill | arch-ant S7 | P1 | OPEN | none assigned | D |
| FDI-ANT-008 | Brittle strict-monotonic sequences; unbounded node-ID space | Anthill | arch-ant S9 | P2 | DEFERRED TO V2 | W1 | D |
| FDI-ANT-009 | Detection/escalation/correlation engine absent | Anthill | arch-ant A2/A3 | v1-acceptable | DEFERRED TO V2 | W4 | claim |
| FDI-ANT-010 | Wire protocol unspecified (endpoints, schemas, nonce, serialization) | Anthill (spec) | emitter GAP-01/02; spec-gap ANT-01…08 | 3 blockers | OPEN | W4 (mis-sequenced) | C, D, 2nd impl |
| FDI-ANT-011 | `received_at`/`signal_timestamp` manipulable (clock trust) | Anthill | F-11; spec §8/A.4 | LOW | ACCEPTED FOR V1 | W3 (RFC 3161) | — |
| FDI-CRY-001 | `registration_date` outside signed field set → score forgeable | Crypto | F-1; arch-reg S6; consistency r1 HIGH | HIGH / P1 | DEFERRED TO V2 | W2 | D, claim |
| FDI-CRY-002 | Canonicalization not portable (top-level-only, JS-stringify) | Crypto | AI-007; spec-gap REG-01/02/05; arch-reg A2 | blocker (2nd impl) | DEFERRED TO V2 | W2 (JCS; owner unassigned) | C, D |
| FDI-CRY-003 | Root signing key inside network-facing process | Crypto | arch-reg S5; Issue #4 | P1 | DEFERRED TO V2 | W1 | B(authoritative), D |
| FDI-CRY-004 | No key hierarchy, delegation, or counter-signature | Crypto | Issue #4; strategic-eval §4; reg-vs-infra | structural | DEFERRED TO V2 | W1–W2 (delegation unassigned) | D |
| FDI-CRY-005 | Key rotation never exercised end-to-end | Crypto | Issue #4; AI-008-B | — | OPEN | v2 | D |
| FDI-CRY-006 | Trust-root distribution: single HTTPS source; installer SHA check non-enforcing | Crypto | dillclaw-gap G-3; README trust model | HIGH (gap report) | OPEN | none | C |
| FDI-ID-001 | No registrant identity; shared god-token; fail-open writes; spoofable `caller` | Identity | arch-reg S7; F-6 | P1 / HIGH-cond | DEFERRED TO V2 | W1–W2 | D (+B if writable) |
| FDI-ID-002 | No caller identity/auth on Resolver | Identity | arch-res S2 (auth half) | P0 | DEFERRED TO V2 | W1 | B, D |
| FDI-ID-003 | No per-node credential for Anthill submitters | Identity | arch-ant S2 | P0 | DEFERRED TO V2 | W1 | D |
| FDI-ID-004 | Self-assigned `verified`/`canonical` tier scored at face value | Identity | F-2; arch-reg S8; consistency r2-H-2 | HIGH / P2 | DEFERRED TO V2 | W2 | D, claim |
| FDI-ID-005 | Steward-agent boundary enforcement non-cryptographic | Identity | Issue #4 | — | DEFERRED TO V2 | v2 | — |
| FDI-XST-001 | No rate limiting on any service | Cross-stack | arch-reg S4; arch-res S2 (half); arch-ant S8; Issue #2 | P0/P1 | PARTIALLY CLOSED | W0→W4 | — |
| FDI-XST-002 | Logs append-only by convention; no tamper evidence | Cross-stack | arch-reg S9; arch-ant S6 (half) | P2/P1 | DEFERRED TO V2 | W3 | D, claim |
| FDI-XST-003 | Specs insufficient for an independent second implementation | Cross-stack (spec) | spec-gap (88 gaps, 9 blockers) | 9 blockers | OPEN | v2 partial map | C, D, 2nd impl |
| FDI-XST-004 | Wildcard CORS + fail-open tokens + 0.0.0.0 binds | Cross-stack | F-9; F-6 (defaults half); design-W0 | MEDIUM | OPEN | (design-W0, dropped) | B |
| FDI-XST-005 | MCP server passes results through without independent verification | Cross-stack | Issue #4 | — | DEFERRED TO V2 | v2 | — |
| FDI-XST-006 | W1 verifies signatures over a serialization specified in W4 | Cross-stack (plan) | doc-set §6/D1 | HIGH (plan defect) | OPEN | pre-W1 decision | D (via W1) |
| FDI-XST-007 | No spec↔implementation version mapping; W0 changed behavior at unchanged impl version | Cross-stack | spec-gap XC-03; gaps G-15/G-19; doc-set C11 | MEDIUM | OPEN | v2 x-cutting | claim |
| FDI-OPS-001 | No TLS for cross-network inter-component links | Ops | Issue #2; arch A1 rows | gate | OPEN | Issue #2 | B |
| FDI-OPS-002 | No threat-model document (`docs/threat-model.md`) | Ops | Issue #2 | gate | OPEN | Issue #2 | B |
| FDI-OPS-003 | Repo hygiene: dev key in tree, 1,373 unignored trace files, untracked lockfile | Ops | doc-set §3.4; strategic-eval §4 | HIGH (credibility) | PARTIALLY CLOSED | now | E (credibility) |
| FDI-OPS-004 | macOS-only installers; no CI; no Linux path | Ops | dillclaw-gap G-5/G-10; doc-set §7.7 | MEDIUM | ACCEPTED FOR V1 | none | C |
| FDI-OPS-005 | Configuration reference missing (registry URL, TTL knobs) | Ops | dillclaw-gap G-1/G-2 (HIGH); doc-set B5 | HIGH | OPEN | none | C |
| FDI-OPS-006 | Plaintext admin tokens in launchd plists | Ops | INST-011 | INFO | ACCEPTED FOR V1 | multi-operator | — |
| FDI-OPS-007 | Tarball name vs extract-dir name inconsistency | Ops | INST-008 | LOW | PARTIALLY CLOSED | future release | — |
| FDI-OPS-008 | Install-test finding series INST-001…014 | Ops | ledger INST entries | HIGH…LOW | CLOSED | v1.0.0 | — |
| FDI-OPS-009 | Claim: dev private key not covered by `.gitignore` | Ops | doc-set §3.4 | HIGH (as raised) | NOT A DEFECT | — | — |
| FDI-OPS-010 | Anthill v0.1.6 release asset ~9.9 MB vs ~51 KB peers | Ops | STEWARD-SWEEP-2026-06-11 | LOW | UNVERIFIED | audit recommended | — |
| FDI-DOC-001 | Review corpus carries no post-W0 disposition layer | Docs | doc-set A1/#1 | HIGH | OPEN (this index = partial remedy) | now | E |
| FDI-DOC-002 | README unscoped "No HIGH/MEDIUM issues open" | Docs | doc-set C5; strategic-eval §4 | HIGH | CLOSED | done | — |
| FDI-DOC-003 | README test counts pinned to v1.0.0, read as current | Docs | doc-set C6 | MEDIUM | OPEN | now | — |
| FDI-DOC-004 | Series-total arithmetic error ("4 HIGH, 19 MEDIUM") | Docs | doc-set C7/#8 | LOW | OPEN | now | — |
| FDI-DOC-005 | Dangling evidence pointers to absent steward reports | Docs | doc-set §7.2 | MEDIUM | OPEN | now | E |
| FDI-DOC-006 | Anthill spec silent on implemented rate limiting | Docs/spec | doc-set C2/#3 | MEDIUM | OPEN | round-7 | — |
| FDI-DOC-007 | Registry spec §2.2 mirror tamper-evidence overclaim | Docs/spec | mirror-gap G-11; doc-set C3 | MEDIUM-HIGH | OPEN | W3 (caveat now) | C, claim |
| FDI-DOC-008 | DillClaw v0.1.8 documents client conditional fetch that does not exist | Docs/spec | doc-set C1/#2 | HIGH | OPEN | round-7 + code | — |
| FDI-DOC-009 | Evaluation gated on external issue links without in-repo summary | Docs | dillclaw-gap G-27; doc-set A6 | MEDIUM | OPEN | now | — |
| FDI-DOC-010 | Ledger/tracker status drift (AI-003 "OPEN" though shipped; tracker "not pushed" though merged) | Docs | this review | LOW | OPEN | now | — |
| FDI-DOC-011 | `anthill/README.md` self-describes as v0.1.4 (impl is 0.1.6) | Docs | this review | LOW | OPEN | now | — |
| FDI-DOC-012 | Phantom provisional-tier "weighting penalty" asserted in specs | Docs/spec | consistency r2-H-2, r4, r5 | HIGH (as raised) | SUPERSEDED (→ FDI-ID-004) | done | — |
| FDI-GOV-001 | Single-steward, single-key construction contradicts neutrality thesis | Governance | strategic-eval; reg-vs-infra | structural | OPEN | institutional | D, claim |
| FDI-GOV-002 | Continuity instruments unexecuted (CDI, sealed materials) | Governance | GSP-01 §11; strategic-eval §6/§10 | — | OPEN | month-1 plan | C (institutional trust) |
| FDI-GOV-003 | Governance corpus institutionalizes bodies that do not exist | Governance | strategic-eval §4/§9 | — | OPEN | narrowing decision | — |
| FDI-RESR-001 | Zero external validation (no third-party impl, deployment, registration, or human specialist review) | Research | strategic-eval §8 | — | OPEN | 6-month plan | partnership asks |
| FDI-RESR-002 | Review corpus is AI-authored; "external review" wording overstates independence | Research | strategic-eval §8; ledger AI-008 | — | PARTIALLY CLOSED | now (wording) | E (credibility) |
| FDI-RESR-003 | Specialist cryptographic review (AI-008 Q A–D) not commissioned | Research | ledger AI-008 | — | OPEN | months 2–4 plan | partnership asks |

---

## 7. Detailed finding records

All entries: **Last verified 2026-06-12 @ `c999fdd`** unless noted. "Sources" cite the exact documents; severities are the originals.

### Registry

#### FDI-REG-001 — Single authoritative instance; no replication or HA
- **Sources:** `architecture-review-registry-2026-06-10.md` S1 (P0).
- **Root cause:** One Node process over one embedded `better-sqlite3` file is the namespace's sole writer and source of truth.
- **Verification:** `registry/server.js` still opens a single local SQLite DB; no replication code exists anywhere in the tree.
- **Mitigation landed:** none (W0 was explicitly no-protocol-change).
- **Disposition: DEFERRED TO V2 (W3).**
- **Impact:** A: NO CURRENT IMPACT · B: MATERIAL RISK (freshness SPOF) · C/D: BLOCKS.
- **Residual risk:** total loss/outage of one host stops all writes and, after stale windows lapse, all resolution. Architectural.
- **Closure criteria:** a documented and implemented availability model — either hardened-single-instance with tested backup/restore/failover runbook, or replication — plus a recovery test on a second host.
- **Target:** W3 (v2 design Area 2.2.6 documents the single-hardened-instance posture as interim).

#### FDI-REG-002 — Mirror mode specified but not implemented; no synchronization protocol exists
- **Sources:** arch-reg S2 (P0); `registry-mirror-deployment-gap-report-2026-06-10.md` G-1…G-24 (7 HIGH), verdict "no happy path at all"; spec-gap REG-21/XC-01.
- **Root cause:** The spec names a mirror deployment mode and imposes conformance obligations on it but defines no sync mechanism; the implementation's mirror mode only rejects writes and echoes two operator-set env vars into `/health`.
- **Verification:** `registry/server.js:598–614` — `AUTHORITATIVE_SNAPSHOT_TIMESTAMP`/`AUTHORITATIVE_SIGNATURE_HASH` are env-var pass-throughs; no code computes or verifies the hash; no import path exists (and `POST /register` re-signs, so authoritative records cannot be imported verbatim — mirror-gap G-7 reasoning confirmed against the signing path).
- **Disposition: DEFERRED TO V2 (W3).**
- **Impact:** A: NO CURRENT IMPACT · B: LIMITATION · C: **BLOCKS** · D: BLOCKS.
- **Residual risk:** the spec's only availability answer to FDI-REG-001 does not exist; recruiting any independent mirror operator (the strategic evaluation's highest-leverage external act) is impossible until this is specified.
- **Closure criteria:** a normative sync protocol (snapshot + delta or equivalent), an import path preserving authoritative signatures, mirror-computed freshness replaced by registry-signed checkpoints, a conformance bound on sync staleness, and a demonstrated third-party-operable mirror with tests.
- **Target:** W3 (v2 Area 2.2: delta-by-cursor, signed checkpoints, import path).

#### FDI-REG-003 — `/list` hot path: full-table scan, JS-slice pagination, no conditional fetch (server side)
- **Sources:** arch-reg S3 (P0); trust-boundary F-10 (server half).
- **Mitigation landed (W0, all verified in code):** SQL `LIMIT ? OFFSET ?` with deterministic `ORDER BY name, version` and separate COUNT (`registry/server.js:114–118`, commit `25670a4`); strong `ETag` + `Last-Modified` + 304 with RFC 7232 weak-comparison handling, catalog version seeded from the registration log so ETags survive restarts (`:143–146, 501–545`, commit `74cad67`); normalized `capability_tags` table + index replacing the `LIKE` scan, with startup backfill migration (`:77–92`, commit `e523652`). Test evidence: ETag (6), pagination (6), tag-filter (3) tests present in `registry/test.sh` (verified by inspection); tracker claims 98/98 passing on an isolated instance — not re-executed this session. Spec evidence: Registry spec bumped to v0.1.6 documenting ETag/rate-limiting/pagination (commit `3d6b159`).
- **Disposition: PARTIALLY CLOSED.**
- **Residual (why not CLOSED):** no delta feed (every refresh that *does* change still transfers the full catalog); the ETag mechanism has **zero consumers** because the reference Resolver never sends `If-None-Match` (see FDI-RES-001/FDI-DOC-008) — the W0 headline benefit is latent, not realized.
- **Impact:** A: NO CURRENT IMPACT · B: LIMITATION · C/D: MATERIAL RISK at fleet scale.
- **Closure criteria:** resolver-side conditional fetch consuming the ETag (small client change) and, for fleet scale, the W3 delta feed.
- **Target:** W0 (done, server side) → W3 (delta).

#### FDI-REG-004 — Semantic calendar-date validation (ledger AI-003) — CLOSED
- **Sources:** ledger AI-003 (raised 2026-05-15, marked "OPEN, deferred enhancement" in the ledger **to this day** — see FDI-DOC-010).
- **Verification:** `registry/server.js:414–430` validates `registration_date` with calendar-valid component checks; `:434–451` validates `last_updated` via `isValidRfc3339UtcSecondPrecision` with an in-code note that this was "Tightened post-review-3 (deferral reconsidered)". The ledger's "Round-3 deferral reconsideration — Item 1 reversed" entry (2026-05-16) records the decision. The architecture review independently praises the "strict semver/RFC-3339/calendar checks."
- **Disposition: CLOSED** (code + the consistency series' verification rounds). The remaining defect is the stale ledger header, tracked as FDI-DOC-010.

### Resolver

#### FDI-RES-001 — Full-catalog polling every 60 s; no client-side conditional fetch; thundering herd
- **Sources:** arch-res S1 (P0); v2 design Area 2.
- **Mitigation landed (verified):** jitter ±20 % + exponential backoff capped at 15 min via self-scheduling `refreshDelay()` (`resolver/server.js:48–49, 183–187, 304–305`, commit `d25bf7b`), with `/health` exposure of refresh state; pagination-to-completion with mid-pagination dedupe (`:241–267`, commit `d1466c0`). Unit-test evidence: 12 `refreshDelay` assertions in `resolver/unit-tests.js` (in tree); tracker claims 77/77.
- **Disposition: PARTIALLY CLOSED.**
- **Residual (why not CLOSED):** the resolver sends **no** `If-None-Match`/`If-Modified-Since` and has no 304 handling — grep of `resolver/server.js` for `etag|if-none-match|if-modified|304` returns nothing — despite DillClaw spec v0.1.8 §7.1 stating the resolver "SHOULD send If-None-Match" (verified in `specs/dillclaw-spec.html`). Every refresh still transfers the full catalog. No delta feed (W3).
- **Impact:** A: NO CURRENT IMPACT · B: LIMITATION · C: LIMITATION · D: MATERIAL RISK (bandwidth/CPU scale with records × resolvers).
- **Closure criteria:** client conditional fetch implemented + a test demonstrating a 304 cycle; herd-revalidation test; delta feed for full closure at scale.
- **Target:** the conditional-fetch half was implicitly W0 (the spec's revision note claims it; the code lacks it); delta is W3.

#### FDI-RES-002 — `probe_liveness` SSRF / amplification — CLOSED
- **Sources:** arch-res S3 (P0); trust-boundary F-8 (MEDIUM).
- **Mitigation (all verified in code):** probing is **off by default** (`DILLCLAW_PROBE_LIVENESS_ENABLED`, `resolver/server.js:67, 936`) *and* still requires the caller's per-request flag; `isInternalIp()` deny-list covering loopback, 169.254/16, RFC-1918, CGNAT, 0/8, multicast, reserved, IPv6 ::1/::/fe80::/10/fc00::/7/ff00::/8 and v4-mapped, fail-closed on unparseable (`:899–933`); DNS resolution with refusal if **any** resolved address is internal, then host-pinned probe of the validated IP (Host header + SNI) to defeat rebinding (`:959`); probe-cache TTL guard so probes are not repeated within 60 s (`:942`, commit `8c87a85`, fixing steward-r3 M-1 against the DillClaw §7 MUST). `/health` exposes `probe_liveness.enabled`.
- **Test evidence:** 35 classifier assertions in `resolver/unit-tests.js` (in tree); 2 integration assertions in `resolver/test.sh`; tracker records an end-to-end negative test (169.254.169.254 endpoint → "[probe] refused", no outbound request) and a deterministic A/B DNS-lookup-count harness for the cache guard. These tests prove classification, default-off, and no-reprobe behavior; they do **not** prove behavior behind every proxy/redirect topology (HEAD probes don't follow redirects in this implementation — not re-verified line-by-line).
- **Spec evidence:** DillClaw v0.1.8 documents probe hardening and off-by-default (commit `3d6b159`).
- **Why CLOSED:** code + tests + spec all updated; the original attack (resolver as unauthenticated internal-network probe) no longer works in default or enabled configurations against internal ranges. The *remaining* concern — probes against arbitrary external hosts by unauthenticated callers when an operator opts in — is an authentication/quota issue tracked under FDI-ID-002 (W1), and was scoped out of W0 explicitly.
- **Commits:** `4447c00`, `8c87a85`.

#### FDI-RES-003 — Cross-resolver determinism not achievable as specified
- **Sources:** arch-res S4 (P1); dillclaw-gap G-20; spec-gap RES-12/13; doc-set C10.
- **Verification:** DillClaw spec (current v0.1.8) still contains the unscoped MUST: "Given the same query and registry state, a conformant resolver MUST return the same ranked result." `usageScore` uses `Date.now()` (`resolver/server.js:818`); `livenessScore` reads per-process cache state; FP arithmetic is unpinned (RES-12).
- **Disposition: OPEN** — this is a **published-spec defect**, not an implementation bug; the v2 design's cross-cutting section commits to scoping the guarantee but no caveat has been applied to the live spec.
- **Impact:** A: LIMITATION (single-node use unaffected) · B/C: MATERIAL RISK for any consumer comparing scores across nodes · D: MATERIAL RISK · "deterministic resolution" claim: BLOCKS.
- **Closure criteria:** spec §3.3 caveated to "single resolver, single evaluation instant, within a pinned scoring profile, liveness excluded," plus pinned arithmetic (or removal of time/liveness from the deterministic core) and a cross-instance test vector.
- **Target:** v2 cross-cutting (no wave); the doc-set review's B3 recommends applying the caveat now.

#### FDI-RES-004 — Trace persistence: synchronous, unbounded, retention unenforced
- **Sources:** arch-res S5 (P1); v2 design W0 row ("async/bounded/rotated sinks + retention").
- **Verification:** `fs.writeFileSync` per resolution at `resolver/server.js:1245`, failures swallowed; **1,373** trace files in `resolver/traces/` (counted; all dated 2026-06-10); no rotation/cap/cleanup code; the spec's 72-hour retention SHOULD is unimplemented. This item was in the v2 *design's* W0 but **not** in the tracker's executed W0 task list (see §12, scope drift C4).
- **Disposition: OPEN.** Impact: A: NO CURRENT IMPACT (cosmetic disk growth) · B: **BLOCKS** (disk-fill DoS + event-loop blocking on a public node) · C: MATERIAL RISK · D: MATERIAL RISK.
- **Closure criteria:** async bounded sink, rotation, enforced 72 h retention, failure surfacing (a full disk must not silently break the §3.3 auditability MUST), and a test that retention actually deletes.
- **Target:** was design-W0; needs re-scoping (doc-set C2 recommendation).

#### FDI-RES-005 — Single-process synchronous I/O; local-mode re-read per call; linear candidate scan
- **Sources:** arch-res S6 (P1); doc-set C12 (the "`byName` index unused by resolveQuery" sub-claim — flagged there as not re-verified).
- **Verification this session:** `byName` exists and is used for lookup-on-miss absorption (`resolver/server.js:194, 341–365`); a per-name map is also built during resolution (`:1167–1171`, the per-name version_pref grouping). Whether the initial candidate match is still a full linear filter was **not** re-traced end-to-end; the throughput concern stands regardless of that detail.
- **Disposition: ACCEPTED FOR V1** — single hosted node is the declared v1 posture; horizontal scale is undocumented. Impact: D: MATERIAL RISK; others NO CURRENT IMPACT/LIMITATION.
- **Closure criteria (when it matters):** documented stateless scale-out + shared-cache guidance; local-mode re-read removed from the per-request path.

#### FDI-RES-006 — lookup-on-miss has no in-flight coalescing or concurrency cap
- **Sources:** arch-res S7 (P2). Tracker note (2026-06-10): explicitly excluded from the jitter task, "candidate follow-up."
- **Disposition: OPEN** (no wave assigned). Impact: D: MATERIAL RISK (second herd path); others NO CURRENT IMPACT.
- **Closure criteria:** request coalescing keyed by name + a concurrency cap, with a burst test.

#### FDI-RES-007 — DNSO public key: static local file, no rotation/reload path
- **Sources:** arch-res S8 (P2). **Verification:** key loaded once at startup; no refetch/reload logic in `resolver/server.js`.
- **Disposition: DEFERRED TO V2** (Area 5, W1–W2: TUF-style metadata, expiry). Impact: D: MATERIAL RISK; B/C: LIMITATION.
- **Closure criteria:** fetch-verify-reload path with overlap-window behavior tested across a simulated rotation (pairs with FDI-CRY-005).

#### FDI-RES-008 — On-path adversary freezes revocations for the stale window
- **Sources:** trust-boundary F-7 (MEDIUM).
- **Verification:** stale-while-revalidate design unchanged (`STALE_WINDOW_MS` default 900 s, max 1800 s); `stale: true` remains advisory. Note: W0 jitter slightly **widens** worst-case propagation (integration test wait raised 70 s→90 s, `integration-test.sh:285–288` comment confirms the jittered bound) — a disclosed-in-code trade-off no spec text mentions.
- **Disposition: DEFERRED TO V2** (W3 signed freshness checkpoints / revocation feed). Impact: B/C/D: MATERIAL RISK for security-relevant revocations; "complete revocation guarantees" claim: BLOCKS.
- **Closure criteria:** signed freshness assertion or positive-acknowledgement revocation feed; §7.5 documents the adversarial bound including jitter.

#### FDI-RES-009 — `/list` 500-record cap silently truncated the resolver worldview — CLOSED
- **Sources:** trust-boundary F-10 (LOW/MED); steward-report-2026-06-10-r3 H-3 (report absent from repo — see FDI-DOC-005).
- **Mitigation (verified):** client pages `/list` to completion — limit-500 pages, offset advance, envelope-`total` honoring, name:version dedupe against mid-pagination shifts, legacy bare-array handling, 1M-record sanity bound (`resolver/server.js:241–267`, commit `d1466c0`); server-side SQL pagination (FDI-REG-003).
- **Test evidence:** tracker records an E2E proof against an isolated 117-record registry (bare `/list` returns 100; fixed resolver loads all 117 and resolves a record beyond page 1). Test proves pagination-to-completion; it does not prove behavior under catalog mutation mid-pagination beyond dedupe.
- **Why CLOSED:** code + E2E evidence + spec (DillClaw v0.1.8 documents pagination-to-completion, commit `3d6b159`).

### Anthill

#### FDI-ANT-001 — `node_signature` accepted but never verified: signals are unauthenticated — the open CRITICAL
- **Sources:** trust-boundary **F-3 (CRITICAL)**; arch-ant S1 (P0); ledger AUDIT-AS-001 / AI-005 (2026-05-15); emitter-gap GAP-03; Anthill spec Appendix A.11 ("the largest single deferred work item").
- **Verification at `c999fdd`:** `anthill/server.js:397–399` — `node_signature` is type-checked only when present; it is **absent from the required-field list** (`:332–381`); `:595` stores it verbatim; no verification code path exists. `originating_node` is any non-empty string; only `ANTHILL_AGGREGATOR` is reserved. Spec §4 says the signature MUST cover `signal_nonce` and `node_sequence` — the implementation does not conform to its own spec's MUST; the spec discloses this in A.11.
- **Root cause:** node-key registration was deferred to an Operations Charter section never drafted; verification cannot be implemented against an undefined enrollment and serialization (see FDI-XST-006 for the resulting v2 sequencing defect).
- **Disposition: DEFERRED TO V2 (W1)** — functionally OPEN; the controlled vocabulary assigns it here because AI-005 and v2 Area 1.2.4 explicitly schedule it. Nothing has narrowed it since it was raised.
- **Impact:** A: LIMITATION (single-submitter loopback) · B: NOT APPLICABLE (Anthill not public) · C: MATERIAL RISK · D: **BLOCKS** — and it **blocks any evidentiary or governance use of Anthill data in any profile**: fabrication (F-3), suppression (FDI-ANT-002), and framing (FDI-ANT-003) are all live.
- **Closure criteria (per AI-005, made testable):** node-key enrollment procedure specified (Charter) and implemented (registrations table + revocation); canonical serialization + test vectors published (Anthill spec / GAP-02); `node_signature` mandatory and cryptographically verified against the claimed node's registered key; unknown/revoked/mismatched identities rejected with documented error codes; positive and negative tests; emitter-side signing documented in the DillClaw spec.
- **Residual-risk note:** README (since `b7fab11`) and `research-opportunities-summary.md` both disclose this; the disclosure is current and accurate.

#### FDI-ANT-002 — Sequence-counter poisoning suppresses a victim node's signals
- **Sources:** trust-boundary F-4 (HIGH). **Verification:** `upsertNodeSeq` keys monotonic sequences on the unauthenticated `originating_node` string; an attacker advancing a victim's counter to 2×10⁹ causes all subsequent legitimate signals to be rejected `409 SEQUENCE_VIOLATION`. Derivative of FDI-ANT-001; closes with it.
- **Disposition: DEFERRED TO V2 (W1).** Impact: same as ANT-001 (the suppression inverse of fabrication).
- **Closure criteria:** sequence state partitioned by *authenticated* identity (verified node key), with a test that an unauthenticated party cannot advance another node's counter.

#### FDI-ANT-003 — Nonce-replay reflection frames a victim via auto-generated CRITICAL ANT-RA
- **Sources:** trust-boundary F-5 (MEDIUM); arch-ant S5 (P1). **Verification:** on nonce collision Anthill mints a CRITICAL ANT-RA naming `body.originating_node` — attacker-controlled (`anthill/server.js:464–549`). Per spec §7 this feeds suspension/decertification cadence.
- **Disposition: DEFERRED TO V2 (W1).** Closure: with ANT-001, attribution becomes authentic; interim hardening (name the transport-observed source instead) was recommended in the trust-boundary analysis and has not been applied.

#### FDI-ANT-004 — Signals are self-graded; no corroboration against Registry state
- **Sources:** arch-ant S4 (P1); spec A.7/A.10 (disclosed). **Disposition: DEFERRED TO V2 (W4** — corroboration verifier, Area 3). Impact: D: BLOCKS trustworthy observability; A–C: LIMITATION.
- **Closure criteria:** Registry-as-reference-monitor checks for corroborable claims (e.g., ANT-RC propagation status vs actual registry state) + reporter-incentive design; tests demonstrating a fabricated corroborable claim is flagged.

#### FDI-ANT-005 — Single-writer embedded SQLite; global invariants cannot shard; no HA
- **Sources:** arch-ant S3 (P0). **Verification:** unchanged; nonce-uniqueness and per-node sequence invariants live in one local file; service binds `127.0.0.1` (`anthill/server.js:910`).
- **Disposition: DEFERRED TO V2 (W3** HA posture / datastore decision). Impact: D: BLOCKS; A: NO CURRENT IMPACT.
- **Closure criteria:** either documented hardened-single-endpoint with backup/failover tests, or a datastore supporting the global invariants under replication.

#### FDI-ANT-006 — Durability: synchronous JSONL append on every submission; unbounded; manual reconciliation
- **Sources:** arch-ant S6 (P1, durability half; tamper-evidence half → FDI-XST-002). **Verification:** `appendFileSync` per signal before the DB write; no rotation; documented JSONL/SQLite divergence requiring manual diff (`anthill/README.md:131–135`).
- **Disposition: OPEN** — the async/bounded-sink work was in the v2 design's W0 row and was dropped from the executed W0 (§12).
- **Closure criteria:** non-blocking bounded append path, rotation/archival, automated reconciliation or single-store design; ingestion throughput test.

#### FDI-ANT-007 — No retention or rollups; `/summary`, `/aggregate`, `/health` full-scan per call
- **Sources:** arch-ant S7 (P1). **Disposition: OPEN** (no wave assignment found in the v2 design for Anthill retention specifically). Impact: D: MATERIAL RISK; A: NO CURRENT IMPACT (117 signals at last sweep).
- **Closure criteria:** retention policy + precomputed rollups or query windows; load test at representative volume.

#### FDI-ANT-008 — Strict-monotonic sequence brittleness; unbounded node-identity space
- **Sources:** arch-ant S9 (P2). **Disposition: DEFERRED TO V2 (W1** enrollment defines the canonical node set; tolerant replay window is part of the same redesign).
- **Closure criteria:** enrollment-bounded identity space; documented crash/redeploy sequence-resumption procedure; out-of-order tolerance decision recorded in the spec.

#### FDI-ANT-009 — Detection/escalation/correlation engine absent: a signal store, not an observability plane
- **Sources:** arch-ant A2/A3 (listed v1-acceptable but with the warning "this *is* the product's value").
- **Disposition: DEFERRED TO V2 (W4** OTel re-layer + detection). Impact: claim-level (see §15 — "observability plane" labeling); D: BLOCKS the observability value proposition.
- **Closure criteria:** threshold/escalation engine per spec §5–§7 or formal relabeling of v1 Anthill as a signal store in evaluator-facing text (the cheaper, immediately available closure).

#### FDI-ANT-010 — No wire protocol: a second implementation cannot exchange a single signal
- **Sources:** emitter-gap GAP-01/02 + verdict ("a conformant signal emitter cannot be implemented"); spec-gap ANT-01…ANT-08 (blockers).
- **Verification:** Anthill spec remains v0.1.3, unchanged since the reports; per-class payload schemas, endpoint paths, nonce encoding, and the canonical serialization for `node_signature` remain unspecified.
- **Disposition: OPEN** (Area 3 spec work is W4 — but see FDI-XST-006: the serialization piece is a W1 prerequisite). Impact: C/D and any second implementation: BLOCKS.
- **Closure criteria:** published wire protocol (endpoints, request/response schemas, per-class payload schemas, nonce encoding, canonical serialization + test vectors).

#### FDI-ANT-011 — Timestamps are clock-dependent and manipulable
- **Sources:** trust-boundary F-11 (LOW); spec §8 "Known Limitation" + A.4. **Disposition: ACCEPTED FOR V1** — honestly disclosed; dual-window `/aggregate` is a partial mitigation; RFC 3161 anchoring is W3-adjacent future work. Moot until ANT-001 lands authenticity.

### Cryptography and key management

#### FDI-CRY-001 — `registration_date` excluded from the signed field set; usage-history score forgeable
- **Sources:** trust-boundary F-1 (HIGH); arch-reg S6 (P1); consistency-r1 HIGH ("unsigned registration_date driving 30% of trust score").
- **Verification:** `canonicalJSON` signs exactly ten fields — description, endpoint, input_schema, last_updated, name, output_schema, permissions, protocol, trust_tier, version (`registry/server.js:161–167`); `handleRegister` accepts `body.registration_date || today` (`:858`); `usageScore` derives up to 0.30 of trust score from it (`resolver/server.js:818`). DillClaw §6.2 carries the security note; the suggested resolver-side mitigation (zero the component when unverifiable) is not implemented.
- **Disposition: DEFERRED TO V2 (W2** — signed-set addition paired with the JCS breaking change). Impact: D: BLOCKS trust-score integrity claims; B/C: MATERIAL RISK where scores drive selection; A: LIMITATION.
- **Closure criteria:** `registration_date` in both `canonicalJSON` implementations (coordinated breaking change with dual-signature window), or resolver zeroes the component for unverified fields; cross-implementation byte-equivalence test updated; spec §5.2/§6.2 updated.

#### FDI-CRY-002 — Canonicalization is not portable: top-level-only ordering + JS `JSON.stringify` semantics
- **Sources:** ledger AI-007 (raised 2026-05-16, external round 3); spec-gap REG-01/02/05 (blockers); arch-reg A2.
- **Disposition: DEFERRED TO V2 (W2** JCS migration — with the doc-set's C9 caveat that JCS has **no owning area** in the v2 design, and D2's open question of what canonicalization W1 Phase-B registrant signatures sign over).
- **Impact:** second implementation / C / D: BLOCKS byte-compatible verification.
- **Closure criteria:** RFC 8785 (or equivalent) adopted with dual-signature transition window, published test vectors, and a statement of what happens to v1.0.0-tarball verifiers during the re-sign window (currently missing — doc-set §6).

#### FDI-CRY-003 — Root signing key lives in the network-facing process
- **Sources:** arch-reg S5 (P1); Issue #4 (HSM consideration).
- **Verification:** `fs.readFileSync(PRIVKEY_PATH)` into the same Node process that terminates public HTTP; no signer isolation.
- **Disposition: DEFERRED TO V2 (W1** signer externalization + intermediate; **W2** offline root). Impact: D / public authoritative Registry: BLOCKS; A: LIMITATION (disclosed).
- **Closure criteria:** signing moved to a separate process/service (minimum) with the HTTP tier holding no private key; rotation/compromise runbook; ideally HSM/KMS.

#### FDI-CRY-004 — No key hierarchy, delegation, or counter-signature; one key signs every record
- **Sources:** Issue #4; `architecture-review-registry-vs-existing-infrastructure-2026-06-10.md` (delegation/counter-signatures/expiry as the three "make multi-org real" items); strategic-eval §4 ("the central architectural defect").
- **Disposition: DEFERRED TO V2** — with a verified gap: Area 5 covers hierarchy/custody (W1–W2), but **delegation and counter-signing have no wave assignment anywhere in the v2 design** (strategic-eval §4, confirmed by reading the design's wave table).
- **Closure criteria:** delegation semantics specified (orgs sign their own subtrees under a chain of trust); wave-assigned; witness-vs-endorsement distinction (registration witnessing ≠ DNSO endorsement) made explicit in the trust model.

#### FDI-CRY-005 — Key rotation has never been exercised end-to-end
- **Sources:** Issue #4 ("documented in §5.6, tooling exists (`rotate-key.js`), but the full rotation procedure has not been tested"); AI-008 question B.
- **Disposition: OPEN.** Impact: D: MATERIAL RISK; any compromise-recovery claim: BLOCKS.
- **Closure criteria (from Issue #4, already precise):** execute and document a full rotation on the reference deployment; integration test exercising the procedure; documented degradation window.

#### FDI-CRY-006 — Trust-root distribution rests on one HTTPS endpoint; installer SHA check is advisory
- **Sources:** dillclaw-gap G-3 (HIGH — "the install **succeeds even if the SHAs differ**"); README trust model (WebPKI cert for dillweed.com is the de-facto root, per the comparative review).
- **Disposition: OPEN.** Impact: C: MATERIAL RISK (an independent operator's trust root is only as good as one TLS connection plus operator diligence); A/B: LIMITATION.
- **Closure criteria:** installer fails on SHA mismatch (doc-set C4 item); secondary distribution channel or DNSSEC/DANE anchoring documented as the longer-term path.

### Identity and delegation

#### FDI-ID-001 — No registrant identity: one shared admin token is the entire write/governance authority; fail-open default; spoofable audit attribution
- **Sources:** arch-reg S7 (P1); trust-boundary F-6 (HIGH, conditional).
- **Verification:** `isAuthorized` returns `true` for all writes when `REGISTRY_ADMIN_TOKEN` is unset (`registry/server.js:461–467`); service binds `0.0.0.0` (`:1210`); `caller` in the audit log remains the self-declared `x-dillclaw-caller` header. With open writes, F-6's chain (register look-alike at `canonical`, Registry signs it, Resolver verifies it as authentic) is fully live.
- **Disposition: DEFERRED TO V2 (W1** enrollment/delegation Phases A–B; **W2** completes). The deployment-default half (fail-open, CORS) is FDI-XST-004.
- **Impact:** D: **BLOCKS** · any multi-party write access: BLOCKS · A: LIMITATION (token set in reference deployment per README) · B: MATERIAL RISK if a public resolver shares a network with a writable registry.
- **Closure criteria:** per-registrant authenticated identity; scoped authority ("a registrant may revoke only its own records") enforced and tested; audit `caller` derived from authenticated identity; fail-closed default (token required or loopback bind).

#### FDI-ID-002 — No caller identity or authentication on the Resolver
- **Sources:** arch-res S2 (P0, auth half — the rate-limit half is FDI-XST-001); arch-res A1.
- **Verification:** no auth on `/resolve`, `/batch`, `/capability`, `/trace`; per-IP rate limiting is now the only abuse control; `/capability` still returns raw records with no trust filtering (enumeration aid, arch-res A7).
- **Disposition: DEFERRED TO V2 (W1).** Impact: B: BLOCKS (with FDI-OPS-001/002) · D: BLOCKS · A: NO CURRENT IMPACT.
- **Closure criteria:** caller identity (token/OIDC/SPIFFE per v2 Area 1), per-identity quotas (W4), probe gating behind auth.

#### FDI-ID-003 — No per-node credential for Anthill submitters
- **Sources:** arch-ant S2 (P0). One global bearer token (or none); no per-node/per-org identity; no single-node revocation. **Disposition: DEFERRED TO V2 (W1**, same enrollment as FDI-ANT-001). Impact: D: BLOCKS.
- **Closure criteria:** per-node enrollment with individual revocation; shared-token mode retired or demoted to dev-only.

#### FDI-ID-004 — Self-assigned `verified`/`canonical` tiers scored at face value; resolver never checks attestation
- **Sources:** trust-boundary F-2 (HIGH); arch-reg S8 (P2); consistency r2-H-2 (via FDI-DOC-012).
- **Verification:** Registry stores and signs any declared tier, logging `provisional_tier` (`registry/server.js:890–893`); `TIER_SCORE` maps canonical→1.0/verified→0.85 (`resolver/server.js:808`); the resolver contains no `/log` consultation (grep: no reference). After r4/r5 fixes, no document asserts a nonexistent countermeasure — the gap is now honestly disclosed everywhere.
- **Disposition: DEFERRED TO V2 (W2** — DNSO attestation as a signed, separately verifiable fact). Impact: D: BLOCKS; trust-tier claims: BLOCKS; A: LIMITATION (single-operator writes).
- **Closure criteria:** signed attestation artifact + resolver-side verification (caps unattested tiers for scoring) + new scoring profile version (the pinned `dillclaw-default-v1` cannot change semantics in place — r2's point, restated in doc-set §6) + tests.

#### FDI-ID-005 — Steward-agent boundary enforcement is non-cryptographic
- **Sources:** Issue #4 (shell script parsing YAML with grep; any process executing it can claim the agent identity). The agent lives outside this repo (`~/Dillweed-Agent/`), so verification here is limited to the issue text and ledger references.
- **Disposition: DEFERRED TO V2** (Issue #4 scope: signed identity attestation, boundary binding). Impact: governance-process integrity: LIMITATION; no deployment profile blocked.

### Cross-stack

#### FDI-XST-001 — No rate limiting on any service → per-IP limiting landed; per-identity remains
- **Sources:** arch-reg S4 (P1); arch-res S2 (P0, half); arch-ant S8 (P1); Issue #2 (requirement 2).
- **Mitigation (verified):** per-IP fixed-window limiter on all three services — separate read vs write/expensive budgets (default 300/100 per 60 s, env-overridable), `/health` + OPTIONS exempt, 429 + `Retry-After`, `rate_limit` exposed in `/health` (commit `a1a95d1`; `anthill/server.js:819–867` confirmed; registry and resolver confirmed by grep). Test evidence: 4 self-calibrating rate-limit tests per service in the tree; tracker claims Registry 95/95→98/98, Anthill 62/62.
- **Disposition: PARTIALLY CLOSED.**
- **Residual (why not CLOSED):** (a) Anthill spec v0.1.3 documents none of it (FDI-DOC-006) — closure requires spec parity; (b) fixed-window per-IP does not address distributed abuse or per-identity cost weighting (W4, by design); (c) operational interaction noted in tracker: back-to-back test suites from one IP hit the saturated window.
- **Impact:** B: LIMITATION (adequate first line) · D: MATERIAL RISK until per-identity quotas.
- **Closure criteria:** Anthill spec documents 429/limits; W4 per-identity quotas for multi-org.

#### FDI-XST-002 — Append-only logs are conventions, not cryptographic facts
- **Sources:** arch-reg S9 (P2); arch-ant S6 (tamper-evidence half); strategic-eval ("currently re-creates pre-CT PKI").
- **Verification:** no hash chaining, Merkle structure, or log signatures anywhere (grep across all three servers); immutability rests on the absence of UPDATE/DELETE endpoints; host/file access rewrites history undetectably.
- **Disposition: DEFERRED TO V2 (W3** — RFC 6962/Rekor-style log + monitors). Impact: D: BLOCKS; "immutable audit log"/"tamper-evident" claims: BLOCKS; A–C: LIMITATION (disclosed as "append-only by convention" — the docs are scrupulous here).
- **Closure criteria:** tamper-evident structure with third-party-verifiable consistency proofs; decision recorded on Rekor vs RFC 6962 library (doc-set D3) before code.

#### FDI-XST-003 — Specifications are insufficient for an independent second implementation
- **Sources:** `spec-gap-report-2026-06-10.md` — 88 gaps, 9 blockers: response-body serialization unpinned everywhere (XC-01, fatal to the mirror hash), canonical-JSON portability (REG-01/02 → FDI-CRY-002), error precedence undefined (REG-17, RES-08/09/10), semver-range grammar unpinned (RES-03), `/health` schemas undefined (REG-26/RES-23), trust-signal vocabulary (RES-14), probe mechanics (RES-15), Anthill wire protocol (→ FDI-ANT-010).
- **Verification of movement:** REG-22 partially closed by Registry spec v0.1.6 (`/list` default limit documented). The doc-set review's traceability finding stands: **RES-03, RES-08/09/10, REG-17, RES-14, RES-15 are absent from the v2 design** — four of the gap report's own top-10 remediation items are unmapped.
- **Disposition: OPEN.** Impact: any second implementation / cross-implementation conformance: BLOCKS; C: BLOCKS (serialization underlies the mirror hash); A/B: NO CURRENT IMPACT.
- **Closure criteria:** the gap report's prioritized list items 1–9 resolved in spec text with test vectors; a conformance test↔spec mapping (G-28) exists.

#### FDI-XST-004 — Wildcard CORS + fail-open token defaults + 0.0.0.0 binds (drive-by mutation surface)
- **Sources:** trust-boundary F-9 (MEDIUM) and the deployment-default half of F-6; v2 design W0 row (which included "fail-closed, CORS").
- **Verification:** `Access-Control-Allow-Origin: *` on all three services (`registry/server.js:1171`, `resolver/server.js:1672`, `anthill/server.js:873`); Registry and Resolver bind `0.0.0.0`; tokens fail open. The v2 design said W0 closes F-9; the executed W0 task list excluded it — it did not (doc-set C4, confirmed).
- **Disposition: OPEN.** Impact: B: **BLOCKS** · A: LIMITATION (loopback-adjacent network exposure) · D: BLOCKS.
- **Closure criteria:** no `ACAO: *` on state-changing endpoints; fail-closed default (require token or bind loopback); CSRF test demonstrating the browser-bridge attack no longer works; v2-design W0 row formally re-scoped so the claim and the shipped scope match.

#### FDI-XST-005 — MCP server trusts Resolver/Registry responses; no independent signature verification
- **Sources:** Issue #4. **Verification:** `mcp-server/server.js` `handleVerify` calls Registry `/verify/<name>` and passes the result through; no local Ed25519 verification or key fetch exists in the adapter.
- **Disposition: DEFERRED TO V2** (Issue #4 scope). Impact: MCP-client trust: LIMITATION (a compromised resolver forges results to MCP clients); no profile blocked.
- **Closure criteria:** adapter fetches/caches the canonical key, verifies record signatures locally, returns explicit error states on failure; tests.

#### FDI-XST-006 — v2 sequencing defect: W1 signature verification precedes the W4 serialization spec it depends on
- **Sources:** doc-set §3.7/§6/D1. **Verification:** v2 wave table places node-signature verify in W1; the canonical serialization + test vectors (emitter GAP-02) are Area 3 spec deliverables in W4. Verification cannot precede the definition of what is signed.
- **Disposition: OPEN** (a plan defect — fixable on paper before any W1 code). Impact: D (via W1 quality): MATERIAL RISK.
- **Closure criteria:** serialization spec pulled into W1 (or the wave table corrected), plus the D2 decision (what canonicalization Phase-B registrant signatures use).

#### FDI-XST-007 — No spec-version↔implementation-version mapping; W0 changed observable behavior at an unchanged implementation version
- **Sources:** spec-gap XC-03; gaps G-15/G-19; doc-set C11. **Verification:** Registry gained 429s, ETags, and SQL pagination while `VERSION` stayed 0.2.8; spec went 0.1.5→0.1.6; the v1.0.0 release table pins "Registry 0.2.8" to a tarball that lacks all of it. CONV-001 (the ledger's pre/post-publication version-bump convention) was not applied to W0.
- **Disposition: OPEN.** Impact: reproducibility/conformance claims: MATERIAL RISK; an evaluator installing the v1.0.0 tarball gets materially different behavior than the repo at the same stated version.
- **Closure criteria:** published mapping table (spec X.Y ↔ impl A.B ↔ release), impl version bumped for behavior changes, README distinguishes tarball baseline from repo HEAD.

### Operations and deployment

#### FDI-OPS-001 — No TLS for inter-component links crossing a network boundary
- **Sources:** Issue #2 (requirement 1); arch-reg A1 / arch-ant A1. **Verification:** plaintext HTTP everywhere; no shipped TLS guidance beyond the spec's reverse-proxy stance. **Disposition: OPEN.** Impact: B: **BLOCKS** (Issue #2's own gate); A: NO CURRENT IMPACT (loopback).
- **Closure criteria (Issue #2, already precise):** `DILLCLAW_REGISTRY_BASE_URL` over HTTPS supported and documented; deployment enforces TLS on all cross-boundary links; runbook updated.

#### FDI-OPS-002 — No threat-model document
- **Sources:** Issue #2 (requirement 3: publish `docs/threat-model.md`). **Verification:** no such file; the trust-boundary analysis covers much of the requested content but is an internal review, not the deployment-scoped threat model the issue specifies. **Disposition: OPEN.** Impact: B: BLOCKS (per the issue's gate).
- **Closure criteria:** `docs/threat-model.md` covering the first public deployment's architecture per the issue's eight-item list.

#### FDI-OPS-003 — Repository hygiene: dev key in working tree, 1,373 unignored trace files, untracked lockfile
- **Sources:** doc-set §3.4/A5; strategic-eval §4. **Verification at `c999fdd`:**
  - `registry/keys/dnso_private.pem` is now a **symlink** to `~/.dillweed/dev-keys/dnso_private.pem` (key material moved out of the tree, dated 2026-06-12) and is git-ignored (`git check-ignore` → `.gitignore:35 dnso_private.pem`, a pattern present since commit `539d4c9`, 2026-05-19). It is a dev key (public-half SHA `3a7528e3…` ≠ canonical `909891e9…`).
  - `resolver/traces/*.json` (1,373 files) are untracked and **not ignored** — the `.gitignore` `traces/*` pattern contains a slash and therefore anchors to the repo root, missing `resolver/traces/`. One `git add -A` commits 1,373 operational artifacts.
  - `registry/package-lock.json` and `registry/keys/dnso_public.pem` untracked, neither ignored. `.DS_Store` files exist on disk but are ignored and **not** tracked (verified `git ls-files`).
- **Disposition: PARTIALLY CLOSED** (key risk substantively addressed; trace/lockfile hygiene remains). Impact: evaluator credibility: MATERIAL RISK → LIMITATION after the key fix.
- **Closure criteria:** `.gitignore` covers `**/traces/*` (or `resolver/traces/`); trace corpus pruned or relocated; lockfile decision (track or ignore) made; clean `git status` on a fresh checkout + operational run.

#### FDI-OPS-004 — macOS-only installers, no CI, no Linux path — ACCEPTED FOR V1
- **Sources:** dillclaw-gap G-5/G-10; doc-set §7.7. README discloses ("Linux support anticipated in a future release"). Impact: C: MATERIAL RISK (reproducibility limited to macOS); A: NO CURRENT IMPACT. Becomes OPEN the moment an institutional evaluation node (Profile C) is solicited.

#### FDI-OPS-005 — Configuration reference missing
- **Sources:** dillclaw-gap G-1 (HIGH: "no document says how the resolver is pointed at a registry"), G-2 (HIGH: TTL knobs undocumented; the impl "arguably fails its own §7.5 MUST as documented"); doc-set B5. **Verification:** the v0.1.8 spec revision note added none of it; the gap report's #1 recommended fix was not picked up by the W0 spec pass.
- **Disposition: OPEN.** Impact: C / independent deployment: BLOCKS correct configuration (deployers must read source); A: NO CURRENT IMPACT.
- **Closure criteria:** env-var/config reference (registry base URL, all four TTLs, stale window, jitter/backoff, rate-limit knobs, probe enablement) in spec or README, with the launchd-plist-regeneration caveat documented.

#### FDI-OPS-006 — Plaintext admin tokens in launchd plists — ACCEPTED FOR V1 (INST-011, info). Revisit at multi-operator. Also note ledger 2026-05-24: a token was exposed to an AI session inline; rotation recommended before multi-operator use.

#### FDI-OPS-007 — Tarball filename vs extract-directory inconsistency — PARTIALLY CLOSED (INST-008: filename corrected at v1.0.0; still extracts to `dillclaw-resolver/`; cosmetic, README-disclosed). **Target:** future release (cleanup queued per README known-issues).

#### FDI-OPS-008 — Install-test series INST-001…INST-014 — CLOSED
- **Evidence:** INST-001/004/005/006 closed in the v0.2.8/v0.1.8/v0.1.5 patch round (ledger, ship-verified on dill-p-001 2026-05-17); INST-013 closed 2026-05-24 with a *corrected diagnosis* (the original "server-side enforcement is intact" claim was partially wrong — `req.destroy()` was suppressing the 413; both test and server fixed, commits `7a553f1`/`da6ab0c`); INST-014 closed. Residuals split out: INST-008 → FDI-OPS-007, INST-011 → FDI-OPS-006, INST-012 (unused `resolver-patch.js` in Registry tarball) — cosmetic, still disclosed in README, untracked here as sub-item.

#### FDI-OPS-009 — "Dev private key not covered by `.gitignore`" — NOT A DEFECT
- **Sources:** doc-set §3.4 ("**not covered** by `.gitignore` (the `keys/*` pattern is anchored to the repo root)").
- **Verification:** the *additional* unanchored pattern `dnso_private.pem` at `.gitignore:35` has covered the file since commit `539d4c9` (2026-05-19) — `git check-ignore -v` confirms. The doc-set review evaluated only the `keys/*` pattern. The legitimate core of the concern (key material physically present in the tree) was real and is tracked/closed under FDI-OPS-003. Recorded so the corpus's one verified reviewer false-positive at HIGH severity is on the record — consistent with the project's own practice of documenting reviewer overreach (ledger, Resolver final-pass addendum).

#### FDI-OPS-010 — Anthill v0.1.6 release asset is ~9.9 MB vs ~51 KB peers — UNVERIFIED
- **Sources:** ledger STEWARD-SWEEP-2026-06-11 finding 1. **Verification:** size anomaly confirmed via GitHub API (`dillweed-anthill-v0.1.6.tar.gz` = 9,907,578 bytes; registry 52,012; resolver 51,291). Contents not inspected this session; SHA matches docs per the sweep. Likely cause (inference): bundled `node_modules`. **Closure criteria:** unpack audit; republish lean tarball or document the contents.

### Documentation and version drift

#### FDI-DOC-001 — The published review corpus carries no disposition layer
- **Sources:** doc-set §3 finding 1 / A1 ("highest-impact fix"). **Verification:** none of the three architecture reviews or the trust-boundary analysis carries a post-W0 banner or annex at `c999fdd`; `docs/README.md` does not mark them partially stale.
- **Disposition: OPEN** — this index supplies the corpus-wide disposition layer; per-document banners (§10's recommended annotation) remain to be added.
- **Impact:** E: was the top evaluation blocker; with this index, downgraded to LIMITATION pending banners.

#### FDI-DOC-002 — README's unscoped "No HIGH-severity or MEDIUM-severity issues are open" — CLOSED
- **Sources:** doc-set C5/#5; strategic-eval §4 ("the single worst thing an evaluator can find").
- **Evidence:** commit `b7fab11` (2026-06-12) replaces the sentence with a scoped statement disclosing the open CRITICAL F-3, the open HIGH cluster, what W0 closed, and the W1–W2 schedule (diff verified; current README §"Evaluation readiness" confirmed). Note both the doc-set review and the strategic evaluation predate this fix and now carry stale statements about it (§10).

#### FDI-DOC-003 — README test counts pinned to v1.0.0 tarballs, presented as current instructions
- **Sources:** doc-set C6. **Verification:** README "Running test suites" still says 79/79, 65/65+29/29, 58/58 against `/usr/local/...` installs; current repo suites are larger (tracker: registry 98/98; resolver 77/77 unit + suite with 5 known seed-fixture failures; anthill 62/62). Correct for the frozen tarballs, misleading as repo guidance — and the resolver suite's 5 environmental failures are documented only in the tracker. **Disposition: OPEN** (LOW). **Closure:** label counts as v1.0.0-tarball expectations and state current repo-suite expectations incl. the known-failure set.

#### FDI-DOC-004 — Series-total arithmetic: "4 HIGH and 19 MEDIUM"
- **Sources:** doc-set C7/#8. **Verification:** `docs/README.md` (line 57) and the ledger series entry still state 4 HIGH/19 MEDIUM; r6's own per-round table sums to 8 HIGH and ≥21 MEDIUM (r1 4H/9M + r2 3H/10M + r3 1H/2M new). All were resolved, so substance stands. **Disposition: OPEN** (LOW, credibility).

#### FDI-DOC-005 — Dangling evidence pointers: cited steward reports absent from the repository
- **Sources:** doc-set §7.2. **Verification:** no `reports/` directory and no `docs/*steward*` file exist; yet commits `d1466c0` and `8c87a85` cite findings H-3/M-1/M-3 from `steward-report-2026-06-10-r3`, and the ledger cites `reports/steward-report-2026-06-11.md`. The audit chain for three W0-era remediation commits cannot be independently read. **Disposition: OPEN.** **Closure:** commit the reports into `docs/` or annotate the references with their substance.

#### FDI-DOC-006 — Anthill spec is silent on the rate limiting the implementation enforces
- **Sources:** doc-set C2/#3. **Verification:** `specs/anthill-spec.html` (v0.1.3) contains no 429/limiter documentation (its single "rate limiting" match is an unrelated DNSO-response passage); `anthill/server.js:819–867` enforces it. The one-document-fix/echo-missed defect class the consistency series existed to catch, recurring in the W0 spec pass with no round-7. **Disposition: OPEN.** **Closure:** Anthill spec documents limits/429/Retry-After and bumps with a revision note.

#### FDI-DOC-007 — Registry spec §2.2 still claims mirror freshness fields work "without trusting the mirror itself"
- **Sources:** mirror-gap G-11 (reasoning: both fields are mirror-computed/self-asserted); doc-set C3. **Verification:** the phrase is present verbatim in `specs/registry-spec.html` v0.1.6. A false security claim in a published spec. **Disposition: OPEN** (architectural fix is W3 signed checkpoints; the *caveat* costs a sentence now). Impact: C: misleads mirror operators; "tamper evidence" claim: BLOCKS.

#### FDI-DOC-008 — DillClaw spec v0.1.8 documents client-side conditional fetch that the implementation lacks
- **Sources:** doc-set C1/#2. **Verification:** spec §7.1 "resolver SHOULD send If-None-Match…" present; zero matching code in `resolver/server.js`. Strictly a SHOULD, so not a conformance violation — but the v0.1.8 revision note presents it as part of the shipped W0 pass, which overstates. **Disposition: OPEN.** **Closure:** implement the client (preferred — small change; see FDI-RES-001) or correct the revision note.

#### FDI-DOC-009 — Evaluation steps gate on external GitHub issues with no in-repo summary
- **Sources:** dillclaw-gap G-27; doc-set A6. **Verification:** README evaluator steps 5–6 still point to Issues #2/#4; the `b7fab11` paragraph now summarizes much of the substance in-repo, which partially mitigates. **Disposition: OPEN** (LOW).

#### FDI-DOC-010 — Ledger/tracker status drift
- **Sources:** this review. **Verification:** (a) ledger AI-003 header still reads "OPEN, deferred enhancement" though the validation shipped (FDI-REG-004); (b) `v2-tracker.md` header reads "all changes committed on v2/w0-hardening, not pushed" and "Last Commit: n/a" though the W0 commits are on `main` at origin; (c) STEWARD-SWEEP-2026-06-11 sits under "OPEN ITEMS" while marked COMPLETE. **Disposition: OPEN** (LOW — but the ledger is the project's canonical findings record; its self-accuracy is load-bearing).

#### FDI-DOC-011 — `anthill/README.md` self-describes as v0.1.4
- **Sources:** this review. **Verification:** headline section "What's new in v0.1.4"; current-behavior statements phrased as "v0.1.4 enforces…" (line 117) and "this v0.1.4 local reference implementation" (line 133); `anthill/package.json` and `server.js` are 0.1.6. Issue #1 ("update Anthill version references…") was closed on the strength of fixes to the repo README, release notes, runbook, and package.json — the component README was missed. **Disposition: OPEN** (LOW). See §13.

#### FDI-DOC-012 — Phantom provisional-tier "weighting penalty" — SUPERSEDED
- **Sources:** consistency r2-H-2 (Registry §7 + Charter §4 required a resolver weighting penalty that no spec defined and no code implemented). **Resolution:** rounds 4–5 removed the assertion everywhere (r6 verified: "No document or code path anywhere in the stack now asserts the nonexistent weighting-penalty mechanism"). The honest-downgrade pattern is a credibility asset. The *underlying* trust gap continues as **FDI-ID-004**. Recorded as the index's example of a finding evolving into a narrower residual.

### Governance

#### FDI-GOV-001 — Single-steward, single-key construction contradicts the neutrality thesis
- **Sources:** strategic-eval §1/§4 ("the central architectural defect"); reg-vs-infra review (witness/endorsement conflation). **Disposition: OPEN** — not closable by code; requires delegation (FDI-CRY-004) *and* at least one independent operator (FDI-RESR-001). Impact: D and "neutral infrastructure" claim: BLOCKS.
- **Closure criteria:** delegation shipped + ≥1 non-affiliated operator running a resolver/mirror under the licensed-operator model the Continuity Protocol §10 names.

#### FDI-GOV-002 — Continuity instruments unexecuted
- **Sources:** GSP-01 §11 (per strategic-eval §6/§10: CDI not executed, sealed recovery materials not placed, attorney custody pending). Not independently verifiable from the repo (the instruments are off-repo by nature) — status taken from the project's own disclosure. **Disposition: OPEN.** "A continuity protocol that is itself incomplete inverts its purpose." **Closure:** execute and attest (dates, custodian) in the ledger.

#### FDI-GOV-003 — Governance corpus institutionalizes bodies that do not exist
- **Sources:** strategic-eval §4/§9 (Option 6: narrow; mark governance documents stable-and-dormant). **Disposition: OPEN** — a pending steward decision, not a defect; recorded because the strategic evaluation makes narrowing a condition of its verdict. Impact: institutional credibility: LIMITATION.

### Research and evaluation readiness

#### FDI-RESR-001 — Zero external validation
- **Sources:** strategic-eval §8. **Verification:** 0 stars/0 forks/0 external issues (repo public since 2026-05-19); all 1,373 traces from one day with `caller_id: null`; no third-party implementation, deployment, or registered external capability; Namespace §11 milestones 03–05 PENDING by the spec's own scorecard. **Disposition: OPEN** (a fact to change, not a defect to patch). Blocks: partnership asks (per strategic-eval), not evaluation itself.

#### FDI-RESR-002 — AI-authored review corpus; "external review" wording overstates independence — PARTIALLY CLOSED
- **Sources:** strategic-eval §8; ledger AI-008 (which itself distinguishes "the generalist AI review used during the v1 audit cycle" from the human specialist review it recommends).
- **Verification:** disclosure now exists in `research-opportunities-summary.md` ("the project's review corpus is self-authored and should be treated as hypotheses to re-derive") and the ledger. **Residual:** README line 34 ("three rounds of external review per component") and the v1.0.0 release notes ("External audit … external review") still read as independent third-party review to an uninformed evaluator.
- **Closure criteria:** qualify those two surfaces ("AI-assisted review rounds, externally prompted; see AI-008") — one sentence each.

#### FDI-RESR-003 — Specialist cryptographic review not commissioned
- **Sources:** ledger AI-008 (questions A–D: canonicalization, key-rotation model, mirror freshness anchor, revocation reuse), flagged there as a prerequisite "before partnership outreach begins"; strategic-eval months-2–4 plan ("the one place money should be spent"). **Disposition: OPEN.**

---

## 8. Stale-document index

Recommended banner (adapted per document):

> **Historical review.** Findings reflect repository state at commit `<hash>` on `<date>`. Several findings have since been closed or narrowed. See `docs/finding-disposition-index-2026-06.md` for current status.

All documents below should be **preserved unmodified** apart from the banner — they are the audit trail.

| Document | Outdated findings | Still accurate | Superseded by |
|---|---|---|---|
| `architecture-review-registry-2026-06-10.md` | S3 (pagination/ETag server-side: PARTIALLY CLOSED), S4 (rate limiting: PARTIALLY CLOSED); scope header cites spec v0.1.5 (now v0.1.6) | S1, S2, S5–S9 | FDI-REG-001/002/003, XST-001, CRY-001/003, ID-001/004, XST-002 |
| `architecture-review-resolver-2026-06-10.md` | S3 (SSRF: CLOSED); S1 partially (jitter/backoff/pagination landed); S2 partially (rate limiting landed); spec now v0.1.8 | S4–S8 | FDI-RES-001/002/003/004…, ID-002, XST-001 |
| `architecture-review-anthill-2026-06-10.md` | S8 (rate limiting: code-closed, spec-undocumented) | S1–S7, S9 | FDI-ANT-*, XST-001/002 |
| `cross-service-trust-boundary-analysis-2026-06-10.md` | F-8 CLOSED, F-10 CLOSED; F-9 half-superseded (rate limiting landed; CORS/fail-open remain) | F-1…F-7, F-11 — re-verified accurate, incl. the CRITICAL F-3 | FDI-ANT-001…003, CRY-001, ID-001/004, RES-008, XST-004 |
| `docs/README.md` | "4 HIGH and 19 MEDIUM" series total; review-series summary predates W0 dispositions; no current-spec-version note | Index structure | FDI-DOC-004, FDI-DOC-001 |
| `spec-gap-report-2026-06-10.md` | REG-22 partially closed (v0.1.6 documents `/list` default limit) | The other 87 gaps; all 9 blockers re-spot-checked open | FDI-XST-003, FDI-CRY-002, FDI-ANT-010 |
| `dillclaw-deployment-gap-report-2026-06-10.md` | Spec citation (v0.1.7 → v0.1.8) | G-1/G-2/G-3 verified still open; configuration reference still absent | FDI-OPS-005, FDI-CRY-006 |
| `registry-mirror-deployment-gap-report-2026-06-10.md` | Nothing — W0 touched none of it (re-verified) | Entire report | FDI-REG-002, FDI-DOC-007 |
| `anthill-signal-emitter-gap-report-2026-06-10.md` | Nothing (anthill spec unchanged at v0.1.3) | Entire report | FDI-ANT-010, FDI-ANT-001 |
| `dillweed-v2-design-2026-06-10.md` | W0 row ≠ shipped W0 (fail-closed/CORS, async sinks + retention dropped); "W0 closes F-9" half-true; JCS owner unassigned; W1/W4 serialization sequencing | Areas 1–6 design content | FDI-XST-004/006, FDI-CRY-002 |
| `v2-tracker.md` | Header ("not pushed", "Last Commit: n/a") contradicts merged history | Session notes (the best W0 evidence in the repo) | FDI-DOC-010 |
| `PROJECT_LEDGER.md` | AI-003 marked OPEN (shipped); STEWARD-SWEEP under "OPEN ITEMS" while complete; cites absent `reports/…` files | Everything else spot-checked | FDI-REG-004, FDI-DOC-005/010 |
| `documentation-set-review-2026-06-11.md` | README-claim item (fixed by `b7fab11`); gitignore-coverage sub-claim (FDI-OPS-009); ".DS_Store committed" (none tracked at HEAD) | The rest — it is the closest precursor to this index and verified well |  this index |
| `strategic-evaluation-2026-06-12.md` | "README still claims No HIGH/MEDIUM open" (fixed hours later by `b7fab11`) | All strategic content | FDI-DOC-002 |
| Consistency reviews r1–r6 | r5/r6 carry the series-total arithmetic | Internally well-dispositioned; closed series | FDI-DOC-004 |
| `README.md` (repo root) | Test counts (FDI-DOC-003); "external review" phrasing (FDI-RESR-002) | Trust model, install, known issues, evaluation-readiness paragraph (post-`b7fab11`) | — |

---

## 9. Contradiction table

| # | Where | Nature | Classification | Index entry |
|---|---|---|---|---|
| K1 | DillClaw spec v0.1.8 §7.1 + revision note vs `resolver/server.js` (no If-None-Match/304 code) | Spec describes client behavior the reference impl lacks; rev note implies it shipped | **Current contradiction / version drift** | FDI-DOC-008, FDI-RES-001 |
| K2 | `anthill/server.js` enforces 429 rate limiting vs `anthill-spec.html` v0.1.3 silent | Code implements behavior not documented | **Current contradiction** | FDI-DOC-006 |
| K3 | Registry spec §2.2 "without trusting the mirror itself" vs mirror-gap G-11 (fields are mirror-computed) | Published security property not achievable as specified | **Unresolved design decision** (W3 fixes; caveat missing) | FDI-DOC-007 |
| K4 | v2 design W0 row (fail-closed, CORS, async sinks, retention) vs `v2-tracker.md` W0 (6 tasks, excludes them) vs ledger "W0 deployed" | "W0 COMPLETE" true of tracker-W0, false of design-W0 | **Scope mismatch** | FDI-XST-004, FDI-RES-004 |
| K5 | DillClaw §3.3 unscoped determinism MUST vs wall-clock `usageScore`, per-process liveness, unpinned FP | Spec overclaims vs implementation reality | **Unresolved design decision** | FDI-RES-003 |
| K6 | README test counts (79/65+29/58) vs current suites (98/77/62 per tracker, with 5 known resolver-suite failures) | Frozen-tarball numbers presented as current instructions | **Version mismatch** | FDI-DOC-003 |
| K7 | `docs/README.md` + ledger "4 HIGH, 19 MEDIUM" vs r1–r3 per-round sums (8 HIGH, ≥21 MEDIUM) | Arithmetic | **Stale statement (minor)** | FDI-DOC-004 |
| K8 | Registry behavior changed in W0 (429/ETag/SQL pagination) at unchanged impl version 0.2.8; v1.0.0 release table pins 0.2.8 to the pre-W0 tarball | Same version string, two behaviors | **Version mismatch** | FDI-XST-007 |
| K9 | `v2-tracker.md` "committed on v2/w0-hardening, not pushed / Last Commit: n/a" vs W0 commits merged on `main` at origin | Tracker header frozen mid-wave | **Stale statement** | FDI-DOC-010 |
| K10 | Ledger AI-003 "OPEN, deferred" vs `registry/server.js:434–451` implementing it | Ledger lags code | **Stale statement** | FDI-DOC-010, FDI-REG-004 |
| K11 | Ledger "F-003 closed" (website redirect) vs trust-boundary "F-3" (open CRITICAL) | Same-looking IDs, unrelated findings | **Terminology mismatch** (risk of false reassurance) | §2 note |
| K12 | doc-set review "key **not covered** by .gitignore" vs `git check-ignore` → `.gitignore:35` (since 2026-05-19) | Reviewer evaluated one pattern, missed the covering one | **Stale/incorrect statement** | FDI-OPS-009 |
| K13 | README/release notes "external review" vs ledger AI-008 "generalist AI review" | Independence implied vs disclosed reality | **Terminology mismatch** | FDI-RESR-002 |
| K14 | `anthill/README.md` "this v0.1.4 reference implementation" vs package.json/server 0.1.6 vs Issue #1 closed as "all documents now reference v0.1.6" | Issue closed with a surface missed | **Version mismatch** | FDI-DOC-011, §13 |
| K15 | v2 wave table: W1 verifies node signatures; the serialization they're computed over is a W4 deliverable | Plan-internal dependency inversion | **Unresolved design decision** | FDI-XST-006 |
| K16 | Strategic eval / doc-set review statements about the README claim vs post-`b7fab11` README | Reviews predate the fix | **Stale statements** (annotate, don't edit) | FDI-DOC-002 |

The corpus remains internally consistent on the big architecture story (authoritative-vs-mirror, revocation, key custody, Anthill's role); nearly all contradictions are corpus-vs-moving-surface, as the documentation-set review predicted.

---

## 10. Hardening-wave assessment

Only W0 has executed. W1–W4 are design-stage (the tracker's "Next Step" records W1 as awaiting steward go-ahead).

| Wave | Intended scope (design) | Findings targeted | Fully closed | Partially closed | Missed / dropped | New issues introduced |
|---|---|---|---|---|---|---|
| **W0** | Probe deny-list, fail-closed defaults, CORS, 429s; async/bounded/rotated sinks + retention; ETag/304 + jitter/backoff | F-8, F-9, F-10; Reg S3/S4; Res S1/S5; Anth S8 | F-8 (FDI-RES-002), F-10 (FDI-RES-009) | Reg S3 (server side only — no ETag consumer), rate limiting (Anthill spec undocumented; per-identity W4), Res S1 (jitter/backoff/pagination; no conditional fetch) | **Fail-closed defaults + CORS (F-9)** and **async sinks + retention (Res S5)** — in the design's W0, absent from the tracker's W0, never re-scoped | Spec/impl divergence K1 (client conditional fetch documented, not implemented); K2 (Anthill spec silent on 429); K8 (behavior change at unchanged impl version); jitter widened worst-case revocation propagation (test wait 70→90 s) with no spec note; tracker-noted rate-limit/test-suite interaction |
| **W1** | Identity keystone: enrollment, dual-signature accept, node-signature verify; signer externalization + intermediate key | FDI-ANT-001/002/003, FDI-ID-001/002/003, FDI-CRY-003 | — not started | — | **Pre-work defect:** serialization spec is W4 (FDI-XST-006); doc-set review D2 (Phase-B canonicalization) and D4 (quota wave ambiguity) undecided | — |
| **W2** | Signed `registration_date`, tier attestation, JCS, offline root, expiry | FDI-CRY-001/002, FDI-ID-004 | — | — | JCS has no owning area (C9, doc-set review); v1-tarball verifier story during re-sign window unstated | — |
| **W3** | Delta feed, signed checkpoints, real mirrors, HA, Merkle log | FDI-REG-001/002, FDI-RES-008, FDI-XST-002, FDI-ANT-005 | — | — | Delegation/counter-signature still unassigned to any wave (FDI-CRY-004) | — |
| **W4** | OTel re-layer, corroboration, completeness attestation, per-identity quotas | FDI-ANT-004/009/010, XST-001 residual | — | — | — | — |

**W0 test/doc verification:** tests for every shipped W0 task exist in the tree (ETag ×6, pagination ×6, tag ×3, rate-limit ×4/service, jitter ×12+3, SSRF ×35+2 — counts from tracker, presence verified by grep); spec updates landed for Registry (v0.1.6) and DillClaw (v0.1.8) but **not** Anthill; pass counts are tracker claims, not re-executed here. The W0 engineering itself verifies cleanly; the W0 *bookkeeping* (design-vs-tracker scope, spec echoes, version mapping) is where the defects are.

---

## 11. Issue-closure assessment

| Issue | Requirement | Evidence cited at closure | Independently verified? | Closure justified? | Maps to | Residual |
|---|---|---|---|---|---|---|
| **#1** (closed 2026-06-06) | Update Anthill version refs v0.1.5→v0.1.6 | Steward sweeps 2026-06-06: "All documents now reference Anthill v0.1.6" | Partially: repo README, release notes, runbook, `package.json`, release body all verified 0.1.6 | **Mostly** — one surface missed | FDI-DOC-011 | `anthill/README.md` still self-describes as v0.1.4 (verified lines 24, 117, 133). Recommend reopening *or* a small follow-up fix; the miss is within the issue's literal scope ("docs… version references") |
| **#2** (OPEN) | TLS, rate limiting, threat model — gates public Resolver | n/a | Rate limiting **done** (W0, verified); TLS and threat model **not done** (verified) | Correctly still open | FDI-OPS-001/002, XST-001 | Suggest a comment noting requirement 2 is complete with commit `a1a95d1`, so the issue tracks the true remaining gap |
| **#3** (closed 2026-06-06) | Evaluation readiness: integration tests, freshness doc, trust-score semantics | Ledger 2026-06-06: integration suite 19/19; DillClaw §7.5 (v0.1.4); §6.4 (v0.1.5) | Yes: `integration-test.sh` exists with 19 checks incl. revocation propagation; both spec sections present in current spec (titles verified) | **Yes** | — | The §7.5 propagation bound predates W0 jitter; the adversarial freeze (FDI-RES-008) and the widened jittered bound deserve a sentence — residual is documentation polish, not a reopening |
| **#4** (OPEN) | v2 roadmap: key hierarchy, agent attestation, MCP verification, rotation test | n/a | All four items verified still open (FDI-CRY-003/004/005, ID-005, XST-005) | Correctly open | those entries | The issue's scope omits delegation/counter-signature explicitly (it says "delegation semantics" under key hierarchy — partially covers FDI-CRY-004); fine as a roadmap pointer |

No issue requires automatic reopening. Issue #1 is the only closure with an unmet acceptance criterion, and the unmet portion is a one-file doc fix.

Ledger-tracked finding closures spot-checked beyond the issues: INST series (justified — see FDI-OPS-008, including the honest re-diagnosis of INST-013), the consistency-series HIGH/MEDIUM closures (r6's verification round is itself the evidence; spot-checks of R5-2's provisional-tier strings and the pinned `usageScore` formula confirm), and the resolver/anthill external-review convergences (historical; SHAs recorded; not re-executable here).

---

## 12. Deployment-profile matrix

| Finding cluster | A: Local reference | B: Public RO Resolver | C: Mirror / institutional node | D: Multi-org production |
|---|---|---|---|---|
| FDI-ANT-001/002/003 (signal authenticity) | LIMITATION (disclosed) | NOT APPLICABLE | MATERIAL RISK | **BLOCKS** |
| FDI-ID-001/002/003/004 (identity) | LIMITATION | **BLOCKS** (ID-002, with OPS-001/002) | MATERIAL RISK | **BLOCKS** |
| FDI-CRY-001/002/003/004 (signing/keys) | LIMITATION | MATERIAL RISK | MATERIAL RISK | **BLOCKS** |
| FDI-REG-001/002 (HA/mirror) | NO CURRENT IMPACT | MATERIAL RISK | **BLOCKS** (REG-002) | **BLOCKS** |
| FDI-RES-004 + XST-004 + OPS-001/002 (public-surface hardening) | NO CURRENT IMPACT / LIMITATION | **BLOCKS** | MATERIAL RISK | BLOCKS |
| FDI-XST-003 + ANT-010 (spec completeness) | NO CURRENT IMPACT | NO CURRENT IMPACT | **BLOCKS** (serialization → mirror hash) | BLOCKS (2nd impl) |
| FDI-OPS-004/005 (portability/config docs) | NO CURRENT IMPACT | LIMITATION | MATERIAL RISK | MATERIAL RISK |
| FDI-DOC cluster | LIMITATION (credibility) | LIMITATION | LIMITATION | LIMITATION |
| FDI-GOV / RESR | NO CURRENT IMPACT | LIMITATION | MATERIAL RISK (institutional trust) | BLOCKS (GOV-001) |
| **Profile verdict** | **Viable now** — evaluation-ready with documented limitations | **Not viable** — Issue #2 gate unmet + RES-004/XST-004/ID-002 | **Not viable** — no mirror protocol exists | **Not viable** — the v2 design is the project's own admission |

---

## 13. Claim-safety assessment

| Claim (current wording, location) | Related findings | Safe now? | Recommended wording | Defensible when |
|---|---|---|---|---|
| "A capability-registration and resolution system with a **publicly verifiable trust root**" (README:3) | FDI-CRY-006, GOV-001 | Borderline | "publicly *published* trust root; record signatures independently verifiable against it" | DNSSEC/DANE or secondary anchoring + enforced installer check |
| "three rounds of **external review** per component" (README:34; release notes "External audit") | FDI-RESR-002 | **No** (as read by an uninformed evaluator) | "three rounds of AI-assisted review per component (see ledger AI-008 for scope)" | After the AI-008 human specialist review |
| Mirror freshness lets resolvers detect tampering "**without trusting the mirror itself**" (Registry spec §2.2) | FDI-REG-002, DOC-007 | **No** — demonstrated false | Caveat now; replace with signed checkpoints (W3) | W3 ships |
| "Given the same query and registry state, a conformant resolver **MUST return the same ranked result**" (DillClaw §3.3) | FDI-RES-003 | **No** (unscoped) | Scope to single resolver, single instant, within pinned profile, liveness excluded | After arithmetic pinning + caveat |
| Anthill = "observability plane" (specs, docs) | FDI-ANT-009/004 | Overstated | "signal store with replay protection; detection/corroboration is v2 (W4)" | W4 |
| "enforces nonce + node-sequence **replay protection**" (README:11) | FDI-ANT-001/002 | Technically true, materially misleading alone | Keep, but always pair with the unauthenticated-submitter disclosure (README does this now, post-`b7fab11`) | W1 |
| "immutable"/"append-only" audit log | FDI-XST-002 | Docs already say "by convention" — keep that discipline everywhere | — | W3 (Merkle/transparency log) |
| Revocation propagation ≤60 s (DillClaw §7.5) | FDI-RES-008 | Mostly — benign case documented and tested | Add: jittered bound (~60 s ±20 %) and the adversarial stale-window freeze (≤30 min) | W3 freshness checkpoints |
| "19/19 passing" integration tests (README:20) | — | Yes (suite exists; pass count is the project's claim, consistent with tracker) | — | — |
| "Multi-organization ready" | — | **Never claimed** — to the project's credit; keep it that way until W2+ | — | — |
| "v1 ship-verified baseline" table (README) | FDI-XST-007 | Ambiguous post-W0 | Note that repo HEAD includes post-v1.0.0 W0 behavior at unchanged component versions | After version-mapping rule |

---

## 14. Prioritized remediation plan

### A. Immediate documentation maintenance (days; mostly blocks evaluation credibility)
| # | Action | Findings | Priority | Evidence of completion |
|---|---|---|---|---|
| A1 | Add the §8 banner to the four 2026-06-10 review docs + doc-set review + strategic eval; link this index from `docs/README.md` | FDI-DOC-001 | **P0** | Banners present; index linked |
| A2 | Commit the two cited steward reports into `docs/` (or annotate the three commits' finding IDs with substance) | FDI-DOC-005 | **P0** | `docs/steward-report-2026-06-10-r3.md` + `…-06-11.md` exist |
| A3 | Fix series totals (docs/README, ledger); fix `anthill/README.md` version prose; refresh ledger AI-003 header and tracker header; scope README test counts | FDI-DOC-003/004/010/011 | P1 | Greps return corrected text |
| A4 | Qualify "external review" wording in README + release notes | FDI-RESR-002 | P1 | Wording cites AI-008 |
| A5 | Finish repo hygiene: ignore `resolver/traces/`, prune corpus, decide lockfile | FDI-OPS-003 | P1 | Clean `git status` after a service run |
| A6 | Add version-mapping note (spec ↔ impl ↔ release; W0 delta vs v1.0.0 tarballs) | FDI-XST-007 | P1 | Mapping table in README or docs |

### B. Near-term implementation (weeks)
| # | Action | Findings | Priority | Blocks |
|---|---|---|---|---|
| B1 | Resolver `If-None-Match`/304 client — the missing W0 half; small change, server side done | FDI-RES-001, DOC-008 | **P0** | Realizes W0's headline outcome; clears K1 |
| B2 | Async/bounded/rotated trace sink + 72 h retention; surface write failures | FDI-RES-004 | **P0 for Profile B** | Public resolver |
| B3 | Fail-closed token defaults + non-wildcard CORS on mutating endpoints (or formally re-scope to W1 and fix the v2-design W0 row) | FDI-XST-004 | P1 | Public resolver; closes K4 |
| B4 | Spec consistency round 7 over the W0 surface: Anthill spec rate limiting; Registry §2.2 caveat; DillClaw §3.3 scoping; §7.5 jitter note | FDI-DOC-006/007, RES-003, RES-008 | P1 | Claim safety |
| B5 | Installer fails on trust-root SHA mismatch; publish configuration reference | FDI-CRY-006, OPS-005 | P1 | Independent deployment |
| B6 | TLS guidance + `docs/threat-model.md` per Issue #2 | FDI-OPS-001/002 | P1 | Public resolver gate |

### C. Protocol design (before/with W1–W3)
| # | Action | Findings | Priority |
|---|---|---|---|
| C1 | Pull Anthill canonical serialization + test vectors into W1; decide Phase-B canonicalization (doc-set review D1/D2) **before any W1 code** | FDI-XST-006, CRY-002 | **P0 for W1** |
| C2 | W1: node enrollment + mandatory verified `node_signature`; per-registrant identity; signer externalization | FDI-ANT-001/002/003, ID-001/002/003, CRY-003 | P0 (v2 keystone) |
| C3 | Mirror sync protocol + signed checkpoints; pin `/list` serialization (the mirror gap report is the requirements doc) | FDI-REG-002, XST-003 | P1 — also the prerequisite for recruiting any external operator |
| C4 | W2: signed `registration_date` + tier attestation + JCS (assign JCS an owner; state the v1-verifier transition) | FDI-CRY-001/002, ID-004 | P1 |
| C5 | Assign delegation/counter-signature a wave; adopt real TUF/Rekor or record why not (doc-set review D3) | FDI-CRY-004, XST-002 | P1 |
| C6 | Adopt the unmapped spec-gap top-10 items (error precedence, semver grammar, trust-signal vocabulary, probe mechanics, /health schemas) into a spec backlog | FDI-XST-003 | P2 (but **blocks any second implementation**) |

### D. Institutional / governance
| # | Action | Findings | Priority |
|---|---|---|---|
| D1 | Execute GSP-01 instruments (CDI, sealed materials); attest in ledger | FDI-GOV-002 | P1 |
| D2 | Commission the AI-008 specialist crypto review (questions A–D) | FDI-RESR-003 | P1 — gate for any partnership ask |
| D3 | Narrowing decision per strategic eval (freeze Anthill feature work; governance docs stable-and-dormant; label Anthill a signal store) | FDI-GOV-003, ANT-009 | P2 |
| D4 | Recruit one independent mirror/resolver operator (after C3) | FDI-RESR-001, GOV-001 | P2 — highest-leverage external act |

### E. Explicitly deferred — should remain open without blocking v1 evaluation
Anthill detection/escalation engine and OTel re-layer (W4); HA/replication (W3); RFC 3161 anchoring; per-identity quotas (W4); Linux installers; SPIFFE/OIDC integration; compound semver ranges; FDI-RES-006 coalescing; FDI-OPS-006/007 cosmetics. Evaluation should assess the *designs* for these, not demand implementations.

---

## 15. Final judgments

1. **Canonical findings:** **70** (normalized from ~230 raw findings).
2. **Open:** **30** (plus the 22 deferred items, which are functionally open but scheduled).
3. **Partially closed:** **6**.
4. **Fully closed:** **5** (FDI-REG-004, FDI-RES-002, FDI-RES-009, FDI-DOC-002, and the install-test series FDI-OPS-008) — plus one superseded, one not-a-defect, one unverified.
5. **Accepted for v1:** **4**.
6. **Deferred to v2:** **22**.
7. **Three greatest current risks:** (1) **FDI-ANT-001** — unauthenticated, forgeable governance signals (the CRITICAL), with its suppression/framing corollaries; (2) **FDI-ID-001 + FDI-XST-004** — fail-open shared-token writes on a `0.0.0.0` bind with wildcard CORS: the one chain that turns network access into *validly signed* capability impersonation (F-6); (3) **FDI-CRY-001 + FDI-ID-004** — the trust score's two heaviest inputs (history 30 %, tier 40 %) are attacker-suppliable, so the system's headline number can be manufactured even where signatures verify.
8. **Three closures that best evidence engineering maturity:** (1) **FDI-RES-002** (SSRF) — layered defense (default-off + deny-list + DNS pinning + cache guard), 35 negative unit tests, an end-to-end refusal demonstration, and a spec update, all within days of the finding; (2) **FDI-RES-009/REG-003** — pagination fixed at *both* ends with an E2E 117-record proof and deterministic ordering pushed into SQL; (3) **FDI-DOC-012** — the phantom-control finding resolved by honestly *removing* the false safety claim across three documents and verifying the removal in two further rounds. (Historically, the RS-003 cross-implementation byte-equivalence fix and its retained test deserve mention.)
9. **Is the documentation set safe for outside evaluators?** **Ready with documented limitations** — *contingent on this index (and the §8 banners) shipping alongside it.* Without a disposition layer the corpus actively misleads in both directions (open findings presented as absent, closed findings presented as open). With it, the corpus is unusually evaluable; the remaining DOC items are credibility polish.
10. **Local reference stack evaluation-ready?** **Ready with documented limitations.** Installs, runs, full trust-chain lifecycle exercisable; limitations disclosed (post-`b7fab11`).
11. **Public read-only Resolver deployment-ready?** **Substantial revision required.** The project's own gate (Issue #2) is one-third met (rate limiting). TLS, threat model, fail-closed/CORS, trace retention, and caller identity remain.
12. **Registry mirror deployment-ready?** **Not presently defensible.** No synchronization protocol exists in spec or code; the one published mirror-security claim is false (FDI-DOC-007). The mirror gap report's verdict stands unchanged.
13. **Multi-organization production-ready?** **Not presently defensible** — the project says so itself; the entire v2 design is the admission. Identity (W1) and trust correctness (W2) are the keystones, and W1 has an unresolved sequencing defect (FDI-XST-006) that should be fixed on paper first.
14. **Claims to change immediately:** the "external review" wording (README + release notes); Registry spec §2.2's mirror claim (one-sentence caveat); DillClaw §3.3's unscoped determinism MUST; "observability plane" labeling for v1 Anthill; and a version-mapping note distinguishing repo HEAD from the v1.0.0 tarballs.
15. **Five highest-leverage next actions:** (1) ship this index + banners + the A-series corrections — the cheapest credibility available; (2) implement the resolver's conditional-fetch client (B1) — small code, closes the newest spec/impl contradiction, and makes W0's headline benefit real; (3) finish the dropped design-W0 items or formally re-scope them (B2/B3) — they gate the public resolver; (4) resolve the W1 prerequisites (C1: serialization into W1, JCS ownership) before any W1 code — the two places W1 would otherwise build verification on an undefined object; (5) specify the mirror protocol and commission the AI-008 specialist review (C3/D2) — the two artifacts every external-validation path runs through.

---

## 16. Appendix: source-document inventory

| Source | Baseline | Raw findings contributed |
|---|---|---|
| `README.md` (repo root) | `c999fdd` | Claims audited (§13); known-issues list (INST-008/011/012) |
| `PROJECT_LEDGER.md` | `c999fdd` | AI-001…AI-009; AUDIT-NS/RS/REG/AS series; RS-001…RS3-002; INST-001…INST-014; steward sweeps; series summary |
| `v2-tracker.md` | `c999fdd` | W0 execution record; H-3/M-1/M-3 fixes |
| `specs/*.html` (8 specs) | registry v0.1.6, dillclaw v0.1.8, anthill v0.1.3, namespace v0.4.4, governance v1.1.3, continuity v1.0.3, charter v1.0.3, overview v1.0.10 | Spec-claim verification (§2.2, §3.3, §7.1, A.11) |
| `architecture-review-registry-2026-06-10.md` | spec v0.1.5 / impl 0.2.8 | S1–S9, A1–A6 |
| `architecture-review-resolver-2026-06-10.md` | spec v0.1.7 / impl 0.1.8 | S1–S8, A1–A8 |
| `architecture-review-anthill-2026-06-10.md` | spec v0.1.3 / impl 0.1.6 | S1–S9, A1–A7 |
| `cross-service-trust-boundary-analysis-2026-06-10.md` | post-v1, pre-W0 | F-1…F-11 |
| `dillclaw-deployment-gap-report-2026-06-10.md` | spec v0.1.7 | G-1…G-28 (5 HIGH) |
| `registry-mirror-deployment-gap-report-2026-06-10.md` | spec v0.1.5 | G-1…G-24 (7 HIGH) |
| `anthill-signal-emitter-gap-report-2026-06-10.md` | spec v0.1.3 | GAP-01…; 4 blockers |
| `spec-gap-report-2026-06-10.md` | all four specs | 88 gaps, 9 blockers |
| `spec-consistency-review-2026-06-09{,-r2…r5}.md`, `-r6.md` | rolling | 8 HIGH, ≥21 MEDIUM, ~25 LOW (closed series) |
| `architecture-review-registry-vs-existing-infrastructure-2026-06-10.md`, `anthill-vs-observability-stack-2026-06-10.md` | — | Comparative findings (delegation, OTel re-layer) |
| `dillweed-v2-design-2026-06-10.md` | — | Wave plan audited (§10) |
| `documentation-set-review-2026-06-11.md` | `a6ce771` | C1–C12, A/B/C/D plans — closest precursor to this index |
| `strategic-evaluation-2026-06-12.md` | `7f09e2e` | GOV/RESR findings |
| `potential-research-areas.md`, `research-opportunities-summary.md` | `c999fdd` | Limitation disclosures verified |
| `docs/operations-runbook.md` | current | Operational evidence (scoping exemplary; no findings) |
| `docs/release-notes/v1.0.0-release-notes.md` | v1.0.0 | Release claims audited |
| GitHub Issues #1–#4 | live via `gh`, 2026-06-12 | §11 |
| GitHub release v1.0.0 assets | live via `gh` | SHAs/sizes (FDI-OPS-010) |
| Code: `registry/server.js`, `resolver/server.js`, `anthill/server.js`, `mcp-server/server.js`, `*/test.sh`, `resolver/unit-tests.js`, `integration-test.sh`, `.gitignore`, working tree | `c999fdd` | All implementation evidence in §7 |

**Evidence gaps (could not verify):** test-suite pass counts (suites not executed); release-tarball contents (FDI-OPS-010); the live dill-p-001 deployment and dillweed.com site; off-repo continuity instruments (FDI-GOV-002); the two missing steward reports (FDI-DOC-005); the resolver hot-path linear-scan sub-claim (FDI-RES-005, immaterial to disposition).

---

*Prepared 2026-06-12 against `c999fdd` by an independent review session in review-and-index mode. This document asserts findings and dispositions only as evidenced above; where evidence was insufficient, the disposition says so.*
