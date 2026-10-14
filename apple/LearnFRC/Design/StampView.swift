import SwiftUI

/// The inspection stamp: a ruled box struck at an angle, with a second strike slightly off
/// register because a hand pressed it. It marks something finished: a lesson, a quiz, a
/// department.
///
///     StampView("Completed", caption: "lesson / pid-basics", footnote: "+25 XP")
///
/// It lands once, when it appears: down 5pt from 4% oversize, stopping dead on
/// `LF.Motion.stamp` (no bounce, a stamp doesn't bounce), with a firm haptic. Under Reduce
/// Motion it's simply there, flat, and the haptic still fires. Pass `lands: false` for a stamp
/// that was already on the page (a list of finished lessons).
///
/// It grows with the text up to the first accessibility size and stops there: it's a mark set
/// on one unbroken line per row, and any larger it would be wider than a phone column. What it
/// says is read out by VoiceOver and printed again in the text beside it.
struct StampView: View {
    let title: String
    var caption: String?
    var footnote: String?
    var lands: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var landed = false
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    init(_ title: String = "Completed", caption: String? = nil, footnote: String? = nil, lands: Bool = true) {
        self.title = title
        self.caption = caption
        self.footnote = footnote
        self.lands = lands
    }

    private var resting: Bool { landed || !lands || reduceMotion }

    /// The text size the stamp stops growing at.
    private static let largestSize = DynamicTypeSize.accessibility1
    /// `scale`, stopped where the type stops (about 1.4 at AX1; `scale` itself reads the
    /// environment outside the stamp, so it keeps growing).
    private var inkScale: CGFloat { min(scale, 1.4) }

    var body: some View {
        VStack(spacing: 6) {
            line("LEARNFRC", size: 11.5, weight: .bold, tracking: 0.22)
            stampRule
            line(title.uppercased(), size: 16, weight: .bold, tracking: 0.14)
            if caption != nil || footnote != nil {
                stampRule
            }
            if let caption {
                line(caption, size: 11, weight: .regular, tracking: 0.06)
            }
            if let footnote {
                line(footnote, size: 11, weight: .regular, tracking: 0.18)
                    .padding(.top, caption == nil ? 0 : -4)
            }
        }
        .fixedSize()
        .dynamicTypeSize(...Self.largestSize)
        .padding(.horizontal, 18.4 * inkScale)
        .padding(.vertical, 13.6 * inkScale)
        .overlay {
            HandShape(.s).strokeBorder(LF.Palette.blue, lineWidth: LF.Metrics.stroke)
        }
        .background {
            // The off-register second strike.
            HandShape(.s)
                .strokeBorder(LF.Palette.blue.opacity(0.3), lineWidth: LF.Metrics.stroke)
                .padding(-3)
                .rotationEffect(.degrees(reduceMotion ? 0 : 1.6))
        }
        .rotationEffect(.degrees(reduceMotion ? 0 : -4.5))
        .scaleEffect(resting ? 1 : SiteTokens.Movement.inkScale)
        .offset(y: resting ? 0 : SiteTokens.Movement.inkDrop)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilityAddTraits(.isImage)
        .sensoryFeedback(.impact(weight: .heavy, intensity: 0.9), trigger: landed) { _, new in new }
        .onAppear {
            guard lands, !landed else { return }
            if reduceMotion {
                landed = true
            } else {
                withAnimation(LF.Motion.stamp) { landed = true }
            }
        }
    }

    private var accessibilityText: String {
        ["Stamped: LearnFRC", title, caption, footnote].compactMap { $0 }.joined(separator: ", ")
    }

    private var stampRule: some View {
        Rectangle()
            .fill(LF.Palette.blue.opacity(0.45))
            .frame(height: 1)
            .frame(maxWidth: .infinity)
    }

    private func line(_ text: String, size: CGFloat, weight: Font.Weight, tracking: CGFloat) -> some View {
        Text(text)
            .font(LF.Fonts.mono(size, weight: weight, relativeTo: size > 14 ? .callout : .caption2))
            .tracking(size * tracking)
            .foregroundStyle(LF.Palette.blue)
            .lineLimit(1)
    }
}

/// The same box before anyone stamped it: dashed graphite, a little crooked, carrying the
/// figure that's still missing. The difference from `StampView` is the stroke, not the colour.
struct PendingStampView: View {
    let percent: Int
    var caption: String

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(percent: Int, caption: String = "not signed off") {
        self.percent = percent
        self.caption = caption
    }

    var body: some View {
        VStack(spacing: 6) {
            Text("LEARNFRC")
                .font(LF.Fonts.mono(11.5, weight: .bold, relativeTo: .caption2))
                .tracking(11.5 * 0.22)
                .foregroundStyle(LF.Palette.graphite)
            Rectangle().fill(LF.Palette.rule).frame(height: 1).frame(maxWidth: .infinity)
            HStack(alignment: .firstTextBaseline, spacing: 1) {
                Text("\(min(max(percent, 0), 100))")
                    .font(LF.Fonts.mono(30, weight: .bold, relativeTo: .title))
                Text("%")
                    .font(LF.Fonts.mono(16, weight: .bold, relativeTo: .callout))
            }
            .monospacedDigit()
            .foregroundStyle(LF.Palette.ink)
            .padding(.top, 2)
            Text(caption)
                .font(LF.Fonts.mono(11, relativeTo: .caption2))
                .tracking(11 * 0.12)
                .foregroundStyle(LF.Palette.graphite)
        }
        .fixedSize()
        .padding(.horizontal, 18.4)
        .padding(.vertical, 14.4)
        .overlay {
            HandShape(.s).strokeBorder(LF.Palette.graphite, style: StrokeStyle(lineWidth: LF.Metrics.stroke, dash: [5, 4]))
        }
        .rotationEffect(.degrees(reduceMotion ? 0 : -2.4))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Not signed off yet, \(percent) percent done")
    }
}

#Preview("Stamps", traits: .fixedLayout(width: 393, height: 320)) {
    @Previewable @State var key = 0
    VStack(spacing: 36) {
        HStack(spacing: 32) {
            StampView("Completed", caption: "lesson / pid-basics", footnote: "+25 XP").id(key)
            PendingStampView(percent: 64)
        }
        Button("Stamp again") { key += 1 }.buttonStyle(.inkGhostSmall)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .paperBackground()
}
