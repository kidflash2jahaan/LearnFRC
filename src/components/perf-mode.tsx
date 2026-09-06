"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const KEY = "perf-mode";

/* ------------------------------------------------------------------ */
/*  State                                                              */
/*  The flag lives on <html data-perf> so the inline script in the root */
/*  layout can set it before first paint. localStorage is the record;   */
/*  the dataset is the thing components read.                           */
/* ------------------------------------------------------------------ */

function setPerfMode(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.perf = on ? "on" : "off";
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable (private mode, or blocked) */
  }
  window.dispatchEvent(new Event("perf-mode-change"));
}

function subscribePerf(cb: () => void) {
  window.addEventListener("perf-mode-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("perf-mode-change", cb);
    window.removeEventListener("storage", cb);
  };
}

const readPerf = () => document.documentElement.dataset.perf === "on";

function usePerfMode(): boolean {
  // useSyncExternalStore, not useState + useEffect: the server has no dataset
  // to read, so it renders the `false` snapshot, and React swaps to the real
  // one after hydration without us hand-rolling a `mounted` flag.
  return React.useSyncExternalStore(subscribePerf, readPerf, () => false);
}

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const readMotion = () => window.matchMedia(MOTION_QUERY).matches;

/**
 * Skip animation when Performance mode is on OR the OS asks for reduced motion.
 *
 * Reads the media query directly rather than pulling framer-motion in for it,
 * which is the whole animation runtime imported into a settings page to answer
 * one boolean.
 */
export function useStaticMotion(): boolean {
  const perf = usePerfMode();
  const reduce = React.useSyncExternalStore(
    subscribeMotion,
    readMotion,
    () => false
  );
  return perf || reduce;
}

/**
 * `scrollIntoView` that obeys the same preference.
 *
 * This helper exists because `behavior: "smooth"` passed from JS beats the
 * `scroll-behavior: auto !important` that the reduced-motion block in
 * globals.css sets, so a scroll started from a click handler is the one piece
 * of motion on the site the stylesheet cannot switch off. Read imperatively
 * rather than through the hook: the answer that matters is the one at the
 * moment of the click, not the one captured at the last render.
 */
export function scrollToElement(
  el: Element | null | undefined,
  options: Omit<ScrollIntoViewOptions, "behavior"> = {}
) {
  if (!el) return;
  const still =
    typeof window !== "undefined" && (readPerf() || readMotion());
  el.scrollIntoView({ ...options, behavior: still ? "auto" : "smooth" });
}

/* ------------------------------------------------------------------ */
/*  The control                                                        */
/* ------------------------------------------------------------------ */

/**
 * The performance-mode switch, drawn as a slide in the margin of the settings
 * sheet. The state is written twice on purpose: the knob moves AND the mono
 * label reads `on` / `off`, so it survives being photocopied in greyscale and
 * does not depend on the reader seeing blue.
 */
export function PerfModeCard() {
  const on = usePerfMode();

  return (
    <section className="nb-box p-[var(--pad)]">
      <p className="nb-slug">settings / motion</p>
      <h3 className="mt-2">Motion and effects</h3>
      <p className="nb-sub mt-2">
        Card lifts and page transitions are small, but on an older laptop in the
        shop they still cost frames. Turning this on freezes the paper flat.
      </p>

      <div className="nb-hair mt-5 flex flex-wrap items-center justify-between gap-4 pt-4">
        <span className="min-w-0">
          <span className="block font-semibold">Performance mode</span>
          <span className="nb-hint mt-0.5 block">
            Also turns itself on when your device asks for reduced motion.
          </span>
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Performance mode"
          onClick={() => setPerfMode(!on)}
          className="inline-flex min-h-[var(--tap)] shrink-0 cursor-pointer items-center gap-2.5"
        >
          {/* The knob slides on `translate`, not on `left`. `left` is a layout
              property: every frame of the throw cost a layout, a paint and a
              composite, which is a peculiar thing for the Performance-mode
              switch itself to be doing. `translate` is composited on its own.

              The travel is exact rather than eyeballed. The track is 3.75rem
              wide with a 2px border and `box-sizing: border-box`, so its
              padding box is 56px; the knob is 20px and used to run from
              `left: 4px` to `left: calc(100% - 1.5rem)` = 32px. 28px of travel
              on a 20px box is 140%, and a percentage in `translate` resolves
              against the element's own size, so it stays right whatever the
              track is later set to.

              Both halves ride the shared hover timing, so the track colour and
              the knob arrive together instead of on two different curves. */}
          <span
            aria-hidden="true"
            className={cn(
              "nb-box-sm relative block h-8 w-[3.75rem]",
              "transition-[background-color] duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)]",
              on ? "bg-blue" : "bg-paper"
            )}
          >
            <span
              className={cn(
                "absolute left-1 top-1/2 block h-5 w-5 -translate-y-1/2 border-2 border-ink bg-card",
                "transition-[translate] duration-[var(--nb-t-hover)] ease-[var(--nb-ease-out)]",
                on ? "translate-x-[140%]" : "translate-x-0"
              )}
              style={{ borderRadius: "var(--hand-s)" }}
            />
          </span>
          <span className="nb-slug font-bold text-ink">{on ? "on" : "off"}</span>
        </button>
      </div>
    </section>
  );
}
