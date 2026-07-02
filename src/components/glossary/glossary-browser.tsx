"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import {
  Search,
  ExternalLink,
  BookA,
  Info,
  Trophy,
  Code2,
  Zap,
  Cog,
  Radar,
  Award,
  LineChart,
  Users,
  X,
} from "lucide-react";
import type { GlossaryTerm } from "@/lib/glossary-data";
import { AnimatedCounter } from "@/components/animated-counter";
import { Hover } from "@/components/motion/primitives";
import { inkFor } from "@/lib/departments";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Category → icon + accent color. Colors are drawn from the site's approved
// accent set (see lib/departments.ts ACCENT_INK) so inkFor() always resolves
// a legible text color for them.
const CATEGORY_META: Record<string, { icon: typeof Info; color: string }> = {
  General: { icon: Info, color: "#22d3ee" },
  "Competition & Game": { icon: Trophy, color: "#ff8a3d" },
  Software: { icon: Code2, color: "#b16bff" },
  Electrical: { icon: Zap, color: "#ffe53d" },
  Mechanical: { icon: Cog, color: "#ff6b5d" },
  "Sensors & Controls": { icon: Radar, color: "#2dd4bf" },
  Awards: { icon: Award, color: "#ffd23d" },
  "Data & Scouting": { icon: LineChart, color: "#5dff9b" },
  Community: { icon: Users, color: "#ff5db1" },
};
const DEFAULT_CATEGORY_META = { icon: BookA, color: "#2560e6" };

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
  const hasFilters = query.trim() !== "" || activeCategory !== "All" || activeLetter !== "All";

  function clearFilters() {
    setQuery("");
    setActiveCategory("All");
    setActiveLetter("All");
  }

  return (
    <div>
      {/* search */}
      <div className="relative mx-auto max-w-xl">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms, acronyms, and definitions…"
          className="ac-input h-14 w-full pl-14 pr-5 text-base"
          aria-label="Search glossary"
        />
      </div>

      {/* category filters */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            aria-pressed={activeCategory === c}
            className={cn(
              "ac-chip inline-flex min-h-11 cursor-pointer items-center text-sm font-medium transition-all",
              activeCategory === c
                ? "border-primary/60 bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* alphabet rail — the signature browse moment */}
      <div className="mt-7">
        <p className="ac-eyebrow text-center">Jump to a letter</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveLetter("All")}
            aria-pressed={activeLetter === "All"}
            className={cn(
              "ac-chip inline-flex h-11 min-w-11 cursor-pointer items-center justify-center px-3 text-sm font-bold transition-all",
              activeLetter === "All"
                ? "border-primary/60 bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {LETTERS.map((letter) => {
            const count = letterCounts[letter] ?? 0;
            const active = activeLetter === letter;
            return (
              <Hover key={letter} lift={-2} scale={count > 0 ? 1.08 : 1}>
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => setActiveLetter(letter)}
                  aria-pressed={active}
                  title={count > 0 ? `${count} term${count === 1 ? "" : "s"}` : "No terms"}
                  className={cn(
                    "ac-chip flex h-11 w-11 items-center justify-center text-sm font-bold transition-all",
                    count === 0 && "cursor-not-allowed opacity-30",
                    count > 0 && !active && "cursor-pointer text-foreground/70 hover:text-foreground",
                    active && count > 0 && "border-primary/60 bg-primary/10 text-primary"
                  )}
                >
                  {letter}
                </button>
              </Hover>
            );
          })}
        </div>
      </div>

      {/* result count + clear */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <p className="text-center text-base text-muted-foreground">
          <AnimatedCounter value={filtered.length} className="font-semibold text-foreground" />{" "}
          {filtered.length === 1 ? "term" : "terms"}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-accent"
          >
            <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
          </button>
        )}
      </div>

      {/* grid */}
      <LayoutGroup>
        <motion.div layout className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((t) => {
              const meta = CATEGORY_META[t.category] ?? DEFAULT_CATEGORY_META;
              const CategoryIcon = meta.icon;
              return (
                <motion.div
                  key={t.term}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                >
                  <Hover className="h-full" lift={-4} scale={1.01}>
                    <div className="ac-card flex h-full flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
                          style={{ "--a": meta.color } as CSSProperties}
                        >
                          <CategoryIcon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        {t.abbr && t.abbr !== t.term && (
                          <span className="shrink-0 rounded-lg border border-border bg-background/60 px-2 py-0.5 font-mono text-[11px] font-medium text-accent">
                            {t.abbr}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 font-display text-lg font-bold leading-tight text-foreground">
                        {t.term}
                      </h3>
                      <span
                        className="mt-1 text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: inkFor(meta.color) }}
                      >
                        {t.category}
                      </span>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {t.definition}
                      </p>
                      {t.link && (
                        <a
                          href={t.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-accent"
                        >
                          Learn more <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      )}
                    </div>
                  </Hover>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {filtered.length === 0 && (
        <div className="mt-10 flex flex-col items-center text-center text-muted-foreground">
          <BookA className="h-10 w-10 opacity-40" aria-hidden />
          <p className="mt-3 text-base">
            No terms match {query ? <>&ldquo;{query}&rdquo;</> : "your filters"}.
          </p>
          <button type="button" onClick={clearFilters} className="ac-btn-ghost mt-4 text-sm">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
