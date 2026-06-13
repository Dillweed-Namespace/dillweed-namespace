# Dillweed Namespace — Specification Stack & Reference Implementation Consistency Review (Round 2)

> **Historical review — closed series (rounds 1–6).** All HIGH and MEDIUM findings raised across the series were resolved and verified closed by round 6. The series raised 8 HIGH and 21 MEDIUM in total (r1 4H/9M, r2 3H/10M, r3 1H/2M new); some round summaries understated this as "4 HIGH and 19 MEDIUM." See [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md) (FDI-DOC-004) for current status. Preserved unmodified as historical evidence.

**Date:** 2026-06-09
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Scope:** All 8 specs in `specs/` (Namespace Standard v0.4.3, DillClaw v0.1.6, Registry v0.1.5, Governance v1.1.3, Charter v1.0.3, Anthill v0.1.3, Standards Overview v1.0.10, Continuity GSP-01 v1.0.3), `registry/server.js` (v0.2.8), `resolver/server.js` (v0.1.8), `anthill/server.js` (v0.1.6), `integration-test.sh`, READMEs.
**Relationship to prior review:** A first-round review (`spec-consistency-review-2026-06-09.md`, written against Registry Spec v0.1.4 / DillClaw v0.1.5 / Anthill v0.1.2) preceded a spec revision cycle. This round reviews the **current** revisions. A disposition table for the round-1 findings is at the end.

## Summary

The May–June revision cycle resolved the great majority of round-1 findings: the verified-tier 30-day/6-month conflict, the phantom ANT-AB/ANT-RD signal classes, the unsigned-`registration_date` exposure (now documented in DillClaw §6.2's Security Note), the `REGISTRY_STALE` contradiction, the undocumented resolver error codes and `allow_unsigned`/diagnostic-mode fields, mirror-field divergence, port drift, ANT-WF naming, and the missing glossary row are all fixed in the current specs. The cryptographic core remains byte-consistent across Registry and Resolver.

This round found **3 HIGH**, **10 MEDIUM**, and **9 LOW/INFO** items. The HIGH findings are: a direct cross-document contradiction over which document occupies stack layer L5 (Anthill vs. Registry), including a false claim in the Anthill spec that its numbering matches the other documents; a provisional-trust-tier control that two governance documents rely on but that the resolver spec never defines and the resolver implementation does not perform; and a resolver implementation that rejects `max_results > 50` with an error where the spec's new text says values MUST be clamped without error — an inconsistency introduced by the round-1 fix itself.

Severity definitions (carried over from round 1): **HIGH** = normative conflict or trust-model-relevant gap requiring a spec decision; **MEDIUM** = conformance divergence or cross-document inconsistency that will mislead an implementer; **LOW** = cosmetic drift, stale references, coverage gaps; **INFO** = observation, no action strictly required.

---

## HIGH Findings

### H-1. Stack layer L5 means two different things; Anthill's "matches the convention" claim is false
- **Namespace Standard v0.4.3 §9:** L1 Gateway → L2 Namespace → L3 Resolver → L4 Capability → **L5 Anthill Observability Plane** ("shown as orthogonal").
- **Registry Spec v0.1.5 §1:** same L1–L4, but **L5 = Dillweed Registry** ("authoritative substrate … not a vertical layer in the resolution chain").
- **Anthill Spec v0.1.3 §2:** L5 = **Registry Layer**, drawn *vertically below* L4 with a `↓` arrow (contradicting the Registry spec's own "not a vertical layer" framing), while stating Anthill itself "is deliberately given no layer number." The Namespace Standard, however, *does* give Anthill a layer number (L5).
- **Anthill §2 explicitly claims:** "The L1–L5 numbering in this document matches the stack convention used in the Namespace Standard, DillClaw Resolver Specification, and Registry Specification." This is false on two counts: the Namespace Standard assigns L5 to Anthill (not the Registry), and the DillClaw spec (§1) defines only L1–L4 with the Registry omitted from the numbered stack entirely.
- Compounding the confusion, Anthill §3's comparison table uses an OSI-style numbering ("L7 · Application / L4 · Coordination / L3 · Network") that collides with the stack's own L4 = Capability convention in the same document.
- **Recommendation:** pick one canonical stack diagram (suggest: L1–L4 vertical; Registry as unnumbered substrate per Registry §1; Anthill as unnumbered orthogonal plane per Anthill §2) and propagate it to all four documents; delete or qualify the "matches the convention" sentence; relabel the Anthill §3 table rows so they cannot be read as stack-layer numbers.

### H-2. Provisional-tier weighting penalty: required by Registry Spec and Charter, undefined in DillClaw spec, absent from the resolver
- **Registry Spec v0.1.5 §7:** self-declared `verified`/`canonical` tiers are provisional; "A resolver encountering a self-declared verified or canonical record without a corresponding DNSO promotion audit entry SHOULD treat it as trusted for scoring purposes."
- **Charter v1.0.3 §4:** "resolvers apply weighting penalties as specified in the Registry Specification §7" and "Resolvers distinguish attested from provisional tiers via the presence of a `provisional_tier` audit log entry without a corresponding `promote` entry."
- **DillClaw Spec v0.1.6:** contains no mention of provisional tiers, no weighting-penalty rule, no consumption of `GET /log`, and a §6.2 scoring table that maps the *declared* tier directly to its score value. The deterministic scoring profile `dillclaw-default-v1` leaves no room for a penalty that isn't in the formula.
- **Implementation:** `resolver/server.js` `trustScore()` uses `TIER_SCORE[record.trust_tier]` directly and never queries `/log`. A self-declared `canonical` record receives the full 1.0 tier value (0.40 weighted) from every conformant resolver — the control the Registry Spec and Charter describe does not exist anywhere it could execute.
- The Registry implementation dutifully writes the `provisional_tier` log entries and even tells callers "Resolvers will apply a weighting penalty until attestation is recorded" — a promise no resolver keeps.
- **Recommendation:** either (a) add the provisional-tier detection mechanism and penalty to the DillClaw spec (it likely requires a new scoring profile, since `dillclaw-default-v1` is pinned) and implement it, or (b) downgrade the Registry §7 / Charter §4 language to describe a future capability, mirroring the candor of Anthill A.11.

### H-3. Resolver rejects `max_results > 50`; spec says it MUST clamp without error
- **DillClaw Spec v0.1.6 §3.1** (text added in the round-1 fix cycle): "The `max_results` field is capped at 50. Requests specifying a value above this limit **MUST be clamped to 50 without error**."
- **Implementation:** `resolver/server.js` `validateResolveRequest()` returns a 400 `QUERY_MALFORMED` ("max_results must be an integer between 1 and 50") for any value above 50, for both `/resolve` and per-item `/batch`.
- The round-1 fix documented the bound but chose semantics opposite to the implementation's, so the spec and code now disagree where previously the spec was merely silent.
- **Recommendation:** decide which behavior is intended. Clamping (spec) is friendlier to forward compatibility; rejection (code) is more explicit. Change one to match the other.

---

## MEDIUM Findings

### M-1. Record-cache TTL is "registry-provided per record," but the Registry defines no TTL anywhere
DillClaw §7.1 ("TTL is set by the registry per record and MUST be respected") and the §7.2 table ("Source of TTL: Registry-provided per record") presuppose a per-record TTL field. The Registry Spec's Capability Record schema (§3.1), `/list`, and `/lookup` responses define no TTL field, and the Registry implementation sends none. The resolver hardcodes the 300s default. A second implementer reading DillClaw §7 will look for a field that cannot exist. **Recommendation:** either add a TTL field to the Registry CR schema/response envelope or reword DillClaw §7.1/§7.2 to "resolver-configured (default 300s)".

### M-2. `months_registered` is undefined, breaking the cross-implementation determinism MUST
DillClaw §6.2 requires "byte-identical rounded values for the same inputs" across conformant resolvers, and the usage-history signal is `min(months_registered, 24) / 24`. But neither DillClaw nor the Registry spec defines how `months_registered` is derived from the `registration_date` full-date: calendar months? 30-day months? The reference implementation uses 30.44-day months (`/ (1000*60*60*24*30.44)`). Two independent implementations using calendar months vs. 30.44-day months will produce different scores for the same record on the same day — the determinism guarantee is unsatisfiable as written. (Scores also vary with wall-clock time by construction; "same inputs" should be defined to include the evaluation date.) **Recommendation:** pin the formula (e.g., `floor(days_since_registration / 30.44)` or calendar-month arithmetic) in §6.2.

### M-3. DillClaw spec contradicts itself again on invalid signatures: §6.1 (reject) vs §11.1 (score penalty)
§6.1 step 3: candidates with invalid signatures "MUST be rejected unless the resolver is operating in an explicitly declared diagnostic mode." §11.1 threat table: "Invalid signatures result in **trust score penalty or elimination per caller policy**." §6.2's signal table also assigns invalid = 0.0 a score value, implying invalid-signature candidates can be scored. Under §6.1 the only way an invalid-signature record is ever scored is diagnostic mode — "caller policy" (per §3.1, `allow_unsigned`) governs *missing* signatures only. The implementation follows §6.1. This is the same defect class as round-1's H-4 (`REGISTRY_STALE`), one section over. **Recommendation:** fix §11.1 to "rejection (diagnostic mode excepted); missing signatures per caller policy," and footnote the §6.2 invalid=0.0 row as reachable only in diagnostic mode.

### M-4. Resolver implements `probe_liveness` request field that the spec says does not exist
DillClaw §6.1 step 4: "The caller does not control probing directly through the resolution request today. A `probe_liveness` request field is **anticipated in a future revision** (see Appendix A)"; A.2 reiterates it. The implementation already accepts and honors `probe_liveness: true` in `/resolve` and `/batch` bodies (validated as boolean, triggers `probeEndpoint()`). Implementation ran ahead of the spec, and the spec now affirmatively (and falsely, for the reference implementation) states the field doesn't exist. **Recommendation:** move `probe_liveness` from Appendix A into §3.1, or gate it behind a non-default flag until the spec lands.

### M-5. Registry's semver comparator ignores pre-release precedence; `/lookup` and `/verify` mis-order pre-releases
`registry/server.js` `compareSemver()` (the round-1 M-2 fix) does `split('.').map(Number)`: for `1.0.0-beta`, the patch component `"0-beta"` becomes `NaN` → coerced to 0, so `1.0.0-beta` compares equal to `1.0.0`. Registration validation (`SEMVER_RE`) explicitly accepts pre-release versions, so the registry can store both — and `/lookup` (ordered "highest first") and `/verify` (verifies "the latest version" when `?version` omitted) may select the pre-release over the release, or order them arbitrarily. Per semver.org §11, `1.0.0-beta < 1.0.0`. The resolver's own `compareSemver()` handles this correctly; the registry's does not. **Recommendation:** port the resolver's comparator into the registry.

### M-6. Integration test accepts HTTP 409 on re-registration after revocation as a pass
Registry Spec §3.3/§8.1: revocation "frees the slot"; a revoked name:version "may be re-registered." The implementation's partial unique index (`WHERE revoked=0`) guarantees this works. Yet `integration-test.sh` Step 7 treats 409 as a pass ("name still reserved after revocation — acceptable"). If a regression reintroduced a full unique index, the test would mask a direct §3.3 conformance failure. **Recommendation:** make 409 a failure in Step 7.

### M-7. Anthill spec mandates `node_signature` on every signal; implementation treats it as optional
Anthill §4: "Each signal instance MUST carry the following metadata fields … `node_signature` — Ed25519 signature over the canonical serialization of all preceding fields." `anthill/server.js` validates `node_signature` only "when supplied" and stores signals without it. A.11 candidly discloses that signatures are stored-not-verified, but not that the field itself is unenforced — those are different gaps (a signal with *no* signature field at all is accepted, which even the A.11-acknowledged interim posture doesn't describe). **Recommendation:** either require field presence now (verification can still wait for the Charter procedure) or extend A.11's disclosure to cover optionality.

### M-8. Version-suffix syntax: Namespace Standard's `:v2` example is not valid semver
Namespace Standard §3.3: "Version suffixes may be appended using a colon: `dllwd://tools.search.web-retrieval:v2`." DillClaw §4.3 defines the suffix as an exact semver or semver range (`:1.2.0`, `:^1.2`), and Registry §3.1/§7 require semver `version` values — `v2` can never match a registered record, and the reference resolver's `matchVersion()` rejects it (no candidate satisfies it). The foundational document's only version-suffix example is invalid under both downstream specs. **Recommendation:** change the example to `:1.2.0` or define `vN` shorthand normatively.

### M-9. Reuse rights contradict across documents: Namespace Standard forbids what the others permit
Namespace Standard footer: "Specifications may be referenced for standards discussion and research purposes. **Commercial implementation, redistribution, or derivative works require written permission**." All seven other documents: "may be referenced for standards discussion, research, **and interoperable implementation**" (Anthill: "Implementations may reference and interoperate"). The Standards Overview also advertises the stack for "early experimentation," and Governance §8.1 makes Openness a MUST-level property. The most foundational document carries the most restrictive terms, contradicting the rest of the stack's posture. (Repo code is Apache-2.0; that's separate and consistent.) **Recommendation:** align the Namespace Standard's notice with the stack-wide formulation, or document the intentional difference.

### M-10. Anthill ANT-RC references a "grace period specified in the Registry Specification" that doesn't exist
Anthill §4, ANT-RC: measures "resolver nodes that continue to serve a revoked capability record beyond **the grace period specified in the Registry Specification**." The Registry Spec defines no grace period; the closest concepts are the resolver's 60s `/list` refresh window (Registry §10.1, §11.1) and DillClaw §7.5's revocation-propagation bound. An implementer of ANT-RC thresholds has no normative value to use. **Recommendation:** reference Registry §10.1's refresh window / DillClaw §7.5's propagation guarantee explicitly, or define the grace period.

---

## LOW Findings

### L-1. Anthill appendix cites §3 for the six-class signal taxonomy; it is §4
A.5 ("The current ANT-DN signal class (§3)"), A.6 ("The current signal taxonomy (§3)"), and A.10 ("The current specification (§3) defines six signal classes") all point at §3 (The Observability Imperative); the taxonomy is §4. Residual of round-1 M-4 — the §11/§6.1 dead references were fixed, but the §3↔§4 off-by-one survived the renumbering pass. (A.1's "(§3)" for the *origin model* is correct; the origin model genuinely is in §3, which may explain the confusion.)

### L-2. Anthill stack list cites "Governance Framework v1.0"; current line is v1.1
Anthill §9's stack listing says "Governance Framework v1.0 … succession · neutrality preservation." Under the stack-wide major.minor convention (stated in Governance §02, Charter §02, GSP-01 §11), the correct reference is v1.1 — and the same list in the Charter, Governance, and GSP-01 all say v1.1. Stale cross-reference.

### L-3. GSP-01 §01 still lists the Operations Charter separately from "the five core specifications"
"GSP-01 … sits alongside the five core governance-and-resolution specifications, the cross-cutting Anthill observability document, the Standards Overview, **and the DNSO Operations Charter**" — but the Charter is one of the five core specifications (per Governance §02 and the Standards Overview §02). Residual of round-1 L-1; the v1.0.3 taxonomy fix updated the counts but left the double-listing.

### L-4. Stale version stamps in implementation comments and component READMEs
- `resolver/README.md` is titled "DillClaw Resolver — **v0.1.7**" with no v0.1.8 changelog entry; `registry/README.md` is titled "**v0.2.7**". Both implementations and the top-level README/ledger are at v0.1.8/v0.2.8. (Top-level README, SHA table, and PROJECT_LEDGER are consistent at 0.2.8/0.1.8/0.1.6.)
- `anthill/server.js` line 4 header still says "v0.1.5" (VERSION constant: 0.1.6); its changelog block is labeled v0.1.0.
- `resolver/server.js` comments still cite "Namespace Standard **v0.4.2** §3.4" (current v0.4.3) and "Registry v0.1.4 / **v0.2.7** signing profile" (current v0.1.5 / v0.2.8).
Residual of round-1 L-3, partially fixed (the DillClaw spec's example `resolver_version` was updated).

### L-5. Resolver's negative cache is written but never consulted
`cache.setNegative(query)` runs on every NO_MATCH, but `cache.isNegative()` has no callers. In the snapshot architecture most queries don't reach the network, but the `/lookup`-on-miss path re-fetches `<base>/lookup/<name>` on **every** repeated query for the same nonexistent exact name — precisely the thundering-herd case DillClaw §7.1's negative cache (default 30s) exists to prevent. **Recommendation:** check `isNegative()` before `fetchOneRemote()`, or delete the dead negative-cache code.

### L-6. `REGISTRY_STALE` survives in the resolver's HTTP map after being removed from the spec
Round-1 H-4 was fixed by removing `REGISTRY_STALE` from DillClaw §8.2, but `resolver/server.js` `HTTP_FOR` still maps `REGISTRY_STALE: 503`, and no code path emits it. Dead code that re-documents a code the spec deliberately deleted.

### L-7. Stray file `registry/server copy registry.js`
A 1,026-line near-duplicate of `registry/server.js` (content differs from the current file) sits in the public repo. Risk: a reader or tool patches the wrong file; the diff suggests it's a stale snapshot. **Recommendation:** delete or move to `patches/`.

### L-8. Registry Spec v0.1.5 carries only the v0.1.4 revision note
The document is v0.1.5 but its only changelog callout describes "Revision 0.1.4." The v0.1.5 changes (verified-tier criteria, §10.3 mirror-field alignment, §10.2 port fixes) are undocumented, unlike Governance/GSP-01 which maintain revision histories. Same pattern: the Namespace Standard is "Draft for Comment" on its own cover/footer while the Standards Overview maturity table calls it "Published specification" — one status should win.

### L-9. Minor implementation-vs-spec edge divergences
- `DILLCLAW_DIAGNOSTIC_MODE`: spec says "when set"; implementation requires the exact value `'1'` (`DILLCLAW_DIAGNOSTIC_MODE=true` does nothing).
- Registry `/health` `key_rotation.previous_key_url` is hardcoded to `https://dillweed.com/dnso_public.pem?previous=true` even on local instances, where the prior key is actually served at the instance's own `/pubkey?previous=true`; `rotation_started_at`/`rotation_ends_at` fall back to `null` though the spec table defines them as RFC 3339 strings.
- Registry rejects mirror-mode writes with `405 METHOD_NOT_ALLOWED`, a code absent from the Registry Spec §4.1 error table (the spec is silent on mirror write-rejection semantics).

---

## INFO / Observations

- **I-1. Tie-break Rule 2 prefers the *older* version.** DillClaw §6.3 Rule 2 is *ascending* semver precedence, so when two versions of the same capability tie on score, rank 1 goes to the lower version. Spec and implementation agree, so this is not a conformance finding — but callers may reasonably expect the newer version to win a tie. Worth confirming the design intent.
- **I-2. The `unverifiable` signature state (no DNSO key configured) is implementation-defined.** The spec's §6.1 dichotomy (valid/invalid/missing) assumes the resolver always has the public key. The implementation adds a fourth state with sensible default-deny behavior (`allow_unsigned` opt-in). A future revision could fold this into §6.1.
- **I-3. `version_pref` default is unspecified.** The implementation defaults to `'stable'`, which makes a registry containing only pre-release versions return VERSION_CONSTRAINT_FAILED by default. §3.1's schema comment marks the field optional without stating the default.
- **I-4. Namespace Standard §3.2's syntax template shows exactly three components** (`<domain>.<category>.<function>`) while the naming rules (§3.3) require only "at least two" and the canonical example (`research.market.intel.vendors`) has four. The template reads as more restrictive than the rule.
- **I-5. Anthill functional coverage gap in the integration test persists** (round-1 L-4, partially fixed): the `schemas` field was corrected to `input_schema`/`output_schema` and the §7.5 citation is now accurate, but Anthill is still exercised via `/health` only — no signal submission, nonce-replay, or sequence-violation assertions.

---

## Round-1 Finding Disposition

| Round-1 | Status in current revisions |
|---|---|
| H-1 verified-tier 30d vs 6mo | **Fixed** — Registry §9 now says "30+ days … (see DNSO Operations Charter §4.1)" |
| H-2 phantom ANT-AB/ANT-RD | **Fixed** — DillClaw A.7 now cites ANT-RC/ANT-RA and Anthill §4 |
| H-3 unsigned registration_date | **Fixed (documented)** — DillClaw §6.2 Security Note added, with mitigation guidance |
| H-4 REGISTRY_STALE contradiction | **Fixed in spec** — removed from §8.2; code vestige remains (L-6 above) |
| M-1 undocumented error codes/fields | **Fixed** — §3.1/§8.2 now define them; but the new max_results clamp text conflicts with code (H-3 above) |
| M-2 /lookup lexicographic ordering | **Fixed in code** (semver sort added); comparator misses pre-release precedence (M-5 above) |
| M-3 nonce scope per-node vs global | **Fixed** — Anthill §4 now specifies global enforcement with rationale |
| M-4 Anthill dead section refs | **Partially fixed** — §11/§6.1 refs gone; §3-for-§4 taxonomy citations remain (L-1 above) |
| M-5 port drift | **Fixed** — Registry §10.2 and Governance §02 now use 9474/9475 |
| M-6 mirror-field divergence | **Fixed** — §10.3 now mirrors §2.2 verbatim |
| M-7 revocation propagation 60s vs 300s | **Fixed** — DillClaw §7.5 now defines the snapshot-refresh propagation bound |
| M-8 ANT-WF expansion | **Fixed** — A.10 now says "Wildcard Fanout" |
| M-9 missing glossary | **Fixed** — row removed from Standards Overview |
| L-1 taxonomy descriptions | **Partially fixed** — counts aligned; GSP-01 §01 double-lists the Charter (L-3 above) |
| L-2 Anthill stale self-references | **Fixed** |
| L-3 stale code-comment versions | **Persists** (L-4 above) |
| L-4 integration test schemas/Anthill | **Partially fixed** — field names corrected; Anthill coverage still health-only (I-5 above) |
| L-5 wildcard 200 wording | **Fixed** — §11.1 now says "rejected with QUERY_TOO_BROAD" |
| L-6 Anthill §5 dedup description | **Fixed** — now "nonce uniqueness and per-node sequence monotonicity" |

---

## Suggested Issues (drafts for human review — not filed)

1. **[spec] Unify the L1–L5 stack diagram across Namespace Standard §9, Registry §1, DillClaw §1, Anthill §2** — H-1.
2. **[spec/impl] Provisional-tier weighting penalty: define it in DillClaw or downgrade Registry §7 / Charter §4 to future-work language** — H-2.
3. **[impl or spec] `max_results > 50`: clamp (per §3.1) or reject (per code) — pick one** — H-3.
4. **[spec] Define the record-TTL source: add a Registry TTL field or reword DillClaw §7.1/§7.2** — M-1.
5. **[spec] Pin the `months_registered` formula in DillClaw §6.2** — M-2.
6. **[spec] Fix DillClaw §11.1 invalid-signature row to match §6.1's MUST-reject** — M-3.
7. **[spec] Promote `probe_liveness` out of Appendix A (it's implemented)** — M-4.
8. **[registry] Port the resolver's pre-release-aware semver comparator** — M-5.
9. **[test] Make 409-after-revocation a failure in integration-test.sh Step 7** — M-6.
10. **[anthill/spec] Enforce or disclose optional `node_signature`** — M-7.
11. **[spec] Replace the `:v2` version-suffix example in Namespace Standard §3.3** — M-8.
12. **[legal/spec] Align Namespace Standard reuse terms with the stack-wide "interoperable implementation" grant** — M-9.
13. **[spec] Define or re-reference ANT-RC's "grace period"** — M-10.
14. **[repo] Cleanup batch: §3→§4 Anthill citations, Governance v1.0→v1.1 ref, GSP-01 Charter double-listing, stale README/comment versions, dead negative-cache & REGISTRY_STALE code, `server copy registry.js`** — L-1…L-7.

Per the steward boundary, opening any of these requires human approval (`review.issue.open`, exit 2).
