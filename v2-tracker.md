# v2 Implementation Tracker

## Current Wave: W0 (Hardening — no protocol changes)
## Status: Not started
## Last Session: 2026-06-10
## Last Commit: n/a

## W0 Task List (from v2 design document §W0)
- [ ] ETag/If-Modified-Since on Registry /list
- [ ] SQL-level LIMIT/OFFSET on /list (replace JS array slice)
- [ ] Rate limiting on all three services
- [ ] Resolver probe_liveness: disabled by default, add endpoint allowlist
- [ ] Resolver refresh jitter + exponential backoff
- [ ] /list tag filter: add index (replace LIKE scan)

## Current Task: ETag on Registry /list
## Blocked On: nothing
## Next Step: Implement ETag generation and If-Modified-Since handling in registry/server.js handleList()

## Session Notes
- 2026-06-10: Tracker created. Wave 0 scope defined from docs/dillweed-v2-design-2026-06-10.md.
