import SwiftUI

/// learnfrc.com/apply in the app: the way in, for somebody who wants to take a piece of running
/// the site.
///
/// Shaped like the site, in the order somebody actually decides in: what the job is, what it
/// doesn't come with, whether it's for them, and only then where they stand. One section, five
/// states (signed out, already on the team, pending, no handle yet, applying again or new), and
/// while applications are closed the form gives way to the site's closed note.
struct ApplyView: View {
    @Environment(AdminStore.self) private var injected: AdminStore?
    @Environment(AccountStore.self) private var account

    @State private var authScreen: AuthFlowView.Screen?
    @State private var isOnScreen = false
    /// Set by a successful send: the receipt shows over the pending state.
    @State private var justSent = false

    private var admin: AdminStore { injected ?? .shared }

    var body: some View {
        AdminPage(avoidsKeyboard: true, refresh: { await reload() }) { layout in
            // On an open iPhone Duo: what the job is on the left page, where you stand (and
            // the form) on the right. The same views either way, so unfolding the phone
            // mid-answer keeps what's written.
            FoldPages(layout.pages) {
                header
                work(layout)
                whoItSuits
            } trailing: {
                standing(layout, top: layout.isFoldSplit ? 0 : 52)
                footer
            }
            .frame(maxWidth: layout.isFoldSplit ? .infinity : 830, alignment: .leading)
            .adminColumn(layout)
            .padding(.top, 12)
        }
        .navigationTitle(AdminDestination.apply.title)
        #if os(iOS)
        .toolbarTitleDisplayMode(.inline)
        #endif
        .adminHandoff(.apply, isOnShow: isOnScreen)
        .onAppear { isOnScreen = true }
        .onDisappear { isOnScreen = false }
        .authSheet(item: $authScreen)
        .task(id: account.userID) {
            justSent = false
            await reload()
        }
        // The two links in the signed-out card's hint open the sign-up sheet in place.
        .environment(\.openURL, OpenURLAction { url in
            if url.scheme == "learnfrc-apply" {
                authScreen = url.host() == "signup" ? .signUp : .signIn
                return .handled
            }
            return .systemAction
        })
    }

    private func reload() async {
        await admin.sync(userID: account.userID)
        if account.isSignedIn { await admin.loadApply() }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            AccountHeader(
                marker: "apply / the admin team",
                title: accountMarked("Help ", "run", " LearnFRC."),
                lede: "One person writes the lessons here, and the same person answers everything that comes back. The second half is the part I want help with. If you’ve been on an FRC team, you can take a piece of it."
            )
            MarkerText("most of it is reading what people send in")
                .frame(maxWidth: 300, alignment: .leading)
                .padding(.top, 18)
                .padding(.leading, 4)
        }
    }

    // MARK: The work

    private func work(_ layout: AdminLayout) -> some View {
        let jobs = admin.applyState.value?.jobs ?? AdminApplyState.siteJobs
        return VStack(alignment: .leading, spacing: 0) {
            sectionHeading("What an admin does", slug: "four jobs, and that is the list")

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(jobs.enumerated()), id: \.offset) { _, job in
                    DashedRule()
                    Group {
                        if layout.isRegular {
                            HStack(alignment: .firstTextBaseline, spacing: 28) {
                                jobSlug(job.slug).frame(width: 170, alignment: .leading)
                                jobText(job.text)
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 6) {
                                jobSlug(job.slug)
                                jobText(job.text)
                            }
                        }
                    }
                    .padding(.vertical, 15)
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(.top, 18)

            NoteCallout {
                SlugText("what the job does not come with")
                VStack(alignment: .leading, spacing: 10) {
                    bullet("No real names. Everyone in the panel is a handle and a team number. An application adds the FRC role they picked and what they wrote in the three boxes, and that is the end of it.")
                    bullet("No email addresses. Replies leave through the site, so you answer somebody without ever seeing where the answer goes.")
                    bullet("No new editing rights. Reviewing an edit is not writing one. You can merge somebody else’s change and mark a lesson verified, and you can suggest an edit exactly like any other account can.")
                }
                .padding(.top, 6)
                Text("That is deliberate, and it is not loosening later. Nobody needs a stranger’s legal name to answer a question about swerve.")
                    .lfProse(15, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)
            }
            .frame(maxWidth: 700, alignment: .leading)
            .padding(.top, 26)
        }
        .padding(.top, 40)
    }

    private func jobSlug(_ text: String) -> some View {
        SlugText(text, color: LF.Palette.ink, weight: .bold)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func jobText(_ text: String) -> some View {
        Text(text)
            .lfProse(16, lineHeight: 1.55, color: LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("-")
                .font(LF.Fonts.body(16, weight: .bold))
                .foregroundStyle(LF.Palette.blue)
                .accessibilityHidden(true)
            Text(text)
                .lfProse(15.5, lineHeight: 1.5)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Who it suits

    private var whoItSuits: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeading("Who this suits", slug: nil)
            VStack(alignment: .leading, spacing: 14) {
                Text("Somebody who has actually been on an FRC team. Student, mentor, alum, coach, it makes no difference which. The job is judging whether an answer about a gearbox or a CAN bus or a scouting app is right, and that comes from having done it, not from reading about it.")
                Text("A few hours a month is enough, and there are quiet weeks. It is unpaid. Nothing on this site makes money, so there is nothing to pay anyone out of. What you get instead is a say in what a free curriculum tells the next rookie who finds it.")
            }
            .lfProse(16, lineHeight: 1.55, color: LF.Palette.graphite)
            .frame(maxWidth: 640, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 16)
        }
        .padding(.top, 52)
    }

    private func sectionHeading(_ title: String, slug: String?) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            AdminFlowLayout(spacing: 20, lineSpacing: 6) {
                Text(title)
                    .font(LF.Fonts.display(25, relativeTo: .title2))
                    .tracking(25 * -0.025)
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                if let slug { SlugText(slug) }
            }
            .padding(.top, 22)
        }
    }

    // MARK: Where you stand

    @ViewBuilder
    private func standing(_ layout: AdminLayout, top: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if !account.isSignedIn, !account.isLoading {
                sectionHeading(AdminApplyState.signedOutHeading.title, slug: AdminApplyState.signedOutHeading.slug)
                signedOutCard.padding(.top, 24)
            } else if let state = admin.applyState.value {
                sectionHeading(state.heading.title, slug: state.heading.slug)
                if let error = admin.applyState.error {
                    AdminLoadError(error: error, hasCopy: true) { Task { await admin.loadApply() } }
                        .padding(.top, 16)
                }
                stateBlock(state)
                    .padding(.top, 24)
            } else if let error = admin.applyState.error {
                sectionHeading("Apply", slug: nil)
                AdminLoadError(error: error, hasCopy: false) { Task { await admin.loadApply() } }
                    .padding(.top, 24)
            } else {
                sectionHeading("Apply", slug: nil)
                AdminLoadingBlock(lines: 3).padding(.top, 24)
            }
        }
        .padding(.top, top)
    }

    @ViewBuilder
    private func stateBlock(_ state: AdminApplyState) -> some View {
        switch state.mode {
        case .onTheTeam:
            NotebookCard(tilt: .preset(1), tape: true, padding: 24) {
                SlugText("you already have the keys")
                cardText("This account can open the admin panel, answer the feedback readers send in, review suggested edits and mark a lesson verified. There is nothing here left to apply for.")
                AdminLink(to: .dashboard) { Text("Open the admin panel") }
                    .buttonStyle(.ink)
                    .padding(.top, 22)
            }
            .frame(maxWidth: 640, alignment: .leading)

        case .pending:
            VStack(alignment: .leading, spacing: 0) {
                if justSent {
                    receipt
                } else {
                    NotebookCard(tilt: .preset(3), tape: true, padding: 24) {
                        SlugText("sent \(AdminText.day(state.application?.createdAt) ?? "recently")")
                        Text("It’s on the desk, waiting to be read.")
                            .font(LF.Fonts.body(17, weight: .semibold))
                            .foregroundStyle(LF.Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 12)
                        Text("Nothing else is needed from you, and there is no second step. You’ll get an email either way, and this page says where it stands until then.")
                            .lfProse(16, lineHeight: 1.5, color: LF.Palette.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 8)
                        ApplyWithdrawForm()
                            .padding(.top, 20)
                    }
                    .frame(maxWidth: 640, alignment: .leading)
                }
                FieldHint("One open application at a time. Withdrawing closes this one, and you can send a new one straight after.")
                    .frame(maxWidth: 560, alignment: .leading)
                    .padding(.top, 16)
            }

        case .noHandle:
            NotebookCard(tilt: .preset(2), tape: true, padding: 24) {
                SlugText("one field on your settings page")
                cardText("A handle is the only thing on an application that says who sent it. Without one, yours lands on the desk as a team number and nothing else. Pick one, then come back and the three questions are right here.")
                AccountSettingsLink { Text("Pick a handle") }
                    .buttonStyle(.ink)
                    .padding(.top, 22)
                FieldHint("Your team number lives on the same page, and it’s worth setting while you’re there.")
                    .padding(.top, 12)
            }
            .frame(maxWidth: 640, alignment: .leading)

        case .again, .new:
            VStack(alignment: .leading, spacing: 0) {
                if let closed = state.application, closed.isWithdrawn || closed.isTurnedDown {
                    previous(closed)
                        .padding(.bottom, 24)
                }
                if !state.applicationsOpen {
                    NoteCallout {
                        Text("Applications are closed for now. Check back soon.")
                            .lfProse(16, lineHeight: 1.45)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: 640, alignment: .leading)
                } else if let username = state.record.username {
                    ApplyForm(state: state, username: username, again: state.application != nil) {
                        justSent = true
                    }
                }
            }
        }
    }

    private func cardText(_ text: String) -> some View {
        Text(text)
            .lfProse(16.5, lineHeight: 1.5)
            .frame(maxWidth: 560, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 12)
    }

    /// "Thank you. It's in.": the taped receipt after a send, with the way to take it back.
    private var receipt: some View {
        NotebookCard(tilt: .preset(0), tape: true, padding: 24) {
            SlugText("sent / waiting on a decision")
            Text("Thank you. It’s in.")
                .font(LF.Fonts.body(17, weight: .semibold))
                .foregroundStyle(LF.Palette.ink)
                .padding(.top, 10)
            Text("Nothing else is needed from you. You’ll get an email either way, and until then this page says where it stands. If you change your mind before it’s decided, you can withdraw it from here.")
                .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            ApplyWithdrawForm()
                .padding(.top, 20)
        }
        .frame(maxWidth: 640, alignment: .leading)
        .onAppear { AccessibilityNotification.Announcement("Thank you. It’s in.").post() }
    }

    private func previous(_ closed: AdminApplyState.Application) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SlugText(closed.isWithdrawn
                     ? "withdrawn \(AdminText.day(closed.reviewedAt) ?? "earlier")"
                     : "turned down \(AdminText.day(closed.reviewedAt) ?? "earlier")")
            Text(closed.isWithdrawn
                 ? "You pulled that one back before it was decided. You can send another whenever you like."
                 : "That one was turned down, which is not a permanent answer. If something has changed since, say so in the first box.")
                .lfProse(16, lineHeight: 1.5)
                .frame(maxWidth: 600, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            if let note = closed.reviewNote {
                NoteCallout {
                    SlugText("what the reviewer wrote back")
                    Text(note)
                        .lfProse(15.5, lineHeight: 1.5)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: 640, alignment: .leading)
                .padding(.top, 8)
            }
        }
    }

    private var signedOutCard: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: 24) {
            SlugText("sign in first")
            cardText("An application arrives as a handle and a team number, so it has to be attached to an account. Reading LearnFRC never needs one. An account is free and takes a minute.")
            Button("Sign in and apply") { authScreen = .signIn }
                .buttonStyle(.ink)
                .padding(.top, 22)
            Text("No account yet? [Make one](learnfrc-apply://signup), it’s free and it comes straight back here.")
                .font(LF.Fonts.mono(12, relativeTo: .caption))
                .foregroundStyle(LF.Palette.graphite)
                .tint(LF.Palette.blue)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
        }
        .frame(maxWidth: 640, alignment: .leading)
    }

    // MARK: Footer

    private var footer: some View {
        Text("Not looking to help run it, just want to tell me something is wrong? The [contact form](https://learnfrc.com/contact) is the shorter path and needs no account at all. Every change anyone has suggested is public on the [contributions page](https://learnfrc.com/contributions).")
            .font(LF.Fonts.mono(12, relativeTo: .caption))
            .lineHeight(.multiple(factor: 1.5))
            .foregroundStyle(LF.Palette.graphite)
            .tint(LF.Palette.blue)
            .frame(maxWidth: 620, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 56)
    }
}

// MARK: - The form

/// The three questions, ruled onto the page, with the record strip that says exactly what the
/// reviewer gets. Every field keeps its words through a refusal.
struct ApplyForm: View {
    let state: AdminApplyState
    let username: String
    let again: Bool
    let onSent: () -> Void

    @Environment(AdminStore.self) private var injected: AdminStore?
    @State private var experience = ""
    @State private var why = ""
    @State private var availability = ""
    @State private var isSending = false
    @State private var error: String?
    @FocusState private var availabilityFocused: Bool

    private var admin: AdminStore { injected ?? .shared }

    private var record: String {
        [state.record.teamNumber.map { "team \($0)" } ?? "team not set", state.record.teamRoleLabel]
            .compactMap { $0 }
            .joined(separator: " / ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                DashedRule()
                SlugText("what the reviewer sees")
                    .padding(.top, 12)
                Text("\(Text("@\(username)").font(LF.Fonts.body(17, weight: .bold)))  \(Text(record).font(LF.Fonts.mono(12.5, relativeTo: .caption)).foregroundStyle(LF.Palette.graphite))")
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("That line and your three answers are the whole application. Your real name and your email address are not on that screen.")
                    .lfProse(15, lineHeight: 1.5, color: LF.Palette.graphite)
                    .frame(maxWidth: 560, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
            }

            VStack(alignment: .leading, spacing: 24) {
                ApplyLongAnswer(
                    label: "Your FRC experience",
                    text: $experience,
                    prompt: "Team number, the seasons you were around for, and what you actually worked on.",
                    hint: "If you were on more than one team, say so. If you have been away from it for a few years, say that too.",
                    lines: 5,
                    limits: state.limits,
                    disabled: isSending
                )
                ApplyLongAnswer(
                    label: "Why you want to help",
                    text: $why,
                    prompt: "What you'd want to pick up first, and why this rather than something else.",
                    hint: "A paragraph is plenty. If there's a department you'd want to keep an eye on in particular, name it.",
                    lines: 4,
                    limits: state.limits,
                    disabled: isSending
                )
                VStack(alignment: .leading, spacing: 7) {
                    FieldLabel("Rough availability, optional")
                    TextField("", text: $availability, prompt: Text("a couple of evenings a month").foregroundStyle(LF.Palette.graphite))
                        .focused($availabilityFocused)
                        .inkField(focused: availabilityFocused)
                        .disabled(isSending)
                        .accessibilityLabel("Rough availability, optional")
                        .onChange(of: availability) { _, value in
                            if value.count > state.limits.availabilityMax {
                                availability = String(value.prefix(state.limits.availabilityMax))
                            }
                        }
                    FieldHint("A rough shape is fine. Nobody is counting hours, and this one can be left blank.")
                }

                if let error {
                    FieldError(error)
                }

                VStack(alignment: .leading, spacing: 10) {
                    Button(isSending ? "Sending" : (again ? "Send it again" : "Send the application")) { send() }
                        .buttonStyle(.ink)
                        .disabled(isSending)
                    FieldHint("It goes to one person. You’ll get an email when it’s decided.")
                }
            }
            .padding(.top, 26)
        }
        .frame(maxWidth: 680, alignment: .leading)
    }

    private func send() {
        let experience = experience.trimmingCharacters(in: .whitespacesAndNewlines)
        let why = why.trimmingCharacters(in: .whitespacesAndNewlines)
        let availability = availability.trimmingCharacters(in: .whitespacesAndNewlines)
        // The server's own sentences, checked here first to save a round trip.
        if experience.count < state.limits.minChars {
            error = "Say a bit more about your FRC experience (a few sentences)."
            return
        }
        if why.count < state.limits.minChars {
            error = "Say a bit more about why you want to help (a few sentences)."
            return
        }
        error = nil
        isSending = true
        Task {
            do throws(AdminError) {
                try await admin.submitApplication(experience: experience, why: why, availability: availability.isEmpty ? nil : availability)
                isSending = false
                onSent()
            } catch {
                isSending = false
                self.error = error.message
            }
        }
    }
}

/// One long answer: label, live count, the box, the hint, and a correction once the box has
/// been left still too short. The count says how much more is needed until the minimum, then
/// how much room is left.
struct ApplyLongAnswer: View {
    let label: String
    @Binding var text: String
    let prompt: String
    let hint: String
    let lines: Int
    let limits: AdminApplyState.Limits
    let disabled: Bool

    @FocusState private var focused: Bool
    @State private var left = false

    private var trimmed: Int { text.trimmingCharacters(in: .whitespacesAndNewlines).count }
    private var isShort: Bool { trimmed < limits.minChars }
    private var showsError: Bool { left && isShort }
    private var countText: String {
        isShort ? "\(trimmed) / \(limits.minChars) minimum" : "\(text.count) / \(limits.maxChars)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            AdminFlowLayout(spacing: 12, lineSpacing: 4) {
                FieldLabel(label)
                SlugText(countText)
            }
            .accessibilityHidden(true)
            TextField("", text: $text, prompt: Text(prompt).foregroundStyle(LF.Palette.graphite), axis: .vertical)
                .lineLimit(lines...16)
                .focused($focused)
                .inkField(focused: focused, invalid: showsError)
                .disabled(disabled)
                .accessibilityLabel(label)
                .accessibilityValue(text.isEmpty ? countText : "\(text), \(countText)")
                .accessibilityHint(hint)
                .onChange(of: focused) { _, isFocused in
                    if !isFocused, !text.isEmpty || left { left = true }
                }
                .onChange(of: text) { _, value in
                    if value.count > limits.maxChars { text = String(value.prefix(limits.maxChars)) }
                }
            FieldHint(hint)
                .accessibilityHidden(true)
            if showsError {
                let missing = limits.minChars - trimmed
                FieldError("Say a bit more, at least \(missing) more \(missing == 1 ? "character" : "characters").")
            }
        }
    }
}

// MARK: - Withdraw

/// Pulling an open application back: two steps, both on the page, never a system alert.
struct ApplyWithdrawForm: View {
    @Environment(AdminStore.self) private var injected: AdminStore?
    @State private var isAsking = false
    @State private var isWithdrawing = false
    @State private var error: String?
    @AccessibilityFocusState private var confirmFocused: Bool
    @AccessibilityFocusState private var openFocused: Bool

    private var admin: AdminStore { injected ?? .shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let error {
                FieldError(error)
            }
            if isAsking {
                Text("Withdraw this application? It comes off the reviewer’s desk straight away, and you can send a new one whenever you want.")
                    .lfProse(15.5, lineHeight: 1.5)
                    .frame(maxWidth: 520, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                AdminFlowLayout(spacing: 12, lineSpacing: 10) {
                    Button(isWithdrawing ? "Withdrawing" : "Yes, withdraw it") { withdraw() }
                        .buttonStyle(.inkSmall)
                        .disabled(isWithdrawing)
                        .accessibilityFocused($confirmFocused)
                        .accessibilityHint("Withdraw this application? It comes off the reviewer’s desk straight away, and you can send a new one whenever you want.")
                    Button("Leave it in") {
                        isAsking = false
                        openFocused = true
                    }
                    .buttonStyle(.inkGhostSmall)
                    .disabled(isWithdrawing)
                }
            } else {
                Button("Withdraw it") {
                    isAsking = true
                    confirmFocused = true
                }
                .buttonStyle(.inkGhostSmall)
                .accessibilityFocused($openFocused)
            }
        }
    }

    private func withdraw() {
        guard !isWithdrawing else { return }
        isWithdrawing = true
        error = nil
        Task {
            do throws(AdminError) {
                try await admin.withdrawApplication()
            } catch {
                self.error = error.message
            }
            isWithdrawing = false
        }
    }
}

// MARK: - Previews

#Preview("Apply, closed, iPhone") {
    NavigationStack {
        ApplyView()
    }
    .adminStore(.preview(role: .member, apply: AdminPreviewData.apply(mode: .new, open: false)))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Apply, open form, iPad", traits: .fixedLayout(width: 1024, height: 1100)) {
    NavigationStack {
        ApplyView()
    }
    .adminStore(.preview(role: .member, apply: AdminPreviewData.apply(mode: .again, open: true)))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Apply, pending, dark") {
    NavigationStack {
        ApplyView()
    }
    .adminStore(.preview(role: .member, apply: AdminPreviewData.apply(mode: .pending, open: false)))
    .appEnvironment(.preview(signedIn: true))
    .preferredColorScheme(.dark)
}

#Preview("Apply, signed out") {
    NavigationStack {
        ApplyView()
    }
    .adminStore(.preview(role: nil))
    .appEnvironment(.preview(signedIn: false))
}

#Preview("Apply, open form, iPhone Duo open", traits: .fixedLayout(width: DuoPreview.innerContent.width, height: 1800)) {
    NavigationStack {
        ApplyView()
    }
    .adminStore(.preview(role: .member, apply: AdminPreviewData.apply(mode: .again, open: true)))
    .appEnvironment(.preview(signedIn: true))
    .previewFold(.previewBook)
}
