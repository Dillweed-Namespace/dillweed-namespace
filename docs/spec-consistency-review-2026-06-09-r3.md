# Dillweed Namespace — Consistency Review, Round 3 (Fix-Verification)

**Date:** 2026-06-09
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Baseline:** Round-2 report (`spec-consistency-review-2026-06-09-r2.md`) and fix commit `a3384bd` ("Resolve all Fable 5 round-2 findings: H-1 through H-3, M-1 through M-10, L-1 through L-8"), reviewed at repo HEAD = `a3384bd`.

## Summary

Commit `a3384bd` resolves **most** of the round-2 findings, and the fixes that landed are correct: the integration test now fails on 409-after-revocation, the negative cache is consulted, `REGISTRY_STALE` is gone, the `:v2` example and the Namespace Standard's reuse-rights footer are corrected, `probe_liveness` is promoted into the spec, the TTL source is reworded, the `months_registered` formula is pinned, §11.1 now matches §6.1, the stray `server copy registry.js` is deleted, and the GSP-01 double-listing is fixed.

However, the commit message **overclaims**. Five round-2 findings (parts of H-1, all of H-2, M-7, M-10, and several LOWs) live in `anthill-spec.html`, `registry-spec.html`, and the Operations Charter — none of which were modified — and remain open. In addition, **two of the fixes introduced new defects**, one of them a MUST-level conformance break: the spec now pins a `months_registered` formula that the reference resolver does not implement. Finally, normative spec changes shipped **without version bumps or revision notes**, so the repo's "v0.1.6" DillClaw spec and "v0.4.3" Namespace Standard now differ materially from any previously published copies bearing the same version numbers.

Severity definitions unchanged from rounds 1–2.

---

## New Findings (introduced by the fix commit)

### N-1 (HIGH). The pinned `months_registered` formula is not what the resolver computes
- **DillClaw §6.2 (new text):** `months_registered` is defined as `floor(days_since_registration / 30.44)` where `days_since_registration` is "the integer number of UTC days" between `registration_date` and the evaluation date, and "Conformant implementations MUST use this formula to satisfy the determinism guarantee."
- **`resolver/server.js` `usageScore()` (unchanged):** computes *continuous fractional* months — `(Date.now() − registration_date) / (ms · 30.44 days)` — with no day-truncation and no `floor()`, and feeds the fraction into `min(months, 24)/24`.
- Concrete divergence: a record registered 45 days ago scores `0.30 · (floor(45/30.44)/24) = 0.0125` under the spec but `0.30 · (1.478/24) ≈ 0.0185` in the implementation — a difference that survives banker's rounding. The reference implementation now violates the very MUST that was added to fix round-2 M-2. (`trustSignals()` already floors for the `Nmo_history` label; `usageScore()` does not for the score.)
- **Recommendation:** update `usageScore()` to compute integer UTC days, then `floor(days/30.44)`, clamp, divide by 24. One-line-ish fix; add a regression test pinning a known date pair to a known score.

### N-2 (MEDIUM). Registry's upgraded `compareSemver` still mis-handles build metadata and pre-release identifiers
The `a3384bd` rewrite handles release-vs-pre-release precedence, but:
- **Build metadata is not stripped.** `parse()` splits only on `-`, so `"1.0.0+build"` yields a `NaN` patch component, and the comparator returns `NaN` — undefined sort order. The registry's own `SEMVER_RE` accepts build metadata at registration, so such records are storable today.
- **Pre-release comparison is plain lexicographic**, not semver §11 identifier-by-identifier: `1.0.0-rc.2` vs `1.0.0-rc.10` orders `rc.10` below `rc.2` (numeric identifiers must compare numerically).
- The resolver's `compareSemver()` does both correctly; the two services still disagree on ordering for these inputs.
- **Recommendation:** port the resolver's comparator verbatim (round-2 M-5's original recommendation).

### N-3 (MEDIUM). Normative spec changes shipped without version bumps or revision notes
- **DillClaw spec:** §3.1's `max_results` semantics were inverted (clamp-MUST → reject-MUST), `probe_liveness` became a normative request field (§3.1, §6.1; A.2 even says "as of v0.1.6"), the §6.2 formula gained a new MUST, and §11.1 was rewritten — yet the document is still **v0.1.6**, the same version it carried before any of these changes.
- **Namespace Standard:** §3.3's example, the §9 stack diagram, and the **footer reuse-rights grant** (research-only → "interoperable implementation" — a legally meaningful change) all changed while the document remains **v0.4.3**; its only revision callout still describes the old §3.3 uniqueness clarification.
- Consequences: (a) any previously published copy at dillweed.com bearing "v0.1.6"/"v0.4.3" now differs materially from the repo file with the same version — this will trip the Step-1 spec-drift check and defeats the documents' own major.minor cross-reference convention; (b) it conflicts with the revision discipline the stack itself prescribes (each doc's changelog practice; GSP-01 §07 assigns even error-correction changes an x.x.1 increment).
- **Recommendation:** bump to DillClaw v0.1.7 and Namespace Standard v0.4.4 with revision notes (the license change in particular should be explicitly disclosed), then sync dillweed.com.

---

## Round-2 Findings Claimed Resolved but Still Open

### H-1 (PARTIAL). The L5 contradiction moved; it didn't close
The Namespace Standard §9 fix is good (Anthill and Registry both unnumbered, with rationale). But:
- **Registry Spec §1** still labels the Registry "**L5**" in its stack diagram — now contradicting the Namespace Standard's new "the Registry is similarly unnumbered" text.
- **Anthill §2** still shows "**L5 Registry Layer**" drawn vertically, and still asserts "The L1–L5 numbering in this document matches the stack convention used in the Namespace Standard, DillClaw Resolver Specification, and Registry Specification" — a claim that is now *more* wrong than before, since the Namespace Standard no longer defines any L5 and DillClaw never did.
- The OSI-style L7/L4/L3 table in Anthill §3 also remains.
**Remaining work:** edit Registry §1 and Anthill §2/§3 to the unnumbered-substrate / unnumbered-plane convention the Namespace Standard now establishes, and delete or correct the "matches the convention" sentence.

### H-2 (NOT FIXED). Provisional-tier weighting penalty still exists nowhere it could execute
No change to Registry Spec §7, Charter §4, the DillClaw spec (zero occurrences of "provisional"), or the resolver's scoring path. A self-declared `canonical` record still receives the full 1.0 tier score from the reference resolver, while the Registry continues to log `provisional_tier` entries and tell registrants "Resolvers will apply a weighting penalty until attestation is recorded." The round-2 recommendation stands: define the mechanism in the DillClaw spec (likely as a new scoring profile) and implement it, or downgrade the Registry §7 / Charter §4 language to future-work status.

### M-7 (NOT FIXED). Anthill `node_signature`: spec MUST vs optional in implementation
Anthill §4 still mandates `node_signature` on every signal; `anthill/server.js` (only the header version string changed) still accepts signals without the field. A.11's disclosure still covers non-verification only, not optionality.

### M-10 (NOT FIXED). ANT-RC's "grace period specified in the Registry Specification" still undefined
The phrase remains in Anthill §4; the Registry Spec still defines no grace period.

### LOW residuals (NOT FIXED)
- **L-1:** Anthill A.5/A.6/A.10 still cite "(§3)" for the six-class signal taxonomy that lives in §4.
- **L-2:** Anthill's stack list still says "Governance Framework v1.0" (current line: v1.1).
- **L-4 (residual):** component README titles were bumped to v0.1.8/v0.2.8, but neither README gained a "What's new" entry for the version it now claims; their changelogs still end at v0.1.7/v0.2.7.
- **L-8:** Registry Spec v0.1.5 still carries only the 0.1.4 revision note; Namespace Standard "Draft for Comment" vs Standards Overview "Published specification" status mismatch persists.
- **L-9:** diagnostic-mode `'1'`-only parsing, the hardcoded `dillweed.com` `previous_key_url` and nullable rotation timestamps in registry `/health`, and the unspecified 405 mirror-rejection code are all unchanged.

---

## Round-2 Fixes Verified Good

| Finding | Verification |
|---|---|
| H-1 (Namespace Standard side) | §9: Anthill "—" unnumbered orthogonal; Registry noted as unnumbered substrate |
| H-3 max_results | Spec §3.1 now mandates reject-with-QUERY_MALFORMED, matching code (semantics decision made in favor of rejection) |
| M-1 TTL source | §7.1/§7.2 now "Resolver-configured (default 300 seconds)" |
| M-2 (spec side) | Formula pinned in §6.2 — but see N-1: the implementation doesn't follow it |
| M-3 §11.1 invalid signatures | Registry-poisoning row rewritten to match §6.1's MUST-reject |
| M-4 probe_liveness | Added to §3.1 schema and §6.1 step 4; A.2 updated to reflect promotion |
| M-5 (partial) | Registry comparator now release > pre-release — but see N-2 for residuals |
| M-6 integration test | 409 branch removed; failure message cites Registry Spec §3.3/§8.1 |
| M-8 `:v2` example | Now `:1.2.0` |
| M-9 reuse rights | Namespace Standard footer now grants "interoperable implementation" — but see N-3: changed without version bump |
| L-3 GSP-01 §01 | Now "five core … specifications (which include the DNSO Operations Charter)" |
| L-4 (partial) | anthill header v0.1.6; resolver comments now cite v0.4.3 / v0.1.5 / v0.2.8 |
| L-5 negative cache | `!cache.isNegative(query)` now gates `/lookup`-on-miss |
| L-6 REGISTRY_STALE | Removed from `HTTP_FOR` |
| L-7 stray file | `registry/server copy registry.js` deleted |

---

## Recommended Next Actions (priority order)

1. **Fix `usageScore()`** to implement the §6.2 formula it now violates (N-1) — small code change, HIGH severity.
2. **Finish H-1** in Registry §1 and Anthill §2/§3 (the two files the fix commit never touched).
3. **Decide H-2** (provisional-tier penalty): implement or downgrade the language — this is the largest remaining trust-model gap.
4. **Version-bump and changelog** the silently-revised DillClaw and Namespace Standard documents, then sync dillweed.com (N-3).
5. Port the resolver's semver comparator to the registry (N-2).
6. Sweep the Anthill spec once for M-7, M-10, L-1, L-2; add the missing README changelog entries and the Registry v0.1.5 revision note (L-4/L-8).

Per the steward boundary, opening issues for any of these requires human approval (`review.issue.open`, exit 2).
