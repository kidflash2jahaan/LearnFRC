import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, Lock } from "lucide-react";
import {
  getDepartmentBySlug,
  getCompletedLessonIds,
  flattenLessons,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deptMeta } from "@/lib/departments";
import { Icon } from "@/lib/icon-map";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PrintButton } from "@/components/certificate/print-button";
import { ShareButton } from "@/components/share-button";
import { Reveal } from "@/components/motion/reveal";
import { StatusPill } from "@/components/motion/terminal";

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
  const name = profile?.full_name || profile?.username || "FRC Learner";

  // Not finished yet → friendly locked state.
  if (!earned) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const next = flat.find((l) => !completed.has(l.id)) ?? flat[0];
    return (
      <div className="mx-auto max-w-2xl px-4 pt-28 pb-20 text-center sm:px-6">
        <Reveal>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
            <Lock className="h-7 w-7" />
          </span>
          <div className="mt-5 flex justify-center">
            <StatusPill tone="muted" pulse={false}>
              ● locked
            </StatusPill>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
            Certificate locked
          </h1>
          <p className="mt-2 text-muted-foreground">
            Complete all {total} lessons in <strong className="text-foreground">{dept.name}</strong> to unlock
            your certificate. You&apos;re {pct}% there.
          </p>
          <div className="mx-auto mt-5 flex max-w-sm items-center gap-3">
            <Progress
              value={pct}
              style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
            />
            <span className="font-mono text-sm text-primary">{pct}%</span>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {next && (
              <Button asChild variant="brand">
                <Link href={`/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`}>
                  Keep going <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/guides/${dept.slug}`}>Back to {dept.name}</Link>
            </Button>
          </div>
        </Reveal>
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
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-20 sm:px-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #certificate, #certificate * { visibility: visible !important; }
          #certificate { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          @page { size: landscape; margin: 0.5in; }
        }
      `}</style>

      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/guides/${dept.slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> cd ../{dept.slug}
        </Link>
        <div className="flex items-center gap-2">
          <ShareButton
            text={`I just earned the ${dept.name} certificate on LearnFRC! 🤖`}
            url="https://learnfrc.systemerr.com"
          />
          <PrintButton />
        </div>
      </div>

      {/* Achievement banner (screen only — kept out of print) */}
      <Reveal className="print:hidden">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3 text-center">
          <StatusPill tone="primary">● achievement unlocked</StatusPill>
          <span className="font-mono text-xs text-muted-foreground">
            ~/learnfrc $ unlock --dept={dept.slug}
            <span className="caret" aria-hidden />
          </span>
        </div>
      </Reveal>

      {/* Certificate */}
      <Reveal y={28}>
        <div
          id="certificate"
          className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-[0_0_40px_-12px_var(--primary)] sm:p-12 print:shadow-none"
          style={{ borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)` }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ background: `radial-gradient(70% 90% at 50% 0%, ${meta.color}, transparent 65%)` }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-2"
            style={{ backgroundImage: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
          />

          {/* neon code-bracket corner accents (screen only) */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-5 select-none font-mono text-5xl leading-none text-primary/15 print:hidden sm:left-5"
          >
            {"{"}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-5 right-3 select-none font-mono text-5xl leading-none text-primary/15 print:hidden sm:right-5"
          >
            {"}"}
          </span>

          <div className="relative text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-[var(--glow-primary)] print:shadow-none">
                <Award className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                Learn<span className="text-gradient">FRC</span>
              </span>
            </div>

            <p className="mt-8 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Certificate of Completion
            </p>
            <p className="mt-5 text-sm text-muted-foreground">This certifies that</p>
            <h1 className="mt-2 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {name}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-foreground/80">
              has successfully completed all <strong className="text-foreground">{total} lessons</strong> of the
            </p>

            <div
              className="mt-4 inline-flex items-center gap-3 rounded-2xl border px-5 py-3"
              style={{ borderColor: `color-mix(in srgb, ${meta.color} 35%, var(--border))` }}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
                style={{ backgroundImage: `linear-gradient(135deg, ${meta.color}, ${meta.to})` }}
              >
                <Icon name={meta.icon} className="h-5 w-5" />
              </span>
              <span className="font-display text-xl font-bold">{dept.name}</span>
            </div>
            <p className="mt-4 text-pretty text-foreground/80">
              department on LearnFRC.
            </p>

            <div className="mt-10 flex flex-col items-center justify-between gap-6 border-t border-border pt-6 sm:flex-row">
              <div className="text-center sm:text-left">
                <div className="font-mono text-sm font-semibold">{dateStr}</div>
                <div className="text-xs text-muted-foreground">Date completed</div>
              </div>
              {profile?.team_number ? (
                <div className="text-center">
                  <div className="font-mono text-sm font-semibold">
                    Team {profile.team_number}
                  </div>
                  <div className="text-xs text-muted-foreground">FRC Team</div>
                </div>
              ) : null}
              <div className="text-center sm:text-right">
                <div className="font-display text-sm font-semibold">
                  Jahaan Pardhanani
                </div>
                <div className="text-xs text-muted-foreground">
                  LearnFRC · Sage Hill Robotics 5835
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-6 text-center font-mono text-xs text-muted-foreground print:hidden">
        // tip: use Print → &quot;Save as PDF&quot; to download or share your certificate.
      </p>
    </div>
  );
}
