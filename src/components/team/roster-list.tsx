"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Flame, ShieldCheck, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { AnimatedCounter } from "@/components/animated-counter";
import { clampPct } from "@/lib/utils";

/**
 * One row of the lead's roster.
 *
 * EVERY FIELD HERE IS A DELIBERATE CHOICE. `full_name`, email, bio, team
 * number, self-declared role and `last_seen_at` are all absent — not filtered
 * out in this component, but never selected on the server in the first place
 * (see MEMBER_PROFILE_COLS in src/lib/team-space.ts). If a field you want is
 * missing, widen the query and the consent copy together, or not at all.
 *
 * `memberKey` is the opaque per-space HMAC, not the auth UUID. It is a
 * request-scoped handle: fine as a React key and an avatar seed, never to be
 * persisted in a URL, localStorage or a DB column.
 *
 * `lastActiveLabel` arrives as a finished STRING rather than a timestamp on
 * purpose. Formatting "3h ago" here would call Date.now() during render, and
 * the server's clock and the browser's fall on opposite sides of a bucket
 * boundary often enough to produce a real hydration mismatch. The server owns
 * the sentence; this component only prints it.
 */
export type RosterRow = {
  memberKey: string;
  username: string;
  avatarUrl: string | null;
  isLead: boolean;
  isSelf: boolean;
  /** Lessons finished. The number the whole feature exists to surface. */
  completed: number;
  xp: number;
  /** Server-rendered relative time, e.g. "active 3h ago". Never a raw date. */
  lastActiveLabel: string;
  /** Short label of the subteam they have done the most in, or null. */
  topSubteam: string | null;
  /** Accent of that subteam, so the roster and the board agree visually. */
  topAccent: string | null;
  /** How many subteams they have touched at all. */
  subteamCount: number;
};

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * The roster, ordered by lessons finished.
 *
 * Deliberately NOT a leaderboard: no medals, no crown, no rank numbers. The
 * old /teams roster ranks teammates against each other, which is fine between
 * peers; this list is read by the adult who runs the team, and turning a
 * 14-year-old's study count into a podium position they're shown losing is a
 * different thing. Order still puts the most active first, because "who has
 * stalled" is the question a mentor actually opens this page with — it is just
 * not decorated as a competition.
 */
export function RosterList({
  rows,
  totalLessons,
  showInviteRow,
  inviteHref,
}: {
  rows: RosterRow[];
  totalLessons: number;
  /** True for a space of one — the empty state IS the invite moment. */
  showInviteRow: boolean;
  inviteHref: string;
}) {
  const reduce = useReducedMotion();

  return (
    <ul
      className="flex flex-col gap-3"
      aria-label="People who accepted an invite to this space"
    >
      {rows.map((m, i) => {
        const pct =
          totalLessons > 0 ? clampPct((m.completed / totalLessons) * 100) : 0;
        const delay = Math.min(i, 10) * 0.05;
        const started = m.completed > 0;

        return (
          <motion.li
            key={m.memberKey}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.45, delay, ease: EASE }
            }
            className={`ac-card px-4 py-3.5 transition-transform duration-300 motion-safe:hover:-translate-y-0.5 sm:px-5 sm:py-4 ${
              m.isSelf ? "ring-2 ring-primary/40" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar
                name={m.username}
                src={m.avatarUrl}
                seed={m.memberKey}
                className="h-10 w-10 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-[15px] font-semibold text-foreground">
                    {m.username}
                  </span>
                  {m.isSelf && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      You
                    </span>
                  )}
                  {m.isLead && !m.isSelf && (
                    <span className="shrink-0 rounded-full bg-[rgba(120,145,190,0.16)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Lead
                    </span>
                  )}
                </div>

                {/* Meta line. Wraps rather than truncates at 375px — the
                    last-active clause is the half a mentor came for, so it
                    must survive the narrowest screen. */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-primary">
                    <Flame className="h-3 w-3" aria-hidden />
                    <AnimatedCounter value={m.xp} suffix=" XP" />
                  </span>
                  {m.topSubteam && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span aria-hidden>·</span>
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={
                          {
                            background: m.topAccent || "var(--primary)",
                          } as CSSProperties
                        }
                        aria-hidden
                      />
                      {/* "+2 more" rather than "+2": a bare +N sitting one
                          separator away from "+25 XP" reads as points. */}
                      <span className="truncate">
                        {m.subteamCount > 1
                          ? `${m.topSubteam} +${m.subteamCount - 1} more`
                          : m.topSubteam}
                      </span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden>·</span>
                    <span>{m.lastActiveLabel}</span>
                  </span>
                </div>
              </div>

              {/* Headline number, kept on its own rail so it never competes
                  for width with the name at 375px. */}
              <div className="shrink-0 text-right">
                <span className="block text-lg font-extrabold leading-none tabular-nums text-foreground">
                  <AnimatedCounter value={m.completed} />
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  of {totalLessons}
                </span>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(120,145,190,0.2)]">
              <motion.span
                className="block h-full rounded-full"
                style={{
                  transformOrigin: "left",
                  background: started
                    ? "linear-gradient(90deg, #2560e6, #1aa9d6)"
                    : "rgba(120,145,190,0.35)",
                }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: pct / 100 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 0.8, delay: delay + 0.1, ease: EASE }
                }
              />
            </div>
          </motion.li>
        );
      })}

      {showInviteRow && <InviteRow href={inviteHref} />}
    </ul>
  );
}

/**
 * The seat nobody is in yet.
 *
 * 109 of 144 teams here have exactly one member, so a space of one is the
 * normal case, not an error case — and a single lonely row reads like the
 * feature is broken. This turns the gap into the ask, in the place where the
 * missing person would actually appear, and states the consent boundary in the
 * same breath so a lead knows what they are asking someone for before they ask.
 */
function InviteRow({ href }: { href: string }) {
  return (
    <li>
      <Link
        href={href}
        className="ac-card block border-dashed border-[rgba(120,145,190,0.45)] px-4 py-4 transition-transform duration-300 motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[rgba(120,145,190,0.55)] text-muted-foreground">
            <UserPlus className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground">
              Your next teammate goes here
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Send them your invite link. Once they accept, their lessons and XP
              show up on this row — never their name or their email.
            </p>
          </div>
          <ArrowRight
            className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
            aria-hidden
          />
        </div>
      </Link>
    </li>
  );
}

/**
 * The standing statement of what this page is and is not allowed to show.
 *
 * Aimed at the LEAD, not the member. A mentor who knows the boundary explains
 * it correctly to a parent; one who assumes they can see more will promise
 * something the product does not do. Entirely fixed, server-authored copy —
 * nothing here is ever assembled from user input.
 */
export function RosterConsentNote() {
  return (
    <div className="ac-card flex items-start gap-3 px-5 py-4">
      <span
        className="ac-badge flex h-9 w-9 shrink-0 items-center justify-center"
        style={{ "--a": "var(--primary)" } as CSSProperties}
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">
          What this page can show you
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-foreground/70">
          Only the people who accepted your invite, and only their username,
          which lessons they have finished, their XP and when they were last
          active. Never their real name, never their email, and nothing at all
          about anyone who has not accepted. Anyone can leave in one click, and
          the moment they do this page stops showing them — their lessons, XP
          and badges stay theirs either way.
        </p>
      </div>
    </div>
  );
}
