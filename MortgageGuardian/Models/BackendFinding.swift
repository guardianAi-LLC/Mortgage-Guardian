// BackendFinding.swift
//
// Codable mirror of a single audit finding produced by the backend
// pipeline `_runAudit` step (see backend-express/services/documentPipelineService.js
// and complianceRuleEngine.js _buildViolation). One finding per rule violation.
//
// The shape is locked to whatever `_runAudit` emits today — adding a new
// optional field on the backend is safe (Decodable will skip unknown keys),
// but renaming or removing a required field here will break decoding for
// every iOS client. Treat this file and `BackendAuditReport.swift` as the
// canonical wire contract for M001/S04.
//
// Confidence is optional because the deterministic rule engine path (the
// default for tests) does not emit a `confidence` field; the AI-enhanced
// path does. UI code defaults to 0.85 when nil — see
// `AuditResult.from(backendFinding:)`.

import Foundation

// MARK: - Plaid Evidence (shared with AuditResult)

/// A document-side payment that was reconciled against a Plaid transaction
/// by `plaidCrossReferenceService.crossReferencePayments`.
///
/// Only `transactionId`, `transactionDate`, `transactionAmount`, and
/// `transactionName` are guaranteed by the cross-ref service for the
/// matched-transaction sub-object the iOS UI wants to surface as evidence;
/// the other fields (status/variance/documentDate/documentAmount/etc.) are
/// preserved for richer UIs in later slices.
struct MatchedTransaction: Codable, Identifiable, Hashable {
    /// Stable identifier for SwiftUI lists. Falls back to
    /// `transactionId` (always present from Plaid) so two records with
    /// the same Plaid txn id never collide.
    var id: String { transactionId }

    let transactionId: String
    /// ISO-8601 date string emitted by Plaid (`yyyy-MM-dd`). Decoded as
    /// String, not Date, because callers want to display the original
    /// representation alongside the document-side date for visual diff.
    let transactionDate: String
    let transactionAmount: Double
    /// Plaid-side merchant/transaction name. Optional — older rule
    /// engine code paths populate it, the cross-ref builder does not
    /// always carry it through.
    let transactionName: String?

    // Optional — present on matchedPayments produced by the cross-ref
    // service; absent in some legacy paths. Keep optional to be lenient.
    let documentDate: String?
    let documentAmount: Double?
    let status: String?
    let variance: Double?
    let documentId: String?

    enum CodingKeys: String, CodingKey {
        case transactionId
        case transactionDate
        case transactionAmount
        case transactionName = "name"
        case documentDate
        case documentAmount
        case status
        case variance
        case documentId
    }

    // The cross-ref service emits `transactionDate` and `name` as
    // separate top-level fields on each matched payment. Some older
    // synthetic fixtures emit `transactionName`. Accept either.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.transactionId = try c.decode(String.self, forKey: .transactionId)
        self.transactionDate = try c.decode(String.self, forKey: .transactionDate)
        self.transactionAmount = try c.decode(Double.self, forKey: .transactionAmount)
        if let name = try? c.decode(String.self, forKey: .transactionName) {
            self.transactionName = name
        } else {
            // Fallback: try a nested dynamic key lookup for "transactionName".
            let dyn = try? decoder.container(keyedBy: DynamicKey.self)
            self.transactionName = (try? dyn?.decode(String.self, forKey: DynamicKey(stringValue: "transactionName")!))
        }
        self.documentDate = try? c.decode(String.self, forKey: .documentDate)
        self.documentAmount = try? c.decode(Double.self, forKey: .documentAmount)
        self.status = try? c.decode(String.self, forKey: .status)
        self.variance = try? c.decode(Double.self, forKey: .variance)
        self.documentId = try? c.decode(String.self, forKey: .documentId)
    }

    init(
        transactionId: String,
        transactionDate: String,
        transactionAmount: Double,
        transactionName: String?,
        documentDate: String? = nil,
        documentAmount: Double? = nil,
        status: String? = nil,
        variance: Double? = nil,
        documentId: String? = nil
    ) {
        self.transactionId = transactionId
        self.transactionDate = transactionDate
        self.transactionAmount = transactionAmount
        self.transactionName = transactionName
        self.documentDate = documentDate
        self.documentAmount = documentAmount
        self.status = status
        self.variance = variance
        self.documentId = documentId
    }

    private struct DynamicKey: CodingKey {
        var stringValue: String
        init?(stringValue: String) { self.stringValue = stringValue }
        var intValue: Int? { nil }
        init?(intValue: Int) { return nil }
    }
}

/// A document-side payment that the cross-ref service could NOT match
/// against any Plaid transaction. Surfaced to the user as "we expected
/// to see this in your bank but we didn't."
struct UnmatchedPayment: Codable, Identifiable, Hashable {
    /// Stable identifier for SwiftUI lists — composite of
    /// documentId + date so duplicates on the same day don't collide.
    var id: String { (documentId ?? "doc") + "|" + date + "|" + String(amount) }

    /// ISO-8601 date string from the document.
    let date: String
    let amount: Double
    let documentId: String?
    let description: String?
    /// One of: `no_matching_transaction`, `date_outside_tolerance`,
    /// `amount_outside_tolerance`. See plaidCrossReferenceService.js.
    let reason: String?
}

/// Bag of Plaid-side evidence attached to a single finding.
struct PlaidEvidence: Codable, Hashable {
    let matchedTransactions: [MatchedTransaction]
    let unmatchedDocumentPayments: [UnmatchedPayment]

    init(
        matchedTransactions: [MatchedTransaction] = [],
        unmatchedDocumentPayments: [UnmatchedPayment] = []
    ) {
        self.matchedTransactions = matchedTransactions
        self.unmatchedDocumentPayments = unmatchedDocumentPayments
    }
}

// MARK: - BackendFinding

/// A single audit finding as emitted by the backend pipeline.
///
/// Decoding is lenient on `severity` (lowercased) and `confidence`
/// (optional). Unknown fields are ignored by JSONDecoder, so backend
/// additions stay backwards-compatible with this iOS build.
struct BackendFinding: Codable, Identifiable, Hashable {
    /// Backend-assigned id (post-deduplication). May be null on first
    /// emission — fall back to `ruleId` plus citation for stable
    /// SwiftUI identity.
    let backendId: String?
    let ruleId: String
    let statuteName: String
    let sectionTitle: String
    let citation: String
    /// Lowercase string: `low`, `medium`, `high`, `critical`. Mapped
    /// to `AuditResult.Severity` by `AuditResult.from(backendFinding:)`.
    let severity: String
    let description: String
    let legalBasis: String?
    let sourceDocuments: [String]
    let plaidEvidence: PlaidEvidence
    /// Optional in [0.0, 1.0]. Rule-engine path leaves this nil; AI path
    /// emits a value. UI defaults to 0.85 when nil.
    let confidence: Double?

    var id: String { backendId ?? "\(ruleId)|\(citation)" }

    enum CodingKeys: String, CodingKey {
        case backendId = "id"
        case ruleId
        case statuteName
        case sectionTitle
        case citation
        case severity
        case description
        case legalBasis
        case sourceDocuments
        case plaidEvidence
        case confidence
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.backendId = try? c.decode(String.self, forKey: .backendId)
        self.ruleId = try c.decode(String.self, forKey: .ruleId)
        self.statuteName = (try? c.decode(String.self, forKey: .statuteName)) ?? "Unknown Statute"
        self.sectionTitle = (try? c.decode(String.self, forKey: .sectionTitle)) ?? "Unknown Section"
        self.citation = (try? c.decode(String.self, forKey: .citation)) ?? ""
        // Severity should always be a lowercase string. Be lenient:
        // accept either case and normalize to lowercase here so the
        // presenter's switch is simpler.
        let rawSeverity = (try? c.decode(String.self, forKey: .severity)) ?? "medium"
        self.severity = rawSeverity.lowercased()
        self.description = (try? c.decode(String.self, forKey: .description)) ?? ""
        self.legalBasis = try? c.decode(String.self, forKey: .legalBasis)
        self.sourceDocuments = (try? c.decode([String].self, forKey: .sourceDocuments)) ?? []
        self.plaidEvidence = (try? c.decode(PlaidEvidence.self, forKey: .plaidEvidence)) ?? PlaidEvidence()
        self.confidence = try? c.decode(Double.self, forKey: .confidence)
    }

    init(
        backendId: String?,
        ruleId: String,
        statuteName: String,
        sectionTitle: String,
        citation: String,
        severity: String,
        description: String,
        legalBasis: String?,
        sourceDocuments: [String],
        plaidEvidence: PlaidEvidence,
        confidence: Double?
    ) {
        self.backendId = backendId
        self.ruleId = ruleId
        self.statuteName = statuteName
        self.sectionTitle = sectionTitle
        self.citation = citation
        self.severity = severity.lowercased()
        self.description = description
        self.legalBasis = legalBasis
        self.sourceDocuments = sourceDocuments
        self.plaidEvidence = plaidEvidence
        self.confidence = confidence
    }
}
