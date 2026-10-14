import SwiftUI

// Inline text. A container with no inline code and no glossary term is one
// `Text` of its cached `AttributedString`. Otherwise its runs are tagged with
// custom text attributes, and a background reads the laid-out text
// (`Text.LayoutKey`) to draw the inline-code chips and to pin each glossary
// card's popover to its word. The text itself is drawn by SwiftUI as usual,
// so selection, links, Dynamic Type and VoiceOver are untouched.

/// Marks a run of inline code.
struct MarkdownChipAttribute: TextAttribute {
    let index: Int
}

/// Marks a glossary auto-link.
struct MarkdownGlossaryAttribute: TextAttribute {
    let slug: String
}

extension MarkdownSegment {
    /// Segments joined into one `Text`, each run tagged with its marks.
    static func composedText(_ segments: [MarkdownSegment]) -> Text {
        var interpolation = LocalizedStringKey.StringInterpolation(literalCapacity: 0, interpolationCount: segments.count)
        for (index, segment) in segments.enumerated() {
            var text = Text(segment.string)
            switch segment.mark {
            case .none: break
            case .code: text = text.customAttribute(MarkdownChipAttribute(index: index))
            case .glossary(let slug): text = text.customAttribute(MarkdownGlossaryAttribute(slug: slug))
            }
            interpolation.appendInterpolation(text)
        }
        return Text(LocalizedStringKey(stringInterpolation: interpolation))
    }
}

struct MarkdownInlineText: View {
    let content: MarkdownInline
    let context: MarkdownRenderContext

    var body: some View {
        // Never truncate prose: take the full height the text needs at the offered width.
        text.fixedSize(horizontal: false, vertical: true)
    }

    @ViewBuilder
    private var text: some View {
        if content.isComposed {
            MarkdownSegment.composedText(content.segments)
                .backgroundPreferenceValue(Text.LayoutKey.self) { layouts in
                    GeometryReader { proxy in
                        MarkdownInlineMarks(
                            marks: InlineMarkGeometry(layouts: layouts, proxy: proxy),
                            context: context
                        )
                    }
                }
        } else {
            Text(content.attributed)
        }
    }
}

/// Where the marked runs ended up, in the text's own coordinates.
struct InlineMarkGeometry: Equatable {
    struct Anchor: Equatable, Identifiable {
        let slug: String
        let rect: CGRect
        var id: String { slug }
    }

    var chips: [CGRect] = []
    var anchors: [Anchor] = []

    init(layouts: Text.LayoutKey.Value, proxy: GeometryProxy) {
        var anchors: [String: CGRect] = [:]
        var order: [String] = []
        for anchored in layouts {
            let origin = proxy[anchored.origin]
            for line in anchored.layout {
                var current: (index: Int, rect: CGRect)?
                for run in line {
                    let bounds = run.typographicBounds.rect.offsetBy(dx: origin.x, dy: origin.y)
                    if let chip = run[MarkdownChipAttribute.self] {
                        if let open = current, open.index == chip.index {
                            current = (chip.index, open.rect.union(bounds))
                        } else {
                            if let open = current { chips.append(Self.chipRect(open.rect)) }
                            current = (chip.index, bounds)
                        }
                    } else if let open = current {
                        chips.append(Self.chipRect(open.rect))
                        current = nil
                    }
                    if let term = run[MarkdownGlossaryAttribute.self], anchors[term.slug] == nil {
                        anchors[term.slug] = bounds
                        order.append(term.slug)
                    }
                }
                if let open = current { chips.append(Self.chipRect(open.rect)) }
            }
        }
        self.anchors = order.compactMap { slug in anchors[slug].map { Anchor(slug: slug, rect: $0) } }
    }

    /// The run's box, less the kerning added after its last character, with
    /// even padding on both sides and a little trimmed off the tall mono ascent.
    private static func chipRect(_ run: CGRect) -> CGRect {
        let padding: CGFloat = 2.5
        var rect = run
        rect.origin.x -= padding
        rect.size.width += padding * 2 - MarkdownStyler.chipKern
        let trim = rect.height * 0.1
        rect.origin.y += trim
        rect.size.height -= trim * 1.5
        return rect
    }
}

/// Draws the chips and hosts the glossary popovers.
struct MarkdownInlineMarks: View {
    let marks: InlineMarkGeometry
    let context: MarkdownRenderContext

    var body: some View {
        ZStack(alignment: .topLeading) {
            if !marks.chips.isEmpty {
                let path = Path { path in
                    for rect in marks.chips {
                        path.addRoundedRect(in: rect, cornerSize: CGSize(width: 3, height: 3), style: .continuous)
                    }
                }
                path.fill(context.surface == .card ? LF.Palette.paper : LF.Palette.card)
                    .accessibilityHidden(true)
                path.stroke(LF.Palette.rule, lineWidth: LF.Metrics.hairline)
                    .accessibilityHidden(true)
            }
            ForEach(marks.anchors) { anchor in
                Color.clear
                    .frame(width: max(anchor.rect.width, 1), height: max(anchor.rect.height, 1))
                    .popover(isPresented: isPresented(anchor.slug)) {
                        if let term = context.terms[anchor.slug] {
                            GlossaryTermCard(term: term) {
                                context.presentedTerm.wrappedValue = nil
                                context.open(.glossaryTerm(term.slug))
                            }
                        }
                    }
                    .position(x: anchor.rect.midX, y: anchor.rect.midY)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .allowsHitTesting(false)
    }

    private func isPresented(_ slug: String) -> Binding<Bool> {
        let presented = context.presentedTerm
        return Binding(
            get: { presented.wrappedValue == slug },
            set: { isShown in
                if !isShown, presented.wrappedValue == slug { presented.wrappedValue = nil }
            }
        )
    }
}
