import SwiftUI
import YouTubePlayerKit

/// One lesson, as one page of the binder.
///
///     LessonView(lessonID: id)                         // from AppRouteDestination
///     LessonView(lessonID: id) { route in path.append(route) }
///
/// Top to bottom, in the website's order: the file path, title, summary and the ruled fact
/// row; the video (a poster until pressed); the lesson; key takeaways; "Keep going"; the
/// verified mark; sources and corrections; articles clipped to the lesson; the quiz and its
/// sign-off (`QuizView`); the guest's ask; progress through the department; the lesson
/// before and after; every lesson in the department, folded away.
///
/// On a wide window (iPad, Mac) the text keeps a comfortable measure (about 72 characters)
/// and the margin holds "on this page", the key takeaways and the department meter, pinned
/// beside the text as it scrolls. The layout is worked out from the window's width in the
/// same pass that lays the page out, so the first layout is already the final one.
///
/// Previous and next lessons open in place, so Back still returns to wherever the reader
/// came from. The move goes through the window's path: the screen swaps the `.lesson` on top
/// of its tab (`WindowNavigation.showLesson(_:replacing:)`) and then follows its own
/// `lessonID`, the way it follows the Lesson menu or a link that replaced it. So the path
/// always names the lesson on screen, and the window title, the saved window state, Back and
/// the Lesson menu agree with it.
///
/// Native chrome on top, kept short so the title stays readable: bookmark, share (in the menu
/// on a phone), pause while reading aloud, and a "…" menu with everything else. The window's
/// width only picks the page layout, never the toolbar: the toolbar follows the size class.
/// The Lesson menu (Mac and iPad keyboards) owns the shortcuts and works from the window's
/// path (`WindowNavigation.visibleLessonID`), not from anything this screen publishes.
///
/// While it's the screen on show in its window (the top of the selected tab), the lesson is
/// offered to Handoff as `com.learnfrc.app.lesson` with its learnfrc.com address, so it
/// opens on another device or in a browser. iPhone and iPad keep hidden tabs and covered
/// screens alive, and those stay quiet.
struct LessonView: View {
    /// The `NSUserActivity` type for Handoff (also listed in Info.plist).
    static let activityType = "com.learnfrc.app.lesson"
    /// The quiz or sign-off card's scroll anchor.
    static let quizAnchor = "lesson-quiz"
    /// Two columns from this window width up...
    static let wideFrom: CGFloat = 960
    /// ...and back to one column only below this, so a width hovering at the line (a resize,
    /// a bar appearing) can't flip the layout back and forth.
    static let narrowBelow: CGFloat = 920
    /// Space kept above a block the page scrolls to (the quiz, a question to redo).
    static let scrollHeadroom: CGFloat = 16
    /// The marker a rebuilt page scrolls back to (`LessonResumeAnchor`).
    static let resumeAnchor = "lesson-resume"

    /// Where the page's scroll position waits in the window's `memory` while the lesson is in
    /// its tab's stack: the Mac rebuilds a tab's stack on every tab switch (ARCHITECTURE 6.6),
    /// and the page should come back where it was left. Filed per tab, like the quiz
    /// (`QuizView.memoryKey(_:tab:)`): the same lesson open in Guides and in Home keeps two
    /// places, and going back from one copy never forgets the other's.
    static func scrollMemoryKey(_ lessonID: UUID, tab: AppTab?) -> String {
        "lesson.scroll/\(tab?.rawValue ?? "-")/\(lessonID.uuidString)"
    }

    let lessonID: UUID
    /// Where links to other screens go. When nil, routes are pushed onto this lesson's own tab
    /// (`screenTab`), never whichever tab happens to be selected.
    var onOpen: ((AppRoute) -> Void)?

    init(lessonID: UUID, onOpen: ((AppRoute) -> Void)? = nil) {
        self.lessonID = lessonID
        self.onOpen = onOpen
        _currentID = State(initialValue: lessonID)
    }

    @Environment(CatalogStore.self) private var catalog
    @Environment(ReferenceStore.self) private var reference
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(Connectivity.self) private var connectivity
    @Environment(AppModel.self) private var app: AppModel?
    /// This window's navigation (each iPad or Mac window keeps its own place).
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    /// The tab whose stack this screen sits in, as the environment brings it. Use
    /// `screenTab`: on the Mac this is nil for a pushed screen (`NavigationTabFallback`).
    @Environment(\.navigationTab) private var tab
    @Environment(\.lessonAccountRequest) private var accountRequest
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    /// The lesson on screen. It follows `lessonID` (the route), and moves on its own only
    /// where there's no window path to go through (previews).
    @State private var currentID: UUID
    @State private var metrics = LessonScrollMetrics()
    @State private var reader = LessonReadAloud()
    @State private var videoPlayer: YouTubePlayer?
    /// The last two-column decision, so the next one can apply the hysteresis
    /// (`wideFrom` / `narrowBelow`). Only ever set to what the layout already decided, so
    /// setting it never changes the page.
    @State private var widePage = false
    @State private var barDismissed = false
    @State private var isFetchingBody = false
    @State private var scrollRequest: ScrollRequest?
    /// Bringing a rebuilt page back to where it was left (not observed).
    @State private var resume = LessonResume()
    @State private var tabFallback = NavigationTabFallback()
    /// The missing lesson the catalogue was last fetched for, so it's fetched once per lesson.
    @State private var catalogCheckedFor: UUID?

    /// The reading measure: about 72 characters of the body face, like the site's `68ch`.
    @ScaledMetric(relativeTo: .body) private var measure: CGFloat = 568
    @ScaledMetric(relativeTo: .footnote) private var railWidth: CGFloat = 248

    private struct ScrollRequest: Equatable {
        let target: String
        let serial: Int
    }

    // MARK: Derived

    private var location: LessonLocation? { catalog.location(of: currentID) }

    /// The tab whose stack this screen sits in (nil in previews). What the page keeps (its
    /// place, its answers) is filed under it, and links from the page push onto it.
    private var screenTab: AppTab? { tabFallback.tab(tab, navigation: navigation) }

    /// The page's layout for a window this wide.
    ///
    /// Read from a `GeometryReader` while the page is laid out, not measured afterwards and
    /// kept in `@State`: a width that arrived after the first layout changed the gutter, the
    /// text reflowed in the same frame, and the scroll view's geometry changed twice in one
    /// frame (SwiftUI dropped the second change, "OnScrollGeometryChange tried to update
    /// multiple times per frame", and the safe-area update with it).
    private func pageLayout(width: CGFloat) -> PageLayout {
        // Two columns from `wideFrom` up, and back to one only below `narrowBelow`, so a
        // width hovering at the line (a resize, a bar appearing) can't flip it back and forth.
        let twoColumns = widePage ? width >= Self.narrowBelow : width >= Self.wideFrom
        return PageLayout(
            width: width,
            twoColumns: twoColumns,
            // Never at the accessibility type sizes: the margin would be a column of single words.
            isWide: twoColumns && !typeSize.isAccessibilitySize
        )
    }

    /// Phones and narrow split views: the toolbar keeps only the bookmark and the menu.
    /// The size class, not the measured width, so the toolbar can't change what it measures.
    private var isCompactBar: Bool {
        #if os(iOS)
        sizeClass == .compact
        #else
        false
        #endif
    }

    /// True while this screen is the one on show in its window: the `.lesson` on top of the
    /// selected tab, and this screen's tab is that tab. Hidden tabs and covered screens stay
    /// alive on iPhone and iPad, so only this one speaks for the window. Outside a window's
    /// tabs (previews) it's always on show.
    static func isOnShow(_ lessonID: UUID, navigation: WindowNavigation?, tab: AppTab?) -> Bool {
        guard let navigation else { return true }
        guard let tab else { return navigation.visibleLessonID == lessonID }
        return navigation.isShowing(.lesson(lessonID), in: tab)
    }

    // MARK: Body

    var body: some View {
        Group {
            if let location {
                page(location)
                    .id(location.id)
                    .transition(.opacity)
            } else if catalog.isLoaded {
                missing
            } else {
                loadingCatalog
            }
        }
        .background(LF.Palette.paper.ignoresSafeArea())
        .navigationTitle(location?.lesson.title ?? "Lesson")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #else
        .navigationSubtitle(location?.department.name ?? "")
        #endif
        .toolbar { toolbar }
        .modifier(LessonHandoff(location: location, lessonID: lessonID))
        // Everything inside knows the tab, even where the environment didn't bring it.
        .environment(\.navigationTab, screenTab)
        // The share sheet (toolbar, menu, the sign-off card) closes when the window navigates
        // anywhere, like the glossary card does (`LessonMarkdownView`).
        .closesShareSheetsOnNavigation()
        .task(id: currentID) { await loadBody() }
        // The route is the source of truth: in-page next and previous, the Lesson menu and a
        // link that replaced this screen all arrive here as a new `lessonID`.
        .onChange(of: lessonID) { _, newID in follow(newID) }
        .onDisappear {
            reader.stop()
            forgetIfLeft(currentID)
        }
    }

    // MARK: The page

    private func page(_ location: LessonLocation) -> some View {
        GeometryReader { geometry in
            let layout = pageLayout(width: geometry.size.width.rounded(.down))
            scrollingPage(location, layout: layout)
                // Remembers the decision for the hysteresis next time. The decision already
                // used this value, so storing it changes nothing on the page.
                .onChange(of: layout.twoColumns, initial: true) { _, twoColumns in
                    if widePage != twoColumns { widePage = twoColumns }
                }
        }
    }

    private func scrollingPage(_ location: LessonLocation, layout: PageLayout) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LessonPageFrame(maxWidth: LF.Metrics.maxContentWidth) {
                    sheet(location, layout: layout)
                        .padding(.horizontal, layout.gutter)
                        .padding(.top, layout.isWide ? 28 : 18)
                        .padding(.bottom, 56)
                }
                // Where the page was left, for a rebuilt page to scroll back to. An overlay,
                // so it never changes the sheet's size.
                .overlay(alignment: .topLeading) {
                    LessonResumeAnchor(y: savedScroll(location.id))
                }
                .coordinateSpace(.named(LessonScrollMetrics.space))
            }
            .onScrollGeometryChange(for: LessonScrollMetrics.Geometry.self) { geometry in
                LessonScrollMetrics.Geometry(geometry)
            } action: { _, new in
                // The page fading out after an in-place next or previous keeps reporting for a
                // moment; only the lesson on screen moves the bar, the bar title and the margin.
                guard location.id == currentID else { return }
                metrics.update(new)
                resume.maxOffset = max(0, new.contentHeight - new.visibleHeight)
                // Kept as it scrolls (not observed, so it can't redraw anything), but not while
                // a rebuilt page is still on its way back to where it was.
                if resume.handled == location.id, !resume.isPending {
                    navigation?.memory.set(new.scrolledY, for: Self.scrollMemoryKey(location.id, tab: screenTab))
                }
            }
            .task(id: location.id) { await resumeScroll(location.id, proxy: proxy) }
            .paperBackground()
            .safeAreaInset(edge: .bottom, spacing: 0) {
                LessonFloatingBar(
                    metrics: metrics,
                    isCompleted: progress.isCompleted(location.id),
                    quizCount: catalog.lessonBody(location.id)?.quiz.count ?? 0,
                    signedIn: account.isSignedIn,
                    hasNext: true,
                    dismissed: $barDismissed,
                    onQuiz: { scroll(to: Self.quizAnchor) },
                    onNext: { continueOn(from: location) }
                )
            }
            .onChange(of: scrollRequest) { _, request in
                guard let request else { return }
                LF.Motion.perform(LF.Motion.settle) {
                    proxy.scrollTo(request.target, anchor: .top)
                }
            }
        }
    }

    @ViewBuilder
    private func sheet(_ location: LessonLocation, layout: PageLayout) -> some View {
        let lessonBody = catalog.lessonBody(location.id)
        VStack(alignment: .leading, spacing: 0) {
            LessonHeaderView(
                location: location,
                position: catalog.position(of: location.id),
                readingMinutes: lessonBody.map { LessonText.readingMinutes($0.content) },
                isCompleted: progress.isCompleted(location.id),
                isPending: progress.isPending(location.id),
                hasQuiz: !(lessonBody?.quiz.isEmpty ?? false),
                isWide: layout.isWide,
                metrics: metrics,
                onOpen: open,
                onFinish: { scroll(to: Self.quizAnchor) }
            )

            if layout.isWide {
                LessonWideRow(metrics: metrics, railWidth: railWidth) {
                    rail(location, body: lessonBody)
                } article: {
                    article(location, body: lessonBody, layout: layout)
                }
                .padding(.top, 44)
            } else {
                article(location, body: lessonBody, layout: layout)
                    .padding(.top, 34)
            }
        }
    }

    // MARK: The article column

    private func article(_ location: LessonLocation, body: LessonBody?, layout: PageLayout) -> some View {
        let department = location.department
        let next = catalog.nextLesson(after: location.id)
        let deptProgress = progress.departmentProgress(department)
        let signedIn = account.isSignedIn
        let isGuest = account.isGuest
        let videoID = body?.youtubeID ?? location.lesson.youtubeID
        let isWide = layout.isWide
        let width = layout.width
        let gap: CGFloat = isWide ? 48 : 40

        return VStack(alignment: .leading, spacing: 0) {
            if let videoID {
                LessonVideoFacade(
                    videoID: videoID,
                    lessonTitle: location.lesson.title,
                    player: $videoPlayer,
                    onPlay: { reader.stop() }
                )
                .padding(.bottom, 34)
            }

            if let body {
                LessonMarkdownView(markdown: body.content, glossary: reference.glossary, onOpen: open)

                if !isWide, !body.keyTakeaways.isEmpty {
                    LessonTakeawaysView(takeaways: body.keyTakeaways)
                        .padding(.top, gap)
                }

                nextStep(location, next: next, signedIn: signedIn, columns: width >= 700 ? 2 : 1)
                    .padding(.top, gap)

                if let verifiedAt = body.verifiedAt {
                    LessonVerifiedBadge(verifiedAt: verifiedAt)
                        .padding(.top, gap)
                }

                LessonProvenanceView(sources: body.resources, lessonURL: location.webURL, isWide: width >= 700)
                    .padding(.top, body.verifiedAt == nil ? gap : 12)

                let articles = Array(reference.relatedArticles(for: location.id).prefix(3))
                if !articles.isEmpty {
                    LessonReadNextView(articles: articles, columns: width >= 700 ? 2 : 1, onOpen: open)
                        .padding(.top, gap + 8)
                }

                QuizView(
                    lessonID: location.id,
                    quiz: body.quiz,
                    nextLesson: next,
                    memory: navigation?.memory,
                    memoryTab: screenTab,
                    onContinue: { continueOn(from: location) },
                    onSettled: { scroll(to: Self.quizAnchor) },
                    onScrollTo: { scroll(to: $0) }
                )
                .onGeometryChange(for: CGRect.self) { proxy in
                    proxy.frame(in: .named(LessonScrollMetrics.space))
                } action: { frame in
                    guard location.id == currentID else { return }
                    metrics.setQuizFrame(frame)
                }
                // A little headroom above the card when the page scrolls to it, so the sign-off's
                // band and stamp land clear of the bar.
                .padding(.top, Self.scrollHeadroom)
                .id(Self.quizAnchor)
                .padding(.top, gap - Self.scrollHeadroom)
            } else {
                bodyPlaceholder
            }

            if isGuest {
                let deptLessons = catalog.lessons(in: department)
                LessonSignupHookView(
                    departmentName: department.name,
                    position: catalog.position(of: location.id)?.index ?? 1,
                    count: deptLessons.count,
                    total: progress.completedTotal,
                    inDepartment: deptProgress.done,
                    onAccount: { requestAccount($0, location: location, ref: "lesson-hook") },
                    onQuiz: { scroll(to: Self.quizAnchor) }
                )
                .padding(.top, gap)
            }

            if !isWide, signedIn || (isGuest && deptProgress.done > 0) {
                LessonProgressStrip(
                    departmentName: department.name,
                    done: deptProgress.done,
                    total: deptProgress.total,
                    signedIn: signedIn
                )
                .padding(.top, gap)
            }

            LessonPagination(
                department: department,
                previous: catalog.previousLesson(before: location.id),
                next: next,
                isWide: width >= 600,
                onLesson: { go(to: $0.id) },
                onOpen: open
            )
            .padding(.top, gap)

            LessonContentsView(
                department: department,
                currentID: location.id,
                completed: progress.completedLessonIDs,
                columns: width >= 700 ? 2 : 1,
                onLesson: { go(to: $0) }
            )
            .padding(.top, gap)
        }
        .frame(maxWidth: measure, alignment: .leading)
    }

    private func nextStep(_ location: LessonLocation, next: LessonLocation?, signedIn: Bool, columns: Int) -> some View {
        let flat = catalog.lessons(in: location.department)
        let index = flat.firstIndex { $0.id == location.id } ?? 0
        let skip = Set([location.id, next?.id].compactMap { $0 })
        let siblings = catalog.lessons(in: location.module).filter { !skip.contains($0.id) }
        let related: [LessonLocation] = siblings.isEmpty
            ? Array(flat.filter { !skip.contains($0.id) }.dropFirst(max(0, index - 2)).prefix(4))
            : Array(siblings.prefix(4))
        let positionInModule = (location.module.lessons.firstIndex { $0.id == location.id } ?? 0) + 1
        return LessonNextStepView(
            location: location,
            positionInModule: positionInModule,
            next: next,
            related: related,
            relatedLabel: siblings.isEmpty ? "More in \(location.department.name)" : "More in \(location.module.title)",
            start: index > 0 ? flat.first : nil,
            isCompleted: progress.isCompleted(location.id),
            signedIn: signedIn,
            columns: columns,
            onLesson: { go(to: $0.id) },
            onOpen: open,
            onQuiz: { scroll(to: Self.quizAnchor) }
        )
    }

    private func rail(_ location: LessonLocation, body: LessonBody?) -> some View {
        let deptProgress = progress.departmentProgress(location.department)
        return LessonMarginRail(
            location: location,
            headings: body.map { LessonMarkdownView.headings(in: $0.content) } ?? [],
            takeaways: body?.keyTakeaways ?? [],
            done: deptProgress.done,
            total: deptProgress.total,
            signedIn: account.isSignedIn,
            isGuestWithProgress: account.isGuest && deptProgress.done > 0,
            metrics: metrics,
            onJump: { scroll(to: $0) },
            onOpen: open,
            onAccount: { requestAccount($0, location: location, ref: "reading-rail") }
        )
    }

    // MARK: Waiting and missing

    @ViewBuilder
    private var bodyPlaceholder: some View {
        if isFetchingBody || (connectivity.isOnline && !catalog.lessonBodiesLoaded) {
            VStack(alignment: .leading, spacing: 14) {
                SkeletonBlock(height: 26, width: 260)
                SkeletonBlock()
                SkeletonBlock()
                SkeletonBlock(width: 220)
                SkeletonBlock(height: 120)
                    .padding(.top, 10)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading the lesson")
        } else {
            NoteCallout {
                SlugText(connectivity.isOnline ? "couldn't load" : "offline")
                Text("This lesson hasn't downloaded yet.")
                    .font(LF.Fonts.body(17, weight: .bold, relativeTo: .headline))
                    .foregroundStyle(LF.Palette.ink)
                Text(connectivity.isOnline
                     ? "Something went wrong fetching it. Try again in a moment."
                     : "Lessons save for offline reading once the app has been online. Connect and it'll be here.")
                    .font(LF.Fonts.body(15.5, relativeTo: .callout))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Try again") { Task { await loadBody() } }
                    .buttonStyle(.inkGhostSmall)
                    .disabled(!connectivity.isOnline)
                    .padding(.top, 6)
            }
        }
    }

    private var loadingCatalog: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SkeletonBlock(height: 14, width: 240)
                SkeletonBlock(height: 40, width: 320)
                SkeletonBlock(height: 18)
                SkeletonBlock(height: 18, width: 260)
                SkeletonBlock(height: 200)
                    .padding(.top, 20)
            }
            .padding(LF.Metrics.gutter)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .paperBackground()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading the lesson")
    }

    private var missing: some View {
        VStack(alignment: .leading, spacing: 12) {
            SlugText("lesson / not found")
            Text("This lesson isn't in the catalogue")
                .lessonHeading(28)
            Text("It may have moved or been taken down. Every current lesson is in the guides.")
                .font(LF.Fonts.body(17, relativeTo: .body))
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
            if catalog.isRefreshing, catalogCheckedFor == currentID {
                SlugText("checking for a newer catalogue")
            }
            if let navigation = navigation ?? app?.activeNavigation {
                Button("Browse the guides") {
                    navigation.show(.learn)
                }
                .buttonStyle(.ink)
                .padding(.top, 6)
            }
        }
        .padding(LF.Metrics.gutter)
        .frame(maxWidth: 560, maxHeight: .infinity, alignment: .center)
        .frame(maxWidth: .infinity)
        .paperBackground()
    }

    // MARK: Toolbar

    /// The essentials only, so the title keeps its room (and on iPad portrait, the floating
    /// tab bar keeps its row): bookmark, share (in the menu on a phone), pause and resume
    /// while reading aloud, and "…" for the rest. No keyboard shortcuts here: the Lesson menu
    /// owns ⌥⌘← / ⌥⌘→ and ⌘D, and acts on the lesson the window's path shows.
    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        if let location {
            #if os(iOS)
            ToolbarItem(placement: .principal) {
                LessonBarTitle(
                    metrics: metrics,
                    title: location.lesson.title,
                    crumb: location.module.title,
                    compact: isCompactBar
                )
            }
            #endif

            ToolbarItemGroup(placement: .primaryAction) {
                if reader.isActive {
                    readAloudButton(location)
                }
                bookmarkButton(location)
                if !isCompactBar {
                    shareLink(location)
                }
                moreMenu(location)
            }
        }
    }

    private func readAloudButton(_ location: LessonLocation) -> some View {
        Button {
            toggleReading(location)
        } label: {
            switch reader.state {
            case .idle: Label("Read aloud", systemImage: "speaker.wave.2")
            case .speaking: Label("Pause reading", systemImage: "pause.fill")
            case .paused: Label("Resume reading", systemImage: "play.fill")
            }
        }
        .disabled(catalog.lessonBody(location.id) == nil)
    }

    private func bookmarkButton(_ location: LessonLocation) -> some View {
        let saved = progress.isBookmarked(location.id)
        return Button {
            Haptics.select()
            Task { await progress.toggleBookmark(location.id) }
            lessonAnnounce(saved ? "Removed from bookmarks" : "Saved to bookmarks")
        } label: {
            Label {
                Text(saved ? "Saved" : "Save")
            } icon: {
                Image(systemName: saved ? "bookmark.fill" : "bookmark")
                    .symbolEffect(.bounce, options: .nonRepeating, value: saved)
            }
        }
        .accessibilityLabel(saved ? "Saved. Remove bookmark" : "Bookmark this lesson")
    }

    private func shareLink(_ location: LessonLocation) -> some View {
        ShareLink(
            item: location.webURL,
            subject: Text(location.lesson.title),
            message: Text(location.lesson.summary ?? location.breadcrumb),
            preview: SharePreview(location.lesson.title)
        ) {
            Label("Share", systemImage: "square.and.arrow.up")
        }
    }

    private func moreMenu(_ location: LessonLocation) -> some View {
        let previous = catalog.previousLesson(before: location.id)
        let next = catalog.nextLesson(after: location.id)
        return Menu {
            if reader.isActive {
                Button {
                    reader.stop()
                } label: {
                    Label("Stop reading", systemImage: "stop.fill")
                }
            } else {
                Button {
                    toggleReading(location)
                } label: {
                    Label("Read aloud", systemImage: "speaker.wave.2")
                }
                .disabled(catalog.lessonBody(location.id) == nil)
            }
            if isCompactBar {
                shareLink(location)
            }
            if let body = catalog.lessonBody(location.id) {
                let headings = LessonMarkdownView.headings(in: body.content)
                if !headings.isEmpty {
                    Menu {
                        ForEach(headings) { heading in
                            Button(heading.title) { scroll(to: heading.id) }
                        }
                    } label: {
                        Label("On this page", systemImage: "list.bullet")
                    }
                }
            }
            Button {
                scroll(to: Self.quizAnchor)
            } label: {
                // Not a checkmark symbol: a menu item showing one reports the Selected trait.
                Label(progress.isCompleted(location.id) ? "Go to the sign-off" : "Go to the quiz", systemImage: "arrow.down.to.line")
            }
            Divider()
            Button {
                if let previous { go(to: previous.id) }
            } label: {
                Label("Previous lesson", systemImage: "arrow.backward")
            }
            .disabled(previous == nil)
            Button {
                if let next { go(to: next.id) }
            } label: {
                Label("Next lesson", systemImage: "arrow.forward")
            }
            .disabled(next == nil)
            Divider()
            Button {
                openURL(location.webURL)
            } label: {
                // Word joiners keep the domain whole: a narrow menu wraps at the space,
                // never inside "learnfrc.com".
                Label("Open on \(Self.unbreakable("learnfrc.com"))", systemImage: "safari")
            }
        } label: {
            Label("More", systemImage: "ellipsis")
        }
    }

    /// The text with a word joiner (U+2060) between every character, so it can't be broken
    /// or hyphenated across lines.
    static func unbreakable(_ text: String) -> String {
        text.map(String.init).joined(separator: "\u{2060}")
    }

    // MARK: Actions

    /// Opens another lesson in place from this page (next, previous, a lesson link on the
    /// page). Back still returns to where the reader came from.
    ///
    /// The move goes through the window's path: the `.lesson` on top of this tab is swapped
    /// (without animation, so the stack doesn't push or pop) and this screen follows its new
    /// `lessonID` (`follow(_:)`). So the path always names the lesson on screen: a stack
    /// rebuilt from it (the Mac does this on every tab switch), the saved window state, the
    /// window title, Back and the Lesson menu all agree with the page.
    private func go(to id: UUID) {
        guard id != currentID, catalog.location(of: id) != nil else { return }
        if let navigation, Self.isOnShow(lessonID, navigation: navigation, tab: screenTab) {
            var swap = Transaction()
            swap.disablesAnimations = true
            withTransaction(swap) { navigation.showLesson(id, replacing: lessonID) }
        } else {
            // No window path to go through (previews): move on its own.
            follow(id)
        }
    }

    /// Shows the lesson the route now names, in place: in-page next and previous, the Lesson
    /// menu, or a link that replaced this screen. Always follows, even to a lesson this
    /// device's catalogue doesn't have (a Handoff, widget or Spotlight link to a newer one),
    /// which shows "not found" until the catalogue has it.
    private func follow(_ id: UUID) {
        guard id != currentID else { return }
        forgetIfLeft(currentID)
        reader.stop()
        videoPlayer = nil
        metrics.reset()
        resume.maxOffset = 0
        barDismissed = false
        scrollRequest = nil
        LF.Motion.perform(LF.Motion.arrive) {
            currentID = id
        }
    }

    /// The next lesson, or the department when this was the last one.
    private func continueOn(from location: LessonLocation) {
        if let next = catalog.nextLesson(after: location.id) {
            go(to: next.id)
        } else {
            open(.department(location.department.id))
        }
    }

    /// Opens another screen from this page (a link in the text, a glossary card's "Open
    /// glossary entry", the header's crumbs). It goes onto this lesson's own tab, never
    /// whichever tab happens to be selected.
    private func open(_ route: AppRoute) {
        if case .lesson(let id) = route, catalog.location(of: id) != nil {
            go(to: id)
            return
        }
        if let onOpen {
            onOpen(route)
        } else if let navigation {
            navigation.push(route, in: screenTab)
        } else {
            app?.activeNavigation.push(route)
        }
    }

    private func scroll(to target: String) {
        scrollRequest = ScrollRequest(target: target, serial: (scrollRequest?.serial ?? 0) + 1)
    }

    // MARK: Coming back as it was

    /// Where this tab of this window last left the lesson's page, in points from the top of
    /// the sheet.
    private func savedScroll(_ id: UUID) -> CGFloat? {
        navigation?.memory.value(CGFloat.self, for: Self.scrollMemoryKey(id, tab: screenTab))
    }

    /// A page built again while its lesson was still in the stack (the Mac rebuilds a tab's
    /// stack on every tab switch, ARCHITECTURE 6.6; a link that reopens the same lesson) goes
    /// back to where it was left, once, without animation. A page with nothing kept stays at
    /// the top. Coming back from a screen pushed over it is left to the scroll view.
    private func resumeScroll(_ id: UUID, proxy: ScrollViewProxy) async {
        guard resume.handled != id else { return }
        resume.handled = id
        guard let target = savedScroll(id), target > 1 else { return }
        resume.isPending = true
        defer { resume.isPending = false }
        // The sheet is usually full height on its first layout (the body is cached); give it
        // up to about a second to get tall enough, then go as far as it goes.
        var waited = 0
        repeat {
            try? await Task.sleep(for: .milliseconds(50))
            guard !Task.isCancelled, id == currentID else { return }
            waited += 1
        } while resume.maxOffset < target - 1 && waited < 20
        var jump = Transaction()
        jump.disablesAnimations = true
        withTransaction(jump) { proxy.scrollTo(Self.resumeAnchor, anchor: .top) }
    }

    /// Gone back from (the lesson is no longer anywhere in its tab's stack): the next visit
    /// starts at the top with a fresh quiz, as it always did. Kept while it's still in the
    /// stack, for the Mac's rebuilt tab. Only this tab's: a copy of the same lesson in another
    /// tab keeps its own place and answers.
    private func forgetIfLeft(_ id: UUID) {
        guard let navigation, let tab = screenTab, !navigation.holds(.lesson(id), in: tab) else { return }
        navigation.memory.set(CGFloat?.none, for: Self.scrollMemoryKey(id, tab: tab))
        navigation.memory.set(QuizView.Remembered?.none, for: QuizView.memoryKey(id, tab: tab))
    }

    private func requestAccount(_ request: LessonAccountRequest, location: LessonLocation, ref: String) {
        if let accountRequest {
            accountRequest(request)
        } else {
            openURL(request == .signUp ? LessonLinks.signUp(next: location, ref: ref) : LessonLinks.logIn(next: location))
        }
    }

    private func toggleReading(_ location: LessonLocation) {
        guard let body = catalog.lessonBody(location.id) else { return }
        if reader.state == .idle, let videoPlayer {
            Task { try? await videoPlayer.pause() }
        }
        reader.toggle(
            LessonReadAloud.script(
                title: location.lesson.title,
                summary: location.lesson.summary,
                plainBody: LessonMarkdownView.plainText(of: body.content, glossary: reference.glossary),
                takeaways: body.keyTakeaways
            )
        )
    }

    /// Makes sure the body is on device (fetching just this lesson if the full set isn't
    /// cached yet), then parses the next lesson ahead of time so it opens instantly.
    private func loadBody() async {
        let id = currentID
        // Not in a loaded catalogue: there's no body to fetch, but a newer catalogue may have it.
        if catalog.isLoaded, catalog.location(of: id) == nil {
            await checkCatalog(forMissing: id)
            return
        }
        if catalog.lessonBody(id) == nil {
            isFetchingBody = true
            _ = await catalog.fetchLessonBody(id)
            isFetchingBody = false
        }
        guard id == currentID else { return }
        if catalog.location(of: id) == nil {
            await checkCatalog(forMissing: id)
            return
        }
        guard let next = catalog.nextLesson(after: id), let nextBody = catalog.lessonBody(next.id) else { return }
        // At the reader's text size, so the next lesson opens without parsing on the main thread.
        await LessonMarkdownView.prepare(nextBody.content, glossary: reference.glossary, dynamicTypeSize: typeSize)
    }

    /// A lesson this device's catalogue doesn't have, usually one published since it was
    /// fetched. Fetches the catalogue once for it while online, unless the catalogue was
    /// fetched in the last two minutes; when the lesson is in the new one, the page replaces
    /// "not found" by itself.
    private func checkCatalog(forMissing id: UUID) async {
        guard connectivity.isOnline, catalogCheckedFor != id else { return }
        if let updated = catalog.lastUpdated, Date.now.timeIntervalSince(updated) < 120 { return }
        catalogCheckedFor = id
        await catalog.refresh()
    }
}

/// The page's layout for one window width (`LessonView.pageLayout(width:)`).
private struct PageLayout {
    /// The window's width in whole points.
    let width: CGFloat
    /// Wide enough for the margin beside the text (with hysteresis).
    let twoColumns: Bool
    /// Two columns and a type size that leaves the margin readable.
    let isWide: Bool

    var gutter: CGFloat { LF.Metrics.gutter(for: width) }
}

/// Offers the lesson to Handoff while it's the screen on show in its window
/// (`LessonView.isOnShow`). Its own modifier, so only this re-reads when the window's tabs and
/// paths change, never the lesson's body.
private struct LessonHandoff: ViewModifier {
    let location: LessonLocation?
    /// The screen's route.
    let lessonID: UUID

    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab

    func body(content: Content) -> some View {
        let isActive = location != nil && LessonView.isOnShow(lessonID, navigation: navigation, tab: tab)
        content.userActivity(LessonView.activityType, isActive: isActive) { activity in
            guard let location else { return }
            activity.title = location.lesson.title
            activity.webpageURL = location.webURL
            activity.userInfo = ["lessonID": location.lesson.id.uuidString]
            activity.requiredUserInfoKeys = ["lessonID"]
            activity.targetContentIdentifier = location.deepLinkURL.absoluteString
            activity.isEligibleForHandoff = true
            // Spotlight belongs to the app's own index, not to activities.
            activity.isEligibleForSearch = false
        }
    }
}

// MARK: - The two-column row

/// The text and the margin on a wide window. The margin stays pinned while the text
/// scrolls (`LessonStickyColumn`); the 2pt ink margin rule runs the full height of the text,
/// like the site's `border-l-2`.
private struct LessonWideRow<Rail: View, Article: View>: View {
    let metrics: LessonScrollMetrics
    let railWidth: CGFloat
    @ViewBuilder var rail: Rail
    @ViewBuilder var article: Article

    private let ruleGap: CGFloat = 36

    var body: some View {
        LessonColumnsLayout(railWidth: railWidth, railGap: 30) {
            article
                .padding(.leading, ruleGap)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(LF.Palette.ink)
                        .frame(width: LF.Metrics.stroke)
                        .accessibilityHidden(true)
                }
            LessonStickyColumn(metrics: metrics) {
                rail
            }
        }
    }
}

/// Lays out the text column (first subview) beside the margin (second), in one pass: the row
/// is as tall as the taller of the two, worked out from their own sizes. Nothing measured
/// after layout (no height kept in `@State`) feeds back into it. The margin is offered the
/// whole row height, so its sticky column has the full run to travel.
private struct LessonColumnsLayout: Layout {
    let railWidth: CGFloat
    /// Between the margin and the text column's leading edge.
    let railGap: CGFloat

    private var lead: CGFloat { railWidth + railGap }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard subviews.count == 2 else { return .zero }
        let textWidth = proposal.width.map { max(0, $0 - lead) }
        let text = subviews[0].sizeThatFits(ProposedViewSize(width: textWidth, height: nil))
        let rail = subviews[1].sizeThatFits(ProposedViewSize(width: railWidth, height: nil))
        return CGSize(width: proposal.width ?? lead + text.width, height: max(text.height, rail.height))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 2 else { return }
        subviews[0].place(
            at: CGPoint(x: bounds.minX + lead, y: bounds.minY),
            anchor: .topLeading,
            proposal: ProposedViewSize(width: max(0, bounds.width - lead), height: nil)
        )
        subviews[1].place(
            at: bounds.origin,
            anchor: .topLeading,
            proposal: ProposedViewSize(width: railWidth, height: bounds.height)
        )
    }
}

// MARK: - Previews

#Preview("iPhone, video lesson", traits: .fixedLayout(width: 393, height: 2600)) {
    NavigationStack {
        LessonView(lessonID: PreviewData.budgetLessonBody.id)
    }
    .appEnvironment(.preview)
}

#Preview("iPhone dark, guest", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        LessonView(lessonID: PreviewData.lessonBody.id)
    }
    .appEnvironment(.preview(signedIn: false))
    .environment(\.colorScheme, .dark)
}

#Preview("iPad, wide", traits: .fixedLayout(width: 1180, height: 4000)) {
    NavigationStack {
        LessonView(lessonID: PreviewData.codeAndTableLessonBody.id)
    }
    .appEnvironment(.preview)
}

#Preview("iPad dark, finished and verified", traits: .fixedLayout(width: 1180, height: 820)) {
    NavigationStack {
        LessonView(lessonID: PreviewData.verifiedLessonBody.id)
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}

#Preview("iPad Split View, half (683)", traits: .fixedLayout(width: 683, height: 1000)) {
    NavigationStack {
        LessonView(lessonID: PreviewData.lessonBody.id)
    }
    .appEnvironment(.preview)
}

#Preview("At the two-column line (940, 960)", traits: .fixedLayout(width: 1900, height: 1000)) {
    // Inside the dead band a page opens as one column; from 960 it opens as two.
    HStack(alignment: .top, spacing: 20) {
        NavigationStack { LessonView(lessonID: PreviewData.lessonBody.id) }
            .frame(width: 940)
        NavigationStack { LessonView(lessonID: PreviewData.lessonBody.id) }
            .frame(width: 960)
    }
    .appEnvironment(.preview)
}

#Preview("iPhone, large type", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        LessonView(lessonID: PreviewData.calloutLessonBody.id)
    }
    .appEnvironment(.preview)
    .dynamicTypeSize(.accessibility1)
}
