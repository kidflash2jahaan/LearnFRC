"use client";

import * as React from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import { ListTree } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";
import { DayStrip } from "@/components/progress/day-strip";
import { rhythmMicrocopy, type Rhythm } from "@/lib/streaks";
import type { TocHeading } from "@/components/markdown";

/**
 * Signature element: the "live contents rail" — a sticky glass instrument
 * that tracks reading position (page-scroll progress bar), scroll-spies the
 * lesson's headings into a jump nav with a sliding highlight, and surfaces
 * the reader's real mastery of the surrounding department. Desktop only;
 * the page renders a simpler static mastery card for mobile.
 *
 * IT ALSO CARRIES THE WEEK. The rail is the only element that stays on screen
 * for the entire time someone is reading a lesson, and the lesson page is where
 * returning learners actually land (search, a bookmark, a link from a
 * teammate) — so the seven-day strip lives here as well as on the department
 * page. It sits LAST, below the mastery block, for a specific reason: it
 * appears only after /api/me/progress resolves, and anything that appears late
 * must appear below everything that was already there, or it shoves the table
 * of contents down under the reader's cursor.
 *
 * HYDRATION: `rhythm` arrives already computed, from the SERVER's clock, inside
 * the /api/me/progress payload (this page is static/ISR — there is no per-user
 * server render to derive "today" in). It is null on the server render and null
 * on the first client render, so first paint matches; nothing below reads a
 * clock, a locale or `window`. The existing `useReducedMotion` use in this file
 * stays timing-only and never changes the tree.
 */
export function ReadingRail({
  deptName,
  deptIcon,
  accent,
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
  deptIcon: string;
  accent: string;
  headings: TocHeading[];
  authed: boolean;
  /** No account, but has completed lessons in this browser. They get the real
      mastery bar (they earned it) plus a line saying where it currently lives. */
  guest?: boolean;
  pct: number;
  doneInDept: number;
  totalInDept: number;
  lessonPath: string;
  /** Server-computed week rhythm. Null → the week block is simply absent. */
  rhythm?: Rhythm | null;
}) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(
    scrollYProgress,
    reduce ? { stiffness: 1000, damping: 100 } : { stiffness: 90, damping: 22 }
  );

  const [activeId, setActiveId] = React.useState<string | null>(headings[0]?.id ?? null);

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

  const accentStyle = { "--a": accent } as CSSProperties;

  return (
    <div className="ac-glass relative overflow-hidden p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-2xl"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />

      {/* reading progress */}
      <div className="relative">
        <span className="ac-eyebrow flex items-center gap-1.5">
          <ListTree className="h-3.5 w-3.5" aria-hidden />
          On this page
        </span>
        <div
          className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="absolute inset-y-0 left-0 h-full rounded-full"
            style={{
              scaleX: progress,
              originX: 0,
              background: `linear-gradient(90deg, ${accent}, #1aa9d6)`,
            }}
          />
        </div>
      </div>

      {/* table of contents */}
      {headings.length > 0 && (
        <nav aria-label="Table of contents" className="relative mt-4 space-y-0.5 text-sm">
          {headings.map((h) => {
            const active = h.id === activeId;
            return (
              <a
                key={h.id}
                href={`#${h.id}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "relative flex min-h-9 items-center rounded-lg px-2.5 py-1.5 leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  h.level === 3 && "ml-3 text-[13px]",
                  active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="toc-active"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative line-clamp-1">{h.text}</span>
              </a>
            );
          })}
        </nav>
      )}

      {/* department mastery */}
      <div className="relative mt-6 border-t border-white/40 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="ac-badge flex h-8 w-8 shrink-0 items-center justify-center" style={accentStyle}>
            <Icon name={deptIcon} className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="ac-eyebrow">Mastery</p>
            <p className="truncate text-[13px] font-semibold text-foreground">{deptName}</p>
          </div>
        </div>

        {authed || guest ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(120,145,190,0.18)]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${accent}, #1aa9d6)`, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 20 }}
              />
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
              {doneInDept} / {totalInDept} lessons &middot; {pct}%
            </p>
            {guest && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Saved in this browser.{" "}
                <Link
                  href={`/signup?next=${encodeURIComponent(lessonPath)}&ref=reading-rail`}
                  className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Keep it for good
                </Link>
                .
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Finish a lesson and your progress shows up here — no account needed.
          </p>
        )}
      </div>

      {/* ── the week ────────────────────────────────────────────────────
          Five lessons in seven days is the only milestone that moves d21
          retention on this database, and a learner cannot aim at a number they
          can't see. What this block will NOT do: count down, print how long
          it's been, mark an empty day as missed, or claim anything expires. An
          empty square and a square for a day that hasn't happened yet are drawn
          the same way, because they mean the same thing. */}
      {rhythm && (
        <div className="relative mt-5 border-t border-white/40 pt-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="ac-eyebrow">
              {rhythm.windowKind === "first-week" ? "Your first week" : "This week"}
            </p>
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {rhythm.windowCount}/{rhythm.goal}
            </p>
          </div>
          <DayStrip days={rhythm.days} accent={accent} className="mt-3" />
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {rhythmMicrocopy(rhythm)}
          </p>
        </div>
      )}
    </div>
  );
}
