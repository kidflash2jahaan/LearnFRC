"use client";

import type { CSSProperties } from "react";
import { BookOpenCheck, Layers } from "lucide-react";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";

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
      <div className="rounded-lg bg-muted px-3 py-3 text-center text-[11px] text-muted-foreground">
        No data yet.
      </div>
    );
  }

  const max = Math.max(1, ...rows.map((r) => r.completions));

  return (
    <RevealGroup className="flex flex-col" stagger={0.04}>
      {rows.map((row) => {
        const pct = Math.max(2, Math.round((row.completions / max) * 100));
        return (
          <RevealItem key={row.key} className="flex flex-col gap-1 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
                title={row.label}
              >
                {row.label}
              </span>
              <span className="shrink-0 font-display text-[13px] font-semibold tabular-nums text-primary">
                <AnimatedCounter value={row.completions} />
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
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
  const lessonRows: RankedRow[] = topLessons.slice(0, 6).map((l) => ({
    key: l.slug,
    label: l.title,
    completions: l.completions,
  }));
  const departmentRows: RankedRow[] = topDepartments.slice(0, 6).map((d) => ({
    key: d.name,
    label: d.name,
    completions: d.completions,
  }));

  return (
    <Hover lift={-4}>
      <section className="ac-card p-4" style={{ "--a": "#2560e6" } as CSSProperties}>
        <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
          <BookOpenCheck className="h-4 w-4 text-primary" aria-hidden />
          Engagement
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpenCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Most-completed lessons
            </div>
            <RankedBarList rows={lessonRows} accentHex="#2560e6" />
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Top departments
            </div>
            <RankedBarList rows={departmentRows} accentHex="#1aa9d6" />
          </div>
        </div>
      </section>
    </Hover>
  );
}
