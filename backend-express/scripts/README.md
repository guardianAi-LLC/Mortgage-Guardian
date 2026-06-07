# backend-express scripts

Operational scripts. Run from `backend-express/` with the project's `.env` loaded.

## backfill-plaid-tokens.js  (Phase 54-04)

Encrypts every legacy plaintext `plaid_items.access_token` row and nulls the
plaintext. Idempotent — re-running after a successful apply finds 0 rows and
exits 0.

### Requirements
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service-role key, not anon)
- `PLAID_ENCRYPTION_KEY` — same 32-byte hex value the API uses in production

### Usage

```bash
# Dry-run (default). Reports what would change, writes nothing.
node scripts/backfill-plaid-tokens.js

# Apply. Writes ciphertext, then nulls plaintext, row-by-row.
node scripts/backfill-plaid-tokens.js --apply
```

### Behavior
- Rows where `access_token_encrypted` is already populated are verified
  (decrypted and compared) before the plaintext is nulled. A mismatch logs an
  ERROR with the `item_id` + `user_id` and skips the row — manual triage.
- Token material is NEVER logged. Only counts, itemIds, and userIds appear in
  output.
- Exit code is 0 iff `mismatches === 0 && errors === 0`. CI and runbooks should
  gate on the exit code.

### Rollback
Nulling out plaintext is irreversible from this script — no plaintext backup is
retained. If a user's encrypted token cannot be decrypted post-backfill, they
must re-link via Plaid. Take a Supabase backup of `plaid_items` before running
`--apply` in production (see runbook entry).
