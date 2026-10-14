import Foundation
import WidgetKit

/// Example snapshots for the widget previews. The extension can't see the app's `PreviewData`,
/// so these use `WidgetSnapshot.sample` / `.empty` from `Shared/` plus a few more states, all
/// with real lesson titles and the site's real copy.
nonisolated enum WidgetPreviewData {
    /// Wednesday 14 October 2026, 15:00 UTC: the "today" in every example strip below.
    static let wednesday = Date(timeIntervalSince1970: 1_791_990_000)

    /// 3 of 5 on a Wednesday, signed in.
    static let sample = WidgetSnapshot.sample.redated(to: wednesday)

    /// A fresh install: nothing done, the first lesson of Getting Started.
    static let empty = WidgetSnapshot.empty.redated(to: wednesday)

    /// Six lessons by Thursday: the week is made.
    static let goalMet = WidgetSnapshot(
        generatedAt: wednesday.addingTimeInterval(86_400),
        continueLesson: .init(
            id: UUID(uuidString: "4d0c535a-cc19-4a24-b828-1596ab526a3f")!,
            title: "VS Code, the WPILib Extension, and Deploying Code",
            departmentName: "Programming, Controls & Sensors",
            moduleTitle: "Foundations: Tools, Languages, and Your First Robot Program",
            minutes: 40
        ),
        rhythm: .init(
            goal: 5, windowCount: 6, windowLabel: "this week", currentStreak: 3,
            days: [
                .init(label: "Mon", count: 2, isToday: false, isFuture: false),
                .init(label: "Tue", count: 0, isToday: false, isFuture: false),
                .init(label: "Wed", count: 1, isToday: false, isFuture: false),
                .init(label: "Thu", count: 3, isToday: true, isFuture: false),
                .init(label: "Fri", count: 0, isToday: false, isFuture: true),
                .init(label: "Sat", count: 0, isToday: false, isFuture: true),
                .init(label: "Sun", count: 0, isToday: false, isFuture: true),
            ],
            microcopy: "Week made. Anything past here is bonus."
        ),
        xp: 540, level: 6, completedTotal: 41, signedIn: true
    )

    /// A guest in their first week (signed up on a Monday), counted on this device.
    static let firstWeekGuest = WidgetSnapshot(
        generatedAt: wednesday,
        continueLesson: .init(
            id: UUID(uuidString: "d83e1d25-61d6-439f-93d7-b0402ac39b74")!,
            title: "What FRC Actually Costs: The Big Picture",
            departmentName: "Business, Operations & Fundraising",
            moduleTitle: "Understanding the Cost of an FRC Team",
            minutes: 25
        ),
        rhythm: .init(
            goal: 5, windowCount: 1, windowLabel: "your first week", currentStreak: 1,
            days: [
                .init(label: "Mon", count: 0, isToday: false, isFuture: false),
                .init(label: "Tue", count: 0, isToday: false, isFuture: false),
                .init(label: "Wed", count: 1, isToday: true, isFuture: false),
                .init(label: "Thu", count: 0, isToday: false, isFuture: true),
                .init(label: "Fri", count: 0, isToday: false, isFuture: true),
                .init(label: "Sat", count: 0, isToday: false, isFuture: true),
                .init(label: "Sun", count: 0, isToday: false, isFuture: true),
            ],
            microcopy: "One down. That was the hard one.",
            onDevice: true
        ),
        xp: 0, level: 1, completedTotal: 1, signedIn: false
    )

    /// The longest kind of title the catalog has.
    static let longTitle = WidgetSnapshot(
        generatedAt: wednesday,
        continueLesson: goalMet.continueLesson,
        rhythm: WidgetSnapshot.sample.rhythm,
        xp: 245, level: 3, completedTotal: 19, signedIn: true
    )

    /// The app hasn't chosen a lesson yet (first launch, catalog still loading).
    static let noLesson = WidgetSnapshot(
        generatedAt: wednesday, continueLesson: nil, rhythm: nil,
        xp: 0, level: 1, completedTotal: 0, signedIn: false
    )

    /// An entry `daysLater` days after the snapshot was written, to see the strip move along
    /// and the week roll over.
    static func entry(_ snapshot: WidgetSnapshot, daysLater: Int = 0) -> LearnFRCEntry {
        LearnFRCEntry(snapshot: snapshot, date: snapshot.generatedAt.addingTimeInterval(Double(daysLater) * 86_400))
    }
}
