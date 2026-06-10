# DillClaw Resolver — Production Architecture Review

**Date:** 2026-06-10
**Reviewer role:** System architect (production readiness)
**Scope:** `resolver/server.js` (v0.1.8 reference impl) + `specs/dillclaw-spec.html` (v0.1.7)
**Target deployment:** Multi-resolver, multi-organization, ~100 resolver nodes
**Mode:** review-and-recommend (read-only)

## Summary

DillClaw is the strongest of the three reference implementations at the
request-handling layer: real Ed25519 verification, a disciplined
stale-while-revalidate state machine, default-deny signature eligibility,
banker's-rounded deterministic scoring, atomic snapshot semantics to close a
known race (RS-004), and careful query/version validation. As a single hosted
resolver it is close to production-quality.

The problem is the **fan-out architecture**. The design assumes *one resolver
talking to one registry*, and several decisions that are invisible at N=1
become load-bearing failures at N=100. The three that matter most: **(1)** every
resolver independently polls the **entire** registry every 60 seconds with no
delta/conditional-fetch, making the Registry a bottleneck and a synchronized
thundering-herd target; **(2)** there is **no caller authentication and no rate
limiting in code** despite the spec calling for it, so any caller can drive
unbounded wildcard/batch load and — via `probe_liveness` — turn each resolver
into an **unauthenticated SSRF/amplification proxy**; and **(3)** the spec's
**determinism guarantee does not hold across resolvers**, because trust scores
depend on wall-clock time and per-process liveness cache state, not just
registry state.

Findings are split into **structural** (must change before a 100-resolver
multi-org deployment) and **v1-acceptable** (fine for a reference/hosted single
node, disclosed, or deferrable).

---

## Structural Findings (must change for 100-resolver multi-org)

### S1 — Every resolver polls the full registry every 60s; no delta, no conditional GET. Registry is the bottleneck + thundering herd. (P0)
`registry.refreshList()` does `GET <base>/list` on a 60s `setInterval`, pulling
the **entire** record set each time (`fetchJson` caps at 8 MB), then rebuilds
the in-memory snapshot via `_absorb`. At 100 resolvers this is 100 full-catalog
downloads per minute against a single Registry, growing with catalog size.
Three structural consequences:
- **No incremental sync.** No `If-Modified-Since`/`ETag`, no since-cursor, no
  delta feed. Bandwidth and Registry CPU scale with `records × resolvers`.
- **Synchronized herd.** If the Registry restarts or briefly fails, all 100
  resolvers enter the stale window together and retry on the same cadence,
  re-converging into a synchronized burst when it returns (no jitter, no
  backoff — the interval fires unconditionally).
- **Registry is a hard SPOF for freshness.** Revocation propagation (§7.5) is
  bounded by this single endpoint's availability across the whole fleet.

### S2 — No caller authentication and no rate limiting in the implementation. (P0)
The server binds `0.0.0.0`, sets `Access-Control-Allow-Origin: *`, and applies
**no auth and no rate limit** to `/resolve`, `/batch`, `/capability`, or
`/trace`. The spec says production deployments *SHOULD* enforce per-IP/per-token
limits on wildcard and batch queries (§11.1) and treats auth as future work
(Appendix A.1) — but as code, the resolver is wide open. At multi-org scale this
means: unbounded enumeration of the namespace (wildcards up to 200 matches,
plus raw record disclosure via `/capability` with **no trust filtering**),
unbounded `/batch` (50 queries × unbounded callers), and trivial DoS against the
single-process event loop. There is no tenancy, no per-org policy, no quota.

### S3 — `probe_liveness` is an unauthenticated SSRF / amplification vector. (P0)
When `probe_liveness: true`, `resolveQuery` calls `probeEndpoint()` for **every
candidate** (up to 200), issuing HEAD requests to `record.endpoint`. Combined
with S2 (no auth), any caller can make the resolver emit outbound requests to
arbitrary registered endpoints — and a wildcard query amplifies one inbound
request into up to 200 outbound probes. In a multi-org deployment this turns the
shared resolver into a request-amplifying SSRF proxy against capability hosts.
Probes need an allowlist/quota and the feature needs to sit behind auth.

### S4 — Cross-resolver determinism is not achievable as specified. (P1)
Spec §3.3 asserts a hard determinism guarantee, and §6.4 tells consumers scores
are comparable within a profile. But `trustScore` mixes two non-registry inputs:
- **`usageScore`** uses `Date.now()` → `months_registered` increases with wall
  time. Two resolvers evaluating the same record at different instants (or with
  clock skew) produce different scores. "Same registry state" does not pin time.
- **`livenessScore`** reads each resolver's **own** liveness cache (0.5 if
  unprobed, 1.0/0.0 if probed). Whether a probe has run, and its cached result,
  is per-process runtime state — so the same record scores differently on
  resolver A (probed, live) vs. resolver B (never probed).

Net: a caller comparing `trust_score` across 100 resolvers will see legitimate
divergence the spec implies shouldn't exist. Either the guarantee must be scoped
to "single resolver, single instant" explicitly, or the time/liveness
components must be removed from the deterministic core.

### S5 — Per-resolution trace = one synchronous file write; unbounded, event-loop-blocking, retention unenforced. (P1)
`saveTrace` does `fs.writeFileSync` of a JSON file per resolution (and per batch
item) into `traces/`. At fleet-scale request rates this:
- **blocks the single event loop** on every request (sync disk I/O on the hot
  path);
- **grows without bound** — no rotation, no cap, no cleanup. The spec's 72-hour
  retention (§5) is a *SHOULD* and is **not implemented**;
- **swallows failures** (`catch (_) {}`), so a full disk silently breaks the
  §3.3 auditability MUST guarantee while requests still return 200.
Traces need an async, bounded, rotated sink (or a real log/store), not one file
per call.

### S6 — Single-process, single-threaded, with synchronous I/O on the request path. (P1)
One Node process, no clustering/worker model. Beyond S5's trace writes:
`registry.snapshot()` in **local mode re-reads and re-parses `registry.json`
from disk on every resolution** (`loadLocal()` inside `snapshot()`), and the
remote-mode candidate match is a full **linear `Array.filter` scan** over all
records per query (the `byName` index exists but `resolveQuery` doesn't use it).
None of this matters at low volume; all of it caps throughput per node and makes
each instance's capacity a function of catalog size. Horizontal scale is
possible (stateless nodes) but is undocumented and unaided by any shared cache —
so 100 cold caches independently hammer the Registry (compounds S1).

### S7 — Cache-miss `/lookup-on-miss` adds a blocking Registry round-trip to the hot path with no concurrency control. (P2)
On an exact-name miss in remote mode, `resolveQuery` awaits
`registry.fetchOneRemote()` (a synchronous-in-flow network call, 5s timeout)
before returning. The 30s negative cache deduplicates repeated misses for the
*same* name, but a burst of misses across *distinct* names (e.g. an agent
iterating a list, or an enumeration attempt) produces a burst of serial Registry
lookups with no in-flight coalescing or concurrency cap — a second herd path
into the Registry distinct from S1, and one that inflates P99 on the miss path.

### S8 — DNSO key is a local file with no rotation path; mis/un-configuration silently degrades trust fleet-wide. (P2)
`dnsoKey.init()` loads `dnso_public.pem` from a local path **once at startup**.
There is no fetch-from-`dillweed.com`, no rotation signal, no reload. Rotating
the trust root across 100 nodes means manually distributing a file and
restarting every node — with a window where nodes disagree on key validity.
Worse, if the key is absent/misconfigured on a node, `verify()` returns
`unverifiable` and — unless `allow_unsigned`/diagnostic is set — that node
returns `SIGNATURE_FILTERED` for everything (fail-closed, good) **or**, if any
caller sets `allow_unsigned: true`, serves unverified records scored neutrally.
Fleet-wide key state is unmanaged operational surface.

---

## v1-Acceptable Limitations (fine for reference / hosted single node)

| # | Item | Why acceptable now | When it becomes structural |
|---|------|--------------------|----------------------------|
| A1 | No caller-identity model (Authorization optional) | Documented future work (A.1, §11.2) | Pairs with S2 — needed before multi-org exposure |
| A2 | Structural-only signature fallback when no key | Loud startup warning; default-deny at resolve | If a node runs keyless in prod |
| A3 | `registration_date` unsigned → usage history spoofable | Disclosed in §6.2 security note | When usage-history weight is trusted cross-org |
| A4 | Semver range subset (`^`/`~`/exact only; no compound, no 0.x special-case) | Documented limitation in code + spec | If callers depend on compound ranges |
| A5 | Force-refresh not implemented | Spec marks it future work (§7.5) | When high-assurance callers need bypass |
| A6 | Local file registry mode (re-read per call) | Dev/loopback mode only | Already covered by S6 for remote/prod |
| A7 | `/capability` returns raw record with no trust filter | Spec-intended (verification/tooling) | Combined with S2, it's an enumeration aid |
| A8 | Wildcard cap of 200 / batch cap of 50 | Sensible static guards | Insufficient as the *only* abuse control (see S2) |

The request-layer engineering is genuinely strong and should be preserved:
default-deny signature eligibility (RS-001/002), atomic `snapshot()` (RS-004),
strict version/number parsing (RS3-001), banker's rounding, path-traversal guard
on `/trace`, bounded request bodies (512 KB), and trace persistence on **every**
response path including early validation errors (RS-007).

---

## Priority Ordering

1. **S1** — Replace full-catalog polling with incremental/conditional sync
   (ETag/since-cursor or push), add jitter + backoff. This is the dominant
   scaling and SPOF problem.
2. **S2 / S3** — Authentication, rate limiting/quota, and a probe allowlist
   before any multi-org network exposure. These are open-door issues today.
3. **S4** — Resolve the determinism contradiction: scope the §3.3 guarantee to a
   single instant/instance, or remove time/liveness from the deterministic core.
4. **S5 / S6** — Async bounded trace sink with enforced retention; document and
   support horizontal scale-out (stateless nodes + optional shared cache).
5. **S7** — In-flight request coalescing and a concurrency cap on
   lookup-on-miss.
6. **S8** — A managed key-distribution/rotation path (fetch + verify + reload)
   rather than a static local file.

## Bottom Line

At N=1, DillClaw is a well-built resolver and most of this list is invisible.
The risk is entirely in the **fleet topology**: full-catalog polling (S1),
no auth/rate-limit/probe-control (S2/S3), and a determinism guarantee that
silently breaks across instances (S4) are the decisions that will not survive
the move to 100 resolvers across organizations. They should gate any
multi-org production commitment. S5–S8 are serious but follow-on; the
per-request engineering quality is high and worth carrying forward unchanged.
