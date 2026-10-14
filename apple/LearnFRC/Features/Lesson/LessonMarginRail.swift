import SwiftUI

/// The writing down the sheet's left margin on a wide window (the site's reading rail),
/// with the key takeaways pinned beside the text:
///
/// 1. on this page: the headings, with the margin rule overprinted in ballpoint as far as
///    the reader has got (the pen line);
/// 2. the part worth keeping: the takeaways;
/// 3. this department: the meter and the printed figure.
///
/// No card, no frame: it's margin writing, separated by the hairline the system uses inside
/// a card. The 2pt ink rule between it and the text is drawn by the lesson.
struct LessonMarginRail: View {
    let location: LessonLocation
    let headings: [LessonMarkdownHeading]
    let takeaways: [String]
    let done: Int
    let total: Int
    let signedIn: Bool
    /// A guest with lessons finished on this device.
    let isGuestWithProgress: Bool
    let metrics: LessonScrollMetrics
    let onJump: (String) -> Void
    let onOpen: (AppRoute) -> Void
    let onAccount: (LessonAccountRequest) -> Void

    private var pct: Int { total > 0 ? Int((Double(done) / Double(total) * 100).rounded()) : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            contents

            if !takeaways.isEmpty {
                LessonTakeawaysView(takeaways: takeaways, inMargin: true)
                    .padding(.top, 24)
            }

            department
                .padding(.top, 18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { DashedRule() }
                .padding(.top, 24)
        }
        .padding(.bottom, 8)
    }

    // MARK: 1. this page

    private var contents: some View {
        VStack(alignment: .leading, spacing: 10) {
            SlugText("on this page")
                .accessibilityAddTraits(.isHeader)
            if headings.isEmpty {
                Text("One run, no sections to jump between.")
                    .font(LF.Fonts.body(14.5, relativeTo: .footnote))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(headings) { heading in
                        RailHeadingRow(heading: heading) { onJump(heading.id) }
                    }
                }
                .padding(.leading, 16)
                .overlay(alignment: .leading) { LessonPenLine(metrics: metrics) }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("On this page")
            }
        }
    }

    // MARK: 3. this department

    private var department: some View {
        VStack(alignment: .leading, spacing: 6) {
            LessonInlineLink("dept / \(location.department.slug)") {
                onOpen(.department(location.department.id))
            }
            .padding(.vertical, -12)
            .accessibilityLabel("Department: \(location.department.name)")
            Text(location.department.name)
                .font(LF.Fonts.body(16, weight: .bold, relativeTo: .callout))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)

            if signedIn || isGuestWithProgress {
                MeterView(value: Double(done) / Double(max(1, total)), style: .slim)
                    .padding(.top, 8)
                SlugText("\(done) of \(total) read / \(pct)%")
                    .padding(.top, 2)
                if !signedIn {
                    // One sentence: the link follows on the same line when it fits, and
                    // otherwise starts the next one (never two side-by-side columns).
                    LessonSentenceWithLink(
                        "Saved on this device.",
                        link: "Give it a permanent home.",
                        color: LF.Palette.graphite
                    ) {
                        onAccount(.signUp)
                    }
                    .font(LF.Fonts.body(14, relativeTo: .footnote))
                    .padding(.top, 4)
                }
            } else {
                Text("Finish a lesson and it gets counted here. No account needed.")
                    .font(LF.Fonts.body(14, relativeTo: .footnote))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
        }
    }
}

/// One heading in the margin's contents. h3s sit indented and smaller.
private struct RailHeadingRow: View {
    let heading: LessonMarkdownHeading
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            Text(heading.title)
                .font(LF.Fonts.body(heading.level >= 3 ? 13.5 : 14.5, relativeTo: .footnote))
                .foregroundStyle(hovering ? LF.Palette.ink : LF.Palette.graphite)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .padding(.leading, heading.level >= 3 ? 12 : 0)
                .padding(.vertical, 5)
                .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .accessibilityLabel(heading.title)
        .accessibilityHint("Jumps to this section")
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

// MARK: - The floating bar

/// The slip clipped to the bottom of the window: a shortcut to this lesson's finish line
/// while the reader is still working towards it. Appears once they're past the first screen,
/// steps aside as the quiz or sign-off card comes up from the bottom and stays away below it
/// (it's a shortcut to that card, never a competitor, and never over the card or the
/// controls under it), and stays closed for the visit once dismissed. It slides and fades;
/// under Reduce Motion it only fades.
struct LessonFloatingBar: View {
    let metrics: LessonScrollMetrics
    let isCompleted: Bool
    let quizCount: Int
    let signedIn: Bool
    let hasNext: Bool
    @Binding var dismissed: Bool
    let onQuiz: () -> Void
    let onNext: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The narrowest the words may get beside the button before it moves under them.
    @ScaledMetric(relativeTo: .callout) private var minTextWidth: CGFloat = 132

    private var hasAction: Bool { !isCompleted || hasNext }
    private var visible: Bool {
        metrics.isPastOpening && !metrics.hasReachedQuiz && !dismissed && hasAction
    }

    var body: some View {
        ZStack {
            if visible {
                bar
                    .transition(reduceMotion ? .opacity : .opacity.combined(with: .offset(y: 8)))
            }
        }
        // A fade is not motion, so it stays under Reduce Motion; only the slide goes.
        .animation(LF.Motion.hover, value: visible)
    }

    private var subtitle: String {
        if isCompleted { return "saved, keep the run going" }
        let reward = signedIn ? "10+ XP" : "saved on this device"
        if quizCount > 0 { return "\(quizCount) question\(LessonText.plural(quizCount)) / \(reward)" }
        return "one tap / \(reward)"
    }

    /// The words never truncate and the button never wraps: on one row the words wrap beside
    /// the button while they have a sensible width; past that (large text, a narrow phone at
    /// the biggest sizes) the button moves under the words.
    private var bar: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) {
                labels
                    .frame(minWidth: minTextWidth, idealWidth: minTextWidth, maxWidth: .infinity, alignment: .leading)
                actionButton(fixed: true)
                closeButton
            }
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 10) {
                    labels
                    // Still one line at the very largest sizes: it shrinks a little before
                    // it would wrap or push the bar off the screen.
                    actionButton(fixed: false)
                        .padding(.bottom, 6)
                }
                .padding(.top, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                closeButton
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, 4)
        .padding(.vertical, 6)
        .notebookSurface()
        .padding(.horizontal, LF.Metrics.gutter)
        .padding(.bottom, 10)
        // Never wider than the window, whatever the text size: a bar that overflowed would
        // widen the inset, and with it the whole page under it.
        .modifier(LessonOfferedWidthModifier(maxWidth: 620 + 2 * LF.Metrics.gutter))
        // It floats over the text it's a shortcut from, so it stops growing at the first
        // accessibility size rather than cover most of a phone screen.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Lesson actions")
    }

    private var labels: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(isCompleted ? "Lesson complete" : "Finish this lesson")
                .font(LF.Fonts.body(16, weight: .bold, relativeTo: .callout))
                .foregroundStyle(LF.Palette.ink)
            SlugText(subtitle)
        }
        .multilineTextAlignment(.leading)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// The bar's one action. Its label never wraps: beside the words it keeps its full size
    /// (`fixed`); under them it may scale down slightly instead.
    private func actionButton(fixed: Bool) -> some View {
        Group {
            if isCompleted {
                Button("Next lesson", action: onNext)
            } else {
                Button(quizCount > 0 ? "Take the quiz" : "Mark complete", action: onQuiz)
            }
        }
        .buttonStyle(.inkSmall)
        .lineLimit(1)
        .minimumScaleFactor(fixed ? 1 : 0.6)
        .fixedSize(horizontal: fixed, vertical: false)
    }

    private var closeButton: some View {
        Button {
            dismissed = true
        } label: {
            Image(systemName: "xmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(LF.Palette.graphite)
                .frame(width: LF.Metrics.tap, height: LF.Metrics.tap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Hide this bar")
    }
}

// MARK: - Previews

#Preview("Floating bar, iPhone sizes", traits: .fixedLayout(width: 393, height: 760)) {
    @Previewable @State var dismissed = false
    let metrics = LessonScrollMetrics.scrolledForPreview()
    VStack(spacing: 18) {
        LessonFloatingBar(metrics: metrics, isCompleted: false, quizCount: 3, signedIn: false, hasNext: true, dismissed: $dismissed, onQuiz: {}, onNext: {})
        LessonFloatingBar(metrics: metrics, isCompleted: true, quizCount: 3, signedIn: true, hasNext: true, dismissed: $dismissed, onQuiz: {}, onNext: {})
        LessonFloatingBar(metrics: metrics, isCompleted: false, quizCount: 3, signedIn: false, hasNext: true, dismissed: $dismissed, onQuiz: {}, onNext: {})
            .dynamicTypeSize(.xxxLarge)
        LessonFloatingBar(metrics: metrics, isCompleted: false, quizCount: 3, signedIn: true, hasNext: true, dismissed: $dismissed, onQuiz: {}, onNext: {})
            .dynamicTypeSize(.accessibility2)
    }
    .frame(maxHeight: .infinity, alignment: .top)
    .padding(.top, 20)
    .paperBackground()
}

#Preview("Margin rail, guest with progress", traits: .fixedLayout(width: 300, height: 980)) {
    LessonMarginRail(
        location: PreviewData.lessonLocation,
        headings: LessonMarkdownView.headings(in: PreviewData.lessonBody.content),
        takeaways: PreviewData.lessonBody.keyTakeaways,
        done: 1,
        total: 51,
        signedIn: false,
        isGuestWithProgress: true,
        metrics: LessonScrollMetrics(),
        onJump: { _ in },
        onOpen: { _ in },
        onAccount: { _ in }
    )
    .frame(width: 248)
    .padding(26)
    .frame(maxHeight: .infinity, alignment: .top)
    .paperBackground()
}
