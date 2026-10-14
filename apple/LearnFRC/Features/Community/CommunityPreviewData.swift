import SwiftUI

// Made-up people for the community previews (real department names come from
// `PreviewData`). The signed-in preview learner is `maya_builds` on team 9765.

enum PreviewCommunity {
    static let totals = BoardTotals(learners: 1_284, totalXp: 214_630)

    static let weekly = BoardSheet(board: .weekly, learners: [
        BoardLearner(rank: 1, username: "kai_cad", teamNumber: 9765, role: "student", xp: 168, level: 5, lessons: 11),
        BoardLearner(rank: 2, username: "torque_tess", teamNumber: 4021, role: "student", xp: 142, level: 12, lessons: 9),
        BoardLearner(rank: 3, username: "swerve_sam", teamNumber: 7312, role: "student", xp: 121, level: 7, lessons: 8),
        BoardLearner(rank: 4, username: "lumen_mentor", teamNumber: nil, role: "mentor", xp: 96, level: 9, lessons: 6),
        BoardLearner(rank: 5, username: "maya_builds", teamNumber: 9765, role: "student", xp: 74, level: 3, lessons: 5),
        BoardLearner(rank: 6, username: "priya_codes", teamNumber: 9765, role: "student", xp: 54, level: 2, lessons: 4),
        BoardLearner(rank: 7, username: "ohm_and_away", teamNumber: 1678, role: "alum", xp: 40, level: 18, lessons: 3),
        BoardLearner(rank: 8, username: "gearhead_gus", teamNumber: 4021, role: "student", xp: 22, level: 4, lessons: 2),
    ], totals: totals)

    static let allTime = BoardSheet(board: .alltime, learners: [
        BoardLearner(rank: 1, username: "ohm_and_away", teamNumber: 1678, role: "alum", xp: 1_812, lessons: 121),
        BoardLearner(rank: 2, username: "torque_tess", teamNumber: 4021, role: "student", xp: 1_164, lessons: 82),
        BoardLearner(rank: 3, username: "maya_builds", teamNumber: 9765, role: "student", xp: 845, lessons: 58),
        BoardLearner(rank: 4, username: "lumen_mentor", teamNumber: nil, role: "mentor", xp: 802, lessons: 61),
        BoardLearner(rank: 5, username: "swerve_sam", teamNumber: 7312, role: "student", xp: 640, lessons: 44),
        BoardLearner(rank: 6, username: "kai_cad", teamNumber: 9765, role: "student", xp: 410, lessons: 17),
        BoardLearner(rank: 7, username: "gearhead_gus", teamNumber: 4021, role: "student", xp: 318, lessons: 24),
        BoardLearner(rank: 8, username: "priya_codes", teamNumber: 9765, role: "student", xp: 180, lessons: 8),
    ], totals: totals)

    static let teams = BoardSheet(
        board: .teams,
        teams: [
            BoardTeam(rank: 1, teamNumber: 4021, members: 9, xp: 3_920),
            BoardTeam(rank: 2, teamNumber: 1678, members: 2, xp: 1_990),
            BoardTeam(rank: 3, teamNumber: 9765, members: 4, xp: 1_530),
            BoardTeam(rank: 4, teamNumber: 7312, members: 3, xp: 915),
            BoardTeam(rank: 5, teamNumber: 254, members: 1, xp: 120),
        ],
        teamsPerMember: [
            BoardTeam(rank: 1, teamNumber: 4021, members: 9, xp: 3_920),
            BoardTeam(rank: 2, teamNumber: 9765, members: 4, xp: 1_530),
            BoardTeam(rank: 3, teamNumber: 7312, members: 3, xp: 915),
        ],
        minMembers: 3,
        totals: totals
    )

    static let boards: [LeaderboardBoard: BoardSheet] = [.weekly: weekly, .alltime: allTime, .teams: teams]

    static let emptyBoards: [LeaderboardBoard: BoardSheet] = [
        .weekly: BoardSheet(board: .weekly, totals: BoardTotals(learners: 0, totalXp: 0)),
        .alltime: BoardSheet(board: .alltime, totals: BoardTotals(learners: 0, totalXp: 0)),
        .teams: BoardSheet(board: .teams, totals: BoardTotals(learners: 0, totalXp: 0)),
    ]

    /// Maya alone on team 9765 (the state most teams are in).
    static var soloTeam: Team {
        let full = PreviewData.team
        let me = full.members[0]
        return Team(
            number: full.number,
            memberCount: 1,
            members: [me],
            subteamCoverage: full.subteamCoverage.map { coverage in
                let mine = coverage.members.filter { $0.username == me.username }
                return SubteamCoverage(
                    slug: coverage.slug, name: coverage.name, icon: coverage.icon, lessonCount: coverage.lessonCount,
                    teamCompleted: mine.first?.completed ?? 0, members: mine
                )
            },
            inviteURL: full.inviteURL
        )
    }

    /// Maya's own public record (what others see).
    static let myPublicProfile = PublicProfile(
        username: "maya_builds",
        teamNumber: 9765,
        bio: "Programming lead. Ask me about swerve offsets.",
        role: "student",
        xp: 245,
        createdAt: FlexibleDate.parse("2026-08-20T18:04:11Z"),
        lessonCount: 10,
        achievements: [
            PublicAchievement(slug: "first-lesson", name: "First Steps", icon: "CheckCircle2", earnedAt: FlexibleDate.parse("2026-08-20T19:10:00Z")),
            PublicAchievement(slug: "five-lessons", name: "Warmed Up", icon: "Flame", earnedAt: FlexibleDate.parse("2026-09-01T18:40:00Z")),
            PublicAchievement(slug: "ten-lessons", name: "Committed", icon: "Flame", earnedAt: FlexibleDate.parse("2026-10-12T20:05:00Z")),
        ]
    )

    /// Somebody brand new: no bio, no team, no badges.
    static let newcomer = PublicProfile(
        username: "rookie_rae",
        role: "student",
        xp: 0,
        createdAt: FlexibleDate.parse("2026-10-11T15:00:00Z"),
        lessonCount: 0
    )

    static let profiles: [PublicProfile] = [PreviewData.publicProfile, myPublicProfile, newcomer]
}

extension CommunityClient {
    /// Preview data, instantly.
    static let preview = CommunityClient.previewing()

    /// - Parameters:
    ///   - boards: what each board returns.
    ///   - team: the signed-in learner's team (nil for no team number).
    ///   - failing: every fetch fails as if offline (cached copies still come back when `cached` is true).
    ///   - cached: whether a saved copy exists on the device.
    static func previewing(
        boards: [LeaderboardBoard: BoardSheet] = PreviewCommunity.boards,
        team: Team? = PreviewData.team,
        profiles: [PublicProfile] = PreviewCommunity.profiles,
        failing: Bool = false,
        cached: Bool = false
    ) -> CommunityClient {
        let savedAt = PreviewData.now.addingTimeInterval(-3 * 3600)
        return CommunityClient(
            cachedBoard: { board in
                guard cached, let sheet = boards[board] else { return nil }
                return CommunityStamped(value: sheet, fetchedAt: savedAt)
            },
            board: { board in
                if failing { throw APIError.network }
                return boards[board] ?? BoardSheet(board: board)
            },
            cachedTeam: { _ in cached ? CommunityStamped(value: TeamPayload(team: team), fetchedAt: savedAt) : nil },
            team: { _ in
                if failing { throw APIError.network }
                return team
            },
            cachedProfile: { _ in nil },
            profile: { username in
                if failing { throw APIError.network }
                return profiles.first { $0.username.lowercased() == username.lowercased() }
            },
            instantBoard: { board in
                guard !failing || cached, let sheet = boards[board] else { return nil }
                return CommunityStamped(value: sheet, fetchedAt: failing ? savedAt : PreviewData.now)
            },
            instantTeam: { _ in
                guard !failing || cached else { return nil }
                return CommunityStamped(value: TeamPayload(team: team), fetchedAt: failing ? savedAt : PreviewData.now)
            },
            instantProfile: { username in
                guard !failing, let profile = profiles.first(where: { $0.username.lowercased() == username.lowercased() }) else { return nil }
                return CommunityStamped(value: profile, fetchedAt: PreviewData.now)
            }
        )
    }
}

/// Wraps a community screen the way the shell does: a navigation stack that knows the
/// community routes, the stores, and a community client.
struct CommunityPreviewHost<Content: View>: View {
    var model: AppModel
    var client: CommunityClient
    @ViewBuilder var content: Content

    init(model: AppModel = .preview, client: CommunityClient = .preview, @ViewBuilder content: () -> Content) {
        self.model = model
        self.client = client
        self.content = content()
    }

    var body: some View {
        NavigationStack {
            content
                .navigationDestination(for: AppRoute.self) { route in
                    CommunityPreviewDestination(route: route)
                }
        }
        .appEnvironment(model)
        .environment(\.communityClient, client)
        .tint(LF.Palette.blue)
    }
}

/// The community half of the shell's `AppRouteDestination`, for previews.
struct CommunityPreviewDestination: View {
    let route: AppRoute

    var body: some View {
        switch route {
        case .profile(let username): PublicProfileView(username: username)
        case .team: TeamView()
        case .leaderboard: LeaderboardView()
        case .achievements: AchievementsView()
        case .certificate(let id): CertificateView(departmentID: id)
        default:
            Text("Another feature's screen")
                .font(LF.Fonts.mono(13))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .paperBackground()
        }
    }
}
