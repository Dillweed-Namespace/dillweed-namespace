# Dillweed Registry — v0.2.8

Authoritative Capability Record store for the [Dillweed Namespace](https://dillweed.com/registry-spec.html).

The Dillweed Registry stores, signs, and serves Capability Records. It is the data layer that makes the DillClaw Resolver authoritative — replacing the static `registry.json` file with a live, queryable, governed service with cryptographic signatures.

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

## What's new in v0.2.7

- **Round-5 polish — pagination regex pre-check and tier enum enforcement** — two items raised in external review round 5. (a) `/list` and `/log` pagination now apply a `^\d+$` regex pre-check before parseInt, rejecting malformed numeric-prefix values like `10abc` (previously parsed as 10), fractional values like `1.5` (previously parsed as 1), and alternative radixes like `0x10` (previously parsed as 0). The round-4 fix attempted this but used parseInt-only, which the round-5 reviewer correctly identified as still permissive despite the comments saying "strict." Implementation now matches its documentation. (b) `/list?tier=` now rejects invalid enum values (e.g. `?tier=banana`) with `400 BAD_REQUEST` rather than silently falling through to "all records," which was surprising behavior because a filter parameter is expected to filter. Both fixes apply via a new `parsePagination()` shared helper (14/14 unit tests pass).

- **Round-4 polish — operator-experience and input hardening** — four low-severity items raised in external review round 4 (and confirmed non-blocking by the reviewer) were applied as polish before publication. (a) `/promote` and `/revoke` now reject non-string or empty-string `version` with `400 BAD_REQUEST`, closing a gap where malformed input like `{"version": {"bad": true}}` could reach the SQL driver. (b) `/lookup`, `/verify`, and `/log?name=` now apply the same lowercase normalization as `/promote` and `/revoke`, completing read-path consistency with the round-3 write-path normalization fix. (c) `/list` pagination parsing was aligned with `/log`'s pattern (further tightened in round 5 — see above). (d) README `registration_date` bullet updated to mention the calendar-validity round-trip added in round 3, not just the shape regex.

- **`last_updated` validation tightened to use calendar/clock validity** — the `validateRecord` check on caller-supplied `last_updated` previously used a shape-only regex, accepting impossible values like `2026-99-99T99:99:99Z` that survived the regex but failed semantics. The check now uses the `isValidRfc3339UtcSecondPrecision` helper (the same one used for mirror freshness validation), closing an internal-consistency gap between the two validation paths. In practice this matters only when callers explicitly supply the field, since `/register` regenerates it server-side; the change is internal-consistency work, not a correctness fix.
- **`/promote` and `/revoke` normalize caller-supplied names** — both handlers now apply the same normalization as `/register` (lowercase, slash-to-dot) before SQL lookup. Without this, callers passing mixed-case or slash-separated names like `Foo.Bar` or `foo/bar` would receive `404 NOT_FOUND` even when the equivalent stored record exists. The reviewer flagged `/promote`; wider-scope sweep caught the same defect class in `/revoke`. Type guards now also reject non-string `name` fields with a clear error message rather than allowing them to propagate.
- **Mirror mode validates freshness *values*, not just presence** — `AUTHORITATIVE_SNAPSHOT_TIMESTAMP` and `AUTHORITATIVE_SIGNATURE_HASH` env vars are now checked for well-formedness. The timestamp must be RFC 3339 second-precision UTC date-time with calendar-valid components; the hash must be a lowercase hex SHA-256 (64 hex chars). Mirrors running with malformed freshness values now return `status: 'degraded'` with a specific warning identifying which value failed, where previously only missing values triggered degraded status.
- **`isValidRfc3339UtcSecondPrecision` helper introduced** — single source of truth for date-time validity checks (shape regex + Date.UTC round-trip for calendar/clock validity). Unit-tested against 16 cases including leap-day boundaries, hour-24 rejection, minute-60 rejection, non-UTC offsets, and fractional-second rejection. Used by mirror freshness validation; available for future validators.
- **`/verify` signature check fixed** — `handleVerify` previously constructed the verification input from stored record fields but omitted the `signature` field itself, causing `verify()` to short-circuit and return `signature_valid: false` for every record regardless of actual signature validity. The reconstruction now correctly includes `signature: record.signature`. This was the most serious defect surfaced by external review.
- **`/promote` now re-signs the record** — `trust_tier` is part of the canonical JSON signed at registration time. The prior implementation updated `trust_tier` via direct SQL `UPDATE` without recomputing the signature, leaving promoted records with stale signatures that would fail verification. The handler now loads the existing record, generates a new `last_updated` timestamp, signs the updated payload, and writes `trust_tier`, `last_updated`, and `signature` together in a single transaction.
- **`/revoke` requires explicit `reason`** — Registry Spec §8.1 says all revocations must include a `reason` string for audit-trail purposes. The prior implementation defaulted to `'Revoked via API'` when no reason was supplied, accepting revokes silently. The handler now returns `400 BAD_REQUEST` when `reason` is missing or empty, requiring callers to supply an explicit reason.
- **`/register` endpoint scheme restricted to `http` / `https`** — defense-in-depth tightening (the spec says only "must be a valid URL", which `new url.URL()` parsing satisfies for `javascript:`, `file:`, `ftp:`, etc.). The implementation now rejects endpoints whose scheme is not `http:` or `https:`, since all `protocol` field values (`rest`, `mcp`, `a2a`, `grpc`, `custom`) imply HTTP-ish transport.
- **`/register` validates `version` as semver** — Registry Spec §3.1 defines `version` as "Semver string for the capability implementation." The prior implementation only checked presence-and-string-type, so submissions like `version: "banana"` were accepted. A semver regex (per semver.org §11 grammar) is now applied, accepting forms like `1.0.0`, `2.3.1-beta`, `1.0.0-rc.1+build1`.
- **`/register` validates caller-supplied `registration_date`** — Registry Spec §3.1 defines this as "RFC 3339 full-date (YYYY-MM-DD)". The registry generates the value correctly when not supplied, but the prior implementation did not validate caller-supplied values. A `YYYY-MM-DD` shape check plus calendar-validity round-trip now applies to any submitted value, rejecting impossible dates like `2026-99-99`. This mirrors the NS-002 fix for `last_updated`.
- **Documentation: spec-version references corrected** — the implementation README, source comments, and trailer referenced "Registry Specification v0.2" in 11 places. The current published canonical is v0.1.4 (which includes the amendments produced during this audit cycle). All references corrected to v0.1.4.

- **`last_updated` is now full RFC 3339 date-time** — per Namespace Standard §4.1 and Registry Spec §3.1, capability records' `last_updated` field is now written as `YYYY-MM-DDTHH:MM:SSZ` with second precision in UTC. Earlier releases stored only `YYYY-MM-DD` (date alone), which the spec forbids. Existing signed records remain verifiable: the signature payload is reconstructed from the stored value, so records signed under either format verify correctly against their original signature.
- **`validateRecord` enforces `last_updated` format on input** — if a caller submits `last_updated` (the Registry normally generates it automatically and overrides any caller value, but defense-in-depth: any submitted value is now validated), non-conformant shapes (date-only, non-UTC offsets, fractional seconds) are rejected with `422 VALIDATION_FAILED`.
- **New endpoint: `GET /log`** — public read of the append-only registration log per Registry Spec v0.1.4 §04. Returns entries in ascending `id` order with limit/offset pagination consistent with `/list`. Supports optional filtering by `name` and `action`. Implements the "logged and reviewable" property required by Namespace Standard §8.3, lifting it from an implicit operator-only capability (filesystem SQLite access) to a public, protocol-level obligation. See Registry Specification §04 for the full contract.

## What's new in v0.2.6

- **License changed to Apache 2.0** — the per-service `LICENSE` file is now the Apache License 2.0, matching the project-wide licensing decision. A `NOTICE` file has been added carrying attribution and the trademark policy (Apache 2.0 §4d). The `package.json` `license` field is now `Apache-2.0`. This supersedes the MIT license that shipped with earlier reference-implementation tarballs; the change was made before any public distribution.
- **Internal version-stamp corrections** — the `VERSION` constant in `server.js` (emitted in the `X-Registry` response header and the `/health` `registry_version` field) was stale at `0.2.2` across several prior releases; it now tracks the package version. The `setup.js` and `test.sh` header comments and the depicted startup banner in this README were likewise corrected. The earlier reconciliation rounds bumped `package.json` but did not reach these internal strings; that gap is now closed.
- **Documentation consistency** — the `start.sh` spec reference now points to `registry-spec.html` (was `namespace-standard.html`); the `package.json` description no longer pins a stale version note.

## What's new in v0.2.5

- **Installer hardening: secured launchd plist permissions** — the installer now calls `chmod 600` on the plist file immediately after writing it. The plist contains `REGISTRY_ADMIN_TOKEN` in its environment block, so restricting read access to the owner is appropriate hygiene. This is a defense-in-depth measure consistent with the file-permission discipline already applied to `keys/dnso_private.pem`.

- **Launchd-token model disclosed in Security Notes** — the README's Security Notes section now explicitly describes the admin-token storage path (Keychain plus launchd environment), notes the plist's mode-600 protection, and clarifies that this model is appropriate for local reference use only. Public or production deployments should use platform-native secret management. This is disclosure, not behavior change.

## What's new in v0.2.4

- **Trust-root callout in README** — added an `⚠ Important: Trust Roots and Local Keys` section at the top of this README, making explicit that locally-installed instances are not part of the canonical Dillweed Namespace.

- **Local-key advisory at startup** — the service now prints an advisory at startup recognizing that it is running with a locally-generated Ed25519 keypair and noting the location of the canonical DNSO public key (`https://dillweed.com/dnso_public.pem`). The advisory is informational; the service continues to operate normally.

- **Internal version-stamp corrections** — the hardcoded version strings in `server.js` (header comment, startup banner) now match the `package.json` version (v0.2.4). The earlier port-renumbering bumped `package.json` but did not propagate to these internal strings; that gap is closed.

## What's new in v0.2.3

- **Port renumbering** — the service's default port has changed from `7475` to `9475`. The `7474`-`7476` range conflicted with Neo4j's well-known ports; the `9474`-`9476` range avoids that conflict. If you set the port explicitly via the `*_PORT` environment variable in your deployment, no action is needed. If you relied on the default port, you must update your client configuration to use the new port.

## What's New in v0.2.2

This release brings the reference implementation into full conformance with the published Registry Specification v0.1.4 (May 2026, Stack Family 2026.04).

- **Signing consistency fix (Spec §5.2)** — The `POST /register` handler now includes `input_schema` and `output_schema` in the signed canonical JSON whenever they are present in the request, matching the verification path. Records registered via the API without schemas now round-trip cleanly through `GET /verify`. In v0.2.1 a subtle mismatch between the sign-time and verify-time payloads caused API-registered records to fail verification; that is fixed.
- **Absence preserved through storage** — When a registrant omits `input_schema` or `output_schema`, the registry now stores `NULL` in the database and omits the field from canonical JSON entirely, rather than storing `"{}"`. This preserves the distinction between *no schema provided* and *schema explicitly set to the empty object* that Spec §5.2 requires.
- **All-errors-simultaneously validation (Spec §7)** — `validateRecord` no longer short-circuits after required-field checks. A malformed submission now returns every independent failure in a single 422 response, so callers fix all problems in one round trip instead of discovering them one at a time.
- **Planned key rotation (Spec §5.6)** — New `rotate-key.js` tool supports the three-phase rotation ceremony: `--begin` generates a new keypair, preserves the prior key, re-signs all active records under the new key, and logs `rotation_started` to the audit trail; `--status` reports overlap state; `--finalize` retires the prior key after the overlap window closes and logs `rotation_finalized`. The server now serves the prior public key from `GET /pubkey?previous=true` while the overlap window is active, and `GET /health` exposes the overlap dates. Minimum 30-day overlap window is enforced (Spec §5.6 recommended minimum).
- **Rate limiting note (Spec §11.3)** — The reference implementation does not enforce per-IP rate limits; production deployments serving public internet traffic should place the registry behind a reverse proxy (nginx, Caddy) configured with appropriate rate limiting. See §11.3 of the spec and the *Security Notes* section below.
- **Expanded test suite** — `test.sh` now covers the signing round-trip for both schema-full and schema-less records, the all-errors-simultaneously behavior, revoked-slot re-registration (Spec §8.1 immutable revoked row), and the `/pubkey?previous=true` endpoint.

## What's New in v0.2.1

- Expanded signing model — `canonicalJSON` includes `input_schema` and `output_schema` in the signed field set (alphabetical order), aligning with Registry Specification v0.1.4. Signature verification in `/verify` passes these fields correctly.
- Seed record signatures — Setup seeds sign `input_schema` and `output_schema` alongside all other fields.

## What's New in v0.2.0

- Deployment mode awareness — `REGISTRY_MODE` env var (`authoritative` | `mirror` | `local`). Mirror mode disables all write endpoints and exposes `authoritative_snapshot_timestamp` and `authoritative_signature_hash` in `/health` for resolver freshness validation.
- Provisional tier declarations — Self-assigning `verified` or `canonical` at registration logs a `provisional_tier` audit entry and returns a `provisional_tier_notice` in the response. Resolvers SHOULD apply a weighting penalty until DNSO attestation is confirmed via `/promote`.
- `/health` enhancements — Includes `schema_version` and `deployment_mode` fields.
- Spec alignment — References updated to `dillweed.com/registry-spec.html`.

---

## What This Does

- Stores Capability Records in a local SQLite database (`data/registry.db`)
- Signs every record with an Ed25519 keypair at registration time
- Serves records over HTTP for the DillClaw Resolver to query
- Accepts new registrations via API
- Supports revocation, tier promotion, and signature verification
- Generates the DNSO keypair — the private key signs records, the public key is published at `dillweed.com/dnso_public.pem` for independent verification
- Enforces read-only mirror mode when `REGISTRY_MODE=mirror`
- Supports planned key rotation with an overlap window (v0.2.2)

---

## Prerequisites

Node.js 14+ and npm. Check:

```bash
node --version
npm --version
```

Install if needed:

```bash
brew install node
```

**Testing requirements:** `curl` and `openssl` must be in PATH. `jq` is optional but recommended.

```bash
which curl openssl    # required
which jq              # optional: brew install jq
```

---

## Installation

Extract and enter the directory:

```bash
tar -xzf dillweed-registry.tar.gz
cd dillweed-registry
chmod +x start.sh test.sh
```

Install the one dependency (`better-sqlite3`):

```bash
npm install
```

Run setup (creates database, generates keypair, seeds sample records):

```bash
node setup.js
```

Setup will:
1. Generate a fresh Ed25519 keypair in `keys/`
2. Create `data/registry.db` with the full schema
3. Seed seven sample Capability Records, each signed with the DNSO private key

---

## Starting the Registry

```bash
./start.sh
```

Or directly:

```bash
node server.js
```

Default port is `9475`. Override with:

```bash
REGISTRY_PORT=8080 node server.js
```

You should see:

```
  ╔═══════════════════════════════════════════════╗
  ║     Dillweed Registry  v0.2.7                 ║
  ║     dillweed.com/registry-spec.html           ║
  ╠═══════════════════════════════════════════════╣
  ║  Listening   http://0.0.0.0:9475              ║
  ║  Database    data/registry.db  (7   records)  ║
  ║  Mode        authoritative                    ║
  ║  Signing     Ed25519 (DNSO)                   ║
  ║  Auth        open (set REGISTRY_ADMIN_TOKEN)  ║
  ╚═══════════════════════════════════════════════╝
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `REGISTRY_PORT` | `9475` | TCP port to listen on |
| `REGISTRY_MODE` | `authoritative` | One of `authoritative`, `mirror`, `local` |
| `REGISTRY_ADMIN_TOKEN` | *(unset)* | Bearer token required on write endpoints when set |
| `AUTHORITATIVE_SNAPSHOT_TIMESTAMP` | *(unset)* | Mirror mode only: ISO 8601 timestamp of last sync |
| `AUTHORITATIVE_SIGNATURE_HASH` | *(unset)* | Mirror mode only: hash of authoritative `/list` payload |
| `ROTATION_STARTED_AT` | *(unset)* | Published in `/health` during rotation overlap |
| `ROTATION_ENDS_AT` | *(unset)* | Published in `/health` during rotation overlap |

---

## Running the Tests

With the server running in one terminal:

```bash
bash test.sh
```

All v0.2 conformance behaviors are covered: health, public key, list/lookup/verify, registration validation, duplicate detection, provisional-tier handling, revocation, tier promotion, revoked-slot re-registration (§8.1), all-errors-simultaneously validation (§7), API-registered signature round-trip (§5.2), and the `/pubkey?previous=true` endpoint (§5.6).

---

## Connecting DillClaw to the Registry

Copy `resolver-patch.js` into your DillClaw resolver directory and replace the registry-loading block in the resolver's `server.js` with:

```js
const registry = require('./resolver-patch');
function getAll() { return registry.getAll(); }
```

Then start DillClaw with the registry URL set:

```bash
DILLCLAW_REGISTRY_URL=http://localhost:9475 node server.js
```

The resolver will fetch records from `/list` on startup, refresh every 60 seconds, and fall back to the local `registry.json` file if the registry is unreachable.

---

## API Reference

### `GET /health`

Returns registry status, active record count, per-tier breakdown, signing algorithm, and public key URL. Also surfaces `schema_version`, `deployment_mode`, mirror-freshness fields (when in mirror mode), and rotation overlap state (when active).

```bash
curl http://localhost:9475/health | jq .
```

### `GET /pubkey`

Returns the DNSO public key in PEM format.

```bash
curl http://localhost:9475/pubkey

# Copy the output to your web server:
# → https://dillweed.com/dnso_public.pem
```

During a planned rotation overlap window, the prior public key is available at:

```bash
curl 'http://localhost:9475/pubkey?previous=true'
```

Returns 404 when no rotation is active.

### `GET /list`

```bash
# All records
curl http://localhost:9475/list

# Filter by trust tier
curl 'http://localhost:9475/list?tier=verified'

# Filter by tag
curl 'http://localhost:9475/list?tag=search'

# Pagination
curl 'http://localhost:9475/list?limit=20&offset=0'
```

Maximum 500 records per response. This is the primary endpoint resolvers poll to warm and refresh their cache.

### `GET /lookup/<n>`

```bash
# Latest version
curl http://localhost:9475/lookup/research.market.intel.vendors

# Specific version
curl 'http://localhost:9475/lookup/tools.search.web-retrieval?version=3.1.0'
```

Path separators may be dots or forward slashes; both are normalized to dots.

### `GET /verify/<n>`

Verifies the DNSO cryptographic signature on a stored record.

```bash
curl http://localhost:9475/verify/research.market.intel.vendors | jq .
```

Returns `signature_valid: true/false`, the algorithm (`Ed25519`), and the canonical public key URL. In v0.2.2, records registered via `POST /register` without `input_schema` or `output_schema` now verify correctly (fix for the sign/verify mismatch in v0.2.1).

### `POST /register`

```bash
curl -X POST http://localhost:9475/register \
  -H "Content-Type: application/json" \
  -d '{
    "name":         "tools.translation.text.en-es",
    "description":  "English to Spanish translation with confidence scores.",
    "endpoint":     "https://api.translate.example.com/en-es",
    "protocol":     "rest",
    "trust_tier":   "experimental",
    "permissions":  ["query"],
    "version":      "1.0.0",
    "input_schema":  { "type": "object" },
    "output_schema": { "type": "object" },
    "tags":         ["translation","text"]
  }'
```

Returns the complete signed record. Validation errors are returned as a 422 with an `errors` array containing **every** independent failure (Spec §7) — not just the first. Self-assigning `trust_tier` of `verified` or `canonical` is accepted as a provisional claim and logged to the audit trail; resolvers apply a weighting penalty until DNSO attestation via `/promote`.

### `POST /revoke`

```bash
# Revoke a specific version
curl -X POST http://localhost:9475/revoke \
  -H "Content-Type: application/json" \
  -d '{"name":"tools.translation.text.en-es","version":"1.0.0","reason":"Superseded by v2.0"}'

# Revoke all versions
curl -X POST http://localhost:9475/revoke \
  -H "Content-Type: application/json" \
  -d '{"name":"tools.translation.text.en-es","reason":"Service retired"}'
```

Revoked records disappear from `/lookup` and `/list` immediately. The row is not deleted — it is marked `revoked=1` with the reason and timestamp, preserving the audit trail (Spec §8.1). The `name:version` slot becomes available for re-registration, which inserts a new row rather than mutating the revoked row.

### `POST /promote`

```bash
curl -X POST http://localhost:9475/promote \
  -H "Content-Type: application/json" \
  -d '{"name":"tools.translation.text.en-es","version":"1.0.0","trust_tier":"trusted"}'
```

Updates the trust tier of an active record. Both promotion (`experimental → trusted`) and demotion (`verified → trusted`) are permitted and logged.

---

## Securing Write Endpoints

Set a bearer token and all write endpoints (`/register`, `/revoke`, `/promote`) require it:

```bash
REGISTRY_ADMIN_TOKEN=$(openssl rand -hex 32) node server.js
```

Callers must then include the token:

```bash
curl -X POST http://localhost:9475/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

Unauthenticated writes return 401 `UNAUTHORIZED`.

---

## Planned Key Rotation (v0.2.2)

Per Registry Specification v0.1.4 §5.6, the DNSO Ed25519 keypair should be rotated periodically on a planned cadence, distinct from an emergency keypair reset. Planned rotation preserves the prior key through a defined overlap window so resolvers that cached the old key continue to verify existing records while they refresh.

### Rotation ceremony

```bash
# Begin rotation — generates a new keypair, preserves the old one,
# re-signs all active records under the new key, logs rotation_started
# to the audit trail. Default overlap is 30 days (spec recommended minimum).
node rotate-key.js --begin

# Or choose a longer overlap window:
node rotate-key.js --begin --overlap-days=60

# Check status
node rotate-key.js --status

# After the overlap window closes (and only after), finalize:
node rotate-key.js --finalize
```

During the overlap window:

- `GET /pubkey` returns the new public key
- `GET /pubkey?previous=true` returns the prior public key
- `GET /health` includes a `key_rotation` block with `overlap_active: true`, the `rotation_started_at` and `rotation_ends_at` ISO timestamps (when the server is started with `ROTATION_STARTED_AT` and `ROTATION_ENDS_AT` env vars set), and the URL for the previous key
- The audit trail contains a `rotation_started` entry; `--finalize` appends `rotation_finalized`

To expose the overlap timestamps via `/health` after running `--begin`, start the server with the timestamps from `keys/rotation.json`:

```bash
ROTATION_STARTED_AT="2026-04-23T14:00:00.000Z" \
ROTATION_ENDS_AT="2026-05-23T14:00:00.000Z" \
node server.js
```

**Emergency keypair reset** (private key lost or compromised) is a different operation: delete the `keys/` directory and rerun `node setup.js`. All existing signatures become unverifiable and all active records must be re-registered. Use planned rotation instead whenever possible.

---

## Publishing the Public Key

```bash
# Copy from the running registry
curl http://localhost:9475/pubkey > dnso_public.pem

# Upload to your web server at dillweed.com/dnso_public.pem
```

The canonical URL is `https://dillweed.com/dnso_public.pem`. Resolvers and agents should fetch the verification key from that TLS-protected URL rather than from the registry's own `/pubkey` endpoint, so a compromised registry cannot serve a forged key.

Agents verify signatures by fetching this key and checking it against the `signature` field in any Capability Record, reconstructing the canonical JSON per Spec §5.2.

---

## Running Both Services Together

Both services on the Mac Mini simultaneously:

**Terminal 1 — Registry:**
```bash
cd dillweed-registry && ./start.sh
```

**Terminal 2 — DillClaw Resolver (live mode):**
```bash
cd dillclaw-resolver
DILLCLAW_REGISTRY_URL=http://localhost:9475 node server.js
```

Or run both as persistent background services using launchd (see below).

---

## Running as a Background Service (launchd)

Replace `/path/to/dillweed-registry` with your actual path:

```bash
cat > ~/Library/LaunchAgents/com.dillweed.registry.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>              <string>com.dillweed.registry</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/dillweed-registry/server.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>REGISTRY_PORT</key>    <string>9475</string>
    <key>REGISTRY_MODE</key>    <string>authoritative</string>
  </dict>
  <key>RunAtLoad</key>          <true/>
  <key>KeepAlive</key>          <true/>
  <key>StandardOutPath</key>    <string>/tmp/dillweed-registry.log</string>
  <key>StandardErrorPath</key>  <string>/tmp/dillweed-registry.err</string>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.dillweed.registry.plist
```

---

## File Layout

```
dillweed-registry/
├── server.js          — Registry HTTP service
├── setup.js           — One-time DB + keypair initialization
├── rotate-key.js      — Planned key rotation tool (Spec §5.6)
├── resolver-patch.js  — Drop-in live registry client for DillClaw
├── package.json       — Node.js package descriptor
├── start.sh           — Launch script
├── test.sh            — curl-based test suite
├── README.md          — This file
├── LICENSE            — Apache License 2.0
├── NOTICE             — Attribution and trademark notice
├── data/
│   └── registry.db    — SQLite database (created by setup.js)
└── keys/
    ├── dnso_private.pem           — Current DNSO signing key (keep secret, back up)
    ├── dnso_public.pem            — Current DNSO verification key (publish at dillweed.com)
    ├── dnso_private_previous.pem  — Prior signing key (present during rotation overlap)
    ├── dnso_public_previous.pem   — Prior verification key (served via /pubkey?previous=true)
    └── rotation.json              — Rotation overlap marker (start/end timestamps)
```

---

## Security Notes

**`keys/dnso_private.pem` is the root of trust for the entire namespace.** Back it up securely (encrypted external drive, password manager). If lost, all existing signatures become unverifiable and a new keypair must be generated — which effectively resets trust for all registered capabilities.

The private key file is created with mode `0600` (owner read/write only) by `setup.js`. Do not commit it to version control.

**Admin token in launchd environment.** The installer generates a 256-bit admin token via `openssl rand -hex 32`, stores it in the macOS Keychain (service: `dillweed-registry`, account: `registry-admin`), and also injects it into the launchd plist's environment block so the service can read it at auto-start. The plist file is written with mode `0600` by the installer to limit read access to the owner. This token model is acceptable for local reference use; public or production deployments should replace it with platform-native secret management and should not rely on launchd environment injection for credential delivery. See [implementation guide §10](https://dillweed.com/implementing-dillweed.html#operations) for the full operational security model.

**Rate limiting (Spec §11.3).** The reference implementation does not enforce per-IP rate limits in v0.2 — the primary deployment context is a controlled network. Production deployments serving public internet traffic should place the registry behind a reverse proxy (nginx, Caddy) configured with per-IP rate limits on read endpoints (`/list`, `/lookup`, `/verify`) to prevent scraping and availability degradation. Write endpoints (`/register`, `/revoke`, `/promote`) are protected by bearer token authentication and should additionally be restricted by IP allowlist in environments where the set of authorized callers is known and fixed.

**Planned key rotation (Spec §5.6).** Rotate the DNSO keypair on a routine schedule (recommended: at least annually) using `rotate-key.js --begin`. Keep the prior key available for the full overlap window (minimum 30 days) so resolvers with cached copies can complete their refresh cycle. Publish the overlap window start and end dates publicly.

## License

Licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for the full text.

The Apache 2.0 license does not grant trademark rights. "Dillweed" is a registered trademark; "DillClaw" and "Dillweed Anthill" are common-law trademarks. See the [NOTICE](NOTICE) file for the trademark policy.

---

*Dillweed Registry v0.2.7 — Registry Specification v0.1.4 — dillweed.com — 2026*
