import SwiftUI
import PDFKit
import QuickLook

/// Document evidence viewer with highlighting and annotation capabilities
struct DocumentEvidenceViewer: View {
    let issue: AuditResult
    @Environment(\.dismiss) private var dismiss

    @State private var selectedDocument: AuditResult.SupportingDocument?
    @State private var showingAnnotations = true
    @State private var zoomLevel: Double = 1.0
    @State private var isExporting = false

    var body: some View {
        NavigationView {
            Group {
                if issue.supportingDocuments.isEmpty {
                    emptyEvidenceView
                } else {
                    HStack(spacing: 0) {
                        // Document List Sidebar
                        documentListSidebar

                        // Document Viewer
                        if let selectedDocument = selectedDocument {
                            documentViewerSection(for: selectedDocument)
                        } else {
                            emptyDocumentView
                        }
                    }
                }
            }
            .navigationTitle("Evidence Documents")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                toolbarContent
            }
        }
        .onAppear {
            selectedDocument = issue.supportingDocuments.first
        }
    }

    // MARK: - Empty Evidence State
    @ViewBuilder
    private var emptyEvidenceView: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            VStack(spacing: 8) {
                Text("No Evidence Documents")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("No evidence documents are attached to this issue")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }

    // MARK: - Document List Sidebar
    @ViewBuilder
    private var documentListSidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Supporting Documents")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                Text("\(issue.supportingDocuments.count)")
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
            .padding()
            .background(Color(.systemGray6))

            // Document List
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(issue.supportingDocuments) { document in
                        DocumentListItem(
                            document: document,
                            isSelected: selectedDocument?.id == document.id,
                            hasEvidence: document.highlightRegion != nil
                        ) {
                            selectedDocument = document
                        }
                    }
                }
                .padding()
            }
        }
        .frame(width: 280)
        .background(Color(.systemGroupedBackground))
    }

    // MARK: - Document Viewer Section
    @ViewBuilder
    private func documentViewerSection(for document: AuditResult.SupportingDocument) -> some View {
        VStack(spacing: 0) {
            // Viewer Controls
            documentControlsBar(for: document)

            // Document Content
            ZStack {
                if document.documentType == "PDF" {
                    if let url = document.localFileURL,
                       let pdfDocument = PDFDocument(url: url) {
                        PDFKitView(document: pdfDocument)
                    } else {
                        serverDocumentPlaceholder(for: document)
                    }
                } else if document.documentType == "Image" {
                    if let url = document.localFileURL,
                       let imageData = try? Data(contentsOf: url),
                       let uiImage = UIImage(data: imageData) {
                        ScrollView([.horizontal, .vertical]) {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFit()
                                .scaleEffect(zoomLevel)
                                .padding()
                        }
                        .background(Color(.systemGray5))
                    } else {
                        serverDocumentPlaceholder(for: document)
                    }
                } else {
                    serverDocumentPlaceholder(for: document)
                }

                // Evidence Highlights Overlay
                if showingAnnotations, let region = document.highlightRegion {
                    EvidenceHighlightOverlay(region: region)
                }
            }
        }
    }

    // MARK: - Server Document Placeholder
    @ViewBuilder
    private func serverDocumentPlaceholder(for document: AuditResult.SupportingDocument) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "cloud.fill")
                .font(.system(size: 48))
                .foregroundColor(.blue.opacity(0.6))

            Text(document.documentName)
                .font(.headline)

            if let page = document.pageReference {
                Text("Reference: \(page)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Text("Document available on server")
                .font(.caption)
                .foregroundColor(.secondary)

            if let label = document.highlightRegion?.label {
                HStack(spacing: 4) {
                    Image(systemName: "highlighter")
                        .font(.caption)
                        .foregroundColor(.orange)
                    Text("Evidence: \(label)")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGray5))
    }

    // MARK: - Empty Document View
    @ViewBuilder
    private var emptyDocumentView: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            VStack(spacing: 8) {
                Text("Select a Document")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Choose a document from the sidebar to view evidence and highlights")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }

    // MARK: - Document Controls Bar
    @ViewBuilder
    private func documentControlsBar(for document: AuditResult.SupportingDocument) -> some View {
        HStack {
            // Document Info
            HStack(spacing: 8) {
                Image(systemName: documentIcon(for: document))
                    .foregroundColor(.blue)

                VStack(alignment: .leading, spacing: 2) {
                    Text(document.documentName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)

                    HStack(spacing: 4) {
                        Text(document.documentType)
                        if !document.fileSize.isEmpty {
                            Text("•")
                            Text(document.fileSize)
                        }
                        if let page = document.pageReference {
                            Text("•")
                            Text(page)
                        }
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }

            Spacer()

            // View Controls
            HStack(spacing: 12) {
                // Zoom Controls
                HStack(spacing: 4) {
                    Button {
                        zoomLevel = max(0.5, zoomLevel - 0.25)
                    } label: {
                        Image(systemName: "minus.magnifyingglass")
                    }
                    .disabled(zoomLevel <= 0.5)

                    Text("\(Int(zoomLevel * 100))%")
                        .font(.caption)
                        .frame(width: 40)

                    Button {
                        zoomLevel = min(3.0, zoomLevel + 0.25)
                    } label: {
                        Image(systemName: "plus.magnifyingglass")
                    }
                    .disabled(zoomLevel >= 3.0)
                }

                Divider()
                    .frame(height: 20)

                // Annotations Toggle
                Button {
                    showingAnnotations.toggle()
                } label: {
                    Image(systemName: "highlighter")
                        .foregroundColor(showingAnnotations ? .orange : .secondary)
                }

                // Share Button
                Button {
                    shareDocument(document)
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
    }

    // MARK: - Toolbar
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Button("Close") {
                dismiss()
            }
        }

        ToolbarItem(placement: .navigationBarTrailing) {
            Menu {
                Button("Export Evidence Report") {
                    exportEvidenceReport()
                }

                Button("Print Documents") {
                    printDocuments()
                }

                Button("Share All Documents") {
                    shareAllDocuments()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .disabled(issue.supportingDocuments.isEmpty)
        }
    }

    // MARK: - Helper Functions
    private func documentIcon(for document: AuditResult.SupportingDocument) -> String {
        switch document.documentType {
        case "PDF": return "doc.fill"
        case "Image": return "photo.fill"
        default: return "doc"
        }
    }

    // MARK: - Share/Export/Print Actions

    private func shareDocument(_ document: AuditResult.SupportingDocument) {
        if let url = document.localFileURL {
            ShareUtility.presentShareSheet(items: [url])
        } else {
            // Share document info as text when file isn't available locally
            let info = "Evidence: \(document.documentName)\nType: \(document.documentType)\(document.pageReference.map { "\nRef: \($0)" } ?? "")"
            ShareUtility.presentShareSheet(items: [info])
        }
    }

    private func exportEvidenceReport() {
        isExporting = true
        Task { @MainActor in
            defer { isExporting = false }

            let pageSize = CGSize(width: 612, height: 792)
            let margins = UIEdgeInsets(top: 60, left: 56, bottom: 60, right: 56)
            let contentWidth = pageSize.width - margins.left - margins.right

            let format = UIGraphicsPDFRendererFormat()
            format.documentInfo = [
                kCGPDFContextCreator as String: "Mortgage Guardian",
                kCGPDFContextTitle as String: "Evidence Report — \(issue.issueType.displayName)"
            ]

            let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize), format: format)

            let pdfData = renderer.pdfData { context in
                context.beginPage()
                var y: CGFloat = margins.top

                // Title
                let titleAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 20),
                    .foregroundColor: UIColor.black
                ]
                let title = NSAttributedString(string: "Evidence Report — \(issue.issueType.displayName)", attributes: titleAttr)
                title.draw(at: CGPoint(x: margins.left, y: y))
                y += 30

                // Issue info
                let infoAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 12),
                    .foregroundColor: UIColor.darkGray
                ]
                let severityAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 12),
                    .foregroundColor: UIColor.darkGray
                ]

                NSAttributedString(string: "Severity: \(issue.severity.displayName)  |  Confidence: \(Int(issue.confidence * 100))%", attributes: severityAttr)
                    .draw(at: CGPoint(x: margins.left, y: y))
                y += 20

                NSAttributedString(string: issue.title, attributes: [.font: UIFont.boldSystemFont(ofSize: 14), .foregroundColor: UIColor.black])
                    .draw(at: CGPoint(x: margins.left, y: y))
                y += 20

                let descRect = CGRect(x: margins.left, y: y, width: contentWidth, height: 60)
                NSAttributedString(string: issue.detailedExplanation, attributes: infoAttr)
                    .draw(in: descRect)
                y += 70

                // Separator
                let separatorPath = UIBezierPath()
                separatorPath.move(to: CGPoint(x: margins.left, y: y))
                separatorPath.addLine(to: CGPoint(x: margins.left + contentWidth, y: y))
                UIColor.lightGray.setStroke()
                separatorPath.stroke()
                y += 16

                // Documents list
                NSAttributedString(string: "Supporting Documents (\(issue.supportingDocuments.count))", attributes: [.font: UIFont.boldSystemFont(ofSize: 14), .foregroundColor: UIColor.black])
                    .draw(at: CGPoint(x: margins.left, y: y))
                y += 24

                for (index, doc) in issue.supportingDocuments.enumerated() {
                    if y > pageSize.height - margins.bottom - 80 {
                        context.beginPage()
                        y = margins.top
                    }

                    let docTitle = "\(index + 1). \(doc.documentName)"
                    NSAttributedString(string: docTitle, attributes: [.font: UIFont.boldSystemFont(ofSize: 12), .foregroundColor: UIColor.black])
                        .draw(at: CGPoint(x: margins.left, y: y))
                    y += 18

                    var details = "Type: \(doc.documentType)"
                    if !doc.fileSize.isEmpty { details += "  |  Size: \(doc.fileSize)" }
                    if let page = doc.pageReference { details += "  |  \(page)" }
                    NSAttributedString(string: details, attributes: infoAttr)
                        .draw(at: CGPoint(x: margins.left + 16, y: y))
                    y += 16

                    if let label = doc.highlightRegion?.label {
                        NSAttributedString(string: "Evidence highlight: \(label)", attributes: [.font: UIFont.italicSystemFont(ofSize: 11), .foregroundColor: UIColor.orange])
                            .draw(at: CGPoint(x: margins.left + 16, y: y))
                        y += 16
                    }

                    y += 8
                }
            }

            let dateStr = {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd"
                return f.string(from: Date())
            }()
            let tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("evidence-report-\(dateStr).pdf")
            do {
                try pdfData.write(to: tempURL)
                ShareUtility.presentShareSheet(items: [tempURL])
            } catch {
                print("Failed to save evidence report: \(error)")
            }
        }
    }

    private func printDocuments() {
        guard let document = selectedDocument else { return }

        if let url = document.localFileURL, let data = try? Data(contentsOf: url) {
            if document.documentType == "Image",
               let image = UIImage(data: data),
               let pdfData = imageToPDFData(image) {
                ShareUtility.printData(pdfData, jobName: document.documentName)
            } else {
                ShareUtility.printData(data, jobName: document.documentName)
            }
        }
    }

    private func shareAllDocuments() {
        var items: [Any] = []
        for doc in issue.supportingDocuments {
            if let url = doc.localFileURL {
                items.append(url)
            }
        }
        if items.isEmpty {
            // Fall back to sharing document names as text
            let text = issue.supportingDocuments.map { "• \($0.documentName)\($0.pageReference.map { " (\($0))" } ?? "")" }.joined(separator: "\n")
            items.append("Evidence Documents for \(issue.issueType.displayName):\n\(text)")
        }
        ShareUtility.presentShareSheet(items: items)
    }

    private func imageToPDFData(_ image: UIImage) -> Data? {
        let pageSize = CGSize(width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize))
        return renderer.pdfData { context in
            context.beginPage()
            let imageAspect = image.size.width / image.size.height
            let maxWidth = pageSize.width - 72
            let maxHeight = pageSize.height - 72
            var drawWidth = maxWidth
            var drawHeight = drawWidth / imageAspect
            if drawHeight > maxHeight {
                drawHeight = maxHeight
                drawWidth = drawHeight * imageAspect
            }
            let x = (pageSize.width - drawWidth) / 2
            let y = (pageSize.height - drawHeight) / 2
            image.draw(in: CGRect(x: x, y: y, width: drawWidth, height: drawHeight))
        }
    }
}

// MARK: - Supporting Views

struct DocumentListItem: View {
    let document: AuditResult.SupportingDocument
    let isSelected: Bool
    let hasEvidence: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                // Document Icon with Evidence Indicator
                ZStack(alignment: .topTrailing) {
                    Image(systemName: documentIcon)
                        .font(.title2)
                        .foregroundColor(isSelected ? .white : .blue)
                        .frame(width: 32, height: 32)

                    if hasEvidence {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 12, height: 12)
                            .overlay(
                                Circle()
                                    .stroke(Color.white, lineWidth: 2)
                            )
                    }
                }

                // Document Info
                VStack(alignment: .leading, spacing: 4) {
                    Text(document.documentName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(isSelected ? .white : .primary)
                        .lineLimit(2)

                    HStack {
                        Text(document.documentType)
                            .font(.caption)
                            .fontWeight(.medium)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(isSelected ? Color.white.opacity(0.3) : Color.blue.opacity(0.1))
                            )
                            .foregroundColor(isSelected ? .white : .blue)

                        if !document.fileSize.isEmpty {
                            Text(document.fileSize)
                                .font(.caption)
                                .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
                        }
                    }

                    if let page = document.pageReference {
                        Text(page)
                            .font(.caption2)
                            .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
                    }

                    if hasEvidence {
                        HStack(spacing: 4) {
                            Image(systemName: "highlighter")
                                .font(.caption2)
                                .foregroundColor(.orange)

                            Text("Contains evidence")
                                .font(.caption2)
                                .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
                        }
                    }
                }

                Spacer()
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.blue : Color(.systemBackground))
            )
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var documentIcon: String {
        switch document.documentType {
        case "PDF": return "doc.fill"
        case "Image": return "photo.fill"
        default: return "doc"
        }
    }
}

// MARK: - PDFKit Viewer
struct PDFKitView: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.document = document
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {}
}

// MARK: - Evidence Highlight Overlay
struct EvidenceHighlightOverlay: View {
    let region: AuditResult.HighlightRegion

    var body: some View {
        GeometryReader { geometry in
            let rect = CGRect(
                x: geometry.size.width * region.x,
                y: geometry.size.height * region.y,
                width: geometry.size.width * region.width,
                height: geometry.size.height * region.height
            )

            ZStack(alignment: .topLeading) {
                Rectangle()
                    .fill(Color.orange.opacity(0.3))
                    .frame(width: rect.width, height: rect.height)
                    .overlay(
                        Rectangle()
                            .stroke(Color.orange, lineWidth: 2)
                    )
                    .position(x: rect.midX, y: rect.midY)

                if let label = region.label {
                    Text(label)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.orange)
                        .cornerRadius(4)
                        .position(x: rect.midX, y: rect.minY - 12)
                }
            }
        }
    }
}

#Preview {
    DocumentEvidenceViewer(issue: AuditResult.sampleResult())
}
