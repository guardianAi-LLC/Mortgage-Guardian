// BackendAuditReport.swift
//
// Top-level audit-report payload returned by the backend
// `POST /v1/documents/process` endpoint inside the response body's
// `auditReport` field. See documentPipelineService.js _runAudit for the
// authoritative producer.
//
// When the audit step fails non-fatally (e.g. Plaid timeout) the backend
// emits `{ findings: [], error: { code, message } }` instead of the full
// shape. We decode `error` optionally so the iOS UI can surface the
// failure reason to the user without crashing.

import Foundation

struct BackendAuditReport: Codable, Hashable {
    let findings: [BackendFinding]
    let summary: Summary?
    let error: AuditError?

    struct Summary: Codable, Hashable {
        let findingsCount: Int
        let matchedTxCount: Int
    }

    struct AuditError: Codable, Hashable {
        let code: String?
        let message: String?
    }

    init(
        findings: [BackendFinding] = [],
        summary: Summary? = nil,
        error: AuditError? = nil
    ) {
        self.findings = findings
        self.summary = summary
        self.error = error
    }
}
