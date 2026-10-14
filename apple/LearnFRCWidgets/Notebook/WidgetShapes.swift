import SwiftUI

/// The hand-ruled box: a rounded rectangle whose corners are deliberately uneven ellipses, the
/// site's `border-radius: var(--hand-a)` (and `-b`, `-s`) including CSS's corner-overlap rule.
/// A copy of the app's `HandShape` for the extension (values from `SiteTokens.Hand`).
nonisolated struct WidgetHandShape: InsettableShape {
    enum Size: Sendable, Hashable {
        /// The box outline (cards).
        case a
        /// The inner hairline drawn inside `.a`.
        case b
        /// Small controls: tags, meters, day cells, buttons.
        case s
    }

    private struct Corner { let h, v: CGFloat }

    var size: Size
    var insetAmount: CGFloat = 0

    init(_ size: Size = .a) {
        self.size = size
    }

    func inset(by amount: CGFloat) -> WidgetHandShape {
        var shape = self
        shape.insetAmount += amount
        return shape
    }

    /// Top-left, top-right, bottom-right, bottom-left, as `globals.css` declares them.
    private var radii: (Corner, Corner, Corner, Corner) {
        switch size {
        case .a: (Corner(h: 250, v: 16), Corner(h: 14, v: 230), Corner(h: 235, v: 14), Corner(h: 16, v: 250))
        case .b: (Corner(h: 232, v: 14), Corner(h: 18, v: 242), Corner(h: 250, v: 18), Corner(h: 12, v: 236))
        case .s: (Corner(h: 120, v: 9), Corner(h: 8, v: 112), Corner(h: 110, v: 8), Corner(h: 9, v: 120))
        }
    }

    func path(in rect: CGRect) -> Path {
        let r = rect.insetBy(dx: insetAmount, dy: insetAmount)
        guard r.width > 0, r.height > 0 else { return Path() }
        var (tl, tr, br, bl) = radii

        // CSS Backgrounds 3, "corner overlap": one factor for all radii.
        let f = min(1,
                    r.width / (tl.h + tr.h),
                    r.width / (bl.h + br.h),
                    r.height / (tl.v + bl.v),
                    r.height / (tr.v + br.v))
        func scaled(_ c: Corner) -> Corner { Corner(h: c.h * f, v: c.v * f) }
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
nonisolated struct WidgetTapeShape: Shape {
    func path(in rect: CGRect) -> Path {
        let polygon: [CGPoint] = [
            CGPoint(x: 0.03, y: 0.12), CGPoint(x: 0.97, y: 0), CGPoint(x: 1, y: 0.88),
            CGPoint(x: 0.06, y: 1), CGPoint(x: 0, y: 0.46),
        ]
        var p = Path()
        p.addLines(polygon.map { CGPoint(x: rect.minX + $0.x * rect.width, y: rect.minY + $0.y * rect.height) })
        p.closeSubpath()
        return p
    }
}

/// The graph ruling: 1pt lines every 23pt, from the top-left corner.
nonisolated struct GridRuling: Shape {
    var step: CGFloat = WidgetLF.Metrics.gridStep

    func path(in rect: CGRect) -> Path {
        var p = Path()
        guard step > 1 else { return p }
        var x = rect.minX + step
        while x < rect.maxX {
            p.addRect(CGRect(x: x, y: rect.minY, width: 1, height: rect.height))
            x += step
        }
        var y = rect.minY + step
        while y < rect.maxY {
            p.addRect(CGRect(x: rect.minX, y: y, width: rect.width, height: 1))
            y += step
        }
        return p
    }
}

/// A ballpoint check (`M12 48 L44 76 L108 12` in a 120 x 90 box).
nonisolated struct WidgetPenCheckShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 120, sy = rect.height / 90
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + 12 * sx, y: rect.minY + 48 * sy))
        p.addLine(to: CGPoint(x: rect.minX + 44 * sx, y: rect.minY + 76 * sy))
        p.addLine(to: CGPoint(x: rect.minX + 108 * sx, y: rect.minY + 12 * sy))
        return p
    }
}

/// A horizontal dashed rule, the site's `nb-hair` divider.
nonisolated struct DashedRule: Shape {
    var vertical = false

    func path(in rect: CGRect) -> Path {
        var p = Path()
        if vertical {
            p.move(to: CGPoint(x: rect.midX, y: rect.minY))
            p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        } else {
            p.move(to: CGPoint(x: rect.minX, y: rect.midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        }
        return p
    }
}
