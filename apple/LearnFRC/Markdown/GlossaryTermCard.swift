import SwiftUI

/// The definition card a glossary auto-link opens: a popover on iPad and Mac,
/// a sheet sized to the card on iPhone.
struct GlossaryTermCard: View {
    let term: GlossaryTerm
    let openEntry: () -> Void

    @State private var contentHeight: CGFloat = 0
    @ScaledMetric(relativeTo: .body) private var padding: CGFloat = 20
    @ScaledMetric(relativeTo: .body) private var idealWidth: CGFloat = 340
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                ScrollView { card }
            } else {
                card
            }
        }
        .frame(idealWidth: idealWidth, maxWidth: 440)
        .presentationBackground(LF.Palette.card)
        .presentationCompactAdaptation(.sheet)
        .presentationDetents(detents)
        .presentationDragIndicator(.visible)
    }

    /// On iPhone the card is a sheet just tall enough for the definition.
    private var detents: Set<PresentationDetent> {
        guard contentHeight > 0, !dynamicTypeSize.isAccessibilitySize else { return [.medium, .large] }
        return [.height(contentHeight + 16)]
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 12) {
            SlugText("glossary / \(term.category.lowercased())")

            VStack(alignment: .leading, spacing: 4) {
                Text(term.term)
                    .font(LF.Fonts.display(22, relativeTo: .title2))
                    .tracking(22 * -0.02)
                    .foregroundStyle(LF.Palette.ink)
                    .accessibilityAddTraits(.isHeader)
                if let abbr = term.abbr, !abbr.isEmpty, abbr != term.term {
                    SlugText(abbr, color: LF.Palette.ink, size: 13, weight: .bold)
                        .accessibilityLabel("Short form: \(abbr)")
                }
            }

            Text(term.definition)
                .font(LF.Fonts.body(16, relativeTo: .callout))
                .lineSpacing(5)
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)

            Button("Open glossary entry", action: openEntry)
                .buttonStyle(.inkSmall)
                .padding(.top, 4)
                .accessibilityHint("Shows the full entry for \(term.term)")
        }
        .padding(padding)
        .padding(.top, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
    }
}

#Preview("Glossary card", traits: .sizeThatFitsLayout) {
    GlossaryTermCard(term: PreviewData.term) {}
        .frame(width: 360)
        .background(LF.Palette.card)
}

#Preview("Glossary card, dark", traits: .sizeThatFitsLayout) {
    GlossaryTermCard(term: PreviewData.glossary[3]) {}
        .frame(width: 360)
        .background(LF.Palette.card)
        .preferredColorScheme(.dark)
}
