import Foundation

/// The Structural Deflection sheet (learnfrc.com/tools/frc-deflection-calculator), ported
/// from the site's `_calculator.tsx`: the same verified moduli, stock sections, exact
/// Euler-Bernoulli cases, unit conversions and stiffness bands.
nonisolated enum DeflectionMath {
    // Exact unit conversions (defined constants, not estimates).
    static let mPerIn = 0.0254          // NIST exact: 1 in = 0.0254 m
    static let inToMm = 25.4            // exact
    static let lbfToN = 4.4482216       // NIST exact: 1 lbf = 4.4482216 N
    static let paPerKsi = 6_894_757.293 // 1 ksi = 6894.757293 kPa (defined)

    struct Material: Hashable, Sendable, Identifiable {
        let key: String
        let label: String
        let eGPa: Double
        let eKsi: String
        let eSource: String
        let eConfidence: String
        let yieldMPa: Double?
        let yieldNote: String
        let note: String
        var custom = false
        var id: String { key }
    }

    static let materials: [Material] = [
        Material(key: "6061", label: "6061-T6 aluminum", eGPa: 68.9, eKsi: "10,000 ksi", eSource: "MatWeb / ASM 6061-T6 datasheet",
                 eConfidence: "high", yieldMPa: 276,
                 yieldNote: "276 MPa (40 ksi), MatWeb and ASM. This one is verified, and still editable.",
                 note: "The most common FRC structural aluminum, in tube and plate."),
        Material(key: "7075", label: "7075-T6 aluminum", eGPa: 71.7, eKsi: "10,400 ksi", eSource: "MatWeb / ASM 7075-T6 datasheet",
                 eConfidence: "high", yieldMPa: nil,
                 yieldNote: "Not in the verified dataset. Enter your datasheet yield to get a safety factor.",
                 note: "Stronger and pricier aluminum. E is verified, the yield is yours to enter."),
        Material(key: "steel", label: "Steel (mild 1018 or 4130)", eGPa: 200, eKsi: "about 29,000 ksi",
                 eSource: "ASM material data (1018 about 200, 4130 about 205 GPa)", eConfidence: "high", yieldMPa: nil,
                 yieldNote: "Yield depends heavily on grade and heat treat. Enter the number for your grade.",
                 note: "1018 sits near 200 GPa, 4130 near 205 GPa."),
        Material(key: "polycarb", label: "Polycarbonate (Lexan)", eGPa: 2.3, eKsi: "about 0.33 Msi",
                 eSource: "MatWeb Polycarbonate plus Lexan datasheets", eConfidence: "medium", yieldMPa: nil,
                 yieldNote: "Grade and temperature dependent. Enter your grade's yield if you know it.",
                 note: "Varies from 2.0 to 2.4 GPa by grade, and it creeps under a sustained load."),
        Material(key: "custom", label: "Custom, enter E and yield", eGPa: 68.9, eKsi: "your value", eSource: "user-entered",
                 eConfidence: "high", yieldMPa: nil, yieldNote: "Enter the yield strength for your material.",
                 note: "Modulus and yield straight off your own material datasheet.", custom: true),
    ]

    enum Shape: String, Hashable, Sendable { case tube, round, solid, customI }

    struct Section: Hashable, Sendable, Identifiable {
        let key: String
        let label: String
        let shape: Shape
        var bIn: Double?
        var hIn: Double?
        var wallIn: Double?
        var dIn: Double?
        var iIn4: Double?
        let note: String
        var id: String { key }
    }

    static let sections: [Section] = [
        Section(key: "1x1", label: "1x1 tube", shape: .tube, bIn: 1, hIn: 1, wallIn: 0.0625,
                note: "1x1 in square tube with a 0.0625 in (1/16) wall. WCP MaxTube, TheThriftyBot, 80-20 stock."),
        Section(key: "2x1-strong", label: "2x1 tube, standing tall", shape: .tube, bIn: 1, hIn: 2, wallIn: 0.0625,
                note: "2x1 in tube with the 2 in dimension in the bending direction, the stiff orientation, 1/16 in wall."),
        Section(key: "2x1-weak", label: "2x1 tube, laid flat", shape: .tube, bIn: 2, hIn: 1, wallIn: 0.0625,
                note: "The same 2x1 tube laid flat, so only 1 in is in the bending direction. Much floppier for no weight saved."),
        Section(key: "round", label: "Round tube", shape: .round, wallIn: 0.0625, dIn: 1,
                note: "Round tube. Enter your outer diameter and wall thickness, no stock size assumed."),
        Section(key: "plate", label: "Solid bar or polycarb plate", shape: .solid, bIn: 2, hIn: 0.125,
                note: "Solid rectangle, width by thickness. Polycarb plate is usually 1/8 in (0.125) or 3/16 in (0.1875), and it bends about the thin dimension."),
        Section(key: "customI", label: "Enter I directly", shape: .customI, hIn: 1, iIn4: 0.05,
                note: "For a section this tool does not draw: enter a known area moment of inertia and the section height, which sets c = height over 2."),
    ]

    enum Support: String, Hashable, Sendable, CaseIterable { case cantilever, simple }
    enum LoadType: String, Hashable, Sendable, CaseIterable { case point, distributed }
    enum LengthUnit: String, Hashable, Sendable, CaseIterable { case inch = "in", mm }
    enum ForceUnit: String, Hashable, Sendable, CaseIterable { case lb, newton = "N" }

    /// Deflection as d = k x Load x L^3 / (E I).
    static func deflectionCoeff(_ support: Support, _ load: LoadType) -> Double {
        if support == .cantilever { return load == .point ? 1.0 / 3 : 1.0 / 8 }
        return load == .point ? 1.0 / 48 : 5.0 / 384
    }

    /// Max bending moment as M = k x Load x L.
    static func momentCoeff(_ support: Support, _ load: LoadType) -> Double {
        if support == .cantilever { return load == .point ? 1 : 1.0 / 2 }
        return load == .point ? 1.0 / 4 : 1.0 / 8
    }

    static func deltaFormula(_ support: Support, _ load: LoadType) -> String {
        switch (support, load) {
        case (.cantilever, .point): "d = P L^3 / (3 E I)"
        case (.cantilever, .distributed): "d = W L^3 / (8 E I)"
        case (.simple, .point): "d = P L^3 / (48 E I)"
        case (.simple, .distributed): "d = 5 W L^3 / (384 E I)"
        }
    }

    static func momentFormula(_ support: Support, _ load: LoadType) -> String {
        switch (support, load) {
        case (.cantilever, .point): "M = P L"
        case (.cantilever, .distributed): "M = W L / 2"
        case (.simple, .point): "M = P L / 4"
        case (.simple, .distributed): "M = W L / 8"
        }
    }

    static func sectionFormula(_ shape: Shape) -> String {
        switch shape {
        case .tube: "I = (b h^3 - bi hi^3) / 12"
        case .round: "I = pi (D^4 - d^4) / 64"
        case .solid: "I = b h^3 / 12"
        case .customI: "I entered directly"
        }
    }

    /// Every field as typed, in the units on screen, like the site's state.
    struct Inputs: Hashable, Sendable {
        var lengthUnit: LengthUnit = .inch
        var forceUnit: ForceUnit = .lb
        var materialKey = "6061"
        var customE = "68.9"
        var yieldMPa = "276"
        var support: Support = .cantilever
        var loadType: LoadType = .point
        var length = "20"
        var load = "15"
        var sectionKey = "1x1"
        var secB = "1"
        var secH = "1"
        var secWall = "0.0625"
        var secD = "1"
        var secI = "0.05"

        var material: Material { materials.first { $0.key == materialKey } ?? materials[0] }
        var section: Section { sections.first { $0.key == sectionKey } ?? sections[0] }
    }

    struct Result: Hashable, Sendable {
        let valid: Bool
        let iM4: Double
        let iIn4: Double
        let iCm4: Double
        let cM: Double
        let cIn: Double
        let lM: Double
        let lIn: Double
        let loadN: Double
        let momentNm: Double
        let deltaIn: Double
        let deltaMm: Double
        let sigmaMPa: Double
        let sigmaKsi: Double
        let sf: Double
        let ratio: Double
        let eGPa: Double
        let hasYield: Bool
    }

    static func compute(_ i: Inputs) -> Result {
        let p = ToolFormat.parseNum
        let toM: (Double) -> Double = { v in i.lengthUnit == .inch ? v * mPerIn : v / 1000 }
        let shape = i.section.shape

        // Section geometry to I (m^4) and c (m), from the exact standard formulas.
        var I = Double.nan
        var c = Double.nan
        switch shape {
        case .tube:
            let b = toM(p(i.secB)), h = toM(p(i.secH)), t = toM(p(i.secWall))
            let bi = b - 2 * t, hi = h - 2 * t
            if b > 0 && h > 0 && t > 0 && bi > 0 && hi > 0 {
                I = (b * pow(h, 3) - bi * pow(hi, 3)) / 12   // about the horizontal neutral axis
                c = h / 2
            }
        case .round:
            let D = toM(p(i.secD)), t = toM(p(i.secWall))
            let d = D - 2 * t
            if D > 0 && t > 0 && d > 0 {
                I = (Double.pi * (pow(D, 4) - pow(d, 4))) / 64
                c = D / 2
            }
        case .solid:
            let b = toM(p(i.secB)), h = toM(p(i.secH))
            if b > 0 && h > 0 {
                I = (b * pow(h, 3)) / 12
                c = h / 2
            }
        case .customI:
            // I in the display unit to the fourth, height in the display unit for c.
            let iDisp = p(i.secI)
            let h = toM(p(i.secH))
            let factor = i.lengthUnit == .inch ? pow(mPerIn, 4) : pow(1.0 / 1000, 4)
            if iDisp > 0 && h > 0 {
                I = iDisp * factor
                c = h / 2
            }
        }

        let material = i.material
        let eGPa = material.custom ? p(i.customE) : material.eGPa
        let E = eGPa * 1e9
        let L = toM(p(i.length))
        let loadN = i.forceUnit == .lb ? p(i.load) * lbfToN : p(i.load)
        let yldPa = p(i.yieldMPa) > 0 ? p(i.yieldMPa) * 1e6 : Double.nan

        let valid = I.isFinite && I > 0 && c.isFinite && E > 0 && L > 0 && loadN > 0

        let kDelta = deflectionCoeff(i.support, i.loadType)
        let kM = momentCoeff(i.support, i.loadType)

        let deltaM = valid ? (kDelta * loadN * pow(L, 3)) / (E * I) : .nan
        let momentNm = valid ? kM * loadN * L : .nan
        let sigmaPa = valid ? (momentNm * c) / I : .nan
        let sf = valid && yldPa.isFinite ? yldPa / sigmaPa : .nan
        let ratio = valid && deltaM > 0 ? L / deltaM : .nan

        return Result(valid: valid, iM4: I, iIn4: I / pow(mPerIn, 4), iCm4: I * 1e8, cM: c, cIn: c / mPerIn, lM: L, lIn: L / mPerIn,
                      loadN: loadN, momentNm: momentNm, deltaIn: deltaM / mPerIn, deltaMm: deltaM * 1000,
                      sigmaMPa: sigmaPa / 1e6, sigmaKsi: sigmaPa / paPerKsi, sf: sf, ratio: ratio, eGPa: eGPa,
                      hasYield: yldPa.isFinite)
    }

    // MARK: Words

    /// The stiffness band from span over deflection, in words rather than a colour.
    static func band(_ r: Result) -> String {
        guard r.valid else { return "not enough numbers" }
        if r.ratio >= 360 { return "very stiff" }
        if r.ratio >= 180 { return "stiff" }
        if r.ratio >= 90 { return "noticeable flex" }
        return "excessive flex"
    }

    static func verdictLine(_ r: Result) -> String {
        if !r.valid { return "Not enough numbers yet." }
        if r.hasYield && r.sf < 1 { return "This member is predicted to yield." }
        if r.ratio < 90 { return "It survives, but it flexes badly." }
        if r.hasYield && r.sf < 2 { return "It holds, with thinner margin than most teams want." }
        return "Stiff enough, with margin left over."
    }

    static func verdictBody(_ r: Result, yieldText: String) -> String {
        let fmt = ToolFormat.fixed
        if !r.valid { return "Enter a span, a load and a section with real wall thickness and the sheet fills in." }
        if r.hasYield && r.sf < 1 {
            return "Bending stress reaches \(fmt(r.sigmaMPa, 1)) MPa against a \(fmt(ToolFormat.parseNum(yieldText), 0)) MPa yield, so the part takes a permanent set. Add height in the bending direction before you add wall."
        }
        if r.ratio < 90 {
            return "\(fmt(r.deltaIn, 3)) in of sag over \(fmt(r.lIn, 1)) in of span is L/\(fmt(r.ratio, 0)). Nothing breaks, but the mechanism at the end of it will not repeat."
        }
        if r.hasYield && r.sf < 2 {
            return "Safety factor of \(fmt(r.sf, 2)) against yield. Two is the usual FRC target for a static load, and a drilled or notched member yields below the plain-section figure."
        }
        if r.hasYield {
            return "\(fmt(r.deltaIn, 3)) in of sag and \(fmt(r.sf, 2)) times margin against yield, on an ideal beam with no joints in it."
        }
        return "\(fmt(r.deltaIn, 3)) in of sag, which is L/\(fmt(r.ratio, 0)). Enter a yield strength to get a safety factor as well."
    }

    static func kicker(_ i: Inputs) -> String {
        "verdict / \(i.support == .cantilever ? "cantilever" : "simply supported"), \(i.loadType == .point ? "point load" : "distributed load")"
    }

    static func stamps(_ r: Result) -> [(value: String, label: String)] {
        let fmt = ToolFormat.fixed
        return [
            (fmt(r.deltaIn, 3), "inches of sag, \(fmt(r.deltaMm, 2)) mm"),
            (r.valid ? "L/\(fmt(r.ratio, 0))" : "n/a", "span over deflection, \(band(r))"),
            (r.valid && r.hasYield ? "\(fmt(r.sf, 2))x" : "n/a", r.hasYield ? "margin against yield" : "enter a yield to get margin"),
        ]
    }

    /// "at the free tip" or "at mid-span".
    static func loadPosition(_ support: Support) -> String {
        support == .cantilever ? "at the free tip" : "at mid-span"
    }

    static func loadWord(_ load: LoadType) -> String {
        load == .point ? "Point load" : "Total distributed load"
    }

    /// The member tag's footer.
    static func memberLines(_ r: Result, _ i: Inputs) -> [(term: String, value: String)] {
        let fmt = ToolFormat.fixed
        let m = i.material
        return [
            ("modulus", "E = \(fmt(r.eGPa, 1)) GPa, from \(m.eSource), confidence \(m.eConfidence)"),
            ("load case", deltaFormula(i.support, i.loadType)),
            ("worst moment", "\(momentFormula(i.support, i.loadType)), which is \(fmt(r.momentNm, 2)) N·m here"),
            ("bending stress", "\(fmt(r.sigmaMPa, 1)) MPa, \(fmt(r.sigmaKsi, 2)) ksi"),
        ]
    }

    /// The section card's footer.
    static func sectionLines(_ r: Result, _ shape: Shape) -> [(term: String, value: String)] {
        let fmt = ToolFormat.fixed
        return [
            ("formula", sectionFormula(shape)),
            ("area moment", "\(fmt(r.iIn4, 4)) in⁴, \(fmt(r.iCm4, 3)) cm⁴"),
            ("outer fibre", "c = \(fmt(r.cIn, 3)) in"),
        ]
    }

    /// Every formula with the entered numbers in it.
    static func working(_ r: Result, _ i: Inputs) -> [(title: String, formula: String, worked: String)] {
        let fmt = ToolFormat.fixed
        return [
            ("Area moment of inertia", sectionFormula(i.section.shape), "I = \(fmt(r.iIn4, 4)) in⁴ = \(JS.toExponential(r.iM4, 3)) m⁴"),
            ("Outer fibre distance", "c = h / 2", "c = \(fmt(r.cIn, 3)) in = \(fmt(r.cM * 1000, 2)) mm"),
            ("Span and load, in SI", "L in metres, P or W in newtons", "L = \(fmt(r.lM, 4)) m, load = \(fmt(r.loadN, 2)) N"),
            ("Max deflection", deltaFormula(i.support, i.loadType), "d = \(fmt(r.deltaIn, 4)) in = \(fmt(r.deltaMm, 3)) mm"),
            ("Deflection against span", "L / d", r.valid ? "L/\(fmt(r.ratio, 0)), \(band(r))" : "n/a"),
            ("Max bending moment", momentFormula(i.support, i.loadType), "M = \(fmt(r.momentNm, 3)) N·m"),
            ("Max bending stress", "sigma = M c / I", "sigma = \(fmt(r.sigmaMPa, 2)) MPa = \(fmt(r.sigmaKsi, 3)) ksi"),
            ("Safety factor", "SF = yield / sigma", r.valid && r.hasYield
                ? "SF = \(fmt(ToolFormat.parseNum(i.yieldMPa), 0)) / \(fmt(r.sigmaMPa, 2)) = \(fmt(r.sf, 2))"
                : "enter a yield strength above"),
        ]
    }

    // MARK: Editing, like the site's handlers

    /// A length defined in inches, in the selected unit, as the site writes it into a field.
    private static func fromIn(_ inches: Double, _ digits: Int, _ unit: LengthUnit) -> String {
        let v = unit == .inch ? inches : inches * inToMm
        let scale = pow(10.0, Double(digits))
        return JS.string(JS.round(v * scale) / scale)
    }

    /// Picking a material also seeds its yield (blank when the dataset has none).
    static func selectMaterial(_ key: String, in i: inout Inputs) {
        i.materialKey = key
        if let m = materials.first(where: { $0.key == key }) {
            i.yieldMPa = m.yieldMPa.map(JS.string) ?? ""
        }
    }

    /// Picking a stock section fills in its dimensions in the unit on screen.
    static func selectSection(_ key: String, in i: inout Inputs) {
        i.sectionKey = key
        guard let s = sections.first(where: { $0.key == key }) else { return }
        if let b = s.bIn { i.secB = fromIn(b, 4, i.lengthUnit) }
        if let h = s.hIn { i.secH = fromIn(h, 4, i.lengthUnit) }
        if let w = s.wallIn { i.secWall = fromIn(w, 4, i.lengthUnit) }
        if let d = s.dIn { i.secD = fromIn(d, 4, i.lengthUnit) }
        if let iIn4 = s.iIn4 {
            // I converts with the fourth power of the length factor.
            let disp = i.lengthUnit == .inch ? iIn4 : iIn4 * pow(inToMm, 4)
            i.secI = JS.string(JS.round(disp * 10000) / 10000)
        }
    }

    static func switchLengthUnit(_ next: LengthUnit, in i: inout Inputs) {
        guard next != i.lengthUnit else { return }
        let f = next == .mm ? inToMm : 1 / inToMm
        let lin: (String) -> String = { JS.string(JS.round(ToolFormat.parseNum($0) * f * 10000) / 10000) }
        i.secB = lin(i.secB)
        i.secH = lin(i.secH)
        i.secWall = lin(i.secWall)
        i.secD = lin(i.secD)
        i.length = JS.string(JS.round(ToolFormat.parseNum(i.length) * f * 100) / 100)
        i.secI = JS.string(JS.round(ToolFormat.parseNum(i.secI) * pow(f, 4) * 10000) / 10000)
        i.lengthUnit = next
    }

    static func switchForceUnit(_ next: ForceUnit, in i: inout Inputs) {
        guard next != i.forceUnit else { return }
        let f = next == .newton ? lbfToN : 1 / lbfToN
        i.load = JS.string(JS.round(ToolFormat.parseNum(i.load) * f * 100) / 100)
        i.forceUnit = next
    }
}
