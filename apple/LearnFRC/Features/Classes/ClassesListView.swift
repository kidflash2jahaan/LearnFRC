import SwiftUI

/// learnfrc.com/classes in the app: the live classes FRC students teach, Live now and then
/// Upcoming by day. A list only. Every class opens on learnfrc.com in Safari, where signing
/// up, the age step, the parent OK, the recording notice and the class itself all happen; the
/// app shows no video and never asks for the camera or the microphone.
///
/// Everything comes from `GET /api/app/classes` (`ClassesStore`), the same listing the site
/// renders. Signed out, rows say "Taught by an FRC student" and name nobody; signed in, they
/// name the teacher and the site leaves off classes by anyone blocked either way. Each row has
/// Report this class and Block @teacher (App Review 1.2: the title and description are the
/// teacher's words), through the existing `/api/app/reports` and `/api/app/blocks`.
struct ClassesListView: View {
    @Environment(ClassesStore.self) private var injected: ClassesStore?
    @Environment(SafetyStore.self) private var injectedSafety: SafetyStore?
    @Environment(AccountStore.self) private var account
    @Environment(\.scenePhase) private var scenePhase

    /// The class being reported, and its teacher.
    @State private var reporting: ClassReportTarget?
    /// The block confirmation, and the class whose teacher it's about. The target outlives the
    /// dialog (which clears `confirmingBlock` as it closes, before its action's task runs).
    @State private var confirmingBlock = false
    @State private var blockTarget: ClassReportTarget?
    /// Block and report: the block waits until the report sheet closes.
    @State private var blockAfterReport: String?
    @State private var failure: String?
    @State private var authScreen: AuthFlowView.Screen?

    private var store: ClassesStore { injected ?? .shared }
    private var safety: SafetyStore { injectedSafety ?? .shared }

    var body: some View {
        LearnScrollPage(title: "Live classes", refresh: { await reload(force: true) }, place: .route(.classes)) { layout, _ in
            masthead(layout)
                .learnColumn(layout)
                .padding(.top, 20)
            content(layout)
                .learnColumn(layout)
                .padding(.top, 40)
        }
        .toolbar { toolbar }
        .learnHandoff(store.isVisible ? ClassesFeed.webURL : nil, place: .route(.classes))
        .task(id: account.isLoading ? nil : (account.userID?.uuidString ?? "guest")) {
            await reload(force: false)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await reload(force: false) } }
        }
        // A block or an unblock anywhere (Settings, a profile, a row here) changes what the
        // site lists for this account.
        .onChange(of: safety.revision) { _, _ in
            Task { await reload(force: true) }
        }
        .sheet(item: $reporting, onDismiss: {
            guard let teacher = blockAfterReport else { return }
            blockAfterReport = nil
            Task { await block(teacher) }
        }) { target in
            ReportSheet(username: target.teacher, surface: .classesList, reportedClass: target.reportedClass)
        }
        .closesOnNavigation($reporting)
        .blockConfirmation(isPresented: $confirmingBlock, username: blockTarget?.teacher ?? "", hidesClasses: true) { thenReport in
            guard let target = blockTarget else { return }
            if thenReport {
                blockAfterReport = target.teacher
                reporting = target
            } else {
                await block(target.teacher)
            }
        }
        .alert("Couldn't do that", isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
            Button("OK", role: .cancel) { failure = nil }
        } message: {
            Text(failure ?? "")
        }
        .authSheet(item: $authScreen)
    }

    // MARK: Loading

    private func reload(force: Bool) async {
        guard !account.isLoading else { return }
        await store.load(userID: account.userID, force: force)
    }

    private func block(_ teacher: String) async {
        do {
            try await safety.block(teacher)
            Haptics.success()
        } catch {
            failure = APIError.from(error).message
        }
    }

    private func unblock(_ teacher: String) async {
        do {
            try await safety.unblock(teacher)
        } catch {
            failure = APIError.from(error).message
        }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        if store.isVisible {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: ClassesFeed.webURL, subject: Text("Live classes on LearnFRC")) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        #if os(macOS)
        ToolbarItem {
            Button {
                Task { await reload(force: true) }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .disabled(store.isLoading)
            .help("Check learnfrc.com for classes")
        }
        #endif
    }

    // MARK: Masthead

    private func masthead(_ layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("live classes / taught by FRC students")
            Text(ClassesCopy.heading)
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
            LearnLede(ClassesCopy.lede)
                .padding(.top, 16)
            LearnSub(ClassesCopy.onTheWeb)
                .padding(.top, 12)
        }
        .frame(maxWidth: layout.pages?.leading ?? .infinity, alignment: .leading)
    }

    // MARK: Content

    @ViewBuilder
    private func content(_ layout: LearnLayout) -> some View {
        if let feed = store.feed {
            if !feed.visible {
                LearnNotice(kicker: "classes / not open yet", message: ClassesCopy.hidden)
            } else {
                list(feed, layout: layout)
            }
        } else if store.isLoading || store.lastError == nil {
            ClassesLoadingBlock()
        } else {
            LearnNotice(
                kicker: "classes / not loaded",
                message: "Couldn't load the classes. \(store.lastError?.message ?? "")"
            ) {
                Button("Try again") {
                    Task { await reload(force: true) }
                }
                .buttonStyle(.inkGhostSmall)
            }
        }
    }

    @ViewBuilder
    private func list(_ feed: ClassesFeed, layout: LearnLayout) -> some View {
        let rows = store.classes(hiding: safety.blockedHandles)
        let live = rows.filter(\.isLive)
        let groups = ClassDay.group(rows.filter { !$0.isLive })
        VStack(alignment: .leading, spacing: 0) {
            if rows.isEmpty {
                NoteCallout {
                    SlugText("classes / none yet")
                    Text(ClassesCopy.empty)
                        .font(LF.Fonts.body(16))
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .learnMeasure(60)
            }

            if !live.isEmpty {
                section(title: "Live now", kicker: "on right now / join on learnfrc.com", rows: live)
            }

            ForEach(groups) { group in
                let first = group.id == groups.first?.id
                section(
                    title: ClassesCopy.day(group.day),
                    kicker: first ? "upcoming / in your time zone" : nil,
                    rows: group.rows
                )
                .padding(.top, live.isEmpty && first ? 0 : 36)
            }

            if let teach = feed.teachURL {
                teachSlip(teach)
                    .padding(.top, rows.isEmpty ? 24 : 48)
            }
        }
    }

    private func section(title: String, kicker: String?, rows: [LiveClass]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: kicker, title: title)
            VStack(alignment: .leading, spacing: 0) {
                DashedRule()
                ForEach(rows) { item in
                    ClassRow(item: item, safety: rowSafety(item))
                    DashedRule()
                }
            }
            .padding(.top, 14)
        }
    }

    private func teachSlip(_ url: URL) -> some View {
        NoteCallout {
            SlugText("teach / FRC students 13 to 17")
            Text("Know a lesson well enough to teach it? Apply to teach a live class on learnfrc.com.")
                .font(LF.Fonts.body(16))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            Button("Teach a class") { openClassesPageInSafari(url) }
                .buttonStyle(.inkSmall)
                .accessibilityHint("Opens learnfrc.com in Safari")
                .padding(.top, 6)
        }
        .learnMeasure(60)
    }

    // MARK: Report and block

    private func rowSafety(_ item: LiveClass) -> ClassRowSafety? {
        if account.isGuest {
            return ClassRowSafety(kind: .guest, signIn: { authScreen = .signIn })
        }
        guard let teacher = safetyTarget(item.teacherUsername, account: account) else { return nil }
        let target = ClassReportTarget(item: item, teacher: teacher)
        return ClassRowSafety(
            kind: .member(teacher: teacher, isBlocked: safety.isBlocked(teacher)),
            report: { reporting = target },
            block: {
                blockTarget = target
                confirmingBlock = true
            },
            unblock: { Task { await unblock(teacher) } }
        )
    }
}

/// A class and the teacher a report about it is filed against.
struct ClassReportTarget: Identifiable, Hashable {
    let reportedClass: ReportedClass
    let teacher: String

    var id: UUID { reportedClass.id }

    init(item: LiveClass, teacher: String) {
        self.reportedClass = ReportedClass(item)
        self.teacher = teacher
    }
}

/// Upcoming classes that start on one day, in the device's time zone.
struct ClassDay: Identifiable {
    let day: Date
    let rows: [LiveClass]

    var id: Date { day }

    /// `rows` by the day they start, earliest first.
    static func group(_ rows: [LiveClass], calendar: Calendar = .current) -> [ClassDay] {
        let grouped = Dictionary(grouping: rows) { calendar.startOfDay(for: $0.startsAt) }
        return grouped.keys.sorted().map { day in
            ClassDay(day: day, rows: (grouped[day] ?? []).sorted { $0.startsAt < $1.startsAt })
        }
    }
}

/// The list while the first answer is on its way.
private struct ClassesLoadingBlock: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(height: 26, width: 180)
            ForEach(0..<3, id: \.self) { _ in
                SkeletonBlock(height: 96)
                    .padding(.top, 6)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading live classes")
    }
}

// MARK: - Previews

#Preview("Classes, signed in", traits: .fixedLayout(width: 393, height: 1600)) {
    NavigationStack { ClassesListView() }
        .environment(ClassesStore.preview(.preview(signedIn: true)))
        .environment(SafetyStore.preview())
        .appEnvironment(.preview)
}

#Preview("Classes, guest, dark", traits: .fixedLayout(width: 393, height: 1600)) {
    NavigationStack { ClassesListView() }
        .environment(ClassesStore.preview(.preview(signedIn: false)))
        .environment(SafetyStore.preview())
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Classes, none yet, iPad", traits: .fixedLayout(width: 1024, height: 900)) {
    NavigationStack { ClassesListView() }
        .environment(ClassesStore.preview(ClassesFeed(visible: true, classes: [], liveNow: 0, teachURL: AppConfig.webBase.appending(path: "apply/teach"), version: "1")))
        .environment(SafetyStore.preview())
        .appEnvironment(.preview)
}
