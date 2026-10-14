import SwiftUI

/// Resolves every `AppRoute` to its screen. Registered once per tab stack by
/// `appRouteDestinations()`, so any screen can push with `NavigationLink(value: AppRoute)` or
/// `AppModel.push(_:)`.
///
/// When a link replaces the top of a stack with a route of the same kind (`open` puts
/// `learnfrc://u/b` where `u/a` was), `NavigationStack` keeps the screen at that depth and
/// hands it the new route, `@State` and all: the profile page showed a's record under b's
/// name. So every screen is tied to its route (`.id(route)`) and a new route builds a fresh
/// one. Lessons are the exception on purpose: a lesson steps to the next or previous one in
/// place (the path's top `.lesson` is swapped and `LessonView` follows its `lessonID`),
/// keeping the reader's chrome without a push animation.
struct AppRouteDestination: View {
    let route: AppRoute

    var body: some View {
        switch route {
        case .lesson(let id):
            LessonView(lessonID: id)
        default:
            screen.id(route)
        }
    }

    @ViewBuilder private var screen: some View {
        switch route {
        case .department(let id): DepartmentView(departmentID: id)
        case .module(let id): ModuleView(moduleID: id)
        case .lesson(let id): LessonView(lessonID: id)
        case .article(let slug): ArticleView(slug: slug)
        case .glossaryTerm(let slug): GlossaryTermView(slug: slug)
        case .path(let slug): PathView(slug: slug)
        case .profile(let username): PublicProfileView(username: username)
        case .team: TeamView()
        case .leaderboard: LeaderboardView()
        case .settings: SettingsView()
        case .certificate(let id): CertificateView(departmentID: id)
        case .videos: VideosView()
        case .achievements: AchievementsView()
        case .bookmarks: BookmarksView()
        }
    }
}

extension View {
    /// Registers `AppRouteDestination` for a tab's `NavigationStack`. Each pushed screen is told
    /// its tab (`\.navigationTab`) directly: on the Mac a destination doesn't always inherit the
    /// stack's environment, and `isShowing(_:in:)` and `push(_:in:)` need it.
    func appRouteDestinations(tab: AppTab? = nil) -> some View {
        navigationDestination(for: AppRoute.self) {
            AppRouteDestination(route: $0).environment(\.navigationTab, tab)
        }
    }
}

extension AppRoute {
    /// A short name for the screen this route shows, the same words as its navigation title
    /// where they don't depend on a network load. Names iPad windows in the Dock's window list
    /// and the app switcher. Nil when the catalog doesn't have the item yet.
    @MainActor
    func screenTitle(catalog: CatalogStore, reference: ReferenceStore) -> String? {
        switch self {
        case .department(let id): catalog.department(id: id)?.name
        case .module(let id): catalog.module(id: id)?.title
        case .lesson(let id): catalog.location(of: id)?.lesson.title
        case .article(let slug): slug.isEmpty ? "Articles" : catalog.article(slug: slug)?.title
        case .glossaryTerm(let slug): slug.isEmpty ? "Glossary" : reference.term(slug: slug)?.term
        case .path(let slug): reference.path(slug: slug)?.title
        case .profile(let username): "@\(username)"
        case .team: "My team"
        case .leaderboard: "Leaderboard"
        case .settings: "Settings"
        case .certificate: "Certificate"
        case .videos: "Videos"
        case .achievements: "Badges"
        case .bookmarks: "Bookmarks"
        }
    }
}
