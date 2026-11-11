import SwiftUI

/// Which of the site's profile-setup asks (the `/account/username` step, and
/// `getProfileSetupState` in `src/lib/onboarding-server.ts`, drawn by
/// `profile-setup-form.tsx`) the step shows.
enum UsernameSetupMode: Sendable {
    /// Username not chosen yet (a generated handle): the hard stop that covers the app
    /// (`Me.needsUsernameSetup`).
    case required
    /// A machine-made placeholder handle: the skippable "pick your own" card
    /// (`Me.isPlaceholderUsername`). Retired on the server 2026-11-11, which now always
    /// sends that false; kept for older servers.
    case soft
    /// A handle that's the account's own but no team number: the skippable team-only card
    /// (the site's `mode: "team"`).
    case team
}

/// The username gate (ARCHITECTURE 6.2, the site's `/account/username` step). A signed-in
/// account whose username was generated (Google sign-in) sees this before the rest of the
/// app: the username is the name on the leaderboard, the profile page and the team page.
/// Username starts as the current handle, never anything from the email; saving it
/// unchanged keeps it. Saving goes through `POST /api/app/profile/setup`, the same function
/// the website calls.
///
///     if account.needsUsernameSetup { UsernameSetupView() }          // the shell's gate
///     UsernameSetupView(mode: .soft, onSkip: { ... })                 // a handle minted for them
///     UsernameSetupView(mode: .team, onSkip: { ... })                 // their own handle, no team
///
/// `.soft` (or `required: false`) is the retired softer ask for an account carrying a
/// machine-made placeholder handle, kept for older servers: the card alone, with "Skip for
/// now" and no sign-out line, and an empty Username, never the placeholder itself. `.team`
/// is the site's team-only card for an account whose handle is its own: just the team
/// number, required, saved through the same call with nothing else. The team box always
/// starts blank, like the site's.
struct UsernameSetupView: View {
    @Environment(AccountStore.self) private var account

    @State private var username: String
    @State private var teamNumber = ""
    @State private var error: String?
    @State private var usernameError: String?
    @State private var teamError: String?
    @State private var isSaving = false
    @State private var isSigningOut = false
    @FocusState private var focus: Field?

    private let mode: UsernameSetupMode
    private let onFinished: (() -> Void)?
    private let onSkip: (() -> Void)?

    private enum Field: Hashable { case username, team }

    /// `required: true` is the gate, `false` the placeholder-handle card (`.soft`).
    init(required: Bool = true, onFinished: (() -> Void)? = nil, onSkip: (() -> Void)? = nil) {
        self.init(mode: required ? .required : .soft, onFinished: onFinished, onSkip: onSkip)
    }

    init(mode: UsernameSetupMode, onFinished: (() -> Void)? = nil, onSkip: (() -> Void)? = nil) {
        self.mode = mode
        self.onFinished = onFinished
        self.onSkip = onSkip
        _username = State(initialValue: "")
    }

    private var required: Bool { mode == .required }
    /// The card asks for a username (the site's `needsUsername`): every mode but `.team`.
    private var asksForUsername: Bool { mode != .team }

    /// The site's `maxLength={20}` on the username box.
    static let maxLength = 20

    /// The site's message for a team-only ask sent blank (`saveProfileSetupFields`).
    static let teamRequiredMessage = "Enter your team number, or choose Skip for now."

    var body: some View {
        AccountPage(maxWidth: 640) { page in
            VStack(alignment: .leading, spacing: 0) {
                if required {
                    // The site's /account/username step, word for word.
                    AccountHeader(
                        marker: "one thing first",
                        title: "Choose your username",
                        lede: requiredLede
                    )
                    card(width: page.width).padding(.top, 28)
                    signedInAs.padding(.top, 28)
                } else {
                    // The site's skippable card has no heading over it; its own title leads.
                    card(width: page.width).padding(.top, 14)
                }
            }
        }
        .navigationTitle(asksForUsername ? "Your username" : "Your team number")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        #if os(macOS)
        .defaultFocus($focus, asksForUsername ? .username : .team)
        #endif
        .task { prefillUsername() }
        // A gate drawn from a cached /me that had no username yet gets the handle once a
        // fresh /me brings it, so keeping it never means typing it back in.
        .onChange(of: account.profile?.username) { _, _ in prefillUsername() }
    }

    /// The current (generated) handle, as the site prefills it; never anything from the
    /// email, and never an old placeholder. Only into an empty box, so it never replaces
    /// what someone typed. The team box starts blank in every mode, like the site's (it
    /// never prefills the team).
    private func prefillUsername() {
        guard asksForUsername, username.isEmpty else { return }
        let current = account.profile?.username
        username = (account.me?.isPlaceholderUsername == true ? nil : current) ?? ""
    }

    /// The handle the account has now, when the box still holds it unchanged: saving then
    /// keeps it, the site's "Keep @handle".
    private var keepsCurrentHandle: String? {
        guard required, let current = account.profile?.username, !current.isEmpty else { return nil }
        return AccountStore.normalizeUsername(username.accountTrimmed) == current ? current : nil
    }

    /// The site's lede on `/account/username`, naming the handle the account was given.
    private var requiredLede: String {
        let tail = "It's the name people see on the leaderboard, your profile page and your team page."
        guard let handle = account.profile?.username, !handle.isEmpty else { return tail }
        return "We gave your account the username @\(handle) so it works right away. Keep it, or pick one of your own. \(tail)"
    }

    // MARK: The card (the site's `ProfileSetupForm`, word for word)

    private var slug: String {
        switch mode {
        case .required: "profile / your username"
        case .soft: "profile / no handle yet"
        case .team: "profile / no team number"
        }
    }

    private var title: String {
        switch mode {
        case .required: "Keep it, or pick your own."
        case .soft: "You're showing up under a name you didn't pick."
        case .team: "Add your team number."
        }
    }

    private var explanation: String {
        switch mode {
        case .required: "Letters, numbers and _, 3 to 20 characters. Don't use your real name, email or school. The team number is optional and can wait."
        case .soft: "Your handle was minted for you, so it is not really yours. Pick one you would want next to your name on the leaderboard. The team number is optional."
        case .team: "Put your FRC team number in and you show up alongside your teammates on the team page and on the leaderboard."
        }
    }

    private func card(width: CGFloat) -> some View {
        NotebookCard(tape: true, padding: 22, tapeAngle: -3.4) {
            AccountSheetSlug(slug)

            VStack(alignment: .leading, spacing: 18) {
                Text(title)
                    .font(LF.Fonts.display(22, relativeTo: .title2))
                    .tracking(22 * -0.025)
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)

                AccountSubText(explanation)

                if let error {
                    FieldError(error)
                }

                if asksForUsername {
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: 16) {
                            usernameField
                            teamField.frame(width: 160)
                        }
                        .frame(minWidth: 420)
                        VStack(alignment: .leading, spacing: 18) {
                            usernameField
                            teamField
                        }
                    }
                } else {
                    // The site's lone team box is at most 13rem wide from its `sm` width up,
                    // and the whole width on a phone (or at the larger text sizes).
                    teamField
                        .frame(maxWidth: width >= 640 ? 208 : .infinity, alignment: .leading)
                }

                VStack(alignment: .leading, spacing: 16) {
                    DashedRule()
                    // Side by side while both fit whole (the site's flex-wrap), stacked otherwise.
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 12) { actions }
                        VStack(alignment: .leading, spacing: 12) { actions }
                    }
                }
            }
            .padding(.top, 18)
            .disabled(isSaving)
        }
        .accountKeyboardBar($focus, order: asksForUsername ? [.username, .team] : [.team], action: "Save", actionEnabled: !isSaving, perform: save)
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    /// The gate's one button says what it will do, like the site's two: "Keep @handle"
    /// while the box holds the current handle, "Save username" once it's changed. The
    /// optional cards keep "Save it".
    private var saveLabel: String {
        guard required else { return isSaving ? "Saving" : "Save it" }
        if let kept = keepsCurrentHandle { return isSaving ? "Keeping" : "Keep @\(kept)" }
        return isSaving ? "Saving" : "Save username"
    }

    @ViewBuilder
    private var actions: some View {
        Button(action: save) {
            Text(saveLabel)
        }
        .buttonStyle(.ink)
        .keyboardShortcut(.defaultAction)
        if !required {
            Button("Skip for now") { onSkip?() }
                .buttonStyle(.inkGhost)
        }
    }

    private var usernameField: some View {
        AccountField(
            "Username", text: $username, kind: .username,
            focus: $focus, field: .username,
            hint: "Public. Letters, numbers and underscores.",
            error: usernameError,
            onSubmit: { focus = .team }
        )
        // Like the site's box, it stops taking characters at 20, except for the handle the
        // account already has: a few older ones are longer, and cutting one short would
        // turn keeping it into a rename.
        .onChange(of: username) { _, new in
            if new.count > Self.maxLength, new != account.profile?.username {
                username = String(new.prefix(Self.maxLength))
            }
        }
    }

    private var teamField: some View {
        AccountField(
            asksForUsername ? "Team #, optional" : "Team #", text: $teamNumber, kind: .teamNumber,
            focus: $focus, field: .team,
            hint: "Like 254.",
            error: teamError,
            submitLabel: .done,
            onSubmit: save
        )
    }

    private var signedInAs: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let email = account.me?.user.email {
                Text("Signed in as \(Text(email).font(LF.Fonts.mono(14, weight: .bold, relativeTo: .subheadline)).foregroundStyle(LF.Palette.ink)). Not you, or not now?")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button(isSigningOut ? "Signing out" : "Sign out") {
                isSigningOut = true
                Task {
                    await account.signOut()
                    isSigningOut = false
                }
            }
            .buttonStyle(.inkGhostSmall)
            .disabled(isSigningOut || isSaving)
        }
    }

    private func save() {
        guard !isSaving else { return }
        error = nil
        usernameError = nil
        teamError = nil
        if !asksForUsername {
            saveTeamNumber()
            return
        }
        let handle = AccountStore.normalizeUsername(username.accountTrimmed)
        if handle.count < 3 {
            usernameError = AccountStore.usernameRule
            focus = .username
            return
        }
        var team: Int?
        if !teamNumber.isEmpty {
            guard let number = Int(teamNumber), (1...99_999).contains(number) else {
                teamError = AccountStore.teamNumberRule
                focus = .team
                return
            }
            team = number
        }
        focus = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await account.setupUsername(handle, teamNumber: team)
                Haptics.success()
                accountAnnounce("Saved. Your username is \(handle).")
                onFinished?()
            } catch {
                self.error = error.accountMessage
            }
        }
    }

    /// The team-only card: the team number, required, through the same
    /// `POST /api/app/profile/setup` as the site's card, with only the team number
    /// (`AccountStore.setupTeamNumber`).
    private func saveTeamNumber() {
        let typed = teamNumber.accountTrimmed
        guard !typed.isEmpty else {
            teamError = Self.teamRequiredMessage
            focus = .team
            return
        }
        guard let number = Int(typed), (1...99_999).contains(number) else {
            teamError = AccountStore.teamNumberRule
            focus = .team
            return
        }
        focus = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await account.setupTeamNumber(number)
                Haptics.success()
                accountAnnounce("Saved. Your team number is \(number).")
                onFinished?()
            } catch {
                self.error = error.accountMessage
            }
        }
    }
}

/// An account carrying a minted handle, for the soft step's previews.
private let previewPlaceholderMe = Me(
    user: Me.User(id: UUID(uuidString: "6c1f0a52-3b7e-4d19-9a2e-1f4b7c8d9e03")!, email: "riley.chen@example.com"),
    profile: Profile(id: UUID(uuidString: "6c1f0a52-3b7e-4d19-9a2e-1f4b7c8d9e03")!, username: "cosmic_builder_77", teamNumber: 9765, createdAt: PreviewData.now),
    needsUsernameSetup: false,
    isPlaceholderUsername: true
)

/// An account with its own handle and no team number, for the team-only card's previews.
private let previewTeamlessMe = Me(
    user: Me.User(id: UUID(uuidString: "0d9b6c3e-71a4-4f2b-8e55-3c2a9f17b604")!, email: "sam.okafor@example.com"),
    profile: Profile(id: UUID(uuidString: "0d9b6c3e-71a4-4f2b-8e55-3c2a9f17b604")!, username: "sam_builds", teamNumber: nil, createdAt: PreviewData.now),
    needsUsernameSetup: false,
    isPlaceholderUsername: false
)

#Preview("Team number, iPhone", traits: .fixedLayout(width: 393, height: 900)) {
    NavigationStack { UsernameSetupView(mode: .team, onSkip: {}) }
        .appEnvironment(.preview(me: previewTeamlessMe))
}

#Preview("Team number, iPhone, night, AX5", traits: .fixedLayout(width: 393, height: 2200)) {
    NavigationStack { UsernameSetupView(mode: .team, onSkip: {}) }
        .appEnvironment(.preview(me: previewTeamlessMe))
        .environment(\.colorScheme, .dark)
        .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Team number, iPad", traits: .fixedLayout(width: 1024, height: 800)) {
    NavigationStack { UsernameSetupView(mode: .team, onSkip: {}) }
        .appEnvironment(.preview(me: previewTeamlessMe))
}

#Preview("Username gate, iPhone", traits: .fixedLayout(width: 393, height: 900)) {
    NavigationStack { UsernameSetupView() }
        .appEnvironment(.preview(me: PreviewData.meNeedsUsername))
}

#Preview("Username gate, iPhone, night", traits: .fixedLayout(width: 393, height: 900)) {
    NavigationStack { UsernameSetupView() }
        .appEnvironment(.preview(me: PreviewData.meNeedsUsername))
        .environment(\.colorScheme, .dark)
}

#Preview("Username gate, iPad, night", traits: .fixedLayout(width: 1024, height: 800)) {
    NavigationStack { UsernameSetupView() }
        .appEnvironment(.preview(me: PreviewData.meNeedsUsername))
        .environment(\.colorScheme, .dark)
}

#Preview("Placeholder handle, iPhone", traits: .fixedLayout(width: 393, height: 900)) {
    NavigationStack { UsernameSetupView(required: false, onSkip: {}) }
        .appEnvironment(.preview(me: previewPlaceholderMe))
}

#Preview("Placeholder handle, iPhone, AX5", traits: .fixedLayout(width: 393, height: 2600)) {
    NavigationStack { UsernameSetupView(required: false, onSkip: {}) }
        .appEnvironment(.preview(me: previewPlaceholderMe))
        .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Placeholder handle, iPad", traits: .fixedLayout(width: 1024, height: 800)) {
    NavigationStack { UsernameSetupView(required: false, onSkip: {}) }
        .appEnvironment(.preview(me: previewPlaceholderMe))
}

#Preview("Placeholder handle, iPad, night, AX5", traits: .fixedLayout(width: 1024, height: 1800)) {
    NavigationStack { UsernameSetupView(required: false, onSkip: {}) }
        .appEnvironment(.preview(me: previewPlaceholderMe))
        .environment(\.colorScheme, .dark)
        .environment(\.dynamicTypeSize, .accessibility5)
}
