import Foundation

/// The Wire Gauge & Voltage Drop checker (learnfrc.com/tools/frc-wire-gauge-calculator),
/// ported from the site's `_calculator.tsx`: the same copper table, the same R609 and
/// Table 8-4 minimums, round-trip Ohm's law and the stranded-and-warm range.
nonisolated enum WireGaugeMath {
    /// DC resistance of solid annealed copper (100% IACS) at 20 C, ohm per 1000 ft.
    static let resistancePer1000ft: [Int: Double] = [
        6: 0.3951, 8: 0.6282, 10: 0.9989, 12: 1.588, 14: 2.525,
        16: 4.016, 18: 6.385, 20: 10.15, 22: 16.14, 24: 25.67,
    ]

    /// Gauges offered, thick to thin.
    static let awgOptions: [Int] = [6, 8, 10, 12, 14, 16, 18, 20, 22, 24]

    static let copperResistivityOhmM = 1.7241e-8
    static let defaultAlphaPerC = 0.00393
    static let roundTripFactor: Double = 2
    static let defaultSystemVoltage: Double = 12
    static let strandedUpliftLow = 0.02
    static let strandedUpliftHigh = 0.05

    /// The FRC minimum legal gauge per circuit. A smaller AWG number is thicker wire.
    struct CircuitType: Hashable, Sendable, Identifiable {
        let id: String
        let label: String
        let minAwg: Int
        let rule: String
    }

    static let circuitTypes: [CircuitType] = [
        CircuitType(id: "main", label: "120 A main power path (battery / main breaker / PD board)", minAwg: 6,
                    rule: "R609: 6 AWG (7 SWG / 16 mm²) or larger"),
        CircuitType(id: "b40", label: "31-40 A breaker-protected circuit (e.g. drive motor controller)", minAwg: 12,
                    rule: "R622 Table 8-4: 12 AWG (13 SWG / 4 mm²)"),
        CircuitType(id: "b30", label: "21-30 A breaker-protected circuit", minAwg: 14,
                    rule: "R622 Table 8-4: 14 AWG (16 SWG / 2.5 mm²)"),
        CircuitType(id: "b20", label: "6-20 A breaker / 11-20 A fuse; PD board to VRM-RPM / PCM-PH", minAwg: 18,
                    rule: "R622 Table 8-4: 18 AWG (19 SWG / 1 mm²)"),
        CircuitType(id: "b5", label: "≤5 A breaker / ≤10 A fuse / motor power adapter board", minAwg: 22,
                    rule: "R622 Table 8-4: 22 AWG (22 SWG / 0.5 mm²)"),
        CircuitType(id: "vrm2", label: "VRM 2 A circuits / ≤2 A fuse-protected circuit", minAwg: 24,
                    rule: "R622 Table 8-4: 24 AWG (24 SWG / 0.25 mm²)"),
    ]

    enum LengthUnit: String, Hashable, Sendable, CaseIterable {
        case inch = "in", ft, m

        /// One-way length in this unit to feet.
        var toFeet: Double {
            switch self {
            case .inch: 1.0 / 12
            case .ft: 1
            case .m: 1 / 0.3048
            }
        }

        /// The length menu's word.
        var title: String {
            switch self {
            case .inch: "inches"
            case .ft: "feet"
            case .m: "meters"
            }
        }
    }

    /// AWG diameter by definition: d(in) = 0.005 x 92^((36 - n) / 39).
    static func awgDiameterInch(_ n: Int) -> Double {
        0.005 * pow(92, Double(36 - n) / 39)
    }

    /// Conductor cross-section in mm² from the AWG diameter.
    static func awgAreaMm2(_ n: Int) -> Double {
        let dMm = awgDiameterInch(n) * 25.4
        return (Double.pi / 4) * dMm * dMm
    }

    struct Drop: Hashable, Sendable {
        let rCircuit: Double   // ohms, round trip
        let vDrop: Double
        let percent: Double
        let vLoad: Double
    }

    /// V_drop = I x (2 x L_one-way_ft x R_per_1000ft / 1000).
    static func computeDrop(current: Double, lengthFt: Double, rPer1000: Double, systemVoltage: Double) -> Drop {
        let rCircuit = (roundTripFactor * lengthFt * rPer1000) / 1000
        let vDrop = current * rCircuit
        return Drop(rCircuit: rCircuit, vDrop: vDrop,
                    percent: systemVoltage > 0 ? (vDrop / systemVoltage) * 100 : 0,
                    vLoad: systemVoltage - vDrop)
    }

    /// Ohms per 1000 ft after temperature and the stranded uplift.
    static func effectiveResistance(_ base20C: Double, tempC: Double, alpha: Double, uplift: Double) -> Double {
        let tempFactor = 1 + alpha * (tempC - 20)
        return base20C * tempFactor * (1 + uplift)
    }

    /// The three drop bands, as words.
    static func percentBand(_ pct: Double) -> String {
        if pct < 3 { return "under 3%" }
        if pct <= 5 { return "3 to 5%" }
        return "over 5%"
    }

    /// Every field as typed, like the site's state.
    struct Inputs: Hashable, Sendable {
        var current = "40"
        var length = "10"
        var lengthUnit: LengthUnit = .ft
        var gauge = 12
        var circuitID = "b40"
        var strandedWarm = true
        var targetPct = "5"
        var tempC = "20"
        var systemVoltage = JS.string(defaultSystemVoltage)
        var alpha = JS.string(defaultAlphaPerC)
        var upliftLowPct = JS.string(strandedUpliftLow * 100)
        var upliftHighPct = JS.string(strandedUpliftHigh * 100)

        var circuit: CircuitType { circuitTypes.first { $0.id == circuitID } ?? circuitTypes[0] }
    }

    struct LadderRow: Hashable, Sendable, Identifiable {
        let gauge: Int
        let base: Double
        let drop: Double
        let percent: Double
        let legal: Bool
        let underTarget: Bool
        var id: Int { gauge }
    }

    struct Result: Hashable, Sendable {
        let current: Double
        let lengthFt: Double
        let voltage: Double
        let rBase: Double
        let rHighPer1000: Double
        let low: Drop
        let typical: Drop
        let high: Drop
        let compliant: Bool
        let recommendedGauge: Int?
        let ladder: [LadderRow]
        let diameterIn: Double
        let areaMm2: Double
        let target: Double
    }

    static func compute(_ i: Inputs) -> Result {
        let num = ToolFormat.num
        let circuit = i.circuit
        let I = num(i.current, 0)
        let lengthFt = num(i.length, 0) * i.lengthUnit.toFeet
        let V = num(i.systemVoltage, defaultSystemVoltage)
        let T = num(i.tempC, 20)
        let a = num(i.alpha, defaultAlphaPerC)
        let upLow = i.strandedWarm ? num(i.upliftLowPct, 0) / 100 : 0
        let upHigh = i.strandedWarm ? num(i.upliftHighPct, 0) / 100 : 0

        let rBase = resistancePer1000ft[i.gauge] ?? .nan

        // Low = solid copper at 20 C (the table anchor); high = warm and stranded.
        let rLow = rBase
        let rHigh = i.strandedWarm ? effectiveResistance(rBase, tempC: T, alpha: a, uplift: upHigh) : rBase
        let rTypical = i.strandedWarm ? effectiveResistance(rBase, tempC: T, alpha: a, uplift: upLow) : rBase

        let low = computeDrop(current: I, lengthFt: lengthFt, rPer1000: rLow, systemVoltage: V)
        let typical = computeDrop(current: I, lengthFt: lengthFt, rPer1000: rTypical, systemVoltage: V)
        let high = computeDrop(current: I, lengthFt: lengthFt, rPer1000: rHigh, systemVoltage: V)

        // FRC compliance: a smaller AWG number is thicker, so it complies.
        let compliant = i.gauge <= circuit.minAwg

        // The thinnest legal gauge that also keeps the worst-case drop under the target.
        let target = num(i.targetPct, 0)
        var recommended: Int?
        for g in awgOptions {
            if g > circuit.minAwg { continue } // legal gauges only: the minimum or thicker
            let base = resistancePer1000ft[g] ?? .nan
            let rr = i.strandedWarm ? effectiveResistance(base, tempC: T, alpha: a, uplift: upHigh) : base
            let d = computeDrop(current: I, lengthFt: lengthFt, rPer1000: rr, systemVoltage: V)
            if d.percent <= target { recommended = g }
        }

        // The whole decision space, one row per gauge, with the same maths as the headline.
        let ladder: [LadderRow] = awgOptions.map { g in
            let base = resistancePer1000ft[g] ?? .nan
            let rr = i.strandedWarm ? effectiveResistance(base, tempC: T, alpha: a, uplift: upHigh) : base
            let d = computeDrop(current: I, lengthFt: lengthFt, rPer1000: rr, systemVoltage: V)
            return LadderRow(gauge: g, base: base, drop: d.vDrop, percent: d.percent, legal: g <= circuit.minAwg,
                             underTarget: d.percent <= target)
        }

        return Result(current: I, lengthFt: lengthFt, voltage: V, rBase: rBase, rHighPer1000: rHigh, low: low, typical: typical,
                      high: high, compliant: compliant, recommendedGauge: recommended, ladder: ladder,
                      diameterIn: awgDiameterInch(i.gauge), areaMm2: awgAreaMm2(i.gauge), target: target)
    }

    // MARK: Words

    /// `fmt` on this page has no "n/a": it's `toLocaleString` straight.
    static func fmt(_ v: Double, _ digits: Int) -> String { JS.locale(v, digits) }

    static func kicker(_ r: Result) -> String {
        "verdict / \(r.compliant ? "passes" : "fails") the gauge rule"
    }

    static func verdictLine(_ r: Result, gauge: Int) -> String {
        r.compliant ? "\(gauge) AWG is legal on this circuit." : "\(gauge) AWG is too thin for this circuit."
    }

    static func verdictBody(_ circuit: CircuitType) -> String {
        "Minimum here is \(circuit.minAwg) AWG. \(circuit.rule)."
    }

    static func stamps(_ r: Result, rangeMode: Bool) -> [(value: String, label: String)] {
        [
            (rangeMode ? "\(fmt(r.low.vDrop, 2))-\(fmt(r.high.vDrop, 2))" : fmt(r.low.vDrop, 2), "volts dropped over the run"),
            ((rangeMode ? "\(fmt(r.low.percent, 1))-\(fmt(r.high.percent, 1))" : fmt(r.low.percent, 1)) + "%",
             "of \(fmt(r.voltage, 0)) V nominal, \(percentBand(r.high.percent))"),
            (rangeMode ? "\(fmt(r.high.vLoad, 2))-\(fmt(r.low.vLoad, 2))" : fmt(r.low.vLoad, 2), "volts left at the load"),
        ]
    }

    /// The tag's footer: what the chosen gauge is.
    static func conductorLines(_ r: Result, gauge: Int, rangeMode: Bool) -> [(term: String, value: String)] {
        [
            ("conductor", "\(gauge) AWG, \(fmt(r.diameterIn, 4)) in dia, \(fmt(r.areaMm2, 2)) mm²"),
            ("resistance", "\(fmt(r.rBase, r.rBase < 1 ? 4 : 3)) Ω/1000 ft solid Cu at 20°C"),
            ("circuit", "\(fmt(r.low.rCircuit * 1000, 1))\(rangeMode ? " to \(fmt(r.high.rCircuit * 1000, 1))" : "") mΩ round trip"),
            ("electrical length", "\(fmt(r.lengthFt * roundTripFactor, 2)) ft, being \(fmt(r.lengthFt, 2)) ft each way"),
        ]
    }

    static func strandedHint(_ i: Inputs) -> String {
        "Real FRC wire is stranded and runs warm. Adds \(fmt(ToolFormat.num(i.upliftLowPct, 0), 0)) to \(fmt(ToolFormat.num(i.upliftHighPct, 0), 0))% plus temperature and shows a range. Turn it off for the exact solid-copper 20°C figure."
    }

    static func ladderIntro(_ r: Result, _ i: Inputs) -> String {
        "\(fmt(r.current, 0)) A over \(fmt(r.lengthFt, 2)) ft one way, \(i.strandedWarm ? "worst case, stranded and warm" : "solid copper at 20°C"). A row is only usable if it is both legal on this circuit and under your \(fmt(ToolFormat.num(i.targetPct, 0), 1))% target."
    }

    static let noGaugeWorks = "nothing down to 6 AWG holds this target, shorten the run or split the load"

    static func ruleWord(_ row: LadderRow, circuit: CircuitType) -> String {
        row.legal ? "meets the minimum" : "below \(circuit.minAwg) AWG"
    }

    static func rowVerdict(_ row: LadderRow, recommended: Int?) -> String {
        if !row.legal { return "not legal here" }
        if !row.underTarget { return "legal, over target" }
        return row.gauge == recommended ? "use this one" : "works"
    }

    static func ohmsText(_ base: Double) -> String { fmt(base, base < 1 ? 4 : 3) }
}
