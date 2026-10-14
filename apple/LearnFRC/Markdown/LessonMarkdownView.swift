import SwiftUI

/// Renders a lesson or article body in the notebook style.
///
///     LessonMarkdownView(markdown: body.content, glossary: reference.glossary) { route in
///         path.append(route)
///     }
///
/// - Headings, paragraphs, nested lists, block quotes, callouts (a quote that opens
///   with bold text), syntax-highlighted code, GFM tables and rules, like `.nb-prose`.
/// - Links to learnfrc.com guides, articles, the glossary and paths call `onOpen`
///   with the matching `AppRoute`; anything else opens in the browser.
/// - The first mention of up to four glossary terms becomes a quiet dotted link
///   that opens a definition card (a popover on iPad and Mac, a sheet on iPhone),
///   following the website's auto-link rules exactly. The card closes as soon as the
///   window navigates anywhere (`closesOnNavigation`), and its "Open glossary entry"
///   goes through `onOpen`, which should push onto the screen's own tab.
/// - Text is selectable and every size follows Dynamic Type.
///
/// It is not a scroll view: put it inside the screen's `ScrollView`. Each heading
/// carries its anchor as its `.id`, so `ScrollViewProxy.scrollTo(heading.id)` works
/// with `LessonMarkdownView.headings(in:)`. The view caps itself at a readable
/// measure (about 68 characters); align it with the parent's stack.
struct LessonMarkdownView: View {
    let markdown: String
    let glossary: [GlossaryTerm]
    let onOpen: (AppRoute) -> Void

    private let entries: [GlossaryLinkEntry]
    private let termsBySlug: [String: GlossaryTerm]

    @State private var presentedTerm: String?
    @Environment(CatalogStore.self) private var catalog: CatalogStore?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var measure: CGFloat = LF.Metrics.readableWidth

    init(markdown: String, glossary: [GlossaryTerm] = [], onOpen: @escaping (AppRoute) -> Void = { _ in }) {
        self.markdown = markdown
        self.glossary = glossary
        self.onOpen = onOpen
        self.entries = glossary.map(GlossaryLinkEntry.init)
        self.termsBySlug = Dictionary(glossary.map { ($0.slug, $0) }, uniquingKeysWith: { first, _ in first })
    }

    /// A cache lookup: the document was parsed once, the first time it was shown
    /// (or ahead of time by `prepare`).
    private var document: MarkdownDocument {
        MarkdownDocumentCache.shared.document(for: markdown, glossary: entries, scale: .current(dynamicTypeSize))
    }

    var body: some View {
        ScrollViewReader { proxy in
            MarkdownBlocksView(blocks: document.blocks, context: context, nesting: .root)
                .frame(maxWidth: measure, alignment: .leading)
                .textSelection(.enabled)
                .environment(\.openURL, OpenURLAction { url in
                    handle(url, proxy: proxy)
                })
        }
        // A link, a search request or a tab switch takes the window somewhere else: the
        // glossary card goes with the page it belongs to, rather than floating over another
        // screen where "Open glossary entry" would push onto the wrong tab.
        .closesOnNavigation($presentedTerm)
    }

    private var context: MarkdownRenderContext {
        MarkdownRenderContext(
            terms: termsBySlug,
            presentedTerm: $presentedTerm,
            open: onOpen,
            surface: .paper
        )
    }

    // MARK: Links

    private func handle(_ url: URL, proxy: ScrollViewProxy) -> OpenURLAction.Result {
        switch MarkdownLinks.target(for: url) {
        case .glossaryCard(let slug):
            if termsBySlug[slug] != nil {
                presentedTerm = slug
            } else {
                onOpen(.glossaryTerm(slug))
            }
            return .handled

        case .anchor(let id):
            LF.Motion.perform(LF.Motion.settle) {
                proxy.scrollTo(id, anchor: .top)
            }
            return .handled

        case .site(let path, _, let siteURL):
            if let route = catalog?.route(for: siteURL) ?? Self.routeWithoutCatalog(path) {
                onOpen(route)
                return .handled
            }
            return .systemAction(siteURL, prefersInApp: true)

        case .external(let external):
            let isWeb = ["http", "https"].contains(external.scheme?.lowercased() ?? "")
            return isWeb ? .systemAction(external, prefersInApp: true) : .systemAction(external)
        }
    }

    /// Routes that need no catalog lookup (previews, or before the catalog loads).
    nonisolated static func routeWithoutCatalog(_ path: [String]) -> AppRoute? {
        guard let first = path.first?.lowercased() else { return nil }
        let second = path.count > 1 ? path[1] : nil
        switch first {
        case "blog": return second.map(AppRoute.article)
        case "glossary": return second.map(AppRoute.glossaryTerm)
        case "paths": return second.map(AppRoute.path)
        case "u": return second.map(AppRoute.profile)
        case "leaderboard": return .leaderboard
        case "videos": return .videos
        case "achievements": return .achievements
        case "bookmarks": return .bookmarks
        case "settings": return .settings
        case "teams", "team": return .team
        default: return nil
        }
    }
}

extension LessonMarkdownView {
    /// The ## and ### headings with the website's anchor ids, for an "on this page" list.
    nonisolated static func headings(in markdown: String) -> [LessonMarkdownHeading] {
        MarkdownParser.headings(in: markdown)
    }

    /// The body as plain text (Markdown removed), for read-aloud and search.
    /// Safe to call off the main thread.
    nonisolated static func plainText(of markdown: String, glossary: [GlossaryTerm] = []) -> String {
        MarkdownDocumentCache.shared.document(for: markdown, glossary: glossary.map(GlossaryLinkEntry.init)).plainText
    }

    /// Parses a body ahead of time, off the main thread, so opening it is instant.
    /// Call it for the next lesson while the current one is on screen; pass the
    /// screen's `dynamicTypeSize` so emphasis is built at the right size.
    static func prepare(_ markdown: String, glossary: [GlossaryTerm] = [], dynamicTypeSize: DynamicTypeSize = .large) async {
        let entries = glossary.map(GlossaryLinkEntry.init)
        let scale = MarkdownTypeScale.current(dynamicTypeSize)
        guard !MarkdownDocumentCache.shared.contains(markdown, glossary: entries, scale: scale) else { return }
        await Task.detached(priority: .utility) {
            _ = MarkdownDocumentCache.shared.document(for: markdown, glossary: entries, scale: scale)
        }.value
    }
}

// MARK: - Render context

/// What every block needs from the document view: the glossary, the presented
/// term, the route handler, and which surface it sits on.
struct MarkdownRenderContext {
    enum Surface { case paper, card }

    var terms: [String: GlossaryTerm]
    var presentedTerm: Binding<String?>
    var open: (AppRoute) -> Void
    var surface: Surface

    func on(_ surface: Surface) -> MarkdownRenderContext {
        var copy = self
        copy.surface = surface
        return copy
    }
}
