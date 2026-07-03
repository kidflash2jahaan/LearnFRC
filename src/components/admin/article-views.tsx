"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/animated-counter";
import { useStaticMotion } from "@/components/perf-mode";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export type ArticleViewRow = { slug: string; title: string; views: number };

/**
 * Blog-article view analytics for the admin panel: a combined total (with a
 * trailing-7-day figure) plus a collapsible per-article breakdown, sorted most
 * read first and including zero-view articles.
 *
 * The breakdown only mounts after a click, so it never participates in
 * hydration; the reveal keeps a constant tree and only varies its transition
 * for reduced motion.
 */
export function ArticleViews({
  total,
  last7d,
  articles,
}: {
  total: number;
  last7d: number;
  articles: ArticleViewRow[];
}) {
  const [open, setOpen] = React.useState(false);
  const stat = useStaticMotion();
  const max = Math.max(1, ...articles.map((a) => a.views));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <div>
          <div className="font-display text-4xl font-bold tracking-tight text-foreground">
            <AnimatedCounter value={total} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">all-time reads</p>
        </div>
        <div>
          <div className="font-display text-2xl font-bold tracking-tight text-primary">
            <AnimatedCounter value={last7d} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">last 7 days</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="article-views-panel"
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {open ? "Hide" : "View"} per-article breakdown
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <motion.div
          id="article-views-panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={stat ? { duration: 0 } : { duration: 0.32, ease: EASE }}
        >
          {articles.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No articles yet.</p>
          ) : (
            <ul className="mt-4 max-h-[32rem] divide-y divide-border overflow-auto">
              {articles.map((a) => (
                <li
                  key={a.slug}
                  className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-primary/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {a.title}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={
                          {
                            width: `${Math.round((a.views / max) * 100)}%`,
                            background:
                              "linear-gradient(90deg, var(--accent), var(--primary))",
                          } as CSSProperties
                        }
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="text-sm font-bold text-primary">
                      {a.views.toLocaleString()}
                    </span>
                    <span className="ml-1 text-[10px] font-medium uppercase text-muted-foreground">
                      views
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}
