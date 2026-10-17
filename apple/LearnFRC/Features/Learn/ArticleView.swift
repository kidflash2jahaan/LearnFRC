import SwiftUI

/// One article, as a sheet torn out of the binder (learnfrc.com/blog/{slug}).
///
/// It opens on its own filing line rather than a hero: the kicker, the title, the
/// description, then date, words and sections ruled off in mono. The body is the shared
/// lesson renderer. Wide windows get the margin index of sections beside it; everywhere
/// else the sections are in the toolbar. After the body: the lessons that teach the same
/// subject properly (the site's bridge, on the blue band), the three closest articles,
/// and the end of the sheet.
struct ArticleView: View {
    let slug: String

    @Environment(CatalogStore.self) private var catalog
    @Environment(ReferenceStore.self) private var reference
    @Environment(AppModel.self) private var model
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var bridge: Bridge?
    /// A section picked from the toolbar menu, scrolled to by the page.
    @State private var jumpTarget: String?

    init(slug: String) {
        self.slug = slug
    }

    /// Lessons whose "read next" list points at this article, all in one department.
    private struct Bridge: Equatable {
        let slug: String
        let department: Department
        let lessons: [LessonLocation]
    }

    var body: some View {
        if slug.isEmpty {
            // `AppRoute.articlesIndex`: the library itself.
            ArticlesView()
        } else if let article = catalog.article(slug: slug) {
            content(article)
                .task(id: BridgeKey(slug: slug, version: reference.version, lessons: catalog.allLessons.count)) {
                    bridge = makeBridge(for: article)
                }
        } else {
            LearnScrollPage(title: "Article", refresh: { await model.refreshAll() }, place: .route(.article(slug))) { layout, _ in
                Group {
                    if !catalog.isLoaded || catalog.articles.isEmpty && catalog.lastError == nil {
                        LearnLoadingBlock(rows: 2)
                    } else {
                        LearnNotice(kicker: "article / \(slug)",
                                    message: "This article isn't on this device. It may be new, or it may have moved.") {
                            Link(destination: AppConfig.webBase.appending(path: "blog/\(slug)")) {
                                LearnLinkLabel(title: "Open it on learnfrc.com", systemImage: "arrow.up.right")
                            }
                        }
                    }
                }
                .learnColumn(layout)
                .padding(.top, 24)
            }
        }
    }

    private struct BridgeKey: Equatable {
        let slug: String
        let version: String
        let lessons: Int
    }

    private func makeBridge(for article: Article) -> Bridge? {
        let matches = catalog.allLessons.filter { location in
            reference.relatedArticles(for: location.lesson.id).contains { $0.slug == article.slug }
        }
        guard !matches.isEmpty else { return nil }
        // The department most of those lessons live in, then its lessons in course order.
        var counts: [UUID: Int] = [:]
        for match in matches { counts[match.department.id, default: 0] += 1 }
        guard let top = matches.max(by: { (counts[$0.department.id] ?? 0) < (counts[$1.department.id] ?? 0) })?.department
        else { return nil }
        let lessons = matches.filter { $0.department.id == top.id }.prefix(3)
        return Bridge(slug: article.slug, department: top, lessons: Array(lessons))
    }

    // MARK: Content

    private func content(_ article: Article) -> some View {
        let headings = LessonMarkdownView.headings(in: article.content).filter { $0.level == 2 }
        let words = article.content.split(whereSeparator: { $0.isWhitespace }).count
        let related = ArticleDesks.related(to: article, in: catalog.articles)
        let bridge = bridge?.slug == article.slug ? bridge : nil

        // The lesson treatment on iPhone Duo: the text on one page (the standing half in
        // laptop posture), the sections and links on the other (the half on the table).
        let hasCompanion = headings.count > 1 || bridge != nil || !related.isEmpty
        return LearnScrollPage(title: article.title, place: .route(.article(slug)),
                               companionAxes: hasCompanion ? [.horizontal, .vertical] : [],
                               laptopCompanionEdge: .bottom) { layout, proxy in
            header(article, words: words, sections: headings.count, layout: layout)
                .learnColumn(layout)
                .padding(.top, 18)

            sheetBody(article, headings: headings, layout: layout, proxy: proxy)
                .learnColumn(layout)
                .padding(.top, 30)

            // On iPhone Duo's two pages the bridge and the next articles are on the next page.
            if layout.role == .page {
                if let bridge {
                    bridgeBand(bridge, layout: layout)
                        .learnBand()
                        .padding(.top, 52)
                }

                if !related.isEmpty {
                    keepReading(related, layout: layout)
                        .learnColumn(layout)
                        .padding(.top, 52)
                }
            }

            endOfSheet(article)
                .learnColumn(layout)
                .padding(.top, 48)
        } companion: { layout in
            // iPhone Duo's trailing page (or the flat half in laptop posture), the way a lesson's
            // margin works: the sections to jump to, the lessons that teach this properly, and
            // the closest articles.
            VStack(alignment: .leading, spacing: 0) {
                if headings.count > 1 {
                    LearnSheetIndex(headings: headings) { id in
                        jumpTarget = id
                    }
                    .learnColumn(layout)
                    .padding(.bottom, 44)
                }
                if let bridge {
                    bridgeBand(bridge, layout: layout)
                        .learnBand()
                        .padding(.bottom, 44)
                }
                if !related.isEmpty {
                    keepReading(related, layout: layout)
                        .learnColumn(layout)
                }
            }
            .padding(.top, 22)
        }
        .toolbar {
            if headings.count > 1 {
                ToolbarItem(placement: .secondaryAction) {
                    Menu {
                        ForEach(Array(headings.enumerated()), id: \.element.id) { index, heading in
                            Button("\(LearnFormat.ordinal(index + 1))  \(heading.title)") {
                                jumpTarget = heading.id
                            }
                        }
                    } label: {
                        Label("On this sheet", systemImage: "list.bullet")
                    }
                }
            }
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: article.webURL, subject: Text(article.title),
                          message: Text("\(article.title), a free FRC article on LearnFRC")) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .learnHandoff(article.webURL, place: .route(.article(slug)))
    }

    // MARK: Head of the sheet

    private func header(_ article: Article, words: Int, sections: Int, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("article / \(article.readMins) min")
            Text(article.title)
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 700, alignment: .leading)
                .padding(.top, 14)
            if !article.description.isEmpty {
                LearnLede(article.description)
                    .padding(.top, 16)
            }
            DashedRule()
                .padding(.top, 22)
            SlugText("\(LearnFormat.articleDate(article.date, long: true)) / \(LearnFormat.plural(words, "word", "words")) / \(LearnFormat.plural(sections, "section", "sections"))")
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
        }
    }

    // MARK: Body and margin index

    @ViewBuilder
    private func sheetBody(_ article: Article, headings: [LessonMarkdownHeading], layout: LearnLayout, proxy: ScrollViewProxy) -> some View {
        // Onto the article's own tab: a glossary popover's link can outlive a tab switch, and
        // it must never land in whichever tab happens to be selected.
        let markdown = LessonMarkdownView(markdown: article.content, glossary: reference.glossary) { route in
            if let navigation, let tab { navigation.push(route, in: tab) } else { model.push(route) }
        }
        Group {
            if layout.isWide && headings.count > 1 {
                HStack(alignment: .top, spacing: 48) {
                    markdown.frame(maxWidth: .infinity, alignment: .leading)
                    LearnSheetIndex(headings: headings) { id in
                        scroll(to: id, proxy: proxy)
                    }
                    .frame(width: 240)
                }
            } else {
                markdown
            }
        }
        .onChange(of: jumpTarget) { _, target in
            guard let target else { return }
            scroll(to: target, proxy: proxy)
            jumpTarget = nil
        }
    }

    private func scroll(to id: String, proxy: ScrollViewProxy) {
        LF.Motion.perform(LF.Motion.settle) {
            proxy.scrollTo(id, anchor: .top)
        }
    }

    // MARK: The bridge into the guides

    /// The blue band where the page changes subject: lessons that teach this properly.
    private func bridgeBand(_ bridge: Bridge, layout: LearnLayout) -> some View {
        let department = bridge.department
        return SlabView {
            VStack(alignment: .leading, spacing: 0) {
                let lead = VStack(alignment: .leading, spacing: 0) {
                    Text("dept / \(department.slug)")
                        .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                        .foregroundStyle(LF.Palette.onBlue.opacity(0.8))
                    Text("This article is one page of \(department.name).")
                        .font(LF.Fonts.display(28, relativeTo: .title))
                        .tracking(-0.7)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                        .accessibilityAddTraits(.isHeader)
                    Text("You came for one answer. These teach the same subject properly, in the order a team actually learns it. All \(department.lessonCount) are free, and none of them need an account to read.")
                        .font(LF.Fonts.body(15.5))
                        .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: 480, alignment: .leading)
                        .padding(.top, 12)
                }
                let button = NavigationLink(value: AppRoute.department(department.id)) {
                    Text("Open all \(department.lessonCount)")
                        .font(LF.Fonts.mono(14, weight: .bold, relativeTo: .callout))
                        .foregroundStyle(LF.Palette.blueButton)
                        .padding(.vertical, 11)
                        .padding(.horizontal, 18)
                        .frame(minHeight: LF.Metrics.tap)
                        .background {
                            ZStack {
                                HandShape(.s).fill(LF.Palette.ink.opacity(0.5)).offset(x: 3, y: 3)
                                HandShape(.s).fill(LF.Palette.onBlue)
                            }
                        }
                }
                .buttonStyle(.plain)

                if layout.isRegular {
                    HStack(alignment: .bottom, spacing: 32) {
                        lead.frame(maxWidth: .infinity, alignment: .leading)
                        button
                    }
                } else {
                    lead
                    button.padding(.top, 18)
                }

                let columns = Array(repeating: GridItem(.flexible(), spacing: 28, alignment: .top),
                                    count: layout.isRegular ? min(3, bridge.lessons.count) : 1)
                LazyVGrid(columns: columns, alignment: .leading, spacing: 0) {
                    ForEach(Array(bridge.lessons.enumerated()), id: \.element.id) { index, location in
                        NavigationLink(value: AppRoute.lesson(location.lesson.id)) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("lesson \(LearnFormat.ordinal(index + 1))")
                                    .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                                    .foregroundStyle(LF.Palette.onBlue.opacity(0.8))
                                Text(location.lesson.title)
                                    .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let summary = location.lesson.summary {
                                    Text(summary)
                                        .font(LF.Fonts.body(14.5))
                                        .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .foregroundStyle(LF.Palette.onBlue)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 16)
                            .overlay(alignment: .top) {
                                DashedRule(color: LF.Palette.onBlue.opacity(0.45))
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Lesson: \(location.lesson.title)")
                        .accessibilityHint(location.lesson.summary ?? "")
                    }
                }
                .padding(.top, 24)
            }
            .frame(maxWidth: LF.Metrics.maxContentWidth, alignment: .leading)
            .padding(layout.bandInsets)
            .frame(maxWidth: .infinity)
            .padding(.vertical, layout.isRegular ? 26 : 18)
        }
    }

    // MARK: Keep reading

    private func keepReading(_ related: [Article], layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom, spacing: 24) {
                Text("Next in the same pile")
                    .lfTitle(.h2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if layout.isRegular {
                    MarkerText("these are the closest, not the newest", angle: 1.4)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 220, alignment: .trailing)
                }
            }
            if !layout.isRegular {
                MarkerText("these are the closest, not the newest")
                    .padding(.top, 10)
            }

            NotebookCard(padding: 0) {
                let panels = ForEach(Array(related.enumerated()), id: \.element.id) { index, article in
                    if index > 0 {
                        if layout.isRegular {
                            Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.stroke)
                        } else {
                            InkRule()
                        }
                    }
                    relatedPanel(article)
                }
                if layout.isRegular {
                    HStack(alignment: .top, spacing: 0) { panels }
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    VStack(alignment: .leading, spacing: 0) { panels }
                }
            }
            .padding(.top, 24)
            .learnArrival(reduceMotion, angle: 0)
        }
    }

    private func relatedPanel(_ article: Article) -> some View {
        NavigationLink(value: AppRoute.article(article.slug)) {
            VStack(alignment: .leading, spacing: 0) {
                SlugText("\(article.readMins) min read")
                Text(article.title)
                    .font(LF.Fonts.display(19, relativeTo: .title3))
                    .tracking(-0.45)
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                Text(article.description)
                    .font(LF.Fonts.body(14.5))
                    .lineHeight(.multiple(factor: 1.4))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                Spacer(minLength: 14)
                DashedRule()
                SlugText("read it", color: LF.Palette.ink)
                    .padding(.top, 10)
            }
            .padding(LF.Metrics.cardPadding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(LearnWashButtonStyle())
        .accessibilityLabel(article.title)
        .accessibilityValue("\(article.readMins) minute read")
        .accessibilityHint(article.description)
    }

    // MARK: End of the sheet

    private func endOfSheet(_ article: Article) -> some View {
        let lessons = catalog.allLessons.count
        let departments = catalog.departments.count
        return VStack(alignment: .leading, spacing: 0) {
            InkRule()
            SlugText("end of sheet")
                .padding(.top, 18)
            Text(lessons > 0
                ? "Keep going with the other \(max(0, catalog.articles.count - 1)) articles, or work through all \(lessons.formatted()) lessons across \(departments) departments."
                : "Keep going with the other \(max(0, catalog.articles.count - 1)) articles.")
                .lfProse(16, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(60)
                .padding(.top, 8)
            HStack(spacing: 12) {
                NavigationLink(value: AppRoute.articlesIndex) {
                    Text("All articles")
                }
                .buttonStyle(.inkGhostSmall)
                Link(destination: article.webURL) {
                    Text("Open on learnfrc.com")
                }
                .buttonStyle(.inkGhostSmall)
                .accessibilityHint("Opens in your browser")
            }
            .padding(.top, 16)
        }
    }
}

// MARK: - The margin index

/// The sections down the edge of the page (`ReadingRail`): a rule, then the sections,
/// numbered. Tapping one scrolls there.
struct LearnSheetIndex: View {
    let headings: [LessonMarkdownHeading]
    let jump: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("on this sheet / \(headings.count)")
                .padding(.bottom, 8)
            InkRule()
            ForEach(Array(headings.enumerated()), id: \.element.id) { index, heading in
                Button {
                    jump(heading.id)
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        SlugText(LearnFormat.ordinal(index + 1))
                        Text(heading.title)
                            .font(LF.Fonts.body(14))
                            .foregroundStyle(LF.Palette.graphite)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 9)
                    .padding(.leading, 10)
                    .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: .leading)
                    .overlay(alignment: .bottom) { DashedRule() }
                }
                .buttonStyle(.inkRow)
                .accessibilityLabel("Section \(index + 1): \(heading.title)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("On this sheet")
    }
}

// MARK: - Previews

#Preview("Article, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { ArticleView(slug: PreviewData.article.slug) }
        .appEnvironment(.preview)
}

#Preview("Article, iPhone, dark", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { ArticleView(slug: PreviewData.articles[1].slug) }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#Preview("Article, iPad", traits: .fixedLayout(width: 1180, height: 1600)) {
    NavigationStack { ArticleView(slug: PreviewData.article.slug) }
        .appEnvironment(.preview)
}

#Preview("Article, iPad, dark", traits: .fixedLayout(width: 834, height: 1500)) {
    NavigationStack { ArticleView(slug: PreviewData.articles[2].slug) }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#if DEBUG
#Preview("Article, Duo book", traits: .fixedLayout(width: 867, height: 2000)) {
    NavigationStack { ArticleView(slug: PreviewData.article.slug) }
        .appEnvironment(.preview)
        .previewFold(.previewBook)
}
#endif
