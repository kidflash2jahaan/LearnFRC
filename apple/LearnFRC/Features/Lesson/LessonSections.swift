import SwiftUI

// The blocks that follow the lesson body, in the website's order: key takeaways, the next
// step, the verified mark, sources and corrections, and the articles clipped to the lesson.

// MARK: - Key takeaways

/// "the part worth keeping": the archetypal callout, what the student underlined twice at
/// the bottom of the page. On the sheet it settles 14pt into place once, the first time it
/// scrolls into view (the lesson page's only motion), and not at all under Reduce Motion.
struct LessonTakeawaysView: View {
    let takeaways: [String]
    /// The narrower margin version on wide windows: smaller type, no settle.
    var inMargin = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var settled = false

    var body: some View {
        NoteCallout {
            SlugText("the part worth keeping")
            Text("Key takeaways")
                .lessonHeading(inMargin ? 18 : 21)
                .padding(.bottom, 4)
            VStack(alignment: .leading, spacing: inMargin ? 9 : 11) {
                ForEach(Array(takeaways.enumerated()), id: \.offset) { _, takeaway in
                    HStack(alignment: .firstTextBaseline, spacing: 9) {
                        Text(verbatim: "-")
                            .font(LF.Fonts.body(inMargin ? 15 : 16.5, weight: .bold, relativeTo: .callout))
                            .foregroundStyle(LF.Palette.blue)
                            .accessibilityHidden(true)
                        Text(LessonText.inline(takeaway, size: inMargin ? 15 : 16.5, relativeTo: .callout))
                            .foregroundStyle(LF.Palette.ink)
                            .lineSpacing(inMargin ? 3 : 4)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .textSelection(.enabled)
        }
        .offset(y: inMargin || settled || reduceMotion ? 0 : SiteTokens.Movement.settleRise)
        .onScrollVisibilityChange(threshold: 0.2) { visible in
            guard visible, !settled, !inMargin else { return }
            if reduceMotion {
                settled = true
            } else {
                withAnimation(LF.Motion.arrive) { settled = true }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Key takeaways")
    }
}

// MARK: - Keep going

/// What's written at the foot of the sheet: finish this one, then turn the page. Ruled, not
/// boxed, except the one card to press, the next lesson. The quiz link comes first, quieter,
/// so the completion is offered before the exit.
struct LessonNextStepView: View {
    let location: LessonLocation
    let positionInModule: Int
    let next: LessonLocation?
    let related: [LessonLocation]
    let relatedLabel: String
    /// The department's first lesson, for someone who landed mid-curriculum.
    let start: LessonLocation?
    let isCompleted: Bool
    let signedIn: Bool
    let columns: Int
    let onLesson: (LessonLocation) -> Void
    let onOpen: (AppRoute) -> Void
    let onQuiz: () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Where a cold reader actually is.
            LessonFlowLayout(spacing: 7, lineSpacing: 0, alignment: .center) {
                LessonInlineLink(location.department.name) { onOpen(.department(location.department.id)) }
                SlugText("/").accessibilityHidden(true)
                LessonInlineLink(location.module.title) { onOpen(.module(location.module.id)) }
                SlugText("/").accessibilityHidden(true)
                SlugText("lesson \(positionInModule) of \(location.module.lessons.count)")
                    .frame(minHeight: LF.Metrics.tap)
            }
            .padding(.vertical, -10)

            LessonFlowLayout(spacing: 20, lineSpacing: 12) {
                Text(next == nil ? "That is the end of this track" : "Keep going")
                    .lessonHeading(28)
                    .frame(maxWidth: 360, alignment: .leading)
                if !isCompleted {
                    // The button keeps its label on one line; the note moves under it when
                    // the two don't fit side by side (large text, a narrow phone).
                    LessonFlowLayout(spacing: 12, lineSpacing: 6, alignment: .center) {
                        Button("Take the quiz", action: onQuiz)
                            .buttonStyle(.inkGhostSmall)
                        SlugText(signedIn ? "+10 XP, more on a streak" : "+10 XP with an account")
                    }
                }
            }
            .padding(.top, 14)

            if let next {
                Button { onLesson(next) } label: {
                    NotebookCard(lift: true, padding: 20) {
                        // "open" sits beside the words; at the accessibility sizes it goes under
                        // them, so the title keeps the card's width ("Conflicti / ng" otherwise).
                        let layout = typeSize.isAccessibilitySize
                            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 14))
                            : AnyLayout(HStackLayout(alignment: .center, spacing: 18))
                        layout {
                            VStack(alignment: .leading, spacing: 6) {
                                SlugText(next.module.id != location.module.id ? "next module starts with" : "next lesson")
                                Text(next.lesson.title)
                                    .lessonHeading(22)
                                    .multilineTextAlignment(.leading)
                                if let summary = next.lesson.summary, !summary.isEmpty {
                                    Text(summary)
                                        .font(LF.Fonts.body(15.5, relativeTo: .callout))
                                        .foregroundStyle(LF.Palette.graphite)
                                        .lineLimit(LessonText.teaserLines(2, at: typeSize))
                                        .multilineTextAlignment(.leading)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Text("open")
                                .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
                                .foregroundStyle(LF.Palette.blue)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
                                .accessibilityHidden(true)
                        }
                    }
                }
                .buttonStyle(.notebookCard)
                .accessibilityLabel("\(next.module.id != location.module.id ? "Next module starts with" : "Next lesson"): \(next.lesson.title)")
                .accessibilityHint(next.lesson.summary ?? "")
                .padding(.top, 18)
            }

            LessonFlowLayout(spacing: 24, lineSpacing: 0) {
                LessonInlineLink("All \(location.module.lessons.count) lessons in \(location.module.title)", color: LF.Palette.ink) {
                    onOpen(.module(location.module.id))
                }
                if let start, start.id != location.id {
                    LessonInlineLink("New to \(location.department.name)? Start at lesson one", color: LF.Palette.ink) {
                        onLesson(start)
                    }
                }
            }
            .padding(.top, 12)

            if !related.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    SlugText(relatedLabel)
                    LazyVGrid(
                        columns: Array(repeating: GridItem(.flexible(), spacing: 32, alignment: .topLeading), count: max(1, columns)),
                        alignment: .leading,
                        spacing: 0
                    ) {
                        ForEach(related) { lesson in
                            LessonBulletLink(title: lesson.lesson.title) { onLesson(lesson) }
                        }
                    }
                }
                .padding(.top, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { DashedRule() }
                .padding(.top, 14)
            }
        }
        .padding(.top, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { InkRule() }
        .accessibilityElement(children: .contain)
    }
}

/// A Space Mono link inside running furniture ("All 4 lessons in ..."): 44pt tall, blue on hover.
struct LessonInlineLink: View {
    let title: String
    var color: Color
    let action: () -> Void
    @State private var hovering = false

    init(_ title: String, color: Color = LF.Palette.graphite, action: @escaping () -> Void) {
        self.title = title
        self.color = color
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            SlugText(title, color: hovering ? LF.Palette.blue : color)
                .multilineTextAlignment(.leading)
                .frame(minHeight: LF.Metrics.tap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

// MARK: - Verified

/// The accuracy mark. Only shown once a lesson has been checked; "verified on 9 Sept 2026"
/// is a claim a reader can weigh against a rule change.
struct LessonVerifiedBadge: View {
    let verifiedAt: Date

    var body: some View {
        LessonFlowLayout(spacing: 8, lineSpacing: 4) {
            Image(systemName: "checkmark.circle")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(LF.Palette.blue)
                .accessibilityHidden(true)
            SlugText("verified", color: LF.Palette.ink, weight: .bold)
            Text("checked against primary sources on \(LessonText.verifiedDate(verifiedAt))")
                .font(LF.Fonts.body(14.5, relativeTo: .footnote))
                .foregroundStyle(LF.Palette.graphite)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Verified, checked against primary sources on \(LessonText.verifiedDate(verifiedAt))")
    }
}

// MARK: - Sources and corrections

/// The colophon: where the facts came from and how to challenge them. Ruled onto the page,
/// not boxed, because it's part of the document. It never invents a citation.
struct LessonProvenanceView: View {
    let sources: [SourceLink]
    let lessonURL: URL
    let isWide: Bool

    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            LessonSectionHeading(slug: "where this came from", title: "Sources and corrections")

            Text(intro)
                .font(LF.Fonts.body(15.5, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .tint(LF.Palette.blue)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)

            if !sources.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    SlugText("sources and further reading")
                        .accessibilityAddTraits(.isHeader)
                        .padding(.bottom, 4)
                    ForEach(sources) { source in
                        LessonSourceRow(source: source, isWide: isWide)
                    }
                }
                .padding(.top, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { DashedRule() }
                .padding(.top, 18)
            }

            LessonInlineLink("Spotted a mistake? Suggest an edit on learnfrc.com", color: LF.Palette.ink) {
                openURL(lessonURL)
            }
            .padding(.top, 8)
        }
        .padding(.top, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) { InkRule() }
    }

    private var intro: AttributedString {
        var text = AttributedString("This lesson is AI-assisted: drafted from primary sources, then reviewed and edited by hand. Errors still get through. When one is reported we fix it and write down what changed, in public, in the ")
        var link = AttributedString("corrections log")
        link.link = LessonLinks.corrections
        link.foregroundColor = LF.Palette.blue
        link.underlineStyle = .single
        text.append(link)
        text.append(AttributedString("."))
        return text
    }
}

/// One source: the host first (it says the source's authority before you click), then the title.
private struct LessonSourceRow: View {
    let source: SourceLink
    let isWide: Bool
    @Environment(\.openURL) private var openURL
    @State private var hovering = false

    var body: some View {
        Button { openURL(source.url) } label: {
            Group {
                if isWide {
                    HStack(alignment: .firstTextBaseline, spacing: 20) {
                        host.frame(width: 160, alignment: .leading)
                        title
                    }
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        host
                        title
                    }
                }
            }
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
        .accessibilityLabel("\(source.title), \(LessonText.host(of: source.url))")
        .accessibilityHint("Opens in your browser")
        .accessibilityAddTraits(.isLink)
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }

    private var host: some View {
        SlugText(LessonText.host(of: source.url))
            .lineLimit(1)
            .truncationMode(.middle)
    }

    private var title: some View {
        Text(source.title)
            .font(LF.Fonts.body(15.5, relativeTo: .callout))
            .foregroundStyle(hovering ? LF.Palette.blue : LF.Palette.ink)
            .underline(true, color: hovering ? LF.Palette.blue : LF.Palette.rule)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Articles clipped to the lesson

/// "clipped to this lesson": articles that go further, drawn as torn-out pages taped to the
/// sheet, each at its own angle, so they're told apart from the straight next-lesson card.
struct LessonReadNextView: View {
    let articles: [Article]
    let columns: Int
    let onOpen: (AppRoute) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            LessonSectionHeading(slug: "clipped to this lesson", title: "Articles that go further on this", size: 25)
            Text("The lesson gets you through the topic. These go wider on it, and they read in one sitting.")
                .font(LF.Fonts.body(15.5, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 22, alignment: .top), count: max(1, min(columns, articles.count))),
                alignment: .leading,
                spacing: 26
            ) {
                ForEach(Array(articles.enumerated()), id: \.element.id) { index, article in
                    Button { onOpen(.article(article.slug)) } label: {
                        NotebookCard(tilt: Self.tilt(index), tape: true, lift: true, padding: 18, tapeAngle: TapeStrip.angle(for: index * 3 + 1)) {
                            SlugText(article.readMins > 0 ? "\(article.readMins) min read" : "article")
                            Text(article.title)
                                .lessonHeading(18)
                                .multilineTextAlignment(.leading)
                                .padding(.top, 8)
                            if !article.description.isEmpty {
                                Text(article.description)
                                    .font(LF.Fonts.body(14.5, relativeTo: .subheadline))
                                    .foregroundStyle(LF.Palette.graphite)
                                    .lineLimit(LessonText.teaserLines(3, at: typeSize))
                                    .multilineTextAlignment(.leading)
                                    .padding(.top, 8)
                            }
                            Spacer(minLength: 12)
                            HStack(alignment: .firstTextBaseline) {
                                SlugText("/blog")
                                Spacer()
                                SlugText("read it", color: LF.Palette.blue, weight: .bold)
                            }
                            .padding(.top, 12)
                            .overlay(alignment: .top) { DashedRule() }
                        }
                    }
                    .buttonStyle(.notebookCard)
                    .accessibilityLabel("Article: \(article.title)")
                    .accessibilityHint(article.description)
                }
            }
            .padding(.top, 26)
        }
    }

    /// No two clippings share an angle, and none is straight (the straight card is the next lesson).
    private static func tilt(_ index: Int) -> LF.Tilt {
        [LF.Tilt.preset(0), .preset(3), .preset(2)][index % 3]
    }
}
