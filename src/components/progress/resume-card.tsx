import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * "Pick up where you left off", extracted so it can sit on every surface a
 * returning learner might land on rather than only on /dashboard.
 *
 * WHY: 63% of first sessions are a single pageview and the median visitor sees
 * one page. Someone who comes back through search, a bookmark, /guides or a
 * glossary term would otherwise have to navigate to the dashboard to find out
 * what they were doing, two chooser pages deep. A returning learner should
 * never have to remember where they were; the product already knows.
 *
 * TWO SHAPES, deliberately unalike so a page never shows the same card twice:
 *   bar   one ruled line in the log, the slug on the left and the way in on
 *         the right. Sprinkle it widely; it disappears when there is nothing
 *         to resume.
 *   tile  the taped card, straightened only when you reach for it. For a page
 *         with room, where this IS the answer.
 *
 * Server Component and purely presentational. `.nb-lift` is CSS, so the hover
 * costs no client bundle. Renders nothing when `href` is empty, so a caller can
 * pass a null-ish target without guarding.
 */
export function ResumeCard({
  href,
  lessonTitle,
  deptName,
  deptSlug,
  moduleTitle,
  pct,
  fresh = false,
  variant = "bar",
  className,
}: {
  href: string;
  lessonTitle: string;
  deptName: string;
  deptSlug: string;
  moduleTitle?: string;
  /** Department completion 0-100. Omitted or 0 hides the meter. */
  pct?: number;
  /** True when this is the learner's first lesson rather than a resume. */
  fresh?: boolean;
  variant?: "bar" | "tile";
  className?: string;
}) {
  if (!href || !lessonTitle) return null;

  const kicker = fresh ? "start here" : "pick up where you left off";
  const action = fresh ? "Begin" : "Resume";

  if (variant === "bar") {
    return (
      <Link
        href={href}
        className={cn(
          "nb-box nb-lift flex items-center justify-between gap-4 p-[clamp(0.85rem,1.8vw,1.15rem)]",
          className
        )}
      >
        <span className="min-w-0">
          <span className="nb-slug block truncate">
            {kicker} / dept / {deptSlug}
          </span>
          <span className="mt-1 block truncate text-[1.02rem] font-bold leading-tight">
            {lessonTitle}
          </span>
          <span className="mt-0.5 block truncate text-[0.9rem] text-graphite">
            {deptName}
            {moduleTitle ? `, ${moduleTitle}` : ""}
          </span>
        </span>
        <span className="nb-btn nb-btn-sm shrink-0 self-center">{action}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "nb-box nb-lift nb-tilt-3 block p-[clamp(1.2rem,3vw,2rem)]",
        className
      )}
    >
      <span className="nb-tape -top-3 left-[18%] rotate-[-3.4deg]" aria-hidden="true" />

      <span className="nb-slug block">{kicker}</span>

      <span className="mt-3 block text-[clamp(1.35rem,1rem+1.6vw,2rem)] font-extrabold leading-[1.04] tracking-[-0.025em] text-balance">
        {lessonTitle}
      </span>

      <span className="nb-slug mt-2 block">
        dept / {deptSlug}
        {moduleTitle ? ` / ${moduleTitle}` : ""}
      </span>

      {typeof pct === "number" && pct > 0 && (
        <span className="mt-5 block max-w-sm">
          <span className="nb-slug flex items-baseline justify-between gap-2">
            <span>{deptName}</span>
            <span className="font-bold text-ink">{pct}%</span>
          </span>
          <span className="nb-meter mt-1.5 block">
            <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
          </span>
        </span>
      )}

      <span className="nb-hair mt-6 flex items-center justify-between gap-4 pt-4">
        <span className="nb-slug">{deptName}</span>
        <span className="nb-btn nb-btn-sm">{action}</span>
      </span>
    </Link>
  );
}
