import Foundation

/// The Gear Ratio Calculator (learnfrc.com/tools/frc-gear-ratio-calculator), ported from the
/// site's `_calculator.tsx`: the same verified motors, presets, linear DC-motor torque model,
/// traction limit and battery sag, with the same constants as the current budget sheet.
nonisolated enum GearRatioMath {
    // Exact unit conversions.
    static let mPerIn = 0.0254
    static let lbfToN = 4.4482216
    static let nmToFtlb = 1 / (lbfToN * 0.3048)
    static let gFtS2 = 32.17405
    static let fpsToMps = 0.3048

    // Electrical limits, the same constants as the Current & Brownout tool.
    static let mainBreakerA: Double = 120
    static let brownoutV: Double = 6.75
    static let railDroopV: Double = 6.8
    static let defaultVocV: Double = 12.5
    static let defaultRintOhm: Double = 0.015

    struct Motor: Hashable, Sendable, Identifiable {
        let key: String
        let label: String
        let freeRpm: Double
        let stallNm: Double
        let stallA: Double
        let freeA: Double
        let vendor: String
        let note: String
        var id: String { key }
    }

    /// Each figure is the motor's own manufacturer's published spec at 12 V. The Mini CIM and
    /// the CTRE Minion are left out on purpose: no current first-party spec page could be
    /// verified for them.
    static let motors: [Motor] = [
        Motor(key: "neo", label: "REV NEO V1.1", freeRpm: 5676, stallNm: 2.6, stallA: 105, freeA: 1.8, vendor: "REV Robotics",
              note: "REV's published empirical figures, measured with a SPARK MAX on FRC hardware. The same set WPILib's simulation uses."),
        Motor(key: "vortex", label: "REV NEO Vortex", freeRpm: 6784, stallNm: 3.6, stallA: 211, freeA: 3.6, vendor: "REV Robotics",
              note: "565 Kv. Faster and stronger than a NEO, but note the much higher stall current when you set limits."),
        Motor(key: "krakenx60", label: "Kraken X60 (trapezoidal)", freeRpm: 6000, stallNm: 7.09, stallA: 366, freeA: 2,
              vendor: "WCP / CTR Electronics", note: "Default commutation, what you get without a Phoenix Pro FOC licence."),
        Motor(key: "krakenx60foc", label: "Kraken X60 (FOC)", freeRpm: 5800, stallNm: 9.37, stallA: 483, freeA: 2,
              vendor: "WCP / CTR Electronics",
              note: "Field-oriented control trades a little free speed for a lot of torque. Requires a Phoenix Pro licence."),
        Motor(key: "krakenx44", label: "Kraken X44 (trapezoidal)", freeRpm: 7530, stallNm: 4.05, stallA: 275, freeA: 1.4,
              vendor: "WCP / CTR Electronics", note: "The compact Kraken, smaller and faster, for intakes, hoods and shooters."),
        Motor(key: "krakenx44foc", label: "Kraken X44 (FOC)", freeRpm: 7368, stallNm: 5.01, stallA: 329, freeA: 3,
              vendor: "WCP / CTR Electronics", note: "X44 with field-oriented control. Requires a Phoenix Pro licence."),
        Motor(key: "falcon500", label: "Falcon 500", freeRpm: 6380, stallNm: 4.69, stallA: 257, freeA: 1.5, vendor: "VEX / CTR Electronics",
              note: "Discontinued but still everywhere. Figures are CTRE's published trapezoidal numbers."),
        Motor(key: "cim", label: "CIM (2.5 in)", freeRpm: 5310, stallNm: 2.425, stallA: 133, freeA: 2.7, vendor: "AndyMark (am-0255)",
              note: "The classic brushed KOP motor. Heavy and no built-in encoder, but nearly indestructible."),
    ]

    enum Mode: String, Hashable, Sendable, CaseIterable { case drivetrain, mechanism }
    enum StageInput: String, Hashable, Sendable, CaseIterable { case teeth, ratio }

    struct Stage: Hashable, Sendable, Identifiable {
        var id: Int
        var driving: String
        var driven: String
        var ratio: String
    }

    struct Preset: Hashable, Sendable, Identifiable {
        let key: String
        let label: String
        let blurb: String
        let mode: Mode
        let motor: String
        let count: String
        let stageInput: StageInput
        let stages: [(driving: String, driven: String, ratio: String)]
        let eff, wheel, weight, mu, weightFrac, derate, limit, arm: String
        var id: String { key }

        static func == (a: Preset, b: Preset) -> Bool { a.key == b.key }
        func hash(into hasher: inout Hasher) { hasher.combine(key) }
    }

    /// Every ratio is a real, published vendor number.
    static let presets: [Preset] = [
        Preset(key: "kop", label: "KOP tank",
               blurb: "Kit-of-Parts chassis: 2 CIMs through a ToughBox Mini at 8.45:1 (AndyMark's real gearset, a 14T pinion into 50T, then 19T into 45T), 6 in wheels.",
               mode: .drivetrain, motor: "cim", count: "2", stageInput: .teeth,
               stages: [("14", "50", "3.571"), ("19", "45", "2.368")],
               eff: "90", wheel: "6", weight: "120", mu: "1.1", weightFrac: "100", derate: "85", limit: "40", arm: "24"),
        Preset(key: "neotank", label: "Brushless tank",
               blurb: "The common modern rebuild of the same chassis: 4 NEOs on the same 8.45:1 ToughBox gearset and 6 in wheels. Compare its pushing force to the CIM preset.",
               mode: .drivetrain, motor: "neo", count: "4", stageInput: .teeth,
               stages: [("14", "50", "3.571"), ("19", "45", "2.368")],
               eff: "90", wheel: "6", weight: "125", mu: "1.1", weightFrac: "100", derate: "85", limit: "40", arm: "24"),
        Preset(key: "swerve", label: "Swerve (MK4i L2)",
               blurb: "Four modules, one Kraken X60 driving each: SDS MK4i in the L2 gearing (6.75:1) on 4 in wheels. The module is three reductions, so efficiency starts near 0.95 cubed.",
               mode: .drivetrain, motor: "krakenx60", count: "4", stageInput: .ratio,
               stages: [("1", "6.75", "6.75")],
               eff: "86", wheel: "4", weight: "125", mu: "1.1", weightFrac: "100", derate: "85", limit: "40", arm: "24"),
        Preset(key: "arm", label: "Arm / mechanism",
               blurb: "A single NEO through a 100:1 planetary driving a 24 in arm, the starting point for most FRC arm and elevator ratio questions.",
               mode: .mechanism, motor: "neo", count: "1", stageInput: .ratio,
               stages: [("1", "100", "100")],
               eff: "86", wheel: "4", weight: "125", mu: "1.1", weightFrac: "100", derate: "85", limit: "40", arm: "24"),
    ]

    /// Every field as typed, like the site's state.
    struct Inputs: Hashable, Sendable {
        var mode: Mode = .drivetrain
        var presetKey = "kop"
        var motorKey = "cim"
        var count = "2"
        var stageInput: StageInput = .teeth
        var stages: [Stage] = [Stage(id: 1, driving: "14", driven: "50", ratio: "3.571"),
                               Stage(id: 2, driving: "19", driven: "45", ratio: "2.368")]
        var eff = "90"
        var wheel = "6"
        var weight = "120"
        var mu = "1.1"
        var weightFrac = "100"
        var derate = "85"
        var arm = "24"
        var limit = "40"
        var voc = JS.string(defaultVocV)
        var rInt = JS.string(defaultRintOhm)

        var motor: Motor { motors.first { $0.key == motorKey } ?? motors[0] }
        var preset: Preset? { presets.first { $0.key == presetKey } }
    }

    enum Power: String, Hashable, Sendable { case ok, warn, over }
    enum Brownout: String, Hashable, Sendable { case safe, marginal, brownout }

    struct Result: Hashable, Sendable {
        let stageRatios: [Double]
        let cumulative: [Double]
        let stagesValid: Bool
        let G: Double
        let n: Double
        let etaTotal: Double
        let outRpm: Double
        let vFreeFps: Double
        let vAdjFps: Double
        let tauMotor: Double
        let tauOut: Double
        let currentLimited: Bool
        let fPushLb: Double
        let fTracLb: Double
        let usableLb: Double
        let tractionLimited: Bool
        let accelG: Double
        let accelFtS2: Double
        let fArmLb: Double
        let iTotal: Double
        let vBus: Double
        let power: Power
        let brownout: Brownout
        let wheelIn: Double
        let armIn: Double
        let iLim: Double
    }

    static func compute(_ i: Inputs) -> Result {
        let p = ToolFormat.parseNum
        let motor = i.motor

        let stageRatios: [Double] = i.stages.map { s in
            if i.stageInput == .teeth {
                let dr = p(s.driving), dn = p(s.driven)
                return dr > 0 && dn > 0 ? dn / dr : .nan
            }
            let v = p(s.ratio)
            return v > 0 ? v : .nan
        }

        // The running product down the stack, printed after each row.
        var acc = 1.0
        let cumulative: [Double] = stageRatios.map { v in
            acc = v.isFinite && v > 0 ? acc * v : .nan
            return acc
        }

        let stagesValid = stageRatios.allSatisfy { $0.isFinite && $0 > 0 }
        let G = stagesValid ? stageRatios.reduce(1, *) : .nan

        let n = JS.max(1, JS.round(p(i.count)))
        let etaTotal = p(i.eff) / 100

        // Speed: pure kinematics, exact.
        let outRpm = G.isFinite && G > 0 ? motor.freeRpm / G : .nan
        let wheelIn = p(i.wheel)
        let vFreeFps = (outRpm * Double.pi * wheelIn) / 12 / 60
        let vAdjFps = vFreeFps * (p(i.derate) / 100)

        // Torque: linear DC-motor model at the current limit,
        // t(I) = t_stall x (I - I_free) / (I_stall - I_free).
        let iLim = p(i.limit)
        let span = motor.stallA - motor.freeA
        let tauMotorRaw = span > 0 ? (motor.stallNm * (iLim - motor.freeA)) / span : .nan
        let tauMotor = tauMotorRaw.isFinite ? JS.min(JS.max(tauMotorRaw, 0), motor.stallNm) : .nan
        let currentLimited = iLim < motor.stallA

        let tauOut = G.isFinite && tauMotor.isFinite ? n * tauMotor * G * etaTotal : .nan

        // Drivetrain force against traction.
        let rWheelM = (wheelIn / 2) * mPerIn
        let fPushN = rWheelM > 0 ? tauOut / rWheelM : .nan
        let fPushLb = fPushN / lbfToN

        let weightLb = p(i.weight)
        let fracOnDriven = p(i.weightFrac) / 100
        let fTracLb = p(i.mu) * weightLb * fracOnDriven

        let usableLb = JS.min(fPushLb, fTracLb)
        let tractionLimited = fPushLb > fTracLb
        let accelG = weightLb > 0 ? usableLb / weightLb : .nan
        let accelFtS2 = accelG * gFtS2

        // Mechanism: force at the end of a lever.
        let armIn = p(i.arm)
        let fArmLb = armIn > 0 ? tauOut / (armIn * mPerIn) / lbfToN : .nan

        // Electrical. The linear sag model would report a negative bus voltage at absurd
        // draws, so it's floored at 0.
        let iTotal = n * iLim
        let vBus = JS.max(0, p(i.voc) - iTotal * p(i.rInt))

        let power: Power = iTotal > mainBreakerA ? .over : (iTotal > mainBreakerA * 0.85 ? .warn : .ok)
        let brownout: Brownout = vBus <= brownoutV ? .brownout : (vBus <= railDroopV ? .marginal : .safe)

        return Result(stageRatios: stageRatios, cumulative: cumulative, stagesValid: stagesValid, G: G, n: n, etaTotal: etaTotal,
                      outRpm: outRpm, vFreeFps: vFreeFps, vAdjFps: vAdjFps, tauMotor: tauMotor, tauOut: tauOut,
                      currentLimited: currentLimited, fPushLb: fPushLb, fTracLb: fTracLb, usableLb: usableLb,
                      tractionLimited: tractionLimited, accelG: accelG, accelFtS2: accelFtS2, fArmLb: fArmLb,
                      iTotal: iTotal, vBus: vBus, power: power, brownout: brownout, wheelIn: wheelIn, armIn: armIn, iLim: iLim)
    }

    /// The efficiency the entered meshes suggest: 0.95 to the number of stages, as a percent
    /// with one decimal.
    static func suggestedEff(stageCount: Int) -> Double {
        JS.round(pow(0.95, Double(stageCount)) * 1000) / 10
    }

    /// The push meter's fill: usable force as a share of whichever limit is higher.
    static func pushPct(_ r: Result) -> Double {
        JS.max(0, JS.min(100, (r.usableLb / JS.max(r.fPushLb, r.fTracLb, 1e-9)) * 100))
    }

    // MARK: Words

    static func reductionsCaption(_ count: Int) -> String {
        "\(count) \(count == 1 ? "reduction" : "reductions"), entered as"
    }

    static func stageHere(_ ratio: Double) -> String {
        ratio.isFinite ? "\(ToolFormat.fixed(ratio, 3)):1 here" : "check this stage"
    }

    static func stageSoFar(_ running: Double) -> String {
        running.isFinite ? ToolFormat.fixed(running, 2) : "n/a"
    }

    static func overallFigure(_ r: Result) -> String {
        r.stagesValid ? ToolFormat.fixed(r.G, 2) : "n/a"
    }

    static func overallCaption(_ r: Result, _ i: Inputs) -> String {
        let count = i.stages.count
        return r.stagesValid
            ? "\(JS.string(r.n)) x \(i.motor.label), \(count) \(count == 1 ? "stage" : "stages"), \(ToolFormat.fixed(r.etaTotal * 100, 0))% efficient"
            : "one of the stages above is not a usable number"
    }

    /// The efficiency hint, split around the suggested figure (which is a button).
    static func efficiencyHint(stageCount: Int) -> (before: String, figure: String, after: String) {
        let stages = "\(stageCount) \(stageCount == 1 ? "stage" : "stages")"
        return ("Roughly 95% per spur mesh and 97% per chain or belt run. With \(stages) entered, 0.95 to the \(stageCount) is",
                "\(ToolFormat.fixed(suggestedEff(stageCount: stageCount), 1))%",
                ". If one line above is really a whole gearbox, use its own figure.")
    }

    static func pushMeterLine(_ r: Result) -> String {
        let fmt = ToolFormat.fixed
        return "using \(fmt(r.usableLb, 1)) of \(fmt(JS.max(r.fPushLb, r.fTracLb), 1)) lbf available, so you are \(r.tractionLimited ? "traction-limited" : "torque-limited")"
    }

    static func limitExplanation(_ r: Result) -> String {
        r.tractionLimited
            ? "The gearing can make more force than the carpet will hold, so the wheels spin before the motors stall. More reduction buys nothing here. Grippier tread, more weight over the driven wheels, or a lower current limit is the real fix."
            : "The carpet would hold more than the motors can deliver, so the wheels grip and the motors bog down. More reduction, more motors, or a higher current limit would let you push harder, if the breakers allow it."
    }

    static func mechanismExplanation(_ r: Result, _ motor: Motor) -> String {
        let fmt = ToolFormat.fixed
        return r.currentLimited
            ? "Each motor is capped at \(fmt(r.tauMotor, 3)) N·m by your \(fmt(r.iLim, 0)) A limit, which is \(fmt((r.tauMotor / motor.stallNm) * 100, 0))% of its \(fmt(motor.stallNm, 2)) N·m stall torque. This is peak torque at zero speed, not a number you hold while moving."
            : "Your \(fmt(r.iLim, 0)) A limit is at or above this motor's \(fmt(motor.stallA, 0)) A stall current, so torque sits at the full \(fmt(motor.stallNm, 2)) N·m stall value and the limit is doing nothing."
    }

    /// The ceiling note's headline (bold on the site) and the sentence after it.
    static func powerSentence(_ r: Result) -> (strong: String?, rest: String) {
        let fmt = ToolFormat.fixed
        let lead: (String?, String)
        switch r.power {
        case .over:
            lead = ("\(fmt(r.iTotal, 0)) A is past the 120 A main breaker.",
                    "The breaker is thermal, so a spike while you shove another robot is fine. Sustained draw at this level trips it and kills the whole robot. ")
        case .warn:
            lead = ("Close to the 120 A main breaker", "before you have added an intake, a shooter or an elevator. ")
        case .ok:
            lead = (nil, "The drivetrain leaves \(fmt(mainBreakerA - r.iTotal, 0)) A under the main breaker for your other mechanisms. ")
        }
        let sag: String
        switch r.brownout {
        case .brownout:
            sag = "At this draw the pack sags to about \(fmt(r.vBus, 2)) V, at or below the \(JS.string(brownoutV)) V line where the roboRIO disables your outputs."
        case .marginal:
            sag = "The pack sags to about \(fmt(r.vBus, 2)) V, under the \(JS.string(railDroopV)) V point where the 6 V rail starts to droop but still above the brownout line."
        case .safe:
            sag = "Estimated sag to \(fmt(r.vBus, 2)) V keeps you clear of the brownout line."
        }
        return (lead.0, lead.1 + sag)
    }

    static func headroomLine(_ r: Result) -> String {
        let fmt = ToolFormat.fixed
        return r.iTotal <= mainBreakerA
            ? "\(fmt(mainBreakerA - r.iTotal, 0)) A of headroom left for everything else"
            : "\(fmt(r.iTotal - mainBreakerA, 0)) A over the main breaker"
    }

    static func busLine(_ r: Result) -> String {
        "estimated bus voltage \(ToolFormat.fixed(r.vBus, 2)) V, brownout at \(JS.string(brownoutV)) V"
    }

    /// Every formula with the entered numbers in it.
    static func working(_ r: Result, _ i: Inputs) -> [(title: String, formula: String, worked: String)] {
        let fmt = ToolFormat.fixed
        let p = ToolFormat.parseNum
        let motor = i.motor
        let isDrive = i.mode == .drivetrain
        var rows: [(String, String, String)] = []
        let product = r.stageRatios.map { $0.isFinite ? fmt($0, 3) : "n/a" }.joined(separator: " x ")
        rows.append(("Overall reduction", "G = product of (driven / driving)",
                     r.stageRatios.count > 1
                        ? "G = \(product) = \(r.stagesValid ? fmt(r.G, 4) : "n/a")"
                        : "G = \(r.stagesValid ? fmt(r.G, 4) : "n/a")"))
        rows.append((isDrive ? "Wheel speed" : "Output speed", "n_out = n_free / G",
                     "n_out = \(fmt(motor.freeRpm, 0)) RPM / \(fmt(r.G, 4)) = \(fmt(r.outRpm, 1)) RPM"))
        if isDrive {
            rows.append(("Free speed", "v = n_out x pi x D",
                         "v = \(fmt(r.outRpm, 1)) rev/min x pi x \(fmt(r.wheelIn, 2)) in / 12 / 60 = \(fmt(r.vFreeFps, 2)) ft/s"))
            rows.append(("Adjusted speed", "v_adj = v x derate",
                         "v_adj = \(fmt(r.vFreeFps, 2)) ft/s x \(fmt(p(i.derate), 0))% = \(fmt(r.vAdjFps, 2)) ft/s"))
        }
        rows.append(("Torque from one motor at your limit", "t_m = t_stall x (I_limit - I_free) / (I_stall - I_free)",
                     "t_m = \(fmt(motor.stallNm, 2)) x (\(fmt(r.iLim, 0)) - \(fmt(motor.freeA, 1))) / (\(fmt(motor.stallA, 0)) - \(fmt(motor.freeA, 1))) = \(fmt(r.tauMotor, 3)) N·m"))
        rows.append((isDrive ? "Torque at the wheels" : "Torque at the output", "t_out = N x t_m x G x eta",
                     "t_out = \(JS.string(r.n)) x \(fmt(r.tauMotor, 3)) x \(fmt(r.G, 4)) x \(fmt(r.etaTotal, 2)) = \(fmt(r.tauOut, 2)) N·m"))
        if isDrive {
            rows.append(("Pushing force", "F = t_out / (D / 2)",
                         "F = \(fmt(r.tauOut, 2)) N·m / \(fmt((r.wheelIn / 2) * mPerIn, 4)) m = \(fmt(r.fPushLb * lbfToN, 1)) N = \(fmt(r.fPushLb, 1)) lbf"))
            rows.append(("Traction limit", "F_max = mu x W x (weight on driven wheels)",
                         "F_max = \(fmt(p(i.mu), 2)) x \(fmt(p(i.weight), 0)) lb x \(fmt(p(i.weightFrac), 0))% = \(fmt(r.fTracLb, 1)) lbf"))
            rows.append(("Acceleration", "a = F_usable / W x g",
                         "a = \(fmt(r.usableLb, 1)) lbf / \(fmt(p(i.weight), 0)) lb x 32.17 = \(fmt(r.accelFtS2, 1)) ft/s2 (\(fmt(r.accelG, 2)) g)"))
        } else {
            rows.append(("Force at the lever", "F = t_out / radius",
                         "F = \(fmt(r.tauOut, 2)) N·m / \(fmt(r.armIn * mPerIn, 4)) m = \(fmt(r.fArmLb * lbfToN, 1)) N = \(fmt(r.fArmLb, 1)) lbf"))
        }
        rows.append(("Current and sag", "I = N x I_limit, V_bus = V_oc - I x R_int",
                     "I = \(JS.string(r.n)) x \(fmt(r.iLim, 0)) = \(fmt(r.iTotal, 0)) A, V_bus = \(fmt(p(i.voc), 2)) - \(fmt(r.iTotal, 0)) x \(fmt(p(i.rInt), 3)) = \(fmt(r.vBus, 2)) V"))
        return rows.map { (title: $0.0, formula: $0.1, worked: $0.2) }
    }

    // MARK: Editing, like the site's handlers

    /// Applies a preset to every field. `nextID` hands out fresh stage ids.
    static func apply(_ preset: Preset, to i: inout Inputs, nextID: () -> Int) {
        i.presetKey = preset.key
        i.mode = preset.mode
        i.motorKey = preset.motor
        i.count = preset.count
        i.stageInput = preset.stageInput
        i.stages = preset.stages.map { Stage(id: nextID(), driving: $0.driving, driven: $0.driven, ratio: $0.ratio) }
        i.eff = preset.eff
        i.wheel = preset.wheel
        i.weight = preset.weight
        i.mu = preset.mu
        i.weightFrac = preset.weightFrac
        i.derate = preset.derate
        i.limit = preset.limit
        i.arm = preset.arm
    }

    /// Switching to ratios collapses each mesh's teeth into its ratio (teeth carry all the
    /// information); switching back keeps the teeth that were there.
    static func switchStageInput(_ next: StageInput, in i: inout Inputs) {
        guard next != i.stageInput else { return }
        if next == .ratio {
            i.stages = i.stages.map { s in
                let dr = ToolFormat.parseNum(s.driving), dn = ToolFormat.parseNum(s.driven)
                guard dr > 0 && dn > 0 else { return s }
                var copy = s
                copy.ratio = JS.string(JS.round((dn / dr) * 1000) / 1000)
                return copy
            }
        }
        i.stageInput = next
    }

    /// "Add another mesh": a 1:3 stage.
    static func newStage(id: Int) -> Stage {
        Stage(id: id, driving: "1", driven: "3", ratio: "3")
    }
}
