import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Where the app talks to. The publishable key lives in `AppConfig+Keys.swift`
/// (generated from the site's `.env.local`; it's the public client key, never a secret).
enum AppConfig {
    /// The Supabase project (same one the website uses).
    static let supabaseURL = URL(string: "https://pkhksadvllasuhonurcv.supabase.co")!

    /// The website that serves `/api/app/*`. Debug builds can point it at `next dev` with the
    /// launch argument `-LFAPIBase http://localhost:3000`. Release builds ignore the override,
    /// so nothing (a launch argument, a `defaults write`) can send passwords or tokens to
    /// another host.
    static let apiBase: URL = {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "LFAPIBase"),
           let url = URL(string: override.trimmingCharacters(in: .whitespaces)),
           url.scheme == "http" || url.scheme == "https" {
            return url
        }
        #endif
        return URL(string: "https://learnfrc.com")!
    }()

    /// Canonical public links (share sheets, Handoff, "open on the web").
    static let webBase = URL(string: "https://learnfrc.com")!

    /// The one public contact address, the same as the site's footer, privacy policy and terms
    /// (`PUBLIC_CONTACT_EMAIL` in `src/lib/email.ts`). learnfrc.com itself receives no mail.
    static let contactEmail = "29pardhananij@sagehillschool.org"

    /// FIRST's trademark notice, word for word the site's footer (`FirstTrademarkNotice` in
    /// `src/components/footer.tsx`), which FIRST's trademark policy asks anyone using the marks
    /// to carry. Shown at the foot of Settings.
    static let firstTrademarkNotice =
        "LearnFRC is an independent project. FIRST®, FIRST® Robotics Competition, FRC®, FIRST® Tech Challenge, FTC®, Gracious Professionalism®, and Coopertition® are registered trademarks of FIRST® (www.firstinspires.org) which is not overseeing, involved with, or responsible for this activity, product, or service."

    /// The app's own URL scheme (`learnfrc://`).
    static let urlScheme = "learnfrc"

    /// Where Supabase sends the browser back to after Continue with Google
    /// (`learnfrc://auth-callback?code=...`, in the Supabase project's redirect allow list).
    /// The system web sign-in sheet that started the flow catches it and hands it to Supabase
    /// (`SupabaseService.signInWithOAuth`). It shares the `learnfrc` scheme with links, so
    /// `DeepLink` reads it as nothing to open (`DeepLink.isAuthCallback(_:)`).
    static let oauthCallbackURL = URL(string: "\(urlScheme)://auth-callback")!

    /// Whether Sign in with Apple is offered (above Google, on the sign-in and sign-up sheets).
    ///
    /// Off until the paid developer team exists: the button needs the Sign in with Apple
    /// capability on the App ID (`com.apple.developer.applesignin` in `LearnFRC.entitlements`,
    /// which a free Personal Team can't sign) and Supabase's Apple provider set up with the
    /// bundle id. The build setting `LF_APPLE_SIGN_IN` in `project.yml` (`NO` today) reaches the
    /// app as the Info.plist key `LFAppleSignIn`; set it to `YES` with the paid team. Debug
    /// builds also take `-LFAppleSignIn YES` as a launch argument, to look at the sheets with
    /// the button (it can't sign in without the capability).
    static let isAppleSignInEnabled: Bool = {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "LFAppleSignIn") {
            return override.uppercased() == "YES"
        }
        #endif
        let value = Bundle.main.object(forInfoDictionaryKey: "LFAppleSignIn") as? String
        return value?.trimmingCharacters(in: .whitespaces).uppercased() == "YES"
    }()

    /// Catalog and reference refresh when older than this (six hours).
    static let catalogMaxAge: TimeInterval = 6 * 60 * 60

    /// "iOS app" / "Mac app", sent as the sign-up source.
    static var platformSource: String {
        #if os(macOS)
        "Mac app"
        #else
        "iOS app"
        #endif
    }

    /// `ios`, `ipados` or `macos`: the `platform` the sign-up and OAuth routes record as the
    /// signup source ("iOS app", "iPad app", "Mac app"; `appSignupSource` on the site).
    @MainActor static var platformID: String {
        #if os(macOS)
        "macos"
        #else
        UIDevice.current.userInterfaceIdiom == .pad ? "ipados" : "ios"
        #endif
    }

    static var appVersion: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }

    /// True inside Xcode previews (no network, no disk writes).
    static var isRunningPreviews: Bool {
        ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"
    }
}
