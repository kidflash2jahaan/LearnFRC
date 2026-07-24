export type GlossaryTerm = {
  term: string;
  abbr?: string;
  category: string;
  definition: string;
  /** Primary external source (official docs, vendor, etc.). */
  link?: string;
  /**
   * Optional internal LearnFRC guide/article path (e.g. "/blog/frc-can-bus").
   * When set, the term's detail page links here first as the "read more"
   * destination, keeping `link` as the secondary external source.
   */
  internalLink?: string;
};

/**
 * Deterministic, URL-safe slug for a glossary term. This is the single source
 * of truth for /glossary/{slug} URLs — the detail route, the browse links, and
 * the sitemap all derive slugs through this helper so they never drift.
 */
export function glossarySlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export const GLOSSARY_CATEGORIES = [
  "General",
  "Competition & Game",
  "Software",
  "Electrical",
  "Mechanical",
  "Sensors & Controls",
  "Awards",
  "Data & Scouting",
  "Community",
] as const;

export const GLOSSARY: GlossaryTerm[] = [
  // ---- General ----
  { term: "FIRST", abbr: "FIRST", category: "General", definition: "For Inspiration and Recognition of Science and Technology — the non-profit founded by Dean Kamen in 1989 that runs FRC and its sister programs.", link: "https://www.firstinspires.org/about" },
  { term: "FIRST Robotics Competition", abbr: "FRC", category: "General", definition: "The flagship high-school program where teams have a few weeks to design, build, and program an industrial-size robot to play that season's game.", link: "https://www.firstinspires.org/robotics/frc" },
  { term: "FIRST Tech Challenge", abbr: "FTC", category: "General", definition: "The middle/high-school FIRST program using smaller robots — a common stepping stone to FRC.", link: "https://www.firstinspires.org/robotics/ftc" },
  { term: "FIRST LEGO League", abbr: "FLL", category: "General", definition: "The entry-level FIRST program for younger students, using LEGO-based robots and research projects.", link: "https://www.firstinspires.org/robotics/fll" },
  { term: "Kickoff", category: "General", definition: "The event in early January that opens the season: the new game is revealed and the build period begins.", link: "https://www.firstinspires.org/robotics/frc/kickoff" },
  { term: "Build Season", category: "General", definition: "The intense period after Kickoff (historically ~6 weeks) when teams design and build their robot before competitions.", link: "https://docs.wpilib.org" },
  { term: "Rookie Team", category: "General", definition: "A team in its first year of FRC competition; rookies have access to special grants and awards.", link: "https://www.firstinspires.org/robotics/frc/team-resources" },
  { term: "Gracious Professionalism", abbr: "GP", category: "General", definition: "A core FIRST value: competing hard while treating everyone with respect, kindness, and integrity.", link: "https://www.firstinspires.org/about/vision-and-mission" },
  { term: "Coopertition", category: "General", definition: "A FIRST value blending cooperation and competition — helping others even while competing against them; some games reward it directly.", link: "https://www.firstinspires.org/about/vision-and-mission" },

  // ---- Competition & Game ----
  { term: "Alliance", category: "Competition & Game", definition: "A group of three teams that play together on the red or blue side of a match.", link: "https://docs.wpilib.org" },
  { term: "Autonomous", abbr: "Auto", category: "Competition & Game", definition: "The opening segment of a match where the robot operates entirely on pre-programmed code with no driver input.", link: "https://docs.wpilib.org" },
  { term: "Teleoperated", abbr: "Teleop", category: "Competition & Game", definition: "The main portion of a match where drivers control the robot from the alliance station.", link: "https://docs.wpilib.org" },
  { term: "Endgame", category: "Competition & Game", definition: "The final phase of teleop, usually with a special scoring objective such as climbing or parking.", link: "https://www.firstinspires.org/robotics/frc/game-and-season" },
  { term: "Qualification Match", abbr: "Quals", category: "Competition & Game", definition: "Randomly-scheduled matches that determine each team's seeding/ranking at an event.", link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system" },
  { term: "Playoffs", category: "Competition & Game", definition: "The elimination bracket after qualifications; FRC uses a double-elimination format among the alliance captains' picks.", link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system" },
  { term: "Ranking Points", abbr: "RP", category: "Competition & Game", definition: "Points earned from match outcomes and bonus objectives that determine a team's qualification ranking.", link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system", internalLink: "/blog/frc-ranking-points-explained" },
  { term: "Alliance Selection", category: "Competition & Game", definition: "The pre-playoff process where the top-seeded teams take turns inviting other teams to form playoff alliances.", link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system", internalLink: "/blog/frc-alliance-selection-strategy" },
  { term: "Regional", category: "Competition & Game", definition: "A stand-alone event (used outside district areas) where winning advances a team toward the FIRST Championship.", link: "https://www.firstinspires.org/team-event-search" },
  { term: "District", category: "Competition & Game", definition: "A regional model where teams earn points across multiple events to qualify for their District Championship.", link: "https://www.firstinspires.org/resource-library/frc/the-first-district-model" },
  { term: "FIRST Championship", abbr: "Champs", category: "Competition & Game", definition: "The season-ending world championship (held in Houston) for teams that qualify through events and awards.", link: "https://www.firstinspires.org/robotics/frc/championship" },
  { term: "Inspection", category: "Competition & Game", definition: "The required check that a robot meets size, weight, safety, and rules before it can compete.", link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system" },
  { term: "Bumpers", category: "Competition & Game", definition: "The mandatory padded protective bumpers around a robot's frame, colored red or blue to match the alliance.", link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system", internalLink: "/blog/frc-bumpers-guide" },

  // ---- Software ----
  { term: "WPILib", category: "Software", definition: "The official, free software library for programming FRC robots in Java, C++, or Python (RobotPy).", link: "https://docs.wpilib.org" },
  { term: "Command-Based Programming", category: "Software", definition: "WPILib's recommended structure that organizes robot code into Subsystems and Commands for clean, reusable behavior.", link: "https://docs.wpilib.org/en/stable/docs/software/commandbased/index.html" },
  { term: "Driver Station", abbr: "DS", category: "Software", definition: "The NI software (and the physical station) that connects driver inputs to the robot and reports status during matches.", link: "https://docs.wpilib.org/en/stable/docs/software/driverstation/driver-station.html" },
  { term: "PID Controller", abbr: "PID", category: "Software", definition: "A feedback control loop (Proportional-Integral-Derivative) that drives a mechanism to a target by reacting to error.", link: "https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/introduction-to-pid.html", internalLink: "/blog/pid-control-frc" },
  { term: "Feedforward", category: "Software", definition: "Control that predicts the output needed (e.g., to overcome gravity or reach a velocity) and is combined with PID for accuracy.", link: "https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/introduction-to-feedforward.html" },
  { term: "Odometry", category: "Software", definition: "Tracking the robot's position on the field over time using encoder and gyro data (often fused with vision).", link: "https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/intro-and-chassis-speeds.html" },
  { term: "PathPlanner", category: "Software", definition: "A popular tool for designing and following autonomous paths/trajectories for FRC drivetrains.", link: "https://pathplanner.dev" },
  { term: "Choreo", category: "Software", definition: "A trajectory-optimization tool that generates time-optimal autonomous paths, often paired with WPILib.", link: "https://choreo.autos" },
  { term: "RobotPy", category: "Software", definition: "The Python implementation of WPILib, letting teams program their robot in Python.", link: "https://robotpy.readthedocs.io" },

  // ---- Electrical ----
  { term: "roboRIO", category: "Electrical", definition: "The National Instruments controller that is the 'brain' of the robot, running team code and coordinating all devices.", link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html", internalLink: "/blog/frc-roborio-guide" },
  { term: "Power Distribution Hub", abbr: "PDH", category: "Electrical", definition: "REV's power distribution board that feeds and protects the robot's circuits; the successor to the CTRE PDP.", link: "https://docs.revrobotics.com/rev-11-1850", internalLink: "/blog/frc-pdh-power-distribution-hub" },
  { term: "Power Distribution Panel", abbr: "PDP", category: "Electrical", definition: "CTRE's power distribution board that splits battery power into protected branch circuits.", link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html" },
  { term: "Voltage Regulator Module", abbr: "VRM", category: "Electrical", definition: "Provides clean, regulated low-current power (e.g., 5V/12V) for sensors, the radio, and other accessories.", link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html" },
  { term: "Robot Signal Light", abbr: "RSL", category: "Electrical", definition: "The required orange light that indicates robot state (solid = enabled, blinking = disabled).", link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html" },
  { term: "CAN bus", abbr: "CAN", category: "Electrical", definition: "Controller Area Network — the wiring/protocol that lets motor controllers, sensors, and the roboRIO communicate on one daisy-chained bus.", link: "https://docs.wpilib.org/en/stable/docs/software/can-devices/can-addressing.html", internalLink: "/blog/frc-can-bus" },
  { term: "Main Breaker", category: "Electrical", definition: "The 120A circuit breaker that protects the entire robot's main power circuit between the battery and PDH/PDP.", link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html" },
  { term: "Anderson SB Connector", category: "Electrical", definition: "The standard genderless quick-connect (often SB50) used between the battery and the robot.", link: "https://www.andymark.com" },

  // ---- Mechanical ----
  { term: "Swerve Drive", category: "Mechanical", definition: "A drivetrain where each wheel module can independently steer and drive, giving full omnidirectional movement.", link: "https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/swerve-drive-kinematics.html", internalLink: "/blog/swerve-drive-explained" },
  { term: "West Coast Drive", abbr: "WCD", category: "Mechanical", definition: "A rugged tank-style drivetrain with wheels mounted on one side ('cantilevered'), popular for its simplicity and durability.", link: "https://www.chiefdelphi.com" },
  { term: "Mecanum Drive", category: "Mechanical", definition: "A drivetrain using rollered wheels that lets the robot strafe sideways without turning.", link: "https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/intro-and-chassis-speeds.html" },
  { term: "Gear Ratio", category: "Mechanical", definition: "The ratio between input and output rotation in a gearbox, trading speed for torque (or vice-versa).", link: "https://docs.wpilib.org" },
  { term: "COTS", abbr: "COTS", category: "Mechanical", definition: "Commercial Off-The-Shelf — pre-made parts teams can buy rather than fabricate, within the rules.", link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system" },
  { term: "Kit of Parts", abbr: "KOP", category: "Mechanical", definition: "The components FIRST provides to every team each season as a starting point for the robot.", link: "https://www.firstinspires.org/robotics/frc/kit-of-parts" },
  { term: "FIRST Choice", category: "Mechanical", definition: "A program giving teams credits to select specific Kit of Parts components from partner vendors.", link: "https://www.firstinspires.org/robotics/frc/kit-of-parts" },
  { term: "KitBot", category: "Mechanical", definition: "The FIRST-provided everybot/starter robot design teams can build as a reliable, competition-ready baseline.", link: "https://www.firstinspires.org/robotics/frc/kit-of-parts" },

  // ---- Sensors & Controls ----
  { term: "Encoder", category: "Sensors & Controls", definition: "A sensor that measures rotation/position of a shaft, essential for closed-loop control and odometry.", link: "https://docs.wpilib.org/en/stable/docs/hardware/sensors/encoders-hardware.html" },
  { term: "Gyroscope / IMU", abbr: "IMU", category: "Sensors & Controls", definition: "A sensor that measures the robot's heading and rotation; common units are the NavX and CTRE Pigeon 2.0.", link: "https://docs.wpilib.org/en/stable/docs/hardware/sensors/gyros-hardware.html" },
  { term: "AprilTag", category: "Sensors & Controls", definition: "A fiducial marker (like a simple QR code) placed on the field that cameras use to estimate the robot's pose.", link: "https://docs.wpilib.org/en/stable/docs/software/vision-processing/apriltag/apriltag-intro.html", internalLink: "/blog/frc-apriltags-explained" },
  { term: "Limelight", category: "Sensors & Controls", definition: "A plug-and-play smart camera widely used for FRC vision targeting and AprilTag-based localization.", link: "https://docs.limelightvision.io" },
  { term: "PhotonVision", category: "Sensors & Controls", definition: "Free, open-source vision software that runs on a coprocessor or Limelight for targeting and pose estimation.", link: "https://docs.photonvision.org" },
  { term: "NEO / NEO 550", category: "Sensors & Controls", definition: "REV Robotics brushless motors with built-in encoders, paired with SPARK MAX/Flex controllers.", link: "https://www.revrobotics.com" },
  { term: "Kraken X60", category: "Sensors & Controls", definition: "A high-performance brushless motor (with integrated Talon FX electronics) controlled over CAN via Phoenix.", link: "https://wcproducts.com" },
  { term: "Falcon 500", category: "Sensors & Controls", definition: "A brushless motor with an integrated Talon FX controller and encoder, controlled over the CAN bus.", link: "https://store.ctr-electronics.com" },
  { term: "SPARK MAX", category: "Sensors & Controls", definition: "A REV Robotics motor controller for brushed and brushless (NEO) motors, configured via REV Hardware Client.", link: "https://docs.revrobotics.com/brushless/spark-max/overview" },
  { term: "Talon FX / SRX", category: "Sensors & Controls", definition: "CTR Electronics motor controllers (Talon FX is integrated in Falcon/Kraken; SRX is a standalone CAN controller).", link: "https://store.ctr-electronics.com" },

  // ---- Awards ----
  { term: "Impact Award", category: "Awards", definition: "FRC's most prestigious award (formerly the Chairman's Award), honoring the team that best embodies FIRST's mission and impact.", link: "https://www.firstinspires.org/resource-library/frc/awards", internalLink: "/blog/how-to-win-the-impact-award" },
  { term: "Woodie Flowers Award", abbr: "WFFA", category: "Awards", definition: "Recognizes an outstanding mentor who exemplifies excellence in communication and teaching within FRC.", link: "https://www.firstinspires.org/resource-library/frc/awards" },
  { term: "Dean's List Award", category: "Awards", definition: "Honors exceptional student leaders for their contributions and leadership within their team and community.", link: "https://www.firstinspires.org/resource-library/frc/awards" },
  { term: "Rookie All-Star Award", category: "Awards", definition: "The top award for a first-year team, recognizing a strong start that embodies FIRST's values.", link: "https://www.firstinspires.org/resource-library/frc/awards" },

  // ---- Data & Scouting ----
  { term: "Scouting", category: "Data & Scouting", definition: "Systematically collecting data on robots' performance to inform strategy and alliance-selection decisions.", link: "https://www.thebluealliance.com" },
  { term: "Picklist", category: "Data & Scouting", definition: "A ranked list of teams an alliance captain uses to decide whom to invite during alliance selection.", link: "https://www.thebluealliance.com" },
  { term: "OPR", abbr: "OPR", category: "Data & Scouting", definition: "Offensive Power Rating — a calculated estimate of a team's average scoring contribution, derived from match results.", link: "https://www.thebluealliance.com", internalLink: "/blog/frc-opr-dpr-ccwm-explained" },
  { term: "EPA", abbr: "EPA", category: "Data & Scouting", definition: "Expected Points Added — Statbotics' rating model estimating a team's contribution to match score.", link: "https://www.statbotics.io", internalLink: "/blog/what-is-statbotics-frc-epa" },
  { term: "The Blue Alliance", abbr: "TBA", category: "Data & Scouting", definition: "The community database of teams, events, matches, and results — with a public API used by many scouting tools.", link: "https://www.thebluealliance.com", internalLink: "/blog/the-blue-alliance-tba-guide" },
  { term: "Statbotics", category: "Data & Scouting", definition: "An analytics site providing EPA ratings, predictions, and historical FRC data.", link: "https://www.statbotics.io", internalLink: "/blog/what-is-statbotics-frc-epa" },

  // ---- Community ----
  { term: "Chief Delphi", abbr: "CD", category: "Community", definition: "The largest FRC community forum, where teams share technical knowledge, designs, and code.", link: "https://www.chiefdelphi.com" },
  { term: "Onshape", category: "Community", definition: "A free, cloud-based CAD platform popular in FRC for collaborative robot design.", link: "https://www.onshape.com" },
  { term: "Open Alliance", category: "Community", definition: "A group of teams that publicly document their build season in real time to share knowledge with the community.", link: "https://www.theopenalliance.org" },
];
