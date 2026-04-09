---
phase: 38-settings-account-persistence
plan: 02
status: complete
---

## What was done

### Task 1: Document retention settings picker
- Added `@State showingRetentionPicker` to `SettingsView`
- Replaced Document Retention TODO with action that opens a sheet
- Created `DocumentRetentionView` (private struct in same file) with six preset options: 30 Days, 90 Days, 180 Days, 1 Year, 2 Years, Forever
- Selection updates `userStore.user.preferences.documentRetentionDays` via `userStore.updatePreferences()`
- Subtitle now shows human-readable label (e.g., "1 Year") instead of raw day count
- Footer text explains retention behavior

### Task 2: Data export and account deletion
- **Export Data**: `exportUserData()` serializes profile, mortgage accounts, audit results, and documents into a JSON dictionary, writes to a temp file, and presents via `ShareUtility.presentShareSheet(items:)`. Respects `requireAuthForExport` by gating on LAContext biometric evaluation.
- **Delete Account**: Added `showingDeleteConfirmation` state with a destructive `.alert`. On confirm, `deleteAccount()` clears SwiftData via `DataManager().clearAllData()`, deletes all keychain entries via `CredentialManager`, resets `UserStore` to defaults, and signs out via `AuthManager`.
- **UserStore.resetToDefaults()**: New method that resets user to `User.sampleUser`, clears documents, auditResults, transactions, plaidAccounts, and errorMessage.

## Files changed
- `MortgageGuardian/Views/SettingsView.swift` -- retention picker, export, delete account
- `MortgageGuardian/Store/UserStore.swift` -- added `resetToDefaults()`

## Verification
- [x] No TODO comments remain in Data & Privacy section
- [x] Document retention picker with 6 preset options
- [x] exportUserData() produces JSON via ShareUtility
- [x] Delete account shows destructive confirmation alert
- [x] Account deletion clears SwiftData, keychain, UserStore, and signs out
