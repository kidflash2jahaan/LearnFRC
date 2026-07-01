import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Sparkles } from "lucide-react";
import { ARTICLES } from "@/lib/blog-data";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

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

export default function BlogPage() {
  const articles = [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
  const [featured, ...rest] = articles;
  const totalMins = articles.reduce((sum, a) => sum + a.readMins, 0);

  return (
    <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-24 left-[8%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,96,230,0.20), transparent 70%)" }}
        />
        <div
          className="absolute top-40 right-[4%] h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(26,169,214,0.18), transparent 70%)" }}
        />
        <div
          className="absolute top-[46rem] left-[30%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.14), transparent 70%)" }}
        />
      </div>

      {/* Hero */}
      <header className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="aq-eyebrow aq-rise aq-rise-1">
            <BookOpen className="h-3.5 w-3.5" /> Read between build seasons
          </span>
          <h1 className="aq-display aq-rise aq-rise-2 mt-4 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            FRC guides,{" "}
            <span
              style={{
                background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              decoded for the pit
            </span>
          </h1>
          <p className="aq-rise aq-rise-3 mt-5 max-w-xl text-lg leading-relaxed text-foreground/70">
            Practical, no-fluff walkthroughs of the parts of FRC people search for
            most — starting a team, understanding swerve, and winning the Impact
            Award. Free, written by an FRC student.
          </p>
          <div className="aq-rise aq-rise-4 mt-8 flex flex-wrap items-center gap-3">
            {featured && (
              <Link href={`/blog/${featured.slug}`} className="aq-cta">
                Start with the latest
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <span className="aq-chip">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {articles.length} guides · {totalMins} min of reading
            </span>
          </div>
        </div>

        {/* Featured guide panel */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="aq-glass aq-card-hover aq-rise aq-rise-4 group block rounded-3xl p-6"
          >
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Latest guide
            </span>
            <h2 className="aq-display mt-3 text-xl font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
              {featured.title}
            </h2>
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/70">
              {featured.description}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {featured.readMins} min ·{" "}
                {fmtDate(featured.date)}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Read
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        )}
      </header>

      {/* Article grid */}
      <Reveal className="mt-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="aq-eyebrow">Every guide, sorted by newest</span>
            <h2 className="aq-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              The full library
            </h2>
          </div>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {articles.length} total
          </span>
        </div>
      </Reveal>

      <Stagger className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((a) => (
          <StaggerItem key={a.slug} className="h-full">
            <Link
              href={`/blog/${a.slug}`}
              className="aq-card aq-card-hover group flex h-full flex-col p-6"
            >
              <div className="flex items-center gap-2">
                <span className="aq-icon h-9 w-9">
                  <BookOpen className="h-4 w-4" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Guide
                </span>
              </div>
              <h3 className="aq-display mt-4 text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                {a.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">
                {a.description}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {a.readMins} min ·{" "}
                  {fmtDate(a.date)}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Read
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
