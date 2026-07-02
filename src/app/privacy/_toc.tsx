"use client";

import { useEffect, useState } from "react";
import {
  Database,
  Activity,
  Eye,
  Cookie,
  Cog,
  Baby,
  Trash2,
  Lock,
  RefreshCw,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

/** Icon registry — client-owned so no component functions cross the RSC boundary. */
const ICONS: Record<string, LucideIcon> = {
  collect: Database,
  use: Activity,
  public: Eye,
  cookies: Cookie,
  providers: Cog,
  children: Baby,
  retention: Trash2,
  security: Lock,
  changes: RefreshCw,
  contact: MessageCircle,
};

export type TocItem = { id: string; title: string };

/**
 * Sticky scroll-spy table of contents for the privacy policy.
 * Highlights the section currently in view and smooth-scrolls on click.
 * Reduced-motion users still get instant, accurate jumps.
 */
export function PrivacyToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const targets = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Sections of this policy" className="flex flex-col gap-1">
      {items.map((item, i) => {
        const isActive = active === item.id;
        const Ico = ICONS[item.id] ?? Database;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={isActive ? "true" : undefined}
            className={[
              "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground/70 hover:bg-white/60 hover:text-foreground",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition-all duration-300",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40",
              ].join(" ")}
              style={{ background: "linear-gradient(180deg,#2560e6,#1aa9d6)" }}
            />
            <Ico
              className={[
                "h-4 w-4 shrink-0 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground",
              ].join(" ")}
              aria-hidden
            />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="mr-1.5 tabular-nums text-xs text-muted-foreground/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.title}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
