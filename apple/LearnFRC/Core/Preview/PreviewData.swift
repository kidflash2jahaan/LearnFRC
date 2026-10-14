import Foundation

/// Sample content so every view previews without the network. The catalog,
/// lessons, articles, badges, glossary and paths are real LearnFRC text
/// (see `PreviewData+Content.swift`); the people are made up.
///
///     #Preview { HomeView().appEnvironment(.preview) }
///     #Preview("Guest") { HomeView().appEnvironment(.preview(signedIn: false)) }
///     #Preview("Goal met") { HomeView().appEnvironment(.preview(phase: .goalMet)) }
enum PreviewData {
    /// A fixed "now" for account data: Wednesday 14 October 2026, 16:00 UTC.
    static let now = Date(timeIntervalSince1970: 1_791_993_600)

    // MARK: Catalog shortcuts

    /// Every lesson body in the preview catalog.
    static let lessonBodies: [LessonBody] = [
        budgetLessonBody, codeLessonBody, calloutLessonBody, codeAndTableLessonBody, verifiedLessonBody,
    ]

    /// Programming, Controls & Sensors.
    static var department: Department { departments[0] }
    /// Business, Operations & Fundraising.
    static var businessDepartment: Department { departments[1] }
    /// "Autonomous: Odometry, Trajectories, and Simulation".
    static var module: Module { department.modules.first { $0.slug == "autonomous-trajectories-simulation" } ?? department.modules[0] }
    /// "Building Autonomous Routines" (fenced Java code).
    static var lesson: LessonSummary { lessonSummary(codeLessonBody.id) }
    /// The body of `lesson`.
    static var lessonBody: LessonBody { codeLessonBody }
    static var lessonLocation: LessonLocation { location(codeLessonBody.id) }
    static var article: Article { articles[0] }
    static var term: GlossaryTerm { glossary[0] }
    static var path: LearningPath { paths[0] }
    static var achievement: Achievement { achievements[0] }
    static var startGoals: [StartGoal] { reference.startGoals }

    /// Every lesson in the preview catalog, in course order.
    static var allLessons: [LessonLocation] {
        departments.flatMap { department in
            department.modules.flatMap { module in
                module.lessons.map { LessonLocation(department: department, module: module, lesson: $0) }
            }
        }
    }

    static func lessonSummary(_ id: UUID) -> LessonSummary {
        allLessons.first { $0.lesson.id == id }?.lesson ?? allLessons[0].lesson
    }

    static func location(_ id: UUID) -> LessonLocation {
        allLessons.first { $0.lesson.id == id } ?? allLessons[0]
    }

    /// Real lesson Markdown with everything the renderer handles: headings, bold,
    /// inline code, fenced Java, a GFM table, then a bold-led blockquote callout and a
    /// numbered list. Two real lessons back to back (REVLib, then deploying from VS Code),
    /// because no single lesson uses all of them.
    static var markdownShowcase: String {
        let callout = calloutLessonBody.content
        let deploy = callout.range(of: "## Deploying to the roboRIO").map { String(callout[$0.lowerBound...]) } ?? callout
        let trimmedDeploy = deploy.range(of: "## Vendor libraries").map { String(deploy[..<$0.lowerBound]) } ?? deploy
        return codeAndTableLessonBody.content + "\n\n" + trimmedDeploy.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: Reference

    static let lessonBridge: [String: [String]] = [
        "075d3c3b-2f6f-4fe3-ab63-9cd02809eb2c": ["frc-can-bus", "frc-brownout"],
        "d83e1d25-61d6-439f-93d7-b0402ac39b74": ["frc-preseason-training-plan"],
    ]

    static let reference = Reference(
        glossary: glossary,
        glossaryCategories: glossaryCategories,
        paths: paths,
        lessonBridge: lessonBridge,
        startGoals: [
            StartGoal(id: "new", label: "I'm brand new", blurb: "Rookie, or still working out where you fit.", iconName: "Rocket", pathSlug: "new-member-onboarding"),
            StartGoal(id: "code", label: "Programming & controls", blurb: "Robot code, sensors, autonomous.", iconName: "Code2", pathSlug: "become-a-robot-programmer"),
            StartGoal(id: "build", label: "Build, CAD & electrical", blurb: "Designing, fabricating and wiring the robot.", iconName: "Wrench", pathSlug: "build-and-design-track"),
            StartGoal(id: "impact", label: "Business, media & outreach", blurb: "Sponsors, storytelling, the Impact Award.", iconName: "Trophy", pathSlug: "win-the-impact-award"),
            StartGoal(id: "gameday", label: "Scouting, strategy & drive team", blurb: "Everything that happens at the competition.", iconName: "Gamepad2", pathSlug: "game-day-ready"),
        ],
        version: "preview"
    )

    // MARK: People (made up)

    static let userID = UUID(uuidString: "6f1c2a9e-4b7d-4e2a-9c51-2d8e0f3a7b14")!
    static let teamNumber = 9765

    static let profile = Profile(
        id: userID,
        username: "maya_builds",
        fullName: "Maya Okafor",
        avatarUrl: nil,
        teamNumber: teamNumber,
        bio: "Programming lead. Ask me about swerve offsets.",
        role: "student",
        xp: 245,
        createdAt: FlexibleDate.parse("2026-08-20T18:04:11Z"),
        emailOptIn: false,
        emailChoiceAt: FlexibleDate.parse("2026-09-02T17:30:00Z")
    )

    /// A signed-in learner with a username and a team.
    static let me = Me(
        user: Me.User(id: userID, email: "maya@example.com"),
        profile: profile,
        needsUsernameSetup: false,
        isPlaceholderUsername: false,
        emailPrompt: false,
        referralCount: 2
    )

    /// Same learner, before answering the one-time reminder-email question.
    static let meWithEmailPrompt = Me(
        user: me.user,
        profile: Profile(
            id: userID, username: "maya_builds", fullName: "Maya Okafor", teamNumber: teamNumber,
            role: "student", xp: 245, createdAt: profile.createdAt, emailOptIn: false, emailChoiceAt: nil
        ),
        needsUsernameSetup: false,
        emailPrompt: true,
        referralCount: 2
    )

    /// A Google-style account with no username yet (the username gate).
    static let meNeedsUsername = Me(
        user: Me.User(id: UUID(uuidString: "0b9e5d36-1c2f-4a8b-8e7d-5f6a3c2b1d09")!, email: "new.member@example.com"),
        profile: Profile(id: UUID(uuidString: "0b9e5d36-1c2f-4a8b-8e7d-5f6a3c2b1d09")!, username: nil, createdAt: now),
        needsUsernameSetup: true
    )

    /// A Google-style account carrying a machine-made handle (the username step, not the gate).
    static let mePlaceholderUsername = Me(
        user: Me.User(id: UUID(uuidString: "5d2c8e41-7a3b-4f60-9c1d-2e8b7a6f4c13")!, email: "jordan.lee@example.com"),
        profile: Profile(id: UUID(uuidString: "5d2c8e41-7a3b-4f60-9c1d-2e8b7a6f4c13")!, username: "cosmic_builder_77", xp: 40, createdAt: now),
        needsUsernameSetup: false,
        isPlaceholderUsername: true
    )

    // MARK: Rhythm in each phase

    /// Completion times that put the rhythm in `phase`, relative to `now`.
    static func completionDates(for phase: RhythmPhase, now: Date = PreviewData.now) -> [Date] {
        let hour: TimeInterval = 3600
        let day: TimeInterval = 86_400
        func daysAgo(_ n: Double, _ h: Double = 0) -> Date { now.addingTimeInterval(-n * day - h * hour) }
        let history = [40, 38, 33, 31, 26, 24, 19].map { daysAgo(Double($0), 3) }
        switch phase {
        case .new:
            return []
        case .firstLesson:
            return [daysAgo(0, 2)]
        case .building:
            return history + [daysAgo(2, 5), daysAgo(1, 4), daysAgo(0, 1)]
        case .goalMet:
            return history + [daysAgo(2, 6), daysAgo(2, 5), daysAgo(1, 4), daysAgo(1, 3), daysAgo(0, 2), daysAgo(0, 1)]
        case .returning:
            return history + [daysAgo(10, 2), daysAgo(0, 1)]
        case .resting:
            return history + [daysAgo(4, 2)]
        }
    }

    /// When the account was made, for each phase (new learners are in their first week).
    static func createdAt(for phase: RhythmPhase, now: Date = PreviewData.now) -> Date {
        switch phase {
        case .new: now.addingTimeInterval(-3600)
        case .firstLesson: now.addingTimeInterval(-2 * 86_400)
        default: profile.createdAt ?? now.addingTimeInterval(-60 * 86_400)
        }
    }

    /// The server's rhythm for each phase (computed with the same rules, in UTC).
    static func rhythm(_ phase: RhythmPhase) -> Rhythm {
        RhythmCalculator.compute(completedAt: completionDates(for: phase), createdAt: createdAt(for: phase), now: now)
    }

    static func rhythmCopy(_ phase: RhythmPhase) -> RhythmCopy {
        RhythmCalculator.describe(rhythm(phase))
    }

    // MARK: Progress

    /// A full `/api/app/me/progress` for a learner in `phase`.
    static func progress(_ phase: RhythmPhase) -> ProgressSnapshot {
        let dates = completionDates(for: phase)
        let lessons = allLessons
        let completions = dates.enumerated().map { index, date in
            Completion(lessonID: lessons[index % lessons.count].lesson.id, completedAt: date, xpAwarded: 10 + min(10, index % 4))
        }
        let xp = completions.reduce(0) { $0 + $1.xpAwarded } + (phase == .new ? 0 : 25)
        let earned = achievements
            .filter { $0.criteria.kind == .lessons && ($0.criteria.count ?? .max) <= completions.count }
            .map { EarnedAchievement(achievementID: $0.id, slug: $0.slug, earnedAt: dates.dropFirst(($0.criteria.count ?? 1) - 1).first) }
        let bookmarks = [
            Bookmark(lessonID: codeAndTableLessonBody.id, createdAt: now.addingTimeInterval(-86_400)),
            Bookmark(lessonID: budgetLessonBody.id, createdAt: now.addingTimeInterval(-5 * 86_400)),
        ]
        return ProgressSnapshot(
            completions: completions,
            bookmarks: phase == .new ? [] : bookmarks,
            earnedAchievements: earned,
            xp: xp,
            level: XPRules.level(forXP: xp),
            rhythm: rhythm(phase),
            rhythmCopy: rhythmCopy(phase),
            nextUnlock: nextUnlock(lessonsDone: completions.count)
        )
    }

    /// The nearest lesson-count badge (the site's `pickNextUnlock`).
    static func nextUnlock(lessonsDone: Int) -> NextUnlock? {
        let candidates = achievements.compactMap { badge -> (Achievement, BadgeProgress)? in
            guard badge.criteria.isNudgeable,
                  let progress = badge.criteria.progress(lessons: lessonsDone, departments: 0, streak: 0),
                  progress.target > 0, progress.remaining > 0 else { return nil }
            return (badge, progress)
        }
        let best = candidates.min { a, b in
            a.1.remaining != b.1.remaining ? a.1.remaining < b.1.remaining : a.1.fraction > b.1.fraction
        }
        return best.map { NextUnlock(name: $0.0.name, description: $0.0.description, icon: $0.0.icon, progress: $0.1) }
    }

    /// What a confirmed completion returns: real XP and a new badge.
    static var completionResult: CompletionResult {
        let badge = achievements.first { $0.slug == "ten-lessons" } ?? achievements[0]
        return CompletionResult(
            xpAwarded: 13,
            xp: 258,
            level: 3,
            newAchievements: [UnlockedAchievement(id: badge.id, slug: badge.slug, name: badge.name, description: badge.description, icon: badge.icon)],
            completedCount: 11,
            rhythm: rhythm(.building),
            rhythmCopy: rhythmCopy(.building),
            delivery: .server
        )
    }

    /// What an offline completion returns ("saved, will sync").
    static var queuedCompletionResult: CompletionResult {
        CompletionResult(
            xpAwarded: 0, xp: 245, level: 3, completedCount: 11,
            rhythm: rhythm(.building), rhythmCopy: rhythmCopy(.building), delivery: .queued
        )
    }

    // MARK: Community (made-up people, real department names)

    static var team: Team {
        func strip(_ done: [Int]) -> [MemberDeptProgress] {
            zip(departments, done).map { department, completed in
                let lessons = department.lessons
                let finished = completed > 0 ? lessons[min(completed, lessons.count) - 1] : nil
                let next = completed < lessons.count ? lessons[completed] : nil
                return MemberDeptProgress(
                    slug: department.slug,
                    name: department.name,
                    completed: completed,
                    total: department.lessonCount,
                    furthest: finished.map { lesson in
                        .init(title: lesson.title, moduleTitle: department.modules.first { $0.id == lesson.moduleID }?.title)
                    },
                    next: next.map { .init(title: $0.title, href: nil) }
                )
            }
        }
        return Team(
            number: teamNumber,
            memberCount: 4,
            members: [
                TeamMember(username: "maya_builds", role: "student", xp: 245, isYou: true, completed: 10, depts: strip([7, 3])),
                TeamMember(username: "kai_cad", role: "student", xp: 410, isYou: false, completed: 17, depts: strip([4, 13])),
                TeamMember(username: "priya_codes", role: "student", xp: 180, isYou: false, completed: 8, depts: strip([8, 0])),
                TeamMember(username: "coach_dlr", role: "mentor", xp: 95, isYou: false, completed: 4, depts: strip([0, 4])),
            ],
            subteamCoverage: [
                SubteamCoverage(slug: department.slug, name: department.name, icon: department.icon, lessonCount: department.lessonCount, teamCompleted: 12, members: [
                    .init(username: "priya_codes", userId: nil, completed: 8),
                    .init(username: "maya_builds", userId: nil, completed: 7),
                    .init(username: "kai_cad", userId: nil, completed: 4),
                ]),
                SubteamCoverage(slug: businessDepartment.slug, name: businessDepartment.name, icon: businessDepartment.icon, lessonCount: businessDepartment.lessonCount, teamCompleted: 13, members: [
                    .init(username: "kai_cad", userId: nil, completed: 13),
                    .init(username: "coach_dlr", userId: nil, completed: 4),
                    .init(username: "maya_builds", userId: nil, completed: 3),
                ]),
                SubteamCoverage(slug: "electrical-wiring", name: "Electrical & Wiring", icon: "Zap", lessonCount: 35, teamCompleted: 0, members: []),
            ],
            inviteURL: URL(string: "https://learnfrc.com/signup?ref=maya_builds&via=team-invite")
        )
    }

    static let weeklyLeaderboard = LeaderboardPayload(board: .weekly, entries: [
        LeaderboardEntry(rank: 1, username: "kai_cad", teamNumber: 9765, role: "student", xp: 168, lessons: 11),
        LeaderboardEntry(rank: 2, username: "torque_tess", teamNumber: 4021, role: "student", xp: 142, lessons: 9),
        LeaderboardEntry(rank: 3, username: "maya_builds", teamNumber: 9765, role: "student", xp: 96, lessons: 7),
        LeaderboardEntry(rank: 4, username: "lumen_mentor", teamNumber: nil, role: "mentor", xp: 71, lessons: 5),
        LeaderboardEntry(rank: 5, username: "priya_codes", teamNumber: 9765, role: "student", xp: 54, lessons: 4),
    ])

    static let teamLeaderboard = LeaderboardPayload(board: .teams, entries: [
        LeaderboardEntry(rank: 1, teamNumber: 4021, xp: 3_920, members: 9),
        LeaderboardEntry(rank: 2, teamNumber: 9765, xp: 930, members: 4),
        LeaderboardEntry(rank: 3, teamNumber: 7312, xp: 615, members: 3),
    ])

    static let publicProfile = PublicProfile(
        username: "kai_cad",
        teamNumber: 9765,
        bio: "CAD and business. I make the sponsor deck look good.",
        role: "student",
        xp: 410,
        createdAt: FlexibleDate.parse("2026-07-30T15:00:00Z"),
        lessonCount: 17,
        achievements: [
            PublicAchievement(slug: "first-lesson", name: "First Steps", icon: "CheckCircle2", earnedAt: FlexibleDate.parse("2026-07-30T16:10:00Z")),
            PublicAchievement(slug: "five-lessons", name: "Warmed Up", icon: "Flame", earnedAt: FlexibleDate.parse("2026-08-02T19:40:00Z")),
            PublicAchievement(slug: "ten-lessons", name: "Committed", icon: "Flame", earnedAt: FlexibleDate.parse("2026-08-21T20:05:00Z")),
            PublicAchievement(slug: "first-department", name: "Department Graduate", icon: "GraduationCap", earnedAt: FlexibleDate.parse("2026-09-30T21:15:00Z")),
        ]
    )

    static var widgetSnapshot: WidgetSnapshot { .sample }
}

// MARK: - A wired-up AppModel for previews

extension AppModel {
    /// Signed in, building toward the weekly goal, full preview catalog. No network, no disk.
    static var preview: AppModel { preview() }

    /// - Parameters:
    ///   - signedIn: false gives a guest with on-device progress.
    ///   - phase: where the weekly rhythm is.
    ///   - me: a different signed-in `Me` (for example `PreviewData.meNeedsUsername` or `.meWithEmailPrompt`).
    ///   - pendingLessonIDs: completions shown as "saved, will sync".
    ///   - online: false previews the offline state.
    static func preview(
        signedIn: Bool = true,
        phase: RhythmPhase = .building,
        me: Me = PreviewData.me,
        pendingLessonIDs: [UUID] = [],
        online: Bool = true
    ) -> AppModel {
        let cache = CacheStore(enabled: false)
        let connectivity = Connectivity(monitoring: false)
        connectivity.setPreviewOnline(online)
        let catalog = CatalogStore(supabase: nil, cache: cache)
        catalog.apply(departments: PreviewData.departments, achievements: PreviewData.achievements)
        catalog.apply(articles: PreviewData.articles)
        catalog.apply(bodies: PreviewData.lessonBodies, complete: true)

        let reference = ReferenceStore(catalog: catalog, api: nil, cache: cache)
        reference.apply(PreviewData.reference)

        let account = AccountStore(supabase: nil, api: nil, cache: cache)
        account.setPreviewState(signedIn ? .signedIn(me) : .guest)

        let progress = ProgressStore(
            catalog: catalog, account: account, connectivity: connectivity,
            api: nil, supabase: nil, cache: cache, writesWidgets: false
        )
        let owner = QueuedAction.Owner.account(me.user.id)
        let queued = signedIn ? pendingLessonIDs.map { QueuedAction(kind: .complete, lessonID: $0, answers: [], owner: owner) } : []
        if signedIn {
            progress.applyPreview(account: PreviewData.progress(phase), userID: me.user.id, queued: queued)
        } else {
            // Guests' strip is computed from the real clock, so anchor their lessons to it.
            let dates = PreviewData.completionDates(for: phase, now: .now)
            let lessons = PreviewData.allLessons
            let guest = dates.enumerated().map { GuestCompletion(lessonID: lessons[$0.offset % lessons.count].lesson.id, completedAt: $0.element) }
            progress.applyPreview(account: nil, userID: nil, guestCompletions: guest)
        }

        return AppModel(catalog: catalog, reference: reference, account: account, progress: progress, connectivity: connectivity)
    }
}
