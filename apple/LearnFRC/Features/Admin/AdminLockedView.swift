import SwiftUI

/// The locked drawer: what a signed-in account sees on an admin screen it doesn't hold the role
/// for. The site's card, word for word; nothing is wrong with the account and it stays signed
/// in.
struct AdminLockedView<Action: View>: View {
    let slug: String
    let title: String
    let message: String
    @ViewBuilder var action: Action

    var body: some View {
        NotebookCard(tilt: .preset(2), tape: true, padding: 26) {
            SlugText(slug)
            Text(title)
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Text(message)
                .lfProse(16.5, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            action
                .padding(.top, 24)
        }
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }
}

/// /admin (and the feedback inbox) for an account that isn't an admin.
struct AdminLockedDashboardCard: View {
    var body: some View {
        AdminLockedView(
            slug: "access / denied",
            title: "This drawer is locked.",
            message: AdminError.adminOnly
        ) {
            AdminBackToDashboardButton()
        }
    }
}

/// /admin/team for an admin who isn't a super admin.
struct AdminLockedTeamCard: View {
    var body: some View {
        AdminLockedView(
            slug: "access / super admins only",
            title: "This one stays with the super admins.",
            message: "Admins open /admin and work the numbers, the feedback inbox and the edit queue. Deciding who else gets that access is a super admin’s job, and this account isn’t one. Nothing is wrong with it."
        ) {
            AdminBackToPanelButton()
        }
    }
}

/// "Back to the admin panel".
struct AdminBackToPanelButton: View {
    var body: some View {
        AdminLink(to: .dashboard) { Text("Back to the admin panel") }
            .buttonStyle(.ink)
    }
}

/// "Back to your dashboard": the site's /dashboard is the app's Home.
struct AdminBackToDashboardButton: View {
    @Environment(AppModel.self) private var app: AppModel?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button("Back to your dashboard") {
            if let app {
                app.popToRoot()
                app.selectedTab = .home
            } else {
                dismiss()
            }
        }
        .buttonStyle(.ink)
    }
}

/// An admin screen opened while signed out (a link, Handoff): the site sends people to sign
/// in first, so this asks for that, and the screen fills in once they have.
struct AdminSignedOutCard: View {
    let destination: AdminDestination
    @State private var authScreen: AuthFlowView.Screen?

    var body: some View {
        NotebookCard(tilt: .preset(1), tape: true, padding: 26) {
            SlugText("sign in first")
            Text(destination == .team ? "This one stays with the super admins." : "This drawer is locked.")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Text("The admin panel is open to administrators only, so it needs you signed in first.")
                .lfProse(16.5, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Button("Sign in") { authScreen = .signIn }
                .buttonStyle(.ink)
                .padding(.top, 24)
        }
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
        .authSheet(item: $authScreen)
    }
}

#Preview("Locked cards", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        ScrollView {
            VStack(spacing: 48) {
                AdminLockedDashboardCard()
                AdminLockedTeamCard()
            }
            .padding(LF.Metrics.gutter)
            .padding(.top, 24)
        }
        .paperBackground()
    }
    .appEnvironment(.preview(signedIn: true))
}
