"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { StatusPill } from "@/components/motion/terminal";

const ROWS = [
  { label: "Programming", pct: 82 },
  { label: "Mechanical", pct: 64 },
  { label: "CAD & Design", pct: 48 },
  { label: "Electrical", pct: 30 },
];

export function HeroVisual() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* ambient glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 aurora-bg opacity-50 blur-3xl animate-aurora"
      />
      {/* code-bracket accents */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-7 -top-8 select-none font-mono text-[7rem] leading-none text-primary/10"
      >
        {"{"}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -right-5 select-none font-mono text-[7rem] leading-none text-primary/10"
      >
        {"}"}
      </span>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="relative"
      >
        <motion.div
          animate={reduce ? {} : { y: [0, -8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-[var(--shadow-lg)] backdrop-blur-md neon-border"
        >
          {/* title bar */}
          <div className="terminal-titlebar flex items-center gap-2 px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[0_0_8px_rgba(40,200,64,.6)]" />
            </span>
            <span className="ml-1 truncate font-mono text-xs text-muted-foreground">
              build_status.log — ~/team5835
            </span>
          </div>

          {/* header */}
          <div className="flex items-start justify-between px-5 pt-4">
            <div>
              <h3 className="font-mono text-sm font-semibold text-foreground">
                Build Season Ready
              </h3>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                // progress across core departments
              </p>
            </div>
            <StatusPill tone="primary">LIVE</StatusPill>
          </div>

          {/* progress rows */}
          <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
            {ROWS.map((r, i) => (
              <div key={r.label}>
                <div className="mb-1.5 flex items-baseline justify-between font-mono text-xs">
                  <span className="text-foreground">{r.label}</span>
                  <span className="text-primary">{r.pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--accent), var(--primary))",
                      boxShadow:
                        "0 0 12px color-mix(in srgb, var(--primary) 45%, transparent)",
                    }}
                    initial={{ width: reduce ? `${r.pct}%` : 0 }}
                    whileInView={{ width: `${r.pct}%` }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 1,
                      delay: 0.2 + i * 0.15,
                      ease: "easeOut",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* footer */}
          <div className="flex items-center gap-2 border-t border-border bg-primary/[0.03] px-5 py-3 font-mono text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span>system: on track for kickoff — next module loaded</span>
            <span className="caret" aria-hidden />
          </div>
        </motion.div>

        {/* floating XP badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 18 }}
          className="absolute -right-3 -top-4 flex items-center gap-2 rounded-xl border border-border bg-background-2/90 px-3 py-2 font-mono text-xs shadow-[var(--shadow-md)] backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)] animate-glow-pulse" />
          +50 XP <span className="text-accent">earned today</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
