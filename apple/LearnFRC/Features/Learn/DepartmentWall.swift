import SwiftUI

// The department wall: every department as an index card taped up, the way /guides
// draws it. One column on a phone, two from about 560pt, and the site's twelve-column
// wall (widths varying so the wall has a reading order) from about 1000pt. Larger text
// drops columns: no card is ever narrower than its text needs.

/// The cards, laid out as the site's `CatalogueWall`. Each card opens its department.
struct LearnDepartmentWall: View {
    let departments: [Department]
    let layout: LearnLayout

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The narrowest a card may be: 200pt at the default text size (the wall's three-span
    /// cards are about 230pt at 1000pt), growing with Dynamic Type, so from about xxLarge
    /// the wall becomes two columns, and one once two would be narrower than this.
    @ScaledMetric(relativeTo: .body) private var minimumCardWidth: CGFloat = 200

    private var spacing: CGFloat { layout.isRegular ? 22 : 18 }

    private var columns: LearnWallLayout.Columns {
        let width = layout.contentWidth
        if layout.isWall, LearnWallLayout.narrowestWallCard(in: width, spacing: spacing) >= minimumCardWidth {
            return .wall
        }
        if width >= 560, (width - spacing) / 2 >= minimumCardWidth {
            return .two
        }
        return .one
    }

    var body: some View {
        LearnWallLayout(columns: columns,
                        spacing: spacing,
                        rowSpacing: 30) {
            ForEach(Array(departments.enumerated()), id: \.element.id) { index, department in
                LearnDepartmentCardLink(department: department, index: index)
                    .learnArrival(reduceMotion)
            }
        }
    }
}

/// One department card, as the link into it.
struct LearnDepartmentCardLink: View {
    let department: Department
    let index: Int

    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account

    var body: some View {
        let counts = progress.departmentProgress(department)
        let tracked = account.isSignedIn || progress.completedTotal > 0
        NavigationLink(value: AppRoute.department(department.id)) {
            LearnDepartmentCard(department: department, index: index,
                                done: counts.done, total: counts.total, tracked: tracked)
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel(department.name)
        .accessibilityValue(accessibilityValue(done: counts.done, total: counts.total, tracked: tracked))
        .accessibilityHint(department.tagline ?? "")
    }

    private func accessibilityValue(done: Int, total: Int, tracked: Bool) -> String {
        var parts = [LearnFormat.plural(department.modules.count, "module", "modules"),
                     LearnFormat.plural(department.lessonCount, "lesson", "lessons")]
        if tracked {
            parts.append(total > 0 && done >= total ? "finished" : "\(done) of \(total) done")
        }
        return parts.joined(separator: ", ")
    }
}

/// The card face (`DepartmentCard` on the site): `dept / slug` and the module count,
/// the name, the tagline, a progress meter for anyone with progress, and the lesson
/// count in blue mono at the foot. The symbol is stamped in a small box beside the slug.
struct LearnDepartmentCard: View {
    let department: Department
    let index: Int
    let done: Int
    let total: Int
    let tracked: Bool

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var fraction: Double { total > 0 ? Double(done) / Double(total) : 0 }
    private var isComplete: Bool { total > 0 && done >= total }

    var body: some View {
        NotebookCard(tilt: .preset(index), tape: true, lift: true, tapeAngle: TapeStrip.angle(for: index)) {
            VStack(alignment: .leading, spacing: 0) {
                header
                Text(department.name)
                    .lfTitle(.h3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
                if let tagline = department.tagline, !tagline.isEmpty {
                    Text(tagline)
                        .font(LF.Fonts.body(15))
                        .lineHeight(.multiple(factor: 1.35))
                        .foregroundStyle(LF.Palette.graphite)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 6)
                }
                if tracked {
                    MeterView(value: fraction, label: "progress")
                        .padding(.top, 16)
                }
                Spacer(minLength: 18)
                DashedRule()
                footer.padding(.top, 13)
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
    }

    /// The symbol in its box, then `dept / slug` over the module count. The slug and count
    /// are always stacked, so every card on the wall reads the same way whatever its width,
    /// and the slug wraps rather than truncating. At the accessibility sizes the box goes
    /// above them, so the slug gets the card's whole width and "electrical-" isn't split.
    private var header: some View {
        let symbol = LearnStampedBox(side: 36) {
            Image(systemName: department.systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(LF.Palette.ink)
        }
        let filing = VStack(alignment: .leading, spacing: 2) {
            SlugText("dept / \(department.slug)")
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            SlugText(LearnFormat.plural(department.modules.count, "module", "modules"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        return Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 10) {
                    symbol
                    filing
                }
            } else {
                HStack(alignment: .center, spacing: 12) {
                    symbol
                    filing
                }
            }
        }
    }

    /// The lesson count, and "open" (or "finished") across from it while both fit on one
    /// line; under the count once they don't, rather than squeezing "lessons" mid-word.
    private var footer: some View {
        let count = Group {
            if department.lessonCount > 0 {
                CountText(department.lessonCount, unit: department.lessonCount == 1 ? "lesson" : "lessons")
            } else {
                SlugText("not counted yet")
            }
        }
        let state = Group {
            if tracked && isComplete {
                HStack(spacing: 6) {
                    PenCheckMark(size: 13)
                    SlugText("finished", color: LF.Palette.ink, weight: .bold)
                }
            } else {
                SlugText("open", color: LF.Palette.ink)
            }
        }
        return ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                count
                Spacer(minLength: 8)
                state
            }
            VStack(alignment: .leading, spacing: 8) {
                count
                state
            }
        }
    }
}

// MARK: - The wall layout

/// Rows of cards whose widths are spans of twelve, every card in a row as tall as the
/// tallest so the footers line up. In `.wall` mode the spans follow the site's cycle and
/// the last card absorbs what's left of the bottom row (`spansFor` in `_pit-row.tsx`).
struct LearnWallLayout: Layout {
    enum Columns: Sendable { case one, two, wall }

    var columns: Columns
    var spacing: CGFloat
    var rowSpacing: CGFloat
    /// In `.two` mode, an odd last card takes the whole row instead of half of it.
    var stretchesLast = false

    /// The site's spans, in the order the cards go up.
    static let cycle = [5, 4, 3, 3, 4, 5, 4, 5, 3, 5, 3, 4]

    /// The width of the wall's narrowest card (a span of three) at this width.
    static func narrowestWallCard(in total: CGFloat, spacing: CGFloat) -> CGFloat {
        let span = cycle.min() ?? 3
        let track = (total - spacing * 11) / 12
        return max(0, track * CGFloat(span) + spacing * CGFloat(span - 1))
    }

    static func wallSpans(count: Int) -> [Int] {
        var spans = (0..<count).map { cycle[$0 % cycle.count] }
        var used = 0
        for span in spans {
            if used + span > 12 { used = 0 }
            used += span
        }
        if !spans.isEmpty, used < 12 { spans[spans.count - 1] += 12 - used }
        return spans
    }

    private func spans(count: Int) -> [Int] {
        switch columns {
        case .one: return Array(repeating: 12, count: count)
        case .two:
            var spans = Array(repeating: 6, count: count)
            if stretchesLast, count % 2 == 1 { spans[count - 1] = 12 }
            return spans
        case .wall: return Self.wallSpans(count: count)
        }
    }

    private struct Row {
        var items: [(index: Int, span: Int)] = []
        var used: Int { items.reduce(0) { $0 + $1.span } }
    }

    private func rows(count: Int) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for (index, span) in spans(count: count).enumerated() {
            if current.used + span > 12, !current.items.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.items.append((index, span))
        }
        if !current.items.isEmpty { rows.append(current) }
        return rows
    }

    private func width(of span: Int, in total: CGFloat) -> CGFloat {
        // Twelve tracks with eleven gaps, like a CSS grid.
        let track = (total - spacing * 11) / 12
        return max(0, track * CGFloat(span) + spacing * CGFloat(span - 1))
    }

    private func measure(_ subviews: Subviews, width total: CGFloat) -> [(row: Row, height: CGFloat)] {
        rows(count: subviews.count).map { row in
            let height = row.items.map { item in
                subviews[item.index].sizeThatFits(ProposedViewSize(width: width(of: item.span, in: total), height: nil)).height
            }.max() ?? 0
            return (row, height)
        }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let total = proposal.width ?? 360
        let measured = measure(subviews, width: total)
        let height = measured.reduce(0) { $0 + $1.height } + rowSpacing * CGFloat(max(0, measured.count - 1))
        return CGSize(width: total, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for (row, height) in measure(subviews, width: bounds.width) {
            var x = bounds.minX
            for item in row.items {
                let w = width(of: item.span, in: bounds.width)
                subviews[item.index].place(at: CGPoint(x: x, y: y), anchor: .topLeading,
                                           proposal: ProposedViewSize(width: w, height: height))
                x += w + spacing
            }
            y += height + rowSpacing
        }
    }
}

// MARK: - Previews

#Preview("Wall, iPhone", traits: .fixedLayout(width: 393, height: 900)) {
    NavigationStack {
        ScrollView {
            LearnDepartmentWall(departments: LearnPreviewCatalog.wallDepartments,
                                layout: LearnLayout(width: 393))
                .learnColumn(LearnLayout(width: 393))
                .padding(.vertical, 24)
        }
        .paperBackground()
    }
    .appEnvironment(LearnPreviewCatalog.model())
}

#Preview("Wall, iPad, dark", traits: .fixedLayout(width: 1180, height: 900)) {
    NavigationStack {
        ScrollView {
            LearnDepartmentWall(departments: LearnPreviewCatalog.wallDepartments,
                                layout: LearnLayout(width: 1180))
                .learnColumn(LearnLayout(width: 1180))
                .padding(.vertical, 24)
        }
        .paperBackground()
    }
    .appEnvironment(LearnPreviewCatalog.model())
    .environment(\.colorScheme, .dark)
}
