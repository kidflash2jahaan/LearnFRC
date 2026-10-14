import Foundation

// Progress shapes from `/api/app/me/progress` and `/api/app/progress/complete`
// (camelCase). Rhythm, DayCell, RhythmCopy and NextUnlock mirror
// `src/lib/streaks.ts` and `src/app/api/me/progress/route.ts` exactly.

/// The phases `computeRhythm` can return.
enum RhythmPhase: String, Codable, Hashable, Sendable, CaseIterable {
    /// No lessons ever.
    case new
    /// Exactly one lesson, ever.
    case firstLesson = "first-lesson"
    /// 1...goal-1 this window, and they've been here before.
    case building
    /// Hit the mark.
    case goalMet = "goal-met"
    /// Came back after a gap of 3+ days.
    case returning
    /// Has history, nothing yet this window.
    case resting

    init(from decoder: any Decoder) throws {
        let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
        if let phase = RhythmPhase(rawValue: raw) {
            self = phase
        } else {
            Log.decode.error("Unknown rhythm phase \(raw, privacy: .public); treating it as resting")
            self = .resting
        }
    }
}

/// One square in the seven-day strip.
struct DayCell: Codable, Hashable, Sendable, Identifiable {
    /// `YYYY-MM-DD`
    let key: String
    /// "Mon", from a constant table
    let label: String
    let dayOfMonth: Int
    /// Lessons completed that day.
    let count: Int
    let isToday: Bool
    /// Days of the window that haven't happened yet (first week only).
    let isFuture: Bool

    var id: String { key }

    init(key: String, label: String, dayOfMonth: Int, count: Int, isToday: Bool, isFuture: Bool) {
        self.key = key
        self.label = label
        self.dayOfMonth = dayOfMonth
        self.count = count
        self.isToday = isToday
        self.isFuture = isFuture
    }

    private enum CodingKeys: String, CodingKey { case key, label, dayOfMonth, count, isToday, isFuture }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let key = try c.requiredString(forKey: .key)
        self.init(
            key: key,
            label: c.flexibleString(forKey: .label) ?? "",
            dayOfMonth: c.flexibleInt(forKey: .dayOfMonth) ?? Int(key.suffix(2)) ?? 0,
            count: c.flexibleInt(forKey: .count) ?? 0,
            isToday: c.flexibleBool(forKey: .isToday) ?? false,
            isFuture: c.flexibleBool(forKey: .isFuture) ?? false
        )
    }
}

/// The five-lessons-a-week rhythm. Computed by the server in UTC for accounts;
/// computed on device (same rules) only for guests. Never recompute it for an account.
struct Rhythm: Codable, Hashable, Sendable {
    enum WindowKind: String, Codable, Hashable, Sendable {
        case firstWeek = "first-week"
        case week

        init(from decoder: any Decoder) throws {
            let raw = (try? decoder.singleValueContainer().decode(String.self)) ?? ""
            self = WindowKind(rawValue: raw) ?? .week
        }
    }

    let goal: Int
    let windowKind: WindowKind
    /// "your first week" / "this week"
    let windowLabel: String
    let windowStartKey: String
    let windowEndKey: String
    let windowCount: Int
    let remaining: Int
    /// 0...100
    let pct: Int
    /// Exactly seven cells, oldest first.
    let days: [DayCell]
    let daysActiveInWindow: Int
    let lifetime: Int
    let activeDays: Int
    /// A record, never a stake. Don't build threat copy on it.
    let currentStreak: Int
    let bestStreak: Int
    let bestWindow: Int
    let daysSinceLast: Int?
    /// Computed but deliberately not shown (naming the gap is scorekeeping about absence).
    let returnedAfterDays: Int?
    let phase: RhythmPhase

    init(
        goal: Int, windowKind: WindowKind, windowLabel: String, windowStartKey: String, windowEndKey: String,
        windowCount: Int, remaining: Int, pct: Int, days: [DayCell], daysActiveInWindow: Int, lifetime: Int,
        activeDays: Int, currentStreak: Int, bestStreak: Int, bestWindow: Int, daysSinceLast: Int?,
        returnedAfterDays: Int?, phase: RhythmPhase
    ) {
        self.goal = goal
        self.windowKind = windowKind
        self.windowLabel = windowLabel
        self.windowStartKey = windowStartKey
        self.windowEndKey = windowEndKey
        self.windowCount = windowCount
        self.remaining = remaining
        self.pct = pct
        self.days = days
        self.daysActiveInWindow = daysActiveInWindow
        self.lifetime = lifetime
        self.activeDays = activeDays
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.bestWindow = bestWindow
        self.daysSinceLast = daysSinceLast
        self.returnedAfterDays = returnedAfterDays
        self.phase = phase
    }

    private enum CodingKeys: String, CodingKey {
        case goal, windowKind, windowLabel, windowStartKey, windowEndKey, windowCount, remaining, pct, days
        case daysActiveInWindow, lifetime, activeDays, currentStreak, bestStreak, bestWindow, daysSinceLast
        case returnedAfterDays, phase
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let goal = max(1, c.flexibleInt(forKey: .goal) ?? 5)
        let windowCount = c.flexibleInt(forKey: .windowCount) ?? 0
        let kind = (try? c.decodeIfPresent(WindowKind.self, forKey: .windowKind)) ?? .week
        self.init(
            goal: goal,
            windowKind: kind,
            windowLabel: c.flexibleString(forKey: .windowLabel) ?? (kind == .firstWeek ? "your first week" : "this week"),
            windowStartKey: c.flexibleString(forKey: .windowStartKey) ?? "",
            windowEndKey: c.flexibleString(forKey: .windowEndKey) ?? "",
            windowCount: windowCount,
            remaining: c.flexibleInt(forKey: .remaining) ?? max(0, goal - windowCount),
            pct: c.flexibleInt(forKey: .pct) ?? 0,
            days: c.lossyArray(DayCell.self, forKey: .days),
            daysActiveInWindow: c.flexibleInt(forKey: .daysActiveInWindow) ?? 0,
            lifetime: c.flexibleInt(forKey: .lifetime) ?? 0,
            activeDays: c.flexibleInt(forKey: .activeDays) ?? 0,
            currentStreak: c.flexibleInt(forKey: .currentStreak) ?? 0,
            bestStreak: c.flexibleInt(forKey: .bestStreak) ?? 0,
            bestWindow: c.flexibleInt(forKey: .bestWindow) ?? 0,
            daysSinceLast: c.flexibleInt(forKey: .daysSinceLast),
            returnedAfterDays: c.flexibleInt(forKey: .returnedAfterDays),
            phase: (try? c.decodeIfPresent(RhythmPhase.self, forKey: .phase)) ?? .resting
        )
    }

    /// 0...1 toward the goal.
    var fraction: Double { min(1, Double(pct) / 100) }
    var isGoalMet: Bool { windowCount >= goal }
}

/// Copy for the weekly-goal card, from `describeRhythm`. Shown as sent.
struct RhythmCopy: Codable, Hashable, Sendable {
    let eyebrow: String
    let headline: String
    let body: String
    /// Label for the primary action, e.g. "Start your first lesson".
    let cta: String

    init(eyebrow: String, headline: String, body: String, cta: String) {
        self.eyebrow = eyebrow
        self.headline = headline
        self.body = body
        self.cta = cta
    }

    private enum CodingKeys: String, CodingKey { case eyebrow, headline, body, cta }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            eyebrow: c.flexibleString(forKey: .eyebrow) ?? "",
            headline: c.flexibleString(forKey: .headline) ?? "",
            body: c.flexibleString(forKey: .body) ?? "",
            cta: c.flexibleString(forKey: .cta) ?? "Next lesson"
        )
    }
}

/// The nearest badge a learner can still reach (lesson-count badges only).
struct NextUnlock: Codable, Hashable, Sendable {
    let name: String
    let description: String
    /// Lucide icon name.
    let icon: String
    let progress: BadgeProgress

    init(name: String, description: String, icon: String, progress: BadgeProgress) {
        self.name = name
        self.description = description
        self.icon = icon
        self.progress = progress
    }

    private enum CodingKeys: String, CodingKey { case name, description, icon, progress }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            name: try c.requiredString(forKey: .name),
            description: c.flexibleString(forKey: .description) ?? "",
            icon: c.flexibleString(forKey: .icon) ?? "Award",
            progress: try c.decode(BadgeProgress.self, forKey: .progress)
        )
    }

    var systemImage: String { IconNames.systemImage(forLucide: icon, fallback: "rosette") }
}

/// One completed lesson.
struct Completion: Codable, Hashable, Sendable, Identifiable {
    let lessonID: UUID
    let completedAt: Date?
    let xpAwarded: Int

    var id: UUID { lessonID }

    init(lessonID: UUID, completedAt: Date?, xpAwarded: Int) {
        self.lessonID = lessonID
        self.completedAt = completedAt
        self.xpAwarded = xpAwarded
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        self.init(
            lessonID: try c.requiredUUID(forKey: c.firstKey("lessonId", "lesson_id", "lessonID")),
            completedAt: c.flexibleDate(forKey: c.firstKey("completedAt", "completed_at")),
            xpAwarded: c.flexibleInt(forKey: c.firstKey("xpAwarded", "xp_awarded")) ?? 0
        )
    }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: AnyCodingKey.self)
        try c.encode(lessonID, forKey: AnyCodingKey("lessonId"))
        try c.encodeIfPresent(completedAt, forKey: AnyCodingKey("completedAt"))
        try c.encode(xpAwarded, forKey: AnyCodingKey("xpAwarded"))
    }
}

/// A bookmarked lesson. Decodes both the route's camelCase and a Supabase row.
struct Bookmark: Codable, Hashable, Sendable, Identifiable {
    let lessonID: UUID
    let createdAt: Date?

    var id: UUID { lessonID }

    init(lessonID: UUID, createdAt: Date?) {
        self.lessonID = lessonID
        self.createdAt = createdAt
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        self.init(
            lessonID: try c.requiredUUID(forKey: c.firstKey("lessonId", "lesson_id", "lessonID")),
            createdAt: c.flexibleDate(forKey: c.firstKey("createdAt", "created_at"))
        )
    }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: AnyCodingKey.self)
        try c.encode(lessonID, forKey: AnyCodingKey("lessonId"))
        try c.encodeIfPresent(createdAt, forKey: AnyCodingKey("createdAt"))
    }
}

/// A badge the signed-in learner has earned.
struct EarnedAchievement: Codable, Hashable, Sendable, Identifiable {
    let achievementID: UUID
    let slug: String
    let earnedAt: Date?

    var id: UUID { achievementID }

    init(achievementID: UUID, slug: String, earnedAt: Date?) {
        self.achievementID = achievementID
        self.slug = slug
        self.earnedAt = earnedAt
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        self.init(
            achievementID: try c.requiredUUID(forKey: c.firstKey("achievementId", "achievement_id", "achievementID", "id")),
            slug: c.flexibleString(forKey: AnyCodingKey("slug")) ?? "",
            earnedAt: c.flexibleDate(forKey: c.firstKey("earnedAt", "earned_at"))
        )
    }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: AnyCodingKey.self)
        try c.encode(achievementID, forKey: AnyCodingKey("achievementId"))
        try c.encode(slug, forKey: AnyCodingKey("slug"))
        try c.encodeIfPresent(earnedAt, forKey: AnyCodingKey("earnedAt"))
    }
}

/// `GET /api/app/me/progress`
struct ProgressSnapshot: Codable, Hashable, Sendable {
    let completions: [Completion]
    let bookmarks: [Bookmark]
    let earnedAchievements: [EarnedAchievement]
    let xp: Int
    let level: Int
    let rhythm: Rhythm?
    let rhythmCopy: RhythmCopy?
    let nextUnlock: NextUnlock?

    init(
        completions: [Completion], bookmarks: [Bookmark], earnedAchievements: [EarnedAchievement],
        xp: Int, level: Int, rhythm: Rhythm?, rhythmCopy: RhythmCopy?, nextUnlock: NextUnlock?
    ) {
        self.completions = completions
        self.bookmarks = bookmarks
        self.earnedAchievements = earnedAchievements
        self.xp = xp
        self.level = level
        self.rhythm = rhythm
        self.rhythmCopy = rhythmCopy
        self.nextUnlock = nextUnlock
    }

    private enum CodingKeys: String, CodingKey {
        case completions, bookmarks, earnedAchievements, xp, level, rhythm, rhythmCopy, nextUnlock
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let xp = max(0, c.flexibleInt(forKey: .xp) ?? 0)
        self.init(
            completions: c.lossyArray(Completion.self, forKey: .completions),
            bookmarks: c.lossyArray(Bookmark.self, forKey: .bookmarks),
            earnedAchievements: c.lossyArray(EarnedAchievement.self, forKey: .earnedAchievements),
            xp: xp,
            level: c.flexibleInt(forKey: .level) ?? XPRules.level(forXP: xp),
            rhythm: Self.decodeLogged(Rhythm.self, c, .rhythm),
            rhythmCopy: Self.decodeLogged(RhythmCopy.self, c, .rhythmCopy),
            nextUnlock: Self.decodeLogged(NextUnlock.self, c, .nextUnlock)
        )
    }

    private static func decodeLogged<T: Decodable>(_ type: T.Type, _ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) -> T? {
        do { return try c.decodeIfPresent(type, forKey: key) } catch {
            Log.decode.error("progress.\(key.stringValue, privacy: .public): \(JSONCoding.describe(error), privacy: .public)")
            return nil
        }
    }

    static let empty = ProgressSnapshot(
        completions: [], bookmarks: [], earnedAchievements: [], xp: 0, level: 1,
        rhythm: nil, rhythmCopy: nil, nextUnlock: nil
    )
}

/// A badge that a completion just unlocked (`newAchievements` in the complete response).
struct UnlockedAchievement: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let slug: String
    let name: String
    let description: String
    let icon: String

    init(id: UUID, slug: String, name: String, description: String, icon: String) {
        self.id = id
        self.slug = slug
        self.name = name
        self.description = description
        self.icon = icon
    }

    private enum CodingKeys: String, CodingKey { case id, slug, name, description, icon }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.requiredUUID(forKey: .id),
            slug: c.flexibleString(forKey: .slug) ?? "",
            name: c.flexibleString(forKey: .name) ?? "",
            description: c.flexibleString(forKey: .description) ?? "",
            icon: c.flexibleString(forKey: .icon) ?? "Award"
        )
    }

    var systemImage: String { IconNames.systemImage(forLucide: icon, fallback: "rosette") }
}

/// What `ProgressStore.complete` returns, whichever way the completion was saved.
struct CompletionResult: Codable, Hashable, Sendable {
    /// How the completion was saved.
    enum Delivery: String, Codable, Hashable, Sendable {
        /// Confirmed by learnfrc.com for the signed-in account. XP and badges are real.
        case server
        /// Saved for a guest (on this device and the site's guest record). No XP.
        case guest
        /// Offline or the site was busy: saved on this device, will sync. Show "saved, will sync".
        case queued
    }

    let ok: Bool
    /// The real XP for this lesson (10 to 20). 0 for guests and queued completions.
    let xpAwarded: Int
    let xp: Int
    let level: Int
    let newAchievements: [UnlockedAchievement]
    let completedCount: Int
    let rhythm: Rhythm?
    let rhythmCopy: RhythmCopy?
    var delivery: Delivery

    init(
        ok: Bool = true, xpAwarded: Int, xp: Int, level: Int, newAchievements: [UnlockedAchievement] = [],
        completedCount: Int, rhythm: Rhythm?, rhythmCopy: RhythmCopy?, delivery: Delivery
    ) {
        self.ok = ok
        self.xpAwarded = xpAwarded
        self.xp = xp
        self.level = level
        self.newAchievements = newAchievements
        self.completedCount = completedCount
        self.rhythm = rhythm
        self.rhythmCopy = rhythmCopy
        self.delivery = delivery
    }

    private enum CodingKeys: String, CodingKey {
        case ok, xpAwarded, xp, level, newAchievements, completedCount, rhythm, rhythmCopy, delivery
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let xp = max(0, c.flexibleInt(forKey: .xp) ?? 0)
        self.init(
            ok: c.flexibleBool(forKey: .ok) ?? true,
            xpAwarded: c.flexibleInt(forKey: .xpAwarded) ?? 0,
            xp: xp,
            level: c.flexibleInt(forKey: .level) ?? XPRules.level(forXP: xp),
            newAchievements: c.lossyArray(UnlockedAchievement.self, forKey: .newAchievements),
            completedCount: c.flexibleInt(forKey: .completedCount) ?? 0,
            rhythm: try? c.decodeIfPresent(Rhythm.self, forKey: .rhythm),
            rhythmCopy: try? c.decodeIfPresent(RhythmCopy.self, forKey: .rhythmCopy),
            delivery: (try? c.decodeIfPresent(Delivery.self, forKey: .delivery)) ?? .server
        )
    }

    var isConfirmed: Bool { delivery == .server }
    var isQueued: Bool { delivery == .queued }
}

/// `DELETE /api/app/progress/complete?lessonId=`
struct UncompleteResult: Codable, Hashable, Sendable {
    let ok: Bool
    let xp: Int
    let level: Int
    let completedCount: Int

    private enum CodingKeys: String, CodingKey { case ok, xp, level, completedCount }

    init(ok: Bool, xp: Int, level: Int, completedCount: Int) {
        self.ok = ok
        self.xp = xp
        self.level = level
        self.completedCount = completedCount
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let xp = max(0, c.flexibleInt(forKey: .xp) ?? 0)
        self.init(
            ok: c.flexibleBool(forKey: .ok) ?? true,
            xp: xp,
            level: c.flexibleInt(forKey: .level) ?? XPRules.level(forXP: xp),
            completedCount: c.flexibleInt(forKey: .completedCount) ?? 0
        )
    }
}

/// The site's XP rules: 10 XP a lesson plus up to 10 for a streak (server-side),
/// level = floor(xp / 100) + 1, and the public-profile tiers.
enum XPRules {
    static let xpPerLevel = 100

    static func level(forXP xp: Int) -> Int { max(0, xp) / xpPerLevel + 1 }
    /// XP earned inside the current level (0...99).
    static func xpIntoLevel(_ xp: Int) -> Int { max(0, xp) % xpPerLevel }
    /// XP still needed for the next level (1...100).
    static func xpToNextLevel(_ xp: Int) -> Int { xpPerLevel - xpIntoLevel(xp) }

    /// `src/app/u/[username]/page.tsx`: Champion, All-Star, Veteran, Contender, Rookie.
    static func tier(forLevel level: Int) -> String {
        switch level {
        case 25...: "Champion"
        case 15...: "All-Star"
        case 8...: "Veteran"
        case 3...: "Contender"
        default: "Rookie"
        }
    }
}
