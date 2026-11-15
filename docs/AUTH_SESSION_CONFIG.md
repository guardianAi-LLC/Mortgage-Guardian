# Clerk Session Configuration

Phase 56-02 establishes the deliberate, documented session policy for the
Mortgage Guardian platform. Clerk does not expose all session settings via
the React SDK — the operational values below MUST be set in the Clerk
Dashboard. Ops verifies these after every key rotation or environment
change.

## Required Clerk Dashboard Settings

Set each value at **Clerk Dashboard → Sessions** (or the matching settings
page) for the environment you are configuring (sandbox / production).

| # | Setting              | Value                                                | Why                                                                                                |
|---|----------------------|------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| 1 | Session lifetime     | **7 days**                                           | Caps the maximum age of any session; forces re-auth at least weekly even for active users.         |
| 2 | Inactivity timeout   | **30 minutes**                                       | Idle sessions expire so an unattended tab/device can't be hijacked indefinitely.                   |
| 3 | Multi-session        | **Disabled** (single active session per user)        | Reduces blast radius — a stolen session token can only have one active counterpart at a time.      |
| 4 | Sign-out URL         | **`/sign-in`**                                       | After Clerk completes sign-out the user lands on the Mortgage Guardian sign-in page, not Clerk's. |
| 5 | Webhook endpoint     | **`${BACKEND_URL}/v1/auth/clerk-webhook`**           | Backend receives session/user lifecycle events for the audit log (see below).                      |

### Webhook event subscription

At the same Webhook endpoint above, subscribe to **exactly** these events:

- `session.created`
- `session.ended`
- `session.removed`
- `session.revoked`
- `user.deleted`

The signing secret Clerk displays after you save the endpoint becomes the
`CLERK_WEBHOOK_SECRET` env var on the backend. Without that secret the
backend will refuse to start in production (envValidator enforcement).

## Operational Notes

- These are Dashboard-controlled, not code-controlled. A code review will
  NOT catch a mis-set value here — verify in the Dashboard.
- Verification cadence: after every Clerk key rotation, after every change
  of the backend domain, and on every promotion sandbox -> production.
- The frontend `ClerkProvider` (see `frontend/src/app/layout.tsx`) holds
  a comment pointing here so future devs know session policy lives in the
  Dashboard.

## Related

- `backend-express/routes/auth.js` — webhook receiver (svix signature verification)
- `backend-express/utils/auditEvent.js` — emitter for `session_started` / `session_ended` / `user_deleted`
- `backend-express/middleware/auth.js` — emits `auth_failure` with reason codes on every 401
- `.planning/phases/56-auth-hardening/56-02-PLAN.md` — phase plan that introduced this doc
