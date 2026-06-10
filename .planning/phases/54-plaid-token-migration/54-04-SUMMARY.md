---
phase: 54-plaid-token-migration
plan: 04
status: complete
---

# 54-04 Summary — iOS itemId migration + production backfill

## What landed

### iOS — `MortgageGuardian/Services/`

- `SecureKeyManager.swift`
  - Replaced `case plaidAccessToken` with `case plaidItemId = "com.mortgageguardian.api.plaid.itemid"`.
  - Removed `plaidItemId` from `isRequired` — itemIds are produced by the Plaid Link flow, not user-entered.
  - Added `purgeLegacyPlaidAccessToken()` called from `init()` — deletes the legacy `com.mortgageguardian.api.plaid.accesstoken` Keychain entry on every launch. Idempotent; no-op after first run.
- `APIClient+Plaid.swift`
  - `PlaidAPIAccountsRequest`, `PlaidTransactionsRequest`, `PlaidDeleteItemRequest`: `accessToken` → `itemId`, wire key `access_token` → `item_id`.
  - `getPlaidAPIAccounts`, `getPlaidTransactions`, `deletePlaidItem` signatures take `itemId:` instead of `accessToken:`.
  - `PlaidExchangeTokenResponse` left untouched: the backend still returns `access_token` over the wire, but iOS no longer persists it.
- `EnhancedPlaidService.swift`
  - In `linkAccountWithValidation`: after exchange, persist `exchangeResponse.itemId` to `.plaidItemId` instead of saving the access token. Account fetch now passes `itemId`.
  - In `syncTransactionsWithAudit`: read `.plaidItemId` from Keychain, pass to `getPlaidTransactions`.
  - In `unlinkAccount`: read `.plaidItemId`, call `deletePlaidItem(itemId:)`, then delete the `.plaidItemId` Keychain entry.
- `APISettingsView.swift`
  - Dropped `.plaidAccessToken` from the two exhaustive switches that listed Plaid services. The two partial switches (with `default:` clauses) are unchanged — `.plaidItemId` falls through to the default branch (not a user-configurable key).

`PlaidServiceUsageExample.swift` was not touched: the file is wrapped in `#if USAGE_EXAMPLES_ENABLED` and references a different (currently disabled) `PlaidService` class, not the `EnhancedPlaidService` path that this migration moves to itemId.

`MortgageGuardian/Models/User.swift` still has a `plaidAccessToken: String?` field. It is stored/serialized but never read as a token by any service — leaving it alone keeps scope tight. A follow-up could rename it for hygiene.

### Backend — `backend-express/scripts/`

- `backfill-plaid-tokens.js` (new) — idempotent backfill that:
  - Selects `plaid_items` rows with non-null plaintext `access_token`.
  - For rows that already have `access_token_encrypted`: decrypts and verifies the ciphertext matches the plaintext. Mismatches log an ERROR with itemId/userId and skip — they do not get nulled out.
  - For plaintext-only rows: encrypts via `plaidTokenEncryptionService.encryptForStorage(userId, token)`, writes `access_token_encrypted`, then nulls the plaintext column.
  - Dry-run is the default; `--apply` performs writes.
  - Final report: `{ mode, total, alreadyEncryptedVerified, newlyEncrypted, mismatches, errors, plaintextNulledOut }`.
  - Exit 0 iff `mismatches === 0 && errors === 0`. Token material is never logged.
- `backend-express/scripts/README.md` (new) — documents env requirements, dry-run vs apply, rollback note (no plaintext backup retained; re-link required), and a pointer to the production cutover checkpoint.

## Verification status

- `node --check backend-express/scripts/backfill-plaid-tokens.js` — PASS.
- `grep -nE "plaidAccessToken|\"access_token\"" MortgageGuardian/Services/*.swift` — only match is `PlaidExchangeTokenResponse.accessToken` wire field (intentional; the exchange response still carries it).
- `swiftc -parse` on each modified file — PASS (no syntax errors).
- `xcodebuild ... build` — could not run to completion in the bg session (SwiftPM dependency resolution stalled, likely network sandbox). Operator should re-run locally before promoting Task 3.

## Task 3 — Production cutover: COMPLETE (2026-06-10)

Executed with operator approval at each write step. The original checklist assumed
a live production deployment; investigation found none existed, which simplified
the cutover:

- **No live backend.** The Railway app the production frontend targets
  (`mortgage-guardian-backend-production.up.railway.app`) returns 404
  "Application not found" — deleted. The Vercel `backend-express` project's
  last deploy is Nov 2025 (pre-Phase-54) and marked not live. Step 1
  ("confirm new release rolled out") was therefore N/A — **the backend needs a
  full redeployment**, tracked as an open item below.
- **Migration 006 had never been applied to production.** Applied 2026-06-10
  via Supabase MCP (`plaid_token_encryption_006`), with operator approval.
- **No PLAID_ENCRYPTION_KEY existed anywhere** (no live deployment, zero
  encrypted rows, nothing in local env files). A fresh key was generated
  (`openssl rand -hex 32`) into `backend-express/.env` with operator approval.
  ⚠️ This key is now THE production key — it must be copied into the backend's
  hosting environment when redeployed, or all encrypted tokens become
  undecryptable.
- **Backfill executed** against production Supabase (`huosfjdcnjzdzhkkjaqh`):
  - Dry-run: `total=1, newlyEncrypted=1, mismatches=0, errors=0`
  - Apply: same counts, exit 0
  - Post-verify: `plaintext_remaining=0, encrypted_rows=1, total=1`
- **Backup (step 2) skipped deliberately:** 1 sandbox-era test row
  (created 2026-04-29), no real users; worst case is one Plaid re-link.
- **Spot-check (step 6) adapted:** only 1 user exists and no deployed API to
  query; the itemId resolver path is covered by the live-sandbox round-trip
  suite (`plaid-sandbox-roundtrip.test.js`, 4/4 passing 2026-06-10).

## Hand-off to 54-05

Prerequisites for 54-05 (drop plaintext column, remove dual-write):
- Production backfill applied — DONE 2026-06-10.
- `access_token` column NULL in 100% of rows — VERIFIED 2026-06-10 (0 of 1 rows non-null).

**Open item (out of 54-04 scope):** backend has no live deployment. Redeploy
(Railway or Vercel) with the new env including PLAID_ENCRYPTION_KEY, and update
`frontend/.env.production` NEXT_PUBLIC_API_URL if the host changes. Suggested
landing spot: Phase 56 (auth hardening) or a dedicated deploy pass.

The dual-write in `plaidDataService.upsertPlaidItem` and the plaintext fallback in the resolver remain in place until 54-05.
