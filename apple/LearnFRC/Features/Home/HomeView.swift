import SwiftUI

/// The Home tab: what to open next and how the week is going, in that order.
///
/// Runs top to bottom as one binder page, like the site's dashboard:
/// - the masthead (who's here, a one-line tally, one pen note),
/// - the one-time "Want reminder emails?" card when the account hasn't answered,
/// - the one lesson to open (the first-run loop when nothing is finished yet), or, once the
///   site's one question is answered, the five-lesson plan for that answer until it's done
///   (learnfrc.com/start, `HomeStartPlan.swift`),
/// - the weekly goal from the server's `rhythm` and `rhythmCopy`, with the seven-day strip,
/// - the next badge, the tally, the team snippet, and the newest articles.
///
/// Guests get the same page warmly: the loop, an on-device week, what an account adds, the
/// question that picks a plan. On iPad and Mac the page splits into two columns.
///
/// The shell wraps this in the Home tab's `NavigationStack` and registers `AppRoute`
/// destinations; every link here is a `NavigationLink(value: AppRoute)`.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(CatalogStore.self) private var catalog
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(ReferenceStore.self) private var reference
    @Environment(Connectivity.self) private var connectivity
    @Environment(StartPlanStore.self) private var injectedStartPlan: StartPlanStore?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.fold) private var windowFold

    private let teamSource: HomeTeamSource
    private let onSignIn: (() -> Void)?
    private let onCreateAccount: (() -> Void)?

    @State private var width: CGFloat = 0
    @State private var teamModel = HomeTeamModel()
    @State private var emailPhase = HomeEmailCardPhase.asking
    private let emailSession = HomeEmailPromptSession.shared

    /// - Parameters:
    ///   - onSignIn: shows sign-in for a guest. Defaults to switching to the You tab.
    ///   - onCreateAccount: shows sign-up for a guest. Defaults to switching to the You tab.
    init(onSignIn: (() -> Void)? = nil, onCreateAccount: (() -> Void)? = nil) {
        self.init(team: .live, onSignIn: onSignIn, onCreateAccount: onCreateAccount)
    }

    /// Previews pass a fixed team instead of calling `/api/app/team`.
    init(team: HomeTeamSource, onSignIn: (() -> Void)? = nil, onCreateAccount: (() -> Void)? = nil) {
        self.teamSource = team
        self.onSignIn = onSignIn
        self.onCreateAccount = onCreateAccount
    }

    var body: some View {
        // The fold and the margins come from outside the scroll view, where the page measures
        // its room; the width is still the one the scroll view offers (see below).
        FoldReader { geometry, fold in
            let layout = HomeLayout(width: width, largeType: dynamicTypeSize.isAccessibilitySize,
                                    margins: geometry.lfPageMargins, fold: fold)
            ScrollViewReader { proxy in
                scrollView(proxy, layout: layout)
            }
        }
        // Nothing on Home takes typing, so the keyboard never insets it: on iPad a keyboard
        // inset once outlived the sign-in sheet and left a blank band under the last card.
        #if os(iOS)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        #endif
        .navigationTitle("Home")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        // The wordmark replaces the title; on iPhone Duo's inner screen held upright it moves
        // from the middle of the bar, over the crease, to the leading edge.
        .toolbar(removing: windowFold.isVertical ? .title : nil)
        #endif
        .toolbar { toolbar }
        .closesShareSheetsOnNavigation()
        .task(id: teamTaskKey) { await loadTeam(force: false) }
        .task(id: startPlanTaskKey) { await loadStartPlan() }
        .onChange(of: account.userID) { old, new in
            emailPhase = .asking
            // The plan's ticks belonged to the account that was signed in.
            if old != nil, old != new { startPlan.dropAccountTicks() }
        }
    }

    private func scrollView(_ proxy: ScrollViewProxy, layout: HomeLayout) -> some View {
        ScrollView {
            Group {
                if width > 0 {
                    page(layout, proxy: proxy)
                } else {
                    Color.clear.frame(height: 1)
                }
            }
            .padding(.leading, layout.margins.leading)
            .padding(.trailing, layout.margins.trailing)
            .padding(.top, HomeLayout.topPadding(wide: layout.isWide))
            .padding(.bottom, 48)
            .frame(maxWidth: .infinity)
            // Report exactly the offered width, so a block that rounds a fraction of a point
            // wide can't widen the scroll view and, through the gutter (4% of this width),
            // change the layout it was measured from (the lesson's iPad freeze; see
            // `LessonPageFrame`).
            .modifier(LessonOfferedWidthModifier(maxWidth: .infinity))
            .onGeometryChange(for: CGFloat.self) { $0.size.width.rounded(.down) } action: { width = $0 }
        }
        // Comes back where it was left when the Mac builds the tab again.
        .remembersScroll(.root)
        .paperBackground()
        .refreshable { await refresh() }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        #if os(iOS)
        ToolbarItem(placement: windowFold.isVertical ? .topBarLeading : .principal) {
            LearnFRCWordmark(size: 19.5)
        }
        .sharedBackgroundVisibility(.hidden)
        .lfAxisBehavior(.horizontalOnly)
        #else
        ToolbarItem(placement: .primaryAction) {
            Button {
                Task { await refresh() }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            // No shortcut here: View > Refresh owns Command-R.
            .disabled(model.isRefreshingAll)
            .help("Refresh lessons and progress from learnfrc.com")
        }
        #endif
    }

    // MARK: Page

    @ViewBuilder
    private func page(_ layout: HomeLayout, proxy: ScrollViewProxy) -> some View {
        HomeStackLayout(spacing: layout.stackSpacing, avoiding: layout.bandAcross) {
            if account.isLoading {
                loadingPage
                    .frame(maxWidth: layout.pages?.leading ?? .infinity, alignment: .leading)
            } else {
                masthead(layout)
                statusNote(layout)
                if layout.isWide {
                    HomeColumnsLayout(
                        mainWidth: layout.mainWidth,
                        sideWidth: layout.sideWidth,
                        columnSpacing: layout.columnSpacing,
                        spacing: layout.stackSpacing
                    ) {
                        twoColumns(layout, proxy: proxy)
                    }
                } else {
                    singleColumn(layout, proxy: proxy)
                }
            }
        }
        .frame(width: layout.contentWidth, alignment: .topLeading)
    }

    /// iPad and Mac: the lesson and the week on the left, everything about the account and
    /// the team on the right, and the shelves (bookmarks, the start question, the articles)
    /// in whichever column is shorter, so the page ends level rather than with a long run
    /// of empty paper beside one column. On iPhone Duo's inner screen held upright the two
    /// columns are its two pages, meeting either side of the crease.
    @ViewBuilder
    private func twoColumns(_ layout: HomeLayout, proxy: ScrollViewProxy) -> some View {
        leadCard(large: layout.mainWidth >= 600, wideSteps: layout.mainWidth >= 640, proxy: proxy)
            .id(HomeAnchor.lead)
            .homeColumn(.main)
        weekCard(wide: layout.mainWidth >= 560)
            .homeColumn(.main)
        emailCard
            .homeColumn(.side)
        guestAccountCard
            .homeColumn(.side)
        nextUnlockCard
            .homeColumn(.side)
        tally(columns: layout.sideWidth >= 360 ? 3 : 2)
            .homeColumn(.side)
        teamCard
            .homeColumn(.side)
        bookmarks
            .homeColumn(.either)
        startGoals(wide: layout.mainWidth >= 600, proxy: proxy)
            .homeColumn(.either)
        articles
            .homeColumn(.either)
    }

    /// iPhone (and narrow windows): one column, most important first.
    @ViewBuilder
    private func singleColumn(_ layout: HomeLayout, proxy: ScrollViewProxy) -> some View {
        let width = layout.contentWidth
        emailCard
        leadCard(large: width >= 600, wideSteps: width >= 640 && !layout.largeType, proxy: proxy)
            .id(HomeAnchor.lead)
        weekCard(wide: width >= 560 && !layout.largeType)
        bookmarks
        guestAccountCard
        if width >= 640, !layout.largeType, hasNextUnlock, isSignedIn {
            HStack(alignment: .top, spacing: 24) {
                nextUnlockCard
                teamCard
            }
            tally(columns: 3)
        } else {
            nextUnlockCard
            // The grid drops to two columns or one by itself once "departments" wouldn't fit
            // a column on one line (from XXXL on a phone).
            tally(columns: width >= 330 ? 3 : 2)
            teamCard
        }
        startGoals(wide: width >= 600 && !layout.largeType, proxy: proxy)
        articles
    }

    // MARK: State

    private var me: Me? { account.me }
    private var isSignedIn: Bool { me != nil }
    private var isGuest: Bool { account.isGuest }
    private var completed: Int { progress.completedTotal }
    private var hasNextUnlock: Bool { isSignedIn && progress.nextUnlock != nil && completed > 0 }

    private var departmentsOpen: Int {
        catalog.departments.reduce(0) { count, department in
            let p = progress.departmentProgress(department)
            return count + (p.done > 0 && p.done < p.total ? 1 : 0)
        }
    }

    private var streak: Int { progress.rhythm?.currentStreak ?? 0 }

    private var teamPhase: HomeTeamModel.Phase {
        switch teamSource {
        case .fixed(let team): .loaded(team)
        case .live: teamModel.phase
        }
    }

    private var teamTaskKey: String {
        "\(account.userID?.uuidString ?? "guest")|\(me?.profile.teamNumber ?? 0)|\(connectivity.isOnline)|\(progressStamp)"
    }

    /// Changes whenever this account's lessons change on the server: a completion, a queued
    /// one syncing, or the guest lessons a sign-in moved in (`ProgressStore.progressRevision`
    /// goes up once the move is done). The team snippet counts the same lessons, so it
    /// reloads then instead of showing the roster from before.
    private var progressStamp: String {
        "\(progress.progressRevision)|\(completed)|\(progress.pendingLessonIDs.count)"
    }

    // MARK: Start plan

    private var startPlan: StartPlanStore { injectedStartPlan ?? .shared }

    private var startAnswers: [HomeStartAnswer] {
        HomeStartAnswer.all(reference: reference, catalog: catalog)
    }

    /// The saved answer, while the site still offers it (its `readStartGoalId` drops an id it
    /// no longer knows). Before the reference data arrives, the saved one stands.
    private var startGoalID: String? {
        guard let id = startPlan.goalID else { return nil }
        return reference.startGoals.isEmpty || reference.startGoal(id: id) != nil ? id : nil
    }

    /// The plan in the lead card's place: from the moment an answer is saved until every
    /// lesson on it is done. Nil when there's no answer, the question is open again, or the
    /// plan is finished (Home goes back to the usual next lesson then).
    private var startPlanPhase: HomeStartPlanSection.Phase? {
        guard let goalID = startGoalID, !startPlan.isChanging else { return nil }
        if let plan = startPlan.plan, plan.goal.id == goalID {
            if startPlan.isFinished(plan, progress: progress) { return nil }
            return .ready(HomeStartPlanModel(plan: plan, store: startPlan, catalog: catalog, progress: progress, reference: reference))
        }
        if !startPlan.isLoading, let error = startPlan.lastError { return .failed(error.message) }
        return .loading
    }

    private var startPathSlug: String {
        if let plan = startPlan.plan, plan.goal.id == startGoalID { return plan.pathSlug }
        return startGoalID.flatMap { reference.startGoal(id: $0)?.pathSlug } ?? ""
    }

    private var startPathTitle: String {
        if let plan = startPlan.plan, plan.goal.id == startGoalID, !plan.pathTitle.isEmpty { return plan.pathTitle }
        return reference.path(slug: startPathSlug)?.title ?? ""
    }

    /// The account's handle for "You're set, maya." (Home never prints a full name).
    private var startHandle: String? {
        guard let me, !me.needsUsernameSetup, let username = me.profile.username, !username.isEmpty else { return nil }
        return username
    }

    private var startPlanTaskKey: String {
        "\(startGoalID ?? "-")|\(connectivity.isOnline)|\(catalog.isLoaded)|\(account.isLoading)"
    }

    // MARK: Masthead

    @ViewBuilder
    private func masthead(_ layout: HomeLayout) -> some View {
        let note = HomeMastheadNote(text: penNote, wide: layout.isWide && layout.pages == nil)
        if let pages = layout.pages {
            // iPhone Duo's two pages: the greeting on the leading page, the pen note on the
            // trailing one.
            HStack(alignment: .bottom, spacing: pages.gap) {
                mastheadText(layout)
                    .frame(width: pages.leading, alignment: .leading)
                note
                    .padding(.bottom, 6)
                    .frame(width: pages.trailing, alignment: .bottomLeading)
            }
        } else if layout.isWide {
            HStack(alignment: .bottom, spacing: 40) {
                mastheadText(layout)
                Spacer(minLength: 0)
                note
                    .frame(maxWidth: 260, alignment: .trailing)
                    .padding(.bottom, 6)
            }
        } else {
            VStack(alignment: .leading, spacing: 16) {
                mastheadText(layout)
                note
            }
        }
    }

    @ViewBuilder
    private func mastheadText(_ layout: HomeLayout) -> some View {
        if let me {
            HomeMemberMasthead(
                me: me,
                summary: memberSummary,
                headlineSize: layout.headlineSize,
                stacked: layout.largeType
            )
        } else {
            HomeGuestMasthead(
                departmentCount: catalog.departments.count,
                headlineSize: layout.headlineSize
            )
        }
    }

    /// One pen annotation on the page, saying the thing the figures can't.
    private var penNote: String {
        if isSignedIn, streak > 1 { return "the streak is the multiplier, not the trophy" }
        if isGuest, completed > 0 { return "it all saves on this device" }
        return "five in a week is where it starts to stick"
    }

    private var memberSummary: String {
        guard completed > 0 else {
            return "Nothing ticked off yet. Open one lesson and this page starts keeping score."
        }
        let running = streak > 1 ? ", \(streak) days running" : ""
        return "\(HomeCopy.count(completed, "lesson")) cleared, \(HomeCopy.count(departmentsOpen, "department")) open\(running)."
    }

    // MARK: Status

    @ViewBuilder
    private func statusNote(_ layout: HomeLayout) -> some View {
        let pending = progress.pendingLessonIDs.count
        let maxWidth = min(640, layout.pages?.leading ?? 640)
        if !connectivity.isOnline {
            HomeStatusNote(
                systemImage: "wifi.slash",
                text: pending > 0
                    ? "Offline. \(HomeCopy.count(pending, "lesson")) saved here, and \(pending == 1 ? "it syncs" : "they sync") when you're back online."
                    : "Offline. Lessons and quizzes still work, and anything you finish syncs when you're back online.",
                maxWidth: maxWidth
            )
        } else if pending > 0 {
            HomeStatusNote(
                systemImage: "arrow.triangle.2.circlepath",
                text: "\(HomeCopy.count(pending, "lesson")) saved here, syncing with learnfrc.com.",
                maxWidth: maxWidth
            )
        }
    }

    // MARK: Sections

    @ViewBuilder private var emailCard: some View {
        if isSignedIn, (account.emailPrompt && !emailSession.askLater) || emailPhase != .asking {
            HomeEmailChoiceCard(phase: $emailPhase)
                .transition(.opacity)
        }
    }

    @ViewBuilder
    private func leadCard(large: Bool, wideSteps: Bool, proxy: ScrollViewProxy) -> some View {
        if startPlan.isChanging, !startAnswers.isEmpty {
            // "Change the route": the question comes back where the plan was.
            startPicker(wide: large, proxy: proxy)
        } else if let phase = startPlanPhase {
            HomeStartPlanSection(
                phase: phase,
                pathSlug: startPathSlug,
                pathTitle: startPathTitle,
                handle: startHandle,
                wide: large,
                onChange: { changeStartGoal(proxy) },
                onRetry: { retryStartPlan() }
            )
        } else if !catalog.isLoaded {
            HomeCatalogPlaceholder(loading: catalog.isRefreshing || catalog.lastError == nil)
        } else if completed == 0 {
            HomeFirstRunCard(location: progress.continueLesson, isGuest: !isSignedIn, wide: wideSteps)
        } else if let location = progress.continueLesson {
            let tally = progress.departmentProgress(location.department)
            HomeContinueCard(
                location: location,
                departmentDone: tally.done,
                departmentTotal: tally.total,
                fresh: false,
                large: large
            )
        } else {
            HomeAllDoneCard(lessonCount: catalog.allLessons.count, departmentCount: catalog.departments.count)
        }
    }

    @ViewBuilder
    private func weekCard(wide: Bool) -> some View {
        if let rhythm = progress.rhythm, let copy = progress.rhythmCopy {
            HomeWeekCard(rhythm: rhythm, copy: copy, onDevice: progress.rhythmIsOnDevice, wide: wide)
        } else if isSignedIn {
            HomeWeekPlaceholder(loading: progress.isRefreshing || (connectivity.isOnline && progress.lastError == nil))
        }
    }

    @ViewBuilder private var nextUnlockCard: some View {
        if hasNextUnlock, let unlock = progress.nextUnlock {
            HomeNextUnlockCard(unlock: unlock)
        }
    }

    /// Hidden until there's something to count: a new account isn't greeted by six zeros.
    @ViewBuilder
    private func tally(columns: Int) -> some View {
        if isSignedIn, completed > 0 {
            HomeTally(
                xp: progress.xp,
                level: progress.level,
                streak: streak,
                lessons: completed,
                departmentsOpen: departmentsOpen,
                departmentsDone: progress.certificates.count,
                badgesEarned: progress.earnedAchievements.count,
                badgesTotal: catalog.achievements.count,
                movingGuestLessons: progress.isMovingGuestLessons ? progress.movingGuestLessonIDs.count : 0,
                columns: columns
            )
        }
    }

    @ViewBuilder private var teamCard: some View {
        if let me, !me.needsUsernameSetup {
            if let number = me.profile.teamNumber {
                HomeTeamCard(teamNumber: number, phase: teamPhase)
            } else if !me.isProvisional {
                HomeTeamNudge()
            }
        }
    }

    @ViewBuilder private var guestAccountCard: some View {
        if isGuest {
            HomeGuestAccountCard(
                lessonsOnDevice: completed,
                onCreateAccount: { (onCreateAccount ?? showAccountTab)() },
                onSignIn: { (onSignIn ?? showAccountTab)() }
            )
        }
    }

    /// The one question, for anyone with nothing finished and no answer saved yet: the whole
    /// question, or the one-line card once it's been put away with "Skip for now". Once
    /// answered, the plan takes the lead card's place instead (`leadCard`).
    @ViewBuilder
    private func startGoals(wide: Bool, proxy: ScrollViewProxy) -> some View {
        if completed == 0, startGoalID == nil, !startPlan.isChanging, !startAnswers.isEmpty {
            if startPlan.isSkipped {
                HomeStartPrompt { startPlan.unskip() }
            } else {
                startPicker(wide: wide, proxy: proxy)
            }
        }
    }

    private func startPicker(wide: Bool, proxy: ScrollViewProxy) -> some View {
        HomeStartPicker(
            answers: startAnswers,
            handle: startHandle,
            lessonCount: catalog.allLessons.count,
            departmentCount: catalog.departments.count,
            wide: wide,
            onChoose: { chooseStartGoal($0, proxy: proxy) },
            onBrowse: { browseGuides() },
            onSkip: { skipStartQuestion() }
        )
    }

    /// The lessons set aside with the bookmark, once there are any.
    @ViewBuilder private var bookmarks: some View {
        let saved = progress.bookmarkedLessons
        if !saved.isEmpty {
            HomeBookmarksShelf(lessons: saved)
        }
    }

    @ViewBuilder private var articles: some View {
        let recent = Array(catalog.articles.prefix(3))
        if !recent.isEmpty {
            HomeRecentArticles(articles: recent)
        }
    }

    private var loadingPage: some View {
        VStack(alignment: .leading, spacing: 26) {
            VStack(alignment: .leading, spacing: 14) {
                SkeletonBlock(height: 12, width: 120)
                SkeletonBlock(height: 38, width: 260)
                SkeletonBlock(height: 16, width: 300)
            }
            HomeCatalogPlaceholder(loading: true)
            HomeWeekPlaceholder(loading: true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading your binder")
    }

    // MARK: Actions

    private func showAccountTab() {
        model.selectedTab = .profile
    }

    /// Saves the answer for a year and shows its plan where the lead card was.
    private func chooseStartGoal(_ goal: StartGoal, proxy: ScrollViewProxy) {
        Haptics.select()
        let store = startPlan
        let signedIn = isSignedIn
        // Saved now, so the question leaves and the plan takes the lead card's place in this
        // update; the page goes up to it once it's laid out, then the plan fills in below its
        // top edge, so the scroll stays put.
        store.answer(goal.id)
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(60))
            LF.Motion.perform(LF.Motion.settle) {
                proxy.scrollTo(HomeAnchor.lead, anchor: .top)
            }
            // Home's own load usually has it already (the answer changed its task key); this
            // covers answering the same goal again after a plan that didn't come back.
            await store.loadPlanIfNeeded(signedIn: signedIn)
        }
    }

    private func changeStartGoal(_ proxy: ScrollViewProxy) {
        startPlan.beginChange()
        LF.Motion.perform(LF.Motion.settle) {
            proxy.scrollTo(HomeAnchor.lead, anchor: .top)
        }
    }

    /// "Skip for now": back to the plan when changing an answer, else the question folds up.
    private func skipStartQuestion() {
        if startPlan.isChanging {
            startPlan.endChange()
        } else {
            startPlan.skip()
        }
    }

    private func retryStartPlan() {
        let store = startPlan
        let signedIn = isSignedIn
        Task { await store.retry(signedIn: signedIn) }
    }

    /// "Browse all N departments": the Guides tab, at its department wall.
    private func browseGuides() {
        model.popToRoot(.learn)
        model.selectedTab = .learn
    }

    private func loadStartPlan() async {
        guard !account.isLoading else { return }
        startPlan.expireIfNeeded()
        let known = catalog.isLoaded ? Set(catalog.allLessons.map(\.id)) : nil
        await startPlan.loadPlanIfNeeded(signedIn: isSignedIn, knownLessons: known)
    }

    private func refresh() async {
        let model = self.model
        let startPlan = self.startPlan
        let signedIn = isSignedIn
        async let everything: Void = model.refreshAll()
        // The plan's rows never reshuffle (finished lessons stay as ticked rows), so asking
        // again only brings the site's ticks and any change to the route.
        async let plan: Void = startPlan.retry(signedIn: signedIn)
        await loadTeam(force: true)
        await everything
        await plan
    }

    private func loadTeam(force: Bool) async {
        guard case .live = teamSource, let me else { return }
        await teamModel.load(teamNumber: me.profile.teamNumber, online: connectivity.isOnline, force: force, stamp: progressStamp)
    }
}

/// In-page jumps on Home.
enum HomeAnchor: Hashable {
    /// The lead card: the plan, the question while it's being changed, or the next lesson.
    case lead
}

// MARK: - Masthead pieces

/// The signed-in masthead: the account's handle, never anyone's full name on Home.
private struct HomeMemberMasthead: View {
    let me: Me
    let summary: String
    let headlineSize: CGFloat
    /// Accessibility text sizes: the avatar sits above the greeting instead of beside it.
    var stacked = false

    @ScaledMetric(relativeTo: .title) private var avatarSize: CGFloat = 56

    private var handle: String { me.profile.username ?? "there" }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("your binder")
            Group {
                if stacked {
                    VStack(alignment: .leading, spacing: 12) {
                        avatar
                        greeting
                    }
                } else {
                    HStack(alignment: .center, spacing: 14) {
                        avatar
                        greeting
                    }
                }
            }
            .padding(.top, 14)
            Text(summary)
                .homeSub(17.5)
                .frame(maxWidth: 520, alignment: .leading)
                .padding(.top, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var avatar: some View {
        InitialsAvatar(
            name: me.profile.username ?? "?",
            seed: me.user.id.uuidString.lowercased(),
            imageURL: me.profile.avatarURL,
            size: avatarSize
        )
    }

    private var greeting: some View {
        Text("Hey, \(handle)")
            .homeTitle(headlineSize, relativeTo: .largeTitle)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The guest masthead: the site's homepage claim, with "written down" underlined in blue.
private struct HomeGuestMasthead: View {
    let departmentCount: Int
    let headlineSize: CGFloat

    private var lede: String {
        let departments = departmentCount > 0 ? "\(departmentCount) departments" : "Every department"
        return "\(departments), from swerve geometry to sponsor letters. Free to read, and nothing sits behind a login."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("welcome to the binder")
            Text("Every job on an FRC team, \(Text("written down").underline(true, color: LF.Palette.blue)).")
                .homeTitle(headlineSize, relativeTo: .largeTitle)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 640, alignment: .leading)
                .padding(.top, 14)
            Text(lede)
                .homeSub(17.5)
                .frame(maxWidth: 520, alignment: .leading)
                .padding(.top, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The pen note in the masthead's margin.
private struct HomeMastheadNote: View {
    let text: String
    let wide: Bool

    var body: some View {
        MarkerText(text, size: wide ? 24 : 21, angle: 1.4)
            .multilineTextAlignment(wide ? .trailing : .leading)
            .frame(maxWidth: wide ? 260 : 300, alignment: wide ? .trailing : .leading)
    }
}

/// A quiet line about the connection or writes waiting to sync.
private struct HomeStatusNote: View {
    let systemImage: String
    let text: String
    var maxWidth: CGFloat = 640

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 9) {
            Image(systemName: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(LF.Palette.ink)
                .accessibilityHidden(true)
            Text(text)
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 10)
        .frame(maxWidth: maxWidth, alignment: .leading)
        .background {
            HandShape(.s).strokeBorder(LF.Palette.rule, style: StrokeStyle(lineWidth: LF.Metrics.hairline, dash: [3, 3]))
        }
        .accessibilityElement(children: .combine)
    }
}

/// Stands in for the lesson card while the catalog loads, or says it didn't.
private struct HomeCatalogPlaceholder: View {
    var loading: Bool

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, tapeAngle: -3.4) {
            if loading {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(height: 12, width: 170)
                    SkeletonBlock(height: 28)
                    SkeletonBlock(height: 28, width: 210)
                    SkeletonBlock(height: 12, width: 230)
                }
            } else {
                SlugText("departments")
                Text("The catalogue didn't come back this time.")
                    .homeTitle(22)
                    .padding(.top, 8)
                Text("Nothing you've finished is affected. \(HomeCopy.retry)")
                    .homeSub(15.5)
                    .padding(.top, 8)
            }
        }
    }
}

// MARK: - Previews

private struct HomePreviewHost: View {
    let model: AppModel
    var team: Team? = PreviewData.team

    var body: some View {
        NavigationStack {
            HomeView(team: .fixed(team))
                .navigationDestination(for: AppRoute.self) { route in
                    Text(String(describing: route))
                        .font(LF.Fonts.mono(14))
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .paperBackground()
                }
        }
        .appEnvironment(model)
    }
}

#Preview("Signed in, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(phase: .building))
        .environment(\.colorScheme, .light)
}

#Preview("Signed in, iPhone, dark", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(phase: .goalMet))
        .environment(\.colorScheme, .dark)
}

#Preview("Email question, iPhone", traits: .fixedLayout(width: 393, height: 1400)) {
    HomePreviewHost(model: .preview(phase: .returning, me: PreviewData.meWithEmailPrompt))
        .environment(\.colorScheme, .light)
}

#Preview("New account, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(phase: .new))
        .environment(\.colorScheme, .light)
}

#Preview("Guest, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .new))
        .environment(\.colorScheme, .light)
}

#Preview("Guest, start plan, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .new))
        .environment(StartPlanStore.preview(goal: "code", plan: HomeStartPreviewData.plan))
        .environment(\.colorScheme, .light)
}

#Preview("New account, start plan, iPad", traits: .fixedLayout(width: 1180, height: 1700)) {
    HomePreviewHost(model: .preview(phase: .new))
        .environment(StartPlanStore.preview(goal: "code", plan: HomeStartPreviewData.plan))
        .environment(\.colorScheme, .light)
}

#Preview("Guest, changing the answer, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .new))
        .environment(StartPlanStore.preview(goal: "code", plan: HomeStartPreviewData.plan, changing: true))
        .environment(\.colorScheme, .dark)
}

#Preview("Guest, question skipped, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .new))
        .environment(StartPlanStore.preview(skipped: true))
        .environment(\.colorScheme, .light)
}

#Preview("Guest, iPhone, dark", traits: .fixedLayout(width: 393, height: 2600)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .building))
        .environment(\.colorScheme, .dark)
}

#Preview("Offline, saved to sync, iPhone", traits: .fixedLayout(width: 393, height: 1200)) {
    HomePreviewHost(model: .preview(phase: .building, pendingLessonIDs: [PreviewData.lesson.id], online: false))
        .environment(\.colorScheme, .light)
}

#Preview("Signed in, iPad", traits: .fixedLayout(width: 1180, height: 1500)) {
    HomePreviewHost(model: .preview(phase: .building, me: PreviewData.meWithEmailPrompt))
        .environment(\.colorScheme, .light)
}

#Preview("Signed in, iPad, dark", traits: .fixedLayout(width: 1180, height: 1500)) {
    HomePreviewHost(model: .preview(phase: .goalMet))
        .environment(\.colorScheme, .dark)
}

#Preview("Signed in, iPad portrait", traits: .fixedLayout(width: 820, height: 2000)) {
    HomePreviewHost(model: .preview(phase: .resting))
        .environment(\.colorScheme, .light)
}

#Preview("Guest, iPad", traits: .fixedLayout(width: 1180, height: 1500)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .firstLesson))
        .environment(\.colorScheme, .light)
}

#Preview("Guest, iPad, dark", traits: .fixedLayout(width: 1180, height: 1500)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .new))
        .environment(\.colorScheme, .dark)
}

#Preview("Large type, iPhone", traits: .fixedLayout(width: 393, height: 3600)) {
    HomePreviewHost(model: .preview(phase: .building))
        .dynamicTypeSize(.accessibility2)
        .environment(\.colorScheme, .light)
}

#if DEBUG
#Preview("Signed in, Duo book", traits: .fixedLayout(width: 867, height: 1800)) {
    HomePreviewHost(model: .preview(phase: .building))
        .previewFold(.previewBook)
        .environment(\.colorScheme, .light)
}

#Preview("Guest, Duo book, large type", traits: .fixedLayout(width: 867, height: 3000)) {
    HomePreviewHost(model: .preview(signedIn: false, phase: .new))
        .previewFold(.previewFlat)
        .dynamicTypeSize(.accessibility3)
}

#Preview("Signed in, Duo laptop", traits: .duoLaptop) {
    HomePreviewHost(model: .preview(phase: .building))
        .previewFold(.previewLaptop)
}

#Preview("Signed in, Duo cover", traits: .fixedLayout(width: 382, height: 1400)) {
    HomePreviewHost(model: .preview(phase: .building))
        .previewFold(.previewClosed)
}
#endif
