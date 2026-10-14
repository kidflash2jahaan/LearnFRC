import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// A code listing: Space Mono on card stock inside a 2pt ink hand-drawn box
/// (`.nb-prose pre`), syntax coloured, long lines scrolling sideways. A label
/// strip carries the language and a copy button.
struct MarkdownCodeView: View {
    let code: MarkdownCode

    @State private var copied = false
    @ScaledMetric(relativeTo: .callout) private var padding: CGFloat = 14
    @ScaledMetric(relativeTo: .callout) private var lineGap: CGFloat = 5.5
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            DashedRule()
            ScrollView(.horizontal) {
                Text(code.attributed)
                    .lineSpacing(lineGap)
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(padding)
                    .textSelection(.enabled)
            }
            .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            .moreToTheRightFade()
        }
        .background { HandShape(.s).fill(LF.Palette.card) }
        .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
        .clipShape(HandShape(.s))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(accessibilityTitle)
    }

    private var header: some View {
        HStack(spacing: 8) {
            SlugText(code.displayLanguage ?? "text")
                .accessibilityHidden(true)
            Spacer(minLength: 8)
            Button(action: copy) {
                Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                    .font(LF.Fonts.mono(12, weight: .bold, relativeTo: .caption))
                    .foregroundStyle(copied ? LF.Palette.ink : LF.Palette.blue)
                    .contentTransition(reduceMotion ? .identity : .symbolEffect(.replace))
                    .frame(minHeight: LF.Metrics.tap)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(copied ? "Code copied" : "Copy code")
            #if os(macOS)
            .pointerStyle(.link)
            #endif
        }
        .padding(.leading, padding)
        .padding(.trailing, padding - 4)
    }

    private var accessibilityTitle: String {
        if let language = code.displayLanguage { return "\(language) code" }
        return "Code"
    }

    private func copy() {
        #if canImport(UIKit)
        UIPasteboard.general.string = code.code
        #elseif canImport(AppKit)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code.code, forType: .string)
        #endif
        Haptics.select()
        withAnimation(reduceMotion ? nil : LF.Motion.hover) { copied = true }
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            withAnimation(reduceMotion ? nil : LF.Motion.hover) { copied = false }
        }
    }
}
