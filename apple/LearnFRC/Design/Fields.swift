import Accessibility
import SwiftUI

/// A text input in the site's style (`nb-input`): card stock, 2pt ink at the small hand radius,
/// the border turns blue while focused (so focus isn't shown by the ring alone), 3pt ink when
/// invalid, rule-coloured when disabled. Keeps the 44pt minimum height.
///
///     TextField("", text: $email)
///         .inkField(focused: focus == .email, invalid: emailError != nil)
///
/// Put a `FieldLabel` above (never a placeholder standing in for a label) and a `FieldHint`
/// or `FieldError` below. `InkField` does the whole stack for you.
extension View {
    func inkField(focused: Bool = false, invalid: Bool = false) -> some View {
        modifier(InkFieldModifier(focused: focused, invalid: invalid))
    }
}

private struct InkFieldModifier: ViewModifier {
    let focused: Bool
    let invalid: Bool

    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var vertical: CGFloat = 10
    @ScaledMetric(relativeTo: .body) private var horizontal: CGFloat = 13.6

    private var border: Color {
        if !isEnabled { return LF.Palette.rule }
        if invalid { return LF.Palette.ink }
        return focused ? LF.Palette.blue : LF.Palette.ink
    }

    func body(content: Content) -> some View {
        content
            .textFieldStyle(.plain)
            .font(LF.Fonts.body(17))
            .foregroundStyle(isEnabled ? LF.Palette.ink : LF.Palette.graphite)
            .tint(LF.Palette.blue)
            .padding(.vertical, vertical)
            .padding(.horizontal, horizontal)
            .frame(minHeight: LF.Metrics.tap)
            .background {
                ZStack {
                    HandShape(.s).fill(isEnabled ? LF.Palette.card : LF.Palette.paper)
                    HandShape(.s).strokeBorder(border, lineWidth: invalid ? LF.Metrics.heavyStroke : LF.Metrics.stroke)
                }
            }
            .animation(reduceMotion ? nil : LF.Motion.hover, value: focused)
    }
}

/// The mono caption above a control (`nb-label`).
struct FieldLabel: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(LF.Fonts.mono(12.5, relativeTo: .caption))
            .tracking(12.5 * 0.04)
            .foregroundStyle(LF.Palette.ink)
    }
}

/// The quiet mono line under a control that says what's expected (`nb-hint`).
struct FieldHint: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(LF.Fonts.mono(12, relativeTo: .caption))
            .foregroundStyle(LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// A correction stamped in the margin (`nb-error`): bold ink behind a heavy ink bar, so it reads
/// as wrong without a colour the palette doesn't own. Announced to VoiceOver when it appears.
struct FieldError: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
            .foregroundStyle(LF.Palette.ink)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.leading, 9.6)
            .overlay(alignment: .leading) {
                Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.heavyStroke)
            }
            .accessibilityLabel("Error: \(text)")
            .onAppear {
                AccessibilityNotification.Announcement(text).post()
            }
    }
}

/// Label, field, then hint or error, stacked like the site's `nb-field`.
///
///     InkField("email", text: $email, hint: "We'll send a confirmation link.", error: emailError)
///         .textContentType(.emailAddress)
struct InkField: View {
    let label: String
    @Binding var text: String
    var prompt: String?
    var hint: String?
    var error: String?
    var secure: Bool

    @FocusState private var focused: Bool
    /// The box's vertical padding (`InkFieldModifier`), which the tap bands cover.
    @ScaledMetric(relativeTo: .body) private var boxPadding: CGFloat = 10

    init(_ label: String, text: Binding<String>, prompt: String? = nil, hint: String? = nil, error: String? = nil, secure: Bool = false) {
        self.label = label
        self._text = text
        self.prompt = prompt
        self.hint = hint
        self.error = error
        self.secure = secure
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            FieldLabel(label)
            Group {
                if secure {
                    SecureField(label, text: $text, prompt: prompt.map { Text($0).foregroundStyle(LF.Palette.graphite) })
                } else {
                    TextField(label, text: $text, prompt: prompt.map { Text($0).foregroundStyle(LF.Palette.graphite) })
                }
            }
            .focused($focused)
            .inkField(focused: focused, invalid: error != nil)
            .accessibilityHint(hint ?? "")
            .overlay { paddingTargets }
            if let error {
                FieldError(error)
            } else if let hint {
                FieldHint(hint)
                    .accessibilityHidden(true)
            }
        }
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    /// The box's padding is drawn around the text view, not part of it, so on iOS a tap there
    /// has no direct target and goes to the nearest button instead. These bands make the
    /// whole drawn box focus the field; the text view in the middle keeps its own touches
    /// (caret, selection). Only here, where the field's focus is known: `.inkField()` also
    /// draws boxes around menu labels, which must keep their taps.
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
            .onTapGesture { focused = true }
            // VoiceOver already has the field itself.
            .accessibilityHidden(true)
    }
}

#Preview("Fields", traits: .fixedLayout(width: 393, height: 380)) {
    @Previewable @State var name = "jahaan"
    @Previewable @State var team = ""
    VStack(alignment: .leading, spacing: 20) {
        InkField("username", text: $name, hint: "Letters, numbers and underscores.")
        InkField("team number", text: $team, prompt: "254", error: "Team numbers are 1 to 5 digits.")
        TextField("", text: .constant("Disabled")).inkField().disabled(true)
    }
    .padding(LF.Metrics.gutter)
    .frame(maxHeight: .infinity, alignment: .top)
    .paperBackground()
}
