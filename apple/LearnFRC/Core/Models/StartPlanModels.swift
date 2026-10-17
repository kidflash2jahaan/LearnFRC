import Foundation

// `GET /api/app/start-plan?goal=`: the five-lesson starter plan for one answer to the
// site's one first-run question (learnfrc.com/start, `getStarterPlan` in
// `src/lib/recommend.ts`). Decoding is lossy, so a field the site adds later never breaks
// the app, and a lesson that fails to decode is dropped instead of the whole plan.

/// The plan for one start goal: the route it follows and the lessons to open, in order.
struct StartPlan: Codable, Hashable, Sendable {
    /// The answer the plan was built for (`START_GOALS` in `src/lib/recommend.ts`).
    struct Goal: Codable, Hashable, Sendable {
        let id: String
        let label: String
        let blurb: String
        let pathSlug: String

        init(id: String, label: String, blurb: String, pathSlug: String) {
            self.id = id
            self.label = label
            self.blurb = blurb
            self.pathSlug = pathSlug
        }

        private enum CodingKeys: String, CodingKey { case id, label, blurb, pathSlug }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.init(
                id: try c.requiredString(forKey: .id),
                label: c.flexibleString(forKey: .label) ?? "",
                blurb: c.flexibleString(forKey: .blurb) ?? "",
                pathSlug: c.flexibleString(forKey: .pathSlug) ?? ""
            )
        }
    }

    /// One lesson on the plan. `done` is only ever true when the server says so; the app
    /// also ticks a row the moment `ProgressStore` has the lesson (see `StartPlanStore`).
    struct Lesson: Codable, Hashable, Sendable, Identifiable {
        let lessonID: UUID
        let title: String
        let departmentSlug: String
        /// The department's name as the site prints it under the lesson.
        let departmentName: String?
        let moduleSlug: String
        let slug: String
        /// The real read time from the word count (the number the lesson page prints).
        let minutes: Int?
        /// Finished by the signed-in account, as the site ticks it. Always false without a token.
        let done: Bool

        var id: UUID { lessonID }

        init(lessonID: UUID, title: String, departmentSlug: String, departmentName: String? = nil, moduleSlug: String,
             slug: String, minutes: Int? = nil, done: Bool = false) {
            self.lessonID = lessonID
            self.title = title
            self.departmentSlug = departmentSlug
            self.departmentName = (departmentName?.isEmpty ?? true) ? nil : departmentName
            self.moduleSlug = moduleSlug
            self.slug = slug
            self.minutes = minutes
            self.done = done
        }

        private enum CodingKeys: String, CodingKey {
            case lessonID = "lessonId", title, departmentSlug, departmentName, moduleSlug, slug, minutes, done
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: AnyCodingKey.self)
            guard let id = c.flexibleUUID(forKey: c.firstKey("lessonId", "id")) else {
                throw DecodingError.dataCorrupted(.init(codingPath: c.codingPath, debugDescription: "Expected a lesson id"))
            }
            let minutes = c.flexibleInt(forKey: c.firstKey("minutes", "readMins", "readMinutes"))
            self.init(
                lessonID: id,
                title: c.flexibleString(forKey: AnyCodingKey("title")) ?? "",
                departmentSlug: c.flexibleString(forKey: c.firstKey("departmentSlug", "deptSlug")) ?? "",
                departmentName: c.flexibleString(forKey: c.firstKey("departmentName", "deptName")),
                moduleSlug: c.flexibleString(forKey: AnyCodingKey("moduleSlug")) ?? "",
                slug: c.flexibleString(forKey: c.firstKey("slug", "lessonSlug")) ?? "",
                minutes: minutes.flatMap { $0 > 0 ? $0 : nil },
                done: c.flexibleBool(forKey: AnyCodingKey("done")) ?? false
            )
        }
    }

    let goal: Goal
    /// False when the site used its default plan because the answer it was sent was
    /// missing or unknown. The plan then offers "Tell us what you do and we'll cut this to
    /// fit" instead of "Not your subteam? Change the route".
    let tailored: Bool
    let pathSlug: String
    let pathTitle: String
    /// How long the plan is meant to be (the site's `STARTER_TARGET`, five).
    let target: Int
    /// In plan order. Finished lessons stay as ticked rows (`done`), never swapped out.
    let lessons: [Lesson]

    init(goal: Goal, tailored: Bool = true, pathSlug: String, pathTitle: String, target: Int = StartPlan.defaultTarget,
         lessons: [Lesson]) {
        self.goal = goal
        self.tailored = tailored
        self.pathSlug = pathSlug
        self.pathTitle = pathTitle
        self.target = target
        self.lessons = lessons
    }

    /// The site's `STARTER_TARGET`: five is the measured retention threshold.
    static let defaultTarget = 5

    private enum CodingKeys: String, CodingKey { case goal, tailored, pathSlug, pathTitle, target, lessons }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let goal = try c.decode(Goal.self, forKey: .goal)
        let pathSlug = c.flexibleString(forKey: .pathSlug) ?? goal.pathSlug
        let target = c.flexibleInt(forKey: .target) ?? Self.defaultTarget
        self.init(
            goal: goal,
            tailored: c.flexibleBool(forKey: .tailored) ?? true,
            pathSlug: pathSlug.isEmpty ? goal.pathSlug : pathSlug,
            pathTitle: c.flexibleString(forKey: .pathTitle) ?? "",
            target: target > 0 ? target : Self.defaultTarget,
            lessons: c.lossyArray(Lesson.self, forKey: .lessons)
        )
    }
}

/// The answer saved on this device, like the site's one-year `lf_goal` cookie.
struct SavedStartGoal: Codable, Hashable, Sendable {
    let id: String
    let savedAt: Date

    /// The cookie's `START_GOAL_MAX_AGE`: a year keeps the answer through one whole season.
    static let maxAge: TimeInterval = 60 * 60 * 24 * 365

    var expiresAt: Date { savedAt.addingTimeInterval(Self.maxAge) }

    func isExpired(at now: Date = .now) -> Bool { now >= expiresAt }
}
