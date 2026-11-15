---
phase: 55-upload-security
plan: 03
subsystem: upload-security
status: complete
---

# 55-03 Summary — Wire scanFileContent + encrypted-PDF + hard-reject route

## Outcome

The Phase 04 `scanFileContent` stub is gone. The upload route is now
fail-closed: a file is only persisted to storage if
`scanned === true && clean === true`. Encrypted PDFs are caught before
they reach Cloudmersive (which would otherwise report them clean because
it cannot read past the encryption layer). Scanner infrastructure errors
return 502 rather than admitting an unscanned file. The visible payoff
of Phase 55 — real malware detection in the upload path — has landed.

## Performance

No perceptible change on the happy path: the synchronous Cloudmersive
call sits inside the existing upload handler with a 15 s timeout
(default from 55-02), gated behind the magic-byte check that already
ran. Encrypted-PDF detection is a constant-time `Buffer.includes` scan.

## Accomplishments

- `scanFileContent(buffer, detectedExt)` now short-circuits encrypted
  PDFs and otherwise delegates to `services/malwareScanService.scanBuffer`.
  `MalwareScanError` propagates — never caught into a "clean" result.
- Upload route (`routes/documents.js`) translates scan outcomes:
  - encrypted PDF → 400 with password-protected message
  - unclean → 400 generic ("This file appears unsafe…"), threats and
    sha256 hash logged server-side under `upload-security` logger
  - `MalwareScanError` → 502 ("Upload could not be safety-checked…")
  - clean → existing storage write path
- Test fixture `__tests__/fixtures/encrypted-sample.pdf` (963 B,
  password `a`, generated via `qpdf --empty --pages . -- blank.pdf` then
  `qpdf --encrypt 'a' 'a' 256 -- blank.pdf encrypted-sample.pdf`).
- Four new integration tests under "malware scanning" describe block:
  1. **EICAR test signature returns 400 with generic rejection message**
     — mocks `scanBuffer` to return `clean: false`, asserts exact body
     and that `documentService.uploadDocument` was not called.
  2. **password-protected PDF returns 400 with encrypted-pdf message**
     — uses the real fixture, asserts the scanner was *not* invoked
     (short-circuit) and no storage call.
  3. **MalwareScanError returns 502 with retry message** — mocks
     `scanBuffer` to throw, asserts the 502 body and no storage call.
  4. **clean file passes scan and reaches storage** — default mock
     clean verdict, asserts 201 + 1 scan + 1 storage call.

## Task commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | `1c16f85` | feat(55-03): replace scanFileContent stub with real malware scan |
| 2 | `3666529` | feat(55-03): fail-closed malware scan in upload route |
| 3 | `5b8c56f` | test(55-03): cover EICAR, encrypted PDF, scan-error, clean paths |

## Files modified

- `backend-express/utils/fileValidation.js` — stub deleted, real
  `scanFileContent` + inline `isPdfEncryptedBuffer` helper added.
- `backend-express/routes/documents.js` — upload handler gated on
  scan verdict, sha256 telemetry via `crypto.createHash`.
- `backend-express/__tests__/routes/documents-upload-security.test.js`
  — new mock for `services/malwareScanService`, default-clean
  beforeEach, four new tests.
- `backend-express/__tests__/routes/documents-routes.test.js` — added
  the same malwareScanService mock so the 500-error test for storage
  failures keeps returning 500 rather than 502.
- `backend-express/__tests__/fixtures/encrypted-sample.pdf` — new
  fixture (963 B, password `a`).
- `backend-express/package.json` / `package-lock.json` — net unchanged
  (is-pdf-encrypted added in Task 1 then removed in Task 3; see
  deviation below).
- `.planning/ISSUES.md` — ISS-004 logged.

## Decisions

- **Threat names are never echoed to the client.** Body is the fixed
  string `"This file appears unsafe and was not accepted."`. Threat
  list and sha256 hash of the buffer are logged server-side under
  `createLogger('upload-security')`.
- **`scanned: false` is reserved for "we deliberately did not scan."**
  Only the encrypted-PDF branch returns that shape, and the route
  treats it as a hard rejection.
- **Magic-byte detection result is reused.** The `validateFileContent`
  call already returns `detectedType.ext`; that value is threaded into
  `scanFileContent` instead of sniffing the buffer a second time.

## Deviations

- **`is-pdf-encrypted` package unusable in Node.** The plan called for
  `is-pdf-encrypted@^1.1.0`, which I installed (Task 1) before
  discovering its implementation depends on the browser-only
  `FileReader` global and crashes immediately when required in Node.
  Replaced with a four-line inline check that scans the buffer for the
  PDF `/Encrypt` marker — the exact heuristic that package documents.
  The package was uninstalled in Task 3; net change to `package.json`
  is zero. Logged as `ISS-004` for future revisit if false positives
  surface in production (a malformed file containing the literal
  string `/Encrypt` outside an encryption dictionary would be
  misclassified).

## Issues encountered

- One pre-existing test failure remains in `__tests__/services/`
  (`financialSecurityService` and `vendorNeutralSecurityService`
  cannot load — missing `./credentials` submodule). Confirmed
  unrelated to 55-03 via `git stash` before the run; documented here
  so it isn't re-investigated.
- `documents-routes.test.js` needed a new `malwareScanService` mock
  because its generic "upload throws" test was now reaching the real
  scanner (no key in test env → `MalwareScanError` → 502 instead of
  the expected 500). Patched in Task 3 commit.

## Verification

- `cd backend-express && npm test -- --watchman=false` →
  `61 passed, 2 failed (pre-existing, unrelated)`, `1675 passed`
  tests overall (10 skipped).
- `documents-upload-security.test.js` alone → `23/23` pass.
- `grep -nE "scanned:\s*false" backend-express/utils/fileValidation.js`
  → only the encrypted-PDF runtime branch + docblock references.
- `node --check` clean on both modified source files.

## Next phase readiness

Plan 55-04 is the closeout: docs + runbook for the new scanning
behaviour, env-var documentation (`CLOUDMERSIVE_*` already wired in
55-01), and roadmap close. Implementation work for Phase 55 is
complete with this plan.

---

*Phase 55, plan 3 of 4 complete — 2026-06-11*
