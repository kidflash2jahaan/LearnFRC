import { ShareButton } from "@/components/share-button";
import { CopyLink } from "@/components/team/copy-link";

/**
 * The referral ask on the leaderboard.
 *
 * Deliberately the thin version of the invite. The full panel on /teams hands
 * out a QR code, a share sheet and a printable handout, because that page is
 * where somebody goes to recruit. Here the reader came to look at a standing,
 * so this is one line and one link: the board is more fun with your teammates
 * on it, here is the link that puts them there.
 *
 * ONE URL, EVERY CONTROL. The written-out link and the share sheet emit the
 * same string. A surface whose copy button and share button hand out different
 * links splits its own attribution in half, and that bug has shipped here once
 * already.
 *
 * Server Component. `CopyLink` is the clipboard boundary and `ShareButton` is
 * the share one, both leaves, both already in the kit, so there is exactly one
 * clipboard implementation in the codebase rather than a second one here.
 */
export function InviteCard({
  username,
  count,
  via,
}: {
  username: string;
  count: number;
  /** Share surface for attribution, appended to the referral link as &via=. */
  via?: "dashboard" | "leaderboard";
}) {
  const link = via
    ? `https://learnfrc.com/signup?ref=${username}&via=${via}`
    : `https://learnfrc.com/signup?ref=${username}`;

  return (
    <div className="nb-box p-[clamp(1.1rem,2.4vw,1.7rem)]">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="min-w-0">
          <p className="nb-marker">invite / free for your team</p>
          <h2 className="text-[clamp(1.2rem,1rem+0.9vw,1.6rem)]">
            A board is better with your team on it
          </h2>
        </div>
        {count > 0 && (
          <p className="nb-count shrink-0 text-[1.4rem]">
            {count}
            <small>{count === 1 ? "joined" : "joined"}</small>
          </p>
        )}
      </div>

      <p className="nb-sub mt-2.5 text-[0.95rem]">
        Send this to someone on your team. They get every lesson on LearnFRC,
        free, and you both get{" "}
        <b className="font-bold text-ink">+25 XP</b> once they confirm their
        email.
      </p>

      <div className="mt-4">
        <CopyLink url={link} label="Referral link" />
      </div>

      <div className="mt-3">
        <ShareButton
          variant="brand"
          label="Share it"
          text="Learn every part of FRC, free. Join me on LearnFRC:"
          url={link}
        />
      </div>
    </div>
  );
}
