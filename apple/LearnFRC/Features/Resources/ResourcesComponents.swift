import SwiftUI

// The pieces of the resources page: the contents list in the masthead, one shelf of the
// toolbox (`ShelfBin` on the site), the works cited, and one outside link.

// MARK: - Contents

/// "on the shelves": the masthead's contents list. Each line jumps to its shelf.
struct ResourcesShelfContents: View {
    let shelves: [ResourcesPage.Shelf]
    let onSelect: (ResourcesPage.Shelf) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("on the shelves")
                .padding(.bottom, 8)
                .accessibilityAddTraits(.isHeader)
            InkRule()
            ForEach(Array(shelves.enumerated()), id: \.element.id) { index, shelf in
                Button {
                    onSelect(shelf)
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        SlugText(LearnFormat.ordinal(index + 1), color: LF.Palette.blue, weight: .bold)
                        Text(shelf.category)
                            .font(LF.Fonts.body(16, weight: .semibold))
                            .foregroundStyle(LF.Palette.ink)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        SlugText(shelf.links.count.formatted())
                    }
                    .padding(.vertical, 10)
                    .overlay(alignment: .bottom) { DashedRule() }
                }
                .buttonStyle(.inkRow)
                .accessibilityLabel("Shelf \(index + 1), \(shelf.category)")
                .accessibilityValue(LearnFormat.plural(shelf.links.count, "link", "links"))
                .accessibilityHint("Jumps to the shelf")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Shelves on this page")
    }
}

// MARK: - A shelf

/// One shelf of the toolbox, drawn as a labelled parts bin: a mono part number across the
/// top, the count, the name and what it's for, then the links on ruled lines.
struct ResourcesShelfBin: View {
    let shelf: ResourcesPage.Shelf
    let index: Int
    let layout: LearnLayout

    /// The site's `BIN_TILT`: much smaller than an index card's, because a bin runs the full
    /// width of the column. No two are the same.
    private static let tilts: [Double] = [-0.35, 0.28, -0.2, 0.32, -0.26]

    var body: some View {
        NotebookCard(tilt: .degrees(Self.tilts[index % Self.tilts.count]), padding: layout.isRegular ? 24 : LF.Metrics.cardPadding) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 16) {
                    partNumber
                    Spacer(minLength: 8)
                    count
                }
                VStack(alignment: .leading, spacing: 6) {
                    partNumber
                    count
                }
            }

            LearnWholeWords(text: shelf.category) { string in
                Text(string)
                    .lfTitle(.h3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 8)

            if !shelf.blurb.isEmpty {
                Text(shelf.blurb)
                    .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .learnMeasure(54)
                    .padding(.top, 8)
            }

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(shelf.links.enumerated()), id: \.element.id) { offset, link in
                    if offset == 0 { InkRule() } else { DashedRule() }
                    ResourcesLinkRow(link: link, wide: layout.isRegular)
                }
            }
            .padding(.top, 16)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(shelf.category)
    }

    private var partNumber: some View {
        SlugText("shelf \(LearnFormat.ordinal(index + 1)) / \(shelf.slug)")
            .fixedSize(horizontal: false, vertical: true)
    }

    private var count: some View {
        CountText(shelf.links.count, unit: shelf.links.count == 1 ? "link" : "links")
    }
}

// MARK: - One link

/// One outside link: the title, then the host it goes to. The whole row is the target, at
/// least 44pt tall, and it opens in the in-app browser (the page's `openURL`).
struct ResourcesLinkRow: View {
    let link: ResourcesPage.Link
    /// Title and host side by side (iPad, Mac); stacked on a phone.
    var wide: Bool
    var titleWeight: Font.Weight = .semibold

    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            openURL(link.url)
        } label: {
            Group {
                if wide {
                    HStack(alignment: .firstTextBaseline, spacing: 20) {
                        title.frame(maxWidth: .infinity, alignment: .leading)
                        host.frame(maxWidth: 240, alignment: .trailing)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 3) {
                        title
                        host
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.vertical, 10)
        }
        .buttonStyle(.inkRow)
        .accessibilityLabel(link.title)
        .accessibilityValue(link.host)
        .accessibilityHint("Opens \(link.host) in the browser")
        .accessibilityAddTraits(.isLink)
        .accessibilityRemoveTraits(.isButton)
        #if os(macOS)
        .pointerStyle(.link)
        .help(link.url.absoluteString)
        #endif
    }

    private var title: some View {
        Text(link.title)
            .font(LF.Fonts.body(16, weight: titleWeight))
            .foregroundStyle(LF.Palette.ink)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var host: some View {
        SlugText(link.host)
            .multilineTextAlignment(wide ? .trailing : .leading)
            .lineLimit(2)
            .truncationMode(.middle)
    }
}

// MARK: - Works cited

/// "What the lessons are built on.": every department's sources, the first six of each
/// with the full count beside the name, the way the site's table trims them.
struct ResourcesWorksCited: View {
    let page: ResourcesPage
    let layout: LearnLayout

    private var departments: [ResourcesPage.DepartmentSources] { page.departmentsWithSources }
    private var perDepartment: Int { page.sourcesPerDepartment }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let pages = layout.pages {
                LearnSpreadRule(pages: pages)
            } else {
                InkRule()
            }
            let header = LearnSectionHeader(
                title: "What the lessons are built on.",
                sub: "Every guide here is written from published references rather than from memory. These are them, department by department, so you can go and check the original. Long lists are trimmed to the first \(perDepartment), and the figure beside each department is the full count."
            )
            let figures = HStack(alignment: .firstTextBaseline, spacing: 28) {
                CountText(page.totalSources, unit: "cited sources")
                CountText(departments.count, unit: departments.count == 1 ? "department" : "departments")
            }
            Group {
                if let pages = layout.pages {
                    // The heading on one page, the counts on the other.
                    LearnSpread(pages: pages, alignment: .bottom) {
                        header
                    } trailing: {
                        if !departments.isEmpty {
                            ViewThatFits(in: .horizontal) {
                                figures
                                VStack(alignment: .leading, spacing: 10) {
                                    CountText(page.totalSources, unit: "cited sources")
                                    CountText(departments.count, unit: departments.count == 1 ? "department" : "departments")
                                }
                            }
                        }
                    }
                } else if layout.isWide, !departments.isEmpty {
                    HStack(alignment: .bottom, spacing: 40) {
                        header.frame(maxWidth: .infinity, alignment: .leading)
                        figures
                    }
                } else {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        if !departments.isEmpty {
                            ViewThatFits(in: .horizontal) {
                                figures
                                VStack(alignment: .leading, spacing: 10) {
                                    CountText(page.totalSources, unit: "cited sources")
                                    CountText(departments.count, unit: departments.count == 1 ? "department" : "departments")
                                }
                            }
                        }
                    }
                }
            }
            .padding(.top, 28)

            if departments.isEmpty {
                LearnNotice(
                    kicker: "nothing filed yet",
                    message: "The citation list fills in as each department's guides are published. The toolbox above is complete either way."
                )
                .frame(maxWidth: layout.pages?.leading ?? .infinity, alignment: .leading)
                .padding(.top, 26)
            } else if let pages = layout.pages {
                // Department by department down both pages, each under the shorter one.
                VStack(alignment: .leading, spacing: 0) {
                    LearnSpreadRule(pages: pages)
                    LearnFoldColumns(pages: pages, fill: .balanced, spacing: 0) {
                        ForEach(departments) { department in
                            group(department, wide: false)
                        }
                    }
                }
                .padding(.top, 26)
            } else {
                table.padding(.top, 26)
            }
        }
    }

    private var table: some View {
        VStack(alignment: .leading, spacing: 0) {
            // The table's column heads, printed once like the site's `thead`.
            if layout.isRegular {
                HStack {
                    SlugText("source")
                    Spacer()
                    SlugText("host")
                }
                .padding(.bottom, 8)
                .accessibilityHidden(true)
            }
            InkRule()
            ForEach(departments) { department in
                group(department, wide: layout.isRegular)
            }
        }
        .frame(maxWidth: 900, alignment: .leading)
    }

    private func group(_ department: ResourcesPage.DepartmentSources, wide: Bool) -> some View {
        let shown = Array(department.sources.prefix(perDepartment))
        let trim = department.total > perDepartment
            ? "first \(perDepartment) of \(department.total)"
            : "\(department.total) cited"
        return VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text(department.name)
                    .font(LF.Fonts.display(18, relativeTo: .headline))
                    .tracking(-0.4)
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                HomeFlowLayout(spacing: 14, lineSpacing: 4) {
                    SlugText("dept / \(department.slug)")
                    SlugText(trim)
                }
            }
            .padding(.top, 26)
            .padding(.bottom, 8)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(department.name), \(trim)")

            ForEach(Array(shown.enumerated()), id: \.offset) { offset, source in
                if offset > 0 { DashedRule() }
                ResourcesLinkRow(link: source, wide: wide, titleWeight: .medium)
            }
            DashedRule()
        }
    }
}

// MARK: - Loading

/// Stands in for the page while it comes down for the first time.
struct ResourcesLoadingBlock: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(height: 12, width: 190)
            SkeletonBlock(height: 34, width: 280)
            SkeletonBlock(height: 18)
            SkeletonBlock(height: 18, width: 220)
            ForEach(0..<3, id: \.self) { _ in
                SkeletonBlock(height: 150)
                    .padding(.top, 10)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading the resources")
    }
}

// MARK: - Preview data

/// The site's toolbox and a few real citations, for previews.
enum ResourcesPreviewData {
    private static func link(_ title: String, _ url: String) -> ResourcesPage.Link {
        ResourcesPage.Link(title: title, url: URL(string: url)!)
    }

    static let page = ResourcesPage(
        shelves: [
            .init(category: "Official FIRST", blurb: "The manual, season materials, and game tools straight from FIRST.", links: [
                link("FIRST Robotics Competition", "https://www.firstinspires.org/robotics/frc"),
                link("FRC Game & Season Materials", "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system"),
                link("FRC Driver Station & Game Tools", "https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/frc-game-tools.html"),
            ]),
            .init(category: "Software & Programming", blurb: "WPILib and the vision, path, and trajectory tools your code leans on.", links: [
                link("WPILib Documentation", "https://docs.wpilib.org"),
                link("PathPlanner", "https://pathplanner.dev"),
                link("Choreo (trajectory tool)", "https://choreo.autos"),
                link("PhotonVision", "https://docs.photonvision.org"),
                link("Limelight Documentation", "https://docs.limelightvision.io"),
            ]),
            .init(category: "CAD & Design", blurb: "Model the robot before you cut metal. Free CAD, built for FRC.", links: [
                link("Onshape", "https://www.onshape.com"),
                link("FRCDesign.org, the Onshape FRC parts library (formerly MKCad)", "https://frcdesign.org"),
            ]),
            .init(category: "Hardware & Vendors", blurb: "Where the motors, gearboxes, and structure come from.", links: [
                link("REV Robotics", "https://www.revrobotics.com"),
                link("CTR Electronics (Phoenix)", "https://store.ctr-electronics.com"),
                link("AndyMark", "https://www.andymark.com"),
                link("WestCoast Products (WCP)", "https://wcproducts.com"),
            ]),
            .init(category: "Community & Data", blurb: "Forums and match data, the collective brain of the FRC world.", links: [
                link("Chief Delphi (forums)", "https://www.chiefdelphi.com"),
                link("The Blue Alliance", "https://www.thebluealliance.com"),
                link("Statbotics", "https://www.statbotics.io"),
            ]),
        ],
        departments: PreviewData.departments.map { department in
            ResourcesPage.DepartmentSources(
                slug: department.slug,
                name: department.name,
                sources: department.sources.map { ResourcesPage.Link(title: $0.title, url: $0.url) }
            )
        }
    )
}
