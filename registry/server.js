#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Dillweed Registry  v0.2.8
//  Authoritative capability record store for the Dillweed Namespace
//  https://dillweed.com/registry-spec.html
//
//  Run setup.js first, then: node server.js
//  Requires Node.js 14+  |  better-sqlite3
//
//  v0.2.2 changes (targeting Registry Spec v0.1.4):
//    - Signing consistency fix (§5.2): handleRegister now includes
//      input_schema and output_schema in the toSign payload so records
//      registered via POST /register verify successfully via GET /verify.
//      Previously only setup.js seed records were signed correctly.
//    - Validation aggregation (§7): validateRecord now gathers ALL errors
//      in a single pass rather than short-circuiting after required-field
//      checks, so callers receive every failure simultaneously.
//    - Planned key rotation (§5.6): GET /pubkey supports ?previous=true
//      to serve a prior public key during the overlap window.
//      See rotate-key.js for the rotation tool.
//    - Audit log surfaces rotation events alongside register/revoke/promote.
//
//  v0.2.1 changes:
//    - canonicalJSON now includes input_schema and output_schema in signed fields
//    - handleVerify passes input_schema and output_schema to signature verification
//      (aligns with Registry Specification v0.1.4 expanded signing model)
//  v0.2 changes:
//    - /health exposes schema_version, deployment_mode, and mirror freshness
//      fields (authoritative_snapshot_timestamp, authoritative_signature_hash)
//      when REGISTRY_MODE=mirror
//    - /register logs provisional tier warning to audit trail when registrant
//      self-assigns verified or canonical tier
//    - REGISTRY_MODE env var: 'authoritative' (default) | 'mirror' | 'local'
// ─────────────────────────────────────────────────────────────────────────────

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const url    = require('url');

const PORT         = parseInt(process.env.REGISTRY_PORT || '9475', 10);
const DB_PATH      = path.join(__dirname, 'data', 'registry.db');
const PRIVKEY_PATH          = path.join(__dirname, 'keys', 'dnso_private.pem');
const PUBKEY_PATH           = path.join(__dirname, 'keys', 'dnso_public.pem');
const PUBKEY_PREVIOUS_PATH  = path.join(__dirname, 'keys', 'dnso_public_previous.pem');
const VERSION      = 'dillweed-registry/0.2.8';
const REGISTRY_MODE = (process.env.REGISTRY_MODE || 'authoritative').toLowerCase();
const COMPONENT_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]{2}$/;
const VALID_TIERS  = new Set(['experimental','trusted','verified','canonical']);
const VALID_PROTOS = new Set(['rest','mcp','a2a','grpc','custom']);

// Tiers that require DNSO attestation — self-assignment is provisional only
const PROVISIONAL_TIERS = new Set(['verified','canonical']);

// ── Guards ────────────────────────────────────────────────────────────────────

let Database;
try   { Database = require('better-sqlite3'); }
catch { die('better-sqlite3 not installed. Run: npm install'); }

if (!fs.existsSync(DB_PATH))      die('Database not found. Run: node setup.js');
if (!fs.existsSync(PRIVKEY_PATH)) die('Private key not found. Run: node setup.js');

function die(msg) { console.error('\n  ERROR: ' + msg + '\n'); process.exit(1); }

// ── Database ──────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Prepared statements — compiled once at startup
const stmts = {
  lookupByName:    db.prepare(`SELECT * FROM capabilities WHERE name=? AND revoked=0 ORDER BY version DESC`),
  lookupExact:     db.prepare(`SELECT * FROM capabilities WHERE name=? AND version=? AND revoked=0 LIMIT 1`),
  // /list pagination is pushed into SQL via LIMIT/OFFSET rather than fetching the
  // full result set and slicing it in JS — this closes the in-memory full-scan
  // and the 500-record truncation cliff (v2 design §2.2.7; F-10 / Registry review
  // S3). A deterministic ORDER BY (name, version) keeps paging stable across
  // requests when a name carries multiple versions.
  listAll:         db.prepare(`SELECT * FROM capabilities WHERE revoked=0 ORDER BY name, version LIMIT ? OFFSET ?`),
  listByTier:      db.prepare(`SELECT * FROM capabilities WHERE trust_tier=? AND revoked=0 ORDER BY name, version LIMIT ? OFFSET ?`),
  listByTag:       db.prepare(`SELECT * FROM capabilities WHERE tags LIKE ? AND revoked=0 ORDER BY name, version LIMIT ? OFFSET ?`),
  countActive:     db.prepare(`SELECT COUNT(*) as n FROM capabilities WHERE revoked=0`),
  countByTier:     db.prepare(`SELECT trust_tier, COUNT(*) as n FROM capabilities WHERE revoked=0 GROUP BY trust_tier`),
  // Per-filter totals for the /list `total` field: the returned page is bounded
  // by LIMIT, so `total` must be a separate COUNT over the full filtered set.
  countByTierOne:  db.prepare(`SELECT COUNT(*) as n FROM capabilities WHERE trust_tier=? AND revoked=0`),
  countByTag:      db.prepare(`SELECT COUNT(*) as n FROM capabilities WHERE tags LIKE ? AND revoked=0`),
  insert:          db.prepare(`
    INSERT INTO capabilities
      (name, description, endpoint, protocol, input_schema, output_schema,
       trust_tier, permissions, version, signature, registration_date, last_updated, tags)
    VALUES
      (@name, @description, @endpoint, @protocol, @input_schema, @output_schema,
       @trust_tier, @permissions, @version, @signature, @registration_date, @last_updated, @tags)
  `),
  revoke:          db.prepare(`UPDATE capabilities SET revoked=1, revoke_reason=?, updated_at=datetime('now') WHERE name=? AND version=? AND revoked=0`),
  revokeAll:       db.prepare(`UPDATE capabilities SET revoked=1, revoke_reason=?, updated_at=datetime('now') WHERE name=? AND revoked=0`),
  updateTier:      db.prepare(`UPDATE capabilities SET trust_tier=?, updated_at=datetime('now') WHERE name=? AND version=? AND revoked=0`),
  // Post-review fix (AUDIT-REG-005): /promote MUST re-sign the record after
  // changing trust_tier, because trust_tier is part of the signed canonical JSON
  // (Registry Spec §5.2). The stored signature must reflect the current data;
  // otherwise the next /verify call against this record will fail.
  updateTierAndSign: db.prepare(`UPDATE capabilities SET trust_tier=?, last_updated=?, signature=?, updated_at=datetime('now') WHERE name=? AND version=? AND revoked=0`),
  logAction:       db.prepare(`INSERT INTO registration_log (action, name, version, detail, caller) VALUES (@action, @name, @version, @detail, @caller)`),
  // W0 / v2 design §2.2.1 (ETag conditional reads on /list). Seed the in-memory
  // catalog version and last-modified time from the persistent registration log
  // at startup so the /list ETag survives a process restart and never collides
  // (a restart-reset counter could re-issue an old ETag for different content).
  countCatalogOps:   db.prepare(`SELECT COUNT(*) AS n FROM registration_log WHERE action IN ('register','revoke','promote')`),
  lastCatalogChange: db.prepare(`SELECT created_at FROM registration_log WHERE action IN ('register','revoke','promote') ORDER BY id DESC LIMIT 1`),
  // NS-004: GET /log endpoint queries (Registry Spec v0.1.4 §04).
  // Filtering is applied via dynamic SQL in handleLog because the combinations
  // are small (4 possibilities: no filter / name / action / name+action) and
  // composing them in code is clearer than four separate prepared statements.
  // Ordering is always ascending by id (== chronological since id is monotonic).
};

// ── Signing ───────────────────────────────────────────────────────────────────

const privateKeyPem = fs.readFileSync(PRIVKEY_PATH, 'utf8');
const publicKeyPem  = fs.readFileSync(PUBKEY_PATH,  'utf8');

function canonicalJSON(record) {
  const fields = ['description','endpoint','input_schema','last_updated','name',
                  'output_schema','permissions','protocol','trust_tier','version'];
  const obj = {};
  for (const f of fields) { if (record[f] !== undefined) obj[f] = record[f]; }
  return JSON.stringify(obj);
}

function sign(record) {
  const payload = canonicalJSON(record);
  const sig = crypto.sign(null, Buffer.from(payload),
    { key: privateKeyPem, dsaEncoding: 'ieee-p1363' });
  return 'dnso_v1_' + sig.toString('base64url');
}

function verify(record) {
  if (!record.signature || !record.signature.startsWith('dnso_v1_')) return false;
  try {
    const sigBuf  = Buffer.from(record.signature.slice('dnso_v1_'.length), 'base64url');
    const payload = canonicalJSON(record);
    return crypto.verify(null, Buffer.from(payload),
      { key: publicKeyPem, dsaEncoding: 'ieee-p1363' }, sigBuf);
  } catch { return false; }
}

// ── Record Serialization ──────────────────────────────────────────────────────

function toAPI(row) {
  if (!row) return null;
  // Per Registry Spec v0.1.4 §5.2: absent schemas are omitted, not null/empty.
  // Preserve the distinction between "schema provided (possibly empty object)"
  // and "no schema provided" by returning undefined when the DB column is NULL.
  // Callers that need a JSON-shaped response should JSON.stringify — undefined
  // properties are naturally dropped by JSON.stringify.
  return {
    name:              row.name,
    description:       row.description,
    endpoint:          row.endpoint,
    protocol:          row.protocol,
    input_schema:      row.input_schema  != null ? tryParse(row.input_schema,  {}) : undefined,
    output_schema:     row.output_schema != null ? tryParse(row.output_schema, {}) : undefined,
    trust_tier:        row.trust_tier,
    permissions:       tryParse(row.permissions,   []),
    version:           row.version,
    signature:         row.signature,
    registration_date: row.registration_date,
    last_updated:      row.last_updated,
    tags:              tryParse(row.tags, []),
  };
}

function tryParse(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }

/* ── Semver-aware version comparison (ported from resolver) ────────────────── */
/* Returns negative if a < b, positive if a > b, zero if equal.               */
/* Handles build metadata (stripped), pre-release identifiers (§11 rules),    */
/* and numeric-vs-string identifier comparison per semver.org.                */
function compareSemver(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const stripBuild = v => v.split('+')[0];
  const va = stripBuild(a);
  const vb = stripBuild(b);

  const splitPre = v => {
    const idx = v.indexOf('-');
    return idx === -1 ? [v, null] : [v.slice(0, idx), v.slice(idx + 1)];
  };
  const [mainA, preA] = splitPre(va);
  const [mainB, preB] = splitPre(vb);

  const partsA = mainA.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = mainB.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const ai = partsA[i] || 0;
    const bi = partsB[i] || 0;
    if (ai !== bi) return ai - bi;
  }

  if (preA === null && preB === null) return 0;
  if (preA === null) return 1;
  if (preB === null) return -1;

  const idsA = preA.split('.');
  const idsB = preB.split('.');
  const ilen = Math.max(idsA.length, idsB.length);
  for (let i = 0; i < ilen; i++) {
    if (idsA[i] === undefined) return -1;
    if (idsB[i] === undefined) return 1;
    const numA = /^\d+$/.test(idsA[i]) ? parseInt(idsA[i], 10) : null;
    const numB = /^\d+$/.test(idsB[i]) ? parseInt(idsB[i], 10) : null;
    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA - numB;
    } else if (numA !== null) {
      return -1;
    } else if (numB !== null) {
      return 1;
    } else if (idsA[i] !== idsB[i]) {
      return idsA[i] < idsB[i] ? -1 : 1;
    }
  }
  return 0;
}

// Validates a string against RFC 3339 second-precision UTC date-time format
// (YYYY-MM-DDTHH:MM:SSZ) with calendar/clock-component validity. Used by both
// the last_updated validator and the mirror-freshness env-var validator
// (post-review-3 addition). Returns true only if the shape regex matches AND
// the components survive Date.UTC round-trip (rejecting impossible values
// like 2026-99-99T99:99:99Z that pass shape but fail semantics).
function isValidRfc3339UtcSecondPrecision(s) {
  if (typeof s !== 'string') return false;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
  if (!m) return false;
  const Y = Number(m[1]), M = Number(m[2]), D = Number(m[3]);
  const H = Number(m[4]), N = Number(m[5]), S = Number(m[6]);
  if (M < 1 || M > 12 || D < 1 || D > 31) return false;
  if (H > 23 || N > 59 || S > 59) return false;
  const dt = new Date(Date.UTC(Y, M - 1, D, H, N, S));
  return dt.getUTCFullYear() === Y &&
         dt.getUTCMonth()    === M - 1 &&
         dt.getUTCDate()     === D &&
         dt.getUTCHours()    === H &&
         dt.getUTCMinutes()  === N &&
         dt.getUTCSeconds()  === S;
}

// Shared pagination parser for /list and /log (post-review-5 fix). Uses a
// /^\d+$/ regex pre-check before parsing, rejecting malformed numeric-prefix
// values like "10abc", fractional values like "1.5", and alternative radixes
// like "0x10" that parseInt() would otherwise silently coerce. Returns either
// {limit, offset} on success or {error: message} on failure. Both endpoints
// must call this with the URL query object; defaults differ per endpoint
// only by sharing the same 100/0 baseline values.
function parsePagination(q) {
  const limitText  = q.limit  !== undefined ? String(q.limit)  : '100';
  const offsetText = q.offset !== undefined ? String(q.offset) : '0';
  if (!/^\d+$/.test(limitText)) {
    return { error: 'limit must be an integer between 1 and 500.' };
  }
  if (!/^\d+$/.test(offsetText)) {
    return { error: 'offset must be a non-negative integer.' };
  }
  const limit  = Number(limitText);
  const offset = Number(offsetText);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    return { error: 'limit must be an integer between 1 and 500.' };
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return { error: 'offset must be a non-negative integer.' };
  }
  return { limit, offset };
}

// ── Validation ────────────────────────────────────────────────────────────────
//
// Per Registry Spec v0.1.4 §7: "A submission that fails any rule is rejected
// with 422 VALIDATION_FAILED and a structured errors array listing every
// failure simultaneously — callers receive all problems in a single response."
// This function MUST collect every failure rather than short-circuiting.

function validateRecord(body) {
  const errors = [];
  const required = ['name','description','endpoint','protocol','trust_tier','version'];

  // Track which required fields are present-and-string so downstream
  // field-specific checks can run only against valid inputs.
  const hasString = f => typeof body[f] === 'string' && body[f].trim().length > 0;

  for (const f of required) {
    if (!hasString(f)) errors.push(`Missing or empty required field: "${f}"`);
  }

  // Name structure — only checked if name is a usable string; otherwise the
  // missing-field error above already tells the caller what they need to fix.
  if (hasString('name')) {
    const parts = body.name.split('.');
    if (parts.length < 2) {
      errors.push('name: must have at least two dot-separated components.');
    } else {
      for (const p of parts) {
        if (!COMPONENT_RE.test(p)) {
          errors.push(`name: component "${p}" must be 2–64 lowercase chars, digits, or hyphens.`);
        }
      }
    }
  }

  if (hasString('trust_tier') && !VALID_TIERS.has(body.trust_tier)) {
    errors.push(`trust_tier: must be one of: ${[...VALID_TIERS].join(', ')}`);
  }

  if (hasString('protocol') && !VALID_PROTOS.has(body.protocol)) {
    errors.push(`protocol: must be one of: ${[...VALID_PROTOS].join(', ')}`);
  }

  if (body.permissions !== undefined && !Array.isArray(body.permissions)) {
    errors.push('permissions: must be an array of strings.');
  }

  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    errors.push('tags: must be an array of strings.');
  }

  if (body.input_schema !== undefined &&
      (typeof body.input_schema !== 'object' || Array.isArray(body.input_schema) || body.input_schema === null)) {
    errors.push('input_schema: must be a JSON object if provided.');
  }

  if (body.output_schema !== undefined &&
      (typeof body.output_schema !== 'object' || Array.isArray(body.output_schema) || body.output_schema === null)) {
    errors.push('output_schema: must be a JSON object if provided.');
  }

  if (hasString('endpoint')) {
    try {
      const parsed = new url.URL(body.endpoint);
      // Registry Spec §7 Registration Requirements explicitly states:
      // "endpoint Required. Must parse as a valid URL. HTTP and HTTPS
      // accepted; custom schemes rejected." This restriction was initially
      // misclassified during Pass 3 as defense-in-depth tightening because
      // only §3.1 Field Definitions (relaxed wording) was consulted; the
      // strict requirement lives in §7 and was caught by external review.
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push('endpoint: scheme must be http or https (per Registry Spec §7).');
      }
    } catch {
      errors.push('endpoint: must be a valid URL.');
    }
  }

  // Post-review fix (AUDIT-REG-008): Registry Spec §3.1 defines `version` as
  // "Semver string for the capability implementation." Validate that the
  // submitted value matches semver.org §11 grammar: MAJOR.MINOR.PATCH with
  // optional pre-release identifier (e.g., "1.0.0", "2.3.1-beta", "1.0.0-rc.1").
  if (hasString('version')) {
    // Strict semver.org §11 precedence grammar — rejects leading-zero numeric
    // identifiers and malformed prerelease identifiers. Tightened post-review-2
    // from a looser pattern that accepted forms like "01.0.0".
    const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    if (!SEMVER_RE.test(body.version)) {
      errors.push('version: must be a semver-formatted string (e.g., "1.0.0" or "2.3.1-beta") per Registry Spec §3.1.');
    }
  }

  // Post-review fix (AUDIT-REG-009): Registry Spec §3.1 defines
  // `registration_date` as "RFC 3339 full-date (YYYY-MM-DD)". The registry
  // defaults this field at write time if absent, but if a caller supplies it,
  // it must match the spec-mandated format. This mirrors NS-002 for
  // `last_updated` (date-time) with the date-only shape.
  if (body.registration_date !== undefined) {
    const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    let regDateOk = (typeof body.registration_date === 'string') && FULL_DATE_RE.test(body.registration_date);
    if (regDateOk) {
      // Calendar-validity check (tightened post-review-2): the regex above
      // only validates shape; values like "2026-99-99" would pass. Parse the
      // components and verify they round-trip through Date construction to
      // catch impossible dates (month > 12, day > days-in-month, etc.).
      const [yy, mm, dd] = body.registration_date.split('-').map(Number);
      const dt = new Date(Date.UTC(yy, mm - 1, dd));
      regDateOk =
        dt.getUTCFullYear() === yy &&
        dt.getUTCMonth()    === mm - 1 &&
        dt.getUTCDate()     === dd;
    }
    if (!regDateOk) {
      errors.push('registration_date: must be RFC 3339 full-date (YYYY-MM-DD) with calendar-valid components per Registry Spec §3.1.');
    }
  }

  // Per Namespace Standard §4.1 and Registry Spec §3.1: last_updated MUST be
  // strict RFC 3339 date-time in UTC with second precision (YYYY-MM-DDTHH:MM:SSZ).
  // Non-UTC offsets and fractional seconds MUST NOT be used. Reject anything else
  // when the caller supplies the field; the registry normally generates it
  // automatically and overrides any caller value, but defense-in-depth: validate
  // the input shape regardless.
  if (body.last_updated !== undefined) {
    // Use the same calendar/clock-validity helper as mirror freshness
    // validation. Previously this used a shape-only regex, which accepted
    // impossible values like 2026-99-99T99:99:99Z that survived shape but
    // failed semantics. Tightened post-review-3 (deferral reconsidered)
    // to remove an internal inconsistency: mirror freshness path uses
    // strict validity, but the record-field validation should as well.
    // /register normally generates this field server-side, so this
    // matters only when callers explicitly supply it.
    if (!isValidRfc3339UtcSecondPrecision(body.last_updated)) {
      errors.push('last_updated: must be RFC 3339 date-time in UTC with second precision (YYYY-MM-DDTHH:MM:SSZ) with calendar-valid components. Non-UTC offsets and fractional seconds are not permitted.');
    }
  }

  return errors;
}

// ── Admin Auth ────────────────────────────────────────────────────────────────
// Simple token check. Set REGISTRY_ADMIN_TOKEN env var to protect write endpoints.
// If not set, all writes are permitted (local dev default).

const ADMIN_TOKEN = process.env.REGISTRY_ADMIN_TOKEN || null;

function isAuthorized(req) {
  if (!ADMIN_TOKEN) return true;
  const auth = req.headers['authorization'] || '';
  return auth === `Bearer ${ADMIN_TOKEN}`;
}

// ── HTTP Helpers ──────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((res, rej) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 256*1024) rej(new Error('Body too large')); });
    req.on('end',  () => { try { res(JSON.parse(body || '{}')); } catch { rej(new Error('Invalid JSON')); } });
    req.on('error', rej);
  });
}

function send(res, status, body, extraHeaders) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(json),
    'X-Registry':     VERSION,
    ...(extraHeaders || {}),
  });
  res.end(json);
}

function err(res, status, code, message, detail) {
  send(res, status, { status:'error', error_code:code, message, detail: detail||null });
}

function caller(req) {
  return req.headers['x-dillclaw-caller'] || req.headers['x-registry-caller'] || 'anonymous';
}

// ── Catalog version (v2 design §2.2.1: conditional reads on /list) ─────────────
// The steady-state resolver poll re-fetches the whole catalog every refresh even
// when nothing changed. Tagging /list with a strong ETag (and Last-Modified) lets
// an unchanged catalog answer 304 Not Modified — a header exchange instead of a
// full-snapshot transfer. Non-breaking: callers that send no conditional header
// get the same 200 as before (v2 design §2.2.1, §2.3 step 1).
//
// `catalogVersion` is a monotonic counter bumped on every catalog-mutating
// operation (register, revoke, promote). It is seeded at startup from the count
// of those operations already in the registration log, so the ETag is stable
// across restarts and an old ETag is never re-issued for different content.
let catalogVersion   = stmts.countCatalogOps.get().n;
let catalogModified  = (() => {
  const row = stmts.lastCatalogChange.get();
  // SQLite datetime('now') is 'YYYY-MM-DD HH:MM:SS' in UTC.
  return row ? new Date(row.created_at.replace(' ', 'T') + 'Z') : new Date();
})();

function bumpCatalogVersion() {
  catalogVersion++;
  catalogModified = new Date();
}

// Strong validator, quoted per RFC 7232 §2.3.
function catalogETag() {
  return `"cat-${catalogVersion.toString(16)}"`;
}

// HTTP-date (RFC 7231) with 1-second granularity. Truncate the live timestamp to
// whole seconds so an If-Modified-Since echo of our own Last-Modified compares
// equal rather than appearing stale by sub-second drift.
function catalogLastModified() {
  return new Date(Math.floor(catalogModified.getTime() / 1000) * 1000).toUTCString();
}

// RFC 7232 §3.2: If-None-Match uses weak comparison and may carry a list and a
// "*" wildcard. We emit strong tags; strip an optional weak prefix and accept a
// comma-separated list so a well-behaved client always matches its own validator.
function ifNoneMatchHits(headerValue, etag) {
  if (!headerValue) return false;
  if (headerValue.trim() === '*') return true;
  return headerValue.split(',').some(t => {
    t = t.trim();
    if (t.startsWith('W/')) t = t.slice(2);
    return t === etag;
  });
}

// RFC 7232 §3.3: 304 if the catalog has not been modified after the supplied
// HTTP-date. An unparseable date is ignored (treated as no precondition).
function ifModifiedSinceHits(headerValue) {
  if (!headerValue) return false;
  const since = Date.parse(headerValue);
  if (Number.isNaN(since)) return false;
  return Math.floor(catalogModified.getTime() / 1000) * 1000 <= since;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// GET /health
function handleHealth(req, res) {
  const total      = stmts.countActive.get();
  const tierCounts = {};
  for (const row of stmts.countByTier.all()) tierCounts[row.trust_tier] = row.n;

  // Read schema_version from meta table
  const schemaMeta = db.prepare(`SELECT value FROM meta WHERE key='schema_version'`).get();
  const schemaVersion = schemaMeta ? schemaMeta.value : '1';

  const response = {
    status:           'ok',
    registry_version: VERSION,
    schema_version:   schemaVersion,
    deployment_mode:  REGISTRY_MODE,
    capabilities:     total.n,
    by_tier:          tierCounts,
    signing:          'Ed25519 (DNSO)',
    public_key_url:   'https://dillweed.com/dnso_public.pem',
    uptime_seconds:   Math.floor(process.uptime()),
    timestamp:        new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    rate_limit:       rateLimitConfig(),
  };

  // Key rotation overlap status (Registry Spec v0.1.4 §5.6). When a previous
  // public key is present on disk, the registry is inside a rotation overlap
  // window and both keys are verifiable. Resolvers that cached the old key
  // can continue verifying old-signed records against the previous key while
  // they refresh to the current key.
  if (fs.existsSync(PUBKEY_PREVIOUS_PATH)) {
    const prevKeyUrl = process.env.PREVIOUS_KEY_URL || '/pubkey?previous=true';
    response.key_rotation = {
      overlap_active:       true,
      previous_key_url:     prevKeyUrl,
      rotation_started_at:  process.env.ROTATION_STARTED_AT  || null,
      rotation_ends_at:     process.env.ROTATION_ENDS_AT     || null,
    };
  }

  // Mirror mode: expose freshness fields required by Registry Spec v0.1.4 §10.3
  // These allow resolvers to detect stale, split-brain, or tampered mirrors.
  // Set AUTHORITATIVE_SNAPSHOT_TIMESTAMP and AUTHORITATIVE_SIGNATURE_HASH
  // env vars when running as a mirror, updated by your sync process.
  //
  // Tightened post-review-2: if the freshness env vars are absent or empty
  // while the registry runs in mirror mode, /health returns
  // status: 'degraded' rather than 'ok'. A mirror without freshness data
  // cannot be safely consumed; presenting it as healthy would hide
  // operator misconfiguration that resolvers cannot detect from the
  // protocol surface alone.
  //
  // Tightened post-review-3: presence is no longer sufficient — values must
  // also be well-formed. authoritative_snapshot_timestamp must be RFC 3339
  // second-precision UTC date-time with calendar-valid components.
  // authoritative_signature_hash must be a lowercase hex SHA-256 (64 hex
  // chars). Malformed values (banana, not-a-sha256, etc.) now degrade.
  if (REGISTRY_MODE === 'mirror') {
    const snapTs  = process.env.AUTHORITATIVE_SNAPSHOT_TIMESTAMP || null;
    const snapSig = process.env.AUTHORITATIVE_SIGNATURE_HASH || null;
    response.authoritative_snapshot_timestamp = snapTs;
    response.authoritative_signature_hash     = snapSig;
    response.mirror_warning =
      'This is a read-only mirror. Writes are not accepted. ' +
      'Verify freshness via authoritative_snapshot_timestamp.';
    const tsOk   = isValidRfc3339UtcSecondPrecision(snapTs);
    const hashOk = typeof snapSig === 'string' && /^[a-f0-9]{64}$/.test(snapSig);
    if (!tsOk || !hashOk) {
      response.status = 'degraded';
      const problems = [];
      if (!snapTs)        problems.push('AUTHORITATIVE_SNAPSHOT_TIMESTAMP is missing');
      else if (!tsOk)     problems.push('AUTHORITATIVE_SNAPSHOT_TIMESTAMP is not a valid RFC 3339 UTC date-time (YYYY-MM-DDTHH:MM:SSZ with calendar-valid components)');
      if (!snapSig)       problems.push('AUTHORITATIVE_SIGNATURE_HASH is missing');
      else if (!hashOk)   problems.push('AUTHORITATIVE_SIGNATURE_HASH is not a lowercase hex SHA-256 (64 hex characters)');
      response.mirror_warning +=
        ' WARNING: ' + problems.join('; ') +
        '. Resolvers should reject this mirror.';
    }
  }

  send(res, 200, response);
}

// GET /pubkey  — optional ?previous=true returns the prior key during a
// planned rotation overlap window (Registry Spec v0.1.4 §5.6). The prior key
// must remain verifiable for a minimum 30-day overlap so resolvers that
// cached the old key can continue verifying old-signed records while they
// refresh to the new key on their next scheduled update cycle.
function handlePubkey(req, res) {
  const q = url.parse(req.url, true).query;
  const wantsPrevious = q.previous === 'true' || q.previous === '1';

  if (wantsPrevious) {
    if (!fs.existsSync(PUBKEY_PREVIOUS_PATH)) {
      return err(res, 404, 'NOT_FOUND',
        'No previous public key is available. This registry is not in a rotation overlap window.');
    }
    const prev = fs.readFileSync(PUBKEY_PREVIOUS_PATH, 'utf8');
    res.writeHead(200, { 'Content-Type':'application/x-pem-file', 'X-Registry': VERSION });
    return res.end(prev);
  }

  res.writeHead(200, { 'Content-Type':'application/x-pem-file', 'X-Registry': VERSION });
  res.end(publicKeyPem);
}

// GET /lookup/:path   (dot-separated or slash-separated, optional ?version=)
async function handleLookup(req, res, rawPath) {
  // Post-review-4 (issue B): lowercase normalization completes the read-path
  // consistency. /promote and /revoke (write paths) normalize names since
  // round-3; /lookup, /verify, and /log?name= (read paths) now do the same,
  // accepting mixed-case input but matching against canonical storage form.
  const name    = rawPath.replace(/\//g, '.').toLowerCase();
  const query   = url.parse(req.url, true).query;
  const version = query.version || null;

  let rows;
  if (version) {
    const row = stmts.lookupExact.get(name, version);
    rows = row ? [row] : [];
  } else {
    rows = stmts.lookupByName.all(name);
    rows.sort((a, b) => -compareSemver(a.version, b.version));
  }

  if (!rows.length) {
    return err(res, 404, 'NOT_FOUND', `No active capability: ${name}${version ? ':'+version : ''}`);
  }

  const records = rows.map(toAPI);
  send(res, 200, {
    status:  'ok',
    count:   records.length,
    records,
  });
}

// GET /list   ?tier=verified &tag=search &limit=50 &offset=0
function handleList(req, res) {
  // v2 design §2.2.1 — conditional read. The validator covers the whole catalog
  // (it is bumped by every register/revoke/promote), so a matching precondition
  // lets us answer 304 before touching the DB or building the page, regardless of
  // the tier/tag/pagination query. A 304 carries the validators but no body
  // (RFC 7232 §4.1).
  const etag         = catalogETag();
  const lastModified = catalogLastModified();
  if (ifNoneMatchHits(req.headers['if-none-match'], etag) ||
      ifModifiedSinceHits(req.headers['if-modified-since'])) {
    res.writeHead(304, { 'ETag': etag, 'Last-Modified': lastModified, 'X-Registry': VERSION });
    return res.end();
  }

  const q      = url.parse(req.url, true).query;
  const tier   = q.tier  || null;
  const tag    = q.tag   || null;
  // Post-review-5 fix: pagination parsing now uses parsePagination() with a
  // /^\d+$/ regex pre-check, rejecting malformed numeric-prefix values like
  // "10abc" that parseInt() would silently coerce. Same helper is used by
  // /log so both endpoints share strictness. Replaces the round-4 attempt
  // that used parseInt-only (caught NaN but missed "10abc").
  const pag = parsePagination(q);
  if (pag.error) {
    return err(res, 400, 'BAD_REQUEST', pag.error);
  }
  const limit  = pag.limit;
  const offset = pag.offset;

  // Post-review-5 fix: reject invalid tier values rather than silently
  // falling through to listAll. Prior behavior: /list?tier=banana returned
  // all active records (surprising), because the conditional fell through
  // when the tier was non-empty but not in VALID_TIERS. Trust tiers are a
  // closed enum per Registry Spec §3.1; invalid input is caller error.
  if (tier !== null && !VALID_TIERS.has(tier)) {
    return err(res, 400, 'BAD_REQUEST', `tier must be one of: ${[...VALID_TIERS].join(', ')}`);
  }

  // SQL-level pagination (v2 design §2.2.7): the page is bounded by LIMIT/OFFSET
  // in SQL, and `total` is a separate COUNT over the full filtered set, so a
  // single page never materializes the entire catalog in memory.
  let total, rows;
  if (tier) {
    total = stmts.countByTierOne.get(tier).n;
    rows  = stmts.listByTier.all(tier, limit, offset);
  } else if (tag) {
    const pattern = `%"${tag}"%`;
    total = stmts.countByTag.get(pattern).n;
    rows  = stmts.listByTag.all(pattern, limit, offset);
  } else {
    total = stmts.countActive.get().n;
    rows  = stmts.listAll.all(limit, offset);
  }

  const records = rows.map(toAPI);

  send(res, 200, { status:'ok', total, count: records.length, offset, limit, records },
       { 'ETag': etag, 'Last-Modified': lastModified });
}

// GET /log — Registry Spec v0.1.4 §04.
// Public read of the append-only registration log. Returns entries in ascending
// id order (== chronological). Supports limit/offset pagination and optional
// filtering by name and action. Per spec: unknown query parameters MUST be
// ignored without error.
const LOG_VALID_ACTIONS = new Set(['register', 'revoke', 'promote', 'provisional_tier']);

function handleLog(req, res) {
  const q = url.parse(req.url, true).query;

  // Post-review-5 fix: pagination uses shared parsePagination() helper that
  // applies a /^\d+$/ regex pre-check. Closes a wider-scope class defect:
  // the round-4 strict-parsing fix tightened both /list and /log but used
  // parseInt-only, which silently coerced malformed numeric-prefix values
  // ("10abc" → 10, "1.5" → 1, "0x10" → 0). Reviewer correctly flagged that
  // the implementation language said "strict" while the behavior was still
  // permissive.
  const pag = parsePagination(q);
  if (pag.error) {
    return err(res, 400, 'BAD_REQUEST', pag.error);
  }
  const limitRaw  = pag.limit;
  const offsetRaw = pag.offset;
  // Parse and validate action filter
  const actionFilter = q.action || null;
  if (actionFilter !== null && !LOG_VALID_ACTIONS.has(actionFilter)) {
    return err(res, 400, 'BAD_REQUEST', `action must be one of: ${[...LOG_VALID_ACTIONS].join(', ')}`);
  }
  // Name filter normalized to canonical storage form (lowercase, slash-to-dot)
  // post-review-4 (issue B). Read-path consistency with /lookup and /verify.
  // Without normalization, /log?name=Foo.Bar would silently return zero entries
  // even though entries for the equivalent lowercase form exist.
  const nameFilter = q.name ? q.name.toLowerCase().replace(/\//g, '.') : null;

  // Compose query dynamically based on which filters are present
  const conditions = [];
  const params = {};
  if (nameFilter !== null) {
    conditions.push('name = @name');
    params.name = nameFilter;
  }
  if (actionFilter !== null) {
    conditions.push('action = @action');
    params.action = actionFilter;
  }
  const whereClause = conditions.length ? ('WHERE ' + conditions.join(' AND ')) : '';

  // Count and page
  const countSql = `SELECT COUNT(*) as n FROM registration_log ${whereClause}`;
  const total_count = db.prepare(countSql).get(params).n;

  const pageSql = `SELECT id, action, name, version, detail, caller, created_at FROM registration_log ${whereClause} ORDER BY id ASC LIMIT @limit OFFSET @offset`;
  const rows = db.prepare(pageSql).all({ ...params, limit: limitRaw, offset: offsetRaw });

  // Normalize created_at to RFC 3339 date-time form: SQLite's datetime('now')
  // produces "YYYY-MM-DD HH:MM:SS" (space separator, no Z) — convert to
  // "YYYY-MM-DDTHH:MM:SSZ" for spec conformance on response.
  const entries = rows.map(r => ({
    id:         r.id,
    action:     r.action,
    name:       r.name,
    version:    r.version,
    detail:     r.detail,
    caller:     r.caller,
    created_at: r.created_at.replace(' ', 'T') + (r.created_at.endsWith('Z') ? '' : 'Z'),
  }));

  const has_more = offsetRaw + limitRaw < total_count;
  send(res, 200, { status:'ok', entries, total_count, limit: limitRaw, offset: offsetRaw, has_more });
}

// POST /register
async function handleRegister(req, res) {
  if (!isAuthorized(req)) return err(res, 401, 'UNAUTHORIZED', 'Valid Authorization: Bearer <token> required.');

  let body;
  try   { body = await readBody(req); }
  catch (e) { return err(res, 400, 'BAD_REQUEST', e.message); }

  const errors = validateRecord(body);
  if (errors.length) {
    return send(res, 422, { status:'error', error_code:'VALIDATION_FAILED', errors });
  }

  const today  = new Date().toISOString().slice(0,10);
  // Per Namespace Standard §4.1 and Registry Spec §3.1, last_updated MUST be
  // RFC 3339 date-time in UTC with second precision (YYYY-MM-DDTHH:MM:SSZ).
  // Non-UTC offsets and fractional seconds MUST NOT be used. ISO string is
  // YYYY-MM-DDTHH:MM:SS.sssZ — strip the milliseconds to comply.
  const now_utc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  // Per Registry Spec v0.1.4 §5.2: absent input_schema/output_schema must be
  // omitted from the canonical JSON entirely (not represented as null or {}).
  // Store NULL in the DB when the registrant did not supply a schema, so the
  // "absent" state round-trips through storage and verify correctly.
  const record = {
    name:              body.name.toLowerCase(),
    description:       body.description.trim(),
    endpoint:          body.endpoint.trim(),
    protocol:          body.protocol,
    input_schema:      body.input_schema  !== undefined ? JSON.stringify(body.input_schema)  : null,
    output_schema:     body.output_schema !== undefined ? JSON.stringify(body.output_schema) : null,
    trust_tier:        body.trust_tier,
    permissions:       JSON.stringify(body.permissions || []),
    version:           body.version,
    registration_date: body.registration_date || today,
    last_updated:      now_utc,
    tags:              JSON.stringify(body.tags || []),
  };

  // Sign — per Registry Spec v0.1.4 §5.2, include input_schema and output_schema
  // when present so the signature covers executable behavior definitions.
  // When absent, they are omitted from canonical JSON entirely (not null).
  // This MUST match handleVerify's reconstruction exactly.
  const toSign = {
    name:         record.name,
    description:  record.description,
    endpoint:     record.endpoint,
    protocol:     record.protocol,
    trust_tier:   record.trust_tier,
    permissions:  body.permissions || [],
    version:      record.version,
    last_updated: record.last_updated,
  };
  if (body.input_schema  !== undefined) toSign.input_schema  = body.input_schema;
  if (body.output_schema !== undefined) toSign.output_schema = body.output_schema;
  record.signature = sign(toSign);

  try {
    db.transaction(() => {
      stmts.insert.run(record);
      stmts.logAction.run({ action:'register', name:record.name, version:record.version, detail:'API registration', caller:caller(req) });
      // v0.2: log provisional tier declaration for verified/canonical self-assignments
      if (PROVISIONAL_TIERS.has(record.trust_tier)) {
        stmts.logAction.run({
          action:  'provisional_tier',
          name:    record.name,
          version: record.version,
          detail:  `Self-assigned tier '${record.trust_tier}' is provisional pending DNSO attestation. ` +
                   `Declared tier accepted as provisional. A future resolver revision may apply weighting adjustments for unattested tiers; use /promote to record DNSO attestation.`,
          caller:  caller(req),
        });
      }
    })();
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return err(res, 409, 'ALREADY_EXISTS', `Capability ${record.name}:${record.version} already registered. Revoke existing to re-register.`);
    }
    throw e;
  }
  bumpCatalogVersion();   // catalog changed — invalidate /list ETag (v2 §2.2.1)

  const saved = stmts.lookupExact.get(record.name, record.version);
  console.log(`  [register] ${record.name}:${record.version} (${record.trust_tier})`);
  if (PROVISIONAL_TIERS.has(record.trust_tier)) {
    console.log(`  [provisional] ${record.name}:${record.version} — tier '${record.trust_tier}' is provisional pending DNSO attestation`);
  }

  const response = {
    status:     'registered',
    capability: toAPI(saved),
    message:    `Registered ${record.name}:${record.version}. Signature applied.`,
  };

  if (PROVISIONAL_TIERS.has(record.trust_tier)) {
    response.provisional_tier_notice =
      `Trust tier '${record.trust_tier}' is a provisional self-declaration. ` +
      `Use POST /promote after DNSO attestation to confirm. ` +
      `Declared tier accepted as provisional. A future resolver revision may apply weighting adjustments for unattested tiers.`;
  }

  send(res, 201, response);
}

// POST /revoke
async function handleRevoke(req, res) {
  if (!isAuthorized(req)) return err(res, 401, 'UNAUTHORIZED', 'Valid Authorization: Bearer <token> required.');

  let body;
  try   { body = await readBody(req); }
  catch (e) { return err(res, 400, 'BAD_REQUEST', e.message); }

  if (!body.name) return err(res, 400, 'BAD_REQUEST', 'Missing required field: name');
  if (typeof body.name !== 'string') {
    return err(res, 400, 'BAD_REQUEST', 'name must be a string');
  }
  // Post-review-4 (issue A): version is optional on /revoke (omitting revokes
  // all versions per Spec §8.1), but when supplied it must be a non-empty
  // string. Malformed inputs like {version: {bad: true}} previously fell
  // through to SQL driver-level errors instead of a clean 400.
  if (body.version !== undefined &&
      (typeof body.version !== 'string' || body.version.trim().length === 0)) {
    return err(res, 400, 'BAD_REQUEST', 'version must be a non-empty string when supplied');
  }

  // Post-review re-classification of AUDIT-REG-003: Registry Spec §8.1 says
  // "All revocations must include a reason string." The spec uses lowercase
  // 'must' rather than BCP-14 'MUST', which under strict BCP-14 reading would
  // be non-normative. However, the audit-trail purpose served by the reason
  // field is unambiguous, and defaulting to a placeholder degrades audit log
  // quality without operational benefit. Require an explicit non-empty reason.
  if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return err(res, 400, 'BAD_REQUEST', 'Missing required field: reason (non-empty string required for audit trail per Registry Spec §8.1)');
  }
  const reason  = body.reason.trim();
  const version = body.version || null;

  // Post-review-3 fix: normalize name consistently with /register's storage
  // representation (lowercase, slash-to-dot). Same defect class as the
  // /promote name-normalization issue the reviewer flagged; wider-scope
  // sweep caught it here too. /register normalizes at storage time;
  // /revoke must normalize at lookup time to match.
  const name = body.name.toLowerCase().replace(/\//g, '.');

  let result;
  if (version) {
    result = stmts.revoke.run(reason, name, version);
  } else {
    result = stmts.revokeAll.run(reason, name);
  }

  if (!result.changes) {
    return err(res, 404, 'NOT_FOUND', `No active capability found: ${name}${version ? ':'+version : ''}`);
  }

  stmts.logAction.run({ action:'revoke', name, version: version||'all', detail:reason, caller:caller(req) });
  bumpCatalogVersion();   // catalog changed — invalidate /list ETag (v2 §2.2.1)
  console.log(`  [revoke]   ${name}${version ? ':'+version : ' (all versions)'} — ${reason}`);

  send(res, 200, { status:'revoked', name, version: version||'all', revoked_count: result.changes });
}

// POST /promote  — change a record's trust tier
async function handlePromote(req, res) {
  if (!isAuthorized(req)) return err(res, 401, 'UNAUTHORIZED', 'Valid Authorization: Bearer <token> required.');

  let body;
  try   { body = await readBody(req); }
  catch (e) { return err(res, 400, 'BAD_REQUEST', e.message); }

  if (!body.name || !body.version || !body.trust_tier) {
    return err(res, 400, 'BAD_REQUEST', 'Required: name, version, trust_tier');
  }
  if (typeof body.name !== 'string') {
    return err(res, 400, 'BAD_REQUEST', 'name must be a string');
  }
  if (typeof body.version !== 'string' || body.version.trim().length === 0) {
    return err(res, 400, 'BAD_REQUEST', 'version must be a non-empty string');
  }
  if (!VALID_TIERS.has(body.trust_tier)) {
    return err(res, 422, 'VALIDATION_FAILED', `trust_tier must be: ${[...VALID_TIERS].join(', ')}`);
  }

  // Post-review-3 fix: normalize name consistently with /register's storage
  // representation (lowercase, slash-to-dot). Without this, callers who pass
  // mixed-case or slash-separated names get 404 even when the equivalent
  // lowercase/dot-separated record exists. /register normalizes at storage
  // time; /promote must normalize at lookup time to match.
  const name = body.name.toLowerCase().replace(/\//g, '.');

  // Post-review fix (AUDIT-REG-005): trust_tier is in the signed canonical JSON
  // (Registry Spec §5.2). Changing trust_tier without re-signing breaks the
  // cryptographic chain — /verify would correctly report signature_valid=false
  // because the stored signature was generated over the old trust_tier.
  // Load the current row, build the new signing payload, re-sign, and write
  // trust_tier + last_updated + signature together in a single UPDATE.
  const existing = stmts.lookupExact.get(name, body.version);
  if (!existing) {
    return err(res, 404, 'NOT_FOUND', `No active capability: ${name}:${body.version}`);
  }
  const current = toAPI(existing);
  const new_last_updated = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const toSign = {
    name:         current.name,
    description:  current.description,
    endpoint:     current.endpoint,
    protocol:     current.protocol,
    trust_tier:   body.trust_tier,       // new tier
    permissions:  current.permissions || [],
    version:      current.version,
    last_updated: new_last_updated,      // new timestamp
  };
  if (current.input_schema  !== undefined && current.input_schema  !== null) toSign.input_schema  = current.input_schema;
  if (current.output_schema !== undefined && current.output_schema !== null) toSign.output_schema = current.output_schema;
  const new_signature = sign(toSign);

  const result = stmts.updateTierAndSign.run(body.trust_tier, new_last_updated, new_signature, name, body.version);
  if (!result.changes) {
    return err(res, 404, 'NOT_FOUND', `No active capability: ${name}:${body.version}`);
  }

  stmts.logAction.run({ action:'promote', name, version:body.version, detail:`→ ${body.trust_tier}`, caller:caller(req) });
  bumpCatalogVersion();   // catalog changed — invalidate /list ETag (v2 §2.2.1)
  console.log(`  [promote]  ${name}:${body.version} → ${body.trust_tier} (re-signed)`);

  const updated = stmts.lookupExact.get(name, body.version);
  send(res, 200, { status:'ok', capability: toAPI(updated) });
}

// GET /verify/:path?version=  — check signature validity
async function handleVerify(req, res, rawPath) {
  // Post-review-4 (issue B): lowercase added for read-path consistency with
  // /lookup. See handleLookup for full rationale.
  const name    = rawPath.replace(/\//g, '.').toLowerCase();
  const version = url.parse(req.url, true).query.version || null;

  let row;
  if (version) {
    row = stmts.lookupExact.get(name, version);
  } else {
    const rows = stmts.lookupByName.all(name);
    rows.sort((a, b) => -compareSemver(a.version, b.version));
    row = rows[0] || null;
  }

  if (!row) return err(res, 404, 'NOT_FOUND', `No active capability: ${name}`);

  const record  = toAPI(row);
  const valid   = verify({
    name:          record.name,
    description:   record.description,
    endpoint:      record.endpoint,
    protocol:      record.protocol,
    input_schema:  record.input_schema,
    output_schema: record.output_schema,
    trust_tier:    record.trust_tier,
    permissions:   record.permissions,
    version:       record.version,
    last_updated:  record.last_updated,
    signature:     record.signature,
  });

  send(res, 200, {
    status:            'ok',
    name:              record.name,
    version:           record.version,
    signature_valid:   valid,
    signature_present: !!record.signature,
    algorithm:         'Ed25519',
    public_key_url:    'https://dillweed.com/dnso_public.pem',
  });
}

// ── Rate limiting (W0 / v2 design §4.2.2, static per-IP guard) ────────────────
// In-application backstop to the edge-proxy volumetric tier (§4.2.1): a per-IP
// fixed-window limiter with separate budgets for cheap reads and expensive
// writes (register/revoke/promote, /verify). Returns 429 + Retry-After (§4.2.2),
// a status the v1 error tables never defined. Per-identity cost-weighted quotas
// are W1 (they depend on Area 1 authenticated identity) and are out of scope here.
// /health is exempt so liveness monitors are never throttled.
//
// Defaults are generous (a normal resolver polls /list once per refresh); tune
// down per deployment via env. Set REGISTRY_RL_DISABLED=1 to turn the guard off.
const RL_DISABLED  = process.env.REGISTRY_RL_DISABLED === '1';
const RL_WINDOW_MS = parseInt(process.env.REGISTRY_RL_WINDOW_MS || '60000', 10);
const RL_READ_MAX  = parseInt(process.env.REGISTRY_RL_READ_MAX  || '300', 10);
const RL_WRITE_MAX = parseInt(process.env.REGISTRY_RL_WRITE_MAX || '100', 10);

// key `${ip}|${cls}` -> { count, windowStart }. Bounded by a periodic sweep below.
const rlBuckets = new Map();

function rlClientIp(req) {
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Expensive/state-changing requests draw from the smaller write budget.
function rlIsWrite(req, pathname) {
  return req.method === 'POST' || pathname.startsWith('/verify/');
}

// Returns null when allowed, or { retryAfter } (whole seconds) when the budget
// for this (ip, class) window is exceeded.
function rlCheck(ip, cls, max) {
  const now = Date.now();
  const key = `${ip}|${cls}`;
  let b = rlBuckets.get(key);
  if (!b || now - b.windowStart >= RL_WINDOW_MS) {
    b = { count: 0, windowStart: now };
    rlBuckets.set(key, b);
  }
  b.count++;
  if (b.count > max) {
    return { retryAfter: Math.max(1, Math.ceil((b.windowStart + RL_WINDOW_MS - now) / 1000)) };
  }
  return null;
}

// Drop stale windows so the map can't grow unbounded with distinct IPs.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rlBuckets) if (now - b.windowStart >= RL_WINDOW_MS) rlBuckets.delete(k);
}, RL_WINDOW_MS).unref();

// Operational visibility (and lets the test suite self-calibrate its burst size).
function rateLimitConfig() {
  return { enabled: !RL_DISABLED, window_ms: RL_WINDOW_MS, read_max: RL_READ_MAX, write_max: RL_WRITE_MAX };
}

// Enforce the per-IP budget. Returns true if the request was rejected (429).
function rlEnforce(req, res, pathname) {
  if (RL_DISABLED || pathname === '/health') return false;
  const cls = rlIsWrite(req, pathname) ? 'write' : 'read';
  const hit = rlCheck(rlClientIp(req), cls, cls === 'write' ? RL_WRITE_MAX : RL_READ_MAX);
  if (!hit) return false;
  res.setHeader('Retry-After', String(hit.retryAfter));
  err(res, 429, 'RATE_LIMITED',
      `Rate limit exceeded for ${cls} requests. Retry after ${hit.retryAfter}s.`);
  return true;
}

// ── Router ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DillClaw-Caller, X-Registry-Caller');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const { pathname } = url.parse(req.url);

  // Per-IP rate limit (W0 §4.2.2). Runs before routing so even rejected/invalid
  // requests count against the budget and can't be used to bypass the guard.
  if (rlEnforce(req, res, pathname)) return;

  // Mirror mode: reject all write operations
  if (REGISTRY_MODE === 'mirror' && req.method === 'POST') {
    return err(res, 405, 'METHOD_NOT_ALLOWED',
      'This registry is operating in read-only mirror mode. ' +
      'Direct registrations, revocations, and promotions are not accepted. ' +
      'Submit to the authoritative registry at dillweed.com.');
  }

  try {
    if (req.method === 'GET'  && pathname === '/health')             return handleHealth(req, res);
    if (req.method === 'GET'  && pathname === '/pubkey')             return handlePubkey(req, res);
    if (req.method === 'GET'  && pathname === '/list')               return handleList(req, res);
    if (req.method === 'GET'  && pathname === '/log')                return handleLog(req, res);
    if (req.method === 'GET'  && pathname.startsWith('/lookup/'))    return await handleLookup(req, res, pathname.slice('/lookup/'.length));
    if (req.method === 'GET'  && pathname.startsWith('/verify/'))    return await handleVerify(req, res, pathname.slice('/verify/'.length));
    if (req.method === 'POST' && pathname === '/register')           return await handleRegister(req, res);
    if (req.method === 'POST' && pathname === '/revoke')             return await handleRevoke(req, res);
    if (req.method === 'POST' && pathname === '/promote')            return await handlePromote(req, res);

    err(res, 404, 'NOT_FOUND', `No route: ${req.method} ${pathname}`);
  } catch (e) {
    console.error('[server] Unhandled error:', e);
    err(res, 500, 'SERVER_FAULT', e.message);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  const n    = stmts.countActive.get().n;
  const auth = ADMIN_TOKEN ? 'token required' : 'open (set REGISTRY_ADMIN_TOKEN to secure)';

  console.log('');
  console.log('  ╔═══════════════════════════════════════════════╗');
  console.log('  ║     Dillweed Registry  v0.2.8                 ║');
  console.log('  ║     dillweed.com/registry-spec.html           ║');
  console.log('  ╠═══════════════════════════════════════════════╣');
  console.log(`  ║  Listening   http://0.0.0.0:${PORT}               ║`);
  console.log(`  ║  Database    data/registry.db  (${String(n).padEnd(3)} records)  ║`);
  console.log(`  ║  Mode        ${REGISTRY_MODE.padEnd(32)} ║`);
  console.log(`  ║  Signing     Ed25519 (DNSO)                   ║`);
  console.log(`  ║  Auth        ${auth.slice(0,32).padEnd(32)} ║`);
  console.log('  ╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log('  Endpoints:');
  console.log(`    GET   http://localhost:${PORT}/health`);
  console.log(`    GET   http://localhost:${PORT}/pubkey            (?previous=true for prior key)`);
  console.log(`    GET   http://localhost:${PORT}/list`);
  console.log(`    GET   http://localhost:${PORT}/lookup/<name.path>`);
  console.log(`    GET   http://localhost:${PORT}/verify/<name.path>`);
  console.log(`    POST  http://localhost:${PORT}/register`);
  console.log(`    POST  http://localhost:${PORT}/revoke`);
  console.log(`    POST  http://localhost:${PORT}/promote`);
  console.log('');
  console.log(`  Point DillClaw at this registry:`);
  console.log(`    DILLCLAW_REGISTRY_URL=http://localhost:${PORT} node server.js`);

  // ── Local-Key Advisory ─────────────────────────────────────────────────────
  // Emitted at every startup because the reference implementation always
  // signs with a locally-generated keypair (no concept of "the canonical key
  // was installed" in this codebase). The canonical DNSO keypair is held by
  // the DNSO, not by adopters. See README.md "Trust Roots and Local Keys"
  // and dillweed.com/implementing-dillweed.html §08.
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════════════════╗');
  console.log('  ║                                                                      ║');
  console.log('  ║  \u26A0  LOCAL-KEY ADVISORY                                              ║');
  console.log('  ║                                                                      ║');
  console.log('  ║  This service is running with a locally-generated Ed25519 keypair.   ║');
  console.log('  ║  Records signed by this instance are valid only against this local   ║');
  console.log('  ║  trust root and are NOT part of the canonical Dillweed Namespace.    ║');
  console.log('  ║                                                                      ║');
  console.log('  ║  The canonical Dillweed Namespace is operated by the DNSO and its    ║');
  console.log('  ║  signatures are verifiable against the public key published at:      ║');
  console.log('  ║                                                                      ║');
  console.log('  ║      https://dillweed.com/dnso_public.pem                            ║');
  console.log('  ║                                                                      ║');
  console.log('  ║  This advisory is informational, not an error. The service will      ║');
  console.log('  ║  continue normally. See dillweed.com/implementing-dillweed.html §08. ║');
  console.log('  ║                                                                      ║');
  console.log('  ╚══════════════════════════════════════════════════════════════════════╝');

  if (fs.existsSync(PUBKEY_PREVIOUS_PATH)) {
    console.log('');
    console.log('  ⚠  Key rotation overlap ACTIVE. Previous public key is served at');
    console.log('     /pubkey?previous=true. Close overlap by running: node rotate-key.js --finalize');
  }
  if (REGISTRY_MODE === 'mirror') {
    console.log('');
    console.log('  ⚠  Running in MIRROR mode. Write endpoints are disabled.');
    console.log('     Set AUTHORITATIVE_SNAPSHOT_TIMESTAMP and');
    console.log('     AUTHORITATIVE_SIGNATURE_HASH env vars via your sync process.');
  }
  console.log('');
  console.log('  Ready — press Ctrl+C to stop.\n');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: Port ${PORT} is in use.`);
    console.error(`  Try:  REGISTRY_PORT=9485 node server.js\n`);
  } else {
    console.error('[server] Fatal:', e);
  }
  process.exit(1);
});
