# Dillweed Namespace — Consistency Review, Round 4 (Fix-Verification)

> **Historical review — closed series (rounds 1–6).** All HIGH and MEDIUM findings raised across the series were resolved and verified closed by round 6. The series raised 8 HIGH and 21 MEDIUM in total (r1 4H/9M, r2 3H/10M, r3 1H/2M new); some round summaries understated this as "4 HIGH and 19 MEDIUM." See [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md) (FDI-DOC-004) for current status. Preserved unmodified as historical evidence.

**Date:** 2026-06-09
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Baseline:** Round-3 report (`spec-consistency-review-2026-06-09-r3.md`); fix commits `d1a27dc`/`0b9b462` ("Round-3 fixes: N-1 … re-land H-1/H-2/M-7/M-10/L-1/L-2, L-4/L-9 residuals") and `9f74edf`; reviewed at HEAD = `9f74edf`.

## Summary

This fix cycle is substantially complete and the two code-level defects from round 3 are fixed correctly: `usageScore()` now implements the pinned `floor(days/30.44)` formula exactly (N-1), and the registry's semver comparator is now a verbatim port of the resolver's, correctly negated at both call sites (N-2). Version discipline improved: DillClaw bumped to v0.1.7, the Namespace Standard to v0.4.4 with a proper revision note, the Registry Spec gained its missing v0.1.5 revision note, and the Standards Overview was synced. H-2 was resolved the recommended way — Registry §7 now candidly states that "resolvers score the declared tier at face value" until a future DillClaw revision defines the detection mechanism. M-7 (node_signature optionality) and M-10 (grace period) are fixed via expanded disclosure and corrected cross-references. The accidental `specs/readme-registry.md` was self-corrected one commit later.

**What remains is a short tail of incomplete edges, all of one kind: the fix landed in one document but its echoes in adjacent documents and code were missed.** Three findings carry forward (one degraded into a new dangling-reference problem), plus two small new consistency items created by the fixes themselves. Nothing HIGH remains open.

---

## New / Remaining Findings

### R4-1 (MEDIUM). The H-2 downgrade left dangling assertions in the Charter and the registry's own messages
Registry Spec §7 now says the provisional-tier weighting mechanism does not yet exist ("Until that mechanism is defined and implemented, resolvers score the declared tier at face value"). But:
- **Charter §4** (untouched) still says "resolvers apply weighting penalties **as specified in the Registry Specification §7**" — §7 no longer specifies any — and its Provisional Tier Behavior callout still asserts, in the present tense, "Resolvers distinguish attested from provisional tiers via the presence of a `provisional_tier` audit log entry."
- **`registry/server.js`** still emits the old promise in two places: the `provisional_tier` audit-log detail ("Resolvers SHOULD apply weighting penalty until /promote confirms attestation", line ~766) and the registration response notice ("Resolvers will apply a weighting penalty until attestation is recorded", line ~794). Both statements are now contradicted by the spec the registry implements.
Per Charter §2.1's own precedence rule the Registry Spec wins, and §2.1 says conflicts "SHOULD be logged as amendment candidates" — this is one. **Recommendation:** update Charter §4 to future-work phrasing matching Registry §7, and soften the two registry message strings ("a future resolver revision is expected to apply a weighting adjustment…").

### R4-2 (MEDIUM). H-1 residual: Registry Spec §1 still numbers the Registry "L5," and Anthill now cites it as if it didn't
The Namespace Standard (v0.4.4 §9) and Anthill §2 now both present the Registry as an *unnumbered authoritative substrate* — and Anthill's corrected sentence explicitly cites "(per Registry Specification §1)." But Registry Spec §1 itself still renders the "**L5** — Dillweed Registry — Authoritative Substrate" row in its stack diagram (only an HTML comment changed). So the one document everyone now points to for the unnumbered convention is the last one still using the number. **Recommendation:** change the §1 `arch-num` from "L5" to "—" with the substrate annotation, mirroring the Anthill §2 fix.

### R4-3 (LOW). Revision discipline was applied unevenly across the three edited specs
- **Namespace Standard:** bumped v0.4.3 → v0.4.4 *with* a revision note. ✔
- **DillClaw:** bumped v0.1.6 → v0.1.7 but **no revision note** documents what changed in 0.1.7 (max_results semantics, probe_liveness promotion, §6.2 formula, §11.1 rewrite, diagnostic-mode `=1` pinning).
- **Registry Spec:** received a normative change in this cycle (§7's resolver-SHOULD removed) **without** a version bump — the new "Revision 0.1.5 (June 2026)" note retro-documents both the earlier and the new changes under the same version identifier.
- **Anthill:** received §2 diagram, §4 ANT-RC, and A.11 changes while remaining v0.1.3 with no revision note.
One change-control convention should apply to all four. **Recommendation:** add a v0.1.7 revision note to DillClaw; bump Registry to v0.1.6 and Anthill to v0.1.4 (or document a deliberate "pre-publication edits don't bump" rule somewhere normative — but then v0.4.4/v0.1.7 shouldn't have been bumped either).

### R4-4 (LOW). One missed §3→§4 citation: Anthill A.10
A.5 and A.6 were corrected to "(§4)", but A.10 still opens "The current specification (§3) defines six signal classes as architectural peers" — the taxonomy is §4.

### R4-5 (LOW). `previous_key_url` hardcoding survives the L-9 residual claim
`registry/server.js` `/health` still reports `previous_key_url: 'https://dillweed.com/dnso_public.pem?previous=true'` unconditionally, even for local/non-canonical instances whose prior key is actually served at the instance's own `/pubkey?previous=true`. (The other L-9 items did land: the spec now documents `DILLCLAW_DIAGNOSTIC_MODE` as "set to 1", matching the code.)

### R4-6 (INFO). Persisting low-priority items, unchanged and previously reported
- Namespace Standard cover/footer "Draft for Comment" vs. Standards Overview "Published specification" status for the same document.
- Integration test exercises Anthill via `/health` only (no signal-path coverage).
- Registry `/health` `rotation_started_at`/`rotation_ends_at` may be `null`; mirror-mode write rejection uses an unspecified 405 code.
- Commit hygiene: `d1a27dc` and `0b9b462` share an identical message; `0b9b462` consisted solely of an accidental 542-line `specs/readme-registry.md`, deleted in `9f74edf`.

---

## Round-3 Findings — Disposition

| Round-3 | Status |
|---|---|
| N-1 usageScore formula | **Fixed** — integer days, `floor(days/30.44)`, clamped; matches §6.2 exactly |
| N-2 registry semver comparator | **Fixed** — resolver comparator ported verbatim; descending order via negation at `/lookup` and `/verify` |
| N-3 silent normative edits | **Mostly fixed** — DillClaw v0.1.7, NS v0.4.4 + note, Registry note added, Overview synced; uneven application remains (R4-3) |
| H-1 L5 contradiction | **Mostly fixed** — Anthill §2 corrected (unnumbered Registry, accurate convention sentence); Registry §1's own diagram missed (R4-2) |
| H-2 provisional-tier penalty | **Resolved by downgrade** in Registry §7 + A.2; Charter §4 and two registry message strings missed (R4-1) |
| M-7 node_signature | **Fixed (disclosure)** — A.11 now discloses both non-verification and field optionality, with rationale |
| M-10 ANT-RC grace period | **Fixed** — now cites Registry §10.1 refresh window and DillClaw §7.5 propagation guarantee |
| L-1 §3→§4 citations | **Partially fixed** — A.5/A.6 corrected; A.10 missed (R4-4) |
| L-2 Governance v1.0 ref | **Fixed** — now v1.1 |
| L-4 README changelogs | **Fixed** — v0.1.8 and v0.2.8 entries added |
| L-8 Registry revision note | **Fixed** — note added (see R4-3 for the version-identifier caveat) |
| L-9 misc | **Partially fixed** — diagnostic-mode `=1` documented; `previous_key_url` hardcoding remains (R4-5) |

---

## Recommended Next Actions

1. **R4-1:** Update Charter §4 (two passages) and the two `registry/server.js` message strings to match the revised Registry §7 — this is the only remaining place where the stack asserts a control that doesn't exist.
2. **R4-2:** Change Registry Spec §1's "L5" to the unnumbered-substrate rendering.
3. **R4-3/R4-4:** One editorial pass: DillClaw v0.1.7 revision note, Registry/Anthill version-or-note decision, A.10 citation.
4. **R4-5:** Derive `previous_key_url` from the serving instance (or omit it for non-canonical deployments).

After items 1–2, the specification stack would have no remaining MEDIUM-or-higher consistency findings from this review series.

Per the steward boundary, opening issues requires human approval (`review.issue.open`, exit 2).
