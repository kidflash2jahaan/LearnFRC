import Foundation

/// The Team Budget Calculator's sheet (learnfrc.com/tools/frc-budget-calculator), ported
/// line for line from the site's `_calculator.tsx`: the same sourced fees, the same
/// documented ranges, the same line items and the same arithmetic in the same order.
nonisolated enum BudgetMath {
    static let season = "2025-2026"
    static let asListed = "as listed 2026-07"

    /// A primary-sourced figure, with the footnote line and the page it came from.
    struct Fee: Hashable, Sendable {
        let value: Double
        let cite: String
        let url: String
    }

    enum Fees {
        static let baseReg = Fee(value: 6300, cite: "$6,300: FIRST base team/season registration, all teams incl. rookies (2025-2026)",
                                 url: "https://community.firstinspires.org/2025-2026-first-program-registration-pricing")
        static let addlRegional = Fee(value: 3000, cite: "$3,000: each additional Regional beyond the first (FIRST 2025-2026)",
                                      url: "https://community.firstinspires.org/2025-2026-first-program-registration-pricing")
        static let am14u6 = Fee(value: 940, cite: "$940: AndyMark AM14U6 KOP drive base (2026 Kit of Parts)",
                                url: "https://andymark.com/products/am14u6-6-wheel-drop-center-robot-drive-base-2025-frc-kit-of-parts-drive-base")
        static let roboRIO = Fee(value: 485, cite: "$485: NI roboRIO 2.0 (\(asListed))",
                                 url: "https://andymark.com/products/ni-roborio-2")
        static let pdh = Fee(value: 250, cite: "$250: REV Power Distribution Hub, REV-11-1850 (\(asListed))",
                             url: "https://www.revrobotics.com/rev-11-1850/")
        static let radio = Fee(value: 184.99, cite: "$184.99: Vivid-Hosting VH-109 FRC Radio, FRC/education price (2025-2026)",
                               url: "https://store.ctr-electronics.com/products/frc-radio")
        static let radioPowerModule = Fee(value: 34, cite: "$34: REV Radio Power Module, REV-11-1856 (\(asListed))",
                                          url: "https://www.revrobotics.com/rev-11-1856/")
        static let battery = Fee(value: 58, cite: "$58 ea: MK ES17-12 12V 18Ah SLA battery (set of 2 = $116, \(asListed))",
                                 url: "https://andymark.com/products/mk-es17-12-12v-sla-battery-set-of-2")
        static let neo = Fee(value: 42.5, cite: "$42.50: REV NEO Brushless Motor V1.1 (sale, down from $50.00, \(asListed))",
                             url: "https://www.revrobotics.com/rev-21-1650/")
        static let sparkMax = Fee(value: 100, cite: "$100: REV SPARK MAX controller, one required per NEO (\(asListed))",
                                  url: "https://www.revrobotics.com/rev-11-2158/")
        static let kraken = Fee(value: 217.99, cite: "$217.99: Kraken X60 w/ integrated Talon FX, FRC price (MSRP $399.99, \(asListed)); no separate controller",
                                url: "https://wcproducts.com/products/kraken")
        static let bundle3230 = Fee(value: 3230, cite: "$3,230: AndyMark FRC Basic Starter Bundle WITH roboRIO (\(asListed))",
                                    url: "https://andymark.com/products/frc-basic-starter-bundle-1")
        static let bundle2750 = Fee(value: 2750, cite: "$2,750: AndyMark FRC Basic Starter Bundle WITHOUT roboRIO (\(asListed))",
                                    url: "https://andymark.com/products/frc-basic-starter-bundle-1")

        /// Every sourced default, in the order the back of the sheet lists them.
        static let all: [Fee] = [baseReg, addlRegional, am14u6, roboRIO, pdh, radio, radioPowerModule,
                                 battery, neo, sparkMax, kraken, bundle3230, bundle2750]
    }

    /// Documented ranges for values that must never pass as a false-precise fact. They seed
    /// editable inputs, and the low and high ends feed the estimate band.
    enum Ranges {
        static let districtFeeLow: Double = 3500
        static let districtFeeHigh: Double = 5500
        static let districtFeeDefault: Double = 4500
        static let districtFeeURL = "https://firstwa.org/frc-registration/"
        static let consumablesLow: Double = 40
        static let consumablesHigh: Double = 80
        static let consumablesDefault: Double = 60
        static let consumablesURL = "https://andymark.com/products/frc-basic-starter-bundle-1"
        static let travelPerEventLow: Double = 500
        static let travelPerEventHigh: Double = 5000
    }

    /// The FIRST Championship fee isn't published for 2026; this is the last publicly cited
    /// figure (about $5,750 in 2024), seeded as an editable, flagged estimate.
    static let champsFeeLastKnown: Double = 5750

    enum TeamType: String, Hashable, Sendable, CaseIterable { case rookie, veteran }
    enum ProgramModel: String, Hashable, Sendable, CaseIterable { case regional, district }
    enum DrivetrainChoice: String, Hashable, Sendable, CaseIterable { case kop, swerve, reuse }
    enum ElectronicsPath: String, Hashable, Sendable, CaseIterable { case fullNew, bundle3230, bundle2750, own }

    /// Everything the person told the sheet. Numbers, like the site's state: its inputs
    /// clamp to zero and never hold text.
    struct Inputs: Hashable, Sendable {
        var teamType: TeamType = .rookie
        var programModel: ProgramModel = .regional
        var addlRegionals: Double = 0
        var districtEvents: Double = 2
        var districtFee: Double = Ranges.districtFeeDefault
        var attendDistrictChamps = false
        var districtChampsFee: Double = 0
        var attendFirstChamps = false
        var champsFee: Double = champsFeeLastKnown
        var grants: Double = 0
        var drivetrainChoice: DrivetrainChoice = .kop
        var swerveCost: Double = 0
        var electronicsPath: ElectronicsPath = .fullNew
        var batteryQty: Double = 2
        var consumables: Double = Ranges.consumablesDefault
        var neoQty: Double = 4
        var krakenQty: Double = 0
        var otherMotorQty: Double = 0
        var otherMotorUnit: Double = 0
        var toolsCost: Double = 0
        var travelPerEvent: Double = 0
        var sparesOther: Double = 0
        var teamSize: Double = 0
    }

    /// One ruled line of the ledger.
    struct LineItem: Hashable, Sendable {
        let label: String
        let amount: Double
        var source: Fee?
        var note: String?
        var estimate = false
    }

    struct Result: Hashable, Sendable {
        var registration: Double
        var drivetrain: Double
        var electronics: Double
        var motors: Double
        var tools: Double
        var travel: Double
        var spares: Double
        var grand: Double
        var low: Double
        var high: Double
        var perStudent: Double?
        var rookieBenefit: Double
        var events: Double
        var regItems: [LineItem]
        var driveItems: [LineItem]
        var elecItems: [LineItem]
        var motorItems: [LineItem]
        var toolItems: [LineItem]
        var travelItems: [LineItem]
        var spareItems: [LineItem]

        /// A documented range applies (`calc.high - calc.low > 1`).
        var hasBand: Bool { high - low > 1 }
    }

    /// `fmt0`: whole dollars.
    static func usd0(_ x: Double) -> String { JS.usd(x, 0) }
    /// `fmt2`: dollars and cents.
    static func usd2(_ x: Double) -> String { JS.usd(x, 2) }

    /// `$3,500`, the way the site prints a range end with `toLocaleString()`.
    private static func dollars(_ x: Double) -> String { "$" + JS.locale(x, 0) }

    private static func sum(_ items: [LineItem]) -> Double {
        items.reduce(0) { $0 + $1.amount }
    }

    // MARK: The sheet

    static func compute(_ i: Inputs) -> Result {
        let isRookie = i.teamType == .rookie

        // ---- Registration ----
        var regItems: [LineItem] = [
            LineItem(label: "FIRST base team registration", amount: Fees.baseReg.value, source: Fees.baseReg,
                     note: "Includes FIRST registration and your first Regional, on the Regional model."),
        ]
        if i.programModel == .regional && i.addlRegionals > 0 {
            regItems.append(LineItem(label: "Additional Regional events (\(JS.string(i.addlRegionals)) × $3,000)",
                                     amount: i.addlRegionals * Fees.addlRegional.value, source: Fees.addlRegional))
        }
        if i.programModel == .district {
            regItems.append(LineItem(label: "District program fee", amount: i.districtFee,
                                     note: "Region-specific, typically \(dollars(Ranges.districtFeeLow)) to \(dollars(Ranges.districtFeeHigh)) on top of the FIRST fee. Verify with your district each season.",
                                     estimate: true))
            if i.attendDistrictChamps && i.districtChampsFee > 0 {
                regItems.append(LineItem(label: "District Championship fee", amount: i.districtChampsFee,
                                         note: "Varies by district, so enter your district's figure.", estimate: true))
            }
        }
        if i.attendFirstChamps {
            regItems.append(LineItem(label: "FIRST Championship fee", amount: i.champsFee,
                                     note: "The 2026 fee is not published yet. Seeded with the last publicly cited figure, about $5,750 in 2024, so re-verify when FIRST posts 2026 pricing.",
                                     estimate: true))
        }
        if i.grants > 0 {
            regItems.append(LineItem(label: "Grants and sponsor vouchers, subtracted", amount: -i.grants,
                                     note: isRookie ? "Rookie teams may qualify for FIRST and sponsor startup grants." : nil))
        }
        let registration = sum(regItems)

        // ---- Drivetrain ----
        var driveItems: [LineItem] = []
        var drivetrain: Double = 0
        switch i.drivetrainChoice {
        case .kop:
            if isRookie {
                driveItems.append(LineItem(label: "AM14U6 KOP drive base, free for rookies", amount: 0, source: Fees.am14u6,
                                           note: "$940 retail value provided with rookie registration."))
            } else {
                drivetrain = Fees.am14u6.value
                driveItems.append(LineItem(label: "AM14U6 KOP tank drive base", amount: Fees.am14u6.value, source: Fees.am14u6))
            }
        case .swerve:
            drivetrain = i.swerveCost
            driveItems.append(LineItem(label: "COTS swerve modules, your quote", amount: i.swerveCost,
                                       note: "COTS swerve pricing varies widely by vendor and module count, so enter your quote.",
                                       estimate: true))
        case .reuse:
            driveItems.append(LineItem(label: "Reuse the existing drivetrain", amount: 0))
        }

        // ---- Electronics ----
        var elecItems: [LineItem] = []
        var electronics: Double = 0
        switch i.electronicsPath {
        case .fullNew:
            elecItems.append(contentsOf: [
                LineItem(label: "NI roboRIO 2.0", amount: Fees.roboRIO.value, source: Fees.roboRIO),
                LineItem(label: "REV Power Distribution Hub", amount: Fees.pdh.value, source: Fees.pdh),
                LineItem(label: "VH-109 FRC Radio, education price", amount: Fees.radio.value, source: Fees.radio),
                LineItem(label: "REV Radio Power Module", amount: Fees.radioPowerModule.value, source: Fees.radioPowerModule),
                LineItem(label: "Robot batteries (\(JS.string(i.batteryQty)) × $58)", amount: i.batteryQty * Fees.battery.value,
                         source: Fees.battery),
                LineItem(label: "RSL, 120 A main breaker and wiring consumables", amount: i.consumables,
                         note: "Bundled small legal parts, roughly $\(JS.string(Ranges.consumablesLow)) to $\(JS.string(Ranges.consumablesHigh)).",
                         estimate: true),
            ])
            electronics = sum(elecItems)
        case .bundle3230:
            electronics = Fees.bundle3230.value
            elecItems.append(LineItem(label: "AndyMark FRC Basic Starter Bundle, with roboRIO", amount: Fees.bundle3230.value,
                                      source: Fees.bundle3230,
                                      note: "Includes the AM14U6 drive base, 4 NEO, 4 SPARK MAX, PDB and radio bundles, 2 batteries, a charger, a tool set and the roboRIO. Set drivetrain, motors and tools to reuse so nothing gets counted twice."))
        case .bundle2750:
            electronics = Fees.bundle2750.value
            elecItems.append(LineItem(label: "AndyMark FRC Basic Starter Bundle, without roboRIO", amount: Fees.bundle2750.value,
                                      source: Fees.bundle2750,
                                      note: "Same contents minus the roboRIO. Set drivetrain, motors and tools to reuse so nothing gets counted twice."))
        case .own:
            elecItems.append(LineItem(label: "Already own the control system", amount: 0))
        }

        // ---- Motors and controllers ----
        var motorItems: [LineItem] = []
        let sparkMaxQty = i.neoQty   // one SPARK MAX per NEO
        if i.neoQty > 0 {
            motorItems.append(LineItem(label: "REV NEO motors (\(JS.string(i.neoQty)) × $42.50)", amount: i.neoQty * Fees.neo.value,
                                       source: Fees.neo))
            motorItems.append(LineItem(label: "REV SPARK MAX controllers (\(JS.string(sparkMaxQty)) × $100)",
                                       amount: sparkMaxQty * Fees.sparkMax.value, source: Fees.sparkMax,
                                       note: "One SPARK MAX is required per NEO."))
        }
        if i.krakenQty > 0 {
            motorItems.append(LineItem(label: "Kraken X60 motors (\(JS.string(i.krakenQty)) × $217.99)",
                                       amount: i.krakenQty * Fees.kraken.value, source: Fees.kraken,
                                       note: "Integrated Talon FX, so there is no separate controller."))
        }
        if i.otherMotorQty > 0 && i.otherMotorUnit > 0 {
            motorItems.append(LineItem(label: "Other motors (\(JS.string(i.otherMotorQty)) × \(usd2(i.otherMotorUnit)))",
                                       amount: i.otherMotorQty * i.otherMotorUnit, estimate: true))
        }
        let motors = sum(motorItems)

        // ---- Tools ----
        let toolItems: [LineItem] = i.toolsCost > 0
            ? [LineItem(label: "Starter tools and shop equipment, your budget", amount: i.toolsCost,
                        note: "Not separately priced in our sources, and a tool set is included in the Starter Bundle.",
                        estimate: true)]
            : []
        let tools = sum(toolItems)

        // ---- Travel ----
        let events: Double = i.programModel == .regional
            ? 1 + i.addlRegionals + (i.attendFirstChamps ? 1 : 0)
            : i.districtEvents + (i.attendDistrictChamps ? 1 : 0) + (i.attendFirstChamps ? 1 : 0)
        let travelItems: [LineItem] = i.travelPerEvent > 0
            ? [LineItem(label: "Travel, lodging and food (\(JS.string(events)) event\(events == 1 ? "" : "s") × \(usd0(i.travelPerEvent)))",
                        amount: i.travelPerEvent * events,
                        note: "Team and region specific. FIRST publishes no travel model.", estimate: true)]
            : []
        let travel = sum(travelItems)

        // ---- Spares and other ----
        let spareItems: [LineItem] = i.sparesOther > 0
            ? [LineItem(label: "Spares, sensors, pneumatics and other", amount: i.sparesOther, estimate: true)]
            : []
        let spares = sum(spareItems)

        let grand = registration + drivetrain + electronics + motors + tools + travel + spares

        // ---- The low / high band (documented ranges: district fee, consumables) ----
        let districtDelta = i.programModel == .district ? i.districtFee : 0
        let consumDelta = i.electronicsPath == .fullNew ? i.consumables : 0
        let grandLowRaw = grand - districtDelta - consumDelta
            + (i.programModel == .district ? Ranges.districtFeeLow : 0)
            + (i.electronicsPath == .fullNew ? Ranges.consumablesLow : 0)
        let grandHighRaw = grand - districtDelta - consumDelta
            + (i.programModel == .district ? Ranges.districtFeeHigh : 0)
            + (i.electronicsPath == .fullNew ? Ranges.consumablesHigh : 0)
        let low = JS.min(grandLowRaw, grand)
        let high = JS.max(grandHighRaw, grand)

        let perStudent: Double? = i.teamSize > 0 ? grand / i.teamSize : nil
        let rookieBenefit = isRookie && i.drivetrainChoice == .kop ? Fees.am14u6.value : 0

        return Result(registration: registration, drivetrain: drivetrain, electronics: electronics, motors: motors,
                      tools: tools, travel: travel, spares: spares, grand: grand, low: low, high: high,
                      perStudent: perStudent, rookieBenefit: rookieBenefit, events: events,
                      regItems: regItems, driveItems: driveItems, elecItems: elecItems, motorItems: motorItems,
                      toolItems: toolItems, travelItems: travelItems, spareItems: spareItems)
    }

    // MARK: The words around the figures

    /// Under the taped total: "likely $X to $Y, the district fee and consumables move it".
    static func bandLine(_ r: Result) -> String? {
        r.hasBand ? "likely \(usd0(r.low)) to \(usd0(r.high)), the district fee and consumables move it" : nil
    }

    static func perStudentLine(_ r: Result) -> String {
        r.perStudent.map(usd0) ?? "enter a team size below"
    }

    static func eventsLine(_ r: Result) -> String {
        "\(JS.string(r.events)) paid for in this plan"
    }

    static func travelLine(_ r: Result) -> String {
        r.travel > 0 ? "\(usd0(r.travel)), in the total" : "not costed yet"
    }

    /// The sentence under the grand total.
    static func grandFootnote(_ r: Result, attendFirstChamps: Bool) -> String {
        (r.hasBand
            ? "Likely \(usd0(r.low)) to \(usd0(r.high)) once the district fee and consumables land where they land."
            : "No documented range applies to this plan, so the total is the total.")
            + (r.travel == 0 ? " Travel is still zero here, and travel is almost never zero." : "")
            + (attendFirstChamps ? " The Championship fee on this sheet is a 2024-based estimate." : "")
    }

    /// "The AM14U6 KOP drive base comes with your registration..." when it's free.
    static func rookieBenefitNote(_ r: Result) -> String? {
        guard r.rookieBenefit > 0 else { return nil }
        return "The AM14U6 KOP drive base comes with your registration, so the \(usd0(r.rookieBenefit)) retail value is a zero on this sheet rather than a cost. It is real money you are not spending, and it is worth saying out loud in a sponsor letter."
    }

    /// The drivetrain chips, whose KOP label depends on the team type.
    static func drivetrainOptions(isRookie: Bool) -> [(DrivetrainChoice, String)] {
        [(.kop, isRookie ? "KOP, free" : "KOP tank, $940"), (.swerve, "COTS swerve"), (.reuse, "reuse, $0")]
    }

    static let electronicsOptions: [(ElectronicsPath, String)] = [
        (.fullNew, "new, itemised"), (.bundle3230, "bundle $3,230"), (.bundle2750, "bundle $2,750"), (.own, "own it, $0"),
    ]

    /// The value a field takes from what was typed, like the site's `NumberInput`:
    /// `Number(text)`, clamped to `min`, and `min` when it isn't a number.
    static func inputValue(_ text: String, min: Double = 0) -> Double {
        let n = JS.number(text)
        return n.isFinite ? JS.max(min, n) : min
    }
}
