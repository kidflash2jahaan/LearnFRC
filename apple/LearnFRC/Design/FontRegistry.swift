import CoreText
import Foundation
import OSLog

/// Registers the bundled fonts for this process.
///
/// Call `FontRegistry.registerAll()` once at launch (the app's `init`). It's also run lazily the
/// first time any `LF.Fonts` function is used, so previews and tests get the fonts without
/// calling it. Uses `CTFontManagerRegisterFontsForURL` with process scope, which works the same
/// on iOS and macOS and needs no `UIAppFonts` / `ATSApplicationFontsPath` Info.plist keys.
///
/// The faces in `Resources/Fonts` (all SIL Open Font License 1.1, licences alongside):
/// - Bricolage Grotesque, static instances cut from the variable font at the site's settings:
///   body at opsz 14 / wdth 100 in weights 400, 500, 600, 700, 800 (family "LF Bricolage"),
///   and the three heading cuts at 800: opsz 24 / wdth 96, opsz 40 / wdth 95, opsz 72 / wdth 92.
/// - Space Mono 400 and 700 (family "LF Space Mono").
/// - Caveat at 600 (family "LF Caveat").
/// Every face has an app-private "LF" name so a copy of the same family installed on a Mac
/// can't shadow the bundled one.
nonisolated enum FontRegistry {
    struct Report: Sendable {
        /// PostScript names that are usable right now.
        let available: Set<String>
        /// Bundled files that failed to register, with the reason.
        let failures: [String: String]

        var isComplete: Bool { FontFace.allCases.allSatisfy { available.contains($0.postScriptName) } }
    }

    /// Registers every bundled font (once; later calls return the same report).
    @discardableResult
    static func registerAll() -> Report { report }

    /// Whether a face can be used by name. Falls back to the system font when it can't.
    static func isAvailable(_ face: FontFace) -> Bool {
        report.available.contains(face.postScriptName)
    }

    /// Registers font files from an explicit list of URLs (tools and tests).
    @discardableResult
    static func register(urls: [URL]) -> Report {
        var failures: [String: String] = [:]
        for url in urls {
            var error: Unmanaged<CFError>?
            if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                let cfError = error?.takeRetainedValue()
                let code = cfError.map { CFErrorGetCode($0) } ?? 0
                // Already registered (a second call, or a preview reusing the process) is fine.
                if code != CTFontManagerError.alreadyRegistered.rawValue {
                    failures[url.lastPathComponent] = cfError.map { CFErrorCopyDescription($0) as String } ?? "unknown error"
                }
            }
        }
        return Report(available: availableFaces(), failures: failures)
    }

    // MARK: - Private

    /// Lazily initialised exactly once, thread-safely (Swift global/static `let` semantics).
    private static let report: Report = {
        let report = register(urls: bundledFontURLs())
        if !report.isComplete || !report.failures.isEmpty {
            let missing = FontFace.allCases.map(\.postScriptName).filter { !report.available.contains($0) }
            Logger(subsystem: "com.learnfrc.app", category: "fonts")
                .error("Bundled fonts not fully registered. Missing: \(missing.joined(separator: ", "), privacy: .public). Failures: \(report.failures.description, privacy: .public). Using system fonts for those.")
        }
        return report
    }()

    private static func bundledFontURLs() -> [URL] {
        var urls: [URL] = []
        for bundle in [Bundle.main, Bundle(for: BundleToken.self)] {
            for ext in ["ttf", "otf"] {
                // Synced folders copy resources flat into the bundle root; a folder reference
                // would keep them under Fonts/. Look in both.
                urls += bundle.urls(forResourcesWithExtension: ext, subdirectory: nil) ?? []
                urls += bundle.urls(forResourcesWithExtension: ext, subdirectory: "Fonts") ?? []
            }
        }
        var seen = Set<String>()
        return urls.filter { $0.lastPathComponent.hasPrefix("LF") && seen.insert($0.standardizedFileURL.path).inserted }
    }

    private static func availableFaces() -> Set<String> {
        var available = Set<String>()
        for face in FontFace.allCases {
            let descriptor = CTFontDescriptorCreateWithAttributes([kCTFontNameAttribute: face.postScriptName] as CFDictionary)
            if let match = CTFontDescriptorCreateMatchingFontDescriptor(descriptor, nil),
               let name = CTFontDescriptorCopyAttribute(match, kCTFontNameAttribute) as? String,
               name == face.postScriptName {
                available.insert(face.postScriptName)
            }
        }
        return available
    }

    private final class BundleToken {}
}
