import SwiftUI

/// The Home tab: what to open next and how the week is going, in that order.
///
/// Runs top to bottom as one binder page, like the site's dashboard:
/// - the masthead (who's here, a one-line tally, one pen note),
/// - the one-time "Want reminder emails?" card when the account hasn't answered,
/// - the one lesson to open (the first-run loop when nothing is finished yet),
/// - the weekly goal from the server's `rhythm` and `rhythmCopy`, with the seven-day strip,
/// - the next badge, the tally, the team snippet, and the newest articles.
///
/// Guests get the same page warmly: the loop, an on-device week, what an account adds, the
/// question that picks a path. On iPad and Mac the page splits into two columns.
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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

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

    private var layout: HomeLayout {
        HomeLayout(width: width, largeType: dynamicTypeSize.isAccessibilitySize)
    }

    var body: some View {
        ScrollView {
            Group {
                if width > 0 {
                    page(layout)
                } else {
                    Color.clear.frame(height: 1)
                }
            }
            .padding(.horizontal, layout.gutter)
            .padding(.top, layout.isWide ? 30 : 16)
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
        // Nothing on Home takes typing, so the keyboard never insets it: on iPad a keyboard
        // inset once outlived the sign-in sheet and left a blank band under the last card.
        #if os(iOS)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        #endif
        .refreshable { await refresh() }
        .navigationTitle("Home")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar { toolbar }
        .closesShareSheetsOnNavigation()
        .task(id: teamTaskKey) { await loadTeam(force: false) }
        .onChange(of: account.userID) { emailPhase = .asking }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        #if os(iOS)
        ToolbarItem(placement: .principal) {
            LearnFRCWordmark(size: 19.5)
        }
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
    private func page(_ layout: HomeLayout) -> some View {
        VStack(alignment: .leading, spacing: layout.stackSpacing) {
            if account.isLoading {
                loadingPage
            } else {
                masthead(layout)
                statusNote
                if layout.isWide {
                    HomeColumnsLayout(
                        mainWidth: layout.mainWidth,
                        sideWidth: layout.sideWidth,
                        columnSpacing: layout.columnSpacing,
                        spacing: layout.stackSpacing
                    ) {
                        twoColumns(layout)
                    }
                } else {
                    singleColumn(layout)
                }
            }
        }
        .frame(width: layout.contentWidth, alignment: .topLeading)
    }

    /// iPad and Mac: the lesson and the week on the left, everything about the account and
    /// the team on the right, and the shelves (bookmarks, the start question, the articles)
    /// in whichever column is shorter, so the page ends level rather than with a long run
    /// of empty paper beside one column.
    @ViewBuilder
    private func twoColumns(_ layout: HomeLayout) -> some View {
        leadCard(large: layout.mainWidth >= 600, wideSteps: layout.mainWidth >= 640)
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
        startGoals
            .homeColumn(.either)
        articles
            .homeColumn(.either)
    }

    /// iPhone (and narrow windows): one column, most important first.
    @ViewBuilder
    private func singleColumn(_ layout: HomeLayout) -> some View {
        let width = layout.contentWidth
        emailCard
        leadCard(large: width >= 600, wideSteps: width >= 640 && !layout.largeType)
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
        startGoals
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

    // MARK: Masthead

    @ViewBuilder
    private func masthead(_ layout: HomeLayout) -> some View {
        let note = HomeMastheadNote(text: penNote, wide: layout.isWide)
        if layout.isWide {
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

    @ViewBuilder private var statusNote: some View {
        let pending = progress.pendingLessonIDs.count
        if !connectivity.isOnline {
            HomeStatusNote(
                systemImage: "wifi.slash",
                text: pending > 0
                    ? "Offline. \(HomeCopy.count(pending, "lesson")) saved here, and \(pending == 1 ? "it syncs" : "they sync") when you're back online."
                    : "Offline. Lessons and quizzes still work, and anything you finish syncs when you're back online."
            )
        } else if pending > 0 {
            HomeStatusNote(
                systemImage: "arrow.triangle.2.circlepath",
                text: "\(HomeCopy.count(pending, "lesson")) saved here, syncing with learnfrc.com."
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
    private func leadCard(large: Bool, wideSteps: Bool) -> some View {
        if !catalog.isLoaded {
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

    @ViewBuilder private var startGoals: some View {
        if completed == 0, !reference.startGoals.isEmpty {
            HomeStartGoals(goals: reference.startGoals.filter { !$0.pathSlug.isEmpty })
        }
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

    private func refresh() async {
        let model = self.model
        async let everything: Void = model.refreshAll()
        await loadTeam(force: true)
        await everything
    }

    private func loadTeam(force: Bool) async {
        guard case .live = teamSource, let me else { return }
        await teamModel.load(teamNumber: me.profile.teamNumber, online: connectivity.isOnline, force: force, stamp: progressStamp)
    }
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
        .frame(maxWidth: 640, alignment: .leading)
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
