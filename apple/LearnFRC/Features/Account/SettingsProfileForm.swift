import SwiftUI

/// The profile form (the site's `SettingsForm`): the one place a member edits their own
/// record. Same fields, hints and limits as the website; saving sends only what changed
/// to `PATCH /api/app/profile`, which runs the website's own checks (unique username,
/// profanity, team-number changes a day) and answers in its own words.
struct SettingsProfileForm: View {
    let me: Me

    @Environment(AccountStore.self) private var account

    @State private var fullName: String
    @State private var username: String
    @State private var teamNumber: String
    @State private var role: ProfileRole
    @State private var avatarURL: String
    @State private var bio: String

    @State private var error: String?
    @State private var fieldErrors: [Field: String] = [:]
    @State private var isSaving = false
    @State private var saved = false
    @State private var savedSnapshot: Snapshot?
    @FocusState private var focus: Field?
    @Environment(AccountScroller.self) private var scroller: AccountScroller?

    fileprivate enum Field: Hashable {
        case fullName, username, team, avatar, bio

        /// Top to bottom, for the keyboard bar's previous and next.
        static let order: [Field] = [.fullName, .username, .team, .avatar, .bio]
    }

    static let bioLimit = 500

    init(me: Me) {
        self.me = me
        let p = me.profile
        _fullName = State(initialValue: p.fullName ?? "")
        _username = State(initialValue: p.username ?? "")
        _teamNumber = State(initialValue: p.teamNumber.map(String.init) ?? "")
        _role = State(initialValue: p.roleKind)
        _avatarURL = State(initialValue: p.avatarUrl ?? "")
        _bio = State(initialValue: p.bio ?? "")
    }

    /// The labels the site's settings form uses ("Other" here, "Member" elsewhere).
    static func roleLabel(_ role: ProfileRole) -> String {
        role == .other ? "Other" : role.displayName
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            appearsAs

            AccountReadOnlyField(
                label: "Email",
                value: me.user.email ?? "No email on file",
                hint: "Your sign-in email. It can't be changed here."
            )

            AccountField(
                "Full name", text: $fullName, kind: .name,
                focus: $focus, field: .fullName,
                prompt: "Jane Builder",
                hint: "Private. Used only on your certificate, never shown publicly. Everyone else sees your username.",
                error: fieldErrors[.fullName],
                onSubmit: { focus = .username }
            )

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 18) {
                    usernameField
                    teamField
                }
                .frame(minWidth: 520)
                VStack(alignment: .leading, spacing: 20) {
                    usernameField
                    teamField
                }
            }

            rolePicker

            AccountField(
                "Avatar image URL", text: $avatarURL, kind: .url,
                focus: $focus, field: .avatar,
                prompt: "https://example.com/you.png",
                hint: "Optional. Leave it blank and your initials are used instead.",
                error: fieldErrors[.avatar],
                onSubmit: { focus = .bio }
            )

            AccountField(
                "Bio", text: $bio, kind: .text,
                focus: $focus, field: .bio,
                prompt: "Your role, what you build, what you're learning.",
                hint: "Shown on your public profile.",
                error: fieldErrors[.bio],
                submitLabel: .return,
                lines: 3...8,
                maxLength: Self.bioLimit
            )

            // The result prints right under Save, where the eye already is.
            VStack(alignment: .leading, spacing: 14) {
                Button(action: save) {
                    Text(isSaving ? "Saving" : "Save changes")
                }
                .buttonStyle(.ink)
                .keyboardShortcut("s", modifiers: .command)
                .disabled(isSaving || !isDirty)

                if let error {
                    FieldError(error)
                }
                if saved {
                    AccountNote("saved", "Your public profile and presence are up to date.")
                        .transition(.opacity)
                }
            }
            .padding(.top, 2)
            .id(Self.statusAnchor)
        }
        .disabled(isSaving)
        .accountKeyboardBar($focus, order: Field.order, action: "Save", actionEnabled: isDirty && !isSaving, perform: save)
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
        .sensoryFeedback(.success, trigger: saved) { _, new in new }
        .onChange(of: snapshot) { _, new in
            if saved, new != savedSnapshot { LF.Motion.perform(LF.Motion.hover) { saved = false } }
        }
        // A fix clears its own error as soon as it's typed, not at the next Save.
        .onChange(of: fullName) { _, _ in clearErrors(.fullName) }
        .onChange(of: username) { _, _ in clearErrors(.username) }
        .onChange(of: teamNumber) { _, _ in clearErrors(.team) }
        .onChange(of: avatarURL) { _, _ in clearErrors(.avatar) }
        .onChange(of: bio) { _, _ in clearErrors(.bio) }
        .onChange(of: role) { _, _ in error = nil }
        .onChange(of: me.user.id) { _, _ in reseed(from: me.profile) }
        #if os(macOS)
        // The Settings window opens on the record, not inside Full name with it selected.
        .defaultFocus($focus, nil)
        .onAppear { focus = nil }
        #endif
    }

    private static let statusAnchor = "settings-profile-status"

    private func clearErrors(_ field: Field) {
        if fieldErrors[field] != nil { fieldErrors[field] = nil }
        if error != nil { error = nil }
    }

    // MARK: Pieces

    /// The strip the rest of the site will see, mirroring what's typed.
    private var appearsAs: some View {
        HStack(spacing: 16) {
            InitialsAvatar(
                name: fullName.accountTrimmed.isEmpty ? (username.isEmpty ? (me.user.email ?? "?") : username) : fullName,
                seed: username.isEmpty ? me.user.email : username,
                imageURL: validAvatarURL,
                size: 56
            )
            VStack(alignment: .leading, spacing: 4) {
                SlugText("how you appear")
                Text(username.isEmpty ? "no username yet" : "@\(username)")
                    .font(LF.Fonts.body(17, weight: .semibold))
                    .foregroundStyle(LF.Palette.ink)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 16)
        .overlay(alignment: .top) { DashedRule() }
        .accessibilityElement(children: .combine)
    }

    private var usernameField: some View {
        AccountField(
            "Username", text: $username, kind: .username,
            focus: $focus, field: .username,
            prompt: "janebuilds",
            hint: username.count >= 3
                ? "Letters, numbers and underscores. Your public page is at /u/\(username)."
                : "Letters, numbers and underscores. Your public page is at /u/your-name.",
            error: fieldErrors[.username],
            onSubmit: { focus = .team }
        )
    }

    private var teamField: some View {
        AccountField(
            "FRC team number", text: $teamNumber, kind: .teamNumber,
            focus: $focus, field: .team,
            prompt: "254",
            hint: "Optional. It groups you with teammates who entered the same number.",
            error: fieldErrors[.team],
            onSubmit: { focus = .avatar }
        )
    }

    private var rolePicker: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            FieldLabel("Role on your team")
                .accessibilityHidden(true)
            Menu {
                Picker("Role on your team", selection: $role) {
                    ForEach(ProfileRole.allCases) { role in
                        Text(Self.roleLabel(role)).tag(role)
                    }
                }
                .pickerStyle(.inline)
            } label: {
                HStack {
                    Text(Self.roleLabel(role))
                        .foregroundStyle(LF.Palette.ink)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(LF.Palette.ink)
                        .accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .inkField()
                .contentShape(HandShape(.s))
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            .accessibilityLabel("Role on your team")
            .accessibilityValue(Self.roleLabel(role))
        }
    }

    // MARK: State

    fileprivate struct Snapshot: Equatable {
        var fullName, username, teamNumber, avatarURL, bio: String
        var role: ProfileRole
    }

    private var snapshot: Snapshot {
        Snapshot(fullName: fullName, username: username, teamNumber: teamNumber, avatarURL: avatarURL, bio: bio, role: role)
    }

    private var validAvatarURL: URL? {
        let value = avatarURL.accountTrimmed
        guard let url = URL(string: value), ["http", "https"].contains(url.scheme?.lowercased() ?? "") else { return nil }
        return url
    }

    /// The changes against what's on file, or nil when nothing changed.
    private var pendingUpdate: ProfileUpdate? {
        let p = me.profile
        var update = ProfileUpdate()
        let name = fullName.accountTrimmed
        if name != (p.fullName ?? "") { update.fullName = name }
        let handle = AccountStore.normalizeUsername(username.accountTrimmed)
        if handle != (p.username ?? "") { update.username = handle }
        let team = Int(teamNumber)
        if team != p.teamNumber {
            update.teamNumber = team.map { .set($0) } ?? .remove
        }
        if role != p.roleKind { update.role = role }
        let avatar = avatarURL.accountTrimmed
        if avatar != (p.avatarUrl ?? "") { update.avatarURL = avatar }
        let bioText = bio.accountTrimmed
        if bioText != (p.bio ?? "") { update.bio = bioText }
        return update.isEmpty ? nil : update
    }

    private var isDirty: Bool { pendingUpdate != nil }

    private func reseed(from p: Profile) {
        fullName = p.fullName ?? ""
        username = p.username ?? ""
        teamNumber = p.teamNumber.map(String.init) ?? ""
        role = p.roleKind
        avatarURL = p.avatarUrl ?? ""
        bio = p.bio ?? ""
    }

    // MARK: Save

    private func save() {
        guard !isSaving else { return }
        error = nil
        saved = false
        var errors: [Field: String] = [:]
        let handle = AccountStore.normalizeUsername(username.accountTrimmed)
        if handle.count < 3 {
            errors[.username] = AccountStore.usernameRule
        }
        if !teamNumber.isEmpty, !(Int(teamNumber).map { (1...99_999).contains($0) } ?? false) {
            errors[.team] = AccountStore.teamNumberRule
        }
        if !avatarURL.accountTrimmed.isEmpty, validAvatarURL == nil {
            errors[.avatar] = "Avatar URL must start with http:// or https://"
        }
        fieldErrors = errors
        if let first = [Field.username, .team, .avatar].first(where: { errors[$0] != nil }) {
            focus = first
            accountAnnounce(errors[first] ?? "")
            return
        }
        guard let update = pendingUpdate else { return }

        focus = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                let profile = try await account.updateProfile(update)
                reseed(from: profile)
                savedSnapshot = snapshot
                LF.Motion.perform(LF.Motion.arrive) { saved = true }
                accountAnnounce("Profile saved. Your changes are live across LearnFRC.")
            } catch {
                let message = error.accountMessage
                self.error = message
                accountAnnounce(message)
            }
            // Saved from the keyboard bar, Save can be well above or below what's on screen.
            scroller?.reveal(Self.statusAnchor, anchor: .center)
        }
    }
}

#Preview("Profile form, iPhone", traits: .fixedLayout(width: 393, height: 1250)) {
    ScrollView {
        SettingsProfileForm(me: PreviewData.me)
            .padding(LF.Metrics.gutter)
    }
    .paperBackground()
    .appEnvironment(.preview)
}

#Preview("Profile form, iPad, night", traits: .fixedLayout(width: 820, height: 1000)) {
    ScrollView {
        SettingsProfileForm(me: PreviewData.me)
            .padding(32)
    }
    .paperBackground()
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}
