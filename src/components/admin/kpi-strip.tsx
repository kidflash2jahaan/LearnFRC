"use client";

import type { CSSProperties } from "react";
import {
  Eye,
  UsersRound,
  Users,
  Flag,
  BookOpenCheck,
  BookOpen,
} from "lucide-react";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";

type Stats = {
  pageViewsTotal: number;
  pageViews7d: number;
  uniqueVisitors: number;
  users: number;
  verifiedUsers: number;
  teams: number;
  completions: number;
  guestCompletions: number;
  guideViewers: number;
  guideViews: number;
};

function KpiCard({
  icon,
  accent,
  children,
  label,
  subtext,
}: {
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
  label: string;
  subtext?: React.ReactNode;
}) {
  return (
    <RevealItem>
      <Hover lift={-3} className="h-full">
        <div className="ac-card h-full p-4">
          <div className="flex items-center gap-2">
            <span
              className="ac-badge flex h-8 w-8 shrink-0 items-center justify-center"
              style={{ "--a": accent } as CSSProperties}
            >
              {icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold tabular-nums sm:text-[28px]">
            {children}
          </div>
          {subtext ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{subtext}</div>
          ) : null}
        </div>
      </Hover>
    </RevealItem>
  );
}

/** The six numbers that actually matter, at normal size — everything else was
    cut from the dashboard rather than shrunk. */
export function KpiStrip({ s }: { s: Stats }) {
  return (
    <RevealGroup
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      stagger={0.04}
    >
      <KpiCard
        accent="#2560e6"
        icon={<UsersRound className="h-4 w-4" />}
        label="Visitors"
      >
        <span
          style={
            {
              background: "linear-gradient(120deg,#2560e6,#1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            } as CSSProperties
          }
        >
          <AnimatedCounter value={s.uniqueVisitors} />
        </span>
      </KpiCard>

      <KpiCard
        accent="#1aa9d6"
        icon={<Eye className="h-4 w-4" />}
        label="Page views"
        subtext={
          <>
            +<AnimatedCounter value={s.pageViews7d} /> this week
          </>
        }
      >
        <span style={{ color: "#1aa9d6" }}>
          <AnimatedCounter value={s.pageViewsTotal} />
        </span>
      </KpiCard>

      <KpiCard
        accent="#7c5cff"
        icon={<Users className="h-4 w-4" />}
        label="Users"
        subtext={
          <>
            <AnimatedCounter value={s.verifiedUsers} /> verified
          </>
        }
      >
        <span style={{ color: "#7c5cff" }}>
          <AnimatedCounter value={s.users} />
        </span>
      </KpiCard>

      {/* Community reach: how many real FRC teams have members here. */}
      <KpiCard
        accent="#12a150"
        icon={<Flag className="h-4 w-4" />}
        label="Teams"
        subtext="FRC teams represented"
      >
        <span style={{ color: "#12a150" }}>
          <AnimatedCounter value={s.teams} />
        </span>
      </KpiCard>

      <KpiCard
        accent="#2560e6"
        icon={<BookOpenCheck className="h-4 w-4" />}
        label="Completions"
        subtext={
          s.guestCompletions > 0 ? (
            <>
              incl <AnimatedCounter value={s.guestCompletions} /> guests
            </>
          ) : undefined
        }
      >
        <span style={{ color: "#2560e6" }}>
          <AnimatedCounter value={s.completions} />
        </span>
      </KpiCard>

      <KpiCard
        accent="#d64b8a"
        icon={<BookOpen className="h-4 w-4" />}
        label="Guide viewers"
        subtext={
          <>
            <AnimatedCounter value={s.guideViews} /> guide views
          </>
        }
      >
        <span style={{ color: "#d64b8a" }}>
          <AnimatedCounter value={s.guideViewers} />
        </span>
      </KpiCard>
    </RevealGroup>
  );
}
