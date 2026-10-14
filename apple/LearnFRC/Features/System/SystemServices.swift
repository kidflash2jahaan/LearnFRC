import AppIntents
import CoreSpotlight
import SwiftUI
import UserNotifications

/// Wires the system integrations (App Intents, Spotlight, reminders, notification taps) to the
/// app's one `AppModel`. From the shell:
///
///     @main struct LearnFRCApp: App {
///         @State private var model: AppModel
///         init() {
///             let model = AppModel()
///             _model = State(initialValue: model)
///             SystemServices.install(model)          // before any App Intent can run
///         }
///         var body: some Scene {
///             WindowGroup { RootView().appEnvironment(model) }
///                 .commands { AppCommands(model: model) }
///         }
///     }
///
/// and in each window's `RootView`, which owns that window's `WindowNavigation`:
///
///     .systemServices(model, navigation: navigation)  // Spotlight, reminders, Siri suggestions
///     .onOpenURL { url in model.activate(navigation); SystemServices.open(url) }
@MainActor
enum SystemServices {
    /// The model `install(_:)` registered.
    private(set) static var model: AppModel?

    /// Registers the model for App Intents (`@Dependency`), makes LearnFRC the notification
    /// delegate (so reminder taps open the lesson) and points the reminder scheduler at the
    /// stores. Call once, from the `App`'s `init`. Later calls are ignored.
    static func install(_ model: AppModel) {
        guard self.model == nil else { return }
        self.model = model
        AppDependencyManager.shared.add(dependency: model)
        ReminderScheduler.shared.attach(model)
        guard !AppConfig.isRunningPreviews else { return }
        UNUserNotificationCenter.current().delegate = NotificationRouter.shared
    }

    /// Opens a LearnFRC link in the app's active window; links the app has no screen for go to
    /// the browser. On a cold launch a link waits for what it needs, with no network: one
    /// that names a lesson by slug waits for the on-device catalog (so it opens the lesson
    /// instead of bouncing to Safari), and `learnfrc://continue` for the cached progress and
    /// the stored session (so it opens the reader's lesson, not the Guides wall). A link that
    /// arrives while another is waiting wins.
    static func open(_ url: URL) {
        guard let model else { return }
        let link = DeepLink.parse(url)
        guard model.isReady(for: link) else {
            let turn = model.beginLink()
            Task {
                if let web = await model.followWhenReady(link, original: url, generation: turn) { openInBrowser(web) }
            }
            return
        }
        if !model.follow(link) {
            switch link.resolved(using: model.catalog) {
            case .web(let web), .external(let web): openInBrowser(web)
            default: openInBrowser(url)
            }
        }
    }

    #if os(macOS)
    /// The Settings window's opener, handed over by each window (`openSettings` only exists in
    /// a view's environment). Links and the system's notification-settings button use it.
    fileprivate static var openSettingsAction: OpenSettingsAction?

    /// Hands `AppModel` a way to open a new main window (`openWindow` only exists in a view's
    /// environment), for navigation that starts with no main window open: a link in the
    /// Settings window, an App Intent. Each main window and the Settings window call it.
    static func provideMainWindowOpener(_ openWindow: OpenWindowAction) {
        model?.mainWindowOpener = { openWindow(id: LearnFRCApp.mainWindowID) }
    }

    /// Brings up the Mac Settings window. False before any window has opened.
    @discardableResult
    static func openSettingsWindow() -> Bool {
        guard let openSettingsAction else { return false }
        openSettingsAction()
        return true
    }
    #endif

    /// Hands a link to the system (browser or another app).
    static func openInBrowser(_ url: URL) {
        #if os(iOS)
        UIApplication.shared.open(url)
        #elseif os(macOS)
        NSWorkspace.shared.open(url)
        #endif
    }
}

extension View {
    /// Keeps Spotlight, the reminder schedule and Siri's lesson suggestions in step with the
    /// stores, and opens Spotlight results in this window. Attach once to each window's root
    /// view, with that window's navigation.
    func systemServices(_ model: AppModel, navigation: WindowNavigation? = nil) -> some View {
        modifier(SystemServicesModifier(model: model, navigation: navigation))
    }
}

private struct SystemServicesModifier: ViewModifier {
    let model: AppModel
    let navigation: WindowNavigation?
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    #if os(macOS)
    @Environment(\.openSettings) private var openSettings
    @Environment(\.openWindow) private var openWindow
    #endif

    /// Changes whenever something Spotlight shows changes.
    private var indexKey: String {
        let catalog = model.catalog
        return [
            catalog.lastUpdated.map { String($0.timeIntervalSince1970) } ?? "-",
            String(catalog.allLessons.count),
            String(catalog.articles.count),
            model.reference.version,
            String(model.reference.glossary.count),
        ].joined(separator: "|")
    }

    /// Changes whenever the reminder's lesson (or today's "already studied") could change.
    private var reminderKey: String {
        [
            model.progress.continueLesson?.id.uuidString ?? "-",
            String(model.progress.completedTotal),
            model.catalog.isLoaded ? "loaded" : "empty",
        ].joined(separator: "|")
    }

    /// Changes whenever the lessons offered to Siri ("Open <lesson> in LearnFRC") change.
    private var shortcutsKey: String {
        [
            model.progress.continueLesson?.id.uuidString ?? "-",
            model.progress.bookmarkedLessonIDs.map(\.uuidString).sorted().joined(separator: ","),
            String(model.catalog.allLessons.count),
            String(model.reference.glossary.count),
        ].joined(separator: "|")
    }

    func body(content: Content) -> some View {
        content
            #if os(macOS)
            .onAppear {
                SystemServices.openSettingsAction = openSettings
                SystemServices.provideMainWindowOpener(openWindow)
            }
            #endif
            .onContinueUserActivity(CSSearchableItemActionType) { activity in
                guard let identifier = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
                      let link = DeepLink.spotlight(identifier: identifier) else { return }
                if let navigation { model.activate(navigation) }
                let turn = model.beginLink()
                Task {
                    if let url = await model.followWhenReady(link, generation: turn) { openURL(url) }
                }
            }
            .onContinueUserActivity(CSQueryContinuationActionType) { activity in
                let query = activity.userInfo?[CSSearchQueryString] as? String ?? ""
                if let navigation { model.activate(navigation) }
                model.follow(.search(query))
            }
            .task(id: indexKey) {
                guard model.catalog.isLoaded || model.reference.isLoaded else { return }
                // Let launch work settle before indexing a few hundred items.
                try? await Task.sleep(for: .seconds(2))
                guard !Task.isCancelled else { return }
                await SpotlightIndexer.shared.update(catalog: model.catalog, reference: model.reference)
            }
            .task(id: shortcutsKey) {
                guard model.catalog.isLoaded, !AppConfig.isRunningPreviews else { return }
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                LearnFRCShortcuts.updateAppShortcutParameters()
            }
            .onChange(of: reminderKey, initial: true) {
                ReminderScheduler.shared.setNeedsReschedule()
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else { return }
                // Back from Settings (permission may have changed) or a new day (today's reminder).
                ReminderScheduler.shared.setNeedsReschedule()
            }
    }
}
