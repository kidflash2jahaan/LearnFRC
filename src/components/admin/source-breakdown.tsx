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
 * The two halves do not cover the same span and the page says so in the note
 * under this control. Users come from `profiles.source`, i.e. every signup
 * ever; visitors come from first-touch pageviews, which only carry a visitor id
 * from the day the beacon started sending one.
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
        <SourceChart data={data} noun={noun} />
      )}
    </div>
  );
}
