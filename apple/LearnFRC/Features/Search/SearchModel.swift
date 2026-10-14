import Accessibility
import Foundation
import Observation

// MARK: - Reading the stores

extension SearchCorpus {
    @MainActor
    init(catalog: CatalogStore, reference: ReferenceStore) {
        var text: [UUID: String] = [:]
        for location in catalog.allLessons {
            guard let body = catalog.lessonBody(location.id) else { continue }
            let takeaways = body.keyTakeaways.joined(separator: "\n")
            text[location.id] = takeaways.isEmpty ? body.content : body.content + "\n\n" + takeaways
        }
        self.init(departments: catalog.departments, articles: catalog.articles, glossary: reference.glossary, lessonText: text)
    }
}

extension SearchCorpus.Signature {
    @MainActor
    init(catalog: CatalogStore, reference: ReferenceStore) {
        self.init(
            departments: catalog.departments.count,
            lessons: catalog.allLessons.count,
            articles: catalog.articles.count,
            glossary: reference.glossary.count,
            bodiesLoaded: catalog.lessonBodiesLoaded,
            catalogUpdated: catalog.lastUpdated,
            referenceVersion: reference.version,
            firstArticle: catalog.articles.first?.slug
        )
    }
}

// MARK: - The shared index

/// Builds the search index once per catalog version and shares it between windows.
/// `SearchView` prepares it when it appears; the shell can call `prepare` at launch so
/// the first search is instant.
@Observable
@MainActor
final class SearchIndexStore {
    static let shared = SearchIndexStore()

    private(set) var index: SearchIndex?
    private(set) var isBuilding = false
    @ObservationIgnored private var signature: SearchCorpus.Signature?
    @ObservationIgnored private var inFlight: (signature: SearchCorpus.Signature, task: Task<SearchIndex, Never>)?

    /// Builds (or rebuilds) the index if the catalog or glossary changed since the last build.
    /// Safe to call often: it returns at once when nothing changed.
    func prepare(catalog: CatalogStore, reference: ReferenceStore) async {
        let signature = SearchCorpus.Signature(catalog: catalog, reference: reference)
        guard signature != self.signature, !signature.isEmpty else { return }

        if let inFlight, inFlight.signature == signature {
            _ = await inFlight.task.value
            return
        }

        let corpus = SearchCorpus(catalog: catalog, reference: reference)
        if AppConfig.isRunningPreviews {
            // Previews snapshot quickly; the preview catalog is small enough to index inline.
            index = SearchIndex(corpus: corpus)
            self.signature = signature
            return
        }

        isBuilding = true
        let task = Task.detached(priority: .userInitiated) { SearchIndex(corpus: corpus) }
        inFlight = (signature, task)
        let built = await task.value
        // A newer build may have started while this one ran; the newest wins.
        if inFlight?.signature == signature {
            index = built
            self.signature = signature
            inFlight = nil
            isBuilding = false
        }
    }
}

// MARK: - One search screen's state

/// The query, the scope and the results for one `SearchView`. Each keystroke cancels the
/// search in flight and starts another off the main thread; results replace the old ones
/// only when they're for the current text.
@Observable
@MainActor
final class SearchModel {
    var query = ""
    var scope: SearchScope = .all
    private(set) var results: SearchResults = .empty
    /// The query the current results answer (they lag the text by a keystroke at most).
    private(set) var resultsQuery = ""

    @ObservationIgnored private var index: SearchIndex?
    @ObservationIgnored private var task: Task<Void, Never>?

    var trimmedQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    var hasQuery: Bool { !SearchQuery(query).isEmpty }
    var hasIndex: Bool { index != nil }

    /// Results are on screen for the text in the field.
    var isCurrent: Bool { resultsQuery == trimmedQuery }

    func use(_ index: SearchIndex?) {
        guard index !== self.index else { return }
        self.index = index
        run()
    }

    /// Call when `query` changes.
    func queryChanged() {
        run()
    }

    private func run() {
        task?.cancel()
        let text = trimmedQuery
        guard !SearchQuery(text).isEmpty, let index else {
            results = .empty
            resultsQuery = text
            return
        }
        if AppConfig.isRunningPreviews {
            results = index.search(text)
            resultsQuery = text
            return
        }
        task = Task { [weak self] in
            // A short pause so a fast typist doesn't queue a search per letter.
            try? await Task.sleep(for: .milliseconds(45))
            guard !Task.isCancelled else { return }
            let found = await Task.detached(priority: .userInitiated) { index.search(text) }.value
            guard !Task.isCancelled, let self else { return }
            self.results = found
            self.resultsQuery = text
            self.announce(found)
        }
    }

    /// Tells VoiceOver how many results there are, quietly, once typing settles.
    private func announce(_ results: SearchResults) {
        let count = results.total
        var message = AttributedString(count == 0 ? "No results" : (count == 1 ? "1 result" : "\(count) results"))
        message.accessibilitySpeechAnnouncementPriority = .low
        AccessibilityNotification.Announcement(message).post()
    }
}

// MARK: - Recent searches

/// The last few searches, kept on this device only (UserDefaults), newest first.
nonisolated enum SearchRecents {
    static let storageKey = "search.recents"
    static let limit = 8

    static func decode(_ stored: String) -> [String] {
        guard let data = stored.data(using: .utf8),
              let list = try? JSONDecoder().decode([String].self, from: data) else { return [] }
        return list
    }

    static func encode(_ list: [String]) -> String {
        guard let data = try? JSONEncoder().encode(Array(list.prefix(limit))) else { return "[]" }
        return String(decoding: data, as: UTF8.self)
    }

    /// `query` moved to the front, without a case-insensitive duplicate.
    static func adding(_ query: String, to list: [String]) -> [String] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return list }
        var out = list.filter { $0.caseInsensitiveCompare(trimmed) != .orderedSame }
        out.insert(trimmed, at: 0)
        return Array(out.prefix(limit))
    }

    static func removing(_ query: String, from list: [String]) -> [String] {
        list.filter { $0 != query }
    }
}
