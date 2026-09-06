"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Lesson = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  estimated_minutes: number;
};
type ModuleT = {
  id: string;
  slug: string;
  title: string;
  overview: string | null;
  is_prerequisite?: boolean;
  lessons: Lesson[];
};

/**
 * The tick in the margin. Drawn, not an icon set: this system is type, rules
 * and tape, and it is the only mark on the page that means "done".
 *
 * It is never the only signal. Every row that carries a tick also carries the
 * word "done" for screen readers, and every module prints its own count in
 * figures, so the state survives both greyscale and no CSS at all.
 */
function Tick({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 grid size-[1.15rem] shrink-0 place-items-center rounded-[var(--hand-s)] border-2 border-ink"
    >
      {done && (
        <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden="true">
          <path
            d="M1.6 6.3 4.4 9.2 10.4 2.6"
            stroke="var(--blue)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/**
 * The department's curriculum, as the log it is.
 *
 * The old version was a stack of glass cards with a gradient hairline that swept
 * in on hover and a coloured ring per module. This is the same information as a
 * page of the binder: each module opens on a heavy ink rule, states its number,
 * its title and its count, and unfolds into the carbon-copy list of its lessons.
 *
 * WHY THE LESSON LIST IS ALWAYS MOUNTED. These `<a href>`s are the only crawl
 * paths from the eleven department hubs to the ~394 lesson pages. Collapsing
 * animates the panel shut rather than unmounting it, so every lesson link ships
 * in the server HTML; unmounting hid all but module one from crawlers. The
 * 0fr to 1fr grid row is the height:auto transition, deterministic, with no
 * measurement and no hydration branch, and `inert` keeps a collapsed panel out
 * of the tab order and the accessibility tree without removing it from the
 * document.
 *
 * Client, and only just: the single piece of state is which modules are open.
 */
export function DepartmentModules({
  departmentSlug,
  modules,
  completedIds,
}: {
  departmentSlug: string;
  modules: ModuleT[];
  completedIds: string[];
}) {
  const completed = React.useMemo(() => new Set(completedIds), [completedIds]);
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((m, i) => [m.id, i === 0]))
  );

  // Number the regular modules 1..N. A prerequisite module is not part of that
  // sequence, so it gets a slug rather than a place in the count.
  let regular = 0;
  const labels = modules.map((m) => (m.is_prerequisite ? "pre" : String(++regular)));

  return (
    <ol className="m-0 list-none p-0">
      {modules.map((m, mi) => {
        const total = m.lessons.length;
        const done = m.lessons.filter((l) => completed.has(l.id)).length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const isOpen = !!open[m.id];
        const isPre = !!m.is_prerequisite;
        const label = labels[mi];
        const moduleComplete = total > 0 && done === total;

        return (
          <li key={m.id} className="nb-rule">
            <h3 className="m-0 text-base">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}
                aria-expanded={isOpen}
                aria-controls={`mod-panel-${m.id}`}
                className="flex w-full cursor-pointer items-center gap-[clamp(0.7rem,2vw,1.15rem)] py-[clamp(0.9rem,2vw,1.3rem)] text-left hover:bg-[rgba(27,54,200,0.045)]"
              >
                {/* the module's number, boxed the way a part is stamped */}
                <span className="nb-box-sm grid size-11 shrink-0 place-items-center font-mono text-[0.86rem] font-bold tabular-nums">
                  {isPre ? "pre" : String(Number(label)).padStart(2, "0")}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    {isPre && <span className="nb-tag">start here</span>}
                    <span className="font-display text-[clamp(1.05rem,0.95rem+0.5vw,1.3rem)] font-extrabold leading-tight tracking-[-0.025em]">
                      {m.title}
                    </span>
                    {moduleComplete && (
                      <>
                        <Tick done />
                        <span className="sr-only">Module complete</span>
                      </>
                    )}
                  </span>
                  <span className="nb-slug mt-1 block">
                    {isPre ? "recommended first, " : ""}
                    {done} of {total} {total === 1 ? "lesson" : "lessons"}, {pct}%
                  </span>
                </span>

                {/* The bar never travels alone: the figure is in the line above. */}
                <span className="nb-meter hidden w-24 shrink-0 sm:block" aria-hidden="true">
                  <span className="nb-meter-bar" style={{ width: `${pct}%` }} />
                </span>

                {/* Decorative: the button's own aria-expanded is the real state. */}
                <span
                  aria-hidden="true"
                  className="nb-box-sm grid size-8 shrink-0 place-items-center font-mono text-base font-bold leading-none text-blue"
                >
                  {isOpen ? "-" : "+"}
                </span>
              </button>
            </h3>

            <div
              id={`mod-panel-${m.id}`}
              inert={!isOpen}
              className={cn(
                // The curve and the duration are the system's tokens, not a
                // hand-typed copy of them. `cubic-bezier(0.2,0.9,0.3,1)` and
                // `300ms` were literals here, which is the same disclosure
                // spelled a second way: the admin panel opens on
                // `--nb-t-enter` / `--nb-ease-out` and so does this.
                "grid transition-[grid-template-rows,opacity] duration-[var(--nb-t-enter)] ease-[var(--nb-ease-out)] motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="pb-[clamp(1rem,2.4vw,1.6rem)] pl-0 sm:pl-[3.6rem]">
                  {m.overview && (
                    <p className="max-w-[62ch] text-[0.95rem] text-graphite">
                      {m.overview}
                    </p>
                  )}

                  {/* The accordion header cannot be this link, because it is the
                      disclosure button and a link inside a button is invalid.
                      Putting it here also means every module hub keeps a real
                      inbound link in the department page's server HTML. */}
                  <p className={cn("nb-slug", m.overview ? "mt-3" : "")}>
                    <Link
                      href={`/guides/${departmentSlug}/${m.slug}`}
                      className="nb-link inline-flex min-h-11 items-center"
                    >
                      Read the module overview
                    </Link>
                  </p>

                  <ul className="nb-list mt-3 list-none p-0">
                    {m.lessons.map((l, li) => {
                      const isDone = completed.has(l.id);
                      return (
                        <li key={l.id}>
                          <Link
                            href={`/guides/${departmentSlug}/${m.slug}/${l.slug}`}
                            className="nb-row group grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-3"
                          >
                            <Tick done={isDone} />
                            <span className="min-w-0">
                              <span className="nb-slug mr-2 font-bold text-blue">
                                {isPre ? "P" : label}.{li + 1}
                              </span>
                              <span className="text-[0.97rem] leading-snug group-hover:underline group-hover:decoration-blue group-hover:decoration-2 group-hover:underline-offset-4">
                                {l.title}
                              </span>
                              {isDone && <span className="sr-only"> (done)</span>}
                            </span>
                            {l.estimated_minutes ? (
                              <span className="nb-slug hidden shrink-0 sm:block">
                                {l.estimated_minutes} min
                              </span>
                            ) : (
                              <span aria-hidden="true" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
