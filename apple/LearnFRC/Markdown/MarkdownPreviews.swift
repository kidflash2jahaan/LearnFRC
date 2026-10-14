import SwiftUI

/// Extra samples for the renderer's previews. The main previews use
/// `PreviewData.markdownShowcase` (two real lessons: code, a table, a callout,
/// a numbered list) with the real glossary terms in `PreviewData.glossary`;
/// these cover the rest: nested lists, a plain quote, Python, a rule, links.
enum PreviewMarkdown {
    static let lesson = """
    ## Returning the auto command

    In the command-based template, `Robot.autonomousInit()` schedules whatever \
    `RobotContainer.getAutonomousCommand()` returns. The roboRIO runs it for the first \
    ~15 seconds of the match with **no driver input**, so a good auto combines *driving* \
    (trajectories) with mechanism actions and finishes reliably.

    ```java
    @Override
    public Command getAutonomousCommand() {
      return Commands.sequence(
          drivetrain.followPath("ToReef"),   // a trajectory
          arm.raiseToScore(),                 // mechanism action
          intake.eject().withTimeout(1.0),    // score
          drivetrain.followPath("BackToStart"));
    }
    ```

    > **Critical warning:** Never power off the robot while deploying. Interrupting a \
    deploy can corrupt the roboRIO filesystem, forcing a re-image.

    ## A sample first-year budget

    | Line item | Estimate |
    |---|---:|
    | Season registration | $6,500 |
    | One additional regional | $3,200 |
    | Control system + motors | $3,500 |
    | Tools & safety equipment | $2,000 |
    | **Total** | **~$15,200** |

    ### Reliability beats ambition

    1. **Add timeouts.** Wrap risky commands with `.withTimeout(...)` so a stuck \
    mechanism can't hang the whole auto.
    2. **Set the starting pose.** Reset odometry to the path's start pose first.
       - PathPlanner and Choreo helpers can do this for you.
       - Test the exact starting position you'll use on the field.
    3. Prefer a simple auto that always works. See [Swerve drive, explained](/blog/swerve-drive-explained) \
    or the [WPILib docs](https://docs.wpilib.org).

    > *"Describe your team's initiatives to spread STEM in your community."*

    ```python
    def ranking_score(rp: int, matches: int) -> float:
        # Rounded to two places, like the official standings
        return round(rp / matches, 2) if matches else 0.0
    ```

    ---

    A **SendableChooser** on the dashboard lets drive coaches pick the auto. Wire the PDH \
    into your CAN chain, not off to the side, so its telemetry reaches the roboRIO.
    """

    /// A short sample for checking inline details up close.
    static let details = """
    ## Deploying to the roboRIO

    With the roboRIO powered and connected, use **"Deploy Robot Code."** The RioLog shows \
    `System.out` output, which is *your first-line debugging tool*. Install vendor libraries \
    from [WPILib's docs](https://docs.wpilib.org) or read [the CAN bus guide](/blog/frc-can-bus).

    ```bash
    ./gradlew deploy   # build, copy, restart
    ```

    | Indicator | Means |
    |---|---|
    | Communications | The DS reaches the robot |
    | Robot Code | Your program is running |

    > **Wiring tip:** Keep the Ethernet run to the radio short and strain-relieved.
    """
}

private struct MarkdownPreviewPage: View {
    var markdown = PreviewData.markdownShowcase
    var padding: CGFloat = 24

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                LessonMarkdownView(markdown: markdown, glossary: PreviewData.glossary) { _ in }
            }
            .padding(.horizontal, LF.Metrics.gutter)
            .padding(.vertical, padding)
            .frame(maxWidth: .infinity)
        }
        .paperBackground()
    }
}

#Preview("Inline details, iPhone", traits: .fixedLayout(width: 393, height: 720)) {
    MarkdownPreviewPage(markdown: PreviewMarkdown.details, padding: 12)
}

#Preview("Lesson, iPhone", traits: .fixedLayout(width: 393, height: 2400)) {
    MarkdownPreviewPage()
}

#Preview("Lesson, iPhone, dark", traits: .fixedLayout(width: 393, height: 2400)) {
    MarkdownPreviewPage()
        .preferredColorScheme(.dark)
}

#Preview("Lesson, iPad", traits: .fixedLayout(width: 820, height: 1800)) {
    MarkdownPreviewPage()
}

#Preview("Lesson, iPad, dark", traits: .fixedLayout(width: 820, height: 1800)) {
    MarkdownPreviewPage()
        .preferredColorScheme(.dark)
}

#Preview("Every block, iPhone", traits: .fixedLayout(width: 393, height: 2150)) {
    MarkdownPreviewPage(markdown: PreviewMarkdown.lesson)
}

#Preview("Every block, iPad, dark", traits: .fixedLayout(width: 820, height: 1800)) {
    MarkdownPreviewPage(markdown: PreviewMarkdown.lesson)
        .preferredColorScheme(.dark)
}

#Preview("Large type, iPhone", traits: .fixedLayout(width: 393, height: 2600)) {
    MarkdownPreviewPage(markdown: PreviewMarkdown.lesson)
        .dynamicTypeSize(.xxxLarge)
}
