# Phase 55: Upload Security & Malware Scanning — Research

**Researched:** 2026-06-10
**Domain:** Server-side malware scanning for user-uploaded mortgage documents in a Node.js/Express backend deployed to Railway (container) and Vercel (serverless)
**Confidence:** HIGH

<research_summary>
## Summary

Researched scanning options against the realistic constraints of this project: Express backend, Node 20 Alpine container per `backend-express/Dockerfile`, dual deploy story (Railway runs the container, Vercel can host the API as serverless functions), uploads up to 25 MB, mortgage PDFs/images/TXT as the allowed types, and a Phase 04 stub (`scanFileContent()` in `backend-express/utils/fileValidation.js`) that has documented the prior reasoning for deferral.

The 2026 ecosystem has two seriously credible patterns: **ClamAV daemon + Node client (sync, on-box)**, and **hosted HTTP scan APIs (sync, off-box)** — with AWS GuardDuty Malware Protection for S3 being the major new option since the stub was written (GA'd 2024, prices dropped 85% in Feb 2025 to $0.09/GB-scanned, $0.18/1000 objects). The Phase 04 stub explicitly listed "moving to containerized deployment" as the unlock condition for ClamAV — that condition is now met on Railway. VirusTotal's public API tier (still 4 req/min, 500/day in 2026) remains a non-starter for production; their premium tier is enterprise-priced.

**Primary recommendation:** ClamAV daemon as a Railway sidecar service, scanned synchronously via `clamscan` (npm `clamscan`, kylefarris) over TCP from the Express container. Fallback / parity option for Vercel-only deploys: Cloudmersive sync HTTP API (free 800 calls/month, paid beyond). User said in CONTEXT.md to delegate the choice — this recommendation is what to surface during planning. Defense-in-depth additions (`is-pdf-encrypted`, treat-scan-error-as-fail, MIME re-check against `file-type` result) are lower-cost wins worth bundling.
</research_summary>

<standard_stack>
## Standard Stack

### Core — Recommended (ClamAV on Railway)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `clamscan` (npm `clamscan`) | 2.4.x | Node.js client for clamd (TCP socket or local binary) | Most-used ClamAV Node client; supports clamd-over-TCP, has streaming/file/dir scan modes, mature failover handling |
| ClamAV (clamd) | 1.4.x LTS | Open-source AV daemon; signature DB lives in RAM | Industry baseline for self-hosted scanning; 1.4 is current LTS |
| `clamav/clamav` Docker image | latest LTS tag | Official Cisco-Talos image, runs clamd + freshclam | Maintained upstream, sidecar pattern documented |

### Core — Fallback (Hosted HTTP, for Vercel-only path)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cloudmersive-virus-api-client` | latest | Node client for Cloudmersive Virus Scan API | Synchronous API, 800 free calls/month, paid tiers from there |
| AWS GuardDuty Malware Protection for S3 (no SDK call — enabled at bucket) | GA | Scans S3 objects on PUT; tag-driven | Native to AWS; only relevant if we move documents to S3 |

### Supporting (defense-in-depth around the scan)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `file-type` | already in use | Magic-byte sniffing | Already wired in `validateFileContent` — keep |
| `is-pdf-encrypted` | 1.x | Detect password-protected PDFs | Encrypted PDFs can't be scanned — flag and reject (user explicitly excluded "enter password" UI from scope) |
| `express-rate-limit` | already in stack | Per-IP upload throttling | Already used elsewhere in backend; extend to upload route if not present |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `clamscan` | `pompelmi` (new wrapper, 2024+) | Newer, less battle-tested; cleaner Verdict enum; smaller community. `clamscan` still has more StackOverflow-able edge cases solved. |
| ClamAV self-host | VirusTotal Public API | Public tier: 4 req/min, 500 req/day. **Not viable in production.** Listed for completeness only. |
| ClamAV self-host | VirusTotal Premium / Google Threat Intelligence | Multi-engine, far better detection — but enterprise pricing, requires sales contact. Realistic only if budget allows. |
| ClamAV self-host | AWS GuardDuty Malware Protection for S3 | Native AWS, $0.09/GB-scanned + $0.18/1000 objects after free tier (1 GB / 1000 objects/month). Only useful if documents already live in S3. Mortgage Guardian's current document storage is MinIO/Supabase, not S3. |
| ClamAV self-host | Cloudmersive Virus Scan API | Sync HTTP, 800 free calls/month, fits Vercel-only. Adds per-call latency (~200–800ms typical) and a third-party data path for sensitive mortgage docs. |

**Installation (recommended path):**
```bash
# In backend-express/
npm install clamscan is-pdf-encrypted
```

Railway sidecar: add a second Railway service from the official `clamav/clamav:1.4` image, expose port 3310, persist `/var/lib/clamav` as a volume so freshclam updates survive restarts.

**Installation (fallback path):**
```bash
npm install cloudmersive-virus-api-client is-pdf-encrypted
# CLOUDMERSIVE_API_KEY → env
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
backend-express/
├── services/
│   └── malwareScanService.js     # NEW — wraps the chosen backend (clamd or cloud API)
├── utils/
│   └── fileValidation.js          # MODIFY — replace scanFileContent() stub
├── middleware/
│   └── (existing upload middleware)
├── routes/
│   └── documents.js               # Already gates uploads through validateFileContent
└── __tests__/
    ├── services/malwareScanService.test.js
    └── routes/documents-upload-security.test.js  # EXTEND
```

The Phase 04 stub already preserved the function signature (`async (buffer) => { scanned, reason, ... }`) specifically so 55 is a drop-in. Honor that — do not change the call sites in `documents.js` beyond what the new return shape forces.

### Pattern 1: Sync scan inside the upload request lifecycle (ClamAV via TCP)
**What:** Express handler validates magic bytes → scans via clamd → only then writes to storage. Scan happens before any persistence.
**When to use:** Containerized deploy (Railway). Latency budget per scan ~50–300ms for files <25MB once daemon is warm.
**Example:**
```javascript
// services/malwareScanService.js
const NodeClam = require('clamscan');

let clamavReady = null;
async function getClamAV() {
  if (clamavReady) return clamavReady;
  clamavReady = new NodeClam().init({
    clamdscan: {
      host: process.env.CLAMAV_HOST,   // e.g. clamav.railway.internal
      port: Number(process.env.CLAMAV_PORT || 3310),
      timeout: 30_000,
      multiscan: false,
      reloadDb: false,
      active: true,
      bypassTest: false,
    },
    preference: 'clamdscan',
  });
  return clamavReady;
}

async function scanBuffer(buffer) {
  const av = await getClamAV();
  const { isInfected, viruses } = await av.scanStream(bufferToStream(buffer));
  return {
    scanned: true,
    clean: !isInfected,
    threats: viruses || [],
    engine: 'clamav',
  };
}
```

### Pattern 2: Fail-closed on scan error
**What:** Any error from the scanner (timeout, connection refused, malformed response) is treated as a **failed upload**, not a clean one.
**When to use:** Always.
**Example:**
```javascript
let scanResult;
try {
  scanResult = await scanBuffer(buffer);
} catch (err) {
  logger.error('Malware scan failed', { err: err.message });
  return res.status(502).json({ error: 'Upload could not be safety-checked. Try again.' });
}
if (!scanResult.clean) {
  logger.warn('Malware detected', { threats: scanResult.threats, userId });
  return res.status(400).json({ error: 'This file appears unsafe and was not accepted.' });
}
```
Direct alignment with CONTEXT.md "hard reject + clear message."

### Pattern 3: Encrypted PDF short-circuit
**What:** Detect password-protected PDFs **before** sending bytes to the scanner; reject with an explicit message. Scanners cannot inspect encrypted content, so an "unscannable" file would otherwise be the same as "clean."
**When to use:** Whenever the magic-bytes check identifies the file as PDF.
**Example:**
```javascript
const isPdfEncrypted = require('is-pdf-encrypted');
if (detectedExt === 'pdf' && await isPdfEncrypted(buffer)) {
  return res.status(400).json({ error: 'Password-protected PDFs are not supported. Please remove the password and try again.' });
}
```

### Anti-Patterns to Avoid
- **Returning `{ scanned: false }` on error and letting the upload proceed.** Attackers can force scan errors deliberately.
- **Polling-async scanning (e.g., VT submit + check later) without quarantine.** The file lands in storage *before* the verdict — that's exactly the "window of unscanned files" the Phase 04 stub called out, still a real problem.
- **Trusting `req.file.mimetype`** (browser-set). Already mitigated by `file-type` magic-byte check; don't regress.
- **Loading the entire 25 MB buffer twice** (once for magic-byte sniff, again to stream to clamd). Use a single buffer; ClamAV's `scanStream` accepts one.
- **Skipping freshclam.** Daemon with stale signatures is a daemon detecting yesterday's threats. Freshclam must run on a schedule in the sidecar.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Malware signature matching | Custom YARA-style ruleset / regex over file bytes | ClamAV or hosted scanner | Detection rate depends on signature DB updated multiple times daily by Cisco-Talos. You cannot replicate this. |
| Clamd protocol client | Raw TCP to port 3310 implementing `zINSTREAM\0` | `clamscan` npm | Stream framing, chunked responses, INSTREAM size limits — all already handled, including failover between `clamdscan` binary and TCP. |
| Encrypted-PDF detection | Manually parsing PDF trailer for `/Encrypt` | `is-pdf-encrypted` | Edge cases around cross-reference streams, hybrid encryption — solved. |
| Magic-byte detection | Lookup table of file signatures | `file-type` (already used) | Already handles HEIC, TIFF, and PDF variants in `ALLOWED_FILE_TYPES`. Don't reintroduce a custom table. |
| Sandboxing scanned files | Custom worker process | ClamAV's own daemon (sandboxed by container) | Defense-in-depth already comes from running clamd in its own Railway service with no app code in the image. |

**Key insight:** The Phase 04 stub deferred scanning explicitly because the runtime constraint (no daemon support) wasn't met. The npm ecosystem hasn't invented a magical pure-Node AV in the meantime — the only realistic options are still (a) connect to clamd, or (b) outsource to an HTTP API. Both are mature; build neither yourself.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Treating scan errors as clean
**What goes wrong:** Network blip, daemon restart, or signature DB reload causes the scan call to throw. Naïve code returns `{ scanned: false }` and the upload succeeds. An attacker can deliberately trigger errors (oversized streams, connection floods) to bypass scanning.
**Why it happens:** Error handlers default to "continue on best effort."
**How to avoid:** Fail-closed (see Pattern 2). Scan errors → 502 with retry prompt, never "upload accepted but not scanned."
**Warning signs:** Logs show "scan failed" lines alongside "upload succeeded" lines for the same upload.

### Pitfall 2: Stale ClamAV signatures
**What goes wrong:** Container restarts but freshclam never ran successfully. Scanner detects nothing newer than the base image's bundled signature snapshot (possibly months old).
**Why it happens:** Volume not persistent, freshclam pointed at wrong DB mirror, or sidecar set to `UPDATE=false` and the update-only companion forgotten.
**How to avoid:** Persistent volume for `/var/lib/clamav`. Health check that asserts last signature update is <24 h old.
**Warning signs:** Clamd logs `LibClamAV Warning: load_db: database too old`. EICAR test passes detection (good) but a recent test sample doesn't (bad).

### Pitfall 3: Memory pressure from sig DB
**What goes wrong:** clamd OOMs at startup because allocated container memory < signature DB size.
**Why it happens:** 2 GB containers; ClamAV's mainline DB has crept past that.
**How to avoid:** Provision the clamd Railway service at 4 GB+ RAM. Document it in the runbook.
**Warning signs:** Sidecar restarts immediately, no scans complete. Railway service shows OOM kills.

### Pitfall 4: Encrypted PDFs scanned as "clean"
**What goes wrong:** Password-protected PDF reaches clamd; scanner cannot read content; returns clean.
**Why it happens:** Stream-level scanners only flag what they can decode.
**How to avoid:** `is-pdf-encrypted` pre-check (Pattern 3) before scan.
**Warning signs:** Test corpus includes a known-malicious encrypted PDF and it passes. Add this case to the test suite explicitly.

### Pitfall 5: Big upload + slow scan blowing past Vercel function timeout
**What goes wrong:** On Vercel Hobby (10 s) or even Pro (60 s), a 25 MB upload + clamd HTTP roundtrip + DB write can clip the timeout.
**Why it happens:** Synchronous design + worst-case file size.
**How to avoid:** ClamAV path runs on Railway, not Vercel. If Vercel must serve the upload route, use Fluid Compute (Pro 14 min) or push the scan to a background queue with a quarantine record — but that contradicts CONTEXT.md "invisible, sync-feeling."
**Warning signs:** Sporadic 504s from upload endpoint correlate with file size.
</common_pitfalls>

<code_examples>
## Code Examples

### Drop-in replacement for `scanFileContent` (ClamAV path)
```javascript
// backend-express/utils/fileValidation.js (replacement)
const { Readable } = require('stream');
const { scanBuffer } = require('../services/malwareScanService');

async function scanFileContent(buffer) {
  try {
    const result = await scanBuffer(buffer);
    return {
      scanned: true,
      clean: result.clean,
      threats: result.threats,
      engine: result.engine,
    };
  } catch (err) {
    // Fail-closed: caller MUST reject upload on { scanned: false }.
    return { scanned: false, clean: false, reason: err.message };
  }
}
```
The Phase 04 stub returned `{ scanned: false }` and the route ignored it. The route logic must now check `clean === true && scanned === true`.

### Adversarial test fixture — EICAR
```javascript
// __tests__/services/malwareScanService.test.js
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
test('detects EICAR signature', async () => {
  const result = await scanBuffer(Buffer.from(EICAR));
  expect(result.scanned).toBe(true);
  expect(result.clean).toBe(false);
  expect(result.threats).toContain(expect.stringMatching(/EICAR/i));
});
```
EICAR is a standardized harmless test signature every AV engine detects — the canonical positive-case test.

### Railway sidecar (compose-style for documentation)
```yaml
# Conceptual — Railway services configured via dashboard, not compose,
# but this is the shape to reproduce.
services:
  api:
    image: backend-express:latest
    environment:
      CLAMAV_HOST: clamav.railway.internal
      CLAMAV_PORT: 3310
  clamav:
    image: clamav/clamav:1.4
    volumes:
      - clamav-db:/var/lib/clamav
    resources:
      memory: 4Gi
```
</code_examples>

<sota_updates>
## State of the Art (since Phase 04 stub, 2026-02 → 2026-06)

| Old Approach (Phase 04 era) | Current Approach | When Changed | Impact |
|------------------------------|------------------|--------------|--------|
| "Serverless deploy → no clamd → defer scanning" | Project now has Dockerized backend; Railway is the runtime — clamd sidecar is straightforward | Backend containerization (Phase 5x) | Phase 04's deferral rationale (#1) no longer applies. |
| VirusTotal as the only API option considered | AWS GuardDuty Malware Protection for S3 GA + 85% price cut | 2024 GA, Feb 2025 price drop | New credible third option if document storage moves to S3 in a future phase. |
| `clamscan` was the obvious npm pick | `clamscan` still dominates; `pompelmi` is the newcomer worth knowing about | 2024–2026 | Pick `clamscan` for stability; revisit `pompelmi` later. |
| Phase 04 cited 4 req/min, 500 req/day for VT free | Still those numbers in 2026 docs | Unchanged | Confirms VT free is not a production option. |

**New tools/patterns to consider:**
- **Vercel Fluid Compute** (launched 2024–2025): up to 14 min per request, blurs serverless/server line. Doesn't solve the daemon problem but does buy time for HTTP-API scans if the upload route ever ends up on Vercel.
- **GuardDuty on-demand scans** (2024+): scan existing S3 objects retroactively. Out of scope per CONTEXT.md ("no retroactive scans"), but worth knowing.

**Deprecated/outdated:**
- Phase 04's "ClamAV requires daemon and is incompatible" — outdated; Railway is a container platform and the daemon is now perfectly compatible there.
</sota_updates>

<open_questions>
## Open Questions

1. **Is the production API actually served from Railway, Vercel, or both?**
   - What we know: `Dockerfile` is Node 20 Alpine, `railway.json` exists with Nixpacks builder, `vercel.json` exists and rewrites all paths to `/api`.
   - What's unclear: which is the canonical prod path for `/v1/documents/process`. Recent env work targeted Railway *and* Vercel.
   - Recommendation: confirm during planning — drives whether ClamAV (Railway-only) is the sole path or whether a fallback is required.

2. **Should mortgage documents move to S3 to unlock GuardDuty Malware Protection?**
   - What we know: GuardDuty is now competitively priced (~$0.09/GB-scanned) and removes the operate-clamd burden.
   - What's unclear: storage migration is a sizeable cross-cutting change; out of scope for 55, but flag for a future phase if 55's clamd costs/operations prove painful.
   - Recommendation: don't include in 55. Note as roadmap input.

3. **Latency budget for the upload route end-to-end.**
   - What we know: CONTEXT.md says "speed of upload is unchanged." Current pipeline does magic-byte sniff + storage write.
   - What's unclear: actual baseline upload P95.
   - Recommendation: measure baseline during planning, set a target like "scan adds <400ms to P95 of 5–10 MB uploads."

4. **Quarantine vs. discard for caught files.**
   - What we know: CONTEXT.md says "hard reject" — no quarantine UI.
   - What's unclear: whether *backend* retains a hash of caught files for security telemetry, or discards entirely.
   - Recommendation: log threat name + file hash + userId (never the bytes), no storage of the file itself.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- ClamAV official Docker docs — https://docs.clamav.net/manual/Installing/Docker.html (current sidecar pattern, UPDATE/UPDATE_ONLY flags)
- `clamscan` npm — https://www.npmjs.com/package/clamscan (Node client, current API)
- Cisco-Talos `clamav` repo README.Docker.md — https://github.com/Cisco-Talos/clamav (official image, 4 GB RAM guidance)
- AWS GuardDuty Malware Protection for S3 docs — https://docs.aws.amazon.com/guardduty/latest/ug/gdu-malware-protection-s3.html (pricing, limits — 25 buckets/account/region)
- AWS pricing announcement (Feb 2025 — 85% price cut) — https://aws.amazon.com/about-aws/whats-new/2025/02/amazon-guardduty-malware-protection-s3-price-reduction/
- Vercel Functions Limits — https://vercel.com/docs/functions/limitations (timeouts per plan, /tmp 500 MB, 50 MB bundle)
- VirusTotal v3 overview — https://docs.virustotal.com/reference/overview (rate limits, quota model)

### Secondary (MEDIUM confidence)
- Railway ClamAV template — https://railway.com/deploy/MAnG6f (env-driven config pattern)
- `is-pdf-encrypted` npm — https://www.npmjs.com/package/is-pdf-encrypted (encrypted PDF detection)
- Transloadit "Implementing server-side malware scanning with ClamAV in Node.js" — verified vs npm `clamscan` docs
- Cloudmersive Virus Scan API — https://cloudmersive.com/virus-api (sync HTTP, 800 free calls/month)

### Tertiary (LOW confidence — verify during implementation)
- `pompelmi` — community-built, only mentioned as an alternative not selected; needs hands-on verification before adopting

### Project sources (HIGH confidence — read directly)
- `backend-express/utils/fileValidation.js:220-260` — Phase 04 stub with original deferral rationale
- `backend-express/Dockerfile` — confirms Node 20 Alpine container runtime
- `backend-express/railway.json` — Nixpacks builder; Docker overrides this
- `backend-express/vercel.json` — rewrites everything to `/api`
- `.planning/phases/55-upload-security/55-CONTEXT.md` — user's vision (invisible safety net, hard reject, real detection as non-negotiable)
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: ClamAV daemon + Node.js client; HTTP-API alternatives
- Ecosystem: `clamscan`, `pompelmi`, `is-pdf-encrypted`, Cloudmersive client, AWS GuardDuty
- Patterns: Sync scan in request, fail-closed on error, encrypted-PDF short-circuit, sidecar deployment
- Pitfalls: Stale signatures, OOM at startup, scan-error-as-clean, encrypted-PDF blind spot, Vercel timeout

**Confidence breakdown:**
- Standard stack: HIGH — verified against official npm + ClamAV docs + AWS docs
- Architecture: HIGH — clamscan + sidecar pattern is the documented official approach
- Pitfalls: HIGH — drawn from official ClamAV docs + Phase 04 stub's own rationale + current Vercel limits
- Code examples: MEDIUM — patterns match `clamscan` README but should be wired against the actual repo on first PR

**Research date:** 2026-06-10
**Valid until:** 2026-09-10 (90 days — ClamAV is stable; AWS GuardDuty pricing may shift; revalidate before any major redesign)

---

*Phase: 55-upload-security*
*Research completed: 2026-06-10*
*Ready for planning: yes*
