# Dillweed Stack — Cross-Service Trust Boundary Analysis

> **Historical review.** Findings reflect repository state on 2026-06-10, before the W0 hardening wave. Subsequently closed: F-8 (probe SSRF, commits `4447c00`/`8c87a85`) and F-10 (pagination truncation, `d1466c0`/`25670a4`). F-9 is partially narrowed (per-IP rate limiting landed; wildcard CORS and fail-open token defaults persist). **F-3 (CRITICAL), F-1, F-2, F-4, F-5, F-6, F-7, and F-11 remain open or deferred** — re-verified 2026-06-12. See [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md) for current status of every finding. Preserved unmodified as historical evidence.

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Scope:** `registry/server.js` (v0.2.8), `resolver/server.js` (v0.1.8),
`anthill/server.js` (v0.1.6), and the four specs in `specs/`.
**Frame:** Trust-boundary review. For each boundary I state what one service
*assumes* about inputs crossing it, how a third party with network access can
*violate* that assumption, and how the violation *propagates* to corrupt the
correctness of another component.

## Threat model

The reference deployment runs three HTTP services on one host. Two bind
`0.0.0.0` (Registry :9475, Resolver :9474); Anthill binds `127.0.0.1` (:9476).
Write paths are guarded by optional shared bearer tokens
(`REGISTRY_ADMIN_TOKEN`, `ANTHILL_ADMIN_TOKEN`); when unset, writes are open.
The adversary is assumed to have network reach to the listening sockets and, in
some chains, a position on the path between Resolver and Registry, or
possession of a shared token (the README notes tokens are stored in plaintext
launchd plists, INST-011). I distinguish chains that need a token from those
that do not.

## The four trust boundaries

| Boundary | Consumer assumes about producer | Enforced by |
|---|---|---|
| **B1** Registry → Resolver (`/list`, `/lookup`) | Records are authentic and complete; tier and history are trustworthy | Ed25519 signature check **only over 10 fields** |
| **B2** {Resolver, Registry} → Anthill (`/signal`) | `originating_node` is who it claims; replay fields are authentic | Shared bearer token + nonce/sequence bookkeeping — **`node_signature` never verified** |
| **B3** Authoritative Registry → Mirror / Resolver path | Registry reachability and snapshot are honest | Stale-while-revalidate window; no path authentication |
| **B4** External client → any service | Caller is authorized; endpoint/probe targets are safe | Optional token; `endpoint` scheme check; no SSRF guard |

The two structural weaknesses that generate most of the severity: **(1)** the
DNSO signature covers only ten fields, leaving `registration_date` (a trust-score
input) unsigned, and **(2)** Anthill's authenticity field `node_signature` is
spec-mandated (§4: "MUST cover signal_nonce and node_sequence to ensure
authenticity") but the implementation treats it as an optional, unverified
string. Everything below is downstream of those two.

---

## Findings

### F-1 (HIGH) — Unsigned `registration_date` propagates into the trust score
**Boundary B1.** The Resolver computes 30% of every trust score from
`registration_date` (`usageScore`, resolver:735-741). The Registry's canonical
signing payload (registry:113-119, mirrored at resolver:414-420) covers exactly
ten fields: description, endpoint, input_schema, last_updated, name,
output_schema, permissions, protocol, trust_tier, version. **`registration_date`
is not among them.**

- **Assumption violated:** The Resolver treats a record whose signature verifies
  as wholly authentic, and reads `registration_date` from it to award up to
  0.30 of score. Signature validity says nothing about `registration_date`.
- **Attack:** Any party who can present a record to the Resolver — a malicious
  or compromised mirror, an on-path MITM modifying a `/list` body, or a
  registrant on an open Registry — sets `registration_date` to an old date
  (e.g. `2019-01-01`). The signature still verifies (`sig_valid`,
  `sig_verified` both emitted), and `usageScore` returns the clamped maximum
  1.0. A brand-new experimental record can be lifted from ~0.09 to ~0.39, and a
  freshly-registered `verified` record to the top of its band.
- **Propagation:** Registry/mirror/path manipulation → Resolver ranking → the
  agent invokes the attacker's capability believing it has years of standing.
  The DillClaw spec §6.2 security note explicitly acknowledges this exposure;
  the resolver code does not implement the suggested mitigation (cap/zero the
  history component when the field is unverifiable).
- **Fix that breaks the chain:** Add `registration_date` to the signed field
  set in both `canonicalJSON` functions (coordinated Registry+Resolver change),
  **or** have the Resolver zero the usage-history component unless the field is
  covered by signature. The former is the architectural fix.

### F-2 (HIGH) — Self-assigned `canonical`/`verified` tier is scored at face value
**Boundary B1.** `trust_tier` *is* signed, so it cannot be altered in transit —
but the Registry accepts any registrant-declared tier up to `canonical` as a
"provisional" claim (registry:761-796, Registry Spec §7), logging a
`provisional_tier` audit entry but storing and signing the declared tier
verbatim. The Resolver scores `trust_tier` directly (`TIER_SCORE`,
resolver:728) — `canonical` = 1.0, `verified` = 0.85 — and **never consults
`GET /log`** to check whether a DNSO promotion entry exists.

- **Assumption violated:** The cross-service safeguard described in Registry
  Spec §7 and Appendix A.2 ("resolvers detect provisional tiers via the absence
  of a corresponding DNSO promotion audit entry") assumes the Resolver
  correlates the record against the registration log. The reference Resolver
  has no code path that reads `/log`.
- **Attack:** On a writable Registry (token unset, or shared token known), an
  adversary registers a capability with `trust_tier: "canonical"`. It is signed
  by the local key, so the Resolver marks it `sig_valid`/`sig_verified` and
  applies the 0.40 × 1.0 tier weight.
- **Propagation:** Registrant declaration → signed record → Resolver scores it
  as the canonical reference implementation for its category. Combined with F-1
  (backdated history) the record reaches the 0.75–0.89 "strong verified /
  canonical" band intended for cross-organization trust.
- **Fix that breaks the chain:** Implement the provisional-tier check — the
  Resolver fetches `/log?name=<n>&action=promote` and caps unattested
  `verified`/`canonical` to `trusted` for scoring, as the spec anticipates. The
  architectural prerequisite is that DNSO attestation be a *signed, separately
  verifiable* fact, not a tier string the registrant supplies.

### F-3 (CRITICAL) — Anthill never verifies `node_signature`: signals are unauthenticated
**Boundary B2.** Anthill Spec §4 makes `node_signature` a required authenticity
binding ("Ed25519 signature over the canonical serialization of all preceding
fields using the originating node's registered key; the signature MUST cover
signal_nonce and node_sequence"). The implementation's `validateSignal`
(anthill:328-403) treats `node_signature` as **optional**, checks only that it
is a non-empty string when present, and **no code path ever verifies it.**
`originating_node` is an arbitrary caller-supplied string; only
`ANTHILL_AGGREGATOR` is reserved (anthill:95, 359-366).

- **Assumption violated:** Every consumer of Anthill data (the DNSO steward)
  assumes a signal attributed to node *X* actually came from *X*. Nothing binds
  `originating_node` to a key. The shared `ANTHILL_ADMIN_TOKEN` authenticates
  *that the caller may submit*, not *which node they are* — in a multi-node fleet
  every node holds the same token, so any node can author signals as any other.
- **Attack:** A submitter (any holder of the shared token; no token at all if
  unset) POSTs `{ signal_class: "ANT-RA", severity: "CRITICAL",
  originating_node: "<victim-resolver>", signal_payload: {...} }` with no
  `node_signature`. Anthill stores it as an accepted CRITICAL Resolver-Abuse
  signal naming the victim.
- **Propagation:** Fabricated signal → `/summary` / `/aggregate` →
  DNSO stewardship cadence (Anthill §7): ANT-RA CRITICAL triggers "resolver node
  suspension pending investigation and, upon confirmation, decertification."
  An adversary drives governance enforcement against an innocent operator, or
  conversely floods INFORMATIONAL noise to bury a real signal. The entire
  evidentiary purpose of Anthill — neutral, attributable observation — collapses.
- **Fix that breaks the chain:** Verify `node_signature` against a registry of
  per-node Ed25519 public keys before accepting any signal, and reject
  `originating_node` values whose key does not validate the payload. This is the
  spec-mandated behavior that is simply unimplemented.

### F-4 (HIGH) — Sequence-counter poisoning suppresses a victim node's real signals
**Boundary B2.** Replay protection keys the monotonic sequence on the
unauthenticated `originating_node` string (anthill:553-561,
`upsertNodeSeq`). Because F-3 leaves `originating_node` unauthenticated, the
counter for any node can be advanced by anyone.

- **Attack:** The adversary submits one signal as `originating_node:
  "<victim>"` with `node_sequence: 2000000000`. Anthill records that as the
  last accepted sequence for the victim. Every subsequent *legitimate* signal
  from the real victim node (using its true, lower sequence) is now rejected
  with `409 SEQUENCE_VIOLATION`.
- **Propagation:** The victim resolver believes it is reporting ANT-RC
  revocation-cascade or ANT-DN abuse signals; Anthill silently rejects them; the
  DNSO never sees the evidence. A targeted blind spot in the observability
  plane — the inverse of F-3's fabrication: **selective signal suppression.**
- **Fix that breaks the chain:** Same as F-3 — bind sequence ownership to a
  verified node key so an attacker cannot advance another node's counter.
  Per-node sequence state must be partitioned by *authenticated* identity.

### F-5 (MEDIUM) — Replay reflection frames a victim via the auto-generated ANT-RA
**Boundary B2.** On a nonce collision Anthill auto-generates a CRITICAL ANT-RA
naming `body.originating_node` as the offending node (anthill:464-549, Spec §4
REQ-7). Since the caller controls `originating_node` (F-3), the "offending node"
in the escalation is attacker-chosen.

- **Attack:** The adversary captures or obtains any previously-accepted signal's
  nonce, then resubmits it with `originating_node: "<victim>"`. The nonce
  already exists → Anthill emits a CRITICAL ANT-RA naming the victim and logs it
  immutably.
- **Propagation:** The replay-protection mechanism intended to *catch* abuse is
  turned into a tool to *manufacture* an abuse record against a chosen target,
  feeding the same §7 suspension/decertification cadence as F-3.
- **Fix that breaks the chain:** Verifying `node_signature` (F-3) makes the
  offending-node attribution authentic; until then, the auto-ANT-RA should name
  the transport-observed source, not the self-declared field.

### F-6 (HIGH, conditional) — Open Registry writes yield signed capability impersonation
**Boundary B4 → B1.** If `REGISTRY_ADMIN_TOKEN` is unset, `isAuthorized` returns
`true` for all writes (registry:415-419) and the service binds `0.0.0.0`. The
README's own startup banner flags "open (set REGISTRY_ADMIN_TOKEN to secure)."

- **Attack:** A network adversary `POST /register`s a look-alike path
  (`dllwd://payments.processor.acme`, `agents.analysis.financial.core`) pointing
  `endpoint` at attacker infrastructure, at `trust_tier: "canonical"`. The
  Registry signs it with the deployment's local DNSO key — the same key whose
  public half the Resolver uses — so the Resolver verifies it as authentic
  (`sig_valid`, `sig_verified`).
- **Propagation:** Open write path → signed record → Resolver returns the
  attacker endpoint as a trusted capability. Stacks with F-1 and F-2 to reach
  the top trust band. This is namespace poisoning + capability impersonation
  with a *valid* signature, because the Registry is an oracle that signs
  whatever authorized (here, unauthenticated) callers submit.
- **Fix that breaks the chain:** Require a token by default (fail closed if
  unset, rather than open), and bind to loopback like Anthill unless a token is
  configured. Architecturally, registrant identity (Registry Spec Appendix A.1)
  must gate who may occupy a namespace path.

### F-7 (MEDIUM) — Path-position adversary freezes revocations for the stale window
**Boundary B3.** The Resolver's only revocation-propagation mechanism is the
60-second `/list` refresh (resolver:208-244). On refresh failure it serves the
last good snapshot for `STALE_WINDOW_MS` (default 900s, max 1800s,
resolver:46-49) with a `stale: true` flag, then returns `REGISTRY_UNAVAILABLE`.

- **Assumption violated:** The stale-while-revalidate design assumes registry
  unreachability is benign (an outage). An adversary on the Resolver→Registry
  path controls *when* "unreachable" begins.
- **Attack:** The adversary waits until a target capability is present and valid
  in the Resolver's snapshot, then blackholes the Resolver's `/list` requests
  (drops packets / resets). The DNSO revokes the capability at the Registry, but
  the Resolver keeps serving the pre-revocation snapshot — including the revoked
  record — for up to 30 minutes, disclosing only `stale: true`.
- **Propagation:** Registry revocation does not reach the Resolver; agents keep
  resolving a capability the DNSO has killed. `stale:true` is advisory and does
  not prevent the result being returned as `resolved`.
- **Fix that breaks the chain:** Shorten the stale ceiling for
  security-relevant deployments and/or require a signed freshness assertion
  (snapshot timestamp signed by the Registry) so the Resolver can distinguish
  "registry quiet" from "someone is holding my snapshot stale." A revocation
  feed with positive acknowledgement (rather than inferring revocation from
  absence in a refetched list) removes the freeze entirely.

### F-8 (MEDIUM) — Blind SSRF via `probe_liveness` against attacker-chosen endpoints
**Boundary B4.** With `probe_liveness: true`, the Resolver issues a HEAD request
to each candidate's `endpoint` (resolver:812-825, 910-913). `endpoint` is
attacker-controlled at registration; the Registry validates only that it parses
as an http/https URL (registry:330-345), not that it is non-internal.

- **Attack:** Register a capability with `endpoint:
  http://169.254.169.254/latest/meta-data/` (or an internal host/port), then
  send a resolve with `probe_liveness: true`. The Resolver makes the request
  from its own network position.
- **Propagation:** The Resolver becomes an SSRF pivot. The liveness result
  (`statusCode < 500`) is reflected into `trust_signals`
  (`endpoint_live`/`endpoint_unreachable`), giving a coarse internal
  port-scan / reachability oracle even though response bodies are not returned
  (blind SSRF).
- **Fix that breaks the chain:** Deny-list internal/link-local/loopback ranges
  before probing, and resolve+pin the host to a public address. Registration-time
  endpoint validation should reject non-routable targets.

### F-9 (MEDIUM) — Wildcard CORS plus open writes enables drive-by Registry mutation
**Boundary B4.** All three services emit `Access-Control-Allow-Origin: *` and
allow POST with `Authorization`/`Content-Type` (registry:971-974). With
`REGISTRY_ADMIN_TOKEN` unset, no credential is needed.

- **Attack:** A user on the deployment's network visits a malicious web page;
  the page's script issues `POST http://<host>:9475/revoke` or `/register`. The
  preflight is permitted by the wildcard policy and the server, lacking auth,
  executes the write.
- **Propagation:** Browser-driven revocation/registration without the adversary
  ever directly reaching the socket — a CSRF bridge into B1/B6 chains.
- **Fix that breaks the chain:** Do not combine `ACAO: *` with state-changing
  endpoints; require a token (fail closed), and scope CORS to known origins for
  write paths.

### F-10 (LOW/MEDIUM) — `/list` pagination cap silently truncates the Resolver's worldview
**Boundary B1/B3.** `refreshList` reads `parsed.records` from a single `/list`
call (resolver:208-220); the Registry caps `/list` at 500 records per response
(registry:453, `limit` max 500) and the Resolver never paginates.

- **Propagation:** Once the authoritative set exceeds 500 records, every record
  beyond the first page is invisible to the Resolver — silent `NO_MATCH` for
  legitimate capabilities, and an availability cliff an adversary could induce
  by mass-registering filler records to push a target past the page boundary on
  an open Registry. A correctness/availability propagation rather than an
  integrity one.
- **Fix that breaks the chain:** The Resolver must page through `/list` to
  completion (or the Registry must expose a complete-snapshot endpoint).

### F-11 (LOW) — `received_at` timestamps are clock-dependent (acknowledged)
**Boundary B2.** Anthill stamps `received_at` from local system time
(anthill:263-265); §8 "Timestamp Integrity: Known Limitation" already documents
that both `signal_timestamp` (caller-supplied) and `received_at` are
manipulable and that admissibility requires RFC 3161 timestamping. Logged here
for completeness because F-3/F-4 make timestamp trust moot until authenticity
exists, but the spec discloses it and the dual-window `/aggregate` (anthill:729-771)
is a partial mitigation.

---

## Severity summary

| # | Severity | Boundary | One-line |
|---|---|---|---|
| F-1 | HIGH | B1 | Unsigned `registration_date` inflates usage-history score |
| F-2 | HIGH | B1 | Self-declared canonical/verified tier scored at face value; resolver never checks `/log` |
| F-3 | CRITICAL | B2 | `node_signature` never verified → signals fully forgeable/attributable to any node |
| F-4 | HIGH | B2 | Sequence-counter poisoning suppresses a victim node's real signals |
| F-5 | MEDIUM | B2 | Nonce-replay reflection auto-frames a victim via CRITICAL ANT-RA |
| F-6 | HIGH* | B4→B1 | Open Registry writes → signed capability impersonation (*if token unset/known) |
| F-7 | MEDIUM | B3 | On-path adversary freezes revocations up to the 30-min stale window |
| F-8 | MEDIUM | B4 | Blind SSRF via `probe_liveness` + attacker endpoint |
| F-9 | MEDIUM | B4 | Wildcard CORS + open writes → drive-by revocation/registration |
| F-10 | LOW/MED | B1 | 500-record `/list` cap silently truncates resolver's record set |
| F-11 | LOW | B2 | `received_at` clock-dependent (spec-acknowledged) |

## The two architectural fixes with the most leverage

1. **Make authenticity cover the fields that carry trust.** The DNSO signature
   must include `registration_date` (closes F-1), and DNSO tier attestation must
   be a separately signed/verifiable fact the Resolver checks rather than a
   registrant-supplied tier string (closes F-2). Both are coordinated
   Registry+Resolver changes to the canonical signing model and the resolver's
   evaluation pipeline.
2. **Verify `node_signature` at Anthill against per-node keys.** Implementing
   the §4 authenticity binding — reject any signal whose `node_signature` does
   not validate under the claimed `originating_node`'s registered key — closes
   F-3, F-4, and F-5 at once and restores the evidentiary value Anthill exists
   to provide. The shared admin token is access control, not authenticity, and
   cannot substitute for it.

Securing write paths by default (token required / loopback bind / no wildcard
CORS on mutations) closes the conditional chains F-6 and F-9; endpoint
deny-listing closes F-8; a signed freshness/revocation feed closes F-7.
