import SwiftUI

/// The 2pt ink line between sections of the binder (`nb-rule`).
struct InkRule: View {
    var color: Color = LF.Palette.ink
    var thickness: CGFloat = LF.Metrics.stroke

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(height: thickness)
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }
}

/// The 1pt dashed hairline inside a card, above a footer, between rows (`nb-hair`).
struct DashedRule: View {
    var color: Color = LF.Palette.rule
    var thickness: CGFloat = LF.Metrics.hairline

    var body: some View {
        DashedLine()
            .stroke(color, style: StrokeStyle(lineWidth: thickness, dash: [3, 3]))
            .frame(height: thickness)
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }
}

private struct DashedLine: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return p
    }
}

/// A callout in a lesson or a form (`nb-note`): a dashed frame on card stock with a heavy
/// ink bar down the left, for a warning, a shortcut or an aside. Label it with a `SlugText`.
struct NoteCallout<Content: View>: View {
    @ViewBuilder var content: Content
    @ScaledMetric(relativeTo: .body) private var padding: CGFloat = 15

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) { content }
            .padding(padding)
            .padding(.leading, 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                ZStack(alignment: .leading) {
                    LF.Palette.card
                    Rectangle()
                        .fill(LF.Palette.ink)
                        .frame(width: LF.Metrics.heavyStroke)
                }
                .clipShape(HandShape(.s))
                .overlay {
                    HandShape(.s).strokeBorder(LF.Palette.rule, style: StrokeStyle(lineWidth: LF.Metrics.hairline, dash: [3, 3]))
                }
            }
            .accessibilityElement(children: .contain)
    }
}

/// The blue band (`nb-slab`), the one inverted surface: card-coloured text on blue between
/// 2pt ink rules. Use it for a strip at the top of a completion card or a big stat.
struct SlabView<Content: View>: View {
    @ViewBuilder var content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) { content }
            .foregroundStyle(LF.Palette.onBlue)
            .tint(LF.Palette.onBlue)
            .padding(.horizontal, LF.Metrics.cardPadding)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LF.Palette.blueButton)
            .overlay(alignment: .top) { InkRule() }
            .overlay(alignment: .bottom) { InkRule() }
    }
}

#Preview("Rules and notes", traits: .fixedLayout(width: 393, height: 360)) {
    VStack(alignment: .leading, spacing: 18) {
        InkRule()
        NoteCallout {
            SlugText("heads up")
            Text("Unplug the battery before you touch any wiring.")
                .font(LF.Fonts.body(16))
                .foregroundStyle(LF.Palette.ink)
        }
        DashedRule()
        SlabView {
            Text("LESSON COMPLETE").font(LF.Fonts.mono(13, weight: .bold)).tracking(0.8)
        }
    }
    .padding(LF.Metrics.gutter)
    .frame(maxHeight: .infinity, alignment: .top)
    .paperBackground()
}
