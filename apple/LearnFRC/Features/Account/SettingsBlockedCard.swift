import SwiftUI

/// Everyone this account has blocked, each with Unblock: the site's Settings card of the same
/// name (`BlockedAccountsCard`), word for word, read from `SafetyStore` (`GET /api/app/blocks`).
struct SettingsBlockedAccountsCard: View {
    @Environment(SafetyStore.self) private var injected: SafetyStore?
    @Environment(AccountStore.self) private var account
    @State private var error: String?

    private var safety: SafetyStore { injected ?? .shared }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("settings / blocked")
            AccountCardTitle("Blocked accounts")
                .padding(.top, 8)
            AccountSubText(Text("People you block are hidden from you: their profile, their rows on the leaderboards, their row on your team sheet and their suggestions on the change log. They aren't told, and you can unblock them here any time."))
                .padding(.top, 8)

            VStack(alignment: .leading, spacing: 0) {
                DashedRule()
                if safety.blocked.isEmpty {
                    FieldHint(emptyText)
                        .padding(.top, 14)
                } else {
                    ForEach(safety.blocked) { account in
                        row(account)
                        DashedRule()
                    }
                }
                if let error {
                    FieldError(error).padding(.top, 12)
                }
            }
            .padding(.top, 18)
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .notebookBox()
        .task(id: account.userID) { await safety.sync(userID: account.userID) }
    }

    private var emptyText: String {
        if !safety.hasLoaded, safety.isLoading { return "Loading the accounts you've blocked." }
        if !safety.hasLoaded, let failure = safety.lastError { return failure.message }
        return "You haven't blocked anyone. To block someone, open their profile and choose Block from the menu at the top."
    }

    private func row(_ blocked: BlockedAccount) -> some View {
        let name = blocked.username ?? ""
        let busy = safety.isChanging(name)
        return HStack(spacing: 12) {
            CommunityAvatar(name: name, imageURL: blocked.avatarURL, size: 36)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("@\(name)")
                    .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                    .foregroundStyle(LF.Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if let when = blocked.blockedAt {
                    SlugText("blocked \(CommunityFormat.shortDate(when))")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            Button(busy ? "Unblocking" : "Unblock") {
                Task {
                    do {
                        try await safety.unblock(name)
                        error = nil
                        accountAnnounce("You unblocked @\(name).")
                    } catch {
                        self.error = APIError.from(error).message
                    }
                }
            }
            .buttonStyle(.inkGhostSmall)
            .disabled(busy)
            .accessibilityLabel("Unblock @\(name)")
        }
        .padding(.vertical, 10)
    }
}

#Preview("Blocked accounts", traits: .fixedLayout(width: 393, height: 520)) {
    SettingsBlockedAccountsCard()
        .padding(LF.Metrics.gutter)
        .frame(maxHeight: .infinity, alignment: .top)
        .paperBackground()
        // Inside appEnvironment, so it wins over the shared store that injects.
        .environment(SafetyStore.preview(blocked: ["kai_cad", "rookie_rae"]))
        .appEnvironment(.preview)
}
