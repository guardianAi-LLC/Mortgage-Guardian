---
phase: 52-structured-reasoning
plan: 03
subsystem: api
tags: [cross-document-comparison, structured-reasoning, claude-ai, forensic-analysis, mortgage]

requires:
  - phase: 52-01
    provides: structuredReasoningConfig with REASONING_PROMPT_INSTRUCTIONS and getConfidenceLevel
  - phase: 52-02
    provides: reasoning field integration pattern for analysis services
  - phase: 51-02
    provides: per-document evidence fields (pageNumber, quotedText) on discrepancies

provides:
  - crossDocumentComparisonService system prompt enriched with DISCREPANCY_REASONING_INSTRUCTION
  - Comparison prompts append DISCREPANCY_REASONING_INSTRUCTION + GENERAL_REASONING_INSTRUCTION
  - Discrepancy JSON schema includes reasoningSteps[] and confidence fields
  - _enrichResult() normalizes reasoning fields with defaults and confidenceLevel computation
  - forensicNote preserved alongside new reasoningSteps field

affects: [cross-document-aggregation, forensic-reporting, regulatory-dashboard]

tech-stack:
  added: []
  patterns:
    - "Reasoning enrichment after evidence enrichment in discrepancy processing"
    - "forensicNote (free-form investigator commentary) coexists with reasoningSteps (structured analysis chain)"

key-files:
  created: []
  modified:
    - backend-express/services/crossDocumentComparisonService.js
    - backend-express/__tests__/services/crossDocumentComparisonService.test.js

key-decisions:
  - "Keep forensicNote field unchanged — serves different purpose than reasoningSteps (investigator commentary vs analytical chain)"
  - "Both DISCREPANCY_REASONING_INSTRUCTION and GENERAL_REASONING_INSTRUCTION appended to user prompt (system prompt gets the former for legal defensibility framing)"

issues-created: []

duration: 12min
completed: 2026-04-24
---

# Phase 52 Plan 03: Cross-Document Comparison Reasoning Integration Summary

**crossDocumentComparisonService system prompt and comparison prompts restructured with reasoning chains and per-discrepancy confidence scoring, adding reasoningSteps[] and confidenceLevel to all discrepancy outputs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-24T01:15:00Z
- **Completed:** 2026-04-24T01:27:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- System prompt now includes reasoning expectations: instructs Claude to show analytical reasoning for each discrepancy for legal defensibility
- Comparison prompts append both `DISCREPANCY_REASONING_INSTRUCTION` (per-discrepancy chain) and `GENERAL_REASONING_INSTRUCTION` (broad evidence traceability rule)
- Discrepancy JSON schema updated to include `reasoningSteps` array and `confidence` score fields
- `_enrichResult()` normalizes reasoning fields: `reasoningSteps` defaults to `[]`, `confidence` clamped 0–1 with `confidenceLevel` computed via `getConfidenceLevel()`, both default to `null` when absent
- `forensicNote` preserved intact alongside `reasoningSteps` — serves distinct purpose (investigator commentary vs structured analysis chain)
- 3 new tests covering: reasoning fields present with correct confidenceLevel, defaults when Claude omits them, and forensicNote coexistence

## Task Commits

1. **Task 1: Restructure comparison prompts with reasoning chains** - `ee7ebb4` (feat)
2. **Task 2: Update response parsing and tests for reasoning fields** - `9869c58` (feat)

## Files Created/Modified

- `backend-express/services/crossDocumentComparisonService.js` — Import structuredReasoningConfig, update system prompt and _buildComparisonPrompt(), update _enrichResult() with reasoning field normalization
- `backend-express/__tests__/services/crossDocumentComparisonService.test.js` — 3 new tests for reasoning fields (54 tests total, all pass)

## Decisions Made

- Keep `forensicNote` field alongside new `reasoningSteps` — plan explicitly directed this. forensicNote = free-form investigator commentary; reasoningSteps = structured logical chain. Both serve distinct forensic purposes.
- Append `DISCREPANCY_REASONING_INSTRUCTION` in both system prompt (for framing) and user prompt (for per-comparison enforcement) — provides layered instruction ensuring Claude applies reasoning at both the session level and per-prompt level.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- crossDocumentComparisonService now outputs full reasoning chains for all discrepancies, matching the pattern from documentAnalysisService (52-02)
- Ready for 52-04: remaining analysis services (forensicAnalysisService, complianceAnalysisService)
- All 54 crossDocumentComparison tests pass; no regressions

---
*Phase: 52-structured-reasoning*
*Completed: 2026-04-24*
