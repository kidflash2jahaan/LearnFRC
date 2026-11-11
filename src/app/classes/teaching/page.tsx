import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadTeachingDesk,
  scheduleTopicOptions,
  type TeachingClass,
  type TeachingNext,
} from "@/lib/app/classes-teaching";
import { classesDevAllowSoon, classesVisible } from "@/lib/classes/config";
import { CLASS_LIMITS } from "@/lib/classes/constants";
import { TEACHER_CODE } from "@/lib/classes/notice";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";
import { usernameStepHref } from "@/lib/usernames";
import { LocalTime } from "@/components/classes/local-time";
import { lengthLabel } from "@/components/classes/class-card";
import { ScheduleForm } from "./_schedule-form";
import { CancelClassButton } from "./_cancel-class";

export const metadata: Metadata = {
  title: "Your classes",
  robots: { index: false, follow: false },
};

// Per teacher, and a 404 while classes are hidden: never prerendered, so the
// hidden 404 can't outlive the switch being turned on.
export const dynamic = "force-dynamic";

/**
 * The teacher's desk (classes-design.md section 11): schedule a class, see
 * who signed up for the upcoming ones and cancel them, the past ones with
 * their status and minutes, the total approved time, and the way to an
 * hours letter.
 *
 * Everything comes from loadTeachingDesk and scheduleClass in
 * src/lib/app/classes-teaching.ts. A first class is scheduled exactly like
 * any other: there's no host step and no smaller cap, and the copy never
 * promises a host.
 *
 * Signed out goes to sign-in and back. While classes are hidden it's a 404,
 * like every class route before launch.
 */

async function viewerOf() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<TeachingClass["status"], string> = {
  scheduled: "scheduled",
  live: "live now",
  ended: "ended, waiting on review",
  in_review: "in review",
  approved: "approved",
  rejected: "not approved",
  canceled: "canceled",
};

/** "3 hours 5 minutes" */
function hoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"}${m ? ` ${m} minute${m === 1 ? "" : "s"}` : ""}`;
}

function minutesCell(c: TeachingClass): string {
  if (c.status === "approved") return `${c.creditedMinutes ?? 0} min`;
  if (c.status === "rejected" || c.status === "canceled") return "0";
  if (c.computedMinutes !== null) return `${c.computedMinutes} min, not final`;
  return "not counted yet";
}

const NEXT_LINK: Record<Exclude<TeachingNext, null>, { href: string; label: string } | null> = {
  apply: { href: "/apply/teach", label: "Apply to teach" },
  ready: { href: "/classes/ready?next=%2Fclasses%2Fteaching", label: "Get set up" },
  username: { href: usernameStepHref("/classes/teaching"), label: "Choose your username" },
  contact: null,
};

export default async function TeachingPage() {
  if (!(await classesVisible())) notFound();
  const user = await viewerOf();
  if (!user) redirect("/login?next=/classes/teaching");

  const desk = await loadTeachingDesk(user);
  if (!desk.visible) notFound();
  const topics = desk.canSchedule.ok && desk.slotsLeft > 0 ? await scheduleTopicOptions() : [];
  const blocked = !desk.canSchedule.ok ? desk.canSchedule : null;
  const nextLink = blocked?.next ? NEXT_LINK[blocked.next] : null;

  return (
    <div className="nb-wrap max-w-[56rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <header>
        <p className="nb-marker">classes / teaching</p>
        <h1 className="text-[clamp(2.1rem,1.2rem+3.2vw,3.2rem)]">Your classes</h1>
        <p className="nb-lede mt-5">
          Schedule a class on any LearnFRC lesson or module, for up to {CLASS_LIMITS.maxCapacity} students.
          Every class is recorded on video and reviewed afterwards, the first one included.
        </p>
      </header>

      {/* ---- can't schedule yet ------------------------------------------ */}
      {blocked && (
        <div className="nb-box nb-tilt-2 mt-8 p-[clamp(1.1rem,2.6vw,1.8rem)]">
          <span className="nb-tape -top-3 left-[20%] rotate-[-2.9deg]" aria-hidden="true" />
          <p className="nb-slug">{desk.isTeacher ? "not right now" : "teachers only"}</p>
          <p className="mt-3 max-w-[58ch] text-[0.99rem] leading-relaxed">{blocked.reason}</p>
          {blocked.next === "contact" && (
            <p className="nb-hint mt-3">Questions? Write to {PUBLIC_CONTACT_EMAIL}.</p>
          )}
          {nextLink && (
            <Link href={nextLink.href} className="nb-btn mt-5">
              {nextLink.label}
            </Link>
          )}
        </div>
      )}

      {/* ---- schedule ---------------------------------------------------- */}
      {desk.canSchedule.ok && (
        <section
          aria-labelledby="schedule"
          className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="schedule" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
              Schedule a class
            </h2>
            <p className="nb-slug">
              {desk.slotsLeft} of {CLASS_LIMITS.maxUpcomingPerTeacher} upcoming slots open
            </p>
          </div>
          {!desk.configured && (
            <p className="nb-note mt-5 max-w-[64ch]" role="status">
              Classes open soon. The video rooms aren&rsquo;t switched on yet, so scheduling will say so
              when you send.
            </p>
          )}
          {desk.slotsLeft > 0 ? (
            <div className="mt-6">
              <ScheduleForm topics={topics} allowSoon={classesDevAllowSoon()} />
            </div>
          ) : (
            <p className="mt-5 max-w-[60ch] text-[0.99rem] leading-relaxed">
              You have {CLASS_LIMITS.maxUpcomingPerTeacher} upcoming classes, the most at once. Teach or cancel
              one to schedule another.
            </p>
          )}
        </section>
      )}

      {/* ---- upcoming ---------------------------------------------------- */}
      {(desk.isTeacher || desk.upcoming.length > 0) && (
        <section
          aria-labelledby="upcoming"
          className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <h2 id="upcoming" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
            Upcoming
          </h2>
          {desk.upcoming.length === 0 ? (
            <p className="mt-4 text-[0.99rem] text-graphite">Nothing scheduled yet.</p>
          ) : (
            <ul className="nb-list mt-5">
              {desk.upcoming.map((c) => (
                <li
                  key={c.id}
                  className="grid gap-x-[clamp(1rem,3vw,2rem)] gap-y-2 border-b border-dashed border-rule py-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]"
                >
                  <div className="flex flex-col gap-1">
                    <LocalTime iso={c.startsAt} className="font-bold" />
                    <span className="nb-slug">{lengthLabel(c.durationMinutes)}</span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link href={`/classes/${c.id}`} className="nb-link text-[1.04rem] font-bold">
                      {c.title}
                    </Link>
                    {c.topicTitle && <span className="text-[0.92rem] text-graphite">On {c.topicTitle}</span>}
                    <span className="nb-slug">
                      {c.enrolled} of {c.capacity} signed up
                      {c.status === "live" ? " / live now" : ""}
                    </span>
                  </div>
                  <div>{c.status === "scheduled" && <CancelClassButton classId={c.id} enrolled={c.enrolled} />}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---- past and totals --------------------------------------------- */}
      {(desk.isTeacher || desk.past.length > 0) && (
        <section
          aria-labelledby="past"
          className="mt-[clamp(2.4rem,5vw,3.6rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="past" className="text-[clamp(1.4rem,1.1rem+1.1vw,1.9rem)]">
              Past classes
            </h2>
            <p className="nb-slug">
              {hoursText(desk.approvedMinutes)} approved over {desk.approvedCount}{" "}
              {desk.approvedCount === 1 ? "class" : "classes"}
            </p>
          </div>
          {desk.past.length === 0 ? (
            <p className="mt-4 text-[0.99rem] text-graphite">None yet.</p>
          ) : (
            <div className="nb-scroll mt-5">
              <table className="nb-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Class</th>
                    <th scope="col">Status</th>
                    <th scope="col">Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {desk.past.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <LocalTime iso={c.startsAt} />
                      </td>
                      <td>{c.title}</td>
                      <td>{STATUS_LABEL[c.status]}</td>
                      <td>{minutesCell(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="nb-note mt-6 max-w-[64ch]">
            <p className="nb-slug">hours letters</p>
            <p className="mt-2 text-[0.97rem] leading-relaxed">
              A letter lists your approved teaching time, signed by LearnFRC&rsquo;s volunteer coordinator.
              Check your school&rsquo;s rules first. Some schools don&rsquo;t count online service, some need a
              registered nonprofit, and some want an adult present at every session. Misreporting hours means
              removal from teaching and withdrawn letters.
            </p>
            {desk.isTeacher && (
              <Link href="/classes/teaching/letter" className="nb-btn nb-btn-sm mt-4">
                Get an hours letter
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ---- the code ---------------------------------------------------- */}
      {desk.isTeacher && (
        <details className="mt-[clamp(2.4rem,5vw,3.4rem)] max-w-[64ch]">
          <summary className="nb-slug cursor-pointer font-bold text-ink">the teacher code you agreed to</summary>
          <div className="nb-prose mt-3">
            <ul>
              {TEACHER_CODE.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
