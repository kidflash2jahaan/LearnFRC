import SwiftUI

// The cards on the Settings page, each one self-contained.

// MARK: - Identity

/// The member record at the top of Settings (the site's `IdentityCard`): whose sheet this
/// is, and the three facts people look settings up to check. Read-only, so it's a ruled
/// record rather than another form.
struct SettingsIdentityCard: View {
    let me: Me
    var xp: Int

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 0) {
                who.frame(maxWidth: .infinity, alignment: .leading)
                Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.stroke)
                facts.frame(width: 260)
            }
            .frame(minWidth: 560)
            VStack(alignment: .leading, spacing: 0) {
                who
                InkRule()
                facts
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .notebookBox(shadow: .card)
    }

    private var p: Profile { me.profile }

    private var displayName: String {
        if let name = p.fullName?.accountTrimmed, !name.isEmpty { return name }
        return p.username ?? me.user.email ?? "Your account"
    }

    private var who: some View {
        VStack(alignment: .leading, spacing: 14) {
            SlugText("account / this is you")
            HStack(spacing: 16) {
                InitialsAvatar(name: displayName, seed: p.username ?? me.user.email, imageURL: p.avatarURL, size: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName)
                        .font(LF.Fonts.display(23, relativeTo: .title2))
                        .tracking(23 * -0.025)
                        .foregroundStyle(LF.Palette.ink)
                        .lineLimit(2)
                    SlugText(p.handle ?? me.user.email ?? "")
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            // Wraps onto a second line at the largest text sizes instead of cutting the words.
            AccountFlowLayout(spacing: 8) {
                TagView(p.roleKind == .other ? "Team member" : p.roleKind.displayName)
                TagView(p.tier)
                // The site's filled "admin" tag, for site admins only (it's empty otherwise).
                AdminIdentityTag()
            }
        }
        .padding(LF.Metrics.cardPadding)
        .accessibilityElement(children: .combine)
    }

    private var facts: some View {
        VStack(alignment: .leading, spacing: 0) {
            fact("frc team", value: p.teamNumber.map(String.init), missing: "none on file")
            DashedRule()
            fact("xp earned", value: xp.formatted(), missing: "")
            DashedRule()
            fact("member since", value: p.createdAt?.formatted(.dateTime.month(.abbreviated).year()), missing: "not recorded")
        }
        .padding(.horizontal, LF.Metrics.cardPadding)
        .padding(.vertical, 8)
    }

    private func fact(_ label: String, value: String?, missing: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            SlugText(label)
            Spacer(minLength: 8)
            if let value {
                Text(value)
                    .font(LF.Fonts.mono(17, weight: .bold, relativeTo: .body))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.blue)
            } else {
                SlugText(missing)
            }
        }
        .padding(.vertical, 11)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Reminder emails

/// The reminder-email switch (the site's `EmailPrefsCard`). It saves the moment it's
/// flipped: the knob moves first and snaps back if the save fails.
struct SettingsEmailRemindersCard: View {
    let me: Me

    @Environment(AccountStore.self) private var account
    @State private var on: Bool
    @State private var isSaving = false
    @State private var error: String?

    init(me: Me) {
        self.me = me
        _on = State(initialValue: me.profile.emailOptIn)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("settings / email")
            AccountCardTitle("Reminder emails")
                .padding(.top, 8)
            AccountSubText(Text("Now and then we can email you a reminder about your next lesson, picked up from where you left off. They're off unless you turn them on, and every one has a one-click unsubscribe. Account emails like verification and password resets still come either way. [Privacy policy](https://learnfrc.com/privacy)."))
                .padding(.top, 8)

            VStack(alignment: .leading, spacing: 12) {
                DashedRule()
                Toggle(isOn: Binding(get: { on }, set: flip)) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Send me reminder emails")
                            .font(LF.Fonts.body(16.5, weight: .semibold))
                            .foregroundStyle(LF.Palette.ink)
                        FieldHint(on ? "On. You can turn it off any time." : "Off. Nothing but account emails.")
                    }
                }
                .toggleStyle(AccountSwitchStyle())
                .disabled(isSaving || me.isProvisional)
                if let error {
                    FieldError(error)
                }
            }
            .padding(.top, 18)
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox()
        .onChange(of: me.profile.emailOptIn) { _, new in
            if !isSaving { on = new }
        }
    }

    private func flip(_ next: Bool) {
        guard !isSaving else { return }
        on = next
        error = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await account.setEmailOptIn(next)
                accountAnnounce(next ? "Reminder emails are on." : "Reminder emails are off.")
            } catch {
                on = !next
                self.error = error.accountMessage
            }
        }
    }
}

// MARK: - Daily reminder (this device)

/// The on-device study reminder, drawn as a notebook card and driven by
/// `ReminderScheduler` (Features/System), which owns the choice, the permission prompt
/// and the scheduling: at most one a day, at the time and on the days the person picks.
struct SettingsDailyReminderCard: View {
    @Bindable private var scheduler: ReminderScheduler
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase

    init(scheduler: ReminderScheduler = .shared) {
        self.scheduler = scheduler
    }

    private var isOn: Binding<Bool> {
        Binding(
            get: { scheduler.isEnabled },
            set: { on in
                Task {
                    let worked = await scheduler.setEnabled(on)
                    if on, worked { accountAnnounce("Reminders on. \(scheduler.scheduleSummary).") }
                }
            }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("settings / this device")
            AccountCardTitle("Study reminders")
                .padding(.top, 8)
            AccountSubText(ReminderScheduler.footnote)
                .padding(.top, 8)

            VStack(alignment: .leading, spacing: 12) {
                DashedRule()
                Toggle(isOn: isOn) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Remind me to study")
                            .font(LF.Fonts.body(16.5, weight: .semibold))
                            .foregroundStyle(LF.Palette.ink)
                        FieldHint(scheduler.isEnabled ? "On. \(scheduler.scheduleSummary)." : "Off. No notifications from LearnFRC.")
                    }
                }
                .toggleStyle(AccountSwitchStyle())
                .disabled(scheduler.isWorking)

                if scheduler.isEnabled {
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: 16) {
                            timeField
                            daysField
                        }
                        .frame(minWidth: 440)
                        VStack(alignment: .leading, spacing: 14) {
                            timeField
                            daysField
                        }
                    }
                    .transition(.opacity)

                    if let status = scheduler.statusLine, scheduler.permission != .denied {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            if scheduler.hasNothingToRemind {
                                PenCheckMark(size: 11)
                            }
                            SlugText(status)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }

                if scheduler.permission == .denied {
                    AccountNote(
                        "notifications are off",
                        "Notifications are off for LearnFRC, so reminders can't arrive. You can turn them on in Settings."
                    )
                    if let url = ReminderScheduler.systemSettingsURL {
                        Button("Open notification settings") { openURL(url) }
                            .buttonStyle(.inkGhostSmall)
                    }
                }
            }
            .padding(.top, 18)
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox()
        .lfAnimation(LF.Motion.hover, value: scheduler.isEnabled)
        .task { await scheduler.refreshPermission() }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await scheduler.refreshPermission() }
        }
    }

    private var timeField: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            FieldLabel("Time")
                .accessibilityHidden(true)
            DatePicker("Reminder time", selection: $scheduler.time, displayedComponents: .hourAndMinute)
                .labelsHidden()
                .tint(LF.Palette.blue)
                #if os(macOS)
                .datePickerStyle(.stepperField)
                #endif
                .frame(minHeight: LF.Metrics.tap, alignment: .leading)
        }
    }

    private var daysField: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            FieldLabel("Days")
                .accessibilityHidden(true)
            Menu {
                Section {
                    preset("Every day", ReminderScheduler.everyDay)
                    preset("Weekdays", ReminderScheduler.weekdaysOnly)
                    preset("Weekends", ReminderScheduler.weekendsOnly)
                }
                Section("Pick days") {
                    ForEach(scheduler.orderedWeekdays, id: \.self) { day in
                        Toggle(Self.dayName(day), isOn: Binding(
                            get: { scheduler.weekdays.contains(day) },
                            set: { _ in scheduler.toggleWeekday(day) }
                        ))
                        // The last day can't be unticked; switch reminders off instead.
                        .disabled(scheduler.weekdays == [day])
                    }
                }
                #if os(iOS)
                .menuActionDismissBehavior(.disabled)   // tick several days without the menu closing
                #endif
            } label: {
                HStack {
                    Text(scheduler.daysSummary)
                        .foregroundStyle(LF.Palette.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(LF.Palette.ink)
                        .accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .inkField()
                .contentShape(HandShape(.s))
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .menuIndicator(.hidden)
            .accessibilityLabel("Days")
            .accessibilityValue(scheduler.daysSummary)
        }
    }

    private func preset(_ title: String, _ days: Set<Int>) -> some View {
        Button {
            scheduler.setWeekdays(days)
        } label: {
            if scheduler.weekdays == days {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
        }
    }

    private static func dayName(_ weekday: Int) -> String {
        let symbols = Calendar.current.weekdaySymbols
        return (1...7).contains(weekday) ? symbols[weekday - 1] : ""
    }
}

// MARK: - Appearance

/// Paper, Night or System, as three little pages to pick from: side by side when the card
/// has room for all three, otherwise one per row with the page beside its name (the
/// smallest iPhone, large text), and at the accessibility sizes each page above its name
/// so the name gets the whole width. Nothing in a tile has a fixed width, so the card never
/// pushes the page past its gutters, and the choice of layout comes from the width the
/// card is offered (`ViewThatFits`), never from a width measured into state.
struct SettingsAppearanceCard: View {
    @AppStorage(AppearancePreference.storageKey) private var raw = AppearancePreference.system.rawValue
    @Environment(\.dynamicTypeSize) private var typeSize
    /// The narrowest a tile can be with its name on one line; grows with the text size.
    @ScaledMetric(relativeTo: .body) private var minTileWidth: CGFloat = 96

    private var selection: AppearancePreference { AppearancePreference(rawValue: raw) ?? .system }

    private static let spacing: CGFloat = 14

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("settings / appearance")
            AccountCardTitle("Paper or night")
                .padding(.top, 8)
            AccountSubText("The site is printed on paper. The app can also be read at night: the same notebook in chalk on a dark page. This only changes this device.")
                .padding(.top, 8)

            Group {
                if typeSize.isAccessibilitySize {
                    VStack(spacing: 10) { tiles(.stacked) }
                } else {
                    // Side by side only when every tile gets at least `minTileWidth`.
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: Self.spacing) { tiles(.column) }
                        VStack(spacing: 10) { tiles(.row) }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 18)
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox()
        .sensoryFeedback(.selection, trigger: raw)
    }

    @ViewBuilder
    private func tiles(_ style: AppearanceTile.Style) -> some View {
        ForEach(AppearancePreference.allCases) { option in
            Button {
                raw = option.rawValue
            } label: {
                AppearanceTile(option: option, selected: option == selection, style: style)
            }
            .buttonStyle(.plain)
            // A side-by-side tile asks for its narrowest width, which is what ViewThatFits checks.
            .frame(minWidth: style == .column ? minTileWidth : nil, idealWidth: style == .column ? minTileWidth : nil, maxWidth: .infinity)
            .accessibilityLabel("\(option.title), \(option.caption)")
            .accessibilityAddTraits(option == selection ? [.isSelected] : [])
        }
    }
}

private struct AppearanceTile: View {
    enum Style: Hashable {
        /// Side by side: the page on top, the name under it.
        case column
        /// One per row: the page on the left, the name and caption beside it.
        case row
        /// One per row at the accessibility sizes: a short page across the top, the name under it.
        case stacked
    }

    let option: AppearancePreference
    let selected: Bool
    var style: Style = .column

    @ScaledMetric(relativeTo: .body) private var swatchHeight: CGFloat = 70
    @ScaledMetric(relativeTo: .body) private var rowSwatchWidth: CGFloat = 84

    /// The thumbnail stops growing past the largest standard size: it's a picture, and the
    /// room is better spent on the name.
    private var rowPageWidth: CGFloat { min(rowSwatchWidth, 112) }
    private var stackedPageHeight: CGFloat { min(swatchHeight, 92) }

    var body: some View {
        Group {
            switch style {
            case .row:
                HStack(alignment: .center, spacing: 14) {
                    page
                        .frame(width: rowPageWidth, height: rowPageWidth * 0.66)
                    label
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(minHeight: LF.Metrics.tap)
            case .stacked:
                VStack(alignment: .leading, spacing: 10) {
                    page
                        .frame(height: stackedPageHeight)
                        .frame(maxWidth: .infinity)
                    label
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            case .column:
                VStack(alignment: .leading, spacing: 10) {
                    page
                        .frame(height: swatchHeight)
                        .frame(maxWidth: .infinity)
                    label
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                HandShape(.s).fill(selected ? LF.Palette.rowWash : Color.clear)
                HandShape(.s).strokeBorder(
                    selected ? LF.Palette.blue : LF.Palette.rule,
                    style: StrokeStyle(lineWidth: selected ? LF.Metrics.heavyStroke : LF.Metrics.hairline * 1.5, dash: selected ? [] : [4, 3])
                )
            }
        }
        .contentShape(HandShape(.s))
    }

    /// The thumbnail, clipped to whatever room the tile gives it (never a minimum width).
    private var page: some View {
        swatch
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity, alignment: .topLeading)
            .clipShape(HandShape(.s))
            .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: 1.5) }
            .accessibilityHidden(true)
    }

    private var label: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(option.title)
                    .font(LF.Fonts.body(16, weight: .bold))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if selected {
                    PenCheckMark(size: 12)
                }
            }
            SlugText(option.caption)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var swatch: some View {
        switch option {
        case .paper:
            MiniPage().environment(\.colorScheme, .light)
        case .night:
            MiniPage().environment(\.colorScheme, .dark)
        case .system:
            ZStack {
                MiniPage().environment(\.colorScheme, .light)
                MiniPage().environment(\.colorScheme, .dark)
                    .mask { DiagonalHalf() }
            }
        }
    }
}

/// A thumbnail of a notebook page: grid paper, a card with two lines of type and a meter.
private struct MiniPage: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            PaperBackground()
            VStack(alignment: .leading, spacing: 5) {
                Capsule().fill(LF.Palette.ink).frame(width: 38, height: 4)
                Capsule().fill(LF.Palette.graphite).frame(width: 52, height: 3)
                ZStack(alignment: .leading) {
                    Rectangle().fill(LF.Palette.paper)
                    Rectangle().fill(LF.Palette.blue).frame(width: 30)
                }
                .frame(width: 52, height: 5)
                .overlay { Rectangle().strokeBorder(LF.Palette.ink, lineWidth: 1) }
            }
            .padding(8)
            .background {
                HandShape(.s).fill(LF.Palette.card)
                HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: 1.5)
            }
            .padding(10)
        }
    }
}

private struct DiagonalHalf: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.maxX * 0.62, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.maxX * 0.38, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

// MARK: - Password

/// Change the password while signed in. It's the same password on learnfrc.com.
struct SettingsPasswordCard: View {
    @Environment(AccountStore.self) private var account

    @State private var isOpen = false
    @State private var password = ""
    @State private var confirm = ""
    @State private var error: String?
    @State private var passwordError: String?
    @State private var confirmError: String?
    @State private var isSaving = false
    @State private var done = false
    @FocusState private var focus: Field?

    private enum Field: Hashable { case password, confirm }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("settings / password")
            AccountCardTitle("Your password")
                .padding(.top, 8)
            AccountSubText("One password for the app and learnfrc.com. Changing it here changes it everywhere you sign in.")
                .padding(.top, 8)

            VStack(alignment: .leading, spacing: 16) {
                DashedRule()
                if done {
                    AccountNote("updated", "Password changed. Use the new one next time you sign in, here or on learnfrc.com.")
                }
                if isOpen {
                    if let error { FieldError(error) }
                    AccountField(
                        "New password", text: $password, kind: .password(new: true),
                        focus: $focus, field: .password,
                        hint: "At least 8 characters, letters and numbers.",
                        error: passwordError,
                        onSubmit: { focus = .confirm }
                    )
                    AccountField(
                        "Type it again", text: $confirm, kind: .password(new: true),
                        focus: $focus, field: .confirm,
                        error: confirmError,
                        submitLabel: .done,
                        onSubmit: save
                    )
                    HStack(spacing: 12) {
                        Button(action: save) { Text(isSaving ? "Updating" : "Update password") }
                            .buttonStyle(.inkSmall)
                        Button("Cancel", action: close)
                            .buttonStyle(.inkGhostSmall)
                    }
                    .disabled(isSaving)
                } else {
                    Button("Change my password") {
                        done = false
                        LF.Motion.perform(LF.Motion.hover) { isOpen = true }
                        focus = .password
                    }
                    .buttonStyle(.inkGhostSmall)
                }
            }
            .padding(.top, 18)
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox()
        .accountKeyboardBar($focus, order: [.password, .confirm], action: "Update", actionEnabled: !isSaving, perform: save)
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    private func close() {
        password = ""
        confirm = ""
        error = nil
        passwordError = nil
        confirmError = nil
        focus = nil
        LF.Motion.perform(LF.Motion.hover) { isOpen = false }
    }

    private func save() {
        guard !isSaving else { return }
        error = nil
        passwordError = nil
        confirmError = nil
        if password.count < 8 {
            passwordError = AccountStore.passwordRule
            focus = .password
            return
        }
        if password != confirm {
            confirmError = "Those passwords don't match."
            focus = .confirm
            return
        }
        focus = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await account.changePassword(password)
                close()
                done = true
                Haptics.success()
                accountAnnounce("Password changed.")
            } catch {
                self.error = error.accountMessage
            }
        }
    }
}

// MARK: - Session

/// Signing out clears this device only.
struct SettingsSessionSection: View {
    let me: Me

    @Environment(AccountStore.self) private var account
    @Environment(ProgressStore.self) private var progress
    @State private var isSigningOut = false
    @State private var confirming = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .bottom, spacing: 28) {
                    explanation
                    signOutButton
                }
                VStack(alignment: .leading, spacing: 16) {
                    explanation
                    signOutButton
                }
            }
        }
        .confirmationDialog("Sign out of LearnFRC?", isPresented: $confirming, titleVisibility: .visible) {
            Button("Sign out", role: .destructive, action: signOut)
            Button("Stay signed in", role: .cancel) {}
        } message: {
            Text(pendingMessage)
        }
        // A link or a search takes the window elsewhere: the question goes with the screen.
        .closesOnNavigation($confirming)
    }

    private var pendingCount: Int { progress.pendingLessonIDs.count }

    private var pendingMessage: String {
        let lessons = pendingCount == 1 ? "1 lesson" : "\(pendingCount) lessons"
        return "\(lessons) finished offline haven't reached learnfrc.com yet. They stay on this device and send the next time you sign in here."
    }

    private var explanation: some View {
        Text("Signed in as \(Text(me.user.email ?? "this account").font(LF.Fonts.mono(14, weight: .bold, relativeTo: .subheadline)).foregroundStyle(LF.Palette.ink)). Signing out clears this device only. Your progress, XP and certificates stay exactly where they are.")
            .font(LF.Fonts.body(16, relativeTo: .body))
            .lineHeight(.multiple(factor: 1.5))
            .foregroundStyle(LF.Palette.graphite)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: 520, alignment: .leading)
    }

    private var signOutButton: some View {
        Button(isSigningOut ? "Signing out" : "Sign out") {
            if pendingCount > 0 { confirming = true } else { signOut() }
        }
        .buttonStyle(.inkDestructive)
        .disabled(isSigningOut)
        .fixedSize()
    }

    private func signOut() {
        isSigningOut = true
        Task {
            await account.signOut()
            isSigningOut = false
            accountAnnounce("Signed out.")
        }
    }
}

// MARK: - Delete account

/// Account deletion behind a typed confirmation (the site's `DangerZone`). It takes the
/// profile, progress, XP and bookmarks with it on learnfrc.com, and there's no undo.
/// Severity is a heavier ink edge, not a colour.
struct SettingsDeleteAccountBox: View {
    var onDeleted: () -> Void

    @Environment(AccountStore.self) private var account
    @State private var confirming = false
    @State private var typed = ""
    @State private var isDeleting = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field: Hashable { case confirm }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("account / permanent")
            AccountCardTitle("Delete this account")
                .padding(.top, 8)
            AccountSubText("This removes your profile, your progress, your XP and your bookmarks from learnfrc.com. Certificates you have already saved stay on your device, but nothing here can be restored.")
                .padding(.top, 8)

            if confirming {
                VStack(alignment: .leading, spacing: 16) {
                    DashedRule()
                    if let error { FieldError(error) }
                    AccountField(
                        "Type DELETE to confirm", text: $typed, kind: .confirmation,
                        focus: $focus, field: .confirm,
                        prompt: "DELETE",
                        submitLabel: .done,
                        onSubmit: delete
                    )
                    .frame(maxWidth: 320, alignment: .leading)
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 12) { deleteButtons }
                        VStack(alignment: .leading, spacing: 12) { deleteButtons }
                    }
                }
                .padding(.top, 20)
                .transition(.opacity)
            } else {
                Button("Delete my account") {
                    LF.Motion.perform(LF.Motion.hover) { confirming = true }
                    focus = .confirm
                }
                .buttonStyle(.inkDestructive)
                .padding(.top, 20)
            }
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            NotebookBoxBackground(size: .a, shadow: .none, borderWidth: LF.Metrics.heavyStroke)
        }
        .sensoryFeedback(.error, trigger: error) { old, new in old == nil && new != nil }
    }

    @ViewBuilder
    private var deleteButtons: some View {
        Button(isDeleting ? "Deleting" : "Permanently delete", action: delete)
            .buttonStyle(.inkDestructive)
            .disabled(isDeleting || typed != "DELETE")
            .accessibilityHint(typed == "DELETE" ? "Deletes the account. This can't be undone." : "Type DELETE first.")
        Button("Keep my account") {
            typed = ""
            error = nil
            focus = nil
            LF.Motion.perform(LF.Motion.hover) { confirming = false }
        }
        .buttonStyle(.inkGhost)
        .disabled(isDeleting)
    }

    private func delete() {
        guard typed == "DELETE", !isDeleting else { return }
        error = nil
        focus = nil
        isDeleting = true
        Task {
            defer { isDeleting = false }
            do {
                // The cached team sheet goes with the account: `deleteAccount` removes the
                // community files and `AppModel` forgets this session's copies on `.deleted`.
                try await account.deleteAccount()
                accountAnnounce("Account deleted.")
                onDeleted()
            } catch {
                self.error = error.accountMessage
            }
        }
    }
}

// MARK: - About

/// The policies and the site, opened in the browser.
struct SettingsAboutSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            AccountSectionHeading(title: "About")
            VStack(alignment: .leading, spacing: 0) {
                row("Privacy policy", slug: "learnfrc.com/privacy", url: AccountLinks.privacy)
                DashedRule()
                row("Terms of Service", slug: "learnfrc.com/terms", url: AccountLinks.terms)
                DashedRule()
                row("LearnFRC on the web", slug: "learnfrc.com", url: AccountLinks.site)
                DashedRule()
            }
            SlugText("learnfrc \(AppConfig.appVersion)")
                .padding(.top, 10)
                .textSelection(.enabled)
        }
    }

    private func row(_ title: String, slug: String, url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(LF.Fonts.body(16.5, weight: .semibold))
                        .foregroundStyle(LF.Palette.ink)
                    SlugText(slug)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(LF.Palette.blue)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 10)
        }
        .buttonStyle(.inkRow)
        .accessibilityHint("Opens in your browser")
    }
}
