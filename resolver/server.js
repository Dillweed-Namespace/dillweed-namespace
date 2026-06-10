#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  DillClaw Resolver  v0.1.8
//  Reference implementation of the DillClaw Resolver Specification v0.1
//  https://dillweed.com/dillclaw-spec.html
//
//  Zero external dependencies — pure Node.js built-ins only.
//  Requires Node.js 14+ (Ed25519 support via crypto.createPublicKey / crypto.verify).
//
//  Changes from v0.1.0:
//    • Real Ed25519 signature verification against configured DNSO public key
//      (falls back to structural check with startup warning if no key configured)
//    • Live registry fetch via DILLCLAW_REGISTRY_BASE_URL with /list and
//      /lookup-on-miss; stale-while-revalidate per Resolver Spec §7.3
//    • version_pref ('stable' | 'latest' | semver) now actually filters results
//    • cache_hit reflects real cache state in remote mode
//    • /health reports registry source, freshness, and DNSO key configuration
//    • context.caller_id and context.session_id extracted into traces
// ─────────────────────────────────────────────────────────────────────────────

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const url    = require('url');
const https  = require('https');

const PORT                = parseInt(process.env.DILLCLAW_PORT || '9474', 10);
const REGISTRY_PATH       = path.join(__dirname, 'registry.json');
// Post-review-1 (RS-011 / RS-012): Registry integration uses the base-URL
// convention, not a direct JSON-feed URL. Resolver calls <base>/list to warm
// its in-memory snapshot and <base>/lookup/<name> on cache miss. The legacy
// DILLCLAW_REGISTRY_URL variable is still read for backward compatibility,
// but new deployments should use DILLCLAW_REGISTRY_BASE_URL. If both are
// set, the base URL takes precedence. If neither is set, the Resolver falls
// back to the local registry.json file (development mode).
const REGISTRY_BASE_URL   = (process.env.DILLCLAW_REGISTRY_BASE_URL || process.env.DILLCLAW_REGISTRY_URL || '').replace(/\/+$/, '') || null;
const REGISTRY_REFRESH_MS = parseInt(process.env.DILLCLAW_REGISTRY_REFRESH_MS || '60000', 10);
// DillClaw Resolver Spec §7.2 defines the stale-while-revalidate window:
// default 900s, max 1800s. §7.3 + REQ-35 require that once this window
// expires, subsequent requests MUST return REGISTRY_UNAVAILABLE rather than
// continuing to serve older stale data. Override via DILLCLAW_STALE_WINDOW_MS
// (clamped to the spec maximum of 1800s).
const STALE_WINDOW_MS     = Math.min(
  parseInt(process.env.DILLCLAW_STALE_WINDOW_MS || '900000', 10),
  1800000
);
const PUBLIC_KEY_PATH     = process.env.DILLCLAW_DNSO_PUBLIC_KEY || path.join(__dirname, 'dnso_public.pem');
const TRACES_DIR          = path.join(__dirname, 'traces');
const VERSION             = 'dillclaw/0.1.8';
// DillClaw Resolver Spec §6.2: the default scoring profile is `dillclaw-default-v1`.
// REQ-5: conformant resolvers MUST return this in the /resolve response envelope.
const SCORING_PROFILE     = 'dillclaw-default-v1';
// DillClaw Resolver Spec §3.2: timestamps in resolver responses MUST be
// RFC 3339 date-time in UTC with second precision (YYYY-MM-DDTHH:MM:SSZ).
// Non-UTC offsets and fractional seconds MUST NOT be used. Date.toISOString()
// returns YYYY-MM-DDTHH:MM:SS.sssZ — strip the milliseconds to comply.
function rfc3339UTC(d) {
  return (d || new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
// DillClaw Resolver Spec §6.2: trust scores MUST use banker's rounding
// (round-half-to-even, IEEE 754 roundTiesToEven). JavaScript's Math.round
// rounds half away from zero for positive numbers, which would violate the
// determinism guarantee for any score landing exactly on a half-thousandth.
function bankersRound3(x) {
  const scaled = x * 1000;
  const floor  = Math.floor(scaled);
  const frac   = scaled - floor;
  // Tolerance for floating-point imprecision near the .5 boundary.
  const EPSILON = 1e-9;
  let rounded;
  if (frac < 0.5 - EPSILON)      rounded = floor;
  else if (frac > 0.5 + EPSILON) rounded = floor + 1;
  else                            rounded = (floor % 2 === 0) ? floor : floor + 1;  // round half to even
  return rounded / 1000;
}
// Namespace Standard v0.4.3 §3.4 defines two semantically equivalent scheme
// forms: the full form 'dillweed://' (human-readable contexts) and the
// canonical short form 'dllwd://' (machine, protocol, and infrastructure
// contexts, including resolver queries). The spec requires implementations
// to treat the two forms as semantically equivalent.
const URI_PREFIXES        = ['dillweed://', 'dllwd://'];
const COMPONENT_RE        = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]{2}$/;

if (!fs.existsSync(TRACES_DIR)) fs.mkdirSync(TRACES_DIR, { recursive: true });

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = {
  records:  new Map(),  // name  -> { record, expires, cached_at }
  liveness: new Map(),  // url   -> { alive, expires }
  negative: new Map(),  // key   -> { expires }

  TTL: {
    record:    300  * 1000,
    recordMax: 3600 * 1000,
    liveness:  60   * 1000,
    negative:  30   * 1000,
  },

  setRecord(key, record, ttlMs) {
    const ttl = Math.min(ttlMs || this.TTL.record, this.TTL.recordMax);
    this.records.set(key, { record, expires: Date.now() + ttl, cached_at: rfc3339UTC() });
  },

  getRecord(key) {
    const e = this.records.get(key);
    if (!e) return null;
    if (Date.now() > e.expires) { this.records.delete(key); return null; }
    return e;
  },

  hasRecord(key) { return this.getRecord(key) !== null; },

  setNegative(key) {
    this.negative.set(key, { expires: Date.now() + this.TTL.negative });
  },

  isNegative(key) {
    const e = this.negative.get(key);
    if (!e) return false;
    if (Date.now() > e.expires) { this.negative.delete(key); return false; }
    return true;
  },

  setLiveness(endpoint, alive) {
    this.liveness.set(endpoint, { alive, expires: Date.now() + this.TTL.liveness });
  },

  getLiveness(endpoint) {
    const e = this.liveness.get(endpoint);
    if (!e) return null;
    if (Date.now() > e.expires) { this.liveness.delete(endpoint); return null; }
    return e.alive;
  },

  stats() {
    return { records: this.records.size, liveness: this.liveness.size, negative: this.negative.size };
  }
};

// ─── Registry Store ──────────────────────────────────────────────────────────
// Unified interface over local file or remote Registry with stale-while-revalidate.
//
// Local mode: re-reads registry.json on every resolution (hot-reloadable).
// Remote mode: polls <base>/list every DILLCLAW_REGISTRY_REFRESH_MS and
//              serves from in-memory snapshot. On cache miss for an exact
//              name, attempts <base>/lookup/<name> to fetch a single record.
//              Falls back to stale snapshot if /list refresh fails; reports
//              REGISTRY_UNAVAILABLE only after the stale window expires.
//
// Round-1 review fixes:
//   RS-004 — snapshot() returns {records, mode} atomically so callers can
//            fail closed after the stale-window expires; the prior code
//            re-checked mode separately and could race with getAll() flipping
//            mode from stale to unavailable.
//   RS-012 — switched from single-URL-feed convention to Registry base-URL
//            convention with /list and /lookup integration.

const registry = {
  source:        'local',       // 'local' | 'remote'
  mode:          'ok',          // 'ok' | 'stale' | 'unavailable'
  data:          [],
  byName:        new Map(),     // name → array of records (versions), for /lookup-on-miss handling
  lastFetch:     null,
  lastError:     null,
  // Spec §7.3 + REQ-35: when the stale-while-revalidate window expires,
  // subsequent requests MUST return REGISTRY_UNAVAILABLE rather than older
  // stale data. Track when we first entered stale mode so the elapsed
  // window can be measured. Reset to null on every successful refresh.
  staleSince:    null,
  refreshTimer:  null,
  refreshing:    false,

  async init() {
    if (REGISTRY_BASE_URL) {
      this.source = 'remote';
      await this.refreshList();
      this.refreshTimer = setInterval(() => this.refreshList(), REGISTRY_REFRESH_MS);
      this.refreshTimer.unref();   // allow clean shutdown
    } else {
      this.source = 'local';
      this.loadLocal();
    }
  },

  loadLocal() {
    try {
      const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
      // registry.json may use either {capabilities:[...]} (local sample format)
      // or {records:[...]} (Registry /list response format).
      const records   = parsed.capabilities || parsed.records || [];
      this._absorb(records);
      this.lastFetch  = new Date();
      this.mode       = 'ok';
      this.lastError  = null;
      this.staleSince = null;
    } catch (e) {
      console.error(`[registry] Failed to load local registry.json: ${e.message}`);
      this.lastError = e.message;
      if (this.data.length === 0) this.mode = 'unavailable';
    }
  },

  // Fetch the warm-cache snapshot from the Registry's /list endpoint.
  async refreshList() {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      // /list returns { status, total, count, offset, limit, records }
      const parsed = await fetchJson(REGISTRY_BASE_URL + '/list');
      const records = Array.isArray(parsed)
        ? parsed
        : (parsed.records || parsed.capabilities || []);
      if (!Array.isArray(records)) {
        throw new Error('Registry /list response did not contain a records array.');
      }
      this._absorb(records);
      this.lastFetch  = new Date();
      this.mode       = 'ok';
      this.lastError  = null;
      this.staleSince = null;
    } catch (e) {
      this.lastError = e.message;
      if (this.data.length > 0) {
        // First failure → enter stale mode and start the spec's stale window.
        if (this.staleSince === null) this.staleSince = new Date();
        if (Date.now() - this.staleSince.getTime() > STALE_WINDOW_MS) {
          this.mode = 'unavailable';
          console.error(`[registry] Stale window expired (${Math.round(STALE_WINDOW_MS/1000)}s); transitioning to unavailable.`);
        } else {
          this.mode = 'stale';
          console.error(`[registry] /list refresh failed (serving stale): ${e.message}`);
        }
      } else {
        this.mode = 'unavailable';
        console.error(`[registry] /list refresh failed (no cached data): ${e.message}`);
      }
    } finally {
      this.refreshing = false;
    }
  },

  // /lookup-on-miss: fetch a single record by name from <base>/lookup/<name>.
  // Returns an array of records (Registry returns all matching versions when
  // ?version is omitted, or a single record envelope when ?version is given).
  // Does NOT transition the store to stale — /list is the freshness signal;
  // a single /lookup failure should not invalidate the entire snapshot.
  async fetchOneRemote(name) {
    if (this.source !== 'remote') return null;
    try {
      const parsed = await fetchJson(REGISTRY_BASE_URL + '/lookup/' + encodeURIComponent(name));
      // /lookup without ?version → { status, total, records: [...] }
      // /lookup with ?version → { status, capability: {...} }
      if (Array.isArray(parsed)) return parsed;
      if (parsed.records) return parsed.records;
      if (parsed.capability) return [parsed.capability];
      return [];
    } catch (e) {
      // Not finding the name (404) and transient errors look the same here;
      // either way, return null and let the caller decide how to surface it.
      return null;
    }
  },

  // Internal: rebuild data array and byName index together.
  _absorb(records) {
    this.data = records;
    this.byName = new Map();
    for (const r of records) {
      if (!r || typeof r.name !== 'string') continue;
      const arr = this.byName.get(r.name) || [];
      arr.push(r);
      this.byName.set(r.name, arr);
    }
  },

  // Merge newly-fetched records (from /lookup-on-miss) into the snapshot.
  // Used after a successful /lookup so subsequent in-memory queries find them.
  absorbRemoteRecords(records) {
    if (!Array.isArray(records)) return;
    for (const r of records) {
      if (!r || typeof r.name !== 'string') continue;
      // De-dupe by (name, version)
      const exists = this.data.some(x => x.name === r.name && x.version === r.version);
      if (exists) continue;
      this.data.push(r);
      const arr = this.byName.get(r.name) || [];
      arr.push(r);
      this.byName.set(r.name, arr);
    }
  },

  // Returns current records + current mode atomically. Callers can fail
  // closed by checking the returned mode rather than racing with a separate
  // mode check (RS-004 fix). In local mode, re-reads the file on each call.
  snapshot() {
    if (this.source === 'local') this.loadLocal();
    this._maybeExpireStale();
    return { records: this.data, mode: this.mode };
  },

  _maybeExpireStale() {
    if (this.mode === 'stale' && this.staleSince &&
        Date.now() - this.staleSince.getTime() > STALE_WINDOW_MS) {
      this.mode = 'unavailable';
    }
  },

  getStatus() {
    return {
      source:     this.source,
      mode:       this.mode,
      records:    this.data.length,
      last_fetch: this.lastFetch ? rfc3339UTC(this.lastFetch) : null,
      last_error: this.lastError,
      url:        REGISTRY_BASE_URL || null,
    };
  }
};

// ─── DNSO Key & Signature Verification ────────────────────────────────────────
// Real Ed25519 verification when dnso_public.pem is present. Falls back to
// structural checking (compatible with v0.1.0 behavior) with a startup warning
// if no key is configured. Use tools/generate-keys.js to create a DNSO keypair
// and sign the sample registry for end-to-end demo.

const dnsoKey = {
  publicKey:  null,
  configured: false,
  keyPath:    PUBLIC_KEY_PATH,
  lastError:  null,

  init() {
    if (!fs.existsSync(PUBLIC_KEY_PATH)) {
      this.configured = false;
      this.lastError  = `No DNSO public key found at ${PUBLIC_KEY_PATH}`;
      return;
    }
    try {
      const pem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
      const key = crypto.createPublicKey(pem);
      if (key.asymmetricKeyType !== 'ed25519') {
        this.configured = false;
        this.lastError  = `Public key is ${key.asymmetricKeyType}, expected ed25519`;
        return;
      }
      this.publicKey  = key;
      this.configured = true;
      this.lastError  = null;
    } catch (e) {
      this.configured = false;
      this.lastError  = e.message;
    }
  },

  // Returns one of: 'valid' | 'invalid' | 'absent' | 'unverifiable'
  verify(record) {
    if (!record.signature)              return 'absent';
    if (record.signature === 'INVALID') return 'invalid';
    if (!this.configured)               return 'unverifiable';

    // Expected format: "dnso_v1_<base64url>"
    // Matches Registry v0.1.5 / v0.2.8 signing profile exactly. Prior to
    // round-1 external review (RS-003), the resolver expected hex-encoded
    // signatures and used a recursive canonicalization that did not match
    // the Registry's top-level-only canonical JSON. Every Registry-signed
    // record was being marked invalid as a result. Aligned to the Registry
    // signing profile per the §5.2 spec text settled in the Registry review.
    //
    // Note: base64url uses `-` and `_` as valid characters, so we MUST NOT
    // split on `_` — extract the payload via prefix-strip. (My initial
    // RS-003 fix used split('_') and was wrong: 4 of 7 sample signatures
    // contain `_` in their payload and were being rejected.)
    const PREFIX = 'dnso_v1_';
    if (!record.signature.startsWith(PREFIX)) return 'invalid';
    const sigB64 = record.signature.slice(PREFIX.length);
    // base64url alphabet: A-Z a-z 0-9 - _
    if (!/^[A-Za-z0-9_-]+$/.test(sigB64)) {
      return 'invalid';
    }

    try {
      const sigBytes = Buffer.from(sigB64, 'base64url');
      const payload  = canonicalJSON(record);
      const data     = Buffer.from(payload, 'utf8');
      return crypto.verify(null, data, { key: this.publicKey, dsaEncoding: 'ieee-p1363' }, sigBytes)
        ? 'valid' : 'invalid';
    } catch (_) {
      return 'invalid';
    }
  },

  getStatus() {
    return {
      configured: this.configured,
      key_path:   this.configured ? this.keyPath : null,
      algorithm:  this.configured ? 'ed25519'    : null,
      last_error: this.lastError,
    };
  }
};

// Canonical JSON for signature verification — matches Registry v0.1.5 /
// v0.2.8 implementation exactly. Only the ten signed top-level fields are
// included; nested objects within input_schema and output_schema are
// emitted as stored without recursive key sorting (per Registry Spec §5.2
// scoping clarification). This must remain byte-identical to the Registry's
// canonicalJSON or signatures will not verify across implementations.
// Round-1 review (RS-003) caught that the prior recursive version produced
// divergent bytes; this version is a direct port of the Registry's function.
function canonicalJSON(record) {
  const fields = ['description','endpoint','input_schema','last_updated','name',
                  'output_schema','permissions','protocol','trust_tier','version'];
  const obj = {};
  for (const f of fields) { if (record[f] !== undefined) obj[f] = record[f]; }
  return JSON.stringify(obj);
}

// ─── HTTP/HTTPS fetch helper (JSON) ───────────────────────────────────────────

function fetchJson(targetUrl) {
  return new Promise((resolve, reject) => {
    let mod;
    try {
      mod = targetUrl.startsWith('https') ? https : http;
    } catch (_) { return reject(new Error('Invalid URL')); }

    const req = mod.get(targetUrl, { timeout: 5000, headers: { 'Accept': 'application/json', 'User-Agent': VERSION } }, res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`Upstream HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data',  chunk => { body += chunk; if (body.length > 8 * 1024 * 1024) { req.destroy(); reject(new Error('Response exceeds 8 MB limit')); } });
      res.on('end',   ()    => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); } });
      res.on('error', reject);
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout after 5s')); });
  });
}

// ─── Query Parser ─────────────────────────────────────────────────────────────

function parseQuery(query) {
  if (typeof query !== 'string' || !query.trim()) {
    return { error: 'QUERY_MALFORMED', message: 'Query must be a non-empty string.' };
  }
  // Namespace Standard §3.4: accept either the full form (dillweed://) or the
  // canonical short form (dllwd://). The two are semantically equivalent.
  const matchedPrefix = URI_PREFIXES.find(p => query.startsWith(p));
  if (!matchedPrefix) {
    return { error: 'QUERY_MALFORMED', message: `Query must start with "dillweed://" or "dllwd://". Got: "${query.slice(0,20)}"` };
  }

  let raw     = query.slice(matchedPrefix.length);
  let version = null;

  // Strip version suffix  name.path:v1.2
  // Round-3 review (RS3-002): an empty suffix (e.g. "dillweed://name:" with
  // nothing after the colon) is malformed per the spec query-language
  // section, not silently treated as unpinned. Reject explicitly so callers
  // get a clear error rather than wondering why "name:" returned different
  // results than they expected.
  const vi = raw.lastIndexOf(':');
  if (vi > -1) {
    version = raw.slice(vi + 1);
    raw = raw.slice(0, vi);
    if (!version.trim()) {
      return {
        error:   'QUERY_MALFORMED',
        message: 'Version suffix after ":" must be a non-empty semver version or range.'
      };
    }
  }

  if (!raw) {
    return { error: 'QUERY_MALFORMED', message: 'Path component is empty after scheme.' };
  }

  const components = raw.split('.');

  if (components.length < 2) {
    return { error: 'QUERY_MALFORMED', message: 'Path must have at least two dot-separated components.' };
  }

  if (components[0] === '*') {
    return { error: 'QUERY_MALFORMED', message: 'First path component may not be a wildcard.' };
  }

  const wildcards = components.filter(c => c === '*').length;
  if (wildcards > 2) {
    return { error: 'QUERY_MALFORMED', message: 'A query may contain at most two wildcards.' };
  }

  for (const c of components) {
    if (c !== '*' && !COMPONENT_RE.test(c)) {
      return {
        error:      'QUERY_MALFORMED',
        message:    `Invalid path component "${c}". Must be 2–64 lowercase chars, digits, or hyphens.`,
        suggestion: `Try "${c.toLowerCase().replace(/[^a-z0-9-]/g, '-')}" instead.`
      };
    }
  }

  return { ok: true, components, version, hasWildcard: wildcards > 0, path: raw };
}

// ─── Matching ─────────────────────────────────────────────────────────────────

function matchComponents(recordName, queryComponents) {
  const rc = recordName.split('.');
  if (rc.length !== queryComponents.length) return false;
  for (let i = 0; i < queryComponents.length; i++) {
    if (queryComponents[i] === '*') continue;
    if (queryComponents[i] !== rc[i]) return false;
  }
  return true;
}

// matchVersion: returns true if record.version satisfies the version
// constraint string. Supports the following forms (per RS2-003 round-2
// fix — the prior implementation supported only exact and "^MAJ.MIN"
// approximately; the round-2 reviewer correctly pointed out that the
// comment claimed ~X.Y.Z support that the code did not have).
//
// Supported:
//   1.2.3            exact match
//   ^1.2.3           caret (compatible with): >= 1.2.3, < 2.0.0
//   ^1.2             caret: >= 1.2.0, < 2.0.0
//   ^1               caret: >= 1.0.0, < 2.0.0
//   ~1.2.3           tilde (reasonably close): >= 1.2.3, < 1.3.0
//   ~1.2             tilde: >= 1.2.0, < 1.3.0
//
// NOT supported in v0.1.x (would require a more general semver range
// evaluator): compound ranges like ">=1.2.0 <2.0.0", "*" wildcards,
// and the 0.x special-case where ^0.2.3 traditionally means >= 0.2.3,
// < 0.3.0. The 0.x caret behavior in this implementation follows the
// regular caret rule (^0.2.3 → >= 0.2.3, < 1.0.0). Documented limitation.
function matchVersion(record, versionQuery) {
  if (!versionQuery) return true;
  if (!record.version) return false;
  if (record.version === versionQuery) return true;

  // Parse the operator (^ or ~) if present
  let op = 'exact';
  let rangeStr = versionQuery;
  if (versionQuery.startsWith('^')) { op = 'caret'; rangeStr = versionQuery.slice(1); }
  else if (versionQuery.startsWith('~')) { op = 'tilde'; rangeStr = versionQuery.slice(1); }
  else return false;   // unknown operator or non-matching exact (already handled above)

  // Parse the base version (may be partial: "1", "1.2", or "1.2.3").
  // Round-3 review (RS3-001): use strict numeric component validation
  // BEFORE parseInt. The prior parseInt-only approach accepted any string
  // with a numeric prefix — e.g. "^3.1abc" parsed as "^3.1" because
  // parseInt("1abc", 10) returns 1. Reject malformed range strings as
  // unmatched (returns false → applyVersionPref produces VERSION_CONSTRAINT_FAILED).
  const partsText = rangeStr.split('.');
  if (partsText.length < 1 || partsText.length > 3 ||
      !partsText.every(p => /^\d+$/.test(p))) {
    return false;
  }
  const baseParts = partsText.map(Number);
  const [bMaj, bMin = 0, bPatch = 0] = baseParts;

  // Parse the record version (strip prerelease/build per semver §11 for
  // range comparison — prerelease versions only satisfy a range if the
  // range itself includes a prerelease tag, per semver.org). v0.1.x
  // simplification: ignore prerelease for range matching.
  // Wider-scope: same strict validation applied here, defending against
  // a malformed record.version that should have been caught at registration.
  const recMain = record.version.split('-')[0].split('+')[0];
  const recPartsText = recMain.split('.');
  if (recPartsText.length !== 3 || !recPartsText.every(p => /^\d+$/.test(p))) {
    return false;
  }
  const recParts = recPartsText.map(Number);
  const [rMaj, rMin, rPatch] = recParts;

  if (op === 'caret') {
    // ^MAJOR.MINOR.PATCH → >= base, < (MAJOR+1).0.0
    if (rMaj !== bMaj) return false;
    if (rMin > bMin) return true;
    if (rMin < bMin) return false;
    return rPatch >= bPatch;
  }
  if (op === 'tilde') {
    // ~MAJOR.MINOR → >= base, < (MAJOR).(MINOR+1).0
    // ~MAJOR.MINOR.PATCH → >= base, < (MAJOR).(MINOR+1).0
    if (rMaj !== bMaj) return false;
    if (rMin !== bMin) return false;
    return rPatch >= bPatch;
  }
  return false;
}

// Semver precedence comparator per semver.org §11, used for tie-breaking in
// Spec §6.3 Rule 2. Returns negative if a < b, positive if a > b, 0 if equal.
// Supports MAJOR.MINOR.PATCH with optional pre-release identifier. Pre-release
// versions sort lower than the corresponding release (1.0.0-alpha < 1.0.0).
// Build metadata (after '+') is ignored for precedence.
function compareSemver(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  // Strip build metadata; doesn't affect precedence.
  const stripBuild = v => v.split('+')[0];
  const va = stripBuild(a);
  const vb = stripBuild(b);

  // Split into [main, pre-release]
  const splitPre = v => {
    const idx = v.indexOf('-');
    return idx === -1 ? [v, null] : [v.slice(0, idx), v.slice(idx + 1)];
  };
  const [mainA, preA] = splitPre(va);
  const [mainB, preB] = splitPre(vb);

  // Compare main components numerically
  const partsA = mainA.split('.').map(n => parseInt(n, 10) || 0);
  const partsB = mainB.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const ai = partsA[i] || 0;
    const bi = partsB[i] || 0;
    if (ai !== bi) return ai - bi;
  }

  // Main parts equal — pre-release rules:
  // A version without pre-release has higher precedence than one with.
  if (preA === null && preB === null) return 0;
  if (preA === null) return 1;
  if (preB === null) return -1;

  // Both have pre-release: compare dot-separated identifiers per semver §11.
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
      return -1;  // numeric identifiers have lower precedence than non-numeric
    } else if (numB !== null) {
      return 1;
    } else if (idsA[i] !== idsB[i]) {
      return idsA[i] < idsB[i] ? -1 : 1;
    }
  }
  return 0;
}

// version_pref semantics (per Resolver Spec §6 + RS-005 round-1 fix):
//   'stable'  → select the highest semver version with NO prerelease and NO
//               build metadata. If no stable version exists among candidates,
//               return [] (caller returns no_match).
//   'latest'  → select the highest semver version, INCLUDING those with
//               prerelease identifiers. Highest-precedence single record.
//   explicit  → exact version (e.g. "1.0.0") or range ("^1.2", "~2.3.4")
//               selects the highest version satisfying the constraint.
//               If nothing satisfies, return [] (caller returns no_match).
// Prior behavior silently fell back to the original candidate set when a
// constraint matched nothing — that hid version-pinning failures. Now
// constraint failure surfaces as no_match per the spec's no-silent-failure
// principle.
function applyVersionPref(candidates, pref) {
  if (!candidates || candidates.length === 0) return [];

  // Helpers
  const validSemver = c => isValidSemver(c.version);
  const isStable = v => typeof v === 'string'
    && !v.includes('-')   // no prerelease identifier
    && !v.includes('+');  // no build metadata
  // highestOf returns just the candidate with the highest version, or all
  // candidates if no version comparison is possible.
  const highestOf = arr => {
    if (arr.length <= 1) return arr;
    let best = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (compareSemver(arr[i].version, best.version) > 0) best = arr[i];
    }
    return [best];
  };

  if (!pref || pref === 'stable') {
    const stable = candidates.filter(c => validSemver(c) && isStable(c.version));
    if (stable.length === 0) return [];
    return highestOf(stable);
  }

  if (pref === 'latest') {
    const semverOnly = candidates.filter(validSemver);
    if (semverOnly.length === 0) return [];
    return highestOf(semverOnly);
  }

  // Explicit version or range
  const matched = candidates.filter(c => matchVersion(c, pref));
  if (matched.length === 0) return [];
  return highestOf(matched);
}

// True if string is a parseable semver (loose check — main parts numeric)
function isValidSemver(v) {
  if (typeof v !== 'string') return false;
  // Strip optional prerelease/build for shape check
  const main = v.split('-')[0].split('+')[0];
  const parts = main.split('.');
  return parts.length === 3 && parts.every(p => /^\d+$/.test(p));
}

// ─── Trust Evaluation ─────────────────────────────────────────────────────────
// Weights per spec §6.2:
//   Trust tier:      40%
//   Usage history:   30%
//   Signature valid: 20%
//   Endpoint liven:  10%

const TIER_SCORE = { canonical: 1.0, verified: 0.85, trusted: 0.65, experimental: 0.30 };
const TIER_RANK  = { canonical: 4,   verified: 3,    trusted: 2,    experimental: 1   };

function meetsMinimum(tier, min) {
  return (TIER_RANK[tier] || 0) >= (TIER_RANK[min] || 0);
}

function usageScore(record) {
  if (!record.registration_date) return 0;
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor((Date.now() - new Date(record.registration_date).getTime()) / msPerDay);
  const months = Math.floor(days / 30.44);
  return Math.min(Math.max(months, 0) / 24, 1.0);
}

function sigScore(record) {
  switch (dnsoKey.verify(record)) {
    case 'valid':        return 1.0;
    case 'invalid':      return 0.0;
    case 'absent':       return 0.5;
    case 'unverifiable': return 0.5;   // neutral when key not configured
    default:             return 0.5;
  }
}

function livenessScore(record) {
  const cached = cache.getLiveness(record.endpoint);
  if (cached === null) return 0.5;   // unchecked
  return cached ? 1.0 : 0.0;
}

function trustScore(record) {
  const s = (TIER_SCORE[record.trust_tier] || 0) * 0.40
          + usageScore(record)    * 0.30
          + sigScore(record)      * 0.20
          + livenessScore(record) * 0.10;
  // Spec §6.2: MUST use banker's rounding (round-half-to-even, IEEE 754
  // roundTiesToEven). See bankersRound3 helper near top of file.
  return bankersRound3(s);
}

function trustSignals(record) {
  const signals = [];

  // Tier
  if      (record.trust_tier === 'canonical')   signals.push('dnso_canonical');
  else if (record.trust_tier === 'verified')    signals.push('dnso_verified');
  else if (record.trust_tier === 'trusted')     signals.push('trusted');
  else                                          signals.push('experimental');

  // History
  if (record.registration_date) {
    const months = Math.floor(
      (Date.now() - new Date(record.registration_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );
    if (months > 0) signals.push(`${months}mo_history`);
  }

  // Signature — per Spec §6.1 REQ-26, the missing-signature signal MUST be
  // 'sig_unverified'. 'sig_valid' / 'sig_invalid' are retained for verifiable
  // outcomes; 'sig_verified' is an additive signal when cryptographic check
  // passed against the configured DNSO public key. Round-2 review (RS2-004):
  // 'unverifiable' (record has a signature but the resolver lacks the
  // DNSO public key to check it) was previously labeled 'sig_valid', which
  // was semantically misleading — the signature was NOT validated. It now
  // emits 'sig_unverified' for parity with the absent-signature path.
  switch (dnsoKey.verify(record)) {
    case 'valid':        signals.push('sig_valid', 'sig_verified'); break;
    case 'invalid':      signals.push('sig_invalid');               break;
    case 'absent':       signals.push('sig_unverified');            break;
    case 'unverifiable': signals.push('sig_unverified');            break;  // present but no DNSO public key configured
  }

  // Liveness
  const lv = cache.getLiveness(record.endpoint);
  if      (lv === true)  signals.push('endpoint_live');
  else if (lv === false) signals.push('endpoint_unreachable');
  else                   signals.push('endpoint_unchecked');

  return signals;
}

// ─── Liveness Probe (async, non-blocking) ─────────────────────────────────────

function probeEndpoint(endpoint) {
  try {
    const mod    = endpoint.startsWith('https') ? https : http;
    const parsed = new url.URL(endpoint);
    const req    = mod.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'HEAD', timeout: 3000 }, res => {
      cache.setLiveness(endpoint, res.statusCode < 500);
    });
    req.on('error',   () => cache.setLiveness(endpoint, false));
    req.on('timeout', () => { req.destroy(); cache.setLiveness(endpoint, false); });
    req.end();
  } catch (_) {
    cache.setLiveness(endpoint, false);
  }
}

// ─── Core Resolver ────────────────────────────────────────────────────────────

async function resolveQuery(query, opts = {}) {
  const {
    trust_minimum  = 'experimental',
    permissions    = [],
    version_pref   = 'stable',
    max_results    = 1,
    probe_liveness = false,
    allow_unsigned = false,
  } = opts;

  // 1 — Parse the query first
  const parsed = parseQuery(query);
  if (!parsed.ok) {
    return {
      status:     'error',
      error_code: parsed.error,
      message:    parsed.message,
      suggestion: parsed.suggestion || null
    };
  }

  // 2 — Atomic registry availability check + records snapshot (RS-004 fix)
  // Prior code separated mode check from getAll(); getAll() could flip mode
  // from stale to unavailable inside the call, after the outer check passed,
  // letting stale data be served. snapshot() returns mode and records in one
  // call so callers can fail closed atomically.
  let { records: all, mode: registryMode } = registry.snapshot();
  if (registryMode === 'unavailable') {
    return {
      status:     'error',
      error_code: 'REGISTRY_UNAVAILABLE',
      message:    `Registry is unavailable. ${registry.lastError || 'Stale window expired.'}`
    };
  }

  // 3 — Registry lookup
  let candidates = all.filter(r =>
    matchComponents(r.name, parsed.components) && matchVersion(r, parsed.version)
  );

  if (candidates.length > 200) {
    return { status: 'error', error_code: 'QUERY_TOO_BROAD', message: 'Wildcard matches >200 candidates. Narrow the query.' };
  }

  // 3b — /lookup-on-miss (RS-012)
  // If we have no in-memory candidates AND the query is a specific exact
  // name (no wildcards, fully qualified components) AND we're in remote
  // mode, try the Registry's /lookup endpoint before declaring NO_MATCH.
  // Filters out the case where the snapshot is authoritative for what
  // names exist (wildcard / fuzzy queries) — /lookup is only useful when
  // the resolver has a specific name it doesn't currently have cached.
  if (candidates.length === 0 &&
      registry.source === 'remote' &&
      parsed.components.length > 0 &&
      parsed.components.every(c => !c.includes('*')) &&
      !cache.isNegative(query)) {
    const lookupName = parsed.components.join('.');
    const fetched = await registry.fetchOneRemote(lookupName);
    if (fetched && fetched.length > 0) {
      registry.absorbRemoteRecords(fetched);
      // Re-check mode after the network call — fetchOneRemote doesn't
      // transition state, but the periodic /list refresh might have run
      // concurrently. Atomic mode re-check.
      if (registry.mode === 'unavailable') {
        return {
          status:     'error',
          error_code: 'REGISTRY_UNAVAILABLE',
          message:    `Registry is unavailable. ${registry.lastError || 'Stale window expired during lookup.'}`
        };
      }
      candidates = fetched.filter(r =>
        matchComponents(r.name, parsed.components) && matchVersion(r, parsed.version)
      );
    }
  }

  if (candidates.length === 0) {
    cache.setNegative(query);
    return { status: 'no_match', error_code: 'NO_MATCH', message: 'No registered capabilities match this query.' };
  }

  // 4 — Optionally kick off async liveness probes
  if (probe_liveness) {
    candidates.forEach(r => { if (r.endpoint) probeEndpoint(r.endpoint); });
  }

  // ── Hard eligibility filters ────────────────────────────────────────────────
  // Round-2 review (RS2-001): the version_pref filter MUST run AFTER the hard
  // eligibility filters (trust tier, permissions, signature), not before. The
  // spec language says version_pref selects from candidates surviving the
  // trust filter, and the architecture describes trust evaluation before
  // ranking/version preference. Prior code applied version_pref first, which
  // could pick a highest version that then failed trust/signature policy,
  // producing a false no_match even when a lower version satisfied policy.
  // The applyVersionPref call is now in step 8, after the hard filters.

  // 5 — Trust tier gate
  const tierPassed = candidates.filter(r => meetsMinimum(r.trust_tier, trust_minimum));
  if (tierPassed.length === 0) {
    return {
      status:     'no_match',
      error_code: 'TRUST_FILTERED',
      message:    `All ${candidates.length} candidate(s) eliminated by trust_minimum "${trust_minimum}".`
    };
  }

  // 6 — Permission check
  const permPassed = permissions.length === 0
    ? tierPassed
    : tierPassed.filter(r => permissions.every(p => (r.permissions || []).includes(p)));

  if (permPassed.length === 0) {
    return {
      status:     'no_match',
      error_code: 'PERMISSION_MISMATCH',
      message:    `No candidates carry all required permissions: [${permissions.join(', ')}].`
    };
  }

  // 7 — Signature eligibility gate (round-1 review RS-001 + RS-002)
  //
  // Spec §6.1/§8 trust-evaluation pipeline: DNSO signatures must be verified
  // against the DNSO public key. Candidates with INVALID signatures must be
  // rejected (unless explicit diagnostic mode is active). Candidates with
  // MISSING signatures may be returned only if caller policy permits unsigned
  // records via `allow_unsigned: true` in the request body; otherwise they
  // are filtered out. Prior to this fix, sigScore() let invalid/missing
  // signatures through as scoring penalties rather than eligibility filters.
  const diagnosticMode = process.env.DILLCLAW_DIAGNOSTIC_MODE === '1';
  const sigEligible = [];
  const sigRejected = [];
  for (const r of permPassed) {
    const status = dnsoKey.verify(r);
    if (status === 'valid') {
      sigEligible.push(r);
    } else if (status === 'invalid') {
      if (diagnosticMode) sigEligible.push(r);
      else sigRejected.push({ record: r, reason: 'invalid signature' });
    } else if (status === 'absent') {
      if (allow_unsigned === true || diagnosticMode) sigEligible.push(r);
      else sigRejected.push({ record: r, reason: 'missing signature (set allow_unsigned: true to permit)' });
    } else if (status === 'unverifiable') {
      // DNSO public key not configured. Treat as unverified — let through
      // only with explicit caller opt-in OR diagnostic mode. Default-deny.
      if (allow_unsigned === true || diagnosticMode) sigEligible.push(r);
      else sigRejected.push({ record: r, reason: 'signature unverifiable (DNSO public key not configured)' });
    } else {
      sigRejected.push({ record: r, reason: `unknown signature state: ${status}` });
    }
  }

  if (sigEligible.length === 0) {
    return {
      status:     'no_match',
      error_code: 'SIGNATURE_FILTERED',
      message:    `All ${permPassed.length} candidate(s) eliminated by signature eligibility: ` +
                  sigRejected.slice(0, 3).map(x => `${x.record.name}: ${x.reason}`).join('; ') +
                  (sigRejected.length > 3 ? `; +${sigRejected.length - 3} more` : '')
    };
  }

  // 8 — Version preference filter (per-name, post-eligibility)
  //
  // Round-2 review (RS2-001): version_pref is applied AFTER all hard
  // eligibility filters and PER namespace path, not globally across the
  // entire candidate set. Per-name selection is essential for wildcard
  // queries: globally selecting the highest version would collapse
  // wildcard results to a single capability path (the one with the
  // numerically-highest version), even when caller asked for multiple
  // capabilities via max_results > 1.
  //
  // For each distinct capability name in the eligible set, applyVersionPref
  // selects the surviving version(s) within that name's group. The flat
  // result list is the union of per-group survivors. If the union is
  // empty, all candidates failed the version constraint and we return
  // VERSION_CONSTRAINT_FAILED — distinguishing version-failure from
  // signature/trust failure for clearer diagnostics.
  const byName = new Map();
  for (const r of sigEligible) {
    const arr = byName.get(r.name) || [];
    arr.push(r);
    byName.set(r.name, arr);
  }

  let versionFiltered = [];
  for (const [, group] of byName) {
    const surviving = applyVersionPref(group, version_pref);
    versionFiltered.push(...surviving);
  }

  if (versionFiltered.length === 0) {
    return {
      status:     'no_match',
      error_code: 'VERSION_CONSTRAINT_FAILED',
      message:    `No candidates satisfy version_pref "${version_pref}" ` +
                  `(${sigEligible.length} eligible candidate(s) across ${byName.size} name(s) ` +
                  `before version filter).`
    };
  }

  // 9 — Score & rank
  const scored = versionFiltered
    .map(record => {
      const hadCached = cache.hasRecord(record.name);
      const score   = trustScore(record);
      const signals = trustSignals(record);
      // Remote mode: record came from an already-fetched in-memory registry,
      // so subsequent resolutions for the same record should reflect cache_hit.
      // Local mode: file is re-read each call, so cache_hit remains false.
      const cacheHit = registry.source === 'remote' && hadCached;
      cache.setRecord(record.name, record);
      return { record, score, signals, cacheHit };
    })
    // Sort by score descending. On tie (Spec §6.3 — REQ-31), apply two rules
    // in order until resolved:
    //   Rule 1: ascending lexicographic order on the namespace path (UTF-8
    //           bytes; equivalent to ASCII sort since components are
    //           restricted to lowercase ASCII per Registry Spec §3.1).
    //   Rule 2: ascending semver precedence on the version string.
    // Path + version is unique per active record, so these two rules suffice.
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Rule 1: ascending namespace path
      if (a.record.name !== b.record.name) {
        return a.record.name < b.record.name ? -1 : 1;
      }
      // Rule 2: ascending semver precedence
      return compareSemver(a.record.version, b.record.version);
    });

  const n       = Math.min(Math.max(1, max_results), scored.length);
  const results = scored.slice(0, n).map((item, i) => ({
    rank:          i + 1,
    capability:    item.record,
    trust_score:   item.score,
    trust_signals: item.signals,
    cache_hit:     item.cacheHit,
  }));

  const response = { status: 'resolved', results };

  // Stale-while-revalidate envelope (spec §7.3)
  if (registry.mode === 'stale') {
    response.stale      = true;
    response.cached_at  = registry.lastFetch ? rfc3339UTC(registry.lastFetch) : null;
  }

  return response;
}

// ─── Trace ────────────────────────────────────────────────────────────────────

function newTraceId() { return 'trc_' + crypto.randomBytes(8).toString('hex'); }

function saveTrace(id, data) {
  try { fs.writeFileSync(path.join(TRACES_DIR, `${id}.json`), JSON.stringify(data, null, 2)); }
  catch (_) { /* non-fatal */ }
}

function loadTrace(id) {
  // Guard against path traversal — trace IDs are `trc_<hex>` by construction.
  if (!/^trc_[a-f0-9]+$/i.test(id)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(TRACES_DIR, `${id}.json`), 'utf8')); }
  catch (_) { return null; }
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((res, rej) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 512 * 1024) rej(new Error('Request body exceeds 512 KB limit.'));
    });
    req.on('end',   () => { try { res(JSON.parse(body || '{}')); } catch { rej(new Error('Invalid JSON body.')); } });
    req.on('error', rej);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(json),
    'X-Resolver':     VERSION,
  });
  res.end(json);
}

const HTTP_FOR = {
  QUERY_MALFORMED: 400, QUERY_TOO_BROAD: 400,
  NO_MATCH: 404, TRUST_FILTERED: 404,
  // Round-1 fix: new error codes need explicit HTTP mappings — without
  // them they defaulted to 500, masking spec-conformant no_match responses
  // as resolver faults.
  VERSION_CONSTRAINT_FAILED: 404,
  SIGNATURE_FILTERED: 404,
  PERMISSION_MISMATCH: 422,
  REGISTRY_UNAVAILABLE: 503,
  RESOLVER_FAULT: 500,
};

function statusFor(code) { return HTTP_FOR[code] || 500; }

// ─── Route Handlers ───────────────────────────────────────────────────────────

// Request validator for /resolve and per-item /batch (RS-006 round-1 fix).
// Returns array of error strings, empty if request is valid. Run before
// resolveQuery() so structurally-bad input becomes a clean 400 QUERY_MALFORMED
// rather than slipping through to internal type errors (e.g. permissions.every
// is not a function) or producing empty 'resolved' result sets.
const VALID_TIERS = new Set(['experimental', 'trusted', 'verified', 'canonical']);
const VALID_VERSION_PREFS_LITERAL = new Set(['stable', 'latest']);

function validateResolveRequest(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['request body must be a JSON object'];
  }

  if (typeof body.query !== 'string' || !body.query.trim()) {
    errors.push('query must be a non-empty string');
  }

  if (body.trust_minimum !== undefined && !VALID_TIERS.has(body.trust_minimum)) {
    errors.push(`trust_minimum must be one of: ${[...VALID_TIERS].join(', ')}`);
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions) ||
        !body.permissions.every(p => typeof p === 'string' && p.trim().length > 0)) {
      errors.push('permissions must be an array of non-empty strings');
    }
  }

  if (body.max_results !== undefined) {
    if (!Number.isInteger(body.max_results) || body.max_results < 1 || body.max_results > 50) {
      errors.push('max_results must be an integer between 1 and 50');
    }
  }

  if (body.context !== undefined &&
      (body.context === null || typeof body.context !== 'object' || Array.isArray(body.context))) {
    errors.push('context must be an object when supplied');
  }

  if (body.version_pref !== undefined) {
    if (typeof body.version_pref !== 'string' || body.version_pref.trim().length === 0) {
      errors.push('version_pref must be a non-empty string');
    }
    // Accept literal 'stable'/'latest' or any non-empty string (treated as
    // a version constraint by applyVersionPref). Don't reject unknown
    // strings here — let applyVersionPref handle constraint match/no-match.
  }

  if (body.probe_liveness !== undefined && typeof body.probe_liveness !== 'boolean') {
    errors.push('probe_liveness must be a boolean');
  }

  if (body.allow_unsigned !== undefined && typeof body.allow_unsigned !== 'boolean') {
    errors.push('allow_unsigned must be a boolean');
  }

  return errors;
}

async function handleResolve(req, res) {
  // Spec §3.3 (REQ-10): every response MUST include a trace_id. Generate
  // before any validation so error responses also carry it.
  // Spec §3.2 (REQ-3/4): resolved_at MUST be RFC 3339 second-precision UTC.
  const traceId = newTraceId();
  const ts      = rfc3339UTC();

  // Helper: build a response envelope that always carries the spec-mandated
  // top-level fields (trace_id, resolved_at, resolver_version, scoring_profile)
  // and the supplied result body. Used for both success and error responses.
  const envelope = (extra, query) => ({
    ...extra,
    query:            query !== undefined ? query : (extra.query || null),
    resolved_at:      ts,
    trace_id:         traceId,
    resolver_version: VERSION,
    scoring_profile:  SCORING_PROFILE,
  });

  // RS-007 fix: every response — including early validation errors — must
  // persist its trace so /trace/{trace_id} can reconstruct the decision.
  // Prior code generated trace_id at the top but only called saveTrace()
  // after the full resolve path; early returns from content-type checks,
  // JSON parse failures, or missing-field checks emitted a trace_id that
  // was never recorded.
  const respond = (httpStatus, response, request) => {
    saveTrace(traceId, {
      request:     request || null,
      response,
      resolved_at: ts,
      caller_id:   (request && request.context && request.context.caller_id) || null,
      session_id:  (request && request.context && request.context.session_id) || null,
    });
    send(res, httpStatus, response);
  };

  // Content-Type MUST be application/json (Spec §5.2). Reject other content
  // types — and a missing Content-Type — explicitly rather than implicitly
  // via JSON parse failure. Round-2 review (RS2-002) tightened this from
  // accepting requests with no Content-Type header at all to requiring it
  // be present and exactly application/json.
  const contentType = (req.headers['content-type'] || '').toLowerCase().split(';')[0].trim();
  if (contentType !== 'application/json') {
    return respond(400, envelope({
      status: 'error', error_code: 'QUERY_MALFORMED',
      message: contentType === ''
        ? 'Content-Type header is required and must be application/json.'
        : `Content-Type must be application/json. Got: "${contentType}"`,
    }));
  }

  let body;
  try { body = await readBody(req); }
  catch (e) {
    return respond(400, envelope({
      status: 'error', error_code: 'QUERY_MALFORMED', message: e.message,
    }));
  }

  // RS-006 fix: structural request validation before resolveQuery. Returns
  // a structured error list with the same shape Registry uses for /register
  // VALIDATION_FAILED responses.
  const validationErrors = validateResolveRequest(body);
  if (validationErrors.length > 0) {
    return respond(400, envelope({
      status:     'error',
      error_code: 'QUERY_MALFORMED',
      message:    'Request validation failed.',
      errors:     validationErrors,
    }, body && body.query));
  }

  const result   = await resolveQuery(body.query, body);
  const response = envelope(result, body.query);

  const httpStatus = result.status === 'resolved' ? 200 : statusFor(result.error_code);
  respond(httpStatus, response, body);
}

async function handleCapability(req, res, capPath) {
  // RS-009 fix: lowercase normalization and URI decode for read-path
  // consistency with /resolve. Names are stored canonical (lowercase
  // dot-separated) per Registry Spec §3.1.
  let name;
  try {
    name = decodeURIComponent(capPath).replace(/\//g, '.').toLowerCase();
  } catch (_) {
    return send(res, 400, { status: 'error', error_code: 'QUERY_MALFORMED', message: 'Capability path is not valid URL-encoded text.' });
  }

  // Atomic snapshot (closes the same RS-004 race here)
  const { records, mode } = registry.snapshot();
  if (mode === 'unavailable') {
    return send(res, 503, {
      status:     'error',
      error_code: 'REGISTRY_UNAVAILABLE',
      message:    `Registry is unavailable. ${registry.lastError || 'Stale window expired.'}`
    });
  }

  let record = records.find(r => r.name === name);

  // /lookup-on-miss for the /capability endpoint too
  if (!record && registry.source === 'remote') {
    const fetched = await registry.fetchOneRemote(name);
    if (fetched && fetched.length > 0) {
      registry.absorbRemoteRecords(fetched);
      record = fetched.find(r => r.name === name) || fetched[0];
    }
  }

  if (!record) {
    return send(res, 404, { status: 'error', error_code: 'NO_MATCH', message: `No capability registered at: ${name}` });
  }
  send(res, 200, { status: 'ok', capability: record });
}

function handleHealth(req, res) {
  send(res, 200, {
    status:           registry.mode === 'unavailable' ? 'degraded' : 'ok',
    registry:         registry.getStatus(),
    dnso_key:         dnsoKey.getStatus(),
    cache:            cache.stats(),
    resolver_version: VERSION,
    uptime_seconds:   Math.floor(process.uptime()),
    timestamp:        rfc3339UTC(),
  });
}

function handleTrace(req, res, traceId) {
  const trace = loadTrace(traceId);
  if (!trace) {
    return send(res, 404, { status: 'error', error_code: 'NO_MATCH', message: `No trace found: ${traceId}` });
  }
  send(res, 200, { status: 'ok', trace });
}

async function handleBatch(req, res) {
  // Spec REQ-3/4/10: trace_id on every per-request response; RFC 3339 ts.
  const ts = rfc3339UTC();

  // RS-007 fix (batch variant): top-level errors must also persist their
  // trace so /trace/{trace_id} can reconstruct the failure. Prior code
  // emitted trace_id but never called saveTrace() for top-level rejects.
  const respondTopLevel = (httpStatus, response, request) => {
    if (response.trace_id) {
      saveTrace(response.trace_id, {
        request:     request || null,
        response,
        resolved_at: ts,
        caller_id:   null,
        session_id:  null,
      });
    }
    send(res, httpStatus, response);
  };

  // Content-Type MUST be application/json. Round-2 review (RS2-002):
  // missing Content-Type is also rejected, not just wrong ones.
  const contentType = (req.headers['content-type'] || '').toLowerCase().split(';')[0].trim();
  if (contentType !== 'application/json') {
    return respondTopLevel(400, {
      status: 'error', error_code: 'QUERY_MALFORMED',
      message: contentType === ''
        ? 'Content-Type header is required and must be application/json.'
        : `Content-Type must be application/json. Got: "${contentType}"`,
      trace_id: newTraceId(), resolved_at: ts,
      resolver_version: VERSION, scoring_profile: SCORING_PROFILE,
    });
  }

  let body;
  try { body = await readBody(req); }
  catch (e) {
    return respondTopLevel(400, {
      status: 'error', error_code: 'QUERY_MALFORMED', message: e.message,
      trace_id: newTraceId(), resolved_at: ts,
      resolver_version: VERSION, scoring_profile: SCORING_PROFILE,
    });
  }

  if (!Array.isArray(body.requests)) {
    return respondTopLevel(400, {
      status: 'error', error_code: 'QUERY_MALFORMED', message: '"requests" must be an array.',
      trace_id: newTraceId(), resolved_at: ts,
      resolver_version: VERSION, scoring_profile: SCORING_PROFILE,
    }, body);
  }
  if (body.requests.length > 50) {
    return respondTopLevel(400, {
      status: 'error', error_code: 'QUERY_TOO_BROAD', message: 'Batch maximum is 50 requests per call.',
      trace_id: newTraceId(), resolved_at: ts,
      resolver_version: VERSION, scoring_profile: SCORING_PROFILE,
    }, body);
  }

  const results = await Promise.all(body.requests.map(async r => {
    const itemTraceId = newTraceId();

    // RS-006 fix (batch variant): per-item validation before resolveQuery.
    // Same validator used by /resolve — structurally-bad per-item input
    // becomes a clean per-item 400 QUERY_MALFORMED rather than reaching
    // internal type errors. Note: per-item HTTP status is conceptual
    // (each item's status field carries the real outcome); the batch
    // envelope is always 200.
    const validationErrors = validateResolveRequest(r);
    if (validationErrors.length > 0) {
      const response = {
        status: 'error', error_code: 'QUERY_MALFORMED',
        message: 'Request validation failed.',
        errors: validationErrors,
        query: (r && r.query) || null,
        trace_id: itemTraceId, resolved_at: ts,
        resolver_version: VERSION, scoring_profile: SCORING_PROFILE,
      };
      // RS-007 fix: persist trace for per-item validation errors too
      saveTrace(itemTraceId, {
        request: r, response, resolved_at: ts,
        caller_id: (r && r.context && r.context.caller_id) || null,
        session_id: (r && r.context && r.context.session_id) || null,
      });
      return response;
    }
    const result   = await resolveQuery(r.query, r);
    const response = {
      ...result,
      query:            r.query,
      resolved_at:      ts,
      trace_id:         itemTraceId,
      resolver_version: VERSION,
      scoring_profile:  SCORING_PROFILE,
    };
    const ctx = r.context || {};
    saveTrace(itemTraceId, { request: r, response, resolved_at: ts, caller_id: ctx.caller_id || null, session_id: ctx.session_id || null });
    return response;
  }));

  // RS-008 fix: batch envelope now includes resolver_version and
  // scoring_profile for consistency with per-item responses and with
  // the single /resolve response shape.
  send(res, 200, {
    status:           'ok',
    count:            results.length,
    results,
    resolved_at:      ts,
    resolver_version: VERSION,
    scoring_profile:  SCORING_PROFILE,
  });
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-DillClaw-Caller, X-DillClaw-Session, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const { pathname } = url.parse(req.url);

  try {
    if (req.method === 'POST' && pathname === '/resolve')              return await handleResolve(req, res);
    if (req.method === 'POST' && pathname === '/batch')                return await handleBatch(req, res);
    if (req.method === 'GET'  && pathname === '/health')               return handleHealth(req, res);
    if (req.method === 'GET'  && pathname.startsWith('/capability/'))  return await handleCapability(req, res, pathname.slice('/capability/'.length));
    if (req.method === 'GET'  && pathname.startsWith('/trace/'))       return handleTrace(req, res, pathname.slice('/trace/'.length));

    send(res, 404, { status: 'error', error_code: 'NOT_FOUND', message: `No route: ${req.method} ${pathname}` });
  } catch (e) {
    console.error('[server] Unhandled error:', e.message);
    send(res, 500, { status: 'error', error_code: 'RESOLVER_FAULT', message: e.message });
  }
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  dnsoKey.init();
  await registry.init();

  server.listen(PORT, '0.0.0.0', () => {
    const regLine = registry.source === 'remote'
      ? `Registry    remote  (${registry.data.length} records, refresh ${Math.round(REGISTRY_REFRESH_MS/1000)}s)`
      : `Registry    local   (${registry.data.length} records, registry.json)`;
    const keyLine = dnsoKey.configured
      ? `DNSO key    configured (${path.basename(dnsoKey.keyPath)}, ed25519)`
      : `DNSO key    NOT CONFIGURED — structural checks only`;

    console.log('');
    console.log('  ╔═══════════════════════════════════════════════════════╗');
    console.log('  ║     DillClaw Resolver  v0.1.8                         ║');
    console.log('  ║     dillweed.com/dillclaw-spec.html                   ║');
    console.log('  ╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Listening   http://0.0.0.0:${PORT}`);
    console.log(`  ${regLine}`);
    console.log(`  ${keyLine}`);
    console.log(`  Traces      ./traces/`);

    if (!dnsoKey.configured) {
      console.log('');
      console.log('  ⚠  Signature verification is STRUCTURAL ONLY.');
      console.log('     To enable cryptographic (Ed25519) verification:');
      console.log('       node tools/generate-keys.js');
      console.log('     This creates dnso_private.pem + dnso_public.pem and');
      console.log('     re-signs registry.json with real Ed25519 signatures.');
    }

    if (registry.mode === 'stale') {
      console.log('');
      console.log(`  ⚠  Registry is STALE: ${registry.lastError}`);
    }
    if (registry.mode === 'unavailable') {
      console.log('');
      console.log(`  ⚠  Registry is UNAVAILABLE: ${registry.lastError}`);
    }

    console.log('');
    console.log('  Endpoints:');
    console.log(`    POST  http://localhost:${PORT}/resolve`);
    console.log(`    POST  http://localhost:${PORT}/batch`);
    console.log(`    GET   http://localhost:${PORT}/health`);
    console.log(`    GET   http://localhost:${PORT}/capability/<path>`);
    console.log(`    GET   http://localhost:${PORT}/trace/<trace_id>`);
    console.log('');
    console.log('  Ready — press Ctrl+C to stop.');
    console.log('');
  });
}

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: Port ${PORT} is already in use.`);
    console.error(`  Try:  DILLCLAW_PORT=9484 node server.js\n`);
  } else {
    console.error('[server] Fatal:', e);
  }
  process.exit(1);
});

main().catch(e => {
  console.error('[server] Failed to start:', e);
  process.exit(1);
});
