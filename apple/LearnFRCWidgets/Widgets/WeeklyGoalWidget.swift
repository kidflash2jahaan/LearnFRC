import SwiftUI
import WidgetKit

/// "Weekly Goal": five lessons a week, written the way the site writes it. The count and the
/// seven days, the site's one-line note, and nothing that counts down or scores a gap.
/// Tapping opens the app's home screen, where the week lives.
struct WeeklyGoalWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: LearnFRCWidgetKind.weeklyGoal, provider: SnapshotProvider()) { entry in
            WeeklyGoalEntryView(entry: entry)
        }
        .configurationDisplayName("Weekly Goal")
        .description("Your lessons this week, counted toward five, and the days you studied.")
        .supportedFamilies(Self.families)
        .contentMarginsDisabled()
    }

    static var families: [WidgetFamily] {
        #if os(iOS)
        [.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline]
        #else
        [.systemSmall, .systemMedium]
        #endif
    }
}

struct WeeklyGoalEntryView: View {
    let entry: LearnFRCEntry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        WeeklyGoalContent(entry: entry, family: family)
            .notebookStyled()
            .widgetURL(WidgetSnapshot.homeURL)
            .containerBackground(for: .widget) {
                if family.isAccessory { Color.clear } else { PaperGround() }
            }
    }
}

struct WeeklyGoalContent: View {
    let entry: LearnFRCEntry
    let family: WidgetFamily

    @Environment(\.widgetContentMargins) private var margins

    var body: some View {
        switch family {
        #if os(iOS)
        case .accessoryCircular:
            WeekCircular(week: entry.week)
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        case .accessoryRectangular:
            WeekRectangular(week: entry.week)
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        case .accessoryInline:
            WeekInline(week: entry.week)
        #endif
        case .systemSmall:
            WeekSmall(week: entry.week)
                .padding(margins.scaled(0.9, min: 12))
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        default:
            WeekMedium(week: entry.week)
                .padding(margins.scaled(0.9, min: 12))
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        }
    }
}

// MARK: - Small

/// The figure, the trough and the window, like the site's week meter, with the note under it.
struct WeekSmall: View {
    let week: WeekStatus

    @Environment(\.notebookStyle) private var style

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if week.isCleared {
                InkTag("week cleared", on: true)
            } else {
                WeekLabel(week.label)
            }
            Spacer(minLength: 6)
            HStack(alignment: .center, spacing: 6) {
                WeekFigure(status: week, size: 40)
                if week.isCleared {
                    PenCheckMark(size: 15)
                }
            }
            WeekMeter(fraction: week.fraction, height: 11)
                .padding(.top, 9)
            if week.isCleared {
                SlugLabel(week.label, size: 10)
                    .padding(.top, 5)
            }
            Spacer(minLength: 6)
            Text(week.note)
                .font(WidgetFonts.body(12.5, relativeTo: .footnote))
                .foregroundStyle(style.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(week.spokenSummary)
        .accessibilityValue(week.note)
    }
}

// MARK: - Medium

/// The count in its own ruled column, the seven days beside it, as on the site's week card.
struct WeekMedium: View {
    let week: WeekStatus

    @Environment(\.notebookStyle) private var style

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                WeekLabel(week.label, size: 10.5)
                Spacer(minLength: 6)
                WeekFigure(status: week, size: 42)
                WeekMeter(fraction: week.fraction, height: 11)
                    .padding(.top, 10)
                    .padding(.bottom, 6)
            }
            .frame(width: 102, alignment: .leading)
            .frame(maxHeight: .infinity, alignment: .topLeading)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(week.spokenSummary)

            DashedRule(vertical: true)
                .stroke(style.rule, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                .frame(width: 1)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                if week.isCleared {
                    InkTag("week cleared", on: true)
                        .padding(.bottom, 6)
                }
                Text(week.note)
                    .widgetTitle(16, relativeTo: .subheadline)
                    .foregroundStyle(style.ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 6)
                DayStripView(days: week.days, cellHeight: 30, spacing: 5)
                if week.onDevice {
                    SlugLabel("counted on this device", size: 9.5)
                        .lineLimit(1)
                        .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - Lock Screen

#if os(iOS)
/// Lock Screen, circular: the system gauge (Lock Screen chrome), "3/5" in it.
struct WeekCircular: View {
    let week: WeekStatus

    var body: some View {
        Gauge(value: Double(week.filled), in: 0...Double(max(week.goal, 1))) {
            Text("week")
        } currentValueLabel: {
            Text(week.figure)
                .font(WidgetFonts.mono(14, bold: true, relativeTo: .body))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .widgetAccentable()
        .accessibilityLabel(week.spokenSummary)
    }
}

/// Lock Screen, rectangular: the count and the seven days.
struct WeekRectangular: View {
    let week: WeekStatus

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(week.figure)
                    .font(WidgetFonts.mono(16, bold: true, relativeTo: .headline))
                    .monospacedDigit()
                    .widgetAccentable()
                Text(week.label)
                    .font(WidgetFonts.mono(11, relativeTo: .caption2))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .foregroundStyle(.secondary)
                if week.isCleared {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .widgetAccentable()
                        .accessibilityHidden(true)
                }
            }
            DayStripView(days: week.days, cellHeight: 13, spacing: 3, showsLetters: false)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(week.spokenSummary)
        .accessibilityValue(week.note)
    }
}

/// Lock Screen, one line above the clock.
struct WeekInline: View {
    let week: WeekStatus

    var body: some View {
        Label("\(week.filled) of \(week.goal) lessons \(week.label)", systemImage: "calendar")
    }
}
#endif

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    WeeklyGoalWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
    WidgetPreviewData.entry(WidgetPreviewData.goalMet)
    WidgetPreviewData.entry(WidgetPreviewData.firstWeekGuest)
}

#Preview("Medium", as: .systemMedium) {
    WeeklyGoalWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
    WidgetPreviewData.entry(WidgetPreviewData.goalMet)
    WidgetPreviewData.entry(WidgetPreviewData.firstWeekGuest)
    WidgetPreviewData.entry(WidgetPreviewData.sample, daysLater: 2)
    WidgetPreviewData.entry(WidgetPreviewData.sample, daysLater: 6)
}

#if os(iOS)
#Preview("Lock Screen, circular", as: .accessoryCircular) {
    WeeklyGoalWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.goalMet)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
}

#Preview("Lock Screen, rectangular", as: .accessoryRectangular) {
    WeeklyGoalWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.goalMet)
}

#Preview("Lock Screen, inline", as: .accessoryInline) {
    WeeklyGoalWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
}
#endif
