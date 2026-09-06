import { clampPct } from "@/lib/utils";

/**
 * The tally inside a drawer: top lessons, top departments, top teams, top
 * recruiters, article views, achievements, and the activation funnel.
 *
 * A row is a name, a figure and, where the comparison is the point, a gauge.
 * The gauge is `.nb-meter`, which prints an ink trough with a blue fill and is
 * never allowed to be the only way to read the number: the figure sits beside
 * it, always, so the list still works printed in greyscale or read aloud.
 *
 * The old version drew each bar as a two-stop gradient from a per-list accent
 * into the brand blue. There is one accent in this system and gradients are not
 * part of it, so the accent prop is gone rather than remapped.
 *
 * Server Components, both of them. They were client-only to run an entrance
 * stagger and a spring counter, and this system has neither: a number written
 * on a page is already written.
 */

export type MiniRow = {
  /** Main text. Truncates; the full string stays available via `title`. */
  label: string;
  /** Secondary text rendered after the label in the mono hand. */
  sub?: string;
  /** Right-aligned number. */
  value: number;
  valueSuffix?: string;
  /** 0 to 100. When present, a gauge is drawn under the row. */
  pct?: number;
};

function Row({ row }: { row: MiniRow }) {
  const pct = row.pct == null ? null : clampPct(row.pct);

  return (
    <li className="nb-hair py-2.5 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[0.95rem] leading-snug" title={row.label}>
          {row.label}
          {row.sub ? <span className="nb-slug ml-2">{row.sub}</span> : null}
        </span>
        <span className="shrink-0 font-mono text-[0.95rem] font-bold tabular-nums text-blue">
          {row.value.toLocaleString()}
          {row.valueSuffix ?? ""}
        </span>
      </div>

      {pct !== null ? (
        // aria-hidden: the figure above already carries the value, and a
        // progressbar role on every row of a twelve-row list is noise.
        <span aria-hidden className="nb-meter mt-2 block h-[0.6rem]">
          <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </li>
  );
}

export function MiniList({
  rows,
  empty,
}: {
  rows: MiniRow[];
  empty?: string;
}): React.JSX.Element {
  if (rows.length === 0) {
    return <p className="nb-slug py-2">{empty ?? "Nothing recorded yet."}</p>;
  }

  return (
    <ul className="min-w-0">
      {rows.map((row, i) => (
        <Row key={`${i}-${row.label}`} row={row} />
      ))}
    </ul>
  );
}

/**
 * Two related tallies sharing one drawer: side by side from 640px, stacked
 * below it. Each half is a labelled region, so a screen reader says which list
 * it is in rather than reading twenty numbers in a row.
 */
export function MiniListPair({
  left,
  right,
}: {
  left: { title: string; rows: MiniRow[]; empty?: string };
  right: { title: string; rows: MiniRow[]; empty?: string };
}): React.JSX.Element {
  return (
    <div className="grid min-w-0 gap-x-8 gap-y-6 sm:grid-cols-2">
      {[left, right].map((col) => (
        <section key={col.title} aria-label={col.title} className="min-w-0">
          <p className="nb-slug mb-2.5 border-b border-dashed border-rule pb-2">
            {col.title}
          </p>
          <MiniList rows={col.rows} empty={col.empty} />
        </section>
      ))}
    </div>
  );
}
