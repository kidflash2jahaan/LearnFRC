import Foundation

// `GET /api/app/resources`: what learnfrc.com/resources shows, as data. The toolbox (the
// curated shelves of links) and the works cited (every department's sources). Decoding is
// lossy: an added field never breaks the app, and a link that fails to decode is dropped
// instead of the whole page.

/// The whole resources page.
struct ResourcesPage: Codable, Hashable, Sendable {
    /// One outside link: a title, where it goes, and the host printed beside it.
    struct Link: Codable, Hashable, Sendable, Identifiable {
        let title: String
        let url: URL
        /// The hostname without `www.` (the site's `hostLabel`).
        let host: String
        let note: String?

        var id: String { url.absoluteString + "|" + title }

        init(title: String, url: URL, host: String? = nil, note: String? = nil) {
            self.url = url
            self.title = title
            let given = host?.trimmingCharacters(in: .whitespaces) ?? ""
            self.host = given.isEmpty ? Self.hostLabel(url) : given
            self.note = (note?.isEmpty ?? true) ? nil : note
        }

        private enum CodingKeys: String, CodingKey { case title, url, host, note }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            let raw = (c.flexibleString(forKey: c.firstKey("url", "href")) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard let url = URL(string: raw), let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
                throw DecodingError.dataCorrupted(.init(codingPath: c.codingPath, debugDescription: "Not a web link: \(raw)"))
            }
            let title = (c.flexibleString(forKey: c.firstKey("title", "name", "label")) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            self.init(
                title: title.isEmpty ? Self.hostLabel(url) : title,
                url: url,
                host: c.flexibleString(forKey: AnyCodingKey("host")),
                note: c.flexibleString(forKey: c.firstKey("note", "description"))
            )
        }

        /// The site's `hostLabel`: the hostname with any leading `www.` taken off.
        static func hostLabel(_ url: URL) -> String {
            let host = url.host() ?? url.absoluteString
            return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        }
    }

    /// One shelf of the toolbox: the links for one job.
    struct Shelf: Codable, Hashable, Sendable, Identifiable {
        /// Mono identifier, e.g. `software-programming` (the site's `shelfSlug`).
        let slug: String
        let category: String
        /// One line saying what job the shelf is for.
        let blurb: String
        let links: [Link]

        var id: String { slug }

        init(slug: String? = nil, category: String, blurb: String = "", links: [Link]) {
            let given = slug?.trimmingCharacters(in: .whitespaces) ?? ""
            self.slug = given.isEmpty ? Self.slug(for: category) : given
            self.category = category
            self.blurb = blurb
            self.links = links
        }

        private enum CodingKeys: String, CodingKey { case slug, category, blurb, links }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            let category = c.flexibleString(forKey: c.firstKey("category", "title", "name", "label")) ?? ""
            guard !category.isEmpty else {
                throw DecodingError.dataCorrupted(.init(codingPath: c.codingPath, debugDescription: "A shelf needs a name"))
            }
            self.init(
                slug: c.flexibleString(forKey: AnyCodingKey("slug")),
                category: category,
                blurb: c.flexibleString(forKey: c.firstKey("blurb", "description", "note")) ?? "",
                links: c.lossyArray(Link.self, forKey: c.firstKey("links", "items", "resources"))
            )
        }

        /// The site's `shelfSlug`: lowercase, every run of other characters to one `-`.
        static func slug(for category: String) -> String {
            var out = ""
            var pendingDash = false
            for scalar in category.lowercased().unicodeScalars {
                let isWord = (scalar.value >= 0x30 && scalar.value <= 0x39) || (scalar.value >= 0x61 && scalar.value <= 0x7A)
                if isWord {
                    if pendingDash, !out.isEmpty { out.append("-") }
                    pendingDash = false
                    out.unicodeScalars.append(scalar)
                } else {
                    pendingDash = true
                }
            }
            return out
        }
    }

    /// One department's citations (the works cited table).
    struct DepartmentSources: Codable, Hashable, Sendable, Identifiable {
        let slug: String
        let name: String
        /// The sources the route sent, in the department's own order.
        let sources: [Link]
        /// The department's full count. Equal to `sources.count` unless the route trims.
        let total: Int

        var id: String { slug }

        init(slug: String, name: String, sources: [Link], total: Int? = nil) {
            self.slug = slug
            self.name = name
            self.sources = sources
            self.total = max(total ?? 0, sources.count)
        }

        private enum CodingKeys: String, CodingKey { case slug, name, sources, total }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            let slug = try c.requiredString(forKey: AnyCodingKey("slug"))
            self.init(
                slug: slug,
                name: c.flexibleString(forKey: c.firstKey("name", "title")) ?? slug,
                sources: c.lossyArray(Link.self, forKey: c.firstKey("sources", "links")),
                total: c.flexibleInt(forKey: c.firstKey("total", "count", "sourceCount", "totalSources"))
            )
        }
    }

    /// The toolbox, in the site's shelf order.
    let shelves: [Shelf]
    /// Every department, in the catalogue's order (some may have no sources yet).
    let departments: [DepartmentSources]
    /// How many citations the site prints per department (`SOURCES_PER_DEPT`, six).
    let sourcesPerDepartment: Int

    init(shelves: [Shelf], departments: [DepartmentSources], sourcesPerDepartment: Int = ResourcesPage.defaultSourcesPerDepartment) {
        self.shelves = shelves
        self.departments = departments
        self.sourcesPerDepartment = sourcesPerDepartment
    }

    /// The site's `SOURCES_PER_DEPT`.
    static let defaultSourcesPerDepartment = 6

    private enum CodingKeys: String, CodingKey { case shelves, departments, sourcesPerDepartment }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let perDepartment = c.flexibleInt(forKey: c.firstKey("sourcesPerDepartment", "sourcesPerDept", "perDepartment"))
        self.init(
            shelves: Self.decodeShelves(c),
            departments: c.lossyArray(DepartmentSources.self, forKey: c.firstKey("departments", "sources", "citations")),
            sourcesPerDepartment: perDepartment.flatMap { $0 > 0 ? $0 : nil } ?? Self.defaultSourcesPerDepartment
        )
    }

    /// The toolbox as shelves. The route sends the shelves in page order (`shelves`: slug,
    /// name, blurb) and every link once, in page order, naming its shelf by slug (`toolbox`:
    /// title, url, host, shelf), so the links are grouped back onto their shelves here. A
    /// shelf that carries its own `links` keeps them; a link whose shelf isn't listed gets a
    /// shelf of its own at the end rather than being lost.
    private static func decodeShelves(_ c: KeyedDecodingContainer<AnyCodingKey>) -> [Shelf] {
        let listed = c.lossyArray(Shelf.self, forKey: AnyCodingKey("shelves"))
        let loose = c.lossyArray(ShelvedLink.self, forKey: c.firstKey("toolbox", "links"))

        var order: [String] = []
        var grouped: [String: [Link]] = [:]
        for item in loose {
            if grouped[item.shelf] == nil { order.append(item.shelf) }
            grouped[item.shelf, default: []].append(item.link)
        }

        var shelves = listed.map { shelf in
            Shelf(slug: shelf.slug, category: shelf.category, blurb: shelf.blurb,
                  links: shelf.links + (grouped[shelf.slug] ?? []))
        }
        let known = Set(listed.map(\.slug))
        for slug in order where !known.contains(slug) {
            shelves.append(Shelf(slug: slug.isEmpty ? nil : slug, category: slug.isEmpty ? "Toolbox" : slug, links: grouped[slug] ?? []))
        }
        return shelves.filter { !$0.links.isEmpty }
    }

    /// One toolbox link and the slug of the shelf it sits on.
    private struct ShelvedLink: Decodable, Sendable {
        let link: Link
        let shelf: String

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            link = try Link(from: decoder)
            let raw = c.flexibleString(forKey: c.firstKey("shelf", "shelfSlug", "category")) ?? ""
            // A shelf named rather than slugged still lands on the right shelf.
            shelf = raw.contains(where: { $0.isUppercase || $0 == " " }) ? Shelf.slug(for: raw) : raw
        }
    }

    // MARK: Totals the page prints

    /// Links across every shelf (the masthead's "17 links").
    var totalLinks: Int { shelves.reduce(0) { $0 + $1.links.count } }

    /// Departments with at least one source, in order.
    var departmentsWithSources: [DepartmentSources] { departments.filter { $0.total > 0 && !$0.sources.isEmpty } }

    /// Every cited source (the "168 cited sources" figure).
    var totalSources: Int { departmentsWithSources.reduce(0) { $0 + $1.total } }

    var isEmpty: Bool { shelves.isEmpty && departmentsWithSources.isEmpty }
}
