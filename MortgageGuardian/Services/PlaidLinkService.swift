import Foundation
import Combine
import UIKit
import os.log
import Clerk

#if canImport(LinkKit)
import LinkKit
#endif

/// Production Plaid Link integration for bank account connections
@MainActor
public final class PlaidLinkService: ObservableObject {

    // MARK: - Shared Instance
    public static let shared = PlaidLinkService()

    // MARK: - Published Properties
    @Published public var accounts: [PlaidAccount] = []
    @Published public var isLoading: Bool = false
    @Published public var errorMessage: String?
    @Published public var linkToken: String?
    @Published public var isConnected: Bool = false

    // MARK: - Private Properties
    private let logger = Logger(subsystem: "com.mortgageguardian", category: "PlaidLinkService")
    // NOTE: SecureKeyManager intentionally not held here — per MEM024 / R006 the
    // backend Supabase `plaid_items.access_token` is the sole source of truth and
    // iOS does not cache it. EnhancedPlaidService still uses the keychain for its
    // own legacy flow; this service no longer does.

    // Plaid Link Handler
    #if canImport(LinkKit)
    private var linkHandler: Handler?
    #endif

    private init() {
        logger.info("PlaidLinkService initialized with production Plaid SDK")
        loadStoredAccounts()
    }

    // MARK: - Public Methods

    /// Initialize Plaid Link flow
    public func startLinkFlow() async throws {
        #if canImport(LinkKit)
        isLoading = true
        errorMessage = nil

        do {
            // Get link token from backend
            try await fetchLinkToken()

            guard let linkToken = linkToken else {
                throw PlaidError.linkTokenFailed
            }

            // Configure and present Plaid Link
            await presentPlaidLink(linkToken: linkToken)

        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                logger.error("Link flow failed: \(error.localizedDescription)")
                isLoading = false
            }
            throw error
        }

        await MainActor.run {
            isLoading = false
        }
        #else
        // LinkKit not available - throw error
        await MainActor.run {
            errorMessage = "Plaid LinkKit framework is not available"
            logger.error("LinkKit framework not available")
            isLoading = false
        }
        throw PlaidError.linkKitUnavailable
        #endif
    }

    /// Add an account to the connected accounts
    public func addAccount(_ account: PlaidAccount) {
        if !accounts.contains(where: { $0.id == account.id }) {
            accounts.append(account)
            logger.info("Added account: \(account.name)")
            saveAccountsToStorage()
        }
    }

    /// Remove an account from connected accounts
    public func removeAccount(_ account: PlaidAccount) async throws {
        isLoading = true

        do {
            // Remove from backend first
            try await removeAccountFromBackend(accountId: account.id)

            // Remove locally
            accounts.removeAll { $0.id == account.id }
            logger.info("Removed account: \(account.name)")
            saveAccountsToStorage()

        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            throw error
        }
    }

    /// Refresh account data from Plaid
    public func refreshAccounts() async throws {
        isLoading = true

        do {
            // Fetch latest account data from backend
            let updatedAccounts = try await fetchAccountsFromBackend()

            await MainActor.run {
                self.accounts = updatedAccounts
                self.saveAccountsToStorage()
                self.logger.info("Refreshed \(updatedAccounts.count) accounts")
            }

        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
                self.logger.error("Refresh failed: \(error.localizedDescription)")
                self.isLoading = false
            }
            throw error
        }
    }

    /// Check if any accounts are connected
    public var hasConnectedAccounts: Bool {
        return !accounts.isEmpty
    }

    /// Get account count for display
    public var accountCount: Int {
        return accounts.count
    }

    // MARK: - Private Implementation

    /// Resolve the signed-in Clerk user id. The backend ignores body-supplied `user_id`
    /// and derives ownership from the verified JWT (per MEM026), but we still pass the
    /// id so older route variants and request logs stay informative. Refuses both nil
    /// and empty-string identities — the previous fallback to a shared literal id
    /// (a hard-coded shared-id string) would let unsigned-in callers write across
    /// users' Plaid items on any non-JWT-derived backend path. That fallback is gone.
    private func currentUserId() throws -> String {
        guard let id = Clerk.shared.user?.id, !id.isEmpty else {
            throw PlaidError.notSignedIn
        }
        return id
    }

    /// Multi-scene-safe key-window lookup for iOS 15+. Walks
    /// `UIApplication.shared.connectedScenes`, picks the foreground-active
    /// `UIWindowScene`, and returns its key window's root view controller.
    /// Replaces the deprecated single-window app-level accessor that warns on
    /// iOS 15+ and returns the wrong scene under multi-window iPad. Mirrors
    /// `ShareUtility.topViewController()`'s pattern.
    private func keyWindowRootViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let rootVC = windowScene.windows
                .first(where: { $0.isKeyWindow })?.rootViewController
        else {
            return nil
        }
        return rootVC
    }

    private func fetchLinkToken() async throws {
        let userId = try currentUserId()
        let response = try await APIClient.shared.createPlaidLinkToken(
            userId: userId,
            clientName: "Mortgage Guardian"
        )

        await MainActor.run {
            self.linkToken = response.linkToken
        }
    }

    private func presentPlaidLink(linkToken: String) async {
        logger.info("Presenting Plaid Link with token: \(linkToken.prefix(10))...")

        return await withCheckedContinuation { continuation in
            // Create Plaid Link configuration
            #if canImport(LinkKit)
            var configuration = LinkTokenConfiguration(token: linkToken) { success in
                // Handle successful link
                Task { @MainActor in
                    do {
                        try await self.handleLinkSuccess(publicToken: success.publicToken, metadata: success)
                        self.isConnected = true
                        self.logger.info("Plaid Link completed successfully")
                    } catch {
                        self.errorMessage = error.localizedDescription
                        self.logger.error("Link success handling failed: \(error.localizedDescription)")
                    }
                    continuation.resume()
                }
            }

            configuration.onExit = { exit in
                // Handle link exit/cancellation
                Task { @MainActor in
                    if let error = exit.error {
                        self.errorMessage = "Link failed: \(error.localizedDescription)"
                        self.logger.error("Plaid Link exited with error: \(error.localizedDescription)")
                    } else {
                        self.logger.info("Plaid Link exited without error")
                    }
                    continuation.resume()
                }
            }

            configuration.onEvent = { event in
                // Log Plaid events for debugging
                self.logger.info("Plaid Link event: \(event.eventName)")
            }

            // Create and present link handler
            let result = Plaid.create(configuration)
            switch result {
            case .failure(let error):
                Task { @MainActor in
                    self.errorMessage = "Failed to create Plaid Link: \(error.localizedDescription)"
                    self.logger.error("Failed to create Plaid Link: \(error.localizedDescription)")
                    continuation.resume()
                }
            case .success(let handler):
                self.linkHandler = handler
                if let topViewController = self.keyWindowRootViewController() {
                    handler.open(presentUsing: .viewController(topViewController))
                } else {
                    Task { @MainActor in
                        self.errorMessage = "Could not find view controller to present Plaid Link"
                        self.logger.error("Could not find view controller to present Plaid Link")
                        continuation.resume()
                    }
                }
            }
            #else
            // LinkKit not available - fail gracefully
            Task { @MainActor in
                self.errorMessage = "LinkKit framework not available"
                self.logger.error("LinkKit framework not available")
                continuation.resume()
            }
            #endif
        }
    }

    private func handleLinkSuccess(publicToken: String, metadata: Any) async throws {
        let userId = try currentUserId()
        let response = try await APIClient.shared.exchangePlaidToken(
            publicToken: publicToken,
            userId: userId
        )

        // NOTE: We deliberately do NOT cache `response.accessToken` in the keychain.
        // Per M001 boundary map / R006 / MEM024, the backend Supabase
        // `plaid_items.access_token` is the sole source of truth. Caching on iOS
        // creates a stale-cache footgun if the backend rotates or revokes the item
        // and duplicates the secret across two trust boundaries. The exchange
        // response is acknowledged here (response.itemId) but the token itself is
        // dropped — downstream account/transaction reads should derive the token
        // server-side from the JWT-authenticated user identity (see GET /v1/plaid/items
        // from S03 T02; full identity-derived /accounts and /transactions arrive in S04).
        logger.info("Plaid item exchanged and persisted backend-side (item: \(response.itemId))")

        // Track connection date for compliance reporting
        if UserDefaults.standard.object(forKey: "plaid_first_connected") == nil {
            UserDefaults.standard.set(Date(), forKey: "plaid_first_connected")
        }
        UserDefaults.standard.set(Date(), forKey: "plaid_last_activity")

        // Refresh the locally-displayed accounts list from the backend item store
        // (no client-held access token; backend resolves from the signed-in user).
        try await refreshAccountsFromBackendItems()
    }

    /// Pull the signed-in user's linked Plaid items (with their accounts) from the
    /// backend (`GET /v1/plaid/items`) and project them into the iOS-side
    /// `accounts` array. Replaces the prior keychain-token-based path.
    private func refreshAccountsFromBackendItems() async throws {
        let response = try await APIClient.shared.getPlaidItems()
        let mappedAccounts: [PlaidAccount] = response.items.flatMap { item -> [PlaidAccount] in
            (item.accounts ?? []).map { acct in
                PlaidAccount(
                    id: acct.accountId,
                    name: acct.name,
                    type: acct.type,
                    subtype: acct.subtype ?? "",
                    mask: "",
                    institutionName: item.institutionId ?? "Connected Bank",
                    balance: acct.balances.available ?? acct.balances.current,
                    isActive: true
                )
            }
        }

        await MainActor.run {
            for account in mappedAccounts {
                self.addAccount(account)
            }
            self.isConnected = !self.accounts.isEmpty
            self.logger.info("Refreshed \(mappedAccounts.count) accounts from backend items endpoint")
        }
    }

    private func removeAccountFromBackend(accountId: String) async throws {
        // TODO(S04): Add a JWT-identity-derived `DELETE /v1/plaid/items/:itemId`
        // route on the backend so iOS can remove a linked item without holding
        // the access token. Until then, this path is unsupported on the
        // post-keychain client (per MEM024 / R006).
        logger.error("removeAccountFromBackend(\(accountId)) is unsupported until the JWT-derived DELETE /v1/plaid/items/:itemId route exists (S04)")
        throw PlaidError.notSignedIn
    }

    private func fetchAccountsFromBackend() async throws -> [PlaidAccount] {
        // Pull from the JWT-authenticated `GET /v1/plaid/items` endpoint instead
        // of the legacy access-token-in-body path. Returns whatever items the
        // current Clerk user has linked (empty array is a valid 200).
        let response = try await APIClient.shared.getPlaidItems()
        return response.items.flatMap { item -> [PlaidAccount] in
            (item.accounts ?? []).map { acct in
                PlaidAccount(
                    id: acct.accountId,
                    name: acct.name,
                    type: acct.type,
                    subtype: acct.subtype ?? "",
                    mask: "",
                    institutionName: item.institutionId ?? "Connected Bank",
                    balance: acct.balances.available ?? acct.balances.current,
                    isActive: true
                )
            }
        }
    }

    // MARK: - Local Storage

    private func loadStoredAccounts() {
        // Load accounts from UserDefaults or Core Data
        if let data = UserDefaults.standard.data(forKey: "PlaidAccounts"),
           let storedAccounts = try? JSONDecoder().decode([PlaidAccount].self, from: data) {
            self.accounts = storedAccounts
            logger.info("Loaded \(storedAccounts.count) stored accounts")
        }
    }

    private func saveAccountsToStorage() {
        if let data = try? JSONEncoder().encode(accounts) {
            UserDefaults.standard.set(data, forKey: "PlaidAccounts")
            logger.debug("Saved accounts to storage")
        }
    }
}

// MARK: - Error Types
enum PlaidError: LocalizedError {
    case invalidConfiguration
    case linkTokenFailed
    case tokenExchangeFailed
    case accountsFetchFailed
    case linkKitUnavailable
    case notSignedIn

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration:
            return "Plaid configuration is invalid"
        case .linkTokenFailed:
            return "Failed to create link token"
        case .tokenExchangeFailed:
            return "Failed to exchange public token"
        case .accountsFetchFailed:
            return "Failed to fetch account data"
        case .linkKitUnavailable:
            return "Plaid LinkKit framework is not available. Please ensure the app is properly configured."
        case .notSignedIn:
            return "You must be signed in to connect a bank account."
        }
    }
}
