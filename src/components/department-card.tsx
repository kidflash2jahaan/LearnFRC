"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Layers } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { Progress } from "@/components/ui/progress";
import { itemVariants } from "@/components/motion/reveal";

export function DepartmentCard({
  slug,
  name,
  tagline,
  moduleCount,
  lessonCount,
  progressPct,
  index,
  inStagger = true,
}: {
  slug: string;
  name: string;
  tagline: string | null;
  moduleCount?: number;
  lessonCount?: number;
  progressPct?: number;
  index?: number;
  inStagger?: boolean;
}) {
  const m = deptMeta(slug);
  const idx = typeof index === "number" ? String(index).padStart(2, "0") : null;
  const hasLessons = typeof lessonCount === "number" && lessonCount > 0;
  const hasModules = typeof moduleCount === "number" && moduleCount > 0;

  return (
    <motion.div
      variants={inStagger ? itemVariants : undefined}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative h-full"
      style={{ "--c": m.color } as CSSProperties}
    >
      <Link
        href={`/guides/${slug}`}
        className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-[var(--glow-primary)]"
      >
        {/* hover radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[var(--c)] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-[0.22]"
        />
        {/* top neon trace */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-[var(--c)] to-transparent transition-transform duration-300 group-hover:scale-x-100"
        />

        <div className="relative flex items-start justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-all duration-300 group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[var(--glow-primary)]">
            <Icon name={m.icon} className="h-5 w-5" />
          </span>
          {idx && (
            <span className="font-mono text-xs text-muted-foreground">{idx}</span>
          )}
        </div>

        <h3 className="relative mt-4 font-display text-lg font-semibold leading-snug tracking-tight">
          {name}
        </h3>

        {(hasLessons || hasModules) && (
          <div className="relative mt-1 font-mono text-xs text-accent">
            {hasLessons && `${lessonCount} lessons`}
            {hasLessons && hasModules && " · "}
            {hasModules && `${moduleCount} modules`}
          </div>
        )}

        <p className="relative mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {tagline}
        </p>

        {typeof progressPct === "number" && (
          <div className="relative mt-4 flex items-center gap-3">
            <Progress
              value={progressPct}
              className="flex-1"
              style={{
                background: "linear-gradient(90deg, var(--accent), var(--primary))",
              }}
            />
            <span className="font-mono text-[11px] text-muted-foreground">
              {progressPct}%
            </span>
          </div>
        )}

        <div className="relative mt-4 flex items-center justify-between border-t border-border/70 pt-3 font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-3">
            {hasModules && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" /> {moduleCount}
              </span>
            )}
            {hasLessons && (
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" /> {lessonCount}
              </span>
            )}
            {!hasModules && !hasLessons && (
              <span className="text-primary/80">open →</span>
            )}
          </span>
          <ArrowRight className="h-4 w-4 text-[var(--c)] transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </Link>
    </motion.div>
  );
}
