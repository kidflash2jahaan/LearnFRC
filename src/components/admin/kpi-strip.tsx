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
  Ghost,
} from "lucide-react";
import { RevealGroup, RevealItem, Hover } from "@/components/motion/primitives";
import { AnimatedCounter } from "@/components/animated-counter";
import { cn } from "@/lib/utils";

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
      <Hover lift={-4} className="h-full">
        <div className="ac-card group h-full p-4">
          <div
            className="ac-badge flex h-10 w-10 items-center justify-center"
            style={{ "--a": accent } as CSSProperties}
          >
            {icon}
          </div>
          <div className="mt-3 font-display text-2xl font-bold tabular-nums sm:text-3xl">
            {children}
          </div>
          <div className="mt-1 text-[13px] font-medium text-muted-foreground">
            {label}
          </div>
          {subtext ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
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
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
      stagger={0.05}
    >
      {/* 1. Unique visitors — gradient hero */}
      <KpiCard
        accent="#2560e6"
        icon={<UsersRound className="h-5 w-5" />}
        label="Unique visitors"
        subtext="distinct people"
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
        icon={<Eye className="h-5 w-5" />}
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
        icon={<Users className="h-5 w-5" />}
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
        icon={<UserPlus className="h-5 w-5" />}
        label="New signups · 7d"
      >
        <span style={{ color: "#12a150" }}>
          <AnimatedCounter value={s.signups7d} />
        </span>
      </KpiCard>

      {/* 5. Activation */}
      <KpiCard
        accent="#f5a623"
        icon={<Zap className="h-5 w-5" />}
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
        icon={<Repeat className="h-5 w-5" />}
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
        icon={<BookOpenCheck className="h-5 w-5" />}
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

      {/* 8. Guest learners */}
      <KpiCard
        accent="#0ea5a3"
        icon={<Ghost className="h-5 w-5" />}
        label="Guest learners"
        subtext="learning, no account"
      >
        <span style={{ color: "#0ea5a3" }}>
          <AnimatedCounter value={s.guestLearners} />
        </span>
      </KpiCard>

      {/* 8. Online now — pulsing dot */}
      <KpiCard
        accent="#2560e6"
        icon={
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
        }
        label="online now"
      >
        <span className={cn("inline-flex items-center gap-2 text-primary")}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <AnimatedCounter value={s.onlineNow} />
        </span>
      </KpiCard>
    </RevealGroup>
  );
}
