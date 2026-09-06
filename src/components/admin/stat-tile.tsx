/**
 * The tally sheet: the standing totals, ruled off in columns.
 *
 * WHY THIS IS NOT A GRID OF TILES
 * -------------------------------
 * The old version rendered seventeen tinted cards, each washed in its own hue,
 * six across. That needed eight accent colours to tell the tiles apart, and the
 * notebook has one accent. It also made every number look equally important,
 * which is the opposite of what an operator needs: three of those seventeen are
 * things you act on today, four are the size of the whole project, and the rest
 * are standing totals you read in a column.
 *
 * So the numbers were split by the job they do. The ones you act on sit in the
 * taped card at the top of /admin, the four that say how far the thing has got
 * are stamped on the blue slab, and everything else is here: a ledger page,
 * ruled into three panels, one line per reading. Figures are Space Mono with
 * tabular numerals so a column of them lines up and nothing shifts when one of
 * them changes overnight.
 *
 * Server Components. Nothing here holds state, so nothing here ships JS.
 */

/* ------------------------------------------------------------------ */
/*  StatSheet                                                          */
/* ------------------------------------------------------------------ */

/**
 * The ruled page the columns sit on. One hand-drawn box divided by the 2px ink
 * rule that `.nb-panel` turns horizontal under 860px, so the grid has to turn
 * over on the same pixel: 861px, not a named breakpoint. Get that wrong and one
 * layout draws a left rule where it needs a top one.
 */
export function StatSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="nb-box grid grid-cols-1 min-[861px]:grid-cols-3">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatColumn                                                         */
/* ------------------------------------------------------------------ */

/**
 * One panel of the sheet, headed by its mono slug. A column is a group of
 * readings that are about the same thing, which is the only grouping this page
 * has: departments and sections carry no colour in this system, they carry a
 * name and a slug.
 */
export function StatColumn({
  slug,
  children,
}: {
  /** The identifier printed above the column, e.g. `tally / reach`. */
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={slug} className="nb-panel">
      <p className="nb-slug">{slug}</p>
      {/* A description list, because that is what this is: a term and the
          figure measured against it. The rows carry their own rules, so the
          list itself adds no spacing of its own. */}
      <dl className="mt-3">{children}</dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat                                                               */
/* ------------------------------------------------------------------ */

export type StatProps = {
  label: string;
  value: number;
  /** Printed hard against the figure, for a percentage. */
  suffix?: string;
  /** The quiet mono line under the label: what the figure covers, or how it splits. */
  hint?: string;
};

/**
 * One reading. Label and its qualifier on the left, figure on the right.
 *
 * `min-w-0` on the label side is load-bearing: a grid item's automatic minimum
 * size is its longest unbreakable word, so without it a long hint refuses to
 * wrap and pushes the figure off a 375px screen.
 *
 * The figure is never the only thing that says what it is. `title` carries the
 * full unrounded value for a hover, and the suffix rides inside the figure
 * rather than in the unit slot, because "62" and "%" are one number.
 */
export function Stat({ label, value, suffix, hint }: StatProps) {
  const printed = `${value.toLocaleString()}${suffix ?? ""}`;

  return (
    <div className="nb-hair flex items-baseline justify-between gap-3 py-2.5 first:border-t-0 first:pt-0">
      <dt className="min-w-0">
        <span className="block text-[0.95rem] leading-snug">{label}</span>
        {hint ? <span className="nb-slug mt-1 block">{hint}</span> : null}
      </dt>
      <dd className="nb-count shrink-0" title={printed}>
        {printed}
      </dd>
    </div>
  );
}
