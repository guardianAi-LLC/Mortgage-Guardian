---
phase: 56-auth-hardening
plan: 03
subsystem: auth
tags: [plaid, exchange-token, fetch, 401, refresh, clerk, vitest, ISS-001]

requires:
  - phase: 56-auth-hardening
    provides: emitAuditEvent helper + AUDIT_EVENTS allow-list (56-02)

provides:
  - "POST /v1/plaid/exchange_token: access_token removed from response (ISS-001 closed)"
  - "plaid_token_encrypted audit emission after successful upsert"
  - "fetchWithAuth: TokenGetter-based signature with one-shot 401 refresh retry"
  - "useApiToken hook returns a TokenGetter (forwards skipCache to Clerk)"
  - "Vitest + jsdom test infra for frontend (vitest.config.ts, npm test script)"
  - "5 unit tests for fetchWithAuth retry semantics"

affects: [56-04-encryption-audit, 56-05-finalize, future-frontend-tests]

tech-stack:
  added: [vitest ^4.1.8, @vitest/ui ^4.1.8, jsdom ^29.1.1]
  patterns:
    - "Token getter pattern: API wrapper accepts (path, getToken, options) not (path, token, options) — enables transparent refresh-on-401 without per-call-site retry logic"
    - "Pre-flight refresh check before retry fetch: skipping a second fetch when getToken still returns null avoids wasted network calls and a null Authorization header on the retry"

key-files:
  created:
    - frontend/src/lib/__tests__/api-401-retry.test.ts
    - frontend/vitest.config.ts
    - .planning/phases/56-auth-hardening/56-03-SUMMARY.md
  modified:
    - backend-express/routes/plaid.js
    - backend-express/__tests__/routes/plaid-routes.test.js
    - frontend/src/lib/api.ts
    - frontend/src/lib/hooks.ts
    - frontend/src/hooks/use-plaid-link.ts
    - frontend/src/hooks/use-analytics.ts
    - frontend/package.json
    - frontend/package-lock.json
    - .planning/ISSUES.md

key-decisions:
  - "fetchWithAuth retains Promise<any> return type — the original implicit `any` was load-bearing for downstream hooks that access response fields without type guards. Switching to `unknown` would have cascaded into ~14 TS errors across pages and hooks unrelated to this plan."
  - "useApiToken now returns null (not throws) when there is no Clerk session — required so fetchWithAuth can branch on 'refresh impossible' without exception handling, and so anonymous endpoints (none currently, but allowed by contract) behave sensibly."
  - "Refresh decision is gated on a pre-fetch getToken({skipCache:true}) call: if the refreshed token is null we skip the retry entirely. This costs one extra getToken invocation on null-session 401s in exchange for never sending a retry with a null Authorization header."
  - "Vitest chosen over Jest for the frontend per the plan; Next.js 16 + Turbopack ecosystem aligns better with Vite-based tooling than Jest's transform pipeline."

patterns-established:
  - "All web API wrappers take (getToken, ...args) — never a pre-fetched token string. Token-getter pattern lives in TokenGetter export from lib/api.ts."
  - "401-refresh-retry contract: one retry per request, second 401 propagates as ApiError(401), non-401 never retries — mirrors iOS APIClient."

issues-created: []

duration: ~35min
completed: 2026-06-11
---

# Phase 56-03: Plaid Exchange-Token Cleanup + Web 401 Refresh Retry Summary

**Remove raw access_token from /exchange_token response (ISS-001 closed) and add iOS-parity one-shot 401 refresh retry to web fetchWithAuth.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-06-11
- **Tasks:** 2
- **Files modified/created:** 11

## Accomplishments

- `POST /v1/plaid/exchange_token` no longer returns `access_token`. Response is now `{ item_id, request_id, warning }`; the encrypted token lives in `plaid_items` (server-side, resolved per-request via `resolveTokenByItemId`). Stale "iOS can store locally" comment removed.
- Successful upsert now emits `emitAuditEvent('plaid_token_encrypted', { userId, itemId, requestId })` — the event was already on the AUDIT_EVENTS allow-list from 56-02.
- `plaid-routes.test.js` updated: explicit `expect(res.body).not.toHaveProperty('access_token')` assertion guards against regression.
- iOS grep confirms no Swift consumer of the removed field — only a stale comment in `MortgageGuardian/Views/PlaidConnectionView.swift:193`, no decoding.
- `fetchWithAuth` refactored to accept a `TokenGetter` (mirrors iOS `APIClient.performRequest`/`onAuthenticationRequired`). On 401, calls `getToken({ skipCache: true })` and retries exactly once; second 401 (and any non-401) propagates without further retry. `getToken` returning null short-circuits the retry (nothing to refresh).
- All call sites migrated: `lib/hooks.ts` (20 hooks), `hooks/use-plaid-link.ts` (8 hooks), `hooks/use-analytics.ts` (1 hook). `useApiToken()` now returns a `TokenGetter` directly (Clerk `getToken` bound) instead of a token-fetching `async () => string`.
- Vitest + jsdom test infra added (no prior frontend test runner — only Playwright e2e). `vitest.config.ts` aliases `@` to `src`, scans `src/**/__tests__/**/*.test.ts(x)`. `npm test` runs `vitest run`; `npm run test:watch` for dev.
- 5 unit tests in `src/lib/__tests__/api-401-retry.test.ts`: 200 passthrough (no retry), 401→200 retry (skipCache:true on second getToken), 401→401 propagation (exactly one retry, never two), 403/500 no-retry, null-token no-retry.
- `.planning/ISSUES.md`: ISS-001 moved from Open to a new Closed section with phase reference, resolution detail, and iOS-grep confirmation.

## Task Commits

1. **Task 1: Remove access_token from /exchange_token response** — `19c5ade` (feat)
2. **Task 2: Web fetchWithAuth one-shot 401 refresh retry** — `b4bb399` (feat)

**Plan metadata commit:** *(added in the final docs commit)*

## Decisions Made

See `key-decisions` in frontmatter. Highlights:
- `fetchWithAuth: Promise<any>` — Rule 4 deviation, documented inline, scoped to keep TS errors out of files unrelated to this plan.
- `useApiToken` returns `null` on no-session — change from "throws Not authenticated" — required by the wrapper contract.
- Pre-flight `getToken({skipCache:true})` before retry fetch — costs one extra getToken invocation, prevents a retry fetch with null Authorization.

## Deviations from Plan

**1. fetchWithAuth return type kept as `Promise<any>`** (Auto-fix, Rule 4 — minimize blast radius)
- Plan signature said `Promise<Response>`; the original (pre-plan) function returned a parsed JSON value (after `res.json()`), and every call site downstream expected that. Returning `Response` directly would have required rewriting every hook. Kept the parsed-JSON contract but typed the return as `Promise<any>` (with eslint-disable + comment) so existing call sites still type-check. The retry behavior described in the plan is implemented faithfully.
- Folded into Task 2 (`b4bb399`).

**2. Added Vitest dev-dep + vitest.config.ts** (Auto-fix, Rule 3 — blocking)
- Plan calls for Vitest tests but the frontend had no test runner installed and no test config. Added `vitest`, `@vitest/ui`, `jsdom` to devDependencies and created `vitest.config.ts` + `npm test`/`npm run test:watch` scripts.
- Folded into Task 2 (`b4bb399`).

**3. `useApiToken` now returns null instead of throwing** (Auto-fix, Rule 3 — required by wrapper contract)
- Original threw `Error('Not authenticated')`. The new `fetchWithAuth` contract returns the unauthenticated 401 to the caller rather than crashing; throwing inside the getter would short-circuit that. Same observable behavior for authenticated paths (Clerk getToken returns a string), only different for the no-session case which previously was never exercised at the wrapper level.
- Folded into Task 2 (`b4bb399`).

**4. New test file required force-add** (Mechanical workaround)
- Root `.gitignore` line 297 has Python-pattern `lib/` which catches `frontend/src/lib/` paths. Used `git add -f` for the new test file (and the modified `lib/api.ts`/`lib/hooks.ts` files were already tracked by name). Existing pattern — files in this directory have always been tracked despite the gitignore.

**Total deviations:** 4 auto-fixed (typing scope, missing test infra, getter contract, gitignore mechanics). No architectural changes. No deferred issues created.

## Issues Resolved

- **ISS-001** — `POST /v1/plaid/exchange_token` no longer returns the raw `access_token`. Closed in `.planning/ISSUES.md` with full resolution detail.

## Issues Encountered

- Backend test sandbox required `dangerouslyDisableSandbox: true` for `git add`/`commit` (per `backend-test-quirks` memory) — expected.
- `frontend/src/lib/` gitignored at the root (Python `lib/` pattern). Worked around with `git add -f` for the new test file; existing files unaffected.
- Pre-existing test failures in `__tests__/services/financialSecurityService.test.js` and `__tests__/services/vendorNeutralSecurityService.test.js` — 2 failed suites, **unrelated to this plan**, present at baseline. 1698 passing tests after this plan matches baseline.

## Test Counts

- Backend: 1698 passing (baseline 1698 — exact match; the 2 failing suites are pre-existing and unrelated to Plaid/auth).
- Frontend (new): 5 passing across 1 file in `src/lib/__tests__/api-401-retry.test.ts`. First frontend unit-test suite in the project.
- `npm run build` (frontend, Next.js + Turbopack): clean.
- `npx tsc --noEmit` (frontend): clean.
- `grep -n "access_token" backend-express/routes/plaid.js`: no occurrences in the `/exchange_token` response builder.

## Next Phase Readiness

- Ready for 56-04 (encryption rotation + ISS-003: dedicated `rotate-plaid-key.js`).
- Vitest now available for any future frontend logic that needs unit coverage.
- `TokenGetter` pattern is now the canonical web auth-token contract — extending to new endpoints requires no further wrapper changes.

---
*Phase: 56-auth-hardening*
*Plan: 03*
*Completed: 2026-06-11*
