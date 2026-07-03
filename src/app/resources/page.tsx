import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Library, MessageSquarePlus, ArrowUpRight } from "lucide-react";
import { getDepartmentSources } from "@/lib/queries";
import { deptMeta, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { FeedbackForm } from "@/components/feedback-form";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import type { Resource } from "@/lib/types";
import { ToolboxPanel } from "./_toolbox-panel";
import { ShelfRail } from "./_shelf-rail";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "The essential FRC links — official docs, software, vendors, community, and learning resources, plus the sources behind every LearnFRC guide.",
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const CATEGORY_META: Record<
  string,
  { icon: string; a: string; blurb: string }
> = {
  "Official FIRST": {
    icon: "Trophy",
    a: "#2560e6",
    blurb: "The manual, season materials, and game tools straight from FIRST.",
  },
  "Software & Programming": {
    icon: "Code2",
    a: "#1aa9d6",
    blurb: "WPILib and the vision, path, and trajectory tools your code leans on.",
  },
  "CAD & Design": {
    icon: "PenTool",
    a: "#7c5cff",
    blurb: "Model the robot before you cut metal — free CAD built for FRC.",
  },
  "Hardware & Vendors": {
    icon: "Cog",
    a: "#0f9d8f",
    blurb: "Where the motors, gearboxes, and structure come from.",
  },
  "Community & Data": {
    icon: "LineChart",
    a: "#2560e6",
    blurb: "Forums and match data — the collective brain of the FRC world.",
  },
};

const CURATED: { category: string; links: Resource[] }[] = [
  {
    category: "Official FIRST",
    links: [
      { title: "FIRST Robotics Competition", url: "https://www.firstinspires.org/robotics/frc" },
      { title: "FRC Game & Season Materials", url: "https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system" },
      { title: "FRC Driver Station & Game Tools", url: "https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/frc-game-tools.html" },
    ],
  },
  {
    category: "Software & Programming",
    links: [
      { title: "WPILib Documentation", url: "https://docs.wpilib.org" },
      { title: "PathPlanner", url: "https://pathplanner.dev" },
      { title: "Choreo (trajectory tool)", url: "https://choreo.autos" },
      { title: "PhotonVision", url: "https://docs.photonvision.org" },
      { title: "Limelight Documentation", url: "https://docs.limelightvision.io" },
    ],
  },
  {
    category: "CAD & Design",
    links: [
      { title: "Onshape", url: "https://www.onshape.com" },
      { title: "Onshape for FRC (FeatureScript/MKCad)", url: "https://www.mkcad.com" },
    ],
  },
  {
    category: "Hardware & Vendors",
    links: [
      { title: "REV Robotics", url: "https://www.revrobotics.com" },
      { title: "CTR Electronics (Phoenix)", url: "https://store.ctr-electronics.com" },
      { title: "AndyMark", url: "https://www.andymark.com" },
      { title: "WestCoast Products (WCP)", url: "https://wcproducts.com" },
    ],
  },
  {
    category: "Community & Data",
    links: [
      { title: "Chief Delphi (forums)", url: "https://www.chiefdelphi.com" },
      { title: "The Blue Alliance", url: "https://www.thebluealliance.com" },
      { title: "Statbotics", url: "https://www.statbotics.io" },
    ],
  },
];

/** Slug-safe anchor id for a category name. */
function shelfId(category: string): string {
  return "shelf-" + category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Strip protocol/www for a compact host label under each link. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function ResourcesPage() {
  const departments = await getDepartmentSources();

  const totalLinks = CURATED.reduce((s, g) => s + g.links.length, 0);
  const withSources = (departments ?? []).filter(
    (d) => ((d.sources as Resource[]) ?? []).length > 0,
  );
  const totalSources = withSources.reduce(
    (s, d) => s + ((d.sources as Resource[]) ?? []).length,
    0,
  );

  const railItems = CURATED.map((g) => {
    const cm = CATEGORY_META[g.category] ?? { icon: "BookOpen", a: "#2560e6", blurb: "" };
    return {
      id: shelfId(g.category),
      label: g.category,
      count: g.links.length,
      icon: cm.icon,
      color: cm.a,
    };
  });

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "620px", pos: { left: "-170px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "560px", pos: { right: "-190px", top: "-100px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "520px", pos: { left: "32%", top: "760px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
        {/* ============================ HERO ============================ */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <RiseGroup>
            <RiseItem>
              <span className="ac-chip inline-flex items-center gap-2">
                <Library className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="ac-eyebrow">The FRC toolbox</span>
              </span>
            </RiseItem>
            <RiseItem>
              <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.04] sm:text-5xl lg:text-[3.3rem]">
                Every FRC <span style={BRAND_GRADIENT}>resource</span> worth
                keeping
              </h1>
            </RiseItem>
            <RiseItem>
              <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
                A curated toolbox for build season — the docs, software,
                vendors, and community hubs every team reaches for, organized
                on shelves so you always know where to look. Plus the
                authoritative sources behind every LearnFRC guide.
              </p>
            </RiseItem>
            <RiseItem>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="#toolbox" className="ac-btn text-sm">
                  <Library className="h-4 w-4" aria-hidden />
                  Open the toolbox
                </a>
                <a href="#suggest" className="ac-btn-ghost text-sm">
                  <MessageSquarePlus className="h-4 w-4" aria-hidden />
                  Suggest a resource
                </a>
              </div>
            </RiseItem>
            <RiseItem>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span>
                  <b className="font-semibold text-foreground">
                    <AnimatedCounter value={totalLinks} />
                  </b>{" "}
                  curated links
                </span>
                <span>
                  <b className="font-semibold text-foreground">
                    <AnimatedCounter value={CURATED.length} />
                  </b>{" "}
                  shelves
                </span>
                <span>
                  <b className="font-semibold text-foreground">
                    <AnimatedCounter value={totalSources} suffix="+" />
                  </b>{" "}
                  guide sources
                </span>
              </div>
            </RiseItem>
          </RiseGroup>

          <ToolboxPanel
            shelves={railItems}
            totalLinks={totalLinks}
            totalSources={totalSources}
          />
        </section>

        {/* ============================ TOOLBOX ========================= */}
        <section id="toolbox" className="mt-24 scroll-mt-28">
          <Reveal>
            <p className="ac-eyebrow">Everything on a shelf</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              The curated toolbox
            </h2>
            <p className="mt-3 max-w-2xl text-foreground/70">
              Grouped the way a well-run pit is — each shelf holds the tools
              for one job, so the link you need is always where you expect
              it.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
            {/* Sticky index rail (desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Shelves
                </p>
                <ShelfRail items={railItems} />
              </div>
            </aside>

            {/* The shelves */}
            <div className="min-w-0 space-y-6">
              {CURATED.map((group, gi) => {
                const cm =
                  CATEGORY_META[group.category] ?? {
                    icon: "BookOpen",
                    a: "#2560e6",
                    blurb: "",
                  };
                const ink = inkFor(cm.a);
                return (
                  <Reveal key={group.category} delay={gi * 0.05}>
                    <section
                      id={shelfId(group.category)}
                      className="ac-card scroll-mt-28 overflow-hidden p-0"
                    >
                      {/* Shelf header */}
                      <div
                        className="flex items-center gap-3 border-b border-border px-5 py-4"
                        style={{
                          background: `linear-gradient(180deg, color-mix(in srgb, ${cm.a} 10%, transparent), transparent)`,
                        }}
                      >
                        <span
                          className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
                          style={{ "--a": cm.a } as CSSProperties}
                        >
                          <Icon name={cm.icon} className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-lg font-bold leading-tight text-foreground">
                            {group.category}
                          </h3>
                          {cm.blurb ? (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                              {cm.blurb}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums"
                          style={{
                            color: ink,
                            background: `color-mix(in srgb, ${cm.a} 14%, transparent)`,
                          }}
                        >
                          {group.links.length}
                        </span>
                      </div>

                      {/* Shelf contents */}
                      <ul className="divide-y divide-border">
                        {group.links.map((l) => (
                          <li key={l.url}>
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex min-h-[52px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                            >
                              <span
                                aria-hidden="true"
                                className="h-9 w-1 shrink-0 rounded-full transition-all duration-300 group-hover:h-10"
                                style={{ background: cm.a }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-foreground transition-colors group-hover:text-primary">
                                  {l.title}
                                  <span className="sr-only">
                                    {" "}
                                    (opens in a new tab)
                                  </span>
                                </span>
                                <span className="block truncate font-mono text-xs text-muted-foreground">
                                  {hostLabel(l.url)}
                                </span>
                              </span>
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                                <ArrowUpRight className="h-4 w-4" aria-hidden />
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ====================== SOURCES BY DEPARTMENT ================= */}
        <section className="mt-24">
          <Reveal>
            <p className="ac-eyebrow">Grounded in real sources</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Sources behind the guides
            </h2>
            <p className="mb-6 mt-3 max-w-2xl text-foreground/70">
              Every LearnFRC guide is built on authoritative references — the
              same docs and manuals mentors point rookies to. Here they are,
              department by department.
            </p>
            <div className="mb-8 flex flex-wrap gap-3">
              <div className="ac-card rounded-2xl px-5 py-3">
                <span className="font-display text-2xl font-bold text-foreground">
                  <AnimatedCounter value={totalSources} suffix="+" />
                </span>{" "}
                <span className="text-sm font-semibold text-muted-foreground">
                  cited sources
                </span>
              </div>
              <div className="ac-card rounded-2xl px-5 py-3">
                <span className="font-display text-2xl font-bold text-foreground">
                  <AnimatedCounter value={withSources.length} />
                </span>{" "}
                <span className="text-sm font-semibold text-muted-foreground">
                  departments
                </span>
              </div>
            </div>
          </Reveal>

          {withSources.length === 0 ? (
            <Reveal>
              <div className="ac-card p-6 text-foreground/70">
                Sources are being compiled — check back soon as each
                department&apos;s guides are published.
              </div>
            </Reveal>
          ) : (
            <RevealGroup className="grid gap-4 sm:grid-cols-2">
              {withSources.map((d) => {
                const m = deptMeta(d.slug as string);
                const ink = inkFor(m.color);
                const sources = ((d.sources as Resource[]) ?? []).slice(0, 6);
                return (
                  <RevealItem key={d.slug as string}>
                    <Hover className="h-full" lift={-4}>
                      <div
                        className="ac-tile h-full p-5"
                        style={{ "--a": m.color } as CSSProperties}
                      >
                        <div className="mb-4 flex items-center gap-3">
                          <span
                            className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
                            style={{ "--a": m.color } as CSSProperties}
                          >
                            <Icon name={m.icon} className="h-5 w-5" />
                          </span>
                          <h3 className="font-display text-base font-bold text-foreground">
                            {d.name as string}
                          </h3>
                        </div>
                        <ul className="space-y-2">
                          {sources.map((s, i) => (
                            <li key={i}>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-start gap-2 py-0.5 text-sm text-foreground/80 transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                style={{ "--ink": ink } as CSSProperties}
                              >
                                <ArrowUpRight
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                  style={{ color: ink }}
                                  aria-hidden
                                />
                                <span>
                                  {s.title}
                                  <span className="sr-only">
                                    {" "}
                                    (opens in a new tab)
                                  </span>
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Hover>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          )}
        </section>

        {/* ============================ SUGGEST ========================= */}
        <Reveal className="mt-24">
          <div id="suggest" className="ac-glass scroll-mt-28 p-6 sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="ac-badge flex h-11 w-11 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <MessageSquarePlus className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="font-display text-xl font-bold sm:text-2xl">
                Suggest a topic or resource
              </h2>
            </div>
            <p className="mb-6 max-w-xl text-foreground/70">
              Missing something you&apos;d find useful? Tell us what to add —
              in the spirit of gracious professionalism, your suggestion goes
              straight to the team.
            </p>
            <div className="max-w-xl">
              <FeedbackForm page="/resources" />
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
