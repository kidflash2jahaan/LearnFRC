import Foundation
import Observation

/// What a link asks the app to do.
///
/// One parser for every way into the app: `learnfrc://` links (widgets, notifications,
/// shortcuts), learnfrc.com links (Handoff, universal links, links inside lessons) and
/// Spotlight item identifiers. Parsing never needs the catalog; links that name things
/// by slug (`/guides/<department>/<module>/<lesson>`) come back as `.catalog(...)` and are
/// turned into a screen by `resolved(using:)`.
///
///     DeepLink.parse(URL(string: "https://learnfrc.com/blog/swerve-basics")!)  // .route(.article("swerve-basics"))
///     DeepLink.parse(URL(string: "learnfrc://continue")!)                       // .continueLesson
///     DeepLink.parse(URL(string: "https://learnfrc.com/guides/programming")!)   // .catalog(.guides(department: "programming", ...))
enum DeepLink: Hashable, Sendable {
    /// A screen the app has.
    case route(AppRoute)
    /// The root of a tab (`/guides`, `/glossary`, `/blog`, `learnfrc://home`).
    case tab(AppTab)
    /// The person's continue lesson (`learnfrc://continue`).
    case continueLesson
    /// Search, with an optional query (`learnfrc://search?q=swerve`).
    case search(String)
    /// A link that names things by slug; needs the catalog (`resolved(using:)`).
    case catalog(CatalogLink)
    /// A learnfrc.com page the app has no screen for. Open it in the browser.
    case web(URL)
    /// Not a LearnFRC link at all. Open it in the browser (or ignore it).
    case external(URL)

    /// Slug-addressed catalog links.
    enum CatalogLink: Hashable, Sendable {
        /// `/guides/<department>[/<module>[/<lesson>]]`
        case guides(department: String, module: String?, lesson: String?)
        /// `/certificate/<department slug>`
        case certificate(department: String)
    }

    /// The web hosts that count as "ours".
    static let webHosts: Set<String> = ["learnfrc.com", "www.learnfrc.com"]

    /// True when the app can show this link itself (everything but `.web` and `.external`).
    var isInApp: Bool {
        switch self {
        case .web, .external: false
        default: true
        }
    }
}

// MARK: - Parsing

extension DeepLink {
    /// Classifies any URL. Pure: no catalog, no main actor.
    static func parse(_ url: URL) -> DeepLink {
        let scheme = url.scheme?.lowercased()
        let query = searchQuery(in: url)

        if scheme == AppRoute.scheme {
            // learnfrc://lesson/<id> puts the first segment in the host; learnfrc:///lesson/<id> doesn't.
            var segments = pathSegments(of: url)
            if let host = url.host(percentEncoded: false)?.lowercased(), !host.isEmpty {
                segments.insert(host, at: 0)
            }
            return classify(segments, query: query, original: url, isWeb: false)
        }

        if scheme == "http" || scheme == "https" {
            guard let host = url.host(percentEncoded: false)?.lowercased(), webHosts.contains(host) else {
                return .external(url)
            }
            return classify(pathSegments(of: url), query: query, original: url, isWeb: true)
        }

        // A bare site path like "/guides/a/b/c" (links inside lessons and articles).
        if scheme == nil, url.host() == nil, url.path().hasPrefix("/") {
            let segments = pathSegments(of: url)
            let canonical = URL(string: url.absoluteString, relativeTo: AppConfig.webBase)?.absoluteURL ?? AppConfig.webBase
            return classify(segments, query: query, original: canonical, isWeb: true)
        }

        return .external(url)
    }

    /// Parses a string link (`"learnfrc://lesson/..."`, `"https://learnfrc.com/..."` or `"/guides/..."`).
    static func parse(_ string: String) -> DeepLink? {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let url = URL(string: trimmed) { return parse(url) }
        if let encoded = trimmed.addingPercentEncoding(withAllowedCharacters: .urlFragmentAllowed),
           let url = URL(string: encoded) {
            return parse(url)
        }
        return nil
    }

    /// The `q` (or `query`) parameter, if any.
    private static func searchQuery(in url: URL) -> String? {
        guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return nil }
        let value = items.first { ["q", "query"].contains($0.name.lowercased()) }?.value
        return value?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Non-empty, percent-decoded path segments, case preserved.
    private static func pathSegments(of url: URL) -> [String] {
        url.path(percentEncoded: true)
            .split(separator: "/", omittingEmptySubsequences: true)
            .map { String($0).removingPercentEncoding ?? String($0) }
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    /// Maps path segments to an action. The custom scheme and the website share one table,
    /// so `learnfrc://blog/x` and `https://learnfrc.com/blog/x` mean the same thing.
    private static func classify(_ segments: [String], query: String?, original: URL, isWeb: Bool) -> DeepLink {
        let unknown: DeepLink = isWeb ? .web(original) : .tab(.home)
        guard let head = segments.first?.lowercased() else { return .tab(.home) }
        let rest = Array(segments.dropFirst())
        let first = rest.first
        // Slugs on the site are lowercase; usernames are compared lowercased by the site too.
        let slug = first?.lowercased()

        switch head {
        case "home", "dashboard", "start":
            return .tab(.home)

        case "continue", "resume":
            return .continueLesson

        case "lesson":
            if let id = first.flatMap(UUID.init(uuidString:)) { return .route(.lesson(id)) }
            return unknown
        case "department":
            if let id = first.flatMap(UUID.init(uuidString:)) { return .route(.department(id)) }
            return unknown
        case "module":
            if let id = first.flatMap(UUID.init(uuidString:)) { return .route(.module(id)) }
            return unknown

        case "certificate", "certificates":
            guard let first else { return isWeb ? unknown : .tab(.profile) }
            if let id = UUID(uuidString: first) { return .route(.certificate(id)) }
            return .catalog(.certificate(department: first.lowercased()))

        case "guides", "learn", "departments":
            guard let department = slug else { return .tab(.learn) }
            return .catalog(.guides(
                department: department,
                module: rest.count > 1 ? rest[1].lowercased() : nil,
                lesson: rest.count > 2 ? rest[2].lowercased() : nil
            ))

        case "blog", "article", "articles":
            guard let slug else { return .tab(.learn) }
            return .route(.article(slug))

        case "glossary", "term":
            // learnfrc.com/glossary is the card catalogue.
            guard let slug else { return .route(.glossaryIndex) }
            return .route(.glossaryTerm(slug))

        case "paths", "path":
            guard let slug else { return .tab(.learn) }
            return .route(.path(slug))

        case "u", "user", "users":
            guard let first else { return unknown }
            return .route(.profile(first.lowercased()))
        case "profile":
            // The site's /profile is "my profile"; learnfrc://profile/<name> is someone's.
            guard let first else { return .tab(.profile) }
            return .route(.profile(first.lowercased()))

        case "search":
            return .search(query ?? first ?? "")

        case "team", "teams":
            return .route(.team)
        case "leaderboard":
            return .route(.leaderboard)
        case "settings":
            return .route(.settings)
        case "videos":
            return .route(.videos)
        case "achievements", "badges":
            return .route(.achievements)
        case "bookmarks":
            return .route(.bookmarks)

        case "login", "signin", "sign-in", "signup", "sign-up":
            return .tab(.profile)

        default:
            return unknown
        }
    }
}

// MARK: - Resolving slugs

extension DeepLink {
    /// Turns `.catalog(...)` into a screen using the catalog. Anything else comes back unchanged.
    /// A department the catalog doesn't know falls back to the browser (web links) or Guides.
    @MainActor
    func resolved(using catalog: CatalogStore) -> DeepLink {
        guard case .catalog(let link) = self else { return self }
        switch link {
        case .certificate(let slug):
            guard let department = catalog.department(slug: slug) else { return fallback }
            return .route(.certificate(department.id))
        case .guides(let departmentSlug, let moduleSlug, let lessonSlug):
            guard let department = catalog.department(slug: departmentSlug) else { return fallback }
            guard let moduleSlug else { return .route(.department(department.id)) }
            guard let module = department.modules.first(where: { $0.slug.lowercased() == moduleSlug }) else {
                // The site sometimes links a lesson by its slug under the department alone.
                if let lesson = department.lessons.first(where: { $0.slug.lowercased() == moduleSlug }) {
                    return .route(.lesson(lesson.id))
                }
                return .route(.department(department.id))
            }
            guard let lessonSlug else { return .route(.module(module.id)) }
            guard let lesson = module.lessons.first(where: { $0.slug.lowercased() == lessonSlug }) else {
                return .route(.module(module.id))
            }
            return .route(.lesson(lesson.id))
        }
    }

    /// What an unresolvable catalog link becomes.
    private var fallback: DeepLink {
        guard case .catalog(let link) = self else { return self }
        switch link {
        case .guides(let department, let module, let lesson):
            let path = ["guides", department, module, lesson].compactMap { $0 }.joined(separator: "/")
            return .web(AppConfig.webBase.appending(path: path))
        case .certificate:
            return .tab(.profile)
        }
    }
}

// MARK: - Spotlight

extension DeepLink {
    /// Maps a Spotlight item identifier (the `CSSearchableItemActivityIdentifier` of a tapped
    /// result) to a link. App-entity items look like `LessonEntity/<UUID>` and
    /// `GlossaryTermEntity/<slug>`; the app's own items use their `learnfrc://` link.
    static func spotlight(identifier: String) -> DeepLink? {
        let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if trimmed.lowercased().hasPrefix(AppRoute.scheme + ":") {
            return parse(trimmed)
        }

        guard let slash = trimmed.firstIndex(of: "/") else {
            // A bare lesson id.
            return UUID(uuidString: trimmed).map { .route(.lesson($0)) }
        }
        let type = trimmed[..<slash].lowercased()
        let value = String(trimmed[trimmed.index(after: slash)...])
        guard !value.isEmpty else { return nil }

        switch type {
        case LessonEntity.spotlightTypeName.lowercased():
            return UUID(uuidString: value).map { .route(.lesson($0)) }
        case GlossaryTermEntity.spotlightTypeName.lowercased():
            return .route(.glossaryTerm(value.lowercased()))
        default:
            return nil
        }
    }
}

// MARK: - Following a link

extension AppModel {
    /// Opens any LearnFRC link: `learnfrc://`, learnfrc.com, a site path or a Spotlight
    /// identifier. Returns false when the app has no screen for it, so the caller can open
    /// the browser (`openURL`) instead.
    ///
    /// A link that names lessons by slug needs the catalog, and the continue lesson needs the
    /// cached progress and the stored session; before those are in (a cold launch) use
    /// `openDeepLinkWhenReady(_:)` or `SystemServices.open(_:)`, which wait for them.
    @discardableResult
    func openDeepLink(_ url: URL) -> Bool {
        follow(DeepLink.parse(url))
    }

    /// Like `openDeepLink(_:)`, but waits for what the link needs first (instant once loaded,
    /// no network). Returns the link to open in the browser, if any.
    func openDeepLinkWhenReady(_ url: URL) async -> URL? {
        await followWhenReady(DeepLink.parse(url), original: url)
    }

    /// True when following `link` now gives the same answer it would once launch settles:
    /// slug links need the catalog; the continue lesson needs the cached progress and the
    /// stored session (before them it would fall back to the Guides wall).
    func isReady(for link: DeepLink) -> Bool {
        switch link {
        case .catalog: catalog.isLoaded
        case .continueLesson: isCacheLoaded && catalog.isLoaded && !account.isLoading
        default: true
        }
    }

    /// Claims the next link turn. A link that has to wait takes its turn when it arrives and
    /// only acts if no other link was followed in the meantime.
    func beginLink() -> Int {
        linkGeneration &+= 1
        return linkGeneration
    }

    /// Performs a parsed link once what it needs is in memory (`isReady(for:)`). Returns the
    /// URL to hand to the browser when the app has no screen for it (nil when it was handled,
    /// when a newer link took over while this one waited, or when it's a `learnfrc://` link
    /// with nowhere to go). Pass the `generation` from `beginLink()` when the call is made
    /// later than the link arrived (from a `Task`), so the order is the order links came in.
    func followWhenReady(_ link: DeepLink, original: URL? = nil, generation: Int? = nil) async -> URL? {
        let turn = generation ?? beginLink()
        if !isReady(for: link) {
            if case .continueLesson = link {
                await waitForAccountRestore()
            } else {
                await loadCache()
            }
        }
        // Another link, Handoff or Spotlight result came in while this one waited: it wins.
        guard turn == linkGeneration else { return nil }
        if perform(link) { return nil }
        switch link.resolved(using: catalog) {
        case .web(let url), .external(let url): return url
        default: return original.flatMap { $0.scheme?.lowercased() == AppRoute.scheme ? nil : $0 }
        }
    }

    /// Performs a parsed link in the active window now. Returns false for `.web` and
    /// `.external` (open those in the browser). A link still waiting in `followWhenReady`
    /// gives way to this one.
    @discardableResult
    func follow(_ link: DeepLink) -> Bool {
        _ = beginLink()
        return perform(link)
    }

    private func perform(_ link: DeepLink) -> Bool {
        switch link.resolved(using: catalog) {
        case .route(.settings):
            showSettings()
            return true
        case .route(let route):
            open(route)
            return true
        case .tab(let tab):
            activeNavigation.show(tab)
            revealActiveWindow()
            return true
        case .continueLesson:
            if let lesson = progress.continueLesson ?? catalog.firstLesson {
                open(.lesson(lesson.id))
            } else {
                activeNavigation.show(.learn)
                revealActiveWindow()
            }
            return true
        case .search(let query):
            requestSearch(query)
            return true
        case .catalog, .web, .external:
            return false
        }
    }

    /// Handoff of a lesson from another device (`com.learnfrc.app.lesson`, which carries the
    /// lesson id, so it works before the catalog is loaded) or of a learnfrc.com page
    /// (`NSUserActivityTypeBrowsingWeb`), which goes through `SystemServices.open(_:)` like
    /// any link: it waits for the cached catalog, and a page the app has no screen for opens
    /// in the browser. False when the activity names nothing to open.
    @discardableResult
    func handle(userActivity: NSUserActivity) -> Bool {
        if let id = userActivity.userInfo?["lessonID"] as? String, let uuid = UUID(uuidString: id) {
            follow(.route(.lesson(uuid)))
            return true
        }
        if let url = userActivity.webpageURL {
            SystemServices.open(url)
            return true
        }
        return false
    }

    /// Shows Settings for a link (`learnfrc://settings`, learnfrc.com/settings) or the system's
    /// notification-settings button. The Mac has one Settings, in its own window (what ⌘, and
    /// `SettingsLink` open), so it opens that window; elsewhere the Settings screen opens in
    /// the window in use.
    func showSettings() {
        #if os(macOS)
        if SystemServices.openSettingsWindow() { return }
        #endif
        open(.settings)
    }

    /// Switches the active window to Search and asks its search screen to focus the field
    /// (and fill in `query`). The request waits in that window's `WindowNavigation` until the
    /// search screen takes it, so it works even when the Search tab hasn't been built yet.
    /// ⌘K, `learnfrc://search?q=`, the Search App Shortcut and Spotlight's "search in app"
    /// all come through here.
    func requestSearch(_ query: String = "") {
        activeNavigation.requestSearch(query)
        revealActiveWindow()
    }
}
