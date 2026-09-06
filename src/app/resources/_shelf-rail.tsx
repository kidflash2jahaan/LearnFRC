"use client";

import * as React from "react";

export type RailItem = { id: string; label: string; count: number };

/**
 * The index tab down the side of the toolbox.
 *
 * This is the one leaf on the page that genuinely needs the client: which shelf
 * you are looking at is a fact about the scroll position, and there is no way
 * to know it on the server. It is marked with `data-highlighted` as well as
 * `aria-current`, because the system draws that state as a blue wash AND a blue
 * bar rather than as colour alone, so it survives being printed in greyscale.
 *
 * The observer's rootMargin ignores the top 100px (the sticky header) and the
 * bottom 65% of the viewport, so the "current" shelf is the one under the
 * reader's eye rather than whichever one happens to be entering from below.
 */
export function ShelfRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = React.useState<string>(items[0]?.id ?? "");

  React.useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -65% 0px", threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Shelves" className="nb-surface overflow-hidden pb-1">
      <p className="nb-slug border-b border-dashed border-rule px-3.5 pb-2 pt-3">
        the shelves
      </p>
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={isActive ? "true" : undefined}
            data-highlighted={isActive ? "" : undefined}
            className="nb-menu-item justify-between gap-3"
          >
            <span className="min-w-0 text-[0.92rem] leading-snug">
              {item.label}
            </span>
            <span className="nb-slug shrink-0">{item.count}</span>
          </a>
        );
      })}
    </nav>
  );
}
