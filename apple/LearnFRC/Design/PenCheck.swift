import SwiftUI

/// A ballpoint check, the mark a student makes on a finished worksheet.
/// `PenCheckShape` is the stroke; `PenCheckMark` is a static check for "done" states in rows;
/// `CompletionBurst` is the one-shot animation the site plays when a lesson is completed.
nonisolated struct PenCheckShape: Shape {
    /// `M12 48 L44 76 L108 12` in a 120 x 90 box.
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 120, sy = rect.height / 90
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + 12 * sx, y: rect.minY + 48 * sy))
        p.addLine(to: CGPoint(x: rect.minX + 44 * sx, y: rect.minY + 76 * sy))
        p.addLine(to: CGPoint(x: rect.minX + 108 * sx, y: rect.minY + 12 * sy))
        return p
    }
}

/// A small static blue check, for a completed lesson in a list. Success in this system is a
/// mark plus words, never a green colour.
struct PenCheckMark: View {
    var size: CGFloat = 18

    var body: some View {
        PenCheckShape()
            .stroke(LF.Palette.blue, style: StrokeStyle(lineWidth: max(2, size * 0.13), lineCap: .round, lineJoin: .round))
            .frame(width: size * 1.33, height: size)
            .accessibilityHidden(true)
    }
}

/// The completion mark from the site's lesson page: one check stroke drawn across the card
/// (260ms), a few short pen ticks thrown off it (620ms after a 140ms delay), then the whole
/// mark fades. Fires once each time `trigger` changes; never loops. Absent under Reduce Motion
/// (the words and the stamp carry the same news). Place it as an overlay on the card that fired it.
struct CompletionBurst: View {
    var trigger: Int
    var ticks: Int = 6

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if reduceMotion || trigger == 0 {
            Color.clear.frame(width: 0, height: 0).accessibilityHidden(true)
        } else {
            let count = ticks
            Color.clear
                .frame(width: 0, height: 0)
                .keyframeAnimator(initialValue: 1.0, trigger: trigger) { content, t in
                    content.overlay { BurstDrawing.mark(at: t * 0.9, ticks: count) }
                } keyframes: { _ in
                    MoveKeyframe(0.0)
                    LinearKeyframe(1.0, duration: 0.9)
                }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }
}

/// The burst's frames, drawn from elapsed time so a single keyframe value drives all of it.
nonisolated private enum BurstDrawing {
    /// Deterministic ticks, so the burst reads as drawn rather than as noise.
    static let table: [(x: CGFloat, y: CGFloat, rot: Double)] = [
        (-84, -46, -28), (-38, -74, 14), (30, -78, -9), (86, -40, 33),
        (-66, 22, 41), (62, 30, -37), (8, 46, 6), (-14, -100, -18),
    ]

    /// The whole mark at `time` seconds into its 0.9s run.
    @ViewBuilder
    static func mark(at time: Double, ticks: Int) -> some View {
        let ms = time * 1000
        if ms < 900 {
            let fade = ms < 660 ? 1 : max(0, 1 - (ms - 660) / 240)
            ZStack {
                PenCheckShape()
                    .trim(from: 0, to: Easing.out(min(1, ms / 260)))
                    .stroke(LF.Palette.blue, style: StrokeStyle(lineWidth: 7, lineCap: .round, lineJoin: .round))
                    .frame(width: 120, height: 90)
                ForEach(0..<min(max(ticks, 0), table.count), id: \.self) { i in
                    tick(table[i], at: ms)
                }
            }
            .opacity(fade)
        }
    }

    static func tick(_ t: (x: CGFloat, y: CGFloat, rot: Double), at ms: Double) -> some View {
        let u = Easing.out(min(1, max(0, (ms - 140) / 620)))
        // 0...0.45: thrown out and drawn to full length. 0.45...1: drifts on and fades.
        let first = min(1, u / 0.45)
        let second = max(0, (u - 0.45) / 0.55)
        let reach = 1 + 0.18 * second
        return Rectangle()
            .fill(LF.Palette.blue)
            .frame(width: 14, height: 3)
            .scaleEffect(x: first, y: 1, anchor: .leading)
            .rotationEffect(.degrees(t.rot), anchor: .leading)
            .offset(x: t.x * first * reach + 7, y: t.y * first * reach)
            .opacity(ms < 140 ? 0 : 1 - second)
    }
}

/// The site's ease-out curve, `cubic-bezier(0.2, 0.9, 0.3, 1)`, evaluated for hand-driven motion.
nonisolated enum Easing {
    static func out(_ x: Double) -> Double {
        let c = SiteTokens.Ease.out
        return cubicBezier(x, c.x1, c.y1, c.x2, c.y2)
    }

    /// y for a given x on a CSS cubic-bezier, by Newton's method then bisection.
    static func cubicBezier(_ x: Double, _ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> Double {
        if x <= 0 { return 0 }
        if x >= 1 { return 1 }
        func sample(_ t: Double, _ a: Double, _ b: Double) -> Double {
            let u = 1 - t
            return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
        }
        func slope(_ t: Double, _ a: Double, _ b: Double) -> Double {
            let u = 1 - t
            return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b)
        }
        var t = x
        for _ in 0..<8 {
            let err = sample(t, x1, x2) - x
            let d = slope(t, x1, x2)
            if abs(err) < 1e-6 { return sample(t, y1, y2) }
            if abs(d) < 1e-6 { break }
            t -= err / d
        }
        var lo = 0.0, hi = 1.0
        t = x
        for _ in 0..<30 {
            let v = sample(t, x1, x2)
            if abs(v - x) < 1e-6 { break }
            if v < x { lo = t } else { hi = t }
            t = (lo + hi) / 2
        }
        return sample(t, y1, y2)
    }
}

#Preview("Completion burst", traits: .fixedLayout(width: 393, height: 360)) {
    @Previewable @State var fired = 0
    VStack(spacing: 30) {
        NotebookCard(tilt: .left, lift: true) {
            SlugText("lesson / pid-basics")
            Text("Lesson complete").lfTitle(.h3).padding(.top, 6)
        }
        .overlay { CompletionBurst(trigger: fired) }
        HStack(spacing: 14) {
            PenCheckMark()
            Text("Done").font(LF.Fonts.body(16, weight: .semibold)).foregroundStyle(LF.Palette.ink)
        }
        Button("Complete") { fired += 1 }.buttonStyle(.ink)
    }
    .padding(LF.Metrics.gutter)
    .frame(maxHeight: .infinity)
    .paperBackground()
}
