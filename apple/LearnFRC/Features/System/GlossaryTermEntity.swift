import AppIntents
import CoreSpotlight
import Foundation

/// A glossary term (from the site's glossary, via `/api/app/reference`) for Shortcuts,
/// Siri and Spotlight. The id is the site's slug, so it matches `/glossary/<slug>`.
struct GlossaryTermEntity: IndexedEntity, Identifiable, Sendable {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(
        name: LocalizedStringResource("Glossary Term"),
        numericFormat: LocalizedStringResource("\(placeholder: .int) glossary terms")
    )
    static let defaultQuery = GlossaryTermEntityQuery()

    /// The site's slug (`brownout`, `swerve-drive`).
    let id: String

    @Property(title: "Term")
    var term: String

    @Property(title: "Abbreviation")
    var abbreviation: String?

    @Property(title: "Category")
    var category: String

    @Property(title: "Definition")
    var definition: String

    /// Other names people use for it (searchable, not shown).
    let alsoCalled: [String]

    init(_ term: GlossaryTerm) {
        id = term.slug
        alsoCalled = term.alsoCalled
        self.term = term.term
        abbreviation = term.abbr
        category = term.category
        definition = term.definition
    }

    /// "Brownout" or "Robot Signal Light (RSL)".
    var displayTitle: String {
        guard let abbreviation, !abbreviation.isEmpty else { return term }
        return "\(term) (\(abbreviation))"
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(displayTitle)",
            subtitle: "\(category)",
            image: DisplayRepresentation.Image(systemName: "character.book.closed")
        )
    }

    var attributeSet: CSSearchableItemAttributeSet {
        let set = defaultAttributeSet
        set.title = displayTitle
        set.displayName = displayTitle
        set.contentDescription = definition
        set.containerTitle = "Glossary"
        set.containerDisplayName = "LearnFRC Glossary"
        var words = [term, category, "FRC", "glossary"] + alsoCalled
        if let abbreviation, !abbreviation.isEmpty { words.append(abbreviation) }
        var seen = Set<String>()
        set.keywords = words.filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
        return set
    }

    /// The prefix Spotlight puts in front of the id (`GlossaryTermEntity/<slug>`).
    static var spotlightTypeName: String { String(describing: Self.self) }
}

/// Finds glossary terms by slug, by typed name (term, abbreviation or "also called"),
/// and suggests every term, A to Z.
struct GlossaryTermEntityQuery: EntityStringQuery {
    @Dependency private var model: AppModel

    init() {}

    @MainActor
    func entities(for identifiers: [GlossaryTermEntity.ID]) async throws -> [GlossaryTermEntity] {
        await IntentSupport.prepareReference(model)
        return identifiers.compactMap { model.reference.term(slug: $0).map(GlossaryTermEntity.init) }
    }

    @MainActor
    func entities(matching string: String) async throws -> [GlossaryTermEntity] {
        await IntentSupport.prepareReference(model)
        return Self.search(string, in: model.reference.glossary).map(GlossaryTermEntity.init)
    }

    @MainActor
    func suggestedEntities() async throws -> [GlossaryTermEntity] {
        await IntentSupport.prepareReference(model)
        return model.reference.glossary
            .sorted { $0.term.localizedCaseInsensitiveCompare($1.term) == .orderedAscending }
            .map(GlossaryTermEntity.init)
    }

    /// Exact names first, then prefixes, then anything containing the text. Pure.
    static func search(_ text: String, in terms: [GlossaryTerm], limit: Int = 20) -> [GlossaryTerm] {
        func fold(_ s: String) -> String { s.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil) }
        let needle = fold(text.trimmingCharacters(in: .whitespacesAndNewlines))
        guard !needle.isEmpty else { return [] }

        var scored: [(term: GlossaryTerm, score: Int)] = []
        for term in terms {
            let names = ([term.term, term.abbr ?? ""] + term.alsoCalled).map(fold).filter { !$0.isEmpty }
            let score: Int
            if names.contains(needle) { score = 3 }
            else if names.contains(where: { $0.hasPrefix(needle) }) { score = 2 }
            else if names.contains(where: { $0.contains(needle) }) { score = 1 }
            else if fold(term.definition).contains(needle) { score = 0 }
            else { continue }
            scored.append((term, score))
        }
        return scored
            .sorted { $0.score != $1.score ? $0.score > $1.score : $0.term.term.localizedCaseInsensitiveCompare($1.term.term) == .orderedAscending }
            .prefix(limit)
            .map(\.term)
    }
}
