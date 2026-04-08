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
    private let secureKeyManager = SecureKeyManager.shared

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

    private var currentUserId: String {
        Clerk.shared.user?.id ?? "mortgage_guardian_user"
    }

    private func fetchLinkToken() async throws {
        let response = try await APIClient.shared.createPlaidLinkToken(
            userId: currentUserId,
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
                if let topViewController = UIApplication.shared.windows.first?.rootViewController {
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
        let response = try await APIClient.shared.exchangePlaidToken(
            publicToken: publicToken,
            userId: currentUserId
        )

        // Store the access token securely for future API calls
        try secureKeyManager.saveAPIKey(response.accessToken, forService: .plaidAccessToken)
        logger.info("Stored Plaid access token securely (item: \(response.itemId))")

        // Fetch accounts with the access token
        try await fetchAccountsWithAccessToken(accessToken: response.accessToken)
    }

    private func fetchAccountsWithAccessToken(accessToken: String) async throws {
        let response = try await APIClient.shared.getPlaidAPIAccounts(accessToken: accessToken)

        let plaidAccounts = response.accounts.map { bridgePlaidAccount($0, institutionName: "Connected Bank") }

        await MainActor.run {
            for account in plaidAccounts {
                self.addAccount(account)
            }
            self.isConnected = true
            self.logger.info("Successfully fetched \(plaidAccounts.count) accounts from Plaid")
        }
    }

    private func removeAccountFromBackend(accountId: String) async throws {
        let accessToken = try secureKeyManager.getAPIKey(forService: .plaidAccessToken)
        try await APIClient.shared.deletePlaidItem(accessToken: accessToken)
        logger.info("Removed Plaid item from backend for account \(accountId)")
    }

    private func fetchAccountsFromBackend() async throws -> [PlaidAccount] {
        let accessToken = try secureKeyManager.getAPIKey(forService: .plaidAccessToken)
        let response = try await APIClient.shared.getPlaidAPIAccounts(accessToken: accessToken)
        return response.accounts.map { bridgePlaidAccount($0, institutionName: "Connected Bank") }
    }

    // MARK: - Bridging

    private func bridgePlaidAccount(_ apiAccount: PlaidAPIAccount, institutionName: String) -> PlaidAccount {
        PlaidAccount(
            id: apiAccount.accountId,
            name: apiAccount.name,
            type: apiAccount.type,
            subtype: apiAccount.subtype ?? "",
            mask: "",
            institutionName: institutionName,
            balance: apiAccount.balances.available ?? apiAccount.balances.current,
            isActive: true
        )
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
        }
    }
}
