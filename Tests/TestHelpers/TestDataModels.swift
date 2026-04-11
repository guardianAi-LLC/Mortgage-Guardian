import Foundation
@testable import MortgageGuardian

// MARK: - Test Data Models for MortgageTestDataGenerator
// These types provide the data model used by test data generators
// for creating known mortgage violation patterns.

struct ExtractedMortgageData {
    let accountNumber: String
    let balanceInformation: BalanceInformation
    let paymentHistory: [PaymentRecord]
    let transactionHistory: [TransactionRecord]
    let loanTerms: LoanTerms
    let escrowAnalysis: EscrowAnalysis?
    let contactInformation: ContactInformation
    let statementDate: Date
    let documentMetadata: DocumentMetadata
}

struct BalanceInformation {
    let principalBalance: Double
    let interestBalance: Double
    let escrowBalance: Double
    let feesBalance: Double
    let totalBalance: Double
}

struct PaymentRecord {
    let date: Date
    let amount: Double
    let principalPortion: Double
    let interestPortion: Double
    let escrowPortion: Double
    let feesPortion: Double
    let transactionType: String
}

struct TransactionRecord {
    let date: Date
    let description: String
    let amount: Double
    let transactionType: String
    let runningBalance: Double
}

struct LoanTerms {
    let originalAmount: Double
    let interestRate: Double
    let termInMonths: Int
    let paymentAmount: Double
}

struct EscrowAnalysis {
    let propertyTaxes: Double
    let homeownersInsurance: Double
    let pmiPayment: Double
    let floodInsurance: Double
    let totalEscrowPayment: Double
    let escrowShortage: Double
    let escrowSurplus: Double
}

struct ContactInformation {
    let servicerName: String
    let servicerAddress: String
    let customerServicePhone: String
}

struct DocumentMetadata {
    let documentType: String
    let pageCount: Int
    let confidence: Double
}
