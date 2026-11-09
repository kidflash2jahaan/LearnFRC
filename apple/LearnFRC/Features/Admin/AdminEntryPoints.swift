import SwiftUI

// The small admin pieces other screens place: the You tab's admin box and "Teach a live class"
// row, the Settings identity card's "admin" tag, and the Go menu's items. Each draws nothing
// unless the server has said this account holds the role (or, for the teach row, that classes
// are open), and each keeps that fresh for the signed-in account on its own.

// MARK: - You tab

/// The You tab's "site admin" box: Admin (the numbers and the feedback inbox) for admins, and
/// Admin team for super admins. Nothing for everyone else.
struct AdminYouSection: View {
    /// Space above the box when it shows (it draws nothing, and takes no room, otherwise).
    var topPadding: CGFloat = 36

    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account
    @Environment(\.scenePhase) private var scenePhase

    private var admin: AdminStore { injected ?? .shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if admin.isAdmin {
                box.padding(.top, topPadding)
            }
        }
        .task(id: account.userID) {
            await admin.sync(userID: account.userID)
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await admin.sync(userID: account.userID) }
        }
    }

    private var box: some View {
        let summary = admin.summary
        return VStack(alignment: .leading, spacing: 0) {
            SlugText("site admin")
                .accessibilityAddTraits(.isHeader)

            VStack(alignment: .leading, spacing: 0) {
                InkRule()
                AdminLink(to: .dashboard) {
                    row(
                        title: "Admin",
                        detail: "The numbers and the feedback inbox.",
                        badge: summary.flatMap { $0.openFeedback > 0 ? "\($0.openFeedback) open" : nil }
                    )
                }
                .buttonStyle(.inkRow)
                .accessibilityHint("Opens the admin panel")
            }
            .padding(.top, 12)

            if admin.isSuperAdmin {
                VStack(alignment: .leading, spacing: 0) {
                    InkRule()
                    AdminLink(to: .team) {
                        row(title: "Admin team", detail: waitingLine(summary?.pendingApplications), badge: nil)
                    }
                    .buttonStyle(.inkRow)
                    .accessibilityHint("Opens the admin team desk")
                }
                .padding(.top, 14)
            }
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox()
    }

    private func waitingLine(_ count: Int?) -> String {
        switch count {
        case nil: "Applications, the team, and every decision."
        case 0: "Nobody is waiting."
        case 1: "1 application waiting"
        default: "\(count ?? 0) applications waiting"
        }
    }

    private func row(title: String, detail: String, badge: String?) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                AdminFlowLayout(spacing: 10, lineSpacing: 6) {
                    Text(title)
                        .font(LF.Fonts.body(17, weight: .bold))
                        .foregroundStyle(LF.Palette.ink)
                    if let badge { TagView(badge, on: true) }
                }
                Text(detail)
                    .font(LF.Fonts.body(14.5, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
            Image(systemName: "arrow.right")
                .font(.footnote.weight(.bold))
                .foregroundStyle(LF.Palette.blue)
                .padding(.top, 4)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }
}

/// "Teach a live class": a quiet row on the You tab to the Apply screen, the site footer's
/// "Teach a class". Shown only while the site says classes are open, to anyone, guests included
/// (the site asks a guest to sign in first); it takes no room otherwise. Teaching is the only
/// application LearnFRC takes.
struct ApplyLinkRow: View {
    var topPadding: CGFloat = 36

    @Environment(ClassesStore.self) private var injected: ClassesStore?
    @Environment(AccountStore.self) private var account

    private var classes: ClassesStore { injected ?? .shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if classes.isVisible {
                VStack(alignment: .leading, spacing: 0) {
                    DashedRule()
                    AdminLink(to: .apply) {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 3) {
                                SlugText("apply / teach")
                                Text("Teach a live class")
                                    .font(LF.Fonts.body(16.5, weight: .semibold))
                                    .foregroundStyle(LF.Palette.ink)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "arrow.right")
                                .font(.footnote.weight(.bold))
                                .foregroundStyle(LF.Palette.blue)
                                .accessibilityHidden(true)
                        }
                        .padding(.vertical, 12)
                        .accessibilityElement(children: .combine)
                    }
                    .buttonStyle(.inkRow)
                    .accessibilityHint("What teaching a live class involves, and how to apply")
                    DashedRule()
                }
                .padding(.top, topPadding)
            }
        }
        .task(id: account.isLoading ? nil : (account.userID?.uuidString ?? "guest")) {
            guard !account.isLoading else { return }
            await classes.load(userID: account.userID)
        }
    }
}

// MARK: - Settings

/// The identity card's "admin" tag (the site's filled `nb-tag`). Nothing unless this account
/// is an admin.
struct AdminIdentityTag: View {
    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account

    private var admin: AdminStore { injected ?? .shared }

    var body: some View {
        HStack(spacing: 0) {
            if admin.isAdmin {
                TagView("admin", on: true)
                    .accessibilityLabel("Site admin")
            }
        }
        .task(id: account.userID) {
            await admin.sync(userID: account.userID)
        }
    }
}

// MARK: - Go menu

/// The Go menu's admin items (Mac and iPad): "Admin" for admins, "Admin team" for super
/// admins, nothing for anyone else. `open` navigates the target window (`AppCommands`).
struct AdminMenuItems: View {
    let open: @MainActor (AdminDestination) -> Void

    private var admin: AdminStore { .shared }

    var body: some View {
        if admin.isAdmin {
            Divider()
            Button(AdminDestination.dashboard.title) { open(.dashboard) }
            if admin.isSuperAdmin {
                Button(AdminDestination.team.title) { open(.team) }
            }
        }
    }
}

// MARK: - Previews

#Preview("You tab admin box", traits: .fixedLayout(width: 393, height: 520)) {
    ScrollView {
        VStack(alignment: .leading, spacing: 0) {
            AdminYouSection(topPadding: 0)
            ApplyLinkRow()
            HStack {
                Text("Identity card tag").font(LF.Fonts.body(15))
                AdminIdentityTag()
            }
            .padding(.top, 24)
        }
        .padding(LF.Metrics.gutter)
    }
    .paperBackground()
    .environment(ClassesStore.preview(.preview(signedIn: true)))
    .adminStore(.preview(role: .superadmin, summary: AdminPreviewData.dashboard.summary))
    .appEnvironment(.preview(signedIn: true))
}
