import SwiftUI

// Shared pieces for the Learn screens: the page scaffold (paper, width-aware gutter,
// the inline title that fades in once the h1 scrolls away), the carbon-copy log row,
// figure cells, the resume bar and the "next unlock" card. Everything here is prefixed
// `Learn` so it can't collide with another feature's helpers in the same module.

// MARK: - Layout

/// How wide the page is, measured once at the top of each Learn screen, so sections
/// can switch between the phone layout and the wider iPad and Mac ones by real width
/// (a split-view iPad or a narrow Mac window counts as narrow).
struct LearnLayout: Equatable, Sendable {
    var width: CGFloat

    /// The site's `--gut`, clamped between 16 and 54.
    var gutter: CGFloat { LF.Metrics.gutter(for: width) }

    /// The column the content actually gets (`nb-wrap` stops at 1280).
    var contentWidth: CGFloat { max(0, min(width - gutter * 2, LF.Metrics.maxContentWidth)) }

    /// Rows go three-column, figures go four-up, cards go two-up.
    var isRegular: Bool { contentWidth >= 700 }

    /// Margin notes move beside the main column.
    var isWide: Bool { contentWidth >= 960 }

    /// The site's twelve-column department wall.
    var isWall: Bool { contentWidth >= 1000 }
}

extension View {
    /// One section of a Learn page: capped at `nb-wrap`'s 1280, padded by the gutter,
    /// centred in wide windows.
    func learnColumn(_ layout: LearnLayout, maxWidth: CGFloat = LF.Metrics.maxContentWidth) -> some View {
        self
            .frame(maxWidth: maxWidth, alignment: .leading)
            .padding(.horizontal, layout.gutter)
            .frame(maxWidth: .infinity)
    }

    /// A full-width blue band (`SlabView`) kept to the page's own column. The band's fill
    /// is a background, and backgrounds reach into the safe area, which on iPad and Mac
    /// put it under the glass sidebar as a blurred glow with a hard top and bottom.
    /// Clipped, the band runs edge to edge of the page and stops at the sidebar.
    func learnBand() -> some View {
        clipped()
    }

    /// Caps running text at about `characters` characters a line (the site's `ch`
    /// measures), growing with Dynamic Type so a larger size keeps the same measure.
    func learnMeasure(_ characters: CGFloat = 46) -> some View {
        modifier(LearnMeasure(characters: characters))
    }
}

private struct LearnMeasure: ViewModifier {
    let characters: CGFloat
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        // Bricolage at 17pt runs about 9pt a character.
        content.frame(maxWidth: characters * 9.2 * scale, alignment: .leading)
    }
}

// MARK: - Page scaffold

/// A Learn screen: paper ground that scrolls with the content, the width in hand for
/// every section, a `ScrollViewProxy` for in-page jumps, pull to refresh, and on iPhone
/// and iPad an inline title that only appears once the page's own h1 has scrolled off.
///
/// These are reading pages, so the keyboard doesn't inset them unless the page asks
/// (`avoidsKeyboard`, for a page with a search field): on iPad a keyboard inset once
/// outlived the sign-in sheet and left a blank band under the last card.
struct LearnScrollPage<Content: View>: View {
    let title: String
    var refresh: (@MainActor () async -> Void)?
    var avoidsKeyboard: Bool
    /// Which screen this is, so its scroll position comes back when the Mac builds the tab
    /// again (`remembersScroll`). Nil keeps nothing.
    var place: ScreenPlace?
    @ViewBuilder let content: (LearnLayout, ScrollViewProxy) -> Content

    @State private var pastHeader = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        title: String,
        refresh: (@MainActor () async -> Void)? = nil,
        avoidsKeyboard: Bool = false,
        place: ScreenPlace? = nil,
        @ViewBuilder content: @escaping (LearnLayout, ScrollViewProxy) -> Content
    ) {
        self.title = title
        self.refresh = refresh
        self.avoidsKeyboard = avoidsKeyboard
        self.place = place
        self.content = content
    }

    var body: some View {
        GeometryReader { geometry in
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        content(LearnLayout(width: geometry.size.width), proxy)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 64)
                }
                .onScrollGeometryChange(for: Bool.self) { scroll in
                    scroll.contentOffset.y + scroll.contentInsets.top > 110
                } action: { _, isPast in
                    pastHeader = isPast
                }
                .remembersScroll(place)
                .modifier(LearnRefreshable(refresh: refresh))
                .paperBackground()
            }
        }
        .closesShareSheetsOnNavigation()
        #if os(iOS)
        .ignoresSafeArea(avoidsKeyboard ? [] : .keyboard, edges: .bottom)
        #endif
        .navigationTitle(title)
        #if os(iOS)
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(title)
                    .font(.headline)
                    .lineLimit(1)
                    .opacity(pastHeader ? 1 : 0)
                    .animation(reduceMotion ? nil : LF.Motion.hover, value: pastHeader)
                    .accessibilityHidden(!pastHeader)
            }
        }
        #endif
    }
}

private struct LearnRefreshable: ViewModifier {
    let refresh: (@MainActor () async -> Void)?

    func body(content: Content) -> some View {
        if let refresh {
            content.refreshable { await refresh() }
        } else {
            content
        }
    }
}

// MARK: - Text

/// `nb-lede`: the graphite paragraph under an h1.
struct LearnLede: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lfProse(18.5, lineHeight: 1.5, color: LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .learnMeasure(46)
    }
}

/// `nb-sub`: the supporting paragraph under a section heading.
struct LearnSub: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lfProse(16.5, lineHeight: 1.5, color: LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .learnMeasure(56)
    }
}

/// A section heading with its mono kicker, the way every band on the site opens.
struct LearnSectionHeader: View {
    var kicker: String?
    let title: String
    var level: LF.TitleLevel = .h2
    var sub: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let kicker {
                SectionLabel(kicker).padding(.bottom, 12)
            }
            LearnWholeWords(text: title) { string in
                Text(string)
                    .lfTitle(level)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 620, alignment: .leading)
            if let sub {
                LearnSub(sub).padding(.top, 10)
            }
        }
    }
}

/// The breadcrumb as the site prints it: a mono file path, `guides / cad-design`.
/// The last part is bold ink. It wraps rather than truncating on a phone. Not
/// tappable: the back button is the way up.
struct LearnTrail: View {
    let parts: [String]

    var body: some View {
        let head = parts.dropLast().map { $0 + " / " }.joined()
        let last = Text(parts.last ?? "")
            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
            .foregroundStyle(LF.Palette.ink)
        Text("\(head)\(last)")
            .font(LF.Fonts.mono(12.5, relativeTo: .caption))
            .tracking(0.25)
            .foregroundStyle(LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(parts.joined(separator: ", "))
    }
}

// MARK: - Whole words

/// Text that never breaks inside a word. While its longest word fits on a line it's simply
/// the text, wrapping between words as usual. At the largest accessibility sizes one long
/// word ("Troubleshooting", "Manufacturability,") can be wider than a phone's whole column,
/// and a plain `Text` splits it mid-word ("Troubleshooti / ng"); then the text steps down a
/// Dynamic Type size at a time until that word fits, staying as large as the line allows.
///
/// `style` sets a string in the text's own type; it draws the text, and a hidden copy of
/// the longest word that the fit is measured against.
struct LearnWholeWords<Content: View>: View {
    let text: String
    @ViewBuilder var style: (String) -> Content

    /// The longest run `Text` won't break: words, cut after a hyphen, a slash or a dot, where
    /// a line can already end ("getting-", "autonomous/", a web address's "windows.").
    private var longestWord: String {
        var longest = Substring()
        for word in text.split(whereSeparator: \.isWhitespace) {
            var start = word.startIndex
            for index in word.indices where "-/.".contains(word[index]) {
                let piece = word[start...index]
                if piece.count > longest.count { longest = piece }
                start = word.index(after: index)
            }
            let piece = word[start...]
            if piece.count > longest.count { longest = piece }
        }
        return String(longest)
    }

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// The sizes it steps down through, largest first, from the reader's own.
    private var steps: [DynamicTypeSize] {
        [.accessibility5, .accessibility4, .accessibility3, .accessibility2, .accessibility1, .xxxLarge]
            .filter { $0 <= dynamicTypeSize }
    }

    var body: some View {
        // Below the accessibility sizes every word fits a phone's column, so it's only the text.
        if dynamicTypeSize.isAccessibilitySize {
            let word = longestWord
            LearnNaturalIdealWidth {
                style(text)
                    .hidden()
                    .accessibilityHidden(true)
                ViewThatFits(in: .horizontal) {
                    ForEach(steps, id: \.self) { size in
                        candidate(word, upTo: size)
                    }
                    // Nothing fits even then (a column far narrower than a phone): plain text.
                    style(text)
                }
            }
        } else {
            style(text)
        }
    }

    /// The text at no more than `size`. Its ideal width is the longest word's, so
    /// `ViewThatFits` takes it once that word fits; laid out, it wraps to the width offered
    /// and is no wider than its text.
    private func candidate(_ word: String, upTo size: DynamicTypeSize) -> some View {
        ZStack(alignment: .topLeading) {
            style(word)
                .fixedSize()
                .hidden()
                .accessibilityHidden(true)
            style(text)
                .frame(idealWidth: 0, alignment: .leading)
        }
        .dynamicTypeSize(...size)
    }
}

/// Reports the first subview's ideal width (the text on one line) and otherwise is the
/// second subview, so `LearnWholeWords` sits in a `ViewThatFits` or an `HStack` exactly as
/// its plain `Text` would: the candidates inside it measure as narrow as their longest word.
private struct LearnNaturalIdealWidth: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard subviews.count == 2 else { return .zero }
        guard proposal.width == nil else { return subviews[1].sizeThatFits(proposal) }
        let natural = subviews[0].sizeThatFits(.unspecified).width
        let shown = subviews[1].sizeThatFits(ProposedViewSize(width: natural, height: proposal.height))
        return CGSize(width: natural, height: shown.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 2 else { return }
        subviews[0].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
        subviews[1].place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(bounds.size))
    }
}

/// A jump-to chip (`TagView`) that stays whole. A tag is one line, and at the largest text
/// sizes a long name ("Business, Operations & Fundraising  9") is wider than the screen and
/// was cut short; this steps the chip's text size down until it fits the line it's given.
struct LearnFittingTag: View {
    let text: String

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Smaller sizes to try, largest first, below the reader's own.
    private var steps: [DynamicTypeSize] {
        [.accessibility3, .accessibility1, .xxLarge, .large].filter { $0 < dynamicTypeSize }
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            TagView(text)
            ForEach(steps, id: \.self) { size in
                TagView(text).dynamicTypeSize(...size)
            }
        }
    }
}

/// A slug line (the mono `nb-slug`) that wraps between words, or after a hyphen, and never
/// inside a word (see `LearnWholeWords`). For slugs that print catalogue titles: "dept /
/// getting-started / Common Mistakes & Troubleshooting".
struct LearnWholeWordSlug: View {
    let text: String
    var color: Color = LF.Palette.graphite
    var weight: Font.Weight = .regular

    var body: some View {
        LearnWholeWords(text: text) { string in
            SlugText(string, color: color, weight: weight)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Figures

/// One figure with its mono label (`dt.nb-slug` over `dd.nb-count`).
struct LearnFigure: View {
    let label: String
    let value: String
    var unit: String?
    var size: CGFloat = 26

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            SlugText(label)
            CountText(value, unit: unit, size: size)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)\(unit.map { " \($0)" } ?? "")")
    }
}

/// A phone's `label .... figure` line: the label on the left and the figure on the right
/// while both fit on one line, the figure under the label once they don't (the largest
/// text sizes), rather than squeezing the label until it breaks mid-word ("master / ed").
struct LearnLabelledFigure<Label: View, Figure: View>: View {
    @ViewBuilder var label: Label
    @ViewBuilder var figure: Figure

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                label
                Spacer(minLength: 12)
                figure
            }
            VStack(alignment: .leading, spacing: 6) {
                label
                figure
            }
        }
    }
}

/// A row of figures ruled off across the page (`nb-rule` + a four-up `dl`). Two-up on
/// a phone, four-up from regular width. Figures in a row share a baseline even when a
/// label wraps, because the block's whole job is to print figures on one line.
struct LearnFigureRule: View {
    let figures: [(label: String, value: String, unit: String?)]
    let layout: LearnLayout

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// Half as many across at the accessibility sizes: two-up on a phone left each label
    /// a column narrower than "lessons" and split it mid-word.
    private var perRow: Int {
        let large = dynamicTypeSize.isAccessibilitySize
        return layout.isRegular ? max(1, min(figures.count, large ? 2 : 4)) : (large ? 1 : 2)
    }

    private var rows: [[Int]] {
        let perRow = perRow
        return stride(from: 0, to: figures.count, by: perRow).map { start in
            Array(start..<min(start + perRow, figures.count))
        }
    }

    /// Equal columns, each label wrapping inside its own (a `Grid` sized its columns to the
    /// labels on one line and ran off the page at the larger text sizes). A short last row
    /// keeps the same columns.
    var body: some View {
        let perRow = perRow
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            VStack(alignment: .leading, spacing: 18) {
                ForEach(rows, id: \.self) { row in
                    HStack(alignment: .lastTextBaseline, spacing: 20) {
                        ForEach(row, id: \.self) { index in
                            let figure = figures[index]
                            LearnFigure(label: figure.label, value: figure.value, unit: figure.unit)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        ForEach(row.count..<perRow, id: \.self) { _ in
                            Color.clear
                                .frame(maxWidth: .infinity, maxHeight: 0)
                                .accessibilityHidden(true)
                        }
                    }
                }
            }
            .padding(.top, 16)
        }
    }
}

/// The oversized figure on the blue slab (`nb-stamp`): it lands once like ink.
struct LearnSlabFigure: View {
    let value: String
    let label: String

    @State private var landed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value)
                .font(LF.Fonts.mono(44, weight: .bold, relativeTo: .largeTitle))
                .tracking(-1.7)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .scaleEffect(landed || reduceMotion ? 1 : SiteTokens.Movement.inkScale, anchor: .bottomLeading)
                .offset(y: landed || reduceMotion ? 0 : SiteTokens.Movement.inkDrop)
            Rectangle()
                .fill(LF.Palette.onBlue.opacity(0.4))
                .frame(height: 1)
                .padding(.top, 9)
            Text(label)
                .font(LF.Fonts.mono(12.8, relativeTo: .caption))
                .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                .padding(.top, 8)
        }
        .foregroundStyle(LF.Palette.onBlue)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) \(label)")
        .onAppear {
            guard !landed else { return }
            if reduceMotion { landed = true } else { withAnimation(LF.Motion.stamp) { landed = true } }
        }
    }
}

// MARK: - The log

/// One line of the carbon-copy log (`nb-row`): identifiers on the left, the title and
/// what it covers in the middle, the word you'd click on the right. One column on a
/// phone. Wrap it in a `NavigationLink` with `.buttonStyle(.inkRow)`.
struct LearnLogRow<Meta: View, Main: View>: View {
    let layout: LearnLayout
    var trailing: String?
    @ViewBuilder var meta: Meta
    @ViewBuilder var main: Main

    var body: some View {
        Group {
            if layout.isRegular {
                HStack(alignment: .firstTextBaseline, spacing: 28) {
                    meta.frame(width: min(210, layout.contentWidth * 0.22), alignment: .leading)
                    main.frame(maxWidth: .infinity, alignment: .leading)
                    if let trailing {
                        SlugText(trailing, color: LF.Palette.ink)
                            .fixedSize()
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 7) {
                    meta
                    main
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.vertical, layout.isRegular ? 20 : 15)
        .overlay(alignment: .bottom) { DashedRule() }
        .contentShape(Rectangle())
    }
}

/// The title and summary in the middle of a log row.
struct LearnRowText: View {
    let title: String
    var summary: String?
    var summaryLines: Int? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            LearnWholeWords(text: title) { string in
                Text(string)
                    .font(LF.Fonts.display(19, relativeTo: .title3))
                    .tracking(-0.45)
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let summary, !summary.isEmpty {
                Text(summary)
                    .font(LF.Fonts.body(15.5))
                    .lineHeight(.multiple(factor: 1.4))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .lineLimit(summaryLines)
                    .fixedSize(horizontal: false, vertical: summaryLines == nil)
                    .learnMeasure(62)
            }
        }
    }
}

// MARK: - Ticks

/// The tick in the margin of a lesson row: a small hand-ruled box, with a blue pen
/// check when the lesson is done. Never the only signal (rows also say "done").
struct LearnTickBox: View {
    let done: Bool
    @ScaledMetric(relativeTo: .body) private var size: CGFloat = 19

    var body: some View {
        ZStack {
            HandShape(.s).fill(LF.Palette.card)
            HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
            if done {
                PenCheckShape()
                    .stroke(LF.Palette.blue, style: StrokeStyle(lineWidth: 2.3, lineCap: .round, lineJoin: .round))
                    .frame(width: size * 0.62, height: size * 0.47)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// A part number stamped in a box: a module's `01` or `pre`, a department's symbol.
struct LearnStampedBox<Content: View>: View {
    var side: CGFloat = 44
    @ViewBuilder var content: Content
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    var body: some View {
        content
            .frame(width: side * scale, height: side * scale)
            .background {
                ZStack {
                    HandShape(.s).fill(LF.Palette.card)
                    HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                }
            }
    }
}

// MARK: - Buttons drawn inside a card

/// The face of a small primary button, for inside a card that is itself the button.
struct LearnButtonFace: View {
    let title: String
    var ghost = false

    var body: some View {
        Text(title)
            .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
            .foregroundStyle(ghost ? LF.Palette.ink : LF.Palette.onBlue)
            .lineLimit(1)
            .fixedSize()
            .padding(.vertical, 9)
            .padding(.horizontal, 14)
            .background {
                ZStack {
                    HandShape(.s).fill(ghost ? Color.clear : LF.Palette.blueButton)
                    HandShape(.s).strokeBorder(ghost ? LF.Palette.ink : LF.Palette.blueButton, lineWidth: LF.Metrics.stroke)
                }
            }
            .accessibilityHidden(true)
    }
}

/// An inline text link in the site's `nb-link` style: ink, blue rule under it.
struct LearnLinkLabel: View {
    let title: String
    var systemImage: String?

    var body: some View {
        HStack(spacing: 6) {
            Text(title)
                .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                .underline(true, color: LF.Palette.blue)
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.caption.weight(.semibold))
                    .accessibilityHidden(true)
            }
        }
        .foregroundStyle(LF.Palette.ink)
        .frame(minHeight: LF.Metrics.tap)
        .contentShape(Rectangle())
    }
}

// MARK: - Resume and next unlock

/// "Pick up where you left off": the next lesson, named, with the action on the right
/// (the site's `ResumeCard`, bar variant). The whole card is the link.
struct LearnResumeBar: View {
    let location: LessonLocation
    var kicker: String
    var action: String

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        NavigationLink(value: AppRoute.lesson(location.lesson.id)) {
            NotebookCard(lift: true, padding: 15) {
                // Every line whole: the site truncates these to one line each, but at the
                // larger text sizes that cut the lesson's name off. At the accessibility
                // sizes the action goes under the text instead of squeezing it.
                let text = VStack(alignment: .leading, spacing: 4) {
                    SlugText("\(kicker) / dept / \(location.department.slug)")
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(location.lesson.title)
                        .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(location.department.name), \(location.module.title)")
                        .font(LF.Fonts.body(14.5))
                        .foregroundStyle(LF.Palette.graphite)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 12) {
                        text
                        LearnButtonFace(title: action)
                    }
                } else {
                    HStack(alignment: .center, spacing: 14) {
                        text
                        LearnButtonFace(title: action)
                    }
                }
            }
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel("\(action): \(location.lesson.title)")
        .accessibilityValue("\(location.department.name), \(location.module.title)")
    }
}

/// The nearest badge and how far off it is (the site's `NextUnlock`). The figure is
/// always printed beside the bar.
struct LearnNextUnlockCard: View {
    let unlock: NextUnlock
    let layout: LearnLayout

    private var remaining: Int { unlock.progress.remaining }

    private var unit: String {
        let unit = unlock.progress.unit
        return remaining == 1 && unit.hasSuffix("s") ? String(unit.dropLast()) : unit
    }

    var body: some View {
        NotebookCard(padding: 15) {
            let text = VStack(alignment: .leading, spacing: 4) {
                SlugText("next unlock")
                Text(unlock.name)
                    .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                    .foregroundStyle(LF.Palette.ink)
                Text("\(remaining) more \(unit). \(unlock.description)")
                    .font(LF.Fonts.body(14.5))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            let meter = MeterView(value: unlock.progress.fraction, label: "progress",
                                  valueText: "\(unlock.progress.current)/\(unlock.progress.target)")
            Group {
                if layout.isRegular {
                    HStack(alignment: .center, spacing: 22) {
                        text.frame(maxWidth: .infinity, alignment: .leading)
                        meter.frame(width: 150)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 14) {
                        text
                        meter
                    }
                }
            }
            .frame(maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// This week's count against the goal, exactly as the server sent it (guests: worked
/// out on this device, and labelled that way).
struct LearnWeekMeter: View {
    let rhythm: Rhythm
    var copy: RhythmCopy?
    var onDevice: Bool

    var body: some View {
        NotebookCard(padding: 15) {
            VStack(alignment: .leading, spacing: 10) {
                MeterView(value: rhythm.fraction,
                          label: onDevice ? "\(rhythm.windowLabel), on this device" : rhythm.windowLabel,
                          valueText: "\(rhythm.windowCount)/\(rhythm.goal)")
                if let copy, !copy.headline.isEmpty {
                    // The server's copy uses em dashes; the app writes them as full stops,
                    // the same rewrite Home's week card uses.
                    Text(HomeCopy.plain(copy.headline))
                        .font(LF.Fonts.body(14.5))
                        .foregroundStyle(LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

// MARK: - States

/// The note shown while the catalogue is still arriving on a first launch.
struct LearnLoadingBlock: View {
    var rows = 4

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(height: 30, width: 240)
            SkeletonBlock(height: 18)
            SkeletonBlock(height: 18, width: 200)
            ForEach(0..<rows, id: \.self) { _ in
                SkeletonBlock(height: 120)
                    .padding(.top, 8)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading the guides")
    }
}

/// A plain-spoken note for "nothing here" and "couldn't load" states.
struct LearnNotice<Actions: View>: View {
    let kicker: String
    let message: String
    @ViewBuilder var actions: Actions

    var body: some View {
        NoteCallout {
            SlugText(kicker)
            Text(message)
                .font(LF.Fonts.body(16))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            actions
                .padding(.top, 6)
        }
        .learnMeasure(60)
    }
}

extension LearnNotice where Actions == EmptyView {
    init(kicker: String, message: String) {
        self.init(kicker: kicker, message: message) { EmptyView() }
    }
}

// MARK: - Motion

extension View {
    /// The site's arrival for a taped card (`nb-straighten`): it comes in a little crooked
    /// and low and is pushed square onto its resting angle. Transform only, so nothing is
    /// ever invisible; nothing at all under Reduce Motion.
    func learnArrival(_ reduceMotion: Bool, angle: Double = SiteTokens.Movement.straightenAngle) -> some View {
        scrollTransition(reduceMotion ? .identity : .animated(LF.Motion.arrive)) { content, phase in
            content
                .rotationEffect(.degrees(phase.isIdentity ? 0 : angle))
                .offset(y: phase.isIdentity ? 0 : 8)
        }
    }
}

// MARK: - Formatting

enum LearnFormat {
    /// `01`, `02` ... the way the site numbers stops and lessons.
    static func ordinal(_ n: Int) -> String {
        n < 10 ? "0\(n)" : "\(n)"
    }

    /// How to ask for a refresh here: a pull on iPhone and iPad, Command-R on a Mac (View >
    /// Refresh), which has no pull gesture. "Pull down to check learnfrc.com".
    static var checkSite: String {
        #if os(macOS)
        "Press Command-R to check learnfrc.com"
        #else
        "Pull down to check learnfrc.com"
        #endif
    }

    static func plural(_ n: Int, _ one: String, _ many: String) -> String {
        "\(n.formatted()) \(n == 1 ? one : many)"
    }

    /// `2026-10-03` as "Oct 3, 2026" (or "October 3, 2026"), read in UTC so the date
    /// never slips a day in a western timezone.
    static func articleDate(_ raw: String, long: Bool = false) -> String {
        guard let date = FlexibleDate.parse(String(raw.prefix(10))) else { return raw }
        var style = Date.FormatStyle(date: long ? .long : .abbreviated, time: .omitted)
        style.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return date.formatted(style)
    }

    /// "done, 20 minutes" for VoiceOver.
    static func lessonState(done: Bool, pending: Bool, minutes: Int) -> String {
        var parts: [String] = []
        if done { parts.append("done") }
        if pending { parts.append("saved, will sync") }
        if minutes > 0 { parts.append("\(minutes) minutes") }
        return parts.joined(separator: ", ")
    }

    static func hours(fromMinutes minutes: Int) -> Int {
        max(1, Int((Double(minutes) / 60).rounded()))
    }
}
