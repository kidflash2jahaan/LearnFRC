import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock,
  LayoutGrid,
  Newspaper,
  Sparkles,
} from "lucide-react";
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
import { DeskIndex, type DeskCount } from "./_desk-index";

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
 * Derive an editorial "desk" (topic) for an article from its slug/keywords.
 * Purely presentational grouping — no data is invented or dropped.
 */
const DESKS: { label: string; color: string; icon: string; test: RegExp }[] = [
  { label: "Getting Started", color: "#2560e6", icon: "Rocket", test: /start|what-is|beginner|join/i },
  { label: "Drivetrain", color: "#1aa9d6", icon: "Gauge", test: /swerve|drivetrain|gear|mecanum|tank/i },
  { label: "Programming", color: "#7c5cff", icon: "Code2", test: /program|wpilib|code|software/i },
  { label: "Electrical", color: "#e0803a", icon: "Zap", test: /wire|electrical|power|can-bus/i },
  { label: "CAD & Design", color: "#12b565", icon: "PenTool", test: /cad|design|onshape|solidworks/i },
  { label: "Scouting", color: "#d64b8a", icon: "LineChart", test: /scout|picklist|strategy|opr|epa/i },
  { label: "Awards & Business", color: "#c9a227", icon: "Trophy", test: /impact|award|sponsor|fund|business/i },
];
const FALLBACK_DESK = { label: "Field Notes", color: "#4d5b78", icon: "BookOpen" };

function deskFor(a: Article) {
  const hay = `${a.slug} ${a.keywords.join(" ")}`;
  return DESKS.find((d) => d.test.test(hay)) ?? FALLBACK_DESK;
}

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

  return (
    <div className="relative overflow-x-clip">
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
              FRC guides,{" "}
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
                guides in print
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

      {/* ========================= THE FULL LIBRARY ======================== */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ac-eyebrow">Every guide, newest first</p>
              <h2 className="mt-2 text-balance font-display text-3xl font-bold sm:text-4xl">
                The full library
              </h2>
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              <AnimatedCounter value={articles.length} /> guides
            </span>
          </div>
        </Reveal>

        <RevealGroup className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => {
            const desk = deskFor(a);
            return (
              <RevealItem key={a.slug} className="h-full">
                <Hover className="h-full" lift={-5}>
                  <Link
                    href={`/blog/${a.slug}`}
                    className="ac-card group flex h-full flex-col p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="ac-badge flex h-9 w-9 items-center justify-center"
                        style={{ "--a": desk.color } as CSSProperties}
                      >
                        <BookOpen className="h-[18px] w-[18px]" aria-hidden />
                      </span>
                      <span className="ac-chip inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/70">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: desk.color }}
                        />
                        {desk.label}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                      {a.title}
                    </h3>
                    <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted-foreground">
                      {a.description}
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {a.readMins} min · {fmtDate(a.date)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                        Read
                        <ArrowUpRight
                          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </Link>
                </Hover>
              </RevealItem>
            );
          })}
        </RevealGroup>
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
              <span style={BRAND_GRADIENT}>guide.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Join the list for new FRC guides as they&apos;re published — no spam,
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
