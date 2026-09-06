import { cn } from "@/lib/utils";

/**
 * The tally block at the top of the dashboard: the title block of a shop
 * drawing, printed once, in figures.
 *
 * WHAT IT REPLACED, and why none of it came back. This file used to draw three
 * animated SVG dials that spring-filled on load, inside a glass panel that
 * lifted under the cursor. Three problems with that on this page:
 *
 *  - A dial is an estimate. "Level 7, 40 XP to level 8" is a fact, and a
 *    learner reads the fact faster than they read an arc they have to judge by
 *    eye. The binder writes numbers down.
 *  - Six of those numbers used to live further down the page as six identical
 *    cards, which is the shape a reader skims past. Ruled into one block they
 *    read as a tally, which is what they are.
 *  - It was a Client Component holding framer-motion, a motion value, two
 *    animations and a `useEffect`, for a page a learner opens several times a
 *    day. Numbers on paper do not count themselves up while you look at them.
 *
 * Server Component. Nothing here reads a clock or a browser API, so the markup
 * the server sends is the final markup.
 */

type Reading = {
  /** The figure, already a real number from real data. */
  value: number;
  /** What it counts, in the mono caption under the rule. */
  label: string;
  /** Optional second line, e.g. the streak's XP multiplier. */
  note?: string;
};

export function ProgressLedger({
  level,
  levelPct,
  xpIntoLevel,
  xpToNext,
  nextLevel,
  xp,
  streak,
  xpMultiplier,
  lessonsCompleted,
  departmentsInProgress,
  departmentsCompleted,
  achievementsEarned,
  achievementsTotal,
  className,
}: {
  level: number;
  /** 0-100 through the current level. */
  levelPct: number;
  xpIntoLevel: number;
  xpToNext: number;
  nextLevel: number;
  xp: number;
  streak: number;
  /** e.g. "1.4", printed as the streak's XP multiplier. */
  xpMultiplier: string;
  lessonsCompleted: number;
  departmentsInProgress: number;
  departmentsCompleted: number;
  achievementsEarned: number;
  achievementsTotal: number;
  className?: string;
}) {
  const readings: Reading[] = [
    { value: lessonsCompleted, label: "lessons cleared" },
    { value: departmentsInProgress, label: "departments open" },
    { value: departmentsCompleted, label: "departments signed off" },
    {
      value: achievementsEarned,
      label: "badges earned",
      note: `of ${achievementsTotal}`,
    },
    {
      value: streak,
      label: streak === 1 ? "day running" : "days running",
      // The multiplier is the only reason the streak is worth printing, so it
      // is printed with it rather than hidden in a tooltip.
      note: streak > 1 ? `${xpMultiplier}x xp` : undefined,
    },
    { value: xp, label: "xp banked" },
  ];

  return (
    // The grid splits at 861px because that is the pixel where `.nb-panel`
    // turns its dividing rule from vertical to horizontal. Split anywhere else
    // and the rule ends up on the wrong edge of the cell.
    <section
      aria-labelledby="ledger-heading"
      className={cn("nb-box grid grid-cols-1 min-[861px]:grid-cols-[minmax(0,0.82fr)_minmax(0,1.5fr)]", className)}
    >
      {/* ---- Level, and the distance to the next one ---- */}
      <div className="nb-panel p-[clamp(1.05rem,2.4vw,1.7rem)]">
        <h2 id="ledger-heading" className="nb-slug">
          level
        </h2>

        <p className="mt-1 font-mono text-[clamp(2.6rem,1.9rem+2.4vw,3.6rem)] font-bold leading-none tabular-nums text-blue">
          {level}
        </p>

        <span className="nb-meter mt-4 block">
          <span className="nb-meter-bar" style={{ width: `${levelPct}%` }} />
        </span>

        {/* The figure is printed beside the trough, always. A bar alone is one
            colour against one colour, so a reader who cannot judge that ratio
            by eye gets nothing out of it. */}
        <p className="nb-slug mt-2">
          {xpIntoLevel} / 100 xp
        </p>
        <p className="mt-2 text-[0.92rem] leading-snug text-graphite">
          <b className="font-bold text-ink">{xpToNext} XP</b> to level{" "}
          {nextLevel}.
        </p>
      </div>

      {/* ---- Everything else this account has on file ---- */}
      <div className="nb-panel p-[clamp(1.05rem,2.4vw,1.7rem)]">
        <p className="nb-slug">the tally</p>

        <dl className="mt-3 grid grid-cols-2 gap-x-[clamp(0.9rem,2.4vw,2rem)] gap-y-[clamp(0.8rem,1.8vw,1.15rem)] min-[520px]:grid-cols-3">
          {readings.map((r) => (
            <div key={r.label} className="border-t-2 border-ink pt-2">
              <dd className="nb-count">{r.value.toLocaleString()}</dd>
              {/* The note goes inside the <dt>, not beside it: a <dl>'s
                  grouping <div> may hold only <dt> and <dd>, and a loose <p>
                  breaks the term/description pairing. A block <span> renders
                  identically to the <p> it was. */}
              <dt className="nb-slug mt-1">
                {r.label}
                {r.note && <span className="block">{r.note}</span>}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
