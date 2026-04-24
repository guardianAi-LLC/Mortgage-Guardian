---
phase: 52-structured-reasoning
plan: 04
subsystem: api
tags: [compliance, reasoning, structured-reasoning, legal-analysis, respa, tila, state-law]

# Dependency graph
requires:
  - phase: 52-01
    provides: REASONING_PROMPT_INSTRUCTIONS, getConfidenceLevel, VIOLATION_REASONING_INSTRUCTION, GENERAL_REASONING_INSTRUCTION
  - phase: 51-03
    provides: sourceDocuments, supportingFindings, pageReferences on violations
provides:
  - complianceAnalysisService prompts include VIOLATION_REASONING_INSTRUCTION and GENERAL_REASONING_INSTRUCTION
  - Federal and state violation JSON schemas include reasoningSteps and confidence
  - Narrative prompt includes confidence-aware language guidance
  - _mergeEnhancements maps reasoningSteps, confidence (clamped), confidenceLevel into enhanced violations
affects: [reporting, dashboard, dispute-letters, legal-narrative]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legal reasoning chain: statute requirement → observed behavior → violation → consequence"
    - "Confidence-aware narrative: high (>= 0.85) definitive language, low hedged language"
    - "_mergeEnhancements extended with reasoningSteps/confidence/confidenceLevel alongside existing detailedLegalBasis"

key-files:
  created: []
  modified:
    - backend-express/services/complianceAnalysisService.js
    - backend-express/__tests__/services/complianceAnalysisService.test.js

key-decisions:
  - "detailedLegalBasis preserved (not replaced) — reasoningSteps captures analytical chain, detailedLegalBasis captures citation content; they complement each other"
  - "Narrative prompt receives confidence-aware language guidance but stays markdown prose (no JSON schema)"
  - "confidence clamped to [0,1] in _mergeEnhancements before storing, null when not provided by Claude"

patterns-established:
  - "Reasoning instructions pattern: VIOLATION_REASONING_INSTRUCTION in ## Reasoning Requirements section before ## Instructions in all violation prompts"
  - "GENERAL_REASONING_INSTRUCTION appended before Respond ONLY with valid JSON directive"

issues-created: []

# Metrics
duration: 12min
completed: 2026-04-24
---

# Phase 52 Plan 04: Compliance Analysis Service Reasoning Integration Summary

**VIOLATION_REASONING_INSTRUCTION and GENERAL_REASONING_INSTRUCTION integrated into federal and state violation prompts; narrative prompt gets confidence-aware language guidance; _mergeEnhancements extended with reasoningSteps, confidence, and confidenceLevel**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-24T01:25:00Z
- **Completed:** 2026-04-24T01:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Federal violation prompt (`_buildCompliancePrompt`) now includes `## Reasoning Requirements` section with VIOLATION_REASONING_INSTRUCTION, updated JSON schema with `reasoningSteps` and `confidence` fields, and GENERAL_REASONING_INSTRUCTION before the JSON-only directive
- State violation prompt (`_buildStateViolationPrompt`) receives identical reasoning additions — same structure, same schema fields
- Narrative prompt (`_buildNarrativePrompt`) gets explicit confidence-aware language guidance: high-confidence (>= 0.85) → definitive language, lower → hedged phrasing
- `_mergeEnhancements` maps `reasoningSteps` (default `[]`), `confidence` (clamped 0–1, default `null`), and `confidenceLevel` (via `getConfidenceLevel()`, default `null`) from Claude responses into enhanced violations
- 3 new tests cover: reasoning fields present, reasoning fields absent (defaults), and detailedLegalBasis coexisting alongside reasoningSteps
- All 97 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure violation and narrative prompts with legal reasoning** - `0826c9a` (feat)
2. **Task 2: Update response parsing and tests for reasoning fields** - `7553b56` (test)

## Files Created/Modified
- `backend-express/services/complianceAnalysisService.js` — Added import for REASONING_PROMPT_INSTRUCTIONS/getConfidenceLevel; updated _buildCompliancePrompt, _buildStateViolationPrompt, _buildNarrativePrompt; extended _mergeEnhancements
- `backend-express/__tests__/services/complianceAnalysisService.test.js` — Added 3 reasoning field tests to _mergeEnhancements describe block

## Decisions Made
- **detailedLegalBasis preserved** — reasoningSteps captures the analytical chain (how Claude got to the finding), detailedLegalBasis captures the citation content (what the finding is). They are complementary, not redundant.
- **Narrative stays prose** — confidence-aware language guidance is added as an instruction paragraph; no JSON schema added to the narrative prompt (it returns markdown).
- **Confidence clamped at merge time** — `Math.min(1, Math.max(0, rawConfidence))` ensures stored values are always in [0,1] regardless of what Claude returns.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Phase 52 Plan 05 (next unexecuted plan) is ready to execute
- All 4 analysis services now have VIOLATION/DISCREPANCY/ANOMALY reasoning instructions in their prompts
- complianceAnalysisService is the last of the core analysis services to receive reasoning integration

---
*Phase: 52-structured-reasoning*
*Completed: 2026-04-24*
