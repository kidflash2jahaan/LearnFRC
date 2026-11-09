import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HANDLING_LINE, loadClassReview } from "@/lib/app/admin-classes";
import { pacificTime } from "@/lib/classes/emails";
import { clock } from "@/lib/classes/code-flags";
import { CATEGORY_WORDS } from "@/lib/classes/review-prompt";
import { CODE_KIND_WORDS, VIDEO_LINE } from "@/lib/classes/safety-routing";
import { HoldForm, ToolButton } from "../_controls";
import { DecisionForm } from "./_decision";
import { ClassRecord } from "./_record";

export const metadata: Metadata = {
  title: "Class review",
  robots: { index: false, follow: false },
};

// "Rerun notes" runs the review after the response, and "Pull from
// Cloudflare" reconciles while you wait: both need the room.
export const maxDuration = 300;

/**
 * /admin/classes/[id]: one class's review (classes-design.md 7.6). The header,
 * attendance and minutes, the notes (code flags and the model's flags, each
 * jumping to its transcript line), the transcript and chat, the recording,
 * reports, and the decision. Restricted reviews show only the header and
 * "Dhiren is handling this one" to anyone but the safety lead.
 *
 * ?decide=approve|reject (the email's buttons) only picks the choice.
 */

const VERDICT_WORD: Record<string, string> = { looks_fine: "Looks fine", needs_review: "Needs a look", urgent: "Urgent" };
const MATCH_WORD: Record<string, string> = {
  matches: "covered the topic",
  partly: "partly covered the topic",
  off_topic: "off topic",
  unclear: "unclear whether it covered the topic",
};
const REVIEW_STATUS_WORD: Record<string, string> = {
  pending: "Notes are coming: transcripts arrive after the class, and notes about half an hour after it ends.",
  failed: "The notes failed. The sweep retries up to 3 times; Rerun notes tries now.",
  refused: "Claude declined to write notes for this class. Follow the playbook before reading the transcript.",
  no_transcript: "No transcript came in, so these notes are from code checks only. Watch the recording if it matters.",
  ready: "",
};
const END_WORD: Record<string, string> = {
  teacher: "the teacher ended it",
  admin: "staff ended it",
  time: "time ran out",
  empty: "the room emptied",
  teacher_gone: "the teacher left",
  reports: "ended after two reports",
  paused: "classes were paused",
  sweep: "never started",
};
const REASON_WORD: Record<string, string> = {
  private_contact: "asked to talk privately or meet up",
  sexual: "sexual or inappropriate",
  unsafe: "feels unsafe",
  harassment: "harassment",
  offensive: "offensive",
  personal_info: "personal info",
  impersonation: "impersonation",
  spam: "spam",
  other: "other",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="nb-slug">{label}</dt>
      <dd className="mt-0.5 text-[0.98rem] leading-snug">{value}</dd>
    </div>
  );
}

function Locked() {
  return (
    <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
      <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
        <p className="nb-slug">access / denied</p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">This drawer is locked.</h1>
        <p className="mt-4 text-graphite">
          Class reviews are open to LearnFRC&rsquo;s super admins and the safety lead only.
        </p>
        <Link href="/dashboard" className="nb-btn mt-6">
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}

export default async function ClassReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/classes/${encodeURIComponent(id)}`);

  const res = await loadClassReview(user, id);
  if (!res.ok) {
    if (res.code === "forbidden") return <Locked />;
    if (res.code === "not_found") notFound();
    return (
      <div className="nb-wrap py-16">
        <p className="nb-error">{res.error}</p>
      </div>
    );
  }
  const p = res.page;
  const decide = sp.decide === "approve" || sp.decide === "reject" ? sp.decide : null;
  const decided = p.status === "approved" || p.status === "rejected";
  const rev = p.review;

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-slug">
          <Link href="/admin/classes" className="nb-link">
            classes
          </Link>{" "}
          / review
        </p>
        <p className="nb-marker mt-3">sheet / one class</p>
        <h1 className="max-w-[28ch] text-[clamp(2rem,1rem+3vw,3.1rem)]">{p.title}</h1>
        <p className="mt-3 flex flex-wrap gap-2">
          <span className="nb-tag">{p.status.replace("_", " ")}</span>
          {p.firstClass ? <span className="nb-tag">Teacher&rsquo;s first class</span> : null}
          {rev?.verdict ? <span className="nb-tag" data-on={rev.verdict === "urgent" || undefined}>{VERDICT_WORD[rev.verdict]}</span> : null}
          {p.restricted ? <span className="nb-tag">restricted</span> : null}
          {p.keepEvidence ? <span className="nb-tag">evidence kept</span> : null}
          {p.app === "dev" ? <span className="nb-tag">dev app</span> : null}
        </p>
        <dl className="mt-6 grid max-w-[62rem] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="teacher" value={p.teacherUsername ? `@${p.teacherUsername}` : "a deleted account"} />
          <Row
            label="topic"
            value={
              p.topic ? (
                <a href={p.topic.url} className="nb-link">
                  {p.topic.title}
                </a>
              ) : (
                "none"
              )
            }
          />
          <Row label="scheduled" value={`${pacificTime(p.startsAt)}, ${p.durationMinutes} min`} />
          <Row label="went live" value={p.liveStartedAt ? pacificTime(p.liveStartedAt) : "never"} />
          <Row label="ended" value={p.endedAt ? `${pacificTime(p.endedAt)}${p.endReason ? ` (${END_WORD[p.endReason] ?? p.endReason})` : ""}` : "not yet"} />
          <Row label="hard end" value={pacificTime(p.hardEndAt)} />
        </dl>
        {p.description ? <p className="mt-5 max-w-[62ch] whitespace-pre-wrap text-graphite">{p.description}</p> : null}
      </section>

      {p.hidden ? (
        <section className="nb-wrap mt-10">
          <div className="nb-box max-w-[46rem] p-[clamp(1.2rem,3vw,2rem)]">
            <p className="nb-slug">restricted</p>
            <p className="mt-2 text-[1.2rem] font-bold">{HANDLING_LINE}</p>
            <p className="mt-2 text-graphite">
              The notes, transcript, chat and recording are the safety lead&rsquo;s until he releases them.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="nb-wrap mt-12">
            <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Notes</h2>
            {rev ? (
              <div className="mt-4 max-w-[62rem]">
                {REVIEW_STATUS_WORD[rev.status] ? <p className="nb-note max-w-[60ch]">{REVIEW_STATUS_WORD[rev.status]}</p> : null}
                {rev.error && rev.status === "failed" ? <p className="nb-error mt-2">{rev.error}</p> : null}
                {rev.lessonMatch ? <p className="nb-slug mt-3">Claude says it {MATCH_WORD[rev.lessonMatch] ?? rev.lessonMatch}.</p> : null}
                {rev.summaryMd ? (
                  <div className="mt-3 max-w-[62ch] whitespace-pre-wrap text-[0.98rem] leading-relaxed">{rev.summaryMd}</div>
                ) : null}

                <h3 className="mt-6 text-[1.1rem]">Things to check</h3>
                {rev.flags.length + rev.codeFlags.length === 0 ? (
                  <p className="nb-hint mt-2">Nothing flagged.</p>
                ) : (
                  <ul className="mt-2">
                    {rev.flags.map((f, i) => (
                      <li key={`m-${i}`} className="nb-hair py-2.5 text-[0.95rem] leading-snug first:border-t-0">
                        {f.atSeconds != null ? (
                          <a href={`#t-${f.atSeconds}`} className="nb-link nb-slug mr-2 tabular-nums">
                            {clock(f.atSeconds)}
                          </a>
                        ) : null}
                        <span className="nb-tag mr-2">{f.severity}</span>
                        <b>{CATEGORY_WORDS[f.category] ?? f.category}</b>,{" "}
                        {f.speakerUsername ? `@${f.speakerUsername}` : f.speaker ? `speaker ${f.speaker}` : "unknown speaker"}: {f.why}
                        {f.quote ? <span className="mt-1 block text-graphite">&ldquo;{f.quote}&rdquo;</span> : null}
                      </li>
                    ))}
                    {rev.codeFlags.map((f, i) => (
                      <li key={`c-${i}`} className="nb-hair py-2.5 text-[0.95rem] leading-snug first:border-t-0">
                        {f.atSeconds != null ? (
                          <a href={`#t-${Math.floor(f.atSeconds)}`} className="nb-link nb-slug mr-2 tabular-nums">
                            {clock(f.atSeconds)}
                          </a>
                        ) : null}
                        <span className="nb-tag mr-2">{f.severity}</span>
                        <b>{CODE_KIND_WORDS[f.kind] ?? f.kind}</b>: {f.detail}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="nb-hint mt-4 max-w-[62ch]">{VIDEO_LINE}</p>
                <p className="nb-slug mt-2">
                  {rev.model ?? "no model"} / prompt {rev.promptVersion ?? "none"} / {rev.attempts}{" "}
                  {rev.attempts === 1 ? "attempt" : "attempts"}
                  {rev.emailedAt ? ` / emailed ${pacificTime(rev.emailedAt)}` : ""}
                </p>
              </div>
            ) : (
              <p className="nb-hint mt-3">No notes yet. They come about half an hour after the class ends.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <ToolButton tool="rerun" classId={p.id} label="Rerun notes" pendingLabel="Starting" />
              <ToolButton tool="pull" classId={p.id} label="Pull from Cloudflare" pendingLabel="Pulling" />
              {p.restricted && p.reviewer.role === "safety_lead" && p.reviewer.canSeeRestricted ? (
                <ToolButton
                  tool="release"
                  classId={p.id}
                  label="Release to reviewers"
                  pendingLabel="Releasing"
                  armedText="One more click lets super admins read this review, its transcript and its recording."
                />
              ) : null}
            </div>
          </section>

          <section className="nb-wrap mt-12">
            <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Attendance and minutes</h2>
            <dl className="mt-4 grid max-w-[62rem] gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Row label="teacher minutes" value={p.minutes.computed} />
              <Row
                label="without flagged students"
                value={p.minutes.excluded.length ? `${p.minutes.withoutFlagged} (leaves out ${p.minutes.excluded.map((e) => `@${e.username ?? "?"}`).join(", ")})` : "nobody flagged"}
              />
              <Row label="one-on-one minutes" value={p.minutes.oneOnOne} />
              <Row
                label="camera / screen share"
                value={
                  [...p.minutes.camera.map((c) => `camera @${c.username ?? "?"} ${c.minutes}`), ...p.minutes.screenshare.map((c) => `screen @${c.username ?? "?"} ${c.minutes}`)].join(", ") ||
                  "none"
                }
              />
            </dl>
            {p.attendance.length === 0 ? (
              <p className="nb-hint mt-4">Nobody joined.</p>
            ) : (
              <div className="nb-scroll mt-4 max-w-[62rem] overflow-x-auto">
                <table className="nb-table">
                  <thead>
                    <tr>
                      <th scope="col">username</th>
                      <th scope="col">role</th>
                      <th scope="col">age</th>
                      <th scope="col">parent email</th>
                      <th scope="col">account</th>
                      <th scope="col">joined</th>
                      <th scope="col">left</th>
                      <th scope="col">min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.attendance.map((a, i) => (
                      <tr key={`${a.userId}-${i}`}>
                        <td>{a.username ? `@${a.username}` : "a deleted account"}</td>
                        <td>{a.role}</td>
                        <td>{a.ageBand ?? (a.role === "staff" ? "staff" : "unknown")}</td>
                        <td className="break-all">
                          {a.parentEmail ? (
                            <a href={`mailto:${a.parentEmail}`} className="nb-link">
                              {a.parentEmail}
                            </a>
                          ) : a.role === "student" ? (
                            "none on file"
                          ) : (
                            ""
                          )}
                        </td>
                        <td>{a.accountAgeDays != null ? `${a.accountAgeDays} days` : "?"}</td>
                        <td className="whitespace-nowrap">{pacificTime(a.joinedAt)}</td>
                        <td className="whitespace-nowrap">{a.leftAt ? pacificTime(a.leftAt) : "still in"}</td>
                        <td className="tabular-nums">{a.minutes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="nb-wrap mt-12">
            <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Transcript and chat</h2>
            <div className="mt-4">
              <ClassRecord transcript={p.transcript} chat={p.chat} />
            </div>
          </section>

          <section id="recording" className="nb-wrap mt-12 scroll-mt-24">
            <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Recording</h2>
            {p.recordings.length === 0 ? (
              <p className="nb-hint mt-3">No session was recorded.</p>
            ) : (
              <ul className="mt-4 grid max-w-[62rem] gap-6">
                {p.recordings.map((s, i) => (
                  <li key={s.sessionId}>
                    <p className="nb-slug">
                      session {i + 1}
                      {s.expiresAt ? ` / link good until ${pacificTime(s.expiresAt)}` : ""}
                    </p>
                    {s.url ? (
                      <video controls preload="none" src={s.url} className="mt-2 w-full max-w-[48rem] border-2 border-ink bg-ink" />
                    ) : (
                      <p className="nb-hint mt-2">
                        {s.expiresAt ? "Cloudflare deleted this recording after 7 days." : "The recording hasn't uploaded yet."}{" "}
                        {p.holds ? (
                          <>
                            A copy may be held:{" "}
                            <Link href="/admin/classes/holds" className="nb-link">
                              open the holds
                            </Link>
                            .
                          </>
                        ) : null}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <HoldForm classId={p.id} held={p.holds} />
            </div>
          </section>

          {p.events.length ? (
            <section className="nb-wrap mt-12">
              <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">What happened</h2>
              <ul className="mt-3 max-w-[62rem]">
                {p.events.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="nb-hair py-2 text-[0.93rem] first:border-t-0">
                    <span className="nb-slug mr-2">{pacificTime(e.at)}</span>
                    {e.kind.replace(/_/g, " ")}
                    {e.actorUsername ? ` by @${e.actorUsername}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section className="nb-wrap mt-12">
        <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Reports about this class</h2>
        {p.reports.length === 0 ? (
          <p className="nb-hint mt-3">None.</p>
        ) : (
          <ul className="mt-3 max-w-[62rem]">
            {p.reports.map((r) => (
              <li key={r.id} className="nb-hair py-2.5 text-[0.95rem] first:border-t-0">
                <span className="nb-tag mr-2">{r.status}</span>
                about {r.reportedUsername ? `@${r.reportedUsername}` : "someone"}: {REASON_WORD[r.reason] ?? r.reason}
                <span className="nb-slug ml-2">{pacificTime(r.createdAt)}</span>
                {r.details ? (
                  <span className="mt-1 block whitespace-pre-wrap text-[0.9rem] text-graphite">They wrote: {r.details}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {p.reports.length ? (
          <p className="mt-3">
            <Link href="/admin/reports" className="nb-link">
              Answer them on the reports desk
            </Link>
          </p>
        ) : null}
      </section>

      <section className="nb-wrap mt-14 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
        <h2 className="text-[clamp(1.4rem,1.05rem+1.2vw,2.1rem)]">Decision</h2>
        {decided ? (
          <div className="nb-note mt-4 max-w-xl">
            <p>
              {p.status === "approved" ? `Approved, ${p.decision.creditedMinutes ?? 0} minutes credited` : "Rejected"}
              {p.decision.decidedBy ? ` by @${p.decision.decidedBy}` : ""}
              {p.decision.decidedAt ? `, ${pacificTime(p.decision.decidedAt)}` : ""}.
            </p>
            {p.decision.note ? <p className="mt-1 text-graphite">{p.decision.note}</p> : null}
          </div>
        ) : p.canDecide ? (
          <div className="mt-4">
            <DecisionForm
              classId={p.id}
              initial={decide}
              computed={p.minutes.computed}
              withoutFlagged={p.minutes.withoutFlagged}
              excluded={p.minutes.excluded.map((e) => `@${e.username ?? "?"}`).join(", ")}
              maxMinutes={p.durationMinutes + 45}
            />
          </div>
        ) : (
          <p className="nb-hint mt-3">
            {p.hidden ? HANDLING_LINE : p.status === "canceled" ? "This class was canceled." : "A class can be decided once it ends."}
          </p>
        )}
      </section>
    </div>
  );
}
