import Foundation
import Observation
import Synchronization
import UserNotifications
#if os(iOS)
import UIKit
#endif

/// Whether this app may show notifications.
enum ReminderPermission: String, Sendable, Hashable {
    /// Never asked.
    case notDetermined
    /// Allowed (including quiet "deliver quietly" delivery).
    case allowed
    /// Turned off in Settings. Only the person can turn it back on.
    case denied

    var allowsDelivery: Bool { self == .allowed }
}

/// One reminder on one day, ready to hand to the notification center.
struct PlannedReminder: Sendable, Hashable, Identifiable {
    /// `com.learnfrc.reminder.2026-10-14`
    let id: String
    /// Year, month, day, hour and minute in the device's time zone at delivery.
    let components: DateComponents
    let fireDate: Date
    let title: String
    let body: String
    /// Where a tap goes (`learnfrc://lesson/<id>` or `learnfrc://continue`).
    let link: URL
}

/// What a reminder is about.
enum ReminderContent: Sendable, Hashable {
    /// The person's continue lesson.
    case lesson(id: UUID, title: String, departmentName: String, moduleTitle: String, minutes: Int, isFirstLesson: Bool)
    /// The catalog isn't on this device yet; point at "continue" and let the app resolve it.
    case generic
    /// Every lesson is done. Nothing to remind anyone about, so nothing is scheduled.
    case allDone
}

// MARK: - Planning (pure)

/// Works out which reminders to schedule. No side effects, so it's easy to check.
///
/// Rules (the site's honesty rules applied to notifications):
/// - At most one a day, at the time the person picked, on the days they picked.
/// - Not today if they've already done a lesson today, or if the time has passed.
/// - Dated one-offs for the next `horizonDays`, refreshed every time the app opens. Someone who
///   steps away for two weeks stops hearing from us until they come back.
/// - Copy names the next lesson and how long it takes. No counts of missed days, no streaks,
///   no "don't lose", no deadlines.
enum ReminderPlanner {
    static let identifierPrefix = "com.learnfrc.reminder."
    static let horizonDays = 14

    static func plan(
        now: Date,
        calendar: Calendar,
        hour: Int,
        minute: Int,
        weekdays: Set<Int>,
        studiedToday: Bool,
        content: ReminderContent,
        horizonDays: Int = ReminderPlanner.horizonDays
    ) -> [PlannedReminder] {
        if case .allDone = content { return [] }
        guard !weekdays.isEmpty, (0...23).contains(hour), (0...59).contains(minute) else { return [] }

        let startOfToday = calendar.startOfDay(for: now)
        var out: [PlannedReminder] = []
        for offset in 0..<max(0, horizonDays) {
            guard let day = calendar.date(byAdding: .day, value: offset, to: startOfToday) else { continue }
            let weekday = calendar.component(.weekday, from: day)
            guard weekdays.contains(weekday) else { continue }
            guard let fire = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) else { continue }
            if offset == 0 && (studiedToday || fire <= now) { continue }

            var components = calendar.dateComponents([.year, .month, .day], from: day)
            components.hour = hour
            components.minute = minute

            let copy = text(for: content, variant: calendar.ordinality(of: .day, in: .era, for: day) ?? offset)
            out.append(PlannedReminder(
                id: identifierPrefix + dayKey(components),
                components: components,
                fireDate: fire,
                title: copy.title,
                body: copy.body,
                link: copy.link
            ))
        }
        return out
    }

    /// The words. `variant` rotates the phrasing day to day so it doesn't read like a robot.
    static func text(for content: ReminderContent, variant: Int) -> (title: String, body: String, link: URL) {
        switch content {
        case .lesson(let id, let title, let department, let module, let minutes, let isFirst):
            let link = AppRoute.lesson(id).deepLinkURL
            let about = aboutMinutes(minutes)
            if isFirst {
                return ("Your first lesson", sentence(title, about) + " Start whenever suits you.", link)
            }
            switch abs(variant) % 3 {
            case 0:
                return ("Next up: \(title)", sentence(department, about), link)
            case 1:
                return (title, sentence("It picks up right where you left off", about), link)
            default:
                return ("Ready when you are", sentence("\u{201C}\(title)\u{201D} is next in \(module)", about), link)
            }
        case .generic, .allDone:
            return ("Ready when you are", "Your next lesson picks up right where you left off.", WidgetSnapshot.continueURL)
        }
    }

    /// "About 40 minutes", "About a minute", or nil when the length isn't known.
    static func aboutMinutes(_ minutes: Int) -> String? {
        guard minutes > 0 else { return nil }
        return minutes == 1 ? "About a minute" : "About \(minutes) minutes"
    }

    /// Joins clauses into sentences: ("A", "B") -> "A. B."; ("A", nil) -> "A."
    private static func sentence(_ first: String, _ second: String?) -> String {
        let a = terminated(first)
        guard let second, !second.isEmpty else { return a }
        return a + " " + terminated(second)
    }

    /// Adds a full stop unless the text already ends a sentence ("What Is FIRST?").
    private static func terminated(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard let last = trimmed.last else { return trimmed }
        return ".?!".contains(last) ? trimmed : trimmed + "."
    }

    private static func dayKey(_ c: DateComponents) -> String {
        String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

// MARK: - The notification center, behind a seam

/// The few notification-center calls the scheduler makes, so previews never touch the real one.
struct ReminderCenterClient: Sendable {
    var permission: @Sendable () async -> ReminderPermission
    var requestPermission: @Sendable () async -> ReminderPermission
    /// Replaces every pending LearnFRC reminder with `plan` and clears delivered ones
    /// (yesterday's reminder sitting in Notification Center is just clutter).
    var replace: @Sendable (_ plan: [PlannedReminder]) async -> Void

    static let live = ReminderCenterClient(
        permission: {
            await LiveCenter.permission()
        },
        requestPermission: {
            let center = UNUserNotificationCenter.current()
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .providesAppNotificationSettings])
            return await LiveCenter.permission()
        },
        replace: { plan in
            await LiveCenter.replace(plan)
        }
    )

    /// For previews: nothing leaves the process. Asking for permission when it was never
    /// asked grants it, like tapping Allow.
    static func preview(_ permission: ReminderPermission = .allowed) -> ReminderCenterClient {
        let state = PreviewPermission(permission)
        return ReminderCenterClient(
            permission: { state.value },
            requestPermission: { state.grantIfUndetermined() },
            replace: { _ in }
        )
    }

    private final class PreviewPermission: Sendable {
        private let state: Mutex<ReminderPermission>
        init(_ initial: ReminderPermission) { state = Mutex(initial) }
        var value: ReminderPermission { state.withLock { $0 } }
        func grantIfUndetermined() -> ReminderPermission {
            state.withLock { current in
                if current == .notDetermined { current = .allowed }
                return current
            }
        }
    }

    private enum LiveCenter {
        static func permission() async -> ReminderPermission {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral: return .allowed
            case .denied: return .denied
            case .notDetermined: return .notDetermined
            @unknown default: return .denied
            }
        }

        static func replace(_ plan: [PlannedReminder]) async {
            let center = UNUserNotificationCenter.current()
            let prefix = ReminderPlanner.identifierPrefix
            let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
            if !pending.isEmpty { center.removePendingNotificationRequests(withIdentifiers: pending) }
            let delivered = await center.deliveredNotifications().map(\.request.identifier).filter { $0.hasPrefix(prefix) }
            if !delivered.isEmpty { center.removeDeliveredNotifications(withIdentifiers: delivered) }

            for reminder in plan {
                let content = UNMutableNotificationContent()
                content.title = reminder.title
                content.body = reminder.body
                content.sound = .default
                content.threadIdentifier = "com.learnfrc.reminders"
                content.targetContentIdentifier = reminder.link.absoluteString
                content.userInfo = [NotificationRouter.linkKey: reminder.link.absoluteString]
                content.interruptionLevel = .active
                content.relevanceScore = 0.5
                let trigger = UNCalendarNotificationTrigger(dateMatching: reminder.components, repeats: false)
                let request = UNNotificationRequest(identifier: reminder.id, content: content, trigger: trigger)
                do {
                    try await center.add(request)
                } catch {
                    Log.data.error("Reminder not scheduled: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
    }
}

// MARK: - Scheduler

/// Opt-in study reminders on this device: at most one a day, at a time the person picks,
/// about the lesson they're on. Off until someone turns it on in Settings.
///
/// For Settings:
///
///     @Bindable var reminders = ReminderScheduler.shared
///     Toggle("Study reminders", isOn: Binding(get: { reminders.isEnabled },
///                                             set: { on in Task { await reminders.setEnabled(on) } }))
///     DatePicker("Time", selection: $reminders.time, displayedComponents: .hourAndMinute)
///
/// or drop in `ReminderSettingsSection()`, which does all of that.
@Observable
@MainActor
final class ReminderScheduler {
    static let shared = ReminderScheduler(
        client: AppConfig.isRunningPreviews ? .preview() : .live,
        defaults: .standard
    )

    /// The person turned reminders on (the system may still block them: see `permission`).
    private(set) var isEnabled: Bool
    /// 0...23, local time.
    var hour: Int { didSet { guard hour != oldValue else { return }; save(); setNeedsReschedule() } }
    /// 0...59
    var minute: Int { didSet { guard minute != oldValue else { return }; save(); setNeedsReschedule() } }
    /// Days to remind on, `Calendar` numbering (1 = Sunday ... 7 = Saturday). Never empty.
    private(set) var weekdays: Set<Int>
    private(set) var permission: ReminderPermission = .notDetermined
    /// When the scheduled reminders will arrive, soonest first.
    private(set) var upcoming: [Date] = []
    /// True when every lesson is done, so nothing is scheduled.
    private(set) var hasNothingToRemind = false
    /// True while asking for permission or rescheduling.
    private(set) var isWorking = false

    /// The reminder time as a `Date` today, for `DatePicker(displayedComponents: .hourAndMinute)`.
    var time: Date {
        get {
            calendar.date(bySettingHour: hour, minute: minute, second: 0, of: .now) ?? .now
        }
        set {
            let parts = calendar.dateComponents([.hour, .minute], from: newValue)
            if let h = parts.hour, h != hour { hour = h }
            if let m = parts.minute, m != minute { minute = m }
        }
    }

    var nextReminder: Date? { upcoming.first }

    @ObservationIgnored private let client: ReminderCenterClient
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private weak var model: AppModel?
    @ObservationIgnored private var pending: Task<Void, Never>?
    @ObservationIgnored private var clearedWhileOff = false
    @ObservationIgnored var calendar: Calendar = .current

    private enum Key {
        static let enabled = "reminders.enabled"
        static let hour = "reminders.hour"
        static let minute = "reminders.minute"
        static let weekdays = "reminders.weekdays"
    }

    static let defaultHour = 19
    static let defaultMinute = 0
    static let everyDay: Set<Int> = [1, 2, 3, 4, 5, 6, 7]
    static let weekdaysOnly: Set<Int> = [2, 3, 4, 5, 6]
    static let weekendsOnly: Set<Int> = [1, 7]

    init(client: ReminderCenterClient, defaults: UserDefaults) {
        self.client = client
        self.defaults = defaults
        isEnabled = defaults.bool(forKey: Key.enabled)
        let storedHour = defaults.object(forKey: Key.hour) as? Int
        let storedMinute = defaults.object(forKey: Key.minute) as? Int
        hour = storedHour.map { min(23, max(0, $0)) } ?? Self.defaultHour
        minute = storedMinute.map { min(59, max(0, $0)) } ?? Self.defaultMinute
        let storedDays = Set((defaults.array(forKey: Key.weekdays) as? [Int] ?? []).filter { (1...7).contains($0) })
        weekdays = storedDays.isEmpty ? Self.everyDay : storedDays
    }

    /// Gives the scheduler the stores it reads the continue lesson from. `SystemServices.install` does this.
    func attach(_ model: AppModel) {
        self.model = model
    }

    // MARK: Settings actions

    /// Turns reminders on or off. Turning on asks for notification permission the first time;
    /// returns false (and stays off) when the system says no.
    @discardableResult
    func setEnabled(_ on: Bool) async -> Bool {
        if !on {
            isEnabled = false
            save()
            await reschedule()
            return true
        }
        isWorking = true
        defer { isWorking = false }
        var status = await client.permission()
        if status == .notDetermined {
            status = await client.requestPermission()
        }
        permission = status
        guard status.allowsDelivery else {
            isEnabled = false
            save()
            return false
        }
        isEnabled = true
        save()
        await reschedule()
        return true
    }

    /// Adds or removes one day. The last remaining day can't be removed (turn reminders off instead).
    func toggleWeekday(_ day: Int) {
        guard (1...7).contains(day) else { return }
        var next = weekdays
        if next.contains(day) { next.remove(day) } else { next.insert(day) }
        setWeekdays(next)
    }

    func setWeekdays(_ days: Set<Int>) {
        let clean = days.filter { (1...7).contains($0) }
        guard !clean.isEmpty, clean != weekdays else { return }
        weekdays = clean
        save()
        setNeedsReschedule()
    }

    /// Re-reads the system permission (call when the app comes back from Settings).
    func refreshPermission() async {
        permission = await client.permission()
    }

    // MARK: Scheduling

    /// Coalesces bursts of changes (a completion changes several things at once).
    func setNeedsReschedule() {
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await self?.reschedule()
        }
    }

    /// Rebuilds the next two weeks of reminders from the current continue lesson. Called on
    /// launch, when the app comes to the foreground, after progress changes and after any
    /// settings change. Removes everything when reminders are off or blocked.
    func reschedule() async {
        permission = await client.permission()
        guard isEnabled, permission.allowsDelivery else {
            // Clear once per launch while off; nothing gets added while off, so once is enough.
            if !clearedWhileOff {
                await client.replace([])
                clearedWhileOff = true
            }
            upcoming = []
            hasNothingToRemind = false
            return
        }
        clearedWhileOff = false
        let (content, studiedToday) = currentContent()
        let plan = ReminderPlanner.plan(
            now: .now,
            calendar: calendar,
            hour: hour,
            minute: minute,
            weekdays: weekdays,
            studiedToday: studiedToday,
            content: content
        )
        await client.replace(plan)
        upcoming = plan.map(\.fireDate)
        hasNothingToRemind = content == .allDone
        Log.data.info("Reminders: \(plan.count) scheduled")
    }

    private func currentContent() -> (ReminderContent, studiedToday: Bool) {
        guard let model else { return (.generic, false) }
        let progress = model.progress
        let studiedToday = progress.completions.contains { completion in
            completion.completedAt.map { calendar.isDateInToday($0) } ?? false
        }
        if let next = progress.continueLesson {
            return (.lesson(
                id: next.lesson.id,
                title: next.lesson.title,
                departmentName: next.department.name,
                moduleTitle: next.module.title,
                minutes: next.lesson.estimatedMinutes,
                isFirstLesson: progress.completedTotal == 0
            ), studiedToday)
        }
        return (model.catalog.isLoaded ? .allDone : .generic, studiedToday)
    }

    private func save() {
        defaults.set(isEnabled, forKey: Key.enabled)
        defaults.set(hour, forKey: Key.hour)
        defaults.set(minute, forKey: Key.minute)
        defaults.set(weekdays.sorted(), forKey: Key.weekdays)
    }

    // MARK: Words for Settings

    /// "Every day at 7:00 PM", "Weekdays at 6:30 PM", "Tue, Thu, and Sat at 7:00 PM".
    var scheduleSummary: String {
        "\(daysSummary) at \(time.formatted(date: .omitted, time: .shortened))"
    }

    /// "Every day", "Weekdays", "Weekends" or the days listed in week order.
    var daysSummary: String {
        if weekdays == Self.everyDay { return "Every day" }
        if weekdays == Self.weekdaysOnly { return "Weekdays" }
        if weekdays == Self.weekendsOnly { return "Weekends" }
        let symbols = calendar.shortWeekdaySymbols
        return orderedWeekdays.filter(weekdays.contains).map { symbols[$0 - 1] }.formatted(.list(type: .and))
    }

    /// 1...7 starting from the locale's first day of the week.
    var orderedWeekdays: [Int] {
        let first = calendar.firstWeekday
        return (0..<7).map { (first - 1 + $0) % 7 + 1 }
    }

    /// One honest line about what will happen next, or nil when reminders are off.
    var statusLine: String? {
        guard isEnabled else { return nil }
        if permission == .denied { return "Notifications are off for LearnFRC in Settings, so reminders can't arrive." }
        if hasNothingToRemind { return "You've finished every lesson, so there's nothing to remind you about." }
        guard let next = nextReminder else { return nil }
        return "Next one: \(Self.describe(next, calendar: calendar))."
    }

    /// The fine print under the switch.
    static let footnote = "One a day at most, at the time you pick, about the lesson you're on. Skipped on days you've already done a lesson. If you're away for two weeks, they stop until you open LearnFRC again."

    /// "today at 7:00 PM", "tomorrow at 7:00 PM", "Thursday at 7:00 PM", "Oct 21 at 7:00 PM".
    static func describe(_ date: Date, calendar: Calendar, now: Date = .now) -> String {
        let time = date.formatted(date: .omitted, time: .shortened)
        if calendar.isDate(date, inSameDayAs: now) { return "today at \(time)" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return "tomorrow at \(time)"
        }
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: date)).day ?? 0
        if days < 7 { return "\(date.formatted(.dateTime.weekday(.wide))) at \(time)" }
        return "\(date.formatted(.dateTime.month(.abbreviated).day())) at \(time)"
    }

    /// Where to send someone who turned notifications off.
    static var systemSettingsURL: URL? {
        #if os(iOS)
        URL(string: UIApplication.openNotificationSettingsURLString)
        #else
        URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=\(Bundle.main.bundleIdentifier ?? "com.learnfrc.app")")
        #endif
    }
}

// MARK: - Notification taps

/// Routes taps on LearnFRC notifications into the app and keeps reminders quiet while the
/// app is already open. Installed as the notification center's delegate by `SystemServices`.
final class NotificationRouter: NSObject, UNUserNotificationCenterDelegate, Sendable {
    static let shared = NotificationRouter()
    /// `userInfo` key holding the link a notification opens.
    static let linkKey = "learnfrcLink"

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let link = response.notification.request.content.userInfo[Self.linkKey] as? String
        let tapped = response.actionIdentifier == UNNotificationDefaultActionIdentifier
        completionHandler()
        guard tapped, let link, let url = URL(string: link) else { return }
        Task { @MainActor in
            SystemServices.open(url)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // The person is already in LearnFRC; a nudge to open it would just be noise.
        let isReminder = notification.request.identifier.hasPrefix(ReminderPlanner.identifierPrefix)
        completionHandler(isReminder ? [] : [.banner, .list, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
        Task { @MainActor in
            SystemServices.model?.showSettings()
        }
    }
}
