# Deferred Issues

Nice-to-haves and follow-ups noticed during plan execution, deferred to keep
plans tightly scoped. Review with `/gsd:consider-issues`.

## Open

### ISS-001: /v1/plaid/exchange_token still returns the raw access_token in its response
- **Found during:** 54-05 (Task 1, route review)
- **Where:** `backend-express/routes/plaid.js` (`POST /exchange_token` response body)
- **Detail:** Since Phase 54 no client persists or uses the access token (iOS
  keeps only item_id, web keeps nothing), but the exchange response still
  includes `access_token` "so iOS can store locally" per a pre-54 comment.
  Returning it over the wire is now pure attack surface. Removing it touches
  the route contract, `plaid-routes.test.js`, the live-sandbox roundtrip
  suite, and iOS `PlaidExchangeTokenResponse` decoding — out of 54-05 scope.
- **Suggested landing spot:** Phase 56 (Auth Hardening & Encryption Audit).

### ISS-002: User model on iOS still carries a vestigial plaidAccessToken field
- **Found during:** carried over from 54-04 summary
- **Where:** `MortgageGuardian/Models/User.swift`
- **Detail:** Field is serialized but never read as a token by any service.
  Rename/remove for hygiene.
- **Suggested landing spot:** next iOS-touching phase.

### ISS-003: No dedicated PLAID_ENCRYPTION_KEY rotation script
- **Found during:** 54-05 (Task 3, runbook authoring)
- **Where:** `backend-express/scripts/`
- **Detail:** RUNBOOK.md documents rotation by adapting
  `backfill-plaid-tokens.js`, but a purpose-built `rotate-plaid-key.js`
  (old key → new key re-encrypt with version bump, dry-run default) would
  make rotation safe and routine.
- **Suggested landing spot:** Phase 56 (Auth Hardening & Encryption Audit).
