import CoreML
import SwiftUI

@Observable
class AIManager {
    private let mlPredictor = MLPredictor.shared
    private let documentAnalyzer = DocumentAnalysisService()
    
    // Market data service for real-time updates
    private var marketDataTimer: Timer?
    private var lastMarketUpdate: Date?
    
    init() {
        setupMarketDataUpdates()
    }
    
    private func setupMarketDataUpdates() {
        // Update market data every 6 hours
        marketDataTimer = Timer.scheduledTimer(withTimeInterval: 6 * 60 * 60, repeats: true) { [weak self] _ in
            Task {
                await self?.updateMarketData()
            }
        }
    }
    
    func analyzeScenario(_ scenario: SavedMortgageScenario, userProfile: MortgageUserProfile) async throws {
        async let riskAssessment = mlPredictor.assessMortgageRisk(
            scenario: scenario,
            annualIncome: userProfile.annualIncome,
            creditScore: userProfile.creditScore,
            employmentYears: userProfile.employmentYears
        )
        
        async let propertyPrediction = mlPredictor.predictPropertyValue(
            currentValue: scenario.principalAmount,
            location: userProfile.location,
            propertyType: "residential",
            timeframe: 5 * 365 * 24 * 60 * 60 // 5 years
        )
        
        async let recommendations = mlPredictor.generateRecommendations(
            desiredPrice: scenario.principalAmount,
            annualIncome: userProfile.annualIncome,
            creditScore: userProfile.creditScore,
            location: userProfile.location,
            savingsAmount: scenario.downPayment
        )
        
        // Update scenario with AI insights
        let (risk, prediction, recommend) = await (
            try riskAssessment,
            try propertyPrediction,
            try recommendations
        )
        
        scenario.riskAssessment = risk
        scenario.propertyValuePrediction = prediction
        scenario.aiRecommendations = recommend
        scenario.lastAIUpdateDate = Date()
    }
    
    private func updateMarketData() async {
        // Stub: real-time market data updates not yet integrated
        print("Market data update skipped — real-time market data not yet integrated")
    }
}

// User profile for AI analysis
struct AIManagerMortgageProfile {
    var annualIncome: Double
    var creditScore: Int
    var employmentYears: Double
    var location: String
    var existingDebts: Double
    var monthlyExpenses: Double
    
    var debtToIncomeRatio: Double {
        (existingDebts + monthlyExpenses * 12) / annualIncome
    }
}