import Foundation

/// What the weekly goal shows at one moment of a widget's timeline.
///
/// The snapshot is written by the app, which may not be opened again for days. Its seven-day
/// strip was true when it was written, so the widget moves "today" along the strip at each
/// midnight (UTC for accounts, because the server counts in UTC; this device's time zone for
/// guests), and once that week is over it shows the new calendar week with what this device
/// knows about it, instead of passing last week's count off as this week's.
///
/// Nothing here can make a number go down within a week, and none of the lines threaten
/// anything: they're the site's `rhythmMicrocopy` lines.
nonisolated struct WeekStatus: Hashable, Sendable {
    /// Lessons that make the week (five).
    let goal: Int
    /// Lessons in the window, as far as this device knows.
    let count: Int
    /// "this week" / "your first week"
    let label: String
    /// Seven cells, oldest first.
    let days: [WidgetSnapshot.Day]
    /// One honest line.
    let note: String
    /// Counted on this device (guests), not by the server.
    let onDevice: Bool
    /// The snapshot's week has ended and this is the next one, as far as this device knows.
    let isCarriedOver: Bool

    /// The figure on the site's week meter: the count, capped at the goal.
    var filled: Int { max(0, min(goal, count)) }
    var fraction: Double { goal > 0 ? Double(filled) / Double(goal) : 0 }
    var isCleared: Bool { goal > 0 && count >= goal }
    var remaining: Int { max(0, goal - count) }

    /// "3 of 5 lessons this week"
    var spokenSummary: String {
        "\(filled) of \(goal) lessons \(label)"
    }

    /// "3/5"
    var figure: String { "\(filled)/\(goal)" }
}

nonisolated enum WeekProjection {
    /// `WEEK_GOAL` in `src/lib/streaks.ts`.
    static let defaultGoal = 5

    /// The site's constant weekday table (Sunday first, like `Date.getUTCDay`).
    static let weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    /// Gregorian, Monday-first, in UTC for server-counted weeks and the device's zone for guests.
    static func calendar(onDevice: Bool) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = onDevice ? .current : (TimeZone(secondsFromGMT: 0) ?? .current)
        calendar.firstWeekday = 2
        return calendar
    }

    static func calendar(for snapshot: WidgetSnapshot) -> Calendar {
        calendar(onDevice: snapshot.rhythm?.onDevice ?? true)
    }

    /// The week as it stands at `date`.
    static func status(for snapshot: WidgetSnapshot, at date: Date) -> WeekStatus {
        guard let rhythm = snapshot.rhythm, !rhythm.days.isEmpty else {
            return blankWeek(for: snapshot, at: date)
        }
        let calendar = calendar(onDevice: rhythm.onDevice)
        let generatedDay = calendar.startOfDay(for: snapshot.generatedAt)
        let shift = calendar.dateComponents([.day], from: generatedDay, to: calendar.startOfDay(for: date)).day ?? 0
        let note = rhythm.microcopy ?? line(count: rhythm.windowCount, goal: rhythm.goal, lifetime: snapshot.completedTotal)

        guard shift > 0, let todayIndex = rhythm.days.firstIndex(where: \.isToday) else {
            return WeekStatus(goal: rhythm.goal, count: rhythm.windowCount, label: rhythm.windowLabel,
                              days: rhythm.days, note: note, onDevice: rhythm.onDevice, isCarriedOver: false)
        }

        let newToday = todayIndex + shift
        if newToday < rhythm.days.count {
            // Same week, a later day: move the marker along. Days that were still to come when
            // the snapshot was written have nothing recorded on this device yet.
            let days = rhythm.days.enumerated().map { index, day in
                WidgetSnapshot.Day(label: day.label,
                                   count: index <= todayIndex ? day.count : 0,
                                   isToday: index == newToday,
                                   isFuture: index > newToday)
            }
            return WeekStatus(goal: rhythm.goal, count: rhythm.windowCount, label: rhythm.windowLabel,
                              days: days, note: note, onDevice: rhythm.onDevice, isCarriedOver: false)
        }

        // That window is over. After the first week every window is a Monday-aligned calendar
        // week, which can overlap the end of a first week, so carry over any days we know.
        var known: [DateComponents: Int] = [:]
        for (index, day) in rhythm.days.enumerated() where index <= todayIndex {
            if let date = calendar.date(byAdding: .day, value: index - todayIndex, to: generatedDay) {
                known[dayKey(date, calendar)] = day.count
            }
        }
        let week = calendarWeek(containing: date, calendar: calendar) { known[$0] ?? 0 }
        let count = week.filter { !$0.isFuture }.reduce(0) { $0 + $1.count }
        return WeekStatus(goal: rhythm.goal, count: count, label: "this week", days: week,
                          note: line(count: count, goal: rhythm.goal, lifetime: snapshot.completedTotal),
                          onDevice: rhythm.onDevice, isCarriedOver: true)
    }

    /// The midnights after `date` where the widget should redraw, in the snapshot's calendar.
    static func upcomingMidnights(after date: Date, count: Int, calendar: Calendar) -> [Date] {
        let start = calendar.startOfDay(for: date)
        guard count > 0 else { return [] }
        return (1...count).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
    }

    // MARK: Private

    /// No rhythm in the snapshot (a fresh install, or a guest with nothing done): an empty
    /// calendar week, which is the site's zero state, "a shape to fill".
    private static func blankWeek(for snapshot: WidgetSnapshot, at date: Date) -> WeekStatus {
        let calendar = calendar(onDevice: true)
        let week = calendarWeek(containing: date, calendar: calendar) { _ in 0 }
        return WeekStatus(goal: defaultGoal, count: 0, label: "this week", days: week,
                          note: line(count: 0, goal: defaultGoal, lifetime: snapshot.completedTotal),
                          onDevice: !snapshot.signedIn, isCarriedOver: false)
    }

    private static func calendarWeek(containing date: Date, calendar: Calendar, count: (DateComponents) -> Int) -> [WidgetSnapshot.Day] {
        let today = calendar.startOfDay(for: date)
        let start = calendar.dateInterval(of: .weekOfYear, for: today)?.start ?? today
        return (0..<7).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: start) else { return nil }
            let weekday = calendar.component(.weekday, from: day)
            let label = weekdayLabels[(weekday - 1 + 7) % 7]
            let isFuture = day > today
            return WidgetSnapshot.Day(label: label,
                                      count: isFuture ? 0 : count(dayKey(day, calendar)),
                                      isToday: calendar.isDate(day, inSameDayAs: today),
                                      isFuture: isFuture)
        }
    }

    private static func dayKey(_ date: Date, _ calendar: Calendar) -> DateComponents {
        calendar.dateComponents([.year, .month, .day], from: date)
    }

    /// `rhythmMicrocopy` for a week this device worked out itself.
    private static func line(count: Int, goal: Int, lifetime: Int) -> String {
        if count == 0 {
            return lifetime == 0
                ? "\(goal) lessons in a week is where it starts to stick."
                : "Whenever you're ready, it picks up where you left it."
        }
        if count >= goal { return "Week made. Anything past here is bonus." }
        let remaining = goal - count
        return remaining == 1 ? "One more makes the week." : "\(remaining) more makes the week."
    }
}

extension WidgetSnapshot.Day {
    /// "Monday, today, 2 lessons" for VoiceOver.
    nonisolated var spoken: String {
        let names = ["Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday",
                     "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday"]
        let name = names[label] ?? label
        let state: String
        if isFuture {
            state = "still to come"
        } else {
            state = count == 0 ? "no lessons" : (count == 1 ? "1 lesson" : "\(count) lessons")
        }
        return isToday ? "\(name), today, \(state)" : "\(name), \(state)"
    }
}
