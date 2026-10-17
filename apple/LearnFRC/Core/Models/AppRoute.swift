import Foundation

/// Every destination a `NavigationStack` can push. The shell registers one
/// `.navigationDestination(for: AppRoute.self)` and switches over it.
enum AppRoute: Hashable, Codable, Sendable {
    case department(UUID)
    case module(UUID)
    case lesson(UUID)
    /// Article slug.
    case article(String)
    /// Glossary slug.
    case glossaryTerm(String)
    /// Learning path slug.
    case path(String)
    /// Username (public profile).
    case profile(String)
    case team
    case leaderboard
    case settings
    /// Department id.
    case certificate(UUID)
    case videos
    case achievements
    /// The signed-in user's (or this device's) bookmarked lessons, like learnfrc.com/bookmarks.
    case bookmarks
    /// The FRC calculators index (learnfrc.com/tools).
    case tools
    /// One calculator, by its website slug (learnfrc.com/tools/<slug>, e.g. "frc-gear-ratio-calculator").
    case tool(String)
    /// The resources shelf (learnfrc.com/resources).
    case resources
    /// The admin panel (learnfrc.com/admin). Admins; the server checks the role on every call.
    case admin
    /// The feedback inbox (the Feedback drawer on learnfrc.com/admin). Admins.
    case adminFeedback
    /// The admin team desk (learnfrc.com/admin/team). Super admins.
    case adminTeam
    /// Help run it (learnfrc.com/apply).
    case apply

    /// The glossary catalogue (learnfrc.com/glossary, `GlossaryView`): the glossary-term route
    /// with an empty slug, which `GlossaryTermView` shows as the catalogue. Kept as a
    /// glossary-term route (not a new case) so routes already saved on devices still decode.
    static var glossaryIndex: AppRoute { .glossaryTerm("") }

    /// The route for an admin screen (`AdminNavigator`).
    init(_ destination: AdminDestination) {
        switch destination {
        case .dashboard: self = .admin
        case .feedback: self = .adminFeedback
        case .team: self = .adminTeam
        case .apply: self = .apply
        }
    }
}

// MARK: - The app's own URL scheme

/// `learnfrc://` links used by widgets, Spotlight, App Shortcuts and notifications.
///
///     learnfrc://lesson/<uuid>        learnfrc://department/<uuid>   learnfrc://module/<uuid>
///     learnfrc://article/<slug>       learnfrc://glossary/<slug>     learnfrc://path/<slug>
///     learnfrc://glossary (the catalogue)
///     learnfrc://u/<username>         learnfrc://certificate/<uuid>
///     learnfrc://team  learnfrc://leaderboard  learnfrc://settings  learnfrc://videos  learnfrc://achievements
///     learnfrc://bookmarks
///     learnfrc://admin  learnfrc://admin/feedback  learnfrc://admin/team  learnfrc://apply
///
/// Two links aren't routes: `learnfrc://home` and `learnfrc://continue` (see `AppModel.handle(url:)`).
extension AppRoute {
    static let scheme = "learnfrc"

    var deepLinkURL: URL {
        var components = URLComponents()
        components.scheme = Self.scheme
        switch self {
        case .department(let id): components.host = "department"; components.path = "/" + id.uuidString.lowercased()
        case .module(let id): components.host = "module"; components.path = "/" + id.uuidString.lowercased()
        case .lesson(let id): components.host = "lesson"; components.path = "/" + id.uuidString.lowercased()
        case .article(let slug): components.host = "article"; components.path = "/" + slug
        case .glossaryTerm(let slug): components.host = "glossary"; components.path = "/" + slug
        case .path(let slug): components.host = "path"; components.path = "/" + slug
        case .profile(let username): components.host = "u"; components.path = "/" + username
        case .certificate(let id): components.host = "certificate"; components.path = "/" + id.uuidString.lowercased()
        case .team: components.host = "team"
        case .leaderboard: components.host = "leaderboard"
        case .settings: components.host = "settings"
        case .videos: components.host = "videos"
        case .achievements: components.host = "achievements"
        case .bookmarks: components.host = "bookmarks"
        case .tools: components.host = "tools"
        case .tool(let slug): components.host = "tools"; components.path = "/" + slug
        case .resources: components.host = "resources"
        case .admin: components.host = "admin"
        case .adminFeedback: components.host = "admin"; components.path = "/feedback"
        case .adminTeam: components.host = "admin"; components.path = "/team"
        case .apply: components.host = "apply"
        }
        return components.url ?? URL(string: "\(Self.scheme)://home")!
    }

    /// Parses a `learnfrc://` link. Web links need the catalog: use `CatalogStore.route(for:)`.
    init?(deepLink url: URL) {
        guard url.scheme?.lowercased() == Self.scheme, let host = url.host()?.lowercased() else { return nil }
        let value = url.pathComponents.filter { $0 != "/" }.first?.removingPercentEncoding
        switch host {
        case "lesson": guard let id = value.flatMap(UUID.init(uuidString:)) else { return nil }; self = .lesson(id)
        case "department": guard let id = value.flatMap(UUID.init(uuidString:)) else { return nil }; self = .department(id)
        case "module": guard let id = value.flatMap(UUID.init(uuidString:)) else { return nil }; self = .module(id)
        case "certificate": guard let id = value.flatMap(UUID.init(uuidString:)) else { return nil }; self = .certificate(id)
        case "article", "blog": guard let value, !value.isEmpty else { return nil }; self = .article(value)
        case "glossary": self = .glossaryTerm(value ?? "")  // no slug: the catalogue
        case "path", "paths": guard let value, !value.isEmpty else { return nil }; self = .path(value)
        case "u", "profile": guard let value, !value.isEmpty else { return nil }; self = .profile(value)
        case "team", "teams": self = .team
        case "leaderboard": self = .leaderboard
        case "settings": self = .settings
        case "videos": self = .videos
        case "achievements": self = .achievements
        case "bookmarks": self = .bookmarks
        case "tools": self = value.map { $0.isEmpty ? .tools : .tool($0) } ?? .tools
        case "resources": self = .resources
        case "admin":
            switch value?.lowercased() {
            case "team": self = .adminTeam
            case "feedback": self = .adminFeedback
            default: self = .admin
            }
        case "apply": self = .apply
        default: return nil
        }
    }
}
