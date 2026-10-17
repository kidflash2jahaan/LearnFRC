import Foundation

/// The Current Budget & Brownout sheet (learnfrc.com/tools/frc-current-budget), ported from
/// the site's `_calculator.tsx`: the same motor library, breaker and brownout constants,
/// the same per-motor breaker check and the same first-order battery sag.
nonisolated enum CurrentBudgetMath {
    static let mainBreakerA: Double = 120          // Cooper Bussmann CB285-120
    static let branchRatings: [Int] = [40, 30, 20, 10]   // Snap-Action MX5 / VB3
    static let roboRIO1BrownoutV: Double = 6.3     // roboRIO 1.0, fixed (WPILib)
    static let roboRIO2BrownoutDefaultV: Double = 6.75   // roboRIO 2.0 default, software-settable
    static let stage1RailV: Double = 6.8           // 6 V PWM rail begins to droop (WPILib)
    static let blackoutV: Double = 4.5             // possible device blackout (WPILib)
    static let recoveryV: Double = 7.5             // brownout recovery (WPILib)
    static let batteryBriefMaxA: Double = 180      // battery can briefly supply over 180 A (WPILib)

    static let defaultVocV: Double = 12.5
    static let defaultRintOhm: Double = 0.015
    static let rintMinOhm: Double = 0.011
    static let rintMaxOhm: Double = 0.02

    struct Motor: Hashable, Sendable, Identifiable {
        let key: String
        let name: String
        let freeRpm: Double
        let stallA: Double
        let freeA: Double
        let stallNm: Double
        var legacy = false
        var note: String?
        let source: String

        var id: String { key }
        /// The name as the motor menu lists it.
        var menuName: String { name + (legacy ? " (legacy)" : "") }
    }

    /// FIRST 2017 Motor Information sheet plus vendor spec pages.
    static let motors: [Motor] = [
        Motor(key: "kraken-trap", name: "Kraken X60 (Trapezoidal)", freeRpm: 6000, stallA: 366, freeA: 2, stallNm: 7.09,
              note: "WCP Trapezoidal at 12 V", source: "WCP Kraken X60 motor-performance (Trap)"),
        Motor(key: "kraken-foc", name: "Kraken X60 (FOC)", freeRpm: 5800, stallA: 483, freeA: 2, stallNm: 9.37,
              note: "WCP Field-Oriented Control at 12 V, higher stall than Trap mode", source: "WCP Kraken X60 motor-performance (FOC)"),
        Motor(key: "falcon500", name: "Falcon 500", freeRpm: 6380, stallA: 257, freeA: 1.5, stallNm: 4.69, legacy: true,
              note: "Discontinued but still legal and common", source: "CTRE Falcon 500 (Talon FX) User Guide"),
        Motor(key: "neo", name: "REV NEO (V1.1)", freeRpm: 5676, stallA: 105, freeA: 1.8, stallNm: 2.6, source: "REV-21-1650 data sheet"),
        Motor(key: "neo-vortex", name: "REV NEO Vortex", freeRpm: 6784, stallA: 211, freeA: 3.6, stallNm: 3.6, source: "REV NEO Vortex specs"),
        Motor(key: "neo550", name: "REV NEO 550", freeRpm: 11000, stallA: 100, freeA: 1.4, stallNm: 0.97, source: "REV NEO 550 specs"),
        Motor(key: "cim", name: "CIM", freeRpm: 5310, stallA: 133, freeA: 2.7, stallNm: 2.43,
              note: "FIRST 2017 sheet: 5310 rpm and 133 A. VEX/AndyMark sheets list 5330 rpm and 131 A.", source: "FIRST 2017 Motor Information"),
        Motor(key: "minicim", name: "MiniCIM", freeRpm: 6200, stallA: 86, freeA: 1.5, stallNm: 1.4, source: "FIRST 2017 Motor Information"),
        Motor(key: "bag", name: "BAG", freeRpm: 14000, stallA: 41, freeA: 1.8, stallNm: 0.4, source: "FIRST 2017 Motor Information"),
        Motor(key: "775pro", name: "775pro", freeRpm: 18700, stallA: 134, freeA: 0.7, stallNm: 0.71, source: "FIRST 2017 Motor Information"),
    ]

    static func motor(_ key: String) -> Motor? { motors.first { $0.key == key } }

    enum CurrentMode: String, Hashable, Sendable, CaseIterable {
        case limit, running, worst

        /// The table's word for it.
        var word: String {
            switch self {
            case .limit: "smart limit"
            case .running: "free running"
            case .worst: "stalled"
            }
        }

        /// The menu's word for it.
        var menuTitle: String {
            switch self {
            case .limit: "Smart limit"
            case .running: "Free running"
            case .worst: "Stalled"
            }
        }
    }

    struct MechMotor: Hashable, Sendable, Identifiable {
        var id: Int
        var motorKey: String
        var mode: CurrentMode
        /// Amps as typed, only used in `.limit` mode.
        var limit: String
        /// The motor controller's own branch breaker.
        var branch: Int
    }

    struct Mechanism: Hashable, Sendable, Identifiable {
        var id: Int
        var name: String
        /// Counted in the simultaneous total.
        var running: Bool
        var motors: [MechMotor]
    }

    enum Status: String, Hashable, Sendable { case ok, warn, over }
    enum Brownout: String, Hashable, Sendable { case safe, marginal, brownout }
    enum RoboRIO: String, Hashable, Sendable, CaseIterable {
        case v2 = "2.0", v1 = "1.0"
        var title: String { "roboRIO \(rawValue)" }
    }

    struct Inputs: Hashable, Sendable {
        var rorio: RoboRIO = .v2
        var brownout2: String = JS.string(roboRIO2BrownoutDefaultV)
        var vOc: String = JS.string(defaultVocV)
        var rInt: Double = defaultRintOhm
        var mechanisms: [Mechanism] = CurrentBudgetMath.typicalDrive()
    }

    /// The typical drive: a four-Kraken drivetrain at a 40 A limit with the intake and the
    /// elevator idle. Each motor controller sits on its own branch breaker, so four drive
    /// motors are four 40 A breakers, never one.
    static func typicalDrive() -> [Mechanism] {
        var seed = 0
        func id() -> Int { seed += 1; return seed }
        return [
            Mechanism(id: id(), name: "Drivetrain", running: true, motors: [
                MechMotor(id: id(), motorKey: "kraken-trap", mode: .limit, limit: "40", branch: 40),
                MechMotor(id: id(), motorKey: "kraken-trap", mode: .limit, limit: "40", branch: 40),
                MechMotor(id: id(), motorKey: "kraken-trap", mode: .limit, limit: "40", branch: 40),
                MechMotor(id: id(), motorKey: "kraken-trap", mode: .limit, limit: "40", branch: 40),
            ]),
            Mechanism(id: id(), name: "Intake", running: false, motors: [
                MechMotor(id: id(), motorKey: "neo", mode: .limit, limit: "30", branch: 30),
            ]),
            Mechanism(id: id(), name: "Elevator", running: false, motors: [
                MechMotor(id: id(), motorKey: "falcon500", mode: .limit, limit: "40", branch: 40),
                MechMotor(id: id(), motorKey: "falcon500", mode: .limit, limit: "40", branch: 40),
            ]),
        ]
    }

    /// Full send: the same robot with every mechanism running and every motor stalled,
    /// which is what a pin against the wall looks like electrically. `nextID` hands out
    /// fresh motor ids.
    static func fullSend(nextID: () -> Int) -> [Mechanism] {
        typicalDrive().map { mechanism in
            var copy = mechanism
            copy.running = true
            copy.motors = mechanism.motors.map { motor in
                var m = motor
                m.id = nextID()
                m.mode = .worst
                return m
            }
            return copy
        }
    }

    /// A motor added to a mechanism: a NEO at a 40 A limit on a 40 A breaker.
    static func newMotor(id: Int) -> MechMotor {
        MechMotor(id: id, motorKey: "neo", mode: .limit, limit: "40", branch: 40)
    }

    /// A mechanism added to the list: "Mechanism N", running, with one new motor.
    static func newMechanism(id: Int, motorID: Int, existing: Int) -> Mechanism {
        Mechanism(id: id, name: "Mechanism \(existing + 1)", running: true, motors: [newMotor(id: motorID)])
    }

    /// Current one motor contributes in its mode.
    static func motorCurrent(_ mm: MechMotor) -> Double {
        guard let motor = motor(mm.motorKey) else { return 0 }
        switch mm.mode {
        case .worst: return motor.stallA
        case .running: return motor.freeA
        case .limit:
            let lim = ToolFormat.num(mm.limit, 0)
            return lim > 0 ? lim : 0
        }
    }

    struct MotorCheck: Hashable, Sendable {
        let motor: MechMotor
        let current: Double
        let status: Status
    }

    struct MechanismCheck: Hashable, Sendable {
        let mechanism: Mechanism
        let motors: [MotorCheck]
        let current: Double
        let branchStatus: Status
    }

    /// One line of the per-motor breaker table.
    struct Row: Hashable, Sendable, Identifiable {
        let id: String
        let mechName: String
        let running: Bool
        let motorName: String
        let mode: CurrentMode
        let branch: Int
        let current: Double
        let status: Status

        var headroom: String {
            current <= Double(branch)
                ? "\(ToolFormat.fixed(Double(branch) - current, 0)) A left"
                : "\(ToolFormat.fixed(current - Double(branch), 0)) A over"
        }

        var verdict: String {
            switch status {
            case .over: "trips on a sustained pull"
            case .warn: "within 15% of the breaker"
            case .ok: "fine"
            }
        }
    }

    struct Result: Hashable, Sendable {
        let brownoutThreshold: Double
        let perMech: [MechanismCheck]
        let rows: [Row]
        let iTotal: Double
        let vOc: Double
        let vBus: Double
        let mainStatus: Status
        let brownoutVerdict: Brownout
        let callouts: [String]
        let runningCount: Int
        let mechanismCount: Int

        var headroomA: Double { mainBreakerA - iTotal }
        var marginV: Double { vBus - brownoutThreshold }
        /// Below the blackout floor the linear sag model has nothing left to say.
        var offScale: Bool { vBus < blackoutV }
    }

    static func brownoutThreshold(_ i: Inputs) -> Double {
        i.rorio == .v1 ? roboRIO1BrownoutV : ToolFormat.num(i.brownout2, roboRIO2BrownoutDefaultV)
    }

    static func compute(_ i: Inputs) -> Result {
        let threshold = brownoutThreshold(i)
        let fmt = ToolFormat.fixed

        let perMech: [MechanismCheck] = i.mechanisms.map { m in
            // Each motor is protected by its own branch breaker, so the check is per motor,
            // never the summed mechanism total.
            let motors: [MotorCheck] = m.motors.map { mm in
                let current = motorCurrent(mm)
                let branch = Double(mm.branch)
                let status: Status = current > branch ? .over : (current > branch * 0.85 ? .warn : .ok)
                return MotorCheck(motor: mm, current: current, status: status)
            }
            // The mechanism total still feeds the 120 A main and the battery sag.
            let current = motors.reduce(0) { $0 + $1.current }
            let branchStatus: Status = motors.contains { $0.status == .over } ? .over
                : (motors.contains { $0.status == .warn } ? .warn : .ok)
            return MechanismCheck(mechanism: m, motors: motors, current: current, branchStatus: branchStatus)
        }

        let iTotal = perMech.filter { $0.mechanism.running }.reduce(0) { $0 + $1.current }
        let vOcNum = ToolFormat.num(i.vOc, defaultVocV)
        let vBus = vOcNum - iTotal * i.rInt

        let mainStatus: Status = iTotal > mainBreakerA ? .over : (iTotal > mainBreakerA * 0.85 ? .warn : .ok)

        let brownoutVerdict: Brownout
        if vBus <= threshold { brownoutVerdict = .brownout }
        else if vBus <= stage1RailV { brownoutVerdict = .marginal }
        else { brownoutVerdict = .safe }

        // Plain-language callouts. Branch breakers are per motor controller, so they describe
        // single motors against their own breaker.
        var callouts: [String] = []
        for p in perMech {
            let name = p.mechanism.name
            let over = p.motors.filter { $0.status == .over }
            let warn = p.motors.filter { $0.status == .warn }
            if over.count == 1 {
                let x = over[0]
                callouts.append("A \(name) motor pulls \(fmt(x.current, 0)) A through a \(x.motor.branch) A branch breaker. It trips on a sustained pull.")
            } else if over.count > 1 {
                let maxA = over.map(\.current).reduce(-Double.infinity) { JS.max($0, $1) }
                let sameBranch = over.allSatisfy { $0.motor.branch == over[0].motor.branch }
                callouts.append(sameBranch
                    ? "\(name): \(over.count) motors each exceed their \(over[0].motor.branch) A branch breaker, up to \(fmt(maxA, 0)) A. Each one trips on a sustained pull."
                    : "\(name): \(over.count) motors exceed their own branch breakers, up to \(fmt(maxA, 0)) A. Each one trips on a sustained pull.")
            }
            if warn.count == 1 {
                let x = warn[0]
                callouts.append("A \(name) motor at \(fmt(x.current, 0)) A sits within 15% of its \(x.motor.branch) A branch breaker. There is almost no headroom left.")
            } else if warn.count > 1 {
                let avgA = warn.reduce(0) { $0 + $1.current } / Double(warn.count)
                let sameBranch = warn.allSatisfy { $0.motor.branch == warn[0].motor.branch }
                callouts.append(sameBranch
                    ? "\(name): each of the \(warn.count) motors sits near \(fmt(avgA, 0)) A against a \(warn[0].motor.branch) A branch breaker. There is almost no headroom left."
                    : "\(name): \(warn.count) motors sit within 15% of their own branch breakers. There is almost no headroom left.")
            }
        }
        if mainStatus == .over {
            callouts.append("Simultaneous draw of about \(fmt(iTotal, 0)) A is past the 120 A main breaker. A sustained overage trips it, and the pack can only source over \(JS.string(batteryBriefMaxA)) A for an instant.")
        } else if mainStatus == .warn {
            callouts.append("Simultaneous draw of about \(fmt(iTotal, 0)) A is close to the 120 A main breaker.")
        }
        if brownoutVerdict == .brownout {
            callouts.append("Estimated bus voltage of \(fmt(vBus, 2)) V is at or below the \(fmt(threshold, 2)) V brownout line, so the roboRIO would disable outputs.")
        } else if brownoutVerdict == .marginal {
            callouts.append("Estimated bus voltage of \(fmt(vBus, 2)) V is under the \(JS.string(stage1RailV)) V rail-droop point but still above the \(fmt(threshold, 2)) V brownout line.")
        }

        // One flat row per motor, so the whole robot reads as one ruled table.
        let rows: [Row] = perMech.flatMap { p in
            p.motors.map { x in
                Row(id: "\(p.mechanism.id)-\(x.motor.id)", mechName: p.mechanism.name, running: p.mechanism.running,
                    motorName: motor(x.motor.motorKey)?.name ?? "Motor", mode: x.motor.mode, branch: x.motor.branch,
                    current: x.current, status: x.status)
            }
        }

        return Result(brownoutThreshold: threshold, perMech: perMech, rows: rows, iTotal: iTotal, vOc: vOcNum, vBus: vBus,
                      mainStatus: mainStatus, brownoutVerdict: brownoutVerdict, callouts: callouts,
                      runningCount: i.mechanisms.filter(\.running).count, mechanismCount: i.mechanisms.count)
    }

    // MARK: The verdict

    static func verdictLine(_ r: Result) -> String {
        switch (r.brownoutVerdict, r.mainStatus) {
        case (.brownout, _): "The pack sags past the brownout line."
        case (.marginal, _): "The pack sags into the rail-droop band."
        case (_, .over): "Voltage holds, but the main breaker does not."
        default: "Everything here can run at once."
        }
    }

    static func verdictBody(_ r: Result) -> String {
        let fmt = ToolFormat.fixed
        switch r.brownoutVerdict {
        case .brownout:
            return r.offScale
                ? "About \(fmt(r.iTotal, 0)) A drags the pack under the \(JS.string(blackoutV)) V blackout floor, off the bottom of the sag model. This is not a brownout you drive through, it is the robot switching off."
                : "At \(fmt(r.vBus, 2)) V the roboRIO sheds load: PWM outputs cut and the robot stops answering."
        case .marginal:
            return "At \(fmt(r.vBus, 2)) V the 6 V rail starts to droop before the \(fmt(r.brownoutThreshold, 2)) V brownout line. Servos and sensors on that rail go first."
        case .safe:
            return r.mainStatus == .over
                ? "About \(fmt(r.iTotal, 0)) A is past the 120 A main breaker, so a sustained pull kills robot power outright."
                : "\(fmt(r.vBus, 2)) V at the board, \(fmt(r.marginV, 2)) V clear of the \(fmt(r.brownoutThreshold, 2)) V brownout line."
        }
    }

    static func kicker(_ r: Result) -> String {
        "verdict / \(r.runningCount) of \(r.mechanismCount) mechanisms running"
    }

    /// The three stamped figures: amps drawn, volts left, headroom under the main.
    static func stamps(_ r: Result) -> [(value: String, label: String)] {
        let fmt = ToolFormat.fixed
        return [
            (fmt(r.iTotal, 0), "amps drawn at once"),
            (r.offScale ? "dark" : fmt(r.vBus, 2),
             r.offScale ? "under the \(JS.string(blackoutV)) V blackout floor" : "volts left at the board"),
            (fmt(abs(r.headroomA), 0), "amps \(r.headroomA >= 0 ? "under" : "over") the 120 A main"),
        ]
    }

    /// The pack tag's footer: the lines its four numbers draw.
    static func packLines(_ r: Result, rorio: RoboRIO, rInt: Double) -> [(term: String, value: String)] {
        let fmt = ToolFormat.fixed
        return [
            ("brownout line", "\(fmt(r.brownoutThreshold, 2)) V on the roboRIO \(rorio.rawValue)"),
            ("rail droop", "\(JS.string(stage1RailV)) V, where the 6 V PWM rail starts to sag"),
            ("sag right now", "\(fmt(r.vOc, 2)) V resting minus \(fmt(r.iTotal, 0)) A times \(JS.toFixed(rInt, 3)) Ω is \(fmt(r.vBus, 2)) V"),
            ("margin", r.marginV >= 0
                ? "\(fmt(r.marginV, 2)) V above the brownout line"
                : "\(fmt(abs(r.marginV), 2)) V below the brownout line"),
            ("blackout floor", "\(JS.string(blackoutV)) V, devices can drop out. Recovery at \(JS.string(recoveryV)) V."),
        ]
    }

    /// What a motor row prints instead of the amps field when it isn't on a smart limit:
    /// "366 A at stall", "2 A idling".
    static func fixedDraw(_ mm: MechMotor) -> String {
        let draw = motorCurrent(mm)
        let tail = motor(mm.motorKey) == nil ? "" : (mm.mode == .worst ? "at stall" : "idling")
        return "\(ToolFormat.fixed(draw, 0)) A \(tail)"
    }

    /// A mechanism card's subtotal caption.
    static func mechanismTotalCaption(running: Bool) -> String {
        "A total" + (running ? "" : ", not counted while idle")
    }
}
