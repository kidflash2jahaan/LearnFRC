import SwiftUI
import WidgetKit

/// "Up Next & This Week": the next lesson and the week on one page, for the bigger sizes
/// (iPhone and iPad large, iPad and Mac extra large and, from iOS and macOS 27, extra large
/// portrait). The card opens the lesson; the week opens the app's home screen.
struct OverviewWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: LearnFRCWidgetKind.overview, provider: SnapshotProvider()) { entry in
            OverviewEntryView(entry: entry)
        }
        .configurationDisplayName("Up Next & This Week")
        .description("Your next lesson and this week's lessons on one page.")
        .supportedFamilies(Self.families)
        .contentMarginsDisabled()
    }

    static var families: [WidgetFamily] {
        var families: [WidgetFamily] = [.systemLarge, .systemExtraLarge]
        if #available(iOS 27.0, macOS 27.0, *) {
            families.append(.systemExtraLargePortrait)
        }
        return families
    }
}

struct OverviewEntryView: View {
    let entry: LearnFRCEntry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        OverviewContent(entry: entry, family: family)
            .notebookStyled()
            .widgetURL(WidgetSnapshot.homeURL)
            .containerBackground(for: .widget) { PaperGround() }
    }
}

struct OverviewContent: View {
    /// How the page is laid out: large is one page, extra large a spread of two cards side by
    /// side, extra large portrait the two cards stacked.
    enum Layout: Sendable, Hashable {
        case page, spread, stack

        init(_ family: WidgetFamily) {
            if family == .systemExtraLarge {
                self = .spread
            } else if #available(iOS 27.0, macOS 27.0, *), family == .systemExtraLargePortrait {
                self = .stack
            } else {
                self = .page
            }
        }
    }

    let entry: LearnFRCEntry
    let layout: Layout

    init(entry: LearnFRCEntry, family: WidgetFamily) {
        self.init(entry: entry, layout: Layout(family))
    }

    init(entry: LearnFRCEntry, layout: Layout) {
        self.entry = entry
        self.layout = layout
    }

    @Environment(\.widgetContentMargins) private var margins
    @Environment(\.notebookStyle) private var style

    private var upNext: UpNext { entry.upNext }
    private var snapshot: WidgetSnapshot { entry.snapshot }

    var body: some View {
        Group {
            switch layout {
            case .spread:
                // A notebook spread: the lesson card and the week card side by side.
                VStack(alignment: .leading, spacing: 16) {
                    header
                    HStack(alignment: .top, spacing: 28) {
                        lessonCard(titleSize: 26, lines: 3, roomy: true)
                        weekCard
                    }
                }
            case .stack:
                // The same two cards, one above the other.
                VStack(alignment: .leading, spacing: 18) {
                    header
                    lessonCard(titleSize: 26, lines: 3, roomy: true)
                    weekCard
                }
            case .page:
                // The records line goes first if a long title and a full week need the room.
                ViewThatFits(in: .vertical) {
                    largePage(showsFooter: true)
                    largePage(showsFooter: false)
                }
            }
        }
        .padding(margins.scaled(layout == .page ? 0.8 : 0.85, min: 12))
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
    }

    private func largePage(showsFooter: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            lessonCard(titleSize: 20, lines: 2, roomy: false)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            Spacer(minLength: 15)
            weekBlock(figureSize: 34, cellHeight: 24, noteSize: 18)
            Spacer(minLength: 6)
            if showsFooter {
                footer
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center) {
            WidgetWordmark(size: 16)
            Spacer(minLength: 8)
            if snapshot.signedIn {
                SlugLabel("level \(snapshot.level) / \(snapshot.xp) xp", size: 10.5)
                    .lineLimit(1)
                    .accessibilityLabel("Level \(snapshot.level), \(snapshot.xp) XP")
            }
        }
    }

    private func lessonCard(titleSize: CGFloat, lines: Int, roomy: Bool) -> some View {
        WidgetLink(destination: upNext.url) {
            NotebookCardBox(padding: roomy
                            ? EdgeInsets(top: 18, leading: 20, bottom: 16, trailing: 20)
                            : EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 14)) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .firstTextBaseline) {
                        MarkerLabel(upNext.kicker, size: roomy ? 12 : 11)
                        Spacer(minLength: 8)
                        if !roomy, let minutes = upNext.minutesText {
                            SlugLabel(minutes, size: 11, bold: true, color: style.ink)
                        }
                    }
                    Text(upNext.title)
                        .widgetTitle(titleSize, relativeTo: .title3)
                        .foregroundStyle(style.ink)
                        .lineLimit(lines)
                        .minimumScaleFactor(0.8)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, roomy ? 12 : 7)
                    if roomy {
                        VStack(alignment: .leading, spacing: 3) {
                            if !upNext.department.isEmpty { SlugLabel(upNext.department, size: 11) }
                            if !upNext.module.isEmpty { SlugLabel(upNext.module, size: 11) }
                        }
                        .lineLimit(1)
                        .padding(.top, 10)
                        Spacer(minLength: 8)
                        HStack(alignment: .center) {
                            if let minutes = upNext.minutesText {
                                SlugLabel(minutes, size: 12, bold: true, color: style.ink)
                            }
                            Spacer(minLength: 0)
                            InkButtonFace(title: upNext.action, size: 13.5)
                        }
                    } else {
                        Spacer(minLength: 6)
                        HStack(alignment: .center, spacing: 10) {
                            SlugLabel(upNext.crumb, size: 10)
                                .lineLimit(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            InkButtonFace(title: upNext.action, size: 12.5)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(upNext.spokenSummary)
        .accessibilityAddTraits(.isLink)
    }

    /// Extra large: the week on its own card, tilted the other way.
    private var weekCard: some View {
        let week = entry.week
        return WidgetLink(destination: WidgetSnapshot.homeURL) {
            NotebookCardBox(tilt: 0.45, padding: EdgeInsets(top: 18, leading: 20, bottom: 14, trailing: 20)) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .center) {
                        MarkerLabel(week.label, size: 12)
                        Spacer(minLength: 8)
                        if week.isCleared {
                            InkTag("week cleared", on: true)
                        }
                    }
                    HStack(alignment: .bottom, spacing: 18) {
                        WeekFigure(status: week, size: 50)
                        WeekMeter(fraction: week.fraction, height: 12)
                            .padding(.bottom, 4)
                    }
                    .padding(.top, 14)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(week.spokenSummary)
                    DayStripView(days: week.days, cellHeight: 34, spacing: 7)
                        .padding(.top, 14)
                    PenNote(week.note, size: 21)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                        .padding(.top, 10)
                    Spacer(minLength: 6)
                    if !records.isEmpty {
                        SlugLabel(records, size: 10.5)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
            }
        }
    }

    private func weekBlock(figureSize: CGFloat, cellHeight: CGFloat, noteSize: CGFloat) -> some View {
        let week = entry.week
        return WidgetLink(destination: WidgetSnapshot.homeURL) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center) {
                    WeekLabel(week.label)
                    Spacer(minLength: 8)
                    if week.isCleared {
                        InkTag("week cleared", on: true)
                    }
                }
                HStack(alignment: .bottom, spacing: 16) {
                    VStack(alignment: .leading, spacing: 0) {
                        WeekFigure(status: week, size: figureSize)
                        WeekMeter(fraction: week.fraction, height: 11)
                            .padding(.top, 9)
                    }
                    .frame(width: figureSize * 2.5, alignment: .leading)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(week.spokenSummary)
                    DayStripView(days: week.days, cellHeight: cellHeight, spacing: 5)
                }
                .padding(.top, 8)
                PenNote(week.note, size: noteSize)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.top, 8)
            }
        }
    }

    @ViewBuilder
    private var footer: some View {
        // Records only once they exist: a new account never reads a row of zeros.
        if !records.isEmpty {
            VStack(alignment: .leading, spacing: 5) {
                DashedRule()
                    .stroke(style.rule, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .frame(height: 1)
                    .accessibilityHidden(true)
                SlugLabel(records, size: 10.5)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
    }

    private var records: String {
        var parts: [String] = []
        let total = snapshot.completedTotal
        if total > 0 { parts.append("\(total) \(total == 1 ? "lesson" : "lessons") all time") }
        if entry.week.onDevice { parts.append("counted on this device") }
        return parts.joined(separator: "  /  ")
    }
}

// MARK: - Previews

#Preview("Large", as: .systemLarge) {
    OverviewWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
    WidgetPreviewData.entry(WidgetPreviewData.goalMet)
    WidgetPreviewData.entry(WidgetPreviewData.firstWeekGuest)
    WidgetPreviewData.entry(WidgetPreviewData.sample, daysLater: 6)
}

#Preview("Extra large", as: .systemExtraLarge) {
    OverviewWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.goalMet)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
}
