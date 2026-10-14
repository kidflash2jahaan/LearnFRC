import SwiftUI
import CoreText
import Synchronization
#if canImport(UIKit)
import UIKit
#endif

// Turns parsed spans into finished `AttributedString`s, once per document.
// Fonts are the notebook faces and scale with Dynamic Type through their
// `relativeTo:` text styles; colours are the dynamic palette, so the cached
// strings follow light and dark mode without being rebuilt.
//
// Emphasis is the one exception. Neither Bricolage Grotesque nor Space Mono
// ships an italic, and SwiftUI won't synthesise one for a custom face, so an
// emphasised run uses a sheared copy of the upright face (what a browser does
// on the website). A sheared font has a fixed size, so it is built for the
// reader's current Dynamic Type size (`MarkdownTypeScale`).

/// Type sizes and colours for rendered Markdown, from `.nb-prose` in the site's CSS.
enum MarkdownStyle {
    /// Running text (`.nb-prose`: 1.02rem). 17pt is the iOS body size.
    static let bodySize: CGFloat = 17
    static let calloutSize: CGFloat = 16.5
    static let tableSize: CGFloat = 15.5
    static let tableHeaderSize: CGFloat = 12
    /// Prose h2 (clamp(1.5rem, ..., 2rem)) and h3 (clamp(1.15rem, ..., 1.45rem)).
    static let h2Size: CGFloat = 25
    static let h3Size: CGFloat = 19.5
    static let h4Size: CGFloat = 17.5
    /// Code listings (`pre code`: 0.84rem) and inline code (0.86em).
    static let codeSize: CGFloat = 13.5
    static let inlineCodeScale: CGFloat = 0.86
    /// About 12 degrees, the slant browsers synthesise.
    static let obliqueShear: CGFloat = 0.21

    static func size(for role: MarkdownInlineRole) -> CGFloat {
        switch role {
        case .body, .quote: bodySize
        case .callout: calloutSize
        case .heading(let level): level <= 2 ? h2Size : (level == 3 ? h3Size : h4Size)
        case .tableHeader: tableHeaderSize
        case .tableCell: tableSize
        }
    }

    static func textStyle(for role: MarkdownInlineRole) -> MarkdownTypeScale.Style {
        switch role {
        case .body, .quote: .body
        case .callout: .callout
        case .heading(let level): level <= 2 ? .title2 : (level == 3 ? .title3 : .headline)
        case .tableHeader: .caption
        case .tableCell: .subheadline
        }
    }

    static func color(for role: MarkdownInlineRole) -> Color {
        switch role {
        case .quote, .tableHeader: LF.Palette.graphite
        default: LF.Palette.ink
        }
    }

    /// The face `font(for:traits:scale:)` uses, for building a sheared copy.
    static func face(for role: MarkdownInlineRole, traits: MarkdownTraits) -> FontFace {
        switch role {
        case .heading(let level) where level <= 3:
            let size = size(for: role)
            return size >= 38 ? .displayLarge : (size >= 24 ? .displayMedium : .displaySmall)
        case .heading:
            return .bodyExtraBold
        case .tableHeader:
            return .monoBold
        default:
            return traits.contains(.bold) ? .bodyBold : .bodyRegular
        }
    }

    static func font(for role: MarkdownInlineRole, traits: MarkdownTraits, scale: MarkdownTypeScale) -> Font {
        let size = size(for: role)
        let style = textStyle(for: role)
        if traits.contains(.italic) {
            return oblique(face(for: role, traits: traits), size: size * scale.factor(style))
        }
        switch role {
        case .heading(let level) where level <= 3:
            return LF.Fonts.display(size, relativeTo: style.fontStyle)
        case .heading:
            return LF.Fonts.body(size, weight: .heavy, relativeTo: style.fontStyle)
        case .tableHeader:
            return LF.Fonts.mono(size, weight: .bold, relativeTo: style.fontStyle)
        default:
            return LF.Fonts.body(size, weight: traits.contains(.bold) ? .bold : .regular, relativeTo: style.fontStyle)
        }
    }

    static func codeFont(for role: MarkdownInlineRole, traits: MarkdownTraits) -> Font {
        let scale: CGFloat = role == .tableHeader ? 1 : inlineCodeScale
        let size = (size(for: role) * scale).rounded(.toNearestOrEven)
        let bold: Bool = switch role {
        case .heading, .tableHeader: true
        default: traits.contains(.bold)
        }
        return LF.Fonts.mono(size, weight: bold ? .bold : .regular, relativeTo: textStyle(for: role).fontStyle)
    }

    static func tracking(for role: MarkdownInlineRole) -> CGFloat? {
        switch role {
        case .heading(let level) where level <= 3: size(for: role) * -0.025
        case .tableHeader: size(for: role) * 0.05
        default: nil
        }
    }

    private static let obliqueFonts = Mutex<[String: Font]>([:])

    /// A sheared copy of a bundled face (or the system font if it didn't register).
    static func oblique(_ face: FontFace, size: CGFloat) -> Font {
        let key = "\(face.rawValue)@\(size)"
        if let cached = obliqueFonts.withLock({ $0[key] }) { return cached }
        let font = makeOblique(face, size: size)
        obliqueFonts.withLock { $0[key] = font }
        return font
    }

    private static func makeOblique(_ face: FontFace, size: CGFloat) -> Font {
        var shear = CGAffineTransform(a: 1, b: 0, c: obliqueShear, d: 1, tx: 0, ty: 0)
        let font: CTFont
        if FontRegistry.isAvailable(face) {
            font = CTFontCreateWithName(face.postScriptName as CFString, size, &shear)
        } else {
            let system = CTFontCreateUIFontForLanguage(face.isMono ? .userFixedPitch : .system, size, nil)
                ?? CTFontCreateWithName("Helvetica" as CFString, size, nil)
            font = CTFontCreateCopyWithAttributes(system, size, &shear, nil)
        }
        return Font(font)
    }

    // Colours for code tokens (the site's `.hljs-*` rules).
    static func codeColor(_ kind: CodeHighlighter.TokenKind) -> Color {
        switch kind {
        case .keyword, .literal, .string: LF.Palette.blue
        case .comment, .punctuation: LF.Palette.graphite
        default: LF.Palette.ink
        }
    }

    static func codeIsBold(_ kind: CodeHighlighter.TokenKind) -> Bool {
        switch kind {
        case .keyword, .literal, .number, .meta, .title, .builtin: true
        default: false
        }
    }
}

/// How far Dynamic Type has scaled each text style the renderer uses. Only the
/// sheared (emphasis) fonts need it; everything else scales by itself.
struct MarkdownTypeScale: Hashable, Sendable {
    enum Style: Hashable, Sendable, CaseIterable {
        case body, callout, subheadline, title2, title3, headline, caption

        var fontStyle: Font.TextStyle {
            switch self {
            case .body: .body
            case .callout: .callout
            case .subheadline: .subheadline
            case .title2: .title2
            case .title3: .title3
            case .headline: .headline
            case .caption: .caption
            }
        }

        #if canImport(UIKit)
        var uiStyle: UIFont.TextStyle {
            switch self {
            case .body: .body
            case .callout: .callout
            case .subheadline: .subheadline
            case .title2: .title2
            case .title3: .title3
            case .headline: .headline
            case .caption: .caption1
            }
        }
        #endif
    }

    private var factors: [Style: CGFloat] = [:]

    /// The default text size (and the Mac, which has no Dynamic Type).
    static let standard = MarkdownTypeScale()

    func factor(_ style: Style) -> CGFloat { factors[style] ?? 1 }

    static func current(_ size: DynamicTypeSize) -> MarkdownTypeScale {
        #if canImport(UIKit)
        guard size != .large else { return .standard }
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(size))
        var scale = MarkdownTypeScale()
        for style in Style.allCases {
            scale.factors[style] = UIFontMetrics(forTextStyle: style.uiStyle).scaledValue(for: 100, compatibleWith: traits) / 100
        }
        return scale
        #else
        return .standard
        #endif
    }
}

enum MarkdownStyler {
    /// Space added after the character before inline code and after its last
    /// character, so the chip drawn behind it has room on both sides.
    static let chipKern: CGFloat = 3.5

    /// Styles every inline container and code block. Returns whether any run
    /// used a sheared font (and so depends on `scale`).
    @discardableResult
    static func style(_ blocks: inout [MarkdownBlock], scale: MarkdownTypeScale) -> Bool {
        var usedScale = false
        for index in blocks.indices {
            style(&blocks[index], scale: scale, usedScale: &usedScale)
        }
        return usedScale
    }

    private static func style(_ block: inout MarkdownBlock, scale: MarkdownTypeScale, usedScale: inout Bool) {
        switch block.kind {
        case .heading(let level, var content, let anchor):
            style(&content, scale: scale, usedScale: &usedScale)
            block.kind = .heading(level: level, content: content, anchor: anchor)
        case .paragraph(var content):
            style(&content, scale: scale, usedScale: &usedScale)
            block.kind = .paragraph(content)
        case .list(var list):
            for item in list.items.indices {
                for index in list.items[item].blocks.indices {
                    style(&list.items[item].blocks[index], scale: scale, usedScale: &usedScale)
                }
            }
            block.kind = .list(list)
        case .quote(var blocks):
            for index in blocks.indices { style(&blocks[index], scale: scale, usedScale: &usedScale) }
            block.kind = .quote(blocks)
        case .callout(let label, var blocks):
            for index in blocks.indices { style(&blocks[index], scale: scale, usedScale: &usedScale) }
            block.kind = .callout(label: label, blocks: blocks)
        case .code(var code):
            code.attributed = highlighted(code, scale: scale, usedScale: &usedScale)
            block.kind = .code(code)
        case .table(var table):
            for column in table.header.indices { style(&table.header[column], scale: scale, usedScale: &usedScale) }
            for row in table.rows.indices {
                for column in table.rows[row].indices { style(&table.rows[row][column], scale: scale, usedScale: &usedScale) }
            }
            block.kind = .table(table)
        case .image, .rule:
            break
        }
    }

    // MARK: Inline

    static func style(_ inline: inout MarkdownInline, scale: MarkdownTypeScale, usedScale: inout Bool) {
        let role = inline.role

        // 1. Runs of text with their attributes. Attribute containers are built once
        //    per kind of run; `AttributedString` mutation is the slow part, so the
        //    strings are only assembled at the end, by appending.
        struct Run {
            var text: Substring
            var attributes: AttributeContainer
            var mark: MarkdownSegmentMark
            /// Which span a marked run came from, so two chips never merge.
            var group: Int
        }
        var runs: [Run] = []
        var cache: [Int: AttributeContainer] = [:]

        func base(code: Bool, traits: MarkdownTraits, image: Bool) -> AttributeContainer {
            let key = Int(traits.rawValue) | (code ? 1 << 8 : 0) | (image ? 1 << 9 : 0)
            if let cached = cache[key] { return cached }
            var container = AttributeContainer()
            if code {
                container.font = MarkdownStyle.codeFont(for: role, traits: traits)
            } else {
                container.font = MarkdownStyle.font(for: role, traits: traits, scale: scale)
                if traits.contains(.italic) { usedScale = true }
            }
            container.foregroundColor = image ? LF.Palette.graphite : MarkdownStyle.color(for: role)
            if let tracking = MarkdownStyle.tracking(for: role), !code {
                container.tracking = tracking
            }
            if traits.contains(.strike) {
                container.strikethroughStyle = Text.LineStyle(pattern: .solid, color: MarkdownStyle.color(for: role))
            }
            cache[key] = container
            return container
        }

        /// Moves the last character of the last run into its own run with extra kerning.
        func kernLastCharacter() {
            guard var last = runs.popLast(), let final = last.text.indices.last else { return }
            var kerned = last.attributes
            kerned.kern = chipKern
            let tail = Run(text: last.text[final...], attributes: kerned, mark: last.mark, group: last.group)
            last.text = last.text[..<final]
            if !last.text.isEmpty { runs.append(last) }
            runs.append(tail)
        }

        for (spanIndex, span) in inline.spans.enumerated() {
            let isCode = span.kind == .code
            var isImage = false
            if case .image = span.kind { isImage = true }
            var attributes = base(code: isCode, traits: span.traits, image: isImage)
            var mark: MarkdownSegmentMark = isCode ? .code : .none

            if let slug = span.glossarySlug, let url = MarkdownLinks.glossaryURL(slug: slug) {
                // Quieter than an author's link: ink with a dotted blue underline.
                attributes.link = url
                attributes.foregroundColor = LF.Palette.ink
                attributes.underlineStyle = Text.LineStyle(pattern: .dot, color: LF.Palette.blue.opacity(0.7))
                mark = .glossary(slug)
            } else if let destination = span.link ?? imageDestination(span), let url = url(from: destination) {
                attributes.link = url
                attributes.foregroundColor = LF.Palette.blue
                attributes.underlineStyle = Text.LineStyle(pattern: .solid, color: LF.Palette.blue.opacity(0.45))
            }

            let text = display(span)
            guard !text.isEmpty else { continue }
            let run = Run(text: Substring(text), attributes: attributes, mark: mark, group: mark == .none ? -1 : spanIndex)
            if isCode {
                // Room on both sides of the chip drawn behind inline code.
                kernLastCharacter()
                runs.append(run)
                kernLastCharacter()
            } else {
                runs.append(run)
            }
        }

        // 2. Group runs into segments: unmarked text merges; each chip or term stands alone.
        var segments: [MarkdownSegment] = []
        var current = AttributedString()
        var currentMark: MarkdownSegmentMark?
        var currentGroup = Int.min
        for run in runs {
            let piece = AttributedString(String(run.text), attributes: run.attributes)
            if let mark = currentMark, mark == run.mark, currentGroup == run.group {
                current.append(piece)
            } else {
                if let mark = currentMark { segments.append(MarkdownSegment(string: current, mark: mark)) }
                current = piece
                currentMark = run.mark
                currentGroup = run.group
            }
        }
        if let mark = currentMark { segments.append(MarkdownSegment(string: current, mark: mark)) }

        inline.isComposed = segments.contains { $0.mark != .none }
        if inline.isComposed {
            inline.segments = segments
        } else {
            inline.attributed = segments.first?.string ?? AttributedString()
        }
    }

    private static func display(_ span: MarkdownSpan) -> String {
        switch span.kind {
        case .image:
            return span.text.isEmpty ? "[image]" : "[\(span.text)]"
        default:
            return span.text
        }
    }

    private static func imageDestination(_ span: MarkdownSpan) -> String? {
        if case .image(let source) = span.kind, !source.isEmpty { return source }
        return nil
    }

    static func url(from destination: String) -> URL? {
        if let url = URL(string: destination) { return url }
        let allowed = CharacterSet.urlFragmentAllowed.union(.urlPathAllowed).union(CharacterSet(charactersIn: "#?:/"))
        return destination.addingPercentEncoding(withAllowedCharacters: allowed).flatMap(URL.init(string:))
    }

    // MARK: Code

    /// A highlighted listing. Comments are graphite and slanted, like the site's.
    static func highlighted(_ code: MarkdownCode, scale: MarkdownTypeScale, usedScale: inout Bool) -> AttributedString {
        let language = CodeHighlighter.Language(info: code.language)
        var regular = AttributeContainer()
        regular.font = LF.Fonts.mono(MarkdownStyle.codeSize, relativeTo: .callout)
        var bold = AttributeContainer()
        bold.font = LF.Fonts.mono(MarkdownStyle.codeSize, weight: .bold, relativeTo: .callout)
        var comment: AttributeContainer?

        var out = AttributedString()
        for token in CodeHighlighter.tokens(code.code, language: language) {
            var attributes: AttributeContainer
            if token.kind == .comment {
                if comment == nil {
                    var container = AttributeContainer()
                    container.font = MarkdownStyle.oblique(.monoRegular, size: MarkdownStyle.codeSize * scale.factor(.callout))
                    comment = container
                    usedScale = true
                }
                attributes = comment ?? regular
            } else {
                attributes = MarkdownStyle.codeIsBold(token.kind) ? bold : regular
            }
            attributes.foregroundColor = MarkdownStyle.codeColor(token.kind)
            out.append(AttributedString(token.text, attributes: attributes))
        }
        return out
    }
}
