import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getDepartmentBySlug,
  getCompletedLessonIds,
  flattenLessons,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Progress } from "@/components/ui/progress";
import { PrintButton } from "@/components/certificate/print-button";
import { ShareButton } from "@/components/share-button";
import { TeamChallenge } from "@/components/team-challenge";
import { CertificateStamp, UnstampedBox } from "./_seal";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ department: string }>;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = await getDepartmentBySlug(department).catch(() => null);
  return {
    title: dept ? `${dept.name}: Certificate` : "Certificate",
    robots: { index: false, follow: false },
  };
}

/**
 * Everything on this page except the certificate itself is chrome, so print
 * takes the certificate alone and lifts it to the top of the sheet. Landscape,
 * because the artifact is wider than it is tall and a portrait page would set
 * the name at half the size it deserves.
 */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #certificate, #certificate * { visibility: visible !important; }
  #certificate {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    box-shadow: none !important;
  }
  @page { size: landscape; margin: 0.5in; }
}
`;

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
  const name = profile?.full_name || profile?.username || "FRC Learner";
  const moduleCount = dept.modules?.length ?? 0;

  /* ================================================================
     NOT SIGNED OFF YET.

     This is not a certificate with the good bits greyed out, it is a
     different page: the binder tab is still open, and the only figure worth
     printing large is the one that is missing. The unstamped box sits beside
     the count rather than under it, so the page never pretends to be the
     artifact it is not.
     ================================================================ */
  if (!earned) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const remaining = total - done;
    const next = flat.find((l) => !completed.has(l.id)) ?? flat[0];

    return (
      <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(2.2rem,5vw,3.6rem)]">
        <p className="nb-marker">dept / {dept.slug}</p>

        <h1 className="max-w-[17ch]">
          {remaining} {remaining === 1 ? "lesson" : "lessons"} left to sign this
          one off.
        </h1>

        <p className="nb-lede mt-[clamp(1rem,2vw,1.4rem)]">
          Finish every lesson in {dept.name} and this page turns into a
          certificate with your name on it, printable, for the pit wall or a
          college application.
        </p>

        <div className="nb-box nb-tilt-1 mt-[clamp(1.8rem,3.6vw,2.8rem)] grid max-w-[46rem] items-center gap-[clamp(1.3rem,3vw,2.4rem)] p-[clamp(1.3rem,2.8vw,2rem)] sm:grid-cols-[auto_minmax(0,1fr)]">
          <span className="nb-tape -top-3 left-[16%] rotate-[-3.6deg]" aria-hidden="true" />
          <span className="nb-tape -bottom-3 right-[12%] rotate-[2.8deg]" aria-hidden="true" />

          <div className="flex justify-center sm:justify-start">
            <UnstampedBox pct={pct} done={done} total={total} />
          </div>

          <div className="min-w-0">
            <p className="nb-slug">lessons finished</p>
            <p className="nb-count mt-1 text-[clamp(1.9rem,1.2rem+2.2vw,2.7rem)]">
              {done}
              <small>of {total}</small>
            </p>

            <div className="mt-3 flex items-center gap-3">
              <Progress
                value={pct}
                className="flex-1"
                label={`${done} of ${total} lessons finished`}
              />
              <span className="nb-slug shrink-0 text-ink">{pct}%</span>
            </div>

            <div className="mt-[clamp(1.2rem,2.4vw,1.7rem)] flex flex-wrap gap-2.5">
              {next && (
                <Link
                  href={`/guides/${dept.slug}/${next.moduleSlug}/${next.slug}`}
                  className="nb-btn"
                >
                  Read the next one
                </Link>
              )}
              <Link href={`/guides/${dept.slug}`} className="nb-btn-ghost">
                Back to {dept.name}
              </Link>
            </div>
          </div>
        </div>

        <p className="nb-pen mt-[clamp(1.1rem,2.2vw,1.6rem)] max-w-[26ch] rotate-[-1.2deg]">
          one certificate per department, not per lesson
        </p>
      </section>
    );
  }

  /* ================================================================
     SIGNED OFF. The printable artifact.
     ================================================================ */
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

  // Short human-readable credential id, stable per user and department.
  const credId = `LFRC-${dept.slug
    .replace(/[^a-z]/gi, "")
    .slice(0, 3)
    .toUpperCase()}-${String(total).padStart(2, "0")}${String(year).slice(-2)}`;

  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(1.6rem,4vw,2.8rem)]">
      <style>{PRINT_CSS}</style>

      {/* Chrome. Never printed: a button photographed onto paper is a button
          nobody can press. */}
      <div className="mb-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/guides/${dept.slug}`} className="nb-navlink">
          back to {dept.name}
        </Link>
        <div className="flex flex-wrap items-center gap-3.5">
          <ShareButton
            variant="outline"
            label="Share it"
            text={`I just earned the ${dept.name} certificate on LearnFRC, free FRC training for every seat on the team. Earn yours:`}
            // With a username this is a real referral, so tag the surface that
            // earned it. Without one there is nothing to attribute, and the
            // plain homepage URL must stay bare (no ref, no via).
            url={
              profile?.username
                ? `https://learnfrc.com/signup?ref=${profile.username}&via=certificate`
                : "https://learnfrc.com"
            }
          />
          <PrintButton />
        </div>
      </div>

      {/* ==================== THE CERTIFICATE ====================
          One hand-ruled card, and the stamp pressed into its corner rather
          than centred like a sticker. Everything inside is ink on card stock,
          because the whole point is that it survives a photocopier and a pit
          wall. */}
      <div
        id="certificate"
        className="nb-box relative mx-auto max-w-[56rem] px-[clamp(1.3rem,4vw,3.4rem)] py-[clamp(2rem,4.5vw,3.2rem)] text-center"
      >
        <span
          className="nb-tape -top-3 left-[14%] rotate-[-3.4deg] print:hidden"
          aria-hidden="true"
        />
        <span
          className="nb-tape -bottom-3 right-[18%] rotate-[2.2deg] print:hidden"
          aria-hidden="true"
        />

        {/* Centred on a phone, pressed into the top-right corner on anything
            wider, where a stamp actually goes. One element either way, so the
            label is never announced twice. */}
        <div className="mb-[clamp(1.4rem,3vw,2rem)] flex justify-center sm:absolute sm:right-[clamp(1.4rem,4vw,3.2rem)] sm:top-[clamp(1.6rem,4vw,2.8rem)] sm:mb-0 sm:block">
          <CertificateStamp deptSlug={`dept / ${dept.slug}`} year={year} />
        </div>

        <p className="nb-brand justify-center text-[1.3rem]">
          learn<b>FRC</b>
        </p>

        <p className="nb-slug mt-[clamp(1.6rem,3.4vw,2.4rem)] tracking-[0.18em]">
          certificate of completion
        </p>

        <p className="mt-[clamp(1.4rem,3vw,2.2rem)] text-graphite">
          This certifies that
        </p>

        <h1 className="mt-2 break-words">{name}</h1>

        {/* The department, set on its own rule. The stamp carries the slug,
            this carries the name, and neither has to shorten the other. */}
        <div className="mx-auto mt-[clamp(1.3rem,2.8vw,1.9rem)] flex max-w-[34rem] items-center gap-4">
          <span aria-hidden="true" className="h-0.5 flex-1 bg-ink" />
          <span className="text-[clamp(1rem,0.9rem+0.5vw,1.25rem)] font-extrabold tracking-[-0.02em]">
            {dept.name}
          </span>
          <span aria-hidden="true" className="h-0.5 flex-1 bg-ink" />
        </div>

        <p className="mx-auto mt-[clamp(1rem,2.2vw,1.5rem)] max-w-[52ch] text-graphite">
          has finished the whole {dept.name} department on LearnFRC:{" "}
          <b className="font-bold text-ink">
            {total} {total === 1 ? "lesson" : "lessons"}
          </b>{" "}
          across{" "}
          <b className="font-bold text-ink">
            {moduleCount} {moduleCount === 1 ? "module" : "modules"}
          </b>
          , every quiz passed.
        </p>

        {/* Who signed it, when, and for which team. Three cells on the binder's
            2px rule, mono because every value in the row is data. */}
        <div className="nb-rule mx-auto mt-[clamp(1.8rem,3.6vw,2.6rem)] grid max-w-[44rem] gap-x-8 gap-y-5 pt-[clamp(1.1rem,2.4vw,1.6rem)] text-left sm:grid-cols-3">
          <div>
            <p className="text-[0.95rem] font-bold">{dateStr}</p>
            <p className="nb-slug mt-1">date awarded</p>
          </div>
          {profile?.team_number ? (
            <div className="sm:text-center">
              <p className="text-[0.95rem] font-bold">
                Team {profile.team_number}
              </p>
              <p className="nb-slug mt-1">frc team</p>
            </div>
          ) : (
            <div aria-hidden="true" className="hidden sm:block" />
          )}
          <div className="sm:text-right">
            <p className="text-[0.95rem] font-bold">Jahaan Pardhanani</p>
            <p className="nb-slug mt-1">founder, learnfrc</p>
          </div>
        </div>

        <p className="nb-slug mt-[clamp(1.2rem,2.4vw,1.7rem)] tracking-[0.16em]">
          {credId}
        </p>
      </div>

      {profile?.username && (
        <div className="mx-auto mt-[clamp(1.4rem,3vw,2.2rem)] max-w-[56rem] print:hidden">
          <TeamChallenge username={profile.username} via="certificate" />
        </div>
      )}

      <p className="nb-slug mt-[clamp(1.2rem,2.4vw,1.8rem)] text-center print:hidden">
        print, then choose &quot;save as PDF&quot; to keep a copy
      </p>
    </section>
  );
}
