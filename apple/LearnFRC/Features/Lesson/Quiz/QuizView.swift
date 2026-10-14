import SwiftUI

/// The lesson's answer sheet, and the sign-off it turns into once it's cleared.
///
///     QuizView(lessonID: lesson.id, quiz: body.quiz, nextLesson: next) { goToNext() }
///
/// Same rules as learnfrc.com (`lesson-complete.tsx`), kept in `QuizSheet`:
/// every question must be right; a right answer stays banked through every retry; the
/// explanation appears after the same question is missed twice; the right option is never
/// revealed. A full pass calls `ProgressStore.complete(lessonID:answers:)`, so the server
/// re-grades it; the sign-off shows the real XP and badges from that response, "saved, will
/// sync" when it was queued offline, and "on this device" for guests.
///
/// A lesson with no quiz gets the site's "Read it all?" block with a single "Mark complete".
struct QuizView: View {
    let lessonID: UUID
    let quiz: [QuizQuestion]
    var nextLesson: LessonLocation?
    /// Opens the next lesson (or the department when this is the last one). nil hides the button.
    var onContinue: (() -> Void)?
    /// Called after the card changes height (passed, or marked unread), so the lesson can
    /// bring it back into view.
    var onSettled: (() -> Void)?
    /// Asks the lesson to scroll to an anchor on the sheet (the first question to redo after
    /// a retry, `QuizView.questionAnchor(_:)`).
    var onScrollTo: ((String) -> Void)?
    /// Where the quiz leaves its state for when it's built again (the window's
    /// `WindowNavigation.memory`): the Mac rebuilds a tab's stack on every tab switch, and a
    /// half-answered quiz should come back as it was. nil keeps nothing.
    var memory: ScreenMemory?
    /// The tab whose stack the lesson sits in (`\.navigationTab`). The quiz is kept per tab:
    /// the same lesson open in two tabs has two answer sheets.
    var memoryTab: AppTab?

    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(CatalogStore.self) private var catalog
    @Environment(\.lessonAccountRequest) private var accountRequest
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Every @State here is set exactly once, in the designated init (no declared defaults to
    // overwrite: with iOS 27's @State macro an init can't replace a declared initial value).
    @State private var sheet: QuizSheet
    @State private var isSaving: Bool
    @State private var message: String?
    @State private var session: CompletionResult?
    @State private var justPassed: Bool
    @State private var milestone: LessonMilestone?
    @ScaledMetric(relativeTo: .body) private var padding: CGFloat = 22

    /// The scroll anchor of question `index` on the answer sheet.
    static func questionAnchor(_ index: Int) -> String { "lesson-quiz-question-\(index)" }

    /// What the quiz keeps in `memory`, under `"quiz/<tab>/<lesson id>"`: everything on the
    /// card that isn't in `ProgressStore`, so a rebuilt card looks the way it was left.
    struct Remembered: Hashable, Sendable {
        var sheet: QuizSheet
        var session: CompletionResult?
        var justPassed: Bool
        var milestone: LessonMilestone?
    }

    /// One tab's answer sheet for a lesson ("-" outside a tab, as in previews).
    static func memoryKey(_ lessonID: UUID, tab: AppTab?) -> String {
        "quiz/\(tab?.rawValue ?? "-")/\(lessonID.uuidString)"
    }

    init(
        lessonID: UUID,
        quiz: [QuizQuestion],
        nextLesson: LessonLocation? = nil,
        memory: ScreenMemory? = nil,
        memoryTab: AppTab? = nil,
        onContinue: (() -> Void)? = nil,
        onSettled: (() -> Void)? = nil,
        onScrollTo: ((String) -> Void)? = nil
    ) {
        let fresh = QuizSheet(quiz: quiz)
        // Only a sheet for these same questions: the catalogue may have changed the quiz since.
        let kept = memory?.value(Remembered.self, for: Self.memoryKey(lessonID, tab: memoryTab))
            .flatMap { $0.sheet.key == fresh.key && $0.sheet.optionCounts == fresh.optionCounts ? $0 : nil }
        self.init(
            lessonID: lessonID,
            quiz: quiz,
            nextLesson: nextLesson,
            memory: memory,
            memoryTab: memoryTab,
            onContinue: onContinue,
            onSettled: onSettled,
            onScrollTo: onScrollTo,
            startingSheet: kept?.sheet ?? fresh,
            startingSession: kept?.session,
            startingJustPassed: kept?.justPassed,
            startingMilestone: kept?.milestone
        )
    }

    /// Previews: start from a given sheet or a completion made "on this screen".
    init(
        lessonID: UUID,
        quiz: [QuizQuestion],
        nextLesson: LessonLocation? = nil,
        previewSheet: QuizSheet,
        previewSession: CompletionResult? = nil
    ) {
        self.init(
            lessonID: lessonID,
            quiz: quiz,
            nextLesson: nextLesson,
            memory: nil,
            memoryTab: nil,
            onContinue: {},
            onSettled: nil,
            onScrollTo: nil,
            startingSheet: previewSheet,
            startingSession: previewSession,
            startingJustPassed: nil,
            startingMilestone: nil
        )
    }

    private init(
        lessonID: UUID,
        quiz: [QuizQuestion],
        nextLesson: LessonLocation?,
        memory: ScreenMemory?,
        memoryTab: AppTab?,
        onContinue: (() -> Void)?,
        onSettled: (() -> Void)?,
        onScrollTo: ((String) -> Void)?,
        startingSheet: QuizSheet,
        startingSession: CompletionResult?,
        startingJustPassed: Bool?,
        startingMilestone: LessonMilestone?
    ) {
        self.lessonID = lessonID
        self.quiz = quiz
        self.nextLesson = nextLesson
        self.memory = memory
        self.memoryTab = memoryTab
        self.onContinue = onContinue
        self.onSettled = onSettled
        self.onScrollTo = onScrollTo
        _sheet = State(initialValue: startingSheet)
        _isSaving = State(initialValue: false)
        _message = State(initialValue: nil)
        _session = State(initialValue: startingSession)
        _justPassed = State(initialValue: startingJustPassed ?? (startingSession != nil))
        _milestone = State(initialValue: startingMilestone)
    }

    private var isCompleted: Bool { progress.isCompleted(lessonID) }
    /// Until the account state is known a completion could go to the wrong place, so the
    /// controls wait (the site's `ready`).
    private var ready: Bool { !account.isLoading }

    var body: some View {
        // A ZStack, not a Group: while the answer sheet fades into the sign-off they overlap
        // in place, so the card's top stays where the sheet's was and the page doesn't jump
        // down to whatever followed the (much taller) sheet.
        ZStack(alignment: .top) {
            if isCompleted {
                QuizSignOffCard(
                    content: signOffContent,
                    onContinue: { onContinue?() },
                    onMarkUnread: { Task { await markUnread() } },
                    onDismissMilestone: { milestone = nil },
                    onAccount: requestAccount
                )
                .transition(.opacity)
            } else if sheet.hasQuiz {
                answerSheet
                    .transition(.opacity)
            } else {
                noQuiz
                    .transition(.opacity)
            }
        }
        .animation(reduceMotion ? nil : LF.Motion.arrive, value: isCompleted)
        .onChange(of: isCompleted) { wasCompleted, nowCompleted in
            // Marked unread somewhere else (another device, the header): hand back a fresh sheet.
            if wasCompleted, !nowCompleted, !isSaving {
                sheet.reset()
                justPassed = false
                session = nil
                milestone = nil
            }
        }
        // Kept for when this card is built again (a Mac tab switch). Never read back while
        // the card is alive, so nothing here can feed back into it.
        .onChange(of: remembered) { _, remembered in
            memory?.set(remembered, for: Self.memoryKey(lessonID, tab: memoryTab))
        }
    }

    private var remembered: Remembered {
        Remembered(sheet: sheet, session: session, justPassed: justPassed, milestone: milestone)
    }

    // MARK: The answer sheet

    private var answerSheet: some View {
        VStack(alignment: .leading, spacing: 0) {
            // The tag sits at the end of the heading's line when the whole heading fits beside
            // it, and otherwise under it, so the heading never gets squeezed into a column.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    LessonSectionHeading(slug: "answer sheet", title: "Lesson quiz", size: 25)
                        .fixedSize()
                    Spacer(minLength: 8)
                    TagView("required")
                        .fixedSize()
                }
                VStack(alignment: .leading, spacing: 10) {
                    LessonSectionHeading(slug: "answer sheet", title: "Lesson quiz", size: 25)
                    TagView("required")
                        .fixedSize()
                }
            }

            Text("All \(sheet.count) right completes the lesson. Miss one and only that question comes back, anything you already answered correctly stays banked.")
                .font(LF.Fonts.body(16, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)

            MeterView(
                value: Double(sheet.meterCount) / Double(max(1, sheet.count)),
                label: sheet.attempts > 0 ? "banked" : "answered",
                valueText: "\(sheet.meterCount) of \(sheet.count)"
            )
            .accessibilityLabel("Quiz progress, \(sheet.attempts > 0 ? "banked" : "answered")")
            .padding(.top, 18)

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(quiz.enumerated()), id: \.offset) { index, question in
                    QuizQuestionView(index: index, question: question, sheet: sheet) { option in
                        guard sheet.canSelect(index) else { return }
                        if sheet.selection(index) != option { Haptics.select() }
                        sheet.select(option, for: index)
                    }
                    .padding(.vertical, 18)
                    .overlay(alignment: .top) {
                        if index > 0 { DashedRule() }
                    }
                    .id(Self.questionAnchor(index))
                }
            }
            .padding(.top, 10)
            .animation(reduceMotion ? nil : LF.Motion.settle, value: sheet)

            footer
                .padding(.top, 18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { InkRule() }
                .padding(.top, 6)
        }
        .padding(LessonLayout.cardPadding(padding))
        .background { NotebookBoxBackground(size: .a, shadow: .card) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lesson quiz")
    }

    @ViewBuilder
    private var footer: some View {
        if sheet.graded && !sheet.passed {
            VStack(alignment: .leading, spacing: 14) {
                Text(gradedStatus)
                    .font(LF.Fonts.body(16, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.graphite)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
                Button(retryLabel) {
                    retry()
                }
                .buttonStyle(.ink)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else if !sheet.graded || isSaving {
            VStack(alignment: .leading, spacing: 10) {
                Button {
                    submit()
                } label: {
                    Text(isSaving ? "Saving…" : "Submit and complete")
                }
                .buttonStyle(.inkLarge)
                .disabled(!sheet.allAnswered || isSaving || !ready)
                .accessibilityHint(sheet.allAnswered ? "Grades every answer. All right completes the lesson." : "Answer every question first.")
                if !sheet.allAnswered {
                    SlugText("Answer every question to submit.")
                }
                if let message {
                    errorLine(message)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var gradedStatus: AttributedString {
        if sheet.lockedCount > 0 {
            var lead = AttributedString("\(sheet.lockedCount) of \(sheet.count) banked.")
            lead.font = LF.Fonts.body(16, weight: .bold, relativeTo: .callout)
            lead.foregroundColor = LF.Palette.ink
            return lead + AttributedString(" Just \(sheet.remaining) to go, the rest stay saved.")
        }
        return AttributedString("Not this time. Nothing is lost, take another run at \(sheet.count == 1 ? "it" : "them").")
    }

    private var retryLabel: String {
        if sheet.remaining == sheet.count { return "Try again" }
        return sheet.remaining == 1 ? "Retry that one" : "Retry those \(sheet.remaining)"
    }

    // MARK: No quiz written yet

    private var noQuiz: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("nothing to answer on this one")
            Text("Read it all?")
                .lessonHeading(22)
                .padding(.top, 6)
            Text("Mark it complete and it counts toward the department, signed in or not.")
                .font(LF.Fonts.body(16, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            Button(isSaving ? "Saving…" : "Mark complete") {
                guard ready, !isSaving else { return }
                Haptics.success()
                justPassed = true
                save(answers: [])
            }
            .buttonStyle(.inkLarge)
            .disabled(isSaving || !ready)
            .padding(.top, 16)
            if let message {
                errorLine(message)
                    .padding(.top, 10)
            }
        }
        .padding(.top, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { InkRule() }
    }

    // MARK: The sign-off

    private var signOffContent: QuizSignOffCard.Content {
        let signedIn = account.isSignedIn
        let stored = progress.completions.first { $0.lessonID == lessonID }
        return QuizSignOffCard.Content(
            completedOn: stored?.completedAt,
            signedIn: signedIn,
            completedTotal: session?.delivery == .server ? max(session?.completedCount ?? 0, progress.completedTotal) : progress.completedTotal,
            session: session,
            justPassed: justPassed,
            isPending: progress.isPending(lessonID),
            storedXP: stored?.xpAwarded ?? 0,
            momentumBadge: catalog.achievement(slug: "five-lessons")?.name ?? "Warmed Up",
            nextTitle: nextLesson?.lesson.title,
            hasContinue: onContinue != nil,
            quiz: quiz,
            milestone: milestone,
            username: account.profile?.username,
            isSaving: isSaving,
            ready: ready,
            message: message
        )
    }

    // MARK: Actions

    private func submit() {
        guard ready, !isSaving, sheet.allAnswered else { return }
        let passed = sheet.grade()
        if passed {
            Haptics.success()
            justPassed = true
            save(answers: sheet.submission)
        } else {
            Haptics.warning()
            lessonAnnounce(String(gradedStatus.characters))
        }
    }

    /// Back to the questions still wrong, and the page to the first of them (it's usually
    /// above the fold by now: the retry button sits at the foot of the sheet).
    private func retry() {
        LF.Motion.perform(LF.Motion.settle) { sheet.retry() }
        Haptics.select()
        if let first = quiz.indices.first(where: { !sheet.isLocked($0) }) {
            onScrollTo?(Self.questionAnchor(first))
        }
    }

    /// Starts saving. `isSaving` goes up before the task, in the same tap, so a fast second
    /// tap finds the button already disabled and can't send a second completion.
    private func save(answers: [Int]) {
        isSaving = true
        message = nil
        Task { await persist(answers: answers) }
    }

    /// Saves the completion. The server re-grades the answers and is the authority for XP.
    private func persist(answers: [Int]) async {
        isSaving = true
        defer { isSaving = false }
        do {
            let result = try await progress.complete(lessonID: lessonID, answers: answers)
            session = result
            if result.delivery == .server, account.profile?.username?.isEmpty == false {
                let total = max(result.completedCount, progress.completedTotal)
                if let reached = LessonMilestone.resolve(total: total) {
                    // Spent as soon as the completion is real, whether or not they share.
                    LessonMilestone.remember(reached.key)
                    milestone = reached
                }
            }
            lessonAnnounce(announcement(for: result))
            onSettled?()
        } catch {
            // The pass didn't stick: hand the sheet back, answers kept, ready to submit again.
            justPassed = false
            sheet.reopen()
            message = APIError.from(error).message
            Haptics.warning()
            lessonAnnounce("Couldn't save. \(APIError.from(error).message)")
        }
    }

    /// "Mark it unread again": the server refunds the XP; a fresh sheet comes back.
    private func markUnread() async {
        guard ready, !isSaving else { return }
        isSaving = true
        message = nil
        defer { isSaving = false }
        let previous = (sheet, justPassed, session, milestone)
        sheet.reset()
        justPassed = false
        session = nil
        milestone = nil
        do {
            try await progress.uncomplete(lessonID: lessonID)
            Haptics.select()
            lessonAnnounce("Marked unread. The quiz is ready again.")
            onSettled?()
        } catch {
            (sheet, justPassed, session, milestone) = previous
            message = APIError.from(error).message
        }
    }

    private func announcement(for result: CompletionResult) -> String {
        switch result.delivery {
        case .server:
            var text = "Lesson complete. Plus \(result.xpAwarded) XP."
            if !result.newAchievements.isEmpty {
                text += " Badge unlocked: \(result.newAchievements.map(\.name).joined(separator: ", "))."
            }
            return text
        case .queued: return "Lesson complete. Saved on this device, it will sync when you're back online."
        case .guest: return "Lesson complete. Saved on this device."
        }
    }

    private func requestAccount(_ request: LessonAccountRequest) {
        if let accountRequest {
            accountRequest(request)
        } else if let location = catalog.location(of: lessonID) {
            openURL(request == .signUp
                ? LessonLinks.signUp(next: location, ref: "lesson-complete")
                : LessonLinks.logIn(next: location))
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

// MARK: - Previews

@MainActor
private enum QuizPreview {
    /// "Building Autonomous Routines": not finished in the preview account.
    static var lesson: LessonLocation { PreviewData.lessonLocation }
    static var quiz: [QuizQuestion] { PreviewData.lessonBody.quiz }
    /// "Programming Basics": already finished in the preview account.
    static var doneLesson: LessonLocation { PreviewData.location(PreviewData.verifiedLessonBody.id) }

    /// Two submits in: one banked, two missed twice (explanations showing).
    static var stuckSheet: QuizSheet {
        var sheet = QuizSheet(quiz: quiz)
        sheet.select(2, for: 0)
        sheet.select(1, for: 1)
        sheet.select(0, for: 2)
        sheet.grade()
        sheet.retry()
        sheet.select(2, for: 1)
        sheet.select(3, for: 2)
        sheet.grade()
        return sheet
    }

    static func page<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            content()
                .padding(LF.Metrics.gutter)
                .padding(.vertical, 12)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
        }
        .paperBackground()
    }
}

#Preview("Fresh sheet, iPhone", traits: .fixedLayout(width: 393, height: 1300)) {
    QuizPreview.page {
        QuizView(lessonID: QuizPreview.lesson.id, quiz: QuizPreview.quiz, nextLesson: nil) {}
    }
    .appEnvironment(.preview)
}

#Preview("Missed twice, iPhone dark", traits: .fixedLayout(width: 393, height: 1500)) {
    QuizPreview.page {
        QuizView(lessonID: QuizPreview.lesson.id, quiz: QuizPreview.quiz, previewSheet: QuizPreview.stuckSheet)
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}

#Preview("Signed off with XP, iPad", traits: .fixedLayout(width: 820, height: 1100)) {
    QuizPreview.page {
        QuizView(
            lessonID: QuizPreview.doneLesson.id,
            quiz: PreviewData.verifiedLessonBody.quiz,
            nextLesson: PreviewData.allLessons[1],
            previewSheet: QuizSheet(quiz: PreviewData.verifiedLessonBody.quiz),
            previewSession: PreviewData.completionResult
        )
    }
    .appEnvironment(.preview)
}

#Preview("Signed off, guest, iPad dark", traits: .fixedLayout(width: 820, height: 900)) {
    QuizPreview.page {
        QuizView(lessonID: PreviewData.allLessons[0].id, quiz: PreviewData.verifiedLessonBody.quiz, nextLesson: PreviewData.allLessons[1]) {}
    }
    .appEnvironment(.preview(signedIn: false))
    .environment(\.colorScheme, .dark)
}

#Preview("Sheet and sign-off side by side", traits: .fixedLayout(width: 1240, height: 1500)) {
    ScrollView {
        HStack(alignment: .top, spacing: 36) {
            QuizView(lessonID: QuizPreview.lesson.id, quiz: QuizPreview.quiz, previewSheet: QuizPreview.stuckSheet)
            QuizView(
                lessonID: QuizPreview.doneLesson.id,
                quiz: PreviewData.verifiedLessonBody.quiz,
                nextLesson: PreviewData.allLessons[1],
                previewSheet: QuizSheet(quiz: PreviewData.verifiedLessonBody.quiz),
                previewSession: PreviewData.completionResult
            )
        }
        .padding(32)
    }
    .paperBackground()
    .appEnvironment(.preview(phase: .firstLesson))
}
