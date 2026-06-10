# Dillweed Namespace — Consistency Review, Round 6 (Series Closure)

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Baseline:** Round-5 report (`spec-consistency-review-2026-06-09-r5.md`); fix commit `a504204` ("Round-5 fixes: R5-1 revert A.1 citation, R5-2 registry provisional-tier messages, R5-3 previous_key_url"); reviewed at HEAD = `a504204`, clean working tree.

## Summary

**The review series is closed.** All three remaining LOW findings from round 5 are fixed correctly and the commit's scope matches its message exactly (two files, no collateral changes):

- **R5-1 ✔** Anthill A.1's origin-model citation reverted to the correct "(§3)".
- **R5-2 ✔** Both `registry/server.js` provisional-tier strings (audit-log detail and registration response) now read "Declared tier accepted as provisional. A future resolver revision may apply weighting adjustments for unattested tiers…" — matching Registry Spec §7's posture. No document or code path anywhere in the stack now asserts the nonexistent weighting-penalty mechanism.
- **R5-3 ✔** `previous_key_url` is now configurable via `PREVIOUS_KEY_URL`, defaulting to the serving instance's own `/pubkey?previous=true` instead of the hardcoded dillweed.com URL.

One cosmetic nit arises from the R5-3 fix, and the previously reported INFO-level items persist by accepted disposition. Nothing requires a further fix cycle unless the steward wants zero open items of any severity.

---

## Findings

### R6-1 (LOW, cosmetic). New `previous_key_url` default is a relative path; Registry Spec §5.6 says "Absolute URL"
The §5.6 `key_rotation` field table defines `previous_key_url` as the "**Absolute URL** at which the prior public key is being served during the overlap window." The new default `'/pubkey?previous=true'` is relative. Operators can satisfy the spec by setting `PREVIOUS_KEY_URL`, but the out-of-the-box value is technically non-conformant — and a relative value is arguably *more* useful for local instances. **Recommendation (either):** construct an absolute URL from the request's Host header / configured base URL, or relax §5.6 to "URL (absolute, or relative to the registry instance)".

### R6-2 (INFO). Accepted residual items, unchanged across the series
Carried for the record; none block closure:
- Namespace Standard cover/footer "Draft for Comment" vs. Standards Overview maturity table "Published specification."
- Integration test exercises Anthill via `/health` only (no signal submission / replay / sequence coverage).
- Registry `/health` `rotation_started_at` / `rotation_ends_at` may be `null` when env vars are unset.
- Mirror-mode write rejection uses 405, a code outside the Registry Spec §4.1 error table.
- Anthill spec remains v0.1.3 (and Registry v0.1.5) across this fix series without new revision notes — acceptable if the operating rule is "same-cycle pre-publication edits fold into the current version," but that rule is still undocumented.
- Repo history: `d1a27dc`/`0b9b462` duplicate commit message; the transient `specs/readme-registry.md` add/remove.

---

## Series Summary (rounds 1–6, 2026-06-09 → 2026-06-10)

| Round | Scope | Raised | Outcome |
|---|---|---|---|
| 1 | Full review (specs v0.1.4/v0.1.5-era) | 4 HIGH, 9 MEDIUM, 6 LOW | All fixed by commits `46ce8cf`–`1cfa30e` |
| 2 | Full re-review (current specs) | 3 HIGH, 10 MEDIUM, 9 LOW/INFO | Fixed by `a3384bd` (with overclaims) |
| 3 | Fix verification | 1 HIGH, 2 MEDIUM new; 5 re-opened | Fixed by `d1a27dc`/`9f74edf` |
| 4 | Fix verification | 2 MEDIUM, 3 LOW residual | Fixed by `a4757ef` (partial) |
| 5 | Fix verification | 3 LOW residual | Fixed by `a504204` |
| 6 | Closure verification | 1 LOW cosmetic (R6-1) | Open at steward's discretion |

**Final state:** zero HIGH, zero MEDIUM open. Open items: R6-1 (cosmetic) and the R6-2 INFO list. The specification stack and reference implementations are internally consistent, cross-document references resolve, the trust-scoring and signing models are byte-consistent between Registry and Resolver, and every divergence found across six rounds has been either fixed or explicitly disclosed in the affected document.

Recurring process observation for the ledger: three of the five fix cycles introduced at least one new defect or overclaimed a fix in the commit message (round 2's `max_results` inversion, round 3's formula divergence, round 4's phantom "registry messages" and A.1 overcorrection). The verify-after-fix loop caught each; recommend retaining a verification pass as standard practice after any multi-document sweep.

Per the steward boundary, opening issues or proposing a PROJECT_LEDGER entry for the series requires human approval (`review.issue.open` / `ledger.update.propose`, exit 2).
