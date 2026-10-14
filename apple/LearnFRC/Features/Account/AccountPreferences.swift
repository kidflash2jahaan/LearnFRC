import SwiftUI

// The appearance: an app-only preference that lives on this device and never touches
// the account or learnfrc.com. (The daily study reminder's settings belong to
// `ReminderScheduler` in Features/System; Settings drives it directly.)

// MARK: - Appearance

/// Paper (light), Night (dark) or whatever the device is set to. Stored per device.
///
/// INTEGRATOR: apply `.applyAppearancePreference()` once at the root of every window
/// (the main `WindowGroup` content and, on Mac, the `Settings` scene content).
enum AppearancePreference: String, CaseIterable, Identifiable, Sendable {
    case system
    case paper
    case night

    /// The `UserDefaults` / `@AppStorage` key.
    static let storageKey = "lf.appearance"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: "System"
        case .paper: "Paper"
        case .night: "Night"
        }
    }

    var caption: String {
        switch self {
        case .system: "matches device"
        case .paper: "always light"
        case .night: "always dark"
        }
    }

    /// nil follows the system.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .paper: .light
        case .night: .dark
        }
    }

    /// The choice saved on this device.
    static var current: AppearancePreference {
        UserDefaults.standard.string(forKey: storageKey).flatMap(AppearancePreference.init(rawValue:)) ?? .system
    }
}

extension View {
    /// Applies the appearance picked in Settings to this window.
    func applyAppearancePreference() -> some View {
        modifier(AppearancePreferenceModifier())
    }
}

private struct AppearancePreferenceModifier: ViewModifier {
    @AppStorage(AppearancePreference.storageKey) private var raw = AppearancePreference.system.rawValue

    func body(content: Content) -> some View {
        content.preferredColorScheme(AppearancePreference(rawValue: raw)?.colorScheme)
    }
}
