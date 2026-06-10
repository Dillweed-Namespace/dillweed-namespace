# Anthill — Production Architecture Review

**Date:** 2026-06-10
**Reviewer role:** System architect (production readiness)
**Scope:** `anthill/server.js` (v0.1.6 reference impl) + `specs/anthill-spec.html` (v0.1.3)
**Target deployment:** Multi-resolver, multi-organization, ~100 resolver nodes
**Mode:** review-and-recommend (read-only)

## Summary

Anthill is a careful, well-validated **single-process signal sink**. As a v1
reference implementation it is above average: strict input validation, WAL
mode with sensible indexes, honest 405/404 semantics, and a thoughtful
dual-clock aggregation response to timestamp manipulation. The specification
(v0.1.3) is unusually candid about its open questions.

But as built it implements **storage and raw counting, not observability**.
The detection, alerting, escalation, and corroboration machinery that the
spec's value proposition rests on (§5–§7) does not exist in code, and several
foundational design decisions do not survive a 100-resolver, multi-org
deployment. The single most important fact: **no submission is
authenticated** — `node_signature` is stored but never verified, and
`originating_node` is a free-form, forgeable string. Every other trust
property in the system is downstream of that gap.

The findings below separate **structural** issues (the design must change
before multi-org production) from **v1-acceptable** limitations (fine for a
loopback reference implementation, disclosed, or deferrable).

---

## Structural Findings (must change for 100-resolver multi-org)

### S1 — No authenticated attribution. `node_signature` accepted but never verified. (P0)
`validateSignal` type-checks `node_signature` when present but the aggregation
layer performs **no cryptographic verification**, and the field is optional in
practice (server.js does not require it; spec §4 says MUST). `originating_node`
is any non-empty string. Consequence: any party who can reach the endpoint and
knows (or guesses) a node identifier and its current sequence number can submit
signals **as that node**. Replay protection (nonce + sequence) protects only
against duplication, not impersonation — it secures the integrity of forged
identities.

The spec names this itself (Appendix A.11) as "the largest single deferred work
item" and correctly notes it **cannot be closed in Anthill alone** — it
requires a node-key registration procedure (Operations Charter) plus
verification semantics. Until then there is no authenticated identity anywhere
in the system. **This is the root finding; S2, S4, S5 all depend on it.**

### S2 — Single shared bearer token; no per-node / per-org credential. (P0)
`ANTHILL_ADMIN_TOKEN` is one global secret (or auth is off entirely). In a
multi-org deployment all 100 resolvers across N organizations would share one
token. There is no mechanism to authenticate *which* node or *which org*
submitted a signal, and no way to revoke one node without rotating everyone.
Combined with S1, the system has **no usable notion of submitter identity** —
fatal for a plane whose entire job is attributing behavior to nodes and orgs.

### S3 — Single-instance embedded SQLite: single-writer, no HA, cannot shard. (P0)
`better-sqlite3` is an in-process single-file DB. WAL helps concurrent reads,
but the whole service is one process bound to `127.0.0.1`. Two structural
consequences at scale:
- **No horizontal scale / no HA.** The aggregation endpoint is a single point
  of failure. There is no failover, replication, or multi-instance story.
- **Global invariants can't shard.** Spec §4 requires nonce uniqueness "regardless
  of originating node" and per-node sequence monotonicity. Both are enforced via
  SQLite constraints **local to one file**. You cannot run two Anthill instances
  behind a load balancer without breaking global nonce uniqueness and creating
  sequence races. The design is intrinsically single-writer.

If a single logical aggregation endpoint is the intended architecture, that is
defensible — but then HA, backup/restore, and failover must be designed in, and
none are present.

### S4 — Signals are self-graded: severity and class are submitter-declared, never corroborated. (P1)
Anthill stores `severity` and `signal_class` exactly as supplied. It performs
**no verification against Registry canonical state**. A node reporting its own
ANT-RA abuse sets its own severity — it can self-report `INFORMATIONAL`. A node
can claim any ANT-RC propagation status or ANT-EC concentration figure and it is
recorded at face value. This is the concrete form of the spec's A.10
(Registry-as-reference-monitor) and A.7 (reporter-incentive) gaps: **nodes grade
their own homework.** Acknowledged as future work in the spec, but it means the
"observability plane" cannot currently distinguish a truthful report from a
fabricated one.

### S5 — ANT-RA auto-generation is a framing / amplification vector. (P1)
On nonce collision, Anthill mints a **CRITICAL** ANT-RA naming
`offending_node = body.originating_node` — an **attacker-controlled** value.
Combined with S1 (no auth), an attacker submits two signals claiming to be
victim node X with the same nonce, and Anthill generates a CRITICAL signal
naming X. Per §7 that triggers operator contact, a 48-hour remediation window,
and possible suspension. The abuse-detection mechanism is **weaponizable to
frame a competitor's node**, and each forged collision amplifies one attacker
request into a durable CRITICAL record. Structural until S1 lands.

### S6 — Durability model: synchronous JSONL append blocks the event loop; log is unbounded and not tamper-evident. (P1)
`appendSignalLog` uses `fs.appendFileSync` on **every** submission, before the
DB write, on the single Node event loop. Three problems at 100-resolver volume:
- **Throughput ceiling.** Every signal serializes on a synchronous disk write;
  the event loop blocks per-append. This caps ingestion hard and couples latency
  to disk.
- **Unbounded flat log.** `logs/signals.log` has no rotation or archival;
  forensic reconciliation requires scanning an ever-growing JSONL.
- **By-design divergence + no tamper-evidence.** The team documents that JSONL
  and SQLite can diverge (log-first ordering) and must be manually reconciled —
  unmanageable at scale. And the spec §5 "immutability requirement" is satisfied
  only by *convention* (no UPDATE/DELETE endpoint): the SQLite file is writable,
  there is **no hash chaining or Merkle integrity**, so the "immutable" log is
  not tamper-evident. An operator (or intruder) with file access can rewrite
  history undetectably.

### S7 — No retention or rollups; `classBreakdown` and `/summary` full-scan the entire table on every call. (P1)
`classBreakdown` has **no WHERE clause** — it `GROUP BY`s the whole `signals`
table, and `/summary` (a steward-cadence endpoint) calls it every request.
`handleHealth` runs `SELECT COUNT(*)` over the full table per `/health`. There
is no retention policy, partitioning, or precomputed rollup. With 100 resolvers
emitting continuously, these become full-table scans on hot paths and the
database grows without bound. `/aggregate` recomputes 6 classes × 2 windows =
12 `GROUP BY` queries per request with no caching, on what the spec expects to
be a continuously-polled endpoint.

### S8 — No ingestion rate limiting; the observability plane has no abuse protection. (P1)
Body size is capped (256 KB — good), but there is **no per-node or global rate
limit**. A single compromised or misbehaving node can flood the single-writer
DB and the synchronous JSONL append, degrading the entire plane for all orgs.
This is notable precisely because ANT-RA/ANT-WF exist to detect abuse — yet the
detector itself is undefended.

### S9 — `node_sequence` replay scheme is brittle and the node identity space is unbounded. (P2)
Replay protection is strictly "must exceed last accepted sequence." Legitimate
**out-of-order delivery, retries, or concurrent submissions** from one node are
rejected as `SEQUENCE_VIOLATION` — there is no sliding-window tolerance. A node
that loses its sequence state (crash, redeploy) cannot resume cleanly. And
because `originating_node` is free-form with no enrollment, the `node_sequences`
table grows with every distinct string submitted; a typo or malicious variant
mints a brand-new identity. With no canonical node set, the A.6 signal-absence
detection cannot even define "expected" nodes.

---

## v1-Acceptable Limitations (fine for reference / loopback; disclosed or deferrable)

| # | Item | Why acceptable now | When it becomes structural |
|---|------|--------------------|----------------------------|
| A1 | HTTP on `127.0.0.1`, not HTTPS+Ed25519 (spec §8) | Reference impl behind a TLS proxy | The moment 100 remote resolvers must reach it over a network |
| A2 | No threshold-escalation / alerting engine (§5–§7) | v1 may store first, detect later | This *is* the product's value; cannot ship "observability" without it |
| A3 | Cross-signal correlation (§5) unimplemented | Explicitly future work | Needed before the plane detects compound abuse |
| A4 | Naive aggregation recompute, no caching | Cheap at low volume | Couples to S7 under continuous polling |
| A5 | `received_at` = local clock, second precision, no RFC 3161 anchor | Honestly disclosed (§8, A.4) | When evidence must "survive challenge" before a regulator |
| A6 | Wildcard CORS + single token in open mode | Safe on loopback | Becomes misconfiguration once network-exposed (pairs with A1) |
| A7 | Signal-absence detection (ANT-HB/ANT-NU) absent | Future work (A.6) | When silencing-the-monitor is in the threat model |

The validation layer (round-trip calendar date checks, strict numeric
pagination with bounds, Content-Type enforcement, body-size cap, reserved-node
rejection, explicit `SEVERITY_RANK` instead of SQL lexical sort) is genuinely
solid and should be preserved through any rearchitecture.

---

## Priority Ordering

1. **S1 / S2** — Authenticated, per-node, per-org identity (signature
   verification + key registration). Nothing else is trustworthy without it.
2. **S3** — Decide the scaling model: either commit to a single hardened
   logical endpoint *with* HA/backup/failover, or move to a real
   client/server datastore that supports the global invariants under
   replication. The current embedded single-writer file does neither.
3. **S4 / S5** — Registry-side corroboration (A.10) and removing the
   attacker-controllable ANT-RA framing path.
4. **S6 / S7 / S8** — Durability, retention, and rate-limiting: make ingestion
   non-blocking and tamper-evident, bound table growth, and defend the plane.
5. **S9** — Enrollment-backed node identity and a tolerant replay window.
6. **A2 / A3** — Build the detection/escalation engine the spec describes;
   until then, label the service a signal store, not an observability plane.

## Bottom Line

The code quality at the request-handling layer is good and the spec is honest
about its gaps. The risk is not bugs — it is that the **architecture's center
of gravity** (single-writer embedded DB, self-asserted unauthenticated
identity, store-don't-detect) is matched to a single-host reference
deployment, not to the multi-org, 100-resolver target. S1–S3 are the load-
bearing decisions that will not survive that move and should gate any
production commitment.
