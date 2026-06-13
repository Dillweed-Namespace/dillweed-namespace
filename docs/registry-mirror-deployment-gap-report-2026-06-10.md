# Dillweed Registry Mirror — First-Time Deployment Gap Report

> **Historical review — still current.** W0 touched none of the mirror surface; the entire report was re-verified accurate on 2026-06-12 (mirror mode remains an env-var echo, `registry/server.js:598–614`; no synchronization protocol exists in spec or code). See [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md) (FDI-REG-002, FDI-DOC-007) for current status. Preserved unmodified as historical evidence.

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Exercise:** Engineer setting up a new Registry instance as a read-only mirror
of the authoritative Dillweed Registry, using only:
1. `specs/registry-spec.html` (v0.1.5, May 2026)
2. `README.md` (repo root)

**Question answered:** Is there enough information in these two documents to
deploy and operate a *conformant* mirror?

## Verdict

**No.** This is a categorically worse outcome than the companion resolver
exercise (see `dillclaw-deployment-gap-report-2026-06-10.md`), where the happy
path at least produced a running service. For a mirror, there is no happy path
at all: the spec names the mirror deployment mode and imposes two conformance
obligations on it, but **specifies no synchronization protocol** (Appendix A.4
concedes the current mechanism is "ad hoc"), **the reference implementation
has no mirror mode**, the README contains **zero mirror content**, and the
registry's only documented write path (`POST /register`) **silently overwrites
submitted signatures — making it impossible to import authoritative signed
records verbatim**, which is the one thing a mirror exists to do. An engineer
restricted to these two documents must design the synchronization protocol,
the read-only enforcement, and the freshness fields themselves, then guess at
whether the result is conformant.

Gaps are numbered G-1 through G-24, grouped into five categories, with
severity (HIGH = blocks or endangers a correct deployment; MEDIUM = requires
guessing, inference, or original design work; LOW = friction or cosmetic).

---

## A. The synchronization protocol does not exist

### G-1 (HIGH) — No mirror synchronization mechanism is specified anywhere
§2.2 says a mirror is "synchronized periodically" and §10.3 describes what a
synchronized mirror must expose — but no section says **how synchronization
happens**. There is no sync endpoint, no snapshot format, no delta mechanism,
no instruction to poll `GET /list`, no required or recommended sync interval,
and no error/retry semantics. Appendix A.4 confirms this is known, describing
"a standardized mirror synchronization protocol that supersedes the ad hoc
snapshot-and-hash mechanism in §2.2 and §10.3" as future work — i.e., the
normative sections reference a mechanism the spec never defines. The deployer
must invent the core function of the system they are building.

### G-2 (HIGH) — Pagination breaks the implied snapshot model
The only plausible sync source is `GET /list`, which returns a **maximum of
500 records per response** with `?limit=`/`?offset=` pagination. Both §2.2 and
§10.3 define `authoritative_signature_hash` as the SHA-256 of "the
authoritative registry's most recent `/list` response body" — *singular*. Once
the authoritative registry holds more than 500 records, "the `/list` response
body" is not a single body: which page is hashed? With which exact query
string? Is an unparameterized `GET /list` implicitly capped at 500, and if so
is the hash then a digest of only the first 500 records? A multi-page sync has
no defined composite-hash rule. The conformance field is well-defined only for
registries small enough to fit one page, and the spec never says so.

### G-3 (HIGH) — Revocation and log replication are unaddressed
All read endpoints filter to `revoked=0` (§6.2), so a `/list`-based sync only
ever sees active records. The mirror must *infer* revocation from a record's
disappearance between polls — never stated, and indistinguishable from any
other cause of disappearance. Worse: §4 makes `GET /log` a conformance MUST
("the endpoint MUST exist and be publicly readable"), with no mirror
exemption. If that obligation applies to mirrors, the append-only registration
log must be replicated too — and no document describes how (the log has its
own 500-entry pagination, monotonic `id`s assigned by the *authoritative*
instance, and an append-only constraint the mirror's local store must somehow
honor for rows it did not create).

### G-4 (MEDIUM) — Sync freshness has no conformance bound
§10.3 says resolvers use `authoritative_snapshot_timestamp` to "detect
staleness beyond their acceptable threshold," but no document recommends or
requires any maximum sync interval for the mirror itself. A mirror synced
once a month exposes a truthful timestamp and is, as far as the spec is
concerned, conformant. Compare §10.1, which pins the resolver's refresh at 60
seconds — the mirror, an extra hop in the same freshness chain, gets no
number at all.

### G-5 (LOW) — Sync politeness vs. authoritative rate limiting
§11.3 tells operators to rate-limit public read endpoints (`/list` included)
behind a reverse proxy. A mirror is, by construction, a high-frequency `/list`
client of the authoritative registry. No guidance reconciles the two — a
correctly rate-limited authoritative registry may throttle exactly the
clients §2.2 encourages to exist.

---

## B. The reference implementation cannot be a mirror

### G-6 (HIGH) — No mirror mode, no upstream configuration, no README path
The spec states plainly: "The reference implementation described in this
document is a local development mode registry" (§2.2). Nothing in either
document provides a mode flag, environment variable, or configuration to run
the implementation read-only, to point it at an upstream authoritative
registry (there is no registry-side analog of the resolver's
`DILLCLAW_REGISTRY_URL`), or to emit the two mirror health fields. The
README's installation section covers exactly one deployment shape:
authoritative/dev mode on port 9475 with a generated admin token. The word
"mirror" does not appear in the README at all.

### G-7 (HIGH) — The only write path destroys what a mirror must preserve
§10.3: mirrors "may not modify DNSO signatures." §3.1/§7: the `signature`
field "MUST NOT be supplied by the registrant. Any submitted value is silently
overwritten by the DNSO-generated signature." These two rules together make
mirror population impossible through the documented API: pushing an
authoritative record into a reference-implementation instance via
`POST /register` would discard the authoritative signature and re-sign the
record with the *mirror's own* key — producing exactly the forged-registry
condition §4's `/pubkey` warning describes. There is no import, bulk-load, or
sync endpoint that accepts pre-signed records verbatim. A conformant mirror
therefore cannot be built *on* the reference implementation as documented; it
requires either direct database manipulation (undocumented, and in tension
with the §6 storage rules) or new code.

### G-8 (MEDIUM) — A mirror's relationship to the DNSO keypair is undefined
A mirror must not hold the DNSO private key (it has no signing authority),
yet the reference install creates a signing registry, and the base `/health`
response is specified to include "signing algorithm" and "public key URL."
What a non-signing mirror reports in those fields, whether it must refuse to
generate a local keypair, and whether its `/pubkey` endpoint should serve the
canonical DNSO key (see also G-16) are all unstated.

### G-9 (MEDIUM) — Test suites and milestones don't cover mirrors
The README's registry suite ("expect 79/79 passing") requires
`REGISTRY_ADMIN_TOKEN` and plainly exercises write paths — a true read-only
mirror would fail it, and no mirror conformance suite exists. §12's five
milestones all concern the authoritative deployment; there is no defined
demonstration that a mirror is correct. "Conformant mirror" has two testable
properties (the health fields) and no test.

### G-10 (MEDIUM) — Platform mismatch with the mirror's stated purpose
Mirrors exist for "regional availability, resilience" (§2.2) and
"geographically distributed resolver deployments" (§10.3) — i.e., servers.
The installer is macOS-only ("Linux support anticipated in a future
release"), with launchd and macOS-Keychain dependencies. The deployment mode
most likely to need Linux is the one with no Linux path.

---

## C. The freshness fields don't deliver what they promise

### G-11 (HIGH) — Self-reported fields cannot detect a lying mirror
§2.2 claims the two health fields "allow resolvers to detect stale,
split-brain, or tampered mirrors **without trusting the mirror itself**."
Both fields are computed and served *by the mirror*. A malicious mirror sets
`authoritative_snapshot_timestamp` to now and
`authoritative_signature_hash` to the hash of its own divergent record set —
both checks pass. The only verification path §10.3 offers is comparing the
hash "against a fresh fetch from the authoritative registry," which requires
downloading the authoritative `/list` — at which point the resolver has the
authoritative data and the mirror served no purpose for that check. Actual
tamper-evidence comes from per-record Ed25519 signatures, not these fields;
the spec's stated security property for the mechanism is overclaimed, and a
deployer cannot tell what guarantee they are actually required to provide.

### G-12 (MEDIUM) — The hash comparison is racy by design
Even between honest parties, the authoritative `/list` body changes with
every registration, revocation, promotion, and `last_updated` stamp. A
resolver comparing the mirror's hash against a *fresh* authoritative fetch
gets a mismatch whenever anything changed since the mirror's last sync — a
false "tampered/split-brain" signal indistinguishable from the real thing. No
tolerance window, snapshot identifier, ETag, or sequence number exists to
distinguish "stale but honest" from "divergent." (Byte-stability across HTTP
is also assumed but not guaranteed: "exact UTF-8 bytes … as served over HTTP"
leaves content-encoding, compression, and chunking effects unaddressed.)

### G-13 (MEDIUM) — Unsigned fields propagate through mirrors undetectably
The signed field set (§5.2) covers ten fields; `registration_date` and `tags`
are outside it. A mirror — buggy or malicious — can alter
`registration_date` on records it serves without invalidating any signature,
directly inflating the resolver's usage-history trust component (the exact
attack the DillClaw spec §6.2 security note describes for "a mirror, cache,
or intermediary"). The registry spec's mirror sections (§2.2, §10.3) never
mention this exposure or impose any obligation on mirrors regarding unsigned
fields.

### G-14 (LOW) — `authoritative_snapshot_timestamp` semantics under partial failure
"The RFC 3339 UTC date-time of the most recent full synchronization" — if a
multi-page sync partially fails, or a sync succeeds but applies no changes,
when does the timestamp advance? "Full synchronization" is undefined
(complete page sweep? any successful poll?). The §3.1 format cross-reference
is also loose: §3.1 defines two RFC 3339 formats (full-date for
`registration_date`, date-time for `last_updated`); the reader must infer
which applies.

---

## D. Mirror API surface and conformance ambiguities

### G-15 (HIGH) — The mirror's required endpoint set is never enumerated
§4 documents nine endpoints for "the Registry." Which must a *mirror* serve?
`/health` clearly (the two fields live there). But: does a mirror serve
`/verify` (verifying against which key?); `/log` (see G-3); `/pubkey` (see
G-16); `/pubkey?previous=true` during upstream rotation? And what do the
write endpoints return on a mirror — `401`, `404`, a new error code? The §4.1
error table has no `READ_ONLY`/`FORBIDDEN` entry, so even a deployer who
decides to reject writes has no specified way to say so. "Does not accept
registrations" (§2.2) is a behavior with no defined wire-level expression.

### G-16 (MEDIUM) — `/pubkey` on a mirror reproduces the threat §4 warns about
§4's `/pubkey` documentation warns that "a compromised registry could serve
forged records and a forged key together," directing canonical verification
to `dillweed.com/dnso_public.pem`. That warning applies with more force to a
third-party mirror — yet nothing says whether a mirror must serve `/pubkey`,
must serve the canonical key bytes if it does, or should omit the endpoint
entirely.

### G-17 (MEDIUM) — Mirror obligations use non-normative language
The spec adopts BCP 14 ("only when they appear in all capitals"). §2.2's
mirror callout correctly uses MUST for the two health fields — but §10.3's
substantive prohibitions are lowercase: mirrors "**may not** modify DNSO
signatures and **may not** promote or revoke records"; "Mirror registries
**must** expose two additional fields." Under the spec's own conformance
terminology, none of §10.3's mirror rules are normative requirements. A
strict reader cannot determine whether signature preservation is a MUST.

### G-18 (MEDIUM) — Upstream key rotation propagation through mirrors is unaddressed
§5.6 defines a planned-rotation overlap window: the authoritative `/health`
carries a `key_rotation` object and `/pubkey?previous=true` serves the prior
key. Nothing says a mirror must detect upstream rotation, propagate the
`key_rotation` object in its own `/health`, or serve the prior key. During an
overlap window, a resolver pointed at a spec-silent mirror sees records
signed under a key mix with no rotation disclosure — and after cutover, a
stale mirror serves records whose re-signing it never synced.

### G-19 (MEDIUM) — Spec v0.1.5 documents implementation v0.2.8
The spec self-identifies as v0.1.5 while the README ships Registry 0.2.8; the
§5.2 canonicalization note refers to "the v0.2.x reference implementation."
No mapping rule between spec versions and software versions is stated — a
mirror operator cannot cite which spec revision their 0.2.8 binary implements
(same gap class as the resolver report's G-15, with a wider version gulf).

### G-20 (LOW) — Base `/health` schema undefined
§4 describes `/health` contents in prose (record count, per-tier breakdown,
signing algorithm, public key URL, uptime) with no field names or example
body. Ironically, the only two registry health fields with pinned names and
formats in the entire spec are the two *mirror* fields — grafted onto an
otherwise unspecified response.

### G-21 (LOW) — Revoked-record history does not replicate
The audit value of soft-delete revocation (§6.2, §8) — revoked rows retained
forever — exists only at the authoritative instance. A `/list`-synced mirror
holds no revoked rows, so `/lookup` 404s and `/log` history (if served at
all) will diverge from authoritative behavior for historical queries. Not
necessarily wrong, but never acknowledged.

---

## E. Operational gaps

### G-22 (MEDIUM) — No TLS/proxy deployment guidance for a public mirror
§11.2 leaves TLS as RECOMMENDED-not-enforced; §11.3's reverse-proxy note
covers rate limiting only. A mirror is the deployment mode most likely to
serve untrusted networks, and neither document provides a TLS termination,
certificate, or hardening procedure for it.

### G-23 (LOW) — Resolver-side mirror support is unverifiable from these documents
§10.3 says a resolver "should fall back to the authoritative registry or
disclose staleness" when mirror freshness can't be confirmed — but whether
the reference DillClaw resolver actually implements the
mirror-freshness check, dual-endpoint fallback, or any mirror awareness is
not stated in either permitted document. A mirror operator cannot tell
whether the fields they are required to expose have any consumer.

### G-24 (LOW) — Tarball SHAs published but unused in the install procedure
Carried over from the resolver report (its G-10): the README's release table
lists tarball SHA256 values, but the installation steps never instruct the
operator to check them — relevant here because a mirror operator's tarball
provenance matters more, not less.

---

## Summary table

| # | Severity | Gap |
|---|---|---|
| G-1 | HIGH | No synchronization protocol specified; Appendix A.4 admits the mechanism is "ad hoc" |
| G-2 | HIGH | `/list` 500-record pagination makes the snapshot-and-hash definition ill-defined beyond one page |
| G-3 | HIGH | Revocation inference and `/log` replication unaddressed despite `/log` being a conformance MUST |
| G-6 | HIGH | Reference implementation has no mirror mode; README has zero mirror content; no upstream config |
| G-7 | HIGH | `POST /register` silently re-signs records — the only write path destroys authoritative signatures |
| G-11 | HIGH | Freshness fields are self-reported; "without trusting the mirror" claim is not achievable as specified |
| G-15 | HIGH | Mirror's required endpoint set and write-rejection behavior never enumerated; no READ_ONLY error code |
| G-4, G-8–G-10, G-12, G-13, G-16–G-19, G-22 | MEDIUM | 12 items: no sync-freshness bound, keypair role on mirror, no mirror tests/milestones, macOS-only, racy hash comparison, unsigned-field exposure, `/pubkey` threat, lowercase "may not" non-normative, spec/impl version split, key-rotation propagation, TLS guidance |
| G-5, G-14, G-20, G-21, G-23, G-24 | LOW | 6 items: sync vs. rate limits, snapshot-timestamp semantics, base health schema, revoked-history divergence, unknown resolver-side support, tarball SHAs unused |

## Recommended highest-leverage fixes

1. **Specify the synchronization protocol** (promote Appendix A.4 to a
   normative section): sync source, pagination handling, composite-hash rule
   for multi-page snapshots, revocation propagation, log replication, and a
   maximum sync interval. This resolves G-1, G-2, G-3, G-4, G-14 — five gaps,
   including three HIGH.
2. **Add a signed-record import path** (or a documented mirror mode) so a
   mirror can store authoritative records with signatures intact, and state
   in §7 that the signature-overwrite rule applies to authoritative mode only
   (G-6, G-7, G-8).
3. **Enumerate the mirror API profile** in §10.3: required endpoints, write
   endpoint behavior (with an error code added to §4.1), `/pubkey` policy,
   and key-rotation propagation (G-15, G-16, G-18).
4. **Capitalize the §10.3 requirements** (MUST NOT modify signatures, MUST
   NOT accept writes, MUST expose the two fields) so mirror conformance is
   actually normative (G-17).
5. **Restate the freshness fields' security claim honestly** — they bound
   staleness for honest mirrors; tamper-evidence comes from record
   signatures, which do not cover `registration_date` or `tags` (G-11, G-13).
