import SwiftUI

// The small admin pieces other screens place: the lesson footer's verify control, the You
// tab's admin box and "Help run it" row, the Settings identity card's "admin" tag, and the Go
// menu's items. Each draws nothing unless the server has said this account holds the role, and
// each keeps the role fresh for the signed-in account on its own (`AdminStore.sync`).

// MARK: - Verify control (lesson footer)

/// The admin-only verify control, where the lesson's verified mark goes (the site's
/// `VerifyLessonIsland`). Puts the public mark on or takes it off; the lesson's own badge
/// updates at once. Nothing at all for anyone who isn't an admin.
struct AdminVerifyLessonControl: View {
    let lessonID: UUID

    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account
    @Environment(CatalogStore.self) private var catalog
    @State private var isSaving = false
    @State private var error: String?

    private var admin: AdminStore { injected ?? .shared }

    /// This session's change if there was one, else the catalog's copy of the lesson.
    private var verifiedAt: Date? {
        if let mark = admin.verifiedMarks[lessonID] { return mark.verifiedAt }
        return catalog.lessonBody(lessonID)?.verifiedAt
    }

    var body: some View {
        // A container that's always there (empty and zero-sized for everyone else), so the
        // role check below runs before there's anything to show.
        VStack(alignment: .leading, spacing: 0) {
            if admin.isAdmin {
                control
                    .padding(.top, 12)
            }
        }
        .task(id: account.userID) {
            await admin.sync(userID: account.userID)
        }
    }

    private var control: some View {
        let verified = verifiedAt != nil
        return VStack(alignment: .leading, spacing: 8) {
            Button(isSaving ? "Saving" : (verified ? "Remove verified mark" : "Mark this lesson verified")) {
                toggle(to: !verified)
            }
            .buttonStyle(verified ? InkButtonStyle(.ghost) : InkButtonStyle(.primary))
            .disabled(isSaving)
            .accessibilityAddTraits(.isToggle)
            .accessibilityValue(verified ? "Verified" : "Not verified")
            // Said next to the button: the mark is a public claim.
            SlugText(verified ? "readers see a verified mark on this lesson" : "admin only, this puts a public verified mark on the lesson")
                .fixedSize(horizontal: false, vertical: true)
            if let error {
                FieldError("Could not save: \(error)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func toggle(to verified: Bool) {
        guard !isSaving else { return }
        isSaving = true
        error = nil
        Task {
            do throws(AdminError) {
                let date = try await admin.setVerified(lessonID: lessonID, verified: verified)
                patchCatalog(verifiedAt: date)
            } catch {
                self.error = error.message
            }
            isSaving = false
        }
    }

    /// Puts the new mark on the catalog's copy of the lesson, so the lesson's badge (and the
    /// guides) show it straight away. The next catalog refresh brings the server's copy.
    private func patchCatalog(verifiedAt date: Date?) {
        guard let body = catalog.lessonBody(lessonID) else { return }
        // The server records the checker's username with the mark and clears it with it.
        let patched = LessonBody(
            id: body.id, content: body.content, keyTakeaways: body.keyTakeaways, resources: body.resources,
            quiz: body.quiz, verifiedAt: date, verifiedBy: date == nil ? nil : account.profile?.username,
            verifiedNote: body.verifiedNote, verifiedSources: body.verifiedSources, youtubeID: body.youtubeID
        )
        catalog.apply(bodies: [patched], complete: false)
    }
}

// MARK: - You tab

/// The You tab's "site admin" box: Admin (the numbers, the feedback inbox, the verified mark)
/// for admins, and Admin team for super admins. Nothing for everyone else.
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
                        detail: "The numbers, the feedback inbox, the verified mark.",
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

/// "Help run it" (the site footer's words): a quiet row to /apply for anyone who isn't on the
/// admin team, guests included (the page asks a guest to sign in first).
struct ApplyLinkRow: View {
    var topPadding: CGFloat = 36

    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account

    private var admin: AdminStore { injected ?? .shared }

    /// Signed in, wait for the server's answer before offering it (an admin never sees it).
    private var isShown: Bool {
        if account.isGuest { return true }
        return account.isSignedIn && admin.role == .member
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isShown {
                VStack(alignment: .leading, spacing: 0) {
                    DashedRule()
                    AdminLink(to: .apply) {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 3) {
                                SlugText("apply / the admin team")
                                Text("Help run it")
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
                    .accessibilityHint("What helping run LearnFRC involves, and how to apply")
                    DashedRule()
                }
                .padding(.top, topPadding)
            }
        }
        .task(id: account.userID) {
            await admin.sync(userID: account.userID)
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
            AdminVerifyLessonControl(lessonID: UUID())
                .padding(.top, 24)
            HStack {
                Text("Identity card tag").font(LF.Fonts.body(15))
                AdminIdentityTag()
            }
            .padding(.top, 24)
        }
        .padding(LF.Metrics.gutter)
    }
    .paperBackground()
    .adminStore(.preview(role: .superadmin, summary: AdminPreviewData.dashboard.summary))
    .appEnvironment(.preview(signedIn: true))
}
