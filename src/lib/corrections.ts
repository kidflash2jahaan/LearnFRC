/**
 * The public corrections log.
 *
 * WHY THIS IS A CONSTANT AND NOT A TABLE
 * --------------------------------------
 * `content_edits` already stores *reader-submitted* edit proposals and their
 * review outcome, and those merged rows are rendered live on /corrections. But
 * it holds no editorial record: when the maintainer fixes something himself —
 * from a forum report, a re-read against the game manual, a vendor datasheet —
 * nothing is written anywhere. There is no `corrections` table and no
 * `last_reviewed` column on `lessons` or `articles` (checked: lessons expose
 * id, module_id, slug, title, summary, content, key_takeaways, resources,
 * estimated_minutes, sort_order, created_at, quiz — nothing else). So this file
 * is the editorial half of the log: append an entry here whenever content is
 * corrected, and both /corrections and the per-page provenance block pick it up
 * with no migration.
 *
 * HOUSE RULES FOR ENTRIES
 * -----------------------
 * 1. `quote` must be copied verbatim out of the live row. If it isn't in the
 *    database right now, it doesn't go in the log.
 * 2. `sources` must be links that actually resolve and that a reader can check
 *    themselves. Never invent a citation to make an entry look better sourced —
 *    an entry with no source is fine; a fake one is fatal.
 * 3. `status: "checked"` exists so the log can record *"we looked and the
 *    complaint was wrong"* without dressing it up as a fix, and
 *    `status: "open"` so it can record a known problem before it is fixed.
 *    Both are worth more than a log that only ever lists wins.
 * 4. `date` is the day the entry was logged, not necessarily the day the edit
 *    shipped — several of the first entries are older fixes confirmed against
 *    the live rows when this log was started. /corrections says so out loud.
 */

export interface CorrectionSource {
  title: string;
  url: string;
}

/** A lesson or article this entry changed. */
export interface CorrectionTarget {
  title: string;
  /** Site-relative path, e.g. /guides/mechanical-build/prerequisites/x */
  path: string;
}

export type CorrectionStatus =
  /** Content was wrong (or misleading) and has been changed. */
  | "corrected"
  /** Reported, checked, found not to be an error — recorded anyway. */
  | "checked"
  /** Known problem, logged publicly, not yet fixed. */
  | "open";

export interface Correction {
  /** Stable slug — used as the #anchor on /corrections. Never reuse one. */
  id: string;
  /** YYYY-MM-DD, the day this entry was logged. */
  date: string;
  status: CorrectionStatus;
  /** One line, plain: what this entry is about. */
  summary: string;
  /** Pages this entry touches. May be empty (e.g. content that was removed). */
  affects: CorrectionTarget[];
  /** What was wrong, or what was reported. */
  raised: string;
  /** What the page says now, or what checking it established. */
  outcome: string;
  /** Verbatim text from the live row, when a quote makes the change checkable. */
  quote?: string;
  /** Where a reader can check this for themselves. */
  sources?: CorrectionSource[];
  /** Where it was reported, when it was reported in public. */
  reportedAt?: CorrectionSource;
}

/**
 * The log. Newest first is enforced at read time by `sortedCorrections()`, so
 * new entries can simply be appended to the top of this array.
 */
export const CORRECTIONS: Correction[] = [
  {
    id: "si-base-units",
    date: "2026-08-10",
    status: "checked",
    summary:
      "The SI base units passage quoted on Chief Delphi — checked, and it was not a factual error",
    affects: [],
    raised:
      "A reader on Chief Delphi quoted an intro-lesson passage that listed all seven SI base units — including the kelvin, the mole and the candela — and asked what any of that had to do with FRC. It has been repeated since as an example of an inaccuracy on the site.",
    outcome:
      "The claim itself is correct: there are seven SI base units, and the 2019 redefinition did put all seven on fixed values of defining constants. The real objection was relevance, not accuracy — kelvin, moles and candelas do not belong in an FRC lesson. The passage is no longer anywhere on the site: searching all 394 lessons and 91 articles for “candela”, “luminous”, “SI base”, “kelvin” and “amount of substance” returns zero matches. Logging it as a correction we made would be untrue, so it is logged as what it was.",
    sources: [
      {
        title: "NIST — SI Units (the seven base units)",
        url: "https://www.nist.gov/pml/owm/metric-si/si-units",
      },
    ],
    reportedAt: {
      title: "Chief Delphi — thread 521987, post #4",
      url: "https://www.chiefdelphi.com/t/521987/4",
    },
  },
  {
    id: "motor-mounting-fasteners",
    date: "2026-08-10",
    status: "corrected",
    summary: "Full-size FRC motors were described as mounting with metric M5 hardware",
    affects: [
      {
        title: "Units, Measurement, and Tolerances",
        path: "/guides/mechanical-build/prerequisites/units-measurement-tolerances",
      },
    ],
    raised:
      "The lesson implied that full-size FRC motors take metric M5 screws. They don't, and the mistake is expensive: an M5 will start threading into a #10-32 hole and ruin it. It was flagged on Chief Delphi as content that could cost a team a motor.",
    outcome:
      "The lesson now names the imperial thread explicitly and warns about the failure mode.",
    quote:
      "Full-size FRC motors — the NEO, Falcon 500, and Kraken X60 — actually mount with imperial #10-32 screws, not metric. This distinction matters: an M5 will start threading into a #10-32 hole and destroy it, so never assume a motor is metric — check its datasheet.",
    sources: [
      {
        title: "REV Robotics — NEO Brushless Motor documentation",
        url: "https://docs.revrobotics.com/brushless/neo/v1.1",
      },
    ],
    reportedAt: {
      title: "Chief Delphi — thread 521987, post #43",
      url: "https://www.chiefdelphi.com/t/521987/43",
    },
  },
  {
    id: "dpr-direction",
    date: "2026-08-10",
    status: "corrected",
    summary: "The DPR lesson never said which direction is good",
    affects: [
      {
        title: "Understanding OPR, DPR, and CCWM",
        path: "/guides/scouting-strategy/data-analysis-tba-statbotics/opr-dpr-ccwm",
      },
    ],
    raised:
      "“Defensive Power Rating” sounds like a stat where more is better. The lesson explained the maths but never stated the direction, so a reader could come away ranking teams exactly backwards.",
    outcome: "The lesson now states the direction, and says why the name misleads.",
    quote:
      "That means lower DPR is better (the team is associated with holding opponents to fewer points) and a high DPR is bad — the opposite of the intuition the name suggests.",
    sources: [
      {
        title: "The Blue Alliance Blog — OPR and You: Basic FRC Strategy",
        url: "https://blog.thebluealliance.com/2017/11/06/opr-you-basic-frc-strategy/",
      },
    ],
    reportedAt: {
      title: "Chief Delphi — thread 521987, post #55",
      url: "https://www.chiefdelphi.com/t/521987/55",
    },
  },
  {
    id: "vex-recf-split",
    date: "2026-08-10",
    status: "corrected",
    summary: "VEX competitions were still described as run by the REC Foundation",
    affects: [
      { title: "FRC vs FTC vs VEX", path: "/blog/frc-vs-ftc-vs-vex" },
    ],
    raised:
      "The comparison said VEX competitions are run by the Robotics Education & Competition Foundation. That stopped being true in 2026 when VEX Robotics and the REC Foundation separated.",
    outcome:
      "The article now describes the split and who runs which events as of mid-2026.",
    quote:
      "That changed in 2026: VEX Robotics, Inc. and the REC Foundation split, and as of mid-2026 the REC Foundation no longer runs sanctioned VEX events.",
    sources: [
      { title: "REC Foundation (recf.org)", url: "https://recf.org/" },
    ],
    reportedAt: {
      title: "Chief Delphi — thread 521987, post #81",
      url: "https://www.chiefdelphi.com/t/521987/81",
    },
  },
  {
    id: "openmesh-radio-retirement",
    date: "2026-08-10",
    status: "corrected",
    summary: "The old OpenMesh radios were described as simply retired",
    affects: [
      {
        title: "The FRC Control System: Hardware and Software",
        path: "/guides/getting-started/culture-teams-and-roles/the-frc-control-system",
      },
    ],
    raised:
      "Calling the OM5P-AN / OM5P-AC radios “retired” is imprecise. The 2026 manual still requires an OpenMesh radio at events held in China, so a team reading the lesson there would have been told the wrong thing.",
    outcome: "The lesson now carries the exception and cites the rule number.",
    quote:
      "Those radios are no longer used in most of the world, but the 2026 manual (R702) still requires an OpenMesh radio at events held in China.",
    sources: [
      {
        title: "FIRST — Competition Manual and Q&A System",
        url: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
      },
    ],
  },
  {
    id: "additional-regional-fee",
    date: "2026-08-10",
    status: "corrected",
    summary: "Budgeting lessons still quoted $3,000 for an additional Regional",
    affects: [
      {
        title: "Registration & Event Fees in Detail",
        path: "/guides/business-operations/understanding-the-cost/registration-and-event-fees",
      },
      {
        title: "What FRC Actually Costs: The Big Picture",
        path: "/guides/business-operations/understanding-the-cost/what-frc-actually-costs",
      },
    ],
    raised:
      "Fee figures go stale every season. The cost lessons were still built on a $3,000 additional-Regional fee.",
    outcome:
      "Both lessons now use $3,200 per additional Regional. Fees change every year, so check FIRST's cost and registration page against your own season before you build a budget on any number we print.",
    quote: "Each additional Regional event is $3,200.",
    sources: [
      {
        title: "FIRST — Cost & Registration",
        url: "https://www.firstinspires.org/robotics/frc/cost-and-registration",
      },
      {
        title: "FIRST Community — 2025-2026 Program Registration Pricing",
        url: "https://community.firstinspires.org/2025-2026-first-program-registration-pricing",
      },
    ],
  },
  {
    id: "coopertition-bonus-rp",
    date: "2026-08-10",
    status: "open",
    summary: "A ranking-point example still lists a Coopertition Bonus",
    affects: [
      {
        title: "How a Match Works: Auto, Teleop, and Endgame",
        path: "/guides/getting-started/the-season-and-the-game/how-a-match-works",
      },
    ],
    raised:
      "The lesson describes a “typical” ranking-point scheme that includes a Coopertition Bonus, using 2025 REEFSCAPE as its worked example. 2026 REBUILT has no Coopertition Bonus — its bonus RPs are different. The lesson is not strictly false, because it is framed as a past example, but it reads as current.",
    outcome:
      "Not fixed yet. It needs rewording so the year each scheme belongs to is unmissable. Logged here rather than left quiet.",
    sources: [
      {
        title: "FIRST — Competition Manual and Q&A System",
        url: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system",
      },
    ],
  },
  {
    id: "cad-fastener-sizes-unverified",
    date: "2026-08-10",
    status: "open",
    summary: "Four fastener-size claims in a CAD lesson are not yet verified against datasheets",
    affects: [
      {
        title: "Dimensions, Tolerances, and Units",
        path: "/guides/cad-design/prerequisites/dimensions-tolerances-and-units",
      },
    ],
    raised:
      "The lesson gives specific fastener sizes for a Limelight mount, a navX board, a Talon SRX and a SPARK MAX. Those four claims have not been checked against the vendors' own datasheets. Given that the single most damaging error ever reported on this site was a fastener-size error, that is not a gap worth hiding.",
    outcome:
      "Not fixed yet. Pending a pass against each vendor datasheet. Until then, treat those four numbers as unverified and check the vendor's own documentation before you drill.",
  },
];

/** Newest first, then by id so the order is stable within a day. */
export function sortedCorrections(): Correction[] {
  return [...CORRECTIONS].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1
  );
}

/** Every logged entry that touches `path`, newest first. */
export function correctionsForPath(path: string): Correction[] {
  return sortedCorrections().filter((c) => c.affects.some((t) => t.path === path));
}

/**
 * The most recent *shipped* correction for a page — what the provenance block
 * surfaces as "last corrected". Open and checked entries deliberately don't
 * count: neither one changed the page.
 */
export function lastCorrectionForPath(path: string): Correction | null {
  return correctionsForPath(path).find((c) => c.status === "corrected") ?? null;
}

/** Newest entry date in the log — used for an honest sitemap `lastmod`. */
export function correctionsLastUpdated(): Date {
  const newest = sortedCorrections()[0];
  return newest ? new Date(`${newest.date}T00:00:00Z`) : new Date("2026-08-10T00:00:00Z");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Deterministic date formatting. `toLocaleDateString` renders differently
 * depending on the runtime's locale/ICU data, which is exactly the kind of
 * thing that turns into a hydration mismatch — these strings are built by hand.
 */
export function formatLogDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso.slice(0, 10);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
