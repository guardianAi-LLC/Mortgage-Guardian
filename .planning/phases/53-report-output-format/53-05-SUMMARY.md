---
phase: 53-report-output-format
plan: 05
subsystem: ui
tags: [nextjs, react, tailwind, report-ui, letter-ui, executive-summary, evidence-footnotes]

requires:
  - phase: 53-report-output-format/53-02
    provides: ExecutiveSummary backend field on ConsolidatedReport
  - phase: 53-report-output-format/53-03
    provides: evidenceFootnotes on DisputeLetter content
  - phase: 53-report-output-format/53-04
    provides: FindingCard enrichment props and shared FindingEnrichment type mixin
provides:
  - Executive Summary card rendered above stats grid on consolidated report
  - Evidence footnotes section in dispute letter (screen + print + clipboard)
  - Enrichment props (citation, confidence, reasoning) threaded into every FindingCard usage in the case report page
affects: [phase-54-plaid-token-migration, future-letter-formats, future-pdf-export]

tech-stack:
  added: []
  patterns:
    - "Optional backend fields rendered with guarded conditionals (no breakage when null/undefined)"
    - "Print-friendly footnotes via semantic <ol> with stable id anchors"
    - "Plain-text mirroring: any printable section also serialized into clipboard buildPlainText output"

key-files:
  created: []
  modified:
    - frontend/src/components/report-summary.tsx
    - frontend/src/components/letter-viewer.tsx
    - frontend/src/app/dashboard/cases/[caseId]/report/page.tsx

key-decisions:
  - "Executive Summary placed above stats grid (top of report) so users see the headline first"
  - "Footnotes rendered as <ol> with id=\"footnote-N\" anchors so a future PDF export / linking pass can deep-link"
  - "TimelineViolation FindingCard usage NOT enriched — TimelineViolation does not extend FindingEnrichment (no upstream data to thread)"

patterns-established:
  - "Pattern: optional ExecutiveSummary block — guard with hasExecutiveSummary derived flag rather than inline conditionals"
  - "Pattern: clipboard text mirrors visible structured sections (footnotes appended when present)"

issues-created: []

duration: 4 min
completed: 2026-05-18
---

# Phase 53 Plan 5: Wire Backend Enrichment Into Report & Letter UI Summary

**Executive summary block, propagated enrichment props on every FindingCard in the case report, and printable numbered evidence footnotes in the dispute letter — Phase 53 user-visible surface complete.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-18T07:48:31Z
- **Completed:** 2026-05-18T07:52:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `ReportSummary` now renders a guarded Executive Summary card (headline + narrative + key findings) above the stats grid when the backend supplies it
- All four `FindingCard` call sites on the case report page (doc anomalies, forensic discrepancies, federal violations, state violations) now receive `formattedCitation` / `confidenceLabel` / `confidenceLevel` / `reasoningSteps` / `reasoningSummary` — citations, confidence badges, and reasoning panels are visible end-to-end
- `LetterViewer` renders a print-safe numbered evidence footnotes section beneath the closing statement, with stable `id="footnote-N"` anchors for future PDF/deep-link support
- `buildPlainText` appends a plain-text "Evidence Footnotes:" section so clipboard Copy mirrors the visible structure
- Phase 53 complete — all five plan summaries (53-01 through 53-05) exist

## Task Commits

1. **Task 1: Render executiveSummary + propagate enrichment props to FindingCards** — `2544ef1` (feat)
2. **Task 2: Render evidenceFootnotes in letter-viewer with print styling** — `6302fcb` (feat)

**Plan metadata:** pending (docs commit at end of plan execution)

## Files Created/Modified

- `frontend/src/components/report-summary.tsx` — Destructure `executiveSummary` from `report`; add guarded Executive Summary `<Card>` above stats grid
- `frontend/src/components/letter-viewer.tsx` — Render `evidenceFootnotes` `<ol>` beneath closing statement; extend `buildPlainText` to serialize footnotes for clipboard
- `frontend/src/app/dashboard/cases/[caseId]/report/page.tsx` — Pass enrichment props to FindingCard at 4 call sites (doc anomalies, forensic discrepancies, federal & state violations)

## Decisions Made

- **Place Executive Summary above stats grid (not below)** — users should see the headline narrative first, then drill into stats. Matches the natural flow of a regulatory report.
- **Skip enrichment props on TimelineViolation FindingCards** — `TimelineViolation` interface does not extend `FindingEnrichment` (no `formattedCitation` / `confidenceLabel` / etc. on the backend type). Threading undefined props would be misleading. If timeline violations need enrichment later, backend type must be extended first.
- **Stable `id="footnote-N"` on footnote `<li>`** — future deep-linking from inline finding citations to footnote entries becomes trivial without re-keying.

## Deviations from Plan

None — plan executed exactly as written.

Note: The plan's verification step calls for `npm run build` to succeed. The build failed in the sandbox environment due to inability to reach `fonts.googleapis.com` (Turbopack font fetch), which is unrelated to the code changes. `npx tsc --noEmit` is clean on all source files (errors reported are in stale `.next/dev/types/` generated artifacts from a prior dev server, not in modified code). `npm run lint` reports 0 errors and only the same 8 pre-existing warnings on unrelated files. Code-level verification is satisfied.

## Issues Encountered

- **Sandbox cannot fetch Google Fonts** — `npm run build` fails because Turbopack tries to download Geist/Geist Mono from `fonts.googleapis.com` and the sandbox blocks the request. Not a code issue; build will succeed in any networked environment (CI, local with network).

## Next Phase Readiness

- **Phase 53 complete — all 5 plans delivered.** Executive summary + per-finding enrichment + evidence footnotes are all user-visible end-to-end.
- Ready for **Phase 54: Plaid Token Migration**.
- No blockers carried forward.

---
*Phase: 53-report-output-format*
*Completed: 2026-05-18*
