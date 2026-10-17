import Foundation
import Observation

/// The answer to the site's one first-run question and the five-lesson plan it gives
/// (learnfrc.com/start), kept on this device.
///
/// The website keeps the answer in a one-year `lf_goal` cookie per browser and never writes
/// it to the account, so the app does the same in `UserDefaults`: the answer lasts a year
/// from the last time it was given, for guests and accounts alike, and survives signing in
/// or out. The plan itself comes from `GET /api/app/start-plan` (with the session when
/// signed in, so finished lessons are skipped like on the site) and is kept beside the
/// answer, so Home shows it offline.
///
/// The site never reshuffles a plan: a finished lesson stays as a ticked row. The app ticks a
/// row the moment `ProgressStore` has the lesson (`isDone`), so the plan doesn't need asking
/// again after every lesson. It's fetched when the answer is given or changed, when it
/// didn't come back before (offline), on Home's pull to refresh (`retry`), and when a lesson
/// on it is no longer in the catalogue.
///
/// One store for every window (`shared`). Views read it with
/// `@Environment(StartPlanStore.self) private var injected: StartPlanStore?` and fall back
/// to `shared`, so previews can hand in a store of their own.
@Observable
@MainActor
final class StartPlanStore {
    static let shared = StartPlanStore()

    /// The saved answer, while it's younger than a year.
    private(set) var saved: SavedStartGoal?
    /// The plan for `saved`, once it has come back.
    private(set) var plan: StartPlan?
    private(set) var isLoading = false
    private(set) var lastError: APIError?
    /// "Not your subteam? Change the route": the question is back on Home until it's answered
    /// again or put away with "Skip for now". Not saved: a relaunch shows the plan again.
    private(set) var isChanging = false
    /// "Skip for now" with no answer yet: Home folds the question down to one line, like the
    /// dashboard's "not sure where to start" card. Saved on this device.
    private(set) var isSkipped = false

    /// The saved answer's id (the site's `START_GOALS` ids: new, code, build, impact, gameday).
    var goalID: String? { saved?.id }

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let api: APIClient?
    @ObservationIgnored private let persists: Bool
    /// Bumped by every new answer, so a slow reply for an old answer is dropped.
    @ObservationIgnored private var generation = 0
    /// The answer the request in flight is for.
    @ObservationIgnored private var loadingGoalID: String?
    /// A plan already fetched again this session because a lesson had left the catalogue.
    @ObservationIgnored private var refetchedForCatalog = false

    private enum Key {
        static let goal = "lf_goal"
        static let plan = "lf_goal_plan"
        static let skipped = "lf_goal_skipped"
    }

    init(defaults: UserDefaults = .standard, api: APIClient? = .shared, persists: Bool = !AppConfig.isRunningPreviews) {
        self.defaults = defaults
        self.api = persists ? api : nil
        self.persists = persists
        guard persists else { return }
        saved = Self.decode(SavedStartGoal.self, from: defaults.data(forKey: Key.goal))
        plan = Self.decode(StartPlan.self, from: defaults.data(forKey: Key.plan))
        isSkipped = defaults.bool(forKey: Key.skipped)
        expireIfNeeded()
        if let plan, plan.goal.id != saved?.id { self.plan = nil }
    }

    // MARK: Reading

    /// A row is done when the site said so or this device's progress has the lesson.
    func isDone(_ lesson: StartPlan.Lesson, progress: ProgressStore) -> Bool {
        lesson.done || progress.isCompleted(lesson.lessonID)
    }

    /// How many of the plan's rows are done.
    func doneCount(_ plan: StartPlan, progress: ProgressStore) -> Int {
        plan.lessons.reduce(0) { $0 + (isDone($1, progress: progress) ? 1 : 0) }
    }

    /// True once every lesson on the plan is done (or the plan came back with none left).
    /// Home stops showing the plan then, and goes back to the usual next lesson.
    func isFinished(_ plan: StartPlan, progress: ProgressStore) -> Bool {
        plan.lessons.allSatisfy { isDone($0, progress: progress) }
    }

    /// The answer has passed its year: forget it, like an expired cookie.
    func expireIfNeeded(now: Date = .now) {
        guard let saved, saved.isExpired(at: now) else { return }
        self.saved = nil
        plan = nil
        persist()
    }

    // MARK: Answering

    /// Saves the answer for a year and fetches its plan. `goalID` should be one of the
    /// reference data's start goals; the site answers an unknown one with the default goal,
    /// and the answer saved is the one the plan came back for.
    func choose(_ goalID: String, signedIn: Bool) async {
        answer(goalID)
        await fetch(goalID, signedIn: signedIn)
    }

    /// The saving half of `choose`, done at once so the screen can change before the plan
    /// comes back: the answer is kept for a year and the question goes away. Follow it with
    /// `loadPlanIfNeeded(signedIn:)` to fetch the plan.
    func answer(_ goalID: String) {
        saved = SavedStartGoal(id: goalID, savedAt: .now)
        if plan?.goal.id != goalID { plan = nil }
        lastError = nil
        isChanging = false
        isSkipped = false
        refetchedForCatalog = false
        persist()
    }

    /// Fetches the plan when there's an answer but no plan for it yet (offline when it was
    /// given, or the plan didn't come back), or when one of its lessons has left the catalogue
    /// (`knownLessons`, nil while the catalogue isn't loaded).
    func loadPlanIfNeeded(signedIn: Bool, knownLessons: Set<UUID>? = nil) async {
        guard let goalID, !isLoading else { return }
        if let plan, plan.goal.id == goalID {
            guard let knownLessons, !refetchedForCatalog,
                  plan.lessons.contains(where: { !knownLessons.contains($0.lessonID) }) else { return }
            refetchedForCatalog = true
        }
        await fetch(goalID, signedIn: signedIn)
    }

    /// The account that was signed in has gone (signed out, or another one signed in): its
    /// ticks leave the cached plan, since they were that account's. The rows stay; this
    /// device's progress ticks them again where it can (`isDone`).
    func dropAccountTicks() {
        guard let plan, plan.lessons.contains(where: \.done) else { return }
        self.plan = StartPlan(
            goal: plan.goal, tailored: plan.tailored, pathSlug: plan.pathSlug, pathTitle: plan.pathTitle, target: plan.target,
            lessons: plan.lessons.map {
                StartPlan.Lesson(lessonID: $0.lessonID, title: $0.title, departmentSlug: $0.departmentSlug,
                                 departmentName: $0.departmentName, moduleSlug: $0.moduleSlug, slug: $0.slug,
                                 minutes: $0.minutes, done: false)
            }
        )
        persist()
    }

    /// "Try again" after a plan didn't come back.
    func retry(signedIn: Bool) async {
        guard let goalID else { return }
        await fetch(goalID, signedIn: signedIn)
    }

    /// "Not your subteam? Change the route" (the site's `/start?change=1`).
    func beginChange() {
        isChanging = true
    }

    /// "Skip for now" while changing: the answer stays as it was.
    func endChange() {
        isChanging = false
    }

    /// "Skip for now" before any answer: the question folds down to one line.
    func skip() {
        isChanging = false
        isSkipped = true
        persist()
    }

    /// "Build my plan" on the folded card: the question opens again.
    func unskip() {
        isSkipped = false
        persist()
    }

    // MARK: Private

    private func fetch(_ goalID: String, signedIn: Bool) async {
        guard let api else { return }
        // One request per answer at a time: Home's own load and an answer's fetch can ask at once.
        if isLoading, loadingGoalID == goalID { return }
        generation += 1
        let turn = generation
        isLoading = true
        loadingGoalID = goalID
        defer {
            if turn == generation {
                isLoading = false
                loadingGoalID = nil
            }
        }
        do {
            let fresh = try await api.startPlan(goal: goalID, signedIn: signedIn)
            guard turn == generation, saved?.id == goalID else { return }
            plan = fresh
            lastError = nil
            if fresh.goal.id != goalID, let saved {
                // The site swapped an unknown answer for its default: keep the one it used.
                self.saved = SavedStartGoal(id: fresh.goal.id, savedAt: saved.savedAt)
            }
            persist()
        } catch {
            guard turn == generation else { return }
            lastError = APIError.from(error)
            Log.sync.info("Start plan for \(goalID, privacy: .public) didn't load: \(APIError.from(error).message, privacy: .public)")
        }
    }

    private func persist() {
        guard persists else { return }
        if let saved, let data = try? JSONCoding.encoder().encode(saved) {
            defaults.set(data, forKey: Key.goal)
        } else {
            defaults.removeObject(forKey: Key.goal)
        }
        if let plan, let data = try? JSONCoding.encoder().encode(plan) {
            defaults.set(data, forKey: Key.plan)
        } else {
            defaults.removeObject(forKey: Key.plan)
        }
        defaults.set(isSkipped, forKey: Key.skipped)
    }

    private static func decode<T: Decodable>(_ type: T.Type, from data: Data?) -> T? {
        guard let data else { return nil }
        return try? JSONCoding.decoder().decode(T.self, from: data)
    }

    // MARK: Previews

    /// A store with a fixed answer and plan, for previews. Never touches the disk or network.
    static func preview(goal: String? = nil, plan: StartPlan? = nil, changing: Bool = false, skipped: Bool = false,
                        loading: Bool = false, error: APIError? = nil) -> StartPlanStore {
        let store = StartPlanStore(persists: false)
        store.saved = goal.map { SavedStartGoal(id: $0, savedAt: .now) }
        store.plan = plan
        store.isChanging = changing
        store.isSkipped = skipped
        store.isLoading = loading
        store.lastError = error
        return store
    }
}
