import SwiftUI

/// Somebody's public record (the site's `/u/[username]`): one taped card with the handle,
/// the rank stamp and the share link; the totals on the blue band; then the badges as a
/// roster you read down. Identified by username only, never a real name, even your own.
struct PublicProfileView: View {
    let username: String

    @Environment(\.communityClient) private var client
    @Environment(AccountStore.self) private var account
    @Environment(CatalogStore.self) private var catalog
    @Environment(AppModel.self) private var app
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?

    @State private var state = CommunityLoad<PublicProfile?>()
    /// Whose record `state` holds (the lowercased handle). A link to someone else can reuse
    /// this view in place, and it must never show the last person's card under the new name.
    @State private var stateHandle: String?

    init(username: String) {
        self.username = username
    }

    private var handle: String { username.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var handleKey: String { handle.lowercased() }

    /// `state` while it's this handle's, else a blank one.
    private var current: CommunityLoad<PublicProfile?> {
        stateHandle == handleKey ? state : CommunityLoad()
    }

    /// The record as it stands, falling back to a copy this session already fetched.
    private var display: CommunityLoad<PublicProfile?> {
        var shown = current
        if shown.value == nil, let instant = client.instantProfile(handle) {
            shown.value = .some(instant.value)
            shown.fetchedAt = instant.fetchedAt
        }
        return shown
    }
    private var isMine: Bool {
        guard let mine = account.profile?.username else { return false }
        return mine.lowercased() == handle.lowercased()
    }

    var body: some View {
        CommunityPage(refresh: { await load(force: true) }, place: .route(.profile(username))) { layout, _ in
            content(layout)
        }
        .communityNavigationTitle("@\(handle)")
        .toolbar {
            if case .some(.some(let profile)) = display.value {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: profile.webURL, subject: Text("@\(profile.username) on LearnFRC"), message: Text("@\(profile.username)'s record of work on LearnFRC:")) {
                        Label("Share profile", systemImage: "square.and.arrow.up")
                    }
                    .help("Share this profile")
                }
            }
        }
        .communityRefreshButton(isLoading: current.isLoading) { Task { await load(force: true) } }
        // Handoff only while this is the screen on show (ARCHITECTURE 6.6).
        .screenHandoff(.route(.profile(username)), url: AppConfig.webBase.appending(path: "u/\(handle)"),
                       title: "@\(handle) on LearnFRC", when: !handle.isEmpty)
        .task(id: handleKey) { await load() }
    }

    @ViewBuilder
    private func content(_ layout: CommunityLayout) -> some View {
        let state = display
        switch state.value {
        case .some(.some(let profile)):
            if state.isStale {
                CommunityLoadNote(state: state) { Task { await load(force: true) } }
                    .foldLeadingPage(layout.pages)
                    .communityColumn(layout)
                    .padding(.top, 12)
            }
            PublicRecordSheet(profile: profile, isMine: isMine, layout: layout, catalogLessonCount: catalog.allLessons.count)
        case .some(.none):
            notFound(layout)
        case .none:
            if state.error != nil {
                CommunityLoadNote(state: state) { Task { await load(force: true) } }
                    .foldLeadingPage(layout.pages)
                    .communityColumn(layout)
                    .padding(.top, 28)
            } else {
                loading(layout)
            }
        }
    }

    private func notFound(_ layout: CommunityLayout) -> some View {
        NotebookCard(tilt: .preset(1), tape: true, padding: 24) {
            SectionLabel("learnfrc / no such record")
            Text("There's no learner called @\(handle).")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            CommunityLede("Usernames can change, so an old link can point at nobody. The leaderboard lists everyone who has earned XP.")
                .padding(.top, 14)
            // To Community's own leaderboard (its first screen), the way any link to the
            // leaderboard goes (`open`), never a second copy pushed over it.
            Button("Open the leaderboard") {
                if let navigation { navigation.open(.leaderboard) } else { app.open(.leaderboard) }
            }
            .buttonStyle(.ink)
            .padding(.top, 20)
        }
        .frame(maxWidth: 680, alignment: .leading)
        .foldLeadingPage(layout.pages)
        .communityColumn(layout)
        .padding(.top, 28)
    }

    private func loading(_ layout: CommunityLayout) -> some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: 24) {
            SkeletonBlock(height: 12, width: 180)
            SkeletonBlock(height: 44, width: 240).padding(.top, 20)
            HStack(spacing: 8) {
                SkeletonBlock(height: 24, width: 70)
                SkeletonBlock(height: 24, width: 90)
            }
            .padding(.top, 16)
            SkeletonBlock(height: 16).padding(.top, 16)
        }
        .frame(maxWidth: 928)
        .frame(maxWidth: .infinity)
        .foldLeadingPage(layout.pages)
        .communityColumn(layout)
        .padding(.top, 28)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading @\(handle)")
    }

    private func load(force: Bool = false) async {
        let name = handle
        let key = handleKey
        if stateHandle != key {
            // Another person: start from nothing, like TeamView does for another account.
            state = CommunityLoad()
            stateHandle = key
        }
        guard !name.isEmpty else {
            state.succeed(nil)
            return
        }
        if state.isLoading { return }
        if state.value == nil {
            var saved = client.instantProfile(name)
            if saved == nil { saved = await client.cachedProfile(name) }
            // The handle may have changed while the cache was read.
            guard stateHandle == key else { return }
            if let saved {
                state.restore(CommunityStamped(value: Optional(saved.value), fetchedAt: saved.fetchedAt))
            }
        }
        if !force, state.hasSettled, state.error == nil { return }
        state.begin()
        do {
            let profile = try await client.profile(name)
            // A reply for the person this view showed before is dropped.
            guard stateHandle == key else { return }
            state.succeed(profile)
        } catch {
            guard stateHandle == key else { return }
            if Task.isCancelled { state.isLoading = false } else { state.fail(error) }
        }
    }
}

// MARK: - The record sheet

struct PublicRecordSheet: View {
    let profile: PublicProfile
    var isMine: Bool
    let layout: CommunityLayout
    var catalogLessonCount: Int

    @Environment(CatalogStore.self) private var catalog
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let pages = layout.pages {
                // An open iPhone Duo: the record card on the left page, the rank stamp on the
                // right, the figures two to a page, the badges list on the right page.
                FoldPages(pages) {
                    recordCard(layout.leadingPage, withStamp: false)
                } trailing: {
                    PublicRankStamp(profile: profile)
                        .padding(.top, 24)
                        .padding(.leading, 6)
                }
                .communityColumn(layout)
                .padding(.top, 40)

                figuresBand
                    .padding(.top, layout.sectionGap)

                FoldPages(pages) {
                    VStack(alignment: .leading, spacing: 0) {
                        badgesHeader
                        badgesFooter
                    }
                } trailing: {
                    badgesList(layout.trailingPage, top: 0)
                }
                .communityColumn(layout)
                .padding(.top, layout.sectionGap)
            } else {
                recordCard(layout, withStamp: true)
                    .frame(maxWidth: 928)
                    .frame(maxWidth: .infinity)
                    .communityColumn(layout)
                    .padding(.top, layout.isWide ? 40 : 22)

                figuresBand
                    .padding(.top, layout.sectionGap)

                badges
                    .communityColumn(layout)
                    .padding(.top, layout.sectionGap)
            }
        }
    }

    // MARK: The card

    private func recordCard(_ layout: CommunityLayout, withStamp: Bool) -> some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: layout.isWide ? 32 : 22) {
            SlugText("learnfrc / record of work")
                .padding(.bottom, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { DashedRule() }

            Group {
                if !withStamp {
                    identity(layout)
                } else if layout.isWide {
                    HStack(alignment: .top, spacing: 36) {
                        identity(layout).frame(maxWidth: .infinity, alignment: .leading)
                        PublicRankStamp(profile: profile)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 26) {
                        identity(layout)
                        PublicRankStamp(profile: profile)
                    }
                }
            }
            .padding(.top, 22)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 14) { shareRow }
                VStack(alignment: .leading, spacing: 10) { shareRow }
            }
            .padding(.top, 18)
            .overlay(alignment: .top) { DashedRule() }
            .padding(.top, 24)
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.2).offset(x: -44, y: 12)
        }
    }

    private func identity(_ layout: CommunityLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("@\(profile.username)")
                .font(LF.Fonts.display(layout.isWide ? 52 : 38, relativeTo: .largeTitle))
                .tracking(-1)
                .foregroundStyle(LF.Palette.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .accessibilityAddTraits(.isHeader)
            CommunityFlowLayout(spacing: 8, lineSpacing: 8) {
                if isMine { TagView("you", on: true) }
                TagView(profile.roleKind.displayName)
                if let team = profile.teamNumber { TagView("Team \(team)") }
                if let joined = profile.createdAt, !typeSize.isAccessibilitySize {
                    TagView("Joined \(CommunityFormat.monthYear(joined))")
                }
            }
            .padding(.top, 18)
            // A tag stays on one line; at the accessibility sizes the date is wider than the
            // card, so it's printed as a line that can wrap instead.
            if let joined = profile.createdAt, typeSize.isAccessibilitySize {
                SlugText("joined \(CommunityFormat.monthYear(joined))")
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
            }
            if let bio = profile.bio?.trimmingCharacters(in: .whitespacesAndNewlines), !bio.isEmpty {
                Text(bio)
                    .lfProse(16, lineHeight: 1.6, color: LF.Palette.graphite)
                    .frame(maxWidth: 560, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                    .padding(.top, 18)
            }
        }
    }

    @ViewBuilder
    private var shareRow: some View {
        ShareLink(item: profile.webURL, subject: Text("@\(profile.username) on LearnFRC"), message: Text("@\(profile.username)'s record of work on LearnFRC:")) {
            Label(isMine ? "Share my profile" : "Share profile", systemImage: "square.and.arrow.up")
        }
        .buttonStyle(.inkGhostSmall)
        SlugText(CommunityInviteLink.display(profile.webURL))
            .textSelection(.enabled)
        if isMine {
            AccountSettingsLink("Edit profile")
                .buttonStyle(.inkGhostSmall)
        }
    }

    // MARK: The figures

    private var figuresBand: some View {
        let items: [(String, String)] = [
            (profile.xp.formatted(), "xp"),
            (profile.level.formatted(), "level"),
            (profile.lessonCount.formatted(), profile.lessonCount == 1 ? "lesson" : "lessons"),
            (profile.achievements.count.formatted(), profile.achievements.count == 1 ? "badge" : "badges"),
        ]
        let columns = layout.isWide && !layout.isSpread
            ? Array(repeating: GridItem(.flexible(), spacing: 32, alignment: .topLeading), count: 4)
            : Array(repeating: GridItem(.flexible(), spacing: 24, alignment: .topLeading), count: 2)
        let size: CGFloat = layout.isWide ? 56 : 42
        return Group {
            if let pages = layout.pages {
                // Two to a page, so no figure sits across the fold.
                FoldPages(pages) {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 26) {
                        ForEach(items.prefix(2), id: \.1) { CommunitySlabFigure($0.0, caption: $0.1, size: size) }
                    }
                } trailing: {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 26) {
                        ForEach(items.dropFirst(2), id: \.1) { CommunitySlabFigure($0.0, caption: $0.1, size: size) }
                    }
                }
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 26) {
                    ForEach(items, id: \.1) { item in
                        CommunitySlabFigure(item.0, caption: item.1, size: size)
                    }
                }
            }
        }
        .communityColumn(layout)
        .padding(.vertical, layout.isWide ? 46 : 32)
        .frame(maxWidth: .infinity)
        .communityBand()
    }

    // MARK: Badges

    private var badges: some View {
        VStack(alignment: .leading, spacing: 0) {
            badgesHeader
            badgesList(layout, top: 22)
            badgesFooter
        }
    }

    private var badgesHeader: some View {
        CommunitySectionHeader("Badges earned", sub: "Each one is signed off by a quiz, not by time spent on the page.") {
            if !profile.achievements.isEmpty {
                CountText(profile.achievements.count, unit: profile.achievements.count == 1 ? "badge" : "badges")
            }
        }
    }

    @ViewBuilder
    private func badgesList(_ layout: CommunityLayout, top: CGFloat) -> some View {
        if profile.achievements.isEmpty {
            CommunityEmptyNote("nothing signed off yet", isMine
                ? "Your first badge lands with your first finished lesson. The whole catalogue is open, and it needs no account to read."
                : "The first badges land after a handful of lessons. The same catalogue is open to you, and it needs no account to read."
            ) {
                Button("Open the guides") { app.selectedTab = .learn }
                    .buttonStyle(.inkGhostSmall)
            }
            .padding(.top, top)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(profile.achievements) { badge in
                    badgeRow(badge, layout: layout)
                    DashedRule()
                }
            }
            .padding(.top, max(0, top - 2))
        }
    }

    private var badgesFooter: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Everything on this page came out of \(lessonTotal) free lessons. No account is needed to read them.")
                .lfProse(15.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 28)
            if !profile.achievements.isEmpty {
                Button("Open the guides") { app.selectedTab = .learn }
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 10)
            }
        }
    }

    private var lessonTotal: String {
        catalogLessonCount > 0 ? catalogLessonCount.formatted() : "hundreds of"
    }

    private func badgeRow(_ badge: PublicAchievement, layout: CommunityLayout) -> some View {
        let description = catalog.achievement(slug: badge.slug)?.description ?? ""
        return Group {
            if layout.isRegular {
                HStack(alignment: .firstTextBaseline, spacing: 28) {
                    badgeName(badge).frame(width: min(288, layout.width * 0.34), alignment: .leading)
                    Text(description)
                        .lfProse(15, lineHeight: 1.45, color: LF.Palette.graphite)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    badgeName(badge)
                    if !description.isEmpty {
                        Text(description)
                            .lfProse(15, lineHeight: 1.45, color: LF.Palette.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(.vertical, 16)
        .accessibilityElement(children: .combine)
    }

    private func badgeName(_ badge: PublicAchievement) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: badge.systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(LF.Palette.blue)
                    .accessibilityHidden(true)
                Text(badge.name)
                    .font(LF.Fonts.display(18, relativeTo: .headline))
                    .tracking(-0.4)
                    .foregroundStyle(LF.Palette.ink)
            }
            if let earned = badge.earnedAt {
                SlugText("earned \(CommunityFormat.shortDate(earned))")
            }
        }
    }
}

// MARK: - The rank stamp

/// The stamp in the corner of the record sheet: the tier in mono under a rule, the level as an
/// oversized figure, and the distance to the next one written out. No tier colours.
struct PublicRankStamp: View {
    let profile: PublicProfile

    private var intoLevel: Int { XPRules.xpIntoLevel(profile.xp) }
    private var toNext: Int { XPRules.xpToNextLevel(profile.xp) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 14) {
                CommunityAvatar(name: profile.username, imageURL: profile.avatarURL, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    SlugText("rank")
                    Text(profile.tier.uppercased())
                        .font(LF.Fonts.mono(15, weight: .bold, relativeTo: .headline))
                        .tracking(15 * 0.06)
                        .foregroundStyle(LF.Palette.ink)
                }
            }
            DashedRule().padding(.top, 16)
            HStack(alignment: .lastTextBaseline, spacing: 10) {
                Text(verbatim: "\(profile.level)")
                    .font(LF.Fonts.mono(52, weight: .bold, relativeTo: .largeTitle))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.blue)
                SlugText("level")
            }
            .padding(.top, 12)
            CommunityBar(value: Double(intoLevel) / Double(XPRules.xpPerLevel), height: 12.8)
                .padding(.top, 10)
            SlugText("\(intoLevel)% / \(toNext) xp to level \(profile.level + 1)")
                .padding(.top, 8)
        }
        .padding(18)
        .frame(maxWidth: 304, alignment: .leading)
        .notebookBox(radius: .s, shadow: .card)
        .communityTilt(0.9)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rank \(profile.tier), level \(profile.level), \(toNext) XP to level \(profile.level + 1)")
    }
}

// MARK: - Previews

#Preview("Profile, iPhone", traits: .fixedLayout(width: 393, height: 1500)) {
    CommunityPreviewHost { PublicProfileView(username: "kai_cad") }
    .environment(\.colorScheme, .light)
}

#Preview("Profile, iPhone, dark, mine", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost { PublicProfileView(username: "maya_builds") }
        .environment(\.colorScheme, .dark)
}

#Preview("Profile, iPad", traits: .fixedLayout(width: 1180, height: 1300)) {
    CommunityPreviewHost { PublicProfileView(username: "kai_cad") }
    .environment(\.colorScheme, .light)
}

#Preview("Profile, iPad, dark, new", traits: .fixedLayout(width: 834, height: 1100)) {
    CommunityPreviewHost { PublicProfileView(username: "rookie_rae") }
        .environment(\.colorScheme, .dark)
}

#Preview("Profile, nobody", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost { PublicProfileView(username: "not_a_person") }
    .environment(\.colorScheme, .light)
}

#Preview("Profile, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 1600)) {
    CommunityPreviewHost { PublicProfileView(username: "kai_cad") }
        .previewFold(.previewBook)
        .environment(\.colorScheme, .light)
}
