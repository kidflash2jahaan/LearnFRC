import { cn } from "@/lib/utils";

/**
 * The five-lesson week dial.
 *
 * One segment per lesson in the goal, so the ZERO state reads as "five to go"
 * rather than a gauge sitting at 0% — a new learner sees a shape to fill, not
 * a monument to having done nothing. (The dashboard's existing stat grid shows
 * six counters at 0 to every brand-new account; this is the opposite of that.)
 *
 * Server Component on purpose. It is pure SVG with no clock, no hook and no
 * client state, so the markup the server sends IS the final markup — there is
 * nothing for hydration to disagree about. Motion, if wanted, belongs on the
 * wrapper at the insertion site (`<Reveal>` / `<Hover>`), which is timing-only.
 *
 * No SVG `<defs>`/gradient ids are used: two of these can appear on one page
 * (e.g. a week dial and a department dial) and duplicated element ids would
 * make the second one render wrong. The gradient is faked by interpolating the
 * two stops per segment, which is deterministic and id-free.
 */

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/** Linear blend between two hex colors. t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const f = Math.max(0, Math.min(1, t));
  return `rgb(${clampByte(r1 + (r2 - r1) * f)}, ${clampByte(
    g1 + (g2 - g1) * f
  )}, ${clampByte(b1 + (b2 - b1) * f)})`;
}

export function WeekRing({
  count,
  goal,
  size = 132,
  stroke = 12,
  from = "#2560e6",
  to = "#1aa9d6",
  label,
  className,
}: {
  /** Lessons completed in the window. Values above `goal` still fill the ring. */
  count: number;
  goal: number;
  size?: number;
  stroke?: number;
  /** Gradient start / end for the filled segments. */
  from?: string;
  to?: string;
  /** Caption under the big number, e.g. "this week". */
  label?: string;
  className?: string;
}) {
  const safeGoal = Math.max(1, Math.floor(goal));
  const filled = Math.max(0, Math.min(safeGoal, Math.floor(count)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const slice = c / safeGoal;
  // Leave a visible gap between segments; shrink it if the goal ever gets big
  // enough that a fixed gap would eat the segment.
  const gap = Math.min(slice * 0.34, stroke * 1.15);
  const segLen = Math.max(1, slice - gap);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        focusable="false"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {Array.from({ length: safeGoal }, (_, i) => {
            const done = i < filled;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${segLen} ${Math.max(0, c - segLen)}`}
                strokeDashoffset={-i * slice}
                stroke={
                  done
                    ? mix(from, to, safeGoal === 1 ? 0 : i / (safeGoal - 1))
                    : "rgba(120,145,190,0.22)"
                }
              />
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-3xl font-extrabold leading-none tabular-nums text-foreground">
          {filled}
          <span className="text-foreground/45">/{safeGoal}</span>
        </span>
        {label && (
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
