import SwiftUI

/// Your own record (the site's `/profile`): the member card, what you can change, every
/// figure the account holds printed once, certificates, and the badge checklist. A guest
/// sees what this device has kept and what an account would add.
///
/// It's the root of the "You" tab. Links push `AppRoute`s (settings, your public page,
/// a certificate, the badge gallery), so it expects the shell's
/// `.navigationDestination(for: AppRoute.self)` in its stack.
///
/// Privacy: the only full name shown is the signed-in person's own.
struct ProfileView: View {
    @Environment(AccountStore.self) private var account
    @Environment(ProgressStore.self) private var progress
    @Environment(CatalogStore.self) private var catalog

    @State private var authScreen: AuthFlowView.Screen?

    /// Which record the page shows. When it changes (signing in, signing out) the page goes
    /// back to the top, so the member card never opens half scrolled away.
    private var authKey: String {
        switch account.state {
        case .signedIn(let me): "in-\(me.user.id.uuidString)"
        case .guest: "guest"
        case .loading: "loading"
        }
    }

    var body: some View {
        AccountPage(maxWidth: 1080, resetKey: authKey, avoidsKeyboard: false, place: .root) { width in
            VStack(alignment: .leading, spacing: 0) {
                switch account.state {
                case .signedIn(let me):
                    signedIn(me, width: width)
                case .guest:
                    guest(width: width)
                case .loading:
                    loading
                }
            }
        }
        .navigationTitle("You")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                AccountSettingsLink {
                    Label("Settings", systemImage: "gearshape")
                }
            }
        }
        .authSheet(item: $authScreen)
        .refreshable {
            async let me: Void = account.refreshMe(force: true)
            async let records: Void = progress.refresh(force: true)
            _ = await (me, records)
        }
    }

    // MARK: Signed in

    @ViewBuilder
    private func signedIn(_ me: Me, width: CGFloat) -> some View {
        let figures = ProfileFigures(me: me, progress: progress, catalog: catalog)

        SectionLabel("your record")

        Group {
            if width >= 860 {
                HStack(alignment: .top, spacing: 40) {
                    ProfileMemberCard(me: me, figures: figures)
                    ProfileChangeBox(me: me).frame(width: 320)
                }
            } else {
                VStack(alignment: .leading, spacing: 30) {
                    ProfileMemberCard(me: me, figures: figures)
                    ProfileChangeBox(me: me)
                }
            }
        }
        .padding(.top, 18)

        ProfileBookmarksLink()
            .padding(.top, 36)

        if me.isProvisional {
            AccountNote("offline", "Showing what this device knows. Your name, team and badges fill in when you're back online.")
                .padding(.top, 24)
        }

        VStack(alignment: .leading, spacing: 0) {
            AccountSectionHeading(title: "Everything on file")
            AccountSubText("Every figure this account holds, printed once. Nothing here is shared with anyone unless you send them your handle.")
                .frame(maxWidth: 600, alignment: .leading)
                .padding(.top, 10)
            ProfileSpecSheet(rows: specRows(me, figures), wide: width >= 640)
                .padding(.top, 18)
        }
        .padding(.top, 52)

        ProfileCertificates(wide: width >= 760)
            .padding(.top, 52)

        ProfileBadgeChecklist(wide: width >= 760)
            .padding(.top, 52)
    }

    private func specRows(_ me: Me, _ f: ProfileFigures) -> [ProfileSpecSheet.Row] {
        let p = me.profile
        var rows: [ProfileSpecSheet.Row] = [
            .init(label: "total xp", value: f.xp.formatted(), note: .text(f.movingNote.map { "\($0), this catches up in a moment" } ?? "10 XP a lesson, more on a streak")),
            .init(label: "level", value: f.level.formatted(), note: .text("\(f.toNextLevel) XP to level \(f.level + 1)")),
            .init(label: "tier", value: f.tier, note: .text("Rookie, Contender, Veteran, All-Star, Champion")),
            // While guest lessons move in, the count isn't the account's yet (it can be just
            // the lessons on their way in), so it waits rather than print a smaller total.
            f.lessonsArePending
                ? .init(label: "lessons cleared", value: "catching up", note: .text("\(f.movingNote ?? "moving guest lessons in"), this catches up in a moment"))
                : .init(label: "lessons cleared", value: f.lessons.formatted(), note: .text("every lesson you've passed, on any device")),
            .init(label: "badges earned", value: "\(f.badgesEarned) / \(f.badgesTotal)", note: .text("the checklist below")),
            .init(label: "certificates", value: f.certificates.formatted(), note: .text("one for each department you finish")),
            .init(label: "role", value: p.roleKind.displayName, note: .route("set in settings", .settings)),
        ]
        if let team = p.teamNumber {
            rows.append(.init(label: "team", value: "#\(team)", note: .text("printed beside your name on the leaderboard")))
        } else {
            rows.append(.init(label: "team", value: "not set", note: .route("add it in settings", .settings)))
        }
        rows.append(.init(
            label: "member since",
            value: p.createdAt?.formatted(.dateTime.month(.wide).year()) ?? "not recorded",
            note: .text("the day the account was made")
        ))
        if let username = p.username {
            rows.append(.init(label: "handle", value: "@\(username)", note: .web("learnfrc.com/u/\(username)", AccountLinks.publicProfile(username))))
        } else {
            rows.append(.init(label: "handle", value: "not set", note: .route("pick one in settings", .settings)))
        }
        return rows
    }

    // MARK: Guest

    @ViewBuilder
    private func guest(width: CGFloat) -> some View {
        AccountHeader(
            marker: "you, on this device",
            title: "You're reading as a guest.",
            lede: "Nothing here needs an account. Lessons you finish are kept on this device. An account keeps them everywhere, prints your certificates and puts you on your team's page."
        )

        let tally = ProfileGuestTally(lessons: progress.completedTotal, rhythm: progress.rhythm)
        let actions = VStack(alignment: .leading, spacing: 0) {
            SectionLabel("what the account holds")
            AccountDefinitionList(items: AccountPitch.keeps)
                .padding(.top, 6)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { guestButtons }
                VStack(alignment: .leading, spacing: 12) { guestButtons }
            }
            .padding(.top, 22)
        }

        Group {
            if width >= 820 {
                HStack(alignment: .top, spacing: 48) {
                    tally.frame(width: 340)
                    actions
                }
            } else {
                VStack(alignment: .leading, spacing: 36) {
                    tally
                    actions
                }
            }
        }
        .padding(.top, 30)

        ProfileBookmarksLink()
            .padding(.top, 44)
    }

    @ViewBuilder
    private var guestButtons: some View {
        Button("Create a free account") { authScreen = .signUp }
            .buttonStyle(.ink)
        Button("Sign in") { authScreen = .signIn }
            .buttonStyle(.inkGhost)
    }

    private var loading: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("your record")
            SkeletonBlock(height: 220)
            SkeletonBlock(height: 18, width: 240)
            SkeletonBlock(height: 18)
        }
    }
}

// MARK: - Figures

/// The numbers on the page, from the freshest source: progress (updated after every
/// completion) for XP, falling back to `/me`.
struct ProfileFigures {
    let xp: Int
    let level: Int
    let tier: String
    let xpIntoLevel: Int
    let toNextLevel: Int
    let lessons: Int
    let badgesEarned: Int
    let badgesTotal: Int
    let certificates: Int
    /// Guest lessons from this device still being moved into the account (just after sign-in).
    /// Until the server answers, `lessons` can be these alone, and XP, level and badges are
    /// behind, so the page says so rather than presenting these numbers as final.
    let movingGuestLessons: Int

    @MainActor
    init(me: Me, progress: ProgressStore, catalog: CatalogStore) {
        let xp = max(progress.xp, me.profile.xp)
        let level = XPRules.level(forXP: xp)
        self.xp = xp
        self.level = level
        self.tier = XPRules.tier(forLevel: level)
        self.xpIntoLevel = XPRules.xpIntoLevel(xp)
        self.toNextLevel = XPRules.xpToNextLevel(xp)
        self.lessons = progress.completedTotal
        self.badgesTotal = catalog.achievements.count
        self.badgesEarned = catalog.achievements.filter { progress.isEarned($0) }.count
        self.certificates = progress.certificates.count
        self.movingGuestLessons = progress.isMovingGuestLessons ? progress.movingGuestLessonIDs.count : 0
    }

    /// True while guest lessons are moving in: until the refresh after the move lands, the
    /// lessons figure can be the incoming lessons alone (the account's own aren't read yet),
    /// so screens show it as pending instead of a total smaller than the real one.
    var lessonsArePending: Bool { movingGuestLessons > 0 }

    /// "moving 3 guest lessons in", while that's happening.
    var movingNote: String? {
        guard movingGuestLessons > 0 else { return nil }
        return movingGuestLessons == 1 ? "moving 1 guest lesson in" : "moving \(movingGuestLessons) guest lessons in"
    }
}

// MARK: - Member card

/// The member card taped into the front of the binder: photo or initials, name, handle,
/// tags, bio, and the figures along the bottom edge under a rule.
struct ProfileMemberCard: View {
    let me: Me
    let figures: ProfileFigures

    @Environment(\.dynamicTypeSize) private var typeSize

    private var p: Profile { me.profile }

    private var displayName: String {
        if let name = p.fullName?.accountTrimmed, !name.isEmpty { return name }
        if let username = p.username { return username }
        return me.user.email?.split(separator: "@").first.map(String.init) ?? "You"
    }

    var body: some View {
        NotebookCard(tilt: .preset(0), tape: true, padding: 24) {
            AccountSheetSlug("learnfrc / member card")

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .bottom, spacing: 18) { avatar; nameBlock }
                VStack(alignment: .leading, spacing: 14) { avatar; nameBlock }
            }
            .padding(.top, 20)

            AccountFlowLayout(spacing: 8) {
                TagView(p.roleKind.displayName)
                if let team = p.teamNumber { TagView("Team \(team)") }
                if let joined = p.createdAt, !typeSize.isAccessibilitySize {
                    TagView("Joined \(joined.formatted(.dateTime.month(.wide).year()))")
                }
            }
            .padding(.top, 18)
            // A tag stays on one line, and at the accessibility sizes "Joined October 2026"
            // is wider than the card, so it's printed as a line that can wrap instead.
            if let joined = p.createdAt, typeSize.isAccessibilitySize {
                SlugText("joined \(joined.formatted(.dateTime.month(.wide).year()))")
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
            }

            if let bio = p.bio, !bio.accountTrimmed.isEmpty {
                Text(bio)
                    .font(LF.Fonts.body(16, relativeTo: .body))
                    .lineHeight(.multiple(factor: 1.55))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 560, alignment: .leading)
                    .padding(.top, 16)
            }

            VStack(alignment: .leading, spacing: 16) {
                DashedRule()
                AccountFlowLayout(spacing: 36, lineSpacing: 14) {
                    figure(figures.level.formatted(), "level")
                    figure(figures.xp.formatted(), "xp")
                    if figures.lessonsArePending {
                        pendingFigure("lessons")
                    } else {
                        figure(figures.lessons.formatted(), figures.lessons == 1 ? "lesson" : "lessons")
                    }
                }
                MeterView(
                    value: Double(figures.xpIntoLevel) / Double(XPRules.xpPerLevel),
                    label: "to level \(figures.level + 1)",
                    valueText: "\(figures.xpIntoLevel)/\(XPRules.xpPerLevel) xp",
                    style: .slim
                )
                // Just after sign-in, this device's guest lessons are on their way into the
                // account: the lessons figure waits, and XP and the level catch up in a moment.
                if let note = figures.movingNote {
                    SlugText("\(note), lessons and xp catch up in a moment")
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.top, 20)
        }
        .overlay(alignment: .bottomTrailing) {
            TapeStrip(angle: 2.6)
                .offset(x: -30, y: 12)
        }
    }

    private var avatar: some View {
        InitialsAvatar(name: displayName, seed: p.username ?? me.user.email, imageURL: p.avatarURL, size: 88)
    }

    private var nameBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(displayName)
                .font(LF.Fonts.display(34, relativeTo: .largeTitle))
                .tracking(34 * -0.025)
                .lineHeight(.multiple(factor: 1.0))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            SlugText(p.handle ?? "no handle yet")
        }
    }

    private func figure(_ value: String, _ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(LF.Fonts.mono(24, weight: .bold, relativeTo: .title2))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
            SlugText(unit)
        }
        .accessibilityElement(children: .combine)
    }

    /// A figure that isn't known yet (the lessons while guest lessons move in): a pencil
    /// ellipsis where the number goes, never a smaller number than the real one.
    private func pendingFigure(_ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("\u{2026}")
                .font(LF.Fonts.mono(24, weight: .bold, relativeTo: .title2))
                .foregroundStyle(LF.Palette.graphite)
            SlugText(unit)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(unit), catching up")
    }
}

// MARK: - What you can change

/// The two things that are editable, and the one number that belongs to nobody else.
struct ProfileChangeBox: View {
    let me: Me

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("what you can change")
                .accessibilityAddTraits(.isHeader)

            VStack(alignment: .leading, spacing: 0) {
                InkRule()
                AccountSettingsLink {
                    changeRow(title: "Edit your profile", detail: "Name, team number, role, bio and avatar.")
                }
                .buttonStyle(.inkRow)
            }
            .padding(.top, 12)

            if let username = me.profile.username {
                changeLink(
                    title: "Your public page",
                    detail: "What a teammate sees at the link you share. Your real name is never on it.",
                    route: .profile(username)
                )
                .padding(.top, 14)

                ShareLink(
                    item: AccountLinks.publicProfile(username),
                    subject: Text("@\(username) on LearnFRC"),
                    message: Text("My LearnFRC page")
                ) {
                    Label("Share my page", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.inkGhostSmall)
                .padding(.top, 16)
            }

            if me.referralCount > 0 {
                VStack(alignment: .leading, spacing: 12) {
                    DashedRule()
                    CountText(me.referralCount, unit: me.referralCount == 1 ? "teammate you brought in" : "teammates you brought in")
                }
                .padding(.top, 20)
            }
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox()
    }

    private func changeLink(title: String, detail: String, route: AppRoute) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            NavigationLink(value: route) {
                changeRow(title: title, detail: detail)
            }
            .buttonStyle(.inkRow)
        }
    }

    private func changeRow(title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(LF.Fonts.body(17, weight: .bold))
                    .foregroundStyle(LF.Palette.ink)
                Text(detail)
                    .font(LF.Fonts.body(14.5, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.right")
                .font(.footnote.weight(.bold))
                .foregroundStyle(LF.Palette.blue)
                .padding(.top, 4)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 10)
    }
}

// MARK: - Spec sheet

/// "Everything on file": label, value, and where the figure comes from. A table on wide
/// windows; on narrow ones each row stacks its note under the figure.
struct ProfileSpecSheet: View {
    struct Row: Identifiable {
        enum Note {
            case text(String)
            case route(String, AppRoute)
            case web(String, URL)
        }

        let label: String
        let value: String
        let note: Note
        var id: String { label }
    }

    let rows: [Row]
    let wide: Bool

    var body: some View {
        if wide {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 28, verticalSpacing: 0) {
                GridRow {
                    SlugText("figure", color: LF.Palette.ink, weight: .bold).accessibilityHidden(true)
                    SlugText("value", color: LF.Palette.ink, weight: .bold).accessibilityHidden(true)
                    SlugText("where it comes from", color: LF.Palette.ink, weight: .bold).accessibilityHidden(true)
                }
                GridRow {
                    Color.clear.frame(height: 10).gridCellColumns(3)
                }
                GridRow {
                    InkRule().gridCellColumns(3)
                }
                ForEach(rows) { row in
                    GridRow {
                        SlugText(row.label)
                            .padding(.vertical, 12)
                        valueText(row.value)
                            .padding(.vertical, 12)
                        note(row.note)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 12)
                    }
                    GridRow {
                        DashedRule().gridCellColumns(3)
                    }
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                InkRule()
                ForEach(rows) { row in
                    VStack(alignment: .leading, spacing: 4) {
                        // Label and value on one line while both fit whole; the value under
                        // the label otherwise (the largest sizes), so neither is cut short.
                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .firstTextBaseline, spacing: 12) {
                                SlugText(row.label)
                                    .fixedSize()
                                Spacer(minLength: 8)
                                valueText(row.value)
                                    .fixedSize()
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                SlugText(row.label)
                                    .fixedSize(horizontal: false, vertical: true)
                                valueText(row.value, wraps: true)
                            }
                        }
                        note(row.note)
                    }
                    .padding(.vertical, 12)
                    .accessibilityElement(children: .combine)
                    DashedRule()
                }
            }
        }
    }

    private func valueText(_ value: String, wraps: Bool = false) -> some View {
        Text(value)
            .font(LF.Fonts.mono(15, weight: .bold, relativeTo: .body))
            .monospacedDigit()
            .foregroundStyle(LF.Palette.ink)
            .lineLimit(wraps ? nil : 1)
            .minimumScaleFactor(wraps ? 1 : 0.8)
            .fixedSize(horizontal: false, vertical: wraps)
    }

    @ViewBuilder
    private func note(_ note: Row.Note) -> some View {
        switch note {
        case .text(let text):
            Text(text)
                .font(LF.Fonts.body(14.5, relativeTo: .subheadline))
                .foregroundStyle(LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
        case .route(let text, let route):
            if route == .settings {
                AccountSettingsLink(text)
                    .buttonStyle(AccountTextButtonStyle(size: 14.5, mono: false))
            } else {
                NavigationLink(text, value: route)
                    .buttonStyle(AccountTextButtonStyle(size: 14.5, mono: false))
            }
        case .web(let text, let url):
            Link(text, destination: url)
                .buttonStyle(AccountTextButtonStyle(size: 14.5, mono: false))
        }
    }
}

// MARK: - Certificates

/// The departments finished (each opens its certificate), or the ones closest to done.
struct ProfileCertificates: View {
    let wide: Bool

    @Environment(ProgressStore.self) private var progress
    @Environment(CatalogStore.self) private var catalog
    @ScaledMetric(relativeTo: .headline) private var iconSize: CGFloat = 18
    @ScaledMetric(relativeTo: .headline) private var iconBox: CGFloat = 40

    var body: some View {
        let certificates = progress.certificates
        VStack(alignment: .leading, spacing: 0) {
            AccountSectionHeading(
                title: "Certificates",
                slug: certificates.isEmpty ? "none yet" : "\(certificates.count) earned"
            )
            if certificates.isEmpty {
                AccountSubText("Finish every lesson in a department and it prints a certificate with your name on it. These are the closest.")
                    .frame(maxWidth: 600, alignment: .leading)
                    .padding(.top, 10)
                closest.padding(.top, 18)
            } else {
                AccountSubText("One for every department you've finished. Open one to save it or share it.")
                    .padding(.top, 10)
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(certificates) { department in
                        certificateRow(department)
                        DashedRule()
                    }
                }
                .padding(.top, 14)
            }
        }
    }

    private func certificateRow(_ department: Department) -> some View {
        NavigationLink(value: AppRoute.certificate(department.id)) {
            HStack(spacing: 14) {
                Image(systemName: department.systemImage)
                    .font(.system(size: iconSize, weight: .semibold))
                    .foregroundStyle(LF.Palette.blue)
                    .frame(width: iconBox, height: iconBox)
                    .background { NotebookBoxBackground(size: .s, shadow: .none) }
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(department.name)
                        .font(LF.Fonts.body(17, weight: .semibold))
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                    if let date = progress.completionDate(of: department) {
                        SlugText("finished \(date.formatted(.dateTime.month(.abbreviated).day().year()))")
                    }
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(LF.Palette.graphite)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 12)
        }
        .buttonStyle(.inkRow)
        .accessibilityHint("Opens the certificate")
    }

    /// A department with some lessons passed, for the "closest to done" strip.
    private struct Started: Identifiable {
        let department: Department
        let done: Int
        let total: Int
        var id: UUID { department.id }
        var fraction: Double { total > 0 ? Double(done) / Double(total) : 0 }
    }

    private var started: [Started] {
        var rows: [Started] = []
        for department in catalog.departments {
            let counts = progress.departmentProgress(department)
            if counts.done > 0, counts.total > 0 {
                rows.append(Started(department: department, done: counts.done, total: counts.total))
            }
        }
        rows.sort { $0.fraction > $1.fraction }
        return Array(rows.prefix(3))
    }

    private var closestColumns: [GridItem] {
        wide
            ? Array(repeating: GridItem(.flexible(), spacing: 28, alignment: .top), count: 3)
            : [GridItem(.flexible())]
    }

    @ViewBuilder
    private var closest: some View {
        let rows = started
        if rows.isEmpty {
            AccountNote("nothing started", "Pass a lesson's quiz and its department shows up here with how far along you are.")
        } else {
            LazyVGrid(columns: closestColumns, alignment: .leading, spacing: 18) {
                ForEach(rows) { row in
                    startedCard(row)
                }
            }
        }
    }

    private func startedCard(_ row: Started) -> some View {
        NavigationLink(value: AppRoute.department(row.department.id)) {
            VStack(alignment: .leading, spacing: 8) {
                // Two lines keep the three cards level on a wide window; one card per row
                // on a phone shows the whole name at any text size.
                Text(row.department.name)
                    .font(LF.Fonts.body(16, weight: .semibold))
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .lineLimit(wide ? 2 : nil)
                    .fixedSize(horizontal: false, vertical: !wide)
                MeterView(value: row.fraction, valueText: "\(row.done)/\(row.total)", style: .slim)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .notebookBox(radius: .a, shadow: .card)
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel("\(row.department.name), \(row.done) of \(row.total) lessons")
    }
}

// MARK: - Badges

/// Badges as a checklist you read down: the box is ticked or empty AND the line says which,
/// so the state survives a photocopy. Unearned lesson badges show how close they are.
struct ProfileBadgeChecklist: View {
    let wide: Bool

    @Environment(ProgressStore.self) private var progress
    @Environment(CatalogStore.self) private var catalog

    var body: some View {
        let badges = catalog.achievements.sorted { $0.sortOrder < $1.sortOrder }
        let earned = badges.filter { progress.isEarned($0) }.count
        VStack(alignment: .leading, spacing: 0) {
            AccountSectionHeading(title: "Badges")
            AccountSubText(earned > 0
                ? "\(earned) of \(badges.count) ticked off."
                : "None ticked off yet. Every one of them comes out of lessons you were going to read anyway.")
                .padding(.top, 10)

            if badges.isEmpty {
                AccountSubText("The badge list is empty right now. It fills back in when the next season's set is published.")
                    .padding(.top, 14)
            } else {
                LazyVGrid(
                    columns: accountColumns(wide ? 2 : 1, spacing: 36),
                    alignment: .leading,
                    spacing: 0
                ) {
                    ForEach(badges) { badge in
                        badgeRow(badge)
                            .padding(.vertical, 14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .overlay(alignment: .bottom) { DashedRule() }
                    }
                }
                .padding(.top, 14)

                NavigationLink("See every badge", value: AppRoute.achievements)
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 20)
            }
        }
    }

    private func badgeRow(_ badge: Achievement) -> some View {
        let isEarned = progress.isEarned(badge)
        // Only lesson-count badges show how close they are (the site's `isNudgeableCriteria`):
        // a streak badge never dangles, and a finished count never sits under "not yet".
        let toward = (isEarned || !badge.criteria.isNudgeable) ? nil : progress.progress(toward: badge)
        return HStack(alignment: .top, spacing: 14) {
            AccountCheckBox(isOn: isEarned)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 4) {
                SlugText(statusLine(badge, earned: isEarned))
                Text(badge.name)
                    .font(LF.Fonts.display(18, relativeTo: .headline))
                    .tracking(18 * -0.02)
                    .foregroundStyle(isEarned ? LF.Palette.ink : LF.Palette.graphite)
                Text(badge.description)
                    .font(LF.Fonts.body(14.5, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                if let toward, toward.target > 1, toward.current > 0, toward.remaining > 0 {
                    MeterView(value: toward.fraction, valueText: "\(toward.current)/\(toward.target)", style: .slim)
                        .frame(maxWidth: 260)
                        .padding(.top, 4)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func statusLine(_ badge: Achievement, earned: Bool) -> String {
        guard earned else { return "not yet" }
        if let date = progress.earnedDate(badge) {
            return "earned \(date.formatted(.dateTime.month(.abbreviated).day().year()))"
        }
        return "earned"
    }
}

// MARK: - Bookmarks

/// The way into the reading list (the site's `/bookmarks`): a ruled row with how many
/// lessons are set aside. Guests get the same row; their bookmarks live on this device.
struct ProfileBookmarksLink: View {
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let count = progress.bookmarkedLessons.count
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            NavigationLink(value: AppRoute.bookmarks) {
                Group {
                    if typeSize.isAccessibilitySize {
                        // The words get the whole width; the count and arrow go under them.
                        VStack(alignment: .leading, spacing: 10) {
                            words(count)
                            HStack(alignment: .center, spacing: 14) {
                                CountText(count, unit: "saved", size: 24)
                                    .fixedSize()
                                Spacer(minLength: 8)
                                arrow
                            }
                        }
                    } else {
                        HStack(alignment: .center, spacing: 14) {
                            words(count)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            CountText(count, unit: "saved", size: 24)
                                .fixedSize()
                            arrow
                        }
                    }
                }
                .padding(.vertical, 14)
            }
            .buttonStyle(.inkRow)
            .accessibilityLabel(Text(verbatim: "Bookmarks, \(count) saved"))
            .accessibilityHint("Opens the lessons you set aside")
            DashedRule()
        }
    }

    private func words(_ count: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            SlugText(account.isGuest ? "your reading list / this device" : "your reading list")
                .fixedSize(horizontal: false, vertical: true)
            Text("Bookmarks")
                .font(LF.Fonts.display(21, relativeTo: .title3))
                .tracking(21 * -0.02)
                .foregroundStyle(LF.Palette.ink)
            Text(detail(count))
                .font(LF.Fonts.body(14.5, relativeTo: .subheadline))
                .foregroundStyle(LF.Palette.graphite)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var arrow: some View {
        Image(systemName: "arrow.right")
            .font(.footnote.weight(.bold))
            .foregroundStyle(LF.Palette.blue)
            .accessibilityHidden(true)
    }

    private func detail(_ count: Int) -> String {
        switch count {
        case 0: "Nothing set aside yet. Every lesson has a bookmark on it."
        case 1: "1 lesson you set aside, ready to pick up any time."
        default: "\(count) lessons you set aside, ready to pick up any time."
        }
    }
}

// MARK: - Guest tally

/// What this device has kept for a guest.
struct ProfileGuestTally: View {
    let lessons: Int
    let rhythm: Rhythm?

    var body: some View {
        NotebookCard(tilt: .preset(1), tape: true, padding: 22) {
            AccountSheetSlug("this device / so far")
            HStack(alignment: .top, spacing: 36) {
                figure(lessons.formatted(), lessons == 1 ? "lesson passed" : "lessons passed")
                if let rhythm {
                    figure("\(rhythm.windowCount)/\(rhythm.goal)", rhythm.windowLabel.lowercased())
                }
            }
            .padding(.top, 18)
            MarkerText(lessons > 0 ? "sign up and these move onto your account" : "pass a quiz and it's counted here", size: 20)
                .padding(.top, 18)
        }
    }

    private func figure(_ value: String, _ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(LF.Fonts.mono(30, weight: .bold, relativeTo: .title))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
            SlugText(unit)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Flow layout

/// Lays children out left to right, wrapping onto new lines (tags, figures). A child wider
/// than the whole line is offered the line's width, so it never runs past the edge.
struct AccountFlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let rows = arrange(subviews, width: width)
        let height = rows.reduce(0) { $0 + $1.height } + CGFloat(max(0, rows.count - 1)) * lineSpacing
        let used = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? used, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews, width: bounds.width) {
            var x = bounds.minX
            for index in row.indices {
                let size = fittedSize(of: subviews[index], width: bounds.width)
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    /// The child's own size, or its size at the line's width when it wouldn't fit on a line alone.
    private func fittedSize(of subview: LayoutSubview, width: CGFloat) -> CGSize {
        let ideal = subview.sizeThatFits(.unspecified)
        guard ideal.width > width, width.isFinite else { return ideal }
        return subview.sizeThatFits(ProposedViewSize(width: width, height: nil))
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            let size = fittedSize(of: subviews[index], width: width)
            let needed = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            if needed > width, !current.indices.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.width = current.indices.isEmpty ? size.width : current.width + spacing + size.width
            current.height = max(current.height, size.height)
            current.indices.append(index)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}

// MARK: - Previews

private struct ProfilePreviewHost: View {
    var body: some View {
        NavigationStack {
            ProfileView()
                .navigationDestination(for: AppRoute.self) { route in
                    Text(String(describing: route))
                }
        }
    }
}

#Preview("Profile, iPhone", traits: .fixedLayout(width: 393, height: 2900)) {
    ProfilePreviewHost()
        .appEnvironment(.preview(phase: .goalMet))
}

#Preview("Profile, iPhone, night", traits: .fixedLayout(width: 393, height: 2900)) {
    ProfilePreviewHost()
        .appEnvironment(.preview(phase: .goalMet))
        .environment(\.colorScheme, .dark)
}

#Preview("Profile, iPad", traits: .fixedLayout(width: 1024, height: 2200)) {
    ProfilePreviewHost()
        .appEnvironment(.preview(phase: .goalMet))
}

#Preview("Profile, iPad, night", traits: .fixedLayout(width: 1024, height: 2200)) {
    ProfilePreviewHost()
        .appEnvironment(.preview(phase: .goalMet))
        .environment(\.colorScheme, .dark)
}

#Preview("Profile, guest", traits: .fixedLayout(width: 393, height: 1200)) {
    ProfilePreviewHost()
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Profile, guest, iPad, night", traits: .fixedLayout(width: 1024, height: 900)) {
    ProfilePreviewHost()
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}
