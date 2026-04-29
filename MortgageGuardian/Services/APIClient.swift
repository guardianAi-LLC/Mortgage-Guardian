// APIClient.swift
import Foundation
import OSLog

enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case DELETE
    case PATCH
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case decodingError(Error)
    case encodingError
    case authenticationRequired
    case serverError(Int, String)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .encodingError:
            return "Failed to encode request data"
        case .authenticationRequired:
            return "Authentication required"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

@Observable
class APIClient {
    static let shared = APIClient()

    private(set) var authToken: String = ""
    private let logger = Logger(subsystem: "com.mortgageguardian", category: "APIClient")

    var baseURL: String { APIConfiguration.baseURL }
    var isAuthenticated: Bool { !authToken.isEmpty }

    // Retry configuration
    private let maxRetries = 3
    private let baseDelay: TimeInterval = 1.0
    private let maxDelay: TimeInterval = 30.0
    private let retryableStatusCodes: Set<Int> = [429, 500, 502, 503, 504]

    var onAuthenticationRequired: (() async -> Void)?

    private let urlSession: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60.0
        config.timeoutIntervalForResource = 300.0
        config.waitsForConnectivity = true
        self.urlSession = URLSession(configuration: config)
    }

    /// Internal initializer for tests. Allows injecting a `URLSession` whose
    /// configuration includes a `URLProtocol` mock so the 401-retry behavior
    /// can be exercised without real network I/O. Not for production use.
    internal init(testSession: URLSession) {
        self.urlSession = testSession
    }

    func setAuthToken(_ token: String) {
        self.authToken = token
    }

    // MARK: - Public API (backward-compatible)

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .GET,
        body: Data? = nil,
        responseType: T.Type
    ) async throws -> T {
        return try await performRequest(
            endpoint: endpoint,
            method: method,
            body: body,
            responseType: responseType,
            attempt: 1,
            didRefreshAuth: false
        )
    }

    // MARK: - Private retry logic

    /// - Parameters:
    ///   - attempt: Current attempt number for the 5xx/429 retry budget. Starts at 1.
    ///   - didRefreshAuth: True when this call is the post-401-refresh retry. Used to
    ///     bound the auth-refresh path to a single retry — a second 401 throws unconditionally.
    ///     The 5xx/429 retry budget (`attempt`/`maxRetries`) is independent of this flag.
    ///
    /// Note on the auth hook: `await onAuthenticationRequired?()` is awaited; if the hook
    /// throws, the throw propagates to the caller (matching prior behavior).
    private func performRequest<T: Decodable>(
        endpoint: String,
        method: HTTPMethod,
        body: Data?,
        responseType: T.Type,
        attempt: Int,
        didRefreshAuth: Bool = false
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("MortgageGuardian-iOS/2.0", forHTTPHeaderField: "User-Agent")

        if !authToken.isEmpty {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }

        logger.info("Making \(method.rawValue) request to \(endpoint) (attempt \(attempt)/\(self.maxRetries + 1))")

        do {
            let (data, response) = try await urlSession.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            // Retry on retryable status codes (5xx/429) — independent of the 401 refresh path.
            if retryableStatusCodes.contains(httpResponse.statusCode) && attempt <= maxRetries {
                let delay = calculateBackoffDelay(for: attempt)
                logger.warning("Retryable error (status \(httpResponse.statusCode)), retrying in \(delay)s")
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await performRequest(
                    endpoint: endpoint,
                    method: method,
                    body: body,
                    responseType: responseType,
                    attempt: attempt + 1,
                    didRefreshAuth: didRefreshAuth
                )
            }

            switch httpResponse.statusCode {
            case 200...299:
                break
            case 401:
                if !didRefreshAuth {
                    // First 401 on this outermost request: trigger the refresh hook
                    // (typically AuthManager.refreshToken()), then re-issue exactly once.
                    logger.info("401 received — refreshing token, retrying once")
                    await onAuthenticationRequired?()
                    return try await performRequest(
                        endpoint: endpoint,
                        method: method,
                        body: body,
                        responseType: responseType,
                        attempt: 1,
                        didRefreshAuth: true
                    )
                } else {
                    // Second 401 after refresh — give up. Caller (and AuthManager via the
                    // hook, which already cleared the token) will route the user back
                    // to AuthView through the standard signed-out branch.
                    logger.error("Second 401 after refresh — giving up")
                    throw APIError.authenticationRequired
                }
            default:
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw APIError.serverError(httpResponse.statusCode, errorMessage)
            }

            do {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }

        } catch let error as APIError {
            throw error
        } catch {
            // Network errors: retry with backoff (independent of auth-refresh flag).
            if attempt <= maxRetries {
                let delay = calculateBackoffDelay(for: attempt)
                logger.warning("Network error, retrying in \(delay)s: \(error.localizedDescription)")
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await performRequest(
                    endpoint: endpoint,
                    method: method,
                    body: body,
                    responseType: responseType,
                    attempt: attempt + 1,
                    didRefreshAuth: didRefreshAuth
                )
            }
            logger.error("Request failed after \(attempt) attempts: \(error.localizedDescription)")
            throw APIError.networkError(error)
        }
    }

    private func calculateBackoffDelay(for attempt: Int) -> TimeInterval {
        let exponentialDelay = baseDelay * pow(2.0, Double(attempt - 1))
        let jitter = Double.random(in: 0.8...1.2)
        return min(exponentialDelay * jitter, maxDelay)
    }
}
