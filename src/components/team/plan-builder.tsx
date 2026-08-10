"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Compass,
  Loader2,
  Route,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Icon } from "@/lib/icon-map";
import { deptMeta } from "@/lib/departments";
import { assignPlan, clearPlan } from "@/app/teams/space/plan/actions";

/**
 * The lead's plan editor.
 *
 * WHAT A LEAD CAN PUT IN A PLAN, exhaustively: one of the five curated routes
 * from /paths, OR up to `maxDepartments` departments from the catalog, plus an
 * optional date. That is the entire input surface, and it is entirely
 * fixed-list — there is no text field in this component and none may be added.
 * A free-text note here would be a message from an adult to a minor, delivered
 * on the minor's own dashboard with the site's branding behind it, which is
 * exactly the channel this product refuses to build.
 *
 * WHY THE WARNING SITS ABOVE THE BUTTON. A lead needs to know, before they
 * press it, that this does not make anyone do anything. If they expect it to
 * compel and it does not, they will go looking for the feature that does.
 * Saying plainly what it is prevents that.
 *
 * HYDRATION: no localStorage, no window and no Date() during render. The date
 * input's min/max arrive pre-computed from the server, so the first client
 * render is byte-identical to the SSR output.
 */

type PathOption = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  steps: { slug: string; label: string }[];
  outcomes: string[];
};

type DeptOption = {
  id: string;
  slug: string;
  name: string;
  lessonCount: number;
};

const ERROR_COPY: Record<string, string> = {
  unauthenticated: "You're signed out — sign back in and try again.",
  not_lead: "Only the person who created this team space can change the plan.",
  rate_limited: "That's a lot of changes in one go. Try again in a little while.",
  invalid_plan: "Pick a route, or choose at least one department.",
  invalid_date: "Pick a target date within the next six months, or leave it blank.",
  server_error: "That didn't save. Try again in a moment.",
};

export function PlanBuilder({
  teamName,
  paths,
  departments,
  current,
  minDate,
  maxDate,
  maxDepartments,
  hasPlan,
}: {
  teamName: string;
  paths: PathOption[];
  departments: DeptOption[];
  /** Pre-selects the editor with whatever is already up. */
  current: { pathSlug: string | null; departmentIds: string[]; dueOn: string | null } | null;
  /** YYYY-MM-DD, computed server-side so SSR and hydration agree. */
  minDate: string;
  maxDate: string;
  maxDepartments: number;
  hasPlan: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [mode, setMode] = React.useState<"path" | "custom">(
    current && !current.pathSlug ? "custom" : "path"
  );
  const [pathSlug, setPathSlug] = React.useState<string | null>(
    current?.pathSlug ?? null
  );
  const [deptIds, setDeptIds] = React.useState<string[]>(
    current && !current.pathSlug ? current.departmentIds : []
  );
  const [dueOn, setDueOn] = React.useState<string>(current?.dueOn ?? "");
  const [message, setMessage] = React.useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const atLimit = deptIds.length >= maxDepartments;
  const canSubmit =
    !pending && (mode === "path" ? Boolean(pathSlug) : deptIds.length > 0);

  const toggleDept = (id: string) => {
    setMessage(null);
    setDeptIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= maxDepartments
          ? prev
          : [...prev, id]
    );
  };

  const submit = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await assignPlan(
        mode === "path"
          ? { pathSlug, dueOn: dueOn || null }
          : { departmentIds: deptIds, dueOn: dueOn || null }
      );
      if (res.ok) {
        setMessage({
          kind: "ok",
          text: "Suggestion is up. Everyone in the space will see it on their dashboard.",
        });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: ERROR_COPY[res.error] ?? ERROR_COPY.server_error });
      }
    });
  };

  const remove = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await clearPlan();
      if (res.ok) {
        setPathSlug(null);
        setDeptIds([]);
        setDueOn("");
        setMessage({ kind: "ok", text: "Suggestion taken down." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: ERROR_COPY[res.error] ?? ERROR_COPY.server_error });
      }
    });
  };

  return (
    <div className="ac-card p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span
          className="ac-badge flex h-12 w-12 shrink-0 items-center justify-center"
          style={{ "--a": "#2560e6" } as CSSProperties}
        >
          <Route className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="ac-eyebrow">Suggest a route</p>
          <h2 className="mt-1.5 font-display text-2xl font-bold text-foreground">
            {hasPlan ? "Change what your team sees" : "Put a route up for your team"}
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-foreground/70">
            Pick one of the curated routes — the same ones on{" "}
            <span className="font-semibold text-foreground">/paths</span> — or
            choose the departments your team needs covered. Everyone in{" "}
            {teamName} sees it as a gentle card on their dashboard, and they can
            dismiss it.
          </p>
        </div>
      </div>

      {/* The honest description of what pressing the button does. */}
      <p className="mt-5 rounded-2xl border border-border/70 bg-muted/40 p-4 text-[15px] leading-relaxed text-foreground/75">
        <span className="font-semibold text-foreground">
          This suggests. It does not require.
        </span>{" "}
        Nobody is emailed, nothing gets locked, no lesson is marked for anyone,
        and no one&apos;s XP, streak or badges change. If a member ignores it
        entirely, nothing happens and you are not told. Everything on LearnFRC
        is optional — a plan is you saying &ldquo;here&apos;s where I&apos;d
        start&rdquo;, nothing more.
      </p>

      {/* ── mode switch ── */}
      {/* Toggle buttons with aria-pressed rather than role="radio": a real
          radiogroup owes the user arrow-key roving focus, and a pair of
          buttons that lies about its role is worse for a screen reader than
          an honest pressed-state toggle. */}
      <div aria-label="How to build the plan" className="mt-7 flex flex-wrap gap-2">
        {(
          [
            { key: "path", label: "Use a curated route", icon: Compass },
            { key: "custom", label: "Pick departments", icon: Sparkles },
          ] as const
        ).map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setMode(opt.key);
                setMessage(null);
              }}
              className={active ? "ac-btn text-sm" : "ac-btn-ghost text-sm"}
            >
              <opt.icon className="h-4 w-4" aria-hidden />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* ── curated routes ── */}
      {mode === "path" && (
        <div aria-label="Curated routes" className="mt-5 grid gap-3 sm:grid-cols-2">
          {paths.map((p) => {
            const active = pathSlug === p.slug;
            return (
              <button
                key={p.slug}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setPathSlug(p.slug);
                  setMessage(null);
                }}
                className={`ac-tile relative flex w-full flex-col items-start gap-2 p-4 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  active ? "ring-2 ring-primary/60" : ""
                }`}
                style={{ "--a": p.color } as CSSProperties}
              >
                <span className="flex w-full items-start justify-between gap-3">
                  <span
                    className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                    style={{ "--a": p.color } as CSSProperties}
                  >
                    <Icon name={p.icon} className="h-5 w-5" />
                  </span>
                  {active && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </span>
                <span className="font-display text-base font-bold text-foreground">
                  {p.title}
                </span>
                <span className="line-clamp-2 text-sm leading-snug text-foreground/70">
                  {p.description}
                </span>
                <span className="mt-1 text-xs font-semibold text-muted-foreground">
                  {p.steps.length} stops · {p.outcomes.length} outcomes
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── hand-picked departments ── */}
      {mode === "custom" && (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">
            Choose up to {maxDepartments}. {deptIds.length} selected
            {atLimit ? " — that's the limit" : ""}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {departments.map((d) => {
              const active = deptIds.includes(d.id);
              const m = deptMeta(d.slug);
              const disabled = !active && atLimit;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => toggleDept(d.id)}
                  className={`ac-chip inline-flex items-center gap-2 px-3 py-2 text-sm transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    active ? "ring-2 ring-primary/60" : ""
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  style={{ "--a": m.color } as CSSProperties}
                >
                  <Icon name={m.icon} className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{d.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {d.lessonCount}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── optional target date ── */}
      <div className="mt-7 border-t border-border/70 pt-6">
        <label
          htmlFor="plan-due"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
          Target date <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A date the team is aiming at together — before your first competition,
          say. It is shown as a target and nothing else: when it passes, nothing
          is flagged, nobody is chased, and the route stays exactly where it is.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            id="plan-due"
            type="date"
            value={dueOn}
            min={minDate}
            max={maxDate}
            onChange={(e) => {
              setDueOn(e.target.value);
              setMessage(null);
            }}
            className="ac-input h-11 w-full max-w-[15rem] px-3 text-sm"
          />
          {dueOn && (
            <button
              type="button"
              onClick={() => setDueOn("")}
              className="ac-btn-ghost text-sm"
            >
              Clear date
            </button>
          )}
        </div>
      </div>

      {/* ── actions ── */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="ac-btn text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
          {hasPlan ? "Update the suggestion" : "Suggest this to the team"}
        </button>
        {hasPlan && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ac-btn-ghost text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Take it down
          </button>
        )}
      </div>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-4 text-sm font-medium ${
            message.kind === "ok" ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
