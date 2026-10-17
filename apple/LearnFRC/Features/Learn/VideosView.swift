import SwiftUI
import YouTubePlayerKit

/// Every lesson video, in course order (learnfrc.com/videos).
///
/// Built for someone teaching from them: no lesson text or quizzes, just each
/// department's videos in the order of the course. Every video is a poster until it's
/// pressed; pressing it opens the player with the rest of that department queued below,
/// so a mentor can put one on a projector (or AirPlay it) and play the next.
struct VideosView: View {
    @Environment(CatalogStore.self) private var catalog
    @Environment(Connectivity.self) private var connectivity
    @Environment(AppModel.self) private var model
    @Environment(WindowNavigation.self) private var navigation: WindowNavigation?
    @Environment(\.navigationTab) private var tab
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var playing: LessonLocation?

    init() {}

    /// Departments with at least one video, in catalog order.
    private var shelves: [(department: Department, videos: [LessonLocation])] {
        var order: [UUID] = []
        var grouped: [UUID: [LessonLocation]] = [:]
        for location in catalog.videoLessons {
            let id = location.department.id
            if grouped[id] == nil { order.append(id) }
            grouped[id, default: []].append(location)
        }
        return order.compactMap { id in
            guard let videos = grouped[id], let department = videos.first?.department else { return nil }
            return (department, videos)
        }
    }

    var body: some View {
        let shelves = shelves
        let total = shelves.reduce(0) { $0 + $1.videos.count }
        LearnScrollPage(title: "Videos", refresh: { await model.refreshAll() }, place: .route(.videos)) { layout, proxy in
            if let pages = layout.pages, shelves.count > 1 {
                // iPhone Duo's inner screen held upright: the masthead on the leading page,
                // the departments to jump to on the trailing one.
                LearnSpread(pages: pages) {
                    masthead(total: total, shelves: shelves, layout: .page(pages.leading), proxy: proxy, chips: false)
                } trailing: {
                    jumpChips(shelves, proxy: proxy)
                        .padding(.top, 30)
                }
                .learnColumn(layout, spread: true)
                .padding(.top, 20)
            } else {
                masthead(total: total, shelves: shelves, layout: layout.column, proxy: proxy, chips: true)
                    .learnColumn(layout)
                    .padding(.top, 20)
            }

            if total == 0 {
                Group {
                    if !catalog.isLoaded {
                        LearnLoadingBlock(rows: 2)
                    } else {
                        LearnNotice(kicker: "videos / none yet",
                                    message: "No lesson videos are on this device yet. \(LearnFormat.checkSite).")
                    }
                }
                .learnColumn(layout)
                .padding(.top, 28)
            } else {
                ForEach(shelves, id: \.department.id) { shelf in
                    shelfSection(shelf.department, videos: shelf.videos, layout: layout)
                        .learnColumn(layout, spread: true)
                        .padding(.top, 48)
                        .id(LearnAnchor.department(shelf.department.slug))
                }
            }
        }
        .sheet(item: $playing) { location in
            let queue = shelves.first { $0.department.id == location.department.id }?.videos ?? [location]
            LearnVideoPlayerSheet(start: location, queue: queue) { lessonID in
                playing = nil
                openLesson(lessonID)
            }
        }
        // A link, a search or a tab switch takes the window elsewhere: the player closes (and
        // stops) rather than playing on over a screen it doesn't belong to.
        .closesOnNavigation($playing)
    }

    /// "Open the lesson" from the player: onto this screen's own tab, the one the person was
    /// watching from, never whichever tab happens to be selected.
    private func openLesson(_ lessonID: UUID) {
        if let navigation, let tab {
            navigation.push(.lesson(lessonID), in: tab)
        } else {
            model.push(.lesson(lessonID))
        }
    }

    // MARK: Masthead

    private func masthead(total: Int, shelves: [(department: Department, videos: [LessonLocation])],
                          layout: LearnLayout, proxy: ScrollViewProxy, chips: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("the videos")
            Text("Every lesson video, in course order.")
                .lfTitle(.h1)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
            LearnLede("\(LearnFormat.plural(total, "narrated video", "narrated videos")) so far, grouped by department, with more added every week. Each one is the video version of a lesson, so you can play them in order to teach a group.")
                .padding(.top, 16)

            if !connectivity.isOnline {
                LearnNotice(kicker: "offline",
                            message: "Videos need a connection. The lessons themselves are saved on this device and work offline.")
                    .padding(.top, 20)
            }

            if chips, shelves.count > 1 {
                jumpChips(shelves, proxy: proxy)
                    .padding(.top, 22)
            }
        }
    }

    /// A chip for each department, jumping to its shelf.
    private func jumpChips(_ shelves: [(department: Department, videos: [LessonLocation])], proxy: ScrollViewProxy) -> some View {
        LearnFlowLayout(spacing: 8, lineSpacing: 4) {
            ForEach(shelves, id: \.department.id) { shelf in
                Button {
                    LF.Motion.perform(LF.Motion.settle) {
                        proxy.scrollTo(LearnAnchor.department(shelf.department.slug), anchor: .top)
                    }
                } label: {
                    LearnFittingTag(text: "\(shelf.department.name)  \(shelf.videos.count)")
                        .frame(minHeight: LF.Metrics.tap)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Jump to \(shelf.department.name)")
                .accessibilityValue(LearnFormat.plural(shelf.videos.count, "video", "videos"))
            }
        }
    }

    // MARK: A department's shelf

    private func shelfSection(_ department: Department, videos: [LessonLocation], layout: LearnLayout) -> some View {
        let columns = layout.contentWidth >= 1000 ? 3 : (layout.contentWidth >= 560 ? 2 : 1)
        let pages = layout.pages
        return VStack(alignment: .leading, spacing: 0) {
            // The count beside the name; under it at the accessibility sizes, where beside
            // it left the name a column too narrow for its words.
            let name = LearnWholeWords(text: department.name) { string in
                Text(string)
                    .lfTitle(.h2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            let count = SlugText(LearnFormat.plural(videos.count, "video", "videos"))
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 6) {
                        name
                        count
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 16) {
                        name.frame(maxWidth: .infinity, alignment: .leading)
                        count.fixedSize()
                    }
                }
            }
            .padding(.bottom, 10)
            .frame(maxWidth: pages?.leading ?? .infinity, alignment: .leading)

            if let pages {
                // iPhone Duo's two pages: a video on each page, row by row.
                LearnSpreadRule(pages: pages)
                LearnFoldColumns(pages: pages, fill: .rows, spacing: 34) {
                    ForEach(Array(videos.enumerated()), id: \.element.id) { index, location in
                        LearnVideoTile(location: location, number: index + 1) {
                            playing = location
                        }
                    }
                }
                .padding(.top, 24)
            } else {
                InkRule()
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 26, alignment: .top), count: columns),
                          alignment: .leading, spacing: 34) {
                    ForEach(Array(videos.enumerated()), id: \.element.id) { index, location in
                        LearnVideoTile(location: location, number: index + 1) {
                            playing = location
                        }
                    }
                }
                .padding(.top, 24)
            }
        }
    }
}

// MARK: - A video tile

/// The poster, the module it belongs to, the title, and the way into the lesson.
struct LearnVideoTile: View {
    let location: LessonLocation
    let number: Int
    let play: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: play) {
                NotebookCard(lift: true, padding: 7) {
                    LearnVideoPoster(location: location)
                }
            }
            .buttonStyle(.notebookCard)
            .accessibilityLabel("Play \(location.lesson.title)")
            .accessibilityHint("Opens the video player")

            // The module's whole name: two lines cut it off at the larger text sizes.
            LearnWholeWordSlug(text: "\(number). \(location.module.title)")
                .padding(.top, 14)
            LearnWholeWords(text: location.lesson.title) { string in
                Text(string)
                    .font(LF.Fonts.display(18, relativeTo: .headline))
                    .tracking(-0.4)
                    .foregroundStyle(LF.Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 5)
            .accessibilityAddTraits(.isHeader)
            NavigationLink(value: AppRoute.lesson(location.lesson.id)) {
                LearnLinkLabel(title: "Open the lesson")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open the lesson: \(location.lesson.title)")
        }
    }
}

/// A 16:9 poster from YouTube's thumbnail, with the drawn "watch" button over it.
/// Offline, a plain paper card with the title stands in.
struct LearnVideoPoster: View {
    let location: LessonLocation

    var body: some View {
        Color.clear
            .aspectRatio(16 / 9, contentMode: .fit)
            .overlay {
                AsyncImage(url: location.lesson.thumbnailURL, transaction: Transaction(animation: nil)) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        ZStack {
                            LF.Palette.paper
                            Image(systemName: "play.rectangle")
                                .font(.title.weight(.regular))
                                .foregroundStyle(LF.Palette.graphite)
                        }
                    }
                }
            }
            .clipShape(HandShape(.s))
            .overlay {
                HStack(spacing: 7) {
                    Image(systemName: "play.fill")
                        .font(.caption.weight(.bold))
                    Text("watch")
                        .font(LF.Fonts.mono(13, weight: .bold, relativeTo: .footnote))
                }
                .foregroundStyle(LF.Palette.onBlue)
                .padding(.vertical, 9)
                .padding(.horizontal, 14)
                .background {
                    ZStack {
                        HandShape(.s).fill(LF.Palette.ink.opacity(0.35)).offset(x: 3, y: 3)
                        HandShape(.s).fill(LF.Palette.blueButton)
                    }
                }
            }
            .accessibilityHidden(true)
    }
}

// MARK: - The player

/// The player, with the rest of the department's videos queued under it. Nothing plays
/// until someone pressed a poster; playback stops when the sheet closes, however it closes
/// (Done, a swipe, or the window navigating elsewhere).
struct LearnVideoPlayerSheet: View {
    let queue: [LessonLocation]
    let onOpenLesson: (UUID) -> Void

    @State private var current: LessonLocation
    @StateObject private var player: YouTubePlayer
    @Environment(\.dismiss) private var dismiss

    init(start: LessonLocation, queue: [LessonLocation], onOpenLesson: @escaping (UUID) -> Void) {
        self.queue = queue
        self.onOpenLesson = onOpenLesson
        _current = State(initialValue: start)
        _player = StateObject(wrappedValue: YouTubePlayer(
            source: .video(id: start.lesson.youtubeID ?? ""),
            parameters: .init(autoPlay: true, showFullscreenButton: true, restrictRelatedVideosToSameChannel: true)
        ))
    }

    private var index: Int { queue.firstIndex { $0.id == current.id } ?? 0 }
    private var next: LessonLocation? { index + 1 < queue.count ? queue[index + 1] : nil }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    NotebookCard(padding: 7) {
                        YouTubePlayerView(player) { state in
                            switch state {
                            case .idle:
                                ZStack {
                                    LF.Palette.paper
                                    ProgressView()
                                }
                            case .ready:
                                EmptyView()
                            case .error:
                                ZStack {
                                    LF.Palette.paper
                                    Text("This video won't play here. Open it on YouTube or try again with a connection.")
                                        .font(LF.Fonts.body(15))
                                        .foregroundStyle(LF.Palette.ink)
                                        .multilineTextAlignment(.center)
                                        .padding()
                                }
                            }
                        }
                        .aspectRatio(16 / 9, contentMode: .fit)
                        .clipShape(HandShape(.s))
                    }

                    SlugText("\(index + 1) of \(queue.count) / dept / \(current.department.slug)")
                        .padding(.top, 22)
                    LearnWholeWords(text: current.lesson.title) { string in
                        Text(string)
                            .lfTitle(.h2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 8)
                    Text(current.module.title)
                        .font(LF.Fonts.body(15.5))
                        .foregroundStyle(LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 6)

                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 12) { actions }
                        VStack(alignment: .leading, spacing: 12) { actions }
                    }
                    .padding(.top, 20)

                    if queue.count > 1 {
                        SectionLabel("in \(current.department.name)")
                            .padding(.top, 34)
                        VStack(spacing: 0) {
                            InkRule()
                            ForEach(Array(queue.enumerated()), id: \.element.id) { offset, location in
                                queueRow(location, number: offset + 1)
                            }
                        }
                        .padding(.top, 14)
                    }
                }
                .frame(maxWidth: 820, alignment: .leading)
                .padding(LF.Metrics.gutter)
                .frame(maxWidth: .infinity)
            }
            .paperBackground()
            .navigationTitle("Videos")
            #if os(iOS)
            .toolbarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 680, idealWidth: 860, minHeight: 620, idealHeight: 820)
        #endif
        .onDisappear {
            // Nothing plays out of sight. The task keeps the player alive until it has stopped.
            let player = player
            Task { try? await player.stop() }
        }
    }

    @ViewBuilder
    private var actions: some View {
        Button("Open the lesson") { onOpenLesson(current.lesson.id) }
            .buttonStyle(.ink)
        if let next {
            Button("Play next") { play(next) }
                .buttonStyle(.inkGhost)
                .accessibilityHint(next.lesson.title)
        }
    }

    private func queueRow(_ location: LessonLocation, number: Int) -> some View {
        let isCurrent = location.id == current.id
        return Button {
            play(location)
        } label: {
            LearnQueueRowLabel(location: location, number: number, isCurrent: isCurrent)
        }
        .buttonStyle(.inkRow)
        .disabled(isCurrent)
        .accessibilityLabel("\(number). \(location.lesson.title)")
        .accessibilityValue(isCurrent ? "Playing" : "")
        .accessibilityHint(isCurrent ? "" : "Plays this video")
    }

    private func play(_ location: LessonLocation) {
        guard let id = location.lesson.youtubeID else { return }
        Haptics.select()
        current = location
        Task {
            try? await player.load(source: .video(id: id))
        }
    }
}

/// One line of the player's queue: number, title, module, and "playing" on the current one.
private struct LearnQueueRowLabel: View {
    let location: LessonLocation
    let number: Int
    let isCurrent: Bool

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// The number's column, as wide as "00" in the slug face at the reader's text size.
    @ScaledMetric(relativeTo: .caption) private var numberWidth: CGFloat = 28

    private var numberText: some View {
        SlugText(LearnFormat.ordinal(number), color: isCurrent ? LF.Palette.blue : LF.Palette.graphite, weight: .bold)
            .fixedSize()
    }

    private var titles: some View {
        VStack(alignment: .leading, spacing: 2) {
            LearnWholeWords(text: location.lesson.title) { string in
                Text(string)
                    .font(LF.Fonts.body(15.5, weight: isCurrent ? .bold : .regular))
                    .foregroundStyle(LF.Palette.ink)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            // The module's whole name: one line cut it short at the larger text sizes.
            LearnWholeWordSlug(text: location.module.title)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var playing: some View {
        SlugText("playing", color: LF.Palette.blue, weight: .bold)
            .fixedSize()
    }

    var body: some View {
        Group {
            // At the accessibility sizes the number and "playing" share a line above the
            // titles, which then get the row's whole width.
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline) {
                        numberText
                        Spacer(minLength: 12)
                        if isCurrent { playing }
                    }
                    titles
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    numberText
                        .frame(minWidth: numberWidth, alignment: .leading)
                    titles
                    if isCurrent { playing }
                }
            }
        }
        .padding(.vertical, 11)
        .overlay(alignment: .leading) {
            if isCurrent {
                Rectangle()
                    .fill(LF.Palette.blue)
                    .frame(width: LF.Metrics.heavyStroke)
                    .offset(x: -10)
            }
        }
        .overlay(alignment: .bottom) {
            DashedRule()
        }
    }
}

// MARK: - Flow layout

/// Chips that wrap onto as many lines as they need.
struct LearnFlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        let lines = arrange(subviews, width: width)
        let height = lines.reduce(0) { $0 + $1.height } + lineSpacing * CGFloat(max(0, lines.count - 1))
        let used = lines.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? used, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for line in arrange(subviews, width: bounds.width) {
            var x = bounds.minX
            for (index, size) in line.items {
                subviews[index].place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += line.height + lineSpacing
        }
    }

    private struct Line {
        var items: [(Int, CGSize)] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [Line] {
        var lines: [Line] = []
        var line = Line()
        for (index, subview) in subviews.enumerated() {
            var size = subview.sizeThatFits(.unspecified)
            if size.width > width {
                // Too wide for a line of its own: measured at the line's width, the way it's
                // placed (a chip that steps its text size down to fit, see `LearnFittingTag`).
                size = subview.sizeThatFits(ProposedViewSize(width: width, height: nil))
                size.width = min(size.width, width)
            }
            let needed = line.items.isEmpty ? size.width : line.width + spacing + size.width
            if needed > width, !line.items.isEmpty {
                lines.append(line)
                line = Line()
            }
            line.width = line.items.isEmpty ? size.width : line.width + spacing + size.width
            line.height = max(line.height, size.height)
            line.items.append((index, size))
        }
        if !line.items.isEmpty { lines.append(line) }
        return lines
    }
}

// MARK: - Previews

#Preview("Videos, iPhone", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { VideosView() }
        .appEnvironment(.preview)
}

#Preview("Videos, iPhone, offline, dark", traits: .fixedLayout(width: 393, height: 1700)) {
    NavigationStack { VideosView() }
        .appEnvironment(.preview(online: false))
        .environment(\.colorScheme, .dark)
}

#Preview("Videos, iPad", traits: .fixedLayout(width: 1180, height: 1300)) {
    NavigationStack { VideosView() }
        .appEnvironment(.preview)
}

#Preview("Videos, iPad, dark", traits: .fixedLayout(width: 834, height: 1200)) {
    NavigationStack { VideosView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#if DEBUG
#Preview("Videos, Duo book, whole page", traits: .fixedLayout(width: 867, height: 2400)) {
    NavigationStack { VideosView() }
        .appEnvironment(.preview)
        .previewFold(.previewFlat)
}
#endif
