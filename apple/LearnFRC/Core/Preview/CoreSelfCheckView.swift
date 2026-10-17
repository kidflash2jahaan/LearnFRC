#if DEBUG
import SwiftUI

/// A developer screen that proves the data layer works without a test target:
/// offline checks (the rhythm port against golden results from the site's
/// TypeScript, coding round trips, deep links, the glossary slug port) run on
/// appear; "Run live reads" hits the real public tables and the website.
///
/// Wire it into a debug menu with `CoreSelfCheckView()`.
struct CoreSelfCheckView: View {
    struct Result: Identifiable {
        let id = UUID()
        let name: String
        let passed: Bool
        let detail: String
    }

    @State private var offline: [Result] = CoreSelfCheckView.runOffline()
    @State private var live: [Result] = []
    @State private var isRunningLive = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                section("On device", results: offline, footer: summary(offline))

                VStack(alignment: .leading, spacing: 12) {
                    Button {
                        Task { await runLive() }
                    } label: {
                        Label(isRunningLive ? "Reading from LearnFRC..." : "Run live reads", systemImage: "arrow.down.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isRunningLive)
                    section(
                        "Live (read only)",
                        results: live,
                        footer: live.isEmpty
                            ? "Reads the catalog, every lesson body, articles, badges and /api/app/reference. Nothing is written."
                            : summary(live)
                    )
                }
            }
            .padding(16)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Data self-check")
    }

    private func section(_ title: String, results: [Result], footer: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(results) { result in
                    row(result)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 12)
                    if result.id != results.last?.id { Divider().padding(.leading, 40) }
                }
            }
            .background(.background.secondary, in: .rect(cornerRadius: 12))
            Text(footer)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private func row(_ result: Result) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: result.passed ? "checkmark.circle" : "xmark.octagon")
                .foregroundStyle(result.passed ? Color.primary : Color.red)
                .frame(width: 18)
                .accessibilityLabel(result.passed ? "Passed" : "Failed")
            VStack(alignment: .leading, spacing: 2) {
                Text(result.name)
                Text(result.detail)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private func summary(_ results: [Result]) -> String {
        let failed = results.filter { !$0.passed }.count
        return failed == 0 ? "\(results.count) checks passed." : "\(failed) of \(results.count) checks failed."
    }

    // MARK: Offline

    /// Golden cases: inputs and outputs of `computeRhythm` in src/lib/streaks.ts.
    struct Golden {
        let completedAt: [String]
        let createdAt: String?
        let nowMS: Double
        let tz: Int
        let phase: RhythmPhase
        let windowStartKey: String
        let windowCount: Int
        let currentStreak: Int
        let bestStreak: Int
        let bestWindow: Int
        let pct: Int
    }

    static let goldens: [Golden] = [
        Golden(completedAt: [], createdAt: nil, nowMS: 1764437940000, tz: -240, phase: .new, windowStartKey: "2025-11-24", windowCount: 0, currentStreak: 0, bestStreak: 0, bestWindow: 0, pct: 0),
        Golden(completedAt: ["2026-04-26T14:52:00.146413+00:00", "2026-04-20T22:04:00.258607+00:00", "2026-04-23T19:01:00.781177+00:00", "2026-04-21T16:37:00.588637+00:00"], createdAt: nil, nowMS: 1777280160000, tz: 330, phase: .resting, windowStartKey: "2026-04-27", windowCount: 0, currentStreak: 1, bestStreak: 1, bestWindow: 4, pct: 0),
        Golden(completedAt: ["2026-10-22T04:07:00.400156+00:00", "2026-11-03T01:17:00.624834+00:00", "2026-11-05T05:05:00.490785+00:00", "2026-11-04T08:37:00.554816+00:00", "2026-10-22T05:35:00.263626+00:00"], createdAt: "2026-11-04T23:18:00.580099+00:00", nowMS: 1794212520000, tz: 0, phase: .building, windowStartKey: "2026-11-04", windowCount: 2, currentStreak: 0, bestStreak: 3, bestWindow: 3, pct: 40),
        Golden(completedAt: ["2026-02-09T23:31:00.000Z", "2026-02-09T23:29:00.000Z", "2026-01-15T14:04:00.000Z", "2026-02-10T15:41:00.000Z", "2026-02-10T00:18:00.000Z", "2026-02-12T08:40:00.000Z"], createdAt: nil, nowMS: 1770912180000, tz: 600, phase: .goalMet, windowStartKey: "2026-02-09", windowCount: 5, currentStreak: 3, bestStreak: 3, bestWindow: 5, pct: 100),
        Golden(completedAt: ["2025-10-25T12:47:00.000Z", "2025-10-24T12:36:00.000Z", "2025-10-27T01:46:00.000Z", "2025-10-31T00:28:00.000Z", "2025-11-01T15:15:00.000Z"], createdAt: "2025-07-04T16:45:00.000Z", nowMS: 1762015500000, tz: -240, phase: .building, windowStartKey: "2025-10-27", windowCount: 2, currentStreak: 1, bestStreak: 3, bestWindow: 4, pct: 40),
        Golden(completedAt: ["2025-11-26T22:31:00.000Z", "2025-11-26T20:21:00.000Z", "2025-10-18T02:23:00.000Z", "2025-11-08T00:52:00.000Z", "2025-11-26T09:48:00.000Z", "2025-11-27T05:02:00.000Z", "2025-11-26T13:50:00.000Z", "2025-11-26T21:18:00.000Z"], createdAt: "2025-11-23T11:59:00.000Z", nowMS: 1764234540000, tz: 0, phase: .goalMet, windowStartKey: "2025-11-23", windowCount: 6, currentStreak: 2, bestStreak: 2, bestWindow: 6, pct: 100),
        Golden(completedAt: ["2026-08-27T18:01:00.994115+00:00"], createdAt: "2026-08-24T19:29:00.200337+00:00", nowMS: 1788107580000, tz: 0, phase: .firstLesson, windowStartKey: "2026-08-24", windowCount: 1, currentStreak: 0, bestStreak: 1, bestWindow: 1, pct: 20),
        Golden(completedAt: ["2025-10-15T18:43:00.000Z", "2025-10-12T12:27:00.000Z"], createdAt: nil, nowMS: 1760665920000, tz: 330, phase: .returning, windowStartKey: "2025-10-13", windowCount: 1, currentStreak: 1, bestStreak: 1, bestWindow: 2, pct: 20),
        Golden(completedAt: ["2026-07-09T12:43:00.000Z", "2026-06-24T18:47:00.000Z"], createdAt: "2026-07-29T18:06:00.000Z", nowMS: 1785287160000, tz: 0, phase: .resting, windowStartKey: "2026-07-27", windowCount: 0, currentStreak: 0, bestStreak: 1, bestWindow: 1, pct: 0),
    ]

    static func runOffline() -> [Result] {
        var results: [Result] = []
        func add(_ name: String, _ passed: Bool, _ detail: String) { results.append(Result(name: name, passed: passed, detail: detail)) }

        // Rhythm port vs the site's TypeScript.
        var rhythmFailures: [String] = []
        for (index, golden) in goldens.enumerated() {
            let r = RhythmCalculator.compute(
                completedAt: golden.completedAt.map { FlexibleDate.parse($0) },
                createdAt: golden.createdAt.flatMap { FlexibleDate.parse($0) },
                now: Date(timeIntervalSince1970: golden.nowMS / 1000),
                tzOffsetMinutes: golden.tz
            )
            let ok = r.phase == golden.phase && r.windowStartKey == golden.windowStartKey && r.windowCount == golden.windowCount
                && r.currentStreak == golden.currentStreak && r.bestStreak == golden.bestStreak
                && r.bestWindow == golden.bestWindow && r.pct == golden.pct && r.days.count == 7
            if !ok { rhythmFailures.append("#\(index) got \(r.phase.rawValue) \(r.windowStartKey) \(r.windowCount)") }
        }
        add("Rhythm matches streaks.ts", rhythmFailures.isEmpty, rhythmFailures.isEmpty ? "\(goldens.count) golden cases, all six phases, 4 timezones" : rhythmFailures.joined(separator: "; "))

        let allCopy = RhythmPhase.allCases.map { RhythmCalculator.describe(PreviewData.rhythm($0)) }
        let copyText = allCopy.map { "\($0.eyebrow) \($0.headline) \($0.body) \($0.cta)" }.joined(separator: " ")
        let banned = ["\u{2014}", "don't lose", "expire", "last chance", "streak at risk"]
        let hits = banned.filter { copyText.localizedCaseInsensitiveContains($0) }
        add("Guest copy has no em dashes or threat words", hits.isEmpty, hits.isEmpty ? "checked \(allCopy.count) phases" : "found: \(hits)")

        // Coding round trips (what the cache relies on).
        func roundTrip<T: Codable & Equatable>(_ value: T, _ label: String) {
            do {
                let data = try JSONCoding.encoder().encode(value)
                let back = try JSONCoding.decoder().decode(T.self, from: data)
                add("Cache round trip: \(label)", back == value, "\(data.count) bytes")
            } catch {
                add("Cache round trip: \(label)", false, JSONCoding.describe(error))
            }
        }
        roundTrip(PreviewData.departments, "departments")
        roundTrip(PreviewData.lessonBodies, "lesson bodies")
        roundTrip(PreviewData.articles, "articles")
        roundTrip(PreviewData.achievements, "achievements")
        roundTrip(PreviewData.reference, "reference")
        roundTrip(PreviewData.me, "me")
        roundTrip(PreviewData.progress(.goalMet), "progress")
        roundTrip(PreviewData.team, "team")

        // A /me payload in the route's camelCase shape.
        let meJSON = """
        {"user":{"id":"6f1c2a9e-4b7d-4e2a-9c51-2d8e0f3a7b14","email":"maya@example.com"},
         "profile":{"id":"6f1c2a9e-4b7d-4e2a-9c51-2d8e0f3a7b14","username":"maya_builds","fullName":null,"avatarUrl":null,
           "teamNumber":9765,"bio":null,"role":"mentor","xp":245,"level":3,"tier":"Contender","createdAt":"2026-08-20T18:04:11.000Z",
           "emailOptIn":false,"emailChoiceAt":null},
         "needsUsernameSetup":false,"isPlaceholderUsername":false,"emailPrompt":true,"referralCount":2}
        """
        do {
            let me = try JSONCoding.decoder().decode(Me.self, from: Data(meJSON.utf8))
            add("Decodes /api/app/me", me.profile.level == 3 && me.emailPrompt && me.profile.roleKind == .mentor, "\(me.profile.handle ?? "-"), level \(me.profile.level)")
        } catch {
            add("Decodes /api/app/me", false, JSONCoding.describe(error))
        }

        // Deep links.
        let routes: [AppRoute] = [
            .department(PreviewData.department.id), .module(PreviewData.module.id), .lesson(PreviewData.lesson.id),
            .article("frc-brownout"), .glossaryTerm("wpilib"), .path("game-day-ready"), .profile("kai_cad"),
            .team, .leaderboard, .settings, .certificate(PreviewData.department.id), .videos, .achievements,
            .bookmarks, .tools, .tool("frc-gear-ratio-calculator"), .resources,
            .admin, .adminFeedback, .adminTeam, .apply,
        ]
        let broken = routes.filter { AppRoute(deepLink: $0.deepLinkURL) != $0 }
        add("Deep links round trip", broken.isEmpty, broken.isEmpty ? "\(routes.count) routes, e.g. \(routes[2].deepLinkURL.absoluteString)" : "\(broken)")

        // Glossary slug port (glossarySlug in glossary-data.ts).
        let slugCases = ["Command-Based Programming": "command-based-programming", "PID Controller": "pid-controller",
                         "roboRIO": "roborio", "Gracious Professionalism®": "gracious-professionalism", "CAN Bus (Controller Area Network)": "can-bus-controller-area-network"]
        let badSlugs = slugCases.filter { GlossaryTerm.slug(for: $0.key) != $0.value }
        add("Glossary slugs match the site", badSlugs.isEmpty, badSlugs.isEmpty ? "\(slugCases.count) cases" : "\(badSlugs.keys.sorted())")

        // Site ordering and XP rules.
        let flags = PreviewData.department.modules.map(\.isPrerequisite)
        add("Modules prerequisite-first", flags.first == true && flags.dropFirst().allSatisfy { !$0 }, PreviewData.department.modules.map(\.slug).joined(separator: ", "))
        add("Levels and tiers", XPRules.level(forXP: 0) == 1 && XPRules.level(forXP: 199) == 2 && XPRules.tier(forLevel: 8) == "Veteran" && XPRules.tier(forLevel: 25) == "Champion",
            "245 XP is level \(XPRules.level(forXP: 245)), \(XPRules.xpToNextLevel(245)) to next")
        add("Quiz gate", PreviewData.lessonBody.passes(PreviewData.lessonBody.quiz.map(\.answer)) && !PreviewData.lessonBody.passes([]),
            "\(PreviewData.lessonBody.quiz.count) questions")
        add("App Group container", true, AppGroup.containerURL.map { "available: \($0.lastPathComponent)" } ?? "not available in this build (widgets show sample data)")
        return results
    }

    // MARK: Live

    private func runLive() async {
        isRunningLive = true
        live = []
        defer { isRunningLive = false }
        let supabase = SupabaseService.shared

        func timed<T>(_ name: String, _ work: () async throws -> T, detail: (T) -> String, passed: (T) -> Bool) async {
            let start = Date.now
            do {
                let value = try await work()
                let ms = Int(Date.now.timeIntervalSince(start) * 1000)
                live.append(Result(name: name, passed: passed(value), detail: "\(detail(value)) in \(ms) ms"))
            } catch {
                live.append(Result(name: name, passed: false, detail: APIError.from(error).message))
            }
        }

        await timed("Catalog", { try await supabase.catalog() },
                    detail: { "\($0.count) departments, \($0.reduce(0) { $0 + $1.modules.count }) modules, \($0.reduce(0) { $0 + $1.lessonCount }) lessons" },
                    passed: { $0.count >= 11 })
        await timed("Lesson bodies", { try await supabase.lessonBodies() },
                    detail: { "\($0.count) lessons, \($0.reduce(0) { $0 + $1.quiz.count }) quiz questions" },
                    passed: { !$0.isEmpty && $0.allSatisfy { !$0.quiz.isEmpty } })
        await timed("Articles", { try await supabase.articles() },
                    detail: { "\($0.count) articles, newest \($0.first?.date ?? "-")" },
                    passed: { !$0.isEmpty })
        await timed("Achievements", { try await supabase.achievements() },
                    detail: { $0.map(\.slug).joined(separator: ", ") },
                    passed: { $0.count >= 11 })
        do {
            let start = Date.now
            let reference = try await APIClient.shared.reference()
            live.append(Result(name: "Reference (\(AppConfig.apiBase.host() ?? ""))", passed: !reference.glossary.isEmpty,
                               detail: "\(reference.glossary.count) terms, \(reference.paths.count) paths in \(Int(Date.now.timeIntervalSince(start) * 1000)) ms"))
        } catch {
            // The routes ship separately; report rather than fail.
            live.append(Result(name: "Reference (\(AppConfig.apiBase.host() ?? ""))", passed: true, detail: "not reachable yet: \(APIError.from(error).message)"))
        }
    }
}

#Preview("Self-check, iPhone") {
    NavigationStack {
        CoreSelfCheckView()
    }
}

#Preview("Self-check, iPhone dark") {
    NavigationStack {
        CoreSelfCheckView()
    }
    .preferredColorScheme(.dark)
}

#Preview("Self-check, iPad", traits: .fixedLayout(width: 1024, height: 1366)) {
    NavigationStack {
        CoreSelfCheckView()
    }
}

#Preview("Self-check, iPad dark", traits: .fixedLayout(width: 1366, height: 1024)) {
    NavigationStack {
        CoreSelfCheckView()
    }
    .preferredColorScheme(.dark)
}
#endif
