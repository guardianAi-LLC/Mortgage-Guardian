import Vision
import VisionKit
import SwiftUI
import CoreML
import NaturalLanguage
import OSLog
import Foundation
import Network
#if canImport(UIKit)
import UIKit
#else
import ImageIO
import MobileCoreServices
#endif

class DocumentAnalysisService: ObservableObject {
    enum DocumentType: String, CaseIterable {
        case bankStatement = "bank_statement"
        case payStub = "pay_stub"
        case taxReturn = "tax_return"
        case propertyAppraisal = "property_appraisal"
    }
    
    struct DocumentAnalysisResult {
        let type: DocumentType
        let extractedData: [String: Any]
        let confidence: Double
        let date: Date
        let mlResults: MLAnalysisResult?
        let aiInsights: AIInsights?
        let processingTime: Double
        let analysisId: String?
    }

    /// AI-generated insights from document analysis
    struct AIInsights: Codable {
        let summary: String
        let keyFindings: [String]
        let confidenceScore: Double
        let recommendations: [String]?
    }

    struct MLAnalysisResult {
        let structuredData: DocumentStructuredData
        let nlpInsights: NLPInsights
        let confidenceScores: [String: Double]
        let extractionQuality: ExtractionQuality
    }

    struct NLPInsights {
        let languageDetection: String
        let sentimentAnalysis: Double?
        let keyPhrases: [String]
        let namedEntities: [NamedEntity]
    }

    struct NamedEntity {
        let text: String
        let category: NLTag
        let confidence: Double
        let range: NSRange
    }

    struct ExtractionQuality {
        let overallScore: Double // 0.0 - 1.0
        let textClarity: Double
        let structuralIntegrity: Double
        let dataCompleteness: Double
    }

    protocol DocumentStructuredData {
        var documentType: DocumentType { get }
        var extractionConfidence: Double { get }
    }

    struct TaxReturnData: DocumentStructuredData {
        let documentType = DocumentType.taxReturn
        let extractionConfidence: Double

        let adjustedGrossIncome: Double?
        let totalIncome: Double?
        let taxLiability: Double?
        let deductions: TaxDeductions
        let filingStatus: FilingStatus?
        let dependents: Int?
        let taxYear: Int?
        let refundAmount: Double?
        let preparedBy: String?
    }

    struct TaxDeductions {
        let standardDeduction: Double?
        let itemizedDeductions: Double?
        let mortgageInterest: Double?
        let stateAndLocalTaxes: Double?
        let charitableContributions: Double?
    }

    enum FilingStatus: String, CaseIterable {
        case single = "Single"
        case marriedFilingJointly = "Married Filing Jointly"
        case marriedFilingSeparately = "Married Filing Separately"
        case headOfHousehold = "Head of Household"
        case qualifyingWidow = "Qualifying Widow(er)"
    }

    struct PropertyAppraisalData: DocumentStructuredData {
        let documentType = DocumentType.propertyAppraisal
        let extractionConfidence: Double

        let appraisedValue: Double?
        let effectiveDate: Date?
        let propertyAddress: String?
        let squareFootage: Int?
        let lotSize: Double?
        let yearBuilt: Int?
        let propertyType: String?
        let conditionRating: PropertyCondition?
        let comparableSales: [ComparableSale]
        let appraiserName: String?
        let appraisalCompany: String?
    }

    enum PropertyCondition: String, CaseIterable {
        case excellent = "Excellent"
        case good = "Good"
        case average = "Average"
        case fair = "Fair"
        case poor = "Poor"
    }

    struct ComparableSale {
        let address: String?
        let salePrice: Double?
        let saleDate: Date?
        let squareFootage: Int?
        let adjustments: Double?
    }

    struct EnhancedBankStatementData: DocumentStructuredData {
        let documentType = DocumentType.bankStatement
        let extractionConfidence: Double

        let accountNumber: String?
        let bankName: String?
        let statementPeriod: DateInterval?
        let openingBalance: Double?
        let closingBalance: Double?
        let transactions: [BankTransaction]
        let fees: [BankFee]
        let interestEarned: Double?
        let averageDailyBalance: Double?
    }

    struct BankTransaction {
        let date: Date?
        let description: String
        let amount: Double
        let type: TransactionType
        let category: TransactionCategory
        let confidence: Double
    }

    enum TransactionType: String, CaseIterable {
        case debit = "Debit"
        case credit = "Credit"
        case check = "Check"
        case transfer = "Transfer"
        case fee = "Fee"
        case interest = "Interest"
    }

    enum TransactionCategory: String, CaseIterable {
        case salary = "Salary/Wages"
        case mortgage = "Mortgage Payment"
        case utilities = "Utilities"
        case groceries = "Groceries"
        case gasoline = "Gasoline"
        case insurance = "Insurance"
        case medical = "Medical"
        case entertainment = "Entertainment"
        case restaurant = "Restaurant"
        case shopping = "Shopping"
        case transfer = "Transfer"
        case fee = "Bank Fee"
        case other = "Other"
    }

    struct BankFee {
        let type: String
        let amount: Double
        let date: Date?
    }

    struct EnhancedPayStubData: DocumentStructuredData {
        let documentType = DocumentType.payStub
        let extractionConfidence: Double

        let employerName: String?
        let employeeName: String?
        let payPeriod: DateInterval?
        let grossPay: PayAmount?
        let netPay: PayAmount?
        let deductions: PayrollDeductions
        let taxes: PayrollTaxes
        let yearToDateTotals: YearToDateTotals?
        let payRate: Double?
        let hoursWorked: Double?
    }

    struct PayAmount {
        let current: Double
        let yearToDate: Double
    }

    struct PayrollDeductions {
        let healthInsurance: Double?
        let dentalInsurance: Double?
        let retirement401k: Double?
        let lifeInsurance: Double?
        let otherDeductions: [String: Double]
    }

    struct PayrollTaxes {
        let federalIncomeTax: Double?
        let stateIncomeTax: Double?
        let socialSecurityTax: Double?
        let medicareTax: Double?
        let otherTaxes: [String: Double]
    }

    struct YearToDateTotals {
        let grossPay: Double
        let netPay: Double
        let federalTax: Double
        let stateTax: Double
        let socialSecurity: Double
        let medicare: Double
    }
    
    private let defaultRecognitionLanguages = ["en-US"]
    private let logger = Logger(subsystem: "com.mortgageguardian.analysis", category: "DocumentAnalysis")

    // API Client for Express backend
    private let apiClient = APIClient.shared

    // Network monitoring
    private let networkMonitor = NetworkMonitor()

    // Retry configuration for AWS calls
    private struct RetryConfiguration {
        let maxRetries: Int = 3
        let baseDelay: TimeInterval = 1.0
        let maxDelay: TimeInterval = 16.0
        let retryableErrors: Set<DocumentAnalysisError> = [
            .networkUnavailable,
            .awsBackendUnavailable,
            .requestTimeout,
            .awsQuotaExceeded
        ]
    }

    private let retryConfig = RetryConfiguration()

    // ML and NLP components (for fallback/local processing)
    private let nlProcessor = NLTagger(tagSchemes: [.nameType, .language, .sentimentScore])
    private var documentClassificationModel: MLModel?
    private var fieldExtractionModel: MLModel?

    // Processing preferences - prioritize cloud processing
    @Published var preferCloudProcessing = true // Always prefer cloud-based processing
    @Published var enableFallbackProcessing = true // Allow fallback to local processing only when cloud fails
    @Published var isOnline = true // Track network connectivity

    // Pattern matching for structured data extraction
    private let currencyPattern = "\\$?([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)"
    private let datePattern = "\\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\\d|3[01])[/-](?:19|20)?\\d{2}\\b"
    private let ssnPattern = "\\b\\d{3}-\\d{2}-\\d{4}\\b"
    private let phonePattern = "\\b(?:\\+?1[-.]?)?\\(?([0-9]{3})\\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\\b"

    init() {
        loadMLModels()
        setupNetworkMonitoring()
    }

    deinit {
        networkMonitor.stopMonitoring()
        logger.info("DocumentAnalysisService deinitialized")
    }

    /// Setup network monitoring for real-time connectivity updates
    private func setupNetworkMonitoring() {
        networkMonitor.onNetworkStatusChange = { [weak self] isConnected in
            DispatchQueue.main.async {
                self?.isOnline = isConnected
                self?.logger.info("Network connectivity changed: \(isConnected ? "connected" : "disconnected")")
            }
        }
        networkMonitor.startMonitoring()

        // Initial connectivity check
        Task {
            await checkNetworkConnectivity()
        }
    }

    /// Check network connectivity and update isOnline status
    @MainActor
    func checkNetworkConnectivity() async {
        do {
            // Use a lightweight HEAD request to check connectivity
            let url = URL(string: "\(APIConfiguration.baseURL)/health")!
            var request = URLRequest(url: url)
            request.httpMethod = "HEAD"
            request.timeoutInterval = 5.0

            let (_, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse {
                isOnline = (200...299).contains(httpResponse.statusCode)
                logger.info("Network connectivity check: \(isOnline ? "connected" : "disconnected") (status: \(httpResponse.statusCode))")
            } else {
                isOnline = false
                logger.warning("Network connectivity check failed: invalid response")
            }
        } catch {
            isOnline = false
            logger.warning("Network connectivity check failed: \(error.localizedDescription)")
        }
    }

    func analyzeDocument(_ image: CGImage, expectedType: DocumentType) async throws -> DocumentAnalysisResult {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Always attempt cloud processing first (unless explicitly disabled)
        if preferCloudProcessing && isOnline {
            do {
                logger.info("Starting cloud-based document analysis for type: \(expectedType.rawValue)")

                // Check Express backend availability before proceeding
                let isBackendAvailable = await isBackendAvailable()
                if !isBackendAvailable {
                    logger.warning("Express backend is not available, attempting fallback")
                    throw DocumentAnalysisError.awsBackendUnavailable
                }

                return try await analyzeDocumentWithBackend(image, expectedType: expectedType, startTime: startTime)
            } catch {
                let analysisError = DocumentAnalysisError.from(error)
                logger.warning("Express backend analysis failed: \(analysisError.localizedDescription)")

                // Only fallback if error suggests it might help and fallback is enabled
                if enableFallbackProcessing && analysisError.shouldFallbackToLocal {
                    logger.info("Falling back to local processing")
                    return try await analyzeDocumentLocally(image, expectedType: expectedType, startTime: startTime)
                } else {
                    // Re-throw the original error for user-actionable errors
                    throw analysisError
                }
            }
        } else if !isOnline && enableFallbackProcessing {
            // No network connection, use local processing if available
            logger.info("No network connection - using local document analysis for type: \(expectedType.rawValue)")
            return try await analyzeDocumentLocally(image, expectedType: expectedType, startTime: startTime)
        } else if !preferCloudProcessing {
            // Local processing explicitly requested
            logger.info("Local processing explicitly requested for type: \(expectedType.rawValue)")
            return try await analyzeDocumentLocally(image, expectedType: expectedType, startTime: startTime)
        } else {
            // No options available
            throw DocumentAnalysisError.serviceUnavailable
        }
    }

    /// Express backend document analysis with Claude AI
    private func analyzeDocumentWithBackend(_ image: CGImage, expectedType: DocumentType, startTime: CFAbsoluteTime) async throws -> DocumentAnalysisResult {
        // Validate image before processing
        try validateImage(image)

        // Extract text locally via OCR, then send text to Express for Claude analysis
        let ocrText: String
        do {
            let imageData = try convertImageToData(image)
            // Perform local OCR to get text for Express Claude endpoint
            ocrText = try await extractTextFromImage(image) ?? imageData.base64EncodedString()
        } catch {
            logger.error("Image processing failed: \(error.localizedDescription)")
            throw DocumentAnalysisError.imageConversionFailed
        }

        // Call Express backend for Claude AI analysis with retry logic
        let claudeResponse: ClaudeAnalysisResponse
        do {
            claudeResponse = try await performAWSCallWithRetry {
                try await self.apiClient.analyzeDocumentWithClaude(
                    documentText: ocrText,
                    documentType: expectedType.rawValue
                )
            }
        } catch {
            logger.error("Express backend analysis failed after retries: \(error.localizedDescription)")
            throw DocumentAnalysisError.from(error)
        }

        let processingTime = CFAbsoluteTimeGetCurrent() - startTime

        logger.info("Express backend analysis completed in \(processingTime) seconds")

        return DocumentAnalysisResult(
            type: expectedType,
            extractedData: ["analysis": claudeResponse.analysis],
            confidence: 1.0,
            date: Date(),
            mlResults: nil,
            aiInsights: nil,
            processingTime: processingTime,
            analysisId: nil
        )
    }

    /// Extract text from image using Vision framework OCR
    private func extractTextFromImage(_ image: CGImage) async throws -> String? {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([request])

        return request.results?
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
    }

    /// Local processing fallback using Vision framework and ML models
    private func analyzeDocumentLocally(_ image: CGImage, expectedType: DocumentType, startTime: CFAbsoluteTime) async throws -> DocumentAnalysisResult {
        // Validate image before processing
        try validateImage(image)

        // Use local Vision framework for OCR (Express backend handles its own OCR)
        var rawText = ""
        var observations: [VNRecognizedTextObservation] = []

        do {
            let textRequest = VNRecognizeTextRequest()
            textRequest.recognitionLevel = .accurate
            textRequest.usesLanguageCorrection = false
            textRequest.recognitionLanguages = defaultRecognitionLanguages

            let requestHandler = VNImageRequestHandler(cgImage: image)
            try await requestHandler.perform([textRequest])

            guard let obs = textRequest.results else {
                throw DocumentAnalysisError.noTextDetected
            }
            observations = obs
            rawText = obs.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")

            if rawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                throw DocumentAnalysisError.noTextDetected
            }

            logger.info("Successfully extracted text using Vision framework for local processing")
        } catch {
            logger.error("Vision framework text extraction failed")
            if error is DocumentAnalysisError {
                throw error
            } else {
                throw DocumentAnalysisError.textExtractionFailed
            }
        }

        // Basic parsed data
        var extractedData: [String: Any] = [:]

        switch expectedType {
        case .bankStatement:
            if !observations.isEmpty {
                extractedData = try await analyzeBankStatement(observations: observations, rawText: rawText)
            } else {
                extractedData = try await analyzeBankStatement(text: [rawText])
            }
        case .payStub:
            if !observations.isEmpty {
                extractedData = try await analyzePayStub(observations: observations, rawText: rawText)
            } else {
                extractedData = try await analyzePayStub(text: [rawText])
            }
        case .taxReturn:
            if !observations.isEmpty {
                extractedData = try await analyzeTaxReturn(observations: observations, rawText: rawText)
            } else {
                extractedData = try await analyzeTaxReturn(text: [rawText])
            }
        case .propertyAppraisal:
            if !observations.isEmpty {
                extractedData = try await analyzePropertyAppraisal(observations: observations, rawText: rawText)
            } else {
                extractedData = try await analyzePropertyAppraisal(text: [rawText])
            }
        }

        // Perform ML analysis for enhanced extraction
        let mlResults = await performMLAnalysis(
            rawText: rawText,
            observations: observations,
            documentType: expectedType
        )

        let confidence = observations.isEmpty ? 1.0 : calculateConfidence(observations)
        let processingTime = CFAbsoluteTimeGetCurrent() - startTime

        logger.info("Local analysis completed in \(processingTime) seconds")

        return DocumentAnalysisResult(
            type: expectedType,
            extractedData: extractedData,
            confidence: confidence,
            date: Date(),
            mlResults: mlResults,
            aiInsights: nil,
            processingTime: processingTime,
            analysisId: nil
        )
    }

    // MARK: - Helper Methods

    private func validateImage(_ image: CGImage) throws {
        let width = image.width
        let height = image.height

        // Check minimum dimensions
        let minDimensions = CGSize(width: 100, height: 100)
        if width < Int(minDimensions.width) || height < Int(minDimensions.height) {
            throw DocumentAnalysisError.imageTooSmall(minDimensions: minDimensions)
        }

        // Check maximum dimensions (to prevent memory issues)
        let maxDimensions = 4096
        if width > maxDimensions || height > maxDimensions {
            // Calculate approximate size
            let bytesPerPixel = 4 // RGBA
            let approximateSize = width * height * bytesPerPixel
            let maxSize = 10 * 1024 * 1024 // 10MB
            throw DocumentAnalysisError.imageTooLarge(maxSizeBytes: maxSize)
        }

        logger.debug("Image validation passed: \(width)x\(height)")
    }

    private func convertImageToData(_ image: CGImage) throws -> Data {
        #if canImport(UIKit)
        let uiImage = UIImage(cgImage: image)

        guard let jpegData = uiImage.jpegData(compressionQuality: 0.8) else {
            throw DocumentAnalysisError.imageConversionFailed
        }

        // Check file size
        let maxFileSize = 10 * 1024 * 1024 // 10MB
        if jpegData.count > maxFileSize {
            throw DocumentAnalysisError.imageTooLarge(maxSizeBytes: maxFileSize)
        }

        return jpegData
        #else
        guard let data = CFDataCreateMutable(nil, 0) else {
            throw DocumentAnalysisError.imageConversionFailed
        }
        guard let dest = CGImageDestinationCreateWithData(data, kUTTypeJPEG, 1, nil) else {
            throw DocumentAnalysisError.imageConversionFailed
        }

        // Set JPEG quality
        let options = [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary
        CGImageDestinationAddImage(dest, image, options)

        if !CGImageDestinationFinalize(dest) {
            throw DocumentAnalysisError.imageConversionFailed
        }

        let resultData = data as Data

        // Check file size
        let maxFileSize = 10 * 1024 * 1024 // 10MB
        if resultData.count > maxFileSize {
            throw DocumentAnalysisError.imageTooLarge(maxSizeBytes: maxFileSize)
        }

        return resultData
        #endif
    }

    private func convertAnyCodableToStringAny(_ anyCodableDict: [String: AnyCodable]) -> [String: Any] {
        return anyCodableDict.mapValues { $0.value }
    }

    // MARK: - Express Backend Integration Methods

    /// Upload document for async processing via Express backend
    func uploadDocumentForProcessing(
        _ image: CGImage,
        documentType: DocumentType
    ) async throws -> DocumentUploadResponse {
        logger.info("Uploading document for processing: \(documentType.rawValue)")

        let imageData = try convertImageToData(image)
        let base64Content = imageData.base64EncodedString()
        let documentId = UUID().uuidString

        return try await performAWSCallWithRetry {
            try await self.apiClient.uploadDocument(
                documentId: documentId,
                fileName: "document.jpg",
                documentType: documentType.rawValue,
                content: base64Content
            )
        }
    }

    /// Get analysis results for async processing
    func getDocumentAnalysisResults(documentId: String) async throws -> ExpressDocumentAnalysisResponse {
        logger.info("Retrieving analysis results for document: \(documentId)")

        return try await performAWSCallWithRetry {
            try await self.apiClient.getDocumentAnalysis(documentId: documentId)
        }
    }

    /// Configure processing preferences
    func setProcessingPreferences(preferCloud: Bool, enableFallback: Bool) {
        preferCloudProcessing = preferCloud
        enableFallbackProcessing = enableFallback
        logger.info("Processing preferences updated - Cloud: \(preferCloud), Fallback: \(enableFallback)")
    }

    /// Manual refresh of network connectivity status
    func refreshNetworkStatus() async {
        await checkNetworkConnectivity()
    }

    /// Get current processing status and capabilities
    func getProcessingStatus() -> ProcessingStatus {
        return ProcessingStatus(
            isOnline: isOnline,
            preferCloudProcessing: preferCloudProcessing,
            enableFallbackProcessing: enableFallbackProcessing,
            awsBackendAvailable: nil // Would need async check
        )
    }

    /// Processing status information
    struct ProcessingStatus {
        let isOnline: Bool
        let preferCloudProcessing: Bool
        let enableFallbackProcessing: Bool
        let awsBackendAvailable: Bool?
    }

    /// Check if Express backend is available with lightweight health check
    func isBackendAvailable() async -> Bool {
        do {
            // Use a lightweight health check endpoint instead of full analysis
            let url = URL(string: "\(APIConfiguration.baseURL)/health")!
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            request.timeoutInterval = 10.0

            let (_, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse {
                let isAvailable = (200...299).contains(httpResponse.statusCode)
                logger.info("Express backend availability check: \(isAvailable ? "available" : "unavailable") (status: \(httpResponse.statusCode))")
                return isAvailable
            } else {
                logger.warning("Express backend availability check failed: invalid response type")
                return false
            }
        } catch {
            let analysisError = DocumentAnalysisError.from(error)
            logger.warning("Express backend availability check failed: \(analysisError.localizedDescription)")

            // Log specific error types for debugging
            switch analysisError {
            case .networkUnavailable:
                logger.debug("Network unavailable during availability check")
            case .awsAuthenticationFailed:
                logger.debug("AWS authentication failed during availability check")
            case .awsBackendUnavailable:
                logger.debug("Express backend service unavailable")
            default:
                logger.debug("Availability check failed with error: \(analysisError)")
            }

            return false
        }
    }

    /// Process extracted text with ML models (for external service integration)
    func processWithML(
        text: String,
        type: DocumentType
    ) async throws -> DocumentAnalysisResult {
        let startTime = CFAbsoluteTimeGetCurrent()
        logger.info("Processing text with ML models for type: \(type.rawValue)")

        // Basic extracted data
        var extractedData: [String: Any] = [:]

        switch type {
        case .bankStatement:
            extractedData = try await analyzeBankStatementFromText(text)
        case .payStub:
            extractedData = try await analyzePayStubFromText(text)
        case .taxReturn:
            extractedData = try await analyzeTaxReturnFromText(text)
        case .propertyAppraisal:
            extractedData = try await analyzePropertyAppraisalFromText(text)
        }

        // Perform ML analysis for enhanced extraction
        let mlResults = await performMLAnalysis(
            rawText: text,
            observations: [], // No observations for text-only processing
            documentType: type
        )

        let confidence = 0.8 // Default confidence for text-only processing
        let processingTime = CFAbsoluteTimeGetCurrent() - startTime

        logger.info("ML text processing completed in \(processingTime) seconds")

        return DocumentAnalysisResult(
            type: type,
            extractedData: extractedData,
            confidence: confidence,
            date: Date(),
            mlResults: mlResults,
            aiInsights: nil,
            processingTime: processingTime,
            analysisId: nil
        )
    }
    
    private func analyzeBankStatement(text: [String]) async throws -> [String: Any] {
        logger.info("Analyzing bank statement from text array")
        let fullText = text.joined(separator: "\n")
        return try await analyzeBankStatementFromText(fullText)
    }

    private func analyzeBankStatement(observations: [VNRecognizedTextObservation], rawText: String) async throws -> [String: Any] {
        logger.info("Analyzing bank statement from Vision observations")

        // Extract enhanced structured data using ML techniques
        let structuredData = try await extractEnhancedBankStatementData(observations: observations, rawText: rawText)

        return [
            "structured_data": structuredData,
            "opening_balance": structuredData.openingBalance ?? 0.0,
            "closing_balance": structuredData.closingBalance ?? 0.0,
            "transactions_count": structuredData.transactions.count,
            "total_fees": structuredData.fees.reduce(0.0) { $0 + $1.amount },
            "interest_earned": structuredData.interestEarned ?? 0.0,
            "account_number": structuredData.accountNumber ?? "",
            "bank_name": structuredData.bankName ?? "",
            "confidence": structuredData.extractionConfidence
        ]
    }

    private func analyzePayStub(text: [String]) async throws -> [String: Any] {
        logger.info("Analyzing pay stub from text array")
        let fullText = text.joined(separator: "\n")
        return try await analyzePayStubFromText(fullText)
    }

    private func analyzePayStub(observations: [VNRecognizedTextObservation], rawText: String) async throws -> [String: Any] {
        logger.info("Analyzing pay stub from Vision observations")

        // Extract enhanced structured data using ML techniques
        let structuredData = try await extractEnhancedPayStubData(observations: observations, rawText: rawText)

        return [
            "structured_data": structuredData,
            "gross_pay_current": structuredData.grossPay?.current ?? 0.0,
            "net_pay_current": structuredData.netPay?.current ?? 0.0,
            "gross_pay_ytd": structuredData.grossPay?.yearToDate ?? 0.0,
            "net_pay_ytd": structuredData.netPay?.yearToDate ?? 0.0,
            "employer_name": structuredData.employerName ?? "",
            "employee_name": structuredData.employeeName ?? "",
            "pay_rate": structuredData.payRate ?? 0.0,
            "hours_worked": structuredData.hoursWorked ?? 0.0,
            "confidence": structuredData.extractionConfidence
        ]
    }
    
    private func analyzeTaxReturn(text: [String]) async throws -> [String: Any] {
        logger.info("Analyzing tax return from text array")
        let fullText = text.joined(separator: "\n")
        return try await analyzeTaxReturnFromText(fullText)
    }

    private func analyzeTaxReturn(observations: [VNRecognizedTextObservation], rawText: String) async throws -> [String: Any] {
        logger.info("Analyzing tax return from Vision observations")

        // Extract structured data using ML techniques
        let structuredData = try await extractTaxReturnData(observations: observations, rawText: rawText)

        return [
            "structured_data": structuredData,
            "agi": structuredData.adjustedGrossIncome ?? 0.0,
            "total_income": structuredData.totalIncome ?? 0.0,
            "tax_liability": structuredData.taxLiability ?? 0.0,
            "filing_status": structuredData.filingStatus?.rawValue ?? "Unknown",
            "dependents": structuredData.dependents ?? 0,
            "tax_year": structuredData.taxYear ?? Calendar.current.component(.year, from: Date()),
            "confidence": structuredData.extractionConfidence
        ]
    }
    
    private func analyzePropertyAppraisal(text: [String]) async throws -> [String: Any] {
        logger.info("Analyzing property appraisal from text array")
        let fullText = text.joined(separator: "\n")
        return try await analyzePropertyAppraisalFromText(fullText)
    }

    private func analyzePropertyAppraisal(observations: [VNRecognizedTextObservation], rawText: String) async throws -> [String: Any] {
        logger.info("Analyzing property appraisal from Vision observations")

        // Extract structured data using ML techniques
        let structuredData = try await extractPropertyAppraisalData(observations: observations, rawText: rawText)

        return [
            "structured_data": structuredData,
            "appraised_value": structuredData.appraisedValue ?? 0.0,
            "property_address": structuredData.propertyAddress ?? "",
            "square_footage": structuredData.squareFootage ?? 0,
            "year_built": structuredData.yearBuilt ?? 0,
            "condition_rating": structuredData.conditionRating?.rawValue ?? "Unknown",
            "comparable_sales_count": structuredData.comparableSales.count,
            "confidence": structuredData.extractionConfidence
        ]
    }
    
    private func calculateConfidence(_ observations: [VNRecognizedTextObservation]) -> Double {
        let confidences = observations.compactMap { $0.topCandidates(1).first?.confidence }
        return confidences.reduce(0.0, +) / Double(confidences.count)
    }

    // MARK: - Simple text extraction helpers
    private func extractCurrencyNumbers(from text: String) -> [Double] {
        // Match patterns like $1,234.56 or 1,234.56
        let pattern = "\\$?([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)"
        do {
            let regex = try NSRegularExpression(pattern: pattern, options: [])
            let ns = text as NSString
            let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: ns.length))
            return matches.compactMap { m in
                if m.numberOfRanges > 1 {
                    let s = ns.substring(with: m.range(at: 1)).replacingOccurrences(of: ",", with: "")
                    return Double(s)
                }
                return nil
            }
        } catch {
            return []
        }
    }

    private func firstMatchingNumber(prefixes: [String], in text: String) -> Double? {
        let lines = text.components(separatedBy: "\n")
        for line in lines {
            for prefix in prefixes {
                if line.localizedCaseInsensitiveContains(prefix) {
                    let nums = extractCurrencyNumbers(from: line)
                    if let first = nums.first { return first }
                }
            }
        }
        // Last ditch: return first currency-like number in the whole text
        return extractCurrencyNumbers(from: text).first
    }

    // MARK: - ML Model Loading and Management

    private func loadMLModels() {
        Task {
            await loadDocumentClassificationModel()
            await loadFieldExtractionModel()
        }
    }

    private func loadDocumentClassificationModel() async {
        do {
            if let modelURL = Bundle.main.url(forResource: "DocumentClassifier", withExtension: "mlmodelc") ??
                              Bundle.main.url(forResource: "DocumentClassifier", withExtension: "mlmodel") {
                documentClassificationModel = try MLModel(contentsOf: modelURL)
                logger.info("Loaded DocumentClassifier model")
            } else {
                logger.warning("DocumentClassifier model not found - using algorithmic fallback")
            }
        } catch {
            logger.error("Failed to load DocumentClassifier: \(error.localizedDescription)")
        }
    }

    private func loadFieldExtractionModel() async {
        do {
            if let modelURL = Bundle.main.url(forResource: "FieldExtractor", withExtension: "mlmodelc") ??
                              Bundle.main.url(forResource: "FieldExtractor", withExtension: "mlmodel") {
                fieldExtractionModel = try MLModel(contentsOf: modelURL)
                logger.info("Loaded FieldExtractor model")
            } else {
                logger.warning("FieldExtractor model not found - using algorithmic fallback")
            }
        } catch {
            logger.error("Failed to load FieldExtractor: \(error.localizedDescription)")
        }
    }

    // MARK: - ML Analysis Orchestration

    private func performMLAnalysis(
        rawText: String,
        observations: [VNRecognizedTextObservation],
        documentType: DocumentType
    ) async -> MLAnalysisResult? {
        do {
            logger.info("Performing ML analysis for document type: \(documentType)")

            // Perform NLP analysis
            let nlpInsights = await performNLPAnalysis(text: rawText)

            // Extract structured data based on document type
            let structuredData: DocumentStructuredData
            switch documentType {
            case .taxReturn:
                structuredData = try await extractTaxReturnData(observations: observations, rawText: rawText)
            case .propertyAppraisal:
                structuredData = try await extractPropertyAppraisalData(observations: observations, rawText: rawText)
            case .bankStatement:
                structuredData = try await extractEnhancedBankStatementData(observations: observations, rawText: rawText)
            case .payStub:
                structuredData = try await extractEnhancedPayStubData(observations: observations, rawText: rawText)
            }

            // Calculate confidence scores
            let confidenceScores = calculateMLConfidenceScores(
                structuredData: structuredData,
                nlpInsights: nlpInsights,
                observations: observations
            )

            // Assess extraction quality
            let extractionQuality = assessExtractionQuality(
                structuredData: structuredData,
                rawText: rawText,
                observations: observations
            )

            return MLAnalysisResult(
                structuredData: structuredData,
                nlpInsights: nlpInsights,
                confidenceScores: confidenceScores,
                extractionQuality: extractionQuality
            )
        } catch {
            logger.error("ML analysis failed: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - NLP Analysis

    private func performNLPAnalysis(text: String) async -> NLPInsights {
        logger.info("Performing NLP analysis")

        // Language detection
        nlProcessor.string = text
        let languageCode = nlProcessor.dominantLanguage?.rawValue ?? "en"

        // Named entity recognition
        let namedEntities = extractNamedEntities(from: text)

        // Key phrase extraction using statistical methods
        let keyPhrases = extractKeyPhrases(from: text)

        // Sentiment analysis (if applicable - mainly for document quality assessment)
        let sentiment = calculateDocumentSentiment(text: text)

        return NLPInsights(
            languageDetection: languageCode,
            sentimentAnalysis: sentiment,
            keyPhrases: keyPhrases,
            namedEntities: namedEntities
        )
    }

    private func extractNamedEntities(from text: String) -> [NamedEntity] {
        let tagger = NLTagger(tagSchemes: [.nameType])
        tagger.string = text

        var entities: [NamedEntity] = []

        tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .nameType) { tag, range in
            if let tag = tag {
                let entityText = String(text[range])
                let nsRange = NSRange(range, in: text)
                let confidence = 0.8 // Default confidence for NLTagger

                let entity = NamedEntity(
                    text: entityText,
                    category: tag,
                    confidence: confidence,
                    range: nsRange
                )
                entities.append(entity)
            }
            return true
        }

        return entities
    }

    private func extractKeyPhrases(from text: String) -> [String] {
        // Simple key phrase extraction using word frequency and patterns
        let words = text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 3 }

        let wordFreq = Dictionary(grouping: words, by: { $0 })
            .mapValues { $0.count }
            .sorted { $0.value > $1.value }

        // Return top frequent words as key phrases
        return Array(wordFreq.prefix(10).map { $0.key })
    }

    private func calculateDocumentSentiment(text: String) -> Double? {
        let tagger = NLTagger(tagSchemes: [.sentimentScore])
        tagger.string = text

        var sentimentSum = 0.0
        var sentimentCount = 0

        tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .sentence, scheme: .sentimentScore) { tag, _ in
            if let tag = tag, let score = Double(tag.rawValue) {
                sentimentSum += score
                sentimentCount += 1
            }
            return true
        }

        return sentimentCount > 0 ? sentimentSum / Double(sentimentCount) : nil
    }

    // MARK: - Tax Return Analysis

    private func analyzeTaxReturnFromText(_ text: String) async throws -> [String: Any] {
        let structuredData = try await extractTaxReturnDataFromText(text)

        return [
            "structured_data": structuredData,
            "agi": structuredData.adjustedGrossIncome ?? 0.0,
            "total_income": structuredData.totalIncome ?? 0.0,
            "tax_liability": structuredData.taxLiability ?? 0.0,
            "filing_status": structuredData.filingStatus?.rawValue ?? "Unknown",
            "dependents": structuredData.dependents ?? 0,
            "tax_year": structuredData.taxYear ?? Calendar.current.component(.year, from: Date()),
            "confidence": structuredData.extractionConfidence
        ]
    }

    private func extractTaxReturnData(observations: [VNRecognizedTextObservation], rawText: String) async throws -> TaxReturnData {
        logger.info("Extracting tax return structured data")

        // Extract key financial figures using pattern matching
        let agi = extractAdjustedGrossIncome(from: rawText)
        let totalIncome = extractTotalIncome(from: rawText)
        let taxLiability = extractTaxLiability(from: rawText)
        let filingStatus = extractFilingStatus(from: rawText)
        let dependents = extractDependents(from: rawText)
        let taxYear = extractTaxYear(from: rawText)
        let refundAmount = extractRefundAmount(from: rawText)
        let preparedBy = extractPreparedBy(from: rawText)

        // Extract deductions
        let deductions = extractTaxDeductions(from: rawText)

        // Calculate extraction confidence
        let confidence = calculateTaxReturnExtractionConfidence(
            agi: agi,
            totalIncome: totalIncome,
            taxLiability: taxLiability,
            filingStatus: filingStatus,
            deductions: deductions
        )

        return TaxReturnData(
            extractionConfidence: confidence,
            adjustedGrossIncome: agi,
            totalIncome: totalIncome,
            taxLiability: taxLiability,
            deductions: deductions,
            filingStatus: filingStatus,
            dependents: dependents,
            taxYear: taxYear,
            refundAmount: refundAmount,
            preparedBy: preparedBy
        )
    }

    private func extractTaxReturnDataFromText(_ text: String) async throws -> TaxReturnData {
        logger.info("Extracting tax return data from plain text")

        // Use the same extraction logic as the observation-based method
        let agi = extractAdjustedGrossIncome(from: text)
        let totalIncome = extractTotalIncome(from: text)
        let taxLiability = extractTaxLiability(from: text)
        let filingStatus = extractFilingStatus(from: text)
        let dependents = extractDependents(from: text)
        let taxYear = extractTaxYear(from: text)
        let refundAmount = extractRefundAmount(from: text)
        let preparedBy = extractPreparedBy(from: text)

        // Extract deductions
        let deductions = extractTaxDeductions(from: text)

        // Calculate extraction confidence
        let confidence = calculateTaxReturnExtractionConfidence(
            agi: agi,
            totalIncome: totalIncome,
            taxLiability: taxLiability,
            filingStatus: filingStatus,
            deductions: deductions
        )

        return TaxReturnData(
            extractionConfidence: confidence,
            adjustedGrossIncome: agi,
            totalIncome: totalIncome,
            taxLiability: taxLiability,
            deductions: deductions,
            filingStatus: filingStatus,
            dependents: dependents,
            taxYear: taxYear,
            refundAmount: refundAmount,
            preparedBy: preparedBy
        )
    }

    // MARK: - Property Appraisal Analysis

    private func analyzePropertyAppraisalFromText(_ text: String) async throws -> [String: Any] {
        let structuredData = try await extractPropertyAppraisalDataFromText(text)

        return [
            "structured_data": structuredData,
            "appraised_value": structuredData.appraisedValue ?? 0.0,
            "property_address": structuredData.propertyAddress ?? "",
            "square_footage": structuredData.squareFootage ?? 0,
            "year_built": structuredData.yearBuilt ?? 0,
            "condition_rating": structuredData.conditionRating?.rawValue ?? "Unknown",
            "comparable_sales_count": structuredData.comparableSales.count,
            "confidence": structuredData.extractionConfidence
        ]
    }

    private func extractPropertyAppraisalData(observations: [VNRecognizedTextObservation], rawText: String) async throws -> PropertyAppraisalData {
        logger.info("Extracting property appraisal structured data")

        // Extract key property information
        let appraisedValue = extractAppraisedValue(from: rawText)
        let effectiveDate = extractAppraisalDate(from: rawText)
        let propertyAddress = extractPropertyAddress(from: rawText)
        let squareFootage = extractSquareFootage(from: rawText)
        let lotSize = extractLotSize(from: rawText)
        let yearBuilt = extractYearBuilt(from: rawText)
        let propertyType = extractPropertyType(from: rawText)
        let conditionRating = extractConditionRating(from: rawText)
        let comparableSales = extractComparableSales(from: rawText)
        let appraiserName = extractAppraiserName(from: rawText)
        let appraisalCompany = extractAppraisalCompany(from: rawText)

        // Calculate extraction confidence
        let confidence = calculateAppraisalExtractionConfidence(
            appraisedValue: appraisedValue,
            propertyAddress: propertyAddress,
            squareFootage: squareFootage,
            comparableSales: comparableSales
        )

        return PropertyAppraisalData(
            extractionConfidence: confidence,
            appraisedValue: appraisedValue,
            effectiveDate: effectiveDate,
            propertyAddress: propertyAddress,
            squareFootage: squareFootage,
            lotSize: lotSize,
            yearBuilt: yearBuilt,
            propertyType: propertyType,
            conditionRating: conditionRating,
            comparableSales: comparableSales,
            appraiserName: appraiserName,
            appraisalCompany: appraisalCompany
        )
    }

    private func extractPropertyAppraisalDataFromText(_ text: String) async throws -> PropertyAppraisalData {
        logger.info("Extracting property appraisal data from plain text")

        // Use the same extraction logic
        let appraisedValue = extractAppraisedValue(from: text)
        let effectiveDate = extractAppraisalDate(from: text)
        let propertyAddress = extractPropertyAddress(from: text)
        let squareFootage = extractSquareFootage(from: text)
        let lotSize = extractLotSize(from: text)
        let yearBuilt = extractYearBuilt(from: text)
        let propertyType = extractPropertyType(from: text)
        let conditionRating = extractConditionRating(from: text)
        let comparableSales = extractComparableSales(from: text)
        let appraiserName = extractAppraiserName(from: text)
        let appraisalCompany = extractAppraisalCompany(from: text)

        let confidence = calculateAppraisalExtractionConfidence(
            appraisedValue: appraisedValue,
            propertyAddress: propertyAddress,
            squareFootage: squareFootage,
            comparableSales: comparableSales
        )

        return PropertyAppraisalData(
            extractionConfidence: confidence,
            appraisedValue: appraisedValue,
            effectiveDate: effectiveDate,
            propertyAddress: propertyAddress,
            squareFootage: squareFootage,
            lotSize: lotSize,
            yearBuilt: yearBuilt,
            propertyType: propertyType,
            conditionRating: conditionRating,
            comparableSales: comparableSales,
            appraiserName: appraiserName,
            appraisalCompany: appraisalCompany
        )
    }

    // MARK: - Enhanced Bank Statement Analysis

    private func analyzeBankStatementFromText(_ text: String) async throws -> [String: Any] {
        let structuredData = try await extractEnhancedBankStatementDataFromText(text)

        return [
            "structured_data": structuredData,
            "opening_balance": structuredData.openingBalance ?? 0.0,
            "closing_balance": structuredData.closingBalance ?? 0.0,
            "transactions_count": structuredData.transactions.count,
            "total_fees": structuredData.fees.reduce(0.0) { $0 + $1.amount },
            "interest_earned": structuredData.interestEarned ?? 0.0,
            "account_number": structuredData.accountNumber ?? "",
            "bank_name": structuredData.bankName ?? "",
            "confidence": structuredData.extractionConfidence
        ]
    }

    private func extractEnhancedBankStatementData(observations: [VNRecognizedTextObservation], rawText: String) async throws -> EnhancedBankStatementData {
        logger.info("Extracting enhanced bank statement structured data")

        // Extract account information
        let accountNumber = extractAccountNumber(from: rawText)
        let bankName = extractBankName(from: rawText)
        let statementPeriod = extractStatementPeriod(from: rawText)
        let openingBalance = extractOpeningBalance(from: rawText)
        let closingBalance = extractClosingBalance(from: rawText)
        let interestEarned = extractInterestEarned(from: rawText)

        // Extract transactions with enhanced categorization
        let transactions = await extractBankTransactions(from: rawText, observations: observations)

        // Extract fees
        let fees = extractBankFees(from: rawText)

        // Calculate average daily balance
        let averageDailyBalance = calculateAverageDailyBalance(
            openingBalance: openingBalance,
            closingBalance: closingBalance,
            transactions: transactions
        )

        // Calculate extraction confidence
        let confidence = calculateBankStatementExtractionConfidence(
            accountNumber: accountNumber,
            bankName: bankName,
            openingBalance: openingBalance,
            closingBalance: closingBalance,
            transactions: transactions
        )

        return EnhancedBankStatementData(
            extractionConfidence: confidence,
            accountNumber: accountNumber,
            bankName: bankName,
            statementPeriod: statementPeriod,
            openingBalance: openingBalance,
            closingBalance: closingBalance,
            transactions: transactions,
            fees: fees,
            interestEarned: interestEarned,
            averageDailyBalance: averageDailyBalance
        )
    }

    private func extractEnhancedBankStatementDataFromText(_ text: String) async throws -> EnhancedBankStatementData {
        logger.info("Extracting enhanced bank statement data from plain text")

        // Use the same extraction logic without observations
        let accountNumber = extractAccountNumber(from: text)
        let bankName = extractBankName(from: text)
        let statementPeriod = extractStatementPeriod(from: text)
        let openingBalance = extractOpeningBalance(from: text)
        let closingBalance = extractClosingBalance(from: text)
        let interestEarned = extractInterestEarned(from: text)

        // Extract transactions
        let transactions = await extractBankTransactions(from: text, observations: [])

        // Extract fees
        let fees = extractBankFees(from: text)

        // Calculate average daily balance
        let averageDailyBalance = calculateAverageDailyBalance(
            openingBalance: openingBalance,
            closingBalance: closingBalance,
            transactions: transactions
        )

        let confidence = calculateBankStatementExtractionConfidence(
            accountNumber: accountNumber,
            bankName: bankName,
            openingBalance: openingBalance,
            closingBalance: closingBalance,
            transactions: transactions
        )

        return EnhancedBankStatementData(
            extractionConfidence: confidence,
            accountNumber: accountNumber,
            bankName: bankName,
            statementPeriod: statementPeriod,
            openingBalance: openingBalance,
            closingBalance: closingBalance,
            transactions: transactions,
            fees: fees,
            interestEarned: interestEarned,
            averageDailyBalance: averageDailyBalance
        )
    }

    // MARK: - Enhanced Pay Stub Analysis

    private func analyzePayStubFromText(_ text: String) async throws -> [String: Any] {
        let structuredData = try await extractEnhancedPayStubDataFromText(text)

        return [
            "structured_data": structuredData,
            "gross_pay_current": structuredData.grossPay?.current ?? 0.0,
            "net_pay_current": structuredData.netPay?.current ?? 0.0,
            "gross_pay_ytd": structuredData.grossPay?.yearToDate ?? 0.0,
            "net_pay_ytd": structuredData.netPay?.yearToDate ?? 0.0,
            "employer_name": structuredData.employerName ?? "",
            "employee_name": structuredData.employeeName ?? "",
            "pay_rate": structuredData.payRate ?? 0.0,
            "hours_worked": structuredData.hoursWorked ?? 0.0,
            "confidence": structuredData.extractionConfidence
        ]
    }

    private func extractEnhancedPayStubData(observations: [VNRecognizedTextObservation], rawText: String) async throws -> EnhancedPayStubData {
        logger.info("Extracting enhanced pay stub structured data")

        // Extract basic information
        let employerName = extractEmployerName(from: rawText)
        let employeeName = extractEmployeeName(from: rawText)
        let payPeriod = extractPayPeriod(from: rawText)
        let payRate = extractPayRate(from: rawText)
        let hoursWorked = extractHoursWorked(from: rawText)

        // Extract pay amounts
        let grossPay = extractGrossPay(from: rawText)
        let netPay = extractNetPay(from: rawText)

        // Extract deductions
        let deductions = extractPayrollDeductions(from: rawText)

        // Extract taxes
        let taxes = extractPayrollTaxes(from: rawText)

        // Extract year-to-date totals
        let ytdTotals = extractYearToDateTotals(from: rawText)

        // Calculate extraction confidence
        let confidence = calculatePayStubExtractionConfidence(
            employerName: employerName,
            grossPay: grossPay,
            netPay: netPay,
            deductions: deductions,
            taxes: taxes
        )

        return EnhancedPayStubData(
            extractionConfidence: confidence,
            employerName: employerName,
            employeeName: employeeName,
            payPeriod: payPeriod,
            grossPay: grossPay,
            netPay: netPay,
            deductions: deductions,
            taxes: taxes,
            yearToDateTotals: ytdTotals,
            payRate: payRate,
            hoursWorked: hoursWorked
        )
    }

    private func extractEnhancedPayStubDataFromText(_ text: String) async throws -> EnhancedPayStubData {
        logger.info("Extracting enhanced pay stub data from plain text")

        // Use the same extraction logic
        let employerName = extractEmployerName(from: text)
        let employeeName = extractEmployeeName(from: text)
        let payPeriod = extractPayPeriod(from: text)
        let payRate = extractPayRate(from: text)
        let hoursWorked = extractHoursWorked(from: text)

        let grossPay = extractGrossPay(from: text)
        let netPay = extractNetPay(from: text)
        let deductions = extractPayrollDeductions(from: text)
        let taxes = extractPayrollTaxes(from: text)
        let ytdTotals = extractYearToDateTotals(from: text)

        let confidence = calculatePayStubExtractionConfidence(
            employerName: employerName,
            grossPay: grossPay,
            netPay: netPay,
            deductions: deductions,
            taxes: taxes
        )

        return EnhancedPayStubData(
            extractionConfidence: confidence,
            employerName: employerName,
            employeeName: employeeName,
            payPeriod: payPeriod,
            grossPay: grossPay,
            netPay: netPay,
            deductions: deductions,
            taxes: taxes,
            yearToDateTotals: ytdTotals,
            payRate: payRate,
            hoursWorked: hoursWorked
        )
    }

    // MARK: - Network Monitoring with Retry Logic

    /// Perform AWS API call with retry logic and exponential backoff
    private func performAWSCallWithRetry<T>(
        operation: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?

        for attempt in 1...(retryConfig.maxRetries + 1) {
            do {
                return try await operation()
            } catch {
                lastError = error
                let analysisError = DocumentAnalysisError.from(error)

                // Don't retry if it's not a retryable error or we've exhausted retries
                if !retryConfig.retryableErrors.contains(analysisError) || attempt > retryConfig.maxRetries {
                    logger.error("AWS call failed after \(attempt) attempts: \(analysisError.localizedDescription)")
                    throw analysisError
                }

                // Calculate exponential backoff delay
                let delay = min(
                    retryConfig.baseDelay * pow(2.0, Double(attempt - 1)),
                    retryConfig.maxDelay
                )

                logger.warning("AWS call failed (attempt \(attempt)/\(retryConfig.maxRetries + 1)), retrying in \(delay)s: \(analysisError.localizedDescription)")

                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }

        // This should never be reached, but just in case
        throw lastError ?? DocumentAnalysisError.unknownError(underlying: NSError(domain: "DocumentAnalysisService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Unexpected retry failure"]))
    }

}

// MARK: - Network Monitor Implementation

/// Network connectivity monitor using Network framework
class NetworkMonitor {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    private let logger = Logger(subsystem: "com.mortgageguardian.analysis", category: "NetworkMonitor")

    var onNetworkStatusChange: ((Bool) -> Void)?

    private(set) var isConnected = false {
        didSet {
            if oldValue != isConnected {
                onNetworkStatusChange?(isConnected)
            }
        }
    }

    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied

            DispatchQueue.main.async {
                self?.isConnected = connected
            }

            self?.logger.info("Network status changed: \(connected ? "connected" : "disconnected")")

            if connected {
                self?.logger.debug("Network interface types: \(path.availableInterfaces.map { $0.type.description }.joined(separator: ", "))")
            }
        }

        monitor.start(queue: queue)
        logger.info("Network monitoring started")
    }

    func stopMonitoring() {
        monitor.cancel()
        logger.info("Network monitoring stopped")
    }

    deinit {
        stopMonitoring()
    }
}

// MARK: - Network Interface Type Extension

extension NWInterface.InterfaceType {
    var description: String {
        switch self {
        case .cellular:
            return "cellular"
        case .wifi:
            return "wifi"
        case .wiredEthernet:
            return "ethernet"
        case .loopback:
            return "loopback"
        case .other:
            return "other"
        @unknown default:
            return "unknown"
        }
    }
}