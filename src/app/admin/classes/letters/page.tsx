import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { loadLettersDesk, type DeskClass, type DeskLetter } from "@/lib/classes/letters";
import { hoursAndMinutes, pacificDate, shortDate } from "@/lib/classes/letter-rules";
import { LetterControls } from "./_letter-controls";

export const metadata: Metadata = {
  // The root template appends " · LearnFRC".
  title: "Hours letters",
  robots: { index: false, follow: false },
};

/**
 * /admin/classes/letters: the signing desk (classes-design.md section 9.2
 * steps 2 and 6). Requests waiting for the safety lead, oldest first, each
 * with the locked name, the classes with links to their review pages and
 * any flags on them; recently signed letters, which can be withdrawn; and
 * recently declined or withdrawn ones.
 *
 * Open to super admins and the safety lead (requireClassReviewer, inside
 * loadLettersDesk). Only the safety lead signs. It works whether or not
 * classes are visible, like the rest of /admin/classes, so reviewers can
 * finish their work while classes are switched off.
 */

const VERDICT_WORD: Record<string, string> = {
  looks_fine: "looks fine",
  needs_review: "needed a look",
  urgent: "urgent",
};

function when(iso: string | null): string {
  return iso ? shortDate(pacificDate(iso)) : "";
}

function ClassRow({ c }: { c: DeskClass }) {
  const notes: string[] = [];
  if (c.currentStatus && c.currentStatus !== "approved") notes.push(`now ${c.currentStatus}`);
  if (c.restrictedHidden) notes.push(`safety review, ${COORDINATOR.name.split(" ")[0]} has it`);
  else {
    if (c.verdict) notes.push(`notes: ${VERDICT_WORD[c.verdict] ?? c.verdict}`);
    if (c.restricted) notes.push("restricted review");
    if (c.flagCount) notes.push(`${c.flagCount} ${c.flagCount === 1 ? "flag" : "flags"}`);
    if (c.chatBlocked) notes.push(`${c.chatBlocked} chat ${c.chatBlocked === 1 ? "message" : "messages"} stopped`);
  }
  if (c.reports) notes.push(`${c.reports} ${c.reports === 1 ? "report" : "reports"}`);
  return (
    <tr>
      <td className="whitespace-nowrap">{shortDate(c.date)}</td>
      <td>
        <Link href={c.reviewPath} className="nb-link">
          {c.title}
        </Link>
        {c.topic ? <span className="block text-[0.85rem] text-graphite">{c.topic}</span> : null}
        {c.minutesNote ? <span className="block text-[0.85rem] text-graphite">{c.minutesNote}</span> : null}
      </td>
      <td className="text-right">{c.minutes}</td>
      <td className="text-[0.88rem] text-graphite">{notes.length ? notes.join(" / ") : "no flags"}</td>
    </tr>
  );
}

function who(l: DeskLetter): string {
  return l.teacherHandle ? `@${l.teacherHandle}` : "a deleted account";
}

function Request({ l, canSign }: { l: DeskLetter; canSign: boolean }) {
  const label = `${who(l)}'s letter`;
  const problems = [
    ...(l.blocked ? ["This is an owner or staff account, or one on the no-letters list. It can't get a letter."] : []),
    ...(l.currentLetterName ? [`The locked name is "${l.currentLetterName}" now, not the one on this request.`] : []),
    ...l.drift,
  ];
  return (
    <li id={`letter-${l.id}`} className="nb-hair py-6 first:border-t-0 first:pt-0">
      <p className="nb-slug flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-bold text-ink">
          {l.teacherHandle ? (
            <Link href={`/u/${l.teacherHandle}`} className="nb-link">
              {who(l)}
            </Link>
          ) : (
            who(l)
          )}
        </span>
        <span>asked {when(l.requestedAt)}</span>
        {l.suspendedAt ? (
          <span className="font-bold text-ink">
            suspended {when(l.suspendedAt)}
            {l.suspendedReason ? `: ${l.suspendedReason}` : ""}
          </span>
        ) : null}
      </p>
      <h3 className="mt-2 break-words text-[1.2rem] leading-tight">{l.letterName}</h3>
      <p className="mt-1 text-[0.95rem]">
        <b>{hoursAndMinutes(l.totalMinutes)}</b>{" "}
        <span className="text-graphite">
          across {l.classCount} {l.classCount === 1 ? "class" : "classes"}, {shortDate(l.start)} to {shortDate(l.end)}
        </span>
      </p>

      <div className="nb-scroll mt-3">
        <table className="nb-table min-w-[40rem]">
          <thead>
            <tr>
              <th scope="col">date</th>
              <th scope="col">class</th>
              <th scope="col" className="text-right">
                minutes
              </th>
              <th scope="col">review</th>
            </tr>
          </thead>
          <tbody>
            {l.classes.map((c) => (
              <ClassRow key={c.classId} c={c} />
            ))}
          </tbody>
        </table>
      </div>

      {problems.length ? (
        <div className="nb-note mt-3 max-w-[62ch]">
          <p className="nb-slug">can&rsquo;t be signed as it is</p>
          <ul className="mt-1.5 list-disc pl-5 text-[0.93rem] leading-snug">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <LetterControls id={l.id} label={label} mode="request" canSign={canSign && problems.length === 0} />
    </li>
  );
}

function Issued({ l }: { l: DeskLetter }) {
  return (
    <li className="nb-hair py-5 first:border-t-0 first:pt-0">
      <p className="nb-slug flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-bold text-ink">{who(l)}</span>
        <span>signed {when(l.issuedAt)}</span>
        {l.decidedByHandle ? <span>by @{l.decidedByHandle}</span> : null}
      </p>
      <p className="mt-1.5 break-words text-[1rem] leading-snug">
        <b>{l.letterName}</b>{" "}
        <span className="text-graphite">
          / {hoursAndMinutes(l.totalMinutes)}, {l.classCount} {l.classCount === 1 ? "class" : "classes"},{" "}
          {shortDate(l.start)} to {shortDate(l.end)}
        </span>
      </p>
      {l.code ? (
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.93rem]">
          <Link href={`/letters/${l.code}`} className="nb-link">
            Open {l.code}
          </Link>
          <Link href={`/verify/${l.code}`} className="nb-link">
            Its verify page
          </Link>
        </p>
      ) : null}
      <LetterControls id={l.id} label={`${who(l)}'s letter ${l.code ?? ""}`.trim()} mode="issued" canSign={false} />
    </li>
  );
}

function Closed({ l }: { l: DeskLetter }) {
  const revoked = l.status === "revoked";
  return (
    <li className="nb-hair flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
      <span className="nb-tag">{revoked ? "withdrawn" : "declined"}</span>
      <span className="min-w-0 flex-1 text-[0.95rem] leading-snug">
        <b>{who(l)}</b>{" "}
        <span className="text-graphite">
          / {l.letterName}
          {l.code ? ` / ${l.code}` : ""}
        </span>
        <span className="mt-0.5 block break-words text-[0.88rem] text-graphite">
          {revoked ? l.revokedReason : l.declineReason}
        </span>
      </span>
      <span className="nb-slug shrink-0">{revoked ? when(l.revokedAt) : when(l.requestedAt)}</span>
    </li>
  );
}

function Locked({ message }: { message: string }) {
  return (
    <div className="nb-route nb-wrap flex min-h-[60dvh] items-center justify-center py-20">
      <div className="nb-box nb-tilt-2 w-full max-w-lg p-[clamp(1.4rem,4vw,2.4rem)]">
        <span className="nb-tape -top-3 left-[18%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">access / denied</p>
        <h1 className="mt-3 text-[clamp(1.9rem,1.3rem+2vw,2.8rem)]">This drawer is locked.</h1>
        <p className="mt-4 text-graphite">{message}</p>
        <Link href="/dashboard" className="nb-btn mt-6">
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}

export default async function LettersDeskPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/admin/classes/letters");

  const result = await loadLettersDesk(user);
  if (!result.ok) {
    if (result.code === "forbidden") return <Locked message={result.error} />;
    return (
      <div className="nb-wrap py-16">
        <p className="nb-error">{result.error}</p>
      </div>
    );
  }
  const desk = result.desk;

  return (
    <div className="nb-route pb-24">
      <section className="nb-wrap pt-10 lg:pt-16">
        <p className="nb-slug">
          <Link href="/admin/classes" className="nb-link">
            classes
          </Link>{" "}
          / letters
        </p>
        <p className="nb-marker mt-3">sheet / hours letters</p>
        <h1 className="text-[clamp(2.2rem,1rem+3.4vw,3.4rem)]">Letters to sign, and letters signed.</h1>
        <p className="nb-lede mt-5 max-w-[62ch]">
          Each request lists the approved classes it counts, with links to their reviews. Signing gives the
          letter its code and emails the teacher. A signed letter can be withdrawn later, and its verify page
          then says so.
        </p>
        {!desk.canSign ? (
          <p className="nb-hint mt-3 max-w-[62ch]">
            Only {COORDINATOR.name}, as the safety lead, signs letters, since each one carries his signature. You
            can decline a request or withdraw a signed letter.
          </p>
        ) : null}
      </section>

      <section className="nb-wrap mt-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Waiting to be signed</h2>
          <p className="nb-count shrink-0">
            {desk.requests.length}
            <small>waiting</small>
          </p>
        </div>
        {desk.requests.length === 0 ? (
          <div className="nb-note max-w-[46rem]">
            <p className="nb-slug">desk / clear</p>
            <p className="mt-1.5 text-[0.95rem] leading-snug">
              Nothing is waiting. New requests land here and in the safety lead&rsquo;s inbox.
            </p>
          </div>
        ) : (
          <ul className="max-w-[60rem]">
            {desk.requests.map((l) => (
              <Request key={l.id} l={l} canSign={desk.canSign} />
            ))}
          </ul>
        )}
      </section>

      <section className="nb-wrap mt-14 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
        <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Signed</h2>
        {desk.issued.length === 0 ? (
          <p className="nb-sub mt-3">No letters signed yet.</p>
        ) : (
          <ul className="mt-5 max-w-[60rem]">
            {desk.issued.map((l) => (
              <Issued key={l.id} l={l} />
            ))}
          </ul>
        )}
      </section>

      {desk.closed.length > 0 ? (
        <section className="nb-wrap mt-14 border-t-2 border-ink pt-[clamp(2rem,4vw,3rem)]">
          <h2 className="text-[clamp(1.5rem,1.1rem+1.4vw,2.3rem)]">Declined and withdrawn</h2>
          <p className="nb-sub mt-3">The last {desk.closed.length}, newest first.</p>
          <ul className="mt-5 max-w-[60rem]">
            {desk.closed.map((l) => (
              <Closed key={l.id} l={l} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
