---
phase: 38-settings-account-persistence
plan: 01
status: complete
---

# 38-01 Summary: Wire Plaid Connection & Mortgage Account Management

## What was done

### Task 1: Wire Plaid connection in AccountManagementView to PlaidLinkService
- Replaced the `connectPlaidAccount()` demo stub that created a fake `PlaidAccount` with sample data
- Added `@State private var showingPlaidLink` to control sheet presentation
- "Connect Bank Account" button now sets `showingPlaidLink = true` which presents `RealPlaidConnectionView` as a sheet
- Added "Connect Another Account" button when accounts are already connected
- On sheet dismissal, `userStore.refreshData()` is called to sync accounts from the backend
- Removed the entire `connectPlaidAccount()` method and all sample PlaidAccount creation code

### Task 2: Create MortgageAccountManagementView
- Created `MortgageGuardian/Views/Settings/MortgageAccountManagementView.swift` with:
  - `MortgageAccountManagementView`: Lists mortgage accounts from `userStore.user.mortgageAccounts` showing servicer name, loan number, property address, and current balance
  - Swipe-to-delete via `.onDelete` calling `userStore.removeMortgageAccount()`
  - Empty state with descriptive message and "Add Mortgage Account" button
  - `MortgageAccountRow`: Displays individual account details with house icon
  - `AddMortgageAccountView`: Form with fields for servicer name, loan number, property address, original loan amount, interest rate, and loan term. Auto-calculates monthly payment on save.
- Wired SettingsView "Mortgage Accounts" row: replaced TODO with `showingMortgageAccounts = true` and added `.sheet` presenting `MortgageAccountManagementView`
- Added new file to `MortgageGuardian.xcodeproj/project.pbxproj` (file reference, build file, Settings group, Sources build phase)

## Files changed
- `MortgageGuardian/Views/SettingsView.swift` - Wired Plaid connection and mortgage accounts sheets
- `MortgageGuardian/Views/Settings/MortgageAccountManagementView.swift` - New file
- `MortgageGuardian.xcodeproj/project.pbxproj` - Added new file to Xcode project

## Verification
- [x] No TODO comments remain in AccountManagementView.connectPlaidAccount() (method removed entirely)
- [x] No TODO comment on Mortgage Accounts row (replaced with navigation)
- [x] Both sheets wired: RealPlaidConnectionView from AccountManagementView, MortgageAccountManagementView from SettingsView
- [x] No sample/demo data in production paths
