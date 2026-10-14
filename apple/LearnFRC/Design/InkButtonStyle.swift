import SwiftUI

/// The site's buttons (`nb-btn`, `nb-btn-ghost`, `nb-btn-sm`).
///
/// - `.ink`: the primary action. Blue fill, ink offset drop, and it presses down into its own
///   drop (90ms down, 140ms back). One filled button per view.
/// - `.inkGhost`: secondary. Same geometry, drawn rather than filled.
/// - `.inkSmall`: the primary at nav scale. `.inkGhostSmall` for the ghost one.
/// - `.inkLarge`, `.inkDestructive` (ghost with a heavy 3pt edge; destruction reads by weight
///   and wording, never by colour).
///
/// Text is Space Mono 700 in sentence case ("Start learning"). Every size keeps the 44pt
/// minimum target. Pass `fullWidth: true` to stretch it across its container.
struct InkButtonStyle: ButtonStyle {
    enum Kind: Sendable, Hashable { case primary, ghost, destructive }
    enum Size: Sendable, Hashable { case small, regular, large }

    var kind: Kind
    var size: Size
    var fullWidth: Bool

    init(_ kind: Kind = .primary, size: Size = .regular, fullWidth: Bool = false) {
        self.kind = kind
        self.size = size
        self.fullWidth = fullWidth
    }

    func makeBody(configuration: Configuration) -> some View {
        InkButton(configuration: configuration, kind: kind, size: size, fullWidth: fullWidth)
    }
}

extension ButtonStyle where Self == InkButtonStyle {
    /// Primary: blue fill, ink drop, presses into it.
    static var ink: InkButtonStyle { InkButtonStyle(.primary) }
    /// Secondary: drawn, not filled.
    static var inkGhost: InkButtonStyle { InkButtonStyle(.ghost) }
    /// Primary at nav scale.
    static var inkSmall: InkButtonStyle { InkButtonStyle(.primary, size: .small) }
    /// Secondary at nav scale.
    static var inkGhostSmall: InkButtonStyle { InkButtonStyle(.ghost, size: .small) }
    /// The big primary at the end of a flow (lesson complete, sign up).
    static var inkLarge: InkButtonStyle { InkButtonStyle(.primary, size: .large) }
    /// Delete, sign out: a ghost with a heavy edge.
    static var inkDestructive: InkButtonStyle { InkButtonStyle(.destructive) }
}

private struct InkButton: View {
    let configuration: ButtonStyleConfiguration
    let kind: InkButtonStyle.Kind
    let size: InkButtonStyle.Size
    let fullWidth: Bool

    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isHovering = false

    @ScaledMetric(relativeTo: .callout) private var verticalPadding: CGFloat = 11.5
    @ScaledMetric(relativeTo: .callout) private var regularHorizontal: CGFloat = 18.4
    @ScaledMetric(relativeTo: .footnote) private var smallHorizontal: CGFloat = 14.4
    @ScaledMetric(relativeTo: .callout) private var largeHorizontal: CGFloat = 25.6

    private var isPressed: Bool { configuration.isPressed && isEnabled }

    private var fontSize: CGFloat {
        switch size {
        case .small: 13
        case .regular: 14
        case .large: 15.5
        }
    }

    private var horizontalPadding: CGFloat {
        switch size {
        case .small: Self.capped(smallHorizontal, base: 14.4)
        case .regular: Self.capped(regularHorizontal, base: 18.4)
        case .large: Self.capped(largeHorizontal, base: 25.6)
        }
    }

    private var verticalInset: CGFloat {
        let vertical = Self.capped(verticalPadding, base: 11.5)
        return size == .small ? vertical * 0.85 : vertical
    }

    /// Padding grows with the text, but only to half again its base: at the accessibility
    /// sizes the label needs the width (25.6pt scaled to AX5 is about 85pt a side, and broke
    /// "complete" in two).
    private static func capped(_ scaled: CGFloat, base: CGFloat) -> CGFloat {
        min(scaled, base * 1.5)
    }

    private var minHeight: CGFloat { size == .large ? 50.4 : LF.Metrics.tap }

    private var fill: Color {
        switch kind {
        case .primary: isEnabled ? LF.Palette.blueButton : LF.Palette.paper
        case .ghost, .destructive: isHovering && isEnabled ? LF.Palette.hoverWash : .clear
        }
    }

    private var foreground: Color {
        guard isEnabled else { return LF.Palette.graphite }
        return kind == .primary ? LF.Palette.onBlue : LF.Palette.ink
    }

    private var border: Color {
        switch kind {
        case .primary: isEnabled ? LF.Palette.blueButton : LF.Palette.graphite
        case .ghost, .destructive: isEnabled ? LF.Palette.ink : LF.Palette.rule
        }
    }

    private var drop: LF.Shadow {
        guard isEnabled else { return .none }
        return kind == .primary ? .ink : .ghost
    }

    /// The face travels into the drop: 2pt under a pointer, the full 3pt when pressed.
    private var travel: CGFloat {
        guard isEnabled, !reduceMotion else { return 0 }
        if isPressed { return SiteTokens.Movement.pressTravel }
        if isHovering { return 2 }
        return 0
    }

    var body: some View {
        configuration.label
            .font(LF.Fonts.mono(fontSize, weight: .bold, relativeTo: size == .small ? .footnote : .callout))
            .tracking(fontSize * 0.01)
            .multilineTextAlignment(.center)
            // Space Mono is wide: past AX3 a single word ("complete") can be wider than a phone
            // column, and it would break mid-word. The label stops growing there; the rest of
            // the screen keeps scaling.
            .dynamicTypeSize(...DynamicTypeSize.accessibility3)
            .foregroundStyle(foreground)
            .padding(.vertical, verticalInset)
            .padding(.horizontal, horizontalPadding)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: minHeight)
            .background {
                ZStack {
                    HandShape(.s).fill(fill)
                    HandShape(.s).strokeBorder(border, lineWidth: kind == .destructive ? LF.Metrics.heavyStroke : LF.Metrics.stroke)
                }
            }
            .offset(x: travel, y: travel)
            // The drop stays put while the face moves onto it, so a press reads as the
            // button being pushed into its own shadow.
            .background {
                if drop.isVisible {
                    InkDropShape(size: .s, drop: CGSize(width: drop.x, height: drop.y), faceTravel: travel)
                        .fill(drop.color)
                }
            }
            .contentShape(HandShape(.s))
            .onHover { isHovering = $0 }
            #if os(iOS)
            .hoverEffectDisabled()   // the drawn hover above replaces the system pointer highlight
            #endif
            .animation(reduceMotion ? nil : (isPressed ? LF.Motion.press : LF.Motion.hover), value: isPressed)
            .animation(reduceMotion ? nil : LF.Motion.hover, value: isHovering)
    }
}

/// A hard drop with the face cut out of it, like CSS `box-shadow`, which is never painted
/// under the element itself. That matters for the ghost button, whose face is transparent.
/// Animates with the face as it travels onto the drop.
nonisolated struct InkDropShape: Shape {
    var size: HandShape.Size
    var drop: CGSize
    var faceTravel: CGFloat

    var animatableData: CGFloat {
        get { faceTravel }
        set { faceTravel = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let shadow = HandShape(size).path(in: rect.offsetBy(dx: drop.width, dy: drop.height))
        let face = HandShape(size).path(in: rect.offsetBy(dx: faceTravel, dy: faceTravel))
        return shadow.subtracting(face)
    }
}

// MARK: - Rows

/// A whole row as the button (`nb-row`): lessons, articles, search results. Under a pointer it
/// slides 10pt right on a faint blue wash; held down, it shows the wash. Draw your own dashed
/// rule between rows (`DashedRule()`).
struct InkRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        InkRow(configuration: configuration)
    }
}

extension ButtonStyle where Self == InkRowButtonStyle {
    /// A full-width tappable row that slides under a pointer.
    static var inkRow: InkRowButtonStyle { InkRowButtonStyle() }
}

private struct InkRow: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isHovering = false

    var body: some View {
        configuration.label
            .foregroundStyle(LF.Palette.ink)
            .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: .leading)
            .offset(x: isHovering && !reduceMotion ? 10 : 0)
            .background {
                Rectangle().fill(isHovering || configuration.isPressed ? LF.Palette.rowWash : .clear)
            }
            .contentShape(Rectangle())
            .onHover { isHovering = $0 }
            #if os(iOS)
            .hoverEffectDisabled()
            #endif
            .animation(reduceMotion ? nil : LF.Motion.hover, value: isHovering)
            .animation(reduceMotion ? nil : LF.Motion.press, value: configuration.isPressed)
    }
}

#Preview("Buttons", traits: .fixedLayout(width: 393, height: 520)) {
    VStack(alignment: .leading, spacing: 18) {
        Button("Start learning") {}.buttonStyle(.ink)
        Button("Browse the departments") {}.buttonStyle(.inkGhost)
        HStack {
            Button("search") {}.buttonStyle(.inkGhostSmall)
            Button("Save") {}.buttonStyle(.inkSmall)
        }
        Button {} label: { Label("Next lesson", systemImage: "arrow.right") }
            .buttonStyle(InkButtonStyle(.primary, size: .large, fullWidth: true))
        Button("Delete account") {}.buttonStyle(.inkDestructive)
        Button("Not yet") {}.buttonStyle(.ink).disabled(true)
    }
    .padding(LF.Metrics.gutter)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .paperBackground()
}

#Preview("Buttons, dark", traits: .fixedLayout(width: 393, height: 300)) {
    VStack(alignment: .leading, spacing: 18) {
        Button("Start learning") {}.buttonStyle(.ink)
        Button("Browse the departments") {}.buttonStyle(.inkGhost)
        Button("Not yet") {}.buttonStyle(.ink).disabled(true)
    }
    .padding(LF.Metrics.gutter)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .paperBackground()
    .environment(\.colorScheme, .dark)
}
