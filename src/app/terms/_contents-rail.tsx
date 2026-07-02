"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, ScrollText } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";
import { useStaticMotion } from "@/components/perf-mode";

export type RailItem = { id: string; title: string };

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Signature element: the "rulebook navigator" — a sticky match-plan rail
 * with a live scroll-spy progress ring, quick stats, and a jump list. It is
 * a pure navigation aid layered over the (fully static, anchor-linked)
 * content below, so the page degrades gracefully with JS disabled.
 */
export function ContentsRail({
  items,
  contact,
}: {
  items: RailItem[];
  contact: string;
}) {
  const [active, setActive] = React.useState(items[0]?.id ?? "");
  const reduce = useReducedMotion();
  const stat = useStaticMotion();

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const doneIndex = Math.max(0, items.findIndex((it) => it.id === active));
  const progress = items.length > 1 ? doneIndex / (items.length - 1) : 0;
  const dashOffset = RING_C * (1 - progress);

  return (
    <nav aria-label="Terms sections" className="text-sm">
      {/* header: live badge + progress ring instrument */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90" aria-hidden>
            <circle cx="30" cy="30" r={RING_R} fill="none" stroke="rgba(120,145,190,.28)" strokeWidth="5" />
            <motion.circle
              cx="30"
              cy="30"
              r={RING_R}
              fill="none"
              stroke="url(#terms-rail-ring)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              animate={{ strokeDashoffset: dashOffset }}
              initial={false}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
            />
            <defs>
              <linearGradient id="terms-rail-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2560e6" />
                <stop offset="1" stopColor="#1aa9d6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            <ScrollText className="h-5 w-5 text-primary" aria-hidden />
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
            <motion.span
              className="h-2 w-2 rounded-full bg-[#12b565]"
              animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            Match plan
          </div>
          <p className="mt-1 text-[13px] leading-snug text-foreground/70">
            <span className="font-semibold text-foreground">
              <AnimatedCounter value={items.length} />
            </span>{" "}
            rules ·{" "}
            <span className="font-semibold text-foreground">
              <AnimatedCounter value={4} />
            </span>
            -min read
          </p>
        </div>
      </div>

      {/* jump list */}
      <ol className="mt-5 space-y-1">
        {items.map((it, i) => {
          const isActive = it.id === active;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => jump(it.id)}
                aria-current={isActive ? "true" : undefined}
                className="group flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold tabular-nums transition-colors"
                  style={
                    {
                      background: isActive ? "#2560e6" : "rgba(37,96,230,0.10)",
                      color: isActive ? "#fff" : "#2560e6",
                    } as CSSProperties
                  }
                >
                  {i + 1}
                </span>
                <span
                  className={`flex-1 leading-snug transition-colors ${
                    isActive ? "font-semibold text-foreground" : "text-foreground/65 group-hover:text-foreground"
                  }`}
                >
                  {it.title}
                </span>
                {isActive &&
                  (stat ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  ) : (
                    <motion.span
                      layoutId="terms-rail-dot"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}
                      aria-hidden
                    />
                  ))}
              </button>
            </li>
          );
        })}
      </ol>

      <a
        href={`mailto:${contact}`}
        className="ac-btn-ghost mt-5 flex w-full items-center justify-center gap-2 text-[13px]"
      >
        <Mail className="h-3.5 w-3.5" aria-hidden />
        Email us a question
      </a>
    </nav>
  );
}
