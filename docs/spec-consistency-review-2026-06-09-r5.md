# Dillweed Namespace — Consistency Review, Round 5 (Fix-Verification)

**Date:** 2026-06-09
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Baseline:** Round-4 report (`spec-consistency-review-2026-06-09-r4.md`); fix commit `a4757ef` ("Round-4 fixes: R4-1 Charter provisional-tier, R4-2 Registry L5, R4-3 DillClaw revision notes, R4-5 Anthill citations, registry messages"); reviewed at HEAD = `a4757ef`, clean working tree.

## Summary

The review series has converged: **no MEDIUM-or-higher findings remain open against the specification stack itself.** Commit `a4757ef` fixed the last cross-document conflicts — both Charter §4 passages now match the revised Registry §7's "score the declared tier at face value" posture, Registry Spec §1's stack diagram finally renders the Registry as the unnumbered authoritative substrate ("—"), the A.10 taxonomy citation is corrected, and the DillClaw spec gained a complete retroactive revision history (v0.1.4 through v0.1.7) that resolves R4-3's main complaint.

Three small items remain, all LOW: the commit message claims two fixes that are not in the commit (the `registry/server.js` message strings and, implicitly, the `previous_key_url` hardcoding — the working tree is clean, so these were never edited), and the citation sweep overcorrected one reference that was previously right.

---

## Findings

### R5-1 (LOW). Anthill A.1's origin-model citation was overcorrected from §3 (right) to §4 (wrong)
Commit `a4757ef` changed A.1's "three classes of signal origin … (§3)" to "(§4)". But the **Signal Origin Model** subsection genuinely lives in §03 (The Observability Imperative, line ~280 of the document); §04 is the Signal Taxonomy (six signal *classes*, not three origin classes). The original citation was correct — round-2 L-1 flagged only A.5/A.6/A.10, never A.1. The sweep fixed A.10 correctly and broke A.1 in the same pass. **Recommendation:** revert A.1's citation to (§3).

### R5-2 (LOW). Commit message claims "registry messages" fixed; `registry/server.js` was not modified
The working tree is clean and `a4757ef` touches no code, yet the two strings the round-4 report identified remain:
- audit-log detail (line ~766): "Resolvers SHOULD apply weighting penalty until /promote confirms attestation."
- registration response notice (line ~794): "Resolvers will apply a weighting penalty until attestation is recorded."
With the Charter now fixed, these are the **only** remaining places in the stack asserting the nonexistent penalty mechanism — and the first one is written permanently into the append-only `registration_log`, so every provisional-tier registration is recording a claim the Registry Spec now disavows. **Recommendation:** reword both to match Registry §7 ("a future resolver revision is expected to apply a weighting adjustment; resolvers currently score the declared tier at face value").

### R5-3 (LOW). `previous_key_url` hardcoding persists (R4-5, third carry-forward)
`registry/server.js` `/health` still returns `previous_key_url: 'https://dillweed.com/dnso_public.pem?previous=true'` unconditionally; on a local or mirror instance the prior key is actually served at the instance's own `/pubkey?previous=true`. Carried since round-2 L-9.

### R5-4 (INFO). Revision-discipline residue, reduced but not uniform
DillClaw now has the model changelog (four revision callouts, v0.1.4–v0.1.7). The Registry Spec's §1 diagram change shipped within the existing "Revision 0.1.5" note's version without extending the note; Anthill remains v0.1.3 with no note despite its §2/§4/A.11/citation edits across the last two cycles. If the operating rule is "same-day pre-publication edits fold into the current version," it works — but it should be stated somewhere once, since DillClaw and the Namespace Standard followed the opposite rule.

### R5-5 (INFO). Persisting low-priority items (unchanged, previously reported, no new action)
Namespace Standard "Draft for Comment" vs. Standards Overview "Published specification"; integration test's Anthill coverage is `/health`-only; registry `/health` rotation timestamps may be `null`; mirror write-rejection 405 unspecified; `d1a27dc`/`0b9b462` duplicate commit message.

---

## Round-4 Findings — Disposition

| Round-4 | Status |
|---|---|
| R4-1 Charter + registry messages | **Half fixed** — both Charter §4 passages updated to future-work phrasing ✔; the two `registry/server.js` strings were not changed despite the commit message (R5-2) |
| R4-2 Registry §1 "L5" | **Fixed** — `arch-num` now "—", comment updated; all four documents now agree on the unnumbered-substrate convention |
| R4-3 revision discipline | **Mostly fixed** — DillClaw retroactive revision notes v0.1.4–v0.1.7 added; Registry/Anthill version-note residue is now INFO-level (R5-4) |
| R4-4 Anthill A.10 citation | **Fixed** — but the same sweep broke A.1 (R5-1) |
| R4-5 previous_key_url | **Not fixed** (R5-3) |
| R4-6 INFO items | Unchanged (R5-5) |

## Series Status

Across five rounds: 4 HIGH, 19 MEDIUM, and ~20 LOW/INFO findings raised; all HIGH and all MEDIUM findings are now **resolved and verified**. Remaining open: three LOWs (R5-1, R5-2, R5-3) — one one-character citation revert and two small string/URL edits in `registry/server.js` — plus INFO-level observations. One targeted cleanup commit closes the series.

Per the steward boundary, opening issues requires human approval (`review.issue.open`, exit 2).
