import Foundation

/// The on-device cache: JSON files in Application Support, written atomically,
/// each wrapped with the time it was fetched. Runs off the main actor: writes go through the
/// actor one at a time, reads decode in parallel (a cold launch reads the catalog, the lesson
/// bodies, the articles and progress at once).
///
/// When a file was fetched comes from its envelope (`Envelope.fetchedAt`), never from the
/// file system, so the app doesn't use any file-timestamp API (see `PrivacyInfo.xcprivacy`).
actor CacheStore {
    static let shared = CacheStore()

    /// The files the app keeps.
    enum File: String, CaseIterable, Sendable {
        /// Departments, modules, lesson summaries and the achievement catalog.
        case catalog = "catalog.json"
        /// Every lesson body (markdown, takeaways, resources, quiz).
        case lessons = "lessons.json"
        case articles = "articles.json"
        /// Glossary, paths, lesson-to-article links, start goals.
        case reference = "reference.json"
        /// Account progress and guest progress.
        case progress = "progress.json"
        /// Writes waiting for a connection.
        case queue = "queue.json"
        /// The signed-in user's `/me`, so the app opens signed in while offline.
        case me = "me.json"
        /// learnfrc.com/resources as data (`GET /api/app/resources`). Not personal.
        case resources = "resources.json"
    }

    /// A cached value and when it was fetched.
    struct Envelope<Value: Codable & Sendable>: Codable, Sendable {
        /// Bump when a cached shape changes incompatibly; older files are ignored.
        static var currentSchema: Int { 1 }

        let schema: Int
        let fetchedAt: Date
        let value: Value
    }

    private let directory: URL?
    private let isEnabled: Bool

    init(directory: URL? = nil, enabled: Bool = !AppConfig.isRunningPreviews) {
        isEnabled = enabled
        if let directory {
            self.directory = directory
        } else {
            let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            self.directory = base?.appending(path: "LearnFRC/Cache", directoryHint: .isDirectory)
        }
    }

    nonisolated private func url(for file: File) -> URL? {
        directory?.appending(path: file.rawValue, directoryHint: .notDirectory)
    }

    /// Reads a cached value. nil when missing, unreadable, or from an older schema.
    /// Off the actor and off the main thread, so several files decode at once.
    @concurrent
    nonisolated func load<Value: Codable & Sendable>(_ type: Value.Type, from file: File) async -> Envelope<Value>? {
        guard isEnabled, let url = url(for: file) else { return nil }
        // Read straight away rather than asking whether the file exists first (a path check
        // built from `url.path()` is percent-encoded, "Application%20Support", and never matched,
        // so the cache was never read). A missing file is simply nothing cached yet.
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile || error.code == .fileNoSuchFile {
            return nil
        } catch {
            Log.data.error("Cache \(file.rawValue, privacy: .public) unreadable, ignoring it: \(String(describing: error), privacy: .public)")
            return nil
        }
        do {
            let envelope = try JSONCoding.decode(Envelope<Value>.self, from: data, context: "cache \(file.rawValue)")
            guard envelope.schema == Envelope<Value>.currentSchema else { return nil }
            return envelope
        } catch {
            Log.data.error("Cache \(file.rawValue, privacy: .public) unreadable, ignoring it: \(String(describing: error), privacy: .public)")
            return nil
        }
    }

    /// Writes a value atomically.
    func save<Value: Codable & Sendable>(_ value: Value, to file: File, fetchedAt: Date = .now) {
        guard isEnabled, let directory, let url = url(for: file) else { return }
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let envelope = Envelope(schema: Envelope<Value>.currentSchema, fetchedAt: fetchedAt, value: value)
            let data = try JSONCoding.encoder().encode(envelope)
            try data.write(to: url, options: [.atomic])
            excludeFromBackup(url)
        } catch {
            Log.data.error("Cache write \(file.rawValue, privacy: .public) failed: \(String(describing: error), privacy: .public)")
        }
    }

    func remove(_ file: File) {
        guard isEnabled, let url = url(for: file) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    /// Where the community screens keep their last answers (`Caches/LearnFRC/Community`):
    /// leaderboards and the signed-in account's team sheet, which lists teammates' usernames
    /// and progress.
    static var communityDirectory: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appending(path: "LearnFRC/Community", directoryHint: .isDirectory)
    }

    /// Removes what belongs to the account that was signed in, on sign-out and account
    /// deletion: its `/me` and the community caches (team sheets name teammates).
    ///
    /// `progress.json` and `queue.json` stay: `ProgressStore` has already dropped the account's
    /// snapshot from them (and, on deletion, its queued writes); what's left is this device's
    /// guest progress, and lessons queued offline for an account that wait for it to sign in again.
    func removePersonalFiles() {
        remove(.me)
        guard isEnabled, let community = Self.communityDirectory else { return }
        try? FileManager.default.removeItem(at: community)
    }

    private func excludeFromBackup(_ url: URL) {
        // Content is re-downloadable; progress lives on the server for accounts.
        // Keep guest progress (progress.json, queue.json) in backups.
        guard url.lastPathComponent != File.progress.rawValue, url.lastPathComponent != File.queue.rawValue else { return }
        var url = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? url.setResourceValues(values)
    }
}
