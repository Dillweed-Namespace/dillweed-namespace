# DillClaw Resolver — First-Time Deployment Gap Report

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Exercise:** Engineer deploying a DillClaw Resolver for the first time, using only:
1. `specs/dillclaw-spec.html` (v0.1.7, May 2026)
2. `README.md` (repo root)
3. `resolver/install.sh` (v0.1.8 installer)

**Question answered:** Is there enough information in these three documents to
deploy, configure, and operate a *conformant* resolver?

## Verdict

**Partially.** An engineer on macOS can get the reference implementation
*running* by following `install.sh` — the happy path is well scripted, the
trust-root fetch is handled, and launchd auto-start works. But the engineer
**cannot configure the resolver beyond its defaults, cannot deploy on Linux,
cannot independently verify conformance, and could not implement a conformant
resolver from scratch**, because critical information lives outside these
three documents or is not written down anywhere. The single largest
operational gap: **no document explains how the resolver is told which
Registry to talk to.**

Gaps are numbered G-1 through G-28, grouped into four categories, each with a
severity (HIGH = blocks or endangers a correct deployment; MEDIUM = requires
guessing, inference, or reading source code; LOW = friction or cosmetic).

---

## A. Configuration and operation gaps

### G-1 (HIGH) — Registry endpoint configuration is never documented
The spec's Registry Client component "communicates with the authoritative
Dillweed Registry" (§2.1), and the README says the Resolver "fetches
capability records from a Registry" — but **no document says how the resolver
is pointed at a registry**. There is no documented env var, config file, or
flag for the registry URL. `install.sh` Step 4 copies a `registry.json` file
that is never mentioned in the spec or README — the deployer cannot tell
whether it is a registry-endpoint config, a local seed snapshot, or a fixture,
nor whether they should edit it. The launchd plist sets only `DILLCLAW_PORT`.
A first-time deployer with a Registry on another host has no documented way to
connect to it.

### G-2 (HIGH) — Cache/TTL configuration surface is undocumented
Spec §7.2 lists four cache types whose TTL source is "Resolver-configured,"
and §7.5 states "Conformant implementations MUST document their cache TTL and
refresh behavior." The only named knob is `DILLCLAW_REGISTRY_REFRESH_MS`
(§7.5), and even for that, neither the README nor the installer shows how to
set it (under launchd it would require manually editing the plist, which the
installer regenerates on every upgrade — silently discarding such edits). How
to configure the 300s record TTL, 60s liveness TTL, 30s negative TTL, or 900s
stale window is stated nowhere. The reference implementation arguably fails
its own §7.5 MUST as documented by these three files.

### G-3 (HIGH) — Trust-root SHA verification is manual and non-enforcing
`install.sh` Step 5 fetches `dnso_public.pem`, validates only that it is
PEM-shaped, then *prints* the fetched SHA next to the expected SHA "for
operator comparison." The install **succeeds even if the SHAs differ** — a
compromised or wrong trust root installs cleanly unless the operator eyeballs
two 64-character hashes. The README says SHA changes must be confirmed "via an
out-of-band channel" but never specifies what that channel is or what the
operator should do on mismatch. The expected SHA is also hardcoded in an
`echo` statement, so a stale installer would print a stale "expected" value
with equal confidence.

### G-4 (MEDIUM) — "Unverified mode" is undefined
The installer's fetch-failure text warns the service "will run in unverified
mode and refuse to validate signed records." No document defines unverified
mode: what `/resolve` returns in it, how it relates to the spec's
`DILLCLAW_DIAGNOSTIC_MODE` (§3.1), whether it is conformant (§6.1 says
invalid signatures MUST be rejected "unless the resolver is operating in an
explicitly declared diagnostic mode" — is unverified mode "explicitly
declared"?), or how the operator detects the resolver is in it.

### G-5 (MEDIUM) — Linux deployment instructions reference a script that may not exist
The installer's non-macOS branch says: "For Linux deployment, run manually:
`npm install && node setup.js && node server.js`" — but `setup.js` is not in
the installer's own Step 4 file-copy list (`server.js`, `start.sh`, `test.sh`,
`install.sh`, `unit-tests.js`, `package.json`, `registry.json`, …), is not in
the resolver source directory, and is documented nowhere. Meanwhile the README
says "Linux support anticipated in a future release." A Linux deployer gets a
dangling pointer, and none of the macOS-specific steps (trust-root fetch,
service supervision, log paths) have documented Linux equivalents.

### G-6 (MEDIUM) — Runtime DNSO key discovery is unspecified
The installer places the key at
`/usr/local/dillweed/resolver/dillclaw-resolver/dnso_public.pem`, but no
document states how `server.js` locates it (hardcoded relative path? env
var?), whether `DNSO_PUBLIC_KEY_URL` is also honored at *runtime* or only at
install time, or what the service does if the file is deleted or replaced
after install.

### G-7 (MEDIUM) — Port change procedure undocumented
`PORT=9474` is hardcoded in `install.sh`; the plist sets `DILLCLAW_PORT`,
implying the server honors that env var — but `DILLCLAW_PORT` is not
documented in the spec or README. Changing the port means reverse-engineering
the installer; re-running `install.sh` (e.g., for upgrade) regenerates the
plist and reverts the change.

### G-8 (MEDIUM) — Production security recommendations cannot be implemented
Spec §5 says authentication is "OPTIONAL but RECOMMENDED for production," and
§11 says production deployments "SHOULD enforce per-IP or per-token rate
limits" — but no auth mechanism is defined (Appendix A.1 explicitly defers
bearer-token format to a future revision) and no rate-limiting capability or
configuration is documented for the reference implementation. The deployer is
told to do things the documents give no way to do. Likewise §11.2 expects
"TLS for the resolution request," but the installer deploys plain HTTP with no
TLS-termination guidance.

### G-9 (MEDIUM) — `.env.example` is copied but never explained
Step 4 copies `.env.example` "if present." Its contents — presumably the
actual configuration surface that would answer G-1, G-2, and G-7 — are
documented nowhere in the three permitted sources.

### G-10 (LOW) — Tarball SHAs are published but never used in the procedure
The README's v1 release table lists SHA256 values for each tarball, but the
install instructions (`cd ~/Tarballs && tar -xzf …`) never instruct the
operator to verify the tarball hash before extracting. The values exist;
the procedure doesn't reference them.

### G-11 (LOW) — Resolver installer lacks the INST-001 protection the README describes
The README documents (for the Registry) a clean abort when `install.sh` is run
from inside the install destination. The resolver's `install.sh` has no such
check: run from `$INSTALL_DIR`, the `cp` of a file onto itself fails and
`set -e` aborts mid-install with no recovery guidance — exactly the failure
mode INST-001 was meant to prevent.

### G-12 (LOW) — `sudo` requirement unannounced; uninstall semantics partial
Step 2 invokes `sudo mkdir` on first install (a password prompt the README
never mentions, awkward for unattended provisioning). `--uninstall` removes
only the plist and intentionally leaves `$INSTALL_DIR` — documented in script
output, but not in the README.

### G-13 (LOW) — Trace retention has no documented mechanism
Spec §5.1 says traces SHOULD be retained ≥72 hours. The installer creates a
`traces/` directory, but no document covers trace file format, rotation,
pruning, or disk-growth expectations — the operator cannot tell whether the
72-hour SHOULD is met or whether the directory grows unboundedly.

---

## B. Internal ambiguities and inconsistencies in the spec

### G-14 (HIGH) — URI scheme is inconsistent: `dllwd://` vs `dillweed://`
Spec §3.1, §4, and §9 use `dllwd://` throughout; the §10 worked example uses
`dillweed://data.enrichment.company.*`; the footer navigation text says
"how a `dillweed://` namespace URI is resolved." Nothing states whether both
schemes are valid, whether one is an alias, or which a conformant Query Parser
MUST accept. For an implementer this is a direct conformance ambiguity in the
most fundamental input format; for an operator it makes smoke-test queries a
guessing game.

### G-15 (MEDIUM) — Spec version 0.1.7 documents implementation 0.1.8
The spec self-identifies as v0.1.7 (cover, sidebar, footer) while its own
example response reports `resolver_version: "dillclaw/0.1.8"` and the
README/installer ship Resolver 0.1.8. The revision log explains the example
was deliberately updated, but the net effect is that no published spec version
matches the shipped software version, and the document never states the
mapping rule between spec versions and implementation versions. A deployer
cannot cite which spec revision their v0.1.8 binary is supposed to conform to.

### G-16 (MEDIUM) — Two coexisting cache models with unclear interplay
§7.1/§7.2 describe per-record TTL caching (300s default, per-path keys);
§7.5 reveals the reference implementation actually refreshes a full registry
*snapshot* every 60 seconds, and that revocation propagates within the 60s
interval, "not the longer record-level cache TTL." The relationship is never
reconciled: what does the 300s record TTL govern if the snapshot is replaced
every 60s? Does a record-cache hit survive a snapshot refresh that removed the
record? Which model do the §7.2 negative-cache and stale-while-revalidate
windows attach to? An operator tuning per §7.5's guidance table ("Recommended
TTL 10–30s" etc.) cannot tell which knob the table refers to.

### G-17 (MEDIUM) — Score guidance table contradicts the formula
§6.4 marks 0.90–1.00 as "Reserved for future high-assurance scoring
profiles," but the §6.2 default formula can produce scores in that range
today: canonical tier (1.0), ≥24 months history (1.0), valid signature (1.0),
live probed endpoint (1.0) → 0.40+0.30+0.20+0.10 = **1.000** under
`dillclaw-default-v1`. The range is reachable, not reserved.

### G-18 (MEDIUM) — Health endpoint is REQUIRED but its response is unspecified
§5.1 mandates `/health` for all conformant implementations and describes its
content in prose ("health status, current registry connection state, cache
statistics, version string") but defines no field names, no schema, and no
example. The installer's own verification greps the body for the substring
`"ok"` — a check against a format the spec never defines. Two conformant
resolvers could emit mutually unparseable health responses; monitoring
integration is guesswork.

### G-19 (MEDIUM) — `stale` / `cached_at` fields are mandated but not placed
§7.3 requires stale responses to "include a `stale: true` flag and `cached_at`
timestamp," but the §3.2 response schema contains neither field, and the spec
never says whether they appear at the response top level or per result.

### G-20 (MEDIUM) — Determinism guarantee conflicts with liveness probing
§3.3 requires that "given the same query and registry state, a conformant
resolver MUST return the same ranked result," yet the liveness signal
(±0.10 × {1.0, 0.5, 0.0}) depends on network reachability at probe time and
on a 60s probe cache. Two identical queries against identical registry state
can legitimately rank differently when `probe_liveness: true`. The spec never
scopes the determinism guarantee to exclude probe results.

### G-21 (LOW) — `months_registered` evaluation date is loosely bound
§6.2 pins the formula to "the evaluation date" without defining it (time of
request? time the record was cached and scored? `resolved_at`?). Across a
month boundary, a cached record could plausibly be scored either way.

### G-22 (LOW) — Trust signal strings are unpinned (acknowledged)
Signals such as `"14mo_history"` have no pinned format; the spec itself flags
this in Appendix A.6. Listed here for completeness because §3.3 requires
signals to be returned and consumers will inevitably parse them.

### G-23 (LOW) — Minor endpoint semantics left open
`GET /capability/{path}`: no statement on URL-encoding of paths, whether
version pins (`:1.2.0`) are accepted, or whether the response is served from
cache or always fresh. `POST /batch`: no statement on how the 50-item limit
interacts with per-item wildcard expansion limits or rate limits, nor on the
HTTP status of an all-failed batch.

---

## C. Required information that lives outside the three permitted documents

These are explicit dependencies — the spec defers correctly and openly, but
a deployer restricted to the three documents hits a wall.

### G-24 (HIGH) — Capability Record schema and signature verification procedure
The Capability Record schema, namespace URI syntax, and trust tier definitions
are deferred to the Dillweed Namespace Standard v0.4; the signature
verification procedure (canonicalization, field ordering, byte construction)
is deferred to Registry Specification §5.4. §6.1's signature verification —
the heart of the trust model — **cannot be implemented or independently
verified from these three documents**. The §6.2 security note helpfully lists
the ten signed fields, but not how they are serialized for signing.

### G-25 (MEDIUM) — Trust tier ordering is implied, never stated
The tier gate (§6.1) requires rejecting candidates "below" the caller's
`trust_minimum`, but the ordering experimental < trusted < verified <
canonical is only inferable from the §6.2 score-value table; the normative
ordering lives in the Namespace Standard.

### G-26 (MEDIUM) — README verification depends on undocumented seed data
The end-to-end check (`curl http://localhost:9475/verify/research.market.intel.vendors`)
assumes a record at that path already exists in the Registry. None of the
three documents says where that record comes from, so a deployer whose check
returns not-found cannot tell whether their install is broken or their
registry is simply unseeded. (It also exercises a *Registry* endpoint — the
README offers no equivalent resolver-side `/resolve` smoke test.)

### G-27 (LOW) — Issues #2 and #4 are gating but external
The README instructs evaluators to review GitHub Issue #2 "before any public
Resolver deployment" — making an external, unsummarized issue a deployment
gate. Its content is unavailable within the permitted document set.

### G-28 (LOW) — Reference test suite is named but not located
Spec §12 milestone 01 requires "passing against a reference test suite." The
README points to `test.sh` (65 tests) and `unit-tests.js` (29 tests) with
expected counts, but the spec never identifies these as *the* reference suite,
and no document maps test cases to spec sections, so "conformant" remains
informally defined.

---

## Summary table

| # | Severity | Gap |
|---|---|---|
| G-1 | HIGH | Registry endpoint configuration undocumented; `registry.json` unexplained |
| G-2 | HIGH | Cache/TTL configuration surface undocumented (violates spec's own §7.5 MUST) |
| G-3 | HIGH | Trust-root SHA check is manual, non-enforcing; out-of-band channel unspecified |
| G-14 | HIGH | URI scheme inconsistency: `dllwd://` vs `dillweed://` |
| G-24 | HIGH | Record schema + signature verification procedure live in other documents |
| G-4–G-9, G-15–G-20, G-25, G-26 | MEDIUM | 14 items: unverified mode, Linux `setup.js`, key discovery, port change, unimplementable auth/rate-limit SHOULDs, `.env.example`, spec/impl version split, dual cache models, reserved-range contradiction, health schema, stale-field placement, determinism vs probing, tier ordering, seed-data dependency |
| G-10–G-13, G-21–G-23, G-27, G-28 | LOW | 9 items: tarball SHA unused in procedure, missing INST-001 guard, sudo/uninstall notes, trace retention, evaluation date, signal format, endpoint minutiae, external issue gate, unnamed reference suite |

## Recommended highest-leverage fixes

1. Add a **Configuration Reference** section (README or spec §5) enumerating
   every env var and config file the reference implementation honors —
   registry URL, `DILLCLAW_PORT`, `DILLCLAW_REGISTRY_REFRESH_MS`, cache TTLs,
   `DNSO_PUBLIC_KEY_URL`, `DILLCLAW_DIAGNOSTIC_MODE` — and explain
   `registry.json` and `.env.example`. This alone resolves G-1, G-2, G-6,
   G-7, G-9.
2. Make `install.sh` **fail (or require explicit override) on trust-root SHA
   mismatch** instead of printing two hashes for visual comparison (G-3).
3. Pick one URI scheme, state it normatively in §4, and note the other as an
   alias or an error (G-14).
4. Define the `/health` response schema with an example body (G-18) — it is
   the one REQUIRED endpoint with no contract.
5. Fix or remove the Linux instructions referencing `setup.js` (G-5).
