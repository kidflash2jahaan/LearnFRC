import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CLASS_SENTENCES,
  classEligibility,
  classRoster,
  eligibilitySentence,
  getClassDetail,
} from "@/lib/app/classes";
import { CLASS_LIMITS, TEACHER_LABEL, earliestJoinFor } from "@/lib/classes/constants";
import { CLASS_NOTICE } from "@/lib/classes/notice";
import type { ClassDetail, ClassRole, Eligibility } from "@/lib/classes/types";
import { LocalTime } from "@/components/classes/local-time";
import { lengthLabel, seatsLabel } from "@/components/classes/class-card";
import { ClassReportPanel } from "@/components/classes/class-report-panel";
import { EnrollButton, LeaveButton } from "./_enroll";

/**
 * One class (classes-design.md section 11).
 *
 * Title, topic, time, length, seats, what to expect (the recording notice
 * everyone accepts before joining), and ONE next step that follows
 * classEligibility: sign in, pick a username, the one-time setup, sign up,
 * leave, or join when the room is open. The teacher's @handle shows only to
 * a signed-in viewer; signed out the page says "Taught by an FRC student"
 * and its HTML carries no handle.
 *
 * For 30 days after a class, the people who were in it can report someone
 * from it here (the shared class report panel, by username). Any signed-in
 * reader can report the class itself, which reports its teacher.
 *
 * Hidden classes, the other RealtimeKit app's classes and bad ids are all a
 * 404, the same as every other class route before launch. Not indexed: a
 * class is here for a few weeks and its title is a student's own words.
 */

type Params = { params: Promise<{ id: string }> };

// A class report from this page takes an evidence hold, whose recording copy
// runs after the response (src/lib/classes/holds.ts).
export const maxDuration = 300;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const c = await getClassDetail(id, null);
  return {
    title: c ? c.title : "Live class",
    description: c
      ? `A free live class on LearnFRC${c.topic ? ` about ${c.topic.title}` : ""}, taught by an FRC student.`
      : undefined,
    robots: { index: false, follow: true },
    alternates: c ? { canonical: `/classes/${c.id}` } : undefined,
  };
}

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

/** Where the class is in time, worked out once per request. */
function timeline(c: ClassDetail, role: ClassRole | null) {
  const now = Date.now();
  const starts = Date.parse(c.startsAt);
  const hardEnd = Date.parse(c.hardEndAt);
  const roomRole = role === "teacher" || role === "staff" ? role : "student";
  const opensAt = earliestJoinFor(new Date(starts), roomRole).getTime();
  const open = c.classStatus === "scheduled" || c.classStatus === "live";
  return {
    over: !open || now >= hardEnd,
    canceled: c.classStatus === "canceled",
    roomOpen: open && now >= opensAt && now < hardEnd,
    enrollClosed: !open || now > starts + CLASS_LIMITS.enrollCloseAfterStartMinutes * 60_000,
    earlyMinutes: roomRole === "student" ? CLASS_LIMITS.studentEarlyJoinMinutes : CLASS_LIMITS.teacherEarlyJoinMinutes,
  };
}

/** The link for a state that has one more step before signing up. */
function stepFor(state: Eligibility, classId: string): { href: string; label: string } | null {
  const back = encodeURIComponent(`/classes/${classId}`);
  switch (state) {
    case "signed_out":
      return { href: `/login?next=${back}`, label: "Sign in to sign up" };
    case "needs_handle":
      return { href: "/settings", label: "Pick a username" };
    case "needs_age":
    case "needs_parent":
      return { href: `/classes/ready?next=${back}`, label: "Get set up" };
    default:
      return null;
  }
}

export default async function ClassPage({ params }: Params) {
  const { id } = await params;
  const viewer = await viewerOf();
  const c = await getClassDetail(id, viewer);
  if (!c) notFound();

  const state: Eligibility = viewer ? await classEligibility(viewer) : "signed_out";
  const t = timeline(c, c.viewerRole);
  const isTeacher = c.viewerRole === "teacher";
  const isStaff = c.viewerRole === "staff";
  const enrolled = c.enrollment === "enrolled";
  const blocked = c.blockedEitherWay && !isTeacher;
  const showHandle = !!viewer && !!c.teacher && !blocked;

  // Report: the people who were in it see the whole roster for 30 days; any
  // other signed-in reader can report the class itself (its teacher).
  const canReport = !!viewer && !isTeacher && (c.canReportFromClass || !t.over);
  const roster = canReport ? await classRoster(c.id) : [];
  const reportRoster = c.canReportFromClass ? roster : roster.filter((r) => r.role === "teacher");

  return (
    <div className="nb-wrap max-w-[52rem] py-[clamp(2.2rem,5vw,3.8rem)]">
      <p className="nb-slug">
        <Link href="/classes" className="nb-link">
          Live classes
        </Link>{" "}
        / {c.status === "live" && !t.over ? "live now" : "class"}
      </p>

      <header className="mt-3">
        <h1 className="text-[clamp(2rem,1.2rem+3vw,3rem)]">{c.title}</h1>
        {c.topic && (
          <p className="nb-lede mt-4">
            On{" "}
            <Link href={new URL(c.topic.url).pathname} className="nb-link">
              {c.topic.title}
            </Link>
            {c.topic.kind === "module" ? " (the whole module)" : ""}
          </p>
        )}
      </header>

      {/* ---- the facts, as a record strip -------------------------------- */}
      <dl className="mt-6 border-t-2 border-ink">
        {[
          {
            k: "when",
            v: (
              <>
                <LocalTime iso={c.startsAt} />
                <span className="text-graphite">, times in your time zone</span>
              </>
            ),
          },
          { k: "length", v: lengthLabel(c.durationMinutes) },
          { k: "seats", v: seatsLabel(c.seats) },
          {
            k: "teacher",
            v: showHandle && c.teacher ? `@${c.teacher.username}` : TEACHER_LABEL,
          },
        ].map((row) => (
          <div
            key={row.k}
            className="grid gap-x-[clamp(1rem,3vw,2.4rem)] gap-y-1 border-b border-dashed border-rule py-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]"
          >
            <dt className="nb-slug font-bold text-ink">{row.k}</dt>
            <dd className="text-[0.99rem]">{row.v}</dd>
          </div>
        ))}
      </dl>

      {c.description && (
        <p className="mt-6 max-w-[64ch] text-[0.99rem] leading-relaxed whitespace-pre-line">{c.description}</p>
      )}

      {/* ---- the one next step ------------------------------------------- */}
      <section aria-label="Your place in this class" className="nb-box nb-tilt-1 mt-8 p-[clamp(1.1rem,2.6vw,1.8rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-2.6deg]" aria-hidden="true" />
        <NextStep c={c} state={state} t={t} isTeacher={isTeacher} isStaff={isStaff} enrolled={enrolled} blocked={blocked} />
      </section>

      {/* ---- what to expect ---------------------------------------------- */}
      <section
        aria-labelledby="expect"
        className="mt-[clamp(2rem,4vw,3rem)] border-t-2 border-ink pt-[clamp(1.4rem,3vw,2.2rem)]"
      >
        <h2 id="expect" className="text-[clamp(1.3rem,1.1rem+0.9vw,1.7rem)]">
          What to expect
        </h2>
        <p className="nb-hint mt-2">Everyone reads and accepts this before joining, every time.</p>
        <div className="mt-4 flex max-w-[64ch] flex-col gap-4 text-[0.99rem] leading-relaxed text-graphite">
          {CLASS_NOTICE.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
      </section>

      {canReport && reportRoster.length > 0 && (
        <section aria-label="Report" className="mt-8">
          <ClassReportPanel
            classId={c.id}
            roster={reportRoster}
            viewerId={viewer?.id ?? null}
            surface="class_page"
            liveNow={c.classStatus === "live"}
            label={c.canReportFromClass ? "Report someone from this class" : "Report this class"}
          />
        </section>
      )}
    </div>
  );
}

function NextStep({
  c,
  state,
  t,
  isTeacher,
  isStaff,
  enrolled,
  blocked,
}: {
  c: ClassDetail;
  state: Eligibility;
  t: ReturnType<typeof timeline>;
  isTeacher: boolean;
  isStaff: boolean;
  enrolled: boolean;
  blocked: boolean;
}) {
  const roomHref = `/classes/${c.id}/room`;

  if (t.canceled) {
    return (
      <>
        <p className="nb-slug">canceled</p>
        <p className="mt-3 text-[0.99rem]">This class was canceled.</p>
        <Link href="/classes" className="nb-btn mt-5">
          See other classes
        </Link>
      </>
    );
  }
  if (t.over) {
    return (
      <>
        <p className="nb-slug">over</p>
        <p className="mt-3 text-[0.99rem]">This class has ended.</p>
        <Link href="/classes" className="nb-btn mt-5">
          See upcoming classes
        </Link>
      </>
    );
  }

  if (isTeacher || isStaff) {
    return (
      <>
        <p className="nb-slug">{isTeacher ? "you're teaching this one" : "you're staff in this class"}</p>
        {t.roomOpen ? (
          <Link href={roomHref} className="nb-btn mt-4">
            Open the room
          </Link>
        ) : (
          <p className="mt-3 text-[0.99rem]">
            The room opens {t.earlyMinutes} minutes before the start.
          </p>
        )}
        {isTeacher && (
          <p className="nb-hint mt-4">
            <Link href="/classes/teaching" className="nb-link">
              Your teaching page
            </Link>{" "}
            has who signed up and the cancel button.
          </p>
        )}
      </>
    );
  }

  if (blocked) {
    return (
      <>
        <p className="nb-slug">not for you</p>
        <p className="mt-3 text-[0.99rem]">{CLASS_SENTENCES.blocked}</p>
      </>
    );
  }
  if (c.enrollment === "removed") {
    return (
      <>
        <p className="nb-slug">removed</p>
        <p className="mt-3 text-[0.99rem]">{CLASS_SENTENCES.removed}</p>
      </>
    );
  }

  if (enrolled) {
    const ready = state === "ready";
    return (
      <>
        <p className="nb-slug">you&rsquo;re in</p>
        {t.roomOpen && ready ? (
          <Link href={roomHref} className="nb-btn mt-4">
            Join the class
          </Link>
        ) : (
          <p className="mt-3 text-[0.99rem]">
            {ready
              ? `The room opens ${t.earlyMinutes} minutes before the start. Come back here to join.`
              : eligibilitySentence(state)}
          </p>
        )}
        <p className="nb-hint mt-3 max-w-[56ch]">
          You&rsquo;ll show as your LearnFRC username to everyone in the class. Your camera stays off.
        </p>
        <div className="mt-5">
          <LeaveButton classId={c.id} />
        </div>
      </>
    );
  }

  if (t.enrollClosed) {
    return (
      <>
        <p className="nb-slug">closed</p>
        <p className="mt-3 text-[0.99rem]">{CLASS_SENTENCES.closed}</p>
      </>
    );
  }
  if (c.seats.left <= 0) {
    return (
      <>
        <p className="nb-slug">full</p>
        <p className="mt-3 text-[0.99rem]">{CLASS_SENTENCES.full}</p>
        <Link href="/classes" className="nb-btn-ghost nb-btn-sm mt-5">
          See other classes
        </Link>
      </>
    );
  }

  if (state === "ready" || state === "waiting_parent") {
    return (
      <>
        <p className="nb-slug">free / {seatsLabel(c.seats).toLowerCase()}</p>
        <div className="mt-4">
          <EnrollButton classId={c.id} waitingParent={state === "waiting_parent"} />
        </div>
      </>
    );
  }

  const step = stepFor(state, c.id);
  return (
    <>
      <p className="nb-slug">{state === "signed_out" ? "free, with an account" : "one more step"}</p>
      <p className="mt-3 max-w-[58ch] text-[0.99rem]">
        {state === "signed_out"
          ? "Classes are free. You need a LearnFRC account to sign up, and making one takes a minute."
          : eligibilitySentence(state)}
      </p>
      {step && (
        <Link href={step.href} className="nb-btn mt-5">
          {step.label}
        </Link>
      )}
    </>
  );
}
