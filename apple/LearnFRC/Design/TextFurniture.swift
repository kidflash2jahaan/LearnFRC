import SwiftUI

/// A small Space Mono label (`nb-slug`) for anything that's a number or an identifier:
/// `dept / programming-software`, `settings / email`, timestamps, counts. Lowercase copy.
struct SlugText: View {
    let text: String
    var color: Color
    var size: CGFloat
    var weight: Font.Weight

    init(_ text: String, color: Color = LF.Palette.graphite, size: CGFloat = 12.5, weight: Font.Weight = .regular) {
        self.text = text
        self.color = color
        self.size = size
        self.weight = weight
    }

    var body: some View {
        Text(text)
            .font(LF.Fonts.mono(size, weight: weight, relativeTo: .caption))
            .tracking(size * 0.02)
            .monospacedDigit()
            .foregroundStyle(color)
    }
}

/// The blue Caveat margin note (`nb-pen`): the handwriting a student adds after the fact.
/// Never a heading, label or control, and at most one or two per screen.
/// Sits at a slight angle, which goes away under Reduce Motion.
///
/// It always wraps to as many lines as it needs (`fixedSize` vertically), and at the
/// accessibility sizes shrinks a hair (`minimumScaleFactor(0.9)`) rather than lose its last
/// line: on iOS a note could measure a few points short of its wrapped lines and draw one
/// line fewer, cut off with an ellipsis ("nobody reads thes…" at AX5 on iPhone).
struct MarkerText: View {
    let text: String
    var size: CGFloat
    var angle: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(_ text: String, size: CGFloat = 20, angle: Double = -1.2) {
        self.text = text
        self.size = size
        self.angle = angle
    }

    var body: some View {
        Text(text)
            .font(LF.Fonts.note(size))
            .foregroundStyle(LF.Palette.blue)
            .minimumScaleFactor(0.9)
            .fixedSize(horizontal: false, vertical: true)
            .textRenderer(PenOverhangRenderer())
            .rotationEffect(.degrees(reduceMotion ? 0 : angle), anchor: .leading)
    }
}

/// Draws a pen note's lines exactly where SwiftUI laid them out, without clipping the strokes
/// that overhang them. Caveat's final letters ("d", "f") reach a few points past the end of
/// their line and the standard drawing stops at the line's edge, so a note ending against a
/// column edge lost them ("lockea"). Give such a note a few points of trailing padding.
/// (A non-zero `displayPadding` would shift the drawing, so it stays at the default.)
struct PenOverhangRenderer: TextRenderer {
    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        for line in layout {
            context.draw(line)
        }
    }
}

/// The mono kicker above a section heading (`nb-marker`), struck by a short blue pen stroke:
/// `—— the 60-second tour`. Replaces an all-caps eyebrow. Lowercase copy.
struct SectionLabel: View {
    let text: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .caption) private var stroke: CGFloat = 34

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10.4) {
            Rectangle()
                .fill(LF.Palette.blue)
                // The rule grows with the label, but not past 48pt: at AX5 it would take a
                // third of a phone's width and squeeze the words beside it.
                .frame(width: min(stroke, 48), height: 2)
                .rotationEffect(.degrees(reduceMotion ? 0 : -1))
                .alignmentGuide(.firstTextBaseline) { d in d[.bottom] + 3.5 }
                .accessibilityHidden(true)
            Text(text)
                .font(LF.Fonts.mono(12.6, relativeTo: .caption))
                .tracking(12.6 * 0.05)
                .foregroundStyle(LF.Palette.graphite)
        }
    }
}

/// A headline figure with its unit (`nb-count`): "42 lessons". Blue bold mono figure, graphite unit.
struct CountText: View {
    let value: String
    var unit: String?
    var size: CGFloat

    init(_ value: Int, unit: String? = nil, size: CGFloat = 21) {
        self.init(value.formatted(), unit: unit, size: size)
    }

    init(_ value: String, unit: String? = nil, size: CGFloat = 21) {
        self.value = value
        self.unit = unit
        self.size = size
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6.4) {
            Text(value)
                .font(LF.Fonts.mono(size, weight: .bold, relativeTo: .title3))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
                // A figure is never split across lines ("+1 / 0"); the unit wraps instead.
                .lineLimit(1)
                .fixedSize()
            if let unit {
                Text(unit)
                    .font(LF.Fonts.mono(12, relativeTo: .caption))
                    .tracking(12 * 0.06)
                    .foregroundStyle(LF.Palette.graphite)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The LearnFRC logotype (`nb-brand`): "learn" in ink and "FRC" in blue inside a hand-drawn
/// blue box, set slightly crooked. Use it as a home title or the Mac sidebar header.
struct LearnFRCWordmark: View {
    var size: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(size: CGFloat = 22) {
        self.size = size
    }

    var body: some View {
        HStack(spacing: size * 0.28) {
            Text("learn")
                .foregroundStyle(LF.Palette.ink)
            Text("FRC")
                .foregroundStyle(LF.Palette.blue)
                .padding(.top, size * 0.05)
                .padding(.bottom, size * 0.12)
                .padding(.horizontal, size * 0.34)
                .overlay {
                    HandShape(.s).strokeBorder(LF.Palette.blue, lineWidth: LF.Metrics.stroke)
                }
                .rotationEffect(.degrees(reduceMotion ? 0 : SiteTokens.Tilt.brand))
        }
        .font(LF.Fonts.display(size, relativeTo: .title2))
        .tracking(size * -0.04)
        .lineLimit(1)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("LearnFRC")
    }
}

#Preview("Text furniture", traits: .fixedLayout(width: 393, height: 420)) {
    VStack(alignment: .leading, spacing: 16) {
        LearnFRCWordmark(size: 28)
        SectionLabel("the 60-second tour")
        Text("Every job on an FRC team, written down.").lfTitle(.h1)
        SlugText("dept / programming-software")
        CountText(42, unit: "lessons")
        MarkerText("start here if you've never built a robot")
    }
    .padding(LF.Metrics.gutter)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .paperBackground()
}
