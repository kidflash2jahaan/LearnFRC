import SwiftUI

/// Tip-Over & Stability (learnfrc.com/tools/frc-tipping-calculator). Two failure modes matter
/// to a drive team: the robot goes over, or it slips. Both come out of the same few numbers,
/// so the verdict is stamped first and the rest is the working: the robot on one tag, the
/// cross-section drawn to scale beside what gives out first, and every formula filled in.
struct TippingView: View {
    @State private var inputs = TippingMath.Inputs()
    @State private var showAdvanced = false
    @FocusState private var focus: String?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private let tool = ToolCatalog.info(slug: ToolCatalog.tipping)!

    private var order: [String] {
        ["track", "wheelbase", "cog", "weight", "mu", "frac"] + (showAdvanced ? ["yOff", "xOff"] : [])
    }

    private func next(after field: String) -> () -> Void {
        { if let i = order.firstIndex(of: field), i + 1 < order.count { focus = order[i + 1] } else { focus = nil } }
    }

    var body: some View {
        let r = TippingMath.compute(inputs)
        let stamps = TippingMath.stamps(r)
        let verdict = ToolVerdict(kicker: "verdict / \(TippingMath.tippiness(r))", line: TippingMath.verdictLine(r),
                                  message: TippingMath.verdictBody(r), figures: stamps)
        ToolPage(tool: tool, focus: $focus, order: order, readout: [
            ToolReadout(value: stamps[0].value, unit: "g before two wheels lift"),
            ToolReadout(value: stamps[1].value, unit: "stability factor"),
            ToolReadout(value: stamps[2].value, unit: "cross-slope"),
        ], keypadSummary: "\(stamps[0].value) g · \(stamps[2].value)", verdict: verdict) { layout in
            VStack(alignment: .leading, spacing: 0) {
                ToolHeader(slug: tool.slug, before: "How hard can you turn before it ", mark: "goes over", after: "?",
                           lede: "Rigid-body statics for a drivetrain: the sideways acceleration that lifts two wheels, the cross-slope and ramp angles that do the same, whether it slides or tips first, and how hard it can push.",
                           note: "Geometry and weight defaults track the 2026 REBUILT manual, R103, R104 and R408. Friction figures are community estimates, not vendor specs, and they are yours to overwrite.",
                           pen: "measure the CoG, don’t guess it", layout: layout)
                shelf
                    .padding(.top, 28)
            }
            .learnColumn(layout)
            .padding(.top, 20)

            ToolVerdictSlab(verdict, layout: layout)

            robot(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 44)

            geometry(r, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)

            VStack(alignment: .leading, spacing: 0) {
                LearnSectionHeader(kicker: "the working / nothing hidden", title: "Every line, with your numbers in it.")
                ToolWorking(rows: TippingMath.working(r, unit: inputs.lengthUnit), layout: layout)
                    .padding(.top, 24)
                ToolNote(kicker: "which half of this you can trust",
                         text: "Tip accelerations, angles and the stability factor are exact rigid-body statics, so they are as right as the numbers you fed them. The push figure and the slide-or-tip verdict both hang on a friction coefficient that is empirical and varies with carpet age, wheel wear and dust, so read those as a range.")
                    .padding(.top, 26)
            }
            .learnColumn(layout)
            .padding(.top, 52)

            ToolBackOfSheet(title: "Every default, and how much to trust it.", columns: Self.notes, layout: layout)
                .learnColumn(layout)
                .padding(.top, 52)
        }
    }

    // MARK: The tread shelf

    private var shelf: some View {
        VStack(alignment: .leading, spacing: 0) {
            DashedRule()
            SlugText("what is on the wheels")
                .padding(.top, 16)
            ToolChips(label: "What is on the wheels",
                      options: TippingMath.muPresets.map { (value: $0.key, title: $0.label) },
                      selected: inputs.muPresetKey) { key in
                TippingMath.selectPreset(key, in: &inputs)
            }
            .padding(.top, 8)
            Text(inputs.preset.note)
                .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                .fixedSize(horizontal: false, vertical: true)
                .learnMeasure(70)
                .padding(.top, 10)
        }
    }

    // MARK: The robot

    private func robot(_ r: TippingMath.Result, layout: LearnLayout) -> some View {
        let lu = inputs.lengthUnit.rawValue
        let mu = Binding(get: { inputs.mu }, set: { TippingMath.editMu($0, in: &inputs) })
        return VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the robot / five numbers decide it", title: "Measure the drivetrain you actually built.")
            ToolFlowLayout(spacing: 24, lineSpacing: 4) {
                ToolUnitSwitch(caption: "lengths in", options: TippingMath.LengthUnit.allCases.map { (value: $0, title: $0.rawValue) },
                               selected: inputs.lengthUnit) { TippingMath.switchLengthUnit($0, in: &inputs) }
                ToolUnitSwitch(caption: "weight in", options: TippingMath.MassUnit.allCases.map { (value: $0, title: $0.rawValue) },
                               selected: inputs.massUnit) { TippingMath.switchMassUnit($0, in: &inputs) }
            }
            .padding(.top, 16)

            NotebookCard(tape: true) {
                VStack(alignment: .leading, spacing: 20) {
                    ToolFieldGrid(layout: layout) {
                        ToolNumberField(label: "Track width (\(lu))", text: $inputs.track, field: "track", focus: $focus,
                                        hint: "Side to side, wheel contact patch to wheel contact patch.", next: next(after: "track"))
                        ToolNumberField(label: "Wheelbase (\(lu))", text: $inputs.wheelbase, field: "wheelbase", focus: $focus,
                                        hint: "Front to back, wheel contact patch to wheel contact patch.", next: next(after: "wheelbase"))
                        ToolNumberField(label: "Centre of gravity height (\(lu))", text: $inputs.cog, field: "cog", focus: $focus,
                                        hint: "The number that dominates every result. Two inches out moves everything by 10 to 20%, so run a balance test.",
                                        next: next(after: "cog"))
                        ToolNumberField(label: "Weight on the wheels (\(inputs.massUnit.rawValue))", text: $inputs.weight, field: "weight",
                                        focus: $focus, hint: "Robot, bumpers and battery. 125 lb is a starting estimate, so weigh yours.",
                                        next: next(after: "weight"))
                        ToolNumberField(label: "Wheel on carpet, coefficient", text: mu, field: "mu", focus: $focus,
                                        hint: TippingMath.muHint(inputs.preset), next: next(after: "mu"))
                        ToolNumberField(label: "Weight on driven wheels", text: $inputs.drivenFrac, field: "frac", focus: $focus,
                                        hint: "1.0 for all-wheel drive. Lower it when some wheels are omnis or free casters.",
                                        next: next(after: "frac"))
                    }
                    ToolMarginWarning(text: "CoG height is an estimate, not a rule value. Find yours with a balance-point or tip-angle test before you trust anything on this page.")
                    ToolDisclosure(label: "advanced / a centre of gravity that is not centred", isOpen: $showAdvanced) {
                        ToolFieldGrid(layout: layout) {
                            ToolNumberField(label: "Sideways offset (\(lu))", text: $inputs.yOff, field: "yOff", focus: $focus,
                                            hint: "How far the CoG sits off the centreline. It always cuts the margin on that side.",
                                            next: next(after: "yOff"))
                            ToolNumberField(label: "Fore and aft offset (\(lu))", text: $inputs.xOff, field: "xOff", focus: $focus,
                                            hint: "How far the CoG sits off centre front to back. It cuts the pitch margin the same way.",
                                            next: next(after: "xOff"))
                        }
                    }
                    DashedRule()
                    ToolTerms(rows: TippingMath.leverLines(r, unit: inputs.lengthUnit))
                }
            }
            .padding(.top, 22)
        }
    }

    // MARK: The geometry

    private func geometry(_ r: TippingMath.Result, layout: LearnLayout) -> some View {
        let fmt = ToolFormat.fixed
        let lu = inputs.lengthUnit.rawValue
        return VStack(alignment: .leading, spacing: 0) {
            LearnSectionHeader(kicker: "the geometry / drawn from the front", title: "The lever holding it up, and the one tipping it over.")
            ToolColumns(layout: layout) {
                NotebookCard(tilt: .tool(1, dynamicTypeSize)) {
                    ToolCardKicker(text: "front view / to scale with your numbers")
                    TippingDiagramView(diagram: TippingMath.diagram(r, yOffText: inputs.yOff),
                                       caption: r.valid ? "track \(fmt(r.t, 1)) \(lu) · CoG \(fmt(r.h, 1)) \(lu) · \(fmt(r.thetaSide, 1))°" : nil)
                        .accessibilityLabel("Front view of the robot showing the wheels, the centre of gravity \(fmt(r.h, 1)) \(lu) above the floor, and the tipping edge at the outside of the \(fmt(r.t, 1)) \(lu) track.")
                        .padding(.top, 16)
                    Text("The dashed line is the restoring lever. Shortening the track or raising the centre of gravity swings it upright, and once it passes vertical the robot is already going over.")
                        .lfProse(15.5, lineHeight: 1.5, color: LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 12)
                }
            } trailing: {
                NotebookCard(tilt: .tool(2, dynamicTypeSize), tape: true) {
                    ToolCardKicker(text: "what gives out first")
                    VStack(spacing: 0) {
                        failureRow("On a cross-slope", r: r, slides: r.sideSlides, tan: r.tanSide, angle: r.thetaSide)
                        failureRow("Driving up a ramp", r: r, slides: r.pitchSlides, tan: r.tanPitch, angle: r.thetaRamp)
                    }
                    .padding(.top, 6)
                    ToolCardKicker(text: "how hard it can push")
                        .padding(.top, 20)
                    ToolBigFigure(value: fmt(r.pushLbf, 0), unit: "lbf, \(fmt(r.pushN, 0)) N")
                        .padding(.top, 12)
                    SlugText(TippingMath.pushNote(inputs.preset))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 10)
                    Button("Back to the defaults") {
                        inputs = TippingMath.Inputs()
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

    private func failureRow(_ label: String, r: TippingMath.Result, slides: Bool, tan: Double, angle: Double) -> some View {
        let verdict = TippingMath.failureVerdict(valid: r.valid, slides: slides)
        let detail = TippingMath.failureDetail(valid: r.valid, mu: r.muN, tan: tan, angle: angle)
        return VStack(alignment: .leading, spacing: 4) {
            ToolFlowLayout(spacing: 12, lineSpacing: 2) {
                Text(label)
                    .font(LF.Fonts.body(16, weight: .semibold))
                    .foregroundStyle(LF.Palette.ink)
                SlugText(verdict, color: LF.Palette.ink, weight: .bold)
            }
            SlugText(detail)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
        .overlay(alignment: .bottom) { DashedRule() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(verdict). \(detail)")
    }

    // MARK: The back of the sheet

    private static let notes: [ToolNoteColumn] = [
        ToolNoteColumn(heading: "where it stops being true", bullets: [
            "Tip angles, tip accelerations and the stability factor are exact statics for the geometry you enter, so they are as correct as your inputs. The dominant error is CoG height, so measure it rather than guessing.",
            "Real robots tip a little differently than ideal statics. Wheel scrub, tread squish, a bumper catching the floor, suspension travel and the fact that a real manoeuvre is not steady state all move the threshold.",
            "The push figure and the slide-or-tip verdict depend on the wheel-on-carpet coefficient, which varies with carpet age, wheel wear, dust and downforce. It is shown as a range and never as a certified value.",
            "Friction presets assume the official Shaw Philadelphia Commercial Neyland II 20 competition carpet. Shop floor, tile and other carpet all behave differently.",
            "Weight and size defaults are the 2026 REBUILT limits and they change most seasons, so re-verify against the current manual and enter your own measured numbers either way.",
        ]),
        ToolNoteColumn(heading: "formulas used", bullets: [
            "Static Stability Factor = track divided by twice the CoG height. It is NHTSA’s rollover metric, and for a centred CoG it equals the tip threshold in g.",
            "Tip acceleration = g times the restoring lever divided by CoG height, where the lever is half the track or half the wheelbase minus any offset.",
            "Tip angle = arctangent of the lever over the CoG height.",
            "It slides before it tips whenever the friction coefficient is below that same tangent.",
            "Traction-limited push = coefficient times the driven-weight fraction times weight on the wheels.",
        ]),
        ToolNoteColumn(heading: "sources for every default", bullets: [
            "g = 9.80665 m/s², which is 32.17405 ft/s², from the [NIST CODATA standard acceleration of gravity](https://physics.nist.gov/cgi-bin/cuu/Value?gn). Defined, not measured.",
            "Robot weight at or under 115.0 lb (52.16 kg) excluding bumpers and battery, R103, and robot plus bumpers at or under 135.0 lb, R408, from the [2026 REBUILT Game Manual](https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf).",
            "Perimeter at or under 110.0 in and height at or under 30 in, R104, which is what bounds the geometry inputs.",
            "Defaults of 27 in track and wheelbase, 13 in CoG height and 125 lb on the wheels are engineering estimates inside those bounds. CoG height is not a published spec anywhere and is the dominant error source.",
            "Friction presets and the 1.1 default are community and historical estimates from the [mrmctavish write-up](https://mrmctavish.wordpress.com/2021/12/20/coefficient-of-friction-for-wheels-in-frc-and-acceleration/), Chief Delphi threads and old WCP and AndyMark pages. None of them is currently vendor-published.",
            "Field carpet is Shaw Philadelphia Commercial Neyland II 20, per the [2026 field dimension drawings](https://firstfrc.blob.core.windows.net/frc2026/FieldAssets/2026-field-dimension-dwgs.pdf).",
        ], footnote: "Not affiliated with or endorsed by FIRST."),
    ]
}

/// The front view, drawn to scale with the entered numbers in the site's 320 x 210 box:
/// floor, body, wheels, the dashed restoring lever from the tipping edge to the centre of
/// gravity, and the weight pulling straight down.
private struct TippingDiagramView: View {
    let diagram: TippingMath.Diagram?
    let caption: String?

    var body: some View {
        Canvas { context, size in
            let s = size.width / TippingMath.Diagram.width
            func p(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x * s, y: y * s) }
            let ink = GraphicsContext.Shading.color(LF.Palette.ink)
            let blue = GraphicsContext.Shading.color(LF.Palette.blue)
            let floorY = TippingMath.Diagram.floorY

            var floor = Path()
            floor.move(to: p(16, floorY))
            floor.addLine(to: p(TippingMath.Diagram.width - 16, floorY))
            context.stroke(floor, with: ink, lineWidth: 2.5 * s)

            guard let d = diagram else {
                context.draw(Text("enter a track and a CoG height").font(LF.Fonts.mono(12 * s)).foregroundStyle(LF.Palette.graphite),
                             at: p(TippingMath.Diagram.centerX, floorY - 40), anchor: .center)
                return
            }
            let cx = TippingMath.Diagram.centerX
            let bodyRect = CGRect(x: (cx - d.halfTrackPx) * s, y: d.bodyTop * s, width: d.halfTrackPx * 2 * s,
                                  height: (floorY - d.bodyTop) * s)
            context.stroke(Path(bodyRect), with: ink, lineWidth: 2 * s)
            for x in [cx - d.halfTrackPx, cx + d.halfTrackPx] {
                let wheel = Path(ellipseIn: CGRect(x: (x - 7) * s, y: (floorY - 7) * s, width: 14 * s, height: 14 * s))
                context.stroke(wheel, with: ink, lineWidth: 2 * s)
            }
            var lever = Path()
            lever.move(to: p(d.tipX, floorY))
            lever.addLine(to: p(d.cogX, d.cogY))
            context.stroke(lever, with: blue, style: StrokeStyle(lineWidth: 2 * s, dash: [5 * s, 4 * s]))
            var weight = Path()
            weight.move(to: p(d.cogX, d.cogY))
            weight.addLine(to: p(d.cogX, floorY + 9 - 4))
            context.stroke(weight, with: ink, lineWidth: 2 * s)
            var head = Path()
            head.move(to: p(d.cogX - 4, floorY + 1))
            head.addLine(to: p(d.cogX + 4, floorY + 1))
            head.addLine(to: p(d.cogX, floorY + 9))
            head.closeSubpath()
            context.fill(head, with: ink)
            context.fill(Path(ellipseIn: CGRect(x: (d.cogX - 5) * s, y: (d.cogY - 5) * s, width: 10 * s, height: 10 * s)), with: blue)
            context.draw(Text("CoG").font(LF.Fonts.mono(11 * s)).foregroundStyle(LF.Palette.ink),
                         at: p(d.cogX + 10, d.cogY - 6), anchor: .bottomLeading)
            if let caption {
                context.draw(Text(caption).font(LF.Fonts.mono(11 * s)).foregroundStyle(LF.Palette.graphite),
                             at: p(cx, floorY + 24), anchor: .center)
            }
        }
        .aspectRatio(TippingMath.Diagram.width / TippingMath.Diagram.height, contentMode: .fit)
        .frame(maxWidth: 520)
        // A drawing: its labels scale with the drawing, not with the text size. The same
        // figures are printed as text beside it.
        .dynamicTypeSize(.large)
        .accessibilityElement()
        .accessibilityAddTraits(.isImage)
    }
}

#Preview("Tipping, iPhone", traits: .fixedLayout(width: 393, height: 3000)) {
    NavigationStack { TippingView() }
        .appEnvironment(.preview)
}

#Preview("Tipping, iPad, dark", traits: .fixedLayout(width: 1180, height: 2400)) {
    NavigationStack { TippingView() }
        .appEnvironment(.preview)
        .environment(\.colorScheme, .dark)
}
