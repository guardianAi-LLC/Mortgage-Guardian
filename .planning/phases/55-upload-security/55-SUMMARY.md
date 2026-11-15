---
phase: 55-upload-security
milestone: v8.0
status: complete
plans: [55-01, 55-02, 55-03, 55-04]
completed: 2026-06-10
---

# Phase 55 — Upload Security & Malware Scanning

Phase-level aggregate. See 55-01/02/03/04-SUMMARY.md for plan-scoped detail.

## What landed

- **Real malware detection on the upload path.** The Phase 04 `scanFileContent`
  stub in `utils/fileValidation.js` is gone. Every uploaded buffer goes
  through `services/malwareScanService.scanBuffer` (Cloudmersive hosted
  HTTPS API, `/virus/scan/file`) before the file is persisted to storage.
- **Fail-closed semantics.** Any infrastructure failure (network, timeout,
  401/403/429/5xx, malformed body) surfaces as `502
  { reason: 'scan_unavailable' }`. No code path resolves as "clean" on
  error. Empty buffers are refused as a vacuous scan.
- **Encrypted PDFs short-circuited.** A constant-time `Buffer.includes` scan
  for the `/Encrypt` marker rejects password-protected PDFs *before* they
  reach Cloudmersive (which would otherwise report them clean because it
  cannot read past the encryption layer).
- **Live-fire verified.** EICAR test signature returns `clean: false` from
  prod (`55-01` smoke). Upload route integration tests cover EICAR,
  encrypted-PDF, scanner-error, and clean paths.
- **Operational artifacts.** `scripts/cloudmersive-health-check.js`
  one-shot smoke (clean + EICAR + best-effort quota probes) and
  `backend-express/docs/MALWARE_SCANNING.md` runbook (rotation, quota,
  failure-mode triage).

## Replan callout

The original Phase 55 plan was a ClamAV sidecar on Railway. During 55-01 we
discovered the backend deploys to Vercel only — no persistent daemon, no
sidecar pattern available. Replanned to Cloudmersive (the
55-RESEARCH.md fallback) without changing the phase essential: "real malware
detection on the upload path, not a stub." ClamAV/Railway is parked for a
future phase if/when storage migrates off Vercel functions.

## Stub removed

The Phase 04 `scanFileContent(filename)` stub in
`backend-express/utils/fileValidation.js` (the `// TODO: integrate ClamAV …`
placeholder that always returned `{ scanned: false, reason: 'Malware
scanning deferred' }`) was deleted in 55-03 commit `1c16f85`. The export
of the same name now performs a real scan and returns
`{ scanned: true, clean: boolean, threats: string[], engine: 'cloudmersive' }`
or short-circuits with the encrypted-PDF rejection. See
55-03-SUMMARY.md for the diff window.

## New dependencies

- **Cloudmersive Virus Scan API** — external paid SaaS. Free tier is 800
  calls/month. Configured via `CLOUDMERSIVE_API_KEY` (required),
  `CLOUDMERSIVE_BASE_URL` (default `https://api.cloudmersive.com`),
  `CLOUDMERSIVE_TIMEOUT_MS` (default 15000).
- **No new npm dependency.** Implementation uses native `fetch` +
  `FormData` + `Blob` (global in Node 20+, the package engines floor). The
  official `cloudmersive-virus-api-client` was evaluated and rejected as
  net-negative cold-start cost for a single endpoint (decision recorded in
  55-02-SUMMARY.md).

## Operational story

- Runbook: [`backend-express/docs/MALWARE_SCANNING.md`](../../../backend-express/docs/MALWARE_SCANNING.md)
  — key rotation, quota monitoring, failure-mode triage.
- Smoke test: [`backend-express/scripts/cloudmersive-health-check.js`](../../../backend-express/scripts/cloudmersive-health-check.js)
  — exit 0 healthy, 1 reachable-but-failed, 2 missing env.
- Quick-start: a `### Malware Scanning (Cloudmersive)` subsection was added
  to `backend-express/QUICK-START.md` with the hard requirement and the
  two acceptable local-dev options.

## Tests added

From 55-02 (`__tests__/services/malwareScanService.test.js`):
- EICAR live-fire (skipped without key)
- clean buffer live (skipped without key)
- unreachable host → `MalwareScanError`
- non-Buffer arg → synchronous `TypeError`
- empty Buffer → `MalwareScanError`
- mocked HTTP 401 → `MalwareScanError`

From 55-03 (`__tests__/routes/documents-upload-security.test.js`):
- EICAR test signature → 400 generic rejection, no storage call
- password-protected PDF → 400 encrypted-pdf message, scanner not invoked
- `MalwareScanError` → 502 retry message, no storage call
- clean file → 201, exactly 1 scan + 1 storage call

## Known limits / future work

- **Single provider, no failover.** If Cloudmersive is down, every upload
  fails closed. Multi-provider failover was scoped out of Phase 55.
- **Free-tier quota cap during dev.** 800 calls/month is easy to exhaust.
  No silent dev bypass — see QUICK-START dev guidance.
- **Third-party data path.** Uploaded buffers transit a third-party SaaS.
  Compliance review for regulated content is deferred to a later phase.
- **GuardDuty option.** If document storage migrates to S3 (open question
  #2 in 55-RESEARCH.md), AWS GuardDuty Malware Protection becomes viable
  as a hosted alternative.
- **Health-check not in CI.** `cloudmersive-health-check.js` is a manual /
  oncall tool. CI integration deferred to Phase 56+.
- **ISS-004 (open).** Inline `/Encrypt` heuristic could false-positive on
  malformed PDFs containing the literal string outside an encryption
  dictionary. Logged for revisit if it surfaces in production.

## Cross-references

- [55-01-SUMMARY.md](55-01-SUMMARY.md) — Cloudmersive env + Vercel + live-fire
- [55-02-SUMMARY.md](55-02-SUMMARY.md) — `scanBuffer` TDD
- [55-03-SUMMARY.md](55-03-SUMMARY.md) — upload-route wiring + stub removal
- [55-04-SUMMARY.md](55-04-SUMMARY.md) — health-check script + ops docs
- [55-CONTEXT.md](55-CONTEXT.md), [55-RESEARCH.md](55-RESEARCH.md) — design rationale

---

*Phase 55 complete — 2026-06-10. Ready for Phase 56 Auth Hardening.*
