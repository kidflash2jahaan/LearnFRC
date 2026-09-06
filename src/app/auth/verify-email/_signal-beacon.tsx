/**
 * The postmark: a sealed envelope with its cancellation bars, drawn in two
 * strokes.
 *
 * What was here before was a mail badge broadcasting pulsing rings forever,
 * with a checkmark that sprang in on a spring. Three problems with that. It
 * looped, and nothing in this system loops or breathes while you are reading.
 * It claimed something untrue, because the tick landed on a timer whether or
 * not the address was real. And it cost a client component and a motion
 * library to say one word the heading already said.
 *
 * So it is a drawing now, and a Server Component: no state, no motion, no
 * hydration, stroked in `currentColor` so it takes the ink of whatever surface
 * it is set on. The line coordinates are deliberately a fraction off square,
 * because a rectangle drawn with a ruler reads as machined and a binder is
 * drawn freehand.
 *
 * The filename is unchanged so the route folder keeps one private component
 * per concern; only the thing it draws is different.
 */
export function Postmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 104 70"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* the envelope, sitting a degree or two off true */}
      <path d="M3.5 9.5 L99.5 4.5 L101 60 L5 65.5 Z" />
      {/* the flap, creased down the middle */}
      <path d="M4 10 L52.5 41 L99.5 5" />
      {/* cancellation bars, the mark a sorting office leaves behind */}
      <path d="M63 50.5 h30 M61.5 56 h31 M64.5 61 h27" strokeWidth={2} opacity={0.55} />
    </svg>
  );
}
