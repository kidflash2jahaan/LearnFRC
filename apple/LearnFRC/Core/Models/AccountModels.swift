import Foundation

// Account shapes from `/api/app/*` (camelCase). Privacy rule: `fullName` only
// ever exists on the signed-in user's own `Profile`; nothing here carries
// another person's full name.

/// A team role (`profiles.role`). Not site authority.
enum ProfileRole: String, Codable, Hashable, Sendable, CaseIterable, Identifiable {
    case student, mentor, alum, coach, other

    var id: String { rawValue }

    /// The site's labels (other reads "Member").
    var displayName: String {
        switch self {
        case .student: "Student"
        case .mentor: "Mentor"
        case .alum: "Alum"
        case .coach: "Coach"
        case .other: "Member"
        }
    }

    init(raw: String?) {
        self = raw.flatMap { ProfileRole(rawValue: $0.lowercased()) } ?? .student
    }
}

/// The signed-in user's own profile (the `/me` profile object).
struct Profile: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let username: String?
    /// Private: only shown to this user (certificate, settings). Never public.
    let fullName: String?
    let avatarUrl: String?
    let teamNumber: Int?
    let bio: String?
    let role: String
    let xp: Int
    let level: Int
    let tier: String
    let createdAt: Date?
    let emailOptIn: Bool
    /// nil means "never asked about reminder emails".
    let emailChoiceAt: Date?

    init(
        id: UUID, username: String?, fullName: String? = nil, avatarUrl: String? = nil, teamNumber: Int? = nil,
        bio: String? = nil, role: String = "student", xp: Int = 0, level: Int? = nil, tier: String? = nil,
        createdAt: Date? = nil, emailOptIn: Bool = false, emailChoiceAt: Date? = nil
    ) {
        let level = level ?? XPRules.level(forXP: xp)
        self.id = id
        self.username = username
        self.fullName = fullName
        self.avatarUrl = avatarUrl
        self.teamNumber = teamNumber
        self.bio = bio
        self.role = role
        self.xp = xp
        self.level = level
        self.tier = tier ?? XPRules.tier(forLevel: level)
        self.createdAt = createdAt
        self.emailOptIn = emailOptIn
        self.emailChoiceAt = emailChoiceAt
    }

    private enum CodingKeys: String, CodingKey {
        case id, username, fullName, avatarUrl, teamNumber, bio, role, xp, level, tier, createdAt, emailOptIn, emailChoiceAt
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let username = c.flexibleString(forKey: .username)?.trimmingCharacters(in: .whitespaces)
        self.init(
            id: try c.requiredUUID(forKey: .id),
            username: (username?.isEmpty ?? true) ? nil : username,
            fullName: c.flexibleString(forKey: .fullName),
            avatarUrl: c.flexibleString(forKey: .avatarUrl),
            teamNumber: c.flexibleInt(forKey: .teamNumber),
            bio: c.flexibleString(forKey: .bio),
            role: c.flexibleString(forKey: .role) ?? "student",
            xp: max(0, c.flexibleInt(forKey: .xp) ?? 0),
            level: c.flexibleInt(forKey: .level),
            tier: c.flexibleString(forKey: .tier),
            createdAt: c.flexibleDate(forKey: .createdAt),
            emailOptIn: c.flexibleBool(forKey: .emailOptIn) ?? false,
            emailChoiceAt: c.flexibleDate(forKey: .emailChoiceAt)
        )
    }

    var roleKind: ProfileRole { ProfileRole(raw: role) }
    /// http(s) avatars only.
    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)).flatMap { ["http", "https"].contains($0.scheme?.lowercased()) ? $0 : nil } }
    /// The name printed on certificates: full name, else username, else "FRC Learner" (the site's rule).
    var certificateName: String {
        if let fullName, !fullName.trimmingCharacters(in: .whitespaces).isEmpty { return fullName }
        if let username, !username.isEmpty { return username }
        return "FRC Learner"
    }
    /// "@username", or nil while the username isn't set.
    var handle: String? { username.map { "@\($0)" } }
    var xpIntoLevel: Int { XPRules.xpIntoLevel(xp) }
    var xpToNextLevel: Int { XPRules.xpToNextLevel(xp) }
}

/// `GET /api/app/me`
struct Me: Codable, Hashable, Sendable, Identifiable {
    struct User: Codable, Hashable, Sendable {
        let id: UUID
        let email: String?

        init(id: UUID, email: String?) {
            self.id = id
            self.email = email
        }

        private enum CodingKeys: String, CodingKey { case id, email }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.init(id: try c.requiredUUID(forKey: .id), email: c.flexibleString(forKey: .email))
        }
    }

    let user: User
    let profile: Profile
    /// The username gate: show `UsernameSetupView` before the rest of the app.
    let needsUsernameSetup: Bool
    let isPlaceholderUsername: Bool
    /// Show the one-time "Want reminder emails?" card.
    let emailPrompt: Bool
    let referralCount: Int
    /// The account's site role as `/api/app/me` reports it: "member", "admin" or "superadmin".
    /// Display only (`AdminStore.adopt`); every admin route checks the role again. Nil from an
    /// older site, or when this came from the device alone.
    let siteRole: String?
    /// True when this came from the session alone (offline, never fetched). Not part of the route.
    let isProvisional: Bool

    var id: UUID { user.id }

    init(
        user: User, profile: Profile, needsUsernameSetup: Bool, isPlaceholderUsername: Bool = false,
        emailPrompt: Bool = false, referralCount: Int = 0, siteRole: String? = nil, isProvisional: Bool = false
    ) {
        self.user = user
        self.profile = profile
        self.needsUsernameSetup = needsUsernameSetup
        self.isPlaceholderUsername = isPlaceholderUsername
        self.emailPrompt = emailPrompt
        self.referralCount = referralCount
        self.siteRole = siteRole
        self.isProvisional = isProvisional
    }

    private enum CodingKeys: String, CodingKey {
        case user, profile, needsUsernameSetup, isPlaceholderUsername, emailPrompt, referralCount, siteRole, isProvisional
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let user = try c.decode(User.self, forKey: .user)
        var profile: Profile
        do {
            profile = try c.decodeIfPresent(Profile.self, forKey: .profile) ?? Profile(id: user.id, username: nil)
        } catch {
            Log.decode.error("me.profile: \(JSONCoding.describe(error), privacy: .public)")
            profile = Profile(id: user.id, username: nil)
        }
        self.init(
            user: user,
            profile: profile,
            needsUsernameSetup: c.flexibleBool(forKey: .needsUsernameSetup) ?? (profile.username == nil),
            isPlaceholderUsername: c.flexibleBool(forKey: .isPlaceholderUsername) ?? false,
            emailPrompt: c.flexibleBool(forKey: .emailPrompt) ?? false,
            referralCount: c.flexibleInt(forKey: .referralCount) ?? 0,
            siteRole: c.flexibleString(forKey: .siteRole),
            isProvisional: c.flexibleBool(forKey: .isProvisional) ?? false
        )
    }

    /// A stand-in built from the session when the app is offline and has never fetched `/me`.
    /// It never gates on the username (that waits for the real answer).
    static func provisional(userID: UUID, email: String?) -> Me {
        Me(
            user: User(id: userID, email: email),
            profile: Profile(id: userID, username: nil),
            needsUsernameSetup: false,
            isProvisional: true
        )
    }

    /// The same Me with a new profile (after an edit).
    func replacing(profile: Profile) -> Me {
        Me(
            user: user, profile: profile,
            needsUsernameSetup: profile.username == nil,
            isPlaceholderUsername: profile.username == self.profile.username ? isPlaceholderUsername : false,
            emailPrompt: emailPrompt && profile.emailChoiceAt == nil,
            referralCount: referralCount,
            siteRole: siteRole
        )
    }

    /// The same Me with the email prompt answered.
    func answeringEmailPrompt(optIn: Bool, at date: Date?) -> Me {
        let p = profile
        let updated = Profile(
            id: p.id, username: p.username, fullName: p.fullName, avatarUrl: p.avatarUrl, teamNumber: p.teamNumber,
            bio: p.bio, role: p.role, xp: p.xp, level: p.level, tier: p.tier, createdAt: p.createdAt,
            emailOptIn: optIn, emailChoiceAt: date ?? .now
        )
        return Me(
            user: user, profile: updated, needsUsernameSetup: needsUsernameSetup,
            isPlaceholderUsername: isPlaceholderUsername, emailPrompt: false, referralCount: referralCount,
            siteRole: siteRole
        )
    }
}

/// `PATCH /api/app/profile` body. Only the fields you set are sent.
struct ProfileUpdate: Encodable, Hashable, Sendable {
    enum TeamNumberChange: Hashable, Sendable {
        case set(Int)
        case remove
    }

    var fullName: String?
    var bio: String?
    var avatarURL: String?
    var username: String?
    var teamNumber: TeamNumberChange?
    var role: ProfileRole?

    init(
        fullName: String? = nil, bio: String? = nil, avatarURL: String? = nil, username: String? = nil,
        teamNumber: TeamNumberChange? = nil, role: ProfileRole? = nil
    ) {
        self.fullName = fullName
        self.bio = bio
        self.avatarURL = avatarURL
        self.username = username
        self.teamNumber = teamNumber
        self.role = role
    }

    private enum CodingKeys: String, CodingKey { case fullName, bio, avatarUrl, username, teamNumber, role }

    func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(fullName, forKey: .fullName)
        try c.encodeIfPresent(bio, forKey: .bio)
        try c.encodeIfPresent(avatarURL, forKey: .avatarUrl)
        try c.encodeIfPresent(username, forKey: .username)
        switch teamNumber {
        case .set(let number): try c.encode(number, forKey: .teamNumber)
        case .remove: try c.encodeNil(forKey: .teamNumber)
        case nil: break
        }
        try c.encodeIfPresent(role?.rawValue, forKey: .role)
    }

    var isEmpty: Bool {
        fullName == nil && bio == nil && avatarURL == nil && username == nil && teamNumber == nil && role == nil
    }
}

/// `POST /api/app/auth/sign-up` body.
struct SignUpRequest: Codable, Hashable, Sendable {
    var email: String
    var password: String
    var username: String
    var fullName: String?
    var teamNumber: Int?
    /// Unticked by default (reminder emails are opt-in).
    var emailOptIn: Bool
    var ref: String?
    var via: String?
    /// `ios`, `ipados` or `macos` (`AppConfig.platformID`): recorded as the signup source.
    var platform: String?

    init(
        email: String, password: String, username: String, fullName: String? = nil, teamNumber: Int? = nil,
        emailOptIn: Bool = false, ref: String? = nil, via: String? = nil, platform: String? = nil
    ) {
        self.email = email
        self.password = password
        self.username = username
        self.fullName = fullName
        self.teamNumber = teamNumber
        self.emailOptIn = emailOptIn
        self.ref = ref
        self.via = via
        self.platform = platform
    }
}

/// What sign-up says next.
enum SignUpOutcome: String, Codable, Hashable, Sendable {
    /// Check your inbox; the link opens learnfrc.com, then sign in here.
    case confirmEmail = "confirm_email"
    /// That email already has an account; sign in instead.
    case exists
}

/// `POST /api/app/auth/sign-in` response. Installed with `auth.setSession`.
struct SessionTokens: Codable, Hashable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Double?

    private enum CodingKeys: String, CodingKey { case accessToken, refreshToken, expiresAt }

    init(accessToken: String, refreshToken: String, expiresAt: Double?) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        self.init(
            accessToken: try c.requiredString(forKey: c.firstKey("accessToken", "access_token")),
            refreshToken: try c.requiredString(forKey: c.firstKey("refreshToken", "refresh_token")),
            expiresAt: c.flexibleDouble(forKey: c.firstKey("expiresAt", "expires_at"))
        )
    }
}

/// `POST /api/app/email-opt-in` response.
struct EmailOptInResult: Codable, Hashable, Sendable {
    let optIn: Bool
    let emailChoiceAt: Date?

    init(optIn: Bool, emailChoiceAt: Date?) {
        self.optIn = optIn
        self.emailChoiceAt = emailChoiceAt
    }

    private enum CodingKeys: String, CodingKey { case optIn, emailChoiceAt }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(optIn: c.flexibleBool(forKey: .optIn) ?? false, emailChoiceAt: c.flexibleDate(forKey: .emailChoiceAt))
    }
}

/// A badge on a public profile.
struct PublicAchievement: Codable, Hashable, Sendable, Identifiable {
    let slug: String
    let name: String
    let icon: String
    let earnedAt: Date?

    var id: String { slug }

    init(slug: String, name: String, icon: String, earnedAt: Date?) {
        self.slug = slug
        self.name = name
        self.icon = icon
        self.earnedAt = earnedAt
    }

    private enum CodingKeys: String, CodingKey { case slug, name, icon, earnedAt }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            slug: c.flexibleString(forKey: .slug) ?? UUID().uuidString,
            name: c.flexibleString(forKey: .name) ?? "",
            icon: c.flexibleString(forKey: .icon) ?? "Award",
            earnedAt: c.flexibleDate(forKey: .earnedAt)
        )
    }

    var systemImage: String { IconNames.systemImage(forLucide: icon, fallback: "rosette") }
}

/// `GET /api/app/u/{username}`. Never includes a full name.
struct PublicProfile: Codable, Hashable, Sendable, Identifiable {
    let username: String
    let avatarUrl: String?
    let teamNumber: Int?
    let bio: String?
    let role: String
    let xp: Int
    let level: Int
    let tier: String
    let createdAt: Date?
    let lessonCount: Int
    let achievements: [PublicAchievement]

    var id: String { username }

    init(
        username: String, avatarUrl: String? = nil, teamNumber: Int? = nil, bio: String? = nil, role: String = "student",
        xp: Int, level: Int? = nil, tier: String? = nil, createdAt: Date? = nil, lessonCount: Int, achievements: [PublicAchievement] = []
    ) {
        let level = level ?? XPRules.level(forXP: xp)
        self.username = username
        self.avatarUrl = avatarUrl
        self.teamNumber = teamNumber
        self.bio = bio
        self.role = role
        self.xp = xp
        self.level = level
        self.tier = tier ?? XPRules.tier(forLevel: level)
        self.createdAt = createdAt
        self.lessonCount = lessonCount
        self.achievements = achievements
    }

    private enum CodingKeys: String, CodingKey {
        case username, avatarUrl, teamNumber, bio, role, xp, level, tier, createdAt, lessonCount, achievements
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            username: try c.requiredString(forKey: .username),
            avatarUrl: c.flexibleString(forKey: .avatarUrl),
            teamNumber: c.flexibleInt(forKey: .teamNumber),
            bio: c.flexibleString(forKey: .bio),
            role: c.flexibleString(forKey: .role) ?? "student",
            xp: max(0, c.flexibleInt(forKey: .xp) ?? 0),
            level: c.flexibleInt(forKey: .level),
            tier: c.flexibleString(forKey: .tier),
            createdAt: c.flexibleDate(forKey: .createdAt),
            lessonCount: c.flexibleInt(forKey: .lessonCount) ?? 0,
            achievements: c.lossyArray(PublicAchievement.self, forKey: .achievements)
        )
    }

    var roleKind: ProfileRole { ProfileRole(raw: role) }
    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)).flatMap { ["http", "https"].contains($0.scheme?.lowercased()) ? $0 : nil } }
    var webURL: URL { AppConfig.webBase.appending(path: "u/\(username)") }
}

/// The website's error body: `{ "error": "human sentence", "code": "machine_code" }`.
struct APIErrorBody: Codable, Hashable, Sendable {
    let error: String
    let code: String?

    init(error: String, code: String?) {
        self.error = error
        self.code = code
    }

    private enum CodingKeys: String, CodingKey { case error, code }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(error: c.flexibleString(forKey: .error) ?? "", code: c.flexibleString(forKey: .code))
    }
}
