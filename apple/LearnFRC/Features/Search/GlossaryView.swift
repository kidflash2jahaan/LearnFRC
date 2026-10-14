import SwiftUI

/// The card catalogue (learnfrc.com/glossary): every FRC term, filed once. Search it,
/// narrow it to one category, or jump to a letter; tap a card for the full entry.
///
/// Push it with `AppRoute.glossaryIndex`, or give it its own sidebar item on iPad and Mac.
///
/// Its width rules (columns, the margin note beside or under the title, wrapped or sliding
/// category chips) are decided during layout (`SearchAdaptiveGrid`, `SearchWidthSwitch`,
/// `searchPage()`), never from a width stored in state: a stored width fed back into layout
/// and froze the iPad Pro in landscape.
struct GlossaryView: View {
    @Environment(ReferenceStore.self) private var reference
    @Environment(Connectivity.self) private var connectivity
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    /// As the environment brings it; use `screenTab` (`NavigationTabFallback`).
    @Environment(\.navigationTab) private var tab
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var query = ""
    @State private var category: String?
    @State private var didRestore = false
    @State private var tabFallback = NavigationTabFallback()
    /// VoiceOver moves to the letter a key jumped to.
    @AccessibilityFocusState private var focusedLetter: String?

    /// - Parameter category: open narrowed to one category ("Software").
    init(category: String? = nil) {
        _category = State(initialValue: category)
    }

    /// Content width (inside the gutters) for the wide masthead and wrapped chips: an 820pt page.
    private static let wideContent: CGFloat = 754

    private var filtered: [GlossaryTerm] {
        GlossaryRules.filter(reference.glossary, query: query, category: category)
    }

    private var hasFilters: Bool {
        !query.trimmingCharacters(in: .whitespaces).isEmpty || category != nil
    }

    var body: some View {
        let terms = filtered
        let sections = Self.sections(terms)
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    masthead
                    if reference.glossary.isEmpty {
                        notLoaded
                            .padding(.top, 30)
                    } else {
                        InkRule()
                            .padding(.top, 26)
                        filters(sections: sections, proxy: proxy)
                            .padding(.top, 24)
                        countLine(terms.count)
                            .padding(.top, 26)
                        if terms.isEmpty {
                            noMatch
                                .padding(.top, 24)
                        } else {
                            catalogue(sections)
                        }
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 56)
                .searchPage()
            }
            // The Mac rebuilds the tab on every switch: the catalogue comes back where it was
            // left, with its filter (below).
            .remembersScroll(Self.place)
        }
        .scrollDismissesKeyboard(.immediately)
        .paperBackground()
        .navigationTitle("Glossary")
        .toolbarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: Text("A term, an acronym, or a phrase"))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: AppConfig.webBase.appending(path: "glossary")) {
                    Label("Share the glossary", systemImage: "square.and.arrow.up")
                }
            }
        }
        .closesShareSheetsOnNavigation()
        .onAppear(perform: restoreFilter)
        .onChange(of: query) { rememberFilter() }
        .onChange(of: category) { rememberFilter() }
        .onDisappear(perform: forgetFilterIfLeft)
        // Everything inside (the kept scroll position) knows the tab, even on the Mac, where
        // the environment doesn't bring it to a pushed screen.
        .environment(\.navigationTab, screenTab)
    }

    /// The tab whose stack the catalogue sits in (nil in previews).
    private var screenTab: AppTab? { tabFallback.tab(tab, navigation: navigation) }

    // MARK: Coming back as it was

    /// The catalogue's place in its window (`ScreenPlace`): what it keeps is filed per tab.
    private static let place = ScreenPlace.route(.glossaryIndex)
    private static let filterThing = "glossary.filter"

    /// The search words and category, kept in the window's `memory` while the catalogue is
    /// still in its tab's stack. The Mac builds the stack again on every tab switch, and the
    /// catalogue should come back narrowed the way it was left. Per tab, so the catalogue
    /// open in Search and in Guides keeps two filters. Not while the tab holds the catalogue
    /// twice (opened again from an entry, "The catalogue"): the second copy starts with every
    /// card and leaves the first one's filter alone.
    private struct Filter: Sendable {
        var query: String
        var category: String?
    }

    /// This catalogue's corner of the window's memory, or nil when it keeps nothing (outside
    /// a window's tab, or a second copy in the same tab).
    private var memory: ScreenPlaceMemory? {
        guard let memory = ScreenPlaceMemory(Self.place, navigation: navigation, tab: screenTab),
              !Self.place.isRepeated(navigation: memory.navigation, tab: memory.tab) else { return nil }
        return memory
    }

    private func restoreFilter() {
        guard !didRestore else { return }
        didRestore = true
        guard let saved = memory?.value(Filter.self, for: Self.filterThing) else { return }
        query = saved.query
        category = saved.category
    }

    private func rememberFilter() {
        memory?.set(Filter(query: query, category: category), for: Self.filterThing)
    }

    /// Gone back from (no longer in the stack): the next visit starts with every card.
    private func forgetFilterIfLeft() {
        ScreenPlaceMemory(Self.place, navigation: navigation, tab: screenTab)?.forgetIfLeft(Self.filterThing)
    }

    // MARK: Masthead

    private var masthead: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("the card catalogue")
            if dynamicTypeSize.isAccessibilitySize {
                mastheadNarrow
            } else {
                SearchWidthSwitch(minWidth: Self.wideContent) {
                    HStack(alignment: .bottom, spacing: 28) {
                        mastheadText
                        Spacer(minLength: 0)
                        MarkerText("look it up mid-argument, that\u{2019}s what it\u{2019}s for", size: 22, angle: -1.4)
                            .frame(maxWidth: 230, alignment: .trailing)
                            .multilineTextAlignment(.trailing)
                            .padding(.bottom, 6)
                    }
                } narrow: {
                    mastheadNarrow
                }
            }
            if !reference.glossary.isEmpty {
                tally
                    .padding(.top, 22)
            }
        }
    }

    private var mastheadText: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Every acronym you\u{2019}ll hear in the pit.")
                .lfTitle(.h1)
                .frame(maxWidth: 560, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Text("Search a term, narrow it to one category, or jump to a letter. Written the way somebody would explain it across a workbench, not the way the manual defines it.")
                .lfProse(17, color: LF.Palette.graphite)
                .frame(maxWidth: 600, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
        }
    }

    private var mastheadNarrow: some View {
        VStack(alignment: .leading, spacing: 0) {
            mastheadText
            MarkerText("look it up mid-argument, that\u{2019}s what it\u{2019}s for", size: 21)
                .padding(.top, 12)
        }
    }

    /// The drawer label: how much is filed here.
    private var tally: some View {
        let terms = reference.glossary
        let letters = Set(terms.map(GlossaryRules.letter(for:)).filter { $0 != "#" }).count
        let categories = self.categories.count
        return VStack(alignment: .leading, spacing: 14) {
            DashedRule()
            SearchFlowLayout(spacing: 34, lineSpacing: 12) {
                tallyFigure("terms filed", terms.count.formatted())
                tallyFigure("categories", "\(categories)")
                tallyFigure("letters in use", "\(letters)/26")
            }
        }
    }

    private func tallyFigure(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            SlugText(label)
            CountText(value, size: 21)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Filters

    private func filters(sections: [GlossarySection], proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                SlugText("filter / category")
                    .accessibilityAddTraits(.isHeader)
                chips
            }
            VStack(alignment: .leading, spacing: 8) {
                SlugText("jump to a letter")
                    .accessibilityAddTraits(.isHeader)
                letterRail(sections: sections, proxy: proxy)
            }
        }
    }

    private var categories: [String] {
        let listed = reference.glossaryCategories
        let used = Set(reference.glossary.map(\.category))
        let ordered = listed.isEmpty ? used.sorted() : listed
        return ordered.filter { used.contains($0) }
    }

    /// Wraps on a wide window; one sideways-scrolling row on a phone.
    @ViewBuilder
    private var chips: some View {
        if dynamicTypeSize.isAccessibilitySize {
            chipScroller
        } else {
            SearchWidthSwitch(minWidth: Self.wideContent) {
                SearchFlowLayout(spacing: 8, lineSpacing: 2) { chipList }
            } narrow: {
                chipScroller
            }
        }
    }

    private var chipScroller: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) { chipList }
                .padding(.vertical, 1)
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
    }

    @ViewBuilder
    private var chipList: some View {
        chip("All", value: nil)
        ForEach(categories, id: \.self) { name in
            chip(name, value: name)
        }
    }

    private func chip(_ title: String, value: String?) -> some View {
        let selected = category == value
        return Button {
            category = value
        } label: {
            TagView(title, on: selected)
                .frame(minWidth: LF.Metrics.tap, minHeight: LF.Metrics.tap)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(value == nil ? "All categories" : title)
        // The chip is the button's label, so the choice is announced here, once.
        .accessibilityAddTraits(selected ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: selected) { _, new in new }
    }

    /// Every letter is a full 44pt key, like the site's (`w-[var(--tap)] h-[var(--tap)]`):
    /// wrapped onto as many lines as it takes on a wide window, one sideways-scrolling strip on
    /// a phone and at the accessibility sizes.
    @ViewBuilder
    private func letterRail(sections: [GlossarySection], proxy: ScrollViewProxy) -> some View {
        let available = Set(sections.map(\.letter))
        let letters = GlossaryRules.alphabet + (available.contains("#") ? ["#"] : [])
        let keys = ForEach(letters, id: \.self) { letter in
            letterButton(letter, count: sections.first { $0.letter == letter }?.terms.count ?? 0, proxy: proxy)
        }
        let strip = ScrollView(.horizontal) {
            HStack(spacing: 6) { keys }
                .padding(.vertical, 1)
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        if dynamicTypeSize.isAccessibilitySize {
            strip
        } else {
            SearchWidthSwitch(minWidth: Self.wideContent) {
                SearchFlowLayout(spacing: 8, lineSpacing: 8) { keys }
            } narrow: {
                strip
            }
        }
    }

    private func letterButton(_ letter: String, count: Int, proxy: ScrollViewProxy) -> some View {
        let enabled = count > 0
        return Button {
            let animation: Animation? = reduceMotion ? nil : LF.Motion.settle
            withAnimation(animation) {
                proxy.scrollTo(Self.anchor(letter), anchor: .top)
            }
            focusedLetter = letter
        } label: {
            GlossaryKeyLayout(minSide: LF.Metrics.tap) {
                Text(letter)
                    .font(LF.Fonts.mono(14, weight: .bold, relativeTo: .footnote))
                    .foregroundStyle(enabled ? LF.Palette.ink : LF.Palette.rule)
                    .lineLimit(1)
                    .fixedSize()
            }
            .background {
                HandShape(.s)
                    .strokeBorder(enabled ? LF.Palette.ink : LF.Palette.rule, lineWidth: enabled ? LF.Metrics.stroke : LF.Metrics.hairline)
                    .background(HandShape(.s).fill(enabled ? LF.Palette.card : Color.clear))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(enabled ? "Jump to \(letter), \(count == 1 ? "1 term" : "\(count) terms")" : "Nothing filed under \(letter)")
    }

    private func countLine(_ count: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 7) {
                Text(count.formatted())
                    .font(LF.Fonts.mono(17, weight: .bold, relativeTo: .headline))
                    .monospacedDigit()
                    .foregroundStyle(LF.Palette.blue)
                SlugText(count == 1 ? "term showing" : "terms showing")
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.updatesFrequently)
            Spacer(minLength: 0)
            if hasFilters {
                Button("Clear filters", action: clearFilters)
                    .buttonStyle(.inkGhostSmall)
            }
        }
    }

    private func clearFilters() {
        query = ""
        category = nil
    }

    // MARK: Cards

    private func catalogue(_ sections: [GlossarySection]) -> some View {
        let tokens = SearchQuery(query)
        var offset = 0
        let offsets = sections.map { section -> Int in
            defer { offset += section.terms.count }
            return offset
        }
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(sections.enumerated()), id: \.element.letter) { position, section in
                // What "jump to a letter" scrolls to. Its own view beside the section: an `.id`
                // on the one view a `ForEach` row returns is taken as the row's identity, and
                // the scroll view never found it (the letter keys didn't move the page).
                Color.clear
                    .frame(height: 0)
                    .id(Self.anchor(section.letter))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .center, spacing: 14) {
                        Text(section.letter)
                            .font(LF.Fonts.display(30, relativeTo: .title))
                            .foregroundStyle(LF.Palette.blue)
                            .accessibilityLabel("Letter \(section.letter)")
                            .accessibilityAddTraits(.isHeader)
                            .accessibilityFocused($focusedLetter, equals: section.letter)
                        DashedRule()
                        SlugText(section.terms.count == 1 ? "1 term" : "\(section.terms.count) terms")
                            .fixedSize()
                    }
                    SearchAdaptiveGrid(items: section.terms, spacing: 20) { index, term in
                        NavigationLink(value: AppRoute.glossaryTerm(term.slug)) {
                            GlossaryIndexCard(
                                slug: term.category.lowercased(),
                                title: SearchHighlight(term.term, query: tokens).attributed,
                                definition: SearchHighlight(term.definition, query: tokens).attributed,
                                badge: term.abbr.flatMap { $0.isEmpty || $0 == term.term ? nil : $0 },
                                tilt: .preset(offsets[position] + index),
                                definitionLines: nil
                            )
                        }
                        .buttonStyle(.notebookCard)
                        .accessibilityLabel("\(term.displayTitle). \(term.category). \(term.definition)")
                        .accessibilityHint("Opens the entry")
                    }
                }
                .padding(.top, 34)
            }
        }
    }

    private var noMatch: some View {
        VStack(alignment: .leading, spacing: 14) {
            NoteCallout {
                SlugText("no match")
                Group {
                    if query.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text("Nothing is filed under those filters.")
                    } else {
                        Text("Nothing is filed under \u{201C}\(query.trimmingCharacters(in: .whitespaces))\u{201D}\(category.map { " in \($0)" } ?? "").")
                    }
                }
                .font(LF.Fonts.body(17, weight: .medium))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
                Text("Clear the filters and start again. Search, in the tab bar or sidebar, also reads every lesson and article.")
                    .font(LF.Fonts.body(15, relativeTo: .subheadline))
                    .foregroundStyle(LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 560, alignment: .leading)
            Button("Clear filters", action: clearFilters)
                .buttonStyle(.inkGhostSmall)
        }
    }

    @ViewBuilder
    private var notLoaded: some View {
        if !connectivity.isOnline, !reference.isRefreshing {
            NoteCallout {
                SlugText("offline")
                Text("The glossary hasn't downloaded yet. It needs a connection once, then it stays on this device.")
                    .font(LF.Fonts.body(16))
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 560, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 18) {
                SlugText("opening the drawer\u{2026}")
                SearchAdaptiveGrid(items: (0..<3).map(GlossaryPlaceholder.init), spacing: 20) { _, _ in
                    VStack(alignment: .leading, spacing: 10) {
                        SkeletonBlock(height: 12, width: 110)
                        SkeletonBlock(height: 22, width: 180)
                        SkeletonBlock(height: 13)
                        SkeletonBlock(height: 13, width: 200)
                    }
                    .padding(16)
                    .notebookBox(shadow: .none)
                }
            }
        }
    }

    // MARK: Sections

    static func sections(_ terms: [GlossaryTerm]) -> [GlossarySection] {
        var order: [String] = []
        var grouped: [String: [GlossaryTerm]] = [:]
        for term in terms {
            let letter = GlossaryRules.letter(for: term)
            if grouped[letter] == nil { order.append(letter) }
            grouped[letter, default: []].append(term)
        }
        // "#" files after Z, like an index.
        order.sort { a, b in
            if a == "#" { return false }
            if b == "#" { return true }
            return a < b
        }
        return order.map { GlossarySection(letter: $0, terms: grouped[$0] ?? []) }
    }

    private static func anchor(_ letter: String) -> String { "glossary-letter-\(letter)" }
}

struct GlossarySection: Identifiable {
    let letter: String
    let terms: [GlossaryTerm]
    var id: String { letter }
}

private struct GlossaryPlaceholder: Identifiable {
    let id: Int
}

/// A square key at least `minSide` points each way, growing with its letter at the larger
/// text sizes so it stays a square key rather than a tall slot.
private struct GlossaryKeyLayout: Layout {
    let minSide: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let content = subviews.first?.sizeThatFits(.unspecified) ?? .zero
        let side = ceil(max(minSide, content.width, content.height))
        return CGSize(width: side, height: side)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        subviews.first?.place(at: CGPoint(x: bounds.midX, y: bounds.midY), anchor: .center, proposal: .unspecified)
    }
}

// MARK: - Previews

#Preview("Glossary, iPhone", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        GlossaryView()
    }
    .appEnvironment(.preview)
}

#Preview("Glossary, iPhone, Night", traits: .fixedLayout(width: 393, height: 852)) {
    NavigationStack {
        GlossaryView(category: "Software")
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}

#Preview("Glossary, iPad", traits: .fixedLayout(width: 1180, height: 820)) {
    NavigationStack {
        GlossaryView()
    }
    .appEnvironment(.preview)
}

#Preview("Glossary, iPad, Night", traits: .fixedLayout(width: 834, height: 1100)) {
    NavigationStack {
        GlossaryView()
    }
    .appEnvironment(.preview)
    .environment(\.colorScheme, .dark)
}
