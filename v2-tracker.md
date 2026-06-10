# v2 Implementation Tracker

## Current Wave: W0 (Hardening — no protocol changes)
## Status: In progress (2/6 tasks complete)
## Last Session: 2026-06-10
## Last Commit: n/a (changes in working tree, not yet committed)

## W0 Task List (from v2 design document §W0)
- [x] ETag/If-Modified-Since on Registry /list
- [x] SQL-level LIMIT/OFFSET on /list (replace JS array slice)
- [ ] Rate limiting on all three services
- [ ] Resolver probe_liveness: disabled by default, add endpoint allowlist
- [ ] Resolver refresh jitter + exponential backoff
- [ ] /list tag filter: add index (replace LIKE scan)

## Current Task: Rate limiting on all three services
## Blocked On: nothing
## Next Step: Add static rate-limiting guards (per v2 design §4.2, W0 static guards) to Registry, Resolver, and Anthill — return 429 on limit breach

## Session Notes
- 2026-06-10: Tracker created. Wave 0 scope defined from docs/dillweed-v2-design-2026-06-10.md.
- 2026-06-10: ETag/If-Modified-Since on Registry /list — DONE. Added a catalog-version counter (bumped on register/revoke/promote, seeded from registration_log at startup), strong `ETag` ("cat-<hex>") + `Last-Modified` on /list, and 304 handling for `If-None-Match`/`If-Modified-Since`. Non-breaking; no other endpoint changed (`send()` gained optional extraHeaders). Added 6 conditional-read tests to registry/test.sh; full suite 85/85 passing against an isolated instance on port 9485 (production on 9475 untouched). Committed 74cad67 on v2/w0-hardening (not pushed).
- 2026-06-10: SQL-level LIMIT/OFFSET on /list — DONE. Pushed pagination into SQL: listAll/listByTier/listByTag now carry `LIMIT ? OFFSET ?` (deterministic `ORDER BY name, version`); `total` comes from a separate COUNT (countActive / new countByTierOne / new countByTag) so it stays accurate independent of page size. handleList no longer materializes the full result set and slices in JS (closes F-10 truncation / S3 full-scan, v2 design §2.2.7). Response shape unchanged. NOTE: tag-filter indexing remains a separate W0 task (the LIKE scan is untouched here). Added 6 pagination tests to registry/test.sh; full suite 91/91 passing on the isolated 9485 instance. Changes in working tree — not yet committed.
