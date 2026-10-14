import SwiftUI

/// The weekly goal as Siri and Shortcuts say it and show it. Built from the same `Rhythm`
/// the server sends (or, for guests, the one this device computes), never recounted here.
struct WeekSummary: Hashable, Sendable {
    struct Day: Hashable, Sendable, Identifiable {
        let id: Int
        /// "Mon"
        let label: String
        let count: Int
        let isToday: Bool
        let isFuture: Bool

        /// "Monday", for VoiceOver.
        var spokenName: String { WeekSummary.fullDayName(label) }
    }

    let count: Int
    let goal: Int
    let isFirstWeek: Bool
    let days: [Day]
    /// The site's one-liner (`rhythmMicrocopy`), e.g. "2 more makes the week."
    let microcopy: String
    /// Guests: counted on this device only.
    let onDevice: Bool

    init(rhythm: Rhythm, onDevice: Bool) {
        count = rhythm.windowCount
        goal = max(1, rhythm.goal)
        isFirstWeek = rhythm.windowKind == .firstWeek
        days = rhythm.days.enumerated().map {
            Day(id: $0.offset, label: $0.element.label, count: $0.element.count, isToday: $0.element.isToday, isFuture: $0.element.isFuture)
        }
        microcopy = rhythm.microcopy
        self.onDevice = onDevice
    }

    init(count: Int, goal: Int, isFirstWeek: Bool, days: [Day], microcopy: String, onDevice: Bool) {
        self.count = count
        self.goal = max(1, goal)
        self.isFirstWeek = isFirstWeek
        self.days = days
        self.microcopy = microcopy
        self.onDevice = onDevice
    }

    var fraction: Double { min(1, Double(count) / Double(goal)) }
    var isGoalMet: Bool { count >= goal }

    /// "this week" / "in your first week"
    var windowPhrase: String { isFirstWeek ? "in your first week" : "this week" }

    static func lessons(_ n: Int) -> String { n == 1 ? "1 lesson" : "\(n) lessons" }

    /// What Siri says. Plain counts and the site's own line; nothing about what was missed.
    var spoken: String {
        let place = onDevice ? " on this device" : ""
        let first = count == 0
            ? "No lessons\(place) so far \(windowPhrase)."
            : "You've done \(Self.lessons(count))\(place) \(windowPhrase)."
        return microcopy.isEmpty ? first : "\(first) \(microcopy)"
    }

    /// "3 of 5"
    var tally: String { "\(count) of \(goal)" }

    static func fullDayName(_ short: String) -> String {
        switch short.lowercased().prefix(3) {
        case "mon": "Monday"
        case "tue": "Tuesday"
        case "wed": "Wednesday"
        case "thu": "Thursday"
        case "fri": "Friday"
        case "sat": "Saturday"
        case "sun": "Sunday"
        default: short
        }
    }
}

/// The snippet under Siri's answer to "How many lessons this week?": the count, a meter
/// toward the goal and the seven-day strip from the Home screen.
///
/// Siri and Shortcuts draw this outside the app, so it sticks to system type and semantic
/// colours, with LearnFRC blue as the one accent (the bundled fonts aren't there).
struct WeekSnippetView: View {
    let summary: WeekSummary

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.colorSchemeContrast) private var contrast
    /// Day dots grow with Dynamic Type, up to what seven of them can share a snippet's width.
    @ScaledMetric(relativeTo: .caption2) private var scaledDot: CGFloat = 24
    private var dotSize: CGFloat { min(max(scaledDot, 24), 38) }

    /// LearnFRC blue (`--blue`), with the dark-mode value from the design notes.
    private var blue: Color {
        colorScheme == .dark
            ? Color(red: 0x82 / 255, green: 0xA7 / 255, blue: 0xFF / 255)
            : Color(red: 0x1B / 255, green: 0x36 / 255, blue: 0xC8 / 255)
    }

    /// Text on a blue dot.
    private var onBlue: Color {
        colorScheme == .dark ? Color(red: 0x12 / 255, green: 0x14 / 255, blue: 0x16 / 255) : .white
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            meter
            strip
            if !summary.microcopy.isEmpty {
                Text(summary.microcopy)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("\(summary.count)")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(.primary)
            VStack(alignment: .leading, spacing: 1) {
                Text("of \(summary.goal) lessons")
                    .font(.headline)
                Text(summary.onDevice ? "\(summary.windowPhrase.capitalizedFirst), on this device" : summary.windowPhrase.capitalizedFirst)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if summary.isGoalMet {
                Image(systemName: "checkmark.seal.fill")
                    .font(.title2)
                    .foregroundStyle(blue)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(summary.spoken)
    }

    private var meter: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(.quaternary)
                Capsule()
                    .fill(blue)
                    .frame(width: summary.count == 0 ? 0 : max(8, proxy.size.width * summary.fraction))
            }
        }
        .frame(height: 8)
        .overlay {
            if contrast == .increased {
                Capsule().strokeBorder(.primary.opacity(0.6), lineWidth: 1)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Weekly goal")
        .accessibilityValue("\(summary.tally) lessons")
    }

    private var strip: some View {
        HStack(spacing: 0) {
            ForEach(summary.days) { day in
                VStack(spacing: 6) {
                    Text(day.label.prefix(1))
                        .font(.caption.weight(day.isToday ? .bold : .regular))
                        .foregroundStyle(day.isToday ? .primary : .secondary)
                    dot(for: day)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(dayLabel(day))
            }
        }
    }

    @ViewBuilder
    private func dot(for day: WeekSummary.Day) -> some View {
        ZStack {
            if day.count > 0 {
                Circle().fill(blue)
                Text(day.count > 9 ? "9+" : "\(day.count)")
                    .font(.caption2.weight(.bold))
                    .monospacedDigit()
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .foregroundStyle(onBlue)
            } else {
                Circle()
                    .strokeBorder(day.isFuture ? AnyShapeStyle(.quaternary) : AnyShapeStyle(.tertiary), lineWidth: 1.5)
            }
            if day.isToday {
                Circle()
                    .strokeBorder(blue, lineWidth: 2)
                    .padding(-4)
            }
        }
        .frame(width: dotSize, height: dotSize)
        .padding(4)
    }

    private func dayLabel(_ day: WeekSummary.Day) -> String {
        var parts = [day.spokenName]
        if day.isToday { parts.append("today") }
        if !day.isFuture { parts.append(WeekSummary.lessons(day.count)) }
        return parts.joined(separator: ", ")
    }
}

private extension String {
    /// "this week" -> "This week"
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}

// MARK: - Previews

#if DEBUG
private extension WeekSummary {
    static func preview(_ phase: RhythmPhase, onDevice: Bool = false) -> WeekSummary {
        WeekSummary(rhythm: PreviewData.rhythm(phase), onDevice: onDevice)
    }
}

private struct WeekSnippetPreviewColumn: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach([RhythmPhase.new, .firstLesson, .building, .goalMet], id: \.self) { phase in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(phase.rawValue).font(.caption.monospaced()).foregroundStyle(.secondary)
                        WeekSnippetView(summary: .preview(phase))
                            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                        Text("Siri: \(WeekSummary.preview(phase).spoken)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                WeekSnippetView(summary: .preview(.building, onDevice: true))
                    .background(.background.secondary, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
            .padding(16)
        }
    }
}

#Preview("Week snippet, iPhone light", traits: .fixedLayout(width: 393, height: 852)) {
    WeekSnippetPreviewColumn()
}

#Preview("Week snippet, iPhone dark", traits: .fixedLayout(width: 393, height: 852)) {
    WeekSnippetPreviewColumn()
        .environment(\.colorScheme, .dark)
        .background(Color.black)
}

#Preview("Week snippet, iPad light", traits: .fixedLayout(width: 820, height: 1180)) {
    WeekSnippetPreviewColumn()
        .frame(maxWidth: 540)
}

#Preview("Week snippet, iPad dark", traits: .fixedLayout(width: 820, height: 1180)) {
    WeekSnippetPreviewColumn()
        .frame(maxWidth: 540)
        .environment(\.colorScheme, .dark)
        .background(Color.black)
}
#endif
