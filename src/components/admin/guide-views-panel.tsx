"use client";

import type { CSSProperties } from "react";
import { BookOpen } from "lucide-react";

import { AnimatedCounter } from "@/components/animated-counter";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/primitives";
import { deptMeta, inkFor } from "@/lib/departments";

const gradientText: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export type GuideViewRow = {
  slug: string;
  name: string;
  /** Distinct people who viewed this guide (dept page + its lessons). */
  viewers: number;
  views: number;
  views7d: number;
};

/**
 * Per-guide audience panel: how many PEOPLE opened each guide (department
 * page + every lesson inside it — so lesson completers are included), with
 * raw view totals as the supporting small text.
 */
export function GuideViewsPanel({
  guides,
  viewersTotal,
  viewsTotal,
}: {
  guides: GuideViewRow[];
  viewersTotal: number;
  viewsTotal: number;
}) {
  const maxViewers = Math.max(1, ...guides.map((g) => g.viewers));
  const views7d = guides.reduce((s, g) => s + g.views7d, 0);

  return (
    <section className="ac-card p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="ac-badge flex h-10 w-10 items-center justify-center"
          style={{ "--a": "#1aa9d6" } as CSSProperties}
        >
          <BookOpen className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">Guide views</h2>
      </div>

      {/* Headline: people, with raw views as the supporting caption */}
      <Reveal>
        <div className="mt-5">
          <div
            className="font-display text-4xl font-extrabold tabular-nums leading-none"
            style={gradientText}
          >
            <AnimatedCounter value={viewersTotal} />
          </div>
          <div className="mt-1.5 text-sm font-medium text-foreground/80">
            people have opened a guide
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            {viewsTotal.toLocaleString()} total guide views ·{" "}
            {views7d.toLocaleString()} in the last 7 days
          </div>
        </div>
      </Reveal>

      {/* Per-guide audience */}
      <RevealGroup className="mt-6 space-y-4" stagger={0.05}>
        {guides.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No guide views recorded yet — they collect as readers browse.
          </p>
        )}
        {guides.map((g) => {
          const color = deptMeta(g.slug).color;
          return (
            <RevealItem key={g.slug}>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {g.name}
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="font-bold" style={{ color: inkFor(color) }}>
                    {g.viewers.toLocaleString()}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {g.viewers === 1 ? "person" : "people"}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {g.views.toLocaleString()} views
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, Math.round((g.viewers / maxViewers) * 100))}%`,
                    background: `linear-gradient(90deg, ${color}, #1aa9d6)`,
                  }}
                />
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}
