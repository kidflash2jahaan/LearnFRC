import SwiftUI

/// Each person's progress, department by department (the site's `_member-progress.tsx`).
///
/// One fold per teammate. Closed, it's a name, an overall figure and a strip of small cells,
/// one per department, filled by how much of it they've done, so a coach can scan the whole
/// team for gaps without opening anything. Open, it lists the departments they've started
/// (bar, furthest lesson, next lesson), then the ones they haven't touched in one line.
/// Your own fold starts open.
struct MemberProgressList: View {
    let members: [TeamMember]
    let layout: CommunityLayout

    @State private var open: Set<String>

    init(members: [TeamMember], layout: CommunityLayout) {
        self.members = members
        self.layout = layout
        _open = State(initialValue: Set(members.filter(\.isYou).map(\.id)))
    }

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            ForEach(members) { member in
                MemberProgressFold(
                    member: member,
                    isOpen: Binding(
                        get: { open.contains(member.id) },
                        set: { isOpen in
                            if isOpen { open.insert(member.id) } else { open.remove(member.id) }
                        }
                    ),
                    layout: layout
                )
            }
        }
    }
}

struct MemberProgressFold: View {
    let member: TeamMember
    @Binding var isOpen: Bool
    let layout: CommunityLayout

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var total: Int { member.depts.reduce(0) { $0 + $1.total } }
    private var percent: Int { CommunityFormat.percent(member.completed, of: total) }
    private var started: [MemberDeptProgress] {
        member.depts.filter { $0.completed > 0 }.sorted { $0.fraction > $1.fraction }
    }
    private var untouched: [MemberDeptProgress] { member.depts.filter { $0.completed == 0 } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                Haptics.select()
                if reduceMotion {
                    isOpen.toggle()
                } else {
                    withAnimation(LF.Motion.settle) { isOpen.toggle() }
                }
            } label: {
                header
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(headerAccessibilityLabel)
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(isOpen ? "Hides their departments" : "Shows where they are in each department")
            .accessibilityAddTraits(.isButton)

            if isOpen {
                details
                    .padding(.top, 16)
                    .overlay(alignment: .top) { InkRule() }
                    .padding(.top, 14)
                    .transition(.opacity)
            }
        }
        .padding(layout.isRegular ? 16 : 14)
        .padding(.leading, member.isYou ? 8 : 0)
        .background {
            NotebookBoxBackground(size: .a, shadow: .card)
        }
        .overlay(alignment: .leading) {
            if member.isYou {
                // Your fold is barred in blue down the left, like your row on the roster.
                Rectangle()
                    .fill(LF.Palette.blue)
                    .frame(width: 4)
                    .padding(.vertical, 12)
                    .offset(x: 6)
                    .accessibilityHidden(true)
            }
        }
    }

    // MARK: Header

    private var header: some View {
        Group {
            if layout.isRegular && !dynamicTypeSize.isAccessibilitySize {
                HStack(alignment: .center, spacing: 16) {
                    identity.frame(maxWidth: .infinity, alignment: .leading)
                    cells
                    toggleLabel
                }
            } else {
                // The name, tag and count on one line beside the toggle when they fit whole;
                // otherwise (a long name, the largest text sizes) each on its own line, so
                // nothing is cut short or broken mid-word.
                ViewThatFits(in: .horizontal) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .center, spacing: 12) {
                            identity.fixedSize()
                            Spacer(minLength: 0)
                            toggleLabel
                        }
                        cells
                    }
                    stackedHeader
                }
            }
        }
        .frame(minHeight: LF.Metrics.tap)
        .contentShape(Rectangle())
    }

    private var stackedHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                CommunityAvatar(name: member.username, imageURL: member.avatarURL, isYou: member.isYou, size: 36)
                Spacer(minLength: 8)
                toggleLabel
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(member.username)
                    .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                    .foregroundStyle(LF.Palette.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                if member.isYou { TagView("you", on: true) }
                SlugText(countLine)
                    .fixedSize(horizontal: false, vertical: true)
            }
            cells
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var countLine: String { "\(member.completed) of \(total) lessons, \(percent)%" }

    private var identity: some View {
        HStack(spacing: 12) {
            CommunityAvatar(name: member.username, imageURL: member.avatarURL, isYou: member.isYou, size: 36)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(member.username)
                        .font(LF.Fonts.body(16, weight: .bold, relativeTo: .body))
                        .foregroundStyle(LF.Palette.ink)
                        .lineLimit(1)
                    if member.isYou { TagView("you", on: true) }
                }
                SlugText(countLine)
            }
        }
    }

    /// One small cell per department, filled from the bottom.
    private var cells: some View {
        HStack(spacing: 4) {
            ForEach(member.depts) { dept in
                ZStack(alignment: .bottom) {
                    LF.Palette.paper
                    GeometryReader { proxy in
                        Rectangle()
                            .fill(LF.Palette.blue)
                            .frame(height: proxy.size.height * dept.fraction)
                            .frame(maxHeight: .infinity, alignment: .bottom)
                    }
                }
                .frame(width: 12, height: 24)
                .clipShape(RoundedRectangle(cornerRadius: 3))
                .overlay { RoundedRectangle(cornerRadius: 3).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
                .help("\(dept.name): \(dept.completed) of \(dept.total)")
            }
        }
        .accessibilityHidden(true)
    }

    private var toggleLabel: some View {
        HStack(spacing: 4) {
            SlugText(isOpen ? "close" : "open")
            Image(systemName: "chevron.down")
                .font(.caption2.weight(.bold))
                .foregroundStyle(LF.Palette.graphite)
                .rotationEffect(.degrees(isOpen ? 180 : 0))
        }
        .accessibilityHidden(true)
    }

    private var headerAccessibilityLabel: String {
        let depts = member.depts
            .map { "\($0.name) \(CommunityFormat.percent($0.completed, of: $0.total)) percent" }
            .joined(separator: ", ")
        return "\(member.username)\(member.isYou ? ", you" : ""), \(member.completed) of \(total) lessons, \(percent) percent. By department: \(depts)"
    }

    // MARK: Details

    @ViewBuilder
    private var details: some View {
        VStack(alignment: .leading, spacing: 18) {
            if started.isEmpty {
                Text(member.isYou ? "You haven't finished a lesson yet." : "\(member.username) hasn't finished a lesson yet.")
                    .lfProse(15.5, color: LF.Palette.graphite)
            } else {
                let columns = layout.isFull && !dynamicTypeSize.isAccessibilitySize
                    ? [GridItem(.flexible(), spacing: 28, alignment: .top), GridItem(.flexible(), spacing: 28, alignment: .top)]
                    : [GridItem(.flexible(), alignment: .top)]
                LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                    ForEach(started) { dept in
                        MemberDeptBlock(dept: dept)
                    }
                }
            }
            if !untouched.isEmpty && !started.isEmpty {
                Text("Not started yet: \(untouched.map(\.name).joined(separator: ", "))")
                    .lfProse(14, lineHeight: 1.45, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// One started department inside a fold: the bar, the furthest lesson, and the next one
/// (a link into the lesson when the catalog knows it).
struct MemberDeptBlock: View {
    let dept: MemberDeptProgress

    @Environment(CatalogStore.self) private var catalog

    private var percent: Int { CommunityFormat.percent(dept.completed, of: dept.total) }
    private var figure: String { "\(dept.completed)/\(dept.total), \(percent)%" }

    private var nextRoute: AppRoute? {
        guard let next = dept.next else { return nil }
        if let href = next.href, let route = catalog.route(forPath: href) { return route }
        // No link sent: find the lesson by its title inside that department.
        guard let department = catalog.department(slug: dept.slug) else { return nil }
        return catalog.lessons(in: department).first { $0.lesson.title == next.title }.map { .lesson($0.lesson.id) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // The department's name and figure on one line when both fit whole; the figure
            // under the name otherwise, so the name is never cut to "Progr…".
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    SlugText(dept.name, color: LF.Palette.ink, weight: .bold)
                        .fixedSize()
                    Spacer(minLength: 4)
                    SlugText(figure)
                        .fixedSize()
                }
                VStack(alignment: .leading, spacing: 2) {
                    SlugText(dept.name, color: LF.Palette.ink, weight: .bold)
                        .fixedSize(horizontal: false, vertical: true)
                    SlugText(figure)
                }
            }
            CommunityBar(value: Double(percent) / 100)
            if let furthest = dept.furthest {
                Text("Furthest: \(furthest.moduleTitle.map { "\($0), " } ?? "")\u{201C}\(furthest.title)\u{201D}")
                    .lfProse(14, lineHeight: 1.4, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let next = dept.next {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("Next:")
                        .lfProse(14, lineHeight: 1.4)
                    if let route = nextRoute {
                        NavigationLink(value: route) {
                            Text(next.title)
                                .font(LF.Fonts.body(14, weight: .semibold))
                                .foregroundStyle(LF.Palette.blue)
                                .underline(color: LF.Palette.blue.opacity(0.5))
                                .multilineTextAlignment(.leading)
                                .frame(minHeight: LF.Metrics.tap, alignment: .leading)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Next lesson: \(next.title)")
                    } else {
                        Text(next.title)
                            .lfProse(14, lineHeight: 1.4)
                    }
                }
            } else {
                Text("Department finished")
                    .font(LF.Fonts.body(14, weight: .bold))
                    .foregroundStyle(LF.Palette.ink)
            }
        }
        .accessibilityElement(children: .contain)
    }
}

#Preview("Progress folds, iPhone", traits: .fixedLayout(width: 393, height: 900)) {
    CommunityPreviewHost {
        ScrollView {
            MemberProgressList(members: PreviewData.team.members, layout: CommunityLayout(width: 393))
                .padding(16)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .light)
}

#Preview("Progress folds, iPad, dark", traits: .fixedLayout(width: 1024, height: 800)) {
    CommunityPreviewHost {
        ScrollView {
            MemberProgressList(members: PreviewData.team.members, layout: CommunityLayout(width: 1024))
                .padding(32)
        }
        .paperBackground()
    }
    .environment(\.colorScheme, .dark)
}
