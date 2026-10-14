import SwiftUI

// Pieces shared by SearchView, GlossaryView and GlossaryTermView.

// MARK: - Highlighted text

extension SearchHighlight {
    /// The text with every match marked like a highlighter pen: ink on a blue wash, so it
    /// reads in greyscale and on graphite secondary text alike.
    var attributed: AttributedString {
        guard !ranges.isEmpty else { return AttributedString(text) }
        let bytes = Array(text.utf8)
        var out = AttributedString()
        var cursor = 0
        for range in ranges where range.lowerBound >= cursor && range.upperBound <= bytes.count {
            if range.lowerBound > cursor {
                out += AttributedString(String(decoding: bytes[cursor..<range.lowerBound], as: UTF8.self))
            }
            var match = AttributedString(String(decoding: bytes[range], as: UTF8.self))
            match.backgroundColor = LF.Palette.selectionWash
            match.foregroundColor = LF.Palette.ink
            out += match
            cursor = range.upperBound
        }
        if cursor < bytes.count {
            out += AttributedString(String(decoding: bytes[cursor...], as: UTF8.self))
        }
        return out
    }
}

// MARK: - Rows

/// A row in an `nb-list`: slug, title, crumb and a line of context. Used for lessons,
/// modules, departments and articles in results, and for the lessons on a term page.
struct SearchResultRow: View {
    let slug: String
    let title: AttributedString
    var crumb: String?
    var alias: AttributedString?
    var snippet: AttributedString?
    var snippetLines: Int = 3
    var minutes: Int?
    var hasVideo = false
    var isCompleted = false
    var systemImage: String?

    @ScaledMetric(relativeTo: .body) private var iconSize: CGFloat = 20
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                // The icon, the check and the chevron go on the eyebrow's line, so the title and
                // the snippet get the row's whole width instead of a column between them.
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .top, spacing: 12) {
                        icon
                        eyebrow
                            .frame(maxWidth: .infinity, alignment: .leading)
                        trailing
                    }
                    words(showsEyebrow: false)
                }
            } else {
                HStack(alignment: .top, spacing: 12) {
                    icon
                    words(showsEyebrow: true)
                        // A row may run the full width of a wide page; its words keep a
                        // reading measure.
                        .frame(maxWidth: LF.Metrics.readableWidth, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    trailing
                }
            }
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 12)
        .frame(minHeight: LF.Metrics.tap)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var icon: some View {
        if let systemImage {
            Image(systemName: systemImage)
                .font(.system(size: iconSize * 0.8, weight: .medium))
                .foregroundStyle(LF.Palette.ink)
                .frame(width: iconSize + 8, height: iconSize + 8)
                .background { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
                .padding(.top, 2)
                .accessibilityHidden(true)
        }
    }

    private var trailing: some View {
        HStack(spacing: 10) {
            if isCompleted {
                PenCheckMark(size: 14)
            }
            Image(systemName: "chevron.forward")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(LF.Palette.graphite)
                .accessibilityHidden(true)
        }
        .padding(.top, 3)
    }

    private func words(showsEyebrow: Bool) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            if showsEyebrow { eyebrow }
            Text(title)
                .font(LF.Fonts.body(17, weight: .semibold, relativeTo: .headline))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            if let crumb {
                Text(crumb)
                    .font(LF.Fonts.body(14, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    // Two lines hold a department and module at the regular sizes; at the
                    // accessibility sizes two lines is a word or two, so it gets more.
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? 5 : 2)
            }
            if let alias {
                SearchAliasLine(alias: alias)
            }
            if let snippet {
                Text(snippet)
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .lineHeight(.multiple(factor: 1.4))
                    .foregroundStyle(LF.Palette.graphite)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? snippetLines + 2 : snippetLines)
                    .padding(.top, 1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The slug, the minutes and the video mark on one line while they fit whole; otherwise
    /// the slug gets its own lines and the rest goes under it (no "les… · 45 min").
    private var eyebrow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                SlugText(slug)
                    .lineLimit(1)
                    .fixedSize()
                details(afterSlug: true)
            }
            VStack(alignment: .leading, spacing: 2) {
                SlugText(slug)
                    .fixedSize(horizontal: false, vertical: true)
                details(afterSlug: false)
            }
        }
    }

    /// The reading time (with a separating dot when it follows the slug on its line) and the
    /// video mark.
    @ViewBuilder
    private func details(afterSlug: Bool) -> some View {
        if minutes != nil || hasVideo {
            HStack(spacing: 8) {
                if let minutes {
                    SlugText(afterSlug ? "\u{00B7} \(minutes) min" : "\(minutes) min")
                        .lineLimit(1)
                        .fixedSize()
                }
                if hasVideo {
                    Image(systemName: "play.rectangle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(LF.Palette.graphite)
                        .accessibilityHidden(true)
                }
            }
        }
    }
}

/// "also called  Swerve" under a title, when an alias is what matched.
struct SearchAliasLine: View {
    let alias: AttributedString

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            SlugText("also called")
            Text(alias)
                .font(LF.Fonts.body(14, weight: .medium, relativeTo: .subheadline))
                .foregroundStyle(LF.Palette.ink)
        }
    }
}

/// Rows hover and press with the site's row wash and a blue bar down the left edge
/// (`nb-menu-item`), so the position reads in greyscale too.
struct SearchRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        SearchRowButtonBody(configuration: configuration)
    }
}

private struct SearchRowButtonBody: View {
    let configuration: ButtonStyleConfiguration
    @State private var isHovering = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isActive: Bool { isHovering || configuration.isPressed }

    var body: some View {
        configuration.label
            .foregroundStyle(LF.Palette.ink)
            .background(isActive ? LF.Palette.rowWash : Color.clear)
            .overlay(alignment: .leading) {
                if isActive {
                    Rectangle().fill(LF.Palette.blue).frame(width: 3)
                }
            }
            .contentShape(Rectangle())
            .onHover { isHovering = $0 }
            .animation(reduceMotion ? nil : LF.Motion.hover, value: isActive)
            #if os(macOS)
            .pointerStyle(.link)
            #else
            .hoverEffectDisabled()
            #endif
    }
}

extension ButtonStyle where Self == SearchRowButtonStyle {
    /// A row in a result list.
    static var searchRow: SearchRowButtonStyle { SearchRowButtonStyle() }
}

/// The site's `nb-list`: a 2pt ink rule above and below, dashed hairlines between rows.
/// Lazy, so a few hundred rows cost only what's on screen.
struct SearchList<Item: Identifiable, Row: View>: View {
    let items: [Item]
    @ViewBuilder var row: (Item) -> Row

    var body: some View {
        VStack(spacing: 0) {
            InkRule()
            LazyVStack(spacing: 0) {
                ForEach(items) { item in
                    row(item)
                    if item.id != items.last?.id {
                        DashedRule()
                    }
                }
            }
            InkRule()
        }
    }
}

// MARK: - Section header

/// A results section: mono kicker on the left, the figure on the right.
struct SearchSectionHeader: View {
    let title: String
    let count: Int
    var unit: String = "found"

    var body: some View {
        // The figure sits at the end of the label's line while both fit whole, and under the
        // label when they don't (the largest sizes), so "glossary" never breaks in two.
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel(title)
                    .fixedSize()
                Spacer(minLength: 12)
                CountText(count, unit: unit, size: 15)
                    .fixedSize()
            }
            VStack(alignment: .leading, spacing: 4) {
                SectionLabel(title)
                CountText(count, unit: unit, size: 15)
            }
        }
        .padding(.bottom, 10)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Glossary card

/// A glossary term as an index card: drawer slug, short form, the term, the definition,
/// and "read the entry" under a dashed rule. Used in search results, the catalogue and
/// a term's "filed next to it" wall.
struct GlossaryIndexCard: View {
    let slug: String
    let title: AttributedString
    let definition: AttributedString
    var badge: String?
    var alias: AttributedString?
    var tilt: LF.Tilt = .none
    var tape = false
    var definitionLines: Int? = 4

    var body: some View {
        NotebookCard(tilt: tilt, tape: tape, lift: true, padding: 16) {
            VStack(alignment: .leading, spacing: 0) {
                // Drawer and short form on one line while both fit whole; otherwise the
                // drawer wraps and the short form goes under it (never "competition…").
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        SlugText(slug)
                            .lineLimit(1)
                            .fixedSize()
                        Spacer(minLength: 0)
                        badgeTag
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        SlugText(slug)
                            .fixedSize(horizontal: false, vertical: true)
                        badgeTag
                    }
                }
                Text(title)
                    .lfTitle(.h3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
                if let alias {
                    SearchAliasLine(alias: alias)
                        .padding(.top, 6)
                }
                Text(definition)
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .lineHeight(.multiple(factor: 1.4))
                    .foregroundStyle(LF.Palette.graphite)
                    .lineLimit(definitionLines)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                Spacer(minLength: 14)
                DashedRule()
                SlugText("read the entry", color: LF.Palette.ink)
                    .padding(.top, 10)
                    .accessibilityHidden(true)
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
    }

    @ViewBuilder
    private var badgeTag: some View {
        if let badge {
            TagView(badge)
                .fixedSize()
                .accessibilityLabel("Short form \(badge)")
        }
    }
}

// MARK: - Top hit

/// The best match, pulled out and taped to the top of the results.
struct SearchTopHitCard: View {
    let hit: SearchHit
    var isCompleted = false

    var body: some View {
        NotebookCard(tilt: .left, tape: true, lift: true, padding: 20) {
            VStack(alignment: .leading, spacing: 0) {
                // The slug wraps rather than cut off; the short form and the check sit at the
                // end of its line while they fit, and under it when they don't.
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        SlugText("top hit / \(hit.document.slug)")
                            .lineLimit(1)
                            .fixedSize()
                        Spacer(minLength: 0)
                        marks
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        SlugText("top hit / \(hit.document.slug)")
                            .fixedSize(horizontal: false, vertical: true)
                        marks
                    }
                }
                Text(hit.title.attributed)
                    .font(LF.Fonts.display(28, relativeTo: .title))
                    .tracking(28 * -0.025)
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)
                if let crumb = hit.document.crumb {
                    Text(crumb)
                        .font(LF.Fonts.body(15, relativeTo: .subheadline))
                        .foregroundStyle(LF.Palette.graphite)
                        .padding(.top, 6)
                }
                if let alias = hit.matchedAlias {
                    SearchAliasLine(alias: alias.attributed)
                        .padding(.top, 8)
                }
                if let snippet = hit.snippet {
                    Text(snippet.attributed)
                        .font(LF.Fonts.body(16, relativeTo: .body))
                        .lineHeight(.multiple(factor: 1.5))
                        .foregroundStyle(LF.Palette.ink)
                        .lineLimit(5)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 10)
                }
                HStack(spacing: 6) {
                    Text(hit.document.kind.openLabel)
                    Image(systemName: "arrow.right")
                        .imageScale(.small)
                        .accessibilityHidden(true)
                }
                .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                .foregroundStyle(LF.Palette.blue)
                .padding(.top, 16)
                .accessibilityHidden(true)
            }
        }
    }

    @ViewBuilder
    private var marks: some View {
        if hit.document.badge != nil || isCompleted {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                if let badge = hit.document.badge {
                    TagView(badge)
                        .fixedSize()
                }
                if isCompleted {
                    PenCheckMark(size: 15)
                }
            }
        }
    }
}

// MARK: - Accessibility

nonisolated enum SearchAccessibility {
    static func label(for hit: SearchHit, isCompleted: Bool, prefix: String? = nil) -> String {
        var parts: [String] = []
        if let prefix { parts.append(prefix) }
        parts.append("\(hit.document.kind.spokenName): \(hit.document.title)")
        if let badge = hit.document.badge { parts.append("short form \(badge)") }
        if let crumb = hit.document.crumb { parts.append(crumb.replacingOccurrences(of: " / ", with: ", ")) }
        if let minutes = hit.document.minutes, hit.document.kind == .lesson { parts.append("\(minutes) minutes") }
        if hit.document.hasVideo { parts.append("has a video") }
        if isCompleted { parts.append("completed") }
        if let snippet = hit.snippet?.text, !snippet.isEmpty { parts.append(snippet) }
        return parts.joined(separator: ". ")
    }
}

// MARK: - Layout helpers

/// Lays children out left to right and wraps, like the site's flex-wrap chip rows.
struct SearchFlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rows = arrange(subviews, width: width)
        let height = rows.reduce(0) { $0 + $1.height } + CGFloat(max(0, rows.count - 1)) * lineSpacing
        let usedWidth = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? usedWidth, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(subviews, width: bounds.width)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            if needed > width, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.width = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            current.height = max(current.height, size.height)
            current.indices.append(index)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}

/// A grid whose rows are as tall as their tallest card, so a row of index cards lines up
/// along the bottom like the site's flex grid.
struct SearchCardGrid<Item: Identifiable, Cell: View>: View {
    let items: [Item]
    let columns: Int
    var spacing: CGFloat = 20
    @ViewBuilder var cell: (Int, Item) -> Cell

    var body: some View {
        let columns = max(1, columns)
        let rows = stride(from: 0, to: items.count, by: columns).map { start in
            Array(items.indices[start..<min(start + columns, items.count)])
        }
        Grid(horizontalSpacing: spacing, verticalSpacing: spacing + 4) {
            ForEach(rows, id: \.first) { row in
                GridRow(alignment: .top) {
                    ForEach(row, id: \.self) { index in
                        cell(index, items[index])
                            .frame(maxHeight: .infinity, alignment: .top)
                    }
                    if row.count < columns {
                        ForEach(0..<(columns - row.count), id: \.self) { _ in
                            Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
                        }
                    }
                }
            }
        }
        // Its own height, never stretched by a taller neighbour in an HStack.
        .fixedSize(horizontal: false, vertical: true)
    }
}

extension View {
    /// Page width rules: content never wider than `maxWidth`, gutters that grow with the window.
    func searchPage(width: CGFloat, maxWidth: CGFloat = LF.Metrics.maxContentWidth) -> some View {
        self
            .padding(.horizontal, LF.Metrics.gutter(for: width))
            .frame(maxWidth: maxWidth, alignment: .leading)
            .frame(maxWidth: .infinity)
    }

    /// The same page width rules, worked out during layout from the width the page is offered,
    /// so the screen never stores a measured width (a stored width can feed back into layout).
    func searchPage(maxWidth: CGFloat = LF.Metrics.maxContentWidth) -> some View {
        SearchPageLayout(maxWidth: maxWidth) { self }
    }
}

// MARK: - Layout-time width rules

/// Centres its one child in at most `maxWidth`, inset by `LF.Metrics.gutter(for:)` of the
/// width it's offered. The layout twin of `searchPage(width:)`.
struct SearchPageLayout: Layout {
    var maxWidth: CGFloat = LF.Metrics.maxContentWidth

    /// The child's leading offset and width for a page this wide.
    private func column(for width: CGFloat) -> (offset: CGFloat, width: CGFloat) {
        let page = min(width, maxWidth)
        let gutter = LF.Metrics.gutter(for: max(width, 320))
        return ((width - page) / 2 + gutter, max(0, page - 2 * gutter))
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let child = subviews.first else { return .zero }
        let width = proposal.width ?? min(child.sizeThatFits(.unspecified).width + 2 * LF.Metrics.gutter, maxWidth)
        let inner = column(for: width)
        let height = child.sizeThatFits(ProposedViewSize(width: inner.width, height: nil)).height
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let child = subviews.first else { return }
        let inner = column(for: bounds.width)
        child.place(
            at: CGPoint(x: bounds.minX + inner.offset, y: bounds.minY),
            anchor: .topLeading,
            proposal: ProposedViewSize(width: inner.width, height: nil)
        )
    }
}

/// A grid that picks its column count from the width it's offered, during layout. Cells in a
/// row are offered the tallest cell's height, so cards in a row line up.
struct SearchColumnsLayout: Layout {
    /// The fewest points of content width for a column count.
    struct Breakpoint: Sendable {
        let minWidth: CGFloat
        let columns: Int
    }

    var breakpoints: [Breakpoint]
    var spacing: CGFloat = 20
    var rowSpacing: CGFloat = 24

    /// Card grids on a search page: two columns from a 600pt page, three from 1000pt
    /// (the content widths those pages leave inside their gutters).
    static let cards: [Breakpoint] = [Breakpoint(minWidth: 552, columns: 2), Breakpoint(minWidth: 920, columns: 3)]

    func columns(for width: CGFloat) -> Int {
        breakpoints.filter { width >= $0.minWidth }.map(\.columns).max() ?? 1
    }

    private func rows(_ subviews: Subviews, width: CGFloat) -> (columnWidth: CGFloat, heights: [CGFloat], columns: Int) {
        let columns = max(1, columns(for: width))
        let columnWidth = max(0, (width - spacing * CGFloat(columns - 1)) / CGFloat(columns))
        var heights: [CGFloat] = []
        var start = 0
        while start < subviews.count {
            let end = min(start + columns, subviews.count)
            let tallest = (start..<end).map { subviews[$0].sizeThatFits(ProposedViewSize(width: columnWidth, height: nil)).height }.max() ?? 0
            heights.append(tallest)
            start = end
        }
        return (columnWidth, heights, columns)
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
        let layout = rows(subviews, width: width)
        let height = layout.heights.reduce(0, +) + rowSpacing * CGFloat(max(0, layout.heights.count - 1))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let layout = rows(subviews, width: bounds.width)
        var y = bounds.minY
        for (row, height) in layout.heights.enumerated() {
            for column in 0..<layout.columns {
                let index = row * layout.columns + column
                guard index < subviews.count else { break }
                let x = bounds.minX + CGFloat(column) * (layout.columnWidth + spacing)
                subviews[index].place(
                    at: CGPoint(x: x, y: y),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(width: layout.columnWidth, height: height)
                )
            }
            y += height + rowSpacing
        }
    }
}

/// `SearchCardGrid` with the column count chosen during layout (one column at the
/// accessibility text sizes). Use it on screens that would otherwise measure their width.
struct SearchAdaptiveGrid<Item: Identifiable, Cell: View>: View {
    let items: [Item]
    var breakpoints: [SearchColumnsLayout.Breakpoint] = SearchColumnsLayout.cards
    var spacing: CGFloat = 20
    @ViewBuilder var cell: (Int, Item) -> Cell

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        SearchColumnsLayout(
            breakpoints: dynamicTypeSize.isAccessibilitySize ? [] : breakpoints,
            spacing: spacing,
            rowSpacing: spacing + 4
        ) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                cell(index, item)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
        }
    }
}

/// Shows `wide` when the width offered is at least `minWidth`, otherwise `narrow`, decided
/// during layout (`ViewThatFits`), so nothing measured is stored.
struct SearchWidthSwitch<Wide: View, Narrow: View>: View {
    let minWidth: CGFloat
    @ViewBuilder var wide: Wide
    @ViewBuilder var narrow: Narrow

    var body: some View {
        ViewThatFits(in: .horizontal) {
            wide.frame(minWidth: minWidth, idealWidth: minWidth, maxWidth: .infinity, alignment: .leading)
            narrow
        }
    }
}
