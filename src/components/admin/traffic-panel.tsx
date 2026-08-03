"use client";

import { Globe } from "lucide-react";

import { AnimatedCounter } from "@/components/animated-counter";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";

function prettyPath(path: string) {
  if (path === "/") return "home";
  return path.replace(/^\//, "");
}

/** Individual lesson pages (3 path segments under /guides) are ranked in the
    Engagement panel by completions — excluding them here keeps the same lesson
    from showing up in two lists. */
function isLessonPath(path: string) {
  return /^\/guides\/[^/]+\/[^/]+\/[^/]+/.test(path);
}

/** Headline traffic stats (visitors, page views) live in the KPI strip — this
    panel is only the top-pages ranking, so nothing is shown twice. */
export function TrafficPanel({
  s,
}: {
  s: {
    topPages: { path: string; views: number; views7d: number }[];
  };
}) {
  const rows = s.topPages.filter((p) => !isLessonPath(p.path)).slice(0, 6);
  const maxViews = Math.max(1, ...rows.map((p) => p.views));

  return (
    <section className="ac-card p-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          <Globe className="h-4 w-4 self-center text-primary" />
          Top pages
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          All-time views
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-1.5 text-[13px] text-muted-foreground">No page views yet.</p>
      ) : (
        <RevealGroup className="flex flex-col" stagger={0.04}>
          {rows.map((p, i) => {
            const label = prettyPath(p.path);
            const pct = Math.max(2, Math.round((p.views / maxViews) * 100));
            return (
              <RevealItem key={p.path + i}>
                <Hover lift={-1}>
                  <div className="flex items-center gap-2 rounded-lg py-1.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold tabular-nums text-muted-foreground"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate font-sans text-[13px] font-medium text-foreground"
                        title={p.path}
                      >
                        {label}
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: pct + "%",
                            background:
                              "linear-gradient(90deg,var(--accent),var(--primary))",
                            transition: "width 900ms cubic-bezier(0.22,1,0.36,1)",
                          }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-primary">
                      <AnimatedCounter value={p.views} />
                    </span>
                  </div>
                </Hover>
              </RevealItem>
            );
          })}
        </RevealGroup>
      )}
    </section>
  );
}
