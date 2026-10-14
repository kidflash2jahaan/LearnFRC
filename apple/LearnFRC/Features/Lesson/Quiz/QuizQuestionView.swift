import SwiftUI

/// One question on the answer sheet: the number, the question, the banked or "take it again"
/// mark, the options as a radio group, and the explanation once it has been missed twice.
///
/// Every state is carried by two signals at once, a fill and a word or glyph, so right,
/// banked and wrong are still three different things in greyscale (the site's rule).
struct QuizQuestionView: View {
    let index: Int
    let question: QuizQuestion
    let sheet: QuizSheet
    let onSelect: (Int) -> Void

    @ScaledMetric(relativeTo: .body) private var badgeSize: CGFloat = 26
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            VStack(spacing: 8) {
                ForEach(Array(question.options.enumerated()), id: \.offset) { option, text in
                    QuizOptionRow(
                        letter: Self.letter(option),
                        text: text,
                        state: sheet.state(question: index, option: option),
                        enabled: sheet.canSelect(index),
                        badgeSize: badgeSize,
                        stacked: typeSize.isAccessibilitySize
                    ) {
                        onSelect(option)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Question \(index + 1) options")

            if sheet.showsExplanation(index), !question.explanation.isEmpty {
                NoteCallout {
                    SlugText("here is the idea")
                    Text(LessonText.inline(question.explanation, size: 15.5, relativeTo: .callout))
                        .foregroundStyle(LF.Palette.ink)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .transition(.opacity)
            }
        }
    }

    /// The number, the question, and its mark. The mark sits at the end of the line, like the
    /// site, only when the whole question fits on that line beside it; otherwise it drops onto
    /// its own line under the question, so the question always keeps the full width to wrap in
    /// (no "ParallelDeadlineGr / oup" squeezed beside a chip). At the accessibility sizes the
    /// number goes above the question for the same reason.
    @ViewBuilder
    private var header: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 4) {
                number
                questionLine
            }
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                number
                questionLine
            }
        }
    }

    private var number: some View {
        Text(String(format: "%02d", index + 1))
            .font(LF.Fonts.mono(13, relativeTo: .footnote))
            .monospacedDigit()
            .foregroundStyle(LF.Palette.graphite)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var questionLine: some View {
        if hasMark {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    questionText
                        .fixedSize()
                    Spacer(minLength: 0)
                    mark
                }
                VStack(alignment: .leading, spacing: 8) {
                    questionText
                    mark
                }
            }
        } else {
            questionText
        }
    }

    private var questionText: some View {
        Text(LessonText.inline(question.question, size: 17, weight: .bold, relativeTo: .headline))
            .foregroundStyle(LF.Palette.ink)
            .lineSpacing(2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
            .accessibilityLabel("Question \(index + 1). \(LessonText.plain(question.question))")
    }

    private var hasMark: Bool { sheet.isLocked(index) || sheet.wasWrong(index) }

    @ViewBuilder
    private var mark: some View {
        if sheet.isLocked(index) {
            TagView("banked", on: true)
                .fixedSize()
        } else if sheet.wasWrong(index) {
            QuizRetakeTag()
                .fixedSize()
        }
    }

    static func letter(_ option: Int) -> String {
        guard option >= 0, option < 26 else { return "\(option + 1)" }
        return String(UnicodeScalar(UInt8(65 + option)))
    }
}

/// "take it again": the chip with a heavy 3pt ink edge (the site's wrong-question mark).
private struct QuizRetakeTag: View {
    @ScaledMetric(relativeTo: .caption2) private var vertical: CGFloat = 4
    @ScaledMetric(relativeTo: .caption2) private var horizontal: CGFloat = 9

    var body: some View {
        Text("take it again")
            .font(LF.Fonts.mono(12, relativeTo: .caption))
            .tracking(12 * 0.03)
            .lineLimit(1)
            .foregroundStyle(LF.Palette.ink)
            .padding(.vertical, vertical)
            .padding(.horizontal, horizontal)
            .background {
                ZStack {
                    HandShape(.s).fill(LF.Palette.card)
                    HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.heavyStroke)
                }
            }
    }
}

/// One option: a lettered badge and the answer text in a hand-ruled box.
///
/// - idle: ink edge on card stock, letter in a pale box. Under a pointer it slides 4pt right
///   on a faint blue wash (not under Reduce Motion; the wash stays).
/// - selected: blue edge and wash, blue letter.
/// - correct (banked): blue edge and wash, a solid blue badge with a check.
/// - wrong: a heavy 3pt ink edge, a solid ink badge with a cross, and the text struck through.
private struct QuizOptionRow: View {
    let letter: String
    let text: String
    let state: QuizSheet.OptionState
    let enabled: Bool
    let badgeSize: CGFloat
    /// The letter above the answer instead of beside it (the accessibility sizes), so the
    /// answer keeps the row's full width.
    var stacked = false
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hovering = false

    private var isSelected: Bool { state != .idle }

    var body: some View {
        Button(action: action) {
            Group {
                if stacked {
                    VStack(alignment: .leading, spacing: 8) {
                        badge
                        answer
                    }
                } else {
                    HStack(alignment: .center, spacing: 12) {
                        badge
                        answer
                    }
                }
            }
            .padding(.horizontal, stacked ? 10 : 14)
            .padding(.vertical, 10)
            .frame(minHeight: LF.Metrics.tap)
            .background {
                ZStack {
                    HandShape(.s).fill(LF.Palette.card)
                    HandShape(.s).fill(wash)
                    HandShape(.s).strokeBorder(edge, lineWidth: state == .wrong ? LF.Metrics.heavyStroke : LF.Metrics.stroke)
                }
            }
            .offset(x: hovering && state == .idle && enabled && !reduceMotion ? 4 : 0)
            .contentShape(HandShape(.s))
        }
        .buttonStyle(QuizOptionPressStyle())
        .disabled(!enabled)
        .onHover { hovering = $0 }
        .animation(reduceMotion ? nil : LF.Motion.hover, value: hovering)
        #if os(macOS)
        .pointerStyle(enabled ? .link : nil)
        #else
        .hoverEffectDisabled()
        #endif
        .accessibilityLabel(accessibilityText)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityHint(enabled ? "Choose this answer" : "")
    }

    private var answer: some View {
        Text(LessonText.inline(text, size: 16, relativeTo: .callout))
            .foregroundStyle(LF.Palette.ink)
            .strikethrough(state == .wrong, color: LF.Palette.ink)
            .multilineTextAlignment(.leading)
            .lineSpacing(2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var wash: Color {
        switch state {
        case .selected, .correct: LF.Palette.blue.opacity(0.08)
        case .idle: hovering && enabled ? LF.Palette.hoverWash : .clear
        case .wrong: .clear
        }
    }

    private var edge: Color {
        switch state {
        case .selected, .correct: LF.Palette.blue
        case .idle, .wrong: LF.Palette.ink
        }
    }

    private var badge: some View {
        ZStack {
            HandShape(.s).fill(badgeFill)
            HandShape(.s).strokeBorder(badgeEdge, lineWidth: LF.Metrics.stroke)
            Group {
                switch state {
                case .correct: Image(systemName: "checkmark").fontWeight(.bold)
                case .wrong: Image(systemName: "xmark").fontWeight(.bold)
                default: Text(letter)
                }
            }
            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
            .foregroundStyle(badgeText)
        }
        .frame(width: badgeSize, height: badgeSize)
        .accessibilityHidden(true)
    }

    private var badgeFill: Color {
        switch state {
        case .correct: LF.Palette.blueButton
        case .wrong: LF.Palette.ink
        default: .clear
        }
    }

    private var badgeEdge: Color {
        switch state {
        case .correct: LF.Palette.blueButton
        case .wrong: LF.Palette.ink
        case .selected: LF.Palette.blue
        case .idle: LF.Palette.rule
        }
    }

    private var badgeText: Color {
        switch state {
        case .correct: LF.Palette.onBlue
        case .wrong: LF.Palette.card
        case .selected: LF.Palette.blue
        case .idle: LF.Palette.graphite
        }
    }

    private var accessibilityText: String {
        let plain = LessonText.plain(text)
        switch state {
        case .correct: return "\(letter), \(plain), your answer, correct"
        case .wrong: return "\(letter), \(plain), your answer, incorrect"
        default: return "\(letter), \(plain)"
        }
    }
}

/// Presses an option 1pt into the page while held. The fill changes on the same frame as
/// the tap (the fastest confirmation an answer landed); only the press is eased.
private struct QuizOptionPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        QuizOptionPress(configuration: configuration)
    }
}

private struct QuizOptionPress: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        configuration.label
            .offset(y: configuration.isPressed && isEnabled && !reduceMotion ? 1 : 0)
            .animation(reduceMotion ? nil : LF.Motion.press, value: configuration.isPressed)
    }
}

#Preview("Question states", traits: .fixedLayout(width: 393, height: 760)) {
    @Previewable @State var sheet: QuizSheet = {
        var sheet = QuizSheet(quiz: PreviewData.lessonBody.quiz)
        sheet.select(2, for: 0)
        sheet.select(1, for: 1)
        sheet.select(0, for: 2)
        sheet.grade()
        sheet.retry()
        sheet.select(2, for: 1)
        sheet.select(3, for: 2)
        sheet.grade()
        return sheet
    }()
    ScrollView {
        VStack(alignment: .leading, spacing: 26) {
            ForEach(Array(PreviewData.lessonBody.quiz.enumerated()), id: \.offset) { index, question in
                QuizQuestionView(index: index, question: question, sheet: sheet) { sheet.select($0, for: index) }
            }
        }
        .padding(LF.Metrics.gutter)
    }
    .paperBackground()
}
