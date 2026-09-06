import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StarterPlan } from "@/lib/recommend";

/** The tick that marks a cleared lesson. Drawn, because the shape has to carry
 *  the state on its own: a blue fill and nothing else would vanish the moment
 *  the page is printed or read by anyone who cannot separate blue from ink. */
function Tick() {
  return (
    <svg
      viewBox="0 0 14 12"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.4 6.4 L5 10.3 L12.6 1.7" />
    </svg>
  );
}

/**
 * THE PLAN — one obvious next action, and a finish line five lessons away.
 *
 * This replaces the zero-progress dashboard experience, which offers a
 * brand-new learner FIVE competing calls to action pointing at four different
 * destinations, and puts them below six gauges reading 0, eleven department
 * cards at 0%, and eleven locked badges. A page that is mostly a monument to
 * having done nothing is not an onboarding surface.
 *
 * Two things are load-bearing here:
 *
 *  1. ONE primary button. It names a specific lesson, its department, and its
 *     REAL read time (derived from the word count, not the `estimated_minutes`
 *     column, which overstates the first lesson a rookie meets by 12x, 25
 *     minutes claimed against a two-minute read. A 25-minute price tag at the
 *     decision point is a reason to leave).
 *
 *  2. A five-row checklist. Five is the measured retention threshold: 21.4% of
 *     learners who finish five lessons in week one are still completing
 *     lessons on days 8 to 28, against 3.7% who do not, and d21 survival is 32%
 *     against 6%. One through four is worth nothing over zero, so a "first
 *     lesson" celebration aims at a milestone the data says holds nobody. The
 *     visible finish line is therefore five, and it is drawn before the first
 *     lesson is opened so the learner knows what they are aiming at.
 *
 * HOW THE REBUILD DRAWS IT. The card is a checklist taped inside the binder
 * cover, and every state on it survives a photocopy: a cleared row is a filled
 * marker with a drawn tick and the word "done", the next row is a blue bar plus
 * the word "next". The old version leaned on a green wash and a coloured ring,
 * neither of which this palette owns and neither of which says anything on its
 * own.
 *
 * `compact` is the dashboard embed. It loses the tape and the tilt, because a
 * crooked card in a column of straight ones reads as a rendering fault rather
 * than as a card somebody pinned up in a hurry.
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
  const total = plan.lessons.length;
  const next = plan.next;

  return (
    <section
      aria-labelledby="first-run-plan-title"
      className={cn(
        "nb-box",
        compact
          ? "p-[clamp(1.05rem,2.2vw,1.5rem)]"
          : "nb-tilt-3 p-[clamp(1.2rem,2.6vw,1.9rem)]"
      )}
    >
      {!compact && (
        <span
          className="nb-tape -top-3 left-[14%] rotate-[-3.2deg]"
          aria-hidden="true"
        />
      )}

      {/* The header line is the filing label: which route this is, and how far
          down it you are. Both are identifiers, so both are in Space Mono. */}
      <p className="nb-slug flex flex-wrap gap-x-3 gap-y-1 border-b border-dashed border-rule pb-3">
        <span>route / {plan.pathSlug}</span>
        <span aria-hidden="true">/</span>
        <span className="text-ink">
          {plan.doneCount} of {total} cleared
        </span>
      </p>

      <h2
        id="first-run-plan-title"
        className={cn(
          "mt-4 max-w-[20ch]",
          compact
            ? "text-[clamp(1.25rem,1.05rem+0.7vw,1.6rem)]"
            : "text-[clamp(1.5rem,1.2rem+1.2vw,2.1rem)]"
        )}
      >
        {plan.doneCount === 0
          ? `Your first ${total} lessons.`
          : plan.doneCount >= total
            ? `All ${total} cleared.`
            : `${plan.doneCount} down, ${total - plan.doneCount} to go.`}
      </h2>

      <p className="nb-sub mt-2.5 text-[0.98rem] leading-snug">
        {plan.doneCount >= total
          ? "That is the threshold that makes it stick. Keep working down the route, everything below it is open and free."
          : "Learners who clear five lessons in their first week are about five times more likely to still be building three weeks later. One at a time."}
      </p>

      {/* ── The single action ────────────────────────────────────────── */}
      {next && (
        <div className="mt-[clamp(1.1rem,2.4vw,1.5rem)] border-t-2 border-ink pt-[clamp(1rem,2.2vw,1.4rem)]">
          <p className="nb-slug">
            {plan.doneCount === 0 ? "start here" : "next up"} /{" "}
            {/* `step` runs past the plan once all five are ticked: the route
                keeps going, but "lesson 6 of 5" does not. */}
            {next.step <= total
              ? `lesson ${next.step} of ${total}`
              : "further down your route"}
          </p>

          <h3 className="mt-2 max-w-[26ch]">{next.title}</h3>

          <p className="nb-slug mt-2">
            {next.deptName} / {next.readMins} min read / quiz at the end
          </p>

          <Link href={next.href} className="nb-btn mt-4">
            {plan.doneCount === 0 ? "Open the first lesson" : "Open this lesson"}
          </Link>
        </div>
      )}

      {/* ── The finish line, drawn before the work starts ────────────── */}
      <ol className="nb-list mt-[clamp(1.1rem,2.4vw,1.5rem)]">
        {plan.lessons.map((lesson, i) => {
          const isNext = next?.step === i + 1;
          return (
            <li key={lesson.id}>
              <Link
                href={lesson.href}
                className={cn(
                  "flex items-start gap-3 border-b border-dashed border-rule py-3 pl-2 pr-1 no-underline",
                  // Blue wash plus a blue bar plus the word "next" in the
                  // right-hand column. Three markers, one of which is not a
                  // colour, which is the rule the whole system runs on.
                  isNext &&
                    "bg-[rgba(27,54,200,0.06)] shadow-[inset_3px_0_0_var(--blue)]"
                )}
              >
                <span
                  className={cn(
                    "nb-box-sm grid h-7 w-7 flex-none place-items-center font-mono text-[0.78rem] font-bold tabular-nums",
                    lesson.done
                      ? "border-blue bg-blue text-card"
                      : isNext
                        ? "border-blue text-blue"
                        : "border-rule text-graphite"
                  )}
                  aria-hidden="true"
                >
                  {lesson.done ? <Tick /> : i + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-[0.96rem] font-semibold leading-snug",
                      lesson.done ? "text-graphite" : "text-ink"
                    )}
                  >
                    {lesson.title}
                  </span>
                  <span className="nb-slug mt-0.5 block truncate">
                    {lesson.deptName}
                  </span>
                </span>

                {(lesson.done || isNext) && (
                  <span className="nb-slug flex-none whitespace-nowrap">
                    {lesson.done ? "done" : "next"}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* ── Everything else is deferred until after lesson one ─────────
          No rule above this row: the checklist's last dashed line already
          closes the list, and a second hairline 4px under it is the doubled
          border that makes a spec sheet look like ruled paper by accident. */}
      <p className="mt-[clamp(1.1rem,2.4vw,1.5rem)] flex flex-wrap gap-x-6 gap-y-2 text-[0.92rem]">
        <Link
          href={plan.tailored ? "/start?change=1" : "/start"}
          className="nb-link"
        >
          {plan.tailored
            ? "Not your subteam? Change the route"
            : "Tell us what you do and we'll cut this to fit"}
        </Link>
        <Link href={`/paths/${plan.pathSlug}`} className="nb-link">
          See the whole route
        </Link>
      </p>
    </section>
  );
}
