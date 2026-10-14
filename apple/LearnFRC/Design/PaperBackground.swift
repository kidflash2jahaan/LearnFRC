import SwiftUI

/// The page ground: paper colour ruled with the site's 23pt graph grid in faint ballpoint blue.
///
/// The ruling scrolls with the content, like the website's `body` background. Easiest is the
/// modifier on a scroll view, which tracks its offset for you:
///
///     ScrollView { ... }.paperBackground()
///
/// Or place it yourself with an explicit `offset` (the content offset of whatever scrolls).
struct PaperBackground: View {
    /// How far the content has scrolled, so the ruling moves with it.
    var offset: CGPoint = .zero
    /// Draw the graph ruling. Plain paper is right behind dense UI such as a form sheet.
    var ruled: Bool = true

    @Environment(\.displayScale) private var displayScale

    var body: some View {
        Canvas(opaque: true, rendersAsynchronously: false) { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(LF.Palette.paper))
            guard ruled else { return }
            let step = LF.Metrics.gridStep
            let pixel = 1 / max(displayScale, 1)
            func phase(_ value: CGFloat) -> CGFloat {
                let p = (-value).truncatingRemainder(dividingBy: step)
                let wrapped = p > 0 ? p - step : p
                return (wrapped / pixel).rounded() * pixel   // keep the 1pt rules on whole pixels
            }
            var grid = Path()
            var x = phase(offset.x)
            while x <= size.width {
                grid.addRect(CGRect(x: x, y: 0, width: 1, height: size.height))
                x += step
            }
            var y = phase(offset.y)
            while y <= size.height {
                grid.addRect(CGRect(x: 0, y: y, width: size.width, height: 1))
                y += step
            }
            context.fill(grid, with: .color(LF.Palette.grid))
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

extension View {
    /// Puts the paper ground behind this view, edge to edge under the bars. Applied to a
    /// `ScrollView` or `List`, the ruling scrolls with the content and the list's own
    /// background is hidden.
    func paperBackground(ruled: Bool = true) -> some View {
        modifier(PaperBackgroundModifier(ruled: ruled))
    }
}

private struct PaperBackgroundModifier: ViewModifier {
    let ruled: Bool
    @State private var offset: CGPoint = .zero

    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .onScrollGeometryChange(for: CGPoint.self) { geometry in
                CGPoint(x: geometry.contentOffset.x + geometry.contentInsets.leading,
                        y: geometry.contentOffset.y + geometry.contentInsets.top)
            } action: { _, new in
                offset = new
            }
            .background {
                PaperBackground(offset: offset, ruled: ruled)
            }
    }
}

/// A torn strip of kraft packing tape holding a card down. Decoration only: put it over a
/// card's edge, never under text, and vary the angle so no two on a screen match.
/// Lies flat under Reduce Motion, like the site.
struct TapeStrip: View {
    var angle: Double = -3.4
    var width: CGFloat = SiteTokens.Tape.width
    var height: CGFloat = SiteTokens.Tape.height

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(angle: Double = -3.4, width: CGFloat = SiteTokens.Tape.width, height: CGFloat = SiteTokens.Tape.height) {
        self.angle = angle
        self.width = width
        self.height = height
    }

    var body: some View {
        TapeShape()
            .fill(LF.Palette.kraft)
            .opacity(SiteTokens.Tape.opacity)
            .frame(width: width, height: height)
            .rotationEffect(.degrees(reduceMotion ? 0 : angle))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    /// The homepage wall's hand-placed tape angles; index into it so neighbours differ.
    static let angles: [Double] = [-3.4, 2.6, -3.6, 2.8, -1.2, 2.4, -4, 1.4, -3.2, 3.8]

    static func angle(for index: Int) -> Double {
        angles[((index % angles.count) + angles.count) % angles.count]
    }
}

#Preview("Paper and tape", traits: .fixedLayout(width: 393, height: 300)) {
    ZStack {
        Color.clear.frame(width: 260, height: 140).notebookBox()
            .overlay(alignment: .topLeading) { TapeStrip().offset(x: 18, y: -12) }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .paperBackground()
}
