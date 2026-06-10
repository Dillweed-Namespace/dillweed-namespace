# v2 Implementation Tracker

## Current Wave: W0 (Hardening — no protocol changes)
## Status: In progress (1/6 tasks complete)
## Last Session: 2026-06-10
## Last Commit: n/a (changes in working tree, not yet committed)

## W0 Task List (from v2 design document §W0)
- [x] ETag/If-Modified-Since on Registry /list
- [ ] SQL-level LIMIT/OFFSET on /list (replace JS array slice)
- [ ] Rate limiting on all three services
- [ ] Resolver probe_liveness: disabled by default, add endpoint allowlist
- [ ] Resolver refresh jitter + exponential backoff
- [ ] /list tag filter: add index (replace LIKE scan)

## Current Task: SQL-level LIMIT/OFFSET on /list (replace JS array slice)
## Blocked On: nothing
## Next Step: Push LIMIT/OFFSET into the prepared statements in registry/server.js handleList() (replace rows.slice()), per v2 design §2.2.7

## Session Notes
- 2026-06-10: Tracker created. Wave 0 scope defined from docs/dillweed-v2-design-2026-06-10.md.
- 2026-06-10: ETag/If-Modified-Since on Registry /list — DONE. Added a catalog-version counter (bumped on register/revoke/promote, seeded from registration_log at startup), strong `ETag` ("cat-<hex>") + `Last-Modified` on /list, and 304 handling for `If-None-Match`/`If-Modified-Since`. Non-breaking; no other endpoint changed (`send()` gained optional extraHeaders). Added 6 conditional-read tests to registry/test.sh; full suite 85/85 passing against an isolated instance on port 9485 (production on 9475 untouched). Changes in working tree only — not committed/pushed.
