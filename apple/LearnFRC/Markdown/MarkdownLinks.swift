import Foundation

// Link handling shared by the parser (which normalises every destination
// once) and the view (which routes a tapped URL).
//
// Normalised forms:
// - `https://learnfrc.com/...`   any site link, relative or absolute
// - `learnfrc-anchor:<id>`       an in-page `#anchor`
// - `learnfrc-glossary:<slug>`   a glossary auto-link (tap shows the term card)
// - anything else is left as written (external sites, mailto:)

enum MarkdownLinks {
    static let siteHost = "learnfrc.com"
    static let siteBase = "https://learnfrc.com"
    static let anchorScheme = "learnfrc-anchor"
    static let glossaryScheme = "learnfrc-glossary"

    /// One destination as the author wrote it, made absolute where it points at the site.
    static func normalise(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("#") {
            return "\(anchorScheme):\(trimmed.dropFirst())"
        }
        if trimmed.hasPrefix("/") && !trimmed.hasPrefix("//") {
            return siteBase + trimmed
        }
        if trimmed.hasPrefix("//") {
            return "https:" + trimmed
        }
        if let url = URL(string: trimmed), let host = url.host()?.lowercased(),
           host == siteHost || host == "www.\(siteHost)" {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
            components?.scheme = "https"
            components?.host = siteHost
            return components?.string ?? trimmed
        }
        return trimmed
    }

    static func glossaryURL(slug: String) -> URL? {
        URL(string: "\(glossaryScheme):\(slug)")
    }

    /// Glossary slugs the author already linked by hand. Mirrors
    /// `collectExistingGlossaryLinks`, which only sees relative `/glossary/` hrefs.
    static func authorGlossarySlug(rawDestination raw: String) -> String? {
        guard raw.hasPrefix("/glossary/") else { return nil }
        var slug = String(raw.dropFirst("/glossary/".count))
        if let cut = slug.firstIndex(where: { $0 == "#" || $0 == "?" }) {
            slug = String(slug[..<cut])
        }
        return slug
    }

    /// What a tapped link should do.
    enum Target: Equatable {
        case glossaryCard(slug: String)
        case anchor(String)
        /// A learnfrc.com path, split into components (`["guides", "x", "y"]`).
        case site(path: [String], fragment: String?, url: URL)
        case external(URL)
    }

    static func target(for url: URL) -> Target {
        switch url.scheme?.lowercased() {
        case glossaryScheme:
            return .glossaryCard(slug: opaquePart(of: url))
        case anchorScheme:
            return .anchor(opaquePart(of: url))
        case "http", "https":
            if let host = url.host()?.lowercased(), host == siteHost || host == "www.\(siteHost)" {
                let parts = url.path(percentEncoded: false)
                    .split(separator: "/", omittingEmptySubsequences: true)
                    .map(String.init)
                return .site(path: parts, fragment: url.fragment(percentEncoded: false), url: url)
            }
            return .external(url)
        default:
            return .external(url)
        }
    }

    private static func opaquePart(of url: URL) -> String {
        let string = url.absoluteString
        guard let colon = string.firstIndex(of: ":") else { return string }
        let rest = String(string[string.index(after: colon)...])
        return rest.removingPercentEncoding ?? rest
    }
}
