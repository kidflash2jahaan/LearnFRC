"use client";

import * as React from "react";

/**
 * The tick you draw when a page is done.
 *
 * The old burst threw neon squares in five colours, which is two problems at
 * once here: the binder owns six values and none of them are neon, and a
 * shower of shapes is decoration rather than feedback. This is the gesture a
 * student actually makes on a finished worksheet, so it is one ballpoint check
 * struck across the card plus a few short pen ticks thrown off the stroke.
 *
 * It runs on the Web Animations API rather than a motion library: the whole
 * thing is a handful of transforms fired once from an event, so it needs no
 * runtime, no re-render per frame and no spring.
 *
 * Motion rules it holds to: one shot, never a loop, triggered only by
 * something the reader just did, and completely absent under reduced motion
 * (nothing here carries information the card does not also say in words).
 */

/** Deterministic ticks, so the burst reads as drawn rather than as noise. */
const TICKS = [
  { x: -84, y: -46, rot: -28 },
  { x: -38, y: -74, rot: 14 },
  { x: 30, y: -78, rot: -9 },
  { x: 86, y: -40, rot: 33 },
  { x: -66, y: 22, rot: 41 },
  { x: 62, y: 30, rot: -37 },
  { x: 8, y: 46, rot: 6 },
  { x: -14, y: -100, rot: -18 },
];

export function Confetti({
  trigger,
  count = 6,
}: {
  /** Any change to this number fires the mark once. */
  trigger: number;
  /** How many pen ticks are thrown off the stroke. Clamped to the table. */
  count?: number;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const check = React.useRef<SVGPathElement>(null);

  React.useEffect(() => {
    if (trigger === 0) return;
    const host = root.current;
    if (!host) return;
    // Read the preference at fire time, not at mount: a reader can flip it in
    // the OS while the page is open, and this is the only chance to honour it.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    host.hidden = false;
    const animations: Animation[] = [];

    // The stroke draws itself, the way a pen does, then the whole mark fades.
    const path = check.current;
    if (path) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      animations.push(
        path.animate(
          [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
          { duration: 260, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" }
        )
      );
    }

    for (const el of Array.from(host.querySelectorAll<HTMLElement>("[data-tick]"))) {
      const x = Number(el.dataset.x);
      const y = Number(el.dataset.y);
      const rot = Number(el.dataset.rot);
      animations.push(
        el.animate(
          [
            { transform: `translate(0,0) rotate(${rot}deg) scaleX(0)`, opacity: 1 },
            { transform: `translate(${x}px,${y}px) rotate(${rot}deg) scaleX(1)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${x * 1.18}px,${y * 1.18}px) rotate(${rot}deg) scaleX(1)`, opacity: 0 },
          ],
          { duration: 620, delay: 140, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" }
        )
      );
    }

    const fade = host.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 240,
      delay: 660,
      fill: "both",
    });
    animations.push(fade);
    fade.finished
      .then(() => {
        host.hidden = true;
      })
      .catch(() => {
        /* cancelled by a re-fire or unmount, nothing to clean up */
      });

    return () => {
      for (const a of animations) a.cancel();
      host.hidden = true;
    };
  }, [trigger]);

  return (
    <div
      ref={root}
      hidden
      aria-hidden="true"
      // Centred on the card that fired it. z-10 keeps it over the card's own
      // inset hairline and under the page grain, which is at z-90.
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-0 w-0"
    >
      <svg
        viewBox="0 0 120 90"
        fill="none"
        className="absolute -left-[60px] -top-[45px] h-[90px] w-[120px]"
      >
        <path
          ref={check}
          d="M12 48 L44 76 L108 12"
          stroke="var(--blue)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {TICKS.slice(0, Math.max(0, Math.min(count, TICKS.length))).map((t, i) => (
        <span
          key={i}
          data-tick=""
          data-x={t.x}
          data-y={t.y}
          data-rot={t.rot}
          className="absolute block h-[3px] w-[14px] origin-left bg-blue"
        />
      ))}
    </div>
  );
}
