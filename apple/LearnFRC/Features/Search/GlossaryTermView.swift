import SwiftUI

/// One glossary entry (learnfrc.com/glossary/{slug}): the index card itself, where you
/// actually meet the term, the lessons that use it, and the cards filed next to it.
///
/// The shell routes `AppRoute.glossaryTerm(slug)` here. An empty slug is the catalogue
/// (`AppRoute.glossaryIndex`), shown as `GlossaryView`.
struct GlossaryTermView: View {
    let slug: String

    init(slug: String) {
        self.slug = slug
    }

    var body: some View {
        if slug.isEmpty {
            GlossaryView()
        } else {
            GlossaryEntryPage(slug: slug)
        }
    }
}

private struct GlossaryEntryPage: View {
    let slug: String

    @Environment(AppModel.self) private var app
    @Environment(CatalogStore.self) private var catalog
    @Environment(ReferenceStore.self) private var reference
    @Environment(ProgressStore.self) private var progress
    @Environment(Connectivity.self) private var connectivity
    /// This window's navigation (each iPad or Mac window keeps its own place).
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    /// As the environment brings it; nil on the Mac for a pushed screen (`NavigationTabFallback`).
    @Environment(\.navigationTab) private var tab
    @State private var tabFallback = NavigationTabFallback()
    @Environment(\.openURL) private var openURL
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var term: GlossaryTerm? { reference.term(slug: slug) }

    /// Content width (inside the gutters) for side-by-side headings: a 760pt page. Decided
    /// during layout (`SearchWidthSwitch`), never from a width stored in state.
    private static let wideContent: CGFloat = 699
    /// Two neighbouring cards side by side from a 620pt page.
    private static let relatedColumns = [SearchColumnsLayout.Breakpoint(minWidth: 570, columns: 2)]

    /// `wide` when there's room and the text isn't at an accessibility size, else `narrow`.
    @ViewBuilder
    private func adaptive<Wide: View, Narrow: View>(@ViewBuilder wide: () -> Wide, @ViewBuilder narrow: () -> Narrow) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            narrow()
        } else {
            SearchWidthSwitch(minWidth: Self.wideContent, wide: wide, narrow: narrow)
        }
    }

    var body: some View {
        ScrollView {
            Group {
                if let term {
                    entry(term)
                } else if !reference.isLoaded {
                    loading
                } else {
                    missing
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 56)
            // The same page as every other screen (gutters from the leading edge); each block
            // below keeps its own reading width.
            .searchPage()
        }
        // The Mac rebuilds the tab on every switch; the entry comes back where it was left.
        .remembersScroll(.route(.glossaryTerm(slug)))
        .paperBackground()
        .navigationTitle(term?.term ?? "Glossary")
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            if let term {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: term.webURL, subject: Text(term.term), message: Text(term.definition)) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
        // Handoff: carry on reading this entry on learnfrc.com on another device. Only while
        // it's the screen on show: iPhone and iPad keep hidden tabs and covered screens alive.
        .screenHandoff(.route(.glossaryTerm(slug)), url: term?.webURL, title: term?.term, when: term != nil)
        .closesShareSheetsOnNavigation()
        // The kept scroll position and the Handoff check need the tab, even on the Mac.
        .environment(\.navigationTab, tabFallback.tab(tab, navigation: navigation))
    }

    /// Back to the guides in this page's own window.
    private func browseGuides() {
        (navigation ?? app.activeNavigation).selectedTab = .learn
    }

    // MARK: The entry

    private func entry(_ term: GlossaryTerm) -> some View {
        let shortName = GlossaryRules.shortName(term)
        let lessons = GlossaryRules.lessons(teaching: term, in: catalog.allLessons)
        let related = GlossaryRules.relatedTerms(for: term, in: reference.glossary)
        return VStack(alignment: .leading, spacing: 0) {
            SlugText("glossary / \(term.slug)")
                .accessibilityLabel("Glossary")
            card(term)
                .frame(maxWidth: 760, alignment: .leading)
                .padding(.top, 22)
            if let inMatch = term.inMatch, !inMatch.isEmpty {
                NoteCallout {
                    SlugText("where you actually meet \(shortName)")
                        .accessibilityAddTraits(.isHeader)
                    Text(inMatch)
                        .lfProse(16.5, lineHeight: 1.6)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                        .padding(.top, 4)
                }
                // About 80 characters a line, like the lesson and article text.
                .frame(maxWidth: LF.Metrics.readableWidth, alignment: .leading)
                .padding(.top, 40)
            }
            if !lessons.isEmpty {
                lessonsSection(lessons, shortName: shortName)
                    .padding(.top, 48)
            }
            if !related.isEmpty {
                relatedSection(related)
                    .padding(.top, 48)
            }
            footer(term)
                .padding(.top, 48)
        }
    }

    /// The card is the content: drawer, short form, term, definition, other names, and the
    /// two places to go for more. Taped down at the top and the bottom, like the site.
    private func card(_ term: GlossaryTerm) -> some View {
        NotebookCard(tilt: .degrees(SiteTokens.Tilt.presets[2]), tape: true, padding: 24) {
            // Drawer and short form on one line while both fit whole; otherwise the short form
            // goes under the drawer, so the drawer's name never breaks mid-word.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    SlugText("drawer / \(term.category.lowercased())")
                        .fixedSize()
                    Spacer(minLength: 0)
                    shortForm(term)
                }
                VStack(alignment: .leading, spacing: 10) {
                    SlugText("drawer / \(term.category.lowercased())")
                        .fixedSize(horizontal: false, vertical: true)
                    shortForm(term)
                }
            }
            Text(term.term)
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Text(term.definition)
                .lfProse(18)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)
                .padding(.top, 14)
            if !term.alsoCalled.isEmpty {
                SearchFlowLayout(spacing: 8, lineSpacing: 8) {
                    SlugText("also called")
                    ForEach(term.alsoCalled, id: \.self) { name in
                        TagView(name)
                    }
                }
                .padding(.top, 18)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Also called \(term.alsoCalled.joined(separator: ", "))")
            }
            if term.internalLink != nil || term.linkURL != nil {
                DashedRule()
                    .padding(.top, 22)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 14) { actions(term) }
                    VStack(alignment: .leading, spacing: 14) { actions(term) }
                }
                .padding(.top, 18)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.4)
                .offset(x: -48, y: 12)
        }
    }

    @ViewBuilder
    private func shortForm(_ term: GlossaryTerm) -> some View {
        if let abbr = term.abbr, !abbr.isEmpty, abbr != term.term {
            TagView(abbr)
                .fixedSize()
                .accessibilityLabel("Short form \(abbr)")
        }
    }

    @ViewBuilder
    private func actions(_ term: GlossaryTerm) -> some View {
        if let internalPath = term.internalLink {
            if let route = catalog.route(forPath: internalPath) {
                NavigationLink(value: route) {
                    Text("Read the full guide")
                }
                .buttonStyle(.ink)
            } else {
                Button("Read the full guide") {
                    openURL(AppConfig.webBase.appending(path: internalPath))
                }
                .buttonStyle(.ink)
            }
        }
        if let url = term.linkURL {
            Link(destination: url) {
                HStack(spacing: 6) {
                    Text("Official source")
                    Image(systemName: "arrow.up.right")
                        .imageScale(.small)
                        .accessibilityHidden(true)
                }
            }
            .buttonStyle(.inkGhost)
            .accessibilityHint("Opens \(url.host() ?? "the source") in your browser")
        }
    }

    // MARK: Lessons

    private func lessonsSection(_ lessons: [LessonLocation], shortName: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            let heading = VStack(alignment: .leading, spacing: 8) {
                Text("Lessons that use \(shortName)")
                    .lfTitle(.h2)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Free and structured, and none of them need an account to read.")
                    .font(LF.Fonts.body(16, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            let figure = CountText(lessons.count, unit: lessons.count == 1 ? "lesson" : "lessons")
            adaptive {
                HStack(alignment: .lastTextBaseline, spacing: 24) {
                    heading
                    Spacer(minLength: 0)
                    figure
                }
            } narrow: {
                VStack(alignment: .leading, spacing: 12) {
                    heading
                    figure
                }
            }
            .padding(.top, 26)
            SearchList(items: lessons) { location in
                let done = progress.isCompleted(location.id)
                NavigationLink(value: AppRoute.lesson(location.id)) {
                    SearchResultRow(
                        slug: "lesson / \(location.department.slug)",
                        title: AttributedString(location.lesson.title),
                        crumb: location.breadcrumb,
                        snippet: location.lesson.summary.map { AttributedString($0) },
                        minutes: location.lesson.estimatedMinutes,
                        hasVideo: location.lesson.youtubeID != nil,
                        isCompleted: done
                    )
                }
                .buttonStyle(.searchRow)
                .accessibilityLabel(lessonLabel(location, done: done))
            }
            // Edge to edge under the rule and the count above it, like the site's `nb-list`;
            // each row keeps its own words to a reading measure (`SearchResultRow`).
            .padding(.top, 20)
        }
    }

    private func lessonLabel(_ location: LessonLocation, done: Bool) -> String {
        var parts = ["Lesson: \(location.lesson.title)", "\(location.department.name), \(location.module.title)", "\(location.lesson.estimatedMinutes) minutes"]
        if done { parts.append("completed") }
        if let summary = location.lesson.summary { parts.append(summary) }
        return parts.joined(separator: ". ")
    }

    // MARK: Filed next to it

    private func relatedSection(_ related: [GlossaryTerm]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            adaptive {
                HStack(alignment: .bottom, spacing: 24) {
                    Text("Filed next to it")
                        .lfTitle(.h2)
                    Spacer(minLength: 0)
                    MarkerText("the jargon travels in packs", size: 22, angle: 1.2)
                }
            } narrow: {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Filed next to it")
                        .lfTitle(.h2)
                    MarkerText("the jargon travels in packs", angle: 1.2)
                }
            }
            .padding(.top, 26)
            SearchAdaptiveGrid(items: related, breakpoints: Self.relatedColumns, spacing: 22) { index, neighbour in
                NavigationLink(value: AppRoute.glossaryTerm(neighbour.slug)) {
                    GlossaryIndexCard(
                        slug: neighbour.category.lowercased(),
                        title: AttributedString(neighbour.term),
                        definition: AttributedString(neighbour.definition),
                        badge: neighbour.abbr.flatMap { $0.isEmpty || $0 == neighbour.term ? nil : $0 },
                        tilt: .preset(index),
                        tape: true,
                        definitionLines: nil
                    )
                }
                .buttonStyle(.notebookCard)
                .accessibilityLabel("\(neighbour.displayTitle). \(neighbour.category). \(neighbour.definition)")
                .accessibilityHint("Opens the entry")
            }
            .padding(.top, 30)
        }
    }

    // MARK: Footer

    private func footer(_ term: GlossaryTerm) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            let note = Text("\(term.term) is one of \(reference.glossary.count.formatted()) entries in the catalogue. The guides are where these words get used in order, instead of one at a time.")
                .font(LF.Fonts.body(16, relativeTo: .callout))
                .foregroundStyle(LF.Palette.graphite)
                .frame(maxWidth: 520, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            let buttons = HStack(spacing: 12) {
                NavigationLink(value: AppRoute.glossaryIndex) {
                    Text("The catalogue")
                }
                .buttonStyle(.inkGhost)
                Button("Browse the guides", action: browseGuides)
                .buttonStyle(.inkGhost)
            }
            adaptive {
                HStack(alignment: .center, spacing: 28) {
                    note
                    Spacer(minLength: 0)
                    buttons
                }
            } narrow: {
                VStack(alignment: .leading, spacing: 18) {
                    note
                    ViewThatFits(in: .horizontal) {
                        buttons
                        VStack(alignment: .leading, spacing: 12) {
                            NavigationLink(value: AppRoute.glossaryIndex) {
                                Text("The catalogue")
                            }
                            .buttonStyle(.inkGhost)
                            Button("Browse the guides", action: browseGuides)
                            .buttonStyle(.inkGhost)
                        }
                    }
                }
            }
            .padding(.top, 22)
        }
    }

    // MARK: States

    private var loading: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(height: 12, width: 160)
            VStack(alignment: .leading, spacing: 12) {
                SkeletonBlock(height: 12, width: 120)
                SkeletonBlock(height: 34, width: 260)
                SkeletonBlock(height: 15)
                SkeletonBlock(height: 15, width: 240)
            }
            .padding(24)
            .notebookBox(shadow: .none)
            .frame(maxWidth: 760)
            if !connectivity.isOnline {
                FieldHint("The glossary hasn't downloaded yet. It needs a connection once.")
            }
        }
    }

    private var missing: some View {
        VStack(alignment: .leading, spacing: 18) {
            SlugText("glossary / \(slug)")
            NoteCallout {
                SlugText("no entry")
                Text("There's no glossary entry at \u{201C}\(slug)\u{201D}.")
                    .font(LF.Fonts.body(17, weight: .medium))
                    .foregroundStyle(LF.Palette.ink)
                Text("It may have been renamed on the site. The catalogue has every current term.")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 560, alignment: .leading)
            NavigationLink(value: AppRoute.glossaryIndex) {
                Text("Open the catalogue")
            }
            .buttonStyle(.inkGhost)
        }
    }
}

// MARK: - Previews

#Preview("Entry, iPhone", traits: .fixedLayout(width: 393, height: 1500)) {
    NavigationStack {
        GlossaryTermView(slug: "pid-controller")
    }
    .appEnvironment(.preview)
}

#Preview("Entry, iPhone, Night", traits: .fixedLayout(width: 393, height: 1500)) {
    NavigationStack {
        GlossaryTermView(slug: "command-based-programming")
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}

#Preview("Entry, iPad", traits: .fixedLayout(width: 1180, height: 1300)) {
    NavigationStack {
        GlossaryTermView(slug: "swerve-drive")
    }
    .appEnvironment(.preview)
}

#Preview("Entry, iPad, Night", traits: .fixedLayout(width: 834, height: 1300)) {
    NavigationStack {
        GlossaryTermView(slug: "roborio")
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}

#Preview("Missing entry", traits: .fixedLayout(width: 393, height: 600)) {
    NavigationStack {
        GlossaryTermView(slug: "flux-capacitor")
    }
    .appEnvironment(.preview)
}
