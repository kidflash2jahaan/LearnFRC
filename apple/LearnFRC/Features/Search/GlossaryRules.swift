import Foundation

// The glossary pages' rules, ported from the site so the app shows the same lessons and
// the same neighbouring cards for a term as learnfrc.com does:
// - `matchLessons` and `relatedTerms` in src/app/glossary/[term]/page.tsx
// - the catalogue filter in src/components/glossary/glossary-browser.tsx
//
// `ReferenceStore.lessons(teaching:)` and `relatedTerms(for:)` use simpler rules (a cue
// anywhere in a word, same-category neighbours only), so these are used instead. The
// integrator may want to promote them into Core.

nonisolated enum GlossaryRules {

    // MARK: Lessons that use a term

    /// A cue only counts on a whole-token boundary, so "CAN" never matches "can't" mid-word
    /// and "PID" never matches "rapid".
    private static let titleHit = 6.0
    private static let summaryHit = 3.0
    /// Multi-word cues are far less likely to be coincidental.
    private static let phraseWeight = 1.5
    /// One title hit, or two summary hits. A wrong link costs more than an empty section.
    private static let minScore = 6.0
    private static let maxLessons = 3

    /// The two or three lessons that genuinely cover `term`, scored on lesson titles and
    /// summaries exactly as the site does. Empty when nothing clears the bar.
    static func lessons(teaching term: GlossaryTerm, in lessons: [LessonLocation]) -> [LessonLocation] {
        let cues = term.lessonCues.filter { !$0.isEmpty }
        guard !cues.isEmpty else { return [] }
        let compiled = cues.map { cue in
            (needle: Array(cue.lowercased().utf8), weight: cue.contains(" ") ? phraseWeight : 1.0)
        }

        struct Entry {
            let path: String
            let title: String
            let location: LessonLocation
            var score: Double
        }

        var entries: [Entry] = lessons.map { location in
            Entry(
                path: "/guides/\(location.department.slug)/\(location.module.slug)/\(location.lesson.slug)",
                title: location.lesson.title,
                location: location,
                score: 0
            )
        }
        // The site sorts its index by path first so every tie-break is deterministic.
        entries.sort { $0.path.localizedCompare($1.path) == .orderedAscending }

        for i in entries.indices {
            let title = Array(entries[i].title.lowercased().utf8)
            let summary = entries[i].location.lesson.summary.map { Array($0.lowercased().utf8) }
            var score = 0.0
            for cue in compiled {
                if containsToken(cue.needle, in: title) { score += titleHit * cue.weight }
                if let summary, containsToken(cue.needle, in: summary) { score += summaryHit * cue.weight }
            }
            entries[i].score = score
        }

        return entries
            .enumerated()
            .filter { $0.element.score >= minScore }
            .sorted { a, b in
                if a.element.score != b.element.score { return a.element.score > b.element.score }
                let byTitle = a.element.title.localizedCompare(b.element.title)
                if byTitle != .orderedSame { return byTitle == .orderedAscending }
                return a.offset < b.offset
            }
            .prefix(maxLessons)
            .map(\.element.location)
    }

    /// `(^|[^a-z0-9])cue([^a-z0-9]|$)`, case-insensitive (both sides already lowercased).
    static func containsToken(_ needle: [UInt8], in haystack: [UInt8]) -> Bool {
        guard !needle.isEmpty, haystack.count >= needle.count else { return false }
        var from = 0
        while let p = SearchMatcher.find(needle, in: haystack, from: from) {
            from = p + 1
            let before = p == 0 || !isAlphanumeric(haystack[p - 1])
            let end = p + needle.count
            let after = end == haystack.count || !isAlphanumeric(haystack[end])
            if before && after { return true }
        }
        return false
    }

    private static func isAlphanumeric(_ byte: UInt8) -> Bool {
        (byte >= 0x61 && byte <= 0x7A) || (byte >= 0x30 && byte <= 0x39)
    }

    // MARK: Filed next to it

    /// Short and common words that say nothing about what a term is.
    private static let stopWords: Set<String> = [
        "the", "and", "that", "with", "for", "from", "into", "over", "one", "its",
        "are", "was", "has", "have", "each", "not", "but", "can", "team", "teams",
        "robot", "robots", "frc", "first", "used", "use", "using", "other",
    ]

    private static func tokens(_ text: String) -> Set<String> {
        let words = text.lowercased().split { character in
            !(character.isASCII && (character.isLetter || character.isNumber))
        }
        return Set(words.map(String.init).filter { $0.count > 3 && !stopWords.contains($0) })
    }

    /// Up to `limit` related terms. The hand-picked `related` entries lead; the same
    /// category plus shared definition words fill the rest, alphabetical on a tie.
    static func relatedTerms(for term: GlossaryTerm, in glossary: [GlossaryTerm], limit: Int = 4) -> [GlossaryTerm] {
        let byTerm = Dictionary(glossary.map { ($0.term, $0) }, uniquingKeysWith: { _, last in last })
        var picked: [GlossaryTerm] = []
        var seen: Set<String> = [term.term]
        for name in term.related {
            guard let match = byTerm[name], !seen.contains(match.term) else { continue }
            seen.insert(match.term)
            picked.append(match)
            if picked.count >= limit { return picked }
        }

        let mine = tokens("\(term.term) \(term.definition)")
        let fill = glossary
            .filter { !seen.contains($0.term) }
            .map { candidate -> (term: GlossaryTerm, score: Int) in
                var score = candidate.category == term.category ? 3 : 0
                score += tokens("\(candidate.term) \(candidate.definition)").intersection(mine).count
                return (candidate, score)
            }
            .sorted { a, b in
                if a.score != b.score { return a.score > b.score }
                return a.term.term.localizedCompare(b.term.term) == .orderedAscending
            }
            .prefix(max(0, limit - picked.count))
            .map(\.term)
        return picked + fill
    }

    // MARK: Names

    /// "PID" for PID Controller, the term itself when there's no short form.
    static func shortName(_ term: GlossaryTerm) -> String {
        if let abbr = term.abbr, !abbr.isEmpty, abbr != term.term { return abbr }
        return term.term
    }

    // MARK: The catalogue filter

    /// The catalogue's filter: a category, then the text anywhere in the term, its short
    /// form, its other names or its definition. Alphabetical.
    static func filter(_ terms: [GlossaryTerm], query: String, category: String?) -> [GlossaryTerm] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return terms
            .filter { category == nil || $0.category == category }
            .filter { term in
                guard !q.isEmpty else { return true }
                func has(_ text: String?) -> Bool {
                    text?.range(of: q, options: [.caseInsensitive, .diacriticInsensitive]) != nil
                }
                return has(term.term) || has(term.abbr) || has(term.definition) || term.alsoCalled.contains { has($0) }
            }
            .sorted { $0.term.localizedCompare($1.term) == .orderedAscending }
    }

    /// The letter a term is filed under: A to Z, or "#" for anything else.
    static func letter(for term: GlossaryTerm) -> String {
        guard let first = term.term.first else { return "#" }
        let upper = String(first).uppercased()
        guard upper.count == 1, let scalar = upper.unicodeScalars.first, scalar.value >= 65, scalar.value <= 90 else { return "#" }
        return upper
    }

    static let alphabet: [String] = (65...90).map { String(UnicodeScalar(UInt8($0))) }
}
