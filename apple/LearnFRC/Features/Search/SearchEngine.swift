import Foundation
#if canImport(Darwin)
import Darwin
#endif

// The on-device search: an index over departments, modules, lessons (title, summary,
// the whole body and key takeaways), articles and the glossary, built once off the
// main thread from the cached catalog, then queried on every keystroke.
//
// Matching works on a folded copy of each field's UTF-8 bytes (ASCII lowercased,
// punctuation turned into spaces) that's exactly as long as the original, so a match
// offset is also an offset into the text shown on screen. Every word typed has to be
// found somewhere in a result. Short words (three letters or fewer) only match at the
// start of a word, so "can" never finds "scan" and "pid" never finds "rapid".
//
// Ranking, best first: the whole query is the title or an alias ("PID", "Swerve"),
// the title starts with it, the title contains it, then summaries, then body text.
//
// Typos: a word of five letters or more that's found nowhere at all ("pathplaner") is
// matched against the words of titles, aliases and summaries with one edit allowed (two
// from eight letters), so it still finds PathPlanner. Those matches only stand in for a word
// nothing matched exactly, so they never outrank or crowd out exact and prefix hits.

// MARK: - Public types

/// What the results are narrowed to. The labels are lowercase, like the site's tabs.
nonisolated enum SearchScope: String, CaseIterable, Hashable, Sendable, Identifiable {
    case all, guides, articles, glossary

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "all"
        case .guides: "guides"
        case .articles: "articles"
        case .glossary: "glossary"
        }
    }
}

/// The kinds of thing the index holds.
nonisolated enum SearchKind: String, Hashable, Sendable {
    case department, module, lesson, article, glossary

    var scope: SearchScope {
        switch self {
        case .department, .module, .lesson: .guides
        case .article: .articles
        case .glossary: .glossary
        }
    }

    /// Spoken by VoiceOver before the title.
    var spokenName: String {
        switch self {
        case .department: "Department"
        case .module: "Module"
        case .lesson: "Lesson"
        case .article: "Article"
        case .glossary: "Glossary term"
        }
    }

    /// The verb on the top-hit card.
    var openLabel: String {
        switch self {
        case .department: "open the department"
        case .module: "open the module"
        case .lesson: "open the lesson"
        case .article: "read the article"
        case .glossary: "read the entry"
        }
    }

    /// A small nudge so a department or lesson named like the query beats an article
    /// named the same way. Departments come first, as in the site's search palette.
    fileprivate var prior: Double {
        switch self {
        case .department: 12
        case .module: 6
        case .lesson: 4
        case .glossary: 4
        case .article: 0
        }
    }
}

/// What a result shows and where it goes. Everything the row needs, nothing it doesn't.
nonisolated struct SearchDocument: Sendable, Hashable, Identifiable {
    let id: String
    let kind: SearchKind
    let route: AppRoute
    let title: String
    /// The mono eyebrow: `lesson / programming-software`.
    let slug: String
    /// `Department / Module`, `6 min read`, `24 lessons`.
    let crumb: String?
    /// The summary, description, tagline or definition, shown when the match isn't in the body.
    let detail: String
    /// A glossary term's short form.
    let badge: String?
    let lessonID: UUID?
    let minutes: Int?
    let hasVideo: Bool
    let systemImage: String?
}

/// A piece of text with the parts that matched the query, as UTF-8 byte ranges.
nonisolated struct SearchHighlight: Sendable, Hashable {
    let text: String
    let ranges: [Range<Int>]

    init(text: String, ranges: [Range<Int>]) {
        self.text = text
        self.ranges = ranges
    }

    /// Highlights every word of `query` in `text`.
    init(_ text: String, query: SearchQuery) {
        self.text = text
        self.ranges = SearchMatcher.highlightRanges(in: text, tokens: query.tokens)
    }
}

nonisolated struct SearchHit: Sendable, Hashable, Identifiable {
    let document: SearchDocument
    let score: Double
    let title: SearchHighlight
    /// The best line to show under the title: the summary or definition when the match is
    /// there or in the title, otherwise an excerpt of the body around the match.
    let snippet: SearchHighlight?
    /// True when `snippet` is an excerpt of the body rather than the summary.
    let snippetIsExcerpt: Bool
    /// The alias that matched ("also called" names, an abbreviation, an article keyword).
    let matchedAlias: SearchHighlight?

    var id: String { document.id }
}

/// One query's results, grouped the way the screen shows them.
nonisolated struct SearchResults: Sendable {
    let query: String
    /// The single best result, when it's a strong title match.
    let topHit: SearchHit?
    let glossary: [SearchHit]
    let guides: [SearchHit]
    let articles: [SearchHit]
    /// How many matched in each scope (`.all` is the total), before any list was capped.
    let counts: [SearchScope: Int]

    static let empty = SearchResults(query: "", topHit: nil, glossary: [], guides: [], articles: [], counts: [:])

    var total: Int { counts[.all] ?? 0 }
    var isEmpty: Bool { total == 0 }

    func hits(in scope: SearchScope) -> [SearchHit] {
        switch scope {
        case .all: (topHit.map { [$0] } ?? []) + glossary + guides + articles
        case .guides: guides
        case .articles: articles
        case .glossary: glossary
        }
    }

    func count(_ scope: SearchScope) -> Int { counts[scope] ?? 0 }
}

/// A query, folded and split into words.
nonisolated struct SearchQuery: Sendable, Hashable {
    let raw: String
    /// Folded words in the order typed, duplicates removed.
    let tokens: [[UInt8]]

    init(_ raw: String) {
        self.raw = raw
        var seen = Set<[UInt8]>()
        tokens = SearchFold.words(SearchFold.fold(Array(raw.utf8))).filter { seen.insert($0).inserted }
    }

    /// The same query with extra words to highlight (typo corrections).
    fileprivate init(raw: String, tokens: [[UInt8]]) {
        self.raw = raw
        self.tokens = tokens
    }

    var isEmpty: Bool { tokens.isEmpty }
    /// Letters and digits typed, ignoring spaces and punctuation.
    var length: Int { tokens.reduce(0) { $0 + $1.count } }
}

// MARK: - The corpus

/// Everything the index is built from, copied off the stores on the main actor.
nonisolated struct SearchCorpus: Sendable {
    var departments: [Department]
    var articles: [Article]
    var glossary: [GlossaryTerm]
    /// Lesson id to its Markdown body plus key takeaways. Missing until the bodies download.
    var lessonText: [UUID: String]

    /// Changes whenever anything worth re-indexing changes.
    struct Signature: Hashable, Sendable {
        var departments: Int
        var lessons: Int
        var articles: Int
        var glossary: Int
        var bodiesLoaded: Bool
        var catalogUpdated: Date?
        var referenceVersion: String
        var firstArticle: String?

        var isEmpty: Bool { departments == 0 && articles == 0 && glossary == 0 }
    }
}

// MARK: - The index

/// Immutable once built, so it's shared freely between tasks.
nonisolated final class SearchIndex: Sendable {
    let documents: [SearchDocument]
    private let fields: [IndexedFields]

    let lessonCount: Int
    let articleCount: Int
    let glossaryCount: Int
    /// False while only titles and summaries are searchable (lesson bodies still downloading).
    let includesLessonBodies: Bool
    /// A handful of queries known to find something, for the empty search screen.
    let suggestions: [String]
    /// Every distinct word of the titles, aliases and summaries, for typo matching.
    private let vocabulary: [[UInt8]]

    private struct IndexedFields: Sendable {
        let title: Field
        let titleWords: [[UInt8]]
        let aliases: [Field]
        let aliasWords: [[[UInt8]]]
        let summary: Field?
        let body: Field?
    }

    fileprivate struct Field: Sendable {
        let text: [UInt8]
        let folded: [UInt8]

        init?(_ string: String?) {
            guard let string, !string.isEmpty else { return nil }
            text = Array(string.utf8)
            folded = SearchFold.fold(text)
        }

        init(bytes: [UInt8]) {
            text = bytes
            folded = SearchFold.fold(bytes)
        }

        var string: String { String(decoding: text, as: UTF8.self) }
    }

    init(corpus: SearchCorpus) {
        var documents: [SearchDocument] = []
        var fields: [IndexedFields] = []

        func add(_ document: SearchDocument, aliases: [String] = [], summary: String?, body: String?, bodyIsMarkdown: Bool = false) {
            let title = Field(document.title) ?? Field(bytes: [])
            let aliasFields = aliases.compactMap { Field($0) }
            let bodyField: Field? = body.flatMap { raw in
                let plain: [UInt8] = bodyIsMarkdown ? SearchPlainText.fromMarkdown(raw) : Array(raw.utf8)
                return plain.isEmpty ? nil : Field(bytes: plain)
            }
            documents.append(document)
            fields.append(IndexedFields(
                title: title,
                titleWords: SearchFold.words(title.folded),
                aliases: aliasFields,
                aliasWords: aliasFields.map { SearchFold.words($0.folded) },
                summary: Field(summary),
                body: bodyField
            ))
        }

        var lessonCount = 0
        for department in corpus.departments {
            add(
                SearchDocument(
                    id: "department:\(department.id.uuidString)", kind: .department, route: .department(department.id),
                    title: department.name, slug: "dept / \(department.slug)",
                    crumb: Self.lessonCountLabel(department.lessonCount),
                    detail: department.tagline ?? department.description ?? "",
                    badge: nil, lessonID: nil, minutes: nil, hasVideo: false, systemImage: department.systemImage
                ),
                summary: [department.tagline, department.description].compactMap { $0 }.joined(separator: "\n"),
                body: (department.whatYoullLearn + department.tools).joined(separator: ". ")
            )
            for module in department.modules {
                add(
                    SearchDocument(
                        id: "module:\(module.id.uuidString)", kind: .module, route: .module(module.id),
                        title: module.title, slug: "module / \(department.slug)",
                        crumb: "\(department.name) / \(Self.lessonCountLabel(module.lessons.count))",
                        detail: module.overview ?? "",
                        badge: nil, lessonID: nil, minutes: module.totalMinutes, hasVideo: false, systemImage: nil
                    ),
                    summary: module.overview,
                    body: nil
                )
                for lesson in module.lessons {
                    lessonCount += 1
                    add(
                        SearchDocument(
                            id: "lesson:\(lesson.id.uuidString)", kind: .lesson, route: .lesson(lesson.id),
                            title: lesson.title, slug: "lesson / \(department.slug)",
                            crumb: "\(department.name) / \(module.title)",
                            detail: lesson.summary ?? "",
                            badge: nil, lessonID: lesson.id, minutes: lesson.estimatedMinutes,
                            hasVideo: lesson.youtubeID != nil, systemImage: nil
                        ),
                        summary: lesson.summary,
                        body: corpus.lessonText[lesson.id],
                        bodyIsMarkdown: true
                    )
                }
            }
        }

        for article in corpus.articles {
            add(
                SearchDocument(
                    id: "article:\(article.slug)", kind: .article, route: .article(article.slug),
                    title: article.title, slug: "article / \(article.readMins) min read",
                    crumb: nil, detail: article.description,
                    badge: nil, lessonID: nil, minutes: article.readMins, hasVideo: false, systemImage: nil
                ),
                aliases: article.keywords,
                summary: article.description,
                body: article.content,
                bodyIsMarkdown: true
            )
        }

        for term in corpus.glossary {
            let badge = term.abbr.flatMap { $0.isEmpty || $0 == term.term ? nil : $0 }
            add(
                SearchDocument(
                    id: "glossary:\(term.slug)", kind: .glossary, route: .glossaryTerm(term.slug),
                    title: term.term, slug: "glossary / \(term.category.lowercased())",
                    crumb: nil, detail: term.definition,
                    badge: badge, lessonID: nil, minutes: nil, hasVideo: false, systemImage: nil
                ),
                aliases: [badge].compactMap { $0 } + term.alsoCalled,
                summary: term.definition,
                body: term.inMatch
            )
        }

        var words = Set<[UInt8]>()
        for field in fields {
            for word in field.titleWords where word.count >= SearchTypos.minimumWord { words.insert(word) }
            for alias in field.aliasWords {
                for word in alias where word.count >= SearchTypos.minimumWord { words.insert(word) }
            }
            if let summary = field.summary {
                for word in SearchFold.words(summary.folded) where word.count >= SearchTypos.minimumWord { words.insert(word) }
            }
        }
        self.vocabulary = Array(words)

        self.documents = documents
        self.fields = fields
        self.lessonCount = lessonCount
        self.articleCount = corpus.articles.count
        self.glossaryCount = corpus.glossary.count
        self.includesLessonBodies = lessonCount == 0 || !corpus.lessonText.isEmpty

        // Suggestions: real things a new member looks up, kept only if the index has a
        // title or alias for them, so a suggestion never leads to an empty screen.
        let candidates = ["swerve", "PID", "CAN bus", "brownout", "PathPlanner", "sponsors", "scouting", "kickoff", "Impact Award", "encoder", "gear ratio", "roboRIO"]
        var found: [String] = []
        for candidate in candidates where found.count < 6 {
            let query = SearchQuery(candidate)
            let hasTitleMatch = fields.contains { field in
                SearchMatcher.phrase(query.tokens, in: field.title.folded) != nil
                    || field.aliases.contains { SearchMatcher.phrase(query.tokens, in: $0.folded) != nil }
            }
            if hasTitleMatch { found.append(candidate) }
        }
        self.suggestions = found
    }

    private static func lessonCountLabel(_ count: Int) -> String {
        count == 1 ? "1 lesson" : "\(count) lessons"
    }

    // MARK: Searching

    /// Runs a query. Checks for cancellation as it goes and returns `.empty` if cancelled.
    func search(_ raw: String, limitPerScope: Int = 120) -> SearchResults {
        let query = SearchQuery(raw)
        guard !query.isEmpty else { return .empty }

        // Typo corrections, only for words that appear nowhere as typed.
        var corrections: [[[UInt8]]] = Array(repeating: [], count: query.tokens.count)
        for (position, token) in query.tokens.enumerated() where SearchTypos.allowedEdits(for: token) > 0 {
            if Task.isCancelled { return .empty }
            if !isFoundAnywhere(token) {
                corrections[position] = SearchTypos.corrections(for: token, in: vocabulary)
            }
        }
        let highlightQuery = SearchQuery(raw: raw, tokens: query.tokens + corrections.flatMap { $0 })

        var scored: [(index: Int, score: Double, plan: SnippetPlan)] = []
        for index in documents.indices {
            if index % 64 == 0, Task.isCancelled { return .empty }
            if let result = score(index, query, corrections: corrections) {
                scored.append((index, result.score, result.plan))
            }
        }
        scored.sort { a, b in
            if a.score != b.score { return a.score > b.score }
            return documents[a.index].title.localizedCaseInsensitiveCompare(documents[b.index].title) == .orderedAscending
        }

        var counts: [SearchScope: Int] = [.all: scored.count]
        var glossary: [SearchHit] = []
        var guides: [SearchHit] = []
        var articles: [SearchHit] = []
        for entry in scored {
            let scope = documents[entry.index].kind.scope
            counts[scope, default: 0] += 1
            switch scope {
            case .glossary where glossary.count < limitPerScope:
                glossary.append(hit(entry.index, entry.score, entry.plan, highlightQuery))
            case .guides where guides.count < limitPerScope:
                guides.append(hit(entry.index, entry.score, entry.plan, highlightQuery))
            case .articles where articles.count < limitPerScope:
                articles.append(hit(entry.index, entry.score, entry.plan, highlightQuery))
            default:
                break
            }
        }

        var topHit: SearchHit?
        if let best = scored.first, best.score >= Self.topHitThreshold {
            let id = documents[best.index].id
            topHit = (glossary + guides + articles).first { $0.id == id }
        }

        return SearchResults(query: raw, topHit: topHit, glossary: glossary, guides: guides, articles: articles, counts: counts)
    }

    /// A result has to clear this to be shown as the top hit: the title or an alias
    /// starts with, or is, the query.
    static let topHitThreshold: Double = 100

    /// Where the snippet comes from.
    private enum SnippetPlan {
        case summary
        case body(anchor: Int)
    }

    private struct Scored {
        let score: Double
        let plan: SnippetPlan
    }

    private enum Weights {
        static let title: [SearchMatcher.Quality: Double] = [.word: 30, .prefix: 22, .inner: 8]
        static let alias: [SearchMatcher.Quality: Double] = [.word: 26, .prefix: 18, .inner: 6]
        static let summary: [SearchMatcher.Quality: Double] = [.word: 9, .prefix: 7, .inner: 2.5]
        static let body: [SearchMatcher.Quality: Double] = [.word: 4, .prefix: 3, .inner: 1]
        /// A typo correction, as a whole word. Under the exact weights for each field.
        static let typoTitle = 18.0
        static let typoAlias = 16.0
        static let typoSummary = 6.0
        static let typoBody = 2.5
    }

    /// True when `token` appears in any field the way `score` would accept it. Words this
    /// long match inside words too, so any occurrence counts.
    private func isFoundAnywhere(_ token: [UInt8]) -> Bool {
        for field in fields {
            if SearchMatcher.find(token, in: field.title.folded) != nil { return true }
            if field.aliases.contains(where: { SearchMatcher.find(token, in: $0.folded) != nil }) { return true }
            if let summary = field.summary, SearchMatcher.find(token, in: summary.folded) != nil { return true }
            if let body = field.body, SearchMatcher.find(token, in: body.folded) != nil { return true }
        }
        return false
    }

    /// The best typo correction of one query word in a document, as a whole word.
    private func typoMatch(_ corrections: [[UInt8]], in field: IndexedFields, deep: Bool) -> (weight: Double, inTitle: Bool, bodyOffset: Int?) {
        var best = 0.0
        var inTitle = false
        for word in corrections {
            if field.titleWords.contains(word) {
                best = max(best, Weights.typoTitle)
                inTitle = true
            }
            if field.aliasWords.contains(where: { $0.contains(word) }) { best = max(best, Weights.typoAlias) }
            if deep, let summary = field.summary,
               SearchMatcher.best(word, in: summary.folded, allowInner: false).quality == .word {
                best = max(best, Weights.typoSummary)
            }
        }
        if best > 0 || !deep { return (best, inTitle, nil) }
        guard let body = field.body else { return (0, false, nil) }
        for word in corrections {
            let match = SearchMatcher.best(word, in: body.folded, allowInner: false)
            if match.quality == .word { return (Weights.typoBody, false, match.offset) }
        }
        return (0, false, nil)
    }

    private func score(_ index: Int, _ query: SearchQuery, corrections: [[[UInt8]]]) -> Scored? {
        let field = fields[index]
        let document = documents[index]
        // One letter only finds titles and aliases; two or more also reads summaries
        // and bodies.
        let deep = query.length >= 2
        var total = 0.0
        var titleMatched = false
        var needsBody = false
        var bodyAnchor: Int?

        for (position, token) in query.tokens.enumerated() {
            let typos = position < corrections.count ? corrections[position] : []
            if !typos.isEmpty {
                // Nothing has this word as typed: only its corrections can match.
                let match = typoMatch(typos, in: field, deep: deep)
                guard match.weight > 0 else { return nil }
                if match.inTitle { titleMatched = true }
                if let offset = match.bodyOffset {
                    needsBody = true
                    if bodyAnchor == nil { bodyAnchor = offset }
                }
                total += match.weight
                continue
            }
            let allowInner = token.count >= 4
            var best = 0.0
            var bestInShortFields = 0.0

            let inTitle = SearchMatcher.best(token, in: field.title.folded, allowInner: allowInner)
            if let weight = Weights.title[inTitle.quality] {
                best = max(best, weight)
                titleMatched = true
            }
            for alias in field.aliases {
                let match = SearchMatcher.best(token, in: alias.folded, allowInner: allowInner)
                if let weight = Weights.alias[match.quality] { best = max(best, weight) }
            }
            // In running text a one- or two-letter word has to be the whole word ("gp", not "GPIO").
            let wholeWordOnly = token.count <= 2
            if deep, let summary = field.summary {
                let match = SearchMatcher.best(token, in: summary.folded, allowInner: allowInner)
                if !wholeWordOnly || match.quality == .word, let weight = Weights.summary[match.quality] {
                    best = max(best, weight)
                }
            }
            bestInShortFields = best
            if deep, let body = field.body {
                let match = SearchMatcher.best(token, in: body.folded, allowInner: allowInner, countLimit: 6)
                if !wholeWordOnly || match.quality == .word, var weight = Weights.body[match.quality] {
                    weight += 0.4 * Double(max(0, min(match.count, 6) - 1))
                    if bestInShortFields == 0 {
                        needsBody = true
                        // The excerpt centres on the first word only the body has.
                        if bodyAnchor == nil { bodyAnchor = match.offset }
                    }
                    // A body hit only adds to a field that already matched, a little.
                    best = bestInShortFields > 0 ? best + weight * 0.25 : max(best, weight)
                }
            }
            guard best > 0 else { return nil }
            total += best
        }

        // Whole-query bonuses.
        let words = query.tokens
        if SearchMatcher.wordsEqual(field.titleWords, words) {
            total += 200
        } else if SearchMatcher.wordsStart(field.titleWords, with: words) {
            total += 90
        } else if words.count > 1, SearchMatcher.phrase(words, in: field.title.folded) != nil {
            total += 60
        }
        if field.aliasWords.contains(where: { SearchMatcher.wordsEqual($0, words) }) {
            total += 170
        } else if field.aliasWords.contains(where: { SearchMatcher.wordsStart($0, with: words) }) {
            total += 50
        }
        if words.count > 1, deep {
            if let summary = field.summary, SearchMatcher.phrase(words, in: summary.folded) != nil {
                total += 14
            }
            if let body = field.body, let offset = SearchMatcher.phrase(words, in: body.folded) {
                total += 6
                if needsBody { bodyAnchor = offset }
            }
        }
        if titleMatched {
            // Shorter titles that match are closer to what was asked for.
            let titleLength = max(field.title.folded.count, query.length)
            total += 12 * Double(query.length) / Double(titleLength)
        }
        total += document.kind.prior

        let plan: SnippetPlan = needsBody ? .body(anchor: bodyAnchor ?? 0) : .summary
        return Scored(score: total, plan: plan)
    }

    /// Where the first query word appears in a field.
    private static func firstMatch(_ query: SearchQuery, in folded: [UInt8]) -> Int? {
        for token in query.tokens {
            let match = SearchMatcher.best(token, in: folded, allowInner: token.count >= 4)
            if match.quality != .none { return match.offset }
        }
        return nil
    }

    private func hit(_ index: Int, _ score: Double, _ plan: SnippetPlan, _ query: SearchQuery) -> SearchHit {
        let document = documents[index]
        let field = fields[index]
        let title = SearchHighlight(document.title, query: query)

        var matchedAlias: SearchHighlight?
        if title.ranges.isEmpty {
            for alias in field.aliases {
                let highlight = SearchHighlight(alias.string, query: query)
                if !highlight.ranges.isEmpty {
                    matchedAlias = highlight
                    break
                }
            }
        }

        let snippet: SearchHighlight?
        var isExcerpt = false
        switch plan {
        case .summary:
            var line = document.detail.isEmpty ? nil : SearchHighlight(document.detail, query: query)
            // The match is in a longer summary than the one shown: show that part of it.
            if title.ranges.isEmpty, matchedAlias == nil, line?.ranges.isEmpty ?? true,
               let summary = field.summary, let anchor = Self.firstMatch(query, in: summary.folded) {
                line = SearchHighlight(SearchPlainText.excerpt(summary.text, around: anchor), query: query)
            }
            snippet = line
        case .body(let anchor):
            if let body = field.body {
                snippet = SearchHighlight(SearchPlainText.excerpt(body.text, around: anchor), query: query)
                isExcerpt = true
            } else {
                snippet = document.detail.isEmpty ? nil : SearchHighlight(document.detail, query: query)
            }
        }

        return SearchHit(document: document, score: score, title: title, snippet: snippet, snippetIsExcerpt: isExcerpt, matchedAlias: matchedAlias)
    }
}

// MARK: - Typos

/// Small edits allowed on a word nothing matched: one from five letters, two from eight.
/// Corrections come from the words of titles, aliases and summaries, closest first.
nonisolated enum SearchTypos {
    /// Corrections shorter than this aren't worth suggesting.
    static let minimumWord = 4
    /// At most this many corrections per word.
    static let limit = 6

    static func allowedEdits(for token: [UInt8]) -> Int {
        switch token.count {
        case ..<5: 0
        case 5..<8: 1
        default: 2
        }
    }

    /// Words of `vocabulary` within the allowed edits of `token`, closest first.
    static func corrections(for token: [UInt8], in vocabulary: [[UInt8]]) -> [[UInt8]] {
        let allowed = allowedEdits(for: token)
        guard allowed > 0 else { return [] }
        var found: [(word: [UInt8], distance: Int)] = []
        var scratch = EditScratch(capacity: token.count + allowed + 1)
        for word in vocabulary where abs(word.count - token.count) <= allowed {
            guard let distance = editDistance(token, word, limit: allowed, scratch: &scratch) else { continue }
            found.append((word, distance))
        }
        found.sort { a, b in
            if a.distance != b.distance { return a.distance < b.distance }
            if a.word.count != b.word.count { return abs(a.word.count - token.count) < abs(b.word.count - token.count) }
            return a.word.lexicographicallyPrecedes(b.word)
        }
        return found.prefix(limit).map(\.word)
    }

    /// Reused rows for `editDistance`, so a search allocates once per word typed.
    struct EditScratch {
        var previous2: [Int]
        var previous: [Int]
        var current: [Int]

        init(capacity: Int) {
            previous2 = Array(repeating: 0, count: capacity + 1)
            previous = Array(repeating: 0, count: capacity + 1)
            current = Array(repeating: 0, count: capacity + 1)
        }

        mutating func reserve(_ count: Int) {
            guard previous.count < count + 1 else { return }
            self = EditScratch(capacity: count)
        }
    }

    /// Optimal string alignment distance (insertions, deletions, substitutions and swapping
    /// two neighbouring letters each cost one), or nil once it's certain to exceed `limit`.
    static func editDistance(_ a: [UInt8], _ b: [UInt8], limit: Int, scratch: inout EditScratch) -> Int? {
        let n = a.count
        let m = b.count
        if abs(n - m) > limit { return nil }
        if n == 0 { return m <= limit ? m : nil }
        if m == 0 { return n <= limit ? n : nil }
        scratch.reserve(m)
        for j in 0...m {
            scratch.previous[j] = j
            scratch.previous2[j] = 0
        }
        for i in 1...n {
            scratch.current[0] = i
            var rowBest = i
            for j in 1...m {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                var value = min(scratch.previous[j] + 1, scratch.current[j - 1] + 1, scratch.previous[j - 1] + cost)
                if i > 1, j > 1, a[i - 1] == b[j - 2], a[i - 2] == b[j - 1] {
                    value = min(value, scratch.previous2[j - 2] + 1)
                }
                scratch.current[j] = value
                rowBest = min(rowBest, value)
            }
            if rowBest > limit { return nil }
            swap(&scratch.previous2, &scratch.previous)
            swap(&scratch.previous, &scratch.current)
        }
        let distance = scratch.previous[m]
        return distance <= limit ? distance : nil
    }
}

// MARK: - Folding

/// Turns UTF-8 into a lowercase, punctuation-free copy of exactly the same length.
nonisolated enum SearchFold {
    static let space: UInt8 = 0x20

    /// ASCII letters lowercased; ASCII digits kept; other ASCII (punctuation, whitespace)
    /// becomes a space; the General Punctuation block (curly quotes, dashes, the ellipsis)
    /// and no-break spaces become spaces too. Other characters (accented letters) are kept.
    static func fold(_ bytes: [UInt8]) -> [UInt8] {
        var out = [UInt8](repeating: space, count: bytes.count)
        var i = 0
        let n = bytes.count
        while i < n {
            let b = bytes[i]
            if b < 0x80 {
                if b >= 0x41 && b <= 0x5A {
                    out[i] = b + 0x20
                } else if (b >= 0x61 && b <= 0x7A) || (b >= 0x30 && b <= 0x39) {
                    out[i] = b
                }
                i += 1
            } else if b == 0xE2, i + 2 < n, bytes[i + 1] == 0x80 || bytes[i + 1] == 0x81 {
                i += 3
            } else if b == 0xC2, i + 1 < n, bytes[i + 1] == 0xA0 {
                i += 2
            } else {
                out[i] = b
                i += 1
            }
        }
        return out
    }

    /// The words of a folded buffer.
    static func words(_ folded: [UInt8]) -> [[UInt8]] {
        folded.split(separator: space, omittingEmptySubsequences: true).map(Array.init)
    }
}

// MARK: - Matching

nonisolated enum SearchMatcher {
    /// How well a word matched, worst to best.
    enum Quality: Int, Comparable, Hashable, Sendable {
        case none, inner, prefix, word
        static func < (a: Quality, b: Quality) -> Bool { a.rawValue < b.rawValue }
    }

    /// Byte offset of `needle` in `haystack` at or after `start`.
    static func find(_ needle: [UInt8], in haystack: [UInt8], from start: Int = 0) -> Int? {
        let remaining = haystack.count - start
        guard !needle.isEmpty, start >= 0, remaining >= needle.count else { return nil }
        return haystack.withUnsafeBytes { hay -> Int? in
            needle.withUnsafeBytes { pin -> Int? in
                guard let base = hay.baseAddress, let pinBase = pin.baseAddress else { return nil }
                guard let found = memmem(base + start, remaining, pinBase, needle.count) else { return nil }
                return base.distance(to: UnsafeRawPointer(found))
            }
        }
    }

    static func isWordStart(_ offset: Int, in folded: [UInt8]) -> Bool {
        offset == 0 || folded[offset - 1] == SearchFold.space
    }

    static func isWordEnd(_ offset: Int, in folded: [UInt8]) -> Bool {
        offset >= folded.count || folded[offset] == SearchFold.space
    }

    /// The best occurrence of `token`, its offset, and how many usable occurrences there are
    /// (counting stops at `countLimit`).
    static func best(_ token: [UInt8], in folded: [UInt8], allowInner: Bool, countLimit: Int = 1) -> (quality: Quality, offset: Int, count: Int) {
        var best = Quality.none
        var offset = 0
        var count = 0
        var from = 0
        while let p = find(token, in: folded, from: from) {
            from = p + 1
            let quality: Quality
            if isWordStart(p, in: folded) {
                quality = isWordEnd(p + token.count, in: folded) ? .word : .prefix
            } else if allowInner {
                quality = .inner
            } else {
                continue
            }
            count += 1
            if quality > best {
                best = quality
                offset = p
            }
            if best == .word, count >= countLimit { break }
        }
        return (best, offset, count)
    }

    /// Offset of the words in order, separated only by spaces or punctuation. Every word but
    /// the last has to be whole; the last can be the start of a word (still being typed).
    static func phrase(_ tokens: [[UInt8]], in folded: [UInt8]) -> Int? {
        guard let first = tokens.first else { return nil }
        var from = 0
        while let p = find(first, in: folded, from: from) {
            from = p + 1
            guard isWordStart(p, in: folded) else { continue }
            var cursor = p + first.count
            var matched = true
            for token in tokens.dropFirst() {
                guard cursor < folded.count, folded[cursor] == SearchFold.space else { matched = false; break }
                var gap = 0
                while cursor < folded.count, folded[cursor] == SearchFold.space, gap < 4 {
                    cursor += 1
                    gap += 1
                }
                guard cursor + token.count <= folded.count,
                      folded[cursor..<(cursor + token.count)].elementsEqual(token) else { matched = false; break }
                cursor += token.count
            }
            if matched { return p }
        }
        return nil
    }

    static func wordsEqual(_ words: [[UInt8]], _ query: [[UInt8]]) -> Bool {
        !query.isEmpty && words == query
    }

    /// The field's words start with the query's (the last query word may be partial).
    static func wordsStart(_ words: [[UInt8]], with query: [[UInt8]]) -> Bool {
        guard let last = query.last, words.count >= query.count else { return false }
        for (index, token) in query.dropLast().enumerated() where words[index] != token { return false }
        return words[query.count - 1].starts(with: last)
    }

    /// Every place a query word appears in `text`, merged, as UTF-8 byte ranges. Short words
    /// only count at the start of a word, the same rule as matching.
    static func highlightRanges(in text: String, tokens: [[UInt8]]) -> [Range<Int>] {
        guard !tokens.isEmpty, !text.isEmpty else { return [] }
        let folded = SearchFold.fold(Array(text.utf8))
        var ranges: [Range<Int>] = []
        for token in tokens {
            var from = 0
            var found = 0
            while found < 24, let p = find(token, in: folded, from: from) {
                from = p + 1
                guard token.count >= 4 || isWordStart(p, in: folded) else { continue }
                ranges.append(p..<(p + token.count))
                found += 1
            }
        }
        ranges.sort { $0.lowerBound < $1.lowerBound }
        var merged: [Range<Int>] = []
        for range in ranges {
            if let last = merged.last, range.lowerBound <= last.upperBound {
                merged[merged.count - 1] = last.lowerBound..<max(last.upperBound, range.upperBound)
            } else {
                merged.append(range)
            }
        }
        return merged
    }
}

// MARK: - Plain text

/// Markdown to the plain words a reader sees, for searching and excerpts. Keeps code (people
/// search for `SparkMax`), drops link targets, emphasis marks, table pipes and fences.
nonisolated enum SearchPlainText {
    static func fromMarkdown(_ markdown: String) -> [UInt8] {
        var out: [UInt8] = []
        out.reserveCapacity(markdown.utf8.count)
        var inFence = false
        for rawLine in markdown.utf8.split(separator: 0x0A, omittingEmptySubsequences: false) {
            var line = Array(rawLine)
            if line.last == 0x0D { line.removeLast() }
            let trimmed = trimLeadingSpaces(line)
            if trimmed.starts(with: [0x60, 0x60, 0x60]) || trimmed.starts(with: [0x7E, 0x7E, 0x7E]) {
                inFence.toggle()
                continue
            }
            if inFence {
                appendLine(trimmed, to: &out)
                continue
            }
            if isTableRule(trimmed) { continue }
            appendLine(inline(stripBlockMarkers(trimmed)), to: &out)
        }
        while out.last == SearchFold.space { out.removeLast() }
        return out
    }

    private static func appendLine(_ line: [UInt8], to out: inout [UInt8]) {
        guard !line.isEmpty else { return }
        if !out.isEmpty, out.last != SearchFold.space { out.append(SearchFold.space) }
        out.append(contentsOf: line)
    }

    private static func trimLeadingSpaces(_ line: [UInt8]) -> [UInt8] {
        guard let first = line.firstIndex(where: { $0 != 0x20 && $0 != 0x09 }) else { return [] }
        return Array(line[first...])
    }

    /// `|---|:---:|` style rows.
    private static func isTableRule(_ line: [UInt8]) -> Bool {
        guard line.contains(0x2D) else { return false }
        return line.allSatisfy { $0 == 0x7C || $0 == 0x2D || $0 == 0x3A || $0 == 0x20 }
    }

    /// Headings, quotes and list markers at the start of a line.
    private static func stripBlockMarkers(_ line: [UInt8]) -> [UInt8] {
        var start = 0
        var changed = true
        while changed, start < line.count {
            changed = false
            // `#`, `##` ... followed by a space
            var hashes = start
            while hashes < line.count, line[hashes] == 0x23 { hashes += 1 }
            if hashes > start, hashes < line.count, line[hashes] == 0x20 {
                start = hashes + 1
                changed = true
                continue
            }
            // `>` quotes
            if line[start] == 0x3E {
                start += 1
                while start < line.count, line[start] == 0x20 { start += 1 }
                changed = true
                continue
            }
            // `- `, `* `, `+ `
            if (line[start] == 0x2D || line[start] == 0x2A || line[start] == 0x2B), start + 1 < line.count, line[start + 1] == 0x20 {
                start += 2
                changed = true
                continue
            }
            // `12. ` or `12) `
            var digits = start
            while digits < line.count, line[digits] >= 0x30, line[digits] <= 0x39 { digits += 1 }
            if digits > start, digits + 1 < line.count, line[digits] == 0x2E || line[digits] == 0x29, line[digits + 1] == 0x20 {
                start = digits + 2
                changed = true
            }
        }
        return Array(line[start...])
    }

    /// Links to their text, emphasis and code marks removed, pipes to spaces.
    private static func inline(_ line: [UInt8]) -> [UInt8] {
        var out: [UInt8] = []
        out.reserveCapacity(line.count)
        var i = 0
        let n = line.count
        while i < n {
            let c = line[i]
            switch c {
            case 0x60, 0x2A: // ` *
                i += 1
            case 0x7E where i + 1 < n && line[i + 1] == 0x7E: // ~~
                i += 2
            case 0x21 where i + 1 < n && line[i + 1] == 0x5B: // ![
                i += 1
            case 0x5B: // [text](url)
                if let close = line[(i + 1)...].firstIndex(of: 0x5D), close + 1 < n, line[close + 1] == 0x28,
                   let paren = line[(close + 2)...].firstIndex(of: 0x29) {
                    out.append(contentsOf: line[(i + 1)..<close].filter { $0 != 0x2A && $0 != 0x60 })
                    i = paren + 1
                } else {
                    i += 1
                }
            case 0x3C where i + 4 < n && line[(i + 1)...(i + 4)].elementsEqual([0x68, 0x74, 0x74, 0x70]): // <http
                if let close = line[(i + 1)...].firstIndex(of: 0x3E) { i = close + 1 } else { i += 1 }
            case 0x7C: // |
                if out.last != SearchFold.space { out.append(SearchFold.space) }
                i += 1
            default:
                out.append(c)
                i += 1
            }
        }
        // Trim the spaces a leading or trailing pipe leaves.
        while out.first == SearchFold.space { out.removeFirst() }
        while out.last == SearchFold.space { out.removeLast() }
        return out
    }

    /// About two lines of text around `anchor`, cut on word boundaries, with ellipses where it
    /// was cut.
    static func excerpt(_ text: [UInt8], around anchor: Int, before: Int = 48, after: Int = 190) -> String {
        guard !text.isEmpty else { return "" }
        let anchor = min(max(0, anchor), text.count - 1)
        var start = max(0, anchor - before)
        var end = min(text.count, anchor + after)

        if start > 0 {
            // Start at the next word.
            if let space = text[start..<anchor].firstIndex(of: SearchFold.space) { start = space + 1 } else { start = anchor }
        }
        if end < text.count {
            if let space = text[anchor..<end].lastIndex(of: SearchFold.space), space > anchor { end = space }
        }
        // Never split a multi-byte character.
        while start > 0, start < text.count, text[start] & 0xC0 == 0x80 { start -= 1 }
        while end < text.count, end > start, text[end] & 0xC0 == 0x80 { end -= 1 }

        var excerpt = String(decoding: text[start..<end], as: UTF8.self)
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespaces)
        if start > 0 { excerpt = "\u{2026}" + excerpt }
        if end < text.count {
            while let last = excerpt.last, ",;:.".contains(last) { excerpt.removeLast() }
            excerpt += "\u{2026}"
        }
        return excerpt
    }
}
