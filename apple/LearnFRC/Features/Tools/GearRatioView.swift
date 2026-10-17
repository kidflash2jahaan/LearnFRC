import SwiftUI

/// Gear Ratio Calculator (learnfrc.com/tools/frc-gear-ratio-calculator). A ratio question
/// starts from something real, so the presets come first; the train is written down the page
/// as a log with the reduction so far on every line; speed and force get a card each; the
/// electrical ceiling sits over all of it as a margin note; then the working, the sources,
/// and the site's long-form explanation and questions.
struct GearRatioView: View {
    @State private var inputs = GearRatioMath.Inputs()
    @State private var nextStageID = 100
    @FocusState private var focus: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private let tool = ToolCatalog.info(slug: ToolCatalog.gearRatio)!

    private var isDrive: Bool { inputs.mode == .drivetrain }

    private var order: [String] {
        var fields = ["count"]
        for stage in inputs.stages {
            fields += inputs.stageInput == .teeth ? ["driving-\(stage.id)", "driven-\(stage.id)"] : ["ratio-\(stage.id)"]
        }
        fields += ["eff"]
        fields += isDrive ? ["wheel", "derate", "weight", "mu", "frac"] : ["arm"]
        fields += ["limit", "voc", "rint"]
        return fields
    }

    private func next(after field: String) -> () -> Void {
        { if let i = order.firstIndex(of: field), i + 1 < order.count { focus = order[i + 1] } else { focus = nil } }
    }

    private func makeID() -> Int {
        nextStageID += 1
        return nextStageID
    }

    private func apply(_ preset: GearRatioMath.Preset) {
        var copy = inputs
        var id = nextStageID
        GearRatioMath.apply(preset, to: &copy) { id += 1; return id }
        nextStageID = id
        inputs = copy
        focus = nil
    }

    var body: some View {
        let r = GearRatioMath.compute(inputs)
        let fmt = ToolFormat.fixed
        ToolPage(tool: tool, focus: $focus, order: order, readout: [
            ToolReadout(value: GearRatioMath.overallFigure(r), unit: ":1 overall"),
            isDrive ? ToolReadout(value: fmt(r.vAdjFps, 2), unit: "ft/s adjusted") : ToolReadout(value: fmt(r.outRpm, 1), unit: "RPM"),
            isDrive ? ToolReadout(value: fmt(r.usableLb, 1), unit: "lbf of push") : ToolReadout(value: fmt(r.tauOut, 2), unit: "N·m"),
        ], keypadSummary: "\(GearRatioMath.overallFigure(r)):1 · " + (isDrive ? "\(fmt(r.vAdjFps, 2)) ft/s" : "\(fmt(r.outRpm, 1)) RPM")) { layout in
            VStack(alignment: .leading, spacing: 0) {
                ToolHeader(slug: tool.slug, before: "Is this ratio fast enough, and can it still ", mark: "push", after: "?",
                           lede: "Stack your reductions, pick the motor, set the current limit. Out comes speed, torque at the wheel, pushing force against the traction limit, and whether the draw browns you out.",
                           note: "Motor figures are each manufacturer’s own published spec at 12 V, cited on the back of the sheet. Every formula is printed with your numbers substituted in.",
                           pen: "start from a gearbox that exists", layout: layout)
                shelf
                    .padding(.top, 28)
            }
            .learnColumn(layout)
            .padding(.top, 20)

            train(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 44)

            output(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            ceiling(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 40)

            VStack(alignment: .leading, spacing: 0) {
                LearnSectionHeader(kicker: "the working / nothing hidden", title: "Every line, with your numbers in it.")
                ToolWorking(rows: GearRatioMath.working(r, inputs), layout: layout)
                    .padding(.top, 24)
                Button("Back to the KOP preset") { apply(GearRatioMath.presets[0]) }
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 22)
            }
            .learnColumn(layout)
            .padding(.top, 52)

            ToolBackOfSheet(title: "Where every motor number came from.", columns: Self.notes, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            GearRatioTheory(layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)
        }
    }

    // MARK: The shelf

    private var shelf: some View {
        VStack(alignment: .leading, spacing: 0) {
            DashedRule()
            SlugText("off the shelf")
                .padding(.top, 16)
            ToolChips(label: "Preset gearboxes", options: GearRatioMath.presets.map { (value: $0.key, title: $0.label) },
                      selected: inputs.presetKey) { key in
                if let preset = GearRatioMath.presets.first(where: { $0.key == key }) { apply(preset) }
            }
            .padding(.top, 8)
            if let preset = inputs.preset {
                Text(preset.blurb)
                    .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .learnMeasure(70)
                    .padding(.top, 10)
            }
        }
    }

    // MARK: The train

    private func train(_ r: GearRatioMath.Result, layout: LearnLayout) -> some View {
        let motor = inputs.motor
        let fmt = ToolFormat.fixed
        return VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the train / motor and every mesh", title: "Stack the reductions and watch them multiply.")
            ToolUnitSwitch(caption: "gearing a", options: [(value: GearRatioMath.Mode.drivetrain, title: "drivetrain"),
                                                          (value: .mechanism, title: "mechanism")],
                           selected: inputs.mode) { inputs.mode = $0 }
                .padding(.top, 16)

            NotebookCard(tape: true) {
                VStack(alignment: .leading, spacing: 20) {
                    ToolColumns(layout: layout, spacing: 20) {
                        ToolMenuPicker(label: "Motor at the input", options: GearRatioMath.motors.map { (value: $0.key, title: $0.label) },
                                       selection: $inputs.motorKey, hint: motor.note)
                    } trailing: {
                        ToolNumberField(label: "How many of them", text: $inputs.count, field: "count", focus: $focus,
                                        hint: "Motors driving this one output. Four swerve modules is 4.", keypad: .integer,
                                        step: 1, minimum: 1, next: next(after: "count"))
                    }
                    DashedRule()
                    ToolFlowLayout(spacing: 26, lineSpacing: 12) {
                        spec("free speed", "\(fmt(motor.freeRpm, 0)) RPM")
                        spec("stall torque", "\(fmt(motor.stallNm, 2)) N·m")
                        spec("stall current", "\(fmt(motor.stallA, 0)) A")
                        spec("free current", "\(fmt(motor.freeA, 1)) A")
                    }
                }
            }
            .padding(.top, 22)

            ToolFlowLayout(spacing: 16, lineSpacing: 4) {
                SlugText(GearRatioMath.reductionsCaption(inputs.stages.count), color: LF.Palette.ink)
                ToolUnitSwitch(caption: "", options: [(value: GearRatioMath.StageInput.teeth, title: "tooth counts"),
                                                      (value: .ratio, title: "a ratio")],
                               selected: inputs.stageInput) { GearRatioMath.switchStageInput($0, in: &inputs) }
                    .accessibilityLabel("How to enter each stage")
            }
            .padding(.top, 28)

            VStack(spacing: 0) {
                InkRule()
                ForEach(Array(inputs.stages.enumerated()), id: \.element.id) { index, stage in
                    stageRow(index: index, stage: stage, r: r, layout: layout)
                }
            }
            .padding(.top, 10)

            ToolColumns(layout: layout, spacing: 22) {
                Button("Add another mesh") {
                    inputs.stages.append(GearRatioMath.newStage(id: makeID()))
                }
                .buttonStyle(.inkGhostSmall)
            } trailing: {
                efficiencyField(stageCount: inputs.stages.count)
            }
            .padding(.top, 20)

            overall(r)
                .padding(.top, 26)
        }
    }

    private func spec(_ term: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            SlugText(term)
            SlugText(value, color: LF.Palette.ink, weight: .bold)
        }
        .accessibilityElement(children: .combine)
    }

    private func stageRow(index: Int, stage: GearRatioMath.Stage, r: GearRatioMath.Result, layout: LearnLayout) -> some View {
        let ratio = index < r.stageRatios.count ? r.stageRatios[index] : .nan
        let running = index < r.cumulative.count ? r.cumulative[index] : .nan
        let binding = Binding(get: { inputs.stages.first { $0.id == stage.id } ?? stage },
                              set: { new in
                                  if let i = inputs.stages.firstIndex(where: { $0.id == stage.id }) { inputs.stages[i] = new }
                              })
        let fields = Group {
            if inputs.stageInput == .teeth {
                HStack(alignment: .top, spacing: 12) {
                    ToolNumberField(label: "Driving (T)", text: binding.driving, field: "driving-\(stage.id)", focus: $focus,
                                    keypad: .integer, next: next(after: "driving-\(stage.id)"))
                    ToolNumberField(label: "Driven (T)", text: binding.driven, field: "driven-\(stage.id)", focus: $focus,
                                    keypad: .integer, next: next(after: "driven-\(stage.id)"))
                }
            } else {
                ToolNumberField(label: "Reduction (x:1)", text: binding.ratio, field: "ratio-\(stage.id)", focus: $focus,
                                next: next(after: "ratio-\(stage.id)"))
            }
        }
        let product = VStack(alignment: .leading, spacing: 4) {
            SlugText(GearRatioMath.stageHere(ratio))
            CountText(GearRatioMath.stageSoFar(running), unit: ":1 so far")
        }
        .accessibilityElement(children: .combine)
        let remove = ToolRemoveButton(label: "Remove stage \(index + 1)") {
            inputs.stages.removeAll { $0.id == stage.id }
        }
        .disabled(inputs.stages.count <= 1)
        let number = SlugText(LearnFormat.ordinal(index + 1), color: LF.Palette.ink, size: 14, weight: .bold)
            .accessibilityLabel("Stage \(index + 1)")

        return Group {
            if layout.isRegular {
                HStack(alignment: .bottom, spacing: 20) {
                    number.frame(width: 40, alignment: .leading).padding(.bottom, 12)
                    fields.frame(maxWidth: .infinity)
                    product.frame(width: 150, alignment: .leading)
                    remove
                }
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center) {
                        number
                        Spacer()
                        remove
                    }
                    fields
                    product
                }
            }
        }
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) { DashedRule() }
    }

    private func efficiencyField(stageCount: Int) -> some View {
        let hint = GearRatioMath.efficiencyHint(stageCount: stageCount)
        return VStack(alignment: .leading, spacing: 8) {
            ToolNumberField(label: "Total drivetrain efficiency (%)", text: $inputs.eff, field: "eff", focus: $focus,
                            next: next(after: "eff"))
            FieldHint("\(hint.before) \(hint.figure)\(hint.after)")
                .accessibilityHidden(true)
            Button {
                inputs.eff = JS.string(GearRatioMath.suggestedEff(stageCount: stageCount))
            } label: {
                LearnLinkLabel(title: "Use \(hint.figure)")
            }
            .buttonStyle(.plain)
            .accessibilityHint("Sets the efficiency to 0.95 to the \(stageCount)")
        }
    }

    private func overall(_ r: GearRatioMath.Result) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            ToolFlowLayout(spacing: 18, lineSpacing: 6) {
                SlugText("overall reduction, every mesh multiplied", color: LF.Palette.ink)
                ToolBigFigure(value: GearRatioMath.overallFigure(r), unit: ":1", size: 44)
            }
            .padding(.top, 16)
            SlugText(GearRatioMath.overallCaption(r, inputs))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
        }
        .accessibilityElement(children: .combine)
        .toolHeadline()
    }

    // MARK: What comes out

    private func output(_ r: GearRatioMath.Result, layout: LearnLayout) -> some View {
        let fmt = ToolFormat.fixed
        let p = ToolFormat.parseNum
        return VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: isDrive ? "out the other end / speed and shove" : "out the other end / speed and force",
                               title: isDrive ? "How fast it goes, and how hard it pushes." : "How fast the shaft turns, and what it can lift.")
            ToolColumns(layout: layout) {
                NotebookCard(tilt: .tool(1, dynamicTypeSize)) {
                    ToolCardKicker(text: isDrive ? "speed on carpet" : "speed at the output shaft")
                    ToolBigFigure(value: isDrive ? fmt(r.vAdjFps, 2) : fmt(r.outRpm, 1), unit: isDrive ? "ft/s adjusted" : "RPM")
                        .padding(.top, 14)
                    Group {
                        if isDrive {
                            ToolTerms(rows: [
                                ("free speed", "\(fmt(r.vFreeFps, 2)) ft/s, \(fmt(r.vFreeFps * GearRatioMath.fpsToMps, 2)) m/s"),
                                ("adjusted", "\(fmt(r.vAdjFps * GearRatioMath.fpsToMps, 2)) m/s at \(fmt(p(inputs.derate), 0))%"),
                                ("wheel speed", "\(fmt(r.outRpm, 1)) RPM"),
                            ])
                        } else {
                            ToolTerms(rows: [
                                ("that is", "\(fmt(r.outRpm / 60, 2)) rev/s"),
                                ("at the lever", "\(fmt(r.fArmLb, 1)) lbf at \(fmt(r.armIn, 1)) in"),
                            ])
                        }
                    }
                    .padding(.top, 14)
                    DashedRule()
                        .padding(.top, 18)
                    VStack(alignment: .leading, spacing: 20) {
                        if isDrive {
                            ToolNumberField(label: "Wheel diameter (in)", text: $inputs.wheel, field: "wheel", focus: $focus,
                                            hint: "Tread squash under a loaded robot makes the rolling diameter a little under nominal.",
                                            next: next(after: "wheel"))
                            ToolNumberField(label: "Speed derate (%)", text: $inputs.derate, field: "derate", focus: $focus,
                                            hint: "80 to 85% is the long-standing FRC allowance for drag and scrub. It is a convention, not physics.",
                                            next: next(after: "derate"))
                        } else {
                            ToolNumberField(label: "Lever or pulley radius (in)", text: $inputs.arm, field: "arm", focus: $focus,
                                            hint: "Output shaft centre to where the load acts: an arm’s length to its centre of mass, or a pulley’s radius.",
                                            next: next(after: "arm"))
                        }
                    }
                    .padding(.top, 18)
                }
            } trailing: {
                forceCard(r)
                    .padding(.top, layout.isRegular ? 32 : 0)
            }
            .padding(.top, 24)
        }
    }

    private func forceCard(_ r: GearRatioMath.Result) -> some View {
        let fmt = ToolFormat.fixed
        let motor = inputs.motor
        return NotebookCard(tilt: .tool(2, dynamicTypeSize), tape: true) {
            ToolCardKicker(text: isDrive ? "force at the wheel" : "torque at the output")
            ToolBigFigure(value: isDrive ? fmt(r.usableLb, 1) : fmt(r.tauOut, 2), unit: isDrive ? "lbf of push" : "N·m")
                .padding(.top, 14)
            Group {
                if isDrive {
                    ToolTerms(rows: [
                        ("torque out", "\(fmt(r.tauOut, 2)) N·m, \(fmt(r.tauOut * GearRatioMath.nmToFtlb, 2)) ft·lbf"),
                        ("wheels could push", "\(fmt(r.fPushLb, 1)) lbf"),
                        ("carpet allows", "\(fmt(r.fTracLb, 1)) lbf"),
                        ("acceleration", "\(fmt(r.accelG, 2)) g, \(fmt(r.accelFtS2, 1)) ft/s²"),
                    ])
                } else {
                    ToolTerms(rows: [
                        ("torque out", "\(fmt(r.tauOut, 2)) N·m, \(fmt(r.tauOut * GearRatioMath.nmToFtlb, 2)) ft·lbf"),
                        ("per motor", "\(fmt(r.tauMotor, 3)) N·m at \(fmt(r.iLim, 0)) A"),
                        ("force at lever", "\(fmt(r.fArmLb, 1)) lbf"),
                    ])
                }
            }
            .padding(.top, 14)
            if isDrive {
                ToolMeterBar(fraction: GearRatioMath.pushPct(r) / 100)
                    .padding(.top, 16)
                SlugText(GearRatioMath.pushMeterLine(r))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
                Text(GearRatioMath.limitExplanation(r))
                    .lfProse(15, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)
                DashedRule()
                    .padding(.top, 18)
                VStack(alignment: .leading, spacing: 20) {
                    ToolNumberField(label: "Weight (lb)", text: $inputs.weight, field: "weight", focus: $focus, next: next(after: "weight"))
                    ToolNumberField(label: "Wheel grip μ", text: $inputs.mu, field: "mu", focus: $focus, next: next(after: "mu"))
                    ToolNumberField(label: "On driven wheels (%)", text: $inputs.weightFrac, field: "frac", focus: $focus,
                                    next: next(after: "frac"))
                    FieldHint("Competition weight with battery and bumpers. μ is community measured, not a vendor spec: roughly 0.8 to 1.0 for smooth or Colson, 1.1 to 1.4 for nitrile or roughtop. Drop the percentage if some weight rides on undriven omnis.")
                }
                .padding(.top, 18)
            } else {
                Text(GearRatioMath.mechanismExplanation(r, motor))
                    .lfProse(15, lineHeight: 1.5, color: LF.Palette.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 14)
            }
        }
    }

    // MARK: The ceiling

    private func ceiling(_ r: GearRatioMath.Result, layout: LearnLayout) -> some View {
        let fmt = ToolFormat.fixed
        let power = GearRatioMath.powerSentence(r)
        let sentence: Text = power.strong.map { strong in
            Text("\(Text(strong).font(LF.Fonts.body(15.5, weight: .bold)).foregroundStyle(LF.Palette.ink)) \(power.rest)")
        } ?? Text(power.rest)
        return NoteCallout {
            ToolColumns(layout: layout, spacing: 26) {
                VStack(alignment: .leading, spacing: 0) {
                    SlugText("the ceiling over all of it", color: LF.Palette.ink)
                    ToolBigFigure(value: "\(fmt(r.iTotal, 0)) A", unit: "at full push, against the 120 A main")
                        .padding(.top, 12)
                    ToolMeterBar(fraction: r.iTotal / GearRatioMath.mainBreakerA)
                        .padding(.top, 12)
                    SlugText(GearRatioMath.headroomLine(r))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 8)
                    SlugText(GearRatioMath.busLine(r), color: LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 10)
                }
            } trailing: {
                VStack(alignment: .leading, spacing: 18) {
                    sentence
                        .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                    ToolNumberField(label: "Limit per motor (A)", text: $inputs.limit, field: "limit", focus: $focus, next: next(after: "limit"))
                    ToolNumberField(label: "Pack resting (V)", text: $inputs.voc, field: "voc", focus: $focus, next: next(after: "voc"))
                    ToolNumberField(label: "Internal R (Ω)", text: $inputs.rInt, field: "rint", focus: $focus, next: next(after: "rint"))
                    ToolRichText("The current limit is the single biggest lever you have. Use your Battery Beak reading for internal resistance: near 0.011 Ω new, under 0.015 Ω healthy, over 0.020 Ω means retire it. Add up the rest of the robot in the [current and brownout calculator](/tools/frc-current-budget), or read [how to stop browning out](/guides/getting-started/common-mistakes-troubleshooting/brownouts).", size: 14)
                }
            }
        }
    }

    // MARK: The back of the sheet

    private static let notes: [ToolNoteColumn] = [
        ToolNoteColumn(heading: "motor specifications",
                       intro: "Each motor uses figures published by its own manufacturer, at 12 V. That matters: vendors dyno each other’s motors under their own conditions and get different answers. REV’s comparison page lists the Kraken X60 at 6,271 RPM and 4.21 N·m from REV’s bench, while WCP publishes 6,000 RPM and 7.09 N·m for the same motor. Assume a real motor lands near, not on, any of them.",
                       bullets: [
                        "NEO V1.1, 5,676 RPM, 2.6 N·m, 105 A stall, 1.8 A free, from [REV Robotics](https://docs.revrobotics.com/brushless/neo/v1.1).",
                        "NEO Vortex, 6,784 RPM, 3.6 N·m, 211 A stall, 3.6 A free, from [REV Robotics](https://docs.revrobotics.com/brushless/neo/vortex).",
                        "Kraken X60, 6,000 RPM / 7.09 N·m / 366 A trapezoidal and 5,800 RPM / 9.37 N·m / 483 A FOC, from [WestCoast Products](https://docs.wcproducts.com/kraken-x60).",
                        "Kraken X44, 7,530 RPM / 4.05 N·m / 275 A trapezoidal and 7,368 RPM / 5.01 N·m / 329 A FOC, from [WestCoast Products](https://docs.wcproducts.com/kraken-x44).",
                        "Falcon 500, 6,380 RPM, 4.69 N·m, 257 A stall, 1.5 A free, from [CTR Electronics](https://store.ctr-electronics.com/products/falcon-500-powered-by-talon-fx).",
                        "CIM, 5,310 RPM, 2.425 N·m, 133 A stall, 2.7 A free, from [AndyMark am-0255](https://andymark.com/products/2-5-in-cim-motor).",
                        "Left out on purpose: the Mini CIM, because AndyMark and CTR Electronics no longer carry it and only third-party mirrors of its spec sheet survive, and the CTRE Minion, whose store page publishes stall torque and peak power but not free speed or stall current.",
                       ]),
        ToolNoteColumn(heading: "preset gearboxes", bullets: [
            "ToughBox Mini 8.45:1 is AndyMark’s published gearset for that option: a 14T CIM pinion into a 50T cluster gear, then a 19T cluster into a 45T output. (50 / 14) x (45 / 19) = 8.459, which the vendor rounds to 8.45:1. [AndyMark](https://www.andymark.com/products/toughbox-mini-options-angled-8-45-1)",
            "SDS MK4i drive gearing is L1 8.14:1, L2 6.75:1, L3 6.12:1, on the module’s 4 in wheel. [Swerve Drive Specialties](https://andymark.com/products/sds-mk4i-swerve-modules)",
            "Electrical limits: 120 A main breaker (Cooper Bussmann CB285-120), roboRIO brownout at 6.75 V (roboRIO 2.0 default, 1.0 is fixed at 6.3 V), 6 V rail droop near 6.8 V, from WPILib. These match the constants in the [current and brownout calculator](/tools/frc-current-budget).",
            "Battery model V_bus = V_oc − I x R_int. A healthy pack reads 12.7 to 13.5 V open with internal resistance near 0.011 Ω new. Over 0.020 Ω means retire it.",
        ]),
        ToolNoteColumn(heading: "assumptions worth arguing with", bullets: [
            "Coefficient of friction is not a vendor spec. The 0.8 to 1.4 range comes from community measurements and swings with tread wear, carpet type, dust and test method. If grip decides your design, drag your own robot across carpet on a scale.",
            "The speed derate is a convention, not physics. Free speed is exact kinematics, the 80 to 85% multiplier is the long-standing FRC allowance for rolling resistance, gearbox drag and scrub.",
            "Torque here is peak, near-stall torque. A DC motor makes maximum torque at zero speed. Once the wheels turn, back-EMF pulls current below your limit and torque with it, so this is the shove at the moment of contact, not a number you hold at speed.",
            "Efficiency is applied to torque, not speed. Gearbox losses barely slow the no-load output, they eat the force you get out of it.",
            "Wheel diameter is nominal. Tread compresses under a loaded robot, so effective rolling diameter runs a couple of percent under the number printed on the wheel.",
            "Traction assumes weight shared evenly across driven wheels on level carpet. Weight transfer under hard acceleration, a defended pin, or a ramp all change the answer.",
            "This is a steady-state, first-order model. It does not simulate acceleration curves, motor heating over a match, wheel scrub in a turn, or a sagging battery’s effect on torque. Prototype and measure before you commit to a ratio.",
        ], footnote: "Not affiliated with or endorsed by FIRST."),
    ]
}

#Preview("Gear ratio, iPhone", traits: .fixedLayout(width: 393, height: 4200)) {
    NavigationStack { GearRatioView() }
        .appEnvironment(.preview)
}

#Preview("Gear ratio, iPad, dark", traits: .fixedLayout(width: 1180, height: 3200)) {
    NavigationStack { GearRatioView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}
