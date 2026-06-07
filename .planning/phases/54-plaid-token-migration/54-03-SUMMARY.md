---
phase: 54-plaid-token-migration
plan: 03
subsystem: frontend
tags: [plaid, security, xss, item-id, access-token, localstorage, frontend, nextjs]

# Dependency graph
requires:
  - phase: 54-plaid-token-migration
    provides: item_id request contract on /v1/plaid/{accounts,transactions,item,item/webhook} + GET /v1/plaid/items list endpoint (54-02)
provides:
  - api.plaid.* methods + Plaid hooks that take itemId only
  - usePlaidItems() hook wrapping GET /v1/plaid/items
  - bank-accounts page rendered exclusively from server-side item list
  - one-time localStorage cleanup of legacy mg_plaid_access_tokens key
  - Playwright assertion that no access_token-like key appears in /v1/plaid/* request bodies
affects: [54-04-ios-rewire, 54-05-drop-plaintext-column]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client identifier-only contract: web client knows item_id, never access_token"
    - "Server-driven list as source of truth (GET /items) instead of localStorage hydration"
    - "One-time localStorage migration cleanup on first mount, scheduled for removal in 54-05"
    - "E2E regression: assert no access_token-like key in any Plaid request body"

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/lib/types.ts
    - frontend/src/hooks/use-plaid-link.ts
    - frontend/src/app/dashboard/bank-accounts/page.tsx
    - frontend/src/components/plaid-link-button.tsx
    - frontend/e2e/bank-accounts.spec.ts
    - frontend/e2e/fixtures/mock-data.ts

key-decisions:
  - "Clean break — no accessToken alias kept; TS compiler enforces every call site is migrated"
  - "PlaidItem type matches GET /items shape (itemId, institutionId, status, updatedAt, accounts) — camelCase"
  - "PlaidExchangeResult.access_token removed so the field cannot be stored or read by any client code"
  - "useEffect localStorage cleanup runs on every mount of bank-accounts page; cheap idempotent removal scheduled for deletion in 54-05"
  - "PlaidLinkButton.accessToken prop renamed to itemId (was unused at runtime); reserved for update-mode Link flow which now resolves token server-side"

patterns-established:
  - "Pattern: query keys include itemId (not access_token) so React Query cache invalidation remains per-bank"
  - "Pattern: E2E mocks assert request-body contract via assertNoAccessTokenInBody helper"
  - "Pattern: page-level one-time migration cleanup commented with phase id + removal target plan"

issues-created: []

# Metrics
duration: ~20min
completed: 2026-06-07
---

# Phase 54-03: Frontend Rewire to item_id Summary

**Removed Plaid access_token from the Next.js client surface: API helpers, hooks, page state, and storage all key off item_id; the legacy `mg_plaid_access_tokens` localStorage entry is now actively purged on first load.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-06-07
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `api.plaid.*` methods now take `itemId`. Added `listItems()` for the new GET /v1/plaid/items endpoint.
- New `usePlaidItems()` hook makes the server-rendered item list the single source of truth for linked banks.
- `bank-accounts/page.tsx` no longer hydrates from localStorage; `useState<string[]>` of tokens, STORAGE_KEY, and get/add/remove helpers were deleted. `onPlaidSuccess` and `onDelete` invalidate `['plaid-items']` instead of mutating localStorage.
- One-time `useEffect` on the page does `localStorage.removeItem('mg_plaid_access_tokens')` on mount — scheduled for removal in 54-05 after the deprecation window.
- `PlaidLinkButton.accessToken` renamed to `itemId` (forward-only — the prop forwards to backend, which resolves the token).
- `PlaidExchangeResult.access_token` field removed from the public type; backend response will be ignored even if present.
- Playwright bank-accounts spec rewritten: linked banks render from GET /items; new regression test asserts no `access_token`-like key appears in any `/v1/plaid/*` request body; new test seeds the legacy key and asserts it's gone after first render.

## Task Commits

Each task was committed atomically:

1. **Task 1: api.ts + hooks + types switch to itemId** — `1962053` (feat)
2. **Task 2: bank-accounts page + plaid-link-button itemId rewrite + localStorage cleanup** — `1f63dce` (feat)
3. **Task 3: E2E bank-accounts spec for item_id contract + cleanup regression** — `8453898` (test)

**Plan metadata:** _to be added by metadata commit_

## Files Created/Modified
- `frontend/src/lib/api.ts` — `getAccounts/getTransactions/getItem/deleteItem` now POST `{ item_id }`; added `listItems(token)` GET `/plaid/items`.
- `frontend/src/lib/types.ts` — `PlaidItem` reshaped to match GET /items response (`itemId`, `institutionId`, `status`, `updatedAt`, `accounts`, optional `institutionName`, `consentExpirationTime`); `PlaidExchangeResult.access_token` removed.
- `frontend/src/hooks/use-plaid-link.ts` — every hook keys off `itemId`; added `usePlaidItems()` exposing `{ items, isLoading, refetch }`; `useDeletePlaidItem()` mutation takes itemId and invalidates `['plaid-items']`.
- `frontend/src/app/dashboard/bank-accounts/page.tsx` — sourced linked banks from `usePlaidItems()`; deleted `STORAGE_KEY` + helpers; added one-time `localStorage.removeItem` migration cleanup; renamed every `accessToken*` identifier to `itemId*`.
- `frontend/src/components/plaid-link-button.tsx` — `accessToken?` prop renamed to `itemId?` (forward-only; reserved for update-mode link flow).
- `frontend/e2e/bank-accounts.spec.ts` — replaced localStorage seeding helper with item-driven mocks; added 2 regressions (no access_token in body, legacy localStorage purged).
- `frontend/e2e/fixtures/mock-data.ts` — `interceptPlaidAPI` now intercepts GET `/plaid/items`, asserts no `access_token`-like key on every `/accounts`/`/transactions`/`/item` body via `assertNoAccessTokenInBody`; exchange_token mock returns `{ item_id }` only.

## Decisions Made
- **Clean-cut migration with no alias.** Removing `accessToken` from the type system in Task 1 forced the compiler to flag every UI call site, which is exactly how Task 2's surgery was scoped.
- **One-time `useEffect` cleanup, not a write-time guard.** The cleanup runs on every mount but the `removeItem` call is idempotent and cheap; the comment in the source plus this summary commit document the planned removal in 54-05.
- **`PlaidExchangeResult.access_token` removed even though backend still returns it.** This prevents any future code path from accidentally reading the field. The backend response shape is forward-compatible; ignoring an extra field is safe.
- **Renamed `PlaidLinkButton.accessToken` to `itemId` instead of deleting.** The prop was effectively unused at runtime, but the intent (update-mode link flow) is real and will be wired in a later plan; keeping the slot with the new name preserves the contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Auto-fix] PlaidLinkButton.accessToken was an unused-at-runtime prop**
- **Found during:** Task 2 rewrite.
- **Issue:** The plan said to rename `accessToken?: string` to `itemId?: string` and "update the body of any internal API call accordingly," but inspection of `plaid-link-button.tsx` showed the prop was never used in any internal API call — it's only declared in the props interface. The original was dead.
- **Fix:** Renamed to `itemId?: string` (prefixed local destructure with `_` to silence unused-var lint without removing the slot), with a JSDoc comment documenting it as reserved for update-mode link flow where the backend resolves the token server-side from item_id.
- **Files modified:** `frontend/src/components/plaid-link-button.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npm run lint` passes (no new errors; the `_itemId` underscore-prefix shows as a pre-existing unused-var warning style consistent with other files in the repo).

### Deferred / Skipped Verification

**1. Plan Task 2 verify step 4 — interactive browser walkthrough — deferred to user.**
The plan asks for `npm run dev` + manual click-through on `/dashboard/bank-accounts`, watching DevTools Network to confirm no `access_token` in any request body. As an autonomous subagent I cannot drive a browser in this sandbox. Recommend the user run through it before merge; the new Playwright test `no access_token in any /v1/plaid/* request body` covers the same assertion automatically.

**2. Plan Task 3 verify step 2 — full Playwright suite — not executed.**
Playwright's `webServer` config tries to bind `0.0.0.0:3000`, which the sandbox blocks (`listen EPERM`). I verified the bank-accounts spec compiles and lists correctly under `--list`, but did not execute the suite. The plan's E2E caveat covers this case — user should run `npm run test:e2e -- bank-accounts` (with `CLERK_SECRET_KEY` set and dev server allowed) before merging.

**3. Plan-level verification: `npm run build` not executed.**
Build was not run because the sandbox network/listen restrictions interfere with Next's build-time prerender for routes that hit the API proxy. `npx tsc --noEmit` is green on the whole tree, which is the strongest static check.

---

**Total deviations:** 1 auto-fixed (prop rename had no runtime body to update — documented as reserved). 3 verification steps deferred (browser walkthrough, E2E execution, full `npm run build`) — all per the plan's E2E caveat and the autonomous-execution instructions.

## Issues Encountered

- **npm/Playwright cannot bind 0.0.0.0:3000 in the sandbox.** The autonomous verification steps that need a running dev server (manual browser walkthrough + Playwright suite + Next prod build) were deferred to the user as documented above. Not a code issue.
- **`frontend/src/lib/**` is matched by the repo `.gitignore` `lib/` rule but the files are already tracked.** `git add` required `-f` for every commit. Consider in a future cleanup adding a narrower ignore (or removing the `lib/` rule which mostly targets root-level build output, not source directories).

## Next Phase Readiness

- **54-04 iOS rewire is now unblocked from the web side.** Web client no longer holds any Plaid credential. iOS app must follow the same path:
  1. Stop sending `access_token` in `/accounts`, `/transactions`, `/item`, `/item/webhook`, `DELETE /item`.
  2. Source linked banks from `GET /v1/plaid/items` and key persistent state off `item_id`.
- **54-05 plaintext column drop / cleanup.** When this plan ships, the page-level `localStorage.removeItem('mg_plaid_access_tokens')` `useEffect` is intentional debt — 54-05 should delete the `useEffect` after the deprecation window and also drop the `access_token_encrypted` plaintext column once the iOS backfill (54-04) lands.

---
*Phase: 54-plaid-token-migration*
*Completed: 2026-06-07*
