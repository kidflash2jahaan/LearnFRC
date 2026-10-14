import SwiftUI

// One view per block kind. Spacing follows `.nb-prose`: 1.1em between blocks,
// 2.4rem above an h2 (which sits on a 2pt ink rule), 1.9rem above an h3,
// 2rem around a rule. Inside list items, quotes and callouts blocks sit closer.

enum MarkdownNesting {
    case root
    case nested
}

struct MarkdownBlocksView: View {
    let blocks: [MarkdownBlock]
    let context: MarkdownRenderContext
    let nesting: MarkdownNesting

    @ScaledMetric(relativeTo: .body) private var gap: CGFloat = 18
    @ScaledMetric(relativeTo: .body) private var nestedGap: CGFloat = 9
    @ScaledMetric(relativeTo: .title2) private var h2Gap: CGFloat = 38
    @ScaledMetric(relativeTo: .title3) private var h3Gap: CGFloat = 28
    @ScaledMetric(relativeTo: .headline) private var h4Gap: CGFloat = 22
    @ScaledMetric(relativeTo: .body) private var ruleGap: CGFloat = 30

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(blocks.enumerated()), id: \.element.id) { index, block in
                MarkdownBlockView(block: block, context: context)
                    .padding(.top, index == 0 ? 0 : spacing(before: block, after: blocks[index - 1]))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func spacing(before block: MarkdownBlock, after previous: MarkdownBlock) -> CGFloat {
        if case .rule = previous.kind { return ruleGap }
        switch block.kind {
        case .heading(let level, _, _):
            if nesting == .nested { return nestedGap * 1.5 }
            return level <= 2 ? h2Gap : (level == 3 ? h3Gap : h4Gap)
        case .rule:
            return ruleGap
        default:
            if case .heading = previous.kind, nesting == .root {
                // A heading holds its first paragraph close.
                return gap * 0.6
            }
            return nesting == .root ? gap : nestedGap
        }
    }
}

struct MarkdownBlockView: View {
    let block: MarkdownBlock
    let context: MarkdownRenderContext

    var body: some View {
        switch block.kind {
        case .heading(let level, let content, let anchor):
            MarkdownHeadingView(level: level, content: content, context: context)
                .id(anchor ?? "block-\(block.id)")
        case .paragraph(let content):
            MarkdownParagraphView(content: content, context: context)
        case .image(let source, let alt):
            MarkdownImageView(source: source, alt: alt)
        case .list(let list):
            MarkdownListView(list: list, context: context)
        case .quote(let blocks):
            MarkdownQuoteView(blocks: blocks, context: context)
        case .callout(let label, let blocks):
            MarkdownCalloutView(label: label, blocks: blocks, context: context)
        case .code(let code):
            MarkdownCodeView(code: code)
        case .table(let table):
            MarkdownTableView(table: table, context: context)
        case .rule:
            DashedRule()
        }
    }
}

// MARK: - Headings

struct MarkdownHeadingView: View {
    let level: Int
    let content: MarkdownInline
    let context: MarkdownRenderContext

    @ScaledMetric(relativeTo: .title2) private var ruleGap: CGFloat = 16

    var body: some View {
        if level <= 2 {
            VStack(alignment: .leading, spacing: ruleGap) {
                InkRule()
                text
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            .accessibilityHeading(.h2)
        } else {
            text
                .accessibilityAddTraits(.isHeader)
                .accessibilityHeading(level == 3 ? .h3 : .h4)
        }
    }

    private var text: some View {
        MarkdownInlineText(content: content, context: context)
            .lineSpacing(level <= 3 ? 0 : 3)
    }
}

// MARK: - Paragraphs

struct MarkdownParagraphView: View {
    let content: MarkdownInline
    let context: MarkdownRenderContext

    @ScaledMetric(relativeTo: .body) private var leading: CGFloat = 6.5
    @ScaledMetric(relativeTo: .subheadline) private var tableLeading: CGFloat = 3

    var body: some View {
        MarkdownInlineText(content: content, context: context)
            .lineSpacing(content.role == .tableCell ? tableLeading : leading)
    }
}

// MARK: - Lists

struct MarkdownListView: View {
    let list: MarkdownList
    let context: MarkdownRenderContext

    @ScaledMetric(relativeTo: .body) private var itemGap: CGFloat = 7
    @ScaledMetric(relativeTo: .body) private var looseGap: CGFloat = 12
    @ScaledMetric(relativeTo: .body) private var markerGap: CGFloat = 9
    @ScaledMetric(relativeTo: .body) private var bulletWidth: CGFloat = 9

    var body: some View {
        VStack(alignment: .leading, spacing: list.loose ? looseGap : itemGap) {
            ForEach(Array(list.items.enumerated()), id: \.element.id) { index, item in
                HStack(alignment: .firstTextBaseline, spacing: markerGap) {
                    marker(index: index, item: item)
                    MarkdownBlocksView(blocks: item.blocks, context: context, nesting: .nested)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func marker(index: Int, item: MarkdownListItem) -> some View {
        if let checked = item.checkbox {
            Image(systemName: checked ? "checkmark.square" : "square")
                .font(LF.Fonts.body(MarkdownStyle.bodySize - 1))
                .foregroundStyle(checked ? LF.Palette.blue : LF.Palette.graphite)
                .accessibilityLabel(checked ? "Checked" : "Not checked")
        } else if list.ordered {
            // A hidden copy of the widest number keeps every item's text on one edge.
            ZStack(alignment: .trailing) {
                Text(verbatim: list.widestMarker).hidden()
                Text(verbatim: "\(list.start + index).")
            }
            .font(LF.Fonts.mono(MarkdownStyle.bodySize * 0.85, relativeTo: .body))
            .monospacedDigit()
            .foregroundStyle(LF.Palette.graphite)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(list.start + index).")
        } else {
            Text(verbatim: "-")
                .font(LF.Fonts.body(MarkdownStyle.bodySize, weight: .bold))
                .foregroundStyle(LF.Palette.blue)
                .frame(minWidth: bulletWidth, alignment: .leading)
                .accessibilityHidden(true)
        }
    }
}

// MARK: - Quotes and callouts

/// Quoted words or a template: a 3pt blue bar and graphite text.
struct MarkdownQuoteView: View {
    let blocks: [MarkdownBlock]
    let context: MarkdownRenderContext

    @ScaledMetric(relativeTo: .body) private var inset: CGFloat = 16

    var body: some View {
        MarkdownBlocksView(blocks: blocks, context: context, nesting: .nested)
            .padding(.vertical, 3)
            .padding(.leading, inset)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(LF.Palette.blue)
                    .frame(width: LF.Metrics.heavyStroke)
                    .accessibilityHidden(true)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Quote")
    }
}

/// A note, tip or warning: the site's `nb-note` box, labelled with its lead-in.
struct MarkdownCalloutView: View {
    let label: String?
    let blocks: [MarkdownBlock]
    let context: MarkdownRenderContext

    var body: some View {
        NoteCallout {
            if let label {
                SlugText(label.lowercased(), color: LF.Palette.ink, size: 12.5, weight: .bold)
                    .accessibilityLabel(label)
            }
            MarkdownBlocksView(blocks: blocks, context: context.on(.card), nesting: .nested)
        }
    }
}

// MARK: - Images

/// Lessons have no images today; this keeps one readable if an author adds it.
struct MarkdownImageView: View {
    let source: String
    let alt: String

    var body: some View {
        AsyncImage(url: URL(string: source)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
                    .overlay { Rectangle().strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
            default:
                VStack(alignment: .leading, spacing: 6) {
                    SlugText("image")
                    if !alt.isEmpty {
                        Text(alt)
                            .font(LF.Fonts.body(15, relativeTo: .subheadline))
                            .foregroundStyle(LF.Palette.graphite)
                    }
                }
                .padding(LF.Metrics.cardPadding)
                .frame(maxWidth: .infinity, alignment: .leading)
                .notebookBox(radius: .s, shadow: .none)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(alt.isEmpty ? "Image" : alt)
        .accessibilityAddTraits(.isImage)
    }
}
