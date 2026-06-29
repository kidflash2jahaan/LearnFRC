import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { ARTICLES } from "@/lib/blog-data";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { StatusPill, TypeLine } from "@/components/motion/terminal";

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
  return (
    <div className="mx-auto max-w-5xl px-4 pt-28 pb-20 sm:px-6 lg:px-8">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            // ~/learnfrc/articles
          </span>
          <StatusPill tone="primary">{articles.length} entries</StatusPill>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          FRC guides <span className="text-gradient">&amp; articles</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          In-depth, practical guides to the parts of FRC people search for most —
          starting a team, understanding swerve, and winning the Impact Award.
        </p>
        <TypeLine
          className="mt-5 block text-xs text-muted-foreground sm:text-sm"
          prompt="~/learnfrc $"
          text="ls articles/ --sort=recent"
        />
      </Reveal>

      <Stagger className="mt-10 grid gap-5 sm:grid-cols-2">
        {articles.map((a, i) => (
          <StaggerItem key={a.slug} className="h-full">
            <Link
              href={`/blog/${a.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                <span className="text-primary/80">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate pl-3">{a.slug}.md</span>
              </div>
              <h2 className="mt-4 font-display text-lg font-bold tracking-tight transition-colors group-hover:text-primary">
                {a.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {a.description}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 font-mono text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {a.readMins} min · {fmtDate(a.date)}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  read
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
