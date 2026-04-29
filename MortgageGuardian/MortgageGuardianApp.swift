import SwiftUI
import Clerk

@main
struct MortgageAnalyzerApp: App {
    @State private var clerk = Clerk.shared
    @StateObject private var authManager = AuthManager()
    @StateObject private var documentManager = DocumentManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if !clerk.isLoaded {
                    ProgressView("Loading...")
                } else if clerk.user != nil {
                    MainTabView()
                        .environmentObject(authManager)
                        .environmentObject(documentManager)
                } else {
                    // Clerk's prebuilt AuthView owns sign-in / sign-up / email
                    // verification / password reset, including the WebView CAPTCHA
                    // challenge that the previous hand-rolled sign-in screen
                    // could not satisfy.
                    AuthView(isDismissable: false)
                }
            }
            .task {
                clerk.configure(publishableKey: "pk_test_Zm9uZC1tYWtvLTcxLmNsZXJrLmFjY291bnRzLmRldiQ")
                do {
                    try await clerk.load()
                } catch {
                    // Surface load failure rather than silently swallowing it; app stays in
                    // ProgressView state until clerk.isLoaded flips, but we leave a breadcrumb
                    // for diagnosis (per slice-plan failure-visibility requirement).
                    print("[Clerk] load() failed: \(error)")
                }
            }
            .onAppear {
                APIClient.shared.onAuthenticationRequired = { [weak authManager] in
                    await authManager?.handleAuthenticationRequired()
                }
            }
        }
    }
}
