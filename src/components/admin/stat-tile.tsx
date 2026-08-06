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
import { inkFor } from "@/lib/departments";

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

/* ------------------------------------------------------------------ */
/*  Ink for text sitting ON the tile's own tint                        */
/*                                                                     */
/*  Every tile is now an `.ac-tile`, i.e. washed in its own accent      */
/*  (26% -> 12% accent-in-white, top to bottom). A number painted in    */
/*  the RAW accent is then the same hue as the thing behind it and      */
/*  collapses: #f5a623 on its own tint measures ~1.7:1.                 */
/*                                                                     */
/*  `inkFor()` is the site-wide "accent as legible text" step, but it   */
/*  only remaps the department palette — the admin accents are not in   */
/*  that table, so it returns them unchanged. So we take its output     */
/*  and fold it into the design system's dark ink using EXACTLY the     */
/*  recipe `.ac-badge` uses for its glyph (30% accent + #16203a). That  */
/*  keeps the hue (navy number on the blue tile, plum on the magenta)   */
/*  while landing every accent at >= 7:1.                               */
/*                                                                     */
/*  Measured in Chromium off screenshot pixels, against the DARK end    */
/*  of each tile's own gradient (the binding end for dark text):        */
/*    #2560e6 8.2  #1aa9d6 7.4  #7c5cff 8.1  #12a150 7.8               */
/*    #f5a623 7.3  #d64b8a 8.1  #0ea5a3 7.6  #8a97ad 7.7               */
/*  Amber is the floor — raising the accent share to 45% drops it to    */
/*  5.0, so 30% is where this stays.                                    */
/* ------------------------------------------------------------------ */
function inkOnTint(accent: string): string {
  return `color-mix(in srgb, ${inkFor(accent)} 30%, #16203a)`;
}

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
 * The tile is an `.ac-tile` — the same tinted clay skin the /guides
 * department cards use — driven by an inline `--a`, so each tile is washed
 * in its own accent instead of sitting on white.
 *
 * Colour notes (do NOT swap these back to `text-muted-foreground` or the
 * raw accent without re-measuring — a tint eats low-contrast text):
 *  - label  `text-foreground/80`  >= 6.4:1 on every accent
 *  - number `inkOnTint(accent)`   >= 7.3:1
 *  - hint   `text-foreground/75`  >= 5.6:1
 *  `text-foreground/60` measures 3.7-4.1:1 here and FAILS AA.
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
  const ink = inkOnTint(accent);

  return (
    <RevealItem className="min-w-0">
      <Hover lift={-2} className="h-full">
        <div
          className="ac-tile flex h-full flex-col p-3 sm:p-3.5"
          style={{ "--a": accent } as CSSProperties}
        >
          {/* Top line: icon + label.

              The icon is a BARE glyph, not an `.ac-badge` chip like the
              department cards use. Tried both: a 12px glossy chip on all
              ~27 tiles turns the grid into a field of buttons and fights
              the tint it is sitting on, and at that size the chip's own
              gloss/inset highlight is illegible detail. The department
              page shows six 48px cards, which is where a chip earns its
              keep. Here the tint already carries the colour, so the glyph
              only has to be legible — hence `ink`, not the raw accent
              (a raw #f5a623 glyph on the amber tint all but disappears). */}
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: ink }}
              aria-hidden
            />
            <span
              title={label}
              className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-foreground/80"
            >
              {label}
            </span>
          </div>

          {/* The number.

              Size tracks TILE width, not viewport: the lg 6-across tile is
              ~155px at the 1024px breakpoint — NARROWER than the 2-across
              phone tile (~167px at 375px) — so the `sm` step-up has to be
              given back at `lg` or long values get clipped. A clipped label
              is recoverable; a clipped NUMBER ("1,234,5…") is misleading,
              hence the title fallback too. Re-checked at 375/640/768/1024/
              1280/1440/1920: "1,284,509" fits uncut at every step. */}
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
            {live ? <LiveDot ink={ink} /> : null}
            <span
              title={`${value.toLocaleString()}${suffix ?? ""}`}
              className={
                hero
                  ? "min-w-0 truncate font-display text-2xl font-bold tabular-nums sm:text-3xl lg:text-2xl"
                  : "min-w-0 truncate font-display text-xl font-bold tabular-nums sm:text-2xl lg:text-xl"
              }
              /* Was a blue->cyan brand gradient clipped to the text on
                 `hero` tiles. On a per-accent tint that gradient both
                 clashed (cyan text on an amber tile) and could not be
                 contrast-checked — a gradient has no one colour. Hero is
                 now expressed by SIZE alone and shares the tile's ink. */
              style={{ color: ink }}
            >
              <AnimatedCounter value={value} suffix={suffix} />
            </span>
          </div>

          {/* Optional supporting line — renders nothing at all when absent,
              so tiles without a hint stay compact instead of reserving air.

              `text-muted-foreground` (#4d5b78) was fine on the old white
              card but washes out on a tint. Measured on the DARK end of
              every accent's gradient: fg/60 lands at 3.7-4.1 (fails),
              fg/70 at 4.8, fg/75 at 5.6. Took /75 for the 11px hint. */}
          {hint ? (
            <div
              title={hint}
              className="mt-0.5 truncate text-[11px] text-foreground/75"
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
    is not communicated by colour/motion alone. Painted in the tile's ink
    rather than the raw accent: a raw-accent dot on a tint of the SAME
    accent is a dot you cannot see. */
function LiveDot({ ink }: { ink: string }): React.JSX.Element {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none"
        style={{ backgroundColor: ink }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: ink }}
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
