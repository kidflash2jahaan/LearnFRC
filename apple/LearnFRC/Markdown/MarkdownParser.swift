import Foundation
import Markdown

// Turns lesson/article Markdown into a `MarkdownDocument`.
//
// Built on swift-markdown (cmark-gfm), configured to read the same way the
// website's react-markdown + remark-gfm pipeline does:
// - no smart punctuation (the site prints quotes and dashes as written)
// - GFM tables, strikethrough and task lists
// - bare URLs become links (remark-gfm's autolink literals; cmark-gfm's
//   autolink extension is not enabled by swift-markdown, so it is done here)
// - raw HTML is shown as literal text, as react-markdown does without rehype-raw
// - `#` renders like `##`; heading anchors follow the site's `extractHeadings`

enum MarkdownParser {
    /// Parses and fully prepares one document. Pure, safe off the main thread.
    static func document(from markdown: String, glossary: GlossaryLinkTable?, scale: MarkdownTypeScale = .standard) -> MarkdownDocument {
        var builder = Builder(source: markdown)
        var blocks = builder.build()

        if let glossary, !glossary.isEmpty {
            GlossaryAutoLinker.link(&blocks, table: glossary, authorLinkedSlugs: builder.authorGlossarySlugs)
        }
        blocks = blocks.map(CalloutLabels.extract)
        let usedScale = MarkdownStyler.style(&blocks, scale: scale)

        let plain = blocks.map(PlainText.of).filter { !$0.isEmpty }.joined(separator: "\n\n")
        return MarkdownDocument(
            blocks: blocks, headings: builder.headings, plainText: plain,
            typeScale: scale, dependsOnTypeScale: usedScale
        )
    }

    /// The site's `extractHeadings`: line based, so it agrees with the website's
    /// anchors even where that differs from the parsed tree.
    static func headings(in markdown: String) -> [LessonMarkdownHeading] {
        var out: [LessonMarkdownHeading] = []
        var seen: [String: Int] = [:]
        var inFence = false
        for rawLine in markdown.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.hasPrefix("```") || line.hasPrefix("~~~") {
                inFence.toggle()
                continue
            }
            if inFence || !line.hasPrefix("#") { continue }
            // `^(#{1,3})\s+(.+)$` on the trimmed line.
            let scalars = Array(line.unicodeScalars)
            var hashes = 0
            while hashes < scalars.count, scalars[hashes] == "#" { hashes += 1 }
            guard hashes <= 3, hashes < scalars.count, GlossaryLinkEntry.isJSWhitespace(scalars[hashes]) else { continue }
            var start = hashes
            while start < scalars.count, GlossaryLinkEntry.isJSWhitespace(scalars[start]) { start += 1 }
            guard start < scalars.count else { continue }
            let text = stripInlineMarkdown(String(String.UnicodeScalarView(scalars[start...])))
            if text.isEmpty { continue }
            var id = slugify(text)
            if id.isEmpty { id = "section" }
            let n = seen[id, default: 0]
            seen[id] = n + 1
            if n > 0 { id = "\(id)-\(n)" }
            out.append(LessonMarkdownHeading(id: id, title: text, level: hashes <= 2 ? 2 : 3))
        }
        return out
    }

    /// `slugify` from `src/components/markdown.tsx`.
    static func slugify(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        var pendingSpace = false
        var lastWasHyphen = false
        // lowercase, drop `*_~ and anything outside [a-z0-9\s-], trim, \s+ and -+ to one "-".
        for scalar in text.lowercased().unicodeScalars {
            let isWord = (scalar >= "a" && scalar <= "z") || (scalar >= "0" && scalar <= "9")
            if GlossaryLinkEntry.isJSWhitespace(scalar) {
                pendingSpace = !out.isEmpty
                continue
            }
            guard isWord || scalar == "-" else { continue }
            if pendingSpace {
                if !lastWasHyphen { out.append("-") }
                lastWasHyphen = true
                pendingSpace = false
            }
            if scalar == "-" {
                if lastWasHyphen { continue }
                lastWasHyphen = true
            } else {
                lastWasHyphen = false
            }
            out.append(scalar)
        }
        return String(out)
    }

    /// `stripInlineMarkdown` from `src/components/markdown.tsx`: code, bold,
    /// italic and links reduced to their text, trailing `#`s removed.
    static func stripInlineMarkdown(_ text: String) -> String {
        var s = Array(text.unicodeScalars)
        s = replaceDelimited(s, open: ["`"], close: ["`"], forbidden: "`")
        s = replaceDelimited(s, open: ["*", "*"], close: ["*", "*"], forbidden: "*")
        s = replaceDelimited(s, open: ["*"], close: ["*"], forbidden: "*")
        s = replaceLinks(s)
        // `/#+\s*$/`
        var end = s.count
        while end > 0, GlossaryLinkEntry.isJSWhitespace(s[end - 1]) { end -= 1 }
        if end > 0, s[end - 1] == "#" {
            while end > 0, s[end - 1] == "#" { end -= 1 }
            s.removeSubrange(end...)
        }
        return String(String.UnicodeScalarView(s)).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Global, leftmost, non-overlapping `open([^forbidden]+)close` -> `$1`.
    private static func replaceDelimited(_ s: [Unicode.Scalar], open: [Unicode.Scalar], close: [Unicode.Scalar], forbidden: Unicode.Scalar) -> [Unicode.Scalar] {
        var out: [Unicode.Scalar] = []
        out.reserveCapacity(s.count)
        var i = 0
        func matches(_ token: [Unicode.Scalar], at index: Int) -> Bool {
            guard index + token.count <= s.count else { return false }
            for (offset, scalar) in token.enumerated() where s[index + offset] != scalar { return false }
            return true
        }
        while i < s.count {
            if matches(open, at: i) {
                var j = i + open.count
                while j < s.count, s[j] != forbidden { j += 1 }
                if j > i + open.count, matches(close, at: j) {
                    out.append(contentsOf: s[(i + open.count)..<j])
                    i = j + close.count
                    continue
                }
            }
            out.append(s[i])
            i += 1
        }
        return out
    }

    /// `/\[([^\]]+)\]\([^)]+\)/g` -> `$1`.
    private static func replaceLinks(_ s: [Unicode.Scalar]) -> [Unicode.Scalar] {
        var out: [Unicode.Scalar] = []
        var i = 0
        while i < s.count {
            if s[i] == "[" {
                var j = i + 1
                while j < s.count, s[j] != "]" { j += 1 }
                if j > i + 1, j + 1 < s.count, s[j + 1] == "(" {
                    var k = j + 2
                    while k < s.count, s[k] != ")" { k += 1 }
                    if k > j + 2, k < s.count {
                        out.append(contentsOf: s[(i + 1)..<j])
                        i = k + 1
                        continue
                    }
                }
            }
            out.append(s[i])
            i += 1
        }
        return out
    }
}

// MARK: - Tree conversion

private struct Builder {
    let source: String
    let headings: [LessonMarkdownHeading]
    private var nextHeading = 0
    private var nextID = 0
    private(set) var authorGlossarySlugs = Set<String>()

    init(source: String) {
        self.source = source
        self.headings = MarkdownParser.headings(in: source)
    }

    mutating func build() -> [MarkdownBlock] {
        let document = Document(parsing: source, options: [.disableSmartOpts])
        return blocks(in: document, role: .body)
    }

    private mutating func makeID() -> Int {
        nextID += 1
        return nextID
    }

    private mutating func blocks(in container: some Markup, role: MarkdownInlineRole) -> [MarkdownBlock] {
        var out: [MarkdownBlock] = []
        for child in container.children {
            if let block = block(from: child, role: role) {
                out.append(block)
            }
        }
        return out
    }

    private mutating func block(from markup: Markup, role: MarkdownInlineRole) -> MarkdownBlock? {
        switch markup {
        case let heading as Heading:
            let level = heading.level
            let content = inline(heading, role: .heading(min(max(level, 2), 4)))
            var anchor: String?
            if level <= 3, nextHeading < headings.count {
                anchor = headings[nextHeading].id
                nextHeading += 1
            }
            return MarkdownBlock(id: makeID(), kind: .heading(level: level, content: content, anchor: anchor))

        case let paragraph as Paragraph:
            let content = inline(paragraph, role: role)
            if content.spans.count == 1, case .image(let source) = content.spans[0].kind {
                return MarkdownBlock(id: makeID(), kind: .image(source: source, alt: content.spans[0].text))
            }
            return MarkdownBlock(id: makeID(), kind: .paragraph(content))

        case let code as CodeBlock:
            let info = code.language?.split(whereSeparator: { $0 == " " || $0 == "\t" }).first.map(String.init)
            var text = code.code
            if text.hasSuffix("\n") { text.removeLast() }
            let lines = text.isEmpty ? 0 : text.split(separator: "\n", omittingEmptySubsequences: false).count
            let block = MarkdownCode(
                language: info,
                displayLanguage: info?.lowercased(),
                code: text,
                lineCount: lines
            )
            return MarkdownBlock(id: makeID(), kind: .code(block))

        case let quote as BlockQuote:
            let isCallout = Self.opensWithBoldLeadIn(quote)
            let inner = blocks(in: quote, role: isCallout ? .callout : .quote)
            return MarkdownBlock(id: makeID(), kind: isCallout ? .callout(label: nil, blocks: inner) : .quote(inner))

        case let list as UnorderedList:
            return MarkdownBlock(id: makeID(), kind: .list(self.list(list, ordered: false, start: 1, role: role)))

        case let list as OrderedList:
            return MarkdownBlock(id: makeID(), kind: .list(self.list(list, ordered: true, start: Int(list.startIndex), role: role)))

        case let table as Table:
            return MarkdownBlock(id: makeID(), kind: .table(self.table(table)))

        case is ThematicBreak:
            return MarkdownBlock(id: makeID(), kind: .rule)

        case let html as HTMLBlock:
            var raw = html.rawHTML
            while raw.hasSuffix("\n") { raw.removeLast() }
            guard !raw.isEmpty else { return nil }
            let content = MarkdownInline(spans: [MarkdownSpan(kind: .html, text: raw)], role: role)
            return MarkdownBlock(id: makeID(), kind: .paragraph(content))

        default:
            // Block directives and other extensions are not parsed with these options.
            if markup.childCount > 0 {
                let inner = blocks(in: markup, role: role)
                return inner.isEmpty ? nil : MarkdownBlock(id: makeID(), kind: .quote(inner))
            }
            return nil
        }
    }

    /// A callout is a block quote whose first words are bold and which says
    /// more than that bold text. `> **V = I x R**` on its own stays a quote.
    private static func opensWithBoldLeadIn(_ quote: BlockQuote) -> Bool {
        guard let first = quote.child(at: 0) as? Paragraph,
              let lead = first.child(at: 0) as? Strong,
              !lead.plainText.trimmingCharacters(in: .whitespaces).isEmpty
        else { return false }
        if quote.childCount > 1 { return true }
        for index in 1..<max(first.childCount, 1) {
            guard let child = first.child(at: index) else { continue }
            if let text = child as? Markdown.Text, text.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                continue
            }
            if child is SoftBreak || child is LineBreak { continue }
            return true
        }
        return false
    }

    // MARK: Lists

    private mutating func list(_ list: some ListItemContainer, ordered: Bool, start: Int, role: MarkdownInlineRole) -> MarkdownList {
        var items: [MarkdownListItem] = []
        var loose = false
        var previousEnd: Int?
        for item in list.listItems {
            let children = Array(item.children)
            if let previousEnd, let startLine = item.range?.lowerBound.line, startLine > previousEnd + 1 {
                loose = true
            }
            var lastEnd: Int?
            for child in children {
                if let lastEnd, let startLine = child.range?.lowerBound.line, startLine > lastEnd + 1 {
                    loose = true
                }
                lastEnd = child.range?.upperBound.line ?? lastEnd
            }
            previousEnd = lastEnd ?? item.range?.upperBound.line
            let checkbox: Bool? = switch item.checkbox {
            case .checked: true
            case .unchecked: false
            case nil: nil
            }
            items.append(MarkdownListItem(id: makeID(), checkbox: checkbox, blocks: blocks(in: item, role: role)))
        }
        return MarkdownList(ordered: ordered, start: start, loose: loose, items: items)
    }

    // MARK: Tables

    private mutating func table(_ table: Table) -> MarkdownTable {
        // GFM: the delimiter row sets the column count; extra cells are dropped.
        let columns = table.columnAlignments.isEmpty ? table.maxColumnCount : table.columnAlignments.count
        var alignments: [MarkdownTable.Alignment] = table.columnAlignments.map {
            switch $0 {
            case .center: .center
            case .right: .trailing
            default: .leading
            }
        }
        while alignments.count < columns { alignments.append(.leading) }

        func row(_ cells: some Sequence<Table.Cell>, role: MarkdownInlineRole) -> [MarkdownInline] {
            var out: [MarkdownInline] = []
            for cell in cells {
                out.append(inline(cell, role: role))
            }
            while out.count < columns { out.append(MarkdownInline(spans: [], role: role)) }
            if out.count > columns { out.removeLast(out.count - columns) }
            return out
        }

        let header = row(table.head.cells, role: .tableHeader)
        var rows: [[MarkdownInline]] = []
        for bodyRow in table.body.rows {
            rows.append(row(bodyRow.cells, role: .tableCell))
        }
        return MarkdownTable(alignments: alignments, header: header, rows: rows)
    }

    // MARK: Inline content

    private mutating func inline(_ container: some Markup, role: MarkdownInlineRole) -> MarkdownInline {
        var spans: [MarkdownSpan] = []
        appendInlines(of: container, traits: [], link: nil, into: &spans)
        return MarkdownInline(spans: Autolinks.apply(to: spans), role: role)
    }

    /// Adjacent text and soft breaks under one parent become a single span,
    /// matching one text node in the site's tree.
    private mutating func appendInlines(of container: Markup, traits: MarkdownTraits, link: String?, into spans: inout [MarkdownSpan]) {
        var pending: String?
        func flush(_ spans: inout [MarkdownSpan]) {
            if let text = pending, !text.isEmpty {
                spans.append(MarkdownSpan(kind: .text, text: text, traits: traits, link: link))
            }
            pending = nil
        }

        for child in container.children {
            switch child {
            case let text as Markdown.Text:
                pending = (pending ?? "") + text.string
            case is SoftBreak:
                pending = (pending ?? "") + "\n"
            default:
                flush(&spans)
                switch child {
                case let strong as Strong:
                    appendInlines(of: strong, traits: traits.union(.bold), link: link, into: &spans)
                case let emphasis as Emphasis:
                    appendInlines(of: emphasis, traits: traits.union(.italic), link: link, into: &spans)
                case let strike as Strikethrough:
                    appendInlines(of: strike, traits: traits.union(.strike), link: link, into: &spans)
                case let code as InlineCode:
                    spans.append(MarkdownSpan(kind: .code, text: code.code, traits: traits, link: link))
                case let anchor as Markdown.Link:
                    let raw = anchor.destination ?? ""
                    if let slug = MarkdownLinks.authorGlossarySlug(rawDestination: raw) {
                        authorGlossarySlugs.insert(slug)
                    }
                    let destination = raw.isEmpty ? link : MarkdownLinks.normalise(raw)
                    appendInlines(of: anchor, traits: traits, link: destination, into: &spans)
                case let image as Markdown.Image:
                    let source = image.source.map(MarkdownLinks.normalise) ?? ""
                    spans.append(MarkdownSpan(kind: .image(source: source), text: image.plainText, traits: traits, link: link))
                case is LineBreak:
                    spans.append(MarkdownSpan(kind: .lineBreak, text: "\n", traits: traits, link: link))
                case let html as InlineHTML:
                    spans.append(MarkdownSpan(kind: .html, text: html.rawHTML, traits: traits, link: link))
                case let symbol as SymbolLink:
                    spans.append(MarkdownSpan(kind: .code, text: symbol.destination ?? "", traits: traits, link: link))
                default:
                    if child.childCount > 0 {
                        appendInlines(of: child, traits: traits, link: link, into: &spans)
                    } else if let plain = child as? any PlainTextConvertibleMarkup {
                        pending = (pending ?? "") + plain.plainText
                    }
                }
            }
        }
        flush(&spans)
    }
}

// MARK: - GFM autolink literals

/// `https://...`, `http://...` and `www....` in running text become links, as
/// remark-gfm does. Trailing punctuation and unbalanced `)` stay outside.
enum Autolinks {
    static func apply(to spans: [MarkdownSpan]) -> [MarkdownSpan] {
        guard spans.contains(where: { $0.kind == .text && $0.link == nil && mightContainLink($0.text) }) else {
            return spans
        }
        var out: [MarkdownSpan] = []
        for span in spans {
            guard span.kind == .text, span.link == nil, mightContainLink(span.text) else {
                out.append(span)
                continue
            }
            out.append(contentsOf: split(span))
        }
        return out
    }

    private static func mightContainLink(_ text: String) -> Bool {
        text.contains("http://") || text.contains("https://") || text.contains("www.")
    }

    private static func split(_ span: MarkdownSpan) -> [MarkdownSpan] {
        let chars = Array(span.text.unicodeScalars)
        var out: [MarkdownSpan] = []
        var plainStart = 0
        var i = 0

        func emitPlain(upTo end: Int) {
            if end > plainStart {
                var plain = span
                plain.text = String(String.UnicodeScalarView(chars[plainStart..<end]))
                out.append(plain)
            }
        }

        while i < chars.count {
            let prefix: String?
            if hasPrefix(chars, i, "https://") { prefix = "https://" }
            else if hasPrefix(chars, i, "http://") { prefix = "http://" }
            else if hasPrefix(chars, i, "www.") { prefix = "www." }
            else { prefix = nil }

            guard let prefix, isValidStart(chars, i) else {
                i += 1
                continue
            }
            var end = i + prefix.unicodeScalars.count
            while end < chars.count, !chars[end].properties.isWhitespace, chars[end] != "<" {
                end += 1
            }
            end = trimTrailing(chars, from: i, to: end)
            let domainStart = i + prefix.unicodeScalars.count
            guard end > domainStart, hasValidDomain(chars, domainStart, end) else {
                i += 1
                continue
            }
            emitPlain(upTo: i)
            let text = String(String.UnicodeScalarView(chars[i..<end]))
            var linkSpan = span
            linkSpan.text = text
            linkSpan.link = MarkdownLinks.normalise(prefix == "www." ? "http://\(text)" : text)
            out.append(linkSpan)
            plainStart = end
            i = end
        }
        emitPlain(upTo: chars.count)
        return out
    }

    private static func hasPrefix(_ chars: [Unicode.Scalar], _ i: Int, _ prefix: String) -> Bool {
        let p = Array(prefix.unicodeScalars)
        guard i + p.count <= chars.count else { return false }
        for (offset, scalar) in p.enumerated() {
            let c = chars[i + offset]
            let lowered = (c >= "A" && c <= "Z") ? Unicode.Scalar(c.value + 32)! : c
            if lowered != scalar { return false }
        }
        return true
    }

    /// GFM: at the start, after whitespace, or after `*`, `_`, `~`, `(`.
    private static func isValidStart(_ chars: [Unicode.Scalar], _ i: Int) -> Bool {
        guard i > 0 else { return true }
        let before = chars[i - 1]
        return before.properties.isWhitespace || "*_~(".unicodeScalars.contains(before)
    }

    private static func hasValidDomain(_ chars: [Unicode.Scalar], _ start: Int, _ end: Int) -> Bool {
        var domainEnd = start
        while domainEnd < end, chars[domainEnd] != "/", chars[domainEnd] != "?", chars[domainEnd] != "#" {
            domainEnd += 1
        }
        guard domainEnd > start else { return false }
        let domain = chars[start..<domainEnd]
        return domain.allSatisfy { $0.properties.isAlphabetic || ("0"..."9").contains($0) || "-_.:".unicodeScalars.contains($0) }
    }

    private static func trimTrailing(_ chars: [Unicode.Scalar], from start: Int, to end: Int) -> Int {
        var end = end
        while end > start {
            let last = chars[end - 1]
            if "?!.,:*_~'\"".unicodeScalars.contains(last) {
                end -= 1
                continue
            }
            if last == ")" {
                let slice = chars[start..<end]
                let open = slice.filter { $0 == "(" }.count
                let close = slice.filter { $0 == ")" }.count
                if close > open {
                    end -= 1
                    continue
                }
            }
            break
        }
        return end
    }
}

// MARK: - Callout labels

/// Pulls a short label ("Critical warning:") out of a callout's first line so
/// the box can print it as its slug. Runs after glossary linking, which never
/// touches block quotes, so it cannot disturb the site's link placement.
enum CalloutLabels {
    static let maxLabelLength = 48

    static func extract(_ block: MarkdownBlock) -> MarkdownBlock {
        var block = block
        switch block.kind {
        case .callout(_, var blocks):
            var label: String?
            if var first = blocks.first, case .paragraph(var content) = first.kind,
               let lead = content.spans.first, lead.kind == .text, lead.traits.contains(.bold), lead.link == nil {
                // The whole bold run, which may span several spans (bold + bold italic).
                var leadText = ""
                var leadCount = 0
                for span in content.spans {
                    guard span.kind == .text, span.traits.contains(.bold), span.link == nil else { break }
                    leadText += span.text
                    leadCount += 1
                }
                let trimmed = leadText.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.hasSuffix(":"), trimmed.count <= maxLabelLength {
                    label = String(trimmed.dropLast()).trimmingCharacters(in: .whitespaces)
                    content.spans.removeFirst(leadCount)
                    if var next = content.spans.first, next.kind == .text {
                        next.text = String(next.text.drop(while: { $0 == " " || $0 == "\n" }))
                        if next.text.isEmpty {
                            content.spans.removeFirst()
                        } else {
                            content.spans[0] = next
                        }
                    }
                    if content.spans.isEmpty {
                        blocks.removeFirst()
                    } else {
                        first.kind = .paragraph(content)
                        blocks[0] = first
                    }
                }
            }
            block.kind = .callout(label: label, blocks: blocks.map(extract))
        case .quote(let blocks):
            block.kind = .quote(blocks.map(extract))
        case .list(var list):
            for index in list.items.indices {
                list.items[index].blocks = list.items[index].blocks.map(extract)
            }
            block.kind = .list(list)
        default:
            break
        }
        return block
    }
}

// MARK: - Plain text

enum PlainText {
    static func of(_ block: MarkdownBlock) -> String {
        switch block.kind {
        case .heading(_, let content, _), .paragraph(let content):
            return content.plainText
        case .image(_, let alt):
            return alt
        case .list(let list):
            return list.items.enumerated().map { index, item in
                let marker = list.ordered ? "\(list.start + index). " : "- "
                return marker + item.blocks.map(of).joined(separator: "\n")
            }.joined(separator: "\n")
        case .quote(let blocks):
            return blocks.map(of).joined(separator: "\n")
        case .callout(let label, let blocks):
            let body = blocks.map(of).joined(separator: "\n")
            return label.map { "\($0): \(body)" } ?? body
        case .code(let code):
            return code.code
        case .table(let table):
            let head = table.header.map(\.plainText).joined(separator: ", ")
            let rows = table.rows.map { $0.map(\.plainText).joined(separator: ", ") }
            return ([head] + rows).joined(separator: "\n")
        case .rule:
            return ""
        }
    }
}
