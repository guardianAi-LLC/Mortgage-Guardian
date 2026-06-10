# Phase 55: Upload Security & Malware Scanning — Context

**Gathered:** 2026-06-10
**Status:** Ready for research

<vision>
## How This Should Work

Upload security is an **invisible safety net**. On the happy path — which is essentially every real upload — the user sees no extra step, no extra UI, no extra waiting. Scanning happens inside the existing upload pipeline and the user is not aware it ran. The speed and feel of uploading a mortgage document is unchanged from today.

The safety net only becomes visible when something is *actually* wrong. If a file is detected as unsafe, the upload **hard-rejects with a clear, plain-English message** ("this file looks unsafe and was not accepted"). No silent failure, no obscure error code, no quarantine queue to babysit. The user picks a different file and tries again.

</vision>

<essential>
## What Must Be Nailed

- **Real malware detection, not a stub.** The current `scanFileContent()` always returns clean. The single most important outcome of Phase 55 is that real malicious files are actually caught when uploaded. Detection rate is the primary metric this phase has to move.

</essential>

<boundaries>
## What's Out of Scope

- **Image/PDF content moderation.** Detecting inappropriate-but-not-malicious content (NSFW, etc.) is a different problem and not addressed here.
- **Encrypted-PDF password prompting UI.** A password-protected PDF can be flagged as "we can't scan this," but building a full "enter password to unlock" flow is deferred.
- **Per-tenant scan policy or allowlists.** Single global scanning policy for now. Per-tenant tuning belongs with multi-tenant work in Phase 58.
- **Retroactive scanning of existing documents.** Phase 55 only protects *new* uploads. We do not go back and re-scan documents already sitting in storage.

</boundaries>

<specifics>
## Specific Ideas

- **No preference between hosted scanner vs self-hosted (ClamAV) — that's the research call.** The user is delegating the cost / latency / infra-fit tradeoff to the research step. Compare options on those axes and recommend.
- Bad-case copy should be plain English, not "AV signature match 0x4D5A…" jargon.

</specifics>

<notes>
## Additional Context

- The existing stub lives in the upload pipeline as `scanFileContent()` and currently returns clean unconditionally. Phase 55 is the first real implementation behind that interface.
- "Invisible safety net" + "hard reject + clear message" together imply a synchronous-feeling experience: the scan result is available before the upload is reported as successful. If a real scan can't meet that latency budget, the research/planning step will need to decide whether async-with-gate is acceptable, but the *user-facing feel* must remain "upload then immediately move on."
- Roadmap calls out additional upload-pipeline hardening (MIME sniffing, magic bytes, size limits, etc.) as research topics. User picked "real detection" as the non-negotiable, not "defense-in-depth on the upload surface" — so hardening work is *welcome but secondary*. Research/planning should size it as bonus tightening, not co-equal scope.

</notes>

---

*Phase: 55-upload-security*
*Context gathered: 2026-06-10*
