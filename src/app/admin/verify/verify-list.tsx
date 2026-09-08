"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLessonVerified } from "./actions";

export type VerifyRow = {
  id: string;
  slug: string;
  title: string;
  dept: string;
  deptName: string;
  verifiedAt: string | null;
};

/**
 * The tick list.
 *
 * Optimistic on purpose: with 394 rows the useful motion is ticking several in
 * a row while reading, and a checkbox that waits on a round trip before moving
 * breaks that rhythm. A failed write reverts the box and surfaces the reason
 * rather than leaving a tick that never saved.
 */
export function VerifyList({ rows }: { rows: VerifyRow[] }) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [only, setOnly] = useState<"all" | "todo" | "done">("all");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [state, apply] = useOptimistic(
    rows,
    (current: VerifyRow[], change: { id: string; verified: boolean }) =>
      current.map((r) =>
        r.id === change.id
          ? { ...r, verifiedAt: change.verified ? new Date().toISOString() : null }
          : r
      )
  );

  const depts = Array.from(new Set(rows.map((r) => r.dept))).sort();
  const q = query.trim().toLowerCase();
  const visible = state.filter((r) => {
    if (dept !== "all" && r.dept !== dept) return false;
    if (only === "todo" && r.verifiedAt) return false;
    if (only === "done" && !r.verifiedAt) return false;
    if (q && !r.title.toLowerCase().includes(q) && !r.slug.includes(q)) return false;
    return true;
  });

  const done = state.filter((r) => r.verifiedAt).length;

  function toggle(row: VerifyRow, next: boolean) {
    setError(null);
    startTransition(async () => {
      apply({ id: row.id, verified: next });
      const res = await setLessonVerified(row.id, next);
      if (!res.ok) setError(`Could not save "${row.title}": ${res.error}`);
    });
  }

  return (
    <div className="mt-[clamp(1.4rem,3vw,2rem)]">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <b className="font-mono text-[clamp(1.6rem,1.2rem+1.4vw,2.2rem)] leading-none tabular-nums text-[var(--blue)]">
          {done}
        </b>
        <span className="nb-slug">of {state.length} lessons verified</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className="nb-input min-w-[16rem] flex-1"
          placeholder="Search a lesson"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search lessons"
        />
        <select
          className="nb-input"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">every department</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="nb-input"
          value={only}
          onChange={(e) => setOnly(e.target.value as "all" | "todo" | "done")}
          aria-label="Filter by state"
        >
          <option value="all">all</option>
          <option value="todo">not verified</option>
          <option value="done">verified</option>
        </select>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.9rem] text-[var(--blue)]">
          {error}
        </p>
      ) : null}

      <p className="nb-slug mt-4 text-[var(--graphite)]">
        showing {visible.length}
      </p>

      <ul className="mt-2">
        {visible.map((r) => (
          <li key={r.id} className="nb-hair">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-[var(--blue)]"
                checked={Boolean(r.verifiedAt)}
                onChange={(e) => toggle(r, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.title}</span>
                <span className="nb-slug block text-[var(--graphite)]">
                  {r.deptName}
                  {r.verifiedAt
                    ? ` / verified ${new Date(r.verifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`
                    : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="mt-4 text-[var(--graphite)]">Nothing matches that.</p>
      ) : null}
    </div>
  );
}
