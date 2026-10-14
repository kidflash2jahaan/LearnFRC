import SwiftUI
#if os(iOS)
import UIKit
#endif

// MARK: - Which screen this is

/// Which screen a page is, for what it does for its window besides drawing itself: what it
/// leaves in the window's `ScreenMemory` for when it's built again (the Mac rebuilds a tab's
/// stack on every tab switch, ARCHITECTURE 6.6), and whether it may speak for the window
/// (Handoff, 6.8). Shared by the Account, Community, Home and Learn screens.
///
///     LearnScrollPage(title: "Videos", place: .route(.videos)) { ... }
///     .screenHandoff(.route(.bookmarks), url: link, title: "Bookmarks")
///
/// Everything kept is per tab (`key(_:in:)`), so a copy of the same screen in another tab
/// keeps its own, and it's forgotten once the screen is gone back from (`isHeld`), so the next
/// visit starts fresh, as it always did.
enum ScreenPlace: Hashable, Sendable {
    /// A tab's own first screen (Home, Guides, You): always in its tab.
    case root
    /// The screen for a route. The leaderboard is a route and also Community's first screen
    /// (`AppModel.rootTab(of:)`).
    case route(AppRoute)

    /// The `ScreenMemory` key for `thing` ("scroll", "leaderboard.board") on this screen in
    /// `tab`.
    func key(_ thing: String, in tab: AppTab) -> String {
        switch self {
        case .root: "\(thing)/\(tab.rawValue)/root"
        case .route(let route): "\(thing)/\(tab.rawValue)/\(route)"
        }
    }

    /// True while this is the screen on show in its window: its tab is selected and nothing
    /// is pushed over it. iPhone and iPad keep hidden tabs and covered screens alive, so this
    /// is what a screen checks before it speaks for the window (`WindowNavigation.isShowing`).
    @MainActor
    func isOnShow(navigation: WindowNavigation, tab: AppTab) -> Bool {
        let stack = navigation.paths[tab] ?? []
        switch self {
        case .root:
            return navigation.selectedTab == tab && stack.isEmpty
        case .route(let route):
            if navigation.isShowing(route, in: tab) { return true }
            return navigation.selectedTab == tab && stack.isEmpty && AppModel.rootTab(of: route) == tab
        }
    }

    /// True while the screen is still in `tab`, shown or not. A tab's first screen always is.
    @MainActor
    func isHeld(navigation: WindowNavigation, tab: AppTab) -> Bool {
        switch self {
        case .root: true
        case .route(let route): navigation.holds(route, in: tab) || AppModel.rootTab(of: route) == tab
        }
    }

    /// True when `tab` holds this screen more than once (a department opened again from
    /// deeper in its own stack). The copies would share one key, so neither keeps a place.
    @MainActor
    func isRepeated(navigation: WindowNavigation, tab: AppTab) -> Bool {
        guard case .route(let route) = self else { return false }
        let pushed = (navigation.paths[tab] ?? []).count { $0 == route }
        return pushed + (AppModel.rootTab(of: route) == tab ? 1 : 0) > 1
    }
}

/// One screen's corner of its window's `ScreenMemory`, in the tab it sits in. Nil outside a
/// window (previews, the Mac's Settings window), where nothing is kept.
///
/// `tab` is the screen's `\.navigationTab`. A screen pushed on the Mac doesn't see it (the
/// detail column's destinations don't carry the stack's environment), so a nil tab falls back
/// to the selected tab: on the Mac only the selected tab's stack is built. That holds while
/// the screen is on show; a screen that also reads or forgets as it disappears (after another
/// tab was selected) should settle its tab when it appears and pass that instead.
@MainActor
struct ScreenPlaceMemory {
    let navigation: WindowNavigation
    let tab: AppTab
    let place: ScreenPlace

    init?(_ place: ScreenPlace, navigation: WindowNavigation?, tab: AppTab?) {
        guard let navigation else { return nil }
        self.navigation = navigation
        self.tab = tab ?? navigation.selectedTab
        self.place = place
    }

    func value<Value: Sendable>(_ type: Value.Type = Value.self, for thing: String) -> Value? {
        navigation.memory.value(type, for: place.key(thing, in: tab))
    }

    func set<Value: Sendable>(_ value: Value?, for thing: String) {
        navigation.memory.set(value, for: place.key(thing, in: tab))
    }

    /// Gone back from (no longer in its tab): forgets `things`, so the next visit starts fresh.
    /// Kept while the screen is still in the stack, for the Mac's rebuilt tab.
    func forgetIfLeft(_ things: String...) {
        guard !place.isHeld(navigation: navigation, tab: tab) else { return }
        for thing in things {
            navigation.memory.set(Bool?.none, for: place.key(thing, in: tab))
        }
    }
}

// MARK: - Handoff

extension View {
    /// Offers the matching learnfrc.com page to Handoff while this screen is the one on show
    /// in its window (`ScreenPlace.isOnShow`), never from a hidden tab or from under a pushed
    /// screen: nothing speaks for the window unless it's in front (ARCHITECTURE 6.6, 6.8).
    func screenHandoff(_ place: ScreenPlace, url: URL?, title: String? = nil, when isAvailable: Bool = true) -> some View {
        modifier(ScreenHandoff(place: place, url: url, title: title, isAvailable: isAvailable))
    }
}

/// Its own modifier, so only this re-reads when the window's tabs and paths change, never the
/// screen's body.
private struct ScreenHandoff: ViewModifier {
    let place: ScreenPlace
    let url: URL?
    let title: String?
    let isAvailable: Bool

    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab

    private var isOnShow: Bool {
        // Previews and screens outside a window's tabs have nobody to hide from.
        guard let navigation else { return true }
        return place.isOnShow(navigation: navigation, tab: tab ?? navigation.selectedTab)
    }

    func body(content: Content) -> some View {
        content.userActivity(NSUserActivityTypeBrowsingWeb, isActive: isAvailable && url != nil && isOnShow) { activity in
            activity.webpageURL = url
            if let title { activity.title = title }
            activity.isEligibleForHandoff = true
        }
    }
}

// MARK: - Scroll position

extension View {
    /// Keeps this scroll view's position in the window's memory while its screen is in its
    /// tab's stack, and goes back there once, without animation, when the screen is built
    /// again (the Mac rebuilds a tab's stack on every tab switch, ARCHITECTURE 6.6). Apply it
    /// to the `ScrollView` itself. Nothing kept feeds layout: the position is written as the
    /// person scrolls and read once, when the page is built. A nil place keeps nothing.
    func remembersScroll(_ place: ScreenPlace?) -> some View {
        modifier(RemembersScroll(place: place))
    }
}

private struct RemembersScroll: ViewModifier {
    let place: ScreenPlace?

    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab
    @State private var position = ScrollPosition()
    /// Bookkeeping that never draws anything, so it isn't observed.
    @State private var progress = Progress()

    @MainActor
    final class Progress {
        /// The page has had its one chance to go back to where it was.
        var handled = false
        /// It's on its way there: what it reports meanwhile isn't where the person left it.
        var isPending = false
        /// How far the page can scroll, from its last report.
        var maxOffset: CGFloat = 0
        /// Where the position is kept, settled when the page first appears.
        var memory: ScreenPlaceMemory?
    }

    struct Reading: Equatable {
        /// How far the page is scrolled, from its resting place at the top.
        var y: CGFloat
        var maxOffset: CGFloat

        init(_ geometry: ScrollGeometry) {
            y = (geometry.contentOffset.y + geometry.contentInsets.top).rounded()
            let scrollable = geometry.contentSize.height + geometry.contentInsets.top + geometry.contentInsets.bottom
            maxOffset = max(0, scrollable - geometry.containerSize.height).rounded()
        }
    }

    private static let thing = "scroll"

    func body(content: Content) -> some View {
        if let place, let navigation {
            content
                .scrollPosition($position)
                .onScrollGeometryChange(for: Reading.self) { Reading($0) } action: { _, new in
                    progress.maxOffset = new.maxOffset
                    guard progress.handled, !progress.isPending, let memory = progress.memory,
                          !place.isRepeated(navigation: navigation, tab: memory.tab) else { return }
                    memory.set(new.y, for: Self.thing)
                }
                .task { await resume(place, navigation: navigation) }
                .onDisappear { progress.memory?.forgetIfLeft(Self.thing) }
        } else {
            content
        }
    }

    /// A page built again while its screen was still in the stack goes back to where it was
    /// left, once. It gives the page up to about a second to grow tall enough (a board or a
    /// catalogue still filling in), then goes as far as it can.
    private func resume(_ place: ScreenPlace, navigation: WindowNavigation) async {
        guard !progress.handled else { return }
        progress.handled = true
        // The tab is settled now, as the page appears, never later: on the Mac a screen pushed
        // in the detail column doesn't see its stack's `\.navigationTab`, and by the time it
        // disappears another tab is already selected. On the Mac only the selected tab's stack
        // is built, so the tab on show as it appears is the one it's in.
        guard let memory = ScreenPlaceMemory(place, navigation: navigation, tab: tab) else { return }
        progress.memory = memory
        guard !place.isRepeated(navigation: navigation, tab: memory.tab),
              let target = memory.value(CGFloat.self, for: Self.thing), target > 1 else { return }
        progress.isPending = true
        defer { progress.isPending = false }
        var waited = 0
        repeat {
            try? await Task.sleep(for: .milliseconds(50))
            guard !Task.isCancelled else { return }
            waited += 1
        } while progress.maxOffset < target - 1 && waited < 20
        var jump = Transaction()
        jump.disablesAnimations = true
        withTransaction(jump) { position.scrollTo(y: min(target, progress.maxOffset)) }
    }
}

// MARK: - Share sheets

extension View {
    /// Closes a share sheet (`ShareLink`) this screen put up as soon as its window navigates
    /// anywhere, like `closesOnNavigation` does for the screen's own sheets: a link, a search
    /// request or a notification tap shouldn't leave it floating over a screen it doesn't
    /// belong to. iPhone and iPad only; the Mac's share menu closes itself before anything
    /// else can happen.
    func closesShareSheetsOnNavigation() -> some View {
        #if os(iOS)
        modifier(ClosesShareSheets())
        #else
        self
        #endif
    }
}

#if os(iOS)
private struct ClosesShareSheets: ViewModifier {
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @State private var probe = WindowProbe()

    func body(content: Content) -> some View {
        if let navigation {
            content
                .background {
                    WindowProbeView(probe: probe)
                        .frame(width: 0, height: 0)
                        .accessibilityHidden(true)
                }
                .onChange(of: NavigationFingerprint(navigation)) { probe.closeShareSheets() }
        } else {
            content
        }
    }
}

/// Remembers the window a screen was last in, to close a share sheet presented over it. The
/// last one, not the current one: by the time the change arrives, a tab switch has already
/// taken the screen's views out of the window.
@MainActor
private final class WindowProbe {
    weak var window: UIWindow?

    func closeShareSheets() {
        guard var controller = window?.rootViewController else { return }
        while let presented = controller.presentedViewController {
            if presented is UIActivityViewController {
                // Every screen alive in the window hears the same change; the first one closes it.
                if !presented.isBeingDismissed {
                    presented.presentingViewController?.dismiss(animated: true)
                }
                return
            }
            controller = presented
        }
    }
}

private struct WindowProbeView: UIViewRepresentable {
    let probe: WindowProbe

    func makeUIView(context: Context) -> ProbeView {
        let view = ProbeView()
        view.isUserInteractionEnabled = false
        view.probe = probe
        return view
    }

    func updateUIView(_ view: ProbeView, context: Context) {
        view.probe = probe
    }

    final class ProbeView: UIView {
        weak var probe: WindowProbe? {
            didSet { if let window { probe?.window = window } }
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            // Kept when the view leaves the window (a hidden tab): that's when it's needed.
            if let window { probe?.window = window }
        }
    }
}
#endif
