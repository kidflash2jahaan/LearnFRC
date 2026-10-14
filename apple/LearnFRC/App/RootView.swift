import SwiftUI

/// One window's navigation shell: a tab bar on iPhone and a sidebar on iPad
/// (`TabView(.sidebarAdaptable)`), a `NavigationSplitView` sidebar on the Mac (`macShell`),
/// one `NavigationStack` per tab, every `AppRoute` resolved by `AppRouteDestination`, the
/// username gate, the profile setup step and the sign-in sheet.
///
/// Each window owns its own `WindowNavigation` (selected tab and stacks), restored with
/// `@SceneStorage`, so two iPad windows or two Mac windows (⌘N) go their own ways. The window
/// tells `AppModel` when it becomes the one in use, so App Intents, links, Spotlight,
/// notification taps and menu commands navigate the window the person is in, and it asks for
/// those outside events itself (`handlesExternalEvents`), so they never open a new window.
/// Whatever `WindowNavigation` holds is what the window shows: a tab's stack is always
/// built from, and writes back to, that tab's path.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(AccountStore.self) private var account
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.appearsActive) private var appearsActive

    @State private var navigation = WindowNavigation()
    @State private var showAuth = false
    @State private var authStart: AuthFlowView.Screen = .signIn
    /// The profile setup step (pick your own username, or add a team number) is up
    /// (`setupStep`).
    @State private var showsSetupStep = false
    /// The window went somewhere from outside while that step was up (a link, a notification
    /// tap, Spotlight, an App Intent, a search): it waits until the next launch rather than
    /// coming straight back. That isn't a skip.
    @State private var setupStepDeferred = false
    /// The ask the step last showed, so the card stays drawn while the sheet slides away.
    @State private var shownSetupAsk: AccountStore.ProfileSetupAsk = .ownUsername
    #if os(iOS)
    /// The tab bar is showing as a sidebar (iPad landscape).
    @State private var showsSidebar = false
    #endif
    @SceneStorage("window.navigation") private var storedNavigation: Data?

    var body: some View {
        // The window's content: the tab view, or the username gate (`shell`).
        shell
            .sheet(isPresented: setupStepBinding) { setupStep }
            .authSheet(isPresented: $showAuth, start: authStart)
            // Anything that moves this window while the sign-in sheet or the setup step is up
            // (a link, Handoff, a notification tap, a Spotlight result, an App Intent, a menu
            // command, a search request) came from outside them, since the person can't move
            // the window behind a sheet: the sheet closes and the setup step steps aside, so
            // the screen it opens, or the search field it focuses, is the one in front. The
            // username gate isn't a sheet and stays up regardless (ARCHITECTURE 6.7).
            .closesOnNavigation($showAuth)
            .closesOnNavigation(setupStepAside)
            .environment(\.lessonAccountRequest, LessonAccountAction { request in
                presentAuth(request == .signUp ? .signUp : .signIn)
            })
            .environment(navigation)
            .focusedSceneValue(\.learnFRCNavigation, navigation)
            .systemServices(model, navigation: navigation)
            // Links and Handoff also step aside before they're followed, for the ones that
            // don't move the window: the screen already on show, a page that opens in the
            // browser, a link still waiting for the cache.
            .onOpenURL { url in
                model.activate(navigation)
                stepAside()
                SystemServices.open(url)
            }
            .onContinueUserActivity(NSUserActivity.lessonActivityType) { activity in
                model.activate(navigation)
                stepAside()
                model.handle(userActivity: activity)
            }
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                // learnfrc.com pages go through `SystemServices.open`, like any link: they wait
                // for the cached catalog, and pages the app has no screen for open in the browser.
                model.activate(navigation)
                stepAside()
                model.handle(userActivity: activity)
            }
            .task(id: wantedSetupAsk) { await settleSetupStep() }
            // Links, Handoff, Spotlight results and notification taps go to the window the
            // person is using (on the Mac, without this, each one opened a new window). Other
            // windows still accept them, so one always does; File > New Window is unaffected.
            .handlesExternalEvents(preferring: isActiveWindow ? ["*"] : [], allowing: ["*"])
            .onAppear(perform: windowAppeared)
            .onDisappear { model.detach(navigation) }
            .onChange(of: appearsActive) { _, active in
                if active { model.activate(navigation) }
            }
            #if os(iOS)
            .background {
                WindowSceneObserver(title: sceneTitle) { model.activate(navigation) }
                    .frame(width: 0, height: 0)
                    .accessibilityHidden(true)
            }
            #endif
            .onChange(of: navigation.selectedTab) { saveNavigation() }
            .onChange(of: navigation.paths) { saveNavigation() }
            .task {
                // The cached catalog first (instant, offline): links and lessons resolve as soon
                // as it's in memory. Then the search index and the network refresh, side by side.
                await model.loadCache()
                async let index: Void = SearchIndexStore.shared.prepare(catalog: model.catalog, reference: model.reference)
                async let refresh: Void = model.bootstrap()
                _ = await (index, refresh)
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { Task { await model.sceneBecameActive() } }
            }
    }

    /// iPhone and iPad: the system tab view, or the username gate in its place. Mac: its own
    /// sidebar, with the gate in the detail column (`macShell`).
    ///
    /// The gate replaces the tab view rather than covering it. Laid over it, with the tab view
    /// marked `accessibilityHidden` and even at no opacity, the tab bar, the sidebar and the
    /// screen underneath (all hosted by UIKit) stayed in the accessibility tree, so VoiceOver
    /// could still reach them. Each tab's place survives: it lives in `WindowNavigation`,
    /// which ignores the stacks popping themselves as they're taken down (`showsStacks`), and
    /// the stacks are built from it again once a handle is saved.
    @ViewBuilder private var shell: some View {
        #if os(macOS)
        macShell
        #else
        if isGated {
            UsernameGateScreen()
        } else {
            tabs
        }
        #endif
    }

    /// The account has no username: nothing else works until one is set (ARCHITECTURE 6.2).
    private var isGated: Bool { account.needsUsernameSetup }

    #if os(iOS)
    private var tabs: some View {
        @Bindable var navigation = navigation
        return TabView(selection: $navigation.selectedTab) {
            Tab(AppTab.home.title, systemImage: AppTab.home.systemImage, value: AppTab.home) {
                stack(.home)
            }
            Tab(AppTab.learn.title, systemImage: AppTab.learn.systemImage, value: AppTab.learn) {
                stack(.learn)
            }
            Tab(AppTab.community.title, systemImage: AppTab.community.systemImage, value: AppTab.community) {
                stack(.community)
            }
            Tab(AppTab.profile.title, systemImage: AppTab.profile.systemImage, value: AppTab.profile) {
                stack(.profile)
            }
            Tab(value: AppTab.search, role: .search) {
                stack(.search)
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        // The sidebar fills the selected row with the tint under a white label, so it uses a
        // blue that keeps that label readable in dark mode; the tab bar and every screen keep
        // the link blue.
        .tint(showsSidebar ? LF.Palette.sidebarTint : LF.Palette.blue)
    }
    #endif

    #if os(macOS)
    /// The Mac builds its sidebar from a `NavigationSplitView` rather than
    /// `TabView(.sidebarAdaptable)`. The Mac's tab view takes each tab's stack down when
    /// another tab is selected and then loses track of it: a screen opened in a tab that
    /// wasn't showing never appeared, coming back to a tab showed its root, and later pushes
    /// could land in another tab's stack, all while `WindowNavigation.paths` still held the
    /// screens. Here the detail column holds only the selected tab's stack, built fresh from
    /// that tab's path (`.id`) whenever the tab changes, so the window always shows the model.
    /// The stack being replaced pops itself on the way out; `WindowNavigation.path(for:)`
    /// ignores that write, so the tab keeps its place for next time.
    ///
    /// Keeping every visited tab's stack alive and hiding the others was tried and doesn't
    /// work on the Mac: a hidden stack still adds its toolbar items, its search field and its
    /// title to the window (Search's field showed over Home; the title named the hidden tab).
    /// So a screen that should come back as it was keeps that state in
    /// `WindowNavigation.memory` (ARCHITECTURE 6.6).
    ///
    /// For the same reason the username gate takes the detail column instead of the tab's
    /// stack, rather than covering it: the window's toolbar sits above anything drawn over the
    /// content, so a covered lesson's Save, Share and More buttons, or Search's field, stayed
    /// usable while "Nothing else on the account works until it is set." The sidebar is off
    /// meanwhile, and so are the Go and Lesson menus (`AppCommands`). It stays in view rather
    /// than being hidden: hiding it through `columnVisibility` was saved by AppKit with the
    /// window, so the next launch opened with the sidebar collapsed.
    private var macShell: some View {
        // While the gate is up the sidebar goes nowhere, by mouse or by VoiceOver.
        let selection = Binding<AppTab?>(
            get: { navigation.selectedTab },
            set: { if let tab = $0, tab != navigation.selectedTab, !isGated { navigation.selectedTab = tab } }
        )
        return NavigationSplitView {
            List(selection: selection) {
                ForEach(AppTab.visibleOrder + [AppTab.search]) { tab in
                    Label(tab.title, systemImage: tab.systemImage)
                        .tag(tab)
                }
            }
            .navigationSplitViewColumnWidth(min: 160, ideal: 200, max: 300)
            .disabled(isGated)
        } detail: {
            if isGated {
                UsernameGateScreen()
            } else {
                stack(navigation.selectedTab)
                    .id(navigation.selectedTab)
            }
        }
        .background {
            HostWindowReader { navigation.hostWindow = $0 }
                .frame(width: 0, height: 0)
                .accessibilityHidden(true)
        }
    }
    #endif

    /// One tab's stack: its root screen, with every `AppRoute` registered. Screens in it can
    /// tell which tab they're in (`\.navigationTab`), so one in a hidden tab or under a pushed
    /// screen knows it isn't the one on show (`WindowNavigation.isShowing(_:in:)`).
    private func stack(_ tab: AppTab) -> some View {
        @Bindable var navigation = navigation
        return NavigationStack(path: $navigation[stack: tab]) {
            tabRoot(tab)
                .appRouteDestinations(tab: tab)
        }
        .environment(\.navigationTab, tab)
        .tint(LF.Palette.blue)
        #if os(iOS)
        .modifier(TabBarPlacementReader { showsSidebar = $0 })
        #endif
    }

    @ViewBuilder private func tabRoot(_ tab: AppTab) -> some View {
        switch tab {
        case .home: HomeView(onSignIn: { presentAuth(.signIn) }, onCreateAccount: { presentAuth(.signUp) })
        case .learn: LearnView()
        case .community: LeaderboardView()
        case .profile: ProfileView()
        case .search: SearchView()
        }
    }

    #if os(iOS)
    /// What iPadOS calls this window in the Dock's window list and the app switcher: the
    /// screen it's showing (its tab, or the screen on top of the tab's stack), so two windows
    /// can be told apart. On the Mac the window title already follows the screen.
    private var sceneTitle: String {
        let tab = navigation.selectedTab
        guard let top = navigation.paths[tab]?.last else { return tab.title }
        return top.screenTitle(catalog: model.catalog, reference: model.reference) ?? tab.title
    }
    #endif

    /// This window is the one links and commands act on.
    private var isActiveWindow: Bool { model.activeNavigation === navigation }

    private func presentAuth(_ screen: AuthFlowView.Screen) {
        authStart = screen
        showAuth = true
    }

    // MARK: The profile setup step

    /// The site's skippable dashboard card (`getProfileSetupState`, ARCHITECTURE 6.2), as a
    /// sheet, so it never blocks the app the way the gate for a missing username does: an
    /// account carrying a machine-made handle like `cosmic_builder_77` is asked to pick its own,
    /// and one whose handle is its own but has no team number is asked to add it
    /// (`AccountStore.profileSetupAsk`, only once `/me` has been read in this run). Not while
    /// the sign-in sheet is up: it follows it.
    private var wantedSetupAsk: AccountStore.ProfileSetupAsk? {
        guard !showAuth, !setupStepDeferred else { return nil }
        return account.profileSetupAsk
    }

    /// Waits for the sign-in sheet to finish closing before the step slides up.
    private func settleSetupStep() async {
        guard wantedSetupAsk != nil else {
            if showsSetupStep { showsSetupStep = false }
            return
        }
        guard !showsSetupStep else { return }
        try? await Task.sleep(for: .milliseconds(650))
        guard !Task.isCancelled, let ask = wantedSetupAsk else { return }
        shownSetupAsk = ask
        showsSetupStep = true
    }

    /// Closing the sheet by hand (a swipe on iPhone and iPad) counts as "Skip for now".
    /// Saving closes it on its own, because the account no longer asks; outside navigation
    /// closes it without counting (`setupStepAside`).
    private var setupStepBinding: Binding<Bool> {
        Binding(
            get: { showsSetupStep && wantedSetupAsk != nil },
            set: { presented in
                guard !presented else { return }
                if showsSetupStep, wantedSetupAsk != nil { account.skipProfileSetup() }
                showsSetupStep = false
            }
        )
    }

    /// The step's presentation as `closesOnNavigation` sees it: closing it this way puts it
    /// aside until the next launch, which isn't a skip.
    private var setupStepAside: Binding<Bool> {
        Binding(
            get: { showsSetupStep },
            set: { presented in
                guard !presented, showsSetupStep else { return }
                setupStepDeferred = true
                showsSetupStep = false
            }
        )
    }

    private var setupStep: some View {
        let ask = wantedSetupAsk ?? shownSetupAsk
        return NavigationStack {
            // A new card when the ask changes: saving a new handle with no team number turns
            // it into the team ask in place, like the site's card after a save.
            setupCard(ask).id(ask)
        }
        .onChange(of: wantedSetupAsk) { _, new in
            if let new { shownSetupAsk = new }
        }
        .tint(LF.Palette.blue)
        #if os(macOS)
        .frame(minWidth: 560, idealWidth: 660, minHeight: 560, idealHeight: 720)
        #endif
    }

    /// The site's card in username mode (`.soft`) or team mode (`.team`).
    private func setupCard(_ ask: AccountStore.ProfileSetupAsk) -> some View {
        UsernameSetupView(mode: ask == .teamNumber ? .team : .soft, onSkip: { account.skipProfileSetup() })
    }

    /// A link or Handoff is about to be followed: close the sign-in sheet and set the setup
    /// step aside until the next launch, so the screen it opens is the one in front. Most
    /// outside navigation is caught by `closesOnNavigation` as the window moves; this covers
    /// the links that don't move it.
    private func stepAside() {
        if showAuth { showAuth = false }
        setupStepAside.wrappedValue = false
    }

    // MARK: Window bookkeeping

    /// Registers the window. The first window takes over anything an App Intent or link did
    /// before it existed; otherwise the window comes back where it was last time.
    private func windowAppeared() {
        // While the username gate has the window, the tab stacks are taken down; what they
        // write back on the way out isn't the person going back.
        navigation.showsStacks = { [account] in !account.needsUsernameSetup }
        model.attach(navigation)
        if navigation.isPristine, let storedNavigation {
            navigation.restore(from: storedNavigation)
        }
        if appearsActive || model.activeNavigation === navigation {
            model.activate(navigation)
        }
    }

    private func saveNavigation() {
        storedNavigation = navigation.restorationData
    }
}

/// Like the website's dashboard: an account without a username picks one before anything
/// else. On iPhone and iPad it takes the tab view's place; on the Mac it takes the detail
/// column (`RootView.macShell`), and the Settings window (`LearnFRCApp`).
struct UsernameGateScreen: View {
    var body: some View {
        NavigationStack { UsernameSetupView() }
            .tint(LF.Palette.blue)
            .paperBackground()
    }
}

#if os(macOS)
/// Hands back the `NSWindow` this view is in (and nil when it leaves), so `AppModel` can bring
/// the window forward for navigation that started outside it.
private struct HostWindowReader: NSViewRepresentable {
    let onWindow: @MainActor (NSWindow?) -> Void

    func makeNSView(context: Context) -> ReaderView {
        let view = ReaderView()
        view.onWindow = onWindow
        return view
    }

    func updateNSView(_ view: ReaderView, context: Context) {
        view.onWindow = onWindow
    }

    final class ReaderView: NSView {
        var onWindow: (@MainActor (NSWindow?) -> Void)?

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            onWindow?(window)
        }
    }
}
#endif

#if os(iOS)
/// Reports whether the tab bar is showing as a sidebar, from inside a tab (the only place
/// `tabBarPlacement` is set). The value only changes with the window's layout, never because
/// of what it's used for, so it can't feed back on itself.
private struct TabBarPlacementReader: ViewModifier {
    let onChange: (Bool) -> Void
    @Environment(\.tabBarPlacement) private var placement

    func body(content: Content) -> some View {
        content.onChange(of: placement, initial: true) { _, placement in
            onChange(placement == .sidebar)
        }
    }
}

/// Tells the window it became the key window (on iPad, the window the person last touched),
/// and names its scene. `appearsActive` covers the Mac and single-window cases; this catches
/// iPad windows side by side, which can all be in the foreground at once. The name only
/// applies on iPad, where the Dock and app switcher list each window by it.
private struct WindowSceneObserver: UIViewRepresentable {
    let title: String
    let onBecomeKey: @MainActor () -> Void

    func makeUIView(context: Context) -> ObserverView {
        let view = ObserverView()
        view.isUserInteractionEnabled = false
        view.onBecomeKey = onBecomeKey
        view.title = title
        return view
    }

    func updateUIView(_ view: ObserverView, context: Context) {
        view.onBecomeKey = onBecomeKey
        view.title = title
    }

    final class ObserverView: UIView {
        var onBecomeKey: (@MainActor () -> Void)?
        var title: String? {
            didSet { if title != oldValue { applyTitle() } }
        }
        private var observer: (any NSObjectProtocol)?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if let observer { NotificationCenter.default.removeObserver(observer) }
            observer = nil
            guard let window else { return }
            applyTitle()
            observer = NotificationCenter.default.addObserver(
                forName: UIWindow.didBecomeKeyNotification, object: window, queue: .main
            ) { [weak self] _ in
                MainActor.assumeIsolated { self?.onBecomeKey?() }
            }
            if window.isKeyWindow {
                // Not during the view update that's moving this view into the window.
                Task { @MainActor [weak self] in self?.onBecomeKey?() }
            }
        }

        private func applyTitle() {
            guard traitCollection.userInterfaceIdiom == .pad,
                  let scene = window?.windowScene, let title, scene.title != title else { return }
            scene.title = title
        }
    }
}
#endif

// MARK: - Previews

#Preview("Shell, iPhone") {
    RootView()
        .appEnvironment(.preview)
}

#Preview("Username gate, iPhone") {
    RootView()
        .appEnvironment(.preview(me: PreviewData.meNeedsUsername))
}

#Preview("Username step, placeholder handle, iPhone") {
    RootView()
        .appEnvironment(.preview(me: PreviewData.mePlaceholderUsername))
}

#Preview("Shell, iPad, Night", traits: .landscapeLeft) {
    RootView()
        .appEnvironment(.preview)
        .preferredColorScheme(.dark)
}
