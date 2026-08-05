# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-10 (r3 — post-W0 consistency review)
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Scope:** Specification stack (`specs/`, 8 documents) vs. reference implementation (`registry/`, `resolver/`, `anthill/`) and `integration-test.sh`, at branch `v2/w0-hardening` (W0 complete, commits `74cad67`…`e523652`, not pushed).
**Boundary:** `review.spec.read`, `review.repo.read`, `review.report.write` — all verified ALLOWED (exit 0) via `enforce-boundary.sh` before execution.

## Summary

The spec stack is internally coherent: document versions agree with the Standards Overview maturity table, sampled cross-document section references all resolve, the trust-tier enum and the ten signed canonical-JSON fields are consistent across every document and the code, and the namespace component grammar (NS §3.3) is enforced byte-for-byte identically by registry and resolver. The dominant theme of this review is **expected post-W0 drift**: all six W0 hardening changes introduced behavior the specs (Registry v0.1.5, DillClaw v0.1.7, Anthill v0.1.3) do not yet describe — and in one case (Registry §11.3) now directly contradict. Three findings are HIGH: the §11.3 contradiction, the Anthill spec's complete absence of an HTTP API definition, and the resolver's silent catalog truncation against a paginated `/list`. One genuine code-conformance bug was found (probe-repeat MUST violation, mitigated by W0's default-off). The integration test has a new timing exposure introduced by W0's refresh jitter. The running deployment (9474/9475/9476) predates W0, so the branch is currently ahead of *both* other surfaces; this is expected pending the steward's push/deploy decision.

## Step Results

### Step 1 — Document inventory & version consistency
**Status:** PASS
Spec versions: Namespace Standard v0.4.4, DillClaw v0.1.7, Registry v0.1.5, Anthill v0.1.3, Standards Overview v1.0.10 — the overview's maturity table and footer links agree with every document's self-declared version. Implementation constants (`dillweed-registry/0.2.8`, `dillclaw/0.1.8`, `dillweed-anthill/0.1.6`) match the README/release-notes claims. Two test-suite headers are off (L-1, L-2).

### Step 2 — Cross-document references
**Status:** PASS
Sampled normative cross-references all resolve: Registry→Namespace Standard §8.3 (exists), Registry→DNSO Operations Charter §4.1 (exists), Registry internal §5.6/§10.3 (exist), DillClaw→Registry §5.2 ten-field enumeration (matches both the Registry spec and `canonicalJSON()` exactly). The major.minor cross-reference convention (stated identically in Continuity Protocol, Governance, and Charter) is applied consistently.

### Step 3 — Undefined terms
**Status:** PASS (one LOW finding)
"Stack Family 2026.04" is defined in Continuity Protocol §7 as the founding corpus label. "Founding Phase" is used as a status label consistently. One stretch: Anthill §8 invokes a "Stack Family convention" for *parameter versioning* that no document defines as a versioning scheme (L-4). ANT-HB / ANT-NU are properly fenced as "provisionally named" future work in Anthill Appendix A.6 — not phantom classes.

### Step 4 — Spec ↔ code consistency
**Status:** FINDING (H-1, H-3, M-1, M-2, M-4)
Details in Findings. Confirmed-consistent highlights: trust-tier enum (`experimental, trusted, verified, canonical`) identical in NS §7.1, Registry §3.1 field table, and `VALID_TIERS`; component regex `/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|…/` enforces NS §3.3 (2–64 chars, no edge hyphens) identically in both services; resolver spec v0.1.7's error table matches code (SIGNATURE_FILTERED added, REGISTRY_STALE removed in 0.1.6 — the spec has tracked code well); Anthill's nonce-replay MUST (reject 409 + generate CRITICAL ANT-RA naming the offender) is implemented exactly; registry mirror /health MUST-fields (`authoritative_snapshot_timestamp`, `authoritative_signature_hash`) are emitted with the spec'd names and validated formats.

### Step 5 — Specification gaps
**Status:** FINDING (H-2, L-3)
The Anthill specification (9 sections) defines no HTTP API whatsoever — no endpoints, no request/response schemas, no error-code table — while the reference implementation exposes 5 endpoints and 10 error codes that `integration-test.sh` and the deployment treat as the contract. Registry §04 leaves the `/list` default page size unstated.

### Step 6 — Integration test review (static)
**Status:** FINDING (M-3) + BLOCKED (execution)
Execution was **not** performed: `integration-test.sh` registers and revokes records against the registry (default ports = production 9475), which falls under the forbidden "Modifying the Registry database." Static review only. Its assertions are tolerant greps (robust to W0's additive /health fields), but its fixed waits collide with W0's jittered refresh (M-3).

## Findings

### HIGH

**H-1 — Registry Spec §11.3 now factually contradicts the reference implementation.**
§11.3 states: *"The reference implementation does not itself enforce rate limits."* As of commit `a1a95d1`, all three services enforce per-IP fixed-window limits returning `429 RATE_LIMITED` with `Retry-After`. The spec's claim about its own reference implementation is false on this branch, and `RATE_LIMITED`/429 appears in no error table of any of the three specs. The v2 design (§4.4) already enumerates this exact spec change as required; it should land with (or before) the W0 deploy.
*Affected:* registry-spec §11.3 + error semantics; dillclaw-spec §8.2/§11; anthill-spec (no error table exists — see H-2).

**H-2 — Anthill spec defines no HTTP API; the entire wire contract is implementation-defined.**
anthill-spec v0.1.3 (§1–§9) is a taxonomy/framework document. It defines signal classes, severities, aggregation windows, and replay rules — but zero endpoints, zero request/response schemas, and zero HTTP error semantics. The implementation exposes `GET /health`, `POST /signal`, `GET /signals`, `GET /aggregate`, `GET /summary` with 10 error codes (`NONCE_COLLISION`, `SEQUENCE_VIOLATION`, `PAYLOAD_TOO_LARGE`, …). Anything that integrates with Anthill is coding against unversioned, unspecified behavior. (The v2 design's Area 3 re-layering will reshape this API — specifying the v1 surface should be weighed against that timing, but the gap should at least be acknowledged in the spec.)

**H-3 — Resolver silently truncates its catalog snapshot at the registry's default page size; Registry §04 self-contradicts.**
`refreshList()` fetches bare `GET /list` — no `limit` parameter, no pagination loop. The registry's default page is 100 (cap 500; default unstated in the spec). Catalogs beyond 100 active records would silently vanish from every resolver snapshot: valid capabilities would return `NO_MATCH`, with no error or staleness indication. Registry §04 compounds this by saying `/list` *"Returns **all** active Capability Records"* and *"Maximum 500 records per response"* in the same paragraph. Current operational exposure is low (catalog ≈ 7–25 records), and the v2 design (§2.2.7 "resolver pages /list to completion", §2.2.2 delta feed) already plans the fix — but nothing in W0 closed it, and the failure mode is silent. Recommend either a fast-follow (resolver pages to completion using the now-SQL-backed pagination) or an explicit interim note in both specs.

### MEDIUM

**M-1 — Code violates DillClaw §7's probe-cache MUST.**
§7: *"Probes MUST NOT be repeated on every resolution request"* (liveness cache TTL 60s). `resolveQuery` step 4 fires `probeEndpoint()` for every candidate on every probe-enabled request without consulting `cache.getLiveness()` first — the cache is only read at scoring time. When probing is enabled, N identical requests in a minute produce N probes per endpoint, which is exactly what the MUST forbids. W0's global default-off reduces real-world exposure but does not cure the conformance violation. One-line fix candidate: skip the probe when a fresh liveness entry exists.

**M-2 — All six W0 behaviors are unspecified (expected drift; spec revisions now due).**
None of the following appear in any spec: ETag/`If-None-Match`/`If-Modified-Since`/304 + `Last-Modified` on `/list`; per-IP read/write rate budgets, `429`, `Retry-After`, and the `rate_limit` /health blocks (all three services); the resolver's global probe gate (`DILLCLAW_PROBE_LIVENESS_ENABLED`), internal-range deny-list, and host-pinning; refresh jitter/backoff and the `registry.refresh` /health block; the `capability_tags` storage-model addition. The v2 design §2.4/§4.4 already enumerates the required spec changes — this finding is the checklist for executing them. Until specs are revised, the published specs describe neither the branch nor (post-deploy) production.

**M-3 — `integration-test.sh` revocation-propagation wait can now race W0's jitter.**
Line 283 documents *"Default fetch interval: 60s — waiting 70s to ensure refresh"* and sleeps 70s. The jittered interval is 48–72s (±20%), so a refresh landing at +71–72s fails the revocation assertion spuriously. The earlier registration-visibility check (3s + one 10s retry) was already racy pre-W0 and is now wider. Recommend: wait ≥ `base × 1.2 + margin` (e.g., 80s), or poll the resolver's `/health` `registry.last_fetch`/`refresh` fields (added in W0) until a refresh is observed — which would make the test deterministic instead of timed.

**M-4 — DillClaw §7.5's normative propagation language no longer matches refresh behavior.**
§7.5: revocation propagation *"within one registry refresh interval"*, with the reference implementation described as refreshing *"every 60 seconds."* Post-W0 the healthy-path interval is 48–72s (jitter), and under consecutive failures the interval backs off to 15 minutes — meaning the propagation bound stretches precisely during registry instability, when revocation latency matters most. The spec's own escape hatch (*"implementations that use a different refresh mechanism MUST document their revocation propagation bound"*) now applies to the reference implementation itself. Needs a §7.5 revision documenting the jittered bound and the backoff behavior.

### LOW

**L-1 — `resolver/test.sh` header says "v0.1.9"; implementation is `dillclaw/0.1.8`.** One of the two is wrong; everything else (spec changelog, README) says 0.1.8.
**L-2 — `anthill/test.sh` header typo: "Test Suite (v0..6)"** — missing digit (should be v0.1.6).
**L-3 — Registry §04 does not state the `/list` default page size (100).** Callers reading only the spec will assume a bare `GET /list` returns the full catalog (the spec's own prose says so — see H-3).
**L-4 — Anthill §8 cites a "Stack Family convention" for parameter versioning that no document defines as a convention.** Continuity Protocol §7 defines "Stack Family 2026.04" as a corpus label only.
**L-5 — Stale spec-version citations in code comments.** `registry/server.js` comments cite "Registry Spec v0.1.4 §…" in several places; the spec is at v0.1.5. Historical context, cosmetic.
**L-6 — `COMPONENT_RE` second alternative (`^[a-z0-9]{2}$`) is redundant** — the first alternative already matches all 2-character components. No behavioral impact; both services share the identical regex.

## Notes (no action required)

- **N-1:** Three-surface skew is currently deliberate: branch `v2/w0-hardening` (6 commits) is ahead of both the published specs and the running deployment (9474/9475/9476, pre-W0 builds). Spec revisions (M-2) and deploy/push are the steward's pending decisions.
- **N-2:** The mirror-hash page-dependence (hash over "the /list response body" when /list is paginated) remains as designed-around in v2 design G-2/§2.2.3 (signed checkpoints) — restated here because SQL pagination makes the page boundary structural.
- **N-3:** `integration-test.sh` was reviewed statically only; executing it writes (register/revoke) to whatever registry it targets, and its defaults point at production. Its revoke-based cleanup is also permanent-by-design in the registration log (§8.1 immutability), so even "clean" runs accrete log entries on production.

## Suggested Issues

1. **[spec] Registry §11.3 contradicts reference implementation post-W0 rate limiting** — revise §11.3, add 429/`Retry-After` to error tables across all three specs (H-1, M-2).
2. **[spec] Anthill: specify the HTTP API surface (or formally mark it implementation-defined pending Area 3)** (H-2).
3. **[resolver] Page `/list` to completion when warming the snapshot; [spec] fix Registry §04 "returns all records" wording and state the default limit** (H-3, L-3).
4. **[resolver] Honor the liveness cache before issuing probes (DillClaw §7 MUST)** (M-1).
5. **[spec] DillClaw §7/§7.5: document probe gating/deny-list, jitter band, and backoff-adjusted propagation bound** (M-2, M-4).
6. **[test] integration-test.sh: replace fixed 70s wait with /health-driven refresh detection** (M-3).
7. **[chore] Test-suite header fixes (resolver v0.1.9→0.1.8, anthill v0..6→v0.1.6)** (L-1, L-2).

## Proposed Ledger Entry

> **2026-06-10 — Post-W0 consistency review (steward, review-and-recommend).** Full sweep of the 8-document spec stack against the `v2/w0-hardening` reference implementation and integration test. Stack-internal consistency: PASS (versions, cross-references, tier enum, signed-field set, name grammar all coherent). 3 HIGH findings: Registry §11.3 now contradicts the implemented rate limiting; Anthill spec defines no HTTP API; resolver silently truncates catalog at /list default page size. 4 MEDIUM (probe-cache MUST violation; six W0 behaviors awaiting spec revisions per design §2.4/§4.4; integration-test jitter race; §7.5 propagation bound). 6 LOW. Report: `Dillweed-Agent/reports/steward-report-2026-06-10-r3.md`. Integration test reviewed statically (execution writes to production registry — out of read-only boundary).
