# Dillweed Namespace — Independent Review of the `/docs` Documentation Set

**Date:** 2026-06-11
**Reviewer role:** Independent senior systems architect / distributed-systems reviewer / security engineer / standards editor / skeptical institutional evaluator
**Reviewed at:** repo HEAD `a6ce771` (2026-06-11), specs registry v0.1.6 / dillclaw v0.1.8 / anthill v0.1.3, implementations Registry 0.2.8 / Resolver 0.1.8 / Anthill 0.1.6 (post-W0 working tree)
**Method:** every document in `docs/` read in full; claims spot-verified against `specs/*.html`, `registry/server.js`, `resolver/server.js`, `anthill/server.js`, `PROJECT_LEDGER.md`, `v2-tracker.md`, and the git history. Observed facts are marked as verified; everything else is labeled inference.
**Mode:** review-and-recommend (no project artifacts modified other than this report and its index entry)

---

## 1. Executive Summary

This is an unusually honest, unusually rigorous documentation corpus for a one-steward project — and its single biggest defect is now **timing, not content**. The review corpus (three architecture reviews, the trust-boundary analysis, four gap reports, six consistency rounds, two comparative analyses, and the v2 design) was produced 2026-06-09/10. Between then and HEAD, the **W0 hardening wave shipped and was deployed** (commits `74cad67`…`3d6b159`, ledger entry STEWARD-SWEEP-2026-06-11), closing or materially changing roughly a third of the P0/HIGH findings the documents still present as open — with **no disposition annotations anywhere in `docs/`**. An evaluator reading the trust-boundary analysis today will believe the resolver is an open SSRF proxy (F-8); in the current code, `probe_liveness` is off by default behind an internal-range deny-list with host pinning (verified, `resolver/server.js:899–959`). Conversely, the W0 spec updates introduced **new** spec/implementation divergences the corpus cannot know about (most notably: DillClaw v0.1.8 documents resolver ETag conditional fetch; the resolver contains zero `If-None-Match` handling — verified by grep).

The findings themselves verify well. I checked every CRITICAL/P0/HIGH claim against code or spec text and found **no false positives** among them; the one CRITICAL (Anthill `node_signature` accepted-but-never-verified, F-3) is confirmed in `anthill/server.js:386–399, 595` and remains open. The reviews are disciplined about exactly the confusions the corpus could have fallen into: they consistently separate reference-implementation limitations from spec defects, transport security from record authenticity, and observability from enforcement.

The v2 design is genuinely responsive — it traces nearly every architecture-review and trust-boundary finding to a concrete area and wave — but it under-covers the 88-gap spec-gap report (error precedence, semver-range grammar, and the trust-signal vocabulary are unmapped), contains at least one unstated wave prerequisite (W1 node-signature verification requires a canonical-serialization definition whose spec home, Area 3, ships in W4), and its W0 definition does not match the W0 that was actually declared complete (fail-closed defaults/CORS and async/bounded trace sinks were in the design's W0 but dropped from the tracker's task list — verified: all three services still emit `Access-Control-Allow-Origin: *`, traces are still synchronous `writeFileSync`, and 1,373 unrotated trace files sit in `resolver/traces/`).

Two items outside the documents would damage credibility with a security evaluator more than anything in them: an **Ed25519 private key sits untracked in the repo working tree** (`registry/keys/dnso_private.pem`; not the canonical root — its public half hashes to `3a7528e3…`, not `909891e9…` — and not covered by the root-anchored `keys/*` `.gitignore` pattern), and the repo README still states **"No HIGH-severity or MEDIUM-severity issues are open"** two directories above a documented CRITICAL.

**Overall: Ready for evaluation but not deployment.** The corpus needs a disposition pass and a handful of accuracy corrections, not a rewrite.

---

## 2. Document Inventory

| Document | Type | Purpose / audience | Primary claims | Depends on | Current? |
|---|---|---|---|---|---|
| `docs/README.md` | Index | Navigation for all audiences | Series totals; doc summaries | all | **Stale in two places**: repeats r5's wrong "4 HIGH and 19 MEDIUM" series total (per-round numbers sum to 8 HIGH, ≥21 MEDIUM — see §4); predates the Jun-11 spec bumps and W0 deployment |
| `operations-runbook.md` | Operational | Steward / continuity trustee | Procedures for dill-p-001 | specs (defers to them) | Yes. Exemplary scoping ("not a specification," §1) and status labeling |
| `release-notes/v1.0.0-release-notes.md` | Descriptive | Evaluators | v1 baseline, SHAs, audit rounds | ledger | Yes (frozen to release) |
| `architecture-review-registry-2026-06-10.md` | Evaluative | Architects | 9 structural findings S1–S9 | registry spec v0.1.5 + impl 0.2.8 | **Partially stale**: S3 (pagination/full-scan) and S4 (rate limiting) substantially closed by W0; scope header cites spec v0.1.5 (now v0.1.6) |
| `architecture-review-resolver-2026-06-10.md` | Evaluative | Architects | 8 findings S1–S8 | dillclaw spec v0.1.7 + impl 0.1.8 | **Partially stale**: S3 (SSRF) closed; S1 partially (jitter/backoff/pagination landed; no delta/conditional fetch); spec now v0.1.8 |
| `architecture-review-anthill-2026-06-10.md` | Evaluative | Architects | 9 findings S1–S9 | anthill spec v0.1.3 + impl 0.1.6 | Mostly current; S8 (no ingestion rate limit) closed by W0 |
| `cross-service-trust-boundary-analysis-2026-06-10.md` | Security/evaluative | Security reviewers | 1 CRITICAL, 4 HIGH, 4 MED, 2 LOW | all specs + impls | **Partially stale**: F-8 closed, F-10 closed, F-9 partially open; F-3 (CRITICAL) confirmed still open |
| `architecture-review-registry-vs-existing-infrastructure-2026-06-10.md` | Comparative | Standards/enterprise | Niche is novel; delegate plumbing | registry review | Yes; strongest document in the set |
| `anthill-vs-observability-stack-2026-06-10.md` | Comparative | Architects/operators | "Re-layer, don't rewrite" | anthill review | Yes |
| `dillclaw-deployment-gap-report-2026-06-10.md` | Evaluative (implementer experience) | Deployers | 28 gaps, 5 HIGH | spec v0.1.7, README, install.sh | Mostly current (no configuration-reference section was added in v0.1.8) |
| `registry-mirror-deployment-gap-report-2026-06-10.md` | Evaluative | Mirror operators | "No happy path at all"; 24 gaps, 7 HIGH | registry spec v0.1.5 | Current — none of the mirror gaps were touched by W0 (verified: mirror mode is still the env-var echo, `registry/server.js:598–600`) |
| `anthill-signal-emitter-gap-report-2026-06-10.md` | Evaluative | Third-party emitter | Conformant emitter impossible; 4 blockers | anthill spec v0.1.3 | Current (anthill spec unchanged) |
| `spec-gap-report-2026-06-10.md` | Evaluative (clean-room) | Second implementers | 88 gaps, 9 blockers | all four specs | Mostly current; REG-22 partially closed (v0.1.6 documents `/list` default limit 100) |
| `spec-consistency-review-2026-06-09{,-r2..r5}.md`, `-2026-06-10-r6.md` | Historical record (closed series) | Auditors | 6-round raise/fix/verify cycle | specs + impls at each HEAD | Closed and internally well-disposed; r5/r6 carry the series-total arithmetic error |
| `dillweed-v2-design-2026-06-10.md` | Forward-looking design | All | 6 areas, 5 waves, migration paths | entire review corpus | Current as a design; its W0 ≠ shipped W0 (see §4) |

Load-bearing documents **outside** `docs/`: `PROJECT_LEDGER.md` (audit trail), `v2-tracker.md` (W0 execution record), repo `README.md`. Also note: `v2-tracker.md` and the ledger cite **`steward-report-2026-06-10-r3` and `reports/steward-report-2026-06-11.md`, neither of which is in the repository** — post-W0 fixes (`d1466c0`, `8c87a85`) reference findings H-3/M-1/M-3 from a review document an evaluator cannot read.

**Missing document categories:** (a) a **disposition/status index** mapping every published finding to open/closed/superseded — the most important gap in the set; (b) a standalone **threat model** (currently embedded in the trust-boundary analysis); (c) a **conformance mapping** (test-case ↔ spec-section; flagged as G-28 but never produced); (d) in-repo summaries of **Issues #2 and #4**, which the README makes evaluation gates (gap report G-27); (e) any documentation of **`mcp-server/`** beyond its own README; (f) a **security/vulnerability-disclosure policy**; (g) an operator-facing **v1→v2 migration guide** separate from the design document.

---

## 3. Top Findings

1. **(HIGH, accuracy/staleness)** No review document carries a post-W0 disposition. F-8, F-10, Registry S3/S4, Resolver S1(partial)/S3, Anthill S8 are fixed in deployed code but presented as open in four documents. The corpus's own consistency series proved the project knows how to do disposition tables (r2–r6); the architecture/trust-boundary docs need the same one-page annex.
2. **(HIGH, new spec/impl divergence)** DillClaw spec v0.1.8 §7.1 says the resolver "SHOULD send If-None-Match," and its revision note describes "pagination-to-completion via /list **with ETag conditional fetch**" as part of the W0 pass — but `resolver/server.js` contains no ETag/If-None-Match/304 logic at all (verified). The registry's W0 ETag support therefore has **zero consumers**; the v2 design's W0 headline ("removes the worst of the polling cost") is not realized — every 60s refresh still transfers the full catalog.
3. **(MEDIUM, new spec/impl divergence)** The DillClaw v0.1.8 revision note claims per-IP rate limiting is "documented across all three services," but `anthill-spec.html` (still v0.1.3) contains no mention of rate limiting or 429 (verified: zero matches), while `anthill/server.js` now enforces it. The exact defect class the consistency series flagged three times ("fix lands in one document, echoes missed") recurred in the W0 spec update with no round-7 verification pass.
4. **(HIGH, repo hygiene / evaluator trust)** `registry/keys/dnso_private.pem` is untracked-but-present in the working tree and **not covered** by `.gitignore` (the `keys/*` pattern is anchored to the repo root). It is a dev/test key, not the canonical root (public-half SHA `3a7528e3…` ≠ `909891e9…`), but one `git add -A` away from publishing a private key in a trust-infrastructure repo. Likewise 1,373 untracked trace files in `resolver/traces/` — which simultaneously proves Resolver review S5 (no retention, unbounded growth) is still true in production.
5. **(MEDIUM, positioning)** Repo `README.md` "Evaluation readiness": "No HIGH-severity or MEDIUM-severity issues are open." Read in context it means *install-test (INST-\*) findings as of v1.0.0*, but as written it is contradicted by the CRITICAL and four HIGHs in `docs/cross-service-trust-boundary-analysis-…`. The README's test counts (79/79, 65/65+29/29, 58/58) also no longer match the current suites (98/98, 77/77, 62/62 per `v2-tracker.md`).
6. **(MEDIUM, published overclaim)** Registry spec §2.2 (current v0.1.6) still claims mirror freshness fields let resolvers detect tampered mirrors "**without trusting the mirror itself**" — demonstrated false by the mirror gap report (G-11, reasoning verified: both fields are mirror-computed). The fix is scheduled for v2 W3, but the false security claim remains in a *published* spec with no caveat.
7. **(MEDIUM, v2 sequencing)** W1 ships Anthill node-signature **verification**, but the canonical serialization + test vectors it verifies against (emitter GAP-02 / ANT-02) are an Area 3 spec deliverable scheduled in W4. Verification cannot precede the definition of what is signed. Either the serialization spec must be pulled into W1 or the wave table is wrong.
8. **(LOW, arithmetic)** r5/r6 and `docs/README.md` state the series raised "4 HIGH and 19 MEDIUM"; the rounds' own counts (r1: 4H/9M, r2: 3H/10M, r3: 1H/2M new) sum to 8 HIGH and ≥21 MEDIUM. All were resolved, so the substance stands — but a checkable arithmetic error in the headline of a rigor-selling index is exactly what a hostile reviewer will find first.

---

## 4. Cross-Document Contradiction Table

| # | Documents & passages | Nature | Classification |
|---|---|---|---|
| C1 | DillClaw spec v0.1.8 §7.1 + revision note vs `resolver/server.js` (no conditional fetch) | Spec describes/implies behavior the reference impl lacks | **Version drift (new, post-corpus)** |
| C2 | DillClaw v0.1.8 rev note ("documented across all three services") vs `anthill-spec.html` v0.1.3 (no 429/rate limiting) vs `anthill/server.js` (enforces it) | One-document fix, echo missed | **Direct contradiction** |
| C3 | Registry spec §2.2 "without trusting the mirror itself" vs mirror gap report G-11 | Security property not achievable as specified | **Unresolved design choice** (v2 W3 fixes; spec not yet caveated) |
| C4 | v2 design W0 row (includes "fail-closed, CORS," "async/bounded/rotated sinks + retention") vs `v2-tracker.md` W0 task list (6 tasks, explicitly excludes both) vs ledger "W0 deployed" | "W0 COMPLETE" is true of the tracker's W0, false of the design's W0 | **Terminology/scope drift** — the highest-risk one, since "W0 closes F-9" is now half-true (CORS `*` persists on all three services — verified) |
| C5 | Repo README "No HIGH-severity or MEDIUM-severity issues are open" vs trust-boundary F-3 (CRITICAL) | Unscoped claim | **Direct contradiction** (fix is one scoping clause) |
| C6 | Repo README test counts vs current suites (v2-tracker) | Counts pinned to v1.0.0 tarballs, presented as current repo instructions | **Version drift** |
| C7 | docs/README + r5 §Series Status "4 HIGH, 19 MEDIUM raised" vs r1–r3 per-round counts | Arithmetic | **Direct contradiction (minor)** |
| C8 | Trust-boundary F-8/F-10, Registry review S3/S4, Resolver review S1/S3, Anthill S8 (presented open) vs W0 commits `4447c00`, `d1466c0`, `a1a95d1`, `25670a4`, `d25bf7b` | Findings closed after publication | **Obsolete findings already addressed elsewhere** — need annotations, not edits |
| C9 | v2 design §1.4 "pair it with the JCS migration in **Area 6**" vs Cross-Cutting section (JCS is cross-cutting, "pairs with Areas 1, 5, 6") vs wave table (JCS in W2) | JCS has no owning area | **Internal pointer inconsistency / unresolved ownership** |
| C10 | DillClaw §3.3 determinism MUST (current spec text verified: "Given the same query and registry state… MUST return the same ranked result") vs Resolver review S4, gap G-20, spec-gap RES-12 | Guarantee unscoped against wall-clock usage score + per-process liveness cache | **Unresolved design choice**, acknowledged in v2 cross-cutting but not yet caveated in the published spec |
| C11 | Registry impl behavior changed materially in W0 (429s, pagination, ETags) while `VERSION` stayed 0.2.8; spec bumped 0.1.5→0.1.6 | Spec-version↔impl-version mapping (XC-03/G-19) now actively worse | **Version drift** |
| C12 | Resolver review S6 ("the `byName` index exists but `resolveQuery` doesn't use it") — minor: not re-verified this session | — | Carried as stated (inference) |

The big-ticket items — authoritative vs mirror, revocation propagation, trust-score semantics, key hierarchy, tamper-evident logging, Anthill's role, OTel, v1-vs-v2 — are **described consistently** across the corpus. The documents agree with each other on what is broken; the contradictions above are almost all between the corpus and the *moving* spec/code surface, not within the corpus.

---

## 5. Major-Finding Verification Table

Every CRITICAL / P0 / HIGH finding, verified against the current tree:

| Finding | Source | Verified? | Status at HEAD | Notes |
|---|---|---|---|---|
| F-3 `node_signature` never verified (CRITICAL) | trust-boundary | ✅ code (`anthill/server.js:386–399`: type-check only, optional) | **OPEN** | Accurate, including the spec-MUST vs impl-optional distinction. Remedy (verify against enrolled keys) is correct and v2 W1 adopts it |
| F-1 / Reg-S6 / r1-H-3 unsigned `registration_date` (HIGH) | trust-boundary, registry review | ✅ code (`canonicalJSON` 10 fields, `registry/server.js:161–166`; `body.registration_date \|\| today` at :858) | **OPEN** (W2) | Accurate. Disclosed in DillClaw §6.2 security note — the docs correctly track this as documented-not-fixed |
| F-2 self-assigned tier scored at face value (HIGH) | trust-boundary, r2-H-2 | ✅ spec history (r4 downgraded Registry §7 to candid future-work) | **OPEN by disclosed design** | The corpus handled this well: detected, then honestly downgraded rather than left as a phantom control |
| F-4 sequence-counter poisoning (HIGH) | trust-boundary | ✅ follows from F-3 | **OPEN** | Correct derivation |
| F-6 open-writes → signed impersonation (HIGH, conditional) | trust-boundary | Consistent with code defaults (token-optional, binds 0.0.0.0 — verified bind) | **OPEN** (fail-closed defaults deferred from W0) | The "conditional" qualifier is properly carried |
| F-8 SSRF via `probe_liveness` (P0/MED) | trust-boundary, resolver S3 | ✅ **fix verified**: off-by-default, deny-list incl. 169.254/16, resolved-IP pinning (`resolver/server.js:899–959`) | **CLOSED (W0)** | Doc stale; auth requirement + quota still W1 |
| F-10 500-record `/list` truncation | trust-boundary | ✅ fix verified (pagination-to-completion, `resolver/server.js:238–267`) | **CLOSED** (`d1466c0`) | |
| F-9 wildcard CORS + open writes | trust-boundary | ✅ `ACAO: *` persists on all three services | **OPEN** | v2 design said W0 closes F-9; it did not (C4) |
| F-7 stale-window revocation freeze | trust-boundary | Consistent (stale window unchanged) | **OPEN** (W3) | Note: W0 jitter slightly *widens* worst-case propagation (integration test wait raised 70s→90s) — no doc mentions this trade-off |
| Registry S1/S2 single instance; mirror is a shell (P0) | registry review, mirror gap | ✅ mirror mode still rejects writes + echoes env vars (`registry/server.js:598–600`) | **OPEN** (W3) | The strongest verified claim in the set: the spec's only HA mechanism has no implementation |
| Registry S3 `/list` full-scan, no conditional fetch (P0) | registry review | ✅ fix verified server-side (SQL LIMIT/OFFSET, ETag/304, tag index) | **PARTIALLY CLOSED** | Remaining: no delta feed; no client consumes the ETag (C1) |
| Registry S4 no rate limiting (P1) | registry review | ✅ per-IP limiter, 429+Retry-After | **LARGELY CLOSED** | Per-identity/cost-weighted quotas correctly remain W4 |
| Registry S5 root key in HTTP process (P1) | registry review | ✅ `fs.readFileSync(PRIVKEY_PATH)` at :157 | **OPEN** (W1/W2) | |
| Registry S7 shared god-token / spoofable `caller` (P1) | registry review | Consistent | **OPEN** (W1) | |
| Registry S9 / Anthill S6 logs append-only by convention | reviews | Consistent (no chaining anywhere) | **OPEN** (W3); the *async-sink* half was a design-W0 item that did not ship | |
| Resolver S1 full-catalog poll, herd (P0) | resolver review | ✅ jitter+backoff verified (`refreshDelay`, :179–187) | **PARTIALLY CLOSED** | No delta; no conditional GET (client side) |
| Resolver S2 no auth, no rate limit (P0) | resolver review | ✅ rate limiting landed; no auth | **PARTIALLY CLOSED** (auth = W1) | |
| Resolver S4 determinism not achievable as specified (P1) | resolver review, G-20, RES-12 | ✅ spec §3.3 text unchanged at v0.1.8 | **OPEN** | v2 cross-cutting commits to scoping it; the published spec still overclaims |
| Resolver S5 sync unbounded traces (P1) | resolver review | ✅ `writeFileSync` at :1245; 1,373 files on disk | **OPEN** — and was nominally in design-W0 | |
| Anthill S1/S2/S3 (P0 identity & single-writer) | anthill review | ✅ confirmed | **OPEN** (W1/W4) | |
| Anthill S8 no ingestion rate limit (P1) | anthill review | ✅ limiter present | **CLOSED in code**, undocumented in anthill spec (C2) | |
| Spec-gap blockers REG-01/02/21, RES-03/08/12, ANT-01/02, XC-01 | spec-gap report | Spot-checked REG-01/02 (canonicalJSON = `JSON.stringify`), RES-12 (formula pinned, FP arithmetic not) | **ALL OPEN** | v2 maps REG-01/02/21, RES-12, ANT-01/02, XC-01; **RES-03 and RES-08 (and REG-17) are unmapped** |
| Deployment gaps G-1/G-2/G-3 (config reference, TTL knobs, SHA enforcement) | dillclaw deployment gap | v0.1.8 revision note adds none of them | **OPEN** | The report's #1 recommended fix (configuration reference) was not picked up by the W0 spec pass |

**False positives / overstatements:** none found among the HIGH+ set. The corpus even documents its *own* reviewer false positives (resolver final-pass "trivial duplicates" disproven in the ledger; r6 notes three of five fix cycles introduced a new defect or overclaimed). Two judgment calls are presented slightly harder than the evidence: Anthill review A2's "cannot ship 'observability' without it" is opinion (correct opinion, in my view, but it's framing, not finding), and the mirror gap report's "categorically worse outcome" headline is rhetoric the evidence nonetheless supports. The reviews do **not** confuse reference-impl limits with spec defects (S2's "specified but not implemented" framing is exactly right), transport with record authenticity (the B1–B4 table is explicit), observability with enforcement, or standing with authorization (DillClaw §6.4's "Resolution vs. Authorization" boundary is respected everywhere).

---

## 6. v2 Traceability Matrix

| Finding | Source doc | v2 response | Fully resolved? | Remaining concern |
|---|---|---|---|---|
| Shared-token identity (Reg S7, Anth S1/S2, F-3/4/5/6) | reviews, trust-boundary | Area 1 (delegation, dual sig, node keys, mTLS), W1–W2 | Design: yes | Phase B accepts registrant signatures over **pre-JCS** canonicalization; W2 changes canonicalization — re-sign/invalidate window unaddressed |
| `node_signature` verification | F-3, AI-005 | Area 1.2.4, W1 | Design: yes | **Unstated prerequisite:** canonical serialization + test vectors (GAP-02) live in Area 3 spec work, scheduled W4 |
| Unsigned `registration_date` (F-1/S6) | trust-boundary | signed-set addition + expiry/renewal chain, W2 | Yes | Breaking change correctly paired with JCS; JCS itself has no owning area (C9) |
| Tier face-value scoring (F-2) | trust-boundary, r2-H-2 | Resolver verifies DNSO attestation, W2 | Yes | Requires a new scoring profile (`dillclaw-default-v1` is pinned) — design doesn't say so; the r2 review did |
| Full-catalog polling / mirror shell (Reg S1/S2/S3, Res S1, mirror G-1..G-18) | reviews, mirror gap | Area 2 (ETag, delta-by-cursor, signed checkpoints, import path, HA posture), W0+W3 | Mostly | W0's ETag half shipped server-side only (C1); delta feed `/log?since=` assumes log replication semantics the mirror gap report (G-3) showed are undefined — Area 2.4 does cover it |
| SSRF / rate limiting (F-8/F-9, S4/S8) | trust-boundary | Area 4, W0+W4 | F-8 yes; F-9 **no** | Fail-closed/CORS dropped from shipped W0 with no updated claim |
| Key custody (Reg S5, Res S8) | reviews | Area 5 (offline root, intermediate, TUF metadata, expiry), W1–W2 | Yes | "TUF-style" custom metadata — recommend actual TUF or a stated reason why not |
| Logs by convention (Reg S9, Anth S6, Res S5) | reviews | Area 6 (RFC 6962/Rekor, RFC 3161, async sinks), W0+W3 | Design: yes | Async-sink/retention half of W0 not shipped; trace growth ongoing (observed) |
| Anthill parallel-stack problem | anthill-vs-OTel | Area 3 re-layering, W4 | Yes | Sequencing realistic only if GAP-01 schemas land before W1 signature work needs them |
| Spec-gap blockers REG-01/02, XC-01, RES-12/13, REG-26/RES-23, XC-04 | spec-gap report | Cross-cutting section | Yes (named explicitly) | — |
| **RES-03 (semver-range grammar), RES-08/09/10 + REG-17 (error precedence), RES-14 (trust-signal vocabulary), RES-15 (probe mechanics)** | spec-gap report | **Absent from v2 design** | **No** | These are 4 of the spec-gap report's own top-10 remediation list (#4, #5, #8, #9); they block second implementations regardless of v2 architecture |
| Mirror §2.2 overclaim (G-11) | mirror gap | Checkpoints replace the mechanism (2.2.3) | Architecture: yes | Interim spec caveat not scheduled anywhere |

**Sequencing realism (inference):** the dependency ordering (identity → trust correctness → scale/transparency → observability) is technically sound and the per-area migration phases are credible. The risk is scope, not order: W1–W4 collectively introduce OIDC trusted publishing, ACME-style name proof, an intermediate-CA ceremony model, TUF metadata, a Merkle/Rekor log, and an OTel re-platform — for a project with one steward and a 2026.Q4 "Stack Family target." Nothing in the corpus addresses staffing/throughput; an institutional evaluator will ask.

**Breaking compatibility:** handled honestly — JCS and signed-field changes are flagged as breaking with a dual-signature window. The one missing statement: what happens to v1.0.0 release tarball consumers during W2 (old resolvers verifying old-canonicalization signatures against re-signed records).

---

## 7. Institutional-Readiness Assessment

**What works (and is rare):** the raise→fix→verify→re-verify discipline with per-round disposition tables; honest downgrade of phantom controls (r4-H-2) rather than silent deletion; the ledger's self-contained decision records; SHA-pinned releases with verification instructions; the runbook's explicit "not a specification" scoping; spec revision notes; Apache-2.0 + NOTICE clarity; and the gap reports' willingness to say "No — a conformant emitter cannot be implemented" about the project's own spec. The candor is the project's best institutional asset and the docs say so themselves (registry-vs-infrastructure §2.4).

**What would make a serious evaluator stumble or distrust:**

1. **No disposition layer.** The corpus is a snapshot presented as current. An evaluator cannot tell, from `docs/` alone, that F-8 is closed and F-3 is not. (Highest-impact fix in this report.)
2. **Dangling evidence pointers.** `v2-tracker.md` and the ledger cite `steward-report-2026-06-10-r3` and `reports/steward-report-2026-06-11.md`; neither is in the repo, yet three remediation commits cite their finding IDs. The audit chain breaks exactly where it matters.
3. **README credibility gaps** (C5, C6): the "no HIGH/MEDIUM open" sentence and stale test counts.
4. **External gates:** evaluation steps 5–6 point to GitHub Issues #2/#4 with no in-repo summary (G-27 flagged this; unaddressed).
5. **Repo hygiene:** untracked private key, 1,373 trace files, committed `.DS_Store` files, `docs/README.md` and the r4 review at mode 0600 (others 644), untracked `registry/package-lock.json`. None is individually serious; together they read as a working machine, not a reviewable artifact.
6. **Provenance/ownership:** most docs are agent-authored with steward-boundary footers (good transparency), but no document states who approved publication or owns each document's lifecycle. The runbook names an author; the reviews name an agent role.
7. **Reproducibility:** test evidence is strong for the steward's machine; there is no CI, no Linux path (G-5/G-10), and "conformant" has no test↔spec mapping (G-28). An independent deployment can reproduce the happy path on macOS only.
8. **Terminology** is otherwise consistent and well-defined across documents (tier names, signal classes, cache vocabulary) — the consistency series visibly earned this.

---

## 8. Claims Assessment

| Claim | Assessment |
|---|---|
| "Publicly verifiable trust root" | **Plausible but needs narrowing.** Record signatures are verifiable against a published key — true. But the root's authenticity reduces to one HTTPS endpoint + a README SHA (the comparative doc itself says the WebPKI cert for dillweed.com is the de-facto root). Say: "publicly *published* trust root; record signatures independently verifiable against it." DNSSEC/DANE anchoring is correctly listed as future work |
| "Capability standing" | **Well supported.** DillClaw §6.4's Resolution-vs-Authorization boundary is exactly the right narrowing and is consistently respected |
| "Deterministic resolution" | **Overstated in the published spec.** §3.3's unscoped MUST is contradicted by wall-clock usage scoring, per-process liveness cache (S4/G-20), and unpinned FP arithmetic (RES-12). The v2 design admits this; the spec doesn't yet. Narrow to "deterministic within a profile, for a single resolver at a single evaluation instant" |
| "Observability plane" | **Overstated for v1.** The implementation stores and counts; detection/escalation/corroboration are unbuilt. The Anthill review's own recommendation — "label the service a signal store, not an observability plane" — should be adopted in evaluator-facing text until W4 |
| "Continuity" | **Plausible.** The runbook's successor-readability framing and the ledger's self-contained entries are real evidence; the Continuity Protocol spec exists. Not independently exercised |
| "Neutral cross-vendor infrastructure" | **Aspirational.** One steward, one org, zero second implementations, and a spec-gap report proving a second implementation is currently impossible. The docs are honest about this; outward-facing text should say "designed for" neutrality, not claim it |
| "Production-grade" | Largely **not claimed**, to the project's credit — reviews say "close to production-quality at N=1" with explicit gates. Keep it that way |
| "Independent evaluation readiness" | **Mixed.** The corpus is genuinely evaluable; the README's unscoped "no HIGH/MEDIUM open" undercuts it |
| "Tamper evidence" | **Overstated in one place:** Registry §2.2's mirror claim (C3). Elsewhere the docs are scrupulous ("append-only by convention") |
| "Revocation freshness" | **Supported with caveats** — the 60s bound is documented (§7.5) and tested; the adversarial freeze (F-7, up to 30 min) and the new jitter-widened bound (~90s test wait) deserve one sentence in §7.5 |
| "Multi-organization deployment" | **Correctly claimed as not yet possible** — the entire v2 document is the admission. No correction needed |

---

## 9. Prioritized Remediation Plan

### A. Immediate documentation fixes (no architectural change)

| # | Action | Severity | Affected | Blocks |
|---|---|---|---|---|
| A1 | Add a one-page **finding-disposition annex** (or header banners) to the three architecture reviews and the trust-boundary analysis: F-8/F-10/S3/S4/Res-S3/Anth-S8 → closed by W0 commits; everything else → open with target wave | HIGH | 4 docs + docs/README | **Blocks evaluation** (evaluators act on stale severity) |
| A2 | Fix repo README: scope "No HIGH/MEDIUM open" to INST-\* install findings; refresh or version-pin test counts; note W0 delta vs v1.0.0 tarballs | HIGH | README.md | Blocks evaluation (credibility) |
| A3 | Commit the two steward reports (`…-06-10-r3`, `…-06-11`) into `docs/` or strip the references | MEDIUM | v2-tracker, ledger | Blocks evaluation (broken audit chain) |
| A4 | Correct the series totals ("4 HIGH, 19 MEDIUM" → actual) in r5, r6, docs/README | LOW | 3 docs | Credibility |
| A5 | Repo hygiene: extend `.gitignore` (`**/keys/*`, `resolver/traces/`), remove the dev private key from the tree, drop `.DS_Store`s, normalize file modes | HIGH (preventive) | repo | Blocks public-repo confidence |
| A6 | Summarize Issues #2 and #4 in-repo; stop gating evaluation on external links | MEDIUM | README, docs/ | Blocks evaluation |
| A7 | Update docs/README to note current spec versions (registry 0.1.6, dillclaw 0.1.8) vs the versions reviewed | LOW | docs/README | — |

### B. Specification changes (normative)

| # | Action | Severity | Affected | Blocks |
|---|---|---|---|---|
| B1 | Anthill spec: document rate limiting/429 (match the other two) and bump/notate the version — or revert the dillclaw rev-note claim | MEDIUM | anthill-spec | Spec/impl coherence |
| B2 | Registry §2.2/§10.3: restate the mirror-freshness security claim honestly (mirror gap fix #5) pending W3 checkpoints | MEDIUM-HIGH | registry-spec | Blocks any third-party mirror; blocks "tamper evidence" claim |
| B3 | DillClaw §3.3: scope the determinism guarantee (single resolver, single instant, within profile; liveness excluded) — the v2 cross-cutting decision, applied now as a caveat | MEDIUM | dillclaw-spec | Blocks "deterministic resolution" claim |
| B4 | Adopt the spec-gap report's unmapped top-10 items into a spec backlog: error-precedence tables (REG-17/RES-08/09/10), semver-range grammar (RES-03), trust-signal vocabulary (RES-14), probe mechanics (RES-15), `/health` schemas (REG-26/RES-23) | MEDIUM | registry + dillclaw specs | **Blocks any second implementation** — independent of v2 architecture |
| B5 | DillClaw configuration reference (deployment gap fixes #1, #4): env vars, `registry.json`, `.env.example`, `/health` example | MEDIUM | dillclaw-spec or README | Blocks independent deployment |

### C. Reference-implementation fixes

| # | Action | Severity | Blocks |
|---|---|---|---|
| C1 | Resolver: send `If-None-Match` / handle 304 on `/list` refresh (the missing client half of W0; ~small change, the server side is done) | MEDIUM-HIGH | The W0 "polling cost" outcome; fleet-scale claims |
| C2 | Finish design-W0: async/bounded/rotated trace sink + 72h retention (S5); fail-closed token defaults and non-wildcard CORS on mutating endpoints (F-9) — or formally re-scope these to W1 and update the v2 design's W0 row | MEDIUM | Public resolver deployment |
| C3 | Anthill: require `node_signature` field presence (verification can still wait for W1) per r2-M-7's alternative | LOW-MEDIUM | — |
| C4 | Installer: fail on trust-root SHA mismatch (deployment gap G-3) | MEDIUM | Independent deployment safety |

### D. v2 architectural decisions needed before W1

| # | Decision | Why |
|---|---|---|
| D1 | Pull the Anthill canonical-serialization + test-vector spec (GAP-02) into W1, ahead of signature verification | W1 verify is otherwise unimplementable (§6) |
| D2 | Assign JCS an owning area/wave and define the Phase-B→W2 registrant-signature transition (what canonicalization Phase B signs over) | Avoids signing twice or invalidating early adopters |
| D3 | Decide real TUF vs "TUF-style" for root metadata, and Rekor vs RFC 6962 library, before any code | The comparative docs' own argument: adopt, don't imitate |
| D4 | Confirm whether per-identity quotas are W1-incremental (Area 4 migration step 3) or W4 (wave table) — the design says both | Sequencing clarity |

### E. Items that should remain explicitly deferred (do not block v1 evaluation)

- Anthill detection/escalation/correlation engine and the OTel re-layer (W4) — correctly deferred; v1 should be *labeled* a signal store meanwhile.
- HA/replication for Registry and Anthill (W3) — the single-hardened-instance posture is a legitimate founding-phase choice once stated in the spec (Area 2.2.6 does this).
- RFC 3161 timestamping, completeness attestation, SPIFFE bindings, MCP manifest mapping, Linux installers — all properly tracked as future work.
- Per-identity quotas, registrant delegation, expiry/renewal — W1/W2; v1 evaluation should assess the *design*, not demand the implementation.

---

## 10. Final Verdicts

1. **Internally coherent?** **Ready with minor corrections.** The corpus tells one consistent architectural story; the contradictions are almost entirely corpus-vs-moving-target (C1–C8), fixable with a disposition pass and three spec caveats.
2. **Honest about v1 maturity?** **Ready with minor corrections.** The review corpus is exceptionally honest — more candid about its own gaps than most production systems' docs. The two exceptions (README's unscoped "no HIGH/MEDIUM open"; Registry §2.2's mirror claim) are correctable in an afternoon.
3. **v2 design responsive to the major findings?** **Ready with minor corrections.** Every architecture-review and trust-boundary HIGH maps to an area and wave; gaps are the spec-gap long tail (B4), one wave-prerequisite error (D1), and a W0 definition that no longer matches what shipped (C4).
4. **Ready for independent academic critique?** **Ready with minor corrections** — items A1–A4 first, because academics will read the stale findings as current. The spec-gap and gap reports are, unusually, *assets* for academic review: they are pre-written falsifiable claims.
5. **Ready for a public read-only Resolver?** **Substantial revision required** (code, not documents): no caller auth, wildcard CORS, plaintext HTTP with no shipped TLS guidance, unbounded synchronous trace writes, and the README's own Issue-#2 gate. W0 closed the worst single item (SSRF); W1 plus C2 is the honest bar.
6. **Ready for multi-organization production deployment?** **Not presently defensible — and the project says so itself.** Shared-secret identity (F-3/S7), no mirror sync, no delegation. This is the v2 design's explicit premise; the verdict matches the project's own.
7. **Distinctive claims defensible?** **Ready with minor corrections.** The genuinely distinctive core — signed behavioral contracts, governed trust tiers with a consuming scorer, audit log as protocol obligation, and the adversarial-reporter signal taxonomy — survives comparison scrutiny; both comparative documents argue it fairly and concede everything else to existing infrastructure. Narrow the four overstated phrases (determinism, observability plane, mirror tamper-evidence, verifiable trust root) and the claim set is sound. The one missing comparison: a direct treatment of **MCP/A2A as discovery ecosystems** (MCP appears only as an integration point; A2A not at all) — the most likely first question from exactly the audiences this corpus targets.
8. **Three highest-leverage next actions:**
   1. **Ship the disposition pass** (A1–A4, A6–A7): one annex mapping every published finding to open/closed-by-commit/superseded, plus the README corrections. Cheapest credibility per hour available.
   2. **Run a consistency round 7 against the W0 surface** and fix what it finds (C1/B1/B2/B3 + C11's version-mapping rule): the W0 spec bump recreated the exact one-document-fix defect class the six-round series existed to catch, and the resolver-side ETag gap means W0's headline benefit is currently unrealized.
   3. **Repo hygiene + the D1/D2 decisions before any W1 code**: get the private key and traces out of the tree, then resolve the canonical-serialization and JCS-ownership prerequisites — the two places where W1, as sequenced, would build verification on an undefined object.
