import Foundation
import SwiftUI

struct AuditResult: Identifiable, Codable {
    let id = UUID()
    let issueType: IssueType
    let severity: Severity
    let title: String
    let description: String
    let detailedExplanation: String
    let suggestedAction: String
    let affectedAmount: Double?
    let detectionMethod: DetectionMethod
    let confidence: Double
    let evidenceText: String?
    let calculationDetails: CalculationDetails?
    var supportingDocuments: [SupportingDocument] = []
    let createdDate: Date

    // M001/S04 — regulatory evidence carried over from the backend audit
    // pipeline. Optional so existing fixtures and the locally-generated
    // `sampleResult()` continue to compile without these fields.
    var citation: String? = nil
    var legalBasis: String? = nil
    var plaidEvidence: PlaidEvidence? = nil

    enum IssueType: String, CaseIterable, Codable {
        case misappliedPayment = "misapplied_payment"
        case latePaymentError = "late_payment_error"
        case incorrectInterest = "incorrect_interest"
        case unauthorizedFee = "unauthorized_fee"
        case escrowError = "escrow_error"
        case missingPayment = "missing_payment"
        case incorrectBalance = "incorrect_balance"
        case lateInsurancePayment = "late_insurance_payment"
        case lateTaxPayment = "late_tax_payment"
        case forcePlacedInsurance = "force_placed_insurance"
        case duplicateCharge = "duplicate_charge"

        // RESPA Compliance Violations
        case respaNoticeOfErrorViolation = "respa_notice_of_error_violation"
        case respaInformationRequestViolation = "respa_information_request_violation"
        case respaEscrowDisclosureViolation = "respa_escrow_disclosure_violation"
        case respaServicingTransferViolation = "respa_servicing_transfer_violation"
        case respaSection8Violation = "respa_section_8_violation"
        case respaForcePlacedInsuranceViolation = "respa_force_placed_insurance_violation"
        case respaEscrowShortageViolation = "respa_escrow_shortage_violation"

        // TILA Compliance Violations
        case tilaRightOfRescissionViolation = "tila_right_of_rescission_violation"
        case tilaAPRViolation = "tila_apr_violation"
        case tilaARMDisclosureViolation = "tila_arm_disclosure_violation"
        case tilaHOEPAViolation = "tila_hoepa_violation"
        case tilaATRViolation = "tila_atr_violation"
        case tilaPeriodicStatementViolation = "tila_periodic_statement_violation"
        case tilaARMAdjustmentViolation = "tila_arm_adjustment_violation"

        var displayName: String {
            switch self {
            case .misappliedPayment:
                return "Misapplied Payment"
            case .latePaymentError:
                return "Late Payment Error"
            case .incorrectInterest:
                return "Incorrect Interest Calculation"
            case .unauthorizedFee:
                return "Unauthorized Fee"
            case .escrowError:
                return "Escrow Account Error"
            case .missingPayment:
                return "Missing Payment"
            case .incorrectBalance:
                return "Incorrect Balance"
            case .lateInsurancePayment:
                return "Late Insurance Payment"
            case .lateTaxPayment:
                return "Late Tax Payment"
            case .forcePlacedInsurance:
                return "Force-Placed Insurance"
            case .duplicateCharge:
                return "Duplicate Charge"

            // RESPA Compliance Violations
            case .respaNoticeOfErrorViolation:
                return "RESPA Notice of Error Violation"
            case .respaInformationRequestViolation:
                return "RESPA Information Request Violation"
            case .respaEscrowDisclosureViolation:
                return "RESPA Escrow Disclosure Violation"
            case .respaServicingTransferViolation:
                return "RESPA Servicing Transfer Violation"
            case .respaSection8Violation:
                return "RESPA Section 8 Violation"
            case .respaForcePlacedInsuranceViolation:
                return "RESPA Force-Placed Insurance Violation"
            case .respaEscrowShortageViolation:
                return "RESPA Escrow Shortage Violation"

            // TILA Compliance Violations
            case .tilaRightOfRescissionViolation:
                return "TILA Right of Rescission Violation"
            case .tilaAPRViolation:
                return "TILA APR Calculation Violation"
            case .tilaARMDisclosureViolation:
                return "TILA ARM Disclosure Violation"
            case .tilaHOEPAViolation:
                return "TILA HOEPA Violation"
            case .tilaATRViolation:
                return "TILA Ability-to-Repay Violation"
            case .tilaPeriodicStatementViolation:
                return "TILA Periodic Statement Violation"
            case .tilaARMAdjustmentViolation:
                return "TILA ARM Adjustment Violation"
            }
        }

        var icon: String {
            switch self {
            case .misappliedPayment:
                return "arrow.triangle.2.circlepath"
            case .latePaymentError:
                return "clock.fill"
            case .incorrectInterest:
                return "percent"
            case .unauthorizedFee:
                return "exclamationmark.triangle.fill"
            case .escrowError:
                return "shield.slash.fill"
            case .missingPayment:
                return "questionmark.circle.fill"
            case .incorrectBalance:
                return "equal.circle.fill"
            case .lateInsurancePayment:
                return "umbrella.fill"
            case .lateTaxPayment:
                return "building.columns.fill"
            case .forcePlacedInsurance:
                return "exclamationmark.shield.fill"
            case .duplicateCharge:
                return "doc.on.doc.fill"

            // RESPA Compliance Violations
            case .respaNoticeOfErrorViolation:
                return "envelope.badge.fill"
            case .respaInformationRequestViolation:
                return "info.circle.fill"
            case .respaEscrowDisclosureViolation:
                return "shield.slash.fill"
            case .respaServicingTransferViolation:
                return "arrow.left.arrow.right"
            case .respaSection8Violation:
                return "dollarsign.circle.fill"
            case .respaForcePlacedInsuranceViolation:
                return "exclamationmark.shield.fill"
            case .respaEscrowShortageViolation:
                return "calendar.badge.exclamationmark"

            // TILA Compliance Violations
            case .tilaRightOfRescissionViolation:
                return "clock.arrow.circlepath"
            case .tilaAPRViolation:
                return "percent.circle.fill"
            case .tilaARMDisclosureViolation:
                return "chart.line.uptrend.xyaxis"
            case .tilaHOEPAViolation:
                return "exclamationmark.octagon.fill"
            case .tilaATRViolation:
                return "person.fill.questionmark"
            case .tilaPeriodicStatementViolation:
                return "doc.text.fill"
            case .tilaARMAdjustmentViolation:
                return "bell.badge.fill"
            }
        }
    }

    enum Severity: String, CaseIterable, Codable {
        case low = "low"
        case medium = "medium"
        case high = "high"
        case critical = "critical"

        var color: Color {
            switch self {
            case .low:
                return .green
            case .medium:
                return .yellow
            case .high:
                return .orange
            case .critical:
                return .red
            }
        }

        var displayName: String {
            rawValue.capitalized
        }
    }

    enum DetectionMethod: String, Codable, CaseIterable {
        case aiAnalysis = "ai_analysis"
        case manualCalculation = "manual_calculation"
        case plaidVerification = "plaid_verification"
        case combinedAnalysis = "combined_analysis"

        var displayName: String {
            switch self {
            case .aiAnalysis:
                return "AI Analysis"
            case .manualCalculation:
                return "Manual Calculation"
            case .plaidVerification:
                return "Bank Data Verification"
            case .combinedAnalysis:
                return "Combined Analysis"
            }
        }
    }

    struct SupportingDocument: Identifiable, Codable {
        let id: UUID
        let documentId: String?
        let documentName: String
        let documentType: String // "PDF", "Image", "Text"
        let fileSize: String
        let pageReference: String?
        let highlightRegion: HighlightRegion?
        let localFileURL: URL?

        init(
            id: UUID = UUID(),
            documentId: String? = nil,
            documentName: String,
            documentType: String,
            fileSize: String = "",
            pageReference: String? = nil,
            highlightRegion: HighlightRegion? = nil,
            localFileURL: URL? = nil
        ) {
            self.id = id
            self.documentId = documentId
            self.documentName = documentName
            self.documentType = documentType
            self.fileSize = fileSize
            self.pageReference = pageReference
            self.highlightRegion = highlightRegion
            self.localFileURL = localFileURL
        }
    }

    struct HighlightRegion: Codable {
        let x: Double
        let y: Double
        let width: Double
        let height: Double
        let label: String?
    }

    struct CalculationDetails: Codable {
        let expectedValue: Double?
        let actualValue: Double?
        let difference: Double?
        let formula: String?
        let assumptions: [String]
        let warningFlags: [String]
    }
}

extension AuditResult {
    static func sampleResult() -> AuditResult {
        return AuditResult(
            issueType: .latePaymentError,
            severity: .high,
            title: "Incorrect Late Fee Charged",
            description: "A late fee was charged despite payment being received on time",
            detailedExplanation: "Payment due 01/01/2025 was received 01/05/2025, but your bank records show the payment was actually sent on 12/30/2024. The servicer incorrectly applied a $25 late fee.",
            suggestedAction: "Send a Notice of Error letter requesting removal of the late fee and correction of payment application date",
            affectedAmount: 25.00,
            detectionMethod: .plaidVerification,
            confidence: 0.95,
            evidenceText: "Payment due 01/01/2025 was received 01/05/2025, late fee charged",
            calculationDetails: CalculationDetails(
                expectedValue: 0.00,
                actualValue: 25.00,
                difference: 25.00,
                formula: "Late fee should be $0 when payment sent before due date",
                assumptions: ["Grace period of 15 days", "Payment sent 2 days before due date"],
                warningFlags: ["Payment application delay", "Potential RESPA violation"]
            ),
            supportingDocuments: [
                SupportingDocument(
                    documentName: "Mortgage Statement - January 2025.pdf",
                    documentType: "PDF",
                    fileSize: "2.1 MB",
                    pageReference: "Page 1",
                    highlightRegion: HighlightRegion(x: 0.25, y: 0.4, width: 0.2, height: 0.04, label: "Late Fee")
                ),
                SupportingDocument(
                    documentName: "Bank Statement - December 2024.pdf",
                    documentType: "PDF",
                    fileSize: "1.8 MB",
                    pageReference: "Page 2"
                )
            ],
            createdDate: Date()
        )
    }
}

// MARK: - BackendFinding → AuditResult presenter (M001/S04/T03)

extension AuditResult {
    /// Map a wire-format `BackendFinding` (from the audit pipeline) into
    /// the iOS-side `AuditResult` consumed by existing UI components.
    ///
    /// - Severity: backend's lowercase string → `Severity` enum, defaulting
    ///   to `.medium` when the backend emits an unknown value.
    /// - IssueType: derived from `ruleId` via a small known-rule map; falls
    ///   back to `.unauthorizedFee` (a generic "something looks wrong"
    ///   bucket) when the rule isn't recognized so the UI never crashes
    ///   on a new backend rule shipping ahead of an iOS update.
    /// - DetectionMethod: `.plaidVerification` when at least one matched
    ///   transaction is attached, otherwise `.aiAnalysis` (the rule engine
    ///   acted on document-extracted evidence alone).
    /// - Confidence: passed through when present; defaults to 0.85 to
    ///   match the iOS UI contract (S04 PLAN, step 1).
    static func from(backendFinding f: BackendFinding) -> AuditResult {
        let severity = mapSeverity(f.severity)
        let issueType = mapIssueType(ruleId: f.ruleId, citation: f.citation, statute: f.statuteName)
        let matched = f.plaidEvidence.matchedTransactions
        let detectionMethod: DetectionMethod = matched.isEmpty ? .aiAnalysis : .plaidVerification
        let confidence = f.confidence ?? 0.85

        let title = "\(f.statuteName) — \(f.sectionTitle)"
        let detailedExplanation: String = {
            var parts: [String] = []
            if !f.description.isEmpty { parts.append(f.description) }
            if let basis = f.legalBasis, !basis.isEmpty { parts.append(basis) }
            return parts.joined(separator: "\n\n")
        }()
        let suggestedAction = "Review the cited regulatory provision and dispute via Notice of Error if applicable."

        let supportingDocs: [SupportingDocument] = f.sourceDocuments.map { docName in
            SupportingDocument(
                documentId: nil,
                documentName: docName,
                documentType: "PDF"
            )
        }

        return AuditResult(
            issueType: issueType,
            severity: severity,
            title: title,
            description: f.description,
            detailedExplanation: detailedExplanation,
            suggestedAction: suggestedAction,
            affectedAmount: nil,
            detectionMethod: detectionMethod,
            confidence: confidence,
            evidenceText: f.legalBasis,
            calculationDetails: nil,
            supportingDocuments: supportingDocs,
            createdDate: Date(),
            citation: f.citation,
            legalBasis: f.legalBasis,
            plaidEvidence: f.plaidEvidence
        )
    }

    // MARK: - Private mapping helpers

    private static func mapSeverity(_ raw: String) -> Severity {
        switch raw.lowercased() {
        case "critical": return .critical
        case "high": return .high
        case "medium": return .medium
        case "low": return .low
        // Backend emits "info" (see expected-findings.json severityEnum)
        // but the iOS enum has no `.info` case — treat as low so the
        // UI still renders something instead of crashing.
        case "info": return .low
        default: return .medium
        }
    }

    /// Heuristic mapping from backend `ruleId` (and citation/statute as
    /// hints) to the iOS `IssueType` enum. The iOS enum predates the
    /// rule-engine taxonomy by months and is not 1:1 — for unknown
    /// rules we pick a sensible RESPA/TILA bucket from the citation
    /// prefix, falling back to `.unauthorizedFee` ("something is
    /// wrong on the statement") so the UI always has an icon and a
    /// display name.
    private static func mapIssueType(ruleId: String, citation: String, statute: String) -> IssueType {
        // Known rule-engine ruleIds. Extend as new rules ship.
        switch ruleId {
        case "rule-respa-001":
            // RESPA §10 — escrow accounting violations.
            return .respaEscrowDisclosureViolation
        case "rule-respa-004":
            // RESPA §8 — kickbacks/unearned fees.
            return .respaSection8Violation
        case "rule-cfpb-006":
            // CFPB early intervention requirement.
            return .respaInformationRequestViolation
        default:
            break
        }

        // Citation-prefix heuristics for unknown ruleIds.
        let cit = citation.uppercased()
        if cit.contains("12 CFR § 1024") || statute.uppercased().contains("RESPA") {
            return .respaNoticeOfErrorViolation
        }
        if cit.contains("12 CFR § 1026") || statute.uppercased().contains("TILA") {
            return .tilaPeriodicStatementViolation
        }

        return .unauthorizedFee
    }
}