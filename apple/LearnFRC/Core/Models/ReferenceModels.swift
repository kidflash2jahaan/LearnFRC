import Foundation

// `GET /api/app/reference`: the reference data that lives in the site's
// TypeScript (glossary, learning paths, lesson-to-article links, start goals).

/// A glossary term (`src/lib/glossary-data.ts`, plus its slug).
struct GlossaryTerm: Codable, Hashable, Sendable, Identifiable {
    let term: String
    let abbr: String?
    let category: String
    let definition: String
    /// Primary external source.
    let link: String?
    /// An internal LearnFRC path like "/blog/frc-can-bus", read first when present.
    let internalLink: String?
    /// "Where you'll actually meet this": a hand-written paragraph.
    let inMatch: String?
    let alsoCalled: [String]
    let lessonCues: [String]
    /// Related terms by exact `term`.
    let related: [String]
    /// `/glossary/{slug}`
    let slug: String

    var id: String { slug }

    init(
        term: String, abbr: String? = nil, category: String, definition: String, link: String? = nil,
        internalLink: String? = nil, inMatch: String? = nil, alsoCalled: [String] = [], lessonCues: [String] = [],
        related: [String] = [], slug: String? = nil
    ) {
        self.term = term
        self.abbr = abbr
        self.category = category
        self.definition = definition
        self.link = link
        self.internalLink = internalLink
        self.inMatch = inMatch
        self.alsoCalled = alsoCalled
        self.lessonCues = lessonCues
        self.related = related
        self.slug = slug ?? GlossaryTerm.slug(for: term)
    }

    private enum CodingKeys: String, CodingKey {
        case term, abbr, category, definition, link, internalLink, inMatch, alsoCalled, lessonCues, related, slug
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let term = try c.requiredString(forKey: .term)
        let slug = c.flexibleString(forKey: .slug)
        self.init(
            term: term,
            abbr: c.flexibleString(forKey: .abbr),
            category: c.flexibleString(forKey: .category) ?? "General",
            definition: c.flexibleString(forKey: .definition) ?? "",
            link: c.flexibleString(forKey: .link),
            internalLink: c.flexibleString(forKey: .internalLink),
            inMatch: c.flexibleString(forKey: .inMatch),
            alsoCalled: c.stringArray(forKey: .alsoCalled),
            lessonCues: c.stringArray(forKey: .lessonCues),
            related: c.stringArray(forKey: .related),
            slug: (slug?.isEmpty ?? true) ? nil : slug
        )
    }

    var linkURL: URL? { link.flatMap(URL.init(string:)) }
    /// `https://learnfrc.com/glossary/{slug}`
    var webURL: URL { AppConfig.webBase.appending(path: "glossary/\(slug)") }
    /// "Swerve Drive (SDS)" style title when there's an abbreviation.
    var displayTitle: String { abbr.map { "\(term) (\($0))" } ?? term }

    /// Port of `glossarySlug()`: lowercase, drop `[^\w\s-]`, trim, spaces to `-`.
    static func slug(for term: String) -> String {
        let lowered = term.lowercased()
        let kept = lowered.unicodeScalars.filter { scalar in
            let isWord = (scalar.value >= 0x30 && scalar.value <= 0x39)
                || (scalar.value >= 0x61 && scalar.value <= 0x7A)
                || (scalar.value >= 0x41 && scalar.value <= 0x5A)
                || scalar == "_"
            return isWord || scalar == "-" || CharacterSet.whitespacesAndNewlines.contains(scalar)
        }
        let trimmed = String(String.UnicodeScalarView(kept)).trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.split(whereSeparator: { $0.isWhitespace }).joined(separator: "-")
    }
}

/// A curated learning path (`src/lib/paths-data.ts`). Each step is a department.
struct LearningPath: Codable, Hashable, Sendable, Identifiable {
    struct Step: Codable, Hashable, Sendable, Identifiable {
        let deptSlug: String
        let label: String
        let note: String

        var id: String { deptSlug + "|" + label }

        init(deptSlug: String, label: String, note: String) {
            self.deptSlug = deptSlug
            self.label = label
            self.note = note
        }

        private enum CodingKeys: String, CodingKey { case deptSlug, label, note }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.init(
                deptSlug: try c.requiredString(forKey: .deptSlug),
                label: c.flexibleString(forKey: .label) ?? "",
                note: c.flexibleString(forKey: .note) ?? ""
            )
        }
    }

    let slug: String
    let title: String
    let description: String
    /// Lucide icon name.
    let icon: String
    /// Hex accent used on the site's path pages.
    let color: String
    let outcomes: [String]
    let steps: [Step]

    var id: String { slug }

    init(slug: String, title: String, description: String, icon: String, color: String, outcomes: [String], steps: [Step]) {
        self.slug = slug
        self.title = title
        self.description = description
        self.icon = icon
        self.color = color
        self.outcomes = outcomes
        self.steps = steps
    }

    private enum CodingKeys: String, CodingKey { case slug, title, description, icon, color, outcomes, steps }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            slug: try c.requiredString(forKey: .slug),
            title: try c.requiredString(forKey: .title),
            description: c.flexibleString(forKey: .description) ?? "",
            icon: c.flexibleString(forKey: .icon) ?? "BookOpen",
            color: c.flexibleString(forKey: .color) ?? "#2648D7",
            outcomes: c.stringArray(forKey: .outcomes),
            steps: c.lossyArray(Step.self, forKey: .steps)
        )
    }

    var systemImage: String { IconNames.systemImage(forLucide: icon, fallback: "map") }
    var webURL: URL { AppConfig.webBase.appending(path: "paths/\(slug)") }
}

/// A first-run answer (`START_GOALS` in `src/lib/recommend.ts`), mapped 1:1 to a path.
struct StartGoal: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let blurb: String
    let iconName: String
    let pathSlug: String

    init(id: String, label: String, blurb: String, iconName: String, pathSlug: String) {
        self.id = id
        self.label = label
        self.blurb = blurb
        self.iconName = iconName
        self.pathSlug = pathSlug
    }

    private enum CodingKeys: String, CodingKey { case id, label, blurb, iconName, pathSlug }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.requiredString(forKey: .id),
            label: c.flexibleString(forKey: .label) ?? "",
            blurb: c.flexibleString(forKey: .blurb) ?? "",
            iconName: c.flexibleString(forKey: .iconName) ?? "BookOpen",
            pathSlug: c.flexibleString(forKey: .pathSlug) ?? ""
        )
    }

    var systemImage: String { IconNames.systemImage(forLucide: iconName, fallback: "flag") }
}

/// The whole `/api/app/reference` payload.
struct Reference: Codable, Hashable, Sendable {
    let glossary: [GlossaryTerm]
    let glossaryCategories: [String]
    let paths: [LearningPath]
    /// Lesson id (lowercased uuid string) -> article slugs, "read next".
    let lessonBridge: [String: [String]]
    let startGoals: [StartGoal]
    let version: String

    init(
        glossary: [GlossaryTerm], glossaryCategories: [String], paths: [LearningPath],
        lessonBridge: [String: [String]], startGoals: [StartGoal], version: String
    ) {
        self.glossary = glossary
        self.glossaryCategories = glossaryCategories
        self.paths = paths
        self.lessonBridge = lessonBridge
        self.startGoals = startGoals
        self.version = version
    }

    private enum CodingKeys: String, CodingKey { case glossary, glossaryCategories, paths, lessonBridge, startGoals, version }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let glossary = c.lossyArray(GlossaryTerm.self, forKey: .glossary)
        var categories = c.stringArray(forKey: .glossaryCategories)
        if categories.isEmpty {
            // Keep first-seen order.
            var seen = Set<String>()
            categories = glossary.map(\.category).filter { seen.insert($0).inserted }
        }
        self.init(
            glossary: glossary,
            glossaryCategories: categories,
            paths: c.lossyArray(LearningPath.self, forKey: .paths),
            lessonBridge: Self.decodeBridge(c),
            startGoals: c.lossyArray(StartGoal.self, forKey: .startGoals),
            version: c.flexibleString(forKey: .version) ?? ""
        )
    }

    /// Accepts `{ id: ["slug"] }` (the contract) and the site's raw
    /// `{ id: [{ href: "/blog/slug", ... }] }` shape.
    private static func decodeBridge(_ c: KeyedDecodingContainer<CodingKeys>) -> [String: [String]] {
        guard let nested = try? c.nestedContainer(keyedBy: AnyCodingKey.self, forKey: .lessonBridge) else { return [:] }
        var out: [String: [String]] = [:]
        for key in nested.allKeys {
            guard var list = try? nested.nestedUnkeyedContainer(forKey: key) else { continue }
            var slugs: [String] = []
            while !list.isAtEnd {
                if let slug = try? list.decode(String.self) {
                    slugs.append(Self.articleSlug(fromHrefOrSlug: slug))
                } else if let object = try? list.decode(BridgeObject.self), let slug = object.slug {
                    slugs.append(slug)
                } else {
                    _ = try? list.decode(SkipDecodable.self)
                }
            }
            if !slugs.isEmpty { out[key.stringValue.lowercased()] = slugs }
        }
        return out
    }

    private struct BridgeObject: Decodable {
        let slug: String?
        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            if let slug = c.flexibleString(forKey: AnyCodingKey("slug")) {
                self.slug = slug
            } else if let href = c.flexibleString(forKey: AnyCodingKey("href")) {
                self.slug = Reference.articleSlug(fromHrefOrSlug: href)
            } else {
                self.slug = nil
            }
        }
    }

    fileprivate static func articleSlug(fromHrefOrSlug value: String) -> String {
        guard value.contains("/") else { return value }
        return value.split(separator: "/").last.map(String.init) ?? value
    }

    static let empty = Reference(glossary: [], glossaryCategories: [], paths: [], lessonBridge: [:], startGoals: [], version: "")
}
