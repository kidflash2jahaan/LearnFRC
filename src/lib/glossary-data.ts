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
  /**
   * "Where you'll actually meet this" — a hand-written 40–80 word paragraph
   * describing the concrete situation an FRC student encounters the term in:
   * a moment in a match, a failure in the pit, a decision during build season.
   *
   * This is the field that makes a term page worth landing on. It is written
   * per-term by a human and is NEVER templated or generated — a term with
   * nothing genuinely useful to say here simply omits it, and the page falls
   * back to the definition + sources (and is excluded from indexing; see
   * `hasGlossaryDepth`).
   */
  inMatch?: string;
  /**
   * Other real names people use for this thing in FRC conversation (forum
   * posts, the manual, vendor docs). Only genuine alternates — these feed the
   * DefinedTerm `alternateName` and help a reader confirm they're in the right
   * place. Not a keyword list.
   */
  alsoCalled?: string[];
  /**
   * High-signal phrases used at build time to find LearnFRC lessons that
   * genuinely cover this term. Matching is deliberately conservative (see
   * `matchLessons` in the term page): a phrase must appear in a lesson title,
   * or repeatedly in its summary, to count. Omit to disable lesson matching
   * for a term rather than risk a wrong link.
   */
  lessonCues?: string[];
  /**
   * Curated related terms, by exact `term`. These seed the "related terms"
   * list on the detail page — the existing keyword/category heuristic then
   * fills any remaining slots. Curation exists because the heuristic is good
   * within a category and poor across them, and the cross-category hops
   * (Swerve Drive → Odometry, CAN bus → Talon FX) are the useful ones.
   */
  related?: string[];
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

/**
 * Minimum words of hand-written `inMatch` copy before a term page is
 * considered substantive enough to deserve a slot in the index.
 */
export const MIN_INMATCH_WORDS = 35;

/**
 * Does this term have enough hand-written depth to be worth indexing?
 *
 * A glossary page whose only content is a one-line definition is a thin page,
 * and thin pages at scale drag down the whole domain. Terms that fail this
 * check still render (they're useful to a reader who arrives from the browse
 * grid) but are served `noindex, follow` so crawlers spend their budget on the
 * pages that actually answer something. Data-only, so the sitemap can use the
 * same predicate without touching the database.
 */
export function hasGlossaryDepth(t: GlossaryTerm): boolean {
  const words = (t.inMatch ?? "").trim().split(/\s+/).filter(Boolean).length;
  return words >= MIN_INMATCH_WORDS;
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
  {
    term: "FIRST",
    abbr: "FIRST",
    category: "General",
    definition:
      "For Inspiration and Recognition of Science and Technology — the non-profit founded by Dean Kamen in 1989 that runs FRC and its sister programs.",
    link: "https://www.firstinspires.org/about",
    inMatch:
      "You meet FIRST long before you meet a robot: it is the organisation your team registers under, whose Core Values judges ask about in the pit, and whose logo is on the field wall. Every rule dispute, every award criterion, and every deadline in your season traces back to a FIRST document — not to your school and not to your sponsor.",
    lessonCues: ["FIRST core values", "FIRST progression", "what FIRST and FRC are"],
    related: ["Gracious Professionalism", "Coopertition", "FIRST Championship"],
  },
  {
    term: "FIRST Robotics Competition",
    abbr: "FRC",
    category: "General",
    definition:
      "The flagship high-school program where teams have a few weeks to design, build, and program an industrial-size robot to play that season's game.",
    link: "https://www.firstinspires.org/robotics/frc",
    inMatch:
      "FRC is the specific program you are in: a six-to-eight week build, then two-and-a-half minute matches played three robots per side. The distinction matters at events, where FTC and FLL rules do not apply, and on paperwork, where your FRC team number is the identity judges, sponsors, and The Blue Alliance all use to look you up.",
    lessonCues: ["FRC team", "what an FRC team", "FIRST progression"],
    related: ["Kickoff", "Build Season", "Kit of Parts"],
  },
  {
    term: "FIRST Tech Challenge",
    abbr: "FTC",
    category: "General",
    definition:
      "The middle/high-school FIRST program using smaller robots — a common stepping stone to FRC.",
    link: "https://www.firstinspires.org/robotics/ftc",
    inMatch:
      "Most FRC rookies arrive from FTC, and the habits transfer unevenly. Java structure, driver practice, and scouting discipline carry straight over; sizing, wiring, and safety instincts do not — FRC's 125-pound machines and 120-amp electrical system punish FTC-scale assumptions. Knowing which of your reflexes are FTC-specific saves a rookie season of relearning things the hard way.",
    lessonCues: ["FTC", "FIRST Tech Challenge"],
    related: ["FIRST LEGO League", "FIRST Robotics Competition", "Rookie Team"],
  },
  {
    term: "FIRST LEGO League",
    abbr: "FLL",
    category: "General",
    definition:
      "The entry-level FIRST program for younger students, using LEGO-based robots and research projects.",
    link: "https://www.firstinspires.org/robotics/fll",
    inMatch:
      "You are most likely to meet FLL from the other side of the table: FRC teams mentor FLL teams and host their events, and that work is exactly the sustained, documentable outreach Impact Award judges ask for. If you came up through FLL yourself, the research-project habit — define a problem, interview experts, present it — is the same muscle a judge panel tests.",
    lessonCues: ["FLL", "FIRST LEGO League"],
    related: ["FIRST Tech Challenge", "Impact Award"],
  },
  {
    term: "Kickoff",
    category: "General",
    definition:
      "The event in early January that opens the season: the new game is revealed and the build period begins.",
    link: "https://www.firstinspires.org/robotics/frc/kickoff",
    inMatch:
      "Kickoff is the most consequential Saturday of your season. The game animation drops and within hours your team has to read the manual, argue about scoring priorities, and decide what the robot must do. Teams that lose their season usually lose it here — by opening CAD before anyone has read the rules, or by chasing every scoring element instead of picking two.",
    alsoCalled: ["Kickoff Saturday", "Game reveal"],
    lessonCues: ["kickoff", "game reveal", "annual season"],
    related: ["Build Season", "Kit of Parts", "FIRST Choice"],
  },
  {
    term: "Build Season",
    category: "General",
    definition:
      "The intense period after Kickoff (historically ~6 weeks) when teams design and build their robot before competitions.",
    link: "https://docs.wpilib.org",
    inMatch:
      "Build season is where a schedule either exists or it doesn't. Six weeks sounds long until you subtract exams, snow days, and the fortnight a first article actually takes to fabricate. Teams that arrive with a working robot are the ones that froze the design in week two and spent weeks five and six driving it — not the ones still machining on the last night.",
    alsoCalled: ["Build period"],
    lessonCues: ["build season", "season timeline", "build schedule"],
    related: ["Kickoff", "KitBot", "Inspection"],
  },
  {
    term: "Rookie Team",
    category: "General",
    definition:
      "A team in its first year of FRC competition; rookies have access to special grants and awards.",
    link: "https://www.firstinspires.org/robotics/frc/team-resources",
    inMatch:
      "Rookie status is a real, time-limited asset. Your first year carries the Rookie All-Star and Highest Rookie Seed awards, rookie grants, and veteran teams who will genuinely stop what they are doing to help you in the pit. It also means nobody expects you to win — so spend the year on a drivetrain that survives every match and a team that comes back next season.",
    lessonCues: ["rookie", "new team", "registration"],
    related: ["Rookie All-Star Award", "Kit of Parts", "KitBot"],
  },
  {
    term: "Gracious Professionalism",
    abbr: "GP",
    category: "General",
    definition:
      "A core FIRST value: competing hard while treating everyone with respect, kindness, and integrity.",
    link: "https://www.firstinspires.org/about/vision-and-mission",
    inMatch:
      "GP is not a poster. It is what happens at four o'clock on Saturday when the alliance that just knocked you out asks to borrow your spare motor controller and you hand it over. Judges watch for it in the pit, referees notice it at the field, and it is the difference between a team other teams want to pick and one they quietly avoid.",
    lessonCues: ["gracious professionalism", "core values"],
    related: ["Coopertition", "Impact Award", "Woodie Flowers Award"],
  },
  {
    term: "Coopertition",
    category: "General",
    definition:
      "A FIRST value blending cooperation and competition — helping others even while competing against them; some games reward it directly.",
    link: "https://www.firstinspires.org/about/vision-and-mission",
    inMatch:
      "Coopertition shows up concretely: helping a rookie wire their PDH the morning of quals, sharing scouting data with an alliance partner, lending a battery to the team you play next. Several games have also made it literal, awarding a ranking point only when both alliances cooperate on a shared objective — so the value is sometimes worth real points in the standings.",
    lessonCues: ["coopertition", "core values"],
    related: ["Gracious Professionalism", "Ranking Points", "Alliance"],
  },

  // ---- Competition & Game ----
  {
    term: "Alliance",
    category: "Competition & Game",
    definition:
      "A group of three teams that play together on the red or blue side of a match.",
    link: "https://docs.wpilib.org",
    inMatch:
      "Three robots, one score — which means two-thirds of your match outcome is decided by people you met ten minutes ago. In practice that becomes a pre-match huddle in the queue line: who takes which scoring location, who plays defence, who has the fastest climb. Teams that skip that conversation lose matches their robot was easily fast enough to win.",
    alsoCalled: ["Red alliance", "Blue alliance"],
    lessonCues: ["alliances", "alliance station", "alliance partner"],
    related: ["Alliance Selection", "Ranking Points", "Scouting"],
  },
  {
    term: "Autonomous",
    abbr: "Auto",
    category: "Competition & Game",
    definition:
      "The opening segment of a match where the robot operates entirely on pre-programmed code with no driver input.",
    link: "https://docs.wpilib.org",
    inMatch:
      "Auto is the fifteen seconds where your code is the driver, and it is the most fragile part of the match: a gyro that drifted while the robot sat on the cart, a path tuned on carpet with different friction, a partner parked exactly where you planned to drive. A reliable auto that scores one game piece beats an ambitious one that works half the time.",
    alsoCalled: ["Auton", "Autonomous period"],
    lessonCues: ["autonomous", "auto routine"],
    related: ["PathPlanner", "Odometry", "AprilTag"],
  },
  {
    term: "Teleoperated",
    abbr: "Teleop",
    category: "Competition & Game",
    definition:
      "The main portion of a match where drivers control the robot from the alliance station.",
    link: "https://docs.wpilib.org",
    inMatch:
      "Teleop is where practice shows. The robot that wins is rarely the fastest on paper; it is the one whose driver has run the cycle a hundred times and knows the intake's sweet spot by feel. It is also where your controller mapping, driver station connection, and brownout behaviour all get tested in public for the first time.",
    alsoCalled: ["Tele-op", "Driver control period"],
    lessonCues: ["teleop", "teleoperated", "driver control"],
    related: ["Driver Station", "Endgame", "Autonomous"],
  },
  {
    term: "Endgame",
    category: "Competition & Game",
    definition:
      "The final phase of teleop, usually with a special scoring objective such as climbing or parking.",
    link: "https://www.firstinspires.org/robotics/frc/game-and-season",
    inMatch:
      "Endgame is a scheduling problem as much as an engineering one. Climbs take longer than teams estimate, and a partner who starts theirs late can physically block yours. Good drive teams call endgame off the match clock rather than off a feeling, and they practise the abort case — a failed climb that leaves you dangling costs more than simply parking would have.",
    lessonCues: ["endgame", "climb", "climber"],
    related: ["Teleoperated", "Ranking Points", "Gear Ratio"],
  },
  {
    term: "Qualification Match",
    abbr: "Quals",
    category: "Competition & Game",
    definition:
      "Randomly-scheduled matches that determine each team's seeding/ranking at an event.",
    link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
    inMatch:
      "Quals are randomly scheduled, so you play with and against teams of every skill level and your ranking measures how well you play with strangers. That is the practical case for ranking-point strategy: since your partners are assigned, the things you control — your own consistency and the bonus objectives — matter far more to your seed than raw scoring does.",
    alsoCalled: ["Qual match", "Quals"],
    lessonCues: ["qualification", "seeding", "rankings"],
    related: ["Ranking Points", "Playoffs", "Scouting"],
  },
  {
    term: "Playoffs",
    category: "Competition & Game",
    definition:
      "The elimination bracket after qualifications; FRC uses a double-elimination format among the alliance captains' picks.",
    link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
    inMatch:
      "Playoffs change the calculus completely: you now know your partners, you can plan around each other between matches, and defence becomes far more common than it was in quals. The double-elimination bracket also means one bad match is survivable — so alliances tend to hold their riskiest strategy back until they are in the lower bracket with nothing left to lose.",
    alsoCalled: ["Eliminations", "Elims"],
    lessonCues: ["playoff", "playoffs", "double elimination"],
    related: ["Alliance Selection", "Qualification Match", "Picklist"],
  },
  {
    term: "Ranking Points",
    abbr: "RP",
    category: "Competition & Game",
    definition:
      "Points earned from match outcomes and bonus objectives that determine a team's qualification ranking.",
    link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
    internalLink: "/blog/frc-ranking-points-explained",
    inMatch:
      "RP is why a team can lose a match and still climb the standings. Each game defines bonus RPs — a cooperative objective, a scoring threshold, a successful endgame — and drive teams call those targets out loud mid-match. If you only track win-loss, your scouting will consistently misjudge which teams are actually seeded to become alliance captains.",
    lessonCues: ["ranking point", "ranking points"],
    related: ["Qualification Match", "Alliance Selection", "Scouting"],
  },
  {
    term: "Alliance Selection",
    category: "Competition & Game",
    definition:
      "The pre-playoff process where the top-seeded teams take turns inviting other teams to form playoff alliances.",
    link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
    internalLink: "/blog/frc-alliance-selection-strategy",
    inMatch:
      "Alliance selection happens on the field, on camera, in a few minutes — but the decision was made the night before over scouting data. If you are picking, you need a picklist you trust and a first pick who complements you rather than duplicates you. If you are hoping to be picked, a reputation for showing up working every single match beats a high peak score.",
    alsoCalled: ["Alliance draft", "Selection ceremony"],
    lessonCues: ["alliance selection", "picklist", "pick list"],
    related: ["Picklist", "Scouting", "OPR"],
  },
  {
    term: "Regional",
    category: "Competition & Game",
    definition:
      "A stand-alone event (used outside district areas) where winning advances a team toward the FIRST Championship.",
    link: "https://www.firstinspires.org/team-event-search",
    inMatch:
      "At a Regional, one weekend decides your season: win the event, win a qualifying award, or go home. That compresses everything. You get roughly ten qualification matches to prove reliability and there is no second event to bank points at, so teams outside district areas plan their spare parts, battery count, and pit repair capacity around that single-shot reality.",
    lessonCues: ["regional", "advancement"],
    related: ["District", "FIRST Championship", "Qualification Match"],
  },
  {
    term: "District",
    category: "Competition & Game",
    definition:
      "A regional model where teams earn points across multiple events to qualify for their District Championship.",
    link: "https://www.firstinspires.org/resource-library/frc/the-first-district-model",
    inMatch:
      "The district model spreads the risk: you play two events, earn points for qualification finish, playoff result, and awards, and the sum decides whether you advance to your District Championship. Practically, that makes event one a legitimate place to learn — a rough first weekend is recoverable, and plenty of teams deliberately treat it as a debugging event.",
    alsoCalled: ["District event", "District points"],
    lessonCues: ["district", "district points"],
    related: ["Regional", "FIRST Championship", "Ranking Points"],
  },
  {
    term: "FIRST Championship",
    abbr: "Champs",
    category: "Competition & Game",
    definition:
      "The season-ending world championship (held in Houston) for teams that qualify through events and awards.",
    link: "https://www.firstinspires.org/robotics/frc/championship",
    inMatch:
      "Championship is the same game at a different level: every robot in your division already won something. The real differences are logistical — getting the robot there, a much larger pit to navigate, fields running on a tighter schedule — plus the fact that a season of regional scouting data is largely useless against teams you have never seen play.",
    alsoCalled: ["Champs", "World Championship", "Einstein"],
    lessonCues: ["championship", "hall of fame"],
    related: ["District", "Regional", "Impact Award"],
  },
  {
    term: "Inspection",
    category: "Competition & Game",
    definition:
      "The required check that a robot meets size, weight, safety, and rules before it can compete.",
    link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
    inMatch:
      "Inspection is the gate between your robot and the field, and teams fail it for boring reasons: over weight with the bumpers off, outside the frame perimeter, a missing or dead Robot Signal Light, unprotected wiring. Inspectors are helpful rather than adversarial — but every hour you spend fixing something in the pit is an hour you are not practising with drivers.",
    alsoCalled: ["Robot inspection", "Weigh-in"],
    lessonCues: ["inspection", "inspections", "inspector"],
    related: ["Bumpers", "Robot Signal Light", "Main Breaker"],
  },
  {
    term: "Bumpers",
    category: "Competition & Game",
    definition:
      "The mandatory padded protective bumpers around a robot's frame, colored red or blue to match the alliance.",
    link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
    internalLink: "/blog/frc-bumpers-guide",
    inMatch:
      "Bumpers are a rules artifact that becomes a mechanical problem: they must wrap the frame perimeter, sit inside a specific height zone, follow the prescribed pool-noodle-and-plywood construction, and swap between red and blue in the few minutes between matches. Every team that has stood in the queue line re-hooking a bumper latch learns to design the mount before the robot.",
    lessonCues: ["bumper", "bumpers"],
    related: ["Inspection", "Alliance", "West Coast Drive"],
  },

  // ---- Software ----
  {
    term: "WPILib",
    category: "Software",
    definition:
      "The official, free software library for programming FRC robots in Java, C++, or Python (RobotPy).",
    link: "https://docs.wpilib.org",
    inMatch:
      "WPILib is the layer between your code and everything else — motor controllers, the driver station, the field management system, and the timing of your robot's periodic loop. In practice you meet it through its opinions: the command-based structure, the units library, the simulator, and the yearly version bump you do in the first week of build season.",
    lessonCues: ["WPILib", "wpilib"],
    related: ["Command-Based Programming", "RobotPy", "Driver Station"],
  },
  {
    term: "Command-Based Programming",
    category: "Software",
    definition:
      "WPILib's recommended structure that organizes robot code into Subsystems and Commands for clean, reusable behavior.",
    link: "https://docs.wpilib.org/en/stable/docs/software/commandbased/index.html",
    inMatch:
      "Command-based is what stops robot code turning into one enormous if-statement. Subsystems own hardware, commands own behaviour, and the scheduler guarantees two commands never fight over the same motor. The payoff shows up in autonomous, where you compose the same commands into a sequence, and in debugging, where you can point at exactly which command is misbehaving.",
    alsoCalled: ["Command-based", "Commands and subsystems"],
    lessonCues: ["command-based", "command based", "subsystem", "subsystems"],
    related: ["WPILib", "PID Controller", "Autonomous"],
  },
  {
    term: "Driver Station",
    abbr: "DS",
    category: "Software",
    definition:
      "The NI software (and the physical station) that connects driver inputs to the robot and reports status during matches.",
    link: "https://docs.wpilib.org/en/stable/docs/software/driverstation/driver-station.html",
    inMatch:
      "The Driver Station is the laptop that decides whether you play. It shows battery voltage, CAN utilisation, and the reason the robot just disabled — and its logs are the single best debugging artifact after a bad match. Drive teams learn to read it live: a voltage sag mid-cycle or a climbing loop-overrun count is something you can act on before the next match.",
    alsoCalled: ["FRC Driver Station", "DS software"],
    lessonCues: ["driver station", "FMS"],
    related: ["roboRIO", "CAN bus", "Teleoperated"],
  },
  {
    term: "PID Controller",
    abbr: "PID",
    category: "Software",
    definition:
      "A feedback control loop (Proportional-Integral-Derivative) that drives a mechanism to a target by reacting to error.",
    link: "https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/introduction-to-pid.html",
    internalLink: "/blog/pid-control-frc",
    inMatch:
      "PID is how an arm holds a position instead of slamming into a hard stop. You meet it the first time a mechanism overshoots, oscillates, or sags under gravity — and then you meet the tuning process, which is a methodical loop of raising kP until it oscillates, adding kD to damp that out, and using kI sparingly, if at all.",
    alsoCalled: ["Closed-loop control", "PID loop"],
    lessonCues: ["PID", "closed-loop", "closed loop"],
    related: ["Feedforward", "Encoder", "Command-Based Programming"],
  },
  {
    term: "Feedforward",
    category: "Software",
    definition:
      "Control that predicts the output needed (e.g., to overcome gravity or reach a velocity) and is combined with PID for accuracy.",
    link: "https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/introduction-to-feedforward.html",
    inMatch:
      "Feedforward is why a good shooter recovers to speed between shots instead of dipping. PID reacts to error; feedforward predicts the voltage the mechanism needs — kS to break friction, kV for velocity, kG to hold an arm against gravity. Once you characterise those constants, PID only has to clean up the remainder, and tuning becomes far less painful.",
    alsoCalled: ["Feed-forward", "kS / kV / kA / kG"],
    lessonCues: ["feedforward", "motion profiling", "characterization"],
    related: ["PID Controller", "Encoder", "Gear Ratio"],
  },
  {
    term: "Odometry",
    category: "Software",
    definition:
      "Tracking the robot's position on the field over time using encoder and gyro data (often fused with vision).",
    link: "https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/intro-and-chassis-speeds.html",
    inMatch:
      "Odometry lets an autonomous routine say “drive to the scoring position” instead of “drive forward for 2.1 seconds”. Wheel encoders and a gyro integrate into a field position — and that position drifts, especially after a collision or a wheel slip. The drift is exactly why teams fuse AprilTag measurements into a pose estimator rather than trusting encoders alone.",
    alsoCalled: ["Pose estimation", "Dead reckoning"],
    lessonCues: ["odometry", "pose estimation", "kinematics"],
    related: ["Encoder", "Gyroscope / IMU", "AprilTag"],
  },
  {
    term: "PathPlanner",
    category: "Software",
    definition:
      "A popular tool for designing and following autonomous paths/trajectories for FRC drivetrains.",
    link: "https://pathplanner.dev",
    inMatch:
      "PathPlanner is where most teams draw their autonomous. You place waypoints on a field image, attach commands to markers along the path, and the tool hands your drivetrain a trajectory to follow. The hard part is never the drawing — a path only works if your odometry, your feedforward constants, and your starting pose are all honest.",
    lessonCues: ["PathPlanner", "trajectories", "trajectory"],
    related: ["Choreo", "Odometry", "Autonomous"],
  },
  {
    term: "Choreo",
    category: "Software",
    definition:
      "A trajectory-optimization tool that generates time-optimal autonomous paths, often paired with WPILib.",
    link: "https://choreo.autos",
    inMatch:
      "Choreo solves for the fastest path your drivetrain can physically drive given its real mass and motor limits, rather than the smoothest one you could draw by hand. Teams reach for it when auto is the difference between winning and losing and a hand-tuned path is leaving tenths on the table — and it demands the same honest odometry work PathPlanner does.",
    lessonCues: ["Choreo", "trajectories"],
    related: ["PathPlanner", "Odometry", "Autonomous"],
  },
  {
    term: "RobotPy",
    category: "Software",
    definition:
      "The Python implementation of WPILib, letting teams program their robot in Python.",
    link: "https://robotpy.readthedocs.io",
    inMatch:
      "RobotPy is a genuine option, not a toy — the same WPILib APIs, in Python. The trade-off is practical: faster to write and read for a team whose students already know Python, but a smaller pool of FRC example code and fewer people at your event who can help you debug it at 9am on Saturday. Choose deliberately in week one, then commit.",
    lessonCues: ["RobotPy", "choosing a language"],
    related: ["WPILib", "Command-Based Programming"],
  },

  // ---- Electrical ----
  {
    term: "roboRIO",
    category: "Electrical",
    definition:
      "The National Instruments controller that is the 'brain' of the robot, running team code and coordinating all devices.",
    link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html",
    internalLink: "/blog/frc-roborio-guide",
    inMatch:
      "Everything on the robot ends at the roboRIO. It runs your code on a real-time loop, talks to motor controllers over CAN, reads sensors on its DIO and analog ports, and reports back to the driver station. When it browns out under a 12-volt sag, or your code overruns its 20-millisecond loop, the whole robot stops — so voltage and loop timing are the first two things to check.",
    alsoCalled: ["roboRIO 2.0", "The robot's brain"],
    lessonCues: ["roboRIO", "robo rio"],
    related: ["CAN bus", "Driver Station", "Power Distribution Hub"],
  },
  {
    term: "Power Distribution Hub",
    abbr: "PDH",
    category: "Electrical",
    definition:
      "REV's power distribution board that feeds and protects the robot's circuits; the successor to the CTRE PDP.",
    link: "https://docs.revrobotics.com/rev-11-1850",
    internalLink: "/blog/frc-pdh-power-distribution-hub",
    inMatch:
      "The PDH is where every wire on the robot comes from. You meet it while wiring — matching breaker sizes to wire gauge, keeping high-current mechanisms on the 40-amp channels — and again at competition, where its per-channel current logging tells you which mechanism actually caused the brownout. Its switchable channel is also the usual home for the radio power module.",
    alsoCalled: ["REV PDH"],
    lessonCues: ["PDH", "power distribution"],
    related: ["Power Distribution Panel", "Main Breaker", "roboRIO"],
  },
  {
    term: "Power Distribution Panel",
    abbr: "PDP",
    category: "Electrical",
    definition:
      "CTRE's power distribution board that splits battery power into protected branch circuits.",
    link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html",
    inMatch:
      "Plenty of robots still run a PDP, and it does the PDH's job with a different footprint, different breaker positions, and telemetry through CTRE's tooling instead of REV's. It matters the moment you inherit an older robot or work a mixed pit: the wiring diagram, the fuse that feeds the VRM, and the current-logging workflow are all slightly different from the PDH.",
    alsoCalled: ["CTRE PDP"],
    lessonCues: ["PDP", "power distribution"],
    related: ["Power Distribution Hub", "Main Breaker", "Voltage Regulator Module"],
  },
  {
    term: "Voltage Regulator Module",
    abbr: "VRM",
    category: "Electrical",
    definition:
      "Provides clean, regulated low-current power (e.g., 5V/12V) for sensors, the radio, and other accessories.",
    link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html",
    inMatch:
      "The VRM is the small board nobody thinks about until the radio reboots mid-match. It converts the robot's sagging 12 volts into clean 5V and 12V rails for the radio, sensors, and cameras — and it has per-port current limits that teams quietly exceed by hanging LED strips off it. Give the radio its own dedicated pair and leave it alone.",
    lessonCues: ["VRM", "voltage regulator"],
    related: ["Power Distribution Hub", "roboRIO", "Robot Signal Light"],
  },
  {
    term: "Robot Signal Light",
    abbr: "RSL",
    category: "Electrical",
    definition:
      "The required orange light that indicates robot state (solid = enabled, blinking = disabled).",
    link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html",
    inMatch:
      "The RSL is a legally required part and also the fastest diagnostic on the robot: solid means enabled, blinking means disabled, dark means you have a wiring or power problem worth finding now. Inspectors check it, referees look for it from the field wall, and a dead RSL keeps you off the field no matter how well the rest of the robot works.",
    lessonCues: ["RSL", "robot signal light", "FRC control system"],
    related: ["Inspection", "Power Distribution Hub", "roboRIO"],
  },
  {
    term: "CAN bus",
    abbr: "CAN",
    category: "Electrical",
    definition:
      "Controller Area Network — the wiring/protocol that lets motor controllers, sensors, and the roboRIO communicate on one daisy-chained bus.",
    link: "https://docs.wpilib.org/en/stable/docs/software/can-devices/can-addressing.html",
    internalLink: "/blog/frc-can-bus",
    inMatch:
      "CAN is one daisy chain, and one bad crimp anywhere on it takes out everything downstream. You meet it when the driver station starts logging missing devices, when two motor controllers were flashed with the same ID, or when the terminating resistors at the ends went missing. Most “the robot randomly died” stories turn out, on inspection, to be CAN stories.",
    alsoCalled: ["Controller Area Network", "CAN network"],
    lessonCues: ["CAN bus", "CAN"],
    related: ["roboRIO", "Talon FX / SRX", "SPARK MAX"],
  },
  {
    term: "Main Breaker",
    category: "Electrical",
    definition:
      "The 120A circuit breaker that protects the entire robot's main power circuit between the battery and PDH/PDP.",
    link: "https://docs.wpilib.org/en/stable/docs/controls-overviews/control-system-hardware.html",
    inMatch:
      "The main breaker is the robot's on switch and its last line of defence. It trips when the whole robot draws too much — usually a stalled drivetrain shoving against a wall — and once it has tripped repeatedly it starts tripping earlier and earlier. Keep a spare in the pit, because a tired main breaker looks exactly like a bad battery.",
    alsoCalled: ["120A breaker", "Main circuit breaker"],
    lessonCues: ["main breaker", "120A breaker", "breakers"],
    related: ["Anderson SB Connector", "Power Distribution Hub", "Inspection"],
  },
  {
    term: "Anderson SB Connector",
    category: "Electrical",
    definition:
      "The standard genderless quick-connect (often SB50) used between the battery and the robot.",
    link: "https://www.andymark.com",
    inMatch:
      "You handle Anderson connectors more than any other part on the robot — every battery swap between matches goes through one. They wear out, and a loose or corroded SB50 produces exactly the symptom teams misdiagnose as a dead battery: voltage that collapses under load. Proper crimps and a habit of inspecting the contacts kill a whole category of mystery brownouts.",
    alsoCalled: ["SB50", "Battery connector"],
    lessonCues: ["Anderson", "Anderson connectors", "crimping"],
    related: ["Main Breaker", "Power Distribution Hub"],
  },

  // ---- Mechanical ----
  {
    term: "Swerve Drive",
    category: "Mechanical",
    definition:
      "A drivetrain where each wheel module can independently steer and drive, giving full omnidirectional movement.",
    link: "https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/swerve-drive-kinematics.html",
    internalLink: "/blog/swerve-drive-explained",
    inMatch:
      "Swerve is the default now, and it changes what your drivers practise: translation and rotation are independent, so approaching a scoring location no longer means lining up first. The cost is real — four steering motors, four absolute encoders, module offsets that must be re-zeroed, and a maintenance schedule. A well-driven tank robot still beats a poorly maintained swerve.",
    alsoCalled: ["Swerve", "Independent module drive"],
    lessonCues: ["swerve", "swerve drive", "swerve module"],
    related: ["Odometry", "Gear Ratio", "Kraken X60"],
  },
  {
    term: "West Coast Drive",
    abbr: "WCD",
    category: "Mechanical",
    definition:
      "A rugged tank-style drivetrain with wheels mounted on one side ('cantilevered'), popular for its simplicity and durability.",
    link: "https://www.chiefdelphi.com",
    inMatch:
      "WCD is the drivetrain you can fix in the pit with a wrench. Cantilevered wheels mean you can swap one without dismantling the frame, the chain runs protected inside the rail, and there is nothing to re-zero before a match. Teams still choose it deliberately when reliability and a short build timeline matter more than the ability to strafe.",
    alsoCalled: ["Tank drive", "Cantilevered drive"],
    lessonCues: ["West Coast Drive", "WCD", "tank drive"],
    related: ["Swerve Drive", "Gear Ratio", "COTS"],
  },
  {
    term: "Mecanum Drive",
    category: "Mechanical",
    definition:
      "A drivetrain using rollered wheels that lets the robot strafe sideways without turning.",
    link: "https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/intro-and-chassis-speeds.html",
    inMatch:
      "Mecanum buys you sideways motion without swerve's complexity, which genuinely helps a rookie team that wants strafing on a budget. The trade-offs show up in a match: the rollers give up traction, so you lose most pushing contests and defence against you is easy. Field carpet condition and stray debris also affect it more than any other drivetrain.",
    alsoCalled: ["Mecanum"],
    lessonCues: ["mecanum", "omnidirectional"],
    related: ["Swerve Drive", "West Coast Drive", "Encoder"],
  },
  {
    term: "Gear Ratio",
    category: "Mechanical",
    definition:
      "The ratio between input and output rotation in a gearbox, trading speed for torque (or vice-versa).",
    link: "https://docs.wpilib.org",
    inMatch:
      "Gear ratio is the number you get wrong once and remember forever. Too fast and your drivetrain browns out and trips breakers pushing against a defender; too slow and your cycles crawl while everyone else scores. The same arithmetic decides whether an arm can hold its own weight and whether a shooter recovers between shots — which is why you run it before cutting metal.",
    alsoCalled: ["Gearing", "Reduction"],
    lessonCues: ["gear ratio", "gear ratios", "gearbox"],
    related: ["Swerve Drive", "Feedforward", "COTS"],
  },
  {
    term: "COTS",
    abbr: "COTS",
    category: "Mechanical",
    definition:
      "Commercial Off-The-Shelf — pre-made parts teams can buy rather than fabricate, within the rules.",
    link: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
    inMatch:
      "COTS is a rules category before it is a shopping decision — the manual defines what counts as commercially available and what you may modify. In practice it is how a small team fields a competitive robot: a bought swerve module or gearbox is one fewer thing to machine, and one fewer thing to debug at midnight the week before an event.",
    alsoCalled: ["Commercial off-the-shelf"],
    lessonCues: ["COTS", "off-the-shelf"],
    related: ["Kit of Parts", "Swerve Drive", "Inspection"],
  },
  {
    term: "Kit of Parts",
    abbr: "KOP",
    category: "Mechanical",
    definition:
      "The components FIRST provides to every team each season as a starting point for the robot.",
    link: "https://www.firstinspires.org/robotics/frc/kit-of-parts",
    inMatch:
      "The KOP is the box that arrives around Kickoff, and for a rookie team it is most of a robot: a drivetrain, control system components, motors, and vouchers. The practical skill is knowing what is in it before you buy anything — teams routinely order parts they were already sent, then discover the KOP chassis in a corner a week before their event.",
    lessonCues: ["Kit of Parts", "KOP"],
    related: ["FIRST Choice", "KitBot", "Rookie Team"],
  },
  {
    term: "FIRST Choice",
    category: "Mechanical",
    definition:
      "A program giving teams credits to select specific Kit of Parts components from partner vendors.",
    link: "https://www.firstinspires.org/robotics/frc/kit-of-parts",
    inMatch:
      "FIRST Choice is a credit balance your team will forget to spend. It opens before Kickoff, runs in rounds, and the popular items disappear within hours — so the team that assigns one person to browse and order in round one gets sensors, motors, and pneumatics for free that everyone else ends up buying at full price in February.",
    lessonCues: ["FIRST Choice", "Kit of Parts"],
    related: ["Kit of Parts", "KitBot", "Kickoff"],
  },
  {
    term: "KitBot",
    category: "Mechanical",
    definition:
      "The FIRST-provided everybot/starter robot design teams can build as a reliable, competition-ready baseline.",
    link: "https://www.firstinspires.org/robotics/frc/kit-of-parts",
    inMatch:
      "The KitBot exists because a working simple robot beats an ambitious unfinished one. FIRST publishes a full build guide each season for a machine that can score and usually climb using kit parts. Rookie teams that build it have a robot on the field in week one and spend the rest of build season on driver practice instead of fabrication.",
    alsoCalled: ["Everybot", "Kit Bot"],
    lessonCues: ["KitBot", "everybot", "Kit of Parts"],
    related: ["Kit of Parts", "Rookie Team", "COTS"],
  },

  // ---- Sensors & Controls ----
  {
    term: "Encoder",
    category: "Sensors & Controls",
    definition:
      "A sensor that measures rotation/position of a shaft, essential for closed-loop control and odometry.",
    link: "https://docs.wpilib.org/en/stable/docs/hardware/sensors/encoders-hardware.html",
    inMatch:
      "An encoder is how your code knows where a mechanism actually is, rather than where it was told to go. You meet them everywhere: drivetrain distance for odometry, arm angle for a position loop, flywheel speed for a shooter. The recurring lesson is absolute versus relative — a relative encoder forgets its zero every power cycle, which is why arms need an absolute reference.",
    lessonCues: ["encoder", "encoders"],
    related: ["Odometry", "PID Controller", "SPARK MAX"],
  },
  {
    term: "Gyroscope / IMU",
    abbr: "IMU",
    category: "Sensors & Controls",
    definition:
      "A sensor that measures the robot's heading and rotation; common units are the NavX and CTRE Pigeon 2.0.",
    link: "https://docs.wpilib.org/en/stable/docs/hardware/sensors/gyros-hardware.html",
    inMatch:
      "The gyro is what makes field-oriented driving and any straight autonomous work at all. It also drifts, and it drifts much worse if you calibrate it while the robot is moving — which is exactly what happens when someone bumps the cart during the pre-match calibration. Mount it rigidly near the centre of rotation, calibrate at rest, and re-zero deliberately.",
    alsoCalled: ["Gyro", "Inertial Measurement Unit", "Pigeon 2.0", "NavX"],
    lessonCues: ["gyro", "gyros", "IMU", "IMUs", "gyroscope"],
    related: ["Odometry", "Autonomous", "AprilTag"],
  },
  {
    term: "AprilTag",
    category: "Sensors & Controls",
    definition:
      "A fiducial marker (like a simple QR code) placed on the field that cameras use to estimate the robot's pose.",
    link: "https://docs.wpilib.org/en/stable/docs/software/vision-processing/apriltag/apriltag-intro.html",
    internalLink: "/blog/frc-apriltags-explained",
    inMatch:
      "AprilTags turned FRC vision from “find the retroreflective blob” into “here is my position on the field”. In a match that means auto-aligning to a scoring location and correcting odometry drift mid-cycle. The practical caveats are distance and angle: a tag seen far away and off-axis gives a noisy pose, which is why teams weight multi-tag measurements much more heavily.",
    alsoCalled: ["Fiducial marker", "April tag"],
    lessonCues: ["AprilTag", "AprilTags"],
    related: ["PhotonVision", "Limelight", "Odometry"],
  },
  {
    term: "Limelight",
    category: "Sensors & Controls",
    definition:
      "A plug-and-play smart camera widely used for FRC vision targeting and AprilTag-based localization.",
    link: "https://docs.limelightvision.io",
    inMatch:
      "Limelight is the fastest path from no vision to working vision: power it, point it, configure a pipeline in a browser, and read the results over NetworkTables. Teams pick it when programming time is the scarce resource. The trade-offs you feel later are cost, a fixed hardware platform, and less freedom than a general coprocessor when you want custom processing.",
    lessonCues: ["Limelight"],
    related: ["PhotonVision", "AprilTag", "Odometry"],
  },
  {
    term: "PhotonVision",
    category: "Sensors & Controls",
    definition:
      "Free, open-source vision software that runs on a coprocessor or Limelight for targeting and pose estimation.",
    link: "https://docs.photonvision.org",
    inMatch:
      "PhotonVision is free and runs on hardware you may already own — an Orange Pi, a Limelight, a spare laptop — which makes it the choice for teams with more time than budget. You spend that time on setup: camera calibration, exposure tuning, and getting the coprocessor to boot reliably on a robot that gets power-cycled twenty times a day.",
    lessonCues: ["PhotonVision"],
    related: ["Limelight", "AprilTag", "Odometry"],
  },
  {
    term: "NEO / NEO 550",
    category: "Sensors & Controls",
    definition:
      "REV Robotics brushless motors with built-in encoders, paired with SPARK MAX/Flex controllers.",
    link: "https://www.revrobotics.com",
    inMatch:
      "NEOs are the motor most teams meet first: brushless, cheap enough to keep spares, with an encoder built in and a SPARK MAX or SPARK Flex on the other end. The 550 is the small one — great for intakes and turrets, easy to cook if you stall it. Both are configured through the REV Hardware Client, which you will end up running in the pit.",
    alsoCalled: ["NEO Brushless", "NEO 550"],
    lessonCues: ["NEO", "NEO Vortex", "REVLib"],
    related: ["SPARK MAX", "Kraken X60", "Gear Ratio"],
  },
  {
    term: "Kraken X60",
    category: "Sensors & Controls",
    definition:
      "A high-performance brushless motor (with integrated Talon FX electronics) controlled over CAN via Phoenix.",
    link: "https://wcproducts.com",
    inMatch:
      "The Kraken puts a strong brushless motor and Talon FX electronics in the same housing, so there is no separate controller to mount or wire — just power and CAN. Teams choose it for drivetrains and heavy mechanisms where the extra torque matters, and configure it in Phoenix Tuner, including the current limits that stop four of them browning out the robot.",
    lessonCues: ["Kraken", "Kraken X60"],
    related: ["Talon FX / SRX", "Falcon 500", "CAN bus"],
  },
  {
    term: "Falcon 500",
    category: "Sensors & Controls",
    definition:
      "A brushless motor with an integrated Talon FX controller and encoder, controlled over the CAN bus.",
    link: "https://store.ctr-electronics.com",
    inMatch:
      "Falcons are still on plenty of robots, and knowing them matters because sooner or later you inherit one. Same integrated-controller idea as the Kraken and the same Phoenix software family, but a different generation — and mixed Phoenix 5 and Phoenix 6 code is a common source of confusion when a team upgrades some motors and not others.",
    lessonCues: ["Falcon 500", "Falcon"],
    related: ["Talon FX / SRX", "Kraken X60", "CAN bus"],
  },
  {
    term: "SPARK MAX",
    category: "Sensors & Controls",
    definition:
      "A REV Robotics motor controller for brushed and brushless (NEO) motors, configured via REV Hardware Client.",
    link: "https://docs.revrobotics.com/brushless/spark-max/overview",
    inMatch:
      "SPARK MAX is where NEO configuration actually lives: CAN ID, brake or coast mode, current limits, and closed-loop gains are set on the controller, not only in code. Two habits save events — apply a known configuration from code at startup so a swapped controller behaves identically, and label CAN IDs physically so a pit repair does not turn into a debugging session.",
    alsoCalled: ["SPARK Flex", "REV SPARK"],
    lessonCues: ["SPARK MAX", "SPARK Flex", "REVLib"],
    related: ["NEO / NEO 550", "CAN bus", "Encoder"],
  },
  {
    term: "Talon FX / SRX",
    category: "Sensors & Controls",
    definition:
      "CTR Electronics motor controllers (Talon FX is integrated in Falcon/Kraken; SRX is a standalone CAN controller).",
    link: "https://store.ctr-electronics.com",
    inMatch:
      "Talon FX is the controller living inside a Falcon or Kraken; Talon SRX is the standalone one you bolt on for brushed motors like a window motor or an older CIM. You meet both through Phoenix Tuner — assigning CAN IDs, updating firmware, and checking a device's status the moment the driver station reports it has vanished from the bus.",
    alsoCalled: ["TalonFX", "Talon SRX"],
    lessonCues: ["Talon FX", "Talon SRX", "motor controller", "motor controllers"],
    related: ["Kraken X60", "Falcon 500", "CAN bus"],
  },

  // ---- Awards ----
  {
    term: "Impact Award",
    category: "Awards",
    definition:
      "FRC's most prestigious award (formerly the Chairman's Award), honoring the team that best embodies FIRST's mission and impact.",
    link: "https://www.firstinspires.org/resource-library/frc/awards",
    internalLink: "/blog/how-to-win-the-impact-award",
    inMatch:
      "The Impact Award is judged on evidence, not enthusiasm. Concretely that means a documented multi-year record of starting teams, running events, and measurable community reach, plus an executive summary, a documentation form, and a presentation your students deliver without notes. It is also the only award that advances a team to Championship on merit rather than on robot performance.",
    alsoCalled: ["Chairman's Award"],
    lessonCues: ["Impact Award", "Chairman's Award"],
    related: ["Dean's List Award", "Gracious Professionalism", "FIRST Championship"],
  },
  {
    term: "Woodie Flowers Award",
    abbr: "WFFA",
    category: "Awards",
    definition:
      "Recognizes an outstanding mentor who exemplifies excellence in communication and teaching within FRC.",
    link: "https://www.firstinspires.org/resource-library/frc/awards",
    inMatch:
      "WFFA is nominated by students, in an essay, about one specific mentor — and the essays that win are full of concrete moments rather than adjectives. Practically, that means somebody on your team has to start noticing in October what a mentor actually does, because a good nomination cannot be reconstructed from memory in the week it is due.",
    alsoCalled: ["Woodie Flowers Finalist Award", "WFFA"],
    lessonCues: ["Woodie Flowers", "mentor award", "mentors"],
    related: ["Dean's List Award", "Impact Award", "Gracious Professionalism"],
  },
  {
    term: "Dean's List Award",
    category: "Awards",
    definition:
      "Honors exceptional student leaders for their contributions and leadership within their team and community.",
    link: "https://www.firstinspires.org/resource-library/frc/awards",
    inMatch:
      "Dean's List is a nomination your mentors submit for up to two sophomores or juniors, with a deadline weeks before your first event. Students who win it are usually the ones who took over something outright — a subsystem, the scouting system, the safety program — and can talk about it in a judged interview without a mentor in the room.",
    lessonCues: ["Dean's List", "Deans List", "student leadership"],
    related: ["Woodie Flowers Award", "Impact Award", "Rookie All-Star Award"],
  },
  {
    term: "Rookie All-Star Award",
    category: "Awards",
    definition:
      "The top award for a first-year team, recognizing a strong start that embodies FIRST's values.",
    link: "https://www.firstinspires.org/resource-library/frc/awards",
    inMatch:
      "Rookie All-Star is the highest award a first-year team can win, and it advances the team — so it is worth understanding in September rather than March. Judges look for a rookie that already behaves like a programme: outreach started, sponsors thanked properly, safety taken seriously, and a robot the students can clearly explain because they built it themselves.",
    lessonCues: ["Rookie All-Star", "Rookie All Star"],
    related: ["Rookie Team", "Impact Award", "Dean's List Award"],
  },

  // ---- Data & Scouting ----
  {
    term: "Scouting",
    category: "Data & Scouting",
    definition:
      "Systematically collecting data on robots' performance to inform strategy and alliance-selection decisions.",
    link: "https://www.thebluealliance.com",
    inMatch:
      "Scouting is a whole sub-team's job at an event: people in the stands recording what every robot does each match, plus pit scouting to catch what the field never shows — cycle strategy, mechanism reliability, whether they can actually climb. The data only matters if it is clean, which is why teams standardise the form long before the first event.",
    alsoCalled: ["Match scouting", "Pit scouting"],
    lessonCues: ["scouting", "pit scouting", "match scouting"],
    related: ["Picklist", "The Blue Alliance", "Alliance Selection"],
  },
  {
    term: "Picklist",
    category: "Data & Scouting",
    definition:
      "A ranked list of teams an alliance captain uses to decide whom to invite during alliance selection.",
    link: "https://www.thebluealliance.com",
    inMatch:
      "The picklist turns a weekend of scouting into a decision made in ninety seconds on the field. Good ones separate “who is best” from “who is best alongside us” and explicitly mark teams to avoid. They also get rebuilt on Saturday morning, because Friday's data was collected before half the field finished repairing their robots.",
    alsoCalled: ["Pick list", "Do-not-pick list"],
    lessonCues: ["picklist", "pick list", "alliance selection"],
    related: ["Scouting", "Alliance Selection", "OPR"],
  },
  {
    term: "OPR",
    abbr: "OPR",
    category: "Data & Scouting",
    definition:
      "Offensive Power Rating — a calculated estimate of a team's average scoring contribution, derived from match results.",
    link: "https://www.thebluealliance.com",
    internalLink: "/blog/frc-opr-dpr-ccwm-explained",
    inMatch:
      "OPR is computed from match scores alone, so it needs no scouts — which is both its strength and its weakness. It is a fast first pass at ranking an event you have not watched, but it credits a team for their partners' scoring and gives a good defender almost nothing. Use it to sort your scouting priorities, never as the picklist itself.",
    alsoCalled: ["Offensive Power Rating"],
    lessonCues: ["OPR", "DPR", "CCWM"],
    related: ["EPA", "Statbotics", "Scouting"],
  },
  {
    term: "EPA",
    abbr: "EPA",
    category: "Data & Scouting",
    definition:
      "Expected Points Added — Statbotics' rating model estimating a team's contribution to match score.",
    link: "https://www.statbotics.io",
    internalLink: "/blog/what-is-statbotics-frc-epa",
    inMatch:
      "EPA is the number most teams glance at before a match to know roughly what their alliance is worth. It updates match by match and is comparable across events, which OPR is not. It still cannot see strategy — a robot with a modest EPA that plays flawless defence can decide a playoff series, and no rating model will warn you about that.",
    alsoCalled: ["Expected Points Added"],
    lessonCues: ["EPA", "Statbotics"],
    related: ["Statbotics", "OPR", "The Blue Alliance"],
  },
  {
    term: "The Blue Alliance",
    abbr: "TBA",
    category: "Data & Scouting",
    definition:
      "The community database of teams, events, matches, and results — with a public API used by many scouting tools.",
    link: "https://www.thebluealliance.com",
    internalLink: "/blog/the-blue-alliance-tba-guide",
    inMatch:
      "TBA is the tab you keep open in the stands: match schedules, live results, rankings, and every match a team has ever played. Its API is also the usual first data source for a scouting system or a sponsor report — and your own TBA page, with its photos and links, is what a judge or a prospective sponsor finds when they look your team up.",
    alsoCalled: ["TBA"],
    lessonCues: ["The Blue Alliance", "TBA"],
    related: ["Statbotics", "Scouting", "OPR"],
  },
  {
    term: "Statbotics",
    category: "Data & Scouting",
    definition:
      "An analytics site providing EPA ratings, predictions, and historical FRC data.",
    link: "https://www.statbotics.io",
    internalLink: "/blog/what-is-statbotics-frc-epa",
    inMatch:
      "Statbotics answers “how good is this team, really” before you have scouted them yourself. Its EPA model, event predictions, and year-over-year team pages are most useful in the week before an event, while you are drafting a preliminary picklist, and again on Saturday morning when you are checking whether your own scouting data agrees with the model.",
    lessonCues: ["Statbotics", "EPA"],
    related: ["EPA", "The Blue Alliance", "OPR"],
  },

  // ---- Community ----
  {
    term: "Chief Delphi",
    abbr: "CD",
    category: "Community",
    definition:
      "The largest FRC community forum, where teams share technical knowledge, designs, and code.",
    link: "https://www.chiefdelphi.com",
    inMatch:
      "Chief Delphi is where FRC's institutional knowledge actually lives. Almost every problem you hit in build season — a gearbox that keeps eating itself, a CAN bus dropping devices, a swerve module nobody can zero — already has a thread with photos and a real answer. It is also where Open Alliance build threads and post-season design releases get posted.",
    alsoCalled: ["CD"],
    lessonCues: ["Chief Delphi", "open alliance", "build thread"],
    related: ["Open Alliance", "Onshape", "Build Season"],
  },
  {
    term: "Onshape",
    category: "Community",
    definition:
      "A free, cloud-based CAD platform popular in FRC for collaborative robot design.",
    link: "https://www.onshape.com",
    inMatch:
      "Onshape is the CAD most FRC teams use because it runs in a browser, is free for teams, and lets several students model the same assembly at once without anyone emailing files around. The practical consequences are version history you can genuinely roll back, vendor part libraries you insert directly, and a design review anybody can open on a phone.",
    lessonCues: ["Onshape", "CAD software", "FeatureScripts"],
    related: ["COTS", "Chief Delphi", "Swerve Drive"],
  },
  {
    term: "Open Alliance",
    category: "Community",
    definition:
      "A group of teams that publicly document their build season in real time to share knowledge with the community.",
    link: "https://www.theopenalliance.org",
    inMatch:
      "Open Alliance teams post their design decisions, CAD, and mistakes publicly during build season, which makes their threads the closest thing FRC has to a live engineering notebook from a top team. Reading one alongside your own build is one of the cheapest ways to learn — you see not just what they built, but what they tried and abandoned.",
    alsoCalled: ["Build thread", "OA"],
    lessonCues: ["Open Alliance", "build thread"],
    related: ["Chief Delphi", "Build Season", "Swerve Drive"],
  },
];
