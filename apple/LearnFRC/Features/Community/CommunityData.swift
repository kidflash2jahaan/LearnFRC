import Foundation
import SwiftUI
import Synchronization

// The data the community screens read: leaderboards, my team and public profiles.
//
// Rules live on learnfrc.com. These screens only read `/api/app/leaderboard`,
// `/api/app/team` and `/api/app/u/{username}` and show what comes back. Every
// type here identifies people by username only; nothing carries a full name.
//
// Integrator note: `BoardSheet` decodes the whole leaderboard response (the
// level from all-time XP, the per-member team board, the site totals), which
// Core's `LeaderboardPayload` leaves out. It could be promoted to Core and
// fetched through `APIClient` later; until then the public route is read here.

// MARK: - Leaderboard

/// A learner on the weekly or all-time board.
struct BoardLearner: Codable, Hashable, Sendable, Identifiable {
    let rank: Int
    let username: String?
    let avatarUrl: String?
    let teamNumber: Int?
    let role: String
    /// Weekly board: XP from the last seven days. All-time board: every XP point.
    let xp: Int
    /// Always from all-time XP, on both boards.
    let level: Int
    /// Weekly board: lessons from the last seven days. All-time board: all of them.
    let lessons: Int

    var id: String { username.map { "u:\($0)" } ?? "r:\(rank)" }

    init(rank: Int, username: String?, avatarUrl: String? = nil, teamNumber: Int? = nil, role: String = "student",
         xp: Int, level: Int? = nil, lessons: Int) {
        self.rank = rank
        self.username = username
        self.avatarUrl = avatarUrl
        self.teamNumber = teamNumber
        self.role = role
        self.xp = xp
        self.level = level ?? XPRules.level(forXP: xp)
        self.lessons = lessons
    }

    private enum CodingKeys: String, CodingKey { case rank, username, avatarUrl, teamNumber, role, xp, level, lessons }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let xp = max(0, c.flexibleInt(forKey: .xp) ?? 0)
        let name = c.flexibleString(forKey: .username)?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.init(
            rank: c.flexibleInt(forKey: .rank) ?? 0,
            username: (name?.isEmpty ?? true) ? nil : name,
            avatarUrl: c.flexibleString(forKey: .avatarUrl),
            teamNumber: c.flexibleInt(forKey: .teamNumber),
            role: c.flexibleString(forKey: .role) ?? "student",
            xp: xp,
            level: c.flexibleInt(forKey: .level),
            lessons: c.flexibleInt(forKey: .lessons) ?? 0
        )
    }

    /// Usernames only, never real names (the site's `displayName`).
    var displayName: String { username ?? "Learner" }
    var avatarURL: URL? { CommunityFormat.safeURL(avatarUrl) }
    /// "team 9765 / student"
    var detailSlug: String { CommunityFormat.teamRoleSlug(teamNumber: teamNumber, role: role) }
}

/// A team on the teams board.
struct BoardTeam: Codable, Hashable, Sendable, Identifiable {
    let rank: Int
    let teamNumber: Int
    let members: Int
    /// Combined XP of everyone with that team number.
    let xp: Int
    let avgXp: Int

    var id: Int { teamNumber }

    init(rank: Int, teamNumber: Int, members: Int, xp: Int, avgXp: Int? = nil) {
        self.rank = rank
        self.teamNumber = teamNumber
        self.members = members
        self.xp = xp
        self.avgXp = avgXp ?? (members > 0 ? xp / members : xp)
    }

    private enum CodingKeys: String, CodingKey { case rank, teamNumber, members, xp, avgXp }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        guard let number = c.flexibleInt(forKey: .teamNumber) else {
            throw DecodingError.keyNotFound(CodingKeys.teamNumber, .init(codingPath: c.codingPath, debugDescription: "A team row needs a number"))
        }
        self.init(
            rank: c.flexibleInt(forKey: .rank) ?? 0,
            teamNumber: number,
            members: c.flexibleInt(forKey: .members) ?? 0,
            xp: max(0, c.flexibleInt(forKey: .xp) ?? 0),
            avgXp: c.flexibleInt(forKey: .avgXp)
        )
    }
}

/// The site-wide figures printed on the leaderboard's blue band.
struct BoardTotals: Codable, Hashable, Sendable {
    /// Accounts that have earned any XP (not every account).
    let learners: Int
    let totalXp: Int

    init(learners: Int, totalXp: Int) {
        self.learners = learners
        self.totalXp = totalXp
    }

    private enum CodingKeys: String, CodingKey { case learners, totalXp }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(learners: c.flexibleInt(forKey: .learners) ?? 0, totalXp: c.flexibleInt(forKey: .totalXp) ?? 0)
    }
}

/// One `GET /api/app/leaderboard?board=` response, whole.
struct BoardSheet: Codable, Hashable, Sendable {
    let board: LeaderboardBoard
    /// The weekly and all-time boards.
    let learners: [BoardLearner]
    /// The teams board, by combined XP.
    let teams: [BoardTeam]
    /// The teams board, by XP per member, teams with `minMembers` or more only.
    let teamsPerMember: [BoardTeam]
    let minMembers: Int
    let totals: BoardTotals?

    init(board: LeaderboardBoard, learners: [BoardLearner] = [], teams: [BoardTeam] = [],
         teamsPerMember: [BoardTeam] = [], minMembers: Int = 3, totals: BoardTotals? = nil) {
        self.board = board
        self.learners = learners
        self.teams = teams
        self.teamsPerMember = teamsPerMember
        self.minMembers = minMembers
        self.totals = totals
    }

    private enum CodingKeys: String, CodingKey { case board, entries, perMember, minMembers, totals }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let board = c.flexibleString(forKey: .board).flatMap(LeaderboardBoard.init(rawValue:)) ?? .weekly
        let totals = try? c.decodeIfPresent(BoardTotals.self, forKey: .totals)
        if board == .teams {
            let teams = c.lossyArray(BoardTeam.self, forKey: .entries)
            let minMembers = c.flexibleInt(forKey: .minMembers) ?? 3
            var perMember = c.lossyArray(BoardTeam.self, forKey: .perMember)
            if !c.contains(.perMember) {
                // An older route without the second ranking: rank what we have the same way.
                perMember = teams.filter { $0.members >= minMembers }
                    .sorted { $0.avgXp != $1.avgXp ? $0.avgXp > $1.avgXp : $0.teamNumber < $1.teamNumber }
                    .enumerated()
                    .map { BoardTeam(rank: $0.offset + 1, teamNumber: $0.element.teamNumber, members: $0.element.members, xp: $0.element.xp, avgXp: $0.element.avgXp) }
            }
            self.init(board: board, teams: teams, teamsPerMember: perMember, minMembers: minMembers, totals: totals)
        } else {
            self.init(board: board, learners: c.lossyArray(BoardLearner.self, forKey: .entries), totals: totals)
        }
    }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(board, forKey: .board)
        if board == .teams {
            try c.encode(teams, forKey: .entries)
            try c.encode(teamsPerMember, forKey: .perMember)
            try c.encode(minMembers, forKey: .minMembers)
        } else {
            try c.encode(learners, forKey: .entries)
        }
        try c.encodeIfPresent(totals, forKey: .totals)
    }

    var isEmpty: Bool { board == .teams ? teams.isEmpty : learners.isEmpty }
}

// MARK: - The client

/// A value and when it was fetched.
struct CommunityStamped<Value: Sendable>: Sendable {
    let value: Value
    let fetchedAt: Date
}

/// Where the community screens get their data. The live client reads learnfrc.com and keeps
/// the last answer on device, so the boards and the team sheet open offline. Previews swap in
/// `.preview`.
///
///     LeaderboardView().environment(\.communityClient, .preview)
struct CommunityClient: Sendable {
    /// The last board fetched on this device, instantly.
    var cachedBoard: @Sendable (LeaderboardBoard) async -> CommunityStamped<BoardSheet>?
    /// A fresh board from learnfrc.com (also saved for next time).
    var board: @Sendable (LeaderboardBoard) async throws -> BoardSheet
    /// The last team sheet fetched for this account. `team == nil` means no team number.
    var cachedTeam: @Sendable (_ userID: UUID) async -> CommunityStamped<TeamPayload>?
    /// A fresh team sheet for the signed-in account. nil when there's no team number.
    var team: @Sendable (_ userID: UUID) async throws -> Team?
    /// A profile already seen this session.
    var cachedProfile: @Sendable (_ username: String) async -> CommunityStamped<PublicProfile>?
    /// A fresh public profile. nil when there's nobody with that username.
    var profile: @Sendable (_ username: String) async throws -> PublicProfile?

    /// What this session already fetched, synchronously, so a screen opened a second time
    /// (or a preview) draws its data on the first frame instead of a placeholder.
    var instantBoard: @Sendable (LeaderboardBoard) -> CommunityStamped<BoardSheet>? = { _ in nil }
    var instantTeam: @Sendable (_ userID: UUID) -> CommunityStamped<TeamPayload>? = { _ in nil }
    var instantProfile: @Sendable (_ username: String) -> CommunityStamped<PublicProfile>? = { _ in nil }
}

extension CommunityClient {
    /// learnfrc.com, with an on-device copy of each answer.
    static let live: CommunityClient = {
        let cache = CommunityCache.shared
        let session = CommunitySessionMemory.shared
        @Sendable func boardKey(_ board: LeaderboardBoard) -> String { "board-\(board.rawValue)" }
        @Sendable func teamKey(_ userID: UUID) -> String { CommunityCache.teamKey(userID) }
        @Sendable func profileKey(_ username: String) -> String { "u-\(username.lowercased())" }
        return CommunityClient(
            cachedBoard: { board in
                let saved = await cache.load(BoardSheet.self, key: boardKey(board))
                if let saved { session.keep(saved, for: boardKey(board)) }
                return saved
            },
            board: { board in
                let sheet = try await CommunityRemote.fetchBoard(board)
                session.keep(CommunityStamped(value: sheet, fetchedAt: .now), for: boardKey(board))
                await cache.save(sheet, key: boardKey(board))
                return sheet
            },
            cachedTeam: { userID in
                let saved = await cache.load(TeamPayload.self, key: teamKey(userID))
                if let saved { session.keep(saved, for: teamKey(userID)) }
                return saved
            },
            team: { userID in
                let team = try await APIClient.shared.team()
                session.keep(CommunityStamped(value: TeamPayload(team: team), fetchedAt: .now), for: teamKey(userID))
                await cache.save(TeamPayload(team: team), key: teamKey(userID))
                return team
            },
            cachedProfile: { username in session.value(PublicProfile.self, for: profileKey(username)) },
            profile: { username in
                let profile = try await APIClient.shared.publicProfile(username: username)
                if let profile {
                    session.keep(CommunityStamped(value: profile, fetchedAt: .now), for: profileKey(username))
                }
                return profile
            },
            instantBoard: { board in session.value(BoardSheet.self, for: boardKey(board)) },
            instantTeam: { userID in session.value(TeamPayload.self, for: teamKey(userID)) },
            instantProfile: { username in session.value(PublicProfile.self, for: profileKey(username)) }
        )
    }()
}

extension EnvironmentValues {
    /// The community data source. Live by default; previews pass `.preview`.
    @Entry var communityClient: CommunityClient = AppConfig.isRunningPreviews ? .preview : .live
}

// MARK: - Live transport

/// The public leaderboard route, read whole.
enum CommunityRemote {
    static func fetchBoard(_ board: LeaderboardBoard) async throws -> BoardSheet {
        var components = URLComponents(url: AppConfig.apiBase.appending(path: "api/app/leaderboard"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "board", value: board.rawValue)]
        guard let url = components?.url else { throw APIError.server }
        var request = URLRequest(url: url, timeoutInterval: 20)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("learnfrc-apple/\(AppConfig.appVersion)", forHTTPHeaderField: "X-Client-Info")
        request.setValue(AppConfig.platformSource, forHTTPHeaderField: "X-LearnFRC-Client")
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIError.server }
            guard (200..<300).contains(http.statusCode) else {
                throw APIError.from(status: http.statusCode, data: data, headers: http)
            }
            return try JSONCoding.decode(BoardSheet.self, from: data, context: "leaderboard \(board.rawValue)")
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.from(error)
        }
    }

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 40
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }()
}

/// The last answer for each board, team sheet and profile: in memory for the session,
/// and in Caches (boards and team sheets) so they open offline. Usernames only.
actor CommunityCache {
    static let shared = CommunityCache()

    private struct Envelope<Value: Codable>: Codable {
        let fetchedAt: Date
        let value: Value
    }

    private var memory: [String: (data: Data, fetchedAt: Date)] = [:]
    private let directory: URL?
    private let usesDisk: Bool

    init(enabled: Bool = !AppConfig.isRunningPreviews) {
        usesDisk = enabled
        // The same folder `CacheStore.removePersonalFiles()` deletes on sign-out and deletion.
        directory = CacheStore.communityDirectory
    }

    func load<Value: Codable & Sendable>(_ type: Value.Type, key: String, memoryOnly: Bool = false) -> CommunityStamped<Value>? {
        if let hit = memory[key], let value = try? JSONCoding.decoder().decode(Value.self, from: hit.data) {
            return CommunityStamped(value: value, fetchedAt: hit.fetchedAt)
        }
        guard usesDisk, !memoryOnly, let url = fileURL(key), let data = try? Data(contentsOf: url),
              let envelope = try? JSONCoding.decoder().decode(Envelope<Value>.self, from: data) else { return nil }
        if let encoded = try? JSONCoding.encoder().encode(envelope.value) {
            memory[key] = (encoded, envelope.fetchedAt)
        }
        return CommunityStamped(value: envelope.value, fetchedAt: envelope.fetchedAt)
    }

    func save<Value: Codable & Sendable>(_ value: Value, key: String, memoryOnly: Bool = false, at date: Date = .now) {
        guard let encoded = try? JSONCoding.encoder().encode(value) else { return }
        memory[key] = (encoded, date)
        guard usesDisk, !memoryOnly, let directory, let url = fileURL(key) else { return }
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONCoding.encoder().encode(Envelope(fetchedAt: date, value: value))
            try data.write(to: url, options: [.atomic])
        } catch {
            Log.data.error("Community cache write failed: \(String(describing: error), privacy: .public)")
        }
    }

    private func fileURL(_ key: String) -> URL? {
        let safe = key.unicodeScalars.map { CharacterSet.alphanumerics.contains($0) || $0 == "-" ? String($0) : "_" }.joined()
        return directory?.appending(path: "\(safe).json", directoryHint: .notDirectory)
    }

    /// The key an account's team sheet is kept under.
    nonisolated static func teamKey(_ userID: UUID) -> String { "\(teamKeyPrefix)\(userID.uuidString.lowercased())" }
    private nonisolated static let teamKeyPrefix = "team-"

    /// Forgets every team sheet this session holds in memory. Called when the device goes back
    /// to guest or the account is deleted (`AppModel`): the files went with
    /// `CacheStore.removePersonalFiles()`, and these copies name teammates too.
    func forgetTeams() {
        memory = memory.filter { !$0.key.hasPrefix(Self.teamKeyPrefix) }
        CommunitySessionMemory.shared.forgetAll(withPrefix: Self.teamKeyPrefix)
    }
}

/// This session's answers, readable synchronously from a view's body. Cleared when the app quits.
final class CommunitySessionMemory: Sendable {
    static let shared = CommunitySessionMemory()

    private let storage = Mutex<[String: any Sendable]>([:])

    func keep<Value: Sendable>(_ value: CommunityStamped<Value>, for key: String) {
        storage.withLock { $0[key] = value }
    }

    func value<Value: Sendable>(_ type: Value.Type, for key: String) -> CommunityStamped<Value>? {
        storage.withLock { $0[key] as? CommunityStamped<Value> }
    }

    func forgetAll(withPrefix prefix: String) {
        storage.withLock { $0 = $0.filter { !$0.key.hasPrefix(prefix) } }
    }
}

// MARK: - Loading state

/// What a screen knows about one remote value: the last copy (maybe from the cache),
/// whether a fetch is running, and the last error.
struct CommunityLoad<Value: Sendable>: Sendable {
    var value: Value?
    var fetchedAt: Date?
    var error: APIError?
    var isLoading = false
    /// True once a fetch has finished (with or without an error), so empty states stop guessing.
    var hasSettled = false

    var hasValue: Bool { value != nil }
    /// Showing a saved copy because the refresh failed.
    var isStale: Bool { value != nil && error != nil }

    mutating func begin() {
        isLoading = true
    }

    mutating func succeed(_ value: Value, at date: Date = .now) {
        self.value = value
        fetchedAt = date
        error = nil
        isLoading = false
        hasSettled = true
    }

    mutating func fail(_ error: any Error) {
        self.error = APIError.from(error)
        isLoading = false
        hasSettled = true
    }

    mutating func restore(_ stamped: CommunityStamped<Value>?) {
        guard value == nil, let stamped else { return }
        value = stamped.value
        fetchedAt = stamped.fetchedAt
    }
}

// MARK: - Formatting shared by the community screens

enum CommunityFormat {
    /// http(s) avatars only.
    static func safeURL(_ raw: String?) -> URL? {
        guard let raw, let url = URL(string: raw), let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme) else { return nil }
        return url
    }

    /// "team 9765 / student", or just "mentor" with no team.
    static func teamRoleSlug(teamNumber: Int?, role: String?) -> String {
        let roleText = ProfileRole(raw: role).displayName.lowercased()
        if let teamNumber { return "team \(teamNumber) / \(roleText)" }
        return roleText
    }

    /// "80 xp / level 5 / 8 lessons", with each fact held together (no-break spaces inside
    /// it), so a narrow line breaks only at the slashes, never between "level" and "5".
    static func facts(_ parts: String...) -> String {
        parts.map { $0.replacingOccurrences(of: " ", with: "\u{00A0}") }.joined(separator: " / ")
    }

    /// "1 lesson", "12 lessons"
    static func count(_ n: Int, _ singular: String, _ plural: String? = nil) -> String {
        "\(n.formatted()) \(n == 1 ? singular : (plural ?? singular + "s"))"
    }

    /// "Business, Operations & Fundraising" is "Business"; "Getting Started with FRC" is
    /// "Getting Started" (the site's `subteamLabel`).
    static func subteamLabel(_ name: String) -> String {
        var short = name.split(whereSeparator: { $0 == "," || $0 == "&" }).first.map(String.init) ?? name
        short = short.replacingOccurrences(of: #"^\s*the\s+"#, with: "", options: [.regularExpression, .caseInsensitive])
        short = short.replacingOccurrences(of: #"\s+with\s+FRC\s*$"#, with: "", options: [.regularExpression, .caseInsensitive])
        short = short.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return short.isEmpty ? name.trimmingCharacters(in: .whitespacesAndNewlines) : short
    }

    /// The site's `clampPct`: rounded and held to 0...100.
    static func percent(_ done: Int, of total: Int) -> Int {
        guard total > 0 else { return 0 }
        return max(0, min(100, Int((Double(done) / Double(total) * 100).rounded())))
    }

    /// "a, b and c", or "a, b, c and 2 more" past `limit`.
    static func list(_ items: [String], limit: Int = 3) -> String {
        let named = Array(items.prefix(limit))
        let rest = items.count - named.count
        if rest > 0 { return "\(named.joined(separator: ", ")) and \(rest) more" }
        if named.count <= 1 { return named.first ?? "" }
        return "\(named.dropLast().joined(separator: ", ")) and \(named[named.count - 1])"
    }

    /// "Oct 3, 2026"
    static func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    /// "Oct 2026"
    static func monthYear(_ date: Date) -> String {
        date.formatted(.dateTime.month(.abbreviated).year())
    }

    /// "Updated 3:04 PM" or "Updated Oct 3"
    static func updated(_ date: Date, now: Date = .now) -> String {
        if Calendar.current.isDate(date, inSameDayAs: now) {
            return "saved at \(date.formatted(date: .omitted, time: .shortened))"
        }
        return "saved \(date.formatted(.dateTime.month(.abbreviated).day()))"
    }
}

/// The referral links every invite surface hands out (the site's `teamInviteUrl` and
/// `InviteCard`). One URL per surface, so attribution never splits.
enum CommunityInviteLink {
    static func signup(ref username: String?, via: String?) -> URL {
        var components = URLComponents(url: AppConfig.webBase.appending(path: "signup"), resolvingAgainstBaseURL: false)
        var items: [URLQueryItem] = []
        if let username, !username.isEmpty {
            items.append(URLQueryItem(name: "ref", value: username))
            if let via { items.append(URLQueryItem(name: "via", value: via)) }
        }
        components?.queryItems = items.isEmpty ? nil : items
        return components?.url ?? AppConfig.webBase.appending(path: "signup")
    }

    /// "learnfrc.com/signup?ref=maya_builds", for printing next to a copy button.
    static func display(_ url: URL) -> String {
        var text = url.absoluteString
        for prefix in ["https://", "http://", "www."] where text.hasPrefix(prefix) {
            text.removeFirst(prefix.count)
        }
        return text
    }
}
