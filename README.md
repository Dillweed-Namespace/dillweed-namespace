# Dillweed Namespace

A capability-registration and resolution system with a publicly verifiable trust root.

This project is in early stewardship phase. Response times may be extended.

The Dillweed Namespace defines how capabilities — addressable, versioned, signed descriptions of what a service can do — are registered, resolved, and audited. Three components implement the v1 specification:

- **Registry** — authoritative store of capability records, signs each record with the canonical DNSO private key, exposes lookup/verify endpoints
- **DillClaw Resolver** — fetches capability records from a Registry, caches them with TTL, verifies signatures against the canonical public key
- **Anthill** — receives operational signals from instrumented components, supports dual-window time-bucketed aggregation, enforces nonce + node-sequence replay protection

Component specifications are published at [dillweed.com](https://dillweed.com).

## v1 release

The v1 ship-verified baseline:

| Component | Version | SHA256 |
|---|---|---|
| Registry | 0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` |
| Resolver | 0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` |
| Anthill  | 0.1.5 | `dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b` |

Release tarballs are attached to the [v1.0.0 release](../../releases/tag/v1.0.0). The full audit trail — three rounds of external review per component, install testing on real hardware, and a coordinated patch round — lives in [`project-action-items.md`](project-action-items.md).

## Trust model

The Registry signs every active capability record with the **DNSO Ed25519 private key**. The corresponding public key is published canonically at:

```
https://dillweed.com/dnso_public.pem
```

with SHA256:

```
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

Resolvers and other relying parties fetch this public key (the v0.1.8 installer does this automatically) and verify capability signatures locally before trusting any record. Verification failure is operationally fatal: a Resolver that cannot verify a signature MUST refuse to surface that record.

The Registry never publishes its private key. The canonical public key is the single source of truth for trust-root verification — if the published value ever changes, every Resolver instance must re-fetch and confirm the new SHA via an out-of-band channel.

## Repository layout

```
.
├── README.md                       (this file)
├── LICENSE                         (Apache-2.0)
├── NOTICE                          (third-party attributions)
├── project-action-items.md         (audit trail / project ledger)
├── .gitignore
│
├── registry/                       Dillweed Registry — source
├── resolver/                       DillClaw Resolver — source
├── anthill/                        Dillweed Anthill — source
│
├── specs/                          spec documents (mirror of dillweed.com)
├── docs/
│   ├── operations-runbook.md       deployment + recovery procedures
│   └── release-notes/              per-release notes
└── patches/                        historical patch artifacts (v0.1.8, v0.2.8, v0.1.5)
```

## Installing v1 components

Each component is distributed as a self-contained tarball with an installer for macOS (Linux support is on the v2 roadmap). The recommended order is **Registry first, then Resolver, then Anthill**, since the Resolver fetches records from the Registry and Anthill receives signals from instrumented Resolvers.

### Registry (v0.2.8)

```bash
cd ~/Tarballs
tar -xzf dillweed-registry-v0.2.8.tar.gz
cd dillweed-registry
bash install.sh
```

**Important:** Run `install.sh` from the extracted directory, *not* from inside the install destination (`/usr/local/dillweed/registry/dillweed-registry/`). Running from inside the destination triggers a clean abort with recovery instructions (this is the INST-001 protection added in v0.2.8).

After install, the Registry runs on port 9475 with a launchd plist for auto-start. The admin token is generated and stored in the macOS Keychain (service `dillweed-registry`, account `registry-admin`).

To retrieve the admin token for `test.sh` or operational commands:

```bash
export REGISTRY_ADMIN_TOKEN=$(security find-generic-password \
    -s "dillweed-registry" -a "registry-admin" -w)
```

### Resolver (v0.1.8)

```bash
cd ~/Tarballs
tar -xzf dillweed-resolver-v0.1.8.tar.gz
cd dillclaw-resolver
bash install.sh
```

During Step 5, the installer fetches the canonical DNSO public key from `https://dillweed.com/dnso_public.pem`, validates that the response is a PEM-encoded public key, and displays both the fetched SHA and the expected canonical SHA for operator comparison.

If the canonical URL is unreachable, the installer aborts cleanly. To recover, either fix network connectivity and re-run, or set `DNSO_PUBLIC_KEY_URL` to an alternate trust-root source and re-run.

The Resolver runs on port 9474. It has no admin token in v0.1.8 — it's a read-only fetcher with no destructive endpoints.

### Anthill (v0.1.5)

```bash
cd ~/Tarballs
tar -xzf dillweed-anthill-v0.1.5.tar.gz
cd dillweed-anthill
bash install.sh
```

Anthill runs on port 9476 with token authentication required for the signal-submission endpoint. As with the Registry, the admin token is generated and stored in the macOS Keychain (service `dillweed-anthill`, account `anthill-admin`).

```bash
export ANTHILL_ADMIN_TOKEN=$(security find-generic-password \
    -s "dillweed-anthill" -a "anthill-admin" -w)
```

## Verification

After installing all three components, verify trust-chain coherence:

```bash
echo "Three SHAs should all match 909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33:"
shasum -a 256 /usr/local/dillweed/registry/dillweed-registry/keys/dnso_public.pem
shasum -a 256 /usr/local/dillweed/resolver/dillclaw-resolver/dnso_public.pem
curl -s https://dillweed.com/dnso_public.pem | shasum -a 256
```

And verify end-to-end signing works:

```bash
curl -s http://localhost:9475/verify/research.market.intel.vendors | python3 -m json.tool
```

Expected output includes `"signature_valid": true` and `"algorithm": "Ed25519"`.

## Running test suites

Each component ships a `test.sh` that exercises spec conformance. Run with the appropriate admin token in the environment:

```bash
# Registry — expect 79/79 passing
export REGISTRY_ADMIN_TOKEN=$(security find-generic-password -s "dillweed-registry" -a "registry-admin" -w)
cd /usr/local/dillweed/registry/dillweed-registry
bash test.sh

# Resolver — expect 65/65 integration + 29/29 unit passing (no admin token required)
cd /usr/local/dillweed/resolver/dillclaw-resolver
bash test.sh          # 65 integration tests
node unit-tests.js    # 29 unit tests

# Anthill — expect 57/58 passing (one known issue, see INST-013 in the ledger)
export ANTHILL_ADMIN_TOKEN=$(security find-generic-password -s "dillweed-anthill" -a "anthill-admin" -w)
cd /usr/local/dillweed/anthill/dillweed-anthill
bash test.sh
```

## Known issues

See [`project-action-items.md`](project-action-items.md) for the canonical findings ledger. As of v1.0.0:

- **INST-008 (LOW)** — partially closed; the Resolver *tarball filename* was corrected from `dillclaw-resolver-v0.1.8.tar.gz` to `dillweed-resolver-v0.1.8.tar.gz` at v1.0.0 publication. The tarball still extracts to a `dillclaw-resolver/` directory (the component-internal name) — this is a cosmetic inconsistency, not a functional issue, and is queued for cleanup in a future release
- **INST-011 (info)** — admin tokens in launchd plist files are stored plaintext; acceptable for the v1 reference deployment but worth revisiting for multi-operator production scenarios
- **INST-012 (info)** — Registry tarball ships an unused `resolver-patch.js` artifact; cosmetic
- **INST-013 (LOW)** — Anthill's AS-006 body-size test sends a 300KB payload via `curl -d "$BIG_BODY"` and gets HTTP 000 due to shell argv-length handling; server-side limit enforcement is intact, only the test method is unreliable. Fix queued for v0.1.6 (`-d @<tempfile>` pattern).

No HIGH-severity or MEDIUM-severity issues are open.

## License

Apache License, Version 2.0. See [LICENSE](LICENSE).
