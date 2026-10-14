import Foundation
import WidgetKit

/// The kinds the app can pass to `WidgetCenter.shared.reloadTimelines(ofKind:)`.
nonisolated enum LearnFRCWidgetKind {
    static let continueLearning = "com.learnfrc.widgets.continue-learning"
    static let weeklyGoal = "com.learnfrc.widgets.weekly-goal"
    static let overview = "com.learnfrc.widgets.overview"
}

/// One moment of a LearnFRC widget: the app's last snapshot and the week as it stands then.
nonisolated struct LearnFRCEntry: TimelineEntry, Sendable {
    let date: Date
    let snapshot: WidgetSnapshot
    let week: WeekStatus
    /// Example content (the widget gallery, or a Mac build without the App Group).
    let isSample: Bool

    init(snapshot: WidgetSnapshot, date: Date = .now, isSample: Bool = false) {
        self.date = date
        self.snapshot = snapshot
        self.week = WeekProjection.status(for: snapshot, at: date)
        self.isSample = isSample
    }

    /// The lesson to open, worded for a widget.
    var upNext: UpNext { UpNext(snapshot: snapshot) }
}

/// The "continue" lesson, worded for a widget.
nonisolated struct UpNext: Hashable, Sendable {
    let title: String
    let department: String
    let module: String
    let minutes: Int?
    let url: URL
    /// Nothing completed yet: this is where the person starts.
    let isFirst: Bool
    /// The app hasn't chosen a lesson (catalog still loading on first launch).
    let isPlaceholder: Bool

    init(snapshot: WidgetSnapshot) {
        if let lesson = snapshot.continueLesson {
            title = lesson.title
            department = lesson.departmentName
            module = lesson.moduleTitle
            minutes = lesson.minutes > 0 ? lesson.minutes : nil
            url = lesson.url
            isPlaceholder = false
        } else {
            title = "Pick your next lesson"
            department = ""
            module = ""
            minutes = nil
            url = WidgetSnapshot.homeURL
            isPlaceholder = true
        }
        isFirst = snapshot.completedTotal == 0
    }

    /// The pen-stroke label above the title.
    var kicker: String {
        if isPlaceholder { return "learnfrc" }
        return isFirst ? "start here" : "up next"
    }

    /// The button's words.
    var action: String {
        if isPlaceholder { return "Open" }
        return isFirst ? "Start" : "Continue"
    }

    /// "40 min"
    var minutesText: String? { minutes.map { "\($0) min" } }

    /// "Programming, Controls & Sensors / Autonomous: Odometry..."
    /// Empty when there's no lesson yet.
    var crumb: String {
        [department, module].filter { !$0.isEmpty }.joined(separator: " / ")
    }

    var spokenSummary: String {
        if isPlaceholder { return "Pick your next lesson in LearnFRC." }
        let lead = isFirst ? "Start here" : "Up next"
        let length = minutes.map { ", \($0) minutes" } ?? ""
        return "\(lead): \(title). \(department)\(length)."
    }
}

extension WidgetSnapshot {
    /// The same content as if it had been written at `date`, so example content shows a
    /// current week instead of one that ended long ago.
    nonisolated func redated(to date: Date) -> WidgetSnapshot {
        WidgetSnapshot(generatedAt: date, continueLesson: continueLesson, rhythm: rhythm, xp: xp,
                       level: level, completedTotal: completedTotal, signedIn: signedIn)
    }
}

/// Where the widgets get their snapshot.
nonisolated enum SnapshotSource {
    /// The app's last snapshot. With no App Group (Mac builds without a team) or for the widget
    /// gallery, the sample; with an App Group but nothing written yet (installed, never
    /// opened), the true fresh-install state rather than someone else's progress.
    static func load(forGallery: Bool) -> (snapshot: WidgetSnapshot, isSample: Bool) {
        if let snapshot = WidgetSnapshot.read() { return (snapshot, false) }
        if forGallery || WidgetSnapshot.fileURL == nil { return (WidgetSnapshot.sample.redated(to: .now), true) }
        return (WidgetSnapshot.empty.redated(to: .now), false)
    }
}

/// One provider for every LearnFRC widget: the snapshot never changes between app writes, but
/// the week does at midnight, so the timeline carries an entry for each of the next seven.
/// The app reloads every timeline after it writes a new snapshot.
nonisolated struct SnapshotProvider: TimelineProvider {
    func placeholder(in context: Context) -> LearnFRCEntry {
        LearnFRCEntry(snapshot: WidgetSnapshot.sample.redated(to: .now), isSample: true)
    }

    func getSnapshot(in context: Context, completion: @escaping @Sendable (LearnFRCEntry) -> Void) {
        let source = SnapshotSource.load(forGallery: context.isPreview)
        completion(LearnFRCEntry(snapshot: source.snapshot, isSample: source.isSample))
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<LearnFRCEntry>) -> Void) {
        completion(Self.timeline(from: SnapshotSource.load(forGallery: false), now: .now))
    }

    static func timeline(from source: (snapshot: WidgetSnapshot, isSample: Bool), now: Date) -> Timeline<LearnFRCEntry> {
        let calendar = WeekProjection.calendar(for: source.snapshot)
        let dates = [now] + WeekProjection.upcomingMidnights(after: now, count: 7, calendar: calendar)
        let entries = dates.map { LearnFRCEntry(snapshot: source.snapshot, date: $0, isSample: source.isSample) }
        return Timeline(entries: entries, policy: .atEnd)
    }
}
