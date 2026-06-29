"use client";

import * as React from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import { Search, ExternalLink, BookA } from "lucide-react";
import type { GlossaryTerm } from "@/lib/glossary-data";
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
      {/* search — terminal input */}
      <div className="group relative mx-auto max-w-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-primary"
        >
          $
        </span>
        <Search className="pointer-events-none absolute left-9 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search terms, acronyms, definitions…"
          className="h-12 w-full rounded-xl border border-border bg-card/60 pl-16 pr-4 font-mono text-sm text-foreground outline-none backdrop-blur-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:shadow-[var(--glow-primary)]"
          aria-label="Search glossary"
        />
      </div>

      {/* category chips */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 font-mono text-xs font-medium transition-all",
              active === c
                ? "border-primary/60 bg-primary/10 text-primary shadow-[var(--glow-primary)]"
                : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <p className="mt-6 text-center font-mono text-sm text-muted-foreground">
        <span className="text-muted-foreground/60">// </span>
        <span className="text-primary">{filtered.length}</span>{" "}
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
                className="group flex flex-col rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold leading-tight">
                    {t.term}
                  </h3>
                  {t.abbr && t.abbr !== t.term && (
                    <span className="shrink-0 rounded-md border border-border bg-background/50 px-1.5 py-0.5 font-mono text-[11px] text-accent">
                      {t.abbr}
                    </span>
                  )}
                </div>
                <span className="mt-1 font-mono text-[11px] uppercase tracking-wider text-primary/80">
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
                    className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-medium text-primary transition-colors hover:text-accent"
                  >
                    learn_more <ExternalLink className="h-3 w-3" />
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
          <p className="mt-3 font-mono text-sm">
            No terms match &ldquo;{query}&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}
