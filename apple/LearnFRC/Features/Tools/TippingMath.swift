import Foundation

/// The Tip-Over & Stability sheet (learnfrc.com/tools/frc-tipping-calculator), ported from
/// the site's `_calculator.tsx`: exact rigid-body statics for the tip thresholds, and the
/// same community friction presets for the slide-or-tip and push estimates.
nonisolated enum TippingMath {
    static let gMs2 = 9.80665       // NIST CODATA standard gravity, exact
    static let gFts2 = 32.17405     // 9.80665 / 0.3048
    static let lbfToN = 4.4482216
    static let inToMm = 25.4
    static let lbToKg = 0.45359237

    /// A coefficient-of-friction preset. These are community estimates, not vendor specs:
    /// each seeds the low end of its reported range and prints the full range beside it.
    struct MuPreset: Hashable, Sendable, Identifiable {
        let key: String
        let label: String
        let seed: Double
        let range: String
        let note: String
        var id: String { key }
    }

    static let muPresets: [MuPreset] = [
        MuPreset(key: "roughtop", label: "Roughtop or wedgetop", seed: 1.1, range: "1.1 to 1.3",
                 note: "The highest-traction common FRC tread. Community values cluster from 1.1 to 1.3. The AndyMark blue-nitrile page lists no number at all."),
        MuPreset(key: "higrip", label: "AndyMark HiGrip", seed: 0.95, range: "0.95 to 1.0, community 1.07",
                 note: "AndyMark's historical spec was 0.95 to 1.0 static. The current HiGrip product page no longer lists a coefficient. Community measurements sit near 1.07 for the 4 in wheel."),
        MuPreset(key: "colson", label: "Colson or smooth traction", seed: 0.9, range: "0.9 to 1.1",
                 note: "WCP and Chief Delphi consensus: slightly below roughtop on tight-pile carpet."),
        MuPreset(key: "pneumatic", label: "Pneumatic, fore and aft", seed: 1.27, range: "about 1.27 inflated",
                 note: "A blog-cited AndyMark figure of 1.27 forwards and backwards, fully inflated, and lower sideways. Not on the current product page."),
        MuPreset(key: "omni", label: "Omni or mecanum roller, sideways", seed: 0.4, range: "0.4 to 0.6",
                 note: "Rollers present low lateral friction by design, so the free-rolling direction lands near 0.4 to 0.6."),
        MuPreset(key: "custom", label: "Your own measurement", seed: 1.1, range: "your value",
                 note: "Measure your own wheels on Shaw Neyland II 20 competition carpet. That beats every number on this list."),
    ]

    enum LengthUnit: String, Hashable, Sendable, CaseIterable { case inch = "in", mm }
    enum MassUnit: String, Hashable, Sendable, CaseIterable { case lb, kg }

    /// Every field as typed, lengths in the unit on screen, like the site's state.
    struct Inputs: Hashable, Sendable {
        var lengthUnit: LengthUnit = .inch
        var massUnit: MassUnit = .lb
        var track = "27"
        var wheelbase = "27"
        var cog = "13"
        var weight = "125"
        var muPresetKey = "roughtop"
        var mu = "1.1"
        var drivenFrac = "1.0"
        var yOff = "0"
        var xOff = "0"

        var preset: MuPreset { muPresets.first { $0.key == muPresetKey } ?? muPresets[0] }
    }

    struct Result: Hashable, Sendable {
        let valid: Bool
        let t, wb, h, y, x, f: Double
        let dSide, dPitch: Double
        let ssf: Double
        let aLatG, aLatMs2, aLatFts2: Double
        let aLongG, aLongMs2, aLongFts2: Double
        let thetaSide, thetaRamp: Double
        let sideSlides, pitchSlides: Bool
        let tanSide, tanPitch: Double
        let weightLbf, pushLbf, pushN: Double
        let muN: Double
    }

    static func compute(_ i: Inputs) -> Result {
        let p = ToolFormat.parseNum
        let t = p(i.track)
        let wb = p(i.wheelbase)
        let h = p(i.cog)
        let y = abs(p(i.yOff))
        let x = abs(p(i.xOff))
        let muN = p(i.mu)
        let f = JS.min(JS.max(p(i.drivenFrac), 0), 1)

        let valid = h > 0 && t > 0 && wb > 0

        // Worst-case restoring lever arms: an offset always cuts the margin.
        let dSide = t / 2 - y
        let dPitch = wb / 2 - x

        // Exact rigid-body statics. These ratios don't depend on the unit.
        let ssf = valid ? t / (2 * h) : .nan
        let aLatG = valid ? dSide / h : .nan
        let aLongG = valid ? dPitch / h : .nan
        let thetaSide = valid ? (atan(dSide / h) * 180) / Double.pi : .nan
        let thetaRamp = valid ? (atan(dPitch / h) * 180) / Double.pi : .nan

        let tanSide = valid ? dSide / h : .nan
        let tanPitch = valid ? dPitch / h : .nan
        // It slides first when mu is under the tip tangent, and tips first at or above it.
        let sideSlides = valid ? muN < tanSide : false
        let pitchSlides = valid ? muN < tanPitch : false

        // Friction-dependent: an estimate and a range, never a promise.
        let weightLbf = i.massUnit == .lb ? p(i.weight) : p(i.weight) / lbToKg
        let pushLbf = muN * f * weightLbf
        let pushN = pushLbf * lbfToN

        return Result(valid: valid, t: t, wb: wb, h: h, y: y, x: x, f: f, dSide: dSide, dPitch: dPitch, ssf: ssf,
                      aLatG: aLatG, aLatMs2: aLatG * gMs2, aLatFts2: aLatG * gFts2,
                      aLongG: aLongG, aLongMs2: aLongG * gMs2, aLongFts2: aLongG * gFts2,
                      thetaSide: thetaSide, thetaRamp: thetaRamp, sideSlides: sideSlides, pitchSlides: pitchSlides,
                      tanSide: tanSide, tanPitch: tanPitch, weightLbf: weightLbf, pushLbf: pushLbf, pushN: pushN, muN: muN)
    }

    // MARK: Words

    /// The plain-language read-out from the Static Stability Factor.
    static func tippiness(_ r: Result) -> String {
        guard r.valid else { return "not enough numbers" }
        if r.ssf >= 1.2 { return "very stable" }
        if r.ssf >= 1.0 { return "stable" }
        if r.ssf >= 0.85 { return "moderate, watch hard turns" }
        return "tippy"
    }

    static func verdictLine(_ r: Result) -> String {
        if !r.valid { return "Not enough numbers yet." }
        if r.ssf < 0.85 { return "This robot goes over in a hard turn." }
        if r.ssf < 1.0 { return "It stays up, but not through a hard turn." }
        if r.sideSlides { return "It slips before it tips, which is the good failure." }
        return "It stands up to anything a driver can ask."
    }

    static func verdictBody(_ r: Result) -> String {
        let fmt = ToolFormat.fixed
        if !r.valid { return "Enter a track width, a wheelbase and a centre-of-gravity height and the sheet fills in." }
        if r.ssf < 0.85 {
            return "A Static Stability Factor of \(fmt(r.ssf, 2)) means two wheels lift at \(fmt(r.aLatG, 2)) g sideways. Widen the track or get the battery lower before you tune the drive code."
        }
        if r.ssf < 1.0 {
            return "Two wheels lift at \(fmt(r.aLatG, 2)) g sideways, so a fast direction change or a bump under one wheel is enough. There is no margin for a raised elevator."
        }
        if r.sideSlides {
            return "On a cross-slope the wheels break loose at a coefficient of \(fmt(r.tanSide, 2)) before the robot reaches \(fmt(r.thetaSide, 1)) degrees, and your tread is \(fmt(r.muN, 2)). It scrubs instead of falling over."
        }
        return "\(fmt(r.aLatG, 2)) g sideways and \(fmt(r.thetaSide, 1)) degrees of cross-slope before two wheels lift. The tread grips harder than the geometry, so it tips before it slides."
    }

    static func stamps(_ r: Result) -> [(value: String, label: String)] {
        let fmt = ToolFormat.fixed
        return [
            (fmt(r.aLatG, 2), "g sideways before two wheels lift"),
            (fmt(r.ssf, 2), "static stability factor"),
            ("\(fmt(r.thetaSide, 1))°", "of cross-slope before it goes"),
        ]
    }

    /// The robot tag's footer.
    static func leverLines(_ r: Result, unit: LengthUnit) -> [(term: String, value: String)] {
        let fmt = ToolFormat.fixed
        let lu = unit.rawValue
        return [
            ("sideways lever", "\(fmt(r.dSide, 2)) \(lu), being half the track minus \(fmt(r.y, 2)) \(lu) of offset"),
            ("pitch lever", "\(fmt(r.dPitch, 2)) \(lu), being half the wheelbase minus \(fmt(r.x, 2)) \(lu) of offset"),
            ("ramp angle", "\(fmt(r.thetaRamp, 1)) degrees before it goes over backwards"),
            ("pushing force", "about \(fmt(r.pushLbf, 0)) lbf, \(fmt(r.pushN, 0)) N, and only as good as the coefficient"),
        ]
    }

    /// One failure mode, stated as words.
    static func failureVerdict(valid: Bool, slides: Bool) -> String {
        valid ? (slides ? "slips first" : "goes over first") : "n/a"
    }

    static func failureDetail(valid: Bool, mu: Double, tan: Double, angle: Double) -> String {
        let fmt = ToolFormat.fixed
        return valid
            ? "tread \(fmt(mu, 2)) against a tip tangent of \(fmt(tan, 2)), tipping at \(fmt(angle, 1)) degrees"
            : "enter a track, a wheelbase and a CoG height"
    }

    static func muHint(_ preset: MuPreset) -> String {
        "\(preset.label) sits at \(preset.range). Editing this switches to your own measurement."
    }

    static func pushNote(_ preset: MuPreset) -> String {
        "Force is the coefficient times the driven fraction times weight, so it is only as good as a number nobody publishes. Treat it as a range across \(preset.range), not as a figure to quote."
    }

    /// Every formula with the entered numbers in it.
    static func working(_ r: Result, unit: LengthUnit) -> [(title: String, formula: String, worked: String)] {
        let fmt = ToolFormat.fixed
        let lu = unit.rawValue
        return [
            ("Static stability factor", "SSF = track / (2 h)", "\(fmt(r.t, 2)) / (2 x \(fmt(r.h, 2))) = \(fmt(r.ssf, 3))"),
            ("Sideways lever arm", "d = track/2 - sideways offset", "\(fmt(r.t / 2, 2)) - \(fmt(r.y, 2)) = \(fmt(r.dSide, 2)) \(lu)"),
            ("Tip acceleration, sideways", "a = g d / h",
             "\(fmt(r.aLatG, 3)) g = \(fmt(r.aLatMs2, 2)) m/s² = \(fmt(r.aLatFts2, 1)) ft/s²"),
            ("Tip acceleration, fore and aft", "a = g (wheelbase/2 - offset) / h",
             "\(fmt(r.aLongG, 3)) g = \(fmt(r.aLongMs2, 2)) m/s² = \(fmt(r.aLongFts2, 1)) ft/s²"),
            ("Cross-slope tip angle", "theta = arctan(d / h)",
             "arctan(\(fmt(r.dSide, 2)) / \(fmt(r.h, 2))) = \(fmt(r.thetaSide, 2)) degrees"),
            ("Ramp tip angle", "theta = arctan(d / h)",
             "arctan(\(fmt(r.dPitch, 2)) / \(fmt(r.h, 2))) = \(fmt(r.thetaRamp, 2)) degrees"),
            ("Slide or tip, sideways", "slides when mu < d / h",
             "\(fmt(r.muN, 2)) \(r.sideSlides ? "<" : "is at or above") \(fmt(r.tanSide, 2)), so it \(r.sideSlides ? "slides" : "tips") first"),
            ("Traction-limited push", "F = mu x driven fraction x weight",
             "\(fmt(r.muN, 2)) x \(fmt(r.f, 2)) x \(fmt(r.weightLbf, 1)) lb = \(fmt(r.pushLbf, 1)) lbf"),
        ]
    }

    // MARK: Editing, like the site's handlers

    static func switchLengthUnit(_ next: LengthUnit, in i: inout Inputs) {
        guard next != i.lengthUnit else { return }
        let factor = i.lengthUnit == .inch ? inToMm : 1 / inToMm
        let round: (String) -> String = { text in
            let n = ToolFormat.parseNum(text) * factor
            return next == .mm ? JS.string(JS.round(n)) : JS.string(JS.round(n * 100) / 100)
        }
        i.track = round(i.track)
        i.wheelbase = round(i.wheelbase)
        i.cog = round(i.cog)
        i.yOff = round(i.yOff)
        i.xOff = round(i.xOff)
        i.lengthUnit = next
    }

    static func switchMassUnit(_ next: MassUnit, in i: inout Inputs) {
        guard next != i.massUnit else { return }
        let factor = i.massUnit == .lb ? lbToKg : 1 / lbToKg
        i.weight = JS.string(JS.round(ToolFormat.parseNum(i.weight) * factor * 10) / 10)
        i.massUnit = next
    }

    /// Picking a tread seeds its coefficient, except "your own measurement", which keeps
    /// whatever is there.
    static func selectPreset(_ key: String, in i: inout Inputs) {
        i.muPresetKey = key
        if let p = muPresets.first(where: { $0.key == key }), key != "custom" {
            i.mu = JS.string(p.seed)
        }
    }

    /// Typing a coefficient switches the preset to "your own measurement".
    static func editMu(_ text: String, in i: inout Inputs) {
        i.mu = text
        i.muPresetKey = "custom"
    }

    // MARK: The front view

    /// The cross-section drawing's geometry in a 320 x 210 box, scaled from whatever unit is
    /// on screen (every ratio is unit-independent). Nil when there's nothing to draw.
    struct Diagram: Hashable, Sendable {
        static let width: Double = 320
        static let height: Double = 210
        static let floorY: Double = 168
        static let centerX: Double = 160
        let halfTrackPx: Double
        let bodyTop: Double
        let cogX: Double
        let cogY: Double
        let tipX: Double
    }

    static func diagram(_ r: Result, yOffText: String) -> Diagram? {
        guard r.valid else { return nil }
        let y = ToolFormat.parseNum(yOffText)
        let w = Diagram.width, h = Diagram.height, floorY = Diagram.floorY, cx = Diagram.centerX
        // One scale for both axes, so the drawing fills the box whichever dimension binds.
        let px = JS.min((w - 90) / JS.max(r.t, 1), (h - 70) / JS.max(r.h * 1.5, 1))
        let halfTrackPx = (r.t / 2) * px
        let cogPx = r.h * px
        let bodyTop = floorY - JS.max(cogPx * 1.5, cogPx + 14)
        let cogX = cx + y * px
        let cogY = floorY - cogPx
        // The tipping edge is the side the CoG leans toward.
        let tipX = y >= 0 ? cx + halfTrackPx : cx - halfTrackPx
        return Diagram(halfTrackPx: halfTrackPx, bodyTop: bodyTop, cogX: cogX, cogY: cogY, tipX: tipX)
    }
}
