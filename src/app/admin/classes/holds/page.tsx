import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadHoldsDesk, type HiddenHold, type HoldSummary } from "@/lib/classes/holds";
import { ClassReviewLocked } from "./_locked";
import { timeAgo, utcDay } from "./_format";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Evidence holds",
  robots: { index: false, follow: false },
};

/**
 * /admin/classes/holds: the evidence LearnFRC is keeping (classes-design.md
 * section 8.2), for the safety lead and super admins. Restricted holds
 * (grooming, sexual content, sextortion, a refusal) show in full to the
 * safety lead only; super admins see that one exists and who's handling it.
 *
 * Everything comes from loadHoldsDesk (src/lib/classes/holds.ts). No
 * `export const dynamic`: getSession() reads the auth cookie, so the route is
 * dynamic already (the rule /admin and /admin/reports follow).
 */

function who(h: HoldSummary): string {
  if (h.subjectHandle) return `@${h.subjectHandle}`;
  if (h.subjectUserId) return "a deleted account";
  return "the whole class";
}

function HiddenRow({ h }: { h: HiddenHold }) {
  return (
    <li className="nb-hair py-4 first:border-t-0 first:pt-0">
      <p className="nb-slug flex flex-wrap gap-x-4 gap-y-1">
        <span className="font-bold text-ink">restricted</span>
        <span>taken {timeAgo(h.createdAt)}</span>
        <span>kept until {utcDay(h.expiresAt)}</span>
      </p>
      <p className="mt-1.5 text-[1rem] leading-snug">
        {h.class ? (
          <>
            {h.class.title} <span className="text-graphite">/ class on {utcDay(h.class.startsAt)}</span>
          </>
        ) : (
          "An account hold"
        )}
      </p>
      <p className="nb-hint mt-1">{h.placeholder}</p>
    </li>
  );
}

function HoldRow({ h }: { h: HoldSummary }) {
  return (
    <li className="nb-hair py-4 first:border-t-0 first:pt-0">
      <p className="nb-slug flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="min-w-0 max-w-full truncate font-bold text-ink">{who(h)}</span>
        {h.restricted ? <span className="font-bold text-ink">restricted, only you can see it</span> : null}
        <span className="whitespace-nowrap">taken {timeAgo(h.createdAt)}</span>
        <span className="whitespace-nowrap">
          {h.expired ? "expired, deleted at the next daily sweep" : `kept until ${utcDay(h.expiresAt)}`}
        </span>
      </p>
      <h3 className="mt-1.5 text-[1.05rem] leading-tight">
        <Link href={`/admin/classes/holds/${h.id}`} className="nb-link">
          {h.reasonLabel}
        </Link>
      </h3>
      <p className="nb-slug mt-1">
        {h.class ? (
          <>
            {h.class.title} / {utcDay(h.class.startsAt)}
            {h.class.teacherHandle ? ` / taught by @${h.class.teacherHandle}` : ""}
          </>
        ) : (
          "no class in the 90 days before"
        )}
        {" / "}
        {h.recordingLabel.toLowerCase()}
        {h.ncmecReportId ? ` / CyberTipline report ${h.ncmecReportId}` : ""}
        {h.subjectUserId && !h.subjectAccountExists ? " / the account is gone" : ""}
        {h.releasedAt ? ` / released ${utcDay(h.releasedAt)}` : ""}
      </p>
    </li>
  );
}

export default async function HoldsPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/admin/classes/holds");

  const desk = await loadHoldsDesk(user);
  if (!desk.ok) {
    if (desk.code === "forbidden")
      return <ClassReviewLocked what="Evidence holds can include recordings of minors." />;
    return (
      <div className="nb-wrap py-16">
        <p className="nb-error">{desk.error}</p>
      </div>
    );
  }

  const restrictedCount = desk.holds.filter((h) => h.hidden || h.restricted).length;

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-slug">
          <Link href="/admin/classes" className="nb-link">
            classes
          </Link>{" "}
          / holds
        </p>
        <p className="nb-marker mt-3">sheet / evidence holds</p>
        <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.4rem)]">What LearnFRC is keeping, and why.</h1>
        <p className="nb-lede mt-5 max-w-[62ch]">
          A hold keeps a class&rsquo;s transcript, chat, connection details and recording, and the
          person&rsquo;s email and handle, when it may need to go to NCMEC, the police, a parent or a
          ban review. Each one lasts a year from when it was taken and is deleted after that unless
          someone extends it. The{" "}
          <Link href="/admin/classes/playbook" className="nb-link">
            playbook
          </Link>{" "}
          says what to do with one.
        </p>
        {desk.safetyLead ? (
          <p className="nb-hint mt-3 max-w-[62ch]">
            You&rsquo;re the safety lead, so restricted holds show in full here and nowhere else.
            Don&rsquo;t download, screenshot, copy or forward any of it.
          </p>
        ) : restrictedCount > 0 ? (
          <p className="nb-hint mt-3 max-w-[62ch]">
            Restricted holds (sexual content, grooming, sextortion, or a class the AI refused to
            review) open for the safety lead only, until he releases them.
          </p>
        ) : null}
        {!desk.r2Configured ? (
          <p className="nb-hint mt-3 max-w-[62ch]">
            The holds bucket isn&rsquo;t set up yet (no R2 keys), so recordings aren&rsquo;t being copied.
            Everything else is kept.
          </p>
        ) : null}
      </section>

      <section className="nb-wrap mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Holds</h2>
          <p className="nb-count shrink-0">
            {desk.holds.length}
            <small>kept</small>
          </p>
        </div>
        {desk.holds.length === 0 ? (
          <div className="nb-note max-w-[46rem]">
            <p className="nb-slug">holds / none</p>
            <p className="mt-1.5 text-[0.95rem] leading-snug">
              Nothing is being kept. A hold appears here when a class is reported, an urgent flag or
              a refusal comes in, a class is rejected for safety, or an account is banned.
            </p>
          </div>
        ) : (
          <ul className="max-w-[58rem]">
            {desk.holds.map((h) => (h.hidden ? <HiddenRow key={h.id} h={h} /> : <HoldRow key={h.id} h={h} />))}
          </ul>
        )}
      </section>
    </div>
  );
}
