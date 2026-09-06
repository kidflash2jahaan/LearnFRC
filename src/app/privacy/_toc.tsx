"use client";

import * as React from "react";

export type TocItem = { id: string; title: string };

/**
 * The binder index for the policy: numbered sections down the left of a long
 * document, with the one you are reading marked.
 *
 * The observer logic is unchanged from the version this replaces. It tracks
 * which section is nearest the top of the reading band and marks it; the first
 * item is the deterministic initial state so server and client markup agree on
 * mount and nothing flashes.
 *
 * The mark itself is now `nb-menu-item`'s: a blue wash plus a blue bar down
 * the left edge, never colour on its own, so the current section survives a
 * greyscale photocopy. That also retires the shared-layout pill this used to
 * animate, which was the only reason the file pulled in a motion library.
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
    <nav aria-label="On this page">
      <p className="nb-slug px-3 pb-2">on this page</p>
      <ol className="nb-hair list-none pt-2">
        {items.map((it, i) => {
          const isActive = it.id === active;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                aria-current={isActive ? "true" : undefined}
                data-highlighted={isActive ? "" : undefined}
                className="nb-menu-item items-baseline gap-2.5 py-2 text-[0.86rem] leading-snug"
              >
                <span
                  className={`nb-slug shrink-0 tabular-nums ${
                    isActive ? "font-bold text-blue" : ""
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={isActive ? "font-semibold" : ""}>{it.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
