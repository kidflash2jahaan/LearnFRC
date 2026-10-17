import SwiftUI

/// "Where they come from": signed-up users or measured visitors, over the last seven days or
/// everything on record, as a donut and a legend.
///
/// One accent, so sources are told apart the way the site's band does it: a different pen hatch
/// per source, in rank order, with the same hatch beside its name in the legend. The donut is
/// decoration for the legend (hidden from VoiceOver); every figure a reader needs is printed.
///
/// The visitor total is the server's measured headcount for the selected window, never a sum
/// of the rows: one person who arrives from two sources is counted under each, so the rows can
/// add up to more, and the caveat says so.
struct AdminSourceChart: View {
    enum Metric: String, Hashable, Sendable { case visitors, users }
    enum Range: String, Hashable, Sendable { case week, allTime }

    let sources: AdminDashboard.Sources
    @Binding var metric: Metric
    @Binding var range: Range
    var isLargeText: Bool

    private var data: [AdminSlice] {
        switch (metric, range) {
        case (.users, .week): sources.users.week
        case (.users, .allTime): sources.users.allTime
        case (.visitors, .week): sources.visitors.week
        case (.visitors, .allTime): sources.visitors.allTime
        }
    }

    private var noun: String { metric == .users ? "signups" : "visitors" }

    /// Visitors only: the measured total for the window, when it answered.
    private var measuredTotal: Int? {
        guard metric == .visitors else { return nil }
        let value = range == .week ? sources.visitors.weekTotal : sources.visitors.allTimeTotal
        return value > 0 ? value : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AdminFlowLayout(spacing: 28, lineSpacing: 0) {
                InkTabStrip(selection: $metric, tabs: [(value: .visitors, title: "Visitors"), (value: .users, title: "Users")])
                InkTabStrip(selection: $range, tabs: [(value: .week, title: "Last 7 days"), (value: .allTime, title: "All-time")])
            }

            let rowSum = data.reduce(0) { $0 + $1.count }
            if rowSum == 0 {
                SlugText(range == .week
                         ? "Nothing recorded in the last 7 days. No \(noun) attributed yet in that window."
                         : "No \(noun) attributed to a source yet.")
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 22)
            } else {
                breakdown(rowSum: rowSum)
                    .padding(.top, 20)
            }

            if let footnote = sources.footnote {
                AdminFootnote(footnote)
            }
        }
    }

    private func breakdown(rowSum: Int) -> some View {
        let measured = measuredTotal
        let total = measured ?? rowSum
        let overlaps = measured.map { rowSum > $0 } ?? false
        let segments = AdminSourceSegment.segments(for: data, rowSum: rowSum)
        let visible = segments.filter { !$0.isTail }
        let hidden = Array(data.dropFirst(AdminSourceSegment.maxRows))
        let hiddenCount = hidden.reduce(0) { $0 + $1.count }

        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(total.formatted())
                    .font(LF.Fonts.mono(32, weight: .bold, relativeTo: .title))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.blue)
                SlugText("\(noun) attributed")
            }
            .accessibilityElement(children: .combine)
            if overlaps {
                Text("Rows below add up to more than this. One person can arrive from two sources in the same period and is counted under each, so the shares are honest but their sum is not a headcount.")
                    .lfProse(13.5, lineHeight: 1.45, color: LF.Palette.graphite)
                    .frame(maxWidth: 560, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)
            }

            AdminColumnsLayout(isLargeText ? .fixed(1) : .adaptive(minColumnWidth: 220), spacing: 28, rowSpacing: 20) {
                AdminSourceDonut(segments: segments)
                    .frame(width: 184, height: 184)
                    .frame(maxWidth: .infinity)
                legend(visible, hidden: hidden.count, hiddenCount: hiddenCount)
            }
            .padding(.top, 18)
        }
    }

    private func legend(_ segments: [AdminSourceSegment], hidden: Int, hiddenCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
                if index > 0 { DashedRule() }
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    AdminHatchSwatch(hatch: segment.hatch)
                        .frame(width: 19, height: 12)
                        .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 1 }
                    Text(segment.name)
                        .font(LF.Fonts.body(15.5, relativeTo: .body))
                        .foregroundStyle(LF.Palette.ink)
                        .lineLimit(2)
                    AdminDottedLeader()
                        .frame(minWidth: 16)
                    Text(segment.count.formatted())
                        .font(LF.Fonts.mono(13, relativeTo: .caption))
                        .monospacedDigit()
                        .foregroundStyle(LF.Palette.graphite)
                        .fixedSize()
                    Text("\(Int(segment.percent.rounded()))%")
                        .font(LF.Fonts.mono(15, weight: .bold, relativeTo: .body))
                        .monospacedDigit()
                        .foregroundStyle(LF.Palette.blue)
                        .frame(minWidth: 42, alignment: .trailing)
                        .fixedSize()
                }
                .padding(.top, index == 0 ? 0 : 8)
                .padding(.bottom, 8)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(segment.name)
                .accessibilityValue("\(segment.count.formatted()), \(Int(segment.percent.rounded())) percent")
            }
            if hidden > 0 {
                SlugText("\(hidden) more \(hidden == 1 ? "source" : "sources"), \(hiddenCount.formatted()) between them")
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)
            }
        }
    }
}

/// The dotted leader that runs a name across to its figure on a ruled sheet.
private struct AdminDottedLeader: View {
    var body: some View {
        GeometryReader { proxy in
            Path { p in
                p.move(to: CGPoint(x: 0, y: proxy.size.height - 1))
                p.addLine(to: CGPoint(x: proxy.size.width, y: proxy.size.height - 1))
            }
            .stroke(LF.Palette.rule, style: StrokeStyle(lineWidth: 1, dash: [1, 3]))
        }
        .frame(height: 8)
        .accessibilityHidden(true)
    }
}

// MARK: - Segments and hatches

/// One slice of the donut and one line of the legend.
struct AdminSourceSegment: Hashable {
    let name: String
    let count: Int
    let percent: Double
    let hatch: AdminHatch
    var isTail = false

    /// Legend rows before the rest collapse into one remainder slice.
    static let maxRows = 10

    static func segments(for data: [AdminSlice], rowSum: Int) -> [AdminSourceSegment] {
        let sum = Double(max(rowSum, 1))
        var segments = data.prefix(maxRows).enumerated().map { index, slice in
            AdminSourceSegment(name: slice.name, count: slice.count, percent: Double(slice.count) / sum * 100, hatch: AdminHatch.ranked(index))
        }
        let hidden = data.dropFirst(maxRows)
        if !hidden.isEmpty {
            let count = hidden.reduce(0) { $0 + $1.count }
            segments.append(AdminSourceSegment(name: "\(hidden.count) more", count: count, percent: Double(count) / sum * 100, hatch: .tail, isTail: true))
        }
        return segments
    }
}

/// The six pen fills, assigned in rank order and cycled, plus the faint remainder hatch. Blue at
/// full strength in every one: an opacity ramp would read as "more".
enum AdminHatch: Hashable, Sendable {
    case solid
    /// Parallel blue lines at `angle` degrees, `width` thick, every `period` points.
    case lines(angle: Double, width: CGFloat, period: CGFloat)

    static let tail = AdminHatch.lines(angle: 45, width: 1, period: 6)

    static func ranked(_ index: Int) -> AdminHatch {
        let fills: [AdminHatch] = [
            .solid,
            .lines(angle: 45, width: 3, period: 6),
            .lines(angle: 135, width: 3, period: 6),
            .lines(angle: 45, width: 2, period: 7),
            .lines(angle: 0, width: 2, period: 7),
            .lines(angle: 90, width: 2, period: 7),
        ]
        return fills[index % fills.count]
    }

    /// Fills `path` (which lies inside `rect`) with card stock and this hatch in blue.
    func fill(_ path: Path, in rect: CGRect, context: GraphicsContext, blue: Color, card: Color) {
        context.fill(path, with: .color(card))
        switch self {
        case .solid:
            context.fill(path, with: .color(blue))
        case .lines(let angle, let width, let period):
            var clipped = context
            clipped.clip(to: path)
            let radians = angle * .pi / 180
            let direction = CGPoint(x: cos(radians), y: sin(radians))
            let normal = CGPoint(x: -direction.y, y: direction.x)
            let reach = hypot(rect.width, rect.height)
            let center = CGPoint(x: rect.midX, y: rect.midY)
            var lines = Path()
            var offset = -reach
            while offset <= reach {
                let origin = CGPoint(x: center.x + normal.x * offset, y: center.y + normal.y * offset)
                lines.move(to: CGPoint(x: origin.x - direction.x * reach, y: origin.y - direction.y * reach))
                lines.addLine(to: CGPoint(x: origin.x + direction.x * reach, y: origin.y + direction.y * reach))
                offset += period
            }
            clipped.stroke(lines, with: .color(blue), lineWidth: width)
        }
    }
}

/// The legend's swatch: the hatch in a small ink-bordered box.
struct AdminHatchSwatch: View {
    let hatch: AdminHatch

    var body: some View {
        Canvas { context, size in
            let rect = CGRect(origin: .zero, size: size)
            hatch.fill(Path(rect), in: rect, context: context, blue: LF.Palette.blue, card: LF.Palette.card)
            context.stroke(Path(rect.insetBy(dx: 1, dy: 1)), with: .color(LF.Palette.ink), lineWidth: 2)
        }
        .accessibilityHidden(true)
    }
}

/// The donut: each source's share as a hatched slice, ruled off in ink.
struct AdminSourceDonut: View {
    let segments: [AdminSourceSegment]

    var body: some View {
        Canvas { context, size in
            let side = min(size.width, size.height)
            let rect = CGRect(x: (size.width - side) / 2, y: (size.height - side) / 2, width: side, height: side).insetBy(dx: 2, dy: 2)
            let center = CGPoint(x: rect.midX, y: rect.midY)
            let outer = rect.width / 2
            let inner = outer * 0.56
            let total = max(segments.reduce(0) { $0 + $1.percent }, 0.0001)
            var start = -Double.pi / 2
            var dividers = Path()
            for segment in segments where segment.percent > 0 {
                let sweep = segment.percent / total * 2 * .pi
                let end = start + sweep
                var slice = Path()
                slice.addArc(center: center, radius: outer, startAngle: .radians(start), endAngle: .radians(end), clockwise: false)
                slice.addArc(center: center, radius: inner, startAngle: .radians(end), endAngle: .radians(start), clockwise: true)
                slice.closeSubpath()
                segment.hatch.fill(slice, in: rect, context: context, blue: LF.Palette.blue, card: LF.Palette.card)
                if segments.count > 1 {
                    dividers.move(to: CGPoint(x: center.x + cos(start) * inner, y: center.y + sin(start) * inner))
                    dividers.addLine(to: CGPoint(x: center.x + cos(start) * outer, y: center.y + sin(start) * outer))
                }
                start = end
            }
            let ink = GraphicsContext.Shading.color(LF.Palette.ink)
            context.stroke(dividers, with: ink, lineWidth: 2)
            context.stroke(Path(ellipseIn: CGRect(x: center.x - outer, y: center.y - outer, width: outer * 2, height: outer * 2)), with: ink, lineWidth: 2)
            context.stroke(Path(ellipseIn: CGRect(x: center.x - inner, y: center.y - inner, width: inner * 2, height: inner * 2)), with: ink, lineWidth: 2)
        }
        .accessibilityHidden(true)
    }
}
