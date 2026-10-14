import SwiftUI

/// The site's index card (`nb-box`), optionally tilted (`nb-tilt`), taped (`nb-tape`) and
/// liftable (`nb-lift`).
///
///     NotebookCard(tilt: .preset(index), tape: true, lift: true) {
///         SlugText("dept / programming-software")
///         Text("Programming").lfTitle(.h3)
///     }
///
/// - `tilt`: the resting angle. Keep tilts off anything read at length (lesson body, forms).
/// - `tape`: a strip of kraft tape over the top edge.
/// - `lift`: the card sits on a light drop and, under a pointer (iPad, Mac) or keyboard focus,
///   straightens, rises 3pt and the drop deepens, in 180ms. Inside `.buttonStyle(.notebookCard)`
///   it also presses into its drop on touch.
///
/// The card fills the width it's offered, like a block on the site, and pads its content by
/// `LF.Metrics.cardPadding` unless you pass `padding:`. Under Reduce Motion it lies flat.
struct NotebookCard<Content: View>: View {
    var tilt: LF.Tilt
    var tape: Bool
    var lift: Bool
    var padding: CGFloat
    var alignment: HorizontalAlignment
    var tapeAngle: Double?
    @ViewBuilder var content: Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isFocused) private var isFocused
    @Environment(\.notebookCardPressed) private var isPressed
    @State private var isHovering = false

    init(tilt: LF.Tilt = .none,
         tape: Bool = false,
         lift: Bool = false,
         padding: CGFloat = LF.Metrics.cardPadding,
         alignment: HorizontalAlignment = .leading,
         tapeAngle: Double? = nil,
         @ViewBuilder content: () -> Content) {
        self.tilt = tilt
        self.tape = tape
        self.lift = lift
        self.padding = padding
        self.alignment = alignment
        self.tapeAngle = tapeAngle
        self.content = content()
    }

    private var isLifted: Bool { lift && (isHovering || isFocused) && !isPressed }

    private var shadow: LF.Shadow {
        guard lift else { return .none }
        if isPressed { return .none }
        return isLifted ? .lifted : .card
    }

    private var angle: Double {
        if reduceMotion || isLifted || isPressed { return 0 }
        return tilt.degrees
    }

    private var travel: CGSize {
        if reduceMotion { return .zero }
        if isPressed { return lift ? CGSize(width: LF.Shadow.card.x, height: LF.Shadow.card.y) : CGSize(width: 1, height: 1) }
        if isLifted { return CGSize(width: 0, height: -SiteTokens.Movement.liftRise) }
        return .zero
    }

    /// Tape leans against the card's own tilt so the two never match.
    private var resolvedTapeAngle: Double {
        tapeAngle ?? (tilt.degrees > 0 ? -3.4 : 2.6)
    }

    var body: some View {
        VStack(alignment: alignment, spacing: 0) {
            content
        }
        .padding(padding)
        .padding(.top, tape ? 4 : 0)
        .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .top))
        .background {
            NotebookBoxBackground(size: .a, shadow: shadow)
        }
        .overlay(alignment: .topLeading) {
            if tape {
                TapeStrip(angle: resolvedTapeAngle)
                    .offset(x: 16, y: -12)
            }
        }
        .contentShape(HandShape(.a))
        .rotationEffect(.degrees(angle))
        .offset(travel)
        .onHover { hovering in
            guard lift else { return }
            isHovering = hovering
        }
        .animation(reduceMotion ? nil : (isPressed ? LF.Motion.press : LF.Motion.lift), value: isLifted)
        .animation(reduceMotion ? nil : (isPressed ? LF.Motion.press : LF.Motion.hover), value: isPressed)
        .accessibilityElement(children: .contain)
    }
}

/// Button style for a whole tappable card: `Button { } label: { NotebookCard(lift: true) { ... } }`
/// with `.buttonStyle(.notebookCard)`. The card presses into its drop while held and keeps the
/// label's own colours (no system tint wash).
struct NotebookCardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .environment(\.notebookCardPressed, configuration.isPressed)
            .foregroundStyle(LF.Palette.ink)
            #if os(macOS)
            .pointerStyle(.link)
            #else
            .hoverEffectDisabled()   // the card's own lift replaces the system pointer highlight
            #endif
    }
}

extension ButtonStyle where Self == NotebookCardButtonStyle {
    /// A whole `NotebookCard` as the button: it presses into its own drop.
    static var notebookCard: NotebookCardButtonStyle { NotebookCardButtonStyle() }
}

#Preview("Cards, iPhone", traits: .fixedLayout(width: 393, height: 700)) {
    ScrollView {
        VStack(spacing: 28) {
            ForEach(0..<3, id: \.self) { i in
                Button {} label: {
                    NotebookCard(tilt: .preset(i), tape: i == 0, lift: true) {
                        SlugText("dept / programming-software")
                        Text("Programming").lfTitle(.h3).padding(.top, 6)
                        Text("Java, WPILib and command-based code that drives the robot.")
                            .font(LF.Fonts.body(15))
                            .foregroundStyle(LF.Palette.graphite)
                            .padding(.top, 4)
                    }
                }
                .buttonStyle(.notebookCard)
            }
        }
        .padding(LF.Metrics.gutter)
        .padding(.top, 12)
    }
    .paperBackground()
}

#Preview("Cards, dark", traits: .fixedLayout(width: 393, height: 400)) {
    VStack(spacing: 28) {
        NotebookCard(tilt: .left, tape: true, lift: true) {
            SlugText("dept / mechanical-build")
            Text("Mechanical").lfTitle(.h3).padding(.top, 6)
        }
        NotebookCard {
            Text("A flat card with no drop.").font(LF.Fonts.body())
        }
    }
    .padding(LF.Metrics.gutter)
    .frame(maxHeight: .infinity)
    .paperBackground()
    .environment(\.colorScheme, .dark)
}
