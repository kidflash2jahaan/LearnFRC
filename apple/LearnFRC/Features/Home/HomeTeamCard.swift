import SwiftUI

/// Where Home gets the learner's team from.
enum HomeTeamSource {
    /// `GET /api/app/team` through `APIClient`.
    case live
    /// A fixed answer (previews): a team, or nil for "no team on the account".
    case fixed(Team?)
}

/// Loads `/api/app/team` for the Home snippet. Keeps the last good roster when a refresh
/// fails, and doesn't ask again within two minutes unless forced (pull to refresh).
@Observable
@MainActor
final class HomeTeamModel {
    enum Phase: Equatable {
        case idle
        case loading
        case loaded(Team?)
        case failed
    }

    private(set) var phase: Phase = .idle
    @ObservationIgnored private var loadedNumber: Int?
    @ObservationIgnored private var loadedAt: Date?
    @ObservationIgnored private var loadedStamp: String?

    private var hasRoster: Bool {
        if case .loaded = phase { return true }
        return false
    }

    /// - Parameter stamp: changes when the learner's own lessons change (see
    ///   `HomeView.progressStamp`). A new stamp reloads even inside the two minutes, so
    ///   the snippet never counts the roster from before a completion or a sign-in's
    ///   guest migration.
    func load(teamNumber: Int?, online: Bool, force: Bool = false, stamp: String = "") async {
        guard let teamNumber else {
            phase = .idle
            loadedNumber = nil
            loadedStamp = nil
            return
        }
        let sameTeam = loadedNumber == teamNumber
        let fresh = loadedStamp == stamp
        if !force, sameTeam, fresh, hasRoster, let loadedAt, Date.now.timeIntervalSince(loadedAt) < 120 { return }
        if !(sameTeam && hasRoster) { phase = .loading }
        guard online else {
            if !(sameTeam && hasRoster) { phase = .failed }
            return
        }
        do {
            let team = try await APIClient.shared.team()
            // A newer load (a new stamp) replaced this one; its answer wins.
            guard !Task.isCancelled else { return }
            phase = .loaded(team)
            loadedNumber = teamNumber
            loadedAt = .now
            loadedStamp = stamp
        } catch {
            if Task.isCancelled || (sameTeam && hasRoster) { return }
            phase = .failed
        }
    }
}

// MARK: - The snippet

/// A short look at the learner's team: who's on it and which department nobody has opened
/// yet. Usernames only, never anyone's full name. The full page is `TeamView` (`AppRoute.team`).
struct HomeTeamCard: View {
    let teamNumber: Int
    let phase: HomeTeamModel.Phase

    @ScaledMetric(relativeTo: .body) private var avatarSize: CGFloat = 36

    var body: some View {
        NotebookCard(tilt: .preset(3)) {
            SlugText("team / \(teamNumber)")
            Text(verbatim: "Team \(teamNumber)")
                .homeTitle(23)
                .padding(.top, 6)

            Group {
                switch phase {
                case .loaded(let team?):
                    roster(team)
                case .idle, .loading:
                    VStack(alignment: .leading, spacing: 10) {
                        SkeletonBlock(height: 15, width: 220)
                        HomeFlowLayout(spacing: 8, lineSpacing: 8) {
                            ForEach(0..<4, id: \.self) { _ in
                                SkeletonBlock(height: min(avatarSize, 76), width: min(avatarSize, 76))
                            }
                        }
                    }
                case .loaded(nil), .failed:
                    Text("The roster didn't load this time. \(HomeCopy.retry)")
                        .homeSub(15)
                }
            }
            .padding(.top, 10)

            DashedRule()
                .padding(.top, 18)

            HomeFlowLayout(spacing: 10, lineSpacing: 10) {
                NavigationLink(value: AppRoute.team) {
                    Text("Open your team")
                }
                .buttonStyle(.inkGhostSmall)
                NavigationLink(value: AppRoute.leaderboard) {
                    Text("Leaderboard")
                }
                .buttonStyle(.inkGhostSmall)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 14)
        }
    }

    @ViewBuilder
    private func roster(_ team: Team) -> some View {
        if team.memberCount <= 1 {
            VStack(alignment: .leading, spacing: 12) {
                Text("Just you so far. Send your team the link and their progress shows up here.")
                    .homeSub(15)
                if let invite = team.inviteURL {
                    ShareLink(item: invite) {
                        Label("Share the invite link", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.inkSmall)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 14) {
                Text(summary(team))
                    .homeSub(15)
                avatars(team)
                if let gapLine = gapLine(team) {
                    VStack(alignment: .leading, spacing: 3) {
                        SlugText("nobody's opened yet")
                        Text(gapLine)
                            .font(LF.Fonts.body(15, weight: .semibold))
                            .foregroundStyle(LF.Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private func summary(_ team: Team) -> String {
        let people = "\(HomeCopy.count(team.memberCount, "person", "people")) learning here."
        let total = team.subteamCoverage.count
        guard total > 0 else { return people }
        let started = team.subteamCoverage.filter { !$0.isGap }.count
        return "\(people) \(started) of \(HomeCopy.count(total, "department")) started."
    }

    private func gapLine(_ team: Team) -> String? {
        let gaps = team.gaps
        guard let first = gaps.first else { return nil }
        return gaps.count == 1 ? first.name : "\(first.name) and \(gaps.count - 1) more"
    }

    private func avatars(_ team: Team) -> some View {
        let shown = Array(team.members.sorted { ($0.isYou ? 0 : 1, -$0.completed) < ($1.isYou ? 0 : 1, -$1.completed) }.prefix(6))
        let extra = max(0, team.memberCount - shown.count)
        // Overlapping, and wrapping onto a second row rather than pushing the card past the
        // screen's edge: at the accessibility sizes six faces are wider than a phone. They're
        // read as one list, so they stop growing a little past twice their size.
        return HomeFlowLayout(spacing: -6, lineSpacing: 6) {
            ForEach(shown) { member in
                InitialsAvatar(name: member.username, seed: member.username, imageURL: member.avatarURL, size: min(avatarSize, 76))
            }
            if extra > 0 {
                Text("+\(extra)")
                    .font(LF.Fonts.mono(12, weight: .bold, relativeTo: .caption))
                    .foregroundStyle(LF.Palette.graphite)
                    .padding(.leading, 14)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Members: " + shown.map { $0.isYou ? "\($0.username), you" : $0.username }.joined(separator: ", ")
            + (extra > 0 ? ", and \(extra) more" : ""))
    }
}

/// For a signed-in learner with no team number: the site's nudge, word for word.
struct HomeTeamNudge: View {
    var body: some View {
        NotebookCard(tilt: .preset(3)) {
            SlugText("profile / team number")
            Text("Add your team number.")
                .homeTitle(20, relativeTo: .title3)
                .padding(.top, 6)
            Text("It puts your team beside your name on the leaderboard.")
                .homeSub(15)
                .padding(.top, 6)
            HomeFlowLayout(spacing: 10, lineSpacing: 10) {
                // Pushes Settings on iPhone and iPad; opens the Settings window on a Mac.
                AccountSettingsLink("Settings")
                    .buttonStyle(.inkGhostSmall)
                NavigationLink(value: AppRoute.leaderboard) {
                    Text("Leaderboard")
                }
                .buttonStyle(.inkGhostSmall)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
        }
    }
}

// MARK: - Previews

#Preview("Team, iPhone", traits: .fixedLayout(width: 393, height: 1100)) {
    NavigationStack {
        ScrollView {
            VStack(spacing: 30) {
                HomeTeamCard(teamNumber: PreviewData.teamNumber, phase: .loaded(PreviewData.team))
                HomeTeamCard(teamNumber: 4021, phase: .loading)
                HomeTeamCard(teamNumber: 4021, phase: .failed)
                HomeTeamNudge()
            }
            .padding(LF.Metrics.gutter)
            .padding(.top, 14)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .light)
}

#Preview("Team, iPad, dark", traits: .fixedLayout(width: 440, height: 760)) {
    NavigationStack {
        ScrollView {
            VStack(spacing: 30) {
                HomeTeamCard(teamNumber: PreviewData.teamNumber, phase: .loaded(PreviewData.team))
                HomeTeamNudge()
            }
            .padding(LF.Metrics.gutter)
            .padding(.top, 14)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .dark)
}
