import Foundation
import Observation
import WidgetKit

/// A guest's completion, kept on this device (and mirrored to the site's guest record).
struct GuestCompletion: Codable, Hashable, Sendable {
    let lessonID: UUID
    /// nil for a lesson restored from the site's guest record (it doesn't send dates).
    let completedAt: Date?
}

/// Everything `progress.json` holds.
struct StoredProgress: Codable, Hashable, Sendable {
    /// Whose `account` snapshot this is.
    var accountUserID: UUID?
    /// The last `/api/app/me/progress` (updated in place after each confirmed write).
    var account: ProgressSnapshot?
    var accountSyncedAt: Date?
    /// Guest progress on this device.
    var guestCompletions: [GuestCompletion] = []
    /// Guest bookmarks, oldest first. Moved into the account at sign-in.
    var guestBookmarks: [UUID] = []
}

/// A write waiting for a connection (`queue.json`).
struct QueuedAction: Codable, Hashable, Sendable, Identifiable {
    enum Kind: String, Codable, Hashable, Sendable {
        case complete, uncomplete, bookmarkAdd, bookmarkRemove
    }

    enum Owner: Codable, Hashable, Sendable {
        /// A signed-in account (sent only while that account is signed in).
        case account(UUID)
        /// A guest visitor id (sent any time; it's the anonymous route).
        case guest(String)
    }

    let id: UUID
    let kind: Kind
    let lessonID: UUID
    /// Quiz answers for a completion; the server re-grades them.
    let answers: [Int]?
    let owner: Owner
    let createdAt: Date
    var attempts: Int

    init(kind: Kind, lessonID: UUID, answers: [Int]? = nil, owner: Owner, createdAt: Date = .now) {
        id = UUID()
        self.kind = kind
        self.lessonID = lessonID
        self.answers = answers
        self.owner = owner
        self.createdAt = createdAt
        attempts = 0
    }
}

/// Completions, bookmarks, XP, the weekly rhythm and badges.
///
/// - Signed in: the server is the authority. Completions go to
///   `POST /api/app/progress/complete`; rhythm and copy are shown exactly as the
///   server computed them (UTC). Offline or busy, a completion is queued with its
///   answers and the lesson shows "saved, will sync" (`isPending`).
/// - Guest: completions go to the site's `POST /api/guest-progress` with this
///   device's visitor id and are kept on device; the weekly strip is computed here
///   with the same rules (`RhythmCalculator`), labelled as on this device.
///
/// Writes `WidgetSnapshot` after every change.
@Observable
@MainActor
final class ProgressStore {
    // MARK: Published state

    private(set) var completedLessonIDs: Set<UUID> = []
    private(set) var bookmarkedLessonIDs: Set<UUID> = []
    /// Bookmarks, newest first.
    private(set) var bookmarkOrder: [UUID] = []
    /// Every completion with its date (pending ones use the time they were made).
    private(set) var completions: [Completion] = []
    /// Server rhythm for accounts; on-device rhythm for guests.
    private(set) var rhythm: Rhythm?
    private(set) var rhythmCopy: RhythmCopy?
    /// True for guests: the strip counts this device only. Label it that way.
    private(set) var rhythmIsOnDevice = false
    private(set) var xp = 0
    private(set) var level = 1
    private(set) var nextUnlock: NextUnlock?
    private(set) var earnedAchievements: [EarnedAchievement] = []
    /// Completions saved on device and not yet confirmed by the server ("saved, will sync").
    private(set) var pendingLessonIDs: Set<UUID> = []
    private(set) var isRefreshing = false
    private(set) var isSyncing = false
    private(set) var lastSynced: Date?
    private(set) var lastError: APIError?
    /// Goes up whenever this device changes the account's progress on learnfrc.com: a
    /// confirmed completion or un-completion, or guest lessons moved in after sign-in. Screens
    /// that show totals from other routes (the team sheet on Home and Team) reload when it
    /// changes, e.g. `.task(id: progress.progressRevision)`.
    private(set) var progressRevision = 0
    /// Guest lessons on their way into the account right after sign-in or sign-up
    /// (`migrateGuestProgress()`). From the moment the account appears they're already
    /// counted (as pending), so lesson totals don't start low and jump; XP and badges come
    /// from the server and catch up when the move finishes. While it's true a screen showing
    /// the account's totals can say so ("moving your guest lessons") instead of presenting
    /// numbers that are about to change as final.
    var isMovingGuestLessons: Bool { !movingGuestLessonIDs.isEmpty }
    private(set) var movingGuestLessonIDs: Set<UUID> = []
    /// False while an account is signed in but its own progress hasn't been read on this
    /// device yet: right after signing in (the account's last snapshot left with the previous
    /// account, or was never here), until the first `/api/app/me/progress` lands. Meanwhile
    /// `completedLessonIDs` (and so `completedTotal`, certificates and badge progress) hold
    /// only what this device knows, the guest lessons moving in and any queued completions,
    /// which is less than the account's real total. A screen showing the account's totals
    /// marks them as still coming instead of presenting them as final, and the widgets keep
    /// what they last showed. Always true for a guest.
    private(set) var knowsAccountTotals = true

    // MARK: Dependencies and storage

    @ObservationIgnored private let catalog: CatalogStore
    @ObservationIgnored private let account: AccountStore
    @ObservationIgnored private let connectivity: Connectivity
    @ObservationIgnored private let api: APIClient?
    @ObservationIgnored private let supabase: SupabaseService?
    @ObservationIgnored private let cache: CacheStore
    @ObservationIgnored private let writesWidgets: Bool

    @ObservationIgnored private var stored = StoredProgress()
    @ObservationIgnored private var queue: [QueuedAction] = []
    @ObservationIgnored private var saveChain: Task<Void, Never>?
    @ObservationIgnored private var lastWidgetSnapshot: WidgetSnapshot?
    @ObservationIgnored private var lastRefresh: Date?
    @ObservationIgnored private var isFlushing = false
    @ObservationIgnored private var didMergeGuestRecord = false
    @ObservationIgnored private var refreshAgain = false
    /// Bumped on every confirmed write, so a progress read that started earlier is discarded.
    @ObservationIgnored private var writeGeneration = 0

    /// Queued server errors are retried this many times before the write is dropped.
    private static let maxServerAttempts = 8

    init(
        catalog: CatalogStore,
        account: AccountStore,
        connectivity: Connectivity,
        api: APIClient? = .shared,
        supabase: SupabaseService? = .shared,
        cache: CacheStore = .shared,
        writesWidgets: Bool = !AppConfig.isRunningPreviews
    ) {
        self.catalog = catalog
        self.account = account
        self.connectivity = connectivity
        self.api = api
        self.supabase = supabase
        self.cache = cache
        self.writesWidgets = writesWidgets
    }

    // MARK: Questions views ask

    func isCompleted(_ lessonID: UUID) -> Bool { completedLessonIDs.contains(lessonID) }
    func isBookmarked(_ lessonID: UUID) -> Bool { bookmarkedLessonIDs.contains(lessonID) }
    /// Saved on this device, waiting to sync ("saved, will sync").
    func isPending(_ lessonID: UUID) -> Bool { pendingLessonIDs.contains(lessonID) }

    var completedTotal: Int { completedLessonIDs.count }
    var xpIntoLevel: Int { XPRules.xpIntoLevel(xp) }
    var xpToNextLevel: Int { XPRules.xpToNextLevel(xp) }
    var hasPendingWrites: Bool { !queue.isEmpty }

    /// Lessons done and total in a department.
    func departmentProgress(_ department: Department) -> (done: Int, total: Int) {
        let lessons = department.lessons
        return (lessons.reduce(0) { $0 + (completedLessonIDs.contains($1.id) ? 1 : 0) }, lessons.count)
    }

    /// Lessons done and total in a module.
    func moduleProgress(_ module: Module) -> (done: Int, total: Int) {
        (module.lessons.reduce(0) { $0 + (completedLessonIDs.contains($1.id) ? 1 : 0) }, module.lessons.count)
    }

    /// The next unfinished lesson after the most recent completion (in that department's
    /// course order), else the first unfinished lesson of Getting Started, else of any
    /// department. nil when everything is done.
    var continueLesson: LessonLocation? {
        let done = completedLessonIDs
        if let latest = completions.max(by: { ($0.completedAt ?? .distantPast) < ($1.completedAt ?? .distantPast) }),
           let location = catalog.location(of: latest.lessonID) {
            let lessons = catalog.lessons(in: location.department)
            if let index = lessons.firstIndex(where: { $0.id == latest.lessonID }) {
                if let next = lessons[(index + 1)...].first(where: { !done.contains($0.id) }) { return next }
                if let earlier = lessons[..<index].first(where: { !done.contains($0.id) }) { return earlier }
            }
        }
        if let start = catalog.department(slug: "getting-started"),
           let first = catalog.lessons(in: start).first(where: { !done.contains($0.id) }) {
            return first
        }
        return catalog.allLessons.first { !done.contains($0.id) }
    }

    /// Departments with every lesson completed (certificates).
    var certificates: [Department] {
        catalog.departments.filter { $0.lessonCount > 0 && $0.lessons.allSatisfy { completedLessonIDs.contains($0.id) } }
    }

    /// When a department was finished: the latest completion among its lessons.
    func completionDate(of department: Department) -> Date? {
        let ids = Set(department.lessons.map(\.id))
        return completions.filter { ids.contains($0.lessonID) }.compactMap(\.completedAt).max()
    }

    func completedAt(_ lessonID: UUID) -> Date? {
        completions.first { $0.lessonID == lessonID }?.completedAt
    }

    /// Bookmarked lessons, newest first, that the catalog knows.
    var bookmarkedLessons: [LessonLocation] {
        bookmarkOrder.compactMap { catalog.location(of: $0) }
    }

    /// When a bookmark went in, for the reading list's "saved 3 days ago" (the site's filing
    /// line): the server's date for an account's bookmark, the time it was made for one still
    /// queued. Guests' bookmarks carry no date.
    func bookmarkedAt(_ lessonID: UUID) -> Date? {
        guard let userID = currentUserID else { return nil }
        if let queued = queue.last(where: { $0.kind == .bookmarkAdd && $0.lessonID == lessonID && $0.owner == .account(userID) }) {
            return queued.createdAt
        }
        guard stored.accountUserID == userID else { return nil }
        return stored.account?.bookmarks.first { $0.lessonID == lessonID }?.createdAt
    }

    func isEarned(_ achievement: Achievement) -> Bool {
        earnedAchievements.contains { $0.achievementID == achievement.id || (!$0.slug.isEmpty && $0.slug == achievement.slug) }
    }

    func earnedDate(_ achievement: Achievement) -> Date? {
        earnedAchievements.first { $0.achievementID == achievement.id || (!$0.slug.isEmpty && $0.slug == achievement.slug) }?.earnedAt
    }

    /// "3 / 5 lessons" toward a badge (the site's `achievementProgress`).
    func progress(toward achievement: Achievement) -> BadgeProgress? {
        achievement.criteria.progress(
            lessons: completedTotal,
            departments: certificates.count,
            streak: rhythm?.currentStreak ?? 0
        )
    }

    // MARK: Writes

    /// Completes a lesson after a passed quiz.
    ///
    /// - Signed in and online: `POST /api/app/progress/complete`; the result carries the
    ///   real XP and any new badges (`delivery == .server`).
    /// - Guest: the site's guest route plus this device (`delivery == .guest`, no XP).
    /// - Offline or the site is busy: saved on device and queued (`delivery == .queued`).
    ///
    /// Throws `.validation` when the answers don't pass (the server's rule: every question right).
    @discardableResult
    func complete(lessonID: UUID, answers: [Int]) async throws -> CompletionResult {
        if let body = catalog.lessonBody(lessonID), !body.quiz.isEmpty, !body.passes(answers) {
            throw APIError.validation("Answer every quiz question correctly to complete this lesson.")
        }

        switch mode {
        case .account(let userID):
            if !connectivity.isOnline || api == nil {
                return enqueueCompletion(lessonID: lessonID, answers: answers, owner: .account(userID))
            }
            do {
                guard let api else { throw APIError.network }
                let result = try await api.complete(lessonID: lessonID, answers: answers)
                applyConfirmedCompletion(result, lessonID: lessonID, userID: userID)
                lastError = nil
                Task { await self.refresh(force: true) }
                return result
            } catch {
                let error = APIError.from(error)
                if error.isTransient {
                    return enqueueCompletion(lessonID: lessonID, answers: answers, owner: .account(userID))
                }
                lastError = error
                throw error
            }

        case .guest:
            let visitor = VisitorIdentity.current()
            if !connectivity.isOnline || api == nil {
                recordGuestCompletion(lessonID)
                return enqueueCompletion(lessonID: lessonID, answers: answers, owner: .guest(visitor))
            }
            do {
                guard let api else { throw APIError.network }
                try await api.guestComplete(visitorID: visitor, lessonID: lessonID, answers: answers)
                recordGuestCompletion(lessonID)
                return CompletionResult(
                    xpAwarded: 0, xp: 0, level: 1, completedCount: completedTotal,
                    rhythm: rhythm, rhythmCopy: rhythmCopy, delivery: .guest
                )
            } catch {
                let error = APIError.from(error)
                if error.isTransient {
                    recordGuestCompletion(lessonID)
                    return enqueueCompletion(lessonID: lessonID, answers: answers, owner: .guest(visitor))
                }
                lastError = error
                throw error
            }
        }
    }

    /// Marks a lesson not done (XP is refunded by the server). Hands back a fresh quiz.
    func uncomplete(lessonID: UUID) async throws {
        switch mode {
        case .account(let userID):
            // Never reached the server: just drop the queued completion.
            if removeQueued(.complete, lessonID: lessonID, owner: .account(userID)) {
                persistQueue()
                recompute()
                return
            }
            guard connectivity.isOnline, let api else {
                enqueue(QueuedAction(kind: .uncomplete, lessonID: lessonID, owner: .account(userID)))
                return
            }
            do {
                let result = try await api.uncomplete(lessonID: lessonID)
                applyConfirmedUncompletion(result, lessonID: lessonID, userID: userID)
                lastError = nil
                Task { await self.refresh(force: true) }
            } catch {
                let error = APIError.from(error)
                if error.isTransient {
                    enqueue(QueuedAction(kind: .uncomplete, lessonID: lessonID, owner: .account(userID)))
                    return
                }
                lastError = error
                throw error
            }

        case .guest:
            let visitor = VisitorIdentity.current()
            stored.guestCompletions.removeAll { $0.lessonID == lessonID }
            persistStored()
            if removeQueued(.complete, lessonID: lessonID, owner: .guest(visitor)) {
                persistQueue()
                recompute()
                return
            }
            recompute()
            guard connectivity.isOnline, let api else {
                enqueue(QueuedAction(kind: .uncomplete, lessonID: lessonID, owner: .guest(visitor)))
                return
            }
            do {
                try await api.guestUncomplete(visitorID: visitor, lessonID: lessonID)
            } catch {
                if APIError.from(error).isTransient {
                    enqueue(QueuedAction(kind: .uncomplete, lessonID: lessonID, owner: .guest(visitor)))
                }
            }
        }
    }

    /// Adds or removes a bookmark. Instant on screen; synced in the background
    /// for accounts, kept on device for guests (and moved into the account at sign-in).
    func toggleBookmark(_ lessonID: UUID) async {
        let adding = !isBookmarked(lessonID)
        switch mode {
        case .account(let userID):
            let owner = QueuedAction.Owner.account(userID)
            let opposite: QueuedAction.Kind = adding ? .bookmarkRemove : .bookmarkAdd
            // A queued opposite cancels out instead of sending two writes.
            if !removeQueued(opposite, lessonID: lessonID, owner: owner) {
                queue.append(QueuedAction(kind: adding ? .bookmarkAdd : .bookmarkRemove, lessonID: lessonID, owner: owner))
            }
            persistQueue()
            recompute()
            await flushQueue()
        case .guest:
            if adding {
                stored.guestBookmarks.removeAll { $0 == lessonID }
                stored.guestBookmarks.append(lessonID)
            } else {
                stored.guestBookmarks.removeAll { $0 == lessonID }
            }
            persistStored()
            recompute()
        }
    }

    // MARK: Sync

    /// Sends queued writes, then re-reads progress (launch, foreground, after writes,
    /// pull to refresh). Throttled to every 15 seconds unless forced.
    func refresh(force: Bool = false) async {
        if !force, let lastRefresh, Date.now.timeIntervalSince(lastRefresh) < 15 {
            recompute()
            return
        }
        guard !isRefreshing else {
            // Asked again mid-refresh (usually right after a write): run once more after this one.
            refreshAgain = true
            return
        }
        isRefreshing = true
        defer {
            isRefreshing = false
            if refreshAgain {
                refreshAgain = false
                Task { await self.refresh(force: true) }
            }
        }
        lastRefresh = .now

        await flushQueue()

        switch mode {
        case .account(let userID):
            guard connectivity.isOnline, let api else { recompute(); return }
            let generation = writeGeneration
            do {
                let snapshot = try await api.progress()
                guard case .account(let current) = mode, current == userID else { return }
                // A write landed while this was in flight; this snapshot may predate it.
                guard generation == writeGeneration else {
                    refreshAgain = true
                    return
                }
                stored.accountUserID = userID
                stored.account = snapshot
                stored.accountSyncedAt = .now
                lastSynced = .now
                lastError = nil
                persistStored()
            } catch {
                let error = APIError.from(error)
                if error == .server { await refreshFromTables(userID: userID) }
                if error != .network { lastError = error }
                Log.sync.info("Progress refresh: \(error.message, privacy: .public)")
            }
        case .guest:
            await mergeServerGuestLessons()
        }
        recompute()
    }

    /// Sends queued writes in order. Stops at the first transient failure; drops
    /// writes the server refuses (their optimistic effect is undone).
    func flushQueue() async {
        guard !isFlushing, !queue.isEmpty, connectivity.isOnline, api != nil else { return }
        isFlushing = true
        isSyncing = true
        defer {
            isFlushing = false
            isSyncing = false
        }

        var accountWriteSucceeded = false
        var index = 0
        while index < queue.count {
            let item = queue[index]
            if case .account(let owner) = item.owner, owner != currentUserID {
                index += 1 // Waits for that account to sign in again.
                continue
            }
            do {
                try await send(item)
                if let position = queue.firstIndex(where: { $0.id == item.id }) { queue.remove(at: position) }
                if case .account = item.owner { accountWriteSucceeded = true }
            } catch {
                let error = APIError.from(error)
                if error == .network || error == .unauthorized || isRateLimit(error) {
                    break
                }
                if error == .server, item.attempts + 1 < Self.maxServerAttempts {
                    if let position = queue.firstIndex(where: { $0.id == item.id }) { queue[position].attempts += 1 }
                    break
                }
                // Refused for good: drop it and undo its local effect.
                Log.sync.error("Dropping queued \(item.kind.rawValue, privacy: .public): \(error.message, privacy: .public)")
                if let position = queue.firstIndex(where: { $0.id == item.id }) { queue.remove(at: position) }
                if item.kind == .complete, case .guest = item.owner {
                    stored.guestCompletions.removeAll { $0.lessonID == item.lessonID }
                    persistStored()
                }
                if item.kind == .complete { lastError = error }
            }
        }
        persistQueue()
        recompute()
        if accountWriteSucceeded, case .account(let userID) = mode, let api {
            let generation = writeGeneration
            if let snapshot = try? await api.progress(), generation == writeGeneration, currentUserID == userID {
                stored.accountUserID = userID
                stored.account = snapshot
                stored.accountSyncedAt = .now
                lastSynced = .now
                persistStored()
                recompute()
            }
        }
    }

    /// After sign-in or sign-up: moves this device's guest progress into the account
    /// (`POST /api/app/migrate-guest`, the site's migration logic) and moves guest bookmarks.
    func migrateGuestProgress() async {
        guard case .account(let userID) = mode, let api else { return }
        let hasGuestLessons = !stored.guestCompletions.isEmpty
        let hasGuestBookmarks = !stored.guestBookmarks.isEmpty
        guard hasGuestLessons || hasGuestBookmarks else { return }
        if hasGuestLessons, connectivity.isOnline {
            setIfChanged(\.movingGuestLessonIDs, Set(stored.guestCompletions.map(\.lessonID)))
            recompute()
        }
        defer {
            setIfChanged(\.movingGuestLessonIDs, [])
            recompute()
        }

        if hasGuestBookmarks {
            for lessonID in stored.guestBookmarks where !(stored.account?.bookmarks.contains { $0.lessonID == lessonID } ?? false) {
                queue.append(QueuedAction(kind: .bookmarkAdd, lessonID: lessonID, owner: .account(userID)))
            }
            stored.guestBookmarks = []
            persistQueue()
            persistStored()
        }

        // The server only migrates rows it holds, so send any queued guest completions first.
        await flushQueue()

        var migrated = 0
        if hasGuestLessons, connectivity.isOnline {
            // The account's own progress, read while the move runs: its totals show as soon as
            // they're known, with the moving lessons already counted (`recompute()`).
            let earlyRead = Task { await self.refresh(force: true) }
            do {
                migrated = try await api.migrateGuest(visitorID: VisitorIdentity.current())
                Log.sync.info("Migrated \(migrated) guest lessons into the account")
            } catch {
                Log.sync.error("Guest migration will retry next sign-in: \(APIError.from(error).message, privacy: .public)")
            }
            await earlyRead.value
        }
        // After the move: XP, badges and the rhythm as the server now has them.
        await refresh(force: true)

        // Clear guest lessons the account now has; keep any the server couldn't take.
        let accountLessons = Set(stored.account?.completions.map(\.lessonID) ?? [])
        if !accountLessons.isEmpty {
            stored.guestCompletions.removeAll { accountLessons.contains($0.lessonID) }
            persistStored()
        }
        recompute()
        // The team sheet, leaderboards and anything else computed on the server now count
        // the moved lessons: tell screens holding an older copy to reload.
        if migrated > 0 { progressRevision &+= 1 }
    }

    // MARK: Account changes (wired by AppModel)

    func handle(_ change: AccountChange) async {
        switch change {
        case .signedIn(let userID, _):
            if stored.accountUserID != userID {
                stored.accountUserID = userID
                stored.account = nil
                persistStored()
            }
            let hasGuestProgress = !stored.guestCompletions.isEmpty || !stored.guestBookmarks.isEmpty
            if hasGuestProgress, connectivity.isOnline, !stored.guestCompletions.isEmpty {
                // Counted from the first frame the account shows (`isMovingGuestLessons`).
                setIfChanged(\.movingGuestLessonIDs, Set(stored.guestCompletions.map(\.lessonID)))
            }
            recompute()
            if hasGuestProgress {
                // Straight to the move: it reads the account's progress once it's done, so the
                // numbers from before the move never show on their own.
                await migrateGuestProgress()
            } else {
                await refresh(force: true)
            }
        case .guest:
            stored.account = nil
            stored.accountUserID = nil
            persistStored()
            setIfChanged(\.movingGuestLessonIDs, [])
            recompute()
            await refresh(force: true)
        case .deleted(let userID):
            queue.removeAll { $0.owner == .account(userID) }
            stored.account = nil
            stored.accountUserID = nil
            persistQueue()
            persistStored()
            recompute()
        }
    }

    /// Call after the catalog changes, so the continue lesson and widget catch up.
    func catalogDidChange() {
        recompute()
    }

    // MARK: Loading

    func loadCache() async {
        async let storedFile = cache.load(StoredProgress.self, from: .progress)
        async let queueFile = cache.load([QueuedAction].self, from: .queue)
        let (storedValue, queueValue) = await (storedFile, queueFile)
        if let storedValue {
            stored = storedValue.value
            lastSynced = storedValue.value.accountSyncedAt
        }
        if let queueValue { queue = queueValue.value }
        recompute()
    }

    // MARK: Internals

    private enum Mode: Equatable {
        case account(UUID)
        case guest
    }

    private var mode: Mode {
        switch account.state {
        case .signedIn(let me): .account(me.user.id)
        case .guest: .guest
        case .loading: stored.accountUserID.map(Mode.account) ?? .guest
        }
    }

    private var currentUserID: UUID? {
        if case .account(let id) = mode { return id }
        return nil
    }

    private func isRateLimit(_ error: APIError) -> Bool {
        if case .rateLimited = error { return true }
        return false
    }

    /// Rebuilds every published value from storage + queue, then the widget snapshot.
    private func recompute() {
        switch mode {
        case .account(let userID):
            let snapshot = stored.accountUserID == userID ? stored.account : nil
            let owner = QueuedAction.Owner.account(userID)
            let mine = queue.filter { $0.owner == owner }

            var byLesson: [UUID: Completion] = [:]
            for completion in snapshot?.completions ?? [] { byLesson[completion.lessonID] = completion }
            var pending: Set<UUID> = []
            // Guest lessons being moved in: counted now, pending until the server has them.
            for guest in stored.guestCompletions where movingGuestLessonIDs.contains(guest.lessonID) && byLesson[guest.lessonID] == nil {
                byLesson[guest.lessonID] = Completion(lessonID: guest.lessonID, completedAt: guest.completedAt, xpAwarded: 0)
                pending.insert(guest.lessonID)
            }
            for item in mine {
                switch item.kind {
                case .complete:
                    if byLesson[item.lessonID] == nil {
                        byLesson[item.lessonID] = Completion(lessonID: item.lessonID, completedAt: item.createdAt, xpAwarded: 0)
                        pending.insert(item.lessonID)
                    }
                case .uncomplete:
                    byLesson[item.lessonID] = nil
                    pending.remove(item.lessonID)
                default: break
                }
            }

            var bookmarks = (snapshot?.bookmarks ?? []).sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }.map(\.lessonID)
            for item in mine {
                switch item.kind {
                case .bookmarkAdd:
                    bookmarks.removeAll { $0 == item.lessonID }
                    bookmarks.insert(item.lessonID, at: 0)
                case .bookmarkRemove:
                    bookmarks.removeAll { $0 == item.lessonID }
                default: break
                }
            }

            setIfChanged(\.completions, byLesson.values.sorted { ($0.completedAt ?? .distantPast) < ($1.completedAt ?? .distantPast) })
            setIfChanged(\.completedLessonIDs, Set(byLesson.keys))
            setIfChanged(\.pendingLessonIDs, pending)
            setIfChanged(\.bookmarkOrder, bookmarks)
            setIfChanged(\.bookmarkedLessonIDs, Set(bookmarks))
            setIfChanged(\.xp, snapshot?.xp ?? account.profile?.xp ?? 0)
            setIfChanged(\.level, snapshot?.level ?? XPRules.level(forXP: snapshot?.xp ?? account.profile?.xp ?? 0))
            setIfChanged(\.rhythm, snapshot?.rhythm)
            setIfChanged(\.rhythmCopy, snapshot?.rhythmCopy)
            setIfChanged(\.rhythmIsOnDevice, false)
            setIfChanged(\.nextUnlock, snapshot?.nextUnlock)
            setIfChanged(\.earnedAchievements, snapshot?.earnedAchievements ?? [])
            setIfChanged(\.knowsAccountTotals, snapshot != nil)

        case .guest:
            let visitorQueue = queue.filter { if case .guest = $0.owner { $0.kind == .complete } else { false } }
            let completions = stored.guestCompletions.map { Completion(lessonID: $0.lessonID, completedAt: $0.completedAt, xpAwarded: 0) }
            setIfChanged(\.completions, completions)
            setIfChanged(\.completedLessonIDs, Set(completions.map(\.lessonID)))
            setIfChanged(\.pendingLessonIDs, Set(visitorQueue.map(\.lessonID)))
            setIfChanged(\.bookmarkOrder, stored.guestBookmarks.reversed())
            setIfChanged(\.bookmarkedLessonIDs, Set(stored.guestBookmarks))
            setIfChanged(\.xp, 0)
            setIfChanged(\.level, 1)
            let now = Date.now
            let dates = stored.guestCompletions.map(\.completedAt)
            let started = VisitorIdentity.startedAt ?? dates.compactMap { $0 }.min()
            let rhythm = RhythmCalculator.compute(
                completedAt: dates,
                createdAt: started,
                now: now,
                tzOffsetMinutes: RhythmCalculator.deviceOffsetMinutes(at: now)
            )
            let copy = RhythmCalculator.describe(rhythm)
            setIfChanged(\.rhythm, rhythm)
            setIfChanged(\.rhythmCopy, RhythmCopy(
                eyebrow: copy.eyebrow == "Welcome back" ? copy.eyebrow : "\(copy.eyebrow) on this device",
                headline: copy.headline,
                body: copy.body,
                cta: copy.cta
            ))
            setIfChanged(\.rhythmIsOnDevice, true)
            setIfChanged(\.nextUnlock, nil)
            setIfChanged(\.earnedAchievements, [])
            setIfChanged(\.knowsAccountTotals, true)
        }
        writeWidgetSnapshot()
    }

    /// Assigns only when the value changed, so observers don't redraw for nothing.
    private func setIfChanged<Value: Equatable>(_ keyPath: ReferenceWritableKeyPath<ProgressStore, Value>, _ value: Value) {
        if self[keyPath: keyPath] != value { self[keyPath: keyPath] = value }
    }

    private func enqueueCompletion(lessonID: UUID, answers: [Int], owner: QueuedAction.Owner) -> CompletionResult {
        if !removeQueued(.uncomplete, lessonID: lessonID, owner: owner) {
            queue.removeAll { $0.kind == .complete && $0.lessonID == lessonID && $0.owner == owner }
            queue.append(QueuedAction(kind: .complete, lessonID: lessonID, answers: answers, owner: owner))
        }
        persistQueue()
        recompute()
        Log.sync.info("Completion saved on device; will sync")
        return CompletionResult(
            xpAwarded: 0, xp: xp, level: level, completedCount: completedTotal,
            rhythm: rhythm, rhythmCopy: rhythmCopy, delivery: .queued
        )
    }

    private func enqueue(_ action: QueuedAction) {
        queue.append(action)
        persistQueue()
        recompute()
    }

    /// Removes a queued write of this kind; true if there was one.
    @discardableResult
    private func removeQueued(_ kind: QueuedAction.Kind, lessonID: UUID, owner: QueuedAction.Owner) -> Bool {
        let before = queue.count
        queue.removeAll { $0.kind == kind && $0.lessonID == lessonID && $0.owner == owner }
        return queue.count != before
    }

    private func recordGuestCompletion(_ lessonID: UUID) {
        guard !stored.guestCompletions.contains(where: { $0.lessonID == lessonID }) else { return }
        let now = Date.now
        VisitorIdentity.noteStarted(at: now)
        stored.guestCompletions.append(GuestCompletion(lessonID: lessonID, completedAt: now))
        persistStored()
        recompute()
    }

    private func applyConfirmedCompletion(_ result: CompletionResult, lessonID: UUID, userID: UUID) {
        writeGeneration &+= 1
        guard stored.accountUserID == userID || stored.accountUserID == nil else { return }
        let current = stored.account ?? .empty
        var completions = current.completions
        if !completions.contains(where: { $0.lessonID == lessonID }) {
            completions.append(Completion(lessonID: lessonID, completedAt: .now, xpAwarded: result.xpAwarded))
        }
        var earned = current.earnedAchievements
        for badge in result.newAchievements where !earned.contains(where: { $0.achievementID == badge.id }) {
            earned.append(EarnedAchievement(achievementID: badge.id, slug: badge.slug, earnedAt: .now))
        }
        stored.accountUserID = userID
        stored.account = ProgressSnapshot(
            completions: completions,
            bookmarks: current.bookmarks,
            earnedAchievements: earned,
            xp: result.xp,
            level: result.level,
            rhythm: result.rhythm ?? current.rhythm,
            rhythmCopy: result.rhythmCopy ?? current.rhythmCopy,
            nextUnlock: current.nextUnlock
        )
        removeQueued(.complete, lessonID: lessonID, owner: .account(userID))
        persistQueue()
        persistStored()
        recompute()
        progressRevision &+= 1
    }

    private func applyConfirmedUncompletion(_ result: UncompleteResult, lessonID: UUID, userID: UUID) {
        writeGeneration &+= 1
        guard let current = stored.account, stored.accountUserID == userID else { return }
        stored.account = ProgressSnapshot(
            completions: current.completions.filter { $0.lessonID != lessonID },
            bookmarks: current.bookmarks,
            earnedAchievements: current.earnedAchievements,
            xp: result.xp,
            level: result.level,
            rhythm: current.rhythm,
            rhythmCopy: current.rhythmCopy,
            nextUnlock: current.nextUnlock
        )
        persistStored()
        recompute()
        progressRevision &+= 1
    }

    private func applyConfirmedBookmark(_ lessonID: UUID, added: Bool, userID: UUID) {
        writeGeneration &+= 1
        guard stored.accountUserID == userID else { return }
        let current = stored.account ?? .empty
        var bookmarks = current.bookmarks.filter { $0.lessonID != lessonID }
        if added { bookmarks.append(Bookmark(lessonID: lessonID, createdAt: .now)) }
        stored.account = ProgressSnapshot(
            completions: current.completions, bookmarks: bookmarks, earnedAchievements: current.earnedAchievements,
            xp: current.xp, level: current.level, rhythm: current.rhythm, rhythmCopy: current.rhythmCopy,
            nextUnlock: current.nextUnlock
        )
        persistStored()
    }

    /// Sends one queued write.
    private func send(_ item: QueuedAction) async throws {
        guard let api else { throw APIError.network }
        switch (item.owner, item.kind) {
        case (.account(let userID), .complete):
            let result = try await api.complete(lessonID: item.lessonID, answers: item.answers ?? [])
            applyConfirmedCompletion(result, lessonID: item.lessonID, userID: userID)
        case (.account(let userID), .uncomplete):
            let result = try await api.uncomplete(lessonID: item.lessonID)
            applyConfirmedUncompletion(result, lessonID: item.lessonID, userID: userID)
        case (.account(let userID), .bookmarkAdd):
            guard let supabase else { throw APIError.network }
            try await supabase.addBookmark(lessonID: item.lessonID)
            applyConfirmedBookmark(item.lessonID, added: true, userID: userID)
        case (.account(let userID), .bookmarkRemove):
            guard let supabase else { throw APIError.network }
            try await supabase.removeBookmark(lessonID: item.lessonID)
            applyConfirmedBookmark(item.lessonID, added: false, userID: userID)
        case (.guest(let visitor), .complete):
            try await api.guestComplete(visitorID: visitor, lessonID: item.lessonID, answers: item.answers)
        case (.guest(let visitor), .uncomplete):
            try await api.guestUncomplete(visitorID: visitor, lessonID: item.lessonID)
        case (.guest, .bookmarkAdd), (.guest, .bookmarkRemove):
            break // Guest bookmarks only live on device.
        }
    }

    /// Fallback when `/api/app/me/progress` is down: own completions and bookmarks
    /// straight from the tables (read only). XP, rhythm and badges keep their last values.
    private func refreshFromTables(userID: UUID) async {
        guard let supabase else { return }
        do {
            async let completionRows = supabase.ownCompletions()
            async let bookmarkRows = supabase.bookmarks()
            let (completions, bookmarks) = try await (completionRows, bookmarkRows)
            guard case .account(let current) = mode, current == userID else { return }
            let previous = stored.accountUserID == userID ? stored.account : nil
            stored.accountUserID = userID
            stored.account = ProgressSnapshot(
                completions: completions,
                bookmarks: bookmarks,
                earnedAchievements: previous?.earnedAchievements ?? [],
                xp: previous?.xp ?? account.profile?.xp ?? 0,
                level: previous?.level ?? account.profile?.level ?? 1,
                rhythm: previous?.rhythm,
                rhythmCopy: previous?.rhythmCopy,
                nextUnlock: previous?.nextUnlock
            )
            persistStored()
            Log.sync.info("Progress read from tables (route unavailable)")
        } catch {
            Log.sync.info("Table fallback failed: \(APIError.from(error).message, privacy: .public)")
        }
    }

    /// Restores lessons the site's guest record holds that this device doesn't
    /// (a reinstall keeps the Keychain visitor id but not the files).
    private func mergeServerGuestLessons() async {
        guard !didMergeGuestRecord, connectivity.isOnline, let api,
              !stored.guestCompletions.isEmpty || VisitorIdentity.startedAt != nil else { return }
        didMergeGuestRecord = true
        do {
            let serverIDs = try await api.guestLessons(visitorID: VisitorIdentity.current())
            let local = Set(stored.guestCompletions.map(\.lessonID))
            let missing = serverIDs.filter { !local.contains($0) }
            guard !missing.isEmpty, case .guest = mode else { return }
            stored.guestCompletions.append(contentsOf: missing.map { GuestCompletion(lessonID: $0, completedAt: nil) })
            persistStored()
        } catch {
            // Guest reads are best effort.
        }
    }

    private func persistStored() {
        let value = stored
        let cache = self.cache
        let previous = saveChain
        saveChain = Task {
            await previous?.value
            await cache.save(value, to: .progress)
        }
    }

    private func persistQueue() {
        let value = queue
        let cache = self.cache
        let previous = saveChain
        saveChain = Task {
            await previous?.value
            await cache.save(value, to: .queue)
        }
    }

    // MARK: Widgets

    private func writeWidgetSnapshot() {
        // Until the account's own progress is read, the totals here are only what this device
        // knows (`knowsAccountTotals`): the widgets keep what they showed rather than a count
        // smaller than the account's.
        guard writesWidgets, knowsAccountTotals else { return }
        let continueLesson = self.continueLesson.map {
            WidgetSnapshot.ContinueLesson(
                id: $0.lesson.id, title: $0.lesson.title, departmentName: $0.department.name,
                moduleTitle: $0.module.title, minutes: $0.lesson.estimatedMinutes
            )
        }
        let rhythm = self.rhythm.map { r in
            WidgetSnapshot.Rhythm(
                goal: r.goal,
                windowCount: r.windowCount,
                windowLabel: r.windowLabel,
                currentStreak: r.currentStreak,
                days: r.days.map { WidgetSnapshot.Day(label: $0.label, count: $0.count, isToday: $0.isToday, isFuture: $0.isFuture) },
                microcopy: r.microcopy,
                onDevice: rhythmIsOnDevice
            )
        }
        let snapshot = WidgetSnapshot(
            continueLesson: continueLesson,
            rhythm: rhythm,
            xp: xp,
            level: level,
            completedTotal: completedTotal,
            signedIn: account.isSignedIn
        )
        if let lastWidgetSnapshot, lastWidgetSnapshot.hasSameContent(as: snapshot) { return }
        lastWidgetSnapshot = snapshot
        guard catalog.isLoaded || snapshot.completedTotal > 0 else { return }
        if snapshot.write() {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    // MARK: Previews

    /// Puts a snapshot in place without the network (previews only).
    func applyPreview(account snapshot: ProgressSnapshot?, userID: UUID?, guestCompletions: [GuestCompletion] = [], queued: [QueuedAction] = []) {
        stored.accountUserID = userID
        stored.account = snapshot
        stored.guestCompletions = guestCompletions
        queue = queued
        recompute()
    }
}
