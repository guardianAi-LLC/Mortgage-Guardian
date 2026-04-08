import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Utility for sharing, saving, and printing content from both UIKit and SwiftUI contexts.
///
/// All methods run on the main actor to ensure safe interaction with UIKit presentation APIs.
/// Uses the modern `connectedScenes` API for root view controller discovery rather than
/// the deprecated `UIApplication.shared.windows`.
struct ShareUtility {

    // MARK: - UIKit Presentation Methods

    /// Presents a `UIActivityViewController` to share the provided items.
    ///
    /// - Parameters:
    ///   - items: The activity items to share (URLs, strings, images, data, etc.).
    ///   - viewController: The presenting view controller. If `nil`, the topmost controller is resolved automatically.
    @MainActor
    static func shareItems(_ items: [Any], from viewController: UIViewController? = nil) {
        let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)

        guard let presenter = viewController ?? topViewController() else { return }

        // iPad requires a popover source
        if let popover = activityVC.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(
                x: presenter.view.bounds.midX,
                y: presenter.view.bounds.midY,
                width: 0,
                height: 0
            )
            popover.permittedArrowDirections = []
        }

        presenter.present(activityVC, animated: true)
    }

    /// Presents a `UIDocumentPickerViewController` so the user can save a file to the Files app.
    ///
    /// - Parameters:
    ///   - url: A file URL pointing to the document to export.
    ///   - viewController: The presenting view controller. If `nil`, the topmost controller is resolved automatically.
    @MainActor
    static func saveToFiles(_ url: URL, from viewController: UIViewController? = nil) {
        let documentPicker = UIDocumentPickerViewController(forExporting: [url])
        documentPicker.shouldShowFileExtensions = true

        guard let presenter = viewController ?? topViewController() else { return }
        presenter.present(documentPicker, animated: true)
    }

    /// Prints the provided data using `UIPrintInteractionController`.
    ///
    /// - Parameters:
    ///   - data: The printable data (typically a PDF).
    ///   - jobName: A human-readable name for the print job.
    ///   - viewController: The presenting view controller (used on iPad for popover anchoring). If `nil`, the topmost controller is resolved automatically.
    @MainActor
    static func printData(_ data: Data, jobName: String, from viewController: UIViewController? = nil) {
        guard UIPrintInteractionController.isPrintingAvailable else { return }

        let printController = UIPrintInteractionController.shared
        let printInfo = UIPrintInfo(dictionary: nil)
        printInfo.jobName = jobName
        printInfo.outputType = .general

        printController.printInfo = printInfo
        printController.printingItem = data

        printController.present(animated: true) { _, completed, error in
            if let error = error, !completed {
                print("Print error: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - SwiftUI Convenience

    /// Presents a share sheet from the topmost view controller, suitable for calling directly from SwiftUI actions.
    ///
    /// - Parameter items: The activity items to share.
    @MainActor
    static func presentShareSheet(items: [Any]) {
        shareItems(items, from: nil)
    }

    // MARK: - Root View Controller Discovery

    /// Resolves the topmost presented `UIViewController` using the connected window scenes API.
    ///
    /// This avoids the deprecated `UIApplication.shared.windows` accessor.
    @MainActor
    static func topViewController() -> UIViewController? {
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let rootVC = windowScene.windows
            .first(where: { $0.isKeyWindow })?.rootViewController
        else {
            return nil
        }

        return findTopmost(from: rootVC)
    }

    @MainActor
    private static func findTopmost(from controller: UIViewController) -> UIViewController {
        if let presented = controller.presentedViewController {
            return findTopmost(from: presented)
        }
        if let nav = controller as? UINavigationController,
           let visible = nav.visibleViewController {
            return findTopmost(from: visible)
        }
        if let tab = controller as? UITabBarController,
           let selected = tab.selectedViewController {
            return findTopmost(from: selected)
        }
        return controller
    }
}

// MARK: - SwiftUI Share Sheet Modifier

/// A view modifier that presents a system share sheet when `isPresented` becomes `true`.
struct ShareSheetModifier: ViewModifier {
    @Binding var isPresented: Bool
    let items: [Any]

    func body(content: Content) -> some View {
        content
            .background(
                ShareSheetPresenter(isPresented: $isPresented, items: items)
            )
    }
}

/// A `UIViewControllerRepresentable` that bridges `UIActivityViewController` into SwiftUI.
///
/// The controller is presented when `isPresented` transitions to `true` and automatically
/// resets the binding when dismissed.
private struct ShareSheetPresenter: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let items: [Any]

    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        if isPresented, uiViewController.presentedViewController == nil {
            let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
            activityVC.completionWithItemsHandler = { _, _, _, _ in
                isPresented = false
            }

            // iPad popover support
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = uiViewController.view
                popover.sourceRect = CGRect(
                    x: uiViewController.view.bounds.midX,
                    y: uiViewController.view.bounds.midY,
                    width: 0,
                    height: 0
                )
                popover.permittedArrowDirections = []
            }

            uiViewController.present(activityVC, animated: true)
        }
    }
}

// MARK: - View Extension

extension View {
    /// Presents a system share sheet with the given items.
    ///
    /// - Parameters:
    ///   - isPresented: A binding that controls whether the share sheet is shown.
    ///   - items: The activity items to share.
    func shareSheet(isPresented: Binding<Bool>, items: [Any]) -> some View {
        modifier(ShareSheetModifier(isPresented: isPresented, items: items))
    }
}
