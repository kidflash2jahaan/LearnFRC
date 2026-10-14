import AppIntents
import CoreSpotlight
import Foundation

/// A lesson as Shortcuts, Siri and Spotlight see it. Built from the cached catalog, so it
/// works offline and always matches what the app shows.
struct LessonEntity: IndexedEntity, Identifiable, Sendable {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(
        name: LocalizedStringResource("Lesson"),
        numericFormat: LocalizedStringResource("\(placeholder: .int) lessons")
    )
    static let defaultQuery = LessonEntityQuery()

    /// The lesson id (the same id the website uses).
    let id: UUID

    @Property(title: "Title")
    var title: String

    @Property(title: "Department")
    var departmentName: String

    @Property(title: "Module")
    var moduleTitle: String

    @Property(title: "Minutes")
    var minutes: Int

    @Property(title: "Summary")
    var summary: String

    @Property(title: "Link")
    var webURL: URL

    /// SF Symbol for the department (shown next to the lesson in pickers).
    let symbolName: String
    /// Department slug, used to rank search results.
    let departmentSlug: String

    init(_ location: LessonLocation) {
        id = location.lesson.id
        symbolName = location.department.systemImage
        departmentSlug = location.department.slug
        title = location.lesson.title
        departmentName = location.department.name
        moduleTitle = location.module.title
        minutes = location.lesson.estimatedMinutes
        summary = location.lesson.summary ?? ""
        webURL = location.webURL
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "\(departmentName) · \(Self.minutesLabel(minutes))",
            image: DisplayRepresentation.Image(systemName: symbolName)
        )
    }

    /// What Spotlight shows and matches: the title, "Department / Module" and the summary.
    var attributeSet: CSSearchableItemAttributeSet {
        let set = defaultAttributeSet
        set.title = title
        set.displayName = title
        let crumb = "\(departmentName) / \(moduleTitle)"
        set.contentDescription = summary.isEmpty ? crumb : "\(crumb). \(summary)"
        set.containerTitle = departmentName
        set.containerDisplayName = departmentName
        set.keywords = Self.keywords(title: title, department: departmentName, module: moduleTitle)
        // No `url`/`contentURL`: a tapped result must open the app, not the website.
        return set
    }

    /// The prefix Spotlight puts in front of the id in item identifiers (`LessonEntity/<UUID>`).
    static var spotlightTypeName: String { String(describing: Self.self) }

    static func minutesLabel(_ minutes: Int) -> String {
        minutes == 1 ? "1 min" : "\(max(0, minutes)) min"
    }

    private static func keywords(title: String, department: String, module: String) -> [String] {
        var words = ["FRC", "FIRST Robotics", "lesson", department, module]
        // Department names like "Programming, Controls & Sensors" are searched by their parts.
        words += department
            .components(separatedBy: CharacterSet(charactersIn: ",&/"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { $0.count > 2 }
        var seen = Set<String>()
        return words.filter { seen.insert($0.lowercased()).inserted }
    }
}

/// Finds lessons for Shortcuts and Siri: by id, by typed name, and a short list of suggestions
/// (the continue lesson, bookmarks, then what comes after the continue lesson).
struct LessonEntityQuery: EntityStringQuery {
    @Dependency private var model: AppModel

    init() {}

    @MainActor
    func entities(for identifiers: [LessonEntity.ID]) async throws -> [LessonEntity] {
        await IntentSupport.prepareCatalog(model)
        return identifiers.compactMap { model.catalog.location(of: $0).map(LessonEntity.init) }
    }

    @MainActor
    func entities(matching string: String) async throws -> [LessonEntity] {
        await IntentSupport.prepareCatalog(model)
        return Self.search(string, in: model.catalog.allLessons).map(LessonEntity.init)
    }

    @MainActor
    func suggestedEntities() async throws -> [LessonEntity] {
        await IntentSupport.prepareCatalog(model)
        return IntentSupport.suggestedLessons(model).map(LessonEntity.init)
    }

    /// Lessons whose title (then module, then department, then summary) matches every word typed.
    /// Title matches rank first, then course order. Pure, so it's easy to check.
    static func search(_ text: String, in lessons: [LessonLocation], limit: Int = 25) -> [LessonLocation] {
        let words = text
            .lowercased()
            .split(whereSeparator: { $0.isWhitespace || $0.isPunctuation })
            .map(String.init)
            .filter { !$0.isEmpty }
        guard !words.isEmpty else { return [] }

        func fold(_ s: String) -> String { s.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil) }
        let foldedWords = words.map(fold)

        var scored: [(location: LessonLocation, score: Int, order: Int)] = []
        for (order, location) in lessons.enumerated() {
            let title = fold(location.lesson.title)
            let module = fold(location.module.title)
            let department = fold(location.department.name)
            let summary = fold(location.lesson.summary ?? "")
            var score = 0
            var matchedAll = true
            for word in foldedWords {
                if title.hasPrefix(word) { score += 6 }
                else if title.contains(word) { score += 4 }
                else if module.contains(word) { score += 2 }
                else if department.contains(word) { score += 1 }
                else if summary.contains(word) { score += 1 }
                else { matchedAll = false; break }
            }
            if matchedAll { scored.append((location, score, order)) }
        }
        return scored
            .sorted { $0.score != $1.score ? $0.score > $1.score : $0.order < $1.order }
            .prefix(limit)
            .map(\.location)
    }
}
