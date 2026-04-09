import SwiftUI

enum Tab {
    case calculator
    case scenarios
    case settings
}

@Observable
class AppState {
    var selectedTab: Tab = .calculator
    var savedScenarios: [MortgageScenario] = []

    // App settings
    var defaultLoanTerm: Int = 30
    var defaultInterestRate: Double = 6.5

    private let dataManager = DataManager()

    init() {
        loadScenarios()
    }

    func saveScenario(_ scenario: MortgageScenario) {
        savedScenarios.append(scenario)
        do {
            try dataManager.saveScenario(
                principalAmount: scenario.calculation.principalAmount,
                annualInterestRate: scenario.calculation.annualInterestRate,
                loanTermYears: scenario.calculation.loanTermYears,
                downPayment: scenario.calculation.downPayment,
                notes: scenario.notes
            )
        } catch {
            print("Failed to persist scenario: \(error)")
        }
    }

    func loadScenarios() {
        do {
            let saved = try dataManager.fetchScenarios()
            savedScenarios = saved.map { $0.toMortgageScenario() }
        } catch {
            print("Failed to load scenarios: \(error)")
        }
    }

    func deleteScenario(_ scenario: MortgageScenario) {
        savedScenarios.removeAll { $0.id == scenario.id }
        do {
            let saved = try dataManager.fetchScenarios()
            if let match = saved.first(where: {
                $0.principalAmount == scenario.calculation.principalAmount &&
                $0.annualInterestRate == scenario.calculation.annualInterestRate &&
                $0.loanTermYears == scenario.calculation.loanTermYears &&
                $0.downPayment == scenario.calculation.downPayment
            }) {
                try dataManager.deleteScenario(match)
            }
        } catch {
            print("Failed to delete scenario: \(error)")
        }
    }
}

// MARK: - Bridging between SavedMortgageScenario and MortgageScenario
extension SavedMortgageScenario {
    func toMortgageScenario() -> MortgageScenario {
        let calculation = MortgageCalculation(
            principalAmount: principalAmount,
            annualInterestRate: annualInterestRate,
            loanTermYears: loanTermYears,
            downPayment: downPayment
        )
        return MortgageScenario(
            calculation: calculation,
            date: createdAt,
            notes: notes
        )
    }
}