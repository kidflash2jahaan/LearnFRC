"use client";

import * as React from "react";
import Link from "next/link";
import { CLASS_NOTICE, CLASS_NOTICE_CHECKBOX } from "@/lib/classes/notice";
import type { ClassRole } from "@/lib/classes/types";

/**
 * The pre-join screen (section 6.5): the class, the recording notice with its
 * required box, the rules in plain words, and the name everyone will see.
 * Everyone sees it on every join, late joiners and rejoiners included, and
 * ticking the box is what makes joinClass write the notice record.
 */

/** Refusals that pressing Join again can't fix; the button is off for them. */
const BLOCKING = new Set([
  "hidden",
  "not_found",
  "canceled",
  "closed",
  "over",
  "not_enrolled",
  "removed",
  "suspended",
  "blocked",
  "eligibility",
  "bio",
  "cap",
  "early",
  "paused",
  "not_configured",
  "not_ready",
]);

const RULES: Record<ClassRole, string[]> = {
  student: [
    "Your mic starts muted. Unmute when you want to ask something.",
    "Student cameras stay off, and nobody can ask you to turn one on.",
    "There's no private messaging. The class chat is for everyone, and it won't send links outside LearnFRC and the docs, @handles, emails, phone numbers or other apps' usernames.",
    "Don't share your age, school, where you live or how to reach you.",
    "If anything feels wrong, press Report someone or Leave. You can leave at any time.",
  ],
  teacher: [
    "Your camera and mic start off. Turn them on when you're ready; your camera is optional.",
    "Say the recording notice out loud when the class starts.",
    "Students wait until you admit them. Class controls let you mute or remove someone, and you can report anyone who breaks the rules.",
    "Your messages go through the same chat filter as everyone's, so share links from LearnFRC or the docs.",
    "Keep to the topic. Never ask anyone's age, school or location, and never ask anyone to turn a camera on.",
  ],
  staff: [
    "You show to everyone as LearnFRC staff.",
    "Your camera and mic start off.",
    "Class controls let you mute or remove someone, or end the class for everyone.",
  ],
};

export type PrejoinProps = {
  title: string;
  teacherUsername: string | null;
  role: ClassRole | null;
  displayName: string | null;
  classId: string;
  joining: boolean;
  /** Why Join was (or would be) refused, if it was. */
  refusal: { reason: string; message: string; opensAt?: string } | null;
  onJoin: (acceptedNotice: boolean) => void;
};

const noSubscribe = () => () => {};

/**
 * A time in the reader's own zone. The server and the first client render
 * say "soon" (the server doesn't know the zone), then the browser's own clock
 * takes over, so there's no hydration mismatch.
 */
function LocalClock({ iso }: { iso: string }) {
  const inBrowser = React.useSyncExternalStore(noSubscribe, () => true, () => false);
  const text = inBrowser ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "soon";
  return <time dateTime={iso}>{text}</time>;
}

export function Prejoin({ title, teacherUsername, role, displayName, classId, joining, refusal, onJoin }: PrejoinProps) {
  const [accepted, setAccepted] = React.useState(false);
  const [opened, setOpened] = React.useState(false);
  const uid = React.useId();
  const boxId = `${uid}-notice`;
  const errorId = `${uid}-error`;

  // An "early" refusal lifts by itself when the room opens.
  React.useEffect(() => {
    if (refusal?.reason !== "early" || !refusal.opensAt) return;
    const ms = Date.parse(refusal.opensAt) - Date.now();
    const t = window.setTimeout(() => setOpened(true), Math.min(Math.max(0, ms), 2 ** 31 - 1));
    return () => window.clearTimeout(t);
  }, [refusal]);

  const blocked = !!refusal && BLOCKING.has(refusal.reason) && !(refusal.reason === "early" && opened);
  const canPress = !blocked && !joining && accepted;

  return (
    <div className="nb-wrap max-w-[46rem] pb-[clamp(3rem,6vw,4.5rem)] pt-[clamp(2rem,4.5vw,3.2rem)]">
      <p className="nb-marker">live class / before you join</p>
      <h1 className="mt-2 text-[clamp(1.9rem,1.2rem+2.4vw,2.8rem)] leading-tight">{title}</h1>
      <p className="nb-sub mt-2">
        {teacherUsername ? <>Taught by @{teacherUsername}</> : "Taught by an FRC student"}
      </p>

      <section className="nb-box mt-6 p-[clamp(1rem,2.6vw,1.6rem)]" aria-labelledby={`${uid}-h`}>
        <h2 id={`${uid}-h`} className="nb-slug">
          recording notice
        </h2>
        {CLASS_NOTICE.map((p) => (
          <p key={p.slice(0, 24)} className="mt-3 text-[0.98rem] leading-relaxed">
            {p}
          </p>
        ))}
        <label htmlFor={boxId} className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-[0.98rem] font-bold leading-snug">
          <input
            id={boxId}
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={joining}
            className="mt-1 size-4 shrink-0"
          />
          <span>{CLASS_NOTICE_CHECKBOX}</span>
        </label>
      </section>

      {role ? (
        <section className="mt-6">
          <h2 className="nb-slug">the rules, in plain words</h2>
          <ul className="nb-list mt-2 grid gap-1.5 text-[0.98rem] leading-snug">
            {RULES[role].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {displayName ? (
        <p className="mt-6 text-[0.98rem]">
          You&rsquo;ll show as <b>{displayName}</b> to everyone in this class.
        </p>
      ) : null}

      <div aria-live="polite">
        {refusal && !(refusal.reason === "early" && opened) ? (
          <div id={errorId} className="nb-note mt-5 max-w-[40rem]">
            <p className="text-[0.95rem] leading-snug">{refusal.message}</p>
            {refusal.reason === "early" && refusal.opensAt ? (
              <p className="nb-hint mt-1">
                The room opens for you at <LocalClock iso={refusal.opensAt} />. This page will let you in then.
              </p>
            ) : null}
            {refusal.reason === "eligibility" ? (
              <Link href="/classes/ready" className="nb-link mt-2 inline-block">
                Finish getting ready for classes
              </Link>
            ) : null}
            {refusal.reason === "bio" ? (
              <Link href="/settings" className="nb-link mt-2 inline-block">
                Edit your bio in Settings
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="nb-btn"
          disabled={!canPress}
          aria-busy={joining}
          aria-describedby={refusal ? errorId : undefined}
          onClick={() => onJoin(accepted)}
        >
          {joining ? "Joining" : "Join class"}
        </button>
        <Link href={`/classes/${classId}`} className="nb-btn-ghost">
          Back to the class page
        </Link>
      </div>
      {!accepted && !blocked ? (
        <p className="nb-hint mt-2">Tick the box above to join.</p>
      ) : null}
    </div>
  );
}
