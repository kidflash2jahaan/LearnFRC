import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

// Pieces the five community screens share: the page frame, running text, tables,
// figures, invite controls and the states a remote value can be in.

// MARK: - Page frame

/// How wide the page is, so a screen can choose between its phone and wide layouts.
struct CommunityLayout: Equatable, Sendable {
    var width: CGFloat
    /// One of the accessibility text sizes. A side column (the standings card, a profile's
    /// rank stamp) holds a word or two a line there and shrank handles to half size, so
    /// mastheads stay in one column however wide the window is.
    var isLargeText = false

    /// Mastheads split into two columns; podiums stand side by side.
    var isWide: Bool { width >= 760 && !isLargeText }
    /// Tables show their secondary columns (level, members, xp).
    var isRegular: Bool { width >= 540 }
    /// Tables show every column (lessons on the leaderboard).
    var isFull: Bool { width >= 700 }
    var gutter: CGFloat { LF.Metrics.gutter(for: width) }
    /// Section spacing, a little looser on big windows.
    var sectionGap: CGFloat { isWide ? 56 : 40 }
}

/// The scrolling sheet every community screen sits on: paper ruled with the grid, a
/// content column capped like the site's `nb-wrap`, pull to refresh on iPhone and iPad.
struct CommunityPage<Content: View>: View {
    var refresh: (@MainActor () async -> Void)?
    /// Which screen this is, so its scroll position comes back when the Mac builds the tab
    /// again (`remembersScroll`). Nil keeps nothing.
    var place: ScreenPlace?
    @ViewBuilder var content: (CommunityLayout, ScrollViewProxy) -> Content
    @Environment(\.dynamicTypeSize) private var typeSize

    init(refresh: (@MainActor () async -> Void)? = nil,
         place: ScreenPlace? = nil,
         @ViewBuilder content: @escaping (CommunityLayout, ScrollViewProxy) -> Content) {
        self.refresh = refresh
        self.place = place
        self.content = content
    }

    var body: some View {
        // The width is read in the same layout pass, so a wide window never flashes the phone layout.
        GeometryReader { geometry in
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        content(CommunityLayout(width: geometry.size.width, isLargeText: typeSize.isAccessibilitySize), proxy)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 8)
                    .padding(.bottom, 56)
                }
                .remembersScroll(place)
                .refreshable { await refresh?() }
                .paperBackground()
            }
        }
        // Nothing on a community page takes typing, so the keyboard never insets it. On iPad
        // a keyboard inset once outlived its sheet (sign-in) and left a 324pt blank band
        // under the last card of every tab; this keeps these pages out of it.
        #if os(iOS)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        #endif
        .closesShareSheetsOnNavigation()
    }
}

extension View {
    /// One column of page content: capped at the site's 1280pt wrap (or narrower), centred,
    /// with the site's fluid gutter.
    func communityColumn(_ layout: CommunityLayout, maxWidth: CGFloat = LF.Metrics.maxContentWidth) -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, layout.gutter)
            .frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity)
    }

    /// Washes a row blue and bars it in the margin when it's yours, so it's findable
    /// without colour too (the site's `isYou` row).
    func communityOwnRow(_ isYours: Bool) -> some View {
        self
            .padding(.leading, isYours ? 9 : 0)
            .background(alignment: .leading) {
                if isYours {
                    ZStack(alignment: .leading) {
                        LF.Palette.rowWash
                        Rectangle().fill(LF.Palette.blue).frame(width: 3)
                    }
                }
            }
    }
}

// MARK: - Running text

/// The large graphite paragraph under a page title (`nb-lede`).
struct CommunityLede: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lfProse(17.5, lineHeight: 1.5, color: LF.Palette.graphite)
            .frame(maxWidth: 560, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The graphite paragraph under a section heading (`nb-sub`).
struct CommunitySub: View {
    let text: String
    var size: CGFloat
    init(_ text: String, size: CGFloat = 16) {
        self.text = text
        self.size = size
    }

    var body: some View {
        Text(text)
            .lfProse(size, lineHeight: 1.5, color: LF.Palette.graphite)
            .frame(maxWidth: 620, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// A section heading with the graphite line under it and an optional figure or slug
/// on the right (wraps under on narrow widths).
struct CommunitySectionHeader<Trailing: View>: View {
    let title: String
    var sub: String?
    var level: LF.TitleLevel
    @ViewBuilder var trailing: Trailing

    init(_ title: String, sub: String? = nil, level: LF.TitleLevel = .h2, @ViewBuilder trailing: () -> Trailing = { EmptyView() }) {
        self.title = title
        self.sub = sub
        self.level = level
        self.trailing = trailing()
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .bottom, spacing: 24) {
                heading
                Spacer(minLength: 0)
                trailing
            }
            VStack(alignment: .leading, spacing: 12) {
                heading
                trailing
            }
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .lfTitle(level)
                .fixedSize(horizontal: false, vertical: true)
            if let sub { CommunitySub(sub) }
        }
        .frame(maxWidth: 640, alignment: .leading)
    }
}

// MARK: - Tables

/// When a ruled table gives up its columns and prints each row as a short stack of lines:
/// at the accessibility sizes everywhere, and from xxxLarge on a phone-width column, where
/// the fixed figure columns would leave the name a few characters.
enum CommunityTableStyle {
    static func stacks(_ size: DynamicTypeSize, _ layout: CommunityLayout) -> Bool {
        size.isAccessibilitySize || (size >= .xxxLarge && !layout.isRegular)
    }
}

/// The header of a ruled table (`nb-table th`): mono caps-free labels over a 2pt ink rule.
struct CommunityTableHeader<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 12) { content }
            .font(LF.Fonts.mono(12.2, weight: .bold, relativeTo: .caption))
            .tracking(12.2 * 0.05)
            // A column heading is one word: it shrinks a little before it would break mid-word.
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .foregroundStyle(LF.Palette.graphite)
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) { InkRule() }
            .accessibilityHidden(true)
    }
}

/// A right-aligned figure cell in a table: bold mono ink.
struct CommunityFigureCell: View {
    let text: String
    var width: CGFloat
    var bold: Bool
    @ScaledMetric(relativeTo: .caption) private var scale: CGFloat = 1

    init(_ text: String, width: CGFloat, bold: Bool = false) {
        self.text = text
        self.width = width
        self.bold = bold
    }

    var body: some View {
        Text(text)
            .font(LF.Fonts.mono(13, weight: bold ? .bold : .regular, relativeTo: .caption))
            .monospacedDigit()
            .foregroundStyle(LF.Palette.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(width: width * scale, alignment: .trailing)
    }
}

/// The caption printed over a table (`nb-table caption`).
struct CommunityTableCaption: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        SlugText(text).padding(.bottom, 10)
    }
}

// MARK: - People

/// A person's avatar with your own one ringed in blue, so you can find yourself in a stack.
struct CommunityAvatar: View {
    let name: String
    var imageURL: URL?
    var isYou: Bool = false
    var size: CGFloat = 36

    var body: some View {
        InitialsAvatar(name: name, seed: name, imageURL: imageURL, size: size)
            .overlay {
                if isYou {
                    Circle().strokeBorder(LF.Palette.blue, lineWidth: LF.Metrics.stroke)
                }
            }
    }
}

/// Overlapping avatars, then "+3" when there are more than fit. A picture of a group:
/// hidden from VoiceOver, because the same people are listed by name nearby.
struct CommunityAvatarStack: View {
    struct Person: Hashable {
        let name: String
        var imageURL: URL?
        var isYou: Bool
    }

    let people: [Person]
    var total: Int
    var limit: Int
    var size: CGFloat

    init(_ people: [Person], total: Int? = nil, limit: Int = 6, size: CGFloat = 44) {
        self.people = people
        self.total = total ?? people.count
        self.limit = limit
        self.size = size
    }

    var body: some View {
        let shown = Array(people.prefix(limit))
        let overflow = max(0, total - shown.count)
        HStack(spacing: -size * 0.24) {
            ForEach(Array(shown.enumerated()), id: \.offset) { index, person in
                CommunityAvatar(name: person.name, imageURL: person.imageURL, isYou: person.isYou, size: size)
                    .zIndex(Double(shown.count - index))
            }
            if overflow > 0 {
                Text("+\(overflow)")
                    .font(LF.Fonts.mono(size * 0.28, weight: .bold, relativeTo: .caption))
                    .foregroundStyle(LF.Palette.ink)
                    .frame(width: size, height: size)
                    .background(Circle().fill(LF.Palette.card))
                    .overlay(Circle().strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke))
            }
        }
        // The "+3" chip sits in the same fixed circle as the initials.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .accessibilityHidden(true)
    }
}

// MARK: - Figures

/// A row of figures ruled across the page (the team tally): two columns on a phone,
/// all of them across on wider windows, dashed rules between.
struct CommunityTally: View {
    struct Item: Hashable {
        let figure: String
        let label: String
    }

    let items: [Item]
    var layout: CommunityLayout

    @Environment(\.dynamicTypeSize) private var typeSize

    /// At the accessibility sizes a phone gets one figure per row (two on wider windows),
    /// so a caption like "subteams claimed" never breaks mid-word.
    private var columns: Int {
        if typeSize.isAccessibilitySize { return layout.isRegular ? 2 : 1 }
        return layout.isRegular ? items.count : 2
    }

    var body: some View {
        let columns = columns
        Grid(alignment: .topLeading, horizontalSpacing: 0, verticalSpacing: 22) {
            ForEach(Array(stride(from: 0, to: items.count, by: columns)), id: \.self) { start in
                GridRow {
                    ForEach(start..<min(start + columns, items.count), id: \.self) { index in
                        cell(items[index], leadingRule: index % columns != 0)
                    }
                }
            }
        }
        .padding(.top, 18)
        .overlay(alignment: .top) { InkRule() }
    }

    private func cell(_ item: Item, leadingRule: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.figure)
                .font(LF.Fonts.mono(layout.isWide ? 34 : 28, weight: .bold, relativeTo: .title))
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            SlugText(item.label)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, leadingRule ? (layout.isWide ? 24 : 16) : 0)
        .padding(.trailing, 8)
        .overlay(alignment: .leading) {
            if leadingRule {
                CommunityDashedVRule().frame(width: 1)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// A 1pt dashed vertical hairline.
struct CommunityDashedVRule: View {
    var body: some View {
        GeometryReader { proxy in
            Path { p in
                p.move(to: CGPoint(x: 0.5, y: 0))
                p.addLine(to: CGPoint(x: 0.5, y: proxy.size.height))
            }
            .stroke(LF.Palette.rule, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
        }
        .accessibilityHidden(true)
    }
}

/// The big figures on the blue band (`nb-stamp`): an oversized mono figure over a caption
/// under a thin rule. They land once, together, like a total being stamped.
struct CommunitySlabFigure: View {
    let figure: String
    let caption: String
    var size: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var landed = false

    init(_ figure: String, caption: String, size: CGFloat = 44) {
        self.figure = figure
        self.caption = caption
        self.size = size
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(figure)
                .font(LF.Fonts.mono(size, weight: .bold, relativeTo: .largeTitle))
                .tracking(size * -0.04)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .scaleEffect(landed || reduceMotion ? 1 : SiteTokens.Movement.inkScale, anchor: .bottomLeading)
                .offset(y: landed || reduceMotion ? 0 : SiteTokens.Movement.inkDrop)
            Text(caption)
                .font(LF.Fonts.mono(12.8, relativeTo: .caption))
                .opacity(0.85)
                .padding(.top, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) {
                    Rectangle().fill(LF.Palette.onBlue.opacity(0.4)).frame(height: 1)
                }
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(LF.Palette.onBlue)
        .accessibilityElement(children: .combine)
        .onAppear {
            guard !landed else { return }
            if reduceMotion { landed = true } else { withAnimation(LF.Motion.stamp) { landed = true } }
        }
    }
}

// MARK: - States

/// A note in the margin for "nothing here yet" (`nb-note` with a slug).
struct CommunityEmptyNote<Footer: View>: View {
    let slug: String
    let text: String
    @ViewBuilder var footer: Footer

    init(_ slug: String, _ text: String, @ViewBuilder footer: () -> Footer = { EmptyView() }) {
        self.slug = slug
        self.text = text
        self.footer = footer()
    }

    var body: some View {
        NoteCallout {
            SlugText(slug)
            Text(text)
                .lfProse(16, lineHeight: 1.45)
                .fixedSize(horizontal: false, vertical: true)
            footer.padding(.top, 6)
        }
        .frame(maxWidth: 740, alignment: .leading)
    }
}

/// What to say when a fetch fails: the site's sentence, plus a way to try again. With a
/// saved copy on screen it's one quiet line; with nothing to show it's a note.
struct CommunityLoadNote<Value: Sendable>: View {
    let state: CommunityLoad<Value>
    var retry: () -> Void

    var body: some View {
        if let error = state.error {
            if state.hasValue {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: "wifi.slash")
                        .font(.footnote)
                        .foregroundStyle(LF.Palette.graphite)
                        .accessibilityHidden(true)
                    Text(staleLine(error))
                        .font(LF.Fonts.mono(12, relativeTo: .caption))
                        .foregroundStyle(LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 0)
                    Button("Try again", action: retry)
                        .buttonStyle(.inkGhostSmall)
                }
                .accessibilityElement(children: .combine)
            } else {
                NoteCallout {
                    SlugText("couldn't load")
                    Text(error.message)
                        .lfProse(16, lineHeight: 1.45)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Try again", action: retry)
                        .buttonStyle(.inkGhostSmall)
                        .padding(.top, 6)
                }
                .frame(maxWidth: 740, alignment: .leading)
            }
        }
    }

    private func staleLine(_ error: APIError) -> String {
        let when = state.fetchedAt.map { CommunityFormat.updated($0) } ?? "saved earlier"
        switch error {
        case .network: return "Offline. Showing the copy \(when)."
        default: return "Couldn't refresh. Showing the copy \(when)."
        }
    }
}

/// A taped card that asks a guest to sign in, for screens that only make sense with an account.
struct CommunitySignInCard: View {
    let slug: String
    let title: String
    let message: String
    var buttonTitle = "Sign in or make an account"

    @Environment(AppModel.self) private var app

    var body: some View {
        NotebookCard(tilt: .preset(1), tape: true, padding: 24) {
            SlugText(slug)
            Text(title)
                .lfTitle(.h2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            CommunityLede(message)
                .padding(.top, 14)
            Button(buttonTitle) { app.selectedTab = .profile }
                .buttonStyle(.ink)
                .padding(.top, 22)
        }
        .frame(maxWidth: 700, alignment: .leading)
    }
}

// MARK: - Invite controls

/// The invite link written out in mono, with a copy button. Shown in full so it can be read
/// off a screen and typed onto a whiteboard.
struct CommunityCopyLink: View {
    let url: URL
    var label: String = "Invite link"

    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var copied = false
    @State private var resetTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            FieldLabel(label.lowercased())
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) {
                    linkText
                    copyButton
                }
                VStack(alignment: .leading, spacing: 10) {
                    linkText
                    copyButton
                }
            }
        }
        .sensoryFeedback(.success, trigger: copied) { _, new in new }
        // "Copied" is about this link; a reused view showing another one starts fresh.
        .onChange(of: url) {
            resetTask?.cancel()
            copied = false
        }
    }

    private var linkText: some View {
        Text(CommunityInviteLink.display(url))
            .font(LF.Fonts.mono(13, relativeTo: .footnote))
            .foregroundStyle(LF.Palette.ink)
            .textSelection(.enabled)
            // Two lines, cut in the middle, at the standard sizes; the whole link at the
            // accessibility sizes, where two lines hold only a few characters.
            .lineLimit(typeSize.isAccessibilitySize ? nil : 2)
            .truncationMode(.middle)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.vertical, 10)
            .padding(.horizontal, 13.6)
            .frame(maxWidth: .infinity, minHeight: LF.Metrics.tap, alignment: .leading)
            .background {
                ZStack {
                    HandShape(.s).fill(LF.Palette.paper)
                    HandShape(.s).strokeBorder(LF.Palette.rule, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                }
            }
            .accessibilityLabel("\(label): \(CommunityInviteLink.display(url))")
    }

    private var copyButton: some View {
        Button {
            copy()
        } label: {
            Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                .frame(minWidth: 84)
        }
        .buttonStyle(.inkGhostSmall)
        .accessibilityLabel(copied ? "Copied" : "Copy \(label.lowercased())")
    }

    private func copy() {
        #if canImport(UIKit)
        UIPasteboard.general.url = url
        #elseif canImport(AppKit)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(url.absoluteString, forType: .string)
        #endif
        copied = true
        AccessibilityNotification.Announcement("Link copied").post()
        resetTask?.cancel()
        resetTask = Task {
            try? await Task.sleep(for: .seconds(2))
            if !Task.isCancelled { copied = false }
        }
    }
}

/// A QR code for the invite link, black on a white plate (what a scanner needs), taped to
/// the card. The notebook treatment is the tape and the frame, never the code.
struct CommunityQRCode: View {
    let url: URL
    var size: CGFloat = 168

    @State private var image: CGImage?

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Color.white
                if let image {
                    Image(decorative: image, scale: 1)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .padding(10)
                }
            }
            .frame(width: size, height: size)
            .clipShape(HandShape(.s))
            .overlay { HandShape(.s).strokeBorder(LF.Palette.ink, lineWidth: LF.Metrics.stroke) }
            .background {
                HandShape(.s).fill(LF.Shadow.card.color).offset(x: LF.Shadow.card.x, y: LF.Shadow.card.y)
            }
            .overlay(alignment: .top) {
                TapeStrip(angle: 3.4, width: 64, height: 18).offset(x: -24, y: -10)
            }
            .communityTilt(1.1)
            SlugText("scan to join")
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("QR code for \(CommunityInviteLink.display(url))")
        .accessibilityAddTraits(.isImage)
        .task(id: url) { image = Self.render(url.absoluteString) }
    }

    nonisolated static func render(_ text: String) -> CGImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        return CIContext(options: [.useSoftwareRenderer: false]).createCGImage(scaled, from: scaled.extent)
    }
}

// MARK: - Shared helpers

extension View {
    /// The inline toolbar title used on every pushed community screen: the h1 lives in content.
    func communityNavigationTitle(_ title: String) -> some View {
        self
            .navigationTitle(title)
            #if os(iOS)
            .toolbarTitleDisplayMode(.inline)
            #endif
    }

    /// On the Mac (no pull to refresh there): a refresh toolbar button, and View > Refresh
    /// (⌘R, which belongs to the menu) reloads this screen too while it's on screen.
    /// Nothing extra on iPhone and iPad, where the page pulls to refresh.
    func communityRefreshButton(isLoading: Bool, action: @escaping () -> Void) -> some View {
        modifier(CommunityRefreshControl(isLoading: isLoading, action: action))
    }

    /// The one inverted surface on a page (the site's blue band): `blueButton` from edge to
    /// edge of the page, ruled in ink top and bottom. Kept to the page's own column, like the
    /// Learn wall's band (`learnBand`): a colour background reaches into the safe area, which
    /// on iPad and Mac put the band under the glass sidebar as a blurred glow with a hard top
    /// and bottom. Clipped, it runs edge to edge of the page and stops at the sidebar.
    func communityBand() -> some View {
        self
            .background {
                VStack(spacing: 0) {
                    InkRule()
                    LF.Palette.blueButton
                    InkRule()
                }
            }
            .clipped()
    }

    /// A resting tilt on a small piece of paper, flat under Reduce Motion (like `NotebookCard`).
    func communityTilt(_ degrees: Double) -> some View {
        modifier(CommunityTilt(degrees: degrees))
    }
}

private struct CommunityRefreshControl: ViewModifier {
    let isLoading: Bool
    let action: () -> Void

    #if os(macOS)
    @Environment(AppModel.self) private var app
    @State private var isOnScreen = false
    #endif

    func body(content: Content) -> some View {
        #if os(macOS)
        content
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: action) {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .disabled(isLoading || !app.connectivity.isOnline)
                    .help("Refresh (Command-R)")
                }
            }
            .onAppear { isOnScreen = true }
            .onDisappear { isOnScreen = false }
            .onChange(of: app.isRefreshingAll) { _, refreshing in
                if refreshing, isOnScreen, !isLoading { action() }
            }
        #else
        content
        #endif
    }
}

private struct CommunityTilt: ViewModifier {
    let degrees: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.rotationEffect(.degrees(reduceMotion ? 0 : degrees))
    }
}

/// Words the community screens share.
enum CommunityCopy {
    /// How to ask for a fresh copy on this device.
    static var refreshHint: String {
        #if os(macOS)
        "Press Command-R"
        #else
        "Pull to refresh"
        #endif
    }

    /// The same, mid-sentence ("Connect, then press Command-R.").
    static var refreshHintInSentence: String {
        #if os(macOS)
        "press Command-R"
        #else
        "pull to refresh"
        #endif
    }
}
