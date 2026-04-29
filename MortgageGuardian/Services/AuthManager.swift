// AuthManager.swift
//
// Thin token-bridge adapter between Clerk and the rest of the app.
//
// As of S01/T02, Clerk's prebuilt `AuthView` owns the entire sign-in /
// sign-up / email-verification / password-reset / CAPTCHA flow. The methods
// that used to drive the previous hand-rolled sign-in screen (signIn,
// signUp, verifyEmail, sendPasswordReset, resetPassword) have been deleted
// — they are dead code once the UI is delegated to Clerk.
//
// What remains here:
//   * Bridge Clerk session JWTs into `APIClient` so authenticated REST calls
//     stay valid (`refreshToken`, periodic refresh task, 401 handler).
//   * Surface a small slice of user identity (`userName`, `userEmail`,
//     `isSignedIn`) to existing SwiftUI consumers (ProfileView, SettingsView)
//     without making them depend on Clerk types directly.
//   * Subscribe to `Clerk.shared.authEventEmitter` so those published
//     properties update reactively when AuthView completes a sign-in /
//     sign-up or when the user signs out from anywhere.
//
// Intentionally NOT here:
//   * `Clerk.shared.configure(...)` — owned by `MortgageGuardianApp.swift`'s
//     `.task` modifier (see T01).
//   * Auth-flow business logic — owned by Clerk's `AuthView`.

import Clerk
import SwiftUI

@MainActor
class AuthManager: ObservableObject {
    @Published var isSignedIn = false
    @Published var isLoading = true
    @Published var userName: String?
    @Published var userEmail: String?

    private var tokenRefreshTask: Task<Void, Never>?
    private var authEventTask: Task<Void, Never>?

    init() {
        setupClerk()
    }

    deinit {
        tokenRefreshTask?.cancel()
        authEventTask?.cancel()
    }

    private func setupClerk() {
        // Reflect any pre-existing Clerk session into our published state on
        // first run (e.g. user re-launched the app while still signed in).
        Task {
            if Clerk.shared.user != nil {
                updateUserInfo()
                self.isSignedIn = true
                await refreshToken()
                startPeriodicTokenRefresh()
            }
            self.isLoading = false
        }

        // AuthView (and any other Clerk-driven flow) emits AuthEvent values
        // when sign-in / sign-up / sign-out completes. Mirror those into our
        // published state so ProfileView etc. update without polling.
        authEventTask = Task { [weak self] in
            for await event in Clerk.shared.authEventEmitter.events {
                guard let self = self else { return }
                switch event {
                case .signInCompleted, .signUpCompleted:
                    self.updateUserInfo()
                    self.isSignedIn = true
                    await self.refreshToken()
                    self.startPeriodicTokenRefresh()
                case .signedOut:
                    self.stopPeriodicTokenRefresh()
                    self.userName = nil
                    self.userEmail = nil
                    self.isSignedIn = false
                    APIClient.shared.setAuthToken("")
                }
            }
        }
    }

    private func updateUserInfo() {
        let clerkUser = Clerk.shared.user
        self.userName = clerkUser?.firstName
        self.userEmail = clerkUser?.primaryEmailAddress?.emailAddress
    }

    // MARK: - Token Lifecycle

    func refreshToken() async {
        do {
            if let token = try await Clerk.shared.session?.getToken() {
                APIClient.shared.setAuthToken(token.jwt)
            } else {
                try await signOut()
            }
        } catch {
            try? await signOut()
        }
    }

    private func startPeriodicTokenRefresh() {
        tokenRefreshTask?.cancel()
        tokenRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(240))
                guard !Task.isCancelled else { break }
                await self?.refreshToken()
            }
        }
    }

    private func stopPeriodicTokenRefresh() {
        tokenRefreshTask?.cancel()
        tokenRefreshTask = nil
    }

    // MARK: - Sign Out

    /// Sign the current Clerk session out. Local published state is reset by
    /// the `.signedOut` branch of the authEventEmitter subscription, but we
    /// also clear it here defensively in case the emitter is delayed.
    func signOut() async throws {
        stopPeriodicTokenRefresh()
        try await Clerk.shared.signOut()
        self.userName = nil
        self.userEmail = nil
        self.isSignedIn = false
        APIClient.shared.setAuthToken("")
    }

    // MARK: - 401 Handling

    /// Called by `APIClient` when a backend response returns 401. Tries to
    /// refresh the JWT from the current Clerk session; if no session is
    /// available, signs out so the UI can route back to AuthView.
    func handleAuthenticationRequired() async {
        do {
            if let token = try await Clerk.shared.session?.getToken() {
                APIClient.shared.setAuthToken(token.jwt)
            } else {
                try await signOut()
            }
        } catch {
            try? await signOut()
        }
    }
}
