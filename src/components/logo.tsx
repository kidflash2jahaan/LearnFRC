import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * LearnFRC brand mark — the blue→cyan clay tile with the white bot (matches
 * the favicon/OG mark) beside the two-tone wordmark.
 */
export function Logo({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="LearnFRC — home"
      className={cn(
        "group flex items-center gap-2.5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#2f6bff] to-[#1aa9d6] shadow-[0_6px_14px_rgba(37,96,230,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <rect x="11.3" y="3.6" width="1.4" height="3" rx="0.7" fill="#fff" />
          <circle cx="12" cy="3.3" r="1.3" fill="#fff" />
          <rect x="6" y="7.2" width="12" height="10" rx="3.2" fill="#fff" />
          <circle cx="9.7" cy="11.8" r="1.5" fill="#2560e6" />
          <circle cx="14.3" cy="11.8" r="1.5" fill="#1aa9d6" />
          <rect x="9.5" y="14.4" width="5" height="1.3" rx="0.65" fill="#2560e6" opacity="0.5" />
        </svg>
      </span>
      <span className={cn("font-display text-lg font-bold tracking-tight text-foreground", textClassName)}>
        Learn<span className="text-primary">FRC</span>
      </span>
    </Link>
  );
}
