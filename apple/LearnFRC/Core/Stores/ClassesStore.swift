import Foundation
import Observation

/// Live classes (`GET /api/app/classes`): the list the Home card, the classes screen and "Teach
/// a live class" read. The site decides everything: whether classes are open (`visible`), who
/// teaches what, and which rows a signed-in account doesn't see because of a block.
///
/// Memory only, never written to disk: signed in, the rows name teachers and say which classes
/// this account has a seat in, and a class list goes out of date within minutes anyway. The
/// copy belongs to one account (or to nobody, signed out): another account, or signing out,
/// drops it before anything else is read (`load(userID:)`).
///
/// One store for every window (`shared`). Views read it with
/// `@Environment(ClassesStore.self) private var injected: ClassesStore?` and fall back to
/// `shared`, so previews can hand in a store of their own.
@Observable
@MainActor
final class ClassesStore {
    static let shared = ClassesStore()

    /// The last list from the site, for `ownerID`. Nil before the first answer.
    private(set) var feed: ClassesFeed?
    private(set) var isLoading = false
    private(set) var lastError: APIError?
    private(set) var fetchedAt: Date?
    /// The account the list was read for; nil signed out.
    private(set) var ownerID: UUID?

    /// True once the site has said classes are open. False before it has answered, so nothing
    /// about classes flashes up and then vanishes.
    var isVisible: Bool { feed?.visible == true }

    @ObservationIgnored private let api: APIClient?
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    /// Bumped by `reset()` and every account change, so a reply for an earlier one is dropped.
    @ObservationIgnored private var generation = 0

    /// A class goes live, fills up or is canceled within minutes, so the list is read again
    /// after two.
    static let maxAge: TimeInterval = 2 * 60

    init(api: APIClient? = .shared) {
        self.api = AppConfig.isRunningPreviews ? nil : api
    }

    /// Follows the signed-in account (nil: signed out). Another account drops the copy first,
    /// then the site is asked; the same account asks again only when the copy is older than
    /// `maxAge` (`force` asks now).
    func load(userID: UUID?, force: Bool = false) async {
        guard api != nil else { return }
        if userID != ownerID {
            reset()
            ownerID = userID
        }
        if !force, let fetchedAt, Date.now.timeIntervalSince(fetchedAt) < Self.maxAge { return }
        await refresh()
    }

    /// Reads the list now (pull to refresh, after a block). One request at a time; a reply
    /// for another account is dropped.
    func refresh() async {
        if let loadTask {
            await loadTask.value
            return
        }
        guard let api else { return }
        let turn = generation
        let signedIn = ownerID != nil
        isLoading = true
        let task = Task { [weak self] in
            do {
                let fresh = try await api.classes(signedIn: signedIn)
                guard let self, self.generation == turn else { return }
                self.feed = fresh
                self.fetchedAt = .now
                self.lastError = nil
            } catch {
                guard let self, self.generation == turn else { return }
                self.lastError = APIError.from(error)
                // A list that can't be read again stays as it was (it's at most minutes old),
                // but never one from before a sign-in or sign-out.
                Log.sync.info("Classes refresh failed: \(APIError.from(error).message, privacy: .public)")
            }
        }
        loadTask = task
        await task.value
        if generation == turn {
            loadTask = nil
            isLoading = false
        }
    }

    /// Forgets the list (sign-out, another account).
    func reset() {
        generation &+= 1
        loadTask?.cancel()
        loadTask = nil
        feed = nil
        fetchedAt = nil
        lastError = nil
        isLoading = false
        ownerID = nil
    }

    /// The rows to show: the site's list minus classes that have ended since it was read and,
    /// at once, classes by anyone this account blocks on this device (`SafetyStore`), before
    /// the site's next answer leaves them off itself.
    func classes(hiding blocked: Set<String>, at now: Date = .now) -> [LiveClass] {
        guard let feed, feed.visible else { return [] }
        return feed.current(at: now).filter { item in
            guard let teacher = item.teacherUsername?.lowercased() else { return true }
            return !blocked.contains(teacher)
        }
    }

    // MARK: Previews

    /// A store holding `feed`, for previews. Never touches the network.
    static func preview(_ feed: ClassesFeed?, error: APIError? = nil, loading: Bool = false) -> ClassesStore {
        let store = ClassesStore(api: nil)
        store.feed = feed
        store.fetchedAt = feed == nil ? nil : .now
        store.lastError = error
        store.isLoading = loading
        return store
    }
}
