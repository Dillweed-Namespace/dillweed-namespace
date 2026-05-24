'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Dillweed Anthill™  v0.1.5
//  https://dillweed.com/anthill-spec.html
//
//  Implements the Dillweed Anthill Observability Plane Specification v0.1.
//  Aggregation endpoint for namespace coordination-layer signals.
//
//  v0.1.0 (May 2026):
//    - Six signal classes: ANT-TC, ANT-RC, ANT-DN, ANT-RA, ANT-WF, ANT-EC
//    - Nonce replay protection per Spec §4
//    - Node sequence replay protection per Spec §4
//    - Three aggregation windows per Spec §5
//    - Immutable append-only signal log per Spec §5
//    - Bearer token auth for signal submission
//    - Bound to 127.0.0.1 (local deployment)
// ─────────────────────────────────────────────────────────────────────────────

// Load .env file if present — allows token and config without shell exports
try { require('dotenv').config(); } catch { /* dotenv optional — fall back to process.env */ }

const http   = require('http');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');

// Pre-review-1 self-audit (AAS-PRE-001): single source of truth for the
// service version string. Pass 4 noted that Anthill lacked the top-level
// VERSION constant that Registry and Resolver both carry; the /health
// response and startup banner referenced a hardcoded '0.1.4' literal in
// three places. Aligning with the project-wide convention: declare here,
// reference everywhere.
const VERSION       = 'dillweed-anthill/0.1.6';

// Round-1 review (AS-012 fix): strict ANTHILL_PORT parsing. The prior
// parseInt(process.env.ANTHILL_PORT || '9476', 10) accepted malformed
// values like '9476abc' (parsed as 9476) and 'foo' (parsed as NaN, which
// then made the server fail to listen with an unhelpful error). Now: must
// be a full-string integer in range 1-65535 or startup aborts with a
// clear message. Pattern aligns with the strict numeric validation
// applied to pagination params and the project-wide convergence toward
// strict parsing.
function parsePort(value, fieldName) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${fieldName} must be a non-negative integer; got: "${value}"`);
  }
  const n = parseInt(value, 10);
  if (n < 1 || n > 65535) {
    throw new Error(`${fieldName} must be in range 1-65535; got: ${n}`);
  }
  return n;
}

let PORT;
try {
  PORT = parsePort(process.env.ANTHILL_PORT || '9476', 'ANTHILL_PORT');
} catch (e) {
  console.error(`\n  ERROR: ${e.message}\n`);
  process.exit(1);
}

const DB_PATH       = path.join(__dirname, 'data', 'anthill.db');
const LOG_PATH      = path.join(__dirname, 'logs');
const SIGNAL_LOG    = path.join(LOG_PATH, 'signals.log');
const ADMIN_TOKEN   = process.env.ANTHILL_ADMIN_TOKEN || null;

// ── Signal Classes and Severity Levels ───────────────────────────────────────

const SIGNAL_CLASSES = ['ANT-TC', 'ANT-RC', 'ANT-DN', 'ANT-RA', 'ANT-WF', 'ANT-EC'];
const SEVERITIES     = ['INFORMATIONAL', 'ADVISORY', 'WARNING', 'CRITICAL'];

// Round-1 review (AS-002 fix): explicit severity-rank lookup. The prior
// /aggregate handler relied on SQL `ORDER BY severity DESC` to put the
// highest-severity row first, but the severity values are TEXT and sort
// lexicographically: descending order is W > I > C > A. So a window with
// both WARNING and CRITICAL signals would report max_severity=WARNING.
// This rank is referenced from handleAggregate to compute max_severity
// correctly. The ranks themselves match the Spec §4 ordinal escalation
// model: INFORMATIONAL < ADVISORY < WARNING < CRITICAL.
const SEVERITY_RANK = {
  INFORMATIONAL: 1,
  ADVISORY:      2,
  WARNING:       3,
  CRITICAL:      4,
};

// Round-1 review (AS-007): originator identifiers reserved for internal
// Anthill use. External callers cannot claim these as their originating_node
// — the validateSignal check rejects them. Currently only ANTHILL_AGGREGATOR
// is reserved (used by the AS-002 nonce-collision ANT-RA generation path).
// 'REGISTRY' is conventionally used for registry-origin signals but is not
// reserved here yet, pending the §A.11 coordinated work.
const RESERVED_NODES = new Set(['ANTHILL_AGGREGATOR']);

// Aggregation windows in seconds, per Spec §5
// Immediate (60s): ANT-DN, ANT-RA — active abuse signals
// Short (1h):      ANT-RC — revocation propagation assessment
// Extended (24h):  ANT-TC, ANT-WF, ANT-EC — gradual ecosystem trends
const WINDOW_SECONDS = {
  'ANT-DN': 60,
  'ANT-RA': 60,
  'ANT-RC': 3600,
  'ANT-TC': 86400,
  'ANT-WF': 86400,
  'ANT-EC': 86400,
};

const WINDOW_LABELS = {
  60:    'immediate (60s)',
  3600:  'short (1h)',
  86400: 'extended (24h)',
};

// ── Database ──────────────────────────────────────────────────────────────────

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('\n  ERROR: better-sqlite3 is not installed.');
  console.error('  Run:   npm install\n');
  process.exit(1);
}

let db;
try {
  db = new Database(DB_PATH);
} catch (e) {
  console.error('\n  ERROR: Cannot open database:', e.message);
  console.error('  Run:   node setup.js\n');
  process.exit(1);
}

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

const stmts = {
  totalCount:       db.prepare('SELECT COUNT(*) as n FROM signals'),
  checkNonce:       db.prepare('SELECT id FROM signals WHERE signal_nonce = ?'),
  getNodeSeq:       db.prepare('SELECT last_sequence FROM node_sequences WHERE originating_node = ?'),
  upsertNodeSeq:    db.prepare(`
    INSERT INTO node_sequences (originating_node, last_sequence) VALUES (?, ?)
    ON CONFLICT(originating_node) DO UPDATE SET last_sequence = excluded.last_sequence
  `),
  insertSignal:     db.prepare(`
    INSERT INTO signals
      (signal_id, signal_class, signal_timestamp, signal_nonce, node_sequence,
       originating_node, capability_ref, severity, signal_payload, node_signature,
       received_at)
    VALUES
      (@signal_id, @signal_class, @signal_timestamp, @signal_nonce, @node_sequence,
       @originating_node, @capability_ref, @severity, @signal_payload, @node_signature,
       @received_at)
  `),
  listSignals:      db.prepare(`
    SELECT * FROM signals
    WHERE (@class     IS NULL OR signal_class     = @class)
    AND   (@severity  IS NULL OR severity         = @severity)
    AND   (@node      IS NULL OR originating_node = @node)
    AND   (@cap       IS NULL OR capability_ref   = @cap)
    ORDER BY signal_timestamp DESC, id DESC
    LIMIT @limit OFFSET @offset
  `),
  countSignals:     db.prepare(`
    SELECT COUNT(*) as n FROM signals
    WHERE (@class    IS NULL OR signal_class     = @class)
    AND   (@severity IS NULL OR severity         = @severity)
    AND   (@node     IS NULL OR originating_node = @node)
    AND   (@cap      IS NULL OR capability_ref   = @cap)
  `),
  windowAggregate:  db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM signals
    WHERE signal_class = @class AND signal_timestamp >= @since
    GROUP BY severity
  `),
  // Round-2 review (AS2-002, Option C): parallel aggregation over the
  // server-controlled received_at column. /aggregate returns both
  // event-time windows (caller-supplied signal_timestamp, vulnerable to
  // node clock manipulation per Spec §8) AND received-time windows
  // (Anthill-controlled, robust). Returning both lets stewards see both
  // views; the comparison itself is diagnostic — large divergence between
  // the two suggests clock drift or deliberate timestamp manipulation in
  // the resolver fleet.
  windowAggregateByReceivedAt: db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM signals
    WHERE signal_class = @class AND received_at >= @since
    GROUP BY severity
  `),
  classBreakdown:   db.prepare(`
    SELECT signal_class,
           COUNT(*) as total,
           SUM(CASE WHEN severity = 'CRITICAL'      THEN 1 ELSE 0 END) as critical,
           SUM(CASE WHEN severity = 'WARNING'        THEN 1 ELSE 0 END) as warning,
           SUM(CASE WHEN severity = 'ADVISORY'       THEN 1 ELSE 0 END) as advisory,
           SUM(CASE WHEN severity = 'INFORMATIONAL'  THEN 1 ELSE 0 END) as informational,
           MAX(signal_timestamp) as last_seen
    FROM signals
    GROUP BY signal_class
    ORDER BY signal_class
  `),
  recentCritical:   db.prepare(`
    SELECT signal_id, signal_class, originating_node, capability_ref, signal_timestamp
    FROM signals
    WHERE severity = 'CRITICAL'
    ORDER BY signal_timestamp DESC, id DESC
    LIMIT 10
  `),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function err(res, status, code, message, detail = null) {
  send(res, status, { status: 'error', error_code: code, message, detail });
}

// Round-1 review (AS-006 fix): bounded body parsing. Prior implementation
// accumulated request body without an upper limit, allowing a malformed or
// runaway client to consume memory before JSON parsing. 256 KB is generous
// for signal payloads (the signal_payload field carries diagnostic JSON,
// not bulk data) and conservative enough to prevent abuse. Caller maps
// 'Request body too large' to HTTP 413 PAYLOAD_TOO_LARGE.
const MAX_REQUEST_BODY_BYTES = 256 * 1024;

function parseBody(req, maxBytes = MAX_REQUEST_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let aborted = false;
    req.on('data', chunk => {
      if (aborted) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        aborted = true;
        req.resume(); // drain remaining data so the 413 response can be delivered
        const e = new Error('Request body too large');
        e.code = 'PAYLOAD_TOO_LARGE';
        return reject(e);
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function nowUTC() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function requireAuth(req, res) {
  if (!ADMIN_TOKEN) return true; // open mode — no token configured
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${ADMIN_TOKEN}`) return true;
  err(res, 401, 'UNAUTHORIZED', 'Valid Authorization: Bearer <token> required.', null);
  return false;
}

function appendSignalLog(entry) {
  // Round-1 review (AS-001 fix): no longer catches and swallows write errors.
  // Round-2 review (AS-001 follow-up): the JSONL log carries ingestion-
  // attempt semantics, not accepted-signal-only semantics. Under the
  // log-first-then-DB ordering established in AS-001, an entry may appear
  // in the JSONL whose subsequent SQLite insert failed and returned
  // STORAGE_FAULT to the caller. The caller knows; the JSONL preserves the
  // attempt for forensic reconciliation against the SQLite accepted-signal
  // store. This split is intentional:
  //
  //   SQLite signals table = accepted-signal store (what the API returned 201 for)
  //   logs/signals.log     = ingestion-attempt log (everything that reached storage)
  //
  // Reconciling the two — entries in JSONL with no matching DB row — is the
  // forensic capability the durability model provides. Throws on failure
  // so handleSignal can surface STORAGE_FAULT instead of false success.
  if (!fs.existsSync(LOG_PATH)) fs.mkdirSync(LOG_PATH, { recursive: true });
  fs.appendFileSync(SIGNAL_LOG, JSON.stringify(entry) + '\n');
}

// ── Validation ────────────────────────────────────────────────────────────────

// Round-1 review (AS-003 fix): calendar/clock-validity check for RFC 3339
// UTC second-precision timestamps. The §4 regex (YYYY-MM-DDTHH:MM:SSZ)
// rejects fractional seconds and non-UTC offsets but accepts structurally
// impossible values like 2026-02-31T12:00:00Z, 2026-99-99T99:99:99Z, or
// 2026-01-01T24:00:00Z. Because signal_timestamp is used as both the sort
// key for /signals and the window-membership key for /aggregate, accepting
// impossible timestamps corrupts both. Spec §8 acknowledges that nodes can
// submit dishonest timestamps without detection — this fix doesn't try to
// detect dishonesty; it only enforces structural validity (the calendar
// date and clock time must be parseable to themselves via the Date API).
function isValidRfc3339UtcSecondPrecision(s) {
  if (typeof s !== 'string') return false;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
  if (!m) return false;
  const [, y, mo, d, h, mi, sec] = m.map(Number);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  if (h > 23 || mi > 59 || sec > 59) return false;
  // Date round-trip check: if the constructed UTC moment maps back to the
  // same components, the input was a valid calendar date. Otherwise (e.g.
  // 2026-02-31), JavaScript overflows to a different date (2026-03-03)
  // and the round-trip mismatches.
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
  return dt.getUTCFullYear() === y &&
         dt.getUTCMonth()    === mo - 1 &&
         dt.getUTCDate()     === d &&
         dt.getUTCHours()    === h &&
         dt.getUTCMinutes()  === mi &&
         dt.getUTCSeconds()  === sec;
}

function validateSignal(body) {
  const errors = [];

  if (!body.signal_class) {
    errors.push('Missing required field: signal_class');
  } else if (!SIGNAL_CLASSES.includes(body.signal_class)) {
    errors.push(`signal_class must be one of: ${SIGNAL_CLASSES.join(', ')}`);
  }

  if (!body.signal_timestamp) {
    errors.push('Missing required field: signal_timestamp');
  } else if (!isValidRfc3339UtcSecondPrecision(body.signal_timestamp)) {
    errors.push('signal_timestamp must be RFC 3339 UTC second-precision (YYYY-MM-DDTHH:MM:SSZ): valid calendar date, valid clock time, no fractional seconds, no non-UTC offsets');
  }

  if (body.signal_nonce === undefined || body.signal_nonce === null || body.signal_nonce === '') {
    errors.push('Missing required field: signal_nonce');
  } else if (typeof body.signal_nonce !== 'string' || !body.signal_nonce.trim()) {
    // Round-1 review (AS-004 fix): truthy-only check was accepting non-string
    // values like {bad: true}. Spec §4 describes signal_nonce as a 128-bit
    // random value; v0.1.4 enforces non-empty string type but does not yet
    // enforce a specific 128-bit encoding (UUID, 32-hex). Submitters are
    // expected to supply cryptographically random nonces; collisions are
    // detected and handled regardless of the input format.
    errors.push('signal_nonce must be a non-empty string');
  }

  if (body.originating_node === undefined || body.originating_node === null || body.originating_node === '') {
    errors.push('Missing required field: originating_node');
  } else if (typeof body.originating_node !== 'string' || !body.originating_node.trim()) {
    errors.push('originating_node must be a non-empty string');
  } else if (RESERVED_NODES.has(body.originating_node)) {
    // Round-1 review (AS-007 fix): ANTHILL_AGGREGATOR is reserved for
    // signals generated internally by the aggregation layer (currently
    // used only by the AS-002 ANT-RA-on-nonce-collision path). External
    // submissions claiming this originator could pollute the pseudo-node's
    // sequence counter or interfere with internal-origin telemetry.
    errors.push(`originating_node "${body.originating_node}" is reserved for internal Anthill-generated signals`);
  }

  if (body.node_sequence === undefined || body.node_sequence === null) {
    errors.push('Missing required field: node_sequence');
  } else if (!Number.isInteger(body.node_sequence) || body.node_sequence < 0) {
    errors.push('node_sequence must be a non-negative integer');
  }

  if (!body.severity) {
    errors.push('Missing required field: severity');
  } else if (!SEVERITIES.includes(body.severity)) {
    errors.push(`severity must be one of: ${SEVERITIES.join(', ')}`);
  }

  if (body.signal_payload === undefined || body.signal_payload === null) {
    errors.push('Missing required field: signal_payload');
  } else if (typeof body.signal_payload !== 'object' || Array.isArray(body.signal_payload)) {
    errors.push('signal_payload must be a JSON object');
  }

  // Round-1 review (AS-004 fix): capability_ref and node_signature are
  // optional per spec, but when supplied they must be strings. Prior code
  // accepted {bad: true} or arrays via "|| null" coercion that hid type
  // errors. node_signature in particular needs to be a string so the
  // future cryptographic verification (AUDIT-AS-001, currently deferred)
  // has a well-typed field to work with when it lands.
  if (body.capability_ref !== undefined && body.capability_ref !== null &&
      (typeof body.capability_ref !== 'string' || !body.capability_ref.trim())) {
    errors.push('capability_ref must be a non-empty string when supplied');
  }

  if (body.node_signature !== undefined && body.node_signature !== null &&
      (typeof body.node_signature !== 'string' || !body.node_signature.trim())) {
    errors.push('node_signature must be a non-empty string when supplied');
  }

  return errors;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// GET /health
function handleHealth(req, res) {
  const n    = stmts.totalCount.get().n;
  const auth = ADMIN_TOKEN ? 'token required' : 'open (set ANTHILL_ADMIN_TOKEN to secure)';
  send(res, 200, {
    status:           'ok',
    service:          'dillweed-anthill',
    version:          VERSION,
    signals_received: n,
    auth,
    spec:             'https://dillweed.com/anthill-spec.html',
  });
}

// POST /signal — submit a signal to the aggregation layer
async function handleSignal(req, res) {
  if (!requireAuth(req, res)) return;

  // Round-1 review (AS-005 fix): require Content-Type: application/json on
  // POST /signal. Prior code parsed the body as JSON regardless of header.
  // ';charset=utf-8' suffixes are allowed; the type token is extracted via
  // split(';')[0]. Missing and wrong both rejected with 400 BAD_REQUEST.
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!contentType) {
    return err(res, 400, 'BAD_REQUEST', 'Content-Type header is required and must be application/json.');
  }
  if (contentType !== 'application/json') {
    return err(res, 400, 'BAD_REQUEST', `Content-Type must be application/json. Got: "${contentType}"`);
  }

  let body;
  try { body = await parseBody(req); }
  catch (e) {
    // Round-1 review (AS-006 fix): body-too-large is a distinct error from
    // generic BAD_REQUEST. 413 PAYLOAD_TOO_LARGE per RFC 9110.
    if (e.code === 'PAYLOAD_TOO_LARGE') {
      return err(res, 413, 'PAYLOAD_TOO_LARGE', `Request body exceeds limit (${MAX_REQUEST_BODY_BYTES} bytes).`);
    }
    return err(res, 400, 'BAD_REQUEST', e.message);
  }

  // Validate all fields simultaneously — Spec §7 pattern
  const errors = validateSignal(body);
  if (errors.length) {
    // Round-1 review (AS-010 fix): include 'message' on VALIDATION_FAILED
    // for parity with the standard error response shape. The 'errors' array
    // carries the per-field details; 'message' carries the human-readable
    // summary so clients that key off 'message' work consistently.
    return send(res, 422, {
      status: 'error',
      error_code: 'VALIDATION_FAILED',
      message: 'Signal failed validation.',
      errors,
    });
  }

  // Nonce uniqueness check — Spec §4 replay protection
  const nonceExists = stmts.checkNonce.get(body.signal_nonce);
  if (nonceExists) {
    // Per Spec §4 REQ-7: "The aggregation layer MUST additionally generate a
    // CRITICAL-severity ANT-RA (Resolver Abuse) signal naming the offending
    // node." A nonce collision at 128-bit random generation indicates a
    // broken RNG, an implementation bug, or a deliberate replay attempt;
    // all warrant escalation regardless of cause.
    //
    // Aggregator-generated signal conventions (not yet specified in the
    // Anthill spec; provisional pending Appendix A.11 resolution):
    //   - originating_node = 'ANTHILL_AGGREGATOR' (uppercase, distinguishable
    //     from real resolver node identifiers and from the spec-mentioned
    //     'REGISTRY' value for registry-origin signals)
    //   - signal_nonce = fresh crypto.randomUUID() (the aggregator generates
    //     its own nonce; the colliding caller-supplied nonce is recorded
    //     in signal_payload for investigative reference)
    //   - node_sequence = per-aggregator monotonic counter, scoped to the
    //     'ANTHILL_AGGREGATOR' pseudo-node; reuses the same node_sequences
    //     table as resolver nodes
    //   - node_signature = null (aggregator self-signing scheme is pending
    //     the coordinated work tracked in Appendix A.11)
    const aggregatorSeqRow = stmts.getNodeSeq.get('ANTHILL_AGGREGATOR');
    const aggregatorSeq    = (aggregatorSeqRow ? aggregatorSeqRow.last_sequence : -1) + 1;
    const antRaSignalId    = crypto.randomUUID();
    const antRaNonce       = crypto.randomUUID();   // Pre-review-1 self-audit (AAS-PRE-017): assigned to a const so DB and log entries record the same nonce value. Prior code generated the nonce inline at DB insert site and wrote null to the log, producing a DB/log divergence under forensic review.
    const antRaTimestamp   = nowUTC();
    const antRaPayload     = {
      offending_node:      body.originating_node,
      attempted_nonce:     body.signal_nonce,
      original_signal_id:  nonceExists.id,
      reason:              'nonce_collision',
    };

    // Round-1 review (AS-001 fix): wrap aggregator ANT-RA write in the
    // same try/catch as the main signal path. Log-first, then DB. If either
    // fails, the caller gets STORAGE_FAULT and the (pre-existing) nonce
    // collision was NOT durably recorded. That's acceptable — the original
    // colliding signal is still present in the DB from its first
    // submission, so the replay-protection state is correct; only the
    // diagnostic ANT-RA escalation was lost. A retry by the offending node
    // would produce the same collision and another (durable) ANT-RA attempt.
    try {
      appendSignalLog({
        signal_id:        antRaSignalId,
        signal_class:     'ANT-RA',
        signal_timestamp: antRaTimestamp,
        signal_nonce:     antRaNonce,
        node_sequence:    aggregatorSeq,
        originating_node: 'ANTHILL_AGGREGATOR',
        capability_ref:   body.originating_node,
        severity:         'CRITICAL',
        signal_payload:   antRaPayload,
        node_signature:   null,
        received_at:      antRaTimestamp,
      });

      db.transaction(() => {
        stmts.insertSignal.run({
          signal_id:        antRaSignalId,
          signal_class:     'ANT-RA',
          signal_timestamp: antRaTimestamp,
          signal_nonce:     antRaNonce,
          node_sequence:    aggregatorSeq,
          originating_node: 'ANTHILL_AGGREGATOR',
          capability_ref:   body.originating_node,
          severity:         'CRITICAL',
          signal_payload:   JSON.stringify(antRaPayload),
          node_signature:   null,
          received_at:      antRaTimestamp,                                   // AS2-001 fix: same value as JSONL
        });
        stmts.upsertNodeSeq.run('ANTHILL_AGGREGATOR', aggregatorSeq);
      })();
    } catch (e) {
      console.error('[storage]', e.message);
      return err(res, 500, 'STORAGE_FAULT',
        'ANT-RA signal for nonce collision could not be durably stored.',
        e.message);
    }

    console.log(`  [REPLAY] Nonce collision from ${body.originating_node} — ANT-RA CRITICAL signal generated (id=${antRaSignalId})`);

    return err(res, 409, 'NONCE_COLLISION',
      'signal_nonce has been seen before — possible replay attack. ' +
      'Per Spec §4 REQ-7, a CRITICAL-severity ANT-RA signal has been ' +
      'generated and logged naming the offending node.',
      { originating_node: body.originating_node, ant_ra_signal_id: antRaSignalId });
  }

  // Node sequence check — Spec §4 replay protection
  const nodeSeqRow = stmts.getNodeSeq.get(body.originating_node);
  const lastSeq    = nodeSeqRow ? nodeSeqRow.last_sequence : -1;
  if (body.node_sequence <= lastSeq) {
    return err(res, 409, 'SEQUENCE_VIOLATION',
      `node_sequence ${body.node_sequence} does not exceed last accepted sequence ` +
      `${lastSeq} for node '${body.originating_node}'. Per Spec §4, out-of-order ` +
      `sequences are rejected to prevent replay.`,
      null);
  }

  const signal_id   = crypto.randomUUID();
  const received_at = nowUTC();

  // Round-1 review (AS-001 fix): DB insert and JSONL log append must both
  // succeed before the API returns 201 accepted. Prior code wrote to DB
  // first, then appended to log via a try/catch that swallowed log errors,
  // letting the API return 201 accepted while the forensic log silently
  // failed. Now: append to log FIRST, then DB. If the log append fails, no
  // DB row is created — the caller sees STORAGE_FAULT and retries. If the
  // DB insert fails after a successful log append, the log carries a record
  // of the attempt (forensically useful) but the signal is not visible
  // through /signals — caller sees STORAGE_FAULT. Round-3 review correction:
  // a retry by the same node MAY later succeed and create a second JSONL
  // entry with the same nonce but a different signal_id — replay protection
  // cannot re-reject because the nonce never reached the SQLite uniqueness
  // constraint. Reconciliation between the two stores should compare by
  // signal_id and/or nonce: JSONL entries with no matching SQLite row are
  // the failed-after-log attempts. SQLite + flat file cannot be made truly
  // atomic; this ordering minimizes the divergence risk and never reports
  // false success.
  try {
    appendSignalLog({
      signal_id,
      signal_class:     body.signal_class,
      signal_timestamp: body.signal_timestamp,
      signal_nonce:     body.signal_nonce,
      node_sequence:    body.node_sequence,
      originating_node: body.originating_node,
      capability_ref:   body.capability_ref || null,
      severity:         body.severity,
      signal_payload:   body.signal_payload,
      node_signature:   body.node_signature || null,
      received_at,
    });

    db.transaction(() => {
      stmts.insertSignal.run({
        signal_id,
        signal_class:     body.signal_class,
        signal_timestamp: body.signal_timestamp,
        signal_nonce:     body.signal_nonce,
        node_sequence:    body.node_sequence,
        originating_node: body.originating_node,
        capability_ref:   body.capability_ref   || null,
        severity:         body.severity,
        signal_payload:   JSON.stringify(body.signal_payload),
        node_signature:   body.node_signature   || null,
        received_at,                                                          // AS2-001 fix: same value as JSONL
      });
      stmts.upsertNodeSeq.run(body.originating_node, body.node_sequence);
    })();
  } catch (e) {
    console.error('[storage]', e.message);
    return err(res, 500, 'STORAGE_FAULT',
      'Signal could not be durably stored (DB or log write failed).',
      e.message);
  }

  console.log(`  [signal] ${body.signal_class} ${body.severity} from ${body.originating_node}${body.capability_ref ? ' re: ' + body.capability_ref : ''}`);

  send(res, 201, {
    status:           'accepted',
    signal_id,
    signal_class:     body.signal_class,
    severity:         body.severity,
    originating_node: body.originating_node,
    received_at,
  });
}

// GET /signals — list signals with optional filtering
function handleList(req, res) {
  // Round-1 review (AS-008 fix, Option B): /signals exposes the full
  // signal_payload field, which per Spec §9 should carry only the minimum
  // identifying information necessary — but the implementation cannot enforce
  // that content policy generically. Defense-in-depth: gate /signals behind
  // the same auth check as POST /signal. When ANTHILL_ADMIN_TOKEN is unset
  // (local-only reference mode), both endpoints remain open; when set, both
  // require the Bearer token. This brings the read posture into parity with
  // the submission posture and lets operators of a public-facing instance
  // opt into auth uniformly.
  if (!requireAuth(req, res)) return;

  const q      = url.parse(req.url, true).query;

  // Pre-review-1 self-audit (AAS-PRE-002 + AAS-PRE-003): strict pagination
  // parameter validation. The prior `parseInt(q.limit || '100', 10)` accepted
  // malformed values like '10abc' (parses as 10), '-5' (parses as -5),
  // and 'foo' (parses as NaN → Math.min(NaN, 500) = NaN → query fails
  // opaquely). Validate full-string numeric with /^\d+$/ regex; check
  // bounds (limit 1-500, offset >= 0); return 400 BAD_REQUEST with a
  // clear message on failure. Pattern matches Registry round-5
  // pagination-hardening and Resolver RS3-001 strict numeric validation.
  let limit;
  if (q.limit === undefined) {
    limit = 100;
  } else if (typeof q.limit !== 'string' || !/^\d+$/.test(q.limit)) {
    return err(res, 400, 'BAD_REQUEST', `limit must be a non-negative integer string; got: "${q.limit}"`);
  } else {
    limit = parseInt(q.limit, 10);
    if (limit < 1 || limit > 500) {
      return err(res, 400, 'BAD_REQUEST', `limit must be between 1 and 500; got: ${limit}`);
    }
  }

  let offset;
  if (q.offset === undefined) {
    offset = 0;
  } else if (typeof q.offset !== 'string' || !/^\d+$/.test(q.offset)) {
    return err(res, 400, 'BAD_REQUEST', `offset must be a non-negative integer string; got: "${q.offset}"`);
  } else {
    offset = parseInt(q.offset, 10);
    // Round-1 review (AS-011 fix): cap offset at 1,000,000. The prior code
    // bounded limit (1-500) but left offset unbounded — pathologically large
    // offsets force SQLite to scan/discard many rows per request and offer
    // no useful caller behavior. 1M is generous (5,000+ pages at limit=200)
    // and bounded enough to reject obvious misuse.
    if (offset > 1000000) {
      return err(res, 400, 'BAD_REQUEST', `offset must be ≤ 1,000,000; got: ${offset}`);
    }
  }

  const params = {
    class:    q.class    || null,
    severity: q.severity || null,
    node:     q.node     || null,
    cap:      q.cap      || null,
    limit,
    offset,
  };

  // Validate filter values if provided
  if (params.class && !SIGNAL_CLASSES.includes(params.class)) {
    return err(res, 400, 'BAD_REQUEST', `class must be one of: ${SIGNAL_CLASSES.join(', ')}`);
  }
  if (params.severity && !SEVERITIES.includes(params.severity)) {
    return err(res, 400, 'BAD_REQUEST', `severity must be one of: ${SEVERITIES.join(', ')}`);
  }

  const records = stmts.listSignals.all(params);
  const total   = stmts.countSignals.get(params).n;

  send(res, 200, {
    status:  'ok',
    total,
    count:   records.length,
    offset,
    limit,
    signals: records.map(r => ({
      ...r,
      signal_payload: JSON.parse(r.signal_payload),
    })),
  });
}

// GET /aggregate — current aggregation window snapshots, per Spec §5
//
// Round-2 review (AS2-002, Option C): /aggregate now returns BOTH window
// views in parallel. Spec §8 acknowledges that submitting nodes may
// supply backdated, forward-dated, or imprecise signal_timestamp values
// without detection. Returning event_time (caller-supplied) AND
// received_time (Anthill-controlled) windows side-by-side lets stewards
// see both views; comparing them is itself diagnostic — large divergence
// suggests clock drift or deliberate timestamp manipulation in the
// resolver fleet. Neither view is "the right one"; they answer different
// questions.
function handleAggregate(req, res) {
  // Compute one severity-rollup over a row set: bySeverity map, total,
  // max_severity (via SEVERITY_RANK, not SQL lex order — AS-002 fix).
  function rollup(rows) {
    const bySev  = Object.fromEntries(rows.map(r => [r.severity, r.count]));
    const total  = rows.reduce((s, r) => s + r.count, 0);
    const maxSev = rows.reduce((best, r) => {
      if (best === null) return r.severity;
      return (SEVERITY_RANK[r.severity] || 0) > (SEVERITY_RANK[best] || 0) ? r.severity : best;
    }, null);
    return { total, by_severity: bySev, max_severity: maxSev };
  }

  const now    = new Date();
  const windows = {};

  for (const [cls, secs] of Object.entries(WINDOW_SECONDS)) {
    const since = new Date(now.getTime() - secs * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

    const eventRows    = stmts.windowAggregate.all({ class: cls, since });
    const receivedRows = stmts.windowAggregateByReceivedAt.all({ class: cls, since });

    windows[cls] = {
      window_label:   WINDOW_LABELS[secs],
      window_seconds: secs,
      since,
      // Event-time window: membership by caller-supplied signal_timestamp.
      // Vulnerable to node clock manipulation; useful for event-time
      // analysis and matching the timestamp on the wire to the signal.
      event_time:    rollup(eventRows),
      // Received-time window: membership by server-controlled received_at.
      // Robust to clock manipulation; the right view for live stewardship
      // and ingestion-rate analysis.
      received_time: rollup(receivedRows),
    };
  }

  send(res, 200, {
    status:         'ok',
    aggregation_at: nowUTC(),
    windows,
  });
}

// GET /summary — ecosystem health summary, per Spec §6
function handleSummary(req, res) {
  // Round-1 review (AS-008, wider-scope sweep): /summary exposes
  // originating_node and capability_ref in the recent_critical array — the
  // same class of identifier the reviewer cited as sensitive when calling
  // out /signals. Apply the same auth gate. /aggregate stays open because
  // it exposes counts and severities only, no identifiers, matching the
  // stewardship-visibility framing of Spec §5.
  if (!requireAuth(req, res)) return;

  const total          = stmts.totalCount.get().n;
  const by_class       = stmts.classBreakdown.all();
  const recent_critical = stmts.recentCritical.all();

  send(res, 200, {
    status:           'ok',
    summary_at:       nowUTC(),
    total_signals:    total,
    by_class,
    recent_critical,
    public_key_url:   'https://dillweed.com/dnso_public.pem',
    spec_url:         'https://dillweed.com/anthill-spec.html',
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

// Round-1 review (AS-009 fix): path-method map for 405 Method Not Allowed
// when a known path is hit with the wrong method. Prior code returned 404
// for any (method, path) miss, including cases where the path exists but
// the method doesn't match — which is misleading to clients and machine-
// readable callers. RFC 9110: when the path is recognized but the method
// isn't supported, return 405 with an Allow header listing the supported
// methods. Unknown paths still return 404.
const ROUTES = {
  '/health':    ['GET'],
  '/signal':    ['POST'],
  '/signals':   ['GET'],
  '/aggregate': ['GET'],
  '/summary':   ['GET'],
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const pathname = url.parse(req.url).pathname;

  try {
    if (req.method === 'GET'  && pathname === '/health')    return handleHealth(req, res);
    if (req.method === 'POST' && pathname === '/signal')    return await handleSignal(req, res);
    if (req.method === 'GET'  && pathname === '/signals')   return handleList(req, res);
    if (req.method === 'GET'  && pathname === '/aggregate') return handleAggregate(req, res);
    if (req.method === 'GET'  && pathname === '/summary')   return handleSummary(req, res);

    // No exact (method, path) match. If the path is known, this is a 405.
    if (Object.prototype.hasOwnProperty.call(ROUTES, pathname)) {
      const allowed = ROUTES[pathname];
      res.setHeader('Allow', allowed.join(', '));
      return err(res, 405, 'METHOD_NOT_ALLOWED',
        `${req.method} not allowed on ${pathname}. Allowed: ${allowed.join(', ')}.`);
    }
    err(res, 404, 'NOT_FOUND', `No route: ${req.method} ${pathname}`);
  } catch (e) {
    console.error('[error]', e.message);
    err(res, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
});

// ── Startup ───────────────────────────────────────────────────────────────────

const n    = stmts.totalCount.get().n;
const auth = ADMIN_TOKEN ? 'token required' : 'open (set ANTHILL_ADMIN_TOKEN to secure)';

server.listen(PORT, '127.0.0.1', () => {
  // Banner version line uses VERSION as single source of truth; the
  // trademark-bearing "Dillweed Anthill™" prefix is human-readable branding.
  // The version portion is parsed out of VERSION so the banner can't drift
  // from the /health response.
  const versionStr = VERSION.split('/').pop();   // 'dillweed-anthill/0.1.5' → '0.1.4'
  const bannerLine = `Dillweed Anthill\u2122  v${versionStr}`;
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════╗');
  console.log(`  ║     ${bannerLine.padEnd(42)}║`);
  console.log('  ║     dillweed.com/anthill-spec.html            ║');
  console.log('  ╠═══════════════════════════════════════════════╣');
  console.log(`  ║  Listening   http://127.0.0.1:${PORT}              ║`);
  console.log(`  ║  Database    data/anthill.db  (${String(n).padEnd(3)} signals)  ║`);
  console.log(`  ║  Log         logs/signals.log                 ║`);
  console.log(`  ║  Auth        ${auth.padEnd(33)}║`);
  console.log('  ╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log('  Endpoints:');
  console.log(`    GET   http://localhost:${PORT}/health`);
  console.log(`    POST  http://localhost:${PORT}/signal`);
  console.log(`    GET   http://localhost:${PORT}/signals`);
  console.log(`    GET   http://localhost:${PORT}/aggregate`);
  console.log(`    GET   http://localhost:${PORT}/summary`);
  console.log('');

  // ── Local-Key Advisory ─────────────────────────────────────────────────────
  // Anthill aggregates signals from resolver nodes and Registry operations.
  // While Anthill itself does not sign Capability Records (that's the Registry's
  // role), the Dillweed stack's broader trust model — and the question of
  // whether this instance is part of the canonical Dillweed Namespace — applies
  // to Anthill operationally. See README.md "Trust Roots and Local Keys"
  // and dillweed.com/implementing-dillweed.html §08.
  console.log('  ╔══════════════════════════════════════════════════════════════════════╗');
  console.log('  ║                                                                      ║');
  console.log('  ║  \u26A0  LOCAL-INSTANCE ADVISORY                                         ║');
  console.log('  ║                                                                      ║');
  console.log('  ║  This is a local Dillweed Anthill instance. Signals aggregated here  ║');
  console.log('  ║  are NOT part of the canonical Dillweed Namespace observability      ║');
  console.log('  ║  plane that, when publicly deployed, will be operated under DNSO     ║');
  console.log('  ║  authority. They are visible only within this local deployment.      ║');
  console.log('  ║                                                                      ║');
  console.log('  ║  The canonical Dillweed Namespace, when publicly deployed, will be   ║');
  console.log('  ║  operated under DNSO authority. Its trust root is verifiable         ║');
  console.log('  ║  against the public key published at:                                ║');
  console.log('  ║                                                                      ║');
  console.log('  ║      https://dillweed.com/dnso_public.pem                            ║');
  console.log('  ║                                                                      ║');
  console.log('  ║  This advisory is informational, not an error. The service will      ║');
  console.log('  ║  continue normally. See dillweed.com/implementing-dillweed.html §08. ║');
  console.log('  ║                                                                      ║');
  console.log('  ╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Ready — press Ctrl+C to stop.');
  console.log('');
});
