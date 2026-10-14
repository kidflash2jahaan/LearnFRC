import Foundation

// Leaderboards, teams. Usernames only: these never carry anyone's full name.

/// Which leaderboard.
enum LeaderboardBoard: String, Codable, Hashable, Sendable, CaseIterable, Identifiable {
    case weekly
    case alltime
    case teams

    var id: String { rawValue }

    var title: String {
        switch self {
        case .weekly: "This week"
        case .alltime: "All time"
        case .teams: "Teams"
        }
    }
}

/// One row on a board. People boards fill `username`/`lessons`; the teams board fills `teamNumber`/`members`.
struct LeaderboardEntry: Codable, Hashable, Sendable, Identifiable {
    let rank: Int
    let username: String?
    let avatarUrl: String?
    let teamNumber: Int?
    let role: String?
    let xp: Int
    let lessons: Int?
    let members: Int?

    var id: String {
        if let username { return "u:\(username)" }
        if let teamNumber { return "t:\(teamNumber)" }
        return "r:\(rank)"
    }

    init(
        rank: Int, username: String? = nil, avatarUrl: String? = nil, teamNumber: Int? = nil, role: String? = nil,
        xp: Int, lessons: Int? = nil, members: Int? = nil
    ) {
        self.rank = rank
        self.username = username
        self.avatarUrl = avatarUrl
        self.teamNumber = teamNumber
        self.role = role
        self.xp = xp
        self.lessons = lessons
        self.members = members
    }

    private enum CodingKeys: String, CodingKey { case rank, username, avatarUrl, teamNumber, role, xp, lessons, members }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            rank: c.flexibleInt(forKey: .rank) ?? 0,
            username: c.flexibleString(forKey: .username),
            avatarUrl: c.flexibleString(forKey: .avatarUrl),
            teamNumber: c.flexibleInt(forKey: .teamNumber),
            role: c.flexibleString(forKey: .role),
            xp: c.flexibleInt(forKey: .xp) ?? 0,
            lessons: c.flexibleInt(forKey: .lessons),
            members: c.flexibleInt(forKey: .members)
        )
    }

    var isTeam: Bool { username == nil && teamNumber != nil }
    var level: Int { XPRules.level(forXP: xp) }
    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)).flatMap { ["http", "https"].contains($0.scheme?.lowercased()) ? $0 : nil } }
}

/// `GET /api/app/leaderboard?board=`
struct LeaderboardPayload: Codable, Hashable, Sendable {
    let board: LeaderboardBoard
    let entries: [LeaderboardEntry]

    init(board: LeaderboardBoard, entries: [LeaderboardEntry]) {
        self.board = board
        self.entries = entries
    }

    private enum CodingKeys: String, CodingKey { case board, entries }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            board: c.flexibleString(forKey: .board).flatMap(LeaderboardBoard.init(rawValue:)) ?? .weekly,
            entries: c.lossyArray(LeaderboardEntry.self, forKey: .entries)
        )
    }
}

/// A member's progress in one department (the team page's strips).
struct MemberDeptProgress: Codable, Hashable, Sendable, Identifiable {
    struct Furthest: Codable, Hashable, Sendable {
        let title: String
        let moduleTitle: String?
    }

    struct Next: Codable, Hashable, Sendable {
        let title: String
        /// Site path like `/guides/dept/module/lesson`.
        let href: String?
    }

    let slug: String
    let name: String
    let completed: Int
    let total: Int
    let furthest: Furthest?
    let next: Next?

    var id: String { slug }

    init(slug: String, name: String, completed: Int, total: Int, furthest: Furthest? = nil, next: Next? = nil) {
        self.slug = slug
        self.name = name
        self.completed = completed
        self.total = total
        self.furthest = furthest
        self.next = next
    }

    private enum CodingKeys: String, CodingKey { case slug, name, completed, total, furthest, next }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            slug: try c.requiredString(forKey: .slug),
            name: c.flexibleString(forKey: .name) ?? "",
            completed: c.flexibleInt(forKey: .completed) ?? 0,
            total: c.flexibleInt(forKey: .total) ?? 0,
            furthest: try? c.decodeIfPresent(Furthest.self, forKey: .furthest),
            next: try? c.decodeIfPresent(Next.self, forKey: .next)
        )
    }

    var fraction: Double { total > 0 ? Double(completed) / Double(total) : 0 }
}

/// One person on my team.
struct TeamMember: Codable, Hashable, Sendable, Identifiable {
    let username: String
    let avatarUrl: String?
    let role: String?
    let xp: Int
    let isYou: Bool
    /// Lessons completed, all departments.
    let completed: Int
    let depts: [MemberDeptProgress]

    var id: String { username }

    init(username: String, avatarUrl: String? = nil, role: String? = nil, xp: Int, isYou: Bool, completed: Int, depts: [MemberDeptProgress]) {
        self.username = username
        self.avatarUrl = avatarUrl
        self.role = role
        self.xp = xp
        self.isYou = isYou
        self.completed = completed
        self.depts = depts
    }

    private enum CodingKeys: String, CodingKey { case username, avatarUrl, role, xp, isYou, completed, depts }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            username: try c.requiredString(forKey: .username),
            avatarUrl: c.flexibleString(forKey: .avatarUrl),
            role: c.flexibleString(forKey: .role),
            xp: c.flexibleInt(forKey: .xp) ?? 0,
            isYou: c.flexibleBool(forKey: .isYou) ?? false,
            completed: c.flexibleInt(forKey: .completed) ?? 0,
            depts: c.lossyArray(MemberDeptProgress.self, forKey: .depts)
        )
    }

    var roleKind: ProfileRole { ProfileRole(raw: role) }
    var level: Int { XPRules.level(forXP: xp) }
    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)).flatMap { ["http", "https"].contains($0.scheme?.lowercased()) ? $0 : nil } }
}

/// How much of one department the whole team covers between them.
struct SubteamCoverage: Codable, Hashable, Sendable, Identifiable {
    struct Contributor: Codable, Hashable, Sendable {
        /// Present when the route resolves ids to usernames.
        let username: String?
        let userId: String?
        let completed: Int

        init(username: String?, userId: String?, completed: Int) {
            self.username = username
            self.userId = userId
            self.completed = completed
        }

        private enum CodingKeys: String, CodingKey { case username, userId, completed }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.init(
                username: c.flexibleString(forKey: .username),
                userId: c.flexibleString(forKey: .userId),
                completed: c.flexibleInt(forKey: .completed) ?? 0
            )
        }
    }

    let slug: String
    let name: String
    let icon: String?
    let lessonCount: Int
    /// Distinct lessons finished by anyone on the team.
    let teamCompleted: Int
    let members: [Contributor]

    var id: String { slug }

    init(slug: String, name: String, icon: String? = nil, lessonCount: Int, teamCompleted: Int, members: [Contributor] = []) {
        self.slug = slug
        self.name = name
        self.icon = icon
        self.lessonCount = lessonCount
        self.teamCompleted = teamCompleted
        self.members = members
    }

    private enum CodingKeys: String, CodingKey { case slug, name, icon, lessonCount, teamCompleted, members }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            slug: try c.requiredString(forKey: .slug),
            name: c.flexibleString(forKey: .name) ?? "",
            icon: c.flexibleString(forKey: .icon),
            lessonCount: c.flexibleInt(forKey: .lessonCount) ?? 0,
            teamCompleted: c.flexibleInt(forKey: .teamCompleted) ?? 0,
            members: c.lossyArray(Contributor.self, forKey: .members)
        )
    }

    var fraction: Double { lessonCount > 0 ? Double(teamCompleted) / Double(lessonCount) : 0 }
    var isGap: Bool { teamCompleted == 0 }
}

/// My team (everyone with my team number).
struct Team: Codable, Hashable, Sendable, Identifiable {
    let number: Int
    let memberCount: Int
    let members: [TeamMember]
    let subteamCoverage: [SubteamCoverage]
    /// `https://learnfrc.com/signup?ref=<username>&via=team-invite`
    let inviteURL: URL?

    var id: Int { number }

    init(number: Int, memberCount: Int, members: [TeamMember], subteamCoverage: [SubteamCoverage], inviteURL: URL?) {
        self.number = number
        self.memberCount = memberCount
        self.members = members
        self.subteamCoverage = subteamCoverage
        self.inviteURL = inviteURL
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let members = c.lossyArray(TeamMember.self, forKey: AnyCodingKey("members"))
        guard let number = c.flexibleInt(forKey: AnyCodingKey("number")) else {
            throw DecodingError.keyNotFound(AnyCodingKey("number"), .init(codingPath: c.codingPath, debugDescription: "Team needs a number"))
        }
        self.init(
            number: number,
            memberCount: c.flexibleInt(forKey: AnyCodingKey("memberCount")) ?? members.count,
            members: members,
            subteamCoverage: c.lossyArray(SubteamCoverage.self, forKey: AnyCodingKey("subteamCoverage")),
            inviteURL: c.flexibleString(forKey: c.firstKey("inviteURL", "inviteUrl")).flatMap(URL.init(string:))
        )
    }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: AnyCodingKey.self)
        try c.encode(number, forKey: AnyCodingKey("number"))
        try c.encode(memberCount, forKey: AnyCodingKey("memberCount"))
        try c.encode(members, forKey: AnyCodingKey("members"))
        try c.encode(subteamCoverage, forKey: AnyCodingKey("subteamCoverage"))
        try c.encodeIfPresent(inviteURL, forKey: AnyCodingKey("inviteURL"))
    }

    var you: TeamMember? { members.first(where: \.isYou) }
    /// Departments nobody on the team has started.
    var gaps: [SubteamCoverage] { subteamCoverage.filter(\.isGap) }
}

/// `GET /api/app/team`: `{ team: null }` when I have no team number.
struct TeamPayload: Codable, Hashable, Sendable {
    let team: Team?

    init(team: Team?) { self.team = team }

    private enum CodingKeys: String, CodingKey { case team }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        do {
            team = try c.decodeIfPresent(Team.self, forKey: .team)
        } catch {
            Log.decode.error("team: \(JSONCoding.describe(error), privacy: .public)")
            team = nil
        }
    }
}
