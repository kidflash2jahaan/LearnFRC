"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { scheduleAction, type ClassFormState } from "@/app/actions/classes";
import { useHydrated } from "@/components/classes/local-time";
import { CLASS_LIMITS } from "@/lib/classes/constants";
import type { TopicGroup } from "@/lib/app/classes-teaching";

/**
 * The schedule form on /classes/teaching (classes-design.md section 11):
 * topic, title, description, local date and time, length and seats.
 *
 * The date and time are typed in the teacher's own zone (a datetime-local
 * input, which has no zone), and the browser turns them into an exact
 * instant for the hidden `startsAt` field, so the server never guesses a
 * zone. Every rule is the server's (scheduleClass in
 * src/lib/app/classes-teaching.ts); this form only says what it sends.
 *
 * EVERY FIELD IS CONTROLLED, for the same reason as the apply form: React
 * resets a <form action> after every dispatch, and a refusal (too soon, an
 * overlap, a link in the description) must not empty what the teacher typed.
 * A success clears it.
 */

const LENGTHS = [15, 20, 30, 45, 60, 75, 90].filter(
  (m) => m >= CLASS_LIMITS.minDurationMinutes && m <= CLASS_LIMITS.maxDurationMinutes
);
const SEATS = Array.from(
  { length: CLASS_LIMITS.maxCapacity - CLASS_LIMITS.minCapacity + 1 },
  (_, i) => CLASS_LIMITS.minCapacity + i
);

/** A datetime-local value ("2026-11-20T17:00") as an exact instant, or "". */
function toInstant(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function ScheduleForm({ topics, allowSoon }: { topics: TopicGroup[]; allowSoon: boolean }) {
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(scheduleAction, undefined);
  const hydrated = useHydrated();
  const uid = React.useId();

  const [topic, setTopic] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [local, setLocal] = React.useState("");
  const [duration, setDuration] = React.useState("60");
  const [capacity, setCapacity] = React.useState(String(CLASS_LIMITS.defaultCapacity));

  // A success clears the form for the next class. Tracked by the state
  // object itself, so each success clears once.
  const [cleared, setCleared] = React.useState<ClassFormState>(undefined);
  if (state?.ok && state !== cleared) {
    setCleared(state);
    setTopic("");
    setTitle("");
    setDescription("");
    setLocal("");
    setDuration("60");
    setCapacity(String(CLASS_LIMITS.defaultCapacity));
  }

  const zone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;
  const bad = (f: string) => (state?.error && state.field === f ? true : undefined);
  const id = (f: string) => `${uid}-${f}`;
  const errorId = `${uid}-error`;
  const described = (f: string, hint?: string) =>
    [hint, bad(f) ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="nb-field">
        <label htmlFor={id("topic")} className="nb-label">
          What it teaches
        </label>
        <select
          id={id("topic")}
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={pending}
          aria-invalid={bad("topic")}
          aria-describedby={described("topic", `${id("topic")}-hint`)}
          className="nb-input nb-select"
        >
          <option value="">Pick a lesson or a whole module</option>
          {topics.flatMap((d) =>
            d.modules.map((m) => (
              <optgroup key={m.id} label={`${d.department} / ${m.title}`}>
                <option value={`module:${m.id}`}>The whole module: {m.title}</option>
                {m.lessons.map((l) => (
                  <option key={l.id} value={`lesson:${l.id}`}>
                    {l.title}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>
        <p id={`${id("topic")}-hint`} className="nb-hint">
          Students see it linked from the class, so they can read ahead.
        </p>
      </div>

      <div className="nb-field">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <label htmlFor={id("title")} className="nb-label">
            Title
          </label>
          <span className="nb-slug tabular-nums">
            {title.trim().length} / {CLASS_LIMITS.titleMax}
          </span>
        </div>
        <input
          id={id("title")}
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={CLASS_LIMITS.titleMax}
          disabled={pending}
          placeholder="Wiring a CAN bus, start to finish"
          aria-invalid={bad("title")}
          aria-describedby={described("title")}
          className="nb-input"
        />
      </div>

      <div className="nb-field">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <label htmlFor={id("description")} className="nb-label">
            Description, optional
          </label>
          <span className="nb-slug tabular-nums">
            {description.length} / {CLASS_LIMITS.descriptionMax}
          </span>
        </div>
        <textarea
          id={id("description")}
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={CLASS_LIMITS.descriptionMax}
          disabled={pending}
          placeholder="What you'll cover and what to bring. Links to LearnFRC and the docs are fine."
          aria-invalid={bad("description")}
          aria-describedby={described("description", `${id("description")}-hint`)}
          className="nb-input"
        />
        <p id={`${id("description")}-hint`} className="nb-hint">
          No contact details: no other links, @handles, emails, phone numbers or other apps&rsquo;
          usernames.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="nb-field">
          <label htmlFor={id("when")} className="nb-label">
            Starts
          </label>
          <input
            id={id("when")}
            type="datetime-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            disabled={pending}
            aria-invalid={bad("startsAt")}
            aria-describedby={described("startsAt", `${id("when")}-hint`)}
            className="nb-input"
          />
          <input type="hidden" name="startsAt" value={toInstant(local)} />
          <p id={`${id("when")}-hint`} className="nb-hint">
            {allowSoon ? "Dev server: any time from now" : "2 hours to 30 days from now"}
            {zone ? `, in your time zone (${zone})` : ", in your time zone"}.
          </p>
        </div>

        <div className="nb-field">
          <label htmlFor={id("length")} className="nb-label">
            Length
          </label>
          <select
            id={id("length")}
            name="durationMinutes"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={pending}
            aria-invalid={bad("durationMinutes")}
            aria-describedby={described("durationMinutes")}
            className="nb-input nb-select"
          >
            {LENGTHS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>

        <div className="nb-field">
          <label htmlFor={id("seats")} className="nb-label">
            Seats
          </label>
          <select
            id={id("seats")}
            name="capacity"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            disabled={pending}
            aria-invalid={bad("capacity")}
            aria-describedby={described("capacity")}
            className="nb-input nb-select"
          >
            {SEATS.map((n) => (
              <option key={n} value={n}>
                {n} students
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.error && (
        <p id={errorId} className="nb-error max-w-[64ch]" role="alert">
          {state.error}
          {state.field === "bio" && (
            <>
              {" "}
              <Link href="/settings" className="nb-link">
                Edit your bio
              </Link>
            </>
          )}
        </p>
      )}
      {state?.ok && (
        <p className="nb-note max-w-[64ch]" role="status">
          {state.message}{" "}
          {state.classId && (
            <Link href={`/classes/${state.classId}`} className="nb-link">
              Open its page
            </Link>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <button type="submit" className="nb-btn" disabled={pending}>
          {pending ? "Scheduling..." : "Schedule the class"}
        </button>
        <span className="nb-hint">It&rsquo;s listed for students as soon as it&rsquo;s saved.</span>
      </div>
    </form>
  );
}
