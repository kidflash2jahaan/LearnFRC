import SwiftUI

/// The top of the sheet, written the way a student heads a worksheet: the file path, the
/// title, one line saying what it is, then a ruled row of facts (which lesson, how long,
/// which module, read or not) with the finish control at the end of it.
struct LessonHeaderView: View {
    let location: LessonLocation
    /// 1-based position in the department, and the department's lesson count.
    let position: (index: Int, total: Int)?
    /// Words / 200, the site's reading time. nil while the body loads.
    let readingMinutes: Int?
    let isCompleted: Bool
    let isPending: Bool
    let hasQuiz: Bool
    let isWide: Bool
    /// The facts two by two (this lesson and reading time, then filed under and state), for a
    /// header kept to one page of iPhone Duo's open screen, where a free flow broke them 1, 2, 1.
    var factsInPairs = false
    let metrics: LessonScrollMetrics
    let onOpen: (AppRoute) -> Void
    /// Scrolls to the quiz or the sign-off.
    let onFinish: () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            crumb
            Text(location.lesson.title)
                .font(LF.Fonts.display(isWide ? 46 : 36, relativeTo: .largeTitle))
                .tracking((isWide ? 46 : 36) * -0.025)
                .lineHeight(.multiple(factor: 0.98))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: isWide ? 760 : .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
                .textSelection(.enabled)
                .padding(.top, isWide ? 22 : 14)
                .onGeometryChange(for: CGFloat.self) { proxy in
                    proxy.frame(in: .named(LessonScrollMetrics.space)).maxY
                } action: { bottom in
                    metrics.setTitleBottom(bottom)
                }

            if let summary = location.lesson.summary, !summary.isEmpty {
                Text(summary)
                    .font(LF.Fonts.body(isWide ? 20 : 18.5, relativeTo: .title3))
                    .foregroundStyle(LF.Palette.graphite)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 640, alignment: .leading)
                    .textSelection(.enabled)
                    .padding(.top, isWide ? 18 : 14)
            }

            factsAndAction
                .padding(.top, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { InkRule() }
                .padding(.top, isWide ? 30 : 22)
        }
    }

    // MARK: The file path

    private var crumb: some View {
        LessonFlowLayout(spacing: 7, lineSpacing: 0, alignment: .center) {
            SlugText("guides")
                .frame(minHeight: LF.Metrics.tap)
            divider
            crumbLink(location.department.slug, label: "Department: \(location.department.name)") {
                onOpen(.department(location.department.id))
            }
            divider
            crumbLink(location.module.slug, label: "Module: \(location.module.title)") {
                onOpen(.module(location.module.id))
            }
            divider
            SlugText(location.lesson.slug, color: LF.Palette.ink, weight: .bold)
                .frame(minHeight: LF.Metrics.tap)
                .accessibilityLabel("This lesson")
        }
        .padding(.vertical, -12)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Breadcrumb")
    }

    private var divider: some View {
        SlugText("/")
            .frame(minHeight: LF.Metrics.tap)
            .accessibilityHidden(true)
    }

    private func crumbLink(_ text: String, label: String, action: @escaping () -> Void) -> some View {
        LessonCrumbButton(text: text, action: action)
            .accessibilityLabel(label)
    }

    // MARK: The facts, ruled off

    @ViewBuilder
    private var factsAndAction: some View {
        if isWide {
            HStack(alignment: .bottom, spacing: 24) {
                facts
                Spacer(minLength: 0)
                finishButton
            }
        } else {
            VStack(alignment: .leading, spacing: 18) {
                facts
                finishButton
            }
        }
    }

    /// The size of the counts in the facts row.
    static let countSize: CGFloat = 22

    /// Each fact's label sits on one shared top line, whatever the value under it, and the
    /// module title sits on the counts' baseline (`LessonFiledUnder`). Aligned at the bottom
    /// instead, "filed under" sat about 13pt lower than "reading time" beside it.
    @ViewBuilder
    private var facts: some View {
        if factsInPairs && !typeSize.isAccessibilitySize {
            // Two equal columns, so each pair lines up under the other whatever the words.
            LessonPairsLayout(spacing: 24, lineSpacing: 16) {
                factViews
            }
        } else {
            LessonFlowLayout(spacing: isWide ? 36 : 24, lineSpacing: 16, alignment: .top) {
                factViews
            }
        }
    }

    @ViewBuilder
    private var factViews: some View {
        if let position {
            LessonFact(label: "this lesson") {
                CountText("\(position.index)", unit: "of \(position.total) in \(location.department.name)", size: Self.countSize)
            }
            .accessibilityLabel("Lesson \(position.index) of \(position.total) in \(location.department.name)")
        }
        if let readingMinutes {
            LessonFact(label: "reading time") {
                CountText(readingMinutes, unit: "min", size: Self.countSize)
            }
            .accessibilityLabel("Reading time, \(readingMinutes) minute\(LessonText.plural(readingMinutes))")
        }
        LessonFiledUnder(title: location.module.title) {
            onOpen(.module(location.module.id))
        }
        LessonFact(label: "state") {
            TagView(stateText, on: isCompleted && !isPending)
                .fixedSize()
        }
    }

    private var stateText: String {
        if isPending { return "saved, will sync" }
        return isCompleted ? "read" : "not yet"
    }

    @ViewBuilder
    private var finishButton: some View {
        if isCompleted {
            Button(isPending ? "Saved, will sync" : "Completed", action: onFinish)
                .buttonStyle(.inkGhost)
                .accessibilityHint("Shows the sign-off at the end of the lesson")
        } else {
            Button(hasQuiz ? "Take the quiz" : "Mark complete", action: onFinish)
                .buttonStyle(.ink)
                .accessibilityHint(hasQuiz ? "Jumps to the quiz at the end of the lesson" : "Jumps to the end of the lesson")
        }
    }
}

/// A slug in the breadcrumb that opens its page; blue under a pointer.
private struct LessonCrumbButton: View {
    let text: String
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            SlugText(text, color: hovering ? LF.Palette.blue : LF.Palette.graphite)
                .frame(minHeight: LF.Metrics.tap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

/// "filed under" and the module title, the fact that's a link to the module. The label is
/// part of the button so the target is 44pt tall without padding the row; the title wraps
/// rather than cut off (at the largest sizes it can take several lines).
private struct LessonFiledUnder: View {
    let title: String
    let action: () -> Void
    @State private var hovering = false
    @ScaledMetric(relativeTo: .subheadline) private var maxWidth: CGFloat = 240

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 5) {
                SlugText("filed under")
                // On the counts' baseline: the title shares its first baseline with an
                // invisible count, so it lines up with "2 min" beside it at every text size.
                ZStack(alignment: Alignment(horizontal: .leading, vertical: .firstTextBaseline)) {
                    CountText("0", size: LessonHeaderView.countSize)
                        .hidden()
                        .accessibilityHidden(true)
                    Text(title)
                        .font(LF.Fonts.body(15.5, weight: .bold, relativeTo: .subheadline))
                        .foregroundStyle(hovering ? LF.Palette.blue : LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            // The label at the top, level with the other facts' labels; the 44pt target
            // extends below.
            .frame(maxWidth: maxWidth, minHeight: LF.Metrics.tap, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .accessibilityLabel("Filed under \(title)")
        .accessibilityHint("Opens the module")
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

/// Two equal columns, filled left to right and top to bottom; each row is as tall as the
/// taller of its two and both sit at its top. The lesson header's facts in a page column.
struct LessonPairsLayout: Layout {
    var spacing: CGFloat = 24
    var lineSpacing: CGFloat = 16

    private func columnWidth(_ width: CGFloat) -> CGFloat {
        max(0, (width - spacing) / 2)
    }

    private func rowHeights(_ subviews: Subviews, column: CGFloat) -> [CGFloat] {
        stride(from: 0, to: subviews.count, by: 2).map { start in
            (start..<min(start + 2, subviews.count))
                .map { subviews[$0].sizeThatFits(ProposedViewSize(width: column, height: nil)).height }
                .max() ?? 0
        }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 2 * (subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0) + spacing
        let heights = rowHeights(subviews, column: columnWidth(width))
        let height = heights.reduce(0, +) + lineSpacing * CGFloat(max(0, heights.count - 1))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let column = columnWidth(bounds.width)
        var y = bounds.minY
        for (row, height) in rowHeights(subviews, column: column).enumerated() {
            for side in 0..<2 {
                let index = row * 2 + side
                guard index < subviews.count else { break }
                subviews[index].place(
                    at: CGPoint(x: bounds.minX + CGFloat(side) * (column + spacing), y: y),
                    anchor: .topLeading,
                    proposal: ProposedViewSize(width: column, height: nil)
                )
            }
            y += height + lineSpacing
        }
    }
}
