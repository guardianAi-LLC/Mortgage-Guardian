// AuthenticatedProbe.swift
// One-shot post-sign-in probe that hits an authenticated /v1/* route and emits a
// single structured os_log line per app-launch session. The signal is the canonical
// runtime proof that S02 ("authenticated round-trip from signed-in iOS sim") is met,
// and serves as the copy-able pattern for S03/S04's first authenticated calls.
//
// Contract:
//   - subsystem: com.mortgageguardian   category: api-probe
//   - Logs at most an 8-char prefix of the JWT — never the full token.
//   - Never crashes the app; all errors are caught and logged at .error level.
//   - Skips silently (with a one-line skip log) when the auth token is empty.
import Foundation
import OSLog

struct AuthenticatedProbe {
    private static let log = OSLog(subsystem: "com.mortgageguardian", category: "api-probe")

    /// Shape we decode from `GET /v1/cases`. The route returns
    /// `{ cases, total, userId }` (see backend-express/routes/cases.js); we only
    /// need to confirm decode succeeds, so all fields are optional.
    private struct CasesListResponse: Decodable {
        let total: Int?
    }

    /// Fire one authenticated probe to `/v1/cases`. Safe to call from a SwiftUI
    /// `.task` modifier — never throws, never crashes.
    static func runOnce() async {
        let token = APIClient.shared.authToken
        let prefix = String(token.prefix(8))

        guard !token.isEmpty else {
            os_log(
                "api-probe skipped reason=empty-token endpoint=/v1/cases",
                log: log,
                type: .info
            )
            return
        }

        let start = Date()
        do {
            let response = try await APIClient.shared.request(
                endpoint: "/v1/cases",
                method: .GET,
                body: nil,
                responseType: CasesListResponse.self
            )
            let latencyMs = Int(Date().timeIntervalSince(start) * 1000)
            os_log(
                "api-probe success endpoint=/v1/cases latencyMs=%d tokenPrefix=%{public}s total=%d",
                log: log,
                type: .info,
                latencyMs,
                prefix,
                response.total ?? -1
            )
        } catch {
            let latencyMs = Int(Date().timeIntervalSince(start) * 1000)
            os_log(
                "api-probe failure endpoint=/v1/cases latencyMs=%d tokenPrefix=%{public}s error=%{public}s",
                log: log,
                type: .error,
                latencyMs,
                prefix,
                String(describing: error)
            )
        }
    }
}
