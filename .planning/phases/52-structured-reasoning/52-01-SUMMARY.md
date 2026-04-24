---
phase: 52-structured-reasoning
plan: 01
subsystem: api
tags: [claude, structured-reasoning, confidence-scoring, chain-of-thought, config]

requires:
  - phase: 51-evidence-enrichment
    provides: evidenceEnrichmentConfig.js declarative config pattern, ENRICHMENT_PROMPT_INSTRUCTIONS pattern

provides:
  - structuredReasoningConfig.js with REASONING_FIELDS, CONFIDENCE_SCALE, REASONING_PROMPT_INSTRUCTIONS, getConfidenceLevel
  - claudeService.js updated to claude-sonnet-4-5-20250514 with reasoning fields in output

affects: [52-structured-reasoning, documentAnalysisService, forensicAnalysisService, complianceAnalysisService]

tech-stack:
  added: []
  patterns:
    - "Declarative reasoning config with null-default fields — same backward-compatible pattern as evidenceEnrichmentConfig.js"
    - "Prompt instruction fragments (REASONING_PROMPT_INSTRUCTIONS) appended to analysis prompts for chain-of-thought"
    - "Response enrichment: reasoning fields defaulted to null/[] when Claude doesn't provide them"

key-files:
  created:
    - backend-express/config/structuredReasoningConfig.js
  modified:
    - backend-express/services/claudeService.js
    - backend-express/__tests__/services/claudeService.test.js

key-decisions:
  - "Used same declarative config pattern as evidenceEnrichmentConfig.js for consistency"
  - "Reasoning fields exposed at both result.reasoning (top-level) and merged into result.content when JSON — provides flexibility for consumers"
  - "getConfidenceLevel thresholds: >=0.85 high, >=0.50 medium, <0.50 low"

issues-created: []

duration: 12min
completed: 2026-04-23
---

# Phase 52 Plan 01: Structured Reasoning Config & Base Service Summary

**Declarative reasoning config with 5-instruction prompt fragments, 3-tier confidence scale, and backward-compatible reasoning fields added to claudeService.js (model updated to claude-sonnet-4-5-20250514)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-23T23:30:00Z
- **Completed:** 2026-04-23T23:42:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `structuredReasoningConfig.js` following the evidenceEnrichmentConfig.js declarative pattern — 5 prompt instruction fragments, 3-tier confidence scale, 4 base reasoning fields, `getConfidenceLevel` helper
- Updated `claudeService.js` default model to `claude-sonnet-4-5-20250514` to match all other services
- Added reasoning instructions to all `buildMortgageAnalysisPrompt` document types
- Enriches JSON responses from Claude with null-default reasoning fields (backward-compatible)
- Updated test suite: 21 tests (added 5 new assertions for reasoning fields and prompt instructions)

## Task Commits

1. **Task 1: Create structuredReasoningConfig.js** — `3f05cbe` (feat)
2. **Task 2: Update claudeService model and reasoning format** — `e558eff` (feat)

## Files Created/Modified

- `backend-express/config/structuredReasoningConfig.js` — Declarative reasoning config: REASONING_FIELDS, CONFIDENCE_SCALE, REASONING_PROMPT_INSTRUCTIONS (5 fragments), getConfidenceLevel helper
- `backend-express/services/claudeService.js` — Updated model, imports reasoning config, appends instructions to prompts, enriches responses
- `backend-express/__tests__/services/claudeService.test.js` — Updated model assertions, added tests for reasoning fields and prompt instruction presence

## Decisions Made

- **Same declarative pattern as evidenceEnrichmentConfig.js** — keeps config consistent and importable as named constants; future services just import the fragment they need
- **Reasoning fields at two levels** — `result.reasoning` (always present with defaults) and merged into `result.content` when content is JSON. Consumers can use either depending on their parsing approach
- **Confidence thresholds (0.85/0.50)** — chosen to mirror evidence quality tiers: direct quotes = high, interpretation = medium, circumstantial = low

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Note: `npm test` in the backend-express directory crashes due to a watchman sandbox permission error (`fchmod` denied). This is a pre-existing environment issue. Tests run correctly with `--no-watchman` flag: all 1686 tests pass.

## Next Phase Readiness

- `structuredReasoningConfig.js` ready to be imported by `documentAnalysisService`, `forensicAnalysisService`, `complianceAnalysisService` in Plans 52-02 through 52-04
- `claudeService.js` is updated and stable — no breaking changes to existing consumers
- Pattern established: import the relevant `REASONING_PROMPT_INSTRUCTIONS` fragment and append to prompt; default `REASONING_FIELDS` to null in response parsing

---
*Phase: 52-structured-reasoning*
*Completed: 2026-04-23*
