import SwiftUI

/// Structural Deflection (learnfrc.com/tools/frc-deflection-calculator). Someone opens this
/// holding a length of tube and one worry: will it sag, and will it stay bent. The verdict
/// answers both first; then the member on one tag, the section beside its dimensions and the
/// load case drawn, and every formula with the numbers in it.
struct DeflectionView: View {
    @State private var inputs = DeflectionMath.Inputs()
    @FocusState private var focus: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private let tool = ToolCatalog.info(slug: ToolCatalog.deflection)!

    private var sectionFields: [String] {
        switch inputs.section.shape {
        case .tube: ["b", "h", "wall"]
        case .round: ["d", "wall"]
        case .solid: ["b", "h"]
        case .customI: ["i", "h"]
        }
    }

    private var order: [String] {
        (inputs.material.custom ? ["customE"] : []) + ["yield", "length", "load"] + sectionFields
    }

    private func next(after field: String) -> () -> Void {
        { if let i = order.firstIndex(of: field), i + 1 < order.count { focus = order[i + 1] } else { focus = nil } }
    }

    var body: some View {
        let r = DeflectionMath.compute(inputs)
        let stamps = DeflectionMath.stamps(r)
        let verdict = ToolVerdict(kicker: DeflectionMath.kicker(inputs), line: DeflectionMath.verdictLine(r),
                                  message: DeflectionMath.verdictBody(r, yieldText: inputs.yieldMPa), figures: stamps)
        ToolPage(tool: tool, focus: $focus, order: order, readout: [
            ToolReadout(value: stamps[0].value, unit: "in of sag"),
            ToolReadout(value: stamps[1].value, unit: DeflectionMath.band(r)),
            ToolReadout(value: stamps[2].value, unit: r.hasYield ? "against yield" : "enter a yield"),
        ], keypadSummary: "\(stamps[0].value) in · \(stamps[1].value)", verdict: verdict) { layout in
            VStack(alignment: .leading, spacing: 0) {
                ToolHeader(slug: tool.slug, before: "How far does it bend, and does it ", mark: "come back", after: "?",
                           lede: "Deflection, bending stress and safety factor for an arm tube, an elevator rail or a plate. Pick a support, a load case, a material and a stock section, and every number recomputes as you type.",
                           note: "Moduli are physical constants from primary datasheets, so they do not change by season. This is an ideal single-piece beam: real parts with bolted joints deflect more.",
                           pen: "height in the bending direction is cubed", layout: layout)
                shelf
                    .padding(.top, 28)
            }
            .learnColumn(layout)
            .padding(.top, 20)

            ToolVerdictSlab(verdict, layout: layout)

            member(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 44)

            section(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            VStack(alignment: .leading, spacing: 0) {
                LearnSectionHeader(kicker: "the working / nothing hidden", title: "Every line, with your numbers in it.")
                ToolWorking(rows: DeflectionMath.working(r, inputs), layout: layout)
                    .padding(.top, 24)
                ToolNote(kicker: "what a safety factor of two does not cover",
                         text: "Two against yield is the usual FRC target for a static load. It says nothing about impact, vibration or fatigue, and a lightening hole or a notch concentrates stress well above the plain-section figure, so a drilled tube yields before this number says it should.")
                    .padding(.top, 26)
            }
            .learnColumn(layout)
            .padding(.top, 52)

            ToolBackOfSheet(title: "Where every material number came from.", columns: Self.notes, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)
        }
    }

    // MARK: The stock shelf

    private var shelf: some View {
        VStack(alignment: .leading, spacing: 0) {
            DashedRule()
            SlugText("off the shelf")
                .padding(.top, 16)
            ToolChips(label: "Stock sections", options: DeflectionMath.sections.map { (value: $0.key, title: $0.label) },
                      selected: inputs.sectionKey) { key in
                DeflectionMath.selectSection(key, in: &inputs)
            }
            .padding(.top, 8)
            Text(inputs.section.note)
                .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(70)
                .padding(.top, 10)
        }
    }

    // MARK: The member

    private func member(_ r: DeflectionMath.Result, layout: LearnLayout) -> some View {
        let material = inputs.material
        let lu = inputs.lengthUnit.rawValue
        let position = DeflectionMath.loadPosition(inputs.support)
        let materialBinding = Binding(get: { inputs.materialKey }, set: { DeflectionMath.selectMaterial($0, in: &inputs) })
        return VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the member / what it is and what pushes", title: "Describe the part you are about to load.")
            ToolFlowLayout(spacing: 24, lineSpacing: 4) {
                ToolUnitSwitch(caption: "lengths in", options: DeflectionMath.LengthUnit.allCases.map { (value: $0, title: $0.rawValue) },
                               selected: inputs.lengthUnit) { DeflectionMath.switchLengthUnit($0, in: &inputs) }
                ToolUnitSwitch(caption: "force in", options: DeflectionMath.ForceUnit.allCases.map { (value: $0, title: $0.rawValue) },
                               selected: inputs.forceUnit) { DeflectionMath.switchForceUnit($0, in: &inputs) }
            }
            .padding(.top, 16)

            NotebookCard(tape: true) {
                VStack(alignment: .leading, spacing: 20) {
                    ToolFieldGrid(layout: layout) {
                        ToolMenuPicker(label: "Material", options: DeflectionMath.materials.map { (value: $0.key, title: $0.label) },
                                       selection: materialBinding,
                                       hint: material.custom
                                        ? "Enter Young's modulus below."
                                        : "E = \(ToolFormat.fixed(material.eGPa, 1)) GPa (\(material.eKsi)). \(material.note)")
                        if material.custom {
                            ToolNumberField(label: "Young’s modulus E (GPa)", text: $inputs.customE, field: "customE", focus: $focus,
                                            hint: "Straight off your material datasheet.", next: next(after: "customE"))
                        }
                        ToolNumberField(label: "Yield strength (MPa)", text: $inputs.yieldMPa, field: "yield", focus: $focus,
                                        hint: material.yieldNote, prompt: "276", next: next(after: "yield"))
                        ToolMenuPicker(label: "How it is held",
                                       options: [(value: DeflectionMath.Support.cantilever, title: "Cantilever, fixed at one end"),
                                                 (value: .simple, title: "Simply supported at both ends")],
                                       selection: $inputs.support,
                                       hint: inputs.support == .cantilever
                                        ? "An arm bolted to a gearbox plate at one end and free at the other."
                                        : "A rail resting on a bearing block at each end.")
                        ToolMenuPicker(label: "How the load arrives",
                                       options: [(value: DeflectionMath.LoadType.point, title: "One point load \(position)"),
                                                 (value: .distributed, title: "Spread evenly along the span")],
                                       selection: $inputs.loadType,
                                       hint: inputs.loadType == .point
                                        ? "A single force \(position)."
                                        : "The TOTAL load spread along the beam, not a per-inch figure.")
                        ToolNumberField(label: "Span (\(lu))", text: $inputs.length, field: "length", focus: $focus,
                                        hint: inputs.support == .cantilever
                                            ? "Free length from the fixed end to the tip."
                                            : "Clear span between the two supports.",
                                        next: next(after: "length"))
                        ToolNumberField(label: "\(DeflectionMath.loadWord(inputs.loadType)) (\(inputs.forceUnit.rawValue))",
                                        text: $inputs.load, field: "load", focus: $focus,
                                        hint: "Self weight is not added for you. Include it here if it matters.",
                                        next: next(after: "load"))
                    }
                    DashedRule()
                    ToolTerms(rows: DeflectionMath.memberLines(r, inputs))
                }
            }
            .padding(.top, 22)
        }
    }

    // MARK: The section

    private func section(_ r: DeflectionMath.Result, layout: LearnLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the section / drawn and measured", title: "The shape doing the work, and the load bending it.")
            ToolColumns(layout: layout) {
                NotebookCard {
                    ToolCardKicker(text: "dimensions / \(inputs.section.label)")
                    VStack(alignment: .leading, spacing: 20) {
                        dimensionFields
                    }
                    .padding(.top, 16)
                    DashedRule()
                        .padding(.top, 20)
                    ToolTerms(rows: DeflectionMath.sectionLines(r, inputs.section.shape))
                        .padding(.top, 14)
                    SlugText("Computed live from the dimensions above, never read out of a stored table.")
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 14)
                }
            } trailing: {
                NotebookCard(tilt: .tool(2, dynamicTypeSize), tape: true) {
                    ToolCardKicker(text: "load case / deflection drawn far larger than it is")
                    BeamDiagramView(support: inputs.support, loadType: inputs.loadType)
                        .accessibilityLabel("\(inputs.support == .cantilever ? "Cantilever" : "Simply supported") beam carrying \(inputs.loadType == .point ? "a single point load" : "a distributed load"), drawn with the deflection exaggerated.")
                        .padding(.top, 16)
                    Text(inputs.support == .cantilever
                         ? "Fixed at the left, free at the right. The tip carries the whole moment back to the mount, which is why an arm fails where it bolts on."
                         : "Pinned at both ends. The worst moment sits at mid-span, so that is where the holes hurt most.")
                        .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 12)
                    Button("Back to the 1x1 default") {
                        inputs = DeflectionMath.Inputs()
                        focus = nil
                    }
                    .buttonStyle(.inkGhostSmall)
                    .padding(.top, 18)
                }
                .padding(.top, layout.isRegular ? 32 : 0)
            }
            .padding(.top, 24)
        }
    }

    @ViewBuilder private var dimensionFields: some View {
        let lu = inputs.lengthUnit.rawValue
        switch inputs.section.shape {
        case .tube:
            ToolNumberField(label: "Outer width b (\(lu))", text: $inputs.secB, field: "b", focus: $focus,
                            hint: "The horizontal outer dimension.", next: next(after: "b"))
            ToolNumberField(label: "Outer height h (\(lu))", text: $inputs.secH, field: "h", focus: $focus,
                            hint: "The bending direction. This one is cubed, so it is the number that matters.", next: next(after: "h"))
            ToolNumberField(label: "Wall thickness (\(lu))", text: $inputs.secWall, field: "wall", focus: $focus,
                            hint: "FRC stock is usually 1/16 in, which is 0.0625.", next: next(after: "wall"))
        case .round:
            ToolNumberField(label: "Outer diameter D (\(lu))", text: $inputs.secD, field: "d", focus: $focus,
                            hint: "Outside diameter of the round tube.", next: next(after: "d"))
            ToolNumberField(label: "Wall thickness (\(lu))", text: $inputs.secWall, field: "wall", focus: $focus,
                            hint: "Tube wall thickness.", next: next(after: "wall"))
        case .solid:
            ToolNumberField(label: "Width b (\(lu))", text: $inputs.secB, field: "b", focus: $focus,
                            hint: "Width across the plate or bar.", next: next(after: "b"))
            ToolNumberField(label: "Thickness h (\(lu))", text: $inputs.secH, field: "h", focus: $focus,
                            hint: "The bending direction. On flat plate this is the thin dimension.", next: next(after: "h"))
        case .customI:
            ToolNumberField(label: "Area moment I (\(lu) to the fourth)", text: $inputs.secI, field: "i", focus: $focus,
                            hint: "Bending area moment about the neutral axis.", next: next(after: "i"))
            ToolNumberField(label: "Section height h (\(lu))", text: $inputs.secH, field: "h", focus: $focus,
                            hint: "Full height, used for c = h over 2.", next: next(after: "h"))
        }
    }

    // MARK: The back of the sheet

    private static let notes: [ToolNoteColumn] = [
        ToolNoteColumn(heading: "formulas used", bullets: [
            "Cantilever, point at the tip: d = P L³/(3EI), M = P L.",
            "Cantilever, distributed total W: d = W L³/(8EI), M = W L/2.",
            "Simply supported, point at mid-span: d = P L³/(48EI), M = P L/4.",
            "Simply supported, distributed total W: d = 5 W L³/(384EI), M = W L/8.",
            "Rectangular tube I = (b h³ - bi hi³)/12, round tube I = pi(D⁴ - d⁴)/64, solid I = b h³/12.",
            "Bending stress sigma = M c / I with c = h/2, and safety factor = yield / sigma.",
            "Source: Euler-Bernoulli beam theory. Hibbeler, Mechanics of Materials, and Roark’s Formulas for Stress and Strain, Table 8.1.",
        ]),
        ToolNoteColumn(heading: "where it stops being true", bullets: [
            "This is an idealised straight, uniform, single-piece beam on a perfect fixed or pinned support.",
            "Real FRC structures deflect more than this predicts, because bolted and riveted joints, gussets, bearing mounts and gearbox plates all flex. Joint compliance often dominates the real sag and none of it is modelled here.",
            "Transverse shear deflection is ignored. That is minor for a long slender beam and larger for a short stubby one.",
            "Stress concentrations at lightening holes, bends and welds are ignored, so drilled tube yields below the plain-section safety factor shown.",
            "Polycarbonate modulus varies by grade and temperature, and the material creeps under a sustained load, so treat those results as approximate and design conservatively.",
            "Verify member dimensions and wall thickness against your actual vendor stock. Nominal tube sizes vary by supplier.",
        ]),
        ToolNoteColumn(heading: "sources for every default", bullets: [
            "6061-T6: E = 68.9 GPa (10,000 ksi), yield 276 MPa (40 ksi), from the [MatWeb and ASM 6061-T6 datasheet](https://asm.matweb.com/search/SpecificMaterial.asp?bassnum=ma6061t6).",
            "7075-T6: E = 71.7 GPa (10,400 ksi), MatWeb and ASM. Yield is not in the verified set, so enter your own.",
            "Steel, mild 1018 or 4130: E = 200 GPa, about 29,000 ksi, from ASM material data. 4130 sits nearer 205 GPa.",
            "Polycarbonate: E = 2.3 GPa, about 0.33 Msi, grade-dependent across 2.0 to 2.4, from MatWeb plus the Lexan datasheets.",
            "Stock sections: 1x1 and 2x1 in tube with a 1/16 in (0.0625) wall, and 1/8 and 3/16 in polycarbonate plate, from [WestCoast Products](https://www.westcoastproducts.com/), TheThriftyBot and 80-20. I is computed from those dimensions, never stored.",
            "Unit constants: 1 in = 25.4 mm exactly, 1 lbf = 4.4482216 N, 1 ksi = 6.894757293 MPa. All defined, not measured.",
        ], footnote: "For reference only. Not a substitute for physical load testing, and not affiliated with or endorsed by FIRST."),
    ]
}

/// The load case in ink and ballpoint, in the site's 320 x 132 box. Schematic: the sag is
/// drawn far larger than any real deflection.
private struct BeamDiagramView: View {
    let support: DeflectionMath.Support
    let loadType: DeflectionMath.LoadType

    var body: some View {
        Canvas { context, size in
            let w = 320.0, h = 132.0, y0 = 56.0, x1 = 42.0, x2 = 320.0 - 24, span = x2 - x1, sag = 34.0
            let s = size.width / w
            func p(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x * s, y: y * s) }
            let ink = GraphicsContext.Shading.color(LF.Palette.ink)
            let blue = GraphicsContext.Shading.color(LF.Palette.blue)
            let cantilever = support == .cantilever
            let mid = (x1 + x2) / 2

            // The load, in ink.
            let arrows: [Double] = loadType == .point
                ? [cantilever ? x2 : mid]
                : [0.15, 0.325, 0.5, 0.675, 0.85].map { x1 + span * $0 }
            for ax in arrows {
                var line = Path()
                line.move(to: p(ax, y0 - 32))
                line.addLine(to: p(ax, y0 - 13))
                context.stroke(line, with: ink, lineWidth: 1.75 * s)
                var head = Path()
                head.move(to: p(ax - 7, y0 - 19.25))
                head.addLine(to: p(ax + 7, y0 - 19.25))
                head.addLine(to: p(ax, y0 - 7))
                head.closeSubpath()
                context.fill(head, with: ink)
            }
            if loadType == .distributed {
                var top = Path()
                top.move(to: p(x1, y0 - 32))
                top.addLine(to: p(x2, y0 - 32))
                context.stroke(top, with: ink, lineWidth: 1.5 * s)
            }

            // The beam at rest, then under load.
            var rest = Path()
            rest.move(to: p(x1, y0))
            rest.addLine(to: p(x2, y0))
            context.stroke(rest, with: ink, lineWidth: 3 * s)
            var bent = Path()
            bent.move(to: p(x1, y0))
            if cantilever {
                bent.addQuadCurve(to: p(x2, y0 + sag), control: p(x1 + span * 0.6, y0 + sag * 0.35))
            } else {
                bent.addQuadCurve(to: p(x2, y0), control: p(mid, y0 + sag * 1.6))
            }
            context.stroke(bent, with: blue, lineWidth: 2.25 * s)

            // The supports.
            if cantilever {
                var wall = Path()
                wall.move(to: p(x1, y0 - 24))
                wall.addLine(to: p(x1, y0 + 24))
                context.stroke(wall, with: ink, lineWidth: 2.5 * s)
                for i in 0..<5 {
                    var hatch = Path()
                    hatch.move(to: p(x1, y0 - 24 + Double(i) * 12))
                    hatch.addLine(to: p(x1 - 9, y0 - 17 + Double(i) * 12))
                    context.stroke(hatch, with: ink, lineWidth: 1.5 * s)
                }
            } else {
                for x in [x1, x2] {
                    var pin = Path()
                    pin.move(to: p(x, y0))
                    pin.addLine(to: p(x - 9, y0 + 17))
                    pin.addLine(to: p(x + 9, y0 + 17))
                    pin.closeSubpath()
                    context.stroke(pin, with: ink, lineWidth: 2 * s)
                }
            }

            // The sag, called out.
            var callout = Path()
            let cx = cantilever ? x2 : mid
            callout.move(to: p(cx, y0))
            callout.addLine(to: p(cx, y0 + (cantilever ? sag : sag * 1.6)))
            context.stroke(callout, with: blue, style: StrokeStyle(lineWidth: 1.25 * s, dash: [3 * s, 3 * s]))
            context.draw(Text("d = max deflection").font(LF.Fonts.mono(11 * s)).foregroundStyle(LF.Palette.graphite),
                         at: p(x2, h - 8), anchor: .bottomTrailing)
        }
        .aspectRatio(320.0 / 132.0, contentMode: .fit)
        .frame(maxWidth: 520)
        .dynamicTypeSize(.large)
        .accessibilityElement()
        .accessibilityAddTraits(.isImage)
    }
}

#Preview("Deflection, iPhone", traits: .fixedLayout(width: 393, height: 3200)) {
    NavigationStack { DeflectionView() }
        .appEnvironment(.preview)
}

#Preview("Deflection, iPad, dark", traits: .fixedLayout(width: 1180, height: 2400)) {
    NavigationStack { DeflectionView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}
