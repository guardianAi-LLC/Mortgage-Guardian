---
phase: 55-upload-security
plan: 02
subsystem: upload-security
status: complete
---

# 55-02 Summary — malwareScanService.scanBuffer (TDD)

## Outcome

Built `backend-express/services/malwareScanService.js` test-first. The
upload route boundary for Phase 55 now has a typed verdict object on
success and a typed `MalwareScanError` on every infrastructure failure
path. No code path resolves as "clean" on error — fail-closed by
construction.

## RED phase

Wrote `backend-express/__tests__/services/malwareScanService.test.js`
covering all six cases from the plan:

| # | Case | Mode | Outcome |
|---|------|------|---------|
| 1 | EICAR buffer → infected verdict | live | skipped (no key) |
| 2 | small clean buffer → clean verdict | live | skipped (no key) |
| 3 | unreachable host → MalwareScanError | offline | failed (no module) |
| 4 | non-Buffer arg → sync TypeError | offline | failed (no module) |
| 5 | empty Buffer → MalwareScanError | offline | failed (no module) |
| 6 | mocked HTTP 401 → MalwareScanError /auth\|401\|key/ | offline | failed (no module) |

Live tests (cases 1, 2) are gated via `describe.skip` on
`process.env.CLOUDMERSIVE_API_KEY` with the documented top-of-file
comment. RED state confirmed by `npx jest …malwareScanService.test.js`:
4 fail with `Cannot find module …malwareScanService`, 2 skip.

RED commit: `29ebfbd` — `test(55-02): add failing tests for malwareScanService.scanBuffer`

## GREEN phase

Implemented `services/malwareScanService.js`. All 4 offline cases pass,
2 live cases skip cleanly.

**Library-path choice: native `fetch` + `FormData` + `Blob`** rather than
`cloudmersive-virus-api-client`. Rationale (also captured in the GREEN
commit body):
- The official client is a Swagger-generated callback wrapper that we
  would immediately re-wrap in a Promise; no contract gain.
- It pulls in superagent + request-derived transitive deps for a single
  HTTP endpoint. Net negative cold-start and footprint cost on Vercel.
- Node 20 (this package's engines floor) provides `fetch`, `FormData`,
  `Blob`, and `AbortSignal.timeout` natively — zero new dependencies.
- No change to `package.json` / `package-lock.json`.

**Key implementation notes:**
- Reads config from `process.env` at first call, not via
  `envValidator.getConfig()`. The validator returns `{}` when
  `NODE_ENV === 'test'`, which would break per-test
  `CLOUDMERSIVE_BASE_URL` overrides (Case 3). In runtime, the validator
  has already validated these same keys at server boot, so the values
  read here are the validated ones.
- Synchronous `TypeError` thrown BEFORE returning the Promise on
  non-Buffer input (Case 4 requires no network call). Implemented via
  a sync guard + delegation to an `async _scanBufferAsync` helper.
- Fail-closed on `Buffer.alloc(0)` before any HTTP call (Case 5
  rationale: Cloudmersive returns `CleanResult: true` for zero bytes;
  treating that as "scanned: true, clean: true" would let an attacker
  round-trip an empty upload past the scan boundary).
- Explicit branches for `401/403` (auth), `429` (rate-limited), `>=500`
  (upstream), `!ok` (other 4xx), invalid JSON body, and missing
  `CleanResult` — every branch throws `MalwareScanError` with a
  triage-friendly message that includes the HTTP status.
- `mapCloudmersiveResponse(json)` exported alongside `scanBuffer` and
  `MalwareScanError` so a future test (or 55-03's route test) can pin
  the mapping in isolation.
- Logging via `createLogger('malware-scan')`: only `bytes`, `clean`,
  `threatCount`, `status`, `errorClass`, `engine`. Never buffer bytes
  or threat-vector strings as a log field.

Verification:
- `npx jest __tests__/services/malwareScanService.test.js --watchman=false`
  → 4 passed, 2 skipped, 0 failed (~0.3s).
- `node --check backend-express/services/malwareScanService.js` → ok.
- `grep -nE "scanned:\\s*false" backend-express/services/malwareScanService.js`
  → 0 matches.
- `grep -nE "buffer\\.toString|buffer\\.slice" backend-express/services/malwareScanService.js`
  → 0 matches.

GREEN commit: `73bc8e5` — `feat(55-02): implement malwareScanService.scanBuffer against Cloudmersive`

## REFACTOR phase

No refactor commit needed. `mapCloudmersiveResponse(json)` was already
factored out during GREEN as a pure helper because the verdict-mapping
branches (clean / infected / malformed) were the only spot that would
have bloated `_scanBufferAsync` and they had a clean pure-function
shape from the start. Extracting it after the fact would have produced
an identical diff. The helper is exported for direct unit testability
in 55-03.

## Live latency observations

Live cases (1, 2) skipped in this run because `CLOUDMERSIVE_API_KEY`
is not set in this worktree's environment (no `.env` file present in
`backend-express/`). The plan's live-latency budget (200–800 ms per
call) therefore could not be measured here.

**Action for 55-03 verification:** set `CLOUDMERSIVE_API_KEY` locally
(per 55-01 setup) and re-run
`npx jest __tests__/services/malwareScanService.test.js` once — the
two `console.log` lines in the live describe will print EICAR and
clean-buffer latencies, which feed 55-03's user-perceived upload-time
budget. If both come in under 1s, the synchronous-scan-in-route
pattern is comfortable; if either exceeds ~3s, 55-03 may want to
return a `202 Accepted` and scan async.

## Commits

| Phase | Hash | Subject |
|-------|------|---------|
| RED | `29ebfbd` | `test(55-02): add failing tests for malwareScanService.scanBuffer` |
| GREEN | `73bc8e5` | `feat(55-02): implement malwareScanService.scanBuffer against Cloudmersive` |
| REFACTOR | — | (none — mapping helper extracted during GREEN) |

## Hand-off note for 55-03

The upload route should call this service like:

```js
const { scanBuffer, MalwareScanError } = require('../services/malwareScanService');

try {
  const verdict = await scanBuffer(fileBuffer);
  if (!verdict.clean) {
    // 422 with generic "file rejected" message; log verdict.threats for ops.
    return res.status(422).json({ error: 'File rejected by security scan' });
  }
  // proceed to storage / processing
} catch (err) {
  if (err instanceof MalwareScanError) {
    // Fail-closed at route boundary. NEVER surface err.message to client —
    // it contains Cloudmersive internals (status codes, "CLOUDMERSIVE_API_KEY",
    // "rate limited", etc.) that aid attacker fingerprinting.
    logger.error('upload scan failed', { errorClass: err.name, message: err.message });
    return res.status(502).json({ error: 'Upload temporarily unavailable' });
  }
  throw err; // unexpected — let the error middleware handle it
}
```

Specifically for 55-03:
- Do NOT catch `MalwareScanError` and proceed; that defeats the entire phase.
- Do NOT include `err.message` in the response body.
- Run the encrypted-PDF gate (`is-pdf-encrypted`) BEFORE calling
  `scanBuffer` so we don't waste a Cloudmersive quota credit on a file
  we're going to reject anyway.
- Consider a per-IP rate limit on the upload route specifically — a
  Cloudmersive quota is finite and expensive to exhaust.

## Deviations

None material. Documented adjustment from the plan:
- Plan example showed `const { getConfig } = require('../utils/envValidator')`
  for config loading. Real path uses `process.env` directly because
  `envValidator.validateEnvironment()` short-circuits to `{}` when
  `NODE_ENV === 'test'` (see `utils/envValidator.js` lines 109–112),
  which would have made Case 3's `CLOUDMERSIVE_BASE_URL` override
  unobservable. Rationale captured inline in the service file.

No `.planning/ISSUES.md` entries created.
