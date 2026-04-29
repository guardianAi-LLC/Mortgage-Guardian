// PlaidProbe.swift
// One-shot post-sign-in probe that hits `GET /v1/plaid/items` and emits a single
// structured os_log line per app-launch session. Mirrors `AuthenticatedProbe`
// (MEM019) — the canonical runtime proof that the iOS Plaid surface is wired
// to the JWT-authenticated backend, and the answer to "is the iOS Plaid surface
// alive?" via:
//
//   xcrun simctl spawn booted log stream \
//     --predicate 'subsystem == "com.mortgageguardian" && category == "plaid-probe"'
//
// Contract:
//   - subsystem: com.mortgageguardian   category: plaid-probe
//   - Logs at most an 8-char prefix of the JWT — never the full token.
//   - Skips silently (with a one-line skip log) when not signed in.
//   - Never throws, never crashes the app.
//   - Uses `%{public}s` so values appear in Console.app (not `<private>`).
import Foundation
import OSLog

struct PlaidProbe {
    private static let log = OSLog(subsystem: "com.mortgageguardian", category: "plaid-probe")

    /// Fire one authenticated probe to `/v1/plaid/items`. Safe to call from a
    /// SwiftUI `.task` modifier — never throws, never crashes.
    static func runOnce() async {
        let token = APIClient.shared.authToken
        let prefix = String(token.prefix(8))

        guard !token.isEmpty else {
            os_log(
                "plaid-probe skipped reason=empty-token endpoint=/v1/plaid/items",
                log: log,
                type: .info
            )
            return
        }

        let start = Date()
        do {
            let response = try await APIClient.shared.getPlaidItems()
            let latencyMs = Int(Date().timeIntervalSince(start) * 1000)
            os_log(
                "plaid-probe success endpoint=/v1/plaid/items latencyMs=%d tokenPrefix=%{public}s linkedItemCount=%d",
                log: log,
                type: .info,
                latencyMs,
                prefix,
                response.items.count
            )
        } catch {
            let latencyMs = Int(Date().timeIntervalSince(start) * 1000)
            os_log(
                "plaid-probe failure endpoint=/v1/plaid/items latencyMs=%d tokenPrefix=%{public}s error=%{public}s",
                log: log,
                type: .error,
                latencyMs,
                prefix,
                String(describing: error)
            )
        }
    }
}
