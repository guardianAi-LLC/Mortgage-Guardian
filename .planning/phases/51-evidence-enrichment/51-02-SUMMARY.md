---
phase: 51-evidence-enrichment
plan: 02
subsystem: api
tags: [claude-ai, evidence, forensic, cross-document, comparison, prompt-engineering]

# Dependency graph
requires:
  - phase: 13-cross-document-forensic-analysis
    provides: crossDocumentComparisonService with type-specific forensic prompts
  - phase: 51-evidence-enrichment/01
    provides: evidenceEnrichmentConfig with ENRICHMENT_PROMPT_INSTRUCTIONS
provides:
  - Enriched crossDocumentComparisonService with per-document pageNumber, quotedText, documentName, documentType on discrepancies
  - Enriched timeline events with documentName
  - Enriched timeline violations with relatedDocumentNames
  - Aggregation service passes documentName through comparison pairs
affects: [51-03, 51-04, 51-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-document evidence fields on cross-document discrepancies (pageNumber, quotedText, documentName, documentType)"
    - "Document metadata propagation from aggregation through comparison pipeline"

key-files:
  created: []
  modified:
    - backend-express/services/crossDocumentComparisonService.js
    - backend-express/services/crossDocumentAggregationService.js
    - backend-express/__tests__/services/crossDocumentComparisonService.test.js
    - backend-express/__tests__/services/crossDocumentAggregationService.test.js

key-decisions:
  - "Evidence fields default to null when Claude doesn't provide them -- backward compatible"
  - "quotedText truncated to 500 chars in parsing layer, not prompt layer"
  - "documentName sourced from doc.name || doc.file_name with fallback to 'Document {id}'"
  - "GENERAL_EVIDENCE_INSTRUCTION added to system prompt; DISCREPANCY_EVIDENCE_INSTRUCTION in user prompt"

patterns-established:
  - "docMetadataById lookup pattern for enriching timeline events/violations with document names"
  - "documentName propagation: Supabase record -> aggregation normalized doc -> comparison pair -> discrepancy"

issues-created: []

# Metrics
duration: 10min
completed: 2026-04-23
---

# Phase 51 Plan 02: Cross-Document Comparison Evidence Enrichment Summary

**Enriched crossDocumentComparisonService to produce discrepancies with per-document evidence (pageNumber, quotedText, documentName, documentType) and updated aggregation service to propagate document metadata through comparison pipeline**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-24T02:24:57Z
- **Completed:** 2026-04-24T02:33:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Enriched crossDocumentComparisonService prompts with DISCREPANCY_EVIDENCE_INSTRUCTION and GENERAL_EVIDENCE_INSTRUCTION
- Updated JSON output schema in prompts to include pageNumber and quotedText per document side
- Response parsing captures pageNumber, quotedText with null defaults and 500-char truncation
- Discrepancies enriched with documentName and documentType from input document objects
- Timeline events enriched with documentName
- Timeline violations enriched with relatedDocumentNames
- Aggregation service now includes documentName in normalized documents and comparison pairs
- Fallback to "Document {id}" when name fields unavailable
- Added 11 new tests (66 total, 0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich crossDocumentComparisonService prompts and response parsing** - `277a391` (feat)
2. **Task 2: Pass document metadata through aggregation and update tests** - `991e95b` (feat)

## Files Modified
- `backend-express/services/crossDocumentComparisonService.js` - Evidence fields in prompts and response parsing
- `backend-express/services/crossDocumentAggregationService.js` - documentName in normalized docs and comparison pairs
- `backend-express/__tests__/services/crossDocumentComparisonService.test.js` - 9 new tests for evidence fields
- `backend-express/__tests__/services/crossDocumentAggregationService.test.js` - 3 new tests for documentName, 2 updated structure tests

## Decisions Made
- Evidence fields default to null when Claude doesn't provide them -- ensures backward compatibility
- quotedText truncated at 500 chars in the parsing layer (not the prompt) -- enforcement regardless of Claude compliance
- documentName sourced from doc.name || doc.file_name || "Document {id}" -- never undefined
- GENERAL_EVIDENCE_INSTRUCTION in system prompt, DISCREPANCY_EVIDENCE_INSTRUCTION in user prompt after comparison instructions

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Cross-document comparison pipeline now produces evidence-rich discrepancies
- documentName propagation pattern established for Plans 03-05
- Ready for 51-03 to apply same evidence enrichment to forensicAnalysisService

---
*Phase: 51-evidence-enrichment*
*Completed: 2026-04-23*
