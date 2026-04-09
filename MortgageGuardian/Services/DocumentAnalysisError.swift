import Foundation

/// Comprehensive error types for document analysis operations
enum DocumentAnalysisError: Error, LocalizedError, Equatable, Hashable {
    // Image processing errors
    case imageConversionFailed
    case imageDataCorrupted
    case imageFormatNotSupported
    case imageTooLarge(maxSizeBytes: Int)
    case imageTooSmall(minDimensions: CGSize)

    // Network and AWS errors
    case networkUnavailable
    case awsBackendUnavailable
    case awsAuthenticationFailed
    case awsQuotaExceeded
    case awsServiceError(code: Int, message: String)
    case requestTimeout
    case invalidAPIResponse

    // Document processing errors
    case noTextDetected
    case documentTypeNotSupported(type: String)
    case documentQualityTooLow(score: Double)
    case textExtractionFailed
    case mlModelUnavailable
    case processingInterrupted

    // Configuration errors
    case awsCredentialsNotConfigured
    case textractNotConfigured
    case invalidConfiguration(reason: String)

    // Data validation errors
    case invalidExtractedData
    case confidenceTooLow(score: Double, minimum: Double)
    case missingRequiredFields([String])
    case dataIntegrityCheckFailed

    // General errors
    case unknownError(underlying: Error)
    case operationCancelled
    case serviceUnavailable

    // MARK: - Equatable conformance (manual due to Error associated value)

    static func == (lhs: DocumentAnalysisError, rhs: DocumentAnalysisError) -> Bool {
        switch (lhs, rhs) {
        case (.imageConversionFailed, .imageConversionFailed),
             (.imageDataCorrupted, .imageDataCorrupted),
             (.imageFormatNotSupported, .imageFormatNotSupported),
             (.networkUnavailable, .networkUnavailable),
             (.awsBackendUnavailable, .awsBackendUnavailable),
             (.awsAuthenticationFailed, .awsAuthenticationFailed),
             (.awsQuotaExceeded, .awsQuotaExceeded),
             (.requestTimeout, .requestTimeout),
             (.invalidAPIResponse, .invalidAPIResponse),
             (.noTextDetected, .noTextDetected),
             (.textExtractionFailed, .textExtractionFailed),
             (.mlModelUnavailable, .mlModelUnavailable),
             (.processingInterrupted, .processingInterrupted),
             (.awsCredentialsNotConfigured, .awsCredentialsNotConfigured),
             (.textractNotConfigured, .textractNotConfigured),
             (.invalidExtractedData, .invalidExtractedData),
             (.dataIntegrityCheckFailed, .dataIntegrityCheckFailed),
             (.operationCancelled, .operationCancelled),
             (.serviceUnavailable, .serviceUnavailable):
            return true
        case (.imageTooLarge(let a), .imageTooLarge(let b)):
            return a == b
        case (.imageTooSmall(let a), .imageTooSmall(let b)):
            return a == b
        case (.awsServiceError(let c1, let m1), .awsServiceError(let c2, let m2)):
            return c1 == c2 && m1 == m2
        case (.documentTypeNotSupported(let a), .documentTypeNotSupported(let b)):
            return a == b
        case (.documentQualityTooLow(let a), .documentQualityTooLow(let b)):
            return a == b
        case (.invalidConfiguration(let a), .invalidConfiguration(let b)):
            return a == b
        case (.confidenceTooLow(let s1, let m1), .confidenceTooLow(let s2, let m2)):
            return s1 == s2 && m1 == m2
        case (.missingRequiredFields(let a), .missingRequiredFields(let b)):
            return a == b
        case (.unknownError(let a), .unknownError(let b)):
            return a.localizedDescription == b.localizedDescription
        default:
            return false
        }
    }

    // MARK: - Hashable conformance

    func hash(into hasher: inout Hasher) {
        switch self {
        case .imageConversionFailed: hasher.combine(0)
        case .imageDataCorrupted: hasher.combine(1)
        case .imageFormatNotSupported: hasher.combine(2)
        case .imageTooLarge(let v): hasher.combine(3); hasher.combine(v)
        case .imageTooSmall(let v): hasher.combine(4); hasher.combine(v.width); hasher.combine(v.height)
        case .networkUnavailable: hasher.combine(5)
        case .awsBackendUnavailable: hasher.combine(6)
        case .awsAuthenticationFailed: hasher.combine(7)
        case .awsQuotaExceeded: hasher.combine(8)
        case .awsServiceError(let c, let m): hasher.combine(9); hasher.combine(c); hasher.combine(m)
        case .requestTimeout: hasher.combine(10)
        case .invalidAPIResponse: hasher.combine(11)
        case .noTextDetected: hasher.combine(12)
        case .documentTypeNotSupported(let t): hasher.combine(13); hasher.combine(t)
        case .documentQualityTooLow(let s): hasher.combine(14); hasher.combine(s)
        case .textExtractionFailed: hasher.combine(15)
        case .mlModelUnavailable: hasher.combine(16)
        case .processingInterrupted: hasher.combine(17)
        case .awsCredentialsNotConfigured: hasher.combine(18)
        case .textractNotConfigured: hasher.combine(19)
        case .invalidConfiguration(let r): hasher.combine(20); hasher.combine(r)
        case .invalidExtractedData: hasher.combine(21)
        case .confidenceTooLow(let s, let m): hasher.combine(22); hasher.combine(s); hasher.combine(m)
        case .missingRequiredFields(let f): hasher.combine(23); hasher.combine(f)
        case .dataIntegrityCheckFailed: hasher.combine(24)
        case .unknownError(let e): hasher.combine(25); hasher.combine(e.localizedDescription)
        case .operationCancelled: hasher.combine(26)
        case .serviceUnavailable: hasher.combine(27)
        }
    }

    var errorDescription: String? {
        switch self {
        // Image processing errors
        case .imageConversionFailed:
            return "Failed to convert image to required format"
        case .imageDataCorrupted:
            return "Image data appears to be corrupted"
        case .imageFormatNotSupported:
            return "Image format is not supported for analysis"
        case .imageTooLarge(let maxSizeBytes):
            return "Image is too large. Maximum size: \(maxSizeBytes / 1024 / 1024)MB"
        case .imageTooSmall(let minDimensions):
            return "Image is too small. Minimum dimensions: \(Int(minDimensions.width))x\(Int(minDimensions.height))"

        // Network and AWS errors
        case .networkUnavailable:
            return "Network connection is unavailable"
        case .awsBackendUnavailable:
            return "AWS backend service is currently unavailable"
        case .awsAuthenticationFailed:
            return "AWS authentication failed. Please check your credentials"
        case .awsQuotaExceeded:
            return "AWS service quota exceeded. Please try again later"
        case .awsServiceError(let code, let message):
            return "AWS service error (\(code)): \(message)"
        case .requestTimeout:
            return "Request timed out. Please try again"
        case .invalidAPIResponse:
            return "Received invalid response from server"

        // Document processing errors
        case .noTextDetected:
            return "No text could be detected in the document"
        case .documentTypeNotSupported(let type):
            return "Document type '\(type)' is not supported"
        case .documentQualityTooLow(let score):
            return "Document quality is too low for analysis (score: \(String(format: "%.2f", score)))"
        case .textExtractionFailed:
            return "Failed to extract text from the document"
        case .mlModelUnavailable:
            return "Machine learning model is unavailable"
        case .processingInterrupted:
            return "Document processing was interrupted"

        // Configuration errors
        case .awsCredentialsNotConfigured:
            return "AWS credentials are not configured. Please set up your credentials in Settings"
        case .textractNotConfigured:
            return "Document processing service is not configured. Please complete the setup in Settings"
        case .invalidConfiguration(let reason):
            return "Invalid configuration: \(reason)"

        // Data validation errors
        case .invalidExtractedData:
            return "Extracted data is invalid or incomplete"
        case .confidenceTooLow(let score, let minimum):
            return "Analysis confidence too low (\(String(format: "%.2f", score * 100))%). Minimum required: \(String(format: "%.2f", minimum * 100))%"
        case .missingRequiredFields(let fields):
            return "Missing required fields: \(fields.joined(separator: ", "))"
        case .dataIntegrityCheckFailed:
            return "Data integrity check failed"

        // General errors
        case .unknownError(let underlying):
            return "An unexpected error occurred: \(underlying.localizedDescription)"
        case .operationCancelled:
            return "Operation was cancelled by user"
        case .serviceUnavailable:
            return "Service is temporarily unavailable"
        }
    }

    var failureReason: String? {
        switch self {
        case .imageConversionFailed:
            return "The image could not be converted to the required JPEG format for processing"
        case .networkUnavailable:
            return "No internet connection is available to reach the AWS backend services"
        case .awsBackendUnavailable:
            return "The AWS backend service is experiencing issues or is under maintenance"
        case .awsAuthenticationFailed:
            return "The provided AWS credentials are invalid or have expired"
        case .noTextDetected:
            return "The document image may be too blurry, skewed, or contain no readable text"
        case .documentQualityTooLow:
            return "The document image quality is insufficient for accurate text extraction"
        case .awsCredentialsNotConfigured:
            return "AWS credentials have not been set up in the application settings"
        case .confidenceTooLow:
            return "The analysis confidence is below the acceptable threshold for reliable results"
        default:
            return nil
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .imageConversionFailed, .imageDataCorrupted:
            return "Try taking a new photo or selecting a different image"
        case .imageTooLarge:
            return "Try reducing the image size or taking a photo with lower resolution"
        case .imageTooSmall:
            return "Take a closer photo or use a higher resolution image"
        case .networkUnavailable:
            return "Check your internet connection and try again"
        case .awsBackendUnavailable, .serviceUnavailable:
            return "Please try again in a few minutes. If the problem persists, contact support"
        case .awsAuthenticationFailed:
            return "Go to Settings and update your AWS credentials"
        case .awsQuotaExceeded:
            return "Wait for your AWS quota to reset or upgrade your AWS plan"
        case .noTextDetected:
            return "Take a clearer photo with better lighting and ensure the document is fully visible"
        case .documentQualityTooLow:
            return "Take a new photo with better lighting, reduce glare, and ensure the document is flat"
        case .awsCredentialsNotConfigured, .textractNotConfigured:
            return "Go to Settings > AWS Configuration to set up your credentials"
        case .confidenceTooLow:
            return "Try taking a clearer photo or manually verify the extracted information"
        case .missingRequiredFields:
            return "Ensure all required information is visible in the document image"
        case .operationCancelled:
            return "Start the analysis again if needed"
        default:
            return "Please try again or contact support if the issue persists"
        }
    }

    var isRetryable: Bool {
        switch self {
        case .networkUnavailable, .awsBackendUnavailable, .requestTimeout,
             .awsQuotaExceeded, .serviceUnavailable, .processingInterrupted:
            return true
        case .imageConversionFailed, .imageDataCorrupted, .noTextDetected,
             .documentQualityTooLow, .textExtractionFailed:
            return true // User can retry with different image
        case .awsAuthenticationFailed, .awsCredentialsNotConfigured,
             .textractNotConfigured, .documentTypeNotSupported:
            return false // Requires configuration changes
        default:
            return false
        }
    }

    var requiresUserAction: Bool {
        switch self {
        case .awsCredentialsNotConfigured, .textractNotConfigured,
             .awsAuthenticationFailed, .invalidConfiguration:
            return true
        case .imageConversionFailed, .imageDataCorrupted, .imageTooLarge,
             .imageTooSmall, .noTextDetected, .documentQualityTooLow:
            return true
        default:
            return false
        }
    }

    /// Convert from various error types to DocumentAnalysisError
    static func from(_ error: Error) -> DocumentAnalysisError {
        if let analysisError = error as? DocumentAnalysisError {
            return analysisError
        }

        if let apiError = error as? APIError {
            switch apiError {
            case .networkError:
                return .networkUnavailable
            case .authenticationRequired:
                return .awsAuthenticationFailed
            case .serverError(let code, let message):
                return .awsServiceError(code: code, message: message)
            case .invalidResponse:
                return .invalidAPIResponse
            case .encodingError, .decodingError:
                return .invalidAPIResponse
            case .invalidURL:
                return .invalidConfiguration(reason: "Invalid API URL")
            case .httpError(let code):
                return .awsServiceError(code: code, message: "HTTP error")
            }
        }

        // Handle common Foundation errors
        if let nsError = error as NSError? {
            switch nsError.domain {
            case NSURLErrorDomain:
                switch nsError.code {
                case NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost:
                    return .networkUnavailable
                case NSURLErrorTimedOut:
                    return .requestTimeout
                case NSURLErrorCancelled:
                    return .operationCancelled
                default:
                    return .networkUnavailable
                }
            default:
                break
            }
        }

        return .unknownError(underlying: error)
    }
}

// MARK: - Error Recovery Helpers

extension DocumentAnalysisError {
    /// Suggest fallback processing when cloud processing fails
    var shouldFallbackToLocal: Bool {
        switch self {
        case .networkUnavailable, .awsBackendUnavailable, .awsServiceError,
             .requestTimeout, .awsQuotaExceeded, .invalidAPIResponse:
            return true
        case .awsAuthenticationFailed, .awsCredentialsNotConfigured:
            return false // These require user configuration
        default:
            return false
        }
    }

    /// Determine if error should trigger immediate retry
    var shouldRetryImmediately: Bool {
        switch self {
        case .requestTimeout, .networkUnavailable:
            return true
        default:
            return false
        }
    }

    /// Get retry delay in seconds
    var retryDelay: TimeInterval {
        switch self {
        case .networkUnavailable:
            return 2.0
        case .awsBackendUnavailable, .serviceUnavailable:
            return 5.0
        case .requestTimeout:
            return 1.0
        case .awsQuotaExceeded:
            return 60.0
        default:
            return 0.0
        }
    }
}

// MARK: - User-Friendly Error Messages

extension DocumentAnalysisError {
    /// Get a simplified, user-friendly error message
    var userFriendlyMessage: String {
        switch self {
        case .imageConversionFailed, .imageDataCorrupted, .imageFormatNotSupported:
            return "There's an issue with the image. Please try taking a new photo."
        case .imageTooLarge:
            return "The image is too large. Please try a smaller image or lower resolution."
        case .imageTooSmall:
            return "The image is too small. Please take a closer photo."
        case .networkUnavailable:
            return "No internet connection. Please check your connection and try again."
        case .awsBackendUnavailable, .serviceUnavailable:
            return "The service is temporarily unavailable. Please try again in a few minutes."
        case .awsAuthenticationFailed, .awsCredentialsNotConfigured:
            return "Please set up your AWS credentials in Settings."
        case .noTextDetected:
            return "No text found in the image. Please ensure the document is clearly visible."
        case .documentQualityTooLow:
            return "The document image quality is too low. Please take a clearer photo."
        case .confidenceTooLow:
            return "The analysis confidence is low. Please verify the results or take a clearer photo."
        default:
            return "An error occurred during analysis. Please try again."
        }
    }

    /// Get appropriate icon for the error type
    var iconName: String {
        switch self {
        case .imageConversionFailed, .imageDataCorrupted, .imageFormatNotSupported,
             .imageTooLarge, .imageTooSmall, .noTextDetected, .documentQualityTooLow:
            return "camera.fill"
        case .networkUnavailable, .awsBackendUnavailable, .serviceUnavailable:
            return "wifi.slash"
        case .awsAuthenticationFailed, .awsCredentialsNotConfigured:
            return "key.fill"
        case .operationCancelled:
            return "xmark.circle.fill"
        default:
            return "exclamationmark.triangle.fill"
        }
    }
}