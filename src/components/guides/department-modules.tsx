"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Lesson = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  estimated_minutes: number;
};
type ModuleT = {
  id: string;
  slug: string;
  title: string;
  overview: string | null;
  is_prerequisite?: boolean;
  lessons: Lesson[];
};

export function DepartmentModules({
  departmentSlug,
  modules,
  completedIds,
  accent,
}: {
  departmentSlug: string;
  modules: ModuleT[];
  completedIds: string[];
  accent: string;
}) {
  const completed = React.useMemo(() => new Set(completedIds), [completedIds]);
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((m, i) => [m.id, i === 0]))
  );

  // Number regular modules 1..N; prerequisite modules show a "start here" mark.
  let regular = 0;
  const labels = modules.map((m) => (m.is_prerequisite ? "pre" : String(++regular)));

  return (
    <div className="space-y-4">
      {modules.map((m, mi) => {
        const total = m.lessons.length;
        const done = m.lessons.filter((l) => completed.has(l.id)).length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const isOpen = open[m.id];
        const isPre = !!m.is_prerequisite;
        const label = labels[mi];
        const moduleComplete = done === total && total > 0;
        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: mi * 0.04 }}
            className={cn(
              "group/mod aq-card aq-card-hover relative overflow-hidden transition-all duration-300",
              isPre && "border-primary/40 bg-primary/[0.04]"
            )}
          >
            {/* top accent line on hover */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-300 group-hover/mod:scale-x-100"
              style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
            />

            <button
              onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
              className="flex w-full cursor-pointer items-center gap-4 p-5 text-left"
              aria-expanded={isOpen}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition-all duration-300"
                style={{
                  color: accent,
                  borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                  background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                }}
              >
                {isPre ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  String(Number(label)).padStart(2, "0")
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isPre && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Start here · Prerequisite
                    </span>
                  )}
                  <h3 className="truncate font-display font-semibold tracking-tight">
                    {m.title}
                  </h3>
                  {moduleComplete && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  )}
                </div>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {isPre ? "recommended before you start · " : ""}
                  {done}/{total} lessons · {pct}%
                </p>
              </div>

              <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${pct}%`,
                    background: accent,
                    boxShadow: `0 0 10px color-mix(in srgb, ${accent} 60%, transparent)`,
                  }}
                />
              </div>

              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-3 pb-3 pt-1">
                    {m.overview && (
                      <p className="px-2 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
                              {m.overview}
                      </p>
                    )}
                    <ul className="space-y-0.5">
                      {m.lessons.map((l, li) => {
                        const isDone = completed.has(l.id);
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/guides/${departmentSlug}/${m.slug}/${l.slug}`}
                              className="group/les flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted"
                            >
                              {isDone ? (
                                <CheckCircle2
                                  className="h-5 w-5 shrink-0"
                                  style={{ color: accent }}
                                />
                              ) : (
                                <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40 transition-colors group-hover/les:text-muted-foreground" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground/90 group-hover/les:text-foreground">
                                  <span
                                    className="mr-2 font-mono text-xs"
                                    style={{ color: accent }}
                                  >
                                    {isPre ? "P" : label}.{li + 1}
                                  </span>
                                  {l.title}
                                </span>
                              </span>
                              {l.estimated_minutes ? (
                                <span className="hidden shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
                                  <Clock className="h-3 w-3" />
                                  {l.estimated_minutes}m
                                </span>
                              ) : null}
                              <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover/les:translate-x-0 group-hover/les:opacity-100" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
