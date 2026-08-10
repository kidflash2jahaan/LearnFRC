import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Target, Trophy } from "lucide-react";
import { describeRhythm, type Rhythm } from "@/lib/streaks";
import { cn } from "@/lib/utils";
import { DayStrip } from "./day-strip";
import { WeekRing } from "./week-ring";

/**
 * THE week-one retention surface: five lessons, one week, one next action.
 *
 * WHY THIS SHAPE (all measured on this database — see src/lib/streaks.ts for
 * the full note):
 *   • 5 lessons in the first 7 days is the only milestone that predicts
 *     survival (21.4% vs 3.7% still active on d8-28, p = 5.2e-5). 1-4 lessons
 *     predicts nothing over 0, which is why this card keeps pointing at five
 *     instead of congratulating a learner into a dead end at lesson one.
 *   • It replaces a choice with an action. A zero-progress learner currently
 *     meets six counters reading 0, eleven department cards at 0% and eleven
 *     locked badges before anything tells them what to do. This card shows one
 *     shape to fill and one link to press.
 *
 * WHAT IT WILL NOT DO: no countdown, no "expires tonight", no streak-loss
 * warning, no guilt for a gap. The one urgency-adjacent fact it states — that
 * five in a week is where retention jumps — is true, is stated once, and is
 * framed as information rather than as a threat. Coming back after two weeks
 * away produces a welcome, not a scolding.
 *
 * ZERO STATE: fully supported and deliberately the nicest branch. `phase` is
 * "new" when nothing has ever been completed; the ring shows five empty
 * segments ("five to go"), the strip shows a blank week, the records footer
 * disappears entirely rather than printing a row of zeros.
 *
 * HYDRATION: Server Component. Every time-derived value — the day keys, the
 * weekday labels, `isToday`, the phase, the copy — arrives pre-computed in the
 * `rhythm` prop from `computeRhythm({ now: Date.now(), ... })` called on the
 * server. Nothing in this subtree reads a clock, `window`, `localStorage` or
 * `useReducedMotion`, so the server HTML and the first client render are
 * byte-identical. Wrap it in `<Reveal>` at the insertion site if you want it
 * to animate in; that is timing-only and safe.
 */

const PHASE_ICON = {
  new: Target,
  "first-lesson": Sparkles,
  building: Target,
  "goal-met": Trophy,
  returning: Sparkles,
  resting: Target,
} as const;

export type ResumeTarget = {
  href: string;
  lessonTitle: string;
  deptName: string;
};

export function WeekGoalCard({
  rhythm,
  resume,
  accent = "#2560e6",
  ink,
  className,
}: {
  rhythm: Rhythm;
  /** Where "next lesson" goes. Null hides the CTA rather than linking nowhere. */
  resume?: ResumeTarget | null;
  /** Department accent, or the brand blue. */
  accent?: string;
  /**
   * Darker same-hue tone for anything that has to read as INK rather than as a
   * fill. The department accents are neon (electrical is #ffe53d) and a neon
   * glyph on the light theme is close to invisible; the rest of the site
   * already splits these two roles via `inkFor()`. Defaults to `accent` so a
   * caller with a single brand colour doesn't have to care.
   */
  ink?: string;
  className?: string;
}) {
  const copy = describeRhythm(rhythm);
  const met = rhythm.phase === "goal-met";
  // Hitting the mark switches the card to the success accent — the one moment
  // it changes colour, so the change means something.
  const a = met ? "#12b565" : accent;
  const glyph = met ? "#12b565" : (ink ?? accent);
  const Icon = PHASE_ICON[rhythm.phase];

  // Permanent records. Only rendered once they exist, so a new account never
  // sees "best week: 0".
  const records: string[] = [];
  if (rhythm.lifetime > 0)
    records.push(
      `${rhythm.lifetime} ${rhythm.lifetime === 1 ? "lesson" : "lessons"} all time`
    );
  if (rhythm.bestWindow > 0) records.push(`best week ${rhythm.bestWindow}`);
  if (rhythm.bestStreak > 1) records.push(`best run ${rhythm.bestStreak} days`);

  return (
    <section
      className={cn("ac-tile relative overflow-hidden p-6 sm:p-8", className)}
      style={{ "--a": a } as CSSProperties}
      aria-labelledby="week-goal-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${a} 32%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="min-w-0 flex-1">
          <span className="ac-chip inline-flex items-center gap-2">
            <Icon className="h-3.5 w-3.5" style={{ color: glyph }} aria-hidden />
            <span className="ac-eyebrow">{copy.eyebrow}</span>
          </span>

          <h2
            id="week-goal-heading"
            className="mt-4 text-balance font-display text-2xl font-bold leading-tight text-foreground sm:text-[28px]"
          >
            {copy.headline}
          </h2>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-foreground/75">
            {copy.body}
          </p>

          <DayStrip days={rhythm.days} accent={a} className="mt-5 max-w-sm" />

          {resume && (
            <div className="mt-6 flex flex-col gap-1.5">
              <Link href={resume.href} className="ac-btn self-start text-sm">
                {copy.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <span className="text-xs text-muted-foreground">
                {resume.lessonTitle} · {resume.deptName}
              </span>
            </div>
          )}

          {records.length > 0 && (
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/55">
              {/* Records are permanent — nothing on this line can ever go down,
                  which is the whole point of printing it. */}
              {records.join("  ·  ")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-center sm:justify-end">
          <WeekRing
            count={rhythm.windowCount}
            goal={rhythm.goal}
            from={a}
            to={met ? "#5dff9b" : "#1aa9d6"}
            label={rhythm.windowKind === "first-week" ? "first week" : "this week"}
            size={132}
            stroke={12}
          />
        </div>
      </div>
    </section>
  );
}
