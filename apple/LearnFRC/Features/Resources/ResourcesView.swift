import SwiftUI

/// The resources shelf, like learnfrc.com/resources: the pocket at the back of the binder
/// holding other people's manuals.
///
/// Nobody reads this page; they come for a name they half-remember, find it and leave. So
/// it's drawn for scan-and-go, the way the site draws it: the contents list is the first
/// thing in the masthead, every link prints the host it goes to (the domain is how you know
/// a doc you trust), then the toolbox shelf by shelf, then the works cited, department by
/// department. Everything comes from `GET /api/app/resources` (`ResourcesStore`), kept on
/// the device, so it opens offline once it has loaded once. Links open in the in-app
/// browser, the way a lesson's links do.
struct ResourcesView: View {
    @Environment(ResourcesStore.self) private var injected: ResourcesStore?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var store: ResourcesStore { injected ?? .shared }

    private static let webURL = AppConfig.webBase.appending(path: "resources")

    var body: some View {
        LearnScrollPage(title: "Resources", refresh: { await store.refresh() }, place: .route(.resources)) { layout, proxy in
            if let page = store.page {
                content(page, layout: layout, proxy: proxy)
            } else {
                Group {
                    if !store.isCacheLoaded || store.isRefreshing || store.lastError == nil {
                        ResourcesLoadingBlock()
                    } else {
                        LearnNotice(
                            kicker: "resources / not loaded",
                            message: "The resources aren't on this device yet. They download the first time the app has a connection, then work offline. \(store.lastError?.message ?? "")"
                        ) {
                            Button("Try again") {
                                Task { await store.refresh() }
                            }
                            .buttonStyle(.inkGhostSmall)
                        }
                    }
                }
                .learnColumn(layout)
                .padding(.top, 24)
            }
        }
        // Every link on the page leaves LearnFRC: open it in the in-app browser, like a
        // lesson's links, rather than switching apps.
        .environment(\.openURL, OpenURLAction { url in
            let isWeb = ["http", "https"].contains(url.scheme?.lowercased() ?? "")
            return isWeb ? .systemAction(url, prefersInApp: true) : .systemAction(url)
        })
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: Self.webURL, subject: Text("FRC Resources: Tools, Docs & Links")) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
            #if os(macOS)
            ToolbarItem {
                Button {
                    Task { await store.refresh() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(store.isRefreshing)
                .help("Check learnfrc.com for new links")
            }
            #endif
        }
        .learnHandoff(Self.webURL, place: .route(.resources))
        .task { await store.load() }
    }

    // MARK: Page

    @ViewBuilder
    private func content(_ page: ResourcesPage, layout: LearnLayout, proxy: ScrollViewProxy) -> some View {
        // On iPhone Duo's two pages every section lays itself out across both (`layout.pages`),
        // its columns meeting either side of the crease.
        masthead(page, layout: layout, proxy: proxy)
            .learnColumn(layout, spread: true)
            .padding(.top, 20)
            .id(ResourcesAnchor.top)

        if !page.shelves.isEmpty {
            toolbox(page, layout: layout)
                .learnColumn(layout, spread: true)
                .padding(.top, 52)
                .id(ResourcesAnchor.toolbox)
        }

        ResourcesWorksCited(page: page, layout: layout)
            .learnColumn(layout, spread: true)
            .padding(.top, 52)
            .id(ResourcesAnchor.sources)

        suggestionSlip(layout)
            .learnColumn(layout, spread: true)
            .padding(.top, 52)
    }

    // MARK: Masthead

    private func masthead(_ page: ResourcesPage, layout: LearnLayout, proxy: ScrollViewProxy) -> some View {
        let lead = VStack(alignment: .leading, spacing: 0) {
            SectionLabel("reference / \(LearnFormat.plural(page.totalLinks, "link", "links")) / \(LearnFormat.plural(page.shelves.count, "shelf", "shelves"))")
            Text("Everything a build season makes you \(Text("look up").underline(true, color: LF.Palette.blue)).")
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
            LearnLede("The official docs, the software your code depends on, the vendors you order from, and the two forums where the answers actually are.")
                .padding(.top, 16)

            let buttons = Group {
                if !page.shelves.isEmpty {
                    Button("Open the toolbox") { jump(to: .toolbox, proxy) }
                        .buttonStyle(.ink)
                }
                Button("What the lessons cite") { jump(to: .sources, proxy) }
                    .buttonStyle(.inkGhost)
            }
            // Side by side when both fit; stacked at large text sizes rather than wrapped.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { buttons }
                VStack(alignment: .leading, spacing: 12) { buttons }
            }
            .padding(.top, 22)
        }

        let contents = VStack(alignment: .leading, spacing: 0) {
            if !page.shelves.isEmpty {
                ResourcesShelfContents(shelves: page.shelves) { shelf in
                    jump(to: .shelf(shelf.slug), proxy)
                }
            }
            MarkerText("the wpilib docs answer most of it", angle: -1.1)
                .frame(maxWidth: 260, alignment: .leading)
                .padding(.top, 16)
        }

        return Group {
            if let pages = layout.pages {
                LearnSpread(pages: pages) {
                    lead
                } trailing: {
                    contents
                }
            } else if layout.isRegular {
                HStack(alignment: .top, spacing: layout.isWide ? 54 : 32) {
                    lead.frame(maxWidth: .infinity, alignment: .leading)
                    contents.frame(width: min(400, layout.contentWidth * 0.38), alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 34) {
                    lead
                    contents
                }
            }
        }
    }

    private func jump(to anchor: ResourcesAnchor, _ proxy: ScrollViewProxy) {
        LF.Motion.perform(LF.Motion.settle) {
            proxy.scrollTo(anchor, anchor: .top)
        }
    }

    // MARK: The toolbox

    private func toolbox(_ page: ResourcesPage, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let pages = layout.pages {
                LearnSpreadRule(pages: pages)
            } else {
                InkRule()
            }
            LearnSectionHeader(
                title: "\(LearnFormat.spelledCount(page.shelves.count)) \(page.shelves.count == 1 ? "shelf" : "shelves"), filed the way a pit is.",
                sub: "Each shelf holds the links for one job, so the one you want is where you would reach for it. \(ResourcesCopy.leavesTheApp)"
            )
            .frame(maxWidth: layout.pages?.leading ?? .infinity, alignment: .leading)
            .padding(.top, 28)

            if let pages = layout.pages {
                // A bin on each page, each going under whichever page is shorter so the two
                // end together; the gap between them is the crease.
                let bin = LearnLayout.page(min(pages.leading, pages.trailing))
                LearnFoldColumns(pages: pages, fill: .balanced, spacing: 24) {
                    ForEach(Array(page.shelves.enumerated()), id: \.element.id) { index, shelf in
                        ResourcesShelfBin(shelf: shelf, index: index, layout: bin)
                            .id(ResourcesAnchor.shelf(shelf.slug))
                            .learnArrival(reduceMotion, angle: -0.5)
                    }
                }
                .padding(.top, 30)
            } else {
                VStack(alignment: .leading, spacing: layout.isRegular ? 28 : 24) {
                    ForEach(Array(page.shelves.enumerated()), id: \.element.id) { index, shelf in
                        ResourcesShelfBin(shelf: shelf, index: index, layout: layout)
                            .id(ResourcesAnchor.shelf(shelf.slug))
                            .learnArrival(reduceMotion, angle: -0.5)
                    }
                }
                .frame(maxWidth: 900, alignment: .leading)
                .padding(.top, 30)
            }
        }
    }

    // MARK: The suggestion slip

    private func suggestionSlip(_ layout: LearnLayout) -> some View {
        let slip = NotebookCard(tilt: .degrees(-0.5), tape: true) {
            SlugText("suggestion slip")
            Text("Missing something worth linking.")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            Text("If a doc, a tool or a forum thread belongs on one of these shelves, say so. Naming the shelf is what turns a suggestion into a to-do.")
                .lfProse(16, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(50)
                .padding(.top, 10)
            Link(destination: Self.webURL.withFragment("suggest")) {
                Text("Suggest a link on learnfrc.com")
            }
            .buttonStyle(.inkGhost)
            .accessibilityHint("Opens the suggestion slip on learnfrc.com")
            .padding(.top, 18)
        }
        .frame(maxWidth: 620, alignment: .leading)

        let note = MarkerText("a link that saved you an hour is worth sending", angle: 1.3)
            .frame(maxWidth: 240, alignment: .leading)

        return VStack(alignment: .leading, spacing: 0) {
            if let pages = layout.pages {
                LearnSpreadRule(pages: pages)
            } else {
                InkRule()
            }
            Group {
                if let pages = layout.pages {
                    LearnSpread(pages: pages) {
                        slip
                    } trailing: {
                        note.padding(.top, 32)
                    }
                } else if layout.isRegular {
                    HStack(alignment: .top, spacing: 40) {
                        slip
                        note.padding(.top, 32)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 20) {
                        slip
                        note
                    }
                }
            }
            .padding(.top, 34)
        }
    }
}

/// In-page jumps on the resources page.
enum ResourcesAnchor: Hashable {
    case top
    case toolbox
    case sources
    case shelf(String)
}

// MARK: - Wording

/// Copy rules the resources page applies on top of what the site sends.
enum ResourcesCopy {
    /// The site's "Every link leaves this site and opens in a new tab", said for the app.
    static var leavesTheApp: String {
        #if os(macOS)
        "Every link leaves the app and opens in your browser."
        #else
        "Every link leaves the app and opens in the in-app browser."
        #endif
    }
}

private extension URL {
    /// This URL with `#fragment` on the end.
    func withFragment(_ fragment: String) -> URL {
        var components = URLComponents(url: self, resolvingAgainstBaseURL: false)
        components?.fragment = fragment
        return components?.url ?? self
    }
}

// MARK: - Previews

#Preview("Resources, iPhone", traits: .fixedLayout(width: 393, height: 3200)) {
    NavigationStack { ResourcesView() }
        .appEnvironment(.preview)
        .environment(ResourcesStore.preview(ResourcesPreviewData.page))
}

#Preview("Resources, iPhone, dark", traits: .fixedLayout(width: 393, height: 3200)) {
    NavigationStack { ResourcesView() }
        .appEnvironment(.preview(signedIn: false))
        .environment(ResourcesStore.preview(ResourcesPreviewData.page))
        .environment(\.colorScheme, .dark)
}

#Preview("Resources, iPad", traits: .fixedLayout(width: 1180, height: 2600)) {
    NavigationStack { ResourcesView() }
        .appEnvironment(.preview)
        .environment(ResourcesStore.preview(ResourcesPreviewData.page))
}

#Preview("Resources, not loaded", traits: .fixedLayout(width: 393, height: 700)) {
    NavigationStack { ResourcesView() }
        .appEnvironment(.preview)
        .environment(ResourcesStore.preview(nil, error: .network))
}

#Preview("Resources, large type", traits: .fixedLayout(width: 393, height: 5200)) {
    NavigationStack { ResourcesView() }
        .appEnvironment(.preview)
        .environment(ResourcesStore.preview(ResourcesPreviewData.page))
        .dynamicTypeSize(.accessibility3)
}

#if DEBUG
#Preview("Resources, Duo book, whole page", traits: .fixedLayout(width: 867, height: 3600)) {
    NavigationStack { ResourcesView() }
        .appEnvironment(.preview)
        .environment(ResourcesStore.preview(ResourcesPreviewData.page))
        .previewFold(.previewFlat)
}
#endif
