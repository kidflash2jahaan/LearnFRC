import SwiftUI

/// The FRC calculators, like learnfrc.com/tools: the question each one answers, what falls
/// out the other end, and the note on how far to trust a number. Two columns of pinned cards
/// from regular width, the right one dropped half a card, like the site's wall.
struct ToolsView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var webURL: URL { AppConfig.webBase.appending(path: "tools") }

    var body: some View {
        LearnScrollPage(title: "Tools", place: .route(.tools)) { layout, _ in
            header(layout)
                .learnColumn(layout, spread: true)
                .padding(.top, 20)

            wall(layout)
                .learnColumn(layout, spread: true)
                .padding(.top, 40)

            ToolNote(kicker: "before you trust a number",
                     text: "Figures track the 2025-26 season and current vendor pricing. FIRST revises fees and wiring rules most years, so check the current Game Manual before an event. None of these tools is a substitute for inspection.")
                .learnColumn(layout)
                .padding(.top, 44)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: webURL, subject: Text("Free FRC Tools & Calculators")) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
        .learnHandoff(webURL, place: .route(.tools))
    }

    private func header(_ layout: LearnLayout) -> some View {
        let text = VStack(alignment: .leading, spacing: 0) {
            SectionLabel("tools / six calculators")
            ToolMarkedTitle(before: "The numbers, ", mark: "worked out", after: ".")
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
            LearnLede("Six calculators for the questions that stop a build night. Every default comes from an official FIRST page or a vendor spec sheet, and the source is printed next to the number.")
                .padding(.top, 16)
        }
        return Group {
            if let pages = layout.pages {
                // iPhone Duo's two pages: the question on one, the pen note on the other.
                LearnSpread(pages: pages, alignment: .bottom) {
                    text
                } trailing: {
                    MarkerText("nothing here needs an account", angle: 1.4)
                        .padding(.trailing, 4)
                }
            } else if layout.isRegular {
                HStack(alignment: .bottom, spacing: 32) {
                    text.frame(maxWidth: .infinity, alignment: .leading)
                    MarkerText("nothing here needs an account", angle: 1.4)
                        .multilineTextAlignment(.trailing)
                        .padding(.trailing, 4)
                        .frame(maxWidth: 200, alignment: .trailing)
                }
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    text
                    MarkerText("nothing here needs an account", angle: 1.4)
                        .padding(.trailing, 4)
                }
            }
        }
    }

    @ViewBuilder
    private func wall(_ layout: LearnLayout) -> some View {
        let tools = ToolCatalog.all
        if let pages = layout.pages {
            // The wall's two columns are iPhone Duo's two pages, the gap on the crease.
            HStack(alignment: .top, spacing: pages.gap) {
                VStack(spacing: 28) {
                    ForEach(tools.indices.filter { $0 % 2 == 0 }, id: \.self) { card(tools[$0]) }
                }
                .frame(width: pages.leading)
                VStack(spacing: 28) {
                    ForEach(tools.indices.filter { $0 % 2 == 1 }, id: \.self) { card(tools[$0]) }
                }
                .padding(.top, 56)
                .frame(width: pages.trailing)
            }
        } else if layout.isRegular {
            HStack(alignment: .top, spacing: 28) {
                VStack(spacing: 28) {
                    ForEach(tools.indices.filter { $0 % 2 == 0 }, id: \.self) { card(tools[$0]) }
                }
                VStack(spacing: 28) {
                    ForEach(tools.indices.filter { $0 % 2 == 1 }, id: \.self) { card(tools[$0]) }
                }
                .padding(.top, 56)
            }
        } else {
            VStack(spacing: 26) {
                ForEach(tools) { card($0) }
            }
        }
    }

    private func card(_ tool: ToolInfo) -> some View {
        NavigationLink(value: AppRoute.tool(tool.slug)) {
            NotebookCard(tilt: .tool(tool.tilt, dynamicTypeSize), tape: tool.tape, lift: true) {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        SlugText("tools / \(tool.slug)")
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        SlugText(tool.tag)
                            .fixedSize()
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        LearnWholeWordSlug(text: "tools / \(tool.slug)")
                        SlugText(tool.tag)
                    }
                }
                Text(tool.title)
                    .font(LF.Fonts.display(23, relativeTo: .title2))
                    .tracking(-0.55)
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
                Text(tool.ask)
                    .font(LF.Fonts.body(16.5, weight: .medium))
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                Text(tool.body)
                    .font(LF.Fonts.body(15))
                    .lineHeight(.multiple(factor: 1.45))
                    .foregroundStyle(LF.Palette.graphite)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 6)
                DashedRule()
                    .padding(.top, 16)
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: 14) {
                        SlugText(tool.gives)
                            .fixedSize()
                        Spacer(minLength: 8)
                        SlugText("open", color: LF.Palette.ink, weight: .bold)
                            .fixedSize()
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        SlugText(tool.gives)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                        SlugText("open", color: LF.Palette.ink, weight: .bold)
                    }
                }
                .padding(.top, 13)
            }
        }
        .buttonStyle(.notebookCard)
        .learnArrival(reduceMotion, angle: -1.2)
        .accessibilityLabel(tool.title)
        .accessibilityValue(tool.ask)
        .accessibilityHint(tool.body)
    }
}

/// One calculator by its website slug. A slug the app doesn't know gets a plain note and
/// the way back to the six that exist.
struct ToolView: View {
    let slug: String

    var body: some View {
        switch slug.lowercased() {
        case ToolCatalog.budget: BudgetView()
        case ToolCatalog.gearRatio: GearRatioView()
        case ToolCatalog.wireGauge: WireGaugeView()
        case ToolCatalog.tipping: TippingView()
        case ToolCatalog.currentBudget: CurrentBudgetView()
        case ToolCatalog.deflection: DeflectionView()
        default: ToolNotFoundView(slug: slug)
        }
    }
}

/// A tool link from a newer site or an old bookmark that this version doesn't have.
private struct ToolNotFoundView: View {
    let slug: String

    var body: some View {
        LearnScrollPage(title: "Tool", place: .route(.tool(slug))) { layout, _ in
            VStack(alignment: .leading, spacing: 0) {
                SectionLabel("tools / \(slug)")
                Text("There's no calculator here by that name.")
                    .lfTitle(.h2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
                LearnNotice(kicker: "not in this version",
                            message: "It may have moved, or it's newer than this copy of the app. The six calculators that are here all work without an account.") {
                    NavigationLink(value: AppRoute.tools) {
                        LearnLinkLabel(title: "See all six calculators", systemImage: "arrow.right")
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 20)
            }
            .learnColumn(layout)
            .padding(.top, 24)
        }
    }
}

#Preview("Tools, iPhone", traits: .fixedLayout(width: 393, height: 1900)) {
    NavigationStack { ToolsView() }
        .appEnvironment(.preview)
}

#Preview("Tools, iPad, dark", traits: .fixedLayout(width: 1024, height: 1300)) {
    NavigationStack { ToolsView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#Preview("Tool not found", traits: .fixedLayout(width: 393, height: 700)) {
    NavigationStack { ToolView(slug: "frc-flux-capacitor") }
        .appEnvironment(.preview)
}

#if DEBUG
#Preview("Tools, Duo book, whole page", traits: .fixedLayout(width: 867, height: 2000)) {
    NavigationStack { ToolsView() }
        .appEnvironment(.preview)
        .previewFold(.previewBook)
}
#endif
