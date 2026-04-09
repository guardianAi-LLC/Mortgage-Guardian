import SwiftUI

struct FAQItem: Identifiable {
    let id = UUID()
    let question: String
    let answer: String
}

struct HelpFAQView: View {
    @Environment(\.dismiss) private var dismiss

    private let faqItems: [FAQItem] = [
        FAQItem(
            question: "How do I upload a mortgage document?",
            answer: "Tap the camera icon on the home screen to capture a document using your camera, or select an existing photo from your photo library. The app supports PDF, JPEG, and PNG formats. For best results, ensure the document is well-lit and fully visible in the frame."
        ),
        FAQItem(
            question: "What types of errors does the app detect?",
            answer: "Mortgage Guardian uses AI-powered analysis to detect servicing errors including payment miscalculations, escrow account discrepancies, incorrect interest rate applications, unauthorized fees, and potential RESPA (Real Estate Settlement Procedures Act) violations."
        ),
        FAQItem(
            question: "How does bank verification work?",
            answer: "Bank verification uses Plaid to securely connect to your bank account. Once connected, the app cross-references your mortgage payment transactions with your servicer's records to identify discrepancies between what you paid and what was reported."
        ),
        FAQItem(
            question: "What is a RESPA dispute letter?",
            answer: "A RESPA dispute letter is a formal communication sent to your mortgage servicer under the Real Estate Settlement Procedures Act. It includes Notices of Error (NOE) for identified mistakes and Qualified Written Requests (QWR) for information your servicer is legally required to provide."
        ),
        FAQItem(
            question: "How do I generate a dispute letter?",
            answer: "After uploading and analyzing a document, navigate to the analysis results and select a finding. Tap 'Generate Letter' to create a RESPA-compliant dispute letter based on the detected issue. You can review and customize the letter before saving or sharing it."
        ),
        FAQItem(
            question: "Is my data secure?",
            answer: "Yes. All documents and personal data are encrypted using AES-256-GCM encryption both in transit and at rest. Biometric authentication (Face ID/Touch ID) protects app access. Your data is never shared with third parties, and you can delete all your data at any time from Settings."
        ),
        FAQItem(
            question: "How do I delete my data?",
            answer: "Go to Settings > Data & Privacy > Delete Account. This will permanently remove all your documents, analysis results, generated letters, and personal information from the app and our servers. This action cannot be undone."
        ),
        FAQItem(
            question: "What should I do with generated letters?",
            answer: "Review the generated letter carefully and customize it as needed. Once finalized, send the letter to your mortgage servicer via certified mail with return receipt requested. This provides proof of delivery. Your servicer is required by law to acknowledge receipt within 5 business days and respond within 30 business days."
        ),
    ]

    var body: some View {
        NavigationView {
            List {
                Section {
                    ForEach(faqItems) { item in
                        DisclosureGroup {
                            Text(item.answer)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .padding(.vertical, 4)
                        } label: {
                            Text(item.question)
                                .font(.body)
                                .fontWeight(.medium)
                        }
                    }
                } header: {
                    Text("Frequently Asked Questions")
                }

                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "envelope.circle.fill")
                            .font(.title)
                            .foregroundColor(.blue)

                        Text("Still need help?")
                            .font(.headline)

                        Text("Our support team is here to assist you with any questions or issues.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)

                        Button(action: contactSupport) {
                            Label("Contact Support", systemImage: "envelope.fill")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .navigationTitle("Help & FAQ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func contactSupport() {
        if let url = URL(string: "mailto:support@mortgageguardian.com?subject=Mortgage%20Guardian%20Support") {
            UIApplication.shared.open(url)
        }
    }
}

#Preview {
    HelpFAQView()
}
