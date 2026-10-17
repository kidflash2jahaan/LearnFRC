import Combine
import SwiftUI

/// Search: every department, module, lesson (title, summary and full text), article and
/// glossary term, searched on this device as you type. Works offline once the catalog is
/// cached.
///
/// Put it inside a `NavigationStack` that registers `AppRoute` destinations. It brings its
/// own `.searchable` field, so it works as the iOS 26 search tab
/// (`Tab(role: .search) { NavigationStack { SearchView() } }`), as an iPad or Mac sidebar
/// destination (the field sits in the toolbar), or pushed. To open it from a menu command,
/// shortcut, link or App Intent, call `AppModel.requestSearch(_:)`: the request waits in the
/// window's `WindowNavigation` and this screen fills in the words and focuses the field.
///
/// On iPhone Duo's open screen held upright it's a spread: the results on the left page and
/// the one picked, laid out in full, on the right page (`SearchPreviewCard`), each page
/// scrolling on its own. A result on the left shows on the right; the card's button opens it.
/// With nothing to show, the right page has the glossary card of the day. Next to the
/// vertical bar the field sits in a drawer that's always out (`searchFieldInView`).
struct SearchView: View {
    private let initialQuery: String?

    @Environment(CatalogStore.self) private var catalog
    @Environment(ReferenceStore.self) private var reference
    @Environment(ProgressStore.self) private var progress
    @Environment(Connectivity.self) private var connectivity
    @Environment(AppModel.self) private var app
    @Environment(AccountStore.self) private var account
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    /// The tab whose stack this screen sits in (Search's own), as the environment brings it;
    /// use `screenTab` (`NavigationTabFallback`).
    @Environment(\.navigationTab) private var tab
    @State private var tabFallback = NavigationTabFallback()
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var model = SearchModel()
    @State private var didRestore = false
    /// The result shown on the right page of a spread (`SearchHit.id`). When it isn't among
    /// the results showing, the first one is.
    @State private var previewID: String?
    /// The last search worth coming back to after a relaunch: one submitted, picked from the
    /// page, asked for by a link, or left with results showing. Never every keystroke, so
    /// text that landed in the field by mistake isn't written to disk. The words being typed
    /// live in the window's `memory` instead, for the Mac's rebuilt tab stack.
    @SceneStorage("search.query") private var storedQuery = ""
    @AppStorage(SearchRecents.storageKey) private var recentsStorage = "[]"
    @FocusState private var fieldFocused: Bool

    /// - Parameter query: open with this text in the field (App Shortcuts, previews).
    init(query: String? = nil) {
        self.initialQuery = query
    }

    private var indexStore: SearchIndexStore { .shared }
    private var signature: SearchCorpus.Signature { SearchCorpus.Signature(catalog: catalog, reference: reference) }
    private var recents: [String] { SearchRecents.decode(recentsStorage) }
    /// Content width (inside the gutters) for the two-column layouts: an 880pt page. Width
    /// rules are decided during layout (`SearchWidthSwitch`, `SearchAdaptiveGrid`,
    /// `searchPage()`), never from a width stored in state, which can feed back into layout.
    private static let wideContent: CGFloat = 810
    /// Two browse cards side by side from a 620pt page.
    private static let browseColumns = [SearchColumnsLayout.Breakpoint(minWidth: 570, columns: 2)]
    /// Two glossary cards side by side from a 600pt page.
    private static let glossaryPair = [SearchColumnsLayout.Breakpoint(minWidth: 552, columns: 2)]
    private var allowsWide: Bool { !dynamicTypeSize.isAccessibilitySize }
    private var results: SearchResults { model.results }

    var body: some View {
        FoldReader { proxy, fold in
            let margins = proxy.lfPageMargins
            if let band = Self.spreadBand(fold, width: proxy.size.width, margins: margins) {
                spread(band: band, margins: margins)
            } else {
                pageScroll {
                    Group {
                        if model.hasQuery {
                            resultsPage(previewing: false)
                        } else {
                            idlePage
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 56)
                    .searchPage(margins: margins)
                }
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .paperBackground()
        .navigationTitle("Search")
        .toolbarTitleDisplayMode(.inline)
        .searchFieldInView(text: $model.query, prompt: Text("Lessons, articles, terms"))
        .searchFocused($fieldFocused)
        .onSubmit(of: .search, submit)
        .onChange(of: model.query) { _, newValue in
            model.queryChanged()
            navigation?.memory.set(newValue, for: Self.memoryKey)
            if newValue.isEmpty, !storedQuery.isEmpty { storedQuery = "" }
        }
        .task(id: signature) {
            await indexStore.prepare(catalog: catalog, reference: reference)
            model.use(indexStore.index)
        }
        .onChange(of: indexStore.index.map(ObjectIdentifier.init)) { _, _ in
            model.use(indexStore.index)
        }
        .onAppear(perform: restore)
        .onDisappear(perform: rememberQuery)
        .onChange(of: navigation?.searchRequest?.id, initial: true) {
            takeSearchRequest()
        }
        // A request that came in behind the username gate is taken once the gate is done.
        .onChange(of: account.needsUsernameSetup) { _, needsSetup in
            if !needsSetup { takeSearchRequest() }
        }
        // The kept scroll position needs the tab, even where the environment didn't bring it.
        .environment(\.navigationTab, screenTab)
    }

    private var screenTab: AppTab? { tabFallback.tab(tab, navigation: navigation) }

    // MARK: - The page and the spread

    /// The scrolling page (the left page on a spread): it comes back where it was left, and
    /// goes to the top when the scope changes.
    private func pageScroll<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let page = content()
        return ScrollViewReader { proxy in
            ScrollView {
                page
                    .id("search-top")
            }
            // The Mac rebuilds the tab on every switch: the page comes back where it was left,
            // with the same words and scope (restored from `memory` when it appears).
            .remembersScroll(.root)
            .onChange(of: model.scope) { _, scope in
                proxy.scrollTo("search-top", anchor: .top)
                navigation?.memory.set(scope, for: Self.scopeMemoryKey)
            }
        }
    }

    /// The fold's band when it splits the page into two pages wide enough to read, in the
    /// page's coordinates (a crease top to bottom, iPhone Duo held upright); nil elsewhere.
    private static func spreadBand(_ fold: FoldInfo, width: CGFloat, margins: LF.PageMargins) -> CGRect? {
        guard width <= LF.Metrics.maxContentWidth,
              fold.columns(from: margins.leading, to: width - margins.trailing) != nil else { return nil }
        return fold.band
    }

    /// Two pages, each scrolling on its own: the list on the left, the pick on the right.
    private func spread(band: CGRect, margins: LF.PageMargins) -> some View {
        HStack(spacing: 0) {
            pageScroll {
                Group {
                    if model.hasQuery {
                        resultsPage(previewing: true)
                    } else {
                        idleLeftPage
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 56)
                .padding(.leading, margins.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: band.minX)

            Color.clear
                .frame(width: band.width)
                .accessibilityHidden(true)

            rightPage
                .frame(maxWidth: .infinity)
                .padding(.trailing, margins.trailing)
        }
    }

    /// The right page: the result picked on the left, or the card of the day.
    private var rightPage: some View {
        let hit = model.hasQuery && indexStore.index != nil ? previewHit : nil
        return ZStack(alignment: .top) {
            ScrollView {
                Group {
                    if let hit {
                        SearchPreviewCard(hit: hit, isCompleted: isCompleted(hit))
                    } else {
                        cardOfTheDay
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 56)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            // Each pick opens at its top, and the change is a fade (not motion, so it stays
            // under Reduce Motion).
            .id(hit?.id ?? "drawer")
            .transition(.opacity)
        }
        .animation(LF.Motion.hover, value: hit?.id)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(hit == nil ? "Card of the day" : "Preview")
    }

    /// The hits the left page lists, in its order.
    private var listedHits: [SearchHit] {
        guard model.scope == .all else { return results.hits(in: model.scope) }
        let hits = otherHits
        return (results.topHit.map { [$0] } ?? []) + Array(hits.glossary.prefix(3)) + Array(hits.guides.prefix(6)) + Array(hits.articles.prefix(4))
    }

    /// The result on the right page: the one picked, while it's still listed, else the first.
    private var previewHit: SearchHit? {
        let hits = listedHits
        if let previewID, let picked = hits.first(where: { $0.id == previewID }) { return picked }
        return hits.first
    }

    /// Where the words being typed wait in the window's `memory`.
    private static let memoryKey = "search.query"
    /// Where the scope (all, guides, articles, glossary) waits in the window's `memory`.
    private static let scopeMemoryKey = "search.scope"

    // MARK: - Actions

    private func restore() {
        if !didRestore {
            didRestore = true
            if let initialQuery {
                model.query = initialQuery
            } else if model.query.isEmpty {
                let typed = navigation?.memory.value(String.self, for: Self.memoryKey) ?? ""
                model.query = typed.isEmpty ? storedQuery : typed
                if let scope = navigation?.memory.value(SearchScope.self, for: Self.scopeMemoryKey) {
                    model.scope = scope
                }
            }
        }
        takeSearchRequest()
    }

    /// ⌘K, `learnfrc://search?q=`, the Search App Shortcut or Spotlight asked for search:
    /// fill in the words (if any) and focus the field. Not while the username gate covers the
    /// app: the field isn't on screen, so what someone typed into the gate would land here.
    /// The request waits in `WindowNavigation` until the gate is done.
    private func takeSearchRequest() {
        guard !account.needsUsernameSetup, let request = navigation?.takeSearchRequest() else { return }
        didRestore = true
        if !request.query.isEmpty {
            model.query = request.query
            keep(request.query)
        }
        fieldFocused = true
        // The field may not accept focus on the frame the screen appears; ask once more.
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(350))
            if !fieldFocused { fieldFocused = true }
        }
    }

    private func submit() {
        keep(model.query)
        remember(model.trimmedQuery)
        #if os(macOS)
        // Return opens the best result, like the site's palette.
        if model.isCurrent, let first = results.topHit ?? results.hits(in: model.scope).first {
            // Onto Search's own stack in this window, not whichever tab is selected.
            if let navigation {
                navigation.push(first.document.route, in: screenTab)
            } else {
                app.push(first.document.route)
            }
        }
        #endif
    }

    private func rememberQuery() {
        guard model.isCurrent, !results.isEmpty else { return }
        keep(model.query)
        remember(model.trimmedQuery)
    }

    /// Saves the search for the next launch (`storedQuery`).
    private func keep(_ query: String) {
        if storedQuery != query { storedQuery = query }
    }

    private func remember(_ query: String) {
        recentsStorage = SearchRecents.encode(SearchRecents.adding(query, to: recents))
    }

    private func use(_ query: String) {
        model.query = query
        keep(query)
        Haptics.select()
    }

    // MARK: - Idle page

    private var idlePage: some View {
        VStack(alignment: .leading, spacing: 38) {
            masthead
            if allowsWide {
                SearchWidthSwitch(minWidth: Self.wideContent) {
                    HStack(alignment: .top, spacing: 44) {
                        VStack(alignment: .leading, spacing: 38) {
                            recentsOrSuggestions
                            browse
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        // About a third of the page, as before: 300 to 420 points.
                        cardOfTheDay
                            .frame(minWidth: 300, idealWidth: 380, maxWidth: 420)
                    }
                } narrow: {
                    idleColumn
                }
            } else {
                idleColumn
            }
        }
    }

    private var idleColumn: some View {
        VStack(alignment: .leading, spacing: 38) {
            recentsOrSuggestions
            cardOfTheDay
            browse
        }
    }

    /// The idle page's left page on a spread: the card of the day has the right page.
    private var idleLeftPage: some View {
        VStack(alignment: .leading, spacing: 38) {
            masthead
            recentsOrSuggestions
            browse
        }
    }

    private var masthead: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("the index")
            if allowsWide {
                SearchWidthSwitch(minWidth: Self.wideContent) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .bottom, spacing: 24) {
                            mastheadTitle
                            Spacer(minLength: 0)
                            MarkerText("half a word is enough", size: 22, angle: -1.6)
                                .padding(.bottom, 4)
                        }
                        .padding(.top, 14)
                        mastheadLede
                    }
                } narrow: {
                    mastheadNarrow
                }
            } else {
                mastheadNarrow
            }
            catalogStatus
                .padding(.top, 18)
        }
    }

    private var mastheadTitle: some View {
        Text("Look anything up.")
            .lfTitle(.h1)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var mastheadLede: some View {
        Text(lede)
            .lfProse(17, color: LF.Palette.graphite)
            .frame(maxWidth: 580, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 12)
    }

    private var mastheadNarrow: some View {
        VStack(alignment: .leading, spacing: 0) {
            mastheadTitle
                .padding(.top, 14)
            mastheadLede
            MarkerText("half a word is enough", size: 21)
                .padding(.top, 10)
        }
    }

    private var lede: String {
        let lessons = indexStore.index?.lessonCount ?? catalog.allLessons.count
        let articles = indexStore.index?.articleCount ?? catalog.articles.count
        let terms = indexStore.index?.glossaryCount ?? reference.glossary.count
        guard lessons > 0 else {
            return "Lessons, articles and glossary terms, searched right on this device so it works offline too."
        }
        return "\(lessons.formatted()) lessons, \(articles.formatted()) articles and \(terms.formatted()) glossary terms, searched right on this device so it works offline too."
    }

    /// Says so plainly when there's nothing to search yet, or only part of it.
    @ViewBuilder
    private var catalogStatus: some View {
        if !catalog.isLoaded {
            if connectivity.isOnline {
                VStack(alignment: .leading, spacing: 10) {
                    SlugText("reading the index\u{2026}")
                    SkeletonBlock(height: 14, width: 240)
                    SkeletonBlock(height: 14, width: 180)
                }
            } else {
                NoteCallout {
                    SlugText("offline")
                    Text("Nothing has downloaded yet. Connect once and every lesson, article and glossary term stays searchable here, with or without a connection.")
                        .font(LF.Fonts.body(16))
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: 580, alignment: .leading)
            }
        } else if !catalog.lessonBodiesLoaded {
            FieldHint("Lesson text is still downloading. Until it's done, search reads lesson titles and summaries.")
        }
    }

    @ViewBuilder
    private var recentsOrSuggestions: some View {
        if !recents.isEmpty {
            recentSearches
        } else if let suggestions = indexStore.index?.suggestions, !suggestions.isEmpty {
            suggestionTags(suggestions)
        }
    }

    private var recentSearches: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                SectionLabel("recent searches")
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 12)
                Button("Clear") {
                    recentsStorage = SearchRecents.encode([])
                }
                .buttonStyle(.inkGhostSmall)
                .accessibilityLabel("Clear recent searches")
            }
            .padding(.bottom, 10)
            SearchList(items: recents.map(SearchRecentItem.init)) { item in
                HStack(spacing: 0) {
                    Button {
                        use(item.text)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "clock.arrow.circlepath")
                                .foregroundStyle(LF.Palette.graphite)
                                .accessibilityHidden(true)
                            Text(item.text)
                                .font(LF.Fonts.body(17, relativeTo: .body))
                                .foregroundStyle(LF.Palette.ink)
                                .lineLimit(1)
                            Spacer(minLength: 8)
                        }
                        .padding(.horizontal, 12)
                        .frame(minHeight: 48)
                    }
                    .buttonStyle(.searchRow)
                    .accessibilityLabel("Search again for \(item.text)")

                    Button {
                        recentsStorage = SearchRecents.encode(SearchRecents.removing(item.text, from: recents))
                    } label: {
                        Image(systemName: "xmark")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(LF.Palette.graphite)
                            .frame(width: LF.Metrics.tap, height: LF.Metrics.tap)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(item.text) from recent searches")
                }
            }
            FieldHint("Kept on this device only.")
                .padding(.top, 10)
        }
    }

    private func suggestionTags(_ suggestions: [String]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("try one of these")
                .accessibilityAddTraits(.isHeader)
            SearchFlowLayout(spacing: 10, lineSpacing: 4) {
                ForEach(suggestions, id: \.self) { suggestion in
                    Button {
                        use(suggestion)
                    } label: {
                        TagView(suggestion, systemImage: "magnifyingglass")
                            .frame(minHeight: LF.Metrics.tap)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Search for \(suggestion)")
                }
            }
        }
    }

    /// One glossary card a day, the same for everyone on a given date.
    private var termOfTheDay: GlossaryTerm? {
        let pool = reference.glossary.filter { $0.inMatch != nil }.sorted { $0.slug < $1.slug }
        let candidates = pool.isEmpty ? reference.glossary.sorted { $0.slug < $1.slug } : pool
        guard !candidates.isEmpty else { return nil }
        let day = Calendar.current.ordinality(of: .day, in: .era, for: .now) ?? 0
        return candidates[day % candidates.count]
    }

    @ViewBuilder
    private var cardOfTheDay: some View {
        if let term = termOfTheDay {
            VStack(alignment: .leading, spacing: 16) {
                SectionLabel("pulled from the drawer today")
                    .accessibilityAddTraits(.isHeader)
                NavigationLink(value: AppRoute.glossaryTerm(term.slug)) {
                    NotebookCard(tilt: .preset(1), tape: true, lift: true, padding: 20) {
                        HStack(alignment: .firstTextBaseline) {
                            SlugText("drawer / \(term.category.lowercased())")
                            Spacer(minLength: 8)
                            if let abbr = term.abbr, abbr != term.term {
                                TagView(abbr)
                            }
                        }
                        Text(term.term)
                            .lfTitle(.h2)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 12)
                        Text(term.definition)
                            .lfProse(16)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 10)
                        if let inMatch = term.inMatch {
                            DashedRule()
                                .padding(.top, 16)
                            SlugText("where you'll meet it")
                                .padding(.top, 12)
                            Text(inMatch)
                                .font(LF.Fonts.body(15, relativeTo: .subheadline))
                                .lineHeight(.multiple(factor: 1.45))
                                .foregroundStyle(LF.Palette.graphite)
                                .lineLimit(5)
                                .padding(.top, 6)
                        }
                        SlugText("read the entry", color: LF.Palette.ink)
                            .padding(.top, 16)
                            .accessibilityHidden(true)
                    }
                }
                .buttonStyle(.notebookCard)
                .accessibilityLabel("Glossary card of the day: \(term.term). \(term.definition)")
            }
        }
    }

    private var browse: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionLabel("or browse")
                .accessibilityAddTraits(.isHeader)
            SearchAdaptiveGrid(items: browseItems, breakpoints: Self.browseColumns, spacing: 18) { index, item in
                NavigationLink(value: item.route) {
                    NotebookCard(tilt: .preset(index + 2), lift: true) {
                        HStack(alignment: .top, spacing: 14) {
                            VStack(alignment: .leading, spacing: 0) {
                                SlugText(item.slug)
                                Text(item.title)
                                    .lfTitle(.h3)
                                    .padding(.top, 8)
                                Text(item.blurb)
                                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                                    .foregroundStyle(LF.Palette.graphite)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .padding(.top, 6)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            Image(systemName: item.systemImage)
                                .font(.title2)
                                .foregroundStyle(LF.Palette.ink)
                                .accessibilityHidden(true)
                        }
                        .frame(maxHeight: .infinity, alignment: .top)
                    }
                }
                .buttonStyle(.notebookCard)
                .accessibilityLabel("\(item.title). \(item.blurb)")
            }
            if !reference.paths.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    SlugText("or follow a path, one department at a time")
                        .padding(.top, 18)
                    SearchList(items: reference.paths) { path in
                        NavigationLink(value: AppRoute.path(path.slug)) {
                            SearchResultRow(
                                slug: "path / \(path.steps.count) departments",
                                title: AttributedString(path.title),
                                snippet: AttributedString(path.description),
                                snippetLines: 2,
                                systemImage: path.systemImage
                            )
                        }
                        .buttonStyle(.searchRow)
                    }
                }
            }
        }
    }

    private var browseItems: [SearchBrowseItem] {
        let terms = reference.glossary.count
        let drawers = Set(reference.glossary.map(\.category)).count
        let videos = catalog.videoLessons.count
        var items: [SearchBrowseItem] = []
        if terms > 0 {
            items.append(SearchBrowseItem(
                route: .glossaryIndex, slug: "glossary / \(terms) terms", title: "The glossary",
                blurb: "Every acronym you'll hear in the pit, filed in \(drawers) drawers.", systemImage: "text.book.closed"
            ))
        }
        if videos > 0 {
            items.append(SearchBrowseItem(
                route: .videos, slug: "videos / \(videos) lessons", title: "Video library",
                blurb: "Every lesson video, department by department, in course order.", systemImage: "play.rectangle.on.rectangle"
            ))
        }
        return items
    }

    // MARK: - Results page

    /// - Parameter previewing: the left page of a spread, where a result shows on the right
    ///   page instead of opening, and every result is a row.
    private func resultsPage(previewing: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            resultsHeader
            if indexStore.index == nil {
                notReady
                    .padding(.top, 28)
            } else if results.isEmpty, model.isCurrent {
                noMatch
                    .padding(.top, 28)
            } else if previewing {
                previewList
                    .padding(.top, 28)
            } else if model.scope == .all {
                allResults
                    .padding(.top, 28)
            } else {
                scopedResults(model.scope)
                    .padding(.top, 28)
            }
        }
    }

    // MARK: The spread's list

    /// Every result as a row, in sections like the single page. A row shows its result on the
    /// right page; the one showing is marked.
    @ViewBuilder
    private var previewList: some View {
        let shown = previewHit?.id
        if model.scope == .all {
            let hits = otherHits
            VStack(alignment: .leading, spacing: 36) {
                if let top = results.topHit {
                    SearchList(items: [top]) { hit in previewRow(hit, shown: shown, top: true) }
                }
                previewSection(.glossary, hits: hits.glossary, limit: 3, shown: shown)
                previewSection(.guides, hits: hits.guides, limit: 6, shown: shown)
                previewSection(.articles, hits: hits.articles, limit: 4, shown: shown)
            }
        } else {
            let hits = results.hits(in: model.scope)
            if hits.isEmpty {
                scopedResults(model.scope)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    SearchList(items: hits) { hit in previewRow(hit, shown: shown, top: false) }
                    if results.count(model.scope) > hits.count {
                        FieldHint("Showing the best \(hits.count) of \(results.count(model.scope)). Add a word to narrow it down.")
                            .padding(.top, 14)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func previewSection(_ scope: SearchScope, hits: [SearchHit], limit: Int, shown: String?) -> some View {
        if !hits.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                SearchSectionHeader(title: scope.title, count: results.count(scope))
                SearchList(items: Array(hits.prefix(limit))) { hit in previewRow(hit, shown: shown, top: false) }
                let topHere = results.topHit.map { $0.document.kind.scope == scope } ?? false
                showAll(scope, shown: min(limit, hits.count) + (topHere ? 1 : 0))
            }
        }
    }

    private func previewRow(_ hit: SearchHit, shown: String?, top: Bool) -> some View {
        let document = hit.document
        let completed = isCompleted(hit)
        let isShown = hit.id == shown
        return Button {
            previewID = hit.id
            Haptics.select()
        } label: {
            SearchResultRow(
                slug: top ? "top hit / \(document.slug)" : document.slug,
                title: hit.title.attributed,
                crumb: document.crumb,
                alias: hit.matchedAlias?.attributed,
                snippet: (hit.snippet ?? (document.kind == .glossary ? SearchHighlight(text: document.detail, ranges: []) : nil))?.attributed,
                snippetLines: 2,
                minutes: document.kind == .lesson ? document.minutes : nil,
                hasVideo: document.hasVideo,
                isCompleted: completed,
                systemImage: document.kind == .department ? document.systemImage : nil,
                showsChevron: false
            )
            .background(isShown ? LF.Palette.rowWash : Color.clear)
            .overlay(alignment: .leading) {
                if isShown {
                    Rectangle().fill(LF.Palette.blue).frame(width: 3)
                }
            }
        }
        .buttonStyle(.searchRow)
        .accessibilityLabel(SearchAccessibility.label(for: hit, isCompleted: completed, prefix: top ? "Top hit" : nil))
        .accessibilityHint("Shows it on the right page")
        .accessibilityAddTraits(isShown ? .isSelected : [])
    }

    private var resultsHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            InkTabStrip(selection: $model.scope, tabs: SearchScope.allCases.map { scope in
                (value: scope, title: model.isCurrent || results.total > 0 ? "\(scope.title) \(results.count(scope))" : scope.title)
            })
            // One run of text, so at the largest sizes it wraps between words ("results"
            // stays whole) and the query is never cut short.
            Text("\(resultCount) \(resultWords) \(resultQuery)")
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.updatesFrequently)
            if let index = indexStore.index, !index.includesLessonBodies {
                FieldHint("Lesson text is still downloading, so lessons match on titles and summaries for now.")
            }
        }
    }

    private var resultCount: Text {
        Text(results.total.formatted())
            .font(LF.Fonts.mono(17, weight: .bold, relativeTo: .headline))
            .monospacedDigit()
            .foregroundStyle(LF.Palette.blue)
    }

    private var resultWords: Text {
        Text(results.total == 1 ? "result for" : "results for")
            .font(LF.Fonts.mono(12.5, relativeTo: .caption))
            .tracking(12.5 * 0.02)
            .foregroundStyle(LF.Palette.graphite)
    }

    private var resultQuery: Text {
        Text("\u{201C}\(model.trimmedQuery)\u{201D}")
            .font(LF.Fonts.body(15, weight: .semibold, relativeTo: .subheadline))
            .foregroundStyle(LF.Palette.ink)
    }

    @ViewBuilder
    private var notReady: some View {
        if !catalog.isLoaded, !connectivity.isOnline {
            NoteCallout {
                SlugText("offline")
                Text("There's nothing on this device to search yet. Connect once and search works from then on, offline too.")
                    .font(LF.Fonts.body(16))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 620, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 14) {
                SlugText("reading the index\u{2026}")
                ForEach(0..<4, id: \.self) { row in
                    VStack(alignment: .leading, spacing: 8) {
                        SkeletonBlock(height: 12, width: 140)
                        SkeletonBlock(height: 18, width: row.isMultiple(of: 2) ? 280 : 220)
                        SkeletonBlock(height: 13)
                    }
                    .padding(.vertical, 8)
                }
            }
            .frame(maxWidth: 720, alignment: .leading)
        }
    }

    private var noMatch: some View {
        VStack(alignment: .leading, spacing: 16) {
            NoteCallout {
                SlugText("no match")
                Text("Nothing in the binder is filed under \u{201C}\(model.trimmedQuery)\u{201D}.")
                    .font(LF.Fonts.body(17, weight: .medium))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Check the spelling, try fewer words, or try the full name instead of the acronym.")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 620, alignment: .leading)
            if !reference.glossary.isEmpty {
                NavigationLink(value: AppRoute.glossaryIndex) {
                    Text("Browse the glossary")
                }
                .buttonStyle(.inkGhost)
            }
        }
    }

    // MARK: All

    private var otherHits: (glossary: [SearchHit], guides: [SearchHit], articles: [SearchHit]) {
        let topID = results.topHit?.id
        return (
            results.glossary.filter { $0.id != topID },
            results.guides.filter { $0.id != topID },
            results.articles.filter { $0.id != topID }
        )
    }

    @ViewBuilder
    private var allResults: some View {
        let hits = otherHits
        if allowsWide {
            SearchWidthSwitch(minWidth: Self.wideContent) {
                HStack(alignment: .top, spacing: 40) {
                    VStack(alignment: .leading, spacing: 40) {
                        topHitCard
                        guidesSection(hits.guides, limit: 8)
                        articlesSection(hits.articles, limit: 5)
                    }
                    .frame(maxWidth: 820, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if !hits.glossary.isEmpty {
                        glossarySection(hits.glossary, limit: 4, columns: [])
                            .frame(width: 340)
                    }
                }
            } narrow: {
                allResultsColumn(hits)
            }
        } else {
            allResultsColumn(hits)
        }
    }

    private func allResultsColumn(_ hits: (glossary: [SearchHit], guides: [SearchHit], articles: [SearchHit])) -> some View {
        VStack(alignment: .leading, spacing: 40) {
            topHitCard
            glossarySection(hits.glossary, limit: 3, columns: Self.glossaryPair)
            guidesSection(hits.guides, limit: 6)
            articlesSection(hits.articles, limit: 4)
        }
    }

    @ViewBuilder
    private var topHitCard: some View {
        if let top = results.topHit {
            NavigationLink(value: top.document.route) {
                SearchTopHitCard(hit: top, isCompleted: isCompleted(top))
            }
            .buttonStyle(.notebookCard)
            .accessibilityLabel(SearchAccessibility.label(for: top, isCompleted: isCompleted(top), prefix: "Top hit"))
            .frame(maxWidth: 720, alignment: .leading)
        }
    }

    @ViewBuilder
    private func glossarySection(_ hits: [SearchHit], limit: Int, columns: [SearchColumnsLayout.Breakpoint]) -> some View {
        if !hits.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                SearchSectionHeader(title: "glossary", count: results.count(.glossary))
                SearchAdaptiveGrid(items: Array(hits.prefix(limit)), breakpoints: columns, spacing: 18) { index, hit in
                    glossaryCard(hit, index: index)
                }
                .padding(.top, 6)
                showAll(.glossary, shown: min(limit, hits.count) + (results.topHit?.document.kind == .glossary ? 1 : 0))
            }
        }
    }

    @ViewBuilder
    private func guidesSection(_ hits: [SearchHit], limit: Int) -> some View {
        if !hits.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                SearchSectionHeader(title: "guides", count: results.count(.guides))
                SearchList(items: Array(hits.prefix(limit))) { hit in row(hit) }
                showAll(.guides, shown: min(limit, hits.count) + (results.topHit?.document.kind.scope == .guides ? 1 : 0))
            }
        }
    }

    @ViewBuilder
    private func articlesSection(_ hits: [SearchHit], limit: Int) -> some View {
        if !hits.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                SearchSectionHeader(title: "articles", count: results.count(.articles))
                SearchList(items: Array(hits.prefix(limit))) { hit in row(hit) }
                showAll(.articles, shown: min(limit, hits.count) + (results.topHit?.document.kind == .article ? 1 : 0))
            }
        }
    }

    @ViewBuilder
    private func showAll(_ scope: SearchScope, shown: Int) -> some View {
        let total = results.count(scope)
        if total > shown {
            Button("Show all \(total) \(scope.title)") {
                model.scope = scope
            }
            .buttonStyle(.inkGhostSmall)
            .padding(.top, 14)
        }
    }

    // MARK: One scope

    @ViewBuilder
    private func scopedResults(_ scope: SearchScope) -> some View {
        let hits = results.hits(in: scope)
        if hits.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                NoteCallout {
                    SlugText("nothing in \(scope.title)")
                    Text("No \(scope.title) match \u{201C}\(model.trimmedQuery)\u{201D}, but \(results.total == 1 ? "1 result does" : "\(results.total) results do") elsewhere.")
                        .font(LF.Fonts.body(16))
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: 620, alignment: .leading)
                Button("Show all \(results.total)") { model.scope = .all }
                    .buttonStyle(.inkGhost)
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                if scope == .glossary {
                    SearchAdaptiveGrid(items: hits, spacing: 18) { index, hit in
                        glossaryCard(hit, index: index)
                    }
                } else {
                    SearchList(items: hits) { hit in row(hit) }
                        .frame(maxWidth: 860, alignment: .leading)
                }
                if results.count(scope) > hits.count {
                    FieldHint("Showing the best \(hits.count) of \(results.count(scope)). Add a word to narrow it down.")
                        .padding(.top, 14)
                }
            }
        }
    }

    // MARK: Cells

    private func isCompleted(_ hit: SearchHit) -> Bool {
        hit.document.lessonID.map(progress.isCompleted) ?? false
    }

    private func row(_ hit: SearchHit) -> some View {
        let document = hit.document
        let completed = isCompleted(hit)
        return NavigationLink(value: document.route) {
            SearchResultRow(
                slug: document.slug,
                title: hit.title.attributed,
                crumb: document.crumb,
                alias: hit.matchedAlias?.attributed,
                snippet: hit.snippet?.attributed,
                minutes: document.kind == .lesson ? document.minutes : nil,
                hasVideo: document.hasVideo,
                isCompleted: completed,
                systemImage: document.kind == .department ? document.systemImage : nil
            )
        }
        .buttonStyle(.searchRow)
        .accessibilityLabel(SearchAccessibility.label(for: hit, isCompleted: completed))
    }

    private func glossaryCard(_ hit: SearchHit, index: Int) -> some View {
        let document = hit.document
        let definition = hit.snippet ?? SearchHighlight(text: document.detail, ranges: [])
        return NavigationLink(value: document.route) {
            GlossaryIndexCard(
                slug: document.slug,
                title: hit.title.attributed,
                definition: definition.attributed,
                badge: document.badge,
                alias: hit.matchedAlias?.attributed,
                tilt: .preset(index),
                definitionLines: 4
            )
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel(SearchAccessibility.label(for: hit, isCompleted: false))
    }
}

// MARK: - Small models

private struct SearchRecentItem: Identifiable {
    let text: String
    var id: String { text }
}

private struct SearchBrowseItem: Identifiable {
    let route: AppRoute
    let slug: String
    let title: String
    let blurb: String
    let systemImage: String
    var id: String { slug }
}

// MARK: - Previews

#Preview("Search, iPhone", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        SearchView()
    }
    .appEnvironment(.preview)
}

#Preview("Results, iPhone, Night", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        SearchView(query: "pid")
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}

#Preview("Results, iPad", traits: .fixedLayout(width: 1180, height: 820)) {
    NavigationStack {
        SearchView(query: "auto")
    }
    .appEnvironment(.preview)
}

#Preview("Search, iPad, Night", traits: .fixedLayout(width: 1024, height: 900)) {
    NavigationStack {
        SearchView()
    }
    .appEnvironment(.preview(signedIn: false))
    .environment(\.colorScheme, .dark)
}

#Preview("No match, iPhone", traits: .fixedLayout(width: 375, height: 700)) {
    NavigationStack {
        SearchView(query: "flux capacitor")
    }
    .appEnvironment(.preview)
}

#if DEBUG
#Preview("Results, Duo book", traits: .duoBook) {
    NavigationStack {
        SearchView(query: "pid")
    }
    .appEnvironment(.preview)
    .previewFold(.previewBook)
}

#Preview("Search, Duo cover", traits: .duoCover) {
    NavigationStack {
        SearchView()
    }
    .appEnvironment(.preview)
    .previewFold(.previewClosed)
}
#endif
