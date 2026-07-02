"use client";

import * as React from "react";
import { motion } from "framer-motion";

export type TocItem = { id: string; title: string };

/**
 * Sticky scroll-spy table of contents. IntersectionObserver tracks which
 * section is nearest the top of the reading band and highlights it with a
 * shared-layout pill. Initial active section is deterministic (items[0]),
 * so server/client markup matches on mount — no hydration mismatch.
 */
export function PrivacyToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = React.useState(items[0]?.id ?? "");

  React.useEffect(() => {
    const sections = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visible.delete(entry.target.id);
          }
        }
        if (visible.size > 0) {
          const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
          setActive(top[0]);
        }
      },
      { rootMargin: "-112px 0px -55% 0px", threshold: [0, 1] }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
      <ul className="space-y-0.5">
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                aria-current={isActive ? "true" : undefined}
                className={`relative flex min-h-11 items-center rounded-xl px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  isActive ? "text-primary" : "text-foreground/65 hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="privacy-toc-active"
                    className="absolute inset-0 -z-10 rounded-xl bg-primary/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="leading-snug">{it.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
