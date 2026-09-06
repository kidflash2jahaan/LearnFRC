"use client";

import * as React from "react";

/**
 * A drawer in the binder: a section divider you flip open to read what is
 * filed behind it.
 *
 * The old shell was a rounded card with a tinted icon chip in a per-panel hue,
 * resolved from a Lucide name passed down as a string. Both are gone. This
 * system has one accent and no icon set, and a thing is identified by its name
 * and its mono slug, so that is what the header prints. What is left is a 2px
 * ink rule, the title, and the state, written out.
 *
 * Three things here are load-bearing and should not be "simplified":
 *
 *  1. LAZY MOUNT, THEN KEEP MOUNTED. Children are not rendered until the drawer
 *     has been opened once (`hasOpened`), because one child is a chart that
 *     measures its container with a ResizeObserver and would latch onto a
 *     zero-height box if mounted while collapsed. After the first open the
 *     children stay mounted, so re-opening is instant and the chart never
 *     re-measures from scratch.
 *  2. The collapse is the CSS grid 0fr to 1fr trick over an overflow-hidden
 *     inner div: deterministic, no measurement, no hydration branch, and the
 *     content stays in the DOM (so the chart keeps its size and `inert` can
 *     handle tab order instead of unmounting).
 *  3. `inert={!open}` keeps collapsed content out of the tab order and the
 *     accessibility tree without removing it from the document.
 *
 * The state is a WORD as well as a rotated chevron. This page gets printed and
 * screenshotted, and a rotation is not a state you can read in a screenshot of
 * a closed drawer sitting next to an open one.
 */
export function CollapsiblePanel({
  title,
  slug,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** The mono identifier printed above the title, e.g. `drawer / growth`. */
  slug: string;
  /** A short mono chip: a count, a window, the worst drop. Kept short: it must not wrap. */
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(defaultOpen);
  // Mount-once latch. Seeded from the same prop the server rendered with, so
  // the SSR and first-client trees are identical.
  const [hasOpened, setHasOpened] = React.useState(defaultOpen);

  // useId is SSR-stable; strip React's delimiters so the value is a clean,
  // query-selector-safe id for aria-controls.
  const panelId = `admin-drawer-${React.useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  const toggle = React.useCallback(() => {
    setOpen((prev) => !prev);
    setHasOpened(true); // idempotent; closing implies it was already true
  }, []);

  return (
    <section className="nb-rule" data-state={open ? "open" : "closed"}>
      {/* A real heading, so a screen reader can jump drawer to drawer rather
          than walking the whole page. */}
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-1 py-4 text-left transition-[background-color] duration-100 hover:bg-[rgba(27,54,200,0.055)]"
        >
          <span className="nb-slug col-start-1 row-start-1">{slug}</span>

          {/* Title and badge share a wrapping row: at 375px a long title takes
              the line and the badge drops under it, rather than shoving the
              control off the page. `min-w-0` on both, because a flex item's
              automatic minimum is its longest word and `break-words` does not
              lower it. */}
          <span className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="min-w-0 font-display text-[1.12rem] font-extrabold leading-tight tracking-[-0.02em] break-words">
              {title}
            </span>
            {badge ? <span className="nb-tag">{badge}</span> : null}
          </span>

          {/* Hidden from the accessibility tree, both of them: `aria-expanded`
              already announces the state, and a closed drawer whose visible
              word is the ACTION ("open") would otherwise be read out as
              "collapsed, open", which is a contradiction. */}
          <span
            aria-hidden="true"
            className="col-start-2 row-span-2 row-start-1 flex shrink-0 items-center gap-2"
          >
            <span className="nb-slug">{open ? "close" : "open"}</span>
            {/* Drawn in ink at the same 2px weight as every rule on the page. */}
            <svg
              width="15"
              height="10"
              viewBox="0 0 14 9"
              aria-hidden="true"
              focusable="false"
              className={`transition-transform duration-[180ms] ease-[var(--step)] motion-reduce:transition-none ${
                open ? "rotate-180" : ""
              }`}
            >
              <path
                d="M1 1.4 7 7.6 13 1.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>
      </h2>

      <div
        id={panelId}
        role="region"
        aria-label={title}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--step)] motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          {/* Padding lives INSIDE the collapsing box, so a closed drawer is a
              clean single header row with no leftover gap under it. */}
          <div className="px-1 pt-1 pb-6">{hasOpened ? children : null}</div>
        </div>
      </div>
    </section>
  );
}
