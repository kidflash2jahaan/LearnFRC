import SwiftUI

// Small helpers private to the Home feature: wording, formatting, and the
// pieces of furniture Home draws more than once.

// MARK: - Copy

/// Wording rules Home applies on top of what the stores hand it.
enum HomeCopy {
    /// The server's rhythm copy without em dashes (the app's copy rule).
    /// The site writes "One down — that was the hard one"; the app shows
    /// "One down. That was the hard one", the same rewrite `RhythmCalculator`
    /// uses for guests, so a signed-in learner and a guest read the same sentences.
    static func plain(_ text: String) -> String {
        let dash: Character = "\u{2014}"
        guard text.contains(dash) else { return text }
        let parts = text.split(separator: dash, omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
        var result = parts.first ?? ""
        for part in parts.dropFirst() where !part.isEmpty {
            if result.isEmpty {
                result = part
                continue
            }
            let endsWithStop = result.last.map { ".!?:;,".contains($0) } ?? false
            result += (endsWithStop ? " " : ". ") + part.prefix(1).uppercased() + part.dropFirst()
        }
        return result
    }

    static func plain(_ copy: RhythmCopy) -> RhythmCopy {
        RhythmCopy(eyebrow: plain(copy.eyebrow), headline: plain(copy.headline), body: plain(copy.body), cta: plain(copy.cta))
    }

    /// "1 lesson", "12 lessons".
    static func count(_ n: Int, _ singular: String, _ plural: String? = nil) -> String {
        "\(n.formatted()) \(n == 1 ? singular : (plural ?? singular + "s"))"
    }

    /// The streak's XP multiplier as the site prints it ("1.4"): 10 XP a lesson plus 1 per
    /// streak day after the first, capped at 20.
    static func xpMultiplier(streak: Int) -> String {
        let value = 1 + Double(min(10, max(0, streak - 1))) / 10
        return value.formatted(.number.precision(.fractionLength(1)))
    }

    /// "oct 2, 2026": an article's date in the slug style. Articles carry a calendar date,
    /// so it's formatted in UTC to keep it from slipping a day west of Greenwich.
    static func articleDate(_ article: Article) -> String? {
        guard let date = article.publishedDate else { return nil }
        let style = Date.FormatStyle(date: .abbreviated, time: .omitted, timeZone: .gmt)
        return date.formatted(style).lowercased()
    }

    /// "25 min".
    static func minutes(_ minutes: Int) -> String? {
        minutes > 0 ? "\(minutes) min" : nil
    }

    /// A summary shown whole on a card. Lesson summaries and article descriptions run a
    /// sentence or two (under 200 characters), so they wrap rather than being clamped to a
    /// line count, which cut them off mid-word at the largest text sizes ("100-po…"). One
    /// that's unusually long is shortened after the last whole word that fits.
    static func teaser(_ text: String, limit: Int = 240) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > limit else { return trimmed }
        let head = trimmed.prefix(limit)
        var result = String(head[..<(head.lastIndex(where: \.isWhitespace) ?? head.endIndex)])
        while let last = result.last, last.isWhitespace || ",;:-(".contains(last) {
            result.removeLast()
        }
        return result + "…"
    }

    /// How to ask for a refresh on this device.
    static var retry: String {
        #if os(macOS)
        "Press Command-R to try again."
        #else
        "Pull down to try again."
        #endif
    }
}

// MARK: - Layout

/// How much room Home has, decided once at the top and passed down.
struct HomeLayout: Equatable {
    /// The full scroll view width.
    var width: CGFloat
    /// Accessibility text sizes stack everything into one column.
    var largeType: Bool
    /// The page's leading and trailing margins (asymmetric next to iPhone Duo's vertical bar).
    var margins: LF.PageMargins
    /// iPhone Duo's two pages across the content, with the inner screen held upright: the
    /// columns meet either side of the crease. Nil everywhere else.
    var pages: FoldColumns?
    /// iPhone Duo held sideways: where the crease's band runs across the page, from the top of
    /// the page's content as it rests before any scrolling. Nil everywhere else.
    var bandAcross: ClosedRange<CGFloat>?

    /// The space above the page's content, inside the scroll view.
    static func topPadding(wide: Bool) -> CGFloat { wide ? 30 : 16 }

    init(width: CGFloat, largeType: Bool, margins: LF.PageMargins? = nil, fold: FoldInfo = .none) {
        self.width = width
        self.largeType = largeType
        let margins = margins ?? LF.Metrics.pageMargins(for: width)
        self.margins = margins
        let fits = width - margins.total <= LF.Metrics.maxContentWidth
        let pages = fits ? fold.columns(from: margins.leading, to: width - margins.trailing) : nil
        self.pages = pages
        if fold.isHorizontal, let band = fold.band {
            // The page's content starts at the top of the scroll view at rest, under its padding.
            let top = Self.topPadding(wide: false)
            bandAcross = (band.minY - top)...(band.maxY - top)
        } else {
            bandAcross = nil
        }
    }

    var gutter: CGFloat { LF.Metrics.gutter(for: width) }
    /// The page's content width (`nb-wrap`).
    var contentWidth: CGFloat { max(0, min(width - margins.total, LF.Metrics.maxContentWidth)) }
    /// Two columns on iPad, Mac and big phones in landscape, and on iPhone Duo's two pages
    /// (each page is phone-width, so at any text size).
    var isWide: Bool { pages != nil || (contentWidth >= 760 && !largeType) }
    var columnSpacing: CGFloat { pages?.gap ?? (contentWidth >= 1000 ? 40 : 28) }
    /// The narrower right-hand column.
    var sideWidth: CGFloat { pages?.trailing ?? min(440, max(300, (contentWidth - columnSpacing) * 0.39)) }
    var mainWidth: CGFloat {
        if let pages { return pages.leading }
        return isWide ? contentWidth - columnSpacing - sideWidth : contentWidth
    }
    /// Space between stacked sections.
    var stackSpacing: CGFloat { isWide ? 36 : 30 }
    /// The h1 on the masthead, sized for the column it's in.
    var headlineSize: CGFloat {
        let room = pages?.leading ?? contentWidth
        return room >= 900 ? 50 : (room >= 600 ? 42 : 34)
    }
}

/// Home's sections down the page, like a `VStack`, with one allowance for iPhone Duo held
/// sideways: a section that would lie across the crease's band as the page rests starts just
/// below it instead, so the fold falls between two sections rather than through a card.
/// Only when that leaves a modest gap (never for the first section, never more than about a
/// card's worth of paper); a section with nothing to show takes no space and no spacing.
struct HomeStackLayout: Layout {
    var spacing: CGFloat
    /// The band, in this stack's own coordinates.
    var avoiding: ClosedRange<CGFloat>?

    /// The most empty paper the stack leaves above the band to keep a section off it.
    private static let largestGap: CGFloat = 220

    private func arrange(width: CGFloat?, subviews: Subviews) -> (origins: [CGFloat?], heights: [CGFloat], height: CGFloat) {
        var origins: [CGFloat?] = []
        var heights: [CGFloat] = []
        var y: CGFloat = 0
        var placed = 0
        var pushed = false
        for subview in subviews {
            let height = subview.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
            guard height > 0 else {
                origins.append(nil)
                heights.append(0)
                continue
            }
            var top = placed == 0 ? y : y + spacing
            if let band = avoiding, !pushed, placed > 0,
               top < band.upperBound, top + height > band.lowerBound,
               band.upperBound - top <= Self.largestGap {
                top = band.upperBound
                pushed = true
            }
            origins.append(top)
            heights.append(height)
            y = top + height
            placed += 1
        }
        return (origins, heights, y)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let arranged = arrange(width: proposal.width, subviews: subviews)
        let width = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        return CGSize(width: width, height: arranged.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let arranged = arrange(width: bounds.width, subviews: subviews)
        for index in subviews.indices {
            if let y = arranged.origins[index] {
                subviews[index].place(at: CGPoint(x: bounds.minX, y: bounds.minY + y), anchor: .topLeading,
                                      proposal: ProposedViewSize(width: bounds.width, height: arranged.heights[index]))
            } else {
                subviews[index].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
            }
        }
    }
}

// MARK: - Type

extension View {
    /// A Bricolage 800 headline at any size, with the site's heading tracking and leading.
    /// `lfTitle` covers the three fixed levels; Home's headlines scale with the window.
    func homeTitle(_ size: CGFloat, relativeTo style: Font.TextStyle = .title2, color: Color = LF.Palette.ink) -> some View {
        self
            .font(LF.Fonts.display(size, relativeTo: style))
            .tracking(size * -0.025)
            .lineHeight(.multiple(factor: size >= 24 ? 1.0 : 1.08))
            .foregroundStyle(color)
            .accessibilityAddTraits(.isHeader)
    }

    /// Graphite running text under a heading (`nb-sub` and `nb-lede`).
    func homeSub(_ size: CGFloat = 16.5) -> some View {
        self
            .font(LF.Fonts.body(size))
            .lineHeight(.multiple(factor: 1.5))
            .foregroundStyle(LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - Furniture

/// A section heading on the paper: the mono marker above a Bricolage headline.
struct HomeSectionHeader: View {
    let marker: String
    let title: String
    var detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(marker)
            Text(title)
                .homeTitle(23)
                .fixedSize(horizontal: false, vertical: true)
            if let detail {
                Text(detail)
                    .lfProse(15.5, lineHeight: 1.45, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The small primary button drawn as part of a card that is itself the link. It looks
/// exactly like `.inkSmall` (it is one) but takes no taps, so the whole card stays the target
/// and VoiceOver hears one link, not two.
struct HomeButtonFace: View {
    let title: String
    var systemImage: String?
    var ghost = false

    var body: some View {
        Button {} label: {
            HStack(spacing: 6) {
                Text(title)
                if let systemImage {
                    Image(systemName: systemImage)
                        .imageScale(.small)
                        .fontWeight(.bold)
                }
            }
        }
        .buttonStyle(ghost ? InkButtonStyle(.ghost, size: .small) : InkButtonStyle(.primary, size: .small))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// A quiet text button (`nb-navlink`): mono, ink, underlined under a pointer. For the third,
/// least important choice in a row ("Ask me later").
struct HomeTextButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        HomeTextButton(configuration: configuration)
    }
}

private struct HomeTextButton: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.isEnabled) private var isEnabled
    @State private var isHovering = false

    var body: some View {
        configuration.label
            .font(LF.Fonts.mono(13, relativeTo: .footnote))
            .underline(isHovering || configuration.isPressed, color: LF.Palette.blue)
            .foregroundStyle(isEnabled ? LF.Palette.ink : LF.Palette.graphite)
            .padding(.horizontal, 6)
            .frame(minHeight: LF.Metrics.tap)
            .contentShape(Rectangle())
            .onHover { isHovering = $0 }
            #if os(iOS)
            .hoverEffectDisabled()
            #endif
    }
}

extension ButtonStyle where Self == HomeTextButtonStyle {
    static var homeText: HomeTextButtonStyle { HomeTextButtonStyle() }
}

/// A vertical dashed hairline, for the rule between a card's main column and its figure.
struct HomeDashedColumnRule: View {
    var body: some View {
        HomeVerticalLine()
            .stroke(LF.Palette.rule, style: StrokeStyle(lineWidth: LF.Metrics.hairline, dash: [3, 3]))
            .frame(width: LF.Metrics.hairline)
            .frame(maxHeight: .infinity)
            .accessibilityHidden(true)
    }
}

private struct HomeVerticalLine: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        return p
    }
}

/// An SF Symbol in a small hand-ruled box, the way the site frames a badge icon.
struct HomeIconBox: View {
    let systemImage: String
    var filled = false
    @ScaledMetric(relativeTo: .title3) private var side: CGFloat = 46

    var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: side * 0.42, weight: .semibold))
            .foregroundStyle(filled ? LF.Palette.onBlue : LF.Palette.ink)
            .frame(width: side, height: side)
            .background {
                ZStack {
                    HandShape(.s).fill(filled ? LF.Palette.blueButton : LF.Palette.paper)
                    HandShape(.s).strokeBorder(filled ? LF.Palette.blueButton : LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                }
            }
            .accessibilityHidden(true)
    }
}

/// Lays children out in a row when they fit and wraps them onto new lines when they
/// don't, like the site's `flex flex-wrap`. Keeps button rows readable at large text sizes.
/// A child too wide for a line of its own gets the line's width and wraps inside it (a
/// long kicker at the largest text sizes), rather than being cut to one line.
struct HomeFlowLayout: Layout {
    var spacing: CGFloat = 10
    var lineSpacing: CGFloat = 10

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let width = rows.map(\.width).max() ?? 0
        let height = rows.reduce(0) { $0 + $1.height } + CGFloat(max(0, rows.count - 1)) * lineSpacing
        return CGSize(width: proposal.width.map { min($0, width) } ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for (index, size) in row.items {
                subviews[index].place(
                    at: CGPoint(x: x, y: y + (row.height - size.height) / 2),
                    proposal: ProposedViewSize(size)
                )
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private struct Row {
        var items: [(index: Int, size: CGSize)] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    /// A child's size: its natural one, or wrapped to the line when that's too wide.
    private func size(of subview: LayoutSubview, maxWidth: CGFloat) -> CGSize {
        let natural = subview.sizeThatFits(.unspecified)
        guard natural.width > maxWidth else { return natural }
        let wrapped = subview.sizeThatFits(ProposedViewSize(width: maxWidth, height: nil))
        return CGSize(width: min(wrapped.width, maxWidth), height: wrapped.height)
    }

    private func arrange(width maxWidth: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let itemSize = size(of: subviews[index], maxWidth: maxWidth)
            let needed = current.items.isEmpty ? itemSize.width : current.width + spacing + itemSize.width
            if needed > maxWidth, !current.items.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.width = current.items.isEmpty ? itemSize.width : current.width + spacing + itemSize.width
            current.height = max(current.height, itemSize.height)
            current.items.append((index, itemSize))
        }
        if !current.items.isEmpty { rows.append(current) }
        return rows
    }
}

// MARK: - The tally's grid

/// Equal columns, up to `maxColumns`, but never so many that a label has to break inside a
/// word ("departme / nts open" at the largest text sizes). The first subview is a hidden
/// probe: the longest single word any cell prints, in the cells' own type. The grid drops a
/// column at a time until that word fits on a line, so the choice follows the real text size
/// and the real width (iPhone, the iPad side column, a narrow Mac window) instead of a
/// guessed Dynamic Type threshold. Rows are as tall as their tallest cell.
struct HomeTallyGrid: Layout {
    var maxColumns: Int
    var spacing: CGFloat = 16

    private struct Grid {
        var columns: Int
        var columnWidth: CGFloat
        var rowHeights: [CGFloat]
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> Grid {
        let word = subviews.first.map { $0.sizeThatFits(.unspecified).width.rounded(.up) } ?? 0
        var columns = max(1, maxColumns)
        func columnWidth(_ count: Int) -> CGFloat {
            max(0, (width - spacing * CGFloat(count - 1)) / CGFloat(count))
        }
        while columns > 1, columnWidth(columns) < word {
            columns -= 1
        }
        let cellWidth = columnWidth(columns)
        var rows: [CGFloat] = []
        for (offset, cell) in subviews.dropFirst().enumerated() {
            let height = cell.sizeThatFits(ProposedViewSize(width: cellWidth, height: nil)).height
            if offset % columns == 0 {
                rows.append(height)
            } else {
                rows[rows.count - 1] = max(rows[rows.count - 1], height)
            }
        }
        return Grid(columns: columns, columnWidth: cellWidth, rowHeights: rows)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? idealWidth(subviews)
        let grid = arrange(width: width, subviews: subviews)
        let height = grid.rowHeights.reduce(0, +) + spacing * CGFloat(max(0, grid.rowHeights.count - 1))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let probe = subviews.first else { return }
        probe.place(at: bounds.origin, anchor: .topLeading, proposal: .unspecified)
        let grid = arrange(width: bounds.width, subviews: subviews)
        var y = bounds.minY
        for (offset, cell) in subviews.dropFirst().enumerated() {
            let row = offset / grid.columns
            let column = offset % grid.columns
            if column == 0, row > 0 {
                y += grid.rowHeights[row - 1] + spacing
            }
            cell.place(
                at: CGPoint(x: bounds.minX + CGFloat(column) * (grid.columnWidth + spacing), y: y),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: grid.columnWidth, height: nil)
            )
        }
    }

    /// With no width offered: every column as wide as the widest cell would like.
    private func idealWidth(_ subviews: Subviews) -> CGFloat {
        let columns = CGFloat(max(1, maxColumns))
        let widest = subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        return widest * columns + spacing * (columns - 1)
    }
}

// MARK: - Two columns

/// Which of Home's two columns (iPad and Mac) a section goes in.
enum HomeColumn: Sendable {
    /// The lesson and the week: always on the left.
    case main
    /// The account, the badge and the team: always on the right.
    case side
    /// A shelf that reads the same at either width: placed by `HomeColumnsLayout`.
    case either
}

private struct HomeColumnKey: LayoutValueKey {
    static let defaultValue = HomeColumn.either
}

extension View {
    /// Tags a Home section with the column it belongs in (see `HomeColumnsLayout`).
    func homeColumn(_ column: HomeColumn) -> some View {
        layoutValue(key: HomeColumnKey.self, value: column)
    }
}

/// Home's two columns on iPad and Mac. Sections tagged `.main` stack on the left and
/// `.side` on the right, each in the order written; then each `.either` section (bookmarks,
/// the start question, the articles) goes to whichever column is shorter at that point.
/// What's on the page changes a lot between a guest, a new account and a regular, and a
/// fixed split left one column ending some 800pt above the other; this keeps the two
/// within about one section of each other.
struct HomeColumnsLayout: Layout {
    var mainWidth: CGFloat
    var sideWidth: CGFloat
    var columnSpacing: CGFloat
    /// Between stacked sections in a column.
    var spacing: CGFloat

    private struct Placement {
        let index: Int
        let origin: CGPoint
        let size: CGSize
    }

    private func arrange(_ subviews: Subviews) -> (placements: [Placement], height: CGFloat) {
        var heights: [CGFloat] = [0, 0]
        var counts = [0, 0]
        var placements: [Placement] = []

        func place(_ index: Int, column: Int) {
            let width = column == 0 ? mainWidth : sideWidth
            let height = subviews[index].sizeThatFits(ProposedViewSize(width: width, height: nil)).height
            guard height > 0 else { return }
            let y = heights[column] + (counts[column] > 0 ? spacing : 0)
            let x = column == 0 ? 0 : mainWidth + columnSpacing
            placements.append(Placement(index: index, origin: CGPoint(x: x, y: y), size: CGSize(width: width, height: height)))
            heights[column] = y + height
            counts[column] += 1
        }

        let roles = subviews.map { $0[HomeColumnKey.self] }
        for index in subviews.indices where roles[index] == .main { place(index, column: 0) }
        for index in subviews.indices where roles[index] == .side { place(index, column: 1) }
        for index in subviews.indices where roles[index] == .either {
            place(index, column: heights[0] <= heights[1] ? 0 : 1)
        }
        return (placements, max(heights[0], heights[1]))
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        CGSize(width: mainWidth + columnSpacing + sideWidth, height: arrange(subviews).height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let placed = arrange(subviews)
        var shown = Set<Int>()
        for placement in placed.placements {
            shown.insert(placement.index)
            subviews[placement.index].place(
                at: CGPoint(x: bounds.minX + placement.origin.x, y: bounds.minY + placement.origin.y),
                anchor: .topLeading,
                proposal: ProposedViewSize(placement.size)
            )
        }
        // Anything with nothing to show still needs a place.
        for index in subviews.indices where !shown.contains(index) {
            subviews[index].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
        }
    }
}
