import SwiftUI

/// One learning path, opened (learnfrc.com/paths/{slug}).
///
/// It does one job: show the order, and get the reader into stop one. A masthead that
/// names the route and prints its extent, the itinerary as a log with the reader's
/// progress in each stop, the payoff on the one blue band, and the way in. For someone
/// already partway along, the next unfinished lesson on the route is named up top.
struct PathView: View {
    let slug: String

    @Environment(ReferenceStore.self) private var reference
    @Environment(CatalogStore.self) private var catalog
    @Environment(ProgressStore.self) private var progress
    @Environment(AccountStore.self) private var account
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(slug: String) {
        self.slug = slug
    }

    var body: some View {
        if let path = reference.path(slug: slug) {
            content(path)
        } else {
            LearnScrollPage(title: "Route", refresh: { await model.refreshAll() }, place: .route(.path(slug))) { layout, _ in
                Group {
                    if !reference.isLoaded && reference.lastError == nil {
                        LearnLoadingBlock(rows: 2)
                    } else {
                        LearnNotice(kicker: "routes / \(slug)",
                                    message: "This route isn't on this device. It may have been renamed on learnfrc.com.") {
                            Link(destination: AppConfig.webBase.appending(path: "paths")) {
                                LearnLinkLabel(title: "See the routes on learnfrc.com", systemImage: "arrow.up.right")
                            }
                        }
                    }
                }
                .learnColumn(layout)
                .padding(.top, 24)
            }
        }
    }

    // MARK: Content

    private func content(_ path: LearningPath) -> some View {
        let stops = reference.departments(in: path)
        let uniqueDepartments = stops.reduce(into: [Department]()) { list, stop in
            if !list.contains(where: { $0.id == stop.department.id }) { list.append(stop.department) }
        }
        let minutes = uniqueDepartments.reduce(0) { $0 + $1.totalMinutes }
        let hours = max(1, Int((Double(minutes) / 60).rounded(.up)))
        let number = (reference.paths.firstIndex { $0.slug == path.slug } ?? 0) + 1
        let tracked = account.isSignedIn || progress.completedTotal > 0
        let routeLessons = uniqueDepartments.flatMap { catalog.lessons(in: $0) }
        let started = routeLessons.contains { progress.isCompleted($0.id) }
        let next = routeLessons.first { !progress.isCompleted($0.id) }

        let figures: [(label: String, value: String, unit: String?)] = [
            ("stops", path.steps.count.formatted(), nil),
            ("departments", uniqueDepartments.count.formatted(), nil),
            ("skills at the end", path.outcomes.count.formatted(), nil),
            ("hours of reading", hours.formatted(), nil),
        ]

        return LearnScrollPage(title: path.title, refresh: { await model.refreshAll() }, place: .route(.path(slug))) { layout, proxy in
            if let pages = layout.pages {
                // iPhone Duo's inner screen held upright: the route and the way in on the
                // leading page, its figures and the order to read it in on the trailing page.
                let leading = LearnLayout.page(pages.leading)
                let trailing = LearnLayout.page(pages.trailing)
                LearnSpread(pages: pages) {
                    VStack(alignment: .leading, spacing: 0) {
                        masthead(path, number: number, stops: stops, layout: leading, proxy: proxy,
                                 resume: started ? next : nil)
                        if let first = stops.first {
                            wayIn(path, first: first, last: stops.last ?? first, layout: leading)
                                .padding(.top, 48)
                        }
                    }
                } trailing: {
                    VStack(alignment: .leading, spacing: 0) {
                        LearnFigureRule(figures: figures, layout: trailing)
                        itinerary(path, stops: stops, tracked: tracked, layout: trailing)
                            .padding(.top, 40)
                    }
                }
                .learnColumn(layout, spread: true)
                .padding(.top, 20)

                if !path.outcomes.isEmpty {
                    outcomes(path, layout: layout)
                        .learnBand()
                        .padding(.top, 52)
                        .id(LearnAnchor.outcomes)
                }
            } else {
                masthead(path, number: number, stops: stops, layout: layout, proxy: proxy,
                         resume: started ? next : nil)
                    .learnColumn(layout)
                    .padding(.top, 20)

                LearnFigureRule(figures: figures, layout: layout)
                    .learnColumn(layout)
                    .padding(.top, 30)

                itinerary(path, stops: stops, tracked: tracked, layout: layout)
                    .learnColumn(layout)
                    .padding(.top, 48)

                if !path.outcomes.isEmpty {
                    outcomes(path, layout: layout)
                        .learnBand()
                        .padding(.top, 52)
                        .id(LearnAnchor.outcomes)
                }

                if let first = stops.first {
                    wayIn(path, first: first, last: stops.last ?? first, layout: layout)
                        .learnColumn(layout)
                        .padding(.top, 52)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: path.webURL, subject: Text(path.title), message: Text(path.description)) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .learnHandoff(path.webURL, place: .route(.path(slug)))
    }

    // MARK: Masthead

    private func masthead(_ path: LearningPath, number: Int, stops: [(step: LearningPath.Step, department: Department)],
                          layout: LearnLayout, proxy: ScrollViewProxy, resume: LessonLocation?) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("route \(LearnFormat.ordinal(number)) / \(path.slug)")
            Text(path.title)
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 600, alignment: .leading)
                .padding(.top, 14)
            LearnLede(path.description)
                .padding(.top, 16)

            let buttons = Group {
                if let first = stops.first {
                    NavigationLink(value: AppRoute.department(first.department.id)) {
                        Text("Start at stop 01")
                    }
                    .buttonStyle(.ink)
                }
                if !path.outcomes.isEmpty {
                    Button("What you leave with") {
                        LF.Motion.perform(LF.Motion.settle) {
                            proxy.scrollTo(LearnAnchor.outcomes, anchor: .top)
                        }
                    }
                    .buttonStyle(.inkGhost)
                }
            }
            // Side by side when both fit; stacked rather than squeezed into two lines each.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { buttons }
                VStack(alignment: .leading, spacing: 12) { buttons }
            }
            .padding(.top, 22)

            if let resume {
                LearnResumeBar(location: resume, kicker: "next on this route", action: "Resume")
                    .frame(maxWidth: 640, alignment: .leading)
                    .padding(.top, 24)
            }
        }
    }

    // MARK: Itinerary

    private func itinerary(_ path: LearningPath, stops: [(step: LearningPath.Step, department: Department)],
                           tracked: Bool, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom, spacing: 28) {
                LearnSectionHeader(
                    title: "The order to read it in.",
                    sub: "Every stop is a department guide you can also reach on its own. Work down the list. Nothing here is locked and nothing needs an account to read."
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                if layout.isRegular {
                    MarkerText("skip a stop you already do all season", angle: -1.1)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 200, alignment: .trailing)
                }
            }
            if !layout.isRegular {
                MarkerText("skip a stop you already do all season", angle: -1.1)
                    .padding(.top, 12)
            }

            VStack(spacing: 0) {
                InkRule()
                ForEach(Array(path.steps.enumerated()), id: \.offset) { index, step in
                    let department = catalog.department(slug: step.deptSlug)
                    stopRow(index: index, step: step, department: department, tracked: tracked, layout: layout)
                }
            }
            .padding(.top, 26)

            if let first = path.steps.first, let last = path.steps.last {
                SlugText("end of route / starts in \(name(of: first)) / ends in \(name(of: last))")
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
            }
        }
    }

    private func name(of step: LearningPath.Step) -> String {
        catalog.department(slug: step.deptSlug)?.name ?? step.label
    }

    @ViewBuilder
    private func stopRow(index: Int, step: LearningPath.Step, department: Department?, tracked: Bool, layout: LearnLayout) -> some View {
        let row = LearnLogRow(layout: layout, trailing: department == nil ? nil : "open the guide") {
            VStack(alignment: .leading, spacing: 4) {
                CountText(LearnFormat.ordinal(index + 1), unit: "stop")
                Text(department?.name ?? step.label)
                    .font(LF.Fonts.body(15, weight: .semibold))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
                SlugText("dept / \(step.deptSlug)")
            }
        } main: {
            VStack(alignment: .leading, spacing: 10) {
                LearnRowText(title: step.label, summary: step.note)
                if tracked, let department {
                    let counts = progress.departmentProgress(department)
                    MeterView(value: counts.total > 0 ? Double(counts.done) / Double(counts.total) : 0,
                              label: "your progress here",
                              valueText: "\(counts.done)/\(counts.total)",
                              style: .slim)
                        .frame(maxWidth: 320)
                }
            }
        }

        if let department {
            NavigationLink(value: AppRoute.department(department.id)) { row }
                .buttonStyle(.inkRow)
                .accessibilityLabel("Stop \(index + 1), \(step.label), in \(department.name)")
                .accessibilityHint(step.note)
        } else {
            row
                .accessibilityElement(children: .combine)
        }
    }

    // MARK: Payoff

    private func outcomes(_ path: LearningPath, layout: LearnLayout) -> some View {
        SlabView {
            let lead = VStack(alignment: .leading, spacing: 0) {
                Text("What you can do at the end.")
                    .font(LF.Fonts.display(30, relativeTo: .title))
                    .tracking(-0.75)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text("Not topics covered. These are the jobs you can be handed on a real team once the route is behind you.")
                    .font(LF.Fonts.body(15.5))
                    .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 340, alignment: .leading)
                    .padding(.top, 12)
                // As wide as its label while that fits on a line; at the largest text sizes
                // the label wraps to the column instead of widening the whole page.
                ViewThatFits(in: .horizontal) {
                    LearnSlabFigure(value: path.outcomes.count.formatted(), label: "skills, signed off by quiz")
                        .fixedSize()
                    LearnSlabFigure(value: path.outcomes.count.formatted(), label: "skills, signed off by quiz")
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 26)
            }
            let list = VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(path.outcomes.enumerated()), id: \.offset) { index, outcome in
                    if index > 0 {
                        DashedRule(color: LF.Palette.onBlue.opacity(0.4))
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 16) {
                        // 0.85, like the band's other secondary text: 5.1:1 on the dark
                        // mode blue (0.75 was 4.3:1).
                        Text(LearnFormat.ordinal(index + 1))
                            .font(LF.Fonts.mono(12.5, weight: .bold, relativeTo: .caption))
                            .foregroundStyle(LF.Palette.onBlue.opacity(0.85))
                        Text(outcome)
                            .font(LF.Fonts.body(16.5))
                            .lineHeight(.multiple(factor: 1.45))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 12)
                    .accessibilityElement(children: .combine)
                }
            }
            Group {
                if let pages = layout.pages {
                    // The words on the leading page, the list on the trailing one. The slab pads
                    // its trailing edge by the card padding, which the trailing page gives up.
                    let inset = max(0, LF.Metrics.cardPadding - layout.margins.trailing)
                    LearnSpread(pages: FoldColumns(leading: pages.leading, gap: pages.gap,
                                                   trailing: max(0, pages.trailing - inset))) {
                        lead
                    } trailing: {
                        list
                    }
                } else if layout.isWide {
                    HStack(alignment: .top, spacing: 48) {
                        lead.frame(width: layout.contentWidth * 0.38, alignment: .leading)
                        list.frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 26) {
                        lead
                        list
                    }
                }
            }
            .frame(maxWidth: LF.Metrics.maxContentWidth, alignment: .leading)
            .padding(layout.bandInsets)
            .frame(maxWidth: .infinity, alignment: layout.pages == nil ? .center : .leading)
            .padding(.vertical, layout.isRegular ? 28 : 20)
        }
    }

    // MARK: Way in

    private func wayIn(_ path: LearningPath, first: (step: LearningPath.Step, department: Department),
                       last: (step: LearningPath.Step, department: Department), layout: LearnLayout) -> some View {
        NotebookCard(tilt: .degrees(-0.5), tape: true) {
            SlugText("stop 01 / \(first.step.deptSlug)")
            Text("It starts in \(first.department.name).")
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            Text("\(first.step.note) From there the route works down to \(last.department.name), and you can stop at any line and stay in that department for the rest of the season.")
                .lfProse(16.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(52)
                .padding(.top, 12)
            NavigationLink(value: AppRoute.department(first.department.id)) {
                Text("Start at stop 01")
            }
            .buttonStyle(.ink)
            .padding(.top, 20)
        }
        .frame(maxWidth: 700, alignment: .leading)
        .learnArrival(reduceMotion, angle: -1.2)
    }
}

// MARK: - Route slip

/// One route as a slip in the binder (the site's `RouteSlip`): the pitch on the left,
/// the itinerary on the right of a 2pt ink rule where there's room. The whole slip is
/// the link.
struct LearnRouteSlip: View {
    let path: LearningPath
    let index: Int
    var showsStops: Bool

    /// Full-width paper takes a far smaller angle than an index card.
    private static let tilts: [Double] = [-0.3, 0.22, -0.16, 0.26, -0.24]

    var body: some View {
        NavigationLink(value: AppRoute.path(path.slug)) {
            NotebookCard(tilt: .degrees(Self.tilts[index % Self.tilts.count]), lift: true, padding: 0) {
                if showsStops {
                    HStack(alignment: .top, spacing: 0) {
                        pitch.frame(maxWidth: .infinity, alignment: .leading)
                        Rectangle().fill(LF.Palette.ink).frame(width: LF.Metrics.stroke)
                        stopList.frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    pitch
                }
            }
        }
        .buttonStyle(.notebookCard)
        .accessibilityLabel("Route \(index + 1): \(path.title)")
        .accessibilityValue("\(LearnFormat.plural(path.steps.count, "stop", "stops")), \(LearnFormat.plural(path.outcomes.count, "skill", "skills"))")
        .accessibilityHint(path.description)
    }

    private var pitch: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("route \(LearnFormat.ordinal(index + 1)) / \(path.slug)")
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Text(path.title)
                .font(LF.Fonts.display(23, relativeTo: .title2))
                .tracking(-0.55)
                .foregroundStyle(LF.Palette.ink)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            Text(path.description)
                .font(LF.Fonts.body(15))
                .lineHeight(.multiple(factor: 1.45))
                .foregroundStyle(LF.Palette.graphite)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 10)
            Spacer(minLength: 16)
            DashedRule()
            // On one line while it fits; then "open the route" goes under the counts, and at
            // the largest sizes each takes a line, rather than pushing the slip off the screen.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 18) {
                    counts
                    Spacer(minLength: 8)
                    openLabel
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 18) { counts }
                    openLabel
                }
                VStack(alignment: .leading, spacing: 8) {
                    counts
                    openLabel
                }
            }
            .padding(.top, 13)
        }
        .padding(LF.Metrics.cardPadding)
        .frame(maxHeight: .infinity, alignment: .top)
    }

    @ViewBuilder private var counts: some View {
        CountText(path.steps.count, unit: "stops")
        CountText(path.outcomes.count, unit: "skills")
    }

    private var openLabel: some View {
        SlugText("open the route", color: LF.Palette.ink, weight: .bold)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var stopList: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("where it goes")
                .padding(.bottom, 6)
            ForEach(Array(path.steps.enumerated()), id: \.offset) { index, step in
                if index > 0 { DashedRule() }
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    SlugText(LearnFormat.ordinal(index + 1), color: LF.Palette.blue, weight: .bold)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(step.label)
                            .font(LF.Fonts.body(14.5, weight: .semibold))
                            .foregroundStyle(LF.Palette.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        SlugText("dept / \(step.deptSlug)")
                    }
                }
                .padding(.vertical, 8)
            }
        }
        .padding(LF.Metrics.cardPadding)
    }
}

// MARK: - Handoff

extension View {
    /// Advertises the matching learnfrc.com page for Handoff, so the page opens in a
    /// browser on the person's other devices. Only while `place` is the screen on show in its
    /// window: a hidden tab or a screen under a pushed one stays quiet (ARCHITECTURE 6.6).
    func learnHandoff(_ url: URL?, place: ScreenPlace) -> some View {
        screenHandoff(place, url: url)
    }
}

// MARK: - Previews

#Preview("Path, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { PathView(slug: PreviewData.path.slug) }
        .appEnvironment(.preview)
}

#Preview("Path, iPhone, dark", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { PathView(slug: PreviewData.paths[1].slug) }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#Preview("Path, iPad", traits: .fixedLayout(width: 1180, height: 1500)) {
    NavigationStack { PathView(slug: PreviewData.path.slug) }
        .appEnvironment(LearnPreviewCatalog.model())
}

#Preview("Path, iPad, dark", traits: .fixedLayout(width: 834, height: 1400)) {
    NavigationStack { PathView(slug: PreviewData.path.slug) }
        .appEnvironment(.preview(signedIn: false))
        .environment(\.colorScheme, .dark)
}

#if DEBUG
#Preview("Path, Duo book, whole page", traits: .fixedLayout(width: 867, height: 2600)) {
    NavigationStack { PathView(slug: PreviewData.path.slug) }
        .appEnvironment(LearnPreviewCatalog.model())
        .previewFold(.previewBook)
}
#endif
