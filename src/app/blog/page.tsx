import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { ARTICLES, type Article } from "@/lib/blog-data";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AnimatedCounter } from "@/components/animated-counter";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.systemerr.com";

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
 * Derive an editorial "desk" (topic) for an article from its slug/keywords.
 * Purely presentational grouping — no data is invented or dropped.
 */
const DESKS: { label: string; color: string; test: RegExp }[] = [
  { label: "Getting Started", color: "#2560e6", test: /start|what-is|beginner|join/i },
  { label: "Drivetrain", color: "#1aa9d6", test: /swerve|drivetrain|gear|mecanum|tank/i },
  { label: "Programming", color: "#7c5cff", test: /program|wpilib|code|software/i },
  { label: "Electrical", color: "#e0803a", test: /wire|electrical|power|can-bus/i },
  { label: "CAD & Design", color: "#12b565", test: /cad|design|onshape|solidworks/i },
  { label: "Scouting", color: "#d64b8a", test: /scout|picklist|strategy|opr|epa/i },
  { label: "Awards & Business", color: "#c9a227", test: /impact|award|sponsor|fund|business/i },
];

function deskFor(a: Article) {
  const hay = `${a.slug} ${a.keywords.join(" ")}`;
  return DESKS.find((d) => d.test.test(hay)) ?? { label: "Field Notes", color: "#4d5b78" };
}

export default function BlogPage() {
  const articles = [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
  const totalMins = articles.reduce((sum, a) => sum + a.readMins, 0);
  const deskCount = new Set(articles.map((a) => deskFor(a).label)).size;

  return (
    <div
      data-theme="arena"
      className="aq-root relative isolate overflow-x-clip text-foreground"
    >
      {/* ambient light the glass refracts */}
      <div className="aq-glow" aria-hidden>
        <span
          className="h-[620px] w-[620px] opacity-70"
          style={{
            left: "-180px",
            top: "-200px",
            background: "radial-gradient(circle, #8bbcff, transparent 70%)",
          }}
        />
        <span
          className="h-[560px] w-[560px] opacity-55"
          style={{
            right: "-160px",
            top: "-120px",
            background: "radial-gradient(circle, #6ff0ea, transparent 70%)",
          }}
        />
        <span
          className="h-[520px] w-[520px] opacity-45"
          style={{
            left: "30%",
            top: "620px",
            background: "radial-gradient(circle, #c8b6ff, transparent 70%)",
          }}
        />
      </div>

      {/* ============================ MASTHEAD ============================ */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-20 sm:px-6 sm:pt-28 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="aq-eyebrow aq-rise aq-rise-1 aq-badge-bob inline-flex items-center gap-2">
              <Newspaper className="h-3.5 w-3.5" aria-hidden="true" /> The LearnFRC
              Reader
            </span>
            <h1 className="aq-display aq-rise aq-rise-2 mt-3 text-balance text-4xl font-extrabold leading-[1.02] sm:text-5xl lg:text-[3.3rem]">
              FRC guides,{" "}
              <span
                className="aq-grad-anim"
                style={{
                  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                decoded for the pit.
              </span>
            </h1>
            <p className="aq-rise aq-rise-3 mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
              Practical, no-fluff walkthroughs of the parts of FRC people search
              for most — starting a team, understanding swerve, winning the
              Impact Award. Free, written by an FRC student, filed by desk.
            </p>
          </div>

          {/* running-count ticker */}
          <div className="aq-rise aq-rise-4 shrink-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
              <span className="aq-pulse inline-block h-2 w-2 rounded-full bg-primary" />
              <b className="font-semibold text-foreground">
                <AnimatedCounter value={articles.length} />
              </b>{" "}
              guides in print
            </span>
          </div>
        </div>

        {/* editorial stat rule */}
        <div className="aq-rise aq-rise-5 mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60 sm:grid-cols-4">
          {[
            { n: articles.length, suffix: "", l: "Guides published" },
            { n: totalMins, suffix: " min", l: "Total reading" },
            { n: deskCount, suffix: "", l: "Editorial desks" },
            { n: 100, suffix: "%", l: "Free, always" },
          ].map((s) => (
            <div key={s.l} className="bg-card/80 px-5 py-4 text-center backdrop-blur">
              <div className="aq-display text-2xl font-extrabold leading-none text-primary sm:text-3xl">
                <AnimatedCounter value={s.n} suffix={s.suffix} />
              </div>
              <div className="mt-1.5 text-[13px] text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================= THE FULL LIBRARY ======================== */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="aq-eyebrow">Every guide, newest first</span>
              <h2 className="aq-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                The full library
              </h2>
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <AnimatedCounter value={articles.length} /> guides
            </span>
          </div>
        </Reveal>

        <Stagger className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => {
            const desk = deskFor(a);
            return (
              <StaggerItem key={a.slug} className="h-full">
                <Link
                  href={`/blog/${a.slug}`}
                  className="aq-card aq-card-hover aq-reveal group flex h-full flex-col p-6"
                  style={{ animationDelay: `${Math.min(i * 60, 360)}ms` } as CSSProperties}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="aq-badge aq-badge-bob flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ "--a": desk.color } as CSSProperties}
                    >
                      <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span
                      className="aq-chip"
                      style={{ "--a": desk.color } as CSSProperties}
                    >
                      {desk.label}
                    </span>
                  </div>
                  <h3 className="aq-display mt-4 text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                    {a.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {a.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                      {a.readMins} min · {fmtDate(a.date)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      Read
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>
    </div>
  );
}
