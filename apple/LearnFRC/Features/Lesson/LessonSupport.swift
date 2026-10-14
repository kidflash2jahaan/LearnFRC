import SwiftUI

// Small helpers the lesson screen and the quiz share. Everything here is private to the
// Lesson feature; anything worth promoting is listed in the feature's summary.

// MARK: - Asking the shell for the account screens

/// The account screens a guest can ask for from a lesson (the sign-up hook, the
/// "claim my lessons" note on the sign-off card).
enum LessonAccountRequest: Hashable, Sendable {
    case signUp
    case signIn
}

/// What the shell does when a lesson asks for an account screen.
struct LessonAccountAction: Sendable {
    let handler: @MainActor @Sendable (LessonAccountRequest) -> Void

    init(_ handler: @escaping @MainActor @Sendable (LessonAccountRequest) -> Void) {
        self.handler = handler
    }

    @MainActor func callAsFunction(_ request: LessonAccountRequest) {
        handler(request)
    }
}

extension LessonAccountAction: Equatable {
    /// Set once by the shell and never meaningfully replaced, so any two compare equal and
    /// a new closure on a redraw doesn't invalidate every lesson view.
    static func == (lhs: LessonAccountAction, rhs: LessonAccountAction) -> Bool { true }
}

extension EnvironmentValues {
    /// Set once by the app shell to present `SignUpView` or `SignInView`:
    ///
    ///     .environment(\.lessonAccountRequest, LessonAccountAction { request in sheet = request })
    ///
    /// When nobody sets it, a lesson opens learnfrc.com's sign-up or log-in page in the
    /// browser instead, so the button always does something.
    @Entry var lessonAccountRequest: LessonAccountAction? = nil
}

// MARK: - Text

/// Wording and formatting rules copied from the website's lesson page.
enum LessonText {
    /// Words per minute behind the site's "reading time" (`max(1, round(words / 200))`).
    static let wordsPerMinute = 200

    /// The lesson page's reading time, from the body's word count (the site's rule).
    static func readingMinutes(_ markdown: String) -> Int {
        let words = markdown.split(whereSeparator: { $0.isWhitespace }).count
        return max(1, Int((Double(words) / Double(wordsPerMinute)).rounded()))
    }

    /// A source's hostname without a leading `www.` (`provenance.tsx`'s `hostOf`).
    static func host(of url: URL) -> String {
        let host = url.host() ?? ""
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    /// "9 Sept 2026": the verified badge's date, day month year in UTC like the site
    /// (`toLocaleDateString("en-GB", { timeZone: "UTC" })`).
    static func verifiedDate(_ date: Date) -> String {
        date.formatted(
            Date.FormatStyle(locale: Locale(identifier: "en_GB"), timeZone: .gmt)
                .day().month(.abbreviated).year()
        )
    }

    /// How many lines a clipped teaser (a summary or description on a card) gets: `lines` at
    /// the regular sizes, more as the text grows, so a large size still shows a sentence
    /// rather than three words and an ellipsis.
    static func teaserLines(_ lines: Int, at size: DynamicTypeSize) -> Int {
        if size.isAccessibilitySize { return lines + 3 }
        return size >= .xxLarge ? lines + 1 : lines
    }

    /// "s" when `count` isn't one.
    static func plural(_ count: Int, _ suffix: String = "s") -> String {
        count == 1 ? "" : suffix
    }

    /// Takeaways, quiz questions and options are plain strings that sometimes carry inline
    /// Markdown (`code`, **bold**). This renders that inline Markdown in the notebook faces:
    /// code in Space Mono, bold in Bricolage 700. Anything it can't parse stays literal.
    static func inline(
        _ text: String,
        size: CGFloat = 17,
        weight: Font.Weight = .regular,
        relativeTo style: Font.TextStyle = .body
    ) -> AttributedString {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        var out = (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text)
        let bold: Font.Weight = weight == .regular || weight == .medium ? .bold : .heavy
        for run in out.runs {
            let intent = run.inlinePresentationIntent ?? []
            if intent.contains(.code) {
                out[run.range].font = LF.Fonts.mono(size * 0.88, weight: weight == .regular ? .regular : .bold, relativeTo: style)
            } else if intent.contains(.stronglyEmphasized) {
                out[run.range].font = LF.Fonts.body(size, weight: bold, relativeTo: style)
            } else {
                out[run.range].font = LF.Fonts.body(size, weight: weight, relativeTo: style)
            }
            // These strings are labels, not documents: links inside them stay text.
            out[run.range].link = nil
        }
        return out
    }

    /// The same string with inline Markdown removed, for VoiceOver labels and read-aloud.
    static func plain(_ text: String) -> String {
        String(inline(text).characters)
    }
}

// MARK: - Links out

/// Where a lesson sends people on the website.
enum LessonLinks {
    /// `https://learnfrc.com/signup?next=<lesson path>&ref=<surface>`
    static func signUp(next location: LessonLocation, ref: String) -> URL {
        var components = URLComponents(url: AppConfig.webBase.appending(path: "signup"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "next", value: path(of: location)),
            URLQueryItem(name: "ref", value: ref),
        ]
        return components?.url ?? AppConfig.webBase
    }

    /// `https://learnfrc.com/login?next=<lesson path>`
    static func logIn(next location: LessonLocation) -> URL {
        var components = URLComponents(url: AppConfig.webBase.appending(path: "login"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "next", value: path(of: location))]
        return components?.url ?? AppConfig.webBase
    }

    /// `/guides/{dept}/{module}/{lesson}`
    static func path(of location: LessonLocation) -> String {
        "/guides/\(location.department.slug)/\(location.module.slug)/\(location.lesson.slug)"
    }

    /// The site's public corrections log.
    static let corrections = AppConfig.webBase.appending(path: "corrections")

    /// The video on youtube.com (opens outside the app, never in an in-app browser).
    static func youTube(_ videoID: String) -> URL {
        URL(string: "https://www.youtube.com/watch?v=\(videoID)") ?? AppConfig.webBase
    }

    /// A referral link for the milestone share card.
    static func referral(username: String) -> URL {
        var components = URLComponents(url: AppConfig.webBase.appending(path: "signup"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "ref", value: username),
            URLQueryItem(name: "via", value: "lesson-milestone"),
        ]
        return components?.url ?? AppConfig.webBase
    }
}

// MARK: - Layout

enum LessonLayout {
    /// The most a card's inner padding grows to. Padding scales with the text, but at the
    /// largest sizes a phone column needs its width for the words, not the margins (22pt
    /// scaled to AX5 is about 70pt a side, and long words broke in half).
    static let maxCardPadding: CGFloat = 24

    /// `scaled` (a `@ScaledMetric` padding), no larger than `maxCardPadding`.
    static func cardPadding(_ scaled: CGFloat) -> CGFloat {
        min(scaled, maxCardPadding)
    }
}

/// Lays its children out left to right and wraps onto new lines, aligning each line's
/// children at the bottom like the site's `flex-wrap items-end` fact row.
struct LessonFlowLayout: Layout {
    var spacing: CGFloat = 20
    var lineSpacing: CGFloat = 14
    /// Where items of different heights sit within a line.
    var alignment: VerticalAlignment = .bottom

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let lines = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let width = lines.map(\.width).max() ?? 0
        let height = lines.reduce(0) { $0 + $1.height } + lineSpacing * CGFloat(max(0, lines.count - 1))
        return CGSize(width: proposal.width.map { min($0, width) } ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let lines = arrange(width: bounds.width, subviews: subviews)
        var y = bounds.minY
        for line in lines {
            var x = bounds.minX
            for item in line.items {
                let offset: CGFloat
                switch alignment {
                case .top: offset = 0
                case .center: offset = (line.height - item.size.height) / 2
                default: offset = line.height - item.size.height
                }
                subviews[item.index].place(
                    at: CGPoint(x: x, y: y + offset),
                    proposal: ProposedViewSize(item.size)
                )
                x += item.size.width + spacing
            }
            y += line.height + lineSpacing
        }
    }

    private struct Line {
        var items: [(index: Int, size: CGSize)] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width maxWidth: CGFloat, subviews: Subviews) -> [Line] {
        var lines: [Line] = []
        var line = Line()
        for index in subviews.indices {
            // Natural width first (so a capped frame doesn't claim its whole cap), then the
            // height at the width it will actually get (so wrapped text is measured wrapped).
            let ideal = subviews[index].sizeThatFits(.unspecified)
            let width = min(ideal.width, maxWidth)
            var size = subviews[index].sizeThatFits(ProposedViewSize(width: width, height: nil))
            size.width = min(max(size.width, 0), width)
            let needed = line.items.isEmpty ? size.width : line.width + spacing + size.width
            if !line.items.isEmpty, needed > maxWidth {
                lines.append(line)
                line = Line()
            }
            line.width = line.items.isEmpty ? size.width : line.width + spacing + size.width
            line.height = max(line.height, size.height)
            line.items.append((index, size))
        }
        if !line.items.isEmpty { lines.append(line) }
        return lines
    }
}

// MARK: - Page frame

/// Takes exactly the width it's offered, whatever its content asks for, and lays the content
/// out in a column no wider than `maxWidth`, centered in that width.
///
/// A block that comes out a fraction of a point wider than its column (text and frames are
/// rounded to the pixel grid) would otherwise widen the scroll view, and with it the width
/// the page measures; the gutter (4% of that width) then grows, the column changes, the
/// block rounds the other way, and layout never settles (the iPad portrait freeze).
struct LessonPageFrame: Layout {
    let maxWidth: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? min(maxWidth, subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0)
        let inner = ProposedViewSize(width: min(width, maxWidth), height: nil)
        let height = subviews.map { $0.sizeThatFits(inner).height }.max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let inner = min(bounds.width, maxWidth)
        let origin = CGPoint(x: bounds.minX + (bounds.width - inner) / 2, y: bounds.minY)
        for subview in subviews {
            subview.place(at: origin, anchor: .topLeading, proposal: ProposedViewSize(width: inner, height: nil))
        }
    }
}

/// `LessonPageFrame` as a modifier, for one view.
struct LessonOfferedWidthModifier: ViewModifier {
    let maxWidth: CGFloat

    func body(content: Content) -> some View {
        LessonPageFrame(maxWidth: maxWidth) { content }
    }
}

// MARK: - Small drawn pieces

/// A ruled "label over value" pair from the lesson's fact row (`dt` / `dd` on the site).
struct LessonFact<Value: View>: View {
    let label: String
    @ViewBuilder var value: Value

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            SlugText(label)
            value
        }
        .accessibilityElement(children: .combine)
    }
}

/// A quiet underlined text button in Space Mono (`nb-slug` + underline): "Mark it unread
/// again", "Not now", "open". Keeps the 44pt target.
struct LessonQuietButton: View {
    let title: String
    var color: Color = LF.Palette.ink
    let action: () -> Void

    init(_ title: String, color: Color = LF.Palette.ink, action: @escaping () -> Void) {
        self.title = title
        self.color = color
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .tracking(12.5 * 0.02)
                .foregroundStyle(color)
                .underline(true, color: LF.Palette.rule)
                .frame(minHeight: LF.Metrics.tap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

/// An underlined link in running text ("Give it a permanent home.", "Log in"), in whatever
/// font the surrounding text sets. At least 44 by 44pt to tap, though it reads as part of the
/// sentence: a short word keeps its place after the text before it, and the spare width
/// trails it.
struct LessonTextLink: View {
    let title: String
    var color: Color = LF.Palette.blue
    var underline: Color?
    var bold = false
    let action: () -> Void

    init(_ title: String, color: Color = LF.Palette.blue, underline: Color? = nil, bold: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.color = color
        self.underline = underline
        self.bold = bold
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .bold(bold)
                .foregroundStyle(color)
                .underline(true, color: underline ?? color)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .frame(minWidth: LF.Metrics.tap, minHeight: LF.Metrics.tap, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        #if os(macOS)
        .pointerStyle(.link)
        #endif
    }
}

/// A short sentence followed by a link, set as one run of text: the link sits on the
/// sentence's line when it fits and starts the next line when it doesn't. Takes its font from
/// the environment.
///
///     LessonSentenceWithLink("Saved on this device.", link: "Give it a permanent home.") { ... }
struct LessonSentenceWithLink: View {
    let sentence: String
    let link: String
    var color: Color
    var linkColor: Color
    let action: () -> Void

    init(_ sentence: String, link: String, color: Color = LF.Palette.graphite, linkColor: Color = LF.Palette.blue, action: @escaping () -> Void) {
        self.sentence = sentence
        self.link = link
        self.color = color
        self.linkColor = linkColor
        self.action = action
    }

    var body: some View {
        LessonFlowLayout(spacing: 4, lineSpacing: 0, alignment: .center) {
            Text(sentence)
                .foregroundStyle(color)
                .fixedSize(horizontal: false, vertical: true)
            LessonTextLink(link, color: linkColor, action: action)
        }
    }
}

/// A row-style link inside the lesson (`- Title` with the blue hyphen bullet). Tapping it
/// runs `action`; under a pointer the title turns blue.
struct LessonBulletLink: View {
    let title: String
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(alignment: .firstTextBaseline, spacing: 9) {
                Text(verbatim: "-")
                    .font(LF.Fonts.body(16, weight: .bold, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.blue)
                    .accessibilityHidden(true)
                Text(title)
                    .font(LF.Fonts.body(16, relativeTo: .callout))
                    .foregroundStyle(hovering ? LF.Palette.blue : LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 4)
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

/// The section kicker plus heading the site sets over every block on the sheet:
/// a mono slug, then a Bricolage 800 heading.
struct LessonSectionHeading: View {
    let slug: String
    let title: String
    var size: CGFloat = 21

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            SlugText(slug)
            Text(title)
                .lessonHeading(size)
        }
    }
}

extension View {
    /// A heading at an in-between size (the site's `clamp()` headings on the lesson sheet):
    /// Bricolage 800 at the matching cut, tracking -0.025em, tight leading, header trait.
    func lessonHeading(_ size: CGFloat, color: Color = LF.Palette.ink) -> some View {
        let style: Font.TextStyle = size >= 26 ? .title : (size >= 21 ? .title2 : .title3)
        return self
            .font(LF.Fonts.display(size, relativeTo: style))
            .tracking(size * -0.025)
            .lineHeight(.multiple(factor: 1.04))
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Accessibility

/// Posts a VoiceOver announcement (no-op when VoiceOver is off).
@MainActor
func lessonAnnounce(_ text: String) {
    AccessibilityNotification.Announcement(text).post()
}
