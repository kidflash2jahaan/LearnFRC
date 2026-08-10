import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { deptMeta } from "@/lib/departments";
import { cn } from "@/lib/utils";

/**
 * "Pick up where you left off" — the resume affordance, extracted so it can
 * appear on every surface a returning learner might land on instead of only on
 * /dashboard.
 *
 * WHY: 63% of first sessions are a single pageview and the median visitor sees
 * one page. Someone who returns via search, a bookmark, /guides or a glossary
 * term currently has to navigate back to the dashboard to find out what they
 * were doing — two chooser pages deep. A returning learner should never have
 * to remember where they were; the product already knows.
 *
 * The `bar` variant is the one to sprinkle widely (a single row, no hero
 * weight, disappears if there's nothing to resume). The `tile` variant is the
 * heavier hero treatment for a page that has room for it.
 *
 * Server Component and purely presentational — every value is a prop, so the
 * caller decides how the target is resolved and nothing here reads a clock or
 * a browser API. Renders nothing at all when `href` is empty, so a caller can
 * pass through a null-ish target without guarding.
 */
export function ResumeCard({
  href,
  lessonTitle,
  deptName,
  deptSlug,
  moduleTitle,
  pct,
  /** True when this is the learner's first lesson rather than a resume. */
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
  fresh?: boolean;
  variant?: "bar" | "tile";
  className?: string;
}) {
  if (!href || !lessonTitle) return null;

  const accent = deptMeta(deptSlug).color;
  const kicker = fresh ? "Start here" : "Pick up where you left off";
  const action = fresh ? "Begin" : "Resume";

  if (variant === "bar") {
    return (
      <Link
        href={href}
        className={cn(
          "ac-tile group flex items-center justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className
        )}
        style={{ "--a": accent } as CSSProperties}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
            style={{ "--a": accent } as CSSProperties}
          >
            <Play className="h-5 w-5 fill-current" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wider text-foreground/70">
              {kicker}
            </span>
            <span className="block truncate text-[15px] font-bold text-foreground">
              {lessonTitle}
            </span>
            <span className="block truncate text-sm text-foreground/70">
              {deptName}
              {moduleTitle ? ` · ${moduleTitle}` : ""}
            </span>
          </span>
        </span>
        <span className="ac-btn inline-flex shrink-0 self-center text-sm">
          <span className="hidden sm:inline">{action}</span>
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "ac-tile group block p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-8",
        className
      )}
      style={{ "--a": accent } as CSSProperties}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/75">
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            {kicker}
          </span>
          <h2 className="mt-2 text-balance font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {lessonTitle}
          </h2>
          <p className="mt-1.5 text-[15px] font-medium text-foreground/75">
            {deptName}
            {moduleTitle ? ` · ${moduleTitle}` : ""}
          </p>
          {typeof pct === "number" && pct > 0 && (
            <div className="mt-4 max-w-sm">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-foreground/75">
                <span>{deptName} progress</span>
                <span className="text-foreground">{pct}%</span>
              </div>
              <Progress
                value={pct}
                className="h-2 bg-white/45"
                barClassName="bg-[color-mix(in_srgb,var(--a)_78%,#141f2c)]"
              />
            </div>
          )}
        </div>
        <span className="ac-btn inline-flex shrink-0 self-start text-sm sm:self-center">
          {action}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}
