import Foundation
import Observation

/// The catalog: departments, modules, lessons (summaries and bodies), articles
/// and the achievement list. Read from Supabase, cached on device, refreshed
/// on launch when older than six hours and on pull to refresh.
@Observable
@MainActor
final class CatalogStore {
    /// Sorted by `sortOrder`; modules prerequisite-first; lessons by `sortOrder`.
    private(set) var departments: [Department] = []
    /// Newest first.
    private(set) var articles: [Article] = []
    private(set) var achievements: [Achievement] = []
    /// True once there's a catalog to show (from cache or the network).
    private(set) var isLoaded = false
    /// True once every lesson body is on device (reading works offline).
    private(set) var lessonBodiesLoaded = false
    private(set) var isRefreshing = false
    /// When the catalog was last fetched from Supabase.
    private(set) var lastUpdated: Date?
    /// The last refresh failure, worded for people. nil after a good refresh.
    private(set) var lastError: APIError?

    @ObservationIgnored private var bodies: [UUID: LessonBody] = [:]
    private var locations: [UUID: LessonLocation] = [:]
    private var orderedLessonIDs: [UUID: [UUID]] = [:]
    private var lessonIndexInDepartment: [UUID: Int] = [:]
    private var departmentsByID: [UUID: Department] = [:]
    private var modulesByID: [UUID: (Module, Department)] = [:]
    private var articlesBySlug: [String: Article] = [:]
    @ObservationIgnored private var bodyFetches: [UUID: Task<LessonBody?, Never>] = [:]
    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    /// The cache read in flight: a lesson opened on a cold launch waits for it instead of
    /// fetching its body over the network.
    @ObservationIgnored private var cacheTask: Task<Void, Never>?
    /// Bumped whenever bodies change, so views that read `lessonBody(_:)` update.
    private var bodiesVersion = 0

    @ObservationIgnored private let supabase: SupabaseService?
    @ObservationIgnored private let cache: CacheStore

    struct CatalogFile: Codable, Sendable {
        let departments: [Department]
        let achievements: [Achievement]
    }

    init(supabase: SupabaseService? = .shared, cache: CacheStore = .shared) {
        self.supabase = supabase
        self.cache = cache
    }

    // MARK: Lookups

    /// Every lesson, in course order across departments.
    private(set) var allLessons: [LessonLocation] = []

    func lessonBody(_ id: UUID) -> LessonBody? {
        _ = bodiesVersion
        return bodies[id]
    }

    func location(of lessonID: UUID) -> LessonLocation? { locations[lessonID] }

    func department(id: UUID) -> Department? { departmentsByID[id] }
    func department(slug: String) -> Department? { departments.first { $0.slug == slug } }
    func module(id: UUID) -> Module? { modulesByID[id]?.0 }
    func department(ofModule moduleID: UUID) -> Department? { modulesByID[moduleID]?.1 }
    func article(slug: String) -> Article? { articlesBySlug[slug] }
    func achievement(slug: String) -> Achievement? { achievements.first { $0.slug == slug } }
    func achievement(id: UUID) -> Achievement? { achievements.first { $0.id == id } }

    /// Lessons of one department in course order.
    func lessons(in department: Department) -> [LessonLocation] {
        (orderedLessonIDs[department.id] ?? []).compactMap { locations[$0] }
    }

    /// Lessons of one module in order.
    func lessons(in module: Module) -> [LessonLocation] {
        module.lessons.compactMap { locations[$0.id] }
    }

    /// The next lesson in the same department's course order (crossing modules), or nil at the end.
    func nextLesson(after lessonID: UUID) -> LessonLocation? {
        guard let location = locations[lessonID], let ids = orderedLessonIDs[location.department.id],
              let index = lessonIndexInDepartment[lessonID], index + 1 < ids.count else { return nil }
        return locations[ids[index + 1]]
    }

    /// The previous lesson in the same department's course order, or nil at the start.
    func previousLesson(before lessonID: UUID) -> LessonLocation? {
        guard let location = locations[lessonID], let ids = orderedLessonIDs[location.department.id],
              let index = lessonIndexInDepartment[lessonID], index > 0 else { return nil }
        return locations[ids[index - 1]]
    }

    /// 1-based position of a lesson in its department ("Lesson 4 of 28").
    func position(of lessonID: UUID) -> (index: Int, total: Int)? {
        guard let location = locations[lessonID], let index = lessonIndexInDepartment[lessonID] else { return nil }
        return (index + 1, orderedLessonIDs[location.department.id]?.count ?? 0)
    }

    /// Lessons with a video, in course order (the Videos library).
    var videoLessons: [LessonLocation] { allLessons.filter { $0.lesson.youtubeID != nil } }

    /// The first lesson of Getting Started (or of the first department).
    var firstLesson: LessonLocation? {
        let start = department(slug: "getting-started") ?? departments.first
        return start.flatMap { lessons(in: $0).first }
    }

    /// Articles that share a keyword or title words with this one (the site's "related" idea, simplified).
    func relatedArticles(to article: Article, limit: Int = 3) -> [Article] {
        let tokens = Self.tokens(article.title + " " + article.keywords.joined(separator: " "))
        return articles
            .filter { $0.id != article.id }
            .map { ($0, Self.tokens($0.title + " " + $0.keywords.joined(separator: " ")).intersection(tokens).count) }
            .filter { $0.1 > 1 }
            .sorted { $0.1 > $1.1 }
            .prefix(limit)
            .map(\.0)
    }

    private static func tokens(_ text: String) -> Set<String> {
        Set(text.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init).filter { $0.count > 3 })
    }

    // MARK: Web links into the app

    /// Maps a learnfrc.com link (or a site path like `/guides/a/b/c`, or a `learnfrc://` link) to a route.
    /// Used by the Markdown renderer, Handoff and universal links. nil means "open in the browser".
    func route(for url: URL) -> AppRoute? {
        if url.scheme?.lowercased() == AppConfig.urlScheme { return AppRoute(deepLink: url) }
        if let host = url.host()?.lowercased(), !["learnfrc.com", "www.learnfrc.com"].contains(host) { return nil }
        if url.scheme != nil, !["http", "https"].contains(url.scheme?.lowercased() ?? "") { return nil }
        return route(forPath: url.path(percentEncoded: false))
    }

    /// Maps a site path (`/guides/...`, `/blog/...`, `/glossary/...`, `/u/...`, `/paths/...`).
    func route(forPath path: String) -> AppRoute? {
        let parts = path.split(separator: "/").map { String($0).removingPercentEncoding ?? String($0) }
        guard let first = parts.first?.lowercased() else { return nil }
        switch first {
        case "guides":
            guard parts.count >= 2, let dept = department(slug: parts[1]) else { return nil }
            if parts.count == 2 { return .department(dept.id) }
            guard let module = dept.modules.first(where: { $0.slug == parts[2] }) else { return .department(dept.id) }
            if parts.count == 3 { return .module(module.id) }
            guard let lesson = module.lessons.first(where: { $0.slug == parts[3] }) else { return .module(module.id) }
            return .lesson(lesson.id)
        case "blog":
            return parts.count >= 2 ? .article(parts[1]) : nil
        case "glossary":
            // No slug: the catalogue (`AppRoute.glossaryIndex`).
            return .glossaryTerm(parts.count >= 2 ? parts[1] : "")
        case "paths":
            return parts.count >= 2 ? .path(parts[1]) : nil
        case "u":
            return parts.count >= 2 ? .profile(parts[1]) : nil
        case "certificate":
            return parts.count >= 2 ? department(slug: parts[1]).map { .certificate($0.id) } : nil
        case "leaderboard": return .leaderboard
        case "teams": return .team
        case "settings": return .settings
        case "videos": return .videos
        default: return nil
        }
    }

    // MARK: Loading

    /// Loads whatever is cached. No network. The three files decode side by side, and the
    /// small catalog file is applied the moment it's read, so links, lesson headers and the
    /// guides resolve while the lesson bodies (about 2 MB) are still decoding.
    /// Never replaces anything a network refresh already delivered.
    func loadCache() async {
        if let cacheTask {
            await cacheTask.value
            return
        }
        let task = Task { await self.performCacheLoad() }
        cacheTask = task
        await task.value
    }

    private func performCacheLoad() async {
        async let catalogFile = cache.load(CatalogFile.self, from: .catalog)
        async let lessonFile = cache.load([LessonBody].self, from: .lessons)
        async let articleFile = cache.load([Article].self, from: .articles)

        if let catalog = await catalogFile, !catalog.value.departments.isEmpty, lastUpdated == nil {
            apply(departments: catalog.value.departments, achievements: catalog.value.achievements)
            lastUpdated = catalog.fetchedAt
        }
        if let lessons = await lessonFile, !lessons.value.isEmpty, !lessonBodiesLoaded {
            // Keep any single body fetched while the file was decoding.
            let fetched = bodies
            apply(bodies: lessons.value, complete: true)
            if !fetched.isEmpty {
                for (id, body) in fetched { bodies[id] = body }
                bodiesVersion &+= 1
            }
        }
        if let articles = await articleFile, self.articles.isEmpty {
            apply(articles: articles.value)
        }
    }

    /// True when the catalog is missing or older than six hours.
    var isStale: Bool {
        guard isLoaded, lessonBodiesLoaded, let lastUpdated else { return true }
        return Date.now.timeIntervalSince(lastUpdated) > AppConfig.catalogMaxAge
    }

    /// Refreshes only when stale (launch and foreground).
    func refreshIfStale() async {
        if isStale { await refresh() }
    }

    /// Fetches the whole catalog, lesson bodies, articles and achievements. Keeps
    /// the cached copy when anything fails.
    func refresh() async {
        // A second caller (pull to refresh during the launch refresh) waits for the first.
        if let inFlight = refreshTask {
            await inFlight.value
            return
        }
        guard supabase != nil else { return }
        let task = Task { await self.performRefresh() }
        refreshTask = task
        await task.value
        refreshTask = nil
    }

    private func performRefresh() async {
        guard let supabase else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        async let catalogResult = Self.capture { try await supabase.catalog() }
        async let achievementResult = Self.capture { try await supabase.achievements() }
        async let articleResult = Self.capture { try await supabase.articles() }
        async let bodyResult = Self.capture { try await supabase.lessonBodies() }
        let (catalog, achievementList, articleList, bodyList) = await (catalogResult, achievementResult, articleResult, bodyResult)

        var firstError: APIError?
        let now = Date.now

        switch (catalog, achievementList) {
        case (.success(let departments), .success(let achievements)) where !departments.isEmpty:
            apply(departments: departments, achievements: achievements)
            lastUpdated = now
            await cache.save(CatalogFile(departments: departments, achievements: achievements), to: .catalog, fetchedAt: now)
        case (.success(let departments), .failure(let error)) where !departments.isEmpty:
            apply(departments: departments)
            lastUpdated = now
            firstError = error
            await cache.save(CatalogFile(departments: departments, achievements: self.achievements), to: .catalog, fetchedAt: now)
        case (.failure(let error), _):
            firstError = error
        default:
            firstError = firstError ?? .server
        }

        switch articleList {
        case .success(let list) where !list.isEmpty:
            apply(articles: list)
            await cache.save(list, to: .articles, fetchedAt: now)
        case .failure(let error): firstError = firstError ?? error
        default: break
        }

        switch bodyList {
        case .success(let list) where !list.isEmpty:
            apply(bodies: list, complete: true)
            await cache.save(list, to: .lessons, fetchedAt: now)
        case .failure(let error): firstError = firstError ?? error
        default: break
        }

        lastError = firstError
        if let firstError {
            Log.sync.info("Catalog refresh kept the cached copy: \(firstError.message, privacy: .public)")
        } else {
            Log.sync.info("Catalog refreshed: \(self.departments.count) departments, \(self.allLessons.count) lessons, \(self.articles.count) articles")
        }
    }

    /// A lesson body, fetching just that lesson when the full set isn't on device yet.
    func fetchLessonBody(_ id: UUID) async -> LessonBody? {
        if let body = bodies[id] { return body }
        // On a cold launch the cached bodies are usually a moment away.
        if let cacheTask {
            await cacheTask.value
            if let body = bodies[id] { return body }
        }
        guard let supabase else { return nil }
        if let running = bodyFetches[id] { return await running.value }
        let task = Task<LessonBody?, Never> {
            try? await supabase.lessonBody(id: id)
        }
        bodyFetches[id] = task
        let body = await task.value
        bodyFetches[id] = nil
        if let body {
            bodies[id] = body
            bodiesVersion &+= 1
        }
        return body
    }

    // MARK: Applying data

    /// Replaces the catalog and rebuilds the indexes. Also used by previews.
    func apply(departments newDepartments: [Department], achievements newAchievements: [Achievement]? = nil) {
        departments = newDepartments.sorted { $0.sortOrder < $1.sortOrder }
        if let newAchievements { achievements = newAchievements.sorted { $0.sortOrder < $1.sortOrder } }

        var locations: [UUID: LessonLocation] = [:]
        var ordered: [UUID: [UUID]] = [:]
        var indexes: [UUID: Int] = [:]
        var byID: [UUID: Department] = [:]
        var modules: [UUID: (Module, Department)] = [:]
        var all: [LessonLocation] = []
        for department in departments {
            byID[department.id] = department
            var ids: [UUID] = []
            for module in department.modules {
                modules[module.id] = (module, department)
                for lesson in module.lessons {
                    let location = LessonLocation(department: department, module: module, lesson: lesson)
                    locations[lesson.id] = location
                    indexes[lesson.id] = ids.count
                    ids.append(lesson.id)
                    all.append(location)
                }
            }
            ordered[department.id] = ids
        }
        self.locations = locations
        self.orderedLessonIDs = ordered
        self.lessonIndexInDepartment = indexes
        self.departmentsByID = byID
        self.modulesByID = modules
        self.allLessons = all
        isLoaded = !departments.isEmpty
    }

    func apply(articles newArticles: [Article]) {
        articles = Article.sortedLikeSite(newArticles)
        articlesBySlug = Dictionary(articles.map { ($0.slug, $0) }, uniquingKeysWith: { first, _ in first })
    }

    func apply(bodies newBodies: [LessonBody], complete: Bool) {
        if complete {
            bodies = Dictionary(newBodies.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        } else {
            for body in newBodies { bodies[body.id] = body }
        }
        lessonBodiesLoaded = complete || lessonBodiesLoaded
        bodiesVersion &+= 1
    }

    nonisolated private static func capture<T: Sendable>(_ work: @Sendable () async throws -> T) async -> Result<T, APIError> {
        do { return .success(try await work()) } catch { return .failure(APIError.from(error)) }
    }
}
