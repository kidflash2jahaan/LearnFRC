import SwiftUI

// Shared pieces for the Learn screens: the page scaffold (paper, width-aware gutter,
// the inline title that fades in once the h1 scrolls away), the carbon-copy log row,
// figure cells, the resume bar and the "next unlock" card. Everything here is prefixed
// `Learn` so it can't collide with another feature's helpers in the same module.

// MARK: - Layout

/// How wide the page is, measured once at the top of each Learn screen, so sections
/// can switch between the phone layout and the wider iPad and Mac ones by real width
/// (a split-view iPad or a narrow Mac window counts as narrow).
///
/// On iPhone Duo it also knows the page's margins (asymmetric next to the vertical bar) and
/// where the fold crosses the page. Open upright (book, or flat) the inner screen is two
/// pages either side of a crease: `pages` gives their widths, every `learnColumn` keeps to
/// the leading page, and a section that uses both pages spreads itself on purpose
/// (`learnColumn(_:spread:)`, `LearnSpread`, `LearnFoldColumns`), so nothing sits on the crease.
struct LearnLayout: Equatable, Sendable {
    /// Where on the screen this layout's content sits.
    enum Role: Equatable, Sendable {
        /// The whole screen: the usual single scroll view.
        case page
        /// The leading page of a screen split on iPhone Duo's fold (`LearnScrollPage`'s
        /// companion takes the trailing one). Each page scrolls on its own.
        case leadingPage
        /// The trailing page of a split screen: the companion.
        case trailingPage
        /// The top half of a screen held sideways and bent like a laptop (the half that
        /// stands up): a calculator's readout, or an article's text.
        case topHalf
        /// The bottom half of a laptop-posture screen (the half on the table): a calculator's
        /// inputs, or an article's sections and links.
        case bottomHalf

        /// One half of a laptop-posture screen.
        var isHalf: Bool { self == .topHalf || self == .bottomHalf }
    }

    var width: CGFloat
    /// The page's leading and trailing margins (`LF.Metrics.pageMargins(for:container:)`).
    var margins: LF.PageMargins
    /// The fold in the page's own coordinates: only where it crosses the page, without the
    /// hinge, so the page lays out the same from flat to book. `.none` almost everywhere.
    var fold: FoldInfo
    var role: Role

    init(width: CGFloat, margins: LF.PageMargins? = nil, fold: FoldInfo = .none, role: Role = .page) {
        self.width = width
        self.margins = margins ?? LF.Metrics.pageMargins(for: width)
        var across = fold.acrossOnly
        across.hinge = nil
        across.isActive = false
        self.fold = across
        self.role = role
    }

    /// The site's `--gut`, clamped between 16 and 54.
    var gutter: CGFloat { LF.Metrics.gutter(for: width) }

    /// The column the content actually gets (`nb-wrap` stops at 1280).
    var contentWidth: CGFloat { max(0, min(width - margins.total, LF.Metrics.maxContentWidth)) }

    /// Rows go three-column, figures go four-up, cards go two-up.
    var isRegular: Bool { contentWidth >= 700 }

    /// Margin notes move beside the main column.
    var isWide: Bool { contentWidth >= 960 }

    /// The site's twelve-column department wall.
    var isWall: Bool { contentWidth >= 1000 }

    /// The two pages of iPhone Duo's inner screen held upright, measured across the content
    /// column: the leading page ends where the fold's band starts, the gap is the band (the
    /// crease and its system margins), the trailing page starts where it ends. Nil on every
    /// other screen, on the Duo held sideways, and in one pane of a split screen.
    var pages: FoldColumns? {
        guard role == .page, width - margins.total <= LF.Metrics.maxContentWidth else { return nil }
        return fold.columns(from: margins.leading, to: width - margins.trailing)
    }

    /// The layout for the content of one page of `pages` (a column `width` wide, no margins
    /// of its own), so the sections inside it choose their phone or regular forms by its width.
    static func page(_ width: CGFloat) -> LearnLayout {
        LearnLayout(width: width, margins: LF.PageMargins(leading: 0, trailing: 0))
    }

    /// The layout a section gets inside `learnColumn(self)`: the leading page while the
    /// screen is two pages (that's all the room a section that doesn't spread has), else this
    /// layout. Build a section with it and pad it with the page's own layout:
    ///
    ///     masthead(layout.column).learnColumn(layout)
    var column: LearnLayout {
        guard let pages else { return self }
        return .page(pages.leading)
    }

    /// The layouts for the two pages, when there are two.
    var leadingPage: LearnLayout? { pages.map { .page($0.leading) } }
    var trailingPage: LearnLayout? { pages.map { .page($0.trailing) } }

    /// Lines a full-bleed band's text up with the page margins (`SlabView` already pads by
    /// the card padding).
    var bandInsets: EdgeInsets {
        EdgeInsets(top: 0, leading: max(0, margins.leading - LF.Metrics.cardPadding),
                   bottom: 0, trailing: max(0, margins.trailing - LF.Metrics.cardPadding))
    }
}

extension View {
    /// One section of a Learn page: capped at `nb-wrap`'s 1280, padded by the page margins,
    /// centred in wide windows.
    ///
    /// On iPhone Duo's two pages it keeps to the leading page unless `spread` says the section
    /// lays itself out across both (with `LearnLayout.pages`), so nothing lands on the crease.
    func learnColumn(_ layout: LearnLayout, maxWidth: CGFloat = LF.Metrics.maxContentWidth, spread: Bool = false) -> some View {
        let pages = layout.pages
        let cap = pages.map { spread ? maxWidth : min(maxWidth, $0.leading) } ?? maxWidth
        return self
            .frame(maxWidth: cap, alignment: .leading)
            .padding(.leading, layout.margins.leading)
            .padding(.trailing, layout.margins.trailing)
            .frame(maxWidth: .infinity, alignment: pages == nil ? .center : .leading)
    }

    /// A full-width blue band (`SlabView`) kept to the page's own column. The band's fill
    /// is a background, and backgrounds reach into the safe area, which on iPad and Mac
    /// put it under the glass sidebar as a blurred glow with a hard top and bottom.
    /// Clipped, the band runs edge to edge of the page and stops at the sidebar.
    func learnBand() -> some View {
        clipped()
    }

    /// Caps running text at about `characters` characters a line (the site's `ch`
    /// measures), growing with Dynamic Type so a larger size keeps the same measure.
    func learnMeasure(_ characters: CGFloat = 46) -> some View {
        modifier(LearnMeasure(characters: characters))
    }
}

private struct LearnMeasure: ViewModifier {
    let characters: CGFloat
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        // Bricolage at 17pt runs about 9pt a character.
        content.frame(maxWidth: characters * 9.2 * scale, alignment: .leading)
    }
}

// MARK: - Two pages

/// One section spread across iPhone Duo's two pages: the first view on the leading page,
/// the second on the trailing page, the band between them empty. Use it inside a
/// `learnColumn(layout, spread: true)`, with `layout.pages`.
struct LearnSpread<Leading: View, Trailing: View>: View {
    let pages: FoldColumns
    var alignment: VerticalAlignment = .top
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: alignment, spacing: pages.gap) {
            leading.frame(width: pages.leading, alignment: .topLeading)
            trailing.frame(width: pages.trailing, alignment: .topLeading)
        }
    }
}

/// A section's opening ink rule on iPhone Duo's two pages: one rule on each page, broken
/// at the band.
struct LearnSpreadRule: View {
    let pages: FoldColumns

    var body: some View {
        HStack(spacing: pages.gap) {
            InkRule().frame(width: pages.leading)
            InkRule().frame(width: pages.trailing)
        }
        .accessibilityHidden(true)
    }
}

/// Items in two columns that line up with iPhone Duo's pages, the band between them empty.
/// `.rows` fills them like a grid (first on the left, second on the right, rows as tall as
/// their taller item); `.balanced` puts each item at the foot of whichever column is shorter,
/// so the two pages end close together. Each item is offered its own page's width.
struct LearnFoldColumns: Layout {
    enum Fill: Sendable {
        case rows
        case balanced
    }

    var pages: FoldColumns
    var fill: Fill = .rows
    var spacing: CGFloat = 24

    private struct Placement {
        let index: Int
        let origin: CGPoint
        let size: CGSize
    }

    private func arrange(_ subviews: Subviews) -> (placements: [Placement], height: CGFloat) {
        let widths = [pages.leading, pages.trailing]
        let xs = [0, pages.leading + pages.gap]
        var placements: [Placement] = []
        switch fill {
        case .rows:
            var y: CGFloat = 0
            var index = 0
            var rows = 0
            while index < subviews.count {
                let pair = Array(index..<min(index + 2, subviews.count))
                let sizes = pair.enumerated().map { column, item in
                    subviews[item].sizeThatFits(ProposedViewSize(width: widths[column], height: nil))
                }
                let height = sizes.map(\.height).max() ?? 0
                if height > 0 {
                    if rows > 0 { y += spacing }
                    for (column, item) in pair.enumerated() {
                        placements.append(Placement(index: item, origin: CGPoint(x: xs[column], y: y),
                                                    size: CGSize(width: widths[column], height: sizes[column].height)))
                    }
                    y += height
                    rows += 1
                }
                index += 2
            }
            return (placements, y)
        case .balanced:
            var heights: [CGFloat] = [0, 0]
            var counts = [0, 0]
            for index in subviews.indices {
                let column = heights[0] <= heights[1] ? 0 : 1
                let height = subviews[index].sizeThatFits(ProposedViewSize(width: widths[column], height: nil)).height
                guard height > 0 else { continue }
                let y = heights[column] + (counts[column] > 0 ? spacing : 0)
                placements.append(Placement(index: index, origin: CGPoint(x: xs[column], y: y),
                                            size: CGSize(width: widths[column], height: height)))
                heights[column] = y + height
                counts[column] += 1
            }
            return (placements, max(heights[0], heights[1]))
        }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        CGSize(width: pages.leading + pages.gap + pages.trailing, height: arrange(subviews).height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let placed = arrange(subviews)
        var shown = Set<Int>()
        for placement in placed.placements {
            shown.insert(placement.index)
            subviews[placement.index].place(
                at: CGPoint(x: bounds.minX + placement.origin.x, y: bounds.minY + placement.origin.y),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: placement.size.width, height: nil)
            )
        }
        for index in subviews.indices where !shown.contains(index) {
            subviews[index].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
        }
    }
}

// MARK: - Page scaffold

/// A Learn screen: paper ground that scrolls with the content, the width in hand for
/// every section, a `ScrollViewProxy` for in-page jumps, pull to refresh, and on iPhone
/// and iPad an inline title that only appears once the page's own h1 has scrolled off.
///
/// These are reading pages, so the keyboard doesn't inset them unless the page asks
/// (`avoidsKeyboard`, for a page with a search field): on iPad a keyboard inset once
/// outlived the sign-in sheet and left a blank band under the last card.
///
/// A screen can hand over a companion: what belongs beside the page rather than in it (an
/// article's index, a calculator's readout, the chosen module's lessons). On iPhone Duo's
/// inner screen held upright the content takes the leading page and the companion the
/// trailing one, each scrolling on its own (`companionAxes` `.horizontal`); bent like a laptop
/// the companion takes one half and the content the other (`.vertical`, with
/// `laptopCompanionEdge`: a calculator's readout on the standing half above its inputs, an
/// article's sections on the flat half below its text). Everywhere else the companion isn't
/// drawn and the content shows everything, so the screen checks `layout.role` to leave out
/// what the companion is showing. Pass no axes when there's nothing for a companion to show.
struct LearnScrollPage<Content: View, Companion: View>: View {
    let title: String
    var refresh: (@MainActor () async -> Void)?
    var avoidsKeyboard: Bool
    /// Which screen this is, so its scroll position comes back when the Mac builds the tab
    /// again (`remembersScroll`). Nil keeps nothing.
    var place: ScreenPlace?
    /// The splits the companion takes (see the type's notes). Empty: no companion.
    var companionAxes: Axis.Set
    /// Which half the companion takes in laptop posture.
    var laptopCompanionEdge: VerticalEdge
    @ViewBuilder let content: (LearnLayout, ScrollViewProxy) -> Content
    @ViewBuilder let companion: (LearnLayout) -> Companion

    @State private var pastHeader = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.fold) private var windowFold

    init(
        title: String,
        refresh: (@MainActor () async -> Void)? = nil,
        avoidsKeyboard: Bool = false,
        place: ScreenPlace? = nil,
        @ViewBuilder content: @escaping (LearnLayout, ScrollViewProxy) -> Content
    ) where Companion == EmptyView {
        self.title = title
        self.refresh = refresh
        self.avoidsKeyboard = avoidsKeyboard
        self.place = place
        self.companionAxes = []
        self.laptopCompanionEdge = .top
        self.content = content
        self.companion = { _ in EmptyView() }
    }

    init(
        title: String,
        refresh: (@MainActor () async -> Void)? = nil,
        avoidsKeyboard: Bool = false,
        place: ScreenPlace? = nil,
        companionAxes: Axis.Set = .horizontal,
        laptopCompanionEdge: VerticalEdge = .top,
        @ViewBuilder content: @escaping (LearnLayout, ScrollViewProxy) -> Content,
        @ViewBuilder companion: @escaping (LearnLayout) -> Companion
    ) {
        self.title = title
        self.refresh = refresh
        self.avoidsKeyboard = avoidsKeyboard
        self.place = place
        self.companionAxes = companionAxes
        self.laptopCompanionEdge = laptopCompanionEdge
        self.content = content
        self.companion = companion
    }

    var body: some View {
        FoldReader { geometry, fold in
            let split = LearnPaneSplit(size: geometry.size, margins: geometry.lfPageMargins,
                                       fold: fold, axes: companionAxes, laptopEdge: laptopCompanionEdge)
            ScrollViewReader { proxy in
                // Both panes are always there, so the main scroll view keeps its identity (its
                // place, a focused field) as the hinge or the keyboard changes the split.
                LearnPanesLayout(main: split.main, companion: split.companion) {
                    mainPane(split.mainLayout, proxy: proxy)
                    companionPane(split.companionLayout)
                }
            }
        }
        // The spine between two pages: plain paper, so the pages read as two sheets.
        .background { PaperBackground(ruled: false) }
        .closesShareSheetsOnNavigation()
        #if os(iOS)
        .ignoresSafeArea(avoidsKeyboard ? [] : .keyboard, edges: .bottom)
        #endif
        .navigationTitle(title)
        #if os(iOS)
        .toolbarTitleDisplayMode(.inline)
        // On iPhone Duo's inner screen held upright the middle of the bar is over the crease,
        // so the title goes to the bar's leading edge (and the system's own title, which
        // would sit beside it, is left out).
        .toolbar(removing: windowFold.isVertical ? .title : nil)
        .toolbar {
            ToolbarItem(placement: windowFold.isVertical ? .topBarLeading : .principal) {
                // Like the system's own bar titles, it stops growing at the accessibility sizes,
                // where the bar has no room for it.
                Text(title)
                    .font(.headline)
                    .lineLimit(1)
                    .dynamicTypeSize(...DynamicTypeSize.accessibility1)
                    .opacity(pastHeader ? 1 : 0)
                    .animation(reduceMotion ? nil : LF.Motion.hover, value: pastHeader)
                    .accessibilityHidden(!pastHeader)
            }
            .sharedBackgroundVisibility(.hidden)
            .lfAxisBehavior(.horizontalOnly)
        }
        #endif
    }

    private func mainPane(_ layout: LearnLayout, proxy: ScrollViewProxy) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                content(layout, proxy)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 64)
        }
        .onScrollGeometryChange(for: Bool.self) { scroll in
            scroll.contentOffset.y + scroll.contentInsets.top > 110
        } action: { _, isPast in
            pastHeader = isPast
        }
        .remembersScroll(place)
        .modifier(LearnRefreshable(refresh: refresh))
        .paperBackground()
    }

    @ViewBuilder
    private func companionPane(_ layout: LearnLayout?) -> some View {
        if let layout {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    companion(layout)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, layout.role.isHalf ? 16 : 48)
            }
            .paperBackground()
            .transition(.opacity)
        } else {
            Color.clear
                .accessibilityHidden(true)
        }
    }
}

/// Where `LearnScrollPage`'s two panes go for this size and fold.
private struct LearnPaneSplit {
    var main: CGRect
    var mainLayout: LearnLayout
    var companion: CGRect?
    var companionLayout: LearnLayout?

    /// The shortest half worth giving a laptop-posture companion, and the shortest half worth
    /// scrolling the content in. Below these (the keyboard up in laptop posture takes the
    /// bottom half) the screen goes back to one page.
    private static let minimumCompanion: CGFloat = 200
    private static let minimumContent: CGFloat = 300

    init(size: CGSize, margins: LF.PageMargins, fold: FoldInfo, axes: Axis.Set, laptopEdge: VerticalEdge) {
        let whole = LearnLayout(width: size.width, margins: margins, fold: fold)
        main = CGRect(origin: .zero, size: size)
        mainLayout = whole

        guard !axes.isEmpty, let band = fold.band else { return }
        if axes.contains(.horizontal), fold.isVertical,
           fold.columns(from: margins.leading, to: size.width - margins.trailing) != nil {
            main = CGRect(x: 0, y: 0, width: band.minX, height: size.height)
            mainLayout = LearnLayout(width: band.minX, margins: LF.PageMargins(leading: margins.leading, trailing: 0),
                                     role: .leadingPage)
            companion = CGRect(x: band.maxX, y: 0, width: max(0, size.width - band.maxX), height: size.height)
            companionLayout = LearnLayout(width: max(0, size.width - band.maxX),
                                          margins: LF.PageMargins(leading: 0, trailing: margins.trailing),
                                          role: .trailingPage)
        } else if axes.contains(.vertical), fold.isLaptop {
            let top = CGRect(x: 0, y: 0, width: size.width, height: band.minY)
            let bottom = CGRect(x: 0, y: band.maxY, width: size.width, height: max(0, size.height - band.maxY))
            let (companionHalf, contentHalf) = laptopEdge == .top ? (top, bottom) : (bottom, top)
            guard companionHalf.height >= Self.minimumCompanion, contentHalf.height >= Self.minimumContent else { return }
            companion = companionHalf
            companionLayout = LearnLayout(width: size.width, margins: margins,
                                          role: laptopEdge == .top ? .topHalf : .bottomHalf)
            main = contentHalf
            mainLayout = LearnLayout(width: size.width, margins: margins,
                                     role: laptopEdge == .top ? .bottomHalf : .topHalf)
        }
    }
}

/// Places `LearnScrollPage`'s main pane and its companion (nothing at all when it has none).
private struct LearnPanesLayout: Layout {
    var main: CGRect
    var companion: CGRect?

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 2 else { return }
        subviews[0].place(at: CGPoint(x: bounds.minX + main.minX, y: bounds.minY + main.minY),
                          anchor: .topLeading, proposal: ProposedViewSize(main.size))
        let other = companion ?? .zero
        subviews[1].place(at: CGPoint(x: bounds.minX + other.minX, y: bounds.minY + other.minY),
                          anchor: .topLeading, proposal: ProposedViewSize(other.size))
    }
}

private struct LearnRefreshable: ViewModifier {
    let refresh: (@MainActor () async -> Void)?

    func body(content: Content) -> some View {
        if let refresh {
            content.refreshable { await refresh() }
        } else {
            content
        }
    }
}

// MARK: - Text

/// `nb-lede`: the graphite paragraph under an h1.
struct LearnLede: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lfProse(18.5, lineHeight: 1.5, color: LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .learnMeasure(46)
    }
}

/// `nb-sub`: the supporting paragraph under a section heading.
struct LearnSub: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lfProse(16.5, lineHeight: 1.5, color: LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .learnMeasure(56)
    }
}

/// A section heading with its mono kicker, the way every band on the site opens.
struct LearnSectionHeader: View {
    var kicker: String?
    let title: String
    var level: LF.TitleLevel = .h2
    var sub: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let kicker {
                SectionLabel(kicker).padding(.bottom, 12)
            }
            LearnWholeWords(text: title) { string in
                Text(string)
                    .lfTitle(level)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 620, alignment: .leading)
            if let sub {
                LearnSub(sub).padding(.top, 10)
            }
        }
    }
}

/// The breadcrumb as the site prints it: a mono file path, `guides / cad-design`.
/// The last part is bold ink. It wraps rather than truncating on a phone. Not
/// tappable: the back button is the way up.
struct LearnTrail: View {
    let parts: [String]

    var body: some View {
        let head = parts.dropLast().map { $0 + " / " }.joined()
        let last = Text(parts.last ?? "")
            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
            .foregroundStyle(LF.Palette.ink)
        Text("\(head)\(last)")
            .font(LF.Fonts.mono(12.5, relativeTo: .caption))
            .tracking(0.25)
            .foregroundStyle(LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(parts.joined(separator: ", "))
    }
}

// MARK: - Whole words

/// Text that never breaks inside a word. While its longest word fits on a line it's simply
/// the text, wrapping between words as usual. At the largest accessibility sizes one long
/// word ("Troubleshooting", "Manufacturability,") can be wider than a phone's whole column,
/// and a plain `Text` splits it mid-word ("Troubleshooti / ng"); then the text steps down a
/// Dynamic Type size at a time until that word fits, staying as large as the line allows.
///
/// `style` sets a string in the text's own type; it draws the text, and a hidden copy of
/// the longest word that the fit is measured against.
struct LearnWholeWords<Content: View>: View {
    let text: String
    @ViewBuilder var style: (String) -> Content

    /// The longest run `Text` won't break: words, cut after a hyphen, a slash or a dot, where
    /// a line can already end ("getting-", "autonomous/", a web address's "windows.").
    private var longestWord: String {
        var longest = Substring()
        for word in text.split(whereSeparator: \.isWhitespace) {
            var start = word.startIndex
            for index in word.indices where "-/.".contains(word[index]) {
                let piece = word[start...index]
                if piece.count > longest.count { longest = piece }
                start = word.index(after: index)
            }
            let piece = word[start...]
            if piece.count > longest.count { longest = piece }
        }
        return String(longest)
    }

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// The sizes it steps down through, largest first, from the reader's own.
    private var steps: [DynamicTypeSize] {
        [.accessibility5, .accessibility4, .accessibility3, .accessibility2, .accessibility1, .xxxLarge]
            .filter { $0 <= dynamicTypeSize }
    }

    var body: some View {
        // Below the accessibility sizes every word fits a phone's column, so it's only the text.
        if dynamicTypeSize.isAccessibilitySize {
            let word = longestWord
            LearnNaturalIdealWidth {
                style(text)
                    .hidden()
                    .accessibilityHidden(true)
                ViewThatFits(in: .horizontal) {
                    ForEach(steps, id: \.self) { size in
                        candidate(word, upTo: size)
                    }
                    // Nothing fits even then (a column far narrower than a phone): plain text.
                    style(text)
                }
            }
        } else {
            style(text)
        }
    }

    /// The text at no more than `size`. Its ideal width is the longest word's, so
    /// `ViewThatFits` takes it once that word fits; laid out, it wraps to the width offered
    /// and is no wider than its text.
    private func candidate(_ word: String, upTo size: DynamicTypeSize) -> some View {
        ZStack(alignment: .topLeading) {
            style(word)
                .fixedSize()
                .hidden()
                .accessibilityHidden(true)
            style(text)
                .frame(idealWidth: 0, alignment: .leading)
        }
        .dynamicTypeSize(...size)
    }
}

/// Reports the first subview's ideal width (the text on one line) and otherwise is the
/// second subview, so `LearnWholeWords` sits in a `ViewThatFits` or an `HStack` exactly as
/// its plain `Text` would: the candidates inside it measure as narrow as their longest word.
private struct LearnNaturalIdealWidth: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard subviews.count == 2 else { return .zero }
        guard proposal.width == nil else { return subviews[1].sizeThatFits(proposal) }
        let natural = subviews[0].sizeThatFits(.unspecified).width
        let shown = subviews[1].sizeThatFits(ProposedViewSize(width: natural, height: proposal.height))
        return CGSize(width: natural, height: shown.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 2 else { return }
        subviews[0].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
        subviews[1].place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(bounds.size))
    }
}

/// A jump-to chip (`TagView`) that stays whole. A tag is one line, and at the largest text
/// sizes a long name ("Business, Operations & Fundraising  9") is wider than the screen and
/// was cut short; this steps the chip's text size down until it fits the line it's given.
struct LearnFittingTag: View {
    let text: String

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Smaller sizes to try, largest first, below the reader's own.
    private var steps: [DynamicTypeSize] {
        [.accessibility3, .accessibility1, .xxLarge, .large].filter { $0 < dynamicTypeSize }
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            TagView(text)
            ForEach(steps, id: \.self) { size in
                TagView(text).dynamicTypeSize(...size)
            }
        }
    }
}

/// A slug line (the mono `nb-slug`) that wraps between words, or after a hyphen, and never
/// inside a word (see `LearnWholeWords`). For slugs that print catalogue titles: "dept /
/// getting-started / Common Mistakes & Troubleshooting".
struct LearnWholeWordSlug: View {
    let text: String
    var color: Color = LF.Palette.graphite
    var weight: Font.Weight = .regular

    var body: some View {
        LearnWholeWords(text: text) { string in
            SlugText(string, color: color, weight: weight)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Figures

/// One figure with its mono label (`dt.nb-slug` over `dd.nb-count`).
struct LearnFigure: View {
    let label: String
    let value: String
    var unit: String?
    var size: CGFloat = 26

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            SlugText(label)
            CountText(value, unit: unit, size: size)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)\(unit.map { " \($0)" } ?? "")")
    }
}

/// A phone's `label .... figure` line: the label on the left and the figure on the right
/// while both fit on one line, the figure under the label once they don't (the largest
/// text sizes), rather than squeezing the label until it breaks mid-word ("master / ed").
struct LearnLabelledFigure<Label: View, Figure: View>: View {
    @ViewBuilder var label: Label
    @ViewBuilder var figure: Figure

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                label
                Spacer(minLength: 12)
                figure
            }
            VStack(alignment: .leading, spacing: 6) {
                label
                figure
            }
        }
    }
}

/// A row of figures ruled off across the page (`nb-rule` + a four-up `dl`). Two-up on
/// a phone, four-up from regular width. Figures in a row share a baseline even when a
/// label wraps, because the block's whole job is to print figures on one line.
struct LearnFigureRule: View {
    let figures: [(label: String, value: String, unit: String?)]
    let layout: LearnLayout

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Half as many across at the accessibility sizes: two-up on a phone left each label
    /// a column narrower than "lessons" and split it mid-word.
    private var perRow: Int {
        let large = dynamicTypeSize.isAccessibilitySize
        return layout.isRegular ? max(1, min(figures.count, large ? 2 : 4)) : (large ? 1 : 2)
    }

    private var rows: [[Int]] {
        let perRow = perRow
        return stride(from: 0, to: figures.count, by: perRow).map { start in
            Array(start..<min(start + perRow, figures.count))
        }
    }

    /// Equal columns, each label wrapping inside its own (a `Grid` sized its columns to the
    /// labels on one line and ran off the page at the larger text sizes). A short last row
    /// keeps the same columns.
    var body: some View {
        let perRow = perRow
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            VStack(alignment: .leading, spacing: 18) {
                ForEach(rows, id: \.self) { row in
                    HStack(alignment: .lastTextBaseline, spacing: 20) {
                        ForEach(row, id: \.self) { index in
                            let figure = figures[index]
                            LearnFigure(label: figure.label, value: figure.value, unit: figure.unit)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        ForEach(row.count..<perRow, id: \.self) { _ in
                            Color.clear
                                .frame(maxWidth: .infinity, maxHeight: 0)
                                .accessibilityHidden(true)
                        }
                    }
                }
            }
            .padding(.top, 16)
        }
    }
}

/// The oversized figure on the blue slab (`nb-stamp`): it lands once like ink.
struct LearnSlabFigure: View {
    let value: String
    let label: String

    @State private var landed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value)
                .font(LF.Fonts.mono(44, weight: .bold, relativeTo: .largeTitle))
                .tracking(-1.7)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .scaleEffect(landed || reduceMotion ? 1 : SiteTokens.Movement.inkScale, anchor: .bottomLeading)
                .offset(y: landed || reduceMotion ? 0 : SiteTokens.Movement.inkDrop)
            Rectangle()
                .fill(LF.Palette.onBlue.opacity(0.4))
                .frame(height: 1)
                .padding(.top, 9)
            Text(label)
                .font(LF.Fonts.mono(12.8, relativeTo: .caption))
                .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                .padding(.top, 8)
        }
        .foregroundStyle(LF.Palette.onBlue)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) \(label)")
        .onAppear {
            guard !landed else { return }
            if reduceMotion { landed = true } else { withAnimation(LF.Motion.stamp) { landed = true } }
        }
    }
}

// MARK: - The log

/// One line of the carbon-copy log (`nb-row`): identifiers on the left, the title and
/// what it covers in the middle, the word you'd click on the right. One column on a
/// phone. Wrap it in a `NavigationLink` with `.buttonStyle(.inkRow)`.
struct LearnLogRow<Meta: View, Main: View>: View {
    let layout: LearnLayout
    var trailing: String?
    @ViewBuilder var meta: Meta
    @ViewBuilder var main: Main

    var body: some View {
        Group {
            if layout.isRegular {
                HStack(alignment: .firstTextBaseline, spacing: 28) {
                    meta.frame(width: min(210, layout.contentWidth * 0.22), alignment: .leading)
                    main.frame(maxWidth: .infinity, alignment: .leading)
                    if let trailing {
                        SlugText(trailing, color: LF.Palette.ink)
                            .fixedSize()
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 7) {
                    meta
                    main
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.vertical, layout.isRegular ? 20 : 15)
        .overlay(alignment: .bottom) { DashedRule() }
        .contentShape(Rectangle())
    }
}

/// The title and summary in the middle of a log row.
struct LearnRowText: View {
    let title: String
    var summary: String?
    var summaryLines: Int? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            LearnWholeWords(text: title) { string in
                Text(string)
                    .font(LF.Fonts.display(19, relativeTo: .title3))
                    .tracking(-0.45)
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let summary, !summary.isEmpty {
                Text(summary)
                    .font(LF.Fonts.body(15.5))
                    .lineHeight(.multiple(factor: 1.4))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .lineLimit(summaryLines)
                    .fixedSize(horizontal: false, vertical: summaryLines == nil)
                    .learnMeasure(62)
            }
        }
    }
}

// MARK: - Ticks

/// The tick in the margin of a lesson row: a small hand-ruled box, with a blue pen
/// check when the lesson is done. Never the only signal (rows also say "done").
struct LearnTickBox: View {
    let done: Bool
    @ScaledMetric(relativeTo: .body) private var size: CGFloat = 19

    var body: some View {
        ZStack {
            HandShape(.s).fill(LF.Palette.card)
            HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
            if done {
                PenCheckShape()
                    .stroke(LF.Palette.blue, style: StrokeStyle(lineWidth: 2.3, lineCap: .round, lineJoin: .round))
                    .frame(width: size * 0.62, height: size * 0.47)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A part number stamped in a box: a module's `01` or `pre`, a department's symbol.
struct LearnStampedBox<Content: View>: View {
    var side: CGFloat = 44
    @ViewBuilder var content: Content
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    var body: some View {
        content
            .frame(width: side * scale, height: side * scale)
            .background {
                ZStack {
                    HandShape(.s).fill(LF.Palette.card)
                    HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                }
            }
    }
}

// MARK: - Buttons drawn inside a card

/// The face of a small primary button, for inside a card that is itself the button.
struct LearnButtonFace: View {
    let title: String
    var ghost = false

    var body: some View {
        Text(title)
            .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
            .foregroundStyle(ghost ? LF.Palette.ink : LF.Palette.onBlue)
            .lineLimit(1)
            .fixedSize()
            .padding(.vertical, 9)
            .padding(.horizontal, 14)
            .background {
                ZStack {
                    HandShape(.s).fill(ghost ? Color.clear : LF.Palette.blueButton)
                    HandShape(.s).strokeBorder(ghost ? LF.Palette.ink : LF.Palette.blueButton, lineWidth: LF.Metrics.stroke)
                }
            }
            .accessibilityHidden(true)
    }
}

/// An inline text link in the site's `nb-link` style: ink, blue rule under it.
struct LearnLinkLabel: View {
    let title: String
    var systemImage: String?

    var body: some View {
        HStack(spacing: 6) {
            Text(title)
                .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                .underline(true, color: LF.Palette.blue)
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.caption.weight(.semibold))
                    .accessibilityHidden(true)
            }
        }
        .foregroundStyle(LF.Palette.ink)
        .frame(minHeight: LF.Metrics.tap)
        .contentShape(Rectangle())
    }
}

// MARK: - Resume and next unlock

/// "Pick up where you left off": the next lesson, named, with the action on the right
/// (the site's `ResumeCard`, bar variant). The whole card is the link.
struct LearnResumeBar: View {
    let location: LessonLocation
    var kicker: String
    var action: String

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        NavigationLink(value: AppRoute.lesson(location.lesson.id)) {
            NotebookCard(lift: true, padding: 15) {
                // Every line whole: the site truncates these to one line each, but at the
                // larger text sizes that cut the lesson's name off. At the accessibility
                // sizes the action goes under the text instead of squeezing it.
                let text = VStack(alignment: .leading, spacing: 4) {
                    SlugText("\(kicker) / dept / \(location.department.slug)")
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(location.lesson.title)
                        .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(location.department.name), \(location.module.title)")
                        .font(LF.Fonts.body(14.5))
                        .foregroundStyle(LF.Palette.graphite)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 12) {
                        text
                        LearnButtonFace(title: action)
                    }
                } else {
                    HStack(alignment: .center, spacing: 14) {
                        text
                        LearnButtonFace(title: action)
                    }
                }
            }
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel("\(action): \(location.lesson.title)")
        .accessibilityValue("\(location.department.name), \(location.module.title)")
    }
}

/// The nearest badge and how far off it is (the site's `NextUnlock`). The figure is
/// always printed beside the bar.
struct LearnNextUnlockCard: View {
    let unlock: NextUnlock
    let layout: LearnLayout

    private var remaining: Int { unlock.progress.remaining }

    private var unit: String {
        let unit = unlock.progress.unit
        return remaining == 1 && unit.hasSuffix("s") ? String(unit.dropLast()) : unit
    }

    var body: some View {
        NotebookCard(padding: 15) {
            let text = VStack(alignment: .leading, spacing: 4) {
                SlugText("next unlock")
                Text(unlock.name)
                    .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                    .foregroundStyle(LF.Palette.ink)
                Text("\(remaining) more \(unit). \(unlock.description)")
                    .font(LF.Fonts.body(14.5))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            let meter = MeterView(value: unlock.progress.fraction, label: "progress",
                                  valueText: "\(unlock.progress.current)/\(unlock.progress.target)")
            Group {
                if layout.isRegular {
                    HStack(alignment: .center, spacing: 22) {
                        text.frame(maxWidth: .infinity, alignment: .leading)
                        meter.frame(width: 150)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 14) {
                        text
                        meter
                    }
                }
            }
            .frame(maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// This week's count against the goal, exactly as the server sent it (guests: worked
/// out on this device, and labelled that way).
struct LearnWeekMeter: View {
    let rhythm: Rhythm
    var copy: RhythmCopy?
    var onDevice: Bool

    var body: some View {
        NotebookCard(padding: 15) {
            VStack(alignment: .leading, spacing: 10) {
                MeterView(value: rhythm.fraction,
                          label: onDevice ? "\(rhythm.windowLabel), on this device" : rhythm.windowLabel,
                          valueText: "\(rhythm.windowCount)/\(rhythm.goal)")
                if let copy, !copy.headline.isEmpty {
                    // The server's copy uses em dashes; the app writes them as full stops,
                    // the same rewrite Home's week card uses.
                    Text(HomeCopy.plain(copy.headline))
                        .font(LF.Fonts.body(14.5))
                        .foregroundStyle(LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - States

/// The note shown while the catalogue is still arriving on a first launch.
struct LearnLoadingBlock: View {
    var rows = 4

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(height: 30, width: 240)
            SkeletonBlock(height: 18)
            SkeletonBlock(height: 18, width: 200)
            ForEach(0..<rows, id: \.self) { _ in
                SkeletonBlock(height: 120)
                    .padding(.top, 8)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading the guides")
    }
}

/// A plain-spoken note for "nothing here" and "couldn't load" states.
struct LearnNotice<Actions: View>: View {
    let kicker: String
    let message: String
    @ViewBuilder var actions: Actions

    var body: some View {
        NoteCallout {
            SlugText(kicker)
            Text(message)
                .font(LF.Fonts.body(16))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            actions
                .padding(.top, 6)
        }
        .learnMeasure(60)
    }
}

extension LearnNotice where Actions == EmptyView {
    init(kicker: String, message: String) {
        self.init(kicker: kicker, message: message) { EmptyView() }
    }
}

// MARK: - Motion

extension View {
    /// The site's arrival for a taped card (`nb-straighten`): it comes in a little crooked
    /// and low and is pushed square onto its resting angle. Transform only, so nothing is
    /// ever invisible; nothing at all under Reduce Motion.
    func learnArrival(_ reduceMotion: Bool, angle: Double = SiteTokens.Movement.straightenAngle) -> some View {
        scrollTransition(reduceMotion ? .identity : .animated(LF.Motion.arrive)) { content, phase in
            content
                .rotationEffect(.degrees(phase.isIdentity ? 0 : angle))
                .offset(y: phase.isIdentity ? 0 : 8)
        }
    }
}

// MARK: - Formatting

enum LearnFormat {
    /// `01`, `02` ... the way the site numbers stops and lessons.
    static func ordinal(_ n: Int) -> String {
        n < 10 ? "0\(n)" : "\(n)"
    }

    /// How to ask for a refresh here: a pull on iPhone and iPad, Command-R on a Mac (View >
    /// Refresh), which has no pull gesture. "Pull down to check learnfrc.com".
    static var checkSite: String {
        #if os(macOS)
        "Press Command-R to check learnfrc.com"
        #else
        "Pull down to check learnfrc.com"
        #endif
    }

    /// "Six", the way the site spells a small count at the start of a sentence ("Six
    /// calculators for ..."); digits past ten.
    static func spelledCount(_ n: Int) -> String {
        let words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]
        return words.indices.contains(n) ? words[n] : n.formatted()
    }

    static func plural(_ n: Int, _ one: String, _ many: String) -> String {
        "\(n.formatted()) \(n == 1 ? one : many)"
    }

    /// `2026-10-03` as "Oct 3, 2026" (or "October 3, 2026"), read in UTC so the date
    /// never slips a day in a western timezone.
    static func articleDate(_ raw: String, long: Bool = false) -> String {
        guard let date = FlexibleDate.parse(String(raw.prefix(10))) else { return raw }
        var style = Date.FormatStyle(date: long ? .long : .abbreviated, time: .omitted)
        style.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return date.formatted(style)
    }

    /// "done, 20 minutes" for VoiceOver.
    static func lessonState(done: Bool, pending: Bool, minutes: Int) -> String {
        var parts: [String] = []
        if done { parts.append("done") }
        if pending { parts.append("saved, will sync") }
        if minutes > 0 { parts.append("\(minutes) minutes") }
        return parts.joined(separator: ", ")
    }

    static func hours(fromMinutes minutes: Int) -> Int {
        max(1, Int((Double(minutes) / 60).rounded()))
    }
}
