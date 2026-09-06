"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";

type Dept = {
  slug: string;
  name: string;
  tagline: string | null;
  icon: string;
  difficulty: string | null;
};
type LessonHit = {
  slug: string;
  title: string;
  summary: string;
  moduleSlug: string;
  deptSlug: string;
  deptName: string;
};
type ResultItem =
  | { type: "dept"; href: string; dept: Dept }
  | { type: "lesson"; href: string; lesson: LessonHit };

/**
 * The binder's index card, pulled out on ⌘K.
 *
 * A department is named by its name and its mono slug, never by a colour chip,
 * so every row here is type: `dept / cad-design` over the department name, or
 * the department name over the lesson title. That is also why the coloured icon
 * tiles are gone; they were the only thing in the old palette telling two rows
 * apart, and colour is not allowed to be the only signal.
 *
 * The highlighted row carries a blue wash AND a solid blue bar down its left
 * edge (`.nb-menu-item`), so keyboard position survives being read in
 * greyscale, or by someone who cannot pick the wash out of the card stock.
 *
 * Behaviour is unchanged: same shortcut, same `open-search` event, same lazily
 * fetched index, same filtering, same arrow/enter handling, same ARIA combobox.
 *
 * THIS SURFACE DOES NOT ANIMATE, AND THAT IS THE DESIGN
 * ----------------------------------------------------
 * The overlay does not fade, the sheet does not scale in from the trigger, and
 * the rows do not stagger. Every one of those was considered and every one was
 * rejected on the same ground: this is opened with a keystroke, hundreds of
 * times a day by anyone who actually uses the site. Motion on a keyboard-
 * initiated action is not polish, it is latency you cannot skip. Raycast has no
 * open animation for the same reason, and it is the right answer.
 *
 * The two things that could look like gaps are not:
 *
 *   - The highlight on a row is instant (`.nb-menu-item`, a blue wash and a
 *     blue bar). Arrow-key navigation fires as fast as the key repeats, so a
 *     transition here would smear the cursor across four rows and you would
 *     lose track of where you are. Instant is the feature.
 *   - There is no press state on a result. Pressing a result navigates, and the
 *     page changing is the feedback. A 90ms press in front of that is a 90ms
 *     delay in front of that.
 *
 * If a future pass wants to make the palette feel better, the lever is the
 * index fetch, not motion.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [depts, setDepts] = React.useState<Dept[]>([]);
  const [lessons, setLessons] = React.useState<LessonHit[]>([]);

  // open via ⌘K / Ctrl+K or custom event
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-search", onOpen);
    };
  }, []);

  // lazy-load the index the first time it opens
  React.useEffect(() => {
    if (open && !loaded) {
      fetch("/api/search-index")
        .then((r) => r.json())
        .then((d) => {
          setDepts(d.departments ?? []);
          setLessons(d.lessons ?? []);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }
  }, [open, loaded]);

  // Closing clears the box, and typing moves the cursor back to the top of the
  // list. Both used to be effects that called setState the moment they ran,
  // which is a cascading render for something that is only ever caused by an
  // event. They live in the handlers now: `query` and `open` have exactly one
  // writer each, so there is nothing left to synchronise after the fact.
  const onOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  }, []);

  const onQueryChange = React.useCallback((next: string) => {
    setQuery(next);
    setActive(0);
  }, []);

  const results = React.useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const deptHits = depts
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          (d.tagline ?? "").toLowerCase().includes(q)
      )
      .slice(0, q ? 5 : 14)
      .map<ResultItem>((d) => ({
        type: "dept",
        href: `/guides/${d.slug}`,
        dept: d,
      }));

    const lessonHits = q
      ? lessons
          .filter(
            (l) =>
              l.title.toLowerCase().includes(q) ||
              l.summary.toLowerCase().includes(q)
          )
          .slice(0, 8)
          .map<ResultItem>((l) => ({
            type: "lesson",
            href: `/guides/${l.deptSlug}/${l.moduleSlug}/${l.slug}`,
            lesson: l,
          }))
      : [];

    return [...deptHits, ...lessonHits];
  }, [query, depts, lessons]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r.href);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Flat newsprint wash, not a blur: the page behind reads as the sheet
            underneath this one on the desk. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[rgba(230,232,227,0.82)]" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
          className="nb-surface fixed left-1/2 top-[11vh] z-[61] flex max-h-[74vh] w-[92vw] max-w-xl -translate-x-1/2 flex-col overflow-hidden"
        >
          <DialogPrimitive.Title className="sr-only">
            Search LearnFRC
          </DialogPrimitive.Title>

          <div className="flex items-baseline gap-2 border-b-2 border-ink px-4 py-1">
            <label htmlFor="cmdk-input" className="nb-slug shrink-0 py-2">
              search /
            </label>
            <input
              id="cmdk-input"
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="department, lesson, topic"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="cmdk-list"
              aria-autocomplete="list"
              aria-activedescendant={
                results[active] ? `cmdk-opt-${active}` : undefined
              }
              /* No `outline-none`. Tab moves between this field and the
                 result buttons, and with the outline stripped the field was
                 the one control on the site with no visible focus at all.
                 The base ring (2px blue, 2px offset) applies here like
                 everywhere else; `outline-offset-0` keeps it off the row's
                 own ink rule. */
              className="w-full bg-transparent py-3 text-base text-ink focus-visible:outline-offset-0 placeholder:text-graphite"
            />
          </div>

          <div
            id="cmdk-list"
            role="listbox"
            aria-label="Search results"
            className="min-h-0 flex-1 overflow-y-auto py-1"
          >
            {!loaded && (
              <p className="nb-slug px-4 py-8 text-center">
                reading the index…
              </p>
            )}

            {loaded && results.length === 0 && (
              <div className="px-4 py-9 text-center">
                <p className="nb-slug">no match</p>
                <p className="mt-2 text-[0.95rem] text-graphite">
                  Nothing in the binder is filed under &ldquo;{query}&rdquo;.
                </p>
              </div>
            )}

            {results.map((r, i) => {
              const isActive = i === active;
              const [slug, title, sub] =
                r.type === "dept"
                  ? [`dept / ${r.dept.slug}`, r.dept.name, r.dept.tagline ?? ""]
                  : [
                      `lesson / ${r.lesson.deptSlug}`,
                      r.lesson.title,
                      r.lesson.deptName,
                    ];
              return (
                <button
                  key={r.href}
                  id={`cmdk-opt-${i}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className="nb-menu-item flex-col items-start gap-0.5 py-2.5"
                >
                  <span className="nb-slug">{slug}</span>
                  <span className="w-full truncate text-[0.95rem] font-semibold">
                    {title}
                  </span>
                  {sub && (
                    <span className="w-full truncate text-sm text-graphite">
                      {sub}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="nb-slug flex flex-wrap gap-x-4 gap-y-1 border-t-2 border-ink px-4 py-2.5">
            <span>up / down to move</span>
            <span>enter to open</span>
            <span>esc to close</span>
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
