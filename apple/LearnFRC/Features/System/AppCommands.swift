import SwiftUI

/// Menu bar commands on Mac and iPad, and the keyboard shortcuts that go with them
/// (they also show in iPad's hold-Command shortcut overlay).
///
/// | Menu | Command | Shortcut |
/// |---|---|---|
/// | Go | Search… | ⌘K |
/// | Go | Home, Guides, Community, You (the sidebar's order) | ⌘1 to ⌘4 |
/// | Go | Back | ⌘[ |
/// | Go | Continue Lesson | ⇧⌘L |
/// | Go | Videos, Glossary, Tools, Resources, Bookmarks, Leaderboard, Badges, My Team | |
/// | Go | Admin (site admins), Admin team (super admins); nothing for anyone else | |
/// | Lesson | Next Lesson / Previous Lesson | ⌥⌘→ / ⌥⌘← |
/// | Lesson | Bookmark Lesson / Remove Bookmark | ⌘D |
/// | Lesson | Open on learnfrc.com, Copy Link | |
/// | View | Refresh | ⌘R (only here; screens don't bind it themselves) |
/// | View | Show Sidebar / Hide Sidebar (Mac, `SidebarCommands` in `LearnFRCApp`) | ⌃⌘S |
/// | App | Settings… | ⌘, |
/// | Help | LearnFRC on the Web, Glossary on learnfrc.com | |
///
/// Commands act on the key window: its `WindowNavigation`, published by `RootView` with
/// `.focusedSceneValue(\.learnFRCNavigation, ...)`. On the Mac, when no main window is key
/// (the Settings window is, or every main window is closed), the Go menu navigates the
/// frontmost main window and brings it forward, or opens a new main window, which takes the
/// request over (`AppModel.revealActiveWindow()`). The Lesson menu only ever acts on the
/// lesson the key window shows: the `.lesson` on top of its selected tab
/// (`WindowNavigation.visibleLessonID`), and only one the catalog knows. Next and Previous
/// swap that entry (`showLesson(_:replacing:)`); the lesson screen follows its route and
/// moves in place.
///
/// While the username gate is up (an account with no username), the Go and Lesson menus and
/// Settings… are off: nothing else on the account works until a handle is set, and the gate
/// is the only thing on screen (ARCHITECTURE 6.2).
struct AppCommands: Commands {
    let model: AppModel
    /// Adds "Settings…" (⌘,) that opens the Settings screen. Pass false when the app adds a
    /// SwiftUI `Settings` scene on Mac (that scene brings its own menu item).
    var includesSettingsItem: Bool = true

    @FocusedValue(\.learnFRCNavigation) private var focusedNavigation

    init(model: AppModel, includesSettingsItem: Bool = true) {
        self.model = model
        self.includesSettingsItem = includesSettingsItem
    }

    private var target: CommandTarget {
        CommandTarget(model: model, focused: focusedNavigation)
    }

    /// The username gate is up in every window (the account has no username).
    private var isGated: Bool { model.account.needsUsernameSetup }

    var body: some Commands {
        CommandMenu("Go") {
            GoMenuItems(model: model, target: target)
                .disabled(isGated)
        }
        CommandMenu("Lesson") {
            LessonMenuItems(model: model, navigation: focusedNavigation)
                .disabled(isGated)
        }
        CommandGroup(after: .toolbar) {
            RefreshMenuItem(model: model)
        }
        if includesSettingsItem {
            CommandGroup(replacing: .appSettings) {
                Button("Settings…") { target.perform { $0.open(.settings) } }
                    .keyboardShortcut(",", modifiers: .command)
                    .disabled(isGated)
            }
        }
        CommandGroup(replacing: .help) {
            HelpMenuItems()
        }
    }
}

extension FocusedValues {
    /// The navigation of the window that has focus, published by `RootView`. Menu commands
    /// navigate that window.
    @Entry var learnFRCNavigation: WindowNavigation?
}

/// Where a Go command navigates: the key window, or on the Mac with no main window key, the
/// active main window brought forward (a new one when none is open).
@MainActor
private struct CommandTarget {
    let model: AppModel
    /// The key window's navigation, if a main window is key.
    let focused: WindowNavigation?

    func perform(_ action: (WindowNavigation) -> Void) {
        if let focused {
            model.activate(focused)
            action(focused)
            return
        }
        // No main window has focus (Mac: the Settings window is key, or none is open). Act on
        // the active one (the stand-in when none is open, which the next window takes over),
        // then show it.
        action(model.activeNavigation)
        model.revealActiveWindow()
    }
}

// MARK: - Menus

private struct GoMenuItems: View {
    let model: AppModel
    let target: CommandTarget

    var body: some View {
        Button("Search…") {
            target.perform { $0.requestSearch("") }
        }
        .keyboardShortcut("k", modifiers: .command)

        Divider()

        // ⌘1 to ⌘4 follow the order the tab bar and sidebar show; Search has ⌘K.
        ForEach(Array(AppTab.visibleOrder.enumerated()), id: \.element) { index, tab in
            Button {
                target.perform { window in
                    if window.selectedTab == tab { window.popToRoot(tab) } else { window.selectedTab = tab }
                }
            } label: {
                Label(tab.title, systemImage: tab.systemImage)
            }
            .keyboardShortcut(KeyEquivalent(Character(String(index + 1))), modifiers: .command)
        }

        Divider()

        // Back belongs to the window in front: with no main window key there's nothing to go
        // back from that the person can see.
        Button("Back") { target.focused?.goBack() }
            .keyboardShortcut("[", modifiers: .command)
            .disabled(!(target.focused?.canGoBack ?? false))

        Button("Continue Lesson") {
            target.perform { _ in model.follow(.continueLesson) }
        }
        .keyboardShortcut("l", modifiers: [.command, .shift])
        .disabled(!model.catalog.isLoaded)

        Divider()

        Button("Videos") { target.perform { $0.open(.videos) } }
        Button("Glossary") { target.perform { $0.open(.glossaryIndex) } }
        Button("Tools") { target.perform { $0.open(.tools) } }
        Button("Resources") { target.perform { $0.open(.resources) } }
        Button("Bookmarks") { target.perform { $0.open(.bookmarks) } }
        Button("Leaderboard") { target.perform { $0.open(.leaderboard) } }
        Button("Badges") { target.perform { $0.open(.achievements) } }
        Button("My Team") { target.perform { $0.open(.team) } }
            .disabled(!model.account.isSignedIn)

        AdminMenuItems { destination in target.perform { $0.open(AppRoute(destination)) } }
    }
}

private struct LessonMenuItems: View {
    let model: AppModel
    /// The key window's navigation. Nil when no main window has focus: then there's no
    /// lesson in front of the person, and every item is off.
    let navigation: WindowNavigation?
    @Environment(\.openURL) private var openURL

    /// The lesson on top of the key window's selected tab, if the catalog knows it. A lesson
    /// that isn't in the catalog (newer than this device's copy) shows "not found", so there's
    /// nothing to bookmark, share or step from.
    private var location: LessonLocation? {
        navigation?.visibleLessonID.flatMap { model.catalog.location(of: $0) }
    }

    var body: some View {
        let location = location
        let current = location?.id
        let next = current.flatMap { model.catalog.nextLesson(after: $0) }
        let previous = current.flatMap { model.catalog.previousLesson(before: $0) }
        let isBookmarked = current.map { model.progress.isBookmarked($0) } ?? false

        Button("Next Lesson") {
            if let next, let current { go(to: next.id, from: current) }
        }
        .keyboardShortcut(.rightArrow, modifiers: [.command, .option])
        .disabled(next == nil)

        Button("Previous Lesson") {
            if let previous, let current { go(to: previous.id, from: current) }
        }
        .keyboardShortcut(.leftArrow, modifiers: [.command, .option])
        .disabled(previous == nil)

        Divider()

        Button(isBookmarked ? "Remove Bookmark" : "Bookmark Lesson") {
            guard let current else { return }
            Task { await model.progress.toggleBookmark(current) }
        }
        .keyboardShortcut("d", modifiers: .command)
        .disabled(current == nil)

        Divider()

        Button("Open on learnfrc.com") {
            if let location { openURL(location.webURL) }
        }
        .disabled(location == nil)

        Button("Copy Link") {
            if let location { Pasteboard.copy(location.webURL) }
        }
        .disabled(location == nil)
    }

    /// Swaps the lesson on top of the key window's stack, without the push animation. The
    /// lesson screen there is reused for the new route and moves in place, like its own
    /// next and previous buttons.
    private func go(to id: UUID, from current: UUID) {
        guard let navigation else { return }
        model.activate(navigation)
        var swap = Transaction()
        swap.disablesAnimations = true
        withTransaction(swap) { navigation.showLesson(id, replacing: current) }
    }
}

private struct RefreshMenuItem: View {
    let model: AppModel

    var body: some View {
        Button("Refresh") {
            Task { await model.refreshAll() }
        }
        .keyboardShortcut("r", modifiers: .command)
        .disabled(model.isRefreshingAll || !model.connectivity.isOnline)
    }
}

private struct HelpMenuItems: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button("LearnFRC on the Web") { openURL(AppConfig.webBase) }
        Button("Glossary on learnfrc.com") { openURL(AppConfig.webBase.appending(path: "glossary")) }
    }
}

/// Copies a link to the system pasteboard.
private enum Pasteboard {
    @MainActor
    static func copy(_ url: URL) {
        #if os(iOS)
        UIPasteboard.general.url = url
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(url.absoluteString, forType: .string)
        NSPasteboard.general.setString(url.absoluteString, forType: .URL)
        #endif
    }
}
