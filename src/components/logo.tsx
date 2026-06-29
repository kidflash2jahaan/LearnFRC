import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared LearnFRC brand mark — a neon terminal prompt: a gradient/HUD-textured
 * tile with a glowing `>` and a blinking cursor, beside the wordmark.
 * Server component (CSS-only animation) so it works in both nav and footer.
 */
export function Logo({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label="LearnFRC — home">
      <span className="relative flex h-9 w-9 items-center justify-center gap-[2px] overflow-hidden rounded-[10px] border border-primary/45 bg-gradient-to-br from-primary/20 via-card to-accent/15 shadow-[var(--glow-primary)] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
        <span className="absolute inset-0 hud-grid opacity-30" aria-hidden />
        <span
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
          aria-hidden
        />
        <span className="relative -translate-y-px font-mono text-[15px] font-bold leading-none text-primary [text-shadow:0_0_8px_color-mix(in_srgb,var(--primary)_60%,transparent)]">
          &gt;
        </span>
        <span
          className="relative mb-1.5 h-[3px] w-2 self-end rounded-full bg-accent shadow-[var(--glow-accent)] animate-blink"
          aria-hidden
        />
      </span>
      <span className={cn("font-display text-lg font-bold tracking-tight", textClassName)}>
        Learn<span className="text-gradient">FRC</span>
      </span>
    </Link>
  );
}
