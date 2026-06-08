import SwiftUI

/// Letter generation interface for specific issues
struct IssueLetterGeneratorView: View {
    let issue: AuditResult
    let caseId: String?
    @Environment(\.dismiss) private var dismiss

    @State private var letterType: LetterType = .noticeOfError
    @State private var selectedTemplate: LetterTemplate?
    @State private var customizations = LetterCustomizations()
    @State private var isGenerating = false
    @State private var generatedLetter: String?
    @State private var showingPreview = false
    @State private var errorMessage: String?
    @State private var showingError = false
    @State private var generatedPDFData: Data?

    init(issue: AuditResult, caseId: String? = nil) {
        self.issue = issue
        self.caseId = caseId
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    letterHeaderSection

                    // Letter Type Selection
                    letterTypeSection

                    // Template Selection
                    templateSelectionSection

                    // Customization Options
                    customizationSection

                    // Generate Button
                    generateSection
                }
                .padding()
            }
            .navigationTitle("Generate Letter")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                toolbarContent
            }
            .sheet(isPresented: $showingPreview) {
                if let letter = generatedLetter {
                    LetterPreviewView(letterContent: letter, issue: issue, pdfData: generatedPDFData)
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(errorMessage ?? "An unknown error occurred.")
            }
        }
    }

    // MARK: - Header Section
    @ViewBuilder
    private var letterHeaderSection: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                Image(systemName: issue.issueType.icon)
                    .font(.title)
                    .foregroundColor(issue.severity.color)
                    .frame(width: 40, height: 40)
                    .background(
                        Circle()
                            .fill(issue.severity.color.opacity(0.1))
                    )
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 4) {
                    Text(issue.title)
                        .font(.headline)
                        .fontWeight(.semibold)

                    Text("Generate formal correspondence")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            if let amount = issue.affectedAmount {
                HStack {
                    Text("Potential Recovery:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text(formatCurrency(amount))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.green.opacity(0.1))
                )
            }
        }
    }

    // MARK: - Letter Type Section
    @ViewBuilder
    private var letterTypeSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Letter Type")
                .font(.headline)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                ForEach(LetterType.allCases, id: \.self) { type in
                    LetterTypeCard(
                        type: type,
                        isSelected: letterType == type,
                        isRecommended: type.isRecommendedFor(issue: issue)
                    ) {
                        letterType = type
                    }
                }
            }
        }
    }

    // MARK: - Template Selection
    @ViewBuilder
    private var templateSelectionSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Template Selection")
                .font(.headline)
                .fontWeight(.semibold)

            VStack(spacing: 8) {
                ForEach(availableTemplates, id: \.id) { template in
                    TemplateRow(
                        template: template,
                        isSelected: selectedTemplate?.id == template.id
                    ) {
                        selectedTemplate = template
                    }
                }
            }
        }
    }

    // MARK: - Customization Section
    @ViewBuilder
    private var customizationSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Customization")
                .font(.headline)
                .fontWeight(.semibold)

            VStack(spacing: 12) {
                Toggle("Include supporting evidence", isOn: $customizations.includeEvidence)
                Toggle("Include calculation details", isOn: $customizations.includeCalculations)
                Toggle("Request formal response", isOn: $customizations.requestResponse)
                Toggle("CC to regulatory agencies", isOn: $customizations.ccRegulatoryAgencies)

                if customizations.requestResponse {
                    HStack {
                        Text("Response timeframe:")
                        Spacer()
                        Picker("Days", selection: $customizations.responseTimeframe) {
                            Text("30 days").tag(30)
                            Text("60 days").tag(60)
                            Text("90 days").tag(90)
                        }
                        .pickerStyle(SegmentedPickerStyle())
                        .frame(maxWidth: 200)
                    }
                }
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemGray6))
        )
    }

    // MARK: - Generate Section
    @ViewBuilder
    private var generateSection: some View {
        VStack(spacing: 16) {
            if isGenerating {
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(1.2)

                    Text("Generating letter...")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
            } else {
                Button {
                    generateLetter()
                } label: {
                    HStack {
                        Image(systemName: "doc.text")
                        Text("Generate Letter")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(selectedTemplate == nil)
            }

            if generatedLetter != nil {
                Button {
                    showingPreview = true
                } label: {
                    HStack {
                        Image(systemName: "eye")
                        Text("Preview Letter")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color(.systemGray5))
                    .foregroundColor(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                if generatedPDFData != nil {
                    Button {
                        savePDFToFiles()
                    } label: {
                        HStack {
                            Image(systemName: "doc.richtext")
                            Text("Save as PDF")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.systemGray5))
                        .foregroundColor(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }
    }

    // MARK: - Toolbar
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button("Cancel") {
                dismiss()
            }
        }

        ToolbarItem(placement: .navigationBarTrailing) {
            if generatedLetter != nil {
                Menu {
                    Button("Preview Letter") {
                        showingPreview = true
                    }

                    Button("Email Letter") {
                        emailLetter()
                    }

                    Button("Save to Files") {
                        saveToFiles()
                    }

                    Button("Print Letter") {
                        printLetter()
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .accessibilityLabel("More options")
                }
            }
        }
    }

    // MARK: - Computed Properties
    private var availableTemplates: [LetterTemplate] {
        LetterTemplate.defaultTemplates()
    }

    // MARK: - Actions
    private func generateLetter() {
        guard selectedTemplate != nil else { return }

        isGenerating = true

        if let caseId = caseId {
            // Backend letter generation
            Task {
                do {
                    let backendLetterType = letterType.backendKey
                    let response = try await LetterGenerationService.shared.generateBackendLetter(
                        caseId: caseId,
                        letterType: backendLetterType
                    )
                    let letterContent = formatDisputeLetterResponse(response)
                    generatedLetter = letterContent
                    await generatePDFFromLetterContent(letterContent)
                } catch {
                    errorMessage = error.localizedDescription
                    showingError = true
                }
                isGenerating = false
            }
        } else {
            // Offline fallback using local LetterGenerator
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                let generator = LetterGenerator(
                    issue: issue,
                    template: selectedTemplate!,
                    customizations: customizations
                )
                let letterContent = generator.generateLetter()
                generatedLetter = letterContent
                await generatePDFFromLetterContent(letterContent)
                isGenerating = false
            }
        }
    }

    /// Map a `DisputeLetterResponse` into a single formatted string for display and sharing.
    private func formatDisputeLetterResponse(_ response: DisputeLetterResponse) -> String {
        var parts: [String] = []

        if let subject = response.content?.subject, !subject.isEmpty {
            parts.append("RE: \(subject)")
        }

        if let recipientName = response.recipientInfo?.servicerName {
            parts.append(recipientName)
        }
        if let recipientAddress = response.recipientInfo?.servicerAddress {
            parts.append(recipientAddress)
        }

        if !parts.isEmpty {
            parts.append("") // blank line separator
        }

        if let salutation = response.content?.salutation, !salutation.isEmpty {
            parts.append(salutation)
            parts.append("")
        }

        if let body = response.content?.body, !body.isEmpty {
            parts.append(body)
            parts.append("")
        }

        if let demands = response.content?.demands, !demands.isEmpty {
            parts.append("DEMANDS:")
            for (index, demand) in demands.enumerated() {
                parts.append("\(index + 1). \(demand)")
            }
            parts.append("")
        }

        if let citations = response.content?.legalCitations, !citations.isEmpty {
            parts.append("LEGAL CITATIONS:")
            for citation in citations {
                parts.append("- \(citation)")
            }
            parts.append("")
        }

        if let deadline = response.content?.responseDeadline, !deadline.isEmpty {
            parts.append("RESPONSE DEADLINE: \(deadline)")
            parts.append("")
        }

        if let closing = response.content?.closingStatement, !closing.isEmpty {
            parts.append(closing)
        }

        return parts.joined(separator: "\n")
    }

    private func generatePDFFromLetterContent(_ letterContent: String) async {
        let pdfGenerator = PDFGenerator()
        generatedPDFData = try? await pdfGenerator.generateLetterPDFFromText(
            letterText: letterContent,
            title: "RESPA Dispute Letter"
        )
    }

    private func emailLetter() {
        if let pdfData = generatedPDFData {
            let tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("DisputeLetter.pdf")
            try? pdfData.write(to: tempURL)
            ShareUtility.presentShareSheet(items: [tempURL])
        } else if let letter = generatedLetter {
            ShareUtility.presentShareSheet(items: [letter])
        }
    }

    private func saveToFiles() {
        let tempURL: URL
        if let pdfData = generatedPDFData {
            tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("DisputeLetter.pdf")
            try? pdfData.write(to: tempURL)
        } else if let letter = generatedLetter,
                  let data = letter.data(using: .utf8) {
            tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("DisputeLetter.txt")
            try? data.write(to: tempURL)
        } else {
            return
        }
        ShareUtility.saveToFiles(tempURL)
    }

    private func printLetter() {
        if let pdfData = generatedPDFData {
            ShareUtility.printData(pdfData, jobName: "Dispute Letter - \(issue.title)")
        } else if let letter = generatedLetter,
                  let data = letter.data(using: .utf8) {
            ShareUtility.printData(data, jobName: "Dispute Letter - \(issue.title)")
        }
    }

    private func savePDFToFiles() {
        guard let pdfData = generatedPDFData else { return }
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("DisputeLetter.pdf")
        try? pdfData.write(to: tempURL)
        ShareUtility.saveToFiles(tempURL)
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}

// MARK: - Supporting Types

enum LetterType: String, CaseIterable {
    case noticeOfError = "Notice of Error"
    case qualifiedWrittenRequest = "Qualified Written Request"
    case complaintLetter = "Complaint Letter"
    case demandLetter = "Demand Letter"

    var displayName: String { rawValue }

    /// Map the UI letter type to the backend's expected string key.
    var backendKey: String {
        switch self {
        case .noticeOfError:
            return "notice_of_error"
        case .qualifiedWrittenRequest:
            return "qualified_written_request"
        case .complaintLetter:
            return "notice_of_error"
        case .demandLetter:
            return "notice_of_error"
        }
    }

    var description: String {
        switch self {
        case .noticeOfError:
            return "Formal notice under RESPA Section 6 for servicer errors"
        case .qualifiedWrittenRequest:
            return "Request for account information under RESPA Section 6"
        case .complaintLetter:
            return "Formal complaint to servicer management"
        case .demandLetter:
            return "Demand for immediate correction and compensation"
        }
    }

    var recommendedFor: [AuditResult.IssueType] {
        switch self {
        case .noticeOfError:
            return [.misappliedPayment, .latePaymentError, .incorrectBalance, .unauthorizedFee]
        case .qualifiedWrittenRequest:
            return [.escrowError, .missingPayment, .incorrectInterest]
        case .complaintLetter:
            return [.forcePlacedInsurance, .duplicateCharge]
        case .demandLetter:
            return [.unauthorizedFee, .duplicateCharge]
        }
    }

    func isRecommendedFor(issue: AuditResult) -> Bool {
        recommendedFor.contains(issue.issueType) || issue.severity == .critical
    }
}

struct LetterCustomizations {
    var includeEvidence = true
    var includeCalculations = true
    var requestResponse = true
    var responseTimeframe = 30
    var ccRegulatoryAgencies = false
}

// MARK: - Supporting Views

struct LetterTypeCard: View {
    let type: LetterType
    let isSelected: Bool
    let isRecommended: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(type.displayName)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)

                        if isRecommended {
                            Text("RECOMMENDED")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.green)
                                .foregroundColor(.white)
                                .clipShape(Capsule())
                        }

                        Spacer()
                    }

                    Text(type.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.leading)
                }

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .blue : .secondary)
                    .font(.title2)
                    .accessibilityLabel(isSelected ? "Selected" : "Not selected")
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.blue.opacity(0.1) : Color(.systemBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(isSelected ? Color.blue : Color(.systemGray4), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct TemplateRow: View {
    let template: LetterTemplate
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(template.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(template.templateType.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .blue : .secondary)
                    .accessibilityLabel(isSelected ? "Selected" : "Not selected")
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Letter Generator
class LetterGenerator {
    private let issue: AuditResult
    private let template: LetterTemplate
    private let customizations: LetterCustomizations

    init(issue: AuditResult, template: LetterTemplate, customizations: LetterCustomizations) {
        self.issue = issue
        self.template = template
        self.customizations = customizations
    }

    func generateLetter() -> String {
        // Mock letter generation - in real app would use actual template engine
        let date = DateFormatter.letterDate.string(from: Date())

        return """
        \(date)

        [Your Mortgage Servicer]
        [Servicer Address]

        RE: Notice of Error - Account #[Your Account Number]

        Dear Servicer,

        I am writing to notify you of an error on my mortgage account pursuant to the Real Estate Settlement Procedures Act (RESPA), 12 U.S.C. § 2605(e).

        ISSUE DESCRIPTION:
        \(issue.title)

        \(issue.detailedExplanation)

        \(customizations.includeEvidence ? "\nEVIDENCE:\n\(issue.evidenceText ?? "See attached documentation")" : "")

        \(customizations.includeCalculations && issue.calculationDetails != nil ? "\nCALCULATION DETAILS:\nExpected: \(formatCurrency(issue.calculationDetails?.expectedValue ?? 0))\nActual: \(formatCurrency(issue.calculationDetails?.actualValue ?? 0))" : "")

        REQUESTED ACTION:
        \(issue.suggestedAction)

        \(customizations.requestResponse ? "Please provide a written response within \(customizations.responseTimeframe) days as required by RESPA." : "")

        Thank you for your prompt attention to this matter.

        Sincerely,
        [Your Name]
        [Your Contact Information]

        \(customizations.ccRegulatoryAgencies ? "\ncc: Consumer Financial Protection Bureau" : "")
        """
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}

// MARK: - Letter Preview View
struct LetterPreviewView: View {
    let letterContent: String
    let issue: AuditResult
    let pdfData: Data?
    @Environment(\.dismiss) private var dismiss

    init(letterContent: String, issue: AuditResult, pdfData: Data? = nil) {
        self.letterContent = letterContent
        self.issue = issue
        self.pdfData = pdfData
    }

    var body: some View {
        NavigationView {
            ScrollView {
                Text(letterContent)
                    .font(.system(.body, design: .serif))
                    .padding()
            }
            .navigationTitle("Letter Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("Email") {
                            if let pdfData = pdfData {
                                let tempURL = FileManager.default.temporaryDirectory
                                    .appendingPathComponent("DisputeLetter.pdf")
                                try? pdfData.write(to: tempURL)
                                ShareUtility.presentShareSheet(items: [tempURL])
                            } else {
                                ShareUtility.presentShareSheet(items: [letterContent])
                            }
                        }
                        Button("Print") {
                            if let pdfData = pdfData {
                                ShareUtility.printData(pdfData, jobName: "Dispute Letter - \(issue.title)")
                            } else if let data = letterContent.data(using: .utf8) {
                                ShareUtility.printData(data, jobName: "Dispute Letter - \(issue.title)")
                            }
                        }
                        Button("Save to Files") {
                            let tempURL: URL
                            if let pdfData = pdfData {
                                tempURL = FileManager.default.temporaryDirectory
                                    .appendingPathComponent("DisputeLetter.pdf")
                                try? pdfData.write(to: tempURL)
                            } else if let data = letterContent.data(using: .utf8) {
                                tempURL = FileManager.default.temporaryDirectory
                                    .appendingPathComponent("DisputeLetter.txt")
                                try? data.write(to: tempURL)
                            } else {
                                return
                            }
                            ShareUtility.saveToFiles(tempURL)
                        }
                        Button("Copy to Clipboard") {
                            UIPasteboard.general.string = letterContent
                        }
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .accessibilityLabel("Share letter")
                    }
                }
            }
        }
    }
}

// MARK: - Extensions
extension DateFormatter {
    static let letterDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        return formatter
    }()
}

#Preview {
    IssueLetterGeneratorView(issue: AuditResult.sampleResult(), caseId: nil)
}