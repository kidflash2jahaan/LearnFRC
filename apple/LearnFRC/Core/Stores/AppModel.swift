import Foundation
import Observation
import SwiftUI
#if os(macOS)
import AppKit
#endif

/// The top-level tabs (iPhone tab bar; iPad and Mac sidebar sections).
///
/// `learn` is shown as "Guides", the website's name for the same section.
enum AppTab: String, Hashable, Codable, CaseIterable, Sendable, Identifiable {
    case home, learn, search, community, profile

    /// The tabs in the order the tab bar and sidebar show them. Search sits apart (the search
    /// role), so it isn't in this list; its shortcut is ⌘K.
    static let visibleOrder: [AppTab] = [.home, .learn, .community, .profile]

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .learn: "Guides"
        case .search: "Search"
        case .community: "Community"
        case .profile: "You"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .learn: "books.vertical"
        case .search: "magnifyingglass"
        case .community: "person.3"
        case .profile: "person.crop.circle"
        }
    }
}

/// Owns the stores, starts them, keeps them in sync, and routes deep links.
/// Inject with `.appEnvironment(model)`.
///
/// Navigation lives in each window (`WindowNavigation`, owned by `RootView`). The navigation
/// API here (`selectedTab`, `paths`, `push`, `open`, `popToRoot`, `showLesson`, ...) acts on the
/// active window: the one the person is using (the key window on iPad and Mac). App Intents,
/// links, Spotlight, notification taps and menu commands all go through it.
@Observable
@MainActor
final class AppModel {
    let catalog: CatalogStore
    let reference: ReferenceStore
    let account: AccountStore
    let progress: ProgressStore
    let connectivity: Connectivity

    /// The navigation of the window the person is using. Before any window exists (an App
    /// Intent on a cold launch) and after the last one closes, a stand-in that the next
    /// window takes over.
    private(set) var activeNavigation: WindowNavigation
    private(set) var isBootstrapped = false
    /// True once `loadCache()` has finished: the cached catalog, glossary and progress are in
    /// memory and the stored session has been read.
    @ObservationIgnored private(set) var isCacheLoaded = false
    /// True while a pull to refresh is running.
    private(set) var isRefreshingAll = false

    @ObservationIgnored private var lastForegroundSync: Date?
    @ObservationIgnored private var cacheLoad: Task<Void, Never>?
    /// Open windows, the most recently active last. Only navigations a `RootView` attached.
    @ObservationIgnored private var windows: [WeakNavigation] = []
    /// Goes up with every link, Handoff or Spotlight result the app follows. A link still
    /// waiting for the cache or the account (a cold `learnfrc://continue`) gives way to any
    /// link that came after it (`DeepLinks.swift`).
    @ObservationIgnored var linkGeneration = 0
    #if os(macOS)
    /// Opens a new main window (`openWindow(id: LearnFRCApp.mainWindowID)`), handed over by
    /// each window and the Settings window. A new window takes over the stand-in navigation.
    @ObservationIgnored var mainWindowOpener: (@MainActor () -> Void)?
    #endif

    private struct WeakNavigation {
        weak var value: WindowNavigation?
    }

    init(
        catalog: CatalogStore,
        reference: ReferenceStore,
        account: AccountStore,
        progress: ProgressStore,
        connectivity: Connectivity
    ) {
        self.catalog = catalog
        self.reference = reference
        self.account = account
        self.progress = progress
        self.connectivity = connectivity
        self.activeNavigation = WindowNavigation()
        wire()
    }

    /// The live app: Supabase, learnfrc.com and the on-device cache.
    convenience init() {
        let connectivity = Connectivity()
        let catalog = CatalogStore()
        let reference = ReferenceStore(catalog: catalog)
        let account = AccountStore()
        let progress = ProgressStore(catalog: catalog, account: account, connectivity: connectivity)
        self.init(catalog: catalog, reference: reference, account: account, progress: progress, connectivity: connectivity)
    }

    private func wire() {
        account.onChange = { [weak self] change in
            switch change {
            case .guest, .deleted:
                // Team sheets name teammates; this session's copies go with the account.
                await CommunityCache.shared.forgetTeams()
                // Admin data is memory only and belongs to the account that fetched it.
                AdminStore.shared.reset()
            case .signedIn(let userID, _):
                await AdminStore.shared.sync(userID: userID, force: true)
            }
            await self?.progress.handle(change)
        }
        connectivity.onReconnect = { [weak self] in
            guard let self else { return }
            Task {
                await self.progress.refresh(force: true)
                await self.account.refreshMe()
                await self.catalog.refreshIfStale()
                self.progress.catalogDidChange()
                await self.reference.refreshIfStale()
            }
        }
    }

    // MARK: Lifecycle

    /// Loads the on-device cache (catalog, glossary, progress) and restores the session.
    /// No network, so it's quick and works offline. Safe to call from anywhere (App Intents,
    /// links, every window): later calls wait for the first.
    func loadCache() async {
        if let cacheLoad {
            await cacheLoad.value
            return
        }
        let task = Task { await self.performCacheLoad() }
        cacheLoad = task
        await task.value
    }

    private func performCacheLoad() async {
        async let catalogCache: Void = catalog.loadCache()
        async let referenceCache: Void = reference.loadCache()
        async let progressCache: Void = progress.loadCache()
        _ = await (catalogCache, referenceCache, progressCache)
        progress.catalogDidChange()
        // After the progress cache: account changes write progress.json.
        await account.start()
        isCacheLoaded = true
    }

    /// Loads the cache, then refreshes whatever is stale from the network. Call once from
    /// the root view's `.task` (later calls return at once). Screens show the cached copy
    /// while the refresh runs.
    func bootstrap() async {
        guard !isBootstrapped else { return }
        isBootstrapped = true
        await loadCache()
        lastForegroundSync = .now

        guard connectivity.isOnline else { return }
        async let catalogRefresh: Void = catalog.refreshIfStale()
        async let referenceRefresh: Void = reference.refreshIfStale()
        _ = await (catalogRefresh, referenceRefresh)
        progress.catalogDidChange()
    }

    /// Starts `bootstrap()` without waiting for it (App Intents answer from the cache).
    func bootstrapInBackground() {
        guard !isBootstrapped else { return }
        Task { await bootstrap() }
    }

    /// Call when a scene becomes active (returning to the foreground): progress and
    /// `/me` always (throttled), catalog and reference when older than six hours.
    func sceneBecameActive() async {
        guard isBootstrapped else { return }
        if let lastForegroundSync, Date.now.timeIntervalSince(lastForegroundSync) < 10 { return }
        lastForegroundSync = .now
        await progress.refresh()
        await account.refreshMe()
        guard connectivity.isOnline else { return }
        async let catalogRefresh: Void = catalog.refreshIfStale()
        async let referenceRefresh: Void = reference.refreshIfStale()
        _ = await (catalogRefresh, referenceRefresh)
        progress.catalogDidChange()
    }

    /// Pull to refresh: everything, now.
    func refreshAll() async {
        guard !isRefreshingAll else { return }
        isRefreshingAll = true
        defer { isRefreshingAll = false }
        async let catalogRefresh: Void = catalog.refresh()
        async let referenceRefresh: Void = reference.refresh()
        async let progressRefresh: Void = progress.refresh(force: true)
        async let meRefresh: Void = account.refreshMe(force: true)
        async let adminRefresh: Void = AdminStore.shared.sync(userID: account.userID, force: true)
        _ = await (catalogRefresh, referenceRefresh, progressRefresh, meRefresh, adminRefresh)
        progress.catalogDidChange()
    }

    // MARK: Windows

    /// Registers a window's navigation. The first window to open takes over anything that
    /// was navigated before it existed (an App Intent or a link on a cold launch).
    func attach(_ navigation: WindowNavigation) {
        windows.removeAll { $0.value == nil }
        guard !windows.contains(where: { $0.value === navigation }) else { return }
        if windows.isEmpty, activeNavigation !== navigation {
            if !activeNavigation.isPristine { navigation.adopt(activeNavigation) }
            activeNavigation = navigation
        }
        windows.append(WeakNavigation(value: navigation))
    }

    /// Makes a window the one navigation acts on (it became the key window, or it received a
    /// link or a Handoff). Only for a navigation a `RootView` owns: that view calls it with its
    /// own, and menu commands with the focused window's, which `RootView` published. Never
    /// with `activeNavigation` itself: while no window is open that's the stand-in, and
    /// registering it as a window would stop the next window from taking it over.
    func activate(_ navigation: WindowNavigation) {
        attach(navigation)
        windows.removeAll { $0.value == nil || $0.value === navigation }
        windows.append(WeakNavigation(value: navigation))
        if activeNavigation !== navigation { activeNavigation = navigation }
    }

    /// A window closed. Navigation moves to the window used before it, or to a stand-in
    /// until the next window opens.
    func detach(_ navigation: WindowNavigation) {
        windows.removeAll { $0.value == nil || $0.value === navigation }
        guard activeNavigation === navigation else { return }
        activeNavigation = windows.last?.value ?? WindowNavigation()
    }

    /// True while at least one window is open (`activeNavigation` is a real window's, not
    /// the stand-in).
    var hasWindow: Bool {
        windows.contains { $0.value === activeNavigation }
    }

    /// Mac: shows the active window for navigation that started outside it (a link in the
    /// Settings window, a menu command while the Settings window is key, an App Intent): the
    /// window comes forward, or, with every main window closed, a new one opens and takes
    /// over the stand-in navigation. Elsewhere, and when the window is already in front, it
    /// does nothing.
    func revealActiveWindow() {
        #if os(macOS)
        if let window = activeNavigation.hostWindow, hasWindow {
            guard !(window.isMainWindow && NSApp.isActive) else { return }
            if window.isMiniaturized { window.deminiaturize(nil) }
            window.makeKeyAndOrderFront(nil)
            NSApp.activate()
            return
        }
        guard !hasWindow, let opener = mainWindowOpener else { return }
        // A moment's grace: on a launch or a Dock click the system may already be making the
        // first window, which takes the stand-in over itself.
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(150))
            guard let self, !self.hasWindow else { return }
            opener()
        }
        #endif
    }

    // MARK: Navigation (the active window)

    /// The active window's selected tab.
    var selectedTab: AppTab {
        get { activeNavigation.selectedTab }
        set { activeNavigation.selectedTab = newValue }
    }

    /// The active window's navigation path per tab.
    var paths: [AppTab: [AppRoute]] {
        get { activeNavigation.paths }
        set { activeNavigation.paths = newValue }
    }

    /// A two-way binding to one of the active window's tab paths.
    func path(for tab: AppTab) -> Binding<[AppRoute]> {
        activeNavigation.path(for: tab)
    }

    /// Pushes a route onto a tab of the active window (its selected tab by default).
    func push(_ route: AppRoute, in tab: AppTab? = nil) {
        activeNavigation.push(route, in: tab)
    }

    /// Switches the active window to the tab that owns a route and shows it on a clean stack
    /// (a tab's own root screen, like the leaderboard, just selects that tab). On the Mac the
    /// window comes forward when the call came from outside it (`revealActiveWindow()`).
    func open(_ route: AppRoute) {
        activeNavigation.open(route)
        revealActiveWindow()
    }

    func popToRoot(_ tab: AppTab? = nil) {
        activeNavigation.popToRoot(tab)
    }

    /// The lesson on top of the active window's selected stack, if one is showing.
    var visibleLessonID: UUID? { activeNavigation.visibleLessonID }

    /// Shows a lesson in the active window's selected tab, swapping out `current` when it's
    /// on top (stepping through lessons doesn't pile up a long back stack).
    func showLesson(_ id: UUID, replacing current: UUID?) {
        activeNavigation.showLesson(id, replacing: current)
    }

    /// Pops one screen off the active window's selected tab. False when already at the root.
    @discardableResult
    func goBack() -> Bool {
        activeNavigation.goBack()
    }

    /// The tab a route belongs to.
    static func tab(for route: AppRoute) -> AppTab {
        switch route {
        case .department, .module, .lesson, .article, .path, .videos, .certificate, .tools, .tool, .resources: .learn
        case .glossaryTerm: .search
        case .profile, .team, .leaderboard, .achievements: .community
        case .settings, .bookmarks, .admin, .adminFeedback, .adminTeam, .apply: .profile
        }
    }

    /// The tab whose root screen this route already is, if any. Opening it selects that tab
    /// at its root instead of pushing a second copy (Community's root is the leaderboard).
    static func rootTab(of route: AppRoute) -> AppTab? {
        switch route {
        case .leaderboard: .community
        default: nil
        }
    }

    /// Routes `learnfrc://` links and learnfrc.com links through `openDeepLink(_:)`.
    /// Returns false when the app has no screen for it, so the caller can open the browser.
    @discardableResult
    func handle(url: URL) -> Bool {
        openDeepLink(url)
    }

    /// Waits for the on-device cache and for the stored session to be read, so a link that
    /// depends on who's reading (the continue lesson) or on the catalog sees them. Instant
    /// once launch is done; never waits on the network, and gives up after a few seconds.
    func waitForAccountRestore() async {
        await loadCache()
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(3))
        while account.isLoading, clock.now < deadline {
            try? await Task.sleep(for: .milliseconds(50))
        }
    }
}

extension View {
    /// Injects the app model and every store into the environment.
    func appEnvironment(_ model: AppModel) -> some View {
        self
            .environment(model)
            .environment(model.catalog)
            .environment(model.reference)
            .environment(model.account)
            .environment(model.progress)
            .environment(model.connectivity)
            .environment(AdminStore.shared)
            .environment(\.adminNavigator, AdminNavigator { AppRoute($0) })
    }
}
