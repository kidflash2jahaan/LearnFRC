import Foundation
import SwiftUI

// The parsed, display-ready form of one lesson or article body.
//
// `MarkdownParser` builds it once per content string (see `MarkdownDocumentCache`),
// so views only read finished values: every inline run is already an
// `AttributedString` with its fonts, colours and links, and every code block
// is already highlighted. Nothing here is computed in a view's body.

/// A heading in a lesson, with the same anchor id the website gives it
/// (`extractHeadings` in `src/components/markdown.tsx`), so an "on this page"
/// list and `https://learnfrc.com/...#anchor` links agree with the site.
struct LessonMarkdownHeading: Hashable, Sendable, Identifiable {
    /// The anchor, e.g. `returning-the-auto-command`. Also the SwiftUI `.id` of
    /// the rendered heading, so `ScrollViewProxy.scrollTo(heading.id)` works.
    let id: String
    /// Heading text with inline Markdown removed.
    let title: String
    /// 2 for `#` and `##`, 3 for `###` (the site's convention).
    let level: Int
}

/// The finished document.
struct MarkdownDocument: Sendable {
    let blocks: [MarkdownBlock]
    let headings: [LessonMarkdownHeading]
    /// Plain text of the whole body, for read-aloud and search.
    let plainText: String
    /// The Dynamic Type scale it was styled for, and whether that mattered
    /// (only emphasis and code comments use fixed-size sheared fonts).
    let typeScale: MarkdownTypeScale
    let dependsOnTypeScale: Bool

    static let empty = MarkdownDocument(blocks: [], headings: [], plainText: "", typeScale: .standard, dependsOnTypeScale: false)

    func fits(_ scale: MarkdownTypeScale) -> Bool {
        !dependsOnTypeScale || typeScale == scale
    }
}

// MARK: - Inline content

/// Bold, italic and strikethrough, as they nest in the source.
struct MarkdownTraits: OptionSet, Hashable, Sendable {
    let rawValue: UInt8
    static let bold = MarkdownTraits(rawValue: 1 << 0)
    static let italic = MarkdownTraits(rawValue: 1 << 1)
    static let strike = MarkdownTraits(rawValue: 1 << 2)
}

/// One inline run. A `.text` span corresponds to exactly one text node in the
/// website's HTML tree, which is the unit the glossary linker works on.
struct MarkdownSpan: Hashable, Sendable {
    enum Kind: Hashable, Sendable {
        case text
        case code
        case lineBreak
        /// An image that sits inside running text (alt text is `text`).
        case image(source: String)
        /// Raw HTML. The site shows it as literal text, and so do we.
        case html
    }

    var kind: Kind
    var text: String
    var traits: MarkdownTraits = []
    /// Destination of the author's link around this run, already normalised
    /// (see `MarkdownLinks.normalise`).
    var link: String? = nil
    /// Set by the glossary linker: the slug of the term this run links to.
    var glossarySlug: String? = nil
}

/// Where an inline container sits. Decides its fonts and colours.
enum MarkdownInlineRole: Hashable, Sendable {
    case body
    case heading(Int)
    case quote
    case callout
    case tableHeader
    case tableCell
}

/// How a styled run is marked for the decorations drawn behind the text.
enum MarkdownSegmentMark: Hashable, Sendable {
    case none
    /// Inline code: a paper chip with a hairline rule border.
    case code
    /// A glossary auto-link: tapping it opens the term card.
    case glossary(String)
}

/// A styled run, ready to become a `Text`.
struct MarkdownSegment: Hashable, Sendable {
    var string: AttributedString
    var mark: MarkdownSegmentMark
}

/// An inline container (paragraph, heading, table cell...).
struct MarkdownInline: Hashable, Sendable {
    var spans: [MarkdownSpan]
    var role: MarkdownInlineRole
    /// Filled by `MarkdownStyler` once linking is done, when `isComposed`.
    var segments: [MarkdownSegment] = []
    /// The whole container as one string, used when `isComposed` is false.
    var attributed: AttributedString = AttributedString()
    /// True when a run is tagged (inline code or a glossary term), so the text
    /// is built from `segments` and decorations are drawn behind it.
    var isComposed: Bool = false

    var plainText: String {
        spans.reduce(into: "") { result, span in
            switch span.kind {
            case .lineBreak: result += "\n"
            case .image: break
            default: result += span.text
            }
        }
    }

    var isEmpty: Bool { spans.isEmpty }
}

// MARK: - Blocks

struct MarkdownBlock: Identifiable, Hashable, Sendable {
    let id: Int
    var kind: Kind

    enum Kind: Hashable, Sendable {
        /// `anchor` is nil for headings the site does not give an id (h4 and deeper).
        case heading(level: Int, content: MarkdownInline, anchor: String?)
        case paragraph(MarkdownInline)
        /// A paragraph that holds nothing but one image.
        case image(source: String, alt: String)
        case list(MarkdownList)
        /// A plain block quote: quoted words or a copy-paste template.
        case quote([MarkdownBlock])
        /// A block quote that opens with bold text: a note, tip or warning.
        /// `label` is the bold lead-in when it reads as a label ("Wiring tip:").
        case callout(label: String?, blocks: [MarkdownBlock])
        case code(MarkdownCode)
        case table(MarkdownTable)
        case rule
    }
}

struct MarkdownList: Hashable, Sendable {
    var ordered: Bool
    var start: Int
    var loose: Bool
    var items: [MarkdownListItem]

    /// The widest marker in this list, so every marker gets the same column.
    var widestMarker: String {
        ordered ? "\(start + max(items.count - 1, 0))." : "-"
    }
}

struct MarkdownListItem: Identifiable, Hashable, Sendable {
    let id: Int
    /// nil for an ordinary item, true/false for a GFM task list item.
    var checkbox: Bool?
    var blocks: [MarkdownBlock]
}

struct MarkdownCode: Hashable, Sendable {
    /// The fence's info string as written (`java`, `py`, ...), or nil.
    var language: String?
    /// The language the highlighter used, for the label ("java", "python").
    var displayLanguage: String?
    /// Source without the final newline.
    var code: String
    /// Highlighted, set by `MarkdownStyler`.
    var attributed: AttributedString = AttributedString()
    var lineCount: Int
}

struct MarkdownTable: Hashable, Sendable {
    enum Alignment: Hashable, Sendable { case leading, center, trailing }
    var alignments: [Alignment]
    var header: [MarkdownInline]
    var rows: [[MarkdownInline]]

    var columnCount: Int { alignments.count }
}
