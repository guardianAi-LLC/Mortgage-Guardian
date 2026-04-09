import SwiftUI

// MARK: - Input Fields
struct BrandedTextField: View {
    let title: String
    let text: Binding<String>
    let icon: String
    
    init(_ title: String, text: Binding<String>, icon: String) {
        self.title = title
        self.text = text
        self.icon = icon
    }
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(AppTheme.primaryGreen)
            TextField(title, text: text)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

// MARK: - Buttons
struct BrandedButton: View {
    let title: String
    let action: () -> Void
    let style: ButtonStyle
    
    enum ButtonStyle {
        case primary
        case secondary
        case outline
    }
    
    init(_ title: String, style: ButtonStyle = .primary, action: @escaping () -> Void) {
        self.title = title
        self.style = style
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .frame(maxWidth: .infinity)
                .padding()
                .background(backgroundForStyle)
                .foregroundStyle(foregroundForStyle)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(style == .outline ? AppTheme.primaryGreen : .clear, lineWidth: 2)
                )
        }
    }
    
    private var backgroundForStyle: AnyShapeStyle {
        switch style {
        case .primary:
            AnyShapeStyle(AppTheme.gradient)
        case .secondary:
            AnyShapeStyle(Color(.systemBackground))
        case .outline:
            AnyShapeStyle(Color.clear)
        }
    }
    
    private var foregroundForStyle: Color {
        switch style {
        case .primary:
            .white
        case .secondary, .outline:
            AppTheme.primaryGreen
        }
    }
}

// MARK: - Cards
struct InfoCard: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(AppTheme.primaryGreen)
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground)).cornerRadius(12).shadow(radius: 2)
    }
}

// MARK: - List Items
struct ScenarioListItem: View {
    let title: String
    let subtitle: String
    let value: String
    
    var body: some View {
        HStack(spacing: 16) {
            Circle()
                .fill(AppTheme.gradient)
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: "house.fill")
                        .foregroundStyle(.white)
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Text(value)
                .font(.headline)
                .foregroundStyle(AppTheme.primaryGreen)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

// MARK: - Navigation Items
struct NavigationRow: View {
    let title: String
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(AppTheme.primaryGreen)
                    .frame(width: 30)
                
                Text(title)
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(8)
        }
    }
}