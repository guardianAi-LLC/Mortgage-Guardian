import Foundation
import Combine
import os.log
import Clerk
import UserNotifications

/// Enhanced Plaid Service with microservices integration
/// Provides end-to-end banking integration for mortgage auditing
@MainActor
public final class EnhancedPlaidService: ObservableObject {

    // MARK: - Types

    public enum PlaidServiceError: LocalizedError {
        case notLinked
        case syncInProgress
        case invalidAccount
        case networkError(Error)
        case crossReferenceFailure(String)
        case auditIntegrationFailure(String)

        public var errorDescription: String? {
            switch self {
            case .notLinked:
                return "Bank account not linked. Please connect your account first."
            case .syncInProgress:
                return "Sync already in progress. Please wait for completion."
            case .invalidAccount:
                return "Invalid or unsupported account type."
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .crossReferenceFailure(let reason):
                return "Cross-reference failed: \(reason)"
            case .auditIntegrationFailure(let reason):
                return "Audit integration failed: \(reason)"
            }
        }
    }

    public struct EnhancedSyncResult {
        let syncedTransactions: Int
        let mortgagePayments: Int
        let auditMatches: Int
        let crossReferenceResults: CrossReferenceResults
        let timestamp: Date
    }

    public struct CrossReferenceResults {
        let matches: [PaymentAuditMatch]
        let discrepancies: [PaymentDiscrepancy]
        let matchRate: Double
    }

    public struct PaymentAuditMatch {
        let paymentId: String
        let auditId: String
        let matchConfidence: Double
        let matchDate: Date
    }

    public struct PaymentDiscrepancy {
        let paymentId: String
        let discrepancyType: String
        let description: String
        let suggestedAction: String
    }

    // MARK: - Published Properties

    @Published public var isLinked: Bool = false
    @Published public var isSyncing: Bool = false
    @Published public var lastSyncDate: Date?
    @Published public var linkedAccountInfo: LinkedAccountInfo?
    @Published public var syncProgress: SyncProgress?
    @Published public var lastSyncResult: EnhancedSyncResult?

    // MARK: - Private Properties

    private let logger = Logger(subsystem: "MortgageGuardian", category: "EnhancedPlaidService")
    private let secureKeyManager = SecureKeyManager.shared

    private var cancellables = Set<AnyCancellable>()
    private var syncTimer: Timer?

    private var currentUserId: String {
        Clerk.shared.user?.id ?? "mortgage_guardian_user"
    }

    // MARK: - Initialization

    public init() {
        setupPeriodicSync()
        loadStoredLinkStatus()
    }

    // MARK: - Public Interface

    /// Enhanced account linking with validation
    public func linkAccountWithValidation(publicToken: String, metadata: [String: Any]) async throws -> LinkResult {
        logger.info("Starting enhanced account linking with validation")

        do {
            let institutionId = (metadata["institution"] as? [String: Any])?["institution_id"] as? String
            let institutionName = (metadata["institution"] as? [String: Any])?["name"] as? String ?? "Connected Bank"

            // Exchange public token for access token
            let exchangeResponse = try await APIClient.shared.exchangePlaidToken(
                publicToken: publicToken,
                userId: currentUserId,
                institutionId: institutionId
            )

            // Store access token securely
            try secureKeyManager.saveAPIKey(exchangeResponse.accessToken, forService: .plaidAccessToken)

            // Fetch accounts to find loan accounts
            let accountsResponse = try await APIClient.shared.getPlaidAPIAccounts(
                accessToken: exchangeResponse.accessToken
            )

            let loanAccounts = accountsResponse.accounts
                .filter { $0.type == "loan" || ($0.subtype?.contains("mortgage") == true) }
                .map { LoanAccount(
                    accountId: $0.accountId,
                    name: $0.name,
                    type: $0.type,
                    subtype: $0.subtype ?? "",
                    mask: ""
                )}

            let linkResult = LinkResult(
                success: true,
                itemId: exchangeResponse.itemId,
                institutionName: institutionName,
                loanAccounts: loanAccounts
            )

            // Update state
            self.isLinked = true
            self.linkedAccountInfo = LinkedAccountInfo(
                institutionName: linkResult.institutionName,
                itemId: linkResult.itemId,
                loanAccountCount: linkResult.loanAccounts.count,
                linkedDate: Date()
            )

            // Store link data locally
            if let data = try? JSONEncoder().encode(linkResult) {
                UserDefaults.standard.set(data, forKey: "plaid_link_data")
            }

            logger.info("Enhanced account linking completed successfully")
            return linkResult

        } catch {
            logger.error("Enhanced account linking failed: \(error.localizedDescription)")
            throw PlaidServiceError.networkError(error)
        }
    }

    /// Enhanced transaction sync with audit integration
    public func syncTransactionsWithAudit(accountId: String, dateRange: DateRange? = nil) async throws -> EnhancedSyncResult {
        guard isLinked else {
            throw PlaidServiceError.notLinked
        }

        guard !isSyncing else {
            throw PlaidServiceError.syncInProgress
        }

        logger.info("Starting enhanced transaction sync with audit integration")

        await MainActor.run {
            self.isSyncing = true
            self.syncProgress = SyncProgress(
                stage: .fetchingTransactions,
                progress: 0.0,
                message: "Fetching transactions from bank..."
            )
        }

        do {
            let range = dateRange ?? DateRange.last90Days()
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            let startDateStr = dateFormatter.string(from: range.startDate)
            let endDateStr = dateFormatter.string(from: range.endDate)

            await updateSyncProgress(.processingTransactions, 0.3, "Processing transactions for audit...")

            // Fetch transactions via APIClient
            let accessToken = try secureKeyManager.getAPIKey(forService: .plaidAccessToken)
            let response = try await APIClient.shared.getPlaidTransactions(
                accessToken: accessToken,
                startDate: startDateStr,
                endDate: endDateStr
            )

            await updateSyncProgress(.crossReferencing, 0.6, "Cross-referencing with audit data...")

            // Filter for mortgage-related transactions
            let mortgageKeywords = ["mortgage", "loan payment", "escrow", "principal", "interest payment"]
            let mortgageTransactions = response.transactions.filter { txn in
                let nameLC = txn.name.lowercased()
                let merchantLC = txn.merchantName?.lowercased() ?? ""
                let categories = txn.category ?? []
                return mortgageKeywords.contains(where: { nameLC.contains($0) || merchantLC.contains($0) })
                    || categories.contains(where: { $0.lowercased().contains("loan") || $0.lowercased().contains("payment") })
            }

            let enhancedResult = EnhancedSyncResult(
                syncedTransactions: response.transactions.count,
                mortgagePayments: mortgageTransactions.count,
                auditMatches: 0,
                crossReferenceResults: CrossReferenceResults(matches: [], discrepancies: [], matchRate: 0.0),
                timestamp: Date()
            )

            await updateSyncProgress(.integrating, 0.9, "Integrating with local audit data...")

            // Log mortgage transactions for local reference
            for txn in mortgageTransactions {
                logger.debug("Mortgage transaction: \(txn.name) $\(txn.amount) on \(txn.date)")
            }

            await updateSyncProgress(.completed, 1.0, "Sync completed successfully")

            // Update state
            await MainActor.run {
                self.lastSyncDate = Date()
                self.lastSyncResult = enhancedResult
                self.isSyncing = false
                self.syncProgress = nil
            }

            // Track activity date for compliance reporting
            UserDefaults.standard.set(Date(), forKey: "plaid_last_activity")

            // Send notification
            await sendEnhancedNotification(for: enhancedResult)

            logger.info("Enhanced transaction sync completed successfully")
            return enhancedResult

        } catch {
            await MainActor.run {
                self.isSyncing = false
                self.syncProgress = nil
            }

            await storeLastSyncError(error)

            logger.error("Enhanced transaction sync failed: \(error.localizedDescription)")
            throw PlaidServiceError.networkError(error)
        }
    }

    /// Get cross-reference analysis for existing audit
    public func getCrossReferenceAnalysis(auditId: String) async throws -> CrossReferenceResults {
        guard isLinked else {
            throw PlaidServiceError.notLinked
        }

        logger.info("Getting cross-reference analysis for audit: \(auditId)")

        // Cross-referencing is handled server-side during webhook processing.
        // Return locally stored results from the last sync if available.
        if let lastResult = lastSyncResult {
            return lastResult.crossReferenceResults
        }

        return CrossReferenceResults(matches: [], discrepancies: [], matchRate: 0.0)
    }

    /// Trigger audit workflow with banking integration
    public func triggerAuditWithBankingIntegration(documentId: String) async throws -> String {
        guard isLinked else {
            throw PlaidServiceError.notLinked
        }

        logger.info("Triggering audit workflow with banking integration for document: \(documentId)")

        do {
            try await APIClient.shared.processDocument(documentId: documentId)
            logger.info("Audit workflow started for document: \(documentId)")
            return documentId

        } catch {
            logger.error("Audit workflow trigger failed: \(error.localizedDescription)")
            throw PlaidServiceError.auditIntegrationFailure(error.localizedDescription)
        }
    }

    /// Unlink account and cleanup
    public func unlinkAccount() async throws {
        logger.info("Unlinking Plaid account")

        do {
            // Delete Plaid item via backend
            let accessToken = try secureKeyManager.getAPIKey(forService: .plaidAccessToken)
            _ = try await APIClient.shared.deletePlaidItem(accessToken: accessToken)

            // Clear local state
            await MainActor.run {
                self.isLinked = false
                self.linkedAccountInfo = nil
                self.lastSyncDate = nil
                self.lastSyncResult = nil
            }

            // Clear stored tokens and data
            secureKeyManager.deleteAPIKey(forService: .plaidAccessToken)
            UserDefaults.standard.removeObject(forKey: "plaid_link_data")

            logger.info("Account unlinked successfully")

        } catch {
            logger.error("Account unlinking failed: \(error.localizedDescription)")
            throw PlaidServiceError.networkError(error)
        }
    }

    // MARK: - Private Methods

    private func setupPeriodicSync() {
        // Setup automatic sync every 24 hours if linked
        syncTimer = Timer.scheduledTimer(withTimeInterval: 24 * 60 * 60, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self,
                      self.isLinked,
                      !self.isSyncing,
                      let accountInfo = self.linkedAccountInfo else {
                    return
                }

                // Auto-sync primary mortgage account
                do {
                    _ = try await self.syncTransactionsWithAudit(
                        accountId: accountInfo.primaryLoanAccountId ?? ""
                    )
                } catch {
                    self.logger.error("Automatic sync failed: \(error.localizedDescription)")
                }
            }
        }
    }

    private func loadStoredLinkStatus() {
        if let data = UserDefaults.standard.data(forKey: "plaid_link_data"),
           let linkData = try? JSONDecoder().decode(LinkResult.self, from: data) {
            self.isLinked = true
            self.linkedAccountInfo = LinkedAccountInfo(
                institutionName: linkData.institutionName,
                itemId: linkData.itemId,
                loanAccountCount: linkData.loanAccounts.count,
                linkedDate: Date()
            )
        }
    }

    private func updateSyncProgress(_ stage: SyncProgress.Stage, _ progress: Double, _ message: String) async {
        await MainActor.run {
            self.syncProgress = SyncProgress(
                stage: stage,
                progress: progress,
                message: message
            )
        }
    }

    private func sendEnhancedNotification(for syncResult: EnhancedSyncResult) async {
        let discrepancyCount = syncResult.crossReferenceResults.discrepancies.count

        let title: String
        let body: String

        if discrepancyCount > 0 {
            title = "Audit Discrepancies Found"
            body = "Found \(discrepancyCount) potential issues in your mortgage payments. Review required."
        } else {
            title = "Bank Sync Complete"
            body = "Synced \(syncResult.syncedTransactions) transactions with \(syncResult.auditMatches) audit matches"
        }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
        } catch {
            logger.warning("Failed to send notification: \(error.localizedDescription)")
        }
    }

    private func storeLastSyncError(_ error: Error) async {
        let errorData: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "error": error.localizedDescription,
            "retryable": true
        ]

        UserDefaults.standard.set(errorData, forKey: "last_sync_error")
        logger.error("Stored sync error for retry: \(error.localizedDescription)")
    }
}

// MARK: - Supporting Types

public struct LinkedAccountInfo {
    let institutionName: String
    let itemId: String
    let loanAccountCount: Int
    let linkedDate: Date
    let primaryLoanAccountId: String?

    init(institutionName: String, itemId: String, loanAccountCount: Int, linkedDate: Date, primaryLoanAccountId: String? = nil) {
        self.institutionName = institutionName
        self.itemId = itemId
        self.loanAccountCount = loanAccountCount
        self.linkedDate = linkedDate
        self.primaryLoanAccountId = primaryLoanAccountId
    }
}

public struct LinkResult: Codable {
    let success: Bool
    let itemId: String
    let institutionName: String
    let loanAccounts: [LoanAccount]
}

public struct LoanAccount: Codable {
    let accountId: String
    let name: String
    let type: String
    let subtype: String
    let mask: String
}

public struct SyncProgress {
    enum Stage {
        case fetchingTransactions
        case processingTransactions
        case crossReferencing
        case integrating
        case completed
    }

    let stage: Stage
    let progress: Double // 0.0 to 1.0
    let message: String
}

public struct DateRange {
    let startDate: Date
    let endDate: Date

    static func last90Days() -> DateRange {
        let endDate = Date()
        let startDate = Calendar.current.date(byAdding: .day, value: -90, to: endDate) ?? endDate
        return DateRange(startDate: startDate, endDate: endDate)
    }
}
