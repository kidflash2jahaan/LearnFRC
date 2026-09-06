/**
 * A figure in the binder.
 *
 * It used to spring from zero up to its value on every scroll into view. A
 * number written on a page is already written: it does not count itself up
 * while you look at it, and the site prints these in stat cards, department
 * counts and result tallies that a reader passes dozens of times a session,
 * which is exactly the frequency at which an entrance animation turns into a
 * delay. So the number renders, once, in Space Mono with tabular figures so a
 * column of them lines up and nothing shifts when one of them changes.
 *
 * The name is kept because roughly fifty call sites use it. What it lost was
 * `"use client"`, `useInView`, a motion value, a spring and two effects: this
 * is a Server Component now, and every page that only reached for the client
 * runtime to animate a number gets that bundle back.
 */
export function AnimatedCounter({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
