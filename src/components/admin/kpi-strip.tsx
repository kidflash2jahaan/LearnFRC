"use client";

import type { CSSProperties } from "react";
import {
  Eye,
  UsersRound,
  Users,
  UserPlus,
  Zap,
  Repeat,
  BookOpenCheck,
  BookOpen,
  Ghost,
} from "lucide-react";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";

type Stats = {
  pageViewsTotal: number;
  pageViews7d: number;
  uniqueVisitors: number;
  users: number;
  verifiedUsers: number;
  signups7d: number;
  activationPct: number;
  returnPct: number;
  completions: number;
  onlineNow: number;
  guestLearners: number;
  guestCompletions: number;
  guideViewers: number;
  guideViews: number;
};

const LABEL_KICKER =
  "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

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
      <Hover lift={-2} className="h-full">
        <div className="ac-card group h-full p-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className="flex shrink-0 items-center justify-center"
              style={{ color: accent } as CSSProperties}
            >
              {icon}
            </span>
            <span className={`${LABEL_KICKER} truncate`} title={label}>
              {label}
            </span>
          </div>
          <div className="mt-0.5 font-display text-xl font-bold leading-tight tabular-nums">
            {children}
          </div>
          {subtext ? (
            <div className="truncate text-[10px] leading-tight text-muted-foreground">
              {subtext}
            </div>
          ) : null}
        </div>
      </Hover>
    </RevealItem>
  );
}

export function KpiStrip({ s }: { s: Stats }) {
  return (
    <RevealGroup
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      stagger={0.03}
    >
      {/* 1. Unique visitors — gradient hero */}
      <KpiCard
        accent="#2560e6"
        icon={<UsersRound className="h-3.5 w-3.5" />}
        label="Unique visitors"
        subtext="distinct visitor IDs"
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

      {/* 2. Total page views */}
      <KpiCard
        accent="#1aa9d6"
        icon={<Eye className="h-3.5 w-3.5" />}
        label="Total page views"
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

      {/* 3. Total users */}
      <KpiCard
        accent="#7c5cff"
        icon={<Users className="h-3.5 w-3.5" />}
        label="Total users"
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

      {/* 4. New signups · 7d */}
      <KpiCard
        accent="#12a150"
        icon={<UserPlus className="h-3.5 w-3.5" />}
        label="New signups · 7d"
      >
        <span style={{ color: "#12a150" }}>
          <AnimatedCounter value={s.signups7d} />
        </span>
      </KpiCard>

      {/* 5. Activation */}
      <KpiCard
        accent="#f5a623"
        icon={<Zap className="h-3.5 w-3.5" />}
        label="Activation"
        subtext="did a lesson"
      >
        <span style={{ color: "#f5a623" }}>
          <AnimatedCounter value={s.activationPct} suffix="%" />
        </span>
      </KpiCard>

      {/* 6. Return rate */}
      <KpiCard
        accent="#d64b8a"
        icon={<Repeat className="h-3.5 w-3.5" />}
        label="Return rate"
        subtext="came back"
      >
        <span style={{ color: "#d64b8a" }}>
          <AnimatedCounter value={s.returnPct} suffix="%" />
        </span>
      </KpiCard>

      {/* 7. Lessons completed (incl. guests) */}
      <KpiCard
        accent="#2560e6"
        icon={<BookOpenCheck className="h-3.5 w-3.5" />}
        label="Lessons completed"
        subtext={
          s.guestCompletions > 0 ? (
            <>
              incl <AnimatedCounter value={s.guestCompletions} /> by guests
            </>
          ) : undefined
        }
      >
        <span style={{ color: "#2560e6" }}>
          <AnimatedCounter value={s.completions} />
        </span>
      </KpiCard>

      {/* 8. Guide viewers — people who opened any guide (completers included) */}
      <KpiCard
        accent="#7c5cff"
        icon={<BookOpen className="h-3.5 w-3.5" />}
        label="Guide viewers"
        subtext={
          <>
            <AnimatedCounter value={s.guideViews} /> total guide views
          </>
        }
      >
        <span style={{ color: "#7c5cff" }}>
          <AnimatedCounter value={s.guideViewers} />
        </span>
      </KpiCard>

      {/* 9. Guest learners */}
      <KpiCard
        accent="#0ea5a3"
        icon={<Ghost className="h-3.5 w-3.5" />}
        label="Guest learners"
        subtext="learning, no account"
      >
        <span style={{ color: "#0ea5a3" }}>
          <AnimatedCounter value={s.guestLearners} />
        </span>
      </KpiCard>

      {/* "Online now" intentionally has NO tile — it lives in the page header
          chip; duplicating it here was showing the same number twice. */}
    </RevealGroup>
  );
}
