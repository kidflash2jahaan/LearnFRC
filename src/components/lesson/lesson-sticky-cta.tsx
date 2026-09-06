"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useMyProgress } from "@/components/progress/my-progress";
import { scrollToElement } from "@/components/perf-mode";

/**
 * The slip clipped to the bottom of the desk: a shortcut to this lesson's
 * finish line, wherever the reader currently is on the page.
 *
 * WHY IT IS position:fixed, AND WHY THAT IS THE POINT
 * ---------------------------------------------------
 * Measured on the live funnel: the completion control, the ONLY thing that
 * writes a lesson_progress row, is rendered *below* <LessonNextStep/> on the
 * lesson page, so the first clickable thing a reader is handed when the prose
 * ends is an exit to the next lesson. A reader can chain lessons forever and
 * record zero completions, which is the exact shape of the 45% of accounts
 * that have never completed anything. Reordering that page is out of this
 * component's remit, so the fix is a bar whose position in the DOM is
 * irrelevant: wherever the reader is, "finish this lesson" is one tap away.
 *
 * It also answers the 11-second lesson-page bounce (non-activators leave after
 * a median 11s; activators dwell 122s). The bar gives the page a visible
 * finish line, "3 questions, +10 XP" for a signed-in reader, "3 questions,
 * saved in this browser" for a guest, inside the first screens, instead of
 * asking the reader to take on faith that this page ends somewhere reachable.
 *
 * CONTRACT
 * --------
 * - It is `.nb-surface`: an ink border, the small hand radius and an offset
 *   ink drop. Never a blur, the binder gets depth from a misregistered second
 *   impression, not from frosted glass.
 * - The wrapper is always in the tree and starts hidden, identically on the
 *   server and on the first client render, so it cannot produce a hydration
 *   mismatch and being fixed it cannot shift layout. That is also what makes
 *   reading auth state here safe: by the time any string is visible, the
 *   progress store has had a render pass to resolve. While hidden it is
 *   `inert` and `aria-hidden`, so it is out of the tab order and out of the
 *   accessibility tree rather than merely transparent.
 * - Hides itself whenever the real completion card is on screen. It is a
 *   shortcut to that control, never a competitor to it.
 * - Dismissible, and stays dismissed for the life of the page. A nag you
 *   cannot close is worse than no nag.
 */

/** Roughly the height of the lesson header + control strip: don't compete with
    the page's own first screen, appear once the reader is actually reading. */
const SHOW_AFTER_PX = 720;

export function LessonStickyCta({
  mode,
  quizCount,
  nextHref,
  anchorRef,
}: {
  /** "quiz" = not finished yet; "next" = finished, offer the next lesson. */
  mode: "quiz" | "next";
  quizCount: number;
  nextHref?: string | null;
  /** The completion/quiz card. The bar scrolls to it and hides while it shows. */
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  // Auth state, for the XP line only. XP is paid exclusively by the
  // `on_lesson_completed` trigger on `lesson_progress`; a guest completion
  // writes `guest_progress`, which has no trigger (verified against the live
  // schema). So a guest who passes the quiz earns zero XP, and this bar must
  // not tell them otherwise. Until the store resolves, `loaded` is false and
  // we make no XP claim at all, "unknown" fails to the honest side.
  const { loaded, authed } = useMyProgress();
  const [scrolled, setScrolled] = React.useState(false);
  // Starts true so the bar stays hidden until the observer has actually
  // reported, never flash a shortcut to something already on screen.
  const [panelOnScreen, setPanelOnScreen] = React.useState(true);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    // Passive + rAF-coalesced: the handler does one read and at most one state
    // write per frame, and it never blocks the scroll thread.
    let raf = 0;
    const read = () => {
      raf = 0;
      setScrolled(window.scrollY > SHOW_AFTER_PX);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // `mode` is a dependency because the completion card and the quiz card are
  // different DOM nodes, when the quiz is passed the ref points at a new
  // element and the observer has to be re-attached to it.
  React.useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setPanelOnScreen(entry.isIntersecting),
      { rootMargin: "0px 0px -80px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [anchorRef, mode]);

  const hasAction = mode === "quiz" || !!nextHref;
  const visible = scrolled && !panelOnScreen && !dismissed && hasAction;

  const goToPanel = () => {
    scrollToElement(anchorRef.current, { block: "start" });
  };

  const done = mode === "next";
  // The reward half of the subtitle. For a signed-in reader the trigger pays
  // at least 10 XP (`10 + least(10, streak - 1)`, so 10 is a floor and never
  // an overstatement). For a guest, or before the store has resolved, the
  // true outcome is that the completion is saved against this browser and the
  // anonymous visitor id, which is also the copy the completion toast uses.
  const reward = loaded && authed ? "+10 XP" : "saved in this browser";
  const subtitle = done
    ? "saved, keep the run going"
    : quizCount > 0
      ? `${quizCount} question${quizCount === 1 ? "" : "s"} / ${reward}`
      : `one tap / ${reward}`;

  return (
    <div
      inert={!visible}
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 transition-opacity duration-150 print:hidden ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="nb-wrap pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* "Lesson actions", not "Finish this lesson": the signup aside further
            down the page already announces itself with that name, and two
            landmarks sharing one name are indistinguishable in a screen
            reader's landmark list. */}
        <div
          role="region"
          aria-label="Lesson actions"
          className="nb-surface flex items-center gap-3 px-3 py-2.5 sm:px-4"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.95rem] font-bold leading-tight">
              {done ? "Lesson complete" : "Finish this lesson"}
            </p>
            <p className="nb-slug truncate">{subtitle}</p>
          </div>

          {done && nextHref ? (
            <Button asChild variant="brand" size="sm">
              <Link href={nextHref}>Next lesson</Link>
            </Button>
          ) : (
            <Button variant="brand" size="sm" onClick={goToPanel}>
              {quizCount > 0 ? "Take the quiz" : "Mark complete"}
            </Button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Hide this bar"
            className="nb-slug inline-flex min-h-11 shrink-0 items-center px-1 text-ink underline decoration-rule underline-offset-4 hover:decoration-blue"
          >
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}
