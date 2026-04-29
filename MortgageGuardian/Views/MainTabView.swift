// MainTabView.swift
import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var documentManager: DocumentManager

    var body: some View {
        TabView {
            DocumentsView()
                .tabItem {
                    Label("Documents", systemImage: "doc.text")
                }

            AnalysisView()
                .tabItem {
                    Label("Analysis", systemImage: "chart.bar.doc.horizontal")
                }

            RealPlaidConnectionView()
                .tabItem {
                    Label("Accounts", systemImage: "building.columns")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle")
                }
        }
        .accentColor(.blue)
        .task { await AuthenticatedProbe.runOnce() }
        .task { await PlaidProbe.runOnce() }
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthManager())
        .environmentObject(DocumentManager())
}