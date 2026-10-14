import SwiftUI

/// The sign-off: what the answer sheet turns into once the lesson is done.
///
/// Drawn like a marked worksheet coming back: a solid blue band across the top
/// ("lesson signed off"), the stamp struck at an angle, then one unmissable next action.
/// The XP, badges and counts are the real ones from the completion response; a lesson
/// finished in an earlier session shows the XP it was awarded then.
struct QuizSignOffCard: View {
    /// Everything the card shows, worked out by `QuizView`.
    struct Content {
        /// When the lesson was finished (today for a completion made on this screen).
        var completedOn: Date?
        var signedIn: Bool
        /// Lessons this person has finished (on this device for guests).
        var completedTotal: Int
        /// The completion made on this screen, if there was one.
        var session: CompletionResult?
        /// True from the moment the quiz was passed on this screen.
        var justPassed: Bool
        /// Saved on this device, waiting to sync.
        var isPending: Bool
        /// XP the server awarded when this lesson was finished before.
        var storedXP: Int
        /// The name of the five-lesson badge ("Warmed Up").
        var momentumBadge: String
        var nextTitle: String?
        var hasContinue: Bool
        var quiz: [QuizQuestion]
        var milestone: LessonMilestone?
        var username: String?
        var isSaving: Bool
        var ready: Bool
        var message: String?
    }

    let content: Content
    var onContinue: () -> Void
    var onMarkUnread: () -> Void
    var onDismissMilestone: () -> Void
    var onAccount: (LessonAccountRequest) -> Void

    @ScaledMetric(relativeTo: .body) private var padding: CGFloat = 22
    /// The ring around an unlocked badge's symbol, growing with the symbol.
    @ScaledMetric(relativeTo: .body) private var badgeSize: CGFloat = 40
    @State private var showReasons = false
    /// The pen-check burst. Starts at 1 so the animator is already in place (at rest) and
    /// fires on the change to 2, once the card is on screen.
    @State private var burst = 1
    @State private var didBurst = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize

    /// The number that predicts whether someone sticks around (`MOMENTUM_TARGET`).
    static let momentumTarget = 5

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            band
            VStack(alignment: .leading, spacing: 0) {
                headline
                if let result = content.session, result.delivery == .server, result.xpAwarded > 0 {
                    xpLine(result)
                        .padding(.top, 16)
                }
                if let unlocked = content.session?.newAchievements, !unlocked.isEmpty {
                    badges(unlocked)
                        .padding(.top, 18)
                }
                if showMomentum {
                    momentum
                        .padding(.top, 18)
                }
                if !content.signedIn {
                    guestAsk
                        .padding(.top, content.completedTotal > 1 ? 18 : 10)
                }
                if content.hasContinue {
                    Button(action: onContinue) {
                        Text(content.nextTitle == nil ? "Back to the department" : "Next lesson")
                    }
                    .buttonStyle(InkButtonStyle(.primary, size: .large, fullWidth: true))
                    .accessibilityHint(content.nextTitle.map { "Opens \($0)" } ?? "")
                    .padding(.top, 22)
                }
                LessonQuietButton(content.isSaving ? "Saving…" : "Mark it unread again", action: onMarkUnread)
                    .disabled(content.isSaving || !content.ready)
                    .padding(.top, 6)
                if let message = content.message {
                    errorLine(message)
                        .padding(.top, 6)
                }
                if let milestone = content.milestone, let username = content.username {
                    DashedRule()
                        .padding(.top, 20)
                    LessonMilestoneCard(milestone: milestone, username: username, onDismiss: onDismissMilestone)
                        .padding(.top, 26)
                }
                if content.justPassed, content.quiz.contains(where: { !$0.explanation.isEmpty }) {
                    reasons
                        .padding(.top, 20)
                }
            }
            .padding(LessonLayout.cardPadding(padding))
        }
        .clipShape(HandShape(.a))
        .background { NotebookBoxBackground(size: .a, shadow: .card) }
        // The box's own edge stays on top of the band, like the site's `nb-box` around `nb-slab`.
        .overlay {
            HandShape(.a)
                .strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .overlay { CompletionBurst(trigger: burst) }
        .task(id: content.session != nil) {
            // Only for a completion made on this screen, and only once.
            guard content.session != nil, content.justPassed, !didBurst, !reduceMotion else { return }
            didBurst = true
            await Task.yield()
            burst += 1
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lesson signed off")
    }

    // MARK: Pieces

    /// The stamp across the top of a marked worksheet (`nb-slab`, no top rule).
    private var band: some View {
        Text("lesson signed off")
            .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
            .tracking(13 * 0.06)
            .foregroundStyle(LF.Palette.onBlue)
            .padding(.horizontal, LessonLayout.cardPadding(padding))
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LF.Palette.blueButton)
            .overlay(alignment: .bottom) { InkRule() }
            .accessibilityAddTraits(.isHeader)
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 10) {
            if typeSize.isAccessibilitySize {
                Text("That one is done").lessonHeading(25)
                stamp.padding(.vertical, 6)
            } else {
                HStack(alignment: .center, spacing: 14) {
                    Text("That one is done")
                        .lessonHeading(25)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    stamp
                        .padding(.trailing, 4)
                }
            }
            Text(status)
                .font(LF.Fonts.body(16, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
            if content.isPending || content.session?.delivery == .queued {
                TagView("saved, will sync", systemImage: "arrow.triangle.2.circlepath")
                    .padding(.top, 2)
                    .accessibilityLabel("Saved on this device, will sync")
            }
        }
    }

    @ViewBuilder
    private var stamp: some View {
        // While the save is in flight the card can appear a moment before the result;
        // the stamp waits for the result so it lands with the real figure on it.
        if !(content.justPassed && content.session == nil) {
            StampView(
                "Completed",
                caption: stampDate,
                footnote: stampFootnote,
                lands: content.session != nil
            )
            .fixedSize()
        }
    }

    /// A stamp carries the day it was struck.
    private var stampDate: String? {
        let date = content.session != nil ? Date.now : content.completedOn
        return date?.formatted(.dateTime.day().month(.abbreviated).year()).lowercased()
    }

    private var stampFootnote: String? {
        if let result = content.session {
            switch result.delivery {
            case .server: return result.xpAwarded > 0 ? "+\(result.xpAwarded) XP" : nil
            case .queued: return "will sync"
            case .guest: return "on this device"
            }
        }
        if content.isPending { return "will sync" }
        return content.storedXP > 0 ? "+\(content.storedXP) XP" : nil
    }

    private var status: String {
        if content.signedIn {
            if content.isPending || content.session?.delivery == .queued {
                return "Saved on this device. It goes to your account as soon as you're back online."
            }
            return "Your progress is saved to your account."
        }
        return content.completedTotal > 1
            ? "That's \(content.completedTotal) lessons finished on this device."
            : "Saved on this device. No account needed."
    }

    private func xpLine(_ result: CompletionResult) -> some View {
        // Side by side, or the total under the award at the accessibility sizes.
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 12))
        return layout {
            CountText("+\(result.xpAwarded)", unit: "XP", size: 24)
            Text("\(result.xp.formatted()) XP in all, level \(result.level)")
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { DashedRule() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Plus \(result.xpAwarded) XP. \(result.xp) XP in all, level \(result.level).")
    }

    private func badges(_ unlocked: [UnlockedAchievement]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SlugText(unlocked.count == 1 ? "badge unlocked" : "\(unlocked.count) badges unlocked")
            ForEach(unlocked) { badge in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: badge.systemImage)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(LF.Palette.blue)
                        .frame(width: badgeSize, height: badgeSize)
                        .overlay { Circle().strokeBorder(LF.Palette.blue, lineWidth: LF.Metrics.stroke) }
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(badge.name)
                            .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                            .foregroundStyle(LF.Palette.ink)
                        if !badge.description.isEmpty {
                            Text(badge.description)
                                .font(LF.Fonts.body(15, relativeTo: .subheadline))
                                .foregroundStyle(LF.Palette.graphite)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Badge unlocked: \(badge.name). \(badge.description)")
            }
        }
        .padding(.top, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { DashedRule() }
    }

    /// Honest or absent: it needs a real signed-in count and retires past the threshold.
    private var showMomentum: Bool {
        content.signedIn && content.completedTotal >= 1 && content.completedTotal <= Self.momentumTarget
    }

    private var momentum: some View {
        let done = content.completedTotal
        let toGo = Self.momentumTarget - done
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                ForEach(0..<Self.momentumTarget, id: \.self) { index in
                    if index < done {
                        Rectangle()
                            .fill(LF.Palette.blue)
                            .frame(width: 36, height: 10)
                    } else {
                        Rectangle()
                            .strokeBorder(LF.Palette.rule, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                            .frame(width: 24, height: 10)
                    }
                }
            }
            .accessibilityHidden(true)
            Text("\(Text("\(done) of \(Self.momentumTarget)").font(LF.Fonts.mono(15, weight: .bold, relativeTo: .callout)).foregroundStyle(LF.Palette.ink)) \(Text(toGo > 0 ? "lessons. \(toGo) more and the \(content.momentumBadge) badge is yours." : "lessons. \(content.momentumBadge) unlocked.").foregroundStyle(LF.Palette.graphite))")
                .font(LF.Fonts.body(15.5, relativeTo: .callout))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { DashedRule() }
        .accessibilityElement(children: .combine)
    }

    /// Sized to what a guest has actually built, framed around what an account adds.
    @ViewBuilder
    private var guestAsk: some View {
        let done = content.completedTotal
        if done > 1 {
            NoteCallout {
                SlugText("saved on this device")
                Text("\(Text("\(done) lessons done.").font(LF.Fonts.body(15.5, weight: .bold, relativeTo: .callout))) A free account gives them a permanent home, worth at least +\(done * 10) XP with the dates you actually earned them, and your progress follows you onto any device from then on.")
                    .font(LF.Fonts.body(15.5, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.ink)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Claim my \(done) lessons") { onAccount(.signUp) }
                    .buttonStyle(.inkSmall)
                    .padding(.top, 8)
            }
        } else {
            LessonSentenceWithLink(
                "Keep going, there is nothing to sign up for.",
                link: "Or make it permanent.",
                color: LF.Palette.graphite
            ) {
                onAccount(.signUp)
            }
            .font(LF.Fonts.body(15.5, relativeTo: .callout))
        }
    }

    /// The reward for passing: the reasoning behind every question. Folded away, below the
    /// primary action, so it informs without standing between the reader and the next lesson.
    private var reasons: some View {
        VStack(alignment: .leading, spacing: 0) {
            DashedRule()
            Button {
                LF.Motion.perform(LF.Motion.settle) { showReasons.toggle() }
            } label: {
                HStack {
                    Text("Why those answers were right")
                        .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 12)
                    Text(showReasons ? "close" : "open")
                        .font(LF.Fonts.mono(13, relativeTo: .footnote))
                        .foregroundStyle(LF.Palette.blue)
                }
                .frame(minHeight: LF.Metrics.tap)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.top, 8)
            // Read like a system disclosure: the name, then its state. The printed "open" and
            // "close" are what tapping does, so VoiceOver doesn't read them as part of the name.
            .accessibilityLabel("Why those answers were right")
            .accessibilityValue(showReasons ? "Expanded" : "Collapsed")
            .accessibilityHint(showReasons ? "Hides the explanations" : "Shows the explanation for each question")
            #if os(macOS)
            .pointerStyle(.link)
            #endif

            if showReasons {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(Array(content.quiz.enumerated()), id: \.offset) { _, question in
                        if !question.explanation.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(LessonText.inline(question.question, size: 15.5, weight: .bold, relativeTo: .callout))
                                    .foregroundStyle(LF.Palette.ink)
                                Text(LessonText.inline(question.explanation, size: 15.5, relativeTo: .callout))
                                    .foregroundStyle(LF.Palette.graphite)
                                    .lineSpacing(3)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                .padding(.top, 8)
                .textSelection(.enabled)
                .transition(.opacity)
            }
        }
    }

    private func errorLine(_ message: String) -> some View {
        Text(message)
            .font(LF.Fonts.body(15, relativeTo: .callout))
            .foregroundStyle(LF.Palette.ink)
            .padding(.leading, 12)
            .overlay(alignment: .leading) {
                Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.heavyStroke)
            }
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel("Couldn't save. \(message)")
    }
}

// MARK: - The milestone share

/// A one-time referral ask, spent only on a milestone (first lesson ever, or reaching ten),
/// so a build-season evening of lessons doesn't turn it into spam.
struct LessonMilestone: Hashable, Sendable {
    enum Key: String, Hashable, Sendable {
        case firstLesson = "first-lesson"
        case tenLessons = "ten-lessons"
    }

    let key: Key
    /// The true lifetime lesson count when it fired.
    let total: Int

    /// Lifetime count at which the second (and last) rung fires.
    static let deepIn = 10

    private static func defaultsKey(_ key: Key) -> String { "lf_milestone_share_\(key.rawValue)" }

    static func hasSeen(_ key: Key) -> Bool {
        UserDefaults.standard.bool(forKey: defaultsKey(key))
    }

    static func remember(_ key: Key) {
        UserDefaults.standard.set(true, forKey: defaultsKey(key))
    }

    /// The rung a completion just reached, if it hasn't been shown on this device before.
    static func resolve(total: Int) -> LessonMilestone? {
        let key: Key? = total == 1 ? .firstLesson : (total >= deepIn ? .tenLessons : nil)
        guard let key, !hasSeen(key) else { return nil }
        return LessonMilestone(key: key, total: total)
    }

    var slug: String { key == .firstLesson ? "first lesson done" : "\(total) lessons done" }

    var title: String { key == .firstLesson ? "Bring your team along" : "Worth passing to your team" }

    var body: String {
        key == .firstLesson
            ? "It's free for them too. Your link drops a teammate into the same lessons, and you both pick up +25 XP when they join."
            : "You've covered \(total) lessons. Your link starts a teammate where you started, and you both pick up +25 XP when they join."
    }

    var shareText: String {
        key == .firstLesson
            ? "I'm learning FRC on LearnFRC, free lessons for every subteam, from CAD to scouting. Here's my link if you want in:"
            : "I've done \(total) lessons on LearnFRC, free FRC guides for every subteam. Here's my link if you want in:"
    }
}

/// The milestone card: an index card taped into the sign-off at an angle nothing else uses.
private struct LessonMilestoneCard: View {
    let milestone: LessonMilestone
    let username: String
    let onDismiss: () -> Void

    var body: some View {
        NotebookCard(tilt: .preset(3), tape: true, tapeAngle: -5) {
            SlugText(milestone.slug)
            Text(milestone.title)
                .lessonHeading(19)
                .padding(.top, 6)
            Text(milestone.body)
                .font(LF.Fonts.body(15.5, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            DashedRule()
                .padding(.top, 16)
            HStack(spacing: 16) {
                ShareLink(
                    item: LessonLinks.referral(username: username),
                    subject: Text("LearnFRC"),
                    message: Text(milestone.shareText)
                ) {
                    Text("Send to a teammate")
                }
                .buttonStyle(.ink)
                LessonQuietButton("Not now") {
                    LessonMilestone.remember(milestone.key)
                    onDismiss()
                }
            }
            .padding(.top, 14)
        }
    }
}
