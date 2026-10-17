import SwiftUI

/// Settings, as the member's own page in the binder (the site's `/settings`), plus the
/// things that only make sense on a device: the daily study reminder and the appearance.
///
/// Signed in: the member record, the profile form, reminder emails, the daily reminder,
/// appearance, password, session, and account deletion with a typed confirmation.
/// Guest: what an account is for, with sign-in and sign-up, then the device settings.
///
///     NavigationLink(value: AppRoute.settings)              // the shell maps it to SettingsView()
///     Settings { SettingsView(context: .window) }           // the Mac Settings window
///
/// In `.window` context there's no navigation stack, so links to other screens (your
/// public page) go through `AppModel.open(_:)`, which shows them in the main window.
struct SettingsView: View {
    enum Context: Hashable, Sendable {
        /// Pushed inside a `NavigationStack` with the shell's `AppRoute` destinations.
        case navigation
        /// The Mac `Settings` scene: no stack; routes open in the main window.
        case window
    }

    @Environment(AccountStore.self) private var account
    @Environment(ProgressStore.self) private var progress
    @Environment(AppModel.self) private var model

    @State private var authScreen: AuthFlowView.Screen?
    @State private var justDeleted = false
    @State private var justSignedOut = false

    private let context: Context

    init(context: Context = .navigation) {
        self.context = context
    }

    var body: some View {
        Group {
            #if os(macOS)
            if context == .window {
                macPanes
            } else {
                page
            }
            #else
            page
            #endif
        }
        .navigationTitle("Settings")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .authSheet(item: $authScreen)
        .refreshable {
            await account.refreshMe(force: true)
        }
        .onChange(of: account.isSignedIn) { wasSignedIn, isSignedIn in
            if isSignedIn {
                justSignedOut = false
                justDeleted = false
            } else if wasSignedIn {
                // Say it worked: the page jumps back to the top, where this note is.
                justSignedOut = true
            }
        }
    }

    /// Which account the page is showing; when it changes the page goes back to the top.
    private var authKey: String {
        switch account.state {
        case .signedIn(let me): "in-\(me.user.id.uuidString)"
        case .guest: "guest"
        case .loading: "loading"
        }
    }

    /// The whole page: iPhone, iPad, and the Mac's main window.
    private var page: some View {
        AccountPage(maxWidth: 780, resetKey: authKey, place: .route(.settings), fold: .spread) { page in
            VStack(alignment: .leading, spacing: 0) {
                switch account.state {
                case .signedIn(let me):
                    signedIn(me, pages: page.pages)
                case .guest:
                    guest(pages: page.pages)
                case .loading:
                    loading
                        .foldLeadingPage(page.pages)
                }
            }
        }
    }

    // MARK: Signed in

    /// Your record and your profile, then how the app reaches you and how you sign in. On an
    /// open iPhone Duo those are the two pages: the record on the left, the rest on the right.
    @ViewBuilder
    private func signedIn(_ me: Me, pages: FoldColumns?) -> some View {
        FoldPages(pages) {
            VStack(alignment: .leading, spacing: 0) {
                AccountHeader(
                    marker: "settings / your own record",
                    title: accountMarked("Your details, and ", "who can see them", "."),
                    lede: "Everything here is yours to change. Saving updates your public profile, the leaderboard and your team's roster at the same time."
                )

                SettingsIdentityCard(me: me, xp: max(progress.xp, me.profile.xp))
                    .padding(.top, 26)

                if let username = me.profile.username {
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 12) { publicPageButtons(username) }
                        VStack(alignment: .leading, spacing: 12) { publicPageButtons(username) }
                    }
                    .padding(.top, 18)
                }

                section(spacing: 24) {
                    AccountSectionHeading(title: "Profile", slug: "your full name is never shown publicly")
                    if me.isProvisional {
                        AccountNote("offline", "Your profile loads when this device is back online. Nothing you change elsewhere is lost.")
                    } else {
                        SettingsProfileForm(me: me)
                            .id(me.user.id)
                    }
                }
            }
        } trailing: {
            VStack(alignment: .leading, spacing: 0) {
                // The right-hand page starts level with the left one.
                section(spacing: 18, top: pages == nil ? 48 : 0) {
                    AccountSectionHeading(title: "Reminders", slug: "all of them off unless you say so")
                    SettingsEmailRemindersCard(me: me)
                        .id(me.user.id)
                    SettingsDailyReminderCard()
                }

                section(spacing: 18) {
                    AccountSectionHeading(title: "Appearance")
                    SettingsAppearanceCard()
                }

                section(spacing: 22) {
                    AccountSectionHeading(title: "Sign-in", slug: "the same for the app and learnfrc.com")
                    SettingsSessionSection(me: me)
                    SettingsPasswordCard()
                }

                SettingsDeleteAccountBox(onDeleted: { justDeleted = true })
                    .padding(.top, 36)

                section(spacing: 0) {
                    SettingsAboutSection()
                }
            }
        }
    }

    /// Side by side when both fit on one line (`ViewThatFits` checks their full width);
    /// stacked otherwise, where a label too long for the line wraps instead of running off it.
    @ViewBuilder
    private func publicPageButtons(_ username: String) -> some View {
        routeButton("Public page, as others see it", route: .profile(username))
            .fixedSize(horizontal: false, vertical: true)
        ShareLink(item: AccountLinks.publicProfile(username)) {
            Label("Share it", systemImage: "square.and.arrow.up")
        }
        .buttonStyle(.inkGhostSmall)
        .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: Guest

    /// What an account is for, then the device's own settings. On an open iPhone Duo, the
    /// account on the left page and the device on the right.
    @ViewBuilder
    private func guest(pages: FoldColumns?) -> some View {
        FoldPages(pages) {
            VStack(alignment: .leading, spacing: 0) {
                AccountHeader(
                    marker: "settings / this device",
                    title: justDeleted ? "Your account is deleted." : "Settings",
                    lede: justDeleted
                        ? "Everything tied to it is gone from learnfrc.com. The guides and articles never needed an account, so keep reading whenever you like."
                        : "You're reading as a guest. Reminders and appearance live on this device. An account adds a profile, certificates and your team's page."
                )

                if justSignedOut && !justDeleted {
                    signedOutNote.padding(.top, 26)
                }

                if !justDeleted {
                    guestCard.padding(.top, 26)
                }
            }
        } trailing: {
            VStack(alignment: .leading, spacing: 0) {
                section(spacing: 18, top: pages == nil ? 48 : 0) {
                    AccountSectionHeading(title: "Reminders", slug: "off unless you say so")
                    SettingsDailyReminderCard()
                }

                section(spacing: 18) {
                    AccountSectionHeading(title: "Appearance")
                    SettingsAppearanceCard()
                }

                section(spacing: 0) {
                    SettingsAboutSection()
                }
            }
        }
    }

    private var signedOutNote: some View {
        AccountNote("signed out", "This device is signed out. Your progress, XP and certificates are still on your account; sign in on any device to pick them back up.")
    }

    private var guestCard: some View {
        NotebookCard(tape: true, padding: 22) {
            AccountSheetSlug("account / none on this device")
            VStack(alignment: .leading, spacing: 14) {
                AccountCardTitle("Keep your progress everywhere.")
                AccountDefinitionList(items: AccountPitch.keeps)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) { guestButtons }
                    VStack(alignment: .leading, spacing: 12) { guestButtons }
                }
                .padding(.top, 6)
            }
            .padding(.top, 16)
        }
    }

    @ViewBuilder
    private var guestButtons: some View {
        Button("Create a free account") { authScreen = .signUp }
            .buttonStyle(.ink)
        Button("Sign in") { authScreen = .signIn }
            .buttonStyle(.inkGhost)
    }

    // MARK: The Mac Settings window

    #if os(macOS)
    /// The Settings window (⌘,): a few short panes in a narrow column instead of the one long
    /// iPhone page. The first pane has no text field, so the window never opens with a field
    /// focused and its text selected.
    private var macPanes: some View {
        TabView {
            Tab("Account", systemImage: "person.crop.circle") {
                macPane { macAccountPane }
            }
            Tab("Profile", systemImage: "pencil") {
                macPane { macProfilePane }
            }
            Tab("Reminders", systemImage: "bell") {
                macPane { macRemindersPane }
            }
            Tab("Appearance", systemImage: "circle.lefthalf.filled") {
                macPane {
                    SettingsAppearanceCard()
                }
            }
        }
        .tabViewStyle(.automatic)
        .frame(width: 600)
        .frame(minHeight: 560)
    }

    private func macPane<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        let content = content()
        return AccountPage(maxWidth: 560, resetKey: authKey) { _ in
            VStack(alignment: .leading, spacing: 22) {
                content
            }
        }
    }

    @ViewBuilder
    private var macAccountPane: some View {
        switch account.state {
        case .signedIn(let me):
            SettingsIdentityCard(me: me, xp: max(progress.xp, me.profile.xp))
            if let username = me.profile.username {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) { publicPageButtons(username) }
                    VStack(alignment: .leading, spacing: 12) { publicPageButtons(username) }
                }
            }
            AccountSectionHeading(title: "Sign-in", slug: "the same for the app and learnfrc.com")
                .padding(.top, 10)
            SettingsSessionSection(me: me)
            SettingsPasswordCard()
            SettingsDeleteAccountBox(onDeleted: { justDeleted = true })
                .padding(.top, 10)
            SettingsAboutSection()
                .padding(.top, 10)
        case .guest:
            AccountHeader(
                marker: "settings / this device",
                title: justDeleted ? "Your account is deleted." : "Settings",
                lede: justDeleted
                    ? "Everything tied to it is gone from learnfrc.com. The guides and articles never needed an account, so keep reading whenever you like."
                    : "You're reading as a guest. Reminders and appearance live on this device. An account adds a profile, certificates and your team's page."
            )
            if justSignedOut && !justDeleted { signedOutNote }
            if !justDeleted { guestCard }
            SettingsAboutSection()
                .padding(.top, 10)
        case .loading:
            loading
        }
    }

    @ViewBuilder
    private var macProfilePane: some View {
        switch account.state {
        case .signedIn(let me):
            AccountSectionHeading(title: "Profile", slug: "your full name is never shown publicly")
            if me.isProvisional {
                AccountNote("offline", "Your profile loads when this device is back online. Nothing you change elsewhere is lost.")
            } else {
                SettingsProfileForm(me: me)
                    .id(me.user.id)
            }
        case .guest:
            AccountSectionHeading(title: "Profile")
            AccountNote("no account", "A profile belongs to an account: your username, team number and the bio on your public page. Sign in or make one under Account.")
        case .loading:
            loading
        }
    }

    @ViewBuilder
    private var macRemindersPane: some View {
        AccountSectionHeading(title: "Reminders", slug: account.isSignedIn ? "all of them off unless you say so" : "off unless you say so")
        if let me = account.me {
            SettingsEmailRemindersCard(me: me)
                .id(me.user.id)
        }
        SettingsDailyReminderCard()
    }
    #endif

    // MARK: Loading

    private var loading: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("settings")
            SkeletonBlock(height: 40, width: 260)
            SkeletonBlock(height: 18)
            SkeletonBlock(height: 140)
                .padding(.top, 14)
        }
    }

    // MARK: Pieces

    private func section<Content: View>(spacing: CGFloat, top: CGFloat = 48, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: spacing) { content() }
            .padding(.top, top)
    }

    @ViewBuilder
    private func routeButton(_ title: String, route: AppRoute) -> some View {
        switch context {
        case .navigation:
            NavigationLink(title, value: route)
                .buttonStyle(.inkGhostSmall)
        case .window:
            Button(title) { model.open(route) }
                .buttonStyle(.inkGhostSmall)
        }
    }
}

// MARK: - Previews

private struct SettingsPreviewHost: View {
    var body: some View {
        NavigationStack {
            SettingsView()
                .navigationDestination(for: AppRoute.self) { route in
                    Text(String(describing: route))
                }
        }
    }
}

#Preview("Settings, iPhone", traits: .fixedLayout(width: 393, height: 3400)) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
}

#Preview("Settings, iPhone, night", traits: .fixedLayout(width: 393, height: 3400)) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#Preview("Settings, iPad", traits: .fixedLayout(width: 1024, height: 3000)) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
}

#Preview("Settings, iPad, night", traits: .fixedLayout(width: 1024, height: 3000)) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#Preview("Settings, guest", traits: .fixedLayout(width: 393, height: 1800)) {
    SettingsPreviewHost()
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Settings, small iPhone, largest text", traits: .fixedLayout(width: 375, height: 4200)) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
        .environment(\.dynamicTypeSize, .xxxLarge)
}

#Preview("Settings, small iPhone, night", traits: .fixedLayout(width: 375, height: 3400)) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#Preview("Settings, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 2000)) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
        .previewFold(.previewBook)
}

#Preview("Settings, iPhone Duo open, guest, night", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 1400)) {
    SettingsPreviewHost()
        .appEnvironment(.preview(signedIn: false))
        .previewFold(.previewFlat)
        .environment(\.colorScheme, .dark)
}

#Preview("Settings, iPhone Duo cover", traits: .duoCover) {
    SettingsPreviewHost()
        .appEnvironment(.preview)
        .previewFold(.previewClosed)
}

#if os(macOS)
#Preview("Settings window, Mac", traits: .fixedLayout(width: 600, height: 700)) {
    SettingsView(context: .window)
        .appEnvironment(.preview)
}
#endif
