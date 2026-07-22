"use client";

import * as React from "react";
import { SourcePie } from "@/components/admin/source-pie";
import { cn } from "@/lib/utils";

type Range = "7d" | "all";
type Metric = "users" | "visitors";
type Series = { name: string; count: number }[];

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
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* Metric toggle */}
        <div className="ac-chip inline-flex items-center gap-1 p-1 text-sm">
          {(
            [
              ["visitors", "Unique visitors"],
              ["users", "Users"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              aria-pressed={metric === key}
              className={cn(
                "min-h-11 cursor-pointer rounded-full px-4 py-1.5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
        <div className="ac-chip inline-flex items-center gap-1 p-1 text-sm">
          {(
            [
              ["7d", "7 days"],
              ["all", "All-time"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={cn(
                "min-h-11 cursor-pointer rounded-full px-4 py-1.5 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
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
        <p className="py-10 text-center text-sm text-muted-foreground">
          {range === "7d"
            ? `No ${noun} in the last 7 days yet.`
            : `No ${noun} attributed yet.`}
          {metric === "visitors" && (
            <span className="mt-1 block text-xs">
              Visitor sources are captured from now on — earlier views predate it.
            </span>
          )}
        </p>
      ) : (
        <SourcePie data={data} />
      )}
    </div>
  );
}
