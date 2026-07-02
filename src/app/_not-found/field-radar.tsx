"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bot } from "lucide-react";
import { AnimatedCounter } from "@/components/animated-counter";

/**
 * Signature 404 device: "Field radar" — a glass instrument showing the bot's
 * telemetry has gone quiet. A sweep line rotates, a lost-signal blip pings,
 * and the readouts play on the 404 itself (error code + zero signal bars).
 */
export function FieldRadar() {
  const reduce = useReducedMotion();

  return (
    <div className="ac-glass relative w-full p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-[17px] font-bold text-foreground">
          Field radar
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-warning">
          <motion.span
            className="h-2 w-2 rounded-full bg-[#e0a415]"
            animate={reduce ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.55, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
          Signal lost
        </span>
      </div>

      {/* radar dial */}
      <div
        className="relative mx-auto mt-6 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(37,96,230,0.12), rgba(37,96,230,0.02) 70%)",
          border: "1px solid rgba(120,145,190,0.32)",
        }}
        aria-hidden="true"
      >
        <span
          className="absolute inset-3 rounded-full border border-dashed"
          style={{ borderColor: "rgba(120,145,190,0.4)" }}
        />
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, rgba(37,96,230,0.4), transparent 30%)",
          }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={reduce ? { duration: 0 } : { duration: 3.4, repeat: Infinity, ease: "linear" }}
        />
        <Bot className="relative h-8 w-8 text-primary" />
        <motion.span
          className="absolute h-2.5 w-2.5 rounded-full bg-[#d0392b]"
          style={{ left: "30%", top: "32%" }}
          animate={reduce ? undefined : { scale: [1, 1.7, 1], opacity: [0.9, 0.15, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
      </div>

      {/* readouts */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="ac-card rounded-2xl p-4">
          <div className="font-display text-3xl font-extrabold leading-none text-primary">
            <AnimatedCounter value={404} />
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">error code</div>
        </div>
        <div className="ac-card rounded-2xl p-4">
          <div className="font-display text-3xl font-extrabold leading-none text-foreground">
            <AnimatedCounter value={0} />
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">bars of signal</div>
        </div>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
        No autonomous path found to this URL. Telemetry says: try one of the
        routes below.
      </p>
    </div>
  );
}
