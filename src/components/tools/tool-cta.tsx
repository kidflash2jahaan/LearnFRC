import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Wrench } from "lucide-react";

const GRADIENT_TEXT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export type RelatedLink = { href: string; label: string };

/**
 * Shared footer for every /tools page: a strong "create a free account" CTA
 * (the tools are the top of the funnel for search visitors) plus keyword-rich
 * internal links to related lessons/articles/tools — both convert tool users
 * into learners and feed internal-link equity for SEO.
 */
export function ToolCTA({ related }: { related: RelatedLink[] }) {
  return (
    <section className="mt-14">
      <div
        className="ac-glass relative overflow-hidden p-8 text-center sm:px-14 sm:py-10"
        style={{ "--a": "#2560e6" } as CSSProperties}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(26,169,214,0.22),transparent_70%)] blur-2xl"
        />
        <span className="ac-badge mx-auto mb-4 flex h-11 w-11 items-center justify-center">
          <Wrench aria-hidden className="h-5 w-5" />
        </span>
        <h2 className="text-balance font-display text-2xl font-bold tracking-tight sm:text-3xl">
          This tool is free — so is the rest of{" "}
          <span style={GRADIENT_TEXT}>LearnFRC</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-foreground/70">
          394 lessons across all 11 departments, plus every tool here. Create a
          free account to save your work, export it, and track your progress.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="ac-btn text-sm">
            Create your free account{" "}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <Link href="/guides" className="ac-btn-ghost text-sm">
            Browse the guides
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-8">
          <p className="ac-eyebrow flex items-center gap-1.5">
            <BookOpen aria-hidden className="h-3.5 w-3.5" /> Keep learning
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="ac-card group flex items-center justify-between gap-2 rounded-2xl p-4 text-sm font-semibold transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {r.label}
                <ArrowRight
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
