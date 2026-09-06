import Link from "next/link";

/**
 * What is written at the foot of the sheet: finish this one, then turn the page.
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured on the site's best search page
 * (/guides/cad-design/worked-examples-mini-projects/swerve-drivebase-layout):
 * 139 search visitors, 1.0 pages each, 0 signups. The page was not link-starved
 * (83 links), but when the prose ended at y=1638 the only "next lesson"
 * affordance sat at y=3943, i.e. 2,305px further down, behind a 1,102px quiz and
 * a signup ask, and the first clickable thing offered after the prose was a card
 * of target="_blank" links to other sites. We handed the reader the exit before
 * we offered the continuation. This block renders immediately after the
 * takeaways and before the quiz, so the continuation comes first.
 *
 * HOW IT IS DRAWN
 * ---------------
 * Ruled, not boxed, except for one thing. The whole page above this is flat ink
 * on paper, so the single squared-up card here is the only object in the running
 * text with a border round it, and it is therefore the only thing that reads as
 * "press this". It carries no tape and no tilt on purpose: everything else
 * pinned to this page is a clipping, and this is the instruction.
 *
 * CONTRACT
 * --------
 * - Pure Server Component: no client JS, no state. The links are in the static
 *   HTML at full opacity, so crawlers and fast scrollers both get them, and
 *   there is no layout shift.
 * - Exactly one thing is visually primary. Everything else is quieter so it
 *   cannot compete.
 * - ONE deliberate exception, above the card: a link to this lesson's quiz.
 *   Fixing the exit-before-continuation problem created a second one, because
 *   the completion control (the only thing that writes a lesson_progress row) is
 *   rendered further down the page than this block, so a reader could chain
 *   lessons forever and record zero completions, which is the exact shape of the
 *   45% of accounts that have never completed anything. The quiz link is quieter
 *   than the card but it comes first, so the activation is offered before the
 *   exit. It is a plain anchor with no state, so it holds the pure-server
 *   contract: `#lesson-quiz` resolves to the quiz card, or to the sign-off once
 *   the lesson is finished, so it is correct in both states.
 * - Cold-landing context: a visitor arriving mid-curriculum from search is told
 *   which module this is, where in it they are, and where to start if new.
 */

export type NextStepLink = {
  title: string;
  summary: string | null;
  href: string;
};

export function LessonNextStep({
  deptName,
  deptHref,
  moduleTitle,
  moduleHref,
  moduleLessonCount,
  positionInModule,
  next,
  nextIsNewModule,
  related,
  relatedLabel,
  startHref,
  showStart,
}: {
  deptName: string;
  deptHref: string;
  moduleTitle: string;
  moduleHref: string;
  moduleLessonCount: number;
  positionInModule: number;
  /** The concrete next lesson, or null when this is the last in the track. */
  next: NextStepLink | null;
  /** True when `next` starts a different module, which is worth saying. */
  nextIsNewModule: boolean;
  /** 2 to 4 genuinely related lessons (same module first, then neighbours). */
  related: NextStepLink[];
  /** Heading for `related`, kept honest about where those lessons come from. */
  relatedLabel: string;
  /** First lesson of the department, for readers who landed mid-curriculum. */
  startHref: string;
  showStart: boolean;
}) {
  return (
    <section
      aria-labelledby="next-step-heading"
      className="nb-rule mt-[clamp(2rem,4vw,3rem)] scroll-mt-24 pt-4"
    >
      {/* Where a cold visitor actually is. Mono, because every part of it is a
          position or an identifier rather than a sentence. */}
      <p className="nb-slug flex flex-wrap items-center gap-x-2">
        <Link href={deptHref} className="no-underline hover:text-blue">
          {deptName}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={moduleHref} className="no-underline hover:text-blue">
          {moduleTitle}
        </Link>
        <span aria-hidden="true">/</span>
        <span>
          lesson {positionInModule} of {moduleLessonCount}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <h2
          id="next-step-heading"
          className="max-w-[18ch] text-[clamp(1.4rem,1.1rem+1vw,2rem)]"
        >
          {next ? "Keep going" : "That is the end of this track"}
        </h2>

        {/* The activation, offered before the exit below it.
            The XP qualifier is not padding. This page is ISR-cached
            (`revalidate = 86400`), so this string is in the SAME static HTML for
            every reader and cannot branch on auth. It once read "+10 XP" flat,
            which is false for a logged-out reader: a guest completion writes a
            `guest_progress` row, and the only thing that pays XP is the
            `on_lesson_completed` trigger on `lesson_progress` (verified against
            the live schema, there is no trigger on `guest_progress`). Guests
            earn zero XP at quiz time. "with an account" is true in both
            directions: signed in, it pays now; as a guest, it pays when the row
            migrates at signup. 10 is the floor the trigger guarantees
            (`10 + least(10, streak - 1)`), never an overstatement. */}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href="#lesson-quiz" className="nb-btn-ghost nb-btn-sm">
            Take the quiz
          </a>
          <span className="nb-slug">+10 XP with an account</span>
        </span>
      </div>

      {/* ---- the one thing to press ---- */}
      {next && (
        <Link
          href={next.href}
          className="nb-box nb-lift group mt-4 flex items-center gap-[clamp(1rem,3vw,2rem)] p-[clamp(1.1rem,2.4vw,1.75rem)] no-underline"
        >
          <span className="min-w-0 flex-1">
            <span className="nb-slug block">
              {nextIsNewModule ? "next module starts with" : "next lesson"}
            </span>
            <span className="mt-1.5 block text-[clamp(1.15rem,1rem+0.7vw,1.5rem)] font-extrabold leading-[1.1] tracking-[-0.02em] group-hover:text-blue">
              {next.title}
            </span>
            {/* No `block` on the clamp: Tailwind's `block` beats line-clamp's
                required display:-webkit-box and the clamp silently dies
                (verified at 375px, the summary ran to six lines). */}
            {next.summary && (
              <span className="mt-1.5 line-clamp-2 text-[0.95rem] leading-snug text-graphite">
                {next.summary}
              </span>
            )}
          </span>
          {/* The turned corner. Drawn, and it says the word as well as the
              shape, so it is not an arrow glyph doing the work alone. */}
          <span
            aria-hidden="true"
            className="nb-box-sm hidden shrink-0 px-3 py-2 font-mono text-[0.78rem] font-bold text-blue sm:block"
          >
            open
          </span>
        </Link>
      )}

      {/* ---- the quieter ways out ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link
          href={moduleHref}
          className="nb-slug inline-flex min-h-11 items-center text-ink no-underline hover:text-blue"
        >
          All {moduleLessonCount} lessons in {moduleTitle}
        </Link>
        {showStart && (
          <Link
            href={startHref}
            className="nb-slug inline-flex min-h-11 items-center text-ink no-underline hover:text-blue"
          >
            New to {deptName}? Start at lesson one
          </Link>
        )}
      </div>

      {/* ---- genuinely related: same module first, then track neighbours ---- */}
      {related.length > 0 && (
        <div className="nb-hair mt-5 pt-4">
          <p className="nb-slug">{relatedLabel}</p>
          <ul className="mt-2 sm:columns-2 sm:gap-x-[clamp(1.4rem,3vw,2.6rem)]">
            {related.map((r) => (
              <li key={r.href} className="break-inside-avoid">
                <Link
                  href={r.href}
                  className="flex min-h-11 items-center gap-2 py-1 text-[0.95rem] leading-snug no-underline hover:text-blue"
                >
                  <span aria-hidden="true" className="font-bold text-blue">
                    -
                  </span>
                  <span className="min-w-0">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
