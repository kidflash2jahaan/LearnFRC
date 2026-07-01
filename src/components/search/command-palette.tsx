"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, BookOpen, Layers } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { cn } from "@/lib/utils";

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

const KBD =
  "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [depts, setDepts] = React.useState<Dept[]>([]);
  const [lessons, setLessons] = React.useState<LessonHit[]>([]);
  const listRef = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

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

  React.useEffect(() => setActive(0), [query]);

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
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className={cn(
            "fixed left-1/2 top-[12vh] z-[61] w-[92vw] max-w-xl -translate-x-1/2",
            "overflow-hidden rounded-2xl border border-primary/30 bg-popover shadow-[0_0_40px_-10px_var(--primary)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search LearnFRC</DialogPrimitive.Title>

          {/* search input */}
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search departments, lessons, topics…"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="cmdk-list"
              aria-autocomplete="list"
              aria-activedescendant={
                results[active] ? `cmdk-opt-${active}` : undefined
              }
              aria-label="Search LearnFRC"
              className="w-full bg-transparent py-3.5 font-mono text-sm outline-none placeholder:text-muted-foreground/55"
            />
          </div>

          <div ref={listRef} id="cmdk-list" role="listbox" aria-label="Search results" className="max-h-[52vh] overflow-y-auto p-2">
            {!loaded && (
              <div className="px-3 py-8 text-center font-mono text-sm text-muted-foreground">
                indexing<span className="caret" aria-hidden />
              </div>
            )}
            {loaded && results.length === 0 && (
              <div className="px-3 py-10 text-center font-mono text-sm text-muted-foreground">
                <span className="text-primary">//</span> no matches for &ldquo;{query}&rdquo;
              </div>
            )}
            {results.map((r, i) => {
              const isActive = i === active;
              const activeCls = isActive
                ? "border-primary/50 bg-primary/10"
                : "border-transparent hover:border-border hover:bg-muted/50";
              if (r.type === "dept") {
                const m = deptMeta(r.dept.slug);
                return (
                  <button
                    key={`d-${r.dept.slug}`}
                    id={`cmdk-opt-${i}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      activeCls
                    )}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-lg border"
                      style={{
                        color: m.color,
                        borderColor: `color-mix(in srgb, ${m.color} 40%, var(--border))`,
                        background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
                      }}
                    >
                      <Icon name={r.dept.icon} className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.dept.name}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {r.dept.tagline}
                      </span>
                    </span>
                    {isActive ? (
                      <CornerDownLeft className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                );
              }
              return (
                <button
                  key={`l-${r.lesson.deptSlug}-${r.lesson.slug}`}
                  id={`cmdk-opt-${i}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    activeCls
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                    <BookOpen className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.lesson.title}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {r.lesson.deptName}
                    </span>
                  </span>
                  {isActive && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* terminal hint bar */}
          <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>↑</kbd>
              <kbd className={KBD}>↓</kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>↵</kbd> open
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className={KBD}>esc</kbd> close
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-primary/80">
              learnfrc<span className="caret" aria-hidden />
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
