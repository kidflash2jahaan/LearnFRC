import Foundation

/// The module page's derived content, ported from
/// `src/app/guides/[department]/[module]/page.tsx` so the app says what the site says:
/// the "where this module sits" sentence, the glossary terms the module uses, the
/// same-named modules in other departments, and the articles that go deeper.
nonisolated enum ModuleInsights {

    // MARK: Text helpers

    /// `squash`: collapse runs of whitespace.
    static func squash(_ text: String?) -> String {
        (text ?? "").split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    /// `sentencesOf`: split on a full stop, question or exclamation mark followed by a
    /// space and a capital, digit, quote or bracket (so "e.g." and "2.5" stay whole).
    static func sentences(_ text: String?) -> [String] {
        let squashed = squash(text)
        guard !squashed.isEmpty else { return [] }
        guard let regex = try? NSRegularExpression(pattern: #"(?<=[.!?])\s+(?=[A-Z0-9"'(])"#) else { return [squashed] }
        let ns = squashed as NSString
        var out: [String] = []
        var start = 0
        for match in regex.matches(in: squashed, range: NSRange(location: 0, length: ns.length)) {
            out.append(ns.substring(with: NSRange(location: start, length: match.range.location - start)))
            start = match.range.location + match.range.length
        }
        out.append(ns.substring(from: start))
        return out.filter { !$0.isEmpty }
    }

    /// `shortDefinition`: the first sentence, clamped to 165 characters on a word.
    static func shortDefinition(_ definition: String) -> String {
        let first = sentences(definition).first ?? squash(definition)
        guard first.count > 165 else { return first }
        let clipped = String(first.prefix(164))
        let trimmed = clipped.replacingOccurrences(of: #"[\s,;:—-]+\S*$"#, with: "", options: .regularExpression)
        return trimmed + "\u{2026}"
    }

    // MARK: Where this module sits

    /// The site's module labels: "Start here" for a prerequisite module, else 1...N.
    static func labels(for modules: [Module]) -> [String] {
        var n = 0
        return modules.map { module in
            if module.isPrerequisite { return "Start here" }
            n += 1
            return "\(n)"
        }
    }

    /// The overview, or a factual sentence when the module has none.
    static func overview(for module: Module, in department: Department, label: String) -> String {
        let own = squash(module.overview)
        if !own.isEmpty { return own }
        let count = module.lessons.count
        let place = module.isPrerequisite ? "the recommended starting point" : "module \(label)"
        return "\(module.title) is \(place) of \(department.modules.count) in the LearnFRC \(department.name) guide: \(count) free \(count == 1 ? "lesson" : "lessons") you can read in any order."
    }

    /// `moduleFit`: position, neighbours, and this module's share of the guide.
    static func fit(for module: Module, in department: Department) -> String {
        let modules = department.modules
        guard let index = modules.firstIndex(where: { $0.id == module.id }) else { return "" }
        let label = labels(for: modules)[index]
        let count = modules.count
        let prev = index > 0 ? modules[index - 1] : nil
        let next = index < count - 1 ? modules[index + 1] : nil
        let lessons = module.lessons.count
        let plural = lessons == 1 ? "lesson" : "lessons"
        let minutes = module.totalMinutes
        let deptMinutes = modules.reduce(0) { $0 + $1.totalMinutes }
        let longest = modules.map(\.totalMinutes).max() ?? 0
        let isLongest = minutes > 0 && minutes == longest
        let title = module.title
        let deptName = department.name

        let whereText: String
        if module.isPrerequisite {
            whereText = "\(title) is the prerequisite module of the \(deptName) guide. It is the ground the \(count - 1) numbered modules after it assume you already have"
        } else if prev == nil {
            whereText = "\(title) opens the \(deptName) guide"
        } else if next == nil {
            whereText = "\(title) closes the \(deptName) guide as module \(label) of \(count)"
        } else {
            whereText = "\(title) is module \(label) of \(count) in the \(deptName) guide"
        }

        let neighbours: String
        if let prev, let next {
            neighbours = ". It picks up where \(prev.title) left off and hands over to \(next.title)."
        } else if let next {
            neighbours = ", and \(next.title) follows it."
        } else if let prev {
            neighbours = ", after \(prev.title)."
        } else {
            neighbours = "."
        }

        let hours = max(1, Int((Double(deptMinutes) / 60).rounded()))
        let scale: String
        if minutes <= 0 {
            scale = " It holds \(lessons) of the guide's \(plural)."
        } else if isLongest && count > 1 {
            scale = " At ~\(minutes) minutes across \(lessons) \(plural) it is the longest module in the guide, which runs about \(hours) hours end to end."
        } else {
            scale = " Its \(lessons) \(plural) are about \(minutes) minutes of the guide's ~\(hours) hours."
        }
        return whereText + neighbours + scale
    }

    // MARK: Glossary terms the module uses

    /// Terms so universal in FRC writing that matching them says nothing about a module.
    private static let termDeny: Set<String> = [
        "FIRST", "FIRST Robotics Competition", "FIRST Tech Challenge", "FIRST LEGO League", "Rookie Team",
    ]
    private static let termMax = 5
    /// `hasGlossaryDepth`: a term whose "where you'll meet this" note runs 35 words or more.
    private static let minInMatchWords = 35

    private static func hasDepth(_ term: GlossaryTerm) -> Bool {
        (term.inMatch ?? "").split(whereSeparator: { $0.isWhitespace }).count >= minInMatchWords
    }

    private static func isAbbreviationLike(_ text: String) -> Bool {
        text.range(of: #"^[A-Z0-9][A-Z0-9-]{1,5}$"#, options: .regularExpression) != nil
    }

    /// Whole-token match, so "PID" never fires inside "rapid". Abbreviations match case
    /// sensitively, so the English word "can" is not "CAN".
    private static func contains(_ name: String, in text: String) -> Bool {
        let pattern = "(^|[^A-Za-z0-9])" + NSRegularExpression.escapedPattern(for: name) + "([^A-Za-z0-9]|$)"
        var options: String.CompareOptions = [.regularExpression]
        if !isAbbreviationLike(name) { options.insert(.caseInsensitive) }
        return text.range(of: pattern, options: options) != nil
    }

    /// `moduleTerms`: up to five glossary terms the module's own text genuinely uses.
    static func terms(for module: Module, glossary: [GlossaryTerm]) -> [GlossaryTerm] {
        let title = module.title
        let lessonTitles = module.lessons.map(\.title).joined(separator: " \u{00B7} ")
        let overview = squash(module.overview)
        let summaries = module.lessons.map { $0.summary ?? "" }.joined(separator: " ")

        var scored: [(term: GlossaryTerm, score: Double)] = []
        for term in glossary where !termDeny.contains(term.term) && hasDepth(term) {
            var names = [term.term]
            if let abbr = term.abbr, abbr != term.term { names.append(abbr) }
            names.append(contentsOf: term.alsoCalled)
            names = names.filter { $0.count >= 3 }
            var strong = 0.0
            var weak = 0.0
            for name in names {
                let weight = name.contains(" ") ? 1.6 : 1
                if contains(name, in: title) { strong += 10 * weight }
                if contains(name, in: lessonTitles) { strong += 6 * weight }
                if contains(name, in: overview) { strong += 5 * weight }
                if contains(name, in: summaries) { weak += 3 * weight }
            }
            let score = strong + weak
            if strong >= 5 || score >= 9 { scored.append((term, score)) }
        }
        scored.sort { (a: (term: GlossaryTerm, score: Double), b: (term: GlossaryTerm, score: Double)) -> Bool in
            if a.score != b.score { return a.score > b.score }
            return a.term.term < b.term.term
        }
        return scored.prefix(termMax).map(\.term)
    }

    /// Whether to print the abbreviation beside the term ("CAN bus" already says CAN).
    static func showsAbbreviation(_ term: GlossaryTerm) -> Bool {
        guard let abbr = term.abbr, !abbr.isEmpty else { return false }
        return !contains(abbr, in: term.term)
    }

    // MARK: Same-named modules elsewhere

    private static let deptKeyword: [String: String] = [
        "getting-started": "Rookie Guide",
        "mechanical-build": "Mechanical",
        "programming-software": "Programming",
        "electrical-wiring": "Electrical",
        "cad-design": "CAD",
        "scouting-strategy": "Scouting",
        "drive-team": "Drive Team",
        "business-operations": "Team Business",
        "media-outreach": "Media & Outreach",
        "impact-award": "Impact Award",
        "safety": "Safety",
    ]

    private static func twinNorm(_ title: String, keyword: String?) -> String {
        var s = title.lowercased()
            .replacingOccurrences(of: "&", with: " and ")
            .replacingOccurrences(of: "[^a-z0-9 ]+", with: " ", options: .regularExpression)
        s = squash(s)
        if let keyword {
            let head = keyword.split(whereSeparator: { $0 == " " || $0 == "&" }).first.map(String.init) ?? keyword
            s = s.replacingOccurrences(of: "\\b" + NSRegularExpression.escapedPattern(for: head.lowercased()) + "\\b",
                                       with: "", options: .regularExpression)
        }
        return squash(s)
    }

    /// `titleTwins`: modules in other departments that carry this module's name.
    static func twins(of module: Module, in department: Department, catalog: [Department]) -> [(department: Department, module: Module)] {
        let mine = twinNorm(module.title, keyword: deptKeyword[department.slug])
        guard mine.split(separator: " ").count >= 3 else { return [] }
        var out: [(department: Department, module: Module)] = []
        for other in catalog where other.id != department.id {
            for candidate in other.modules {
                let theirs = twinNorm(candidate.title, keyword: deptKeyword[other.slug])
                guard theirs.split(separator: " ").count >= 3 else { continue }
                if theirs == mine || theirs.contains(mine) || mine.contains(theirs) {
                    out.append((other, candidate))
                }
            }
        }
        return out.sorted { $0.department.name.localizedCompare($1.department.name) == .orderedAscending }
    }

    // MARK: Articles that go deeper

    private static let stopWords: Set<String> = Set(
        "the and that with your this what how why when guide free lesson lessons module modules team teams robot robots frc first used using other into over each from for are was has have not but can they them will more most make made take does done very just also than then here there about their were which while"
            .split(separator: " ").map(String.init)
    )

    private static func tokens(_ text: String) -> Set<String> {
        Set(text.lowercased()
            .split(whereSeparator: { !($0.isASCII && ($0.isLetter || $0.isNumber)) })
            .map(String.init)
            .filter { $0.count > 3 && !stopWords.contains($0) })
    }

    /// `moduleArticles`: up to two articles really about this module's subject. Strict on
    /// purpose; about a third of modules get none.
    static func articles(for module: Module, articles: [Article]) -> [Article] {
        let lessonTitles: String = module.lessons.map(\.title).joined(separator: " \u{00B7} ")
        let summaries: String = module.lessons.map { $0.summary ?? "" }.joined(separator: " ")
        let text: String = [module.title, squash(module.overview), lessonTitles, summaries].joined(separator: " ")
        let mine = tokens(text)
        var out: [(article: Article, cosine: Double)] = []
        for article in articles {
            let all = tokens("\(article.title) \(article.description) \(article.keywords.joined(separator: " "))")
            let keywords = tokens("\(article.keywords.joined(separator: " ")) \(article.title)")
            let shared = all.intersection(mine).count
            let keywordHits = keywords.intersection(mine).count
            let denominator: Double = (Double(max(all.count, 1)) * Double(max(mine.count, 1))).squareRoot()
            let cosine: Double = Double(shared) / denominator
            if shared >= 6 && keywordHits >= 3 && cosine >= 0.14 {
                out.append((article, cosine))
            }
        }
        out.sort { (a: (article: Article, cosine: Double), b: (article: Article, cosine: Double)) -> Bool in
            if a.cosine != b.cosine { return a.cosine > b.cosine }
            return a.article.slug < b.article.slug
        }
        return out.prefix(2).map(\.article)
    }
}
