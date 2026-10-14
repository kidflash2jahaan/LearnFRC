import SwiftUI

/// A GFM table as the site draws it (`.nb-prose table`): Space Mono header over a
/// 2pt ink rule, dashed hairlines between rows, tabular figures. Columns are
/// sized like a browser's auto table layout: when everything fits on one line
/// the columns share the full width; when it doesn't, long columns wrap; and
/// only when even that can't fit does the table scroll sideways.
///
/// The width it may use is measured from the scroll view and kept in state, and that can't
/// loop: the scroll view's width only ever comes from the space it's offered (its ideal width
/// is fixed, never its content's), so the columns worked out from it can't change it. The
/// width is kept in whole points, so a fraction of a point of rounding can't re-run layout.
struct MarkdownTableView: View {
    let table: MarkdownTable
    let context: MarkdownRenderContext

    @State private var availableWidth: CGFloat = 0
    @ScaledMetric(relativeTo: .subheadline) private var minColumnWidth: CGFloat = 116
    @ScaledMetric(relativeTo: .subheadline) private var scrollingColumnWidth: CGFloat = 176
    @ScaledMetric(relativeTo: .subheadline) private var cellPadding: CGFloat = 10
    @ScaledMetric(relativeTo: .subheadline) private var columnGap: CGFloat = 13

    var body: some View {
        ScrollView(.horizontal) {
            MarkdownTableLayout(
                columns: table.columnCount,
                availableWidth: availableWidth,
                minColumnWidth: minColumnWidth,
                scrollingColumnWidth: scrollingColumnWidth
            ) {
                ForEach(Array(table.header.enumerated()), id: \.offset) { column, cell in
                    cellView(cell, column: column, header: true)
                }
                ForEach(Array(table.rows.enumerated()), id: \.offset) { _, row in
                    ForEach(Array(row.enumerated()), id: \.offset) { column, cell in
                        cellView(cell, column: column, header: false)
                    }
                }
            }
            .accessibilityHidden(true)
        }
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .scrollIndicators(.automatic)
        .moreToTheRightFade()
        // Asked for its ideal size (a fixed-size or fitting parent), a horizontal scroll view
        // would answer with its content's width, which depends on `availableWidth`. A fixed
        // ideal keeps the measured width coming from outside the table only.
        .frame(minWidth: 0, idealWidth: minColumnWidth * CGFloat(max(1, table.columnCount)), maxWidth: .infinity)
        .onGeometryChange(for: CGFloat.self) { $0.size.width.rounded(.down) } action: { width in
            if width != availableWidth { availableWidth = width }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Table, \(table.rows.count) \(table.rows.count == 1 ? "row" : "rows")")
        .accessibilityChildren {
            ForEach(Array(rowSummaries.enumerated()), id: \.offset) { _, summary in
                Text(summary)
            }
        }
    }

    private func cellView(_ cell: MarkdownInline, column: Int, header: Bool) -> some View {
        let alignment = table.alignments.indices.contains(column) ? table.alignments[column] : .leading
        let isLast = column == table.columnCount - 1
        return MarkdownInlineText(content: cell, context: context)
            .lineSpacing(header ? 1 : 3)
            .monospacedDigit()
            .multilineTextAlignment(alignment.text)
            .padding(.vertical, cellPadding)
            .padding(.trailing, isLast ? 0 : columnGap)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: Alignment(horizontal: alignment.horizontal, vertical: .top))
            .overlay(alignment: .bottom) {
                if header {
                    InkRule()
                } else {
                    DashedRule()
                }
            }
    }

    /// "Line item: Season registration. Estimate: $6,500." for VoiceOver, one per row.
    private var rowSummaries: [String] {
        let headers = table.header.map(\.plainText)
        return table.rows.map { row in
            row.enumerated().map { column, cell in
                let header = headers.indices.contains(column) ? headers[column] : ""
                let value = cell.plainText.isEmpty ? "blank" : cell.plainText
                return header.isEmpty ? value : "\(header): \(value)"
            }.joined(separator: ". ")
        }
    }
}

private extension MarkdownTable.Alignment {
    var text: TextAlignment {
        switch self {
        case .leading: .leading
        case .center: .center
        case .trailing: .trailing
        }
    }

    var horizontal: HorizontalAlignment {
        switch self {
        case .leading: .leading
        case .center: .center
        case .trailing: .trailing
        }
    }
}

/// Lays cells out row by row. Subviews are the header cells, then each body
/// row's cells, `columns` at a time.
struct MarkdownTableLayout: Layout {
    let columns: Int
    /// The width the table may use without scrolling (0 until measured).
    let availableWidth: CGFloat
    /// Narrowest a wrapping column gets before the table scrolls instead.
    let minColumnWidth: CGFloat
    /// Widest a long column gets once the table scrolls anyway.
    let scrollingColumnWidth: CGFloat

    struct Cache {
        var key: CGFloat = -1
        var widths: [CGFloat] = []
        var heights: [CGFloat] = []
    }

    func makeCache(subviews: Subviews) -> Cache { Cache() }

    func updateCache(_ cache: inout Cache, subviews: Subviews) {
        cache = Cache()
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) -> CGSize {
        measure(subviews: subviews, cache: &cache)
        return CGSize(width: cache.widths.reduce(0, +), height: cache.heights.reduce(0, +))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Cache) {
        measure(subviews: subviews, cache: &cache)
        guard columns > 0 else { return }
        var y = bounds.minY
        for (row, height) in cache.heights.enumerated() {
            var x = bounds.minX
            for column in 0..<columns {
                let index = row * columns + column
                guard index < subviews.count else { break }
                let width = cache.widths[column]
                subviews[index].place(
                    at: CGPoint(x: x, y: y),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(width: width, height: height)
                )
                x += width
            }
            y += height
        }
    }

    private func measure(subviews: Subviews, cache: inout Cache) {
        let target = availableWidth > 0 ? availableWidth : 320
        guard cache.key != target || cache.widths.count != columns else { return }
        cache.key = target
        guard columns > 0, !subviews.isEmpty else {
            cache.widths = []
            cache.heights = []
            return
        }
        let rows = (subviews.count + columns - 1) / columns

        // Each column's natural (one-line) width, and its header's (headers don't wrap).
        var ideal = Array(repeating: CGFloat(0), count: columns)
        var header = Array(repeating: CGFloat(0), count: columns)
        for (index, subview) in subviews.enumerated() {
            let column = index % columns
            let width = ceil(subview.sizeThatFits(.unspecified).width)
            ideal[column] = max(ideal[column], width)
            if index < columns { header[column] = width }
        }

        let widths = Self.columnWidths(
            ideal: ideal, header: header, available: target,
            minimum: minColumnWidth, scrolling: scrollingColumnWidth
        )

        var heights = Array(repeating: CGFloat(0), count: rows)
        for (index, subview) in subviews.enumerated() {
            let row = index / columns
            let size = subview.sizeThatFits(ProposedViewSize(width: widths[index % columns], height: nil))
            heights[row] = max(heights[row], ceil(size.height))
        }
        cache.widths = widths
        cache.heights = heights
    }

    /// Fits columns into `available`, like a browser's auto table layout:
    /// - everything fits on one line: natural widths, spread to fill;
    /// - otherwise short columns keep their width and long ones share what's
    ///   left and wrap, never narrower than `minimum` or their header;
    /// - and if even that doesn't fit, the table scrolls, so long columns get
    ///   a comfortable `scrolling` width instead of being squeezed.
    static func columnWidths(ideal: [CGFloat], header: [CGFloat], available: CGFloat, minimum: CGFloat, scrolling: CGFloat) -> [CGFloat] {
        let total = ideal.reduce(0, +)
        guard total > 0 else { return ideal }
        if total <= available {
            let scale = available / total
            return ideal.map { $0 * scale }
        }
        let floors = ideal.indices.map { max(min(ideal[$0], minimum), min(header[$0], ideal[$0])) }

        var widths = ideal
        var open = Set(ideal.indices)
        var remaining = available
        while !open.isEmpty {
            let share = remaining / CGFloat(open.count)
            let fitting = open.filter { ideal[$0] <= share }
            if fitting.isEmpty { break }
            for column in fitting {
                widths[column] = ideal[column]
                remaining -= ideal[column]
                open.remove(column)
            }
        }
        if !open.isEmpty {
            let share = remaining / CGFloat(open.count)
            for column in open {
                widths[column] = max(share, floors[column])
            }
        }
        if widths.reduce(0, +) <= available + 0.5 {
            return widths
        }
        // It scrolls either way: give the long columns room to breathe.
        return ideal.indices.map { max(min(ideal[$0], scrolling), floors[$0]) }
    }
}

// MARK: - Scroll hint

private struct MoreToTheRightFade: ViewModifier {
    @State private var hasMore = false
    @ScaledMetric(relativeTo: .body) private var fadeWidth: CGFloat = 28

    func body(content: Content) -> some View {
        content
            .onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.contentSize.width - (geometry.contentOffset.x + geometry.containerSize.width) > 2
            } action: { _, more in
                hasMore = more
            }
            .mask {
                HStack(spacing: 0) {
                    Rectangle()
                    LinearGradient(colors: [.black, .black.opacity(hasMore ? 0 : 1)], startPoint: .leading, endPoint: .trailing)
                        .frame(width: fadeWidth)
                }
            }
    }
}

extension View {
    /// Fades the trailing edge of a horizontal scroll view while more content
    /// sits off to the right, so a wide table or long code line reads as scrollable.
    func moreToTheRightFade() -> some View {
        modifier(MoreToTheRightFade())
    }
}
