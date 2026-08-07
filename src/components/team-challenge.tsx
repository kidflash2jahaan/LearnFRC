import type { CSSProperties } from "react";
import { Rocket } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { cn } from "@/lib/utils";

/**
 * Compact, one-row "Challenge your team" prompt shown at moments of pride —
 * right after a lesson is passed and on an earned certificate. Reuses the
 * ShareButton (native share, clipboard fallback with "Copied!") so it carries
 * the same share/copy affordance as the dashboard invite card, but small and
 * unobtrusive rather than a full panel.
 *
 * No client hooks of its own — safe to render from server (certificate) or
 * client (lesson-complete) components; ShareButton is the only client boundary.
 * The link is derived from a server-provided `username`, so SSR is stable.
 */
export function TeamChallenge({
  username,
  className,
  via,
}: {
  username: string;
  className?: string;
  /** Share surface for attribution — appended as &via=. Without it a signup
      earned here lands in the referral bucket with no surface, which is how
      every referral before today ended up unattributed. */
  via?: "certificate" | "lesson-milestone";
}) {
  const link = `https://learnfrc.com/signup?ref=${username}${via ? `&via=${via}` : ""}`;

  return (
    <div
      className={cn(
        "ac-tile flex flex-col gap-3 p-3.5 text-left sm:flex-row sm:items-center sm:justify-between sm:p-4",
        className
      )}
      style={{ "--a": "#2560e6" } as CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="ac-badge flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ "--a": "#2560e6" } as CSSProperties}
        >
          <Rocket className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">
            Challenge your team
          </p>
          <p className="text-sm leading-snug text-foreground/70">
            They learn free — you both get +25 XP and the bragging rights.
          </p>
        </div>
      </div>
      <ShareButton
        variant="brand"
        label="Invite your team"
        text="I'm learning every part of FRC, free, on LearnFRC — think you can keep up? Join me:"
        url={link}
      />
    </div>
  );
}
