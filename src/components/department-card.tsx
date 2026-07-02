"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight, BookOpen, Layers } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta, inkFor } from "@/lib/departments";
import { Progress } from "@/components/ui/progress";
import { Hover } from "@/components/motion/primitives";

/**
 * A single department tile — a "pit stall" on the map. Pure presentation +
 * its own hover spring; scroll-entrance staggering is owned by the caller
 * (wrap in <RevealItem>), never duplicated here.
 */
export function DepartmentCard({
  slug,
  name,
  tagline,
  moduleCount,
  lessonCount,
  progressPct,
  index,
}: {
  slug: string;
  name: string;
  tagline: string | null;
  moduleCount?: number;
  lessonCount?: number;
  progressPct?: number;
  index?: number;
}) {
  const m = deptMeta(slug);
  const ink = inkFor(m.color);
  const idx = typeof index === "number" ? String(index).padStart(2, "0") : null;
  const hasLessons = typeof lessonCount === "number" && lessonCount > 0;
  const hasModules = typeof moduleCount === "number" && moduleCount > 0;
  const hasProgress = typeof progressPct === "number";

  return (
    <Hover className="h-full" lift={-6}>
      <Link
        href={`/guides/${slug}`}
        className="ac-tile group flex h-full flex-col p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={{ "--a": m.color } as CSSProperties}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className="ac-badge flex h-12 w-12 items-center justify-center"
            style={{ "--a": m.color } as CSSProperties}
          >
            <Icon name={m.icon} className="h-6 w-6" aria-hidden />
          </span>
          {idx && (
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground/60">
              Stall {idx}
            </span>
          )}
        </div>

        <h3 className="mt-4 font-display text-xl font-bold leading-tight text-foreground">
          {name}
        </h3>

        {(hasLessons || hasModules) && (
          <div className="mt-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: ink }}>
            {hasLessons && `${lessonCount} lessons`}
            {hasLessons && hasModules && " · "}
            {hasModules && `${moduleCount} modules`}
          </div>
        )}

        <p className="mt-2 line-clamp-2 flex-1 text-[15px] leading-relaxed text-foreground/70">
          {tagline}
        </p>

        {hasProgress && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-foreground/70">
              <span>Progress</span>
              <span>{progressPct}%</span>
            </div>
            <Progress
              value={progressPct as number}
              className="h-2 bg-white/50"
              barClassName="bg-[color-mix(in_srgb,var(--a)_78%,#141f2c)]"
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-white/50 pt-3">
          <span className="inline-flex items-center gap-3 text-xs font-medium text-foreground/70">
            {hasModules && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" aria-hidden /> {moduleCount}
              </span>
            )}
            {hasLessons && (
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" aria-hidden /> {lessonCount}
              </span>
            )}
            {!hasModules && !hasLessons && (
              <span className="font-semibold text-foreground/80">Open guide</span>
            )}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </Link>
    </Hover>
  );
}
