"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Layers } from "lucide-react";
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
  const hasProgress = typeof progressPct === "number";

  return (
    <motion.div
      variants={inStagger ? itemVariants : undefined}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group h-full"
      style={{ "--a": m.color } as CSSProperties}
    >
      <Link
        href={`/guides/${slug}`}
        className="aq-tile aq-reveal flex h-full flex-col rounded-[20px] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Header: glossy badge + index chip */}
        <div className="relative flex items-start justify-between">
          <span className="aq-badge flex h-12 w-12 items-center justify-center rounded-2xl">
            <Icon name={m.icon} className="h-6 w-6" />
          </span>
          {idx && (
            <span className="rounded-full bg-white/55 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-foreground/70">
              {idx}
            </span>
          )}
        </div>

        {/* Name + count meta */}
        <h3 className="aq-display mt-4 text-xl font-bold leading-tight text-foreground">
          {name}
        </h3>

        {(hasLessons || hasModules) && (
          <div className="mt-1.5 font-mono text-xs font-medium tracking-wide text-foreground/65">
            {hasLessons && `${lessonCount} lessons`}
            {hasLessons && hasModules && " · "}
            {hasModules && `${moduleCount} modules`}
          </div>
        )}

        <p className="mt-2 line-clamp-2 flex-1 text-[15px] leading-relaxed text-foreground/70">
          {tagline}
        </p>

        {/* Progress */}
        {hasProgress && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] font-semibold text-foreground/70">
              <span>Progress</span>
              <span>{progressPct}%</span>
            </div>
            <Progress
              value={progressPct}
              className="h-2 bg-white/45"
              barClassName="bg-[color-mix(in_srgb,var(--a)_78%,#141f2c)]"
            />
          </div>
        )}

        {/* Footer: counts + go arrow */}
        <div className="mt-4 flex items-center justify-between border-t border-white/45 pt-3">
          <span className="inline-flex items-center gap-3 font-mono text-xs font-medium text-foreground/70">
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
              <span className="font-semibold text-foreground/80">Open guide</span>
            )}
          </span>
          <span className="aq-arw flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
