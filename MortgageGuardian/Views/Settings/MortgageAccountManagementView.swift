import SwiftUI

struct MortgageAccountManagementView: View {
    @EnvironmentObject var userStore: UserStore
    @Environment(\.dismiss) private var dismiss
    @State private var showingAddAccount = false

    var body: some View {
        NavigationView {
            List {
                if userStore.user.mortgageAccounts.isEmpty {
                    Section {
                        VStack(spacing: 16) {
                            Image(systemName: "house")
                                .font(.system(size: 40))
                                .foregroundColor(.gray)

                            VStack(spacing: 8) {
                                Text("No Mortgage Accounts")
                                    .font(.headline)
                                    .fontWeight(.semibold)

                                Text("Add your mortgage account to track payments, detect errors, and generate dispute letters.")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                            }

                            Button("Add Mortgage Account") {
                                showingAddAccount = true
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding(.vertical, 20)
                        .frame(maxWidth: .infinity)
                    }
                } else {
                    Section("Mortgage Accounts") {
                        ForEach(userStore.user.mortgageAccounts) { account in
                            MortgageAccountRow(account: account)
                        }
                        .onDelete(perform: deleteAccounts)
                    }

                    Section {
                        Button {
                            showingAddAccount = true
                        } label: {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                    .foregroundColor(.orange)
                                Text("Add Mortgage Account")
                            }
                        }
                    }
                }
            }
            .navigationTitle("Mortgage Accounts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(isPresented: $showingAddAccount) {
                AddMortgageAccountView()
            }
        }
    }

    private func deleteAccounts(at offsets: IndexSet) {
        for index in offsets {
            let account = userStore.user.mortgageAccounts[index]
            userStore.removeMortgageAccount(account)
        }
    }
}

// MARK: - Mortgage Account Row
struct MortgageAccountRow: View {
    let account: User.MortgageAccount

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "house.fill")
                    .foregroundColor(.orange)
                    .frame(width: 24, height: 24)

                Text(account.servicerName)
                    .font(.body)
                    .fontWeight(.medium)

                Spacer()

                if let balance = account.currentBalance {
                    Text(formatCurrency(balance))
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Loan #\(account.loanNumber)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(account.propertyAddress)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            .padding(.leading, 36)
        }
        .padding(.vertical, 4)
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
    }
}

// MARK: - Add Mortgage Account View
struct AddMortgageAccountView: View {
    @EnvironmentObject var userStore: UserStore
    @Environment(\.dismiss) private var dismiss

    @State private var servicerName = ""
    @State private var loanNumber = ""
    @State private var propertyAddress = ""
    @State private var originalLoanAmount = ""
    @State private var interestRate = ""
    @State private var loanTerm = "30"

    private var isFormValid: Bool {
        !servicerName.isEmpty && !loanNumber.isEmpty && !propertyAddress.isEmpty &&
        Double(originalLoanAmount) != nil && Double(interestRate) != nil &&
        Int(loanTerm) != nil
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Servicer Information") {
                    TextField("Servicer Name", text: $servicerName)
                    TextField("Loan Number", text: $loanNumber)
                        .keyboardType(.numberPad)
                }

                Section("Property") {
                    TextField("Property Address", text: $propertyAddress)
                }

                Section("Loan Details") {
                    HStack {
                        Text("$")
                            .foregroundColor(.secondary)
                        TextField("Original Loan Amount", text: $originalLoanAmount)
                            .keyboardType(.decimalPad)
                    }

                    HStack {
                        TextField("Interest Rate", text: $interestRate)
                            .keyboardType(.decimalPad)
                        Text("%")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        TextField("Loan Term", text: $loanTerm)
                            .keyboardType(.numberPad)
                        Text("years")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Add Mortgage Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveAccount()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(!isFormValid)
                }
            }
        }
    }

    private func saveAccount() {
        guard let loanAmount = Double(originalLoanAmount),
              let rate = Double(interestRate),
              let term = Int(loanTerm) else { return }

        let rateDecimal = rate / 100.0
        let monthlyRate = rateDecimal / 12.0
        let totalPayments = Double(term * 12)
        let monthlyPayment: Double
        if monthlyRate > 0 {
            monthlyPayment = loanAmount * (monthlyRate * pow(1 + monthlyRate, totalPayments)) /
                (pow(1 + monthlyRate, totalPayments) - 1)
        } else {
            monthlyPayment = loanAmount / totalPayments
        }

        let account = User.MortgageAccount(
            loanNumber: loanNumber,
            servicerName: servicerName,
            servicerAddress: nil,
            propertyAddress: propertyAddress,
            originalLoanAmount: loanAmount,
            currentBalance: loanAmount,
            interestRate: rateDecimal,
            loanTerm: term,
            loanOriginationDate: Date(),
            monthlyPayment: monthlyPayment,
            escrowAccount: false,
            documents: [],
            isActive: true,
            addedDate: Date()
        )

        userStore.addMortgageAccount(account)
    }
}

#Preview {
    MortgageAccountManagementView()
        .environmentObject(UserStore())
}
