"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { RevealGroup, RevealItem } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import { clampPct } from "@/lib/utils";

/**
 * MiniList — the compact leaderboard used INSIDE the collapsed dropdown panels
 * on /admin (top lessons, top departments, newest members, recent completions,
 * top recruiters).
 *
 * Contract notes:
 *  - Layout is Tailwind-only. Nothing here leans on the ac-* kit for position,
 *    display or spacing — the kit is skin, and these lists sit inside a panel
 *    that already carries the card skin.
 *  - Hydration-safe: the tree and the text are identical on server and client.
 *    The bar renders at its FINAL width on first paint (so it is correct with
 *    JS off and never mismatches); `transition-[width]` only animates later
 *    value changes, and `motion-reduce:transition-none` opts out in CSS rather
 *    than by branching in JS.
 *  - Self-contained motion: MiniList brings its OWN RevealGroup, so rows
 *    stagger correctly whether or not the caller is already a reveal group.
 */

export type MiniRow = {
  /** Main text. Truncates; the full string stays available via `title`. */
  label: string;
  /** Secondary text rendered after the label in muted colour. */
  sub?: string;
  /** Right-aligned number. */
  value: number;
  valueSuffix?: string;
  /** 0–100. When present, a hairline progress bar is drawn under the row. */
  pct?: number;
};

/** Repo arena-blue. Used as the gradient's left stop when no accent is given. */
const DEFAULT_ACCENT = "#2560e6";

function Row({ row, accent }: { row: MiniRow; accent: string }) {
  const pct = row.pct == null ? null : clampPct(row.pct);

  return (
    <RevealItem className="py-1.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] leading-snug" title={row.label}>
          {row.label}
          {row.sub ? (
            <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
              {row.sub}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums leading-snug text-primary">
          <AnimatedCounter value={row.value} suffix={row.valueSuffix ?? ""} />
        </span>
      </div>

      {pct !== null ? (
        <div
          aria-hidden
          className="mt-1 h-[1.5px] w-full overflow-hidden rounded-full bg-border"
        >
          <span
            className="block h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={
              {
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${accent}, var(--primary))`,
              } as CSSProperties
            }
          />
        </div>
      ) : null}
    </RevealItem>
  );
}

export function MiniList({
  rows,
  empty,
  accent,
}: {
  rows: MiniRow[];
  empty?: string;
  accent?: string;
}): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="py-1.5 text-[13px] text-muted-foreground">{empty ?? "Nothing yet."}</p>
    );
  }

  const a = accent ?? DEFAULT_ACCENT;

  return (
    // Padding lives on the rows (RevealItem), never as a gap — a gap here would
    // fight the divider rhythm and the reveal offset.
    <RevealGroup className="flex min-w-0 flex-col divide-y divide-border/50" stagger={0.035}>
      {rows.map((row, i) => (
        <Row key={`${i}-${row.label}`} row={row} accent={a} />
      ))}
    </RevealGroup>
  );
}

/**
 * Two related MiniLists sharing one dropdown panel: side by side at sm+,
 * stacked at 375px. Each half is a labelled region so screen readers announce
 * which list they are in.
 */
export function MiniListPair({
  left,
  right,
}: {
  left: { title: string; rows: MiniRow[]; accent?: string; empty?: string };
  right: { title: string; rows: MiniRow[]; accent?: string; empty?: string };
}): React.JSX.Element {
  const baseId = React.useId();

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {[left, right].map((col, i) => {
        const headingId = `${baseId}-${i}`;
        return (
          <section key={headingId} aria-labelledby={headingId} className="min-w-0">
            <h4
              id={headingId}
              className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {col.title}
            </h4>
            <MiniList rows={col.rows} accent={col.accent} empty={col.empty} />
          </section>
        );
      })}
    </div>
  );
}
