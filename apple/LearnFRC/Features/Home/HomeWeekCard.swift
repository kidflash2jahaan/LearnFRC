import SwiftUI

/// The weekly goal, ported from the site's `week-goal-card.tsx`: five lessons in a week, the
/// seven-day strip, and the count written down as a figure with a meter.
///
/// Everything time-based (which week, today, the phase, the wording) arrives computed by the
/// server in `rhythm` and `rhythmCopy` and is shown as sent, except that em dashes are written
/// as full stops (`HomeCopy.plain`). Guests get the same card from the on-device rhythm,
/// labelled as counted on this device.
///
/// What it never does, by the site's rules: no countdown, no "expires", no streak-loss warning,
/// and an empty day is drawn exactly like a day that hasn't happened yet.
struct HomeWeekCard: View {
    let rhythm: Rhythm
    let copy: RhythmCopy
    /// Guests: the strip counts this device only.
    var onDevice = false
    /// Room for the figure in its own column beside the copy.
    var wide = false

    @ScaledMetric(relativeTo: .largeTitle) private var figureColumnWidth: CGFloat = 150

    private var plainCopy: RhythmCopy { HomeCopy.plain(copy) }

    /// `ProgressStore` already writes "on this device" into a guest's eyebrow (except
    /// "Welcome back"), so the figure's caption only says it when the eyebrow doesn't.
    private var captionNamesDevice: Bool {
        onDevice && !plainCopy.eyebrow.localizedCaseInsensitiveContains("on this device")
    }

    var body: some View {
        NotebookCard(tape: true, padding: wide ? 24 : LF.Metrics.cardPadding, tapeAngle: -3.2) {
            if wide {
                HStack(alignment: .top, spacing: 24) {
                    main
                    HomeDashedColumnRule()
                    HomeWeekFigure(rhythm: rhythm, onDevice: onDevice, labelsDevice: captionNamesDevice, arrangement: .column)
                        .frame(width: figureColumnWidth, alignment: .leading)
                }
                .fixedSize(horizontal: false, vertical: true)
            } else {
                main
                DashedRule()
                    .padding(.top, 20)
                HomeWeekFigure(rhythm: rhythm, onDevice: onDevice, labelsDevice: captionNamesDevice, arrangement: .row)
                    .padding(.top, 16)
            }
            records
        }
        .accessibilityElement(children: .contain)
    }

    private var main: some View {
        VStack(alignment: .leading, spacing: 0) {
            HomeFlowLayout(spacing: 10, lineSpacing: 8) {
                SectionLabel(plainCopy.eyebrow)
                // Hitting the mark is the one state change on this card, and it's a filled tag
                // rather than a colour swap, same as the site.
                if rhythm.phase == .goalMet {
                    TagView("week cleared", on: true)
                }
            }
            Text(plainCopy.headline)
                .homeTitle(wide ? 28 : 25)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            Text(plainCopy.body)
                .homeSub()
                .frame(maxWidth: 520, alignment: .leading)
                .padding(.top, 10)
            HomeDayStrip(days: rhythm.days)
                .frame(maxWidth: 420, alignment: .leading)
                .padding(.top, 20)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Permanent records, printed only once they exist, so a new account never reads
    /// "best week: 0". Nothing on this line can ever go down.
    private var recordItems: [String] {
        var records: [String] = []
        if rhythm.lifetime > 0 { records.append("\(HomeCopy.count(rhythm.lifetime, "lesson")) all time") }
        if rhythm.bestWindow > 0 { records.append("best week \(rhythm.bestWindow)") }
        if rhythm.bestStreak > 1 { records.append("best run \(rhythm.bestStreak) days") }
        return records
    }

    /// Each record is kept whole and the line breaks between them, so a narrow card or a
    /// large text size never splits "best / week 1".
    @ViewBuilder private var records: some View {
        let items = recordItems
        if !items.isEmpty {
            DashedRule()
                .padding(.top, 18)
            HomeFlowLayout(spacing: 8, lineSpacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, record in
                    SlugText(index < items.count - 1 ? "\(record)  /" : record)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.top, 10)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(items.joined(separator: ", "))
        }
    }
}

// MARK: - The figure

/// The week's count, written the way a count is written on paper (`week-ring.tsx`): the
/// figure, the trough under it, the window named beneath. When the count changes while it's
/// on screen, the figure lands like ink (down 5pt from 4% oversize, 180ms, no bounce).
struct HomeWeekFigure: View {
    enum Arrangement { case column, row }

    let rhythm: Rhythm
    /// Counted on this device (guests). Always read out to VoiceOver.
    var onDevice = false
    /// Print "on this device" in the caption too.
    var labelsDevice = false
    var arrangement: Arrangement

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var goal: Int { max(1, rhythm.goal) }
    private var filled: Int { max(0, min(goal, rhythm.windowCount)) }
    private var caption: String {
        labelsDevice ? "\(rhythm.windowLabel) / on this device" : rhythm.windowLabel
    }

    var body: some View {
        Group {
            switch arrangement {
            case .column:
                VStack(alignment: .leading, spacing: 0) {
                    figure(size: 50)
                    HomeTrough(fraction: Double(filled) / Double(goal))
                        .padding(.top, 12)
                    SlugText(caption)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                }
            case .row:
                HStack(alignment: .center, spacing: 16) {
                    figure(size: 40)
                    VStack(alignment: .leading, spacing: 7) {
                        HomeTrough(fraction: Double(filled) / Double(goal))
                        SlugText(caption)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(filled) of \(goal) lessons, \(rhythm.windowLabel)\(onDevice ? ", counted on this device" : "")")
    }

    @ViewBuilder
    private func figure(size: CGFloat) -> some View {
        let text = HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("\(filled)")
                .foregroundStyle(LF.Palette.blue)
            Text("/\(goal)")
                .foregroundStyle(LF.Palette.graphite)
        }
        .font(LF.Fonts.mono(size, weight: .bold, relativeTo: .largeTitle))
        .monospacedDigit()
        .lineLimit(1)
        .fixedSize()

        if reduceMotion {
            text
        } else {
            text.keyframeAnimator(initialValue: InkLanding(), trigger: rhythm.windowCount) { content, value in
                content
                    .scaleEffect(value.scale, anchor: .bottomLeading)
                    .offset(y: value.drop)
            } keyframes: { _ in
                KeyframeTrack(\.scale) {
                    MoveKeyframe(SiteTokens.Movement.inkScale)
                    LinearKeyframe(1, duration: SiteTokens.Duration.lift, timingCurve: InkLanding.curve)
                }
                KeyframeTrack(\.drop) {
                    MoveKeyframe(SiteTokens.Movement.inkDrop)
                    LinearKeyframe(0, duration: SiteTokens.Duration.lift, timingCurve: InkLanding.curve)
                }
            }
        }
    }
}

/// The two values the ink landing animates.
private struct InkLanding {
    var scale: CGFloat = 1
    var drop: CGFloat = 0

    /// The site's ease-out.
    static let curve = UnitCurve.bezier(
        startControlPoint: UnitPoint(x: SiteTokens.Ease.out.x1, y: SiteTokens.Ease.out.y1),
        endControlPoint: UnitPoint(x: SiteTokens.Ease.out.x2, y: SiteTokens.Ease.out.y2)
    )
}

/// The meter's trough on its own (`nb-meter`), for places where the figure is printed
/// elsewhere. It only animates when the value changes while on screen.
struct HomeTrough: View {
    let fraction: Double
    var slim = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .caption) private var regularHeight: CGFloat = 12.8
    @ScaledMetric(relativeTo: .caption) private var slimHeight: CGFloat = 8.8

    private var clamped: Double { fraction.isFinite ? min(max(fraction, 0), 1) : 0 }

    var body: some View {
        GeometryReader { proxy in
            Rectangle()
                .fill(LF.Palette.blue)
                .frame(width: proxy.size.width * clamped)
                .frame(maxWidth: .infinity, alignment: .leading)
                .animation(reduceMotion ? nil : LF.Motion.draw, value: clamped)
        }
        .frame(height: slim ? slimHeight : regularHeight)
        .background(LF.Palette.paper)
        .clipShape(HandShape(.s))
        .overlay {
            HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - The seven days

/// Seven days, ruled off like the attendance row at the top of a shop log (`day-strip.tsx`).
///
/// A day with lessons is filled blue, with the count printed when more than one landed. An
/// empty day looks the same as a day still to come, because it means the same thing: nothing
/// is ever scored as missed. Today is marked twice, never by colour alone: its letter goes bold
/// ink and a short blue pen stroke sits under its cell.
///
/// An account's days are the server's UTC days, shown as sent. In the evening west of
/// Greenwich (or the morning east of it) the server's "today" is already a different date
/// from the device's, so that cell is headed "today" instead of a weekday letter: its
/// lessons are the ones done today, but calling it Wednesday on a Tuesday would be wrong.
struct HomeDayStrip: View {
    let days: [DayCell]

    @ScaledMetric(relativeTo: .body) private var cellHeight: CGFloat = 36
    @ScaledMetric(relativeTo: .body) private var spacing: CGFloat = 7

    var body: some View {
        // Re-read at every render, so a strip left on screen past midnight stays honest.
        let deviceToday = Self.deviceDayKey()
        HStack(alignment: .bottom, spacing: spacing) {
            ForEach(days) { day in
                HomeDayCellView(day: day, height: cellHeight, todayIsAnotherDate: day.isToday && day.key != deviceToday)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lessons completed each day")
    }

    /// The device's own date as `YYYY-MM-DD`, the same shape as `DayCell.key`.
    static func deviceDayKey(_ date: Date = .now, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

private struct HomeDayCellView: View {
    let day: DayCell
    let height: CGFloat
    /// The server's today falls on a different date from the device's (see `HomeDayStrip`).
    var todayIsAnotherDate = false

    private var done: Bool { day.count > 0 }

    var body: some View {
        VStack(spacing: 5) {
            Group {
                if todayIsAnotherDate {
                    // "today" where the server's weekday isn't the device's; a dot when the
                    // cell is too narrow for the word (the pen stroke still marks it).
                    ViewThatFits(in: .horizontal) {
                        Text("today")
                        Text(verbatim: "\u{2022}")
                    }
                } else {
                    Text(String(day.label.prefix(1)))
                }
            }
            .font(LF.Fonts.mono(11, weight: day.isToday ? .bold : .regular, relativeTo: .caption2))
            .foregroundStyle(day.isToday ? LF.Palette.ink : LF.Palette.graphite)
            .lineLimit(1)
            ZStack {
                cell
                if day.count > 1 {
                    Text("\(day.count)")
                        .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                        .monospacedDigit()
                        .foregroundStyle(LF.Palette.card)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }
            }
            .frame(height: height)
            .frame(maxWidth: .infinity)
            // The pen stroke under today.
            Rectangle()
                .fill(day.isToday ? LF.Palette.blue : .clear)
                .frame(height: 3)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    @ViewBuilder private var cell: some View {
        if done {
            ZStack {
                HandShape(.s).fill(LF.Palette.blue)
                HandShape(.s).strokeBorder(LF.Palette.blue, lineWidth: LF.Metrics.stroke)
            }
        } else if day.isFuture {
            HandShape(.s).strokeBorder(LF.Palette.rule, style: StrokeStyle(lineWidth: LF.Metrics.stroke, dash: [4, 3]))
        } else {
            ZStack {
                HandShape(.s).fill(LF.Palette.paper)
                HandShape(.s).strokeBorder(LF.Palette.rule, lineWidth: LF.Metrics.stroke)
            }
        }
    }

    private var accessibilityText: String {
        let name = Self.weekdayNames[day.label] ?? day.label
        let when = todayIsAnotherDate ? "Today" : (day.isToday ? "\(name), today" : name)
        let what: String
        if day.isFuture {
            what = "still to come"
        } else if day.count == 0 {
            what = "no lessons"
        } else {
            what = HomeCopy.count(day.count, "lesson")
        }
        return "\(when): \(what)"
    }

    private static let weekdayNames = [
        "Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday",
        "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday",
    ]
}

// MARK: - Before the week has loaded

/// Stands in for the week card for a signed-in learner whose progress hasn't arrived yet.
/// The week is the server's to compute, so the app doesn't guess at it.
struct HomeWeekPlaceholder: View {
    var loading: Bool

    var body: some View {
        NotebookCard(tape: true, tapeAngle: -3.2) {
            SectionLabel("this week")
            if loading {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(height: 26, width: 240)
                    SkeletonBlock(height: 15)
                    SkeletonBlock(height: 15, width: 200)
                    SkeletonBlock(height: 36)
                        .padding(.top, 8)
                }
                .padding(.top, 14)
            } else {
                Text("Your week shows up here")
                    .homeTitle(23)
                    .padding(.top, 12)
                Text("It's counted on learnfrc.com, so it appears once the app has synced. \(HomeCopy.retry)")
                    .homeSub()
                    .padding(.top, 8)
            }
        }
    }
}

// MARK: - Previews

#Preview("Week, every phase, iPhone", traits: .fixedLayout(width: 393, height: 2900)) {
    ScrollView {
        VStack(spacing: 32) {
            ForEach(RhythmPhase.allCases, id: \.self) { phase in
                HomeWeekCard(rhythm: PreviewData.rhythm(phase), copy: PreviewData.rhythmCopy(phase))
            }
        }
        .padding(LF.Metrics.gutter)
        .padding(.top, 14)
    }
    .paperBackground()
    .environment(\.colorScheme, .light)
}

#Preview("Week, iPad, dark", traits: .fixedLayout(width: 820, height: 900)) {
    ScrollView {
        VStack(spacing: 32) {
            HomeWeekCard(rhythm: PreviewData.rhythm(.goalMet), copy: PreviewData.rhythmCopy(.goalMet), wide: true)
            HomeWeekCard(rhythm: PreviewData.rhythm(.new), copy: PreviewData.rhythmCopy(.new), onDevice: true, wide: true)
            HomeWeekPlaceholder(loading: true)
        }
        .padding(28)
    }
    .paperBackground()
    .environment(\.colorScheme, .dark)
}
