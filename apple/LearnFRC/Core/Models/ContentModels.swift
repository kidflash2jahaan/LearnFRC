import Foundation

/// A blog article (`articles` table). Same Markdown renderer as lessons.
struct Article: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let slug: String
    let title: String
    let description: String
    let keywords: [String]
    /// `YYYY-MM-DD`, exactly as stored.
    let date: String
    let readMins: Int
    let content: String
    let sortOrder: Int

    init(
        id: UUID, slug: String, title: String, description: String, keywords: [String] = [],
        date: String, readMins: Int = 5, content: String, sortOrder: Int = 0
    ) {
        self.id = id
        self.slug = slug
        self.title = title
        self.description = description
        self.keywords = keywords
        self.date = date
        self.readMins = readMins
        self.content = content
        self.sortOrder = sortOrder
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, title, description, keywords, date, content
        case readMins = "read_mins"
        case sortOrder = "sort_order"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.requiredUUID(forKey: .id),
            slug: try c.requiredString(forKey: .slug),
            title: try c.requiredString(forKey: .title),
            description: c.flexibleString(forKey: .description) ?? "",
            keywords: c.stringArray(forKey: .keywords),
            date: c.flexibleString(forKey: .date) ?? "",
            readMins: c.flexibleInt(forKey: .readMins) ?? 5,
            content: c.flexibleString(forKey: .content) ?? "",
            sortOrder: c.flexibleInt(forKey: .sortOrder) ?? 0
        )
    }

    /// The `date` column as a Date (midnight UTC), when it parses.
    var publishedDate: Date? { FlexibleDate.parse(String(date.prefix(10))) }
    /// `https://learnfrc.com/blog/{slug}`
    var webURL: URL { AppConfig.webBase.appending(path: "blog/\(slug)") }

    /// The site's order: newest `date` first, then `sort_order`.
    static func sortedLikeSite(_ articles: [Article]) -> [Article] {
        articles.sorted { a, b in
            if a.date != b.date { return a.date > b.date }
            return a.sortOrder < b.sortOrder
        }
    }
}

/// What an achievement asks for: `{type: lessons|departments, count}` or `{type: streak, days}`.
struct AchievementCriteria: Codable, Hashable, Sendable {
    enum Kind: String, Sendable { case lessons, departments, streak, unknown }

    let type: String?
    let count: Int?
    let days: Int?

    init(type: String?, count: Int? = nil, days: Int? = nil) {
        self.type = type
        self.count = count
        self.days = days
    }

    private enum CodingKeys: String, CodingKey { case type, count, days }

    init(from decoder: any Decoder) throws {
        guard let c = try? decoder.container(keyedBy: CodingKeys.self) else {
            self.init(type: nil)
            return
        }
        self.init(
            type: c.flexibleString(forKey: .type),
            count: c.flexibleInt(forKey: .count),
            days: c.flexibleInt(forKey: .days)
        )
    }

    var kind: Kind { type.flatMap(Kind.init(rawValue:)) ?? .unknown }

    /// The number to reach, whichever field this criteria uses.
    var target: Int? {
        switch kind {
        case .lessons, .departments: count
        case .streak: days
        case .unknown: nil
        }
    }

    /// Port of `achievementProgress` in `src/lib/streaks.ts`.
    func progress(lessons: Int, departments: Int, streak: Int) -> BadgeProgress? {
        switch kind {
        case .lessons:
            guard let count else { return nil }
            return BadgeProgress(current: min(lessons, count), target: count, unit: "lessons")
        case .departments:
            guard let count else { return nil }
            return BadgeProgress(current: min(departments, count), target: count, unit: count == 1 ? "department" : "departments")
        case .streak:
            guard let days else { return nil }
            return BadgeProgress(current: min(streak, days), target: days, unit: "day streak")
        case .unknown:
            return nil
        }
    }

    /// Port of `isNudgeableCriteria`: only lesson-count badges may be shown as a
    /// "next unlock". A streak badge is never dangled (it's a record, not a stake).
    var isNudgeable: Bool { kind == .lessons }
}

/// A badge from the `achievements` table.
struct Achievement: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let slug: String
    let name: String
    let description: String
    /// Lucide icon name. See `systemImage`.
    let icon: String
    let criteria: AchievementCriteria
    let sortOrder: Int

    init(id: UUID, slug: String, name: String, description: String, icon: String = "Award", criteria: AchievementCriteria, sortOrder: Int = 0) {
        self.id = id
        self.slug = slug
        self.name = name
        self.description = description
        self.icon = icon
        self.criteria = criteria
        self.sortOrder = sortOrder
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description, icon, criteria
        case sortOrder = "sort_order"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.requiredUUID(forKey: .id),
            slug: try c.requiredString(forKey: .slug),
            name: try c.requiredString(forKey: .name),
            description: c.flexibleString(forKey: .description) ?? "",
            icon: c.flexibleString(forKey: .icon) ?? "Award",
            criteria: (try? c.decodeIfPresent(AchievementCriteria.self, forKey: .criteria)) ?? AchievementCriteria(type: nil),
            sortOrder: c.flexibleInt(forKey: .sortOrder) ?? 0
        )
    }

    var systemImage: String { IconNames.systemImage(forLucide: icon, fallback: "rosette") }
}

/// Progress toward a locked badge, e.g. 3 / 5 lessons.
struct BadgeProgress: Codable, Hashable, Sendable {
    let current: Int
    let target: Int
    /// "lessons", "department(s)", "day streak"
    let unit: String

    init(current: Int, target: Int, unit: String) {
        self.current = current
        self.target = target
        self.unit = unit
    }

    private enum CodingKeys: String, CodingKey { case current, target, unit }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            current: c.flexibleInt(forKey: .current) ?? 0,
            target: c.flexibleInt(forKey: .target) ?? 0,
            unit: c.flexibleString(forKey: .unit) ?? ""
        )
    }

    /// 0...1
    var fraction: Double { target > 0 ? min(1, max(0, Double(current) / Double(target))) : 0 }
    var remaining: Int { max(0, target - current) }
}
