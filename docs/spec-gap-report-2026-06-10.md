# Dillweed Specification Gap Report — Second-Implementation Analysis

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Exercise:** Assume a clean-room Python implementation of the full Dillweed stack
(Registry, Resolver, Anthill) built from the published specifications alone, with
no reference to the Node.js code. This report enumerates every behavioral decision
the specifications do not determine. Each gap is something two good-faith
implementers could legitimately implement differently — and therefore something
that would break byte-compatibility or wire-compatibility between implementations.

**Sources analyzed:**
- Dillweed Registry Specification v0.1.5 (`specs/registry-spec.html`)
- DillClaw Resolver Specification v0.1.7 (`specs/dillclaw-spec.html`)
- Dillweed Anthill Observability Plane Specification v0.1.3 (`specs/anthill-spec.html`)
- Dillweed Namespace Standard v0.4.4 (`specs/namespace-standard.html`)

**Severity legend:**
- 🔴 **BLOCKER** — byte-compatible reimplementation is impossible without resolving this
- 🟠 **MAJOR** — wire-incompatible behavior likely; interop failures in realistic use
- 🟡 **MINOR** — edge case; divergence possible but unlikely to surface in normal operation
- ⚪ **DISCLOSED** — the spec itself acknowledges the gap (Appendix A / known-limitation text)

---

## Summary

The specifications are unusually disciplined about timestamps (RFC 3339 UTC, Z offset,
second precision, everywhere), the trust-score formula (pinned weights, pinned
month constant, pinned tie-breaking), and the canonical-JSON signing field set. Those
are the areas where most specs fail, and Dillweed largely does not.

The gaps cluster in five areas instead:

1. **JSON serialization of response bodies is unspecified everywhere.** Byte
   compatibility requires pinning key order, whitespace, Unicode escaping, and
   number formatting for every endpoint — none of which any spec does. This is
   fatal for the mirror `authoritative_signature_hash` mechanism, which hashes the
   exact bytes of a `/list` response whose ordering and serialization are undefined.
2. **Canonical-JSON signing depends on JavaScript `JSON.stringify` semantics**
   ("bytes-as-stored" for nested schemas) that a Python implementation cannot
   reproduce from the spec text alone.
3. **Error precedence is undefined in both the Registry and the Resolver.** Both
   specs define error vocabularies but never specify which error wins when a
   request fails multiple checks, or when different candidates are eliminated at
   different pipeline stages.
4. **Success-path response schemas are mostly undefined.** `/health` bodies,
   `/register` response envelopes, `/lookup` and `/list` shapes, HTTP success
   codes, and the resolver's `no_match` body are all left to the implementer.
5. **Anthill has no wire protocol at all.** The spec defines signal metadata
   semantics but no endpoint paths, no request/response schemas, no per-class
   payload schemas, no nonce encoding, and no canonical serialization for the
   signature it requires. A second implementation cannot exchange a single
   signal with the first.

Gap counts: Registry 34, Resolver 31, Anthill 16, cross-cutting 7 — **88 total**,
of which 9 are blockers and 14 are spec-acknowledged (disclosed).

---

## Part 1 — Registry (spec v0.1.5)

### 1.A Canonical JSON & Signing

**REG-01 🔴 `JSON.stringify` semantics are not portable.**
§5.2/§5.4 require "compact `JSON.stringify()` output" for the canonical signing
payload. A Python implementer must reverse-engineer ECMA-262 serialization:
- Non-ASCII characters: emitted raw (UTF-8), not `\uXXXX`-escaped (Python's
  default `ensure_ascii=True` diverges).
- Which control characters are escaped and in what form (`` vs `\b`).
- Number formatting: ECMA-262 `Number::toString` (e.g., `1e+21` thresholds,
  shortest-round-trip doubles) vs Python `repr(float)`. Any number anywhere in
  `input_schema`/`output_schema` can produce divergent canonical bytes.
- Lone surrogates / well-formed-stringify behavior.
The spec MUST either pin "UTF-8, no non-mandatory escaping, ECMA-262 number
serialization" explicitly or reference a serialization RFC. (The planned RFC 8785
migration in §5.2 acknowledges this for v0.2 but v0.1.x byte compatibility is
undefined today.)

**REG-02 🔴 "Bytes-as-stored" for nested schemas is undefined at the API boundary.**
§5.2 says nested `input_schema`/`output_schema` objects are signed "in their stored
JSON representation as-supplied by the registrant, without recursive key sorting,"
and "the registry preserves the bytes-as-stored." But the registrant supplies a
parsed JSON HTTP body, not bytes. Does "as-stored" mean (a) the exact byte slice of
the request body, (b) re-serialization of the parsed object preserving insertion
order, or (c) something else? Option (b) is what a Node implementation gets for
free; option (a) requires raw-body capture. A Python implementation re-serializing
a parsed dict will preserve insertion order but diverge on whitespace, escaping,
and float formatting unless REG-01 is also resolved. The spec discloses fragility
(⚪ partially) but does not define the storage rule precisely enough to replicate.

**REG-03 🟠 Optional signed fields other than the schemas: presence rule undefined.**
§5.2 specifies omit-when-absent only for `input_schema`/`output_schema`.
`permissions` is optional (§3.1) but appears unconditionally in the canonical-JSON
field list. When `permissions` is not supplied: omitted from canonical JSON, or
included as `[]`? Either choice changes the signed bytes. Same question if a
registrant supplies `permissions: []` explicitly — is that distinct from absent?

**REG-04 🟠 Signature base64url padding unspecified.**
§5.3: "base64url-encoded raw Ed25519 signature bytes." 64 signature bytes encode to
86 chars unpadded or 88 with `==`. §5.1's "~88 base64url characters" suggests
padded; "base64url" convention (RFC 4648 §5) commonly drops padding. Verifiers must
also know whether to accept both on decode.

**REG-05 🟡 The byte string actually signed is unstated.**
Presumably the UTF-8 encoding of the canonical JSON string. Never said. (UTF-16 is
the native JS string representation; a literal reading could diverge.)

**REG-06 🟠 Re-signing on `/promote` is implied but never stated.**
`trust_tier` is in the signed field set. `/promote` changes it. Therefore the
record must be re-signed and `last_updated` (also signed) re-stamped — otherwise
every promoted record fails `/verify`. The spec says only "the action is logged
and the updated record returned." A literal implementation that mutates the tier
without re-signing is spec-conformant text-wise and broken in practice. Also
undefined: does promotion update `last_updated`? (It must, if re-signing; but then
"last updated" semantics for consumers change silently.)

**REG-07 🟡 `/pubkey` PEM format details unspecified.**
PEM label (`PUBLIC KEY` SPKI per RFC 5280? `ED25519 PUBLIC KEY`?), line width,
trailing newline. The trailing-newline question is not cosmetic: the steward
workflow verifies `dnso_public.pem` by SHA-256 of the served bytes, so two
implementations differing by one `\n` produce different trust-root hashes.

### 1.B Validation & Defaults

**REG-08 🟠 Total name length / component count unbounded.**
§3.1/§7 bound each component (2–64 chars) but set no maximum component count or
total path length. A 10,000-component name is valid per spec. Implementations
will pick different limits (HTTP header limits, DB index limits) and diverge.

**REG-09 🟠 Semver validation grammar unpinned.**
"Semver-formatted string (e.g. `1.0.0`, `2.3.1-beta`)." Is build metadata
(`1.0.0+build.5`) accepted? (The resolver's `"stable"` rule implies build-metadata
versions exist in the wild.) Is `v1.0.0` rejected? `1.0`? Leading zeros
(`1.02.0` — invalid per semver.org, but is the registry required to enforce the
full grammar)? Different semver libraries (node-semver vs python `semantic_version`
vs `packaging`) disagree on all of these.

**REG-10 🟠 `endpoint` URL validation semantics undefined.**
"Must parse as a valid URL. HTTP and HTTPS accepted; custom schemes rejected."
Parser unspecified (WHATWG URL vs RFC 3986 — they disagree on many inputs, e.g.
`http://exa mple.com`, backslashes, non-ASCII hosts). Are `localhost`/private IPs
allowed? Userinfo? Fragments? Empty path? Maximum length? Node's `new URL()` and
Python's `urllib.parse` accept different sets of strings.

**REG-11 🟡 `description` constraints minimal.**
"Non-empty string" — is `" "` (whitespace-only) non-empty? Max length? Control
characters allowed?

**REG-12 🟡 Array field constraints undefined.**
`permissions`/`tags`: "array of strings." Empty arrays allowed? Empty-string
elements? Duplicate elements? Max element count/length? Case sensitivity of
permission strings (resolver does "exact-match only," so `Query` ≠ `query` — but
may the registry store `Query`)?

**REG-13 🟠 `registration_date` is registrant-suppliable with no bounds.**
§3.1: optional, "defaults to the date of registration if not supplied." May a
registrant supply a *future* date? A date decades in the past (inflating resolver
usage-history credit — the exact attack §6.2 of the resolver spec warns about)?
The registry imposes no validation rule at all. Also: "the date of registration"
in which timezone — UTC presumably, but unstated (a record registered at 23:30
local could carry either of two dates).

**REG-14 🟠 `input_schema`/`output_schema` type conflict between specs.**
Registry §7: "must be valid JSON objects." Namespace Standard §4.1: "URI or inline
JSON Schema." Is a string URI accepted? The two normative documents disagree.
Also: must the object be a *valid JSON Schema*, or any object? Which JSON Schema
draft?

**REG-15 🟡 Unknown fields in `POST /register` body: rejected, ignored, or stored?**
Only `/log` has an unknown-parameter rule ("MUST be ignored"). For registration,
an implementation that rejects unknown fields with 422 and one that silently drops
them are both defensible.

**REG-16 🟡 Content-Type enforcement unspecified.**
"All endpoints accept and return application/json" — is a missing or wrong
`Content-Type` on POST a 400? Ignored? Charset parameter handling?

### 1.C Error Precedence & Error Schema

**REG-17 🟠 Check ordering across error classes undefined.**
A request can simultaneously be unauthenticated (401), malformed JSON (400),
validation-failing (422), and a duplicate (409). The spec defines the codes but
not the precedence. Concretely:
- Auth before or after body parse? (401 vs 400)
- Duplicate check before or after field validation? (409 vs 422 for a duplicate
  record that also has an invalid `protocol`)
- Does `/revoke` of a non-existent record return 404, and does that check precede
  or follow the `reason`-required validation (422)?

**REG-18 🟠 422 `errors` array schema undefined.**
"Includes a structured errors array listing every failure simultaneously." Element
shape (string? `{field, code, message}`?), ordering (field declaration order?
alphabetical?), and whether one field can yield multiple entries are all
unspecified.

**REG-19 🟡 Error envelope for non-422 errors undefined.**
§4.1 maps HTTP codes to error-code strings but never shows the JSON body shape
(`{"error": ...}`? `{"error_code": ..., "message": ...}`? Is `detail` only on 500?).

**REG-20 🟡 Invalid name syntax on `GET /lookup/<name>`: 400 or 404?**
Lookup of `RESEARCH.market` (uppercase, invalid syntax): is that BAD_REQUEST or
just NOT_FOUND? Affects clients distinguishing "you queried wrong" from "doesn't
exist."

### 1.D Read-Path Semantics & Ordering

**REG-21 🔴 `/list` ordering and serialization undefined — breaks the mirror hash.**
§2.2/§10.3 define `authoritative_signature_hash` as the SHA-256 of "the exact
UTF-8 bytes of the authoritative registry's most recent `/list` response body …
computed without re-encoding or re-ordering." But the spec never defines:
- the order of records in `/list` (registration order? name? name+version?),
- the JSON envelope of the response (bare array? `{records: [...], total: N}`?),
- key order or whitespace within the serialized body,
- whether pagination state affects the hashed body (hash of which page?).
Two conformant implementations will produce different `/list` bytes for identical
record sets, making cross-implementation mirror freshness verification impossible.
This needs the same treatment `/log` got in v0.1.4: a fully pinned response
contract.

**REG-22 🟠 `/list` pagination defaults undefined.**
`/log` pins `limit` default 100 / max 500; `/list` says only "maximum 500 records
per response." Default limit? Behavior for `limit=0`, negative, non-numeric,
over-max (clamp vs 400)? Multiple `tag` parameters (AND? OR? error?)? Combined
`tier`+`tag` semantics (presumably AND, unstated)?

**REG-23 🟠 `/lookup` response shape and ordering undefined.**
"Returns all active Capability Records for the given namespace path" — array or
envelope? Sorted by version ascending, descending, or registration order? With
`?version=` matching nothing: 404 or empty list?

**REG-24 🟡 `/lookup` path normalization edge cases.**
Dots and slashes both accepted; but: mixed separators (`a/b.c`)? Leading/trailing
separators? Percent-encoded characters? Consecutive separators (`a..b`)? Uppercase
input — reject (invalid) or lowercase-normalize?

**REG-25 🟠 `/verify/<name>` is ambiguous for multi-version names.**
A name can have several active versions; `/verify` takes only a name. Which
version is verified? Is `?version=` supported (the `/lookup` text mentions it;
`/verify` doesn't)? What is returned for a revoked record — 404, or verification
of the revoked row? Response field set beyond `signature_valid`/algorithm/key URL
is loose.

**REG-26 🟡 `/health` response schema entirely unspecified.**
Field names for "registry health, total active record count, per-tier breakdown,
signing algorithm, public key URL, and uptime" are not given (the deployed
implementation uses `"status": "ok"`, but that is knowledge of the code, not the
spec). Uptime unit/format? A monitoring tool written against one implementation
will not parse the other's `/health`. Only the mirror fields and `key_rotation`
object are pinned.

**REG-27 🟡 `/log` field formats loose.**
`created_at` format (presumably the stack-wide RFC 3339 UTC rule, but `/log` never
says); `caller` value semantics (what identity is recorded when the only
credential is a shared bearer token?); `detail` structure (string? object? per-action
schema?).

### 1.E Write-Path Semantics

**REG-28 🟠 Success status codes and response envelopes undefined.**
`POST /register`: 200 or 201? Returns the bare signed record or an envelope?
`POST /revoke`: response body? Count of versions revoked? `POST /promote`:
"updated record returned" — bare or wrapped?

**REG-29 🟠 Revoke edge cases.**
- Revoking a non-existent name or already-revoked version: 404? idempotent 200?
- `version` omitted (revoke-all) when zero active versions exist: error or no-op?
- Revoke-all: one log entry or one per version?
- Empty-string `reason`: accepted?

**REG-30 🟡 Promote edge cases.**
Promote to the record's current tier: no-op success, or error? Promote a revoked
record: 404? Invalid tier value: 422 with which error entry? Is `version` required
(§4 says "accepts name, version, and trust_tier" — what if a name has one active
version and version is omitted)?

**REG-31 🟡 Re-registration after revocation: history semantics.**
§8.1 says the slot is freed and a new row inserted. Does the new record's
`registration_date` default to the re-registration date (resetting resolver trust
history), and may the registrant supply the original date to preserve continuity?
Both readings are consistent with §3.1; they produce materially different trust
scores downstream.

### 1.F Concurrency & Races

**REG-32 🟡 Concurrent duplicate registration.**
Two simultaneous `POST /register` for the same name:version — presumably one 201
one 409 via the unique index, but the spec never requires the uniqueness check to
be transactional with the insert. An implementation doing check-then-insert
without a transaction admits a race that creates two active rows.

**REG-33 🟡 Log-entry/commit atomicity.**
Must the registration-log append be atomic with the record write (same
transaction)? If a crash occurs between record insert and log append, is a record
without a log entry conformant? "Append-only audit trail of all registry actions"
implies no, but atomicity is never required.

**REG-34 🟡 Log `id` continuity.**
"Monotonically assigned" — are gaps permitted (e.g., rolled-back transactions
consuming sequence values)? Clients doing gap-detection for tamper-evidence need
to know.

---

## Part 2 — DillClaw Resolver (spec v0.1.7)

### 2.A Query Language & Parsing

**RES-01 🟠 Scheme handling underdetermined.**
The Namespace Standard makes `dillweed://` and `dllwd://` semantically equivalent;
the resolver spec's examples use both (§10 uses `dillweed://`). Must a resolver
accept both? Is a scheme-less bare path (`research.market.intel.vendors`) a valid
query or QUERY_MALFORMED?

**RES-02 🟠 Wildcard grammar edges.**
"A single asterisk matches any single path component" — is `*` permitted only as
a full component, or also as a partial component (`intel.ven*`)? Is a wildcard in
the **final** component combined with a version suffix (`a.b.*:^1.2`) legal?
Two-wildcard limit exceeded → which error code (QUERY_MALFORMED presumably, not
stated)?

**RES-03 🔴 Semver *range* grammar unpinned.**
`version_pref` and the URI version suffix accept "an explicit semver string or
semver range (for example `1.2.0` or `^1.2`)." Which range grammar? node-semver's
full grammar (`~`, `^`, `>=`, `||`, `1.2.x`, `1.2.*`, hyphen ranges, prerelease
inclusion rules)? Python libraries implement different and mutually incompatible
subsets, and node-semver's prerelease-matching rule (`^1.2` does *not* match
`1.3.0-beta` unless opted in) is famously non-obvious. Determinism (§3.3) is
unachievable across implementations without pinning this. Tie-breaking Rule 2
("ascending semver precedence per semver.org §11") is pinned — but candidate
*filtering* by range is not.

**RES-04 🟠 Version pin in URI vs `version_pref` field: precedence undefined.**
A request can carry both `dllwd://x.y:1.2.0` and `"version_pref": "latest"`.
Which wins? Is the combination an error?

**RES-05 🟠 QUERY_TOO_BROAD counting rule undefined.**
">200 candidates": counted as matching *records* (each version separately) or
matching *names*? Counted before or after the trust filter? Before or after
version-constraint filtering? At cache-expansion time or registry-response time?

**RES-06 🟡 Request-field validation details.**
Invalid `trust_minimum` value (`"gold"`): which error code? Non-integer
`max_results` (`1.5`, `"3"`)? Unknown top-level request fields: ignored or
rejected? `context` object: any constraints at all?

**RES-07 🟡 `"stable"` with only prerelease versions available.**
`version_pref: "stable"` when every surviving candidate is a prerelease:
VERSION_CONSTRAINT_FAILED, or fall back to highest prerelease? Spec says stable
"selects the highest … without a pre-release identifier," implying failure, but
never states the failure path.

### 2.B Pipeline & Error Precedence

**RES-08 🔴 Mixed-elimination error selection undefined.**
§8.2 defines TRUST_FILTERED as "all were eliminated by the caller's trust policy,"
PERMISSION_MISMATCH as "candidates exist and meet trust tier, but none carry all
required permissions," SIGNATURE_FILTERED and VERSION_CONSTRAINT_FAILED similarly.
But candidates die at *different* stages: with candidate A eliminated by tier and
candidate B eliminated by permissions, neither error's definition is satisfied.
Options a second implementer must guess between: (a) report the stage that
eliminated the *last surviving* candidate; (b) report the earliest stage at which
the set became empty; (c) priority order over error codes. Each yields different
codes — and different HTTP statuses (404 vs 422).

**RES-09 🟠 Position of version-constraint filtering in the pipeline undefined.**
§6.1's five-step pipeline (tier → permissions → signature → liveness → score)
never mentions version filtering. §3.1 implies version selection happens "from
among candidates surviving the trust filter." Before or after signature
filtering? This determines whether a request with one version-matching-but-
unsigned candidate and one signed-but-wrong-version candidate returns
SIGNATURE_FILTERED or VERSION_CONSTRAINT_FAILED.

**RES-10 🟠 `no_match` status vs `NO_MATCH` error: representation conflict.**
§3.2 defines a three-value `status` field (`resolved` | `no_match` | `error`),
and §4.4 requires no-match responses to carry `status: "no_match"` "with a
documented reason." §8.2 lists NO_MATCH as an HTTP 404 *error code*. Is a no-match
an HTTP 200 with `status:"no_match"`, or an HTTP 404 with `status:"error",
error_code:"NO_MATCH"`? Both readings are textually supported. Same question for
TRUST_FILTERED et al. — are they `status:"error"` or a distinguished status? And
the "documented reason" field name for no_match is never given.

**RES-11 🟡 HTTP status for successful `/resolve` and for batch.**
Presumably 200 for resolved; never stated. `/batch` with all items failing: 200
with in-place errors, or a top-level error status? Batch exceeding 50 items:
which error code (QUERY_MALFORMED? a batch-specific code?) — none defined.

### 2.C Trust Scoring & Determinism

**RES-12 🔴 Floating-point arithmetic is not actually pinned.**
§6.2 pins weights, signal values, the month formula, and round-half-even to three
decimals — but not the *arithmetic*. `0.40·tier + 0.30·history + 0.20·sig +
0.10·liveness` evaluated in IEEE-754 doubles depends on operation order, and
round-half-even on a double is applied to the binary value, not the decimal
literal (the spec's own example, "0.7245 rounds to 0.724," is undefined behavior
in binary floating point: the nearest double to 0.7245 is slightly above or below
the true half, so the "tie" branch is never actually taken and results depend on
representation). Byte-identical scores across languages require either decimal
arithmetic, a specified evaluation order plus a rounding rule defined on the
double, or rational arithmetic. None is specified.

**RES-13 🟠 `months_registered` inputs underdetermined.**
"Integer number of UTC days between the record's registration_date and the
evaluation date" — is "evaluation date" the `resolved_at` instant's date, and is
the day count `floor((eval_date − reg_date) in days)` calendar-date subtraction?
What if `registration_date` is absent (it is optional in the registry schema —
the default applies only "if not supplied" at registration, and a record from a
nonconformant mirror could lack it): history = 0? error? What if it is in the
future (negative days): clamp to 0 or produce a negative score component? The
floor of a negative quotient differs between truncation and floor semantics.

**RES-14 ⚪🟠 Trust-signal string format unpinned (acknowledged, Appendix A.6).**
`"14mo_history"`, `"dnso_verified"`, `"sig_valid"`, `"sig_verified"`,
`"endpoint_unchecked"` — generation rules, casing, zero-padding, and the full
vocabulary are undefined. Worse, the semantics distinguishing `dnso_verified`
from `sig_valid` from `sig_verified` are never given anywhere, yet the steward
workflow (and presumably real consumers) test for specific signal strings.
A second implementation cannot emit a compatible signal set.

**RES-15 🟠 Liveness probe mechanics undefined.**
When `probe_liveness: true`: HTTP method (HEAD? GET?), target URL (the endpoint
verbatim? endpoint + `/health`?), timeout, redirect handling, and which response
classes count as "live" (2xx only? any response? is 500 live or unreachable?) are
all unspecified. Each choice changes the 0.10-weight component and therefore the
score and ranking.

**RES-16 🟠 DNSO public key acquisition policy undefined.**
§6.1 requires verification "against the DNSO public key published at
https://dillweed.com/dnso_public.pem." Fetch at startup? Per resolution? Cache
TTL for the key? And the failure mode: if the key cannot be fetched, are all
signatures treated as *unverifiable* (≈ absent, 0.5, eligible under
`allow_unsigned`) or *invalid* (0.0, rejected)? This decision alone flips entire
result sets. Whether the key URL is operator-configurable (the deployed service
exposes `dnso_key.configured`) is also unstated.

**RES-17 🟡 `cache_hit` semantics for mixed candidate sets.**
A wildcard expansion may be served partly from cache, partly from a fresh registry
fetch. `cache_hit` is per-result in §3.2 — is it true only if that record came
from cache? What does it mean under snapshot-refresh architecture where everything
is "from cache" by construction?

### 2.D Caching Architecture

**RES-18 🟠 Snapshot refresh vs per-record TTL: two coexisting models, interplay undefined.**
§10.1 of the registry spec and §7.5 describe a 60-second full `/list` snapshot
refresh (`DILLCLAW_REGISTRY_REFRESH_MS`); §7.1–7.2 describe per-record caches with
300 s TTL, a negative cache, and cache-miss `/lookup` flows. Are both required?
Is the record cache populated from the snapshot (in which case the 300 s TTL is
mostly vestigial) or from on-demand lookups? The revocation guarantee is defined
against the refresh interval, but the *resolution* path is defined against the
record cache. A second implementation can satisfy either model and behave
visibly differently (e.g., whether a never-before-queried name resolves during a
registry outage).

**RES-19 🟡 Wildcard query caching undefined.**
Cache key is "the fully qualified namespace path" — wildcard patterns are not
fully qualified. Are pattern expansions cached? Under what key and TTL? Does a
new registration matching a cached pattern appear before pattern-cache expiry?

**RES-20 🟡 `stale`/`cached_at` placement undefined.**
§7.3 requires `stale: true` and `cached_at` in "the response" — top-level fields
or per-result fields? Are they present (false/omitted?) on fresh responses?

**RES-21 🟡 Stale-while-revalidate mechanics.**
"While a background refresh completes" — is single-flight deduplication required?
Is serving stale permitted only when the registry is *unreachable*, or also during
normal TTL-expiry refresh? §7.2's stale-window row and §7.3's text support
slightly different readings.

**RES-22 🟡 TTL = 0 and negative-cache interactions.**
TTL 0 is explicitly contemplated (§7.5) — does it also disable the negative
cache? Does a not-found result enter the negative cache even when the positive
TTL is 0?

### 2.E API Surface

**RES-23 🟠 `/health` response schema unspecified.**
"Health status, current registry connection state, cache statistics, and the
resolver's own version string" — no field names. The deployed implementation
reports `registry.source: "remote"` and `dnso_key.configured: true` (nested
objects? dotted keys? — not derivable from the spec). Cross-implementation
monitoring is impossible.

**RES-24 🟡 `/capability/{path}` details.**
Dots only, or slashes accepted as in the registry's `/lookup`? Multi-version
names: which version is "a single record"? Served from cache or fetched live?
404 body shape? Are revoked records ever visible here?

**RES-25 🟡 `/trace/{trace_id}` response schema entirely undefined.**
The endpoint is required (SHOULD-retained 72 h), but no trace document schema is
given. Auditing tools cannot be portable. `trace_id` format (`trc_` prefix +
what alphabet/length?) likewise unpinned.

**RES-26 🟡 `X-DillClaw-Caller` vs `context.caller_id` precedence.**
Both convey caller identity; relationship and precedence in audit logs/traces
undefined.

**RES-27 🟡 `max_results` > eligible candidates.**
Return fewer (presumably) — never stated. Are ranks contiguous from 1?

**RES-28 🟡 `DILLCLAW_DIAGNOSTIC_MODE` interaction with `allow_unsigned`.**
Diagnostic mode "enables unsigned-record inclusion globally" — does it also admit
*invalid*-signature records (§11.1 says invalid candidates "may be scored … for
inspection" in diagnostic mode)? So diagnostic mode admits invalid, but does
`allow_unsigned: true` alone admit invalid too? §3.1 and §6.1 read as "no" (only
missing), but §11.1's wording ("missing or unverifiable") blurs it.

**RES-29 🟡 Per-IP/per-token rate limits: response code undefined.**
§11 SHOULD-requires rate limits on wildcard/batch but defines no 429 behavior or
error code in the §8.2 table.

**RES-30 ⚪ Authenticated caller identity, force-refresh, recursive wildcards, richer permissions, i18n.**
All explicitly deferred in Appendix A — disclosed, but a second implementation
must still decide whether to reject or ignore, e.g., an `Authorization` header it
does not validate.

**RES-31 🟡 Registry error mapping.**
When the registry returns 5xx/409/422 to the resolver's `/lookup`/`/list` calls,
how do these map to resolver error codes? Only "unreachable" (REGISTRY_UNAVAILABLE)
is covered; a registry returning garbage or 500 is not.

---

## Part 3 — Anthill (spec v0.1.3)

Anthill is explicitly a v0.1.x architectural document and discloses many gaps
(Appendix A); they are listed here anyway because the exercise is a clean-room
second implementation, and these gaps make one impossible at the wire level.

**ANT-01 🔴 No HTTP API is defined at all.**
No endpoint paths (the aggregation submission endpoint has no URL), no methods,
no request/response schemas, no error codes, no `/health` contract (the deployed
service answers on port 9476 — the port appears in no spec). A second
implementation cannot accept a signal from a first-implementation node, period.

**ANT-02 🔴 ⚪ `node_signature` canonical serialization undefined (acknowledged, A.11).**
§4 mandates an Ed25519 signature "over the canonical serialization of all
preceding fields" — but no canonicalization is defined (field order? JSON?
key sorting? the Registry's top-level rule? RFC 8785?). The reference
implementation doesn't verify, and accepts absent signatures despite the MUST.
Disclosed as the largest deferred item; still a blocker for interop.

**ANT-03 🟠 Per-class `signal_payload` schemas do not exist.**
§4 requires "class-specific structured data as defined in the per-class schema"
— no per-class schema is defined for any of the six classes anywhere in the
document. Every implementer invents six payload formats.

**ANT-04 🟠 `signal_nonce` encoding unspecified.**
"Cryptographically random 128-bit value" — transmitted as hex? base64? UUID
string? Uniqueness comparison is presumably on the canonical encoding, so the
encoding choice is interoperability-critical.

**ANT-05 🟠 `node_sequence` lifecycle undefined.**
Starting value (0 or 1)? Must it survive node restart (a node that reboots and
restarts from 1 will have all signals rejected)? Is a gap permitted? Is there a
reset procedure, and how does the aggregation layer learn of legitimate resets
(key rotation? re-registration)?

**ANT-06 🟠 First-contact policy undefined.**
A signal arrives from an `originating_node` never seen before: accept (creating
the sequence baseline) or reject pending registration? Combined with ANT-02, the
spec's replay protection is "protocol-level only" by its own admission — but even
the protocol level is incompletely specified.

**ANT-07 🟡 `originating_node` identifier format unpinned.**
"Resolver node identifier" — format, length, allowed characters, uniqueness
authority all undefined. Only the literal `REGISTRY` is pinned.

**ANT-08 🟠 Replay rejection response undefined.**
A rejected replay MUST trigger a CRITICAL ANT-RA signal — but what HTTP
status/error code does the *submitter* receive? And the auto-generated ANT-RA
signal's own metadata is paradoxical: what `originating_node` (the aggregation
layer is not a defined origin class), what nonce/sequence does the aggregation
layer use for signals it generates about others?

**ANT-09 🟡 Sequence-rejection vs nonce-rejection precedence.**
A signal can fail both global nonce uniqueness and per-node monotonicity. Nonce
failure mandates the CRITICAL ANT-RA escalation; sequence failure mandates only
rejection. Which check runs first determines whether the escalation fires.

**ANT-10 🟡 `received_at` storage format and the immutable-log format undefined.**
The log is normatively append-only (§5) but its representation (file? table?),
its serialization, and how immutability is enforced/audited are unspecified.
(Timestamp-integrity limits are separately disclosed ⚪ in §8.)

**ANT-11 🟡 Aggregation window mechanics.**
"Rolling time window" — sliding or tumbling? Evaluation frequency? Window
boundary assignment for a signal whose `signal_timestamp` and `received_at`
disagree (which clock buckets it)?

**ANT-12 🟡 Unknown `signal_class` or `severity` values: rejection behavior undefined.**

**ANT-13 ⚪ Thresholds, correlation rules, parameter publication format.**
Explicitly operational parameters / future work (A.3). Disclosed; fine for a
spec, but a second implementation has zero escalation behavior to implement
compatibly.

**ANT-14 ⚪ Relying-party origin, heartbeats (ANT-HB/ANT-NU), RFC 3161 anchoring,
reporter incentives.** All Appendix A; disclosed.

**ANT-15 🟡 Registry/Resolver emission hooks undefined on both sides.**
Registry A.5 and Resolver A.7 defer the hook interface; Anthill §8 says the
Registry "will include hooks." No conformance level, no delivery model. A second
implementation of any of the three components cannot emit or receive a single
cross-component signal compatibly. (Disclosed in all three documents.)

**ANT-16 🟡 Severity-assignment authority.**
`severity` is submitted by the node, but escalation thresholds belong to the
DNSO. May the aggregation layer re-classify a submitted severity? Is a node-
submitted CRITICAL trusted into the 4-hour acknowledgment obligation (a free
denial-of-attention vector)?

---

## Part 4 — Cross-Cutting Gaps

**XC-01 🔴 Response-body JSON serialization is unpinned stack-wide.**
For true *byte* compatibility (the standard the mirror hash and any
response-hashing audit tooling require), every JSON response needs pinned key
order, whitespace, Unicode escaping, and number formatting. No document addresses
response serialization at all. Recommendation: declare byte-compatibility a goal
only for (a) canonical signing payloads and (b) the `/list` body consumed by the
mirror hash — and fully pin those two; declare all other responses
schema-compatible (semantic) rather than byte-compatible.

**XC-02 🟠 Service port assignments appear in no specification.**
Registry 9475 / Resolver 9474 appear only in a non-normative example (Registry
§10.2); Anthill's 9476 appears nowhere. Deployment-default ports, bind
addresses, and TLS posture for the local reference topology are operational
knowledge, not spec content.

**XC-03 🟠 Spec-version ↔ implementation-version mapping is informal.**
Registry spec v0.1.5 is implemented by Registry v0.2.8 ("matches the behavior of
the v0.2.x reference implementation"); Resolver spec v0.1.7 shows
`resolver_version: "dillclaw/0.1.8"`. No conformance-mapping table states which
implementation versions conform to which spec revisions. A second implementation
has no version string convention to follow (`dillclaw/<semver>` format is shown
in one example only).

**XC-04 🟠 `dillweed://` vs `dllwd://` acceptance matrix.**
The Namespace Standard mandates semantic equivalence; neither the registry
(which stores bare paths) nor the resolver (whose examples mix forms) states
where scheme prefixes are accepted, stripped, or rejected — e.g., is a scheme
prefix legal in `POST /register` `name`? In `/lookup` paths? (The steward's own
tooling resolves `dillweed://`-prefixed capabilities, suggesting both work in
practice — not derivable from the specs.)

**XC-05 🟡 Authentication token comparison and transport.**
`REGISTRY_ADMIN_TOKEN` bearer auth: exact header grammar (`Bearer` case
sensitivity, surrounding whitespace), constant-time comparison requirement, and
behavior when the env var is unset (open writes? writes disabled?) are
unspecified.

**XC-06 🟡 HTTP conventions.**
Trailing slashes (`/health/`), HEAD/OPTIONS support, charset parameters,
compression, and maximum request body size — all unspecified; all observable
differences between implementations.

**XC-07 🟡 The trust-root file's exact bytes are load-bearing but unpinned.**
`dnso_public.pem`'s canonical SHA-256 is embedded in multiple documents and
verified by tooling (this agent's own Step 4). PEM line discipline and trailing
newline (REG-07) determine that hash; a second implementation serving the same
key with different PEM formatting would "fail" trust-root verification while
being cryptographically identical.

---

## Prioritized Remediation List

To enable a byte-compatible second implementation, resolve in this order:

| # | Gap(s) | Action |
|---|--------|--------|
| 1 | REG-01, REG-02, REG-05 | Pin the canonical-JSON serialization precisely (escaping, numbers, UTF-8, nested-object byte rule) or accelerate the RFC 8785 migration already planned in Registry §5.2. |
| 2 | REG-21, XC-01 | Pin the `/list` response contract (envelope, ordering, serialization) — without it the mirror `authoritative_signature_hash` mechanism is unimplementable across implementations. |
| 3 | RES-12 | Specify score arithmetic exactly: evaluation order, decimal vs binary, and a rounding rule that is well-defined on the chosen representation. |
| 4 | RES-08, RES-09, RES-10, REG-17 | Publish an error-precedence table for both Registry and Resolver, and resolve the `no_match`-status vs `NO_MATCH`-error representation conflict. |
| 5 | RES-03 | Pin the semver-range grammar (e.g., "node-semver range syntax, version X, with prerelease-inclusion rule R"). |
| 6 | REG-06 | State explicitly that `/promote` re-signs and re-stamps `last_updated`. |
| 7 | REG-26, RES-23 | Publish `/health` response schemas for both services (the steward sweep itself depends on undocumented fields). |
| 8 | RES-14 | Pin the trust-signal vocabulary and generation rules (already tracked as Resolver Appendix A.6 — promote it). |
| 9 | RES-16, RES-15 | Specify key-fetch lifecycle/failure semantics and liveness-probe mechanics. |
| 10 | ANT-01…ANT-08 | Anthill needs a wire-protocol revision (endpoint, schemas, nonce encoding, sequence lifecycle, canonical serialization) before any second implementation is attempted; most of this is already scoped in Anthill A.2/A.11. |

Items the specs already handle well (no action needed): timestamp formats
(uniform RFC 3339 UTC rule), trust-score weights and month constant, tie-breaking
rules, signed field set enumeration, revocation soft-delete semantics, `/log`
response contract (the v0.1.4 `/log` addition is the model the other endpoints
should follow).

---

*Prepared by the Dillweed Protocol Steward Agent in review-and-recommend mode.
No project artifacts were modified. Capabilities exercised: `review.spec.read`,
`review.repo.read`, `review.report.write` (all boundary-allowed and DillClaw-verified
prior to execution).*
