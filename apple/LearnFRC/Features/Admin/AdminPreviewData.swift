import Foundation

/// Made-up admin payloads for previews: plausible figures, handles that belong to nobody, no
/// real people's words.
enum AdminPreviewData {
    private static func ago(_ minutes: Double) -> Date { Date.now.addingTimeInterval(-minutes * 60) }

    private static func rows(_ items: [(String, Int)], sub: [String?] = []) -> [AdminMiniRow] {
        let top = max(1, items.map(\.1).max() ?? 1)
        return items.enumerated().map { index, item in
            AdminMiniRow(label: item.0, sub: index < sub.count ? sub[index] : nil, value: item.1, pct: Double(item.1) / Double(top) * 100)
        }
    }

    static let dashboard: AdminDashboard = {
        let calendar = Calendar(identifier: .gregorian)
        let days: [AdminDashboard.Growth.Day] = (0..<30).map { offset in
            let date = calendar.date(byAdding: .day, value: offset - 29, to: .now) ?? .now
            let parts = calendar.dateComponents([.year, .month, .day], from: date)
            let key = String(format: "%04d-%02d-%02d", parts.year ?? 2026, parts.month ?? 1, parts.day ?? 1)
            let wave = Int(40 + 22 * sin(Double(offset) / 3.1) + Double(offset) * 2.2)
            return .init(day: key, signups: max(0, wave / 9 + (offset % 4)), completions: max(0, wave / 3), views: wave * 4, visitors: offset < 6 ? 0 : wave)
        }
        return AdminDashboard(
            role: .superadmin,
            generatedAt: .now,
            refreshSeconds: 30,
            now: .init(onlineNow: 7, openFeedback: 2, feedbackTotal: 41, pendingApplications: 1, pendingEdits: 0, pendingSubmissions: 0),
            stamps: [
                .init(key: "visitors", value: 18_204, label: "unique visitors, since Oct 17, 2025"),
                .init(key: "pageViews", value: 96_431, label: "page views, 12,880 of them on articles"),
                .init(key: "learners", value: 2_317, label: "learners: 1,902 accounts (including unverified) + 415 guest learners"),
                .init(key: "completions", value: 14_655, label: "lessons completed, 1,204 by guests"),
            ],
            notes: .init(
                traffic: nil,
                coverage: "Page views and unique visitors are Vercel’s, and Vercel keeps a rolling 366 days, so both of those cover Oct 17, 2025 onward rather than the whole history. Every figure read out of the database does go back to the first signup."
            ),
            tally: [
                .init(slug: "tally / reach", rows: [
                    .init(label: "FRC teams represented", value: 384, hint: "distinct team numbers on profiles, placeholders excluded"),
                    .init(label: "Guest learners", value: 415, hint: "learning without an account"),
                    .init(label: "Guide viewers", value: 6_120, hint: "21,402 guide views"),
                    .init(label: "Referred signups", value: 88, hint: "of 1,902 accounts"),
                ]),
                .init(slug: "tally / learning", rows: [
                    .init(label: "Activation", value: 62, suffix: "%", hint: "1,180 of 1,902 accounts finished a lesson"),
                    .init(label: "Return rate", value: 41, suffix: "%", hint: "of activated accounts, active on a second day"),
                    .init(label: "Power users", value: 96, hint: "active on 5+ days; median 6 lessons across all activated"),
                    .init(label: "Achievements earned", value: 4_410, hint: "312,400 XP awarded"),
                ]),
                .init(slug: "tally / the binder", rows: [
                    .init(label: "Lessons published", value: 394, hint: "across 9 departments"),
                    .init(label: "Bookmarks kept", value: 1_022, hint: "lessons saved to read later"),
                    .init(label: "Email queue", value: 640, hint: "880 subscribers, 120 opted out"),
                ]),
            ],
            growth: .init(daily: days, totals: .init(visitors: 3_904, signups: 210, completions: 1_640), footnote: "Days before Oct 3 plot views but no visitors: the beacon had not started sending visitor ids, so that stretch of the visitor line is missing data, not a quiet week. The reconstructed backfill is excluded here, so nothing plotted is synthetic."),
            funnel: .init(
                rows: [
                    .init(label: "Signed up", value: 1_902, pct: 100),
                    .init(label: "Opened a lesson", sub: "88% of Signed up", value: 1_680, pct: 88),
                    .init(label: "Attempted a quiz", sub: "74% of Opened a lesson", value: 1_240, pct: 65),
                    .init(label: "Completed a lesson", sub: "95% of Attempted a quiz", value: 1_180, pct: 62),
                ],
                badge: "-26% Attempted a quiz",
                note: "Every step measured directly, 9,412 events recorded.",
                anonymousRows: rows([("Opened a lesson", 4_210), ("Attempted a quiz", 1_022)]),
                empty: "Funnel unavailable. Check the server logs for [funnel]."
            ),
            sources: .init(
                users: .init(week: [.init(name: "google", count: 31), .init(name: "direct", count: 22), .init(name: "chief delphi", count: 9)],
                             allTime: [.init(name: "google", count: 820), .init(name: "direct", count: 610), .init(name: "chief delphi", count: 240), .init(name: "reddit", count: 130), .init(name: "discord", count: 102)]),
                visitors: .init(
                    week: [.init(name: "google", count: 1_402), .init(name: "direct", count: 820), .init(name: "chiefdelphi.com", count: 340), .init(name: "reddit.com", count: 210), .init(name: "youtube.com", count: 120), .init(name: "bing", count: 80), .init(name: "duckduckgo", count: 40)],
                    allTime: [.init(name: "google", count: 9_402), .init(name: "direct", count: 6_120)],
                    weekTotal: 2_810,
                    allTimeTotal: 18_204
                ),
                footnote: "“All-time” means two different spans here. On the Users view it is every signup ever, out of the database. On the Visitors view it is only as far back as Vercel still keeps, which is a rolling 366 days, starting Oct 17, 2025. Differencing the two would invent a gap that is really just the older half of the site’s history."
            ),
            engagement: .init(
                lessons: rows([("What a PID loop actually does", 412), ("Choosing a gearbox ratio", 380), ("Wiring the CAN bus", 301), ("Scouting with a spreadsheet", 188)]),
                departments: rows([("Programming", 3_120), ("Mechanical", 2_840), ("Electrical", 1_904)])
            ),
            teams: .init(
                teams: rows([("#254", 120), ("#1678", 98), ("#4414", 61)], sub: ["14 members", "11 members", "6 members"]),
                recruiters: rows([("@pitcrewpat", 14), ("member a1b2c3", 6)]),
                surfaces: rows([("Lesson milestone", 30), ("Certificate", 18), ("Dashboard", 9), ("Leaderboard", 2)]) + [AdminMiniRow(label: "Before tracking", sub: "surface unknown", value: 29)],
                surfacesFootnote: nil
            ),
            articles: rows([("Why your robot browns out", 2_010), ("Swerve, explained without the hype", 1_402)]),
            achievements: rows([("First lesson", 1_180), ("Seven-day streak", 240), ("Department finished", 96)]),
            activity: .init(
                newestMembers: [.init(username: "gearhead_ava", teamNumber: 4414, createdAt: ago(4)), .init(username: nil, teamNumber: nil, createdAt: ago(80)), .init(username: "drive_coach_m", teamNumber: 1678, createdAt: ago(60 * 26))],
                recentCompletions: [.init(user: "@gearhead_ava", lesson: "What a PID loop actually does", at: ago(2)), .init(user: "a member", lesson: "Wiring the CAN bus", at: ago(41))]
            )
        )
    }()

    static let feedback = AdminFeedbackPage(
        items: [
            AdminFeedbackItem(id: UUID(), message: "The gear ratio calculator rounds the output speed to a whole number, which hides the difference between two of the ratios I was comparing. Could it show one decimal place?", page: "/tools/frc-gear-ratio-calculator", hasReplyAddress: true, status: .open, createdAt: ago(18)),
            AdminFeedbackItem(id: UUID(), message: "Love the CAN bus lesson. The termination resistor section finally made it click for our rookies.", page: "/guides/electrical/can/wiring-the-can-bus", hasReplyAddress: false, status: .open, createdAt: ago(60 * 5)),
            AdminFeedbackItem(id: UUID(), message: "Is there a way to export the team sheet?", page: "/teams", hasReplyAddress: true, status: .replied, replyBody: "Not yet, but it's on the list. For now the team page prints cleanly from the browser.", repliedAt: ago(60 * 30), createdAt: ago(60 * 50)),
        ],
        openCount: 2,
        total: 41
    )

    static let team = AdminTeamDesk(
        grants: AdminTeamDesk.siteGrants,
        pending: [
            AdminTeamDesk.Application(
                id: UUID(), username: "scout_lead_sam", teamNumber: 4414, teamRole: "mentor", teamRoleLabel: "Mentor",
                experience: "Five seasons on 4414, the last two as the electrical mentor. I rebuilt our wiring standards after a brownout cost us a playoff match.\n\nI also run our scouting app.",
                why: "I already answer most of these questions on Chief Delphi. I'd like to keep the electrical lessons honest.",
                availability: "a couple of evenings a month", createdAt: ago(60 * 52)
            ),
        ],
        pendingTruncated: false,
        team: [
            AdminTeamDesk.Member(userId: UUID(), username: "owner_desk", teamNumber: nil, role: .superadmin, roleWord: "owner", grantedAt: ago(60 * 24 * 90), note: nil, isOwner: true, isYou: true, canChange: false),
            AdminTeamDesk.Member(userId: UUID(), username: "pitcrewpat", teamNumber: 254, role: .admin, roleWord: "admin", grantedAt: ago(60 * 24 * 30), note: "accepted application", isOwner: false, isYou: false, canChange: true),
        ],
        decided: [
            AdminTeamDesk.Decided(id: UUID(), username: "eager_rookie", status: "rejected", statusWord: "turned down", reviewedAt: ago(60 * 24 * 12), createdAt: ago(60 * 24 * 14), reviewNote: "Come back after a season on a team."),
        ],
        decidedTruncated: false
    )

    static func apply(mode: AdminApplyState.Mode, open: Bool) -> AdminApplyState {
        AdminApplyState(
            applicationsOpen: open,
            mode: mode,
            heading: AdminApplyState.heads[mode] ?? AdminApplyState.Heading(title: "Apply", slug: ""),
            record: .init(username: mode == .noHandle ? nil : "gearhead_ava", teamNumber: 4414, teamRoleLabel: "Student"),
            application: {
                switch mode {
                case .pending: .init(status: "pending", createdAt: ago(60 * 24 * 2), reviewedAt: nil, reviewNote: nil)
                case .again: .init(status: "rejected", createdAt: ago(60 * 24 * 40), reviewedAt: ago(60 * 24 * 38), reviewNote: "Come back after a season on a team.")
                default: nil
                }
            }(),
            jobs: AdminApplyState.siteJobs
        )
    }
}
