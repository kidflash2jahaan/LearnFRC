import type { CSSProperties } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptInk } from "@/lib/departments";
import { chooseGoal } from "@/app/start/actions";
import { RiseGroup, RiseItem } from "@/components/motion/primitives";
import type { GoalOption } from "@/lib/recommend";

/**
 * THE ONE QUESTION.
 *
 * This is the entire first-run decision surface: five answers, each of which
 * is a submit button that records the answer and hands back a five-lesson
 * plan. There is deliberately nothing else on the page.
 *
 * WHY ONE QUESTION AND NOT A PLACEMENT QUIZ: FRC subteam is a role, not a
 * proficiency level, so there is nothing to place. And activation is a
 * same-session event — 70% of everyone who has ever activated completed their
 * first lesson within TEN MINUTES of signing up, median 4.5 minutes — so any
 * intake longer than one tap is spending the window it exists to protect.
 *
 * WHY ASK AT ALL, given every route opens on the same lesson: the answer buys
 * three things the dashboard cannot. It replaces "11 departments / 394
 * lessons" with one named route; it puts the learner's own subteam at lesson
 * TWO instead of lesson 29; and it is a micro-commitment made before any work
 * is asked for. The measured alternative — dropping people on /dashboard — is
 * where 43% of new accounts land today, and they complete a median of ONE
 * lesson against 22 for people who land on a lesson page.
 *
 * Server Component on purpose: every tile is a plain <form> posting a Server
 * Function, so the whole screen ships zero client JavaScript and there is no
 * hydration boundary anywhere near the first-run path.
 */
export function FirstRunGoalPicker({ goals }: { goals: GoalOption[] }) {
  return (
    <RiseGroup className="mt-8 grid gap-3.5 sm:grid-cols-2" stagger={0.05}>
      {goals.map((goal, i) => (
        // The first answer ("I'm brand new") spans the row: it is both the
        // modal answer for this audience and the safest default — 328 of 347
        // accounts are students and all 156 zero-progress accounts are.
        <RiseItem
          key={goal.id}
          className={i === 0 ? "h-full sm:col-span-2" : "h-full"}
        >
          <form action={chooseGoal} className="h-full">
            <input type="hidden" name="goal" value={goal.id} />
            <button
              type="submit"
              className="ac-tile group flex h-full w-full cursor-pointer flex-col p-5 text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              style={{ "--a": goal.pathColor } as CSSProperties}
            >
              <span className="flex items-start gap-3">
                <span
                  className="ac-badge flex h-11 w-11 flex-none items-center justify-center"
                  style={{ "--a": goal.pathColor } as CSSProperties}
                >
                  <Icon name={goal.iconName} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[17px] font-bold leading-tight tracking-tight text-foreground">
                    {goal.label}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-foreground/70">
                    {goal.blurb}
                  </span>
                </span>
                <ArrowRight
                  className="mt-3 h-4 w-4 flex-none text-foreground/45 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>

              {/* The route this answer resolves to — the same curated path the
                  /paths pages publish, shown as its department stops so the
                  answer visibly changes what happens next. */}
              <span className="mt-4 flex flex-1 flex-wrap items-center gap-1.5 border-t border-white/50 pt-3.5">
                {goal.route.map((stop, i) => (
                  <span key={stop.slug} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <ChevronRight
                        className="h-3 w-3 text-foreground/35"
                        aria-hidden
                      />
                    )}
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-lg ring-1 ring-white/70"
                      style={
                        {
                          background: `color-mix(in srgb, ${stop.accent} 22%, #fff)`,
                          color: deptInk(stop.slug),
                        } as CSSProperties
                      }
                      title={stop.name}
                    >
                      <Icon name={stop.iconName} className="h-3.5 w-3.5" />
                    </span>
                  </span>
                ))}
                <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/55">
                  {goal.route.length} stops
                </span>
              </span>

              {/* Named so the answer is traceable back to the published path. */}
              <span className="sr-only">
                Learning path: {goal.pathTitle}. {goal.outcome}. Route:{" "}
                {goal.route.map((s) => s.name).join(", ")}.
              </span>
            </button>
          </form>
        </RiseItem>
      ))}
    </RiseGroup>
  );
}
