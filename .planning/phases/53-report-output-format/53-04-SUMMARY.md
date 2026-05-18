---
phase: 53-report-output-format
plan: 04
subsystem: frontend
tags: [typescript, react, shadcn, tailwind, types, finding-card]

# Dependency graph
requires:
  - phase: 51-evidence-enrichment
    provides: enriched evidence shape (sourceDocument, pageReference, quotedText, documentA/B, sourceDocuments, supportingFindings, pageReferences)
  - phase: 52-structured-reasoning
    provides: reasoningSteps, confidence, confidenceLevel on every finding
  - phase: 53-01
    provides: canonical citation/reasoning/confidence label string contracts
  - phase: 53-02
    provides: executiveSummary on report + per-finding formattedCitation/reasoningSummary/confidenceLabel
  - phase: 53-03
    provides: evidenceFootnotes[] on dispute letter content
provides:
  - frontend TypeScript types mirroring the full enriched backend schema (FindingEnrichment mixin pattern)
  - reusable enrichment primitives (SourceDocumentRef, PageReference, SupportingFinding, EvidenceFootnote, ExecutiveSummary, DiscrepancyDocumentEvidence)
  - finding-card UI surfaces: confidence Badge, "Source" citation footer (monospace), collapsible <details> reasoning disclosure
  - backward-compatible component contract — all new props optional, all 9 existing FindingCard consumers compile unchanged
affects: [53-05-frontend-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FindingEnrichment mixin interface extended into each finding type (Anomaly, Discrepancy, Violation) rather than duplicating fields per shape
    - Native <details>/<summary> for progressive disclosure (no extra deps, dark-theme styled, accessible)
    - Confidence color scale (green/yellow/orange) parallels but is intentionally distinct from severity scale

key-files:
  created: []
  modified:
    - frontend/src/lib/types.ts
    - frontend/src/components/finding-card.tsx

key-decisions:
  - "Reconciled plan-spec names ForensicDiscrepancy/ComplianceViolation against existing frontend names Discrepancy/Violation — extended existing types rather than introducing duplicate type names, per plan's RECONCILE-don't-duplicate rule"
  - "Confidence color ramp green/yellow/orange chosen distinct from severity ramp (red/orange/yellow/blue/gray) so both badges can render side-by-side without visual collision"
  - "Reasoning disclosure uses native <details> instead of shadcn Collapsible to avoid pulling in a new client component dependency for a read-only display"

patterns-established:
  - "FindingEnrichment mixin pattern: optional Phase 51/52/53 fields live on a single shared interface that finding-shaped types extend, keeping additions in one place when new enrichment fields ship"
  - "Citation footer + collapsible reasoning + confidence badge: a reusable 3-part visual contract for any finding card in the system"

issues-created: []

# Metrics
duration: 4m
completed: 2026-05-18
---

# Phase 53 Plan 04: Frontend Evidence and Reasoning Display Summary

**Frontend TypeScript types mirror full enriched backend schema via a FindingEnrichment mixin, and finding-card surfaces confidence badges, source citation footers, and collapsible reasoning chains — all backward-compatible with the 9 existing FindingCard consumers.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-18T06:07:17Z
- **Completed:** 2026-05-18T06:11:46Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added `FindingEnrichment` mixin interface in `frontend/src/lib/types.ts` consolidating Phase 51 evidence (`pageReference`, `quotedText`, `sourceDocument`), Phase 52 reasoning (`reasoningSteps`, `confidence`, `confidenceLevel`), and Phase 53 derived display strings (`formattedCitation`, `reasoningSummary`, `confidenceLabel`) into a single optional contract.
- Extended `Anomaly`, `Discrepancy`, and `Violation` to inherit `FindingEnrichment` via `extends`; also added per-document evidence (`documentA`/`documentB`), `sourceDocuments`/`supportingFindings`/`pageReferences`, and legacy `sourceDocumentIds` to align with backend schema.
- Added `EvidenceFootnote[]` on `DisputeLetter.content`, `ExecutiveSummary` on `ConsolidatedReport`, and reusable primitives (`SourceDocumentRef`, `PageReference`, `SupportingFinding`, `DiscrepancyDocumentEvidence`, `ConfidenceLevel` type alias).
- Extended `EvidenceLink` with optional `sourceDocumentNames`, `pageReferences`, `supportingFindingIds`.
- Rewrote `finding-card.tsx` to render (a) a confidence Badge alongside severity when `confidenceLabel` provided, with green/yellow/orange tone keyed by `confidenceLevel`; (b) a monospaced "Source" citation footer when `formattedCitation` provided; (c) a collapsible native `<details>` "Reasoning" disclosure rendering `reasoningSteps` as an ordered list, falling back to `reasoningSummary` paragraph.
- All new component props optional — all 9 existing `<FindingCard ... />` call sites in `dashboard/cases/[caseId]/{report,analysis}/page.tsx` compile and behave unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend frontend TypeScript types with enrichment + display fields** — `84aa74d` (feat)
2. **Task 2: Update finding-card with citation footer, confidence badge, reasoning disclosure** — `6ca538f` (feat)

## Files Created/Modified

- `frontend/src/lib/types.ts` — added `FindingEnrichment` mixin and 6 supporting types; extended `Anomaly`/`Discrepancy`/`Violation`/`EvidenceLink`/`DisputeLetter.content`/`ConsolidatedReport` with optional enrichment + display fields (100 insertions, 3 deletions).
- `frontend/src/components/finding-card.tsx` — added `confidenceStyles` ramp; rendered confidence Badge, citation footer, and `<details>`-based reasoning disclosure; preserved existing `details` key/value tail block (68 insertions, 7 deletions; final file 119 lines, no new imports).

## Decisions Made

- **Reconciled type names with existing frontend conventions.** Plan referenced `ForensicDiscrepancy` and `ComplianceViolation` but the frontend already exports `Discrepancy` and `Violation`. Per the plan's "RECONCILE rather than duplicate" rule, extended the existing names — avoided introducing parallel type names that would diverge.
- **Distinct confidence color ramp.** Used green/yellow/orange for confidence rather than reusing severity's red/orange/yellow/blue/gray, so the two badges render side-by-side without visual collision (severity = how bad, confidence = how sure).
- **Native `<details>` for reasoning disclosure.** Avoided pulling in shadcn Collapsible (which would force a `'use client'` boundary and a Radix dependency) since reasoning is a read-only progressive-disclosure block — native element is accessible, dark-theme styleable, and zero-cost.

## Deviations from Plan

None — plan executed exactly as written, with the single reconciliation noted under Decisions (the plan explicitly anticipated and authorized name reconciliation).

## Issues Encountered

None. TypeScript `tsc --noEmit` produces zero errors in `src/` (pre-existing errors in `.next/dev/types/` auto-generated Next.js artifacts are unrelated and exist on `main` independently of these changes). `eslint` clean on both modified files.

## Next Phase Readiness

- 53-05 (frontend report-page wiring) can now consume the new types directly via `@/lib/types` and pass the enriched fields through to `<FindingCard>` without further type plumbing.
- All 9 existing FindingCard call sites are backward-compatible — they can opt in to the new props incrementally.
- No blockers.

---
*Phase: 53-report-output-format*
*Completed: 2026-05-18*
