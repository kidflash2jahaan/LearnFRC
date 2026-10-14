import SwiftUI
import WidgetKit

// The notebook pieces the widgets are built from. Each one reads `notebookStyle` so it draws
// correctly in full colour, accented (tinted / clear Home Screen) and vibrant (Lock Screen,
// inactive Mac desktop) modes.

// MARK: - Ground

/// The page ground: paper ruled with the 23pt graph grid in faint ballpoint blue. Used as the
/// widget's container background, so the system removes it in accented and vibrant modes.
struct PaperGround: View {
    var body: some View {
        ZStack {
            WidgetLF.Palette.paper
            GridRuling().fill(WidgetLF.Palette.grid)
        }
        .accessibilityHidden(true)
    }
}

/// A torn strip of kraft tape. Decoration only, so it's absent outside full colour.
struct TapePiece: View {
    var angle: Double = WidgetLF.Tilt.tape
    var width: CGFloat = 64
    var height: CGFloat = 18

    @Environment(\.notebookStyle) private var style
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if style.decorates {
            WidgetTapeShape()
                .fill(WidgetLF.Palette.kraft)
                .opacity(WidgetLF.Metrics.tapeOpacity)
                .frame(width: width, height: height)
                .rotationEffect(.degrees(reduceMotion ? 0 : angle))
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }
}

// MARK: - Links

extension EnvironmentValues {
    /// False in the preview mock frames, which aren't real widgets (a `Link` only draws as a
    /// placeholder outside WidgetKit).
    @Entry var widgetUsesLinks = true
}

/// A separately tappable region of a medium or larger widget.
struct WidgetLink<Label: View>: View {
    let destination: URL
    @ViewBuilder var label: Label

    @Environment(\.widgetUsesLinks) private var usesLinks

    var body: some View {
        if usesLinks {
            Link(destination: destination) { label }
        } else {
            label
        }
    }
}

// MARK: - Text

/// The mono kicker struck by a short blue pen stroke (`nb-marker`): "—— up next".
struct MarkerLabel: View {
    let text: String
    var size: CGFloat = 11

    @Environment(\.notebookStyle) private var style
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(_ text: String, size: CGFloat = 11) {
        self.text = text
        self.size = size
    }

    var body: some View {
        HStack(spacing: size * 0.65) {
            Rectangle()
                .fill(style.blue)
                .frame(width: size * 1.9, height: 2)
                .rotationEffect(.degrees(reduceMotion ? 0 : -1))
                .widgetAccentable()
                .accessibilityHidden(true)
            Text(text)
                .font(WidgetFonts.mono(size, relativeTo: .caption2))
                .tracking(size * 0.05)
                .foregroundStyle(style.graphite)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }
}

/// The week's window ("this week", "your first week") as a marker, or as a plain slug that may
/// wrap when the pen stroke doesn't fit (narrow columns, large text).
struct WeekLabel: View {
    let text: String
    var size: CGFloat = 11

    init(_ text: String, size: CGFloat = 11) {
        self.text = text
        self.size = size
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            MarkerLabel(text, size: size)
                .fixedSize()
            SlugLabel(text, size: size - 0.5)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A small Space Mono label (`nb-slug`) for numbers and identifiers.
struct SlugLabel: View {
    let text: String
    var size: CGFloat
    var bold: Bool
    var color: Color?

    @Environment(\.notebookStyle) private var style

    init(_ text: String, size: CGFloat = 10.5, bold: Bool = false, color: Color? = nil) {
        self.text = text
        self.size = size
        self.bold = bold
        self.color = color
    }

    var body: some View {
        Text(text)
            .font(WidgetFonts.mono(size, bold: bold, relativeTo: .caption2))
            .tracking(size * 0.02)
            .monospacedDigit()
            .foregroundStyle(color ?? style.graphite)
    }
}

/// The blue Caveat margin note (`nb-pen`), set slightly crooked.
struct PenNote: View {
    let text: String
    var size: CGFloat

    @Environment(\.notebookStyle) private var style
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(_ text: String, size: CGFloat = 18) {
        self.text = text
        self.size = size
    }

    var body: some View {
        Text(text)
            .font(WidgetFonts.note(size))
            .foregroundStyle(style.blue)
            .rotationEffect(.degrees(reduceMotion ? 0 : -1.2), anchor: .leading)
            .widgetAccentable()
    }
}

/// The LearnFRC logotype: "learn" in ink, "FRC" in blue inside a hand-drawn box, crooked.
struct WidgetWordmark: View {
    var size: CGFloat = 16

    @Environment(\.notebookStyle) private var style
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: size * 0.26) {
            Text("learn")
                .foregroundStyle(style.ink)
            Text("FRC")
                .foregroundStyle(style.blue)
                .padding(.top, size * 0.05)
                .padding(.bottom, size * 0.12)
                .padding(.horizontal, size * 0.32)
                .overlay {
                    WidgetHandShape(.s).strokeBorder(style.blue, lineWidth: WidgetLF.Metrics.stroke)
                }
                .rotationEffect(.degrees(reduceMotion ? 0 : WidgetLF.Tilt.brand))
                .widgetAccentable()
        }
        .font(WidgetFonts.display(size, relativeTo: .headline))
        .tracking(size * -0.04)
        .lineLimit(1)
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("LearnFRC")
    }
}

// MARK: - Chips and buttons

/// A small mono chip (`nb-tag`). `on` fills it blue: "week cleared".
struct InkTag: View {
    let text: String
    var on: Bool

    @Environment(\.notebookStyle) private var style

    init(_ text: String, on: Bool = false) {
        self.text = text
        self.on = on
    }

    var body: some View {
        let filled = on && style.isFullColor
        Text(text)
            .font(WidgetFonts.mono(10.5, bold: on, relativeTo: .caption2))
            .tracking(10.5 * 0.03)
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(filled ? style.onBlue : style.ink)
            .padding(.vertical, 3.5)
            .padding(.horizontal, 8)
            .background {
                ZStack {
                    WidgetHandShape(.s).fill(filled ? style.blueFill : (style.isFullColor ? style.card : .clear))
                    WidgetHandShape(.s).strokeBorder(on ? style.blueFill : style.border, lineWidth: WidgetLF.Metrics.stroke)
                }
            }
            .widgetAccentable(on)
    }
}

/// The primary button's face (`nb-btn`): blue fill, Space Mono 700, a full ink drop. It isn't
/// a control (a widget opens the app wherever it's tapped); it says where the tap goes.
struct InkButtonFace: View {
    let title: String?
    var systemImage: String = "arrow.right"
    var size: CGFloat = 12.5

    @Environment(\.notebookStyle) private var style

    var body: some View {
        HStack(spacing: size * 0.45) {
            if let title {
                Text(title)
                    .font(WidgetFonts.mono(size, bold: true, relativeTo: .footnote))
                    .lineLimit(1)
                    .fixedSize()
            }
            Image(systemName: systemImage)
                .font(.system(size: size * 0.95, weight: .bold))
                .accessibilityHidden(true)
        }
        .foregroundStyle(style.isFullColor ? style.onBlue : style.ink)
        .padding(.horizontal, title == nil ? size * 0.8 : size * 0.95)
        .padding(.vertical, size * 0.55)
        .background {
            ZStack {
                if let drop = style.inkDrop {
                    WidgetHandShape(.s).fill(drop).offset(x: 3, y: 3)
                }
                if style.isFullColor {
                    WidgetHandShape(.s).fill(style.blueFill)
                }
                WidgetHandShape(.s).strokeBorder(style.isFullColor ? style.blueFill : style.ink, lineWidth: WidgetLF.Metrics.stroke)
            }
        }
        .padding(.trailing, style.inkDrop == nil ? 0 : 3)
        .padding(.bottom, style.inkDrop == nil ? 0 : 3)
        .widgetAccentable()
        .accessibilityHidden(true)
    }
}

/// A small static blue check: success is a mark plus words, never a green colour.
struct PenCheckMark: View {
    var size: CGFloat = 16

    @Environment(\.notebookStyle) private var style

    var body: some View {
        WidgetPenCheckShape()
            .stroke(style.blue, style: StrokeStyle(lineWidth: max(2, size * 0.15), lineCap: .round, lineJoin: .round))
            .frame(width: size * 1.33, height: size)
            .widgetAccentable()
            .accessibilityHidden(true)
    }
}

// MARK: - The card

/// The site's index card (`nb-box`): card stock, a 2pt ink border at the hand radius, the inner
/// hairline at another radius, a hard offset drop, an optional strip of tape, slightly tilted.
/// Outside full colour it's just the drawn outline over a faint wash.
struct NotebookCardBox<Content: View>: View {
    var tilt: Double = WidgetLF.Tilt.card
    var tape: Bool = true
    var padding = EdgeInsets(top: 11, leading: 13, bottom: 11, trailing: 13)
    @ViewBuilder var content: Content

    @Environment(\.notebookStyle) private var style
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background {
                ZStack {
                    if let drop = style.cardDrop {
                        WidgetHandShape(.a).fill(drop).offset(x: 2, y: 3)
                    }
                    WidgetHandShape(.a).fill(style.card)
                    if style.isFullColor {
                        WidgetHandShape(.b)
                            .inset(by: WidgetLF.Metrics.stroke + 3)
                            .strokeBorder(style.rule, lineWidth: WidgetLF.Metrics.hairline)
                    }
                    WidgetHandShape(.a).strokeBorder(style.border, lineWidth: WidgetLF.Metrics.stroke)
                }
                .accessibilityHidden(true)
            }
            .overlay(alignment: .topLeading) {
                if tape {
                    TapePiece(angle: tilt > 0 ? -3.4 : 2.6)
                        .offset(x: 22, y: -10)
                }
            }
            .rotationEffect(.degrees(reduceMotion ? 0 : tilt))
    }
}

// MARK: - The week

/// The week's count written as on paper (`WeekRing` on the site): the blue figure, the goal
/// in graphite. The site moved off circular dials; a five-unit total is a figure.
struct WeekFigure: View {
    let status: WeekStatus
    var size: CGFloat = 40

    @Environment(\.notebookStyle) private var style

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("\(status.filled)")
                .foregroundStyle(style.blue)
                .widgetAccentable()
            Text("/\(status.goal)")
                .foregroundStyle(style.graphite)
        }
        .font(WidgetFonts.mono(size, bold: true, relativeTo: .largeTitle))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        // Space Mono's line box is tall (ascent 1.12em, descent 0.36em); digits sit in 0.7em.
        .padding(.top, -size * 0.34)
        .padding(.bottom, -size * 0.22)
        .accessibilityHidden(true)
    }
}

/// The ink trough with its blue fill (`nb-meter`). The figure is always printed beside it.
struct WeekMeter: View {
    let fraction: Double
    var height: CGFloat = 11

    @Environment(\.notebookStyle) private var style

    var body: some View {
        let value = fraction.isFinite ? min(max(fraction, 0), 1) : 0
        GeometryReader { proxy in
            Rectangle()
                .fill(style.blueFill)
                .frame(width: proxy.size.width * value)
                .widgetAccentable()
        }
        .frame(height: height)
        .background(style.trough)
        .clipShape(WidgetHandShape(.s))
        .overlay {
            WidgetHandShape(.s).strokeBorder(style.border, lineWidth: WidgetLF.Metrics.stroke)
        }
        .accessibilityHidden(true)
    }
}

/// Seven days ruled off like the attendance row of a shop log (the site's `DayStrip`).
/// A studied day is filled blue, with its count when more than one landed. An empty day looks
/// the same as one that hasn't happened, because it is the same: nothing scores a gap.
/// Today is marked twice, never by colour alone: the bold letter and the pen stroke under it.
struct DayStripView: View {
    let days: [WidgetSnapshot.Day]
    var cellHeight: CGFloat = 26
    var spacing: CGFloat = 5
    var showsLetters: Bool = true

    var body: some View {
        HStack(alignment: .bottom, spacing: spacing) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                DayColumn(day: day, cellHeight: cellHeight, showsLetter: showsLetters)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Lessons each day")
        .accessibilityValue(days.map(\.spoken).joined(separator: "; "))
    }
}

private struct DayColumn: View {
    let day: WidgetSnapshot.Day
    let cellHeight: CGFloat
    let showsLetter: Bool

    @Environment(\.notebookStyle) private var style

    var body: some View {
        VStack(spacing: 3) {
            if showsLetter {
                Text(String(day.label.prefix(1)))
                    .font(WidgetFonts.mono(10, bold: day.isToday, relativeTo: .caption2))
                    .foregroundStyle(day.isToday ? style.ink : style.graphite)
                    .lineLimit(1)
            }
            DayCell(day: day)
                .frame(height: cellHeight)
                .frame(maxWidth: .infinity)
            Rectangle()
                .fill(day.isToday ? style.blue : .clear)
                .frame(height: 3)
                .widgetAccentable()
        }
    }
}

private struct DayCell: View {
    let day: WidgetSnapshot.Day

    @Environment(\.notebookStyle) private var style

    private var countText: some View {
        Text("\(day.count)")
            .font(WidgetFonts.mono(11, bold: true, relativeTo: .caption2))
            .monospacedDigit()
            .minimumScaleFactor(0.6)
    }

    var body: some View {
        let shape = WidgetHandShape(.s)
        if day.count > 0 {
            if style.isFullColor {
                shape.fill(style.blueFill)
                    .overlay {
                        if day.count > 1 { countText.foregroundStyle(style.onBlue) }
                    }
            } else {
                // One flat tint here, so the figure is cut out of the fill rather than drawn on it.
                shape.fill(Color.primary)
                    .mask {
                        ZStack {
                            Rectangle()
                            if day.count > 1 { countText.blendMode(.destinationOut) }
                        }
                        .compositingGroup()
                    }
                    .widgetAccentable()
            }
        } else if day.isFuture {
            shape.strokeBorder(style.rule, style: StrokeStyle(lineWidth: WidgetLF.Metrics.stroke, dash: [4, 3]))
        } else {
            shape.strokeBorder(style.rule, lineWidth: WidgetLF.Metrics.stroke)
        }
    }
}
