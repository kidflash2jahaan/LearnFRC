import SwiftUI

// The pieces every calculator is built from, in the notebook system: the marked h1, the
// number field with its keypad, chips, menus and checkboxes for the site's selects, the
// blue verdict band, the ruled definition list, the working table and the folded "back of
// the sheet". Everything is prefixed `Tool` so it can't collide with another feature.

// MARK: - The marked heading

/// The site's `nb-mark`: a thick ballpoint stroke under one word of an h1.
struct ToolMarkAttribute: TextAttribute {}

/// Draws a 0.11em blue bar under every run carrying `ToolMarkAttribute`, under the text.
struct ToolMarkRenderer: TextRenderer {
    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
        for line in layout {
            for run in line where run[ToolMarkAttribute.self] != nil {
                let bounds = run.typographicBounds
                let em = (bounds.ascent + bounds.descent) / 1.2
                let thickness = max(2, em * 0.11)
                let bottom = bounds.origin.y + bounds.descent + em * 0.06
                let bar = CGRect(x: bounds.origin.x, y: bottom - thickness, width: bounds.width, height: thickness)
                context.fill(Path(bar), with: .color(LF.Palette.blue))
            }
            context.draw(line)
        }
    }
}

/// An h1 with one word marked, like every tool page's question: "What will the season
/// <mark>actually</mark> cost?". Never breaks inside a word at the largest text sizes.
struct ToolMarkedTitle: View {
    let before: String
    let mark: String
    let after: String
    var level: LF.TitleLevel = .h1

    private var plain: String { before + mark + after }

    private func text(_ string: String) -> Text {
        guard string == plain else { return Text(verbatim: string) }
        let marked = Text(verbatim: mark).customAttribute(ToolMarkAttribute())
        return Text("\(Text(verbatim: before))\(marked)\(Text(verbatim: after))")
    }

    var body: some View {
        LearnWholeWords(text: plain) { string in
            text(string)
                .lfTitle(level)
                .textRenderer(ToolMarkRenderer())
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(plain)
        .accessibilityAddTraits(.isHeader)
    }
}

/// The top of every calculator: `tools / <slug>`, the question, the lede, the sourcing
/// line in mono, and the blue margin note.
struct ToolHeader: View {
    let slug: String
    let before: String
    let mark: String
    let after: String
    let lede: String
    let note: String
    let pen: String
    let layout: LearnLayout

    var body: some View {
        let text = VStack(alignment: .leading, spacing: 0) {
            SectionLabel("tools / \(slug)")
            ToolMarkedTitle(before: before, mark: mark, after: after)
                .frame(maxWidth: 640, alignment: .leading)
                .padding(.top, 14)
            LearnLede(lede)
                .padding(.top, 16)
            SlugText(note)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
        }
        if layout.isRegular {
            HStack(alignment: .bottom, spacing: 32) {
                text.frame(maxWidth: .infinity, alignment: .leading)
                MarkerText(pen, angle: 1.4)
                    .multilineTextAlignment(.trailing)
                    .padding(.trailing, 4)
                    .frame(maxWidth: 200, alignment: .trailing)
            }
        } else {
            VStack(alignment: .leading, spacing: 16) {
                text
                MarkerText(pen, angle: 1.4)
                    .padding(.trailing, 4)
            }
        }
    }
}

// MARK: - Layout

/// Lays children out in rows and wraps them, like the site's `flex flex-wrap`. A child too
/// wide for a line of its own is offered the line's width and wraps inside it.
struct ToolFlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let width = rows.map(\.width).max() ?? 0
        let height = rows.reduce(0) { $0 + $1.height } + CGFloat(max(0, rows.count - 1)) * lineSpacing
        return CGSize(width: proposal.width.map { min($0, width) } ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for (index, size) in row.items {
                subviews[index].place(at: CGPoint(x: x, y: y + (row.height - size.height) / 2),
                                      proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private struct Row {
        var items: [(index: Int, size: CGSize)] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width maxWidth: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for index in subviews.indices {
            var size = subviews[index].sizeThatFits(.unspecified)
            if size.width > maxWidth {
                let wrapped = subviews[index].sizeThatFits(ProposedViewSize(width: maxWidth, height: nil))
                size = CGSize(width: min(wrapped.width, maxWidth), height: wrapped.height)
            }
            let needed = current.items.isEmpty ? size.width : current.width + spacing + size.width
            if needed > maxWidth, !current.items.isEmpty {
                rows.append(current)
                current = Row()
            }
            current.width = current.items.isEmpty ? size.width : current.width + spacing + size.width
            current.height = max(current.height, size.height)
            current.items.append((index, size))
        }
        if !current.items.isEmpty { rows.append(current) }
        return rows
    }
}

/// Two columns from regular width (iPad, Mac), one on a phone.
struct ToolColumns<Leading: View, Trailing: View>: View {
    let layout: LearnLayout
    var spacing: CGFloat = 28
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing

    var body: some View {
        if layout.isRegular {
            HStack(alignment: .top, spacing: spacing) {
                VStack(alignment: .leading, spacing: 0) { leading }
                    .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 0) { trailing }
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            VStack(alignment: .leading, spacing: spacing) {
                leading
                trailing
            }
        }
    }
}

/// Fields two-up from regular width, stacked on a phone and at the accessibility sizes.
struct ToolFieldGrid<Content: View>: View {
    let layout: LearnLayout
    var columns: Int = 2
    @ViewBuilder var content: Content

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let count = layout.isRegular && !dynamicTypeSize.isAccessibilitySize ? columns : 1
        if count > 1 {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 18, alignment: .top), count: count),
                      alignment: .leading, spacing: 20) {
                content
            }
        } else {
            VStack(alignment: .leading, spacing: 20) { content }
        }
    }
}

// MARK: - Focus and the keypad

/// The bar above the number pad: previous and next field, the live result, and Done (the pad
/// has no return key). The result rides on this bar while typing, so nothing floats over the
/// field being edited. Only while one of `order` is focused; nothing on the Mac, where Tab
/// and Return move between fields.
struct ToolKeyboardBar: ViewModifier {
    let focus: FocusState<String?>.Binding
    let order: [String]
    /// The headline figures in a few characters: "1.04 g · 46.1°".
    var summary: String?

    func body(content: Content) -> some View {
        #if os(iOS)
        content.toolbar {
            if let current = focus.wrappedValue, let index = order.firstIndex(of: current) {
                ToolbarItemGroup(placement: .keyboard) {
                    Button {
                        focus.wrappedValue = order[index - 1]
                    } label: {
                        Label("Previous field", systemImage: "chevron.up")
                    }
                    .disabled(index == 0)
                    Button {
                        focus.wrappedValue = order[index + 1]
                    } label: {
                        Label("Next field", systemImage: "chevron.down")
                    }
                    .disabled(index >= order.count - 1)
                    Spacer()
                    if let summary, !summary.isEmpty {
                        Text(summary)
                            .font(LF.Fonts.mono(14, weight: .bold, relativeTo: .footnote))
                            .monospacedDigit()
                            .foregroundStyle(LF.Palette.blue)
                            .lineLimit(1)
                            .fixedSize()
                            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                            .accessibilityLabel("Result: \(summary)")
                        Spacer()
                    }
                    Button("Done") { focus.wrappedValue = nil }
                        .fontWeight(.semibold)
                }
            }
        }
        #else
        content
        #endif
    }
}

/// Which keypad a number field gets.
enum ToolKeypad: Sendable {
    /// Digits and the decimal point.
    case decimal
    /// Digits only, for counts.
    case integer
}

/// A labelled number field (`nb-field` with `nb-input type=number`): label above, the
/// keypad for numbers, the hint below. Text is kept with a "." decimal point, the way the
/// site reads it; a person whose region writes "1,5" sees and types a comma.
///
/// With `step`, a − and a + sit beside it for counts you nudge in the pit (and VoiceOver can
/// swipe up and down to change it).
struct ToolNumberField: View {
    let label: String
    @Binding var text: String
    let field: String
    let focus: FocusState<String?>.Binding
    var hint: String?
    var prompt: String?
    var keypad: ToolKeypad = .decimal
    var step: Double?
    var minimum: Double = 0
    /// False when the label is printed once above a pair of fields (VoiceOver still reads it).
    var showsLabel = true
    /// A unit printed inside the box before the number, like the site's "$".
    var prefix: String?
    var next: () -> Void = {}

    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var scaledStepSide: CGFloat = 44
    /// The − and + boxes grow with the text, but only to 64pt.
    private var stepSide: CGFloat { min(scaledStepSide, 64) }
    /// The ink box's vertical padding (`inkField`), which the tap bands cover.
    @ScaledMetric(relativeTo: .body) private var boxPadding: CGFloat = 10

    private var separator: String { Locale.current.decimalSeparator ?? "." }

    /// The text as shown and typed, with the region's decimal separator.
    private var shown: Binding<String> {
        let separator = separator
        guard separator != "." else { return $text }
        return Binding(get: { text.replacingOccurrences(of: ".", with: separator) },
                       set: { text = $0.replacingOccurrences(of: separator, with: ".") })
    }

    private var isFocused: Bool { focus.wrappedValue == field }

    var body: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            if showsLabel {
                FieldLabel(label)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityHidden(true)
            }
            if let step, dynamicTypeSize.isAccessibilitySize {
                // At the largest sizes the number keeps the row and the buttons go under it.
                input
                HStack(spacing: 8) {
                    stepButton("minus", label: "Decrease \(label)") { nudge(-step) }
                    stepButton("plus", label: "Increase \(label)") { nudge(step) }
                }
            } else {
                HStack(spacing: 8) {
                    input
                    if let step {
                        stepButton("minus", label: "Decrease \(label)") { nudge(-step) }
                        stepButton("plus", label: "Increase \(label)") { nudge(step) }
                    }
                }
            }
            if let hint {
                FieldHint(hint)
                    .accessibilityHidden(true)
            }
        }
        .id(ToolFocusScroll.anchor(field))
    }

    private var input: some View {
        HStack(spacing: 6) {
            if let prefix {
                Text(prefix)
                    .font(LF.Fonts.mono(15, weight: .bold, relativeTo: .body))
                    .foregroundStyle(LF.Palette.ink)
                    .accessibilityHidden(true)
            }
            TextField(label, text: shown, prompt: Text(verbatim: prompt ?? "").foregroundStyle(LF.Palette.graphite))
                .focused(focus, equals: field)
                #if os(iOS)
                .keyboardType(keypad == .integer ? .numberPad : .decimalPad)
                #endif
                .autocorrectionDisabled()
                .onSubmit(next)
                .accessibilityHint(hint ?? "")
                .modifier(ToolAdjustable(step: step) { nudge($0) })
        }
        .inkField(focused: isFocused)
        .monospacedDigit()
        .overlay { paddingTargets }
    }

    /// The box's padding is drawn around the text view, not part of it, so a tap there would
    /// go nowhere; these bands focus the field (the text view keeps its own touches).
    private var paddingTargets: some View {
        VStack(spacing: 0) {
            band
            Spacer(minLength: 0)
            band
        }
    }

    private var band: some View {
        Color.clear
            .frame(height: boxPadding)
            .contentShape(Rectangle())
            .onTapGesture { focus.wrappedValue = field }
            .accessibilityHidden(true)
    }

    private func stepButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.body.weight(.bold))
                .foregroundStyle(isEnabled ? LF.Palette.ink : LF.Palette.graphite)
                .frame(width: stepSide, height: stepSide)
                .background {
                    ZStack {
                        HandShape(.s).fill(LF.Palette.card)
                        HandShape(.s).strokeBorder(isEnabled ? LF.Palette.ink : LF.Palette.rule, lineWidth: LF.Metrics.stroke)
                    }
                }
                .contentShape(HandShape(.s))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        // The field itself is adjustable for VoiceOver; these are for touch.
        .accessibilityHidden(true)
    }

    private func nudge(_ delta: Double) {
        let current = JS.parseFloat(text)
        let base = current.isFinite ? current : 0
        text = JS.string(JS.max(minimum, base + delta))
    }
}

/// Swipe up and down on a stepped field with VoiceOver to change it.
private struct ToolAdjustable: ViewModifier {
    let step: Double?
    let nudge: (Double) -> Void

    func body(content: Content) -> some View {
        if let step {
            content.accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: nudge(step)
                case .decrement: nudge(-step)
                @unknown default: break
                }
            }
        } else {
            content
        }
    }
}

// MARK: - Choices

/// A picked-one-of-these row of chips (the site's `nb-tag` with `aria-pressed`): the chosen
/// chip fills blue, so the state survives greyscale. Wraps onto new lines. At the
/// accessibility sizes the whole group steps down together to the largest size at which its
/// longest chip still fits a line, so the chips stay one size and none is cut short.
struct ToolChips<Value: Hashable>: View {
    let label: String
    let options: [(value: Value, title: String)]
    let selected: Value?
    let select: (Value) -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var steps: [DynamicTypeSize] {
        [.accessibility5, .accessibility4, .accessibility3, .accessibility2, .accessibility1, .xxxLarge, .xxLarge, .large]
            .filter { $0 <= dynamicTypeSize }
    }

    private var longest: String { options.map(\.title).max { $0.count < $1.count } ?? "" }

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                ViewThatFits(in: .horizontal) {
                    ForEach(steps, id: \.self) { size in
                        ToolIdealWidth {
                            TagView(longest).fixedSize().hidden().accessibilityHidden(true)
                            chips
                        }
                        .dynamicTypeSize(...size)
                    }
                    chips.dynamicTypeSize(...DynamicTypeSize.large)
                }
            } else {
                chips
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
        .sensoryFeedback(.selection, trigger: selected)
    }

    private var chips: some View {
        ToolFlowLayout(spacing: 8, lineSpacing: 2) {
            ForEach(options.indices, id: \.self) { index in
                let option = options[index]
                let isOn = option.value == selected
                Button {
                    select(option.value)
                } label: {
                    TagView(option.title, on: isOn)
                }
                .buttonStyle(ToolChipPressStyle())
                .accessibilityLabel(option.title)
                .accessibilityAddTraits(isOn ? [.isSelected] : [])
            }
        }
    }
}

/// Reports its first subview's width as its ideal width (a hidden probe) and otherwise is its
/// second subview, so a `ViewThatFits` can judge a wrapping group by one item in it.
private struct ToolIdealWidth: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard subviews.count == 2 else { return .zero }
        guard proposal.width == nil else { return subviews[1].sizeThatFits(proposal) }
        let probe = subviews[0].sizeThatFits(.unspecified).width
        let content = subviews[1].sizeThatFits(ProposedViewSize(width: probe, height: proposal.height))
        return CGSize(width: probe, height: content.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard subviews.count == 2 else { return }
        subviews[0].place(at: bounds.origin, anchor: .topLeading, proposal: .zero)
        subviews[1].place(at: bounds.origin, anchor: .topLeading, proposal: ProposedViewSize(bounds.size))
    }
}

private struct ToolChipPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        ToolChipPress(configuration: configuration)
    }
}

private struct ToolChipPress: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .frame(minHeight: LF.Metrics.tap)
            .contentShape(Rectangle())
            .animation(reduceMotion ? nil : (configuration.isPressed ? LF.Motion.press : LF.Motion.hover), value: configuration.isPressed)
    }
}

/// A labelled select (the site's `nb-select`) as a menu in the ink box, with the hint below.
struct ToolMenuPicker<Value: Hashable>: View {
    let label: String
    let options: [(value: Value, title: String)]
    @Binding var selection: Value
    var hint: String?
    /// False for a unit menu set beside its field, which the field's label already names.
    var showsLabel = true

    private var title: String { options.first { $0.value == selection }?.title ?? "" }

    var body: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            if showsLabel {
                FieldLabel(label)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityHidden(true)
            }
            Menu {
                Picker(label, selection: $selection) {
                    ForEach(options.indices, id: \.self) { index in
                        Text(options[index].title).tag(options[index].value)
                    }
                }
                .pickerStyle(.inline)
            } label: {
                HStack(alignment: .firstTextBaseline) {
                    // Never broken inside a word ("Trapezoi / dal") at the largest sizes.
                    LearnWholeWords(text: title) { string in
                        Text(string)
                            .font(LF.Fonts.body(17))
                            .foregroundStyle(LF.Palette.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(LF.Palette.ink)
                        .accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .inkField()
                .contentShape(HandShape(.s))
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            .accessibilityLabel(label)
            .accessibilityValue(title)
            .accessibilityHint(hint ?? "")
            if let hint {
                FieldHint(hint)
                    .accessibilityHidden(true)
            }
        }
    }
}

/// A drawn checkbox with the whole sentence as the target (`<label>` around box and text).
struct ToolCheckboxStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                ToolCheckBox(isOn: configuration.isOn)
                    .padding(.top, 1)
                configuration.label
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minHeight: LF.Metrics.tap, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityRepresentation {
            Toggle(isOn: configuration.$isOn) { configuration.label }
        }
        .sensoryFeedback(.selection, trigger: configuration.isOn)
    }
}

private struct ToolCheckBox: View {
    var isOn: Bool
    @ScaledMetric(relativeTo: .body) private var side: CGFloat = 22

    var body: some View {
        ZStack {
            HandShape(.s).fill(LF.Palette.card)
            HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
            if isOn {
                PenCheckMark(size: side * 0.52)
            }
        }
        .frame(width: side, height: side)
        .accessibilityHidden(true)
    }
}

/// A checkbox row: the sentence, and a quiet line under it.
struct ToolCheckbox: View {
    let title: String
    var detail: String?
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 3) {
                LearnWholeWords(text: title) { string in
                    Text(string)
                        .font(LF.Fonts.body(16, weight: .semibold))
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let detail {
                    FieldHint(detail)
                }
            }
        }
        .toggleStyle(ToolCheckboxStyle())
    }
}

/// "lengths in  in  mm": a mono caption and the site's `nb-tab` pair.
struct ToolUnitSwitch<Value: Hashable>: View {
    let caption: String
    let options: [(value: Value, title: String)]
    let selected: Value
    let select: (Value) -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            if !caption.isEmpty {
                SlugText(caption, color: LF.Palette.ink)
                    .fixedSize()
            }
            InkTabStrip(selection: Binding(get: { selected }, set: { select($0) }),
                        tabs: options.map { (value: $0.value, title: $0.title) })
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(caption)
    }
}

/// The folded section the site opens with "show": a full-width row with the mono label,
/// the sentence, and show or hide.
struct ToolDisclosure<Content: View>: View {
    let label: String
    @Binding var isOpen: Bool
    @ViewBuilder var content: Content

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                LF.Motion.perform(LF.Motion.settle) { isOpen.toggle() }
            } label: {
                let toggle = SlugText(isOpen ? "hide" : "show", color: LF.Palette.ink)
                    .accessibilityHidden(true)
                Group {
                    if dynamicTypeSize.isAccessibilitySize {
                        VStack(alignment: .leading, spacing: 6) {
                            LearnWholeWordSlug(text: label, color: LF.Palette.ink)
                            toggle
                        }
                    } else {
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            LearnWholeWordSlug(text: label, color: LF.Palette.ink)
                            Spacer(minLength: 8)
                            toggle
                        }
                    }
                }
                .padding(.bottom, 6)
                .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: .leading)
                .overlay(alignment: .bottom) { InkRule() }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            if isOpen {
                content
                    .padding(.top, 18)
            }
        }
    }
}

// MARK: - Results

/// Hands the verdict band's visibility to the page, so the floating readout can show the
/// figures while the band is scrolled away.
@MainActor @Observable
final class ToolHeadlineTracker {
    var isOnScreen = true
}

extension View {
    /// Marks this view as the page's headline result: when it scrolls off, the page's
    /// readout bar takes over.
    func toolHeadline() -> some View {
        modifier(ToolHeadlineReporter())
    }
}

private struct ToolHeadlineReporter: ViewModifier {
    @Environment(ToolHeadlineTracker.self) private var tracker: ToolHeadlineTracker?

    func body(content: Content) -> some View {
        content.onScrollVisibilityChange(threshold: 0.15) { visible in
            tracker?.isOnScreen = visible
        }
    }
}

/// One figure on the blue band (`nb-stamp`): the number big, its caption under a rule.
struct ToolStampFigure: View {
    let value: String
    let label: String
    var size: CGFloat = 46

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value)
                .font(LF.Fonts.mono(size, weight: .bold, relativeTo: .largeTitle))
                .tracking(-size * 0.04)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.35)
            Rectangle()
                .fill(LF.Palette.onBlue.opacity(0.4))
                .frame(height: 1)
                .padding(.top, 9)
            Text(label)
                .font(LF.Fonts.mono(12.8, relativeTo: .caption))
                .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
        }
        .foregroundStyle(LF.Palette.onBlue)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value), \(label)")
    }
}

/// What a calculator concludes: the kicker, the sentence, what it means, and three figures.
/// The page stamps it on the blue band (`ToolVerdictSlab`), or, on iPhone Duo, on a page or
/// half of the screen of its own (`ToolReadoutPanel`).
struct ToolVerdict {
    let kicker: String
    let line: String
    let message: String
    let figures: [(value: String, label: String)]
}

/// The verdict, stamped across the blue band (`nb-slab`): the kicker, the sentence, what it
/// means, and three figures. The words carry the state; the band is weight, never the only
/// signal.
///
/// It brings its own space above it (`topPadding`), and steps aside while the verdict has a
/// place of its own: iPhone Duo's other page, or the top half in laptop posture
/// (`ToolReadoutPanel`), where the keypad bar carries the figures while the keyboard is up.
struct ToolVerdictSlab: View {
    let verdict: ToolVerdict
    let layout: LearnLayout
    var topPadding: CGFloat = 36

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.fold) private var fold

    init(_ verdict: ToolVerdict, layout: LearnLayout, topPadding: CGFloat = 36) {
        self.verdict = verdict
        self.layout = layout
        self.topPadding = topPadding
    }

    var body: some View {
        if layout.role == .page && !fold.isLaptop {
            slab
                .padding(.top, topPadding)
        }
    }

    private var slab: some View {
        SlabView {
            let words = ToolVerdictWords(verdict: verdict)
            let stamps = ForEach(verdict.figures.indices, id: \.self) { index in
                ToolStampFigure(value: verdict.figures[index].value, label: verdict.figures[index].label)
            }
            Group {
                if layout.isWide {
                    HStack(alignment: .bottom, spacing: 32) {
                        words.frame(maxWidth: .infinity, alignment: .leading)
                        HStack(alignment: .bottom, spacing: 28) { stamps }
                            .frame(maxWidth: .infinity)
                    }
                } else if layout.isRegular && !dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 26) {
                        words
                        HStack(alignment: .bottom, spacing: 28) { stamps }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 22) {
                        words
                        stamps
                    }
                }
            }
            .frame(maxWidth: LF.Metrics.maxContentWidth, alignment: .leading)
            .padding(layout.bandInsets)
            .frame(maxWidth: .infinity)
            .padding(.vertical, layout.isRegular ? 28 : 20)
        }
        .learnBand()
        .accessibilityElement(children: .contain)
        .toolHeadline()
    }
}

/// The verdict's words on the band: the kicker, the sentence, what it means.
private struct ToolVerdictWords: View {
    let verdict: ToolVerdict

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verdict.kicker)
                .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
            Text(verdict.line)
                .font(LF.Fonts.display(28, relativeTo: .title))
                .tracking(-0.7)
                .foregroundStyle(LF.Palette.onBlue)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
                .accessibilityAddTraits(.isHeader)
            Text(verdict.message)
                .font(LF.Fonts.body(15.5))
                .lineHeight(.multiple(factor: 1.45))
                .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 420, alignment: .leading)
                .padding(.top, 10)
        }
    }
}

/// The calculator's answer on a part of the screen of its own, on iPhone Duo: the page beside
/// the inputs with the inner screen held upright, or the top half above them bent like a
/// laptop. It never scrolls away, so the answer stays in sight while the numbers change. A
/// calculator with a verdict gets it on the blue band; the others get their readout figures.
struct ToolReadoutPanel: View {
    let verdict: ToolVerdict?
    let readout: [ToolReadout]
    let layout: LearnLayout

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// The laptop's top half: wide and short.
    private var isHalf: Bool { layout.role.isHalf }

    var body: some View {
        Group {
            if let verdict {
                verdictBand(verdict)
            } else {
                figuresCard
                    .learnColumn(layout)
            }
        }
        .padding(.top, isHalf ? 14 : 20)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Result")
    }

    private func verdictBand(_ verdict: ToolVerdict) -> some View {
        SlabView {
            let words = ToolVerdictWords(verdict: verdict)
            let stamps = HStack(alignment: .bottom, spacing: 20) {
                ForEach(verdict.figures.indices, id: \.self) { index in
                    ToolStampFigure(value: verdict.figures[index].value, label: verdict.figures[index].label, size: 34)
                }
            }
            // A page is narrow for three figures across, so stacked they're a size smaller.
            let stacked = VStack(alignment: .leading, spacing: 16) {
                ForEach(verdict.figures.indices, id: \.self) { index in
                    ToolStampFigure(value: verdict.figures[index].value, label: verdict.figures[index].label, size: 34)
                }
            }
            // Wide and short: the words, with the figures in a column beside them at one size.
            let column = VStack(alignment: .leading, spacing: 10) {
                ForEach(verdict.figures.indices, id: \.self) { index in
                    ToolStampFigure(value: verdict.figures[index].value, label: verdict.figures[index].label, size: 26)
                }
            }
            Group {
                if isHalf && !dynamicTypeSize.isAccessibilitySize {
                    // Side by side when the half is wide enough for both (iPhone Duo's is 615pt).
                    if layout.contentWidth >= 520 {
                        HStack(alignment: .top, spacing: 28) {
                            words.frame(maxWidth: .infinity, alignment: .leading)
                            column.frame(width: 240)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 18) {
                            words
                            column
                        }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 22) {
                        words
                        if dynamicTypeSize.isAccessibilitySize {
                            stacked
                        } else {
                            ViewThatFits(in: .horizontal) {
                                stamps
                                stacked
                            }
                        }
                    }
                }
            }
            .padding(layout.bandInsets)
            .padding(.vertical, isHalf ? 16 : 22)
        }
        .learnBand()
    }

    private var figuresCard: some View {
        NotebookCard(padding: isHalf ? 16 : LF.Metrics.cardPadding) {
            if let first = readout.first {
                ToolBigFigure(value: first.value, unit: first.unit, size: isHalf ? 36 : 40)
            }
            if readout.count > 1 {
                DashedRule()
                    .padding(.top, 12)
                ToolFlowLayout(spacing: 20, lineSpacing: 8) {
                    ForEach(readout.indices.dropFirst(), id: \.self) { index in
                        CountText(readout[index].value, unit: readout[index].unit, size: 20)
                    }
                }
                .padding(.top, 12)
            }
        }
    }
}

/// The figures the floating readout shows while the verdict is scrolled away.
struct ToolReadout: Hashable, Sendable {
    let value: String
    let unit: String
}

/// The strip that floats above the keypad (or the bottom edge) once the verdict band has
/// scrolled away, so the answer stays in sight while you change the numbers.
struct ToolReadoutBar: View {
    let figures: [ToolReadout]

    var body: some View {
        ToolFlowLayout(spacing: 20, lineSpacing: 6) {
            ForEach(figures.indices, id: \.self) { index in
                CountText(figures[index].value, unit: figures[index].unit, size: 18)
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .padding(.horizontal, LF.Metrics.gutter)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            LF.Palette.card
                .overlay(alignment: .top) { InkRule() }
                .ignoresSafeArea(edges: .bottom)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Result")
        .accessibilityValue(figures.map { "\($0.value) \($0.unit)" }.joined(separator: ", "))
    }
}

/// A ruled two-column list (`dl` of `nb-slug` terms and ink values), stacked at the
/// accessibility sizes.
struct ToolTerms: View {
    let rows: [(term: String, value: String)]
    var onBlue = false

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let termColor = onBlue ? LF.Palette.onBlue.opacity(0.85) : LF.Palette.graphite
        let valueColor = onBlue ? LF.Palette.onBlue : LF.Palette.ink
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(rows.indices, id: \.self) { index in
                        VStack(alignment: .leading, spacing: 2) {
                            SlugText(rows[index].term, color: termColor)
                            SlugText(rows[index].value, color: valueColor)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            } else {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 14, verticalSpacing: 7) {
                    ForEach(rows.indices, id: \.self) { index in
                        GridRow {
                            SlugText(rows[index].term, color: termColor)
                                .fixedSize()
                            SlugText(rows[index].value, color: valueColor)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }
}

/// A big blue figure with its unit beside it, wrapping the unit under it when they don't fit.
struct ToolBigFigure: View {
    let value: String
    let unit: String
    var size: CGFloat = 34

    var body: some View {
        ToolFlowLayout(spacing: 8, lineSpacing: 2) {
            Text(value)
                .font(LF.Fonts.mono(size, weight: .bold, relativeTo: .title))
                .tracking(-size * 0.03)
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(unit)
                .font(LF.Fonts.mono(14, relativeTo: .callout))
                .foregroundStyle(LF.Palette.ink)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) \(unit)")
    }
}

/// "Every line, with your numbers in it.": what, the formula, and the formula worked.
struct ToolWorking: View {
    let rows: [(title: String, formula: String, worked: String)]
    let layout: LearnLayout

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let wide = layout.isRegular && !dynamicTypeSize.isAccessibilitySize
        VStack(alignment: .leading, spacing: 0) {
            if wide {
                HStack(spacing: 20) {
                    SlugText("what").frame(width: layout.contentWidth * 0.26, alignment: .leading)
                    SlugText("formula").frame(maxWidth: .infinity, alignment: .leading)
                    SlugText("with your numbers").frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.bottom, 8)
                .accessibilityHidden(true)
            }
            InkRule()
            ForEach(rows.indices, id: \.self) { index in
                let row = rows[index]
                let title = Text(row.title)
                    .font(LF.Fonts.body(15.5, weight: .semibold))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                let formula = Text(row.formula)
                    .font(LF.Fonts.mono(12.5, relativeTo: .footnote))
                    .foregroundStyle(LF.Palette.blue)
                    .fixedSize(horizontal: false, vertical: true)
                let worked = Text(row.worked)
                    .font(LF.Fonts.mono(12.5, relativeTo: .footnote))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Group {
                    if wide {
                        HStack(alignment: .firstTextBaseline, spacing: 20) {
                            title.frame(width: layout.contentWidth * 0.26, alignment: .leading)
                            formula.frame(maxWidth: .infinity, alignment: .leading)
                            worked.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 5) {
                            title
                            formula
                            worked
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 12)
                .overlay(alignment: .bottom) { DashedRule() }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(row.title)
                .accessibilityValue("\(row.formula). \(row.worked)")
            }
        }
    }
}

/// A callout (`nb-note`) with its mono kicker and a paragraph.
struct ToolNote: View {
    let kicker: String
    let text: String

    var body: some View {
        NoteCallout {
            SlugText(kicker)
            Text(text)
                .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .learnMeasure(64)
    }
}

/// A correction stamped in the margin (`nb-error`): bold mono behind a heavy ink bar. Static,
/// so it isn't announced like a form error.
struct ToolMarginWarning: View {
    let text: String

    var body: some View {
        Text(text)
            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
            .lineHeight(.multiple(factor: 1.45))
            .foregroundStyle(LF.Palette.ink)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.leading, 9.6)
            .overlay(alignment: .leading) {
                Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.heavyStroke)
            }
            .learnMeasure(62)
    }
}

/// A small ruled heading inside a card: mono, over a dashed rule.
struct ToolCardKicker: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            SlugText(text)
                .fixedSize(horizontal: false, vertical: true)
            DashedRule()
        }
    }
}

// MARK: - The back of the sheet

/// One column of the notes: a heading on a 2pt ink rule, then bullets. A bullet may carry
/// Markdown links (`[MatWeb](https://...)`), which open in place when they point at the site.
struct ToolNoteColumn {
    let heading: String
    /// A paragraph before the bullets.
    var intro: String?
    let bullets: [String]
    var footnote: String?
}

/// "the back of the sheet": folded until asked for, then the sources and the limits.
struct ToolBackOfSheet<Extra: View>: View {
    let title: String
    let columns: [ToolNoteColumn]
    let layout: LearnLayout
    @ViewBuilder var extra: Extra

    @State private var isOpen = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                LF.Motion.perform(LF.Motion.settle) { isOpen.toggle() }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 16) {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionLabel("the back of the sheet")
                        Text(title)
                            .font(LF.Fonts.display(23, relativeTo: .title2))
                            .tracking(-0.55)
                            .foregroundStyle(LF.Palette.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(isOpen ? "hide" : "show", color: LF.Palette.ink)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: LF.Metrics.tap)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("The back of the sheet: \(title)")
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")

            if isOpen {
                VStack(alignment: .leading, spacing: 30) {
                    if layout.isWide {
                        HStack(alignment: .top, spacing: 32) {
                            ForEach(columns.indices, id: \.self) { index in
                                ToolNoteColumnView(column: columns[index])
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    } else {
                        ForEach(columns.indices, id: \.self) { index in
                            ToolNoteColumnView(column: columns[index])
                        }
                    }
                    extra
                }
                .padding(.top, 26)
            }
        }
        .padding(.top, 26)
        .overlay(alignment: .top) { InkRule() }
    }
}

extension ToolBackOfSheet where Extra == EmptyView {
    init(title: String, columns: [ToolNoteColumn], layout: LearnLayout) {
        self.init(title: title, columns: columns, layout: layout) { EmptyView() }
    }
}

private struct ToolNoteColumnView: View {
    let column: ToolNoteColumn

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText(column.heading, color: LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 8)
                .overlay(alignment: .bottom) { InkRule() }
            if let intro = column.intro {
                ToolRichText(intro, size: 15)
                    .padding(.top, 14)
            }
            VStack(alignment: .leading, spacing: 10) {
                ForEach(column.bullets.indices, id: \.self) { index in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text(verbatim: "–")
                            .font(LF.Fonts.mono(13))
                            .foregroundStyle(LF.Palette.blue)
                            .accessibilityHidden(true)
                        ToolRichText(column.bullets[index], size: 15)
                    }
                }
            }
            .padding(.top, 14)
            if let footnote = column.footnote {
                SlugText(footnote)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
            }
        }
        .learnMeasure(60)
    }
}

/// Running text that may hold Markdown links (ink, blue rule under them, tappable) and
/// `**bold**`. Plain text otherwise, so formulas with underscores ("I_limit") are never read
/// as emphasis.
struct ToolRichText: View {
    let text: String
    var size: CGFloat
    var color: Color

    init(_ text: String, size: CGFloat = 16, color: Color = LF.Palette.graphite) {
        self.text = text
        self.size = size
        self.color = color
    }

    private var attributed: AttributedString {
        guard text.contains("](") || text.contains("**"),
              var parsed = try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))
        else { return AttributedString(text) }
        for run in parsed.runs where run.link != nil {
            parsed[run.range].foregroundColor = LF.Palette.ink
            parsed[run.range].underlineStyle = Text.LineStyle(pattern: .solid, color: LF.Palette.blue)
        }
        return parsed
    }

    var body: some View {
        Text(attributed)
            .lfProse(size, lineHeight: 1.5, color: color)
            .tint(LF.Palette.ink)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A − box button, like the site's `nb-box-sm` remove buttons.
struct ToolRemoveButton: View {
    let label: String
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled
    @ScaledMetric(relativeTo: .body) private var scaledSide: CGFloat = 44
    /// Grows with the text, but only to 64pt, so it never squeezes the row beside it.
    private var side: CGFloat { min(scaledSide, 64) }

    var body: some View {
        Button(action: action) {
            Image(systemName: "minus")
                .font(.body.weight(.bold))
                .foregroundStyle(isEnabled ? LF.Palette.ink : LF.Palette.graphite)
                .frame(width: side, height: side)
                .background {
                    ZStack {
                        HandShape(.s).fill(LF.Palette.card)
                        HandShape(.s).strokeBorder(isEnabled ? LF.Palette.ink : LF.Palette.rule, lineWidth: LF.Metrics.stroke)
                    }
                }
                .contentShape(HandShape(.s))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// The site's plain meter (`nb-meter`): an ink trough with a blue fill, always printed next
/// to the figure it shows. Animates when the value changes on screen, not under Reduce Motion.
struct ToolMeterBar: View {
    let fraction: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .caption) private var height: CGFloat = 12.8

    private var clamped: Double { fraction.isFinite ? min(max(fraction, 0), 1) : 0 }

    var body: some View {
        GeometryReader { proxy in
            Rectangle()
                .fill(LF.Palette.blue)
                .frame(width: proxy.size.width * clamped)
                .frame(maxWidth: .infinity, alignment: .leading)
                .animation(reduceMotion ? nil : LF.Motion.draw, value: clamped)
        }
        .frame(height: height)
        .background(LF.Palette.paper)
        .clipShape(HandShape(.s))
        .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
        .accessibilityHidden(true)
    }
}

/// Brings the field being typed in to the upper third of the page. The system scrolls a
/// focused field only to the top of the keyboard, where iOS's floating keypad bar sits over it.
enum ToolFocusScroll {
    static func anchor(_ field: String) -> String { "tool-field-" + field }
}

extension LF.Tilt {
    /// A card's resting angle on a tool page: the site's preset, laid flat at the
    /// accessibility sizes, where a card many screens tall turned by a degree swings its
    /// corners out past the gutter.
    static func tool(_ index: Int, _ size: DynamicTypeSize) -> LF.Tilt {
        size.isAccessibilitySize ? .none : .preset(index)
    }
}
