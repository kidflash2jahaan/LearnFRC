import Charts
import SwiftUI

/// The Growth drawer: visitors, signups and completions per day over the last 30 days.
///
/// Three lines and one accent, told apart by pen the way the site draws them: visitors in
/// solid ballpoint blue over a faint wash, signups in a long ink dash, completions in an ink
/// dot. The legend under the toggles draws the same strokes, carries the window totals (true
/// 30-day figures from the server, never a sum of the days), and says "not drawn" for a line
/// that's switched off rather than fading it. Touch, pointer or VoiceOver scrubs a day.
struct AdminGrowthChart: View {
    enum Metric: String, Hashable, CaseIterable, Sendable {
        case all, visitors, signups, completions

        var title: String {
            switch self {
            case .all: "All three"
            case .visitors: "Visitors"
            case .signups: "Signups"
            case .completions: "Completions"
            }
        }
    }

    enum Series: String, CaseIterable, Identifiable, Sendable {
        case visitors, signups, completions
        var id: String { rawValue }

        var label: String {
            switch self {
            case .visitors: "Visitors"
            case .signups: "Signups"
            case .completions: "Completions"
            }
        }

        var color: Color { self == .visitors ? LF.Palette.blue : LF.Palette.ink }

        var stroke: StrokeStyle {
            switch self {
            case .visitors: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round)
            case .signups: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round, dash: [7, 4])
            case .completions: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round, dash: [1.5, 4])
            }
        }

        func value(_ day: AdminDashboard.Growth.Day) -> Int {
            switch self {
            case .visitors: day.visitors
            case .signups: day.signups
            case .completions: day.completions
            }
        }

        func total(_ totals: AdminDashboard.Growth.Totals) -> Int {
            switch self {
            case .visitors: totals.visitors
            case .signups: totals.signups
            case .completions: totals.completions
            }
        }
    }

    let growth: AdminDashboard.Growth
    @Binding var metric: Metric

    @State private var selectedDate: Date?

    private var days: [AdminDashboard.Growth.Day] { growth.daily.filter { $0.date != nil } }

    private func isShown(_ series: Series) -> Bool {
        metric == .all || metric.rawValue == series.rawValue
    }

    private var maxValue: Int {
        days.map { day in Series.allCases.map { $0.value(day) }.max() ?? 0 }.max() ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkTabStrip(selection: $metric, tabs: Metric.allCases.map { (value: $0, title: $0.title) })

            AdminFlowLayout(spacing: 10, lineSpacing: 10) {
                ForEach(Series.allCases) { series in
                    legendChip(series)
                }
            }
            .padding(.top, 16)

            if days.isEmpty || maxValue == 0 {
                SlugText("Nothing plotted yet. The lines start the first day the beacon records anything.")
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, minHeight: 220)
            } else {
                chart
                    .frame(height: 240)
                    .padding(.top, 18)
            }

            if let footnote = growth.footnote {
                AdminFootnote(footnote)
            }
        }
    }

    // MARK: Legend

    private func legendChip(_ series: Series) -> some View {
        HStack(spacing: 8) {
            AdminStrokeSwatch(series: series)
            SlugText(series.label)
            Text(series.total(growth.totals).formatted())
                .font(LF.Fonts.mono(15, weight: .bold, relativeTo: .body))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
            if !isShown(series) {
                SlugText("not drawn")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background {
            ZStack {
                HandShape(.s).fill(LF.Palette.card)
                HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: "\(series.label), \(series.total(growth.totals).formatted()) in the last 30 days\(isShown(series) ? "" : ", not drawn")"))
    }

    // MARK: Chart

    private var chart: some View {
        Chart {
            if isShown(.visitors) {
                ForEach(days) { day in
                    AreaMark(
                        x: .value("Day", day.date ?? .distantPast, unit: .day),
                        y: .value("Visitors", day.visitors)
                    )
                    .foregroundStyle(LF.Palette.blue.opacity(0.10))
                    .interpolationMethod(.linear)
                    .accessibilityHidden(true)
                }
            }
            ForEach(Series.allCases.filter(isShown)) { series in
                ForEach(days) { day in
                    LineMark(
                        x: .value("Day", day.date ?? .distantPast, unit: .day),
                        y: .value(series.label, series.value(day)),
                        series: .value("Series", series.label)
                    )
                    .foregroundStyle(series.color)
                    .lineStyle(series.stroke)
                    .interpolationMethod(.linear)
                    .accessibilityLabel(AdminText.day(day.date, withYear: false) ?? day.day)
                    .accessibilityValue("\(series.value(day).formatted()) \(series.label.lowercased())")
                }
            }
            if let selected = selectedDay {
                RuleMark(x: .value("Day", selected.date ?? .distantPast, unit: .day))
                    .foregroundStyle(LF.Palette.blue)
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                    .accessibilityHidden(true)
                ForEach(Series.allCases.filter(isShown)) { series in
                    PointMark(
                        x: .value("Day", selected.date ?? .distantPast, unit: .day),
                        y: .value(series.label, series.value(selected))
                    )
                    .symbol {
                        Circle()
                            .fill(LF.Palette.card)
                            .overlay { Circle().strokeBorder(series.color, lineWidth: 2) }
                            .frame(width: 8, height: 8)
                    }
                    .accessibilityHidden(true)
                }
            }
        }
        .chartYScale(domain: 0...max(1, maxValue))
        // Room at both ends for a date label centred on the first and last day.
        .chartXScale(range: .plotDimension(startPadding: 20, endPadding: 20))
        .chartXAxis {
            AxisMarks(values: xLabelDates) { value in
                AxisValueLabel(centered: false, anchor: .top, collisionResolution: .disabled) {
                    if let date = value.as(Date.self) {
                        Text(AdminText.day(date, withYear: false) ?? "")
                            .font(LF.Fonts.mono(10.5, relativeTo: .caption2))
                            .foregroundStyle(LF.Palette.graphite)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 1, dash: [2, 4]))
                    .foregroundStyle(LF.Palette.ink.opacity(0.18))
                AxisValueLabel {
                    if let number = value.as(Int.self) {
                        Text(number.formatted())
                            .font(LF.Fonts.mono(10.5, relativeTo: .caption2))
                            .foregroundStyle(LF.Palette.graphite)
                    }
                }
            }
        }
        .chartPlotStyle { plot in
            plot.overlay(alignment: .bottom) {
                Rectangle().fill(LF.Palette.ink.opacity(0.55)).frame(height: 1.5)
            }
        }
        .chartOverlay { proxy in
            // A tap reads a day, press and drag scrubs, a pointer hovers (iPad, Mac). The page
            // still scrolls vertically through the chart: none of these claim a plain swipe.
            GeometryReader { geometry in
                ZStack(alignment: .topLeading) {
                    Rectangle()
                        .fill(.clear)
                        .contentShape(Rectangle())
                        .onTapGesture { location in
                            select(at: location, proxy: proxy, geometry: geometry, togglesOff: true)
                        }
                        .gesture(
                            LongPressGesture(minimumDuration: 0.25)
                                .sequenced(before: DragGesture(minimumDistance: 0))
                                .onChanged { value in
                                    if case .second(true, let drag?) = value {
                                        select(at: drag.location, proxy: proxy, geometry: geometry)
                                    }
                                }
                        )
                        .onContinuousHover { phase in
                            switch phase {
                            case .active(let location): select(at: location, proxy: proxy, geometry: geometry)
                            case .ended: selectedDate = nil
                            }
                        }
                        .accessibilityHidden(true)
                    if let selected = selectedDay {
                        tooltipLayer(selected, proxy: proxy, geometry: geometry)
                    }
                }
            }
        }
        .accessibilityLabel("Visitors, signups and completions per day over the last 30 days")
    }

    /// Reads the day under `location`. A tap on the day already showing puts the reading away.
    private func select(at location: CGPoint, proxy: ChartProxy, geometry: GeometryProxy, togglesOff: Bool = false) {
        guard let plot = proxy.plotFrame else { return }
        let frame = geometry[plot]
        guard frame.width > 0 else { return }
        let x = min(max(location.x - frame.minX, 0), frame.width)
        guard let date: Date = proxy.value(atX: x) else { return }
        if togglesOff, let current = selectedDay, current.id == nearestDay(to: date)?.id {
            selectedDate = nil
        } else {
            selectedDate = date
        }
    }

    private func nearestDay(to date: Date) -> AdminDashboard.Growth.Day? {
        days.min { a, b in
            abs((a.date ?? .distantPast).timeIntervalSince(date)) < abs((b.date ?? .distantPast).timeIntervalSince(date))
        }
    }

    /// The x-axis labels: the most recent day always, then every week back from it (fewer on a
    /// short series), so the labels never crowd and today is always named.
    private var xLabelDates: [Date] {
        let dates = days.compactMap(\.date)
        guard !dates.isEmpty else { return [] }
        let step = dates.count > 20 ? 7 : max(1, dates.count / 4)
        return stride(from: dates.count - 1, through: 0, by: -step).map { dates[$0] }.reversed()
    }

    private var selectedDay: AdminDashboard.Growth.Day? {
        selectedDate.flatMap(nearestDay(to:))
    }

    /// The reading for the selected day, along the top of the plot and centred on its line,
    /// clamped so it never hangs off either edge (the site's tooltip).
    @ViewBuilder
    private func tooltipLayer(_ day: AdminDashboard.Growth.Day, proxy: ChartProxy, geometry: GeometryProxy) -> some View {
        if let plot = proxy.plotFrame, let date = day.date, let x = proxy.position(forX: date) {
            let frame = geometry[plot]
            let width = Self.tooltipWidth
            let centre = frame.minX + x
            let left = min(max(centre - width / 2, 0), max(0, geometry.size.width - width))
            tooltip(day)
                .offset(x: left, y: frame.minY + 2)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    private static let tooltipWidth: CGFloat = 176

    private func tooltip(_ day: AdminDashboard.Growth.Day) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            SlugText(AdminText.day(day.date, withYear: false) ?? day.day, color: LF.Palette.ink)
            DashedRule()
            ForEach(Series.allCases) { series in
                HStack(spacing: 6) {
                    AdminStrokeSwatch(series: series)
                    SlugText(series.label)
                    Spacer(minLength: 6)
                    Text(series.value(day).formatted())
                        .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
                        .monospacedDigit()
                        .foregroundStyle(LF.Palette.blue)
                }
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        .padding(10)
        .frame(width: Self.tooltipWidth)
        .notebookBox(radius: .s, shadow: .ink)
    }
}

/// The pen stroke beside a legend label: the same dash and weight as its line.
struct AdminStrokeSwatch: View {
    let series: AdminGrowthChart.Series

    var body: some View {
        Path { p in
            p.move(to: CGPoint(x: 0, y: 4))
            p.addLine(to: CGPoint(x: 22, y: 4))
        }
        .stroke(series.color, style: series.stroke)
        .frame(width: 22, height: 8)
        .accessibilityHidden(true)
    }
}
