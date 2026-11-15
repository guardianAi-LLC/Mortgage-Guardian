---
phase: 56-auth-hardening
type: research
gathered: 2026-06-10
method: 4 parallel Explore subagents (one per essential)
status: ready-for-planning
---

# Phase 56 — Research

Concrete findings from a parallel codebase scout across the four essentials
in 56-CONTEXT.md. Used to drive 56-01..N plan generation.

---

## 1. CSRF protection (Phase 56-01)

### State-changing route inventory (20 total)

All require bearer JWT auth except the Plaid webhook (signature-verified).
Source: `backend-express/routes/`.

| File | Routes |
|------|--------|
| `cases.js` | `POST /v1/cases`, `PUT /v1/cases/:id`, `DELETE /v1/cases/:id`, `POST /v1/cases/:id/documents`, `DELETE /v1/cases/:id/documents/:docId`, `POST /v1/cases/:id/forensic-analysis` |
| `documents.js` | `POST /v1/documents/upload`, `DELETE /v1/documents/:id`, `POST /v1/documents/process`, `POST /v1/documents/:id/retry`, `POST /v1/documents/:id/complete` |
| `compliance.js` | `POST /v1/cases/:id/compliance` |
| `reports.js` | `POST /v1/cases/:id/report`, `POST /v1/cases/:id/report/letter` |
| `plaid.js` | `POST /v1/plaid/link_token`, `POST /v1/plaid/exchange_token`, `POST /v1/plaid/accounts`, `POST /v1/plaid/transactions`, `POST /v1/plaid/item`, `DELETE /v1/plaid/item`, `POST /v1/plaid/webhook` (no auth, Plaid-signed) |
| `claude.js` | `POST /v1/ai/claude/analyze`, `POST /v1/ai/claude/test` |

### Current posture
- No CSRF middleware (no `csurf`, `csrf-csrf`).
- No `Origin`/`Referer` validation.
- CORS configured with `credentials: true` and `ALLOWED_ORIGINS` echoing.
- Backend is fully stateless bearer-JWT — no session cookies on the API.
- Frontend (`frontend/src/lib/api.ts`) attaches `Authorization: Bearer …`
  via `fetchWithAuth(path, token, options)`. Does NOT send cookies
  (`credentials: 'include'` not set).

### Risk
Browser-initiated CSRF against state-changing routes is a real exposure if
any future frontend adopts cookie auth or if Clerk's session cookie ever
becomes an auth path on the API. Today's bearer-only API is naturally
resistant — but defense-in-depth still wants an Origin gate.

### Recommended approach
- **Origin/Referer check middleware** scoped to non-bearer browser
  requests. If `Authorization: Bearer …` is present → bypass CSRF check
  (bearer clients are immune; iOS / server-to-server stay unaffected).
- Reject requests whose `Origin` is missing or not in `ALLOWED_ORIGINS`
  *only when* the request lacks a bearer token AND is state-changing.
- `csurf` is deprecated — avoid. `csrf-csrf` (double-submit cookie) is the
  modern Express choice if double-submit becomes needed later; not needed
  for the Origin-gate approach.
- Plaid webhook stays exempt (signature-verified by `verifyPlaidSignature`).
- **Zero frontend changes** for the Origin-check approach.

---

## 2. Session config + audit-log surface (Phase 56-02)

### Current session config
- Frontend `ClerkProvider` in `frontend/src/app/layout.tsx` uses Clerk
  defaults — no explicit session lifetime, idle timeout, or sign-out
  config in code or env.
- Clerk middleware (`frontend/src/proxy.ts`) uses `auth.protect()` on
  non-public routes.
- Backend is fully stateless — no session tracking, no idle checks.
- `services/financialSecurity/index.js` has a 900s rate-limiter bucket
  (`rl:auth`); that's NOT session lifetime.

### Audit-log pattern (from Phase 54-05)
- Factory: `backend-express/utils/logger.js#createLogger('audit')`.
- Event shape (existing single user — `plaid_token_decrypted`):
  ```js
  auditLogger.info('plaid_token_decrypted', {
    event: 'plaid_token_decrypted',
    userId,
    itemId,
    route,
    timestamp: new Date().toISOString(),
  });
  ```
- Token material is never logged — only metadata.
- Single Winston transport; no separate audit sink configured.

### Auth event hook points
- **Frontend Clerk hooks** (`useClerk`, `useUser`) — client-side only;
  not reliable as source-of-truth.
- **Backend Clerk webhook** (does not exist yet) — `POST
  /v1/auth/clerk-webhook` listening for `session.created`,
  `session.ended`, `user.deleted`. Verified via Clerk webhook signing
  secret (separate from the JWKS path used in `middleware/auth.js`).
- **`middleware/auth.js`** — natural place to emit
  `auth_failure` events with reason (missing token / invalid sig /
  expired). Today it returns 401 silently.

### Recommended approach
- Set Clerk session settings deliberately (lifetime, idle timeout,
  sign-out URLs) — code change in `ClerkProvider` config + env vars.
- Add `POST /v1/auth/clerk-webhook` route with signature verification,
  emitting `session_started` / `session_ended` / `user_deleted` audit
  events.
- Instrument `middleware/auth.js` to emit `auth_failure` audit events on
  401 paths (reason-coded).
- Standardize audit event schema in a small helper (`utils/auditEvent.js`
  or extend `utils/logger.js`) so all events share a frozen shape.

---

## 3. Token refresh + ISS-001 (Phase 56-03)

### `/exchange_token` today
- File: `backend-express/routes/plaid.js`, lines 128–171.
- Current response: `{ access_token, item_id, request_id, warning }`.
- DB write goes through `plaidDataService.upsertPlaidItem()` (Phase 54
  encrypted-only writer); the response field is the only client-visible
  plaintext exposure.
- Inline comment "iOS can store locally" is stale — iOS doesn't store
  it.

### Callers of the raw token in the response
- `frontend/src/lib/api.ts#exchangeToken` — returns the full response
  but does not read `access_token`.
- `frontend/src/hooks/use-plaid-link.ts#useExchangeToken` — mutates via
  the above, never destructures `access_token`.
- `frontend/src/app/dashboard/bank-accounts/page.tsx` — calls
  `exchangeToken.mutateAsync()`, never reads `access_token`.
- `frontend/src/lib/types.ts#PlaidExchangeResult` — already only has
  `item_id` (the field doesn't exist in the type).
- `frontend/e2e/fixtures/mock-data.ts` — mock already returns
  `{ item_id }` only.
- iOS: no `.swift` extraction found.

**Net: nothing reads the field.** Deletion is safe modulo coordinated
deploy.

### Clerk 401-refresh interceptor
- **iOS:** has one. `APIClient.performRequest` silently retries once
  after a 401 via the `onAuthenticationRequired` hook
  (`APIClient401RetryTests.swift`). Second consecutive 401 throws — no
  infinite loop.
- **Web:** NONE. `frontend/src/lib/api.ts#fetchWithAuth` throws
  immediately on 401. `useApiToken()` calls `getToken()` once per
  query/mutation but doesn't retry on expiry. **This is the real gap
  for this essential.**

### Plaid webhook rotation
- `handleItemWebhook` in `routes/plaid.js` (lines 652–806):
  - `ITEM_LOGIN_REQUIRED` → marks `status: 'login_required'`. User
    re-links via Plaid Link (no automatic rotation, by design).
  - Transaction webhook → uses `resolveTokenByItemId` (Phase 54
    encrypted path); fails closed.
- ✓ No token rotation work needed in Phase 56.

### Recommended approach
- **ISS-001 close:** remove `access_token` from the `/exchange_token`
  response. Keep `item_id`, `request_id`. Drop the stale "for iOS"
  comment. Tests + type already aligned.
- **Web 401-refresh interceptor:** wrap `fetchWithAuth` so a 401
  triggers `getToken({ skipCache: true })` and one retry. Mirror the iOS
  contract: max one retry, second 401 propagates.
- **iOS coordination:** ship iOS update that removes any vestigial
  `access_token` reads (already absent per the scout) and confirm
  before backend deploy. Low-risk but should be sequenced.
- **ISS-002 cleanup:** vestigial `User.plaidAccessToken` iOS field can
  be removed in the same iOS release; defer if it adds scope.

---

## 4. Encryption posture + ISS-003 (Phase 56-04)

### At-rest inventory

| Surface | Cipher | Key derivation | Master key | Status |
|---------|--------|----------------|-----------|--------|
| Plaid access tokens (`plaid_items.access_token_encrypted`) | AES-256-GCM via `createCipheriv` | HKDF-SHA256 per-user, salt `plaid-token:${userId}` | `PLAID_ENCRYPTION_KEY` (32B hex) | Plaintext col dropped 54-05; fails closed |
| Documents (Supabase Storage) | AES-256-GCM via `createCipheriv` | HKDF-SHA256 per-user, salt `userId`, info `mortgage-guardian-doc-v1` | `DOCUMENT_ENCRYPTION_KEY` (32B hex) | App-layer encryption before upload |
| Optional KMS envelope (`services/financialSecurity/encryption.js`) | AWS KMS | AWS-managed | KMS | Vendor-neutral abstraction, unused in active paths |

- Pack format consistent: `iv(12) + authTag(16) + ciphertext`, base64.
- No deprecated `createCipher` calls anywhere.
- Supabase pgcrypto / pgsodium: **not used.** All encryption is
  app-layer.

### Security headers (Helmet 8.x defaults, `app.use(helmet())`)
- HSTS `max-age=31536000; includeSubDomains` ✓
- CSP `default-src 'none'` ✓ (API-only)
- Referrer-Policy `no-referrer` ✓
- X-Content-Type-Options `nosniff` ✓
- X-Frame-Options `SAMEORIGIN` ✓
- `X-Powered-By` removed ✓
- **Gaps: none material.** CORS restricted to `ALLOWED_ORIGINS` with
  production warning.

### Log-leak audit
- No plaintext tokens, API keys, or passwords interpolated into any
  `logger.info`/`logger.debug`/`console.log` in
  `backend-express/services/` or `routes/`.
- Backfill script uses `console.error` for itemId/userId/counts only —
  no token material.
- **No leaks found.**

### `PLAID_ENCRYPTION_KEY` rotation today
- RUNBOOK §8 lines 225–296 describes a manual procedure: adapt
  `scripts/backfill-plaid-tokens.js`, decrypt with old key, re-encrypt
  with new key, bump `encryption_version` (column already exists from
  Phase 54-01).
- **No script exists.** This is ISS-003 verbatim.

### Shape of `scripts/rotate-plaid-encryption-key.js`
- Args: `--new-key <hex>` (or generate), `--dry-run` (default), `--apply`.
- Old key: `process.env.PLAID_ENCRYPTION_KEY`. New key: CLI arg.
- Iterate `plaid_items` WHERE `encryption_version < target`.
- For each row: decrypt with old key, re-encrypt with new key, verify
  round-trip decrypt before write, update `encryption_version`.
- Reuse `plaidTokenEncryptionService.decryptFromStorage` /
  `encryptForStorage` — but instantiate two service objects (one per
  key) since the service reads the env at construction. Minor refactor:
  accept a constructor-injected key.
- Log discipline mirrors `backfill-plaid-tokens.js`: counts + itemId +
  userId, never token material. Exit 0 only on zero errors.

### Recommended approach
- **No-op for ciphers/headers/logs** — current state is already correct.
- **Ship the rotation script** (ISS-003 close).
- **Minor refactor** to `plaidTokenEncryptionService` to allow
  constructor-injected master key without reading process.env at every
  call. Backward-compatible (default to env if not provided).
- **RUNBOOK §8 update** to point at the new script instead of the
  manual procedure.

---

## Summary for plan-phase

The four essentials map cleanly to four plans:

- **56-01** — CSRF: Origin/Referer middleware with bearer-bypass +
  tests on every state-changing route.
- **56-02** — Session config + audit-log: explicit Clerk settings,
  Clerk-webhook route, `auth_failure` instrumentation,
  `utils/auditEvent.js` helper.
- **56-03** — Token refresh + ISS-001: drop `access_token` from
  `/exchange_token` response, add web 401-refresh interceptor (iOS
  pattern), coordinated iOS release note.
- **56-04** — Encryption rotation: `scripts/rotate-plaid-encryption-key.js`,
  small constructor refactor on `plaidTokenEncryptionService`, RUNBOOK
  §8 update, ISS-003 close.

A 56-05 closeout plan (SUMMARY, ROADMAP/STATE bump) tracks Phase 55's
shape. **Expected plan count: 5.**

### Risk callouts
- ISS-001 wants an iOS-coordinated deploy; backend change can be gated
  behind a brief feature flag if needed but the scout shows no real
  iOS dependency on the field.
- CSRF Origin gate must NOT apply to the Plaid webhook (no `Origin`
  header from Plaid's servers); explicit exemption needed.
- Clerk webhook secret is a new env var — add to `envValidator.js` and
  document in QUICK-START.
