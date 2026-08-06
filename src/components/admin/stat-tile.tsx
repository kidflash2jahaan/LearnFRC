"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import {
  Activity,
  Award,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  CalendarClock,
  CircleCheck,
  CircleDot,
  Clock,
  Download,
  Eye,
  FileClock,
  FileText,
  Flag,
  Flame,
  Ghost,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  Inbox,
  Layers,
  Link2,
  Mail,
  MailCheck,
  MailX,
  MessageSquare,
  Newspaper,
  Percent,
  Repeat,
  Rocket,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Timer,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";

/* ------------------------------------------------------------------ */
/*  Icon registry                                                      */
/*                                                                     */
/*  /admin is a SERVER component and cannot pass a component down as a */
/*  prop, so tiles name their icon as a STRING and it is resolved here */
/*  on the client. Unknown names fall back to CircleDot — a typo in a  */
/*  dashboard tile must never take the page down.                      */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, LucideIcon> = {
  Activity,
  Award,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  CalendarClock,
  CircleCheck,
  CircleDot,
  Clock,
  Download,
  Eye,
  FileClock,
  FileText,
  Flag,
  Flame,
  Ghost,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  Inbox,
  Layers,
  Link2,
  Mail,
  MailCheck,
  MailX,
  MessageSquare,
  Newspaper,
  Percent,
  Repeat,
  Rocket,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Timer,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Zap,
};

const FALLBACK_ICON: LucideIcon = CircleDot;

const DEFAULT_ACCENT = "#2560e6";

/** Brand gradient, applied to the handful of headline numbers only. */
const HERO_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

/* ------------------------------------------------------------------ */
/*  StatTile                                                           */
/* ------------------------------------------------------------------ */

export type StatTileProps = {
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  /** Lucide icon NAME (see ICONS above); unknown names fall back safely. */
  icon: string;
  accent?: string;
  hero?: boolean;
  live?: boolean;
};

/**
 * One small dashboard widget: icon + label, a big number, an optional hint.
 *
 * Layout notes that keep 375px honest:
 *  - `min-w-0` on the grid item AND on every truncating flex child; without
 *    it a flex/grid item's `min-width: auto` refuses to shrink and a long
 *    label ("Lessons completed") blows the column out sideways.
 *  - the number row is its own `min-w-0` flex row so a huge count clips
 *    rather than pushing the card wider.
 *
 * Motion notes:
 *  - `RevealItem` is safe to render standalone. Verified: with no parent
 *    variant context framer applies NO variant styles (the element renders
 *    plain and visible), so a tile outside a RevealGroup is not stuck at
 *    opacity 0. Inside StatGrid it inherits the group's stagger.
 *  - Reduced motion is handled inside the primitives (timing only) and via
 *    `motion-reduce:animate-none` on the live dot — the rendered tree and
 *    text never branch on it, so SSR and hydration always agree.
 */
export function StatTile({
  label,
  value,
  suffix,
  hint,
  icon,
  accent = DEFAULT_ACCENT,
  hero = false,
  live = false,
}: StatTileProps): React.JSX.Element {
  const Icon = ICONS[icon] ?? FALLBACK_ICON;

  return (
    <RevealItem className="min-w-0">
      <Hover lift={-2} className="h-full">
        <div className="ac-card flex h-full flex-col p-3 sm:p-3.5">
          {/* Top line: accent icon + label */}
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: accent }}
              aria-hidden
            />
            <span
              title={label}
              className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </span>
          </div>

          {/* The number.

              Size tracks TILE width, not viewport: the lg 6-across tile is
              ~171px — narrower than the 2-across phone tile is generous —
              so the `sm` step-up has to be given back at `lg` or long values
              get clipped. A clipped label is recoverable; a clipped NUMBER
              ("1,234,5…") is misleading, hence the title fallback too. */}
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
            {live ? <LiveDot accent={accent} /> : null}
            <span
              title={`${value.toLocaleString()}${suffix ?? ""}`}
              className={
                hero
                  ? "min-w-0 truncate font-display text-2xl font-bold tabular-nums sm:text-3xl lg:text-2xl"
                  : "min-w-0 truncate font-display text-xl font-bold tabular-nums sm:text-2xl lg:text-xl"
              }
              style={hero ? HERO_GRADIENT : undefined}
            >
              <AnimatedCounter value={value} suffix={suffix} />
            </span>
          </div>

          {/* Optional supporting line — renders nothing at all when absent,
              so tiles without a hint stay compact instead of reserving air. */}
          {hint ? (
            <div
              title={hint}
              className="mt-0.5 truncate text-[11px] text-muted-foreground"
            >
              {hint}
            </div>
          ) : null}
        </div>
      </Hover>
    </RevealItem>
  );
}

/** Pulsing status dot. The `sr-only` word carries the meaning so the state
    is not communicated by colour/motion alone. */
function LiveDot({ accent }: { accent: string }): React.JSX.Element {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none"
        style={{ backgroundColor: accent }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <span className="sr-only">live</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  StatGrid                                                           */
/* ------------------------------------------------------------------ */

/**
 * Two tiles across on a phone, six across on desktop. The stagger is
 * deliberately tiny — a 20-tile grid at 0.08s would take nearly two
 * seconds to finish arriving.
 */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <RevealGroup
      className={[
        "grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      stagger={0.025}
    >
      {children}
    </RevealGroup>
  );
}

/* ------------------------------------------------------------------ */
/*  StatSection                                                        */
/* ------------------------------------------------------------------ */

/** A labelled band of tiles. Owns the vertical rhythm between groups. */
export function StatSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
