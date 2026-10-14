import Foundation

// Catalog rows, decoded straight from Supabase (snake_case keys). The same
// CodingKeys are used for the on-device cache, so a cached file round-trips.

/// A titled external link (`departments.sources`, `lessons.resources`).
struct SourceLink: Codable, Hashable, Sendable, Identifiable {
    let title: String
    let url: URL

    var id: String { url.absoluteString + "|" + title }

    init(title: String, url: URL) {
        self.title = title
        self.url = url
    }

    private enum CodingKeys: String, CodingKey { case title, url }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let rawURL = (c.flexibleString(forKey: .url) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: rawURL), url.scheme != nil else {
            throw DecodingError.dataCorruptedError(forKey: .url, in: c, debugDescription: "Not a URL: \(rawURL)")
        }
        self.url = url
        let title = (c.flexibleString(forKey: .title) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        self.title = title.isEmpty ? (url.host() ?? rawURL) : title
    }
}

/// One of the eleven departments, with its modules and lesson list.
struct Department: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let slug: String
    let name: String
    let tagline: String?
    let description: String?
    let difficulty: String?
    let estimatedHours: Double?
    let whatYoullLearn: [String]
    let prerequisites: [String]
    let tools: [String]
    let sources: [SourceLink]
    /// Lucide icon name from the database (`Rocket`, `Cog`, ...). See `systemImage`.
    let icon: String
    let sortOrder: Int
    /// Prerequisite modules first, then `sortOrder` (the site's `sortModules`).
    let modules: [Module]

    init(
        id: UUID, slug: String, name: String, tagline: String? = nil, description: String? = nil,
        difficulty: String? = nil, estimatedHours: Double? = nil, whatYoullLearn: [String] = [],
        prerequisites: [String] = [], tools: [String] = [], sources: [SourceLink] = [],
        icon: String = "BookOpen", sortOrder: Int = 0, modules: [Module] = []
    ) {
        self.id = id
        self.slug = slug
        self.name = name
        self.tagline = tagline
        self.description = description
        self.difficulty = difficulty
        self.estimatedHours = estimatedHours
        self.whatYoullLearn = whatYoullLearn
        self.prerequisites = prerequisites
        self.tools = tools
        self.sources = sources
        self.icon = icon
        self.sortOrder = sortOrder
        self.modules = Module.sortedLikeSite(modules)
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, name, tagline, description, difficulty, icon, modules, sources, tools, prerequisites
        case estimatedHours = "estimated_hours"
        case whatYoullLearn = "what_youll_learn"
        case sortOrder = "sort_order"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.requiredUUID(forKey: .id),
            slug: try c.requiredString(forKey: .slug),
            name: try c.requiredString(forKey: .name),
            tagline: c.flexibleString(forKey: .tagline),
            description: c.flexibleString(forKey: .description),
            difficulty: c.flexibleString(forKey: .difficulty),
            estimatedHours: c.flexibleDouble(forKey: .estimatedHours),
            whatYoullLearn: c.stringArray(forKey: .whatYoullLearn),
            prerequisites: c.stringArray(forKey: .prerequisites),
            tools: c.stringArray(forKey: .tools),
            sources: c.lossyArray(SourceLink.self, forKey: .sources),
            icon: c.flexibleString(forKey: .icon) ?? "BookOpen",
            sortOrder: c.flexibleInt(forKey: .sortOrder) ?? 0,
            modules: c.lossyArray(Module.self, forKey: .modules)
        )
    }

    /// Every lesson in course order: modules in site order, lessons by `sortOrder`.
    var lessons: [LessonSummary] { modules.flatMap(\.lessons) }
    var lessonCount: Int { modules.reduce(0) { $0 + $1.lessons.count } }
    var totalMinutes: Int { modules.reduce(0) { $0 + $1.lessons.reduce(0) { $0 + $1.estimatedMinutes } } }
    var webURL: URL { AppConfig.webBase.appending(path: "guides/\(slug)") }
    /// SF Symbol for the database's Lucide icon name.
    var systemImage: String { IconNames.systemImage(forLucide: icon, fallback: "book.closed") }

    /// The certificate's credential id, `LFRC-{SLG}-{lessons}{yy}` (the site's format).
    func credentialID(issuedOn date: Date) -> String {
        let letters = slug.replacingOccurrences(of: "-", with: "").prefix(3).uppercased()
        let total = String(format: "%02d", lessonCount)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = .gmt
        let year = utc.component(.year, from: date) % 100
        return "LFRC-\(letters)-\(total)\(String(format: "%02d", year))"
    }
}

/// A module inside a department.
struct Module: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let departmentID: UUID
    let slug: String
    let title: String
    let overview: String?
    let sortOrder: Int
    let isPrerequisite: Bool
    /// Sorted by `sortOrder`.
    let lessons: [LessonSummary]

    init(
        id: UUID, departmentID: UUID, slug: String, title: String, overview: String? = nil,
        sortOrder: Int = 0, isPrerequisite: Bool = false, lessons: [LessonSummary] = []
    ) {
        self.id = id
        self.departmentID = departmentID
        self.slug = slug
        self.title = title
        self.overview = overview
        self.sortOrder = sortOrder
        self.isPrerequisite = isPrerequisite
        self.lessons = lessons.sorted { $0.sortOrder < $1.sortOrder }
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, title, overview, lessons
        case departmentID = "department_id"
        case sortOrder = "sort_order"
        case isPrerequisite = "is_prerequisite"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.requiredUUID(forKey: .id),
            departmentID: try c.requiredUUID(forKey: .departmentID),
            slug: try c.requiredString(forKey: .slug),
            title: try c.requiredString(forKey: .title),
            overview: c.flexibleString(forKey: .overview),
            sortOrder: c.flexibleInt(forKey: .sortOrder) ?? 0,
            isPrerequisite: c.flexibleBool(forKey: .isPrerequisite) ?? false,
            lessons: c.lossyArray(LessonSummary.self, forKey: .lessons)
        )
    }

    var totalMinutes: Int { lessons.reduce(0) { $0 + $1.estimatedMinutes } }

    /// The site's `sortModules`: prerequisite modules first, then `sort_order`.
    /// Stable, so equal keys keep their database order.
    static func sortedLikeSite(_ modules: [Module]) -> [Module] {
        modules.enumerated().sorted { a, b in
            if a.element.isPrerequisite != b.element.isPrerequisite { return a.element.isPrerequisite }
            if a.element.sortOrder != b.element.sortOrder { return a.element.sortOrder < b.element.sortOrder }
            return a.offset < b.offset
        }.map(\.element)
    }

    /// The site's module labels: prerequisite modules read "Start here", the rest are numbered.
    static func labels(for modules: [Module]) -> [UUID: String] {
        var labels: [UUID: String] = [:]
        var number = 0
        for module in modules {
            if module.isPrerequisite {
                labels[module.id] = "Start here"
            } else {
                number += 1
                labels[module.id] = "Module \(number)"
            }
        }
        return labels
    }
}

/// A lesson as it appears in lists (no body).
struct LessonSummary: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    let moduleID: UUID
    let slug: String
    let title: String
    let summary: String?
    let estimatedMinutes: Int
    let sortOrder: Int
    let youtubeID: String?

    init(
        id: UUID, moduleID: UUID, slug: String, title: String, summary: String? = nil,
        estimatedMinutes: Int = 10, sortOrder: Int = 0, youtubeID: String? = nil
    ) {
        self.id = id
        self.moduleID = moduleID
        self.slug = slug
        self.title = title
        self.summary = summary
        self.estimatedMinutes = estimatedMinutes
        self.sortOrder = sortOrder
        self.youtubeID = youtubeID
    }

    enum CodingKeys: String, CodingKey {
        case id, slug, title, summary
        case moduleID = "module_id"
        case estimatedMinutes = "estimated_minutes"
        case sortOrder = "sort_order"
        case youtubeID = "youtube_id"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let youtube = c.flexibleString(forKey: .youtubeID)?.trimmingCharacters(in: .whitespaces)
        self.init(
            id: try c.requiredUUID(forKey: .id),
            moduleID: try c.requiredUUID(forKey: .moduleID),
            slug: try c.requiredString(forKey: .slug),
            title: try c.requiredString(forKey: .title),
            summary: c.flexibleString(forKey: .summary),
            estimatedMinutes: max(0, c.flexibleInt(forKey: .estimatedMinutes) ?? 10),
            sortOrder: c.flexibleInt(forKey: .sortOrder) ?? 0,
            youtubeID: (youtube?.isEmpty ?? true) ? nil : youtube
        )
    }

    /// `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, when the lesson has a video.
    var thumbnailURL: URL? {
        youtubeID.flatMap { URL(string: "https://i.ytimg.com/vi/\($0)/hqdefault.jpg") }
    }
}

/// One quiz question. `answer` is the 0-based index of the right option.
struct QuizQuestion: Codable, Hashable, Sendable {
    let question: String
    let options: [String]
    let answer: Int
    let explanation: String

    init(question: String, options: [String], answer: Int, explanation: String) {
        self.question = question
        self.options = options
        self.answer = answer
        self.explanation = explanation
    }

    private enum CodingKeys: String, CodingKey { case question, options, answer, explanation }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let options = c.stringArray(forKey: .options)
        guard let answer = c.flexibleInt(forKey: .answer), options.indices.contains(answer) else {
            throw DecodingError.dataCorruptedError(forKey: .answer, in: c, debugDescription: "Answer index out of range")
        }
        self.init(
            question: try c.requiredString(forKey: .question),
            options: options,
            answer: answer,
            explanation: c.flexibleString(forKey: .explanation) ?? ""
        )
    }

    func isCorrect(_ choice: Int?) -> Bool { choice == answer }
}

/// The body of a lesson: markdown, takeaways, resources and the quiz.
struct LessonBody: Codable, Hashable, Sendable, Identifiable {
    let id: UUID
    /// GitHub-flavored Markdown.
    let content: String
    let keyTakeaways: [String]
    let resources: [SourceLink]
    let quiz: [QuizQuestion]
    let verifiedAt: Date?
    let verifiedBy: String?
    let verifiedNote: String?
    let verifiedSources: [String]?
    let youtubeID: String?

    init(
        id: UUID, content: String, keyTakeaways: [String] = [], resources: [SourceLink] = [],
        quiz: [QuizQuestion] = [], verifiedAt: Date? = nil, verifiedBy: String? = nil,
        verifiedNote: String? = nil, verifiedSources: [String]? = nil, youtubeID: String? = nil
    ) {
        self.id = id
        self.content = content
        self.keyTakeaways = keyTakeaways
        self.resources = resources
        self.quiz = quiz
        self.verifiedAt = verifiedAt
        self.verifiedBy = verifiedBy
        self.verifiedNote = verifiedNote
        self.verifiedSources = verifiedSources
        self.youtubeID = youtubeID
    }

    enum CodingKeys: String, CodingKey {
        case id, content, resources, quiz
        case keyTakeaways = "key_takeaways"
        case verifiedAt = "verified_at"
        case verifiedBy = "verified_by"
        case verifiedNote = "verified_note"
        case verifiedSources = "verified_sources"
        case youtubeID = "youtube_id"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let youtube = c.flexibleString(forKey: .youtubeID)?.trimmingCharacters(in: .whitespaces)
        let hasSources = c.contains(.verifiedSources) && (try? c.decodeNil(forKey: .verifiedSources)) == false
        self.init(
            id: try c.requiredUUID(forKey: .id),
            content: c.flexibleString(forKey: .content) ?? "",
            keyTakeaways: c.stringArray(forKey: .keyTakeaways),
            resources: c.lossyArray(SourceLink.self, forKey: .resources),
            quiz: c.lossyArray(QuizQuestion.self, forKey: .quiz),
            verifiedAt: c.flexibleDate(forKey: .verifiedAt),
            verifiedBy: c.flexibleString(forKey: .verifiedBy),
            verifiedNote: c.flexibleString(forKey: .verifiedNote),
            verifiedSources: hasSources ? c.stringArray(forKey: .verifiedSources) : nil,
            youtubeID: (youtube?.isEmpty ?? true) ? nil : youtube
        )
    }

    var isVerified: Bool { verifiedAt != nil }

    /// Grades a full set of answers the way the server does: every question right.
    func passes(_ answers: [Int]) -> Bool {
        answers.count == quiz.count && zip(answers, quiz).allSatisfy { $0 == $1.answer }
    }
}

/// Where a lesson lives: department, module and the lesson itself.
struct LessonLocation: Codable, Hashable, Sendable, Identifiable {
    let department: Department
    let module: Module
    let lesson: LessonSummary

    var id: UUID { lesson.id }

    /// `https://learnfrc.com/guides/{dept}/{module}/{lesson}`
    var webURL: URL {
        AppConfig.webBase.appending(path: "guides/\(department.slug)/\(module.slug)/\(lesson.slug)")
    }

    /// `learnfrc://lesson/<id>`
    var deepLinkURL: URL { AppRoute.lesson(lesson.id).deepLinkURL }

    /// "Department / Module", for crumbs.
    var breadcrumb: String { "\(department.name) / \(module.title)" }

    static func == (lhs: LessonLocation, rhs: LessonLocation) -> Bool {
        lhs.lesson == rhs.lesson && lhs.module.id == rhs.module.id && lhs.department.id == rhs.department.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(lesson)
        hasher.combine(module.id)
        hasher.combine(department.id)
    }
}

/// Lucide names used by the site, mapped to SF Symbols that exist on iOS/macOS 26.
enum IconNames {
    static func systemImage(forLucide name: String, fallback: String = "circle") -> String {
        switch name {
        case "Rocket": "flag.checkered"
        case "Cog": "gearshape.2"
        case "PenTool": "pencil.and.ruler"
        case "Code2": "chevron.left.forwardslash.chevron.right"
        case "Zap": "bolt"
        case "Briefcase": "briefcase"
        case "Camera": "camera"
        case "Trophy": "trophy"
        case "LineChart": "chart.xyaxis.line"
        case "Gamepad2": "gamecontroller"
        case "ShieldCheck": "checkmark.shield"
        case "Wrench": "wrench.and.screwdriver"
        case "BookOpen": "book"
        case "CheckCircle2": "checkmark.circle"
        case "Flame": "flame"
        case "Target": "target"
        case "Medal": "medal"
        case "Star": "star"
        case "GraduationCap": "graduationcap"
        case "Sparkles": "sparkles"
        case "Award": "rosette"
        case "Megaphone": "megaphone"
        case "Coins", "HandCoins": "dollarsign.circle"
        case "Cpu", "CircuitBoard": "cpu"
        case "Bot": "cpu"
        case "Gauge": "gauge.with.dots.needle.50percent"
        case "Radar": "dot.radiowaves.left.and.right"
        case "Wind": "wind"
        case "Box": "shippingbox"
        case "Binoculars": "binoculars"
        case "HardHat": "exclamationmark.triangle"
        default: fallback
        }
    }
}
