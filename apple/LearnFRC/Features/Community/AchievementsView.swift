import SwiftUI

/// Every badge and every certificate, in one binder section.
///
/// Badge state is marked twice, never by colour alone: an earned badge has a solid ink edge
/// and prints the date; a locked one has a dashed rule edge and prints how far there is to go
/// (lesson and department badges) or "locked". Streak badges never show a countdown: a streak
/// can go down, and "2 more days" turns a missed Tuesday into a loss.
struct AchievementsView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var app
    @Environment(\.dynamicTypeSize) private var typeSize

    private var badges: [Achievement] { catalog.achievements.sorted { $0.sortOrder < $1.sortOrder } }
    private var earnedCount: Int { badges.filter { progress.isEarned($0) }.count }

    var body: some View {
        CommunityPage(refresh: { await app.refreshAll() }, place: .route(.achievements)) { layout, _ in
            VStack(alignment: .leading, spacing: 0) {
                masthead(layout)
                    .padding(.top, layout.isWide ? 36 : 18)

                if account.isGuest {
                    NoteCallout {
                        SlugText("badges / need an account")
                        Text("Badges are kept on an account. The lessons you finish on this device still count toward them, and they move into your account when you sign in.")
                            .lfProse(16, lineHeight: 1.45)
                            .fixedSize(horizontal: false, vertical: true)
                        Button("Sign in or make an account") { app.selectedTab = .profile }
                            .buttonStyle(.inkGhostSmall)
                            .padding(.top, 6)
                    }
                    .frame(maxWidth: 740, alignment: .leading)
                    .padding(.top, 28)
                }

                if let next = progress.nextUnlock {
                    AchievementsNextUnlockCard(next: next)
                        .frame(maxWidth: 560, alignment: .leading)
                        .padding(.top, 32)
                }

                badgeGrid(layout)
                    .padding(.top, 36)

                certificates(layout)
                    .padding(.top, layout.sectionGap)
            }
            .communityColumn(layout)
        }
        .communityNavigationTitle("Badges")
    }

    // MARK: Masthead

    private func masthead(_ layout: CommunityLayout) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("badges / signed off by a quiz")
            CommunitySectionHeader(
                "Badges",
                sub: account.isGuest
                    ? "Each one is signed off by finishing lessons and passing their quizzes. Here's every badge and what it asks for."
                    : "Each one is signed off by finishing lessons and passing their quizzes, not by time spent on the page. Here's every badge, what it asks for, and how far you are.",
                level: .h1
            ) {
                if !badges.isEmpty {
                    CountText("\(earnedCount)", unit: "of \(badges.count) earned", size: 28)
                        .accessibilityLabel("\(earnedCount) of \(badges.count) badges earned")
                }
            }
        }
    }

    // MARK: Badges

    @ViewBuilder
    private func badgeGrid(_ layout: CommunityLayout) -> some View {
        if badges.isEmpty {
            if catalog.isLoaded {
                CommunityEmptyNote("badges / none yet", "The badge list hasn't loaded. \(CommunityCopy.refreshHint) when you're online.")
            } else {
                LazyVGrid(columns: columns(layout), spacing: 14) {
                    ForEach(0..<6, id: \.self) { _ in SkeletonBlock(height: 140) }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Loading badges")
            }
        } else {
            LazyVGrid(columns: columns(layout), alignment: .leading, spacing: 14) {
                ForEach(badges) { badge in
                    CommunityBadgeCard(
                        achievement: badge,
                        earnedAt: progress.earnedDate(badge),
                        isEarned: progress.isEarned(badge),
                        progress: progress.progress(toward: badge)
                    )
                }
            }
        }
    }

    /// Two or more across; one per row on a phone at the accessibility sizes, where half
    /// the width breaks a badge's name mid-word.
    private func columns(_ layout: CommunityLayout) -> [GridItem] {
        if typeSize.isAccessibilitySize && !layout.isRegular {
            return [GridItem(.flexible(), spacing: 14, alignment: .top)]
        }
        return [GridItem(.adaptive(minimum: layout.isRegular ? 236 : 160, maximum: 360), spacing: 14, alignment: .top)]
    }

    // MARK: Certificates

    private struct DepartmentCount: Identifiable {
        let department: Department
        let done: Int
        let total: Int
        var id: UUID { department.id }
        var fraction: Double { total > 0 ? Double(done) / Double(total) : 0 }
        var isSignedOff: Bool { total > 0 && done >= total }
    }

    private func certificates(_ layout: CommunityLayout) -> some View {
        let departments = catalog.departments
            .filter { $0.lessonCount > 0 }
            .map { department -> DepartmentCount in
                let counts = progress.departmentProgress(department)
                return DepartmentCount(department: department, done: counts.done, total: counts.total)
            }
            .sorted { a, b in
                if a.fraction != b.fraction { return a.fraction > b.fraction }
                return a.department.sortOrder < b.department.sortOrder
            }
        let signedOff = departments.filter(\.isSignedOff).count
        return VStack(alignment: .leading, spacing: 22) {
            CommunitySectionHeader("Certificates", sub: "One per department, not per lesson. Finish every lesson in a department and its certificate carries your name.") {
                if !departments.isEmpty {
                    CountText("\(signedOff)", unit: "of \(departments.count) signed off", size: 22)
                }
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: layout.isRegular ? 260 : 300, maximum: 420), spacing: 14, alignment: .top)], alignment: .leading, spacing: 14) {
                ForEach(departments) { item in
                    NavigationLink(value: AppRoute.certificate(item.department.id)) {
                        CommunityCertificateTile(
                            department: item.department, done: item.done, total: item.total,
                            finishedAt: item.isSignedOff ? progress.completionDate(of: item.department) : nil
                        )
                    }
                    .buttonStyle(.notebookCard)
                }
            }
        }
    }
}

// MARK: - A badge

struct CommunityBadgeCard: View {
    let achievement: Achievement
    var earnedAt: Date?
    var isEarned: Bool
    var progress: BadgeProgress?

    /// The icon box grows with the text beside it.
    @ScaledMetric(relativeTo: .subheadline) private var iconBox: CGFloat = 30
    @Environment(\.dynamicTypeSize) private var typeSize

    /// Only for a locked badge that's actually started, and never for a streak.
    private var meter: BadgeProgress? {
        guard !isEarned, achievement.criteria.kind != .streak, let progress,
              progress.target > 0, progress.current > 0 else { return nil }
        return progress
    }

    private var status: String {
        if isEarned { return earnedAt.map { "earned \(CommunityFormat.shortDate($0))" } ?? "earned" }
        if let meter {
            let unit = meter.remaining == 1 && meter.unit.hasSuffix("s") ? String(meter.unit.dropLast()) : meter.unit
            return "\(meter.remaining) more \(unit)"
        }
        return "locked"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 10) {
                Image(systemName: achievement.systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(isEarned ? LF.Palette.blue : LF.Palette.graphite)
                    .frame(width: iconBox, height: iconBox)
                    .background {
                        if isEarned {
                            HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke)
                        } else {
                            HandShape(.s).strokeBorder(LF.Palette.rule, style: StrokeStyle(lineWidth: LF.Metrics.stroke, dash: [4, 3]))
                        }
                    }
                    .accessibilityHidden(true)
                SlugText(status, color: isEarned ? LF.Palette.ink : LF.Palette.graphite)
                    .lineLimit(typeSize.isAccessibilitySize ? nil : 2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text(achievement.name)
                .font(LF.Fonts.display(18, relativeTo: .headline))
                .tracking(-0.4)
                .foregroundStyle(isEarned ? LF.Palette.ink : LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
            Text(achievement.description)
                .lfProse(14, lineHeight: 1.4, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 5)
            if let meter {
                Spacer(minLength: 12)
                HStack(alignment: .firstTextBaseline) {
                    SlugText("progress")
                    Spacer()
                    SlugText("\(meter.current)/\(meter.target)", color: LF.Palette.ink, weight: .bold)
                }
                CommunityBar(value: max(0.04, meter.fraction))
                    .padding(.top, 6)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background {
            if isEarned {
                NotebookBoxBackground(size: .s, shadow: .card)
            } else {
                NotebookBoxBackground(size: .s, shadow: .none, border: LF.Palette.rule, dashed: true)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        var parts = [achievement.name]
        if isEarned {
            parts.append(earnedAt.map { "earned \($0.formatted(date: .long, time: .omitted))" } ?? "earned")
        } else if let meter {
            parts.append("locked, \(meter.current) of \(meter.target), \(status)")
        } else {
            parts.append("locked")
        }
        parts.append(achievement.description)
        return parts.joined(separator: ". ")
    }
}

/// The nearest lesson-count badge, as the server picked it (never a streak badge).
struct AchievementsNextUnlockCard: View {
    let next: NextUnlock

    var body: some View {
        NotebookCard(tilt: .preset(1), tape: true, padding: 20) {
            SlugText("next up / \(next.progress.remaining) more \(next.progress.remaining == 1 && next.progress.unit.hasSuffix("s") ? String(next.progress.unit.dropLast()) : next.progress.unit)")
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: next.systemImage)
                    .foregroundStyle(LF.Palette.blue)
                    .accessibilityHidden(true)
                Text(next.name)
                    .lfTitle(.h3)
            }
            .padding(.top, 10)
            Text(next.description)
                .lfProse(15, lineHeight: 1.45, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
            MeterView(value: next.progress.fraction, label: "progress", valueText: "\(next.progress.current)/\(next.progress.target)")
                .padding(.top, 14)
        }
        .accessibilityElement(children: .combine)
    }
}

/// One department's certificate in the gallery: signed off with the date, or how far along.
struct CommunityCertificateTile: View {
    let department: Department
    let done: Int
    let total: Int
    var finishedAt: Date?

    @Environment(\.dynamicTypeSize) private var typeSize

    private var isSignedOff: Bool { total > 0 && done >= total }

    var body: some View {
        NotebookCard(lift: true, padding: 16) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    SlugText("dept / \(department.slug)")
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(department.name)
                        .font(LF.Fonts.display(17, relativeTo: .headline))
                        .tracking(-0.4)
                        .foregroundStyle(LF.Palette.ink)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if isSignedOff {
                    Image(systemName: "checkmark.seal")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(LF.Palette.blue)
                        .communityTilt(-4.5)
                        .accessibilityHidden(true)
                }
            }
            if isSignedOff {
                SlugText(finishedAt.map { "signed off \(CommunityFormat.shortDate($0))" } ?? "signed off", color: LF.Palette.ink, weight: .bold)
                    .padding(.top, 12)
            } else {
                MeterView(value: total > 0 ? Double(done) / Double(total) : 0, label: done == 0 ? "not started" : "lessons", valueText: "\(done)/\(total)", style: .slim)
                    .padding(.top, 12)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(isSignedOff
            ? "\(department.name) certificate, signed off"
            : "\(department.name) certificate, \(done) of \(total) lessons finished")
        .accessibilityHint("Opens the certificate")
    }
}

// MARK: - Previews

#Preview("Badges, iPhone", traits: .fixedLayout(width: 393, height: 1500)) {
    CommunityPreviewHost(model: .preview(phase: .goalMet)) { AchievementsView() }
    .environment(\.colorScheme, .light)
}

#Preview("Badges, iPhone, dark, guest", traits: .fixedLayout(width: 393, height: 852)) {
    CommunityPreviewHost(model: .preview(signedIn: false)) { AchievementsView() }
        .environment(\.colorScheme, .dark)
}

#Preview("Badges, iPad", traits: .fixedLayout(width: 1180, height: 1300)) {
    CommunityPreviewHost(model: .preview(phase: .building)) { AchievementsView() }
    .environment(\.colorScheme, .light)
}

#Preview("Badges, iPad, dark", traits: .fixedLayout(width: 834, height: 1300)) {
    CommunityPreviewHost(model: .preview(phase: .goalMet)) { AchievementsView() }
        .environment(\.colorScheme, .dark)
}
