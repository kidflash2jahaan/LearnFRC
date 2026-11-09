import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { classesVisible } from "@/lib/classes/config";
import { COORDINATOR } from "@/lib/classes/coordinator";
import {
  LETTER_SENTENCES,
  NAME_HELP_EMAIL,
  loadTeacherLetterDesk,
  type TeacherLetter,
} from "@/lib/classes/letters";
import {
  SCHOOL_RULES_NOTE,
  hoursAndMinutes,
  letterTotals,
  pacificDate,
  shortDate,
} from "@/lib/classes/letter-rules";
import { LetterRequestForm } from "./_request-form";

export const metadata: Metadata = {
  title: "Hours letters",
  robots: { index: false, follow: false },
};

/**
 * /classes/teaching/letter: a teacher's hours letters (classes-design.md
 * section 9.2 step 1). The locked name, the date range with a live preview,
 * the request button, and every letter they've asked for.
 *
 * Nothing about classes shows while classes are hidden (section 1), so this
 * page 404s then. It 404s before getSession() reads the auth cookie, so the
 * route is marked dynamic, or the build would prerender the hidden 404.
 */
export const dynamic = "force-dynamic";

const STATUS_WORD: Record<TeacherLetter["status"], string> = {
  requested: "waiting",
  issued: "signed",
  declined: "not approved",
  revoked: "withdrawn",
};

function LetterLine({ l }: { l: TeacherLetter }) {
  return (
    <li className="nb-hair py-4 first:border-t-0 first:pt-0">
      <p className="nb-slug flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="nb-tag">{STATUS_WORD[l.status]}</span>
        <span>
          {shortDate(l.period_start)} to {shortDate(l.period_end)}
        </span>
        <span>asked {shortDate(pacificDate(l.requested_at))}</span>
      </p>
      <p className="mt-2 text-[1rem] leading-snug">
        <b>{hoursAndMinutes(l.total_minutes)}</b>{" "}
        <span className="text-graphite">
          across {l.class_count} {l.class_count === 1 ? "class" : "classes"}
        </span>
      </p>

      {l.status === "requested" ? (
        <p className="nb-hint mt-1.5">Waiting for {COORDINATOR.name} to review and sign it.</p>
      ) : null}

      {l.status === "issued" && l.code ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={`/letters/${l.code}`} className="nb-btn nb-btn-sm">
            Open the letter
          </Link>
          <span className="nb-slug">
            code <b className="text-ink">{l.code}</b>
            {l.issued_at ? ` / signed ${shortDate(pacificDate(l.issued_at))}` : ""}
          </span>
        </div>
      ) : null}

      {l.status === "declined" ? (
        <p className="mt-1.5 max-w-[62ch] text-[0.93rem] leading-snug text-graphite">
          {COORDINATOR.name} didn&rsquo;t sign this one: {l.decline_reason}
        </p>
      ) : null}

      {l.status === "revoked" ? (
        <p className="mt-1.5 max-w-[62ch] text-[0.93rem] leading-snug text-graphite">
          Withdrawn{l.revoked_at ? ` on ${shortDate(pacificDate(l.revoked_at))}` : ""}, and its verify page
          says so now. Why: {l.revoked_reason}
        </p>
      ) : null}
    </li>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-slug">
          <Link href="/classes/teaching" className="nb-link">
            teaching
          </Link>{" "}
          / hours letters
        </p>
        {children}
      </section>
    </div>
  );
}

export default async function TeacherLetterPage() {
  if (!(await classesVisible())) notFound();
  const { user } = await getSession();
  if (!user) redirect("/login?next=/classes/teaching/letter");

  const result = await loadTeacherLetterDesk(user);
  if (!result.ok && result.code === "server") {
    return (
      <Frame>
        <p className="nb-error mt-6">{result.error}</p>
      </Frame>
    );
  }
  if (!result.ok) {
    return (
      <Frame>
        <div className="nb-box nb-tilt-2 relative mt-6 max-w-xl p-[clamp(1.4rem,4vw,2.2rem)]">
          <span className="nb-tape -top-3 left-[18%] rotate-[-3deg]" aria-hidden="true" />
          <p className="nb-marker">letters / teachers only</p>
          <h1 className="text-[clamp(1.7rem,1.2rem+1.8vw,2.4rem)]">Letters come with teaching.</h1>
          <p className="mt-3 text-graphite">{result.error}</p>
          {result.error === LETTER_SENTENCES.notTeacher ? (
            <Link href="/apply/teach" className="nb-btn mt-5">
              Teach a live class
            </Link>
          ) : null}
        </div>
      </Frame>
    );
  }

  const desk = result.desk;
  const allTime = letterTotals(desk.classes);

  return (
    <Frame>
      <p className="nb-marker mt-3">sheet / hours letters</p>
      <h1 className="max-w-[20ch] text-[clamp(2.1rem,1rem+3.2vw,3.2rem)]">
        A signed letter for your service hours.
      </h1>
      <p className="nb-lede mt-4 max-w-[60ch]">
        Pick the dates and ask for a letter. {COORDINATOR.name}, LearnFRC&rsquo;s volunteer
        coordinator, checks it against the class records and signs it. Then you can print it, and anyone
        you give it to can check it online.
      </p>

      <div className="mt-8 grid max-w-[58rem] gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="nb-box p-[clamp(1.1rem,2.6vw,1.6rem)]">
          <p className="nb-slug">name on your letters</p>
          <p className="mt-1.5 break-words text-[1.35rem] font-extrabold leading-tight">{desk.letterName}</p>
          <p className="nb-hint mt-2">
            Locked when you were accepted, so it matches what your school knows.{" "}
            <a
              href={`mailto:${NAME_HELP_EMAIL}?subject=${encodeURIComponent("Name on my LearnFRC hours letters")}`}
              className="nb-link"
            >
              Wrong? Write to us
            </a>
            .
          </p>
        </div>
        <div className="nb-box p-[clamp(1.1rem,2.6vw,1.6rem)]">
          <p className="nb-slug">approved teaching time, all classes</p>
          <p className="nb-count mt-1.5 text-[clamp(1.5rem,1.1rem+1.2vw,2rem)]">
            {hoursAndMinutes(allTime.totalMinutes)}
            <small>
              {" "}
              / {allTime.classCount} {allTime.classCount === 1 ? "class" : "classes"}
            </small>
          </p>
          <p className="nb-hint mt-2">Counted from join and leave times, only while a student was in the room.</p>
        </div>
      </div>

      <div className="nb-note mt-6 max-w-[58rem]">
        <p className="nb-slug">before you ask</p>
        <p className="mt-1.5 text-[0.95rem] leading-snug">{SCHOOL_RULES_NOTE}</p>
      </div>

      <section className="mt-10 max-w-[58rem]">
        <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">Ask for a letter</h2>
        {desk.blocked ? (
          <p className="nb-note mt-4 max-w-[62ch] text-[0.95rem] leading-snug">{LETTER_SENTENCES.noLetters}</p>
        ) : (
          <LetterRequestForm
            classes={desk.classes}
            defaultStart={desk.defaultPeriod.start}
            defaultEnd={desk.defaultPeriod.end}
            today={desk.today}
            openRequests={desk.openRequests}
            maxOpenRequests={desk.maxOpenRequests}
            signerName={COORDINATOR.name}
          />
        )}
      </section>

      <section className="mt-12 max-w-[58rem] border-t-2 border-ink pt-8">
        <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">Your letters</h2>
        {desk.letters.length === 0 ? (
          <p className="nb-sub mt-3">None yet. Letters you ask for show up here, signed or not.</p>
        ) : (
          <ul className="mt-5">
            {desk.letters.map((l) => (
              <LetterLine key={l.id} l={l} />
            ))}
          </ul>
        )}
      </section>
    </Frame>
  );
}
