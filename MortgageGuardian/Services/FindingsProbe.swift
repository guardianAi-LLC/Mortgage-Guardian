// FindingsProbe.swift
// One-shot post-sign-in probe that reads the app's audit findings and emits a
// single structured os_log line per app-launch session. Mirrors `PlaidProbe`
// (MEM032) — the canonical runtime proof that the iOS findings surface is
// wired to the backend audit pipeline (M001/S04).
//
// Contract:
//   - subsystem: com.mortgageguardian   category: findings-probe
//   - Logs `findingsCount` and first 16 chars of the first finding's citation.
//   - Uses `%{public}s` so values appear in Console.app (not `<private>`).
//   - Never throws, never crashes the app.
//   - Observable via:
//       xcrun simctl spawn booted log stream \
//         --predicate 'subsystem == "com.mortgageguardian" && category == "findings-probe"'
//
// Written-to persistent log (Section B human resume):
//   /tmp/s04-ios.log
import Foundation
import OSLog

struct FindingsProbe {
    private static let log = OSLog(
        subsystem: "com.mortgageguardian",
        category: "findings-probe"
    )

    /// Fire a single findings-state probe.
    /// Called from `MainTabView.task { await FindingsProbe.runOnce(auditResults: userStore.auditResults) }`.
    /// Never throws, never crashes.
    static func runOnce(auditResults: [AuditResult]) async {
        let count = auditResults.count
        let citationPrefix: String = {
            guard let first = auditResults.first,
                  let cit = first.citation, !cit.isEmpty else {
                return "nil"
            }
            return String(cit.prefix(16))
        }()

        os_log(
            "findings-probe status=ok findingsCount=%d citationPrefix=%{public}s",
            log: log,
            type: .info,
            count,
            citationPrefix
        )

        // Mirror to /tmp/s04-ios.log for Section B human resume.
        let line = "findings-probe status=ok findingsCount=\(count) citationPrefix=\(citationPrefix)\n"
        if let data = line.data(using: .utf8) {
            let url = URL(fileURLWithPath: "/tmp/s04-ios.log")
            if FileManager.default.fileExists(atPath: url.path) {
                if let handle = try? FileHandle(forWritingTo: url) {
                    handle.seekToEndOfFile()
                    handle.write(data)
                    try? handle.close()
                }
            } else {
                try? data.write(to: url, options: .atomic)
            }
        }
    }
}
