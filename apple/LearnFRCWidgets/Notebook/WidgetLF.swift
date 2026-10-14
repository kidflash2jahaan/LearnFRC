import CoreText
import OSLog
import SwiftUI
import WidgetKit

/// The notebook system, cut down for the widget extension.
///
/// The extension compiles only `LearnFRCWidgets/` and `Shared/`, not `LearnFRC/Design/`, so this
/// mirrors the parts of `LF` the widgets need. Colours come from this folder's asset catalog
/// (`Assets.xcassets/Notebook`, a copy of the app's, light values from the site's CSS, dark and
/// high-contrast values from the design notes), because named catalog colours are the one kind
/// WidgetKit re-resolves when the person switches between light and dark.
nonisolated enum WidgetLF {

    enum Palette {
        /// Cool grey newsprint, the page ground.
        static let paper = Color("Paper")
        /// Index-card stock.
        static let card = Color("Card")
        /// Marker black (chalk at night): primary type and every border.
        static let ink = Color("Ink")
        /// Pencil grey, secondary type.
        static let graphite = Color("Graphite")
        /// Ballpoint blue, the only accent.
        static let blue = Color("Blue")
        /// Fill for surfaces that carry text on blue (deeper than `blue` at night).
        static let blueButton = Color("BlueButton")
        /// Text on `blueButton`.
        static let onBlue = Color("OnBlue")
        /// Packing tape. Decoration only.
        static let kraft = Color("Kraft")
        /// The inner hairline and dashed rules.
        static let rule = Color("Rule")
        /// The 23pt graph ruling.
        static let grid = Color("Grid")
    }

    enum Metrics {
        /// The ink border on every box, meter and tag.
        static let stroke: CGFloat = 2
        static let hairline: CGFloat = 1
        /// The graph-paper ruling (`background-size` on the site's `body`).
        static let gridStep: CGFloat = 23
        static let tapeOpacity: Double = 0.82
    }

    /// The site's tilt presets, in degrees (`.nb-tilt`).
    enum Tilt {
        static let card: Double = -0.55
        static let brand: Double = -1.4
        static let tape: Double = -3.4
    }
}

// MARK: - Rendering modes

/// How the notebook draws itself in the current widget rendering mode.
///
/// - Full colour: paper, card stock, ink, ballpoint blue, kraft tape, hard offset drops.
/// - Accented (tinted and clear Home Screens) and vibrant (Lock Screen, Mac desktop while
///   another app is in front): the system throws the background away and flattens every colour
///   to the tint, so fills turn into faint washes, drops and tape disappear, and the blue parts
///   go in the accent group (`widgetAccentable()`).
nonisolated struct NotebookStyle: Hashable, Sendable {
    var isFullColor: Bool = true
    var isDark: Bool = false

    var ink: Color { isFullColor ? WidgetLF.Palette.ink : .primary }
    var graphite: Color { isFullColor ? WidgetLF.Palette.graphite : .secondary }
    var blue: Color { isFullColor ? WidgetLF.Palette.blue : .primary }
    /// Filled blue surfaces (meter bar, a studied day, the primary button).
    var blueFill: Color { isFullColor ? WidgetLF.Palette.blueButton : .primary }
    var onBlue: Color { isFullColor ? WidgetLF.Palette.onBlue : .primary }
    var card: Color { isFullColor ? WidgetLF.Palette.card : Color.primary.opacity(0.07) }
    /// The empty part of a meter.
    var trough: Color { isFullColor ? WidgetLF.Palette.paper : Color.primary.opacity(0.14) }
    var border: Color { isFullColor ? WidgetLF.Palette.ink : Color.primary.opacity(0.55) }
    var rule: Color { isFullColor ? WidgetLF.Palette.rule : Color.primary.opacity(0.3) }

    /// `--drop-1`, a card at rest. Ink at the CSS alpha by day, chalk at night (a black drop
    /// vanishes on night paper).
    var cardDrop: Color? { isFullColor ? WidgetLF.Palette.ink.opacity(isDark ? 0.12 : 0.14) : nil }
    /// `--drop-ink`, under the primary button.
    var inkDrop: Color? { isFullColor ? WidgetLF.Palette.ink.opacity(isDark ? 0.5 : 1) : nil }
    /// Tape, grid and other decoration only exist in full colour.
    var decorates: Bool { isFullColor }
}

extension EnvironmentValues {
    @Entry var notebookStyle = NotebookStyle()
}

extension View {
    /// Reads the widget's rendering mode and colour scheme once and hands every notebook
    /// component below the matching `NotebookStyle`.
    func notebookStyled() -> some View {
        modifier(NotebookStyleReader())
    }
}

private struct NotebookStyleReader: ViewModifier {
    @Environment(\.widgetRenderingMode) private var mode
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        content.environment(\.notebookStyle, NotebookStyle(isFullColor: mode == .fullColor, isDark: scheme == .dark))
    }
}

// MARK: - Fonts

/// The bundled faces the widgets use (a subset of the app's `FontFace`, same PostScript names).
/// The files live in `LearnFRCWidgets/Fonts` and are declared in the extension's Info.plist
/// (`UIAppFonts`, `ATSApplicationFontsPath`) so the system process that draws widgets can
/// find them; `WidgetFonts.register()` also registers them for this process.
nonisolated enum WidgetFace: String, CaseIterable, Sendable {
    case displaySmall = "LFBricolageDisplay-S"
    case displayMedium = "LFBricolageDisplay-M"
    case bodyRegular = "LFBricolage-Regular"
    case bodySemiBold = "LFBricolage-SemiBold"
    case monoRegular = "LFSpaceMono-Regular"
    case monoBold = "LFSpaceMono-Bold"
    case pen = "LFCaveat-SemiBold"

    /// What the system font should look like if this face isn't available.
    var fallbackWeight: Font.Weight {
        switch self {
        case .bodyRegular, .monoRegular: .regular
        case .bodySemiBold, .pen: .semibold
        case .monoBold: .bold
        case .displaySmall, .displayMedium: .heavy
        }
    }

    var isMono: Bool { self == .monoRegular || self == .monoBold }

    func font(size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        if WidgetFonts.isAvailable(self) {
            return .custom(rawValue, size: size, relativeTo: style)
        }
        // An unknown custom name resolves to the system font at that size, still scaled with
        // Dynamic Type; the weight and design go on top.
        let fallback = Font.custom(rawValue, size: size, relativeTo: style).weight(fallbackWeight)
        return isMono ? fallback.monospaced() : fallback
    }
}

/// Type for the widgets. Every function scales with Dynamic Type through `relativeTo:`.
nonisolated enum WidgetFonts {
    /// Bricolage Grotesque 800 at the site's heading cut for that size (h3 cut under 24pt).
    static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .headline) -> Font {
        (size >= 24 ? WidgetFace.displayMedium : .displaySmall).font(size: size, relativeTo: style)
    }

    /// Bricolage Grotesque at the body cut, 400 or 600.
    static func body(_ size: CGFloat, weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        let semibold = [Font.Weight.medium, .semibold, .bold, .heavy, .black].contains(weight)
        return (semibold ? WidgetFace.bodySemiBold : .bodyRegular).font(size: size, relativeTo: style)
    }

    /// Space Mono, for figures, slugs and the button.
    static func mono(_ size: CGFloat, bold: Bool = false, relativeTo style: Font.TextStyle = .caption) -> Font {
        (bold ? WidgetFace.monoBold : .monoRegular).font(size: size, relativeTo: style)
    }

    /// Caveat 600, the blue margin note. One per widget at most.
    static func note(_ size: CGFloat, relativeTo style: Font.TextStyle = .callout) -> Font {
        WidgetFace.pen.font(size: size, relativeTo: style)
    }

    /// Registers the bundled faces for this process (once).
    @discardableResult
    static func register() -> Set<String> { available }

    static func isAvailable(_ face: WidgetFace) -> Bool {
        available.contains(face.rawValue)
    }

    private static let available: Set<String> = {
        let urls = ["ttf", "otf"].flatMap { ext in
            (Bundle.main.urls(forResourcesWithExtension: ext, subdirectory: nil) ?? [])
                + (Bundle.main.urls(forResourcesWithExtension: ext, subdirectory: "Fonts") ?? [])
        }
        for url in urls where url.lastPathComponent.hasPrefix("LF") {
            // Already registered (Info.plist, or a preview reusing the process) is fine.
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        var found = Set<String>()
        for face in WidgetFace.allCases {
            let descriptor = CTFontDescriptorCreateWithAttributes([kCTFontNameAttribute: face.rawValue] as CFDictionary)
            if let match = CTFontDescriptorCreateMatchingFontDescriptor(descriptor, nil),
               let name = CTFontDescriptorCopyAttribute(match, kCTFontNameAttribute) as? String,
               name == face.rawValue {
                found.insert(face.rawValue)
            }
        }
        if found.count < WidgetFace.allCases.count {
            let missing = WidgetFace.allCases.map(\.rawValue).filter { !found.contains($0) }
            Logger(subsystem: "com.learnfrc.app.widgets", category: "fonts")
                .error("Widget fonts missing: \(missing.joined(separator: ", "), privacy: .public). Using system fonts for those.")
        }
        return found
    }()
}

// MARK: - Text helpers

extension View {
    /// A heading in the site's style: Bricolage 800, tracking -0.025em.
    func widgetTitle(_ size: CGFloat, relativeTo style: Font.TextStyle = .headline) -> some View {
        font(WidgetFonts.display(size, relativeTo: style))
            .tracking(size * -0.025)
    }
}
