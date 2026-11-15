# Phase 56: Auth Hardening & Encryption Audit — Context

**Gathered:** 2026-06-10
**Status:** Ready for research

<vision>
## How This Should Work

Phase 56 is a **hardening pass on the auth surface we already have** — Clerk
JWTs, Supabase, the Plaid encrypted-token resolver from Phase 54, the
document encryption service. No new auth provider, no new session model,
no re-architecture. Walk every auth and encryption surface, find the weak
spots, plug them, ship tests with each fix.

The output is the diff itself: real fixes landed in code, each covered by
tests. No separate audit-report doc — the commits and the test suite are
the audit trail. The phase is done when the four essential items below
are shipped and CI is green.

</vision>

<essential>
## What Must Be Nailed

All four areas are in scope and each must land before Phase 56 closes:

- **CSRF middleware on state-changing routes** — pick a maintained
  middleware (e.g. `csrf-csrf` double-submit-cookie, since `csurf` is
  deprecated), apply to `POST/PUT/DELETE` on `/v1/plaid`,
  `/v1/documents`, settings routes, thread the token through the frontend
  fetch wrappers. New surface area; carries the most novel risk.
- **Session config + small audit-log surface** — Clerk session lifetime
  / idle timeout / sign-out-everywhere configured deliberately; backend
  emits structured audit-log events for login, logout, and session
  revocation. Mostly config + a small logger surface.
- **Token refresh + close ISS-001** — verify the frontend's 401-refresh
  interceptor handles expired Clerk JWTs without bouncing to login;
  document the iOS refresh path; close **ISS-001** by stopping
  `/exchange_token` from returning the raw Plaid access token to the
  client (per-Phase-54 the resolver is itemId-based, so the client
  doesn't need the raw token).
- **Encryption posture review + close ISS-003** — walk every at-rest
  surface (`plaidTokenEncryptionService`, `documentEncryptionService`,
  Supabase columns, logs that might leak sensitive values) and every
  in-transit hop (Vercel TLS + security headers, Cloudmersive HTTPS,
  Plaid HTTPS, Supabase HTTPS). Fix anything weak — likely small
  (a missing header, a leaky log line). Ship the `PLAID_ENCRYPTION_KEY`
  rotation script to close **ISS-003**.

</essential>

<boundaries>
## What's Out of Scope

- **MFA / WebAuthn / passkeys / TOTP.** Big surface, gets its own
  dedicated phase if/when we want it.
- **Multi-tenant / RBAC permission model.** Already scoped for Phase 58
  (Multi-Tenant & Role-Based Access). Phase 56 stays single-user.
- **Re-architecting auth.** No moving off Clerk, no custom session store,
  no replacing Supabase auth. Phase 56 operates *inside* the current
  Clerk + Supabase + Plaid model.
- **Third-party pen-test / formal SOC-2 prep.** External audit engagement
  is a separate workstream. Phase 56 is internal hardening only.
- **Separate written audit-report doc.** The diff + tests are the
  artifact; no standalone `AUTH_AUDIT.md` deliverable.

</boundaries>

<specifics>
## Specific Ideas

- Two carry-forward issues from prior phases close as part of this work:
  - **ISS-001** — `/exchange_token` returns raw Plaid token to client
    (closes inside the token-refresh essential).
  - **ISS-003** — no `PLAID_ENCRYPTION_KEY` rotation script (closes
    inside the encryption-posture essential).
- Backend deploys to **Vercel only** (per Phase 55 discovery). No
  daemons, no sidecars; CSRF state must be cookie-based or stateless,
  not in a Redis session store.
- Auth is **bearer-JWT verified against Clerk JWKS** in
  `middleware/auth.js`. CSRF risk is concentrated on any cookie-auth
  paths (SSR routes via Clerk session cookie); double-submit-cookie is
  likely the right pattern.

</specifics>

<notes>
## Additional Context

- This is the last "platform safety" phase before the v8.0 milestone
  pivots toward scale (Phase 57 pagination/rate-limits) and capability
  (Phase 58 multi-tenant). Whatever ships here is what the next two
  phases build on, so the encryption posture and the CSRF model must be
  ones we're comfortable carrying forward.
- All four essentials picked — expect the plan-phase pass to produce
  4–5 plans, one per essential plus a small closeout for issue close-out
  and ROADMAP bump.

</notes>

---

*Phase: 56-auth-hardening*
*Context gathered: 2026-06-10*
