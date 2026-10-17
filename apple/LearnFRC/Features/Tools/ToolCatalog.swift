import Foundation

/// The six calculators as learnfrc.com/tools lists them, in the site's order, with the
/// site's own words (`src/app/tools/page.tsx`).
///
/// `ask` is the question a person actually has, and `gives` says what falls out the other
/// end, so nobody has to open a calculator to find out what it does.
nonisolated struct ToolInfo: Identifiable, Hashable, Sendable {
    let slug: String
    let tag: String
    let title: String
    let ask: String
    let body: String
    let gives: String
    /// Index into the site's four card angles (`nb-tilt-1` ... `nb-tilt-4`, zero-based).
    let tilt: Int
    let tape: Bool
    /// The "keep reading" links at the foot of the calculator (`ToolCTA related`).
    let related: [ToolRelatedLink]

    var id: String { slug }

    /// learnfrc.com/tools/<slug>, for Share and Handoff.
    var webPath: String { "tools/\(slug)" }
}

/// One "keep reading" link: a site path (`/blog/...`, `/tools/...`, `/guides`) and its label.
nonisolated struct ToolRelatedLink: Hashable, Sendable {
    let path: String
    let label: String
}

nonisolated enum ToolCatalog {
    static let budget = "frc-budget-calculator"
    static let gearRatio = "frc-gear-ratio-calculator"
    static let wireGauge = "frc-wire-gauge-calculator"
    static let tipping = "frc-tipping-calculator"
    static let currentBudget = "frc-current-budget"
    static let deflection = "frc-deflection-calculator"

    static let all: [ToolInfo] = [
        ToolInfo(
            slug: budget,
            tag: "fundraising",
            title: "Team Budget Calculator",
            ask: "What will the season actually cost?",
            body: "Itemise registration, the drive base, the control system, tools and travel, then print the sheet a sponsor will read.",
            gives: "grand total / per student / itemised",
            tilt: 0,
            tape: true,
            related: [
                ToolRelatedLink(path: "/blog/frc-team-budget-worksheet", label: "FRC team budget worksheet"),
                ToolRelatedLink(path: "/blog/frc-sponsorship-letter-template", label: "Sponsorship letter template"),
                ToolRelatedLink(path: "/tools/frc-current-budget", label: "Current & brownout checker"),
            ]
        ),
        ToolInfo(
            slug: gearRatio,
            tag: "drivetrain",
            title: "Gear Ratio Calculator",
            ask: "Is this ratio fast enough, and can it still push?",
            body: "Overall reduction, free and adjusted speed, torque at the wheel, pushing force against the traction limit, and whether the draw browns you out.",
            gives: "reduction / ft per s / lbf / bus volts",
            tilt: 1,
            tape: false,
            related: [
                ToolRelatedLink(path: "/blog/frc-gear-ratios-explained", label: "FRC gear ratios explained"),
                ToolRelatedLink(path: "/blog/frc-drivetrain-types", label: "FRC drivetrain types compared"),
                ToolRelatedLink(path: "/tools/frc-current-budget", label: "Current & brownout checker"),
            ]
        ),
        ToolInfo(
            slug: wireGauge,
            tag: "electrical",
            title: "Wire Gauge & Voltage Drop",
            ask: "Is this wire thick enough, and is it legal?",
            body: "Round-trip voltage drop from Ohm's law, checked against the minimum gauge the manual sets for each breaker size.",
            gives: "volts dropped / % of 12 V / min AWG",
            tilt: 2,
            tape: false,
            related: [
                ToolRelatedLink(path: "/tools/frc-current-budget", label: "Current & brownout checker"),
                ToolRelatedLink(path: "/blog/frc-no-robot-code-driver-station-troubleshooting", label: "“No robot code” fixes"),
                ToolRelatedLink(path: "/guides", label: "All FRC guides"),
            ]
        ),
        ToolInfo(
            slug: tipping,
            tag: "drivetrain",
            title: "Tip-Over & Stability",
            ask: "How hard can we turn before two wheels lift?",
            body: "Track width, wheelbase and centre-of-gravity height give the tipping acceleration, the ramp angle, and whether you slide or tip first.",
            gives: "g before tip / tip angle / lbf of push",
            tilt: 3,
            tape: true,
            related: [
                ToolRelatedLink(path: "/tools/frc-current-budget", label: "Current & brownout checker"),
                ToolRelatedLink(path: "/tools/frc-wire-gauge-calculator", label: "Wire gauge & voltage drop"),
                ToolRelatedLink(path: "/guides", label: "All FRC guides"),
            ]
        ),
        ToolInfo(
            slug: currentBudget,
            tag: "power",
            title: "Current Budget & Brownout",
            ask: "Will it brown out when everything runs at once?",
            body: "Every motor against its own branch breaker, the total against the 120 A main, and the estimated bus voltage against the roboRIO brownout line.",
            gives: "amps / breaker headroom / bus volts",
            tilt: 2,
            tape: false,
            related: [
                ToolRelatedLink(path: "/tools/frc-wire-gauge-calculator", label: "Wire gauge & voltage drop"),
                ToolRelatedLink(path: "/blog/frc-no-robot-code-driver-station-troubleshooting", label: "“No robot code” fixes"),
                ToolRelatedLink(path: "/guides", label: "All FRC guides"),
            ]
        ),
        ToolInfo(
            slug: deflection,
            tag: "mechanical",
            title: "Structural Deflection",
            ask: "Will this arm sag, or bend for good?",
            body: "Material, cross-section, span and load give the tip or centre sag, the bending stress, and a safety factor against yield.",
            gives: "inches of sag / MPa / safety factor",
            tilt: 0,
            tape: false,
            related: [
                ToolRelatedLink(path: "/tools/frc-tipping-calculator", label: "Tip-over & stability"),
                ToolRelatedLink(path: "/blog/frc-elevator-arm-design-guide", label: "Elevator & arm design guide"),
                ToolRelatedLink(path: "/guides", label: "All FRC guides"),
            ]
        ),
    ]

    static func info(slug: String) -> ToolInfo? {
        let key = slug.lowercased()
        return all.first { $0.slug == key }
    }
}
