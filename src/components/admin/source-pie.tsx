/**
 * Where the traffic came from, drawn as a measured band.
 *
 * WHY THIS IS NOT A PIE ANY MORE (the file keeps its name, the chart does not)
 * ---------------------------------------------------------------------------
 * The old chart was a twelve-colour donut. It needed a hue per source to say
 * which slice was which, and this palette has exactly one accent: a donut here
 * would either be twelve shades of the same blue, which is a magnitude scale
 * pressed into service as an identity scale and unreadable, or it would import
 * a second visual language. So the form changed with the system.
 *
 * What replaced it is what you would actually draw in the notebook: one band,
 * ruled off at each share, filled with a different pen hatch per source, and a
 * legend underneath carrying the same hatch, the count and the percentage.
 * Identity is carried by the hatch AND by the printed name, never by fill
 * alone, so it survives greyscale, photocopying and colour blindness. The band
 * is decoration for the legend: every number a reader needs is printed.
 *
 * Server Component. It holds no state and nothing in it animates.
 */

/**
 * Six pen fills, assigned in rank order and cycled. Blue at full strength in
 * every one of them: varying the opacity would be a light-to-dark ramp, which
 * reads as "more" and would tell the reader that Reddit is a bigger version of
 * Google rather than a different thing.
 */
const FILLS: string[] = [
  "var(--blue)",
  "repeating-linear-gradient(45deg, var(--blue) 0 3px, var(--card) 3px 6px)",
  "repeating-linear-gradient(135deg, var(--blue) 0 3px, var(--card) 3px 6px)",
  "repeating-linear-gradient(45deg, var(--blue) 0 2px, var(--card) 2px 7px)",
  "repeating-linear-gradient(0deg, var(--blue) 0 2px, var(--card) 2px 7px)",
  "repeating-linear-gradient(90deg, var(--blue) 0 2px, var(--card) 2px 7px)",
];
/** The tail bucket. Deliberately the faintest hatch: it is a remainder, not a source. */
const TAIL_FILL =
  "repeating-linear-gradient(45deg, var(--blue) 0 1px, var(--card) 1px 6px)";

/** Legend rows shown before the tail collapses into one "+N more" line. */
const MAX_ROWS = 10;

/**
 * Locale-independent thousands separators. This renders inside a client tree
 * (the toggles above it own state), so it is server-rendered and then
 * hydrated, and `toLocaleString` can disagree between the Node ICU build and
 * the browser's. A hydration mismatch on a figure is worse than a comma.
 */
function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function SourceChart({
  data,
  /** What is being counted, printed under the total. */
  noun,
  /**
   * The real total, when the rows CANNOT be summed to get one.
   *
   * Signups have exactly one source each, so adding those rows is right. A
   * visitor does not: someone who arrives direct on Monday and from Google on
   * Friday is one visitor but appears in both rows. Adding them gave 10,637
   * against a true 8,937, a 19% overcount presented as a headline figure.
   *
   * Row shares still divide by the row sum, which is the correct denominator
   * for "share of attributed traffic". Only the headline changes.
   */
  authoritativeTotal,
}: {
  data: { name: string; count: number }[];
  noun: string;
  authoritativeTotal?: number;
}) {
  const rowSum = data.reduce((s, d) => s + d.count, 0) || 1;
  const total = authoritativeTotal ?? rowSum;
  const overlaps = authoritativeTotal != null && rowSum > authoritativeTotal;

  const segs = data.map((d, i) => ({
    ...d,
    pct: (d.count / rowSum) * 100,
    fill: FILLS[i % FILLS.length],
  }));

  const visible = segs.slice(0, MAX_ROWS);
  const hidden = segs.slice(MAX_ROWS);
  const hiddenCount = hidden.reduce((s, d) => s + d.count, 0);
  // The band draws exactly what the legend lists: the ten named sources plus
  // one remainder segment. Drawing all twelve while listing ten would leave two
  // slivers on the band that a reader cannot look up anywhere.
  const bandSegs =
    hidden.length > 0
      ? [
          ...visible,
          {
            name: `${hidden.length} more`,
            count: hiddenCount,
            pct: (hiddenCount / rowSum) * 100,
            fill: TAIL_FILL,
          },
        ]
      : visible;

  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <b className="font-mono text-[clamp(1.7rem,1.2rem+1.4vw,2.3rem)] leading-none font-bold tabular-nums text-blue">
          {fmt(total)}
        </b>
        <span className="nb-slug">{noun} attributed</span>
      </p>

      {overlaps ? (
        <p className="mt-1 text-[0.78rem] leading-snug text-graphite">
          Rows below add up to more than this. One person can arrive from two
          sources in the same period and is counted under each, so the shares
          are honest but their sum is not a headcount.
        </p>
      ) : null}

      {/* The band. Decoration for the legend below, so it is hidden from the
          accessibility tree rather than given a label that would read out the
          same twelve numbers twice. */}
      <div
        aria-hidden="true"
        className="nb-box-sm mt-4 flex h-9 overflow-hidden"
      >
        {bandSegs.map((s, i) => (
          <span
            key={s.name}
            className={i > 0 ? "border-l-2 border-ink" : undefined}
            style={{ width: `${s.pct}%`, background: s.fill }}
          />
        ))}
      </div>

      <ol className="mt-4 min-w-0">
        {visible.map((s) => (
          <li
            key={s.name}
            className="nb-hair flex items-baseline gap-2 py-2 first:border-t-0 first:pt-0"
          >
            <span
              aria-hidden="true"
              className="h-[0.7rem] w-[1.1rem] shrink-0 self-center border-2 border-ink"
              style={{ background: s.fill }}
            />
            <span className="min-w-0 truncate text-[0.95rem]" title={s.name}>
              {s.name}
            </span>
            {/* The dotted leader that runs a name across to its figure on any
                ruled sheet. Purely typographic, so it is hidden from the
                accessibility tree. */}
            <span
              aria-hidden="true"
              className="min-w-[1.5rem] flex-1 translate-y-[-0.3em] border-b border-dotted border-rule"
            />
            <span className="shrink-0 font-mono text-[0.85rem] tabular-nums text-graphite">
              {fmt(s.count)}
            </span>
            <span className="w-[3.6ch] shrink-0 text-right font-mono text-[0.95rem] font-bold tabular-nums text-blue">
              {Math.round(s.pct)}%
            </span>
          </li>
        ))}
      </ol>

      {hidden.length > 0 ? (
        <p className="nb-slug mt-2">
          {hidden.length} more {hidden.length === 1 ? "source" : "sources"},{" "}
          {fmt(hiddenCount)} between them
        </p>
      ) : null}
    </div>
  );
}
