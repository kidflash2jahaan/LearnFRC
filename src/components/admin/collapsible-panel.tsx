"use client";

import * as React from "react";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  Database,
  Eye,
  FileText,
  Flag,
  Flame,
  Gauge,
  Globe,
  GraduationCap,
  Heart,
  History,
  Inbox,
  Layers,
  LayoutDashboard,
  LineChart,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Newspaper,
  PieChart,
  Radar,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn, alpha } from "@/lib/utils";
import { inkFor } from "@/lib/departments";

/* The admin page is a SERVER component, so it cannot hand a component down as
   a prop — icons arrive as NAME STRINGS and are resolved here on the client.
   Keep this list additive; unknown names fall back to a neutral glyph. */
const PANEL_ICONS: Record<string, LucideIcon> = {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  Eye,
  FileText,
  Flag,
  Flame,
  Gauge,
  Globe,
  GraduationCap,
  Heart,
  History,
  Inbox,
  Layers,
  LayoutDashboard,
  LineChart,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Newspaper,
  PieChart,
  Radar,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Wrench,
  Zap,
};

/**
 * The dropdown shell every BIG admin widget folds into. Collapsed by default so
 * the dashboard reads as tiles first and detail second.
 *
 * Three things here are load-bearing and should not be "simplified":
 *
 *  1. LAZY MOUNT, THEN KEEP MOUNTED. Children are not rendered until the panel
 *     has been opened once (`hasOpened`), because one child is a chart that
 *     measures its container with a ResizeObserver and would latch onto a
 *     zero-height box if mounted while collapsed. After the first open the
 *     children stay mounted, so re-opening is instant and the chart never
 *     re-measures from scratch.
 *  2. NO AnimatePresence. The collapse is the CSS grid 0fr→1fr trick over an
 *     overflow-hidden inner div: deterministic, no measurement, no hydration
 *     branch, and the content stays in the DOM (so the chart keeps its size and
 *     `inert` can handle tab order instead of unmounting).
 *  3. `inert={!open}` keeps collapsed content out of the tab order and the
 *     accessibility tree without removing it from the document.
 */
export function CollapsiblePanel({
  title,
  icon,
  accent = "#2560e6",
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: string;
  accent?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(defaultOpen);
  // Mount-once latch. Seeded from the same prop the server rendered with, so
  // the SSR and first-client trees are identical.
  const [hasOpened, setHasOpened] = React.useState(defaultOpen);

  // useId is SSR-stable; strip React's delimiters so the value is a clean,
  // query-selector-safe id for aria-controls.
  const panelId = `admin-panel-${React.useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  const Glyph = PANEL_ICONS[icon] ?? LayoutDashboard;
  // Bright accents wash out as small foreground marks on the light theme.
  const ink = inkFor(accent);

  const toggle = React.useCallback(() => {
    setOpen((prev) => !prev);
    setHasOpened(true); // idempotent; closing implies it was already true
  }, []);

  return (
    <section className="ac-card" data-state={open ? "open" : "closed"}>
      {/* The disclosure title is a real heading so it sits alongside the stat
          sections' <h2> labels under the page <h1> — screen readers can jump
          between panels by heading, not just by landmark. */}
      <h2>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "group flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[20px]",
          "px-4 py-3 text-left sm:px-5 sm:py-3.5",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        )}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
          style={{
            color: ink,
            borderColor: alpha(accent, 22),
            background: alpha(accent, 10),
          }}
        >
          <Glyph className="h-4 w-4" aria-hidden="true" />
        </span>

        {/* Wraps to a second line at 375px instead of pushing the chevron off
            the card. BOTH spans need min-w-0: a flex item's automatic minimum
            size is its longest unbreakable word, and `break-words` does not
            shrink that minimum — without min-w-0 on the title itself a long
            unspaced title blows the card out and the page scrolls sideways. */}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 font-display text-base font-semibold break-words text-foreground">
            {title}
          </span>
          {badge ? (
            <span className="ac-chip inline-flex items-center px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground",
            "transition-[transform,color] duration-200 ease-out motion-reduce:transition-none",
            "group-hover:text-foreground",
            open && "rotate-180"
          )}
        />
      </button>
      </h2>

      <div
        id={panelId}
        role="region"
        aria-label={title}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {/* Padding lives INSIDE the collapsing box, so a closed panel is a
              clean single header row with no leftover gap. */}
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            {hasOpened ? children : null}
          </div>
        </div>
      </div>
    </section>
  );
}
