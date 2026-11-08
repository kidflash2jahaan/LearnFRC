import Foundation

// Report and block (App Review guideline 1.2). The rules are the site's
// (src/lib/app/reports.ts and blocks.ts); these are the shapes of
// `/api/app/reports` and `/api/app/blocks`. Handles only: nothing here carries
// a real name, an email or a user id.

/// One reason a report can give (`GET /api/app/reports`).
struct ReportReason: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String

    /// The site's list, for the first report sheet opened before `/api/app/reports` has
    /// answered (offline, or a slow network). The server checks every reason it's sent.
    static let builtIn: [ReportReason] = [
        ReportReason(id: "harassment", label: "Bullying or harassment"),
        ReportReason(id: "offensive", label: "Offensive or inappropriate"),
        ReportReason(id: "personal_info", label: "Sharing someone's personal information"),
        ReportReason(id: "impersonation", label: "Pretending to be someone else"),
        ReportReason(id: "spam", label: "Spam or cheating"),
        ReportReason(id: "other", label: "Something else"),
    ]

    /// "Something else" needs a line of detail (the site's rule).
    var needsDetails: Bool { id == "other" }
}

/// `GET /api/app/reports`
struct ReportReasonsPayload: Decodable, Sendable {
    let reasons: [ReportReason]
    let detailsMax: Int
    let answerWithinHours: Int

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        reasons = c.lossyArray(ReportReason.self, forKey: AnyCodingKey("reasons"))
        detailsMax = c.flexibleInt(forKey: AnyCodingKey("detailsMax")) ?? 1000
        answerWithinHours = c.flexibleInt(forKey: AnyCodingKey("answerWithinHours")) ?? 24
    }
}

/// Where a report was filed from (the site allow-lists these).
enum ReportSurface: String, Codable, Sendable {
    case profile, leaderboard, team
}

/// `POST /api/app/reports` body. The app only reports profiles; edits and proposals are
/// reported on learnfrc.com/contributions, which the app has no screen for.
struct ReportRequest: Encodable, Sendable {
    let username: String
    let contentKind = "profile"
    let reason: String
    let details: String?
    let surface: ReportSurface
    let platform: String

    private enum CodingKeys: String, CodingKey { case username, contentKind, reason, details, surface, platform }
}

/// `POST /api/app/reports` answer.
struct ReportFiled: Decodable, Sendable {
    /// The site's sentence for the reporter, shown as sent.
    let message: String
    let alreadyReported: Bool

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        message = c.flexibleString(forKey: AnyCodingKey("message"))
            ?? "Thanks. Your report went to the LearnFRC team, and every report is read within 24 hours."
        alreadyReported = c.flexibleBool(forKey: AnyCodingKey("alreadyReported")) ?? false
    }
}

/// Someone the signed-in account has blocked (`GET /api/app/blocks`).
struct BlockedAccount: Codable, Hashable, Sendable, Identifiable {
    /// Their handle now. Nil only for an account with no handle, which can't be unblocked by
    /// name and isn't listed.
    let username: String?
    let avatarUrl: String?
    let blockedAt: Date?

    var id: String { username?.lowercased() ?? "?" }
    var avatarURL: URL? { CommunityFormat.safeURL(avatarUrl) }

    init(username: String?, avatarUrl: String? = nil, blockedAt: Date? = nil) {
        self.username = username
        self.avatarUrl = avatarUrl
        self.blockedAt = blockedAt
    }

    private enum CodingKeys: String, CodingKey { case username, avatarUrl, blockedAt }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let name = c.flexibleString(forKey: .username)?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.init(
            username: (name?.isEmpty ?? true) ? nil : name,
            avatarUrl: c.flexibleString(forKey: .avatarUrl),
            blockedAt: c.flexibleDate(forKey: .blockedAt)
        )
    }
}

/// `GET /api/app/blocks`
struct BlockedAccountsPayload: Decodable, Sendable {
    let blocks: [BlockedAccount]

    init(blocks: [BlockedAccount]) { self.blocks = blocks }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        blocks = c.lossyArray(BlockedAccount.self, forKey: AnyCodingKey("blocks"))
    }
}

/// `POST /api/app/blocks` answer.
struct BlockFiled: Decodable, Sendable {
    let block: BlockedAccount?

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        block = try? c.decodeIfPresent(BlockedAccount.self, forKey: AnyCodingKey("block"))
    }
}

extension BoardSheet {
    /// The board with anyone in `blocked` (lowercased handles) taken off. Ranks are kept as
    /// earned, as on the site, so a block never moves anybody up. Team boards are untouched.
    func hiding(_ blocked: Set<String>) -> BoardSheet {
        guard !blocked.isEmpty, board != .teams else { return self }
        let kept = learners.filter { entry in
            guard let name = entry.username?.lowercased() else { return true }
            return !blocked.contains(name)
        }
        guard kept.count != learners.count else { return self }
        return BoardSheet(board: board, learners: kept, totals: totals)
    }
}
