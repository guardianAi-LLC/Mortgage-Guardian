---
phase: 41-api-proxy-wiring
plan: 01
subsystem: api
tags: [next.js, proxy, clerk, jwt, supabase, rewrites]

# Dependency graph
requires:
  - phase: 40-testflight-prep
    provides: completed iOS app, Express backend with dual-auth middleware
provides:
  - Working Next.js → Express proxy with health endpoints
  - Auth token flow verified (Clerk JWT via JWKS)
  - Snake_case → camelCase response mapping
  - Supabase database tables created (baseline migration)
affects: [42-document-library, 43-analytics, 44-plaid-ui, 45-dispute-letters, 46-forensic-ui, 47-settings, 48-admin, 49-performance, 50-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns: [mapCase snake_case→camelCase transform in hooks.ts, response envelope unwrapping]

key-files:
  created: []
  modified:
    - frontend/next.config.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/hooks.ts

key-decisions:
  - "Use plain getToken() instead of getToken({ template: 'supabase' }) — Supabase template JWT has wrong issuer for Clerk JWKS verification"
  - "Map snake_case Supabase responses to camelCase in hooks layer rather than backend — keeps backend API stable for iOS"
  - "Pushed baseline migration to Supabase via Management API — database was empty"

patterns-established:
  - "mapCase(): snake_case→camelCase transform for all Case responses from backend"
  - "Response envelope unwrapping: backend returns { cases: [...] }, hooks extract the array"

issues-created: []

# Metrics
duration: 45min
completed: 2026-04-13
---

# Phase 41 Plan 01: API Proxy & End-to-End Wiring Summary

**Health endpoint proxy rewrites, Clerk JWT auth fix, snake_case response mapping, and Supabase baseline migration**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-13T00:45:00Z
- **Completed:** 2026-04-13T01:35:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 3

## Accomplishments
- Health endpoint rewrites (/health, /health/live, /health/ready) proxy to Express backend
- Fixed auth token flow: useApiToken() now uses standard Clerk JWT instead of Supabase template token
- Added snake_case → camelCase response mapping so dashboard displays case names correctly
- Pushed baseline migration to Supabase — all 9 tables, RLS policies, indexes, and triggers created
- End-to-end verified: case creation, dashboard display, health endpoint all working

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix proxy configuration gaps** - `7413c2a` (feat)
2. **Task 2: Auth token flow fix** - `381b10b` (fix)
3. **Task 3: Checkpoint verified** - manual verification approved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Response envelope unwrapping**
- **Found during:** Checkpoint verification
- **Issue:** Backend returns `{ cases: [...], total, userId }` but frontend expected flat array — caused `cases?.filter is not a function` error
- **Fix:** Unwrap `res.cases` in useCases hook
- **Committed in:** `6a907ff`

**2. [Rule 2 - Missing Critical] Snake_case → camelCase mapping**
- **Found during:** Checkpoint verification
- **Issue:** Supabase returns `case_name`, `borrower_name` etc. but frontend Case type uses `caseName`, `borrowerName` — case info not displayed
- **Fix:** Added `mapCase()` transform in hooks.ts
- **Committed in:** `6a907ff`

**3. [Rule 3 - Blocking] Supabase database empty**
- **Found during:** Checkpoint verification
- **Issue:** case_files table didn't exist — case creation silently failed
- **Fix:** Pushed baseline migration (20260401092448_baseline.sql) via Supabase Management API
- **Verification:** All 9 tables confirmed created, case creation succeeded

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking), 0 deferred
**Impact on plan:** All fixes necessary for end-to-end functionality. No scope creep.

## Files Created/Modified
- `frontend/next.config.ts` - Added /health, /health/live, /health/ready rewrites
- `frontend/src/lib/api.ts` - Added live() and ready() health methods
- `frontend/src/lib/hooks.ts` - Fixed auth token, added response mapping

## Decisions Made
- Used plain `getToken()` instead of Supabase template — template JWT issuer doesn't match Clerk JWKS
- Map snake_case in frontend hooks rather than backend — keeps backend stable for iOS app
- Populated real Supabase credentials from CLI, not placeholders

## Issues Encountered
- Supabase database was completely empty (no tables) — baseline migration had never been pushed to remote
- Backend .env was empty — populated with real credentials via Supabase CLI

## Next Phase Readiness
- Frontend-to-backend connection fully working
- All Phase 42-50 features can build on this foundation
- Database schema in place for all services

---
*Phase: 41-api-proxy-wiring*
*Completed: 2026-04-13*
