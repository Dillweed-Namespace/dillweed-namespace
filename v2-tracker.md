# v2 Implementation Tracker

## Current Wave: W0 (Hardening — no protocol changes)
## Status: In progress (3/6 tasks complete)
## Last Session: 2026-06-10
## Last Commit: n/a (changes in working tree, not yet committed)

## W0 Task List (from v2 design document §W0)
- [x] ETag/If-Modified-Since on Registry /list
- [x] SQL-level LIMIT/OFFSET on /list (replace JS array slice)
- [x] Rate limiting on all three services
- [ ] Resolver probe_liveness: disabled by default, add endpoint allowlist
- [ ] Resolver refresh jitter + exponential backoff
- [ ] /list tag filter: add index (replace LIKE scan)

## Current Task: Resolver probe_liveness — disabled by default, add endpoint allowlist
## Blocked On: nothing
## Next Step: Gate probe_liveness behind auth + an internal-range deny-list (loopback, 169.254/16, RFC-1918), host-pinned before probing (closes F-8 SSRF), per v2 design §4.2.2 / §4.4

## Session Notes
- 2026-06-10: Tracker created. Wave 0 scope defined from docs/dillweed-v2-design-2026-06-10.md.
- 2026-06-10: ETag/If-Modified-Since on Registry /list — DONE. Added a catalog-version counter (bumped on register/revoke/promote, seeded from registration_log at startup), strong `ETag` ("cat-<hex>") + `Last-Modified` on /list, and 304 handling for `If-None-Match`/`If-Modified-Since`. Non-breaking; no other endpoint changed (`send()` gained optional extraHeaders). Added 6 conditional-read tests to registry/test.sh; full suite 85/85 passing against an isolated instance on port 9485 (production on 9475 untouched). Committed 74cad67 on v2/w0-hardening (not pushed).
- 2026-06-10: SQL-level LIMIT/OFFSET on /list — DONE. Pushed pagination into SQL: listAll/listByTier/listByTag now carry `LIMIT ? OFFSET ?` (deterministic `ORDER BY name, version`); `total` comes from a separate COUNT (countActive / new countByTierOne / new countByTag) so it stays accurate independent of page size. handleList no longer materializes the full result set and slices in JS (closes F-10 truncation / S3 full-scan, v2 design §2.2.7). Response shape unchanged. NOTE: tag-filter indexing remains a separate W0 task (the LIKE scan is untouched here). Added 6 pagination tests to registry/test.sh; full suite 91/91 passing on the isolated 9485 instance. Committed 25670a4 on v2/w0-hardening (not pushed).
- 2026-06-10: Rate limiting on all three services — DONE. Added a per-IP fixed-window limiter (separate read vs write/expensive budgets, default 300/100 per 60s, env-overridable, /health + OPTIONS exempt) to Registry, Resolver, and Anthill. Returns 429 + Retry-After (§4.2.2) and exposes `rate_limit` in each /health. Write class: Registry=POST or /verify; Resolver=POST /batch only (plain /resolve is a cheap read); Anthill=POST /signal. Scope = rate limiting only (per the decision); fail-closed binding/CORS and the probe deny-list are NOT in this task. Cost-weighted per-identity quotas are W1. Added 4 rate-limit tests to each service's test.sh (self-calibrating bursts from /health). Verified on isolated stack (registry 9485, resolver 9484→9485, anthill 9486): Registry 95/95; Anthill 62/62 (token mode); Resolver 64 pass / 5 fail where the 5 are pre-existing seed-fixture gaps (multi-version + unsigned records absent from the 7-record dev seed) — proven environmental by an identical failure set with the limiter disabled (DILLCLAW_RL_DISABLED=1). Production (9474/9475/9476) untouched. 6 files in working tree (3 server.js + 3 test.sh) — not yet committed.
