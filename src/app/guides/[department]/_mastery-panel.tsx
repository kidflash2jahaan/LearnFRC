/**
 * Shared geometry for the four cells of the department title block.
 *
 * These live here, on the leaf, because the block is assembled in the page (a
 * Server Component) but one of its cells is a client island, and a constant is
 * the only thing the two can share without dragging the page's server imports
 * into the client bundle. The page's `loading.tsx` reads them too, so the
 * placeholder cannot drift out of alignment with the real block.
 */

/** One cell's padding. Identical on all four, or the dividing rules step. */
export const TITLE_BLOCK_PAD = "p-[clamp(0.95rem,2.6vw,2.1rem)]";

/**
 * The three catalogue cells. On one column each is a `label .... figure` line;
 * from 861px, where `.nb-panel` turns its dividing rule vertical, each becomes
 * a label-over-figure stack.
 *
 * `min-[861px]:justify-start` is the load-bearing part. `justify-between` is
 * right for the row and wrong for the column, where it pushed each figure to
 * the bottom of the panel while the mastery cell stacked from the top, so no
 * two figures in the block sat on the same line.
 *
 * The flex gap is zeroed in the column layout so it cannot contribute to the
 * label-to-figure distance. That distance belongs to `TITLE_BLOCK_FIGURE`
 * alone, for the reason written on it.
 */
export const TITLE_BLOCK_CELL = [
  "nb-panel flex-row items-baseline justify-between gap-3",
  TITLE_BLOCK_PAD,
  "min-[861px]:flex-col min-[861px]:items-start min-[861px]:justify-start",
  "min-[861px]:gap-0",
].join(" ");

/**
 * The figure itself. `nb-count` sets the face, the numerals and the blue; the
 * override only makes it big enough to anchor a four-up block.
 *
 * It also carries the WHOLE distance from the label above it, because that is
 * the only way the four figures land on one line. The catalogue cells and the
 * mastery cell need different flex gaps (a row gap and a column gap
 * respectively), so a shared cell gap plus a nudge here measured 16px in one
 * and 4px in the other, and the mastery figure sat 12px high in a block whose
 * whole job is to print four figures on one rule. Both cells zero their gap in
 * the column layout and take this instead.
 */
export const TITLE_BLOCK_FIGURE =
  "nb-count text-[clamp(1.5rem,1.1rem+1.1vw,2.1rem)] min-[861px]:mt-4";

/**
 * The mastery cell of the title block.
 *
 * The old version was a glass instrument with a spring-drawn SVG ring and a
 * green dot pulsing next to the word "Live". None of that is true here: nothing
 * on this page is live, a perfect circle is not a shape this system draws, and
 * a ring is unreadable as a figure anyway. Progress in the binder is `nb-meter`,
 * an ink trough with a blue fill, and the rule that comes with it is that the
 * number is always printed beside the bar rather than encoded in its length.
 *
 * The percentage is the same one the module list and the CTA read, so a reader
 * never sees two different answers to "how far in am I".
 *
 * No hooks and no state: it renders what the island hands it. It has no
 * "use client" of its own because it does not need one, and it still ends up in
 * the client bundle by virtue of who imports it.
 */
export function MasteryPanel({
  pct,
  doneCount,
  totalLessons,
  tracked,
}: {
  pct: number;
  doneCount: number;
  totalLessons: number;
  /** True once there is progress to show, from an account or from this browser. */
  tracked: boolean;
}) {
  const safe = Math.min(100, Math.max(0, pct));
  const complete = tracked && totalLessons > 0 && doneCount >= totalLessons;

  return (
    // A column at every width, unlike its three neighbours: it has a meter and
    // a line of prose under the figure, and those do not belong on one line.
    // The gap goes to zero where the block runs as columns, so this cell takes
    // its label-to-figure distance from `TITLE_BLOCK_FIGURE` like the other
    // three and its figure sits on the same line as theirs.
    <div className={`nb-panel gap-1 min-[861px]:gap-0 ${TITLE_BLOCK_PAD}`}>
      <p className="nb-slug">mastered</p>

      <p className={TITLE_BLOCK_FIGURE}>
        {safe}
        <small>per cent</small>
      </p>

      <span className="nb-meter mt-2 block" aria-hidden="true">
        <span className="nb-meter-bar" style={{ width: `${safe}%` }} />
      </span>

      <p className="nb-hint mt-2">
        {!tracked
          ? "reading is free, no account needed"
          : complete
            ? "finished, certificate unlocked"
            : `${doneCount} of ${totalLessons} lessons done`}
      </p>
    </div>
  );
}
