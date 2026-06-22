"use client";

import * as React from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/animated-counter";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import type { AdminUser, AdminTeam } from "@/lib/admin";

type Panel =
  | "users"
  | "teams"
  | "completions"
  | "subscribers"
  | "achievements"
  | null;

type OverviewData = {
  users: number;
  completions: number;
  totalXP: number;
  achievementsEarned: number;
  lessons: number;
  departments: number;
  bookmarks: number;
  subscribers: number;
  signups7d: number;
  completions7d: number;
  registeredTeams: number;
  totalUniqueTeams: number;
};

export function AdminOverview({
  data,
  users,
  teams,
  completions,
  subscribers,
  achievements,
}: {
  data: OverviewData;
  users: AdminUser[];
  teams: AdminTeam[];
  completions: { user: string; lesson: string; dept: string; at: string }[];
  subscribers: { email: string; created_at: string }[];
  achievements: { name: string; icon: string; earned: number }[];
}) {
  const [open, setOpen] = React.useState<Panel>(null);
  const toggle = (p: Panel) => setOpen((cur) => (cur === p ? null : p));
  const maxAch = Math.max(1, ...achievements.map((a) => a.earned));

  const cards = [
    {
      label: "Learners",
      value: data.users,
      icon: Users,
      sub: `+${data.signups7d} this week`,
      panel: "users" as Panel,
    },
    { label: "Lessons completed", value: data.completions, icon: CheckCircle2, sub: `+${data.completions7d} this week`, panel: "completions" as Panel },
    { label: "Total XP awarded", value: data.totalXP, icon: Zap, sub: "across all learners" },
    { label: "Achievements earned", value: data.achievementsEarned, icon: Award, sub: "badges unlocked", panel: "achievements" as Panel },
    { label: "Lessons", value: data.lessons, icon: BookOpen, sub: `${data.departments} departments` },
    { label: "Bookmarks", value: data.bookmarks, icon: Layers, sub: "saved lessons" },
    { label: "Email subscribers", value: data.subscribers, icon: Mail, sub: "early-access list", panel: "subscribers" as Panel },
    {
      label: "Registered teams",
      value: data.registeredTeams,
      icon: UsersRound,
      sub: `${data.totalUniqueTeams} total teams`,
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
                "h-full rounded-2xl border bg-card p-5 shadow-[var(--shadow-sm)] transition-all",
                clickable && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/50",
                active ? "border-primary ring-2 ring-primary/40" : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                {clickable ? (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-primary transition-transform",
                      active && "rotate-180"
                    )}
                  />
                ) : (
                  <c.icon className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="mt-2 font-display text-3xl font-bold">
                <AnimatedCounter value={c.value} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
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
                  className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
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

      {open === "users" && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">All users</h2>
            <Badge variant="outline">{users.length} total</Badge>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 text-right font-medium">XP</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.full_name || u.username || u.email} seed={u.id} className="h-8 w-8" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.full_name || u.username || "Learner"}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">{u.team_number ? `#${u.team_number}` : "—"}</td>
                      <td className="py-3 text-right font-mono">{u.xp}</td>
                      <td className="py-3">
                        {u.confirmed ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="warning">Unverified</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {open === "teams" && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Registered teams</h2>
            <Badge variant="outline">{teams.length} total</Badge>
          </div>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 text-right font-medium">Members</th>
                    <th className="pb-2 text-right font-medium">Lessons done</th>
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 text-right font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3">
                        <div className="font-medium">{t.name}</div>
                        {t.team_number ? (
                          <div className="text-xs text-muted-foreground">#{t.team_number}</div>
                        ) : null}
                      </td>
                      <td className="py-3 text-muted-foreground">{t.owner}</td>
                      <td className="py-3 text-right font-mono">{t.members}</td>
                      <td className="py-3 text-right font-mono">{t.completed}</td>
                      <td className="py-3">
                        <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs tracking-widest">
                          {t.join_code}
                        </span>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {open === "completions" && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent lesson completions</h2>
            <Badge variant="outline">last {completions.length}</Badge>
          </div>
          {completions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completions yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Member</th>
                    <th className="pb-2 font-medium">Lesson</th>
                    <th className="pb-2 font-medium">Department</th>
                    <th className="pb-2 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {completions.map((c, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-3 font-medium">{c.user}</td>
                      <td className="py-3">{c.lesson}</td>
                      <td className="py-3 text-muted-foreground">{c.dept}</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(c.at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {open === "subscribers" && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Email subscribers</h2>
            <Badge variant="outline">{subscribers.length} total</Badge>
          </div>
          {subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribers yet.</p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 text-right font-medium">Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-3">{s.email}</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {open === "achievements" && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Achievements earned</h2>
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
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.earned}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((a.earned / maxAch) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
