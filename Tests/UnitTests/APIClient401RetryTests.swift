// APIClient401RetryTests.swift
//
// Verifies the silent retry-once-after-401 + Clerk-token-refresh contract added
// to APIClient.performRequest in M001/S02/T01:
//
//   - First 401 on an outermost request triggers `onAuthenticationRequired`
//     (the AuthManager refresh hook) and re-issues the request exactly once.
//   - A second consecutive 401 throws APIError.authenticationRequired without
//     calling the hook again — preventing infinite refresh loops.
//
// The tests use a custom URLProtocol subclass to script the response sequence
// for an injected URLSession, avoiding real network I/O.

import XCTest
@testable import MortgageGuardian

// MARK: - Scripted URLProtocol mock

/// URLProtocol that hands out a pre-scripted sequence of (statusCode, body) tuples,
/// one per `loadingRequest` call. Records every request it observes for assertion.
final class ScriptedURLProtocol: URLProtocol {

    /// (statusCode, body) tuples consumed in order. Reset before each test.
    static var scriptedResponses: [(Int, Data)] = []

    /// Captures every URLRequest that hit this protocol — assertion target for
    /// "two requests were observed".
    static var observedRequests: [URLRequest] = []

    /// Cursor into `scriptedResponses`. Reset before each test.
    static var responseIndex: Int = 0

    static func reset() {
        scriptedResponses = []
        observedRequests = []
        responseIndex = 0
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        ScriptedURLProtocol.observedRequests.append(request)

        guard ScriptedURLProtocol.responseIndex < ScriptedURLProtocol.scriptedResponses.count else {
            // Exhausted script — fail loudly so the test sees it.
            let error = NSError(domain: "ScriptedURLProtocol",
                                code: -1,
                                userInfo: [NSLocalizedDescriptionKey: "No scripted response for request \(ScriptedURLProtocol.responseIndex + 1)"])
            client?.urlProtocol(self, didFailWithError: error)
            return
        }

        let (status, body) = ScriptedURLProtocol.scriptedResponses[ScriptedURLProtocol.responseIndex]
        ScriptedURLProtocol.responseIndex += 1

        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() { /* no-op */ }
}

// MARK: - Helpers

private struct TestResp: Decodable, Equatable {
    let ok: Bool
}

private func makeAPIClientWithScriptedSession() -> APIClient {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [ScriptedURLProtocol.self]
    let session = URLSession(configuration: config)
    return APIClient(testSession: session)
}

// MARK: - Tests

final class APIClient401RetryTests: XCTestCase {

    override func setUp() {
        super.setUp()
        ScriptedURLProtocol.reset()
    }

    override func tearDown() {
        ScriptedURLProtocol.reset()
        super.tearDown()
    }

    /// First 401 should trigger the auth-refresh hook exactly once and then
    /// the second attempt's 200 body should be decoded and returned.
    func test_401_then_200_retries_once_and_returns_decoded_body() async throws {
        // Arrange: 401 then 200 with `{"ok":true}`.
        let okBody = try XCTUnwrap("{\"ok\":true}".data(using: .utf8))
        ScriptedURLProtocol.scriptedResponses = [
            (401, Data()),
            (200, okBody)
        ]

        let client = makeAPIClientWithScriptedSession()
        client.setAuthToken("stale-token")

        var hookCalls = 0
        client.onAuthenticationRequired = {
            hookCalls += 1
        }

        // Act
        let result = try await client.request(
            endpoint: "/v1/cases",
            responseType: TestResp.self
        )

        // Assert
        XCTAssertEqual(hookCalls, 1, "Hook must run exactly once for the first 401")
        XCTAssertEqual(ScriptedURLProtocol.observedRequests.count, 2,
                       "Two HTTP attempts should hit the wire (initial + retry)")
        XCTAssertEqual(result, TestResp(ok: true))
    }

    /// Two consecutive 401s should throw APIError.authenticationRequired.
    /// The hook is called only once — the second 401 must NOT re-trigger refresh.
    func test_401_then_401_throws_authenticationRequired() async {
        // Arrange: 401 twice.
        ScriptedURLProtocol.scriptedResponses = [
            (401, Data()),
            (401, Data())
        ]

        let client = makeAPIClientWithScriptedSession()
        client.setAuthToken("stale-token")

        var hookCalls = 0
        client.onAuthenticationRequired = {
            hookCalls += 1
        }

        // Act + Assert: must throw .authenticationRequired
        do {
            _ = try await client.request(
                endpoint: "/v1/cases",
                responseType: TestResp.self
            )
            XCTFail("Expected APIError.authenticationRequired to be thrown")
        } catch let error as APIError {
            switch error {
            case .authenticationRequired:
                break // expected
            default:
                XCTFail("Expected APIError.authenticationRequired, got \(error)")
            }
        } catch {
            XCTFail("Expected APIError.authenticationRequired, got \(error)")
        }

        XCTAssertEqual(hookCalls, 1,
                       "Hook must NOT be re-invoked on the second 401 — that would loop")
        XCTAssertEqual(ScriptedURLProtocol.observedRequests.count, 2,
                       "Exactly two attempts should hit the wire — no third attempt after second 401")
    }
}
