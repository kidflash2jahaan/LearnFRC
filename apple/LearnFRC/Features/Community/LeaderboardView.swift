import SwiftUI

/// The standings (the site's `/leaderboard`): the all-time top three taped up beside the
/// masthead, the site totals on the blue band, then the full board three ways (the last seven
/// days, all time, by team). Usernames only; your own row is washed blue and barred.
struct LeaderboardView: View {
    /// The three ways to read the board.
    enum Board: String, Hashable, CaseIterable, Sendable {
        case week, allTime, teams

        var source: LeaderboardBoard {
            switch self {
            case .week: .weekly
            case .allTime: .alltime
            case .teams: .teams
            }
        }

        var title: String {
            switch self {
            case .week: "this week"
            case .allTime: "all time"
            case .teams: "by team"
            }
        }
    }

    enum TeamRanking: Hashable, Sendable { case total, perMember }

    @Environment(\.communityClient) private var client
    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var app
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab

    /// The board and the team ranking picked on this copy of the page. Nil until the person
    /// picks, when the page reads what its window kept for it in this tab (the Mac builds the
    /// tab again on every switch, ARCHITECTURE 6.6) or the board it was opened on.
    @State private var pickedBoard: Board?
    @State private var pickedRanking: TeamRanking?
    @State private var sheets: [LeaderboardBoard: CommunityLoad<BoardSheet>] = [:]
    /// The tab the page appeared in, for when the environment doesn't say (a leaderboard
    /// pushed on the Mac doesn't see its stack's `\.navigationTab`).
    @State private var appearedTab: AppTab?
    private let openingBoard: Board

    init(board: Board = .week) {
        openingBoard = board
    }

    /// This page's corner of the window's memory, in the tab it sits in.
    private var kept: ScreenPlaceMemory? { ScreenPlaceMemory(.route(.leaderboard), navigation: navigation, tab: tab ?? appearedTab) }
    private static let boardThing = "leaderboard.board"
    private static let rankingThing = "leaderboard.ranking"

    private var board: Board { pickedBoard ?? kept?.value(Board.self, for: Self.boardThing) ?? openingBoard }
    private var teamRanking: TeamRanking { pickedRanking ?? kept?.value(TeamRanking.self, for: Self.rankingThing) ?? .total }

    private var boardSelection: Binding<Board> {
        Binding(get: { board }, set: { picked in
            pickedBoard = picked
            kept?.set(picked, for: Self.boardThing)
        })
    }

    private var rankingSelection: Binding<TeamRanking> {
        Binding(get: { teamRanking }, set: { picked in
            pickedRanking = picked
            kept?.set(picked, for: Self.rankingThing)
        })
    }

    private var myUsername: String? { account.profile?.username?.lowercased() }
    private var myTeam: Int? { account.profile?.teamNumber }
    private var allTime: CommunityLoad<BoardSheet> { display(.alltime) }
    private var current: CommunityLoad<BoardSheet> { display(board.source) }
    private var totals: BoardTotals? {
        allTime.value?.totals ?? current.value?.totals
    }

    /// The board as it stands, falling back to what this session already fetched, so the
    /// first frame shows the standings instead of a placeholder.
    private func display(_ source: LeaderboardBoard) -> CommunityLoad<BoardSheet> {
        var state = sheets[source] ?? CommunityLoad()
        if state.value == nil, let instant = client.instantBoard(source) {
            state.value = instant.value
            state.fetchedAt = instant.fetchedAt
        }
        return state
    }
    private var isLoading: Bool { sheets.values.contains(where: \.isLoading) }

    var body: some View {
        CommunityPage(refresh: { await reload() }, place: .route(.leaderboard)) { layout, _ in
            masthead(layout)
                .communityColumn(layout)
                .padding(.top, layout.isWide ? 36 : 18)

            if let totals {
                LeaderboardTotalsBand(totals: totals, layout: layout)
                    .padding(.top, layout.sectionGap)
            }

            VStack(alignment: .leading, spacing: 0) {
                if let username = account.profile?.username, !(account.me?.isProvisional ?? true) {
                    LeaderboardInviteCard(username: username, referralCount: account.me?.referralCount ?? 0)
                        .padding(.bottom, layout.sectionGap)
                }
                CommunitySectionHeader(
                    "The full board",
                    sub: "Three ways to read it: the last seven days, everything ever earned, and the team standing. Your own row is washed blue and barred in the margin wherever you land."
                ) {
                    MarkerText("the weekly one is the winnable one", angle: 1.4)
                        .frame(maxWidth: 220, alignment: .leading)
                }

                // A group named once; each tab keeps its own name and selected state.
                InkTabStrip(selection: boardSelection, tabs: Board.allCases.map { (value: $0, title: $0.title) })
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("Leaderboard views")
                    .padding(.top, 22)

                // Full column width, so its right edge lines up with the cards and rules around it.
                boardBody(layout)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 22)

                xpNote
                    .padding(.top, layout.sectionGap)
            }
            .communityColumn(layout)
            .padding(.top, layout.sectionGap)
        }
        .communityNavigationTitle("Leaderboard")
        // Handoff only while this is the screen on show (ARCHITECTURE 6.6): Community's
        // first screen sits under every profile opened from it.
        .screenHandoff(.route(.leaderboard), url: AppConfig.webBase.appending(path: "leaderboard"),
                       title: "LearnFRC leaderboard")
        .communityRefreshButton(isLoading: isLoading) { Task { await reload() } }
        .task { await load(.alltime) }
        .task(id: board) { await load(board.source) }
        // On the Mac only the selected tab's stack is built, so that's the one it's in.
        .onAppear { if tab == nil, appearedTab == nil { appearedTab = navigation?.selectedTab } }
        // Gone back from (a copy pushed in another tab): the next visit opens on this week.
        .onDisappear { kept?.forgetIfLeft(Self.boardThing, Self.rankingThing) }
    }

    // MARK: Masthead

    @ViewBuilder
    private func masthead(_ layout: CommunityLayout) -> some View {
        if layout.isWide {
            HStack(alignment: .top, spacing: 48) {
                mastheadText
                    .frame(maxWidth: .infinity, alignment: .leading)
                standing
                    .frame(width: min(432, layout.width * 0.4))
                    .padding(.top, 12)
            }
        } else {
            VStack(alignment: .leading, spacing: 40) {
                mastheadText
                standing
            }
        }
    }

    private var mastheadText: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("the standings")
            Text("Every lesson you finish moves you up this page.")
                .lfTitle(.h1)
                .frame(maxWidth: 560, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            CommunityLede("One hundred XP a level, a race over the last seven days, and a team board so the whole pit can climb together. Reading is free and always was; the ranking is just the part that makes people finish.")
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
        if account.isGuest {
            Button("Make a free account") { app.selectedTab = .profile }
                .buttonStyle(.inkGhost)
        }
    }

    @ViewBuilder
    private var standing: some View {
        if let sheet = allTime.value {
            if sheet.learners.isEmpty {
                NotebookCard(tilt: .preset(0), tape: true, padding: 22) {
                    SectionLabel("standings / empty")
                    Text("Nobody is on the board yet")
                        .lfTitle(.h3)
                        .padding(.top, 10)
                    CommunitySub("Finish one lesson and the top of this page has your name on it, which is a sentence that stops being true fairly quickly.", size: 15)
                        .padding(.top, 8)
                    Button("Read lesson one") { app.selectedTab = .learn }
                        .buttonStyle(.ink)
                        .padding(.top, 16)
                }
            } else {
                LeaderboardChampionPanel(top: Array(sheet.learners.prefix(3)), myUsername: myUsername)
            }
        } else if allTime.error != nil {
            CommunityLoadNote(state: allTime) { Task { await load(.alltime, force: true) } }
        } else {
            NotebookCard(tilt: .preset(1), tape: true, padding: 22) {
                SectionLabel("standings / all time")
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(0..<3, id: \.self) { _ in
                        HStack(spacing: 12) {
                            SkeletonBlock(height: 40, width: 40)
                            VStack(alignment: .leading, spacing: 6) {
                                SkeletonBlock(height: 16, width: 140)
                                SkeletonBlock(height: 10, width: 90)
                            }
                        }
                    }
                }
                .padding(.top, 6)
            }
            .accessibilityLabel("Loading the standings")
        }
    }

    // MARK: Board

    @ViewBuilder
    private func boardBody(_ layout: CommunityLayout) -> some View {
        let state = current
        VStack(alignment: .leading, spacing: 18) {
            if state.isStale {
                CommunityLoadNote(state: state) { Task { await load(board.source, force: true) } }
            }
            if let sheet = state.value {
                switch board {
                case .teams:
                    LeaderboardTeamBoard(sheet: sheet, ranking: rankingSelection, myTeam: myTeam, isSignedIn: account.isSignedIn, layout: layout)
                case .week, .allTime:
                    LeaderboardLearnerBoard(sheet: sheet, isWeekly: board == .week, myUsername: myUsername, layout: layout)
                }
            } else if state.error != nil {
                CommunityLoadNote(state: state) { Task { await load(board.source, force: true) } }
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(0..<6, id: \.self) { index in
                        SkeletonBlock(height: 22, width: index == 0 ? 200 : nil)
                    }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Loading the board")
            }
        }
    }

    private var xpNote: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            NoteCallout {
                SlugText("how xp works")
                Text("Finish a lesson and pass its quiz to earn XP, plus 25 for each teammate who joins through your link. Nothing on this board is for sale. Pick a department and start with whichever one your team is worst at.")
                    .lfProse(16, lineHeight: 1.45)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Pick a department") { app.selectedTab = .learn }
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 6)
            }
            .frame(maxWidth: 740, alignment: .leading)
            .padding(.top, 28)
        }
    }

    // MARK: Loading

    private func load(_ source: LeaderboardBoard, force: Bool = false) async {
        if sheets[source]?.isLoading == true { return }
        if sheets[source]?.value == nil {
            if let instant = client.instantBoard(source) {
                sheets[source, default: CommunityLoad()].restore(instant)
            } else {
                let saved = await client.cachedBoard(source)
                sheets[source, default: CommunityLoad()].restore(saved)
            }
        }
        if !force, let state = sheets[source], state.error == nil,
           let fetchedAt = state.fetchedAt, Date.now.timeIntervalSince(fetchedAt) < 60 {
            return
        }
        sheets[source, default: CommunityLoad()].begin()
        do {
            let sheet = try await client.board(source)
            sheets[source, default: CommunityLoad()].succeed(sheet)
        } catch {
            if Task.isCancelled {
                sheets[source]?.isLoading = false
            } else {
                sheets[source, default: CommunityLoad()].fail(error)
            }
        }
    }

    private func reload() async {
        async let standings: Void = load(.alltime, force: true)
        if board.source != .alltime {
            await load(board.source, force: true)
        }
        await standings
    }
}

// MARK: - The all-time top three, taped up

/// The slip of paper a scorekeeper pins to the wall: three ruled lines, each bar measured
/// against first place so the gap reads at a glance, and each with its own figure.
struct LeaderboardChampionPanel: View {
    let top: [BoardLearner]
    var myUsername: String?

    var body: some View {
        let leader = max(1, top.first?.xp ?? 1)
        NotebookCard(tilt: .preset(1), tape: true, padding: 22) {
            SectionLabel("standings / all time")
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(top.enumerated()), id: \.element.id) { index, entry in
                    if index > 0 { DashedRule().padding(.vertical, 14) }
                    CommunityProfileLink(username: entry.username) {
                        row(entry, first: index == 0, fraction: Double(entry.xp) / Double(leader))
                    }
                }
            }
            .padding(.top, 4)
            DashedRule().padding(.top, 16)
            SlugText("bars are measured against first place")
                .padding(.top, 12)
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.6).offset(x: -40, y: 12)
        }
    }

    private func row(_ entry: BoardLearner, first: Bool, fraction: Double) -> some View {
        let isYou = entry.username?.lowercased() == myUsername && myUsername != nil
        return VStack(alignment: .leading, spacing: 9) {
            // The whole name and team line, always: beside the figure when they fit, with
            // the figure moved under them when they don't (a phone, a long handle), and at
            // the largest text sizes under the rank and avatar, so the name gets the full
            // width instead of breaking mid-word. The figure never breaks.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    rank(entry)
                    CommunityAvatar(name: entry.displayName, imageURL: entry.avatarURL, isYou: isYou, size: first ? 48 : 36)
                    nameBlock(entry, first: first, isYou: isYou)
                        .fixedSize()
                    Spacer(minLength: 10)
                    CountText(entry.xp, unit: "xp", size: first ? 24 : 17)
                        .fixedSize()
                }
                HStack(alignment: .top, spacing: 12) {
                    rank(entry)
                        .padding(.top, first ? 16 : 10)
                    CommunityAvatar(name: entry.displayName, imageURL: entry.avatarURL, isYou: isYou, size: first ? 48 : 36)
                    VStack(alignment: .leading, spacing: 6) {
                        nameBlock(entry, first: first, isYou: isYou)
                            .fixedSize()
                        CountText(entry.xp, unit: "xp", size: first ? 24 : 17)
                            .fixedSize()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 12) {
                        rank(entry)
                        CommunityAvatar(name: entry.displayName, imageURL: entry.avatarURL, isYou: isYou, size: first ? 48 : 36)
                    }
                    nameBlock(entry, first: first, isYou: isYou)
                    CountText(entry.xp, unit: "xp", size: first ? 24 : 17)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            CommunityBar(value: fraction)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rank \(entry.rank), \(entry.displayName)\(isYou ? ", you" : ""), \(entry.detailSlug), \(entry.xp.formatted()) XP")
    }

    private func rank(_ entry: BoardLearner) -> some View {
        Text(String(format: "%02d", entry.rank))
            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
            .foregroundStyle(LF.Palette.ink)
    }

    private func nameBlock(_ entry: BoardLearner, first: Bool, isYou: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Text(entry.displayName)
                    .font(LF.Fonts.body(first ? 19 : 16, weight: first ? .heavy : .bold, relativeTo: .headline))
                    .tracking(-0.3)
                    .foregroundStyle(LF.Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                if isYou { TagView("you", on: true) }
            }
            SlugText(entry.detailSlug)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A trough and its blue bar, no figure (the figure is printed next to it by the caller).
struct CommunityBar: View {
    let value: Double
    var height: CGFloat = 8.8
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let fraction = value.isFinite ? min(max(value, 0), 1) : 0
        GeometryReader { proxy in
            Rectangle()
                .fill(LF.Palette.blue)
                .frame(width: proxy.size.width * fraction)
                .frame(maxWidth: .infinity, alignment: .leading)
                .animation(reduceMotion ? nil : LF.Motion.draw, value: fraction)
        }
        .frame(height: height)
        .background(LF.Palette.paper)
        .clipShape(HandShape(.s))
        .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
        .accessibilityHidden(true)
    }
}

/// Wraps a label in a link to someone's public profile when they have a username.
struct CommunityProfileLink<Label: View>: View {
    let username: String?
    var style: Style = .plain
    @ViewBuilder var label: Label

    enum Style { case plain, row, card }

    init(username: String?, style: Style = .plain, @ViewBuilder label: () -> Label) {
        self.username = username
        self.style = style
        self.label = label()
    }

    var body: some View {
        if let username {
            switch style {
            case .plain:
                NavigationLink(value: AppRoute.profile(username)) { label }
                    .buttonStyle(.plain)
                    .accessibilityHint("Opens their profile")
            case .row:
                NavigationLink(value: AppRoute.profile(username)) { label }
                    .buttonStyle(.inkRow)
                    .accessibilityHint("Opens their profile")
            case .card:
                NavigationLink(value: AppRoute.profile(username)) { label }
                    .buttonStyle(.notebookCard)
                    .accessibilityHint("Opens their profile")
            }
        } else {
            label
        }
    }
}

// MARK: - The totals band

/// The one inverted surface on the page: the site's totals, big enough to read across the shop.
struct LeaderboardTotalsBand: View {
    let totals: BoardTotals
    let layout: CommunityLayout

    var body: some View {
        Group {
            if layout.isWide {
                HStack(alignment: .bottom, spacing: 40) {
                    heading.frame(maxWidth: .infinity, alignment: .leading)
                    figures.frame(maxWidth: 480)
                }
            } else {
                VStack(alignment: .leading, spacing: 28) {
                    heading
                    figures
                }
            }
        }
        .communityColumn(layout)
        .padding(.vertical, layout.isWide ? 48 : 34)
        .frame(maxWidth: .infinity)
        .communityBand()
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nobody was paid to be here.")
                .lfTitle(.h2, color: LF.Palette.onBlue)
                .fixedSize(horizontal: false, vertical: true)
            Text("No marketing budget and no sales calls. Every account on this board found the site, then dragged their team onto it.")
                .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.onBlue.opacity(0.85))
                .frame(maxWidth: 420, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var figures: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 28) { figureCells }
            VStack(alignment: .leading, spacing: 22) { figureCells }
        }
    }

    @ViewBuilder
    private var figureCells: some View {
        CommunitySlabFigure(totals.learners.formatted(), caption: totals.learners == 1 ? "learner who has earned xp" : "learners who have earned xp", size: layout.isWide ? 52 : 42)
        CommunitySlabFigure(totals.totalXp.formatted(), caption: "xp earned", size: layout.isWide ? 52 : 42)
    }
}

// MARK: - The invite card

/// The thin referral ask: one line, one link. The full invite (with a QR) lives on the team page.
struct LeaderboardInviteCard: View {
    let username: String
    let referralCount: Int

    private var link: URL { CommunityInviteLink.signup(ref: username, via: "leaderboard") }

    var body: some View {
        NotebookCard(padding: 22) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .bottom, spacing: 24) {
                    titleBlock
                    Spacer(minLength: 0)
                    joined
                }
                VStack(alignment: .leading, spacing: 10) {
                    titleBlock
                    joined
                }
            }
            CommunitySub("Send this to someone on your team. They get every lesson on LearnFRC, free, and you both get +25 XP once they confirm their email.", size: 15.5)
                .padding(.top, 10)
            CommunityCopyLink(url: link, label: "Referral link")
                .padding(.top, 16)
            ShareLink(
                item: link,
                subject: Text("Join me on LearnFRC"),
                message: Text("Learn every part of FRC, free. Join me on LearnFRC:")
            ) {
                Label("Share it", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.ink)
            .padding(.top, 14)
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel("invite / free for your team")
            Text("A board is better with your team on it")
                .lfTitle(.h3)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var joined: some View {
        if referralCount > 0 {
            CountText(referralCount, unit: "joined", size: 22)
                .accessibilityLabel("\(referralCount) joined through your link")
        }
    }
}

// MARK: - Learner boards

/// The weekly or all-time board: three plinths, then ranks four and down as a ruled table.
struct LeaderboardLearnerBoard: View {
    let sheet: BoardSheet
    let isWeekly: Bool
    var myUsername: String?
    let layout: CommunityLayout

    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var unit: CGFloat = 1

    private func isYou(_ entry: BoardLearner) -> Bool {
        guard let myUsername, let name = entry.username?.lowercased() else { return false }
        return name == myUsername
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if sheet.learners.isEmpty {
                CommunityEmptyNote(
                    "board / empty",
                    isWeekly
                        ? "Nobody has earned XP in the last seven days yet. Finish one lesson and the top of this board is yours."
                        : "No learners on the board yet."
                ) {
                    Button("Read lesson one") { app.selectedTab = .learn }
                        .buttonStyle(.inkGhostSmall)
                }
            } else {
                CommunitySub(isWeekly
                    ? "Ranked by XP earned in the last seven days, so a week of work beats a year of it."
                    : "Ranked by every point of XP earned since the account was made.")
                podium
                    .padding(.top, layout.isRegular ? 48 : 28)
                let rest = Array(sheet.learners.dropFirst(3))
                if !rest.isEmpty {
                    table(rest)
                        .padding(.top, 36)
                }
            }
        }
    }

    // MARK: Podium

    @ViewBuilder
    private var podium: some View {
        let top = Array(sheet.learners.prefix(3))
        if layout.isRegular && !dynamicTypeSize.isAccessibilitySize {
            // Rank one stands in the middle, higher. VoiceOver still reads them in rank order.
            let order = [1, 0, 2].filter { $0 < top.count }
            HStack(alignment: .bottom, spacing: 16) {
                ForEach(order, id: \.self) { index in
                    plinth(top[index], index: index)
                        .padding(.bottom, index == 0 ? 28 : 0)
                        .accessibilitySortPriority(Double(3 - index))
                }
            }
            .accessibilityElement(children: .contain)
            .frame(maxWidth: .infinity)
        } else {
            VStack(spacing: 26) {
                ForEach(Array(top.enumerated()), id: \.element.id) { index, entry in
                    plinth(entry, index: index)
                }
            }
        }
    }

    private func plinth(_ entry: BoardLearner, index: Int) -> some View {
        let first = entry.rank == 1
        let you = isYou(entry)
        let tilts: [Double] = [-0.45, -1.1, 0.9]
        return CommunityProfileLink(username: entry.username, style: .card) {
            NotebookCard(tilt: .degrees(tilts[index % 3]), tape: true, lift: true, padding: 18, alignment: .center) {
                SlugText("rank \(String(format: "%02d", entry.rank))\(first ? " / leader" : "")")
                CommunityAvatar(name: entry.displayName, imageURL: entry.avatarURL, isYou: you, size: first ? 72 : 64)
                    .padding(.top, 12)
                // A username is one word: it shrinks to fit the card rather than breaking.
                Text(entry.displayName)
                    .font(LF.Fonts.body(first ? 20 : 18, weight: .heavy, relativeTo: .title3))
                    .tracking(-0.4)
                    .underline(entry.username != nil, color: LF.Palette.rule)
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .padding(.top, 12)
                SlugText(entry.detailSlug)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
                if you {
                    TagView("you", on: true).padding(.top, 8)
                }
                CountText(entry.xp, unit: "xp", size: first ? 38 : 31)
                    .padding(.top, 14)
                DashedRule().padding(.top, 14)
                SlugText(CommunityFormat.facts("level \(entry.level)", CommunityFormat.count(entry.lessons, "lesson")))
                    .padding(.top, 10)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityText(entry, you: you, leader: first))
        }
    }

    // MARK: Table

    private func table(_ rows: [BoardLearner]) -> some View {
        let ax = CommunityTableStyle.stacks(dynamicTypeSize, layout)
        return VStack(alignment: .leading, spacing: 0) {
            CommunityTableCaption(isWeekly ? "ranks 4 and down, this week" : "ranks 4 and down, all time")
            if !ax {
                CommunityTableHeader {
                    Text("rank").frame(width: 34 * unit, alignment: .leading)
                    Text("learner").frame(maxWidth: .infinity, alignment: .leading)
                    if layout.isRegular { Text("level").frame(width: 48 * unit, alignment: .trailing) }
                    if layout.isFull { Text("lessons").frame(width: 64 * unit, alignment: .trailing) }
                    Text("xp").frame(width: 64 * unit, alignment: .trailing)
                }
            } else {
                InkRule()
            }
            ForEach(rows) { entry in
                CommunityProfileLink(username: entry.username, style: .row) {
                    if ax { stackedRow(entry) } else { tableRow(entry) }
                }
                DashedRule()
            }
        }
    }

    private func tableRow(_ entry: BoardLearner) -> some View {
        let you = isYou(entry)
        return HStack(spacing: 12) {
            Text(verbatim: "\(entry.rank)")
                .font(LF.Fonts.mono(13, relativeTo: .caption))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.ink)
                .frame(width: 34 * unit - (you ? 9 : 0), alignment: .leading)
            CommunityAvatar(name: entry.displayName, imageURL: entry.avatarURL, isYou: you, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(entry.displayName)
                        .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                        .underline(entry.username != nil, color: LF.Palette.rule)
                        .foregroundStyle(LF.Palette.ink)
                        .lineLimit(1)
                    if you { TagView("you", on: true) }
                }
                SlugText(entry.detailSlug).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if layout.isRegular { CommunityFigureCell("\(entry.level)", width: 48) }
            if layout.isFull { CommunityFigureCell("\(entry.lessons)", width: 64) }
            CommunityFigureCell(entry.xp.formatted(), width: 64, bold: true)
        }
        .padding(.vertical, 10)
        .communityOwnRow(you)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText(entry, you: you, leader: false))
    }

    private func stackedRow(_ entry: BoardLearner) -> some View {
        let you = isYou(entry)
        return VStack(alignment: .leading, spacing: 6) {
            // Two lines at most: a username too long for a line shrinks instead of breaking.
            Text(verbatim: "\(entry.rank). \(entry.displayName)")
                .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                .foregroundStyle(LF.Palette.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.5)
                .fixedSize(horizontal: false, vertical: true)
            if you { TagView("you", on: true) }
            SlugText(entry.detailSlug)
            SlugText(CommunityFormat.facts("\(entry.xp.formatted()) xp", "level \(entry.level)", CommunityFormat.count(entry.lessons, "lesson")), color: LF.Palette.ink, weight: .bold)
        }
        .padding(.vertical, 12)
        .communityOwnRow(you)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText(entry, you: you, leader: false))
    }

    private func accessibilityText(_ entry: BoardLearner, you: Bool, leader: Bool) -> String {
        var parts = ["Rank \(entry.rank)\(leader ? ", leader" : "")", entry.displayName]
        if you { parts.append("you") }
        parts.append(entry.detailSlug)
        parts.append("\(entry.xp.formatted()) XP")
        parts.append("level \(entry.level)")
        parts.append(CommunityFormat.count(entry.lessons, "lesson"))
        return parts.joined(separator: ", ")
    }
}

// MARK: - Team board

/// Teams by combined XP, or by XP per member (teams of `minMembers` or more).
struct LeaderboardTeamBoard: View {
    let sheet: BoardSheet
    @Binding var ranking: LeaderboardView.TeamRanking
    var myTeam: Int?
    var isSignedIn: Bool
    let layout: CommunityLayout

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .caption) private var unit: CGFloat = 1

    private var perMember: Bool { ranking == .perMember }

    var body: some View {
        if sheet.teams.isEmpty {
            CommunityEmptyNote("board / empty", "No teams on the board yet. Put your team number in settings and yours is the first.") {
                if isSignedIn {
                    AccountSettingsLink("Add your team number")
                        .buttonStyle(.inkGhostSmall)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                InkTabStrip(selection: $ranking, tabs: [(.total, "total xp"), (.perMember, "xp per member")])
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("Team ranking method")
                CommunitySub(perMember
                    ? "Ranked by XP per member, so a team of 10 can beat a team of 100. Teams under \(sheet.minMembers) members are left off: below that, one person's score is the whole ranking."
                    : "Ranked by the combined XP of everyone signed up with that team number.")
                    .padding(.top, 16)
                let rows = perMember ? sheet.teamsPerMember : sheet.teams
                if rows.isEmpty {
                    CommunityEmptyNote("board / empty", "No team has \(sheet.minMembers) or more members signed up yet, so there is nothing to rank. Get your teammates to add your team number in settings and yours shows up here.")
                        .padding(.top, 22)
                } else {
                    table(rows)
                        .padding(.top, 26)
                }
            }
        }
    }

    private func table(_ rows: [BoardTeam]) -> some View {
        let ax = CommunityTableStyle.stacks(dynamicTypeSize, layout)
        return VStack(alignment: .leading, spacing: 0) {
            CommunityTableCaption(perMember ? "teams by xp per member" : "teams by total xp")
            if ax {
                InkRule()
            } else {
                CommunityTableHeader {
                    Text("rank").frame(width: 34 * unit, alignment: .leading)
                    Text("team").frame(maxWidth: .infinity, alignment: .leading)
                    if layout.isRegular { Text("members").frame(width: 72 * unit, alignment: .trailing) }
                    Text(perMember ? "xp / member" : "total xp").frame(width: 92 * unit, alignment: .trailing)
                }
            }
            ForEach(rows) { team in
                let mine = team.teamNumber == myTeam
                Group {
                    if mine {
                        NavigationLink(value: AppRoute.team) { row(team, mine: true, ax: ax) }
                            .buttonStyle(.inkRow)
                            .accessibilityHint("Opens your team")
                    } else {
                        row(team, mine: false, ax: ax)
                    }
                }
                DashedRule()
            }
        }
    }

    @ViewBuilder
    private func row(_ team: BoardTeam, mine: Bool, ax: Bool) -> some View {
        let figure = perMember ? team.avgXp : team.xp
        let other = perMember ? "\(team.xp.formatted()) xp total" : "\(team.avgXp.formatted()) xp per member"
        Group {
            if ax {
                VStack(alignment: .leading, spacing: 6) {
                    Text(verbatim: "\(team.rank). Team \(team.teamNumber)")
                        .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                        .fixedSize(horizontal: false, vertical: true)
                    if mine { TagView("yours", on: true) }
                    SlugText(CommunityFormat.facts("\(figure.formatted()) \(perMember ? "xp per member" : "xp total")", CommunityFormat.count(team.members, "member")), color: LF.Palette.ink, weight: .bold)
                        .fixedSize(horizontal: false, vertical: true)
                    SlugText(other)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, 12)
            } else {
                HStack(spacing: 12) {
                    Text(verbatim: "\(team.rank)")
                        .font(LF.Fonts.mono(13, relativeTo: .caption))
                        .monospacedDigit()
                        .frame(width: 34 * unit - (mine ? 9 : 0), alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text(verbatim: "Team \(team.teamNumber)")
                                .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                            if mine { TagView("yours", on: true) }
                        }
                        SlugText(other).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if layout.isRegular { CommunityFigureCell("\(team.members)", width: 72) }
                    CommunityFigureCell(figure.formatted(), width: 92, bold: true)
                }
                .padding(.vertical, 10)
            }
        }
        .foregroundStyle(LF.Palette.ink)
        .frame(minHeight: LF.Metrics.tap)
        .communityOwnRow(mine)
        .accessibilityElement(children: .ignore)
        // Verbatim: a team number is a name, so it's "Team 7002", never "Team 7,002".
        .accessibilityLabel(Text(verbatim: "Rank \(team.rank), Team \(team.teamNumber)\(mine ? ", yours" : ""), \(figure.formatted()) \(perMember ? "XP per member" : "XP total"), \(CommunityFormat.count(team.members, "member"))"))
    }
}

// MARK: - Previews

#Preview("Leaderboard, iPhone", traits: .fixedLayout(width: 393, height: 1500)) {
    CommunityPreviewHost { LeaderboardView() }
    .environment(\.colorScheme, .light)
}

#Preview("Leaderboard, iPhone, dark", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost { LeaderboardView(board: .teams) }
        .environment(\.colorScheme, .dark)
}

#Preview("Leaderboard, iPad", traits: .fixedLayout(width: 1180, height: 1500)) {
    CommunityPreviewHost { LeaderboardView() }
    .environment(\.colorScheme, .light)
}

#Preview("Leaderboard, iPad, dark", traits: .fixedLayout(width: 834, height: 1400)) {
    CommunityPreviewHost { LeaderboardView(board: .allTime) }
        .environment(\.colorScheme, .dark)
}

#Preview("Leaderboard, guest, empty", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost(model: .preview(signedIn: false), client: .previewing(boards: PreviewCommunity.emptyBoards)) {
        LeaderboardView()
    }
    .environment(\.colorScheme, .light)
}

#Preview("Leaderboard, offline with a saved copy", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost(client: .previewing(failing: true, cached: true)) { LeaderboardView() }
    .environment(\.colorScheme, .light)
}
