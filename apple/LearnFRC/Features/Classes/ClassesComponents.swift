import SwiftUI

// Live classes, the pieces other screens place: the Home card (`HomeLiveClassesCard`) and
// "Teach a live class" on the Apply screen (`ClassesTeachCard`), plus the row, the words and the
// Safari hand-off the classes list uses (`ClassesListView`). Each piece shows nothing until the
// site has said classes are open (`ClassesStore.isVisible`). Classes themselves are joined on
// learnfrc.com: every class opens in Safari, where the site's account, age step, parent OK and
// recording notice all live. The app has no video, camera or microphone.

// MARK: - Words and times

enum ClassesCopy {
    /// The site's homepage heading for classes.
    static let heading = "Learn it live, from FRC students."
    /// The site's empty state (homepage and /classes).
    static let empty = "The first classes are being scheduled. Want to teach one?"
    /// What classes are, in the site's words on /classes.
    static let lede = "Free live classes on LearnFRC lessons, taught by FRC students aged 13 to 17. Classes run 15 to 90 minutes, and every one is recorded on video and reviewed. Student cameras stay off, the class chat is filtered, and everyone in a class sees each other's usernames."
    /// Where a class actually happens.
    static let onTheWeb = "Signing up and joining happen on learnfrc.com: tap a class to open it in Safari. There's no video in the app."
    static let hidden = "Live classes aren't open yet."

    /// "6:00 PM", in the device's time zone.
    static func time(_ date: Date) -> String {
        date.formatted(date: .omitted, time: .shortened)
    }

    /// "Today", "Tomorrow", or "Thursday, November 20", for a day heading in the list.
    static func day(_ date: Date, now: Date = .now, calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "Today" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return "Tomorrow"
        }
        return date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    /// "Today, 6:00 PM", "Tomorrow, 6:00 PM" or "Thu, Nov 20, 6:00 PM".
    static func when(_ date: Date, now: Date = .now, calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "Today, \(time(date))" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return "Tomorrow, \(time(date))"
        }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())
    }

    /// "today at 6:00 PM", "tomorrow at 6:00 PM" or "Thu, Nov 20 at 6:00 PM", inside a sentence.
    static func whenInSentence(_ date: Date, now: Date = .now, calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "today at \(time(date))" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return "tomorrow at \(time(date))"
        }
        return "\(date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())) at \(time(date))"
    }

    /// "45 min", "1 hr", "1 hr 30 min".
    static func length(_ minutes: Int) -> String {
        guard minutes >= 60 else { return "\(max(minutes, 0)) min" }
        let hours = minutes / 60, rest = minutes % 60
        return rest == 0 ? "\(hours) hr" : "\(hours) hr \(rest) min"
    }

    /// "9 of 15 seats left", "1 seat left", "Full".
    static func seats(_ seats: LiveClass.Seats) -> String {
        if seats.isFull { return "Full" }
        if seats.capacity > 0, seats.left < seats.capacity {
            return "\(seats.left) of \(seats.capacity) seats left"
        }
        return seats.left == 1 ? "1 seat left" : "\(seats.left) seats left"
    }

    /// "Taught by @maya" signed in; the site's "Taught by an FRC student" signed out.
    static func teacher(_ item: LiveClass) -> String {
        item.teacherUsername.map { "Taught by @\($0)" } ?? item.teacherLabel
    }
}

/// Opens a class page, or the teach page, in Safari (the Mac's browser), never in an in-app
/// browser: the site's sign-in, the age step, the parent OK and the class room all live in the
/// person's real browser session.
@MainActor
func openClassesPageInSafari(_ url: URL) {
    SystemServices.openInBrowser(url)
}

// MARK: - A class row

/// One class in the list: when, what, who teaches, seats, and whether you have one. The whole
/// row opens the class on learnfrc.com; the trailing menu holds Report and Block (or, for a
/// guest, Sign in to report or block), as App Review 1.2 asks of anything another member wrote.
struct ClassRow: View {
    let item: LiveClass
    /// Report and block (nil: nothing to offer, like your own class).
    let safety: ClassRowSafety?

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Button {
                openClassesPageInSafari(item.webURL)
            } label: {
                details
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 14)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.inkRow)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(Text(verbatim: item.title))
            .accessibilityValue(Text(verbatim: spoken))
            .accessibilityHint("Opens the class on learnfrc.com in Safari")
            .modifier(ClassRowActions(safety: safety))

            if let safety {
                ClassRowMenu(safety: safety)
                    .padding(.top, 8)
            }
        }
        .contextMenu {
            if let safety { ClassRowMenuItems(safety: safety) }
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                if item.isLive {
                    TagView("live now", on: true)
                }
                SlugText(slug)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(item.title)
                .font(LF.Fonts.body(17.5, weight: .bold, relativeTo: .headline))
                .foregroundStyle(LF.Palette.ink)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            if let topic = item.topic {
                Text(verbatim: "On \(topic.title)")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(ClassesCopy.teacher(item))
                    .font(LF.Fonts.body(15, weight: .semibold, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if item.enrolled == true {
                    TagView("you're in", on: false, systemImage: "checkmark")
                }
            }
            HStack(spacing: 6) {
                Text(ClassesCopy.seats(item.seats))
                Image(systemName: "arrow.up.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(LF.Palette.blue)
                    .accessibilityHidden(true)
                Text("learnfrc.com")
            }
            .font(LF.Fonts.mono(12.5, relativeTo: .caption))
            .foregroundStyle(LF.Palette.graphite)
        }
    }

    /// "6:00 PM / 45 min" (the day is the section heading), or "started 5:48 PM / 60 min" for a
    /// class that's live.
    private var slug: String {
        let when = item.isLive ? "started \(ClassesCopy.time(item.startsAt))" : ClassesCopy.time(item.startsAt)
        return "\(when) / \(ClassesCopy.length(item.durationMinutes))"
    }

    /// What VoiceOver reads after the title.
    private var spoken: String {
        var parts: [String] = []
        parts.append(item.isLive ? "Live now" : ClassesCopy.when(item.startsAt))
        parts.append("\(item.durationMinutes) minutes")
        if let topic = item.topic { parts.append("on \(topic.title)") }
        parts.append(ClassesCopy.teacher(item))
        parts.append(ClassesCopy.seats(item.seats))
        if item.enrolled == true { parts.append("You have a seat") }
        return parts.joined(separator: ", ")
    }
}

/// What a class row can do besides opening: report the class or block its teacher (signed
/// in), or sign in first (a guest). Built by the list for each row.
struct ClassRowSafety {
    enum Kind {
        /// Signed in, looking at someone else's class.
        case member(teacher: String, isBlocked: Bool)
        /// A guest: reporting and blocking need an account.
        case guest
    }

    let kind: Kind
    var report: () -> Void = {}
    var block: () -> Void = {}
    var unblock: () -> Void = {}
    var signIn: () -> Void = {}
}

/// The menu items, for the row's menu button and its context menu.
struct ClassRowMenuItems: View {
    let safety: ClassRowSafety

    var body: some View {
        switch safety.kind {
        case .member(let teacher, let isBlocked):
            Button(action: safety.report) {
                Label("Report this class…", systemImage: "flag")
            }
            if isBlocked {
                Button(action: safety.unblock) {
                    Label("Unblock @\(teacher)", systemImage: "person.crop.circle.badge.checkmark")
                }
            } else {
                Button(role: .destructive, action: safety.block) {
                    Label("Block @\(teacher)", systemImage: "person.crop.circle.badge.xmark")
                }
            }
        case .guest:
            Button(action: safety.signIn) {
                Label("Sign in to report or block", systemImage: "person.crop.circle")
            }
        }
    }
}

/// The row's visible "..." menu, so Report and Block don't depend on a long press.
private struct ClassRowMenu: View {
    let safety: ClassRowSafety

    var body: some View {
        Menu {
            ClassRowMenuItems(safety: safety)
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.title3)
                .foregroundStyle(LF.Palette.graphite)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .menuIndicator(.hidden)
        .fixedSize()
        .accessibilityLabel(menuLabel)
        .help(menuLabel)
    }

    private var menuLabel: String {
        switch safety.kind {
        case .member(let teacher, _): "Report this class or block @\(teacher)"
        case .guest: "Sign in to report or block"
        }
    }
}

/// The same choices as accessibility actions on the row itself.
private struct ClassRowActions: ViewModifier {
    let safety: ClassRowSafety?

    func body(content: Content) -> some View {
        switch safety?.kind {
        case .member(let teacher, let isBlocked)?:
            content
                .accessibilityAction(named: "Report this class") { safety?.report() }
                .accessibilityAction(named: isBlocked ? "Unblock @\(teacher)" : "Block @\(teacher)") {
                    if isBlocked { safety?.unblock() } else { safety?.block() }
                }
        case .guest?:
            content
                .accessibilityAction(named: "Sign in to report or block") { safety?.signIn() }
        case nil:
            content
        }
    }
}

// MARK: - Home

/// Home's "Live classes" card: what's on now or next, and the way to the list. Home only places
/// it once the site says classes are open. It names no teacher and quotes no class title (only
/// the LearnFRC lesson a class is on), so it needs no report button of its own; the list does.
struct HomeLiveClassesCard: View {
    let feed: ClassesFeed
    /// The rows Home would show (blocked teachers already left off).
    let classes: [LiveClass]

    private var live: [LiveClass] { classes.filter(\.isLive) }
    private var next: LiveClass? { classes.first { !$0.isLive } }

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true) {
            SectionLabel(live.isEmpty ? "live classes / free" : "live classes / \(live.count) on now")
            Text(ClassesCopy.heading)
                .homeTitle(22, relativeTo: .title2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            Text(summary)
                .homeSub(15.5)
                .padding(.top, 8)
            HomeFlowLayout(spacing: 10, lineSpacing: 10) {
                NavigationLink(value: AppRoute.classes) {
                    Text(classes.isEmpty ? "About classes" : "See all classes")
                }
                .buttonStyle(.inkSmall)
                if let teach = feed.teachURL {
                    Button("Teach a class") { openClassesPageInSafari(teach) }
                        .buttonStyle(.inkGhostSmall)
                        .accessibilityHint("Opens learnfrc.com in Safari")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 18)
        }
    }

    private var summary: String {
        if classes.isEmpty { return ClassesCopy.empty }
        var lines: [String] = []
        if !live.isEmpty {
            lines.append(live.count == 1 ? "A class is live right now." : "\(live.count) classes are live right now.")
        }
        if let next {
            let on = next.topic.map { " on \($0.title)" } ?? ""
            lines.append("Next up: a class\(on), \(ClassesCopy.whenInSentence(next.startsAt)).")
        }
        lines.append("Taught by FRC students, free, and joined on learnfrc.com.")
        return lines.joined(separator: " ")
    }
}

// MARK: - Teach a class

/// Teach a live class, on the Apply screen. Mirrors FULL_SEASON_SENTENCE in
/// src/lib/classes/teacher-rules.ts. Nothing until the site says classes are open. Applying
/// happens on learnfrc.com/apply/teach, in Safari.
struct ClassesTeachCard: View {
    var topPadding: CGFloat = 28

    @Environment(ClassesStore.self) private var injected: ClassesStore?
    @Environment(AccountStore.self) private var account

    private var store: ClassesStore { injected ?? .shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if store.isVisible, let teach = store.feed?.teachURL {
                NotebookCard(tilt: .preset(3), padding: 22) {
                    SlugText("apply / teach")
                    Text("Teach a live class")
                        .font(LF.Fonts.display(22, relativeTo: .title2))
                        .tracking(22 * -0.025)
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                        .padding(.top, 8)
                    Text("FRC students aged 13 to 17 who’ve finished at least one full FRC season can teach a free live class on a LearnFRC lesson or module. Every class is recorded on video and reviewed, the first one included. You apply on learnfrc.com, and it takes about 25 minutes.")
                        .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                    Button("Apply to teach on learnfrc.com") { openClassesPageInSafari(teach) }
                        .buttonStyle(.inkSmall)
                        .accessibilityHint("Opens learnfrc.com in Safari")
                        .padding(.top, 16)
                }
                .frame(maxWidth: 640, alignment: .leading)
                .padding(.top, topPadding)
            }
        }
        .task(id: account.isLoading ? nil : (account.userID?.uuidString ?? "guest")) {
            guard !account.isLoading else { return }
            await store.load(userID: account.userID)
        }
    }
}

// MARK: - Previews

extension ClassesFeed {
    /// Two live-looking rows and three upcoming ones, for previews.
    static func preview(signedIn: Bool, now: Date = .now) -> ClassesFeed {
        func row(_ n: Int, _ title: String, startsIn minutes: Int, length: Int, live: Bool = false, topic: String?, teacher: String, taken: Int, enrolled: Bool = false) -> LiveClass {
            let starts = now.addingTimeInterval(TimeInterval(minutes * 60))
            return LiveClass(
                id: UUID(uuidString: String(format: "00000000-0000-4000-8000-%012d", n))!,
                title: title,
                description: nil,
                startsAt: starts,
                endsAt: starts.addingTimeInterval(TimeInterval(length * 60)),
                durationMinutes: length,
                status: live ? .live : .scheduled,
                teacherUsername: signedIn ? teacher : nil,
                topic: topic.map { .init(kind: "lesson", id: nil, title: $0, url: nil) },
                seats: .init(capacity: 15, taken: taken, left: 15 - taken),
                enrolled: signedIn ? enrolled : nil
            )
        }
        let classes = [
            row(1, "Wiring a CAN bus without the guesswork", startsIn: -12, length: 60, live: true, topic: "CAN Bus Wiring", teacher: "maya", taken: 9),
            row(2, "Your first command-based robot", startsIn: 90, length: 45, topic: "Command-Based Programming", teacher: "kai_cad", taken: 15),
            row(3, "Swerve modules, piece by piece", startsIn: 26 * 60, length: 90, topic: "Swerve Drive Basics", teacher: "ren_builds", taken: 4, enrolled: true),
            row(4, "Scouting that actually helps strategy", startsIn: 74 * 60, length: 30, topic: nil, teacher: "jo_scouts", taken: 0),
        ]
        return ClassesFeed(visible: true, classes: classes, liveNow: 1, teachURL: AppConfig.webBase.appending(path: "apply/teach"), version: "1")
    }
}

#Preview("Home card", traits: .fixedLayout(width: 393, height: 420)) {
    NavigationStack {
        let feed = ClassesFeed.preview(signedIn: true)
        HomeLiveClassesCard(feed: feed, classes: feed.classes)
            .padding(LF.Metrics.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .paperBackground()
    }
    .appEnvironment(.preview)
}

#Preview("Teach card", traits: .fixedLayout(width: 393, height: 360)) {
    ClassesTeachCard(topPadding: 0)
        .padding(LF.Metrics.gutter)
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
        .environment(ClassesStore.preview(.preview(signedIn: true)))
        .appEnvironment(.preview)
}
