"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, UserPlus } from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { Avatar } from "@/components/ui/avatar";
import { subteamLabel } from "@/components/team/subteam-label";
import { clampPct } from "@/lib/utils";

/**
 * One subteam row, already joined against the roster on the server: usernames
 * and avatars only, never `full_name`.
 */
export type SubteamRow = {
  slug: string;
  name: string;
  accent: string;
  /** Icon NAME, resolved through the shared icon map — never a component. */
  icon: string;
  lessonCount: number;
  /** Distinct lessons finished by anyone on the team. */
  teamCompleted: number;
  crew: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    completed: number;
    isYou: boolean;
  }[];
};

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * The subteam coverage board — the point of the whole page.
 *
 * An FRC team is split into subteams and so is this catalog, one department
 * each. Showing all eleven with who on YOUR team is actually on each one turns
 * an abstract "invite your friends" into a specific, checkable gap: nobody has
 * touched Electrical. That gap is the ask.
 *
 * Hydration contract: the rendered tree and every string are identical on server
 * and client. `useReducedMotion` only ever changes `transition`; hover lift is
 * pure CSS behind `motion-safe:`.
 */
export function SubteamBoard({ rows }: { rows: SubteamRow[] }) {
  const reduce = useReducedMotion();

  return (
    <ul
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      aria-label="Subteam coverage across your team"
    >
      {rows.map((row, i) => {
        const pct =
          row.lessonCount > 0
            ? clampPct((row.teamCompleted / row.lessonCount) * 100)
            : 0;
        const done = row.lessonCount > 0 && row.teamCompleted >= row.lessonCount;
        const gap = row.crew.length === 0;
        const label = subteamLabel(row.name);
        // Crew arrives sorted by lessons done, but a straight top-4 cut can hide
        // the viewer in a big subteam — and "where am I on this" is half the
        // reason to look. Float yourself into the last visible slot.
        const meIdx = row.crew.findIndex((m) => m.isYou);
        const ordered =
          meIdx < 4
            ? row.crew
            : [
                ...row.crew.filter((_, k) => k !== meIdx).slice(0, 3),
                row.crew[meIdx],
                ...row.crew.filter((_, k) => k !== meIdx).slice(3),
              ];
        const shown = ordered.slice(0, 4);
        const overflow = Math.max(0, row.crew.length - shown.length);
        const delay = Math.min(i, 8) * 0.04;

        return (
          <motion.li
            key={row.slug}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.45, delay, ease: EASE }
            }
          >
            <Link
              href={`/guides/${row.slug}`}
              aria-label={
                gap
                  ? `${label} — nobody on your team has started it, 0 of ${row.lessonCount} lessons`
                  : `${label} — your team has finished ${row.teamCompleted} of ${row.lessonCount} lessons`
              }
              className={`ac-card block px-4 py-3.5 transition-transform duration-300 motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                // ac-card's own border is near-white, so a plain `border-dashed`
                // would be invisible — the colour has to come with it.
                gap ? "border-dashed border-[rgba(120,145,190,0.45)]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`ac-badge flex h-9 w-9 shrink-0 items-center justify-center ${
                    gap ? "opacity-55" : ""
                  }`}
                  style={{ "--a": row.accent } as CSSProperties}
                >
                  <Icon name={row.icon} className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-foreground">
                      {label}
                    </span>

                    {/* who on your team is on it */}
                    {gap ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[rgba(120,145,190,0.6)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        <UserPlus className="h-3 w-3" aria-hidden />
                        Nobody yet
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center">
                        {shown.map((m, mi) => (
                          <span
                            key={m.userId}
                            className={`relative -ml-2 rounded-full ring-2 first:ml-0 ${
                              // Spotting yourself in a 15-person stack matters
                              // more than the stack looking uniform.
                              m.isYou ? "ring-primary" : "ring-white"
                            }`}
                            style={{ zIndex: shown.length - mi }}
                            title={`${m.name} — ${m.completed} ${
                              m.completed === 1 ? "lesson" : "lessons"
                            }`}
                          >
                            <Avatar
                              name={m.name}
                              src={m.avatarUrl}
                              seed={m.userId}
                              className="h-6 w-6"
                            />
                          </span>
                        ))}
                        {overflow > 0 && (
                          <span className="relative -ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(120,145,190,0.22)] text-[10px] font-bold text-muted-foreground ring-2 ring-white">
                            +{overflow}
                          </span>
                        )}
                      </span>
                    )}
                  </span>

                  <span className="mt-2 flex items-center gap-2.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(120,145,190,0.2)]">
                      <motion.span
                        className="block h-full rounded-full"
                        style={{
                          transformOrigin: "left",
                          background: `linear-gradient(90deg, ${row.accent}, color-mix(in srgb, ${row.accent} 55%, #1aa9d6))`,
                        }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: pct / 100 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={
                          reduce
                            ? { duration: 0 }
                            : { duration: 0.8, delay: delay + 0.1, ease: EASE }
                        }
                      />
                    </span>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {done ? (
                        <span className="inline-flex items-center gap-1 font-bold text-success">
                          <Check className="h-3 w-3" aria-hidden />
                          All {row.lessonCount}
                        </span>
                      ) : (
                        <>
                          {row.teamCompleted}/{row.lessonCount}
                        </>
                      )}
                    </span>
                  </span>
                </span>
              </div>
            </Link>
          </motion.li>
        );
      })}
    </ul>
  );
}

/**
 * Eleven pips, one per subteam — the whole team's shape in a single line, so the
 * gaps are visible before you read a word. Decorative; the board below is the
 * accessible version.
 */
export function SubteamMeter({ rows }: { rows: SubteamRow[] }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {rows.map((r) => (
        <span
          key={r.slug}
          className="h-2 flex-1 rounded-full"
          style={
            r.crew.length
              ? { background: r.accent }
              : {
                  background: "transparent",
                  boxShadow: "inset 0 0 0 1.5px rgba(120,145,190,0.5)",
                }
          }
        />
      ))}
    </span>
  );
}
