---
phase: 36-plaid-bank-integration-rewiring
plan: 01
subsystem: api
tags: [plaid, swift, apiclient, keychain, ios]

# Dependency graph
requires:
  - phase: 32-express-api-client-migration
    provides: APIClient+Plaid typed methods (createPlaidLinkToken, exchangePlaidToken, getPlaidAPIAccounts)
  - phase: 33-authentication-flow-completion
    provides: AuthManager token lifecycle, APIClient auth headers
provides:
  - PlaidLinkService fully wired to APIClient+Plaid (auth headers + retry)
  - deletePlaidItem APIClient method for Plaid item removal
  - Secure Plaid access token storage via SecureKeyManager
  - PlaidAPIAccount to PlaidAccount bridging helper
affects: [37-transaction-analysis, 38-settings-account-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [APIClient extension for delete endpoints, Clerk.shared.user?.id for userId]

key-files:
  created: []
  modified:
    - MortgageGuardian/Services/PlaidLinkService.swift
    - MortgageGuardian/Services/APIClient+Plaid.swift
    - MortgageGuardian/Services/SecureKeyManager.swift

key-decisions:
  - "Used Clerk.shared.user?.id directly for userId rather than threading AuthManager dependency"
  - "Added plaidAccessToken case to APIService enum for keychain storage of Plaid access tokens"
  - "Single bridgePlaidAccount helper eliminates duplication across fetch methods"

patterns-established:
  - "SecureKeyManager for runtime credential storage (access tokens from API exchanges)"

issues-created: []

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 36-01: Plaid Bank Integration Rewiring Summary

**PlaidLinkService rewired from raw URLRequest/JSONSerialization to typed APIClient+Plaid methods with auth headers, retry logic, and deletePlaidItem endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08
- **Completed:** 2026-04-08
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced all 3 raw URLRequest methods (fetchLinkToken, handleLinkSuccess, fetchAccountsWithAccessToken) with APIClient typed calls
- Implemented removeAccountFromBackend and fetchAccountsFromBackend using APIClient
- Added deletePlaidItem method to APIClient+Plaid for DELETE /v1/plaid/item
- Removed 228 lines of raw networking code, duplicate methods, and dead code

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace raw URLRequest calls with APIClient+Plaid methods** - `563f56c` (feat)
2. **Task 2: Implement removeAccountFromBackend and fetchAccountsFromBackend** - `1f34da0` (feat)

## Files Created/Modified
- `MortgageGuardian/Services/PlaidLinkService.swift` - Rewired all Plaid backend calls to APIClient methods
- `MortgageGuardian/Services/APIClient+Plaid.swift` - Added PlaidDeleteItemRequest/Response and deletePlaidItem()
- `MortgageGuardian/Services/SecureKeyManager.swift` - Added plaidAccessToken case to APIService enum

## Decisions Made
- Used `Clerk.shared.user?.id` directly for userId — PlaidLinkService is already @MainActor so accessing Clerk is safe, avoids adding AuthManager coupling
- Added `plaidAccessToken` to existing `APIService` enum rather than a separate storage mechanism — consistent with existing keychain pattern
- Extracted `bridgePlaidAccount(_:institutionName:)` helper to DRY up the PlaidAPIAccount→PlaidAccount mapping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Auto-fix bug] Removed duplicate methods**
- **Found during:** Task 1 (raw URLRequest replacement)
- **Issue:** PlaidLinkService had TWO versions of `exchangePublicToken` and `fetchAccountsWithAccessToken` (one parameterized, one label-based) — dead code from prior iterations
- **Fix:** Removed both duplicates; single typed APIClient call replaces all
- **Files modified:** MortgageGuardian/Services/PlaidLinkService.swift
- **Verification:** Zero raw URLRequest/JSONSerialization calls remain
- **Committed in:** 563f56c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (duplicate removal), 0 deferred
**Impact on plan:** Cleanup was necessary — duplicates would have caused compilation errors.

## Issues Encountered
None

## Next Phase Readiness
- PlaidLinkService fully uses APIClient with auth headers and retry logic
- deletePlaidItem available for account disconnection flows
- Ready for Phase 36-02 (transaction history wiring) or Phase 37+

---
*Phase: 36-plaid-bank-integration-rewiring*
*Completed: 2026-04-08*
