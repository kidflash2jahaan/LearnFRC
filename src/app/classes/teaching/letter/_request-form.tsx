"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { requestLetterAction, type LetterRequestState } from "./_actions";
import { hoursAndMinutes, letterTotals, shortDate } from "@/lib/classes/letter-rules";
import type { HoursLetterClass } from "@/lib/classes/types";

/**
 * The date range, a live preview of what the letter would say, and the one
 * button. The preview filters the same list the server will (every approved
 * class with minutes, already chosen by classesForLetter) by the same
 * Pacific dates, so what you see is what gets sent. The server works it out
 * again from the records when you press the button; this is a preview, not
 * the request.
 */
export function LetterRequestForm({
  classes,
  defaultStart,
  defaultEnd,
  today,
  openRequests,
  maxOpenRequests,
  signerName,
}: {
  classes: HoursLetterClass[];
  defaultStart: string;
  defaultEnd: string;
  today: string;
  openRequests: number;
  maxOpenRequests: number;
  signerName: string;
}) {
  const [state, dispatch, pending] = useActionState<LetterRequestState, FormData>(requestLetterAction, undefined);
  // Controlled, so a refusal doesn't reset the dates (React resets a form
  // after every action dispatch).
  const [start, setStart] = React.useState(defaultStart);
  const [end, setEnd] = React.useState(defaultEnd);

  const uid = React.useId();
  const startId = `${uid}-start`;
  const endId = `${uid}-end`;
  const errorId = `${uid}-error`;

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.message) toast.success(state.message);
  }, [state]);

  const inRange = classes.filter((c) => c.date >= start && c.date <= end);
  const totals = letterTotals(inRange);
  const full = openRequests >= maxOpenRequests;
  const canSend = !pending && !full && inRange.length > 0 && start <= end;

  return (
    <form action={dispatch} className="mt-5">
      <div className="grid max-w-[34rem] gap-4 sm:grid-cols-2">
        <div className="nb-field">
          <label className="nb-label" htmlFor={startId}>
            From
          </label>
          <input
            id={startId}
            type="date"
            name="start"
            required
            max={today}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={pending}
            aria-invalid={state?.field === "start" || undefined}
            aria-describedby={state?.field === "start" ? errorId : undefined}
            className="nb-input"
          />
        </div>
        <div className="nb-field">
          <label className="nb-label" htmlFor={endId}>
            To
          </label>
          <input
            id={endId}
            type="date"
            name="end"
            required
            max={today}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={pending}
            aria-invalid={state?.field === "end" || undefined}
            aria-describedby={state?.field === "end" ? errorId : undefined}
            className="nb-input"
          />
        </div>
      </div>
      <p className="nb-hint mt-2 max-w-[60ch]">
        The school year so far, unless you change it. Dates are Pacific time, like
        every class time in our emails.
      </p>

      <div className="mt-6" aria-live="polite">
        <p className="nb-slug">what the letter would say</p>
        {inRange.length === 0 ? (
          <p className="mt-2 max-w-[60ch] text-[0.95rem] leading-snug text-graphite">
            No approved classes in those dates yet. A class counts once it&rsquo;s
            been reviewed and approved, with at least one student in the room,
            and it goes on one letter only, so classes already on a letter you
            asked for or got aren&rsquo;t counted again.
          </p>
        ) : (
          <>
            <p className="nb-count mt-2 text-[clamp(1.6rem,1.2rem+1.4vw,2.2rem)]">
              {hoursAndMinutes(totals.totalMinutes)}
              <small>
                {" "}
                across {totals.classCount} {totals.classCount === 1 ? "class" : "classes"}
              </small>
            </p>
            <div className="nb-scroll mt-3 max-w-[46rem]">
              <table className="nb-table min-w-[30rem]">
                <thead>
                  <tr>
                    <th scope="col">date</th>
                    <th scope="col">class</th>
                    <th scope="col">topic</th>
                    <th scope="col" className="text-right">
                      minutes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inRange.map((c) => (
                    <tr key={c.classId}>
                      <td className="whitespace-nowrap">{shortDate(c.date)}</td>
                      <td>{c.title}</td>
                      <td className="text-graphite">{c.topic ?? ""}</td>
                      <td className="text-right">{c.minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div aria-live="polite">
        {state?.error ? (
          <p id={errorId} className="nb-error mt-4">
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" disabled={!canSend} aria-busy={pending} className="nb-btn">
          {pending ? "Sending" : "Request the letter"}
        </button>
        <p className="nb-hint max-w-[44ch]">
          {full
            ? `You have ${openRequests} requests waiting. ${signerName} answers them before you can ask again.`
            : `${signerName} reviews it and signs it. Nothing is issued until then.`}
        </p>
      </div>
    </form>
  );
}
