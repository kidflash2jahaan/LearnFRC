import SwiftUI

/// learnfrc.com/apply in the app. Teaching a live class is the only application LearnFRC takes
/// (the marketing role was removed on 2026-11-09), and its form is on learnfrc.com/apply/teach,
/// opened in Safari: it asks about FRC seasons and takes about 30 to 45 minutes of writing, which is
/// a job for a keyboard and a browser draft, not this screen.
///
/// While classes are open: what teaching involves and the way to apply (`ClassesTeachCard`).
/// While they're hidden: there's nothing to apply for, with no word about classes, like the
/// site's /apply. This screen never calls `/api/app/apply`; that route stays on the server, closed,
/// for app copies already installed.
struct ApplyView: View {
    @Environment(ClassesStore.self) private var injected: ClassesStore?
    @Environment(AccountStore.self) private var account

    @State private var isOnScreen = false

    private var classes: ClassesStore { injected ?? .shared }

    var body: some View {
        AdminPage(refresh: { await classes.load(userID: account.userID, force: true) }) { layout in
            VStack(alignment: .leading, spacing: 0) {
                if classes.isVisible {
                    AccountHeader(
                        marker: "apply / teach",
                        title: "Teach a live class.",
                        lede: "Experienced FRC students teach short, free live classes on LearnFRC lessons. You apply on learnfrc.com, and it takes about 30 to 45 minutes."
                    )
                    ClassesTeachCard(topPadding: 20)
                } else if classes.feed == nil, classes.lastError == nil {
                    // Asking the site whether classes are open; nothing is said either way yet.
                    AdminLoadingBlock(lines: 3)
                } else {
                    nothingOpen
                }
            }
            .frame(maxWidth: 830, alignment: .leading)
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
        .task(id: account.isLoading ? nil : (account.userID?.uuidString ?? "guest")) {
            guard !account.isLoading else { return }
            await classes.load(userID: account.userID)
        }
    }

    /// The site's closed /apply, word for word apart from the button.
    private var nothingOpen: some View {
        VStack(alignment: .leading, spacing: 0) {
            AccountHeader(marker: "apply", title: "Nothing to apply for right now.")
            Text("LearnFRC isn’t taking applications at the moment. The lessons are all still yours.")
                .lfProse(17, lineHeight: 1.5, color: LF.Palette.graphite)
                .frame(maxWidth: 620, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Link(destination: AccountLinks.contact) {
                Text("Questions go to \(Text(AccountLinks.contactEmail).foregroundStyle(LF.Palette.blue).underline()).")
                    .font(LF.Fonts.mono(12.5, relativeTo: .caption))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityHint("Writes an email")
            .padding(.top, 16)
        }
    }
}

// MARK: - Previews

#Preview("Apply, classes open") {
    NavigationStack {
        ApplyView()
    }
    .environment(ClassesStore.preview(.preview(signedIn: true)))
    .appEnvironment(.preview(signedIn: true))
}

#Preview("Apply, nothing open") {
    NavigationStack {
        ApplyView()
    }
    .environment(ClassesStore.preview(.hidden))
    .appEnvironment(.preview(signedIn: false))
}
