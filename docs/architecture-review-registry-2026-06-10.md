# Dillweed Registry — Production Architecture Review

> **Historical review.** Findings reflect repository state on 2026-06-10, before the W0 hardening wave. Subsequently closed or narrowed: S3 (SQL pagination + ETag/304 landed server-side, commits `25670a4`/`74cad67`/`e523652`) and S4 (per-IP rate limiting, `a1a95d1`) are PARTIALLY CLOSED. S1, S2, S5–S9 remain open or deferred to v2. See [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md) for current status of every finding. Preserved unmodified as historical evidence.

**Date:** 2026-06-10
**Reviewer role:** System architect (production readiness)
**Scope:** `registry/server.js` (v0.2.8 reference impl) + `specs/registry-spec.html` (v0.1.5)
**Target deployment:** Multi-resolver, multi-organization, ~100 resolver nodes
**Mode:** review-and-recommend (read-only)

## Summary

The Registry is the **authoritative substrate** of the stack — the spec's own
framing — and it is the most governance-mature of the three reference
implementations: real Ed25519 signing, re-sign-on-promote (AUDIT-REG-005), a
soft-delete audit trail, a public `/log`, a thought-through key-rotation overlap
model, and an unusually complete validation pass. As the single source of truth
for one DNSO-operated namespace, the *data model and signing model* are close to
production-ready.

The architectural problem is that **the entire fleet's correctness and freshness
funnel through this one process, and several of its decisions are sized for a
single-host development registry, not for 100 resolvers reading from it.** The
three that dominate: **(1)** it is a **single-writer, single-instance
embedded-SQLite process with no replication or HA story** — there is exactly one
authoritative box, and the spec's only availability answer is read-only mirrors
that the implementation cannot actually produce (no sync mechanism exists);
**(2)** the `/list` hot path — which the spec designates as the primary endpoint
every resolver polls every 60s — **loads the full active record set into memory
and paginates by slicing a JS array**, so it neither scales nor supports the
delta/conditional fetch the resolver fleet needs; and **(3)** there is **no rate
limiting and the signing key lives unencrypted in-process**, so the root of
trust shares a fate domain with a public-facing, unthrottled HTTP server.

Findings are split into **structural** (must change for a 100-resolver multi-org
deployment) and **v1-acceptable** (fine for a single reference/dev host,
disclosed, or deferrable).

---

## Structural Findings (must change for 100-resolver multi-org)

### S1 — Single authoritative instance: single-writer embedded SQLite, no replication, no HA. (P0)
The Registry is one Node process opening one `better-sqlite3` file
(`data/registry.db`, WAL). It is, by the spec's own §2.2, "the single source of
truth … all resolvers ultimately reference this instance." There is **no
replication, no failover, no read-replica model**. For a fleet of 100 resolvers
this is a hard single point of failure: when this box is down, the whole
namespace stops accepting writes and (once resolver stale windows lapse) stops
resolving. The spec's availability answer is **mirror mode** — but see S2: the
implementation has no way to actually populate a mirror. Embedded SQLite also
caps the deployment to one writer on one host; you cannot scale the
authoritative tier horizontally without changing the storage engine.

### S2 — Mirror mode is specified but not implemented: no sync mechanism exists. (P0)
`REGISTRY_MODE=mirror` only **rejects writes** and **echoes two env vars**
(`AUTHORITATIVE_SNAPSHOT_TIMESTAMP`, `AUTHORITATIVE_SIGNATURE_HASH`) into
`/health`. There is **no code that pulls data from the authoritative registry**
— no sync job, no snapshot import, no hash computation. A mirror started today
serves whatever is in its *local* `registry.db` and *self-asserts* freshness via
operator-set env vars. So the one resilience mechanism the spec offers against
S1 is, in the reference implementation, a manual-data-plus-honor-system shell.
The `authoritative_signature_hash` (SHA-256 of the authoritative `/list` body)
is never computed or verified by any code path. For multi-org resilience this
must become a real replication protocol (Appendix A.4 acknowledges the current
mechanism is "ad hoc").

### S3 — `/list` loads the full table into memory and paginates in JS; no delta/conditional fetch. (P0)
`handleList` runs `listAll.all()` (every active row), maps **all** of them
through `toAPI` only after `rows.slice(offset, offset+limit)` — actually it
slices the raw rows first, but `listAll`/`listByTier`/`listByTag` each
materialize the entire matching set into memory on every call, with `total =
rows.length` computed by reading all rows. `LIMIT/OFFSET` is **not pushed into
SQL** for the unfiltered/tag paths. This is the endpoint the resolver spec
designates as "the primary endpoint used by DillClaw Resolvers to warm their
local capability cache … and refresh it periodically," and from the resolver
review we know all 100 resolvers poll it every 60s pulling the **whole catalog**
(500-record cap per response, so large catalogs require multiple full-scan
paginated calls). There is **no `ETag`/`If-Modified-Since`, no since-cursor, no
delta feed** — so the Registry re-serializes and re-sends the full catalog
~100×/minute regardless of whether anything changed. This is the concrete
bottleneck the resolver-side review (its S1) predicted, seen from the server
side. The `tag` filter is also a `LIKE '%"tag"%'` scan with no supporting index.

### S4 — No rate limiting anywhere; public read endpoints are unthrottled in-process. (P1)
The implementation enforces **no rate limits** on `/list`, `/lookup`, `/verify`,
`/log`, or even the write endpoints beyond the bearer check. The spec (§11.3)
explicitly punts this to "a reverse proxy (nginx/Caddy)." That is a defensible
*deployment* stance, but as shipped the single authoritative process — which is
also holding the root signing key (S5) — has no backpressure against scraping,
`/verify` floods, or `/lookup`-miss storms. `/lookup` and `/verify` each run a
`lookupByName` + JS `compareSemver` sort per call; `/log` runs a dynamic
`COUNT(*)` + page query per call. At fleet scale with no throttle, a single
misbehaving or hostile caller degrades availability for all 100 resolvers and
every org behind them.

### S5 — Signing key is read into the process at startup and shares a fate domain with the HTTP server. (P1)
`privateKeyPem = fs.readFileSync(PRIVKEY_PATH)` loads the **DNSO root private
key into the memory of the same Node process that terminates public HTTP**. The
spec correctly treats this key as "the root of trust for the entire namespace"
(§5.5) and mandates 0600/offline backup — but the runtime architecture puts it
one RCE/memory-disclosure bug away from the network surface. For a single-DNSO
canonical deployment this is the highest-value secret in the system, and there
is no HSM, no signing-service isolation, no separation between the
network-facing API and the signing authority. At minimum the signer should be a
separate process/service; ideally an HSM or KMS. (Structural because it's an
architecture boundary, not a config value.)

### S6 — Signed payload omits `registration_date`; usage-history trust is forgeable end-to-end. (P1)
The canonical JSON signs ten fields; `registration_date` is **not** among them
(confirmed in `canonicalJSON` and §5.2). The resolver weights usage history at
0.30 derived from exactly that unsigned field. So any mirror, cache, or
intermediary — or a registrant supplying `registration_date` at POST time, which
`handleRegister` accepts via `body.registration_date || today` — can **backdate
to inflate trust score** without breaking the signature. The Registry spec
discloses the resolver-side consequence only obliquely; the resolver spec flags
it (§6.2 security note). In a multi-org setting where orgs compete for ranking,
this is a standing integrity gap in the signed-record model, not just a resolver
concern. It should move into the signed field set (the spec anticipates this but
defers it).

### S7 — No registrant identity model: one shared admin token is the entire write/governance authority. (P1)
`isAuthorized` checks a single `REGISTRY_ADMIN_TOKEN` (Bearer) for
`/register`, `/revoke`, `/promote`. There is **no per-registrant identity**, so
in a multi-org deployment either every registering org shares one god-token
(any org can revoke or promote any other org's records, and self-assign
`canonical`), or registration is centralized through the DNSO as a manual
bottleneck. The spec acknowledges this (§8.2, Appendix A.1) but the gap is
structural for multi-org: there is no way to scope "a registrant may revoke only
its own records," and `caller` in the audit log is an **unauthenticated,
self-declared header** (`x-dillclaw-caller`), so the audit trail's attribution
is spoofable.

### S8 — Trust tiers are self-assignable up to `canonical`, accepted at face value, with no enforcement. (P2)
`handleRegister` accepts any tier including `canonical`, logs a
`provisional_tier` note, and stores it — and the resolver (per its own review)
scores the declared tier at face value because the provisional-detection
mechanism "is not yet defined." So today, across orgs, **anyone with the write
token can register a `canonical`-tier record and have it scored as canonical.**
The Registry records a breadcrumb in `/log` but enforces nothing. This is
disclosed as intended-provisional behavior, but in a multi-org production
context it is an open trust-escalation path until the cross-spec
detection/weighting work lands (Registry A.2 + resolver scoring profile).

### S9 — `/log` is "append-only" by convention only; not tamper-evident. (P2)
The audit trail's value (governance, §8, Namespace Standard §8.3) rests on
immutability, but immutability is enforced solely by the *absence* of an
UPDATE/DELETE endpoint. The SQLite file is writable, there is **no hash chaining,
no Merkle root, no signature over log entries**. Anyone with host/file access can
rewrite history undetectably, and a mirror's `/log` is entirely
self-asserted. For a record that governance decisions and the future
reporter-incentive/reference-monitor work (Anthill A.7/A.10) lean on, the
"append-only" guarantee should be cryptographic, not procedural.

---

## v1-Acceptable Limitations (fine for single reference/dev host)

| # | Item | Why acceptable now | When it becomes structural |
|---|------|--------------------|----------------------------|
| A1 | Plaintext HTTP, binds `0.0.0.0`, CORS `*` | Reference behind a TLS proxy | Once network-exposed to 100 remote resolvers (pairs with A1-proxy + S4) |
| A2 | Top-level-only canonical JSON (nested schemas signed as-stored) | Documented; matches one reference impl | Cross-impl/3rd-party verifiers need RFC 8785 (spec §5.2 plans it; breaking) |
| A3 | Key rotation re-sign + overlap is manual (`rotate-key.js`) | Tooling exists; 30-day overlap modeled | At scale, re-signing the whole catalog under load needs a runbook + throughput plan |
| A4 | `/health`, `/list` recompute counts per call | Cheap at small catalog | Folds into S3 once catalog/poll volume grows |
| A5 | Single shared admin token in open/local mode | Local dev default | Covered by S7 for multi-org |
| A6 | No schema-migration engine (manual `meta.schema_version`) | §6.4 sets the policy | Needs real migration tooling before a live upgrade |

The engineering quality of the request layer is high and should be preserved:
parameterized prepared statements (no SQL injection), exhaustive single-pass
validation with strict semver/RFC-3339/calendar checks, re-sign-on-promote,
read-path name normalization, bounded request bodies (256 KB), partial unique
index on `(name, version) WHERE revoked=0`, and the mirror `/health` going
`degraded` on malformed freshness fields.

---

## Priority Ordering

1. **S1 / S2** — Decide and build the authoritative-tier availability model:
   real replication or a genuine mirror-sync protocol with verifiable freshness.
   Today there is one box and no working standby.
2. **S3** — Make `/list` scale: SQL-level pagination, an indexed/`ETag`'d
   conditional-fetch or delta feed so 100 resolvers don't pull the full catalog
   every 60s. This is the fleet bottleneck.
3. **S4 / S5** — Rate limiting/backpressure, and isolate the signing key from
   the network-facing process (separate signer / HSM / KMS).
4. **S6 / S7** — Put `registration_date` in the signed set; introduce a
   per-registrant identity model so revoke/promote and audit attribution are
   scoped and authenticated.
5. **S8 / S9** — Enforce (or resolver-detect) tier attestation; make the audit
   log cryptographically tamper-evident.

## Bottom Line

The Registry's *contract* — store durably, sign honestly, serve accurately — is
well met for a single DNSO-operated box, and its governance surface is the most
complete in the stack. The risk is that **"single box" is load-bearing**: one
unreplicated SQLite writer (S1) with a non-existent mirror story (S2), a
full-catalog `/list` that the entire resolver fleet hammers (S3), and the root
signing key sitting inside an unthrottled public process (S4/S5). Those are the
decisions that do not survive 100 resolvers across organizations and should gate
any production commitment. The data-model and validation work underneath is
strong and worth carrying forward unchanged.
