"use client";

import type { CSSProperties } from "react";
import { BookOpenCheck, Layers } from "lucide-react";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";

type RankedRow = {
  key: string;
  label: string;
  completions: number;
};

function RankedBarList({
  rows,
  accentHex,
}: {
  rows: RankedRow[];
  accentHex: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
        No data yet.
      </div>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.completions));

  return (
    <RevealGroup className="flex flex-col gap-3.5" stagger={0.05}>
      {rows.map((row) => {
        const pct = Math.max(2, Math.round((row.completions / max) * 100));
        return (
          <RevealItem key={row.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
                title={row.label}
              >
                {row.label}
              </span>
              <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-primary">
                <AnimatedCounter value={row.completions} />
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              style={{ "--accent": accentHex } as CSSProperties}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: pct + "%",
                  background:
                    "linear-gradient(90deg,var(--accent),var(--primary))",
                }}
              />
            </div>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}

export function EngagementPanel({
  topLessons,
  topDepartments,
}: {
  topLessons: { slug: string; title: string; completions: number }[];
  topDepartments: { name: string; completions: number }[];
}) {
  const lessonRows: RankedRow[] = topLessons.map((l) => ({
    key: l.slug,
    label: l.title,
    completions: l.completions,
  }));
  const departmentRows: RankedRow[] = topDepartments.map((d) => ({
    key: d.name,
    label: d.name,
    completions: d.completions,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Hover lift={-4}>
        <section
          className={cn("ac-card p-5 sm:p-6")}
          style={{ "--a": "#2560e6" } as CSSProperties}
        >
          <header className="mb-4 flex items-center gap-3">
            <span
              className="ac-badge flex h-10 w-10 items-center justify-center"
              style={{ "--a": "#2560e6" } as CSSProperties}
            >
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Engagement
              </p>
              <h3 className="font-display text-base font-semibold text-foreground">
                Most-completed lessons
              </h3>
            </div>
          </header>
          <RankedBarList rows={lessonRows} accentHex="#2560e6" />
        </section>
      </Hover>

      <Hover lift={-4}>
        <section
          className={cn("ac-card p-5 sm:p-6")}
          style={{ "--a": "#1aa9d6" } as CSSProperties}
        >
          <header className="mb-4 flex items-center gap-3">
            <span
              className="ac-badge flex h-10 w-10 items-center justify-center"
              style={{ "--a": "#1aa9d6" } as CSSProperties}
            >
              <Layers className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Engagement
              </p>
              <h3 className="font-display text-base font-semibold text-foreground">
                Top departments
              </h3>
            </div>
          </header>
          <RankedBarList rows={departmentRows} accentHex="#1aa9d6" />
        </section>
      </Hover>
    </div>
  );
}
