"use client";

import * as React from "react";
import { SourcePie } from "@/components/admin/source-pie";
import { cn } from "@/lib/utils";

type Range = "7d" | "all";

/** "Where users come from" with a Last-7-days / All-time toggle. */
export function SourceBreakdown({
  week,
  allTime,
}: {
  week: { name: string; count: number }[];
  allTime: { name: string; count: number }[];
}) {
  const [range, setRange] = React.useState<Range>("7d");
  const data = range === "7d" ? week : allTime;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <div className="mb-5 inline-flex rounded-2xl border border-border bg-card p-1 text-sm">
        {(
          [
            ["7d", "Last 7 days"],
            ["all", "All-time"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            aria-pressed={range === key}
            className={cn(
              "cursor-pointer rounded-xl px-4 py-1.5 font-medium transition-colors",
              range === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {range === "7d"
            ? "No signups in the last 7 days yet."
            : "No signups yet."}
        </p>
      ) : (
        <SourcePie data={data} />
      )}
    </div>
  );
}
