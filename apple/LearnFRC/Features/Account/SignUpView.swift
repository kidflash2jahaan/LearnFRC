import SwiftUI

/// Create an account (the site's `/signup`): full name, email, username, optional team
/// number, password, and the reminder-email box, unticked, with the site's exact words.
/// Everything goes through `POST /api/app/auth/sign-up`, so the ban list, profanity check,
/// username rules and email consent are the website's. Afterwards the person confirms by
/// email (the link opens learnfrc.com) and signs in here.
///
///     SignUpView()                                        // in any NavigationStack
///     SignUpView(referrer: "maya_builds", via: "team-invite")
///
/// Inside `AuthFlowView`, `onSignIn` switches to the sign-in screen (with the email
/// filled in when there is one); on its own it pushes `SignInView`.
struct SignUpView: View {
    @Environment(AccountStore.self) private var account
    @Environment(CatalogStore.self) private var catalog
    @Environment(\.dismiss) private var dismiss
    @Environment(\.isPresented) private var isPresented

    @State private var fullName = ""
    @State private var email = ""
    @State private var username = ""
    @State private var teamNumber = ""
    @State private var password = ""
    @State private var emailOptIn = false

    @State private var error: String?
    @State private var fieldErrors: [Field: String] = [:]
    @State private var isSubmitting = false
    @State private var sentTo: String?
    @State private var existingEmail: String?
    @FocusState private var focus: Field?

    private let referrer: String?
    private let via: String?
    private let onSignIn: ((_ email: String?, _ notice: SignInView.Notice?) -> Void)?

    fileprivate enum Field: Hashable { case fullName, email, username, team, password }

    init(
        referrer: String? = nil,
        via: String? = nil,
        onSignIn: ((_ email: String?, _ notice: SignInView.Notice?) -> Void)? = nil
    ) {
        let ref = referrer.map(AccountStore.normalizeUsername)
        self.referrer = (ref?.isEmpty ?? true) ? nil : ref
        self.via = self.referrer == nil ? nil : via
        self.onSignIn = onSignIn
    }

    var body: some View {
        Group {
            if let sentTo {
                SignUpCheckInboxView(
                    email: sentTo,
                    onSignIn: { goToSignIn(email: sentTo, notice: .confirmed) },
                    onStartOver: {
                        LF.Motion.perform(LF.Motion.arrive) { self.sentTo = nil }
                        focus = .email
                    }
                )
                .transition(.opacity)
            } else {
                form
            }
        }
        .navigationTitle(sentTo == nil ? "Create an account" : "Check your inbox")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .navigationDestination(item: $existingEmail) { email in
            SignInView(identifier: email, notice: .exists)
        }
    }

    // MARK: The form page

    private var form: some View {
        AccountPage(maxWidth: 1000) { width in
            VStack(alignment: .leading, spacing: 0) {
                header

                let wide = width >= 900
                HStack(alignment: .top, spacing: 44) {
                    rosterCard.frame(maxWidth: 576)
                    if wide {
                        penNote.frame(width: 240).padding(.top, 70)
                    }
                }
                .padding(.top, 28)
                if !wide {
                    penNote.padding(.top, 22)
                }

                stamps.padding(.top, 48)
                contents(wide: width >= 620).padding(.top, 48)
            }
        }
        #if os(macOS)
        .defaultFocus($focus, .fullName)
        #endif
    }

    @ViewBuilder
    private var header: some View {
        if let referrer {
            AccountHeader(
                marker: "invited",
                title: Text("\(Text("@\(referrer)").font(LF.Fonts.mono(33, weight: .bold, relativeTo: .largeTitle)).foregroundStyle(LF.Palette.blue)) put you on the roster."),
                lede: "Take the seat and you both get 25 XP the moment you confirm your email. It stays free either way."
            )
        } else {
            AccountHeader(
                marker: "new account",
                title: accountMarked("Put your name on the ", "roster", "."),
                lede: "One account covers every department. It keeps count of what you've passed, so you never have to remember where you stopped, and it prints your certificate when a department is done."
            )
        }
    }

    private var rosterCard: some View {
        NotebookCard(tape: true, padding: 22, tapeAngle: 2.8) {
            AccountSheetSlug("roster entry")

            VStack(alignment: .leading, spacing: 18) {
                if let error {
                    FieldError(error)
                }

                AccountField(
                    "Full name", text: $fullName, kind: .name,
                    focus: $focus, field: .fullName,
                    hint: "Private. It goes on your certificate and nowhere else, everyone on the site sees your username.",
                    error: fieldErrors[.fullName],
                    onSubmit: { focus = .email }
                )

                AccountField(
                    "Email", text: $email, kind: .email,
                    focus: $focus, field: .email,
                    error: fieldErrors[.email],
                    onSubmit: { focus = .username }
                )

                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 16) {
                        usernameField
                        teamField.frame(width: 150)
                    }
                    .frame(minWidth: 400)
                    VStack(alignment: .leading, spacing: 18) {
                        usernameField
                        teamField
                    }
                }

                AccountField(
                    "Password", text: $password, kind: .password(new: true),
                    focus: $focus, field: .password,
                    hint: "At least 8 characters, letters and numbers.",
                    error: fieldErrors[.password],
                    submitLabel: .join,
                    onSubmit: submit
                )

                ReminderEmailConsent(isOn: $emailOptIn)

                Button(action: submit) {
                    Text(isSubmitting ? "Creating your account" : "Create my account")
                }
                .buttonStyle(InkButtonStyle(.primary, fullWidth: true))
                .keyboardShortcut(.defaultAction)
                .padding(.top, 2)

                VStack(alignment: .leading, spacing: 14) {
                    DashedRule()
                    // One line while it fits whole; the link under the question otherwise.
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 6) {
                            alreadyOnRoster.fixedSize()
                            signInLink.fixedSize()
                        }
                        VStack(alignment: .leading, spacing: 0) {
                            alreadyOnRoster
                            signInLink
                        }
                    }
                }
            }
            .padding(.top, 20)
            .disabled(isSubmitting)
        }
        .accountKeyboardBar($focus, order: [.fullName, .email, .username, .team, .password])
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    private var usernameField: some View {
        AccountField(
            "Username", text: $username, kind: .username,
            focus: $focus, field: .username,
            // The site's sign-up hint, word for word (auth-form.tsx), like the username step's.
            hint: "Public. Letters, numbers and underscores.",
            error: fieldErrors[.username],
            onSubmit: { focus = .team }
        )
    }

    private var teamField: some View {
        AccountField(
            "Team #, optional", text: $teamNumber, kind: .teamNumber,
            focus: $focus, field: .team,
            hint: "Like 254.",
            error: fieldErrors[.team],
            onSubmit: { focus = .password }
        )
    }

    private var alreadyOnRoster: some View {
        Text("Already on the roster?")
            .font(LF.Fonts.body(15.5, relativeTo: .subheadline))
            .foregroundStyle(LF.Palette.graphite)
    }

    @ViewBuilder
    private var signInLink: some View {
        if let onSignIn {
            Button("Sign in instead") { onSignIn(nil, nil) }
                .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
        } else {
            NavigationLink("Sign in instead") { SignInView() }
                .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
        }
    }

    private var penNote: some View {
        MarkerText("takes about a minute. the team number is optional, add it later if you don't know it.", size: 21, angle: -1.4)
            .frame(maxWidth: 280, alignment: .leading)
    }

    // MARK: The argument and the contents page

    private var stamps: some View {
        let departments = catalog.departments.count
        let lessons = catalog.allLessons.count
        let figures: [(String, String)] = [
            (departments > 0 ? "\(departments)" : "11", "departments, one per job on a team"),
            (lessons > 0 ? "\(lessons)" : "394", "lessons, readable right now"),
            ("0", "paywalls, trials or card fields"),
        ]
        return SlabView {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 28) {
                    ForEach(figures, id: \.1) { stamp($0.0, $0.1).frame(maxWidth: .infinity, alignment: .leading) }
                }
                .frame(minWidth: 520)
                VStack(alignment: .leading, spacing: 18) {
                    ForEach(figures, id: \.1) { stamp($0.0, $0.1) }
                }
            }
            .padding(.vertical, 14)
        }
    }

    private func stamp(_ figure: String, _ caption: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(figure)
                .font(LF.Fonts.mono(40, weight: .bold, relativeTo: .largeTitle))
                .monospacedDigit()
            Text(caption)
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(LF.Palette.onBlue)
        .accessibilityElement(children: .combine)
    }

    private func contents(wide: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("what the account opens")
            Text("Every department, from day one.")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            AccountSubText("Nothing is staged behind a level or a streak. The account exists to count what you've read, hand you a certificate at the end of a department, and put you on your team's page.")
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 10)

            let departments = catalog.departments
            LazyVGrid(
                columns: accountColumns(wide ? 2 : 1, spacing: 40),
                alignment: .leading,
                spacing: 0
            ) {
                ForEach(departments) { department in
                    VStack(alignment: .leading, spacing: 3) {
                        SlugText("dept / \(department.slug)")
                        Text(department.name)
                            .font(LF.Fonts.body(16, weight: .medium))
                            .foregroundStyle(LF.Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 13)
                    .overlay(alignment: .bottom) { DashedRule() }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.top, 18)

            if isPresented {
                Button("Open the guides first") { dismiss() }
                    .buttonStyle(.inkGhost)
                    .padding(.top, 26)
            }
        }
    }

    // MARK: Submit

    private func submit() {
        guard !isSubmitting else { return }
        error = nil
        var errors: [Field: String] = [:]
        let emailValue = email.accountTrimmed
        if emailValue.isEmpty {
            errors[.email] = "Email and password are required."
        } else if !Self.looksLikeEmail(emailValue) {
            errors[.email] = "Enter a real email address."
        }
        let handle = AccountStore.normalizeUsername(username.accountTrimmed)
        if handle.count < 3 {
            errors[.username] = AccountStore.signUpUsernameRule
        }
        var team: Int?
        if !teamNumber.isEmpty {
            if let number = Int(teamNumber), (1...99_999).contains(number) {
                team = number
            } else {
                errors[.team] = AccountStore.teamNumberRule
            }
        }
        if password.isEmpty {
            errors[.password] = "Email and password are required."
        } else if password.count < 8 {
            errors[.password] = AccountStore.passwordRule
        }
        fieldErrors = errors
        if let first = [Field.email, .username, .team, .password].first(where: { errors[$0] != nil }) {
            focus = first
            accountAnnounce(errors[first] ?? "")
            return
        }

        focus = nil
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            do {
                let outcome = try await account.signUp(
                    email: emailValue, password: password, username: handle,
                    fullName: fullName.accountTrimmed.isEmpty ? nil : fullName.accountTrimmed,
                    teamNumber: team, emailOptIn: emailOptIn, ref: referrer, via: via
                )
                switch outcome {
                case .confirmEmail:
                    Haptics.success()
                    password = ""
                    LF.Motion.perform(LF.Motion.arrive) { sentTo = emailValue.lowercased() }
                    accountAnnounce("Account made. Check your inbox for the confirmation link.")
                case .exists:
                    password = ""
                    goToSignIn(email: emailValue.lowercased(), notice: .exists)
                }
            } catch {
                self.error = error.accountMessage
            }
        }
    }

    private func goToSignIn(email: String, notice: SignInView.Notice) {
        if let onSignIn {
            onSignIn(email, notice)
        } else {
            existingEmail = email
        }
    }

    static func looksLikeEmail(_ value: String) -> Bool {
        let parts = value.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, parts[1].contains(".") else { return false }
        return !value.contains(" ") && !parts[1].hasSuffix(".") && !parts[1].hasPrefix(".")
    }
}

// MARK: - Reminder email consent

/// The unticked box from the site's sign-up form, with its exact words. The privacy
/// policy link sits on its own line inside the same row so tapping it never ticks the box.
struct ReminderEmailConsent: View {
    @Binding var isOn: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Toggle(isOn: $isOn) {
                Text("Email me the occasional reminder about my next lesson. Optional, and you can change it in Settings.")
            }
            .toggleStyle(AccountCheckboxStyle())

            // One line while it fits whole; the link under "Here's the" otherwise, never
            // the words squeezed into columns.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 0) {
                    Text("Here's the ").fixedSize()
                    privacyLink.fixedSize()
                    Text(".").fixedSize()
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text("Here's the")
                    HStack(spacing: 0) {
                        privacyLink
                        Text(".")
                    }
                }
            }
            .font(LF.Fonts.body(15.5, relativeTo: .subheadline))
            .foregroundStyle(LF.Palette.ink)
            .padding(.leading, 34)
            .accessibilityElement(children: .contain)
        }
    }

    private var privacyLink: some View {
        Link("privacy policy", destination: AccountLinks.privacy)
            .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
    }
}

// MARK: - Check your inbox

/// After sign-up: the address the link went to, what to do when it doesn't arrive, and
/// the way back to the sign-in sheet (the site's `/auth/verify-email`).
struct SignUpCheckInboxView: View {
    let email: String
    var onSignIn: () -> Void
    var onStartOver: () -> Void

    @Environment(AccountStore.self) private var account
    @State private var resend: ResendState = .idle
    @State private var resendError: String?

    enum ResendState { case idle, sending, sent }

    private let checks: [(slug: String, text: String)] = [
        ("wait", "Mail is queued, not instant. A minute or two is normal, and refreshing the inbox does not make it faster."),
        ("search", "Search your mail for LearnFRC instead of scrolling. New mail does not always sort to the top, especially on a school account."),
        ("spam", "Then check spam and any Promotions tab. A first message from an address you have never written to is exactly what those filters are for."),
    ]

    var body: some View {
        AccountPage(maxWidth: 1000) { width in
            VStack(alignment: .leading, spacing: 0) {
                AccountHeader(
                    marker: "account made, inbox not yet proven",
                    title: "The link is in your inbox. Go and open it.",
                    lede: "One tap confirms the address is yours. The link opens learnfrc.com; after that, come back here and sign in with the same email and password."
                )

                SlabView {
                    SlugText("sent to", color: LF.Palette.onBlue.opacity(0.85))
                    Text(email)
                        .font(LF.Fonts.mono(24, weight: .bold, relativeTo: .title))
                        .foregroundStyle(LF.Palette.onBlue)
                        .lineLimit(3)
                        .minimumScaleFactor(0.7)
                        .textSelection(.enabled)
                        .padding(.top, 4)
                    HStack(spacing: 24) {
                        SlugText("one tap, no code to copy", color: LF.Palette.onBlue.opacity(0.85))
                        SlugText("works on any device", color: LF.Palette.onBlue.opacity(0.85))
                    }
                    .padding(.top, 12)
                }
                .padding(.top, 28)
                .accessibilityElement(children: .combine)

                if width >= 760 {
                    HStack(alignment: .top, spacing: 48) {
                        checklist
                        actions.frame(width: 300)
                    }
                    .padding(.top, 40)
                } else {
                    VStack(alignment: .leading, spacing: 36) {
                        actions
                        checklist
                    }
                    .padding(.top, 32)
                }
            }
        }
    }

    private var checklist: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Nothing there yet?")
                .lfTitle(.h2)
            AccountSubText("Work down these in order. Most of the time it is the third one.")
                .padding(.top, 8)
            AccountDefinitionList(items: checks)
                .padding(.top, 10)
        }
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("when it's confirmed")
            Button("I've confirmed it, sign me in", action: onSignIn)
                .buttonStyle(InkButtonStyle(.primary, fullWidth: true))
            Button(resendLabel, action: sendAgain)
                .buttonStyle(InkButtonStyle(.ghost, fullWidth: true))
                .disabled(resend != .idle)
            if let resendError {
                FieldError(resendError)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Typed the address wrong?")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                Button("Fill the roster line in again", action: onStartOver)
                    .buttonStyle(AccountTextButtonStyle(size: 15, mono: false))
                Text("Nothing is lost, the half-made account just never gets used.")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 8)
        }
    }

    private var resendLabel: String {
        switch resend {
        case .idle: "Send it again"
        case .sending: "Sending"
        case .sent: "Sent again"
        }
    }

    private func sendAgain() {
        resend = .sending
        resendError = nil
        Task {
            do {
                try await account.resendConfirmation(email: email)
                resend = .sent
                accountAnnounce("Verification email sent again.")
            } catch {
                resend = .idle
                resendError = error.accountMessage
            }
        }
    }
}

// MARK: - Previews

#Preview("Sign up, iPhone", traits: .fixedLayout(width: 393, height: 1450)) {
    NavigationStack { SignUpView() }
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Sign up, invited, night", traits: .fixedLayout(width: 393, height: 1900)) {
    NavigationStack { SignUpView(referrer: "kai_cad", via: "team-invite") }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Sign up, iPad", traits: .fixedLayout(width: 1024, height: 1400)) {
    NavigationStack { SignUpView() }
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Sign up, iPad, night", traits: .fixedLayout(width: 1024, height: 1400)) {
    NavigationStack { SignUpView() }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Check inbox, iPhone", traits: .fixedLayout(width: 393, height: 1200)) {
    NavigationStack {
        SignUpCheckInboxView(email: "maya@example.com", onSignIn: {}, onStartOver: {})
    }
    .appEnvironment(.preview(signedIn: false))
}

#Preview("Check inbox, iPad, night", traits: .fixedLayout(width: 1024, height: 900)) {
    NavigationStack {
        SignUpCheckInboxView(email: "maya@example.com", onSignIn: {}, onStartOver: {})
    }
    .appEnvironment(.preview(signedIn: false))
    .environment(\.colorScheme, .dark)
}
