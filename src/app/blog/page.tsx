import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Compass,
  LayoutGrid,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { type Article } from "@/lib/blog-data";
import { getArticles } from "@/lib/queries";
import { NewsletterForm } from "@/components/newsletter-form";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import { JsonLd } from "@/components/json-ld";
import { DeskIndex, type DeskCount } from "./_desk-index";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com";

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

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Editorial "desks" — the real shelves the library is filed on. Ordered by
 * reading order, not size: someone landing here cold should meet "Start Here"
 * and the competition-day troubleshooting shelf before the deep technical ones.
 *
 * Rules are matched against the slug FIRST (deterministic — every one of the
 * current articles lands on a real desk, none fall through), with the keyword
 * list as a second pass so future articles still file themselves. Purely
 * presentational grouping: no article is invented, duplicated, or dropped.
 */
const DESKS: { label: string; slug: string; color: string; icon: string; blurb: string; test: RegExp }[] = [
  {
    label: "Start Here",
    slug: "start-here",
    color: "#2560e6",
    icon: "Rocket",
    blurb: "What FRC is, how a season runs, and how to get on a team.",
    test: /^what-is-frc|start-an-frc|joining-your-first|vs-ftc-vs-vex|rookie-mistakes|kickoff|how-frc-competitions-work|game-manual|team-structure|mentor-guide|gracious/i,
  },
  {
    label: "In the Pit",
    slug: "in-the-pit",
    color: "#ef4444",
    icon: "HardHat",
    blurb: "Competition-day failures and how to diagnose them fast.",
    test: /troubleshoot|inspection|pit-checklist|status-lights|no-robot-code|bumpers|robot-rules|battery|first-frc-competition|radio-networking|module-offsets/i,
  },
  {
    label: "Drivetrain & Mechanisms",
    slug: "drivetrain-mechanisms",
    color: "#1aa9d6",
    icon: "Cog",
    blurb: "Swerve, gearing, intakes, elevators, shooters, and how to build them.",
    test: /swerve|drivetrain|gear-ratio|wheels|chain-vs-belt|intake|elevator|shooter|manufacturing|pneumatics|robot-design-process/i,
  },
  {
    label: "Programming",
    slug: "programming",
    color: "#7c5cff",
    icon: "Code2",
    blurb: "WPILib, command-based structure, autonomous, and tuning.",
    test: /program|wpilib|code|software|pid|simulation|pathplanner|choreo|odometry|dashboards|advantagescope|java-vs/i,
  },
  {
    label: "Electrical & Power",
    slug: "electrical-power",
    color: "#e0803a",
    icon: "Zap",
    blurb: "Wiring, the control system, motors, and the vendor ecosystems.",
    test: /wire|electrical|can-bus|pdh|roborio|motors|control-system|power|ctre|rev-robotics|phoenix|spark|talon/i,
  },
  {
    label: "Vision & Sensors",
    slug: "vision-sensors",
    color: "#d64b8a",
    icon: "Radar",
    blurb: "AprilTags, Limelight, PhotonVision, encoders and gyros.",
    test: /apriltag|limelight|photonvision|vision|sensors/i,
  },
  {
    label: "CAD & Design",
    slug: "cad-design",
    color: "#12b565",
    icon: "PenTool",
    blurb: "Choosing a CAD package and modelling your first parts.",
    test: /cad|onshape|solidworks/i,
  },
  {
    label: "Scouting & Strategy",
    slug: "scouting-strategy",
    color: "#0f766e",
    icon: "LineChart",
    blurb: "Match data, picklists, alliance selection, and drive team.",
    test: /scout|picklist|opr|epa|statbotics|blue-alliance|alliance-selection|defense|ranking-points|districts|world-championship|drive-team/i,
  },
  {
    label: "Awards, Money & Outreach",
    slug: "awards-money-outreach",
    color: "#c9a227",
    icon: "Trophy",
    blurb: "Impact Award, sponsorship, grants, budgets and scholarships.",
    test: /impact|award|sponsor|grant|scholarship|budget|fund/i,
  },
  {
    label: "Season & Events",
    slug: "season-events",
    color: "#64748b",
    icon: "Star",
    blurb: "Calendars, kickoff, the offseason, and what's coming in 2027.",
    test: /2027|calendar|offseason|biocore|systemcore|kit-of-parts|build-season/i,
  },
];
const FALLBACK_DESK = {
  label: "Field Notes",
  slug: "field-notes",
  color: "#4d5b78",
  icon: "BookOpen",
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
 * The six we'd hand a stranger first. Chosen deliberately, not by recency:
 * the three the site already advertises in its own meta description (starting
 * a team, swerve, the Impact Award), the single most-read article in the
 * library, and the two pieces that explain the whole competition end to end.
 * They also appear in their desk below — this set is a front door, not a
 * separate shelf.
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

  const deskCounts = new Map<string, DeskCount>();
  for (const a of articles) {
    const d = deskFor(a);
    const existing = deskCounts.get(d.label);
    if (existing) existing.count += 1;
    else deskCounts.set(d.label, { label: d.label, color: d.color, icon: d.icon, count: 1 });
  }
  const desks = [...deskCounts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  const deskCount = deskCounts.size;

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

  // Collection structured data — the full article library as an ordered list.
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
    <div className="relative overflow-x-clip">
      <JsonLd data={collectionLd} />
      <Glow
        blobs={[
          { size: "620px", pos: { left: "-180px", top: "-200px" }, color: "#8bbcff", opacity: 0.65 },
          { size: "560px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "520px", pos: { left: "30%", top: "620px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      {/* ============================ MASTHEAD ============================ */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-20 lg:pt-36 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Newspaper className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">The LearnFRC Reader</span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-[3.3rem]">
              FRC articles,{" "}
              <span style={BRAND_GRADIENT}>decoded for the pit.</span>
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
              Practical, no-fluff walkthroughs of the parts of FRC people search
              for most — starting a team, understanding swerve, winning the
              Impact Award. Free, written by an FRC student, filed by desk.
            </p>
          </RiseItem>
          <RiseItem>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <NewsletterForm />
              <Link href="/guides" className="ac-btn-ghost text-sm">
                <LayoutGrid className="h-4 w-4" aria-hidden /> Browse the guides
              </Link>
            </div>
          </RiseItem>
          <RiseItem>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={articles.length} />
                </b>{" "}
                articles in print
              </span>
              <span>
                <b className="font-semibold text-foreground">
                  <AnimatedCounter value={totalMins} />
                </b>{" "}
                minutes of reading
              </span>
              <span>
                <b className="font-semibold text-foreground">$0</b> — always
              </span>
            </div>
          </RiseItem>
        </RiseGroup>

        <DeskIndex
          guideCount={articles.length}
          totalMins={totalMins}
          deskCount={deskCount}
          desks={desks}
        />
      </section>

      {/* ============================ START HERE =========================== */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
          <Reveal>
            <p className="ac-eyebrow flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" aria-hidden /> New here?
            </p>
            <h2 className="mt-2 text-balance font-display text-3xl font-bold sm:text-4xl">
              Start with these {featured.length}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              If you read nothing else, read these — what FRC actually is, how to
              get a team off the ground, how a competition runs, and the two
              topics every team ends up arguing about.
            </p>
          </Reveal>

          <RevealGroup className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((a, i) => {
              const desk = deskFor(a);
              return (
                <RevealItem key={a.slug} className="h-full">
                  <Hover className="h-full" lift={-5}>
                    <Link
                      href={`/blog/${a.slug}`}
                      className="ac-tile group relative flex h-full flex-col p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      style={{ "--a": desk.color } as CSSProperties}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute right-4 top-3 font-display text-3xl font-extrabold text-foreground/10"
                      >
                        {i + 1}
                      </span>
                      <h3 className="pr-9 font-display text-[17px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                        {a.title}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {a.description}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                        Read · {a.readMins} min
                        <ArrowUpRight
                          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                          aria-hidden
                        />
                      </span>
                    </Link>
                  </Hover>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </section>
      )}

      {/* ========================= THE FULL LIBRARY ======================== */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ac-eyebrow">Every article, filed by desk</p>
              <h2 className="mt-2 text-balance font-display text-3xl font-bold sm:text-4xl">
                The full library
              </h2>
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <AnimatedCounter value={articles.length} /> articles
            </span>
          </div>

          <nav aria-label="Jump to a desk" className="mt-6 flex flex-wrap gap-2">
            {grouped.map((g) => (
              <a
                key={g.desk.slug}
                href={`#${g.desk.slug}`}
                className="ac-chip inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground/80 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: g.desk.color }}
                />
                {g.desk.label}
                <span className="text-xs font-bold tabular-nums text-muted-foreground">
                  {g.items.length}
                </span>
              </a>
            ))}
          </nav>
        </Reveal>

        <div className="mt-12 space-y-14">
          {grouped.map((g) => (
            <section key={g.desk.slug} id={g.desk.slug} className="scroll-mt-24">
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                    style={{ "--a": g.desk.color } as CSSProperties}
                  >
                    <Icon name={g.desk.icon} className="h-[22px] w-[22px]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl font-bold leading-tight">
                      {g.desk.label}
                    </h3>
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                      {g.desk.blurb}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {g.items.length} {g.items.length === 1 ? "article" : "articles"}
                  </span>
                </div>
              </Reveal>

              <RevealGroup className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((a) => (
                  <RevealItem key={a.slug} className="h-full">
                    <Hover className="h-full" lift={-5}>
                      <Link
                        href={`/blog/${a.slug}`}
                        className="ac-card group flex h-full flex-col p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="ac-badge flex h-9 w-9 items-center justify-center"
                            style={{ "--a": g.desk.color } as CSSProperties}
                          >
                            <Icon name={g.desk.icon} className="h-[18px] w-[18px]" aria-hidden />
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {a.readMins} min · {fmtDate(a.date)}
                          </span>
                        </div>
                        <h4 className="mt-4 font-display text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                          {a.title}
                        </h4>
                        <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted-foreground">
                          {a.description}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-1 border-t border-border pt-4 text-sm font-semibold text-primary">
                          Read
                          <ArrowUpRight
                            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                            aria-hidden
                          />
                        </span>
                      </Link>
                    </Hover>
                  </RevealItem>
                ))}
              </RevealGroup>
            </section>
          ))}
        </div>
      </section>

      {/* =========================== NEWSLETTER BAND =========================== */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="ac-glass relative overflow-hidden p-8 text-center sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.25),transparent_70%)] blur-2xl"
            />
            <p className="ac-eyebrow">New lessons, filed weekly</p>
            <h2 className="mx-auto mt-3 max-w-xl text-balance font-display text-3xl font-bold sm:text-4xl">
              Never miss a new{" "}
              <span style={BRAND_GRADIENT}>article.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Join the list for new FRC articles as they&apos;re published — no spam,
              unsubscribe anytime.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3">
              <NewsletterForm className="justify-self-center" />
              <Link
                href="/guides"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary"
              >
                Or browse all guides
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
