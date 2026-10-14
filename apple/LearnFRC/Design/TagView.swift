import SwiftUI

/// A small mono chip (`nb-tag`) for a topic, a difficulty, a role or a status.
///
///     TagView("you", on: true)
///     TagView("Team 254")
///
/// `on` fills it blue, on the same frame (no fade). On its own a tag is a label, so `on` is
/// only emphasis: "banked" or "you" reads as its word, never as "selected". Selection belongs
/// to controls. For a tappable filter use `Toggle(isOn:) { Text("mechanical") }.toggleStyle(.tag)`,
/// which reads as a toggle; a `TagView` used as a `Button`'s label gets the `.isSelected`
/// trait on the button (the glossary's category chips).
struct TagView: View {
    let text: String
    var on: Bool
    var systemImage: String?

    init(_ text: String, on: Bool = false, systemImage: String? = nil) {
        self.text = text
        self.on = on
        self.systemImage = systemImage
    }

    var body: some View {
        TagFace(on: on) {
            if let systemImage {
                Image(systemName: systemImage)
                    .imageScale(.small)
                    .accessibilityHidden(true)
            }
            Text(text)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The drawn chip itself, shared by `TagView` and the tag toggle.
private struct TagFace<Label: View>: View {
    var on: Bool
    @ViewBuilder var label: Label

    @ScaledMetric(relativeTo: .caption2) private var vertical: CGFloat = 4.5
    @ScaledMetric(relativeTo: .caption2) private var horizontal: CGFloat = 9.6

    var body: some View {
        HStack(spacing: 5.6) { label }
            .font(LF.Fonts.mono(12, relativeTo: .caption))
            .tracking(12 * 0.03)
            .lineLimit(1)
            .foregroundStyle(on ? LF.Palette.onBlue : LF.Palette.ink)
            .padding(.vertical, vertical)
            .padding(.horizontal, horizontal)
            .background {
                ZStack {
                    HandShape(.s).fill(on ? LF.Palette.blueButton : LF.Palette.card)
                    HandShape(.s).strokeBorder(on ? LF.Palette.blueButton : LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                }
            }
    }
}

/// `Toggle` as a tag: tap to fill it blue. Presses with a 0.97 scale (90ms down, 140ms up),
/// keeps a 44pt tall target, and reads to VoiceOver as a toggle.
struct TagToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            TagFace(on: configuration.isOn) { configuration.label }
        }
        .buttonStyle(TagPressStyle())
        .accessibilityRepresentation {
            Toggle(isOn: configuration.$isOn) { configuration.label }
        }
        .sensoryFeedback(.selection, trigger: configuration.isOn)
    }
}

extension ToggleStyle where Self == TagToggleStyle {
    /// A filter chip that fills blue when on.
    static var tag: TagToggleStyle { TagToggleStyle() }
}

private struct TagPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        TagPress(configuration: configuration)
    }
}

private struct TagPress: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .frame(minHeight: LF.Metrics.tap)
            .contentShape(Rectangle())
            .animation(reduceMotion ? nil : (configuration.isPressed ? LF.Motion.press : LF.Motion.hover),
                       value: configuration.isPressed)
    }
}

#Preview("Tags", traits: .sizeThatFitsLayout) {
    @Previewable @State var mech = true
    @Previewable @State var cad = false
    VStack(alignment: .leading, spacing: 12) {
        HStack { TagView("you", on: true); TagView("Team 254"); TagView("mentor", systemImage: "person") }
        HStack {
            Toggle(isOn: $mech) { Text("mechanical") }.toggleStyle(.tag)
            Toggle(isOn: $cad) { Text("cad") }.toggleStyle(.tag)
        }
    }
    .padding(24)
    .paperBackground()
}
