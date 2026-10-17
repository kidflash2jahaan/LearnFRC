import SwiftUI
import Darwin

// The fold of a foldable iPhone, for layout.
//
// iPhone Duo's inner screen opens like a book. iOS 27.1 reports its crease as a reserved
// "division" region: a 40pt band (the crease plus 20pt of system margin on each side). Held
// upright and open, the band runs top to bottom at x 456 to 496 of the 867pt content area
// (the vertical bar takes the trailing 84pt); held sideways it runs side to side at window
// y 456 to 496 (y 322 to 362 of the 669 x 734 area under a navigation bar). It's there
// whether the hinge is bent or flat, and a view gets it in its own coordinates even while
// it's scrolled out of sight.
//
// - Lay pages out from `FoldInfo.band` whether or not it's active, so a page keeps its layout
//   as the hinge moves between flat and book and nothing reflows under the reader's thumb.
// - Use `isActive` (or `isBook` / `isLaptop`) only for what must physically stay off the
//   crease: a button, a centred card, the half of the screen a control lives in.
//
// Every other device (other iPhones, iPad, Mac, the Duo's cover screen, iOS before 27.1) has
// no band, so screens keep their usual layouts. The 27.1 APIs are behind
// `if #available(iOS 27.1, *)`, and behind `#if os(iOS)` while the macOS SDK is 27.0 (it has
// none of them, and a Mac never reports a fold).
//
// The pieces:
// - `FoldInfo`, a plain value: the band, its margins, whether it's bent, the hinge.
// - `\.fold`, the window's `FoldInfo`, set by `RootView` (`providesWindowFold()`), with the
//   band in global coordinates. Read it for posture; read `FoldReader` for layout.
// - `FoldReader`, a `GeometryReader` that also hands over the fold in its own coordinates.
// - `FoldSplit` (a view) and `FoldSplitLayout` (a `Layout`): two pages with the gap exactly
//   on the band, or the screen's usual layout when there's no fold.
// - Preview helpers: `.duoCover`, `.duoBook`, `.duoLaptop` traits and `.previewFold(_:)`.

// MARK: - FoldInfo

/// Where a foldable iPhone's crease runs through a view, and what the hinge is doing.
nonisolated struct FoldInfo: Equatable, Sendable {
    /// How far the device's hinge is open.
    enum Hinge: Equatable, Sendable {
        /// Folded shut: the app is on the cover screen.
        case closed
        /// Bent part way: book (held upright) or laptop (held sideways, one half flat on a table).
        /// The angle between the halves, to the nearest 5 degrees, so a hinge on the move updates
        /// the screens reading it a few dozen times rather than every frame.
        case partiallyOpen(degrees: Double)
        /// Open as far as it goes: flat.
        case fullyOpen
    }

    /// The fold's band in the reading view's coordinates: the crease plus the system's margin on
    /// each side (40pt in all on iPhone Duo). Keep content out of it. Nil when no fold crosses
    /// the view. In `\.fold` it's in global (window) coordinates.
    var band: CGRect?
    /// Which way the crease runs. `.vertical`: top to bottom, splitting the view into leading
    /// and trailing pages (the inner screen held upright, book). `.horizontal`: side to side,
    /// splitting it into top and bottom halves (held sideways, laptop). Nil with no band.
    var axis: Axis?
    /// The system's margin inside `band` on each side of the crease (20pt on iPhone Duo).
    var margins: EdgeInsets
    /// The fold is bent right now (book or laptop), so the crease is physically there. False
    /// when the screen is open flat, even though `band` still is.
    var isActive: Bool
    /// The device's hinge, or nil on a device without one (or before it has reported).
    var hinge: Hinge?
    /// Made up for a preview (`previewFold(_:)`): readers convert `band` from global
    /// coordinates rather than asking the system, which never reports a fold in a preview.
    var isSimulated: Bool

    init(band: CGRect? = nil, axis: Axis? = nil, margins: EdgeInsets = EdgeInsets(),
         isActive: Bool = false, hinge: Hinge? = nil, isSimulated: Bool = false) {
        self.band = band
        self.axis = band == nil ? nil : (axis ?? ((band?.height ?? 0) >= (band?.width ?? 0) ? .vertical : .horizontal))
        self.margins = margins
        self.isActive = band != nil && isActive
        self.hinge = hinge
        self.isSimulated = isSimulated
    }

    /// No fold and no hinge: every device but a foldable one.
    static let none = FoldInfo()

    // MARK: Shape

    /// A fold crosses this view.
    var hasFold: Bool { band != nil }
    /// The crease runs top to bottom: leading and trailing pages.
    var isVertical: Bool { axis == .vertical }
    /// The crease runs side to side: top and bottom halves.
    var isHorizontal: Bool { axis == .horizontal }

    /// The crease itself: `band` without its margins (a zero-width line on iPhone Duo).
    var crease: CGRect? {
        guard let band else { return nil }
        return CGRect(x: band.minX + margins.leading, y: band.minY + margins.top,
                      width: max(0, band.width - margins.leading - margins.trailing),
                      height: max(0, band.height - margins.top - margins.bottom))
    }

    /// Where the crease falls across the view: its x for a vertical fold, its y for a
    /// horizontal one.
    var creasePosition: CGFloat? {
        guard let crease else { return nil }
        return isVertical ? crease.midX : crease.midY
    }

    // MARK: Posture

    /// The hinge is folded shut: the app is on the cover screen.
    var isClosed: Bool { hinge == .closed }
    /// The hinge is bent part way, so the crease is physically there.
    var isBent: Bool {
        if isActive { return true }
        if case .partiallyOpen = hinge { return hasFold }
        return false
    }
    /// Book: held upright with the hinge bent, a page on each side of a vertical crease.
    var isBook: Bool { isVertical && isBent }
    /// Laptop: held sideways with the hinge bent, a horizontal crease between the halves.
    var isLaptop: Bool { isHorizontal && isBent }
    /// Open flat: a fold crosses the view, but the screen is flat.
    var isFlat: Bool { hasFold && !isBent }

    // MARK: Pages

    /// The page before the band in `bounds` (leading, or top for a horizontal fold), or nil
    /// with no fold or when the band doesn't cross `bounds`.
    func leadingPage(in bounds: CGRect) -> CGRect? {
        guard let band, crosses(bounds) else { return nil }
        var page = bounds
        if isVertical { page.size.width = band.minX - bounds.minX } else { page.size.height = band.minY - bounds.minY }
        return page
    }

    /// The page after the band in `bounds` (trailing, or bottom for a horizontal fold).
    func trailingPage(in bounds: CGRect) -> CGRect? {
        guard let band, crosses(bounds) else { return nil }
        var page = bounds
        if isVertical {
            page.origin.x = band.maxX
            page.size.width = bounds.maxX - band.maxX
        } else {
            page.origin.y = band.maxY
            page.size.height = bounds.maxY - band.maxY
        }
        return page
    }

    /// Two columns of a content area that runs from `contentMinX` to `contentMaxX` (in the
    /// same coordinates as `band`), split on a vertical fold: the leading column ends where the
    /// band starts, the gap is the band, the trailing column starts where the band ends. Nil
    /// with no vertical fold, or when either column would be narrower than `minimum`, so the
    /// screen keeps its usual columns.
    ///
    ///     FoldReader { proxy, fold in
    ///         let margins = proxy.lfPageMargins
    ///         let columns = fold.columns(from: margins.leading, to: proxy.size.width - margins.trailing)
    ///         // columns?.leading, columns?.gap, columns?.trailing
    ///     }
    func columns(from contentMinX: CGFloat, to contentMaxX: CGFloat,
                 minimum: CGFloat = FoldSplitLayout.defaultMinimumPage) -> FoldColumns? {
        guard isVertical, let band else { return nil }
        let leading = band.minX - contentMinX
        let trailing = contentMaxX - band.maxX
        guard leading >= minimum, trailing >= minimum else { return nil }
        return FoldColumns(leading: leading, gap: band.width, trailing: trailing)
    }

    /// The same fold seen from a coordinate space whose origin sits at `offset` in this one,
    /// such as a column that starts `offset.x` in from the page's edge.
    func relative(to offset: CGPoint) -> FoldInfo {
        var copy = self
        copy.band = band?.offsetBy(dx: -offset.x, dy: -offset.y)
        return copy
    }

    /// The band crosses `bounds` along the fold's cross axis (x for a vertical fold).
    func crosses(_ bounds: CGRect) -> Bool {
        guard let band else { return false }
        return isVertical
            ? band.maxX > bounds.minX && band.minX < bounds.maxX
            : band.maxY > bounds.minY && band.minY < bounds.maxY
    }

    /// This fold without a band (it doesn't cross the view), keeping the hinge.
    var withoutBand: FoldInfo { FoldInfo(hinge: hinge, isSimulated: isSimulated) }

    /// Only the band's position across the fold kept (its x range for a vertical fold), so a
    /// view scrolling along the crease doesn't see a new value on every frame.
    var acrossOnly: FoldInfo {
        guard let band else { return self }
        var copy = self
        copy.band = isVertical
            ? CGRect(x: band.minX, y: 0, width: band.width, height: 0)
            : CGRect(x: 0, y: band.minY, width: 0, height: band.height)
        copy.margins = isVertical
            ? EdgeInsets(top: 0, leading: margins.leading, bottom: 0, trailing: margins.trailing)
            : EdgeInsets(top: margins.top, leading: 0, bottom: margins.bottom, trailing: 0)
        return copy
    }
}

/// A content area split into two columns on a vertical fold (`FoldInfo.columns(from:to:)`).
nonisolated struct FoldColumns: Equatable, Sendable {
    /// The leading column's width: from the content's leading edge to the band.
    var leading: CGFloat
    /// The gap between the columns: the band (40pt on iPhone Duo).
    var gap: CGFloat
    /// The trailing column's width: from the band to the content's trailing edge.
    var trailing: CGFloat
}

// MARK: - Reading the fold

extension FoldInfo {
    /// The fold in `proxy`'s own coordinates, with the window's hinge.
    ///
    /// Asks the system for the division region that crosses the view (iOS 27.1); it reports
    /// one for a view scrolled out of sight too, so a layout doesn't change as it scrolls in.
    /// When it reports none, the window's band is converted into the view's coordinates
    /// instead, which gives a band only if it crosses the view. A simulated window fold
    /// (previews) is always converted.
    static func reading(_ proxy: GeometryProxy, window: FoldInfo) -> FoldInfo {
        if !window.isSimulated, let measured = systemRegion(in: proxy, global: false) {
            var fold = measured
            fold.hinge = window.hinge
            return fold
        }
        return window.converted(into: proxy)
    }

    /// The window's fold, read from the root view's proxy, with the band in global coordinates.
    static func windowReading(_ proxy: GeometryProxy) -> FoldInfo {
        systemRegion(in: proxy, global: true) ?? .none
    }

    /// A global-coordinate fold converted into `proxy`'s coordinates; no band when it doesn't
    /// cross the view.
    func converted(into proxy: GeometryProxy) -> FoldInfo {
        guard band != nil else { return self }
        let origin = proxy.frame(in: .global).origin
        let local = relative(to: origin)
        return local.crosses(CGRect(origin: .zero, size: proxy.size)) ? local : withoutBand
    }

    /// The system's division region for `proxy`, in its coordinates or global ones.
    private static func systemRegion(in proxy: GeometryProxy, global: Bool) -> FoldInfo? {
        #if os(iOS)
        if #available(iOS 27.1, *), DuoAPIs.areAvailable {
            // One hinge on iPhone Duo; should a device ever report more, the widest band wins.
            let regions = proxy.reservedRegions(kind: .division, options: .includeInactive)
            guard let region = regions.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else {
                return nil
            }
            var frame = region.frame
            if global {
                let origin = proxy.frame(in: .global).origin
                frame = frame.offsetBy(dx: origin.x, dy: origin.y)
            }
            return FoldInfo(band: frame, margins: region.margins, isActive: region.isActive)
        }
        #endif
        return nil
    }
}

extension EnvironmentValues {
    /// The window's fold and hinge, set by `RootView` for every screen and sheet in the window
    /// (`providesWindowFold()`). The band is in global coordinates: read it for posture
    /// (`isBook`, `isLaptop`, `isClosed`, `isActive`); for layout, read the fold in a view's
    /// own coordinates with `FoldReader` or `FoldSplit`.
    @Entry var fold: FoldInfo = .none
}

/// A `GeometryReader` that also hands over the fold in its own coordinates (`FoldInfo.band`
/// relative to `proxy`), with the window's hinge. Use it where a screen measures its width,
/// outside the scroll view, so the band and the page's size share one coordinate space.
///
///     FoldReader { proxy, fold in
///         ScrollView { Page(layout: PageLayout(width: proxy.size.width, fold: fold)) }
///     }
struct FoldReader<Content: View>: View {
    @ViewBuilder var content: (GeometryProxy, FoldInfo) -> Content
    @Environment(\.fold) private var window

    init(@ViewBuilder content: @escaping (GeometryProxy, FoldInfo) -> Content) {
        self.content = content
    }

    var body: some View {
        GeometryReader { proxy in
            content(proxy, FoldInfo.reading(proxy, window: window))
        }
    }
}

extension View {
    /// Reads this window's fold and hinge and hands them to everything inside as `\.fold`
    /// (global coordinates). `RootView` applies it once per window. A simulated fold already in
    /// the environment (a preview) passes straight through.
    func providesWindowFold() -> some View {
        modifier(WindowFoldProvider())
    }
}

private struct WindowFoldProvider: ViewModifier {
    @Environment(\.fold) private var outer
    @State private var region = FoldInfo.none
    @State private var hinge: FoldInfo.Hinge?

    func body(content: Content) -> some View {
        content
            .environment(\.fold, resolved)
            .onGeometryChange(for: FoldInfo.self) { proxy in
                FoldInfo.windowReading(proxy)
            } action: { region = $0 }
            .modifier(HingeReader(hinge: $hinge))
    }

    private var resolved: FoldInfo {
        if outer.isSimulated { return outer }
        var fold = region
        fold.hinge = hinge
        return fold
    }
}

/// Follows the device's hinge (iOS 27.1). Nothing to follow elsewhere.
private struct HingeReader: ViewModifier {
    @Binding var hinge: FoldInfo.Hinge?

    func body(content: Content) -> some View {
        #if os(iOS)
        if DuoAPIs.areAvailable, #available(iOS 27.1, *) {
            content.onHingeChange { _, context in
                hinge = context.hinge.map(FoldInfo.Hinge.init)
            }
        } else {
            content
        }
        #else
        content
        #endif
    }
}

#if os(iOS)
@available(iOS 27.1, *)
private extension FoldInfo.Hinge {
    nonisolated init(_ hinge: DeviceHinge) {
        switch hinge.status {
        case .closed: self = .closed
        case .fullyOpen: self = .fullyOpen
        default: self = .partiallyOpen(degrees: (hinge.angle.degrees / 5).rounded() * 5)
        }
    }
}
#endif

// MARK: - Splitting on the fold

/// Two children, one each side of the fold, with the gap exactly on the band: leading and
/// trailing pages on a vertical fold, top and bottom halves on a horizontal one. Anywhere
/// else (no fold, a fold along an axis that isn't in `axes`, or a page that would be narrower
/// than `minimumPage`) it lays the two out with `fallback`, the screen's usual layout.
///
/// `fold` must be in this layout's own coordinates, measured from its leading (top) edge:
/// `FoldSplit` measures that for you; if the layout sits `x` points in from a `FoldReader`,
/// pass `fold.relative(to: CGPoint(x: x, y: 0))`.
///
/// Side by side, each page gets its own width and the height of the taller one, top-aligned.
/// Top and bottom needs a fixed height (a screen that doesn't scroll); proposed an unbounded
/// height, as in a scroll view, it falls back.
struct FoldSplitLayout: Layout {
    /// The narrowest page worth splitting for, about 40 characters of body text.
    static let defaultMinimumPage: CGFloat = 300

    var fold: FoldInfo
    var axes: Axis.Set
    var minimumPage: CGFloat
    var fallback: AnyLayout

    /// - Parameters:
    ///   - fold: the fold in this layout's coordinates.
    ///   - axes: which splits to make. `.horizontal`, the default: side by side on a vertical
    ///     crease (book). `.vertical`: top and bottom on a horizontal crease (laptop).
    ///   - minimumPage: below this width (height) for either page, use `fallback`.
    ///   - fallback: the layout without a usable fold. Defaults to a leading-aligned stack.
    init(fold: FoldInfo,
         axes: Axis.Set = .horizontal,
         minimumPage: CGFloat = FoldSplitLayout.defaultMinimumPage,
         fallback: AnyLayout = AnyLayout(VStackLayout(alignment: .leading, spacing: 24))) {
        self.fold = fold
        self.axes = axes
        self.minimumPage = minimumPage
        self.fallback = fallback
    }

    private enum Pages {
        case sideBySide(leading: CGFloat, trailingX: CGFloat, trailing: CGFloat)
        case stacked(top: CGFloat, bottomY: CGFloat, bottom: CGFloat)
    }

    private func pages(width: CGFloat?, height: CGFloat?, count: Int) -> Pages? {
        guard count == 2, let band = fold.band, let width, width.isFinite else { return nil }
        if fold.isVertical {
            guard axes.contains(.horizontal) else { return nil }
            let leading = band.minX
            let trailing = width - band.maxX
            guard leading >= minimumPage, trailing >= minimumPage else { return nil }
            return .sideBySide(leading: leading, trailingX: band.maxX, trailing: trailing)
        }
        guard axes.contains(.vertical), let height, height.isFinite else { return nil }
        let top = band.minY
        let bottom = height - band.maxY
        guard top >= minimumPage, bottom >= minimumPage else { return nil }
        return .stacked(top: top, bottomY: band.maxY, bottom: bottom)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        switch pages(width: proposal.width, height: proposal.height, count: subviews.count) {
        case let .sideBySide(leading, _, trailing):
            let first = subviews[0].sizeThatFits(ProposedViewSize(width: leading, height: nil))
            let second = subviews[1].sizeThatFits(ProposedViewSize(width: trailing, height: nil))
            return CGSize(width: proposal.width ?? 0, height: max(first.height, second.height))
        case .stacked:
            return CGSize(width: proposal.width ?? 0, height: proposal.height ?? 0)
        case nil:
            var fallbackCache = fallback.makeCache(subviews: subviews)
            return fallback.sizeThatFits(proposal: proposal, subviews: subviews, cache: &fallbackCache)
        }
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        switch pages(width: bounds.width, height: bounds.height, count: subviews.count) {
        case let .sideBySide(leading, trailingX, trailing):
            subviews[0].place(at: bounds.origin, anchor: .topLeading,
                              proposal: ProposedViewSize(width: leading, height: bounds.height))
            subviews[1].place(at: CGPoint(x: bounds.minX + trailingX, y: bounds.minY), anchor: .topLeading,
                              proposal: ProposedViewSize(width: trailing, height: bounds.height))
        case let .stacked(top, bottomY, bottom):
            subviews[0].place(at: bounds.origin, anchor: .topLeading,
                              proposal: ProposedViewSize(width: bounds.width, height: top))
            subviews[1].place(at: CGPoint(x: bounds.minX, y: bounds.minY + bottomY), anchor: .topLeading,
                              proposal: ProposedViewSize(width: bounds.width, height: bottom))
        case nil:
            var fallbackCache = fallback.makeCache(subviews: subviews)
            fallback.placeSubviews(in: bounds, proposal: proposal, subviews: subviews, cache: &fallbackCache)
        }
    }
}

/// `FoldSplitLayout` that measures where the fold crosses it, so it can sit anywhere: inside a
/// padded column, in a scroll view, in a sheet. The first view goes on the leading (top) page,
/// the second on the trailing (bottom) page.
///
///     FoldSplit(fallback: AnyLayout(HStackLayout(alignment: .top, spacing: 28))) {
///         AccountCard()
///     } trailing: {
///         RemindersCard()
///     }
///
/// For a vertical fold only the band's x matters, so it holds steady while a scroll view moves
/// it up and down. A top-and-bottom split (`axes: .vertical`) is for a screen that doesn't
/// scroll.
struct FoldSplit<Leading: View, Trailing: View>: View {
    var axes: Axis.Set
    var minimumPage: CGFloat
    var fallback: AnyLayout
    var leading: Leading
    var trailing: Trailing

    @Environment(\.fold) private var window
    @State private var local = FoldInfo.none

    init(axes: Axis.Set = .horizontal,
         minimumPage: CGFloat = FoldSplitLayout.defaultMinimumPage,
         fallback: AnyLayout = AnyLayout(VStackLayout(alignment: .leading, spacing: 24)),
         @ViewBuilder leading: () -> Leading,
         @ViewBuilder trailing: () -> Trailing) {
        self.axes = axes
        self.minimumPage = minimumPage
        self.fallback = fallback
        self.leading = leading()
        self.trailing = trailing()
    }

    var body: some View {
        FoldSplitLayout(fold: window.hasFold || window.isSimulated ? local : .none,
                        axes: axes, minimumPage: minimumPage, fallback: fallback) {
            leading
            trailing
        }
        .onGeometryChange(for: FoldInfo.self) { [window] proxy in
            // The layout needs the band alone, so the hinge moving doesn't lay it out again.
            var fold = FoldInfo.reading(proxy, window: window).acrossOnly
            fold.hinge = nil
            return fold
        } action: { local = $0 }
    }
}

// MARK: - The vertical bar

/// How a toolbar item treats iPhone Duo's vertical bar (`lfAxisBehavior(_:)`).
enum LFToolbarAxis: Sendable {
    /// The system decides: image items go either way, text and custom views stay horizontal.
    case automatic
    /// Never in the vertical bar. For text items, which the 84pt bar would squeeze.
    case horizontalOnly
    /// In the vertical bar when there is one. For icon buttons (save, share, more).
    case verticalPreferred
}

extension ToolbarContent {
    /// Where this item goes when iPhone Duo shows its vertical bar (iOS 27.1); nothing
    /// changes elsewhere, so it's safe on every platform.
    ///
    ///     ToolbarItem { ShareLink(item: url) }.lfAxisBehavior(.verticalPreferred)
    @ToolbarContentBuilder
    func lfAxisBehavior(_ behavior: LFToolbarAxis) -> some ToolbarContent {
        #if os(iOS)
        if DuoAPIs.areAvailable, #available(iOS 27.1, *) {
            axisBehavior(behavior.system)
        } else {
            self
        }
        #else
        self
        #endif
    }
}

#if os(iOS)
private extension LFToolbarAxis {
    @available(iOS 27.1, *)
    var system: ToolbarItemAxisBehavior {
        switch self {
        case .automatic: .automatic
        case .horizontalOnly: .horizontalOnly
        case .verticalPreferred: .verticalPreferred
        }
    }
}
#endif

extension EnvironmentValues {
    /// The side iPhone Duo's vertical bar is on (iOS 27.1: the cover screen, and the inner
    /// screen held upright), nil where the system uses the usual top and bottom bars. A screen
    /// can use it to change what the vertical bar breaks, such as a search field that has to
    /// stay in view: `.searchable(text:placement: edge == nil ? .automatic :
    /// .navigationBarDrawer(displayMode: .always), prompt:)`.
    var lfVerticalBarEdge: HorizontalEdge? {
        #if os(iOS)
        if #available(iOS 27.1, *), DuoAPIs.areAvailable {
            return toolbarVerticalEdge
        }
        #endif
        return nil
    }
}

// MARK: - Previews

#if DEBUG
/// iPhone Duo's sizes, for previews. "Content" is the area a screen gets inside the bars.
enum DuoPreview {
    /// Cover screen, portrait: 466 x 678 window, 382 x 562 content (the vertical bar takes 84pt).
    static let coverContent = CGSize(width: 382, height: 562)
    /// Cover screen, landscape: 594 x 350 content.
    static let coverLandscapeContent = CGSize(width: 594, height: 350)
    /// Inner screen held upright (open flat or book): 951 x 669 window, 867 x 553 content.
    static let innerContent = CGSize(width: 867, height: 553)
    /// Inner screen held sideways (flat or laptop): 669 x 951 window, 669 x 734 content.
    static let innerSidewaysContent = CGSize(width: 669, height: 734)
}

extension FoldInfo {
    /// Book posture, as iOS 27.1 reports it for the 867pt content area: the band at x 456 to
    /// 496, bent to 100 degrees.
    static let previewBook = FoldInfo(
        band: CGRect(x: 456, y: 0, width: 40, height: DuoPreview.innerContent.height), axis: .vertical,
        margins: EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20),
        isActive: true, hinge: .partiallyOpen(degrees: 100), isSimulated: true)
    /// The same, open flat.
    static let previewFlat = FoldInfo(
        band: CGRect(x: 456, y: 0, width: 40, height: DuoPreview.innerContent.height), axis: .vertical,
        margins: EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20),
        isActive: false, hinge: .fullyOpen, isSimulated: true)
    /// Laptop posture for the 669 x 734 content area: the band at y 322 to 362, bent.
    static let previewLaptop = FoldInfo(
        band: CGRect(x: 0, y: 322, width: DuoPreview.innerSidewaysContent.width, height: 40), axis: .horizontal,
        margins: EdgeInsets(top: 20, leading: 0, bottom: 20, trailing: 0),
        isActive: true, hinge: .partiallyOpen(degrees: 100), isSimulated: true)
    /// The cover screen: no band, hinge closed.
    static let previewClosed = FoldInfo(hinge: .closed, isSimulated: true)
}

extension View {
    /// Pretends this preview is on a foldable iPhone: `fold`'s band, in the preview canvas's
    /// coordinates, reaches every `FoldReader` and `FoldSplit` inside. Pair it with a Duo size:
    ///
    ///     #Preview("Book", traits: .duoBook) { HomeView().previewFold(.previewBook) }
    func previewFold(_ fold: FoldInfo) -> some View {
        environment(\.fold, fold)
    }
}

extension PreviewTrait where T == Preview.ViewTraits {
    /// The Duo's cover screen content area, portrait.
    static var duoCover: PreviewTrait<Preview.ViewTraits> {
        .fixedLayout(width: DuoPreview.coverContent.width, height: DuoPreview.coverContent.height)
    }
    /// The Duo's inner screen content area held upright (book, or flat). Use with `.previewBook`.
    static var duoBook: PreviewTrait<Preview.ViewTraits> {
        .fixedLayout(width: DuoPreview.innerContent.width, height: DuoPreview.innerContent.height)
    }
    /// The Duo's inner screen content area held sideways (laptop, or flat). Use with `.previewLaptop`.
    static var duoLaptop: PreviewTrait<Preview.ViewTraits> {
        .fixedLayout(width: DuoPreview.innerSidewaysContent.width, height: DuoPreview.innerSidewaysContent.height)
    }
}

private struct FoldPreviewPage: View {
    var body: some View {
        FoldReader { proxy, fold in
            let margins = proxy.lfPageMargins
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text(fold.isBook ? "book" : fold.isLaptop ? "laptop" : fold.isFlat ? "open flat" : "no fold")
                        .lfTitle(.h2)
                    FoldSplit {
                        NotebookCard { Text("The leading page. Everything on it stays clear of the crease.").lfProse() }
                    } trailing: {
                        NotebookCard(tilt: .right) { Text("The trailing page starts where the band ends.").lfProse() }
                    }
                }
                .padding(.leading, margins.leading)
                .padding(.trailing, margins.trailing)
                .padding(.vertical, 24)
            }
            .overlay(alignment: .topLeading) {
                if let band = fold.band {
                    Rectangle().fill(LF.Palette.blue.opacity(0.12))
                        .frame(width: band.width, height: band.height)
                        .offset(x: band.minX, y: band.minY)
                        .allowsHitTesting(false)
                }
            }
            .paperBackground()
        }
    }
}

#Preview("Fold, book", traits: .duoBook) {
    FoldPreviewPage().previewFold(.previewBook)
}

#Preview("Fold, cover", traits: .duoCover) {
    FoldPreviewPage().previewFold(.previewClosed)
}

#Preview("Fold, laptop", traits: .duoLaptop) {
    FoldPreviewPage().previewFold(.previewLaptop)
}
#endif

// MARK: - Is the Duo API really there?

/// Whether this device's iOS actually has the iPhone Duo APIs. iOS 27.1 is the Duo's own
/// release, and iOS 27.2 on other iPhones has a higher version number but not these APIs. So
/// `#available(iOS 27.1, *)` alone passes there, the first call jumps to a symbol that was
/// never loaded, and the app dies at launch (an iPhone 17 Pro Max on iOS 27.2 did exactly
/// that). Every 27.1 call checks this as well, and it checks the very symbols the app calls.
enum DuoAPIs {
    static let areAvailable: Bool = {
        #if os(iOS)
        guard #available(iOS 27.1, *) else { return false }
        // RTLD_DEFAULT: search every image the process has loaded.
        let everywhere = UnsafeMutableRawPointer(bitPattern: -2)
        let symbols = [
            "$s7SwiftUI13GeometryProxyV15reservedRegions4kind7options23layoutDirectionBehaviorSayAA14ReservedRegionVGAI4KindV_AI12QueryOptionsVAA06LayoutjK0OtF",
            "$s7SwiftUI13GeometryProxyVAAE14contentMargins3for5edgesAA10EdgeInsetsVAA18ContentMarginGuideV_AA0I0O3SetVtF",
            "$s7SwiftUI14ToolbarContentPAAE12axisBehavioryQrAA0c8ItemAxisF0VF",
            "$s7SwiftUI17EnvironmentValuesVAAE19toolbarVerticalEdgeAA010HorizontalG0OSgvg",
            "$s7SwiftUI4ViewPAAE13onHingeChange9isEnabled_QrSb_yAA06DeviceE7ContextV_AGtctF",
            "$s7SwiftUI4ViewPAAE34toolbarVerticalCompressionBehavioryQrAA07ToolbarefG0VF",
        ]
        return symbols.allSatisfy { dlsym(everywhere, $0) != nil }
        #else
        return false
        #endif
    }()
}
