#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Dillweed Anthill™ — Setup (v0.1.4)
//  Run once before starting the server:  node setup.js
//
//  This script:
//    1. Creates the SQLite database with the full schema
//    2. Creates the logs directory for the immutable signal log
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, 'data', 'anthill.db');
const LOG_PATH = path.join(__dirname, 'logs');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('\n  ERROR: better-sqlite3 is not installed.');
  console.error('  Run:   npm install\n');
  process.exit(1);
}

function log(msg)  { console.log('  ' + msg); }
function ok(msg)   { console.log('  ✓  ' + msg); }
function warn(msg) { console.log('  ⚠  ' + msg); }

console.log('\n  Dillweed Anthill™ — Setup\n');
console.log('  ── Step 1: Logs Directory ───────────────────────────────');

if (!fs.existsSync(LOG_PATH)) {
  fs.mkdirSync(LOG_PATH, { recursive: true });
  ok('Created logs/ directory for immutable signal log');
} else {
  warn('logs/ directory already exists. Skipping.');
}

console.log('\n  ── Step 2: Database ─────────────────────────────────────');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const existed = fs.existsSync(DB_PATH);
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id        TEXT    NOT NULL UNIQUE,
    signal_class     TEXT    NOT NULL,
    signal_timestamp TEXT    NOT NULL,
    signal_nonce     TEXT    NOT NULL UNIQUE,
    node_sequence    INTEGER NOT NULL,
    originating_node TEXT    NOT NULL,
    capability_ref   TEXT,
    severity         TEXT    NOT NULL,
    signal_payload   TEXT    NOT NULL,
    node_signature   TEXT,
    received_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_signals_class     ON signals(signal_class);
  CREATE INDEX IF NOT EXISTS idx_signals_severity  ON signals(severity);
  CREATE INDEX IF NOT EXISTS idx_signals_node      ON signals(originating_node);
  CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(signal_timestamp);
  CREATE INDEX IF NOT EXISTS idx_signals_nonce     ON signals(signal_nonce);
  -- Round-2 review (AS2-002 Option C): index received_at to keep the
  -- parallel received-time aggregation windows fast. /aggregate now
  -- computes both event-time (signal_timestamp) and received-time
  -- (received_at) windows for each signal class.
  CREATE INDEX IF NOT EXISTS idx_signals_received  ON signals(received_at);

  CREATE TABLE IF NOT EXISTS node_sequences (
    originating_node TEXT    PRIMARY KEY,
    last_sequence    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO meta(key, value) VALUES
    ('schema_version', '1'),
    ('created_at',     strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('spec_url',       'https://dillweed.com/anthill-spec.html');
`);

if (existed) {
  warn('Database already exists. Schema applied (safe to re-run).');
} else {
  ok('Created database: data/anthill.db');
  ok('Schema applied (signals, node_sequences, meta)');
}

console.log('\n  ── Setup Complete ───────────────────────────────────────');
ok('Anthill database:  data/anthill.db');
ok('Signal log:        logs/signals.log  (created on first signal)');

console.log(`
  Next steps:
    1.  node server.js             — start the aggregation endpoint
    2.  bash test.sh               — verify all endpoints
    3.  Store admin token in Keychain:
        security add-generic-password -a anthill-admin -s dillweed-anthill -w <token>
    4.  Point instrumented resolvers at this endpoint:
        ANTHILL_ENDPOINT=http://localhost:9476/signal

  Spec: https://dillweed.com/anthill-spec.html
`);
