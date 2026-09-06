import Link from "next/link";
import { describeRhythm, type Rhythm } from "@/lib/streaks";
import { cn } from "@/lib/utils";
import { DayStrip } from "./day-strip";
import { WeekRing } from "./week-ring";

/**
 * THE week-one retention surface: five lessons, one week, one next action.
 *
 * WHY THIS SHAPE (all measured on this database, see src/lib/streaks.ts for the
 * full note):
 *   - 5 lessons in the first 7 days is the only milestone that predicts
 *     survival (21.4% vs 3.7% still active on d8-28, p = 5.2e-5). 1-4 lessons
 *     predicts nothing over 0, which is why this keeps pointing at five instead
 *     of congratulating a learner into a dead end at lesson one.
 *   - It replaces a choice with an action. A zero-progress learner otherwise
 *     meets six counters reading 0, eleven department cards at 0% and eleven
 *     locked badges before anything tells them what to do. This shows one shape
 *     to fill and one link to press.
 *
 * WHAT IT WILL NOT DO: no countdown, no "expires tonight", no streak-loss
 * warning, no guilt for a gap. The one urgency-adjacent fact it states, that
 * five in a week is where retention jumps, is true, is said once, and is framed
 * as information rather than as a threat. Coming back after two weeks away
 * produces a welcome, not a scolding.
 *
 * ZERO STATE is deliberately the nicest branch. `phase` is "new" when nothing
 * has ever been completed: the count reads 0/5 with an empty trough, the strip
 * shows a blank week, and the records footer disappears rather than printing a
 * row of zeros.
 *
 * HYDRATION: Server Component. Every time-derived value (day keys, weekday
 * labels, `isToday`, the phase, the copy) arrives pre-computed in `rhythm` from
 * `computeRhythm({ now: Date.now(), ... })` called on the server. Nothing in
 * this subtree reads a clock, `window` or `localStorage`, so the server HTML
 * and the first client render are byte-identical.
 */
export function WeekGoalCard({
  rhythm,
  resume,
  className,
}: {
  rhythm: Rhythm;
  /** Where "next lesson" goes. Null hides the CTA rather than linking nowhere. */
  resume?: { href: string; lessonTitle: string; deptName: string } | null;
  /**
   * `accent` and `ink` are still accepted so the department page does not have
   * to change. The binder has one accent and department hues do not exist here,
   * so both are ignored: the week is the same week in every department.
   */
  accent?: string;
  ink?: string;
  className?: string;
}) {
  const copy = describeRhythm(rhythm);
  const met = rhythm.phase === "goal-met";

  // Permanent records. Only rendered once they exist, so a new account never
  // reads "best week: 0". Nothing on this line can ever go down, which is the
  // whole reason for printing it.
  const records: string[] = [];
  if (rhythm.lifetime > 0)
    records.push(
      `${rhythm.lifetime} ${rhythm.lifetime === 1 ? "lesson" : "lessons"} all time`
    );
  if (rhythm.bestWindow > 0) records.push(`best week ${rhythm.bestWindow}`);
  if (rhythm.bestStreak > 1) records.push(`best run ${rhythm.bestStreak} days`);

  return (
    <section
      className={cn("nb-box p-[clamp(1.2rem,3vw,2.1rem)]", className)}
      aria-labelledby="week-goal-heading"
    >
      <span className="nb-tape -top-3 left-[12%] rotate-[-3.2deg]" aria-hidden="true" />

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="min-w-0 flex-1">
          <p className="nb-marker">
            <span>{copy.eyebrow}</span>
            {/* Hitting the mark is the one state change on this card, and it is
                a stamp rather than a colour swap: there is no second accent to
                swap to, and a filled chip reads on a photocopy. */}
            {met && (
              <span className="nb-tag" data-on="">
                week cleared
              </span>
            )}
          </p>

          <h2 id="week-goal-heading" className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">
            {copy.headline}
          </h2>

          <p className="nb-sub mt-3">{copy.body}</p>

          <DayStrip days={rhythm.days} className="mt-5 max-w-sm" />

          {resume && (
            <div className="mt-6">
              <Link href={resume.href} className="nb-btn">
                {copy.cta}
              </Link>
              <p className="nb-slug mt-2">
                {resume.lessonTitle} / {resume.deptName}
              </p>
            </div>
          )}

          {records.length > 0 && (
            <p className="nb-slug nb-hair mt-6 pt-3">{records.join("  /  ")}</p>
          )}
        </div>

        {/* The count sits in its own ruled column on desktop, under a
            horizontal rule on narrow screens, so it never crowds the strip. */}
        <div className="nb-hair shrink-0 pt-5 md:border-l md:border-t-0 md:border-dashed md:border-l-[var(--rule)] md:pl-8 md:pt-1">
          <WeekRing
            count={rhythm.windowCount}
            goal={rhythm.goal}
            label={rhythm.windowKind === "first-week" ? "your first week" : "this week"}
          />
        </div>
      </div>
    </section>
  );
}
