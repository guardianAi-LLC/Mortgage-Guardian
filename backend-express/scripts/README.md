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

## cloudmersive-health-check.js  (Phase 55-04)

One-shot smoke test for the Cloudmersive malware-scan integration. Runs three
probes — a clean buffer, an EICAR test signature, and a best-effort quota
lookup — and reports whether the upload scan path is alive end-to-end.

### Requirements
- `CLOUDMERSIVE_API_KEY` (required)
- `CLOUDMERSIVE_BASE_URL` (optional, default `https://api.cloudmersive.com`)
- `CLOUDMERSIVE_TIMEOUT_MS` (optional, default `15000`)

### Usage

```bash
node scripts/cloudmersive-health-check.js          # one-shot
node scripts/cloudmersive-health-check.js --debug  # include stack traces
```

### Exit codes
- `0` — healthy: clean probe and EICAR probe both passed.
- `1` — reachable but failed (auth, quota, malformed response, network).
- `2` — `missing_required_env` (no `CLOUDMERSIVE_API_KEY`).

### When to run
- Post-deploy smoke check after a Vercel release.
- Oncall page for "uploads returning 502 / scan_unavailable".
- After rotating `CLOUDMERSIVE_API_KEY` in Vercel (see
  `docs/MALWARE_SCANNING.md`).

### Logging discipline
The API key, EICAR string, and clean probe body are never printed. Output is
limited to timestamps, HTTP status codes, latency, the `CleanResult` flag, and
quota numbers when available.
