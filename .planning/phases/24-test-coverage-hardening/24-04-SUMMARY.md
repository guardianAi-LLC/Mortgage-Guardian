---
phase: 24
plan: "04"
subsystem: testing
tags: [pipeline, plaid, jest, coverage]
requires: [20-03, 21-02]
provides: [pipeline-plaid-coverage]
affects: [backend-express/__tests__/services/]
tech-stack: [jest, node]
key-files:
  - backend-express/__tests__/services/documentPipeline-integration.test.js
  - backend-express/__tests__/services/documentPipeline-db.test.js
  - backend-express/__tests__/services/plaidCrossReferenceService.test.js
key-decisions:
  - Separated DB persistence tests into documentPipeline-db.test.js to mock Supabase as non-null (module-level closure requires env vars at load time)
  - Accepted 79.31% function coverage for documentPipelineService — remaining 6 uncovered functions are unreachable empty .catch(() => {}) no-op handlers on fire-and-forget _persistPipeline calls
  - Used jest.useFakeTimers for _scheduleCleanup callback coverage
patterns-established:
  - Separate test file for module-level dependency injection testing (Supabase client)
  - Fee type classification testing via fee analysis integration (no direct export needed)
duration: ~25min
---

# 24-04 Summary: Document Pipeline & Plaid Cross-Reference Coverage

## Objective
Close coverage gaps in documentPipelineService.js and plaidCrossReferenceService.js.

## Results

### documentPipelineService.js

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Statements | 85.71% | **100%** | ≥90% | ✅ |
| Branches | 76.52% | **92.17%** | ≥80% | ✅ |
| Functions | 72.41% | **79.31%** | ≥85% | ⚠️ practical max |
| Lines | — | **100%** | — | ✅ |

**Function coverage note:** The 6 uncovered "functions" are all empty `.catch(() => {})` arrow functions on fire-and-forget `_persistPipeline()` calls. Since `_persistPipeline` has its own internal try/catch that handles all errors (never rejects), these catch handlers are unreachable dead code. 79.31% is the practical maximum.

### plaidCrossReferenceService.js

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Statements | 87.65% | **96.91%** | ≥90% | ✅ |
| Branches | 63.63% | **87.27%** | ≥80% | ✅ |
| Functions | 90.62% | **96.87%** | — | ✅ |
| Lines | — | **96.99%** | — | ✅ |

## Tests Added

### documentPipeline-integration.test.js (15 new tests → 35 total)
- `getMapSize` returns pipeline state count
- `_enforceMapSizeLimit` evicts oldest 100 entries when >1000, cancels cleanup timers
- `_scheduleCleanup` removes state after 5-min grace period (fake timers)
- `getStatusSync` returns in-memory status
- `getUserPipeline` filters by status
- `completeDocument` error branches: not found, unauthorized, wrong state
- `retryDocument` unauthorized path
- Case association: multiple cases, no cases, error in case service
- Classification confidence: low (adds warning), medium (no warning)
- OCR error: no content provided
- `_getPreviousState` state machine helper

### documentPipeline-db.test.js (9 new tests)
- `_persistPipeline` calls Supabase upsert, handles errors gracefully
- `_loadPipeline` recovers state from DB, handles nulls, caches in memory
- DB query failure returns null
- Fire-and-forget catch handler coverage

### plaidCrossReferenceService.test.js (16 new tests → 37 total)
- Fee type classification: inspection, legal/attorney, appraisal/BPO, NSF, other_fee
- Fee amount mismatch detection between documented and actual
- Undocumented fees detected without any documented fees provided
- Escrow: no disbursements finding, null when not requested
- `amount_outside_tolerance` unmatched reason
- `possibleMatch` null when no doc payments exist
- `extractPaymentsFromAnalysis`: null extractedData, missing date/amount, empty/no args

## All Tests
- 1578 tests passing across 53 suites
- No regressions
