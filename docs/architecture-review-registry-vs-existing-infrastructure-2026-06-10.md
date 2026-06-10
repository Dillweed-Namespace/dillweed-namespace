# Dillweed Registry — Comparative Review Against Existing Registration Infrastructure

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Scope:** `specs/registry-spec.html` (v0.1.5) + `registry/server.js` (v0.2.8)
**Comparison set:** DNS registries/DNSSEC, PKI certificate authorities (WebPKI, CT, ACME),
package registries (npm, crates.io, PyPI), service discovery (Consul, etcd),
workload identity (SPIFFE/SPIRE), and supply-chain trust frameworks (TUF, Sigstore)
**Companion document:** `docs/architecture-review-registry-2026-06-10.md` (production-readiness
internals; this review takes the ecosystem-positioning lens instead and cross-references its
findings as S1–S9 where they overlap)

---

## Summary

The Registry occupies a niche none of the compared systems fills: a **governed,
centrally-signed directory of agent-invocable capabilities**, where the signature covers
behavioral contracts (input/output schemas), the trust assessment is a first-class
governed field, and the audit trail is a protocol obligation rather than an ops artifact.
That combination is genuinely novel and worth keeping.

Around that core, however, the Registry currently reinvents — in weaker form — at least
five problems that adjacent infrastructure has spent decades hardening: **transparency
logging** (Certificate Transparency / Sigstore Rekor), **root-of-trust and key-rotation
metadata** (TUF), **registrant identity** (OIDC trusted publishing), **change
distribution** (crates.io index / npm changes feed / etcd watch), and **multi-party
delegation** (DNS zone delegation, TUF delegations, SPIFFE federation). For a
single-steward reference deployment the reinventions are tolerable; for the
multi-organization namespace operator the spec aspires to serve, each one is a place
where adopting the existing pattern is both stronger and more credible to adopters than
the bespoke version.

The recommendation in one sentence: **keep the Capability Record, the trust-tier
governance, and the revocation semantics as the product; delegate cryptographic
plumbing, identity, and distribution to the established patterns; and add delegation,
counter-signatures, and record expiry as the three capabilities that make multi-org
operation real.**

---

## 1. System-by-System Comparison

### 1.1 DNS registries and DNSSEC

**What DNS does that the Registry mirrors:** hierarchical names, an authoritative store
behind caching resolvers, TTL-bounded revocation propagation (the spec explicitly
borrows this framing in §8.1), and registry/registrar separation of concerns.

**Where the Registry is stronger for its use case:** DNS records are semantically thin —
capability metadata, behavior schemas, and trust tiers have no natural DNS encoding
beyond TXT-record abuse. Immediate authoritative-side revocation with a logged reason
has no DNS analog (DNS "revocation" is just record removal, unlogged and unexplained).
A single-operator namespace also avoids the registrar-mediated complexity DNS carries.

**Where DNS handles it better:**
- **Delegation.** DNS's core trick — signing a delegation (NS + DS records) that hands a
  subtree to another operator's keys — is exactly what a multi-org namespace needs and
  exactly what the Registry lacks. Today every record in every org's subtree is signed
  by the one DNSO key, and every write goes through one shared admin token (companion
  review S7). DNS solved "many organizations, one coherent namespace, no shared
  credentials" in 1987.
- **Trust-root distribution.** The DNSO public key is bootstrapped from a single HTTPS
  URL (`dillweed.com/dnso_public.pem`), making the WebPKI certificate for dillweed.com
  the de-facto root of the whole namespace. DNSSEC + DANE, or at least a published
  key-pinning/rollover policy, is the established answer.

**Verdict:** don't rebuild DNS, but adopt its delegation model (see §3.1) and consider
anchoring the trust root in DNSSEC rather than solely in one TLS endpoint.

### 1.2 PKI certificate authorities, CT, and ACME

The DNSO is functionally a one-key CA: it is the sole signer, sole revoker, and its
private key is the namespace's root of trust (§5.5 says so explicitly — "back up the
private key with the same care as a certificate authority root"). The comparison is
therefore the most direct, and the most instructive, because PKI has already absorbed
the failures the Registry's current design invites:

- **No expiry.** Capability Records have no `not_after`. The only lifecycle exit is
  revocation, which means the revocation system must work forever for every record ever
  issued. WebPKI spent twenty years learning that revocation-only lifecycles fail
  (CRLs grew unboundedly, OCSP became a privacy/availability liability) and converged on
  **short-lived, renewable credentials** (Let's Encrypt's 90-day certs, now shorter).
  A renewable registration also makes the trust-tier criteria ("30+ days active")
  *verifiable by construction* instead of inferred from a forgeable field (S6: the
  unsigned, registrant-suppliable `registration_date`). X.509 signs `notBefore`; the
  Registry should sign its temporal claims too.
- **Online root key.** The root private key lives in the RAM of the public-facing HTTP
  process (S5). Every serious CA keeps the root offline and signs with rotating
  intermediates. The `dnso_v1_` prefix already anticipates algorithm migration; an
  intermediate-key layer is the same idea applied to compromise containment.
- **Append-only by convention.** The registration log (§2.1, §6.3) is append-only only
  because no endpoint mutates it (S9). Certificate Transparency (RFC 6962) is the
  worked answer: a Merkle-tree log with signed tree heads, inclusion proofs, and
  third-party monitors. Sigstore's Rekor is a deployable off-the-shelf implementation.
  The Registry's `/log` endpoint — already public, already id-ordered — is two-thirds of
  the way to a CT-style log; the missing third (hash chaining + signed checkpoints) is
  the part that should not be home-built.
- **Key-rotation metadata.** §5.6's overlap-window design (dual keys, `/pubkey?previous=true`,
  `key_rotation` health fields) is a thoughtful hand-rolled subset of what **TUF**
  (The Update Framework) specifies completely: versioned, signed root metadata with key
  thresholds, expiry, and client-side rotation rules. TUF is the standard answer for
  "how do clients safely follow a rotating root of trust" and is what PyPI and Sigstore
  adopted rather than inventing their own.

**Where the Registry is stronger for its use case:** X.509 binds an identity to a key
and almost nothing else; real-world attempts to put governance semantics into
certificates (EV/OV tiers) failed because browsers couldn't price the difference. The
Registry's signature covers *what the capability does* — description, endpoint,
protocol, permissions, input/output schemas — which is a behavioral contract no
certificate carries. Its trust tiers are consumed by a resolver that actually scores
them, which is the feedback loop EV never had. This is the defensible core.

### 1.3 Package registries (npm, crates.io, PyPI)

This is the closest operational analog: named, versioned, immutable-once-published
artifacts with a yank/revoke lifecycle and a public index.

**Convergent design (validation that the Registry's instincts are right):**
crates.io's "published versions are immutable; yank hides but never deletes" is
precisely the Registry's soft-delete revocation (§6.2, §8.1) — including the
new-row-on-re-register rule. The name+semver uniqueness key, the strict semver grammar
in `validateRecord`, and the 409-on-duplicate are all the same shape as crates.io.

**Where the Registry is stronger:** package registries are *uncurated by design* —
no central signing of content (npm provenance attestations are publisher-side), no
trust tiers, squatting handled by policy not protocol, and revocation reasons optional
or absent. The Registry's central signature + governed tiers + mandatory revocation
reasons make it a *curated* registry, which is the right call for capabilities that
agents will autonomously invoke (the blast radius of a malicious capability is an
action, not a build failure).

**Where they handle it better:**
- **Index distribution.** The companion review's S3 (every resolver re-pulls the full
  catalog every 60s; no ETag, no delta) is a solved problem: crates.io publishes a
  content-addressed sparse index over plain HTTPS; npm exposes a sequential changes
  feed. Either pattern gives resolvers cheap "what changed since cursor X" semantics,
  and a hash-chained index doubles as the mirror-sync protocol the spec currently
  improvises in §2.2/§10.3 (S2: the snapshot-hash mechanism is specified but never
  computed by any code path; Appendix A.4 already concedes it is "ad hoc").
- **Registrant identity.** PyPI and npm moved to **OIDC trusted publishing** (a
  registrant authenticates as "this GitHub/GitLab identity" via short-lived OIDC tokens)
  precisely to escape long-lived shared secrets — which is the Registry's current
  single-bearer-token model (S7). Appendix A.1 plans "a registrant identity model";
  the recommendation is to not invent one.

### 1.4 Service discovery (Consul, etcd)

The spec itself invokes etcd ("Kubernetes named workloads; kubelets ran them; etcd
stored their state," §13). The comparison clarifies what the Registry should *not*
become:

- Consul/etcd are **liveness directories**: ephemeral registrations, leases/TTLs,
  active health checks, watch-based change propagation, Raft-replicated HA. Their trust
  model is perimeter ACLs inside one organization — no record signing, no governance,
  no audit semantics. The Registry is the opposite: a slow-changing, signed,
  cross-organization **registry of record**.
- The Registry should **not** grow Consul-style active health checking of capability
  endpoints. §11.2 already draws this line correctly ("the capability endpoint itself"
  is out of scope), and the resolver's `endpoint_unchecked` trust signal shows where
  liveness evaluation actually belongs — at the resolution/scoring layer, or as
  attestations *recorded in* the Registry rather than *performed by* it.
- Two patterns are worth taking: **watch/long-poll or ETag-conditional reads** (etcd
  watch is the mature version of what 100 resolvers polling `/list` every 60s
  approximates badly), and — if the authoritative tier ever needs HA (S1) — Raft-backed
  storage rather than a bespoke replication protocol.

### 1.5 SPIFFE/SPIRE (workload identity)

SPIFFE answers a question the Registry currently cannot: **is the thing serving the
registered endpoint actually the thing the record describes?** The DNSO signature
proves the *record* wasn't tampered with; nothing proves the *endpoint* is operated by
the registrant the record implies. SPIFFE's workload attestation + short-lived SVIDs
close exactly that gap.

Two specific imports:
- A Capability Record could carry an optional **workload identity binding** (a SPIFFE
  ID or equivalent). A resolver or calling agent then verifies the endpoint presents a
  matching SVID before invocation — converting `endpoint_unchecked` from a permanent
  trust-score penalty into a verifiable claim.
- **SPIFFE federation** (trust-domain bundle exchange) is the worked model for the
  day two namespace operators want their registries to trust each other's records —
  the multi-operator future the spec's "Mirror" mode gestures at but doesn't address.

---

## 2. Where the Registry's Design Is Genuinely Stronger

These are the elements no compared system provides, and the reason the Registry should
exist at all:

1. **Behaviorally-scoped signatures.** Signing `input_schema`/`output_schema` alongside
   name, endpoint, protocol, and permissions (§5.2) makes the *behavioral contract*
   tamper-evident. Certificates sign identity; package signatures sign bytes; nothing
   in the comparison set signs "what this capability accepts and returns." For
   agent-invoked capabilities this is the right object to protect.
2. **Trust tiers as governed protocol data.** A tier assigned through a logged
   promotion process, signed into the record, demotable without revocation (§9), and
   consumed by a scoring resolver is a governance loop none of the compared systems
   close. (npm has no curation; EV certificates had no consumer.)
3. **Audit as protocol obligation.** `GET /log` (added in v0.1.4) makes the registration
   log a public API conformance requirement, not an operator courtesy. Mandatory
   revocation reasons (§8.1, enforced in `handleRevoke`) put accountability in the
   protocol. CT is the only comparable precedent, and CT took a browser-vendor mandate
   to achieve it.
4. **Honest self-description.** The spec is unusually disciplined about its own
   boundaries (§11.2 "What the Registry Does Not Secure," the local-key advisory
   printed at every startup, Appendix A's disclosed gaps). That candor is itself an
   adoption asset in a trust product.

---

## 3. What Would Make It Useful to a Multi-Organization Namespace Operator

Three additions, in priority order — each one borrowed from the system that proved it:

### 3.1 Delegated sub-namespace authority (from DNS / TUF delegations)
A signed **delegation record**: the DNSO signs a statement granting org X's public key
registration authority over `orgx.*`. Org X then signs its own records; verifiers check
record-signature → delegation → DNSO root. This eliminates the shared god-token (S7),
scopes revocation naturally (an org can revoke only within its delegation; the DNSO
retains root override, which is the §8.2/A.1 goal), and turns "multi-org" from a token-
distribution problem into a key-distribution problem PKI already solved. TUF's
delegation metadata format is a ready-made design to copy.

### 3.2 Dual signatures: registrant attestation + DNSO governance (from npm provenance / Sigstore)
Today the DNSO signature proves the registry wrote the record — but since the registry
signs whatever a token-holder submits, it cannot prove *who asserted the content*. Add a
registrant counter-signature (or Sigstore-style keyless attestation bound to an OIDC
identity) over the submitted record, stored alongside the DNSO signature. The DNSO
signature then means "accepted under governance," the registrant signature means "I
published this" — the same separation npm provenance draws between publisher
attestation and registry acceptance. This also fixes the spoofable `caller` audit
attribution (S7).

### 3.3 Record expiry and renewal (from Let's Encrypt / SPIFFE)
Add a signed `not_after` with a renewal endpoint. Benefits compound: revocation lists
stay bounded; abandoned capabilities age out instead of accumulating as attack surface;
"N days of continuous registration" tier criteria become cryptographically demonstrable
(each renewal is a logged, signed event); and the unsigned-`registration_date` trust
forgery (S6) loses most of its value because history is evidenced by the renewal chain,
not by a self-reported date.

---

## 4. Keep / Delegate / Integrate

### Keep as unique (the product)
| Capability | Why |
|---|---|
| Capability Record schema with signed behavioral contracts | No existing system covers this object; it is the reason to adopt |
| Trust-tier governance (promote/demote, criteria, DNSO attestation) | The curation loop is the differentiator vs. npm-style open registries |
| Revocation semantics (soft-delete, mandatory reason, slot-freeing, immutable history) | Already matches best practice (crates.io yank) and exceeds it on accountability |
| Public `/log` as a conformance requirement | Rare and valuable; becomes stronger once tamper-evident (below) |
| Namespace registration policy (name grammar, uniqueness, future IDNA rules) | Inherently the operator's job |

### Delegate to existing infrastructure (the plumbing)
| Current bespoke mechanism | Delegate to | Replaces |
|---|---|---|
| Append-only-by-convention log (S9) | RFC 6962 Merkle log / Sigstore Rekor; sign tree heads | Hand-built hash chaining |
| §5.6 key-rotation overlap + §2.2/§10.3 mirror snapshot-hash (S2) | TUF root metadata for rotation; content-addressed signed index (crates.io pattern) for mirrors and resolver sync (S3) | Bespoke rotation/mirror protocol the spec itself calls "ad hoc" (A.4) |
| Single shared admin bearer token (S7) | OIDC trusted publishing for registrants; delegations (§3.1) for orgs | Invented account system (A.1) |
| Planned RFC 8785 migration (§5.2) | Proceed — JCS is the right call; pair with the dual-signature window already specified | Top-level-only canonicalization |
| Root key in the HTTP process (S5) | KMS/HSM custody, offline root + online intermediate | In-process `fs.readFileSync` of the namespace root |
| Endpoint liveness | Resolver-layer checks or SPIFFE SVID verification, recorded as attestations | Any temptation toward Consul-style active health checking |

### Integration points that increase adoptability
1. **ETag/If-None-Match on `/list` and `/log`** — one afternoon of work, standard HTTP,
   removes the worst of the polling cost (S3) without any protocol change.
2. **Cursor/delta feed (`/log?since=` already nearly is one)** — the registration log is
   a natural change feed; documenting it as the resolver-sync mechanism converges S2/S3
   with the transparency-log work instead of adding a third mechanism.
3. **MCP alignment.** `protocol: "mcp"` is already a first-class enum value. Publishing
   a documented mapping between Capability Records and MCP server manifests would make
   the Registry immediately legible to the largest existing population of
   agent-capability publishers — the most realistic external-registration path for
   Milestone 04 (§12).
4. **DNS-based name-control proof at registration** (ACME DNS-01 pattern): registrants
   claiming `acme.*` prove control of a corresponding DNS name. Cheap squatting defense
   that reuses universal infrastructure.
5. **DNSSEC/DANE anchoring of the DNSO public key**, supplementing the single
   HTTPS-fetched PEM, so the namespace root does not reduce entirely to one WebPKI
   certificate.
6. **Sigstore compatibility for record signatures** — verifiers already exist in every
   major language; `dnso_v1_` + PEM-over-HTTPS requires every adopter to hand-roll
   verification (the four-step §5.4 procedure), which is friction Sigstore removes.

---

## 5. Bottom Line

The Registry's defensible core is exactly what the spec's own contract sentence claims —
"store it durably, sign it honestly, serve it accurately" — *applied to an object nobody
else stores*: a signed, governed, behaviorally-specified capability record. None of DNS,
PKI, npm, Consul, or SPIFFE produces that artifact, and the governance surface around it
(tiers, reasons, public log) is ahead of all of them.

Everything else — transparency, identity, rotation metadata, replication, change
distribution, delegation — is territory where a proven pattern exists, where the current
bespoke mechanism is the weaker reinvention (often acknowledged as such in Appendix A),
and where adopting the standard pattern doubles as an adoption argument: a prospective
multi-org operator can be told "records are CT-logged, publishing is OIDC-trusted,
rotation is TUF, sync is a content-addressed index" and immediately know what they are
trusting. The three genuinely new capabilities worth building next — delegation,
registrant counter-signatures, and expiry/renewal — are the ones that convert the
Registry from a single-steward reference deployment into something a second
organization could responsibly join.

---

*Produced under capabilities `review.spec.read`, `review.repo.read`, and
`review.report.write`, all boundary-allowed and DillClaw-verified this session.
No project artifacts were modified.*
