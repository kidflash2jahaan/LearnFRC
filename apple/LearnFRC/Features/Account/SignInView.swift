import SwiftUI

/// Sign in with Google, or with an email or a username and a password (the site's `/login`).
///
/// A headline, the sign-in sheet (flat, taped, because a tilted text field reads badly),
/// and beside it on wide windows (under it on narrow ones) what the account holds.
/// Continue with Google sits at the top of the sheet, like the site's
/// (`ProviderSignInButtons`); usernames go through `POST /api/app/auth/sign-in`; emails sign
/// in with Supabase directly.
///
///     SignInView()                                         // in any NavigationStack
///     SignInView(identifier: email, notice: .exists)       // after sign-up found the email
///
/// Inside `AuthFlowView` the callbacks switch screens and close the sheet; on its own it
/// pushes `SignUpView` and `PasswordResetView` onto the surrounding stack.
struct SignInView: View {
    /// A note above the fields.
    enum Notice: Hashable, Sendable {
        /// Sign-up found that email already has an account.
        case exists
        /// The person came back from the "check your inbox" screen.
        case confirmed
    }

    @Environment(AccountStore.self) private var account
    @Environment(\.dismiss) private var dismiss
    @Environment(\.isPresented) private var isPresented

    @State private var identifier: String
    @State private var password = ""
    @State private var error: String?
    @State private var identifierError: String?
    @State private var passwordError: String?
    @State private var isSubmitting = false
    /// Continue with Google is running (its sheet, then the sign-in).
    @State private var isUsingProvider = false
    @FocusState private var focus: Field?

    private let notice: Notice?
    private let onCreateAccount: (() -> Void)?
    private let onForgotPassword: ((String) -> Void)?
    private let onSignedIn: (() -> Void)?

    private enum Field: Hashable { case identifier, password }

    /// The space between the sheet's rows.
    private static let fieldSpacing: CGFloat = 18
    /// From the reset-link row to the Sign in button.
    private static let gapAboveSignIn: CGFloat = 20

    init(
        identifier: String = "",
        notice: Notice? = nil,
        onCreateAccount: (() -> Void)? = nil,
        onForgotPassword: ((String) -> Void)? = nil,
        onSignedIn: (() -> Void)? = nil
    ) {
        _identifier = State(initialValue: identifier)
        self.notice = notice
        self.onCreateAccount = onCreateAccount
        self.onForgotPassword = onForgotPassword
        self.onSignedIn = onSignedIn
    }

    private var busy: Bool { isSubmitting || isUsingProvider }

    var body: some View {
        AccountPage(maxWidth: 1000, fold: .spread) { page in
            if let pages = page.pages {
                // A sheet across an open iPhone Duo: the form on the left page, what the
                // account holds on the right.
                FoldPages(pages) {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        sheet.padding(.top, 28)
                    }
                } trailing: {
                    aside
                }
            } else {
                single(width: page.width)
            }
        }
        .navigationTitle("Sign in")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        #if os(macOS)
        .defaultFocus($focus, identifier.isEmpty ? .identifier : .password)
        #endif
    }

    private var header: some View {
        AccountHeader(
            marker: "returning",
            title: "Sign in and pick the binder back up.",
            lede: "Your progress, your certificates and your team are attached to the account, not the device. Sign in on any iPhone, iPad or Mac, or on learnfrc.com, and they follow you."
        )
    }

    private func single(width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            if width >= 760 {
                HStack(alignment: .top, spacing: 48) {
                    sheet.frame(width: 432)
                    aside.padding(.top, 6)
                }
                .padding(.top, 32)
            } else {
                VStack(alignment: .leading, spacing: 40) {
                    sheet
                    aside
                }
                .padding(.top, 28)
            }
        }
    }

    // MARK: The sheet

    private var sheet: some View {
        NotebookCard(tape: true, padding: 22) {
            AccountSheetSlug("sign-in sheet")

            VStack(alignment: .leading, spacing: Self.fieldSpacing) {
                if let notice {
                    noticeView(notice)
                }
                if let error {
                    FieldError(error)
                }

                ProviderSignInButtons(isWorking: $isUsingProvider, error: $error) {
                    password = ""
                    finishSignedIn()
                }

                AccountField(
                    "Email or username", text: $identifier, kind: .identifier,
                    focus: $focus, field: .identifier,
                    hint: "Either one works, whichever you remember.",
                    error: identifierError,
                    onSubmit: { focus = .password }
                )

                VStack(alignment: .leading, spacing: 4) {
                    AccountField(
                        "Password", text: $password, kind: .password(new: false),
                        focus: $focus, field: .password,
                        error: passwordError,
                        submitLabel: .go,
                        onSubmit: submit
                    )
                    if passwordError == nil {
                        // One line while it fits whole; the link under the question otherwise.
                        // No target may cover the field: on one line the link's target grows
                        // down from its text, and the row keeps that 44pt clear of Sign in
                        // (the gap under the row counts towards it); under the question it
                        // grows up, over the question's own line.
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 4) {
                                cantPlaceIt.fixedSize()
                                forgotPasswordLink(reach: .down).fixedSize()
                            }
                            VStack(alignment: .leading, spacing: 0) {
                                cantPlaceIt
                                forgotPasswordLink(reach: .up)
                            }
                        }
                        .frame(minHeight: LF.Metrics.tap + 1 - Self.gapAboveSignIn, alignment: .top)
                    }
                }

                Button(action: submit) {
                    Text(isSubmitting ? "Signing you in" : "Sign in")
                }
                .buttonStyle(InkButtonStyle(.primary, fullWidth: true))
                .keyboardShortcut(.defaultAction)
                .disabled(busy)
                .accessibilityHint(isSubmitting ? "Working" : "")
                .padding(.top, Self.gapAboveSignIn - Self.fieldSpacing)

                VStack(alignment: .leading, spacing: 14) {
                    DashedRule()
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 6) {
                            firstTimeHere.fixedSize()
                            createAccountLink.fixedSize()
                        }
                        VStack(alignment: .leading, spacing: 0) {
                            firstTimeHere
                            createAccountLink
                        }
                    }
                }
            }
            .padding(.top, 20)
            .disabled(busy)
        }
        .accountKeyboardBar($focus, order: [.identifier, .password])
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    private var cantPlaceIt: some View {
        Text("Can't place it?")
            .font(LF.Fonts.mono(12, relativeTo: .caption))
            .foregroundStyle(LF.Palette.graphite)
    }

    private var firstTimeHere: some View {
        Text("First time here?")
            .font(LF.Fonts.body(15.5, relativeTo: .subheadline))
            .foregroundStyle(LF.Palette.graphite)
    }

    @ViewBuilder
    private func noticeView(_ notice: Notice) -> some View {
        switch notice {
        case .exists:
            AccountNote("already on the roster", "That email already has an account. Sign in below and you're straight back where you were.")
        case .confirmed:
            AccountNote("confirmed", "Once the link in your email has opened learnfrc.com, sign in here with the same email and password.")
        }
    }

    @ViewBuilder
    private func forgotPasswordLink(reach: AccountTextButtonStyle.Reach) -> some View {
        if let onForgotPassword {
            Button("Get a reset link") { onForgotPassword(prefillEmail) }
                .buttonStyle(AccountTextButtonStyle(size: 12, reach: reach))
        } else {
            NavigationLink("Get a reset link") { PasswordResetView(email: prefillEmail) }
                .buttonStyle(AccountTextButtonStyle(size: 12, reach: reach))
        }
    }

    @ViewBuilder
    private var createAccountLink: some View {
        if let onCreateAccount {
            Button("Create a free account", action: onCreateAccount)
                .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
        } else {
            NavigationLink("Create a free account") { SignUpView() }
                .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
        }
    }

    /// The reset form only takes an email, so pass one along only if that's what was typed.
    private var prefillEmail: String {
        identifier.contains("@") ? identifier.accountTrimmed : ""
    }

    // MARK: The margin

    private var aside: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("what the account holds")
            AccountDefinitionList(items: AccountPitch.keeps)
                .padding(.top, 6)
            MarkerText("reading was never behind a login. this is just the scorekeeping.", size: 21)
                .frame(maxWidth: 300, alignment: .leading)
                .padding(.top, 22)
            if isPresented {
                Button("Keep reading without an account") { dismiss() }
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 22)
            }
        }
    }

    // MARK: Submit

    /// Signed in, by either door: the flow closes the sheet itself; on its own this screen
    /// goes back.
    private func finishSignedIn() {
        if let onSignedIn { onSignedIn() } else { dismiss() }
    }

    private func submit() {
        guard !busy else { return }
        identifierError = nil
        passwordError = nil
        error = nil
        let id = identifier.accountTrimmed
        if id.isEmpty || password.isEmpty {
            // The site's sentence, against the field that's missing.
            if id.isEmpty { identifierError = "Please enter your email or username and password." }
            else { passwordError = "Please enter your email or username and password." }
            focus = id.isEmpty ? .identifier : .password
            return
        }
        focus = nil
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            do {
                try await account.signIn(identifier: id, password: password)
                Haptics.success()
                accountAnnounce("Signed in.")
                password = ""
                finishSignedIn()
            } catch {
                self.error = error.accountMessage
                focus = .password
            }
        }
    }
}

// MARK: - Previews

#Preview("Sign in, iPhone", traits: .fixedLayout(width: 393, height: 1100)) {
    NavigationStack { SignInView() }
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Sign in, iPhone, night", traits: .fixedLayout(width: 393, height: 1100)) {
    NavigationStack { SignInView(identifier: "maya@example.com", notice: .exists) }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Sign in, iPad", traits: .fixedLayout(width: 1024, height: 900)) {
    NavigationStack { SignInView() }
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Sign in, iPad, night", traits: .fixedLayout(width: 1024, height: 900)) {
    NavigationStack { SignInView() }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Sign in, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 1100)) {
    NavigationStack { SignInView() }
        .appEnvironment(.preview(signedIn: false))
        .previewFold(.previewBook)
}
