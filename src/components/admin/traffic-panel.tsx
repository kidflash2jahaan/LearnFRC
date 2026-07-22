"use client";

import type { CSSProperties } from "react";
import { Globe, Users, CalendarClock } from "lucide-react";

import { AnimatedCounter } from "@/components/animated-counter";
import { Reveal, RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

const PRIMARY = "#2560e6";
const ACCENT = "#1aa9d6";

const gradientText: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

function prettyPath(path: string) {
  if (path === "/") return "home";
  return path.replace(/^\//, "");
}

export function TrafficPanel({
  s,
}: {
  s: {
    pageViewsTotal: number;
    pageViews7d: number;
    pageViews30d: number;
    uniqueVisitors: number;
    uniqueVisitors30d: number;
    topPages: { path: string; views: number; views7d: number }[];
  };
}) {
  const maxViews = Math.max(1, ...s.topPages.map((p) => p.views));

  return (
    <section className="ac-card p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="ac-badge flex h-10 w-10 items-center justify-center"
          style={{ "--a": PRIMARY } as CSSProperties}
        >
          <Globe className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">Traffic</h2>
      </div>

      {/* (a) Headline row */}
      <Reveal>
        <div className="mt-5 grid gap-4 sm:grid-cols-5 sm:items-stretch">
          {/* Big total */}
          <div className="sm:col-span-2">
            <div
              className="font-display text-4xl font-extrabold tabular-nums leading-none"
              style={gradientText}
            >
              <AnimatedCounter value={s.pageViewsTotal} />
            </div>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              total page views
            </p>
          </div>

          {/* Two stat tiles */}
          <div className="grid grid-cols-1 gap-3 sm:col-span-3 sm:grid-cols-2">
            <div
              className="ac-tile flex items-center gap-3 rounded-xl p-3.5"
              style={{ "--a": PRIMARY } as CSSProperties}
            >
              <div
                className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
                style={{ "--a": PRIMARY } as CSSProperties}
              >
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-xl font-bold tabular-nums text-foreground">
                  <AnimatedCounter value={s.uniqueVisitors} />
                </div>
                <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Unique visitors
                </p>
              </div>
            </div>

            <div
              className="ac-tile flex items-center gap-3 rounded-xl p-3.5"
              style={{ "--a": ACCENT } as CSSProperties}
            >
              <div
                className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
                style={{ "--a": ACCENT } as CSSProperties}
              >
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-base font-bold tabular-nums text-foreground">
                  <AnimatedCounter value={s.pageViews7d} />{" "}
                  <span className="text-xs font-semibold text-muted-foreground">in 7d</span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                  <AnimatedCounter value={s.pageViews30d} /> in 30d
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="ac-divider my-4" />

      {/* (b) Top pages */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="ac-eyebrow text-muted-foreground">Top pages</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Views
        </span>
      </div>

      {s.topPages.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No page views yet.</p>
      ) : (
        <RevealGroup className="mt-3 flex flex-col gap-2.5" stagger={0.05}>
          {s.topPages.map((p, i) => {
            const label = prettyPath(p.path);
            const pct = Math.max(2, Math.round((p.views / maxViews) * 100));
            return (
              <RevealItem key={p.path + i}>
                <Hover lift={-2}>
                  <div className="ac-card flex items-center gap-3 rounded-xl px-3.5 py-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold tabular-nums text-muted-foreground"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate font-sans text-sm font-medium text-foreground"
                        title={p.path}
                      >
                        {label}
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full")}
                          style={{
                            width: pct + "%",
                            background:
                              "linear-gradient(90deg,var(--accent),var(--primary))",
                            transition: "width 900ms cubic-bezier(0.22,1,0.36,1)",
                          }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-primary">
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
