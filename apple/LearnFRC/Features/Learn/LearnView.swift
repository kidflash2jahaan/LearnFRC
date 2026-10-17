import SwiftUI

/// The Learn tab: the contents page of the binder (learnfrc.com/guides), plus the
/// routes, the video library, the articles, the calculators and the resources shelf.
///
/// Read top to bottom it answers one question, which department to open: a short
/// masthead, the totals on the one blue band, the wall of eleven department cards
/// with each person's progress, the five routes for anyone who'd rather be told an
/// order, then the videos and articles, the tools and resources (the site's "Tools" and
/// "Resources" in its navigation), and the note for someone who still isn't sure.
struct LearnView: View {
    @Environment(AppModel.self) private var model
    @Environment(CatalogStore.self) private var catalog
    @Environment(ReferenceStore.self) private var reference
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(ResourcesStore.self) private var injectedResources: ResourcesStore?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var resources: ResourcesStore { injectedResources ?? .shared }

    private var departments: [Department] { catalog.departments }
    private var totalModules: Int { departments.reduce(0) { $0 + $1.modules.count } }
    private var totalLessons: Int { departments.reduce(0) { $0 + $1.lessonCount } }
    private var gettingStarted: Department? { catalog.department(slug: "getting-started") }

    var body: some View {
        LearnScrollPage(title: "Guides", refresh: { await model.refreshAll() }, place: .root) { layout, proxy in
            if departments.isEmpty {
                masthead(layout.column, proxy)
                    .learnColumn(layout)
                    .padding(.top, 20)
                emptyState(layout.column)
                    .learnColumn(layout)
                    .padding(.top, 32)
            } else if let pages = layout.pages {
                twoPages(layout, pages: pages, proxy: proxy)
            } else {
                masthead(layout, proxy)
                    .learnColumn(layout)
                    .padding(.top, 20)
                tally(layout)
                    .learnBand()
                    .padding(.top, 36)
                wall(layout)
                    .learnColumn(layout)
                    .padding(.top, 44)
                if !reference.paths.isEmpty {
                    routes(layout)
                        .learnColumn(layout)
                        .padding(.top, 56)
                        .id(LearnAnchor.routes)
                }
                moreWaysIn(layout)
                    .learnColumn(layout)
                    .padding(.top, 56)
                if let gettingStarted {
                    closingNote(gettingStarted, layout)
                        .learnColumn(layout)
                        .padding(.top, 56)
                }
            }
        }
        // The resources card prints the shelf's link count; the cached copy is enough (no network).
        .task { await resources.loadCache() }
        #if os(macOS)
        .toolbar {
            ToolbarItem {
                Button {
                    Task { await model.refreshAll() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                // No shortcut here: View > Refresh owns Command-R.
                .disabled(model.isRefreshingAll)
                .help("Check learnfrc.com for new lessons and articles")
            }
        }
        #endif
    }

    // MARK: Two pages

    /// iPhone Duo's inner screen held upright: the hero and the routes on the leading page,
    /// the department wall as one column on the trailing page, so the whole screen is used and
    /// nothing sits on the crease. The blue band still runs edge to edge, its words on one page
    /// and its figures on the other.
    @ViewBuilder
    private func twoPages(_ layout: LearnLayout, pages: FoldColumns, proxy: ScrollViewProxy) -> some View {
        let leading = LearnLayout.page(pages.leading)
        let trailing = LearnLayout.page(pages.trailing)
        LearnSpread(pages: pages) {
            VStack(alignment: .leading, spacing: 0) {
                masthead(leading, proxy)
                if !reference.paths.isEmpty {
                    routes(leading)
                        .padding(.top, 56)
                        .id(LearnAnchor.routes)
                }
            }
        } trailing: {
            wall(trailing)
        }
        .learnColumn(layout, spread: true)
        .padding(.top, 20)

        tally(layout)
            .learnBand()
            .padding(.top, 56)

        moreWaysIn(layout)
            .learnColumn(layout, spread: true)
            .padding(.top, 56)

        if let gettingStarted {
            closingNote(gettingStarted, layout.column)
                .learnColumn(layout)
                .padding(.top, 56)
        }
    }

    // MARK: Masthead

    @ViewBuilder
    private func masthead(_ layout: LearnLayout, _ proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("the catalogue")
            Text("Pick the department you actually work on.")
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
            LearnLede(departments.isEmpty
                ? "An FRC team is a lot of jobs happening at once, and each one gets its own tab in here: the modules to work through, the lessons inside them, and the parts that cost rookie teams a match."
                : "An FRC team is \(departments.count) jobs happening at once, and each one gets its own tab in here: the modules to work through, the lessons inside them, and the parts that cost rookie teams a match.")
                .padding(.top, 16)

            let buttons = Group {
                if let gettingStarted {
                    NavigationLink(value: AppRoute.department(gettingStarted.id)) {
                        Text("Start with the basics")
                    }
                    .buttonStyle(.ink)
                }
                if !reference.paths.isEmpty {
                    Button("Pick a route") {
                        LF.Motion.perform(LF.Motion.settle) {
                            proxy.scrollTo(LearnAnchor.routes, anchor: .top)
                        }
                    }
                    .buttonStyle(.inkGhost)
                }
            }
            // Side by side when both fit; stacked at large text sizes rather than wrapped.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { buttons }
                VStack(alignment: .leading, spacing: 12) { buttons }
            }
            .padding(.top, 22)

            if account.isSignedIn, progress.completedTotal == 0, !departments.isEmpty {
                LearnNotice(
                    kicker: "your account",
                    message: "You're signed in, but nothing is ticked off yet. Pick a route and these \(totalLessons.formatted()) lessons narrow down to one reading order for the job you want."
                )
                .padding(.top, 22)
            }
        }
    }

    // MARK: The tally

    /// The one inverted surface on the page, and the only place the totals are printed.
    private func tally(_ layout: LearnLayout) -> some View {
        SlabView {
            let heading = VStack(alignment: .leading, spacing: 10) {
                Text("Free to read, all of it.")
                    .font(LF.Fonts.display(28, relativeTo: .title))
                    .tracking(-0.7)
                    .fixedSize(horizontal: false, vertical: true)
                Text(tallyLine)
                    .font(LF.Fonts.body(15.5))
                    .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 330, alignment: .leading)
            }
            let figures = HStack(alignment: .bottom, spacing: layout.isRegular ? 36 : 22) {
                LearnSlabFigure(value: departments.count.formatted(), label: "departments")
                LearnSlabFigure(value: totalModules.formatted(), label: "modules")
                LearnSlabFigure(value: totalLessons.formatted(), label: "lessons")
            }
            let stackedFigures = VStack(alignment: .leading, spacing: 18) {
                LearnSlabFigure(value: departments.count.formatted(), label: "departments")
                LearnSlabFigure(value: totalModules.formatted(), label: "modules")
                LearnSlabFigure(value: totalLessons.formatted(), label: "lessons")
            }
            Group {
                if let pages = layout.pages {
                    // The words on the leading page, the figures on the trailing one. The slab
                    // pads its trailing edge by the card padding, which the trailing page gives up.
                    let inset = max(0, LF.Metrics.cardPadding - layout.margins.trailing)
                    LearnSpread(pages: FoldColumns(leading: pages.leading, gap: pages.gap,
                                                   trailing: max(0, pages.trailing - inset)),
                                alignment: .bottom) {
                        heading
                    } trailing: {
                        ViewThatFits(in: .horizontal) {
                            figures
                            stackedFigures
                        }
                    }
                } else if layout.isWide {
                    HStack(alignment: .bottom, spacing: 40) {
                        heading.frame(maxWidth: .infinity, alignment: .leading)
                        figures
                    }
                } else {
                    VStack(alignment: .leading, spacing: 26) {
                        heading
                        ViewThatFits(in: .horizontal) {
                            figures
                            stackedFigures
                        }
                    }
                }
            }
            // The slab already pads by the card padding; top that up to the page margins
            // so the band's text lines up with every other section.
            .frame(maxWidth: LF.Metrics.maxContentWidth, alignment: .leading)
            .padding(layout.bandInsets)
            .frame(maxWidth: .infinity, alignment: layout.pages == nil ? .center : .leading)
            .padding(.vertical, layout.isRegular ? 26 : 18)
        }
    }

    private var tallyLine: String {
        if account.isSignedIn {
            let done = progress.completedTotal
            return done == 0
                ? "Nothing ticked off yet. Every lesson ends with a short quiz, and passing it ticks the lesson off."
                : "\(done.formatted()) of \(totalLessons.formatted()) lessons ticked off so far."
        }
        // Guests already get ticks, the department meters and a week strip on this device,
        // so the pitch is only what an account adds on top (the site's perks list).
        return "No account needed to read a lesson or pass its quiz, and this device keeps your ticks. A free account carries them to every device and adds XP, a leaderboard rank and the department certificate."
    }

    // MARK: The wall

    private func wall(_ layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            let header = LearnSectionHeader(
                title: "All \(departments.count) departments",
                sub: "Every card is a whole curriculum: modules in order, lessons inside them, and a quiz at the end of each one. Read them in any order you like."
            )
            if layout.isRegular {
                HStack(alignment: .bottom, spacing: 32) {
                    header.frame(maxWidth: .infinity, alignment: .leading)
                    MarkerText("start top left if this is your first season", angle: 1.5)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 220, alignment: .trailing)
                }
            } else {
                header
                MarkerText("start top left if this is your first season")
                    .padding(.top, 12)
            }

            LearnDepartmentWall(departments: departments, layout: layout)
                .padding(.top, 34)
        }
    }

    // MARK: Routes

    private func routes(_ layout: LearnLayout) -> some View {
        let paths = reference.paths
        let stops = paths.reduce(0) { $0 + $1.steps.count }
        return VStack(alignment: .leading, spacing: 0) {
            InkRule()
            HStack(alignment: .bottom, spacing: 32) {
                LearnSectionHeader(
                    kicker: "\(paths.count) routes / \(stops) stops",
                    title: "Every route is a reading order for one job.",
                    sub: "The catalogue is filed by department, because that's how a team is organised. A route cuts across it: five or six stops, in the order that stops them being confusing."
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                if layout.isRegular {
                    MarkerText("pick by the stops, not by the title", angle: 1.4)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 200, alignment: .trailing)
                }
            }
            .padding(.top, 28)

            // The itinerary panel needs about 260pt beside the pitch.
            let showsStops = layout.isRegular && (!layout.isWide || (layout.contentWidth - 24) / 2 >= 520)
            LearnWallLayout(columns: layout.isWide ? .two : .one, spacing: 24, rowSpacing: 26, stretchesLast: true) {
                ForEach(Array(paths.enumerated()), id: \.element.id) { index, path in
                    LearnRouteSlip(path: path, index: index, showsStops: showsStops)
                        .learnArrival(reduceMotion, angle: -0.6)
                }
            }
            .padding(.top, 30)
        }
    }

    // MARK: Videos and articles

    private func moreWaysIn(_ layout: LearnLayout) -> some View {
        let videos = catalog.videoLessons.count
        let articles = catalog.articles.count
        let minutes = catalog.articles.reduce(0) { $0 + $1.readMins }
        let tools = ToolCatalog.all.count
        let links = resources.page?.totalLinks ?? 0
        return VStack(alignment: .leading, spacing: 0) {
            if let pages = layout.pages {
                LearnSpreadRule(pages: pages)
            } else {
                InkRule()
            }
            LearnSectionHeader(kicker: "more ways in", title: "Watch it, or read around it.")
                .frame(maxWidth: layout.pages?.leading ?? .infinity, alignment: .leading)
                .padding(.top, 28)

            let cards = Group {
                if videos > 0 {
                    NavigationLink(value: AppRoute.videos) {
                        shelfCard(kicker: "the videos",
                                  title: "Every lesson video, in course order.",
                                  body: "\(LearnFormat.plural(videos, "narrated video", "narrated videos")), grouped by department. Each one is the video version of a lesson, so you can play them in order to teach a group.",
                                  count: videos, unit: videos == 1 ? "video" : "videos", index: 1)
                    }
                    .buttonStyle(.notebookCard)
                }
                if articles > 0 {
                    NavigationLink(value: AppRoute.articlesIndex) {
                        shelfCard(kicker: "the loose pages",
                                  title: "Every question a team ends up googling.",
                                  body: "Write-ups of the things that break, the things nobody explains, and the parts of a season you only learn by losing a match. \(minutes.formatted()) minutes of reading in all.",
                                  count: articles, unit: articles == 1 ? "article" : "articles", index: 3)
                    }
                    .buttonStyle(.notebookCard)
                }
            }
            // The site's "Tools" and "Resources", each opened on its own page's masthead.
            let reference = Group {
                NavigationLink(value: AppRoute.tools) {
                    shelfCard(kicker: "tools",
                              title: "The numbers, worked out.",
                              body: "\(LearnFormat.spelledCount(tools)) calculators for the questions that stop a build night. Every default comes from an official FIRST page or a vendor spec sheet, and the source is printed next to the number.",
                              count: tools, unit: tools == 1 ? "calculator" : "calculators", index: 2)
                }
                .buttonStyle(.notebookCard)
                .accessibilityHint("Opens Tools")
                NavigationLink(value: AppRoute.resources) {
                    shelfCard(kicker: "resources",
                              title: "Everything a build season makes you look up.",
                              body: "The official docs, the software your code depends on, the vendors you order from, and the two forums where the answers actually are.",
                              count: links > 0 ? links : nil, unit: links == 1 ? "link" : "links", index: 0)
                }
                .buttonStyle(.notebookCard)
                .accessibilityHint("Opens Resources")
            }
            Group {
                if let pages = layout.pages {
                    // What to watch and read on the leading page, the reference shelves on the
                    // trailing one.
                    LearnSpread(pages: pages) {
                        VStack(alignment: .leading, spacing: 24) { cards }
                    } trailing: {
                        VStack(alignment: .leading, spacing: 24) { reference }
                    }
                } else if layout.isRegular {
                    VStack(alignment: .leading, spacing: 24) {
                        HStack(alignment: .top, spacing: 24) { cards }
                            .fixedSize(horizontal: false, vertical: true)
                        HStack(alignment: .top, spacing: 24) { reference }
                            .fixedSize(horizontal: false, vertical: true)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 24) {
                        cards
                        reference
                    }
                }
            }
            .padding(.top, 28)
        }
    }

    private func shelfCard(kicker: String, title: String, body: String, count: Int?, unit: String, index: Int) -> some View {
        NotebookCard(tilt: .preset(index), lift: true) {
            VStack(alignment: .leading, spacing: 0) {
                SlugText(kicker)
                Text(title)
                    .lfTitle(.h3)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
                Text(body)
                    .font(LF.Fonts.body(15))
                    .lineHeight(.multiple(factor: 1.4))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                Spacer(minLength: 16)
                DashedRule()
                // "open" across from the count while both fit, under it once they don't.
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline) {
                        if let count { CountText(count, unit: unit) }
                        Spacer()
                        SlugText("open", color: LF.Palette.ink)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        if let count { CountText(count, unit: unit) }
                        SlugText("open", color: LF.Palette.ink)
                    }
                }
                .padding(.top, 13)
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: The note at the end

    private func closingNote(_ department: Department, _ layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            NotebookCard(tilt: .preset(2), tape: true) {
                Text("Not sure where you fit?")
                    .lfTitle(.h2)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Open Getting Started. It walks the whole map: what each department actually does during a season, and what a rookie usually gets handed in week one. Every other tab makes more sense afterwards.")
                    .lfProse(16.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .learnMeasure(52)
                    .padding(.top, 12)
                NavigationLink(value: AppRoute.department(department.id)) {
                    Text("Open Getting Started")
                }
                .buttonStyle(.inkGhost)
                .padding(.top, 18)
            }
            .frame(maxWidth: 720, alignment: .leading)
            .padding(.top, 34)
            .learnArrival(reduceMotion)
        }
    }

    // MARK: Empty and error

    @ViewBuilder
    private func emptyState(_ layout: LearnLayout) -> some View {
        if catalog.isRefreshing || !catalog.isLoaded && catalog.lastError == nil {
            LearnLoadingBlock()
        } else {
            LearnNotice(
                kicker: "guides / not loaded",
                message: catalog.lastError?.message
                    ?? "The guides aren't on this device yet. They download the first time the app has a connection, then work offline."
            ) {
                Button("Try again") {
                    Task { await model.refreshAll() }
                }
                .buttonStyle(.inkGhostSmall)
            }
        }
    }
}

/// Anchors for in-page jumps.
enum LearnAnchor: Hashable {
    case routes
    case outcomes
    case department(String)
    case desk(String)
    case top
    /// The top of a screen's companion page on iPhone Duo (`LearnScrollPage`).
    case companionTop
}

// MARK: - Previews

#Preview("Learn, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { LearnView() }
        .appEnvironment(LearnPreviewCatalog.model())
}

#Preview("Learn, iPhone, guest, dark", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { LearnView() }
        .appEnvironment(LearnPreviewCatalog.model(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Learn, iPad", traits: .fixedLayout(width: 1180, height: 1600)) {
    NavigationStack { LearnView() }
        .appEnvironment(LearnPreviewCatalog.model())
}

#Preview("Learn, iPad, dark", traits: .fixedLayout(width: 834, height: 1400)) {
    NavigationStack { LearnView() }
        .appEnvironment(LearnPreviewCatalog.model())
        .environment(\.colorScheme, .dark)
}

#if DEBUG
#Preview("Guides, Duo book", traits: .duoBook) {
    NavigationStack { LearnView() }
        .appEnvironment(LearnPreviewCatalog.model())
        .previewFold(.previewBook)
}

#Preview("Guides, Duo book, whole page", traits: .fixedLayout(width: 867, height: 3400)) {
    NavigationStack { LearnView() }
        .appEnvironment(LearnPreviewCatalog.model())
        .previewFold(.previewFlat)
}

#Preview("Guides, Duo cover", traits: .duoCover) {
    NavigationStack { LearnView() }
        .appEnvironment(LearnPreviewCatalog.model(signedIn: false))
        .previewFold(.previewClosed)
}
#endif
