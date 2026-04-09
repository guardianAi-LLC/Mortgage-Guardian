#if canImport(CreateML)
import Foundation
import CoreML
import CreateML

// Training data structure for property value prediction
struct PropertyTrainingData: Codable {
    let salePrice: Double
    let propertyDetails: PropertyDetails
    let locationData: LocationData
    let marketConditions: MarketConditions
    let timestamp: Date
    
    struct PropertyDetails: Codable {
        let squareFootage: Double
        let bedrooms: Int
        let bathrooms: Double
        let lotSize: Double
        let yearBuilt: Int
        let propertyType: String
        let condition: Int // 1-5 scale
    }
    
    struct LocationData: Codable {
        let latitude: Double
        let longitude: Double
        let zipCode: String
        let neighborhood: String
        let schoolRating: Double
        let crimeRate: Double
        let medianIncome: Double
    }
    
    struct MarketConditions: Codable {
        let medianHomePrice: Double
        let daysOnMarket: Int
        let inventoryLevel: Double
        let mortgageRate: Double
        let unemploymentRate: Double
        let gdpGrowth: Double
    }
}

class TrainingDataManager {
    private let fileManager = FileManager.default
    private let trainingDataURL: URL
    private let validationDataURL: URL
    
    init() throws {
        let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let mlDataPath = documentsPath.appendingPathComponent("MLData", isDirectory: true)
        
        // Create ML data directory if it doesn't exist
        try? fileManager.createDirectory(at: mlDataPath, withIntermediateDirectories: true)
        
        trainingDataURL = mlDataPath.appendingPathComponent("training_data.json")
        validationDataURL = mlDataPath.appendingPathComponent("validation_data.json")
    }
    
    func prepareTrainingData() async throws -> (MLDataTable, MLDataTable) {
        // Fetch real estate data
        let propertyData = try await fetchRealEstateData()
        
        // Split data into training and validation sets (80/20)
        let splitIndex = Int(Double(propertyData.count) * 0.8)
        let trainingData = Array(propertyData[..<splitIndex])
        let validationData = Array(propertyData[splitIndex...])
        
        // Save data for future use
        try saveData(trainingData, to: trainingDataURL)
        try saveData(validationData, to: validationDataURL)
        
        // Convert to MLDataTable format
        return (
            try createMLDataTable(from: trainingData),
            try createMLDataTable(from: validationData)
        )
    }
    
    private func fetchRealEstateData() async throws -> [PropertyTrainingData] {
        // Stub: real API calls not yet integrated — using sample data
        return try loadSampleData()
    }
    
    private func loadSampleData() throws -> [PropertyTrainingData] {
        // Load sample data from bundle
        guard let sampleDataURL = Bundle.main.url(forResource: "sample_property_data", withExtension: "json") else {
            return []
        }
        
        let data = try Data(contentsOf: sampleDataURL)
        return try JSONDecoder().decode([PropertyTrainingData].self, from: data)
    }
    
    private func saveData(_ data: [PropertyTrainingData], to url: URL) throws {
        let jsonData = try JSONEncoder().encode(data)
        try jsonData.write(to: url)
    }
    
    private func createMLDataTable(from data: [PropertyTrainingData]) throws -> MLDataTable {
        // Convert PropertyTrainingData to column-oriented format for MLDataTable
        let columns: [String: MLDataValueConvertible] = [
            "salePrice": data.map { $0.salePrice },
            "squareFootage": data.map { $0.propertyDetails.squareFootage },
            "bedrooms": data.map { $0.propertyDetails.bedrooms },
            "bathrooms": data.map { $0.propertyDetails.bathrooms },
            "lotSize": data.map { $0.propertyDetails.lotSize },
            "propertyAge": data.map { Date().timeIntervalSince1970 - Double($0.propertyDetails.yearBuilt) },
            "latitude": data.map { $0.locationData.latitude },
            "longitude": data.map { $0.locationData.longitude },
            "schoolRating": data.map { $0.locationData.schoolRating },
            "medianIncome": data.map { $0.locationData.medianIncome },
            "marketMedianPrice": data.map { $0.marketConditions.medianHomePrice },
            "daysOnMarket": data.map { $0.marketConditions.daysOnMarket },
            "mortgageRate": data.map { $0.marketConditions.mortgageRate },
            "unemploymentRate": data.map { $0.marketConditions.unemploymentRate },
            "gdpGrowth": data.map { $0.marketConditions.gdpGrowth }
        ]

        return try MLDataTable(dictionary: columns)
    }
}
#endif