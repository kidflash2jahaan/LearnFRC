import SwiftUI

/// learnfrc.com/admin/team in the app: the admin team. Super admins only.
///
/// What the page is, then the drawers like the site: Old applications (only while one from
/// before /apply closed is waiting; it opens itself, and the only answer is Reject), The admin
/// team, and Decided. Teacher applications are decided on learnfrc.com/admin/classes/teachers.
/// No real names and no email addresses anywhere, because the server never sends one. An admin
/// who isn't a super admin gets the site's locked card.
struct AdminTeamView: View {
    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account

    @State private var isOnScreen = false
    @State private var openDrawers: Set<String> = []
    @State private var didAutoOpen = false
    /// The last decision's toast, kept on the page ("Turned down. They'll get an email.").
    @State private var applicationStatus: String?
    /// The last team change's toast ("Role saved.").
    @State private var teamStatus: String?

    private var admin: AdminStore { injected ?? .shared }

    private static let title = "Who’s on the admin team."

    var body: some View {
        AdminPage(avoidsKeyboard: true, refresh: { await refresh() }) { layout in
            content(layout)
        }
        .navigationTitle(AdminDestination.team.title)
        #if os(iOS)
        .toolbarTitleDisplayMode(.inline)
        #endif
        .adminRefreshControl(isLoading: admin.team.isLoading) {
            Task { await refresh() }
        }
        .adminHandoff(.team, isOnShow: isOnScreen && admin.isSuperAdmin)
        .onAppear { isOnScreen = true }
        .onDisappear { isOnScreen = false }
        .task(id: account.userID) {
            await admin.sync(userID: account.userID)
            await admin.loadTeam()
        }
        .onChange(of: admin.team.value?.pending.count ?? 0, initial: true) { _, waiting in
            // An old application is the one thing on this page that needs doing: open it.
            guard !didAutoOpen, admin.team.value != nil else { return }
            didAutoOpen = true
            if waiting > 0 { openDrawers.insert("applications") }
        }
    }

    private func refresh() async {
        async let summary: Void = admin.sync(userID: account.userID, force: true)
        async let desk: Void = admin.loadTeam()
        _ = await (summary, desk)
    }

    @ViewBuilder
    private func content(_ layout: AdminLayout) -> some View {
        let remote = admin.team
        if !account.isSignedIn, !account.isLoading {
            AdminSignedOutCard(destination: .team)
                .adminLeadingPage(layout)
                .adminColumn(layout)
                .padding(.top, 40)
        } else if remote.locked != nil, remote.value == nil {
            Group {
                if admin.isAdmin { AdminLockedTeamCard() } else { AdminLockedDashboardCard() }
            }
            .adminLeadingPage(layout)
            .adminColumn(layout)
            .padding(.top, 40)
        } else if let desk = remote.value {
            if let error = remote.error {
                AdminLoadError(error: error, hasCopy: true) { Task { await admin.loadTeam() } }
                    .adminLeadingPage(layout)
                    .adminColumn(layout)
                    .padding(.bottom, 16)
            }
            desktop(desk, layout: layout)
        } else if let error = remote.error {
            AdminLoadError(error: error, hasCopy: false) { Task { await admin.loadTeam() } }
                .adminLeadingPage(layout)
                .adminColumn(layout)
                .padding(.top, 24)
        } else {
            VStack(alignment: .leading, spacing: 32) {
                AdminMasthead(marker: "sheet / team", title: Self.title)
                AdminLoadingBlock(lines: 6)
            }
            .adminLeadingPage(layout)
            .adminColumn(layout)
            .padding(.top, 12)
        }
    }

    @ViewBuilder
    private func desktop(_ desk: AdminTeamDesk, layout: AdminLayout) -> some View {
        AdminMasthead(
            marker: "sheet / team",
            title: Self.title,
            lede: "The admin team, and any application left from before applying closed. Teacher applications are decided on the teacher desk, on learnfrc.com."
        )
        .adminLeadingPage(layout)
        .adminColumn(layout)
        .padding(.top, 12)

        VStack(alignment: .leading, spacing: 18) {
            SectionLabel("drawers / open one to read it")
            // On an open iPhone Duo: anything waiting and the admin team on the left page; every
            // decision on the right, each page ruled off on its own. Elsewhere the drawers run
            // down one column. The same views either way, so unfolding the phone mid-note keeps
            // what's written.
            FoldPages(layout.pages) {
                if !desk.pending.isEmpty {
                    applications(desk, layout: layout)
                } else if let applicationStatus {
                    // The drawer goes once the last one is turned down; the toast stays.
                    AdminStatusLine(applicationStatus)
                }
                team(desk, layout: layout)
                if layout.isFoldSplit { InkRule() }
            } trailing: {
                decided(desk)
                InkRule()
            }
            .frame(maxWidth: layout.isFoldSplit ? .infinity : 900, alignment: .leading)
        }
        .adminColumn(layout)
        .padding(.top, layout.sectionGap)
    }

    private func binding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { openDrawers.contains(key) },
            set: { open in
                if open { openDrawers.insert(key) } else { openDrawers.remove(key) }
            }
        )
    }

    // MARK: Old applications

    private func applications(_ desk: AdminTeamDesk, layout: AdminLayout) -> some View {
        AdminDrawer(
            "Old applications",
            slug: "drawer / old applications",
            badge: "\(desk.pending.count) waiting",
            isOpen: binding("applications")
        ) {
            if let applicationStatus {
                AdminStatusLine(applicationStatus)
                    .padding(.bottom, 16)
            }
            FieldHint("Applying here is closed. Turn these down with a short note. Teacher applications are decided on learnfrc.com.")
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.bottom, 12)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(desk.pending.enumerated()), id: \.element.id) { index, application in
                    if index > 0 { DashedRule() }
                    AdminApplicationRow(application: application) { status in
                        applicationStatus = status
                    }
                    .padding(.vertical, 20)
                }
            }
            if desk.pendingTruncated {
                FieldHint("60 shown, which is the page size. If there are more, they come up once you clear these.")
                    .padding(.top, 12)
            }
        }
    }

    // MARK: The admin team

    private func team(_ desk: AdminTeamDesk, layout: AdminLayout) -> some View {
        AdminDrawer(
            "The admin team",
            slug: "drawer / the admin team",
            badge: "\(desk.team.count) \(desk.team.count == 1 ? "person" : "people")",
            isOpen: binding("team")
        ) {
            if let teamStatus {
                AdminStatusLine(teamStatus)
                    .padding(.bottom, 16)
            }
            if desk.team.isEmpty {
                SlugText("Nobody has been added yet. Your own access comes from the owner email in the site config rather than from this list, so you won’t see yourself here.")
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(desk.team.enumerated()), id: \.element.id) { index, member in
                        if index > 0 { DashedRule() }
                        // Inside one page of a fold the controls go under the name.
                        AdminMemberRow(member: member, isWide: layout.isWide && !layout.isFoldSplit) { status in
                            teamStatus = status
                        }
                        .padding(.vertical, 16)
                    }
                }
            }
        }
    }

    // MARK: Decided

    private func decided(_ desk: AdminTeamDesk) -> some View {
        AdminDrawer("Decided", slug: "drawer / decided", isOpen: binding("decided")) {
            if desk.decided.isEmpty {
                SlugText("Nothing decided yet. Every answer you give lands here afterwards.")
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(desk.decided.enumerated()), id: \.element.id) { index, entry in
                        if index > 0 { DashedRule() }
                        VStack(alignment: .leading, spacing: 6) {
                            AdminFlowLayout(spacing: 14, lineSpacing: 4) {
                                SlugText(AdminText.day(entry.reviewedAt ?? entry.createdAt) ?? "not recorded")
                                SlugText(entry.username.map { "@\($0)" } ?? "no username yet", color: LF.Palette.ink)
                                SlugText(entry.statusWord, color: LF.Palette.ink, weight: .bold)
                            }
                            if let note = entry.reviewNote {
                                SlugText("note / \(note)")
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(maxWidth: 620, alignment: .leading)
                            }
                        }
                        .padding(.vertical, 10)
                        .accessibilityElement(children: .combine)
                    }
                }
                if desk.decidedTruncated {
                    FieldHint("The 30 most recent. Older ones are still on file, they’re just not printed here.")
                        .padding(.top, 12)
                }
            }
        }
    }
}

// MARK: - One old application

/// One application from before /apply closed, ruled onto the page: who it is and when it
/// landed, both answers, then the note and the armed Reject. There's no Accept: the role it was
/// for is gone, and the server refuses one.
struct AdminApplicationRow: View {
    let application: AdminTeamDesk.Application
    let onDecided: (String) -> Void

    @Environment(AdminStore.self) private var injected: AdminStore?
    @State private var note = ""
    @State private var choice: AdminDecision?
    @State private var isArmed = false
    @State private var error: AdminError?
    @FocusState private var noteFocused: Bool

    private var admin: AdminStore { injected ?? .shared }
    private var isBusy: Bool { choice != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AdminFlowLayout(spacing: 14, lineSpacing: 4) {
                SlugText(application.username.map { "@\($0)" } ?? "no username yet", color: LF.Palette.ink, weight: .bold)
                SlugText("team / \(application.teamNumber.map(String.init) ?? "not given")")
                SlugText("role / \(application.teamRoleLabel)")
                SlugText("came in \(AdminText.ago(application.createdAt, ago: true))")
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(verbatim: "\(application.username.map { "@\($0)" } ?? "No username yet"), team \(application.teamNumber.map(String.init) ?? "not given"), \(application.teamRoleLabel), came in \(AdminText.spokenAgo(application.createdAt))"))

            if let availability = application.availability {
                SlugText("availability / \(availability)")
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 640, alignment: .leading)
                    .padding(.top, 6)
            }

            VStack(alignment: .leading, spacing: 14) {
                answer("what they’ve done in FRC", application.experience)
                answer("why they want to help", application.why)
            }
            .padding(.top, 14)

            controls
                .padding(.top, 18)
        }
    }

    private func answer(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            SlugText(label)
            Text(text)
                .lfProse(16.5, lineHeight: 1.45)
                .textSelection(.enabled)
                .frame(maxWidth: 640, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 7) {
            FieldLabel("Note to them, optional; it goes in the email")
            TextField("", text: $note, axis: .vertical)
                .lineLimit(2...8)
                .focused($noteFocused)
                .inkField(focused: noteFocused, invalid: error?.field == "note")
                .disabled(isBusy)
                .accessibilityLabel(Text(verbatim: "Note to them, optional; it goes in the email, to \(application.handle)"))
                .onChange(of: note) { _, value in
                    if value.count > 1000 { note = String(value.prefix(1000)) }
                }
            FieldHint("Leave it blank and the email still goes.")
            if let error {
                FieldError(error.message)
            }

            AdminFlowLayout(spacing: 12, lineSpacing: 10) {
                ArmedButton(
                    title: "Reject",
                    armedTitle: "Yes, reject",
                    busyTitle: "Rejecting",
                    handle: application.handle,
                    isBusy: choice == .reject,
                    isArmed: $isArmed
                ) {
                    send(.reject)
                }
                .disabled(isBusy && choice != .reject)
            }
            .padding(.top, 8)

            if isArmed, choice == nil {
                FieldHint("One more click turns down \(application.handle). You can’t take it back here.")
                    .frame(maxWidth: 440, alignment: .leading)
                    .onAppear {
                        AccessibilityNotification.Announcement("One more click turns down \(application.handle). You can’t take it back here.").post()
                    }
            }
        }
        .frame(maxWidth: 640, alignment: .leading)
    }

    private func send(_ decision: AdminDecision) {
        guard choice == nil else { return }
        choice = decision
        error = nil
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do throws(AdminError) {
                try await admin.decide(application.id, decision: decision, note: trimmed.isEmpty ? nil : trimmed)
                onDecided("Turned down. They’ll get an email.")
                admin.refreshTeamQuietly()
            } catch {
                // Still armed on a fixable failure: re-arming to retry is a punishment for the
                // server's mistake. The timer disarms it either way.
                choice = nil
                self.error = error
            }
        }
    }
}

// MARK: - One member

/// One person on the team: handle, role word, "you", since when, and (for anyone who isn't an
/// owner or you) the role picker with Save and the armed Remove.
struct AdminMemberRow: View {
    let member: AdminTeamDesk.Member
    var isWide: Bool
    let onChanged: (String) -> Void

    @Environment(AdminStore.self) private var injected: AdminStore?
    @State private var role: SiteRole = .admin
    @State private var intent: Intent?
    @State private var isArmed = false
    @State private var error: String?

    private enum Intent { case role, remove }

    /// Room for "super admin" at the current text size, so the picker doesn't change width.
    @ScaledMetric(relativeTo: .body) private var pickerTextWidth: CGFloat = 104

    private var admin: AdminStore { injected ?? .shared }
    private var isBusy: Bool { intent != nil }

    var body: some View {
        Group {
            if isWide, member.canChange {
                HStack(alignment: .top, spacing: 32) {
                    identity.frame(maxWidth: .infinity, alignment: .leading)
                    controls.frame(maxWidth: 360, alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    identity
                    if member.canChange { controls }
                }
            }
        }
        .onAppear { role = member.role }
        .onChange(of: member.role) { _, new in role = new }
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 6) {
            AdminFlowLayout(spacing: 12, lineSpacing: 6) {
                Text(member.username.map { "@\($0)" } ?? "no username yet")
                    .font(LF.Fonts.body(16.5, weight: .bold, relativeTo: .body))
                    .foregroundStyle(LF.Palette.ink)
                SlugText(member.roleWord, color: LF.Palette.ink, weight: .bold)
                if member.isYou { TagView("you") }
            }
            AdminFlowLayout(spacing: 14, lineSpacing: 4) {
                SlugText("team / \(member.teamNumber.map(String.init) ?? "not given")")
                SlugText("since \(AdminText.day(member.grantedAt) ?? "not recorded")")
            }
            if let note = member.note {
                SlugText("note / \(note)")
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 620, alignment: .leading)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 8) {
            FieldLabel("Role")
                .accessibilityHidden(true)
            AdminFlowLayout(spacing: 12, lineSpacing: 10) {
                Menu {
                    Picker("Role", selection: $role) {
                        Text("admin").tag(SiteRole.admin)
                        Text("super admin").tag(SiteRole.superadmin)
                    }
                } label: {
                    // As wide as its longest word, like the site's `w-auto min-w-[10rem]`.
                    HStack(spacing: 10) {
                        Text(role == .superadmin ? "super admin" : "admin")
                            .frame(minWidth: pickerTextWidth, alignment: .leading)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption.weight(.semibold))
                            .accessibilityHidden(true)
                    }
                    .fixedSize()
                    .inkField()
                    .fixedSize()
                }
                .disabled(isBusy)
                .accessibilityLabel(Text(verbatim: "Role for \(member.handle)"))
                .accessibilityValue(role == .superadmin ? "super admin" : "admin")

                Button(intent == .role ? "Saving" : "Save role") { save() }
                    .buttonStyle(.inkSmall)
                    .disabled(isBusy || role == member.role)
                    .accessibilityLabel(Text(verbatim: "\(intent == .role ? "Saving" : "Save role") for \(member.handle)"))

                ArmedButton(
                    title: "Remove",
                    armedTitle: "Yes, remove",
                    busyTitle: "Removing",
                    handle: member.handle,
                    isBusy: intent == .remove,
                    isArmed: $isArmed
                ) {
                    remove()
                }
                .disabled(isBusy && intent != .remove)
            }

            if isArmed, intent == nil {
                FieldHint("One more click takes \(member.handle) off the team. They keep their account and their progress, they just lose /admin.")
                    .frame(maxWidth: 440, alignment: .leading)
                    .onAppear {
                        AccessibilityNotification.Announcement("One more click takes \(member.handle) off the team. They keep their account and their progress, they just lose /admin.").post()
                    }
            }
            if let error {
                FieldError(error)
                    .frame(maxWidth: 420, alignment: .leading)
            }
        }
    }

    private func save() {
        guard intent == nil, role != member.role else { return }
        intent = .role
        isArmed = false
        error = nil
        let newRole = role
        Task {
            do throws(AdminError) {
                try await admin.setRole(of: member.userId, to: newRole)
                intent = nil
                onChanged("Role saved.")
            } catch {
                intent = nil
                self.error = error.message
            }
        }
    }

    private func remove() {
        guard intent == nil else { return }
        intent = .remove
        error = nil
        Task {
            do throws(AdminError) {
                try await admin.remove(member.userId)
                onChanged("Off the team. /admin is shut to them now.")
            } catch {
                intent = nil
                self.error = error.message
            }
        }
    }
}

// MARK: - Previews

#Preview("Team desk, iPhone") {
    NavigationStack {
        AdminTeamView()
    }
    .adminStore(.preview(role: .superadmin, team: AdminPreviewData.team))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Team desk, iPad, dark", traits: .fixedLayout(width: 1180, height: 820)) {
    NavigationStack {
        AdminTeamView()
    }
    .adminStore(.preview(role: .superadmin, team: AdminPreviewData.team))
    .appEnvironment(.preview(signedIn: true))
    .preferredColorScheme(.dark)
}

#Preview("Team desk, locked for an admin") {
    NavigationStack {
        AdminTeamView()
    }
    .adminStore(.preview(role: .admin, lockedTeam: AdminError.superAdminOnly))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Team desk, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 2000)) {
    NavigationStack {
        AdminTeamView()
    }
    .adminStore(.preview(role: .superadmin, team: AdminPreviewData.team))
    .appEnvironment(.preview(signedIn: true))
    .previewFold(.previewBook)
}
