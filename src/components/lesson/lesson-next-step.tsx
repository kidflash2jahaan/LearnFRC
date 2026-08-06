import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, ListTree, Rocket, CornerDownRight } from "lucide-react";
import { Icon } from "@/lib/icon-map";

/**
 * End-of-lesson continuation block.
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured on the site's best search page
 * (/guides/cad-design/worked-examples-mini-projects/swerve-drivebase-layout):
 * 139 search visitors, 1.0 pages each, 0 signups. The page was not link-starved
 * — it had 83 links — but when the article prose ended at y=1638 the *only*
 * "next lesson" affordance sat at y=3943, i.e. 2,305px (≈2.4 viewports) further
 * down, behind a 1,102px quiz card and a signup ask. The first clickable thing
 * offered after the prose was the "Go deeper" card, whose every link is
 * target="_blank" to an external site. We were handing the reader the exit
 * before we offered the continuation.
 *
 * This block is rendered immediately after Key takeaways and BEFORE the quiz,
 * so the continuation is the first thing offered when the reader finishes.
 *
 * CONTRACT
 * --------
 * - Pure server component: no client JS, no state, no motion wrapper. The links
 *   are in the static HTML at full opacity, so crawlers and fast scrollers both
 *   see them, and there is no layout shift.
 * - The primary continuation is visually singular (one accent-filled card).
 *   Everything else on the block is deliberately quieter so it cannot compete.
 * - Cold-landing context: a visitor arriving mid-curriculum from search is told
 *   which module this is, their position in it, and where to start if new.
 */

export type NextStepLink = {
  title: string;
  summary: string | null;
  href: string;
};

export function LessonNextStep({
  deptName,
  deptHref,
  deptIcon,
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
  accentColor,
  ink,
}: {
  deptName: string;
  deptHref: string;
  deptIcon: string;
  moduleTitle: string;
  moduleHref: string;
  moduleLessonCount: number;
  positionInModule: number;
  /** The concrete next lesson, or null when this is the last in the track. */
  next: NextStepLink | null;
  /** True when `next` starts a different module — worth saying out loud. */
  nextIsNewModule: boolean;
  /** 2–3 genuinely related lessons (same module first, then track neighbours). */
  related: NextStepLink[];
  /** Heading for `related` — kept honest about where those lessons come from. */
  relatedLabel: string;
  /** First lesson of the department, for readers who landed mid-curriculum. */
  startHref: string;
  showStart: boolean;
  accentColor: string;
  ink: string;
}) {
  const accent = { "--a": accentColor, "--ai": ink } as CSSProperties;

  return (
    <section
      aria-labelledby="next-step-heading"
      className="mt-10 scroll-mt-24"
      style={accent}
    >
      {/* ---- context strip: where a cold visitor actually is ---- */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
        <Link
          href={deptHref}
          className="inline-flex min-h-11 items-center gap-1.5 font-medium text-foreground/80 transition-colors hover:text-[color:var(--ai)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Icon name={deptIcon} className="h-4 w-4 shrink-0 text-[color:var(--ai)]" aria-hidden />
          {deptName}
        </Link>
        <span aria-hidden className="text-muted-foreground/40">
          /
        </span>
        <Link
          href={moduleHref}
          className="inline-flex min-h-11 items-center font-medium text-foreground/80 transition-colors hover:text-[color:var(--ai)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {moduleTitle}
        </Link>
        <span className="tabular-nums">
          &middot; lesson {positionInModule} of {moduleLessonCount}
        </span>
      </div>

      <h2
        id="next-step-heading"
        className="mt-3 font-display text-xl font-semibold tracking-tight"
      >
        {next ? "Keep going" : "You've reached the end of this track"}
      </h2>

      {/* ---- THE primary continuation: one card, visually singular ---- */}
      {next && (
        <Link
          href={next.href}
          className="group mt-4 flex items-center gap-4 rounded-3xl border p-5 transition-[transform,box-shadow] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-5 sm:p-6"
          style={{
            borderColor: `color-mix(in srgb, ${accentColor} 38%, transparent)`,
            background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 13%, #ffffff), color-mix(in srgb, ${accentColor} 4%, #ffffff))`,
            boxShadow: `0 14px 34px -16px color-mix(in srgb, ${accentColor} 65%, transparent)`,
          }}
        >
          <span className="min-w-0 flex-1">
            <span className="ac-eyebrow flex items-center gap-1.5">
              <CornerDownRight className="h-3.5 w-3.5" aria-hidden />
              {nextIsNewModule ? "Next module" : "Next lesson"}
            </span>
            <span className="mt-1.5 block text-pretty font-display text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
              {next.title}
            </span>
            {/* No `block` on the clamp below — Tailwind's `block` beats
                line-clamp's required `display:-webkit-box` and the clamp
                silently dies (verified at 375px: the summary ran to six
                lines before this was removed). */}
            {next.summary && (
              <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground/65">
                {next.summary}
              </span>
            )}
          </span>
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-transform group-hover:translate-x-0.5"
            style={{
              background: `linear-gradient(160deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #0f7fb8))`,
              boxShadow: `0 8px 18px -8px color-mix(in srgb, ${accentColor} 80%, transparent)`,
            }}
            aria-hidden
          >
            <ArrowRight className="h-5 w-5" />
          </span>
        </Link>
      )}

      {/* ---- quieter secondary options ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          href={moduleHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground/70 transition-colors hover:text-[color:var(--ai)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          All {moduleLessonCount} lessons in {moduleTitle}
        </Link>
        {showStart && (
          <Link
            href={startHref}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground/70 transition-colors hover:text-[color:var(--ai)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Rocket className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            New to {deptName}? Start at the beginning
          </Link>
        )}
      </div>

      {/* ---- genuinely related: same module first, then track neighbours ---- */}
      {related.length > 0 && (
        <div className="mt-6">
          <p className="ac-eyebrow">{relatedLabel}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="group flex min-h-11 items-start gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--ai)]"
                    aria-hidden
                  />
                  <span className="min-w-0 font-medium text-foreground/80 group-hover:text-[color:var(--ai)]">
                    {r.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
