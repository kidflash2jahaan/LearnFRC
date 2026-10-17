import SwiftUI

/// The long-form copy under the gear ratio calculator on learnfrc.com (the page's "the theory
/// behind the numbers" band and its six questions), word for word. The answers are the reason
/// search sends people to this page, so they're all visible, never folded behind a tap.
struct GearRatioTheory: View {
    let layout: LearnLayout

    struct Section {
        let title: String?
        let paragraphs: [String]
    }

    static let sections: [Section] = [
        Section(title: nil, paragraphs: [
            "A gearbox is a trade, and only a trade. It cannot create power. It can only convert the power a motor already makes from one shape into another. Reduce by 10:1 and the output shaft turns a tenth as fast and delivers about ten times the torque. That is the whole idea, and almost every drivetrain argument your team will have is really an argument about where on that trade you want to sit.",
            "One reduction is just the driven gear's tooth count over the driving gear's. A 14-tooth pinion turning a 50-tooth gear is 50 ÷ 14, or 3.571:1. Stack stages and you multiply them: the KOP ToughBox Mini that everyone calls “8.45:1” is really a 14T into 50T followed by a 19T into 45T, which works out to 8.459. Chain and belt runs count exactly the same way, sprocket teeth over sprocket teeth, so a 12T to 36T chain run is another 3:1 on top of whatever the gearbox already did.",
        ]),
        Section(title: "Free speed is a fiction you should still calculate", paragraphs: [
            "Free speed is what you get from pure geometry: take the motor's no-load RPM, divide by the reduction, and multiply by the wheel circumference. It is exact, and your robot will never once achieve it. A motor only reaches free speed when it is doing no work at all, and a robot on carpet is always doing work: squashing tread, dragging bearings, scrubbing wheels sideways through every turn.",
            "So the convention is to derate. Multiplying free speed by 80-85% gets you a number that matches what teams actually clock on a field, and that is the figure worth comparing between designs. It is an empirical allowance, not a derivation from first principles, which is exactly why the calculator above puts it in an editable box rather than hiding it inside the result. If your robot only ever travels twenty feet at a stretch, you may not even reach the adjusted number before it is time to brake.",
            "Efficiency is a separate thing, and it is easy to double-count. Gear losses take torque, not speed. A 90%-efficient gearbox still spins its output at very nearly the full free speed with nothing attached; what it loses is roughly a tenth of the force you can get out of it. That is why the calculator applies efficiency to torque and pushing force but leaves free speed alone. Budget about 95% per gear mesh and 97% per chain or belt run: two stages lands near 90%, a three-stage swerve module near 86%.",
        ]),
        Section(title: "Picking a drivetrain ratio", paragraphs: [
            "Rookie teams tend to ask “what ratio should we use?” when the useful question is “what is currently limiting us?” There are only two answers. If your gearing can generate more force at the wheel than friction with the carpet can hold, you are **traction-limited**: the wheels break loose and spin, and adding reduction makes you slower without making you push any harder. If the carpet could hold more than your motors can deliver, you are **torque-limited**: the wheels grip, the motors bog down, and more reduction genuinely does help.",
            "The calculator tells you which one you are, because the fix is completely different in each case. Traction-limited robots need grippier tread, more weight over the driven wheels, or simply a lower current limit to stop wasting energy spinning wheels. Torque-limited robots need more reduction, more motors, or a higher current limit, if the breakers can stand it. Which wheels are even driven matters here too, and that depends on the layout you chose; our guide to [FRC drivetrain types](/blog/frc-drivetrain-types) walks through how tank, swerve and mecanum differ on this point.",
            "One caution on the traction number: the coefficient of friction is not a specification anybody publishes. Community measurements put smooth and Colson wheels somewhere around 0.8-1.0 and nitrile or roughtop tread around 1.1-1.4 on FRC carpet, but that swings with tread wear, dust, and how the test was run. If grip is deciding your design, drag your actual robot across actual carpet with a luggage scale and use your own number.",
        ]),
        Section(title: "Picking a mechanism ratio", paragraphs: [
            "Arms, elevators and turrets get designed backwards from drivetrains. With a drivetrain you usually start from a target speed; with a mechanism you start from the torque you need and let speed fall out of it. For an arm, the worst case is horizontal: torque equals the weight of the arm plus whatever it is carrying, times the distance from the pivot to the combined centre of mass. Size the reduction so you can produce that at a current the motor can hold continuously, not at its stall current: a motor held near stall turns almost all of its power into heat and will fade or trip within a match.",
            "Then sanity-check the speed you got. A 100:1 reduction on a NEO gives you about 57 RPM at the output, which is roughly a second for a quarter turn: fine for an arm, hopeless for a shooter. And check back-drive: a low reduction lets gravity spin the mechanism down when the robot is disabled, while a high reduction (especially a worm or a planetary) may hold it in place on its own. Switch the calculator to Mechanism mode, enter your lever radius, and read the force at the end of the arm directly.",
        ]),
        Section(title: "Current limits are part of the ratio decision", paragraphs: [
            "Torque is proportional to current, so your smart-current limit sets a ceiling on force just as firmly as your gear ratio does. A CIM at a 40 A limit produces only about 29% of its stall torque; a Kraken X60 at the same limit produces about 10% of its. Doubling your reduction and halving your current limit can land in the same place, except one of those changes also halves your top speed and the other keeps it.",
            "Then there is the ceiling above all of that. Four drive motors at 40 A is 160 A, already beyond the 120 A main breaker, and that is before the intake or the elevator moves. The breaker is thermal, so a momentary spike while you shove someone is fine; a sustained draw is not. Meanwhile every amp pulls the bus voltage down by roughly the battery's internal resistance times the current, and at about 6.75 V the roboRIO starts shutting your outputs off. Add up the rest of the robot in the [current & brownout calculator](/tools/frc-current-budget), and if you are already browning out at events, work through [our brownout troubleshooting lesson](/guides/getting-started/common-mistakes-troubleshooting/brownouts).",
            "If any of this was new, the long-form version, with worked examples and diagrams, is in [FRC gear ratios explained](/blog/frc-gear-ratios-explained).",
        ]),
    ]

    static let faqs: [(question: String, answer: String)] = [
        (question: "How do you calculate a gear ratio for an FRC robot?",
         answer: "A single reduction is the driven gear's tooth count divided by the driving gear's: a 14-tooth pinion into a 50-tooth gear is 50 ÷ 14 = 3.571:1. When stages are stacked, multiply them: the KOP ToughBox Mini's 8.45:1 is really (50 ÷ 14) × (45 ÷ 19) = 8.459. Output speed is motor free speed divided by that number, and output torque is motor torque multiplied by it, minus efficiency losses."),
        (question: "What gear ratio should an FRC drivetrain use?",
         answer: "There is no single right answer, because the ratio only matters relative to your wheel size, motor count and current limit. Most competitive robots end up geared for roughly 12 to 17 ft/s of free speed, and the useful test is not the ratio itself but whether the calculator says you are traction-limited or torque-limited. If your wheels can already push harder than the carpet will hold, more reduction buys you nothing but a slower robot."),
        (question: "What is the difference between free speed and adjusted speed?",
         answer: "Free speed is exact kinematics: motor no-load RPM divided by the reduction, times the wheel circumference. It assumes the robot is pushing against nothing. Adjusted speed multiplies that by roughly 0.8 to 0.85 to allow for rolling resistance, gearbox drag and wheel scrub. That derate is a long-standing FRC design-calculator convention rather than a derivation, which is why this tool exposes it as an editable field instead of burying it."),
        (question: "Does gearbox efficiency slow my robot down?",
         answer: "Barely. Efficiency losses eat torque, not free speed, so a 90% efficient gearbox gives you about 90% of the pushing force but very nearly the same top speed. That is why this calculator applies efficiency to the torque and force outputs but not to free speed. A rough rule is 95% per spur-gear mesh and 97% per chain or belt run, so a two-stage gearbox is about 90% and a three-stage swerve module about 86%."),
        (question: "Why does my robot brown out when it pushes another robot?",
         answer: "Pushing puts the drive motors near stall, which is exactly where they draw the most current. Four motors at a 40 A limit is 160 A, already past the 120 A main breaker, and that current pulls the bus voltage down by roughly current times the battery's internal resistance. Once the bus reaches about 6.75 V the roboRIO starts disabling outputs. Lowering per-motor current limits is usually a better fix than a new battery."),
        (question: "What gear ratio should I use for an FRC arm?",
         answer: "Work backwards from holding torque. Estimate the torque your arm needs at its worst case: arm weight plus game piece, times the horizontal distance to its centre of mass. Then pick a reduction that produces it at a current your motor can hold without cooking. Switch this calculator to Mechanism mode and enter your lever radius to see the force at the end of the arm. Also check that the ratio is high enough not to back-drive when disabled."),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            theory
            questions
                .padding(.top, 52)
        }
    }

    private var theory: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            HStack(alignment: .top, spacing: 36) {
                VStack(alignment: .leading, spacing: 0) {
                    LearnSectionHeader(kicker: "the theory behind the numbers", title: "How FRC gear ratios actually work")
                    if !layout.isWide {
                        MarkerText("the ratio is never the question, what is limiting you is", angle: 1.2)
                            .padding(.trailing, 4)
                            .padding(.top, 14)
                    }
                    ForEach(Self.sections.indices, id: \.self) { index in
                        let section = Self.sections[index]
                        VStack(alignment: .leading, spacing: 14) {
                            if let title = section.title {
                                InkRule()
                                    .padding(.bottom, 10)
                                Text(title)
                                    .lfTitle(.h3)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            ForEach(section.paragraphs.indices, id: \.self) { paragraph in
                                ToolRichText(section.paragraphs[paragraph], size: 17, color: LF.Palette.ink)
                            }
                        }
                        .padding(.top, section.title == nil ? 22 : 36)
                    }
                }
                .learnMeasure(68)
                if layout.isWide {
                    MarkerText("the ratio is never the question, what is limiting you is", angle: 1.2)
                        .padding(.trailing, 4)
                        .frame(maxWidth: 220, alignment: .leading)
                        .padding(.top, 96)
                }
            }
            .padding(.top, 30)
        }
    }

    private var questions: some View {
        VStack(alignment: .leading, spacing: 0) {
            InkRule()
            LearnSectionHeader(kicker: "gear ratios / six questions", title: "The ones people actually ask")
                .padding(.top, 30)
            VStack(spacing: 0) {
                ForEach(Self.faqs.indices, id: \.self) { index in
                    let faq = Self.faqs[index]
                    let question = Text(faq.question)
                        .font(LF.Fonts.display(19, relativeTo: .title3))
                        .tracking(-0.4)
                        .foregroundStyle(LF.Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    let answer = Text(faq.answer)
                        .lfProse(16, lineHeight: 1.55, color: LF.Palette.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                    Group {
                        if layout.isRegular {
                            HStack(alignment: .firstTextBaseline, spacing: 32) {
                                question.frame(width: min(330, layout.contentWidth * 0.36), alignment: .leading)
                                answer.learnMeasure(62).frame(maxWidth: .infinity, alignment: .leading)
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 8) {
                                question
                                answer
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 18)
                    .overlay(alignment: .bottom) { DashedRule() }
                }
            }
            .padding(.top, 22)
        }
    }
}
