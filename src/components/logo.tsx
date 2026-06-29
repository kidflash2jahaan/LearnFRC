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
        <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="none" aria-hidden>
          <path d="M12 2.7v2.2" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="2" r="1.15" className="animate-blink" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 3px var(--primary))" }} />
          <rect x="4.4" y="5.2" width="15.2" height="13.4" rx="4" stroke="var(--primary)" strokeWidth="1.5" />
          <path d="M4.4 9.6v3M19.6 9.6v3" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="9.4" cy="11.5" r="1.7" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 3px var(--primary))" }} />
          <circle cx="14.6" cy="11.5" r="1.7" fill="var(--accent)" style={{ filter: "drop-shadow(0 0 3px var(--accent))" }} />
          <path d="M9.2 15.6h5.6" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        </svg>
      </span>
      <span className={cn("font-display text-lg font-bold tracking-tight", textClassName)}>
        Learn<span className="text-gradient">FRC</span>
      </span>
    </Link>
  );
}
