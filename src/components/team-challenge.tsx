import { ShareButton } from "@/components/share-button";
import { cn } from "@/lib/utils";

/**
 * "Challenge your team" is the small referral ask, shown at the two moments
 * somebody is actually pleased with themselves: the instant a lesson is passed,
 * and on an earned certificate.
 *
 * It is drawn as `nb-note`, the binder's aside: a dashed frame with an ink bar
 * down the left. That is deliberate and it is the whole design decision here.
 * The old version was a full tinted panel with a badge and a headline, which on
 * a certificate page put a marketing card next to the thing the person came to
 * look at. An aside is the correct weight for a suggestion: it sits beside the
 * moment rather than interrupting it, and it reads as pencilled into the margin
 * rather than as an ad.
 *
 * No client hooks of its own, so it renders from a server page (certificate) or
 * a client one (lesson-complete) either way. ShareButton is the only boundary,
 * and the link comes from a server-provided username, so SSR is stable.
 */
export function TeamChallenge({
  username,
  className,
  via,
}: {
  username: string;
  className?: string;
  /** Share surface for attribution, appended as &via=. Without it a signup
      earned here lands in the referral bucket with no surface, which is how
      every referral before today ended up unattributed. */
  via?: "certificate" | "lesson-milestone";
}) {
  const link = `https://learnfrc.com/signup?ref=${username}${via ? `&via=${via}` : ""}`;

  return (
    <div
      className={cn(
        "nb-note flex flex-col gap-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-5",
        className
      )}
    >
      <div className="min-w-0">
        <p className="nb-slug">note / challenge your team</p>
        <p className="mt-1.5 text-[0.95rem] leading-snug">
          They learn free, you both get{" "}
          <span className="font-bold">+25 XP</span>, and one of you gets the
          bragging rights.
        </p>
      </div>
      <div className="shrink-0">
        <ShareButton
          variant="outline"
          label="Send it"
          text="I'm learning every part of FRC, free, on LearnFRC. Think you can keep up? Join me:"
          url={link}
        />
      </div>
    </div>
  );
}
