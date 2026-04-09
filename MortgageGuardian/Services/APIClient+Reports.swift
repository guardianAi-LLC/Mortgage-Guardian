// APIClient+Reports.swift
import Foundation

// MARK: - Dispute Letter Models

struct GenerateLetterRequest: Encodable {
    let letterType: String
}

struct DisputeLetterContent: Decodable {
    let subject: String?
    let salutation: String?
    let body: String?
    let demands: [String]?
    let legalCitations: [String]?
    let responseDeadline: String?
    let closingStatement: String?
}

struct RecipientInfo: Decodable {
    let servicerName: String?
    let servicerAddress: String?

    enum CodingKeys: String, CodingKey {
        case servicerName = "servicerName"
        case servicerAddress = "servicerAddress"
    }
}

struct DisputeLetterResponse: Decodable {
    let letterType: String?
    let generatedAt: String?
    let content: DisputeLetterContent?
    let recipientInfo: RecipientInfo?
}

/// Wrapper for the `{ status, letter }` response shape from POST /v1/cases/:caseId/report/letter
struct DisputeLetterResponseWrapper: Decodable {
    let status: String?
    let letter: DisputeLetterResponse?
}

/// Wrapper for the `{ status, report }` response shape from GET /v1/cases/:caseId/report
struct ConsolidatedReportResponseWrapper: Decodable {
    let status: String?
    let report: [String: AnyCodable]?
}

// MARK: - APIClient Report Methods

extension APIClient {

    /// Generate a dispute letter for a case.
    ///
    /// - Parameters:
    ///   - caseId: The case identifier.
    ///   - letterType: One of `notice_of_error`, `qualified_written_request`, or `request_for_information`.
    /// - Returns: The generated dispute letter response.
    func generateDisputeLetter(caseId: String, letterType: String) async throws -> DisputeLetterResponse {
        let requestBody = GenerateLetterRequest(letterType: letterType)
        let body = try JSONEncoder().encode(requestBody)
        let wrapper: DisputeLetterResponseWrapper = try await request(
            endpoint: "/v1/cases/\(caseId)/report/letter",
            method: .POST,
            body: body,
            responseType: DisputeLetterResponseWrapper.self
        )
        guard let letter = wrapper.letter else {
            throw APIError.invalidResponse
        }
        return letter
    }

    /// Retrieve the consolidated report for a case.
    ///
    /// - Parameter caseId: The case identifier.
    /// - Returns: The consolidated report as a dictionary.
    func getConsolidatedReport(caseId: String) async throws -> [String: AnyCodable] {
        let wrapper: ConsolidatedReportResponseWrapper = try await request(
            endpoint: "/v1/cases/\(caseId)/report",
            method: .GET,
            responseType: ConsolidatedReportResponseWrapper.self
        )
        guard let report = wrapper.report else {
            throw APIError.invalidResponse
        }
        return report
    }
}
