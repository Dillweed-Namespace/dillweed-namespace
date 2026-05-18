// ─────────────────────────────────────────────────────────────────────────────
//  DillClaw → Dillweed Registry Client Patch
//
//  This file replaces the loadRegistry() / getAll() functions in the DillClaw
//  resolver (server.js) so it queries the live Dillweed Registry instead of
//  reading the local registry.json file.
//
//  HOW TO USE:
//    1.  Start the Dillweed Registry:  node server.js  (in dillweed-registry/)
//    2.  In your DillClaw resolver directory, replace the "Registry" section
//        (lines beginning with "// ─── Registry") with the code below.
//    3.  Start DillClaw with the registry URL set:
//          DILLCLAW_REGISTRY_URL=http://localhost:9475 node server.js
//
//  The DillClaw resolver will now fetch live Capability Records from the
//  Dillweed Registry rather than the static registry.json file.
//  The local registry.json becomes a fallback if the registry is unreachable.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const REGISTRY_URL      = process.env.DILLCLAW_REGISTRY_URL || null;
const REGISTRY_FALLBACK = path.join(__dirname, 'registry.json');
const FETCH_TIMEOUT_MS  = 3000;

// In-memory cache: all records fetched from the live registry
let liveCache = null;
let liveCacheAt = 0;
const LIVE_CACHE_TTL = 60 * 1000;  // refresh from registry every 60s

function fetchFromRegistry() {
  return new Promise((resolve, reject) => {
    if (!REGISTRY_URL) return reject(new Error('DILLCLAW_REGISTRY_URL not set'));

    const listUrl = REGISTRY_URL.replace(/\/$/, '') + '/list?limit=500';
    const mod     = listUrl.startsWith('https') ? https : http;

    const req = mod.get(listUrl, { timeout: FETCH_TIMEOUT_MS }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.records && Array.isArray(data.records)) {
            resolve(data.records);
          } else {
            reject(new Error('Unexpected registry response format'));
          }
        } catch (e) {
          reject(new Error('Failed to parse registry response: ' + e.message));
        }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Registry request timed out')); });
  });
}

function loadFallback() {
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_FALLBACK, 'utf8'));
    return data.capabilities || [];
  } catch {
    return [];
  }
}

// Async version — used at startup and by the refresh loop
async function refreshLiveCache() {
  try {
    const records = await fetchFromRegistry();
    liveCache   = records;
    liveCacheAt = Date.now();
    console.log(`  [registry] Loaded ${records.length} records from ${REGISTRY_URL}`);
    return records;
  } catch (e) {
    console.warn(`  [registry] Live fetch failed: ${e.message}. Using fallback.`);
    return null;
  }
}

// Synchronous-compatible accessor — returns whatever is in memory
// (warm-path: nearly always returns cached data, no await needed)
function getAll() {
  // If we have a live registry URL
  if (REGISTRY_URL) {
    const stale = !liveCache || (Date.now() - liveCacheAt > LIVE_CACHE_TTL);
    if (stale) {
      // Trigger async background refresh; return stale or fallback this request
      refreshLiveCache().catch(() => {});
    }
    if (liveCache) return liveCache;
    // Not yet populated — fall through to local fallback
    console.warn('  [registry] Live cache empty, using registry.json fallback');
    return loadFallback();
  }

  // No live registry configured — use local file (original behaviour)
  return loadFallback();
}

// Warm the cache on startup if a live registry URL is configured
if (REGISTRY_URL) {
  console.log(`  [registry] Connecting to live registry: ${REGISTRY_URL}`);
  refreshLiveCache().then(records => {
    if (!records) {
      console.warn('  [registry] Falling back to registry.json for this session.');
    }
  });

  // Periodic refresh every 60s
  setInterval(() => { refreshLiveCache().catch(() => {}); }, LIVE_CACHE_TTL).unref();
}

module.exports = { getAll };

// ─── Integration notes ────────────────────────────────────────────────────────
//
//  In server.js, replace the existing Registry section with:
//
//    const registry = require('./resolver-patch');
//    function getAll() { return registry.getAll(); }
//
//  Then remove the original loadRegistry() and getAll() functions.
//
//  The resolver will now:
//    - Fetch records from http://localhost:9475/list on startup
//    - Refresh every 60 seconds in the background
//    - Fall back to registry.json if the live registry is unreachable
//    - Log all registry activity to the console
//
// ─────────────────────────────────────────────────────────────────────────────
