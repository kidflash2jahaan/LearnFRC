"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { cn } from "@/lib/utils";

export type AchievementView = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
};

export function AchievementBadge({
  achievement,
}: {
  achievement: AchievementView;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const { earned, name, description, icon, earnedAt } = achievement;

  const earnedLabel = earnedAt
    ? new Date(earnedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <motion.button
        type="button"
        tabIndex={0}
        aria-label={`${name}${earned ? " — earned" : " — locked"}. ${description}`}
        whileHover={reduce ? undefined : { y: -4, scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 20 }}
        className={cn(
          "group flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          earned
            ? "border-primary/25 bg-card hover:border-primary/45 hover:shadow-[var(--shadow-lg)]"
            : "border-dashed border-border bg-card/60 hover:border-border"
        )}
      >
        <span
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300",
            earned
              ? "text-primary-foreground shadow-[var(--shadow-md)]"
              : "bg-muted text-muted-foreground"
          )}
          style={
            earned
              ? {
                  backgroundImage:
                    "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
                }
              : undefined
          }
        >
          <Icon name={icon} className="h-7 w-7" />
          {earned && !reduce && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary/40"
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.45 }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                repeatDelay: 2.5,
                ease: "easeOut",
              }}
            />
          )}
          {!earned && (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-background text-muted-foreground">
              <Lock className="h-3 w-3" />
            </span>
          )}
        </span>
        <span
          className={cn(
            "text-xs font-semibold leading-tight",
            earned ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {name}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-xl border border-primary/25 bg-popover/95 p-3 text-left shadow-[var(--shadow-lg)] backdrop-blur"
          >
            <p className="text-sm font-semibold">{name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
            <p
              className={cn(
                "mt-1.5 font-mono text-[11px] font-medium",
                earned ? "text-success" : "text-muted-foreground"
              )}
            >
              {earned
                ? earnedLabel
                  ? `// earned ${earnedLabel}`
                  : "// earned"
                : "// locked — keep learning"}
            </p>
            <span
              aria-hidden
              className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-primary/25 bg-popover"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
