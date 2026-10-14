import SwiftUI

/// LearnFRC for iPhone, iPad and Mac.
///
/// One `AppModel` for the whole app, shared by every window, the Mac Settings window, App
/// Intents (Siri, Shortcuts, Spotlight) and reminder taps. Each window keeps its own place
/// (`RootView` owns a `WindowNavigation`), and links, Handoff and Spotlight results are handled
/// there so they open in the window that received them. Everything the app shows comes from
/// the same database and `/api/app/*` routes as learnfrc.com (docs/ARCHITECTURE.md).
@main
struct LearnFRCApp: App {
    /// The main window group's id, for `openWindow(id:)`: on the Mac, navigation that starts
    /// with every main window closed (a menu command, a link in the Settings window) opens one.
    static let mainWindowID = "main"

    @State private var model: AppModel

    init() {
        FontRegistry.registerAll()
        let model = AppModel()
        _model = State(initialValue: model)
        SystemServices.install(model)   // before any App Intent or notification tap can run
    }

    var body: some Scene {
        WindowGroup(id: Self.mainWindowID) {
            RootView()
                .appEnvironment(model)
                .applyAppearancePreference()
        }
        .commands {
            AppCommands(model: model, includesSettingsItem: Self.commandsOwnSettings)
            #if os(macOS)
            SidebarCommands()   // View > Show Sidebar (⌃⌘S) for the window's sidebar
            #endif
        }
        #if os(macOS)
        .defaultSize(width: 1180, height: 820)
        #endif

        #if os(macOS)
        Settings {
            SettingsWindowContent()
                .appEnvironment(model)
                .applyAppearancePreference()
                .frame(minWidth: 560, minHeight: 640)
                .modifier(MainWindowOpenerHandoff())
        }
        #endif
    }

    /// On the Mac the `Settings` scene supplies the standard "Settings…" menu item, so the
    /// commands mustn't replace it. On iPad they add one that opens Settings in the app.
    private static var commandsOwnSettings: Bool {
        #if os(macOS)
        false
        #else
        true
        #endif
    }
}

#if os(macOS)
/// The Settings window: `SettingsView`, or the username gate while the account has no
/// username, since nothing else on the account works until one is set (ARCHITECTURE 6.2).
private struct SettingsWindowContent: View {
    @Environment(AccountStore.self) private var account

    var body: some View {
        if account.needsUsernameSetup {
            UsernameGateScreen()
        } else {
            SettingsView(context: .window)
        }
    }
}

/// Gives `AppModel` the Settings window's `openWindow`, so a link there (a public profile,
/// say) can open a main window when none is open. Each main window hands over its own too
/// (`SystemServices`).
private struct MainWindowOpenerHandoff: ViewModifier {
    @Environment(\.openWindow) private var openWindow

    func body(content: Content) -> some View {
        content.onAppear { SystemServices.provideMainWindowOpener(openWindow) }
    }
}
#endif
