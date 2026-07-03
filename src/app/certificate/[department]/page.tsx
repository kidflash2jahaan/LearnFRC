import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Lock, ShieldCheck } from "lucide-react";
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
import { TeamChallenge } from "@/components/team-challenge";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  Rise,
  RiseGroup,
  RiseItem,
  Reveal,
  RevealGroup,
  RevealItem,
  Hover,
  Glow,
} from "@/components/motion/primitives";
import { CertificateSeal, ProgressSeal } from "./_seal";

export const dynamic = "force-dynamic";

const BRAND_GRADIENT: CSSProperties = {
  background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

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
  const moduleCount = dept.modules?.length ?? 0;

  const glow = (
    <Glow
      blobs={[
        { size: "560px", pos: { left: "-170px", top: "-200px" }, color: "#8bbcff", opacity: 0.5 },
        { size: "500px", pos: { right: "-160px", top: "60px" }, color: meta.color, opacity: 0.3, delay: 2 },
        { size: "480px", pos: { left: "22%", top: "620px" }, color: "#6ff0ea", opacity: 0.35, delay: 4 },
      ]}
    />
  );

  // ─────────────────────────────────────────────────────────────
  // LOCKED STATE — a credential in progress: the earned seal waits,
  // dimmed, behind a spring-drawn ring that shows the road left.
  // ─────────────────────────────────────────────────────────────
  if (!earned) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const remaining = total - done;
    const next = flat.find((l) => !completed.has(l.id)) ?? flat[0];

    return (
      <div className="relative overflow-x-clip">
        {glow}
        <div className="mx-auto max-w-2xl px-4 pb-12 pt-28 sm:px-6">
          <RiseGroup>
            <RiseItem className="mb-6 flex justify-center">
              <span className="ac-chip inline-flex items-center gap-2 text-primary">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                <span className="text-sm font-semibold">Certificate in progress</span>
              </span>
            </RiseItem>

            <RiseItem>
              <div className="ac-glass relative overflow-hidden p-8 text-center sm:p-12">
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{ backgroundImage: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
                />

                <ProgressSeal pct={pct} icon={meta.icon} color={meta.color} to={meta.to} ink={ink} />

                <p className="ac-eyebrow mt-7">
                  {pct >= 60 ? "Almost there" : pct > 0 ? "On your way" : "Your mission, mapped"}
                </p>
                <h1 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  <AnimatedCounter value={remaining} /> lesson{remaining === 1 ? "" : "s"}{" "}
                  <span style={BRAND_GRADIENT}>to go</span>
                </h1>
                <p className="mx-auto mt-3 max-w-md text-pretty text-base leading-relaxed text-foreground/70">
                  Finish every lesson in{" "}
                  <strong className="text-foreground">{dept.name}</strong> to unlock a
                  printable certificate you can hang in the pit.
                </p>

                <div className="mx-auto mt-7 flex max-w-sm items-center gap-3">
                  <Progress
                    value={pct}
                    barClassName="bg-transparent"
                    style={{ backgroundImage: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
                  />
                  <span className="whitespace-nowrap text-sm font-semibold text-foreground/80">
                    <AnimatedCounter value={done} />/<AnimatedCounter value={total} />
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {next && (
                    <Button asChild variant="brand" className="group text-sm">
                      <Link href={`/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`}>
                        Keep going{" "}
                        <ArrowRight
                          aria-hidden
                          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                        />
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="text-sm">
                    <Link href={`/guides/${dept.slug}`}>Back to {dept.name}</Link>
                  </Button>
                </div>
              </div>
            </RiseItem>
          </RiseGroup>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // EARNED STATE — the printable artifact.
  // ─────────────────────────────────────────────────────────────
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
  const year = completedAt.getFullYear();

  // Short human-readable credential id — stable per user+dept.
  const credId = `LFRC-${dept.slug
    .replace(/[^a-z]/gi, "")
    .slice(0, 3)
    .toUpperCase()}-${String(total).padStart(2, "0")}${String(year).slice(-2)}`;

  const deptUpper = dept.name.toUpperCase();
  const ringText = `LEARNFRC · CERTIFIED · ${deptUpper} · ${year} · `;

  return (
    <div className="relative overflow-x-clip">
      {glow}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #certificate, #certificate * { visibility: visible !important; }
          #certificate { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          @page { size: landscape; margin: 0.5in; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 pb-12 pt-28 sm:px-6">
        {/* Page chrome — hidden in print. */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            href={`/guides/${dept.slug}`}
            className="group inline-flex min-h-11 items-center gap-1.5 rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            Back to {dept.name}
          </Link>
          <div className="flex items-center gap-2">
            <ShareButton
              text={`I just earned the ${dept.name} certificate on LearnFRC! 🤖`}
              url="https://learnfrc.systemerr.com"
            />
            <PrintButton />
          </div>
        </div>

        {/* Achievement banner (screen only). */}
        <Rise className="mb-5 flex justify-center print:hidden">
          <span className="ac-chip inline-flex items-center gap-2 text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
            <BadgeCheck aria-hidden className="h-4 w-4" />
            <span className="text-sm font-semibold">Credential earned</span>
          </span>
        </Rise>

        {/* ============ THE CERTIFICATE (printable artifact) ============ */}
        <Rise delay={0.1}>
          <div
            id="certificate"
            className="relative overflow-hidden rounded-[28px] bg-card p-6 shadow-[0_28px_70px_-28px_rgba(37,96,230,0.4)] sm:p-10 print:rounded-none print:shadow-none"
            style={{ border: `1.5px solid color-mix(in srgb, ${meta.color} 42%, transparent)` }}
          >
            {/* engraved double-rule inner frame */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-3 rounded-[22px] sm:inset-4"
              style={{ border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[14px] rounded-[18px] sm:inset-[22px]"
              style={{ border: `1px solid color-mix(in srgb, ${meta.color} 18%, transparent)` }}
            />

            {/* soft colored wash + corner glows (screen only) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{ background: `radial-gradient(80% 60% at 50% 0%, ${meta.color}, transparent 62%)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full opacity-40 blur-2xl print:hidden"
              style={{ background: `radial-gradient(circle, ${meta.color}, transparent 70%)` }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full opacity-30 blur-2xl print:hidden"
              style={{ background: `radial-gradient(circle, ${meta.to}, transparent 70%)` }}
            />
            {/* top accent ribbon */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ backgroundImage: `linear-gradient(90deg, ${meta.color}, ${meta.to})` }}
            />

            <div className="relative px-2 py-4 text-center sm:px-8 sm:py-6">
              {/* Wordmark */}
              <div className="flex items-center justify-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b78f2] to-[#149fd0] text-white shadow-[0_8px_18px_rgba(37,96,230,0.28)] print:shadow-none">
                  <ShieldCheck aria-hidden className="h-5 w-5" />
                </span>
                <span className="font-display text-lg font-bold tracking-tight">
                  Learn
                  <span style={BRAND_GRADIENT}>FRC</span>
                </span>
              </div>

              <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground sm:text-xs">
                Certificate of Completion
              </p>

              {/* The signature seal */}
              <div className="mt-6">
                <CertificateSeal
                  icon={meta.icon}
                  color={meta.color}
                  to={meta.to}
                  ink={ink}
                  ringText={ringText}
                />
              </div>

              <p className="mt-6 text-sm text-muted-foreground">This certifies that</p>
              <h1 className="mt-1.5 text-balance break-words font-display text-3xl font-bold tracking-tight sm:text-5xl">
                {name}
              </h1>

              {/* engraved divider with dept name */}
              <div className="mx-auto mt-6 flex max-w-md items-center gap-3">
                <span
                  className="h-px flex-1"
                  style={{ background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${meta.color} 55%, transparent))` }}
                />
                <span className="font-display text-base font-bold" style={{ color: ink }}>
                  {dept.name}
                </span>
                <span
                  className="h-px flex-1"
                  style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${meta.color} 55%, transparent), transparent)` }}
                />
              </div>

              <p className="mx-auto mt-4 max-w-lg text-pretty text-base leading-relaxed text-foreground/70">
                has completed the full {dept.name} department on LearnFRC —{" "}
                <strong className="text-foreground">
                  <AnimatedCounter value={total} /> lessons
                </strong>{" "}
                across{" "}
                <strong className="text-foreground">
                  <AnimatedCounter value={moduleCount} /> modules
                </strong>
                , with gracious professionalism.
              </p>

              {/* Signature row */}
              <div className="mt-9 flex flex-col items-stretch gap-5 border-t border-border pt-6 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
                <div>
                  <div className="font-display text-sm font-semibold tabular-nums text-foreground">{dateStr}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">Date awarded</div>
                </div>
                {profile?.team_number ? (
                  <div className="sm:text-center">
                    <div className="font-display text-sm font-semibold tabular-nums text-foreground">
                      Team {profile.team_number}
                    </div>
                    <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">FRC Team</div>
                  </div>
                ) : null}
                <div className="sm:text-right">
                  <div className="font-display text-sm font-semibold text-foreground">Jahaan Pardhanani</div>
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">Founder, LearnFRC</div>
                </div>
              </div>

              {/* Credential id — the small mono data label */}
              <div className="mt-5 flex items-center justify-center gap-2">
                <span
                  className="ac-badge flex h-6 w-6 items-center justify-center rounded-md"
                  style={{ "--a": meta.color } as CSSProperties}
                >
                  <Icon name={meta.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground">
                  {credId}
                </span>
              </div>
            </div>
          </div>
        </Rise>

        {/* Stat strip — proof of the work behind the seal (screen only). */}
        <RevealGroup className="mt-6 grid grid-cols-3 gap-3 print:hidden sm:gap-4">
          {[
            { n: total, suffix: "", l: "lessons mastered" },
            { n: moduleCount, suffix: "", l: "modules completed" },
            { n: 100, suffix: "%", l: "department done" },
          ].map((s) => (
            <RevealItem key={s.l}>
              <Hover className="h-full" lift={-4}>
                <div className="ac-card h-full p-4 text-center">
                  <div className="font-display text-2xl font-extrabold leading-none text-foreground sm:text-3xl">
                    <AnimatedCounter value={s.n} suffix={s.suffix} />
                  </div>
                  <div className="mt-1.5 text-[13px] text-muted-foreground">{s.l}</div>
                </div>
              </Hover>
            </RevealItem>
          ))}
        </RevealGroup>

        {profile?.username && (
          <Reveal delay={0.12} className="mt-6 print:hidden">
            <TeamChallenge username={profile.username} />
          </Reveal>
        )}

        <Reveal delay={0.15}>
          <p className="mt-6 text-center text-sm text-muted-foreground print:hidden">
            Tip: use Print → &quot;Save as PDF&quot; to download or share your certificate.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
