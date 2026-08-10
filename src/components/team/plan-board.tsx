import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Compass, Flag, MapPin } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { Progress } from "@/components/ui/progress";
import { deptMeta, deptInk } from "@/lib/departments";
import { clampPct, pluralize } from "@/lib/utils";

/**
 * The active training plan, rendered as a route.
 *
 * WHY IT LOOKS LIKE /paths. A plan IS a learning path — the lead picked one of
 * the five curated routes (or a small hand-picked mix) and put it up for the
 * team. Borrowing the /paths spine vocabulary means a member who has seen the
 * public paths page already knows what they are looking at, and it keeps this
 * from reading as a second, parallel "assignments" concept.
 *
 * WHY THE DISCLAIMER IS NOT SMALL PRINT. Everything else on this card looks
 * like homework: a list someone else chose, in order, with a date attached. The
 * one thing that makes it not homework is a sentence, so the sentence is at the
 * top, in body text, and it says exactly what does and does not happen. This is
 * the load-bearing copy in the whole feature. Do not shrink it, do not move it
 * below the fold, and do not soften it into "have fun with it!".
 *
 * EVERY NUMBER ON THIS CARD IS THE VIEWER'S OWN. `done`/`total` come from the
 * viewer's own lesson_progress, read under their own RLS. There is deliberately
 * NO cross-user figure here — not even an anonymous "2 of 5 have started this".
 * A per-department count over a space whose median size is a handful of people
 * resolves straight back to individuals, and a member looking at a route should
 * never be able to read it as a scoreboard they are losing.
 *
 * Server Component: no hooks, no client boundary, and the due date arrives
 * pre-formatted from the server so no locale formatting runs during hydration.
 */

export type PlanBoardDept = {
  slug: string;
  name: string;
  tagline: string | null;
  /** The curated route's own label for this stop, when there is one. */
  label: string | null;
  /** The curated route's own note explaining why this stop is on the route. */
  note: string | null;
  /** The VIEWER'S own completion here. Never anybody else's. */
  done: number;
  total: number;
};

export function PlanBoard({
  teamName,
  pathTitle,
  pathDescription,
  pathIcon,
  pathColor,
  departments,
  dueLabel,
  dueIsPast,
}: {
  teamName: string;
  /** null when the lead hand-picked departments rather than a curated route. */
  pathTitle: string | null;
  pathDescription: string | null;
  pathIcon: string | null;
  pathColor: string | null;
  departments: PlanBoardDept[];
  /** Pre-formatted on the server, e.g. "Sat, Nov 3". null when there is none. */
  dueLabel: string | null;
  dueIsPast: boolean;
}) {
  const accent = pathColor || "#2560e6";
  const totalLessons = departments.reduce((s, d) => s + d.total, 0);
  const myDone = departments.reduce((s, d) => s + d.done, 0);
  const myPct = totalLessons > 0 ? clampPct((myDone / totalLessons) * 100) : 0;
  const finished = departments.filter((d) => d.total > 0 && d.done >= d.total).length;

  return (
    <div className="ac-card overflow-hidden p-6 sm:p-8">
      {/* ── header ── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="ac-badge flex h-14 w-14 shrink-0 items-center justify-center"
            style={{ "--a": accent } as CSSProperties}
          >
            {pathIcon ? (
              <Icon name={pathIcon} className="h-7 w-7" />
            ) : (
              <Compass className="h-7 w-7" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="ac-eyebrow">Suggested by {teamName}</p>
            <h2 className="mt-1.5 text-balance font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {pathTitle ?? "A route your team picked out"}
            </h2>
            {pathDescription && (
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-foreground/70">
                {pathDescription}
              </p>
            )}
          </div>
        </div>

        {dueLabel && (
          <div
            className="ac-chip flex shrink-0 items-start gap-2 self-start px-3 py-2 text-left"
            style={{ "--a": accent } as CSSProperties}
          >
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-xs leading-snug">
              <span className="block font-semibold text-foreground">
                {dueIsPast ? "Target was" : "Team target"} · {dueLabel}
              </span>
              <span className="block text-muted-foreground">
                {dueIsPast
                  ? "It passed — the route is still here."
                  : "A date to aim at, together."}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── the sentence that makes this a suggestion ── */}
      <p className="mt-6 rounded-2xl border border-border/70 bg-muted/40 p-4 text-[15px] leading-relaxed text-foreground/75">
        <span className="font-semibold text-foreground">
          This is a suggestion, not an assignment.
        </span>{" "}
        Someone on {teamName} put this route up as a good place to start.
        Nothing is locked, nothing is graded, and nobody is told if you skip it
        — you can learn these in any order, or learn something else entirely.
        Your XP, streak and badges work exactly the same either way.
      </p>

      {/* ── your own position on the route ── */}
      <div className="mt-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            {myDone === 0
              ? "You haven't started this route yet"
              : finished === departments.length
                ? "You've finished every stop on this route"
                : `You're ${myPct}% of the way through`}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {myDone} / {totalLessons} lessons
          </span>
        </div>
        <Progress
          value={myPct}
          className="h-2.5 bg-white/55"
          barClassName="bg-[linear-gradient(90deg,var(--primary),var(--accent))]"
        />
      </div>

      {/* ── the stops ── */}
      <ol className="relative mt-7 space-y-3">
        <span
          aria-hidden
          className="absolute left-[27px] top-6 bottom-6 w-0.5 rounded-full"
          style={{
            background:
              "linear-gradient(to bottom, rgba(37,96,230,0.35), rgba(26,169,214,0.35))",
          }}
        />
        <li className="relative flex items-center gap-4">
          <span className="relative z-10 flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <MapPin className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Start
          </span>
        </li>

        {departments.map((d) => {
          const m = deptMeta(d.slug);
          const pct = d.total > 0 ? clampPct((d.done / d.total) * 100) : 0;
          const complete = d.total > 0 && d.done >= d.total;
          return (
            <li key={d.slug} className="relative">
              <Link
                href={`/guides/${d.slug}`}
                className="ac-tile group flex flex-col gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-4"
                style={{ "--a": m.color } as CSSProperties}
              >
                <span
                  className="ac-badge relative z-10 flex h-12 w-12 flex-none items-center justify-center transition-transform duration-200 group-hover:scale-105"
                  style={{ "--a": m.color } as CSSProperties}
                >
                  {complete ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                  ) : (
                    <Icon name={m.icon} className="h-5 w-5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-display text-base font-bold text-foreground">
                      {d.name}
                    </span>
                    {complete && (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: deptInk(d.slug) }}
                      >
                        done
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-foreground/70">
                    {d.label ?? d.note ?? d.tagline ?? `${pluralize(d.total, "lesson")}`}
                  </p>

                  <div className="mt-2.5 flex items-center gap-3">
                    <Progress
                      value={pct}
                      className="h-1.5 max-w-xs flex-1 bg-white/45"
                      barClassName="bg-[color-mix(in_srgb,var(--a)_78%,#141f2c)]"
                      style={{ "--a": m.color } as CSSProperties}
                    />
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground/70">
                      {d.done}/{d.total}
                    </span>
                  </div>

                </div>

                <span className="ac-btn-ghost inline-flex shrink-0 self-start text-sm sm:self-center">
                  {d.done > 0 && !complete ? "Continue" : complete ? "Revisit" : "Open"}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          );
        })}

        <li className="relative flex items-center gap-4">
          <span className="relative z-10 flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Flag className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Route complete
          </span>
        </li>
      </ol>
    </div>
  );
}
