#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Dillweed Registry — Setup (v0.2.7)
//  Run once before starting the server:  node setup.js
//
//  This script:
//    1. Creates the SQLite database with the full schema
//    2. Generates the DNSO Ed25519 signing keypair
//    3. Seeds the database with sample Capability Records
//    4. Signs each seeded record with the DNSO private key
//
//  Signing follows Registry Specification v0.1.4 §5.2: input_schema and
//  output_schema are included in the canonical JSON when present and
//  omitted entirely when absent. All seed records below include both
//  schemas, so the signed payload always contains them.
// ─────────────────────────────────────────────────────────────────────────────

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const DB_PATH      = path.join(__dirname, 'data', 'registry.db');
const KEYS_DIR     = path.join(__dirname, 'keys');
const PRIVKEY_PATH = path.join(KEYS_DIR, 'dnso_private.pem');
const PUBKEY_PATH  = path.join(KEYS_DIR, 'dnso_public.pem');

// ── Check better-sqlite3 is installed ─────────────────────────────────────────
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('\n  ERROR: better-sqlite3 is not installed.');
  console.error('  Run:   npm install\n');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg)   { console.log('  ' + msg); }
function ok(msg)    { console.log('  ✓  ' + msg); }
function warn(msg)  { console.log('  ⚠  ' + msg); }

// ── Canonical JSON for signing ────────────────────────────────────────────────
// Fields are sorted alphabetically so signature is deterministic.
function canonicalJSON(record) {
  const fields = ['description', 'endpoint', 'input_schema', 'last_updated', 'name',
                  'output_schema', 'permissions', 'protocol', 'trust_tier', 'version'];
  const obj = {};
  for (const f of fields) {
    if (record[f] !== undefined) obj[f] = record[f];
  }
  return JSON.stringify(obj);
}

function signRecord(record, privateKeyPem) {
  const payload = canonicalJSON(record);
  const sig = crypto.sign(null,
    Buffer.from(payload),
    { key: privateKeyPem, dsaEncoding: 'ieee-p1363' }
  );
  return 'dnso_v1_' + sig.toString('base64url');
}

// ── Step 1: Keypair ───────────────────────────────────────────────────────────

console.log('\n  Dillweed Registry — Setup\n');
console.log('  ── Step 1: DNSO Keypair ─────────────────────────────────');

if (fs.existsSync(PRIVKEY_PATH)) {
  warn('Keypair already exists. Skipping key generation (delete keys/ to regenerate).');
} else {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8',   format: 'pem' },
    publicKeyEncoding:  { type: 'spki',    format: 'pem' },
  });
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(PRIVKEY_PATH, privateKey,  { mode: 0o600 });
  fs.writeFileSync(PUBKEY_PATH,  publicKey);
  ok('Generated Ed25519 keypair');
  ok(`Private key → keys/dnso_private.pem  (mode 600 — keep secret)`);
  ok(`Public key  → keys/dnso_public.pem   (publish at dillweed.com/dnso_public.pem)`);
}

const privateKeyPem = fs.readFileSync(PRIVKEY_PATH, 'utf8');
const publicKeyPem  = fs.readFileSync(PUBKEY_PATH,  'utf8');

// ── Step 2: Database Schema ───────────────────────────────────────────────────

console.log('\n  ── Step 2: Database ─────────────────────────────────────');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const existed = fs.existsSync(DB_PATH);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS capabilities (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT    NOT NULL,
    description       TEXT    NOT NULL,
    endpoint          TEXT    NOT NULL,
    protocol          TEXT    NOT NULL DEFAULT 'rest',
    input_schema      TEXT,
    output_schema     TEXT,
    trust_tier        TEXT    NOT NULL DEFAULT 'experimental',
    permissions       TEXT    NOT NULL DEFAULT '[]',
    version           TEXT    NOT NULL DEFAULT '1.0.0',
    signature         TEXT,
    registration_date TEXT    NOT NULL,
    last_updated      TEXT    NOT NULL,
    tags              TEXT    NOT NULL DEFAULT '[]',
    revoked           INTEGER NOT NULL DEFAULT 0,
    revoke_reason     TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_cap_name_version
    ON capabilities(name, version) WHERE revoked = 0;

  CREATE INDEX IF NOT EXISTS idx_cap_name
    ON capabilities(name);

  CREATE INDEX IF NOT EXISTS idx_cap_trust_tier
    ON capabilities(trust_tier);

  CREATE INDEX IF NOT EXISTS idx_cap_revoked
    ON capabilities(revoked);

  CREATE TABLE IF NOT EXISTS registration_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    version     TEXT,
    detail      TEXT,
    caller      TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO meta(key, value) VALUES
    ('schema_version', '1'),
    ('created_at',     datetime('now')),
    ('public_key_url', 'https://dillweed.com/dnso_public.pem');
`);

if (existed) {
  warn('Database already exists. Schema applied (safe to re-run).');
} else {
  ok('Created database: data/registry.db');
  ok('Schema applied (capabilities, registration_log, meta)');
}

// ── Step 3: Seed Records ──────────────────────────────────────────────────────

console.log('\n  ── Step 3: Seed Records ─────────────────────────────────');

const existing = db.prepare('SELECT COUNT(*) as n FROM capabilities').get();
if (existing.n > 0) {
  warn(`Database already has ${existing.n} record(s). Skipping seed.`);
} else {
  const insert = db.prepare(`
    INSERT INTO capabilities
      (name, description, endpoint, protocol, input_schema, output_schema,
       trust_tier, permissions, version, signature, registration_date, last_updated, tags)
    VALUES
      (@name, @description, @endpoint, @protocol, @input_schema, @output_schema,
       @trust_tier, @permissions, @version, @signature, @registration_date, @last_updated, @tags)
  `);

  const logEntry = db.prepare(`
    INSERT INTO registration_log (action, name, version, detail, caller)
    VALUES ('seed', @name, @version, 'Initial seeded record', 'setup.js')
  `);

  const seeds = [
    {
      name:              'research.market.intel.vendors',
      description:       'Vendor comparison and analysis — evaluates, scores, and summarizes software vendors against defined criteria.',
      endpoint:          'https://api.marketintel.example.com/vendors',
      protocol:          'rest',
      input_schema:      JSON.stringify({ type:'object', properties:{ vendors:{ type:'array', items:{ type:'string' } }, criteria:{ type:'array' } }, required:['vendors'] }),
      output_schema:     JSON.stringify({ type:'object', properties:{ rankings:{ type:'array' }, summary:{ type:'string' } } }),
      trust_tier:        'verified',
      permissions:       JSON.stringify(['query','summarize','export']),
      version:           '1.2.0',
      registration_date: '2024-09-15',
      last_updated:      '2026-01-10T00:00:00Z',
      tags:              JSON.stringify(['research','procurement','vendor']),
    },
    {
      name:              'data.enrichment.company.profile',
      description:       'Company firmographic enrichment — returns structured data on a company given a name or domain.',
      endpoint:          'https://api.enrichment.example.com/company',
      protocol:          'rest',
      input_schema:      JSON.stringify({ type:'object', properties:{ company_id:{ type:'string' }, fields:{ type:'array' } }, required:['company_id'] }),
      output_schema:     JSON.stringify({ type:'object', properties:{ name:{ type:'string' }, domain:{ type:'string' }, employees:{ type:'integer' }, industry:{ type:'string' } } }),
      trust_tier:        'verified',
      permissions:       JSON.stringify(['query','export']),
      version:           '2.0.1',
      registration_date: '2024-06-01',
      last_updated:      '2026-02-14T00:00:00Z',
      tags:              JSON.stringify(['data','enrichment','company','firmographic']),
    },
    {
      name:              'agents.analysis.financial.reports',
      description:       'Financial analysis agent — performs structured analysis of financial statements and SEC filings.',
      endpoint:          'https://agents.finanalysis.example.com/a2a',
      protocol:          'a2a',
      input_schema:      JSON.stringify({ type:'object', properties:{ ticker:{ type:'string' }, period:{ type:'string' }, analysis_type:{ type:'string' } }, required:['ticker'] }),
      output_schema:     JSON.stringify({ type:'object', properties:{ summary:{ type:'string' }, metrics:{ type:'object' }, risk_factors:{ type:'array' } } }),
      trust_tier:        'trusted',
      permissions:       JSON.stringify(['query','summarize']),
      version:           '1.0.4',
      registration_date: '2025-01-20',
      last_updated:      '2026-03-01T00:00:00Z',
      tags:              JSON.stringify(['finance','analysis','agent','a2a']),
    },
    {
      name:              'tools.search.web-retrieval',
      description:       'Web search and retrieval — returns ranked results with snippets and source metadata.',
      endpoint:          'https://tools.websearch.example.com/retrieve',
      protocol:          'mcp',
      input_schema:      JSON.stringify({ type:'object', properties:{ query:{ type:'string' }, max_results:{ type:'integer', default:10 } }, required:['query'] }),
      output_schema:     JSON.stringify({ type:'object', properties:{ results:{ type:'array', items:{ type:'object', properties:{ title:{ type:'string' }, url:{ type:'string' }, snippet:{ type:'string' } } } } } }),
      trust_tier:        'verified',
      permissions:       JSON.stringify(['query']),
      version:           '3.1.0',
      registration_date: '2024-03-10',
      last_updated:      '2026-02-28T00:00:00Z',
      tags:              JSON.stringify(['search','retrieval','mcp','tools']),
    },
    {
      name:              'tools.search.web-retrieval',
      description:       'Web search — EXPERIMENTAL v4 with neural reranking. Use for testing only.',
      endpoint:          'https://tools.websearch-beta.example.com/retrieve',
      protocol:          'mcp',
      input_schema:      JSON.stringify({ type:'object', properties:{ query:{ type:'string' } }, required:['query'] }),
      output_schema:     JSON.stringify({ type:'object' }),
      trust_tier:        'experimental',
      permissions:       JSON.stringify(['query']),
      version:           '4.0.0-beta',
      registration_date: '2026-03-01',
      last_updated:      '2026-03-20T00:00:00Z',
      tags:              JSON.stringify(['search','experimental','beta']),
    },
    {
      name:              'data.code.execution.sandbox',
      description:       'Sandboxed code execution — runs Python or JavaScript in an isolated container.',
      endpoint:          'https://sandbox.codeexec.example.com/run',
      protocol:          'rest',
      input_schema:      JSON.stringify({ type:'object', properties:{ language:{ type:'string', enum:['python','javascript'] }, code:{ type:'string' }, timeout_ms:{ type:'integer' } }, required:['language','code'] }),
      output_schema:     JSON.stringify({ type:'object', properties:{ stdout:{ type:'string' }, stderr:{ type:'string' }, exit_code:{ type:'integer' }, duration_ms:{ type:'integer' } } }),
      trust_tier:        'trusted',
      permissions:       JSON.stringify(['execute','query']),
      version:           '2.3.0',
      registration_date: '2024-11-05',
      last_updated:      '2026-01-22T00:00:00Z',
      tags:              JSON.stringify(['code','execution','sandbox','tools']),
    },
    {
      name:              'agents.utility.summarization.document',
      description:       'Document summarization agent — produces structured summaries of long-form documents.',
      endpoint:          'https://agents.summarize.example.com/document',
      protocol:          'rest',
      input_schema:      JSON.stringify({ type:'object', properties:{ text:{ type:'string' }, max_words:{ type:'integer', default:200 }, format:{ type:'string', enum:['prose','bullets','structured'] } }, required:['text'] }),
      output_schema:     JSON.stringify({ type:'object', properties:{ summary:{ type:'string' }, key_points:{ type:'array' }, word_count:{ type:'integer' } } }),
      trust_tier:        'verified',
      permissions:       JSON.stringify(['query','summarize']),
      version:           '1.5.2',
      registration_date: '2024-08-30',
      last_updated:      '2026-03-05T00:00:00Z',
      tags:              JSON.stringify(['summarization','document','nlp']),
    },
  ];

  const seedAll = db.transaction(() => {
    for (const rec of seeds) {
      // Sign the record
      const toSign = {
        name:          rec.name,
        description:   rec.description,
        endpoint:      rec.endpoint,
        protocol:      rec.protocol,
        input_schema:  rec.input_schema ? JSON.parse(rec.input_schema) : undefined,
        output_schema: rec.output_schema ? JSON.parse(rec.output_schema) : undefined,
        trust_tier:    rec.trust_tier,
        permissions:   JSON.parse(rec.permissions),
        version:       rec.version,
        last_updated:  rec.last_updated,
      };
      rec.signature = signRecord(toSign, privateKeyPem);
      insert.run(rec);
      logEntry.run({ name: rec.name, version: rec.version });
    }
  });

  seedAll();
  ok(`Seeded ${seeds.length} Capability Records`);
  ok('All records signed with DNSO private key');
}

// ── Done ──────────────────────────────────────────────────────────────────────

const count = db.prepare('SELECT COUNT(*) as n FROM capabilities WHERE revoked=0').get();
db.close();

console.log('\n  ── Setup Complete ───────────────────────────────────────');
ok(`Registry database:  data/registry.db  (${count.n} records)`);
ok('DNSO private key:   keys/dnso_private.pem');
ok('DNSO public key:    keys/dnso_public.pem');
console.log('');
console.log('  Next steps:');
console.log('    1.  node server.js             — start the registry');
console.log('    2.  bash test.sh               — verify all endpoints');
console.log('    3.  Publish keys/dnso_public.pem at dillweed.com/dnso_public.pem');
console.log('    4.  Point DillClaw at this registry:');
console.log('        DILLCLAW_REGISTRY_URL=http://localhost:9475 node server.js');
console.log('');
console.log('  ⚠  Keep keys/dnso_private.pem secret. Back it up securely.');
console.log('     If lost, all existing signatures become unverifiable.');
console.log('');
