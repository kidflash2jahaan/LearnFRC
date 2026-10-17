import SwiftUI

/// Current Budget & Brownout (learnfrc.com/tools/frc-current-budget). The robot's one
/// question, does it keep running when everything moves at once, is stamped on the blue band;
/// under it the pack on one tag, the load list as a stack of index cards, and every motor
/// checked against its own breaker. Status is carried by sentences, never by a hue.
struct CurrentBudgetView: View {
    @State private var inputs = CurrentBudgetMath.Inputs()
    @State private var nextID = 1000
    @FocusState private var focus: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private let tool = ToolCatalog.info(slug: ToolCatalog.currentBudget)!
    private typealias Math = CurrentBudgetMath

    private var order: [String] {
        var fields = inputs.rorio == .v2 ? ["brownout", "voc"] : ["voc"]
        for mechanism in inputs.mechanisms {
            fields.append("name-\(mechanism.id)")
            for motor in mechanism.motors where motor.mode == .limit {
                fields.append("amps-\(motor.id)")
            }
        }
        return fields
    }

    private func next(after field: String) -> () -> Void {
        { if let i = order.firstIndex(of: field), i + 1 < order.count { focus = order[i + 1] } else { focus = nil } }
    }

    private func makeID() -> Int {
        nextID += 1
        return nextID
    }

    var body: some View {
        let r = Math.compute(inputs)
        let stamps = Math.stamps(r)
        let verdict = ToolVerdict(kicker: Math.kicker(r), line: Math.verdictLine(r),
                                  message: Math.verdictBody(r), figures: stamps)
        ToolPage(tool: tool, focus: $focus, order: order, readout: [
            ToolReadout(value: stamps[0].value, unit: "A drawn at once"),
            ToolReadout(value: stamps[1].value, unit: r.offScale ? "under the blackout floor" : "V at the board"),
            ToolReadout(value: stamps[2].value, unit: "A \(r.headroomA >= 0 ? "under" : "over") the main"),
        ], keypadSummary: "\(stamps[0].value) A · \(r.offScale ? "dark" : stamps[1].value + " V")", verdict: verdict) { layout in
            VStack(alignment: .leading, spacing: 0) {
                ToolHeader(slug: tool.slug, before: "Can it all run at once, or does the robot ", mark: "go dark", after: "?",
                           lede: "List every motor, set the smart-current limits you actually configured, and see the total against the 120 A main breaker and the roboRIO brownout line before a match finds it for you.",
                           note: "Motor figures come from the FIRST 2017 motor sheet and vendor spec pages. Breaker and brownout figures come from WPILib. Bus-voltage sag is a first-order estimate, not a promise.",
                           pen: "the breaker doesn’t care what you meant", layout: layout)
                scenarios
                    .padding(.top, 28)
            }
            .learnColumn(layout)
            .padding(.top, 20)

            ToolVerdictSlab(verdict, layout: layout)

            pack(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 44)

            loadList(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            check(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            ToolBackOfSheet(title: "Every constant, and where it stops being true.", columns: Self.notes, layout: layout) {
                motorLibrary(layout: layout)
            }
            .learnColumn(layout)
            .padding(.top, 52)
        }
    }

    // MARK: Scenarios

    private var scenarios: some View {
        VStack(alignment: .leading, spacing: 0) {
            DashedRule()
            SlugText("start from a scenario")
                .padding(.top, 16)
            ToolFlowLayout(spacing: 12, lineSpacing: 12) {
                Button("Typical drive") {
                    inputs.mechanisms = Math.typicalDrive()
                    focus = nil
                }
                .buttonStyle(.inkGhostSmall)
                Button("Full send, everything stalled") {
                    var id = nextID
                    inputs.mechanisms = Math.fullSend { id += 1; return id }
                    nextID = id
                    focus = nil
                }
                .buttonStyle(.inkGhostSmall)
            }
            .padding(.top, 10)
            Text("Typical drive is a four-Kraken drivetrain at a 40 A limit with the intake and elevator idle. Full send runs the same robot with every motor stalled at once, which is what a pin against the wall looks like electrically.")
                .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(70)
                .padding(.top, 12)
        }
    }

    // MARK: The pack

    private func pack(_ r: CurrentBudgetMath.Result, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the pack / four numbers set the lines", title: "Describe the battery and the roboRIO you actually have.")
            NotebookCard(tape: true) {
                VStack(alignment: .leading, spacing: 20) {
                    ToolFieldGrid(layout: layout) {
                        ToolMenuPicker(label: "roboRIO version", options: Math.RoboRIO.allCases.map { (value: $0, title: $0.title) },
                                       selection: $inputs.rorio,
                                       hint: "Sets the brownout line. The 1.0 is fixed at 6.3 V, the 2.0 defaults to 6.75 V.")
                        if inputs.rorio == .v1 {
                            ToolNumberField(label: "Brownout threshold (V)", text: .constant(JS.string(Math.roboRIO1BrownoutV)),
                                            field: "brownout-fixed", focus: $focus, hint: "Fixed in hardware on the roboRIO 1.0.")
                                .disabled(true)
                        } else {
                            ToolNumberField(label: "Brownout threshold (V)", text: $inputs.brownout2, field: "brownout", focus: $focus,
                                            hint: "Software-settable on the 2.0 with setBrownoutVoltage().", next: next(after: "brownout"))
                        }
                        ToolNumberField(label: "Battery resting voltage Voc (V)", text: $inputs.vOc, field: "voc", focus: $focus,
                                        hint: "12.5 V is a conservative default. A healthy match pack reads about 12.7 to 13.5 V open circuit.",
                                        next: next(after: "voc"))
                        resistanceSlider
                    }
                    DashedRule()
                    ToolTerms(rows: Math.packLines(r, rorio: inputs.rorio, rInt: inputs.rInt))
                }
            }
            .padding(.top, 22)
        }
    }

    private var resistanceSlider: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            FieldLabel("Internal resistance Rint (Ω)")
                .accessibilityHidden(true)
            HStack(spacing: 12) {
                Slider(value: $inputs.rInt, in: Math.rintMinOhm...Math.rintMaxOhm, step: 0.001)
                    .tint(LF.Palette.blue)
                    .accessibilityLabel("Internal resistance")
                    .accessibilityValue("\(JS.toFixed(inputs.rInt, 3)) ohms")
                SlugText(JS.toFixed(inputs.rInt, 3), color: LF.Palette.ink, weight: .bold)
                    .fixedSize()
                    .accessibilityHidden(true)
            }
            .frame(minHeight: LF.Metrics.tap)
            FieldHint("0.011 is the manufacturer figure, under 0.015 is healthy, over 0.020 means retire the pack. Use your Battery Beak reading.")
        }
    }

    // MARK: The load list

    private func loadList(_ r: CurrentBudgetMath.Result, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            let head = LearnSectionHeader(kicker: "the load list / one line per motor", title: "Every motor, and whether it is moving right now.",
                                          sub: "Only mechanisms marked running are counted in the simultaneous total. Untick the ones that never move at the same time, because a budget that assumes everything stalls at once is a budget nobody can build to.")
            let add = Button("Add a mechanism") {
                let mechanismID = makeID()
                inputs.mechanisms.append(Math.newMechanism(id: mechanismID, motorID: makeID(), existing: inputs.mechanisms.count))
            }
            .buttonStyle(.inkGhostSmall)
            if layout.isRegular {
                HStack(alignment: .bottom, spacing: 28) {
                    head.frame(maxWidth: .infinity, alignment: .leading)
                    add
                }
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    head
                    add
                }
            }

            VStack(spacing: 24) {
                ForEach(Array(inputs.mechanisms.enumerated()), id: \.element.id) { index, mechanism in
                    mechanismCard(mechanism, index: index, check: r.perMech.first { $0.mechanism.id == mechanism.id }, layout: layout)
                }
                if inputs.mechanisms.isEmpty {
                    ToolNote(kicker: "nothing to budget",
                             text: "The list is empty. Add a mechanism, or load one of the two scenarios at the top of the page.")
                }
            }
            .padding(.top, 24)
        }
    }

    private func mechanismBinding(_ id: Int) -> Binding<CurrentBudgetMath.Mechanism>? {
        guard let index = inputs.mechanisms.firstIndex(where: { $0.id == id }) else { return nil }
        let fallback = inputs.mechanisms[index]
        return Binding(get: { inputs.mechanisms.first { $0.id == id } ?? fallback },
                       set: { new in
                           if let i = inputs.mechanisms.firstIndex(where: { $0.id == id }) { inputs.mechanisms[i] = new }
                       })
    }

    @ViewBuilder
    private func mechanismCard(_ mechanism: CurrentBudgetMath.Mechanism, index: Int, check: CurrentBudgetMath.MechanismCheck?,
                               layout: LearnLayout) -> some View {
        if let binding = mechanismBinding(mechanism.id) {
            NotebookCard(tape: index == 0) {
                VStack(alignment: .leading, spacing: 16) {
                    let nameField = VStack(alignment: .leading, spacing: 6.4) {
                        FieldLabel("Mechanism")
                            .accessibilityHidden(true)
                        TextField("Mechanism", text: binding.name, prompt: Text(verbatim: ""))
                            .focused($focus, equals: "name-\(mechanism.id)")
                            .inkField(focused: focus == "name-\(mechanism.id)")
                            .submitLabel(.next)
                            .onSubmit(next(after: "name-\(mechanism.id)"))
                    }
                    let running = Toggle(isOn: binding.running) {
                        Text("Running now")
                            .font(LF.Fonts.body(16, weight: .semibold))
                            .foregroundStyle(LF.Palette.ink)
                    }
                    .toggleStyle(ToolCheckboxStyle())
                    let remove = ToolRemoveButton(label: "Remove \(mechanism.name)") {
                        inputs.mechanisms.removeAll { $0.id == mechanism.id }
                    }
                    if layout.isRegular {
                        HStack(alignment: .bottom, spacing: 20) {
                            nameField.frame(maxWidth: .infinity)
                            running.fixedSize()
                            remove
                        }
                    } else {
                        nameField
                        HStack(alignment: .center) {
                            running
                            remove
                        }
                    }

                    VStack(spacing: 0) {
                        InkRule()
                        ForEach(mechanism.motors) { motor in
                            motorRow(motor, mechanism: binding, layout: layout)
                        }
                        if mechanism.motors.isEmpty {
                            SlugText("nothing on this mechanism yet")
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 16)
                                .overlay(alignment: .bottom) { DashedRule() }
                        }
                    }

                    ToolFlowLayout(spacing: 16, lineSpacing: 10) {
                        Button("Add a motor") {
                            binding.wrappedValue.motors.append(Math.newMotor(id: makeID()))
                        }
                        .buttonStyle(.inkGhostSmall)
                        CountText(ToolFormat.fixed(check?.current ?? 0, 0),
                                  unit: Math.mechanismTotalCaption(running: mechanism.running))
                    }
                }
            }
        }
    }

    private func motorRow(_ motor: CurrentBudgetMath.MechMotor, mechanism: Binding<CurrentBudgetMath.Mechanism>,
                          layout: LearnLayout) -> some View {
        let binding = Binding(get: { mechanism.wrappedValue.motors.first { $0.id == motor.id } ?? motor },
                              set: { new in
                                  if let i = mechanism.wrappedValue.motors.firstIndex(where: { $0.id == motor.id }) {
                                      mechanism.wrappedValue.motors[i] = new
                                  }
                              })
        let motorPicker = ToolMenuPicker(label: "Motor", options: Math.motors.map { (value: $0.key, title: $0.menuName) },
                                         selection: binding.motorKey)
        let mode = ToolMenuPicker(label: "Drawing", options: Math.CurrentMode.allCases.map { (value: $0, title: $0.menuTitle) },
                                  selection: binding.mode)
        let amps = Group {
            if motor.mode == .limit {
                ToolNumberField(label: "Amps", text: binding.limit, field: "amps-\(motor.id)", focus: $focus,
                                next: next(after: "amps-\(motor.id)"))
            } else {
                VStack(alignment: .leading, spacing: 6.4) {
                    FieldLabel("Amps")
                        .accessibilityHidden(true)
                    SlugText(Math.fixedDraw(motor), color: LF.Palette.ink, weight: .bold)
                        .frame(minHeight: LF.Metrics.tap, alignment: .leading)
                        .accessibilityLabel("Amps: \(Math.fixedDraw(motor))")
                }
            }
        }
        let breaker = ToolMenuPicker(label: "Breaker", options: Math.branchRatings.map { (value: $0, title: "\($0) A") },
                                     selection: binding.branch)
        let remove = ToolRemoveButton(label: "Remove this motor from \(mechanism.wrappedValue.name)") {
            mechanism.wrappedValue.motors.removeAll { $0.id == motor.id }
        }
        return Group {
            if layout.isWide {
                HStack(alignment: .bottom, spacing: 14) {
                    motorPicker.frame(maxWidth: .infinity)
                    mode.frame(maxWidth: 200)
                    amps.frame(maxWidth: 130)
                    breaker.frame(maxWidth: 120)
                    remove
                }
            } else if layout.isRegular {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .bottom, spacing: 14) {
                        motorPicker.frame(maxWidth: .infinity)
                        mode.frame(maxWidth: .infinity)
                    }
                    HStack(alignment: .bottom, spacing: 14) {
                        amps.frame(maxWidth: .infinity)
                        breaker.frame(maxWidth: .infinity)
                        remove
                    }
                }
            } else if dynamicTypeSize.isAccessibilitySize {
                // Each control gets the whole line; the remove button closes the row.
                VStack(alignment: .leading, spacing: 14) {
                    motorPicker
                    mode
                    amps
                    breaker
                    remove
                }
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .bottom, spacing: 10) {
                        motorPicker.frame(maxWidth: .infinity)
                        remove
                    }
                    mode
                    HStack(alignment: .bottom, spacing: 12) {
                        amps.frame(maxWidth: .infinity)
                        breaker.frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) { DashedRule() }
    }

    // MARK: The check

    private func check(_ r: CurrentBudgetMath.Result, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            let head = LearnSectionHeader(kicker: "the check / one breaker, one controller", title: "Every motor measured against its own breaker.",
                                          sub: "A four-motor drivetrain is four separate 40 A breakers, not one 160 A one. Read the headroom column per motor, then read the total against the main.")
            let total = CountText(ToolFormat.fixed(r.iTotal, 0), unit: "A against the 120 A main")
            if layout.isRegular {
                HStack(alignment: .bottom, spacing: 28) {
                    head.frame(maxWidth: .infinity, alignment: .leading)
                    total
                }
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    head
                    total
                }
            }

            VStack(spacing: 0) {
                if layout.isRegular {
                    HStack(spacing: 10) {
                        ForEach(["mechanism", "motor", "drawing", "amps", "breaker", "headroom", "verdict"], id: \.self) { title in
                            SlugText(title).frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
                    .accessibilityHidden(true)
                }
                InkRule()
                ForEach(r.rows) { row in
                    checkRow(row, layout: layout)
                }
                if r.rows.isEmpty {
                    SlugText("no motors in the load list yet")
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 14)
                        .overlay(alignment: .bottom) { DashedRule() }
                }
            }
            .padding(.top, 24)

            Group {
                if r.callouts.isEmpty {
                    ToolNote(kicker: "nothing flagged",
                             text: "No motor is over its own breaker and the total sits under the main with voltage to spare. That is the budget working, not a promise about a worn battery on the third match of the day.")
                } else {
                    NoteCallout {
                        SlugText("what goes wrong first", color: LF.Palette.ink)
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(r.callouts.indices, id: \.self) { index in
                                HStack(alignment: .firstTextBaseline, spacing: 10) {
                                    Text(verbatim: "–")
                                        .font(LF.Fonts.mono(13))
                                        .foregroundStyle(LF.Palette.blue)
                                        .accessibilityHidden(true)
                                    Text(r.callouts[index])
                                        .lfProse(15.5, lineHeight: 1.5)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .padding(.top, 4)
                    }
                    .learnMeasure(68)
                }
            }
            .padding(.top, 26)
        }
    }

    private func checkRow(_ row: CurrentBudgetMath.Row, layout: LearnLayout) -> some View {
        let flagged = row.status != .ok
        let weight: Font.Weight = flagged ? .bold : .regular
        let mech = row.mechName + (row.running ? "" : " (idle)")
        let amps = "\(ToolFormat.fixed(row.current, 0)) A"
        return Group {
            if layout.isRegular {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(mech)
                        .font(LF.Fonts.body(14.5, weight: flagged ? .bold : .medium))
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(row.motorName, color: LF.Palette.ink, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(row.mode.word, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(amps, color: LF.Palette.ink, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                    SlugText("\(row.branch) A", color: LF.Palette.ink, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(row.headroom, color: LF.Palette.ink, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                    SlugText(row.verdict, color: LF.Palette.ink, weight: weight)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ToolFlowLayout(spacing: 12, lineSpacing: 2) {
                        Text(mech)
                            .font(LF.Fonts.body(15, weight: flagged ? .bold : .semibold))
                            .foregroundStyle(LF.Palette.ink)
                        SlugText(row.verdict, color: LF.Palette.ink, weight: weight)
                    }
                    ToolFlowLayout(spacing: 14, lineSpacing: 4) {
                        SlugText(row.motorName, color: LF.Palette.ink)
                        SlugText(row.mode.word)
                        SlugText("\(amps) of \(row.branch) A", color: LF.Palette.ink, weight: weight)
                        SlugText(row.headroom, weight: weight)
                    }
                }
            }
        }
        .padding(.vertical, 11)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(flagged ? LF.Palette.rowWash : Color.clear)
        .overlay(alignment: .leading) {
            Rectangle().fill(flagged ? LF.Palette.blue : Color.clear).frame(width: 3)
        }
        .overlay(alignment: .bottom) { DashedRule() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(mech), \(row.motorName)")
        .accessibilityValue("\(row.mode.word), \(amps) on a \(row.branch) A breaker, \(row.headroom), \(row.verdict)")
    }

    // MARK: The back of the sheet

    private func motorLibrary(layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SlugText("motor library / published figures at 12 V", color: LF.Palette.ink)
                .padding(.bottom, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { InkRule() }
            ForEach(Math.motors) { motor in
                VStack(alignment: .leading, spacing: 5) {
                    Text(motor.menuName)
                        .font(LF.Fonts.body(15, weight: .semibold))
                        .foregroundStyle(LF.Palette.ink)
                    ToolFlowLayout(spacing: 14, lineSpacing: 4) {
                        SlugText("\(JS.locale(motor.freeRpm, 0)) free rpm", color: LF.Palette.ink)
                        SlugText("\(JS.string(motor.stallA)) stall A", color: LF.Palette.ink)
                        SlugText("\(JS.string(motor.freeA)) free A", color: LF.Palette.ink)
                        SlugText("\(JS.string(motor.stallNm)) stall N·m", color: LF.Palette.ink)
                    }
                    SlugText(motor.source)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 10)
                .overlay(alignment: .bottom) { DashedRule() }
                .accessibilityElement(children: .combine)
            }
            SlugText("The CIM is listed by the FIRST 2017 sheet at 5310 rpm and 133 A, while VEX and AndyMark product sheets say 5330 rpm and 131 A. Kraken X60 Trapezoidal (366 A stall) and FOC (483 A stall) are distinct modes, so pick the one your controller actually runs. Falcon 500 is discontinued but still legal.")
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(74)
                .padding(.top, 16)
            SlugText("This tool estimates current and voltage only. Not affiliated with or endorsed by FIRST, WPILib, WestCoast Products, REV Robotics, CTR Electronics, or Eaton and Bussmann.")
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(74)
                .padding(.top, 12)
        }
    }

    private static let notes: [ToolNoteColumn] = [
        ToolNoteColumn(heading: "where it stops being true", bullets: [
            "The bus voltage is a first-order estimate, V = Voc minus I times R. Real sustained sag is worse, because the pack droops under a long pull and its internal resistance climbs as it discharges and ages. Treat the brownout line as a planning guide.",
            "Snap-Action branch breakers and the 120 A main are thermal breakers with trip curves. They carry rated current continuously and tolerate a brief overcurrent. This sheet flags when you exceed a rating, it does not model trip time.",
            "Stall currents are the theoretical unlimited worst case at 12 V. In practice you run configured supply limits, CTRE SupplyCurrentLimit or REV setSmartCurrentLimit, well below stall. Enter your own limits for a budget you can build to.",
            "Internal resistance and resting voltage vary with age, charge state and temperature. The defaults are typical WPILib values, so replace them with your Battery Beak numbers.",
            "Published motor specs carry tolerance. REV lists plus or minus 10% on brushless motors, and the figures here are nominal manufacturer values.",
        ]),
        ToolNoteColumn(heading: "sourced constants used", bullets: [
            "120 A main breaker, Cooper Bussmann CB285-120 via AndyMark and Eaton Bussmann.",
            "Branch breakers at 40, 30, 20 and 10 A, Snap-Action MX5 and VB3, from WPILib Control System Hardware.",
            "Brownout at 6.3 V on the roboRIO 1.0 (fixed) and 6.75 V on the 2.0 (default, software-settable). Stage-1 rail droop 6.8 V, blackout 4.5 V, recovery 7.5 V, from WPILib roboRIO Brownouts. The 6.8 V figure is the rail-droop point, not the roboRIO 2 brownout.",
            "Battery: 12 V 18 Ah SLA, briefly able to source over 180 A. Rint 0.011 Ω manufacturer, under 0.015 Ω healthy, over 0.020 Ω retire. Voc about 12.7 to 13.5 V open, from WPILib Robot Battery Basics. The sag parameters are user-adjustable estimates.",
        ], footnote: "Breaker, brownout, battery and motor data are evergreen. Re-check each season only that the R-rules still specify the 120 A main and Snap-Action branch breakers, and add any new motors from vendor spec pages."),
    ]
}

#Preview("Current budget, iPhone", traits: .fixedLayout(width: 393, height: 4000)) {
    NavigationStack { CurrentBudgetView() }
        .appEnvironment(.preview)
}

#Preview("Current budget, iPad, dark", traits: .fixedLayout(width: 1180, height: 3000)) {
    NavigationStack { CurrentBudgetView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}
