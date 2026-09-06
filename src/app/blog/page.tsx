import type { Metadata } from "next";
import Link from "next/link";
import { type Article } from "@/lib/blog-data";
import { getArticles } from "@/lib/queries";
import { NewsletterForm } from "@/components/newsletter-form";
import { JsonLd } from "@/components/json-ld";
import { DeskIndex, type DeskCount } from "./_desk-index";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

// Metadata is frozen: these strings are what the site already ranks on, so
// they are carried over character for character rather than rewritten.
export const metadata: Metadata = {
  title: "FRC Guides & Articles",
  description:
    "In-depth FRC guides: how to start a team, swerve drive explained, how to win the Impact Award, and more — free, from an FRC student.",
  alternates: { canonical: `${SITE}/blog` },
  openGraph: {
    title: "FRC Guides & Articles · LearnFRC",
    description:
      "In-depth FRC guides for every department — free, from an FRC student.",
    url: `${SITE}/blog`,
    type: "website",
  },
};

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Editorial "desks", the real shelves the library is filed on. Ordered by
 * reading order, not size: someone landing here cold should meet "Start Here"
 * and the competition-day troubleshooting shelf before the deep technical ones.
 *
 * Rules are matched against the slug FIRST (deterministic, every one of the
 * current articles lands on a real desk, none fall through), with the keyword
 * list as a second pass so future articles still file themselves. Purely
 * presentational grouping: no article is invented, duplicated, or dropped.
 */
const DESKS: { label: string; slug: string; blurb: string; test: RegExp }[] = [
  {
    label: "Start Here",
    slug: "start-here",
    blurb: "What FRC is, how a season runs, and how to get on a team.",
    test: /^what-is-frc|start-an-frc|joining-your-first|vs-ftc-vs-vex|rookie-mistakes|kickoff|how-frc-competitions-work|game-manual|team-structure|mentor-guide|gracious/i,
  },
  {
    label: "In the Pit",
    slug: "in-the-pit",
    blurb: "Competition-day failures, and how to diagnose them fast.",
    test: /troubleshoot|inspection|pit-checklist|status-lights|no-robot-code|bumpers|robot-rules|battery|first-frc-competition|radio-networking|module-offsets/i,
  },
  {
    label: "Drivetrain & Mechanisms",
    slug: "drivetrain-mechanisms",
    blurb: "Swerve, gearing, intakes, elevators, shooters, and how to build them.",
    test: /swerve|drivetrain|gear-ratio|wheels|chain-vs-belt|intake|elevator|shooter|manufacturing|pneumatics|robot-design-process/i,
  },
  {
    label: "Programming",
    slug: "programming",
    blurb: "WPILib, command-based structure, autonomous, and tuning.",
    test: /program|wpilib|code|software|pid|simulation|pathplanner|choreo|odometry|dashboards|advantagescope|java-vs/i,
  },
  {
    label: "Electrical & Power",
    slug: "electrical-power",
    blurb: "Wiring, the control system, motors, and the vendor ecosystems.",
    test: /wire|electrical|can-bus|pdh|roborio|motors|control-system|power|ctre|rev-robotics|phoenix|spark|talon/i,
  },
  {
    label: "Vision & Sensors",
    slug: "vision-sensors",
    blurb: "AprilTags, Limelight, PhotonVision, encoders and gyros.",
    test: /apriltag|limelight|photonvision|vision|sensors/i,
  },
  {
    label: "CAD & Design",
    slug: "cad-design",
    blurb: "Choosing a CAD package, and modelling your first parts.",
    test: /cad|onshape|solidworks/i,
  },
  {
    label: "Scouting & Strategy",
    slug: "scouting-strategy",
    blurb: "Match data, picklists, alliance selection, and drive team.",
    test: /scout|picklist|opr|epa|statbotics|blue-alliance|alliance-selection|defense|ranking-points|districts|world-championship|drive-team/i,
  },
  {
    label: "Awards, Money & Outreach",
    slug: "awards-money-outreach",
    blurb: "Impact Award, sponsorship, grants, budgets and scholarships.",
    test: /impact|award|sponsor|grant|scholarship|budget|fund/i,
  },
  {
    label: "Season & Events",
    slug: "season-events",
    blurb: "Calendars, kickoff, the offseason, and what is coming in 2027.",
    test: /2027|calendar|offseason|biocore|systemcore|kit-of-parts|build-season/i,
  },
];
const FALLBACK_DESK = {
  label: "Field Notes",
  slug: "field-notes",
  blurb: "Everything else worth writing down.",
};

function deskFor(a: Article) {
  const hay = `${a.slug} ${a.keywords.join(" ")}`;
  return (
    DESKS.find((d) => d.test.test(a.slug)) ??
    DESKS.find((d) => d.test.test(hay)) ??
    FALLBACK_DESK
  );
}

/**
 * The six we would hand a stranger first. Chosen deliberately, not by recency:
 * the three the site already advertises in its own meta description (starting
 * a team, swerve, the Impact Award), the single most-read article in the
 * library, and the two pieces that explain the whole competition end to end.
 * They also appear in their desk below, because this set is a front door and
 * not a separate shelf.
 */
const FEATURED_SLUGS = [
  "what-is-frc",
  "how-to-start-an-frc-team",
  "frc-vs-ftc-vs-vex",
  "how-frc-competitions-work",
  "swerve-drive-explained",
  "how-to-win-the-impact-award",
];

export default async function BlogPage() {
  const articles = await getArticles();
  const totalMins = articles.reduce((sum, a) => sum + a.readMins, 0);

  // The curated front door. Filtered against the live library so a renamed or
  // retired article silently drops out instead of leaving a dead link.
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const featured = FEATURED_SLUGS.map((s) => bySlug.get(s)).filter(
    (a): a is Article => Boolean(a)
  );

  // Group the library onto its shelves, kept in DESKS order (reading order),
  // with any empty desk dropped so we never render a hollow heading.
  const grouped = [...DESKS, FALLBACK_DESK]
    .map((d) => ({
      desk: d,
      items: articles.filter((a) => deskFor(a).label === d.label),
    }))
    .filter((g) => g.items.length > 0);

  // The divider card gets every desk that actually has articles on it, in the
  // same order as the log, so the card is a real index and not a top-N chart.
  const deskIndex: DeskCount[] = grouped.map((g) => ({
    label: g.desk.label,
    slug: g.desk.slug,
    count: g.items.length,
  }));

  // Split the front door down the middle, so the contents card reads as two
  // ruled columns rather than one long list. Ceil keeps the left column longer
  // when the count is odd, which is how a printed contents page sets.
  const half = Math.ceil(featured.length / 2);
  const featuredColumns = [featured.slice(0, half), featured.slice(half)].filter(
    (col) => col.length > 0
  );

  // Collection structured data, the full article library as an ordered list.
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "FRC guides & articles",
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/blog/${a.slug}`,
      name: a.title,
    })),
  };

  return (
    <>
      <JsonLd data={collectionLd} />

      {/* ===================== MASTHEAD =====================
          Asymmetric on purpose: the sentence that says what this section is
          runs down the left, and the card of dividers is taped to the right,
          which is where a reader's hand goes to find a tab. */}
      <section className="nb-wrap pb-[clamp(2rem,4vw,3rem)] pt-[clamp(2.2rem,5vw,4rem)]">
        <div className="grid items-start gap-[clamp(1.8rem,4vw,3.6rem)] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.85fr)]">
          <div>
            <p className="nb-marker">the loose pages</p>

            <h1 className="max-w-[17ch]">
              Every question a team ends up googling.
            </h1>

            <p className="nb-lede mt-[clamp(1rem,2vw,1.5rem)]">
              {articles.length} write-ups of the things that break, the things
              nobody explains, and the parts of a season you only learn by
              losing a match.
            </p>

            <div className="mt-[clamp(1.3rem,2.6vw,1.9rem)] flex flex-wrap gap-3">
              <a href="#start-here-six" className="nb-btn">
                Start with six
              </a>
              <Link href="/guides" className="nb-btn-ghost">
                Browse the guides
              </Link>
            </div>

            <p className="nb-hair nb-slug mt-[clamp(1.3rem,2.6vw,1.9rem)] pt-3">
              {articles.length} articles / {totalMins.toLocaleString()} minutes
              of reading / no account to read any of it
            </p>
          </div>

          <div>
            <DeskIndex desks={deskIndex} />
            <p className="nb-pen mt-4 rotate-[-1.2deg] pl-2">
              start at the desk your team is worst at
            </p>
          </div>
        </div>
      </section>

      {/* ===================== THE FRONT DOOR =====================
          The contents page a binder opens on: one drawn frame, two ruled
          columns, six numbered entries. It is not a card grid, because these
          six are an ordered reading list and cards would say they are peers. */}
      {featured.length > 0 && (
        <section
          id="start-here-six"
          className="nb-wrap py-[clamp(2.4rem,5vw,4rem)]"
        >
          <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
            <div className="mb-[clamp(1.4rem,3vw,2.2rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <h2 className="max-w-[18ch]">If you only read {featured.length}</h2>
                <p className="nb-sub mt-3">
                  What FRC actually is, how to get a team off the ground, how a
                  competition day runs, and the two topics every team ends up
                  arguing about at 1am.
                </p>
              </div>
              <p className="nb-slug shrink-0">read in this order</p>
            </div>

            {/* overflow-hidden clips the panels to the frame's hand-drawn
                corners; without it the 2px divider runs past the border. */}
            <div className="nb-box grid overflow-hidden min-[860px]:grid-cols-2">
              {featuredColumns.map((col, colIndex) => (
                <ol key={colIndex} className="nb-panel list-none">
                  {col.map((a, i) => {
                    const n = colIndex * half + i + 1;
                    return (
                      <li
                        key={a.slug}
                        className="nb-hair py-[clamp(0.9rem,1.8vw,1.15rem)] first:border-t-0 first:pt-0 last:pb-0"
                      >
                        <Link href={`/blog/${a.slug}`} className="group flex gap-4">
                          <span
                            className="nb-slug shrink-0 pt-1 text-[0.92rem] font-bold text-blue tabular-nums"
                            aria-hidden="true"
                          >
                            {String(n).padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <h3 className="group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-[5px]">
                              {a.title}
                            </h3>
                            <span className="mt-1.5 block text-[0.92rem] leading-snug text-graphite">
                              {a.description}
                            </span>
                            <span className="nb-slug mt-2 block">
                              {a.readMins} min
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== THE LOG =====================
          Every article, as carbon copies filed under the desk that owns it.
          Rows rather than cards: this is a list to scan for one title, and a
          hundred cards would be a hundred equally loud invitations. */}
      <section className="nb-wrap pb-[clamp(2.6rem,5vw,4.4rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <p className="nb-marker">
            {articles.length} articles / {grouped.length} desks
          </p>
          <p className="nb-sub max-w-[52ch] text-[1.05rem]">
            Everything in print, filed where a person would go looking for it.
            Jump straight to a desk, or read down the page.
          </p>

          <nav
            aria-label="Jump to a desk"
            className="mt-[clamp(1.1rem,2.2vw,1.5rem)] flex flex-wrap gap-2"
          >
            {grouped.map((g) => (
              <a
                key={g.desk.slug}
                href={`#${g.desk.slug}`}
                className="nb-tag min-h-[var(--tap)] px-3"
              >
                {g.desk.label}
                <span className="font-bold text-blue tabular-nums">
                  {g.items.length}
                </span>
              </a>
            ))}
          </nav>
        </div>

        {grouped.map((g) => (
          <section
            key={g.desk.slug}
            id={g.desk.slug}
            className="pt-[clamp(2.2rem,4.4vw,3.4rem)]"
          >
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <div>
                <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">
                  {g.desk.label}
                </h2>
                <p className="nb-sub mt-2 text-[0.98rem]">{g.desk.blurb}</p>
              </div>
              <p className="nb-count shrink-0">
                {g.items.length}
                <small>{g.items.length === 1 ? "article" : "articles"}</small>
              </p>
            </div>

            <div className="nb-list mt-[clamp(1rem,2vw,1.4rem)]">
              {g.items.map((a) => (
                <Link key={a.slug} href={`/blog/${a.slug}`} className="nb-row">
                  <span className="nb-slug">
                    {a.readMins} min read
                    <br />
                    {fmtDate(a.date)}
                  </span>
                  {/* Capped at a readable measure rather than filling the
                      column: the empty space to its right is the ledger
                      margin, and a 110-character line is not a scannable one. */}
                  <span className="min-w-0 max-w-[62ch]">
                    <h3>{a.title}</h3>
                    <span className="mt-1.5 block text-[0.94rem] leading-snug text-graphite">
                      {a.description}
                    </span>
                  </span>
                  <span className="nb-slug hidden whitespace-nowrap min-[769px]:block">
                    open
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </section>

      {/* ===================== THE LIST =====================
          One ask, at the bottom, after the reader has seen everything on
          offer. Taped to the page like a sign-up sheet on a shop wall. */}
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)]">
        <div className="nb-rule pt-[clamp(1.8rem,3.5vw,2.6rem)]">
          <div className="nb-box nb-tilt-3 grid gap-[clamp(1.2rem,3vw,2.4rem)] p-[clamp(1.3rem,2.8vw,2.1rem)] min-[820px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] min-[820px]:items-center">
            <span
              className="nb-tape -top-3 left-[12%] rotate-[-3.4deg]"
              aria-hidden="true"
            />
            <span
              className="nb-tape -bottom-3 right-[16%] rotate-[2.8deg]"
              aria-hidden="true"
            />

            <div>
              <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2.1rem)]">
                One email when a new one goes up.
              </h2>
              <p className="mt-3 max-w-[42ch] text-graphite">
                Nothing else gets sent. The articles stay free and readable
                without an account either way, so this is only for people who
                would rather not check back.
              </p>
            </div>

            <NewsletterForm className="min-[820px]:justify-self-end" />
          </div>
        </div>
      </section>
    </>
  );
}
