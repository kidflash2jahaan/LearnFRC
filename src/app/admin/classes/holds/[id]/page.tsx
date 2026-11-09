import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadHold, type HoldDetail } from "@/lib/classes/holds";
import { HOLD_RECORDING_LABELS } from "@/lib/classes/hold-rules";
import { ClassReviewLocked } from "../_locked";
import { clock, megabytes, utcDay, utcStamp } from "../_format";
import {
  ExtendHoldForm,
  HeldRecordingPlayer,
  HoldNoteForm,
  ReleaseHoldForm,
  RetryCopyForm,
} from "../_hold-controls";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Evidence hold",
  robots: { index: false, follow: false },
};

/** "Try the copy again" streams a recording into R2 after the response. */
export const maxDuration = 300;

const SESSION_WORD: Record<string, string> = {
  stored: "kept",
  copying: "copying",
  failed: "copy failed",
  gone: "not kept, the link expired",
  pending: "waiting to copy",
  none: "no recording",
};

const CHAT_KIND_WORD: Record<string, string> = {
  link: "link",
  handle: "@handle",
  email: "email",
  phone: "phone number",
  contact_app: "other app",
  contact_phrase: "contact phrase",
  profanity: "profanity",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="nb-slug">{label}</p>
      <div className="mt-0.5 break-words text-[0.98rem] leading-snug">{children}</div>
    </div>
  );
}

function Peers({ hold }: { hold: HoldDetail }) {
  if (hold.peers.length === 0)
    return <p className="nb-hint">No connections were recorded for this person in the class.</p>;
  return (
    <div className="nb-scroll max-w-full overflow-x-auto">
      <table className="nb-table min-w-[44rem]">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">IP</th>
            <th scope="col">Place</th>
            <th scope="col">Device</th>
            <th scope="col">Fetched</th>
          </tr>
        </thead>
        <tbody>
          {hold.peers.map((p) => (
            <tr key={p.peerId}>
              <td>
                {p.handle ? `@${p.handle}` : "deleted account"}
                <span className="nb-slug block">{p.role ?? ""}</span>
              </td>
              {p.ok ? (
                <>
                  <td className="font-mono text-[0.85rem]">{p.summary.ip ?? "not given"}</td>
                  <td>{[p.summary.city, p.summary.region, p.summary.country].filter(Boolean).join(", ") || "not given"}</td>
                  <td>{[p.summary.device, p.summary.os, p.summary.browser].filter(Boolean).join(" / ") || "not given"}</td>
                </>
              ) : (
                <td colSpan={3} className="text-graphite">
                  Not fetched yet ({p.error === "not_configured" ? "no Cloudflare keys" : p.error}). The sweep tries again.
                </td>
              )}
              <td className="nb-slug">{utcStamp(p.fetchedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Transcript({ hold }: { hold: HoldDetail }) {
  if (hold.transcript.length === 0) return <p className="nb-hint">No transcript was kept (none had arrived yet).</p>;
  const sessions = [...new Set(hold.transcript.map((l) => l.sessionId ?? ""))];
  return (
    <ol className="grid gap-1.5">
      {hold.transcript.map((l, i) => (
        <li key={i} className="max-w-[72ch] text-[0.93rem] leading-snug">
          <span className="nb-slug mr-2">
            {sessions.length > 1 ? `s${sessions.indexOf(l.sessionId ?? "") + 1} ` : ""}
            {clock(l.t0)}
          </span>
          <b>{l.label || "someone"}</b>
          {l.role ? <span className="text-graphite"> ({l.role})</span> : null}: {l.text}
        </li>
      ))}
    </ol>
  );
}

function Chat({ hold }: { hold: HoldDetail }) {
  if (hold.chat.length === 0) return <p className="nb-hint">Nobody wrote in the class chat.</p>;
  return (
    <ol className="grid gap-1.5">
      {hold.chat.map((m) => (
        <li key={m.id} className="max-w-[72ch] text-[0.93rem] leading-snug">
          <span className="nb-slug mr-2">{utcStamp(m.sent_at)}</span>
          <b>@{m.sender_username}</b>
          {m.sender_role !== "student" ? <span className="text-graphite"> ({m.sender_role})</span> : null}
          {m.status === "blocked" ? (
            <span className="nb-tag ml-2">
              stopped by the filter: {m.blocked_kinds.map((k) => CHAT_KIND_WORD[k] ?? k).join(", ")}
            </span>
          ) : null}
          : <span className="break-words">{m.body}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function HoldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getSession();
  if (!user) redirect(`/login?next=/admin/classes/holds/${encodeURIComponent(id)}`);

  const res = await loadHold(user, id);
  if (!res.ok) {
    if (res.code === "forbidden") return <ClassReviewLocked what="Evidence holds can include recordings of minors." />;
    return (
      <div className="nb-wrap py-16">
        <p className="nb-error">{res.error}</p>
        <Link href="/admin/classes/holds" className="nb-link mt-4 inline-block">
          Back to the holds
        </Link>
      </div>
    );
  }

  const h = res.hold;
  const crumbs = (
    <p className="nb-slug">
      <Link href="/admin/classes" className="nb-link">
        classes
      </Link>{" "}
      /{" "}
      <Link href="/admin/classes/holds" className="nb-link">
        holds
      </Link>{" "}
      / {id.slice(0, 8)}
    </p>
  );

  if (h.hidden) {
    return (
      <div className="nb-route pb-24">
        <section className="nb-wrap pt-10 lg:pt-16">
          {crumbs}
          <p className="nb-marker mt-3">hold / restricted</p>
          <h1 className="text-[clamp(2rem,1rem+3vw,3rem)]">{h.placeholder}</h1>
          <p className="nb-lede mt-5 max-w-[60ch]">
            This hold is restricted: its transcript, chat and recording open for the safety lead only,
            until he releases them.
            {h.class ? ` It's about the class "${h.class.title}" on ${utcDay(h.class.startsAt)}.` : ""} It&rsquo;s
            kept until {utcDay(h.expiresAt)}.
          </p>
        </section>
      </div>
    );
  }

  const canRetry = !!h.class && res.r2Configured && (h.recordingStatus === "failed" || h.recordingStatus === "none");

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        {crumbs}
        <p className="nb-marker mt-3">hold / {h.restricted ? "restricted" : "evidence"}</p>
        <h1 className="text-[clamp(2rem,1rem+3vw,3rem)]">{h.reasonLabel}</h1>
        {h.restricted ? (
          <div className="nb-note mt-5 max-w-[62ch]">
            <p className="nb-slug">restricted / safety lead only</p>
            <p className="mt-1.5 text-[0.95rem] leading-snug">
              Only you can see this until you release it. Don&rsquo;t download, screenshot, copy,
              forward or show anyone the material, not even to report it. Watch or read only as much
              as you need to know what it is. The{" "}
              <Link href="/admin/classes/playbook" className="nb-link">
                playbook
              </Link>{" "}
              has the steps.
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid max-w-[58rem] gap-5 sm:grid-cols-2">
          <Fact label="about">
            {h.subjectHandle ? `@${h.subjectHandle}` : h.subjectUserId ? "a deleted account" : "the whole class"}
            {h.subjectEmail ? <span className="block text-graphite">{h.subjectEmail}</span> : null}
            {h.subjectUserId ? (
              <span className="nb-slug block">
                {h.subjectAccountExists ? "account still exists" : "account deleted"} / {h.subjectUserId}
              </span>
            ) : null}
          </Fact>
          <Fact label="class">
            {h.class ? (
              <>
                <Link href={`/admin/classes/${h.class.id}`} className="nb-link">
                  {h.class.title}
                </Link>
                <span className="block text-graphite">
                  {utcStamp(h.class.startsAt)}
                  {h.class.teacherHandle ? `, taught by @${h.class.teacherHandle}` : ""}
                </span>
              </>
            ) : (
              "No class in the 90 days before the account was held."
            )}
          </Fact>
          <Fact label="taken">
            {utcStamp(h.createdAt)}
            {h.createdByHandle ? ` by @${h.createdByHandle}` : " by the site"}
          </Fact>
          <Fact label="kept until">
            {h.expired ? `${utcDay(h.expiresAt)}, expired: deleted at the next daily sweep` : utcDay(h.expiresAt)}
          </Fact>
          <Fact label="CyberTipline report">{h.ncmecReportId ?? "none recorded"}</Fact>
          <Fact label="released to reviewers">
            {h.releasedAt ? `${utcStamp(h.releasedAt)}${h.releasedByHandle ? ` by @${h.releasedByHandle}` : ""}` : "no"}
          </Fact>
        </div>

        {h.notes ? (
          <div className="mt-8 max-w-[62ch]">
            <p className="nb-slug">notes</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[0.95rem] leading-snug">{h.notes}</p>
          </div>
        ) : null}
      </section>

      <section className="nb-wrap mt-12 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
        <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">Write down what you did</h2>
        <div className="mt-5 grid max-w-[58rem] gap-10 lg:grid-cols-2">
          <HoldNoteForm holdId={h.id} ncmecReportId={h.ncmecReportId} />
          <div className="grid content-start gap-8">
            <ExtendHoldForm holdId={h.id} />
            {h.restricted && res.safetyLead ? <ReleaseHoldForm holdId={h.id} /> : null}
          </div>
        </div>
      </section>

      <section id="recording" className="nb-wrap mt-12 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
        <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">Recording</h2>
        <p className="nb-sub mt-2">{HOLD_RECORDING_LABELS[h.recordingStatus]}</p>
        {h.recordings.length ? (
          <ul className="mt-4 grid max-w-[58rem] gap-1.5">
            {h.recordings.map((r, i) => (
              <li key={r.sessionId} className="nb-slug">
                session {i + 1}: {SESSION_WORD[r.status] ?? r.status}
                {r.bytes ? `, ${megabytes(r.bytes)}` : ""}
                {r.error ? ` (${r.error === "r2_not_configured" ? "no R2 keys yet" : r.error})` : ""}
                {r.status !== "stored" && r.sourceExpiresAt ? `, Cloudflare's link lasts until ${utcStamp(r.sourceExpiresAt)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-5 flex flex-wrap items-start gap-4">
          {h.recordingStatus === "stored" || h.recordings.some((r) => r.status === "stored") ? (
            <HeldRecordingPlayer holdId={h.id} />
          ) : null}
          {canRetry ? <RetryCopyForm holdId={h.id} /> : null}
        </div>
      </section>

      <section className="nb-wrap mt-12 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
        <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">Connections</h2>
        <p className="nb-sub mt-2">
          From Cloudflare, for {h.subjectUserId ? "this person and " : ""}the teacher. Cloudflare keeps these
          for six months, so they&rsquo;re copied here.
        </p>
        <div className="mt-5 max-w-[64rem]">
          <Peers hold={h} />
        </div>
      </section>

      {h.class ? (
        <section className="nb-wrap mt-12 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="text-[clamp(1.4rem,1.1rem+1.2vw,2rem)]">What was said</h2>
          <details className="mt-5 max-w-[64rem]">
            <summary className="nb-btn-ghost nb-btn-sm cursor-pointer">
              Transcript, {h.transcript.length} {h.transcript.length === 1 ? "line" : "lines"}
            </summary>
            <div className="mt-4">
              <Transcript hold={h} />
            </div>
          </details>
          <details className="mt-4 max-w-[64rem]">
            <summary className="nb-btn-ghost nb-btn-sm cursor-pointer">
              Chat, {h.chat.length} {h.chat.length === 1 ? "message" : "messages"}
              {h.chat.some((m) => m.status === "blocked")
                ? `, ${h.chat.filter((m) => m.status === "blocked").length} stopped by the filter`
                : ""}
            </summary>
            <div className="mt-4">
              <Chat hold={h} />
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
