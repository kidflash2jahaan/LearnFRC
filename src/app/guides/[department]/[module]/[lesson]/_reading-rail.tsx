"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll } from "framer-motion";
import { DayStrip } from "@/components/progress/day-strip";
import { rhythmMicrocopy, type Rhythm } from "@/lib/streaks";
import type { TocHeading } from "@/components/markdown";
import { cn } from "@/lib/utils";

/**
 * What a reader writes down the left edge of a page they are working through.
 *
 * The lesson page hands this a 16.5rem column with a 2px ink rule between it
 * and the article, which IS a notebook margin, so the rail draws nothing of its
 * own: no card, no frame, no floating instrument. A box here would be a second
 * sheet laid on the sheet you are already reading. It is three ruled blocks
 * stacked down the margin, separated by the hairline the system uses inside a
 * card, and it says three things a reader mid-lesson actually wants:
 *
 *   1. where you are on THIS page   (the pen line, plus the headings)
 *   2. where you are in the DEPARTMENT (the meter, plus the printed figure)
 *   3. how the week has gone        (the seven days)
 *
 * THE PEN LINE. The one instrument. It is the margin rule itself: 2px of ink
 * down the left of the contents, overprinted in ballpoint as far as you have
 * read. Driven by `useScroll`, never by a scroll listener, and with no spring
 * on it: input-driven, so it stops the instant you stop and there is nothing
 * to settle. That also means it needs no reduced-motion branch, because it
 * never animates on its own.
 *
 * The active heading is marked TWICE, never by colour alone: a blue bar in the
 * gutter and the label going bold ink. Same rule as everywhere else in the
 * binder, so the state survives a greyscale photocopy.
 *
 * Desktop only. The lesson page renders `MobileProgressCard` below the article
 * for narrow screens, because there is no margin to write in down there.
 *
 * HYDRATION: `rhythm` arrives already computed from the SERVER's clock inside
 * the /api/me/progress payload (this page is static/ISR, so there is no
 * per-user server render to derive "today" in). It is null on the server render
 * and null on the first client render, so first paint matches. Nothing here
 * reads a clock, a locale or `window` during render. It sits LAST on purpose:
 * it appears only once that fetch resolves, and anything that appears late must
 * appear below everything already there, or it shoves the contents down under
 * the reader's cursor.
 */
export function ReadingRail({
  deptName,
  deptSlug,
  headings,
  authed,
  guest = false,
  pct,
  doneInDept,
  totalInDept,
  lessonPath,
  rhythm = null,
}: {
  deptName: string;
  deptSlug: string;
  headings: TocHeading[];
  authed: boolean;
  /** No account, but has finished lessons in this browser. They get the real
      meter, they earned it, plus a line saying where that progress lives. */
  guest?: boolean;
  pct: number;
  doneInDept: number;
  totalInDept: number;
  lessonPath: string;
  /** Server-computed week rhythm. Null → the week block is simply absent. */
  rhythm?: Rhythm | null;
}) {
  const { scrollYProgress } = useScroll();
  const [activeId, setActiveId] = React.useState<string | null>(
    headings[0]?.id ?? null
  );

  React.useEffect(() => {
    if (headings.length === 0) return;
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  return (
    <div className="text-[0.92rem]">
      {/* ---- 1. this page ---- */}
      <p className="nb-slug">on this page</p>

      {headings.length > 0 ? (
        <nav aria-label="On this page" className="relative mt-3 pl-4">
          {/* The margin rule, and the ballpoint overprint that tracks how far
              down it you have read. Decorative: the heading list underneath
              says the same thing in words, and a screen reader has no use for
              a second, continuously changing copy of the scroll position. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-0.5 bg-ink"
          />
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-0.5 origin-top bg-blue"
            style={{ scaleY: scrollYProgress }}
          />

          <ul className="grid">
            {headings.map((h) => {
              const active = h.id === activeId;
              return (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    aria-current={active ? "location" : undefined}
                    className={cn(
                      "relative flex min-h-9 items-center py-1 leading-snug no-underline",
                      h.level === 3 && "pl-3 text-[0.86rem]",
                      active
                        ? "font-bold text-ink"
                        : "text-graphite hover:text-ink"
                    )}
                  >
                    {/* The second mark on the active row: a stub of blue laid
                        across the margin rule, where a reader puts their pen. */}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute -left-4 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-blue"
                      />
                    )}
                    <span className="line-clamp-2">{h.text}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : (
        <p className="mt-2 text-[0.88rem] leading-snug text-graphite">
          One run, no sections to jump between.
        </p>
      )}

      {/* ---- 2. this department ---- */}
      <div className="nb-hair mt-6 pt-5">
        <Link
          href={`/guides/${deptSlug}`}
          className="nb-slug no-underline hover:text-blue"
        >
          dept / {deptSlug}
        </Link>
        <p className="mt-1.5 font-bold leading-tight">{deptName}</p>

        {authed || guest ? (
          <>
            {/* The bar never travels alone: the figure beside it is the thing
                that is actually readable, and it is what survives print. */}
            <div className="nb-meter mt-3">
              <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
            </div>
            <p className="nb-slug mt-2">
              {doneInDept} of {totalInDept} read / {pct}%
            </p>
            {guest && (
              <p className="mt-2 text-[0.86rem] leading-snug text-graphite">
                Saved in this browser.{" "}
                <Link
                  href={`/signup?next=${encodeURIComponent(lessonPath)}&ref=reading-rail`}
                  className="nb-link"
                >
                  Give it a permanent home
                </Link>
                .
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-[0.86rem] leading-snug text-graphite">
            Finish a lesson and it gets counted here. No account needed.
          </p>
        )}
      </div>

      {/* ---- 3. the week ----
          Five lessons across seven days is the only milestone that moves d21
          retention on this database, and nobody can aim at a number they cannot
          see. What this block will NOT do: count down, print how long it has
          been, mark an empty day as missed, or claim anything expires. A day
          with nothing in it and a day that has not happened yet are drawn the
          same, because they mean the same thing. */}
      {rhythm && (
        <div className="nb-hair mt-6 pt-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="nb-slug">
              {rhythm.windowKind === "first-week" ? "first week" : "this week"}
            </p>
            <p className="nb-slug font-bold text-ink">
              {rhythm.windowCount}/{rhythm.goal}
            </p>
          </div>
          <DayStrip days={rhythm.days} className="mt-3" />
          <p className="mt-2.5 text-[0.86rem] leading-snug text-graphite">
            {rhythmMicrocopy(rhythm)}
          </p>
        </div>
      )}
    </div>
  );
}
