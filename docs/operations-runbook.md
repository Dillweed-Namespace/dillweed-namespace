# Dillweed Local Reference Deployment — Operations Runbook

**Document type:** Operational runbook
**Scope:** Local reference deployment on dill-p-001 (macOS, Apple Silicon)
**Author:** Richard McClelland, founding steward, Dillweed Namespace Project
**First version:** May 2026
**Status:** Operational substrate; not a published Dillweed specification

---

## 1. Purpose and Scope

This document describes how the local reference deployment of the Dillweed Namespace stack is maintained, backed up, recovered, and upgraded. It is operational documentation for a specific host — the Mac Mini designated **dill-p-001** — operated by the founding steward during the founding phase of the Dillweed Namespace Project.

### What this document is

- A reference runbook for procedures that affect the local deployment
- A record of operational decisions and the reasoning behind them
- A successor-readable document that allows a continuity trustee or authorized reviewer to understand current operational practice without inheriting only verbal knowledge
- A living document expected to evolve as operational practice evolves

### What this document is not

- **Not a Dillweed specification.** The published spec stack (Namespace Standard, DillClaw Resolver Specification, Registry Specification, Anthill Specification, Governance Framework, DNSO Operations Charter, Continuity Protocol, Standards Overview) is normative. This runbook is operational practice and may legitimately differ from those documents in implementation detail.
- **Not guidance for canonical public infrastructure.** When public canonical Dillweed infrastructure eventually exists, it will warrant its own runbook governed by the DNSO Operations Charter rather than by this document. This runbook applies only to the local reference deployment.
- **Not guidance for third-party adopters.** Adopters who install the reference implementation should follow the public Implementation Guide at dillweed.com/implementing-dillweed.html. This runbook describes operational practices that apply specifically to the founding-steward deployment.
- **Not exhaustive.** This document covers backup, recovery, clean reinstall, in-place upgrade, install-testing findings, and basic emergency scenarios. Additional scenarios (in-place schema migration, key rotation, signal-log archival, etc.) will be added as operational experience surfaces the need.

### Conformance terminology

This document uses ordinary descriptive language rather than the BCP 14 normative keywords. Where this document and the published specifications appear to differ, the published specifications are authoritative.

---

## 2. Deployment Inventory

The local reference deployment of the Dillweed stack consists of three services installed under `/usr/local/dillweed/` and managed via launchd. The current configuration is:

### Services and ports

| Service | Version | Port | Install Directory |
|---|---|---|---|
| Dillweed Registry | v0.2.8 | 9475 | `/usr/local/dillweed/registry/dillweed-registry/` |
| DillClaw Resolver | v0.1.8 | 9474 | `/usr/local/dillweed/resolver/dillclaw-resolver/` |
| Dillweed Anthill | v0.1.5 | 9476 | `/usr/local/dillweed/anthill/dillweed-anthill/` |

### Persistent state locations

| Artifact | Path |
|---|---|
| Registry signing keypair | `/usr/local/dillweed/registry/dillweed-registry/keys/dnso_private.pem` and `dnso_public.pem` |
| Registry database | `/usr/local/dillweed/registry/dillweed-registry/data/registry.db` |
| Anthill database | `/usr/local/dillweed/anthill/dillweed-anthill/data/anthill.db` |
| Anthill append-only signal log | `/usr/local/dillweed/anthill/dillweed-anthill/logs/signals.log` |
| Service logs (all three) | `/usr/local/dillweed/logs/` |

### launchd service definitions

| Service | Plist path | Label |
|---|---|---|
| Registry | `~/Library/LaunchAgents/com.dillweed.registry.plist` | `com.dillweed.registry` |
| Resolver | `~/Library/LaunchAgents/com.dillweed.resolver.plist` | `com.dillweed.resolver` |
| Anthill | `~/Library/LaunchAgents/com.dillweed.anthill.plist` | `com.dillweed.anthill` |

All three plists are installed with mode 0600 (owner read/write only).

### macOS Keychain entries

| Service | Keychain service | Keychain account |
|---|---|---|
| Registry admin token | `dillweed-registry` | `registry-admin` |
| Anthill admin token | `dillweed-anthill` | `anthill-admin` |

The Resolver does not have an admin token.

### Tarball naming convention

Release tarballs follow the `dillweed-` prefix convention for all three components:

```
dillweed-registry-vX.Y.Z.tar.gz
dillweed-resolver-vX.Y.Z.tar.gz
dillweed-anthill-vX.Y.Z.tar.gz
```

**Note:** The Resolver extract directory inside the tarball is named `dillclaw-resolver/` (the
component-internal name). This is cosmetically inconsistent with the `dillweed-resolver` tarball
filename but is not a functional issue. See INST-008 in Section 8.

### Backup destination convention

Operational backups are kept in `~/Dillweed-Backups/<YYYY-MM-DD>/` on dill-p-001, with additional copies maintained on at least one offline medium (external drive in physical custody). The backup directory contains:

- Cryptographic key material
- Database snapshots
- Keychain token exports
- A `README-restore.txt` file describing the backup contents
- Optionally, a copy of the service install directories for full restoration

---

## 3. Routine Maintenance

This section describes maintenance activities that do not require uninstall or reinstall.

### Quick weekly checklist

A fast scan that can be completed in under five minutes:

```
Weekly:
  □  curl /health on all three services (all return "ok")
  □  launchctl list | grep dillweed (three entries present)
  □  tail -20 error logs for each service (no recent exceptions)
  □  Confirm dnso_public.pem SHA matches canonical trust root
  □  Note last backup date — schedule if overdue
  □  Optionally run test suites (see below)
```

The SHA check:
```bash
curl -s https://dillweed.com/dnso_public.pem | openssl pkey -pubin -outform DER | sha256sum
# Expected: 909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

### Verifying services are running

```bash
launchctl list | grep dillweed
```

The output should show three entries (`com.dillweed.registry`, `com.dillweed.resolver`, `com.dillweed.anthill`). If any service is missing, check the corresponding error log under `/usr/local/dillweed/logs/`.

Health-check each service:

```bash
curl http://localhost:9475/health   # Registry
curl http://localhost:9474/health   # Resolver
curl http://localhost:9476/health   # Anthill
```

Each should return JSON containing `"ok"`. A health-check failure is the first signal of trouble worth investigating before more drastic action.

### Inspecting logs

```bash
tail -f /usr/local/dillweed/logs/registry.log
tail -f /usr/local/dillweed/logs/registry-error.log
```

Substitute `resolver` or `anthill` for the other services. The startup advisory for Registry (`LOCAL-KEY ADVISORY`) and Anthill (`LOCAL-INSTANCE ADVISORY`) is expected to appear at every service start.

### Restarting a service manually

```bash
launchctl unload ~/Library/LaunchAgents/com.dillweed.registry.plist
launchctl load   ~/Library/LaunchAgents/com.dillweed.registry.plist
```

Substitute the other service plists as needed.

### Retrieving the admin tokens

```bash
security find-generic-password -a registry-admin -s dillweed-registry -w
security find-generic-password -a anthill-admin  -s dillweed-anthill  -w
```

These commands print the current token to stdout. Use them when configuring tools that need to authenticate against the Registry or Anthill admin endpoints, or when running `test.sh` against a token-protected deployment (see INST-010 in Section 8).

The Resolver has no admin token and requires no authentication.

### Running the test suites

The test suites require the admin tokens to be passed via environment variable. Run them as:

```bash
REGISTRY_ADMIN_TOKEN=$(security find-generic-password -a registry-admin -s dillweed-registry -w) \
  bash /usr/local/dillweed/registry/dillweed-registry/test.sh

bash /usr/local/dillweed/resolver/dillclaw-resolver/test.sh

ANTHILL_ADMIN_TOKEN=$(security find-generic-password -a anthill-admin -s dillweed-anthill -w) \
  bash /usr/local/dillweed/anthill/dillweed-anthill/test.sh
```

Running `test.sh` without the token environment variable in a token-protected deployment will produce partial results (only unauthenticated endpoints pass). See INST-005 in Section 8.

---

## 4. Backup Procedure

This section describes the careful backup procedure to perform before any destructive operation (clean reinstall, manual data removal, key rotation). The procedure is also appropriate as a periodic routine — the recommended cadence is monthly for routine state, immediately before any major operational change.

### 4.1 Create a dated backup directory

```bash
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_DIR=~/Dillweed-Backups/${BACKUP_DATE}
mkdir -p "${BACKUP_DIR}"/{keys,registry,anthill,logs,keychain,plists}
```

### 4.2 Backup cryptographic keys

These are the single most important artifacts on the host. The DNSO private key cannot be regenerated; if lost, every record signed under it becomes unverifiable against any replacement key.

```bash
cp /usr/local/dillweed/registry/dillweed-registry/keys/dnso_private.pem "${BACKUP_DIR}/keys/"
cp /usr/local/dillweed/registry/dillweed-registry/keys/dnso_public.pem "${BACKUP_DIR}/keys/"
chmod 600 "${BACKUP_DIR}/keys/dnso_private.pem"
```

Verify the keys backed up correctly. The private key should be a valid Ed25519 key:

```bash
openssl pkey -in "${BACKUP_DIR}/keys/dnso_private.pem" -noout -text
```

The output should show `ED25519 Private-Key` and a 32-byte private value. Any error here means the backup is unreadable — do not proceed with destructive operations until this is resolved.

Verify the public key SHA against the canonical trust root:

```bash
openssl pkey -in "${BACKUP_DIR}/keys/dnso_public.pem" -pubin -outform DER | sha256sum
# Expected: 909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

> **Key authority note.** In this local reference deployment, the DNSO keypair is operationally
> important because it signs local Registry records. It is not, by itself, evidence of governance
> authority over the Dillweed Namespace. Authority remains governed by the published Governance
> Framework, DNSO Operations Charter, and Continuity Protocol — not by possession of this key
> material.

> **Private key location — local reference only.** The DNSO private key lives under the Registry
> service install directory (`keys/dnso_private.pem`). This is acceptable for a local reference
> deployment. Future canonical deployments should store the private key outside the ordinary service
> install tree, accessed from a restricted path or via a separate signing process (HSM-equivalent
> workflow). The current arrangement should not be normalized as the long-term architecture for
> public canonical infrastructure.

### 4.3 Backup databases

```bash
cp /usr/local/dillweed/registry/dillweed-registry/data/registry.db "${BACKUP_DIR}/registry/"
cp /usr/local/dillweed/anthill/dillweed-anthill/data/anthill.db "${BACKUP_DIR}/anthill/"
```

Verify the databases backed up correctly:

```bash
sqlite3 "${BACKUP_DIR}/registry/registry.db" ".tables"
sqlite3 "${BACKUP_DIR}/anthill/anthill.db" ".tables"
```

Each should list the expected tables. An "I/O error" or "not a database" response means the file is corrupted or zero-length — do not proceed.

### 4.4 Backup the Anthill append-only signal log

```bash
cp /usr/local/dillweed/anthill/dillweed-anthill/logs/signals.log "${BACKUP_DIR}/anthill/" 2>/dev/null || true
```

This file may or may not exist depending on whether any signals have been submitted. Its absence is not an error.

### 4.5 Backup service logs

```bash
cp -r /usr/local/dillweed/logs/* "${BACKUP_DIR}/logs/" 2>/dev/null || true
```

### 4.6 Export Keychain tokens

```bash
security find-generic-password -a registry-admin -s dillweed-registry -w > "${BACKUP_DIR}/keychain/registry-admin-token.txt"
security find-generic-password -a anthill-admin -s dillweed-anthill -w > "${BACKUP_DIR}/keychain/anthill-admin-token.txt"
chmod 600 "${BACKUP_DIR}/keychain/"*.txt
```

Verify the exported tokens are 64-character hex strings:

```bash
wc -c "${BACKUP_DIR}/keychain/"*.txt
```

Each file should be 65 bytes (64 hex characters plus a newline). Anything else indicates an export failure.

### 4.7 Backup launchd plists

```bash
cp ~/Library/LaunchAgents/com.dillweed.*.plist "${BACKUP_DIR}/plists/"
```

The plists themselves are recreated by the installer, but preserving the current copies is useful for diff-checking after a reinstall.

### 4.8 Apply restrictive permissions

```bash
find "${BACKUP_DIR}" -type d -exec chmod 700 {} \;
find "${BACKUP_DIR}" -type f -exec chmod 600 {} \;
```

Do not use `chmod -R 600` here. That sets subdirectories to mode `600`, removing the execute bit and making them non-traversable. The `find`-based form above correctly applies `700` to directories (traverse permission for owner only) and `600` to files (read/write for owner only).

### 4.9 Create the restore documentation

Create a `README-restore.txt` in the backup directory describing its contents. Adapt the template at the end of this document (Section 11).

### 4.10 Copy to offline medium

Copy the entire backup directory to an external drive that is normally disconnected. The offline copy is the load-bearing backup; the on-disk copy is for convenience.

### 4.11 Optional: encrypt the on-disk archive

For an additional layer of protection at rest:

```bash
cd ~/Dillweed-Backups
tar -czf - "${BACKUP_DATE}" | openssl enc -aes-256-cbc -salt -pbkdf2 -out "${BACKUP_DATE}.tar.gz.enc"
```

Store the encryption password where it can be found later but where casual access cannot reach it (e.g., a password manager with strong protection, not a plain-text note). After verifying the encrypted archive can be successfully decrypted, the unencrypted backup directory may be removed:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in "${BACKUP_DATE}.tar.gz.enc" -out /tmp/verify.tar.gz
tar -tzf /tmp/verify.tar.gz | head        # smoke test
rm /tmp/verify.tar.gz
rm -rf "${HOME}/Dillweed-Backups/${BACKUP_DATE}"   # only after verification
```

### 4.12 Update the operational log

Append a record of this backup to the operational log (Section 10 of this document).

---

## 5. Restore Procedure

This section describes restoring from a backup created via Section 4. The procedure assumes that the host has either had a fresh install completed (with new keys) or is being rebuilt from bare state, and that you have decided to overlay the previously-backed-up state.

### 5.1 Verify the backup is intact

```bash
BACKUP_DIR=~/Dillweed-Backups/<YYYY-MM-DD>   # adjust to the backup being used
ls -la "${BACKUP_DIR}/keys/"
ls -la "${BACKUP_DIR}/registry/"
ls -la "${BACKUP_DIR}/anthill/"
openssl pkey -in "${BACKUP_DIR}/keys/dnso_private.pem" -noout -text
sqlite3 "${BACKUP_DIR}/registry/registry.db" ".tables"
```

If any of these checks fail, do not proceed with restore. The backup is unusable; the next-most-recent backup should be tried instead.

### 5.2 Stop the running services

```bash
launchctl unload ~/Library/LaunchAgents/com.dillweed.registry.plist
launchctl unload ~/Library/LaunchAgents/com.dillweed.resolver.plist
launchctl unload ~/Library/LaunchAgents/com.dillweed.anthill.plist
```

### 5.3 Restore cryptographic keys (Registry only)

```bash
cp "${BACKUP_DIR}/keys/dnso_private.pem" /usr/local/dillweed/registry/dillweed-registry/keys/
cp "${BACKUP_DIR}/keys/dnso_public.pem"  /usr/local/dillweed/registry/dillweed-registry/keys/
chmod 600 /usr/local/dillweed/registry/dillweed-registry/keys/dnso_private.pem
```

### 5.4 Restore databases

```bash
cp "${BACKUP_DIR}/registry/registry.db" /usr/local/dillweed/registry/dillweed-registry/data/
cp "${BACKUP_DIR}/anthill/anthill.db"   /usr/local/dillweed/anthill/dillweed-anthill/data/
```

### 5.5 Restore the Anthill signal log (if present)

```bash
[ -f "${BACKUP_DIR}/anthill/signals.log" ] && cp "${BACKUP_DIR}/anthill/signals.log" /usr/local/dillweed/anthill/dillweed-anthill/logs/
```

### 5.6 Restore Keychain tokens

```bash
# Remove any tokens generated by a fresh install
security delete-generic-password -a registry-admin -s dillweed-registry 2>/dev/null
security delete-generic-password -a anthill-admin  -s dillweed-anthill  2>/dev/null

# Restore the backed-up tokens
security add-generic-password -a registry-admin -s dillweed-registry -w "$(cat ${BACKUP_DIR}/keychain/registry-admin-token.txt)"
security add-generic-password -a anthill-admin  -s dillweed-anthill  -w "$(cat ${BACKUP_DIR}/keychain/anthill-admin-token.txt)"
```

Note: the launchd plists installed by the fresh install will have embedded the *new* admin tokens, not the restored ones. After a token restore, the plists must be regenerated by re-running the installers with the restored tokens already in Keychain, or by manually editing the plists.

After regenerating or editing the plists, verify the token in the plist matches the restored Keychain token before restarting:

```bash
# Check plist contains a token value (exact env var name may vary by plist version)
grep -A1 "REGISTRY_ADMIN_TOKEN" ~/Library/LaunchAgents/com.dillweed.registry.plist
grep -A1 "ANTHILL_ADMIN_TOKEN"  ~/Library/LaunchAgents/com.dillweed.anthill.plist
```

If the token is not visible with `grep -A1`, open the plist directly and inspect the `EnvironmentVariables` block — the token may be on the same line as the key or formatted differently depending on the plist version.

Compare the values shown against the Keychain query output:

```bash
security find-generic-password -a registry-admin -s dillweed-registry -w
security find-generic-password -a anthill-admin  -s dillweed-anthill  -w
```

They must match. A mismatch means the service will start but all authenticated requests will return 401.

### 5.7 Restart the services

```bash
launchctl load ~/Library/LaunchAgents/com.dillweed.registry.plist
launchctl load ~/Library/LaunchAgents/com.dillweed.resolver.plist
launchctl load ~/Library/LaunchAgents/com.dillweed.anthill.plist
```

### 5.8 Verify the restore

```bash
curl http://localhost:9475/health
curl http://localhost:9474/health
curl http://localhost:9476/health
```

Each should return `"ok"`. If a service does not start, check its error log under `/usr/local/dillweed/logs/` for the cause.

A more rigorous verification: register, resolve, and revoke a test capability per the worked example in the Implementation Guide §07. If all three operations succeed, the restore is functional.

Verify the Resolver is using the restored key:

```bash
curl http://localhost:9474/health | grep -E "dnso_key|configured"
# Expected: "configured": true
```

### 5.9 Update the operational log

Append a record of this restore to the operational log (Section 10).

---

## 6. Clean Reinstall Procedure

This procedure removes the existing installation and replaces it with a fresh install from a new tarball set. It is appropriate when:

- Upgrading to a major-version-jump release where in-place upgrade is not supported
- The deployment has accumulated state from extended experimentation that is no longer wanted
- Recovering from an unknown problem by starting from a known-good state

The procedure assumes a complete backup per Section 4 has been verified.

### 6.1 Pre-flight checks

- Backup completed per Section 4
- Backup verified per Section 5.1
- The new tarballs are in hand, named per the `dillweed-` convention (see Section 2)
- Time budgeted: at least half a day, with no other commitments
- Decision made about whether to restore old keys (option A) or use fresh keys (option B) — see Section 6.7

### 6.2 Stop the running services

```bash
launchctl unload ~/Library/LaunchAgents/com.dillweed.registry.plist
launchctl unload ~/Library/LaunchAgents/com.dillweed.resolver.plist
launchctl unload ~/Library/LaunchAgents/com.dillweed.anthill.plist
```

### 6.3 Run the installers' uninstall flag

Run the uninstaller for all three components. Do not skip any — the uninstaller removes launchd plists and Keychain tokens but deliberately does not delete the installation directories or data files.

```bash
cd /usr/local/dillweed/registry/dillweed-registry && bash install.sh --uninstall
cd /usr/local/dillweed/resolver/dillclaw-resolver && bash install.sh --uninstall
cd /usr/local/dillweed/anthill/dillweed-anthill  && bash install.sh --uninstall
```

Confirm all three launchd entries are gone:

```bash
launchctl list | grep dillweed
# Expected: no output
```

### 6.4 Manually remove the installation directories

This is the destructive step. Do not proceed until backup verification is complete.

```bash
sudo rm -rf /usr/local/dillweed
```

### 6.5 Extract and run the new installers

Before extracting, verify the tarball SHAs against the GitHub Release checksums or release notes. For v1.0.0:

```bash
shasum -a 256 dillweed-registry-v0.2.8.tar.gz
# Expected: f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a

shasum -a 256 dillweed-resolver-v0.1.8.tar.gz
# Expected: 2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a

shasum -a 256 dillweed-anthill-v0.1.5.tar.gz
# Expected: dda1430bc76247f7ad895448d0805451c246707876539145c8736f5e6a79675b
```

Do not proceed if any SHA does not match. A mismatch indicates either a corrupt download or a tampered file. Re-download from the GitHub Release and re-verify before extracting.

Tarballs follow the `dillweed-` prefix convention (see Section 2). Substitute the correct version numbers:

```bash
tar -xzf dillweed-registry-v0.2.8.tar.gz
tar -xzf dillweed-resolver-v0.1.8.tar.gz
tar -xzf dillweed-anthill-v0.1.5.tar.gz
```

**Important:** Run the installer from the *parent* directory of the extracted directory, not from inside it. Running `bash install.sh` from inside `dillweed-registry/` will trigger the cwd-trap check and abort (see INST-001 in Section 8).

```bash
cd dillweed-registry  && bash install.sh && cd ..
cd dillclaw-resolver  && bash install.sh && cd ..
cd dillweed-anthill   && bash install.sh && cd ..
```

Each installer should complete with a verification step confirming the service is running on its assigned port. The Resolver's installer (Step 5) will fetch the DNSO public key live from `https://dillweed.com/dnso_public.pem` and display its SHA for verification (see INST-004 in Section 8). Confirm the displayed SHA matches the canonical trust root:

```
Expected: 909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

### 6.6 Verify the fresh installation

```bash
curl http://localhost:9475/health
curl http://localhost:9474/health
curl http://localhost:9476/health
```

Each should return `"ok"`. Run the test suites per Section 3 to confirm functional behavior.

### 6.7 Choose the trust-root strategy

After the fresh install completes, the deployment is running with fresh keys (a new DNSO Ed25519 keypair generated by `setup.js` during install). At this point you must decide:

**Option A — Adopt the fresh keys as the new operational identity.** Operationally simpler, but it breaks signature continuity: records signed under the previous key will no longer verify under the new key. The backed-up old keys go into long-term archive as historical record, not as operational material. Any future canonical-public-deployment work would start from these new keys, or from another freshly generated keypair, as appropriate.

**Option B — Restore the previously-backed-up keys (trust-root migration).** Preserves signature continuity. Required if you have published the previous public key anywhere that downstream verifiers depend on, or if the database contains records that should remain verifiable under the original key.

For the founding-phase local reference deployment, option A is operationally simpler unless there is a specific reason to preserve signature continuity. Option B is required when continuity of existing signatures matters. The choice should be recorded in the operational log.

**Option B step-by-step procedure:**

This procedure was exercised during the v1.0.0 install-testing session on 2026-05-17 and confirmed to produce a fully-functional deployment with 79/79 Registry tests passing.

1. Confirm the fresh install is running cleanly (all three `/health` endpoints return `"ok"`) before touching any keys.

2. Stop the Registry service:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.dillweed.registry.plist
   ```

3. Remove the freshly-generated keypair:
   ```bash
   rm /usr/local/dillweed/registry/dillweed-registry/keys/dnso_private.pem
   rm /usr/local/dillweed/registry/dillweed-registry/keys/dnso_public.pem
   ```

4. Restore the backed-up keypair:
   ```bash
   BACKUP_DIR=~/Dillweed-Backups/<YYYY-MM-DD>   # adjust to the backup being used
   cp "${BACKUP_DIR}/keys/dnso_private.pem" /usr/local/dillweed/registry/dillweed-registry/keys/
   cp "${BACKUP_DIR}/keys/dnso_public.pem"  /usr/local/dillweed/registry/dillweed-registry/keys/
   chmod 600 /usr/local/dillweed/registry/dillweed-registry/keys/dnso_private.pem
   ```

5. Verify the restored key matches the canonical trust root:
   ```bash
   openssl pkey -in /usr/local/dillweed/registry/dillweed-registry/keys/dnso_public.pem \
     -pubin -outform DER | sha256sum
   # Expected: 909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
   ```
   Do not restart the Registry if this SHA does not match. The backup keypair may be from the wrong generation.

6. Restart the Registry:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.dillweed.registry.plist
   ```

7. Verify the Registry is running and using the restored key:
   ```bash
   curl http://localhost:9475/health
   # Check that startup log does not show key-mismatch advisory
   tail -20 /usr/local/dillweed/logs/registry.log
   ```

8. Verify signature continuity on an existing record (if the registry database was also restored):
   ```bash
   curl http://localhost:9475/verify/research.market.intel.vendors
   # Expected: "signature_valid": true
   ```
   If `signature_valid` is `false`, the restored key does not match the key that signed the records in the restored database. This indicates a backup-set mismatch — the keys and database must come from the same backup date.

9. The Resolver fetches the DNSO public key from `https://dillweed.com/dnso_public.pem` at install time. As long as the published key at that URL matches the restored keypair, the Resolver requires no changes. The Resolver's health endpoint confirms key configuration:
   ```bash
   curl http://localhost:9474/health | grep -E "dnso_key|configured"
   ```

10. Run the full test suite against the restored deployment:
    ```bash
    REGISTRY_ADMIN_TOKEN=$(security find-generic-password -a registry-admin -s dillweed-registry -w) \
      bash /usr/local/dillweed/registry/dillweed-registry/test.sh
    ```
    All tests should pass. A `signature_valid: false` failure on any verify test indicates a key-database mismatch (step 8 above).

### 6.8 Update the operational log

Append a record of this reinstall to the operational log (Section 10), including which trust-root strategy was chosen and the rationale.

---

## 7. In-Place Upgrade Procedure

This procedure applies a new version of one or more services without removing the installation directory or losing local state (keys, databases, logs, Keychain tokens).

### When to use in-place upgrade vs clean reinstall

**Use in-place upgrade when:**

- The new version is a minor revision (e.g., v0.2.8 → v0.2.9) with no schema or protocol-breaking changes
- The release notes do not indicate a clean-reinstall requirement
- Local state (registered capabilities, accumulated signals) should be preserved

**Use clean reinstall (Section 6) when:**

- The new version involves database schema changes
- The release notes specifically recommend a clean reinstall
- The host has been operating long enough that a fresh start is desirable for diagnostic clarity

### 7.1 Pre-flight backup

Run Section 4 (Backup Procedure) before attempting any in-place upgrade. In-place upgrades have the highest risk of introducing state inconsistencies; backup is the only protection against unrecoverable failure.

### 7.2 Run the new installer

The installers in this stack are designed to detect existing installations and upgrade in place. They stop the running service, preserve `keys/` and `data/` directories, copy new source files, re-run `npm install`, regenerate the launchd plist, and restart the service.

Extract the tarball from the *parent* directory of the install location, not from inside it (see INST-001):

```bash
tar -xzf dillweed-registry-v<NEW>.tar.gz
cd dillweed-registry
bash install.sh
```

Repeat for the resolver and Anthill as needed. The installers may be run in any order; services may be upgraded independently.

### 7.3 Verify the upgrade

```bash
curl http://localhost:9475/health
curl http://localhost:9474/health
curl http://localhost:9476/health
```

Each should return `"ok"`. Check that the version reported by each service's startup banner matches the expected new version:

```bash
tail -50 /usr/local/dillweed/logs/registry.log | grep -i version
```

Run the test suites per Section 3 to confirm functional behavior after upgrade.

### 7.4 Update the operational log

Append a record of this upgrade to the operational log (Section 10), noting which services were upgraded and from-to versions.

---

## 8. Install-Testing Findings

This section records findings surfaced during the v1.0.0 install-testing session on 2026-05-17 on dill-p-001. Each entry includes the symptom observed, root cause, fix applied, and any gotcha relevant to future operations.

All six incidents listed here are **CLOSED** as of v1.0.0.

---

### INST-001 (LOW) — Registry install.sh cwd-trap

**Component:** Registry  
**Fixed in:** v0.2.8

**Symptom:** Running `bash install.sh` from inside the `dillweed-registry/` directory produced:
```
cp: source and destination are identical
```
and the install failed or produced a corrupt state.

**Root cause:** `install.sh` copies source files from `$SRC_DIR` to `$INSTALL_DIR`. When invoked from inside the source directory, `$SRC_DIR` and `$INSTALL_DIR` resolve to the same path, causing `cp` to attempt a self-copy.

**Fix:** `install.sh` now checks whether `$SRC_DIR == $INSTALL_DIR` immediately after the `SRC_DIR` assignment and aborts with a clear recovery message if they match.

**Gotcha:** Always run `bash install.sh` from the *parent* directory of the extracted tarball, not from inside it. The correct pattern is:
```bash
tar -xzf dillweed-registry-vX.Y.Z.tar.gz
cd dillweed-registry
bash install.sh
```
This issue applies to all three installers by the same logic, even though it was only explicitly caught and fixed in the Registry. The same discipline applies to the Resolver and Anthill installers.

---

### INST-004 (HIGH) — Resolver shipped wrong dnso_public.pem; install.sh did not copy it

**Component:** DillClaw Resolver  
**Fixed in:** v0.1.8

**Symptom:** After installing the Resolver, `curl http://localhost:9474/health` reported `"dnso_key": {"configured": false}`. Signature verification for all capability records returned `signature_valid: false`. The Resolver was operating without a trust root.

**Root cause:** The tarball bundled a `dnso_public.pem` build artifact (a test key generated during development, not the canonical DNSO key). The `install.sh` script did not include a step to copy the key to the install location. As a result, the installed Resolver had neither the correct key nor any key at all.

**Fix:** The bundled `dnso_public.pem` was removed from the tarball entirely. `install.sh` gained a new Step 5 ("DNSO Public Key") that fetches the canonical key live from `https://dillweed.com/dnso_public.pem` with a 30-second timeout, validates it as PEM format, and displays its SHA256 for operator verification alongside the expected canonical SHA. The fetch URL is configurable via the `DNSO_PUBLIC_KEY_URL` environment variable. If the fetch fails, the installer aborts with recovery instructions.

**Gotcha:** The Resolver install requires network connectivity to `dillweed.com`. If installing in an air-gapped environment, set `DNSO_PUBLIC_KEY_URL` to a local mirror of the key file before running `install.sh`. Verify the SHA after install regardless of source:
```
Expected SHA: 909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

---

### INST-005 (MEDIUM) — Registry test.sh produced partial results in token-protected deployments

**Component:** Registry  
**Fixed in:** v0.2.8

**Symptom:** Running `bash test.sh` against a token-protected Registry deployment (i.e., `REGISTRY_ADMIN_TOKEN` is set in the environment) produced only 41/79 tests passing. The failing tests were all write-endpoint tests (register, revoke, promote) which require the `Authorization: Bearer <token>` header.

**Root cause:** `test.sh` had no auth-token support. The `run()` helper function sent all requests without authentication headers. Write endpoints returned 401 Unauthorized, which the test harness counted as failures.

**Fix:** Two-pass fix. First pass: added `TOKEN`/`AUTH_HEADER` declarations at the top of `test.sh`; modified `run()` helper to include the Bearer header when `REGISTRY_ADMIN_TOKEN` is set. This raised the pass rate to 66/79. Second pass: patched 13 inline `curl` calls that bypassed the `run()` helper (used for response-body inspection) to include `${AUTH_HEADER:+-H "$AUTH_HEADER"}`. Final result: 79/79 pass.

**Gotcha:** Always pass the admin token when running the Registry test suite:
```bash
REGISTRY_ADMIN_TOKEN=$(security find-generic-password -a registry-admin -s dillweed-registry -w) \
  bash test.sh
```
Running without the token on a token-protected deployment will silently produce ~52% pass rate, which can be mistaken for a real regression. The same pattern applies to the Anthill test suite (`ANTHILL_ADMIN_TOKEN`). See Section 3 for the canonical test-suite invocation commands.

---

### INST-006 (LOW) — Anthill test.sh produced sequence-collision failures after in-place upgrades

**Component:** Dillweed Anthill  
**Fixed in:** v0.1.5

**Symptom:** After an in-place upgrade from v0.1.4 to v0.1.5 (or when running `test.sh` on a non-fresh deployment), 8 tests failed with sequence-violation errors rather than the expected test outcomes. The baseline on a preserved v0.1.4 installation was 50/58 pass.

**Root cause:** `test.sh` used hardcoded `originating_node` values (e.g., `test-resolver-001`, `as002-node-A`). The Anthill service maintains a `node_sequences` table that records each node's high-water-mark sequence number for replay protection. After an in-place upgrade, the table from the previous install session was preserved. The test's hardcoded node names collided with existing sequence entries, causing the sequence-monotonicity check to reject test signals that would have been accepted on a clean slate.

**Fix:** `test.sh` now appends a `NODE_SUFFIX` (derived from the existing `NONCE_PREFIX` random value, which is freshly generated each test run) to all 25 occurrences of the 8 distinct hardcoded node names. Each test run uses unique node identifiers and cannot collide with prior runs' sequence state.

**Gotcha:** Two hardcoded node names were deliberately *not* suffixed: `ANTHILL_AGGREGATOR` (the reserved-name rejection test, which must use the literal reserved name to test the rejection) and `test` (the auth-enforcement test, which never reaches sequence-check logic). If sequence-collision failures reappear in the Anthill test suite, check whether `node_sequences` table state from a prior session is interfering before assuming a code regression.

---

### INST-008 — Resolver tarball used dillclaw- prefix instead of dillweed-

**Component:** DillClaw Resolver  
**Closed:** At v1.0.0 publication (2026-05-18) for external tarball naming

**Symptom:** The Resolver tarball built during the patch round was named `dillclaw-resolver-v0.1.8.tar.gz`. The README, release notes, and the naming convention established for the other two components all used the `dillweed-` prefix.

**Root cause:** The on-disk filename in `~/Tarballs/production/` from earlier patch-round builds retained the historical `dillclaw-` name. The v1.0.0 GitHub Release was initially uploaded using that filename.

**Fix:** The GitHub Release asset was deleted and re-uploaded as `dillweed-resolver-v0.1.8.tar.gz`. The file contents are bit-identical to the original (SHA preserved).

**Residual:** The tarball still extracts to a `dillclaw-resolver/` directory (the component-internal name). This is cosmetically inconsistent with the `dillweed-resolver` tarball filename but is not a functional issue. Queued as cosmetic cleanup for a future release.

**Convention going forward:** All release tarballs use the `dillweed-` prefix regardless of the component's internal directory name:
```
dillweed-registry-vX.Y.Z.tar.gz   → extracts to dillweed-registry/
dillweed-resolver-vX.Y.Z.tar.gz   → extracts to dillclaw-resolver/   (cosmetic mismatch, known)
dillweed-anthill-vX.Y.Z.tar.gz    → extracts to dillweed-anthill/
```

---

### INST-010 — Keychain admin token query syntax not documented

**Component:** All (Registry, Anthill)  
**Closed:** By this runbook section and Section 3

**Symptom:** No documented reference for how to query admin tokens from the macOS Keychain outside of the `start.sh` launcher scripts. Operators had to locate the syntax in `start.sh` source code or rely on session memory.

**Root cause:** The Keychain integration was implemented during development without corresponding runbook documentation.

**Fix:** Canonical token query syntax documented in Section 3 of this runbook ("Retrieving the admin tokens") and in the test-suite invocation commands. For reference, the canonical queries are:

```bash
# Registry admin token
security find-generic-password -a registry-admin -s dillweed-registry -w

# Anthill admin token
security find-generic-password -a anthill-admin -s dillweed-anthill -w
```

The `-a` flag specifies the Keychain account name; `-s` specifies the Keychain service name; `-w` prints the password (token) to stdout without other metadata. These are the same service/account names used by `install.sh` when storing tokens at install time.

---

## 9. Emergency Procedures

This section is sparse in the first version of the runbook because most emergency scenarios have not yet been encountered in practice. Items below are skeletal and should be expanded as scenarios surface.

### Published public key mismatch

If the SHA of the local Registry public key does not match `https://dillweed.com/dnso_public.pem`, or if the Resolver reports `dnso_key.configured: false` after a restore:

1. Stop the Resolver immediately — it cannot verify signatures reliably in this state:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.dillweed.resolver.plist
   ```

2. Compare the local key SHA to the published canonical:
   ```bash
   # Local key
   openssl pkey -in /usr/local/dillweed/registry/dillweed-registry/keys/dnso_public.pem \
     -pubin -outform DER | sha256sum
   # Published canonical
   curl -s https://dillweed.com/dnso_public.pem | openssl pkey -pubin -outform DER | sha256sum
   # Both should be: 909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
   ```

3. Verify a known signed record through the Registry (not the Resolver):
   ```bash
   curl http://localhost:9475/verify/research.market.intel.vendors
   # Expected: "signature_valid": true
   ```

4. Determine the mismatch source before taking any further action:
   - **Local key drift** — the file at `keys/dnso_public.pem` has changed or been replaced; restore from backup.
   - **Published key drift** — `dillweed.com/dnso_public.pem` has changed; investigate whether a key rotation was performed and whether the local key needs to be updated or the published key needs to be corrected.
   - **Database/key backup mismatch** — the keys and database were restored from different backup dates; they must be from the same backup set to be coherent.

5. Do not re-sign records, rotate keys, or restore from an alternate backup until the mismatch source is understood. Each of those actions can make the situation harder to diagnose.

6. Record the incident in the operational log regardless of resolution path.

### Key compromise suspected

If the DNSO private key is suspected compromised:

1. Treat as an incident under DNSO Operations Charter §6.3 (Emergency Revocation authority).
2. Stop all running services immediately.
3. Generate a new keypair on a clean machine, in a clean environment.
4. Publish the new public key at `dillweed.com/dnso_public.pem`.
5. Re-sign all active capability records under the new key (if any are operationally relied upon).
6. Disclose the key compromise publicly within 48 hours per Continuity Protocol §08.
7. Record the incident in detail in the operational log.

Note: in the current local reference deployment, key compromise has limited blast radius because no external parties are relying on the local key. The procedure becomes consequential when public canonical infrastructure exists.

### Database corruption

If the Registry or Anthill database becomes corrupted:

1. Stop the affected service.
2. Verify the corruption (`sqlite3 <file> .tables` failing or producing nonsense output).
3. Restore the database from the most recent good backup per Section 5.
4. Restart the service and verify.
5. Investigate the root cause (filesystem error, disk failure, software bug) before resuming normal operation.

### Host unavailability

If dill-p-001 becomes unavailable (hardware failure, OS corruption, theft):

1. Replacement host is provisioned with fresh macOS.
2. Backup material is recovered from the offline copy.
3. The reference implementation tarballs are re-obtained from the GitHub Release at https://github.com/Dillweed-Namespace/dillweed-namespace.
4. Section 6 (Clean Reinstall) is executed, followed by Section 5 (Restore) with the recovered backup.
5. The recovery is documented in detail in the operational log.

If the continuity trustee is performing this recovery rather than the founding steward, the procedure is the same, performed under the authority described in Continuity Protocol §4.

---

## 10. Operational Log

This section is a running record of significant operational events affecting the local reference deployment. Each entry is appended; entries are not modified after the fact (matching the append-only audit discipline used throughout the Dillweed stack).

Note: this is application-level append-only practice. The Markdown file itself is not technically immutable — it can be edited like any text file. The convention is honored by discipline, not enforcement.

### Entry template

```
### YYYY-MM-DD — <Event Summary>

**Operator:** <name>
**Procedure executed:** <Section reference>
**Pre-condition versions:** <e.g., Registry v0.2.7, Resolver v0.1.7, Anthill v0.1.4>
**Post-condition versions:** <e.g., Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.5>
**Backup location:** <path>
**Trust-root strategy (for reinstalls):** <A or B>
**Anomalies encountered:** <description, or "none">
**Notes:** <free-form>
```

### Entries

```
### 2026-05-13 — Runbook v1 created

**Operator:** Richard McClelland
**Procedure executed:** N/A (documentation creation)
**Pre-condition versions:** N/A
**Post-condition versions:** N/A
**Notes:** First version of this runbook drafted. Covers backup,
restore, clean reinstall, in-place upgrade, and skeletal emergency
procedures. Document scope is limited to the local reference
deployment on dill-p-001. Expected to evolve as operational
experience surfaces additional scenarios.
```

```
### 2026-05-17 — v1.0.0 install-testing session; patch round (INST-001/004/005/006/008)

**Operator:** Richard McClelland
**Procedure executed:** Sections 6 (Clean Reinstall) and 7 (In-Place Upgrade),
multiple passes; Option B trust-root migration (Section 6.7)
**Pre-condition versions:** Registry v0.2.7, Resolver v0.1.7, Anthill v0.1.4
**Post-condition versions:** Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.5
**Backup location:** On-disk backup taken prior to clean-install pass
**Trust-root strategy:** Option B — backed-up keypair restored after clean
install to preserve signature continuity; canonical public key SHA confirmed:
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
**Anomalies encountered:** INST-001 (Registry cwd-trap), INST-004 (Resolver
missing key), INST-005 (Registry test.sh auth gap, 41/79 before fix),
INST-006 (Anthill sequence collisions, 50/58 before fix), INST-008 (Resolver
tarball naming). All closed in this session via patch tarballs.
**Notes:** Three install modes exercised: in-place upgrade, uninstall, and
clean install. Final test results after patches: Registry 79/79, Resolver
65/65 (+ 29/29 unit), Anthill 57/58 (AS-006 pre-existing test-script issue,
not a server defect — tracked as INST-013, deferred to v0.1.6).
```

```
### 2026-05-18 — v1.0.0 published to GitHub; runbook updated

**Operator:** Richard McClelland
**Procedure executed:** N/A (publication event; runbook update)
**Pre-condition versions:** Registry v0.2.8, Resolver v0.1.8, Anthill v0.1.5
**Post-condition versions:** unchanged
**Notes:** v1.0.0 published to https://github.com/Dillweed-Namespace/dillweed-namespace.
Commit 52069ac. CONV-003 tarball-publication gate satisfied and closed.
Runbook updated to reflect v1.0.0 deployment inventory, INST findings (Section 8),
Option B trust-root migration procedure (Section 6.7), Keychain token documentation
(INST-010 closure), and tarball naming convention (INST-008 closure).
```

---

## 11. Restore-Documentation Template

This is a template to copy into `README-restore.txt` within each backup directory, customized with the specific backup's details.

```text
Dillweed Local Reference Deployment — Backup
============================================

Backup date:        YYYY-MM-DD
Backup operator:    Richard McClelland
Source host:        dill-p-001
Source service versions:
                    Registry  vX.Y.Z
                    Resolver  vX.Y.Z
                    Anthill   vX.Y.Z

Contents:

  keys/
      dnso_private.pem            DNSO Ed25519 private signing key.
                                  This is the most important file in
                                  this backup. Never share without
                                  explicit authorization.

      dnso_public.pem             Corresponding public key.
                                  SHA256 of DER-encoded form:
                                  909891e92cfa7362ee88fd75e85f379a
                                  317680a2c987fc4d88ecae150deb6f33
                                  (verify with: openssl pkey -pubin
                                  -outform DER | sha256sum)

  registry/
      registry.db                 Registry SQLite database. Contains
                                  capability records and append-only
                                  registration log.

  anthill/
      anthill.db                  Anthill SQLite database (signals).
      signals.log                 (optional) Append-only signal log.

  keychain/
      registry-admin-token.txt    Admin token for Registry write
                                  endpoints. 64 hex chars.
      anthill-admin-token.txt     Admin token for Anthill signal
                                  submission. 64 hex chars.

  logs/                           Service operational logs at time
                                  of backup.

  plists/                         launchd plists at time of backup.
                                  Reference only — these are
                                  regenerated by the installer on
                                  reinstall.

Restoration:

  See Section 5 (Restore Procedure) of the runbook document
  ("dillweed-operations-runbook.md") for the procedure to restore
  this backup. The runbook itself is normally kept under separate
  custody from this backup; if you have this backup but not the
  runbook, contact the founding steward or continuity trustee at
  the contact information on dillweed.com.

  For post-clean-install trust-root restoration, see Section 6.7
  (Option B trust-root migration procedure).

Trademark and stewardship notice:

  This backup contains operational material of the Dillweed
  Namespace Project. The DNSO signing key, in particular, is the
  cryptographic root of trust for any Dillweed Namespace
  deployment that has used it. Possession of this material does
  not constitute authority over the namespace; that authority is
  governed by the Continuity Protocol (GSP-01) and the Governance
  Framework, both published at dillweed.com.
```

---

## 12. Operational Safety — Do Not

The following actions have caused or could cause unrecoverable damage to the local reference deployment. They are listed here because each is plausible under time pressure or unfamiliar conditions.

```
Do not copy dnso_private.pem to any web-accessible directory.
Do not publish backup archives or include key material in version-controlled commits.
Do not run the clean reinstall procedure (Section 6.4) before completing and verifying a backup.
Do not restore keys and databases from different backup dates — they must be from the same backup set.
Do not treat a fresh keypair as equivalent to the previous trust root for records already signed.
Do not run test suites against the deployment without understanding that they register, promote,
    and revoke real records. The test suites restore to known state on completion but write to the
    live database during the run.
Do not rotate keys casually. Key rotation invalidates all existing signatures unless records are
    re-signed under the new key. Refer to Section 9 (Published public key mismatch) before
    touching key material in a non-standard way.
Do not proceed with any destructive operation if the backup SHA check from Section 4.2 fails.
    An unreadable backup is not a backup.
```

---

## 13. Document Maintenance

This runbook is expected to evolve. Significant changes to operational practice should be reflected in this document, with the corresponding entry in the operational log (Section 10) noting that the runbook was revised.

Minor textual improvements (typos, clarifications) do not require log entries.

Substantive changes (new procedures, modified backup destinations, new emergency response actions) should:

1. Be made in this document
2. Be noted in the operational log
3. Be communicated to the continuity trustee if and when one is designated

The continuity trustee should receive an updated copy of this runbook as part of the sealed recovery materials described in Continuity Protocol §5 (Sealed Recovery Materials).

---

*Dillweed Local Reference Deployment — Operations Runbook*
*Version 5, May 2026*
*Operational substrate for dill-p-001 — not a published Dillweed specification*
*© 2026 Richard McClelland*
