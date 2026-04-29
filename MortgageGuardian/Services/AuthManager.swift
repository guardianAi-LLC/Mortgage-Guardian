// AuthManager.swift
import Clerk
import SwiftUI

@MainActor
class AuthManager: ObservableObject {
    @Published var isSignedIn = false
    @Published var isLoading = true
    @Published var userName: String?
    @Published var userEmail: String?

    private var tokenRefreshTask: Task<Void, Never>?

    init() {
        setupClerk()
    }

    private func setupClerk() {
        // NOTE: Clerk.shared.configure(...) is now called by MortgageGuardianApp.swift's
        // .task modifier, which also calls clerk.load() to fetch the environment (CAPTCHA
        // settings, etc). AuthManager remains responsible for token-bridge concerns only.
        Task {
            if Clerk.shared.user != nil {
                updateUserInfo()
                self.isSignedIn = true
                await refreshToken()
                startPeriodicTokenRefresh()
            }
            self.isLoading = false
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

    // MARK: - Authentication

    func signIn(email: String, password: String) async throws {
        let signIn = try await SignIn.create(
            strategy: .identifier(email, password: password)
        )

        if signIn.status == .complete {
            updateUserInfo()
            self.isSignedIn = true
            await refreshToken()
            startPeriodicTokenRefresh()
        }
    }

    func signUp(email: String, password: String) async throws {
        let signUp = try await SignUp.create(
            strategy: .standard(emailAddress: email, password: password)
        )
        try await signUp.prepareVerification(strategy: .emailCode)
        print("Sign up created, verification email sent")
    }

    func verifyEmail(code: String) async throws {
        guard let signUp = Clerk.shared.client?.signUp else {
            throw NSError(domain: "AuthManager", code: 0, userInfo: [NSLocalizedDescriptionKey: "No pending sign-up found."])
        }

        try await signUp.attemptVerification(strategy: .emailCode(code: code))

        if signUp.status == .complete {
            updateUserInfo()
            self.isSignedIn = true
            await refreshToken()
            startPeriodicTokenRefresh()
        } else {
            throw NSError(domain: "AuthManager", code: 0, userInfo: [NSLocalizedDescriptionKey: "Verification failed. Please try again."])
        }
    }

    func sendPasswordReset(email: String) async throws {
        let signIn = try await SignIn.create(
            strategy: .identifier(email)
        )
        _ = try await signIn.prepareFirstFactor(
            strategy: .resetPasswordEmailCode()
        )
    }

    func resetPassword(code: String, newPassword: String) async throws {
        guard let signIn = Clerk.shared.client?.signIn else {
            throw NSError(domain: "AuthManager", code: 0, userInfo: [NSLocalizedDescriptionKey: "No pending password reset found."])
        }
        let result = try await signIn.attemptFirstFactor(
            strategy: .resetPasswordEmailCode(code: code)
        )
        if result.status == .needsNewPassword {
            _ = try await result.resetPassword(.init(password: newPassword))
            updateUserInfo()
            self.isSignedIn = true
            await refreshToken()
            startPeriodicTokenRefresh()
        }
    }

    func signOut() async throws {
        stopPeriodicTokenRefresh()
        try await Clerk.shared.signOut()
        self.userName = nil
        self.userEmail = nil
        self.isSignedIn = false
        APIClient.shared.setAuthToken("")
    }

    // MARK: - 401 Handling

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
