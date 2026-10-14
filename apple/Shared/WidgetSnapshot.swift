import Foundation

/// What the widgets show, written by the app's `ProgressStore` after every change
/// to `snapshot.json` in the App Group container, and read by the widget extension.
///
/// The widget never touches tokens or the network. Copy rules apply here too:
/// no countdowns, no "don't lose your streak".
struct WidgetSnapshot: Codable, Hashable, Sendable {
    /// The lesson to pick up next.
    struct ContinueLesson: Codable, Hashable, Sendable {
        let id: UUID
        let title: String
        let departmentName: String
        let moduleTitle: String
        let minutes: Int

        init(id: UUID, title: String, departmentName: String, moduleTitle: String, minutes: Int) {
            self.id = id
            self.title = title
            self.departmentName = departmentName
            self.moduleTitle = moduleTitle
            self.minutes = minutes
        }

        /// `learnfrc://lesson/<id>`: opens the lesson in the app.
        var url: URL { WidgetSnapshot.lessonURL(id) }
    }

    /// One day in the seven-day strip.
    struct Day: Codable, Hashable, Sendable {
        let label: String
        let count: Int
        let isToday: Bool
        let isFuture: Bool

        init(label: String, count: Int, isToday: Bool, isFuture: Bool) {
            self.label = label
            self.count = count
            self.isToday = isToday
            self.isFuture = isFuture
        }
    }

    /// The weekly goal, as the server (or, for guests, this device) computed it.
    struct Rhythm: Codable, Hashable, Sendable {
        let goal: Int
        let windowCount: Int
        /// "your first week" / "this week"
        let windowLabel: String
        /// A record, never a stake.
        let currentStreak: Int
        let days: [Day]
        /// The one-line no-guilt summary (`rhythmMicrocopy`), e.g. "2 more makes the week."
        let microcopy: String?
        /// True for guests: counted on this device only.
        let onDevice: Bool

        init(goal: Int, windowCount: Int, windowLabel: String, currentStreak: Int, days: [Day], microcopy: String? = nil, onDevice: Bool = false) {
            self.goal = goal
            self.windowCount = windowCount
            self.windowLabel = windowLabel
            self.currentStreak = currentStreak
            self.days = days
            self.microcopy = microcopy
            self.onDevice = onDevice
        }

        /// 0...1 toward the goal.
        var fraction: Double { goal > 0 ? min(1, Double(windowCount) / Double(goal)) : 0 }
        var isGoalMet: Bool { windowCount >= goal }
    }

    let generatedAt: Date
    let continueLesson: ContinueLesson?
    let rhythm: Rhythm?
    let xp: Int
    let level: Int
    let completedTotal: Int
    let signedIn: Bool

    init(generatedAt: Date = .now, continueLesson: ContinueLesson?, rhythm: Rhythm?, xp: Int, level: Int, completedTotal: Int, signedIn: Bool) {
        self.generatedAt = generatedAt
        self.continueLesson = continueLesson
        self.rhythm = rhythm
        self.xp = xp
        self.level = level
        self.completedTotal = completedTotal
        self.signedIn = signedIn
    }

    /// Same content, ignoring when it was generated (to skip pointless widget reloads).
    func hasSameContent(as other: WidgetSnapshot) -> Bool {
        continueLesson == other.continueLesson && rhythm == other.rhythm && xp == other.xp
            && level == other.level && completedTotal == other.completedTotal && signedIn == other.signedIn
    }

    // MARK: Links

    static let scheme = "learnfrc"
    /// `learnfrc://home`
    static let homeURL = URL(string: "learnfrc://home")!
    /// `learnfrc://continue`: the app resolves the current continue lesson.
    static let continueURL = URL(string: "learnfrc://continue")!

    static func lessonURL(_ id: UUID) -> URL {
        URL(string: "learnfrc://lesson/\(id.uuidString.lowercased())")!
    }

    // MARK: File

    static let fileName = "snapshot.json"

    static var fileURL: URL? {
        AppGroup.containerURL?.appending(path: fileName, directoryHint: .notDirectory)
    }

    private static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    /// The last snapshot the app wrote, or nil (no App Group, or nothing written yet).
    static func read() -> WidgetSnapshot? {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder().decode(WidgetSnapshot.self, from: data)
    }

    /// The last snapshot, or `sample` when there isn't one (Mac builds without an App Group).
    static func readOrSample() -> WidgetSnapshot {
        read() ?? .sample
    }

    /// Writes atomically. Returns false when there's no App Group container (that's fine).
    @discardableResult
    func write() -> Bool {
        guard let url = Self.fileURL else { return false }
        do {
            let data = try Self.encoder().encode(self)
            try data.write(to: url, options: [.atomic])
            return true
        } catch {
            return false
        }
    }

    // MARK: Samples

    /// For widget previews and Mac builds without an App Group.
    static let sample = WidgetSnapshot(
        generatedAt: Date(timeIntervalSince1970: 1_791_000_000),
        continueLesson: ContinueLesson(
            id: UUID(uuidString: "075d3c3b-2f6f-4fe3-ab63-9cd02809eb2c")!,
            title: "Building Autonomous Routines",
            departmentName: "Programming, Controls & Sensors",
            moduleTitle: "Autonomous: Odometry, Trajectories, and Simulation",
            minutes: 40
        ),
        rhythm: Rhythm(
            goal: 5,
            windowCount: 3,
            windowLabel: "this week",
            currentStreak: 2,
            days: [
                Day(label: "Mon", count: 1, isToday: false, isFuture: false),
                Day(label: "Tue", count: 0, isToday: false, isFuture: false),
                Day(label: "Wed", count: 2, isToday: true, isFuture: false),
                Day(label: "Thu", count: 0, isToday: false, isFuture: false),
                Day(label: "Fri", count: 0, isToday: false, isFuture: false),
                Day(label: "Sat", count: 0, isToday: false, isFuture: false),
                Day(label: "Sun", count: 0, isToday: false, isFuture: false),
            ],
            microcopy: "2 more makes the week."
        ),
        xp: 245,
        level: 3,
        completedTotal: 19,
        signedIn: true
    )

    /// A first launch: nothing done yet (the real first lesson of Getting Started).
    static let empty = WidgetSnapshot(
        generatedAt: Date(timeIntervalSince1970: 1_791_000_000),
        continueLesson: ContinueLesson(
            id: UUID(uuidString: "eb956f1f-6624-4d0a-9f3b-048fe7db4f82")!,
            title: "What Is FIRST?",
            departmentName: "Getting Started with FRC",
            moduleTitle: "What FIRST and FRC Are",
            minutes: 25
        ),
        rhythm: nil,
        xp: 0,
        level: 1,
        completedTotal: 0,
        signedIn: false
    )
}
