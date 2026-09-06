import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { InviteQr } from "./invite-qr";
import { CopyLink } from "./copy-link";
import { teamInviteUrl, teamInviteDisplayUrl } from "./invite-link";

/**
 * "Get your team on here" — the invite surface for /teams and the dashboard.
 *
 * THREE CONTROLS, ONE LINK
 *  - the link itself, written out and copyable (group chat, Discord, a text)
 *  - the native share sheet (a phone, in a pit)
 *  - a QR code (thirty students in a room, which is the only one of the three
 *    that works at a team meeting)
 * All three hand out the exact same URL from `teamInviteUrl`, because a surface
 * whose copy button and share button emit different links splits its own
 * attribution in half. That bug has already shipped on this page once.
 *
 * NO MEMBERSHIP, NO TOKEN, NO EXPIRY. Joining a team here means putting the
 * team number on your profile, which the signup form already asks for. So the
 * link is a plain referral link and the QR is a QR of that link: nothing to
 * revoke, nothing to rotate, and nothing that stops working while a printed
 * sheet is still pinned to a shop wall.
 *
 * HOW IT IS DRAWN. The QR is the thing that does the work, so it is the thing
 * that gets pinned: a white plate, taped to the card at a slight angle, sitting
 * beside the copy rather than under it. The code stays black on white while the
 * frame around it is ink on card stock, because a QR tinted to match a page is
 * a QR that fails to scan.
 *
 * SERVER COMPONENT. The QR is encoded during the server render (lib/qr.ts,
 * ~250 lines of pure arithmetic) so none of the encoder ships to the browser;
 * the copy and share buttons are the only client boundaries.
 *
 * Callers must not render this without a username. The link is meaningless
 * without a `?ref=`, so the prop is required and /teams branches around it.
 */
export function TeamInvite({
  username,
  teamNumber,
  referralCount,
  tone = "crew",
  via,
}: {
  /** Referral username. Never null, see the note above. */
  username: string;
  /** Null for a member who has not set a team number yet. */
  teamNumber: number | null;
  /** How many accounts have signed up through this member so far. */
  referralCount: number;
  /**
   * `solo` is the state 109 of 144 teams are actually in: one member, an empty
   * roster. The invite is not a footer there, it is the page's whole answer.
   */
  tone?: "solo" | "crew";
  /**
   * Surface tag for `?via=`. Defaults to the /teams tag. The dashboard slot
   * passes its own so the two placements stay distinguishable in
   * `referral_surface`; see src/lib/signup-attribution.ts.
   */
  via?: string;
}) {
  const link = teamInviteUrl(username, via);
  const shown = teamInviteDisplayUrl(username, via);
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
      the whole job. Drop it in the team chat, or put the code on the projector
      at your next meeting and the room signs up in one go.{" "}
      <span className="font-bold text-ink">Every lesson is free</span>, and you
      both get +25 XP once they confirm their email.
    </>
  ) : (
    <>
      Send this to someone on {teamLabel}. They get every lesson on LearnFRC,
      free, and land on the roster automatically.{" "}
      {referralCount > 0 && (
        <>
          <span className="font-bold text-ink">
            {referralCount}{" "}
            {referralCount === 1 ? "teammate has" : "teammates have"}
          </span>{" "}
          joined through you.{" "}
        </>
      )}
      You <span className="font-bold text-ink">both get +25 XP</span> once they
      confirm their email.
    </>
  );

  const shareText = teamNumber
    ? `Team ${teamNumber} is on LearnFRC. Free lessons for every subteam, mechanical through scouting. Join us:`
    : "Learn every part of FRC, free. Join me on LearnFRC:";

  return (
    <div className="nb-box grid gap-7 p-[clamp(1.2rem,2.6vw,1.9rem)] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-9">
      <div className="min-w-0">
        <p className="nb-marker">
          {solo ? "invite / one link, one code" : "invite / free for your team"}
          {referralCount > 0 && (
            <span className="text-ink">
              {referralCount} joined so far
            </span>
          )}
        </p>
        <h2 className="text-[clamp(1.35rem,1.1rem+1vw,1.9rem)]">{heading}</h2>
        <p className="nb-sub mt-2.5 text-[0.98rem]">{body}</p>

        <div className="mt-5">
          <CopyLink url={link} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <ShareButton
            variant="brand"
            label={solo ? "Send the link" : "Share invite"}
            text={shareText}
            url={link}
          />
          <Link href="/teams/print" className="nb-btn-ghost">
            Printable handout
          </Link>
        </div>
      </div>

      {/* The code, taped up. Black on white inside its own plate, because that
          is what a scanner needs; the notebook treatment is the tape and the
          frame around it, never the code. */}
      <div className="flex flex-col items-center gap-2.5 sm:w-[13rem] sm:shrink-0">
        <div className="nb-box-sm nb-tilt-2 relative bg-white p-3">
          <span className="nb-tape -top-3 left-6 rotate-[3.4deg]" aria-hidden="true" />
          <InviteQr
            url={link}
            title={`QR code for ${shown}`}
            className="h-[10.5rem] w-[10.5rem]"
          />
        </div>
        <p className="nb-slug max-w-[13rem] text-center leading-relaxed">
          point a phone at it, same link, good on a projector
        </p>
      </div>
    </div>
  );
}
