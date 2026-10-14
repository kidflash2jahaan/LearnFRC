import AppIntents
import CoreSpotlight
import CryptoKit
import Foundation
import UniformTypeIdentifiers

/// Puts every lesson, glossary term and article in Spotlight, so "swerve offsets" or
/// "brownout" from the Home Screen (or Mac Spotlight) lands on the right screen.
///
/// - Lessons and glossary terms are `IndexedEntity` items, so Spotlight, Siri and Shortcuts
///   share one identity for them; tapping one runs `OpenLessonIntent` / `OpenGlossaryTermIntent`.
/// - Articles are plain items whose identifier is their `learnfrc://article/<slug>` link.
/// - Any tapped item that comes back as a `CSSearchableItemActionType` activity instead is
///   routed by `DeepLink.spotlight(identifier:)` (see `SystemServices`).
///
/// Indexing only happens when the content changed (a fingerprint per kind) or the last pass
/// is over a week old, so launches stay cheap. Nothing is removed while the catalog is empty
/// (offline first launch), so a bad network day can't wipe the index.
@MainActor
final class SpotlightIndexer {
    static let shared = SpotlightIndexer()

    /// The last time anything was written to the index.
    private(set) var lastIndexed: Date?

    private let defaults: UserDefaults
    private var running: Task<Void, Never>?
    private var pendingAgain = false

    /// Re-index at least this often even when nothing changed (items also carry no expiry,
    /// this is belt and braces against a reset index).
    private static let refreshInterval: TimeInterval = 7 * 24 * 60 * 60
    nonisolated static let articleDomain = "com.learnfrc.articles"

    private enum Key {
        static let lessons = "spotlight.fingerprint.lessons"
        static let glossary = "spotlight.fingerprint.glossary"
        static let articles = "spotlight.fingerprint.articles"
        static let lessonIDs = "spotlight.ids.lessons"
        static let glossaryIDs = "spotlight.ids.glossary"
        static let articleIDs = "spotlight.ids.articles"
        static let indexedAt = "spotlight.indexedAt"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        lastIndexed = defaults.object(forKey: Key.indexedAt) as? Date
    }

    /// Whether this device's Spotlight accepts items at all.
    nonisolated static var isAvailable: Bool { CSSearchableIndex.isIndexingAvailable() }

    // MARK: Updating

    /// Brings the index in line with the catalog and glossary. Cheap when nothing changed.
    /// Safe to call often (launch, after a refresh, from several windows): calls coalesce.
    func update(catalog: CatalogStore, reference: ReferenceStore, force: Bool = false) async {
        guard Self.isAvailable, !AppConfig.isRunningPreviews else { return }
        if let running {
            pendingAgain = true
            await running.value
            return
        }
        let snapshot = Snapshot(catalog: catalog, reference: reference)
        let task = Task { await self.apply(snapshot, force: force) }
        running = task
        await task.value
        running = nil
        if pendingAgain {
            pendingAgain = false
            await update(catalog: catalog, reference: reference, force: false)
        }
    }

    /// Removes everything LearnFRC put in Spotlight (for example from a "reset" setting).
    func removeAll() async {
        guard Self.isAvailable else { return }
        do {
            try await Self.removeEverything()
            for key in [Key.lessons, Key.glossary, Key.articles, Key.lessonIDs, Key.glossaryIDs, Key.articleIDs, Key.indexedAt] {
                defaults.removeObject(forKey: key)
            }
            lastIndexed = nil
            Log.data.info("Spotlight: removed all items")
        } catch {
            Log.data.error("Spotlight: couldn't clear the index: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: Internals

    /// Everything to index, captured on the main actor as plain values.
    private struct Snapshot: Sendable {
        let lessons: [LessonEntity]
        let terms: [GlossaryTermEntity]
        let articles: [ArticleRecord]

        @MainActor
        init(catalog: CatalogStore, reference: ReferenceStore) {
            lessons = catalog.allLessons.map(LessonEntity.init)
            terms = reference.glossary.map(GlossaryTermEntity.init)
            articles = catalog.articles.map(ArticleRecord.init)
        }
    }

    /// The parts of an article Spotlight needs.
    struct ArticleRecord: Sendable, Hashable {
        let slug: String
        let title: String
        let summary: String
        let keywords: [String]
        let readMins: Int

        init(_ article: Article) {
            slug = article.slug
            title = article.title
            summary = article.description
            keywords = article.keywords
            readMins = article.readMins
        }

        var identifier: String { AppRoute.article(slug).deepLinkURL.absoluteString }
    }

    private func apply(_ snapshot: Snapshot, force: Bool) async {
        let stale = force || (lastIndexed.map { Date.now.timeIntervalSince($0) > Self.refreshInterval } ?? true)
        var wrote = false

        // Lessons
        if !snapshot.lessons.isEmpty {
            let digest = Self.fingerprint(snapshot.lessons.map {
                "\($0.id)|\($0.title)|\($0.departmentName)|\($0.moduleTitle)|\($0.minutes)|\($0.summary)"
            })
            if stale || defaults.string(forKey: Key.lessons) != digest {
                let ids = snapshot.lessons.map { $0.id.uuidString }
                let removed = removedIDs(previous: Key.lessonIDs, current: ids).compactMap(UUID.init(uuidString:))
                do {
                    try await Self.index(lessons: snapshot.lessons, removing: removed)
                    defaults.set(digest, forKey: Key.lessons)
                    defaults.set(ids, forKey: Key.lessonIDs)
                    wrote = true
                    Log.data.info("Spotlight: indexed \(snapshot.lessons.count) lessons, removed \(removed.count)")
                } catch {
                    Log.data.error("Spotlight: lessons failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }

        // Glossary
        if !snapshot.terms.isEmpty {
            let digest = Self.fingerprint(snapshot.terms.map {
                "\($0.id)|\($0.term)|\($0.abbreviation ?? "")|\($0.category)|\($0.definition)|\($0.alsoCalled.joined(separator: ","))"
            })
            if stale || defaults.string(forKey: Key.glossary) != digest {
                let ids = snapshot.terms.map(\.id)
                let removed = removedIDs(previous: Key.glossaryIDs, current: ids)
                do {
                    try await Self.index(terms: snapshot.terms, removing: removed)
                    defaults.set(digest, forKey: Key.glossary)
                    defaults.set(ids, forKey: Key.glossaryIDs)
                    wrote = true
                    Log.data.info("Spotlight: indexed \(snapshot.terms.count) glossary terms, removed \(removed.count)")
                } catch {
                    Log.data.error("Spotlight: glossary failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }

        // Articles
        if !snapshot.articles.isEmpty {
            let digest = Self.fingerprint(snapshot.articles.map {
                "\($0.slug)|\($0.title)|\($0.summary)|\($0.keywords.joined(separator: ","))|\($0.readMins)"
            })
            if stale || defaults.string(forKey: Key.articles) != digest {
                let ids = snapshot.articles.map(\.identifier)
                let removed = removedIDs(previous: Key.articleIDs, current: ids)
                do {
                    try await Self.index(articles: snapshot.articles, removing: removed)
                    defaults.set(digest, forKey: Key.articles)
                    defaults.set(ids, forKey: Key.articleIDs)
                    wrote = true
                    Log.data.info("Spotlight: indexed \(snapshot.articles.count) articles, removed \(removed.count)")
                } catch {
                    Log.data.error("Spotlight: articles failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }

        if wrote {
            lastIndexed = .now
            defaults.set(lastIndexed, forKey: Key.indexedAt)
        }
    }

    private func removedIDs(previous key: String, current: [String]) -> [String] {
        let before = defaults.stringArray(forKey: key) ?? []
        let now = Set(current)
        return before.filter { !now.contains($0) }
    }

    /// A stable digest (Swift's `Hasher` is seeded per launch, so it can't be stored).
    nonisolated static func fingerprint(_ rows: [String]) -> String {
        var hasher = SHA256()
        for row in rows {
            hasher.update(data: Data(row.utf8))
            hasher.update(data: Data([0x0A]))
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    // MARK: Talking to Spotlight (off the main actor)

    private nonisolated static func index(lessons: [LessonEntity], removing removed: [UUID]) async throws {
        let index = CSSearchableIndex.default()
        if !removed.isEmpty {
            try await index.deleteAppEntities(identifiedBy: removed, ofType: LessonEntity.self)
        }
        let items = lessons.map { lesson in
            let item = CSSearchableItem(appEntity: lesson, priority: 0)
            item.expirationDate = .distantFuture
            return item
        }
        for batch in items.chunked(into: 200) {
            try await index.indexSearchableItems(batch)
        }
    }

    private nonisolated static func index(terms: [GlossaryTermEntity], removing removed: [String]) async throws {
        let index = CSSearchableIndex.default()
        if !removed.isEmpty {
            try await index.deleteAppEntities(identifiedBy: removed, ofType: GlossaryTermEntity.self)
        }
        let items = terms.map { term in
            let item = CSSearchableItem(appEntity: term, priority: 0)
            item.expirationDate = .distantFuture
            return item
        }
        for batch in items.chunked(into: 200) {
            try await index.indexSearchableItems(batch)
        }
    }

    private nonisolated static func index(articles: [ArticleRecord], removing removed: [String]) async throws {
        let index = CSSearchableIndex.default()
        if !removed.isEmpty {
            try await index.deleteSearchableItems(withIdentifiers: removed)
        }
        let items = articles.map { article -> CSSearchableItem in
            let set = CSSearchableItemAttributeSet(contentType: .text)
            set.title = article.title
            set.displayName = article.title
            let minutes = article.readMins == 1 ? "1 min read" : "\(max(1, article.readMins)) min read"
            set.contentDescription = article.summary.isEmpty ? minutes : "\(article.summary) \(minutes)."
            set.containerTitle = "LearnFRC Blog"
            set.containerDisplayName = "LearnFRC Blog"
            var seen = Set<String>()
            set.keywords = (article.keywords + ["FRC", "article"]).filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
            let item = CSSearchableItem(uniqueIdentifier: article.identifier, domainIdentifier: articleDomain, attributeSet: set)
            item.expirationDate = .distantFuture
            return item
        }
        for batch in items.chunked(into: 200) {
            try await index.indexSearchableItems(batch)
        }
    }

    private nonisolated static func removeEverything() async throws {
        let index = CSSearchableIndex.default()
        try await index.deleteAppEntities(ofType: LessonEntity.self)
        try await index.deleteAppEntities(ofType: GlossaryTermEntity.self)
        try await index.deleteSearchableItems(withDomainIdentifiers: [articleDomain])
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0, count > size else { return isEmpty ? [] : [self] }
        return stride(from: 0, to: count, by: size).map { Array(self[$0..<Swift.min($0 + size, count)]) }
    }
}
