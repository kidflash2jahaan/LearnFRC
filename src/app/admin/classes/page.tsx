import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClassesDesk, type DeskClass } from "@/lib/app/admin-classes";
import { pacificTime } from "@/lib/classes/emails";
import { ConsentLookup, PauseForm, SafetyLeadForm, SettingsForm, ToolButton } from "./_controls";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Classes",
  robots: { index: false, follow: false },
};

// The End and pause buttons call RealtimeKit; give them room.
export const maxDuration = 60;

/**
 * /admin/classes: the live-classes desk (classes-design.md 7.6). Open to a
 * super admin and the safety lead (requireClassReviewer); everything comes
 * from loadClassesDesk in src/lib/app/admin-classes.ts.
 *
 * No `export const dynamic`: the session read makes the route dynamic, the
 * rule /admin and /admin/reports follow.
 */

const VERDICT_WORD: Record<string, string> = {
  looks_fine: "looks fine",
  needs_review: "needs a look",
  urgent: "urgent",
};

const STATUS_WORD: Record<string, string> = {
  scheduled: "scheduled",
  live: "live",
  ended: "ended, notes coming",
  in_review: "notes ready",
  approved: "approved",
  rejected: "rejected",
  canceled: "canceled",
};

function LockedDrawer() {
  return (
    <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
      <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">access / denied</p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">This drawer is locked.</h1>
        <p className="mt-4 text-graphite">
          Class reviews hold recordings and transcripts of students, so they&rsquo;re open to
          LearnFRC&rsquo;s super admins and the safety lead only. Nothing is wrong with your account.
        </p>
        <Link href="/dashboard" className="nb-btn mt-6">
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}

function ClassLine({ c, extra }: { c: DeskClass; extra?: React.ReactNode }) {
  return (
    <li className="nb-hair flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link href={`/admin/classes/${c.id}`} className="nb-link min-w-0 max-w-full truncate font-bold">
            {c.title}
          </Link>
          {c.verdict ? <span className="nb-tag">{VERDICT_WORD[c.verdict]}</span> : null}
          {c.restricted ? <span className="nb-tag">Dhiren has it</span> : null}
          {c.firstClass && c.status !== "scheduled" ? <span className="nb-tag">first class</span> : null}
        </p>
        <p className="nb-slug mt-1">
          {c.teacherUsername ? `@${c.teacherUsername}` : "a deleted account"} / {pacificTime(c.startsAt)} /{" "}
          {c.durationMinutes} min / {STATUS_WORD[c.status] ?? c.status}
          {c.status === "live" ? ` / ${c.presentNow} in the room` : ` / ${c.enrolled} enrolled`}
          {c.creditedMinutes != null
            ? ` / ${c.creditedMinutes} min credited`
            : c.creditedMinutesComputed != null
              ? ` / ${c.creditedMinutesComputed} min computed`
              : ""}
        </p>
      </div>
      {extra ? <div className="flex shrink-0 flex-wrap items-start gap-2">{extra}</div> : null}
    </li>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="nb-wrap mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">{title}</h2>
        <p className="nb-count shrink-0">{count}</p>
      </div>
      {count === 0 ? <p className="nb-hint max-w-[52ch]">{empty}</p> : <ul className="max-w-[62rem]">{children}</ul>}
    </section>
  );
}

export default async function ClassesDeskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/classes");

  const res = await loadClassesDesk(user);
  if (!res.ok) {
    if (res.code === "forbidden") return <LockedDrawer />;
    return (
      <div className="nb-wrap py-16">
        <p className="nb-error">{res.error}</p>
      </div>
    );
  }
  const d = res.desk;
  const sw = d.switches;

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-slug">
          {d.isSuperAdmin ? (
            <>
              <Link href="/admin" className="nb-link">
                admin
              </Link>{" "}
              /{" "}
            </>
          ) : null}
          classes
        </p>
        <p className="nb-marker mt-3">sheet / live classes</p>
        <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.4rem)]">Every class, and what it needs.</h1>
        <p className="nb-lede mt-5 max-w-[60ch]">
          Notes land here after each class. Urgent ones come first, then teachers&rsquo; first classes,
          then the oldest. Approving freezes the teacher&rsquo;s minutes.
        </p>
        <p className="nb-slug mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/admin/classes/teachers" className="nb-link">
            teachers
          </Link>
          <Link href="/admin/classes/holds" className="nb-link">
            holds
          </Link>
          <Link href="/admin/classes/letters" className="nb-link">
            letters
          </Link>
          <Link href="/admin/classes/playbook" className="nb-link">
            playbook
          </Link>
          {d.isSuperAdmin ? (
            <Link href="/admin/reports" className="nb-link">
              reports
            </Link>
          ) : null}
        </p>
      </section>

      {d.emailFailures.length ? (
        <section className="nb-wrap mt-8">
          <div className="nb-slab max-w-[62rem] p-[clamp(1rem,2.4vw,1.6rem)]" role="alert">
            <p className="nb-slug text-[rgba(245,246,242,0.85)]">email / failed</p>
            <p className="mt-2 text-[1.05rem] font-bold">
              {d.emailFailures.length === 1 ? "A class email" : `${d.emailFailures.length} class emails`} didn&rsquo;t go out in the last 7 days.
            </p>
            <ul className="mt-2 text-[0.93rem]">
              {d.emailFailures.slice(0, 5).map((f, i) => (
                <li key={`${f.at}-${i}`} className="mt-1">
                  {pacificTime(f.at)}: {f.what}
                  {f.classId ? (
                    <>
                      {" "}
                      (
                      <Link href={`/admin/classes/${f.classId}`} className="underline">
                        the class
                      </Link>
                      )
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.88rem] text-[rgba(245,246,242,0.85)]">
              Safety emails that failed need a person: open the class and read the notes here.
            </p>
          </div>
        </section>
      ) : null}

      {d.unknownMeetings.length ? (
        <section className="nb-wrap mt-6">
          <div className="nb-note max-w-[62rem]">
            <p className="nb-slug">realtimekit / unknown meetings</p>
            <p className="mt-1.5 text-[0.95rem]">
              Cloudflare sent events for {d.unknownMeetings.length === 1 ? "a meeting" : `${d.unknownMeetings.length} meetings`} LearnFRC
              didn&rsquo;t create this week. It could be a breakout room.
            </p>
            <ul className="nb-slug mt-2">
              {d.unknownMeetings.slice(0, 5).map((u) => (
                <li key={u.meetingId}>
                  {u.meetingId} / {u.event} / {pacificTime(u.at)}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="nb-wrap mt-10 grid max-w-[62rem] gap-6 md:grid-cols-2">
        <div className="nb-box p-[clamp(1rem,2.4vw,1.5rem)]">
          <p className="nb-slug border-b border-dashed border-rule pb-2">switches</p>
          <p className="mt-3 text-[0.98rem]">
            Classes are <b>{sw.visible ? "visible" : "hidden"}</b>.
          </p>
          <p className="nb-hint mt-1">
            CLASSES_VISIBLE is {sw.envVisible ? "on" : "off"} on this server; the database switch is{" "}
            {sw.dbVisible ? "on" : "off"}. Both must be on.
            {sw.devOverride ? " This dev server opens both with CLASSES_DEV_SWITCHES." : ""}
          </p>
          {d.isSuperAdmin ? (
            <div className="mt-3">
              <ToolButton
                tool="visible"
                extra={{ visible: sw.dbVisible ? "0" : "1" }}
                label={sw.dbVisible ? "Hide classes" : "Show classes"}
                pendingLabel="Saving"
                ghost={sw.dbVisible}
              />
            </div>
          ) : null}
          <p className="mt-5 text-[0.98rem]">
            Joins are <b>{sw.joinsPaused ? "paused" : "open"}</b>.
          </p>
          <div className="mt-2">
            <PauseForm paused={sw.joinsPaused} reason={sw.pausedReason} />
          </div>
          {!d.configured ? (
            <p className="nb-hint mt-4">
              RealtimeKit isn&rsquo;t set up on this server ({d.app} app), so classes say &ldquo;Classes open soon&rdquo; and no one can join.
            </p>
          ) : null}
        </div>

        <div className="nb-box p-[clamp(1rem,2.4vw,1.5rem)]">
          <p className="nb-slug border-b border-dashed border-rule pb-2">this month</p>
          <p className="mt-3 font-mono text-[clamp(1.5rem,1.1rem+1.3vw,2.05rem)] font-bold tabular-nums text-blue">
            {d.minutesThisMonth.toLocaleString("en-US")}
          </p>
          <p className="text-[0.95rem]">
            participant-minutes of {d.settings.monthlyMinuteCap.toLocaleString("en-US")} ({d.capPercent}%)
          </p>
          <div className="nb-meter mt-3" aria-hidden="true">
            <div className="nb-meter-bar" style={{ width: `${d.capPercent}%` }} />
          </div>
          <p className="nb-hint mt-3">
            {d.settings.maxLiveClasses} classes live at once at most. Students under {d.settings.minStudentAccountDays}{" "}
            days old don&rsquo;t count toward teacher minutes.
          </p>
          <p className="nb-hint mt-1">
            Safety lead: {d.settings.safetyLead ? `@${d.settings.safetyLead.username ?? "a deleted account"}` : "not set"}.
          </p>
        </div>
      </section>

      <Section title="Live now" count={d.live.length} empty="No class is live.">
        {d.live.map((c) => (
          <ClassLine
            key={c.id}
            c={c}
            extra={
              <>
                <Link href={`/classes/${c.id}/room`} className="nb-btn nb-btn-sm">
                  Join as staff
                </Link>
                <ToolButton
                  tool="end"
                  classId={c.id}
                  label="End"
                  pendingLabel="Ending"
                  armedText={`One more click ends "${c.title}" for everyone in it.`}
                />
              </>
            }
          />
        ))}
      </Section>

      <Section title="Waiting on review" count={d.waiting.length} empty="Nothing is waiting. Notes arrive about half an hour after a class ends.">
        {d.waiting.map((c) => (
          <ClassLine key={c.id} c={c} />
        ))}
      </Section>

      <Section title="Upcoming" count={d.upcoming.length} empty="No classes are scheduled.">
        {d.upcoming.map((c) => (
          <ClassLine key={c.id} c={c} />
        ))}
      </Section>

      <Section title="Recently decided" count={d.decided.length} empty="Nothing decided in the last 30 days.">
        {d.decided.map((c) => (
          <ClassLine key={c.id} c={c} />
        ))}
      </Section>

      <section className="nb-wrap mt-14 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
        <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Parent OKs</h2>
        <p className="nb-sub mt-2 max-w-[60ch]">
          Look up a student&rsquo;s parent requests. Revoking one blocks their next join at once.
        </p>
        <div className="mt-5">
          <ConsentLookup />
        </div>
      </section>

      {d.isSuperAdmin ? (
        <section className="nb-wrap mt-14 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Settings</h2>
          <div className="mt-5 grid max-w-[62rem] gap-10 md:grid-cols-2">
            <SettingsForm
              monthlyMinuteCap={d.settings.monthlyMinuteCap}
              maxLiveClasses={d.settings.maxLiveClasses}
              minStudentAccountDays={d.settings.minStudentAccountDays}
            />
            <SafetyLeadForm current={d.settings.safetyLead?.username ?? null} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
