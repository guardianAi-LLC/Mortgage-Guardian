---
phase: 54-plaid-token-migration
plan: 02
subsystem: api
tags: [plaid, security, idor, joi, express, item-id, access-token]

# Dependency graph
requires:
  - phase: 54-plaid-token-migration
    provides: plaidDataService.resolveUserAccessToken + _decryptRow + access_token_encrypted column (54-01)
provides:
  - plaidDataService.resolveTokenByItemId(userId, itemId) — server-side ownership-checked token resolver
  - item_id-only request contract for /v1/plaid/accounts, /transactions, /item, /item/webhook, DELETE /item
  - Joi schemas reject access_token in request bodies via unknown(false)
  - 404 item_not_found response covers both "missing" and "not yours" (no existence leakage)
  - IDOR regression test suite (3 negative tests per endpoint)
affects: [54-03-frontend-rewire, 54-04-ios-rewire, 54-05-drop-plaintext-column, future-plaid-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side token resolution: clients send identifier (item_id), server resolves opaque credential"
    - "Joi unknown(false) to actively reject deprecated request fields (vs silent strip)"
    - "Uniform 404 shape for missing-or-foreign resources to avoid existence leaks"

key-files:
  created: []
  modified:
    - backend-express/services/plaidDataService.js
    - backend-express/schemas/plaid.js
    - backend-express/routes/plaid.js
    - backend-express/__tests__/routes/plaid-routes.test.js
    - backend-express/__tests__/validation/schemas.test.js

key-decisions:
  - "Same 404 item_not_found shape for missing AND foreign items (avoid IDOR existence leak)"
  - "Reject access_token via Joi unknown(false) instead of silent strip (clear 400 for stale clients)"
  - "Logs reference itemId + userId only — never the resolved access_token"
  - "Single-cut migration: no backward-compat window for access_token in request bodies"

patterns-established:
  - "Pattern: Route handlers call plaidDataService.resolveTokenByItemId(req.user.id, item_id) before any plaidService.* call; 404 on !success.success"
  - "Pattern: IDOR-regression tests assert (a) 400 on access_token in body, (b) 404 on foreign item, (c) 404 on missing item — same shape"

issues-created: []

# Metrics
duration: ~13min
completed: 2026-06-07
---

# Phase 54-02: Item-ID Routes Summary

**Plaid routes now resolve access tokens server-side from item_id with per-user ownership enforcement, closing an IDOR-style vulnerability where a stale or stolen access_token could be replayed across user accounts.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-07T18:45:22Z
- **Completed:** 2026-06-07T18:58:48Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `plaidDataService.resolveTokenByItemId(userId, itemId)` with strict (item_id, user_id) match and uniform `{ success:false, code:'not_found' }` for missing OR foreign items.
- Switched 5 Plaid endpoints to require `item_id` only; access_token is now purely a server-side secret.
- Joi schemas use `unknown(false)` so stale clients still sending `access_token` surface a clear HTTP 400 instead of silently failing later.
- Test suite gained 15 new IDOR-regression tests (3 per endpoint × 5 endpoints): rejects access_token in body, 404 on foreign item, 404 on non-existent item.

## Task Commits

Each task was committed atomically:

1. **Task 1: resolveTokenByItemId + item_id Joi schemas** - `0f7a315` (feat)
2. **Task 2: refactor 5 Plaid routes to item_id + server-side resolution** - `3e51605` (feat)
3. **Task 3: update route + schema tests with IDOR regressions** - `709424c` (test)

**Plan metadata:** _to be added by metadata commit_

## Files Created/Modified
- `backend-express/services/plaidDataService.js` - Added `resolveTokenByItemId(userId, itemId)` and refactored decrypt logic into reusable `_decryptRow` helper.
- `backend-express/schemas/plaid.js` - 5 schemas require `item_id`, reject `access_token` via `unknown(false)` + explicit `Joi.any().forbidden()` messaging.
- `backend-express/routes/plaid.js` - 5 handlers now resolve token via `plaidDataService.resolveTokenByItemId(req.user.id, item_id)` and return 404 `item_not_found` on miss.
- `backend-express/__tests__/routes/plaid-routes.test.js` - All 5 endpoint test groups rewritten for item_id contract + 15 new IDOR-regression cases; total suite 116/116 passing.
- `backend-express/__tests__/validation/schemas.test.js` - Plaid schema unit tests rewritten for item_id contract + explicit access_token-forbidden assertions; total suite 65/65 passing.

## New Request-Body Contract (for 54-03 web rewire + 54-04 iOS rewire)

All five endpoints require `Authorization: Bearer <clerk-jwt>` and reject `access_token` in the body with HTTP 400.

| Endpoint | Method | Request body | Server resolves | Errors |
|---|---|---|---|---|
| `/v1/plaid/accounts` | POST | `{ item_id: string, account_ids?: string[] }` | `accessToken` from `plaid_items` where `(item_id, user_id) = (item_id, req.user.id)` | 400 if access_token present or item_id missing; 404 `{ error:'item_not_found' }` if item missing OR owned by a different user |
| `/v1/plaid/transactions` | POST | `{ item_id: string, start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD', account_ids?: string[], count?: 1-500 (default 100), offset?: int>=0 (default 0) }` | same | same |
| `/v1/plaid/item` | POST | `{ item_id: string }` | same | same |
| `/v1/plaid/item/webhook` | POST | `{ item_id: string, webhook: string (uri) }` | same | same |
| `/v1/plaid/item` | DELETE | `{ item_id: string }` | same | same |

**404 response body (uniform):**
```json
{ "error": "item_not_found", "message": "No Plaid item found for the current user with that item_id" }
```

**Unchanged endpoints (still take/return access_token as before):**
- `POST /v1/plaid/link_token` — `access_token` field is optional, used for Plaid Link update mode.
- `POST /v1/plaid/exchange_token` — returns `access_token` to the client (will be locked down in a later phase; out of scope here).
- `GET /v1/plaid/items` — no body, returns `{ items: [{ itemId, institutionId, status, updatedAt, accounts: [] }] }`.
- `POST /v1/plaid/webhook` — Plaid → server callback, signature-verified.
- `POST /v1/plaid/sandbox_public_token`, `POST /v1/plaid/test`.

## Decisions Made
- **Uniform 404 shape for missing-or-foreign items.** Returning `404 item_not_found` for both cases prevents an attacker from probing for the existence of other users' items.
- **Reject `access_token` via `Joi.unknown(false)` + `Joi.any().forbidden()` messaging.** Joi's default `stripUnknown` would silently drop the field; explicit rejection gives stale clients a clear, debuggable 400.
- **Single-cut migration.** No backward-compat window — frontend (54-03) and iOS (54-04) ship in the same release.
- **Logs only reference itemId + userId, never the resolved access token.** Prevents accidental leakage through error pipelines or aggregated log sinks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Validation suite (`schemas.test.js`) used the old access_token-based contract**
- **Found during:** Final `npm test` verification after Task 3.
- **Issue:** Pre-existing Plaid schema unit tests in `__tests__/validation/schemas.test.js` asserted `access_token`-based contracts for the 5 endpoints; the schema changes from Task 1 broke 23 of those tests. Plan named only `plaid-routes.test.js` as the test target.
- **Fix:** Rewrote the `accountsSchema`, `transactionsSchema`, `itemSchema`, `updateWebhookSchema`, `deleteItemSchema` describe blocks in `schemas.test.js` to use `item_id` and added explicit "rejects access_token in body" cases mirroring the IDOR-prevention pattern from `plaid-routes.test.js`.
- **Files modified:** `backend-express/__tests__/validation/schemas.test.js`
- **Verification:** `npm test -- __tests__/validation/schemas.test.js` → 65/65 passing.
- **Committed in:** `709424c` (folded into Task 3 commit).

### Deferred Enhancements

None.

---

**Total deviations:** 1 auto-fixed (missing critical — schema unit tests outside the plan's listed test target), 0 deferred.
**Impact on plan:** Required to keep `npm test` green. No scope creep — same contract, broader test surface.

## Issues Encountered

- **Pre-existing test failures unrelated to this plan.** Three test suites fail independently of this work and were already failing on the parent commit `360ab7b`:
  - `__tests__/services/vendorNeutralSecurityService.test.js` — `Cannot find module './secretManagers'` (missing implementation file).
  - `__tests__/services/financialSecurityService.test.js` — same root cause chain.
  - `__tests__/integration/full-pipeline-e2e.test.js` — one test (`individual document analysis works independently`) calls `mockCrossDocAggregation.aggregateForCase` when it shouldn't, due to a documentPipeline behaviour change predating this phase.
  - Verified via `git stash` round-trip on the working tree: failures reproduce on the unmodified parent commit. Out of scope for this plan; not adding to ISSUES.md because they're already implicit in the failing CI signal.

## Next Phase Readiness

- **54-03 frontend rewire is now unblocked.** Web client must:
  1. Stop sending `access_token` in `/accounts`, `/transactions`, `/item`, `/item/webhook`, `DELETE /item`.
  2. Send `{ item_id }` from local state (sourced from `GET /v1/plaid/items` or `/exchange_token` response).
  3. Handle new 404 `{ error: 'item_not_found' }` shape — render as "this bank connection was removed" / re-link CTA.
- **54-04 iOS rewire** uses the same contract — same request-body table above applies.
- **54-05 plaintext column drop** still gated on the 54-04 backfill landing first; nothing in this phase changes that ordering.

---
*Phase: 54-plaid-token-migration*
*Completed: 2026-06-07*
