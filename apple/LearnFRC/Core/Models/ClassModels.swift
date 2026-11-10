import Foundation

// Live classes (`GET /api/app/classes`, docs/API.md "Live classes"). Classes are taught on
// learnfrc.com by FRC students; the app only lists them and opens each one in
// Safari. There's no video in the app. The list is the site's (`listUpcomingClasses` in
// src/lib/app/classes.ts, the same function learnfrc.com/classes renders from).
//
// Everything decodes leniently: a field the site adds never breaks it, a row that fails to
// decode is dropped rather than the whole reply, and a reply with nothing in it reads as
// "classes aren't open" (`visible: false`), so the app shows nothing about classes.

/// `GET /api/app/classes`.
struct ClassesFeed: Decodable, Hashable, Sendable {
    /// False until classes open on the site (and whenever they're switched off). The app
    /// then shows nothing about classes: no Home card, no "Teach a live class".
    var visible: Bool
    /// Live and upcoming classes, soonest first. Signed in, classes taught by someone the
    /// account blocked, or who blocked it, are already left off.
    var classes: [LiveClass]
    /// How many of `classes` are live right now.
    var liveNow: Int
    /// learnfrc.com/apply/teach, where teachers apply. Nil while classes are hidden.
    var teachURL: URL?
    var version: String?

    static let hidden = ClassesFeed(visible: false, classes: [], liveNow: 0, teachURL: nil, version: nil)

    init(visible: Bool, classes: [LiveClass], liveNow: Int, teachURL: URL?, version: String?) {
        self.visible = visible
        self.classes = classes
        self.liveNow = liveNow
        self.teachURL = teachURL
        self.version = version
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let visible = c.flexibleBool(forKey: AnyCodingKey("visible")) ?? false
        let rows = visible ? c.lossyArray(LiveClass.self, forKey: AnyCodingKey("classes")) : []
        self.init(
            visible: visible,
            classes: rows.sorted { $0.startsAt < $1.startsAt },
            liveNow: c.flexibleInt(forKey: AnyCodingKey("liveNow")) ?? rows.filter(\.isLive).count,
            teachURL: LiveClass.siteURL(c.flexibleString(forKey: AnyCodingKey("teachUrl")))
                ?? (visible ? AppConfig.webBase.appending(path: "apply/teach") : nil),
            version: c.flexibleString(forKey: AnyCodingKey("version"))
        )
    }

    /// learnfrc.com/classes, for Handoff and Share.
    static let webURL = AppConfig.webBase.appending(path: "classes")

    /// The classes still worth showing at `now`: the site drops a class once its hard end
    /// (the scheduled end plus 15 minutes) has passed, and a copy kept in memory does too.
    func current(at now: Date = .now) -> [LiveClass] {
        classes.filter { $0.isLive || $0.endsAt.addingTimeInterval(LiveClass.hardEndGrace) > now }
    }
}

/// One class in the list.
struct LiveClass: Decodable, Hashable, Sendable, Identifiable {
    enum Status: String, Sendable {
        case scheduled, live
    }

    struct Topic: Hashable, Sendable {
        /// `lesson` or `module`.
        let kind: String
        let id: UUID?
        /// The lesson's or module's title: LearnFRC's own words, not the teacher's.
        let title: String
        let url: URL?
    }

    struct Seats: Hashable, Sendable {
        let capacity: Int
        let taken: Int
        let left: Int

        var isFull: Bool { left <= 0 }
    }

    let id: UUID
    /// Written by the teacher.
    let title: String
    /// Written by the teacher. Nil when there's none.
    let description: String?
    let startsAt: Date
    /// The scheduled end (the start plus the length).
    let endsAt: Date
    let durationMinutes: Int
    let status: Status
    /// The teacher's username, for a signed-in viewer only. Signed out it's nil, and the row
    /// says `teacherLabel` instead ("Taught by an FRC student").
    let teacherUsername: String?
    let teacherLabel: String
    let topic: Topic?
    let seats: Seats
    /// The class's page on learnfrc.com, where it's joined. Always a LearnFRC address.
    let webURL: URL
    /// Signed in: whether this account has a seat. Nil signed out.
    let enrolled: Bool?

    var isLive: Bool { status == .live }

    /// The site keeps a class listed until 15 minutes after its scheduled end.
    static let hardEndGrace: TimeInterval = 15 * 60

    init(
        id: UUID, title: String, description: String?, startsAt: Date, endsAt: Date, durationMinutes: Int,
        status: Status, teacherUsername: String?, teacherLabel: String = LiveClass.signedOutTeacherLabel,
        topic: Topic?, seats: Seats, webURL: URL? = nil, enrolled: Bool?
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.durationMinutes = durationMinutes
        self.status = status
        self.teacherUsername = teacherUsername
        self.teacherLabel = teacherLabel
        self.topic = topic
        self.seats = seats
        self.webURL = webURL ?? LiveClass.pageURL(id)
        self.enrolled = enrolled
    }

    /// The site's words for a teacher a signed-out visitor can't see (`TEACHER_LABEL`).
    static let signedOutTeacherLabel = "Taught by an FRC student"

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: AnyCodingKey.self)
        let id = try c.requiredUUID(forKey: AnyCodingKey("id"))
        guard let startsAt = c.flexibleDate(forKey: AnyCodingKey("startsAt")) else {
            throw DecodingError.dataCorruptedError(forKey: AnyCodingKey("startsAt"), in: c, debugDescription: "Expected a date")
        }
        let minutes = max(c.flexibleInt(forKey: AnyCodingKey("durationMinutes")) ?? 0, 0)
        let teacher = try? c.nestedContainer(keyedBy: AnyCodingKey.self, forKey: AnyCodingKey("teacher"))
        let handle = teacher?.flexibleString(forKey: AnyCodingKey("username"))?.trimmingCharacters(in: .whitespacesAndNewlines)
        let label = c.flexibleString(forKey: AnyCodingKey("teacherLabel"))?.trimmingCharacters(in: .whitespacesAndNewlines)
        let description = c.flexibleString(forKey: AnyCodingKey("description"))?.trimmingCharacters(in: .whitespacesAndNewlines)

        var topic: Topic?
        if let t = try? c.nestedContainer(keyedBy: AnyCodingKey.self, forKey: AnyCodingKey("topic")),
           let title = t.flexibleString(forKey: AnyCodingKey("title")), !title.isEmpty {
            topic = Topic(
                kind: t.flexibleString(forKey: AnyCodingKey("kind")) ?? "lesson",
                id: t.flexibleUUID(forKey: AnyCodingKey("id")),
                title: title,
                url: LiveClass.siteURL(t.flexibleString(forKey: AnyCodingKey("url")))
            )
        }

        let s = try? c.nestedContainer(keyedBy: AnyCodingKey.self, forKey: AnyCodingKey("seats"))
        let capacity = s?.flexibleInt(forKey: AnyCodingKey("capacity")) ?? 0
        let taken = s?.flexibleInt(forKey: AnyCodingKey("taken")) ?? 0
        let left = s?.flexibleInt(forKey: AnyCodingKey("left")) ?? max(capacity - taken, 0)

        self.init(
            id: id,
            title: c.flexibleString(forKey: AnyCodingKey("title")) ?? "Live class",
            description: (description?.isEmpty ?? true) ? nil : description,
            startsAt: startsAt,
            endsAt: c.flexibleDate(forKey: AnyCodingKey("endsAt")) ?? startsAt.addingTimeInterval(TimeInterval(minutes * 60)),
            durationMinutes: minutes,
            status: Status(rawValue: c.flexibleString(forKey: AnyCodingKey("status")) ?? "") ?? .scheduled,
            teacherUsername: (handle?.isEmpty ?? true) ? nil : handle,
            teacherLabel: (label?.isEmpty ?? true) ? LiveClass.signedOutTeacherLabel : label!,
            topic: topic,
            seats: Seats(capacity: capacity, taken: taken, left: max(left, 0)),
            webURL: LiveClass.siteURL(c.flexibleString(forKey: AnyCodingKey("url"))),
            enrolled: c.flexibleBool(forKey: AnyCodingKey("enrolled"))
        )
    }

    /// learnfrc.com/classes/<id>.
    static func pageURL(_ id: UUID) -> URL {
        AppConfig.webBase.appending(path: "classes/\(id.uuidString.lowercased())")
    }

    /// `raw` when it's a page on the site the app talks to (learnfrc.com, or the Debug build's
    /// `-LFAPIBase` dev server), else nil. A class link is opened in Safari, so it must never
    /// point anywhere else, whatever the reply says.
    static func siteURL(_ raw: String?) -> URL? {
        guard let raw, let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = url.scheme?.lowercased(), let host = url.host()?.lowercased() else { return nil }
        let allowed = Set([AppConfig.webBase, AppConfig.apiBase].compactMap { $0.host()?.lowercased() })
            .union(["www.learnfrc.com"])
        guard allowed.contains(host) else { return nil }
        guard scheme == "https" || (scheme == "http" && url.host() == AppConfig.apiBase.host() && AppConfig.apiBase.scheme == "http") else {
            return nil
        }
        return url
    }
}

/// What the app sends to report a class (`POST /api/app/reports` with `contentKind: "class"`):
/// the class and its teacher, whose title and description are what's being reported.
struct ReportedClass: Hashable, Sendable, Identifiable {
    let id: UUID
    let title: String

    init(id: UUID, title: String) {
        self.id = id
        self.title = title
    }

    init(_ item: LiveClass) {
        self.init(id: item.id, title: item.title)
    }
}
