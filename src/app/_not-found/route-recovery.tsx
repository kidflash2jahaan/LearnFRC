"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Search, Sparkles } from "lucide-react";

/* ==================================================================== */
/*  "Did you mean …" recovery for a 404                                  */
/*                                                                       */
/*  Stale links posted years ago on Chief Delphi get truncated, wrapped, */
/*  or retyped — e.g. .../what-first-and-frc-are/what-is- instead of     */
/*  .../what-is-first. Those readers currently hit a dead end. This      */
/*  matches the requested path against the real content index and offers */
/*  the closest pages. It never auto-redirects: the URL genuinely is a   */
/*  404, so we return 404 and let the reader choose.                     */
/* ==================================================================== */

type Dept = { slug: string; name: string; tagline: string | null };
type LessonHit = {
  slug: string;
  title: string;
  moduleSlug: string;
  deptSlug: string;
  deptName: string;
};
type Candidate = { href: string; title: string; context: string };
type Suggestion = Candidate & { score: number };

function segments(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

/** Dice coefficient over character bigrams — cheap fuzzy string similarity. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const grams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const g = a.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const g = b.slice(i, i + 2);
    const n = grams.get(g) ?? 0;
    if (n > 0) {
      grams.set(g, n - 1);
      hits += 1;
    }
  }
  return (2 * hits) / (a.length - 1 + b.length - 1);
}

function scoreCandidate(requested: string, candidate: string): number {
  const r = requested.toLowerCase();
  const c = candidate.toLowerCase();
  if (r === c) return 0;

  const rs = segments(r);
  const cs = segments(c);
  // A truncated link: the real page's URL starts with what was requested.
  // Only trust this on a specific-enough path, or "/guides" would match all.
  const specific = rs.length >= 3 && r.length >= 16;
  if (specific && c.startsWith(r)) return 1;
  if (specific && r.startsWith(c) && cs.length >= 2) return 0.9;

  const shared = cs.filter((s) => rs.includes(s)).length;
  const overlap = shared / Math.max(rs.length, cs.length, 1);
  const tail = similarity(rs[rs.length - 1] ?? "", cs[cs.length - 1] ?? "");
  return 0.55 * overlap + 0.45 * tail;
}

export function RouteRecovery() {
  const pathname = usePathname() || "";
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);

  React.useEffect(() => {
    let alive = true;
    // Deep paths only — a bare typo like "/gudies" has nothing to recover to
    // beyond the tiles already on the page.
    if (segments(pathname).length < 2) return;

    fetch("/api/search-index")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { departments?: Dept[]; lessons?: LessonHit[] } | null) => {
        if (!alive || !data) return;

        const candidates: Candidate[] = [
          ...(data.departments ?? []).map((d) => ({
            href: `/guides/${d.slug}`,
            title: d.name,
            context: "Department",
          })),
          ...(data.lessons ?? []).map((l) => ({
            href: `/guides/${l.deptSlug}/${l.moduleSlug}/${l.slug}`,
            title: l.title,
            context: l.deptName,
          })),
        ];

        const ranked = candidates
          .map((c) => ({ ...c, score: scoreCandidate(pathname, c.href) }))
          .filter((c) => c.score >= 0.5)
          .sort((a, b) => b.score - a.score || a.href.length - b.href.length)
          .slice(0, 3);

        setSuggestions(ranked);
      })
      .catch(() => {
        /* a 404 page must never break louder than the 404 itself */
      });

    return () => {
      alive = false;
    };
  }, [pathname]);

  const openSearch = React.useCallback(() => {
    window.dispatchEvent(new Event("open-search"));
  }, []);

  return (
    <div className="mt-8 w-full">
      {suggestions.length > 0 && (
        <div className="ac-card w-full p-4 text-left sm:p-5">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" focusable="false" />
            Did you mean one of these?
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {suggestions.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-primary/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {s.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.context}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                    focusable="false"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={openSearch}
        className="ac-chip mt-4 inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Search className="h-4 w-4 text-primary" aria-hidden="true" focusable="false" />
        Search every lesson
        <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
