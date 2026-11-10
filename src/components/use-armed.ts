"use client";

import * as React from "react";

/**
 * How long a two-step confirm waits for its second click. Long enough to
 * read a two-line warning ("One more click bans ... It can't be undone.")
 * and move the mouse back.
 */
export const ARMED_MS = 10_000;

/** Spread on every element that belongs to one confirm. */
export type ArmedScope = { "data-armed-scope": string };

/**
 * A two-step confirm: the first click arms ("Remove" becomes "Yes, remove"
 * and a warning shows), the second acts. Every two-step confirm in the
 * classes pages, the room and the admin desks uses this, so they all behave
 * the same way.
 *
 * Armed stays armed until the person clicks somewhere else, presses Escape,
 * or ARMED_MS pass. Clicks count, not touches, so scrolling a phone to read
 * the warning doesn't disarm it, and a keyboard press of another button is a
 * click too.
 *
 * `scope` goes on the buttons that arm and on the warning line. A click
 * inside any of them leaves the state to the button's own handler (switching
 * from one armed Remove to another, say); a click anywhere else disarms.
 *
 * `off` is the unarmed value: `false` for one button, `null` for a set of
 * them keyed by what they do ("remove", "ban", "remove:<id>").
 */
export function useArmed<T>(off: T): readonly [T, (next: T) => void, ArmedScope] {
  const [armed, setArmed] = React.useState<T>(off);
  const id = React.useId();
  const isArmed = !Object.is(armed, off);

  React.useEffect(() => {
    if (!isArmed) return;
    const disarm = () => setArmed(off);
    const inside = (target: EventTarget | null) => {
      for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
        if (el.getAttribute("data-armed-scope") === id) return true;
      }
      return false;
    };
    const onClick = (e: MouseEvent) => {
      if (!inside(e.target)) disarm();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") disarm();
    };
    const timer = window.setTimeout(disarm, ARMED_MS);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
    // `armed` restarts the wait when the person arms a different button.
  }, [armed, isArmed, off, id]);

  const scope = React.useMemo<ArmedScope>(() => ({ "data-armed-scope": id }), [id]);
  return [armed, setArmed, scope] as const;
}
