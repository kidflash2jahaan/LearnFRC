import Foundation
import Observation

/// Reference data that lives in the site's TypeScript (glossary, learning paths,
/// lesson-to-article links, start goals), from `GET /api/app/reference`, so an
/// edit on the site reaches the app with no release.
@Observable
@MainActor
final class ReferenceStore {
    private(set) var glossary: [GlossaryTerm] = []
    private(set) var glossaryCategories: [String] = []
    private(set) var paths: [LearningPath] = []
    private(set) var startGoals: [StartGoal] = []
    private(set) var version = ""
    private(set) var isLoaded = false
    private(set) var isRefreshing = false
    private(set) var lastUpdated: Date?
    private(set) var lastError: APIError?

    private var lessonBridge: [String: [String]] = [:]
    private var termsBySlug: [String: GlossaryTerm] = [:]
    private var termsByName: [String: GlossaryTerm] = [:]

    @ObservationIgnored private let catalog: CatalogStore
    @ObservationIgnored private let api: APIClient?
    @ObservationIgnored private let cache: CacheStore
    @ObservationIgnored private var refreshTask: Task<Void, Never>?

    init(catalog: CatalogStore, api: APIClient? = .shared, cache: CacheStore = .shared) {
        self.catalog = catalog
        self.api = api
        self.cache = cache
    }

    // MARK: Lookups

    /// Articles worth reading after a lesson (the site's `LESSON_BRIDGE`), in order.
    func relatedArticles(for lessonID: UUID) -> [Article] {
        (lessonBridge[lessonID.uuidString.lowercased()] ?? []).compactMap { catalog.article(slug: $0) }
    }

    func term(slug: String) -> GlossaryTerm? { termsBySlug[slug.lowercased()] }

    /// A term by its exact name (glossary `related` lists use names).
    func term(named name: String) -> GlossaryTerm? { termsByName[name.lowercased()] }

    /// Up to four related terms: the curated ones first, then same-category terms.
    func relatedTerms(for term: GlossaryTerm, limit: Int = 4) -> [GlossaryTerm] {
        var out = term.related.compactMap { self.term(named: $0) }.filter { $0.slug != term.slug }
        if out.count < limit {
            let extra = glossary.filter { $0.category == term.category && $0.slug != term.slug && !out.contains($0) }
            out.append(contentsOf: extra.prefix(limit - out.count))
        }
        return Array(out.prefix(limit))
    }

    /// Terms grouped by category, in the site's category order.
    var termsByCategory: [(category: String, terms: [GlossaryTerm])] {
        let order = glossaryCategories.isEmpty ? Array(Set(glossary.map(\.category))).sorted() : glossaryCategories
        return order.compactMap { category in
            let terms = glossary.filter { $0.category == category }.sorted { $0.term.localizedCaseInsensitiveCompare($1.term) == .orderedAscending }
            return terms.isEmpty ? nil : (category, terms)
        }
    }

    func path(slug: String) -> LearningPath? { paths.first { $0.slug == slug } }
    func startGoal(id: String) -> StartGoal? { startGoals.first { $0.id == id } }

    /// The departments of a path, in step order, skipping any slug the catalog doesn't know.
    func departments(in path: LearningPath) -> [(step: LearningPath.Step, department: Department)] {
        path.steps.compactMap { step in catalog.department(slug: step.deptSlug).map { (step, $0) } }
    }

    /// Lessons a glossary term is taught in, matched the conservative way the site does:
    /// a cue phrase in the lesson title, or at least twice in its summary.
    func lessons(teaching term: GlossaryTerm, limit: Int = 4) -> [LessonLocation] {
        let cues = term.lessonCues.map { $0.lowercased() }.filter { !$0.isEmpty }
        guard !cues.isEmpty else { return [] }
        return catalog.allLessons.filter { location in
            let title = location.lesson.title.lowercased()
            let summary = (location.lesson.summary ?? "").lowercased()
            return cues.contains { cue in
                title.contains(cue) || summary.components(separatedBy: cue).count - 1 >= 2
            }
        }
        .prefix(limit)
        .map { $0 }
    }

    // MARK: Loading

    func loadCache() async {
        guard let cached = await cache.load(Reference.self, from: .reference) else { return }
        apply(cached.value)
        lastUpdated = cached.fetchedAt
    }

    var isStale: Bool {
        guard isLoaded, let lastUpdated else { return true }
        return Date.now.timeIntervalSince(lastUpdated) > AppConfig.catalogMaxAge
    }

    func refreshIfStale() async {
        if isStale { await refresh() }
    }

    func refresh() async {
        if let inFlight = refreshTask {
            await inFlight.value
            return
        }
        guard api != nil else { return }
        let task = Task { await self.performRefresh() }
        refreshTask = task
        await task.value
        refreshTask = nil
    }

    private func performRefresh() async {
        guard let api else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let reference = try await api.reference()
            guard !reference.glossary.isEmpty || !reference.paths.isEmpty else {
                Log.sync.error("Reference came back empty; keeping the cached copy")
                lastError = .server
                return
            }
            apply(reference)
            lastUpdated = .now
            lastError = nil
            await cache.save(reference, to: .reference)
        } catch {
            lastError = APIError.from(error)
            Log.sync.info("Reference refresh kept the cached copy: \(APIError.from(error).message, privacy: .public)")
        }
    }

    /// Replaces everything (also used by previews).
    func apply(_ reference: Reference) {
        glossary = reference.glossary
        glossaryCategories = reference.glossaryCategories
        paths = reference.paths
        startGoals = reference.startGoals
        version = reference.version
        lessonBridge = reference.lessonBridge
        termsBySlug = Dictionary(reference.glossary.map { ($0.slug.lowercased(), $0) }, uniquingKeysWith: { first, _ in first })
        termsByName = Dictionary(reference.glossary.map { ($0.term.lowercased(), $0) }, uniquingKeysWith: { first, _ in first })
        isLoaded = !reference.glossary.isEmpty || !reference.paths.isEmpty
    }
}
