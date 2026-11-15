---
phase: 55-upload-security
plan: 01
subsystem: api
tags: [malware-scanning, cloudmersive, vercel, env-validation]

requires:
  - phase: 55-upload-security (CONTEXT + RESEARCH)
    provides: scan-engine landscape, fail-closed design constraints
provides:
  - Cloudmersive as the recorded scan host for Phase 55
  - CLOUDMERSIVE_API_KEY in Vercel envs (Production + Preview)
  - envValidator awareness of CLOUDMERSIVE_API_KEY / _BASE_URL / _TIMEOUT_MS
  - .env.example documentation of the three keys
affects: [55-02-malwareScanService, 55-03-route-wiring, 55-04-closeout]

tech-stack:
  added: [Cloudmersive Virus Scan API account/key]
  patterns: [hosted-HTTPS-scan-engine-via-vercel-env]

key-files:
  modified:
    - backend-express/utils/envValidator.js
    - backend-express/.env.example
  created: []

key-decisions:
  - "Backend deploys to Vercel only (not Railway as originally assumed). Replanned Phase 55 from ClamAV-sidecar path to Cloudmersive hosted HTTPS API."
  - "Cloudmersive sync /virus/scan/file endpoint is the scan host for Phase 55. ClamAV-on-Railway parked for a future phase."
  - "CLOUDMERSIVE_API_KEY missing → feature warning + upload route fails closed (502). No silent dev bypass."

patterns-established:
  - "Hosted scan engine: external HTTPS API called sync from the Vercel function. No daemons, no sidecars."
  - "Env-driven config via getConfig(): services read cloudmersiveApiKey/Url/TimeoutMs from the frozen singleton, never process.env directly."

issues-created: []

duration: ~30 min
completed: 2026-06-10
---

# Phase 55 Plan 01: Cloudmersive Scan-Host Setup Summary

**Cloudmersive registered as Phase 55's scan engine, API key live in Vercel Production + Preview, and the boot-time env validator now recognizes the three CLOUDMERSIVE_* keys — replan from the original Railway/ClamAV path.**

## Performance

- **Duration:** ~30 min (incl. mid-execution replan)
- **Completed:** 2026-06-10
- **Tasks:** 2 of 3 executed; Task 3 deferred (rationale below)
- **Files modified:** 2

## Accomplishments

- **Decision (Task 1):** scan host = Cloudmersive hosted HTTPS API. The original plan assumed a Railway sidecar; discovered during execution that the backend deploys to Vercel only (no Railway project). All four plans in this phase were rewritten to match — see commit `6bbb444`.
- **Env wiring (Task 2):** `backend-express/utils/envValidator.js` now recognizes `CLOUDMERSIVE_API_KEY` (feature, warns when missing), `CLOUDMERSIVE_BASE_URL` (default `https://api.cloudmersive.com`), and `CLOUDMERSIVE_TIMEOUT_MS` (default 15000, capped 1–60s). Exposed on the frozen config singleton as `cloudmersiveApiKey/Url/TimeoutMs` so 55-02's scan service can read via `getConfig()`.
- **Documentation:** `.env.example` has a new `MALWARE SCANNING (Cloudmersive)` block explaining the three keys and the no-silent-dev-bypass policy.
- **Vercel envs:** `vercel env ls` confirms `CLOUDMERSIVE_API_KEY` is set in Production + Preview scopes. Development scope is **NOT** set — see "Next Phase Readiness".

## Task Commits

1. **Replan all four 55 plans (mid-execution)** — `6bbb444` (docs)
2. **Task 2: wire CLOUDMERSIVE_* into validator + .env.example** — `eaecdef` (feat)

Task 1 was a decision-checkpoint (no code). Task 3 was a human-verify checkpoint — deferred (see below).

## Files Created/Modified

- `backend-express/utils/envValidator.js` — added CLOUDMERSIVE_API_KEY / _BASE_URL / _TIMEOUT_MS to schema; featureWarning when key missing; exported on config singleton.
- `backend-express/.env.example` — new "Malware Scanning (Cloudmersive)" block documenting the three keys.
- All four `55-0{1,2,3,4}-PLAN.md` files rewritten from ClamAV/Railway shape to Cloudmersive shape (commit `6bbb444`).

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Replan Phase 55 mid-execution: ClamAV/Railway → Cloudmersive | Backend deploys to Vercel only; Vercel cannot host a persistent clamd daemon. Cloudmersive sync HTTPS API was the documented fallback path in 55-RESEARCH.md. |
| 2 | Free vs Production Cloudmersive tier | (operator choice during account creation; recorded in dashboard, not in plan files) |
| 3 | Defer live-fire EICAR proof to 55-02 (Task 3 of this plan) | Two attempts to live-fire from this session were blocked by safety guards (correctly — production secrets shouldn't traverse the transcript). 55-02's TDD plan already runs EICAR + clean buffer against Cloudmersive as live test cases gated on `CLOUDMERSIVE_API_KEY` presence, so the same signal lands one plan later. |

## Deviations from Plan

### Auto-handled

**1. [Rule 4 - Architectural] Mid-execution replan from Railway/ClamAV to Cloudmersive**

- **Found during:** Task 2 of original plan (attempting to provision Railway service)
- **Issue:** Backend not deployed to Railway. CLAUDE.md said "deployable to Vercel, Railway, or other platforms" but only Vercel is actually live.
- **Fix:** Surfaced the discovery to user; user picked Cloudmersive (RESEARCH.md's fallback path) over migrating backend to Railway. Three subagents rewrote 55-02 / 55-03 / 55-04 in parallel for the new engine; 55-01 was rewritten in main.
- **Files modified:** all four `55-0*-PLAN.md`
- **Verification:** `grep -niE "clamav|clamd|clamscan|railway" .planning/phases/55-upload-security/` returns only intentional replan-history references.
- **Commit:** `6bbb444`

### Deferred

- **Task 3 (live-fire EICAR proof against Cloudmersive)** — deferred to 55-02. Two attempts in this session: (a) ask user to run curls directly — they preferred I drive it; (b) `vercel env pull` + run scans from here — first attempt failed on shell escaping of key value, second attempt blocked by classifier (correctly — one-time scope used). 55-02's TDD live test cases (#1 EICAR, #2 clean buffer) will serve as the EICAR-detection proof.

**Total deviations:** 1 architectural replan (approved by user via checkpoint), 1 deferred verification (deferred to 55-02). No scope creep.

## Issues Encountered

- None blocking. Discovered the Vercel-only deployment topology, which forced a meaningful but contained replan.

## Next Phase Readiness

**Ready for 55-02:**
- `CLOUDMERSIVE_API_KEY` is in Vercel envs (Production + Preview).
- `envValidator.js` exposes `cloudmersiveApiKey/Url/TimeoutMs` for 55-02's `malwareScanService.scanBuffer` to consume.
- `.env.example` documents the three keys.

**Carry-forward concerns:**
- **`CLOUDMERSIVE_API_KEY` not set in Vercel Development scope.** This means local `vercel dev` runs will fail-closed on the upload route. 55-02's live test cases require the key in local env to actually fire — operator should set it locally (in `backend-express/.env`) before running 55-02's tests, or accept that the live cases skip with their gating message.
- **Cloudmersive plan tier not recorded.** Operator picked tier during signup (free 800/mo or paid). 55-04 closeout should record the choice so the runbook section on quota monitoring is calibrated.
- **EICAR live-fire not yet observed.** First fail-fast for a bad/rotated key now happens in 55-02's RED phase. If the key is invalid, expect Test #6 (mocked 401) to be the only one passing — that's the actionable signal.

---

*Phase: 55-upload-security*
*Completed: 2026-06-10*
