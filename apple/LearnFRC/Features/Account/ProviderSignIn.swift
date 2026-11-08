import AuthenticationServices
import CryptoKit
import Security
import SwiftUI

/// A way to sign in that isn't an email and a password.
///
/// Google, the same button and words as the site's (`GoogleSignInButton` in
/// `src/components/auth/google-button.tsx`), and Sign in with Apple, Apple's own button (the
/// site's `AppleSignInButton`, `src/components/auth/apple-button.tsx`). Apple is built but
/// only offered once `AppConfig.isAppleSignInEnabled` is on, which waits for the paid
/// developer team (docs/ARCHITECTURE.md 6.1).
enum SignInProvider: Hashable, Sendable, CaseIterable, Identifiable {
    case apple
    case google

    var id: Self { self }

    /// The providers on the sheets, in order. Apple goes first, the same size as Google:
    /// Apple's guidelines ask for Sign in with Apple to be at least as prominent as any other.
    static var offered: [SignInProvider] {
        AppConfig.isAppleSignInEnabled ? [.apple, .google] : [.google]
    }

    /// The button's words at rest (Apple's button draws its own, in these words).
    var title: String {
        switch self {
        case .apple: "Continue with Apple"
        case .google: "Continue with Google"
        }
    }

    /// While the provider's sheet is opening or up (the site's busy label).
    var openingTitle: String {
        switch self {
        case .apple: "Opening Apple"
        case .google: "Opening Google"
        }
    }
}

/// The provider buttons at the top of the sign-in and sign-up sheets, and the ruled break
/// under them ("or write it in"), in the site's order (`auth-form.tsx`): the error line, the
/// providers, the rule, then the fields. Between the providers and the rule, the terms line
/// (`TermsAgreementNote`, App Review 1.2), unless the sheet shows it elsewhere.
///
/// Google opens its page in the system web sign-in sheet, anchored to this window. Apple is
/// Apple's own `SignInWithAppleButton` and system sheet (Face ID, Touch ID or the Apple ID
/// password), with a fresh nonce for each attempt. Closing either sheet is a choice, so
/// nothing is shown; any other failure goes to the form's error line as one plain sentence.
/// Once the account is in, the haptic and the VoiceOver announcement happen here and
/// `onSignedIn` runs; the username gate or the profile setup step follow on their own,
/// exactly as after an email sign-in.
///
///     ProviderSignInButtons(isWorking: $isUsingProvider, error: $error) { dismiss() }
///     ProviderSignInButtons(isWorking: $isUsingProvider, error: $error, referrer: "kai_cad", via: "team-invite") {}
struct ProviderSignInButtons: View {
    @Environment(AccountStore.self) private var account
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @Environment(\.colorScheme) private var colorScheme

    /// True from the tap until the account is in (or the attempt ends): the form beside it waits.
    @Binding var isWorking: Bool
    /// The form's error line. Cleared when a provider starts; one plain sentence when it fails.
    @Binding var error: String?
    /// An invite's username and share surface (the sign-up screen's `?ref=` and `?via=`), so a
    /// new account made with Google or Apple is credited like one made with the form.
    var referrer: String? = nil
    var via: String? = nil
    /// Which buttons, in order. Previews pass `[.apple, .google]` to show Apple's while it's off.
    var providers: [SignInProvider] = SignInProvider.offered
    /// The terms line under the buttons (`TermsAgreementNote`), because they make an account
    /// the first time. The sign-up sheet turns it off and shows it under Create my account.
    var showsTermsNote = true
    var onSignedIn: () -> Void

    @State private var phase: Phase?
    /// The raw nonce for the Apple request on screen; its SHA-256 went into the request.
    @State private var appleNonce: String?

    /// Apple's button is a fixed-height control, so it's given the Google button's height and
    /// grows with the text the way that one does (which stops at AX3).
    @ScaledMetric(relativeTo: .callout) private var appleButtonHeight: CGFloat = LF.Metrics.tap

    /// Where a provider's attempt is.
    private enum Phase: Hashable {
        /// The provider's sheet is opening or up.
        case opening(SignInProvider)
        /// The sheet came back with the account; the session and the site's work are running.
        case finishing(SignInProvider)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(spacing: 12) {
                ForEach(providers) { provider in
                    switch provider {
                    case .apple:
                        appleButton
                    case .google:
                        Button { startGoogle() } label: {
                            ProviderButtonLabel(provider: provider, title: title(for: provider), showsMark: phase == nil)
                        }
                        .buttonStyle(InkButtonStyle(.ghost, fullWidth: true))
                        .disabled(phase != nil)
                        .accessibilityHint(phase == nil ? "" : "Working")
                    }
                }
            }
            if showsTermsNote {
                TermsAgreementNote(providers: providers)
            }
            OrWriteItIn()
        }
    }

    private func title(for provider: SignInProvider) -> String {
        switch phase {
        case .opening(provider): provider.openingTitle
        // The site's words for the moment the account is being opened (its sign-in button).
        case .finishing(provider): "Signing you in"
        default: provider.title
        }
    }

    // MARK: Google

    private func startGoogle() {
        guard phase == nil, !isWorking else { return }
        let provider = SignInProvider.google
        error = nil
        phase = .opening(provider)
        isWorking = true
        let session = webAuthenticationSession
        let ref = referrer
        let via = via
        Task {
            defer {
                phase = nil
                isWorking = false
            }
            do {
                let outcome = try await account.signInWithGoogle(ref: ref, via: via) { url in
                    let callback = try await session.authenticate(
                        using: url,
                        callback: .customScheme(AppConfig.urlScheme),
                        preferredBrowserSession: nil,
                        additionalHeaderFields: [:]
                    )
                    phase = .finishing(provider)
                    return callback
                }
                finished(outcome)
            } catch {
                show(error)
            }
        }
    }

    // MARK: Apple

    /// Apple's own button, in the style that stands out on the page (black on paper, white at
    /// night), Google's width and height. While the account is being opened it gives way to a
    /// plain face of the same size that says so, since Apple's button can't change its words.
    @ViewBuilder
    private var appleButton: some View {
        let height = min(appleButtonHeight, 72)
        if case .finishing(.apple) = phase {
            AppleFinishingFace(darkMode: colorScheme == .dark)
                .frame(maxWidth: .infinity)
                .frame(height: height)
        } else {
            SignInWithAppleButton(.continue) { request in
                let nonce = AppleNonce.make()
                appleNonce = nonce
                request.requestedScopes = [.fullName, .email]
                request.nonce = AppleNonce.sha256(nonce)
                error = nil
                phase = .opening(.apple)
                isWorking = true
            } onCompletion: { result in
                finishApple(result)
            }
            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
            // A new identity when the style changes, so the button redraws in it.
            .id(colorScheme)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .disabled(phase != nil)
            .accessibilityHint(phase == nil ? "" : "Working")
        }
    }

    private func finishApple(_ result: Result<ASAuthorization, any Error>) {
        let nonce = appleNonce
        appleNonce = nil
        switch result {
        case .failure(let failure):
            phase = nil
            isWorking = false
            // Cancel on Apple's sheet is a choice: nothing to show.
            if let failure = failure as? ASAuthorizationError, failure.code == .canceled { return }
            Log.auth.error("Sign in with Apple didn't start: \(String(describing: failure), privacy: .public)")
            show(APIError.validation("Couldn't start Apple sign-in. Use email instead."))
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let nonce else {
                phase = nil
                isWorking = false
                show(APIError.validation("Couldn't finish signing in with Apple. Try again, or use email instead."))
                return
            }
            let apple = AppleSignInCredential(
                idToken: idToken,
                nonce: nonce,
                authorizationCode: credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) },
                fullName: AppleNonce.displayName(credential.fullName)
            )
            phase = .finishing(.apple)
            let ref = referrer
            let via = via
            Task {
                defer {
                    phase = nil
                    isWorking = false
                }
                do {
                    finished(try await account.signInWithApple(apple, ref: ref, via: via))
                } catch {
                    show(error)
                }
            }
        }
    }

    // MARK: Both

    private func finished(_ outcome: OAuthSignInOutcome) {
        guard case .signedIn = outcome else { return }
        Haptics.success()
        accountAnnounce("Signed in.")
        onSignedIn()
    }

    private func show(_ failure: any Error) {
        error = failure.accountMessage
        accountAnnounce(failure.accountMessage)
    }
}

/// What Apple's button turns into while the account is being opened: the same black (white at
/// night) face and size, with the site's words for that moment. Not a button.
private struct AppleFinishingFace: View {
    let darkMode: Bool

    var body: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(darkMode ? Color.white : Color.black)
            .overlay {
                Text("Signing you in")
                    .font(.system(.callout, weight: .semibold))
                    .foregroundStyle(darkMode ? Color.black : Color.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.updatesFrequently)
    }
}

/// The pieces of Sign in with Apple that aren't views: the nonce, and the name Apple sends.
private nonisolated enum AppleNonce {
    /// 64 characters, so each random byte maps onto one evenly.
    private static let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_")

    /// 32 characters from the system's secure random source, sent to Supabase as is.
    static func make(length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        if SecRandomCopyBytes(kSecRandomDefault, length, &bytes) != errSecSuccess {
            // Practically never; the system generator is still a good source.
            var generator = SystemRandomNumberGenerator()
            bytes = bytes.map { _ in UInt8.random(in: .min ... .max, using: &generator) }
        }
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    /// The SHA-256 of the nonce in lowercase hex, which goes in Apple's request (Apple puts it
    /// in the ID token, and Supabase checks it against the raw nonce).
    static func sha256(_ nonce: String) -> String {
        SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// The person's name as Apple sent it, or nil. Apple sends it only on the first sign-in
    /// to LearnFRC, and only if they let it share the name.
    static func displayName(_ components: PersonNameComponents?) -> String? {
        guard let components else { return nil }
        let name = PersonNameComponentsFormatter.localizedString(from: components, style: .default)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? nil : name
    }
}

/// A provider button's face: the mark and the words. The mark goes while the button is busy
/// rather than turning into a spinner, like the site's: the words already say what's happening.
private struct ProviderButtonLabel: View {
    let provider: SignInProvider
    let title: String
    let showsMark: Bool

    /// Follows the button's text size (the button stops growing at AX3, and so does this).
    @ScaledMetric(relativeTo: .callout) private var markSize: CGFloat = 18

    var body: some View {
        HStack(spacing: 10) {
            if showsMark {
                switch provider {
                case .google: GoogleMark().frame(width: markSize, height: markSize)
                // Apple's button draws its own logo; this face is only Google's.
                case .apple: EmptyView()
                }
            }
            Text(title)
        }
    }
}

/// "or write it in", in the rule between the providers and the fields: the way a form on
/// paper separates two ways of filling it in. Decoration, so VoiceOver skips it, like the site.
private struct OrWriteItIn: View {
    var body: some View {
        HStack(spacing: 12) {
            DashedRule()
            SlugText("or write it in")
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(1)
            DashedRule()
        }
        .accessibilityHidden(true)
    }
}

// MARK: - The Google mark

/// Google's "G", drawn from the same four paths as the site's `GoogleMark` (a 48-unit square),
/// in Google's four colours in light and dark alike. It's the one thing on these screens not
/// drawn from the notebook palette, on purpose: it's somebody else's trademark, and recolouring
/// a sign-in provider's mark is both a brand violation and a recognition problem.
struct GoogleMark: View {
    var body: some View {
        Canvas { context, size in
            let side = min(size.width, size.height)
            let scale = side / 48
            let transform = CGAffineTransform(translationX: (size.width - side) / 2, y: (size.height - side) / 2)
                .scaledBy(x: scale, y: scale)
            for piece in GoogleMarkGeometry.pieces {
                context.fill(piece.path.applying(transform), with: .color(piece.color))
            }
        }
        .accessibilityHidden(true)
    }
}

private nonisolated enum GoogleMarkGeometry {
    struct Piece: Sendable {
        let path: Path
        let color: Color
    }

    /// The site's four paths and colours, in its order (blue, green, yellow, red).
    static let pieces: [Piece] = [
        Piece(
            path: SVGPathData.path("M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"),
            color: Color(.sRGB, red: 0x42 / 255, green: 0x85 / 255, blue: 0xF4 / 255)
        ),
        Piece(
            path: SVGPathData.path("M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46z"),
            color: Color(.sRGB, red: 0x34 / 255, green: 0xA8 / 255, blue: 0x53 / 255)
        ),
        Piece(
            path: SVGPathData.path("M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"),
            color: Color(.sRGB, red: 0xFB / 255, green: 0xBC / 255, blue: 0x05 / 255)
        ),
        Piece(
            path: SVGPathData.path("M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.94 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"),
            color: Color(.sRGB, red: 0xEA / 255, green: 0x43 / 255, blue: 0x35 / 255)
        ),
    ]
}

/// Just enough of SVG path data for the mark: M L H V C A Z, absolute and relative, with
/// repeated parameter groups (`c1 2 3 4 5 6 7 8 9 10 11 12` is two curves).
private nonisolated enum SVGPathData {
    private enum Token {
        case command(Character)
        case number(CGFloat)
    }

    static func path(_ data: String) -> Path {
        let tokens = tokenize(data)
        var path = Path()
        var index = 0
        var command: Character = "M"
        var current = CGPoint.zero
        var subpathStart = CGPoint.zero

        func number() -> CGFloat? {
            guard index < tokens.count, case .number(let value) = tokens[index] else { return nil }
            index += 1
            return value
        }

        while index < tokens.count {
            if case .command(let letter) = tokens[index] {
                command = letter
                index += 1
                if letter == "Z" || letter == "z" {
                    path.closeSubpath()
                    current = subpathStart
                    continue
                }
            }
            let relative = command.isLowercase
            let origin = relative ? current : .zero
            switch command.uppercased() {
            case "M":
                guard let x = number(), let y = number() else { return path }
                current = CGPoint(x: origin.x + x, y: origin.y + y)
                path.move(to: current)
                subpathStart = current
                // Pairs after a move are lines.
                command = relative ? "l" : "L"
            case "L":
                guard let x = number(), let y = number() else { return path }
                current = CGPoint(x: origin.x + x, y: origin.y + y)
                path.addLine(to: current)
            case "H":
                guard let x = number() else { return path }
                current.x = (relative ? current.x : 0) + x
                path.addLine(to: current)
            case "V":
                guard let y = number() else { return path }
                current.y = (relative ? current.y : 0) + y
                path.addLine(to: current)
            case "C":
                guard let x1 = number(), let y1 = number(), let x2 = number(), let y2 = number(),
                      let x = number(), let y = number() else { return path }
                let end = CGPoint(x: origin.x + x, y: origin.y + y)
                path.addCurve(
                    to: end,
                    control1: CGPoint(x: origin.x + x1, y: origin.y + y1),
                    control2: CGPoint(x: origin.x + x2, y: origin.y + y2)
                )
                current = end
            case "A":
                guard let rx = number(), let ry = number(), number() != nil,
                      let large = number(), let sweep = number(),
                      let x = number(), let y = number() else { return path }
                let end = CGPoint(x: origin.x + x, y: origin.y + y)
                addArc(to: &path, from: current, radii: CGSize(width: rx, height: ry), large: large != 0, sweep: sweep != 0, end: end)
                current = end
            default:
                return path
            }
        }
        return path
    }

    /// An unrotated elliptical arc as cubic curves of a quarter turn or less (SVG 1.1 F.6.5).
    private static func addArc(to path: inout Path, from start: CGPoint, radii: CGSize, large: Bool, sweep: Bool, end: CGPoint) {
        guard start != end else { return }
        var rx = abs(radii.width)
        var ry = abs(radii.height)
        guard rx > 0, ry > 0 else {
            path.addLine(to: end)
            return
        }
        let x1 = (start.x - end.x) / 2
        let y1 = (start.y - end.y) / 2
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 {
            rx *= lambda.squareRoot()
            ry *= lambda.squareRoot()
        }
        let numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
        let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
        var coefficient = max(0, numerator / denominator).squareRoot()
        if large == sweep { coefficient = -coefficient }
        let cx1 = coefficient * rx * y1 / ry
        let cy1 = -coefficient * ry * x1 / rx
        let center = CGPoint(x: cx1 + (start.x + end.x) / 2, y: cy1 + (start.y + end.y) / 2)

        func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
            atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        }
        let theta = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
        var delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if !sweep, delta > 0 { delta -= 2 * .pi }
        if sweep, delta < 0 { delta += 2 * .pi }

        let segments = max(1, Int((abs(delta) / (.pi / 2)).rounded(.up)))
        let step = delta / CGFloat(segments)
        let k = 4 / 3 * tan(step / 4)
        var t = theta
        for _ in 0..<segments {
            let (sin1, cos1) = (sin(t), cos(t))
            let (sin2, cos2) = (sin(t + step), cos(t + step))
            let from = CGPoint(x: center.x + rx * cos1, y: center.y + ry * sin1)
            let to = CGPoint(x: center.x + rx * cos2, y: center.y + ry * sin2)
            path.addCurve(
                to: to,
                control1: CGPoint(x: from.x - k * rx * sin1, y: from.y + k * ry * cos1),
                control2: CGPoint(x: to.x + k * rx * sin2, y: to.y - k * ry * cos2)
            )
            t += step
        }
    }

    /// Commands and numbers. A number ends at a space or comma, at a sign that doesn't follow
    /// an exponent, or at a second decimal point (`-1.56-.14` and `.25.5` are two each).
    private static func tokenize(_ data: String) -> [Token] {
        var tokens: [Token] = []
        var buffer = ""
        var hasPoint = false
        var hasExponent = false

        func flush() {
            if let value = Double(buffer) { tokens.append(.number(CGFloat(value))) }
            buffer = ""
            hasPoint = false
            hasExponent = false
        }

        for character in data {
            switch character {
            case "0"..."9":
                buffer.append(character)
            case ".":
                if hasPoint || hasExponent { flush() }
                buffer.append(character)
                hasPoint = true
            case "-", "+":
                if let last = buffer.last, last == "e" || last == "E" {
                    buffer.append(character)
                } else {
                    flush()
                    buffer.append(character)
                }
            case "e", "E":
                buffer.append(character)
                hasExponent = true
            case " ", ",", "\n", "\t", "\r":
                flush()
            default:
                flush()
                if character.isLetter { tokens.append(.command(character)) }
            }
        }
        flush()
        return tokens
    }
}

// MARK: - Previews

#Preview("Providers, iPhone", traits: .fixedLayout(width: 393, height: 240)) {
    @Previewable @State var working = false
    @Previewable @State var error: String?
    ProviderSignInButtons(isWorking: $working, error: $error) {}
        .padding(22)
        .paperBackground()
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Providers, iPhone, night, AX5", traits: .fixedLayout(width: 393, height: 420)) {
    @Previewable @State var working = false
    @Previewable @State var error: String?
    ProviderSignInButtons(isWorking: $working, error: $error) {}
        .padding(22)
        .paperBackground()
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
        .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Providers with Apple, iPhone", traits: .fixedLayout(width: 393, height: 300)) {
    @Previewable @State var working = false
    @Previewable @State var error: String?
    ProviderSignInButtons(isWorking: $working, error: $error, providers: [.apple, .google]) {}
        .padding(22)
        .paperBackground()
        .appEnvironment(.preview(signedIn: false))
}

#Preview("Providers with Apple, night, AX3", traits: .fixedLayout(width: 393, height: 420)) {
    @Previewable @State var working = false
    @Previewable @State var error: String?
    ProviderSignInButtons(isWorking: $working, error: $error, providers: [.apple, .google]) {}
        .padding(22)
        .paperBackground()
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
        .environment(\.dynamicTypeSize, .accessibility3)
}

#Preview("Google mark", traits: .fixedLayout(width: 240, height: 240)) {
    GoogleMark()
        .frame(width: 192, height: 192)
        .padding(24)
}
