# 55-03 Summary — Stub Replaced, Route Wired, Tests Expanded

**Completed:** 2026-06-21

## What was done

### Task 1: Replace scanFileContent stub (fileValidation.js)
- Installed `is-pdf-encrypted@1.1.0`
- Deleted Phase 04-03 stub (lines 220–260)
- New `scanFileContent(buffer, detectedExt)`:
  - If `detectedExt === 'pdf'`: checks `isPdfEncrypted(buffer)` before scanning
  - Encrypted PDF → `{ scanned: false, clean: false, reason: 'encrypted_pdf', message: '...' }` (no API call)
  - Otherwise: calls `scanBuffer(buffer)` from malwareScanService; re-throws `MalwareScanError`
  - Clean → `{ scanned: true, clean: true, threats: [], engine: 'cloudmersive' }`
  - Malware → `{ scanned: true, clean: false, threats: [...], engine: 'cloudmersive' }`
- `MalwareScanError` re-exported from fileValidation module for route convenience

### Task 2: Wire upload route to fail-closed (documents.js)
- Added `crypto` and `MalwareScanError` imports at top
- Inserted scan gate after `validateFileContent`, before `documentService.uploadDocument`:
  - `MalwareScanError` with `status === 429` → 502 + `reason: 'scan_quota_exhausted'` log
  - `MalwareScanError` otherwise → 502 + `reason: 'scan_unavailable'` log
  - Encrypted PDF result → 400 with plain-English message
  - Malware result → 400 + SHA-256 hash logged (never the buffer content)
  - Only reaches storage when scan conclusively returns `clean: true`

### Task 3: Expand test suite
- Mocked `malwareScanService` and `is-pdf-encrypted` globally (clean defaults, per-test overrides)
- Added 5 new test cases under "malware scan gate (Phase 55)" describe block:
  1. EICAR → 400, no storage call
  2. Encrypted PDF (mocked isPdfEncrypted=true) → 400, no scan call, no storage call
  3. Generic scan error → 502, scan_unavailable
  4. Cloudmersive 429 → 502, scan_quota_exhausted
  5. Clean file → 201, uploadDocument called once
- Created `__tests__/fixtures/encrypted-sample.pdf` (332-byte minimal encrypted PDF fixture)
- **All 24 tests pass** (19 existing + 5 new)

## Files changed
- `backend-express/utils/fileValidation.js` — stub replaced, imports added, MalwareScanError re-exported
- `backend-express/routes/documents.js` — crypto + MalwareScanError imports, scan gate added
- `backend-express/__tests__/routes/documents-upload-security.test.js` — mocks + 5 new tests
- `backend-express/__tests__/fixtures/encrypted-sample.pdf` — new fixture
- `backend-express/package.json` + `package-lock.json` — is-pdf-encrypted@1.1.0 added
