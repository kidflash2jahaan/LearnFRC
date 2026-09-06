"use client";

import * as React from "react";

export interface TocItem {
  id: string;
  text: string;
}

/**
 * The margin index of the sheet.
 *
 * What this is NOT any more:
 *
 *  - It is not a second reading-progress bar. The site already rules one in
 *    ballpoint across the very top of every page (`ScrollProgress`), tracking
 *    the same document scroll from a motion value. This one tracked it from
 *    React state on a `scroll` listener, so every frame of every scroll on
 *    every article re-rendered a component, to draw a line that was already
 *    there.
 *  - It is not a card. The article body is the page; a boxed panel beside it
 *    would read as a second document. This is what a student writes down the
 *    edge of a page instead: a rule, then the sections, numbered.
 *
 * What is left is the one genuinely interactive thing, which is why this is
 * still a client leaf: an IntersectionObserver saying which section you are
 * in, and a jump that lands the heading clear of the sticky header and moves
 * focus there so a keyboard reader ends up where the click pointed.
 *
 * The ids are NOT assigned here. `Markdown` stamps every heading with the id
 * `extractHeadings` derived from the same markdown string, and the page builds
 * this list from that same function, so both sides agree by construction
 * rather than by walking the DOM in index order and hoping.
 */
export function ReadingRail({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = React.useState<string>(items[0]?.id ?? "");

  React.useEffect(() => {
    if (items.length === 0) return;

    // Bottom margin at -66% so a heading counts as "current" only while it is
    // in the top third of the viewport, which is where a reader's eye is.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -66% 0px", threshold: 0 }
    );
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  const onJump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    // `scroll-behavior: smooth` is set on <html> and is already dropped under
    // a reduced-motion preference, so this inherits the right one either way.
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88 });
    setActiveId(id);
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  // One heading is not a contents list, it is a heading.
  if (items.length < 2) return null;

  return (
    <nav aria-label="On this page" className="hidden xl:block">
      <div className="sticky top-[5.5rem] max-h-[calc(100dvh-7rem)] overflow-y-auto">
        <p className="nb-slug border-b-2 border-[var(--ink)] pb-2">
          on this sheet / {items.length}
        </p>

        <ol className="mt-1">
          {items.map((it, i) => {
            const active = it.id === activeId;
            return (
              <li
                key={it.id}
                className="border-b border-dashed border-rule last:border-b-0"
              >
                <a
                  href={`#${it.id}`}
                  onClick={(e) => onJump(e, it.id)}
                  aria-current={active ? "location" : undefined}
                  className={[
                    "flex min-h-[var(--tap)] items-baseline gap-2.5 border-l-2 py-2 pl-2.5",
                    // The state is a bar plus weight plus colour, so it still
                    // reads when the page is printed in greyscale.
                    active
                      ? "border-l-blue bg-[rgba(27,54,200,0.055)] font-bold text-ink"
                      : "border-l-transparent text-graphite hover:text-ink",
                  ].join(" ")}
                >
                  {/* `text-inherit` so the ordinal takes the row's state
                      colour instead of nb-slug's own graphite. */}
                  <span className="nb-slug shrink-0 tabular-nums text-inherit">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 text-[0.88rem] leading-snug">
                    {it.text}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
