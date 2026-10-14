import SwiftUI

// MARK: - Continue

/// The one lesson to open next (`resume-card.tsx`, the taped tile). The whole card is the
/// link. It straightens and lifts under a pointer and presses into its drop on touch.
struct HomeContinueCard: View {
    let location: LessonLocation
    /// Lessons finished in this lesson's department, for the meter.
    let departmentDone: Int
    let departmentTotal: Int
    /// True when this is the learner's first lesson rather than a resume.
    let fresh: Bool
    var large = false

    private var lesson: LessonSummary { location.lesson }
    private var percent: Int {
        departmentTotal > 0 ? Int((Double(departmentDone) / Double(departmentTotal) * 100).rounded()) : 0
    }
    private var action: String { fresh ? "Begin" : "Resume" }

    var body: some View {
        NavigationLink(value: AppRoute.lesson(lesson.id)) {
            NotebookCard(tilt: .preset(2), tape: true, lift: true, padding: large ? 24 : LF.Metrics.cardPadding, tapeAngle: -3.4) {
                SlugText(fresh ? "start here" : "pick up where you left off")

                LearnWholeWords(text: lesson.title) { string in
                    Text(string)
                        .homeTitle(large ? 30 : 25)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 10)

                // The whole filing line, wrapped as far as it needs (two lines cut the
                // module's name off at the largest sizes), and never inside a word.
                LearnWholeWordSlug(text: "dept / \(location.department.slug) / \(location.module.title)")
                    .padding(.top, 8)

                if let summary = lesson.summary, !summary.isEmpty {
                    // Whole, wrapped as far as it needs (see `HomeCopy.teaser`): a line
                    // limit cut it off mid-word at the larger text sizes.
                    Text(HomeCopy.teaser(summary))
                        .homeSub(15.5)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: 560, alignment: .leading)
                        .padding(.top, 12)
                }

                if percent > 0 {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            SlugText(location.department.name)
                                .multilineTextAlignment(.leading)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 8)
                            Text("\(percent)%")
                                .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
                                .monospacedDigit()
                                .foregroundStyle(LF.Palette.ink)
                                .fixedSize()
                        }
                        HomeTrough(fraction: Double(percent) / 100, slim: true)
                    }
                    .frame(maxWidth: 380, alignment: .leading)
                    .padding(.top, 18)
                }

                DashedRule()
                    .padding(.top, 20)

                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .center, spacing: 12) {
                        HomeLessonFacts(lesson: lesson)
                        Spacer(minLength: 8)
                        HomeButtonFace(title: action, systemImage: "arrow.right")
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        HomeLessonFacts(lesson: lesson)
                        HomeButtonFace(title: action, systemImage: "arrow.right")
                    }
                }
                .padding(.top, 14)
            }
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel(accessibilityText)
        .accessibilityHint("Opens the lesson")
    }

    private var accessibilityText: String {
        var parts = ["\(action): \(lesson.title)", location.department.name, location.module.title]
        if let minutes = HomeCopy.minutes(lesson.estimatedMinutes) { parts.append(minutes.replacingOccurrences(of: "min", with: "minutes")) }
        if percent > 0 { parts.append("department \(percent) percent done") }
        return parts.joined(separator: ", ")
    }
}

/// "25 min / video": the plain facts about a lesson, in the slug style. The two wrap onto
/// separate lines when the text is too large for one, rather than cutting each short.
struct HomeLessonFacts: View {
    let lesson: LessonSummary

    var body: some View {
        HomeFlowLayout(spacing: 12, lineSpacing: 6) {
            if let minutes = HomeCopy.minutes(lesson.estimatedMinutes) {
                Label {
                    SlugText(minutes)
                } icon: {
                    Image(systemName: "clock")
                        .imageScale(.small)
                        .foregroundStyle(LF.Palette.graphite)
                }
                .labelStyle(HomeCompactLabelStyle())
            }
            if lesson.youtubeID != nil {
                Label {
                    SlugText("video")
                } icon: {
                    Image(systemName: "play.rectangle")
                        .imageScale(.small)
                        .foregroundStyle(LF.Palette.graphite)
                }
                .labelStyle(HomeCompactLabelStyle())
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct HomeCompactLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 5) {
            configuration.icon
            configuration.title
        }
    }
}

// MARK: - First run

/// The only thing a learner with nothing finished meets first (`first-run-guide.tsx`): one
/// lesson to open and the three-step loop, instead of a wall of zeros and a choice.
struct HomeFirstRunCard: View {
    let location: LessonLocation?
    let isGuest: Bool
    var wide = false

    private struct Step: Identifiable {
        let id: String
        let title: String
        let body: String
    }

    private var steps: [Step] {
        [
            Step(id: "step one", title: "Finish one lesson",
                 body: "One topic, about five minutes. Nothing is gated, so you can read it on the shop floor."),
            Step(id: "step two", title: "Pass the quiz",
                 body: "It checks the thing that actually breaks robots, not the vocabulary word you skimmed. Retakes are unlimited."),
            isGuest
                ? Step(id: "step three", title: "Come back tomorrow",
                       body: "This device keeps your place, and a free account carries it to every device you use.")
                : Step(id: "step three", title: "Come back tomorrow",
                       body: "One a day builds a streak, and a streak multiplies the XP every lesson pays out."),
        ]
    }

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: wide ? 26 : 20, tapeAngle: -3.2) {
            SectionLabel("new here")

            Text("The whole loop takes five minutes.")
                .homeTitle(wide ? 32 : 26)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 520, alignment: .leading)
                .padding(.top, 12)

            Text("You don't have to pick a department to start. Read one lesson, answer the quiz at the end of it, and \(isGuest ? "this device" : "your account") starts keeping score.")
                .homeSub()
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 10)

            Group {
                if wide {
                    HStack(alignment: .top, spacing: 22) {
                        ForEach(steps) { stepView($0) }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 18) {
                        ForEach(steps) { stepView($0) }
                    }
                }
            }
            .padding(.top, 22)

            if let location {
                DashedRule()
                    .padding(.top, 22)
                NavigationLink(value: AppRoute.lesson(location.lesson.id)) {
                    Label("Start with this one", systemImage: "arrow.right")
                        .labelStyle(HomeTrailingIconLabelStyle())
                }
                .buttonStyle(.ink)
                .padding(.top, 18)
                .accessibilityHint("Opens \(location.lesson.title)")
                LearnWholeWordSlug(text: "\(location.lesson.title) / \(location.department.name)")
                    .padding(.top, 12)
            }
        }
    }

    private func stepView(_ step: Step) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            SlugText(step.id)
                .padding(.top, 10)
            Text(step.title)
                .homeTitle(17.5, relativeTo: .headline)
                .padding(.top, 6)
            Text(step.body)
                .homeSub(15)
                .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Title then icon, for "Start with this one ->".
struct HomeTrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 7) {
            configuration.title
            configuration.icon
                .imageScale(.small)
                .fontWeight(.bold)
        }
    }
}

// MARK: - Everything done

/// For the rare learner with every lesson ticked off.
struct HomeAllDoneCard: View {
    let lessonCount: Int
    let departmentCount: Int

    var body: some View {
        NotebookCard(tilt: .preset(1), tape: true) {
            SectionLabel("the whole binder")
            Text("Every lesson is ticked off.")
                .homeTitle(26)
                .padding(.top, 12)
            Text("All \(HomeCopy.count(lessonCount, "lesson")) across \(HomeCopy.count(departmentCount, "department")). New ones land here first, and your certificates are ready to share.")
                .homeSub()
                .padding(.top, 10)
            NavigationLink(value: AppRoute.achievements) {
                Text("See your badges")
            }
            .buttonStyle(.inkGhost)
            .padding(.top, 18)
        }
    }
}

// MARK: - Next unlock

/// The closest badge still to earn, from the server's `nextUnlock`. Only lesson-count badges
/// are ever pointed at (the site's rule): that count can only go up, so naming the gap can't
/// turn into something to lose.
struct HomeNextUnlockCard: View {
    let unlock: NextUnlock

    private var remaining: Int { unlock.progress.remaining }

    private var nudge: String {
        remaining == 1 ? "One more lesson and it's yours." : "\(remaining) more lessons and it's yours."
    }

    var body: some View {
        NavigationLink(value: AppRoute.achievements) {
            NotebookCard(tilt: .preset(1), lift: true) {
                SlugText("next badge")
                HStack(alignment: .top, spacing: 14) {
                    HomeIconBox(systemImage: unlock.systemImage)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(unlock.name)
                            .homeTitle(19, relativeTo: .title3)
                        if !unlock.description.isEmpty {
                            Text(unlock.description)
                                .homeSub(15)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.top, 12)
                MeterView(
                    value: unlock.progress.fraction,
                    valueText: "\(unlock.progress.current)/\(unlock.progress.target)",
                    style: .slim
                )
                .padding(.top, 16)
                Text(nudge)
                    .font(LF.Fonts.body(15, weight: .semibold))
                    .foregroundStyle(LF.Palette.ink)
                    .padding(.top, 8)
            }
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel("Next badge: \(unlock.name). \(unlock.description) \(unlock.progress.current) of \(unlock.progress.target) \(unlock.progress.unit). \(nudge)")
        .accessibilityHint("Opens your badges")
    }
}

// MARK: - The tally

/// Level, XP and the counts that can only go up, ruled into one block (`_instrument-panel.tsx`).
struct HomeTally: View {
    let xp: Int
    let level: Int
    let streak: Int
    let lessons: Int
    let departmentsOpen: Int
    let departmentsDone: Int
    let badgesEarned: Int
    let badgesTotal: Int
    /// Guest lessons from this device still being moved into the account just after sign-in
    /// (`ProgressStore.movingGuestLessonIDs`). Until the server answers, `lessons` can be
    /// these alone and XP is behind, so the lessons figure waits and XP says it's catching up
    /// instead of either reading as final.
    var movingGuestLessons = 0
    /// Three readings across when there's room. Fewer when a label's longest word wouldn't
    /// fit a column at this width and text size (see `HomeTallyGrid`).
    var columns = 3

    private struct Reading: Identifiable {
        let value: Int
        let label: String
        var note: String?
        /// Not known yet: shown as an ellipsis, never as a number smaller than the real one.
        var isPending = false
        var id: String { label }
    }

    private var readings: [Reading] {
        [
            // While guest lessons move in, the count can be the incoming lessons alone (the
            // account's own aren't read yet), so it waits for the refresh.
            Reading(value: lessons, label: "lessons cleared", note: movingGuestLessons > 0 ? "\(movingGuestLessons) moving in" : nil,
                    isPending: movingGuestLessons > 0),
            Reading(value: departmentsOpen, label: departmentsOpen == 1 ? "department open" : "departments open"),
            Reading(value: departmentsDone, label: "departments signed off"),
            Reading(value: badgesEarned, label: "badges earned", note: badgesTotal > 0 ? "of \(badgesTotal)" : nil),
            // The multiplier is the only reason the streak is worth printing, so it's printed with it.
            Reading(value: streak, label: streak == 1 ? "day running" : "days running",
                    note: streak > 1 ? "\(HomeCopy.xpMultiplier(streak: streak))x xp" : nil),
            Reading(value: xp, label: "xp banked", note: movingGuestLessons > 0 ? "catching up" : nil),
        ]
    }

    /// The longest word in any label or note ("departments"). The slug face is monospaced,
    /// so the most letters is also the widest.
    private var longestWord: String {
        let text = readings.map { "\($0.label) \($0.note ?? "")" }.joined(separator: " ")
        let words = text.split(separator: " ")
        return words.max { $0.count < $1.count }.map(String.init) ?? ""
    }

    private var xpInto: Int { XPRules.xpIntoLevel(xp) }
    private var xpToNext: Int { XPRules.xpToNextLevel(xp) }

    var body: some View {
        NotebookCard {
            SlugText("level")
                .accessibilityAddTraits(.isHeader)
            HStack(alignment: .center, spacing: 18) {
                Text("\(level)")
                    .font(LF.Fonts.mono(46, weight: .bold, relativeTo: .largeTitle))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.blue)
                    .lineLimit(1)
                    .fixedSize()
                VStack(alignment: .leading, spacing: 7) {
                    HomeTrough(fraction: Double(xpInto) / Double(XPRules.xpPerLevel))
                    SlugText("\(xpInto) / \(XPRules.xpPerLevel) xp")
                }
            }
            .padding(.top, 4)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Level \(level), \(xpInto) of \(XPRules.xpPerLevel) XP into it")

            Text("\(Text("\(xpToNext) XP").font(LF.Fonts.body(15, weight: .bold)).foregroundStyle(LF.Palette.ink)) to level \(level + 1).")
                .font(LF.Fonts.body(15))
                .foregroundStyle(LF.Palette.graphite)
                .padding(.top, 8)

            DashedRule()
                .padding(.top, 16)

            SlugText("the tally")
                .padding(.top, 12)
                .accessibilityAddTraits(.isHeader)

            HomeTallyGrid(maxColumns: columns, spacing: 16) {
                // What the grid measures to decide how many columns fit.
                SlugText(longestWord)
                    .fixedSize()
                    .hidden()
                    .accessibilityHidden(true)
                ForEach(readings) { reading in
                    VStack(alignment: .leading, spacing: 0) {
                        InkRule()
                        Text(reading.isPending ? "\u{2026}" : reading.value.formatted())
                            .font(LF.Fonts.mono(21, weight: .bold, relativeTo: .title3))
                            .monospacedDigit()
                            .foregroundStyle(reading.isPending ? LF.Palette.graphite : LF.Palette.blue)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .padding(.top, 8)
                            .accessibilityLabel(reading.isPending ? "catching up" : reading.value.formatted())
                        SlugText(reading.label)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 3)
                        if let note = reading.note {
                            SlugText(note)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.top, 10)
        }
    }
}

// MARK: - Previews

#Preview("Lesson cards, iPhone", traits: .fixedLayout(width: 393, height: 2400)) {
    NavigationStack {
        ScrollView {
            VStack(spacing: 34) {
                HomeContinueCard(location: PreviewData.lessonLocation, departmentDone: 7, departmentTotal: 40, fresh: false)
                HomeFirstRunCard(location: PreviewData.lessonLocation, isGuest: true)
                if let unlock = PreviewData.nextUnlock(lessonsDone: 3) {
                    HomeNextUnlockCard(unlock: unlock)
                }
                HomeTally(xp: 245, level: 3, streak: 3, lessons: 10, departmentsOpen: 2, departmentsDone: 0, badgesEarned: 3, badgesTotal: 11)
            }
            .padding(LF.Metrics.gutter)
            .padding(.top, 14)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .light)
}

#Preview("Lesson cards, iPad, dark", traits: .fixedLayout(width: 820, height: 1300)) {
    NavigationStack {
        ScrollView {
            VStack(spacing: 34) {
                HomeContinueCard(location: PreviewData.lessonLocation, departmentDone: 0, departmentTotal: 40, fresh: true, large: true)
                HomeFirstRunCard(location: PreviewData.lessonLocation, isGuest: false, wide: true)
                HomeAllDoneCard(lessonCount: 394, departmentCount: 11)
            }
            .padding(28)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .dark)
}
