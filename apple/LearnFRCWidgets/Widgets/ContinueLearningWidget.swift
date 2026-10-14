import SwiftUI
import WidgetKit

/// "Continue Learning": the next lesson, one tap from the Home Screen, Lock Screen or Mac
/// desktop. Tapping opens `learnfrc://lesson/<id>`.
struct ContinueLearningWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: LearnFRCWidgetKind.continueLearning, provider: SnapshotProvider()) { entry in
            ContinueLearningEntryView(entry: entry)
        }
        .configurationDisplayName("Continue Learning")
        .description("The lesson you're on, ready to pick up.")
        .supportedFamilies(Self.families)
        .contentMarginsDisabled()
    }

    static var families: [WidgetFamily] {
        #if os(iOS)
        [.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline]
        #else
        [.systemSmall, .systemMedium]
        #endif
    }
}

struct ContinueLearningEntryView: View {
    let entry: LearnFRCEntry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        ContinueLearningContent(entry: entry, family: family)
            .notebookStyled()
            .widgetURL(entry.upNext.url)
            .containerBackground(for: .widget) {
                if family.isAccessory { Color.clear } else { PaperGround() }
            }
    }
}

/// Picks the layout for a family. Takes the family as a value so previews can show any size.
struct ContinueLearningContent: View {
    let entry: LearnFRCEntry
    let family: WidgetFamily

    @Environment(\.widgetContentMargins) private var margins

    var body: some View {
        switch family {
        #if os(iOS)
        case .accessoryRectangular:
            ContinueRectangular(upNext: entry.upNext)
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        case .accessoryInline:
            ContinueInline(upNext: entry.upNext)
        #endif
        case .systemSmall:
            ContinueSmall(upNext: entry.upNext)
                .padding(margins.scaled(0.9, min: 12))
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        default:
            ContinueMedium(upNext: entry.upNext, week: entry.week)
                .padding(margins.scaled(0.62, min: 9))
                .dynamicTypeSize(...DynamicTypeSize.xLarge)
        }
    }
}

// MARK: - Small

/// The small one: no card, written straight onto the graph paper.
struct ContinueSmall: View {
    let upNext: UpNext

    @Environment(\.notebookStyle) private var style

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            MarkerLabel(upNext.kicker)
                .padding(.trailing, 30)   // clear of the tape on the corner
            ViewThatFits(in: .vertical) {
                titleBlock(lines: 3, crumb: true)
                titleBlock(lines: 3, crumb: false)
                titleBlock(lines: 2, crumb: false)
            }
            .padding(.top, 7)
            Spacer(minLength: 6)
            HStack(alignment: .bottom, spacing: 6) {
                if let minutes = upNext.minutesText {
                    SlugLabel(minutes, size: 11, bold: true, color: style.ink)
                        .padding(.bottom, 5)
                }
                Spacer(minLength: 0)
                InkButtonFace(title: nil, size: 13)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .overlay(alignment: .topTrailing) {
            // Tape over the widget's corner, as if the note were taped to the screen.
            TapePiece(angle: 38, width: 54, height: 16)
                .offset(x: 26, y: -6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(upNext.spokenSummary)
        .accessibilityAddTraits(.isLink)
    }

    private func titleBlock(lines: Int, crumb: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(upNext.title)
                .widgetTitle(17)
                .foregroundStyle(style.ink)
                .lineLimit(lines)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)
            if crumb, !upNext.department.isEmpty {
                SlugLabel(upNext.department, size: 10)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Medium

/// The medium one: a taped index card on the graph paper, with the week's count in the corner.
struct ContinueMedium: View {
    let upNext: UpNext
    let week: WeekStatus

    @Environment(\.notebookStyle) private var style

    var body: some View {
        NotebookCardBox {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    MarkerLabel(upNext.kicker)
                    Spacer(minLength: 8)
                    if let minutes = upNext.minutesText {
                        SlugLabel(minutes, size: 11, bold: true, color: style.ink)
                    }
                }
                ViewThatFits(in: .vertical) {
                    titleBlock(lines: 2, crumb: true)
                    titleBlock(lines: 2, crumb: false)
                    titleBlock(lines: 2, crumb: false, size: 16)
                    titleBlock(lines: 1, crumb: false)
                }
                .padding(.top, 6)
                Spacer(minLength: 6)
                HStack(alignment: .center, spacing: 8) {
                    weekNote
                    Spacer(minLength: 4)
                    InkButtonFace(title: upNext.action, size: 12)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(upNext.spokenSummary) \(week.spokenSummary).")
        .accessibilityAddTraits(.isLink)
    }

    private func titleBlock(lines: Int, crumb: Bool, size: CGFloat = 18.5) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(upNext.title)
                .widgetTitle(size)
                .foregroundStyle(style.ink)
                .lineLimit(lines)
                .minimumScaleFactor(0.85)
                .fixedSize(horizontal: false, vertical: true)
            if crumb, !upNext.crumb.isEmpty {
                SlugLabel(upNext.crumb, size: 10)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
    }

    /// "3/5 this week": the count, never a countdown.
    private var weekNote: some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text("\(week.filled)")
                    .foregroundStyle(style.blue)
                    .widgetAccentable()
                Text("/\(week.goal)")
                    .foregroundStyle(style.graphite)
            }
            .font(WidgetFonts.mono(13, bold: true, relativeTo: .footnote))
            .monospacedDigit()
            SlugLabel(week.label, size: 10)
                .lineLimit(1)
                .layoutPriority(-1)
        }
    }
}

// MARK: - Lock Screen

#if os(iOS)
/// Lock Screen, rectangular: the kicker and the lesson title.
struct ContinueRectangular: View {
    let upNext: UpNext

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                Image(systemName: "book.pages")
                    .font(.system(size: 11, weight: .semibold))
                Text([upNext.kicker, upNext.minutesText].compactMap { $0 }.joined(separator: " · "))
                    .font(WidgetFonts.mono(11, bold: true, relativeTo: .caption2))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .widgetAccentable()
            Text(upNext.title)
                .widgetTitle(15.5)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(upNext.spokenSummary)
    }
}

/// Lock Screen, one line above the clock.
struct ContinueInline: View {
    let upNext: UpNext

    var body: some View {
        Label(upNext.isPlaceholder ? "Pick your next lesson" : "Next: \(upNext.title)", systemImage: "book.pages")
            .accessibilityLabel(upNext.spokenSummary)
    }
}
#endif

// MARK: - Helpers

extension WidgetFamily {
    /// Lock Screen and other accessory families (none on macOS).
    var isAccessory: Bool {
        #if os(iOS)
        switch self {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline: true
        default: false
        }
        #else
        false
        #endif
    }
}

extension EdgeInsets {
    /// The system's widget margins, tightened for notebook layouts that draw their own frame.
    func scaled(_ factor: CGFloat, min minimum: CGFloat) -> EdgeInsets {
        func s(_ v: CGFloat) -> CGFloat { Swift.max(minimum, (v * factor).rounded()) }
        return EdgeInsets(top: s(top), leading: s(leading), bottom: s(bottom), trailing: s(trailing))
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    ContinueLearningWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
    WidgetPreviewData.entry(WidgetPreviewData.longTitle)
    WidgetPreviewData.entry(WidgetPreviewData.noLesson)
}

#Preview("Medium", as: .systemMedium) {
    ContinueLearningWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
    WidgetPreviewData.entry(WidgetPreviewData.longTitle)
    WidgetPreviewData.entry(WidgetPreviewData.goalMet)
}

#if os(iOS)
#Preview("Lock Screen, rectangular", as: .accessoryRectangular) {
    ContinueLearningWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
    WidgetPreviewData.entry(WidgetPreviewData.empty)
    WidgetPreviewData.entry(WidgetPreviewData.longTitle)
}

#Preview("Lock Screen, inline", as: .accessoryInline) {
    ContinueLearningWidget()
} timeline: {
    WidgetPreviewData.entry(WidgetPreviewData.sample)
}
#endif
