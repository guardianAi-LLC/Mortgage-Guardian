---
phase: 54-plaid-token-migration
plan: 04
status: in-progress
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

## Pending (blocks plan completion)

**Task 3 — Production cutover, human checkpoint.** Cannot proceed without operator:
1. Confirm new backend release and new iOS build are rolled out.
2. Take Supabase backup of `plaid_items`.
3. Run `node scripts/backfill-plaid-tokens.js --dry-run` against production; confirm `mismatches=0`, `errors=0`.
4. Run `--apply`.
5. Confirm `SELECT COUNT(*) FROM plaid_items WHERE access_token IS NOT NULL` returns 0.
6. Spot-check three users — accounts/items endpoints still return their data.

Once that confirmation arrives, this summary should be updated with the production backfill date and final row counts, and the status promoted to `complete`.

## Hand-off to 54-05

Prerequisites for 54-05 (drop plaintext column, remove dual-write):
- Production backfill applied — pending operator confirmation.
- `access_token` column NULL in 100% of rows — pending operator confirmation.

The dual-write in `plaidDataService.upsertPlaidItem` and the plaintext fallback in the resolver remain in place until 54-05.
