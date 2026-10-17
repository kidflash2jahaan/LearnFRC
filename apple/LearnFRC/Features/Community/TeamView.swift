import SwiftUI

/// The pit sheet (the site's `/teams`): everyone who signed up with my team number, which
/// subteams nobody has picked up, each person's progress department by department, and the
/// invite. Teams are implicit: same team number, same sheet. Usernames only.
struct TeamView: View {
    @Environment(\.communityClient) private var client
    @Environment(AccountStore.self) private var account
    @Environment(CatalogStore.self) private var catalog
    @Environment(ProgressStore.self) private var progress

    @State private var state = CommunityLoad<TeamPayload>()
    /// Whose team `state` holds, so a different account never sees the last one's sheet.
    @State private var stateUserID: UUID?

    private struct LoadKey: Hashable {
        let userID: UUID?
        let teamNumber: Int?
    }

    private var loadKey: LoadKey { LoadKey(userID: account.userID, teamNumber: account.profile?.teamNumber) }
    private var team: Team? { display.value?.team }

    /// The sheet as it stands for this account, falling back to what this session already
    /// fetched, so reopening the page draws the team on the first frame.
    private var display: CommunityLoad<TeamPayload> {
        var shown = stateUserID == account.userID ? state : CommunityLoad()
        if shown.value == nil, let userID = account.userID, let instant = client.instantTeam(userID) {
            shown.value = instant.value
            shown.fetchedAt = instant.fetchedAt
        }
        return shown
    }

    var body: some View {
        CommunityPage(refresh: { await load(force: true) }, place: .route(.team)) { layout, proxy in
            content(layout, proxy)
        }
        .communityNavigationTitle(team.map { "Team \($0.number)" } ?? "My team")
        .toolbar {
            if let team, let username = account.profile?.username {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(
                        item: team.inviteURL ?? CommunityInviteLink.signup(ref: username, via: "team-invite"),
                        subject: Text(verbatim: "Join team \(team.number) on LearnFRC"),
                        message: Text(verbatim: "Team \(team.number) is on LearnFRC. Free lessons for every subteam, mechanical through scouting. Join us:")
                    ) {
                        Label("Share invite", systemImage: "square.and.arrow.up")
                    }
                    .help("Share the team invite")
                }
            }
        }
        .communityRefreshButton(isLoading: state.isLoading) { Task { await load(force: true) } }
        // Handoff only while this is the screen on show (ARCHITECTURE 6.6).
        .screenHandoff(.route(.team), url: AppConfig.webBase.appending(path: "teams"),
                       title: "My team on LearnFRC", when: account.isSignedIn)
        .task(id: loadKey) { await load() }
        // A completion, un-completion or a sign-in's guest lessons changed the totals the
        // sheet prints on the server: fetch it again rather than wait out the 30 seconds.
        .onChange(of: progress.progressRevision) { Task { await load(force: true) } }
    }

    @ViewBuilder
    private func content(_ layout: CommunityLayout, _ proxy: ScrollViewProxy) -> some View {
        let state = display
        switch account.state {
        case .loading:
            loadingSheet(layout)
        case .guest:
            CommunitySignInCard(
                slug: "team / sign in",
                title: "Your team's sheet lives in your account.",
                message: "Sign in and add your team number. Everyone who signs up with the same number lands on one sheet: who's on what, how far each of them has got, and which subteams nobody has picked up yet."
            )
            .foldLeadingPage(layout.pages)
            .communityColumn(layout)
            .padding(.top, 28)
        case .signedIn(let me):
            if let payload = state.value {
                if let team = payload.team {
                    if state.isStale {
                        CommunityLoadNote(state: state) { Task { await load(force: true) } }
                            .foldLeadingPage(layout.pages)
                            .communityColumn(layout)
                            .padding(.top, 12)
                    }
                    TeamSheetContent(
                        sheet: CommunityTeamSheet(team: team, catalog: catalog, myUsername: me.profile.username),
                        username: me.profile.username,
                        referralCount: me.referralCount,
                        layout: layout,
                        proxy: proxy
                    )
                } else {
                    TeamNumberMissingCard(subteamCount: catalog.departments.count)
                        .foldLeadingPage(layout.pages)
                        .communityColumn(layout)
                        .padding(.top, 28)
                }
            } else if me.profile.teamNumber == nil && !me.isProvisional && state.hasSettled {
                TeamNumberMissingCard(subteamCount: catalog.departments.count)
                    .foldLeadingPage(layout.pages)
                    .communityColumn(layout)
                    .padding(.top, 28)
            } else if state.error != nil {
                CommunityLoadNote(state: state) { Task { await load(force: true) } }
                    .foldLeadingPage(layout.pages)
                    .communityColumn(layout)
                    .padding(.top, 28)
            } else {
                loadingSheet(layout)
            }
        }
    }

    private func loadingSheet(_ layout: CommunityLayout) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            SkeletonBlock(height: 12, width: 120)
            SkeletonBlock(height: 40, width: 280)
            SkeletonBlock(height: 40, width: 220)
            SkeletonBlock(height: 18)
            SkeletonBlock(height: 18, width: 240)
            SkeletonBlock(height: 160).padding(.top, 20)
        }
        .foldLeadingPage(layout.pages)
        .communityColumn(layout)
        .padding(.top, 28)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading your team")
    }

    private func load(force: Bool = false) async {
        guard let userID = account.userID else {
            state = CommunityLoad()
            stateUserID = nil
            return
        }
        if stateUserID != userID {
            state = CommunityLoad()
            stateUserID = userID
        }
        if state.isLoading { return }
        if state.value == nil {
            if let instant = client.instantTeam(userID) {
                state.restore(instant)
            } else {
                state.restore(await client.cachedTeam(userID))
            }
        }
        if !force, state.error == nil, let at = state.fetchedAt, Date.now.timeIntervalSince(at) < 30 {
            return
        }
        state.begin()
        do {
            let team = try await client.team(userID)
            state.succeed(TeamPayload(team: team))
        } catch {
            if Task.isCancelled { state.isLoading = false } else { state.fail(error) }
        }
    }
}

// MARK: - The figures the sheet prints

/// One subteam (department) line: who from the team is on it and how far the team has got.
struct TeamSubteamLine: Identifiable, Hashable {
    struct Mark: Hashable {
        let username: String
        let avatarURL: URL?
        let completed: Int
        let isYou: Bool
    }

    let slug: String
    let name: String
    let lessonCount: Int
    /// Distinct lessons anyone on the team has finished.
    let teamCompleted: Int
    /// Most lessons first, as the route sends them.
    let crew: [Mark]

    var id: String { slug }
    var label: String { CommunityFormat.subteamLabel(name) }
    var isGap: Bool { crew.isEmpty }
    var isDone: Bool { lessonCount > 0 && teamCompleted >= lessonCount }
    var percent: Int { CommunityFormat.percent(teamCompleted, of: lessonCount) }

    /// Up to four marks, with me floated into the last visible slot when I'm further down.
    var visibleCrew: [Mark] {
        guard let mine = crew.firstIndex(where: \.isYou), mine >= 4 else { return Array(crew.prefix(4)) }
        let others = crew.enumerated().filter { $0.offset != mine }.map(\.element)
        return Array(others.prefix(3)) + [crew[mine]]
    }
}

/// Everything the sheet shows, computed once from the route's team (the same sums as the
/// site's `loadTeamSheet`).
struct CommunityTeamSheet: Hashable {
    let team: Team
    /// Lessons in the catalog.
    let totalLessons: Int
    /// Lessons finished, counting everyone (a lesson two people did counts twice).
    let totalCompleted: Int
    let totalNeeded: Int
    /// 0...100, the average through the catalog.
    let avgPct: Int
    let subteams: [TeamSubteamLine]
    /// Subteams with at least one person on them.
    let claimed: Int
    /// Distinct lessons anyone on the team has finished.
    let lessonsCovered: Int

    var memberCount: Int { team.members.count }
    var isSolo: Bool { team.members.count <= 1 }
    var gaps: [TeamSubteamLine] { subteams.filter(\.isGap) }

    @MainActor
    init(team: Team, catalog: CatalogStore, myUsername: String?) {
        self.init(team: team, catalogLessonCount: catalog.allLessons.count, myUsername: myUsername)
    }

    init(team: Team, catalogLessonCount: Int, myUsername: String?) {
        self.team = team
        let fromCoverage = team.subteamCoverage.reduce(0) { $0 + $1.lessonCount }
        let total = fromCoverage > 0 ? fromCoverage : catalogLessonCount
        totalLessons = total
        let completed = team.members.reduce(0) { $0 + $1.completed }
        totalCompleted = completed
        totalNeeded = team.members.count * total
        avgPct = CommunityFormat.percent(completed, of: team.members.count * total)

        let me = (team.you?.username ?? myUsername)?.lowercased()
        let avatars = Dictionary(team.members.map { ($0.username.lowercased(), $0.avatarURL) }, uniquingKeysWith: { a, _ in a })
        subteams = team.subteamCoverage.map { coverage in
            TeamSubteamLine(
                slug: coverage.slug,
                name: coverage.name,
                lessonCount: coverage.lessonCount,
                teamCompleted: coverage.teamCompleted,
                crew: coverage.members.map { contributor in
                    let name = contributor.username ?? "Member"
                    return TeamSubteamLine.Mark(
                        username: name,
                        avatarURL: avatars[name.lowercased()] ?? nil,
                        completed: contributor.completed,
                        isYou: me != nil && name.lowercased() == me
                    )
                }
            )
        }
        claimed = subteams.filter { !$0.isGap }.count
        lessonsCovered = team.subteamCoverage.reduce(0) { $0 + $1.teamCompleted }
    }
}

// MARK: - The sheet

struct TeamSheetContent: View {
    let sheet: CommunityTeamSheet
    var username: String?
    var referralCount: Int
    let layout: CommunityLayout
    let proxy: ScrollViewProxy

    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var number: Int { sheet.team.number }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            masthead
                .communityColumn(layout)
                .padding(.top, layout.isWide || layout.isSpread ? 36 : 18)

            tallyRow
                .communityColumn(layout)
                .padding(.top, layout.sectionGap)

            if let pages = layout.pages {
                // An open iPhone Duo: the subteams on the left page; the people, their
                // progress and the invite on the right. Nothing sits across the fold.
                FoldPages(pages) {
                    VStack(alignment: .leading, spacing: 0) {
                        if sheet.isSolo, let username {
                            TeamInvitePanel(username: username, teamNumber: number, inviteURL: sheet.team.inviteURL, referralCount: referralCount, solo: true, layout: layout.leadingPage)
                                .padding(.bottom, layout.sectionGap)
                        }
                        coverage(layout.leadingPage)
                            .id("subteams")
                    }
                } trailing: {
                    VStack(alignment: .leading, spacing: 0) {
                        roster(layout.trailingPage)
                        if hasProgress {
                            progressSection(layout.trailingPage)
                                .padding(.top, layout.sectionGap)
                        }
                        if hasClosingInvite {
                            closingInvite(layout.trailingPage)
                                .padding(.top, layout.sectionGap)
                        }
                    }
                }
                .communityColumn(layout)
                .padding(.top, layout.sectionGap)
            } else {
                if sheet.isSolo, let username {
                    TeamInvitePanel(username: username, teamNumber: number, inviteURL: sheet.team.inviteURL, referralCount: referralCount, solo: true, layout: layout)
                        .communityColumn(layout)
                        .padding(.top, layout.sectionGap)
                }

                coverage(layout)
                    .communityColumn(layout)
                    .padding(.top, layout.sectionGap)
                    .id("subteams")

                roster(layout)
                    .communityColumn(layout)
                    .padding(.top, layout.sectionGap)

                if hasProgress {
                    progressSection(layout)
                        .communityColumn(layout)
                        .padding(.top, layout.sectionGap)
                }

                if hasClosingInvite {
                    closingInvite(layout)
                        .communityColumn(layout)
                        .padding(.top, layout.sectionGap)
                }
            }
        }
    }

    /// The four figures; on an open iPhone Duo, two on each page.
    @ViewBuilder
    private var tallyRow: some View {
        if let pages = layout.pages {
            FoldPages(pages) {
                CommunityTally(items: Array(tally.prefix(2)), layout: layout.leadingPage)
            } trailing: {
                CommunityTally(items: Array(tally.dropFirst(2)), layout: layout.trailingPage)
            }
        } else {
            CommunityTally(items: tally, layout: layout)
        }
    }

    /// Each person's progress shows once there's anyone on the roster.
    private var hasProgress: Bool { !sheet.team.members.isEmpty }
    /// The invite at the foot of the sheet (a solo sheet has it at the top instead).
    private var hasClosingInvite: Bool { !sheet.isSolo || username == nil }

    /// Each person's progress, department by department.
    private func progressSection(_ layout: CommunityLayout) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            CommunitySectionHeader("Each person's progress", sub: "How far everyone is in every department. Each little bar is one department; open a name to see where they are and what's next.")
            MemberProgressList(members: sheet.team.members, layout: layout)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func closingInvite(_ layout: CommunityLayout) -> some View {
        if let username {
            TeamInvitePanel(username: username, teamNumber: number, inviteURL: sheet.team.inviteURL, referralCount: referralCount, solo: false, layout: layout)
        } else {
            TeamUnattributedInvite(teamNumber: number)
        }
    }

    // MARK: Masthead

    @ViewBuilder
    private var masthead: some View {
        if let pages = layout.pages {
            // An open iPhone Duo: the masthead on the left page, the pit card on the right.
            FoldPages(pages) {
                mastheadText
            } trailing: {
                TeamCrewPanel(sheet: sheet).padding(.top, 12)
            }
        } else if layout.isWide {
            HStack(alignment: .top, spacing: 48) {
                mastheadText.frame(maxWidth: .infinity, alignment: .leading)
                TeamCrewPanel(sheet: sheet).frame(width: min(400, layout.width * 0.38)).padding(.top, 12)
            }
        } else {
            VStack(alignment: .leading, spacing: 40) {
                mastheadText
                TeamCrewPanel(sheet: sheet)
            }
        }
    }

    private var mastheadText: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("the pit sheet")
            Text(verbatim: "Team \(number), and who is on what.")
                .lfTitle(.h1)
                .frame(maxWidth: 540, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            CommunityLede(sheet.isSolo
                ? "You're the only one from \(number) here so far. Every subteam is ruled out below: what you've covered, and what's still wide open."
                : "Everyone who signed up with team \(number) is on this sheet, with all \(sheet.subteams.count) subteams ruled out so you can see who's covering what and what nobody has picked up.")
                .padding(.top, 18)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { mastheadButtons }
                VStack(alignment: .leading, spacing: 12) { mastheadButtons }
            }
            .padding(.top, 24)
        }
    }

    @ViewBuilder
    private var mastheadButtons: some View {
        Button("Open the guides") { app.selectedTab = .learn }
            .buttonStyle(.ink)
        Button(sheet.gaps.isEmpty ? "See who is on what" : "See what is open") {
            if reduceMotion {
                proxy.scrollTo("subteams", anchor: .top)
            } else {
                withAnimation(LF.Motion.settle) { proxy.scrollTo("subteams", anchor: .top) }
            }
        }
        .buttonStyle(.inkGhost)
    }

    private var tally: [CommunityTally.Item] {
        [
            .init(figure: sheet.memberCount.formatted(), label: sheet.memberCount == 1 ? "member" : "members"),
            .init(figure: "\(sheet.claimed)/\(sheet.subteams.count)", label: "subteams claimed"),
            .init(figure: sheet.totalCompleted.formatted(), label: "lessons finished, counting everyone"),
            .init(figure: "\(sheet.avgPct)%", label: "average through the catalogue"),
        ]
    }

    // MARK: Coverage

    private func coverage(_ layout: CommunityLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            CommunitySectionHeader(
                "Subteam coverage",
                sub: "\(sheet.claimed) of \(sheet.subteams.count) subteams have somebody from \(number) on them" + (sheet.gaps.isEmpty ? ", which is the whole robot covered." : ". The dashed lines are the ones nobody has picked up.")
            ) {
                SlugText("covers \(sheet.lessonsCovered.formatted()) of \(sheet.totalLessons.formatted()) lessons")
            }
            TeamSubteamTicks(lines: sheet.subteams)
                .padding(.top, 22)
            TeamGapCard(sheet: sheet, username: username, layout: layout)
                .padding(.top, 30)
            TeamSubteamBoard(lines: sheet.subteams, layout: layout)
                .padding(.top, 34)
        }
    }

    // MARK: Roster

    private func roster(_ layout: CommunityLayout) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            CommunitySectionHeader(
                sheet.isSolo ? "Where you are at" : "Who is furthest along",
                sub: sheet.isSolo
                    ? "One row, for now. Anyone who signs up with \(number) lands on this sheet automatically, ranked by lessons finished."
                    : "Your own row is washed blue and barred in the margin, so you can find yourself on it at a glance."
            ) {
                SlugText(CommunityFormat.count(sheet.memberCount, "member"))
            }
            if sheet.team.members.isEmpty {
                CommunityEmptyNote("roster / empty", "You're the first one here. Tell your teammates to sign up with team \(number) and they appear on this sheet on their own.")
            } else {
                TeamRosterTable(members: sheet.team.members, totalLessons: sheet.totalLessons, layout: layout)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - The pit card

/// The index card taped above a pit bench: the crew's initials and how far through they are.
struct TeamCrewPanel: View {
    let sheet: CommunityTeamSheet

    var body: some View {
        NotebookCard(tilt: .preset(0), tape: true, padding: 22) {
            SlugText("the pit / team \(sheet.team.number)")
            if sheet.team.members.isEmpty {
                SlugText("nobody signed in yet").padding(.top, 12)
            } else {
                CommunityAvatarStack(
                    sheet.team.members.map { .init(name: $0.username, imageURL: $0.avatarURL, isYou: $0.isYou) },
                    total: max(sheet.team.memberCount, sheet.team.members.count)
                )
                .padding(.top, 14)
                SlugText("\(CommunityFormat.count(max(sheet.team.memberCount, sheet.team.members.count), "member")), one pit")
                    .padding(.top, 10)
            }
            DashedRule().padding(.top, 18)
            SlugText("how far the crew has got").padding(.top, 16)
            CountText("\(sheet.avgPct)%", unit: "done", size: 38)
                .padding(.top, 6)
            CommunityBar(value: Double(sheet.avgPct) / 100, height: 12.8)
                .padding(.top, 10)
            SlugText("\(sheet.totalCompleted.formatted()) of \(sheet.totalNeeded.formatted()) lessons finished between you")
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.4).offset(x: -36, y: 12)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Coverage pieces

/// The whole team's shape in one line: a box per subteam, inked when somebody is on it,
/// dashed when nobody is. Decorative; the figures beside it say the same thing.
struct TeamSubteamTicks: View {
    let lines: [TeamSubteamLine]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(lines) { line in
                Group {
                    if line.isGap {
                        HandShape(.s).strokeBorder(LF.Palette.ink, style: StrokeStyle(lineWidth: LF.Metrics.stroke, dash: [4, 3]))
                    } else {
                        HandShape(.s).fill(LF.Palette.blue)
                            .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
                    }
                }
                .frame(height: 14)
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityHidden(true)
    }
}

/// A chip for something missing: dashed edge, graphite type.
struct CommunityDashedTag: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(LF.Fonts.mono(12, relativeTo: .caption))
            .tracking(0.36)
            .foregroundStyle(LF.Palette.graphite)
            .lineLimit(1)
            .padding(.vertical, 4.5)
            .padding(.horizontal, 9.6)
            .background {
                HandShape(.s).strokeBorder(LF.Palette.ink, style: StrokeStyle(lineWidth: LF.Metrics.stroke, dash: [4, 3]))
            }
    }
}

/// "Nobody's on Electrical": the ask, made specific, in four states, because the same
/// sentence is wrong in three of them.
struct TeamGapCard: View {
    let sheet: CommunityTeamSheet
    var username: String?
    let layout: CommunityLayout

    @Environment(AppModel.self) private var app

    private enum Mood { case fresh, solo, gaps, covered }

    private var mood: Mood {
        if sheet.lessonsCovered == 0 { return .fresh }
        if sheet.gaps.isEmpty { return .covered }
        return sheet.isSolo ? .solo : .gaps
    }

    private var number: Int { sheet.team.number }
    private var gapLabels: [String] { sheet.gaps.map(\.label) }
    private var list: String { CommunityFormat.list(gapLabels) }
    private var link: URL { CommunityInviteLink.signup(ref: username, via: nil) }

    private var marker: String {
        switch mood {
        case .covered: "coverage / complete"
        case .fresh: "coverage / nothing started"
        case .solo, .gaps: "coverage / \(gapLabels.count) open"
        }
    }

    private var heading: String {
        switch mood {
        case .covered: "Every subteam has someone on it"
        case .fresh: "All \(sheet.subteams.count) subteams are still open"
        case .solo: "You're covering \(sheet.claimed) of \(sheet.subteams.count) subteams"
        case .gaps: gapLabels.count == 1 ? "1 subteam has nobody on it" : "\(gapLabels.count) subteams have nobody on them"
        }
    }

    private var message: String {
        let them = gapLabels.count == 1 ? "it" : "them"
        switch mood {
        case .covered:
            return "Team #\(number) has finished \(sheet.lessonsCovered) of \(sheet.totalLessons) lessons between you, and every subteam is claimed. Bring in the rest of the crew to close out what's left."
        case .fresh:
            return "Claim the one you actually work on, then send this link to the rest of the crew so they can take theirs. Every lesson is free, and you both get +25 XP once they join."
        case .solo:
            return "Nothing from #\(number) has touched \(list) yet. Send this to whoever runs \(them): every lesson is free, and you both get +25 XP once they join."
        case .gaps:
            return "Nobody on team #\(number) has started \(list). Send this to whoever runs \(them): every lesson is free, and you both get +25 XP once they join."
        }
    }

    private var shareText: String {
        switch mood {
        case .covered: "Team \(number) has all \(sheet.subteams.count) subteams going on LearnFRC, and every lesson is free. Join us:"
        case .fresh: "Team \(number) is getting on LearnFRC. Free lessons for every subteam, mechanical through scouting. Grab yours:"
        case .solo, .gaps: "Nobody on team \(number) has \(list) covered on LearnFRC yet. It's free and I'm already on it. Claim your subteam:"
        }
    }

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: 22) {
            if layout.isWide {
                HStack(alignment: .center, spacing: 32) {
                    text.frame(maxWidth: .infinity, alignment: .leading)
                    actions
                }
            } else {
                text
                actions.padding(.top, 18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var text: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(marker)
            Text(heading)
                .lfTitle(.h3)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            CommunitySub(message, size: 15.5)
                .padding(.top, 8)
            if !gapLabels.isEmpty {
                CommunityFlowLayout(spacing: 6, lineSpacing: 6) {
                    ForEach(gapLabels, id: \.self) { CommunityDashedTag($0) }
                }
                .padding(.top, 14)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Open subteams: \(gapLabels.joined(separator: ", "))")
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            if mood == .fresh {
                Button("Pick a subteam") { app.selectedTab = .learn }
                    .buttonStyle(.inkGhostSmall)
            }
            ShareLink(item: link, subject: Text(verbatim: "LearnFRC, for team \(number)"), message: Text(shareText)) {
                Label(mood == .solo || mood == .gaps ? "Ask them" : "Invite the crew", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.ink)
        }
    }
}

/// Every subteam as a ruled line: who signed it and how far the team has got. The empty
/// lines fall out of the page in one pass, which is the whole job.
struct TeamSubteamBoard: View {
    let lines: [TeamSubteamLine]
    let layout: CommunityLayout

    @Environment(CatalogStore.self) private var catalog
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            ForEach(lines) { line in
                if let department = catalog.department(slug: line.slug) {
                    NavigationLink(value: AppRoute.department(department.id)) { row(line) }
                        .buttonStyle(.inkRow)
                        .accessibilityHint("Opens the department")
                } else {
                    row(line)
                }
                DashedRule()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Subteam coverage across your team")
    }

    @ViewBuilder
    private func row(_ line: TeamSubteamLine) -> some View {
        Group {
            if layout.isRegular && !dynamicTypeSize.isAccessibilitySize {
                HStack(alignment: .center, spacing: 20) {
                    title(line).frame(maxWidth: .infinity, alignment: .leading)
                    crew(line).frame(width: 150, alignment: .leading)
                    meter(line).frame(width: 160)
                }
            } else if dynamicTypeSize.isAccessibilitySize {
                // The name gets the whole line, so "Mechanical" never breaks mid-word.
                VStack(alignment: .leading, spacing: 10) {
                    title(line)
                    crew(line)
                    meter(line)
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .center, spacing: 12) {
                        title(line).frame(maxWidth: .infinity, alignment: .leading)
                        crew(line)
                    }
                    meter(line)
                }
            }
        }
        .padding(.vertical, 14)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(line.isGap
            ? "\(line.label), nobody on your team has started it, 0 of \(line.lessonCount) lessons"
            : "\(line.label), your team has finished \(line.teamCompleted) of \(line.lessonCount) lessons, \(CommunityFormat.count(line.crew.count, "person", "people")) on it")
    }

    private func title(_ line: TeamSubteamLine) -> some View {
        let ax = dynamicTypeSize.isAccessibilitySize
        return VStack(alignment: .leading, spacing: 4) {
            // One line at the standard sizes; from xxxLarge the longest slugs wrap whole.
            SlugText("sub / \(line.slug)")
                .lineLimit(dynamicTypeSize >= .xxxLarge ? nil : 1)
                .fixedSize(horizontal: false, vertical: true)
            Text(line.label)
                .lfTitle(.h3)
                .lineLimit(ax ? nil : 2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private func crew(_ line: TeamSubteamLine) -> some View {
        if line.isGap {
            CommunityDashedTag("nobody yet")
        } else {
            CommunityAvatarStack(
                line.visibleCrew.map { .init(name: $0.username, imageURL: $0.avatarURL, isYou: $0.isYou) },
                total: line.crew.count,
                limit: 4,
                size: 32
            )
        }
    }

    private func meter(_ line: TeamSubteamLine) -> some View {
        MeterView(
            value: Double(line.percent) / 100,
            label: line.isDone ? "all done" : "lessons",
            valueText: "\(line.teamCompleted)/\(line.lessonCount)",
            style: .slim
        )
    }
}

// MARK: - Roster

/// The roster as a ruled table: names down one side, figures across. Nobody gets a crown;
/// rank one is labelled "lead" in the same mono as everything else.
struct TeamRosterTable: View {
    let members: [TeamMember]
    let totalLessons: Int
    let layout: CommunityLayout

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var unit: CGFloat = 1

    var body: some View {
        let ax = CommunityTableStyle.stacks(dynamicTypeSize, layout)
        VStack(alignment: .leading, spacing: 0) {
            CommunityTableCaption("ranked by lessons finished")
            if ax {
                InkRule()
            } else {
                CommunityTableHeader {
                    Text("no.").frame(width: 34 * unit, alignment: .leading)
                    Text("member").frame(maxWidth: .infinity, alignment: .leading)
                    Text("lessons").frame(width: lessonsWidth, alignment: .leading)
                    if layout.isRegular { Text("xp").frame(width: 64 * unit, alignment: .trailing) }
                }
            }
            ForEach(Array(members.enumerated()), id: \.element.id) { index, member in
                CommunityProfileLink(username: member.username, style: .row) {
                    row(member, index: index, ax: ax)
                }
                DashedRule()
            }
        }
    }

    private var lessonsWidth: CGFloat { (layout.isRegular ? 176 : 128) * min(unit, 1.3) }

    private func row(_ member: TeamMember, index: Int, ax: Bool) -> some View {
        let lead = index == 0 && member.completed > 0
        let fraction = totalLessons > 0 ? Double(member.completed) / Double(totalLessons) : 0
        return Group {
            if ax {
                VStack(alignment: .leading, spacing: 8) {
                    // Number and name over two lines at most: a username too long for a
                    // line shrinks to fit instead of breaking mid-word.
                    Text(verbatim: "\(index + 1). \(member.username)")
                        .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                        .lineLimit(2)
                        .minimumScaleFactor(0.5)
                        .fixedSize(horizontal: false, vertical: true)
                    tags(member, lead: lead)
                    MeterView(value: fraction, label: "done", valueText: "\(member.completed)/\(totalLessons)", style: .slim)
                    SlugText("\(member.xp.formatted()) xp", color: LF.Palette.ink, weight: .bold)
                }
                .padding(.vertical, 12)
            } else {
                HStack(spacing: 12) {
                    Text(verbatim: "\(index + 1)")
                        .font(LF.Fonts.mono(13, relativeTo: .caption))
                        .monospacedDigit()
                        .frame(width: 34 * unit - (member.isYou ? 9 : 0), alignment: .leading)
                    CommunityAvatar(name: member.username, imageURL: member.avatarURL, isYou: member.isYou, size: 36)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(member.username)
                            .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                            .underline(color: LF.Palette.rule)
                            .lineLimit(1)
                        tags(member, lead: lead)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    MeterView(value: fraction, label: "done", valueText: "\(member.completed)/\(totalLessons)", style: .slim)
                        .frame(width: lessonsWidth)
                    if layout.isRegular { CommunityFigureCell(member.xp.formatted(), width: 64, bold: true) }
                }
                .padding(.vertical, 10)
            }
        }
        .foregroundStyle(LF.Palette.ink)
        .communityOwnRow(member.isYou)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Number \(index + 1), \(member.username)\(member.isYou ? ", you" : "")\(lead ? ", lead" : ""), \(member.completed) of \(totalLessons) lessons, \(member.xp.formatted()) XP")
    }

    @ViewBuilder
    private func tags(_ member: TeamMember, lead: Bool) -> some View {
        if member.isYou || lead {
            HStack(spacing: 6) {
                if member.isYou { TagView("you", on: true) }
                if lead { TagView("lead") }
            }
        }
    }
}

// MARK: - No team number yet

/// One card and one thing to fill in. Nothing is faked: no empty roster, no zeroed figures.
struct TeamNumberMissingCard: View {
    var subteamCount: Int

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: 26) {
            SectionLabel("team / not set")
            Text("Put your team number on your profile.")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            CommunityLede("It's the one you already use at every event, and it's the only setup this page has. Everyone who signs up with the same number lands on the same sheet: no codes, no invites to accept, no admin.")
                .padding(.top, 16)
            DashedRule().padding(.top, 20)
            VStack(alignment: .leading, spacing: 8) {
                bullet("who on your team is here, and how far each of them has got")
                bullet(subteamCount > 0 ? "which of the \(subteamCount) subteams nobody has picked up yet" : "which subteams nobody has picked up yet")
                bullet("one link and one QR code for pulling the rest of them in")
            }
            .padding(.top, 18)
            AccountSettingsLink("Add your team number")
                .buttonStyle(.ink)
                .padding(.top, 24)
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.8).offset(x: -48, y: 12)
        }
        .frame(maxWidth: 700, alignment: .leading)
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("-")
                .font(LF.Fonts.body(16, weight: .bold))
                .foregroundStyle(LF.Palette.blue)
                .accessibilityHidden(true)
            Text(text)
                .lfProse(15.5, lineHeight: 1.45, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Invites

/// "Get your team on here": the link written out, the share sheet, and a QR code for the room.
/// All three hand out the same URL, so a signup from any of them credits the same person.
struct TeamInvitePanel: View {
    let username: String
    let teamNumber: Int
    var inviteURL: URL?
    var referralCount: Int
    var solo: Bool
    let layout: CommunityLayout

    private var link: URL { inviteURL ?? CommunityInviteLink.signup(ref: username, via: "team-invite") }

    var body: some View {
        NotebookCard(padding: 24) {
            if layout.isRegular {
                HStack(alignment: .top, spacing: 36) {
                    text.frame(maxWidth: .infinity, alignment: .leading)
                    CommunityQRCode(url: link).padding(.top, 10)
                }
            } else {
                text
                CommunityQRCode(url: link)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 26)
            }
        }
    }

    private var text: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                SectionLabel(solo ? "invite / one link, one code" : "invite / free for your team")
                if referralCount > 0 {
                    SlugText("\(referralCount) joined so far", color: LF.Palette.ink)
                }
            }
            Text(verbatim: solo ? "Bring the rest of #\(teamNumber) in" : "Invite the rest of the crew")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            CommunitySub(message, size: 16)
                .padding(.top, 10)
            CommunityCopyLink(url: link)
                .padding(.top, 18)
            ShareLink(
                item: link,
                subject: Text(verbatim: "Join team \(teamNumber) on LearnFRC"),
                message: Text(verbatim: "Team \(teamNumber) is on LearnFRC. Free lessons for every subteam, mechanical through scouting. Join us:")
            ) {
                Label(solo ? "Send the link" : "Share invite", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.ink)
            .padding(.top, 14)
        }
    }

    private var message: String {
        if solo {
            return "Right now you're the only one from #\(teamNumber) here, so this link is the whole job. Drop it in the team chat, or put the code on the projector at your next meeting and the room signs up in one go. Every lesson is free, and you both get +25 XP once they confirm their email."
        }
        let joined = referralCount > 0
            ? " \(referralCount) \(referralCount == 1 ? "teammate has" : "teammates have") joined through you."
            : ""
        return "Send this to someone on #\(teamNumber). They get every lesson on LearnFRC, free, and land on the roster automatically.\(joined) You both get +25 XP once they confirm their email."
    }
}

/// For an account with no username yet: a plain signup link credits nobody, so no QR.
struct TeamUnattributedInvite: View {
    let teamNumber: Int

    var body: some View {
        NotebookCard(padding: 24) {
            SectionLabel("invite / free for your team")
            Text("Grow the crew")
                .lfTitle(.h2)
                .padding(.top, 10)
            CommunitySub("Anyone who signs up with team \(teamNumber) joins this sheet on their own: no codes, no setup. Pick a username and the link starts crediting you the +25 XP too.", size: 16)
                .padding(.top, 10)
            HStack(spacing: 10) {
                ShareLink(
                    item: CommunityInviteLink.signup(ref: nil, via: nil),
                    message: Text(verbatim: "Join our FRC team on LearnFRC. Sign up with team \(teamNumber) and we can track each other's progress and learn together:")
                ) {
                    Label("Share invite", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.ink)
                AccountSettingsLink("Pick a username")
                    .buttonStyle(.inkGhost)
            }
            .padding(.top, 18)
        }
    }
}

// MARK: - Flow layout

/// Wraps chips onto as many lines as they need. A chip wider than the whole line is
/// offered the line's width, so it never runs past the edge.
struct CommunityFlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, widest: CGFloat = 0
        for subview in subviews {
            let size = fittedSize(of: subview, width: width)
            if x > 0, x + size.width > width {
                y += lineHeight + lineSpacing
                x = 0
                lineHeight = 0
            }
            x += size.width + spacing
            widest = max(widest, x - spacing)
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: min(widest, width), height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for subview in subviews {
            let size = fittedSize(of: subview, width: bounds.width)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += lineHeight + lineSpacing
                x = bounds.minX
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }

    private func fittedSize(of subview: LayoutSubview, width: CGFloat) -> CGSize {
        let ideal = subview.sizeThatFits(.unspecified)
        guard ideal.width > width, width.isFinite else { return ideal }
        return subview.sizeThatFits(ProposedViewSize(width: width, height: nil))
    }
}

// MARK: - Previews

#Preview("Team, iPhone", traits: .fixedLayout(width: 393, height: 1500)) {
    CommunityPreviewHost { TeamView() }
    .environment(\.colorScheme, .light)
}

#Preview("Team, iPhone, dark", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost { TeamView() }
        .environment(\.colorScheme, .dark)
}

#Preview("Team, iPad", traits: .fixedLayout(width: 1180, height: 1500)) {
    CommunityPreviewHost { TeamView() }
    .environment(\.colorScheme, .light)
}

#Preview("Team, iPad, dark, solo", traits: .fixedLayout(width: 834, height: 1500)) {
    CommunityPreviewHost(client: .previewing(team: PreviewCommunity.soloTeam)) { TeamView() }
        .environment(\.colorScheme, .dark)
}

#Preview("No team number", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost(client: .previewing(team: nil)) { TeamView() }
    .environment(\.colorScheme, .light)
}

#Preview("Guest", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost(model: .preview(signedIn: false)) { TeamView() }
    .environment(\.colorScheme, .light)
}

#Preview("Team, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 2600)) {
    CommunityPreviewHost { TeamView() }
        .previewFold(.previewBook)
        .environment(\.colorScheme, .light)
}

#Preview("Team, iPhone Duo open, solo, night", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 2200)) {
    CommunityPreviewHost(client: .previewing(team: PreviewCommunity.soloTeam)) { TeamView() }
        .previewFold(.previewFlat)
        .environment(\.colorScheme, .dark)
}
