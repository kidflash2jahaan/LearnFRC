import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { clampPct } from "@/lib/utils";
import type { MemberDeptProgress } from "@/lib/queries";

export type ProgressMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isYou: boolean;
  completed: number;
  depts: MemberDeptProgress[];
};

/**
 * EACH PERSON'S PROGRESS, DEPARTMENT BY DEPARTMENT.
 *
 * One fold per teammate. Closed, it's a name, an overall figure and a strip of
 * small cells, one per department, filled by how much of that department
 * they've done, so a coach can scan the whole team for gaps without opening
 * anything. Open, it lists the departments they've started with a bar, the
 * furthest lesson they've reached in course order and the next one, then the
 * departments they haven't touched in one line.
 *
 * Server Component: native <details>, so it opens and closes with no
 * JavaScript and prints open.
 */
export function MemberProgress({ members }: { members: ProgressMember[] }) {
  return (
    <ul className="grid gap-3">
      {members.map((m) => {
        const total = m.depts.reduce((s, d) => s + d.total, 0);
        const pct = total ? clampPct((m.completed / total) * 100) : 0;
        const started = m.depts.filter((d) => d.completed > 0).sort((a, b) => b.completed / b.total - a.completed / a.total);
        const untouched = m.depts.filter((d) => d.completed === 0);
        return (
          <li key={m.userId}>
            <details
              open={m.isYou}
              className={`nb-box group p-[clamp(0.8rem,1.6vw,1.1rem)] ${m.isYou ? "border-l-[4px] border-l-blue" : ""}`}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={m.name} src={m.avatarUrl} seed={m.userId} className="h-9 w-9 shrink-0 text-[0.7rem]" />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">
                      {m.name}{" "}
                      {m.isYou && (
                        <span className="nb-tag align-middle" data-on>
                          you
                        </span>
                      )}
                    </span>
                    <span className="nb-slug mt-0.5 block tabular-nums">
                      {m.completed} of {total} lessons, {Math.round(pct)}%
                    </span>
                  </span>
                </span>
                <span
                  className="flex shrink-0 gap-1"
                  role="img"
                  aria-label={`${m.name}'s progress by department: ${m.depts
                    .map((d) => `${d.name} ${d.total ? Math.round((d.completed / d.total) * 100) : 0}%`)
                    .join(", ")}`}
                >
                  {m.depts.map((d) => {
                    const p = d.total ? d.completed / d.total : 0;
                    return (
                      <span
                        key={d.slug}
                        title={`${d.name}: ${d.completed} of ${d.total}`}
                        className="relative block h-6 w-3 overflow-hidden rounded-[3px] border-2 border-ink bg-paper"
                      >
                        <span className="absolute inset-x-0 bottom-0 bg-blue" style={{ height: `${Math.round(p * 100)}%` }} />
                      </span>
                    );
                  })}
                </span>
                <span aria-hidden="true" className="nb-slug shrink-0 group-open:hidden">
                  open
                </span>
                <span aria-hidden="true" className="nb-slug hidden shrink-0 group-open:inline">
                  close
                </span>
              </summary>

              <div className="mt-4 border-t-2 border-ink pt-4">
                {started.length === 0 ? (
                  <p className="text-[0.95rem] text-graphite">
                    {m.isYou ? "You haven't" : `${m.name} hasn't`} finished a lesson yet.
                  </p>
                ) : (
                  <ul className="grid gap-4 min-[760px]:grid-cols-2">
                    {started.map((d) => {
                      const dp = d.total ? clampPct((d.completed / d.total) * 100) : 0;
                      return (
                        <li key={d.slug} className="min-w-0">
                          <span className="nb-slug flex items-baseline justify-between gap-2">
                            <span className="truncate font-bold text-ink">{d.name}</span>
                            <span className="shrink-0 tabular-nums">
                              {d.completed}/{d.total}, {Math.round(dp)}%
                            </span>
                          </span>
                          <span className="nb-meter mt-1.5 block">
                            <span className="nb-meter-bar" style={{ width: `${dp}%` }} />
                          </span>
                          {d.furthest && (
                            <p className="mt-1.5 text-[0.85rem] leading-snug text-graphite">
                              Furthest: {d.furthest.moduleTitle}, &ldquo;{d.furthest.title}&rdquo;
                            </p>
                          )}
                          <p className="mt-0.5 text-[0.85rem] leading-snug">
                            {d.next ? (
                              <>
                                Next:{" "}
                                <Link href={d.next.href} className="nb-link">
                                  {d.next.title}
                                </Link>
                              </>
                            ) : (
                              <span className="font-bold">Department finished</span>
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {untouched.length > 0 && started.length > 0 && (
                  <p className="mt-4 text-[0.85rem] leading-snug text-graphite">
                    Not started yet: {untouched.map((d) => d.name).join(", ")}
                  </p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
