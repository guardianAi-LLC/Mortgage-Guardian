#if canImport(CreateML)
import Foundation

class AISetupManager {
    static let shared = AISetupManager()
    private let secureKeyManager = SecureKeyManager.shared
    private var trainingDataManager: TrainingDataManager?

    private init() {}

    func performInitialSetup() async throws {
        print("Starting AI system initialization...")

        // 1. Set up API keys
        try await setupAPIKeys()

        // 2. Initialize training data
        try await setupTrainingData()

        // 3. Train initial models
        try await trainInitialModels()

        print("AI system initialization complete!")
    }

    private func setupAPIKeys() async throws {
        // In a production app, these would be fetched securely from your backend
        let apiKeys = [
            APIService.realEstate: "your_real_estate_api_key",
            APIService.marketData: "your_market_data_api_key",
            APIService.federalReserve: "your_federal_reserve_api_key"
        ]

        for (service, key) in apiKeys {
            try await MainActor.run {
                try secureKeyManager.saveAPIKey(key, forService: service)
            }
        }
    }

    private func setupTrainingData() async throws {
        trainingDataManager = try TrainingDataManager()
        guard let manager = trainingDataManager else { return }
        let (trainingData, validationData) = try await manager.prepareTrainingData()

        print("Training data prepared:")
        print("- Training samples: \(trainingData.rows.count)")
        print("- Validation samples: \(validationData.rows.count)")
    }

    private func trainInitialModels() async throws {
        guard let manager = trainingDataManager else { return }
        let trainer = MLModelTrainer(
            trainingDataPath: manager.trainingDataPath,
            validationDataPath: manager.validationDataPath,
            modelOutputPath: Bundle.main.bundlePath + "/PropertyValuePredictor.mlmodel"
        )

        print("Training property value model...")
        try await trainer.trainPropertyValueModel()

        print("Training risk assessment model...")
        try await trainer.trainRiskAssessmentModel()

        print("Training recommendation model...")
        try await trainer.trainRecommendationModel()
    }
}
#endif
