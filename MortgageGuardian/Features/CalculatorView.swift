import SwiftUI

struct CalculatorView: View {
    @Environment(AppState.self) private var appState: AppState?
    @State private var principalAmount: Double = 300000
    @State private var interestRate: Double = 6.5
    @State private var loanTerm: Int = 30
    @State private var downPayment: Double = 60000
    @State private var showingSaveConfirmation = false

    private var calculation: MortgageCalculation {
        MortgageCalculation(
            principalAmount: principalAmount,
            annualInterestRate: interestRate,
            loanTermYears: loanTerm,
            downPayment: downPayment
        )
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section("Loan Details") {
                    LoanInputField(value: $principalAmount, title: "Purchase Price", format: .currency(code: "USD"))
                    LoanInputField(value: $downPayment, title: "Down Payment", format: .currency(code: "USD"))
                    LoanInputField(value: $interestRate, title: "Interest Rate", format: .percent)
                    Picker("Loan Term", selection: $loanTerm) {
                        Text("15 Years").tag(15)
                        Text("20 Years").tag(20)
                        Text("30 Years").tag(30)
                    }
                }
                
                Section("Monthly Payment") {
                    Text(calculation.monthlyPayment, format: .currency(code: "USD"))
                        .font(.title2)
                        .fontWeight(.bold)
                }
                
                Section("Loan Summary") {
                    SummaryRow(title: "Principal", value: principalAmount - downPayment)
                    SummaryRow(title: "Total Interest", value: calculation.totalInterest)
                    SummaryRow(title: "Total Cost", value: (calculation.monthlyPayment * Double(loanTerm * 12)))
                }
            }
            .navigationTitle("Mortgage Calculator")
            .toolbar {
                Button("Save") {
                    saveScenario()
                }
            }
            .alert("Scenario Saved", isPresented: $showingSaveConfirmation) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("Your mortgage scenario has been saved.")
            }
        }
    }

    private func saveScenario() {
        let scenario = MortgageScenario(
            calculation: calculation,
            date: Date(),
            notes: nil
        )
        appState?.saveScenario(scenario)
        showingSaveConfirmation = true
    }
}

struct LoanInputField: View {
    @Binding var value: Double
    let title: String
    let format: FloatingPointFormatStyle<Double>
    
    var body: some View {
        HStack {
            Text(title)
            Spacer()
            TextField("", value: $value, format: format)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
        }
    }
}

struct SummaryRow: View {
    let title: String
    let value: Double
    
    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text(value, format: .currency(code: "USD"))
        }
    }
}

#Preview {
    CalculatorView()
}