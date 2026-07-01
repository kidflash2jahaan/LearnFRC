import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ExternalLink, MessageSquarePlus, Library } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deptMeta } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { FeedbackForm } from "@/components/feedback-form";
import { AnimatedCounter } from "@/components/animated-counter";
import type { Resource } from "@/lib/types";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "The essential FRC links — official docs, software, vendors, community, and learning resources, plus the sources behind every LearnFRC guide.",
};

const CATEGORY_META: Record<string, { icon: string; a: string }> = {
  "Official FIRST": { icon: "Trophy", a: "#2560e6" },
  "Software & Programming": { icon: "Code2", a: "#1aa9d6" },
  "CAD & Design": { icon: "PenTool", a: "#7c5cff" },
  "Hardware & Vendors": { icon: "Cog", a: "#0f9d8f" },
  "Community & Data": { icon: "LineChart", a: "#2560e6" },
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

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("name, slug, sources")
    .order("sort_order");

  const totalLinks = CURATED.reduce((s, g) => s + g.links.length, 0);
  const withSources = (departments ?? []).filter(
    (d) => ((d.sources as Resource[]) ?? []).length > 0,
  );
  const totalSources = withSources.reduce(
    (s, d) => s + ((d.sources as Resource[]) ?? []).length,
    0,
  );

  return (
    <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(37,96,230,0.22), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-40 -z-10 h-80 w-80 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(26,169,214,0.20), transparent 70%)" }}
      />

      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="aq-eyebrow aq-rise aq-rise-1">Bookmark the whole toolbox</p>
          <h1 className="aq-display aq-rise aq-rise-2 mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Every FRC{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg,#2560e6,#1aa9d6,#7c5cff,#2560e6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              resource
            </span>{" "}
            worth keeping
          </h1>
          <p className="aq-rise aq-rise-3 mt-4 max-w-xl text-pretty text-lg text-foreground/70">
            The docs, software, vendors, and community hubs every team leans on
            through build season — plus the authoritative sources behind every
            LearnFRC guide.
          </p>
          <div className="aq-rise aq-rise-4 mt-7 flex flex-wrap items-center gap-3">
            <a href="#curated" className="aq-cta inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold">
              <Library className="h-4 w-4" />
              Browse the links
            </a>
            <a href="#suggest" className="aq-ghost inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold">
              <MessageSquarePlus className="h-4 w-4" />
              Suggest a resource
            </a>
          </div>
        </div>

        {/* Floating stat panel */}
        <div className="aq-glass aq-sheen aq-float aq-rise aq-rise-3 rounded-3xl p-6 sm:p-7">
          <div className="grid grid-cols-2 gap-4">
            <div className="aq-card aq-card-hover rounded-2xl p-4">
              <div className="aq-display text-3xl font-bold text-foreground">
                <AnimatedCounter value={totalLinks} />
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Curated links
              </div>
            </div>
            <div className="aq-card aq-card-hover rounded-2xl p-4">
              <div className="aq-display text-3xl font-bold text-foreground">
                <AnimatedCounter value={CURATED.length} />
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Categories
              </div>
            </div>
          </div>
          <div className="aq-divider my-5" />
          <div className="flex flex-wrap gap-2">
            {CURATED.map((g, i) => (
              <span
                key={g.category}
                className="aq-chip aq-reveal"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {g.category}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Curated categories */}
      <div id="curated" className="mt-20 space-y-14 scroll-mt-28">
        {CURATED.map((group) => {
          const cm = CATEGORY_META[group.category] ?? { icon: "BookOpen", a: "#2560e6" };
          return (
            <Reveal key={group.category} className="aq-reveal">
              <div className="mb-5 flex items-center gap-3">
                <span
                  className="aq-badge aq-badge-bob h-10 w-10"
                  style={{ "--a": cm.a } as CSSProperties}
                >
                  <Icon name={cm.icon} className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="aq-display text-xl font-bold leading-tight">{group.category}</h2>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.links.length} link{group.links.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.links.map((l) => (
                  <StaggerItem key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aq-card aq-card-hover group flex h-full items-center justify-between gap-3 rounded-2xl p-4"
                    >
                      <span className="font-medium text-foreground transition-colors group-hover:text-primary">
                        {l.title}
                      </span>
                      <span className="aq-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </span>
                    </a>
                  </StaggerItem>
                ))}
              </Stagger>
            </Reveal>
          );
        })}
      </div>

      {/* Sources by department */}
      <Reveal className="aq-reveal mt-24">
        <p className="aq-eyebrow">Grounded in real sources</p>
        <h2 className="aq-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Sources behind the guides
        </h2>
        <p className="mb-6 mt-3 max-w-2xl text-foreground/70">
          Every LearnFRC guide is built on authoritative references — the same
          docs and manuals mentors point rookies to. Here they are, department by
          department.
        </p>
        <div className="mb-8 flex flex-wrap gap-3">
          <div className="aq-card aq-card-hover rounded-2xl px-5 py-3">
            <span className="aq-display text-2xl font-bold text-foreground">
              <AnimatedCounter value={totalSources} suffix="+" />
            </span>{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              cited sources
            </span>
          </div>
          <div className="aq-card aq-card-hover rounded-2xl px-5 py-3">
            <span className="aq-display text-2xl font-bold text-foreground">
              <AnimatedCounter value={withSources.length} />
            </span>{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              departments
            </span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {withSources.map((d, di) => {
            const m = deptMeta(d.slug as string);
            const sources = ((d.sources as Resource[]) ?? []).slice(0, 6);
            return (
              <div
                key={d.slug as string}
                className="aq-tile aq-card-hover aq-reveal rounded-2xl p-5"
                style={{ "--a": m.color, animationDelay: `${di * 80}ms` } as CSSProperties}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="aq-badge aq-badge-bob h-10 w-10"
                    style={{ "--a": m.color } as CSSProperties}
                  >
                    <Icon name={m.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="aq-display text-base font-bold text-foreground">
                    {d.name as string}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {sources.map((s, i) => (
                    <li
                      key={i}
                      className="aq-reveal"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-2 text-sm text-foreground/80 transition-colors hover:text-primary"
                      >
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        <span>{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* Suggest */}
      <Reveal className="aq-reveal mt-24">
        <div id="suggest" className="aq-glass aq-sheen scroll-mt-28 rounded-3xl p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="aq-icon aq-badge-bob flex h-11 w-11 items-center justify-center rounded-2xl">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
            </span>
            <h2 className="aq-display text-xl font-bold sm:text-2xl">
              Suggest a topic or resource
            </h2>
          </div>
          <p className="mb-6 max-w-xl text-foreground/70">
            Missing something you&apos;d find useful? Tell us what to add — in the
            spirit of gracious professionalism, your suggestion goes straight to
            the team.
          </p>
          <div className="max-w-xl">
            <FeedbackForm page="/resources" />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
