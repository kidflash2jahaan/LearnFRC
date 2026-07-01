"use client";

import * as React from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import { Search, ExternalLink, BookA } from "lucide-react";
import type { GlossaryTerm } from "@/lib/glossary-data";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";

export function GlossaryBrowser({
  terms,
  categories,
}: {
  terms: GlossaryTerm[];
  categories: readonly string[];
}) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState<string>("All");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms
      .filter((t) => active === "All" || t.category === active)
      .filter(
        (t) =>
          !q ||
          t.term.toLowerCase().includes(q) ||
          (t.abbr ?? "").toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q)
      )
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, query, active]);

  const chips = ["All", ...categories];

  return (
    <div>
      {/* search */}
      <div className="relative mx-auto max-w-xl">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms, acronyms, and definitions…"
          className="aq-input h-14 w-full pl-14 pr-5 text-base"
          aria-label="Search glossary"
        />
      </div>

      {/* category filters */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "aq-chip cursor-pointer transition-all",
              active === c
                ? "border-primary/60 bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-base text-muted-foreground">
        <AnimatedCounter
          value={filtered.length}
          className="font-semibold text-foreground"
        />{" "}
        {filtered.length === 1 ? "term" : "terms"}
      </p>

      {/* grid */}
      <LayoutGroup>
        <motion.div
          layout
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((t) => (
              <motion.div
                key={t.term}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="aq-card aq-card-hover flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="aq-display text-lg font-semibold leading-tight text-foreground">
                    {t.term}
                  </h3>
                  {t.abbr && t.abbr !== t.term && (
                    <span className="shrink-0 rounded-lg border border-border bg-background/60 px-2 py-0.5 font-mono text-[11px] font-medium text-accent">
                      {t.abbr}
                    </span>
                  )}
                </div>
                <span className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-primary">
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
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-accent"
                  >
                    Learn more <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {filtered.length === 0 && (
        <div className="mt-10 flex flex-col items-center text-center text-muted-foreground">
          <BookA className="h-10 w-10 opacity-40" />
          <p className="mt-3 text-base">
            No terms match &ldquo;{query}&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}
