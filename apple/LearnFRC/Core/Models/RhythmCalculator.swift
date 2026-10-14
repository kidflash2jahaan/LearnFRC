import Foundation

/// A faithful port of `computeRhythm`, `describeRhythm` and `rhythmMicrocopy`
/// from `src/lib/streaks.ts`.
///
/// Used ONLY for guests (no account), whose completions live on this device.
/// For a signed-in account the server computes the rhythm in UTC and the app
/// shows it as sent; never recompute it in the device's timezone.
///
/// Honesty rules carried over from the site: nothing here can go down, there
/// are no deadlines or countdowns, and a gap gets a welcome back, never a guilt line.
enum RhythmCalculator {
    /// Lessons in a week that the data says makes retention stick.
    static let weekGoal = 5
    /// Days in the rhythm window.
    static let weekLength = 7

    private static let dayMS: Double = 86_400_000
    private static let weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    // MARK: Day keys (whole days since 1970-01-01 in the learner's timezone)

    /// Day number of an instant, after adding `tzOffsetMinutes` to UTC.
    static func dayNumber(_ date: Date, tzOffsetMinutes: Int = 0) -> Int {
        let ms = date.timeIntervalSince1970 * 1000 + Double(tzOffsetMinutes) * 60_000
        return Int((ms / dayMS).rounded(.down))
    }

    /// `YYYY-MM-DD` for a day number (proleptic Gregorian, like JS `Date`).
    static func key(forDay day: Int) -> String {
        // Howard Hinnant's civil_from_days.
        let z = day + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        let y = yoe + era * 400 + (m <= 2 ? 1 : 0)
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    /// `dayKey` from streaks.ts.
    static func dayKey(_ date: Date, tzOffsetMinutes: Int = 0) -> String {
        key(forDay: dayNumber(date, tzOffsetMinutes: tzOffsetMinutes))
    }

    /// 0 = Sunday ... 6 = Saturday. 1970-01-01 was a Thursday.
    static func weekdayIndex(ofDay day: Int) -> Int {
        ((day + 4) % 7 + 7) % 7
    }

    static func dayLabel(ofDay day: Int) -> String { weekdayLabels[weekdayIndex(ofDay: day)] }

    // MARK: computeRhythm

    /// - Parameters:
    ///   - completedAt: one timestamp per completed lesson (nil ones are skipped, like an unparsable string in JS).
    ///   - createdAt: anchors the first-week window (the account's created date; for a guest, when they started).
    ///   - now: the clock, passed in (the site's hydration contract).
    ///   - tzOffsetMinutes: minutes to add to UTC for the learner's local day. 0 = UTC.
    static func compute(
        completedAt: [Date?],
        createdAt: Date?,
        now: Date,
        tzOffsetMinutes: Int = 0,
        goal goalOverride: Int? = nil
    ) -> Rhythm {
        let off = tzOffsetMinutes
        let goal = max(1, goalOverride ?? weekGoal)

        // Bucket completions by local calendar day.
        var counts: [Int: Int] = [:]
        var lifetime = 0
        for case let date? in completedAt {
            lifetime += 1
            counts[dayNumber(date, tzOffsetMinutes: off), default: 0] += 1
        }
        let activeDays = counts.keys.sorted()
        let today = dayNumber(now, tzOffsetMinutes: off)

        // Pick the window: signup-anchored first week, else Monday-aligned weeks.
        var windowKind: Rhythm.WindowKind = .week
        var start: Int
        if let createdAt, createdAt <= now {
            let firstStart = dayNumber(createdAt, tzOffsetMinutes: off)
            let firstEnd = firstStart + weekLength - 1
            if today <= firstEnd {
                windowKind = .firstWeek
                start = firstStart
            } else {
                start = today - (weekdayIndex(ofDay: today) + 6) % 7
            }
        } else {
            start = today - (weekdayIndex(ofDay: today) + 6) % 7
        }
        let end = start + weekLength - 1

        // The seven-day strip.
        var days: [DayCell] = []
        var windowCount = 0
        var daysActiveInWindow = 0
        for i in 0..<weekLength {
            let day = start + i
            let count = counts[day] ?? 0
            windowCount += count
            if count > 0 { daysActiveInWindow += 1 }
            let key = key(forDay: day)
            days.append(DayCell(
                key: key,
                label: dayLabel(ofDay: day),
                dayOfMonth: Int(key.suffix(2)) ?? 0,
                count: count,
                isToday: day == today,
                isFuture: day > today
            ))
        }

        // Streaks: a record, never a stake.
        var currentStreak = 0
        if counts[today] != nil || counts[today - 1] != nil {
            var cursor = counts[today] != nil ? today : today - 1
            while counts[cursor] != nil {
                currentStreak += 1
                cursor -= 1
            }
        }

        var bestStreak = 0
        var run = 0
        for (i, day) in activeDays.enumerated() {
            run = (i > 0 && day - activeDays[i - 1] == 1) ? run + 1 : 1
            bestStreak = max(bestStreak, run)
        }

        // Most lessons inside any rolling seven-day span.
        var bestWindow = 0
        for i in activeDays.indices {
            var sum = 0
            for j in i..<activeDays.count {
                if activeDays[j] - activeDays[i] >= weekLength { break }
                sum += counts[activeDays[j]] ?? 0
            }
            bestWindow = max(bestWindow, sum)
        }

        let last = activeDays.last
        let daysSinceLast = last.map { today - $0 }

        var returnedAfterDays: Int?
        if let last, let since = daysSinceLast, since <= 1, activeDays.count >= 2 {
            let gap = last - activeDays[activeDays.count - 2]
            if gap >= 3 { returnedAfterDays = gap }
        }

        let phase: RhythmPhase
        if lifetime == 0 { phase = .new }
        else if windowCount >= goal { phase = .goalMet }
        else if returnedAfterDays != nil { phase = .returning }
        else if windowCount == 0 { phase = .resting }
        else if lifetime == 1 { phase = .firstLesson }
        else { phase = .building }

        let rawPct = Double(windowCount) / Double(goal) * 100
        let pct = rawPct.isFinite ? max(0, min(100, Int((rawPct).rounded(.toNearestOrAwayFromZero)))) : 0

        return Rhythm(
            goal: goal,
            windowKind: windowKind,
            windowLabel: windowKind == .firstWeek ? "your first week" : "this week",
            windowStartKey: key(forDay: start),
            windowEndKey: key(forDay: end),
            windowCount: windowCount,
            remaining: max(0, goal - windowCount),
            pct: pct,
            days: days,
            daysActiveInWindow: daysActiveInWindow,
            lifetime: lifetime,
            activeDays: activeDays.count,
            currentStreak: currentStreak,
            bestStreak: bestStreak,
            bestWindow: bestWindow,
            daysSinceLast: daysSinceLast,
            returnedAfterDays: returnedAfterDays,
            phase: phase
        )
    }

    /// The zero-state rhythm.
    static func empty(now: Date, tzOffsetMinutes: Int = 0) -> Rhythm {
        compute(completedAt: [], createdAt: nil, now: now, tzOffsetMinutes: tzOffsetMinutes)
    }

    // MARK: describeRhythm

    private static func lessons(_ n: Int) -> String { n == 1 ? "1 lesson" : "\(n) lessons" }

    /// Port of `describeRhythm`. Same branches and facts; the site's em dashes
    /// are written as commas, colons or full stops to match the app's copy rules.
    static func describe(_ r: Rhythm) -> RhythmCopy {
        let first = r.windowKind == .firstWeek
        let eyebrow = first ? "Your first week" : "This week"

        switch r.phase {
        case .new:
            return RhythmCopy(
                eyebrow: eyebrow,
                headline: "\(r.goal) lessons is where it sticks",
                body: "Learners who finish \(r.goal) in their first week are about five times more likely to still be learning here three weeks later. One sitting or spread across the week, whichever suits you.",
                cta: "Start your first lesson"
            )
        case .firstLesson:
            return RhythmCopy(
                eyebrow: eyebrow,
                headline: "One down. That was the hard one",
                body: "Starting is the single biggest step there is. \(r.remaining) more \(first ? "this first week" : "this week") is the point where it usually turns into a habit.",
                cta: "Next lesson"
            )
        case .building:
            let second = r.daysActiveInWindow == 1
                ? "Coming back on another day counts for more than doing them all at once."
                : "\(r.daysActiveInWindow) days in. That's the part most people skip."
            return RhythmCopy(
                eyebrow: eyebrow,
                headline: "\(r.remaining) to go\(first ? " this first week" : " this week")",
                body: "\(lessons(r.windowCount)) down. \(second)",
                cta: "Next lesson"
            )
        case .goalMet:
            let best = r.bestWindow > r.windowCount ? "Your best week so far is \(r.bestWindow)." : "This is your best week yet."
            return RhythmCopy(
                eyebrow: eyebrow,
                headline: "\(r.windowCount) cleared\(first ? " in your first week" : " this week") 🎉",
                body: "That's the mark. Everything past here is bonus: carry on if you're enjoying it, stop if you've had enough. \(best)",
                cta: "Keep going"
            )
        case .returning:
            // Deliberately never names the length of the gap.
            let record = "\(lessons(r.lifetime)) completed\(r.bestStreak > 1 ? ", best run \(r.bestStreak) days" : "")"
            let onward = r.remaining > 0
                ? " \(r.remaining) more \(r.remaining == 1 ? "lesson" : "lessons") makes it a full week."
                : ""
            return RhythmCopy(
                eyebrow: "Welcome back",
                headline: "Right where you left it",
                body: "You're at \(record).\(onward)",
                cta: "Pick up where you left off"
            )
        case .resting:
            return RhythmCopy(
                eyebrow: eyebrow,
                headline: "Pick it back up whenever",
                body: "\(lessons(r.lifetime)) completed so far\(r.bestWindow > 0 ? ", best week \(r.bestWindow)" : ""). Come back at whatever pace suits you. The week starts counting again when you do.",
                cta: "Resume learning"
            )
        }
    }

    /// Port of `rhythmMicrocopy`: the one-line version for narrow places (lesson rail, widgets).
    static func microcopy(_ r: Rhythm) -> String {
        switch r.phase {
        case .new: "\(r.goal) lessons in a week is where it starts to stick."
        case .firstLesson: "One down. That was the hard one."
        case .building: r.remaining == 1 ? "One more makes the week." : "\(r.remaining) more makes the week."
        case .goalMet: "Week made. Anything past here is bonus."
        case .returning: "Good to have you back."
        case .resting: "Whenever you're ready, it picks up where you left it."
        }
    }

    /// The device's offset from UTC in minutes right now (guests only).
    static func deviceOffsetMinutes(at date: Date = .now) -> Int {
        TimeZone.current.secondsFromGMT(for: date) / 60
    }
}

extension Rhythm {
    /// The one-line version of the copy (`rhythmMicrocopy`).
    var microcopy: String { RhythmCalculator.microcopy(self) }
}
