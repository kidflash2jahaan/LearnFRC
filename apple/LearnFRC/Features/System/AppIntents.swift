import AppIntents
import Foundation
import SwiftUI

// App Intents run inside the app process. They reach the live `AppModel` through
// `@Dependency`, which `SystemServices.install(_:)` registers from the app's `init`.
// Copy follows the site's rules: plain counts, no streak pressure, nothing about what was missed.

// MARK: - Continue my lesson

/// Opens the next lesson the person hasn't finished (the Home screen's continue card).
struct ContinueLessonIntent: AppIntent {
    static let title: LocalizedStringResource = "Continue My Lesson"
    static let description = IntentDescription(
        "Opens the next lesson you haven't finished, right where you left off.",
        categoryName: "Lessons"
    )
    static let supportedModes: IntentModes = .foreground(.immediate)

    @Dependency private var model: AppModel

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        await IntentSupport.prepareForOpening(model)
        if let lesson = model.progress.continueLesson {
            model.open(.lesson(lesson.id))
            return .result(dialog: IntentDialog("\(IntentSupport.sentence("Here's \(lesson.lesson.title)"))"))
        }
        if model.catalog.isLoaded {
            model.selectedTab = .learn
            model.popToRoot(.learn)
            return .result(dialog: "You've finished every lesson. Here are the guides.")
        }
        model.selectedTab = .home
        return .result(dialog: "Opening LearnFRC.")
    }
}

// MARK: - Open a lesson

/// Opens one lesson. Also what Spotlight runs when someone taps a lesson result.
struct OpenLessonIntent: OpenIntent {
    static let title: LocalizedStringResource = "Open Lesson"
    static let description = IntentDescription("Opens a LearnFRC lesson.", categoryName: "Lessons")
    static let supportedModes: IntentModes = .foreground(.immediate)

    @Parameter(title: "Lesson", requestValueDialog: "Which lesson?")
    var target: LessonEntity

    @Dependency private var model: AppModel

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$target)")
    }

    init() {}

    init(lesson: LessonEntity) {
        target = lesson
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        await IntentSupport.prepareCatalog(model)
        model.open(.lesson(target.id))
        return .result()
    }
}

// MARK: - Lessons this week

/// "How many lessons this week?" Answers from the weekly goal without opening the app.
struct LessonsThisWeekIntent: AppIntent {
    static let title: LocalizedStringResource = "Lessons This Week"
    static let description = IntentDescription(
        "Tells you how many lessons you've done this week and how that compares with the weekly goal.",
        categoryName: "Progress"
    )
    static let supportedModes: IntentModes = .background

    @Dependency private var model: AppModel

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog & ShowsSnippetView {
        await IntentSupport.prepareProgress(model)
        guard let rhythm = model.progress.rhythm else {
            return .result(
                value: 0,
                dialog: "Your week isn't available yet. Open LearnFRC once to load it.",
                view: EmptyView()
            )
        }
        let summary = WeekSummary(rhythm: rhythm, onDevice: model.progress.rhythmIsOnDevice)
        return .result(
            value: summary.count,
            dialog: IntentDialog("\(summary.spoken)"),
            view: WeekSnippetView(summary: summary)
        )
    }
}

// MARK: - Glossary

/// Opens a glossary term. Also what Spotlight runs when someone taps a term.
struct OpenGlossaryTermIntent: OpenIntent {
    static let title: LocalizedStringResource = "Open Glossary Term"
    static let description = IntentDescription("Opens a term in the LearnFRC glossary.", categoryName: "Glossary")
    static let supportedModes: IntentModes = .foreground(.immediate)

    @Parameter(title: "Term", requestValueDialog: "Which term?")
    var target: GlossaryTermEntity

    @Dependency private var model: AppModel

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$target)")
    }

    init() {}

    init(term: GlossaryTermEntity) {
        target = term
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        await IntentSupport.prepareReference(model)
        model.open(.glossaryTerm(target.id))
        return .result()
    }
}

/// "What does brownout mean?" Reads the glossary definition without opening the app.
struct DefineTermIntent: AppIntent {
    static let title: LocalizedStringResource = "Define a Term"
    static let description = IntentDescription(
        "Reads the LearnFRC glossary definition of an FRC term.",
        categoryName: "Glossary"
    )
    static let supportedModes: IntentModes = .background

    @Parameter(title: "Term", requestValueDialog: "Which term?")
    var term: GlossaryTermEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Define \(\.$term)")
    }

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let definition = term.definition.trimmingCharacters(in: .whitespacesAndNewlines)
        return .result(
            value: definition,
            dialog: IntentDialog("\(term.displayTitle): \(definition)")
        )
    }
}

// MARK: - Search

/// "Search LearnFRC for swerve." Opens Search with the words filled in.
struct SearchLearnFRCIntent: ShowInAppSearchResultsIntent {
    static let title: LocalizedStringResource = "Search LearnFRC"
    static let description = IntentDescription(
        "Searches lessons, articles and the glossary in LearnFRC.",
        categoryName: "Search"
    )
    static let searchScopes: [StringSearchScope] = [.general]
    static let supportedModes: IntentModes = .foreground(.immediate)

    @Parameter(title: "Search For")
    var criteria: StringSearchCriteria

    @Dependency private var model: AppModel

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        await IntentSupport.prepareCatalog(model)
        model.requestSearch(criteria.term)
        return .result()
    }
}

// MARK: - App Shortcuts

/// The phrases Siri, Spotlight and the Shortcuts app offer with no setup.
struct LearnFRCShortcuts: AppShortcutsProvider {
    static let shortcutTileColor: ShortcutTileColor = .navy

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ContinueLessonIntent(),
            phrases: [
                "Continue my lesson in \(.applicationName)",
                "Continue learning in \(.applicationName)",
                "Pick up where I left off in \(.applicationName)",
                "Open my next \(.applicationName) lesson",
            ],
            shortTitle: "Continue Lesson",
            systemImageName: "book"
        )
        AppShortcut(
            intent: OpenLessonIntent(),
            phrases: [
                "Open \(\.$target) in \(.applicationName)",
                "Open a lesson in \(.applicationName)",
                "Show a \(.applicationName) lesson",
            ],
            shortTitle: "Open a Lesson",
            systemImageName: "book.pages"
        )
        AppShortcut(
            intent: LessonsThisWeekIntent(),
            phrases: [
                "How many lessons this week in \(.applicationName)",
                "How many lessons have I done this week in \(.applicationName)",
                "How's my week in \(.applicationName)",
                "Show my \(.applicationName) week",
            ],
            shortTitle: "Lessons This Week",
            systemImageName: "calendar"
        )
        AppShortcut(
            intent: DefineTermIntent(),
            phrases: [
                "Define \(\.$term) in \(.applicationName)",
                "What does \(\.$term) mean in \(.applicationName)",
                "Look up a term in \(.applicationName)",
            ],
            shortTitle: "Define a Term",
            systemImageName: "character.book.closed"
        )
        AppShortcut(
            intent: SearchLearnFRCIntent(),
            phrases: [
                "Search \(.applicationName)",
                "Search in \(.applicationName)",
            ],
            shortTitle: "Search",
            systemImageName: "magnifyingglass"
        )
    }
}

// MARK: - Getting the model ready

/// Intents can run on a cold launch, before any window has started the stores. They answer
/// from the on-device cache (instant, offline) and leave the network refresh to run in the
/// background; the network is only waited on when nothing has ever been cached.
@MainActor
enum IntentSupport {
    /// The catalog (lessons, departments, articles).
    static func prepareCatalog(_ model: AppModel) async {
        // Returns at once after the first load; waits for one already running.
        await model.loadCache()
        if !model.catalog.isLoaded, model.connectivity.isOnline {
            // Nothing on this device yet: the catalog has to come down once.
            await model.catalog.refresh()
            model.progress.catalogDidChange()
        }
        model.bootstrapInBackground()
    }

    /// The glossary and other reference data.
    static func prepareReference(_ model: AppModel) async {
        await model.loadCache()
        if !model.reference.isLoaded, model.connectivity.isOnline { await model.reference.refresh() }
        model.bootstrapInBackground()
    }

    /// The catalog plus cached progress, for screens an intent is about to open.
    static func prepareForOpening(_ model: AppModel) async {
        await prepareCatalog(model)
        await waitForAccount(model)
    }

    /// Fresh progress for answers (the weekly goal): sends anything queued and re-reads
    /// `/api/app/me/progress` when online (one small request), otherwise uses what's cached.
    static func prepareProgress(_ model: AppModel) async {
        await prepareCatalog(model)
        await waitForAccount(model)
        await model.progress.refresh()
    }

    /// Lessons to offer first in pickers and to Siri: the continue lesson, bookmarks, then
    /// what follows the continue lesson. Falls back to the start of Getting Started.
    static func suggestedLessons(_ model: AppModel, limit: Int = 12) -> [LessonLocation] {
        var out: [LessonLocation] = []
        var seen = Set<UUID>()
        func add(_ location: LessonLocation?) {
            guard let location, out.count < limit, seen.insert(location.id).inserted else { return }
            out.append(location)
        }
        let next = model.progress.continueLesson
        add(next)
        model.progress.bookmarkedLessons.prefix(5).forEach(add)
        if let next {
            var cursor = next.id
            while out.count < limit, let following = model.catalog.nextLesson(after: cursor) {
                if !model.progress.isCompleted(following.id) { add(following) }
                cursor = following.id
            }
        }
        if out.isEmpty, let first = model.catalog.firstLesson {
            add(first)
            var cursor = first.id
            while out.count < limit, let following = model.catalog.nextLesson(after: cursor) {
                add(following)
                cursor = following.id
            }
        }
        return out
    }

    /// Ends a sentence with a full stop unless it already ends with one ("Here's What Is FIRST?").
    nonisolated static func sentence(_ text: String) -> String {
        guard let last = text.last else { return text }
        return ".?!".contains(last) ? text : text + "."
    }

    /// Account restore takes a moment on a cold launch; progress depends on knowing who's signed in.
    /// The cache load restores the stored session, so this rarely has to wait.
    private static func waitForAccount(_ model: AppModel) async {
        await model.loadCache()
        await waitUntil {
            if case .loading = model.account.state { return false }
            return true
        }
    }

    /// Polls a condition for up to `timeout`.
    private static func waitUntil(timeout: Duration = .seconds(3), _ condition: @MainActor () -> Bool) async {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while !condition(), clock.now < deadline {
            try? await Task.sleep(for: .milliseconds(50))
        }
    }
}
