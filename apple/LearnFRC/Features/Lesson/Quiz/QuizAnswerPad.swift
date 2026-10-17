import SwiftUI

// The quiz's answers in the bottom half of iPhone Duo in laptop posture.
//
// Held sideways and half open on a table, the top half is the screen to read and the bottom
// half is the one under your thumbs. The lesson keeps the answer sheet where it always is, in
// the page in the top half, scrolled to the question being answered, and puts that question's
// options in the bottom half as well, on the pad. Both show the one `QuizSheet` that
// `QuizView` keeps: a pick on either side shows on the other, and the sheet's rules (banked
// answers, the explanation after two misses, the right option never shown) are untouched.
//
// `QuizView` hands the pad up as a preference while the lesson asks for it
// (`\.lessonQuizPadRequested`); `LessonFlexDeck` shows it.

/// Everything the pad shows and does, from `QuizView`.
struct QuizPadModel {
    enum Content {
        /// The answer sheet: the question being answered and its options.
        case questions(QuizQuestion)
        /// A lesson with no quiz: "Read it all?" and "Mark complete".
        case markComplete
    }

    var content: Content
    /// The question on the pad (0-based) and how many there are.
    var index: Int
    var count: Int
    var sheet: QuizSheet
    var isSaving: Bool
    var ready: Bool
    var message: String?
    /// "1 of 3 banked. Just 2 to go, the rest stay saved." after a submit with misses.
    var gradedStatus: AttributedString
    /// "Retry those 2", "Retry that one", "Try again".
    var retryLabel: String
    /// Picks an option for the question on the pad.
    var select: @MainActor (Int) -> Void
    /// Shows another question on the pad (and scrolls the page to it).
    var show: @MainActor (Int) -> Void
    var submit: @MainActor () -> Void
    var retry: @MainActor () -> Void
    var markComplete: @MainActor () -> Void

    /// The questions still open (not banked), in order: the ones the pad steps through.
    var openQuestions: [Int] { (0..<count).filter { !sheet.isLocked($0) } }

    var previous: Int? { openQuestions.last { $0 < index } }
    var next: Int? { openQuestions.first { $0 > index } }
}

/// Carries the pad from `QuizView`, inside the lesson's scrolling page, up to the lesson.
struct QuizPadPreference: PreferenceKey {
    static var defaultValue: QuizPadModel? { nil }

    static func reduce(value: inout QuizPadModel?, nextValue: () -> QuizPadModel?) {
        if value == nil { value = nextValue() }
    }
}

extension EnvironmentValues {
    /// Set by the lesson while it shows its laptop-posture deck: the quiz then hands its answer
    /// pad up (`QuizPadPreference`). Off everywhere else, so the quiz builds nothing extra.
    @Entry var lessonQuizPadRequested = false
}

/// The pad: which question this is, its options as big targets, and the sheet's own submit
/// and retry controls with the same words (`QuizPadFooter`, which the deck pins at its foot so
/// it's in reach however far the options run; pass `showsFooter: false` then).
struct QuizAnswerPad: View {
    let model: QuizPadModel
    var showsFooter = true

    @ScaledMetric(relativeTo: .body) private var badgeSize: CGFloat = 26
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch model.content {
            case .questions(let question):
                header
                options(question)
                if showsFooter {
                    QuizPadFooter(model: model)
                        .padding(.top, 4)
                }
            case .markComplete:
                markComplete
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Answer pad")
    }

    // MARK: Questions

    private var header: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                SlugText("answer sheet")
                Text("Question \(model.index + 1) of \(model.count)")
                    .lessonHeading(19)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            stepButton("Previous question", systemImage: "chevron.backward", target: model.previous)
            stepButton("Next question", systemImage: "chevron.forward", target: model.next)
        }
    }

    private func stepButton(_ title: String, systemImage: String, target: Int?) -> some View {
        Button {
            if let target { model.show(target) }
        } label: {
            Image(systemName: systemImage)
                .font(.body.weight(.bold))
                .foregroundStyle(target == nil ? LF.Palette.rule : LF.Palette.ink)
                .frame(width: LF.Metrics.tap, height: LF.Metrics.tap)
                .background {
                    HandShape(.s).strokeBorder(target == nil ? LF.Palette.rule : LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(target == nil)
        .accessibilityLabel(title)
    }

    private func options(_ question: QuizQuestion) -> some View {
        let index = model.index
        return VStack(spacing: 8) {
            ForEach(Array(question.options.enumerated()), id: \.offset) { option, text in
                QuizOptionRow(
                    letter: QuizQuestionView.letter(option),
                    text: text,
                    state: model.sheet.state(question: index, option: option),
                    enabled: model.sheet.canSelect(index),
                    badgeSize: badgeSize,
                    stacked: typeSize.isAccessibilitySize
                ) {
                    model.select(option)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Question \(index + 1) options")
    }

    // MARK: No quiz

    private var markComplete: some View {
        VStack(alignment: .leading, spacing: 8) {
            SlugText("nothing to answer on this one")
            Text("Read it all?")
                .lessonHeading(21)
            Text("Mark it complete and it counts toward the department, signed in or not.")
                .font(LF.Fonts.body(16, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
            Button(model.isSaving ? "Saving…" : "Mark complete") { model.markComplete() }
                .buttonStyle(.ink)
                .disabled(model.isSaving || !model.ready)
                .padding(.top, 6)
            if let message = model.message {
                QuizPadErrorLine(message: message)
            }
        }
    }
}

/// The answer sheet's submit, or after misses its status and retry, with the sheet's words.
/// Nothing for a lesson with no quiz (its pad has its own "Mark complete").
struct QuizPadFooter: View {
    let model: QuizPadModel

    /// There's something to show.
    static func shows(_ model: QuizPadModel) -> Bool {
        guard case .questions = model.content else { return false }
        let sheet = model.sheet
        return (sheet.graded && !sheet.passed) || !sheet.graded || model.isSaving
    }

    var body: some View {
        let sheet = model.sheet
        if case .questions = model.content {
            if sheet.graded && !sheet.passed {
                VStack(alignment: .leading, spacing: 12) {
                    Text(model.gradedStatus)
                        .font(LF.Fonts.body(16, relativeTo: .callout))
                        .foregroundStyle(LF.Palette.graphite)
                        .lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)
                    Button(model.retryLabel) { model.retry() }
                        .buttonStyle(.ink)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else if !sheet.graded || model.isSaving {
                VStack(alignment: .leading, spacing: 10) {
                    Button {
                        model.submit()
                    } label: {
                        Text(model.isSaving ? "Saving…" : "Submit and complete")
                    }
                    .buttonStyle(.ink)
                    .disabled(!sheet.allAnswered || model.isSaving || !model.ready)
                    .accessibilityHint(sheet.allAnswered ? "Grades every answer. All right completes the lesson." : "Answer every question first.")
                    if !sheet.allAnswered {
                        SlugText("Answer every question to submit.")
                    }
                    if let message = model.message {
                        QuizPadErrorLine(message: message)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

/// "Couldn't save" under a pad's button: the sheet's heavy ink bar and the server's words.
private struct QuizPadErrorLine: View {
    let message: String

    var body: some View {
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

#if DEBUG
@MainActor
private enum QuizPadPreview {
    static func model(_ sheet: QuizSheet, index: Int = 1) -> QuizPadModel {
        let quiz = PreviewData.lessonBody.quiz
        return QuizPadModel(
            content: .questions(quiz[index]),
            index: index,
            count: quiz.count,
            sheet: sheet,
            isSaving: false,
            ready: true,
            message: nil,
            gradedStatus: AttributedString("1 of 3 banked. Just 2 to go, the rest stay saved."),
            retryLabel: "Retry those 2",
            select: { _ in }, show: { _ in }, submit: {}, retry: {}, markComplete: {}
        )
    }
}

#Preview("Answer pad, laptop bottom half", traits: .fixedLayout(width: 669, height: 372)) {
    var sheet = QuizSheet(quiz: PreviewData.lessonBody.quiz)
    sheet.select(2, for: 0)
    sheet.select(1, for: 1)
    return ScrollView {
        QuizAnswerPad(model: QuizPadPreview.model(sheet))
            .padding(26)
    }
    .paperBackground()
}
#endif
