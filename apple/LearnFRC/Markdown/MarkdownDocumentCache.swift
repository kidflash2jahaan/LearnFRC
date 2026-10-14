import Foundation
import Synchronization

/// Parsed documents, keyed by content and glossary, so each lesson or article
/// is parsed once. A lesson takes about 2 ms to prepare (10 ms for the longest
/// article); after that, showing it again is a dictionary lookup.
final class MarkdownDocumentCache: Sendable {
    static let shared = MarkdownDocumentCache()

    private struct Key: Hashable, Sendable {
        let markdown: String
        let glossary: Int
    }

    private struct State: Sendable {
        var documents: [Key: MarkdownDocument] = [:]
        var order: [Key] = []
        var tables: [Int: GlossaryLinkTable] = [:]
    }

    /// Enough for a long reading session (lessons are about 2 KB, articles up to 30 KB).
    private let capacity = 64
    private let state = Mutex(State())

    /// The prepared document, parsing it now if it isn't cached yet (or was
    /// styled for another Dynamic Type size and has emphasis that depends on it).
    func document(for markdown: String, glossary: [GlossaryLinkEntry], scale: MarkdownTypeScale = .standard) -> MarkdownDocument {
        let signature = Self.signature(of: glossary)
        let key = Key(markdown: markdown, glossary: signature)
        if let cached = state.withLock({ $0.documents[key] }), cached.fits(scale) {
            return cached
        }
        let table = self.table(for: glossary, signature: signature)
        let document = MarkdownParser.document(from: markdown, glossary: table, scale: scale)
        state.withLock { state in
            if state.documents[key] == nil {
                state.order.append(key)
                if state.order.count > capacity {
                    let evicted = state.order.removeFirst()
                    state.documents[evicted] = nil
                }
            }
            state.documents[key] = document
        }
        return document
    }

    /// True when this document is ready to show without parsing.
    func contains(_ markdown: String, glossary: [GlossaryLinkEntry], scale: MarkdownTypeScale = .standard) -> Bool {
        let key = Key(markdown: markdown, glossary: Self.signature(of: glossary))
        return state.withLock { $0.documents[key]?.fits(scale) ?? false }
    }

    func removeAll() {
        state.withLock { $0 = State() }
    }

    private func table(for glossary: [GlossaryLinkEntry], signature: Int) -> GlossaryLinkTable? {
        guard !glossary.isEmpty else { return nil }
        if let table = state.withLock({ $0.tables[signature] }) { return table }
        let table = GlossaryLinkTable(entries: glossary)
        state.withLock { $0.tables[signature] = table }
        return table
    }

    private static func signature(of glossary: [GlossaryLinkEntry]) -> Int {
        var hasher = Hasher()
        hasher.combine(glossary.count)
        for entry in glossary {
            hasher.combine(entry)
        }
        return hasher.finalize()
    }
}

extension GlossaryLinkEntry {
    init(_ term: GlossaryTerm) {
        self.init(term: term.term, abbr: term.abbr, slug: term.slug)
    }
}
