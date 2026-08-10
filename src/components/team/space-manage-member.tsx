"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import NextLink from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  Crown,
  DoorOpen,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { leaveSpaceAction } from "@/app/actions/team-space";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ManageMember } from "@/components/team/space-manage";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * THE MEMBER'S OWN VIEW of a space they joined.
 *
 * Its real job is revocation. Consent that cannot be withdrawn in one press is
 * not consent, and a fifteen-year-old should not have to hunt through a lead's
 * management UI to get out. So: what is shared, who it is shared with, and the
 * button that stops it — on one screen, in that order.
 *
 * A member is shown the roster's USERNAMES and the space-wide aggregate only.
 * Per-member progress is the lead's view and is not fetched here at all.
 */
export function SpaceMemberView({
  teamNumber,
  programLabel,
  leadUsername,
  members,
  memberCount,
  teamCompleted,
  totalLessons,
}: {
  teamNumber: number;
  programLabel: string;
  leadUsername: string;
  members: ManageMember[];
  memberCount: number;
  teamCompleted: number;
  totalLessons: number;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [block, setBlock] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const leave = () => {
    startTransition(async () => {
      const r = await leaveSpaceAction(block);
      // Success redirects away; only failures come back.
      if (r?.error) toast.error(r.error);
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE }}
      >
        <span className="ac-chip inline-flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="ac-eyebrow">Your team space</span>
        </span>
        <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.04] sm:text-[2.75rem]">
          Team {teamNumber}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {programLabel} · run by @{leadUsername}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            className="ac-tile flex items-center gap-3 px-5 py-5"
            style={{ "--a": "var(--primary)" } as CSSProperties}
          >
            <span
              className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
              style={{ "--a": "var(--primary)" } as CSSProperties}
            >
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-xl font-extrabold tabular-nums text-foreground">
                {memberCount}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Members
              </div>
            </div>
          </div>
          <div
            className="ac-tile flex items-center gap-3 px-5 py-5"
            style={{ "--a": "var(--accent)" } as CSSProperties}
          >
            <span
              className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
              style={{ "--a": "var(--accent)" } as CSSProperties}
            >
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-xl font-extrabold tabular-nums text-foreground">
                {teamCompleted}/{totalLessons}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lessons covered by the team
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* The plan is the one other surface a member has. It renders only their
          own progress, so linking it exposes nothing about anyone else. */}
      <NextLink
        href="/teams/space/plan"
        className="ac-card flex items-center gap-3 px-5 py-4 transition-transform duration-200 hover:-translate-y-0.5"
      >
        <span
          className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ "--a": "var(--primary)" } as CSSProperties}
        >
          <LayoutGrid className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            Your team&apos;s training plan
          </span>
          <span className="block text-xs text-muted-foreground">
            What Team {teamNumber} suggested starting on, and where you are on it
          </span>
        </span>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </NextLink>

      {/* ── Exactly what is shared, and with whom ────────────────────── */}
      <section className="ac-card p-6 sm:p-7" aria-labelledby="shared-h">
        <div className="flex items-start gap-3">
          <span
            className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
            style={{ "--a": "#1aa9d6" } as CSSProperties}
          >
            <Eye className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="shared-h" className="text-base font-bold text-foreground">
              What @{leadUsername} can see about you
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                  aria-hidden
                />
                <span>Your username, and which lessons you&apos;ve finished</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                  aria-hidden
                />
                <span>When you last finished one</span>
              </li>
            </ul>

            <div className="ac-divider my-5" />

            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <EyeOff className="h-4 w-4 text-primary" aria-hidden />
              What they can never see
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li className="flex items-start gap-2">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                  aria-hidden
                />
                <span>Your real name or your email address</span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                  aria-hidden
                />
                <span>
                  Anything at all once you leave — it stops the same second
                </span>
              </li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Nobody in a team space can change your account, your progress or
              your XP, and there is no way for anyone to send you a message
              through LearnFRC.
            </p>
          </div>
        </div>
      </section>

      {/* ── Roster (identity only) ───────────────────────────────────── */}
      <section aria-labelledby="roster-h">
        <h2 id="roster-h" className="text-base font-bold text-foreground">
          Who&apos;s in here ({members.length})
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {members.map((m) => (
            <li
              key={m.memberKey}
              className="ac-card flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5"
            >
              <Avatar
                name={m.username}
                src={m.avatarUrl}
                seed={m.memberKey}
                className="h-11 w-11"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-base font-semibold text-foreground">
                    @{m.username}
                  </span>
                  {m.isLead && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      <Crown className="h-3 w-3" aria-hidden /> Lead
                    </span>
                  )}
                  {m.isSelf && (
                    <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      You
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Joined {m.joinedLabel}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Leave ────────────────────────────────────────────────────── */}
      <section
        className="rounded-2xl border border-border bg-secondary/40 p-5"
        aria-labelledby="leave-h"
      >
        <h2
          id="leave-h"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <DoorOpen className="h-4 w-4" aria-hidden /> Leave this space
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          You can go at any time and you don&apos;t need anyone&apos;s
          permission. Team {teamNumber} stops seeing your progress immediately.
          Your account, your XP, your badges and every lesson you&apos;ve
          finished stay exactly as they are.
        </p>

        {!open ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-4"
            onClick={() => setOpen(true)}
          >
            <DoorOpen className="h-4 w-4" aria-hidden /> Leave Team {teamNumber}
          </Button>
        ) : (
          <div className="mt-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                checked={block}
                onChange={(e) => setBlock(e.target.checked)}
                disabled={pending}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[color:var(--primary)]"
              />
              <span>
                Also block this space from adding me again. No link from Team{" "}
                {teamNumber} will work for me after that, whatever anyone does.
              </span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={leave}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
                    Leaving…
                  </>
                ) : (
                  <>
                    <DoorOpen className="h-4 w-4" aria-hidden /> Leave for good
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Stay in
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
