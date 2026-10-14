import SwiftUI

/// The hand-ruled box: a rounded rectangle whose four corners are deliberately uneven
/// ellipses, so its edges bow slightly like a line drawn freehand.
///
/// It is the site's `border-radius: var(--hand-a)` (and `-b`, `-s`) reproduced exactly,
/// including CSS's corner-overlap rule: the oversized radii are scaled down together until
/// adjacent corners fit, so the shape depends on the box's proportions the same way it does
/// in the browser.
///
/// - `.a`: the box outline (cards).
/// - `.b`: the inner hairline drawn inside `.a`, at a different radius. Two radii on one box
///   is what sells the hand-drawn look.
/// - `.s`: small controls (buttons, tags, inputs, meters, chips).
nonisolated struct HandShape: InsettableShape {
    enum Size: Sendable, Hashable, CaseIterable {
        case a, b, s

        var radii: SiteTokens.HandRadii {
            switch self {
            case .a: SiteTokens.Hand.a
            case .b: SiteTokens.Hand.b
            case .s: SiteTokens.Hand.s
            }
        }
    }

    var size: Size
    var insetAmount: CGFloat = 0

    init(_ size: Size = .a) {
        self.size = size
    }

    func inset(by amount: CGFloat) -> HandShape {
        var shape = self
        shape.insetAmount += amount
        return shape
    }

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: insetAmount, dy: insetAmount)
        guard r.width > 0, r.height > 0 else { return Path() }
        let radii = size.radii
        var tl = radii.topLeft, tr = radii.topRight, br = radii.bottomRight, bl = radii.bottomLeft

        // CSS Backgrounds 3, "corner overlap": one factor for all radii.
        let f = min(1,
                    r.width / (tl.h + tr.h),
                    r.width / (bl.h + br.h),
                    r.height / (tl.v + bl.v),
                    r.height / (tr.v + br.v))
        func scaled(_ c: SiteTokens.Corner) -> SiteTokens.Corner { .init(h: c.h * f, v: c.v * f) }
        tl = scaled(tl); tr = scaled(tr); br = scaled(br); bl = scaled(bl)

        // Cubic approximation of a quarter ellipse.
        let k: CGFloat = 0.5522847498
        var p = Path()
        p.move(to: CGPoint(x: r.minX + tl.h, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX - tr.h, y: r.minY))
        p.addCurve(to: CGPoint(x: r.maxX, y: r.minY + tr.v),
                   control1: CGPoint(x: r.maxX - tr.h * (1 - k), y: r.minY),
                   control2: CGPoint(x: r.maxX, y: r.minY + tr.v * (1 - k)))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - br.v))
        p.addCurve(to: CGPoint(x: r.maxX - br.h, y: r.maxY),
                   control1: CGPoint(x: r.maxX, y: r.maxY - br.v * (1 - k)),
                   control2: CGPoint(x: r.maxX - br.h * (1 - k), y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX + bl.h, y: r.maxY))
        p.addCurve(to: CGPoint(x: r.minX, y: r.maxY - bl.v),
                   control1: CGPoint(x: r.minX + bl.h * (1 - k), y: r.maxY),
                   control2: CGPoint(x: r.minX, y: r.maxY - bl.v * (1 - k)))
        p.addLine(to: CGPoint(x: r.minX, y: r.minY + tl.v))
        p.addCurve(to: CGPoint(x: r.minX + tl.h, y: r.minY),
                   control1: CGPoint(x: r.minX, y: r.minY + tl.v * (1 - k)),
                   control2: CGPoint(x: r.minX + tl.h * (1 - k), y: r.minY))
        p.closeSubpath()
        return p
    }
}

/// The torn strip of kraft tape (`.nb-tape`'s clip-path polygon).
nonisolated struct TapeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.addLines(SiteTokens.Tape.polygon.map {
            CGPoint(x: rect.minX + $0.x * rect.width, y: rect.minY + $0.y * rect.height)
        })
        p.closeSubpath()
        return p
    }
}

// MARK: - The box

extension View {
    /// The hand-ruled index card behind this view: card stock, a 2pt ink border at the
    /// hand radius, the inner 1pt hairline at a different radius (for `.a`), and an
    /// optional hard offset drop. Padding is yours to add.
    func notebookBox(radius: HandShape.Size = .a, shadow: LF.Shadow = .card) -> some View {
        background { NotebookBoxBackground(size: radius, shadow: shadow) }
            .contentShape(HandShape(radius))
    }

    /// A floating sheet (`nb-surface`): card stock, 2pt ink at the small radius, a full ink
    /// drop. For popovers and cards built by the app; system menus and sheets stay native.
    func notebookSurface() -> some View {
        notebookBox(radius: .s, shadow: .ink)
    }
}

/// The drawing behind `notebookBox`. Public so a view can put it under something else
/// (for example a `Canvas`) without the modifier's content shape.
struct NotebookBoxBackground: View {
    var size: HandShape.Size = .a
    var shadow: LF.Shadow = .card
    var fill: Color = LF.Palette.card
    var border: Color = LF.Palette.ink
    var borderWidth: CGFloat = LF.Metrics.stroke
    var dashed: Bool = false

    var body: some View {
        ZStack {
            if shadow.isVisible {
                HandShape(size)
                    .fill(shadow.color)
                    .offset(x: shadow.x, y: shadow.y)
            }
            HandShape(size).fill(fill)
            if size == .a {
                // `.nb-box::after`: inset 3pt inside the 2pt border, its own radius.
                HandShape(.b)
                    .inset(by: borderWidth + 3)
                    .strokeBorder(LF.Palette.rule, lineWidth: LF.Metrics.hairline)
            }
            if dashed {
                HandShape(size)
                    .strokeBorder(border, style: StrokeStyle(lineWidth: borderWidth, dash: [5, 4]))
            } else {
                HandShape(size).strokeBorder(border, lineWidth: borderWidth)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview("Hand shapes", traits: .sizeThatFitsLayout) {
    VStack(spacing: 24) {
        Color.clear.frame(height: 120).notebookBox()
        Color.clear.frame(width: 160, height: 44).notebookBox(radius: .s, shadow: .ink)
        Color.clear.frame(height: 60).notebookSurface()
    }
    .padding(24)
    .paperBackground()
}
