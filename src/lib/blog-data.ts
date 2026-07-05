export interface Article {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  date: string; // YYYY-MM-DD
  readMins: number;
  content: string; // markdown
}

export const ARTICLES: Article[] = [
  {
    slug: "how-to-start-an-frc-team",
    title: "How to Start an FRC Team: A Complete Beginner's Guide",
    description:
      "Everything you need to start a FIRST Robotics Competition (FRC) team — costs, registration, mentors, space, timeline, and grants that cover your first event.",
    keywords: [
      "how to start an FRC team",
      "start a FIRST robotics team",
      "FRC team registration",
      "FRC cost",
      "new FRC team",
    ],
    date: "2026-06-22",
    readMins: 7,
    content: `Starting a FIRST Robotics Competition team feels huge — a robot that can weigh over 100 pounds, a six-week build season, thousands of dollars. But thousands of teams started exactly where you are. Here's the honest, practical path from "we want a team" to your first match.

## What FRC actually is

FRC is the flagship high-school program of *FIRST*. Each January, every team worldwide gets the same game at **Kickoff**, then has about six weeks to design, build, and program a robot to play it. Teams compete at Regional or District events in the spring, with the season culminating at the **FIRST Championship** in Houston.

It is not just engineering: a strong team needs people doing mechanical, CAD, programming, electrical, scouting, strategy, business, fundraising, and outreach. That breadth is good news — there's a role for almost anyone.

## Step 1: Find your people

You need three things before anything else:

- **Students.** You can start with as few as 5–10 committed members. Quality of commitment matters far more than headcount in year one.
- **At least two adult mentors who will serve as Lead Coaches.** FIRST requires two Youth Protection Program-screened Lead Coaches per team before registration is complete and the team is "event ready." A teacher, parent, or local engineer all work — they don't need robotics experience, just reliability.
- **A host organization.** Usually a school, but homeschool groups, libraries, and community organizations can charter teams too.

## Step 2: Understand the real costs

Budget honestly up front. For the current season, the core fees are:

- **Season registration: ~$6,500** (this is your entry and includes a Kit of Parts).
- **Each additional Regional event: ~$3,200.**
- Plus robot parts, tools, and travel — FIRST's published median total for a Regional team is around **$24,000/season**, though many teams run leaner.

The number scares people, so here's the part nobody tells rookies: **you rarely pay full freight your first year.** Rookie teams are eligible for substantial grants — most notably the **NASA FRC Sponsorship Grant**, which can cover your first event's registration entirely. Check the [FIRST Team Grant Opportunities](https://www.firstinspires.org/programs/team-grant-opportunities) page early; deadlines cluster in the fall.

## Step 3: Register and get your Kit of Parts

Register your team at [firstinspires.org](https://www.firstinspires.org/robotics/frc). New teams get a **rookie Kit of Parts** with a control system, motors, and a drivetrain option to get you moving. Get your adult leads' Youth Protection screening done early — it's a common bottleneck.

## Step 4: Get a space and basic tools

You need a room you can leave a half-built robot in, plus power and a few feet of open floor to drive on. Tool-wise, start minimal: drill, hand tools, a way to cut aluminum, and a soldering/crimping kit for electrical. You can borrow CNC or machining time from a veteran team or a sponsor's shop.

## Step 5: Train before Kickoff

This is where most rookie teams stumble — they spend the first two weeks of build season *learning the basics* instead of building. Use the fall and early winter to get members comfortable with the fundamentals of each department: drivetrains, wiring that passes inspection, the programming control system, and basic strategy. (That's exactly what we built [LearnFRC](https://learnfrc.systemerr.com) for — free, structured lessons across every department. Start with the [Getting Started guide](https://learnfrc.systemerr.com/guides/getting-started).)

## Step 6: Survive your first build season

A few rules that save rookie teams:

- **Keep the robot simple.** A reliable robot that drives and scores one way beats an ambitious robot that doesn't work.
- **Wire it well.** A large share of robot failures at events are electrical. Crimp cleanly and build a tidy CAN bus.
- **Start scouting early.** You pick alliances on data, not vibes.
- **Document everything.** Your seniors graduate; written knowledge is how the team survives.

## The mindset that matters most

Your first season's goal is **not** to win — it's to finish a robot, compete, and build a team that comes back next year. Lean on the community: Chief Delphi, your regional veterans, and Open Alliance teams are remarkably generous. Ask questions early and often.

Ready to train your team? Browse the [free department guides on LearnFRC](https://learnfrc.systemerr.com/guides) — built by an FRC student, for new teams.`,
  },
  {
    slug: "swerve-drive-explained",
    title: "Swerve Drive Explained: How FRC's Most Popular Drivetrain Works",
    description:
      "A clear, beginner-friendly explanation of swerve drive in FRC — how the modules work, the math behind it, COTS options, and whether your team should run it.",
    keywords: [
      "swerve drive",
      "FRC swerve drive",
      "how does swerve drive work",
      "swerve modules",
      "FRC drivetrain",
    ],
    date: "2026-06-22",
    readMins: 6,
    content: `Swerve drive has gone from an elite-team novelty to the most common drivetrain at the top of FRC. If you've watched a recent match and seen robots slide sideways and spin while moving, that's swerve. Here's how it actually works — without the intimidating math.

## What swerve drive is

A swerve drive is a **holonomic** drivetrain: it can move in any direction *and* rotate independently, at the same time. It does this with (usually four) **swerve modules**, one near each corner of the robot. Each module has:

- A **drive motor** that spins the wheel (how fast you go), and
- A **steering (azimuth) motor** that rotates the whole wheel assembly to point in any direction (which way you go), plus
- An **absolute encoder** that always knows which way the module is pointed.

Because every wheel can point and spin independently, the robot can translate in any direction regardless of which way it's "facing." That's what makes swerve feel so agile.

## How it works (the intuition)

You don't need to derive the kinematics to understand it. The driver commands three things: forward/back speed, left/right speed, and rotation. The robot's code runs **inverse kinematics** to figure out, for each of the four modules, the exact *angle* and *speed* that combine to produce that overall motion. WPILib provides this math out of the box (\`SwerveDriveKinematics\`), so you mostly configure it rather than write it from scratch.

Add **field-oriented control** — where "push the stick forward" means "move toward the far end of the field" no matter which way the robot is turned — and swerve becomes incredibly intuitive to drive.

## The COTS options

You almost never build swerve modules from scratch anymore. The popular commercial off-the-shelf (COTS) modules include:

- **SDS MK4 / MK4i / MK4n** (Swerve Drive Specialties)
- **WCP Swerve X / X2** (West Coast Products)
- **REV MAXSwerve**
- **TTB Swerve** and others

They differ in size, gearing, motor compatibility (NEO, NEO Vortex, Kraken X60, etc.), and how you maintain them — but all give you a proven module so you can focus on the rest of the robot.

## The trade-offs (should *your* team run it?)

Swerve is powerful, but it's not free:

**Pros:** unmatched maneuverability, strong defense evasion, precise auto paths.

**Cons:**
- **Cost.** Four modules plus eight motors is a significant chunk of budget.
- **Programming complexity.** Encoder offsets, odometry, and tuning take real software effort.
- **Maintenance.** More moving parts means more that can loosen or fail mid-event.

A well-built **tank/west-coast drive** is still completely competitive and far simpler. The honest rule: a reliable tank drive beats a poorly-tuned swerve every time. Run swerve when your team has the budget *and* the software capacity to support it.

## How to learn it

If your team is ready to take it on, learn it in this order: the drivetrain mechanics, then WPILib command-based programming, then odometry and path-following. We cover each step in the free [Programming](https://learnfrc.systemerr.com/guides/programming-software) and [Mechanical](https://learnfrc.systemerr.com/guides/mechanical-build) tracks on LearnFRC, and the official [WPILib docs](https://docs.wpilib.org) are excellent for the code side.

Want the full path from drivetrain basics to a swerve-driving robot? [Start the free Programming track →](https://learnfrc.systemerr.com/guides/programming-software)`,
  },
  {
    slug: "how-to-win-the-impact-award",
    title: "How to Win the FIRST Impact Award (FRC's Most Prestigious Award)",
    description:
      "What the FIRST Impact Award is, how it's judged, and how to write the essay, executive summaries, and pitch that win it — the most prestigious award in FRC.",
    keywords: [
      "FIRST Impact Award",
      "how to win Impact Award",
      "FRC Impact Award essay",
      "Chairman's Award",
      "FRC awards",
    ],
    date: "2026-06-22",
    readMins: 7,
    content: `The FIRST Impact Award (formerly the Chairman's Award) is the most prestigious award in FRC. It doesn't go to the best robot — it goes to the team that best represents a role model for other teams and best embodies the mission of *FIRST*. Winning it at the Championship inducts your team into the **FIRST Hall of Fame**. Here's how it actually works.

## What the Impact Award really measures

This is the key mindset shift: **the Impact Award is not about your robot.** It's about your team's measurable, sustained effect on your community and on FIRST — and your plan to keep that going. Judges are looking for a team that spreads STEM, helps other teams form and grow, and can prove real, lasting outcomes (not just "we did an event once").

The single biggest mistake teams make is treating it as a writing contest you start in February. Winning teams do the *work* year-round and document it as they go.

## The three parts of a submission

A complete Impact Award submission has three pieces:

### 1. The essay (up to 10,000 characters)
A narrative of your team's story and impact. It should be specific and evidence-driven: concrete programs, real numbers, and the outcomes they produced — not vague mission statements. Show a trajectory: where you started, what you built, and where it's going.

### 2. The executive summaries
A set of short, punchy responses (each limited to ~500 characters) covering specific areas — your outreach, the teams you've started or mentored, your sustainability, your impact on participants, and more. These force you to be concrete. Every box should contain a real, quantified accomplishment.

### 3. The presentation / judged pitch
At the event, a small group of students presents to judges and answers questions. This is where personality and authenticity matter. Judges can tell instantly whether the students *live* the work or just memorized a script. Practice, but speak like humans.

## How it's judged and advances

The award is given at District and Regional events, and those winners advance to compete for the **Championship Impact Award**. At Championship, judges select a set of finalists and, from those, one winning team that enters the Hall of Fame. Because it advances, your event submission is the foundation for everything above it.

## How to actually win it

- **Start documenting in the offseason.** Keep a running log of every outreach event, team you helped, and measurable outcome. February-you will thank June-you.
- **Quantify everything.** "We ran workshops" is weak. "We trained 140 students across 6 rookie teams, 3 of which competed for the first time" is strong.
- **Tell one coherent story.** The essay, summaries, and pitch should reinforce the same narrative, not feel like three separate documents.
- **Prove sustainability.** Judges want to see your impact will outlast the current seniors — pipelines, funding, and systems, not heroics.
- **Pick presenters who do the work.** Authenticity beats polish.

## Where to learn the details

The exact character limits, question list, and judging criteria are published each season in the [FIRST awards materials](https://www.firstinspires.org/resource-library/frc/awards) — always confirm the current year's specifics. For a step-by-step walkthrough of the essay, the executive summaries, and building a winning pitch, see the free [Impact Award track on LearnFRC](https://learnfrc.systemerr.com/guides/impact-award).

The teams that win this award aren't the ones with the best writers — they're the ones doing real work all year and telling that story clearly. [Start the Impact Award guide →](https://learnfrc.systemerr.com/guides/impact-award)`,
  },
  {
    slug: "what-is-frc",
    title: "What Is FRC? FIRST Robotics Competition Explained",
    description: "FRC (FIRST Robotics Competition) is a high school robotics league where student teams build large robots in six weeks to play a new game each year.",
    keywords: ["what is FRC","FIRST Robotics Competition","FRC explained for beginners","how FRC works","FRC build season","join an FRC team"],
    date: "2026-06-23",
    readMins: 4,
    content: `If you have heard people throw around the term "FRC" and walked away more confused than before, here is the short version: FRC stands for the FIRST Robotics Competition, a high school robotics league where student teams design, build, and drive a roughly 100-plus-pound robot to play a brand-new game every year.

## The one-sentence definition

FRC is a varsity-style robotics competition for students in grades 9 through 12 (ages 14 to 18), run by the nonprofit FIRST. FIRST, the parent nonprofit, was founded in 1989 by inventor Dean Kamen. FRC itself grew out of that work in 1992, when Kamen teamed up with MIT professor Woodie Flowers to run the very first competition, built on a simple idea: make building robots feel as exciting and team-driven as a sport.

The robots are not desktop kits. They are industrial-sized machines built from metal, motors, pneumatics, and custom code, and they play a fast, physical game on a field about the size of a basketball court.

## How a season actually works

Every season follows the same rhythm:

- **Kickoff (January):** FIRST reveals a brand-new game. Nobody knows what it is beforehand, so every team starts from zero on the same day.
- **Build season (about six weeks):** Teams design, prototype, build, wire, and program a robot to play that specific game. This is the crunch, and it is where most of the learning happens.
- **Competition season (roughly February to April):** Teams take their robot to events to compete, repair, and improve it between matches.

Because the game changes annually, last year's robot and strategy are mostly useless this year. That fresh-start design challenge is the whole point.

## What a match looks like

Matches are short, around two and a half minutes, and they are played two alliances at a time: a red alliance and a blue alliance, each made up of three robots from three different teams.

Each match has two phases:

- **Autonomous:** A brief opening period where the robot runs entirely on its own pre-written code, with no driver input.
- **Teleop (driver-controlled):** The longer remainder of the match, where student drivers control the robot with joysticks and controllers to score points.

Because you compete in three-robot alliances, FRC is genuinely cooperative. FIRST calls this "Coopertition" - you are competing hard while also helping the community around you. Teams routinely lend parts and advice to the very opponents they will face later.

## The events and how you advance

FRC events come in two main flavors. Some regions run larger **Regional** events; others run a series of smaller **District** events that feed into a **District Championship**. The top teams from both paths earn a spot at the **FIRST Championship**, the season's huge international finale, held in Houston each spring.

At every event, qualification matches determine a ranking. Then the top-ranked teams become alliance captains and draft other teams to form playoff alliances. So doing well is not just about your own robot - it is about being a team that others want to pick.

## What students actually build and learn

Teams start each year with a Kit of Parts and then buy or fabricate the rest. A typical robot combines:

- A drivetrain and motors (commonly sourced from vendors like REV Robotics, CTRE, AndyMark, and VEX)
- Mechanisms - arms, intakes, shooters, climbers - designed to score in that year's game
- A control system built around the roboRIO, the official robot controller
- Custom software, written in Java, C++, or Python using WPILib, the official FRC programming library

Just as importantly, FRC teams run like small organizations. Students handle CAD and machining, electrical, programming, scouting, fundraising, outreach, and even graphic design and business operations. Adult mentors guide the work, but students do it.

## How to get started

You do not need to be a robotics genius to join. Most teams want curious people who will show up and learn - whether your thing is wiring, code, design, or spreadsheets. The best first step is to find a local FRC team (often at a high school or community organization) and ask to visit.

If you want a structured walkthrough of joining a team, learning the tools, and surviving your first build season, start with our [Getting Started guide](https://learnfrc.systemerr.com/guides/getting-started). It is written for total beginners and points you to everything else as you grow.

FRC can sound intimidating from the outside, but it is really just a bunch of students building cool machines together under a tight deadline. Ready to take the first step? Head to the [Getting Started guides](https://learnfrc.systemerr.com/guides) and start learning.`,
  },
  {
    slug: "frc-programming-tutorial",
    title: "FRC Programming Tutorial: Getting Started with WPILib",
    description: "A beginner-friendly guide to programming an FRC robot with WPILib: pick a language, install the tools, write your first robot program, and deploy it.",
    keywords: ["how to program an FRC robot","WPILib for beginners","FRC programming tutorial","WPILib VS Code setup","command-based programming FRC","deploy code to roboRIO"],
    date: "2026-06-23",
    readMins: 5,
    content: `If you just got handed the laptop and told "you're on programming this year," WPILib is where you start. It is the official software library FIRST provides for writing code that runs on your robot, and once you know the basic loop it is far less scary than it looks.

## Pick a language first

WPILib officially supports three text-based languages, and they are kept at near feature-parity so you are not locked out of anything by choosing one:

- Java (WPILibJ) - the usual recommendation for new programmers. Good balance of convenience and performance, and the largest pile of beginner tutorials and example code.
- C++ (WPILibC) - more raw performance, but you manage memory yourself, so it asks more of you.
- Python (RobotPy) - convenient and readable, though as an interpreted language a typo can crash your robot mid-match instead of failing at compile time.

Most rookie programmers should start with Java. The concepts you learn transfer directly to the other two if your team switches later. Our [Programming guide](https://learnfrc.systemerr.com/guides/programming-software) goes deeper on choosing for your specific team.

## Install the WPILib toolchain

Do not piece this together from scattered downloads. WPILib ships one offline installer, released each season on the WPILib GitHub releases page (the 2026 release is 2026.x). Download the file for your operating system and run it.

The installer sets up everything you need in one shot:

- A dedicated copy of VS Code labeled for the year (for example "WPILib VS Code 2026"), kept separate from any VS Code you already have so updates do not break it.
- A Java JDK, the C++ toolchains, and the Gradle build system.
- Dashboards and utilities like Glass, Elastic, AdvantageScope, SysId, and the roboRIO Team Number Setter. (Shuffleboard and SmartDashboard still ship with the installer but are deprecated and slated for removal in an upcoming season, so build your habits on Elastic for driving and AdvantageScope for debugging instead.)

Install the full offline package rather than the online one when you can - the build server room at competition rarely has reliable Wi-Fi.

## Create your first project

Open the WPILib VS Code, then open the command palette with Ctrl+Shift+P and run "WPILib: Create a new project." You will pick a project template, your language, a folder, and your team number. The simplest starting template is built on the TimedRobot base class, which is the structure FIRST recommends for most teams.

A TimedRobot program is just a set of methods that the framework calls for you. The key ones are 'robotPeriodic', 'autonomousPeriodic', and 'teleopPeriodic'. WPILib calls each periodic method every 20 milliseconds - that is 50 times per second - so your job is to describe what should happen in one slice of time, and the framework handles repeating it.

Here is the mental model: 'teleopPeriodic' runs 50 times a second while a driver is in control, so reading a joystick and setting a motor speed inside it makes the robot respond in real time.

## Understand command-based programming

Once you can drive, the next step most teams take is command-based programming, a design pattern WPILib supports out of the box. It splits your robot into two ideas:

- Subsystems - a chunk of hardware that works as a unit, like a drivetrain or an arm with its motors and sensors.
- Commands - an action, like "drive forward two meters" or "raise the arm," that runs until it finishes or gets interrupted.

The CommandScheduler ties them together and runs at the same 50 Hz. The big win is that a subsystem can only be claimed by one command at a time, which stops two pieces of code from fighting over the same motor - a very common rookie bug. It also keeps your codebase reusable from season to season.

## Build and deploy to the roboRIO

Your code does not run until it is compiled (built) and pushed onto the roboRIO, the robot's brain. To deploy from VS Code, hit Shift+F5 or run "WPILib: Deploy Robot Code" from the command palette.

A few things that trip up new teams:

- Connect first. Your laptop must reach the robot over USB, Ethernet, or the robot's own wireless network before deploying.
- Match your team number. The number in 'wpilib_preferences.json' must match the number your roboRIO was imaged with, or the deploy will not find the robot.
- Never cut power mid-deploy. Powering off during a deploy can corrupt the roboRIO filesystem and force a re-image. Wait for it to finish.

After a successful deploy, open the FRC Driver Station, enable in Teleop, and drive.

## Practice without the full robot

You do not need a $5,000 competition robot to learn. The XRP and Romi are small, inexpensive desktop robots built specifically for practicing WPILib. Their projects run on your computer through the WPILib simulation framework instead of deploying to a roboRIO, so you can write real WPILib code and watch it move at your kitchen table. FIRST also offers a free XRP-based training course covering everything from variables up through command groups.

The fastest way to actually learn is to deploy something tiny, break it, and fix it. Start with the example tank-drive template, get the robot rolling, then add one feature at a time.

Ready to go deeper? Work through the full walkthroughs in the [LearnFRC Programming department](https://learnfrc.systemerr.com/guides/programming-software).`,
  },
  {
    slug: "how-to-wire-an-frc-robot",
    title: "How to Wire an FRC Robot: A Beginner Electrical Guide",
    description: "A beginner-friendly, accurate guide to wiring an FRC robot: battery, 120A breaker, PDH, roboRIO, radio, CAN bus, and the wire-gauge rules that pass inspection.",
    keywords: ["how to wire an FRC robot","FRC electrical system","FRC control system wiring","FRC PDH wiring","roboRIO power wiring","FRC wire gauge breaker sizing"],
    date: "2026-06-23",
    readMins: 5,
    content: `Wiring your first FRC robot feels intimidating, but the electrical system is really just one chain: battery, breaker, power distribution, and then everything else branching off it. Get that chain right and the rest is repetition.

This guide walks through the standard FRC control system in the order you actually build it, with the real numbers you need to pass inspection. If you want the full lesson set with diagrams and worked examples, the [Electrical & Wiring](https://learnfrc.systemerr.com/guides/electrical-wiring) department on LearnFRC goes deeper on each step.

## The power chain, top to bottom

Every legal FRC robot runs off exactly one battery: a 12V nominal sealed lead acid (SLA) battery, minimum 17Ah and maximum 18.2Ah, which is why people just call it "the 12V 18Ah battery." It connects through an Anderson SB connector (the pink/red SB50 you see in the Kit of Parts) on 6 AWG leads. Only one battery is allowed on the robot at a time.

From the battery, power flows in this order:

- Battery, on 6 AWG wire, to the 120A main breaker
- 120A main breaker, on 6 AWG wire, to your power distribution device
- Power distribution device out to every motor controller, the roboRIO, and the radio

The 120A main breaker does two jobs at once: it is your master power switch (the button you push to turn the robot on and off) and the main protection for everything downstream. Mount it where a person can reach it easily.

## Power distribution: PDH or PDP

The power distribution device is the hub of the whole system. Two are common:

- The REV Power Distribution Hub (PDH), the current Kit of Parts standard
- The CTRE Power Distribution Panel (PDP), still legal and on many veteran robots

Both take battery power in and split it across numbered channels, each protected by its own breaker or fuse. On a PDH, motor controllers land on the high-current WAGO terminals and are protected by 40-amp snap-in breakers. The same connector accepts a range of wire sizes, so always match the wire to the breaker, not the other way around.

## Wire gauge and breaker rules that actually get inspected

This is where new teams lose points at inspection. The rule is simple: the breaker or fuse protects the wire, so the wire has to be thick enough for the breaker behind it. The minimums are:

- 6 AWG for everything from the battery through the main breaker to the distribution device
- 12 AWG minimum on a 40A breaker (typical for big drive and mechanism motors)
- 14 AWG minimum on a 30A breaker
- 18 AWG minimum on a 20A breaker

Thicker is always allowed; thinner is never allowed. When in doubt, size up. These requirements live in the robot construction rules of the FRC Game Manual (the R6xx electrical rules), so check the current season's manual before your competition.

## Powering the roboRIO and the radio

The roboRIO is the brain of the robot, the computer that runs your code. It does not get its own 40A channel. Instead, you power it from a non-switchable, fused channel on the PDH (channels 20-22) protected by a 10A fuse, using 18 AWG wire into the roboRIO's power connector (red to V, black to C).

The radio is the current Vivid-Hosting VH-109, a Wi-Fi 6E radio built for FRC. There are two supported ways to power it: directly off battery voltage, or through the Radio Power Module (RPM), which sends clean 18V passive Power-over-Ethernet down the same Ethernet cable that carries data. One hard rule: never feed the radio from the RPM and a separate 12V source at the same time, and don't run the RPM alongside a PoE camera on the same radio. Doing so can damage the radio.

## CAN bus: the nervous system

Beyond power, modern FRC devices talk to each other over a CAN bus, a single twisted pair (yellow and green) that daisy-chains from the roboRIO through the PDH and every CAN motor controller in a loop. It lets you read motor current, set IDs, and get rich telemetry that simple PWM wiring can't. Keep the chain continuous and terminate it correctly, or devices will drop off the bus.

## Build habits that save you

- Color code: red for positive, black for negative, every time
- Strip the right length, crimp firmly, and tug-test every connection; if you can twist a main breaker lug by hand, it's not tight
- Insulate exposed terminals with heat shrink or electrical tape
- Leave a little slack and label both ends of long runs

Wiring is one of the most learnable parts of FRC because the rules are concrete and the same patterns repeat across every robot. Take it one connection at a time and verify as you go.

Ready to go deeper with full diagrams, crimping technique, and rule-by-rule checklists? Start the [Electrical & Wiring guide on LearnFRC](https://learnfrc.systemerr.com/guides/electrical-wiring).`,
  },
  {
    slug: "best-cad-software-for-frc",
    title: "The Best CAD Software for FRC (and How to Choose)",
    description: "Onshape vs SolidWorks vs Fusion 360 for FRC: all three are free for teams. Here is how to pick the right CAD software for your robot.",
    keywords: ["best CAD software for FRC","Onshape vs SolidWorks FRC","Fusion 360 for FRC","free CAD for FIRST Robotics","FRC CAD software comparison"],
    date: "2026-06-23",
    readMins: 4,
    content: `If you are picking a CAD tool for your FRC team, here is the short version: the three serious options are Onshape, SolidWorks, and Autodesk Fusion, and all three are free for FIRST Robotics teams. The better question is not which is "best" in the abstract, but which fits how your team actually works.

## Why CAD matters in FRC

CAD is how you design a robot before you cut metal. A good model catches interference, lets you check that the arm reaches the right height, and produces drawings the build team can manufacture from. Once you commit to designing in CAD rather than improvising at the bandsaw, the tool you choose shapes how your whole team collaborates for the season. If you are just getting started, the LearnFRC [CAD and Design guide](https://learnfrc.systemerr.com/guides/cad-design) walks through the fundamentals before you worry about software.

## Onshape: the community default

Onshape is the most widely used CAD platform in FRC, and for good reason. It is cloud-native and runs entirely in a browser, so it works on Chromebooks, Macs, Windows PCs, and even tablets with no install. That matters when half your team is on school laptops you do not control.

Its standout feature is real-time collaboration. Multiple students can open the same document at once and see edits happen live, with tools like Follow Mode and branching and merging for managing changes. Onshape is free for FIRST teams through the Educator Plan, which adds release management and class features.

The ecosystem is the other reason it dominates. Community resources like FRCDesign.org and Onshape4FRC offer full curricula built specifically for FRC, plus parts libraries and the official field models. If you want the smoothest path to getting a rookie productive, Onshape is hard to beat.

## SolidWorks: the industry standard

SolidWorks is professional desktop CAD used widely in mechanical engineering, and it is free for FIRST teams through a sponsorship with Dassault Systemes. FIRST also publishes SolidWorks-compatible versions of the official field and game-piece CAD each season, though the official model itself is built in Onshape.

Strengths:

- Extremely powerful, mature feature set used across real engineering jobs.
- Learning it builds a skill that transfers directly to college and industry.
- The sponsorship now includes browser-based cloud apps (like xDesign) plus cloud storage, so you are not strictly tied to one Windows machine.

Trade-offs:

- The full desktop version is Windows-only and needs a reasonably capable computer.
- Setup and license management are more involved than Onshape's sign-up-and-go flow.

If you have mentors who already know SolidWorks, or students aiming at mechanical engineering, the industry transferability is a real advantage.

## Autodesk Fusion: strong CAD plus CAM

Autodesk Fusion (formerly Fusion 360) is free for students and educators through Autodesk's education license, and it is also available to FRC teams. It is cloud-connected but installs as a desktop app on Windows and Mac.

Fusion's calling card is integrated CAM, the tooling that turns a model into machine instructions for a CNC router or mill. If your team manufactures parts on a CNC, having design and CAM in one program is genuinely convenient. It is also a comfortable middle ground: more approachable than full SolidWorks, more capable than entry-level tools.

The main caution is that Fusion leans on a single-user file model, so live multi-person editing is weaker than Onshape's. For a large team where many people design at once, that can become a bottleneck.

## How to choose

Match the tool to your team, not to a forum opinion:

- Mixed or school-managed computers, lots of new students, heavy collaboration: choose Onshape.
- Mentors who know SolidWorks, students targeting mechanical engineering, Windows machines available: choose SolidWorks.
- You run a CNC and want CAD plus CAM in one place: Fusion is the classic pick, but Onshape teams can also add its CAM Studio (free via the Educator Plan) rather than switching ecosystems just for machining.

A few honest realities. First, the best CAD software is the one your mentors can actually teach, so existing expertise should weigh heavily. Second, switching mid-season is painful, so pick once and commit. Third, whatever you choose, download the official field and game-piece CAD that FIRST releases each season and design against it, because guessing at dimensions is how robots fail inspection.

There is no universally correct answer here. Onshape is the safe default for most teams because it is free, runs everywhere, and has the deepest FRC-specific learning resources, but SolidWorks and Fusion are excellent in the right hands.

Ready to start modeling? Dig into the LearnFRC [CAD and Design guides](https://learnfrc.systemerr.com/guides/cad-design) for step-by-step tutorials on whichever tool you pick.`,
  },
  {
    slug: "frc-scouting-guide",
    title: "FRC Scouting Guide: How to Scout and Build a Picklist",
    description: "Learn how FRC scouting works, what OPR and EPA actually measure, and how to turn match data into a ranked picklist for alliance selection.",
    keywords: ["how to scout in FRC","FRC picklist","OPR vs EPA","FRC alliance selection","FRC scouting data","Statbotics EPA"],
    date: "2026-06-23",
    readMins: 4,
    content: `Winning in FRC is rarely about having the single best robot in the room. It is about understanding every robot in the room well enough to predict matches, pick the right partners, and play to your alliance's strengths. That is what scouting does, and good scouting is one of the highest-leverage things a rookie or mid-tier team can invest in.

## What scouting actually is

Scouting is the process of systematically recording what robots do during qualification matches so your team can make better strategic decisions later. There are two kinds, and you want both:

- **Quantitative scouting** records numbers, match by match: how many game pieces a robot scored, where it scored them, whether it climbed or completed an endgame task, and how many seconds its scoring cycle took.
- **Qualitative scouting** records judgment that numbers miss: Is the robot reliable or does it brown out? Can it play defense? Does the drive team make smart decisions? Did it sit dead on the field?

Most teams assign one scout per robot per match (six scouts for the six robots on the field) and log data on paper sheets or a shared app, then aggregate it into a spreadsheet. The goal is a clean, per-team summary you can sort and compare.

If you are setting up a scouting system from scratch, start with our [Scouting and Strategy guides](https://learnfrc.systemerr.com/guides/scouting-strategy) before you build a spreadsheet, because the structure of your data sheet decides what questions you can answer later.

## OPR and EPA: what the metrics mean

You do not have to compute everything by hand. Two community metrics give you a fast first read on any team.

**OPR (Offensive Power Rating)** estimates a team's average point contribution to its alliance using linear algebra: it takes every alliance's final score across the event and solves a least-squares system to assign each team a number. OPR is free on The Blue Alliance and requires zero manual scouting, which is its biggest strength. Its weakness is that it assumes scoring is linear and shared cleanly across three robots, so it gets fuzzy in games with non-linear scoring, heavy defense, or penalties. As The Blue Alliance puts it, OPR "can always supplement, but never replace, proper scouting."

**EPA (Expected Points Added)**, from Statbotics, is a newer model. It builds on the Elo rating concept but reports results directly in points, so you can read it much like an OPR. EPA is a running average of a team's contribution that updates after every match, and Statbotics reports it as more predictive and better calibrated than both Elo and OPR.

Treat both as starting points, not verdicts. They tell you who is generally strong; they do not tell you whether a robot can play the specific role your alliance needs.

## Turning data into a picklist

A picklist is a ranked list of the teams you want to play with in the elimination rounds. Because a standard FRC event fields eight alliances of three robots each, your list should comfortably cover the top 24 or so teams. Most teams keep three lists:

- A **first-pick list**: complete robots that would be strong alliance captains' partners.
- A **second-pick list**: specialists who fill a specific gap, such as a fast defender or a reliable endgame robot.
- A **do-not-pick list**: teams to avoid because of unreliability or safety, regardless of raw output.

Build the lists by combining your scouting data with strategy. Ask what your robot does well, what it cannot do, and which partner abilities would complete the alliance. A team with a mediocre OPR but a flawless climb or strong defense can be worth more to you than a higher-rated robot that does the same thing your robot already does.

## How alliance selection works

Knowing the selection mechanics keeps your list realistic. At official FRC events, the eight highest-ranked alliance captains pick in order from Alliance 1 to Alliance 8 for their first choice. For the second choice the order reverses, running from Alliance 8 back up to Alliance 1, a serpentine pattern that gives lower seeds an earlier second pick. Each invited team accepts or declines on the spot, and a team that declines cannot be invited again.

Because picks vanish in real time, never bring a single ranked column. Keep your list dynamic and cross teams off as they get chosen, so you are always looking at the best robot still available.

Scouting well is a team-wide habit, not a one-person job. Get your data structure, your metrics, and your picklist process right, and you will out-strategize teams with flashier robots. For step-by-step templates and strategy breakdowns, head to our [Scouting and Strategy department](https://learnfrc.systemerr.com/guides/scouting-strategy).`,
  },
  {
    slug: "frc-gear-ratios-explained",
    title: "FRC Gear Ratios Explained",
    description: "A beginner-friendly guide to FRC gear ratios and drivetrain gearing: how reduction trades speed for torque, the free-speed formula, and how to pick a ratio.",
    keywords: ["FRC gear ratios","drivetrain gearing","gear reduction","drivetrain free speed","swerve gear ratio","FRC drivetrain calculator"],
    date: "2026-06-23",
    readMins: 5,
    content: `Picking a drivetrain gear ratio is one of the first real engineering decisions a rookie FRC team makes, and it is also one of the most misunderstood. This guide explains what a gear ratio actually does, how to estimate your robot's speed, and how to choose a ratio that fits your game.

## What a gear ratio actually is

A gear ratio describes how a gearbox trades motor speed for torque. When a small gear drives a larger gear, the output spins slower but with more turning force. The ratio is the relationship between input and output teeth. A 12-tooth gear driving an 84-tooth gear gives a 7:1 reduction: the output turns 7 times slower than the input, and produces roughly 7 times the torque (minus friction losses).

That word "reduction" is the key. Drivetrain gearboxes are almost always reductions, because motors spin far too fast to drive wheels directly. A modern FRC motor free-spins at several thousand RPM, and your wheels need to turn at a few hundred RPM. The gearbox bridges that gap.

One naming note that trips people up: WPILib and most simulation tools express the drivetrain gear ratio as output torque over input torque, so a reduction is written as a number greater than 1 (for example, 6.75:1). When you set up a drivetrain model in code, that is the convention to use.

## The speed-versus-torque tradeoff

You cannot get both high speed and high torque from the same gearing. Every ratio sits somewhere on that tradeoff:

- A lower reduction (numerically smaller) gives a faster top speed but less pushing force and slower acceleration.
- A higher reduction (numerically larger) gives more torque, better acceleration, and more pushing power, but a lower top speed.

This is why gearbox vendors like West Coast Products, REV, AndyMark, and Swerve Drive Specialties ship their drive gearboxes with several selectable ratios. REV's 3 inch MAXSwerve module, for example, includes gears for low, medium, and high speed configurations, and an upgrade kit adds even faster ratios. SDS sells the MK4i swerve module in L1 through L3 ratios, where L1 and L2 are the popular choices for a standard full-weight competition robot.

## How to estimate your robot's speed

You can predict a drivetrain's free speed (its theoretical top speed with no load) with one formula. In plain terms:

Free speed in feet per second equals motor free RPM, times an efficiency factor, divided by the total gear reduction, times wheel circumference in feet, divided by 60.

A few notes on the inputs:

- Motor free RPM: use the published no-load speed. Common FRC motors are the NEO at about 5676 RPM, the NEO Vortex at about 6784 RPM, the Falcon 500 at about 6380 RPM, and the Kraken X60 at about 6000 RPM at 12 volts (about 5800 RPM with FOC enabled).
- Efficiency factor: real gearboxes lose energy to friction, and a robot never runs at its theoretical max. Most teams multiply by roughly 0.80 to 0.85 to get a realistic number.
- Wheel circumference: that is wheel diameter times pi, converted to feet. A 4 inch wheel is about 1.05 feet around.

For a worked example, take a Kraken X60 at 6000 RPM, a 6.75:1 reduction, and a 4 inch wheel. Theoretical free speed is about 15.5 ft/s; after an 85 percent efficiency factor, you land near 13.2 ft/s, which is a sensible real-world target.

## Choosing a ratio for your game

There is no single correct ratio, only the right one for your robot and the year's game. Use these guidelines:

- Heavier robots and games with lots of pushing or defense favor more reduction (more torque).
- Open fields where you sprint between scoring locations favor less reduction (more speed).
- Most competitive swerve drivetrains land somewhere around 15 to 18 ft/s of free speed. REV's default MAXSwerve template, for reference, is set to 4.8 meters per second, which is roughly 15.7 ft/s.
- Do not chase the highest number. A drivetrain you cannot control, or one that browns out the battery under load, will lose matches that a slightly slower, well-tuned robot wins.

The fastest way to sanity-check a choice is a drivetrain calculator. Tools like ReCalc let you plug in your motor, ratio, wheel size, and robot weight to see free speed and current draw before you cut any metal.

For step-by-step help wiring all of this into an actual gearbox and chassis, our [Mechanical & Build guide](https://learnfrc.systemerr.com/guides/mechanical-build) walks through gearbox assembly, wheel selection, and drivetrain layout. If you are still mapping out your whole build season, the full [LearnFRC guides library](https://learnfrc.systemerr.com/guides) covers the surrounding topics too.

Ready to turn these numbers into a real drivetrain? Start with the [Mechanical & Build guide](https://learnfrc.systemerr.com/guides/mechanical-build).`,
  },
  {
    slug: "how-to-get-frc-sponsors",
    title: "How to Get FRC Sponsors: A Fundraising Guide",
    description: "A practical guide to funding your FIRST Robotics Competition team: where to find sponsors, grants like NASA and BAE, and how to ask the right way.",
    keywords: ["how to get FRC sponsors","robotics team fundraising","FRC sponsorship","FIRST Robotics grants","NASA FRC grant","FRC team budget"],
    date: "2026-06-23",
    readMins: 4,
    content: `Running a FIRST Robotics Competition team is expensive, and funding it is one of the least-glamorous but most important jobs on the team. The good news: thousands of teams do this every year, and there is a well-worn path for finding sponsors and grants once you know where to look.

## Know your number first

Before you ask anyone for money, figure out what you actually need. FIRST registration fees alone run roughly 6,000 to 6,500 US dollars for the season, and that is just to get into your first event. Once you add a second event, travel, materials, tools, and spare parts, total team budgets commonly land anywhere from 8,000 to 50,000 dollars or more depending on how far you travel and how much you build.

Having a real budget does two things: it tells you how hard you need to fundraise, and it makes your sponsorship pitch far more credible. Sponsors trust a team that can say exactly where the money goes. For help structuring a budget and the operations behind it, our [Business and Operations guide](https://learnfrc.systemerr.com/guides/business-operations) walks through the basics.

## Set up a way to receive donations

Most companies will only donate to a tax-exempt organization, and for good reason. In the US, mentors and parents should not personally accept donations on the team's behalf, because that can create real tax problems for them.

You have two clean options:

- Run the team under your school, so donations flow through the district or a school booster organization.
- Operate as, or partner with, a registered 501(c)(3) nonprofit so donations are tax-deductible.

Team 6328 maintains a widely-cited guide on establishing a 501(c)(3) specifically for FRC teams. Sort this out early, because a sponsor asking for a tax receipt is a good problem to have.

## Grants: the lowest-effort money

Grants are applications to foundations or programs, and several are aimed directly at FRC teams. A few worth knowing:

- NASA Robotics Alliance Project grants open applications in September with awards announced around November. They primarily target rookie, new, or year-two teams, the money is sent directly to FIRST to cover registration, and awards depend on congressional funding each year.
- BAE Systems offers a grant open to all US-based FRC teams.
- Boeing and Dow grants are often tied to having an employee mentor or being in their communities.
- John Deere and others fund teams associated with a school or 501(c)(3).

The full, current list lives on the FIRST Team Grant Opportunities page. Apply to everything you qualify for, and mark the September deadlines on a calendar now.

## Sponsors: where the real funding comes from

A grant is something you apply for; a sponsorship is a donation you directly ask a company for. The single most reliable source of sponsors is personal connections. Start with the employers of your mentors and parents, then local businesses, then larger companies in your region.

Be realistic about the numbers. Cold outreach to a company that has never heard of you converts at only about 2 to 5 percent. That same ask sent to a parent's employer or a past sponsor converts much higher. So spend your energy where the warm leads are.

When you reach out, lead with your team's story and be specific about the ask. Helpful tactics:

- Build sponsorship tiers (for example bronze, silver, gold) so companies can self-select a level, and spell out what each tier gets, such as a logo on the robot, the banner, or team shirts.
- Ask for in-kind donations too. Machine time, raw aluminum, electronics, lunch for a build night, or printing all reduce your budget without anyone writing a check.
- Keep a short business plan, around three to four pages, that explains your team, your impact, and your budget.

## Keep the sponsors you win

Retention beats recruitment every time. It is far easier to keep a sponsor than to find a new one, so treat existing sponsors well: send a thank-you, share season results, invite them to an event, and report back on what their money accomplished. A sponsor who feels appreciated tends to renew, and often increases their gift.

Fundraising is a year-round habit, not a kickoff-week scramble. Build the systems once and your future self will thank you. For deeper templates and operational checklists, head to our [Business and Operations guide](https://learnfrc.systemerr.com/guides/business-operations) and start building your sponsor list today.`,
  },
  {
    slug: "frc-drivetrain-types",
    title: "FRC Drivetrain Types: Tank, Swerve, and Mecanum",
    description: "A beginner-friendly guide to FRC drivetrains: how tank, swerve, and mecanum drives work, their tradeoffs, and how to pick one for your robot.",
    keywords: ["FRC drivetrain types","tank vs swerve drive","FRC swerve drive","mecanum drive FRC","differential drive WPILib","choosing an FRC drivetrain"],
    date: "2026-06-23",
    readMins: 4,
    content: `The drivetrain is the foundation of your robot - it decides how fast you move, how you maneuver around defenders, and how hard the rest of the build will be. If you are weighing tank vs swerve drive (or wondering where mecanum fits in), here is an honest, beginner-friendly breakdown of the three drivetrains you will see most in FIRST Robotics Competition.

## Tank (Differential) Drive

Tank drive, more formally called differential drive, is the classic FRC drivetrain and the easiest to build and program. You have wheels on the left side and wheels on the right side, and each side is driven together. The robot moves by sending different amounts of power to each side - drive both sides forward to go straight, and spin the sides in opposite directions to turn in place.

The tradeoff is simple: a tank drive cannot move sideways. To reach a spot to its left, it has to turn and then drive. In exchange you get a drivetrain that is cheap, rugged, easy to repair, and hard to get wrong - which is exactly why it is the standard recommendation for rookie teams.

In code, WPILib handles this with the 'DifferentialDrive' class, which gives you a few control styles:

- Tank drive: one joystick axis controls each side independently.
- Arcade drive: one input for forward/back speed, another for turning rate.
- Curvature drive: turning controls the radius of the turn, more like the steering wheel of a car.

If you are building your first robot, start here. Our [Mechanical & Build guides](https://learnfrc.systemerr.com/guides/mechanical-build) walk through laying out a solid differential chassis step by step.

## Mecanum Drive

Mecanum drive trades some of that simplicity for the ability to move in any direction. The trick is the wheels: each mecanum wheel has free-spinning rollers mounted at a 45-degree angle around its rim. Because the rollers (not the wheel itself) contact the floor, each wheel pushes at an angle instead of straight ahead.

Mecanum wheels come in pairs - two with rollers angled one way, two the other - and are mounted so that diagonally opposite wheels match (front-left matches back-right, front-right matches back-left). By driving the four wheels in the right combination, the angled forces add up or cancel out, letting the robot strafe sideways, drive diagonally, and rotate. That makes it a holonomic drivetrain: it can translate while rotating.

A couple of honest caveats. Because of friction in those rollers, a mecanum robot drives a little faster straight forward and back than it does sideways, and it tends to have less pushing power and traction than a comparable tank drive - a real disadvantage if a match involves shoving. WPILib supports it through the 'MecanumDrive' class, with cartesian and polar control and an optional gyro input for field-oriented driving.

## Swerve Drive

Swerve is the most capable drivetrain in FRC and now the most popular among competitive teams. Instead of fixed wheels, swerve uses an independent module at each corner of the robot. Every module has two motors: one to spin the wheel and one to steer it to any angle, plus an encoder so the code always knows which way the wheel is pointing.

Because each wheel can point anywhere, swerve can do something neither tank nor mecanum can do cleanly: translate in any direction while rotating to face wherever you want, all at full traction. That control is a huge advantage for dodging defense and lining up to score.

The cost is real complexity. Swerve needs roughly twice the drive motors of a tank drive (a typical four-module setup uses eight motors), it is heavier and more expensive, and it demands more maintenance and far more careful programming. WPILib treats swerve through its kinematics system rather than a single simple drive class - you describe the robot's desired motion as a 'ChassisSpeeds' object (forward, sideways, and rotational speed), and swerve kinematics converts that into a target speed and angle for each module.

Most teams do not machine their own modules. Commercial off-the-shelf options like Swerve Drive Specialties MK4, REV MAXSwerve, and WCP Swerve X2 (the successor to the now-legacy original Swerve X) are widely used and well documented, which has made swerve far more approachable than it was a few years ago.

## So Which Should You Pick?

There is no single right answer - it depends on your team's experience, budget, and time:

- New team, limited resources, or tight build timeline: tank drive. Reliable, affordable, and forgiving.
- Want omnidirectional movement without the full swerve commitment: mecanum, accepting the traction and pushing tradeoffs.
- Experienced team with the budget, programming depth, and time to maintain it: swerve, for best-in-class maneuverability.

Whatever you choose, get the fundamentals right - frame geometry, gear ratios, and wiring matter more than the drivetrain badge. Dig into the full [Mechanical & Build department on LearnFRC](https://learnfrc.systemerr.com/guides/mechanical-build) to plan and build your chassis the right way.`,
  },
  {
    slug: "frc-kit-of-parts-explained",
    title: "The FRC Kit of Parts, Explained",
    description: "What rookie FRC teams actually get in the Kit of Parts: the totes, drive base, KitBot, control system, and the Virtual Kit of software and vouchers.",
    keywords: ["FRC kit of parts","FRC rookie team kit","FRC drive base AM14U6","FRC KitBot","FRC virtual kit vouchers","FRC control system parts"],
    date: "2026-06-23",
    readMins: 4,
    content: `If you just registered a rookie FIRST Robotics Competition team, the "Kit of Parts" is one of the first things you will hear about, and one of the most misunderstood. Here is what it actually is, what rookies get that veterans do not, and what it does and does not cover.

## What the Kit of Parts actually is

The Kit of Parts (KOP) is the bundle of physical parts, a drive base, and digital resources that FIRST and its suppliers provide to registered teams each season. It is not a complete robot in a box. Think of it as a strong starting point: enough core hardware to build a basic driving robot, plus a pile of software licenses and vendor vouchers to fill in the rest.

The KOP comes in a few pieces. There is a season-specific box with game-related items that every team gets, one or more totes of mechanical and electrical components, a drive base chassis kit, and the Virtual Kit, which is the catalog of software and vouchers. You unlock the Virtual Kit at Kickoff, the event in early January where the new game is revealed.

## What rookie teams get that veterans do not

This is the part that confuses new teams. Rookies and veterans do not receive the same physical kit.

- Rookie teams receive a Gray Tote, sometimes called the Rookie Tote. It holds the harder-to-source, reusable components a brand-new team has never owned, things you keep and reuse year after year.
- Veteran teams also get that Black Tote of season-restock items, and only veterans are eligible to opt out of it in exchange for vendor vouchers; rookies keep the Black Tote plus the Gray Tote on top.
- Both rookies and veterans are offered the Drive Base Kit, the AM14U6 six-wheel chassis. Rookies cannot opt out of it; veterans can trade it for an AndyMark voucher because most already own a chassis.

So the rookie kit is deliberately heavier and more complete. FIRST front-loads the expensive, foundational parts to teams in their first year. If you are still figuring out how all of this fits together, our [Getting Started guide](https://learnfrc.systemerr.com/guides/getting-started) walks through the first-season basics.

## The control system inside the kit

The single most valuable thing in a rookie kit is a legal, working control system, the electronics that make the robot move. The core pieces are:

- A roboRIO, the main robot controller, often called the brain.
- A power distribution device (the REV Power Distribution Hub, CTRE Power Distribution Panel, or AndyMark Power Distribution Board are all legal options) to split 12V power across the robot.
- A VH-109 radio for wireless communication with the driver station.
- A Robot Signal Light (RSL), motor controllers, a 12V battery, and a main 120A breaker.

These are exactly the parts the game manual requires, so building from the kit keeps you legal without having to research every rule on day one.

## The KitBot and the drive base

The Drive Base Kit is the AM14U6 chassis, a rolling frame that a small group can assemble in about six hours or less, per FIRST's build guide. On top of that, FIRST releases a KitBot each season: a free set of instructions and a parts list for a simple, competitive robot built around that chassis. Many strong rookie teams build the KitBot in year one rather than designing something custom, because it reliably scores and gives you a working robot to practice driving. There is no shame in it, and it is genuinely good advice.

## The Virtual Kit: software and vouchers

A huge share of the kit's value is digital. The Virtual Kit includes free professional CAD software (options have included Autodesk Fusion, Onshape, SOLIDWORKS, and Mastercam), engineering tools like MATLAB, and a stack of vouchers and credits toward parts and manufacturing services such as laser cutting. The exact lineup changes every season, so always check the current Virtual Kit catalog at Kickoff rather than assuming last year's list.

One thing that is always free and never in a voucher: WPILib, the official open-source software you use to program the robot. Anyone can download it, no kit required.

## What the kit is not

The Kit of Parts will not, by itself, win you a regional. It gives you a drivetrain and electronics; the mechanisms that actually play the game, intakes, arms, shooters, and the like, are up to you to design, buy, or fabricate. Treat the kit as your foundation, not your finished robot, and plan a budget for the parts you will add on top.

New to all of this? Start with our [Getting Started guide](https://learnfrc.systemerr.com/guides) for a step-by-step path from unboxing the kit to a robot that drives.`,
  },
  {
    slug: "frc-drive-team-guide",
    title: "FRC Drive Team Guide: Roles and How to Win",
    description: "A clear, accurate guide to FRC drive team roles - drivers, coach, human player, and technician - plus practical tips for winning more matches.",
    keywords: ["FRC drive team roles","FRC driver and operator","FRC drive coach","FRC human player","FRC technician role","how to win FRC matches"],
    date: "2026-06-23",
    readMins: 4,
    content: `The drive team is the small group of people who actually run your robot during a match, and a great one can win games an average robot would lose. Here is exactly who does what and how the best teams turn those roles into wins.

## What counts as a drive team

In FIRST Robotics Competition, a drive team is up to 5 people from the same team who are responsible for that team's performance in a specific match. The official rule is strict on two points: it is a maximum of 5 people, and no more than 1 of them may be a non-student. Everyone else has to be a student. That single adult slot is usually used for the coach, which means students do almost all of the on-field work - which is the whole point.

The game manual defines four roles a drive team can fill: Drivers, Human Players, a Drive Coach, and a Technician. You do not have to fill all of them every match, but understanding each one is the foundation for getting better.

## The four roles

- Drivers (must be students): The people holding controllers and operating the robot. Importantly, only Drivers and Human Players are allowed to operate the robot - the coach cannot grab a controller mid-match.
- Human Players (must be students): The students who handle game pieces from the field perimeter - loading pieces into the robot, feeding them through a station, or scoring them by hand, depending on that season's game. Drivers and Human Players draw from the same pool of up to 3 student slots on the drive team - for example 3 Drivers and 0 Human Players, 2 and 1, or 1 and 2 - rather than each role getting its own 3.
- Drive Coach (1, any team member): The strategist and on-field leader. The coach calls the game, watches the whole field, and communicates with the two alliance partners. This is the role that most often uses the team's one non-student slot.
- Technician (1, any team member): The technical resource for pre-match setup, robot connectivity, operator console troubleshooting, and removing the robot after the match. The technician does not stand in the alliance station during play - they work from an event-designated area near the field and are not part of the in-match action.

## Driver vs. "operator": one robot, split controls

A common point of confusion: most teams run two people on controllers and call them the "driver" and the "operator," but the rulebook only uses the word Drivers. There is no separate official operator role. What is really happening is that the team splits robot control across two of its allowed driver slots. Typically:

- The driver handles base movement - driving around the field, lining up, playing defense or dodging it.
- The operator (also a driver) runs the mechanisms - intake, arm or elevator, shooter, and any auto-align or scoring sequences.

Splitting the controls this way keeps any one person from being overloaded, so the driver can focus on positioning while the operator focuses on scoring actions. It only works if those two people communicate constantly and practice together as a pair.

## How good drive teams actually win

The robot gets you to the field; the drive team decides what happens next. A few habits separate the alliances that win:

- Practice on real game tasks, not cones. Driving figure-eights around obstacles does not measure whether your operator can score under pressure. Practice the actual scoring cycles the game rewards.
- Pick a driver-operator pair, not two individuals. The best individual driver plus the best individual operator loses to two people who already work well together. Chemistry beats raw skill.
- Let the coach watch the whole field. Drivers should be heads-down on their robot. The coach tracks the clock, the other five robots, and when to switch from offense to defense or to set up the endgame.
- Plan with your alliance partners before the match. Coaches meet between matches and at the start to divide jobs - who scores where, who plays defense, who handles the endgame. A coordinated three-robot plan almost always beats three robots freelancing.
- Count on consistent cycles over hero plays. Reliable, repeatable scoring runs win more qualification matches than one spectacular highlight that only works half the time.

Drive team is a skill you build over a season, not a tryout you pass once. Rotate practice drivers early, keep notes on what each role struggled with, and treat every practice match like a scouting opportunity on yourselves.

Want role-by-role drills, controller layout ideas, and tryout templates? Dig into the full [LearnFRC Drive Team guide](https://learnfrc.systemerr.com/guides/drive-team) and the rest of the [LearnFRC guides](https://learnfrc.systemerr.com/guides) to get your whole drive team match-ready.`,
  },
  {
    slug: "pid-control-frc",
    title: "PID Control in FRC, Explained Simply",
    description: "A beginner-friendly guide to PID control in FRC: what kP, kI, and kD actually do, how to tune them, and why most teams skip the I term.",
    keywords: ["PID control FRC","FRC PID tuning","WPILib PIDController","kP kI kD tuning","FRC closed-loop control","tuning PID FRC"],
    date: "2026-06-23",
    readMins: 4,
    content: `If your arm overshoots its target, your drivetrain drifts off a straight line, or your shooter never quite hits the right speed, PID control is usually the tool that fixes it. It sounds intimidating, but the core idea is simple: measure how far off you are, and adjust your motors to close that gap.

## What PID actually means

PID is a feedback controller, which means it constantly compares where your mechanism is to where you want it to be. The difference between those two numbers is called the error. PID looks at that error and outputs a value to send to your motors. The name comes from its three terms, each of which reacts to the error in a different way.

- Proportional (P): contributes to the output in proportion to the current error. Big error, big push; small error, small push. This is the workhorse and does most of the job.
- Integral (I): adds up all the past error over time. The longer an error sticks around, the more the I term pushes to eliminate it.
- Derivative (D): reacts to how fast the error is changing. It acts like a brake, slowing the mechanism as it approaches the target so it does not blow past it.

Each term has a constant you tune, written as kP, kI, and kD. The controller multiplies each term by its constant and adds them together to get the final motor output.

## How it looks in code

In WPILib you create a 'PIDController' with your three gains, then call its 'calculate' method every loop. You pass in your current measurement first and your setpoint (the target) second, for example 'pid.calculate(encoder.getDistance(), setpoint)'. The number it returns is what you send to your motor. By default the controller assumes it runs every 20 milliseconds, which matches the standard robot loop, so you just call it once per cycle. If you are new to structuring this kind of code, our [programming and software guide](https://learnfrc.systemerr.com/guides/programming-software) walks through where this fits in a command-based robot.

## How to tune it

Tuning means finding kP, kI, and kD values that make your mechanism fast and stable. The standard manual process is straightforward:

1. Start with all three gains at zero.
2. Slowly raise kP until the mechanism reaches its target. Keep increasing until it just starts to oscillate (bounce back and forth around the setpoint), then back it off slightly.
3. If it still overshoots or oscillates, add a small amount of kD to dampen the motion. A well-tuned kP with a bit of kD handles the vast majority of FRC mechanisms.
4. Change one value at a time and watch the result before moving on. Tuning two gains at once makes it impossible to tell what helped.

A quick symptom guide: too little kP and the mechanism is sluggish or never reaches the target; too much kP and it oscillates or overshoots; kD that is too high makes the motion jittery or slow to start.

## Why most teams skip the I term

This trips up a lot of new programmers, so it is worth being clear: integral gain is generally not recommended for FRC use. Both the official WPILib documentation and REV Robotics advise against it for most mechanisms. The I term can introduce instability and a problem called integral windup, where accumulated error keeps building and causes a big delayed overshoot.

If your mechanism settles close to but not exactly on the target (steady-state error), the better fix is usually a feedforward controller rather than reaching for kI. Feedforward predicts the output your mechanism needs based on physics, instead of waiting for error to pile up. For modeling your system and getting solid starting kP and kD values automatically, the WPILib SysId tool is the recommended route and beats guessing by hand.

## Start simple

Do not overthink it. Begin with P only, add D if you see overshoot, and leave I alone unless nothing else works. Most FRC mechanisms are well controlled with a tuned kP, a touch of kD, and a feedforward term.

Want the full picture on closed-loop control, command-based structure, and writing clean robot code? Head over to the [LearnFRC programming and software guides](https://learnfrc.systemerr.com/guides/programming-software).`,
  },
  {
    slug: "frc-robot-design-process",
    title: "The FRC Robot Design Process, Step by Step",
    description: "A clear, beginner-friendly walkthrough of the FRC robot design process, from game analysis and strategic prioritization to prototyping, CAD, and iteration.",
    keywords: ["FRC robot design process","FRC strategic design","FRC game analysis","FRC build season","FRC prototyping","FRC CAD design"],
    date: "2026-06-23",
    readMins: 4,
    content: `Every January, thousands of FIRST Robotics Competition teams watch the same game reveal and then face the same question: what robot should we actually build? The teams that win consistently are rarely the ones with the flashiest mechanisms. They are the ones who follow a disciplined design process that starts with strategy, not with a CAD model.

Here is how that process works, step by step.

## Start with the game manual, not with ideas

When Kickoff drops in early January, you get the season's game video and a 100-plus-page game manual. The single most important thing you can do in week one is read it carefully, then read it again. Everything downstream, from your robot's drivetrain to its smallest bracket, follows from how points are scored.

As you read, write down every way to earn points and roughly how many points each is worth. This raw list of scoring opportunities is the foundation of what FRC mentors call strategic design, an approach popularized by people like Karthik Kanagasabapathy of Simbotics (Team 1114) in his widely shared "Effective FIRST Strategies" presentation.

## Rank the scoring opportunities

Now turn that list into priorities. For each scoring action, weigh two things: how many points it returns, and how hard it is for your team to do reliably given your budget, tools, and experience. This is a cost-benefit analysis.

A common method is to lay the scoring tasks out and sort them, putting the non-negotiables on one end:

- Driving and maneuvering well (every competitive robot needs this)
- The highest-value, most-achievable scoring tasks next
- "Nice to have" actions that you only attempt if time and resources allow

The goal is a ranked priority list, not a wish list. You almost never have time to build a robot that does everything.

## Choose consistency over capability

This is the principle experienced teams repeat the most: a robot that does one thing consistently beats a robot that does everything unreliably. Resources like FRCDesign.org and Game Manual 0 both stress that scoring reliably at a low or medium level usually earns more, and makes you a more attractive alliance pick, than scoring high but rarely.

So pick a focused set of capabilities you can actually nail, and resist the urge to bolt on a mechanism for every game element.

It is also worth knowing that FIRST provides an official KitBot each season, a baseline robot designed to play some part of the year's game. For newer teams, building and lightly iterating on the KitBot is a legitimate, competitive strategy rather than a fallback. You can learn more about turning priorities into mechanisms in the LearnFRC CAD and Design guide at https://learnfrc.systemerr.com/guides/cad-design.

## Settle the drivetrain early

Your drivetrain is the one subsystem every other part bolts onto, so decide it fast. The classic tradeoff is tank drive (simpler mechanically, electrically, and in code) versus swerve (far more maneuverable, but harder on all three fronts). Swerve has become much more accessible in recent years, but most teams who run it well practiced in the off-season first. Getting a solid drivebase locked in early frees the rest of the season for your scoring mechanisms.

## Prototype before you commit to CAD

Before you model a final mechanism, build rough, fast prototypes out of cheap materials like plywood, scrap aluminum, polycarbonate, and 3D-printed parts. The point is to answer questions quickly: does this intake grab the game piece? Does this arm reach high enough? Prototyping turns guesses into evidence, and it is far cheaper to fail with plywood than with machined aluminum.

## Move into CAD and refine

Once a prototype proves a concept, formalize it in CAD. A full robot model lets you check for collisions, confirm the design fits within the season's frame perimeter and height rules, plan wiring and packaging, and hand clean drawings to whoever is fabricating parts. Treat CAD as iteration, not decoration: expect to revise the model as you test. The LearnFRC CAD and Design department at https://learnfrc.systemerr.com/guides walks through the tools and conventions for this stage.

## Build, test, and iterate continuously

The formal build season runs about six weeks from Kickoff to your ship date, but most teams don't reach their first competition until several weeks after that, often in late February or March. Importantly, the old "bag and tag" and Stop Build Day rules ended after the 2019-20 season, so you can keep working on and improving your robot throughout the season. Use that freedom: build, test against real game tasks, find what breaks, and refine. A driver who has practiced for weeks on a finished robot is worth more than one extra mechanism added the night before bag-up used to happen.

## The short version

Read the manual, list and rank scoring opportunities, pick a focused and consistent strategy, lock the drivetrain, prototype cheaply, refine in CAD, then test and iterate. Strategy first, hardware second, every time.

Ready to turn your priority list into a real design? Start with the LearnFRC CAD and Design guide at https://learnfrc.systemerr.com/guides/cad-design.`,
  },
  {
    slug: "frc-autonomous-pathplanner",
    title: "FRC Autonomous with PathPlanner: A Beginner's Guide to Auto Routines",
    description: "Learn how FRC teams build autonomous routines with PathPlanner (PPLib): paths vs autos, AutoBuilder, named commands, odometry, tuning, and Choreo.",
    keywords: ["FRC PathPlanner tutorial","FRC autonomous programming","how to make autonomous FRC","PathPlanner FRC","command-based autonomous FRC","FRC auto routines"],
    date: "2026-06-24",
    readMins: 8,
    content: `The first 20 seconds of an FRC match happen with no driver at the controls. Your robot has to drive, aim, and score entirely on its own. For years, writing that autonomous code meant hand-tuning trajectories and hoping the math worked out. Today, most competitive teams reach for one tool first: **PathPlanner**. It lets you draw a path on a picture of the field, attach actions to it, and hand the whole thing to your robot as a single command. This guide walks you through how it works, from the GUI to the code, in plain terms.

## What PathPlanner actually is

PathPlanner is a **motion profile generator** for FRC robots, originally created by [team 3015](https://pathplanner.dev/home.html). It comes in two pieces that work together:

- The **PathPlanner GUI** — a desktop app (available on the Microsoft Store and as a [GitHub release](https://pathplanner.dev/home.html)) where you visually design paths on top of a field image.
- **PathPlannerLib (PPLib)** — a vendor library you add to your robot project that reads those path files and turns them into commands your robot runs.

The split matters. The GUI is where a student with no coding experience can lay out a route. PPLib is the code side that executes it. You design in one, you run in the other, and a feature called **hot reload** even lets you tweak a path in the GUI and push it to a running robot without redeploying code.

## Paths vs. autos: the core distinction

The single most important concept in PathPlanner is the difference between a path and an auto.

A **path** is one segment of motion — for example, "drive from the starting line to the first game piece." Paths are built from **waypoints**, which use Bézier-style **anchor points** (the exact spots the robot drives through) and **control points** (handles that shape the curve's heading and tightness). Each path carries **constraints**: max velocity, max acceleration, max angular velocity, and max angular acceleration, applied either globally or in **constraint zones** along the path.

An **auto** is a full routine that chains multiple paths together in sequence — "go to the piece, then go to the goal, then go back." Under the hood, [an auto is essentially a sequential command group](https://pathplanner.dev/gui-editing-paths-and-autos.html) made of path-following commands. Because paths are separate files, you can reuse one path across several autos. That modularity is the whole point: build a library of clean segments, then assemble different routines from them.

| Concept | What it is | Lives where |
|---|---|---|
| Path | One motion segment with waypoints + constraints | A \`.path\` file |
| Auto | A sequence of paths plus commands | A \`.auto\` file |
| Waypoint | Anchor + control points shaping the curve | Inside a path |
| Event marker | A trigger that fires a command mid-path | Inside a path/auto |

## Holonomic vs. differential

PathPlanner supports both major drivetrain types, and it treats them differently. **Holonomic** drivetrains (swerve) can translate and rotate independently, so paths let you set **rotation targets** — the robot can be spinning to face a target while it drives a curve. PPLib follows these with the [\`PPHolonomicDriveController\`](https://pathplanner.dev/pplib-build-an-auto.html).

**Differential** (tank) drivetrains can only point where they're driving, so rotation targets don't apply — heading is locked to the direction of travel. These use the \`PPLTVController\` instead. If your team runs swerve, you'll live in holonomic mode; if you run a tank or "west coast" drive, you're on the differential side.

## AutoBuilder: wiring PPLib to your robot

Before PPLib can drive anything, you have to tell it how *your* robot moves. That's the job of **AutoBuilder**, configured once (ideally in your drive subsystem's constructor). [\`AutoBuilder.configure()\`](https://pathplanner.dev/pplib-build-an-auto.html) takes, in order:

1. A **pose supplier** (\`this::getPose\`) that returns the robot's current \`Pose2d\`.
2. A **reset-pose** consumer (\`this::resetPose\`) that snaps odometry to a given pose at auto start.
3. A **robot-relative speeds supplier** (\`this::getRobotRelativeSpeeds\`) returning current \`ChassisSpeeds\`.
4. A **drive consumer** that takes \`ChassisSpeeds\` (and feedforwards) and commands the wheels.
5. A **path-following controller** — \`PPHolonomicDriveController\` for swerve.
6. A **\`RobotConfig\`** describing your robot's physical properties.
7. An **alliance-flip supplier** (more on that below).
8. The drive **subsystem** itself (\`this\`), so commands require it.

The controller uses **PIDConstants** to correct error while following. The docs' starting example uses \`new PIDConstants(5.0, 0.0, 0.0)\` for both translation and rotation — proportional gain of 5.0, no integral or derivative. You'll tune those later.

## RobotConfig: telling the math about your robot

\`RobotConfig\` (loaded with \`RobotConfig.fromGUISettings()\`) pulls the physical numbers you entered in the GUI: [robot **mass** in kg, **moment of inertia (MOI)**, **trackwidth**, wheel radius, drive gearing, wheel **coefficient of friction**, drive motor type, and drive current limit](https://pathplanner.dev/robot-config.html). PathPlanner uses these to generate trajectories that are actually achievable. The docs stress measuring your **true max drive speed** on the real robot — driving it in a straight line as fast as possible on a charged battery — rather than copying a theoretical spec (they suggest about 85% of the module's free speed only as a fallback when you can't measure). It encodes how much motor torque you can really use to accelerate.

## Named commands and event markers

Driving is only half of auto. You also need to intake, shoot, or score *while* moving. That's where **named commands** come in. In your code you register a command under a string name:

\`\`\`java
NamedCommands.registerCommand("intakeNote", intake.runIntakeCommand());
\`\`\`

Then in the GUI you drop an **event marker** on a path and type \`intakeNote\`. When the auto reaches that marker, PPLib looks up the registered command and runs it. One critical rule from [the docs](https://pathplanner.dev/pplib-named-commands.html): **named commands must be registered before you create any PathPlannerAuto or path**, so do your registration in \`RobotContainer\` right after subsystems are built. This is the seam where PathPlanner plugs straight into **command-based programming** — your navigation stays in the path files, your behaviors stay as reusable commands.

## How it ties into odometry and pose estimation

PathPlanner can only follow a path if the robot knows where it is. That knowledge comes from **odometry** — WPILib tracks position from wheel encoders and a gyro using classes like [\`SwerveDriveOdometry\` and \`SwerveDriveKinematics\`](https://docs.wpilib.org/en/stable/docs/software/kinematics-and-odometry/swerve-drive-odometry.html), updated every loop in your subsystem's \`periodic()\`. The \`getPose\` and \`resetPose\` methods you handed AutoBuilder are exactly the bridge to this system.

Odometry drifts over time, especially after contact. Many teams upgrade to a **pose estimator** (e.g. \`SwerveDrivePoseEstimator\`), which fuses encoder/gyro odometry with vision measurements from AprilTag cameras to stay accurate. If you want to go deeper on vision, our [programming track](https://learnfrc.systemerr.com/guides/programming-software) covers it.

## Alliance flipping and the field origin

FRC fields are mirrored between red and blue. PathPlanner keeps the [field coordinate origin on the blue side](https://pathplanner.dev/pplib-build-an-auto.html) and mirrors your paths for red. You design once, and the alliance-flip supplier — which returns \`true\` when \`DriverStation.getAlliance()\` reports Red — handles the rest. A common beginner bug is testing on blue, then watching the robot drive into a wall on red because flipping wasn't wired up.

## Selecting and running an auto

To let drivers pick a routine, AutoBuilder can build a dashboard chooser for you:

\`\`\`java
autoChooser = AutoBuilder.buildAutoChooser();
SmartDashboard.putData("Auto Chooser", autoChooser);
\`\`\`

\`buildAutoChooser()\` returns a \`SendableChooser\` pre-populated with every auto in your project (defaulting to \`Commands.none()\`). In \`autonomousInit()\`, you grab the selected command and schedule it.

## Pathfinding: paths you didn't draw

PPLib also generates paths on the fly using the **AD\\*** algorithm. [\`pathfindToPose\` and \`pathfindThenFollowPath\`](https://pathplanner.dev/pplib-pathfinding.html) let the robot navigate around obstacles to a target at runtime — useful for auto-aligning to a scoring location during teleop. The tradeoff: you give up control of heading at the start and end of an on-the-fly path, so it's less ideal for tank drives or precision approaches unless you chain it into a pre-planned path.

## Common pitfalls

- **Asking for the impossible.** PathPlanner will happily generate a path your robot physically can't follow. If the robot overshoots or cuts corners, lower your constraints or fix your \`RobotConfig\`.
- **Forgetting registration order.** Register named commands before creating autos, or the markers silently do nothing.
- **Skipping odometry verification.** If \`getPose\` is wrong, every path is wrong. Confirm your odometry tracks reality before blaming the path.
- **Untuned PID.** The default \`5.0\` P gain is a starting point, not a finish line.

## Choreo: the alternative

The main alternative is [**Choreo**](https://github.com/SleipnirGroup/Choreo), a time-optimal trajectory planner. The philosophy differs: Choreo solves for the fastest trajectory your robot can *actually* follow, cutting down on tweaking, while PathPlanner gives you more manual control at the cost of more tuning. Choreo trajectories are pre-generated and don't regenerate to match the robot's real starting state, and it can't do on-the-fly pathfinding. Helpfully, PathPlanner offers [Choreo interop](https://pathplanner.dev/pplib-choreo-interop.html), so you can use Choreo trajectories inside a PPLib workflow. Many teams use both.

Autonomous is where good programming wins matches. Start simple — one path, one named command — get it reliable, then build up. Ready to write the code? Dive into our [Programming track](https://learnfrc.systemerr.com/guides/programming-software).`,
  },
  {
    slug: "frc-vision-limelight-vs-photonvision",
    title: "FRC Vision: Limelight vs PhotonVision and AprilTag Tracking",
    description: "Compare Limelight and PhotonVision for FRC vision: AprilTag tracking, pose estimation with addVisionMeasurement, MegaTag2, latency, calibration, and cost.",
    keywords: ["Limelight FRC","PhotonVision FRC","FRC AprilTag tracking","FRC vision tutorial","Limelight vs PhotonVision","FRC vision processing"],
    date: "2026-06-24",
    readMins: 8,
    content: `Imagine your robot knowing exactly where it sits on the field — to the centimeter — the instant a match starts, then driving itself to score without a human touching a joystick. That is not science fiction in modern FRC. It is what a camera, a handful of printed **AprilTags**, and a few lines of code can do. Vision is the single biggest force multiplier a software-focused team can add, and the two systems almost everyone uses are **Limelight** and **PhotonVision**. This guide explains what each one is, how they track AprilTags, and how that data becomes a robot pose you can actually drive with.

## Why vision matters in FRC

Wheel encoders and a gyro give you **odometry** — a running guess of where the robot is based on how far the wheels have turned. The problem is drift: every wheel slip, every defender shove, every carpet seam adds error that compounds over a 2.5-minute match. By the time you reach the scoring zone, your "position" can be off by a foot or more.

Vision fixes this by giving the robot an *absolute* reference. There are two big jobs vision does:

- **Pose estimation** — figuring out the robot's exact field position by looking at AprilTags whose locations are published in advance.
- **Game-piece detection** — finding and aiming at the season's scoring object (a neural-network task, since game pieces have no convenient tag on them).

Get pose estimation working and you unlock auto-alignment, repeatable autonomous routines, and on-the-fly path correction.

## What are AprilTags?

[AprilTags](https://docs.wpilib.org/en/stable/docs/software/vision-processing/apriltag/apriltag-intro.html) are a visual fiducial system developed by researchers at the University of Michigan for low-overhead, high-accuracy localization. They look like simplified QR codes. Since 2024, FIRST has used the **36h11** family — a 6x6 grid of bits surrounded by a black-and-white border. FIRST places these tags at *known* positions around the field, so when your camera spots one, it can work backward to compute where the robot must be.

A single AprilTag detection gives you three things: the **tag ID**, a **3D pose** of the camera relative to the tag (this requires a calibrated camera), and the precise pixel locations of the tag's corners. WPILib bundles the official field positions in an \`AprilTagFieldLayout\`, loaded from a JSON file. For the 2026 *Rebuilt* season there are even two layouts — the **welded** field and the **AndyMark** field — because the two field constructions differ slightly.

One catch worth knowing early: **pose ambiguity**. With a single tag, multiple real-world camera positions can project to nearly the same corner locations in the image, so the math sometimes can't tell which is correct. The fixes are seeing multiple tags at once, fusing with odometry history, or telling the camera your robot's heading. Both Limelight and PhotonVision have features built around solving exactly this.

## Limelight: the hardware smart camera

[Limelight](https://docs.limelightvision.io/docs/docs-limelight/getting-started/summary) is a **smart camera** — a self-contained unit with a lens, image sensor, and an onboard processor that does all the vision math *inside the camera*. You configure zero-code pipelines for color blobs, AprilTags, and neural networks through a built-in web interface, then read results over NetworkTables. Nothing extra to assemble.

The current lineup includes the Limelight 3, 3A, 3G, and 4 (the older Limelight 2+ has been phased out of sale, though it still gets firmware updates for teams that already own one). The differences matter:

| Model | Image sensor | Best resolution / FPS | Built-in IMU |
|---|---|---|---|
| Limelight 3 | OV5647 color, rolling shutter | 90 fps @ 640x480 | No |
| Limelight 3G | OV9281 mono, global shutter | 120 fps @ 1280x800 | No |
| Limelight 4 | OV9281 mono, global shutter | 120 fps @ 1280x800 | Yes |

The jump to a **global shutter** sensor (3G and 4) is significant: global shutters capture the whole frame at once, so AprilTags stay crisp even when the robot is moving fast, while rolling shutters smear them. The [Limelight 4](https://docs.limelightvision.io/docs/docs-limelight/getting-started/limelight-4) also adds a built-in IMU (for the MegaTag2 algorithm described below) and supports a Hailo-8 accelerator for YOLOv8 object detection at up to 80 fps. Note the LL4 accepts a 3.3V-24V input (35V absolute maximum) but dropped Power-over-Ethernet support, so plan your wiring on the [electrical side](https://learnfrc.systemerr.com/guides/electrical) accordingly.

### MegaTag and MegaTag2

Limelight's localization secret sauce is **MegaTag**. The original [MegaTag (MT1)](https://docs.limelightvision.io/docs/docs-limelight/pipeline-apriltag/apriltag-robot-localization-megatag2) combines the corners of *all* visible tags into one pose, which beats averaging individual single-tag estimates and reduces ambiguity. **MegaTag2 (MT2)** goes further: if you feed it your robot's heading every frame via \`LimelightHelpers.SetRobotOrientation()\`, it produces a stable, ambiguity-free pose even from a *single* tag at long range. You read the result from the NetworkTables key \`botpose_orb_wpiblue\` (blue-origin coordinates) or through the helper \`getBotPoseEstimate_wpiBlue_MegaTag2()\`. The tradeoff: MT2 trusts the heading you give it, so your gyro must be accurate.

## PhotonVision: free software on a coprocessor

[PhotonVision](https://docs.photonvision.org/en/latest/docs/apriltag-pipelines/index.html) is free, open-source vision software you flash onto a small Linux computer — a **coprocessor** — that you supply yourself. Common choices are an **Orange Pi 5**, a **Raspberry Pi**, or a **Rubik Pi 3**, paired with a USB or CSI camera such as an Arducam OV9281. You get the same web-based tuning interface and AprilTag pipelines, but you pick the hardware, which means you control the cost and can run multiple cameras.

PhotonVision's answer to ambiguity is **MultiTag localization**: it solves a single Perspective-n-Point (PnP) problem across every visible tag's corners *on the coprocessor*, producing one robust field-relative pose. This is the recommended approach for all teams because it is the most accurate.

For **game-piece detection**, PhotonVision runs neural-network object detection, but only on coprocessors with a dedicated NPU (neural accelerator) — currently the Orange Pi 5 (using RKNN model format) and the Rubik Pi 3 (using TensorFlow Lite). The software ships with a season-specific model; for 2026 that detects the **FUEL** game piece. Frames are letterboxed to 640x640 before inference, and each detection returns a bounding box, a class, and a unitless confidence score from 0 to 1.

### PhotonPoseEstimator in code

On the robot side you use [\`PhotonPoseEstimator\`](https://docs.photonvision.org/en/latest/docs/programming/photonlib/robot-pose-estimator.html), one per camera. You construct it with the \`AprilTagFieldLayout\` and a \`Transform3d\` describing exactly where the camera sits relative to the robot center. The recommended strategy is **Coprocessor MultiTag** (via \`estimateCoprocMultiTagPose\`), which combines all visible tag corners; you can supply a fallback such as \`estimateLowestAmbiguityPose\` for when only one tag is visible. The estimate methods return an \`Optional<EstimatedRobotPose>\` — empty when no tags are visible — containing an \`estimatedPose\` (\`Pose3d\`) and a \`timestampSeconds\` for latency compensation.

## How vision feeds pose estimation

Both systems ultimately hand WPILib a *pose with a timestamp*, and WPILib fuses it with your odometry using a [pose estimator](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/state-space/state-space-pose-estimators.html). There are three, matched to your drivetrain: \`SwerveDrivePoseEstimator\`, \`DifferentialDrivePoseEstimator\`, and \`MecanumDrivePoseEstimator\`. They are drop-in replacements for the plain odometry classes and run a Kalman filter under the hood.

The pattern is two calls:

- \`update()\` — called **every loop** with your gyro and encoder data to track position continuously.
- \`addVisionMeasurement(pose, timestamp, stdDevs)\` — called **whenever a vision pose arrives** to snap odometry back toward the truth. It applies latency compensation automatically using the timestamp.

\`\`\`java
var result = photonEstimator.estimateCoprocMultiTagPose();
result.ifPresent(est ->
    swervePoseEstimator.addVisionMeasurement(
        est.estimatedPose.toPose2d(),
        est.timestampSeconds));
\`\`\`

The \`stdDevs\` (standard deviations) are how much you **trust** a measurement: smaller numbers mean "believe this more." A close, multi-tag measurement deserves low standard deviations; a far, single-tag one deserves high values so the filter leans on odometry instead. WPILib's defaults are 0.9 for vision x, y, and heading, versus 0.1 for the model states — so out of the box odometry is trusted more than vision. Tuning these well is what separates a robot that snaps cleanly to its target from one that jitters.

## Latency, mounting, and calibration

Three practical things make or break vision:

- **Latency** — vision data is always a little old. Always pass the real capture timestamp to \`addVisionMeasurement()\` so WPILib rewinds odometry to when the picture was actually taken.
- **Mounting** — the \`Transform3d\` from robot center to camera must match reality precisely; a few degrees of tilt error becomes large position error at distance. Mount the camera rigidly. Coordinate this with your [mechanical build](https://learnfrc.systemerr.com/guides/mechanical-build).
- **Calibration** — every camera+resolution combo must be calibrated to remove lens distortion before 3D poses are trustworthy. Both tools have guided calibration in their web UIs.

## Limelight vs PhotonVision: the comparison

| Factor | Limelight | PhotonVision |
|---|---|---|
| What it is | Hardware smart camera | Free software on your own coprocessor |
| Cost | Higher upfront (camera price) | Software free; pay only for Pi + camera |
| Ease of setup | Easiest — plug in and go | More setup (flash, wire, calibrate) |
| Flexibility | Fixed hardware | Choose camera, run many cameras |
| Pose algorithm | MegaTag / MegaTag2 | MultiTag PnP on coprocessor |
| Object detection | Built-in (Hailo on LL4) | NPU coprocessor only (Orange Pi 5 / Rubik Pi 3) |
| Best for | Teams wanting reliability fast | Teams wanting control and lower cost |

There is no wrong answer. Limelight gets a rookie team aiming at AprilTags in an afternoon. PhotonVision rewards teams willing to learn Linux with a cheaper, more flexible multi-camera setup. Both produce the same end product: a timestamped pose your \`SwerveDrivePoseEstimator\` can fuse.

Ready to wire vision into your robot code? Start with the [LearnFRC Programming track](https://learnfrc.systemerr.com/guides/programming-software).`,
  },
  {
    slug: "frc-motors-neo-kraken-falcon",
    title: "FRC Motors Compared: NEO vs Kraken X60 vs Falcon 500 vs NEO Vortex",
    description: "Compare FRC brushless motors: REV NEO, NEO Vortex, Kraken X60, and Falcon 500. Exact specs, FOC explained, and which motor to pick for drivetrain vs mechanisms.",
    keywords: ["FRC motor comparison","NEO vs Kraken","Falcon 500 vs Kraken X60","best FRC motor","NEO Vortex","FRC brushless motors"],
    date: "2026-06-24",
    readMins: 8,
    content: `Picking a motor used to be the easy part of designing an FRC robot. Now there are half a dozen serious brushless options (REV's NEO 2.0 and CTRE's compact Kraken X44 both joined the lineup for the 2026 season), two competing ecosystems, and a feature called FOC that sounds like a typo. This guide cuts through it with exact numbers straight from the manufacturers, so you can choose the right motor for your drivetrain and your mechanisms without guessing.

Every motor below is a **brushless DC motor**, meaning it uses electronic commutation (no carbon brushes to wear out) and needs a **motor controller** to spin. They split cleanly into two camps: REV Robotics motors (NEO family) that use a separate controller, and the CTRE/VEX motors (Kraken, Falcon) that have the controller built into the motor housing.

## The spec table

These numbers are pulled directly from the official documentation. Read them carefully: the headline "free speed" and "stall torque" describe opposite ends of a motor's behavior, and the difference between motors is bigger than it looks.

| Spec | REV NEO V1.1 | REV NEO Vortex | Kraken X60 (trap.) | Kraken X60 (FOC) | Falcon 500 |
|---|---|---|---|---|---|
| Free speed | 5676 RPM | 6784 RPM | 6000 RPM | 5800 RPM | 6380 RPM |
| Stall torque | 2.6 Nm | 3.6 Nm | 7.09 Nm | 9.37 Nm | 4.69 Nm |
| Stall current | 105 A | 211 A | 366 A | 483 A | 257 A |
| Free current | 1.8 A | 3.6 A | 2 A | 2 A | 1.5 A |
| Peak power | 406 W | 640 W | 1108 W | 1405 W | ~400 W (at 40 A) |
| Weight | 0.425 kg | 0.447 kg | ~0.544 kg | ~0.544 kg | 0.49 kg |
| Controller | SPARK MAX (separate) | SPARK Flex (separate) | Talon FX (integrated) | Talon FX (integrated) | Talon FX (integrated) |
| Encoder | Hall, 42 CPR | High-res, 7168 CPR | Integrated rotor sensor | Integrated rotor sensor | Integrated, 2048 CPR |

Sources: [REV NEO V1.1](https://docs.revrobotics.com/brushless/neo/v1.1), [REV NEO Vortex](https://docs.revrobotics.com/brushless/neo/vortex), [WCP Kraken X60 performance](https://docs.wcproducts.com/welcome/electronics/kraken-x60/kraken-x60-motor/overview-and-features/motor-performance), and the [CTRE Falcon 500 store page](https://store.ctr-electronics.com/products/falcon-500-powered-by-talon-fx).

The big story here is the Kraken. Its stall torque of **7.09 Nm** (trapezoidal) is nearly **three times** the NEO's 2.6 Nm and over 1.5x the Falcon's 4.69 Nm. That is why the Kraken became the dominant drivetrain motor almost immediately after its October 2023 release.

## How to read these numbers

A motor lives on a straight line between two extremes. At **free speed** it spins fastest but makes zero usable torque. At **stall** it makes maximum torque but isn't turning at all (and draws huge current). Real mechanisms operate somewhere in the middle.

- **Free speed (RPM)** sets your top-end. A faster motor lets you use a more aggressive gear reduction for the same wheel speed, or hit a higher max speed.
- **Stall torque (Nm)** is the muscle. More stall torque means quicker acceleration, more pushing force in a drivetrain shoving match, and the ability to hold a heavy arm against gravity.
- **Stall current (A)** is the catch. A Kraken in FOC mode can pull **483 A** at stall. You will never run that unlimited through a robot, your battery and the 40 A breakers won't allow it, so you set a **current limit** in code. That limit is one of the most important parameters you'll configure for the entire robot.

Because all of these motors are gearbox-fed, raw stall torque matters more than you'd think: a single high-torque motor can replace two weaker ones, saving weight, wiring, and a controller.

## What is FOC?

You'll notice the Kraken has two columns. **FOC** stands for **Field-Oriented Control** (also called vector control). Standard **trapezoidal commutation** energizes the motor coils in coarse six-step blocks. FOC instead continuously calculates the optimal current angle and drives the coils with smooth sinusoidal waveforms, keeping the magnetic field perfectly perpendicular to the rotor for maximum torque per amp.

The payoff is real: on the Kraken X60, FOC raises stall torque from 7.09 to **9.37 Nm** and peak power from 1108 to **1405 W**, at the cost of a slightly lower free speed (5800 vs 6000 RPM). CTRE describes FOC as delivering roughly a [15% increase in peak power](https://v6.docs.ctr-electronics.com/en/stable/docs/migration/new-to-phoenix.html) plus better efficiency and smoother, quieter low-speed control.

The important footnote for budgeting and rules: **FOC on CTRE motors requires a Phoenix Pro license**, purchased per-device through CTRE (or unlocked for a whole bus by licensing a CANivore). Without it, your Krakens and Falcons still run great in trapezoidal mode, you just don't get the FOC numbers. REV's NEO Vortex does not gate any performance behind a paid license.

## Controllers and the CAN bus

This is where the two ecosystems differ most.

**REV (separate controllers).** A NEO plugs into a **SPARK MAX** (\`REV-11-2158\`) and a NEO Vortex into a **SPARK Flex** (\`REV-11-2159\`). Both are rated at **60 A continuous and 100 A peak (2-second surge)** per the [SPARK Flex specs](https://docs.revrobotics.com/brushless/spark-flex/specs) and [SPARK MAX specs](https://docs.revrobotics.com/brushless/spark-max/specs). The separate-controller design means you mount and wire the controller somewhere on the robot, which costs space but makes the controller easy to swap if it fails. Crucially, the NEO Vortex pairs with the SPARK Flex to expose a high-resolution **7168 counts-per-revolution** encoder, far finer than the NEO's 42 CPR hall sensor.

**CTRE/VEX (integrated controllers).** The Kraken and Falcon have a **Talon FX** controller built into the back of the motor. One unit, fewer wires, and the controller and encoder are matched at the factory. The downside: if the integrated electronics fail, the whole motor is scrap.

Both ecosystems talk over the robot's **CAN bus**, the daisy-chained network connecting every motor controller to the roboRIO. CTRE additionally sells the **CANivore**, a USB-to-CAN FD adapter that creates a second, faster CAN FD bus. CAN FD carries larger frames at higher bandwidth, which reduces bus utilization and improves swerve odometry when you have a dozen-plus devices. Licensing a CANivore also unlocks Phoenix Pro features, including FOC, for every CTRE device on that bus. REV runs everything on the standard roboRIO CAN bus.

For wiring both ecosystems safely, every motor still needs its own breaker on the PDH/PDP and correctly gauged power leads, see the LearnFRC [Electrical guide](https://learnfrc.systemerr.com/guides/electrical).

## Which motor should you pick?

### Drivetrain

For a competitive swerve or tank drive, the **Kraken X60** is the current default. Its torque advantage means faster acceleration and a drivetrain that wins pushing matches, and the integrated Talon FX keeps the wiring clean. If you want maximum push, the FOC numbers are there (license permitting).

If you're already a REV team or want simpler licensing, the **NEO Vortex** is a strong, fully-open alternative: 640 W of peak power and that excellent 7168 CPR encoder make it very capable, even if it can't match the Kraken's raw stall torque.

### Mechanisms (arms, elevators, shooters, intakes)

This is where the standard **NEO V1.1** still earns its place, though teams starting fresh in 2026 should also weigh REV's newer **NEO 2.0**: at 364 g and 3.75 Nm of stall torque it's both lighter and torquier than the V1.1, while bolting onto the same SPARK controllers. Either motor is cheap and plentiful in FRC. For an intake roller, a wrist, or a light arm joint, 2.6 Nm of stall torque through a gearbox is plenty, and there's no reason to spend Kraken money on it. Many championship robots run Krakens on the drivetrain and NEOs everywhere else.

For high-torque mechanisms like a heavy elevator or a powerful shooter, a single Kraken or NEO Vortex can do the job of two NEOs, simplifying your CAD and your gearbox. Plan that reduction carefully in the [CAD](https://learnfrc.systemerr.com/guides/cad-design) and [Mechanical](https://learnfrc.systemerr.com/guides/mechanical-build) phases.

### A note on the Falcon 500

The **Falcon 500** was the motor that started the high-power brushless era, but VEX [stopped producing it](https://store.ctr-electronics.com/products/falcon-500-powered-by-talon-fx) and the store page has listed it as out of stock since the 2023 season, effectively replaced by the Kraken X60. Falcons are still competition-legal and use the same Talon FX/Phoenix software, so if your team has a bin of them, keep using them. Just don't plan a new robot around buying more, you can't.

## The bottom line

There's no single "best FRC motor," only the best fit. Krakens for the drivetrain and heavy mechanisms, NEOs for everything light, and the NEO Vortex if you want a license-free high-power option. Match the motor's torque to the job, set sane current limits, and you're most of the way to a reliable robot.

Ready to turn these motors into a working mechanism? Start with the LearnFRC [Mechanical Build guide](https://learnfrc.systemerr.com/guides/mechanical-build).`,
  },
  {
    slug: "frc-build-season-timeline",
    title: "FRC Build Season Timeline: A Week-by-Week Plan from Kickoff to Competition",
    description: "A practical week-by-week FRC build season timeline, from Kickoff and game analysis through prototyping, CAD, fabrication, wiring, programming, and driver practice.",
    keywords: ["FRC build season timeline","FRC build season schedule","FRC kickoff strategy","FRC week 1 checklist","FRC build season plan"],
    date: "2026-06-24",
    readMins: 8,
    content: `Six weeks. That is roughly how long you have between Kickoff and your first competition to design, build, wire, program, and practice with a competitive robot. It sounds impossibly short, and the first time you live through it, it is genuinely chaotic. But the best teams are not the ones with the most CNC machines or the biggest budgets. They are the ones with a **plan**. This is a week-by-week guide to spending those six weeks well, grounded in how the FRC season actually works today.

## How the build season really works now

For the 2026 **REBUILT presented by Haas** season, [Kickoff was Saturday, January 10, 2026 at noon Eastern](https://community.firstinspires.org/2026-just-a-few-days-until-kickoff), when *FIRST* revealed the game animation and unlocked the official game manual. From there, your "build season" runs until your first event, and competition events are spread across roughly seven weekends, typically beginning in early March and running into late April, with the FIRST Championship following about a week after the last regional/district event (always check the current season's official event calendar for exact dates).

Here is the single most important rule change to understand: **Stop Build Day and "bag-and-tag" are gone.** [*FIRST* retired them after the 2019-20 season](https://www.firstinspires.org/robotics/frc/blog/2020-rule-changes-stop-build-day) because teams without the resources to build a second practice robot were at a disadvantage. There is no longer a date where you must seal your robot in a bag and stop working. Your real deadline is the day you load the robot for your first competition. That means you can **iterate continuously** right up to (and between) events — a huge change from the old model that this timeline is built around.

*FIRST* posts **Team Updates** every Tuesday and Friday during the season; these can change rules mid-build, so read every single one.

## Week 1: Kickoff, game analysis, and strategy

This is the most important week, and almost none of it is spent building. Resist the urge to start cutting metal.

**Read the manual together.** Watch the Kickoff broadcast, then read the game manual as a team. The arena section and the scoring rules matter more than anything else right now. Note every way to earn points, every penalty, and the endgame.

**Do the scoring math.** Build a simple spreadsheet: how many points is each action worth, and how many can a realistic robot perform in the 2-minute-40-second match (in 2026's REBUILT, that is a 20-second autonomous period followed by 2:20 of driver-controlled teleop)? A robot that does one thing flawlessly almost always beats one that does five things poorly.

**Pick a strategy, then a robot.** Decide what role you want to play in an alliance before you design a single mechanism. Strategy drives design — not the other way around.

**Week 1 checklist:**
- Watch Kickoff and read the full game manual as a team
- Build a points-per-action scoring spreadsheet
- List the field's key dimensions, heights, and game-piece sizes
- Define your robot's "job" in one sentence (your **robot priority list**)
- Confirm the season's robot constraints in the current manual (for 2026, R103 limits the robot to **115 lb** excluding bumpers, R408 caps it at **135 lb** with bumpers, and R104 limits the starting configuration to a **110 in** maximum frame perimeter and a **30 in** starting height — always re-verify these against this year's manual, since they change)

If your strategy is solid, everything downstream gets easier. If you want a deeper structure for this, our [mechanical build guide](https://learnfrc.systemerr.com/guides/mechanical-build) walks through turning a strategy into a mechanism list.

## Week 2: Prototyping

Now you build — but you build *to learn*, not to keep. The goal of prototyping is to answer questions cheaply before you commit them to a real design.

Use **wood, scrap, polycarbonate, zip ties, and the kit motors** to mock up your hardest mechanisms. Can your intake actually grab the game piece? Does your shooter reach the target? Test the riskiest, most uncertain mechanism first, because that is the one most likely to force a redesign.

A common shortcut here is the official quick-start robot. The [REV ION FRC Starter Bot](https://www.revrobotics.com/ion/frc-starter-bot/) (and historically the AndyMark KitBot/Everybot) gives newer teams a proven, buildable drivetrain and basic scoring platform you can have driving in days, freeing time to prototype your custom mechanism.

**Week 2 checklist:**
- Prototype the highest-risk mechanism first
- Test with real (or accurate replica) game pieces
- Record what works with measurements, photos, and video
- Kill bad ideas fast — a failed prototype is a success, not a waste
- Start a parallel "drivetrain" track so a chassis is moving early

## Week 3: CAD and design freeze

By now your prototypes should have answered the big questions. This week you convert decisions into a real design.

**CAD the whole robot, not just the cool parts.** Model the drivetrain, mechanisms, electronics board, and battery location together so you catch collisions before they cost you a week of fabrication. Confirm everything fits inside the legal frame perimeter and height with bumpers attached.

The deadline that matters this week is a **design freeze** — a self-imposed date after which the geometry stops changing. Without it, designs drift forever and fabrication never starts. Because bag-and-tag is gone you can still refine details later, but the core architecture needs to lock now.

**Week 3 checklist:**
- Complete a full-robot CAD assembly with all subsystems
- Verify legal size, weight estimate, and bumper mounting
- Generate a Bill of Materials and order long-lead parts immediately
- Set and announce your design-freeze date
- Plan the **electronics layout** in CAD so wiring is not an afterthought

If CAD is new to your team, start with our [CAD design guide](https://learnfrc.systemerr.com/guides/cad-design) before this week, not during it.

## Week 4: Fabrication and assembly

Frozen design in hand, this is the loud week. Turn drawings into parts and parts into subsystems.

Split into parallel teams: one fabricates the drivetrain, another the main mechanism, another preps the electronics board. **Assemble subsystems independently** so they can be tested before final integration. Keep your BOM and CAD open as the source of truth — when a part does not fit, fix the model, not just the metal.

**Week 4 checklist:**
- Fabricate parts in priority order (drivetrain first — you cannot test code without it)
- Assemble and bench-test each subsystem in isolation
- Build and wire bumpers to the legal weight allowance
- Track remaining parts daily; chase down anything backordered
- Mount electronics on a board you can later move onto the robot

## Week 5: Wiring, programming, and integration

This is where teams that ignored programming and electrical all month get punished. The earlier those teams started on a test board, the smoother this week goes.

**Wire to spec.** Follow the official control-system layout: a roboRIO (or roboRIO 2.0) as the robot's brain, a REV Power Distribution Hub (or the legacy CTRE PDP) feeding the motor controllers, and the radio — the Vivid-Hosting VH-109 in 2026 — for driver-station communication. The [WPILib robot wiring guide](https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-1/intro-to-frc-robot-wiring.html) is the canonical reference — match it exactly during inspection.

**Integrate and program in parallel.** As subsystems land on the frame, get the drivetrain driving, then layer on mechanism control and your 20-second autonomous routine. Tools like [PathPlanner](https://pathplanner.dev) make building and tuning autonomous paths far faster than hand-coding them.

**Week 5 checklist:**
- Wire the full robot per the official control-system diagram
- Confirm every motor controller has a CAN ID and responds
- Get teleop driving, then tune each mechanism
- Build and test at least one autonomous routine
- Run the [official inspection checklist](https://www.firstinspires.org/resources/library/frc/season-materials) on your own robot

Programming and electrical move fastest when they start in Week 2, not Week 5 — see our [programming](https://learnfrc.systemerr.com/guides/programming-software) and [electrical](https://learnfrc.systemerr.com/guides/electrical) guides to get a head start.

## Week 6: Driver practice and continuous iteration

The robot exists. Now the difference between a good team and a great one is **practice and reliability**.

**Drive it, a lot.** Your drivers need real reps to develop muscle memory under match pressure. Run full 2:40 practice matches. Time your cycles. Find what breaks and fix it before a referee or an opponent finds it for you.

And here is where the post-2019 freedom pays off: because there is no bag, **you keep iterating**. Reinforce the part that snapped in practice. Re-tune the autonomous that missed. Add a feature you ran out of time for in Week 4 — then keep improving between competition events too.

**Week 6 checklist:**
- Run full-length practice matches daily
- Log and fix every failure (loose bolts, brownouts, dropped CAN devices)
- Build a pre-match checklist and a spare-parts kit
- Pack tools, batteries, and a laptop with your code backed up
- Keep a running "fix-it" list to work through between events

## The one rule that ties it all together

If you remember nothing else: **strategy first, building second.** A team that spends Week 1 deciding exactly what their robot must do, and then protects that decision through a design freeze, will out-build a faster, better-equipped team that started cutting metal on Kickoff night. The six-week clock is unforgiving, but a clear plan turns it from a panic into a process.

Ready to turn your strategy into real hardware? Start with our [Mechanical Build track](https://learnfrc.systemerr.com/guides/mechanical-build).`,
  },
  {
    slug: "frc-pneumatics-guide",
    title: "FRC Pneumatics: How to Design, Wire, and Program a Pneumatic System",
    description: "Complete FRC pneumatics guide: components, the REV Pneumatic Hub vs PCM, single vs double solenoids, safe wiring, WPILib programming, and the 60/120 psi limits.",
    keywords: ["FRC pneumatics tutorial","FRC pneumatics","FRC solenoid wiring","FRC pneumatics programming","REV pneumatics hub","how to use pneumatics FRC"],
    date: "2026-06-24",
    readMins: 9,
    content: `Push a button, and a piston shoots out in a fraction of a second with hundreds of pounds of force. No gears to strip, no motor to burn out, no PID loop to tune. That is the appeal of **pneumatics** in FRC: clean, fast, two-state motion that is almost impossible to break. This guide walks you through the whole system, from picking pneumatics over a motor, to the legal components, to wiring it safely, to controlling it in code with WPILib.

## When to use pneumatics (and when not to)

Pneumatics shine when a mechanism only needs to be in one of **two positions**: deployed or retracted, gripper open or closed, hood up or down. According to the [FIRST Pneumatics Manual](https://www.firstinspires.org/hubfs/web/program/frc/resources/pneumatics-manual.pdf), a pneumatic actuator moves simply and reliably to two locations without the sensors or current limiting a motor needs to hit a hard stop. They are also durable: you can stall an air cylinder against a load indefinitely with no damage, which is exactly what burns out a motor.

The catch is that pneumatics are **binary**. If you need a mechanism to stop at an arbitrary angle, hold a precise height, or move at a controlled speed, a motor (with an encoder) is the right tool. Air also runs out, you carry a fixed amount of stored pressure into a match, so a mechanism that actuates dozens of times can starve the system. The rule of thumb: pneumatics for fast on/off motion, motors for position control. For the motor side of that decision, see the [Mechanical track](https://learnfrc.systemerr.com/guides/mechanical-build).

How strong are they? The Pneumatics Manual notes a **2 inch bore cylinder can apply up to 188 pounds of force at 60 psi**, with no gearing or leverage at all. Force equals piston area times pressure, so bore size and pressure are your two design knobs.

## The core components

An FRC pneumatic system splits into a **high-pressure side** (around 120 psi) and a **working-pressure side** (under 60 psi). The [FIRST Pneumatics Manual](https://www.firstinspires.org/hubfs/web/program/frc/resources/pneumatics-manual.pdf) lists the required parts on the high-pressure side:

| Component | Job |
| --- | --- |
| **Compressor** | Compresses air to store in the system |
| **Pressure relief valve** | Vents excess pressure; must connect directly to the compressor via hard fittings |
| **Air storage tank(s)** | Hold compressed air for use during the match |
| **Pressure switch / analog sensor** | Tells the controller when to run the compressor |
| **Pressure gauges (x2)** | One for stored pressure, one for working pressure |
| **Vent plug** | Manually releases all stored pressure |
| **Primary regulator** | Steps pressure down from stored (120 psi) to working (60 psi) |

On the **working-pressure side** you have the parts that actually do work: the **solenoid valves** that switch airflow, the **pneumatic actuators** (cylinders), and optional extras like manifolds, downstream regulators, and **one-way flow controls** that throttle a cylinder's speed in one direction without reducing its force.

One important spec from the manual: solenoid valves typically need a **minimum of 15 to 30 psi** to actuate reliably (an additional regulator placed after the solenoid can bypass this minimum). If you regulate working pressure too low to save air, your valves may not shift.

## The pressure limits and safety

These numbers are not suggestions, they are inspected at every event, and getting them right keeps people safe. Per the [FIRST Pneumatics Manual](https://www.firstinspires.org/hubfs/web/program/frc/resources/pneumatics-manual.pdf) and the FRC Game Manual:

- **Stored pressure must be no greater than 120 psi.** The pressure switch and compressor closed-loop control keep the system at or below this; during validation the compressor should shut off by roughly 110-120 psi, and the relief valve should begin relieving around 120-125 psi so the system never significantly exceeds 125 psi.
- **Working pressure must be no greater than 60 psi**, provided through a single primary adjustable, relieving regulator. Additional regulators may sit downstream.
- **All high-pressure components must be rated to handle the full stored pressure the system can reach** (the ~120-125 psi at which the relief valve operates). Check the rating of every fitting, tank, and tube on the stored-pressure side.
- The **pressure relief valve must be connected and calibrated**, and your system must have a vent plug, a stored-pressure gauge, and a working-pressure gauge.

Always vent the system with the vent plug before you work on it, and never point a cylinder rod or an open fitting at anyone. Compressed air is energy, and a 188-pound piston does not care that you forgot to dump pressure.

## The control module: REV Pneumatic Hub vs PCM

The brain of the system is a CAN-based **pneumatics controller** that runs the compressor and switches the solenoids. There are two legal options.

The **REV Pneumatic Hub (PH, part REV-11-1852)** is the modern choice. Per the [REV Pneumatic Hub documentation](https://docs.revrobotics.com/ion-control/ph/specs), it provides **16 solenoid channels** (up to 16 single-acting solenoids, 8 double-acting, or a mix), switches user-selectable **12 V or 24 V** solenoids, and supplies up to **15 A continuous** to the compressor (with a 200 mA limit per solenoid channel). Its standout feature is a built-in **analog pressure sensor port** (for the REV-11-1107 sensor) alongside the digital pressure switch input, which lets you read actual PSI in code and set custom compressor thresholds. It also has a USB-C port that works with the REV Hardware Client for bench testing without a roboRIO.

The older **CTRE Pneumatics Control Module (PCM)** controls **8 solenoid channels** (8 single-acting or 4 double-acting) and uses a digital pressure switch only, with no analog sensing. It still switches 12 V or 24 V solenoids via a jumper. Both modules drive the compressor automatically once your code creates a solenoid or compressor object.

| Feature | REV Pneumatic Hub | CTRE PCM |
| --- | --- | --- |
| Solenoid channels | 16 (8 double) | 8 (4 double) |
| Analog pressure sensor | Yes (built-in port) | No |
| Solenoid voltage | 12 V / 24 V (switch) | 12 V / 24 V (jumper) |
| Default CAN ID | 1 | 0 |
| WPILib enum | \`PneumaticsModuleType.REVPH\` | \`PneumaticsModuleType.CTREPCM\` |

Remember: **all solenoids on a single module must be the same voltage.**

## Single vs double solenoids

A **single-acting (single) solenoid** has one electrical signal. Energize it and air flows; cut power and it springs back to its default state. This is your "default safe" choice, because when the robot is disabled the mechanism returns to a known position.

A **double-acting (double) solenoid** has two electrical signals, forward and reverse, and **holds its last commanded position** when power is removed. It needs an active signal to change states. Use a double solenoid when you want a mechanism to stay put even when disabled, like a climber that should not drop. In WPILib these map directly to the \`Solenoid\` and \`DoubleSolenoid\` classes.

## Wiring it safely

Per the WPILib guide on [Wiring Pneumatics with the REV Pneumatic Hub](https://docs.wpilib.org/en/stable/docs/hardware/hardware-basics/wiring-pneumatics-ph.html):

- The PH connects to the roboRIO over the **CAN bus** and gets 12 V power from the Power Distribution Hub (a 20 A port is recommended when the PH runs a compressor) or from the PDP.
- The **compressor wires directly to the PH's compressor connectors** (use 18 AWG or larger for long runs).
- The **digital pressure switch** connects to the digital input terminals with no polarity. The optional **analog sensor (REV-11-1107)** connects to analog port 0.
- Each **solenoid channel** is a numbered terminal pair; single-acting valves use one pair, double-acting valves use two. Set the **12 V / 24 V voltage switch correctly before powering on.**

For the broader robot electrical layout, see the [Electrical track](https://learnfrc.systemerr.com/guides/electrical).

## Programming pneumatics with WPILib

The [WPILib pneumatics API](https://docs.wpilib.org/en/stable/docs/software/hardware-apis/pneumatics/index.html) keeps this refreshingly simple. You construct a \`Solenoid\` or \`DoubleSolenoid\` with the module type and channel(s), then call \`set()\`.

A single solenoid in Java:

\`\`\`java
private final Solenoid m_solenoid = new Solenoid(PneumaticsModuleType.REVPH, 0);

m_solenoid.set(true);   // energize
m_solenoid.set(false);  // de-energize
m_solenoid.toggle();    // flip current state
\`\`\`

A double solenoid uses forward and reverse channels and the \`DoubleSolenoid.Value\` enum, \`kForward\`, \`kReverse\`, and \`kOff\`:

\`\`\`java
private final DoubleSolenoid m_double =
    new DoubleSolenoid(PneumaticsModuleType.REVPH, 1, 2);

m_double.set(DoubleSolenoid.Value.kForward);
m_double.set(DoubleSolenoid.Value.kReverse);
m_double.set(DoubleSolenoid.Value.kOff);
\`\`\`

Note from the docs: because a \`DoubleSolenoid\` defaults to \`kOff\`, you must \`set()\` it once before \`toggle()\` will work.

### Controlling the compressor

The [WPILib pressure docs](https://docs.wpilib.org/en/stable/docs/software/hardware-apis/pneumatics/pressure.html) explain that the \`Compressor\` runs in closed-loop mode by default, automatically filling the system when the pressure switch closes, and the docs explicitly recommend that teams not change this setting. You construct it with the module type:

\`\`\`java
private final Compressor m_compressor = new Compressor(PneumaticsModuleType.REVPH);
\`\`\`

The control methods are:

- \`enableDigital()\` — closed-loop control off the digital pressure switch (works on both PH and PCM).
- \`enableAnalog(minPressure, maxPressure)\` — uses the REV analog sensor to run the compressor between a custom PSI window (**PH only**).
- \`enableHybrid(minPressure, maxPressure)\` — combines the analog sensor and the digital switch (**PH only**).
- \`disable()\` — turns closed-loop control off.

Useful readbacks include \`getPressure()\` (PSI from the analog sensor, PH only), \`getCurrent()\`, \`getPressureSwitchValue()\`, and \`isEnabled()\`. For more on structuring this as a subsystem in command-based code, see the [Programming track](https://learnfrc.systemerr.com/guides/programming-software).

## Putting it together

A solid first pneumatic system is one compressor, one relief valve hard-fitted to it, a storage tank, a primary regulator set to 60 psi, two gauges, a vent plug, a pressure switch, and one double solenoid driving one cylinder, all run by a REV Pneumatic Hub. Get that working on a bench board first, leak-test it, and only then move it onto the robot. From there, adding a second cylinder is as easy as teeing into the pressure line and adding a few lines of code.

Ready to wire it up the right way? Start with the [LearnFRC Electrical track](https://learnfrc.systemerr.com/guides/electrical).`,
  },
  {
    slug: "frc-command-based-programming",
    title: "FRC Command-Based Programming: Subsystems, Commands, and the Scheduler",
    description: "A beginner-friendly guide to WPILib command-based programming in Java: subsystems, commands, the CommandScheduler, triggers, and composing commands.",
    keywords: ["FRC command-based programming","FRC subsystems and commands","CommandScheduler WPILib","FRC Java command based","command-based FRC tutorial"],
    date: "2026-06-24",
    readMins: 9,
    content: `If you've ever tried to control a robot with one giant \`while\` loop full of \`if\` statements, you already know how fast it turns into spaghetti. Command-based programming is WPILib's answer to that mess: a design pattern that lets you describe *what* your robot should do as small, reusable building blocks, and lets the framework figure out *when* to run them. It's the approach the vast majority of competitive FRC teams use, and once the mental model clicks, your code gets dramatically cleaner. This guide walks through that model in Java, grounded in the official [WPILib command-based docs](https://docs.wpilib.org/en/stable/docs/software/commandbased/what-is-command-based.html).

## The mental model: subsystems and commands

Command-based programming rests on two abstractions. Get these right and everything else follows.

A **subsystem** is an "independently-controlled collection of robot hardware (such as motor controllers, sensors, pneumatic actuators, etc.) that operate together." Think of it as one functional unit of your robot: the drivetrain, the arm, the intake, the shooter. A subsystem owns its hardware and its state.

A **command** is an action that runs over time. "Commands run when scheduled, until they are interrupted or their end condition is met." A command might drive the robot from joystick input, spin a flywheel up to speed, or run an arm to a setpoint.

The single most important rule that makes this work: **only one command can use (require) a given subsystem at the same time.** This is the core of command-based **resource management**. If the arm subsystem is busy running a "go to scoring position" command and you fire a "stow the arm" command, the scheduler resolves the conflict for you instead of letting two commands fight over the same motors.

## Writing a subsystem

In Java, you almost always subclass \`SubsystemBase\`. It gives you two big conveniences: automatic registration with the \`CommandScheduler\`, and a \`Sendable\` implementation so the subsystem shows up on dashboards.

\`\`\`java
public class IntakeSubsystem extends SubsystemBase {
  // Hardware is PRIVATE. The outside world never touches it directly.
  private final SparkMax m_motor = new SparkMax(5, MotorType.kBrushless);

  // Public methods expose ACTIONS, not hardware.
  public void run()  { m_motor.set(0.8); }
  public void stop() { m_motor.set(0.0); }

  @Override
  public void periodic() {
    // Called once per scheduler run (every 20 ms). Good for telemetry.
  }
}
\`\`\`

Notice the encapsulation: the motor is \`private\`, and the public surface is descriptive methods like \`run()\` and \`stop()\`. The official docs use the same pattern, hiding a \`DoubleSolenoid\` behind \`grabHatch()\` and \`releaseHatch()\`. There's also a companion \`simulationPeriodic()\` that runs only in simulation. Hardware setup like this is exactly where your [electrical](https://learnfrc.systemerr.com/guides/electrical) and [mechanical](https://learnfrc.systemerr.com/guides/mechanical-build) knowledge meets your code: the CAN IDs and motor types must match what's actually wired on the robot.

## Writing commands

You rarely need to write a full command class. WPILib's \`Commands\` utility class provides factory methods for the common cases:

| Factory | What it does |
|---|---|
| \`Commands.runOnce(action, reqs)\` | Runs a lambda once, then finishes (\`InstantCommand\`) |
| \`Commands.run(action, reqs)\` | Runs a lambda repeatedly until interrupted (\`RunCommand\`) |
| \`Commands.startEnd(start, end, reqs)\` | One lambda on start, another when it ends (\`StartEndCommand\`) |
| \`Commands.waitSeconds(t)\` | Ends after \`t\` seconds (\`WaitCommand\`) |
| \`Commands.waitUntil(condition)\` | Ends when a \`BooleanSupplier\` becomes true (\`WaitUntilCommand\`) |

A clean convention is to put **factory methods on the subsystem itself**, so the requirement is wired in automatically:

\`\`\`java
public Command runCommand() {
  // run() repeats the lambda; the trailing "this" adds the requirement.
  return run(this::run).finallyDo(interrupted -> stop());
}
\`\`\`

When you need the full lifecycle, extend the abstract \`Command\` class. Every command has four lifecycle methods:

- **\`initialize()\`** — called exactly once when the command is scheduled. One-time setup.
- **\`execute()\`** — called repeatedly (every 20 ms) while scheduled. Your control loop lives here.
- **\`isFinished()\`** — checked repeatedly; as soon as it returns \`true\`, the command ends.
- **\`end(boolean interrupted)\`** — called once when the command ends, whether it finished normally (\`interrupted == false\`) or was cancelled (\`interrupted == true\`). Clean up here, e.g. stop motors.

A command declares which subsystems it needs by calling \`addRequirements(...)\` in its constructor. That's the hook into resource management.

## Default commands

Every subsystem can have one **default command** that runs automatically whenever no other command is using that subsystem. The classic use is teleop driving: your drivetrain's default command reads the joysticks continuously, but it gets cleanly interrupted the moment an auto-align command grabs the drivetrain.

\`\`\`java
m_drivetrain.setDefaultCommand(
    m_drivetrain.run(() -> m_drivetrain.arcadeDrive(
        -driver.getLeftY(), -driver.getRightX())));
\`\`\`

One hard requirement straight from the docs: a **default command must require its subsystem**, and it must not finish on its own (a default command that ends gets immediately re-scheduled).

## Binding commands to triggers

You don't poll buttons in command-based — you *declare* bindings once, during initialization, and the library handles the rest. The foundation is the \`Trigger\` class, which represents a boolean condition. The easiest way to get triggers is the command-based HID classes like \`CommandXboxController\`:

\`\`\`java
CommandXboxController driver = new CommandXboxController(0);

// Schedule on the false -> true edge:
driver.a().onTrue(m_intake.runOnceCommand());

// Run while held, cancel when released:
driver.rightBumper().whileTrue(m_intake.runCommand());
\`\`\`

The key binding methods:

- **\`onTrue(cmd)\`** / **\`onFalse(cmd)\`** — schedule once on the rising/falling edge.
- **\`whileTrue(cmd)\`** — schedule when the trigger goes true, cancel when it goes false.
- **\`toggleOnTrue(cmd)\`** — schedule on a press, cancel on the next press.

Triggers compose like booleans with \`.and()\`, \`.or()\`, and \`.negate()\`, and you can clean up noisy inputs with \`.debounce(seconds)\`. You can also wrap *any* condition in a trigger — a limit switch, a sensor threshold, anything:

\`\`\`java
new Trigger(m_arm::atUpperLimit).onTrue(m_arm.stopCommand());
\`\`\`

(If you read older code that uses \`whenPressed\` or \`whenHeld\`, those binding methods on the deprecated \`Button\` subclass are gone — use \`onTrue\` and \`whileTrue\` instead.)

## Composing commands

The real power of command-based shows up when you stitch commands together. Compositions are themselves commands, so you can nest them freely.

| Composition | Factory | Finishes when… |
|---|---|---|
| Sequential | \`Commands.sequence(a, b, c)\` | the last command finishes |
| Parallel | \`Commands.parallel(a, b)\` | **all** commands finish |
| Race | \`Commands.race(a, b)\` | **any** command finishes (others cancelled) |
| Deadline | \`Commands.deadline(deadline, a, b)\` | the deadline command finishes |

Most of these also have **decorator** forms that read like English:

\`\`\`java
Command scoreThenStow =
    m_arm.toScoringPosition()
        .andThen(m_intake.ejectCommand().withTimeout(1.0))
        .andThen(m_arm.toStowPosition());
\`\`\`

Useful decorators: \`andThen(...)\` (run after), \`alongWith(...)\` (run in parallel), \`raceWith(...)\`, \`deadlineFor(...)\`, \`withTimeout(seconds)\`, \`until(condition)\`, \`unless(condition)\`, and \`repeatedly()\`. (If you see \`deadlineWith(...)\` in older code, it was deprecated in 2025 for removal — \`deadlineFor(...)\` is the current name.)

Two rules to internalize. First, **a composition inherits the union of its members' requirements** — so a parallel group of an arm command and an intake command requires both subsystems. Second, **a command instance can only be in one composition** (and can't be independently scheduled once it's in one); reusing the same instance throws an exception. When in doubt, build a fresh command from a factory each time.

## Where it all comes together: RobotContainer and the scheduler

A standard command-based project (generated from the WPILib template) has a \`Robot\` class, a \`RobotContainer\`, and a \`Constants\` class.

**\`RobotContainer\`** is where the declarative setup lives. Subsystems are declared as private fields, button bindings go in a \`configureBindings()\` method, and \`getAutonomousCommand()\` returns the command to run in autonomous.

**\`Robot\`** extends \`TimedRobot\` and stays tiny. The one line that makes the whole framework work is in \`robotPeriodic()\`:

\`\`\`java
@Override
public void robotPeriodic() {
  CommandScheduler.getInstance().run();
}
\`\`\`

That call drives everything, running at 50 Hz (once every 20 ms). Per the docs, each \`run()\` does four things in order: (1) calls \`periodic()\` on every registered subsystem, (2) polls all trigger/button bindings and schedules commands, (3) runs each scheduled command's \`execute()\` and checks \`isFinished()\`, ending finished commands, and (4) schedules default commands on any subsystem that's now free. You can also schedule and cancel commands manually with \`CommandScheduler.getInstance().schedule(cmd)\` and \`.cancel(cmd)\`, and note that a command's \`initialize()\` runs at *schedule* time, not on the next \`run()\`.

## Putting it together

The whole pattern is: subsystems own hardware and state, commands describe actions over time, triggers decide when commands fire, compositions glue actions into routines, and the \`CommandScheduler\` arbitrates who gets which subsystem. Start small — one subsystem with a default command and a couple of button bindings — and grow from there.

Ready to build your first command-based robot? Dive into the [LearnFRC Programming track](https://learnfrc.systemerr.com/guides/programming-software).`,
  },
  {
    slug: "frc-pid-tuning",
    title: "How to Tune PID on an FRC Robot: A Practical Guide",
    description: "A hands-on guide to tuning PID and feedforward on FRC mechanisms: a safe tuning order, fixing oscillation and steady-state error, and using WPILib SysId.",
    keywords: ["FRC PID tuning","how to tune PID FRC","FRC PID loop","FRC SysId","tune PID controller robot","WPILib feedforward"],
    date: "2026-06-24",
    readMins: 8,
    content: `Your arm slams past the setpoint and bounces. Your flywheel never quite reaches target RPM. Your drivetrain wobbles down the path like it had too much coffee. Almost every one of these is a tuning problem, not a code problem. The good news: you do not need control-theory math to fix them. You need a method, a feel for what each knob does, and the discipline to change one thing at a time. This guide gives you all three, grounded entirely in the official WPILib docs.

If you have not read the theory yet, skim our [PID overview on the Programming track](https://learnfrc.systemerr.com/guides/programming-software) first. This article is about the *practical* part: turning a twitchy mechanism into one that hits its target and holds.

## A 30-second refresher on P, I, and D

A **PID controller** drives an **error** (the difference between where you are and where you want to be, the **setpoint**) to zero by combining three terms. In WPILib these live in the \`PIDController\` class, and you read its output every loop with \`calculate()\`.

| Term | Gain | What WPILib says it does |
|------|------|--------------------------|
| Proportional | \`kP\` | Pushes the output toward the reference, proportional to current error. Acts like a "software-defined spring." |
| Integral | \`kI\` | Sums all past error to kill leftover **steady-state error**, the small gap P alone cannot close. |
| Derivative | \`kD\` | Responds to how fast the error is changing. Acts like a "software-defined damper" that slows the system as it approaches. |

That spring-and-damper picture is the whole intuition. **P** yanks you toward the target. **D** pumps the brakes so you do not blow past it. **I** nudges away the last stubborn sliver of error. Source: [WPILib's Introduction to PID](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/introduction-to-pid.html).

## The one rule: change one gain at a time

Before any numbers, internalize this. Tuning is a search, and if you move two knobs at once you can never tell which one helped. Set the others to zero, move one gain, watch the mechanism (a real-time plot of position or velocity vs. setpoint is gold), then move the next. Every procedure below follows this rule.

## A safe tuning order

WPILib's tuning walkthroughs are consistent: **feedforward first, then P, then D, then I sparingly.** Here is why that order is safe.

1. **Feedforward** does most of the work, so the PID has less to clean up.
2. **P** gives you responsiveness once feedforward has it close.
3. **D** tames the overshoot that aggressive P creates.
4. **I** is a last resort for stubborn steady-state error, because it is the easiest term to misuse.

Notice I is *last and smallest*. WPILib is blunt about this: "integral gain is generally not recommended for FRC use." We will come back to why.

## Feedforward: the part beginners skip (and shouldn't)

PID is **reactive**: it only acts after error appears. **Feedforward** is **predictive**: it computes the voltage a mechanism *should* need before any error shows up. For velocity control especially, this is not optional. As WPILib notes, a permanent-magnet DC motor's steady-state velocity is roughly proportional to applied voltage, so a good feedforward gets a flywheel almost exactly to speed on its own, leaving PID to trim small disturbances.

WPILib provides three feedforward classes. Each gain is a real, physical voltage, all per [WPILib's feedforward docs](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/controllers/feedforward.html):

| Gain | Physical meaning |
|------|------------------|
| \`kS\` | Volts to overcome **static friction**, just barely get it moving. |
| \`kV\` | Volts to **hold a constant velocity** (fights back-EMF and speed-dependent friction). |
| \`kA\` | Volts to produce a given **acceleration**. |
| \`kG\` | Volts to fight **gravity** (arms and elevators only). |

The classes and their models:

- \`SimpleMotorFeedforward(kS, kV, kA)\` for flywheels and drivetrains: \`V = kS·sgn(v) + kV·v + kA·a\`
- \`ElevatorFeedforward(kS, kG, kV, kA)\`: adds a constant \`kG\` because gravity always pulls down.
- \`ArmFeedforward(kS, kG, kV, kA)\`: gravity varies with angle, so the term is \`kG·cos(θ)\`, biggest when the arm is horizontal.

Note the argument order: the two gravity-aware classes take \`kG\` *second*, right after \`kS\`. Get the order wrong and your numbers go to the wrong terms. In code you add feedforward to PID each loop: \`motor.setVoltage(feedforward.calculate(targetVelocity) + pid.calculate(measuredVelocity, targetVelocity))\`.

## WPILib SysId: stop guessing your feedforward

You *can* find \`kS\`, \`kV\`, and \`kA\` by hand, but the **WPILib System Identification Tool (SysId)** measures them for you. It is the right starting point for any serious mechanism. SysId works in two parts: robot-side code runs your motor through a set of tests and logs voltage, position, and velocity; then the desktop app fits a model to that data. See [WPILib's SysId introduction](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/system-identification/introduction.html). It supports simple motors, elevators, and arms.

You define a \`SysIdRoutine\` with two objects (per [creating a routine](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/system-identification/creating-routine.html)):

- A \`Config\` that sets the **quasistatic ramp rate** (default 1 V/s) and the **dynamic step voltage** (default 7 V).
- A \`Mechanism\` with a voltage consumer (passes voltage to your motor controllers) and a log consumer (records the sensors).

It runs four tests, forward and reverse for each:

- **Quasistatic**: voltage ramps up *slowly* so acceleration is negligible. This isolates \`kS\` and \`kV\`.
- **Dynamic**: a constant step voltage is applied to capture acceleration behavior, giving \`kA\`.

Give SysId plenty of clear runway, because the mechanism *will* run on its own. The app then spits out \`kS\`, \`kV\`, \`kA\` (and \`kG\` for arms/elevators), plus diagnostic plots and even suggested feedback gains. Drop those numbers straight into your feedforward constructor.

## Symptoms and fixes

This is the table to keep open during practice. Match what you see to the cause.

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Fast oscillation / buzzing around setpoint | \`kP\` too high | Lower \`kP\` until oscillation stops. |
| Sluggish, slow to reach setpoint | \`kP\` too low | Raise \`kP\`. |
| Big overshoot then settles | Not enough damping | Add \`kD\`. |
| Settles just short of target forever | Steady-state error | First add/fix **feedforward**; only then a tiny \`kI\`. |
| Slowly grows worse / "winds up" and lurches | Integral windup | Reduce \`kI\`; use \`setIZone()\` or \`setIntegratorRange()\`. |
| Velocity setpoint never quite reached | Missing or low \`kV\` | Tune feedforward \`kV\`. |

A few of these deserve more than a row.

### Oscillation = too much P

Crank \`kP\` and the mechanism becomes a buzzing, overshooting mess. WPILib's procedure: raise \`kP\` until oscillation just appears, then back it off until it stops. That edge is roughly your sweet spot for P.

### Overshoot = needs D

Once P is responsive, you will often see it sail past the target before settling. \`kD\` is the damper: it pushes back the faster the error is closing, smoothing the approach. Add it gradually. One caveat from WPILib: for **velocity control with a constant setpoint, \`kD\` is not useful** (it is only needed when the setpoint is changing), so skip it on a flywheel.

### Steady-state error = feedforward first, then maybe I

If the mechanism parks slightly short of target and stays there, the textbook answer is "add I." In FRC the *better* first answer is "fix your feedforward." A correct \`kV\` (and \`kG\` on an arm or elevator) usually eliminates the gap with no integral at all. Only if a residual error remains should you add a **small** \`kI\`. WPILib's guidance across its arm and flywheel walkthroughs is the same: increase integral gain only when the output gets "stuck" before converging to the setpoint.

The reason for caution is **integral windup**: while error persists, the integral term keeps accumulating, and if the mechanism was stalled or saturated it can build up a huge correction that overshoots wildly once it frees. WPILib's \`PIDController\` gives you two guards: \`setIZone()\` (ignore the integral unless error is small) and \`setIntegratorRange()\` (cap how much the integral can contribute). Use them whenever you use \`kI\` at all.

## Position vs. velocity loops

The two big mechanism types tune differently:

- **Position loops** (an arm to an angle, an elevator to a height) care about *where* you end up. They use the full P + D, lean on \`kG\` for gravity, and benefit from \`setTolerance()\` plus \`atSetpoint()\` to know when you have arrived. For rotating mechanisms, \`enableContinuousInput()\` lets the controller wrap angles correctly.
- **Velocity loops** (a flywheel, drive wheels at a target speed) care about a *steady speed*. Here \`kV\` does the heavy lifting, \`kP\` trims disturbances, \`kD\` is skipped, and \`kI\` is rarely needed.

## Worked intuition for three mechanisms

**Flywheel (velocity).** Run SysId, get \`kS\`/\`kV\`, drop them into \`SimpleMotorFeedforward\`. WPILib's flywheel order: raise \`kV\` until the wheel approaches target over time (reduce it if it overshoots), then add \`kP\` until it oscillates and back off, add a touch of \`kI\` only if it sticks below target. No \`kD\`.

**Arm (position).** Use \`ArmFeedforward\` and tune \`kG\` first: increase it until the arm holds its angle against gravity with almost no motor effort. Then raise \`kV\` so it tracks slow, smooth motions. Now add \`kP\` until it responds sharply to a setpoint change, \`kD\` to smooth the approach and cut overshoot, and \`kI\` only if it stops short. This is straight from [WPILib's vertical arm tuning guide](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/tuning-vertical-arm.html).

**Drivetrain.** Each side is a velocity loop, so treat it like the flywheel: characterize with SysId for \`kS\`/\`kV\`/\`kA\`, run \`SimpleMotorFeedforward\`, then trim with a modest \`kP\`. Accurate drive feedforward is also what makes WPILib trajectory following and tools like PathPlanner track cleanly, because the path planner already knows the velocities to command. Get this right and your autonomous gets dramatically more repeatable.

## Putting it together

Tuning feels like dark art until you have a recipe. Yours is now: measure feedforward with SysId, add \`kP\` for response, \`kD\` for damping (not on velocity loops), and \`kI\` only as a guarded last resort. Change one gain at a time, watch a live plot, and let the symptom table tell you which knob to touch. Most FRC mechanisms tune in well under an hour once you stop guessing.

Ready to wire this into real subsystem code? Head to the [LearnFRC Programming track](https://learnfrc.systemerr.com/guides/programming-software) to build your first feedforward-plus-PID mechanism end to end.`,
  },
  {
    slug: "frc-java-vs-python-vs-cpp",
    title: "FRC Programming Languages: Java vs C++ vs Python",
    description: "An honest, beginner-friendly comparison of the three WPILib-supported FRC languages — Java, C++, and Python (RobotPy) — with vendor support and how to choose.",
    keywords: ["FRC Java vs Python","should I use Java or C++ FRC","RobotPy","best language for FRC","FRC programming language"],
    date: "2026-06-24",
    readMins: 7,
    content: `One of the first real decisions a new FRC team makes is which language to write robot code in. The good news: there is no wrong answer that will keep you off the field. WPILib officially supports three languages — Java, C++, and Python — and a robot written well in any of them can win events. The differences are about how easy the language is to learn, how fast your code runs, and how much help you can find when you get stuck. This guide breaks down all three honestly so you can pick the one that fits your team.

## The three officially supported languages

**WPILib** is the standard software library every FRC team uses to talk to motors, sensors, and the driver station. According to the [WPILib documentation](https://docs.wpilib.org/en/stable/docs/software/what-is-wpilib.html), Java, C++, and Python "were chosen for the officially-supported languages due to their appropriate level-of-abstraction and ubiquity in both industry and high-school computer science classes."

You may also hear about **LabVIEW**, a graphical language National Instruments historically supported for FRC. It still exists in the ecosystem, but the modern, actively documented path for new teams is one of the three text-based languages above, so that is where this guide focuses.

Here is the short version before we dig in:

| Language | Best for | Tradeoff |
| --- | --- | --- |
| **Java** | Most teams, especially new ones | Slightly slower than C++ (rarely matters) |
| **C++** | Teams wanting maximum control/performance | Manual memory management; easier to crash |
| **Python (RobotPy)** | Beginners and Python-first programs | Newer, smaller community; some vendor gaps |

## Java: the default for most teams

Java is the most popular FRC language and, for most teams, the recommended starting point. The WPILib docs put it plainly: "New/inexperienced users are encouraged to use Java." It hits a sweet spot between being readable and being safe — the language manages memory for you (so a forgotten cleanup will not silently corrupt your robot), and the compiler catches many mistakes before code ever runs.

The practical advantage of Java is the ecosystem around it. Because so many teams use it, the example code, tutorials, and Chief Delphi forum answers you will find are overwhelmingly in Java. Every vendor ships a polished Java library on day one, and WPILib's own example projects are published with official feature parity across Java, C++, and Python. When your robot misbehaves at 11 p.m. before a competition, having the largest pool of people who have hit your exact problem is worth a lot.

Java code interacts with WPILib classes like \`TimedRobot\`, \`CommandScheduler\`, and motor controller classes such as \`SparkMax\` (REV) or \`TalonFX\` (CTRE). Heads up that vendor class names drift between seasons — REV's controller class, for example, was renamed from \`CANSparkMax\` to \`SparkMax\` in the 2025 library, so older code you find online may use the previous name. Always confirm names against the current vendor docs. Either way, the overall structure you learn in Java carries over almost identically to the other two languages.

## C++: maximum performance, more responsibility

C++ is the choice for teams that want the absolute best performance and the most direct control over the hardware. The [WPILib docs](https://docs.wpilib.org/en/stable/docs/software/what-is-wpilib.html) describe the tradeoff well: C++ "offers better high-end performance, at the cost of increased user effort. Memory must be handled manually, and the C++ compiler does not do much to ensure user code will not crash at runtime."

That last part is the catch. In Java and Python, the language cleans up memory for you. In C++, you are responsible for it, and a mistake there can crash your robot code mid-match — exactly when you cannot afford it. Modern C++ has tools (like smart pointers) that make this much safer than it used to be, but it is still more to think about.

So who actually benefits? In practice, the **roboRIO** (the robot's main controller) is fast enough that a typical robot program written in Java runs perfectly well. The performance gap C++ offers mostly matters for unusually heavy computation — for example, running custom vision or control math on the robot itself. Many veteran programmers also simply prefer C++ because they like the control, or because their team has used it for years and has a mature codebase. If that is not you, the performance benefit alone is rarely a reason to choose C++ over Java as a new team. The same WPILib classes (\`TimedRobot\`, command-based framework, vendor motor classes) are all available in C++.

## Python (RobotPy): the most approachable, with caveats

Python became an **officially supported FRC language in 2024**, and it is the most approachable of the three for true beginners. The project that makes this work is **RobotPy** — a community of FRC mentors and students who maintain the Python bindings. Its documentation lives at [robotpy.readthedocs.io](https://robotpy.readthedocs.io/).

The biggest surprise for newcomers is performance. You might assume "interpreted Python must be slow," but the [RobotPy FAQ](https://robotpy.readthedocs.io/en/stable/faq.html) explains that Python is "fast enough" and "almost certainly just as fast as Java for typical WPILib-using robot code." The reason: RobotPy is a thin Python layer over the same native C++ WPILib that the other languages use. The heavy lifting happens in compiled C++; only your robot-specific logic is interpreted. So for normal robot code, performance is a non-issue.

Python's honest tradeoffs are elsewhere:

- **Crash safety.** Because Python is interpreted, the WPILib docs warn that "Python users should take care to test their program to ensure that typos and other issues don't cause robot crashes." A typo Java would flag at compile time can sneak through to the robot, so simulation and testing matter more.
- **Smaller, newer community.** The RobotPy FAQ notes that "because RobotPy is not yet widely adopted, bugs tend to be found during the first half of competition season." Fewer teams means fewer example projects and forum answers in Python.
- **Vendor coverage.** Most major vendors are now supported (more on this below), but Python support occasionally lags slightly behind the Java/C++ release, and a niche library may not have a Python version yet.

RobotPy also includes a robot simulator, so you can test logic on a laptop without the robot connected — important given the crash-safety note above.

## Vendor library support, by language

Your robot code is only as useful as the vendor libraries it can call. Here is where the three languages stand for the most common vendors:

| Vendor / Library | Java / C++ | Python (RobotPy) |
| --- | --- | --- |
| **CTRE Phoenix 6** (Kraken/Falcon, \`TalonFX\`) | Yes (vendordep) | Yes — official \`phoenix6\` on PyPI |
| **REV REVLib** (SPARK MAX/Flex) | Yes (vendordep) | Yes — RobotPy package |
| **PhotonVision** | Yes | Yes — \`photonlibpy\` |
| **PathPlanner** | Yes | Yes — \`robotpy-pathplannerlib\` |
| **navX** (IMU) | Yes | Yes — \`robotpy-navx\` |

CTRE provides an **official** Python distribution for Phoenix 6, installable with \`pip install phoenix6\` per the [Phoenix 6 install docs](https://v6.docs.ctr-electronics.com/en/latest/docs/installation/installation-frc.html). For Java and C++, you add Phoenix 6 and REVLib through WPILib's vendor-dependency (vendordep) system in VS Code, as described in the [WPILib third-party libraries guide](https://docs.wpilib.org/en/stable/docs/software/vscode-overview/3rd-party-libraries.html). The takeaway: the libraries most teams need exist in all three languages, but Java/C++ remain the most complete and earliest-updated. Exact package names and versions change each season, so check the current vendor docs before you install.

## How to choose

A few honest rules of thumb:

- **No programming experience on the team?** Start with **Java**. It is the WPILib-recommended default, it is what most schools teach, and you will find the most help.
- **Your team already knows Python (from a CS class or club)?** **Python/RobotPy** is a legitimate, officially supported choice — just lean hard on the simulator and testing to catch the typos a compiler would have caught.
- **You have an experienced programmer who wants maximum control, or an existing C++ codebase?** **C++** is great, as long as someone understands manual memory management.
- **Worried about performance?** For nearly every team, don't be. The roboRIO handles normal robot code in any of the three languages, and Python's native-C++ backing keeps it competitive with Java.

Whatever you pick, the concepts transfer. The command-based framework, \`TimedRobot\` structure, and PID control you learn in one language map directly onto the others, so a switch later is far easier than learning to program from scratch. Want a structured path from your first line of robot code to a competition-ready program? Start with the [LearnFRC Programming track](https://learnfrc.systemerr.com/guides/programming-software).
`,
  },
  {
    slug: "frc-software-tools",
    title: "The FRC Software Toolbox: Driver Station, Dashboards, AdvantageScope & SysId",
    description: "A beginner-friendly tour of the FRC software ecosystem beyond robot code: Driver Station, dashboards (Glass, Elastic, AdvantageScope), SysId, and vendor tools.",
    keywords: ["FRC AdvantageScope","FRC Elastic dashboard","FRC Driver Station","FRC software tools","FRC log analysis"],
    date: "2026-06-24",
    readMins: 8,
    content: `Writing robot code is only half the job. The other half is the constellation of desktop apps you use to deploy that code, drive the robot, watch what it's doing, and figure out why it just drove into a wall. Most of these tools are free, most ship with WPILib, and learning them early is one of the fastest ways to look like a veteran programmer at your first competition. Here's the toolbox, what each piece does, and when you actually reach for it.

## The FRC Driver Station: the one tool you can't skip

Everything starts here. The **FRC Driver Station** is the only software allowed to control the state of your robot during a match, and it's the program your drive team stares at all weekend. It ships inside the **FRC Game Tools**, a package distributed by **NI (National Instruments)** that also includes the **roboRIO Imaging Tool** and the LabVIEW runtime the Driver Station needs. The Game Tools run on **Windows 10 or 11 only** — there is no Mac or Linux build — so your drive laptop must be a Windows machine. You can grab it from the [FRC Game Tools install guide](https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/frc-game-tools.html).

What the Driver Station actually does, per the [WPILib Driver Station docs](https://docs.wpilib.org/en/stable/docs/software/driverstation/driver-station.html):

- **Enables and disables** the robot. A disabled robot cannot move; this is your single most important safety control.
- Selects the **operation mode**: \`TeleOperated\` runs your teleop code, \`Autonomous\` runs your auto routine, \`Practice\` cycles through the real match sequence (auto, then teleop, with the right timing), and \`Test\` runs test-only code that never runs in a real match.
- Reads your **joysticks and gamepads** and forwards their inputs to the robot.
- Shows four critical **status indicators** — Communications (is the laptop talking to the roboRIO?), Robot Code (is your program running?), Joysticks (is at least one controller detected?), and Battery Voltage with a live history plot.
- Logs everything. The Driver Station records match logs and a stream of errors and warnings you can replay later in the **Log File Viewer**.

You set your **team number** in the Setup tab; this tells the Driver Station the mDNS name to look for your roboRIO at. At a competition the field's **FMS (Field Management System)** takes over enabling and disabling, but the Driver Station is still the program that connects you to the field. If you learn nothing else, learn to read those four status indicators — most "the robot won't move" panics are solved by noticing which one is red.

## Dashboards: how you see what the robot sees

A **dashboard** displays live data from your robot — sensor values, camera streams, a chooser for which autonomous to run. FRC has several, and they fall into two buckets: **driver dashboards** (clean, glanceable, used behind the glass during a match) and **programmer dashboards** (dense, diagnostic, used at the bench). The [Choosing a Dashboard guide](https://docs.wpilib.org/en/stable/docs/software/dashboards/dashboard-intro.html) is the official starting point.

| Dashboard | Made by | Best for | Status |
|---|---|---|---|
| **Shuffleboard** | WPILib | Driver / programming | Removed for the 2027 season |
| **SmartDashboard** | WPILib | Driver | Removed for the 2027 season |
| **Glass** | WPILib | Programmer debugging | Active, bundled with WPILib |
| **Elastic** | Team 353 | Driver (behind the glass) | Active, bundled with WPILib |
| **AdvantageScope** | Team 6328 | Log analysis / diagnostics | Active, bundled with WPILib |

### Shuffleboard and SmartDashboard (legacy)

For years **Shuffleboard** and the older **SmartDashboard** were the default driver dashboards. They are now gone: the WPILib docs record that **both were removed for the 2027 season** — Shuffleboard for lacking a maintainer and having resource-utilization issues, and SmartDashboard because it relied on the old NetworkTables v3 protocol. If you're starting fresh today, learn Elastic instead — but you'll still see Shuffleboard in older tutorials and on veteran teams' laptops. (Removal timelines like this can shift, so when in doubt check the current WPILib documentation for the season you're on.)

### Glass — the programmer's microscope

**Glass** is WPILib's official data-visualization tool, and the docs are explicit that it's "meant to be used as a programmer's tool rather than a proper dashboard in a competition environment." It focuses on **high-performance real-time plotting** and pose visualization — the **Field2d** widget draws your robot's position on a top-down field, which is the single best way to debug odometry. You launch it from VS Code via the WPILib Command Palette. Reach for Glass when you want to watch a value change in real time while you tune something at the bench.

### Elastic — the modern driver dashboard

**Elastic**, built by **Team 353**, is the dashboard most teams now put in front of their drivers. The [Elastic docs](https://docs.wpilib.org/en/stable/docs/software/dashboards/elastic.html) describe it as a **drag-and-drop** dashboard of resizable card widgets, designed for "a high pressure competition environment." It reads data over **NetworkTables (NT4)**, automatically grabs the robot's IP from the Driver Station, supports camera streams, and offers a full-screen mode for behind-the-glass use. Use Elastic to build your driver's match view: an autonomous chooser, key sensor readouts, and a camera feed.

### AdvantageScope — logging and replay, the popular one

**AdvantageScope**, made by **Team 6328 (Littleton Robotics)**, has become the de-facto standard for FRC log analysis, and since the 2024 season it ships bundled inside the WPILib installer. The [AdvantageScope docs](https://docs.advantagescope.org/) call it a "robot diagnostics, log review/analysis, and data visualization application."

Its superpower is **replay**. During a live connection it streams **NetworkTables (NT4)** data; afterward it opens recorded logs so you can scrub back through a match and see exactly what every sensor reported, frame by frame. It reads an unusually wide range of formats — WPILib data logs (\`.wpilog\`), Driver Station logs, CTRE **Hoot** logs, and REV **REVLOG** logs among them. Its visualization tabs include line graphs, a **2D and 3D field** view with custom robot models, swerve vector displays, a joystick viewer, a console, and **synchronized video playback** so you can line up your match footage with the data. When the robot did something weird and you don't know why, AdvantageScope is how you find out. (It pairs especially well with the same team's **AdvantageKit** logging framework, though AdvantageKit is not required.)

## SysId: stop guessing your tuning numbers

Good control — smooth driving, an arm that holds position, an elevator that doesn't slam — depends on accurate **feedforward** constants. **SysId** (System Identification) is the WPILib tool that measures these for you instead of making you guess. Per the [SysId introduction](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/system-identification/introduction.html), it runs your mechanism through controlled tests, records the data, and fits a mathematical model.

You add a \`SysIdRoutine\` to your robot code (described in [Creating a Routine](https://docs.wpilib.org/en/stable/docs/software/advanced-controls/system-identification/creating-routine.html)) with a \`Config\` and a \`Mechanism\` object. SysId then runs two kinds of tests, each forwards and backwards — four tests in total:

- **Quasistatic** — the mechanism is sped up so slowly that acceleration is negligible.
- **Dynamic** — a constant step voltage is applied so you can measure how it accelerates.

From the logged data, SysId computes feedforward gains: **kS** (static friction), **kV** (velocity), and **kA** (acceleration) for every mechanism, plus **kG** (gravity) for arms and elevators that have to fight their own weight. You feed these numbers into WPILib's feedforward and \`PIDController\` classes. Run SysId once per mechanism early in the build season, write down the gains, and your closed-loop control gets dramatically easier.

## roboRIO Imaging Tool and vendor utilities

Two more categories round out the toolbox.

The **roboRIO Imaging Tool**, included in the NI Game Tools, flashes (images) the firmware on your **roboRIO** — the robot's main controller — and sets its team number. You run it once when you first set up a roboRIO, and again if a firmware update or a corrupted image ever requires it.

Your motor controllers and CAN devices have their own configuration apps:

- **REV Hardware Client** — REV's tool for updating firmware and configuring REV devices like the **SPARK MAX** and **SPARK Flex** motor controllers. The [REV docs](https://docs.revrobotics.com/rev-hardware-client) describe it auto-detecting connected devices and pulling the latest firmware.
- **CTRE Phoenix Tuner X** — CTR Electronics' app to "update, configure, analyze, and control" their CAN devices, including **Talon FX** controllers (the **Kraken X60** uses an integrated Talon FX), the **CANcoder**, and the **Pigeon 2** gyro. The [Phoenix 6 Tuner docs](https://v6.docs.ctr-electronics.com/en/stable/docs/tuner/index.html) cover firmware updates, assigning CAN IDs, self-tests, live plotting, and "blipping" a motor to confirm it's wired right. Tuner X runs on Windows, macOS, Android, and iOS.

Whenever you add a CAN motor controller or sensor to the robot, you'll open one of these to give it a unique **CAN ID** and update its firmware — a step that prevents a huge fraction of "device not found" errors. Note that exact part numbers and which devices a vendor supports shift each season, so confirm against the current vendor docs before a build.

## Putting it together

A typical workflow: image the roboRIO and set CAN IDs with the **Imaging Tool**, **REV Hardware Client**, and **Phoenix Tuner X**; deploy code and control the robot with the **Driver Station**; debug live at the bench with **Glass**; give your drivers a clean match view in **Elastic**; characterize mechanisms with **SysId**; and after every match, replay the logs in **AdvantageScope** to see what really happened. None of these require writing more robot code to use — they're force multipliers that make the code you already wrote far easier to get right.

Ready to put these tools to work? Start with our [Programming track](https://learnfrc.systemerr.com/guides/programming-software) to learn the robot code that feeds them all.`,
  },
  {
    slug: "frc-can-bus",
    title: "FRC CAN Bus Explained (and How to Fix Common Problems)",
    description: "How the FRC CAN bus works, the daisy-chain wiring with 120-ohm termination, avoiding device ID conflicts, and fixing the most common CAN failures.",
    keywords: ["FRC CAN bus","FRC CAN bus not working","FRC CAN ID conflict","roboRIO CAN","FRC CAN troubleshooting"],
    date: "2026-06-24",
    readMins: 8,
    content: `Almost every motor controller, your power distribution board, and most of your sensors talk to the roboRIO over a single pair of wires. That pair is the CAN bus, and when it works you forget it exists. When it breaks, your whole robot can go dark at once. The good news: CAN failures are extremely predictable, and almost all of them come down to four or five causes you can learn to spot in minutes. This guide explains what CAN is, how to wire it correctly, and exactly how to track down the most common problems with the same tools the pros use.

## What CAN is and why FRC uses it

**CAN** stands for Controller Area Network. It's a communication standard originally built for cars, where dozens of electronic modules need to share one network reliably in a noisy electrical environment. FRC adopted it for the same reason: instead of running a separate control wire to every device, every device shares one bus.

The big advantage is data and wiring. A CAN connection is daisy-chained from device to device, which usually means much shorter wire runs, and it carries far more information than the old PWM signal wires could. According to [WPILib's "Using CAN Devices" docs](https://docs.wpilib.org/en/stable/docs/software/can-devices/using-can-devices.html), CAN lets devices report rich telemetry back to the roboRIO, like motor temperature, current draw, and encoder position, all over the same two wires that carry commands out.

Devices that live on the CAN bus include CTRE **Talon FX** / Kraken motors, **CANcoder** and **Pigeon 2.0** sensors, REV **SPARK MAX** and **SPARK Flex** controllers, and your **Power Distribution Panel (PDP)** or **Power Distribution Hub (PDH)**.

## The daisy-chain and 120-ohm termination

CAN on an FRC robot is wired as a **daisy chain**. Per the [WPILib CAN Wiring Basics page](https://docs.wpilib.org/en/stable/docs/hardware/hardware-basics/can-wiring-basics.html), the wiring "should usually start at your roboRIO and go into and out of each device successively until finally ending at the PDP." There is no branching and no star topology. The signal flows in one continuous line from one end to the other.

CAN uses two signal wires, conventionally **yellow for CAN-High** and **green for CAN-Low**. Keeping the colors consistent across every device makes wiring mistakes obvious at a glance.

The most important and most misunderstood part is **termination**. A CAN bus needs a 120-ohm resistor at *each end* of the chain. These resistors absorb electrical reflections that would otherwise bounce back down the wire and corrupt your data. In FRC you usually don't add these yourself, because they're built into the devices at the two ends:

- The **roboRIO** has a 120-ohm terminating resistor built in. It sits at one end of the bus.
- The classic CTRE **PDP** ships with its termination jumper in the **"ON"** position, and WPILib recommends leaving that jumper on and placing the PDP at the *other* end of the bus, so it provides the second terminator. One catch: CTRE has discontinued that original PDP in favor of the **PDP 2.0**, which drops CAN bus connectivity (and the termination jumper) entirely, so it can't fill this role. If your board is a PDP 2.0, plan on ending the chain at a REV **PDH** instead (it has its own CAN termination switch) or adding a stand-alone 120-ohm resistor.

If you want the PDP somewhere in the middle of the chain instead, you must move its jumper to **"OFF"** and add your own 120-ohm resistor at the new end of the bus. CTRE's [CAN Bus Troubleshooting guide](https://v6.docs.ctr-electronics.com/en/stable/docs/troubleshooting/canbus-troubleshooting.html) puts it simply: there must be two 120-ohm resistors, one at each end.

### The 60-ohm test

Here's a trick worth memorizing. Two 120-ohm resistors at opposite ends of the bus are electrically in parallel, and two equal resistors in parallel give half the value. So a correctly terminated, **powered-off** CAN bus measures about **60 ohms** between CAN-High and CAN-Low. CTRE documents this directly: with the robot off, measuring CANH-to-CANL should read roughly **60 ohm**. If your meter reads close to **120 ohm**, only one terminator is in the circuit, meaning the other end (often the PDP) isn't connected through, or a hop in the daisy chain is broken. A multimeter and this one measurement will tell you more than an hour of guessing.

## Device IDs and avoiding conflicts

Every device on a CAN bus is addressed by a **device ID**. The roboRIO doesn't care where a device physically sits in the chain; it finds devices by their ID. The rule is simple but strict: **every device of the same type must have a unique ID** on that bus.

The exact range depends on the vendor, but they overlap closely:

| Vendor | Tool | Valid device ID range | Default out of box |
| --- | --- | --- | --- |
| CTRE (Talon FX, CANcoder, Pigeon 2.0) | Phoenix Tuner X | 0-62 | 0 |
| REV (SPARK MAX, SPARK Flex) | REV Hardware Client | 1-62 recommended | 0 |

[REV's documentation](https://docs.revrobotics.com/brushless/spark-max/control-interfaces) states plainly that "each device on the CAN bus must be assigned a unique CAN ID number" — give two SPARK MAX controllers the same ID and the roboRIO can no longer tell them apart. A common beginner trap: every new controller ships with **ID 0**, so the moment you put two fresh controllers on the bus, you have a conflict. Assign a unique ID to each device the first time you connect it. Many teams use a simple scheme, like numbering controllers 1-8 by mechanism, and write the ID on tape next to each one.

One nuance from the [WPILib CAN addressing docs](https://docs.wpilib.org/en/stable/docs/software/can-devices/can-addressing.html): the full CAN address also includes a device *type* and *manufacturer* field. That means a CTRE Talon FX with ID 1 and a REV SPARK MAX with ID 1 do **not** conflict, because they're actually the same device type (motor controller) but different manufacturers, and CAN's uniqueness rule is keyed off the manufacturer-plus-device-type combination together. The conflict rule applies within the same device type from the same manufacturer. When in doubt, give everything a unique number anyway. It's free insurance.

## Reading CAN utilization in the Driver Station

The [FRC Driver Station](https://docs.wpilib.org/en/stable/docs/software/driverstation/driver-station.html) has a built-in CAN health monitor. On the **CAN/Power tab** (the fifth tab down on the left side) you'll find:

- **CAN Bus Utilization** - the percentage of the bus's capacity currently in use. Lower is healthier; if you're pushing very high utilization, status frames can start to lag.
- **CAN faults** - counts of each of the four CAN fault types accumulated since the Driver Station connected. Rising fault counts are a strong signal that something on the bus is intermittent or miswired.

There's an important catch documented in WPILib's [Known Issues](https://docs.wpilib.org/en/stable/docs/yearly-overview/known-issues.html): the live utilization number "spikes" because the roboRIO occasionally counts CAN packets in the wrong time period, so one reading is too low and the next too high. The fix is to open the **DS log** afterward, zoom in, and read the *average* of the stable region. Don't panic over a single spike. The Diagnostics tab also lists **CAN Device Versions**, the firmware of connected devices, which is handy for confirming a device is actually being seen.

## The most common failures and how to diagnose each

Most CAN problems trace back to wiring, not code. The signature symptom is dramatic: because everything shares one line, a single bad spot can knock out *many* devices at once, and the devices "downstream" of the break vanish from your tools while upstream ones stay fine. That pattern is a gift, because it points you straight at the break.

| Failure | Symptom | How to diagnose / fix |
| --- | --- | --- |
| Loose or backed-out connector | Devices flicker offline; fault counts climb; problems come and go when the robot vibrates | "Tug-test" each crimped wire one at a time; gently flick/jostle harness sections while watching device LEDs and Tuner for red blips |
| Missing termination | Whole bus unreliable or dead; 120-ohm reading instead of 60 | Confirm PDP jumper is "ON" and PDP is at the end; measure ~60 ohm CANH-to-CANL with power off |
| Duplicate device IDs | Two devices "fight"; one disappears or behaves erratically | Phoenix Tuner X shows the device card in red with a conflict message; reassign IDs |
| Single broken wire | Everything downstream of the break is gone all at once | Locate the boundary between working and missing devices; that gap holds the fault |
| Swapped CAN-High/Low | Bus won't communicate at all | Verify yellow=CAN-High, green=CAN-Low at every connector |

**Diagnosing with Phoenix Tuner X (CTRE devices):** Connect to the roboRIO and open the device list. Every healthy CTRE device appears as a card. A duplicate ID shows up as a **red card with a conflict message** in the middle. To resolve a conflict, CTRE recommends isolating devices: wire the roboRIO to **one device only** (roboRIO to device to a 120-ohm terminator), confirm it appears, give it a unique ID, then repeat for the next device. Select a device's numeric ID field to change it.

**Diagnosing with the REV Hardware Client (REV devices):** Plug a USB cable into any SPARK MAX or the PDH and open the **Hardware tab**. Thanks to the USB-to-CAN bridge feature in SPARK MAX firmware, one USB-connected controller can surface the entire CAN bus, so you can see, configure, and update every REV device on the chain without cabling into each one. Set each device's CAN ID and update firmware from the same screen.

When you genuinely can't tell whether you have an ID conflict or a wiring fault, fall back to the isolation method. Strip the bus down to roboRIO plus one device, prove it works, then add devices back one at a time. The moment things break, the last device or wire you touched is your culprit. For a deeper look at building a clean, fault-resistant electrical board, see our [electrical track](https://learnfrc.systemerr.com/guides/electrical).

## What a CANivore is

As you add more high-performance devices, a standard CAN bus can get crowded. The **CANivore** is CTRE's answer. Per the [Phoenix 6 CANivore docs](https://v6.docs.ctr-electronics.com/en/stable/docs/canivore/canivore-intro.html), it's a multipurpose **USB-to-CAN FD** device that adds a *second*, separate CAN bus to the roboRIO. CAN FD ("Flexible Data-rate") improves on classic CAN with higher device bandwidth and faster transfers, which matters when you're running many high-update-rate motors and sensors.

Two practical wins for teams: you can split your devices across two buses to reduce load on each, and the CANivore has its own **built-in termination**, which makes it a handy bench tool. CTRE notes you can configure a single device on a short harness as **CANivore to device to a 120-ohm resistor**, giving you a known-good, properly terminated test setup away from the robot.

## The takeaway

CAN feels intimidating until you internalize three facts: it's one continuous daisy chain, it needs a 120-ohm terminator at each end (so ~60 ohm with power off), and every device of a type needs a unique ID. Master those, keep Phoenix Tuner X and the REV Hardware Client handy, and watch the Driver Station's fault counts, and you'll diagnose the vast majority of CAN problems before they ever cost you a match.

Ready to wire a bulletproof electrical system from scratch? Start with the LearnFRC [electrical track](https://learnfrc.systemerr.com/guides/electrical).`,
  },
  {
    slug: "frc-robot-rules-size-weight",
    title: "FRC Robot Rules: Weight, Size, and Bumper Limits Explained",
    description: "A beginner's guide to FRC robot weight, size, frame perimeter, extension, and bumper rules - with the recent-season numbers and why you must check the current manual.",
    keywords: ["FRC robot weight limit","FRC robot size limit","FRC robot rules","FRC bumper rules","FRC frame perimeter"],
    date: "2026-06-24",
    readMins: 8,
    content: `Every FRC robot has to live inside a box of rules before it ever touches a game piece. How heavy it can be, how big it can start, how far it can reach, and how its bumpers must be built - these constraints shape your entire design. Get them wrong and your robot fails inspection and never plays a match. Get them right and you have a safe, legal machine and the freedom to be creative inside the lines. This guide walks through each constraint, gives you the values from recent seasons so you know the ballpark, and - this is the important part - shows you why you must always confirm the exact numbers in the **current season's Game Manual**.

## The one rule that beats all the others: check the current manual

Here is the single most important thing to understand before any number in this article: **the robot construction limits change almost every season.** FIRST publishes a new Game Manual each January, and Section 8, *ROBOT Construction Rules (the "R" rules)*, is where weight, size, and bumper limits live. Those rules get revised game to game and even mid-season through **Team Updates**.

How much do they change? A lot. Compare just two recent seasons:

| Constraint | 2025 (Reefscape) | 2026 (Rebuilt) |
| --- | --- | --- |
| Max robot perimeter (starting) | 120 in | 110 in |
| Max starting height | 3 ft 6 in (42 in) | 30 in |
| Max horizontal extension | 1 ft 6 in (18 in) | 12 in |
| Weight without bumpers | 115 lb | 115 lb |

Same program, back-to-back years, and the size box shrank dramatically. That is exactly why you should treat every number below as "roughly this in recent seasons" and never as a permanent fact. Always open the [current FIRST Game Manual](https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system) and read Section 8 for yourself. Rule numbers like \`R103\` or \`R405\` are stable handles, but the values attached to them are not.

## Weight: lighter than you think

In recent seasons the headline weight limit has been about **115 lb (~52 kg)** for the robot *excluding* bumpers and *excluding* the battery. In the 2026 manual this is rule \`R103\`: "The ROBOT weight must not exceed 115.0 lb." (2026 also excludes the battery and the field location-detection tags from that figure.)

Two details trip up rookies:

- **Bumpers and battery are weighed separately or excluded** from the base limit. Recent manuals also cap the robot *with* bumpers - in 2026, rule \`R408\` sets that at **135.0 lb (~61 kg)**. So your bumper set effectively gets its own ~20 lb budget on top of the robot.
- Some seasons add a **total inspected weight** for robots with swappable mechanisms. Always check whether the current game allows interchangeable parts and what the combined cap is.

Practical takeaway: weight is a budget you spend, not an afterthought. Heavy steel hardware, oversized gearboxes, and a tank-like superstructure add up fast. Teams that weigh subassemblies in CAD (Onshape reports mass automatically) almost never get a nasty surprise at the scale. Learn that workflow on our [CAD design track](https://learnfrc.systemerr.com/guides/cad-design).

## Size and the frame perimeter

Your robot's footprint is governed by the **frame perimeter** (recent manuals call it the **ROBOT PERIMETER** - the name changed from FRAME PERIMETER in 2025). This is one of the most important concepts in the whole rulebook, so it's worth slowing down.

### What the frame perimeter actually is

The frame perimeter is the outline formed by the **fixed, non-articulated structural elements** of your robot while it sits in its **starting configuration**, measured *excluding* bumpers. Crucially, it is the **convex hull** of those parts - imagine stretching a rubber band tightly around your robot's base. If you build a U-shaped frame, the perimeter is the rubber band that closes off the mouth of the U, turning it into a D. Concave notches do not count as "inside."

Tiny bumps don't count either: **minor protrusions of 0.25 in or less** - bolt heads, rivets, fastener ends, weld beads - are excluded from the perimeter. This is why your CAD team draws a clean perimeter sketch first and builds the frame to match it.

### The size box

In recent seasons, the **starting configuration** has had two limits:

- A maximum **perimeter length** (the total distance around that rubber band) - 120 in in 2025 (\`R104\`), reduced to 110 in in 2026.
- A maximum **starting height** - 42 in in 2025, dropped to 30 in in 2026 (\`R104\`).

In the starting configuration, **nothing may stick out past the vertical projection of the frame perimeter** except the bumpers and those minor protrusions (in 2026 this is rule \`R102\`). In other words, at the start of the match your whole robot - arms folded, elevator down - must fit inside its own footprint.

## Extension during the match

Once the match begins, most seasons let you reach *beyond* the frame perimeter, but only by a limited amount. Recent rules have capped **horizontal extension** at 18 in beyond the vertical projection of the perimeter in 2025, tightened to 12 in in 2026 (\`R105\`). There is also a **height ceiling** you may not exceed even when extended - 30 in throughout 2026 (\`R107\`).

Some games add their own extension twists (a single side that can extend, or no extension at all in certain zones), so the game-specific rules in Section 6 can override or layer on top of the general \`R\` rules. The design lesson: a mechanism that has to reach far horizontally - an intake, a scoring arm - must be planned around the current extension limit from day one. Our [mechanical build track](https://learnfrc.systemerr.com/guides/mechanical-build) covers how to size linkages and elevators against these limits.

## Bumpers: the rules people most often get wrong

Bumpers exist to protect robots from each other. They are *mandatory*, and inspectors scrutinize them hard. The bumper rules (the \`R4xx\` series in recent manuals) cover where bumpers sit, how they're built, how much they can stick out, and what color they are.

### The bumper zone

Bumpers must fill the **bumper zone**, a horizontal band measured up from the floor. In 2025 and 2026 (\`R405\`) that zone has been **2.5 in to 5.75 in (~63 mm to ~146 mm)** from the ground. Your backing and padding have to fully occupy that band so that two robots colliding hit padded bumper, not bare frame.

### Construction: backing, padding, and cover

Recent manuals (rule \`R402\`) require, in essence:

- **Rigid backing** - traditionally a wood board such as plywood - tall enough to support the padding across the bumper zone (in 2026 the backing must be at least about 4.5 in tall).
- **Soft padding** in front of the backing. The 2026 rules require a minimum padding depth (about 2.25 in) and call out approved materials: solid pool noodle, backer rod, foam floor tiles, closed-cell polyethylene foam (including crosslinked), or closed-cell EVA foam. Note a real 2026 change - **hollow pool noodles are no longer allowed**; the foam must be solid or closed-cell.
- A **cloth cover** over the padding.

This is exactly the kind of detail that shifts. Always read the current \`R402\` for the approved materials list and minimum dimensions before you cut anything.

### How far bumpers stick out

Recent rules cap how far the **hard parts** of a bumper can extend from the frame perimeter at **1.25 in (~31 mm)** (2026 \`R404\`), with the padding required to extend further beyond any hard part - at least 2.0 in in 2026 - and an overall bumper-extension cap (4.0 in in 2026, \`R403\`). The point: the soft stuff, not the wood or bolts, should be what makes contact.

### Coverage and corners

Bumpers must protect the **entire frame perimeter** (\`R401\`). Small gaps between segments are tolerated within limits - in 2026, gaps under about 1.25 in are allowed - and corners get special attention. Recent rules require corner joints to be filled with uncompressed padding extending a set distance from each corner (at least 2.25 in in 2026, \`R406\`), and limit how large any single gap can be while still protecting a minimum length of perimeter on each side of every corner (about 5 in per side in 2026, \`R401\`). Exposed corners are a classic inspection failure.

### Alliance color and mounting

Two more durable requirements:

- **Alliance color:** every robot must be able to show **red or blue** bumpers to match its alliance for a given match (\`R411\`). Most teams build two swappable sets or reversible covers.
- **Mounting:** bumpers must be **fixed relative to the frame perimeter** (\`R409\`) and designed for quick install and removal so inspectors can weigh and check the robot - the manual's guidance has been that two people should be able to swap them in just a few minutes.

## Designing inside the box

The teams that thrive treat these constraints as the *first* design input, not a final-week scramble. Sketch your frame perimeter in CAD before building, budget weight by subassembly, plan your reach against the extension limit, and build bumpers to spec the first time. Read the [FIRST Game Manual](https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system) Section 8 every season, follow the Team Updates, and confirm every number - because as you've seen, they really do change.

Ready to start building a legal, competitive frame and bumper set? Dive into our [mechanical build track](https://learnfrc.systemerr.com/guides/mechanical-build).`,
  },
  {
    slug: "frc-onshape-tutorial",
    title: "FRC Onshape Tutorial: How to CAD Your First Robot Part",
    description: "A beginner Onshape tutorial for FRC: sign up free, learn Part Studios and Assemblies, sketch and extrude your first part, and pull in COTS parts.",
    keywords: ["Onshape FRC tutorial","how to use Onshape for FRC","FRC CAD for beginners","Onshape sketch extrude","FRC Onshape"],
    date: "2026-06-24",
    readMins: 8,
    content: `Every robot starts as a drawing before it becomes metal. In FRC, that drawing lives in CAD, and the most popular CAD tool on teams today is **Onshape** — a full professional 3D modeler that runs entirely in your browser, with nothing to install. If you can open a Chrome tab, you can CAD. This guide walks you from a blank account to your first real part: a length of \`2x1\` aluminum tube, the same stock that frames thousands of FRC robots. Let's get you modeling.

## Why Onshape for FRC

Onshape is browser-based, so it works the same on a school Chromebook, a Mac, or a Windows laptop, and your documents auto-save to the cloud. That cloud model also means real-time collaboration: multiple students can edit the same document at once, like a Google Doc for CAD. Best of all, it is **free for students and teams** through the Onshape Education plans.

If you also want to brush up on the build side that CAD feeds into, our [mechanical build track](https://learnfrc.systemerr.com/guides/mechanical-build) and [CAD design track](https://learnfrc.systemerr.com/guides/cad-design) pair well with this tutorial.

## Step 1: Sign up free with an Education plan

Onshape offers a **free Student plan** for individuals and a **free Educator plan** for teams, mentors, and coaches. Both are real, full-featured Onshape — not a stripped-down demo. (Education plans are for non-commercial use.)

- **Individual students:** Go to the [Onshape for Education sign-up page](https://www.onshape.com/en/education/sign-up) and create an EDU account. Indicate you are a student in grade school, fill in your school details, and — per [FRCDesign.org's setup guide](https://frcdesign.org/learning-course/course-setup/new-to-onshape/account-setup/) — you can simply enter \\"Robotics\\" as your reason for using Onshape. Onshape verifies your info, emails you, and you set a password.
- **Whole teams:** A mentor or design lead can request the [Educator plan for FIRST teams](https://www.onshape.com/en/education/first-robotics), which adds a shared classroom with Classes and Assignments so you can manage everyone's work in one place, plus parts libraries and FRC field models.

After your first login, set your default units (most FRC teams work in inches) and pick mouse controls. Then you're ready to make a document.

## Step 2: Understand the Onshape document model

Everything in Onshape lives inside a **document**. A single document can hold many tabs, and the two tab types you'll use constantly are:

| Tab type | What it's for |
|----------|---------------|
| **Part Studio** | Where you design parts. You draw 2D **sketches** and turn them into 3D parts with **feature** tools like Extrude. A Part Studio can hold one part or many. |
| **Assembly** | Where you bring parts together and define how they fit and move, using **mates**. |

According to [Onshape's documentation](https://cad.onshape.com/help/Content/sketch.htm), you \\"use Sketch tools to create 2D geometry, and use Feature tools to create 3D models (or parts) from those sketches, all within a Part Studio.\\" That sketch-then-feature loop is the heart of CAD, so let's do it.

## Step 3: Sketch on a plane

Create a new document, and Onshape drops you into a Part Studio with three reference **planes** — Top, Front, and Right — plus an **Origin** point where they all meet. Every Part Studio has these by default, and they are your starting reference for any sketch.

To begin, click the **Sketch** tool and pick a plane to draw on (the Top plane is a common choice for a flat part). Onshape rotates to look straight at that plane. Now draw your shape — for a length of \`2x1\` tube, use the **Rectangle** tool to draw a rough rectangle near the origin.

### Dimension and constrain it

A rough sketch isn't done until it's **fully defined** — meaning Onshape knows the exact size and position of every line. You lock that down two ways:

- **Dimensions** set exact sizes. Use the **Dimension** tool, click a line, and type a value — for our tube cross-section, \`2 in\` for one side and \`1 in\` for the other.
- **Constraints** set relationships, like making two lines equal, parallel, or **coincident** (touching). Snapping a corner of the rectangle onto the origin is a clean way to anchor it.

When the sketch turns from blue to black, it's fully defined. Getting in the habit of fully defining sketches now will save you from parts that mysteriously shift later. Close the sketch when you're happy.

## Step 4: Extrude into a 3D part

A flat rectangle isn't a tube yet — you need depth. That's the **Extrude** feature. Onshape defines Extrude as a tool to [\\"add depth to a selected region or planar face along a straight path.\\"](https://cad.onshape.com/help/Content/extrude.htm) In plain terms: it pushes your 2D shape out into 3D.

Select your rectangle and run **Extrude**. The key options:

| Option | What it does |
|--------|--------------|
| **New** | Creates new material as a brand-new part (what you want for your first part). |
| **Add / Remove / Intersect** | Add material to an existing part, cut material away, or keep only overlapping material. |
| **Blind** | Extrude to a specific distance you type in the Depth field. |
| **Symmetric** | Extrude equally to both sides of the sketch plane. |

Set the result to **New**, choose **Blind**, and enter a length — say \`24 in\` for a two-foot piece of tube. Click the green check, and you have a solid \`2x1\` bar. To make it a real hollow tube, start a new sketch on one end face, draw a smaller rectangle inset from the edges (real \`2x1\` stock is often \`0.0625\\"\` or \`0.125\\"\` wall thickness), and Extrude it with **Remove** through the length to hollow it out. Congratulations — that's a recognizable FRC tube.

Real teams buy this stock pre-made: vendors like [WCP](https://docs.wcproducts.com/welcome/frc-build-system/systems-structure/framing-and-material), AndyMark, and REV sell \`2x1\` and \`1x1\` 6061-T6 aluminum box tube, frequently pre-punched with a hole pattern (a common one is \`#10\` clearance holes on \`0.5\\"\` spacing). You can model those holes the same way — sketch circles, then Extrude with **Remove**.

## Step 5: Skip the busywork with the FRC parts library

You should learn to model your own structural parts, but you should *not* hand-model a NEO motor or a gearbox. The FRC community maintains **FRCDesignLib**, a library of off-the-shelf (**COTS**) FRC components and assemblies, and the easiest way to use it is the **FRCDesignApp**.

Per the [FRCDesignLib resource page](https://frcdesign.org/resources/frcdesignlib/), the two are distinct: \\"FRCDesignApp is the plugin/app that helps you insert components into your documents, while FRCDesignLib is the actual collection of components.\\" To set it up, find FRCDesignApp in the Onshape App Store, choose **Subscribe**, then **Get for Free**. It links to your account automatically — just reload any already-open documents once so the inserter appears. From there you can search COTS parts and filter by vendor (REV, WCP, and more) and drop them straight into your design.

## Step 6: Assemble with mates

Once you have a few parts, open an **Assembly** tab to put them together. Parts are positioned and connected with **mates**, and mates snap to **mate connectors** — which Onshape describes as [\\"local coordinate systems located on or between entities.\\"](https://cad.onshape.com/help/Content/mate.htm) Think of a mate connector as a precise grab point.

The two mates beginners use most:

- **Fastened mate** — locks two parts together completely. Onshape's docs note it restricts all six degrees of freedom, so the parts can't move relative to each other at all. Use this to bolt a gusset onto your tube.
- **Revolute mate** — allows rotation around one axis, perfect for a wheel on an axle, an arm pivot, or a shaft in a bearing.

Other mate types — Slider, Cylindrical, Planar, Ball — cover more motion later, but Fastened and Revolute will carry you a long way.

## Where to go next

You now know the full loop: sketch, dimension, extrude, library parts, assemble. The single best place to go deep is [FRCDesign.org's free learning course](https://frcdesign.org/learning-course/), built specifically to take FRC students \\"from zero to being able to model a full robot.\\" It's sponsored by West Coast Products and Fabworks, weaves in Onshape's own learning courses, and even walks you through modeling a swerve drivebase using a top-down design workflow.

One important note on accuracy: robot **weight and size limits change every season**, and so do many legal-material rules. Don't trust a number you read in a tutorial — always confirm dimensions, weight, and bumper rules in the current [FIRST game manual](https://www.firstinspires.org/robotics/frc/game-and-season) before you finalize a design.

Ready to keep building your CAD skills? Dive into our [CAD design track](https://learnfrc.systemerr.com/guides/cad-design) and start turning ideas into robots.`,
  },
  {
    slug: "frc-team-structure",
    title: "How to Structure an FRC Team: Subteams, Roles, and Leadership",
    description: "A practical guide to organizing an FRC team: the common subteams, student leadership, mentor roles, meeting cadence, rookie onboarding, and sustainability.",
    keywords: ["FRC team structure","FRC team roles","how to organize an FRC team","FRC subteams","FRC student leadership","FRC drive team","FRC mentors"],
    date: "2026-06-24",
    readMins: 7,
    content: `A great robot rarely comes from one genius working alone. It comes from a team where dozens of students each own a slice of the problem, hand work off cleanly, and pull in the same direction under a deadline. The good news: you do not need to invent your structure from scratch. FIRST and successful teams have converged on a handful of patterns that work, and you can adopt them on day one. This guide walks through the common subteams, how students lead, what mentors actually do, how the calendar shapes your meetings, and how to make sure your hard-won knowledge survives graduation.

## The two halves of every team

FIRST's official [How To: Organize a Team](https://www.firstinspires.org/hubfs/web/program/frc/resources/team-org.pdf) guide suggests starting with two big groups and subdividing from there: the **robot side** and the **logistics side** (sometimes called the team side or non-technical side). The robot side builds the machine. The logistics side keeps the team funded, documented, recruited, and known in the community. Both matter. A robot with no sponsors does not get to competition, and a flush bank account with no robot does not win matches.

You do not need every subteam below. A rookie team of fifteen students might run a single "build" group and a single "business" group. A 60-student team might split each of these five ways. Pick the structure your leadership can actually support, and merge subteams when you are short on people.

## The robot-side subteams

### Design / CAD

The **Design** subteam (often called **CAD**) turns the team's prototypes and decisions into a 3D model that serves as the blueprint for fabrication. Most FRC teams CAD in [Onshape](https://www.onshape.com/) or Autodesk Inventor, and a strong reference for learning is [FRCDesign.org](https://www.frcdesign.org/). Designers think in terms of mechanisms, tolerances, and how parts bolt together before anyone cuts metal. If your team uses 3D printing or CNC, this group usually owns the manufacturing files too. Learn more in our [CAD and design track](https://learnfrc.systemerr.com/guides/cad-design).

### Mechanical / Build

The **Mechanical** subteam (also "build") fabricates and assembles the robot. Early in the season they prototype end effectors and mechanisms; once the design is locked, they machine, cut, and assemble the real parts. This is where mills, lathes, drill presses, and a lot of deburring live. Our [mechanical build track](https://learnfrc.systemerr.com/guides/mechanical-build) covers gearboxes, drivetrains, and manipulators.

### Electrical

The **Electrical** subteam is the bridge between mechanical and programming. They wire the robot: the power distribution board, motor controllers, the roboRIO, the radio, breakers, and sensors, all laid out so the board is safe and serviceable. Clean wiring is not cosmetic; a loose connection is a match you lose. See our [electrical track](https://learnfrc.systemerr.com/guides/electrical) for wiring standards and component selection.

### Programming

The **Programming** subteam writes the code that connects driver controls to motors and sensors. Most teams use [WPILib](https://docs.wpilib.org/) in Java or C++, increasingly with the command-based framework, and tools like [PathPlanner](https://pathplanner.dev/) for autonomous paths and [PhotonVision](https://docs.photonvision.org/) or [Limelight](https://docs.limelightvision.io/) for vision. They own both the autonomous routines and the teleop control logic. Dive into our [programming track](https://learnfrc.systemerr.com/guides/programming-software).

## The logistics-side subteams

### Business / Finance

The **Business** subteam manages the budget, writes the business plan, recruits and stewards sponsors, and tracks expenses. They are why your team can afford a [swerve drive](https://learnfrc.systemerr.com/guides/mechanical-build) and a trip to a regional.

### Outreach / Community

The **Outreach** subteam extends the team's impact beyond itself: running events, mentoring younger FIRST teams, and spreading STEM in the community. This work is the backbone of award submissions, including the FIRST Impact Award (called the Chairman's Award through the 2022 season), the most prestigious honor in the program.

### Communications / Media

Often split from business on larger teams, the **Communications/Audio-Visual** group handles the website, social media, newsletters, photography, video, and award essays. They document the season so the outreach story can actually be told.

### Strategy / Scouting

The **Strategy** subteam reads the game manual closely, runs mock matches to shape the robot's priorities, and at competition gathers and analyzes data on every team. That scouting data drives one of the highest-leverage decisions of the event: which partners to pick during alliance selection.

## The drive team: a special case

The **drive team** is not a year-round subteam so much as the small crew that operates the robot at competition, and its size is capped by the rules. In recent seasons the FRC game manual has defined a drive team of **up to five members** — a mix of **DRIVERS**, a **DRIVE COACH**, a **TECHNICIAN**, and **HUMAN PLAYERS** — with **no more than one non-student** among them. Because these limits and role labels can change year to year, always confirm the exact composition in the current [game manual](https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system).

| Role | What they do |
| --- | --- |
| Drive coach | Calls strategy, talks to alliance partners between matches, leads the crew on the field |
| Driver | Controls robot movement and primary mechanisms |
| Operator | An informal term for a driver who runs secondary mechanisms (arms, elevators, shooters) |
| Human player | Handles game pieces from the field perimeter, per that year's game |
| Technician | The one person allowed to handle the robot for pre-match setup and troubleshooting; not a coach or driver |

Pick drivers on merit and practice, not seniority. FIRST publishes a [Selecting Drive Team Members](https://community.firstinspires.org/hubfs/web/program/frc/resources/selecting-drivers.pdf) guide that weighs talent against experience, communication, and composure, and Team 254 publicly shares its own [driver selection criteria](https://media.team254.com/2014/02/Team_254_FRC_Driver_Selection_Criteria-2013-2014.pdf): consistency, composure under pressure, and willingness to drill matter more than raw reflexes.

## Student leadership

FIRST recommends electing one or two **team captains** who supervise the whole team and relay between students and the head mentor. Beneath them, larger teams add **robot and logistics managers** who own the big picture for each half, freeing the **subteam leads** to focus on their specialty. Select leaders on merit and experience through an application, short essay, or interview, not a popularity contest. There is no single correct chart; the point is that every student knows who they report to and who depends on their work.

## Mentor roles

Mentors guide; they do not build the robot for the students. Every team needs a **Lead Coach/Mentor** who is the adult of record with FIRST and shepherds the season. Beyond that, **technical mentors** coach individual subteams (a machinist for mechanical, a software engineer for programming), and **non-technical mentors** support business, outreach, and logistics.

Crucially, all coaches and mentors must complete FIRST's [Youth Protection Program](https://www.firstinspires.org/resources/youth-protection) training and screening before working with students, and FIRST provides a structured [Mentor Guide](https://info.firstinspires.org/hubfs/web/program/frc/resources/frc_mentor_guide.pdf) and onboarding pathway. Treat YPP compliance as non-negotiable.

## Meeting cadence across the year

Your schedule should breathe with the season. A typical rhythm looks like this:

| Phase | Roughly when | Cadence and focus |
| --- | --- | --- |
| Offseason | May to August | Once a week; fundraising, outreach, summer camps, design experiments |
| Preseason | September to December | A couple meetings a week; training rookies, prototyping, building a practice mechanism |
| Build season | Kickoff in early January onward | Most meetings of the year; design, build, program, test |
| Competition | Late February through April | Travel, compete, iterate between events |

Kickoff lands on a Saturday in early January (it has fallen on the first or second Saturday depending on the year), so check the current season's calendar for the exact date. One important correction to outdated advice: FRC no longer has a six-week "stop build day." FIRST retired bag-and-tag for the 2020 season (see FIRST's [2020 rule-change announcement](https://www.firstinspires.org/robotics/frc/blog/2020-rule-changes-stop-build-day)), so teams may now keep working on the robot from kickoff right up to their first event. You can still structure your effort around six intense weeks if that suits you, but you are no longer forced to.

## Onboarding rookies and training

New members are the team's future, so make their first weeks count. Use the calm preseason to run hands-on training: a "rookie robot" or an old competition bot is a perfect sandbox for teaching wiring, basic CAD, and a first WPILib deploy without the pressure of a real deadline. FIRST's guide suggests having students apply to their top three subteam choices, which balances the groups and keeps everyone engaged rather than letting one subteam swell while another starves.

## Documentation and sustainability

The single biggest threat to an FRC team is graduation. Seniors leave and take their knowledge with them unless you write it down. Build a habit of documentation: an engineering notebook, a shared drive of CAD and code, wiring diagrams, and a team handbook covering norms, safety, and expectations (FIRST links example [team management resources](https://www.firstinspires.org/resources/library/frc/team-management-resources)). Use a communication platform like Discord, Slack, or Google Classroom with per-subteam channels so information is searchable, not trapped in one person's memory. A team that documents well can survive a rough year, rebuild, and come back stronger.

Ready to find your spot on the team? Explore every subteam's skills in the [LearnFRC guides hub](https://learnfrc.systemerr.com/guides).`,
  },
  {
    slug: "frc-rookie-mistakes",
    title: "10 Common FRC Rookie Mistakes (and How to Avoid Them)",
    description: "The 10 mistakes that trip up first-year FRC teams the most, with a concrete fix for each: scope, the game manual, driver practice, drivetrain, wiring, scouting, and more.",
    keywords: ["FRC rookie mistakes","common FRC mistakes","FRC advice for new teams","FRC rookie tips","FRC first year"],
    date: "2026-06-24",
    readMins: 8,
    content: `Every veteran FRC team was a rookie once, and almost all of them made the same handful of mistakes in their first season. The good news: those mistakes are well-documented, predictable, and completely avoidable. If you learn what they are now, you can skip months of frustration and show up to your first event with a robot that actually works. Here are the ten that trip up new teams the most, and exactly how to dodge each one.

## 1. Designing a robot that does too much

The single most common rookie mistake is scope creep: trying to build a machine that scores in every way the game allows. A robot that does one thing reliably beats a robot that does five things poorly, every single time.

**The fix:** pick one or two scoring objectives and commit. Read the game's scoring breakdown, identify the highest-value action you can realistically build, and design around that. A simple robot you finish and test in week four is worth far more than an ambitious one you're still debugging the night before your event. Start from a known-good base like the official [KitBot](https://www.firstinspires.org/resources/library/frc/kitbot), then add exactly one mechanism on top.

## 2. Not reading the game manual carefully

At Kickoff, everyone watches the game animation and skips straight to brainstorming. Then at inspection they discover their robot is over the size limit, the bumpers are illegal, or a mechanism breaks a rule. Illegal **bumpers** in particular are one of the largest non-compliance issues inspectors see, per [FIRST's bumper rule-change guidance](https://info.firstinspires.org/hubfs/blog/frc/2024-bumper-rule-changes.pdf).

**The fix:** assign someone to read the entire game manual, especially the **Robot Construction Rules** (the "R" rules) and the **Game Rules** (the "G" rules). In recent seasons the robot has had to fit a fixed frame perimeter, stay under a height limit, and weigh under a set maximum without bumpers and battery — but these numbers change every year (the weight limit itself changed for the 2025 season), so confirm the exact figures in the [current Game Manual](https://www.firstinspires.org/resources/library/frc/season-materials) before you cut a single piece of metal. Print the current season's inspection checklist from the [official season materials](https://www.firstinspires.org/resources/library/frc/season-materials) and check your robot against it weeks before your event, not at the field.

## 3. No driver practice (or starting it too late)

Teams pour hundreds of hours into building a robot, then hand the controls to someone who has never driven it until their first qualification match. A great robot with an untrained driver loses to an average robot with a practiced one.

**The fix:** start driving early. You don't need a finished robot — a previous year's robot, a test chassis, or even the bare drivetrain of this year's machine is enough to begin, as [FIRST's driver-performance guide](https://www.firstinspires.org/hubfs/web/program/frc/resources/improving-driver-performance.pdf) notes. Run drills: slalom courses, repeated pickups, and scoring cycles against a timer. At the event, the practice day (usually the day before qualification matches start) exists for exactly this — get inspected first, then run as many practice matches as you can to shake out connection issues.

## 4. An unreliable drivetrain

If your robot can't move, nothing else matters. Rookie teams often try to design a clever custom drivetrain and end up with chain that throws, wheels that slip, or gearboxes that bind — and they spend the whole season fixing it instead of building scoring mechanisms.

**The fix:** for your first year, build the [AndyMark AM14U6](https://andymark.com/products/am14u6-6-wheel-drop-center-robot-drive-base-2025-frc-kit-of-parts-drive-base) Kit-of-Parts chassis that ships in the Kickoff kit. It's a proven 6-wheel drop-center base, fully documented, and designed to survive a season of contact. A reliable, boring drivetrain frees your team to spend its energy on the parts of the robot that actually win matches. Learn the mechanical fundamentals in our [Mechanical / Build track](https://learnfrc.systemerr.com/guides/mechanical-build).

## 5. Sloppy wiring with no strain relief

Loose connectors, wires under tension, and stray copper "whiskers" cause more mid-match failures than almost anything else. A robot that browns out or loses a motor because a wire popped off during a collision is a robot that can't compete.

**The fix:** follow the [WPILib wiring best practices](https://docs.wpilib.org/en/stable/docs/hardware/hardware-basics/wiring-best-practices.html). Key points:

- Leave enough slack to **avoid strain on connectors**, then secure cables close to each connection point.
- **Pull-test every connection** by hand to confirm nothing comes loose.
- Make sure no stray wire whiskers stick out of a terminal.
- Secure snap-in connectors like the **SB50** battery connector with clips or cable ties so impacts can't pop them loose.

Treat clean wiring as a competitive feature, not an afterthought. Our [Electrical track](https://learnfrc.systemerr.com/guides/electrical) walks through the full power-distribution layout.

## 6. Skipping scouting

Rookie teams often treat scouting as optional busywork. Then alliance-selection day arrives, the top-ranked teams start picking partners, and the rookies have no data and no plan — so they either don't get picked or pick blindly.

**The fix:** scout from match one. The [FIRST Introduction to Scouting Guide](https://info.firstinspires.org/hubfs/web/program/frc/resources/intro-scouting.pdf) explains the goal: gather data on what every robot can actually do so you can build a **pick list** before alliance selection. In the playoffs, the highest-seeded teams become alliance captains and invite partners to form alliances, and good scouting data tells you which partners complement your robot's strengths. Scouting also feeds **match strategy** — knowing what each robot does lets your drive team assign roles for auto, teleop, and endgame before the match starts.

| Without scouting | With scouting |
| --- | --- |
| Guess at partner quality | Rank teams by real performance |
| No pick list on selection day | A ready, data-backed pick list |
| Improvise every match | Assign roles per game phase |

## 7. Last-minute, untested changes

The temptation to "just tweak one thing" the night before a match — or worse, between matches — has broken countless robots. An untested change is a gamble, and at competition the stakes are highest.

**The fix:** adopt a simple rule — no change goes on the robot without a test afterward. Keep the working robot working. If you must modify something at an event, do it early in the day, run it in a practice match, and have a way to revert. Version-control your robot code so you can roll back a bad commit instantly; see our [Programming / Software track](https://learnfrc.systemerr.com/guides/programming-software) for setting that up.

## 8. No documentation

When the one student who wired the robot or wrote the autonomous code is out sick, an undocumented team is stuck. Rookies frequently keep everything in one person's head, then lose all of it when that person graduates.

**The fix:** write things down as you go. A wiring diagram, a list of CAN IDs and motor-controller assignments, a build log, and a README in your code repository cost almost nothing to maintain and save you constantly. Documentation is also how knowledge survives from one season to the next — it's the difference between a team that improves every year and one that restarts from zero.

## 9. Blowing the budget early

FRC parts are expensive, and it's easy to spend most of your funds in the first few weeks on motors, pneumatics, and shiny COTS mechanisms — then have nothing left for spares, replacement parts, or travel.

**The fix:** make a budget before you spend, and hold back a reserve. Prioritize the essentials (drivetrain, control system, battery, bumper materials), buy spares of the parts most likely to fail or get lost, and remember that the Kit of Parts already gives you a huge head start. Note that the rules also cap the value of any single non-kit item you put on the robot — there's a per-item fair-market-value limit, and that figure can change from year to year — so confirm the current cost rules in the [game manual](https://www.firstinspires.org/resources/library/frc/season-materials) and track your spending from day one.

## 10. Skipping prototyping

Rookies often go straight from an idea to a finished, machined mechanism — and discover too late that the geometry was wrong, the wheels were the wrong durometer, or the whole concept doesn't work. Rebuilding a "final" part is far more expensive than fixing a prototype.

**The fix:** prototype cheaply and quickly first. As [FRCDesign.org](https://frcdesign.org/) advises, build with inexpensive materials like wood and screws, and power a wheeled shooter with a hand drill before you commit to motors and metal. The goal of a prototype is to learn fast and iterate, not to be pretty. Once a prototype proves the concept, then move it into [CAD](https://learnfrc.systemerr.com/guides/cad-design) and build the real version with confidence.

## The pattern behind every fix

Look back at the list and one theme repeats: do the simple, reliable thing early, then test it. Scope down, read the rules, build a proven drivetrain, wire it cleanly, practice driving, scout your matches, and prove every idea before you commit. None of these require genius — just discipline. Every championship team started by getting the basics right, and so can you.

Ready to dig into the details? Start with the [LearnFRC guides hub](https://learnfrc.systemerr.com/guides) and pick the track that matches whatever part of your robot needs the most help right now.`,
  },
  {
    slug: "frc-vs-ftc-vs-vex",
    title: "FRC vs FTC vs VEX: Which Robotics Program Is Right for You?",
    description:
      "FRC vs FTC vs VEX compared: robot size, cost, age range, season length, and programming, plus how to choose the right robotics competition for you.",
    keywords: [
      "FRC vs FTC",
      "FRC vs VEX",
      "difference between FRC and FTC",
      "which robotics competition",
      "FTC vs VEX",
      "best robotics program for beginners",
    ],
    date: "2026-07-03",
    readMins: 7,
    content: `Short answer: FRC, FTC, and VEX are all competitive robotics programs, but they differ in robot size, cost, and age range. FRC builds the biggest robots (roughly 115 pounds) for the most money, FTC sits in the middle with fridge-sized-down-to-desktop robots at a fraction of the cost, and VEX is the cheapest and most accessible with the most matches per season. Which one is "right" depends almost entirely on your budget, your available mentors, and how much time you can commit.

Here's the honest breakdown, from someone inside the FRC ecosystem.

## The one-paragraph version of each

**FRC (FIRST Robotics Competition)** is the flagship high-school program of *FIRST*. Every January, teams worldwide get the same new game and about six weeks to design, build, and program a roughly 115-pound robot to play it. It is the biggest, most expensive, most "real engineering" of the three.

**FTC (FIRST Tech Challenge)** is FIRST's middle-and-high-school program (grades 7–12). Robots start each match inside an 18-inch cube and can expand from there. It runs on the same season rhythm as a sport but costs far less than FRC and needs a fraction of the space.

**VEX** competitions have long been organized by the Robotics Education & Competition Foundation (REC Foundation), a nonprofit separate from *FIRST* — but don't take that as fixed. In 2026, VEX Robotics, Inc. and the REC Foundation ended up in a very public dispute (a lawsuit over unpaid fees, followed by the REC Foundation announcing plans for its own competitions), so who actually administers VEX events in your area could keep changing. Check recf.org and vex.com directly for the current setup before you commit. VEX itself still comes in tiers: VEX IQ (plastic, snap-together, elementary and middle school) and the VEX V5 Robotics Competition, or V5RC (metal parts, middle and high school). VEX is the most affordable, has the longest season, and runs the most tournaments.

If you only remember one thing: **FRC is the varsity-sport version, VEX is the year-round club version, and FTC lands in between.**

## Robot size and what you actually build

The size gap is the most visible difference, and it drives almost everything else.

An FRC robot is an industrial machine. It's built from aluminum extrusion, powered by big brushless motors, and plays on a field roughly 27 by 54 feet in three-robot alliances. When people say FRC robots are "the size of a washing machine," they're not exaggerating. That scale is thrilling, but it means real safety considerations, real machining, and a real shop.

An FTC robot fits in an 18-inch cube at the start of a match. You can build a competitive one on a folding table in a classroom. Parts come from ecosystems like REV Robotics, goBILDA, and Tetrix, and much of it is bolt-together rather than machined from raw stock. Matches are two robots versus two robots on a 12-by-12-foot field.

A VEX V5 robot is smaller still and built almost entirely from a standardized metal-and-plastic kit with square holes on a half-inch grid. That standardization is the point: nearly everyone uses the same parts, so the competition is more about clever design and driver skill than about who can afford custom fabrication. V5RC also runs two-versus-two.

Across all three, the *skills* overlap more than the hardware suggests. Drivetrains, intakes, arms, and scoring mechanisms show up everywhere. If you learn how a good drivetrain works in one program, that knowledge transfers. Our [mechanical build guides](/guides/mechanical-build) are FRC-flavored, but the mechanical intuition carries over to FTC and VEX just fine.

## Cost, honestly

This is usually the deciding factor for a new program, so let's be blunt.

**FRC is expensive.** All-in, a typical Regional team's season lands in the low-to-mid five figures once you add up registration, events, parts, and travel — far and away the priciest of the three. Rookie grants soften year one (the NASA-sponsored [rookie grant](/guides/business-operations/first-grants-and-programs/nasa-frc-sponsorship-grant) can cover a first event), but FRC is a serious fundraising commitment every season after. Before you commit, read the honest, line-by-line numbers in our [cost of an FRC team](/guides/business-operations/understanding-the-cost/what-frc-actually-costs) lesson.

**FTC is dramatically cheaper.** Team registration with FIRST is in the low hundreds, and a competitive robot's parts run in the low thousands. A brand-new FTC team can realistically get on the field for well under what a single FRC event costs.

**VEX is the most budget-friendly of all.** Team registration with the REC Foundation is modest, the base kit is reusable across seasons, and because parts are standardized you're not constantly buying custom hardware. For a school testing the waters on competitive robotics, VEX is the lowest-risk financial entry point.

Exact fees change year to year, so always confirm current numbers on each program's official site rather than trusting a blog (including this one). But the *relative* ranking, VEX cheapest, FTC in the middle, FRC most expensive, has held steady for years.

## Age range and season length

**FTC and VEX IQ** reach down into middle school, which matters if you're building a pipeline. A common feeder path is VEX IQ or FTC in middle school, then FRC in high school.

**FRC** is strictly high school (grades 9–12, roughly ages 14–18).

**VEX V5RC** spans middle and high school, and VEX even has a college division (VEX U).

Season length is a real lifestyle difference. FRC's build season is a famously intense six-week sprint after the January [kickoff](/guides/getting-started/the-season-and-the-game/annual-season-kickoff-to-championship), then events run into spring. It's a burst of enormous effort. VEX, by contrast, releases its game in the spring and runs tournaments through the following spring, so teams iterate on the same game for the better part of a year across many events. FTC sits in between, kicking off in the fall with events running into the following spring. If your students thrive on a short, all-in crunch, FRC's rhythm is a feature. If they'd rather iterate slowly and compete often, VEX's long season fits better.

## Programming and the software stack

If you or your students care about code, the differences here are worth knowing.

**FRC** uses **WPILib**, the official software library, in Java, C++, or Python. Code runs on the **roboRIO** controller, and motor controllers from REV and CTRE talk over a CAN bus. This is the most professional stack of the three, with version control, command-based architecture, simulation, and vision processing all in normal use. Rather than re-explain the electronics and toolchain here, our lessons on [the FRC control system](/guides/electrical-wiring/control-system-components/what-is-the-frc-control-system) and [choosing a language](/guides/programming-software/foundations-tools-and-first-program/choosing-a-language) walk through the real thing.

**FTC** runs on the **REV Control Hub**, an Android-based controller. You can program in Blocks (visual), OnBot Java (in a browser), or full Android Studio with Java. The on-ramp is gentle: a student can start in Blocks and graduate to text-based Java on the same robot.

**VEX** uses **VEXcode**, which supports Blocks, C++, and Python, and advanced teams often move to **PROS**, a more professional C++ toolchain. Code runs on the V5 Brain. Like FTC, VEX is designed so a beginner can start visual and grow into real text code.

All three teach genuine programming. FRC's stack is the closest to what you'd see in an actual engineering job, which is part of why FRC alumni so often cite it in college and internship applications.

## Which one is right for you?

Rather than declaring a winner, match the program to your situation.

**Choose FRC if:** you're in high school, you have (or can raise) a real budget, you can find dedicated mentors and shop space, and you want the deepest, most industry-like engineering experience. The scale, the alliances, and the six-week crucible are unmatched. It asks the most and gives the most back.

**Choose FTC if:** you want a genuine FIRST competition experience without FRC's cost and space demands, you're serving middle *or* high schoolers, or you're a new program that wants to prove the concept before scaling up to FRC later. Many strong FRC programs started as FTC teams.

**Choose VEX if:** budget is tight, you want to compete frequently across a long season, you're starting younger students, or you want a standardized-parts environment where design cleverness beats fabrication budget. It's the easiest place to start and the easiest to sustain.

And you don't have to pick forever. Plenty of students do VEX or FTC first, then move to FRC and bring that experience with them. The habits that make you good, iterating on designs, scouting your opponents, wiring cleanly, documenting what you learn, transfer across all three. If terms like *alliance*, *autonomous*, or *CAN bus* are new to you, our [glossary](/glossary) explains the vocabulary all three programs share.

## Where to go next

If you've landed on FRC, that's what this whole site is built for. Start with our [Getting Started guide](/guides/getting-started) for a beginner's walkthrough of joining a team and learning the tools, then branch into whichever department fits you, whether that's mechanical, CAD, programming, electrical, or strategy. Our structured [learning paths](/paths) will sequence the lessons for you so you're not guessing what to learn next.

Whichever program you choose, the best move is the same: find a local team, ask to visit, and show up. Robotics people are famously generous, and every one of these programs is far less intimidating from the inside than it looks from the stands.`,
  },
  {
    slug: "joining-your-first-frc-team",
    title: "Joining an FRC Team: Your First-Season Survival Guide",
    description:
      "How to join an FRC team as a rookie: where to find a team, when to join, picking a department, what to expect your first year, and surviving your first build season.",
    keywords: [
      "how to join an FRC team",
      "first year FRC",
      "new FRC member",
      "what to expect FRC rookie",
      "FRC rookie survival guide",
      "joining a robotics team",
    ],
    date: "2026-07-03",
    readMins: 7,
    content: `To join an FRC team, find a team at your school or in your community, show up to a meeting, and tell them you want to help — most teams take new members year-round and assume you know nothing. You do not need to build robots, write code, or even own a screwdriver on day one; you need to show up consistently and be willing to get good at one thing.

That is the whole barrier to entry. Everything below is what happens after you walk in the door, and how to not feel completely lost your first season.

## Step 1: Find a team

Most FRC teams are based at a high school, but plenty run out of community centers, libraries, homeschool co-ops, and 4-H groups. Start by asking your school's science, engineering, or CTE teachers whether there's a team — a lot of them exist quietly and never advertise. If that turns up nothing, use the official **team locator** on firstinspires.org to find the closest teams to your zip code, then email the ones within driving distance.

When you reach out, keep it simple: your name, your grade, that you're interested, and that you have no experience. Teams hear that constantly and it's not a problem. Every strong veteran on that team started as a confused freshman who didn't know what a "roboRIO" was.

If there genuinely isn't a team near you, you have two real options: join as a **student who commutes** to a nearby team (more teams allow this than you'd think), or help start one. That's a bigger project, but a very doable one — our [complete guide to starting a team](/blog/how-to-start-an-frc-team) covers registration, mentors, space, and the first-year grants.

## Step 2: Know when to join

The honest answer is **you can join almost any time**, but the timing changes your experience.

The best time is the **fall preseason** (September through December). This is when teams recruit, train new members, run small offseason projects, and teach fundamentals before the pressure hits. Join now and you'll actually be useful by January.

If you join in **January or during build season**, expect to be dropped straight into the deep end. That's not necessarily bad — you learn fast under a deadline — but nobody will have time to slowly onboard you. You'll learn by grabbing whatever job needs doing and watching closely.

Joining in the **spring**, during competition season, usually means you're along for the ride this year and a full contributor next year. Still worth it. You'll see events firsthand, which is the best recruiting pitch FRC has. Whenever you jump in, our lesson on [joining a team as a new student](/guides/getting-started/getting-started-your-first-steps/new-student-join-a-team) walks through finding one, showing up prepared, and learning the ropes even mid-season.

## Step 3: Understand the season's rhythm

FRC runs on the same annual cycle, and knowing it means you're never blindsided. Our lesson on [the annual season from Kickoff to Championship](/guides/getting-started/the-season-and-the-game/annual-season-kickoff-to-championship) walks the whole calendar; the short version is four phases:

- **Preseason (fall):** Training, recruiting, and fundraising, sometimes with an offseason event. Low pressure, high learning.
- **Kickoff (early January):** FIRST reveals a brand-new game to every team on the planet at the same moment — the whole community starts from zero on the same Saturday.
- **Build season (about six weeks):** Design, build, wire, and program a robot to play that specific game. This is the crunch; meetings get long and frequent.
- **Competition season (late February through April):** Take the robot to Regional or District events, fix it between matches, and try to qualify for a District or the FIRST Championship.

Because the game changes every year, last season's robot is mostly a paperweight by January — and that fresh start means a rookie isn't as far behind the veterans as you'd expect.

## Step 4: Pick a department (but stay flexible)

A common myth is that FRC is only for people who want to build robots. In reality, a functioning team is a small organization that needs people across very different jobs — our lesson on [sub-teams and roles](/guides/getting-started/culture-teams-and-roles/sub-teams-and-roles) maps all of them so you can find where you fit. The quick landscape:

- **Mechanical / Build** — the physical robot: drivetrains, arms, intakes, shooters. Hands-on and tangible. See our [Mechanical & Build guides](/guides/mechanical-build).
- **CAD & Design** — modeling the robot in software (Onshape, Fusion, or SolidWorks) before anyone cuts metal.
- **Programming** — writing the code that makes the robot move and think, using **WPILib** in Java, C++, or Python. Our [Programming guides](/guides/programming-software) start from scratch.
- **Electrical & Wiring** — power, the control system, and wiring that passes inspection. Underrated and always short-staffed; the [Electrical & Wiring guides](/guides/electrical-wiring) are a great entry point.
- **Scouting & Strategy** — collecting match data and deciding who to pick for playoff alliances.
- **Business, Media, and Outreach** — fundraising, sponsors, branding, social media, and the community impact work that funds and sustains the team.
- **Drive Team and Safety** — the students who actually operate the robot at events, and the people keeping the shop from hurting anyone.

Pick the one that sounds most interesting and go deep on it. Do **not** try to learn all of them your first year — that's the fastest way to be mediocre at everything. Get genuinely good at one thing, then broaden later. If you're not sure where you fit, the [learning paths](/paths) group the guides into a sensible order for a beginner.

## What to actually expect as a rookie

Here's the part most "how to join" pages skip: what the experience really feels like in month one.

**You will feel lost for a few weeks, and that's normal.** Everyone around you is throwing around acronyms — CAN bus, PDH, teleop, COTS, roboRIO. It sounds like a different language because it is one. Keep our [glossary](/glossary) open on your phone and look up terms as they fly past. By week three the fog lifts.

**Meetings are frequent.** In preseason, expect a couple of meetings a week. During build season, many teams meet four to six days a week, sometimes for four or five hours a night. You don't have to make every minute of it, but the members who show up consistently are the ones who get trusted with real work. Consistency beats talent here, every single time.

**You'll do grunt work early, and that's how you earn trust.** Your first tasks might be sorting hardware, cutting wire, deburring metal, or filling out a scouting sheet. It's not glamorous, but doing the small jobs well and reliably is exactly how you get handed the interesting jobs. Nobody gets to program the autonomous routine in week one; they get there by being the person who showed up and did the unsexy stuff without complaining.

**Ask questions constantly.** The single biggest rookie mistake is staying quiet because you're afraid of looking dumb. Veterans genuinely want to teach — that's a huge part of why they're on the team. When you're stuck, ask the person next to you, and when the whole team is stuck, the [Chief Delphi](https://www.chiefdelphi.com) forums have answered almost every FRC question ever asked.

## How to be useful on day one

You can make a good first impression without knowing anything technical.

Show up with **closed-toe shoes and [safety glasses](/guides/safety/ppe-and-shop-safety/ppe-basics)** (or ask if the team provides them — most do). Bring a notebook or use your phone to write down what you learn, because you will forget the name of that one tool three times before it sticks. Learn people's names. Clean up after yourself in the shop without being asked. Say yes when someone needs a hand.

None of that requires engineering skill, and all of it signals that you're someone worth investing time in. In a rookie, reliability and attitude matter more than raw ability, because the ability comes with reps.

## Your first competition

At some point in the spring you'll go to an event, and it's a genuine shock the first time — loud, fast, and busier than you expect.

Each team gets a **pit**, a small workspace where you repair and tune the robot between matches. Qualification matches are short — this season's run 2 minutes and 40 seconds (auto plus teleop), though the exact length can shift a bit season to season — played by two alliances of three robots each ([how a match works](/guides/getting-started/the-season-and-the-game/how-a-match-works) breaks down the auto, teleop, and endgame phases). Before you can play, your robot has to pass **inspection**, which checks that it's built and wired to the rules — this is where clean electrical work quietly saves your weekend. Meanwhile, the scouting crew is logging data on every team so that when top-ranked teams draft playoff alliances, yours knows who's worth picking.

Your job as a rookie at your first event is mostly to watch closely, help in the pit, and pick a lane where you're useful — scouting is the classic entry point because it's high-impact and needs a lot of hands, and [why scouting wins matches](/guides/scouting-strategy/scouting-fundamentals/why-scouting-wins-matches) shows what all that data actually decides. You'll leave understanding the whole thing far better than any guide can teach you, including this one.

## The mindset that gets you through

Your first season isn't about being the best builder or the star programmer. It's about showing up, getting good at one thing, and becoming a member the team wants back next year.

Treat the learning curve as the fun part rather than something to survive. The students who thrive in FRC aren't the ones who walked in knowing the most — they're the ones who kept showing up, kept asking questions, and got a little better every meeting. Do that, and by next January you'll be the veteran teaching some nervous freshman what a CAN bus is.

Ready to get a head start before you even walk in? Skim the [Getting Started guide](/guides/getting-started), then browse the [learning paths](/paths) and pick a department to go deep on. And once you're on a team, [the 10 mistakes that trip up first-year teams](/blog/frc-rookie-mistakes) are worth a read so you can help yours dodge the avoidable ones. Showing up already knowing a few things is the fastest way to go from "the new kid" to "the person we hand real work to."`,
  },
  {
    slug: "what-happens-at-frc-kickoff",
    title: "What Happens at FRC Kickoff (and How to Prepare)",
    description:
      "What happens at FRC Kickoff: the game reveal, manual, and Kit of Parts, plus exactly how to prepare your team for the six-week build season.",
    keywords: [
      "frc kickoff",
      "what happens at frc kickoff",
      "frc kickoff 2027",
      "frc game reveal",
      "frc build season",
      "frc kit of parts",
    ],
    date: "2026-07-03",
    readMins: 8,
    content: `FRC Kickoff is the single-day event on a Saturday in early January when FIRST reveals the brand-new game for the season, and every team on the planet starts from zero at the exact same moment. You watch the game-reveal video, read the newly released game manual, and then have several weeks -- recent seasons have run closer to seven or eight weeks than the classic six -- to design, build, wire, and program a robot to play it.

That's the whole thing in two sentences. But Kickoff is also the most exciting and most disorienting day of the FRC year, so here's what actually happens, hour by hour, and how to walk in ready instead of overwhelmed.

## When Kickoff happens

Kickoff lands on a Saturday in **early January** almost every year. Kickoff 2027 will follow the same pattern, in early January 2027, just like every season before it. The game-reveal broadcast goes live in the morning US time and streams globally on the official FIRST channels (YouTube and Twitch), so teams everywhere see the game at the same instant. There's no early access, no leaks that hold up, and no way to prepare for the specific game beforehand. That fresh-start-for-everyone design is the entire point of FRC.

Some regions still host in-person Kickoff gatherings where nearby teams watch the reveal together and pick up physical kit materials. Plenty of teams just watch the stream from their own shop. Both are fine. What matters is that you're together as a team when the game drops, because the hours right after the reveal are when the season's direction gets set.

## What actually gets revealed

Three things arrive at Kickoff, and they arrive fast.

### The game animation

The broadcast opens with a two-to-three-minute animated video that shows the new field and demonstrates how the game is scored. This is the fun part everyone screenshots and reacts to. It gives you the vibe of the game (climbing, shooting, stacking, whatever it is that year) but it is *not* the rulebook. Do not design a robot off the animation alone. Every season, teams get burned by assuming something works the way the cartoon made it look.

### The game manual

The moment the reveal ends, FIRST publishes the **game manual**, a dense PDF that is the actual source of truth for the season. This is where the real work starts. The manual is organized into sections covering the game overview, the arena and field elements, robot construction rules, the detailed game rules and scoring, the inspection checklist, and the tournament structure. It's long, often well over a hundred pages, and it uses precise, lawyer-like language for a reason: the exact wording of a rule decides what's legal and how points are scored.

One thing rookies miss: the manual is a **living document**. FIRST releases weekly **Team Updates** throughout build season that correct, clarify, and sometimes change rules. A rule you designed around in week one can be amended in week three, so someone on your team needs to read every Team Update as it comes out.

### The field drawings and CAD

Alongside the manual, FIRST releases the official **field drawings** and CAD models of the field elements. These give you real dimensions: how tall the goal is, how wide the gaps are, how heavy the game pieces are, what the field surface is. This is the data your design has to respect. If your mechanism needs to reach 6 feet 6 inches, you find that number here, not by eyeballing the animation.

## What's in the Kit of Parts (and what isn't)

Alongside the game, FIRST makes the season's **Kit of Parts** available: not one big box anymore, but a mix of a physical control-system kit, **FIRST Choice** credits for an online store of donated parts, and **Product Donation Vouchers** from sponsors like REV, AndyMark, and Digi-Key. Rookie teams get a fuller kit meant to get a basic robot driving; veterans get a lighter one focused on that year's control-system updates.

For Kickoff day itself, only two things about the kit really matter. It's a **starting point, not a shopping list** — most competitive robots are mostly bought or fabricated on top of it. And FIRST usually publishes an **"Everybody Can Play" KitBot** shortly after Kickoff: a simple, proven robot that scores in that year's game, and a genuinely smart plan for a rookie or resource-limited team, because a reliable simple robot beats an ambitious broken one every time. For the full breakdown of what's in the kit and how the credits and vouchers work, see our lesson on [registering a new team and the Kit of Parts](/guides/getting-started/getting-started-your-first-steps/new-team-registration-and-kit).

## What your team should actually do on Kickoff day

The reveal wraps up within about an hour. The temptation is to immediately start sketching a robot. Resist that. The best teams spend Kickoff day understanding the game, not designing for it. A rough playbook:

1. **Watch the reveal together**, then watch it again while pausing to note every scoring action.
2. **Read the manual as a group.** Split it up if you have to, but everyone should read the game rules and scoring section carefully. Assign one person to become the "rules expert" who owns the manual and every Team Update for the rest of the season.
3. **Rank the ways to score.** List every task in the game and estimate how many points each is worth and how hard it looks. This is your first cut at strategy.
4. **Do a field walkthrough** using the drawings and CAD, so you understand real distances and heights.
5. **Talk strategy before geometry.** Decide what you want the robot to *do* (which two or three scoring objectives) before anyone draws a single bracket. The classic mistake is designing a cool mechanism and then discovering it chases low-value points.

Notice that scoring analysis shows up on day one. Kickoff is where **scouting and strategy** thinking begins, not something you bolt on at your first event. If you want to get sharper at reading a game and picking priorities, our [scouting and strategy guides](/guides/scouting-strategy) walk through how good teams turn a fresh game into a plan.

Most teams do *not* finalize a design on Kickoff day, and that's correct. Day one is for shared understanding. The design converges over the following week as you prototype.

## How to prepare before Kickoff

Here's the part that separates smooth seasons from chaotic ones: the most important Kickoff prep happens in November and December, before you know anything about the game.

- **Get your tools and shop ready.** You do not want to spend build season hunting for a drill or waiting on a tool order. Sort your workspace, inventory your stock, and make sure your fabrication basics (cutting aluminum, drilling, tapping) are working.
- **Update your software toolchain.** The new season's **WPILib** release typically becomes available right around Kickoff, along with updated vendor libraries (vendordeps) from REV and CTRE for their motor controllers. Install the new WPILib version and confirm your programmers can build and deploy a blank project *before* the game drops. Losing the first week to a broken toolchain is a real and avoidable failure. Our lesson on [installing WPILib and the FRC game tools](/guides/programming-software/foundations-tools-and-first-program/installing-the-toolchain) walks through it from scratch.
- **Train your electrical and wiring people.** A large share of robot failures at events are electrical, and Kickoff is too late to learn crimping and CAN-bus basics. Get people comfortable with the control system in the offseason. Start with our [Electrical and Wiring guides](/guides/electrical-wiring).
- **Learn the vocabulary.** If terms like autonomous, teleop, roboRIO, alliance, or district are fuzzy, skim our [glossary](/glossary) so the manual and the broadcast make sense.
- **Follow a learning path as a team.** Rather than everyone studying random topics, put new members on a structured track. Our [learning paths](/paths) sequence the fundamentals per department so your whole team walks into Kickoff able to contribute.

The teams that stumble in the first two weeks of build season are almost always the ones that spent those weeks *learning basics* instead of building. Do the learning now.

## After Kickoff: the six weeks that follow

Kickoff kicks off (yes) the **build season**, which now runs seven to eight weeks or more from that Saturday until teams head to their first competition, since FIRST's calendar has stretched a bit longer than the classic six-week build season. Since FIRST removed the old "stop build day" and robot-bagging requirement, teams now have continuous access to their robot right up until events, so how you pace those weeks is on you. The broad arc is familiar: prototype and lock strategy first, then design and fabricate, then wire and program on real hardware, and spend the final week making the robot reliable rather than adding features. Then competition season runs roughly from March into April at Regional or District events, with the top teams advancing toward the FIRST Championship. For the full week-by-week plan, and where those six weeks sit in the larger FRC calendar, see our lesson on [the annual season from Kickoff to Championship](/guides/getting-started/the-season-and-the-game/annual-season-kickoff-to-championship).

## The mindset that matters most

Kickoff feels like a starting gun, and it is, but the goal on day one is not to win the race in the first hour. It's to understand the game deeply and make calm, honest decisions about what your team can actually build in six weeks. The community is genuinely helpful here. Watch how veteran teams break down the game on Chief Delphi in the days after Kickoff, and lean on the experienced teams near you.

Prepare in the offseason, read the manual like it's law, prioritize scoring before styling a mechanism, and keep the robot as simple as your competitive goals allow. Do that, and Kickoff goes from overwhelming to the best day of your year. When you're ready to train your team for the next one, start with the [free department guides on LearnFRC](/guides).`,
  },
  {
    slug: "how-frc-competitions-work",
    title: "How FRC Competitions Work: Matches, Ranking Points, Alliances, and Playoffs",
    description:
      "How FRC competitions work: qualification matches, ranking points, alliance selection, and the double-elimination playoff format, explained for new teams.",
    keywords: [
      "how do FRC competitions work",
      "FRC ranking points",
      "FRC alliance selection",
      "FRC playoffs format",
      "FRC qualification matches",
      "FRC double elimination",
    ],
    date: "2026-07-03",
    readMins: 7,
    content: `FRC competitions run in two phases at every event: a round of qualification matches where randomly assigned three-team alliances play for **ranking points**, followed by a playoff tournament where the top-ranked teams draft their own alliances and fight through a bracket. Each match is about two and a half minutes long and pits two alliances against each other — a red alliance and a blue alliance, three robots each — and your job across the day is to rank high enough to either captain a playoff alliance or get picked for one.

If you have watched a stream and felt lost about why teams that lost a match still looked happy, or why the "top team" didn't automatically win, this is the article that untangles it. The format is genuinely different from a normal sports tournament, and once it clicks, watching FRC gets a lot more fun.

## The event structure: Regional vs. District

Where you compete depends on your region. Some parts of the world run large standalone **Regional** events; others use the **District** model, a series of smaller events that feed into a District Championship. Either way, a single event follows the same two-part shape: qualification matches first, then playoffs. A typical event runs two to three days, and your robot will play somewhere around **8 to 12 qualification matches** before playoffs even start.

The important mental model: qualifications are not the tournament. They are the ranking round that decides who *gets* to draft alliances for the tournament. You can go 6-6 in quals and still win the whole event if the right captain picks you.

## Anatomy of a single match

Every match is played by six robots split into two alliances of three — red against blue — scoring on opposite ends of a field roughly the size of a basketball court. A match runs **about 2 minutes 30 seconds** and moves through three phases: a short **autonomous** opening (usually around 15 seconds) where robots run entirely on pre-written code with no driver input, a **teleoperated** period that is the bulk of the match, and an **endgame** in the final 20 to 30 seconds where teams do something high-value like climbing or parking. Whichever alliance scores more wins.

Two of those phases reward specialized work. A reliable autonomous is almost entirely a software and tuning problem — this is where all that [WPILib and sensor work](/guides/programming-software) pays off — and endgame is frequently where matches are won or lost, so drive teams practice those final seconds obsessively (our [Drive Team guides](/guides/drive-team) cover driver, operator, and coach, and there's a full lesson on [endgame execution](/guides/drive-team/driver-practice-and-match-performance/endgame-execution)). For a phase-by-phase breakdown with examples from recent games, see our lesson on [how a match works](/guides/getting-started/the-season-and-the-game/how-a-match-works).

In qualifications, though, winning the match isn't the whole story — because of how ranking works.

## Ranking points, explained

This is the part that confuses newcomers most. You are **not** ranked by how many matches you win. You are ranked by **ranking points (RP)**, and you earn RP whether you win, tie, or hit specific in-game objectives. Winning a match is worth the most; a tie is worth less; and **bonus RP** stack on top for completing game-specific challenges like scoring enough game pieces or getting enough robots to climb. The exact values change every season, so confirm them against the current game manual — but the framework has held for years.

That structure is why an alliance can lose a close match and still walk away happy: the bonus RP it earned are banked by every team on the alliance regardless of the result. Teams are then ranked by **average RP per match** (often shown as "Ranking Score"), with the game manual defining the tiebreakers when teams are level. The top-level rule never changes: **stack RP, not just wins.** For the full RP-and-tiebreaker mechanics, see our lessons on [alliances, scoring, and ranking points](/guides/drive-team/prerequisites/alliances-scoring-and-ranking-points) and [reading FRC rankings](/guides/scouting-strategy/data-analysis-tba-statbotics/reading-frc-rankings).

Because RP is shared across your randomly assigned three-team alliance, your ranking depends partly on your partners. That randomness is intentional: it rewards robots that are consistently useful to *whoever* they're paired with — exactly the kind of robot alliance captains want to pick later.

## Alliance selection: the draft

Once qualification matches end, the event pauses for **alliance selection**, where FRC turns into something like a sports draft on the field. The **top eight ranked teams become alliance captains** and take turns picking partners out loud, in a **serpentine (snake) order** — Captain 1 through 8, then back from 8 to 1 — so that after two rounds each alliance has three teams (many events also allow a **backup** robot). The reverse second round is a deliberate balance for the lower captains. The exact pick order, timer, and decline procedure are governed by precise rules, which our lesson on [alliance selection at the event](/guides/scouting-strategy/strategy-picklists-and-match-play/alliance-selection-at-event) lays out in full.

A few things trip up rookies. A picked team can **decline**, though at most events that's rare — a playoff spot is a playoff spot. And being ranked #1 doesn't guarantee a trophy; it guarantees you pick first, which is an advantage, not a win. Above all, this is why **scouting is not optional**: you pick partners on data, not vibes, and teams that scout well draft better. If you're building that pipeline, start with our [Scouting & Strategy guides](/guides/scouting-strategy) and the lesson on [building a picklist](/guides/scouting-strategy/strategy-picklists-and-match-play/building-a-picklist).

By the end you have eight alliances of three (sometimes four) teams, seeded 1 through 8, ready for the playoffs.

## The playoff format: double elimination

Modern FRC playoffs use a **double-elimination bracket** among the eight alliances: an alliance has to lose **twice** to be knocked out. One loss drops you into the lower bracket, where you can fight your way back; only a second loss ends your run. That's why you'll see an alliance lose early, vanish for a while, and reappear deep in the tournament. Matches are still three-on-three, but now there are no ranking points — it's straight win-or-lose — and the bracket resolves into two finalists and a **best-of-three final**, which the first alliance to win twice takes. Our lesson on [alliances, rankings, and playoffs](/guides/getting-started/the-season-and-the-game/alliances-rankings-and-playoffs) walks the bracket step by step.

Two practical notes. Playoffs run fast and physical, and robots break, so a strong alliance prizes a reliable partner over a flashy-but-fragile one — and legal defense becomes its own skill (see [playing and surviving defense in eliminations](/guides/drive-team/advanced-strategy-case-studies/defense-in-eliminations)). Because it's double elimination, a single bad match — a dead battery, a jammed mechanism, a penalty — usually isn't fatal, which rewards teams that stay calm and fix their robot between matches. A large share of mid-event failures trace back to electrical issues, which is why our [Electrical & Wiring guides](/guides/electrical-wiring) exist largely to keep you off the disabled list.

## How you actually advance

Winning the event is the headline path forward, but not the only one — and what advancement looks like depends on your region's model. **Regional events** send the winning alliance and certain award winners to the **FIRST Championship**, most notably the team that wins the **Impact Award**, FRC's most prestigious award — though winning it no longer guarantees a Championship berth by itself. Regional advancement now runs on an event points system, and a Regional Impact Award winner who hasn't already qualified through points is instead offered a remote interview for a shot at the award at the Championship level. **District events** instead award **district points** for how you finish — ranking, whether you captained or were picked, playoff run, and awards — and those points accumulate across your events to decide who advances to the District Championship and on to Worlds. Our lesson on [the annual season, from kickoff to championship](/guides/getting-started/the-season-and-the-game/annual-season-kickoff-to-championship) maps the full path, and [how the Impact Award advances](/guides/impact-award/building-a-program-worth-recognizing/advancement-and-hall-of-fame) covers the award route.

The takeaway is that "doing well" at an FRC event is broader than winning matches. Ranking, being draftable, playoff performance, and awards all feed into whether your season continues. A team can have a mediocre robot and still advance on the strength of its outreach and Impact submission — which is the whole point of a program that's about more than just the machine.

## Putting it together

Here's the full arc of an event in one breath: you play a batch of **qualification matches** in random alliances, earning **ranking points** for wins and bonus objectives; those RP set your **ranking**; the top eight teams become captains and run a **serpentine draft** to build playoff alliances; those alliances battle through a **double-elimination bracket** into a **best-of-three final**; and your placement plus any awards decide whether you advance.

None of it requires memorizing this year's specific point values — those live in the game manual and change every January. What stays constant is the shape: rank, get picked, survive the bracket. Once you've got that, you can watch any FRC match and actually follow the story.

If you're brand new to all of this, start with our [Getting Started guide](/guides/getting-started) for the big picture, keep the [glossary](/glossary) open for the acronyms that fly around at events, and browse the [learning paths](/paths) to train up whatever role you're taking on this season.`,
  },
  {
    slug: "first-frc-competition-what-to-expect",
    title: "Your First FRC Competition: What to Actually Expect",
    description:
      "What to expect at your first FRC competition: the day-by-day schedule, pit setup, robot inspection, matches, and a full what-to-bring checklist for rookies.",
    keywords: [
      "first FRC competition",
      "FRC competition day",
      "what to bring FRC event",
      "FRC pit setup",
      "FRC robot inspection",
      "FRC rookie tips",
    ],
    date: "2026-07-03",
    readMins: 8,
    content: `Your first FRC competition is a two- or three-day marathon where your team sets up a pit, passes robot inspection, plays a schedule of qualification matches, and — if you rank well or get picked — competes in a double-elimination playoff. Expect long days, a loud venue, a robot that breaks and gets fixed repeatedly, and far more help from strangers than you would ever guess.

Knowing the rhythm ahead of time is the single biggest thing that separates a calm rookie team from a panicked one. Here is what actually happens, in order, and what to have ready.

## The shape of the weekend

Events come in two formats, and the schedule differs a little between them. **District events** usually run two days (often Friday–Saturday). **Regional events** usually run three days (often Thursday–Saturday). Either way, the flow is the same: set up, get inspected, practice, play qualifications, then alliance selection and playoffs on the final day.

Days are long. Doors frequently open around 7–8 a.m. and the venue does not clear out until early evening. Bring the whole team prepared to be there all day, not to swing by for a couple of matches.

### Move-in and pit setup

The first thing you do is find your **pit** — your team's assigned workspace on the pit floor. A standard pit is roughly 10 feet by 10 feet, though this varies by venue, so check your event's specifics. This is where your robot lives, gets repaired, and gets staged between matches.

Set up with function in mind, not looks. You want your tools reachable, your battery charging station running immediately (batteries take time to charge, and you will never have enough), and a clear path to roll the robot in and out on its cart. Get power sorted early: bring a heavy-duty extension cord and a power strip, because the outlet may not be where you want it.

Pit setup is also when reality hits that a lot of small things travel with the robot. A folding table, a labeled parts bin, spare bumpers, and a printed pit checklist do more for you here than a fancy banner.

### Robot inspection

Before you can play a real match, your robot has to pass **inspection** (the volunteers who run it are called Robot Inspectors, or RIs). A volunteer inspector walks through a checklist to confirm your robot is legal and safe: weight, size, frame perimeter, bumpers, wiring, and the control system.

Do not guess at the limits — they shift year to year, so the current game manual is always the source of truth. Rather than build to numbers you half-remember, work from our lesson on [inspection-day failures](/guides/getting-started/common-mistakes-troubleshooting/inspection-failures), which lists the exact bumper, size, and weight figures rookies get bounced on. A few things that trip up first-timers at inspection:

- **Bumpers.** You need both a red set and a blue set, built to spec, covering the required fraction of your frame perimeter with the number visible. Bumper construction rules are strict; read them carefully in the [Mechanical & Build guides](/guides/mechanical-build) and the manual.
- **Wiring.** Correct main breaker, proper wire gauges, a fuse/breaker on every branch, and a securely mounted battery. A large share of failed inspections and dead robots come down to electrical, so tidy it up in advance — our [Electrical & Wiring guides](/guides/electrical-wiring) walk through what inspectors look for.
- **A single, secured battery** with a legal connector, and nothing that can short.

Get inspected as early as possible on day one. If something is wrong, you want hours to fix it, not minutes.

### Practice matches

On the first day (three-day Regionals especially), you usually get **practice matches**. These are not scored and do not affect your ranking. Their entire purpose is to let you connect to the field, drive on the real carpet, test your autonomous routine, and shake out problems before it counts.

Treat practice as gold. This is where you confirm your robot actually connects to the **Field Management System (FMS)** — the field takes control of your robot the moment you plug into its ethernet, and if your code, radio, or driver station has a problem you want to find it here, not in a match that counts. Drill the exact [pre-match connection routine that prevents a no-show](/guides/drive-team/driver-station-and-controls/connecting-to-the-field-and-fms) before you go.

### Qualification matches

The bulk of the weekend is **qualification matches** ("quals"). Every team plays a schedule of them — usually somewhere between about 8 and 12 depending on the event size — and the outcomes build your [ranking](/guides/getting-started/the-season-and-the-game/alliances-rankings-and-playoffs).

A few things about quals that surprise first-timers:

Your alliance partners are randomized and change every match. Each match pits a **red alliance of three robots against a blue alliance of three robots**, and you are teamed with different partners nearly every time. That means cooperation is the whole game — you win with partners you met an hour ago.

The match schedule is posted, and you are responsible for getting your robot to the **queue line** on time, typically a few matches ahead of yours. Miss the queue and you risk a no-show, which hurts your ranking and wastes a match. Assign someone to watch the schedule and the queue all day.

Between matches you are on a [tight turnaround loop](/guides/drive-team/the-pit-and-match-turnaround/pit-crew-roles-and-turnaround): play, roll back to the pit, swap to a freshly charged battery, diagnose anything that broke, fix it, and queue again. Rookie robots break. That is normal. The teams that do well are the ones who repair fast and calmly.

### Alliance selection and playoffs

On the final day, ranking closes and **alliance selection** happens — a live [serpentine draft](/guides/scouting-strategy/strategy-picklists-and-match-play/alliance-selection-at-event) in which the top eight ranked teams become alliance captains and take turns picking the rest of the field into eight playoff alliances of (usually) three robots each, sometimes with an optional backup.

This is why scouting matters. Captains pick based on data about who plays well and who complements their robot, not on vibes. Even as a rookie, keep a scout or two watching matches and recording notes — being a team others want to pick is a real goal, and good [Scouting & Strategy](/guides/scouting-strategy) habits are how you get noticed. Getting picked in your rookie year is a genuine win.

Playoffs run as a **double-elimination bracket** among the eight alliances, so a single loss does not end your day — you drop to the lower bracket and can fight back. The bracket culminates in the finals. Doing well here matters beyond the trophy: at Regionals, FIRST now uses a points system that combines qualification performance, playoff results, and judged awards, and the top point-scorers at each event (not simply whoever wins) earn a berth at the FIRST Championship; in the district system, points instead accumulate toward a District Championship. Check the current season's advancement rules for the exact thresholds.

## What a match actually feels like

A match runs just a couple of minutes and moves fast. It opens with a short **autonomous period** — your robot on pre-written code with no driver input — then transitions into the longer driver-controlled teleop period, usually with a scramble of endgame scoring at the very end. If the [rhythm of a match](/guides/drive-team/prerequisites/how-an-frc-match-is-structured) is new to your drive team, walk through it before you arrive; check the current manual for the year's exact timings and scoring.

Your **drive team** stands at the alliance station behind the field wall — typically a [driver, an operator, a coach, and often a human player and a technician](/guides/drive-team/the-drive-team-and-its-roles/what-the-drive-team-is), each with a defined role and spot. You get a short, fixed window to plug in and set up your driver station before the match starts, so practice that routine until it is automatic. The field is loud, the referees are watching, and the whole thing is over before you catch your breath. It is genuinely thrilling — and completely survivable.

## What to bring to an FRC event

Pack like the venue has nothing, because it mostly does not. The essentials:

- **Safety glasses for everyone** — ANSI Z87-rated eye protection is [required any time you are in the pits or at the field](/guides/safety/events-and-program/event-and-pit-rules), no exceptions. Bring spares; people forget theirs.
- **Closed-toe shoes** are required on the pit floor. No open shoes get in.
- **Your full tool kit** — the tools you used to build the robot, plus zip ties, tape, wire, crimpers, a multimeter, and hardware in the sizes your robot uses.
- **Spare parts** — anything you can imagine breaking: a spare battery or three, extra motors and controllers if you have them, spare bumper fasteners, wheels, chain/belt, and fuses.
- **A battery charger** (ideally more than one) and a way to [log which battery is charged and rested](/guides/drive-team/the-pit-and-match-turnaround/battery-management).
- **A programming laptop** with WPILib and your current robot code, plus your driver station, an ethernet cable, and any radio configuration tools. Keep a known-good version of your code you can re-deploy.
- **Power and workspace** — extension cord, power strip, a small folding table, and a robot cart.
- **Scouting materials** — printed sheets, tablets, or whatever your system uses, and people assigned to run it.
- **Human fuel** — water, snacks, and lunch plans. Venues get hot and food lines get long.

A printed pit checklist taped to your table, and a whiteboard for the match schedule and battery status, keep a rookie team from losing track of the chaos.

## Rookie mindset that actually helps

The biggest surprise for most first-year teams is how generous the community is. FIRST calls it **[Coopertition](/guides/getting-started/culture-teams-and-roles/core-values-gp-and-coopertition)** — you compete hard while helping the people around you. If you blow a motor and do not have a spare, ask a neighboring team; someone almost always has one. Veteran teams will lend parts, lend hands, and answer questions all weekend. Ask early and ask often.

Set the right goal. Your first event is not about winning — it is about getting your robot inspected, connecting to the field, playing every match you are scheduled for, and going home with a team that wants to come back. If you do that, you had a great rookie competition.

Spend the weeks before the event getting your people ready, not just your robot. Make sure your drive team has practiced, your pit crew knows the repair routine, and your electrical is clean enough to survive a full day of matches. If you are still getting your bearings, start with our [Getting Started guide](/guides/getting-started), and if a term at the event leaves you lost, our [glossary](/glossary) has the FRC vocabulary you will hear announcers and volunteers throwing around all weekend.

Show up, stay calm when the robot breaks, help the teams around you, and soak it in. Your first competition is loud, exhausting, and one of the best things you will do all season.`,
  },
  {
    slug: "frc-control-system-explained",
    title: "The FRC Control System Explained: roboRIO, PDH, Radio, and Everything Between",
    description:
      "The FRC control system explained: how the roboRIO, REV PDH, radio, motor controllers, and CAN bus connect to make your robot drive \u2014 a plain-English electronics board tour.",
    keywords: [
      "frc control system",
      "roboRIO explained",
      "frc electronics board",
      "REV PDH",
      "frc radio",
      "frc CAN bus wiring",
    ],
    date: "2026-07-03",
    readMins: 8,
    content: `The FRC control system is the collection of legal electronics that lets your robot receive commands and drive motors: a **roboRIO** as the brain, a **power distribution hub** feeding everything from the battery, a **radio** that carries data to and from the driver station, and the motor controllers, breakers, and wiring that tie it together. If you can name each box and trace how power and signals flow between them, you understand the whole board — and you'll pass inspection a lot faster.

This is the one subsystem every team has to get right. A brilliant mechanism bolted to a sloppy control system just sits there and blinks error codes. This is the map of every major component and how the pieces connect — not the connector-by-connector build. When you're ready to actually run wire and crimp, our [how to wire an FRC robot](/blog/how-to-wire-an-frc-robot) guide walks the physical assembly; here we name the boxes and trace the flow so the wiring guide makes sense when you get there.

## The mental model: power flows one way, data flows both ways

Before the parts list, hold this in your head. **Power** starts at the battery, passes through a big main breaker, lands on the power distribution board, and fans out to every motor controller and electronic. **Data** is separate: the driver station laptop talks to the radio over the field network, the radio talks to the roboRIO over Ethernet, and the roboRIO talks to motor controllers over a communication bus called CAN. Power and data are two different plumbing systems that happen to share the same robot.

Almost every wiring mistake rookies make is confusing those two — running signal wire where a 40-amp motor branch should be, or forgetting that the radio needs both a data connection and its own power. Keep them mentally separate and the board stops being intimidating.

## The roboRIO: the brain

The **roboRIO** (currently the roboRIO 2.0) is the official robot controller, made by National Instruments. It's the only device on the robot that runs your code. When you deploy a program written with **WPILib** in Java, C++, or Python, it runs on the roboRIO's real-time Linux processor about 50 times a second, reading inputs and sending outputs on every loop.

Physically it's a metal box covered in ports: **Ethernet** to the radio, a **CAN** bus out to your motor controllers and sensors, and **PWM, DIO, and analog** headers plus **USB** and the **MXP** expansion port for everything that doesn't speak CAN. Our lesson on [the roboRIO](/guides/electrical-wiring/control-system-components/the-roborio) walks the full I/O and how each port is powered. The one rule to carry from here: the roboRIO gets clean, regulated power on a dedicated channel from the power board — never wire it to a random 40A motor channel.

If you're the one writing the code that lives here, our [Programming & Software guides](/guides/programming-software) walk through WPILib from install to your first working robot, and the [become a robot programmer path](/paths) sequences it lesson by lesson.

## Power distribution: the PDH (and PDP)

Every powered device on the robot draws from one board. Most teams now run the **REV Power Distribution Hub (PDH)**; the older, still-legal option is the **CTRE Power Distribution Panel (PDP)**. They do the same job: take one thick pair of wires from the battery and split it into many individually-protected channels — a mix of high-current channels for motors and lower-current ones for electronics, plus, on the PDH, a software-switchable channel you can toggle over CAN. The exact channel counts and current ratings are worth confirming against current REV or CTRE documentation; our lesson on [PDH vs PDP](/guides/electrical-wiring/control-system-components/power-distribution-pdh-vs-pdp) lays both boards out side by side. The concept never changes: one motor branch, one channel, one breaker sized to that motor.

The breaker matters. A typical brushless drive motor lives behind a **40A** breaker; smaller mechanisms use 30A or 20A. The breaker is auto-resetting — if a motor stalls and pulls too much current, the breaker pops, the motor stops, and a few seconds later it resets. That's a feature, not a failure, and it's why you never bypass one. [Branch circuit breakers and fuses](/guides/electrical-wiring/power-battery-breakers/branch-circuit-breakers) covers which protection is legal and how to size it.

## The battery, the main breaker, and the RSL

The robot runs on a single **12-volt, ~18Ah sealed lead-acid battery**, and a weak or half-charged one is behind a huge share of "the robot got sluggish in the last 30 seconds" complaints. Number every battery, log its cycles, and rotate them — our lessons on [the 12V battery and Anderson connectors](/guides/electrical-wiring/power-battery-breakers/battery-and-anderson-connectors) and [battery management like a pro team](/guides/electrical-wiring/advanced-techniques-case-studies/battery-management-program) cover the specs, legal rules, and load-testing that keep you on a strong pack.

Between the battery and the power board sits the **120A main breaker** — one big red button that is the master cutoff for the entire robot. Everything downstream of it dies when it's off, which is exactly what you want during pit work. The battery connects through an **Anderson SB connector** and heavy **6 AWG** wire; that gauge is a rules requirement on the main run, not a suggestion. See [the main 120A breaker](/guides/electrical-wiring/power-battery-breakers/main-120a-breaker) for how it wires in and why it's the true master switch.

One small part with big consequences: the **Robot Signal Light (RSL)**. It's a required amber light that shows the robot's state — solid when disabled, blinking when enabled — and an inspector will fail you without one. It's easy to skip in the rush of build season and easy to fix once you know it's mandatory.

## The radio: how the robot talks to the driver

The **radio** is the robot's connection to the outside world. On the field, your **driver station** laptop (running the FRC Driver Station and the FRC Game Tools) connects to the field network, the field talks to your robot's radio, and the radio hands that data to the roboRIO over Ethernet. No radio link, no control — the robot just sits there disabled.

The specific radio has changed recently, so check the **current game manual and Kit of Parts** rather than trusting last year's memory: recent seasons (2025 onward) use the **Vivid-Hosting VH-109**, powered through a dedicated **Radio Power Module (RPM)**, while older robots used the **OpenMesh OM5P-AC**. This is one of the few control-system pieces FIRST has actively swapped out, and how it must be powered is exactly what our lesson on [the radio, VRM, and Radio Power Module](/guides/electrical-wiring/control-system-components/radio-vrm-rpm) pins down for the current season.

Two habits save event-day panic: give the radio its **own regulated power path** (never straight off a motor channel), and mount it high and away from big metal and motors so its signal isn't shielded. A radio buried at the bottom of the frame is asking for dropped connections mid-match.

## Motor controllers and the CAN bus

A roboRIO can't drive a motor directly — it sends a low-power command to a **motor controller**, which switches the real current from the power board into the motor. The lineup shifts year to year (REV's **Spark MAX** and **Spark Flex**, CTRE's **Talon FX** built into integrated motors like the Kraken X60 and Falcon 500, plus the Talon SRX and Victor SPX); our [motor controller lineup](/guides/electrical-wiring/motor-controllers-can-bus/motor-controller-lineup) lesson matches each controller to the motors it drives.

Controllers talk to the roboRIO one of two ways. **PWM** uses one signal wire per controller with no data coming back. **CAN** is the modern default: a single two-wire bus that daisy-chains through every device, each with its own ID, carrying commands out and rich telemetry (current, temperature, encoder position) back. Most competitive robots put nearly everything on CAN because that feedback is what makes precise control and on-robot diagnostics possible — [PWM vs CAN control](/guides/electrical-wiring/motor-controllers-can-bus/pwm-vs-can) covers when each still makes sense.

The CAN bus has two rules people forget until it breaks. It must be a continuous chain with a **120-ohm termination resistor** at the end (the PDH has one built in), and a single broken CAN connection can drop every device downstream of it. When "half the robot stopped responding," a loose CAN wire is the first suspect. Spend real time in [building a reliable CAN bus](/guides/electrical-wiring/motor-controllers-can-bus/building-a-reliable-can-bus) before you need it, and keep [diagnosing CAN bus failures](/guides/electrical-wiring/common-mistakes-troubleshooting/can-bus-failures) bookmarked for when yours misbehaves — clean CAN is the difference between a robot that finishes matches and one that doesn't.

## The supporting cast: VRM and coprocessors

A couple of extra boxes show up on more advanced robots. The **Voltage Regulator Module (VRM)** takes battery voltage and outputs steady, regulated 12V and 5V rails for devices that hate the voltage sag of a hard-driving robot — LED strips, some sensors, and, on older setups, the radio. As batteries droop under load, regulated power keeps these devices happy.

Many teams also add a **coprocessor** — a Raspberry Pi, an Orange Pi, or a Limelight smart camera — for vision processing that would bog down the roboRIO. It connects to the roboRIO through a small **Ethernet switch** so the radio, roboRIO, and coprocessor all share the robot's network. It's optional, but it's how teams get reliable target tracking and vision-assisted scoring — [AprilTags and vision coprocessors](/guides/programming-software/vision-pose-estimation/apriltags-and-coprocessors) picks up where this leaves off.

## How it all connects, in order

Trace a working robot from the battery out and it always goes the same way (our [full robot wiring walkthrough](/guides/electrical-wiring/connections-rules-troubleshooting/full-robot-wiring-walkthrough) builds exactly this, connection by connection):

1. **Battery** → **120A main breaker** → **power distribution board (PDH/PDP)**.
2. From the board: a dedicated regulated channel to the **roboRIO**, one fused channel per **motor controller**, and a clean power path to the **radio** (via its RPM or a VRM).
3. **Radio** → Ethernet → **roboRIO**.
4. **roboRIO** → **CAN bus** daisy-chained through the motor controllers and CAN sensors (with termination at the end).
5. The **RSL** wired in so it reflects robot state.

If you can point at each of those five links on a real robot, you can debug most control-system problems and you can talk an inspector through your board without sweating.

## Where to go next

The control system is one of those topics that feels like a wall of acronyms until you've wired it once, and then it clicks for good. If the vocabulary is what's tripping you up, keep the [glossary](/glossary) open in another tab — roboRIO, PDH, VRM, RSL, and CAN all live there with plain-English definitions. If you're brand new to the whole program, start with [Getting Started](/guides/getting-started) for the big picture. When you're ready to go component by component in depth, [what is the FRC control system?](/guides/electrical-wiring/control-system-components/what-is-the-frc-control-system) opens our full [Electrical & Wiring guides](/guides/electrical-wiring) — the place to actually wire a board with this map in hand. Learn this board well and you become the person every FRC team is desperate to have: the one who can make the robot actually turn on.`,
  },
  {
    slug: "frc-battery-guide",
    title: "FRC Battery Guide: Charging, Care, Testing, and Safety",
    description:
      "FRC battery guide: how to charge, care for, test with a Battery Beak, wire the SB50 connector, and safely handle your 12V FRC battery fleet.",
    keywords: [
      "frc battery",
      "frc battery charging",
      "frc battery maintenance",
      "frc battery beak",
      "sb50 connector",
      "frc battery safety",
    ],
    date: "2026-07-03",
    readMins: 8,
    content: `An FRC robot runs on a single **12-volt, roughly 18-amp-hour sealed lead-acid (SLA) battery**, and looking after it is one of the cheapest ways to make your robot more reliable. A battery that's fully charged, rested, and low on internal resistance is the difference between a robot that drives strong for a full match and one that browns out with thirty seconds left on the clock.

Batteries are the single most neglected part of most rookie robots. Teams pour hours into a shooter mechanism and then run every match on the same tired battery straight off the charger. This guide covers what the battery is, how to charge and store it, how to test it with a Battery Beak, how the SB50 connector fits into the power path, and how to handle all of it safely.

## What an FRC battery actually is

Every legal FRC robot uses one **12V SLA (sealed lead-acid) battery**, also called an AGM battery. Nominal capacity is around 18 Ah, and a full one weighs about 12.6 lb (5.7 kg). It is a genuinely heavy, genuinely hazardous chunk of lead and sulfuric acid, not a hobby-grade LiPo.

The one number worth memorizing is the resting voltage: a fully charged battery reads roughly **12.7 to 13.5 V at rest** (no load). If a "charged" battery is sitting at 12.3 V, it isn't actually full. Under the load of a match, voltage sags, and a weak or half-charged battery sags further and sooner — far enough to trip the roboRIO's **brownout protection**, which sheds motor output and makes the robot feel sluggish or cut out late in a match. Our lesson on [why the robot goes limp](/guides/electrical-wiring/common-mistakes-troubleshooting/diagnosing-brownouts) walks through the staged brownout thresholds and the systematic fixes.

The rest is rules and specs the game manual pins down: you may run **only one battery at a time**, it has to come from the manual's **approved COTS list** (check the current manual — the list changes), and the main power path uses **6 AWG wire** behind a **120 A main breaker**. Our full lesson on [the 12V SLA battery and Anderson connectors](/guides/electrical-wiring/power-battery-breakers/battery-and-anderson-connectors) covers the specs, the legal rules, and battery care in depth, so this guide stays focused on keeping the battery healthy.

## Charging: do it right, every time

Charge with a smart SLA/AGM charger, and don't rush it. FRC rules **cap how fast you're allowed to charge** — recently the limit has been **6 A** — so a legal charger won't blast current into the battery. Check the current manual for the exact figure, but the practical takeaway is the same: slow, complete charges are healthier than fast ones anyway.

A few habits separate reliable teams from the rest:

- **Charge fully, then let it rest.** A battery straight off the charger is warm and its surface voltage is artificially high. Let it sit **20 to 30 minutes** before a match so the voltage settles and you get an honest reading.
- **Never deep-discharge.** SLA batteries hate being run flat. Every time you drain one down near or below its cutoff, you shave permanent capacity off it. Pull a battery before it's dead, not after.
- **Charge off the robot.** At competition you charge batteries at your pit charging station and swap fresh ones in — never on a powered robot.

Beyond charging technique, the batteries themselves need to be managed as a fleet: numbered, cycle-tracked, and rotated so a tired pack never sneaks into an elimination match. That whole discipline — labeling, load-testing, rotating, and retiring packs — is a topic of its own, and our lesson on [battery management like a pro team](/guides/electrical-wiring/advanced-techniques-case-studies/battery-management-program) lays it out.

### How many batteries you need

Enough that you *always* have a fully charged, fully rested one ready to go. A single battery can't cool down, rest, and recharge in the ~8 to 12 minutes you sometimes get between matches. Most competitive teams own **at least four batteries, and six or more is common.** Rookie teams should budget for a minimum of three. The math is simple: one on the robot, one resting after charging, one on the charger, and spares so an elimination run never forces you onto a hot or half-charged pack. Multi-bank chargers that top off several batteries at once are worth the money for any team running a full event schedule.

## The SB50 connector and the power path

The battery connects to the robot through an **Anderson SB50 connector** — the chunky two-contact plug you unplug every time you swap batteries. From there, power runs to the **120 A main breaker**, then into your power distribution board (a CTRE PDP or a REV PDH), and out to everything else. If wiring that path from scratch is new to you, our companion guide on [how to wire an FRC robot](/blog/how-to-wire-an-frc-robot) walks the whole battery-to-motors chain.

For battery care, the SB50 matters because it's the connector you handle constantly — and it's a very common source of mysterious brownouts, so treat it as a maintenance item, not a fit-and-forget part:

- **It's genderless, so standardize on one color.** The two halves only mate if they share the **same color housing**, so teams pick one (red and gray are both common) and stick with it, so any battery plugs into any robot.
- **Crimp the 6 AWG contacts properly.** A cold or loose crimp adds resistance, and resistance in the main power path becomes voltage sag under load. Doing this connection — and every other one — right is its own skill: see [crimping and connectors done right](/guides/electrical-wiring/connections-rules-troubleshooting/crimping-and-connectors).
- **Keep contacts clean, tight, and restrained.** Corroded or pitted contacts heat up and rob voltage, and vibration slowly works a dangling plug loose over a match. If a connector looks burnt, discolored, or feels loose when mated, replace it.

A robot that browns out only sometimes, seemingly at random, very often has a bad connector or a worn crimp somewhere in this chain, not a bad battery. When you're chasing that gremlin, the SB50 and its contacts are one of the first things to check.

## Testing: the Battery Beak and what the numbers mean

The **Battery Beak** (from CTR Electronics) is a small handheld tester that plugs onto the SB50 and, in a couple of seconds, tells you three things: **resting voltage, internal resistance, and an estimated cranking-amps figure.** Of these, **internal resistance** is the one that actually predicts whether a battery is worth using.

Internal resistance, measured in milliohms (mΩ), is basically how hard the battery fights back when you draw current. Low is good. A fresh, healthy FRC battery typically reads in the **low double digits — roughly 10 to 13 mΩ.** As a battery ages and gets abused, that number climbs. Once a battery drifts up toward the **high teens or into the 20s (mΩ)**, its voltage will sag badly under match load, and it's time to retire it for competition use.

Exact numbers vary by battery model and by tester, so don't obsess over a single reading. The real move is to **Beak your whole fleet and compare.** Rank them by internal resistance, keep your lowest-resistance batteries for elimination matches, and pull the outliers — a battery that reads 8 mΩ higher than the rest of your fleet is your weak link, whatever the absolute number says. Turning that into a repeatable, logged process is a project in itself: our [battery management and logging system](/guides/safety/safety-worked-examples-mini-projects/battery-management-logging-system) mini-project builds the numbered, tested fleet around exactly this workflow.

You can also watch battery voltage live during a match: the PDP/PDH reports it over CAN, the Driver Station displays it, and you can log it. If you want to pull and record that telemetry so you can correlate voltage sag with what the robot was doing, our [live power-monitoring dashboard](/guides/electrical-wiring/worked-examples-mini-projects/power-monitoring-dashboard) mini-project streams voltage, current, and energy off the power distribution board.

## Care and storage between events and in the off-season

Lead-acid chemistry has one big enemy in storage: **sulfation.** Leave an SLA battery sitting discharged and lead sulfate crystals harden on the plates, permanently killing capacity. So the rule for storage is simple:

- **Store batteries fully charged**, never discharged.
- **Top them off every one to three months** during the off-season — a battery on the shelf slowly self-discharges even with nothing connected.
- **Keep them somewhere cool and dry.** Heat accelerates aging.

Between competition events, treat storage the same way: charge everything up before it goes on the shelf. Come back a couple of weeks later, Beak the fleet, and you'll know exactly what you're working with.

Batteries don't last forever. Under heavy FRC use, a battery is often good for something like one to three seasons before its internal resistance climbs enough to retire it. When you do retire one, **recycle it** — SLA batteries are nearly 100% recyclable, and any auto-parts store or battery recycler will take them. Never throw one in the trash.

## Safety: lead-acid deserves respect

A charged FRC battery can dump **hundreds of amps into a dead short** almost instantly. That's enough to weld a dropped wrench to the terminals, cause serious burns, melt tools, and start a fire. This is not a theoretical risk — it's the most common way people get hurt around the electrical system. The non-negotiables:

- **Never let anything metal bridge the two terminals.** Keep the SB50 connected or the terminals covered whenever a battery is charged. No loose tools, jewelry, or wristbands near exposed terminals.
- **Carry batteries with two hands, and never by the leads.** The case is plastic and it holds sulfuric acid. A cracked case leaks acid, which will ruin the battery and can burn skin and eyes.
- **Retire damaged batteries immediately.** A swollen, cracked, leaking, or physically dented battery is done. Bag it, keep it away from metal, and recycle it. Don't try to squeeze one more match out of it.

There's more to it — ventilated charging, hydrogen venting, spill response — and it's a team-culture habit, not a one-time lesson. Our lesson on [sealed lead-acid battery safety](/guides/safety/battery-pneumatics-electrical/sla-battery-safety) covers handling, charging, inspecting, and disposing of the 12V pack without acid burns or fires, in the context of the rest of your shop and pit practices.

## The short version

If you remember nothing else: **charge fully and let it rest, keep your SB50 connectors clean and tight, Beak your fleet and race your best batteries, store everything charged, and never short the terminals.** None of it costs much, and all of it makes your robot noticeably more reliable when it counts.

New to the electrical side of a team? Start with [Getting Started](/guides/getting-started) for the big picture, then work through the [learning paths](/paths) to build up the rest of your control-system knowledge alongside battery care.`,
  },
  {
    slug: "frc-apriltags-explained",
    title: "AprilTags in FRC: How Robots See the Field",
    description:
      "AprilTags in FRC are the fiducial markers robots use to see the field and know their exact position. How the tags, cameras, and pose estimation actually work.",
    keywords: [
      "apriltags frc",
      "what are apriltags",
      "frc vision tracking",
      "frc pose estimation",
      "frc apriltag detection",
      "photonvision vs limelight",
    ],
    date: "2026-07-03",
    readMins: 8,
    content: `AprilTags are the black-and-white square markers you see mounted around an FRC field, and they work like a QR code that your robot can read from a distance. When a camera on your robot spots one, the robot can figure out exactly where it is standing on the field, because the location of every tag is published before the season starts.

That single capability, knowing your own position accurately, is what makes modern autonomous routines, auto-aiming, and driver-assist alignment possible. Here is how the whole system works, from the pattern on the wall to the pose your code actually uses.

## What an AprilTag actually is

An AprilTag is a *fiducial marker*: a printed pattern designed to be detected quickly and identified reliably by a camera. They were developed by the APRIL robotics lab at the University of Michigan and they long predate FRC, since robotics researchers have used them for years to track objects and localize robots.

Each tag encodes a single number, its **ID**. The grid of black and white squares inside the border is not decoration; it is a binary code with built-in error correction, so a camera can read the ID correctly even at an angle or in mediocre lighting. FRC uses the **36h11** tag family (it switched to 36h11 for the 2024 season, replacing the older 16h5 family used in 2023, the first year AprilTags appeared on the FRC field). Every tag on the field has a unique ID, usually numbered 1 through however many the game uses that year.

The tags are printed at a fixed, known size, roughly 6.5 inches (about 16.5 cm) on the black square, and that known size is what makes the geometry work: because your code knows the tag's real-world dimensions, it can reason backwards from how big and skewed the tag looks in the image to how far away and at what angle the camera must be. Confirm the exact size against the current field drawings, and for the full detail on tag families and the coprocessors that read them, see our lesson on [AprilTags and vision coprocessors](/guides/programming-software/vision-pose-estimation/apriltags-and-coprocessors).

## Where the tags live on the field

Every AprilTag on an FRC field sits at a surveyed, fixed location, and FIRST publishes those locations. WPILib ships this as an **AprilTagFieldLayout**, effectively a lookup table mapping each tag ID to its exact position and orientation. The number of tags and where they sit changes every year with the game, so always pull the current field drawings and layout file from the game manual rather than assuming last year's map.

Those positions live in the standard **WPILib field coordinate system**, the same frame every pose your vision system produces lives in, so getting comfortable with it pays off fast; our lesson on [the field coordinate system and odometry](/guides/programming-software/gyros-imus-orientation/coordinate-system-odometry) walks through how WPILib defines field position with Pose2d and Rotation2d. If terms like *pose*, *fiducial*, or *field-relative* are new to you, our [glossary](/glossary) defines the vocabulary you will hit constantly here.

## How a robot turns a tag into a position

The path from "a camera sees a square" to "my robot is at (4.2, 1.8) facing 30 degrees" runs through three steps, and it is worth understanding the shape of it even when a library does the heavy lifting:

1. **Detection.** The vision software scans each camera frame, finds any AprilTags, decodes their IDs, and locates the four corners of each tag in the image with sub-pixel precision.
2. **Pose solving (PnP).** From those four corners, the tag's known size, and the camera's calibration, the software solves the *Perspective-n-Point* problem to get the tag's 3D pose relative to the camera: how far away it is and how it is rotated.
3. **Transform to the field.** Combine that with where the tag sits on the field (from the AprilTagFieldLayout) and where the camera is mounted on your robot, and you have your robot's pose on the field.

Step two only works if the camera is **calibrated** to its exact lens and resolution; an uncalibrated pipeline produces poses that look plausible but are quietly off by feet, which is one of the most common reasons a team's estimates come out wrong. PhotonVision and Limelight both ship calibration routines, and our lesson on [turning tag detections into a field-relative pose](/guides/programming-software/vision-pose-estimation/vision-pose-estimation-tools) covers the detection-to-pose path in code.

## Pose estimation: fusing vision with odometry

Here is the part that trips people up: you almost never use the raw vision pose by itself. Vision measurements are accurate but arrive intermittently, can be noisy, and lag by a few tens of milliseconds while the coprocessor works. Your drivetrain encoders and gyro, meanwhile, give a smooth, high-rate estimate of motion that slowly drifts over a match. **Pose estimation** fuses the two so you get the best of both: smooth, high-rate, and drift-free.

WPILib does this out of the box with a pose estimator that runs on your odometry and lets you fold in each vision measurement, tagged with the frame's timestamp so the correction lands at the right moment in its history, which is how it compensates for camera latency. You also tell it how much to **trust** vision versus odometry: trust vision too much and your position snaps around every time a tag flickers in and out of view; trust it too little and you never correct odometry drift. That tuning, and the code around it, is where a lot of the real engineering happens, our lessons on [fusing vision with odometry](/guides/programming-software/vision-pose-estimation/fusing-vision-odometry) and [tuning trust with standard deviations](/guides/programming-software/advanced-techniques-case-studies/advanced-pose-estimation-fusion) work through the whole pipeline.

## The tools you will actually use

You do not implement tag detection from scratch. Two solutions dominate FRC. **PhotonVision** is free, open-source software you flash onto a small coprocessor, an Orange Pi, a Raspberry Pi, or similar, paired with a USB camera, with strong WPILib integration and a lot of control. **Limelight** is a self-contained smart camera, camera, coprocessor, and LEDs in one box, that costs more but is close to plug-and-play. Both run AprilTag pipelines, both publish poses over NetworkTables, and both are used by top teams; the pick comes down to your budget and how much you want to tinker versus buy a mostly finished tool. If you are weighing the two head to head on features, latency, and cost, our [getting-started AprilTag vision walkthrough](/guides/getting-started/advanced-techniques-case-studies/apriltag-vision-photonvision) gets a PhotonVision coprocessor reading tags end to end.

One hardware detail matters a lot: use a **global-shutter** camera. A rolling-shutter camera captures the image one row at a time, so a moving robot smears the tag and wrecks the pose solution; a global shutter (built into the Limelight; the Arducam OV9281 is a popular PhotonVision choice) captures the whole frame at once and stays sharp while you drive. Mount the camera rigidly, too, because a bracket that flexes quietly throws off the transform to your robot. That intersects with clean power and wiring, which our [Electrical & Wiring guides](/guides/electrical-wiring) cover.

### Multi-tag solving

A single tag gives you a usable pose, but it can be *ambiguous*: from certain angles the math has two nearly-equal solutions and can flip between them. Seeing two or more tags at once fixes this. Both major platforms support multi-tag solving, PhotonVision through a multi-tag PnP strategy and Limelight through its **MegaTag2** approach, which also folds in your gyro heading to lock down orientation. Whenever your camera can frame more than one tag the resulting pose is far more stable, which is exactly why teams think carefully about camera placement, and why our lesson on [multi-tag fusion](/guides/programming-software/advanced-techniques-case-studies/advanced-pose-estimation-fusion) treats it as a core part of getting to centimeter-level localization.

## What teams actually use this for

The point of all this is not to know your coordinates for their own sake. Accurate pose unlocks a few things that win matches:

- **Auto-aiming and alignment.** The robot drives itself to a precise scoring position, or lines up a shot, without the driver eyeballing it. That is faster and more repeatable under pressure, and our [vision-aligned scoring mini-project](/guides/programming-software/worked-examples-mini-projects/mini-project-vision-aligned-scoring) builds exactly that: an AprilTag aim controller fused with pose estimation to drive up and score.
- **Better autonomous.** Instead of dead-reckoning off encoders alone and slowly drifting, an auton routine can correct its position off tags mid-run and hit its marks reliably across different fields and battery states.
- **Driver assist.** Even in teleop, a button that snaps the robot to a known alignment saves a second or two every cycle, and seconds add up over a match.

Teams that align quickly and score consistently tend to rank higher and get picked, which is why vision quietly became a scouting talking point too.

## Gotchas that bite rookie programmers

A few hard-won lessons save weeks of frustration:

- **Calibrate the camera.** Do the calibration for your exact camera and resolution, or your poses will be quietly off by feet.
- **Reject bad measurements.** Filter out poses from far-away single tags, high-ambiguity detections, and anything that places you off the field. Feeding garbage into the pose estimator is worse than feeding it nothing.
- **Get the timestamps right.** Latency compensation only works if you pass the true capture time. The vision libraries hand you a proper timestamp; use it instead of the current clock time.
- **Mind your coordinate frames.** A large share of vision bugs come down to a sign flip or a swapped axis in the camera-to-robot transform. Measure the mounting position carefully and test against a known spot on the field.

## Where to start

If you are the one setting this up, the realistic path is short: pick PhotonVision or Limelight, get a global-shutter camera calibrated, confirm you can see a tag and read a pose in the web dashboard, then feed that pose into a WPILib pose estimator and drive around watching your position on a field widget. Get that loop working on a bench before you ever try to auto-align at an event.

For the programming fundamentals underneath all of this, our [Become a Robot Programmer path](/paths/become-a-robot-programmer) and the [Programming, Controls & Sensors guides](/guides/programming-software) walk through the control system, sensors, and command-based structure that AprilTag code plugs into. Vision feels like magic the first time your robot locks onto a target on its own, but under the hood it is just a camera, a known map, and some careful geometry.`,
  },
  {
    slug: "frc-scholarships",
    title: "FRC Scholarships: How FIRST Can Help Pay for College",
    description:
      "FRC scholarships explained: how FIRST connects robotics students to tens of millions in college scholarships, who qualifies, the Dean's List Award, and how to apply.",
    keywords: [
      "frc scholarships",
      "first robotics scholarships",
      "first scholarships college",
      "frc dean's list award",
      "first scholarship program",
      "robotics college scholarships",
    ],
    date: "2026-07-03",
    readMins: 7,
    content: `FIRST helps thousands of robotics students pay for college through a dedicated scholarship program that lists tens of millions of dollars in awards from colleges, corporations, and professional organizations. If you're on an FRC team, you already qualify for many of them, and most don't require winning a single match or award.

That last part trips people up, so let's be clear up front: you do not have to be a robot-driving prodigy or your team's lead programmer to get this money. Simply being a student on a registered FIRST team makes you eligible for a large chunk of the scholarships FIRST lists. Here's how the whole thing actually works, and how to make sure you don't leave money on the table.

## How the FIRST scholarship program works

FIRST doesn't hand out most of these scholarships itself. Instead, it runs a **scholarship provider listing** — a searchable database of colleges, universities, companies, and organizations that have committed to funding FIRST students specifically. That listing spans **more than 150 colleges, universities, companies, and organizations**, with awards running well into the tens of millions of dollars — though the exact totals shift every year, so check the current numbers on the [FIRST scholarships page](https://www.firstinspires.org/scholarships).

You search that database, find scholarships you're eligible for, and then apply to each one **directly through the provider** — the college's financial aid office, the company's foundation, or the organization running it. FIRST is the matchmaker, not the bank. Each award has its own application, its own essay prompts, and its own deadline.

The awards range wildly. Some are one-time $500 or $1,000 grants. Others are renewable four-year packages, and a handful are effectively full rides at specific universities. Treat the small ones seriously anyway: three or four $1,000 scholarships stack into real textbook-and-housing money, and the small ones usually have fewer applicants.

## You qualify just for being on a team

The single most important thing to understand is that a big portion of these scholarships are open to **any current FIRST participant**. No award required. No specific GPA in some cases. No "you must have designed the swerve modules." You're a student on a registered FRC (or FTC, or even FLL) team, and that's the entry ticket.

This matters because a lot of students assume scholarships are only for the standout kids — the captain, the CAD lead, the person who gave the big presentation. Not true. Providers fund FIRST students because the program itself is the credential. Showing up, contributing to a real engineering organization for a few years, and being able to write about it honestly is what they're looking for.

If you're brand new and not sure what "contributing" even looks like yet, our [Getting Started guide](/guides/getting-started) walks through the departments and where beginners plug in. Every one of those roles — wiring, scouting, fundraising, media — is a legitimate story to tell on a scholarship application.

## The kinds of scholarships you'll find

The listing sorts into a few broad buckets, and it helps to know which you're chasing.

### College and university scholarships

Dozens of schools offer awards **specifically for FIRST alumni** who enroll there. Some are competitive; others are close to automatic if you meet the criteria and check the box on your application. Engineering-heavy schools have historically been the most generous here, but the list changes and expands, so search the current database rather than assuming which colleges participate. When you're building your college list senior year, cross-reference it against the FIRST providers — a school that gives FIRST students an extra few thousand dollars a year is worth a hard look.

### Corporate and organization scholarships

Companies in tech, aerospace, manufacturing, and engineering fund a lot of these, often because they want to hire FIRST alumni down the road. Professional societies and regional STEM foundations chip in too. These are frequently national, meaning you can attend any college and still collect, which makes them some of the highest-value applications relative to effort.

### Need-based versus merit-based

Both exist in the listing. Some ask for financial documents; others weigh grades, essays, and leadership. A few blend the two. Don't self-select out of need-based awards because you think your family "makes too much" — the thresholds vary, and it costs you nothing to apply and find out.

## The FIRST Leadership Award (formerly the Dean's List)

If there's one FRC-specific award worth understanding for the college-application game, it's the **FIRST Leadership Award** — the honor FIRST called the Dean's List until it was renamed in 2025. It recognizes the program's most outstanding student leaders — the ones driving their team's technical work and community impact, not just their own robot skills.

Here's the mechanics: each team can nominate up to two students who still have **at least one more year of FRC eligibility** (in practice, sophomores and juniors). Those two nominees are the team's Semi-finalists; Finalists are then selected at FRC Regional events and District Championships, and a small group of Winners is named from the finalists at the FIRST Championship. Being named a Finalist or Winner is a genuine distinction that stands out on a college or scholarship application, and it gets you visibility with scholarship providers.

You can't apply for it yourself — your mentors nominate you — but you can absolutely earn it by being the person who takes ownership: leading a subteam, running the team's outreach, mentoring rookies. If you're aiming that direction, the work that gets you noticed overlaps heavily with the [Impact Award](/guides/impact-award) side of the program and with running the team like a real organization, which our [Business, Operations & Fundraising guide](/guides/business-operations) covers in depth.

## It is not just for future engineers

A myth worth killing: FIRST scholarships are only for people majoring in mechanical or electrical engineering. Plenty of them are, but the listing also includes awards for students heading into **business, communications, graphic design, computer science, culinary arts, education, and more**. FIRST leans hard into the idea that a robotics team needs marketers, writers, and organizers as much as it needs machinists, and the scholarship pool reflects that.

So if you spent your FRC years running the team's social media, writing grant applications, or managing the budget, you have scholarships aimed at you too. Filter the database by field of study and you'll see.

## How to actually find and apply

The process is straightforward, but it rewards students who start early and stay organized.

1. **Go to the FIRST scholarships page** and open the scholarship search — FIRST now hosts the provider listing on the Pearson Futures portal. Filter by the things that describe you — your state, your intended major, need-based versus merit, whether you're a current student or alum.
2. **Build a spreadsheet.** For every scholarship you might qualify for, log the provider, the award amount, the deadline, the essay prompts, and what documents it needs. This is the single highest-leverage thing you can do, and almost nobody does it.
3. **Read the eligibility fine print.** Some scholarships require you to be a *current* participant, which means you have to apply while you're still on the team — usually senior year. Miss that window and the door closes.
4. **Write about your FIRST experience concretely.** The essays almost always ask about it. "I was on the robotics team" is weak. "I rewired our robot's [CAN bus](/glossary) after it failed inspection, then wrote the checklist our whole electrical group now uses" is strong. Specifics win.
5. **Apply directly to each provider** by its own deadline. FIRST hands you the lead; you close it.

Keep receipts on what you actually did across your seasons. The student who kept a running log of their contributions writes better applications in an afternoon than the one trying to reconstruct three years from memory the night before a deadline.

## A realistic timeline

The scholarship listing updates through the year, with a lot of activity in the fall and winter. Most deadlines land in the winter and spring of **senior year**, lining up with regular college applications, but some open earlier and a few key ones close before you might expect.

Underclassmen aren't off the hook. Sophomore and junior year is when you build the résumé — take on a real role, chase the FIRST Leadership Award nomination, keep your grades where merit awards need them. Then senior fall, you sit down with your spreadsheet and grind through applications while everyone else is only thinking about the Common App.

## Mistakes that quietly cost students money

A few patterns show up every year:

- **Assuming you're not "good enough" to apply.** Participation-based scholarships don't care that you weren't the captain. Apply anyway.
- **Only chasing the big ones.** The $10,000 national awards have thousands of applicants. The $750 regional one from a local engineering firm might have a dozen. Do both.
- **Ignoring your own college's FIRST scholarship.** Students commit to a school without ever checking whether it offers FIRST alumni money. Check every school on your list.
- **Waiting until it's too late.** Current-participant scholarships expire when you graduate. Senior-year procrastination is the most expensive habit here.

## Bottom line

FIRST scholarships are one of the most underused benefits of being on an FRC team. There's real money — tens of millions of dollars — sitting in a searchable database, a meaningful slice of it open to you just for showing up and contributing over a few seasons. The students who cash in aren't necessarily the best builders; they're the ones who searched the listing early, kept an organized spreadsheet, and wrote honestly about what they did.

Start now. Build the experience worth writing about, keep track of your contributions, and when the applications open, you'll be the one ready. If you're still finding your footing on a team, pick a department and start learning — browse the [free LearnFRC guides](/guides) or map out a [learning path](/paths) to build the kind of FRC story scholarship providers actually fund.`,
  },
  {
    slug: "frc-offseason-guide",
    title: "The FRC Offseason: What Strong Teams Do Between Seasons",
    description:
      "What strong FRC teams do in the offseason: new-member training, offseason competitions, and skill projects that set up a winning season.",
    keywords: [
      "frc offseason",
      "frc offseason projects",
      "frc summer training",
      "offseason competitions frc",
      "frc preseason",
      "frc new member training",
    ],
    date: "2026-07-03",
    readMins: 7,
    content: `The FRC offseason is the stretch from late April, right after the FIRST Championship, until Kickoff in early January — roughly eight months of the year. Strong teams treat it as the most important part of their calendar: they train new members, run and attend offseason competitions, and take on skill-building projects instead of letting the shop go dark until January.

If build season is a six-week sprint, the offseason is where you actually get better. The teams that consistently do well in the spring aren't smarter than you during those six weeks. They did the work in the eight months before.

## When the offseason actually happens

The competition calendar wraps up in late April with the FIRST Championship in Houston. After that, there are no more official FRC events until the next Kickoff in early January. That gap breaks down roughly like this:

- **Late spring (May–June):** Debrief the season, run demos, start onboarding. School is still in session for part of it, so use it.
- **Summer (June–August):** The deep-work window. Big training pushes, offseason competitions, and projects that need real shop time.
- **Fall (September–November):** Recruiting season. New members show up when school starts. This is when you build next year's team.
- **December:** Ramp-up. Finalize preseason projects, run a mock kickoff, and get the shop and tooling ready before the real thing.

You don't need to grind all eight months. But a team that vanishes in May and reappears in January is starting every season from scratch.

## 1. Run a real season retrospective

Before anyone forgets what went wrong, get the whole team in a room and write it down. What broke at events? What took too long in the build? Which subsystems never really worked? Where did you lose matches: the robot, driver practice, or scouting?

Be specific and honest. "Electrical failed a lot" is useless. "We lost three matches to a CAN wire that backed out of a motor controller" is a problem you can actually fix in the offseason. Write it into a document your team will still have next year, because your seniors are about to graduate and take that knowledge with them.

## 2. Recruit and train new members (this is the big one)

Every FRC team loses its seniors every year. The single biggest thing the offseason is for is replacing that knowledge before you need it.

When school starts in the fall, recruit hard: club fairs, class visits, word of mouth. Then actually train the people who show up. Don't just have them watch. New members should get hands-on with the fundamentals of each department well before build season starts: drivetrains and fasteners, wiring that passes inspection, the programming toolchain, basic CAD, and how scouting works.

This is exactly the gap we built LearnFRC to fill. Point new members at the [Getting Started guide](/guides/getting-started) for the big picture, then let them go deep in whatever department pulls them in. The [Electrical & Wiring guides](/guides/electrical-wiring) and [Programming guides](/guides/programming-software) cover the two areas where rookies most often get stuck during build season, so front-load them now.

The goal is simple. By January, a new member can be handed a task and do it, instead of spending the first two weeks of build season figuring out what a motor controller even is.

## 3. Compete in offseason events

Offseason competitions are unofficial tournaments that teams host over the summer and fall. They don't count toward any official ranking, and that is the point. They're low-stakes, which makes them the best training environment in FRC.

They matter for a few reasons. New drivers get real match reps without a season on the line. Rookie programmers get to test autonomous routines on an actual field instead of your shop floor. And you get to run the robot you spent all of build season on, months after you last touched it, which surfaces every reliability problem you papered over in the spring.

### Finding offseason competitions

Some offseason events are large and famously competitive, like the Indiana Robotics Invitational (IRI) and Chezy Champs. Most are smaller regional events run by veteran teams. To find them:

- Check **The Blue Alliance**, which lists offseason events alongside the official ones.
- Watch **Chief Delphi**, where hosts post registration threads.
- Ask veteran teams in your area. Offseason events are often word-of-mouth within a region.

Registration is usually cheap compared to an official regional, sometimes only a few hundred dollars, and some events let teams run students who don't normally drive. Doing well at these also builds the scouting and match instincts your team will lean on all spring, which is worth the same offseason attention as our [Scouting & Strategy guides](/guides/scouting-strategy). If you can only do one thing off this whole list, do this one.

## 4. Take on skill-building projects

The offseason is when you learn the things you never had time for in the panic of build season.

### Learn the tools you skipped

FRC's software stack moves every year, and the offseason is when to catch up. A few concrete projects worth a summer:

- **Get comfortable with WPILib and [command-based programming](/guides/programming-software/robot-program-and-command-based/command-based-subsystems)** if your team is still cramming everything into one file. A new WPILib version ships each January, but the core concepts are stable. Learn them now.
- **Add vision.** Whether it's a Limelight or PhotonVision running on a coprocessor, the offseason is the time to figure out [AprilTag tracking](/guides/programming-software/vision-pose-estimation/apriltags-and-coprocessors) without a match clock running.
- **Learn path planning.** Tools like [PathPlanner and Choreo](/guides/programming-software/autonomous-trajectories-simulation/trajectories-pathplanner-choreo) make autonomous routines far more capable, but they take real time to learn well.

If your team runs REV or CTRE hardware, the offseason is also when to actually read the docs for your motor controllers and IMU instead of copying last year's config and hoping it holds. Our [Programming guides](/guides/programming-software) walk through the toolchain from install to first deploy.

### Build something

Nothing teaches faster than building a real mechanism with no deadline pressure. Common offseason builds:

- A **spare or practice drivetrain**, which is especially valuable if you want to learn [swerve](/guides/mechanical-build/drivetrains/swerve-drive) before betting an entire season on it.
- A **prototype of a mechanism** you were curious about — a shooter, an elevator, an intake — just to learn how it goes together.
- A **demo robot** you can safely drive at outreach events and recruiting fairs.

Keep it small and finish it. A completed simple project beats an abandoned ambitious one, in the offseason exactly like in build season.

## 5. Fix your finances and your Impact story

Robots cost money, and the offseason is when funding gets locked in for next year. Season registration alone runs several thousand dollars (check the current FIRST fee schedule for exact numbers), before you spend a cent on parts or travel. Sponsors and grants don't materialize in January. You court them in the fall.

Use the quiet months to write thank-you letters to this year's sponsors, line up next year's, and [apply for grants](/guides/business-operations/first-grants-and-programs/first-team-grant-portal). If your team is chasing the [Impact Award](/guides/impact-award/understanding-the-impact-award/what-the-impact-award-is), the offseason is when you build the outreach record and documentation it's judged on. You cannot fake a year of community work in the two weeks before an event.

## 6. Hand off leadership on purpose

If your team leads are all seniors, you have a countdown clock running. Use the offseason to name and train [next year's leadership](/guides/business-operations/team-structure-and-leadership/student-leadership-and-mentors) — subsystem leads, a drive team, department heads — and let them actually run things during offseason projects while the veterans are still around to catch mistakes.

Teams that survive graduation waves do it by making leadership transition a normal, planned event instead of a January surprise.

## A minimum viable offseason

If this all feels like a lot, here's the shortest version that still works:

1. **May:** One honest retrospective meeting, written down.
2. **Summer:** Register for one offseason competition and run your robot at it.
3. **Fall:** Recruit hard, and run a structured new-member training program.
4. **December:** A mock kickoff so build season doesn't start cold.

Everything else — practice bots, vision, path planning, a bigger sponsor push — is upside stacked on top of that. If you want a ready-made structure for the fall training push, our [learning paths](/paths) sequence the department guides in the order a new member should tackle them.

## The one rule

The offseason is the difference between a team that rebuilds itself from zero every January and a team that compounds year over year. You don't win in the spring because of six weeks of work. You win because of the eight months nobody saw. Pick a couple of things off this list, start now, and let your team walk into Kickoff already ahead.

Ready to get the team going? Browse the [free department guides](/guides/getting-started) and [learning paths](/paths) on LearnFRC — built by an FRC student, for teams that want to get better between seasons.`,
  },
  {
    slug: "how-to-read-the-frc-game-manual",
    title: "How to Read the FRC Game Manual (Without Getting Lost)",
    description:
      "The FRC game manual is the season's official rulebook. Here's how to read the FRC manual without getting lost: structure, rule prefixes, scoring, and Team Updates.",
    keywords: [
      "frc game manual",
      "how to read frc manual",
      "frc rules explained",
      "frc manual tips",
      "frc rulebook",
    ],
    date: "2026-07-03",
    readMins: 7,
    content: `The FRC game manual is the official rulebook FIRST publishes at Kickoff every January. It defines that season's game, the field, how points are scored, and every rule your robot, drivers, and team have to follow. The way to read it without getting lost is simple: don't read it front-to-back like a novel. Skim it once for structure, read the scoring section closely, then have each sub-team deep-read only the parts that apply to them.

That's the whole strategy. The rest of this is how to actually do it.

## What the game manual actually is

Every FRC season is a brand-new game, revealed at **Kickoff** in early January. Minutes after the reveal animation, FIRST drops the game manual, a PDF that usually runs well over 100 pages. It is the single source of truth for the season. Chief Delphi threads, YouTube breakdowns, and your mentors' opinions are all helpful, but none of them override the manual. If there is ever a disagreement about what's legal, the answer is in the text (or in the official Q&A, which we'll get to).

The manual covers four big things: the **game** (objective, match flow, scoring), the **arena** (the field you play on), the **robot** (what you're allowed to build), and the **tournament** (how events and rankings work). Almost everything a rookie needs for their first season lives somewhere in those four buckets.

## Where to find it, and which version to read

The manual lives on the FIRST website's game-and-season page, alongside the field drawings, the Kit of Parts list, and the other official documents. Download the PDF and keep a copy locally. You'll be searching it constantly, and you don't want to be reloading a web page in the middle of an argument. Ctrl+F is genuinely your most-used tool all season.

One critical thing rookies miss: **the manual you download at Kickoff is not final.** Throughout build season, FIRST releases **Team Updates** that add, change, or clarify rules. A rule you memorized in week one can be different by week three. More on that below, but the short version is to always confirm you're looking at the latest version.

## How the manual is organized

The manual is split into numbered sections with a consistent internal logic. You don't need to memorize the section numbers, since they shift year to year, but you do need to understand the three conventions that make the whole thing readable.

### Rule prefixes: G, R, and the rest

Every rule has a short code like **G401** or **R501**. The letter tells you what kind of rule it is, and that lets you jump straight to what you care about:

- **G rules** are **game rules**, things you can and can't do *during a match*. Drivers and the drive coach live here.
- **R rules** are **robot rules**, the construction and build constraints like size, weight, legal materials, and motor limits. Your mechanical, electrical, and CAD people live here.
- Other prefixes cover inspection, tournament, and event rules. The manual's own "how to read a rule" intro page lists exactly which letter means what for the current season. Read that one page and the entire document gets easier.

Getting fluent in the prefixes is the single biggest unlock. When a teammate asks "is this legal?", you should know whether the answer is an R rule or a G rule before you even open the file.

### Blue boxes are the best thing in the manual

Scattered through the manual are shaded **Blue Boxes**. These are not rules themselves. They explain the *intent* behind a rule, give worked examples, or clarify edge cases the plain rule text can't cover on its own. When a rule confuses you, the Blue Box right after it usually answers the exact question you had. Rookies skip them because they look like filler. They are the opposite of filler.

### Defined terms and the glossary

The manual formats specific **defined terms** in a consistent style (you'll notice certain words are capitalized or styled differently), and each one has a precise meaning listed in the glossary at the back. A term like ROBOT PERIMETER, BUMPER ZONE, or ALLIANCE means exactly what the glossary says, not what it sounds like in everyday English. When a rule hinges on a defined term, go read that definition before you argue about the rule. Half of all "these rules contradict each other!" moments are just someone using the casual meaning of a word the manual defines narrowly.

If a term ever trips you up, our [FRC glossary](/glossary) explains the common ones in plain language.

## A reading order that actually works

Here's the sequence I'd give any new team on Kickoff day:

1. **Watch the game reveal animation first.** Two minutes of video gives you the mental model that makes the text readable.
2. **Read the game overview and match-flow section** to get the shape of a match start to finish — the autonomous period, the driver-controlled period, and endgame — and let the manual fill in that season's exact timing. If those phases are new to you, [our lesson on how a match works](/guides/getting-started/the-season-and-the-game/how-a-match-works) walks through them so the manual reads faster.
3. **Read the scoring section slowly and completely.** This is the part your entire strategy is built on.
4. **Skim the whole manual once** so you know what exists and where it is. Don't try to absorb it, just build a map in your head.
5. **Split the deep read by sub-team.** Build and CAD read the R rules cover to cover. Drivers and strategy read the G rules. Whoever handles inspection reads the inspection and bumper rules. Nobody reads all 100-plus pages at full depth alone.

That last point is the real anti-getting-lost move. The manual is written for an entire team, not one person. Trying to be the single human who has every rule memorized is how you burn out by week two.

## Read the scoring like your season depends on it

Because it does. The scoring section is where design and strategy actually come from. Before you sketch a single mechanism, your team should be able to answer: what's worth the most points, what's cheap and reliable to score, what the autonomous period rewards, and what the bonus [ranking-point objectives](/guides/drive-team/prerequisites/alliances-scoring-and-ranking-points) are.

A robot that reliably does the one highest-value thing usually beats a robot that tries to do everything and does none of it well. You can only make that call if you've read the points closely. This is also where [Scouting & Strategy](/guides/scouting-strategy) starts, because the scoring rules define what's even worth scouting in the first place.

## The parts that quietly disqualify rookies

A few rule categories cause the most rookie pain, mostly because they're easy to overlook until inspection day:

- **Size and weight limits.** Robots have a maximum weight and have to fit inside a starting volume, with rules about how far mechanisms may extend during a match. The exact numbers change year to year, so check the current R rules, but know these limits exist and design to them from day one, not the night before your event.
- **Bumper rules.** Bumpers have their own detailed rules: how they're constructed, where they sit on the frame, what colors they are, and how much of the robot perimeter they cover. Get these wrong and you fail inspection, so read them carefully before you finalize your frame.
- **The control system and wiring.** The legal electrical system (main breaker, correct wire gauges, a properly secured battery) is spelled out in the rules and checked at inspection. Our [Electrical & Wiring guides](/guides/electrical-wiring) map directly onto what the manual requires.

None of these are hard. They just have to be right, and the manual tells you exactly what "right" is.

## Team Updates and the Q&A change the manual under you

Two official systems keep the manual alive after Kickoff, and ignoring them is a classic rookie mistake.

**Team Updates** are FIRST's official amendments to the manual, released on a schedule during build season. They can change a rule, add a new one, or correct an error. Reading them is not optional, because a Team Update can invalidate a design decision you already committed to. Assign someone to check for updates and read them out to the team every time they drop.

The **official Q&A system** is where teams submit questions about rules they find ambiguous, and FIRST answers on the record. Those answers are official clarifications straight from FIRST, though the manual text itself takes precedence if the two ever conflict. Before you spend an hour arguing about an edge case, search the Q&A. Odds are another team already asked and there's an official ruling. If there isn't, you can submit the question yourself.

## Common mistakes when reading the manual

- **Reading it front-to-back like a book.** You'll lose the plot by page 30. Skim for structure, then deep-read by section.
- **Trusting a Chief Delphi hot take over the actual text.** The community is great for pointers, but always confirm against the manual and the Q&A.
- **Ignoring the Blue Boxes.** They answer the exact question the rule left open.
- **Skipping the glossary.** Most rule confusion is a defined term someone assumed they already understood.
- **Forgetting Team Updates.** The manual changes. Keep up.
- **Reading a rule without its penalty.** Most rules state the consequence for breaking them, whether a FOUL, a TECH FOUL, a card, or a disqualification. Knowing the cost tells you how much a rule actually matters to your strategy.

## The bottom line

The FRC game manual looks intimidating because it's long and precise, but it's precise on purpose. It's the one document every team on the field has agreed to play by. Read it in layers instead of all at once: animation, overview, scoring, a full skim, then a deep read split across your sub-teams. Learn the rule prefixes, respect the Blue Boxes and the glossary, and never let a Team Update sneak past you.

If this is your first season and the manual is your first real taste of FRC, start with our [Getting Started guide](/guides/getting-started) and let it point you to the rest as you grow. Read the manual well and you'll spend build season building, not arguing about rules.`,
  },
  {
    slug: "frc-simulation-wpilib",
    title: "Practice FRC Programming Without a Robot: WPILib Simulation",
    description:
      "Practice FRC programming without a robot using WPILib simulation: run real robot code on your laptop, drive a virtual robot, model physics, and test.",
    keywords: [
      "wpilib simulation",
      "frc programming without robot",
      "frc robot simulator",
      "practice frc code",
      "wpilib sim gui",
      "frc simulation tutorial",
    ],
    date: "2026-07-03",
    readMins: 7,
    content: `You can practice FRC programming without a robot by using WPILib's built-in simulator, which runs your real robot code on your laptop and shows a virtual robot you can enable, drive, and debug. Everything you write for the actual roboRIO, including command-based structure, subsystems, autonomous routines, and PID loops, runs in the sim with no hardware attached.

That matters because programming is the department most starved for hardware time. The robot is usually half-built, being rewired, or in use by drive practice, and the code team is stuck waiting. Simulation removes that bottleneck. You can iterate on autonomous paths at midnight in December, months before Kickoff, and show up to build season already knowing your tools.

## Why simulation is worth your time

The old way to learn FRC code was to wait for a working robot, deploy, watch it do the wrong thing, and repeat with a 30-second deploy cycle and a crowd of people who also need the robot. Simulation flips that. Your test loop drops to a few seconds, you get a debugger, and a broken line of code crashes a window on your screen instead of driving a 120-pound machine into a wall.

There are three honest limits to be clear about. First, physics in sim is approximate, so a mechanism that works in the simulator may still need real-world tuning. Second, you will not catch wiring, CAN bus, or mechanical problems in sim, because there is no wiring. Third, sensor behavior is only as realistic as the model you feed it. None of that makes simulation less useful. It just means sim is for validating your **logic and structure**, and the real robot is for the final tuning pass.

## What you actually need

The requirements are small: a laptop running Windows, macOS, or Linux, and the WPILib release for the current season installed. That single installer gives you a preconfigured VS Code, the WPILib libraries, the build tools, and the simulator. You do not need a roboRIO, a power supply, or any motors. If you have never installed it, walk through our [Programming, Controls & Sensors guides](https://learnfrc.systemerr.com/guides/programming-controls-sensors) — [installing the toolchain](https://learnfrc.systemerr.com/guides/programming-software/foundations-tools-and-first-program/installing-the-toolchain) is covered there step by step — because the sim assumes you already have a project that builds.

Simulation works in all three WPILib languages — Java, C++, and Python — so your language choice doesn't limit you here. If you're still weighing them, our lesson on [choosing a language](https://learnfrc.systemerr.com/guides/programming-software/foundations-tools-and-first-program/choosing-a-language) covers the tradeoffs; whichever you pick, make sure a template project builds cleanly before you simulate, because the sim runs your compiled code and cannot fix a project that does not compile.

## Running the simulator

You launch it from your robot project in the WPILib VS Code: open the command palette and run the WPILib command to simulate your robot code, or use the Gradle task from the terminal (\`./gradlew simulateJava\` for a Java project). The exact command label can shift between seasons, so if the palette entry looks slightly different from a tutorial you are following, trust the current WPILib docs at docs.wpilib.org over an older guide. The first time you run it, WPILib asks which simulation extensions to load; pick the **Sim GUI** and the driver station extension, and the Sim GUI window that opens is the heart of the whole workflow.

Its **Robot State** panel is a virtual Driver Station: set the robot to Disabled, Autonomous, Teleoperated, or Test, and flip the Enable control exactly like the real thing. Enable in Teleop and the panels showing your commanded outputs — PWM values, motor controller outputs — move in real time, which alone catches a huge share of "why isn't my motor doing anything" bugs. To drive, plug in a game controller and drag it from the System Joysticks panel into the Joysticks panel so it maps to joystick 0 the way your code expects; now your teleop code is reading a real controller with no robot in the room, but the full input-to-output path is live. Our lesson [Simulation: Test Without a Robot](https://learnfrc.systemerr.com/guides/programming-software/autonomous-trajectories-simulation/simulation) walks the full panel tour and each robot state end to end.

## Making the virtual robot move

Out of the box, the Sim GUI shows you commanded outputs but not motion, because nothing is modeling the physics of your drivetrain or arm. WPILib ships **physics simulation classes** for the common FRC mechanisms — a differential (tank) drivetrain, a flywheel, an elevator, a single-jointed arm, and a generic DC motor — and you feed each one the real parameters, such as the gearbox reduction, the motor type and count, and the mass or moment of inertia. Wired in through a \`simulationPeriodic()\` method, which the framework calls only when running in simulation, the model turns your commanded voltage into a position and velocity and writes it back into your simulated sensors, such as encoders. Now a closed-loop PID that holds an elevator height will actually settle in the sim, and a badly tuned one will visibly oscillate on screen — that feedback is the entire point, and you got it without a robot or a single risk of stripping a gear. Our lesson on [simulation-driven design with WPILib physics models](https://learnfrc.systemerr.com/guides/mechanical-build/advanced-techniques-case-studies/simulation-driven-design) works a full mechanism through from CAD-derived inputs to a settling loop.

You do not have to model everything on day one. A common and productive path is to simulate just the drivetrain so you can develop autonomous routines and odometry, then add mechanism models later as you need them.

## Vendor hardware: CTRE and REV in sim

Most modern FRC robots run motors on either CTRE or REV electronics, and both vendors support simulation, so you are not limited to WPILib-native motor controllers. CTRE's Phoenix library exposes a simulation state on its motor controllers, letting you feed a simulated position and velocity into a device like a TalonFX and read realistic encoder and status values back. REV's library similarly provides simulation hooks for its SPARK controllers. The details and the exact API names change with each vendor release, so pull the current version of the vendor's own simulation documentation rather than trusting a two-year-old forum post. The takeaway is that whatever hardware your team standardized on, you can very likely develop against it in sim. If you are still deciding on electronics, our [Electrical & Wiring guides](https://learnfrc.systemerr.com/guides/electrical-wiring) cover the tradeoffs on the hardware side.

## Seeing your robot on a field

Numbers in a panel are fine for a motor, but for a drivetrain you want to see where the robot is. WPILib provides a **Field2d** widget: you publish your robot's estimated [pose from odometry](https://learnfrc.systemerr.com/guides/programming-software/autonomous-trajectories-simulation/kinematics-and-odometry) and the Sim GUI (or the Glass dashboard) draws the robot as an arrow on a top-down field. Drive in teleop and the arrow moves; run an autonomous path and you watch it trace the route. If your odometry math is wrong, the arrow drifts or teleports, and the bug is obvious in a way it never is by staring at code.

Two companion tools go further. **Glass** is a standalone dashboard that connects to your running sim and gives you richer, more configurable widgets and plots than the basic Sim GUI. **AdvantageScope**, a widely used community tool, visualizes NetworkTables and log data — including 2D and 3D field views and mechanism animations — and can replay recorded logs after the fact, so teams that log aggressively can reconstruct exactly what the code believed was happening during a match or a sim run. We cover both in depth in [a systematic debugging workflow for FRC](https://learnfrc.systemerr.com/guides/programming-software/common-mistakes-troubleshooting/systematic-debugging-workflow); here it is enough to know they attach to the same running sim. There is also a growing ecosystem of higher-fidelity physics simulators from the community that add game-piece collisions and more realistic field interaction. If you want to explore that, search for the current season's popular FRC simulation libraries, since the leading options change from year to year.

## Test your code, not just your patience

Simulation is not only about the GUI. Because your robot code is ordinary Java, C++, or Python, you can write **unit tests** that run on your laptop with no robot and no sim window at all. A typical test constructs a subsystem, commands it to do something, steps the physics model forward a few times, and asserts that the encoder ended up where it should. These tests run in seconds as part of your build, so a broken change gets caught before anyone deploys. For a rookie team, even a handful of tests around your drivetrain and your critical autonomous logic pays for itself the first time a refactor would have quietly broken something.

## Cheap physical practice: Romi and XRP

If you want the feel of real hardware without a real robot, two small platforms run genuine WPILib code over a wireless connection to your laptop. The **Romi** is a compact wheeled robot built on a common hobby chassis, and the **XRP** (Experiential Robotics Platform) is an even cheaper option often in the range of a textbook rather than a robot budget. Both let you write a normal WPILib project, connect through a simulation websocket extension, and drive an actual little robot around a table. They are not a substitute for the competition robot, but they are a fantastic bridge between pure simulation and the real thing, and they are ideal for training new programmers in the offseason. Check the current price and setup steps in the WPILib docs, since both platforms get revised.

## A realistic way to start

If you have never touched the simulator, do this in order. Install the current WPILib release and confirm a new project builds. Run the simulator, open the Sim GUI, drag in a controller, and enable a stock template in teleop so you see outputs respond. Add a differential drivetrain physics model and a Field2d widget, and drive your virtual robot around. Then write one unit test. That sequence, which you can do in an afternoon, covers the core skills you will use all season.

Simulation is the single highest-leverage habit a new FRC programmer can build, because it turns "we're blocked on the robot" into "we shipped working code before the robot existed." Ready to go deeper? Work through the full walkthroughs in the [LearnFRC Programming department](https://learnfrc.systemerr.com/guides/programming-controls-sensors), map out where code fits in the season with our [learning paths](https://learnfrc.systemerr.com/paths), and keep the [glossary](https://learnfrc.systemerr.com/glossary) open for any term that trips you up.`,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** Most related articles, scored by shared tokens across keywords + title. */
export function getRelated(slug: string, n = 3): Article[] {
  const a = getArticle(slug);
  if (!a) return [];
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2)
    );
  const mine = tokens([...a.keywords, a.title].join(" "));
  return ARTICLES.filter((x) => x.slug !== slug)
    .map((x) => {
      const theirs = tokens([...x.keywords, x.title].join(" "));
      let score = 0;
      for (const t of theirs) if (mine.has(t)) score++;
      return { x, score };
    })
    .sort((p, q) => q.score - p.score)
    .slice(0, n)
    .map((r) => r.x);
}
