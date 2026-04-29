// APIClient+Plaid.swift
import Foundation

// MARK: - Plaid Request Models

struct PlaidLinkTokenRequest: Encodable {
    let userId: String
    let clientName: String?
    let redirectUri: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case clientName = "client_name"
        case redirectUri = "redirect_uri"
    }
}

struct PlaidExchangeTokenRequest: Encodable {
    let publicToken: String
    let userId: String
    let institutionId: String?

    enum CodingKeys: String, CodingKey {
        case publicToken = "public_token"
        case userId = "user_id"
        case institutionId = "institution_id"
    }
}

struct PlaidAPIAccountsRequest: Encodable {
    let accessToken: String
    let accountIds: [String]?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case accountIds = "account_ids"
    }
}

struct PlaidTransactionsRequest: Encodable {
    let accessToken: String
    let startDate: String
    let endDate: String
    let count: Int?
    let offset: Int?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case startDate = "start_date"
        case endDate = "end_date"
        case count
        case offset
    }
}

// MARK: - Plaid Response Models

struct PlaidLinkTokenResponse: Decodable {
    let linkToken: String
    let expiration: String?
    let requestId: String?

    enum CodingKeys: String, CodingKey {
        case linkToken = "link_token"
        case expiration
        case requestId = "request_id"
    }
}

struct PlaidExchangeTokenResponse: Decodable {
    let accessToken: String
    let itemId: String
    let requestId: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case itemId = "item_id"
        case requestId = "request_id"
    }
}

struct PlaidAPIAccountsResponse: Decodable {
    let accounts: [PlaidAPIAccount]
    let item: PlaidItem?
    let requestId: String?

    enum CodingKeys: String, CodingKey {
        case accounts
        case item
        case requestId = "request_id"
    }
}

struct PlaidTransactionsResponse: Decodable {
    let transactions: [PlaidTransaction]
    let totalTransactions: Int?
    let accounts: [PlaidAPIAccount]?
    let requestId: String?

    enum CodingKeys: String, CodingKey {
        case transactions
        case totalTransactions = "total_transactions"
        case accounts
        case requestId = "request_id"
    }
}

// MARK: - Plaid Data Models

struct PlaidAPIAccount: Decodable {
    let accountId: String
    let name: String
    let officialName: String?
    let type: String
    let subtype: String?
    let balances: PlaidBalances

    enum CodingKeys: String, CodingKey {
        case accountId = "account_id"
        case name
        case officialName = "official_name"
        case type
        case subtype
        case balances
    }
}

struct PlaidBalances: Decodable {
    let available: Double?
    let current: Double?
    let limit: Double?
    let isoCurrencyCode: String?

    enum CodingKeys: String, CodingKey {
        case available
        case current
        case limit
        case isoCurrencyCode = "iso_currency_code"
    }
}

struct PlaidItem: Decodable {
    let itemId: String
    let institutionId: String?

    enum CodingKeys: String, CodingKey {
        case itemId = "item_id"
        case institutionId = "institution_id"
    }
}

struct PlaidTransaction: Decodable {
    let transactionId: String
    let accountId: String
    let amount: Double
    let date: String
    let name: String
    let merchantName: String?
    let category: [String]?
    let pending: Bool?

    enum CodingKeys: String, CodingKey {
        case transactionId = "transaction_id"
        case accountId = "account_id"
        case amount
        case date
        case name
        case merchantName = "merchant_name"
        case category
        case pending
    }
}

struct PlaidDeleteItemRequest: Encodable {
    let accessToken: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
    }
}

// MARK: - GET /v1/plaid/items (JWT-derived ownership; no body)

/// Mirrors the response shape from `backend-express/routes/plaid.js`'s
/// `GET /v1/plaid/items`: `{ items: [{ itemId, institutionId, status,
/// updatedAt, accounts }] }`. Accounts are an empty array until S04 hydrates
/// them — that's intentional, not a parse error.
struct PlaidItemSummary: Decodable {
    let itemId: String
    let institutionId: String?
    let status: String?
    let updatedAt: String?
    let accounts: [PlaidAPIAccount]?
}

struct PlaidItemsResponse: Decodable {
    let items: [PlaidItemSummary]
}

struct PlaidDeleteItemResponse: Decodable {
    let removed: Bool
    let requestId: String?

    enum CodingKeys: String, CodingKey {
        case removed
        case requestId = "request_id"
    }
}

// MARK: - APIClient Plaid Methods

extension APIClient {

    func createPlaidLinkToken(
        userId: String,
        clientName: String? = nil,
        redirectUri: String? = nil
    ) async throws -> PlaidLinkTokenResponse {
        let requestBody = PlaidLinkTokenRequest(
            userId: userId,
            clientName: clientName,
            redirectUri: redirectUri
        )
        let body = try JSONEncoder().encode(requestBody)
        return try await request(
            endpoint: "/v1/plaid/link_token",
            method: .POST,
            body: body,
            responseType: PlaidLinkTokenResponse.self
        )
    }

    func exchangePlaidToken(
        publicToken: String,
        userId: String,
        institutionId: String? = nil
    ) async throws -> PlaidExchangeTokenResponse {
        let requestBody = PlaidExchangeTokenRequest(
            publicToken: publicToken,
            userId: userId,
            institutionId: institutionId
        )
        let body = try JSONEncoder().encode(requestBody)
        return try await request(
            endpoint: "/v1/plaid/exchange_token",
            method: .POST,
            body: body,
            responseType: PlaidExchangeTokenResponse.self
        )
    }

    func getPlaidAPIAccounts(
        accessToken: String,
        accountIds: [String]? = nil
    ) async throws -> PlaidAPIAccountsResponse {
        let requestBody = PlaidAPIAccountsRequest(
            accessToken: accessToken,
            accountIds: accountIds
        )
        let body = try JSONEncoder().encode(requestBody)
        return try await request(
            endpoint: "/v1/plaid/accounts",
            method: .POST,
            body: body,
            responseType: PlaidAPIAccountsResponse.self
        )
    }

    func deletePlaidItem(
        accessToken: String
    ) async throws -> PlaidDeleteItemResponse {
        let requestBody = PlaidDeleteItemRequest(accessToken: accessToken)
        let body = try JSONEncoder().encode(requestBody)
        return try await request(
            endpoint: "/v1/plaid/item",
            method: .DELETE,
            body: body,
            responseType: PlaidDeleteItemResponse.self
        )
    }

    /// List the signed-in Clerk user's Plaid items via `GET /v1/plaid/items`.
    /// Backend derives ownership from the verified JWT (no body, no `access_token`)
    /// per MEM024 / MEM026. Returns `{ items: [] }` (200) when nothing is linked.
    func getPlaidItems() async throws -> PlaidItemsResponse {
        return try await request(
            endpoint: "/v1/plaid/items",
            method: .GET,
            body: nil,
            responseType: PlaidItemsResponse.self
        )
    }

    func getPlaidTransactions(
        accessToken: String,
        startDate: String,
        endDate: String,
        count: Int? = nil,
        offset: Int? = nil
    ) async throws -> PlaidTransactionsResponse {
        let requestBody = PlaidTransactionsRequest(
            accessToken: accessToken,
            startDate: startDate,
            endDate: endDate,
            count: count,
            offset: offset
        )
        let body = try JSONEncoder().encode(requestBody)
        return try await request(
            endpoint: "/v1/plaid/transactions",
            method: .POST,
            body: body,
            responseType: PlaidTransactionsResponse.self
        )
    }
}
