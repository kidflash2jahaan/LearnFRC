"use client";

import * as React from "react";
import { Icon } from "@/lib/icon-map";
import { inkFor } from "@/lib/departments";
import { cn } from "@/lib/utils";

export type RailItem = {
  id: string;
  label: string;
  count: number;
  icon: string;
  color: string;
};

/**
 * Sticky "shelves" index for the toolbox — highlights the shelf currently in
 * view as you scroll, via IntersectionObserver (client-only side effect; the
 * initial render is deterministic so SSR/first-paint text never mismatches).
 */
export function ShelfRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = React.useState<string>(items[0]?.id ?? "");

  React.useEffect(() => {
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -65% 0px", threshold: 0 }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Shelf sections" className="space-y-1">
      {items.map((it) => {
        const isActive = it.id === active;
        return (
          <a
            key={it.id}
            href={`#${it.id}`}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "group flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors"
              style={{
                color: isActive ? inkFor(it.color) : undefined,
                background: isActive
                  ? `color-mix(in srgb, ${it.color} 16%, transparent)`
                  : "transparent",
              }}
            >
              <Icon name={it.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground/80">
              {it.count}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
