import SwiftUI

// Pieces every admin screen shares: the page frame and its width breakpoints (with the fold
// on an open iPhone Duo), the column layout, the drawer, the ruled tallies, the honesty notes,
// the time and date wording, the armed two-step button and the way one admin screen reaches
// another.

// MARK: - Reaching the store

extension View {
    /// Hands a preview's store to every admin view inside.
    func adminStore(_ store: AdminStore) -> some View {
        environment(store)
    }
}

// MARK: - Navigation

/// How the admin screens map to the shell's routes. The shell sets it once
/// (`.environment(\.adminNavigator, AdminNavigator { ... })`) so admin links push real
/// `AppRoute`s (deep links, Handoff, window restoration). Unwired, `AdminLink` still works: it
/// pushes the screen itself.
struct AdminNavigator: Sendable {
    let route: @MainActor @Sendable (AdminDestination) -> AppRoute?

    init(route: @escaping @MainActor @Sendable (AdminDestination) -> AppRoute?) {
        self.route = route
    }

    static let unwired = AdminNavigator { _ in nil }
}

extension EnvironmentValues {
    @Entry var adminNavigator: AdminNavigator = .unwired
}

/// A link to another admin screen. Style it like any button (`.buttonStyle(.inkRow)`).
struct AdminLink<Label: View>: View {
    let destination: AdminDestination
    @ViewBuilder var label: Label

    @Environment(\.adminNavigator) private var navigator
    @State private var isPushed = false

    init(to destination: AdminDestination, @ViewBuilder label: () -> Label) {
        self.destination = destination
        self.label = label()
    }

    var body: some View {
        if let route = navigator.route(destination) {
            NavigationLink(value: route) { label }
        } else {
            Button { isPushed = true } label: { label }
                .navigationDestination(isPresented: $isPushed) {
                    AdminDestinationView(destination: destination)
                }
        }
    }
}

/// The screen for each admin destination.
struct AdminDestinationView: View {
    let destination: AdminDestination

    var body: some View {
        switch destination {
        case .dashboard: AdminDashboardView()
        case .feedback: AdminFeedbackView()
        case .team: AdminTeamView()
        case .apply: ApplyView()
        }
    }
}

// MARK: - Page frame

/// Where the fold of an open iPhone Duo crosses the content column, in the column's own
/// coordinates. Only kept when both sides are wide enough to be a page.
struct AdminCrease: Equatable, Sendable {
    var minX: CGFloat
    var maxX: CGFloat
}

/// How wide the page is, and where its fold is, so a screen can choose between its phone,
/// two-page and wide layouts. Breakpoints are on the container, never the device, so a window
/// on iPad or Mac and every posture of a foldable get the layout their width deserves.
///
/// On an open iPhone Duo held upright the fold runs down the middle of the column, and the
/// screens lay out as two pages around it at every text size: each page is about a phone wide,
/// which every admin screen already fits, and nothing sits across the crease.
struct AdminLayout: Equatable, Sendable {
    var pageWidth: CGFloat
    /// One of the accessibility text sizes: every multi-column arrangement stacks (except the
    /// two pages of a fold).
    var isLargeText = false
    /// The fold in column coordinates (iOS 27.1 and later, on a foldable), kept only when both
    /// pages are wide enough to be a page.
    var crease: AdminCrease?
    /// The page's own margins (`GeometryProxy.lfPageMargins`), asymmetric beside iPhone Duo's
    /// vertical bar. Nil uses the site's gutter on both sides.
    var pageMargins: LF.PageMargins?

    static let maxWidth: CGFloat = LF.Metrics.maxContentWidth

    init(pageWidth: CGFloat, isLargeText: Bool = false, crease: AdminCrease? = nil, pageMargins: LF.PageMargins? = nil) {
        self.pageWidth = pageWidth
        self.isLargeText = isLargeText
        self.crease = crease
        self.pageMargins = pageMargins
    }

    /// Reads the page's width, margins and fold from its geometry.
    init(_ proxy: GeometryProxy, fold: FoldInfo, isLargeText: Bool) {
        self.init(pageWidth: proxy.size.width, isLargeText: isLargeText, pageMargins: proxy.lfPageMargins)
        // A vertical fold (an iPhone Duo open like a book). Used whether or not the hinge is
        // bent right now, so the page doesn't reflow as it moves between flat and book.
        if let pages = fold.columns(from: columnOrigin, to: columnOrigin + columnWidth) {
            crease = AdminCrease(minX: pages.leading, maxX: pages.leading + pages.gap)
        }
    }

    var gutter: CGFloat { LF.Metrics.gutter(for: pageWidth) }
    /// The leading and trailing margins around the column.
    var margins: LF.PageMargins { pageMargins ?? LF.PageMargins(leading: gutter, trailing: gutter) }
    /// Where the content column starts on the page.
    var columnOrigin: CGFloat { max(0, (pageWidth - Self.maxWidth) / 2) + margins.leading }
    var columnWidth: CGFloat { max(0, min(pageWidth, Self.maxWidth) - margins.total) }

    /// Two pages, split on the fold.
    var isFoldSplit: Bool { crease != nil }
    /// The fold's two pages as widths, for `FoldPages`; nil without a fold.
    var pages: FoldColumns? {
        crease.map { FoldColumns(leading: $0.minX, gap: $0.maxX - $0.minX, trailing: max(0, columnWidth - $0.maxX)) }
    }
    /// The masthead beside its card, drawers two across (the site's `lg`, and the two pages of
    /// a fold).
    var isWide: Bool { isFoldSplit || (!isLargeText && pageWidth >= 1000) }
    /// Room for a second column inside a drawer. Never inside one page of a fold.
    var isRegular: Bool { !isLargeText && !isFoldSplit && columnWidth >= 560 }
    /// The four stamps: 2 x 2 (two to a page on a fold), four across on the widest windows,
    /// one at a time at the largest text sizes on a phone.
    var stampColumns: Int {
        if isFoldSplit { return 2 }
        if isLargeText { return columnWidth >= 640 ? 2 : 1 }
        return pageWidth >= 1000 ? 4 : 2
    }
    /// The tally sheet: three ruled columns from 861pt (the site's turn-over point), two on an
    /// open foldable so the rule lands on the fold.
    var tallyColumns: Int {
        if isFoldSplit { return 2 }
        if isLargeText { return 1 }
        return pageWidth >= 861 ? 3 : 1
    }
    var drawerColumns: Int { isWide ? 2 : 1 }
    var sectionGap: CGFloat { isWide ? 72 : 52 }

    /// The fold for a layout that sits in the column, nil without one.
    var columnCrease: AdminCrease? { crease }
}

/// The scrolling sheet every admin screen sits on: paper ruled with the grid, the width and
/// fold read in the same layout pass (so a wide window never flashes the phone layout), pull
/// to refresh on iPhone and iPad.
struct AdminPage<Content: View>: View {
    var avoidsKeyboard: Bool
    var refresh: (@MainActor () async -> Void)?
    @ViewBuilder var content: (AdminLayout) -> Content

    @Environment(\.dynamicTypeSize) private var typeSize

    init(avoidsKeyboard: Bool = false, refresh: (@MainActor () async -> Void)? = nil, @ViewBuilder content: @escaping (AdminLayout) -> Content) {
        self.avoidsKeyboard = avoidsKeyboard
        self.refresh = refresh
        self.content = content
    }

    var body: some View {
        FoldReader { proxy, fold in
            let layout = AdminLayout(proxy, fold: fold, isLargeText: typeSize.isAccessibilitySize)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    content(layout)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 10)
                .padding(.bottom, 64)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await refresh?() }
            .paperBackground()
        }
        #if os(iOS)
        .ignoresSafeArea(avoidsKeyboard ? [] : .keyboard, edges: .bottom)
        #endif
    }

}

extension View {
    /// One column of page content: capped at the site's 1280pt wrap, centred, inside the
    /// page's margins (the site's fluid gutter, or the system's margin beside iPhone Duo's
    /// vertical bar).
    func adminColumn(_ layout: AdminLayout) -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, layout.margins.leading)
            .padding(.trailing, layout.margins.trailing)
            .frame(maxWidth: AdminLayout.maxWidth)
            .frame(maxWidth: .infinity)
    }

    /// Keeps this to the leading page of a fold, so it never sits across it; as it was
    /// everywhere else. For a card, a heading or a note with nothing for the other page.
    func adminLeadingPage(_ layout: AdminLayout) -> some View {
        frame(maxWidth: layout.crease?.minX ?? .infinity, alignment: .leading)
    }

    /// The site's blue band (`nb-slab`) from edge to edge of the page, ruled in ink top and
    /// bottom. Clipped to the page, so on iPad and Mac it stops at the sidebar.
    func adminBand() -> some View {
        self
            .background {
                VStack(spacing: 0) {
                    InkRule()
                    LF.Palette.blueButton
                    InkRule()
                }
            }
            .clipped()
    }
}

// MARK: - Columns

/// Children in rows of `columns`, each row as tall as its tallest child, tops aligned (the
/// site's `grid items-start`). With two columns and a fold, the gap between them is the fold.
/// `adaptive` picks one or two columns from the width it's offered.
struct AdminColumnsLayout: Layout {
    enum Count: Equatable, Sendable {
        case fixed(Int)
        /// Two columns once each would be at least this wide, else one.
        case adaptive(minColumnWidth: CGFloat)
    }

    var count: Count
    var spacing: CGFloat
    var rowSpacing: CGFloat
    /// Relative column widths (the masthead's 1.4 to 0.9). Ignored on a fold.
    var weights: [CGFloat]?
    var crease: AdminCrease?
    /// Offers every child its row's full height, so a child that fills it (the tally sheet's
    /// ruled panels) lines up with the tallest one, like CSS grid's stretch.
    var stretchesRows: Bool

    init(_ count: Count, spacing: CGFloat = 32, rowSpacing: CGFloat = 0, weights: [CGFloat]? = nil, crease: AdminCrease? = nil, stretchesRows: Bool = false) {
        self.count = count
        self.spacing = spacing
        self.rowSpacing = rowSpacing
        self.weights = weights
        self.crease = crease
        self.stretchesRows = stretchesRows
    }

    init(columns: Int, spacing: CGFloat = 32, rowSpacing: CGFloat = 0, weights: [CGFloat]? = nil, crease: AdminCrease? = nil, stretchesRows: Bool = false) {
        self.init(.fixed(columns), spacing: spacing, rowSpacing: rowSpacing, weights: weights, crease: crease, stretchesRows: stretchesRows)
    }

    private func columns(for width: CGFloat) -> Int {
        switch count {
        case .fixed(let n): return max(1, n)
        case .adaptive(let minimum): return width >= minimum * 2 + spacing ? 2 : 1
        }
    }

    /// Each column's x and width.
    private func frames(width: CGFloat) -> [(x: CGFloat, width: CGFloat)] {
        let n = columns(for: width)
        guard n > 1 else { return [(0, width)] }
        if n == 2, let crease, crease.minX > 120, width - crease.maxX > 120 {
            return [(0, crease.minX), (crease.maxX, width - crease.maxX)]
        }
        let usable = max(0, width - spacing * CGFloat(n - 1))
        let shares: [CGFloat] = (weights?.count == n) ? weights! : Array(repeating: 1, count: n)
        let total = max(shares.reduce(0, +), 0.0001)
        var x: CGFloat = 0
        return shares.map { share in
            let w = usable * share / total
            defer { x += w + spacing }
            return (x, w)
        }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 640
        let frames = frames(width: width)
        var y: CGFloat = 0
        var row = 0
        for start in stride(from: 0, to: subviews.count, by: frames.count) {
            var height: CGFloat = 0
            for index in start..<min(start + frames.count, subviews.count) {
                let frame = frames[index - start]
                height = max(height, subviews[index].sizeThatFits(ProposedViewSize(width: frame.width, height: nil)).height)
            }
            y += height + (row > 0 ? rowSpacing : 0)
            row += 1
        }
        return CGSize(width: width, height: y)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let frames = frames(width: bounds.width)
        var y = bounds.minY
        var row = 0
        for start in stride(from: 0, to: subviews.count, by: frames.count) {
            if row > 0 { y += rowSpacing }
            let range = start..<min(start + frames.count, subviews.count)
            let height = range.map { subviews[$0].sizeThatFits(ProposedViewSize(width: frames[$0 - start].width, height: nil)).height }.max() ?? 0
            for index in range {
                let frame = frames[index - start]
                let proposal = ProposedViewSize(width: frame.width, height: stretchesRows ? height : nil)
                subviews[index].place(at: CGPoint(x: bounds.minX + frame.x, y: y), anchor: .topLeading, proposal: proposal)
            }
            y += height
            row += 1
        }
    }
}

/// Wraps its children onto as many lines as they need, like a line of mono stamps on the
/// site (`flex flex-wrap gap-x-4`).
struct AdminFlowLayout: Layout {
    var spacing: CGFloat = 14
    var lineSpacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, widest: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(ProposedViewSize(width: width.isFinite ? width : nil, height: nil))
            if x > 0, x + size.width > width {
                y += lineHeight + lineSpacing
                x = 0
                lineHeight = 0
            }
            let fitted = min(size.width, width.isFinite ? width : size.width)
            x += fitted + spacing
            widest = max(widest, x - spacing)
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: width.isFinite ? width : widest, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            let width = min(size.width, bounds.width)
            if x > bounds.minX, x + width > bounds.maxX {
                y += lineHeight + lineSpacing
                x = bounds.minX
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: size.height))
            x += width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

// MARK: - Headings

/// The marker, headline and lede at the top of an admin page (`nb-marker`, `h1`, `nb-lede`).
struct AdminMasthead: View {
    let marker: String
    let title: String
    var lede: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(marker)
            Text(title)
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            if let lede {
                Text(lede)
                    .lfProse(17.5, lineHeight: 1.5, color: LF.Palette.graphite)
                    .frame(maxWidth: 580, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 18)
            }
        }
    }
}

/// A section heading under its marker (`nb-marker` + `h2`).
struct AdminSectionHeading: View {
    let marker: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(marker)
            Text(title)
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Drawer

/// A drawer in the binder (`CollapsiblePanel`): a 2pt ink rule, the mono slug, the title and an
/// optional badge, and the state written out ("open" / "close") beside a drawn chevron. Closed
/// on arrival like the site; its contents are only built once it opens.
struct AdminDrawer<Content: View>: View {
    let title: String
    let slug: String
    var badge: String?
    @Binding var isOpen: Bool
    @ViewBuilder var content: Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(_ title: String, slug: String, badge: String? = nil, isOpen: Binding<Bool>, @ViewBuilder content: () -> Content) {
        self.title = title
        self.slug = slug
        self.badge = badge
        self._isOpen = isOpen
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            Button {
                if reduceMotion {
                    isOpen.toggle()
                } else {
                    withAnimation(LF.Motion.settle) { isOpen.toggle() }
                }
            } label: {
                AdminDrawerHeader(title: title, slug: slug, badge: badge, trailing: isOpen ? "close" : "open", chevronUp: isOpen)
            }
            .buttonStyle(AdminDrawerButtonStyle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(badge.map { "\(title), \($0)" } ?? title)
            .accessibilityValue(isOpen ? "Open" : "Closed")
            .accessibilityHint(isOpen ? "Closes the drawer" : "Opens the drawer")
            .accessibilityAddTraits([.isHeader, .isButton])

            if isOpen {
                VStack(alignment: .leading, spacing: 0) {
                    content
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 4)
                .padding(.top, 4)
                .padding(.bottom, 28)
                .transition(reduceMotion ? .identity : .opacity.combined(with: .offset(y: -6)))
            }
        }
    }
}

/// The header row of a drawer, also used by the dashboard's Feedback row, which opens a
/// screen instead (`trailing` "open" and an arrow).
struct AdminDrawerHeader: View {
    let title: String
    let slug: String
    var badge: String?
    var trailing: String
    var chevronUp: Bool = false
    var arrow: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                SlugText(slug)
                    .fixedSize(horizontal: false, vertical: true)
                AdminFlowLayout(spacing: 10, lineSpacing: 6) {
                    Text(title)
                        .font(LF.Fonts.display(19, relativeTo: .title3))
                        .tracking(19 * -0.02)
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if let badge {
                        TagView(badge)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 8) {
                SlugText(trailing)
                if arrow {
                    Image(systemName: "arrow.right")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(LF.Palette.blue)
                } else {
                    AdminChevron()
                        .frame(width: 15, height: 10)
                        .rotationEffect(.degrees(chevronUp ? 180 : 0))
                        .animation(reduceMotion ? nil : LF.Motion.hover, value: chevronUp)
                }
            }
            .accessibilityHidden(true)
        }
        .padding(.vertical, 16)
        .padding(.horizontal, 4)
        .frame(minHeight: LF.Metrics.tap)
        .contentShape(Rectangle())
    }
}

/// The drawer's chevron, drawn in ink at the rules' 2pt weight.
private struct AdminChevron: View {
    var body: some View {
        Path { p in
            p.move(to: CGPoint(x: 1, y: 1.6))
            p.addLine(to: CGPoint(x: 7.5, y: 8.4))
            p.addLine(to: CGPoint(x: 14, y: 1.6))
        }
        .stroke(LF.Palette.ink, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
    }
}

/// A full-width header button: a faint blue wash under a pointer or a finger.
struct AdminDrawerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        AdminDrawerButton(configuration: configuration)
    }
}

private struct AdminDrawerButton: View {
    let configuration: ButtonStyleConfiguration
    @State private var isHovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        configuration.label
            .foregroundStyle(LF.Palette.ink)
            .background {
                Rectangle().fill(isHovering || configuration.isPressed ? LF.Palette.rowWash : .clear)
            }
            .onHover { isHovering = $0 }
            #if os(iOS)
            .hoverEffectDisabled()
            #endif
            .animation(reduceMotion ? nil : LF.Motion.hover, value: isHovering)
    }
}

// MARK: - Tallies

/// The ink trough and blue fill of `nb-meter`, without a figure (the figure is printed beside
/// it in the row). Hidden from VoiceOver: the row already reads its value.
struct AdminGauge: View {
    let fraction: Double
    @ScaledMetric(relativeTo: .caption) private var height: CGFloat = 9.6

    var body: some View {
        let value = fraction.isFinite ? min(max(fraction, 0), 1) : 0
        GeometryReader { proxy in
            Rectangle()
                .fill(LF.Palette.blue)
                .frame(width: proxy.size.width * value)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: height)
        .background(LF.Palette.paper)
        .clipShape(HandShape(.s))
        .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
        .accessibilityHidden(true)
    }
}

/// A tally in a drawer (`MiniList`): a name, a figure in blue mono and, where the comparison is
/// the point, a gauge under it.
struct AdminMiniList: View {
    let rows: [AdminMiniRow]
    var empty: String = "Nothing recorded yet."

    var body: some View {
        if rows.isEmpty {
            SlugText(empty)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 8)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    if index > 0 { DashedRule() }
                    AdminMiniRowView(row: row)
                        .padding(.top, index == 0 ? 0 : 10)
                        .padding(.bottom, 10)
                }
            }
        }
    }
}

private struct AdminMiniRowView: View {
    let row: AdminMiniRow

    private var figure: String { "\(row.value.formatted())\(row.valueSuffix ?? "")" }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                label
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(figure)
                    .font(LF.Fonts.mono(15, weight: .bold, relativeTo: .body))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.blue)
                    .fixedSize()
            }
            if let pct = row.pct {
                AdminGauge(fraction: pct / 100)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.sub.map { "\(row.label), \($0)" } ?? row.label)
        .accessibilityValue(figure)
    }

    private var label: some View {
        Group {
            if let sub = row.sub {
                Text("\(Text(row.label))  \(Text(sub).font(LF.Fonts.mono(12.5, relativeTo: .caption)).foregroundStyle(LF.Palette.graphite))")
            } else {
                Text(row.label)
            }
        }
        .font(LF.Fonts.body(15.5, relativeTo: .body))
        .foregroundStyle(LF.Palette.ink)
        .lineLimit(4)
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Two related tallies in one drawer (`MiniListPair`): side by side when there's room, stacked
/// otherwise, each under its own slug.
struct AdminMiniListPair: View {
    struct Side {
        let title: String
        let rows: [AdminMiniRow]
        var empty: String
    }

    let left: Side
    let right: Side
    var isLargeText: Bool

    var body: some View {
        AdminColumnsLayout(isLargeText ? .fixed(1) : .adaptive(minColumnWidth: 240), spacing: 32, rowSpacing: 24) {
            column(left)
            column(right)
        }
    }

    private func column(_ side: Side) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            AdminSubhead(side.title)
            AdminMiniList(rows: side.rows, empty: side.empty)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(side.title)
    }
}

/// A mono slug over a dashed rule (`nb-slug border-b border-dashed`), heading a list.
struct AdminSubhead: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SlugText(text)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            DashedRule()
        }
    }
}

/// A section inside a drawer, ruled off with a dashed line (`mt-6 border-t border-dashed pt-4`).
struct AdminDrawerSection<Content: View>: View {
    let slug: String
    @ViewBuilder var content: Content

    init(_ slug: String, @ViewBuilder content: () -> Content) {
        self.slug = slug
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            DashedRule()
            SlugText(slug)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
                .accessibilityAddTraits(.isHeader)
            content
        }
        .padding(.top, 24)
    }
}

// MARK: - Notes

/// The quiet paragraph that says what a set of figures can and can't be read to mean
/// (`Footnote`): sans at reading size, graphite, at the reading measure.
struct AdminFootnote: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lfProse(15, lineHeight: 1.55, color: LF.Palette.graphite)
            .frame(maxWidth: 620, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 12)
    }
}

/// A slug and a paragraph in the note box (`nb-note`), for the honesty notes.
struct AdminNote: View {
    let slug: String
    let text: String

    var body: some View {
        NoteCallout {
            SlugText(slug)
                .fixedSize(horizontal: false, vertical: true)
            Text(text)
                .lfProse(15, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: 680, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// A short status after an action ("Reply sent", "Role saved."): ink with the pen check, read
/// out by VoiceOver when it appears. The site's toast, kept on the page.
struct AdminStatusLine: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "checkmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(LF.Palette.blue)
                .accessibilityHidden(true)
            Text(text)
                .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .onAppear { AccessibilityNotification.Announcement(text).post() }
        .onChange(of: text) { _, new in AccessibilityNotification.Announcement(new).post() }
    }
}

/// A load that failed with nothing to show: the reason and a way to try again. With a copy on
/// screen it's one quiet line.
struct AdminLoadError: View {
    let error: AdminError
    var hasCopy: Bool
    var retry: () -> Void

    var body: some View {
        if hasCopy {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: error.kind == .network ? "wifi.slash" : "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(LF.Palette.graphite)
                    .accessibilityHidden(true)
                Text(error.kind == .network ? "Offline. Showing the last copy." : "Couldn't refresh. Showing the last copy.")
                    .font(LF.Fonts.mono(12, relativeTo: .caption))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Button("Try again", action: retry)
                    .buttonStyle(.inkGhostSmall)
            }
        } else {
            NoteCallout {
                SlugText("couldn't load")
                Text(error.message)
                    .lfProse(16, lineHeight: 1.45)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Try again", action: retry)
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 6)
            }
            .frame(maxWidth: 680, alignment: .leading)
        }
    }
}

/// Placeholder blocks while the first copy loads.
struct AdminLoadingBlock: View {
    var lines = 4

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SkeletonBlock(height: 22, width: 220)
            ForEach(0..<lines, id: \.self) { index in
                SkeletonBlock(height: 16, width: index.isMultiple(of: 2) ? nil : 260)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading")
    }
}

/// The reading-a-copy stamp: "re-read every 30s" with a clock drawn in ink.
struct AdminRefreshStamp: View {
    let seconds: Int

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "clock")
                .font(.caption.weight(.semibold))
                .foregroundStyle(LF.Palette.graphite)
                .accessibilityHidden(true)
            SlugText("re-read every \(seconds)s")
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Armed button

/// The two-step control (Reject, Remove): the first press changes the word and prints what is
/// about to happen, the second sends it. It disarms itself after five seconds, so one left
/// armed and forgotten is safe again before anyone comes back. Destruction reads by weight and
/// wording (the heavy edge once armed), never by colour.
struct ArmedButton: View {
    let title: String
    let armedTitle: String
    let busyTitle: String
    /// Rides along for VoiceOver ("Reject @handle"), as the site's screen-reader text does.
    let handle: String
    let isBusy: Bool
    @Binding var isArmed: Bool
    let action: () -> Void

    var body: some View {
        Button {
            if isArmed {
                action()
            } else {
                isArmed = true
            }
        } label: {
            Text(isBusy ? busyTitle : (isArmed ? armedTitle : title))
        }
        .buttonStyle(InkButtonStyle(isArmed ? .destructive : .ghost, size: .small))
        .accessibilityLabel(Text(verbatim: "\(isBusy ? busyTitle : (isArmed ? armedTitle : title)) \(handle)"))
        .sensoryFeedback(.warning, trigger: isArmed) { _, armed in armed }
        .task(id: isArmed) {
            guard isArmed else { return }
            try? await Task.sleep(for: .seconds(5))
            if !Task.isCancelled { isArmed = false }
        }
    }
}

// MARK: - Words

/// Dates and durations the way the admin pages print them.
enum AdminText {
    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    private static var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return calendar
    }

    /// "Jul 22, 2026" in UTC, the site's table-driven format; "Jul 22" without the year.
    static func day(_ date: Date?, withYear: Bool = true) -> String? {
        guard let date else { return nil }
        let parts = utc.dateComponents([.year, .month, .day], from: date)
        guard let month = parts.month, let day = parts.day, let year = parts.year else { return nil }
        let md = "\(months[(month - 1 + 12) % 12]) \(day)"
        return withYear ? "\(md), \(year)" : md
    }

    /// "just now", "4m", "3h", "2d", with " ago" when `ago` (the feedback inbox and the desk).
    static func ago(_ date: Date?, ago: Bool, now: Date = .now) -> String {
        guard let date else { return ago ? "a while ago" : "earlier" }
        let minutes = Int((now.timeIntervalSince(date) / 60).rounded())
        if minutes < 1 { return "just now" }
        let suffix = ago ? " ago" : ""
        if minutes < 60 { return "\(minutes)m\(suffix)" }
        let hours = Int((Double(minutes) / 60).rounded())
        if hours < 24 { return "\(hours)h\(suffix)" }
        return "\(Int((Double(hours) / 24).rounded()))d\(suffix)"
    }

    /// The same, spelled out for VoiceOver ("4 minutes ago").
    static func spokenAgo(_ date: Date?, now: Date = .now) -> String {
        guard let date else { return "a while ago" }
        let minutes = Int((now.timeIntervalSince(date) / 60).rounded())
        if minutes < 1 { return "just now" }
        if minutes < 60 { return minutes == 1 ? "1 minute ago" : "\(minutes) minutes ago" }
        let hours = Int((Double(minutes) / 60).rounded())
        if hours < 24 { return hours == 1 ? "1 hour ago" : "\(hours) hours ago" }
        let days = Int((Double(hours) / 24).rounded())
        return days == 1 ? "1 day ago" : "\(days) days ago"
    }
}

// MARK: - Mac refresh

extension View {
    /// On the Mac (no pull to refresh): a Refresh toolbar button, and View > Refresh (⌘R)
    /// reloads this screen too while it's on screen. Nothing extra on iPhone and iPad.
    func adminRefreshControl(isLoading: Bool, action: @escaping @MainActor () -> Void) -> some View {
        modifier(AdminRefreshControl(isLoading: isLoading, action: action))
    }

    /// Offers the matching learnfrc.com page to Handoff while this screen is on show. The site
    /// checks the role again when it's opened.
    func adminHandoff(_ destination: AdminDestination, isOnShow: Bool) -> some View {
        userActivity(NSUserActivityTypeBrowsingWeb, isActive: isOnShow) { activity in
            activity.webpageURL = destination.webURL
            activity.title = destination.title
            activity.isEligibleForHandoff = true
            activity.isEligibleForSearch = false
            #if os(iOS)
            activity.isEligibleForPrediction = false
            #endif
        }
    }
}

private struct AdminRefreshControl: ViewModifier {
    let isLoading: Bool
    let action: @MainActor () -> Void

    #if os(macOS)
    @Environment(AppModel.self) private var app: AppModel?
    @State private var isOnScreen = false
    #endif

    func body(content: Content) -> some View {
        #if os(macOS)
        content
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { action() } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                    .help("Refresh (Command-R)")
                }
            }
            .onAppear { isOnScreen = true }
            .onDisappear { isOnScreen = false }
            .onChange(of: app?.isRefreshingAll ?? false) { _, refreshing in
                if refreshing, isOnScreen, !isLoading { action() }
            }
        #else
        content
        #endif
    }
}
