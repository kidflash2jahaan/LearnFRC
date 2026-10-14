import SwiftUI
import Observation

/// Where the reader is on the lesson sheet, updated as it scrolls.
///
/// Kept in its own observable object so only the small views that read a value redraw on
/// scroll (the margin's pen line, the sticky margin, the floating bar, the bar title),
/// never the lesson body. Flags are assigned only when they flip.
@Observable
@MainActor
final class LessonScrollMetrics {
    /// The coordinate space name of the scrolled content.
    nonisolated static let space = "lesson-sheet"

    /// How far the content has scrolled from its resting position.
    private(set) var scrolledY: CGFloat = 0
    /// The scroll view's visible height between its bars.
    private(set) var visibleHeight: CGFloat = 0
    /// 0...1, how far down the sheet the reader has got (the margin's pen line).
    private(set) var readFraction: CGFloat = 0

    /// Past the first screen of the sheet (the site's 720px), so the floating bar may show.
    private(set) var isPastOpening = false
    /// The reader has reached the quiz or sign-off card: its top is on screen, or above it.
    /// The floating bar is a shortcut to that card, so from here down it stays away, off the
    /// card itself and off the guest's ask, the pagination and the contents under it.
    private(set) var hasReachedQuiz = false
    /// The lesson's title has scrolled under the bar, so the bar shows it instead.
    private(set) var showsBarTitle = false

    /// Bottom of the title in content coordinates.
    @ObservationIgnored private var titleBottom: CGFloat = .greatestFiniteMagnitude
    /// The quiz card's frame in content coordinates.
    @ObservationIgnored private var quizFrame: CGRect = .null
    @ObservationIgnored private var contentHeight: CGFloat = 0
    /// From the top bar down to the scroll view's bottom edge, under the floating bar and the
    /// tab bar too. Unlike `visibleHeight` it doesn't change when the floating bar comes and goes.
    @ObservationIgnored private var screenHeight: CGFloat = 0

    /// The site shows its floating bar after this much scrolling.
    static let openingDistance: CGFloat = 720

    struct Geometry: Equatable, Sendable {
        var scrolledY: CGFloat
        var visibleHeight: CGFloat
        var screenHeight: CGFloat
        var contentHeight: CGFloat

        init(_ geometry: ScrollGeometry) {
            scrolledY = geometry.contentOffset.y + geometry.contentInsets.top
            // `containerSize` is already the scroll view less its insets: the part between the
            // top bar and whatever floats at the bottom (the floating bar, the tab bar).
            visibleHeight = max(0, geometry.containerSize.height)
            screenHeight = max(0, geometry.containerSize.height + geometry.contentInsets.bottom)
            contentHeight = geometry.contentSize.height
        }
    }

    func update(_ geometry: Geometry) {
        set(\.scrolledY, geometry.scrolledY)
        set(\.visibleHeight, geometry.visibleHeight)
        screenHeight = geometry.screenHeight
        contentHeight = geometry.contentHeight
        let travel = max(1, geometry.contentHeight - geometry.visibleHeight)
        set(\.readFraction, min(1, max(0, geometry.scrolledY / travel)))
        recompute()
    }

    func setTitleBottom(_ y: CGFloat) {
        titleBottom = y
        recompute()
    }

    func setQuizFrame(_ frame: CGRect) {
        quizFrame = frame
        recompute()
    }

    /// Back to the top (a different lesson opened in place).
    func reset() {
        scrolledY = 0
        readFraction = 0
        isPastOpening = false
        hasReachedQuiz = false
        showsBarTitle = false
        titleBottom = .greatestFiniteMagnitude
        quizFrame = .null
    }

    private func recompute() {
        set(\.isPastOpening, scrolledY > Self.openingDistance)
        set(\.showsBarTitle, scrolledY > titleBottom - 8)
        if quizFrame.isNull || screenHeight == 0 {
            set(\.hasReachedQuiz, false)
        } else {
            // As soon as the card's top comes up past the bottom edge (under the tab bar, still
            // below the floating bar), so the bar is gone before the card could reach it. Worked
            // out from the scroll position alone, never from the bar's own height, so the bar
            // coming or going can't flip it back.
            set(\.hasReachedQuiz, quizFrame.minY < scrolledY + screenHeight)
        }
    }

    private func set<Value: Equatable>(_ keyPath: ReferenceWritableKeyPath<LessonScrollMetrics, Value>, _ value: Value) {
        if self[keyPath: keyPath] != value { self[keyPath: keyPath] = value }
    }

    #if DEBUG
    /// Previews: a reader partway down a long sheet, so the floating bar and the bar title show.
    static func scrolledForPreview() -> LessonScrollMetrics {
        let metrics = LessonScrollMetrics()
        metrics.scrolledY = Self.openingDistance + 400
        metrics.visibleHeight = 700
        metrics.titleBottom = 200
        metrics.recompute()
        return metrics
    }
    #endif
}

// MARK: - The sticky margin

/// A column that stays in view while the sheet beside it scrolls, like the website's
/// `position: sticky` margin rail: pinned under the bar when it fits, and when it's taller
/// than the window it scrolls until its foot is in view and then pins there. It never leaves
/// the row it belongs to. Input-driven, so there's nothing to animate or to turn off.
///
/// The row sizes itself from this column's own height in the same layout pass
/// (`LessonColumnsLayout`); the measurements kept here only move the column with an offset,
/// which never changes anyone's layout.
struct LessonStickyColumn<Content: View>: View {
    let metrics: LessonScrollMetrics
    @ViewBuilder var content: Content

    @State private var slot: CGRect = .zero
    @State private var height: CGFloat = 0

    private static var margin: CGFloat { 20 }

    var body: some View {
        content
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
            .offset(y: pin)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .named(LessonScrollMetrics.space))
            } action: { new in
                slot = new
            }
    }

    private var pin: CGFloat {
        let travel = max(0, slot.height - height)
        guard travel > 0, metrics.visibleHeight > 0 else { return 0 }
        let top = metrics.scrolledY + Self.margin
        let bottom = metrics.scrolledY + metrics.visibleHeight - Self.margin
        let desired = height <= bottom - top
            ? top - slot.minY
            : bottom - (slot.minY + height)
        return min(max(0, desired), travel)
    }
}

// MARK: - The bar title

/// The lesson title in the navigation bar, shown only once the big title on the sheet has
/// scrolled under it (iPhone and iPad). Two titles on screen at once would be one too many.
/// On a phone the title gets two lines and no crumb, so it reads in full beside the bar's
/// buttons instead of stopping at "What Is…".
struct LessonBarTitle: View {
    let metrics: LessonScrollMetrics
    let title: String
    let crumb: String
    /// A phone (compact width): two lines of title, no crumb.
    var compact = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 1) {
            Text(title)
                .font(LF.Fonts.body(compact ? 14 : 15, weight: .bold, relativeTo: .headline))
                .foregroundStyle(LF.Palette.ink)
                .lineLimit(compact ? 2 : 1)
                .multilineTextAlignment(.center)
            if !compact {
                Text(crumb)
                    .font(LF.Fonts.mono(11, relativeTo: .caption2))
                    .foregroundStyle(LF.Palette.graphite)
                    .lineLimit(1)
            }
        }
        .truncationMode(.tail)
        // The bar sizes its items from their ideal size, which for text is one long line.
        // Offering the phone title a set width makes its ideal size the wrapped two lines.
        .frame(idealWidth: compact ? 240 : nil)
        .minimumScaleFactor(0.9)
        // Bar text stops growing where the system's own bar titles do; the sheet's title keeps scaling.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .opacity(metrics.showsBarTitle ? 1 : 0)
        .animation(reduceMotion ? nil : LF.Motion.hover, value: metrics.showsBarTitle)
        .accessibilityHidden(!metrics.showsBarTitle)
        .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - The margin's pen line

/// The margin rule beside "on this page", overprinted in ballpoint as far as the reader has
/// got down the sheet (the site's `.nb-progress-y`). Decorative: the headings say the same.
struct LessonPenLine: View {
    let metrics: LessonScrollMetrics

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                Rectangle().fill(LF.Palette.ink)
                Rectangle()
                    .fill(LF.Palette.blue)
                    .frame(height: proxy.size.height * metrics.readFraction)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
        }
        .frame(width: 2)
        .accessibilityHidden(true)
    }
}

/// Bringing a rebuilt lesson page back to where it was left (`LessonView.resumeScroll`).
/// A plain class kept in `@State` and never observed: the scroll view writes into it on every
/// change, so nothing here may redraw the page.
@MainActor
final class LessonResume {
    /// The lesson whose page has already been brought back (once per page).
    var handled: UUID?
    /// True from finding a kept position until the page has scrolled to it: the page's
    /// opening position mustn't overwrite the one being returned to.
    var isPending = false
    /// How far the page can scroll right now, from the scroll geometry.
    var maxOffset: CGFloat = 0
}

/// A one-point marker at `y` points down the lesson sheet, where the page was left, for
/// `ScrollViewReader` to scroll to (`LessonView.resumeAnchor`). Its own view beside the sheet,
/// not an id on the sheet's content, so the reader always finds it.
struct LessonResumeAnchor: View {
    let y: CGFloat?

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .id(LessonView.resumeAnchor)
            .padding(.top, max(0, y ?? 0))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
