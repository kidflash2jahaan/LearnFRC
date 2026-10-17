import Foundation
import Observation

/// learnfrc.com/resources as data (`GET /api/app/resources`), kept on this device the way
/// the reference data is: read from the cache first, refreshed when older than the
/// catalogue's six hours, and the last good copy kept when a refresh fails or comes back
/// empty, so the page works offline once it has loaded once.
///
/// One store for every window (`shared`). Views read it with
/// `@Environment(ResourcesStore.self) private var injected: ResourcesStore?` and fall back
/// to `shared`, so previews can hand in a store of their own.
@Observable
@MainActor
final class ResourcesStore {
    static let shared = ResourcesStore()

    private(set) var page: ResourcesPage?
    private(set) var isRefreshing = false
    private(set) var lastUpdated: Date?
    private(set) var lastError: APIError?
    /// The cache has been read (whether or not it held anything).
    private(set) var isCacheLoaded = false

    var isLoaded: Bool { page != nil }

    @ObservationIgnored private let api: APIClient?
    @ObservationIgnored private let cache: CacheStore?
    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    @ObservationIgnored private var cacheTask: Task<Void, Never>?

    init(api: APIClient? = .shared, cache: CacheStore = .shared, persists: Bool = !AppConfig.isRunningPreviews) {
        self.api = persists ? api : nil
        self.cache = persists ? cache : nil
    }

    /// True when there's nothing yet, or the copy is older than the catalogue's refresh age.
    var isStale: Bool {
        guard page != nil, let lastUpdated else { return true }
        return Date.now.timeIntervalSince(lastUpdated) > AppConfig.catalogMaxAge
    }

    /// Reads the on-device copy once (no network). Safe to call from every screen that shows it.
    func loadCache() async {
        if isCacheLoaded { return }
        if let cacheTask {
            await cacheTask.value
            return
        }
        let task = Task { await self.performCacheLoad() }
        cacheTask = task
        await task.value
    }

    /// The cache, then the network when the copy is stale.
    func load() async {
        await loadCache()
        if isStale { await refresh() }
    }

    /// Fetches the page now (pull to refresh, "Try again"). One request at a time.
    func refresh() async {
        if let refreshTask {
            await refreshTask.value
            return
        }
        guard api != nil else { return }
        let task = Task { await self.performRefresh() }
        refreshTask = task
        await task.value
        refreshTask = nil
    }

    // MARK: Private

    private func performCacheLoad() async {
        defer { isCacheLoaded = true }
        guard let cache, let cached = await cache.load(ResourcesPage.self, from: .resources), page == nil else { return }
        page = cached.value
        lastUpdated = cached.fetchedAt
    }

    private func performRefresh() async {
        guard let api else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            let fresh = try await api.resourcesPage()
            guard !fresh.isEmpty else {
                Log.sync.error("Resources came back empty; keeping the cached copy")
                lastError = .server
                return
            }
            page = fresh
            lastUpdated = .now
            lastError = nil
            await cache?.save(fresh, to: .resources)
        } catch {
            lastError = APIError.from(error)
            Log.sync.info("Resources refresh kept the cached copy: \(APIError.from(error).message, privacy: .public)")
        }
    }

    // MARK: Previews

    /// A store holding `page`, for previews. Never touches the disk or network.
    static func preview(_ page: ResourcesPage?, error: APIError? = nil, refreshing: Bool = false) -> ResourcesStore {
        let store = ResourcesStore(persists: false)
        store.page = page
        store.lastUpdated = page == nil ? nil : .now
        store.lastError = error
        store.isRefreshing = refreshing
        store.isCacheLoaded = true
        return store
    }
}
