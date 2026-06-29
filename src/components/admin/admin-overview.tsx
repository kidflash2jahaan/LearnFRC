"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Users,
  CheckCircle2,
  Zap,
  BookOpen,
  Layers,
  Award,
  Mail,
  UsersRound,
  ChevronDown,
  Radio,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NeonCounter, TerminalFrame } from "@/components/motion/terminal";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { useStaticMotion } from "@/components/perf-mode";
import type { AdminUser, AdminTeam } from "@/lib/admin";

type Panel =
  | "online"
  | "users"
  | "teams"
  | "referrals"
  | "completions"
  | "subscribers"
  | "achievements"
  | null;

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

function relTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "active now";
  return `${m}m ago`;
}

/** A drill-in panel: a terminal window that slides in when opened. */
function PanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const stat = useStaticMotion();
  const inner = (
    <TerminalFrame title={title} bodyClassName="p-5 sm:p-6">
      {children}
    </TerminalFrame>
  );
  if (stat) return <div className="mt-4">{inner}</div>;
  return (
    <motion.div
      className="mt-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
    >
      {inner}
    </motion.div>
  );
}

type OverviewData = {
  onlineNow: number;
  users: number;
  verifiedUsers: number;
  completions: number;
  totalXP: number;
  achievementsEarned: number;
  lessons: number;
  departments: number;
  bookmarks: number;
  subscribers: number;
  signups7d: number;
  completions7d: number;
  totalTeams: number;
  referralUsers: number;
};

export function AdminOverview({
  data,
  users,
  teams,
  completions,
  subscribers,
  achievements,
  onlineUsers,
  recruiters,
}: {
  data: OverviewData;
  users: AdminUser[];
  teams: AdminTeam[];
  completions: { user: string; lesson: string; dept: string; at: string }[];
  subscribers: { email: string; created_at: string }[];
  achievements: { name: string; icon: string; earned: number }[];
  onlineUsers: { name: string; username: string | null; lastSeen: string }[];
  recruiters: { name: string; username: string | null; referrals: number }[];
}) {
  const [open, setOpen] = React.useState<Panel>(null);
  const toggle = (p: Panel) => setOpen((cur) => (cur === p ? null : p));
  const maxAch = Math.max(1, ...achievements.map((a) => a.earned));

  const cards = [
    {
      label: "Online now",
      value: data.onlineNow,
      icon: Radio,
      sub: "signed in · last 5 min",
      panel: "online" as Panel,
    },
    {
      label: "Learners",
      value: data.users,
      icon: Users,
      sub: `${data.verifiedUsers} verified · +${data.signups7d} this week`,
      panel: "users" as Panel,
    },
    {
      label: "From referrals",
      value: data.referralUsers,
      icon: UserPlus,
      sub: "joined via invite links",
      panel: "referrals" as Panel,
    },
    { label: "Lessons completed", value: data.completions, icon: CheckCircle2, sub: `+${data.completions7d} this week`, panel: "completions" as Panel },
    { label: "Total XP awarded", value: data.totalXP, icon: Zap, sub: "across all learners" },
    { label: "Achievements earned", value: data.achievementsEarned, icon: Award, sub: "badges unlocked", panel: "achievements" as Panel },
    { label: "Lessons", value: data.lessons, icon: BookOpen, sub: `${data.departments} departments` },
    { label: "Bookmarks", value: data.bookmarks, icon: Layers, sub: "saved lessons" },
    { label: "Email subscribers", value: data.subscribers, icon: Mail, sub: "early-access list", panel: "subscribers" as Panel },
    {
      label: "Teams",
      value: data.totalTeams,
      icon: UsersRound,
      sub: "by team number",
      panel: "teams" as Panel,
    },
  ];

  return (
    <>
      <Stagger className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => {
          const clickable = !!c.panel;
          const active = clickable && open === c.panel;
          const card = (
            <div
              className={cn(
                "group relative h-full overflow-hidden rounded-xl border bg-card/70 p-5 backdrop-blur-sm transition-all",
                clickable &&
                  "cursor-pointer hover:-translate-y-1 hover:border-primary/50 hover:shadow-[var(--glow-primary)]",
                active
                  ? "border-primary/70 shadow-[var(--glow-primary)] ring-1 ring-primary/40"
                  : "border-border"
              )}
            >
              {/* neon top edge — lights up on hover / when active */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent transition-opacity",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border bg-muted/50 text-primary transition-colors",
                    active
                      ? "border-primary/50"
                      : "border-border group-hover:border-primary/40"
                  )}
                >
                  {clickable ? (
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        active && "rotate-180"
                      )}
                    />
                  ) : (
                    <c.icon className="h-4 w-4" />
                  )}
                </span>
              </div>
              <div className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground">
                <NeonCounter to={c.value} />
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {c.sub}
                {clickable && (
                  <span className="ml-1 text-primary">· {active ? "hide" : "view all"}</span>
                )}
              </div>
            </div>
          );
          return (
            <StaggerItem key={c.label}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => toggle(c.panel)}
                  aria-expanded={active}
                  className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {card}
                </button>
              ) : (
                card
              )}
            </StaggerItem>
          );
        })}
      </Stagger>

      {open === "online" && (
        <PanelShell title="~/admin $ who --online">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              </span>
              Online now
            </h2>
            <Badge variant="outline">{onlineUsers.length} online</Badge>
          </div>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No signed-in users are active right now.
            </p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-border overflow-auto">
              {onlineUsers.map((u, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-primary/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={u.name}
                      seed={u.username || u.name}
                      className="h-8 w-8"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.name}</div>
                      {u.username && (
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          @{u.username}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {relTime(u.lastSeen)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelShell>
      )}

      {open === "referrals" && (
        <PanelShell title="~/admin $ git log --referrals">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display font-semibold">
              <UserPlus className="h-4 w-4 text-primary" /> Who referred people
            </h2>
            <Badge variant="outline">{data.referralUsers} joined via referrals</Badge>
          </div>
          {recruiters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one has joined through a referral link yet.
            </p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-border overflow-auto">
              {recruiters.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-primary/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={r.name}
                      seed={r.username || r.name}
                      className="h-8 w-8"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      {r.username && (
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          @{r.username}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="font-mono text-sm font-bold tabular-nums text-accent">
                      {r.referrals}
                    </span>
                    <span className="ml-1 font-mono text-[10px] font-medium uppercase text-muted-foreground">
                      referred
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelShell>
      )}

      {open === "users" && (
        <PanelShell title="~/admin $ cat users.json">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">All users</h2>
            <Badge variant="outline">{users.length} total</Badge>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm [&_th]:px-3 [&_td]:px-3 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 text-right font-medium">XP</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.04]"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.full_name || u.username || u.email} seed={u.id} className="h-8 w-8" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.full_name || u.username || "Learner"}</div>
                            <div className="truncate font-mono text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-muted-foreground">{u.team_number ? `#${u.team_number}` : "—"}</td>
                      <td className="py-3 text-right font-mono text-accent">{u.xp}</td>
                      <td className="py-3">
                        {u.confirmed ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="warning">Unverified</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelShell>
      )}

      {open === "teams" && (
        <PanelShell title="~/admin $ ls teams/">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Teams</h2>
            <Badge variant="outline">{teams.length} total</Badge>
          </div>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm [&_th]:px-3 [&_td]:px-3 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 text-right font-medium">Members</th>
                    <th className="pb-2 text-right font-medium">Lessons done</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr
                      key={t.teamNumber}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.04]"
                    >
                      <td className="py-3 font-mono font-medium text-foreground">#{t.teamNumber}</td>
                      <td className="py-3 text-right font-mono">{t.members}</td>
                      <td className="py-3 text-right font-mono text-accent">{t.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelShell>
      )}

      {open === "completions" && (
        <PanelShell title="~/admin $ tail completions.log">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Recent lesson completions</h2>
            <Badge variant="outline">last {completions.length}</Badge>
          </div>
          {completions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completions yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm [&_th]:px-3 [&_td]:px-3 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Lesson</th>
                    <th className="pb-2 font-medium">Department</th>
                    <th className="pb-2 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {completions.map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.04]"
                    >
                      <td className="py-3 font-medium">{c.user}</td>
                      <td className="py-3">{c.lesson}</td>
                      <td className="py-3 text-muted-foreground">{c.dept}</td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {new Date(c.at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelShell>
      )}

      {open === "subscribers" && (
        <PanelShell title="~/admin $ cat subscribers.list">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Email subscribers</h2>
            <Badge variant="outline">{subscribers.length} total</Badge>
          </div>
          {subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribers yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm [&_th]:px-3 [&_td]:px-3 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 text-right font-medium">Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.04]"
                    >
                      <td className="py-3 font-mono">{s.email}</td>
                      <td className="py-3 text-right font-mono text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelShell>
      )}

      {open === "achievements" && (
        <PanelShell title="~/admin $ cat achievements.db">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Achievements earned</h2>
            <Badge variant="outline">{achievements.length} badges</Badge>
          </div>
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No achievements yet.</p>
          ) : (
            <div className="space-y-3">
              {achievements.map((a) => (
                <div key={a.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate">{a.name}</span>
                    <span className="font-mono text-xs text-accent">
                      {a.earned}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((a.earned / maxAch) * 100)}%`,
                        background:
                          "linear-gradient(90deg, var(--accent), var(--primary))",
                        boxShadow:
                          "0 0 10px color-mix(in srgb, var(--primary) 45%, transparent)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelShell>
      )}
    </>
  );
}
