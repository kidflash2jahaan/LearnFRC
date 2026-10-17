import SwiftUI

/// The article library (learnfrc.com/blog): the six to read first, then every article
/// filed on the desk that owns it, with a search across titles, descriptions and keywords.
struct ArticlesView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(AppModel.self) private var model
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var query = ""
    @State private var didRestore = false
    /// The tab the library appeared in, for when the environment doesn't say (a screen pushed
    /// on the Mac doesn't see its stack's `\.navigationTab`).
    @State private var appearedTab: AppTab?

    init() {}

    /// The search words wait in the window's memory while the library is in its tab's stack:
    /// the Mac builds the tab again on every switch (ARCHITECTURE 6.6), and the library should
    /// come back narrowed the way it was left.
    private var kept: ScreenPlaceMemory? { memory(in: tab ?? appearedTab) }

    private func memory(in tab: AppTab?) -> ScreenPlaceMemory? {
        ScreenPlaceMemory(.route(.articlesIndex), navigation: navigation, tab: tab)
    }
    private static let queryThing = "articles.query"

    var body: some View {
        let articles = catalog.articles
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        LearnScrollPage(title: "Articles", refresh: { await model.refreshAll() }, avoidsKeyboard: true, place: .route(.articlesIndex)) { layout, proxy in
            if trimmed.isEmpty {
                library(articles, layout: layout, proxy: proxy)
            } else {
                results(ArticleDesks.search(trimmed, in: articles), query: trimmed, layout: layout)
                    .learnColumn(layout, spread: true)
                    .padding(.top, 20)
            }
        }
        .modifier(LearnSearchable(text: $query, prompt: Text("Search \(articles.count) articles")))
        .onAppear(perform: restoreQuery)
        .onChange(of: query) { _, words in
            // Only what's typed while the library is on show: on the Mac the field empties
            // itself as a tab switch takes the screen down, and that isn't the person clearing it.
            guard didRestore, let kept, kept.place.isOnShow(navigation: kept.navigation, tab: kept.tab) else { return }
            kept.set(words, for: Self.queryThing)
        }
        // Gone back from: the next visit starts with the whole library.
        .onDisappear { kept?.forgetIfLeft(Self.queryThing) }
    }

    private func restoreQuery() {
        guard !didRestore else { return }
        didRestore = true
        // On the Mac only the selected tab's stack is built, so that's the one it's in.
        let tab = tab ?? navigation?.selectedTab
        appearedTab = tab
        if let words = memory(in: tab)?.value(String.self, for: Self.queryThing), !words.isEmpty {
            query = words
        }
    }

    // MARK: The library

    @ViewBuilder
    private func library(_ articles: [Article], layout: LearnLayout, proxy: ScrollViewProxy) -> some View {
        let desks = ArticleDesks.group(articles)
        let featured = ArticleDesks.featured(in: articles)
        let minutes = articles.reduce(0) { $0 + $1.readMins }

        if let pages = layout.pages, !articles.isEmpty {
            // iPhone Duo's inner screen held upright: the masthead and the desks to jump to
            // side by side, the six in two cards, and the desks down both pages.
            LearnSpread(pages: pages) {
                masthead(count: articles.count, minutes: minutes, layout: .page(pages.leading))
            } trailing: {
                deskIndex(desks, total: articles.count, layout: .page(pages.trailing), proxy: proxy)
            }
            .learnColumn(layout, spread: true)
            .padding(.top, 20)

            if !featured.isEmpty {
                frontDoor(featured, layout: layout)
                    .learnColumn(layout, spread: true)
                    .padding(.top, 44)
            }

            LearnFoldColumns(pages: pages, fill: .balanced, spacing: 44) {
                ForEach(desks) { desk in
                    deskSection(desk, layout: .page(min(pages.leading, pages.trailing)))
                        .id(LearnAnchor.desk(desk.slug))
                }
            }
            .learnColumn(layout, spread: true)
            .padding(.top, 52)
        } else {
            masthead(count: articles.count, minutes: minutes, layout: layout)
                .learnColumn(layout)
                .padding(.top, 20)

            if articles.isEmpty {
                Group {
                    if !catalog.isLoaded {
                        LearnLoadingBlock(rows: 3)
                    } else {
                        LearnNotice(kicker: "articles / none yet",
                                    message: "The articles aren't on this device yet. They download the first time the app has a connection, then work offline.")
                    }
                }
                .learnColumn(layout)
                .padding(.top, 28)
            } else {
                if !featured.isEmpty {
                    frontDoor(featured, layout: layout)
                        .learnColumn(layout)
                        .padding(.top, 44)
                }

                deskIndex(desks, total: articles.count, layout: layout, proxy: proxy)
                    .learnColumn(layout)
                    .padding(.top, 52)

                ForEach(desks) { desk in
                    deskSection(desk, layout: layout)
                        .learnColumn(layout)
                        .padding(.top, 44)
                        .id(LearnAnchor.desk(desk.slug))
                }
            }
        }
    }

    private func masthead(count: Int, minutes: Int, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("the loose pages")
            Text("Every question a team ends up googling.")
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
            LearnLede("\(count.formatted()) write-ups of the things that break, the things nobody explains, and the parts of a season you only learn by losing a match.")
                .padding(.top, 16)
            DashedRule()
                .padding(.top, 20)
            SlugText("\(LearnFormat.plural(count, "article", "articles")) / \(minutes.formatted()) minutes of reading / no account to read any of it")
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            MarkerText("start at the desk your team is worst at")
                .padding(.top, 16)
        }
    }

    // MARK: If you only read six

    private func frontDoor(_ featured: [Article], layout: LearnLayout) -> some View {
        let half = (featured.count + 1) / 2
        let columns = layout.isRegular ? [Array(featured.prefix(half)), Array(featured.dropFirst(half))] : [featured]
        return VStack(alignment: .leading, spacing: 0) {
            if let pages = layout.pages {
                LearnSpreadRule(pages: pages)
                LearnSectionHeader(
                    title: "If you only read \(featured.count)",
                    sub: "What FRC actually is, how to get a team off the ground, how a competition day runs, and the two topics every team ends up arguing about at 1am."
                )
                .frame(width: pages.leading, alignment: .leading)
                .padding(.top, 28)
                // One card on each page, read in order down the first and then the second.
                LearnSpread(pages: pages) {
                    featuredCard(Array(featured.prefix(half)), firstNumber: 1)
                } trailing: {
                    VStack(alignment: .leading, spacing: 10) {
                        SlugText("read in this order")
                        featuredCard(Array(featured.dropFirst(half)), firstNumber: half + 1)
                    }
                }
                .padding(.top, 24)
            } else {
                frontDoorBody(featured, columns: columns, half: half, layout: layout)
            }
        }
    }

    private func featuredCard(_ articles: [Article], firstNumber: Int) -> some View {
        NotebookCard(padding: 0) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(articles.enumerated()), id: \.element.id) { index, article in
                    if index > 0 { DashedRule() }
                    featuredRow(article, number: firstNumber + index)
                }
            }
            .padding(.horizontal, LF.Metrics.cardPadding)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func frontDoorBody(_ featured: [Article], columns: [[Article]], half: Int, layout: LearnLayout) -> some View {
        InkRule()
        HStack(alignment: .bottom, spacing: 24) {
            LearnSectionHeader(
                title: "If you only read \(featured.count)",
                sub: "What FRC actually is, how to get a team off the ground, how a competition day runs, and the two topics every team ends up arguing about at 1am."
            )
            .frame(maxWidth: .infinity, alignment: .leading)
            if layout.isRegular {
                SlugText("read in this order").fixedSize()
            }
        }
        .padding(.top, 28)

        NotebookCard(padding: 0) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(Array(columns.enumerated()), id: \.offset) { columnIndex, column in
                    if columnIndex > 0 {
                        Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.stroke)
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(column.enumerated()), id: \.element.id) { index, article in
                            if index > 0 { DashedRule() }
                            featuredRow(article, number: columnIndex * half + index + 1)
                        }
                    }
                    .padding(.horizontal, LF.Metrics.cardPadding)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 24)
    }

    private func featuredRow(_ article: Article, number: Int) -> some View {
        NavigationLink(value: AppRoute.article(article.slug)) {
            let ordinal = Text(LearnFormat.ordinal(number))
                .font(LF.Fonts.mono(14.5, weight: .bold, relativeTo: .callout))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
            let text = VStack(alignment: .leading, spacing: 6) {
                LearnRowText(title: article.title, summary: article.description)
                SlugText("\(article.readMins) min")
            }
            // The number in the margin, or above the title at the accessibility sizes,
            // where the margin left the text a column too narrow for its words.
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 6) {
                        ordinal
                        text
                    }
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 14) {
                        ordinal
                        text
                    }
                }
            }
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel("\(number). \(article.title)")
        .accessibilityValue("\(article.readMins) minute read")
        .accessibilityHint(article.description)
    }

    // MARK: The desks

    private func deskIndex(_ desks: [ArticleDesks.Desk], total: Int, layout: LearnLayout, proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            SectionLabel("\(LearnFormat.plural(total, "article", "articles")) / \(LearnFormat.plural(desks.count, "desk", "desks"))")
                .padding(.top, 28)
            LearnSub("Everything in print, filed where a person would go looking for it. Jump straight to a desk, or read down the page.")
                .padding(.top, 12)
            LearnFlowLayout(spacing: 8, lineSpacing: 2) {
                ForEach(desks) { desk in
                    Button {
                        LF.Motion.perform(LF.Motion.settle) {
                            proxy.scrollTo(LearnAnchor.desk(desk.slug), anchor: .top)
                        }
                    } label: {
                        LearnFittingTag(text: "\(desk.label)  \(desk.articles.count)")
                            .frame(minHeight: LF.Metrics.tap)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Jump to \(desk.label)")
                    .accessibilityValue(LearnFormat.plural(desk.articles.count, "article", "articles"))
                }
            }
            .padding(.top, 16)
        }
    }

    private func deskSection(_ desk: ArticleDesks.Desk, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // The count beside the desk's name; under it at the accessibility sizes, where
            // beside it left the name a column too narrow for its words.
            let heading = VStack(alignment: .leading, spacing: 8) {
                LearnWholeWords(text: desk.label) { string in
                    Text(string)
                        .lfTitle(.h2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                LearnSub(desk.blurb)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            let count = CountText(desk.articles.count, unit: desk.articles.count == 1 ? "article" : "articles")
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 12) {
                    heading
                    count
                }
            } else {
                HStack(alignment: .bottom, spacing: 20) {
                    heading
                    count.fixedSize()
                }
            }
            VStack(spacing: 0) {
                InkRule()
                ForEach(desk.articles) { article in
                    articleRow(article, layout: layout)
                }
            }
            .padding(.top, 18)
        }
    }

    private func articleRow(_ article: Article, layout: LearnLayout) -> some View {
        NavigationLink(value: AppRoute.article(article.slug)) {
            LearnLogRow(layout: layout, trailing: "open") {
                VStack(alignment: .leading, spacing: 3) {
                    SlugText("\(article.readMins) min read")
                    SlugText(LearnFormat.articleDate(article.date))
                }
            } main: {
                LearnRowText(title: article.title, summary: article.description)
            }
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel(article.title)
        .accessibilityValue("\(article.readMins) minute read, \(LearnFormat.articleDate(article.date, long: true))")
        .accessibilityHint(article.description)
    }

    // MARK: Search

    private func results(_ matches: [Article], query: String, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(matches.isEmpty ? "no matches" : LearnFormat.plural(matches.count, "match", "matches"))
            if matches.isEmpty {
                LearnNotice(kicker: "search / \(query)",
                            message: "No article mentions \"\(query)\". Try a shorter word, or a part name like PDH or SPARK MAX.")
                    .frame(maxWidth: layout.pages?.leading ?? .infinity, alignment: .leading)
                    .padding(.top, 16)
            } else if let pages = layout.pages {
                // Down the leading page, then on down the trailing one.
                let half = (matches.count + 1) / 2
                LearnSpread(pages: pages) {
                    resultList(Array(matches.prefix(half)), layout: .page(pages.leading))
                } trailing: {
                    resultList(Array(matches.dropFirst(half)), layout: .page(pages.trailing))
                }
                .padding(.top, 16)
            } else {
                resultList(matches, layout: layout)
                    .padding(.top, 16)
            }
        }
    }

    @ViewBuilder
    private func resultList(_ matches: [Article], layout: LearnLayout) -> some View {
        if !matches.isEmpty {
            VStack(spacing: 0) {
                InkRule()
                ForEach(matches) { article in
                    articleRow(article, layout: layout)
                }
            }
        }
    }
}

// MARK: - Search field

/// `searchable` that stays in sight beside iPhone Duo's vertical bar. With the bar showing
/// (the cover screen, the inner screen held upright) the automatic placement left no field to
/// type in until something else focused it, so there it's pinned in the navigation bar's
/// drawer; everywhere else it's the usual automatic field.
struct LearnSearchable: ViewModifier {
    @Binding var text: String
    let prompt: Text

    @Environment(\.lfVerticalBarEdge) private var barEdge

    func body(content: Content) -> some View {
        #if os(iOS)
        content.searchable(text: $text,
                           placement: barEdge == nil ? .automatic : .navigationBarDrawer(displayMode: .always),
                           prompt: prompt)
        #else
        content.searchable(text: $text, prompt: prompt)
        #endif
    }
}

// MARK: - Desks

/// The site's editorial desks (`DESKS` in `src/app/blog/page.tsx`): the shelves the
/// library is filed on, in reading order. Matched on the slug first, then the keywords.
nonisolated enum ArticleDesks {
    struct Desk: Identifiable, Hashable, Sendable {
        let label: String
        let slug: String
        let blurb: String
        var articles: [Article]
        var id: String { slug }
    }

    private struct Rule: Sendable {
        let label: String
        let slug: String
        let blurb: String
        let pattern: String
    }

    private static let rules: [Rule] = [
        Rule(label: "Start Here", slug: "start-here",
             blurb: "What FRC is, how a season runs, and how to get on a team.",
             pattern: "^what-is-frc|start-an-frc|joining-your-first|vs-ftc-vs-vex|rookie-mistakes|kickoff|how-frc-competitions-work|game-manual|team-structure|mentor-guide|gracious"),
        Rule(label: "In the Pit", slug: "in-the-pit",
             blurb: "Competition-day failures, and how to diagnose them fast.",
             pattern: "troubleshoot|inspection|pit-checklist|status-lights|no-robot-code|bumpers|robot-rules|battery|first-frc-competition|radio-networking|module-offsets"),
        Rule(label: "Drivetrain & Mechanisms", slug: "drivetrain-mechanisms",
             blurb: "Swerve, gearing, intakes, elevators, shooters, and how to build them.",
             pattern: "swerve|drivetrain|gear-ratio|wheels|chain-vs-belt|intake|elevator|shooter|manufacturing|pneumatics|robot-design-process"),
        Rule(label: "Programming", slug: "programming",
             blurb: "WPILib, command-based structure, autonomous, and tuning.",
             pattern: "program|wpilib|code|software|pid|simulation|pathplanner|choreo|odometry|dashboards|advantagescope|java-vs"),
        Rule(label: "Electrical & Power", slug: "electrical-power",
             blurb: "Wiring, the control system, motors, and the vendor ecosystems.",
             pattern: "wire|electrical|can-bus|pdh|roborio|motors|control-system|power|ctre|rev-robotics|phoenix|spark|talon"),
        Rule(label: "Vision & Sensors", slug: "vision-sensors",
             blurb: "AprilTags, Limelight, PhotonVision, encoders and gyros.",
             pattern: "apriltag|limelight|photonvision|vision|sensors"),
        Rule(label: "CAD & Design", slug: "cad-design",
             blurb: "Choosing a CAD package, and modelling your first parts.",
             pattern: "cad|onshape|solidworks"),
        Rule(label: "Scouting & Strategy", slug: "scouting-strategy",
             blurb: "Match data, picklists, alliance selection, and drive team.",
             pattern: "scout|picklist|opr|epa|statbotics|blue-alliance|alliance-selection|defense|ranking-points|districts|world-championship|drive-team"),
        Rule(label: "Awards, Money & Outreach", slug: "awards-money-outreach",
             blurb: "Impact Award, sponsorship, grants, budgets and scholarships.",
             pattern: "impact|award|sponsor|grant|scholarship|budget|fund"),
        Rule(label: "Season & Events", slug: "season-events",
             blurb: "Calendars, kickoff, the offseason, and what is coming in 2027.",
             pattern: "2027|calendar|offseason|biocore|systemcore|kit-of-parts|build-season"),
    ]

    private static let fallback = Rule(label: "Field Notes", slug: "field-notes",
                                       blurb: "Everything else worth writing down.", pattern: "")

    /// The six handed to a stranger first, in reading order.
    static let featuredSlugs = [
        "what-is-frc", "how-to-start-an-frc-team", "frc-vs-ftc-vs-vex",
        "how-frc-competitions-work", "swerve-drive-explained", "how-to-win-the-impact-award",
    ]

    private static func matches(_ pattern: String, _ text: String) -> Bool {
        text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    private static func rule(for article: Article) -> Rule {
        let haystack = "\(article.slug) \(article.keywords.joined(separator: " "))"
        return rules.first { matches($0.pattern, article.slug) }
            ?? rules.first { matches($0.pattern, haystack) }
            ?? fallback
    }

    /// Every article on its desk, desks in reading order, empty desks dropped.
    static func group(_ articles: [Article]) -> [Desk] {
        var filed: [String: [Article]] = [:]
        for article in articles {
            filed[rule(for: article).slug, default: []].append(article)
        }
        return (rules + [fallback]).compactMap { rule in
            guard let items = filed[rule.slug], !items.isEmpty else { return nil }
            return Desk(label: rule.label, slug: rule.slug, blurb: rule.blurb, articles: items)
        }
    }

    static func featured(in articles: [Article]) -> [Article] {
        let bySlug = Dictionary(articles.map { ($0.slug, $0) }, uniquingKeysWith: { first, _ in first })
        return featuredSlugs.compactMap { bySlug[$0] }
    }

    /// Every word of the query must appear in the title, description or keywords.
    /// Title hits rank first.
    static func search(_ query: String, in articles: [Article]) -> [Article] {
        let words = query.lowercased().split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !words.isEmpty else { return [] }
        var scored: [ScoredArticle] = []
        for (offset, article) in articles.enumerated() {
            if let score = searchScore(article, words: words) {
                scored.append(ScoredArticle(article: article, score: score, offset: offset))
            }
        }
        scored.sort(by: ScoredArticle.ranksAbove)
        return scored.map(\.article)
    }

    /// 2 for each word in the title, 1 for each found only in the description or
    /// keywords; nil when any word is missing.
    private static func searchScore(_ article: Article, words: [String]) -> Int? {
        let title = article.title.lowercased()
        let rest = (article.description + " " + article.keywords.joined(separator: " ")).lowercased()
        var score = 0
        for word in words {
            if title.contains(word) {
                score += 2
            } else if rest.contains(word) {
                score += 1
            } else {
                return nil
            }
        }
        return score
    }

    /// The site's `getRelated`: articles sharing the most title and keyword words.
    static func related(to article: Article, in articles: [Article], limit: Int = 3) -> [Article] {
        let mine = relatedTokens(of: article)
        var scored: [ScoredArticle] = []
        for (offset, other) in articles.enumerated() where other.slug != article.slug {
            let score = relatedTokens(of: other).intersection(mine).count
            scored.append(ScoredArticle(article: other, score: score, offset: offset))
        }
        scored.sort(by: ScoredArticle.ranksAbove)
        return scored.prefix(limit).map(\.article)
    }

    private static func relatedTokens(of article: Article) -> Set<String> {
        let text = (article.keywords + [article.title]).joined(separator: " ").lowercased()
        let words = text.split(whereSeparator: { !($0.isASCII && ($0.isLetter || $0.isNumber)) })
        var out = Set<String>()
        for word in words where word.count > 2 { out.insert(String(word)) }
        return out
    }

    /// Higher score first; ties keep the library's order (newest first), like a stable sort.
    private struct ScoredArticle {
        let article: Article
        let score: Int
        let offset: Int

        static func ranksAbove(_ a: ScoredArticle, _ b: ScoredArticle) -> Bool {
            if a.score != b.score { return a.score > b.score }
            return a.offset < b.offset
        }
    }
}

// MARK: - Previews

#Preview("Articles, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { ArticlesView() }
        .appEnvironment(.preview)
}

#Preview("Articles, iPhone, dark", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { ArticlesView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#Preview("Articles, iPad", traits: .fixedLayout(width: 1180, height: 1200)) {
    NavigationStack { ArticlesView() }
        .appEnvironment(.preview)
}

#Preview("Articles, iPad, dark", traits: .fixedLayout(width: 834, height: 1200)) {
    NavigationStack { ArticlesView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#if DEBUG
#Preview("Articles, Duo book, whole page", traits: .fixedLayout(width: 867, height: 3000)) {
    NavigationStack { ArticlesView() }
        .appEnvironment(.preview)
        .previewFold(.previewFlat)
}
#endif

// MARK: - The library's route

extension AppRoute {
    /// The article library (learnfrc.com/blog, `ArticlesView`): the article route with an
    /// empty slug, which `ArticleView` shows as the library, like `glossaryIndex` for the
    /// glossary. Pushed as a route, so the library is in its tab's path: Back, the saved
    /// window and the Mac's rebuilt tab all bring it back. No new case, so routes already
    /// saved on devices still decode.
    static var articlesIndex: AppRoute { .article("") }
}
