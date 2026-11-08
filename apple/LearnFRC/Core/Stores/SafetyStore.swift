import Foundation
import Observation

/// Report and block for the signed-in account (App Review guideline 1.2).
///
/// Who's blocked is the site's (`GET /api/app/blocks`, `src/lib/app/blocks.ts`). The app keeps
/// the list to hide those handles from what it already has on screen or cached: the
/// leaderboards (a public, CDN-cached route that's the same for everyone) and public profiles.
/// The team sheet comes from the server with them already left off.
///
/// The list belongs to one account. It's kept in memory and in the community cache folder
/// (`blocks-<id>.json`), so a cached board stays filtered offline; `CacheStore.removePersonalFiles()`
/// deletes that folder on sign-out and deletion, and `reset()` clears memory.
///
/// One store for every window (`shared`). Views read it with
/// `@Environment(SafetyStore.self) private var injected: SafetyStore?` and fall back to `shared`.
@Observable
@MainActor
final class SafetyStore {
    static let shared = SafetyStore()

    /// The account the list belongs to. Nil while signed out.
    private(set) var ownerID: UUID?
    /// Newest first, as the site lists them.
    private(set) var blocked: [BlockedAccount] = []
    /// Lowercased handles, for filtering.
    private(set) var blockedHandles: Set<String> = []
    private(set) var isLoading = false
    private(set) var lastError: APIError?
    /// True once the list has come from the site in this run.
    private(set) var hasLoaded = false
    /// The reasons a report can give, the site's when it has answered.
    private(set) var reasons: [ReportReason] = ReportReason.builtIn
    private(set) var answerWithinHours = 24
    /// Handles with a block or unblock on its way.
    private(set) var changing: Set<String> = []
    /// Goes up when the site has confirmed a block or an unblock from this device. Screens
    /// whose data the server filters (the team sheet) fetch again on it.
    private(set) var revision = 0

    @ObservationIgnored private let api: APIClient?
    @ObservationIgnored private var loadTask: Task<Void, Never>?
    @ObservationIgnored private var fetchedAt: Date?
    @ObservationIgnored private var reasonsFetchedAt: Date?

    private static let maxAge: TimeInterval = 10 * 60

    init(api: APIClient? = .shared) {
        self.api = AppConfig.isRunningPreviews ? nil : api
    }

    // MARK: Reading

    func isBlocked(_ username: String?) -> Bool {
        guard let name = username?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !name.isEmpty else { return false }
        return blockedHandles.contains(name)
    }

    func isChanging(_ username: String?) -> Bool {
        guard let name = username?.lowercased() else { return false }
        return changing.contains(name)
    }

    // MARK: Account

    /// Follows the signed-in account: another id (or nil) clears the list and restores that
    /// account's saved copy, then the site is asked when the copy is older than ten minutes
    /// (`force` asks now).
    func sync(userID: UUID?, force: Bool = false) async {
        guard api != nil else { return }
        if userID != ownerID {
            reset()
            ownerID = userID
            if let userID, let saved = Self.loadSaved(for: userID) { apply(saved) }
        }
        guard userID != nil else { return }
        if !force, hasLoaded, let fetchedAt, Date.now.timeIntervalSince(fetchedAt) < Self.maxAge { return }
        await refresh()
    }

    /// Forgets everything (sign-out, another account, account deleted).
    func reset() {
        loadTask?.cancel()
        loadTask = nil
        ownerID = nil
        blocked = []
        blockedHandles = []
        isLoading = false
        lastError = nil
        hasLoaded = false
        fetchedAt = nil
        changing = []
    }

    /// `GET /api/app/blocks`. One request at a time; a reply for a previous account is dropped.
    func refresh() async {
        if let loadTask {
            await loadTask.value
            return
        }
        guard let api, let owner = ownerID else { return }
        isLoading = true
        let task = Task { [weak self] in
            do {
                let list = try await api.blocks()
                guard let self, self.ownerID == owner else { return }
                self.apply(list)
                self.hasLoaded = true
                self.fetchedAt = .now
                self.lastError = nil
                Self.save(list, for: owner)
            } catch {
                guard let self, self.ownerID == owner else { return }
                self.lastError = APIError.from(error)
            }
        }
        loadTask = task
        await task.value
        if loadTask == task { loadTask = nil }
        isLoading = false
    }

    // MARK: Blocking

    /// Blocks `username`. Hidden at once; put back if the site refuses.
    func block(_ username: String) async throws {
        let name = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = name.lowercased()
        guard let api, let owner = ownerID, !key.isEmpty, !changing.contains(key) else { return }
        let before = blocked
        changing.insert(key)
        defer { changing.remove(key) }
        if !blockedHandles.contains(key) {
            apply([BlockedAccount(username: name, blockedAt: .now)] + blocked)
        }
        do {
            let saved = try await api.block(username: name)
            guard ownerID == owner else { return }
            if let saved, saved.username != nil {
                apply([saved] + blocked.filter { $0.id != saved.id })
            }
            revision += 1
            Self.save(blocked, for: owner)
        } catch {
            if ownerID == owner { apply(before) }
            throw APIError.from(error)
        }
    }

    /// Unblocks `username`. Shown again at once; hidden again if the site refuses.
    func unblock(_ username: String) async throws {
        let key = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let api, let owner = ownerID, !key.isEmpty, !changing.contains(key) else { return }
        let before = blocked
        changing.insert(key)
        defer { changing.remove(key) }
        apply(blocked.filter { $0.id != key })
        do {
            try await api.unblock(username: key)
            guard ownerID == owner else { return }
            revision += 1
            Self.save(blocked, for: owner)
        } catch {
            if ownerID == owner { apply(before) }
            throw APIError.from(error)
        }
    }

    // MARK: Reporting

    /// `GET /api/app/reports`, at most once an hour. The built-in list stands in until then.
    func loadReasons() async {
        guard let api else { return }
        if let reasonsFetchedAt, Date.now.timeIntervalSince(reasonsFetchedAt) < 3600 { return }
        do {
            let payload = try await api.reportReasons()
            if !payload.reasons.isEmpty { reasons = payload.reasons }
            answerWithinHours = payload.answerWithinHours
            reasonsFetchedAt = .now
        } catch {
            // The built-in reasons are the site's; the server checks whichever is sent.
        }
    }

    /// Files a report about `username`'s profile. Returns the site's sentence for the reporter.
    func report(username: String, reason: ReportReason, details: String, surface: ReportSurface) async throws -> String {
        guard let api else {
            return "Thanks. Your report went to the LearnFRC team, and every report is read within 24 hours. @\(username) isn't told who sent it."
        }
        let trimmed = details.trimmingCharacters(in: .whitespacesAndNewlines)
        let filed = try await api.report(ReportRequest(
            username: username,
            reason: reason.id,
            details: trimmed.isEmpty ? nil : trimmed,
            surface: surface,
            platform: AppConfig.platformID
        ))
        return filed.message
    }

    // MARK: Storage

    private func apply(_ list: [BlockedAccount]) {
        blocked = list.filter { $0.username != nil }
        blockedHandles = Set(blocked.compactMap { $0.username?.lowercased() })
    }

    private struct Saved: Codable {
        let blocks: [BlockedAccount]
    }

    private nonisolated static func fileURL(for owner: UUID) -> URL? {
        CacheStore.communityDirectory?.appending(path: "blocks-\(owner.uuidString.lowercased()).json", directoryHint: .notDirectory)
    }

    private nonisolated static func loadSaved(for owner: UUID) -> [BlockedAccount]? {
        guard !AppConfig.isRunningPreviews, let url = fileURL(for: owner), let data = try? Data(contentsOf: url),
              let saved = try? JSONCoding.decoder().decode(Saved.self, from: data) else { return nil }
        return saved.blocks
    }

    private nonisolated static func save(_ list: [BlockedAccount], for owner: UUID) {
        guard !AppConfig.isRunningPreviews, let directory = CacheStore.communityDirectory, let url = fileURL(for: owner) else { return }
        Task.detached(priority: .utility) {
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let data = try JSONCoding.encoder().encode(Saved(blocks: list))
                try data.write(to: url, options: [.atomic])
            } catch {
                Log.data.error("Blocks cache write failed: \(String(describing: error), privacy: .public)")
            }
        }
    }

    // MARK: Previews

    static func preview(blocked handles: [String] = []) -> SafetyStore {
        let store = SafetyStore(api: nil)
        store.apply(handles.map { BlockedAccount(username: $0, blockedAt: .now.addingTimeInterval(-86_400)) })
        store.hasLoaded = true
        return store
    }
}
