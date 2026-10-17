import SwiftUI

/// Team Budget Calculator (learnfrc.com/tools/frc-budget-calculator). A budget is a document
/// before it's a calculator: somebody hands it to a booster club. So the total is taped up top,
/// the three things that move it sit in three panels, and the ledger lists every line with
/// where the price came from.
struct BudgetView: View {
    /// What's typed in each field; the sheet reads it the way the site's inputs do
    /// (`Number()`, clamped to zero).
    @State private var fields: [String: String] = BudgetView.defaultFields
    @State private var teamType: BudgetMath.TeamType = .rookie
    @State private var programModel: BudgetMath.ProgramModel = .regional
    @State private var attendDistrictChamps = false
    @State private var attendFirstChamps = false
    @State private var drivetrainChoice: BudgetMath.DrivetrainChoice = .kop
    @State private var electronicsPath: BudgetMath.ElectronicsPath = .fullNew
    @FocusState private var focus: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private let tool = ToolCatalog.info(slug: ToolCatalog.budget)!
    private typealias Math = BudgetMath

    private static let defaultFields: [String: String] = {
        let d = BudgetMath.Inputs()
        let pairs: [(String, Double)] = [
            ("addlRegionals", d.addlRegionals), ("districtEvents", d.districtEvents), ("districtFee", d.districtFee),
            ("districtChampsFee", d.districtChampsFee), ("champsFee", d.champsFee), ("grants", d.grants),
            ("swerveCost", d.swerveCost), ("batteryQty", d.batteryQty), ("consumables", d.consumables), ("neoQty", d.neoQty),
            ("krakenQty", d.krakenQty), ("otherMotorQty", d.otherMotorQty), ("otherMotorUnit", d.otherMotorUnit),
            ("toolsCost", d.toolsCost), ("travelPerEvent", d.travelPerEvent), ("sparesOther", d.sparesOther), ("teamSize", d.teamSize),
        ]
        return Dictionary(uniqueKeysWithValues: pairs.map { ($0.0, JS.string($0.1)) })
    }()

    private func text(_ key: String) -> Binding<String> {
        Binding(get: { fields[key] ?? "" }, set: { fields[key] = $0 })
    }

    private func value(_ key: String) -> Double { Math.inputValue(fields[key] ?? "") }

    private var inputs: BudgetMath.Inputs {
        var i = BudgetMath.Inputs()
        i.teamType = teamType
        i.programModel = programModel
        i.attendDistrictChamps = attendDistrictChamps
        i.attendFirstChamps = attendFirstChamps
        i.drivetrainChoice = drivetrainChoice
        i.electronicsPath = electronicsPath
        i.addlRegionals = value("addlRegionals")
        i.districtEvents = value("districtEvents")
        i.districtFee = value("districtFee")
        i.districtChampsFee = value("districtChampsFee")
        i.champsFee = value("champsFee")
        i.grants = value("grants")
        i.swerveCost = value("swerveCost")
        i.batteryQty = value("batteryQty")
        i.consumables = value("consumables")
        i.neoQty = value("neoQty")
        i.krakenQty = value("krakenQty")
        i.otherMotorQty = value("otherMotorQty")
        i.otherMotorUnit = value("otherMotorUnit")
        i.toolsCost = value("toolsCost")
        i.travelPerEvent = value("travelPerEvent")
        i.sparesOther = value("sparesOther")
        i.teamSize = value("teamSize")
        return i
    }

    private var order: [String] {
        var keys: [String] = programModel == .regional
            ? ["addlRegionals"]
            : ["districtFee", "districtEvents"] + (attendDistrictChamps ? ["districtChampsFee"] : [])
        if attendFirstChamps { keys.append("champsFee") }
        keys.append("grants")
        if drivetrainChoice == .swerve { keys.append("swerveCost") }
        if electronicsPath == .fullNew { keys += ["batteryQty", "consumables"] }
        keys += ["neoQty", "krakenQty", "otherMotorQty", "otherMotorUnit", "toolsCost", "travelPerEvent", "sparesOther", "teamSize"]
        return keys
    }

    private func next(after key: String) -> () -> Void {
        { if let i = order.firstIndex(of: key), i + 1 < order.count { focus = order[i + 1] } else { focus = nil } }
    }

    private func money(_ label: String, _ key: String, hint: String) -> some View {
        ToolNumberField(label: label, text: text(key), field: key, focus: $focus, hint: hint, prefix: "$", next: next(after: key))
    }

    private func count(_ label: String, _ key: String, hint: String) -> some View {
        ToolNumberField(label: label, text: text(key), field: key, focus: $focus, hint: hint, keypad: .integer, step: 1,
                        next: next(after: key))
    }

    var body: some View {
        let r = Math.compute(inputs)
        ToolPage(tool: tool, focus: $focus, order: order, readout: [ToolReadout(value: Math.usd0(r.grand), unit: "estimated season total")]
                 + (r.perStudent.map { [ToolReadout(value: Math.usd0($0), unit: "per student")] } ?? []),
                 keypadSummary: Math.usd0(r.grand)) { layout in
            header(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 20)

            assumptions(layout: layout)
                .learnColumn(layout)
                .padding(.top, 48)

            ledger(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            ToolBackOfSheet(title: "Where every default number came from.", columns: Self.notes, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)
        }
    }

    // MARK: The question, with the total taped beside it

    private func header(_ r: BudgetMath.Result, layout: LearnLayout) -> some View {
        let words = VStack(alignment: .leading, spacing: 0) {
            SectionLabel("tools / \(tool.slug)")
            ToolMarkedTitle(before: "What will the season ", mark: "actually", after: " cost?")
                .frame(maxWidth: 600, alignment: .leading)
                .padding(.top, 14)
            LearnLede("Registration, the drive base, the control system, motors, tools and travel, itemised into a sheet you can hand to a booster club without apologising for it.")
                .padding(.top, 16)
            SlugText("\(Math.season) season fees, hardware \(Math.asListed). Every default is primary-sourced and every line that varies by team stays editable. Check current FIRST and vendor pricing before you commit money.")
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 560, alignment: .leading)
                .padding(.top, 14)
        }
        return Group {
            if layout.isRegular {
                HStack(alignment: .top, spacing: 36) {
                    words.frame(maxWidth: .infinity, alignment: .leading)
                    totalCard(r).frame(width: min(380, layout.contentWidth * 0.4))
                }
            } else {
                VStack(alignment: .leading, spacing: 30) {
                    words
                    totalCard(r)
                }
            }
        }
    }

    private func totalCard(_ r: BudgetMath.Result) -> some View {
        NotebookCard(tilt: .tool(0, dynamicTypeSize), tape: true) {
            ToolCardKicker(text: "estimated season total")
            Text(Math.usd0(r.grand))
                .font(LF.Fonts.mono(40, weight: .bold, relativeTo: .largeTitle))
                .tracking(-1.2)
                .monospacedDigit()
                .foregroundStyle(LF.Palette.blue)
                .lineLimit(1)
                .minimumScaleFactor(0.4)
                .padding(.top, 12)
                .accessibilityLabel("Estimated season total, \(Math.usd0(r.grand))")
            if let band = Math.bandLine(r) {
                SlugText(band)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
            }
            DashedRule()
                .padding(.top, 14)
            ToolTerms(rows: [
                ("per student", Math.perStudentLine(r)),
                ("events", Math.eventsLine(r)),
                ("travel", Math.travelLine(r)),
            ])
            .padding(.top, 12)
        }
        .toolHeadline()
    }

    // MARK: What you told it

    private func assumptions(layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "what you told it", title: "Set the three things that move the number.")
            Group {
                if layout.isWide {
                    HStack(alignment: .top, spacing: 18) {
                        teamPanel.frame(maxWidth: .infinity)
                        robotPanel.frame(maxWidth: .infinity)
                        restPanel.frame(maxWidth: .infinity)
                    }
                } else if layout.isRegular {
                    VStack(spacing: 18) {
                        HStack(alignment: .top, spacing: 18) {
                            teamPanel.frame(maxWidth: .infinity)
                            robotPanel.frame(maxWidth: .infinity)
                        }
                        restPanel
                    }
                } else {
                    VStack(spacing: 18) {
                        teamPanel
                        robotPanel
                        restPanel
                    }
                }
            }
            .padding(.top, 24)
        }
    }

    private func panel<Content: View>(_ kicker: String, @ViewBuilder content: () -> Content) -> some View {
        NotebookCard {
            VStack(alignment: .leading, spacing: 18) {
                SlugText(kicker, color: LF.Palette.ink)
                    .padding(.bottom, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .bottom) { InkRule() }
                content()
            }
        }
    }

    private func choice<Value: Hashable>(_ label: String, options: [(Value, String)], selected: Value, hint: String? = nil,
                                         select: @escaping (Value) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 6.4) {
            FieldLabel(label)
                .accessibilityHidden(true)
            ToolChips(label: label, options: options.map { (value: $0.0, title: $0.1) }, selected: selected, select: select)
            if let hint {
                FieldHint(hint)
            }
        }
    }

    private var teamPanel: some View {
        panel("01 / the team") {
            choice("Team type", options: [(BudgetMath.TeamType.rookie, "rookie"), (.veteran, "veteran")], selected: teamType,
                   hint: "Rookies get the AM14U6 drive base free and may qualify for startup grants.") { teamType = $0 }
            choice("Program model", options: [(BudgetMath.ProgramModel.regional, "regional"), (.district, "district")],
                   selected: programModel,
                   hint: "Regional charges per event. District adds a region-specific program fee on top of the FIRST fee.") { programModel = $0 }
            if programModel == .regional {
                count("Additional Regionals", "addlRegionals", hint: "Beyond the first, which the base fee covers. $3,000 each.")
            } else {
                money("District program fee", "districtFee", hint: "Region-specific, $3,500 to $5,500 is typical. Verify with your district.")
                count("District events", "districtEvents", hint: "How many qualifiers you will attend. Drives the travel count.")
                ToolCheckbox(title: "Going to District Championship", isOn: $attendDistrictChamps)
                if attendDistrictChamps {
                    money("District Championship fee", "districtChampsFee", hint: "Varies by district, so enter yours. Estimate.")
                }
            }
            ToolCheckbox(title: "Going to FIRST Championship", isOn: $attendFirstChamps)
            if attendFirstChamps {
                money("FIRST Championship fee", "champsFee",
                      hint: "Not published for 2026. Seeded with the last cited figure, about $5,750 in 2024. Re-verify.")
            }
            money("Grants and vouchers to subtract", "grants", hint: "Rookie grants, sponsor vouchers, anything already promised.")
        }
    }

    private var robotPanel: some View {
        panel("02 / the robot") {
            choice("Drivetrain", options: Math.drivetrainOptions(isRookie: teamType == .rookie), selected: drivetrainChoice) {
                drivetrainChoice = $0
            }
            if drivetrainChoice == .swerve {
                money("Swerve modules, your quote", "swerveCost", hint: "COTS swerve varies widely by vendor and module count.")
            }
            choice("Control system", options: Math.electronicsOptions, selected: electronicsPath,
                   hint: "Itemise a new legal control system, take an all-in-one AndyMark bundle, or reuse what is already in the crate.") {
                electronicsPath = $0
            }
            if electronicsPath == .fullNew {
                count("Batteries", "batteryQty", hint: "$58 each.")
                money("Consumables", "consumables", hint: "RSL, breaker, wiring. $40 to $80.")
            }
            DashedRule()
            count("NEO motors", "neoQty", hint: "$42.50 plus a $100 SPARK MAX each.")
            count("Kraken X60", "krakenQty", hint: "$217.99, no controller needed.")
            count("Other motors", "otherMotorQty", hint: "Quantity.")
            money("Other unit price", "otherMotorUnit", hint: "Each.")
        }
    }

    private var restPanel: some View {
        panel("03 / the rest of it") {
            money("Tools and shop equipment", "toolsCost", hint: "Your own figure. A tool set comes inside the Starter Bundle.")
            money("Travel, lodging and food per event", "travelPerEvent",
                  hint: "Team and region specific, $500 to $5,000 is typical. This is never a quote.")
            money("Spares, sensors, pneumatics", "sparesOther", hint: "Everything the season eats that nobody writes down.")
            count("Team size", "teamSize", hint: "Optional. Gives the per-student figure a grant application asks for.")
            MarkerText("travel is the line teams forget", angle: -1.4)
                .padding(.trailing, 4)
                .padding(.top, 4)
        }
    }

    // MARK: The ledger

    private func ledger(_ r: BudgetMath.Result, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the sheet / itemised", title: "Every line, with where the price came from.")
            if let note = Math.rookieBenefitNote(r) {
                ToolNote(kicker: "rookie benefit, already applied", text: note)
                    .padding(.top, 24)
            }
            VStack(alignment: .leading, spacing: 0) {
                ledgerSection("Registration", r.regItems, r.registration)
                ledgerSection("Drivetrain", r.driveItems, r.drivetrain)
                ledgerSection("Control system", r.elecItems, r.electronics)
                ledgerSection("Motors and controllers", r.motorItems, r.motors)
                ledgerSection("Tools", r.toolItems, r.tools)
                ledgerSection("Travel", r.travelItems, r.travel)
                ledgerSection("Spares and other", r.spareItems, r.spares)

                VStack(alignment: .leading, spacing: 0) {
                    InkRule()
                    ToolFlowLayout(spacing: 20, lineSpacing: 6) {
                        Text("Grand total")
                            .lfTitle(.h3)
                        Text(Math.usd0(r.grand))
                            .font(LF.Fonts.mono(34, weight: .bold, relativeTo: .title))
                            .tracking(-1)
                            .monospacedDigit()
                            .foregroundStyle(LF.Palette.blue)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                    }
                    .padding(.top, 16)
                    .accessibilityElement(children: .combine)
                    SlugText(Math.grandFootnote(r, attendFirstChamps: attendFirstChamps))
                        .fixedSize(horizontal: false, vertical: true)
                        .learnMeasure(60)
                        .padding(.top, 12)
                }
                .padding(.top, 34)
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.top, 12)
        }
    }

    @ViewBuilder
    private func ledgerSection(_ title: String, _ items: [BudgetMath.LineItem], _ subtotal: Double) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 16) {
                    Text(title)
                        .font(LF.Fonts.display(18, relativeTo: .headline))
                        .tracking(-0.3)
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: 8)
                    CountText(Math.usd0(subtotal), size: 19)
                }
                .padding(.bottom, 8)
                .overlay(alignment: .bottom) { InkRule() }
                ForEach(items.indices, id: \.self) { index in
                    ledgerRow(items[index])
                }
            }
            .padding(.top, 26)
        }
    }

    private func ledgerRow(_ item: BudgetMath.LineItem) -> some View {
        let amount = SlugText(Math.usd2(item.amount), color: LF.Palette.ink, size: 14, weight: .bold)
            .fixedSize()
        let words = VStack(alignment: .leading, spacing: 4) {
            Text(item.label)
                .font(LF.Fonts.body(15.5))
                .foregroundStyle(LF.Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            if item.estimate || item.source != nil {
                HStack(spacing: 12) {
                    if item.estimate {
                        SlugText("estimate")
                    }
                    if let source = item.source, let url = URL(string: source.url) {
                        Link(destination: url) {
                            SlugText("source", color: LF.Palette.ink, weight: .bold)
                                .underline(true, color: LF.Palette.blue)
                                .frame(minHeight: 30)
                                .contentShape(Rectangle())
                        }
                        .accessibilityLabel("Source: \(source.cite)")
                    }
                }
            }
            if let note = item.note {
                FieldHint(note)
                    .learnMeasure(62)
            }
        }
        // Money in its own right-hand column, like a printed invoice; under the words only at
        // the accessibility sizes, where a column would squeeze them to a few letters a line.
        return Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 6) {
                    words
                    amount
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 16) {
                    words.frame(maxWidth: .infinity, alignment: .leading)
                    amount
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) { DashedRule() }
    }

    // MARK: The back of the sheet

    private static let notes: [ToolNoteColumn] = [
        ToolNoteColumn(heading: "what to re-check every year", bullets: [
            "Registration is FIRST’s published \(BudgetMath.season) pricing: $6,300 for every team worldwide, $3,000 per additional Regional. FIRST adjusts this annually, so re-verify before Kickoff.",
            "On the district model the $6,300 is only the base. Your district, whether that is FIRST Washington, FIN, PNW, NE or ONT, bills its own program and event fees separately.",
            "The FIRST Championship fee here is historical, about $5,750 from 2024, and is not published for 2026. Treat it as an estimate.",
            "Vendor prices are the currently listed FRC and education prices, checked 2026-07. MSRP is higher on several items, like the Kraken X60 at $399.99. Shipping and tax are not included.",
            "Travel, lodging and food are yours to enter. The typical range on this page is context, never a quote.",
            "This estimates cost only. It is not affiliated with or endorsed by FIRST, AndyMark, REV Robotics, CTR Electronics or WestCoast Products.",
        ]),
        ToolNoteColumn(heading: "sourced default values", bullets: BudgetMath.Fees.all.map { "\($0.cite) [source](\($0.url))" } + [
            "District program fee, region-specific $3,500 to $5,500, editable, verify with your district [source](\(BudgetMath.Ranges.districtFeeURL))",
            "RSL, 120 A main breaker and wiring consumables, bundled small parts, roughly $40 to $80, editable.",
            "Travel, lodging and food, user-entered. $500 to $5,000 is typical, and FIRST publishes no travel model.",
            "FIRST Championship fee, about $5,750 last publicly cited in 2024, not published for 2026. Editable estimate.",
        ]),
    ]
}

#Preview("Budget, iPhone", traits: .fixedLayout(width: 393, height: 4400)) {
    NavigationStack { BudgetView() }
        .appEnvironment(.preview)
}

#Preview("Budget, iPad, dark", traits: .fixedLayout(width: 1180, height: 3000)) {
    NavigationStack { BudgetView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#if DEBUG
#Preview("Budget, Duo book", traits: .duoBook) {
    NavigationStack { BudgetView() }
        .appEnvironment(.preview)
        .previewFold(.previewBook)
}
#endif
