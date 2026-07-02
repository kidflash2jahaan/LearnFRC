"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inkFor } from "@/lib/departments";

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
  const prefersReducedMotion = useReducedMotion();
  // Legible-on-light tone for accent text/icons (bright accents wash out).
  const ink = inkFor(accent);
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
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.45, delay: mi * 0.04 }
            }
            className={cn("ac-card group/mod relative overflow-hidden")}
            style={
              isPre
                ? ({
                    "--a": accent,
                    borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                    background: `color-mix(in srgb, ${accent} 4%, transparent)`,
                  } as CSSProperties)
                : undefined
            }
          >
            {/* top accent line on hover */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-300 group-hover/mod:scale-x-100"
              style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
            />

            <button
              onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
              className="flex min-h-11 w-full cursor-pointer items-center gap-4 rounded-[20px] p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-expanded={isOpen}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border font-display text-sm font-semibold transition-transform duration-300 group-hover/mod:scale-105"
                style={{
                  color: ink,
                  borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                  background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                }}
              >
                {isPre ? (
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                ) : (
                  String(Number(label)).padStart(2, "0")
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isPre && (
                    <span
                      className="ac-chip text-[11px] font-bold uppercase tracking-wider"
                      style={{
                        color: ink,
                        borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                      }}
                    >
                      Start here · Prerequisite
                    </span>
                  )}
                  <h3 className="truncate font-display text-[16px] font-bold tracking-tight">
                    {m.title}
                  </h3>
                  {moduleComplete && (
                    <>
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-success"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Module complete</span>
                    </>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {isPre ? "recommended before you start · " : ""}
                  {done}/{total} lessons · <span className="tabular-nums">{pct}%</span>
                </p>
              </div>

              <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${pct}%`,
                    background: accent,
                  }}
                />
              </div>

              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={
                    prefersReducedMotion
                      ? { height: "auto", opacity: 1 }
                      : { height: 0, opacity: 0 }
                  }
                  animate={{ height: "auto", opacity: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { height: 0, opacity: 0 }
                  }
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }
                  }
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-3 pb-3 pt-1">
                    {m.overview && (
                      <p className="px-2 py-3 text-sm leading-relaxed text-muted-foreground">
                        {m.overview}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {m.lessons.map((l, li) => {
                        const isDone = completed.has(l.id);
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/guides/${departmentSlug}/${m.slug}/${l.slug}`}
                              className="group/les flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              {isDone ? (
                                <CheckCircle2
                                  className="h-5 w-5 shrink-0"
                                  style={{ color: ink }}
                                  aria-hidden="true"
                                />
                              ) : (
                                <Circle className="h-5 w-5 shrink-0 text-muted-foreground/70 transition-colors group-hover/les:text-foreground" aria-hidden="true" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground/90 group-hover/les:text-foreground">
                                  <span
                                    className="mr-2 text-xs tabular-nums"
                                    style={{ color: ink }}
                                  >
                                    {isPre ? "P" : label}.{li + 1}
                                  </span>
                                  {l.title}
                                </span>
                              </span>
                              {l.estimated_minutes ? (
                                <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  <span className="tabular-nums">{l.estimated_minutes}</span>m
                                </span>
                              ) : null}
                              <ArrowRight
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover/les:translate-x-0 group-hover/les:opacity-100"
                              />
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
