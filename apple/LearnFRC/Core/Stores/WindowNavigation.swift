import Foundation
import Observation
import SwiftUI
#if os(macOS)
import AppKit
#endif

/// One window's navigation: the selected tab, a stack per tab, and a search request
/// waiting for that window's search screen.
///
/// `RootView` owns one per window (iPad windows, Mac ⌘N), so each window keeps its own place.
/// Screens rarely touch it directly: `AppModel.push`, `open`, `selectedTab` and friends act on
/// the active window's navigation (`AppModel.activeNavigation`), which is the window the person
/// is using. It's also in the environment for screens that want their own window explicitly:
///
///     @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
@Observable
@MainActor
final class WindowNavigation {
    /// The selected tab (bound to the window's `TabView`, or the Mac sidebar's selection).
    var selectedTab: AppTab = .home {
        didSet { if selectedTab != oldValue { isPristine = false } }
    }
    /// A navigation path per tab (bound to each tab's `NavigationStack`).
    var paths: [AppTab: [AppRoute]] = [:] {
        didSet { if paths != oldValue { isPristine = false } }
    }
    /// The newest search request this window's search screen hasn't taken yet.
    private(set) var searchRequest: SearchRequest?

    /// True until anything changes: a fresh window may adopt work done before it existed
    /// (an App Intent on a cold launch) or restore where it was last time.
    @ObservationIgnored private(set) var isPristine = true

    /// What screens leave behind for when they're built again: the Mac rebuilds a tab's stack
    /// on every tab switch (ARCHITECTURE 6.6), so a half-typed glossary filter or a
    /// half-answered quiz is kept here, per window, for this run of the app.
    @ObservationIgnored let memory = ScreenMemory()

    /// False while the window's stacks aren't on screen because something else has the window
    /// (the username gate, set by `RootView`). A stack being taken down pops itself on the way
    /// out, and that mustn't empty its tab: the place is still there when the stacks come back.
    @ObservationIgnored var showsStacks: @MainActor () -> Bool = { true }

    #if os(macOS)
    /// The Mac window showing this navigation, set by `RootView`. `AppModel` brings it forward
    /// for navigation that starts outside it (the Settings window, a menu command, an intent).
    @ObservationIgnored weak var hostWindow: NSWindow?
    #endif

    /// A request to show Search with the field focused, optionally with words filled in.
    struct SearchRequest: Identifiable, Hashable, Sendable {
        let id: UUID
        /// May be empty: then just focus the field.
        let query: String
    }

    init() {}

    // MARK: Paths

    /// One tab's path as `NavigationStack(path:)` reads and writes it. Bind it through the
    /// key path (`$navigation[stack: tab]` from `@Bindable`, or `path(for:)`), not a
    /// `Binding(get:set:)`: a key-path binding is the same binding on every render, while a
    /// closure binding is new each time the window redraws, and a stack built and redrawn in
    /// one frame (a window appearing) reported "bound path tried to update multiple times per
    /// frame".
    ///
    /// Only the selected tab's stack writes back. The Mac builds just the selected tab, and a
    /// stack being taken down (because another tab was selected, or the username gate took the
    /// window, `showsStacks`) pops itself to its root on the way out; that isn't the person
    /// going back, so it mustn't empty the tab's place. A stack handing back the path it
    /// already shows is ignored too. Programmatic navigation (`push`, `open`, `show`) sets
    /// `paths` directly and isn't affected.
    subscript(stack tab: AppTab) -> [AppRoute] {
        get { paths[tab] ?? [] }
        set {
            guard tab == selectedTab, showsStacks(), (paths[tab] ?? []) != newValue else { return }
            paths[tab] = newValue
        }
    }

    /// A two-way binding to one tab's path, for `NavigationStack(path:)` (`self[stack:]`).
    func path(for tab: AppTab) -> Binding<[AppRoute]> {
        Bindable(self)[stack: tab]
    }

    /// True when `route` is the screen on top of `tab` and that tab is selected: what a screen
    /// checks before it speaks for the window (Handoff, the Lesson menu), since iPhone and iPad
    /// keep hidden tabs and covered screens alive. `tab` is the stack the screen sits in
    /// (`\.navigationTab`).
    func isShowing(_ route: AppRoute, in tab: AppTab) -> Bool {
        selectedTab == tab && paths[tab]?.last == route
    }

    /// True while `route` is anywhere in `tab`'s stack, shown or not.
    func holds(_ route: AppRoute, in tab: AppTab) -> Bool {
        paths[tab]?.contains(route) ?? false
    }

    /// Pushes a route onto a tab (the selected tab by default).
    func push(_ route: AppRoute, in tab: AppTab? = nil) {
        paths[tab ?? selectedTab, default: []].append(route)
    }

    /// Switches to the tab that owns a route and shows it on a clean stack. A route that is
    /// itself a tab's root screen (the leaderboard) just selects that tab at its root, so the
    /// screen never sits on top of itself.
    func open(_ route: AppRoute) {
        if let root = AppModel.rootTab(of: route) {
            select(root)
            setPath([], for: root)
            return
        }
        let tab = AppModel.tab(for: route)
        select(tab)
        setPath([route], for: tab)
    }

    /// Selects a tab at its root.
    func show(_ tab: AppTab) {
        select(tab)
        setPath([], for: tab)
    }

    func popToRoot(_ tab: AppTab? = nil) {
        setPath([], for: tab ?? selectedTab)
    }

    /// Assignments that change nothing are skipped: `@Observable` reports every assignment,
    /// and a stack told its path changed when it didn't can update twice in one frame.
    private func select(_ tab: AppTab) {
        if selectedTab != tab { selectedTab = tab }
    }

    private func setPath(_ stack: [AppRoute], for tab: AppTab) {
        if (paths[tab] ?? []) != stack { paths[tab] = stack }
    }

    /// Pops one screen off the selected tab. False when already at the root.
    @discardableResult
    func goBack() -> Bool {
        guard var stack = paths[selectedTab], !stack.isEmpty else { return false }
        stack.removeLast()
        paths[selectedTab] = stack
        return true
    }

    /// True when the selected tab has something to go back from.
    var canGoBack: Bool { !(paths[selectedTab] ?? []).isEmpty }

    /// The lesson on top of the selected tab's stack, if one is showing.
    var visibleLessonID: UUID? {
        guard case .lesson(let id)? = paths[selectedTab]?.last else { return nil }
        return id
    }

    /// Shows a lesson in the selected tab. When `current` is on top of the stack it's swapped
    /// out (stepping through lessons doesn't pile up a long back stack); otherwise it's pushed.
    func showLesson(_ id: UUID, replacing current: UUID?) {
        var stack = paths[selectedTab] ?? []
        if let current, case .lesson(current)? = stack.last {
            stack[stack.count - 1] = .lesson(id)
        } else {
            stack.append(.lesson(id))
        }
        setPath(stack, for: selectedTab)
    }

    // MARK: Search requests

    /// Switches to Search at its root and leaves a request for the search screen, which fills
    /// in `query` (when there is one) and focuses the field as soon as it's on screen.
    func requestSearch(_ query: String) {
        show(.search)
        searchRequest = SearchRequest(id: UUID(), query: query.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    /// Returns the waiting search request and clears it.
    func takeSearchRequest() -> SearchRequest? {
        guard let request = searchRequest else { return nil }
        searchRequest = nil
        return request
    }

    // MARK: Moving state between windows

    /// Takes over another navigation's place (a window opening after an App Intent or a link
    /// already chose where to go).
    func adopt(_ other: WindowNavigation) {
        if selectedTab != other.selectedTab { selectedTab = other.selectedTab }
        if paths != other.paths { paths = other.paths }
        if let request = other.searchRequest { searchRequest = request }
    }

    // MARK: Restoration (`@SceneStorage`)

    private struct Snapshot: Codable {
        var tab: AppTab
        var paths: [String: [AppRoute]]
    }

    /// The selected tab and every stack, encoded for `@SceneStorage`.
    var restorationData: Data? {
        let snapshot = Snapshot(
            tab: selectedTab,
            paths: Dictionary(uniqueKeysWithValues: paths.filter { !$0.value.isEmpty }.map { ($0.key.rawValue, $0.value) })
        )
        return try? JSONEncoder().encode(snapshot)
    }

    /// Puts the window back where `restorationData` left it. Ignores data it can't read.
    func restore(from data: Data) {
        guard let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        var restored: [AppTab: [AppRoute]] = [:]
        for (key, stack) in snapshot.paths {
            guard let tab = AppTab(rawValue: key), !stack.isEmpty else { continue }
            restored[tab] = stack
        }
        // Only what differs: an unchanged assignment still tells every stack its path changed.
        if selectedTab != snapshot.tab { selectedTab = snapshot.tab }
        if paths != restored { paths = restored }
    }
}

/// A screen's leftovers, per window, kept for as long as the app runs: on the Mac, switching
/// tabs rebuilds the stack (ARCHITECTURE 6.6), so a screen that wants to come back as it was
/// writes its state here as it changes and reads it back when it's built again. Keys name
/// the screen and the thing (`"glossary.filter"`, `"quiz/<tab>/<lesson id>"`). Not observed: it
/// never drives a redraw, so nothing measured during layout can feed back through it.
@MainActor
final class ScreenMemory {
    private var values: [String: any Sendable] = [:]

    func value<Value: Sendable>(_ type: Value.Type = Value.self, for key: String) -> Value? {
        values[key] as? Value
    }

    /// Stores a value, or forgets the key when `value` is nil.
    func set<Value: Sendable>(_ value: Value?, for key: String) {
        values[key] = value
    }
}

extension EnvironmentValues {
    /// The tab whose stack a screen sits in, set on each tab's `NavigationStack` by `RootView`.
    /// nil outside a tab (previews, a sheet with its own stack). Pair it with
    /// `WindowNavigation.isShowing(_:in:)`.
    @Entry var navigationTab: AppTab? = nil
}
