"use client";

import * as React from "react";
import { SourceChart } from "@/components/admin/source-pie";

type Range = "7d" | "all";
type Metric = "users" | "visitors";
type Series = { name: string; count: number }[];

/**
 * A strip of `.nb-tab`s. The selected one is a solid blue rule and bold ink,
 * the rest are a dashed hairline, so the state reads with the colour taken
 * away. `aria-pressed` rather than `role="tab"`: these are buttons that swap
 * the figures below, and claiming tab semantics would promise arrow-key
 * navigation that is not implemented.
 */
function Strip<T extends string>({
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
    <div className="flex items-center gap-4" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          data-active={value === key || undefined}
          className="nb-tab"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * "Where they come from": signed-up USERS or all UNIQUE VISITORS, over the last
 * seven days or everything on record.
 *
 * The two halves do not cover the same span and the note under this control
 * says so. Users come from `profiles.source`, i.e. every signup ever; visitors
 * are measured arrivals inside the rolling window Vercel keeps.
 *
 * THE AUTHORITATIVE TOTAL MUST MATCH THE SELECTED WINDOW. Visitor rows overlap
 * (one person arriving direct on Monday and from Google on Friday is counted
 * under both), so summing them is not a headcount — that is the bug that once
 * printed 10,637 against a real 8,937. The fix is to hand the chart a measured
 * total instead of a sum, and it is only a fix while the total covers the same
 * days as the rows: handing the all-time figure to a seven-day breakdown swaps
 * a 19% overcount for a far larger one. So there is one total per range.
 */
export function SourceBreakdown({
  userWeek,
  userAllTime,
  visitorWeek,
  visitorAllTime,
  visitorTotal,
  visitorWeekTotal,
}: {
  userWeek: Series;
  userAllTime: Series;
  visitorWeek: Series;
  visitorAllTime: Series;
  /** Measured unique visitors over the all-time window. Never a row sum. */
  visitorTotal?: number;
  /** Measured unique visitors over the last 7 days. Never a row sum. */
  visitorWeekTotal?: number;
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
  // Signups carry exactly one source each, so their rows DO sum to a headcount
  // and the chart is left to add them up. Visitors get the measured total for
  // whichever window is showing, and none at all if that query did not answer,
  // which makes the chart fall back to the row sum with its own caveat rather
  // than print a zero.
  const authoritativeTotal =
    metric === "users"
      ? undefined
      : range === "7d"
        ? visitorWeekTotal
        : visitorTotal;

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center gap-x-7 gap-y-1 border-b border-dashed border-rule">
        <Strip<Metric>
          label="Count"
          value={metric}
          onChange={setMetric}
          options={
            [
              ["visitors", "Visitors"],
              ["users", "Users"],
            ] as const
          }
        />
        <Strip<Range>
          label="Window"
          value={range}
          onChange={setRange}
          options={
            [
              ["7d", "Last 7 days"],
              ["all", "All-time"],
            ] as const
          }
        />
      </div>

      {total === 0 ? (
        <p className="nb-slug py-6">
          {range === "7d"
            ? `Nothing recorded in the last 7 days. No ${noun} attributed yet in that window.`
            : `No ${noun} attributed to a source yet.`}
        </p>
      ) : (
        <SourceChart
          data={data}
          noun={noun}
          authoritativeTotal={authoritativeTotal}
        />
      )}
    </div>
  );
}
