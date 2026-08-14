import type { CSSProperties } from "react";
import Link from "next/link";
import { UserPlus, PartyPopper, Flag, ArrowRight } from "lucide-react";
import { ShareButton } from "@/components/share-button";

/**
 * "Nobody's on Electrical" — the ask, made specific.
 *
 * The generic invite ("share LearnFRC with your team") is already on this page.
 * This is the other half: it names the subteams the team has literally nobody
 * on, so the share isn't a broadcast to a group chat, it's a message to one
 * person who runs that subteam. Referred signups activate at 82% against 55%
 * site-wide and eleven of the last twelve joined the referrer's own team, so a
 * named, targeted ask is the highest-leverage control on the page.
 *
 * Four states, because the same sentence is wrong in three of them — 76% of
 * teams here are a single person, and telling someone who signed up an hour ago
 * that "nobody on your team has started anything" reads as an accusation
 * against the only member: them.
 *
 * No client hooks of its own — ShareButton is the only client boundary, and the
 * link comes from a server-provided username, so SSR is stable.
 */
export function SubteamGapCard({
  teamNumber,
  username,
  gaps,
  gapAccent,
  coveredCount,
  totalSubteams,
  soloMember,
  teamCompleted,
  totalLessons,
}: {
  teamNumber: number;
  /** Referral username. Null for the handful of accounts that have none. */
  username: string | null;
  /** Short labels of the subteams nobody on the team has started. */
  gaps: string[];
  /** Accent of the first gap, so the card wears the colour of what's missing. */
  gapAccent?: string;
  coveredCount: number;
  totalSubteams: number;
  soloMember: boolean;
  /** Distinct lessons the whole team has finished between them. */
  teamCompleted: number;
  totalLessons: number;
}) {
  // Same link shape as the InviteCard further down this page: one URL per
  // surface, or the attribution splits in half. `?ref=` is what credits the
  // referrer and pays the double-sided +25 XP once the invitee confirms.
  const link = username
    ? `https://learnfrc.com/signup?ref=${username}`
    : "https://learnfrc.com/signup";

  const named = gaps.slice(0, 3);
  const rest = gaps.length - named.length;
  const list =
    rest > 0
      ? `${named.join(", ")} and ${rest} more`
      : named.length <= 1
        ? (named[0] ?? "")
        : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;

  // Nobody has finished a single lesson — a brand-new team. The gap here isn't
  // a missing teammate, it's a missing first step, and the copy has to say so.
  const state: "fresh" | "solo" | "gaps" | "covered" =
    teamCompleted === 0
      ? "fresh"
      : gaps.length === 0
        ? "covered"
        : soloMember
          ? "solo"
          : "gaps";

  const accent = (state === "covered" ? "var(--accent)" : gapAccent) || "var(--accent)";

  const heading =
    state === "covered"
      ? "Every subteam has someone on it"
      : state === "fresh"
        ? `All ${totalSubteams} subteams are still open`
        : state === "solo"
          ? `You're covering ${coveredCount} of ${totalSubteams} subteams`
          : gaps.length === 1
            ? "1 subteam has nobody on it"
            : `${gaps.length} subteams have nobody on them`;

  const body =
    state === "covered"
      ? `Team #${teamNumber} has finished ${teamCompleted} of ${totalLessons} lessons between you, and every subteam is claimed. Bring in the rest of the crew to close out what's left.`
      : state === "fresh"
        ? `Claim the one you actually work on, then send this link to the rest of the crew so they can take theirs. Every lesson is free, and you both get +25 XP once they join.`
        : state === "solo"
          ? `Nothing from #${teamNumber} has touched ${list} yet. Send this to whoever runs ${gaps.length === 1 ? "it" : "them"} — every lesson is free, and you both get +25 XP once they join.`
          : `Nobody on team #${teamNumber} has started ${list}. Send this to whoever runs ${gaps.length === 1 ? "it" : "them"} — every lesson is free, and you both get +25 XP once they join.`;

  const shareText =
    state === "covered"
      ? `Team ${teamNumber} has all ${totalSubteams} subteams going on LearnFRC — every lesson is free. Join us:`
      : state === "fresh"
        ? `Team ${teamNumber} is getting on LearnFRC — free lessons for every subteam, mechanical through scouting. Grab yours:`
        : `Nobody on team ${teamNumber} has ${list} covered on LearnFRC yet — it's free and I'm already on it. Claim your subteam:`;

  return (
    <div
      className="ac-tile flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      style={{ "--a": accent } as CSSProperties}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
          style={{ "--a": accent } as CSSProperties}
        >
          {state === "covered" ? (
            <PartyPopper className="h-5 w-5" aria-hidden />
          ) : state === "fresh" ? (
            <Flag className="h-5 w-5" aria-hidden />
          ) : (
            <UserPlus className="h-5 w-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight text-foreground">
            {heading}
          </h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/75">
            {body}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5 sm:pl-2">
        {state === "fresh" && (
          <Link href="/guides" className="ac-btn-ghost text-sm">
            Pick a subteam <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        <ShareButton
          variant="brand"
          label={
            state === "solo" || state === "gaps"
              ? "Ask them to join"
              : "Invite the crew"
          }
          text={shareText}
          url={link}
        />
      </div>
    </div>
  );
}
