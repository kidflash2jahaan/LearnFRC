import SwiftUI

/// The bottom half of iPhone Duo in laptop posture: held sideways and half open on a table,
/// the lesson reads in the top half and everything you press lives down here, under your
/// thumbs, clear of the crease.
///
/// - The floating bar's slip, always out: "Finish this lesson" (or "Lesson complete") and its
///   one action, with the same words as the bar.
/// - Read aloud, with pause, resume and stop.
/// - On this page: the headings, to move the page above.
/// - While the quiz is on screen above, the quiz's answer pad instead (`QuizAnswerPad`): the
///   question stays in the page and its options come down here.
///
/// It scrolls on its own when it can't fit (large text), so nothing is ever cut off.
struct LessonFlexDeck: View {
    let metrics: LessonScrollMetrics
    let isCompleted: Bool
    let quizCount: Int
    let signedIn: Bool
    let reader: LessonReadAloud
    let canReadAloud: Bool
    let headings: [LessonMarkdownHeading]
    /// The quiz's answer pad, while the lesson has a quiz card to answer.
    let pad: QuizPadModel?
    let margins: LF.PageMargins
    let onQuiz: () -> Void
    let onNext: () -> Void
    let onReadAloud: () -> Void
    let onStopReading: () -> Void
    let onJump: (String) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize

    /// The pad takes over while the quiz or its "Mark complete" is on screen above.
    private var showsPad: Bool { pad != nil && metrics.isQuizOnScreen }

    var body: some View {
        ScrollView {
            ZStack(alignment: .topLeading) {
                if showsPad, let pad {
                    QuizAnswerPad(model: pad, showsFooter: false)
                        .transition(.opacity)
                } else {
                    tools
                        .transition(.opacity)
                }
            }
            .frame(maxWidth: 640, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, margins.leading)
            .padding(.trailing, margins.trailing)
            .padding(.top, 16)
            .padding(.bottom, 12)
        }
        .scrollBounceBehavior(.basedOnSize)
        // The pad's submit (or retry) stays at the deck's foot, above the tab bar, however far
        // the options run.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if showsPad, let pad, QuizPadFooter.shows(pad) {
                QuizPadFooter(model: pad)
                    .frame(maxWidth: 640, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, margins.leading)
                    .padding(.trailing, margins.trailing)
                    .padding(.vertical, 12)
                    .background(LF.Palette.paper)
                    .overlay(alignment: .top) { DashedRule() }
                    .transition(.opacity)
            }
        }
        // A fade is not motion, so it stays under Reduce Motion.
        .animation(LF.Motion.hover, value: showsPad)
        .background(LF.Palette.paper)
        .overlay(alignment: .top) { InkRule() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lesson controls")
    }

    // MARK: The tools

    private var tools: some View {
        VStack(alignment: .leading, spacing: 0) {
            slip
            readAloud
                .padding(.top, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { DashedRule() }
                .padding(.top, 14)
            if !headings.isEmpty {
                contents
                    .padding(.top, 14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { DashedRule() }
                    .padding(.top, 14)
            }
        }
    }

    /// The floating bar's words and action, laid flat.
    private var slip: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 16) {
                slipLabels
                    .frame(maxWidth: .infinity, alignment: .leading)
                slipAction
                    .fixedSize()
            }
            VStack(alignment: .leading, spacing: 10) {
                slipLabels
                slipAction
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lesson actions")
    }

    private var slipLabels: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(isCompleted ? "Lesson complete" : "Finish this lesson")
                .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                .foregroundStyle(LF.Palette.ink)
            SlugText(LessonFloatingBar.subtitle(isCompleted: isCompleted, quizCount: quizCount, signedIn: signedIn))
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder
    private var slipAction: some View {
        if isCompleted {
            Button("Next lesson", action: onNext)
                .buttonStyle(.ink)
        } else {
            Button(quizCount > 0 ? "Take the quiz" : "Mark complete", action: onQuiz)
                .buttonStyle(.ink)
        }
    }

    // MARK: Read aloud

    private var readAloud: some View {
        VStack(alignment: .leading, spacing: 10) {
            SlugText("read aloud")
                .accessibilityAddTraits(.isHeader)
            LessonFlowLayout(spacing: 12, lineSpacing: 10, alignment: .center) {
                switch reader.state {
                case .idle:
                    Button(action: onReadAloud) {
                        Label("Read aloud", systemImage: "speaker.wave.2")
                    }
                    .buttonStyle(.inkGhost)
                    .disabled(!canReadAloud)
                case .speaking:
                    Button(action: onReadAloud) {
                        Label("Pause reading", systemImage: "pause.fill")
                    }
                    .buttonStyle(.ink)
                    stopButton
                case .paused:
                    Button(action: onReadAloud) {
                        Label("Resume reading", systemImage: "play.fill")
                    }
                    .buttonStyle(.ink)
                    stopButton
                }
            }
        }
    }

    private var stopButton: some View {
        Button(action: onStopReading) {
            Label("Stop reading", systemImage: "stop.fill")
        }
        .buttonStyle(.inkGhost)
    }

    // MARK: On this page

    private var contents: some View {
        VStack(alignment: .leading, spacing: 6) {
            SlugText("on this page")
                .accessibilityAddTraits(.isHeader)
            LessonPairsOrColumn(inPairs: !typeSize.isAccessibilitySize) {
                ForEach(headings) { heading in
                    DeckHeadingRow(heading: heading) { onJump(heading.id) }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("On this page")
        }
    }
}

/// Two columns of rows, or one at the accessibility sizes.
private struct LessonPairsOrColumn<Content: View>: View {
    let inPairs: Bool
    @ViewBuilder var content: Content

    var body: some View {
        if inPairs {
            LessonPairsLayout(spacing: 20, lineSpacing: 0) { content }
        } else {
            VStack(alignment: .leading, spacing: 0) { content }
        }
    }
}

/// A heading on the deck: a blue hyphen and the title, 44pt to tap.
private struct DeckHeadingRow: View {
    let heading: LessonMarkdownHeading
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(verbatim: "-")
                    .font(LF.Fonts.body(15, weight: .bold, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.blue)
                    .accessibilityHidden(true)
                Text(heading.title)
                    .font(LF.Fonts.body(heading.level >= 3 ? 14 : 15, relativeTo: .subheadline))
                    .foregroundStyle(hovering ? LF.Palette.ink : LF.Palette.graphite)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.leading, heading.level >= 3 ? 10 : 0)
            .padding(.vertical, 5)
            .frame(minHeight: LF.Metrics.tap)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .accessibilityLabel(heading.title)
        .accessibilityHint("Moves the page to this section")
    }
}

// MARK: - Previews

#Preview("Laptop deck, reading", traits: .fixedLayout(width: 669, height: 372)) {
    LessonFlexDeck(
        metrics: LessonScrollMetrics(),
        isCompleted: false,
        quizCount: 3,
        signedIn: false,
        reader: LessonReadAloud(),
        canReadAloud: true,
        headings: LessonMarkdownView.headings(in: PreviewData.lessonBody.content),
        pad: nil,
        margins: LF.PageMargins(leading: 26, trailing: 26),
        onQuiz: {}, onNext: {}, onReadAloud: {}, onStopReading: {}, onJump: { _ in }
    )
}
