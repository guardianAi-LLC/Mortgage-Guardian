---
phase: 47-settings-account
plan: 02
subsystem: ui
tags: [react, data-export, account-deletion, clerk, sonner]

requires:
  - phase: 47-settings-account
    provides: Settings page with profile and notifications (47-01)
provides:
  - Data export as JSON download
  - Account deletion with type-to-confirm
affects: [47-03]

tech-stack:
  added: []
  patterns: [Blob download pattern, type-to-confirm deletion dialog]

key-files:
  created: []
  modified:
    - frontend/src/app/dashboard/settings/page.tsx

key-decisions:
  - "JSON export via Blob+createObjectURL — no server endpoint needed"
  - "Account deletion signs out via Clerk — actual data purge would need backend endpoint"

patterns-established:
  - "downloadJson helper for browser file downloads"
  - "Type-to-confirm pattern for destructive actions"

issues-created: []

duration: 2min
completed: 2026-04-15
---

# Phase 47 Plan 02: Data Export & Account Deletion Summary

**JSON data export download and account deletion with type-to-confirm dialog**

## Performance

- **Duration:** 2 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Data Export section with "Export All Data" button — downloads cases+documents as timestamped JSON
- Danger Zone section with red-tinted card
- Delete Account dialog requiring typing "DELETE" to confirm
- Sign out via Clerk on deletion with success toast

## Task Commits

1. **Task 1+2: Data export and account deletion** - `eb1ee34` (feat)

## Files Created/Modified
- `frontend/src/app/dashboard/settings/page.tsx` - Data export section + danger zone section

## Decisions Made
- Client-side JSON export (no server endpoint) — data already fetched via hooks
- Sign out only on deletion — backend data purge endpoint not implemented yet

## Deviations from Plan
None

## Issues Encountered
None

## Next Phase Readiness
- Ready for 47-03 (Polish and human verification)

---
*Phase: 47-settings-account*
*Completed: 2026-04-15*
