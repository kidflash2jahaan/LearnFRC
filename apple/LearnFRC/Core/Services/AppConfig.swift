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

    /// The app's own URL scheme (`learnfrc://`).
    static let urlScheme = "learnfrc"

    /// Where Supabase sends the browser back to after Continue with Google
    /// (`learnfrc://auth-callback?code=...`, in the Supabase project's redirect allow list).
    /// The system web sign-in sheet that started the flow catches it and hands it to Supabase
    /// (`SupabaseService.signInWithOAuth`). It shares the `learnfrc` scheme with links, so
    /// `DeepLink` reads it as nothing to open (`DeepLink.isAuthCallback(_:)`).
    static let oauthCallbackURL = URL(string: "\(urlScheme)://auth-callback")!

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
