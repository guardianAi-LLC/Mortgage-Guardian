# Deferred Issues

Nice-to-haves and follow-ups noticed during plan execution, deferred to keep
plans tightly scoped. Review with `/gsd:consider-issues`.

## Open

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

### ISS-004: Inline encrypted-PDF heuristic replaces broken is-pdf-encrypted package
- **Found during:** 55-03 (Task 1, encrypted-PDF short-circuit)
- **Where:** `backend-express/utils/fileValidation.js` (`isPdfEncryptedBuffer`)
- **Detail:** The plan called for `is-pdf-encrypted@^1.1.0`, but that
  package depends on the browser-only `FileReader` global and crashes
  immediately in Node. Replaced with a four-line inline check that
  scans the buffer for the `/Encrypt` marker — the same heuristic the
  package documents. Correct for spec-compliant PDFs (encryption
  dictionaries are always referenced from the trailer) but could be
  fooled by a malformed file that contains the literal string
  `/Encrypt` outside an actual encryption dict. If false positives
  appear in production, switch to a real PDF parser (pdfjs-dist).
- **Suggested landing spot:** opportunistic; only if false positives surface.

## Closed

### ISS-001: /v1/plaid/exchange_token still returns the raw access_token in its response
- **Closed by:** Phase 56-03 (Task 1)
- **Resolution:** Removed `access_token` from `POST /v1/plaid/exchange_token`
  response. Token is persisted encrypted server-side via
  `plaidDataService.upsertPlaidItem` and resolved per-request via
  `resolveTokenByItemId`. Added `emitAuditEvent('plaid_token_encrypted', ...)`
  on successful upsert. Test `plaid-routes.test.js` asserts
  `expect(res.body).not.toHaveProperty('access_token')`. iOS grep confirmed
  no Swift consumer of the removed field — only a stale comment in
  `MortgageGuardian/Views/PlaidConnectionView.swift:193`, no decoding.
