# Dillweed Namespace — Specification Stack & Reference Implementation Consistency Review

**Date:** 2026-06-09
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Scope:** All 8 specs in `specs/`, `registry/server.js` (v0.2.8), `resolver/server.js` (v0.1.8), `anthill/server.js` (v0.1.6), `integration-test.sh`

## Summary

The stack is in strong shape overall: the cryptographic core (canonical JSON, Ed25519 `dnso_v1_` signing profile, signed-field set), the trust-score formula and banker's rounding, the tie-breaking rules, the cache TTL table, wildcard constraints, and the replay-protection model are all implemented faithfully and byte-consistently across Registry and Resolver. However, the review found **4 HIGH findings** (one direct normative conflict between two specs, one cross-spec reference to non-existent signal classes, one security-relevant gap where an unsigned field drives 30% of the trust score, and one internal spec contradiction on stale-data semantics), **9 MEDIUM findings**, and a tail of LOW/INFO items — mostly stale internal references, port-number drift in examples, and implementation behavior that has run ahead of the specs it implements.

Severity definitions: **HIGH** = normative conflict or security-relevant gap requiring a spec decision; **MEDIUM** = conformance divergence or cross-document inconsistency that will mislead an implementer; **LOW** = cosmetic drift, stale references, coverage gaps; **INFO** = observation, no action strictly required.

---

## HIGH Findings

### H-1. Verified-tier history requirement: Charter says 30 days, Registry Spec says 6 months
- **DNSO Operations Charter v1.0.3 §4.1:** verified attestation requires a "minimum 30-day active registration history."
- **Registry Specification v0.1.4 §9:** verified tier requires "6+ months active registration" (trusted = 3 months).
- This is a direct normative conflict between two authoritative documents about the same governance decision. The Governance Framework §5.7 precedence order determines which one wins, but neither document acknowledges the other's figure.
- **Recommendation:** pick one value, fix the other, and add a cross-reference.

### H-2. DillClaw spec references Anthill signal classes that do not exist
- **DillClaw Resolver Spec v0.1.5 Appendix A.7** references signal classes **ANT-AB (Attestation Bypass)** and **ANT-RD (Resolver Drift)**. The Anthill spec v0.1.2 §4 defines exactly six classes: ANT-TC, ANT-RC, ANT-DN, ANT-RA, ANT-WF, ANT-EC. Neither ANT-AB nor ANT-RD exists anywhere in the Anthill spec.
- A.7 also cites "Anthill §3 and §5" for the signal taxonomy; the taxonomy is in §4. (The Anthill spec's own §1 makes the same §3/§5 citation error about itself.)
- **Recommendation:** either add the two classes to the Anthill taxonomy or correct A.7 to reference existing classes (ANT-RA is the closest match for both).

### H-3. Unsigned `registration_date` drives 30% of the trust score
- DillClaw §6.2 gives the usage-history component a 0.30 weight, derived from `registration_date`. Registry Spec §5.2 (and both implementations' `canonicalJSON`) **exclude `registration_date` from the signed field set** — only the ten fields description/endpoint/input_schema/last_updated/name/output_schema/permissions/protocol/trust_tier/version are signature-protected.
- Confirmed in code: `resolver/server.js` `usageScore()` reads `record.registration_date` directly; `canonicalJSON()` (both services) omits it. A mirror, cache, or man-in-the-middle can backdate `registration_date` to inflate a record's trust score by up to +0.30 **without invalidating the DNSO signature**.
- Neither spec acknowledges this. The Anthill spec's A.11 candor about its own signature gap is the model to follow here.
- **Recommendation:** add `registration_date` to the signed field set in a future signing-profile revision, or have the resolver treat unsigned history data as untrusted (e.g., cap or zero the history component when the field is not signature-covered), or at minimum document the exposure.

### H-4. DillClaw spec contradicts itself on stale-data semantics; `REGISTRY_STALE` is unreachable
- **§7.3:** when the registry is unreachable within the stale window, the resolver MUST serve the cached record **with `stale: true` and `cached_at`** — i.e., a successful response.
- **§8.2 error table:** lists `REGISTRY_STALE` as an **HTTP 503 error** described as "Serving stale cached data. Registry unreachable. Includes cached_at timestamp."
- These cannot both hold: serving stale data is either a disclosed success (§7.3) or a 503 error (§8.2). The implementation follows §7.3 — `resolver/server.js` returns HTTP 200 `status: "resolved"` with `stale: true`, and although `REGISTRY_STALE` appears in its `HTTP_FOR` map, **no code path ever emits it**.
- **Recommendation:** remove `REGISTRY_STALE` from §8.2 (or redefine it for a genuinely distinct condition) and note that stale service is the §7.3 success path.

---

## MEDIUM Findings

### M-1. Resolver implements error codes, request fields, and modes the spec does not define
`resolver/server.js` emits:
- **`SIGNATURE_FILTERED` (404)** — all candidates eliminated by signature eligibility.
- **`VERSION_CONSTRAINT_FAILED` (404)** — no candidate satisfies `version_pref`.
- **`allow_unsigned` request field** — DillClaw §6.1 says missing-signature candidates "MAY be returned only if caller policy permits unsigned records" but never defines the mechanism; the implementation invented the field name.
- **`DILLCLAW_DIAGNOSTIC_MODE` env var** — §6.1's "explicitly declared diagnostic mode," likewise undefined by the spec.
- **`max_results` capped at 50** — spec says "optional, default: 1" with no upper bound.

The behaviors are sensible and arguably *required* by §6.1's MUST/MAY language, but DillClaw §8.2's error table is presented as the complete enumeration and a second implementer would produce incompatible wire behavior. **Recommendation:** spec revision adding the two error codes, the `allow_unsigned` field, the diagnostic-mode declaration, and the `max_results` bound.

### M-2. Registry `/lookup` orders versions lexicographically, not by semver precedence
`registry/server.js` `lookupByName`: `SELECT ... ORDER BY version DESC` on a TEXT column. `"10.0.0"` sorts **before** `"2.0.0"` is false — lexicographically `"10.0.0" < "9.0.0"`, so a record at version 10.x would be ordered below 9.x. Any consumer treating the first `/lookup` result as "latest" gets the wrong record once any component crosses a double-digit version boundary. The Resolver protects itself (it re-sorts with its own `compareSemver`), but `/lookup` is a public API surface. **Recommendation:** sort in application code with a semver comparator.

### M-3. Anthill nonce-replay scope: spec is per-node, implementation is global
Anthill spec §4: a signal MUST be rejected if its nonce "matches a previously accepted signal **from the same originating_node**." `anthill/server.js` `checkNonce` queries `WHERE signal_nonce = ?` with **no originating_node filter** — a global check. Consequence: if node B submits a nonce that node A used, node B is rejected **and flagged with a CRITICAL ANT-RA**, which the spec does not call for. Global uniqueness is defensible (and arguably stronger), but it is a conformance divergence with reputational consequences for the flagged node. **Recommendation:** align one to the other; if global is intended, the spec should say so.

### M-4. Anthill spec dead/incorrect internal section references
- A.5, A.6, A.7, A.8 reference **"§11"** for response protocols — the document only has §1–§9 (response protocols appear to be §7).
- A.5 references **"§6.1"**, which does not exist.
- A.10 references "threshold calculation (§6)" — thresholds are in §5.
- §1 cites "Anthill §3 and §5" for the signal taxonomy — it is §4.
- Pattern suggests section renumbering after the appendices were drafted. **Recommendation:** one editorial pass over all internal references.

### M-5. Port numbers drift across documents
- Registry Spec §10.2 example deployment: Registry on **7475**, Resolver on **7474**.
- Governance Framework §02: "port 7474" / "port 7475."
- Code defaults, README, CLAUDE.md, and the live deployment: **9475 / 9474 / 9476**.
- **Recommendation:** normalize examples to 9474/9475/9476 or mark them explicitly as arbitrary.

### M-6. Registry Spec §2.2 vs §10.3 mirror-field definitions diverge
§2.2 defines the mirror integrity field as a "lowercase hexadecimal SHA-256 digest of exact UTF-8 bytes … computed without re-encoding" with an RFC 3339 timestamp; §10.3 describes "an ISO 8601 timestamp" and "a hash … **as signed by the DNSO**" — implying a signature over the digest rather than a bare digest, and using the looser timestamp standard the stack elsewhere forbids. **Recommendation:** make §10.3 reference §2.2 verbatim.

### M-7. Revocation-propagation story: 60s refresh vs 300s TTL vs snapshot architecture
- Registry Spec §10.1/§11.1: resolvers re-fetch `/list` every **60s**; "revocations propagate within this window (default 60s)."
- DillClaw §7.2: record cache TTL default **300s**; §7.5 ties the revocation guarantee to "one TTL interval."
- Implementation: the resolver serves every resolution from the `/list` snapshot (refreshed every 60s, `DILLCLAW_REGISTRY_REFRESH_MS`); the §7.2 record cache (`cache.setRecord`) is written but **never consulted for resolution** — it only feeds the `cache_hit` flag. So real propagation is 60s, but a conformant implementation built literally on §7.2's TTL-driven record cache would have a 300s window.
- **Recommendation:** the two specs should agree on which mechanism is normative for revocation freshness; DillClaw §7 should describe the snapshot-refresh architecture if that is the intended design.

### M-8. ANT-WF acronym contradiction
Anthill §4 defines ANT-WF as "**Wildcard Fanout** Anomalies"; A.10 expands it as "**Well-Formedness**." One of these is wrong. **Recommendation:** correct A.10.

### M-9. Glossary listed in Standards Overview but absent from the repo
Standards Overview v1.0.10 maturity table lists **Glossary v1.0.2** at `dillweed.com/glossary.html`; `specs/` contains no `glossary.html`. Either the file is missing from the repo (spec-surface drift between website and repository) or the Overview lists an unpublished document. **Recommendation:** add the file or remove the row.

---

## LOW Findings

### L-1. Document-taxonomy descriptions disagree
- Standards Overview describes "two cross-cutting documents (Anthill + Continuity Protocol)"; the Governance Framework's taxonomy is "one cross-cutting document" plus a "governance support protocol" (GSP-01).
- GSP-01 §01 lists the Operations Charter separately after "the five core specifications," though the Charter is one of the five.

### L-2. Stale version self-references inside the Anthill spec
§8 and A.4 refer to "the current v0.1.1 implementation"; the document is v0.1.2 and the shipped implementation is v0.1.6.

### L-3. Stale version references in implementation comments
- `anthill/server.js` line 4 header: "Dillweed Anthill™ **v0.1.5**" while `VERSION = 'dillweed-anthill/0.1.6'`; the changelog block below it is labeled "v0.1.0 (May 2026)."
- `resolver/server.js` cites "Namespace Standard **v0.4.2** §3.4" (current: v0.4.3) and "Registry v0.1.4 / **v0.2.7**" (current implementation: v0.2.8).
- DillClaw spec §3 example response shows `"resolver_version": "dillclaw/0.1.2"` — six patch versions behind the shipped v0.1.8 (examples are illustrative, but the field is also how callers detect behavior differences).

### L-4. Integration test uses a non-spec field and skips Anthill functionally
- `integration-test.sh` registers with `"schemas": {}` — not a Registry Spec §3.1 field. The Registry silently ignores it (the real fields are `input_schema`/`output_schema`), so the test record exercises the schema-absent path only, and the test would not catch schema-field signing regressions.
- Anthill coverage is `/health` only — no signal submission, no nonce-replay, no sequence-violation, no aggregation assertions, despite that being the most intricate conformance surface (§4 REQ-7 CRITICAL ANT-RA generation).
- Step 6 waits 70s for the 60s `/list` refresh — correct for the implemented architecture, but the comment cites "DillClaw spec §7.5," whose TTL framing is the 300s record cache (see M-7).

### L-5. Wildcard 200-candidate rule worded two ways in DillClaw spec
The query-language section makes >200 candidates a `QUERY_TOO_BROAD` error (what the code does); §11.1 says wildcard queries "return a maximum of 200 results," which reads as truncation. Minor wording alignment needed.

### L-6. Anthill §5 dedup description doesn't match §4 mechanism
§5 says signals are "deduplicated by node identifier and timestamp"; the actual (and implemented) mechanism is nonce uniqueness + per-node sequence monotonicity per §4. Timestamps are explicitly untrusted per §8, so §5's description is both inaccurate and inconsistent with the spec's own threat model.

---

## INFO / Observations

- **I-1. Open-write posture without admin tokens.** Both Registry and Anthill accept writes with no authentication when `REGISTRY_ADMIN_TOKEN`/`ANTHILL_ADMIN_TOKEN` are unset. Both disclose this at startup and the Registry Spec says writes "should be protected" — acceptable for the local reference deployment, but worth a hard-fail flag for any public deployment.
- **I-2. Anthill A.11 gap confirmed in code.** `node_signature` is type-validated, stored, and never cryptographically verified — exactly as the spec discloses. Node impersonation is possible by design until the Charter's key-registration procedure lands. No new finding; the disclosure is accurate.
- **I-3. Anthill `/aggregate` dual windows exceed spec.** The implementation returns both event-time and received-time rollups per window (a round-2 review enhancement); the spec describes only the event-time model. Useful, and a candidate for spec adoption in the same revision as M-1's items.
- **I-4. Resolver `NOT_FOUND` route error code** (unknown routes) and Anthill's `NONCE_COLLISION`/`SEQUENCE_VIOLATION`/`STORAGE_FAULT`/`PAYLOAD_TOO_LARGE`/`METHOD_NOT_ALLOWED` codes are implementation-defined; the Anthill spec deliberately hosts no API surface (A.9), so this is consistent, but a future Anthill API addendum should enumerate them.

---

## Verified Consistent (PASS)

| Check | Result |
|---|---|
| Canonical JSON signed-field set (10 fields, top-level-only) — Registry ↔ Resolver ↔ Registry Spec §5.2 | byte-identical |
| `dnso_v1_<base64url>` signature profile, ieee-p1363, Ed25519 | matches both implementations |
| Trust score formula 0.40/0.30/0.20/0.10; tier values 1.0/0.85/0.65/0.30; sig 1.0/0.5/0.0; liveness 1.0/0.5/0.0 | implemented exactly (`trustScore`) |
| Banker's rounding (roundTiesToEven) to 3 decimals | implemented (`bankersRound3`) |
| Tie-breaking §6.3: Rule 1 ascending path, Rule 2 ascending semver precedence | implemented in sort comparator |
| Cache TTLs: record 300s/3600s max, liveness 60s, negative 30s, stale window 900s/1800s max (clamped) | match §7.2 |
| Stale-while-revalidate → `stale: true` + `cached_at`, REGISTRY_UNAVAILABLE after window | matches §7.3 + REQ-35 |
| Wildcard rules: not in first component, max 2, >200 → QUERY_TOO_BROAD | implemented |
| `scoring_profile: dillclaw-default-v1` on every response incl. errors and batch | implemented (REQ-5) |
| `sig_unverified` signal for absent/unverifiable signatures (REQ-26) | implemented |
| `trace_id` on every response including early validation errors; traces persisted | implemented (REQ-10) |
| Component naming regex (2–64 chars, lowercase/digit/hyphen, no edge hyphens) | identical in both services, matches §3.3 |
| Both `dillweed://` and `dllwd://` schemes accepted as equivalent | implemented |
| RFC 3339 UTC second-precision timestamps, strict calendar validation | implemented in all three services |
| Anthill: 6 signal classes, 4 severities, window assignment (60s/1h/24h per class) | match §4/§5 |
| Anthill: nonce replay → reject + CRITICAL ANT-RA naming offending node (REQ-7) | implemented (scope divergence noted in M-3) |
| Anthill: per-node monotonic sequence rejection | implemented |
| Anthill: append-only JSONL log + log-first-then-DB durability ordering | implemented |
| Ports: code defaults 9475/9474/9476 ↔ README ↔ CLAUDE.md ↔ integration test | consistent |
| Software versions: Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.6 ↔ README | consistent |
| Registry /promote re-signs records (AUDIT-REG-005); /log conforms to §04 (limit 100/500) | consistent with v0.1.4 |
| Cross-document version references at major.minor granularity | internally consistent convention |
| Charter §2.1 precedence order ↔ Governance §5.7 | consistent |

---

## Suggested Issues (drafts for human review — not filed)

1. **[spec] Resolve verified-tier history conflict: Charter §4.1 (30 days) vs Registry Spec §9 (6 months)** — H-1.
2. **[spec] DillClaw A.7 references undefined Anthill signal classes ANT-AB / ANT-RD** — H-2.
3. **[spec/security] Unsigned `registration_date` controls 30% of trust score** — H-3.
4. **[spec] Remove or redefine REGISTRY_STALE; §7.3 and §8.2 contradict** — H-4.
5. **[spec] Document SIGNATURE_FILTERED, VERSION_CONSTRAINT_FAILED, allow_unsigned, diagnostic mode, max_results bound** — M-1.
6. **[registry] /lookup version ordering is lexicographic, not semver** — M-2.
7. **[anthill] Nonce-replay scope: global vs per-node** — M-3.
8. **[spec] Anthill internal section-reference cleanup (§11/§6.1/§6/§3+§5)** — M-4.
9. **[spec] Normalize port numbers in Registry §10.2 and Governance §02 examples** — M-5.
10. **[spec] Align Registry §10.3 mirror fields to §2.2** — M-6.
11. **[spec] Reconcile 60s refresh vs 300s TTL revocation-propagation story** — M-7.
12. **[spec] Fix ANT-WF expansion in Anthill A.10** — M-8.
13. **[repo] Add glossary.html to specs/ or remove from Standards Overview** — M-9.
14. **[test] Integration test: replace `schemas` with `input_schema`/`output_schema`; add Anthill signal-path coverage** — L-4.

Per the steward boundary, opening any of these requires human approval (`review.issue.open`, exit 2).
