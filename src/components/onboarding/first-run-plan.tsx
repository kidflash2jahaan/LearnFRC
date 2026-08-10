import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, Route, Settings2 } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptInk } from "@/lib/departments";
import { cn } from "@/lib/utils";
import type { StarterPlan } from "@/lib/recommend";

/**
 * THE PLAN — one obvious next action, and a finish line five lessons away.
 *
 * This replaces the zero-progress dashboard experience, which currently offers
 * a brand-new learner FIVE competing calls to action pointing at four
 * different destinations, and puts them below six gauges reading 0, eleven
 * department cards at 0%, and eleven locked badges. A page that is mostly a
 * monument to having done nothing is not an onboarding surface.
 *
 * Two things are load-bearing here:
 *
 *  1. ONE primary button. It names a specific lesson, its department, and its
 *     REAL read time (derived from the word count, not the `estimated_minutes`
 *     column, which overstates the first lesson a rookie meets by 12x — 25
 *     minutes claimed against a ~2-minute read. A 25-minute price tag at the
 *     decision point is a reason to leave).
 *
 *  2. A five-row checklist. Five is the measured retention threshold: 21.4% of
 *     learners who finish five lessons in week one are still completing
 *     lessons on days 8-28, against 3.7% who do not, and d21 survival is 32%
 *     vs 6%. One through four is worth nothing over zero, so a "first lesson"
 *     celebration aims at a milestone the data says does not hold anyone. The
 *     visible finish line is therefore five, and it is drawn before the first
 *     lesson is opened so the learner knows what they are aiming at.
 *
 * Pure Server Component: no client state, no motion, nothing read from the
 * browser during render, so the markup is identical on both sides of hydration.
 */
export function FirstRunPlan({
  plan,
  compact = false,
}: {
  plan: StarterPlan;
  compact?: boolean;
}) {
  const accent = plan.pathColor;
  const total = plan.lessons.length;
  const next = plan.next;

  return (
    <section
      aria-labelledby="first-run-plan-title"
      className={cn(
        "relative overflow-hidden",
        compact ? "ac-card p-5 sm:p-6" : "ac-glass p-6 sm:p-8"
      )}
      style={{ "--a": accent } as CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: accent }}
      />

      <div className="relative flex flex-wrap items-center gap-2">
        <span className="ac-chip inline-flex items-center gap-2">
          <Route className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="ac-eyebrow">Your route</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-2.5 py-1 text-xs font-semibold text-foreground/70 ring-1 ring-white/70">
          <Icon name={plan.pathIconName} className="h-3.5 w-3.5" />
          {plan.pathTitle}
        </span>
      </div>

      <h2
        id="first-run-plan-title"
        className={cn(
          "relative mt-4 text-balance font-display font-bold tracking-tight",
          compact ? "text-xl" : "text-2xl sm:text-3xl"
        )}
      >
        {plan.doneCount === 0
          ? `Your first ${total} lessons`
          : plan.doneCount >= total
            ? `You cleared all ${total}`
            : `${plan.doneCount} of ${total} done — keep going`}
      </h2>

      <p
        className={cn(
          "relative mt-2 max-w-xl leading-relaxed text-foreground/70",
          compact ? "text-sm" : "text-[15px]"
        )}
      >
        {plan.doneCount >= total
          ? "That's the threshold that makes it stick. Keep going down your route — everything below is unlocked and free."
          : "Learners who finish five lessons in their first week are five times more likely to still be building three weeks later. One at a time."}
      </p>

      {/* ── THE single action ─────────────────────────────────────────── */}
      {next && (
        <div className="relative mt-5 flex flex-col gap-2">
          <Link
            href={next.href}
            className="ac-btn h-auto max-w-full items-start gap-3 self-start whitespace-normal py-3 text-left text-sm"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
                {plan.doneCount === 0 ? "Start here" : "Next up"}
                {/* `step` runs past the plan once all five are ticked — the
                    route continues, but "lesson 6 of 5" does not. */}
                {next.step <= total ? ` · Lesson ${next.step} of ${total}` : " · Further down your route"}
              </span>
              <span className="mt-0.5 block font-bold">{next.title}</span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 flex-none" aria-hidden />
          </Link>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{next.deptName}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {next.readMins} min read
            </span>
            <span aria-hidden>·</span>
            <span>Pass the quiz to bank it</span>
          </span>
        </div>
      )}

      {/* ── The finish line, drawn before the work starts ─────────────── */}
      <ol className="relative mt-5 space-y-1.5">
        {plan.lessons.map((lesson, i) => {
          const isNext = next?.step === i + 1;
          return (
            <li key={lesson.id}>
              <Link
                href={lesson.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  isNext
                    ? "bg-white/80 ring-1 ring-primary/25"
                    : "hover:bg-white/60"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 flex-none items-center justify-center rounded-lg text-xs font-bold tabular-nums ring-1",
                    lesson.done
                      ? "bg-[#12b565]/15 text-[#0a7a43] ring-[#12b565]/25"
                      : isNext
                        ? "ring-white/70"
                        : "bg-white/55 text-foreground/50 ring-white/70"
                  )}
                  style={
                    !lesson.done && isNext
                      ? ({
                          background: `color-mix(in srgb, ${lesson.accent} 24%, #fff)`,
                          color: deptInk(lesson.deptSlug),
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {lesson.done ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      lesson.done ? "text-foreground/55" : "text-foreground"
                    )}
                  >
                    {lesson.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {lesson.deptName}
                  </span>
                </span>
                {lesson.done && (
                  <span className="sr-only">Completed</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* ── Everything else is deferred until after lesson one ────────── */}
      <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-xs">
        <Link
          href={plan.tailored ? "/start?change=1" : "/start"}
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          {plan.tailored
            ? "Not your subteam? Change your route"
            : "Tell us what you do and we'll tailor this"}
        </Link>
        <Link
          href={`/paths/${plan.pathSlug}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          See the whole route
        </Link>
      </div>
    </section>
  );
}
