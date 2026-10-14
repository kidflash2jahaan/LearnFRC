import SwiftUI

/// Sign in, sign up and password reset as one sheet, with a close button. Switching
/// between sign in and sign up swaps the page in place (no growing back stack); the reset
/// form is pushed. The sheet closes itself once an account is signed in; if that account
/// still needs a username, the shell's gate shows `UsernameSetupView` next.
///
///     .sheet(isPresented: $showAuth) { AuthFlowView(start: .signUp) }
///     // or
///     .authSheet(isPresented: $showAuth, start: .signIn)
struct AuthFlowView: View {
    enum Screen: Hashable, Sendable, Identifiable {
        case signIn
        case signUp

        var id: Self { self }
    }

    @Environment(AccountStore.self) private var account
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var screen: Screen
    @State private var signInIdentifier = ""
    @State private var signInNotice: SignInView.Notice?
    @State private var resetEmail: String?
    @State private var path: [String] = []

    private let referrer: String?
    private let via: String?

    init(start: Screen = .signIn, referrer: String? = nil, via: String? = nil) {
        _screen = State(initialValue: start)
        self.referrer = referrer
        self.via = via
    }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                switch screen {
                case .signIn:
                    SignInView(
                        identifier: signInIdentifier,
                        notice: signInNotice,
                        onCreateAccount: { show(.signUp) },
                        onForgotPassword: { email in
                            resetEmail = email
                            path.append("reset")
                        },
                        // The sheet closes on the account change below.
                        onSignedIn: {}
                    )
                    .id("signin-\(signInIdentifier)-\(String(describing: signInNotice))")
                case .signUp:
                    SignUpView(referrer: referrer, via: via) { email, notice in
                        signInIdentifier = email ?? ""
                        signInNotice = notice
                        show(.signIn)
                    }
                }
            }
            .transition(.opacity)
            .navigationDestination(for: String.self) { _ in
                PasswordResetView(email: resetEmail ?? "") {
                    path.removeAll()
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                        .accessibilityLabel("Close")
                }
            }
        }
        .tint(LF.Palette.blue)
        .onChange(of: account.isSignedIn) { _, signedIn in
            if signedIn { dismiss() }
        }
        #if os(macOS)
        .frame(minWidth: 560, idealWidth: 720, minHeight: 620, idealHeight: 820)
        #else
        // On iPad the default form sheet is about 660pt tall in landscape, which hides the
        // Sign in button below the fold. A page-sized sheet shows the whole form in both
        // orientations. iPhone sheets are already full height, so nothing changes there.
        .presentationSizing(.page)
        #endif
    }

    private func show(_ next: Screen) {
        if reduceMotion {
            screen = next
        } else {
            withAnimation(LF.Motion.arrive) { screen = next }
        }
    }
}

extension View {
    /// Presents `AuthFlowView` as a sheet.
    func authSheet(isPresented: Binding<Bool>, start: AuthFlowView.Screen = .signIn, referrer: String? = nil, via: String? = nil) -> some View {
        sheet(isPresented: isPresented) {
            AuthFlowView(start: start, referrer: referrer, via: via)
        }
    }

    /// Presents `AuthFlowView` starting on `screen`, for a screen inside a tab (You, Settings).
    /// The sheet closes when the window is sent somewhere from outside it: a search request
    /// (⌘K, a search link, Siri, Spotlight), or a link, Handoff or menu command that changes
    /// the window's tab or path. The search field or screen that opens must be the one in
    /// front, not hidden behind a sign-in form (ARCHITECTURE 6.7). `RootView` does the same
    /// for its own sign-in sheet.
    func authSheet(item screen: Binding<AuthFlowView.Screen?>) -> some View {
        modifier(TabAuthSheet(screen: screen))
    }
}

private struct TabAuthSheet: ViewModifier {
    @Binding var screen: AuthFlowView.Screen?

    func body(content: Content) -> some View {
        content
            .sheet(item: $screen) { start in
                AuthFlowView(start: start)
            }
            // While the sheet is up the person can't change the tab or the path themselves,
            // so a change here came from outside (the shared rule every presenter uses).
            .closesOnNavigation($screen)
    }
}

#Preview("Auth sheet, iPhone", traits: .fixedLayout(width: 393, height: 852)) {
    AuthFlowView()
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Auth sheet, sign up, iPad, night", traits: .fixedLayout(width: 768, height: 1024)) {
    AuthFlowView(start: .signUp)
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Auth sheet, iPhone, night", traits: .fixedLayout(width: 393, height: 852)) {
    AuthFlowView(start: .signUp, referrer: "kai_cad", via: "team-invite")
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Auth sheet, iPad", traits: .fixedLayout(width: 768, height: 1024)) {
    AuthFlowView()
        .appEnvironment(.preview(signedIn: false))
}
