---
phase: 54-plaid-token-migration
plan: 01
subsystem: security
tags: [plaid, encryption, aes-gcm, hkdf, supabase, migration, dual-write]

requires:
  - phase: documentEncryptionService (pre-existing)
    provides: AES-256-GCM + HKDF per-user encryption pattern this service mirrors
provides:
  - plaidTokenEncryptionService with encryptForStorage/decryptFromStorage helpers (base64)
  - PLAID_ENCRYPTION_KEY env var validated by Joi (required in prod, optional in dev/test)
  - Migration 006_plaid_token_encryption.sql adding access_token_encrypted (TEXT) + encryption_version (SMALLINT) and dropping NOT NULL on access_token
  - Dual-write in plaidDataService.upsertPlaidItem (plaintext + ciphertext)
  - Ciphertext-preferred read in plaidDataService.getAccessTokenForUser with plaintext fallback + warn log keyed by itemId/userId (backfill signal for 54-04)
  - Index idx_plaid_items_encryption_version for the 54-04 backfill query
affects: [54-02-route-signature-change, 54-03-frontend-ios-token-handling, 54-04-backfill-script, 54-05-drop-plaintext-column]

tech-stack:
  added: []
  patterns:
    - "Per-user encrypted storage in a TEXT column via base64(iv|authTag|ciphertext)"
    - "Dual-write migration pattern: write both old and new columns, read new with fallback to old, warn-log fallback as a backfill signal"
    - "Subsystem-scoped master keys (separate PLAID_ENCRYPTION_KEY from DOCUMENT_ENCRYPTION_KEY) so compromise of one does not force rotation of the other"

key-files:
  created:
    - backend-express/services/plaidTokenEncryptionService.js
    - backend-express/migrations/006_plaid_token_encryption.sql
    - backend-express/__tests__/services/plaidTokenEncryptionService.test.js
  modified:
    - backend-express/utils/envValidator.js
    - backend-express/services/plaidDataService.js
    - backend-express/__tests__/services/plaidDataService.test.js
    - backend-express/__tests__/utils/envValidator.test.js

key-decisions:
  - "Env var name: PLAID_ENCRYPTION_KEY (64 hex chars, separate from DOCUMENT_ENCRYPTION_KEY by design)"
  - "Migration number: 006_plaid_token_encryption.sql — additive only; plaintext column dropped in migration 008 (Phase 54-05)"
  - "Dual-write strategy: plaidDataService.upsertPlaidItem writes BOTH access_token (plaintext) AND access_token_encrypted (base64 of iv|tag|ct); getAccessTokenForUser prefers ciphertext, falls back to plaintext with a warn that the 54-04 backfill keys off of"
  - "HKDF info string is namespaced as `plaid-token:${userId}` so the userId-as-salt cannot collide with documentEncryptionService keys even if the same master key were ever reused (it isn't, by design)"
  - "Encryption service is lazy-loaded inside plaidDataService so missing PLAID_ENCRYPTION_KEY in legacy/dev environments degrades gracefully (plaintext-only writes) instead of crashing module load"
  - "Dual-write assertion test landed in plaidDataService.test.js (not plaidService.test.js as plan suggested) because the actual DB insert lives in upsertPlaidItem — the plan's reference to `plaidService.exchangePublicToken around line 164` predates the route-level split where the insert moved to plaidDataService"

patterns-established:
  - "Pattern: lazy-load encryption services inside data layers so missing env vars degrade gracefully rather than crashing module load"
  - "Pattern: dual-write + read-prefer-new + warn-log-fallback enables zero-downtime column migrations"
  - "Pattern: base64-encoded packed crypto buffers (iv|tag|ct) in TEXT columns avoid PostgREST BYTEA serialization concerns"

issues-created: []

duration: 19 min
completed: 2026-06-07
---

# Phase 54 Plan 1: Encryption Service & Schema Summary

**AES-256-GCM + HKDF per-user encryption primitive for Plaid access tokens, additive migration 006, and dual-write in plaidDataService — the cryptographic foundation every subsequent 54-x plan depends on is in place.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-06-07T18:13:31Z
- **Completed:** 2026-06-07T18:32:00Z
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 4

## Accomplishments

- `plaidTokenEncryptionService` mirrors `documentEncryptionService` (AES-256-GCM, HKDF-SHA256, packed `iv|authTag|ciphertext` Buffer), but with a separate master key (`PLAID_ENCRYPTION_KEY`) and a namespaced HKDF info string (`plaid-token:${userId}`). Exposes `encryptForStorage` / `decryptFromStorage` helpers returning base64 strings suitable for TEXT-column storage.
- `envValidator.js` requires `PLAID_ENCRYPTION_KEY` (64 hex chars) in production and accepts it optionally in dev/test, with three new tests covering each branch.
- Migration `006_plaid_token_encryption.sql` is additive only: adds `access_token_encrypted TEXT`, `encryption_version SMALLINT NOT NULL DEFAULT 1`, drops `NOT NULL` from `access_token`, and indexes `encryption_version` for the 54-04 backfill query. The plaintext column is preserved for dual-write throughout this plan.
- `plaidDataService.upsertPlaidItem` now dual-writes plaintext + ciphertext, and `getAccessTokenForUser` prefers ciphertext, falling back to plaintext with a `warn` log keyed by `itemId`/`userId` — that log line is the explicit signal the 54-04 backfill will use to find rows still on plaintext.
- New encryption-service test file covers round-trip, cross-user decrypt throw, ciphertext tamper throw, and random-IV non-determinism (4 tests). Dual-write assertion in `plaidDataService.test.js` confirms the encrypted column decrypts back to the original token.
- Full backend test suite: 1644 passing (vs. 1637 baseline), 3 pre-existing failures unchanged (`full-pipeline-e2e`, `financialSecurityService`, `vendorNeutralSecurityService` — all unrelated to Phase 54).

## Task Commits

Each task was committed atomically with only the files it touched:

1. **Task 1: Create plaidTokenEncryptionService + env validation** — `551fe34` (feat)
2. **Task 2: Additive migration 006 for encrypted-token columns** — `5fc66da` (feat)
3. **Task 3: Dual-write on upsertPlaidItem + ciphertext-preferred read + unit tests** — `1ae44f1` (feat)

**Plan metadata:** pending (docs commit at end of plan execution)

## Files Created/Modified

- `backend-express/services/plaidTokenEncryptionService.js` — New: per-user AES-256-GCM encryption service mirroring documentEncryptionService with separate master key
- `backend-express/migrations/006_plaid_token_encryption.sql` — New: additive migration adding `access_token_encrypted`, `encryption_version`, dropping `NOT NULL` on `access_token`, and indexing `encryption_version`
- `backend-express/__tests__/services/plaidTokenEncryptionService.test.js` — New: 4 tests (round-trip, cross-user, tamper, random IV)
- `backend-express/utils/envValidator.js` — Added `PLAID_ENCRYPTION_KEY` Joi rule (required+hex in prod, optional in dev) and `plaidEncryptionKey` field on the frozen config
- `backend-express/services/plaidDataService.js` — Lazy-load encryption service; dual-write ciphertext in `upsertPlaidItem`; ciphertext-preferred read with plaintext fallback + warn in `getAccessTokenForUser`
- `backend-express/__tests__/services/plaidDataService.test.js` — Set `PLAID_ENCRYPTION_KEY` for module load; new dual-write assertion test verifying the encrypted payload column round-trips
- `backend-express/__tests__/utils/envValidator.test.js` — Added `PLAID_ENCRYPTION_KEY` to `VALID_ENV` and the cleanup list; 3 new tests covering prod-required/prod-hex/dev-optional rules

## Decisions Made

- **Separate master key (`PLAID_ENCRYPTION_KEY`).** Plaid token compromise must not require rotating the document encryption key (and vice versa). Confirmed by the plan's <context> guidance.
- **Migration number `006`.** Continues the existing numbered-SQL sequence (last on disk was `005_storage_bucket_policies.sql`). The drop-plaintext migration in Phase 54-05 will be `008` (54-02 and one other plan in this phase consume `007`).
- **Dual-write strategy.** Both columns are written on every `upsertPlaidItem`; reads prefer ciphertext and log a warn (with `itemId`) when falling back to plaintext. The 54-04 backfill script will key off either the warn or the index on `encryption_version` to find legacy rows.
- **Lazy-loading the encryption service inside `plaidDataService`.** Avoids a hard module-load failure if `PLAID_ENCRYPTION_KEY` is missing in a legacy environment — the service degrades to plaintext-only writes and the resolver's existing plaintext fallback keeps reads working.
- **HKDF info string namespaced `plaid-token:${userId}`.** Defense-in-depth even though the master key is already separate.

## Deviations from Plan

### Auto-fixed (Rule 1: clarity / file location)

**1. Dual-write moved to `plaidDataService.upsertPlaidItem` rather than `plaidService.exchangePublicToken`**
- **Found during:** Task 3
- **Issue:** The plan's <action> for Task 3 says modify `plaidService.exchangePublicToken` "before inserting into plaid_items" (line ~164). But `exchangePublicToken` only calls Plaid's `itemPublicTokenExchange` and returns the access token — the actual `plaid_items` insert happens in `plaidDataService.upsertPlaidItem`, called by `routes/plaid.js` after `exchangePublicToken` returns. The plan references appear to predate this split.
- **Fix:** Implemented dual-write at the actual insert site (`upsertPlaidItem`), which already receives `userId` and `accessToken` from the route. This preserves plan intent (every new exchange writes ciphertext) without changing route signatures (deferred to 54-02) or returning encrypted state from `plaidService`.
- **Files modified:** `backend-express/services/plaidDataService.js`
- **Verification:** New dual-write test in `plaidDataService.test.js` asserts the encrypted column is present, non-equal to plaintext, and decrypts back to the original.

**2. Resolver renamed `resolveUserAccessToken` → `getAccessTokenForUser`**
- **Found during:** Task 3
- **Issue:** Plan refers to `plaidDataService.resolveUserAccessToken` but the actual method on the service is `getAccessTokenForUser` (the `.select('access_token')` path around line 320 matches the plan's description).
- **Fix:** Applied ciphertext-prefer / plaintext-fallback to `getAccessTokenForUser`.
- **Files modified:** `backend-express/services/plaidDataService.js`
- **Verification:** Manual reading confirms select now requests the new columns; warn-log fallback path is implemented as described.

**3. Encrypted-write assertion landed in `plaidDataService.test.js` (not `plaidService.test.js`)**
- **Found during:** Task 3
- **Issue:** Plan says add the encrypted-write assertion to `plaidService.test.js`, but since the actual DB write was relocated to `upsertPlaidItem` (deviation #1), the natural test location moved with it.
- **Fix:** Added the assertion as a new `it()` inside the existing `upsertPlaidItem` `describe` block in `plaidDataService.test.js`.
- **Files modified:** `backend-express/__tests__/services/plaidDataService.test.js`

### Environment limitations (logged, not blocking)

- **Migration SQL not parse-checked against a live Postgres.** No local Postgres or Supabase instance was available in the sandbox. The migration uses only standard `ALTER TABLE ... ADD COLUMN`, `ALTER COLUMN ... DROP NOT NULL`, and `CREATE INDEX` statements with `IF NOT EXISTS` guards — runtime verification will happen when applied via the Supabase SQL editor as part of the standard deploy flow noted in the migration header.
- **Watchman warning during jest runs.** The user's watchman state directory has stale fchmod permissions; tests still pass but emit a recrawl warning. Not introduced by this plan.

## Pre-existing Test Failures (Not Phase 54)

Confirmed unchanged from main branch (verified via `git stash` baseline run):

- `__tests__/integration/full-pipeline-e2e.test.js` — `individual document analysis works independently` (mock expectation about `mockComplianceRuleEngine.evaluateFindings`)
- `__tests__/services/financialSecurityService.test.js` — Cannot find module `./credentials` from `services/financialSecurity/index.js`
- `__tests__/services/vendorNeutralSecurityService.test.js` — Cannot find module `./secretManagers` from `services/vendorNeutralSecurity/service.js`

These are tracked separately and are explicitly out of scope for Phase 54-01.

## What This Unlocks for Plans 54-02 through 54-05

- **54-02 (route signature change):** Can now stop returning plaintext `access_token` from `/v1/plaid/exchange_token`; the encrypted column already exists and is being populated.
- **54-03 (frontend/iOS token handling):** Can rely on server-side resolution via `getAccessTokenForUser` instead of client-supplied tokens.
- **54-04 (backfill):** Query is `SELECT id, user_id, access_token FROM plaid_items WHERE access_token_encrypted IS NULL`; the `idx_plaid_items_encryption_version` index supports the version-bump variant; the warn log from `getAccessTokenForUser` is an additional runtime signal.
- **54-05 (drop plaintext column):** Migration 008 will be `ALTER TABLE plaid_items DROP COLUMN access_token;` once the 54-04 backfill verifies all rows have non-null `access_token_encrypted`.

## Success Criteria

- [x] `plaidTokenEncryptionService` exists with documented round-trip + tamper-detection
- [x] `PLAID_ENCRYPTION_KEY` validated in env (required in prod, optional in dev)
- [x] Migration 006 additive, reversible, no data loss
- [x] `upsertPlaidItem` dual-writes plaintext + ciphertext
- [x] Resolver prefers ciphertext, falls back to plaintext with a warn log
- [x] All Phase 54-01 tests pass; full suite delta is +7 passing tests with zero new failures
