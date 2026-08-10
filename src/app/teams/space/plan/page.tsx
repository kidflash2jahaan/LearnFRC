import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Compass, Route, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDepartments } from "@/lib/queries";
import { Glow, Reveal, RiseGroup, RiseItem } from "@/components/motion/primitives";
import { PlanBoard, type PlanBoardDept } from "@/components/team/plan-board";
import { PlanBuilder } from "@/components/team/plan-builder";
import {
  MAX_DUE_DAYS,
  MAX_PLAN_DEPARTMENTS,
  getActivePlan,
  getMyDeptProgress,
  getPlanContext,
  isoDayFromNow,
  planPathOptions,
  todayIso,
} from "./plan-data";

/**
 * /teams/space/plan — the training plan surface.
 *
 * A lead sees the editor and whatever is currently up. A member sees only what
 * is up, plus their own position on it. Everyone else — a signed-in user who is
 * in no space — gets an explanation and a link out, never an error and never a
 * hint that a particular space exists.
 *
 * The page renders ZERO cross-user data. Every progress number on it belongs to
 * the person reading it, so there is no roster read here to get wrong and
 * nothing to leak if the authorisation above it ever regressed.
 *
 * `force-dynamic` because it is per-viewer to the last pixel; nothing here may
 * be cached under a viewer-agnostic key, and no CDN may hold it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Plan · LearnFRC",
  description: "The route your team suggested, and where you are on it.",
  robots: { index: false, follow: false },
};

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export default async function TeamPlanPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/teams/space/plan");

  const [context, plan, myProgress] = await Promise.all([
    getPlanContext(),
    getActivePlan(),
    getMyDeptProgress(),
  ]);

  const boardDepts: PlanBoardDept[] = (plan?.departments ?? []).map((d) => ({
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    label: d.label,
    note: d.note,
    done: myProgress[d.id]?.done ?? 0,
    total: myProgress[d.id]?.total ?? d.lessonCount,
  }));

  const isLead = context?.myRole === "lead";
  const departments = isLead ? await getDepartments().catch(() => []) : [];

  return (
    <div className="relative overflow-x-clip">
      <Glow
        blobs={[
          { size: "600px", pos: { left: "-170px", top: "-200px" }, color: "#8bbcff", opacity: 0.6 },
          { size: "540px", pos: { right: "-160px", top: "40px" }, color: "#6ff0ea", opacity: 0.45, delay: 2 },
          { size: "480px", pos: { left: "30%", top: "560px" }, color: "#c8b6ff", opacity: 0.35, delay: 4 },
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <RiseGroup>
          <RiseItem>
            <span className="ac-chip inline-flex items-center gap-2">
              <Route className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="ac-eyebrow">
                {context ? context.teamName : "Team spaces"}
              </span>
            </span>
          </RiseItem>
          <RiseItem>
            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
              A <span style={BRAND_GRADIENT}>suggested route</span>, not a
              syllabus
            </h1>
          </RiseItem>
          <RiseItem>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/70">
              A team plan is one person saying &ldquo;this is where I&apos;d
              start&rdquo;. It never locks a lesson, never marks anything for
              anyone, and never tells on you. Everything on LearnFRC stays
              optional, always.
            </p>
          </RiseItem>
        </RiseGroup>

        {/* ── not in a space ───────────────────────────────────────────── */}
        {!context && (
          <Reveal className="mt-12">
            <div className="ac-glass p-8 text-center sm:p-10">
              <span
                className="ac-badge mx-auto flex h-14 w-14 items-center justify-center"
                style={{ "--a": "#2560e6" } as CSSProperties}
              >
                <Users className="h-7 w-7" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold text-foreground">
                You&apos;re not in a team space yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-foreground/70">
                Team spaces are opt-in: someone on your team creates one and
                shares a link, and you decide whether to join. Until then
                there&apos;s nothing to see here — and every learning path on
                the site is open to you anyway.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/paths" className="ac-btn text-sm">
                  Browse the routes <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/teams" className="ac-btn-ghost text-sm">
                  My team
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* ── the active plan ──────────────────────────────────────────── */}
        {context && plan && (
          <Reveal className="mt-12">
            <PlanBoard
              teamName={plan.teamName}
              pathTitle={plan.path?.title ?? null}
              pathDescription={plan.path?.description ?? null}
              pathIcon={plan.path?.icon ?? null}
              pathColor={plan.path?.color ?? null}
              departments={boardDepts}
              dueLabel={plan.dueLabel}
              dueIsPast={plan.dueIsPast}
            />
          </Reveal>
        )}

        {/* ── member, nothing suggested ────────────────────────────────── */}
        {context && !plan && !isLead && (
          <Reveal className="mt-12">
            <div className="ac-card p-8 text-center sm:p-10">
              <span
                className="ac-badge mx-auto flex h-14 w-14 items-center justify-center"
                style={{ "--a": "#1aa9d6" } as CSSProperties}
              >
                <Compass className="h-7 w-7" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold text-foreground">
                No route suggested yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-foreground/70">
                Nobody on {context.teamName} has put one up. You don&apos;t need
                one — pick any route you like and go.
              </p>
              <div className="mt-6 flex justify-center">
                <Link href="/paths" className="ac-btn text-sm">
                  Pick your own route <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* ── the lead's editor ────────────────────────────────────────── */}
        {context && isLead && (
          <Reveal className="mt-8">
            <PlanBuilder
              teamName={context.teamName}
              paths={planPathOptions()}
              departments={departments.map((d) => ({
                id: d.id,
                slug: d.slug,
                name: d.name,
                lessonCount: d.lessonCount,
              }))}
              current={
                plan
                  ? {
                      pathSlug: plan.path?.slug ?? null,
                      departmentIds: plan.departments.map((d) => d.id),
                      dueOn: plan.dueOn,
                    }
                  : null
              }
              minDate={todayIso()}
              maxDate={isoDayFromNow(MAX_DUE_DAYS)}
              maxDepartments={MAX_PLAN_DEPARTMENTS}
              hasPlan={Boolean(plan)}
            />
          </Reveal>
        )}
      </div>
    </div>
  );
}
