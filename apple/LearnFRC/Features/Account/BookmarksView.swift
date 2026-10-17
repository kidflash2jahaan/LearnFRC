import SwiftUI

/// The lessons this reader set aside (the site's `/bookmarks`): the folder at the back of
/// the binder. A masthead that says what's in it, the index slip (which departments the
/// saved lessons came from and how long the stack takes to read), then the folder itself:
/// one drawn box of ruled entries, newest first.
///
/// Works for both kinds of reader. Signed in, it's the account's bookmarks (the same list
/// as learnfrc.com). As a guest, it's the bookmarks kept on this device, which move into
/// the account at sign-in. Tapping an entry opens the lesson; Remove (or a swipe) strikes it
/// off at once, the way the site does, and "Put it back" undoes the last one.
struct BookmarksView: View {
    @Environment(ProgressStore.self) private var progress
    @Environment(CatalogStore.self) private var catalog
    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var app

    /// The last entry struck off, for "Put it back".
    @State private var lastRemoved: LessonLocation?

    /// What is in the folder, by department, most-saved first (the site's `shelves`).
    struct Shelf: Identifiable, Hashable {
        let slug: String
        let name: String
        var count: Int
        var id: String { slug }
    }

    var body: some View {
        let saved = progress.bookmarkedLessons
        AccountPage(maxWidth: 1080, avoidsKeyboard: false, place: .route(.bookmarks), fold: .spread) { page in
            if let pages = page.pages {
                // An open iPhone Duo: the masthead and the index on the left page, the folder
                // on the right.
                FoldPages(pages) {
                    masthead(saved, wide: false)
                } trailing: {
                    folder(saved, wide: false)
                }
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    masthead(saved, wide: page.width >= 900)
                    folder(saved, wide: page.width >= 760)
                        .padding(.top, 52)
                }
            }
        }
        .navigationTitle("Bookmarks")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .refreshable {
            await progress.refresh(force: true)
        }
        // Handoff only while this is the screen on show (ARCHITECTURE 6.6).
        .screenHandoff(.route(.bookmarks), url: AppConfig.webBase.appending(path: "bookmarks"),
                       title: "Bookmarks on LearnFRC", when: account.isSignedIn)
    }

    // MARK: Masthead

    @ViewBuilder
    private func masthead(_ saved: [LessonLocation], wide: Bool) -> some View {
        let shelves = Self.shelves(saved)
        let minutes = saved.reduce(0) { $0 + max(0, $1.lesson.estimatedMinutes) }
        if wide {
            HStack(alignment: .top, spacing: 52) {
                mastheadText(saved, departments: shelves.count)
                    .frame(maxWidth: .infinity, alignment: .leading)
                BookmarksIndexSlip(shelves: shelves, readMinutes: minutes, total: saved.count)
                    .frame(width: 340)
                    .padding(.top, 20)
            }
        } else {
            VStack(alignment: .leading, spacing: 40) {
                mastheadText(saved, departments: shelves.count)
                BookmarksIndexSlip(shelves: shelves, readMinutes: minutes, total: saved.count)
                    .frame(maxWidth: 400, alignment: .leading)
            }
        }
    }

    private func mastheadText(_ saved: [LessonLocation], departments: Int) -> some View {
        let total = saved.count
        return VStack(alignment: .leading, spacing: 0) {
            AccountHeader(
                marker: "your reading list",
                title: total > 0
                    ? "\(Self.count(total, "lesson")) you set aside."
                    : "A folder for the lessons you'll want twice.",
                lede: total > 0
                    ? "Filed from \(Self.count(departments, "department")), newest first. Pull one down when build season leaves you ten minutes."
                    : "Hit the bookmark on any lesson while you are reading and it lands here, so the thing you needed in week one is still findable in week five."
            )

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { mastheadButtons(total: total) }
                VStack(alignment: .leading, spacing: 12) { mastheadButtons(total: total) }
            }
            .padding(.top, 24)

            if account.isGuest {
                AccountNote("on this device", total > 0
                    ? "These are kept on this device. Sign in or make an account and they move onto it, so they follow you to learnfrc.com."
                    : "As a guest, bookmarks are kept on this device. Sign in or make an account and they move onto it.")
                    .frame(maxWidth: 560, alignment: .leading)
                    .padding(.top, 24)
            }
        }
    }

    /// Side by side when both fit (`ViewThatFits` checks their full width); stacked
    /// otherwise, where a label too long for the line wraps instead of running off it.
    @ViewBuilder
    private func mastheadButtons(total: Int) -> some View {
        Button(total > 0 ? "Add to the folder" : "Browse the guides") { app.selectedTab = .learn }
            .buttonStyle(.ink)
            .fixedSize(horizontal: false, vertical: true)
        if let basics = catalog.department(slug: "getting-started") {
            NavigationLink("Start with the basics", value: AppRoute.department(basics.id))
                .buttonStyle(.inkGhost)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: The folder

    @ViewBuilder
    private func folder(_ saved: [LessonLocation], wide: Bool) -> some View {
        if saved.isEmpty && !progress.bookmarkOrder.isEmpty && !catalog.isLoaded {
            // Bookmarks on file, catalogue still loading: hold their places.
            VStack(alignment: .leading, spacing: 14) {
                SkeletonBlock(height: 28, width: 200)
                ForEach(0..<min(4, progress.bookmarkOrder.count), id: \.self) { _ in
                    SkeletonBlock(height: 72)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading your bookmarks")
        } else if saved.isEmpty {
            emptyFolder
        } else {
            VStack(alignment: .leading, spacing: 0) {
                AccountSectionHeading(title: "The folder", slug: "newest first")

                if let lastRemoved {
                    removedLine(lastRemoved)
                        .padding(.top, 16)
                }

                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(saved.enumerated()), id: \.element.id) { index, location in
                        if index > 0 { DashedRule() }
                        BookmarkEntry(location: location, savedAt: progress.bookmarkedAt(location.lesson.id), wide: wide) {
                            remove(location)
                        }
                    }
                }
                .modifier(BookmarkSwipeContainer())
                // A swiped entry slides under the folder's edge, not over it.
                .clipped()
                .notebookBox()
                .padding(.top, 18)

                AccountSubText("Run out of things to read? The catalogue has \(departmentsPhrase(saved)) departments, and the bookmark is on every lesson in it.")
                    .frame(maxWidth: 560, alignment: .leading)
                    .padding(.top, 28)
                Button("Browse the guides") { app.selectedTab = .learn }
                    .buttonStyle(AccountTextButtonStyle(size: 15.5, mono: false))
                    .padding(.top, 4)
            }
        }
    }

    private var emptyFolder: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let lastRemoved {
                removedLine(lastRemoved)
                    .padding(.bottom, 18)
            }
            VStack(alignment: .leading, spacing: 0) {
                SlugText("the folder")
                Text("Empty, for now.")
                    .font(LF.Fonts.display(28, relativeTo: .title2))
                    .tracking(28 * -0.025)
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.top, 8)
                AccountSubText("Every lesson page has a bookmark on it. Nothing about saving one is a commitment: it is a note that says come back to this, and this is where the notes pile up.")
                    .padding(.top, 10)
                DashedRule()
                    .padding(.top, 20)
                CountText(catalog.departments.isEmpty ? 11 : catalog.departments.count, unit: "departments to file from")
                    .padding(.top, 14)
            }
            .padding(LF.Metrics.cardPadding + 4)
            .frame(maxWidth: 736, alignment: .leading)
            .notebookBox()
        }
    }

    /// "Removed: Swerve Basics. Put it back" after an entry is struck off.
    private func removedLine(_ location: LessonLocation) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                removedText(location)
                putBackButton(location)
            }
            VStack(alignment: .leading, spacing: 2) {
                removedText(location)
                putBackButton(location)
            }
        }
    }

    private func removedText(_ location: LessonLocation) -> some View {
        Text("Removed \(Text(location.lesson.title).foregroundStyle(LF.Palette.ink)) from the folder.")
            .font(LF.Fonts.body(15, relativeTo: .subheadline))
            .foregroundStyle(LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func putBackButton(_ location: LessonLocation) -> some View {
        Button("Put it back") { putBack(location) }
            .buttonStyle(AccountTextButtonStyle(size: 15, mono: false))
            .accessibilityLabel("Put \(location.lesson.title) back in your bookmarks")
    }

    // MARK: Actions

    private func remove(_ location: LessonLocation) {
        lastRemoved = location
        accountAnnounce("Removed \(location.lesson.title) from your bookmarks.")
        Task {
            guard progress.isBookmarked(location.id) else { return }
            await progress.toggleBookmark(location.id)
        }
    }

    private func putBack(_ location: LessonLocation) {
        lastRemoved = nil
        accountAnnounce("\(location.lesson.title) is back in your bookmarks.")
        Task {
            guard !progress.isBookmarked(location.id) else { return }
            await progress.toggleBookmark(location.id)
        }
    }

    // MARK: Figures

    static func shelves(_ saved: [LessonLocation]) -> [Shelf] {
        var order: [String] = []
        var bySlug: [String: Shelf] = [:]
        for location in saved {
            let slug = location.department.slug
            if bySlug[slug] == nil {
                order.append(slug)
                bySlug[slug] = Shelf(slug: slug, name: location.department.name, count: 0)
            }
            bySlug[slug]?.count += 1
        }
        // Most-saved first; ties keep the newest-first order they were met in.
        return order.compactMap { bySlug[$0] }
            .enumerated()
            .sorted { $0.element.count != $1.element.count ? $0.element.count > $1.element.count : $0.offset < $1.offset }
            .map(\.element)
    }

    /// "1 lesson", "3 lessons" (the site's `pluralize`).
    static func count(_ value: Int, _ noun: String) -> String {
        "\(value) \(value == 1 ? noun : noun + "s")"
    }

    /// "all eleven" when the folder already draws on every department, else "eleven".
    private func departmentsPhrase(_ saved: [LessonLocation]) -> String {
        let total = catalog.departments.isEmpty ? 11 : catalog.departments.count
        let formatter = NumberFormatter()
        formatter.numberStyle = .spellOut
        formatter.locale = Locale(identifier: "en_US")
        let words = formatter.string(from: NSNumber(value: total)) ?? "\(total)"
        return Self.shelves(saved).count == total ? "all \(words)" : words
    }
}

// MARK: - The index slip

/// The slip clipped to the front of the folder (the site's `ShelfIndex`): department on the
/// left, count on the right, leader dots between, and the two totals ruled off underneath.
struct BookmarksIndexSlip: View {
    let shelves: [BookmarksView.Shelf]
    let readMinutes: Int
    let total: Int

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: 22, tapeAngle: -3.6) {
            AccountSheetSlug("the index")
                .accessibilityAddTraits(.isHeader)

            if total == 0 {
                Text("Nothing filed yet. Bookmark a lesson and its department shows up on this slip.")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .lineHeight(.multiple(factor: 1.35))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(shelves.enumerated()), id: \.element.id) { index, shelf in
                        if index > 0 { DashedRule() }
                        HStack(alignment: .lastTextBaseline, spacing: 8) {
                            Text(shelf.name)
                                .font(LF.Fonts.body(15, relativeTo: .subheadline))
                                .foregroundStyle(LF.Palette.ink)
                                .fixedSize(horizontal: false, vertical: true)
                                .layoutPriority(1)
                            // Leader dots drawn as a rule, so VoiceOver never reads "dot dot dot".
                            BookmarksLeader()
                                .frame(minWidth: 16)
                            Text(verbatim: "\(shelf.count)")
                                .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .caption))
                                .monospacedDigit()
                                .foregroundStyle(LF.Palette.ink)
                                .fixedSize()
                        }
                        .padding(.vertical, 7)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(Text(verbatim: "\(shelf.name), \(BookmarksView.count(shelf.count, "lesson"))"))
                    }
                }
                .padding(.top, 8)
            }

            VStack(alignment: .leading, spacing: 14) {
                DashedRule()
                HStack(alignment: .firstTextBaseline, spacing: 24) {
                    CountText(total, unit: "saved")
                    if readMinutes > 0 {
                        CountText(readMinutes, unit: "min to read")
                    }
                }
            }
            .padding(.top, 14)
        }
    }
}

/// A dotted line along the text baseline, between a department and its count.
private struct BookmarksLeader: View {
    var body: some View {
        BookmarksLeaderLine()
            .stroke(LF.Palette.rule, style: StrokeStyle(lineWidth: 1.2, lineCap: .round, dash: [0.1, 4]))
            .frame(height: 2)
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }
}

private struct BookmarksLeaderLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return path
    }
}

// MARK: - An entry

/// One saved lesson, filed in the folder: where it came from, the title (the whole entry
/// opens the lesson), the summary, and Remove. A ruled entry, not a card in a card.
private struct BookmarkEntry: View {
    let location: LessonLocation
    /// When it went in (accounts only; a guest's bookmarks have no date).
    let savedAt: Date?
    let wide: Bool
    var onRemove: () -> Void

    private var lesson: LessonSummary { location.lesson }

    /// The filing line's second half, like the site's: "saved 3 days ago / 25 min".
    private var whenLine: String? {
        var parts: [String] = []
        if let savedAt { parts.append(BookmarkEntry.savedAgo(savedAt)) }
        if lesson.estimatedMinutes > 0 { parts.append("\(lesson.estimatedMinutes) min") }
        return parts.isEmpty ? nil : parts.joined(separator: " / ")
    }

    /// The site's `savedAgo` (`bookmark-card.tsx`), word for word.
    static func savedAgo(_ date: Date, now: Date = .now) -> String {
        let day: TimeInterval = 86_400
        let diff = now.timeIntervalSince(date)
        if diff < day { return "saved today" }
        if diff < 2 * day { return "saved yesterday" }
        let days = Int(diff / day)
        if days < 7 { return "saved \(days) days ago" }
        let weeks = days / 7
        if weeks < 5 { return "saved \(weeks)w ago" }
        let months = days / 30
        if months < 12 { return "saved \(months)mo ago" }
        return "saved \(days / 365)y ago"
    }

    /// The same, in words VoiceOver reads well ("saved 3 weeks ago", not "3w").
    private var spokenSaved: String? {
        guard let savedAt else { return nil }
        let days = Int(Date.now.timeIntervalSince(savedAt) / 86_400)
        if days < 7 { return BookmarkEntry.savedAgo(savedAt) }
        let weeks = days / 7
        if weeks < 5 { return weeks == 1 ? "saved 1 week ago" : "saved \(weeks) weeks ago" }
        let months = days / 30
        if months < 12 { return months == 1 ? "saved 1 month ago" : "saved \(months) months ago" }
        let years = days / 365
        return years == 1 ? "saved 1 year ago" : "saved \(years) years ago"
    }

    private var spokenValue: String {
        var parts = [location.department.name]
        if let spokenSaved { parts.append(spokenSaved) }
        if lesson.estimatedMinutes > 0 { parts.append("\(lesson.estimatedMinutes) minutes") }
        return parts.joined(separator: ", ")
    }

    var body: some View {
        Group {
            if wide {
                HStack(alignment: .center, spacing: 24) {
                    link
                    removeButton
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    link
                    removeButton
                }
            }
        }
        .padding(.horizontal, LF.Metrics.cardPadding)
        .padding(.vertical, 10)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive, action: onRemove) {
                Label("Remove", systemImage: "bookmark.slash")
            }
        }
    }

    private var link: some View {
        NavigationLink(value: AppRoute.lesson(lesson.id)) {
            VStack(alignment: .leading, spacing: 6) {
                VStack(alignment: .leading, spacing: 2) {
                    SlugText("dept / \(location.department.slug)")
                    if let whenLine { SlugText(whenLine) }
                }
                Text(lesson.title)
                    .font(LF.Fonts.display(19, relativeTo: .headline))
                    .tracking(19 * -0.02)
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                if let summary = lesson.summary?.accountTrimmed, !summary.isEmpty {
                    Text(summary)
                        .font(LF.Fonts.body(14.5, relativeTo: .subheadline))
                        .lineHeight(.multiple(factor: 1.35))
                        .foregroundStyle(LF.Palette.graphite)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                SlugText(location.department.name)
            }
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel(Text(verbatim: lesson.title))
        .accessibilityValue(Text(verbatim: spokenValue))
        .accessibilityHint("Opens the lesson")
        .accessibilityAction(named: "Remove bookmark", onRemove)
    }

    private var removeButton: some View {
        Button("Remove", action: onRemove)
            .buttonStyle(.inkGhostSmall)
            .fixedSize()
            .accessibilityLabel(Text(verbatim: "Remove \(lesson.title) from your bookmarks"))
    }
}

/// Lets each entry swipe to Remove (iOS and macOS 27; the Remove button works everywhere).
private struct BookmarkSwipeContainer: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 27, macOS 27, *) {
            content.swipeActionsContainer()
        } else {
            content
        }
    }
}

// MARK: - Previews

private struct BookmarksPreviewHost: View {
    var body: some View {
        NavigationStack {
            BookmarksView()
                .navigationDestination(for: AppRoute.self) { route in
                    Text(String(describing: route))
                }
        }
    }
}

#Preview("Bookmarks, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    BookmarksPreviewHost()
        .appEnvironment(.preview(phase: .goalMet))
}

#Preview("Bookmarks, small iPhone, night", traits: .fixedLayout(width: 375, height: 1700)) {
    BookmarksPreviewHost()
        .appEnvironment(.preview(phase: .goalMet))
        .environment(\.colorScheme, .dark)
}

#Preview("Bookmarks, iPad", traits: .fixedLayout(width: 1024, height: 1300)) {
    BookmarksPreviewHost()
        .appEnvironment(.preview(phase: .goalMet))
}

#Preview("Bookmarks, guest, empty", traits: .fixedLayout(width: 393, height: 1300)) {
    BookmarksPreviewHost()
        .appEnvironment(.preview(signedIn: false))
}
