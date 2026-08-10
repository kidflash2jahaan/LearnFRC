import type { CSSProperties } from "react";
import Link from "next/link";
import { Printer, Trophy, UserPlus } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { InviteQr } from "./invite-qr";
import { CopyLink } from "./copy-link";
import { teamInviteUrl, teamInviteDisplayUrl } from "./invite-link";

/**
 * "Get your team on here" — the invite surface for /teams.
 *
 * THREE CONTROLS, ONE LINK
 *  - the link itself, copyable (group chat, Discord, a text message)
 *  - the native share sheet (a phone in a pit)
 *  - a QR code (thirty students in a room, which is the only one of the three
 *    that works at a team meeting)
 * All three hand out the exact same URL from `teamInviteUrl`, because a surface
 * whose copy button and share button emit different links splits its own
 * attribution in half — that bug has already shipped on this page once.
 *
 * NO MEMBERSHIP, NO TOKEN, NO EXPIRY. Joining a team here means putting the
 * team number on your profile, which the signup form already asks for. So the
 * link is a plain referral link and the QR is a QR *of that link* — nothing to
 * revoke, nothing to rotate, and nothing that stops working while a printed
 * sheet is still pinned to a shop wall.
 *
 * SERVER COMPONENT. The QR is encoded during the server render (see lib/qr.ts,
 * ~250 lines of pure arithmetic) so none of the encoder ships to the browser;
 * the only client boundaries are the copy and share buttons.
 *
 * Callers must not render this without a username — the link is meaningless
 * without a `?ref=`, so the prop is required and /teams branches around it.
 */
export function TeamInvite({
  username,
  teamNumber,
  referralCount,
  tone = "crew",
}: {
  /** Referral username. Never null — see the note above. */
  username: string;
  /** Null for a member who hasn't set a team number yet. */
  teamNumber: number | null;
  /** How many accounts have signed up through this member so far. */
  referralCount: number;
  /**
   * `solo` is the state 109 of 144 teams are actually in: one member, an empty
   * roster. The invite is not a footer there, it is the page's whole answer.
   */
  tone?: "solo" | "crew";
}) {
  const link = teamInviteUrl(username);
  const shown = teamInviteDisplayUrl(username);
  const solo = tone === "solo";
  const teamLabel = teamNumber ? `#${teamNumber}` : "your team";

  // An offer, not an accusation. "Nobody else has joined" is a true sentence
  // that reads as a failure report to the one person who did.
  const heading = solo
    ? `Bring the rest of ${teamLabel} in`
    : "Invite the rest of the crew";

  const body = solo ? (
    <>
      Right now you&apos;re the only one from {teamLabel} here, so this link is
      the whole job. Drop it in the team chat, or put the QR on the projector at
      your next meeting and the room signs up in one go.{" "}
      <span className="font-semibold text-foreground">
        Every lesson is free
      </span>
      , and you both get +25 XP once they confirm their email.
    </>
  ) : (
    <>
      Send this to someone on {teamLabel} — they get every lesson on LearnFRC,
      free, and land on the roster automatically.{" "}
      {referralCount > 0 && (
        <>
          <span className="font-semibold text-foreground">
            {referralCount} {referralCount === 1 ? "teammate has" : "teammates have"}
          </span>{" "}
          joined through you.{" "}
        </>
      )}
      You <span className="font-semibold text-foreground">both get +25 XP</span>{" "}
      once they confirm their email.
    </>
  );

  const shareText = teamNumber
    ? `Team ${teamNumber} is on LearnFRC — free lessons for every subteam, mechanical through scouting. Join us:`
    : "Learn every part of FRC, free — join me on LearnFRC:";

  return (
    <div className="ac-glass relative overflow-hidden p-6 sm:p-7">
      {/* soft corner glow — constant, aria-hidden, SSR-stable */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(37,96,230,0.28), transparent 70%)",
        }}
      />

      <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <UserPlus className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="ac-eyebrow">
                  {solo ? "One link, one QR" : "Free for your team"}
                </p>
                <h2 className="font-display text-lg font-bold leading-tight text-foreground">
                  {heading}
                </h2>
              </div>
            </div>
            {referralCount > 0 && (
              <span className="ac-chip inline-flex items-center gap-1.5 text-sm font-semibold">
                <Trophy className="h-3.5 w-3.5 text-accent" aria-hidden />
                {referralCount} joined
              </span>
            )}
          </div>

          <p className="mt-3 text-[15px] leading-relaxed text-foreground/70">
            {body}
          </p>

          <div className="mt-4">
            <CopyLink url={link} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <ShareButton
              variant="brand"
              label={solo ? "Send the link" : "Share invite"}
              text={shareText}
              url={link}
            />
            <Link href="/teams/print" className="ac-btn-ghost text-sm">
              <Printer className="h-4 w-4" aria-hidden />
              Printable handout
            </Link>
          </div>
        </div>

        {/* The QR, encoded server-side and rendered inline. Fixed black on a
            white plate in both themes: a scanner needs dark modules on a light
            field, and the plate is the quiet zone, not decoration. */}
        <div className="flex flex-col items-center gap-2 sm:w-[184px] sm:shrink-0">
          <div className="rounded-2xl border border-border bg-white p-3">
            <InviteQr
              url={link}
              title={`QR code for ${shown}`}
              className="h-40 w-40"
            />
          </div>
          <p className="max-w-[184px] text-center text-xs leading-relaxed text-muted-foreground">
            Point a phone camera at it — it opens the same link. Good on a
            projector.
          </p>
        </div>
      </div>
    </div>
  );
}
