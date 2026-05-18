# Dillweed Anthill™ Observability Plane

Reference implementation of the [Dillweed Anthill™ Observability Plane Specification v0.1](https://dillweed.com/anthill-spec.html).

Anthill is the governance telemetry layer of the Dillweed Namespace stack — an aggregation endpoint that receives, validates, and stores coordination-layer signals from DillClaw resolver nodes and Registry operations. It provides the DNSO with continuous visibility into namespace ecosystem health.

---

## ⚠ Important: Trust Roots and Local Keys

When you install this service, the installer generates a fresh Ed25519 signing keypair stored locally in `keys/`. **This is your local-only signing key. It is not the canonical DNSO key.**

What this means:

- Capability Records signed by your local installation are valid only against your local trust root. They are **not** part of the canonical Dillweed Namespace, which, when publicly deployed, will be operated under DNSO authority at [dillweed.com](https://dillweed.com).
- Your local key is for experimentation, conformance testing, and implementation work. It carries no authority outside your own deployment.
- Operating a public-facing instance of this service with your locally-generated key would **not** constitute "running the Dillweed Namespace." It would be a separate namespace that uses Dillweed's protocols and code.
- The canonical Dillweed Namespace is defined by what the DNSO signs with the keypair whose public key is published at `https://dillweed.com/dnso_public.pem`. Anything else is a fork or a local instance.

The Dillweed® mark is registered in the United States; DillClaw™ and Dillweed Anthill™ are common-law trademarks. The marks are protected. Publishing capability records, services, or registries under the "Dillweed Namespace" name without DNSO authorization is not permitted. See the [implementation guide §08](https://dillweed.com/implementing-dillweed.html#key-handling) and the [DNSO Operations Charter](https://dillweed.com/dnso-operations-charter.html) for the full trust-root and stewardship model.

---

## What's new in v0.1.4

- **License changed to Apache 2.0** — the per-service `LICENSE` file is now the Apache License 2.0, matching the project-wide licensing decision. A `NOTICE` file has been added carrying attribution and the trademark policy (Apache 2.0 §4d). The `package.json` `license` field is now `Apache-2.0`. This supersedes the MIT license that shipped with earlier reference-implementation tarballs; the change was made before any public distribution.
- **Internal version-stamp corrections** — the `version` field returned by the `/health` endpoint was stale at `0.1.0` across several prior releases; it now tracks the package version. The `setup.js` and `test.sh` header comments were likewise corrected. The earlier reconciliation rounds bumped `package.json` but did not reach these internal strings; that gap is now closed.

## What's new in v0.1.3

- **Installer hardening: secured launchd plist permissions** — the installer now calls `chmod 600` on the plist file immediately after writing it. The plist contains `ANTHILL_ADMIN_TOKEN` in its environment block, so restricting read access to the owner is appropriate hygiene.

- **Launchd-token model disclosed in Security section** — the README's Security section now explicitly describes the admin-token storage path (Keychain plus launchd environment), notes the plist's mode-600 protection, and clarifies that this model is appropriate for local reference use only. Public or production deployments should use platform-native secret management. This is disclosure, not behavior change.

## What's new in v0.1.2

- **Trust-root callout in README** — added an `⚠ Important: Trust Roots and Local Keys` section at the top of this README, making explicit that locally-installed instances are not part of the canonical Dillweed Namespace observability plane.

- **Local-instance advisory at startup** — the service now prints an advisory at startup recognizing that signals aggregated locally are visible only within this local deployment, and noting that the canonical Dillweed Namespace observability plane, when publicly deployed, will be operated under DNSO authority. The advisory is informational; the service continues to operate normally.

- **Internal version-stamp corrections** — the hardcoded version strings in `server.js` (header comment, startup banner) now match the `package.json` version (v0.1.2). The earlier port-renumbering bumped `package.json` but did not propagate to these internal strings; that gap is closed.

## What's new in v0.1.1

- **Port renumbering** — the service's default port has changed from `7476` to `9476`. The `7474`-`7476` range conflicted with Neo4j's well-known ports; the `9474`-`9476` range avoids that conflict. If you set the port explicitly via the `ANTHILL_PORT` environment variable in your deployment, no action is needed. If you relied on the default port, you must update your client configuration to use the new port.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Initialize database
node setup.js

# 3. (Optional) Store admin token in macOS Keychain
security add-generic-password -a anthill-admin -s dillweed-anthill -w $(openssl rand -hex 32)

# 4. Start the server
bash start.sh

# 5. Run tests (in a second terminal)
bash test.sh
# or with token:
ANTHILL_ADMIN_TOKEN=$(security find-generic-password -a anthill-admin -s dillweed-anthill -w) bash test.sh
```

## Endpoints

| Method | Path         | Auth                              | Description                                      |
|--------|--------------|-----------------------------------|--------------------------------------------------|
| GET    | /health      | open                              | Service health and signal count                  |
| POST   | /signal      | required when token configured    | Submit a signal to the aggregation layer         |
| GET    | /signals     | required when token configured    | List signals with optional filtering             |
| GET    | /aggregate   | open                              | Current aggregation window snapshots (counts only) |
| GET    | /summary     | required when token configured    | Ecosystem health summary                         |

When `ANTHILL_ADMIN_TOKEN` is unset, the service runs in **open local mode** and all endpoints are reachable without authentication — appropriate for the reference implementation running on `127.0.0.1` for conformance testing. When the token is set, signal submission and any endpoint that exposes signal payloads or node/capability identifiers requires `Authorization: Bearer <token>`. `/aggregate` returns counts and severity rollups only (no identifiers), so it remains open to support the stewardship-visibility framing of Spec §5.

## Signal Classes

Six primary signal classes defined in Spec §4:

| Class  | Name                        | Window   |
|--------|-----------------------------|----------|
| ANT-TC | Trust Tier Drift            | 24 hours |
| ANT-RC | Revocation Cascade          | 1 hour   |
| ANT-DN | Deceptive Namespace Path    | 60 sec   |
| ANT-RA | Resolver Abuse              | 60 sec   |
| ANT-WF | Wildcard Fanout Anomalies   | 24 hours |
| ANT-EC | Ecosystem Concentration Risk| 24 hours |

## Submitting a Signal

```bash
curl -X POST http://localhost:9476/signal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "signal_class":     "ANT-TC",
    "signal_timestamp": "2026-05-04T10:00:00Z",
    "signal_nonce":     "<128-bit random hex>",
    "node_sequence":    1,
    "originating_node": "dillclaw-node-001",
    "capability_ref":   "research.market.intel.vendors",
    "severity":         "INFORMATIONAL",
    "signal_payload":   { "detail": "Trust tier drift observed", "drift_delta": 0.12 }
  }'
```

Required fields: `signal_class`, `signal_timestamp`, `signal_nonce`, `node_sequence`, `originating_node`, `severity`, `signal_payload`.

Timestamp format: RFC 3339 UTC, second precision — `YYYY-MM-DDTHH:MM:SSZ`. No fractional seconds, no non-UTC offsets.

## Replay Protection (Spec §4)

- **Nonce uniqueness** — every `signal_nonce` must be unique across the aggregation layer's lifetime. Reused nonces return `409 NONCE_COLLISION` and trigger a CRITICAL ANT-RA signal naming the offending node. Spec §4 describes `signal_nonce` as a cryptographically random 128-bit value; **v0.1.4 enforces presence and uniqueness but not a specific 128-bit encoding**. Submitters are responsible for supplying cryptographically random nonces. A future strictness profile may require UUID or 32-byte hex format; the current reference implementation accepts any non-empty string so test fixtures and implementation work can use readable nonces.
- **Node sequence** — `node_sequence` must strictly increase per `originating_node`. Out-of-order sequences return `409 SEQUENCE_VIOLATION`.

## Immutable Signal Log

### Storage model

Anthill maintains two complementary stores for each signal that passes validation and replay protection:

| Store | File | Semantics |
|---|---|---|
| Accepted-signal store | `data/anthill.db` (SQLite) | Signals the API returned `201 accepted` for. Queried by `/signals`, `/aggregate`, `/summary`. |
| Ingestion-attempt log | `logs/signals.log` (JSONL) | Every signal that reached the storage layer, whether or not the SQLite insert subsequently succeeded. Append-only, application-level. |

Under the log-first-then-DB write ordering, the JSONL log may contain entries whose SQLite insert later failed and returned `500 STORAGE_FAULT` to the caller. The caller is informed; the JSONL preserves the attempt for forensic reconciliation. To find entries that were attempted but not accepted, diff JSONL against SQLite by `signal_id`.

The reference implementation maintains **application-level append-only** semantics — the server only ever opens the JSONL file with `appendFileSync` and never updates or deletes prior entries. Stronger filesystem immutability (chattr +a, WORM storage), remote attestation, or hash-chained tamper-evidence are deployment hardening options outside this v0.1.4 local reference implementation.

For accepted signals, the `received_at` value is identical between the SQLite row and the JSONL entry, allowing direct equality matching across stores during reconciliation.

## Aggregation Windows (Spec §5)

- **Immediate (60s)**: ANT-DN, ANT-RA — active abuse signals requiring rapid response
- **Short (1h)**: ANT-RC — revocation propagation completeness assessment
- **Extended (24h)**: ANT-TC, ANT-WF, ANT-EC — gradual ecosystem trend signals

### Dual time-base aggregation

`/aggregate` returns **two parallel window views** for each signal class:

- **`event_time`** — window membership by caller-supplied `signal_timestamp`. Reflects when the submitting node says the event happened. Spec §8 acknowledges that submitting nodes may supply backdated, forward-dated, or imprecise timestamps without detection; this view is therefore vulnerable to clock drift or deliberate manipulation in the resolver fleet.
- **`received_time`** — window membership by server-controlled `received_at`. Reflects when Anthill ingested the signal. Robust against node clock manipulation; the right view for live stewardship and ingestion-rate analysis.

The two views answer different questions and are returned side-by-side so stewards can see both. Comparing them is itself diagnostic: large divergence between `event_time` and `received_time` rollups for the same window suggests clock drift or timestamp manipulation in the contributing nodes.

Response shape per class:

```json
"ANT-DN": {
  "window_label":   "immediate (60s)",
  "window_seconds": 60,
  "since":          "2026-05-16T17:54:00Z",
  "event_time":    { "total": 5, "by_severity": {...}, "max_severity": "WARNING" },
  "received_time": { "total": 6, "by_severity": {...}, "max_severity": "CRITICAL" }
}
```

## Configuration

Copy `.env.example` to `.env` and edit as needed. Environment variables:

| Variable              | Default | Description                        |
|-----------------------|---------|------------------------------------|
| `ANTHILL_PORT`        | 9476    | HTTP port                          |
| `ANTHILL_ADMIN_TOKEN` | (none)  | Bearer token for signal submission |

## Security

- Bound to `127.0.0.1` — local deployment only
- Admin token loaded from macOS Keychain via `start.sh`
- Signal submission requires `Authorization: Bearer <token>` when token is configured
- No token in any config file or shell profile

**Admin token in launchd environment.** The installer generates a 256-bit admin token via `openssl rand -hex 32`, stores it in the macOS Keychain (service: `dillweed-anthill`, account: `anthill-admin`), and also injects it into the launchd plist's environment block so the service can read it at auto-start. The plist file is written with mode `0600` by the installer to limit read access to the owner. This token model is acceptable for local reference use; public or production deployments should replace it with platform-native secret management and should not rely on launchd environment injection for credential delivery. See [implementation guide §10](https://dillweed.com/implementing-dillweed.html#operations) for the full operational security model.

## Directory Structure

```
dillweed-anthill/
├── server.js        — aggregation endpoint
├── setup.js         — database initialization
├── start.sh         — production launcher (Keychain token)
├── test.sh          — curl-based test suite
├── package.json
├── .env.example     — configuration template
├── LICENSE          — Apache License 2.0
├── NOTICE           — attribution and trademark notice
├── README.md
├── data/
│   └── anthill.db   — SQLite signal store (created by setup.js)
└── logs/
    └── signals.log  — append-only signal log (application-level immutability)
```

## Stack Position

```
Namespace Standard → DillClaw Resolver → Registry → Governance → Anthill Observability ← you are here
```

## License

Licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for the full text.

The Apache 2.0 license does not grant trademark rights. "Dillweed" is a registered trademark; "DillClaw" and "Dillweed Anthill" are common-law trademarks. See the [NOTICE](NOTICE) file for the trademark policy.

---

Spec: https://dillweed.com/anthill-spec.html  
Stack: https://dillweed.com/namespace-standard.html
