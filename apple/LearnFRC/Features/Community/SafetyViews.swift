import SwiftUI

// Report and block (App Review guideline 1.2), the app's half of learnfrc.com's controls on
// /u/<username>: the rules, the reasons and every sentence after a send are the site's
// (`/api/app/reports`, `/api/app/blocks`, src/lib/app/reports.ts and blocks.ts).
//
// - `ReportSheet`: pick a reason, add a line, send. Shows the site's thank-you sentence.
// - `.profileSafety(username:surface:)`: Report and Block (or Unblock) in a context menu and
//   as accessibility actions on anything that names a person (leaderboard and team rows),
//   with the sheet and the block confirmation it needs.
// - `ProfileSafetyMenu`: the same two actions as a toolbar menu (a public profile).
// - `BlockedProfileCard`: what a blocked person's profile shows instead of their record.

// MARK: - Report sheet

struct ReportSheet: View {
    let username: String
    let surface: ReportSurface

    @Environment(SafetyStore.self) private var injected: SafetyStore?
    @Environment(\.dismiss) private var dismiss

    @State private var reason: ReportReason?
    @State private var details = ""
    @State private var isSending = false
    @State private var error: String?
    @State private var sent: String?
    @FocusState private var detailsFocused: Bool

    private var safety: SafetyStore { injected ?? .shared }
    private var detailsMax: Int { 1000 }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if let sent {
                        thanks(sent)
                    } else {
                        form
                    }
                }
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.horizontal, LF.Metrics.gutter)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .paperBackground()
            .navigationTitle("Report @\(username)")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .close) { dismiss() }
                        .accessibilityLabel(sent == nil ? "Cancel" : "Close")
                }
            }
        }
        .tint(LF.Palette.blue)
        .task { await safety.loadReasons() }
        #if os(macOS)
        .frame(minWidth: 480, idealWidth: 560, minHeight: 520, idealHeight: 640)
        #endif
    }

    // MARK: The form

    private var form: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("report / this profile")
            Text("What's wrong with @\(username)'s profile?")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)

            VStack(alignment: .leading, spacing: 0) {
                ForEach(safety.reasons) { option in
                    reasonRow(option)
                    DashedRule()
                }
            }
            .padding(.top, 20)
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Reason")

            VStack(alignment: .leading, spacing: 6.4) {
                FieldLabel(reason?.needsDetails == true ? "tell us what's wrong" : "anything to add, optional")
                TextField("", text: $details, axis: .vertical)
                    .lineLimit(3...8)
                    .focused($detailsFocused)
                    .inkField(focused: detailsFocused, invalid: false)
                    .onChange(of: details) { _, new in
                        if new.count > detailsMax { details = String(new.prefix(detailsMax)) }
                    }
                FieldHint("It goes to the LearnFRC team, who read every report within \(safety.answerWithinHours) hours. @\(username) isn't told who sent it.")
            }
            .padding(.top, 22)

            if let error {
                FieldError(error).padding(.top, 14)
            }

            Button {
                Task { await send() }
            } label: {
                Text(isSending ? "Sending" : "Send report")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.ink)
            .disabled(reason == nil || isSending)
            .padding(.top, 22)
        }
    }

    private func reasonRow(_ option: ReportReason) -> some View {
        let picked = reason?.id == option.id
        return Button {
            reason = option
            error = nil
        } label: {
            HStack(spacing: 12) {
                Image(systemName: picked ? "largecircle.fill.circle" : "circle")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(picked ? LF.Palette.blue : LF.Palette.graphite)
                    .accessibilityHidden(true)
                Text(option.label)
                    .font(LF.Fonts.body(17, weight: picked ? .semibold : .regular))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(picked ? .isSelected : [])
    }

    private func thanks(_ message: String) -> some View {
        NotebookCard(tilt: .preset(1), tape: true, padding: 22) {
            SlugText("report / sent")
            Text(message)
                .lfProse(17, lineHeight: 1.5)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            Button("Done") { dismiss() }
                .buttonStyle(.ink)
                .padding(.top, 18)
        }
        .accessibilityElement(children: .contain)
        .onAppear { accountAnnounce(message) }
    }

    private func send() async {
        guard let reason, !isSending else { return }
        let trimmed = details.trimmingCharacters(in: .whitespacesAndNewlines)
        if reason.needsDetails, trimmed.count < 5 {
            // The site's own sentence for the same rule.
            error = "Tell us a little about what's wrong."
            detailsFocused = true
            return
        }
        isSending = true
        defer { isSending = false }
        do {
            let message = try await safety.report(username: username, reason: reason, details: trimmed, surface: surface)
            error = nil
            withAnimation(LF.Motion.arrive) { sent = message }
            Haptics.success()
        } catch {
            self.error = APIError.from(error).message
        }
    }
}

// MARK: - Report and block on a row

extension View {
    /// Report and Block (or Unblock) for the person `username` names, in a context menu and as
    /// accessibility actions, for a signed-in viewer looking at someone else. Nothing for a
    /// guest, for your own row, or for a row with no handle.
    func profileSafety(username: String?, surface: ReportSurface) -> some View {
        modifier(ProfileSafetyModifier(username: username, surface: surface))
    }

    /// The report sheet, the block confirmation and the failure alert behind Report and Block,
    /// attached to a view that stays on screen (never to a menu item, which is gone once the
    /// menu closes).
    func profileSafetyPresentations(
        username: String,
        surface: ReportSurface,
        reporting: Binding<Bool>,
        confirmingBlock: Binding<Bool>,
        failure: Binding<String?>
    ) -> some View {
        modifier(ProfileSafetyPresentations(
            username: username, surface: surface,
            reporting: reporting, confirmingBlock: confirmingBlock, failure: failure
        ))
    }

    /// The site's Block confirmation, worded the same: what is hidden, and that they aren't told.
    func blockConfirmation(isPresented: Binding<Bool>, username: String, perform: @escaping @MainActor () async -> Void) -> some View {
        confirmationDialog("Block @\(username)?", isPresented: isPresented, titleVisibility: .visible) {
            Button("Block @\(username)", role: .destructive) {
                Task { await perform() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You won't see their profile, their rows on the leaderboards or their row on your team sheet. They aren't told. You can undo it in Settings.")
        }
    }
}

/// Who a signed-in viewer can report or block from a row: anyone with a handle but themselves.
@MainActor
func safetyTarget(_ username: String?, account: AccountStore) -> String? {
    guard account.isSignedIn, let username, !username.isEmpty else { return nil }
    if let mine = account.profile?.username, mine.lowercased() == username.lowercased() { return nil }
    return username
}

private struct ProfileSafetyModifier: ViewModifier {
    let username: String?
    let surface: ReportSurface

    @Environment(AccountStore.self) private var account
    @Environment(SafetyStore.self) private var injected: SafetyStore?
    @State private var reporting = false
    @State private var confirmingBlock = false
    @State private var failure: String?

    private var safety: SafetyStore { injected ?? .shared }

    func body(content: Content) -> some View {
        if let target = safetyTarget(username, account: account) {
            let blocked = safety.isBlocked(target)
            content
                .contextMenu {
                    ProfileSafetyItems(
                        username: target,
                        isBlocked: blocked,
                        report: { reporting = true },
                        block: { confirmingBlock = true },
                        unblock: { Task { await unblock(target) } }
                    )
                }
                .accessibilityAction(named: "Report @\(target)") { reporting = true }
                .accessibilityAction(named: blocked ? "Unblock @\(target)" : "Block @\(target)") {
                    if blocked { Task { await unblock(target) } } else { confirmingBlock = true }
                }
                .profileSafetyPresentations(
                    username: target, surface: surface,
                    reporting: $reporting, confirmingBlock: $confirmingBlock, failure: $failure
                )
        } else {
            content
        }
    }

    private func unblock(_ name: String) async {
        do {
            try await safety.unblock(name)
        } catch {
            failure = APIError.from(error).message
        }
    }
}

private struct ProfileSafetyPresentations: ViewModifier {
    let username: String
    let surface: ReportSurface
    @Binding var reporting: Bool
    @Binding var confirmingBlock: Bool
    @Binding var failure: String?

    @Environment(SafetyStore.self) private var injected: SafetyStore?

    private var safety: SafetyStore { injected ?? .shared }

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $reporting) {
                ReportSheet(username: username, surface: surface)
            }
            .closesOnNavigation($reporting)
            .blockConfirmation(isPresented: $confirmingBlock, username: username) {
                do {
                    try await safety.block(username)
                    Haptics.success()
                } catch {
                    failure = APIError.from(error).message
                }
            }
            .alert("Couldn't do that", isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
                Button("OK", role: .cancel) { failure = nil }
            } message: {
                Text(failure ?? "")
            }
    }
}

/// The two menu items, for a context menu or a toolbar menu.
struct ProfileSafetyItems: View {
    let username: String
    let isBlocked: Bool
    let report: () -> Void
    let block: () -> Void
    let unblock: () -> Void

    var body: some View {
        Button(action: report) {
            Label("Report @\(username)…", systemImage: "flag")
        }
        if isBlocked {
            Button(action: unblock) {
                Label("Unblock @\(username)", systemImage: "person.crop.circle.badge.checkmark")
            }
        } else {
            Button(role: .destructive, action: block) {
                Label("Block @\(username)", systemImage: "person.crop.circle.badge.xmark")
            }
        }
    }
}

// MARK: - The profile's toolbar menu

/// Report and Block (or Unblock) as one toolbar menu on someone else's public profile. The page
/// owns what they present (`profileSafetyPresentations`), so nothing hangs off the menu.
struct ProfileSafetyMenu: View {
    let username: String
    let isBlocked: Bool
    let report: () -> Void
    let block: () -> Void
    let unblock: () -> Void

    var body: some View {
        Menu {
            ProfileSafetyItems(username: username, isBlocked: isBlocked, report: report, block: block, unblock: unblock)
        } label: {
            Label("Report or block", systemImage: "ellipsis.circle")
        }
        .help("Report or block @\(username)")
    }
}

// MARK: - A blocked profile

/// What a blocked person's profile shows: whose page it is, that it's hidden, and the way back.
/// The site's `/u/<username>` card for the same case, word for word.
struct BlockedProfileCard: View {
    let username: String

    @Environment(SafetyStore.self) private var injected: SafetyStore?
    @State private var reporting = false
    @State private var failure: String?

    private var safety: SafetyStore { injected ?? .shared }

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: 24) {
            SlugText("learnfrc / blocked")
            Text("You blocked @\(username).")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            CommunityLede("Their profile, their rows on the leaderboards and their row on your team sheet are hidden from you. They aren't told.")
                .padding(.top, 14)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { buttons }
                VStack(alignment: .leading, spacing: 12) { buttons }
            }
            .padding(.top, 20)
            if let failure {
                FieldError(failure).padding(.top, 12)
            }
            FieldHint("Everyone you've blocked is listed in Settings.")
                .padding(.top, 16)
        }
        .frame(maxWidth: 680, alignment: .leading)
        .sheet(isPresented: $reporting) {
            ReportSheet(username: username, surface: .profile)
        }
        .closesOnNavigation($reporting)
    }

    @ViewBuilder
    private var buttons: some View {
        Button(safety.isChanging(username) ? "Unblocking" : "Unblock @\(username)") {
            Task {
                do {
                    try await safety.unblock(username)
                    failure = nil
                } catch {
                    failure = APIError.from(error).message
                }
            }
        }
        .buttonStyle(.ink)
        .disabled(safety.isChanging(username))
        Button("Report @\(username)") { reporting = true }
            .buttonStyle(.inkGhost)
    }
}

// MARK: - Previews

#Preview("Report sheet", traits: .fixedLayout(width: 393, height: 852)) {
    ReportSheet(username: "kai_cad", surface: .profile)
        .environment(SafetyStore.preview())
        .appEnvironment(.preview)
}

#Preview("Blocked profile", traits: .fixedLayout(width: 393, height: 600)) {
    BlockedProfileCard(username: "kai_cad")
        .padding(LF.Metrics.gutter)
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
        .environment(SafetyStore.preview(blocked: ["kai_cad"]))
        .appEnvironment(.preview)
}
