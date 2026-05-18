#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Dillweed Registry — Planned Key Rotation Tool
//  Registry Specification v0.1.4 §5.6 — Planned Key Rotation
//
//  This tool performs a DNSO Ed25519 keypair rotation with an overlap window,
//  as specified in §5.6. It is DISTINCT from emergency keypair reset:
//
//    - Emergency reset (private key lost or compromised): delete keys/ and
//      run `node setup.js` — all existing signatures become unverifiable.
//    - Planned rotation (routine hygiene): this tool — prior key is preserved,
//      records are re-signed under the new key, and resolvers get a defined
//      overlap window (≥30 days recommended) to refresh their cached key.
//
//  Usage:
//
//    node rotate-key.js --begin [--overlap-days=30]
//        Generate a new keypair, move the current public key to
//        keys/dnso_public_previous.pem, re-sign every active record with the
//        new private key, and log the rotation_started entry to the audit
//        trail. The server will begin serving the previous key from
//        /pubkey?previous=true automatically.
//
//    node rotate-key.js --status
//        Report whether an overlap window is currently active and, if so,
//        when it was opened and when it is scheduled to close.
//
//    node rotate-key.js --finalize
//        Close the overlap window. Deletes keys/dnso_public_previous.pem and
//        logs the rotation_finalized entry. Run this only after the overlap
//        window (minimum 30 days recommended) has elapsed AND all active
//        records have been re-signed under the new key.
//
//  Per spec: "The overlap window start and end dates must be disclosed
//  publicly and logged to the registration audit trail."
// ─────────────────────────────────────────────────────────────────────────────

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DB_PATH              = path.join(__dirname, 'data', 'registry.db');
const KEYS_DIR             = path.join(__dirname, 'keys');
const PRIVKEY_PATH         = path.join(KEYS_DIR, 'dnso_private.pem');
const PUBKEY_PATH          = path.join(KEYS_DIR, 'dnso_public.pem');
const PRIVKEY_PREV_PATH    = path.join(KEYS_DIR, 'dnso_private_previous.pem');
const PUBKEY_PREV_PATH     = path.join(KEYS_DIR, 'dnso_public_previous.pem');
const ROTATION_MARKER_PATH = path.join(KEYS_DIR, 'rotation.json');

const MIN_OVERLAP_DAYS = 30;  // Spec §5.6 recommended minimum

// ── Guards ────────────────────────────────────────────────────────────────────

let Database;
try { Database = require('better-sqlite3'); }
catch { die('better-sqlite3 not installed. Run: npm install'); }

function die(msg) { console.error('\n  ERROR: ' + msg + '\n'); process.exit(1); }
function ok(msg)   { console.log('  ✓  ' + msg); }
function warn(msg) { console.log('  ⚠  ' + msg); }
function info(msg) { console.log('  ' + msg); }

// ── Canonical JSON (mirrors server.js §5.2) ──────────────────────────────────

function canonicalJSON(record) {
  const fields = ['description','endpoint','input_schema','last_updated','name',
                  'output_schema','permissions','protocol','trust_tier','version'];
  const obj = {};
  for (const f of fields) { if (record[f] !== undefined) obj[f] = record[f]; }
  return JSON.stringify(obj);
}

function sign(record, privateKeyPem) {
  const payload = canonicalJSON(record);
  const sig = crypto.sign(null, Buffer.from(payload),
    { key: privateKeyPem, dsaEncoding: 'ieee-p1363' });
  return 'dnso_v1_' + sig.toString('base64url');
}

function tryParse(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }

// ── Arg parsing ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function hasFlag(f) { return args.includes(f); }
function getOpt(name, def) {
  const prefix = '--' + name + '=';
  for (const a of args) if (a.startsWith(prefix)) return a.slice(prefix.length);
  return def;
}

// ── Commands ──────────────────────────────────────────────────────────────────

if (hasFlag('--status')) return cmdStatus();
if (hasFlag('--begin'))  return cmdBegin();
if (hasFlag('--finalize')) return cmdFinalize();

// No recognized command
console.log('');
console.log('  Dillweed Registry — Key Rotation Tool (Spec v0.1.4 §5.6)');
console.log('');
console.log('  Commands:');
console.log('    node rotate-key.js --status');
console.log('    node rotate-key.js --begin [--overlap-days=30]');
console.log('    node rotate-key.js --finalize');
console.log('');
console.log('  Run with no flags to see this help.');
console.log('');
process.exit(0);

// ── --status ──────────────────────────────────────────────────────────────────

function cmdStatus() {
  console.log('\n  Dillweed Registry — Key Rotation Status\n');

  if (!fs.existsSync(PUBKEY_PATH)) {
    warn('No active public key. Run: node setup.js');
    return;
  }
  ok(`Active public key:   ${PUBKEY_PATH}`);

  if (!fs.existsSync(PUBKEY_PREV_PATH)) {
    info('No previous public key on disk — no overlap window is active.');
    console.log('');
    return;
  }

  ok(`Previous public key: ${PUBKEY_PREV_PATH}`);

  if (fs.existsSync(ROTATION_MARKER_PATH)) {
    try {
      const marker = JSON.parse(fs.readFileSync(ROTATION_MARKER_PATH, 'utf8'));
      console.log('');
      info(`Overlap started:  ${marker.started_at}`);
      info(`Overlap ends:     ${marker.ends_at}`);
      info(`Overlap days:     ${marker.overlap_days}`);
      info(`Records resigned: ${marker.records_resigned}`);
      const now = new Date();
      const endsAt = new Date(marker.ends_at);
      const msRemaining = endsAt.getTime() - now.getTime();
      if (msRemaining > 0) {
        const daysRemaining = Math.ceil(msRemaining / (1000*60*60*24));
        console.log('');
        warn(`${daysRemaining} day(s) remaining in overlap window.`);
        warn('Run `node rotate-key.js --finalize` only after the window closes.');
      } else {
        console.log('');
        warn('Overlap window has elapsed. Safe to run: node rotate-key.js --finalize');
      }
    } catch (e) {
      warn(`Rotation marker unreadable: ${e.message}`);
    }
  } else {
    warn('Previous public key exists but no rotation.json marker found.');
  }
  console.log('');
}

// ── --begin ───────────────────────────────────────────────────────────────────

function cmdBegin() {
  console.log('\n  Dillweed Registry — Begin Planned Key Rotation\n');

  if (!fs.existsSync(DB_PATH))      die('Database not found. Run: node setup.js');
  if (!fs.existsSync(PRIVKEY_PATH)) die('Private key not found. Run: node setup.js');
  if (fs.existsSync(PUBKEY_PREV_PATH)) {
    die('An overlap window is already active (keys/dnso_public_previous.pem exists).\n' +
        '  Finalize the current rotation before beginning a new one:\n' +
        '    node rotate-key.js --status\n' +
        '    node rotate-key.js --finalize');
  }

  const overlapDays = parseInt(getOpt('overlap-days', String(MIN_OVERLAP_DAYS)), 10);
  if (!Number.isFinite(overlapDays) || overlapDays < MIN_OVERLAP_DAYS) {
    die(`--overlap-days must be a whole number ≥ ${MIN_OVERLAP_DAYS} (Spec §5.6 recommended minimum).`);
  }

  // Preserve current keys
  fs.copyFileSync(PUBKEY_PATH,  PUBKEY_PREV_PATH);
  fs.copyFileSync(PRIVKEY_PATH, PRIVKEY_PREV_PATH);
  fs.chmodSync(PRIVKEY_PREV_PATH, 0o600);
  ok(`Preserved previous public key  → ${PUBKEY_PREV_PATH}`);
  ok(`Preserved previous private key → ${PRIVKEY_PREV_PATH} (mode 600)`);

  // Generate new keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  });
  fs.writeFileSync(PRIVKEY_PATH, privateKey, { mode: 0o600 });
  fs.writeFileSync(PUBKEY_PATH,  publicKey);
  ok('Generated new Ed25519 keypair');
  ok(`New private key → ${PRIVKEY_PATH}  (mode 600 — keep secret)`);
  ok(`New public key  → ${PUBKEY_PATH}   (publish at dillweed.com/dnso_public.pem)`);

  const newPrivateKeyPem = fs.readFileSync(PRIVKEY_PATH, 'utf8');

  // Re-sign all active records under the new key
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const active = db.prepare(`SELECT * FROM capabilities WHERE revoked = 0`).all();
  const update = db.prepare(`UPDATE capabilities SET signature = ?, updated_at = datetime('now') WHERE id = ?`);
  const logAction = db.prepare(`INSERT INTO registration_log (action, name, version, detail, caller) VALUES (@action, @name, @version, @detail, @caller)`);

  const startedAt = new Date();
  const endsAt    = new Date(startedAt.getTime() + overlapDays * 86400000);
  const callerTag = 'rotate-key.js';

  let resigned = 0;
  const resignAll = db.transaction(() => {
    logAction.run({
      action: 'rotation_started',
      name:   '__dnso__',
      version: null,
      detail: `Planned key rotation started. Overlap window: ${overlapDays} days. ` +
              `Ends: ${endsAt.toISOString()}. Previous public key remains verifiable at /pubkey?previous=true.`,
      caller: callerTag,
    });

    for (const row of active) {
      const toSign = {
        name:         row.name,
        description:  row.description,
        endpoint:     row.endpoint,
        protocol:     row.protocol,
        trust_tier:   row.trust_tier,
        permissions:  tryParse(row.permissions, []),
        version:      row.version,
        last_updated: row.last_updated,
      };
      if (row.input_schema  != null) toSign.input_schema  = tryParse(row.input_schema,  {});
      if (row.output_schema != null) toSign.output_schema = tryParse(row.output_schema, {});

      const newSig = sign(toSign, newPrivateKeyPem);
      update.run(newSig, row.id);
      resigned++;
    }
  });

  resignAll();
  ok(`Re-signed ${resigned} active record(s) under the new key`);

  // Write the rotation marker
  const marker = {
    started_at:       startedAt.toISOString(),
    ends_at:          endsAt.toISOString(),
    overlap_days:     overlapDays,
    records_resigned: resigned,
  };
  fs.writeFileSync(ROTATION_MARKER_PATH, JSON.stringify(marker, null, 2));
  ok(`Wrote rotation marker → ${ROTATION_MARKER_PATH}`);

  db.close();

  console.log('');
  console.log('  ── Overlap Window Active ──────────────────────────────────');
  console.log(`     Started:   ${startedAt.toISOString()}`);
  console.log(`     Ends:      ${endsAt.toISOString()}`);
  console.log(`     Duration:  ${overlapDays} days`);
  console.log('');
  console.log('  Per Spec §5.6, the overlap window start and end dates must be');
  console.log('  disclosed publicly. Publish the new key at:');
  console.log('     https://dillweed.com/dnso_public.pem');
  console.log('');
  console.log('  After the window closes, finalize with:');
  console.log('     node rotate-key.js --finalize');
  console.log('');
  console.log('  To expose overlap timestamps in /health, start the server with:');
  console.log(`     ROTATION_STARTED_AT="${startedAt.toISOString()}" \\`);
  console.log(`     ROTATION_ENDS_AT="${endsAt.toISOString()}" \\`);
  console.log('     node server.js');
  console.log('');
}

// ── --finalize ────────────────────────────────────────────────────────────────

function cmdFinalize() {
  console.log('\n  Dillweed Registry — Finalize Key Rotation\n');

  if (!fs.existsSync(PUBKEY_PREV_PATH)) {
    warn('No previous public key on disk. No overlap window to close.');
    console.log('');
    return;
  }

  let marker = null;
  if (fs.existsSync(ROTATION_MARKER_PATH)) {
    try { marker = JSON.parse(fs.readFileSync(ROTATION_MARKER_PATH, 'utf8')); }
    catch { marker = null; }
  }

  if (marker && marker.ends_at) {
    const now = new Date();
    const endsAt = new Date(marker.ends_at);
    if (now < endsAt) {
      const daysRemaining = Math.ceil((endsAt.getTime() - now.getTime()) / (1000*60*60*24));
      die(`Overlap window has not yet closed. ${daysRemaining} day(s) remaining.\n` +
          `  Finalizing early would strand resolvers still using the previous key.\n` +
          `  If you need to finalize anyway, delete keys/rotation.json first — but this is discouraged.`);
    }
  }

  // Log to audit trail before removing files
  if (!fs.existsSync(DB_PATH)) {
    warn('Database not found; rotation finalized without audit log entry.');
  } else {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    const logAction = db.prepare(`INSERT INTO registration_log (action, name, version, detail, caller) VALUES (@action, @name, @version, @detail, @caller)`);
    logAction.run({
      action:  'rotation_finalized',
      name:    '__dnso__',
      version: null,
      detail:  `Planned key rotation finalized. Previous key retired. ` +
               (marker ? `Overlap window: ${marker.started_at} → ${marker.ends_at}.` : ''),
      caller:  'rotate-key.js',
    });
    db.close();
    ok('Logged rotation_finalized entry to registration_log');
  }

  fs.unlinkSync(PUBKEY_PREV_PATH);
  ok(`Removed ${PUBKEY_PREV_PATH}`);

  if (fs.existsSync(PRIVKEY_PREV_PATH)) {
    fs.unlinkSync(PRIVKEY_PREV_PATH);
    ok(`Removed ${PRIVKEY_PREV_PATH}`);
  }

  if (fs.existsSync(ROTATION_MARKER_PATH)) {
    fs.unlinkSync(ROTATION_MARKER_PATH);
    ok(`Removed ${ROTATION_MARKER_PATH}`);
  }

  console.log('');
  ok('Rotation finalized. Only the current key is now served.');
  console.log('');
}
