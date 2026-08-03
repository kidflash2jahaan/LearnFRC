"use client";

import { Globe } from "lucide-react";

import { AnimatedCounter } from "@/components/animated-counter";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";

function prettyPath(path: string) {
  if (path === "/") return "home";
  return path.replace(/^\//, "");
}

/** Top pages ranking only — headline traffic numbers live in the KPI strip. */
export function TrafficPanel({
  s,
}: {
  s: {
    topPages: { path: string; views: number; views7d: number }[];
  };
}) {
  const rows = s.topPages.slice(0, 8);
  const maxViews = Math.max(1, ...rows.map((p) => p.views));

  return (
    <section className="ac-card h-full p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <Globe className="h-4 w-4 self-center text-primary" />
          Top pages
        </h2>
        <span className="text-xs text-muted-foreground">all-time views</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No page views yet.</p>
      ) : (
        <RevealGroup className="flex flex-col" stagger={0.04}>
          {rows.map((p, i) => {
            const label = prettyPath(p.path);
            const pct = Math.max(2, Math.round((p.views / maxViews) * 100));
            return (
              <RevealItem key={p.path + i}>
                <Hover lift={-1}>
                  <div className="flex items-center gap-3 rounded-lg py-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold tabular-nums text-muted-foreground"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-sm font-medium text-foreground"
                        title={p.path}
                      >
                        {label}
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
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
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-primary">
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
