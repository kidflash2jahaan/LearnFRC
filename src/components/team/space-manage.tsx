"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import NextLink from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Crown,
  Gauge,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
  ShieldOff,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  createInviteAction,
  revokeInviteAction,
  removeMemberAction,
  deleteSpaceAction,
} from "@/app/actions/team-space";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pluralize } from "@/lib/utils";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * One roster row as the manage screen needs it.
 *
 * `memberKey` is the opaque per-space HMAC, never the auth UUID. Dates arrive
 * PREFORMATTED from the server: formatting a timestamp inside a client
 * component renders one string during SSR and possibly another after
 * hydration, and the hydration contract on this codebase forbids that.
 */
export type ManageMember = {
  memberKey: string;
  username: string;
  avatarUrl: string | null;
  isLead: boolean;
  isSelf: boolean;
  joinedLabel: string;
};

export type ManageInvite = {
  /** Absolute URL, built server-side from NEXT_PUBLIC_SITE_URL. */
  url: string;
  expiresLabel: string;
  uses: number;
  maxUses: number;
};

/**
 * THE LEAD MANAGEMENT VIEW.
 *
 * Three things this screen deliberately does NOT have, each because the
 * capability does not exist below it:
 *
 *  • NO RENAME. team_spaces.name is pinned by a DB CHECK to `Team <number>`
 *    and the number is immutable. That is not an oversight to route around: a
 *    typed space name is a free-text field an adult writes and a minor reads,
 *    which is exactly the channel this feature is built to not have. The
 *    screen says so in words rather than showing a disabled input.
 *  • NO TRANSFER OF LEADERSHIP, no co-leads, no promote. Ownership is fixed at
 *    insert by a Postgres trigger. A lead who wants out deletes the space.
 *  • NO PER-MEMBER PROGRESS. Removing someone needs to know who they are, not
 *    how they are doing, so this screen reads identity only. The aggregate is
 *    the same number every member sees.
 */
export function SpaceManage({
  teamNumber,
  programLabel,
  members,
  memberCount,
  teamCompleted,
  totalLessons,
  invite,
}: {
  teamNumber: number;
  programLabel: string;
  members: ManageMember[];
  memberCount: number;
  teamCompleted: number;
  totalLessons: number;
  invite: ManageInvite | null;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Header
        teamNumber={teamNumber}
        programLabel={programLabel}
        memberCount={memberCount}
        teamCompleted={teamCompleted}
        totalLessons={totalLessons}
        reduce={!!reduce}
      />
      <LeadNav />
      <InviteCard invite={invite} teamNumber={teamNumber} />
      <MemberList members={members} />
      <DangerZone teamNumber={teamNumber} memberCount={memberCount} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header + aggregate                                                 */
/* ------------------------------------------------------------------ */

function Header({
  teamNumber,
  programLabel,
  memberCount,
  teamCompleted,
  totalLessons,
  reduce,
}: {
  teamNumber: number;
  programLabel: string;
  memberCount: number;
  teamCompleted: number;
  totalLessons: number;
  reduce: boolean;
}) {
  const stats = [
    {
      icon: Users,
      label: "Members",
      value: `${memberCount}`,
      accent: "var(--primary)",
    },
    {
      icon: BookOpen,
      label: "Lessons covered",
      value: `${teamCompleted}/${totalLessons}`,
      accent: "var(--accent)",
    },
  ];

  return (
    <motion.header
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE }}
    >
      <span className="ac-chip inline-flex items-center gap-2">
        <Crown className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">You run this space</span>
      </span>

      <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.04] sm:text-[2.75rem]">
        Team {teamNumber}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {programLabel} · created from your team number
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="ac-tile flex items-center gap-3 px-5 py-5"
            style={{ "--a": s.accent } as CSSProperties}
          >
            <span
              className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
              style={{ "--a": s.accent } as CSSProperties}
            >
              <s.icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-xl font-extrabold tabular-nums text-foreground">
                {s.value}
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* The rename answer, given before anyone hunts for the button. */}
      <div className="ac-card mt-4 flex items-start gap-3 px-5 py-4">
        <Lock
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <strong className="text-foreground">
            The name is always &ldquo;Team {teamNumber}&rdquo;
          </strong>{" "}
          and can&apos;t be edited. Nothing in a team space is typed by one
          person and shown to another — no space name, no description, no
          messages, no notes on an invite. That&apos;s the whole reason this is
          safe to hand to a fourteen-year-old.
        </p>
      </div>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */
/*  Lead navigation                                                    */
/* ------------------------------------------------------------------ */

/**
 * The three other lead surfaces. This screen is deliberately the MANAGEMENT
 * one — who is in, the link, the danger zone — and per-member progress lives on
 * its own route so it never shares a page with the invite token. These links
 * are the only thing joining them up; without them those routes are reachable
 * only by typing the URL.
 */
const LEAD_LINKS = [
  {
    href: "/teams/space/roster",
    icon: Gauge,
    label: "Team progress",
    hint: "How far everyone has got",
  },
  {
    href: "/teams/space/plan",
    icon: LayoutGrid,
    label: "Training plan",
    hint: "Suggest a subteam to start on",
  },
  {
    href: "/teams/space/print",
    icon: Printer,
    label: "Join sheet",
    hint: "One printable page with the QR",
  },
] as const;

function LeadNav() {
  return (
    <nav aria-label="Team space sections">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {LEAD_LINKS.map((l) => (
          <li key={l.href}>
            <NextLink
              href={l.href}
              className="ac-card flex h-full items-center gap-3 px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span
                className="ac-badge flex h-9 w-9 shrink-0 items-center justify-center"
                style={{ "--a": "var(--primary)" } as CSSProperties}
              >
                <l.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-foreground">
                  {l.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {l.hint}
                </span>
              </span>
            </NextLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Invite link                                                        */
/* ------------------------------------------------------------------ */

function InviteCard({
  invite,
  teamNumber,
}: {
  invite: ManageInvite | null;
  teamNumber: number;
}) {
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState(false);
  const [confirmingReset, setConfirmingReset] = React.useState(false);

  const run = (
    fn: () => Promise<{ error: string | null }>,
    okMessage: string
  ) => {
    startTransition(async () => {
      const r = await fn();
      if (r?.error) toast.error(r.error);
      else toast.success(okMessage);
    });
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <section className="ac-card p-6 sm:p-7" aria-labelledby="invite-h">
      <div className="flex items-start gap-3">
        <span
          className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
          style={{ "--a": "#2560e6" } as CSSProperties}
        >
          <Link2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="invite-h" className="text-base font-bold text-foreground">
            Invite link
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            One link for the whole team. Paste it in the group chat your team
            already uses — don&apos;t post it anywhere public.
          </p>
        </div>
      </div>

      {invite ? (
        <>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={invite.url}
              aria-label={`Invite link for Team ${teamNumber}`}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-[13px]"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={copy}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden /> Copy
                </>
              )}
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {invite.expiresLabel} · used {invite.uses} of{" "}
            {pluralize(invite.maxUses, "time")}. Whoever opens it has to sign in
            and press join, and they&apos;re told exactly what it shares first.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {confirmingReset ? (
              <div className="w-full rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="text-sm leading-relaxed text-foreground">
                  Resetting makes the link above stop working{" "}
                  <strong>immediately</strong> and gives you a fresh one. Anyone
                  you already sent it to will need the new link. People already
                  in the space stay in.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="warning"
                    disabled={pending}
                    onClick={() => {
                      setConfirmingReset(false);
                      run(createInviteAction, "New link ready — the old one is dead.");
                    }}
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden />
                    )}
                    Reset it
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setConfirmingReset(false)}
                  >
                    Keep the current link
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setConfirmingReset(true)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden /> Reset link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      revokeInviteAction,
                      "Link turned off. Nobody new can join."
                    )
                  }
                >
                  <ShieldOff className="h-4 w-4" aria-hidden /> Turn it off
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-5">
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            There&apos;s no live link right now, so nobody new can join. Anyone
            already in the space stays in.
          </div>
          <Button
            type="button"
            className="mt-4"
            disabled={pending}
            onClick={() =>
              run(createInviteAction, "Invite link ready — share it with your team.")
            }
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Making
                a link…
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" aria-hidden /> Create invite link
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Members                                                            */
/* ------------------------------------------------------------------ */

function MemberList({ members }: { members: ManageMember[] }) {
  const reduce = useReducedMotion();
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const remove = (m: ManageMember) => {
    startTransition(async () => {
      const r = await removeMemberAction(m.memberKey);
      if (r?.error) toast.error(r.error);
      else {
        setConfirming(null);
        toast.success(`@${m.username} is no longer in this space.`, {
          description: "Their account and everything they've finished are untouched.",
        });
      }
    });
  };

  return (
    <section aria-labelledby="members-h">
      <h2 id="members-h" className="text-base font-bold text-foreground">
        Members ({members.length})
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone here opened your link and chose to join. Usernames only —
        LearnFRC never shows you a member&apos;s real name or email.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {members.map((m) => (
          <li key={m.memberKey} className="ac-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
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

              {!m.isLead && !m.isSelf && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  aria-expanded={confirming === m.memberKey}
                  onClick={() =>
                    setConfirming((c) =>
                      c === m.memberKey ? null : m.memberKey
                    )
                  }
                >
                  <UserMinus className="h-4 w-4" aria-hidden /> Remove
                </Button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {confirming === m.memberKey && (
                <motion.div
                  initial={
                    reduce ? { opacity: 0 } : { opacity: 0, height: 0 }
                  }
                  animate={
                    reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }
                  }
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/70 bg-secondary/40 px-4 py-4 sm:px-5">
                    <p className="text-sm font-semibold text-foreground">
                      Remove @{m.username} from Team&nbsp;space?
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                          aria-hidden
                        />
                        <span>
                          Their LearnFRC account, XP, badges and every lesson
                          they&apos;ve finished stay exactly as they are. This
                          changes <strong>nothing</strong> for them outside this
                          space.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                          aria-hidden
                        />
                        <span>
                          You stop seeing their progress the moment you press
                          this.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                          aria-hidden
                        />
                        <span>
                          They can join again later with a fresh link, if they
                          want to.
                        </span>
                      </li>
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => remove(m)}
                      >
                        {pending ? (
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <UserMinus className="h-4 w-4" aria-hidden />
                        )}
                        Remove @{m.username}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>

      {members.length === 1 && (
        <p className="mt-4 text-sm text-muted-foreground">
          It&apos;s just you so far. Send the link above to your team — every
          person who joins shows up here.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Leadership + delete                                                */
/* ------------------------------------------------------------------ */

function DangerZone({
  teamNumber,
  memberCount,
}: {
  teamNumber: number;
  memberCount: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const confirmed = typed.trim() === String(teamNumber);

  const onDelete = () => {
    startTransition(async () => {
      const r = await deleteSpaceAction(Number(typed.trim()));
      // Success redirects away; only failures come back.
      if (r?.error) toast.error(r.error);
    });
  };

  return (
    <section className="space-y-4" aria-labelledby="danger-h">
      {/* Why there is no "hand it over" button. */}
      <div className="ac-card flex items-start gap-3 px-5 py-4">
        <Crown
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div>
          <h2 id="danger-h" className="text-sm font-bold text-foreground">
            Handing this over, and leaving
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            You can&apos;t pass the space to someone else, and you can&apos;t
            leave it while you run it — a space full of students with nobody
            responsible for it is the one thing we won&apos;t allow. There are
            also no co-leads.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            If someone else should be running Team {teamNumber}, delete this
            space and ask them to create it. The number is free again the moment
            it&apos;s gone, and nobody loses anything.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Delete this space
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Deletes the space, its invite link and its member list.{" "}
          {memberCount > 1 ? (
            <>
              All {memberCount} of you keep every lesson, every badge and all
              your XP —
            </>
          ) : (
            <>You keep every lesson, every badge and all your XP —</>
          )}{" "}
          deleting a space never touches anybody&apos;s account. You just stop
          seeing each other&apos;s progress. This can&apos;t be undone.
        </p>

        {!open ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-4"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete Team {teamNumber}
            &apos;s space
          </Button>
        ) : (
          <div className="mt-4">
            <label
              htmlFor="confirm-team"
              className="block text-sm font-medium text-foreground/90"
            >
              Type <strong className="tabular-nums">{teamNumber}</strong> to
              confirm
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id="confirm-team"
                inputMode="numeric"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={String(teamNumber)}
                className="sm:max-w-40 tabular-nums"
                disabled={pending}
              />
              <Button
                type="button"
                variant="destructive"
                disabled={!confirmed || pending}
                onClick={onDelete}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete for good
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Every create, invite, join, removal and block in this space is written
        to an audit record — so if a parent or a school ever asks what happened
        here, there&apos;s an answer.
      </p>
    </section>
  );
}
