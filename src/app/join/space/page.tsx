import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getMyTeamSpace, previewInvite } from "@/lib/team-space";
import { Glow, Rise } from "@/components/motion/primitives";
import { pluralize } from "@/lib/utils";
import { JoinForm } from "./_join-form";
import { INVITE_COOKIE, normaliseInviteToken } from "./invite-link";

export const metadata: Metadata = {
  title: "Join a team space",
  // Never indexed, never followed. robots.ts already disallows /join, but
  // robots.txt is a request, not a control — this is the one that binds.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const BLUE = "#2560e6";
const GREEN = "#12b565";
const AMBER = "#f5b23d";

/**
 * THE CONSENT SCREEN.
 *
 * This page is the entire boundary between "someone has a link" and "a team
 * lead can see a 15-year-old's study record". Everything it does follows from
 * that:
 *
 *  - CLICKING CONFERS NOTHING. Rendering this page joins no one to anything.
 *    Membership is created by one POST from one button (see _join-form.tsx).
 *  - PRE-CONSENT IT SHOWS ALMOST NOTHING: the team number, how many people are
 *    in the space, and the lead's USERNAME. No member list, no avatars, no
 *    progress, no real names, no email — see previewInvite().
 *  - SIGNED OUT IT SHOWS LESS THAN THAT. previewInvite() requires an account,
 *    so a leaked or indexed link tells an anonymous stranger nothing at all —
 *    not the team number, not whether the invite is even real.
 *  - THE COPY NAMES THE FIELDS AND THE AUDIENCE. Consent that says "we'll share
 *    some data with your team" is not consent. It says which lessons, which
 *    numbers, to whom, and what is never shared.
 *  - EVERY DEAD END READS THE SAME. Expired, revoked, used up, never existed —
 *    one sentence for all four, so nobody can probe tokens to map real spaces.
 */
export default async function JoinSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.t) ? sp.t[0] : sp.t;

  // `?t=` is the primary carrier; the scoped cookie is the fallback for a round
  // trip through signup that mangled the nested query. See invite-link.ts.
  const jar = await cookies();
  const token =
    normaliseInviteToken(raw) || normaliseInviteToken(jar.get(INVITE_COOKIE)?.value);

  const { user } = await getSession();

  if (!token) return <DeadLink />;

  // ── signed out ────────────────────────────────────────────────────────────
  // Deliberately identical whether the token is real, expired or invented: no
  // preview is fetched, so an anonymous visitor learns nothing about any space.
  if (!user) return <SignedOut token={token} />;

  const preview = await previewInvite(token);
  if (!preview.ok) {
    if (preview.error === "rate_limited") return <TooBusy />;
    return <DeadLink />;
  }
  const { teamNumber, name, memberCount, leadUsername } = preview.data;

  // One active space per account, platform-wide — so the sentence "Team 447
  // will see this" is literally true rather than roughly true.
  const mine = await getMyTeamSpace();
  if (mine) {
    return mine.teamNumber === teamNumber ? (
      <AlreadyIn name={name} />
    ) : (
      <InAnotherSpace current={mine.name} invited={name} />
    );
  }

  return (
    <Shell>
      <span className="ac-chip inline-flex items-center gap-2">
        <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">Team invite</span>
      </span>

      <h1 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        Join <span style={BRAND_GRADIENT}>{name}</span>&apos;s space?
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
        <span className="font-semibold text-foreground">@{leadUsername}</span> runs
        this space.{" "}
        {memberCount > 0
          ? `${pluralize(memberCount, "person", "people")} already in.`
          : "You'd be the first to join."}
      </p>

      <hr className="ac-divider my-6" />

      <h2 className="text-sm font-semibold text-foreground">
        Here&apos;s exactly what changes if you join
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Panel accent={BLUE} icon="see" title={`@${leadUsername} will see`}>
          <Fact>Your username and avatar</Fact>
          <Fact>
            How many lessons you&apos;ve finished, and which subteams they&apos;re in
          </Fact>
          <Fact>Your XP, and when you were last active</Fact>
        </Panel>

        <Panel accent={GREEN} icon="never" title="Nobody there will ever see">
          <Fact>Your real name</Fact>
          <Fact>Your email address</Fact>
          <Fact>Anything else on your account</Fact>
        </Panel>
      </div>

      <ul className="mt-4 grid gap-2.5">
        <Note icon="users">
          Other members of the space see your username and that you&apos;re on the
          team — not your individual progress.
        </Note>
        <Note icon="leave">
          You can leave whenever you want, from your own team page. The second you
          do, they stop seeing any of it.
        </Note>
        <Note icon="shield">
          Nobody in the space can change anything about your account. Your lessons,
          XP and badges stay yours — leaving, or being removed, never touches them.
        </Note>
      </ul>

      <JoinForm token={token} teamName={name} />

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        You can only be in one team space at a time.{" "}
        <Link
          href="/privacy"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          How we handle your data
        </Link>
        .
      </p>
    </Shell>
  );
}

// ── states ──────────────────────────────────────────────────────────────────

/**
 * Signed out. Shows no space details at ALL — not the team number, not the
 * member count, not the lead — because previewInvite requires an account and
 * this link may well have been pasted somewhere public.
 */
function SignedOut({ token }: { token: string }) {
  const handoff = `/join/space/continue?t=${encodeURIComponent(token)}`;
  return (
    <Shell>
      <span className="ac-chip inline-flex items-center gap-2">
        <UserPlus className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">Team invite</span>
      </span>

      <h1 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        Someone invited you to a{" "}
        <span style={BRAND_GRADIENT}>team space</span>
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
        Sign in — or make a free account — and we&apos;ll show you which team it
        is, who runs it, and exactly what they&apos;d be able to see. Then you
        decide.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {/* Plain anchors: these hand off to a route handler that sets the
            carry-over cookie, and a prefetch must never fire that. */}
        <a
          href={`${handoff}&to=signup`}
          className="ac-btn flex w-full items-center justify-center gap-2 text-sm"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Create a free account
        </a>
        <a
          href={`${handoff}&to=login`}
          className="ac-btn-ghost flex w-full items-center justify-center gap-2 text-sm"
        >
          <LogIn className="h-4 w-4" aria-hidden />
          I already have an account
        </a>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Opening this link hasn&apos;t joined you to anything, and it hasn&apos;t
        told anyone you opened it. We&apos;ll bring the invite along while you
        sign in.
      </p>
    </Shell>
  );
}

/**
 * Expired, revoked, used up, or never real — one screen for all four. The whole
 * point is that you cannot tell which, so no one can walk token space looking
 * for spaces that exist.
 */
function DeadLink() {
  return (
    <Shell>
      <span className="ac-chip inline-flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">Invite link</span>
      </span>
      <h1 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        This invite link isn&apos;t valid any more
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
        Invite links expire after a week, and a team lead can switch theirs off
        or replace it at any time. Ask whoever sent it for a fresh one.
      </p>
      <BackToTeams />
    </Shell>
  );
}

function TooBusy() {
  return (
    <Shell>
      <span className="ac-chip inline-flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">One moment</span>
      </span>
      <h1 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        Give it a minute
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
        A lot of invite links have been opened from this network in the last
        hour. Wait a few minutes and reload — your invite is still good.
      </p>
      <BackToTeams />
    </Shell>
  );
}

function AlreadyIn({ name }: { name: string }) {
  return (
    <Shell>
      <span className="ac-chip inline-flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">Already in</span>
      </span>
      <h1 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        You&apos;re already in <span style={BRAND_GRADIENT}>{name}</span>
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
        Nothing to do here — this link just points at the space you&apos;re
        already part of.
      </p>
      <BackToTeams label="Open my team" />
    </Shell>
  );
}

function InAnotherSpace({ current, invited }: { current: string; invited: string }) {
  return (
    <Shell>
      <span className="ac-chip inline-flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="ac-eyebrow">One space at a time</span>
      </span>
      <h1 className="mt-5 text-balance font-display text-2xl font-extrabold leading-tight sm:text-3xl">
        You&apos;re already in <span style={BRAND_GRADIENT}>{current}</span>
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-foreground/70">
        Your progress is only ever visible to one team space, which is what makes
        that promise worth anything. To join {invited} instead, leave{" "}
        {current} first from your team page, then open this link again.
      </p>
      <BackToTeams label="Go to my team" />
    </Shell>
  );
}

// ── shell + small pieces ────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "600px", pos: { left: "-180px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "540px", pos: { right: "-160px", top: "-120px" }, color: "#6ff0ea", opacity: 0.5, delay: 2 },
          { size: "500px", pos: { left: "35%", bottom: "-220px" }, color: "#c8b6ff", opacity: 0.4, delay: 4 },
        ]}
      />
      <div className="mx-auto flex min-h-[100svh] max-w-2xl flex-col justify-center px-4 pb-16 pt-28 sm:px-6">
        <Rise y={24} className="w-full">
          <div className="ac-glass relative mx-auto w-full max-w-xl p-6 sm:p-8">
            {children}
          </div>
        </Rise>
      </div>
    </div>
  );
}

function BackToTeams({ label = "Back to my team" }: { label?: string }) {
  return (
    <Link
      href="/teams"
      className="ac-btn-ghost mt-6 flex w-full items-center justify-center gap-2 text-sm"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

/**
 * Icons resolve from a name here rather than being passed in: this file is a
 * Server Component and a component cannot be handed across that boundary.
 */
function Panel({
  accent,
  icon,
  title,
  children,
}: {
  accent: string;
  icon: "see" | "never";
  title: string;
  children: ReactNode;
}) {
  const Glyph = icon === "see" ? Eye : EyeOff;
  return (
    <div className="ac-card p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="ac-badge flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ "--a": accent } as CSSProperties}
        >
          <Glyph className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="text-sm font-bold leading-tight text-foreground">{title}</h3>
      </div>
      <ul className="mt-3 grid gap-2">{children}</ul>
    </div>
  );
}

function Fact({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-[13px] leading-snug text-foreground/80">
      <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-foreground/35" />
      <span>{children}</span>
    </li>
  );
}

function Note({
  icon,
  children,
}: {
  icon: "users" | "leave" | "shield";
  children: ReactNode;
}) {
  const Glyph = icon === "users" ? Users : icon === "leave" ? LogOut : ShieldCheck;
  const accent = icon === "leave" ? AMBER : BLUE;
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/75">
      <span
        className="ac-badge mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
        style={{ "--a": accent } as CSSProperties}
      >
        <Glyph className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span>{children}</span>
    </li>
  );
}
