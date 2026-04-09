---
phase: 38-settings-account-persistence
plan: 03
status: complete
started: 2026-04-09
completed: 2026-04-09
---

## Summary

Created Help & FAQ view, implemented support actions, and fixed placeholder URLs in AppInfoView.

## What Was Done

### Task 1: Help & FAQ View
- Created `MortgageGuardian/Views/Settings/HelpFAQView.swift` with 8 mortgage-specific FAQ items
- Used `DisclosureGroup` for expandable question/answer pairs covering document upload, error detection, bank verification, RESPA letters, data security, and more
- Added "Still need help?" section with contact support button (mailto: link)
- Wired into SettingsView via `@State showingHelp` and `.sheet` presentation
- Added file reference, Settings group, and build file to `project.pbxproj`

### Task 2: Support Actions & About URLs
- **contactSupport()**: Opens mailto: link to support@mortgageguardian.com with pre-filled subject
- **rateApp()**: Uses `SKStoreReviewController.requestReview(in:)` for native App Store review prompt
- **AppInfoView URLs**: Replaced `example.com` placeholders with `mortgageguardian.com/privacy`, `/terms`, `/licenses`
- **Version/Build**: Now read dynamically from `Bundle.main.infoDictionary` (CFBundleShortVersionString / CFBundleVersion) with fallback defaults

## Verification
- [x] No TODO comments remain in Support section
- [x] No example.com URLs remain in AppInfoView
- [x] Help & FAQ view has 8 expandable items
- [x] StoreKit imported for SKStoreReviewController

## Files Changed
- `MortgageGuardian/Views/Settings/HelpFAQView.swift` (new)
- `MortgageGuardian/Views/SettingsView.swift` (modified)
- `MortgageGuardian.xcodeproj/project.pbxproj` (modified)
