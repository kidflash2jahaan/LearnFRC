import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, Lock, Sparkles } from "lucide-react";
import {
  getDepartmentBySlug,
  getCompletedLessonIds,
  flattenLessons,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deptMeta, inkFor } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PrintButton } from "@/components/certificate/print-button";
import { ShareButton } from "@/components/share-button";
import { AnimatedCounter } from "@/components/animated-counter";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  return { title: dept ? `${dept.name} — Certificate` : "Certificate" };
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department);
  if (!dept) notFound();

  const { user, profile } = await getSession();
  if (!user) redirect(`/login?next=/certificate/${department}`);

  const flat = flattenLessons(dept);
  const total = flat.length;
  const completed = await getCompletedLessonIds(user.id);
  const done = flat.filter((l) => completed.has(l.id)).length;
  const earned = total > 0 && done === total;
  const meta = deptMeta(dept.slug);
  const ink = inkFor(meta.color);
  const name = profile?.full_name || profile?.username || "FRC Learner";

  // Soft ambient glows shared by both states.
  const ambientGlows = (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(37,96,230,0.16), transparent 70%)" }}
      />
      <div
        className="absolute top-40 -right-16 h-64 w-64 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${meta.color} 22%, transparent), transparent 70%)` }}
      />
      <div
        className="absolute bottom-0 -left-16 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(26,169,214,0.14), transparent 70%)" }}
      />
    </div>
  );

  // Not finished yet → friendly locked state in the clay-glass language.
  if (!earned) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const next = flat.find((l) => !completed.has(l.id)) ?? flat[0];
    return (
      <div className="relative mx-auto max-w-2xl px-4 pt-28 pb-20 sm:px-6">
        {ambientGlows}
        <div className="aq-glass aq-sheen aq-rise aq-rise-1 relative overflow-hidden rounded-3xl p-8 text-center sm:p-12">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundImage: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
          />
          <span
            className="aq-badge aq-badge-bob aq-rise aq-rise-1 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ "--a": meta.color } as CSSProperties}
          >
            <Lock aria-hidden className="h-7 w-7" />
          </span>

          <div className="aq-rise aq-rise-2 mt-6">
            <span className="aq-eyebrow">Almost there</span>
          </div>
          <h1 className="aq-rise aq-rise-3 mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Certificate{" "}
            <span
              className="aq-grad-anim"
              style={{
                background: "linear-gradient(120deg,#2560e6,#0e7fa3)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              locked
            </span>
          </h1>
          <p className="aq-rise aq-rise-4 mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
            Finish all {total} lessons in{" "}
            <strong className="text-foreground">{dept.name}</strong> to earn your
            certificate. You&apos;re {pct}% of the way through build season.
          </p>

          {/* Animated progress ring — draws itself in on view. */}
          <div className="aq-reveal mx-auto mt-8 flex items-center justify-center" style={{ animationDelay: "0.05s" } as CSSProperties}>
            <div className="relative h-32 w-32">
              <svg aria-hidden viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-border"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={ink}
                  strokeWidth="10"
                  strokeLinecap="round"
                  className="aq-ring-anim"
                  style={{
                    strokeDasharray: 2 * Math.PI * 52,
                    strokeDashoffset: 2 * Math.PI * 52 * (1 - pct / 100),
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold text-primary">
                  <AnimatedCounter value={pct} suffix="%" />
                </span>
                <span className="text-xs text-muted-foreground">complete</span>
              </div>
            </div>
          </div>

          {/* Lesson tally with count-ups. */}
          <div className="aq-reveal mx-auto mt-6 flex max-w-sm items-center justify-center gap-2 text-sm font-semibold text-foreground/80" style={{ animationDelay: "0.12s" } as CSSProperties}>
            <AnimatedCounter value={done} /> of <AnimatedCounter value={total} /> lessons done
          </div>

          <div className="mx-auto mt-4 flex max-w-sm items-center gap-3">
            <Progress
              value={pct}
              className="aq-bar-anim"
              style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
            />
            <span className="font-semibold text-primary">
              <AnimatedCounter value={pct} suffix="%" />
            </span>
          </div>

          <div className="aq-reveal mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.2s" } as CSSProperties}>
            {next && (
              <Button asChild variant="brand" className="aq-cta">
                <Link href={`/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`}>
                  Keep going <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="aq-ghost">
              <Link href={`/guides/${dept.slug}`}>Back to {dept.name}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Completion date = most recent completed lesson in this department.
  const supabase = await createClient();
  const { data: lp } = await supabase
    .from("lesson_progress")
    .select("completed_at")
    .eq("user_id", user.id)
    .in(
      "lesson_id",
      flat.map((l) => l.id)
    )
    .order("completed_at", { ascending: false })
    .limit(1);
  const completedAt = lp?.[0]?.completed_at
    ? new Date(lp[0].completed_at)
    : new Date();
  const dateStr = completedAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative mx-auto max-w-4xl px-4 pt-24 pb-20 sm:px-6">
      {ambientGlows}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #certificate, #certificate * { visibility: visible !important; }
          #certificate { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          @page { size: landscape; margin: 0.5in; }
        }
      `}</style>

      {/* Page chrome — clean glass, hidden in print. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/guides/${dept.slug}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to {dept.name}
        </Link>
        <div className="flex items-center gap-2">
          <ShareButton
            text={`I just earned the ${dept.name} certificate on LearnFRC! 🤖`}
            url="https://learnfrc.systemerr.com"
          />
          <PrintButton />
        </div>
      </div>

      {/* Achievement banner (screen only — kept out of print). */}
      <div className="aq-rise aq-rise-1 mb-6 flex justify-center print:hidden">
        <span className="aq-chip aq-float gap-2 text-primary">
          <span className="aq-pulse h-2 w-2 rounded-full bg-primary" aria-hidden />
          <Sparkles aria-hidden className="aq-badge-bob h-4 w-4" />
          <span className="font-semibold">Achievement unlocked</span>
        </span>
      </div>

      {/* Certificate — the printable artifact, kept distinctive. */}
      <div className="aq-reveal aq-rise aq-rise-2">
        <div
          id="certificate"
          className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-[0_24px_60px_-24px_rgba(37,96,230,0.35)] sm:p-12 print:shadow-none"
          style={{ borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)` }}
        >
          {/* soft colored wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{ background: `radial-gradient(70% 90% at 50% 0%, ${meta.color}, transparent 65%)` }}
          />
          {/* top accent ribbon */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-2"
            style={{ backgroundImage: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
          />
          {/* soft glossy corner arcs (screen only) */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full opacity-40 blur-2xl print:hidden"
            style={{ background: `radial-gradient(circle, ${meta.color}, transparent 70%)` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full opacity-30 blur-2xl print:hidden"
            style={{ background: `radial-gradient(circle, ${meta.to}, transparent 70%)` }}
          />

          <div className="relative text-center">
            <div className="aq-rise aq-rise-1 flex items-center justify-center gap-2.5 print:animate-none">
              <span className="aq-badge-bob flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b78f2] to-[#149fd0] text-white shadow-[0_8px_18px_rgba(37,96,230,0.28)] print:shadow-none print:animate-none">
                <Award aria-hidden className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                Learn
                <span
                  className="aq-grad-anim print:animate-none"
                  style={{
                    background: "linear-gradient(120deg,#2560e6,#0e7fa3)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  FRC
                </span>
              </span>
            </div>

            <p className="aq-rise aq-rise-2 mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground print:animate-none">
              Certificate of Completion
            </p>
            <p className="aq-rise aq-rise-3 mt-6 text-sm text-muted-foreground print:animate-none">This certifies that</p>
            <h1 className="aq-rise aq-rise-3 mt-2 text-balance break-words font-display text-3xl font-bold tracking-tight sm:text-5xl print:animate-none">
              {name}
            </h1>
            <p className="aq-rise aq-rise-4 mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-foreground/70 print:animate-none">
              has successfully completed all{" "}
              <strong className="text-foreground">
                <AnimatedCounter value={total} /> lessons
              </strong>{" "}
              of the
            </p>

            <div
              className="aq-tile aq-card-hover aq-rise aq-rise-5 mt-5 inline-flex items-center gap-3 rounded-2xl px-5 py-3 print:animate-none"
              style={{ "--a": meta.color } as CSSProperties}
            >
              <span
                className="aq-badge aq-badge-bob flex h-10 w-10 items-center justify-center rounded-xl print:animate-none"
                style={{ "--a": meta.color } as CSSProperties}
              >
                <Icon name={meta.icon} className="h-5 w-5" />
              </span>
              <span className="font-display text-xl font-bold text-foreground">{dept.name}</span>
            </div>
            <p className="mt-5 text-pretty text-base leading-relaxed text-foreground/70">
              department on LearnFRC.
            </p>

            <div className="aq-rise aq-rise-5 mt-10 flex flex-col items-center justify-between gap-6 border-t border-border pt-6 sm:flex-row print:animate-none">
              <div className="text-center sm:text-left">
                <div className="text-sm font-semibold tabular-nums text-foreground">{dateStr}</div>
                <div className="text-xs text-muted-foreground">Date completed</div>
              </div>
              {profile?.team_number ? (
                <div className="text-center">
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    Team {profile.team_number}
                  </div>
                  <div className="text-xs text-muted-foreground">FRC Team</div>
                </div>
              ) : null}
              <div className="text-center sm:text-right">
                <div className="font-display text-sm font-semibold text-foreground">
                  Jahaan Pardhanani
                </div>
                <div className="text-xs text-muted-foreground">LearnFRC</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="aq-reveal mt-6 text-center text-sm text-muted-foreground print:hidden" style={{ animationDelay: "0.15s" } as CSSProperties}>
        Tip: use Print → &quot;Save as PDF&quot; to download or share your certificate.
      </p>
    </div>
  );
}
