import Foundation

// The admin shapes from `/api/app/admin/*` and `/api/app/apply` (camelCase, apple/docs/API.md).
//
// Privacy, the same line the website draws: nothing here carries an email address, a real
// name or (outside the super admins' team list) a user id. Every label, hint and footnote the
// site prints is built on the server and arrives ready to show, so the app and /admin can't
// drift. Decoding is lenient like the other models: a field the site adds later is ignored, a
// missing one falls back to empty.
//
// Admin payloads live in memory only (`AdminStore`): never the cache, the widgets, Spotlight
// or App Intents.

// MARK: - Role

/// Site authority (`site_admins`, read by `getSiteRole` on the server). The app only ever
/// learns it from the server and only uses it to show or hide things; every admin route checks
/// it again. Not `profiles.role`, which is the person's FRC team role.
enum SiteRole: String, Codable, Hashable, Sendable {
    case member, admin, superadmin

    init(raw: String?) {
        self = raw.flatMap { SiteRole(rawValue: $0.trimmingCharacters(in: .whitespaces).lowercased()) } ?? .member
    }

    /// Opens /admin: the numbers, the feedback inbox, the verified mark.
    var isAdmin: Bool { self != .member }
    /// Also opens /admin/team.
    var isSuperAdmin: Bool { self == .superadmin }
}

// MARK: - Where admin screens live

/// The four admin screens. The shell maps each to its `AppRoute` (see `AdminNavigator`).
enum AdminDestination: String, Hashable, Codable, Sendable, CaseIterable {
    /// learnfrc.com/admin
    case dashboard
    /// The Feedback drawer on /admin, a screen of its own in the app.
    case feedback
    /// learnfrc.com/admin/team (super admins).
    case team
    /// learnfrc.com/apply
    case apply

    /// The navigation title, in the site's words.
    var title: String {
        switch self {
        case .dashboard: "Admin"
        case .feedback: "Feedback"
        case .team: "Admin team"
        case .apply: "Help run it"
        }
    }

    /// The matching page on learnfrc.com (Handoff, Open on the web). The site checks the role
    /// again when it's opened.
    var webURL: URL {
        switch self {
        case .dashboard, .feedback: AppConfig.webBase.appending(path: "admin")
        case .team: AppConfig.webBase.appending(path: "admin/team")
        case .apply: AppConfig.webBase.appending(path: "apply")
        }
    }
}

// MARK: - Errors

/// A failure from an admin route, already worded: the site's own sentence where it sent one.
struct AdminError: Error, Hashable, Sendable, LocalizedError {
    enum Kind: String, Hashable, Sendable {
        /// Signed in, but this account doesn't hold the role (HTTP 403, code `forbidden`).
        /// The screen shows its locked card and the person stays signed in.
        case forbidden
        /// The session is gone (HTTP 401).
        case unauthorized
        /// The input broke a rule (400 / 422). `field` names the input when the site said.
        case validation
        /// The row is gone (404 with the site's sentence).
        case notFound
        /// Somebody got there first: already decided, already answered, already pending (409).
        case conflict
        /// Too many in a row (429).
        case rateLimited
        /// The route itself isn't on this learnfrc.com (a bare 404): an older site.
        case unavailable
        /// Offline, timed out.
        case network
        /// The server failed (5xx) or answered with something unreadable.
        case server
    }

    let kind: Kind
    let message: String
    /// The input the message is about (`note` on a decision), when the site said.
    var field: String?

    init(_ kind: Kind, _ message: String, field: String? = nil) {
        self.kind = kind
        self.message = message
        self.field = field
    }

    var errorDescription: String? { message }

    var isForbidden: Bool { kind == .forbidden }

    static let unauthorized = AdminError(.unauthorized, APIError.unauthorized.message)
    static let server = AdminError(.server, APIError.server.message)
    static let network = AdminError(.network, APIError.network.message)
    static let unavailable = AdminError(.unavailable, "This learnfrc.com doesn't have the admin tools yet. Try again after the next site update.")

    /// The sentence /admin shows a signed-in account that isn't an admin.
    static let adminOnly = "/admin holds the raw numbers for the whole site, so it is open to administrators only. Nothing is wrong with your account."
    /// The sentence the team routes send an admin who isn't a super admin.
    static let superAdminOnly = "Only a super admin can do that. Try reloading the page and signing in again."

    /// Wraps a transport or decoding error.
    static func wrapping(_ error: any Error) -> AdminError {
        if let error = error as? AdminError { return error }
        let api = APIError.from(error)
        switch api {
        case .unauthorized: return .unauthorized
        case .network: return .network
        case .rateLimited: return AdminError(.rateLimited, api.message)
        case .validation(let message): return AdminError(.validation, message)
        case .server: return .server
        }
    }
}

// MARK: - Shared rows

/// One row of a tally inside a drawer (the site's `MiniRow`): a name, a figure and, where the
/// comparison is the point, a gauge (`pct`, 0 to 100).
struct AdminMiniRow: Decodable, Hashable, Sendable {
    let label: String
    let sub: String?
    let value: Int
    let valueSuffix: String?
    /// 0 to 100. Present: a gauge is drawn under the row.
    let pct: Double?

    init(label: String, sub: String? = nil, value: Int, valueSuffix: String? = nil, pct: Double? = nil) {
        self.label = label
        self.sub = sub
        self.value = value
        self.valueSuffix = valueSuffix
        self.pct = pct
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        self.init(
            label: c.flexibleString(forKey: AnyCodingKey("label")) ?? "",
            sub: c.nonEmptyString(AnyCodingKey("sub")),
            value: c.flexibleInt(forKey: AnyCodingKey("value")) ?? 0,
            valueSuffix: c.nonEmptyString(AnyCodingKey("valueSuffix")),
            pct: c.flexibleDouble(forKey: AnyCodingKey("pct"))
        )
    }
}

/// A source and how many came from it.
struct AdminSlice: Decodable, Hashable, Sendable {
    let name: String
    let count: Int

    init(name: String, count: Int) {
        self.name = name
        self.count = count
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        self.init(name: c.flexibleString(forKey: AnyCodingKey("name")) ?? "unknown", count: max(0, c.flexibleInt(forKey: AnyCodingKey("count")) ?? 0))
    }
}

// MARK: - Summary

/// `GET /api/app/admin/summary`: the cheap counts for the You tab's admin rows and badges.
struct AdminSummary: Decodable, Hashable, Sendable {
    let role: SiteRole
    let openFeedback: Int
    let feedbackTotal: Int
    /// Nil unless the account is a super admin (the server doesn't even count them otherwise).
    let pendingApplications: Int?
    let pendingEdits: Int
    let pendingSubmissions: Int

    init(role: SiteRole, openFeedback: Int, feedbackTotal: Int, pendingApplications: Int?, pendingEdits: Int, pendingSubmissions: Int) {
        self.role = role
        self.openFeedback = openFeedback
        self.feedbackTotal = feedbackTotal
        self.pendingApplications = pendingApplications
        self.pendingEdits = pendingEdits
        self.pendingSubmissions = pendingSubmissions
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let role = SiteRole(raw: c.flexibleString(forKey: AnyCodingKey("role")))
        self.init(
            role: role,
            openFeedback: max(0, c.flexibleInt(forKey: AnyCodingKey("openFeedback")) ?? 0),
            feedbackTotal: max(0, c.flexibleInt(forKey: AnyCodingKey("feedbackTotal")) ?? 0),
            pendingApplications: role.isSuperAdmin ? c.flexibleInt(forKey: AnyCodingKey("pendingApplications")).map { max(0, $0) } : nil,
            pendingEdits: max(0, c.flexibleInt(forKey: AnyCodingKey("pendingEdits")) ?? 0),
            pendingSubmissions: max(0, c.flexibleInt(forKey: AnyCodingKey("pendingSubmissions")) ?? 0)
        )
    }

    /// The same counts with one message answered.
    func answeringOne() -> AdminSummary {
        AdminSummary(role: role, openFeedback: max(0, openFeedback - 1), feedbackTotal: feedbackTotal,
                     pendingApplications: pendingApplications, pendingEdits: pendingEdits, pendingSubmissions: pendingSubmissions)
    }

    /// The same counts with one application decided.
    func decidingOne() -> AdminSummary {
        AdminSummary(role: role, openFeedback: openFeedback, feedbackTotal: feedbackTotal,
                     pendingApplications: pendingApplications.map { max(0, $0 - 1) }, pendingEdits: pendingEdits, pendingSubmissions: pendingSubmissions)
    }
}

// MARK: - Dashboard

/// `GET /api/app/admin/dashboard`: /admin as a view model. Every sentence is the site's,
/// built on the server by the same function `/admin` renders from.
struct AdminDashboard: Decodable, Hashable, Sendable {
    /// "What wants a person today".
    struct Now: Decodable, Hashable, Sendable {
        let onlineNow: Int
        let openFeedback: Int
        let feedbackTotal: Int
        /// Nil unless super admin.
        let pendingApplications: Int?
        let pendingEdits: Int
        let pendingSubmissions: Int

        static let empty = Now(onlineNow: 0, openFeedback: 0, feedbackTotal: 0, pendingApplications: nil, pendingEdits: 0, pendingSubmissions: 0)

        init(onlineNow: Int, openFeedback: Int, feedbackTotal: Int, pendingApplications: Int?, pendingEdits: Int, pendingSubmissions: Int) {
            self.onlineNow = onlineNow
            self.openFeedback = openFeedback
            self.feedbackTotal = feedbackTotal
            self.pendingApplications = pendingApplications
            self.pendingEdits = pendingEdits
            self.pendingSubmissions = pendingSubmissions
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                onlineNow: max(0, c.flexibleInt(forKey: AnyCodingKey("onlineNow")) ?? 0),
                openFeedback: max(0, c.flexibleInt(forKey: AnyCodingKey("openFeedback")) ?? 0),
                feedbackTotal: max(0, c.flexibleInt(forKey: AnyCodingKey("feedbackTotal")) ?? 0),
                pendingApplications: c.flexibleInt(forKey: AnyCodingKey("pendingApplications")).map { max(0, $0) },
                pendingEdits: max(0, c.flexibleInt(forKey: AnyCodingKey("pendingEdits")) ?? 0),
                pendingSubmissions: max(0, c.flexibleInt(forKey: AnyCodingKey("pendingSubmissions")) ?? 0)
            )
        }
    }

    /// One of the four standing totals on the blue slab.
    struct Stamp: Decodable, Hashable, Sendable {
        /// `visitors`, `pageViews`, `learners` or `completions`.
        let key: String
        let value: Int
        /// The site's sentence under the figure ("page views, 1,204 of them on articles").
        let label: String

        init(key: String, value: Int, label: String) {
            self.key = key
            self.value = value
            self.label = label
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                key: c.flexibleString(forKey: AnyCodingKey("key")) ?? "",
                value: c.flexibleInt(forKey: AnyCodingKey("value")) ?? 0,
                label: c.flexibleString(forKey: AnyCodingKey("label")) ?? ""
            )
        }
    }

    /// A slug and a paragraph (the traffic honesty note).
    struct SlugNote: Decodable, Hashable, Sendable {
        let slug: String
        let text: String

        init(slug: String, text: String) {
            self.slug = slug
            self.text = text
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(slug: c.flexibleString(forKey: AnyCodingKey("slug")) ?? "", text: c.flexibleString(forKey: AnyCodingKey("text")) ?? "")
        }
    }

    /// The honesty notes under the slab.
    struct Notes: Decodable, Hashable, Sendable {
        /// "traffic is coming from the banked ledger" / "traffic panels are not measuring", or nil
        /// when the traffic figures can be believed.
        let traffic: SlugNote?
        /// "what those four numbers cover".
        let coverage: String?

        static let empty = Notes(traffic: nil, coverage: nil)

        init(traffic: SlugNote?, coverage: String?) {
            self.traffic = traffic
            self.coverage = coverage
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            let traffic = try? c.decodeIfPresent(SlugNote.self, forKey: AnyCodingKey("traffic"))
            self.init(
                traffic: (traffic?.text.isEmpty ?? true) ? nil : traffic,
                coverage: c.nonEmptyString(AnyCodingKey("coverage"))
            )
        }
    }

    /// One column of the tally sheet.
    struct TallyColumn: Decodable, Hashable, Sendable {
        struct Row: Decodable, Hashable, Sendable {
            let label: String
            let value: Int
            let suffix: String?
            let hint: String?

            init(label: String, value: Int, suffix: String? = nil, hint: String? = nil) {
                self.label = label
                self.value = value
                self.suffix = suffix
                self.hint = hint
            }

            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                self.init(
                    label: c.flexibleString(forKey: AnyCodingKey("label")) ?? "",
                    value: c.flexibleInt(forKey: AnyCodingKey("value")) ?? 0,
                    suffix: c.nonEmptyString(AnyCodingKey("suffix")),
                    hint: c.nonEmptyString(AnyCodingKey("hint"))
                )
            }
        }

        let slug: String
        let rows: [Row]

        init(slug: String, rows: [Row]) {
            self.slug = slug
            self.rows = rows
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(slug: c.flexibleString(forKey: AnyCodingKey("slug")) ?? "", rows: c.lossyArray(Row.self, forKey: AnyCodingKey("rows")))
        }
    }

    /// The Growth drawer.
    struct Growth: Decodable, Hashable, Sendable {
        struct Day: Decodable, Hashable, Sendable, Identifiable {
            /// `2026-10-15`, a UTC day.
            let day: String
            let date: Date?
            let signups: Int
            let completions: Int
            let views: Int
            let visitors: Int

            var id: String { day }

            init(day: String, signups: Int, completions: Int, views: Int, visitors: Int) {
                self.day = day
                self.date = AdminGrowthDate.parse(day)
                self.signups = signups
                self.completions = completions
                self.views = views
                self.visitors = visitors
            }

            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                self.init(
                    day: c.flexibleString(forKey: AnyCodingKey("day")) ?? "",
                    signups: max(0, c.flexibleInt(forKey: AnyCodingKey("signups")) ?? 0),
                    completions: max(0, c.flexibleInt(forKey: AnyCodingKey("completions")) ?? 0),
                    views: max(0, c.flexibleInt(forKey: AnyCodingKey("views")) ?? 0),
                    visitors: max(0, c.flexibleInt(forKey: AnyCodingKey("visitors")) ?? 0)
                )
            }
        }

        /// True 30-day window totals (visitors is a distinct count, never a sum of the days).
        struct Totals: Decodable, Hashable, Sendable {
            let visitors: Int
            let signups: Int
            let completions: Int

            static let zero = Totals(visitors: 0, signups: 0, completions: 0)

            init(visitors: Int, signups: Int, completions: Int) {
                self.visitors = visitors
                self.signups = signups
                self.completions = completions
            }

            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                self.init(
                    visitors: c.flexibleInt(forKey: AnyCodingKey("visitors")) ?? 0,
                    signups: c.flexibleInt(forKey: AnyCodingKey("signups")) ?? 0,
                    completions: c.flexibleInt(forKey: AnyCodingKey("completions")) ?? 0
                )
            }
        }

        let daily: [Day]
        let totals: Totals
        let footnote: String?

        static let empty = Growth(daily: [], totals: .zero, footnote: nil)

        init(daily: [Day], totals: Totals, footnote: String?) {
            self.daily = daily
            self.totals = totals
            self.footnote = footnote
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                daily: c.lossyArray(Day.self, forKey: AnyCodingKey("daily")),
                totals: (try? c.decodeIfPresent(Totals.self, forKey: AnyCodingKey("totals"))) ?? .zero,
                footnote: c.nonEmptyString(AnyCodingKey("footnote"))
            )
        }
    }

    /// The Activation funnel drawer.
    struct Funnel: Decodable, Hashable, Sendable {
        let rows: [AdminMiniRow]
        /// The worst drop, kept short ("-62% Completed a lesson").
        let badge: String?
        let note: String?
        let anonymousRows: [AdminMiniRow]
        /// Printed under the anonymous rows whenever there are any.
        let anonymousNote: String
        let empty: String

        static let siteAnonymousNote = "Counted by device, not by person, and never joined to an account. A reader who signs up starts a fresh row above."
        static let blank = Funnel(rows: [], badge: nil, note: nil, anonymousRows: [], anonymousNote: siteAnonymousNote, empty: "Funnel unavailable. Check the server logs for [funnel].")

        init(rows: [AdminMiniRow], badge: String?, note: String?, anonymousRows: [AdminMiniRow], anonymousNote: String = Funnel.siteAnonymousNote, empty: String) {
            self.rows = rows
            self.badge = badge
            self.note = note
            self.anonymousRows = anonymousRows
            self.anonymousNote = anonymousNote
            self.empty = empty
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                rows: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("rows")),
                badge: c.nonEmptyString(AnyCodingKey("badge")),
                note: c.nonEmptyString(AnyCodingKey("note")),
                anonymousRows: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("anonymousRows")),
                anonymousNote: c.nonEmptyString(AnyCodingKey("anonymousNote")) ?? Funnel.siteAnonymousNote,
                empty: c.nonEmptyString(AnyCodingKey("empty")) ?? Funnel.blank.empty
            )
        }
    }

    /// Where they come from.
    struct Sources: Decodable, Hashable, Sendable {
        struct Users: Decodable, Hashable, Sendable {
            let week: [AdminSlice]
            let allTime: [AdminSlice]

            static let empty = Users(week: [], allTime: [])

            init(week: [AdminSlice], allTime: [AdminSlice]) {
                self.week = week
                self.allTime = allTime
            }

            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                self.init(week: c.lossyArray(AdminSlice.self, forKey: AnyCodingKey("week")), allTime: c.lossyArray(AdminSlice.self, forKey: AnyCodingKey("allTime")))
            }
        }

        struct Visitors: Decodable, Hashable, Sendable {
            let week: [AdminSlice]
            let allTime: [AdminSlice]
            /// Measured unique visitors over the window, never a row sum. Zero when unmeasured.
            let weekTotal: Int
            let allTimeTotal: Int

            static let empty = Visitors(week: [], allTime: [], weekTotal: 0, allTimeTotal: 0)

            init(week: [AdminSlice], allTime: [AdminSlice], weekTotal: Int, allTimeTotal: Int) {
                self.week = week
                self.allTime = allTime
                self.weekTotal = weekTotal
                self.allTimeTotal = allTimeTotal
            }

            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                self.init(
                    week: c.lossyArray(AdminSlice.self, forKey: AnyCodingKey("week")),
                    allTime: c.lossyArray(AdminSlice.self, forKey: AnyCodingKey("allTime")),
                    weekTotal: c.flexibleInt(forKey: AnyCodingKey("weekTotal")) ?? 0,
                    allTimeTotal: c.flexibleInt(forKey: AnyCodingKey("allTimeTotal")) ?? 0
                )
            }
        }

        let users: Users
        let visitors: Visitors
        let footnote: String?

        static let empty = Sources(users: .empty, visitors: .empty, footnote: nil)

        init(users: Users, visitors: Visitors, footnote: String?) {
            self.users = users
            self.visitors = visitors
            self.footnote = footnote
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                users: (try? c.decodeIfPresent(Users.self, forKey: AnyCodingKey("users"))) ?? .empty,
                visitors: (try? c.decodeIfPresent(Visitors.self, forKey: AnyCodingKey("visitors"))) ?? .empty,
                footnote: c.nonEmptyString(AnyCodingKey("footnote"))
            )
        }
    }

    /// What gets read.
    struct Engagement: Decodable, Hashable, Sendable {
        let lessons: [AdminMiniRow]
        let departments: [AdminMiniRow]

        static let empty = Engagement(lessons: [], departments: [])

        init(lessons: [AdminMiniRow], departments: [AdminMiniRow]) {
            self.lessons = lessons
            self.departments = departments
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(lessons: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("lessons")), departments: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("departments")))
        }
    }

    /// Teams and referrals.
    struct Teams: Decodable, Hashable, Sendable {
        let teams: [AdminMiniRow]
        let recruiters: [AdminMiniRow]
        let surfaces: [AdminMiniRow]
        let surfacesFootnote: String?

        static let empty = Teams(teams: [], recruiters: [], surfaces: [], surfacesFootnote: nil)

        init(teams: [AdminMiniRow], recruiters: [AdminMiniRow], surfaces: [AdminMiniRow], surfacesFootnote: String?) {
            self.teams = teams
            self.recruiters = recruiters
            self.surfaces = surfaces
            self.surfacesFootnote = surfacesFootnote
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                teams: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("teams")),
                recruiters: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("recruiters")),
                surfaces: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("surfaces")),
                surfacesFootnote: c.nonEmptyString(AnyCodingKey("surfacesFootnote"))
            )
        }
    }

    /// Recent activity.
    struct Activity: Decodable, Hashable, Sendable {
        struct Member: Decodable, Hashable, Sendable {
            let username: String?
            let teamNumber: Int?
            let createdAt: Date?

            init(username: String?, teamNumber: Int?, createdAt: Date?) {
                self.username = username
                self.teamNumber = teamNumber
                self.createdAt = createdAt
            }

            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                self.init(
                    username: c.nonEmptyString(AnyCodingKey("username")),
                    teamNumber: c.flexibleInt(forKey: AnyCodingKey("teamNumber")),
                    createdAt: c.flexibleDate(forKey: AnyCodingKey("createdAt"))
                )
            }
        }

        struct Completion: Decodable, Hashable, Sendable {
            /// A handle or "a member", built on the server.
            let user: String
            let lesson: String
            let at: Date?

            init(user: String, lesson: String, at: Date?) {
                self.user = user
                self.lesson = lesson
                self.at = at
            }

            init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: AnyCodingKey.self)
                self.init(
                    user: c.flexibleString(forKey: AnyCodingKey("user")) ?? "a member",
                    lesson: c.flexibleString(forKey: AnyCodingKey("lesson")) ?? "",
                    at: c.flexibleDate(forKey: AnyCodingKey("at"))
                )
            }
        }

        let newestMembers: [Member]
        let recentCompletions: [Completion]

        static let empty = Activity(newestMembers: [], recentCompletions: [])

        init(newestMembers: [Member], recentCompletions: [Completion]) {
            self.newestMembers = newestMembers
            self.recentCompletions = recentCompletions
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                newestMembers: c.lossyArray(Member.self, forKey: AnyCodingKey("newestMembers")),
                recentCompletions: c.lossyArray(Completion.self, forKey: AnyCodingKey("recentCompletions"))
            )
        }
    }

    let role: SiteRole
    let generatedAt: Date?
    /// How often /admin re-reads itself (30).
    let refreshSeconds: Int
    let now: Now
    let stamps: [Stamp]
    let notes: Notes
    let tally: [TallyColumn]
    let growth: Growth
    let funnel: Funnel
    let sources: Sources
    let engagement: Engagement
    let teams: Teams
    let articles: [AdminMiniRow]
    let achievements: [AdminMiniRow]
    let activity: Activity

    init(
        role: SiteRole, generatedAt: Date?, refreshSeconds: Int = 30, now: Now, stamps: [Stamp], notes: Notes,
        tally: [TallyColumn], growth: Growth, funnel: Funnel, sources: Sources, engagement: Engagement,
        teams: Teams, articles: [AdminMiniRow], achievements: [AdminMiniRow], activity: Activity
    ) {
        self.role = role
        self.generatedAt = generatedAt
        self.refreshSeconds = refreshSeconds
        self.now = now
        self.stamps = stamps
        self.notes = notes
        self.tally = tally
        self.growth = growth
        self.funnel = funnel
        self.sources = sources
        self.engagement = engagement
        self.teams = teams
        self.articles = articles
        self.achievements = achievements
        self.activity = activity
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        func nested<T: Decodable>(_ type: T.Type, _ key: String, _ fallback: T) -> T {
            do {
                return try c.decodeIfPresent(T.self, forKey: AnyCodingKey(key)) ?? fallback
            } catch {
                Log.decode.error("admin dashboard \(key, privacy: .public): \(JSONCoding.describe(error), privacy: .public)")
                return fallback
            }
        }
        let refresh = c.flexibleInt(forKey: AnyCodingKey("refreshSeconds")) ?? 30
        self.init(
            role: SiteRole(raw: c.flexibleString(forKey: AnyCodingKey("role"))),
            generatedAt: c.flexibleDate(forKey: AnyCodingKey("generatedAt")),
            refreshSeconds: min(max(refresh, 15), 300),
            now: nested(Now.self, "now", .empty),
            stamps: c.lossyArray(Stamp.self, forKey: AnyCodingKey("stamps")),
            notes: nested(Notes.self, "notes", .empty),
            tally: c.lossyArray(TallyColumn.self, forKey: AnyCodingKey("tally")),
            growth: nested(Growth.self, "growth", .empty),
            funnel: nested(Funnel.self, "funnel", .blank),
            sources: nested(Sources.self, "sources", .empty),
            engagement: nested(Engagement.self, "engagement", .empty),
            teams: nested(Teams.self, "teams", .empty),
            articles: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("articles")),
            achievements: c.lossyArray(AdminMiniRow.self, forKey: AnyCodingKey("achievements")),
            activity: nested(Activity.self, "activity", .empty)
        )
    }

    /// The You tab's counts, from this fuller read.
    var summary: AdminSummary {
        AdminSummary(
            role: role, openFeedback: now.openFeedback, feedbackTotal: now.feedbackTotal,
            pendingApplications: role.isSuperAdmin ? now.pendingApplications : nil,
            pendingEdits: now.pendingEdits, pendingSubmissions: now.pendingSubmissions
        )
    }

    /// The same dashboard with new "what wants a person today" counts (after a reply or a decision).
    func replacing(now: Now) -> AdminDashboard {
        AdminDashboard(
            role: role, generatedAt: generatedAt, refreshSeconds: refreshSeconds, now: now, stamps: stamps,
            notes: notes, tally: tally, growth: growth, funnel: funnel, sources: sources, engagement: engagement,
            teams: teams, articles: articles, achievements: achievements, activity: activity
        )
    }
}

/// The growth chart's days: `YYYY-MM-DD` read as a UTC calendar day.
enum AdminGrowthDate {
    static func parse(_ day: String) -> Date? {
        let parts = day.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return FlexibleDate.parse(day) }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }
}

// MARK: - Feedback

/// One message from the contact form. Never the sender's address and never their account: the
/// server keeps the address and re-reads it by id when a reply goes out.
struct AdminFeedbackItem: Decodable, Hashable, Sendable, Identifiable {
    enum Status: String, Hashable, Sendable { case open, replied }

    let id: UUID
    let message: String
    /// The page it was sent from.
    let page: String?
    /// A reply can reach the sender (they left an address).
    let hasReplyAddress: Bool
    let status: Status
    /// What was sent back.
    let replyBody: String?
    let repliedAt: Date?
    let createdAt: Date?

    init(id: UUID, message: String, page: String?, hasReplyAddress: Bool, status: Status,
         replyBody: String? = nil, repliedAt: Date? = nil, createdAt: Date?) {
        self.id = id
        self.message = message
        self.page = page
        self.hasReplyAddress = hasReplyAddress
        self.status = status
        self.replyBody = replyBody
        self.repliedAt = repliedAt
        self.createdAt = createdAt
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        self.init(
            id: try c.requiredUUID(forKey: AnyCodingKey("id")),
            message: c.flexibleString(forKey: AnyCodingKey("message")) ?? "",
            page: c.nonEmptyString(AnyCodingKey("page")),
            hasReplyAddress: c.flexibleBool(forKey: AnyCodingKey("hasReplyAddress")) ?? false,
            status: c.flexibleString(forKey: AnyCodingKey("status"))?.lowercased() == "replied" ? .replied : .open,
            replyBody: c.nonEmptyString(AnyCodingKey("replyBody")),
            repliedAt: c.flexibleDate(forKey: AnyCodingKey("repliedAt")),
            createdAt: c.flexibleDate(forKey: AnyCodingKey("createdAt"))
        )
    }

    var isReplied: Bool { status == .replied }
    /// The Reply button shows: not answered yet, and an answer can reach somebody.
    var canReply: Bool { !isReplied && hasReplyAddress }
}

/// `GET /api/app/admin/feedback`
struct AdminFeedbackPage: Decodable, Hashable, Sendable {
    let items: [AdminFeedbackItem]
    let openCount: Int
    let total: Int

    init(items: [AdminFeedbackItem], openCount: Int, total: Int) {
        self.items = items
        self.openCount = openCount
        self.total = total
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let items = c.lossyArray(AdminFeedbackItem.self, forKey: AnyCodingKey("items"))
        self.init(
            items: items,
            openCount: c.flexibleInt(forKey: AnyCodingKey("openCount")) ?? items.count { !$0.isReplied },
            total: c.flexibleInt(forKey: AnyCodingKey("total")) ?? items.count
        )
    }

    /// The same page with one message replaced by the server's copy of it.
    func replacing(_ item: AdminFeedbackItem) -> AdminFeedbackPage {
        let wasOpen = items.first { $0.id == item.id }.map { !$0.isReplied } ?? false
        return AdminFeedbackPage(
            items: items.map { $0.id == item.id ? item : $0 },
            openCount: wasOpen && item.isReplied ? max(0, openCount - 1) : openCount,
            total: total
        )
    }
}

// MARK: - Team desk

/// What a decision on an application is.
enum AdminDecision: String, Hashable, Sendable {
    case accept, reject
}

/// `GET /api/app/admin/team`: /admin/team for super admins. Handles and team numbers only.
struct AdminTeamDesk: Decodable, Hashable, Sendable {
    /// One line of "what accepting hands over".
    struct Grant: Decodable, Hashable, Sendable {
        let label: String
        let hint: String

        init(label: String, hint: String) {
            self.label = label
            self.hint = hint
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(label: c.flexibleString(forKey: AnyCodingKey("label")) ?? "", hint: c.flexibleString(forKey: AnyCodingKey("hint")) ?? "")
        }
    }

    /// An application waiting on a decision.
    struct Application: Decodable, Hashable, Sendable, Identifiable {
        let id: UUID
        let username: String?
        let teamNumber: Int?
        let teamRole: String?
        /// The role as a word ("Mentor").
        let teamRoleLabel: String
        let experience: String
        let why: String
        let availability: String?
        let createdAt: Date?

        init(id: UUID, username: String?, teamNumber: Int?, teamRole: String?, teamRoleLabel: String,
             experience: String, why: String, availability: String?, createdAt: Date?) {
            self.id = id
            self.username = username
            self.teamNumber = teamNumber
            self.teamRole = teamRole
            self.teamRoleLabel = teamRoleLabel
            self.experience = experience
            self.why = why
            self.availability = availability
            self.createdAt = createdAt
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            let role = c.nonEmptyString(AnyCodingKey("teamRole"))
            self.init(
                id: try c.requiredUUID(forKey: AnyCodingKey("id")),
                username: c.nonEmptyString(AnyCodingKey("username")),
                teamNumber: c.flexibleInt(forKey: AnyCodingKey("teamNumber")),
                teamRole: role,
                teamRoleLabel: c.nonEmptyString(AnyCodingKey("teamRoleLabel")) ?? ProfileRole(raw: role).displayName,
                experience: c.flexibleString(forKey: AnyCodingKey("experience")) ?? "",
                why: c.flexibleString(forKey: AnyCodingKey("why")) ?? "",
                availability: c.nonEmptyString(AnyCodingKey("availability")),
                createdAt: c.flexibleDate(forKey: AnyCodingKey("createdAt"))
            )
        }

        /// "@handle" or "this account", for the sentences and VoiceOver.
        var handle: String { username.map { "@\($0)" } ?? "this account" }
    }

    /// Somebody already on the team.
    struct Member: Decodable, Hashable, Sendable, Identifiable {
        let userId: UUID
        let username: String?
        let teamNumber: Int?
        let role: SiteRole
        /// "owner", "super admin" or "admin".
        let roleWord: String
        let grantedAt: Date?
        let note: String?
        let isOwner: Bool
        let isYou: Bool
        /// Neither an owner nor you: the role picker and Remove show.
        let canChange: Bool

        var id: UUID { userId }

        init(userId: UUID, username: String?, teamNumber: Int?, role: SiteRole, roleWord: String,
             grantedAt: Date?, note: String?, isOwner: Bool, isYou: Bool, canChange: Bool) {
            self.userId = userId
            self.username = username
            self.teamNumber = teamNumber
            self.role = role
            self.roleWord = roleWord
            self.grantedAt = grantedAt
            self.note = note
            self.isOwner = isOwner
            self.isYou = isYou
            self.canChange = canChange
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            let role: SiteRole = SiteRole(raw: c.flexibleString(forKey: AnyCodingKey("role"))) == .superadmin ? .superadmin : .admin
            let isOwner = c.flexibleBool(forKey: AnyCodingKey("isOwner")) ?? false
            let isYou = c.flexibleBool(forKey: AnyCodingKey("isYou")) ?? false
            self.init(
                userId: try c.requiredUUID(forKey: AnyCodingKey("userId")),
                username: c.nonEmptyString(AnyCodingKey("username")),
                teamNumber: c.flexibleInt(forKey: AnyCodingKey("teamNumber")),
                role: role,
                roleWord: c.nonEmptyString(AnyCodingKey("roleWord")) ?? (isOwner ? "owner" : (role == .superadmin ? "super admin" : "admin")),
                grantedAt: c.flexibleDate(forKey: AnyCodingKey("grantedAt")),
                note: c.nonEmptyString(AnyCodingKey("note")),
                isOwner: isOwner,
                isYou: isYou,
                // Never offered for an owner or your own row, whatever the payload says.
                canChange: (c.flexibleBool(forKey: AnyCodingKey("canChange")) ?? true) && !isOwner && !isYou
            )
        }

        var handle: String { username.map { "@\($0)" } ?? "this account" }

        func with(role newRole: SiteRole) -> Member {
            Member(userId: userId, username: username, teamNumber: teamNumber, role: newRole,
                   roleWord: isOwner ? "owner" : (newRole == .superadmin ? "super admin" : "admin"),
                   grantedAt: grantedAt, note: note, isOwner: isOwner, isYou: isYou, canChange: canChange)
        }
    }

    /// A decided application in the log.
    struct Decided: Decodable, Hashable, Sendable, Identifiable {
        let id: UUID
        let username: String?
        /// `accepted`, `rejected` or `withdrawn`.
        let status: String
        /// "accepted", "turned down" or "withdrawn".
        let statusWord: String
        let reviewedAt: Date?
        let createdAt: Date?
        let reviewNote: String?

        init(id: UUID, username: String?, status: String, statusWord: String, reviewedAt: Date?, createdAt: Date?, reviewNote: String?) {
            self.id = id
            self.username = username
            self.status = status
            self.statusWord = statusWord
            self.reviewedAt = reviewedAt
            self.createdAt = createdAt
            self.reviewNote = reviewNote
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            let status = c.flexibleString(forKey: AnyCodingKey("status"))?.lowercased() ?? "accepted"
            self.init(
                id: try c.requiredUUID(forKey: AnyCodingKey("id")),
                username: c.nonEmptyString(AnyCodingKey("username")),
                status: status,
                statusWord: c.nonEmptyString(AnyCodingKey("statusWord")) ?? (status == "rejected" ? "turned down" : status),
                reviewedAt: c.flexibleDate(forKey: AnyCodingKey("reviewedAt")),
                createdAt: c.flexibleDate(forKey: AnyCodingKey("createdAt")),
                reviewNote: c.nonEmptyString(AnyCodingKey("reviewNote"))
            )
        }
    }

    let grants: [Grant]
    let pending: [Application]
    let pendingTruncated: Bool
    let team: [Member]
    let decided: [Decided]
    let decidedTruncated: Bool

    init(grants: [Grant], pending: [Application], pendingTruncated: Bool, team: [Member], decided: [Decided], decidedTruncated: Bool) {
        self.grants = grants
        self.pending = pending
        self.pendingTruncated = pendingTruncated
        self.team = team
        self.decided = decided
        self.decidedTruncated = decidedTruncated
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let pending = c.lossyArray(Application.self, forKey: AnyCodingKey("pending"))
        let decided = c.lossyArray(Decided.self, forKey: AnyCodingKey("decided"))
        let grants = c.lossyArray(Grant.self, forKey: AnyCodingKey("grants"))
        self.init(
            grants: grants.isEmpty ? Self.siteGrants : grants,
            pending: pending,
            pendingTruncated: c.flexibleBool(forKey: AnyCodingKey("pendingTruncated")) ?? (pending.count == 60),
            team: c.lossyArray(Member.self, forKey: AnyCodingKey("team")),
            decided: decided,
            decidedTruncated: c.flexibleBool(forKey: AnyCodingKey("decidedTruncated")) ?? (decided.count == 30)
        )
    }

    /// /admin/team's `GRANTS`, for an older payload that doesn't send them.
    static let siteGrants: [Grant] = [
        Grant(label: "The numbers", hint: "every figure on /admin, read off the database"),
        Grant(label: "The feedback inbox", hint: "read what people send in, and write back"),
        Grant(label: "Edit review", hint: "approve or turn down suggested edits"),
        Grant(label: "The verified mark", hint: "sign off a lesson as checked"),
    ]

    /// After a decision: the application leaves the waiting list and heads the log.
    func deciding(_ id: UUID, as decision: AdminDecision, note: String?, at date: Date = .now) -> AdminTeamDesk {
        guard let app = pending.first(where: { $0.id == id }) else { return self }
        let status = decision == .accept ? "accepted" : "rejected"
        let entry = Decided(id: id, username: app.username, status: status,
                            statusWord: decision == .accept ? "accepted" : "turned down",
                            reviewedAt: date, createdAt: app.createdAt, reviewNote: note)
        return AdminTeamDesk(grants: grants, pending: pending.filter { $0.id != id }, pendingTruncated: pendingTruncated,
                             team: team, decided: Array(([entry] + decided).prefix(30)), decidedTruncated: decidedTruncated)
    }

    /// After a role change.
    func setting(_ userID: UUID, to role: SiteRole) -> AdminTeamDesk {
        AdminTeamDesk(grants: grants, pending: pending, pendingTruncated: pendingTruncated,
                      team: team.map { $0.userId == userID ? $0.with(role: role) : $0 },
                      decided: decided, decidedTruncated: decidedTruncated)
    }

    /// After a removal.
    func removing(_ userID: UUID) -> AdminTeamDesk {
        AdminTeamDesk(grants: grants, pending: pending, pendingTruncated: pendingTruncated,
                      team: team.filter { $0.userId != userID }, decided: decided, decidedTruncated: decidedTruncated)
    }
}

// MARK: - Apply

/// `GET /api/app/apply`: where this account stands on /apply.
struct AdminApplyState: Decodable, Hashable, Sendable {
    enum Mode: String, Hashable, Sendable {
        case onTheTeam = "on-the-team"
        case pending
        case noHandle = "no-handle"
        case again
        case new
    }

    struct Heading: Decodable, Hashable, Sendable {
        let title: String
        let slug: String

        init(title: String, slug: String) {
            self.title = title
            self.slug = slug
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(title: c.flexibleString(forKey: AnyCodingKey("title")) ?? "", slug: c.flexibleString(forKey: AnyCodingKey("slug")) ?? "")
        }
    }

    /// What the reviewer sees.
    struct Record: Decodable, Hashable, Sendable {
        let username: String?
        let teamNumber: Int?
        let teamRoleLabel: String?

        static let empty = Record(username: nil, teamNumber: nil, teamRoleLabel: nil)

        init(username: String?, teamNumber: Int?, teamRoleLabel: String?) {
            self.username = username
            self.teamNumber = teamNumber
            self.teamRoleLabel = teamRoleLabel
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                username: c.nonEmptyString(AnyCodingKey("username")),
                teamNumber: c.flexibleInt(forKey: AnyCodingKey("teamNumber")),
                teamRoleLabel: c.nonEmptyString(AnyCodingKey("teamRoleLabel"))
            )
        }
    }

    /// This account's latest application, when it matters to the page.
    struct Application: Decodable, Hashable, Sendable {
        /// `pending`, `rejected` or `withdrawn`.
        let status: String
        let createdAt: Date?
        let reviewedAt: Date?
        let reviewNote: String?

        init(status: String, createdAt: Date?, reviewedAt: Date?, reviewNote: String?) {
            self.status = status
            self.createdAt = createdAt
            self.reviewedAt = reviewedAt
            self.reviewNote = reviewNote
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                status: c.flexibleString(forKey: AnyCodingKey("status"))?.lowercased() ?? "pending",
                createdAt: c.flexibleDate(forKey: AnyCodingKey("createdAt")),
                reviewedAt: c.flexibleDate(forKey: AnyCodingKey("reviewedAt")),
                reviewNote: c.nonEmptyString(AnyCodingKey("reviewNote"))
            )
        }

        var isWithdrawn: Bool { status == "withdrawn" }
        var isTurnedDown: Bool { status == "rejected" }
    }

    struct Job: Decodable, Hashable, Sendable {
        let slug: String
        let text: String

        init(slug: String, text: String) {
            self.slug = slug
            self.text = text
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(slug: c.flexibleString(forKey: AnyCodingKey("slug")) ?? "", text: c.flexibleString(forKey: AnyCodingKey("text")) ?? "")
        }
    }

    struct Limits: Decodable, Hashable, Sendable {
        let minChars: Int
        let maxChars: Int
        let availabilityMax: Int

        static let site = Limits(minChars: 40, maxChars: 3000, availabilityMax: 200)

        init(minChars: Int, maxChars: Int, availabilityMax: Int) {
            self.minChars = minChars
            self.maxChars = maxChars
            self.availabilityMax = availabilityMax
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            self.init(
                minChars: c.flexibleInt(forKey: AnyCodingKey("minChars")) ?? 40,
                maxChars: c.flexibleInt(forKey: AnyCodingKey("maxChars")) ?? 3000,
                availabilityMax: c.flexibleInt(forKey: AnyCodingKey("availabilityMax")) ?? 200
            )
        }
    }

    let applicationsOpen: Bool
    let mode: Mode
    let heading: Heading
    let record: Record
    let application: Application?
    let jobs: [Job]
    let limits: Limits

    init(applicationsOpen: Bool, mode: Mode, heading: Heading, record: Record, application: Application?, jobs: [Job], limits: Limits = .site) {
        self.applicationsOpen = applicationsOpen
        self.mode = mode
        self.heading = heading
        self.record = record
        self.application = application
        self.jobs = jobs
        self.limits = limits
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let mode = Mode(rawValue: c.flexibleString(forKey: AnyCodingKey("mode")) ?? "") ?? .new
        let heading = (try? c.decodeIfPresent(Heading.self, forKey: AnyCodingKey("heading"))) ?? Self.heads[mode] ?? Heading(title: "Apply", slug: "")
        let jobs = c.lossyArray(Job.self, forKey: AnyCodingKey("jobs"))
        self.init(
            applicationsOpen: c.flexibleBool(forKey: AnyCodingKey("applicationsOpen")) ?? false,
            mode: mode,
            heading: heading.title.isEmpty ? (Self.heads[mode] ?? heading) : heading,
            record: (try? c.decodeIfPresent(Record.self, forKey: AnyCodingKey("record"))) ?? .empty,
            application: try? c.decodeIfPresent(Application.self, forKey: AnyCodingKey("application")),
            jobs: jobs.isEmpty ? Self.siteJobs : jobs,
            limits: (try? c.decodeIfPresent(Limits.self, forKey: AnyCodingKey("limits"))) ?? .site
        )
    }

    /// /apply's `HEADS`, for a payload that leaves them out, and for the signed-out state the
    /// app draws without asking the server.
    static let heads: [Mode: Heading] = [
        .onTheTeam: Heading(title: "You’re already on the team", slug: "nothing to apply for"),
        .pending: Heading(title: "Your application", slug: "waiting on a decision"),
        .noHandle: Heading(title: "Pick a handle first", slug: "one step, then the three questions"),
        .again: Heading(title: "Apply again", slug: "three questions, nothing else"),
        .new: Heading(title: "Apply", slug: "three questions, nothing else"),
    ]
    static let signedOutHeading = Heading(title: "Applying needs an account", slug: "free, and it takes a minute")

    /// /apply's `JOBS`, for a payload that leaves them out and for the signed-out page.
    static let siteJobs: [Job] = [
        Job(slug: "the feedback", text: "Every message sent through the contact form lands in one inbox. Most want a short, specific answer. Some are a real bug report and need chasing down before you can reply."),
        Job(slug: "suggested edits", text: "Anyone with an account can rewrite the markdown of a lesson. Somebody has to read the change, check it against the source it touches, and either merge it or say plainly why not."),
        Job(slug: "verifying lessons", text: "Lessons are drafted with AI help and checked by hand. Marking one verified means you read it against the documents it cites, found it held up, and put your account behind that."),
        Job(slug: "the numbers", text: "The same admin page I read: signups, lessons finished, where readers arrive from, which pages get opened and which ones never do."),
    ]
}

/// `PUT /api/app/admin/lessons/{lessonId}/verified`
struct AdminVerifiedResult: Decodable, Hashable, Sendable {
    let lessonId: UUID?
    let verifiedAt: Date?

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        lessonId = c.flexibleUUID(forKey: AnyCodingKey("lessonId"))
        verifiedAt = c.flexibleDate(forKey: AnyCodingKey("verifiedAt"))
    }
}

// MARK: - Decoding helper

extension KeyedDecodingContainer where Key == AnyCodingKey {
    /// A trimmed string, nil when missing, null or blank.
    func nonEmptyString(_ key: AnyCodingKey) -> String? {
        guard let value = flexibleString(forKey: key)?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}
