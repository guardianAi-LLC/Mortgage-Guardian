# TestFlight Submission Checklist

## Pre-Submission Checklist

### Version and Build Numbers
- [ ] `MARKETING_VERSION` in project.pbxproj matches `CFBundleShortVersionString` in Info.plist
- [ ] `CURRENT_PROJECT_VERSION` in project.pbxproj matches `CFBundleVersion` in Info.plist
- [ ] Build number is incremented from the last TestFlight upload (use `fastlane get_latest_build_number`)
- [ ] Version string follows semantic versioning (MAJOR.MINOR.PATCH)

### App Icons
- [ ] AppIcon asset catalog contains all required sizes (1024x1024 App Store icon included)
- [ ] No alpha channel in App Store icon (1024x1024)
- [ ] Icons render correctly at all sizes

### Privacy Descriptions (Info.plist)
- [ ] `NSCameraUsageDescription` -- mortgage document scanning
- [ ] `NSFaceIDUsageDescription` -- secure authentication
- [ ] `NSPhotoLibraryUsageDescription` -- importing mortgage documents
- [ ] `NSPhotoLibraryAddUsageDescription` -- saving processed documents
- [ ] `NSDocumentsFolderUsageDescription` -- importing documents from Files
- [ ] `NSFileProviderDomainUsageDescription` -- cloud storage access
- [ ] All descriptions are user-friendly and explain the specific use case

### Code Signing
- [ ] Apple Developer Program membership is active
- [ ] Distribution certificate is valid and not expired
- [ ] App Store provisioning profile includes the correct bundle ID (`com.nickgarrison.mortgageguardian`)
- [ ] Team ID matches ExportOptions.plist (`AQ4G5FP8KF`)
- [ ] Automatic signing is configured (or match profiles are up to date)

### Build Verification
- [ ] Archive build succeeds without errors in Xcode
- [ ] No compiler warnings in Release configuration
- [ ] All Swift compilation errors resolved (see Known Build Issues below)
- [ ] No debug-only frameworks linked in Release builds

### App Store Connect
- [ ] App record exists in App Store Connect (use `fastlane setup_app` if needed)
- [ ] Privacy policy URL is set
- [ ] App category is selected
- [ ] Screenshots are prepared for required device sizes

---

## Known Build Issues

All previously known build issues have been resolved:

- ~~DocumentPickerView CameraView init mismatch~~ -- Fixed: using PickerCameraView
- ~~AISetupManager MainActor isolation~~ -- Fixed: wrapped in MainActor.run
- ~~DocumentCaptureViewModel processBatch not found~~ -- Fixed: moved out of #if guard
- **Archive build succeeds** with CODE_SIGNING_ALLOWED=NO (signing required for actual upload)

---

## Fastlane Commands

### First-Time Setup

```bash
# Create App Store Connect record (if needed)
fastlane setup_app

# Setup code signing with match
fastlane setup_signing
```

### Build and Upload to TestFlight

```bash
# Automatic: increments build number, builds, and uploads
fastlane release_beta

# Manual: build and upload with current version numbers
fastlane beta

# Manual build number management
fastlane get_latest_build_number
fastlane set_build_number build_number:42
```

### Testing

```bash
# Run all tests
fastlane test

# Unit tests only
fastlane unit_tests

# Integration tests only
fastlane integration_tests

# Development build (simulator)
fastlane build_dev
```

Reference files:
- `fastlane/Fastfile` -- Lane definitions
- `fastlane/ExportOptions.plist` -- Export configuration (app-store-connect method, automatic signing)

---

## Required Environment Variables

Set these before running fastlane commands:

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `APPLE_KEY_ID` | App Store Connect API Key ID | App Store Connect > Users and Access > Keys |
| `APPLE_ISSUER_ID` | App Store Connect API Issuer ID | App Store Connect > Users and Access > Keys |
| `APPLE_KEY_CONTENT` | App Store Connect API Key (.p8 content) | Downloaded when key was created |
| `PROVISIONING_PROFILE_SPECIFIER` | Provisioning profile name | Apple Developer Portal or match output |
| `MATCH_GIT_URL` | Private git repo for match certificates | Your own private repository |

### Setting Up Environment

```bash
# Option 1: Export in shell
export APPLE_KEY_ID="your-key-id"
export APPLE_ISSUER_ID="your-issuer-id"
export APPLE_KEY_CONTENT="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
export PROVISIONING_PROFILE_SPECIFIER="match AppStore com.nickgarrison.mortgageguardian"
export MATCH_GIT_URL="git@github.com:nick2G/certificates.git"

# Option 2: Use a .env file with dotenv (do NOT commit this file)
# Create fastlane/.env with the variables above
```

---

## Post-Upload Steps

### 1. Wait for Processing
- TestFlight builds typically take 15-30 minutes to process
- The `release_beta` lane uses `skip_waiting_for_build_processing: true` so fastlane will not block
- Check processing status in App Store Connect > TestFlight

### 2. Add Test Notes
- Navigate to App Store Connect > TestFlight > iOS Builds
- Select the new build
- Add "What to Test" notes describing changes in this build
- Include any known limitations or areas needing focused testing

### 3. Export Compliance
- Answer the export compliance question when prompted
- If using only standard HTTPS/TLS encryption, select "No" for custom encryption
- Note: The app uses AES-GCM encryption for sensitive data -- verify export compliance requirements

### 4. Invite Testers
- **Internal Testers**: Add App Store Connect users (up to 100) -- builds are available immediately after processing
- **External Testers**: Create a test group, add external testers (up to 10,000) -- requires Beta App Review (first build only, then automatic for minor updates)

### 5. Verify the Build
- Install on a physical device via TestFlight
- Verify document scanning works
- Verify Plaid bank connection flow
- Verify biometric authentication (Face ID / Touch ID)
- Check that the app does not crash on launch
- Verify all privacy permission prompts appear correctly

---

## Version Bump Workflow

When preparing a new release:

```bash
# 1. Update MARKETING_VERSION in Xcode project settings (or manually in project.pbxproj)
# 2. Update CFBundleShortVersionString in Info.plist to match
# 3. Build number is auto-incremented by release_beta lane
# 4. Run the release
fastlane release_beta
```
