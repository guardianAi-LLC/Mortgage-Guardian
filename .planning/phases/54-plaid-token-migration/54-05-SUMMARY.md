---
phase: 54-plaid-token-migration
plan: 05
subsystem: api
tags: [plaid, encryption, aes-256-gcm, express-rate-limit, winston, audit-logging, supabase]

requires:
  - phase: 54-plaid-token-migration (54-01)
    provides: encrypted column, dual-write, plaintext-fallback resolver
  - phase: 54-plaid-token-migration (54-04)
    provides: production backfill complete (0 plaintext rows, verified 2026-06-10)
provides:
  - Migration 008 dropping plaintext access_token column (applied to production 2026-06-10)
  - Single-write (ciphertext-only) in plaidDataService.upsertPlaidItem, fail-closed
  - Resolver fails closed with { success: false, code: 'token_missing' } when ciphertext absent
  - plaid_token_decrypted structured audit log on every decryption (userId/itemId/route, never token material)
  - Per-user rate limit (60 req / 5 min, env-tunable) on /items, /accounts, /transactions, /item
  - RUNBOOK.md playbook: key rotation, backfill, incident response
affects: [55-upload-security, 56-auth-hardening (audit surface broadening, ISS-001), deployment]

tech-stack:
  added: []
  patterns:
    - "Fail-closed token resolution: missing ciphertext is an error, never a fallback"
    - "Audit logger via createLogger('audit') with event-shaped payloads"
    - "Per-user keyed express-rate-limit with ipKeyGenerator fallback, env-tunable factory"

key-files:
  created:
    - backend-express/migrations/008_drop_plaid_plaintext_token.sql
    - backend-express/middleware/plaidRateLimit.js
    - backend-express/__tests__/middleware/plaidRateLimit.test.js
    - .planning/ISSUES.md
  modified:
    - backend-express/services/plaidDataService.js
    - backend-express/routes/plaid.js
    - backend-express/PLAID_UPDATE_SUMMARY.md
    - RUNBOOK.md
    - frontend/src/app/dashboard/bank-accounts/page.tsx

key-decisions:
  - "Webhook TRANSACTIONS handler rewired through resolveTokenByItemId (it read the dropped plaintext column directly — would have broken post-008)"
  - "upsertPlaidItem fails closed if encryption unavailable, instead of silently writing nothing"
  - "Rate limiter is a factory (createPlaidResolveLimiter) so tests can configure tight limits"

patterns-established:
  - "Fail-closed crypto: absence of ciphertext returns token_missing error, no plaintext path remains"

issues-created: [ISS-001, ISS-002, ISS-003]

duration: ~30min
completed: 2026-06-10
---

# Phase 54 Plan 05: Migration Finalization Summary

**Plaintext Plaid token column dropped from production; ciphertext-only storage with fail-closed resolution, decrypt audit logging, and per-user rate limits on resolution endpoints**

## Performance

- **Duration:** ~30 min (subagent execution + production apply)
- **Started:** 2026-06-10T05:53:07Z
- **Completed:** 2026-06-10T06:20:00Z
- **Tasks:** 3 (+ production migration apply in orchestrator)
- **Files modified:** 14

## Accomplishments

- Migration 008 created AND applied to production Supabase (2026-06-10): `plaid_items.access_token` column dropped; schema verified post-apply (`access_token_encrypted` + `encryption_version` remain).
- Dual-write removed: `upsertPlaidItem` writes only ciphertext and fails closed if encryption is unavailable. All plaintext-fallback read paths removed; resolver returns `{ success: false, code: 'token_missing' }` when ciphertext is absent.
- Every successful decryption emits a `plaid_token_decrypted` audit event (`userId`, `itemId`, `route`, `timestamp`) via the `audit` Winston child logger; tests assert no token material is ever serialized into log calls.
- Per-user rate limit (60 req / 5 min default, `PLAID_RESOLVE_RATE_LIMIT_MAX`/`_WINDOW_MS` tunable) on `GET /items`, `POST /accounts`, `POST /transactions`, `POST /item`, returning 429 + Retry-After.
- RUNBOOK.md gained the "Plaid Token Encryption — Rotation, Backfill, and Incident Response" playbook; PLAID_UPDATE_SUMMARY.md updated to the itemId-only, encrypted-at-rest contract.
- Frontend one-time `mg_plaid_access_tokens` localStorage cleanup removed (shipped in 54-03; its job is done — any client that ran the app since then is purged, and tokens were never written by post-54 code).

## Task Commits

1. **Task 1: Drop plaintext column, remove dual-write, fail closed** - `7f68fdd` (feat)
2. **Task 2: Audit-log decryptions, per-user rate limit** - `733c5a7` (feat)
3. **Task 3: Runbook, docs, frontend cleanup, ROADMAP closeout** - `79a78fd` (docs)

## Decisions Made

- Webhook TRANSACTIONS handler now resolves tokens through `resolveTokenByItemId` with a fail-closed `handled:false` path (see deviations).
- Rate limiter implemented as a factory for test configurability; keyed on `req.user.id` with `ipKeyGenerator` fallback for unauthenticated edge cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Webhook handler read the dropped plaintext column**
- **Found during:** Task 1 (dual-write removal)
- **Issue:** The TRANSACTIONS webhook handler in `routes/plaid.js` read `access_token` directly off the `getItem()` row; after migration 008 it would have passed `undefined` to the Plaid API.
- **Fix:** Rewired through `resolveTokenByItemId(user_id, item_id)` with fail-closed handling; added a covering test.
- **Committed in:** `7f68fdd`

**2. [Rule 3 - Blocking] service-integration test needed PLAID_ENCRYPTION_KEY**
- **Found during:** Task 1 (fail-closed storage)
- **Issue:** With storage failing closed, the integration test environment lacked an encryption key and upserts failed.
- **Fix:** Test sets a test-scoped `PLAID_ENCRYPTION_KEY`.
- **Committed in:** `7f68fdd`

### Deferred Enhancements

Logged to .planning/ISSUES.md:
- ISS-001: `/exchange_token` response still returns the raw access token to clients — candidate for removal in Phase 56
- ISS-002: Vestigial iOS `User.plaidAccessToken` model field (never read as a token)
- ISS-003: No dedicated key-rotation script (runbook documents the manual procedure)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking), 3 deferred
**Impact on plan:** Bug fix was essential — webhook would have broken in production post-008. No scope creep.

## Issues Encountered

- Production-runtime verification items (audit log flowing, rate limit observed live) are **N/A**: there is no live backend deployment (Railway app deleted, Vercel stale — discovered in 54-04). Both behaviors are covered by unit/integration tests instead. Live verification moves to the redeployment pass.

## Next Phase Readiness

- **Phase 54 complete (5/5).** Encrypted-at-rest Plaid tokens, itemId-only API, audit logging, rate limits all shipped. Backend: 64 suites / 1842 tests green. Frontend builds.
- **Carried forward:** backend redeployment (with `PLAID_ENCRYPTION_KEY` in hosting env) — see STATE.md blockers; suggested before or during Phase 56.
- Ready for Phase 55: Upload Security & Malware Scanning.

---
*Phase: 54-plaid-token-migration*
*Completed: 2026-06-10*
