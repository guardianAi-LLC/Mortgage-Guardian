import SwiftUI

/// A date range picker component with start/end date fields and preset range buttons.
///
/// Provides compact date pickers for selecting a custom range along with convenience
/// presets for common time periods. Validates that the end date is not before the start date.
struct DateRangePicker: View {
    @Binding var startDate: Date
    @Binding var endDate: Date

    /// Called when the user taps "Apply" to confirm the selected range.
    var onApply: (() -> Void)?

    /// Called when the user taps "Reset" to clear the custom range.
    var onReset: (() -> Void)?

    /// Whether the current date selection is valid (end >= start).
    private var isValid: Bool {
        endDate >= startDate
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                Image(systemName: "calendar")
                    .font(.headline)
                    .foregroundColor(.blue)

                Text("Custom Date Range")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()
            }

            // Date Pickers
            VStack(spacing: 12) {
                HStack {
                    Text("Start Date")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    DatePicker(
                        "",
                        selection: $startDate,
                        in: ...Date(),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                    .labelsHidden()
                }

                HStack {
                    Text("End Date")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    DatePicker(
                        "",
                        selection: $endDate,
                        in: ...Date(),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.compact)
                    .labelsHidden()
                }

                // Validation Warning
                if !isValid {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption)
                        Text("End date must be on or after start date")
                            .font(.caption)
                    }
                    .foregroundColor(.red)
                    .padding(.top, 2)
                }
            }

            Divider()

            // Preset Buttons
            VStack(alignment: .leading, spacing: 8) {
                Text("Presets")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fontWeight(.medium)

                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 8) {
                    PresetButton(title: "Last 30 Days") {
                        applyPreset(days: -30)
                    }

                    PresetButton(title: "Last 90 Days") {
                        applyPreset(days: -90)
                    }

                    PresetButton(title: "Last Year") {
                        applyPreset(days: -365)
                    }

                    PresetButton(title: "All Time") {
                        applyAllTime()
                    }
                }
            }

            Divider()

            // Action Buttons
            HStack(spacing: 12) {
                Button {
                    onReset?()
                } label: {
                    Text("Reset")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color(.systemGray5))
                        .foregroundColor(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Button {
                    onApply?()
                } label: {
                    Text("Apply")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(isValid ? Color.blue : Color.gray)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .disabled(!isValid)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.systemGray6))
        )
    }

    // MARK: - Presets

    private func applyPreset(days: Int) {
        endDate = Date()
        startDate = Calendar.current.date(byAdding: .day, value: days, to: endDate) ?? endDate
    }

    private func applyAllTime() {
        // Set start date far in the past to capture all records
        startDate = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date.distantPast
        endDate = Date()
    }
}

// MARK: - Preset Button

private struct PresetButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color(.systemBackground))
                .foregroundColor(.blue)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    DateRangePicker(
        startDate: .constant(Calendar.current.date(byAdding: .month, value: -3, to: Date())!),
        endDate: .constant(Date()),
        onApply: { print("Applied") },
        onReset: { print("Reset") }
    )
    .padding()
}
