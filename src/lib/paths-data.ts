/**
 * Curated learning paths — ordered journeys through real departments.
 *
 * Every `deptSlug` MUST be one of the 11 real department slugs so that each
 * step links to a live /guides/[slug] page:
 *   getting-started, mechanical-build, cad-design, programming-software,
 *   electrical-wiring, business-operations, media-outreach, impact-award,
 *   scouting-strategy, drive-team, safety
 *
 * `icon` is a key into the ICONS map in @/lib/icon-map.
 * `color` is a hex accent used for gradients/chips on the paths pages.
 */
export type LearningPath = {
  slug: string;
  title: string;
  description: string;
  icon: string; // key into ICONS map (icon-map.tsx)
  color: string; // hex accent
  outcomes: string[];
  steps: { deptSlug: string; label: string; note: string }[];
};

export const PATHS: LearningPath[] = [
  {
    slug: "new-member-onboarding",
    title: "New Member Onboarding",
    description:
      "Brand new to the team? This is the path that turns a curious rookie into a contributing member — culture, shop safety, and your first real hands on the robot.",
    icon: "Rocket",
    color: "#3b82f6",
    outcomes: [
      "Understand what FRC is, the season cadence, and how a team runs",
      "Pass shop safety and work confidently around tools and the robot",
      "Build, wire, and power a basic mechanism with the team",
      "Know which department fits you best and how to go deeper",
    ],
    steps: [
      {
        deptSlug: "getting-started",
        label: "Learn how FRC works",
        note: "Start here. Get the big picture: the game cycle, kickoff, regionals, and how the departments fit together so nothing else feels like a mystery.",
      },
      {
        deptSlug: "safety",
        label: "Earn your shop safety basics",
        note: "Before you touch a tool or the robot, learn PPE, safe tool use, and shop etiquette. Safety isn't optional — it's the first thing every veteran respects.",
      },
      {
        deptSlug: "mechanical-build",
        label: "Get hands on the robot",
        note: "Learn fasteners, the build process, and how mechanisms come together. This is where the robot stops being abstract and starts being real.",
      },
      {
        deptSlug: "electrical-wiring",
        label: "See how it gets powered",
        note: "Follow power from the battery through the PDH to the motors. Even non-electrical members should understand how the robot actually turns on.",
      },
      {
        deptSlug: "media-outreach",
        label: "Find your voice on the team",
        note: "Onboarding isn't only the robot — see how the team tells its story and how every member can contribute beyond the shop.",
      },
    ],
  },
  {
    slug: "become-a-robot-programmer",
    title: "Become a Robot Programmer",
    description:
      "Go from zero code to writing real, competition-ready robot software — command-based WPILib, sensors, and tuned autonomous routines.",
    icon: "Code2",
    color: "#10b981",
    outcomes: [
      "Set up the WPILib toolchain and deploy code to a roboRIO",
      "Write clean, command-based subsystems and commands",
      "Read sensors and close the loop with PID/feedforward control",
      "Build and tune a reliable autonomous routine for match play",
    ],
    steps: [
      {
        deptSlug: "getting-started",
        label: "Ground yourself in FRC",
        note: "Understand the control system, the match flow, and where software fits before you write a single line of code.",
      },
      {
        deptSlug: "programming-software",
        label: "Learn WPILib & command-based",
        note: "The core of the path. Install the toolchain, structure subsystems and commands, and deploy your first working robot program.",
      },
      {
        deptSlug: "electrical-wiring",
        label: "Understand the hardware you control",
        note: "Great code needs hardware fluency — know your motor controllers, CAN bus, and sensors so you can debug from the wire up.",
      },
      {
        deptSlug: "mechanical-build",
        label: "Know the mechanisms you drive",
        note: "Understand gear ratios, mechanism limits, and how the robot moves so your code matches the physics it's commanding.",
      },
      {
        deptSlug: "scouting-strategy",
        label: "Code for the strategy",
        note: "The best autonomous and controls serve a game plan. Learn how strategy shapes which routines and features actually win matches.",
      },
    ],
  },
  {
    slug: "build-and-design-track",
    title: "Build & Design Track",
    description:
      "Design it in CAD, build it in the shop, and bring it to life — the full mechanical engineering pipeline from a sketch to a working subsystem.",
    icon: "Wrench",
    color: "#f97316",
    outcomes: [
      "Model robot parts and assemblies in CAD with FRC conventions",
      "Choose materials, fasteners, and fabrication methods that hold up",
      "Build robust, serviceable mechanisms in the shop",
      "Wire and power what you build so it actually runs",
    ],
    steps: [
      {
        deptSlug: "getting-started",
        label: "Understand the build season",
        note: "See the design-build-test loop and the season timeline so your CAD and fabrication decisions fit the calendar.",
      },
      {
        deptSlug: "cad-design",
        label: "Design it in CAD",
        note: "Model parts and assemblies, use FRC standards, and design for manufacturability before any metal gets cut.",
      },
      {
        deptSlug: "mechanical-build",
        label: "Build it in the shop",
        note: "Turn the CAD into reality — fabrication, fasteners, gearboxes, and assembly that survive a full competition.",
      },
      {
        deptSlug: "electrical-wiring",
        label: "Wire and power it",
        note: "Integrate motors, controllers, and sensors cleanly so your mechanism is reliable and easy to service at events.",
      },
      {
        deptSlug: "safety",
        label: "Build it safely",
        note: "Reinforce safe fabrication, machine use, and inspection-ready practices so what you build passes — and protects everyone.",
      },
    ],
  },
  {
    slug: "win-the-impact-award",
    title: "Win the Impact Award",
    description:
      "FIRST's most prestigious award goes to the team that best embodies the mission. Build the sustainable program, outreach, and story that earns it.",
    icon: "Trophy",
    color: "#eab308",
    outcomes: [
      "Run a sustainable team: structure, funding, and continuity",
      "Plan and document outreach with measurable community impact",
      "Craft compelling media that tells your team's story",
      "Assemble a winning Impact Award submission and presentation",
    ],
    steps: [
      {
        deptSlug: "getting-started",
        label: "Know what FIRST values",
        note: "The Impact Award is about FIRST's mission. Start by understanding the values and culture the award actually rewards.",
      },
      {
        deptSlug: "business-operations",
        label: "Build a sustainable team",
        note: "Sponsorships, budgets, structure, and continuity — the operational backbone judges look for in a thriving program.",
      },
      {
        deptSlug: "media-outreach",
        label: "Run impactful outreach & media",
        note: "Plan community outreach, measure its impact, and capture it in media that makes your story undeniable.",
      },
      {
        deptSlug: "impact-award",
        label: "Craft the submission",
        note: "The capstone — assemble the essay, executive summary, video, and presentation that turn your work into a winning entry.",
      },
    ],
  },
  {
    slug: "game-day-ready",
    title: "Game Day Ready",
    description:
      "Competition is its own skill. Scout smart, drive sharp, and run a calm, safe pit — everything that turns a good robot into match wins.",
    icon: "Gamepad2",
    color: "#ef4444",
    outcomes: [
      "Scout effectively and turn data into alliance decisions",
      "Build match strategy and read the field in real time",
      "Drive and operate the robot under pressure as a unit",
      "Run a safe, fast, inspection-ready pit on event day",
    ],
    steps: [
      {
        deptSlug: "getting-started",
        label: "Understand event flow",
        note: "Qualifications, alliance selection, playoffs — know how an event runs so nothing on game day catches you off guard.",
      },
      {
        deptSlug: "scouting-strategy",
        label: "Scout and strategize",
        note: "Collect the right data, analyze opponents and partners, and turn it into match and alliance-selection strategy.",
      },
      {
        deptSlug: "drive-team",
        label: "Drive and operate",
        note: "Driver, operator, human player, and coach working as one. Learn the roles, practice, and communication that win matches.",
      },
      {
        deptSlug: "safety",
        label: "Run a safe pit",
        note: "A fast, organized, safe pit keeps your robot in matches and impresses safety judges. Lock in pit and event-day safety.",
      },
    ],
  },
];

export function getPathBySlug(slug: string): LearningPath | undefined {
  return PATHS.find((p) => p.slug === slug);
}

export function getAllPathSlugs(): string[] {
  return PATHS.map((p) => p.slug);
}
