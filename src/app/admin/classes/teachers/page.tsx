import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  loadTeacherDesk,
  type DeskTeacher,
  type DeskTeacherApplication,
} from "@/lib/app/class-teachers";
import { PARENT_STEP_WORDS, TEACH_ANSWERS } from "@/lib/classes/teacher-rules";
import { CollapsiblePanel } from "@/components/admin/collapsible-panel";
import { DecisionControls } from "./_decision-controls";
import { LetterNameControls, SuspendControls } from "./_teacher-controls";

export const metadata: Metadata = {
  title: "Teachers",
  robots: { index: false, follow: false },
};

/**
 * The teacher desk (classes-design.md section 7.6): pending applications
 * with everything the applicant wrote, their age group and parent status;
 * an experience check box per application (every season with The Blue
 * Alliance and FRC Events links, the soft flags, the reference), the answers
 * grouped with word counts, and a folded scoring guide; Accept (needs the
 * "I checked their seasons" tick; copies the name to the locked letter name;
 * never offered on a first-form application) and Reject; current
 * teachers with their classes and approved minutes, Suspend, Unsuspend and
 * "Change letter name" (super admins, with a note).
 *
 * Open to super admins and the safety lead (loadTeacherDesk checks).
 * Deciding applications and changing letter names are super admins' only;
 * the safety lead sees the desk and can suspend.
 *
 * Works while classes are hidden, like the rest of /admin/classes, so
 * applications can be read before launch. No `dynamic` export: the session
 * read makes the route dynamic already.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcDay(iso: string | null): string {
  if (!iso) return "not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not recorded";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** 135 to "2h 15m". */
function minutesWord(n: number): string {
  if (n < 60) return `${n}m`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
}

function Answer({ label, text, words }: { label: string; text: string; words?: number }) {
  return (
    <div className="min-w-0">
      <p className="nb-slug">
        {label}
        {words != null ? <span className="ml-2 font-bold text-ink">{words} words</span> : null}
      </p>
      <p className="mt-1 max-w-[68ch] break-words whitespace-pre-wrap text-[0.98rem] leading-snug">{text}</p>
    </div>
  );
}

/** A group of answers under one slug. */
function AnswerGroup({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-dashed border-rule pt-3">
      <p className="nb-slug font-bold text-ink">{slug}</p>
      <div className="mt-2.5 grid gap-3.5">{children}</div>
    </div>
  );
}

/** The scoring guide, folded above the list (spec section 5). */
function HowToScore() {
  return (
    <details className="nb-note mb-5 max-w-[72ch]">
      <summary className="nb-slug cursor-pointer font-bold text-ink">how to score one</summary>
      <div className="mt-3 grid gap-2.5 text-[0.95rem] leading-relaxed">
        <p>
          Score four things 0 to 2. Experience: the events check out and their answer is specific. Explanation:
          the rookie explanation is correct and starts from what a rookie knows. Planning: one clear goal,
          students do something, and it works with cameras off. Judgment: both situations.
        </p>
        <p>
          Accept when the seasons check out, the explanation is correct and scores 2, and the total is 6 or more
          out of 8.
        </p>
        <p>
          Any one of these is a no: agreeing to a DM or another app, asking for or sharing contact details,
          treating the code as optional, or making up an answer for a student.
        </p>
        <p>When you turn someone down, give one concrete thing to change. They can apply again.</p>
      </div>
    </details>
  );
}

/**
 * The first thing in an entry: every season with the two places to check
 * it, the soft flags, and the reference (emailed only when the event results
 * can't confirm the seasons, and only to ask whether they were on the team).
 */
function ExperienceCheck({ app }: { app: DeskTeacherApplication }) {
  return (
    <div className="nb-note mt-3.5 max-w-[72ch]">
      <p className="nb-slug font-bold text-ink">experience check</p>
      {app.seasons.length ? (
        <ul className="mt-2 grid gap-1.5">
          {app.seasons.map((s) => (
            <li key={s.year} className="min-w-0 text-[0.95rem] leading-snug">
              <span className="font-bold">
                {s.year} / team {s.team}
              </span>
              <span className="break-words"> / {s.events}</span>
              <span className="nb-slug ml-2 inline-flex flex-wrap gap-x-3">
                <a href={s.tbaUrl} className="nb-link" target="_blank" rel="noopener noreferrer">
                  The Blue Alliance
                </a>
                <a href={s.frcEventsUrl} className="nb-link" target="_blank" rel="noopener noreferrer">
                  FRC Events
                </a>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[0.95rem]">No seasons listed.</p>
      )}
      {app.flags.length ? (
        <ul className="mt-3 grid gap-1">
          {app.flags.map((f) => (
            <li key={f} className="nb-slug font-bold text-ink">
              flag / {f}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="nb-slug mt-3">
        reference /{" "}
        {app.referenceName || app.referenceEmail ? (
          <>
            {app.referenceName}
            {app.referenceEmail ? (
              <>
                {", "}
                <a
                  // Encoded, so an address can't add a recipient or a header
                  // (the server also refuses URL characters in it).
                  href={`mailto:${encodeURIComponent(app.referenceEmail).replace(/%40/g, "@")}?subject=${encodeURIComponent("Checking a LearnFRC teacher application")}`}
                  className="nb-link break-all"
                >
                  {app.referenceEmail}
                </a>
              </>
            ) : null}
          </>
        ) : (
          "none given"
        )}
      </p>
    </div>
  );
}

function ApplicationEntry({ app, canDecide }: { app: DeskTeacherApplication; canDecide: boolean }) {
  const handle = app.username ? `@${app.username}` : "this account";
  const firstForm = app.formVersion == null;
  const years = [...app.seasons].map((s) => s.year).sort((a, b) => a - b);
  return (
    <li className="nb-hair py-5 first:border-t-0 first:pt-0">
      <p className="nb-slug flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="min-w-0 max-w-full truncate font-bold text-ink">
          {app.username ? `@${app.username}` : "no username"}
        </span>
        <span className="whitespace-nowrap">age / {app.ageBand ?? "not answered"}</span>
        <span className="whitespace-nowrap">{PARENT_STEP_WORDS[app.parentStep]}</span>
        <span className="whitespace-nowrap">team / {app.teamNumber ?? "not given"}</span>
        <span className="min-w-0 max-w-full truncate">role / {app.teamRoleLabel}</span>
        <span className="whitespace-nowrap">came in {timeAgo(app.createdAt)}</span>
        {firstForm ? <span className="nb-tag">first form: no season check</span> : null}
      </p>
      {!firstForm ? (
        <p className="nb-slug mt-1 min-w-0 break-words">
          FRC / {app.seasons.length} {app.seasons.length === 1 ? "season" : "seasons"} ({years.join(", ")}) / team{" "}
          {app.seasons[0]?.team ?? "not given"}
          {app.roles.length ? ` / ${app.roles.join(", ")}` : ""}
        </p>
      ) : null}
      {app.parentSameNetwork ? (
        <p className="nb-slug mt-1.5 font-bold text-ink">
          parent OK / decided from the student&rsquo;s own network, which families and schools often share
        </p>
      ) : null}
      {app.bioHasContact ? (
        <p className="nb-slug mt-1.5 font-bold text-ink">
          bio / has contact details (they&rsquo;ll be asked to remove them before scheduling)
        </p>
      ) : null}
      {!app.codeCurrent ? (
        <p className="nb-slug mt-1.5">
          code / agreed to version {app.codeVersion}; they&rsquo;ll agree to the new one before scheduling
        </p>
      ) : null}

      {!firstForm ? <ExperienceCheck app={app} /> : null}

      <div className="mt-3.5 grid gap-3.5">
        <div className="min-w-0">
          <p className="nb-slug">name for hours letters, locked on accept</p>
          <p className="mt-1 text-[1.02rem] font-bold">{app.legalName}</p>
        </div>

        {firstForm ? (
          <>
            <Answer label="topics they’d teach" text={app.topics} />
            {app.pickedTopics.length ? <PickedTopics app={app} /> : null}
            <Answer label="FRC experience" text={app.experience} />
            <Answer label="how they’d teach one lesson" text={app.samplePlan} />
            {app.availability ? <Answer label="availability" text={app.availability} /> : null}
            {app.referenceName || app.referenceEmail ? (
              <Answer
                label="adult reference"
                text={[app.referenceName, app.referenceEmail].filter(Boolean).join(", ")}
              />
            ) : null}
          </>
        ) : (
          <>
            <AnswerGroup slug="experience">
              {app.roles.length ? <Answer label="what they worked on" text={app.roles.join(", ")} /> : null}
              <Answer
                label={TEACH_ANSWERS.experience.label}
                text={app.experience}
                words={app.wordCounts.experience}
              />
              {app.otherPrograms ? <Answer label="other robotics programs" text={app.otherPrograms} /> : null}
            </AnswerGroup>

            <AnswerGroup slug="the lesson">
              {app.pickedTopics.length ? <PickedTopics app={app} /> : null}
              <div className="min-w-0">
                <p className="nb-slug">sample lesson</p>
                {app.sampleLesson ? (
                  <p className="mt-1 text-[0.98rem]">
                    <a href={app.sampleLesson.url} className="nb-link" target="_blank" rel="noopener noreferrer">
                      {app.sampleLesson.title}
                    </a>
                    {app.sampleLesson.moduleTitle ? (
                      <span className="nb-slug ml-2">in {app.sampleLesson.moduleTitle}</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-1 text-[0.98rem]">That lesson is no longer on LearnFRC.</p>
                )}
              </div>
              {app.teachingSample ? (
                <Answer
                  label={TEACH_ANSWERS.teachingSample.label}
                  text={app.teachingSample}
                  words={app.wordCounts.teachingSample}
                />
              ) : null}
              <Answer label={TEACH_ANSWERS.samplePlan.label} text={app.samplePlan} words={app.wordCounts.samplePlan} />
            </AnswerGroup>

            <AnswerGroup slug="two situations">
              {app.scenarioSafety ? (
                <div className="min-w-0">
                  <p className="nb-slug max-w-[68ch]">{TEACH_ANSWERS.scenarioSafety.situation}</p>
                  <div className="mt-2">
                    <Answer
                      label={TEACH_ANSWERS.scenarioSafety.label}
                      text={app.scenarioSafety}
                      words={app.wordCounts.scenarioSafety}
                    />
                  </div>
                </div>
              ) : null}
              {app.scenarioTeaching ? (
                <div className="min-w-0">
                  <p className="nb-slug max-w-[68ch]">{TEACH_ANSWERS.scenarioTeaching.situation}</p>
                  <div className="mt-2">
                    <Answer
                      label={TEACH_ANSWERS.scenarioTeaching.label}
                      text={app.scenarioTeaching}
                      words={app.wordCounts.scenarioTeaching}
                    />
                  </div>
                </div>
              ) : null}
            </AnswerGroup>

            <AnswerGroup slug="practical">
              {app.motivation ? (
                <Answer label={TEACH_ANSWERS.motivation.label} text={app.motivation} words={app.wordCounts.motivation} />
              ) : null}
              <Answer label="how often" text={app.teachOften ?? "not given"} />
              {app.availability ? <Answer label="availability" text={app.availability} /> : null}
              {app.codeQuestions ? <Answer label="about the teacher code" text={app.codeQuestions} /> : null}
              <Answer label="wrote it themselves" text={app.ownWords ? "yes" : "no"} />
            </AnswerGroup>
          </>
        )}
      </div>

      {canDecide ? (
        <DecisionControls id={app.id} handle={handle} legalName={app.legalName} canAccept={!firstForm} />
      ) : (
        <p className="nb-hint mt-4">A super admin decides applications.</p>
      )}
    </li>
  );
}

function PickedTopics({ app }: { app: DeskTeacherApplication }) {
  return (
    <div className="min-w-0">
      <p className="nb-slug">picked from LearnFRC</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {app.pickedTopics.map((t) => (
          <li key={t.id} className="nb-tag">
            {t.kind} / {t.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeacherEntry({ t, canDecide }: { t: DeskTeacher; canDecide: boolean }) {
  const handle = t.username ? `@${t.username}` : "this account";
  return (
    <li className="nb-hair py-4 first:border-t-0 first:pt-0">
      <div className="grid gap-x-8 gap-y-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="min-w-0 truncate text-[0.98rem] font-bold">
              {t.username ? `@${t.username}` : "no username"}
            </span>
            {t.suspendedAt ? <span className="nb-tag">suspended</span> : null}
            {t.lettersBlocked ? <span className="nb-tag">no letters</span> : null}
            {!t.codeCurrent ? <span className="nb-tag">old code</span> : null}
          </p>
          <p className="nb-slug mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1">
            <span className="min-w-0 max-w-full truncate">letters / {t.letterName}</span>
            <span className="whitespace-nowrap">age / {t.ageBand ?? "not answered"}</span>
            <span className="whitespace-nowrap">since {utcDay(t.grantedAt)}</span>
          </p>
          <p className="nb-slug mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1">
            <span className="whitespace-nowrap">{t.upcomingClasses} upcoming</span>
            <span className="whitespace-nowrap">{t.totalClasses} classes</span>
            <span className="whitespace-nowrap">{t.approvedClasses} approved</span>
            <span className="whitespace-nowrap font-bold text-ink">{minutesWord(t.approvedMinutes)} approved time</span>
          </p>
          {t.letterNameChange ? (
            <p className="nb-slug mt-1 max-w-[68ch] break-words">
              name changed {utcDay(t.letterNameChange.at)}
              {t.letterNameChange.note ? ` / ${t.letterNameChange.note}` : ""}
            </p>
          ) : null}
          {t.suspendedAt ? (
            <p className="nb-slug mt-1 max-w-[68ch] break-words">
              suspended {utcDay(t.suspendedAt)}
              {t.suspendedReason ? ` / ${t.suspendedReason}` : ""}
            </p>
          ) : null}
          {canDecide ? <LetterNameControls userId={t.userId} handle={handle} current={t.letterName} /> : null}
        </div>
        <SuspendControls userId={t.userId} handle={handle} suspended={!!t.suspendedAt} />
      </div>
    </li>
  );
}

function StaffOnly() {
  return (
    <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
      <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">access / class reviewers only</p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">This desk is for class reviewers.</h1>
        <p className="mt-4 text-graphite">
          Teacher applications are read by LearnFRC&rsquo;s super admins and the safety lead. Nothing is wrong
          with your account.
        </p>
        <Link href="/" className="nb-btn mt-6">
          Back to LearnFRC
        </Link>
      </div>
    </div>
  );
}

export default async function TeacherDeskPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/admin/classes/teachers");

  const desk = await loadTeacherDesk(user);
  if (!desk.ok) return <StaffOnly />;
  const { pending, teachers, decided, canDecide } = desk;
  const active = teachers.filter((t) => !t.suspendedAt).length;

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-marker">sheet / classes / teachers</p>
        <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.6rem)]">Who teaches live classes.</h1>
        <p className="nb-lede mt-5 max-w-[60ch]">
          Applications from /apply/teach land here. Accepting copies the name they gave to the locked name on
          their hours letters. Suspending stops their teaching and cancels their upcoming classes; students
          are told only that the teacher can&rsquo;t teach it.
        </p>
        <p className="nb-slug mt-4">
          <Link href="/admin/classes" className="nb-link">
            back to classes
          </Link>
        </p>
      </section>

      <section className="nb-wrap mt-12 lg:mt-16">
        <p className="nb-marker">drawers / open one to read it</p>

        <CollapsiblePanel
          title="Applications"
          slug="drawer / applications"
          badge={pending.length > 0 ? `${pending.length} waiting` : undefined}
          defaultOpen={pending.length > 0}
        >
          {pending.length === 0 ? (
            <p className="nb-slug py-2">
              Nobody is waiting. Applications come in from{" "}
              <Link href="/apply/teach" className="nb-link">
                /apply/teach
              </Link>
              .
            </p>
          ) : (
            <>
              <HowToScore />
              <ul className="min-w-0">
                {pending.map((app) => (
                  <ApplicationEntry key={app.id} app={app} canDecide={canDecide} />
                ))}
              </ul>
              {desk.pendingTruncated ? (
                <p className="nb-hint mt-3">60 shown, which is the page size. More come up once you clear these.</p>
              ) : null}
            </>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Teachers"
          slug="drawer / teachers"
          badge={`${active} teaching${teachers.length > active ? `, ${teachers.length - active} suspended` : ""}`}
          defaultOpen={pending.length === 0 && teachers.length > 0}
        >
          {teachers.length === 0 ? (
            <p className="nb-slug py-2">No teachers yet. Accepting an application adds them here.</p>
          ) : (
            <ul className="min-w-0">
              {teachers.map((t) => (
                <TeacherEntry key={t.userId} t={t} canDecide={canDecide} />
              ))}
            </ul>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel title="Decided" slug="drawer / decided">
          {decided.length === 0 ? (
            <p className="nb-slug py-2">Nothing decided yet.</p>
          ) : (
            <ul className="min-w-0">
              {decided.map((a) => (
                <li key={a.id} className="nb-hair py-2.5 first:border-t-0 first:pt-0">
                  <p className="nb-slug flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="whitespace-nowrap">{utcDay(a.reviewedAt ?? a.createdAt)}</span>
                    <span className="min-w-0 max-w-full truncate text-ink">
                      {a.username ? `@${a.username}` : "no username"}
                    </span>
                    <span className="whitespace-nowrap font-bold text-ink">{a.statusWord}</span>
                  </p>
                  {a.reviewNote ? (
                    <p className="nb-slug mt-1 max-w-[68ch] break-words">note / {a.reviewNote}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CollapsiblePanel>

        <div className="nb-rule" />
      </section>
    </div>
  );
}
