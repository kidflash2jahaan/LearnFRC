import SwiftUI

/// Wire Gauge & Voltage Drop (learnfrc.com/tools/frc-wire-gauge-calculator). The verdict an
/// inspector will also ask about goes first, on the blue band; then the run on one tag; then
/// every gauge against the same run, because the useful question is "which gauge should I
/// have used". Tap a gauge in the ladder to pick it.
struct WireGaugeView: View {
    @State private var inputs = WireGaugeMath.Inputs()
    @State private var showAdvanced = false
    @FocusState private var focus: String?

    private let tool = ToolCatalog.info(slug: ToolCatalog.wireGauge)!

    private var order: [String] {
        ["current", "length", "target"] + (showAdvanced ? ["temp", "voltage", "alpha", "upliftLow", "upliftHigh"] : [])
    }

    private func next(after field: String) -> () -> Void {
        { if let i = order.firstIndex(of: field), i + 1 < order.count { focus = order[i + 1] } else { focus = nil } }
    }

    var body: some View {
        let r = WireGaugeMath.compute(inputs)
        let rangeMode = inputs.strandedWarm
        let stamps = WireGaugeMath.stamps(r, rangeMode: rangeMode)
        let verdict = ToolVerdict(kicker: WireGaugeMath.kicker(r), line: WireGaugeMath.verdictLine(r, gauge: inputs.gauge),
                                  message: WireGaugeMath.verdictBody(inputs.circuit), figures: stamps)
        ToolPage(tool: tool, focus: $focus, order: order, readout: [
            ToolReadout(value: stamps[0].value, unit: "V dropped"),
            ToolReadout(value: stamps[1].value, unit: "of \(WireGaugeMath.fmt(r.voltage, 0)) V"),
            ToolReadout(value: "\(inputs.gauge) AWG", unit: r.compliant ? "passes the gauge rule" : "fails the gauge rule"),
        ], keypadSummary: "\(stamps[0].value) V · \(stamps[1].value)", verdict: verdict) { layout in
            ToolHeader(slug: tool.slug, before: "Is this wire thick enough, and is it ", mark: "legal", after: "?",
                       lede: "Round-trip voltage drop from Ohm’s law, checked against the minimum gauge the manual sets for your breaker size. Copper physics in, honest numbers out.",
                       note: "Figures track the 2026 REBUILT Game Manual (TU22) and the AWG/IACS copper constants. Verify against the current manual before an event.",
                       pen: "the run is doubled, supply and return", layout: layout)
                .learnColumn(layout)
                .padding(.top, 20)

            ToolVerdictSlab(verdict, layout: layout)

            run(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 44)

            ladder(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            ToolBackOfSheet(title: "Every formula and every source.", columns: Self.notes, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)
        }
    }

    // MARK: The run

    private func run(_ r: WireGaugeMath.Result, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the run / six numbers", title: "Describe the wire you are about to cut.")
            NotebookCard(tape: true) {
                VStack(alignment: .leading, spacing: 20) {
                    ToolFieldGrid(layout: layout) {
                        ToolNumberField(label: "Load current (A)", text: $inputs.current, field: "current", focus: $focus,
                                        hint: "Continuous current the circuit carries.", next: next(after: "current"))
                        lengthField
                        ToolMenuPicker(label: "Wire gauge (AWG)",
                                       options: WireGaugeMath.awgOptions.map { (value: $0, title: "\($0) AWG") },
                                       selection: $inputs.gauge, hint: "Smaller number means thicker wire.")
                        ToolNumberField(label: "Voltage-drop target (%)", text: $inputs.targetPct, field: "target", focus: $focus,
                                        hint: "Drives the ladder below. Common guidance, not an FRC rule.", next: next(after: "target"))
                    }
                    ToolMenuPicker(label: "Circuit type / protection",
                                   options: WireGaugeMath.circuitTypes.map { (value: $0.id, title: $0.label) },
                                   selection: $inputs.circuitID, hint: "Sets the minimum-gauge check. \(inputs.circuit.rule).")
                    DashedRule()
                    ToolColumns(layout: layout, spacing: 22) {
                        ToolCheckbox(title: "Stranded and warm, the realistic range", detail: WireGaugeMath.strandedHint(inputs),
                                     isOn: $inputs.strandedWarm)
                    } trailing: {
                        ToolTerms(rows: WireGaugeMath.conductorLines(r, gauge: inputs.gauge, rangeMode: inputs.strandedWarm))
                    }
                }
            }
            .padding(.top, 24)

            ToolDisclosure(label: "advanced / temperature, system voltage, stranded uplift", isOpen: $showAdvanced) {
                ToolFieldGrid(layout: layout) {
                    ToolNumberField(label: "Conductor temp (°C)", text: $inputs.tempC, field: "temp", focus: $focus,
                                    hint: "20°C is the table reference.", next: next(after: "temp"))
                    ToolNumberField(label: "System voltage (V)", text: $inputs.systemVoltage, field: "voltage", focus: $focus,
                                    hint: "12 V nominal, R601-A.", next: next(after: "voltage"))
                    ToolNumberField(label: "Copper α (/°C)", text: $inputs.alpha, field: "alpha", focus: $focus,
                                    hint: "0.00393, IEC 60028.", next: next(after: "alpha"))
                    VStack(alignment: .leading, spacing: 6.4) {
                        FieldLabel("Stranded uplift (% low to high)")
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityHidden(true)
                        HStack(alignment: .top, spacing: 10) {
                            ToolNumberField(label: "Stranded uplift low percent", text: $inputs.upliftLowPct, field: "upliftLow",
                                            focus: $focus, showsLabel: false, next: next(after: "upliftLow"))
                            ToolNumberField(label: "Stranded uplift high percent", text: $inputs.upliftHighPct, field: "upliftHigh",
                                            focus: $focus, showsLabel: false, next: next(after: "upliftHigh"))
                        }
                        FieldHint("2 to 5% estimate, verify for your wire.")
                            .accessibilityHidden(true)
                    }
                }
            }
            .padding(.top, 22)
        }
    }

    /// One-way run length, with its unit beside it.
    private var lengthField: some View {
        VStack(alignment: .leading, spacing: 6.4) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .bottom, spacing: 8) {
                    ToolNumberField(label: "One-way run length", text: $inputs.length, field: "length", focus: $focus,
                                    next: next(after: "length"))
                    ToolMenuPicker(label: "Length unit", options: WireGaugeMath.LengthUnit.allCases.map { (value: $0, title: $0.title) },
                                   selection: $inputs.lengthUnit, showsLabel: false)
                        .frame(width: 132)
                }
                VStack(alignment: .leading, spacing: 10) {
                    ToolNumberField(label: "One-way run length", text: $inputs.length, field: "length", focus: $focus,
                                    next: next(after: "length"))
                    ToolMenuPicker(label: "Length unit", options: WireGaugeMath.LengthUnit.allCases.map { (value: $0, title: $0.title) },
                                   selection: $inputs.lengthUnit, showsLabel: false)
                }
            }
            FieldHint("PD board to the device. The tool doubles it for supply and return.")
        }
    }

    // MARK: The ladder

    private func ladder(_ r: WireGaugeMath.Result, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            let head = LearnSectionHeader(kicker: "every gauge / against this run", title: "What each gauge would have done.",
                                          sub: WireGaugeMath.ladderIntro(r, inputs))
            let pick = Group {
                if let gauge = r.recommendedGauge {
                    CountText("\(gauge) AWG", unit: "thinnest that works")
                } else {
                    SlugText(WireGaugeMath.noGaugeWorks)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: 260, alignment: .leading)
                }
            }
            if layout.isRegular {
                HStack(alignment: .bottom, spacing: 28) {
                    head.frame(maxWidth: .infinity, alignment: .leading)
                    pick
                }
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    head
                    pick
                }
            }

            VStack(spacing: 0) {
                if layout.isRegular {
                    ladderHeaderRow(r)
                }
                InkRule()
                ForEach(r.ladder) { row in
                    ladderRow(row, r: r, layout: layout)
                }
            }
            .padding(.top, 26)

            ToolNote(kicker: "what “legal” does not mean",
                     text: "Table 8-4 and R609 set the minimum safe size, not the size that keeps voltage where you want it. A gauge can pass inspection and still drop most of a volt on a long drive run, so read the drop column, not just the rule column.")
                .padding(.top, 26)
        }
    }

    private func ladderHeaderRow(_ r: WireGaugeMath.Result) -> some View {
        HStack(spacing: 12) {
            SlugText("gauge").frame(width: 76, alignment: .leading)
            SlugText("Ω/1000 ft").frame(maxWidth: .infinity, alignment: .leading)
            SlugText("volts dropped").frame(maxWidth: .infinity, alignment: .leading)
            SlugText("% of \(WireGaugeMath.fmt(r.voltage, 0)) V").frame(maxWidth: .infinity, alignment: .leading)
            SlugText("rule").frame(maxWidth: .infinity, alignment: .leading)
            SlugText("verdict").frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .accessibilityHidden(true)
    }

    private func ladderRow(_ row: WireGaugeMath.LadderRow, r: WireGaugeMath.Result, layout: LearnLayout) -> some View {
        let chosen = row.gauge == inputs.gauge
        let verdict = WireGaugeMath.rowVerdict(row, recommended: r.recommendedGauge) + (chosen ? " · selected" : "")
        let ohms = WireGaugeMath.ohmsText(row.base)
        let drop = "\(WireGaugeMath.fmt(row.drop, 2)) V"
        let percent = "\(WireGaugeMath.fmt(row.percent, 1))%"
        let rule = WireGaugeMath.ruleWord(row, circuit: inputs.circuit)
        let weight: Font.Weight = chosen ? .bold : .regular
        return Button {
            inputs.gauge = row.gauge
        } label: {
            Group {
                if layout.isRegular {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        SlugText("\(row.gauge) AWG", color: LF.Palette.ink, weight: .bold).frame(width: 76, alignment: .leading)
                        SlugText(ohms, color: LF.Palette.ink, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                        SlugText(drop, color: LF.Palette.ink, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                        SlugText(percent, color: LF.Palette.ink, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                        SlugText(rule, weight: weight).frame(maxWidth: .infinity, alignment: .leading)
                        SlugText(verdict, color: LF.Palette.ink, weight: weight)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        ToolFlowLayout(spacing: 12, lineSpacing: 4) {
                            SlugText("\(row.gauge) AWG", color: LF.Palette.ink, size: 14, weight: .bold)
                            SlugText(verdict, color: LF.Palette.ink, weight: weight)
                        }
                        ToolFlowLayout(spacing: 14, lineSpacing: 4) {
                            SlugText("\(ohms) Ω/1000 ft")
                            SlugText("\(drop) dropped", color: LF.Palette.ink, weight: weight)
                            SlugText("\(percent) of \(WireGaugeMath.fmt(r.voltage, 0)) V", color: LF.Palette.ink, weight: weight)
                            SlugText(rule)
                        }
                    }
                }
            }
            .padding(.vertical, 11)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(chosen ? LF.Palette.rowWash : Color.clear)
            .overlay(alignment: .leading) {
                Rectangle().fill(chosen ? LF.Palette.blue : Color.clear).frame(width: 3)
            }
            .overlay(alignment: .bottom) { DashedRule() }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(row.gauge) AWG")
        .accessibilityValue("\(ohms) ohms per 1000 feet, \(drop) dropped, \(percent) of \(WireGaugeMath.fmt(r.voltage, 0)) volts, \(rule), \(verdict)")
        .accessibilityHint(chosen ? "" : "Selects this gauge.")
        .accessibilityAddTraits(chosen ? [.isButton, .isSelected] : [.isButton])
    }

    // MARK: The back of the sheet

    private static let notes: [ToolNoteColumn] = [
        ToolNoteColumn(heading: "formulas used", bullets: [
            "AWG diameter, by definition: d(in) = 0.005 × 92^((36−n)/39), area A = (π/4)d².",
            "Round-trip resistance: R = 2 × L(one-way, ft) × R(/1000ft) / 1000. The ×2 is not optional.",
            "Voltage drop, Ohm’s law: V = I × R.",
            "Percent drop: V / 12 V nominal × 100.",
            "Temperature: R(T) = R(20)(1 + α(T−20)), α = 0.00393/°C for copper.",
        ]),
        ToolNoteColumn(heading: "where it stops being true", bullets: [
            "The table is DC resistance for solid annealed copper at 20°C. Real wire is stranded and warm, so actual drop runs 2 to 8% higher. That is what the stranded mode is for.",
            "Percent is measured against 12 V nominal. A rested pack sits near 12.7 to 13.1 V and sags under load, so this is a design reference, not a live reading.",
            "The 3% and 5% bands are engineering guidance. FRC sets no maximum drop, only a minimum gauge.",
            "Wiring attached or specified by a manufacturer, like the leads already on a motor controller, is exempt from R622. This checker is for wire your team runs.",
            "Gauges and rule numbers are 2026 (TU22) and match 2025 V11, but FRC revises wiring rules. This is not a substitute for inspection.",
        ]),
        ToolNoteColumn(heading: "sources for every default", bullets: [
            "Per-gauge resistance (Ω/1000 ft, solid Cu, 20°C): 6=0.3951, 8=0.6282, 10=0.9989, 12=1.588, 14=2.525, 16=4.016, 18=6.385, 20=10.15, 22=16.14, 24=25.67, from the [HyperPhysics AWG table](https://hyperphysics.gsu.edu/hbase/Tables/wirega.html), reproduced from R = ρ/A.",
            "Copper resistivity ρ = 1.7241×10⁻⁸ Ω·m at 20°C, 100% IACS (\(JS.toExponential(WireGaugeMath.copperResistivityOhmM, 4))), IEC 60028.",
            "Copper α = 0.00393/°C at 20°C, IEC 60028.",
            "Round-trip factor ×2, a series-circuit identity.",
            "12 V nominal, 6 AWG main path, 120 A main breaker, and the Table 8-4 minimums (31 to 40 A gives 12, 21 to 30 A gives 14, 6 to 20 A gives 18, 5 A and under gives 22, VRM 2 A gives 24), from the [2026 REBUILT Game Manual, R601-A, R609, R622](https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf).",
            "Stranded uplift of 2 to 5% over the solid table is an estimate you can edit, not an exact figure.",
        ], footnote: "Not affiliated with or endorsed by FIRST."),
    ]
}

#Preview("Wire gauge, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    NavigationStack { WireGaugeView() }
        .appEnvironment(.preview)
}

#Preview("Wire gauge, iPad, dark", traits: .fixedLayout(width: 1180, height: 2000)) {
    NavigationStack { WireGaugeView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}

#if DEBUG
#Preview("Wire gauge, Duo book", traits: .duoBook) {
    NavigationStack { WireGaugeView() }
        .appEnvironment(.preview)
        .previewFold(.previewBook)
}

#Preview("Wire gauge, Duo laptop", traits: .duoLaptop) {
    NavigationStack { WireGaugeView() }
        .appEnvironment(.preview)
        .previewFold(.previewLaptop)
}
#endif
