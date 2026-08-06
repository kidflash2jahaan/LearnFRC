"use client";

import * as React from "react";
import { SourcePie } from "@/components/admin/source-pie";
import { cn } from "@/lib/utils";

type Range = "7d" | "all";
type Metric = "users" | "visitors";
type Series = { name: string; count: number }[];

/** Segmented-control pill. Layout is Tailwind-only; ac-chip is skin on the group. */
const PILL =
  "inline-flex min-h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] leading-none transition-colors duration-200 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Selected reads as selected via weight + fill + ring — never colour alone. */
const PILL_ON = "bg-primary/15 font-semibold text-primary ring-1 ring-primary/25";
const PILL_OFF =
  "font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground";

const GROUP = "ac-chip inline-flex shrink-0 items-center gap-1 p-1";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (next: T) => void;
}) {
  return (
    <div className={GROUP} role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(PILL, value === key ? PILL_ON : PILL_OFF)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

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
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<Metric>
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={
            [
              ["visitors", "Visitors"],
              ["users", "Users"],
            ] as const
          }
        />
        <Segmented<Range>
          label="Range"
          value={range}
          onChange={setRange}
          options={
            [
              ["7d", "7d"],
              ["all", "All-time"],
            ] as const
          }
        />
      </div>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
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
