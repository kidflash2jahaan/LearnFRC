import Link from "next/link";
import { ShareButton } from "@/components/share-button";

/**
 * "Nobody's on Electrical" — the ask, made specific.
 *
 * The generic invite ("share LearnFRC with your team") is already on this page.
 * This is the other half: it names the subteams the team has literally nobody
 * on, so the share is not a broadcast to a group chat, it is a message to the
 * one person who runs that subteam. Referred signups activate at 82% against
 * 55% site-wide and eleven of the last twelve joined the referrer's own team,
 * so a named, targeted ask is the highest-leverage control on the page.
 *
 * FOUR STATES, because the same sentence is wrong in three of them. 76% of
 * teams here are a single person, and telling somebody who signed up an hour
 * ago that "nobody on your team has started anything" reads as an accusation
 * against the only member: them.
 *
 * The gaps are printed as chips rather than buried in the sentence, because the
 * point of the card is the list. A reader who takes one thing away should take
 * away the three words that are missing from their pit.
 *
 * No client hooks of its own: ShareButton is the only client boundary, and the
 * link comes from a server-provided username, so SSR is stable.
 */
export function SubteamGapCard({
  teamNumber,
  username,
  gaps,
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
  coveredCount: number;
  totalSubteams: number;
  soloMember: boolean;
  /** Distinct lessons the whole team has finished between them. */
  teamCompleted: number;
  totalLessons: number;
}) {
  // Same link shape as the TeamInvite further down this page: one URL per
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

  // Nobody has finished a single lesson, so this is a brand-new team. The gap
  // there is not a missing teammate, it is a missing first step, and the copy
  // has to say so.
  const state: "fresh" | "solo" | "gaps" | "covered" =
    teamCompleted === 0
      ? "fresh"
      : gaps.length === 0
        ? "covered"
        : soloMember
          ? "solo"
          : "gaps";

  const marker =
    state === "covered"
      ? "coverage / complete"
      : state === "fresh"
        ? "coverage / nothing started"
        : `coverage / ${gaps.length} open`;

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
        ? "Claim the one you actually work on, then send this link to the rest of the crew so they can take theirs. Every lesson is free, and you both get +25 XP once they join."
        : state === "solo"
          ? `Nothing from #${teamNumber} has touched ${list} yet. Send this to whoever runs ${gaps.length === 1 ? "it" : "them"}: every lesson is free, and you both get +25 XP once they join.`
          : `Nobody on team #${teamNumber} has started ${list}. Send this to whoever runs ${gaps.length === 1 ? "it" : "them"}: every lesson is free, and you both get +25 XP once they join.`;

  const shareText =
    state === "covered"
      ? `Team ${teamNumber} has all ${totalSubteams} subteams going on LearnFRC, and every lesson is free. Join us:`
      : state === "fresh"
        ? `Team ${teamNumber} is getting on LearnFRC. Free lessons for every subteam, mechanical through scouting. Grab yours:`
        : `Nobody on team ${teamNumber} has ${list} covered on LearnFRC yet. It's free and I'm already on it. Claim your subteam:`;

  return (
    <div className="nb-box nb-tilt-3 flex flex-col gap-5 p-[clamp(1.1rem,2.4vw,1.7rem)] sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <span className="nb-tape -top-3 left-8 rotate-[-4.2deg]" aria-hidden="true" />

      <div className="min-w-0">
        <p className="nb-marker">{marker}</p>
        <h3>{heading}</h3>
        <p className="nb-sub mt-2 text-[0.95rem]">{body}</p>

        {gaps.length > 0 && (
          <ul className="mt-3.5 flex flex-wrap gap-1.5">
            {gaps.map((g) => (
              <li key={g}>
                <span className="nb-tag border-dashed">{g}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        {state === "fresh" && (
          <Link href="/guides" className="nb-btn-ghost nb-btn-sm">
            Pick a subteam
          </Link>
        )}
        <ShareButton
          variant="brand"
          label={state === "solo" || state === "gaps" ? "Ask them" : "Invite the crew"}
          text={shareText}
          url={link}
        />
      </div>
    </div>
  );
}
