---
phase: 49-e2e-testing
plan: 03
subsystem: testing
tags: [playwright, e2e, cases, documents, mock-data, crud]

# Dependency graph
requires:
  - phase: 49-e2e-testing
    provides: Playwright infrastructure, auth helper, smoke tests, global-setup
provides:
  - Case CRUD E2E tests (list, filters, create form, detail, analysis, report)
  - Document management E2E tests (list, filters, batch ops, detail, analysis)
  - Shared mock data fixtures with factory functions and route interceptors
  - Clerk sign-in helper using server-side sign-in token
affects: [49-04, 49-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["clerk.signIn for full auth in E2E tests", "shared mock-data.ts fixtures with factory pattern", "interceptCasesAPI/interceptDocumentsAPI route helpers"]
---

## What was done

### Task 1: Case CRUD flow tests (`frontend/e2e/cases.spec.ts`)
9 tests covering:
- Case list: page loads with table, filters render and respond, new case button navigation
- Case creation: form renders required fields, validates required fields, submits successfully
- Case detail: case info card, analysis page with tabs, report page with empty state

### Task 2: Document management flow tests (`frontend/e2e/documents.spec.ts`)
10 tests covering:
- Document list: page loads with table, filters render, search filter, status filter
- Batch operations: select-all checkbox, batch action bar, batch delete confirmation dialog
- Document detail: info card, analysis results with anomalies, action buttons

### Task 3: Shared mock data fixtures (`frontend/e2e/fixtures/mock-data.ts`)
- Factory functions: `mockCase()`, `mockDocument()`, `mockAnalysis()`, `mockCasesList()`, `mockDocumentsList()`
- Route interceptor helpers: `interceptCasesAPI()`, `interceptDocumentsAPI()`
- Auth helper: `signIn()` using Clerk testing token + server-side sign-in token
- Both spec files refactored to import from shared fixtures

### Infrastructure changes
- Added `frontend/e2e/global-setup.ts` for Clerk `clerkSetup()` initialization
- Updated `frontend/playwright.config.ts` with `globalSetup` pointing to global-setup.ts

## Deviations from plan
- Used `clerk.signIn` with `emailAddress` parameter instead of just `setupClerkTestingToken` — the latter only bypasses bot protection, not actual Clerk middleware authentication. Server-side sign-in token creation is required for full auth bypass.
- Added `global-setup.ts` and updated `playwright.config.ts` to support Clerk's `clerkSetup()` which is required before `setupClerkTestingToken` can work.

## Commits
1. `df76013` — test(49-03): add case CRUD flow E2E tests
2. `749387d` — test(49-03): add document management flow E2E tests
3. `0cbd8e3` — refactor(49-03): extract shared mock data fixtures and auth helper

## Verification
All 19 tests pass:
```
Running 19 tests using 5 workers
  9 passed — cases.spec.ts
  10 passed — documents.spec.ts
  19 passed (14.9s)
```
