---
phase: 56-auth-hardening
plan: 01
subsystem: auth/security
tags: [csrf, middleware, express, supertest, origin-gate, defense-in-depth]

# Dependency graph
requires:
  - phase: 55-upload-security
    provides: upload pipeline hardening, Cloudmersive scanning — sets the security baseline this plan extends
provides:
  - csrfOriginGuard middleware (backend-express/middleware/csrfOriginGuard.js)
  - 8-case supertest coverage for accept/reject/exempt/bearer/preflight/Referer-fallback
  - Plaid webhook exemption pattern for signature-verified routes
affects: [56-02, 56-03, 56-04, 56-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-rolled stateless Origin/Referer gate (no csurf, no cookies, Vercel-friendly)"
    - "Bearer-bypass pattern: token-bearing clients (iOS, server-to-server) skip CSRF checks since they are not subject to browser ambient-credential CSRF"
    - "Path-based exemption for signature-verified webhooks (Plaid)"

key-files:
  created:
    - backend-express/middleware/csrfOriginGuard.js
    - backend-express/__tests__/middleware/csrfOriginGuard.test.js
  modified:
    - backend-express/server.js (import + mount after requireAuth, before route handlers)

key-decisions:
  - "Mount csrfOriginGuard AFTER requireAuth (not before, as initially attempted) to preserve the 401-without-auth API contract — see Deviations"
  - "No new dependency — Origin/Referer gate is ~100 LOC, hand-rolled, stateless"
  - "Plaid webhook path-exempted (no Origin from Plaid servers; signature already verified upstream)"

patterns-established:
  - "Defense-in-depth CSRF: Origin/Referer gate on top of bearer-JWT auth, no cookies required"
  - "Test pattern: build minimal Express app in test, mount middleware, supertest exercise of all branches"

issues-created: []

# Metrics
duration: ~25min
completed: 2026-06-11
---

# Phase 56-01: csrfOriginGuard Summary

**Origin/Referer CSRF gate with bearer-bypass and Plaid webhook exemption, 8-case supertest coverage; stateless, no cookies, mounted after requireAuth.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-11
- **Tasks:** 3 (plus 1 auto-fix)
- **Files created:** 2
- **Files modified:** 1

## Accomplishments
- `csrfOriginGuard(options)` middleware: GET/HEAD/OPTIONS bypass, Bearer-token bypass, path-exempt bypass, Origin allowlist with Referer fallback, 403 `csrf_origin_mismatch` on reject with structured `security` logger warning.
- Mounted in `backend-express/server.js` between `requireAuth` and route mounts, exempting `/v1/plaid/webhook`.
- 8 supertest cases proving: read-only bypass, bearer bypass, allowed Origin accept, disallowed Origin reject, no-origin no-bearer reject, Referer fallback, exempt path bypass, preflight bypass.

## Task Commits

1. **Task 1: Implement csrfOriginGuard middleware** — `0c9d58b` (feat)
2. **Task 2: Mount middleware in app** — `7fa57cd` (feat)
3. **Task 3: Integration tests (8 supertest cases)** — `6c840ff` (test)
4. **Auto-fix: Move mount point after requireAuth** — `4caebfb` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified
- `backend-express/middleware/csrfOriginGuard.js` — 117 LOC stateless Origin/Referer gate
- `backend-express/__tests__/middleware/csrfOriginGuard.test.js` — 8 supertest cases
- `backend-express/server.js` — import + mount line (post-requireAuth, pre-routes)

## Decisions Made
- **No `csurf`** — deprecated, requires cookies; API is bearer-JWT today.
- **No double-submit cookie pattern** — no cookie auth on the API.
- **Bearer-bypass** — keeps the iOS app and server-to-server consumers untouched (they are inherently CSRF-immune).
- **Mount after requireAuth** — preserves existing 401-for-unauthenticated-POST behavior and downstream test contracts; CSRF still gates authenticated cross-origin browser requests.
- **Plaid webhook exempt** — no Origin from Plaid servers; signature verification already enforces authenticity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Bug/Blocking] Mount order: csrfOriginGuard before requireAuth caused 29 test regressions**
- **Found during:** Full-suite verification after Task 3.
- **Issue:** Plan's mount point (between CORS and route mounts, ahead of requireAuth) caused existing "returns 401 without auth" tests across claude-routes, plaid-routes, cases-routes, documents, compliance, reports, and auth-integration suites to receive 403 instead of 401. The 403 is semantically valid (no auth + no Origin == both layers should reject) but breaks the established API contract that auth failures return 401.
- **Fix:** Moved the mount point to AFTER `app.use('/v1/', requireAuth)`. Still before route handlers (per plan's stated requirement). Auth runs first → unauthenticated requests still get 401; then csrfOriginGuard catches authenticated-but-cross-origin browser requests. Bearer clients bypass both layers cleanly.
- **Files modified:** `backend-express/server.js`
- **Verification:** Full suite went from 29 failing → 0 failing (only pre-existing module-not-found failures in `financialSecurityService.test.js` and `vendorNeutralSecurityService.test.js` remain, unrelated to this work).
- **Committed in:** `4caebfb` (fix commit)

**Total deviations:** 1 auto-fixed (Rule 4 — bug fix), 0 deferred
**Impact on plan:** Mount-point adjustment preserves API contract while still satisfying plan's "before route mounts" requirement. CSRF gate semantics unchanged. No scope creep.

## Issues Encountered
- Pre-existing test-suite failures in `__tests__/services/financialSecurityService.test.js` and `__tests__/services/vendorNeutralSecurityService.test.js` (missing `./credentials` module). Verified to exist on baseline commit `84d4b6e` (before any 56-01 changes). Not in scope.

## Verification Results

- [x] `npm --prefix backend-express test -- middleware/csrfOriginGuard.test.js --watchman=false` — **8/8 pass**
- [x] Full suite: **1,683 passed, 10 skipped, 0 test failures** (2 pre-existing suite-load failures unrelated to this work)
- [x] `npm --prefix backend-express run lint` — 0 errors (34 pre-existing warnings unchanged)
- [x] `grep -n csrfOriginGuard backend-express/server.js` — mounted at line 129 (post requireAuth line 121, pre route mounts line 158+)
- [x] No new dependency added to `package.json`

## Next Phase Readiness
- Ready for **56-02-PLAN.md** (session config + audit log).
- Patterns established: stateless security middleware, supertest min-app pattern, bearer-bypass convention — directly reusable in 56-02+.

---
*Phase: 56-auth-hardening*
*Completed: 2026-06-11*
