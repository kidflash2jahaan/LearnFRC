import SwiftUI

/// learnfrc.com/admin in the app: everything the site knows about itself.
///
/// Masthead and the "what wants a person today" card first (side by side on wide windows and
/// on the two pages of an open foldable), then the four standing totals on the blue slab, the
/// honesty notes, the tally sheet, and the drawers, closed on arrival like the site and two
/// across on wide windows. Re-read every 30 seconds while it's on screen in the active scene,
/// and at once on coming back, like the site's auto-refresh. A signed-in member gets the
/// site's locked card; nothing is shown that the server didn't send for this account.
struct AdminDashboardView: View {
    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account
    @Environment(\.scenePhase) private var scenePhase

    @State private var isOnScreen = false
    @State private var openDrawers: Set<String> = []
    @State private var growthMetric: AdminGrowthChart.Metric = .all
    @State private var sourceMetric: AdminSourceChart.Metric = .visitors
    @State private var sourceRange: AdminSourceChart.Range = .week

    private var admin: AdminStore { injected ?? .shared }

    /// Refreshing only while somebody can see it, like the site pausing in a hidden tab.
    private var isLive: Bool { isOnScreen && scenePhase == .active && account.isSignedIn }

    var body: some View {
        AdminPage(refresh: { await refresh() }) { layout in
            content(layout)
        }
        .navigationTitle(AdminDestination.dashboard.title)
        #if os(iOS)
        .toolbarTitleDisplayMode(.inline)
        #endif
        .adminRefreshControl(isLoading: admin.dashboard.isLoading) {
            Task { await refresh() }
        }
        .adminHandoff(.dashboard, isOnShow: isOnScreen && admin.isAdmin)
        .onAppear { isOnScreen = true }
        .onDisappear { isOnScreen = false }
        .task(id: account.userID) {
            await admin.sync(userID: account.userID)
        }
        .task(id: isLive) {
            guard isLive else { return }
            // Read now, then every `refreshSeconds` while live. Leaving the screen or the
            // scene going inactive cancels this; coming back starts it again with a read.
            while !Task.isCancelled {
                await admin.loadDashboard()
                let seconds = admin.dashboard.value?.refreshSeconds ?? 30
                try? await Task.sleep(for: .seconds(seconds))
            }
        }
    }

    private func refresh() async {
        async let summary: Void = admin.sync(userID: account.userID, force: true)
        async let board: Void = admin.loadDashboard()
        _ = await (summary, board)
    }

    // MARK: Content

    @ViewBuilder
    private func content(_ layout: AdminLayout) -> some View {
        let remote = admin.dashboard
        if !account.isSignedIn, !account.isLoading {
            AdminSignedOutCard(destination: .dashboard)
                .adminLeadingPage(layout)
                .adminColumn(layout)
                .padding(.top, 40)
        } else if remote.locked != nil, remote.value == nil {
            AdminLockedDashboardCard()
                .adminLeadingPage(layout)
                .adminColumn(layout)
                .padding(.top, 40)
        } else if let board = remote.value {
            dashboard(board, layout: layout)
        } else if let error = remote.error {
            AdminLoadError(error: error, hasCopy: false) { Task { await admin.loadDashboard() } }
                .adminLeadingPage(layout)
                .adminColumn(layout)
                .padding(.top, 24)
        } else {
            VStack(alignment: .leading, spacing: 32) {
                AdminMasthead(marker: "sheet / admin", title: "Everything the site knows about itself.")
                AdminLoadingBlock(lines: 6)
            }
            .adminLeadingPage(layout)
            .adminColumn(layout)
            .padding(.top, 12)
        }
    }

    @ViewBuilder
    private func dashboard(_ board: AdminDashboard, layout: AdminLayout) -> some View {
        if let error = admin.dashboard.error {
            AdminLoadError(error: error, hasCopy: true) { Task { await admin.loadDashboard() } }
                .adminLeadingPage(layout)
                .adminColumn(layout)
                .padding(.bottom, 16)
        }

        // Masthead and the card: what this page is, and whether anything wants doing today.
        AdminColumnsLayout(
            columns: layout.isWide ? 2 : 1,
            spacing: 64,
            rowSpacing: 40,
            weights: [1.4, 0.9],
            crease: layout.columnCrease
        ) {
            masthead(board)
            AdminNowCard(now: board.now, isSuperAdmin: board.role.isSuperAdmin)
                .padding(.top, layout.isWide ? 8 : 0)
        }
        .adminColumn(layout)
        .padding(.top, 12)

        AdminStampsBand(stamps: board.stamps, layout: layout)
            .padding(.top, layout.sectionGap)

        if let pages = layout.pages, let traffic = board.notes.traffic, let coverage = board.notes.coverage {
            // An open iPhone Duo: the two notes one to a page (one alone keeps to the left page).
            FoldPages(pages) {
                AdminNote(slug: traffic.slug, text: traffic.text)
            } trailing: {
                AdminNote(slug: "what those four numbers cover", text: coverage)
            }
            .adminColumn(layout)
            .padding(.top, 24)
        } else {
            if let traffic = board.notes.traffic {
                AdminNote(slug: traffic.slug, text: traffic.text)
                    .adminLeadingPage(layout)
                    .adminColumn(layout)
                    .padding(.top, 24)
            }
            if let coverage = board.notes.coverage {
                AdminNote(slug: "what those four numbers cover", text: coverage)
                    .adminLeadingPage(layout)
                    .adminColumn(layout)
                    .padding(.top, 24)
            }
        }

        // The standing totals nobody needs set in 44pt type.
        VStack(alignment: .leading, spacing: 26) {
            AdminSectionHeading(marker: "tally / standing totals", title: "Everything else, ruled off.")
                .adminLeadingPage(layout)
            AdminTallySheet(columns: board.tally, layout: layout)
        }
        .adminColumn(layout)
        .padding(.top, layout.sectionGap)

        // The drawers: everything that needs a chart, a list or a form.
        VStack(alignment: .leading, spacing: 26) {
            AdminSectionHeading(marker: "drawers / open one to read it", title: "The detail, filed.")
                .adminLeadingPage(layout)
            drawers(board, layout: layout)
        }
        .adminColumn(layout)
        .padding(.top, layout.sectionGap)
    }

    private func masthead(_ board: AdminDashboard) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            AdminMasthead(
                marker: "sheet / admin",
                title: "Everything the site knows about itself.",
                lede: "Read straight off the database on every load, with no rounding and no smoothing. Where a number cannot see the whole history, it says so underneath."
            )
            AdminRefreshStamp(seconds: board.refreshSeconds)
                .padding(.top, 20)
            // Wayfinding only, with no count: the count lives in the card.
            if board.role.isSuperAdmin {
                AdminLink(to: .team) {
                    Text("team / manage admins")
                        .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
                        .foregroundStyle(LF.Palette.blue)
                        .underline(true, color: LF.Palette.blue)
                        .frame(minHeight: LF.Metrics.tap)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Opens the admin team desk")
                .padding(.top, 4)
            }
        }
    }

    // MARK: Drawers

    private func binding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { openDrawers.contains(key) },
            set: { open in
                if open { openDrawers.insert(key) } else { openDrawers.remove(key) }
            }
        )
    }

    private func growthDrawer(_ board: AdminDashboard) -> some View {
        AdminDrawer("Growth", slug: "drawer / growth", badge: "last 30 days", isOpen: binding("growth")) {
            AdminGrowthChart(growth: board.growth, metric: $growthMetric)
        }
    }

    private func funnelDrawer(_ board: AdminDashboard) -> some View {
        AdminDrawer("Activation funnel", slug: "drawer / funnel", badge: board.funnel.badge, isOpen: binding("funnel")) {
            AdminMiniList(rows: board.funnel.rows, empty: board.funnel.empty)
            if let note = board.funnel.note {
                AdminFootnote(note)
            }
            if !board.funnel.anonymousRows.isEmpty {
                AdminDrawerSection("before signup / anonymous readers") {
                    AdminMiniList(rows: board.funnel.anonymousRows)
                    AdminFootnote(board.funnel.anonymousNote)
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Before signup, anonymous readers")
            }
        }
    }

    @ViewBuilder
    private func drawers(_ board: AdminDashboard, layout: AdminLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Growth and the funnel run the whole width on a wide window, like the site; on an
            // open iPhone Duo they take a page each, so the chart never sits across the fold.
            AdminColumnsLayout(columns: layout.isFoldSplit ? 2 : 1, spacing: 56, crease: layout.columnCrease) {
                growthDrawer(board)
                funnelDrawer(board)
            }

            AdminColumnsLayout(columns: layout.drawerColumns, spacing: 56, crease: layout.columnCrease) {
                AdminDrawer("Where they come from", slug: "drawer / sources", isOpen: binding("sources")) {
                    AdminSourceChart(sources: board.sources, metric: $sourceMetric, range: $sourceRange, isLargeText: layout.isLargeText)
                }
                AdminDrawer("What gets read", slug: "drawer / engagement", isOpen: binding("engagement")) {
                    AdminMiniListPair(
                        left: .init(title: "most-completed lessons", rows: board.engagement.lessons, empty: "No completions yet."),
                        right: .init(title: "top departments", rows: board.engagement.departments, empty: "No completions yet."),
                        isLargeText: layout.isLargeText
                    )
                }
                AdminDrawer("Teams and referrals", slug: "drawer / teams", isOpen: binding("teams")) {
                    AdminMiniListPair(
                        left: .init(title: "top teams", rows: board.teams.teams, empty: "No teams yet."),
                        right: .init(title: "top recruiters", rows: board.teams.recruiters, empty: "No referrals yet."),
                        isLargeText: layout.isLargeText
                    )
                    AdminDrawerSection("referral signups / by surface") {
                        AdminMiniList(rows: board.teams.surfaces, empty: "No referrals yet.")
                        if let footnote = board.teams.surfacesFootnote {
                            AdminFootnote(footnote)
                        }
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("Referral signups by surface")
                }
                AdminDrawer("Top articles", slug: "drawer / articles", isOpen: binding("articles")) {
                    AdminMiniList(rows: board.articles, empty: "No article views yet.")
                }
                AdminDrawer("Achievements", slug: "drawer / achievements", isOpen: binding("achievements")) {
                    AdminMiniList(rows: board.achievements, empty: "No achievements earned yet.")
                }
                AdminDrawer("Recent activity", slug: "drawer / activity", isOpen: binding("activity")) {
                    AdminActivityLists(activity: board.activity, isLargeText: layout.isLargeText)
                }
            }

            // The site's Feedback drawer is a screen of its own here, with room to reply. On an
            // open iPhone Duo it's the last line of the left page, and each page is ruled off
            // on its own, so no row or rule runs across the fold.
            AdminColumnsLayout(columns: layout.isFoldSplit ? 2 : 1, spacing: 56, crease: layout.columnCrease) {
                VStack(alignment: .leading, spacing: 0) {
                    feedbackRow(board)
                    // Closes the last drawer off, the way a ruled page ends.
                    InkRule()
                }
                if layout.isFoldSplit {
                    InkRule()
                }
            }
        }
    }

    private func feedbackRow(_ board: AdminDashboard) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            AdminLink(to: .feedback) {
                AdminDrawerHeader(
                    title: "Feedback",
                    slug: "drawer / feedback",
                    badge: board.now.openFeedback > 0 ? "\(board.now.openFeedback) open" : nil,
                    trailing: "open",
                    arrow: true
                )
            }
            .buttonStyle(AdminDrawerButtonStyle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(board.now.openFeedback > 0 ? "Feedback, \(board.now.openFeedback) open" : "Feedback")
            .accessibilityHint("Opens the feedback inbox")
            .accessibilityAddTraits([.isHeader, .isButton])
        }
    }
}

// MARK: - Previews

#Preview("Dashboard, iPhone") {
    NavigationStack {
        AdminDashboardView()
    }
    .adminStore(.preview(role: .superadmin, dashboard: AdminPreviewData.dashboard))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Dashboard, iPad, dark", traits: .fixedLayout(width: 1180, height: 820)) {
    NavigationStack {
        AdminDashboardView()
    }
    .adminStore(.preview(role: .admin, dashboard: AdminPreviewData.dashboard))
    .appEnvironment(.preview(signedIn: true))
    .preferredColorScheme(.dark)
}

#Preview("Dashboard, AX5", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        AdminDashboardView()
    }
    .adminStore(.preview(role: .admin, dashboard: AdminPreviewData.dashboard))
    .appEnvironment(.preview(signedIn: true))
    .dynamicTypeSize(.accessibility5)
}

#Preview("Dashboard, locked") {
    NavigationStack {
        AdminDashboardView()
    }
    .adminStore(.preview(role: .member, lockedDashboard: AdminError.adminOnly))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Dashboard, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 2400)) {
    NavigationStack {
        AdminDashboardView()
    }
    .adminStore(.preview(role: .superadmin, dashboard: AdminPreviewData.dashboard))
    .appEnvironment(.preview(signedIn: true))
    .previewFold(.previewBook)
}

#Preview("Dashboard, iPhone Duo open, AX5", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 3000)) {
    NavigationStack {
        AdminDashboardView()
    }
    .adminStore(.preview(role: .admin, dashboard: AdminPreviewData.dashboard))
    .appEnvironment(.preview(signedIn: true))
    .previewFold(.previewFlat)
    .dynamicTypeSize(.accessibility5)
}
