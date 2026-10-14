import SwiftUI

/// Progress through a department, a lesson or the week (`nb-meter`): an ink trough with a blue
/// fill. The figure is always printed with it, never the bar alone.
///
///     MeterView(value: 0.42, label: "progress")              // "progress ........ 42%"
///     MeterView(value: 3 / 5, label: "this week", valueText: "3/5")
///     MeterView(value: done / total)                         // bar with the % beside it
///
/// The bar only animates when the value changes while on screen (520ms, the pen-stroke curve),
/// never on appear, and not at all under Reduce Motion.
struct MeterView: View {
    enum Style: Sendable, Hashable {
        /// 12.8pt trough, the default.
        case regular
        /// 8.8pt trough, for dense lists and cards.
        case slim
    }

    let value: Double
    var label: String?
    var valueText: String?
    var style: Style

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .caption) private var regularHeight: CGFloat = 12.8
    @ScaledMetric(relativeTo: .caption) private var slimHeight: CGFloat = 8.8

    init(value: Double, label: String? = nil, valueText: String? = nil, style: Style = .regular) {
        self.value = value
        self.label = label
        self.valueText = valueText
        self.style = style
    }

    private var fraction: Double { value.isFinite ? min(max(value, 0), 1) : 0 }
    private var percentText: String { "\(Int((fraction * 100).rounded()))%" }
    private var figure: String { valueText ?? percentText }

    var body: some View {
        Group {
            if let label {
                VStack(alignment: .leading, spacing: 7) {
                    // The figure sits at the end of the label's line while both fit whole, and
                    // under the label when they don't (the largest sizes), so neither breaks.
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .firstTextBaseline) {
                            SlugText(label)
                                .fixedSize()
                            Spacer(minLength: 8)
                            figureText
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            SlugText(label)
                            figureText
                        }
                    }
                    bar
                }
            } else {
                HStack(spacing: 10) {
                    bar
                    figureText
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? "Progress")
        .accessibilityValue(valueText.map { "\($0), \(percentText)" } ?? percentText)
    }

    private var figureText: some View {
        Text(figure)
            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
            .monospacedDigit()
            .foregroundStyle(LF.Palette.ink)
            .fixedSize()
    }

    private var bar: some View {
        let height = style == .regular ? regularHeight : slimHeight
        return GeometryReader { proxy in
            Rectangle()
                .fill(LF.Palette.blue)
                .frame(width: proxy.size.width * fraction)
                .frame(maxWidth: .infinity, alignment: .leading)
                .animation(reduceMotion ? nil : LF.Motion.draw, value: fraction)
        }
        .frame(height: height)
        .background(LF.Palette.paper)
        .clipShape(HandShape(.s))
        .overlay {
            HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
        }
    }
}

#Preview("Meters", traits: .fixedLayout(width: 393, height: 260)) {
    @Previewable @State var v = 0.42
    VStack(alignment: .leading, spacing: 22) {
        MeterView(value: v, label: "progress")
        MeterView(value: 3.0 / 5.0, label: "this week", valueText: "3/5")
        MeterView(value: 0.8, style: .slim)
        Button("Add a lesson") { v = min(1, v + 0.1) }.buttonStyle(.inkGhostSmall)
    }
    .padding(LF.Metrics.gutter)
    .frame(maxHeight: .infinity, alignment: .top)
    .paperBackground()
}
