"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { useStaticMotion } from "@/components/perf-mode";
import { cn } from "@/lib/utils";

/* ================================================================== */
/*  Neon Terminal motion kit — shared animated primitives             */
/*  Pair with Reveal / Stagger / StaggerItem from ./reveal            */
/* ================================================================== */

/** macOS-style terminal window frame with traffic-light dots + a mono title. */
export function TerminalFrame({
  title = "~/learnfrc",
  className,
  bodyClassName,
  glow = false,
  dots = true,
  right,
  children,
}: {
  title?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  glow?: boolean;
  dots?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur-md",
        glow && "neon-border",
        className
      )}
    >
      <div className="terminal-titlebar flex items-center gap-2 px-3.5 py-2.5">
        {dots && (
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-[0_0_8px_rgba(40,200,64,.6)]" />
          </span>
        )}
        <span className="ml-1 truncate font-mono text-xs text-muted-foreground">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

/** A pulsing status pill: ● LABEL */
export function StatusPill({
  children,
  tone = "primary",
  pulse = true,
  className,
}: {
  children: React.ReactNode;
  tone?: "primary" | "accent" | "magenta" | "muted";
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === "accent"
      ? "var(--accent)"
      : tone === "magenta"
        ? "var(--magenta)"
        : tone === "muted"
          ? "var(--muted-foreground)"
          : "var(--primary)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider",
        className
      )}
      style={{ borderColor: `color-mix(in srgb, ${color} 38%, var(--border))`, color }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", pulse && "animate-glow-pulse")}
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {children}
    </span>
  );
}

/** Types text out with a blinking caret once it scrolls into view. */
export function TypeLine({
  text,
  className,
  prompt,
  speed = 34,
  startDelay = 180,
  caret = true,
}: {
  text: string;
  className?: string;
  prompt?: string;
  speed?: number;
  startDelay?: number;
  caret?: boolean;
}) {
  const stat = useStaticMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [shown, setShown] = React.useState(0);

  React.useEffect(() => {
    if (stat) {
      setShown(text.length);
      return;
    }
    if (!inView) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setShown(i);
      if (i < text.length) timer = setTimeout(tick, speed);
    };
    const start = setTimeout(tick, startDelay);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [inView, stat, text, speed, startDelay]);

  return (
    <span ref={ref} className={cn("font-mono", className)}>
      {prompt && <span className="text-primary">{prompt}&nbsp;</span>}
      {text.slice(0, shown)}
      {caret && <span className="caret" aria-hidden />}
    </span>
  );
}

/** Occasional CRT-style glitch on the text. */
export function GlitchText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const stat = useStaticMotion();
  return <span className={cn("inline-block", !stat && "animate-glitch", className)}>{children}</span>;
}

/** Number that counts up (with neon glow) when scrolled into view. */
export function NeonCounter({
  to,
  suffix = "",
  prefix = "",
  duration = 1.4,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const stat = useStaticMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [val, setVal] = React.useState(0);

  React.useEffect(() => {
    if (stat) {
      setVal(to);
      return;
    }
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * to));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, stat, to, duration]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

/** Site-wide ambient HUD: faint grid, neon aurora wash, and a slow scanline. */
export function HudBackground() {
  const stat = useStaticMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 hud-grid opacity-50 mask-radial-faded" />
      <div className={cn("absolute inset-0 aurora-bg opacity-30", !stat && "animate-aurora")} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </div>
  );
}

/** Smooth fade/slide page transition. Wrap page content with this. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const stat = useStaticMotion();
  if (stat) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
