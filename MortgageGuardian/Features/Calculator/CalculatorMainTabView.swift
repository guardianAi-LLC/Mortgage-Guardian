import SwiftUI

struct CalculatorMainTabView: View {
    @State private var appState = AppState()

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            CalculatorView()
                .tabItem {
                    Label("Calculator", systemImage: "calculator")
                }
                .tag(Tab.calculator)

            Text("Saved Scenarios")
                .tabItem {
                    Label("Scenarios", systemImage: "list.bullet")
                }
                .tag(Tab.scenarios)

            Text("Settings")
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(Tab.settings)
        }
        .environment(appState)
    }
}
