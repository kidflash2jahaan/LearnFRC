import SwiftUI

/// "Mail yourself a way back in" (the site's `/forgot-password`). One field; the link
/// that arrives finishes the reset on learnfrc.com, and then the person signs in here
/// with the new password. Like the site, it never says whether an address has an account.
struct PasswordResetView: View {
    @Environment(AccountStore.self) private var account

    @State private var email: String
    @State private var error: String?
    @State private var isSending = false
    @State private var sent = false
    @FocusState private var focus: Field?

    private let onBackToSignIn: (() -> Void)?

    private enum Field: Hashable { case email }

    private let snags: [(slug: String, text: String)] = [
        ("not arrived", "Mail is queued, not instant. Give it a couple of minutes, then search your inbox for LearnFRC rather than scrolling, because a new message doesn't always land at the top."),
        ("expired", "Links last an hour and open once. If you asked twice, only the newest one works. Come back here and send another, because the old one won't open again."),
        ("google", "Then there's no password on the account to reset. Google sign-in is coming to the app later; until then, use Continue with Google on learnfrc.com."),
    ]

    init(email: String = "", onBackToSignIn: (() -> Void)? = nil) {
        _email = State(initialValue: email)
        self.onBackToSignIn = onBackToSignIn
    }

    var body: some View {
        AccountPage(maxWidth: 1000) { width in
            VStack(alignment: .leading, spacing: 0) {
                AccountHeader(
                    marker: "locked out",
                    title: "Mail yourself a way back in.",
                    lede: "One field, and a link that lets you pick a new password on learnfrc.com. Your progress, certificates and team all stay exactly where they are."
                )

                HStack(alignment: .top, spacing: 44) {
                    slip.frame(maxWidth: 432)
                    if width >= 820 {
                        penNote.frame(width: 240).padding(.top, 24)
                    }
                }
                .padding(.top, 28)
                if width < 820 {
                    penNote.padding(.top, 24)
                }

                VStack(alignment: .leading, spacing: 0) {
                    InkRule()
                    Text("Nothing in the inbox?")
                        .lfTitle(.h2)
                        .padding(.top, 22)
                    AccountSubText("Work down these three. The last one is the one that catches people out, and no amount of resending fixes it.")
                        .frame(maxWidth: 560, alignment: .leading)
                        .padding(.top, 8)
                    AccountDefinitionList(items: snags)
                        .padding(.top, 10)
                }
                .padding(.top, 44)
            }
        }
        .navigationTitle("Reset password")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        #if os(macOS)
        .defaultFocus($focus, .email)
        #endif
    }

    @ViewBuilder
    private var slip: some View {
        VStack(alignment: .leading, spacing: 18) {
            InkRule()
            if sent {
                sentView
            } else {
                if let error {
                    FieldError(error)
                }
                AccountField(
                    "Email", text: $email, kind: .email,
                    focus: $focus, field: .email,
                    hint: "The address you signed up with. A username won't work here, the link has to have somewhere to go.",
                    submitLabel: .send,
                    onSubmit: send
                )
                Button(action: send) {
                    Text(isSending ? "Sending the link" : "Send me a reset link")
                }
                .buttonStyle(InkButtonStyle(.primary, fullWidth: true))
                .keyboardShortcut(.defaultAction)
                .disabled(isSending)
                backLink
            }
        }
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    private var sentView: some View {
        VStack(alignment: .leading, spacing: 14) {
            SlugText("sent / check your inbox")
            Text("If that address has an account, the link is on its way.")
                .font(LF.Fonts.display(24, relativeTo: .title2))
                .tracking(24 * -0.025)
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            AccountSubText("Open it on any device, phone included. It takes you to learnfrc.com to pick a new password. Then come back and sign in here with it.")
            AccountNote("works for one hour", "Single use, so an old link in your inbox will not work. Nothing seen after ten minutes usually means the spam folder.")
            backLink
        }
    }

    @ViewBuilder
    private var backLink: some View {
        VStack(alignment: .leading, spacing: 12) {
            DashedRule()
            // One line while it fits whole; the link under the question otherwise.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 6) {
                    backQuestion.fixedSize()
                    backAction.fixedSize()
                }
                VStack(alignment: .leading, spacing: 0) {
                    backQuestion
                    backAction
                }
            }
        }
    }

    private var backQuestion: some View {
        Text(sent ? "Got the new password set?" : "Remembered it?")
            .font(LF.Fonts.body(15.5, relativeTo: .subheadline))
            .foregroundStyle(LF.Palette.graphite)
    }

    @ViewBuilder
    private var backAction: some View {
        if let onBackToSignIn {
            Button("Back to the sign-in sheet", action: onBackToSignIn)
                .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
        } else {
            BackButton()
        }
    }

    private var penNote: some View {
        MarkerText("you can send this to yourself here and open it on the shop laptop", size: 21, angle: -1.3)
            .frame(maxWidth: 260, alignment: .leading)
    }

    private func send() {
        guard !isSending else { return }
        error = nil
        let value = email.accountTrimmed.lowercased()
        guard value.contains("@") else {
            error = "Enter the email address you signed up with."
            focus = .email
            return
        }
        focus = nil
        isSending = true
        Task {
            defer { isSending = false }
            do {
                try await account.resetPassword(email: value)
                markSent()
            } catch {
                switch APIError.from(error) {
                case .rateLimited:
                    self.error = "Too many attempts. Wait a minute and try again."
                case .network:
                    self.error = APIError.network.message
                default:
                    // Like the site: never reveal whether the address has an account.
                    markSent()
                }
            }
        }
    }

    private func markSent() {
        LF.Motion.perform(LF.Motion.arrive) { sent = true }
        accountAnnounce("If that address has an account, the reset link is on its way.")
    }
}

/// "Back to the sign-in sheet" when this screen was pushed: pops the stack.
private struct BackButton: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button("Back to the sign-in sheet") { dismiss() }
            .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
    }
}

#Preview("Reset, iPhone", traits: .fixedLayout(width: 393, height: 1100)) {
    NavigationStack { PasswordResetView(email: "maya@example.com") }
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Reset, iPad, night", traits: .fixedLayout(width: 1024, height: 900)) {
    NavigationStack { PasswordResetView() }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Reset, iPhone, night", traits: .fixedLayout(width: 393, height: 1100)) {
    NavigationStack { PasswordResetView() }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Reset, iPad", traits: .fixedLayout(width: 1024, height: 900)) {
    NavigationStack { PasswordResetView(email: "maya@example.com") }
        .appEnvironment(.preview(signedIn: false))
}
