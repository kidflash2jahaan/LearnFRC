"use client";

import * as React from "react";
import { SourcePie } from "@/components/admin/source-pie";
import { cn } from "@/lib/utils";

type Range = "7d" | "all";
type Metric = "users" | "visitors";
type Series = { name: string; count: number }[];

const PILL =
  "cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * "Where they come from" — toggle between signed-up USERS and all UNIQUE
 * VISITORS, each with a Last-7-days / All-time range.
 */
export function SourceBreakdown({
  userWeek,
  userAllTime,
  visitorWeek,
  visitorAllTime,
}: {
  userWeek: Series;
  userAllTime: Series;
  visitorWeek: Series;
  visitorAllTime: Series;
}) {
  const [metric, setMetric] = React.useState<Metric>("visitors");
  const [range, setRange] = React.useState<Range>("7d");

  const data =
    metric === "users"
      ? range === "7d"
        ? userWeek
        : userAllTime
      : range === "7d"
        ? visitorWeek
        : visitorAllTime;
  const total = data.reduce((s, d) => s + d.count, 0);

  const noun = metric === "users" ? "signups" : "visitors";

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        {/* Metric toggle */}
        <div className="ac-chip inline-flex items-center gap-0.5 p-0.5" role="group" aria-label="Metric">
          {(
            [
              ["visitors", "Visitors"],
              ["users", "Users"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              aria-pressed={metric === key}
              className={cn(
                PILL,
                metric === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Range toggle */}
        <div className="ac-chip inline-flex items-center gap-0.5 p-0.5" role="group" aria-label="Range">
          {(
            [
              ["7d", "7d"],
              ["all", "All-time"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={cn(
                PILL,
                range === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted-foreground">
          {range === "7d"
            ? `No ${noun} in the last 7 days yet.`
            : `No ${noun} attributed yet.`}
        </p>
      ) : (
        <SourcePie data={data} />
      )}
    </div>
  );
}
