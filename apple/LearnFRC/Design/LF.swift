import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The LearnFRC notebook system: the website's `globals.css` translated for SwiftUI.
///
/// Content (cards, type, meters, tape) uses these tokens. Chrome (navigation bars, tab bars,
/// sidebars, sheets, menus) stays native and is only tinted with `LF.Palette.blue`.
/// Rules carried over from the site:
/// - Blue is the only accent and the only colour that means "you can tap this".
/// - No status colours. Success is ink plus a check or the stamp; an error is ink with a heavy ink rule.
/// - Depth is a hard offset drop, never a blur.
/// - Tilts, tape angles and travel switch off under Reduce Motion.
nonisolated enum LF {

    // MARK: Palette

    /// Dynamic light and dark colours. Light values come from the site's CSS through
    /// `Tokens.generated.swift`; dark and high-contrast values live in the asset catalog
    /// (`Assets.xcassets/Notebook`), with the same values below as a fallback.
    enum Palette {
        /// Cool grey newsprint, the page ground.
        static let paper = Color.notebook("Paper", light: SiteTokens.Palette.paper, dark: .hex(0x121416))
        /// Index-card stock, every raised surface.
        static let card = Color.notebook("Card", light: SiteTokens.Palette.card, dark: .hex(0x1C1F23))
        /// Marker black (chalk at night): all primary type and every border.
        static let ink = Color.notebook("Ink", light: SiteTokens.Palette.ink, dark: .hex(0xE8EAE5))
        /// Pencil grey, secondary type only.
        static let graphite = Color.notebook("Graphite", light: SiteTokens.Palette.graphite, dark: .hex(0xA2A8AC))
        /// Ballpoint blue: links, figures, the marker stroke, meter fill, pen notes.
        static let blue = Color.notebook("Blue", light: SiteTokens.Palette.blue, dark: .hex(0x82A7FF))
        /// Packing tape. Decoration only, never carries text.
        static let kraft = Color.notebook("Kraft", light: SiteTokens.Palette.kraft, dark: .hex(0xA88D64))
        /// The inner hairline and dashed rules (`--rule`).
        static let rule = Color.notebook("Rule", light: SiteTokens.Palette.rule, dark: .hex(0xE8EAE5, alpha: 0.28))
        /// Fill for surfaces that carry text on blue (primary button, selected tag, slab).
        /// Same as `blue` in light; deeper in dark so `onBlue` text keeps its contrast.
        static let blueButton = Color.notebook("BlueButton", light: SiteTokens.Palette.blue, dark: .hex(0x2648D7))
        /// Text and marks on `blueButton`.
        static let onBlue = Color.notebook("OnBlue", light: SiteTokens.Palette.card, dark: .hex(0xF5F6F2))
        /// The tint for the iPad sidebar, where the system fills the selected row with the tint
        /// and writes its label in white. Same as `blue` in light; in dark a middle blue, so the
        /// white label keeps 4.5:1 (4.8:1) and the sidebar's tinted icons keep 3:1.
        /// Not for content or the iPhone tab bar (those stay `blue`). The Mac sidebar ignores
        /// the tint and fills the selection from the app's AccentColor, which has a Mac-only dark
        /// value of the same blue (white label about 9.5:1 once macOS deepens it).
        static let sidebarTint = Color.notebook("SidebarTint", light: SiteTokens.Palette.blue, dark: .hex(0x4769E2))
        /// The 23pt graph ruling (`--grid`).
        static let grid = Color.notebook("Grid", light: SiteTokens.Palette.grid, dark: .hex(0x82A7FF, alpha: 0.07))

        /// The blue washes the kit uses for hover, highlight and selection.
        static let rowWash = blue.opacity(SiteTokens.Wash.row)
        static let hoverWash = blue.opacity(SiteTokens.Wash.ghostHover)
        static let highlightWash = blue.opacity(SiteTokens.Wash.menu)
        static let selectionWash = blue.opacity(SiteTokens.Wash.selection)
    }

    // MARK: Type

    /// The three bundled faces. Every function scales with Dynamic Type through `relativeTo:`.
    /// If the bundled fonts failed to register, each falls back to the system font at the
    /// same size, weight and text style (monospaced for `mono`).
    enum Fonts {
        /// Bricolage Grotesque 800 at the site's heading cut for that size:
        /// 38pt and up uses the h1 cut (opsz 72, wdth 92), 24pt and up the h2 cut (opsz 40, wdth 95),
        /// anything smaller the h3 cut (opsz 24, wdth 96).
        static func display(_ size: CGFloat, relativeTo: Font.TextStyle = .title) -> Font {
            let face: FontFace = size >= 38 ? .displayLarge : (size >= 24 ? .displayMedium : .displaySmall)
            return face.font(size: size, relativeTo: relativeTo)
        }

        /// Bricolage Grotesque at the body cut (opsz 14, wdth 100), weights 400 to 800.
        static func body(_ size: CGFloat = 17, weight: Font.Weight = .regular, relativeTo: Font.TextStyle = .body) -> Font {
            let face: FontFace
            switch weight {
            case .medium: face = .bodyMedium
            case .semibold: face = .bodySemiBold
            case .bold: face = .bodyBold
            case .heavy, .black: face = .bodyExtraBold
            default: face = .bodyRegular
            }
            return face.font(size: size, relativeTo: relativeTo)
        }

        /// Space Mono, 400 or 700 (semibold and heavier map to 700). Numbers, identifiers,
        /// slugs, buttons, code.
        static func mono(_ size: CGFloat = 13, weight: Font.Weight = .regular, relativeTo: Font.TextStyle = .caption) -> Font {
            let bold = [Font.Weight.semibold, .bold, .heavy, .black].contains(weight)
            return (bold ? FontFace.monoBold : FontFace.monoRegular).font(size: size, relativeTo: relativeTo)
        }

        /// Caveat 600, for the blue margin note. One or two per screen at most.
        static func note(_ size: CGFloat = 20, relativeTo: Font.TextStyle = .callout) -> Font {
            FontFace.pen.font(size: size, relativeTo: relativeTo)
        }

        /// The site's heading levels at iPhone sizes, with the matching Dynamic Type style.
        static func title(_ level: TitleLevel) -> Font {
            display(level.size, relativeTo: level.textStyle)
        }
    }

    /// h1, h2, h3 as the site sets them. Use `.lfTitle(_:)` to get the font and tracking together.
    enum TitleLevel: Sendable, Hashable, CaseIterable {
        case h1, h2, h3

        /// Point size at the default Dynamic Type setting.
        var size: CGFloat {
            switch self {
            case .h1: 40
            case .h2: 30
            case .h3: 19
            }
        }

        var textStyle: Font.TextStyle {
            switch self {
            case .h1: .largeTitle
            case .h2: .title
            case .h3: .title3
            }
        }
    }

    // MARK: Motion

    /// The site's curves and durations. Nothing springs, nothing overshoots, nothing loops.
    /// Pair with `.lfAnimation(_:value:)` or `LF.Motion.perform` so Reduce Motion is honoured.
    enum Motion {
        /// Hover and focus on a link, tag, row or button (140ms, ease-out).
        static let hover = curve(SiteTokens.Ease.out, SiteTokens.Duration.hover)
        /// Press feedback, the fastest thing in the system (90ms, ease-out).
        static let press = curve(SiteTokens.Ease.out, SiteTokens.Duration.press)
        /// A card or band arriving (300ms, ease-out).
        static let arrive = curve(SiteTokens.Ease.out, SiteTokens.Duration.enter)
        /// Ink landing: a stamp, a figure (180ms, ease-out). Comes down and stops dead.
        static let stamp = curve(SiteTokens.Ease.out, SiteTokens.Duration.lift)
        /// Something already on screen moving to its new place (300ms, ease-move).
        static let settle = curve(SiteTokens.Ease.move, SiteTokens.Duration.enter)
        /// The card lift on hover and focus (180ms, ease-out).
        static let lift = curve(SiteTokens.Ease.out, SiteTokens.Duration.lift)
        /// A ruled line or a meter bar drawing itself (520ms, ease-draw).
        static let draw = curve(SiteTokens.Ease.draw, SiteTokens.Duration.draw)

        private static func curve(_ c: SiteTokens.Curve, _ duration: Double) -> Animation {
            .timingCurve(c.x1, c.y1, c.x2, c.y2, duration: duration)
        }

        /// `animation`, or nil when the person has Reduce Motion on.
        static func respecting(_ reduceMotion: Bool, _ animation: Animation) -> Animation? {
            reduceMotion ? nil : animation
        }

        /// Whether Reduce Motion is on right now, for imperative code.
        @MainActor static var isReduced: Bool {
            #if canImport(UIKit)
            UIAccessibility.isReduceMotionEnabled
            #else
            NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
            #endif
        }

        /// `withAnimation` that skips the animation under Reduce Motion.
        @MainActor static func perform<Result>(_ animation: Animation, _ body: () throws -> Result) rethrows -> Result {
            if isReduced { return try body() }
            return try withAnimation(animation, body)
        }
    }

    // MARK: Metrics

    enum Metrics {
        /// Page gutter on compact widths. Use `readableGutter(for:)` for wider windows.
        static let gutter: CGFloat = 16
        /// The ink border on every box, button and meter.
        static let stroke: CGFloat = 2
        /// Inside a card.
        static let cardPadding: CGFloat = 18
        /// The inner hairline and dashed rules.
        static let hairline: CGFloat = 1
        /// Heavy edges: destructive buttons, error bars, note bars.
        static let heavyStroke: CGFloat = 3
        /// Minimum touch target.
        static let tap: CGFloat = SiteTokens.Layout.tap
        /// The graph-paper ruling.
        static let gridStep: CGFloat = SiteTokens.Layout.gridStep
        /// The widest running text gets: about 85 characters of the 17pt body face (articles,
        /// the glossary). The lesson column keeps a tighter measure of its own, about 72
        /// characters (`LessonView.measure`), closer to the site's `68ch`.
        static let readableWidth: CGFloat = 680
        /// `nb-wrap`: page content never gets wider than this.
        static let maxContentWidth: CGFloat = 1280

        /// The site's `--gut` (clamp(1.1rem, 4vw, 3.4rem)) for a container this wide.
        static func gutter(for width: CGFloat) -> CGFloat {
            min(max(width * 0.04, gutter), 54)
        }

        /// A page's leading and trailing margins: `gutter(for:)` on both sides, except next to
        /// iPhone Duo's vertical bar. There the system's container margins
        /// (`contentMargins(for: .container)`, iOS 27.1) come out asymmetric, 20 on the open
        /// side and 0 against the bar, because the bar already stands off the content. That
        /// side takes the system's value, and the open side the larger of the two, so the cover
        /// screen stops losing 16pt of a 382pt column. Pass `container` from
        /// `GeometryProxy.lfContainerMargins` (nil before 27.1 and on the Mac gives the gutter
        /// on both sides), or read `GeometryProxy.lfPageMargins` for both at once.
        static func pageMargins(for width: CGFloat, container: EdgeInsets? = nil) -> PageMargins {
            let gutter = gutter(for: width)
            // Symmetric margins (every other device) keep the site's gutter, as before.
            guard let container, abs(container.leading - container.trailing) >= 1 else {
                return PageMargins(leading: gutter, trailing: gutter)
            }
            return container.trailing < container.leading
                ? PageMargins(leading: max(gutter, container.leading), trailing: max(0, container.trailing))
                : PageMargins(leading: max(0, container.leading), trailing: max(gutter, container.trailing))
        }
    }

    /// A page's horizontal margins (`Metrics.pageMargins(for:container:)`).
    struct PageMargins: Equatable, Sendable {
        var leading: CGFloat
        var trailing: CGFloat

        /// Both together: what the margins take out of the page's width.
        var total: CGFloat { leading + trailing }
        /// As padding: `.padding(margins.insets)`.
        var insets: EdgeInsets { EdgeInsets(top: 0, leading: leading, bottom: 0, trailing: trailing) }
    }

    // MARK: Tilt

    /// A card's resting angle. No two pieces on one screen should share one: in a list or grid
    /// use `.preset(index)`, which cycles the site's four angles.
    enum Tilt: Sendable, Hashable {
        case none, left, right
        case degrees(Double)

        static func preset(_ index: Int) -> Tilt {
            let presets = SiteTokens.Tilt.presets
            return .degrees(presets[((index % presets.count) + presets.count) % presets.count])
        }

        var degrees: Double {
            switch self {
            case .none: 0
            case .left: SiteTokens.Tilt.presets[0]
            case .right: SiteTokens.Tilt.presets[3]
            case .degrees(let d): d
            }
        }
    }

    // MARK: Shadow

    /// Hard offset drops ("a photocopy misregistration"). Never blurred.
    struct Shadow: Sendable, Hashable {
        let x: CGFloat
        let y: CGFloat
        let color: Color

        /// No drop.
        static let none = Shadow(x: 0, y: 0, color: .clear)
        /// `--drop-1`, a card at rest.
        static let card = Shadow(SiteTokens.Drops.drop1, darkAlpha: 0.12)
        /// `--drop-2`, a card lifted on hover or focus.
        static let lifted = Shadow(SiteTokens.Drops.drop2, darkAlpha: 0.2)
        /// `--drop-ink`, the primary button and floating surfaces.
        static let ink = Shadow(SiteTokens.Drops.dropInk, darkAlpha: 0.5)
        /// The ghost button's drop.
        static let ghost = Shadow(SiteTokens.Drops.ghost, darkAlpha: 0.3)

        init(x: CGFloat, y: CGFloat, color: Color) {
            self.x = x
            self.y = y
            self.color = color
        }

        /// Light: the site's drop exactly (ink at the CSS alpha). Dark: the night binder's ink
        /// (chalk) at `darkAlpha`. The drop is a misregistered ink layer, not a cast shadow, so it
        /// stays the ink colour; a black drop simply vanishes on night paper.
        private init(_ drop: SiteTokens.Drop, darkAlpha: Double) {
            self.init(x: drop.x, y: drop.y,
                      color: .notebook(nil, light: drop.color, dark: .hex(0xE8EAE5, alpha: darkAlpha)))
        }

        var isVisible: Bool { x != 0 || y != 0 }
    }
}

// MARK: - Fonts

/// The bundled faces and their PostScript names (see `FontRegistry`).
nonisolated enum FontFace: String, CaseIterable, Sendable {
    case bodyRegular = "LFBricolage-Regular"
    case bodyMedium = "LFBricolage-Medium"
    case bodySemiBold = "LFBricolage-SemiBold"
    case bodyBold = "LFBricolage-Bold"
    case bodyExtraBold = "LFBricolage-ExtraBold"
    case displaySmall = "LFBricolageDisplay-S"
    case displayMedium = "LFBricolageDisplay-M"
    case displayLarge = "LFBricolageDisplay-L"
    case monoRegular = "LFSpaceMono-Regular"
    case monoBold = "LFSpaceMono-Bold"
    case pen = "LFCaveat-SemiBold"

    var postScriptName: String { rawValue }

    /// What the system font should look like if this face isn't available.
    var fallbackWeight: Font.Weight {
        switch self {
        case .bodyRegular, .monoRegular: .regular
        case .bodyMedium: .medium
        case .bodySemiBold, .pen: .semibold
        case .bodyBold, .monoBold: .bold
        case .bodyExtraBold, .displaySmall, .displayMedium, .displayLarge: .heavy
        }
    }

    var isMono: Bool { self == .monoRegular || self == .monoBold }

    func font(size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        if FontRegistry.isAvailable(self) {
            return .custom(postScriptName, size: size, relativeTo: style)
        }
        // An unknown custom name resolves to the system font at that size, still scaled
        // with Dynamic Type; weight and design are applied on top.
        let fallback = Font.custom(postScriptName, size: size, relativeTo: style).weight(fallbackWeight)
        return isMono ? fallback.monospaced() : fallback
    }
}

// MARK: - Dynamic colours

extension SiteTokens.RGBA {
    nonisolated static func hex(_ value: UInt32, alpha: Double = 1) -> SiteTokens.RGBA {
        SiteTokens.RGBA(red: Double((value >> 16) & 0xFF) / 255,
                        green: Double((value >> 8) & 0xFF) / 255,
                        blue: Double(value & 0xFF) / 255,
                        alpha: alpha)
    }
}

extension Color {
    /// A colour whose light value is the site's token and whose other appearances
    /// (dark, increased contrast) come from the named asset-catalog colour, with
    /// `dark` as the fallback when the asset isn't there (widgets, tests).
    nonisolated static func notebook(_ asset: String?, light: SiteTokens.RGBA, dark: SiteTokens.RGBA) -> Color {
        #if canImport(UIKit)
        let provider = UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            let highContrast = traits.accessibilityContrast == .high
            if !isDark && !highContrast { return UIColor(light) }
            if let asset, let named = UIColor(named: asset, in: .main, compatibleWith: traits) {
                return named
            }
            return UIColor(isDark ? dark : light)
        }
        return Color(uiColor: provider)
        #elseif canImport(AppKit)
        let name = asset.map { "LF.\($0)" }
        let provider = NSColor(name: name) { appearance in
            let match = appearance.bestMatch(from: [.aqua, .darkAqua, .accessibilityHighContrastAqua, .accessibilityHighContrastDarkAqua])
            let isDark = match == .darkAqua || match == .accessibilityHighContrastDarkAqua
            let highContrast = match == .accessibilityHighContrastAqua || match == .accessibilityHighContrastDarkAqua
            if !isDark && !highContrast { return NSColor(light) }
            if let asset, let named = NSColor(named: asset, bundle: .main) {
                var resolved: NSColor?
                appearance.performAsCurrentDrawingAppearance {
                    resolved = named.usingColorSpace(.sRGB)
                }
                if let resolved { return resolved }
            }
            return NSColor(isDark ? dark : light)
        }
        return Color(nsColor: provider)
        #endif
    }
}

#if canImport(UIKit)
private extension UIColor {
    nonisolated convenience init(_ c: SiteTokens.RGBA) {
        self.init(red: c.red, green: c.green, blue: c.blue, alpha: c.alpha)
    }
}
#elseif canImport(AppKit)
private extension NSColor {
    nonisolated convenience init(_ c: SiteTokens.RGBA) {
        self.init(srgbRed: c.red, green: c.green, blue: c.blue, alpha: c.alpha)
    }
}
#endif

// MARK: - Environment

extension EnvironmentValues {
    /// Set by `.buttonStyle(.notebookCard)` while the card is held down, so a
    /// `NotebookCard` inside it can press into its own drop.
    @Entry var notebookCardPressed: Bool = false
}

// MARK: - Page margins

extension GeometryProxy {
    /// The system's container margins for this view (iOS 27.1), asymmetric next to iPhone
    /// Duo's vertical bar. Nil before iOS 27.1 and on the Mac, whose 27.0 SDK lacks them.
    var lfContainerMargins: EdgeInsets? {
        #if os(iOS)
        if #available(iOS 27.1, *), DuoAPIs.areAvailable {
            return contentMargins(for: .container)
        }
        #endif
        return nil
    }

    /// This page's horizontal margins for its width (`LF.Metrics.pageMargins(for:container:)`).
    /// Read it where the page measures its width, outside the scroll view.
    var lfPageMargins: LF.PageMargins {
        LF.Metrics.pageMargins(for: size.width, container: lfContainerMargins)
    }
}

// MARK: - View helpers

extension View {
    /// Animates changes to `value` with `animation`, or not at all under Reduce Motion.
    func lfAnimation<V: Equatable>(_ animation: Animation, value: V) -> some View {
        modifier(ReduceMotionAnimation(animation: animation, value: value))
    }

    /// A heading in the site's style: Bricolage 800 at that level's cut, tracking -0.025em,
    /// tight leading, balanced wrapping.
    func lfTitle(_ level: LF.TitleLevel, color: Color = LF.Palette.ink) -> some View {
        self
            .font(LF.Fonts.title(level))
            .tracking(level.size * -0.025)
            .lineHeight(.multiple(factor: level == .h3 ? 1.06 : 0.98))
            .foregroundStyle(color)
            .accessibilityAddTraits(.isHeader)
    }

    /// Running text in the site's style: Bricolage 400 at line height 1.55 (`lineHeight` 1.7
    /// matches the lesson body's `nb-prose`).
    func lfProse(_ size: CGFloat = 17, lineHeight: CGFloat = 1.55, color: Color = LF.Palette.ink) -> some View {
        self
            .font(LF.Fonts.body(size))
            .lineHeight(.multiple(factor: lineHeight))
            .foregroundStyle(color)
    }
}

private struct ReduceMotionAnimation<V: Equatable>: ViewModifier {
    let animation: Animation
    let value: V
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.animation(reduceMotion ? nil : animation, value: value)
    }
}
