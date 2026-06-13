# Dillweed Namespace Project — v2 Architecture Design

> **Design document — partially outdated.** The Areas 1–6 design content stands, but the W0 row no longer matches what shipped: fail-closed defaults/CORS (F-9) and async/bounded/rotated trace sinks + retention were in this design's W0 but dropped from the executed W0, so "W0 closes F-9" is only half-true. JCS has no owning area, and W1 signature verification depends on a serialization spec scheduled in W4. See [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md) (FDI-XST-004, FDI-XST-006, FDI-CRY-002) for current status. Preserved as the v2 design of record.

**Status:** Draft for Comment
**Date:** 2026-06-10
**Author:** Dillweed Protocol Steward (review-and-recommend)
**Targets:** Registry Specification (v0.1.5 → v0.2), DillClaw Resolver Specification
(v0.1.7 → v0.2), Anthill Observability Plane Specification (v0.1.3 → v0.2), DNSO
Operations Charter (v1.0 → v1.1), Namespace Standard (v0.4.4 → v0.5)
**Stack Family target:** 2026.Q4

> **Scope note.** This is a design document, not a specification. It proposes
> architecture and a migration path for the next major revision of the Dillweed
> stack. Normative spec text is the deliverable of the per-document revisions this
> design calls for; section "Spec changes required" in each area lists what those
> revisions must contain. The design is grounded in the v1 reference deployment on
> `dill-p-001` (Registry 0.2.8, Resolver 0.1.8, Anthill 0.1.6) and the architecture
> reviews, comparative analyses, and gap reports produced 2026-06-09/10.

---

## 0. Why v2

v1 is a coherent, honestly-documented single-host reference deployment. Its data
model, validation discipline, signing model, and governance surface are strong and
are carried forward largely unchanged. v2 exists to move the stack from **one
DNSO-operated box that one operator trusts** to **a multi-organization namespace
that a hundred resolver nodes across organizations can join, sync from, observe,
and be governed within — without sharing a god-token or trusting each other's
honesty.**

Five v1 facts force the redesign. Each is documented in the v1 review corpus and
recurs across every area below:

1. **Identity is a shared secret, everywhere.** The Registry write path, and Anthill
   ingestion, are each gated by a single shared bearer token; `caller` and
   `originating_node` are self-declared, unauthenticated strings. There is no notion
   of *which* org or *which* node acted. (Registry review S7; Anthill review S1/S2;
   trust-boundary F-3/F-6.)
2. **Freshness funnels through one full-catalog poll.** Every resolver `GET /list`s
   the entire catalog every 60s with no ETag, delta, or cursor; the authoritative
   Registry is a single SQLite writer with no replication, and "mirror mode" is
   specified but has no sync mechanism in code. (Registry review S1/S2/S3; resolver
   review S1; mirror gap report G-1/G-2/G-6/G-7.)
3. **The observability plane rebuilds commodity infrastructure and defers its moat.**
   Anthill hand-rolls transport, storage, windowed aggregation, and (unbuilt)
   alerting, while deferring the three things only it can do — signature
   verification, Registry corroboration, completeness attestation. (Anthill review;
   Anthill-vs-OTel comparative.)
4. **No backpressure anywhere, and the root key shares a process with the public
   socket.** None of the three services rate-limits in code; the DNSO private key is
   `readFileSync` into the same Node process that terminates public HTTP. (Registry
   review S4/S5; resolver review S2/S3; trust-boundary F-8.)
5. **"Append-only" is a convention, not a proof.** All three logs are append-only
   only because no endpoint mutates them; none is hash-chained or signed. (Registry
   review S9; Anthill review S6.)

The six work areas below address these directly. They are designed to land as
**separable, independently-shippable revisions** — consistent with the phased
posture Anthill Appendix A already adopts — sequenced by dependency, not bundled
into one cutover.

### Dependency ordering at a glance

```
   ┌─────────────────────────────────────────────────────────┐
   │ AREA 1  Authenticated identity (registrants/resolvers/    │
   │         nodes) — the keystone; unblocks 3, 4 (per-tenant) │
   └───────────────┬───────────────────────┬───────────────────┘
                   │                       │
        ┌──────────▼─────────┐   ┌─────────▼──────────┐
        │ AREA 5  Key         │   │ AREA 6  Tamper-     │
        │ isolation (offline  │   │ evident logging     │
        │ root + intermediate)│   │ (Merkle/CT-style)   │
        └──────────┬─────────┘   └─────────┬──────────┘
                   │                       │
        ┌──────────▼───────────────────────▼──────────┐
        │ AREA 2  Scalable sync (ETag/delta/index;     │
        │         real mirrors) — consumes 5 + 6       │
        └──────────┬───────────────────────────────────┘
                   │
        ┌──────────▼──────────┐   ┌──────────────────────┐
        │ AREA 4  Rate limiting│   │ AREA 3  Anthill on    │
        │ (per-identity quota) │   │ OpenTelemetry         │
        └──────────────────────┘   └──────────────────────┘
```

Area 1 is the keystone: authenticated identity is the precondition for per-tenant
rate limits (Area 4), for node-attributed signals (Area 3), and for scoped sync
credentials (Area 2). Areas 5 and 6 are independent of 1 and can proceed in
parallel. Area 2 consumes the offline-root key model (5) and the signed log
checkpoints (6).

---

## Area 1 — Authenticated Identity Model

### 1.1 Current v1 limitation

There is exactly one form of write authorization in the stack — a shared bearer
token per service — and no form of authenticated *identity* at all.

- **Registrants.** `REGISTRY_ADMIN_TOKEN` is a single secret that authorizes
  `/register`, `/revoke`, and `/promote` for every registrant. Any token-holder can
  revoke or promote any other org's records and self-assign `canonical` tier. The
  `caller` recorded in `/log` is the unauthenticated `x-dillclaw-caller` header —
  spoofable, so audit attribution is fiction. (Registry review S7; trust-boundary
  F-2, F-6.)
- **Resolvers.** No caller identity exists; `/resolve`, `/batch`, `/capability`,
  `/trace` are open, CORS `*`, bound `0.0.0.0`. There is no tenancy and no per-org
  policy. (Resolver review S2.)
- **Anthill nodes.** `node_signature` is spec-mandated (§4 MUST) but stored and
  never verified; `originating_node` is a free-form string. Any party reaching the
  endpoint can submit signals *as any node*, advance a victim's sequence counter to
  lock them out, and trigger a CRITICAL ANT-RA naming a chosen victim. (Anthill
  review S1; trust-boundary F-3/F-4/F-5.)

The shared-secret model is the single highest-leverage gap in the stack: it is the
root cause of the most severe trust-boundary findings and the blocker for multi-org
operation. The specs already anticipate the fix (Registry A.1/A.2, Resolver A.1,
Anthill A.11, Operations Charter §4) but defer it.

### 1.2 Target v2 architecture

A single, stack-wide identity model anchored in the DNSO root of trust, expressed
as three credential types that all chain to the same root and are all verifiable
offline.

**1.2.1 DNSO-rooted delegation, modeled on DNS/TUF.** The DNSO root key signs
**delegation records**: a signed statement granting an organization's public key
authority over a namespace subtree (e.g. `orgx.*`). This is the DNS `NS`+`DS`
pattern and the TUF delegated-targets pattern, both of which solved "many
organizations, one coherent namespace, no shared credential" decades ago.
(Registry-vs-infrastructure comparative §3.1.)

- A delegation record carries: delegated subtree (path prefix), delegate public
  key(s) with a key threshold, validity window (`not_before`/`not_after`), and the
  DNSO signature.
- Verification chain for any artifact becomes: `artifact signature → delegation
  record → DNSO root`. A verifier holding only the DNSO root public key can validate
  an org-signed record without the DNSO having signed that record.

**1.2.2 Registrant identity = dual signature.** A Capability Record carries two
signatures with distinct meanings (npm-provenance / Sigstore separation):

| Signature | Asserts | Key |
|---|---|---|
| **Registrant attestation** | "I, this identity, published this content" | Org key under a DNSO delegation, or a keyless Sigstore-style OIDC attestation |
| **DNSO/registry counter-signature** | "Accepted under governance at this time" | DNSO intermediate (Area 5) |

This fixes the v1 oracle problem (the registry signs whatever a token-holder
submits, so its signature cannot attest *who* asserted the content) and the
spoofable-`caller` audit gap: the registrant signature *is* the authenticated
caller identity. (Registry-vs-infrastructure §3.2; trust-boundary F-6.)

For registrant onboarding, adopt the proven low-friction paths rather than
inventing an account system: **OIDC trusted publishing** (PyPI/npm pattern) for
CI-based registrants, and **ACME DNS-01-style name-control proof** for an org
claiming `acme.*` (prove control of a corresponding DNS name). The Operations
Charter §4 already specifies DNS-TXT identity verification for attestation — v2
generalizes that into the registration credential itself.

**1.2.3 Resolver identity = mTLS + resolver certificate.** Resolvers authenticate
to the Registry (for sync, Area 2) and to callers using a **resolver identity
certificate** issued under the DNSO root, addressing the resolver-impersonation
threat the spec flags (Resolver §11.1, A.1). Caller→resolver authentication is a
bearer-token or mTLS profile the resolver operator configures; the spec defines the
contract, not a mandated IdP.

**1.2.4 Anthill node identity = registered Ed25519 key + verified signature.**
Every signal-emitting node enrolls a public key (procedure defined in the
Operations Charter, the dependency Anthill A.11 names). The aggregation layer
**verifies `node_signature` against the enrolled key before accepting any signal**,
and rejects `originating_node` values whose key does not validate the payload. This
single change closes trust-boundary F-3, F-4, and F-5 at once. `node_sequence`
ownership binds to the *authenticated* key, so an attacker cannot advance a victim's
counter (F-4), and the auto-generated ANT-RA names the cryptographically-verified
source, not a self-declared field (F-5).

**1.2.5 One identity registry, three consumers.** Delegations, registrant
identities, resolver certificates, and node keys are all entries in a single
**DNSO-signed identity metadata set** (TUF-style: versioned, signed, expiring). All
three services consume it; none invents its own account store.

### 1.3 Migration path from v1

This is a deliberately staged, backward-compatible rollout — the shared token keeps
working until each population has migrated.

1. **Phase A — additive credentials.** Stand up the identity metadata set and the
   enrollment endpoints (OIDC trusted publishing, DNS-01 name proof, node-key
   registration). Accept *either* the legacy shared token *or* a v2 credential.
   Begin recording the authenticated identity in `/log` alongside the legacy
   self-declared `caller` (mark the latter `unauthenticated`).
2. **Phase B — dual-signature accept, single-signature still valid.** Registry
   begins accepting and storing registrant attestation signatures; records without
   one are still accepted but flagged `registrant_unattested`. Resolvers begin
   verifying the chain when present. Anthill begins verifying `node_signature` when
   present (per A.11) and emits an ADVISORY for unsigned/unverifiable submissions
   instead of silently accepting.
3. **Phase C — delegation cutover.** Issue delegations to each onboarded org;
   migrate that org's records to org-signed + DNSO-counter-signed. Scope
   `/revoke`/`/promote` to the delegated subtree; the DNSO retains root override.
4. **Phase D — fail-closed.** Flip defaults: unauthenticated writes rejected,
   unsigned Anthill signals rejected, legacy shared token retired. The shared token
   becomes a break-glass-only credential held by the DNSO.

The Operations Charter governs the cadence and disclosure of each phase. No phase
requires a flag day; populations migrate independently, which matches the stack's
established "separable changes" posture.

### 1.4 Spec changes required

- **Registry Spec §7, §8.2, §11.1 + new §14 "Identity and Delegation":** define
  delegation records, the dual-signature schema, registrant-scoped revoke/promote,
  and the registrant-attestation field. Resolves the work deferred in Registry
  Appendix A.1.
- **Registry Spec §5.2:** add `registration_date` (and the new `not_after`, Area
  2/5) to the **signed field set** — closes the unsigned-history forgery
  (trust-boundary F-1, Registry review S6). This is a breaking signing change; pair
  it with the JCS migration in Area 6.
- **Resolver Spec §5.2, §6.1, §11:** define caller-identity and resolver-certificate
  profiles; require the resolver to verify the registrant→delegation→root chain and
  to **detect provisional tiers** by checking for a DNSO attestation rather than
  scoring a self-declared tier at face value (closes trust-boundary F-2; resolves
  Resolver A.1 and the §7 self-assignment gap).
- **Anthill Spec §4, §8 + the cross-doc work in A.11:** node-key enrollment,
  signature-verification semantics, and a rejection error code. Promotes A.11 — "the
  largest single deferred work item" — to normative.
- **DNSO Operations Charter §4, §5 + new §11 "Node and Registrant Enrollment":** the
  registration procedures the other three documents defer to (the `§-tbd` A.11
  names).
- **Namespace Standard §8:** delegation as a first-class governance concept; the
  abstract model already promises "any qualified party SHOULD be able to register"
  (§8.1 Openness) — delegation is how that becomes real without a shared secret.

---

## Area 2 — Scalable Registry Sync (ETag, Delta, Mirrors)

### 2.1 Current v1 limitation

The freshness path is a full-catalog poll against a single unreplicated writer, and
the one resilience mechanism the spec offers (mirrors) has no implementation.

- **Full-catalog polling.** Each resolver `GET /list`s the entire active set every
  60s; `/list` loads the full table into memory and paginates by slicing a JS array,
  with no `ETag`/`If-Modified-Since`, no since-cursor, no delta. At 100 resolvers
  this is 100 full-catalog downloads/minute regardless of change, plus a synchronized
  thundering herd on Registry restart (no jitter/backoff). (Registry review S3;
  resolver review S1.)
- **500-record cliff.** The resolver reads a single `/list` page and never
  paginates; once the catalog exceeds the 500-record cap, every record past the
  first page is invisible — silent `NO_MATCH`, inducible by an adversary
  mass-registering filler. (Trust-boundary F-10.)
- **Single writer, no HA.** One Node process, one `better-sqlite3` file. No
  replication, no failover, no read replicas. The authoritative tier is a hard SPOF
  for both writes and (once stale windows lapse) resolution. (Registry review S1.)
- **Mirror mode is a shell.** `REGISTRY_MODE=mirror` only rejects writes and echoes
  two operator-set env vars into `/health`; no code pulls from upstream, computes, or
  verifies the `authoritative_signature_hash`. The snapshot-and-hash conformance
  field is ill-defined beyond one page, self-reported (so it cannot detect a lying
  mirror), and racy between honest parties. (Registry review S2; mirror gap report
  G-1, G-2, G-7, G-11, G-12; Registry Appendix A.4 concedes "ad hoc".)

### 2.2 Target v2 architecture

Replace the bespoke snapshot-hash with a **content-addressed, signed, incremental
change feed** — the crates.io sparse-index / npm-changes-feed / etcd-watch pattern —
that doubles as the resolver sync mechanism, the mirror replication protocol, and
(via Area 6) the transparency log. One mechanism, three consumers.

**2.2.1 Conditional reads.** `/list` and `/log` gain strong `ETag` + `If-None-Match`
and `If-Modified-Since`. An unchanged catalog answers `304 Not Modified` — turning
the common case (nothing changed in the last 60s) from a full-catalog transfer into
a header exchange. This is "one afternoon of work, standard HTTP" and removes the
worst of the polling cost with no protocol change. (Registry-vs-infrastructure
integration point 1.)

**2.2.2 Delta feed by cursor.** The registration log *is already* a monotonic,
append-only change feed. Document `GET /log?since=<cursor>` as the normative
incremental-sync source: a resolver or mirror fetches only entries after its last
seen `id`, applies register/revoke/promote deltas to its local snapshot, and
advances its cursor. Bandwidth scales with *changes*, not `records × resolvers ×
polls`. This converges sync, mirror replication, and the audit log into one feed
instead of three mechanisms. (Registry-vs-infrastructure §1.3, integration point 2;
resolver review S1.)

**2.2.3 Signed snapshot checkpoints.** Periodically (and on demand) the Registry
publishes a **signed checkpoint**: `{merkle_root, max_log_id, record_count,
timestamp}` signed by the DNSO intermediate (Area 5), over the Merkle log (Area 6).
A mirror or resolver verifies the checkpoint signature, then verifies its locally
reconstructed set against `merkle_root`. This is what makes a mirror verifiable
*without trusting the mirror* — the property the v1 self-reported hash falsely
claimed (mirror gap report G-11). The checkpoint replaces both
`authoritative_snapshot_timestamp` and `authoritative_signature_hash` with a single
signed, page-independent object, resolving the multi-page hash ambiguity (G-2).

**2.2.4 Real mirrors.** A mirror is now defined operationally: consume the signed
delta feed + checkpoints, store records *with their signatures intact* (requires the
signed-record import path below), serve reads, reject writes with a defined
`READ_ONLY` error, and surface upstream key-rotation state. A mirror's freshness is
proven by re-presenting the latest signed checkpoint it has synced, not by
self-asserting a timestamp. (Mirror gap report G-1, G-3, G-7, G-15, G-18.)

**2.2.5 Signed-record import path.** Add an import/replication endpoint that accepts
**pre-signed authoritative records verbatim** (rather than re-signing, which the v1
`/register` does — destroying the authoritative signature, mirror gap G-7). State
explicitly that the signature-overwrite rule in §7 applies to *authoritative mode
only*.

**2.2.6 HA for the authoritative tier.** Where availability requires it, back the
authoritative store with a replicated datastore (Raft-backed, the etcd pattern the
spec already invokes in Registry §13) rather than a bespoke replication protocol —
*or* commit explicitly to a single hardened authoritative instance with documented
backup/restore/failover. The current embedded single-writer file does neither.
(Registry review S1; Registry-vs-infrastructure §1.4.) v2 picks the explicit
single-hardened-instance posture for the founding phase and specifies the migration
trigger to Raft-backed HA (sustained multi-org write volume or a second
authoritative operator).

**2.2.7 SQL-level pagination + indexed filters.** Push `LIMIT/OFFSET` into SQL,
index the `tag` filter, and have the resolver page `/list` to completion (or consume
the delta feed, which removes the cliff entirely). Closes the 500-record truncation
(F-10) and the in-memory full-scan (Registry review S3).

### 2.3 Migration path from v1

1. **Add conditional reads (non-breaking).** Ship `ETag`/`304` on `/list` and
   `/log`. Resolvers gain a free win the moment they send `If-None-Match`; old
   resolvers are unaffected.
2. **Document the existing log as the delta feed.** `/log?since=` already exists;
   specify it as the sync source and update the resolver to prefer it, falling back
   to full `/list` against pre-v2 registries.
3. **Introduce signed checkpoints alongside the legacy mirror fields.** Publish
   checkpoints; keep emitting the v1 `authoritative_snapshot_timestamp`/`_hash` for
   one revision so existing mirror consumers don't break. Mark the legacy fields
   deprecated.
4. **Ship real mirror mode + signed-record import.** A mirror can now be stood up
   from the spec for the first time. Retire the env-var-echo shell.
5. **Resolver fleet hygiene.** Add jitter + exponential backoff to the refresh loop
   and in-flight request coalescing on cache-miss lookups (resolver review S1/S7),
   independent of the above and shippable immediately.

### 2.4 Spec changes required

- **Registry Spec §2.2, §10.3, new §15 "Synchronization Protocol":** promote
  Appendix A.4 to normative — delta feed, cursor semantics, signed checkpoint
  format, mirror profile (required endpoints, `READ_ONLY` write behavior + new §4.1
  error code, key-rotation propagation), and a **maximum mirror sync interval**
  (mirror gap report G-4). Capitalize the §10.3 mirror obligations to actual MUSTs
  (G-17).
- **Registry Spec §4:** `ETag`/`If-None-Match`/`If-Modified-Since` on `/list` and
  `/log`; SQL-level pagination; a complete-snapshot or full-pagination contract;
  add `not_after` to the record schema (expiry/renewal, Area 5 lifecycle).
- **Registry Spec §4 + §5.2:** signed-record import endpoint; restrict the
  signature-overwrite rule to authoritative mode.
- **Resolver Spec §7:** define delta-sync as the primary refresh path with full-list
  fallback; require pagination to completion; mandate jitter/backoff; reconcile the
  two coexisting cache models (snapshot-refresh vs per-record TTL) that the gap
  report flags as unspecified (resolver deployment gap G-16).
- **Registry Spec §1/§2.2:** state the authoritative-tier availability posture
  explicitly (single hardened instance now; Raft-HA trigger) — closes the S1 silence.

---

## Area 3 — Anthill Re-Layering onto OpenTelemetry

### 3.1 Current v1 limitation

Anthill is built as a *parallel* observability stack — its own wire protocol, event
store, time-window aggregator, and (unbuilt) alerting engine — and defers the only
parts no commodity tool can provide.

- **Reinvented plumbing.** `POST /signal` hand-rolls what OTLP gives free (batching,
  compression, backpressure, retry, the collector ecosystem); fixed 60s/1h/24h
  windows are recomputed per request via 12 `GROUP BY` queries where PromQL
  `rate()`/`increase()` over arbitrary windows is cached and scales; INFORMATIONAL→
  CRITICAL escalation re-derives Alertmanager/Grafana alerting *and doesn't exist in
  code*; JSONL + single-writer SQLite reinvents an event store badly (no retention,
  rotation, rollups; synchronous append blocks the event loop). (Anthill-vs-OTel R1–R5;
  Anthill review S6/S7.)
- **No context propagation.** A revocation cascade (ANT-RC) *is* a distributed-tracing
  problem — "follow one revocation across N resolvers with causal links and per-hop
  latency" — but Anthill models flat isolated events with no trace/span linkage and
  cannot reconstruct propagation topology. (Anthill-vs-OTel R6.)
- **The moat is unbuilt.** Signature verification (A.11), threshold/correlation
  engine (§5), and Registry corroboration (A.10) — the three things generic tools
  *cannot* do — are exactly what's deferred. The build ships commodity, defers
  differentiator. (Anthill-vs-OTel thesis.)
- **No wire protocol in the spec at all.** Endpoint paths, per-class payload schemas,
  nonce encoding, and the canonical serialization for the mandated signature exist
  only in a README, if anywhere. A second implementation cannot exchange one signal.
  (Anthill emitter gap report GAP-01/02/13; spec-gap report ANT-01..08.)

### 3.2 Target v2 architecture

Re-layer, don't rewrite: **Anthill becomes a thin semantic-and-trust layer on top
of the standard observability stack.** Keep the three differentiators; delegate the
four commodity layers.

**3.2.1 Keep (the moat — build these):**

- **The ANT-\* governance taxonomy, published as an OpenTelemetry semantic
  convention** rather than a proprietary schema. Six well-defined coordination-layer
  signal classes (ANT-TC/RC/DN/RA/WF/EC) is the intellectual contribution; expressing
  it in the standard vocabulary lets it travel and gives every existing OTel pipeline
  a way to emit it. This *also* finally pins the per-class payload schemas
  (GAP-01) — as semantic-convention attribute sets with test vectors.
- **Per-node cryptographic non-repudiation** (Area 1.2.4): node-key registration +
  signature verification at ingestion, carried as a detached-signature attribute on
  an OTel log record / span event. This is what makes a signal *evidence* rather than
  a data point — and it is the single most important unbuilt capability.
- **Registry-corroborated verification** (A.10 made real): a verifier that ingests a
  claim, cross-checks it against canonical Registry state, and emits
  `corroborated | contradicted | unverifiable` plus a corroboration weight. No
  generic tool can do this; it requires the Registry as source of truth. Aggregation
  thresholds (§5) and response posture (§7) weight signals by corroboration depth.
- **Completeness attestation** (A.7): per-node Merkle root over each window's emitted
  signals, so *suppression* becomes retrospectively detectable — the one integrity
  property metrics systems structurally cannot offer. Shares the Merkle machinery
  with Area 6.

**3.2.2 Delegate (the plumbing):**

| Concern | Delegate to | Replaces |
|---|---|---|
| Transport | OTLP (batching, retry, backpressure, collectors) | bespoke `POST /signal` |
| Windowed aggregation / rollups | Prometheus/Mimir + PromQL | fixed 60s/1h/24h `GROUP BY` |
| Alerting, escalation, routing, dedup, silencing | Alertmanager / Grafana | the unbuilt threshold engine |
| Dashboards | Grafana | — |
| Durable event storage | TSDB or Kafka/object-store log | JSONL + single-writer SQLite |
| Cascade topology + per-hop latency (ANT-RC) | W3C trace context + Tempo/Jaeger | flat `capability_ref` events |

**3.2.3 New capabilities that make Anthill adoptable.** An OTel exporter/SDK so a
resolver operator emits ANT-\* signals from an *existing* pipeline with one exporter
(no second agent); signed signal envelopes as OTel log records with a detached
signature attribute (operators get the whole Grafana/Prometheus ecosystem *and*
non-repudiation); the Registry-corroboration verifier as the capability an operator
cannot get anywhere else; signal-absence detection (ANT-HB/ANT-NU, A.6) implemented
via Prometheus `up`/`absent()` with Anthill defining only the *governance meaning* of
a node going dark; and a per-operator fleet view ("which of my resolvers are
drifting, under-reporting, or serving revoked records").

The aggregation layer's HA and single-writer problems (Anthill review S3) largely
dissolve under delegation: global nonce-uniqueness and per-node sequence become
properties of the verification/idempotency layer over a real datastore, not
constraints local to one SQLite file.

### 3.3 Migration path from v1

1. **Define the semantic convention + payload schemas first.** Nothing else matters
   until the per-class attribute sets exist (GAP-01). Publish with test vectors.
2. **Verify signatures (A.11) on the existing endpoint.** Independent of the OTel
   move, begin verifying `node_signature` against enrolled keys (Area 1.2.4); accept
   legacy unsigned with an ADVISORY during overlap.
3. **Ship the OTel exporter beside the legacy endpoint.** Dual-ingest: accept both
   `POST /signal` and OTLP. Operators with existing pipelines migrate first.
4. **Stand up corroboration + completeness as services.** The verifier and the
   Merkle-attestation checker run against the delegated store; thresholds move to
   Alertmanager.
5. **Deprecate the bespoke store/aggregator.** Once OTLP ingest + TSDB are the
   default path, retire JSONL/SQLite aggregation and the per-request `GROUP BY`.

Add an **idempotency contract** during step 2/3 regardless: byte-identical
resubmission of an accepted signal returns success without minting an ANT-RA, so a
lost-ACK retry is not converted into an abuse accusation (emitter gap GAP-05). Bind
sequence ownership to the verified key with a tolerant replay window (GAP-06, Anthill
review S9).

### 3.4 Spec changes required

- **Anthill Spec — substantial restructure to v0.2:** reframe from "parallel plane"
  to "semantic + trust layer over OTel." Normative deliverables: per-class
  `signal_payload` schemas (GAP-01); the OTel semantic convention mapping; the
  canonical serialization + wire encoding for `node_signature` with test vectors
  (GAP-02/ANT-02); idempotency + sequence-recovery semantics (GAP-05/06); promote
  the HTTP/transport contract from README to spec with a version field (GAP-13/14).
- **Anthill Spec §4/§5/§6/§7 + A.10:** make Registry corroboration the organizing
  principle for evidentiary weight (the A.10 framing decision), weighting thresholds
  by corroboration depth.
- **Anthill Spec A.6 → normative:** ANT-HB/ANT-NU defined as governance meaning over
  a Prometheus liveness mechanism.
- **Registry Spec A.5 + Resolver Spec A.7:** define the emission hook interfaces both
  documents defer — now concretely "emit OTel spans/logs carrying ANT-\* convention
  attributes" rather than an undefined bespoke hook.

---

## Area 4 — Rate Limiting Strategy

### 4.1 Current v1 limitation

No service rate-limits in code; the spec punts to a reverse proxy that the reference
deployment doesn't document. At fleet scale this is an availability and amplification
exposure, and several abuse vectors are *application-semantic* (a proxy cannot see
them).

- **Registry:** no limits on `/list`, `/lookup`, `/verify`, `/log`, or writes beyond
  the bearer check; each `/lookup`/`/verify` runs a per-call sort, `/log` a per-call
  `COUNT(*)`. A single hostile caller degrades all 100 resolvers — and the process
  also holds the root key. (Registry review S4.)
- **Resolver:** open `/resolve`/`/batch`/`/capability`/`/trace`; unbounded namespace
  enumeration via wildcards (≤200 matches) and raw record disclosure via
  `/capability` (no trust filter); `/batch` of 50 × unbounded callers; and
  `probe_liveness: true` turns each resolver into an **unauthenticated SSRF /
  amplification proxy** (one inbound request → up to 200 outbound HEADs to
  attacker-chosen endpoints, including link-local/metadata addresses). (Resolver
  review S2/S3; trust-boundary F-8.)
- **Anthill:** body size capped but no per-node/global ingestion limit; the plane
  that exists to *detect* abuse (ANT-RA/ANT-WF) is itself undefended against a
  flooding node. (Anthill review S8.)

### 4.2 Target v2 architecture

A two-tier strategy: **commodity volumetric limits at the edge proxy** (keep the
spec's existing stance) **plus identity-scoped, semantic quotas in-application**
(the part a proxy structurally cannot do). Per-identity quotas are *enabled by Area
1* — without authenticated identity, all you can do is per-IP, which NATs and
botnets defeat.

**4.2.1 Edge tier (volumetric, per-IP).** Reverse proxy (nginx/Caddy) with per-IP
rate limits and connection caps on all public read endpoints, TLS termination, and
request-size enforcement. Spec keeps recommending this; v2 *documents the concrete
reference config* (the gap reports note the recommendation is unimplementable as
written).

**4.2.2 Application tier (semantic, per-identity).**

- **Per-org/per-resolver/per-node quotas** keyed on the authenticated identity (Area
  1), not IP. Distinct budgets for cheap reads vs expensive operations (wildcard
  expansion, batch, `/verify`, liveness probes).
- **Cost-weighted limiting.** A wildcard resolving 200 candidates costs ~200×; a
  batch of 50 costs ~50×. Limit on *work*, not request count, so a single expensive
  call can't slip a flat per-request budget.
- **Probe controls (close the SSRF, F-8/Resolver S3).** `probe_liveness` requires an
  authenticated caller; the resolver enforces an **endpoint allowlist / deny-list of
  internal, link-local (169.254/16), loopback, and RFC-1918 ranges** resolved-and-
  pinned before probing; per-caller probe quota independent of resolution quota.
- **Anthill ingestion quota** per enrolled node, with the tolerant replay window
  (Area 3) so legitimate bursts/retries aren't rejected as violations while a
  flooding node is throttled.
- **Standard `429` semantics** with `Retry-After` across all three services — a
  status the v1 error tables never define.

**4.2.3 Fail-closed defaults.** Bind to loopback unless a credential is configured;
require a token by default rather than defaulting open; never combine `ACAO: *` with
state-changing endpoints (closes the drive-by CSRF chain, trust-boundary F-9).

### 4.3 Migration path from v1

1. **Ship the documented edge-proxy reference config now** (no code change) —
   immediate volumetric protection and TLS.
2. **Add `429` + `Retry-After` and static guards** (per-IP in-app limits, probe
   deny-list, fail-closed binding/CORS) — shippable before Area 1 completes; the
   probe deny-list and CSRF fix are pure hardening with no identity dependency.
3. **Layer per-identity cost-weighted quotas** as authenticated identity lands (Area
   1 Phases B–C); quotas key on legacy IP until an identity is present, then on
   identity.
4. **Tune from Anthill telemetry.** ANT-WF/ANT-RA signals (Area 3) feed quota
   tuning — the observability plane informs the rate limiter, closing the loop.

### 4.4 Spec changes required

- **Registry Spec §11.3, Resolver Spec §11, Anthill Spec §8:** replace "use a
  reverse proxy" with a two-tier model — edge volumetric + application
  per-identity/cost-weighted — and add `429`/`Retry-After` to every error table.
- **Resolver Spec §3.1/§6.1/§11:** `probe_liveness` requires authentication; mandate
  the internal-range deny-list and host pinning before probing (closes F-8); define
  per-caller probe quota.
- **All three:** state fail-closed defaults (token-required, loopback-by-default, no
  wildcard CORS on mutations) as the conformant production posture.

---

## Area 5 — Signing Key Isolation

### 5.1 Current v1 limitation

The DNSO root private key — "the root of trust for the entire namespace" — is loaded
into the memory of the public-facing HTTP process, with no separation between the
network surface and the signing authority.

- `privateKeyPem = fs.readFileSync(PRIVKEY_PATH)` runs in the same Node process that
  terminates public HTTP and (Area 4) is unthrottled. One RCE or memory-disclosure
  bug exposes the namespace root. (Registry review S5.)
- The root is **online and long-lived**: every record is signed directly by the root,
  there is no intermediate layer, and there is no expiry — the only lifecycle exit is
  revocation, so the revocation system must work forever for every record ever
  issued. (Registry-vs-infrastructure §1.2.)
- Key rotation (§5.6 overlap window) and emergency reset are thoughtfully specified
  but operationally manual, and re-signing the whole catalog under load has no
  throughput plan. (Registry review A3; Operations Charter §5.)
- On the resolver side, the public key is a static local file loaded once at startup,
  with no fetch/rotation/reload — rotating the trust root across 100 nodes means
  hand-distributing a file and restarting each, with a disagreement window. (Resolver
  review S8.)

### 5.2 Target v2 architecture

Adopt the CA discipline the spec already gestures at ("back up the private key with
the same care as a certificate authority root") and that PKI converged on after
twenty years.

**5.2.1 Offline root + online intermediate.** The DNSO **root key goes offline**
(air-gapped / HSM-held). It signs only (a) intermediate keys, (b) delegation records
(Area 1), and (c) the identity metadata set — rarely, in ceremonies. An **online
intermediate** key, held in a **separate signing service**, signs Capability Records
and checkpoints day-to-day. The `dnso_v1_` signature prefix already anticipates
algorithm/version migration; an intermediate layer is the same idea applied to
compromise containment. A compromised intermediate is revoked and re-issued by the
root without a namespace-wide trust reset.

**5.2.2 Signing service isolation (HSM/KMS).** The signing authority is a distinct
process/service that the network-facing API calls over a narrow internal interface —
never `readFileSync` in the HTTP process. Target an HSM or cloud KMS so the private
key material is never in the API process's address space at all. This is the
structural boundary (Registry review S5 is "structural because it's an architecture
boundary, not a config value").

**5.2.3 Record expiry + renewal (Let's Encrypt / SPIFFE pattern).** Add a signed
`not_after` and a renewal endpoint. Compounding benefits: revocation lists stay
bounded; abandoned capabilities age out rather than accumulating as attack surface;
the "N days continuous registration" tier criteria become **cryptographically
demonstrable** via a logged, signed renewal chain instead of inferred from the
forgeable `registration_date`; and the unsigned-history forgery (F-1/S6) loses most
of its value because standing is evidenced by the renewal chain. Pairs with adding
`registration_date`/`not_after` to the signed set (Area 1/2).

**5.2.4 TUF-style rotation metadata + managed resolver key distribution.** Replace
the hand-rolled `/pubkey?previous=true` + `key_rotation` health object with
**versioned, signed root metadata** (TUF root role: key thresholds, expiry,
client-side rotation rules) — the standard answer to "how do clients safely follow a
rotating root." Resolvers fetch and verify this metadata and reload keys without a
restart or a hand-distributed file, closing the fleet-wide disagreement window
(resolver review S8).

### 5.3 Migration path from v1

1. **Externalize the signer (no trust-model change).** Move signing out of the HTTP
   process into a local signing service over a narrow socket; key still on-host but
   no longer in the API address space. Immediate blast-radius reduction.
2. **Introduce the intermediate layer.** Generate an intermediate, have the (now
   carefully-held) root sign it, switch day-to-day signing to the intermediate.
   Verifiers accept root-or-intermediate chains during overlap.
3. **Move root offline / into HSM.** Root now signs only intermediates, delegations,
   and metadata, in ceremonies. Day-to-day operation no longer touches the root.
4. **Add expiry/renewal additively.** New records carry `not_after`; existing records
   treated as non-expiring until renewed; renewal endpoint live. Tier criteria switch
   to the renewal chain over a revision.
5. **Ship TUF-style metadata + resolver auto-reload**, deprecating the static-file +
   restart rotation path.

The Operations Charter §5 governs ceremony cadence, disclosure windows (already
specified: 30-day advance for planned rotation, 48-hour for emergency), and the
re-signing throughput plan for catalog-wide re-sign events.

### 5.4 Spec changes required

- **Registry Spec §5.5/§5.6 + new §16 "Key Hierarchy":** offline root + online
  intermediate; signing-service isolation as a conformance boundary; TUF-style signed
  rotation metadata superseding the ad-hoc `/pubkey?previous=true` mechanism.
- **Registry Spec §3.1/§5.2/§7:** `not_after` field, in the signed set; renewal
  endpoint and semantics; tier criteria re-expressed against the renewal chain.
- **Resolver Spec §6.1/§11.1 + A.1:** managed trust-root acquisition — fetch + verify
  TUF metadata, reload without restart, defined behavior on key-fetch failure
  (resolver review S8; spec-gap RES-16).
- **DNSO Operations Charter §5:** ceremony procedures for the root/intermediate split,
  HSM custody, and a catalog re-sign throughput plan.

---

## Area 6 — Tamper-Evident Logging

### 6.1 Current v1 limitation

Every log in the stack is "append-only" only because no endpoint mutates it — a
procedural guarantee, not a cryptographic one. The artifacts that governance leans
on cannot survive a challenge.

- **Registry `/log`:** no hash chaining, no Merkle root, no signature over entries.
  Anyone with host/file access rewrites history undetectably, and a mirror's `/log`
  is entirely self-asserted. This is the record governance decisions and the future
  reference-monitor/reporter-incentive work depend on. (Registry review S9.)
- **Anthill log:** `fs.appendFileSync` on the event loop per signal (throughput
  ceiling), unbounded JSONL with no rotation, documented to diverge from the SQLite
  copy and require manual reconciliation, and the §5 "immutability requirement" met
  only by convention. (Anthill review S6.)
- **Resolver traces:** one synchronous `fs.writeFileSync` per resolution, unbounded,
  retention unenforced (the §5 72-hour SHOULD is not implemented), failures swallowed
  — so a full disk silently breaks the §3.3 auditability MUST while requests still
  return 200. (Resolver review S5.)
- **Timestamps aren't anchored.** Anthill `received_at` / `signal_timestamp` are
  clock-dependent and manipulable; the spec honestly discloses this satisfies
  immutability but not admissibility (§8, A.4).

### 6.2 Target v2 architecture

Make "append-only" a *proof*, using the worked answer the comparison set already
provides: **Certificate Transparency (RFC 6962) / Sigstore Rekor** — a Merkle-tree
log with signed tree heads, inclusion proofs, and third-party monitors. The Registry
`/log` is already public and `id`-ordered — "two-thirds of the way to a CT-style
log; the missing third (hash chaining + signed checkpoints) is the part that should
not be home-built." (Registry-vs-infrastructure §1.2.)

**6.2.1 Merkle-tree registration log.** Each log entry is a leaf; the Registry
maintains a Merkle tree and publishes **signed tree heads (checkpoints)** — the same
checkpoints that drive sync (Area 2.2.3), signed by the intermediate (Area 5).

- **Inclusion proofs:** a caller can prove a given record/revocation/promotion is in
  the log at a given tree size.
- **Consistency proofs:** a caller can prove tree size N+k is an append-only
  extension of size N — so a mirror or monitor detects any rewrite of history.
- **Third-party monitors:** independent parties (and resolvers, and Anthill's
  corroboration verifier) gossip checkpoints and verify consistency, so tampering is
  detectable without trusting the Registry. This is what makes the audit log
  *evidence*.

**6.2.2 Deployable, not home-built.** Use Sigstore Rekor (or an RFC 6962 library)
rather than hand-rolling Merkle code — the verifiers already exist in every major
language. (Registry-vs-infrastructure delegate table.)

**6.2.3 Anthill completeness attestation + admissible timestamps.** Per-node Merkle
root over each window's emitted signals (Area 3 / A.7) makes *suppression*
detectable. For admissibility (the "survive challenge before a regulator six months
later" standard the spec sets for itself), add **RFC 3161 trusted timestamping** at
ingestion: the aggregation layer hashes the canonical signal record and obtains a
TSA-signed token, stored as `tsa_timestamp_token` — independently verifiable without
trusting the host clock. (Anthill §8, A.4 — already the disclosed upgrade path.)

**6.2.4 Async, bounded, rotated sinks.** Move all three logs off synchronous
event-loop writes to async, bounded, rotated sinks (or the delegated TSDB/object
store from Area 3). Enforce the resolver's 72-hour trace retention; stop swallowing
write failures (a failed audit write must surface, not return 200 silently).

### 6.3 Migration path from v1

1. **Hash-chain entries (non-breaking).** Add a `prev_hash`/entry-hash column to the
   registration log and Anthill log; old consumers ignore it, new ones detect
   tampering immediately. Cheap first step.
2. **Publish signed tree heads.** Stand up the Merkle tree over the existing log;
   publish checkpoints (these double as Area 2 sync checkpoints). Expose
   inclusion/consistency-proof endpoints.
3. **Adopt Rekor or an RFC 6962 backend** for the registration log; run a DNSO
   monitor and invite third-party monitors.
4. **Anthill: completeness attestation + RFC 3161.** Add per-node Merkle roots and
   TSA tokens; records before the cutover carry null token fields (clean
   pre/post-anchor demarcation, exactly as A.4 describes).
5. **Async/bounded/rotated sinks + enforced retention** across all three — shippable
   independently and immediately (it's a durability fix, not a protocol change).

### 6.4 Spec changes required

- **Registry Spec §2.1/§6.2/§6.3 + new §17 "Transparency Log":** Merkle structure,
  signed tree heads, inclusion/consistency proofs, monitor model; state that the
  signed checkpoint is shared with the sync protocol (Area 2). Adopt RFC 6962 / Rekor
  by reference rather than home-built chaining.
- **Anthill Spec §5 + A.4/A.7 → normative:** completeness attestation (per-node
  Merkle root per window) and RFC 3161 timestamping with the `tsa_timestamp_token` /
  `tsa_url` fields; require async, non-blocking, bounded, tamper-evident ingestion.
- **Resolver Spec §5.1:** enforce the 72-hour trace retention; require an async
  bounded sink and that audit-write failure is surfaced, not swallowed.
- **DNSO Operations Charter §9:** the immutable-operational-log requirement becomes
  "tamper-evident via signed Merkle checkpoints," and the steward monitor cadence
  includes consistency-proof verification.

---

## Cross-Cutting Concerns (carried into every area)

These recur across the gap reports and are not owned by a single area; v2 should
resolve them once, stack-wide:

- **Canonical JSON / signing portability.** The v1 signing model depends on
  JavaScript `JSON.stringify` semantics and a "bytes-as-stored" nested-object rule
  that a second implementation cannot reproduce. v2 should complete the **RFC 8785
  (JCS) migration** the Registry spec already plans (§5.2), using the dual-signature
  transition window already designed. This is a prerequisite for byte-compatible
  independent implementations and pairs with every signing change above (Areas 1, 5,
  6). (Spec-gap report REG-01/02; Registry §5.2.)
- **Deterministic score arithmetic.** The resolver determinism guarantee is not
  actually achievable as specified — scores depend on wall-clock time, per-process
  liveness state, and unpinned floating-point arithmetic. v2 must scope the guarantee
  to "single resolver, single instant" *and* pin the arithmetic (decimal or a
  specified evaluation order). (Resolver review S4; spec-gap RES-12/13; resolver
  deployment G-20.)
- **Response-body and `/health` schemas.** `/health` on every service is REQUIRED
  with no defined schema — the steward sweep itself depends on undocumented fields
  (`registry.source`, `dnso_key.configured`). v2 must publish response contracts for
  `/health` and the sync-relevant bodies, following the model the v0.1.4 `/log`
  addition set. (Spec-gap REG-26/RES-23; resolver deployment G-18.)
- **Spec-version ↔ implementation-version mapping.** Spec v0.1.5 ships as
  implementation v0.2.8, etc., with no mapping rule. v2 documents a conformance
  mapping table. (Multiple gap reports; G-15/G-19.)
- **URI scheme acceptance matrix.** `dillweed://` vs `dllwd://` equivalence is
  mandated but where each is accepted/stripped/rejected is undefined. v2 pins it.
  (Resolver deployment G-14; spec-gap XC-04.)

---

## Sequencing and Release Plan

Consistent with the stack's "separable changes" posture, v2 lands as a sequence of
independently-shippable revisions, not a flag day:

| Wave | Ships | Depends on | Headline outcome |
|---|---|---|---|
| **W0 — Hardening** | Area 4 static guards (probe deny-list, fail-closed, CORS, `429`), Area 6 async/bounded/rotated sinks + retention, Area 2 `ETag`/`304` + jitter/backoff | none | Closes SSRF/CSRF (F-8/F-9), stops event-loop-blocking I/O, removes worst polling cost — all without protocol change |
| **W1 — Identity keystone** | Area 1 Phases A–B (enrollment, dual-signature accept, node-signature verify), Area 5 signer externalization + intermediate | W0 | Authenticated identity present; root key out of the HTTP process; closes F-3/F-4/F-5 |
| **W2 — Trust correctness** | Area 1 signed `registration_date`/tier-attestation + JCS migration, Area 5 offline root + expiry/renewal | W1 | Closes F-1/F-2/F-6; byte-compatible signing; bounded lifecycles |
| **W3 — Scale + transparency** | Area 2 delta feed + signed checkpoints + real mirrors + HA posture, Area 6 Merkle log + monitors | W1, W2 | Fleet sync without full-catalog polling; verifiable mirrors; tamper-evident audit |
| **W4 — Observability re-layer** | Area 3 OTel semantic convention + exporter + corroboration verifier + completeness attestation; Area 4 per-identity cost-weighted quotas | W1, W3 | Anthill becomes a semantic+trust layer over the standard stack; quotas keyed on identity |

W0 is pure operational hardening and should ship first regardless of the rest. W1
(authenticated identity) is the keystone everything trust-related depends on. W4
depends on both identity (W1) and the Registry state needed for corroboration (W3).

---

## Summary

v2 is a **re-layering and a hardening, not a rewrite.** The defensible core of v1 —
the signed, governed, behaviorally-specified Capability Record; trust-tier
governance with logged promotion/demotion; soft-delete revocation with mandatory
reasons; a public audit log as a protocol obligation; and the genuinely novel
governance-observability taxonomy — is carried forward unchanged and is the reason
the stack should exist at all. Around that core, every area above replaces a bespoke
v1 mechanism with the proven pattern the comparison set already hardened: delegation
and dual signatures for identity (DNS/TUF/Sigstore), a content-addressed delta feed
and signed checkpoints for sync (crates.io/etcd), an OTel semantic convention plus a
verification service for observability, offline-root + HSM for key custody (PKI), and
an RFC 6962 / Rekor transparency log for tamper-evidence (CT). Each adoption doubles
as an adoption *argument*: a prospective second organization can be told "identity is
delegated and OIDC-attested, sync is a signed content-addressed feed, records are
CT-logged, the root is offline, and observability rides your existing OTel pipeline"
— and immediately know what they are trusting. That is the difference between a
single-steward reference deployment and a namespace a second organization can
responsibly join.

---

*Prepared by the Dillweed Protocol Steward Agent in review-and-recommend (read-only)
mode under capabilities `review.spec.read`, `review.repo.read`, and
`review.report.write` — all boundary-allowed and DillClaw-verified this session. No
project artifacts were modified; per the steward boundary, modifying or proposing
changes to specifications and creating files in the repository require human
approval, so this draft is delivered to `~/Dillweed-Agent/reports/` for the steward
to review and, if approved, place under `docs/`.*
