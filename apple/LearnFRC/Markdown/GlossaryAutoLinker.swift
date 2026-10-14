import Foundation

// A port of the website's conservative glossary auto-linking
// (`src/lib/glossary-link.ts`). It turns the FIRST mention of a piece of FRC
// jargon into a tappable term, with the same restraint as the site:
//
//   - first occurrence of a term only, per document
//   - never inside a heading, code, an existing link, a table header or a
//     block quote (quotes hold verbatim words and copy-paste templates)
//   - at most one auto-link per paragraph / list item / table cell, and never
//     two closer together than 400 characters of document text
//   - at most 4 per document
//   - whole-word matches only, never the head of a longer glossary name
//     ("PID" out of "PID controller")
//   - skipped entirely if the author already linked that entry
//
// The website walks the HTML tree, so character counts include the text of
// skipped elements and the newline text nodes the Markdown-to-HTML step puts
// between block elements. `GlossaryAutoLinker.walk` reproduces that tree's
// text nodes so the 400-character spacing lands where it does on the site.

/// One glossary entry as the linker needs it.
struct GlossaryLinkEntry: Hashable, Sendable {
    var term: String
    var abbr: String?
    var slug: String

    /// `glossarySlug()` from `src/lib/glossary-data.ts`: lowercase, drop
    /// anything that is not a word character, space or hyphen, spaces to `-`.
    static func slug(for term: String) -> String {
        let lowered = term.lowercased()
        let kept = lowered.unicodeScalars.filter { scalar in
            isWordScalar(scalar) || scalar == "-" || isJSWhitespace(scalar)
        }
        let trimmed = String(String.UnicodeScalarView(kept)).trimmingCharacters(in: .whitespacesAndNewlines)
        var out = ""
        var inSpace = false
        for scalar in trimmed.unicodeScalars {
            if isJSWhitespace(scalar) {
                if !inSpace { out.append("-") }
                inSpace = true
            } else {
                out.unicodeScalars.append(scalar)
                inSpace = false
            }
        }
        return out
    }

    private static func isWordScalar(_ s: Unicode.Scalar) -> Bool {
        (s >= "a" && s <= "z") || (s >= "A" && s <= "Z") || (s >= "0" && s <= "9") || s == "_"
    }

    static func isJSWhitespace(_ s: Unicode.Scalar) -> Bool {
        s.properties.isWhitespace || s == "\u{FEFF}"
    }
}

/// The alias table, built once per glossary (it is the same for every document).
struct GlossaryLinkTable: Sendable {
    struct Alias: Sendable {
        var needle: [UInt16]
        var caseSensitive: Bool
        var allowPlural: Bool
        var englishWord: Bool
        var slug: String
        var term: String
    }

    static let maxLinks = 4
    static let minGap = 400

    /// Real entries that read as ordinary English in prose.
    private static let aliasDeny: Set<String> = [
        "auto", "alliance", "district", "regional", "inspection", "playoffs",
        "first choice", "the blue alliance", "open alliance", "first", "champs",
    ]

    /// Aliases that are also ordinary English words ("CAN", "COTS").
    private static let ambiguousEnglish: Set<String> = ["can", "cots"]

    /// A modal verb is followed by a bare infinitive: "what CAN be done".
    static let englishFollowers: Set<String> = [
        "be", "been", "being", "have", "has", "had", "do", "does", "did",
        "not", "never", "only", "also", "still", "always", "already", "easily",
        "quickly", "really", "sometimes", "either", "both", "then",
        "help", "make", "take", "get", "give", "see", "go", "come", "keep",
        "put", "use", "find", "tell", "show", "write", "add", "happen",
        "cause", "affect", "become", "seem", "hold", "bring", "feel", "look",
        "mean", "need", "want", "learn", "teach", "save", "cost", "carry",
        "reach", "leave", "let", "ask", "expect", "afford", "handle",
    ]

    let aliases: [Alias]
    /// Every multi-word glossary name, lowercased, bucketed by its first word.
    let phrasesByHead: [String: [String]]

    var isEmpty: Bool { aliases.isEmpty }

    init(entries: [GlossaryLinkEntry]) {
        var out: [Alias] = []
        var seen = Set<String>()
        var phrases: [String: [String]] = [:]

        for entry in entries {
            // "Gyroscope / IMU" matches "Gyroscope"; the abbreviation covers the rest.
            let primary = entry.term.split(separator: "/", maxSplits: 1, omittingEmptySubsequences: false)
                .first.map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) } ?? ""
            var candidates: [String] = []
            if !primary.isEmpty { candidates.append(primary) }
            if let abbr = entry.abbr?.trimmingCharacters(in: .whitespacesAndNewlines), !abbr.isEmpty {
                candidates.append(abbr)
            }

            for raw in candidates {
                let lower = Self.jsLowercased(raw)
                guard Self.matchesAliasShape(raw) else { continue }
                Self.recordPhrase(raw, into: &phrases)

                if seen.contains(lower) { continue }
                if Self.aliasDeny.contains(lower) { continue }

                let caseSensitive = Self.hasAcronymRun(raw)
                let minLength = caseSensitive ? 3 : 5
                if raw.utf16.count < minLength { continue }

                seen.insert(lower)
                out.append(Alias(
                    needle: Array((caseSensitive ? raw : lower).utf16),
                    caseSensitive: caseSensitive,
                    allowPlural: !caseSensitive && !lower.hasSuffix("s"),
                    englishWord: Self.ambiguousEnglish.contains(lower),
                    slug: entry.slug,
                    term: entry.term
                ))
            }
        }

        // Longest first, stable, so "Alliance Selection" wins over a shorter overlap.
        let indexed = out.enumerated().sorted { a, b in
            if a.element.needle.count != b.element.needle.count {
                return a.element.needle.count > b.element.needle.count
            }
            return a.offset < b.offset
        }
        aliases = indexed.map(\.element)
        phrasesByHead = phrases
    }

    // MARK: Helpers mirroring the TypeScript

    /// `/^[A-Za-z0-9][A-Za-z0-9 .'’-]*$/`
    private static func matchesAliasShape(_ raw: String) -> Bool {
        var first = true
        for unit in raw.utf16 {
            let isAlnum = (unit >= 0x30 && unit <= 0x39) || (unit >= 0x41 && unit <= 0x5A) || (unit >= 0x61 && unit <= 0x7A)
            if first {
                guard isAlnum else { return false }
                first = false
                continue
            }
            if isAlnum || unit == 0x20 || unit == 0x2E || unit == 0x27 || unit == 0x2019 || unit == 0x2D { continue }
            return false
        }
        return !first
    }

    /// `/[A-Z]{2,}/`
    private static func hasAcronymRun(_ raw: String) -> Bool {
        var run = 0
        for unit in raw.utf16 {
            if unit >= 0x41 && unit <= 0x5A {
                run += 1
                if run >= 2 { return true }
            } else {
                run = 0
            }
        }
        return false
    }

    private static func recordPhrase(_ raw: String, into phrases: inout [String: [String]]) {
        let words = jsLowercased(raw).split(whereSeparator: { $0.unicodeScalars.allSatisfy(GlossaryLinkEntry.isJSWhitespace) })
        let name = words.joined(separator: " ")
        guard let head = words.first.map(String.init), !head.isEmpty, head != name else { return }
        phrases[head, default: []].append(name)
    }

    /// Lowercases ASCII letters only, which keeps UTF-16 offsets identical
    /// between a string and its lowered copy (what the site's code assumes).
    static func jsLowercased(_ s: String) -> String {
        String(decoding: s.utf16.map { ($0 >= 0x41 && $0 <= 0x5A) ? $0 + 32 : $0 }, as: UTF16.self)
    }

    static func lowered(_ units: [UInt16]) -> [UInt16] {
        units.map { ($0 >= 0x41 && $0 <= 0x5A) ? $0 + 32 : $0 }
    }

    func startsALongerName(_ text: String) -> Bool {
        let head = text.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? text
        guard let list = phrasesByHead[head] else { return false }
        return list.contains { $0.hasPrefix(text) }
    }
}

/// Runs the linker over a parsed document, mutating its spans in place.
struct GlossaryAutoLinker {
    private let table: GlossaryLinkTable
    private var used: Set<String>
    private var count = 0
    private let max: Int
    private var chars = 0
    private var lastEnd = -GlossaryLinkTable.minGap
    private var blockUsed = false

    init(table: GlossaryLinkTable, authorLinkedSlugs: Set<String>, max: Int = GlossaryLinkTable.maxLinks) {
        self.table = table
        self.used = authorLinkedSlugs
        self.max = Swift.max(0, max)
    }

    static func link(_ blocks: inout [MarkdownBlock], table: GlossaryLinkTable, authorLinkedSlugs: Set<String>) {
        guard !table.isEmpty else { return }
        var linker = GlossaryAutoLinker(table: table, authorLinkedSlugs: authorLinkedSlugs)
        guard linker.max > 0 else { return }
        // The root wraps its children with a newline text node between each pair.
        for index in blocks.indices {
            if index > 0 { linker.chars += 1 }
            linker.walk(&blocks[index], skipping: false)
        }
    }

    // MARK: Tree walk

    private mutating func asBlock(_ body: (inout GlossaryAutoLinker) -> Void) {
        let outer = blockUsed
        blockUsed = false
        body(&self)
        blockUsed = outer
    }

    private mutating func walk(_ block: inout MarkdownBlock, skipping: Bool) {
        switch block.kind {
        case .heading(let level, var content, let anchor):
            walkInline(&content, skipping: true)
            block.kind = .heading(level: level, content: content, anchor: anchor)

        case .paragraph(var content):
            asBlock { $0.walkInline(&content, skipping: skipping) }
            block.kind = .paragraph(content)

        case .image, .rule:
            break

        case .code(let code):
            // `<pre><code>` holds the source plus one trailing newline.
            chars += code.code.isEmpty ? 0 : code.code.utf16.count + 1

        case .quote(var children):
            walkWrapped(&children, skipping: true)
            block.kind = .quote(children)

        case .callout(let label, var children):
            walkWrapped(&children, skipping: true)
            block.kind = .callout(label: label, blocks: children)

        case .list(var list):
            chars += 1
            for index in list.items.indices {
                if index > 0 { chars += 1 }
                walkItem(&list.items[index], loose: list.loose, skipping: skipping)
            }
            if !list.items.isEmpty { chars += 1 }
            block.kind = .list(list)

        case .table(var table):
            // table > (thead, tbody), each wrapped with newline nodes.
            chars += 1
            chars += 1
            walkRow(&table.header, header: true, skipping: skipping)
            chars += 1
            if !table.rows.isEmpty {
                chars += 1
                chars += 1
                for index in table.rows.indices {
                    if index > 0 { chars += 1 }
                    walkRow(&table.rows[index], header: false, skipping: skipping)
                }
                chars += 1
            }
            chars += 1
            block.kind = .table(table)
        }
    }

    private mutating func walkWrapped(_ blocks: inout [MarkdownBlock], skipping: Bool) {
        chars += 1
        for index in blocks.indices {
            if index > 0 { chars += 1 }
            walk(&blocks[index], skipping: skipping)
        }
        if !blocks.isEmpty { chars += 1 }
    }

    private mutating func walkRow(_ cells: inout [MarkdownInline], header: Bool, skipping: Bool) {
        chars += 1
        for index in cells.indices {
            if index > 0 { chars += 1 }
            if header {
                walkInline(&cells[index], skipping: true)
            } else {
                asBlock { $0.walkInline(&cells[index], skipping: skipping) }
            }
        }
        if !cells.isEmpty { chars += 1 }
    }

    private mutating func walkItem(_ item: inout MarkdownListItem, loose: Bool, skipping: Bool) {
        asBlock { linker in
            if item.checkbox != nil, let first = item.blocks.first, case .paragraph(let p) = first.kind, !p.isEmpty {
                linker.chars += 1 // the space after the checkbox input
            }
            for index in item.blocks.indices {
                let isParagraph = Self.isParagraph(item.blocks[index])
                if loose || index != 0 || !isParagraph { linker.chars += 1 }
                if isParagraph && !loose {
                    // A tight item's paragraph is unwrapped into the <li>.
                    if case .paragraph(var content) = item.blocks[index].kind {
                        linker.walkInline(&content, skipping: skipping)
                        item.blocks[index].kind = .paragraph(content)
                    }
                } else {
                    linker.walk(&item.blocks[index], skipping: skipping)
                }
            }
            if let tail = item.blocks.last, loose || !Self.isParagraph(tail) {
                linker.chars += 1
            }
        }
    }

    private static func isParagraph(_ block: MarkdownBlock) -> Bool {
        switch block.kind {
        case .paragraph, .image: return true
        default: return false
        }
    }

    private mutating func walkInline(_ inline: inout MarkdownInline, skipping: Bool) {
        var index = 0
        while index < inline.spans.count {
            let span = inline.spans[index]
            switch span.kind {
            case .text:
                if skipping || span.link != nil || count >= max {
                    chars += span.text.utf16.count
                } else if let replacement = linkify(span) {
                    inline.spans.replaceSubrange(index...index, with: replacement)
                    index += replacement.count - 1
                }
            case .code:
                chars += span.text.utf16.count
            case .lineBreak:
                chars += 1
            case .image, .html:
                break
            }
            index += 1
        }
    }

    // MARK: Matching

    /// Places at most one link in this text node. Always advances the counter.
    private mutating func linkify(_ span: MarkdownSpan) -> [MarkdownSpan]? {
        let value = Array(span.text.utf16)
        let base = chars
        chars += value.count

        if blockUsed || count >= max { return nil }
        let earliest = Swift.max(0, lastEnd + GlossaryLinkTable.minGap - base)
        if earliest >= value.count { return nil }

        let lowered = GlossaryLinkTable.lowered(value)
        var best: (alias: GlossaryLinkTable.Alias, start: Int, end: Int)?
        for alias in table.aliases {
            if used.contains(alias.slug) { continue }
            guard let match = findMatch(value, lowered, alias, from: earliest) else { continue }
            if let current = best {
                let better = match.start < current.start
                    || (match.start == current.start && match.end - match.start > current.end - current.start)
                if better { best = (alias, match.start, match.end) }
            } else {
                best = (alias, match.start, match.end)
            }
        }
        guard let best else { return nil }

        var out: [MarkdownSpan] = []
        if best.start > 0 {
            var before = span
            before.text = String(decoding: value[0..<best.start], as: UTF16.self)
            out.append(before)
        }
        var linked = span
        linked.text = String(decoding: value[best.start..<best.end], as: UTF16.self)
        linked.glossarySlug = best.alias.slug
        out.append(linked)
        if best.end < value.count {
            var after = span
            after.text = String(decoding: value[best.end...], as: UTF16.self)
            out.append(after)
        }

        used.insert(best.alias.slug)
        count += 1
        blockUsed = true
        lastEnd = base + best.end
        return out
    }

    private func findMatch(_ value: [UInt16], _ lowered: [UInt16], _ alias: GlossaryLinkTable.Alias, from: Int) -> (start: Int, end: Int)? {
        let hay = alias.caseSensitive ? value : lowered
        let needle = alias.needle
        guard !needle.isEmpty, hay.count >= needle.count else { return nil }
        var i = from
        let first = needle[0]
        let lastStart = hay.count - needle.count
        while i <= lastStart {
            if hay[i] == first && Self.hasPrefix(hay, needle, at: i) {
                var end = i + needle.count
                var ok = Self.boundaryOK(value, i, end)
                if !ok, alias.allowPlural, end < value.count,
                   value[end] == 0x73 || value[end] == 0x53,
                   Self.boundaryOK(value, i, end + 1) {
                    end += 1
                    ok = true
                }
                if ok && acceptable(value, i, end, alias) { return (i, end) }
            }
            i += 1
        }
        return nil
    }

    private static func hasPrefix(_ hay: [UInt16], _ needle: [UInt16], at start: Int) -> Bool {
        var j = 1
        while j < needle.count {
            if hay[start + j] != needle[j] { return false }
            j += 1
        }
        return true
    }

    /// `/[A-Za-z0-9_-]/`
    private static func isWordish(_ unit: UInt16) -> Bool {
        (unit >= 0x30 && unit <= 0x39) || (unit >= 0x41 && unit <= 0x5A) || (unit >= 0x61 && unit <= 0x7A)
            || unit == 0x5F || unit == 0x2D
    }

    private static func boundaryOK(_ value: [UInt16], _ start: Int, _ end: Int) -> Bool {
        if start > 0 && isWordish(value[start - 1]) { return false }
        if end < value.count && isWordish(value[end]) { return false }
        return true
    }

    /// The next word, only when it follows a single space: `/^[  ]([A-Za-z][A-Za-z0-9'’-]*)/`.
    private static func nextWord(_ value: [UInt16], _ end: Int) -> String {
        guard end < value.count, value[end] == 0x20 || value[end] == 0xA0 else { return "" }
        var i = end + 1
        guard i < value.count, isLetter(value[i]) else { return "" }
        let start = i
        i += 1
        while i < value.count {
            let u = value[i]
            if isLetter(u) || (u >= 0x30 && u <= 0x39) || u == 0x27 || u == 0x2019 || u == 0x2D {
                i += 1
            } else {
                break
            }
        }
        return String(decoding: value[start..<i], as: UTF16.self)
    }

    private static func isLetter(_ u: UInt16) -> Bool {
        (u >= 0x41 && u <= 0x5A) || (u >= 0x61 && u <= 0x7A)
    }

    /// Rejects the head of a longer glossary name and English words wearing an acronym's clothes.
    private func acceptable(_ value: [UInt16], _ start: Int, _ end: Int, _ alias: GlossaryLinkTable.Alias) -> Bool {
        let next = Self.nextWord(value, end)
        if next.isEmpty { return true }
        let matched = String(decoding: value[start..<end], as: UTF16.self)
        let combined = GlossaryLinkTable.jsLowercased("\(matched) \(next)")
        if table.startsALongerName(combined) { return false }
        if alias.englishWord && GlossaryLinkTable.englishFollowers.contains(GlossaryLinkTable.jsLowercased(next)) {
            return false
        }
        return true
    }
}
