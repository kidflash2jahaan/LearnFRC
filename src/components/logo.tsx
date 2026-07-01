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
      <span className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#2f6bff] to-[#1aa9d6] shadow-[0_6px_14px_rgba(37,96,230,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
        <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="none" aria-hidden>
          <rect x="11.3" y="3.6" width="1.4" height="3" rx="0.7" fill="#fff" />
          <circle cx="12" cy="3.3" r="1.3" fill="#fff" />
          <rect x="6" y="7.2" width="12" height="10" rx="3.2" fill="#fff" />
          <circle cx="9.7" cy="11.8" r="1.5" fill="#2560e6" />
          <circle cx="14.3" cy="11.8" r="1.5" fill="#1aa9d6" />
          <rect x="9.5" y="14.4" width="5" height="1.3" rx="0.65" fill="#2560e6" opacity="0.5" />
        </svg>
      </span>
      <span className={cn("font-display text-lg font-bold tracking-tight", textClassName)}>
        Learn<span className="text-gradient">FRC</span>
      </span>
    </Link>
  );
}
