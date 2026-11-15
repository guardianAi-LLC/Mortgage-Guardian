---
phase: 56-auth-hardening
plan: 02
subsystem: auth
tags: [clerk, svix, audit, webhook, express, jwt]

requires:
  - phase: 56-auth-hardening
    provides: csrfOriginGuard middleware with exemptPaths option (56-01)

provides:
  - emitAuditEvent helper (allow-list + sensitive-key scrub)
  - AUDIT_EVENTS frozen constant
  - POST /v1/auth/clerk-webhook with svix signature verification
  - auth_failure emission with reason codes on every middleware/auth.js 401 path
  - CLERK_WEBHOOK_SECRET env var (production-required)
  - docs/AUTH_SESSION_CONFIG.md (Clerk Dashboard policy doc)

affects: [56-03-token-refresh, 56-04-encryption-audit, 56-05-finalize]

tech-stack:
  added: [svix ^1.95.2]
  patterns:
    - Centralized audit-event emission via single helper (no ad-hoc audit logger calls)
    - Per-route express.raw() body parsing for signature-verified webhooks
    - Public-path bypass (middleware/auth.js PUBLIC_PATHS) + csrfOriginGuard exempt-paths together for webhooks

key-files:
  created:
    - backend-express/utils/auditEvent.js
    - backend-express/routes/auth.js
    - backend-express/__tests__/utils/auditEvent.test.js
    - backend-express/__tests__/routes/auth-webhook.test.js
    - docs/AUTH_SESSION_CONFIG.md
  modified:
    - backend-express/middleware/auth.js
    - backend-express/utils/envValidator.js
    - backend-express/server.js
    - backend-express/__tests__/utils/envValidator.test.js
    - backend-express/package.json
    - backend-express/package-lock.json
    - frontend/src/app/layout.tsx
    - QUICK-START-NO-AWS.md

key-decisions:
  - "Sensitive-key strip rule: exact match on {password, token, access_token, secret, apikey} plus substring match on password/secret/apikey/access_token/accessToken plus suffix _token/token — carves out sessionId/userId/itemId so legitimate identifiers survive"
  - "auth_failure reason classification derived from underlying error message (expired/signature/structure/jwks/network); defaults to malformed_token"
  - "Session policy lives in Clerk Dashboard, not code — documented in docs/AUTH_SESSION_CONFIG.md with a layout.tsx comment as the in-code pointer"
  - "Clerk webhook bypasses both requireAuth (added to PUBLIC_PATHS) and csrfOriginGuard (added to exemptPaths) — svix signature is the authentication primitive"

patterns-established:
  - "AUDIT_EVENTS allow-list: every new audit event name added to the frozen list, callers cannot emit ad-hoc events"
  - "Webhook routes: per-route express.raw() + signature-verify before any business logic"

issues-created: []

duration: ~25min
completed: 2026-06-11
---

# Phase 56-02: Clerk Session & Audit Helper Summary

**Audit event helper + Clerk webhook with svix verification, reason-coded auth_failure on every 401 path**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-11
- **Tasks:** 3
- **Files modified/created:** 14

## Accomplishments
- `utils/auditEvent.js` with frozen `AUDIT_EVENTS` allow-list, defensive sensitive-key stripping, and timestamp/event injection — all audit emissions now flow through one helper.
- `middleware/auth.js` instrumented: every 401 path emits `auth_failure` with one of `missing_token` / `invalid_signature` / `expired_token` / `malformed_token` / `jwks_unavailable` (token material never logged).
- `POST /v1/auth/clerk-webhook` with svix signature verification; handles `session.created`, `session.ended`/`removed`/`revoked`, `user.deleted` → emits corresponding `session_started` / `session_ended` / `user_deleted` audit events.
- Webhook bypasses both `requireAuth` (PUBLIC_PATHS) and `csrfOriginGuard` (exemptPaths).
- `CLERK_WEBHOOK_SECRET` added to `envValidator.js` — required in production, optional in dev/test.
- Clerk Dashboard policy documented (`docs/AUTH_SESSION_CONFIG.md`), pointed to from `layout.tsx`, and `QUICK-START-NO-AWS.md` now lists the new env var with a summary table.

## Task Commits

1. **Task 1: auditEvent helper + 401 instrumentation** — `270d850` (feat)
2. **Task 2: Clerk webhook with svix verification** — `4ac62d1` (feat)
3. **Task 3: docs (AUTH_SESSION_CONFIG + QUICK-START + layout comment)** — `4718d64` (docs)

**Plan metadata commit:** (added in final docs commit)

## Decisions Made
- Sensitive-key strip rule documented above; preserves `sessionId`/`userId`/`itemId`.
- Reason classification mapped from underlying error message rather than tracking explicit per-throw codes (keeps `verifyClerkToken` unchanged).
- Session policy is Dashboard-controlled (Clerk's SDK doesn't expose lifetime/timeout via React props) — handled by a doc + an in-code pointer comment.

## Deviations from Plan

**1. envValidator production tests updated** (Auto-fix, Rule 4 boundary — necessary to keep existing tests green after adding a new required-in-prod var)
- Updated 5 existing production-path tests in `__tests__/utils/envValidator.test.js` to include `CLERK_WEBHOOK_SECRET: 'whsec_test'` and added it to the cleanup list. Without this every existing prod-path test threw on the new required var.
- Committed inside Task 2 (`4ac62d1`).

**2. CLERK_WEBHOOK_SECRET added to PUBLIC_PATHS in middleware/auth.js** (Auto-fix, Rule 3 blocking — webhook would always 401 without this)
- The plan called out adding to `csrfOriginGuard.exemptPaths` but the global `app.use('/v1/', requireAuth)` would still 401 the webhook (it has no Bearer token). Added `{ method: 'POST', path: '/v1/auth/clerk-webhook' }` to PUBLIC_PATHS to match the existing Plaid webhook treatment.
- Committed inside Task 2.

**3. QUICK-START env-var table** (Plan deviation, neutral — the file had no existing "table" so I added one)
- Plan said "add CLERK_WEBHOOK_SECRET row to the backend env vars table" but QUICK-START-NO-AWS.md only had code blocks. Added the row in the code block AND introduced a clean summary table for clarity. QUICK-START.md (backend-express variant) was not modified because it has no env-var listing of any kind.

**Total deviations:** 2 auto-fixed (test-data parity, blocking auth bypass), 1 docs interpretation. No deferred issues.

## Issues Encountered
None substantive. The backend test sandbox had a write-permission issue requiring `dangerouslyDisableSandbox: true` for `git add`/`commit` — expected per backend-test-quirks memory.

## Next Phase Readiness
- Ready for 56-03 (token refresh + ISS-001 plaintext-access-token exposure on `/exchange_token`).
- `emitAuditEvent` is the canonical helper for 56-04 encryption-audit emissions (`plaid_key_rotated`, `plaid_token_decrypted` migration).
- `auth_failure` instrumentation is observable; 56-03 can add `token_refresh_*` events by extending `AUDIT_EVENTS`.

---
*Phase: 56-auth-hardening*
*Plan: 02*
*Completed: 2026-06-11*
