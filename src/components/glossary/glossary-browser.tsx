"use client";

import * as React from "react";
import Link from "next/link";
import { glossarySlug, type GlossaryTerm } from "@/lib/glossary-data";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const TILT = ["nb-tilt-1", "nb-tilt-2", "nb-tilt-3", "nb-tilt-4"] as const;

/**
 * The card catalogue: every term in FRC, filed once.
 *
 * What changed, and why:
 *
 *  - Nine categories used to each get their own colour, which meant nine hues
 *    the palette does not have, plus `inkFor()` doing contrast maths on them.
 *    A category is a mono slug on the card now. That is how everything else in
 *    this binder says what drawer it came from.
 *  - The grid was wrapped in a framer-motion LayoutGroup, so changing a filter
 *    made 400 cards spring into new positions. Filtering is a reader narrowing
 *    a list, not an animation; the list just becomes shorter.
 *  - Every filter is a real toggle with `aria-pressed`, and the selected state
 *    fills the chip in blue AND inverts its text, so it survives greyscale.
 *
 * Still a Client Component, because three filters and a search box are genuine
 * state. Nothing else in here is.
 */
export function GlossaryBrowser({
  terms,
  categories,
}: {
  terms: GlossaryTerm[];
  categories: readonly string[];
}) {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("All");
  const [activeLetter, setActiveLetter] = React.useState("All");
  const uid = React.useId();
  const searchId = `${uid}-search`;

  // Stable counts per starting letter (over the full set, not the filtered
  // one) so the alphabet rail doesn't jitter as other filters change.
  const letterCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of terms) {
      const l = (t.term[0] ?? "").toUpperCase();
      if (l) counts[l] = (counts[l] ?? 0) + 1;
    }
    return counts;
  }, [terms]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms
      .filter((t) => activeCategory === "All" || t.category === activeCategory)
      .filter(
        (t) => activeLetter === "All" || (t.term[0] ?? "").toUpperCase() === activeLetter
      )
      .filter(
        (t) =>
          !q ||
          t.term.toLowerCase().includes(q) ||
          (t.abbr ?? "").toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q)
      )
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, query, activeCategory, activeLetter]);

  const chips = ["All", ...categories];
  const hasFilters =
    query.trim() !== "" || activeCategory !== "All" || activeLetter !== "All";

  function clearFilters() {
    setQuery("");
    setActiveCategory("All");
    setActiveLetter("All");
  }

  return (
    <div>
      <div className="nb-field mx-auto max-w-xl">
        <label htmlFor={searchId} className="nb-label">
          Search the catalogue
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="a term, an acronym, or a phrase from a definition"
          className="nb-input"
        />
      </div>

      <fieldset className="mt-6 border-0 p-0">
        <legend className="nb-slug mb-2 w-full text-center">
          filter / category
        </legend>
        <div className="flex flex-wrap justify-center gap-2">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              aria-pressed={activeCategory === c}
              className="nb-tag min-h-[var(--tap)] cursor-pointer px-3"
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6 border-0 p-0">
        <legend className="nb-slug mb-2 w-full text-center">
          filter / first letter
        </legend>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveLetter("All")}
            aria-pressed={activeLetter === "All"}
            className="nb-tag min-h-[var(--tap)] cursor-pointer px-3 font-bold"
          >
            All
          </button>
          {LETTERS.map((letter) => {
            const count = letterCounts[letter] ?? 0;
            return (
              <button
                key={letter}
                type="button"
                disabled={count === 0}
                onClick={() => setActiveLetter(letter)}
                aria-pressed={activeLetter === letter}
                title={
                  count > 0
                    ? `${count} term${count === 1 ? "" : "s"}`
                    : "Nothing filed under this letter"
                }
                className={cn(
                  "nb-tag h-[var(--tap)] w-[var(--tap)] justify-center font-bold",
                  count === 0
                    ? "cursor-not-allowed border-rule text-graphite"
                    : "cursor-pointer"
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div
        className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        aria-live="polite"
      >
        <p className="nb-slug">
          <span className="text-[1.1rem] font-bold text-blue tabular-nums">
            {filtered.length}
          </span>{" "}
          {filtered.length === 1 ? "term" : "terms"} showing
        </p>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="nb-btn-ghost nb-btn-sm">
            Clear filters
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t, i) => (
            <li key={t.term} className="flex">
              <Link
                href={`/glossary/${glossarySlug(t.term)}`}
                className={cn(
                  "nb-box nb-lift group flex w-full flex-col p-[clamp(1rem,1.9vw,1.35rem)]",
                  TILT[i % TILT.length]
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="nb-slug min-w-0 truncate">{t.category}</p>
                  {t.abbr && t.abbr !== t.term && (
                    <span className="nb-tag shrink-0">{t.abbr}</span>
                  )}
                </div>

                <h3 className="mt-2.5">{t.term}</h3>

                <p className="mt-2 flex-1 text-[0.92rem] leading-snug text-graphite">
                  {t.definition}
                </p>

                {/* `border-b-transparent`, not `border-transparent`: the
                    latter would clear nb-hair's dashed top rule as well. */}
                <span className="nb-slug nb-hair mt-4 border-b-2 border-b-transparent pt-3 text-ink group-hover:border-b-blue group-hover:text-blue">
                  read the entry
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="nb-note mx-auto mt-9 max-w-md text-center">
          <p className="nb-slug">no match</p>
          <p className="mt-2 text-[0.95rem]">
            Nothing is filed under{" "}
            {query ? <>&ldquo;{query}&rdquo;</> : "those filters"}. Clear them
            and start again, or send it in as a term worth adding.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="nb-btn-ghost nb-btn-sm mt-4"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
