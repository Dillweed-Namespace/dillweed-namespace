#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  DillClaw Resolver — DNSO Key Generation & Registry Signing
//
//  Generates an Ed25519 keypair and re-signs the sample registry.json with
//  real cryptographic signatures. After running this once, the resolver will
//  perform real Ed25519 verification instead of falling back to structural
//  checks. Zero external dependencies — pure Node.js built-ins only.
//
//  Usage:  node tools/generate-keys.js
//
//  Output files (in the resolver root directory):
//    dnso_private.pem   — signing key (KEEP SECRET; not served anywhere)
//    dnso_public.pem    — verification key (what the resolver loads)
//    registry.json      — updated in place with real signatures
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const ROOT          = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'registry.json');
const PRIV_PATH     = path.join(ROOT, 'dnso_private.pem');
const PUB_PATH      = path.join(ROOT, 'dnso_public.pem');

// Canonical JSON for signature payload — must match server.js and the
// Registry v0.1.4 / v0.2.7 implementation exactly. Only the ten signed
// top-level fields are included; nested objects emitted as stored.
// Aligned with the Registry signing profile per round-1 external review
// (RS-003). Locally-signed records produced by this tool must verify
// against records signed by the Registry server using the same scheme.
function canonicalJSON(record) {
  const fields = ['description','endpoint','input_schema','last_updated','name',
                  'output_schema','permissions','protocol','trust_tier','version'];
  const obj = {};
  for (const f of fields) { if (record[f] !== undefined) obj[f] = record[f]; }
  return JSON.stringify(obj);
}

function sign(record, privateKey) {
  const payload = Buffer.from(canonicalJSON(record), 'utf8');
  const sig     = crypto.sign(null, payload, { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return 'dnso_v1_' + sig.toString('base64url');
}

function keysExist() {
  return fs.existsSync(PRIV_PATH) && fs.existsSync(PUB_PATH);
}

function loadOrCreateKeys() {
  if (keysExist()) {
    console.log(`  ℹ  Existing keys found — reusing:`);
    console.log(`       ${PRIV_PATH}`);
    console.log(`       ${PUB_PATH}`);
    const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIV_PATH));
    const publicKey  = crypto.createPublicKey(fs.readFileSync(PUB_PATH));
    return { privateKey, publicKey, created: false };
  }

  console.log(`  ⚙  Generating Ed25519 keypair...`);
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pubPem  = publicKey.export({  type: 'spki',  format: 'pem' });

  fs.writeFileSync(PRIV_PATH, privPem, { mode: 0o600 });
  fs.writeFileSync(PUB_PATH,  pubPem,  { mode: 0o644 });

  console.log(`  ✓  Wrote ${PRIV_PATH}  (mode 0600)`);
  console.log(`  ✓  Wrote ${PUB_PATH}  (mode 0644)`);

  return { privateKey, publicKey, created: true };
}

function signRegistry(privateKey, publicKey) {
  const raw    = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const records = parsed.capabilities || [];

  if (records.length === 0) {
    console.log(`  ⚠  No capabilities found in ${REGISTRY_PATH}`);
    return;
  }

  console.log(`  ⚙  Signing ${records.length} capability record(s)...`);

  let signed = 0;
  let skipped = 0;
  for (const record of records) {
    // Records with explicitly-null signatures are intentionally kept
    // unsigned (used to exercise the resolver's allow_unsigned policy
    // path per Resolver Spec §6.1). The tool respects null as a
    // "keep unsigned" marker rather than overwriting it.
    if (record.signature === null) {
      skipped++;
      continue;
    }
    record.signature = sign(record, privateKey);

    // Verify round-trip before writing — defensive check using the same
    // canonicalization and signature encoding as the new sign() function.
    // Updated post-round-1 review (RS-003): base64url not hex, ieee-p1363.
    const payload = Buffer.from(canonicalJSON(record), 'utf8');
    const sigB64  = record.signature.replace(/^dnso_v1_/, '');
    const sigBuf  = Buffer.from(sigB64, 'base64url');
    const ok = crypto.verify(null, payload, { key: publicKey, dsaEncoding: 'ieee-p1363' }, sigBuf);
    if (!ok) {
      throw new Error(`Round-trip verification failed for "${record.name}"`);
    }
    signed++;
  }

  parsed._updated = new Date().toISOString().slice(0, 10);

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(parsed, null, 2) + '\n');
  console.log(`  ✓  Signed and verified ${signed} record(s)` +
              (skipped > 0 ? ` (skipped ${skipped} with explicit null signature)` : ''));
  console.log(`  ✓  Updated ${REGISTRY_PATH}`);
}

function main() {
  console.log('');
  console.log('  DillClaw — DNSO Key Generation & Registry Signing');
  console.log('  ─────────────────────────────────────────────────');
  console.log('');

  const { privateKey, publicKey, created } = loadOrCreateKeys();
  signRegistry(privateKey, publicKey);

  console.log('');
  console.log('  Done. Next steps:');
  console.log('    1. Start the resolver:  ./start.sh');
  console.log('    2. Confirm verification: look for "DNSO key  configured" at startup');
  console.log('    3. Run tests:           bash test.sh');
  console.log('');
  console.log('  Security notes:');
  console.log('    • dnso_private.pem is the DNSO signing key. Keep it secret.');
  console.log('    • dnso_public.pem is safe to distribute — it is what relying');
  console.log('      parties use to verify that capability records came from the DNSO.');
  if (created) {
    console.log('    • In a production DNSO deployment, the private key is held in an HSM');
    console.log('      or equivalent; this reference implementation uses a local PEM file.');
  }
  console.log('');
}

try { main(); }
catch (e) {
  console.error(`\n  ERROR: ${e.message}\n`);
  process.exit(1);
}
