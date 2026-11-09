"use client";

import * as React from "react";
import { useActionState } from "react";
import { submitAgeCheck, type ConsentFormState } from "@/app/actions/class-consent";
import { MONTH_NAMES, monthYearLabel } from "@/lib/classes/consent-rules";

/**
 * The one question (classes-design.md section 5): "What's your birth month
 * and year?"
 *
 * Neutral on purpose. Both selects start empty with no default, there's no
 * "I'm over 12" box, and nothing here says what any answer leads to. Then a
 * confirm step for every answer ("You picked March 2011. Is that right?"),
 * because the answer is saved once and this is the only chance to fix a
 * slip. Only the confirm step's Yes sends `confirmed=yes`, and the server
 * refuses an answer without it.
 *
 * The selects are controlled, so "Change it" comes back with the same picks.
 * Years come from the server (this year back 100), so the list can't differ
 * between the server render and the browser around New Year.
 */
export function AgeForm({ years }: { years: number[] }) {
  const [state, formAction, isPending] = useActionState<ConsentFormState, FormData>(
    submitAgeCheck,
    undefined
  );
  const [month, setMonth] = React.useState("");
  const [year, setYear] = React.useState("");
  const [step, setStep] = React.useState<"pick" | "confirm">("pick");
  const [missing, setMissing] = React.useState(false);
  const monthRef = React.useRef<HTMLSelectElement>(null);
  const yearRef = React.useRef<HTMLSelectElement>(null);
  const confirmRef = React.useRef<HTMLParagraphElement>(null);
  const backToPick = React.useRef(false);
  const uid = React.useId();

  React.useEffect(() => {
    if (step === "confirm") confirmRef.current?.focus();
    else if (backToPick.current) monthRef.current?.focus();
  }, [step]);

  function toConfirm() {
    if (!month || !year) {
      setMissing(true);
      (month ? yearRef : monthRef).current?.focus();
      return;
    }
    setMissing(false);
    setStep("confirm");
  }

  function changeIt() {
    backToPick.current = true;
    setStep("pick");
  }

  const monthId = `${uid}-month`;
  const yearId = `${uid}-year`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;

  return (
    <form action={formAction} noValidate>
      {step === "pick" ? (
        <fieldset aria-describedby={`${hintId}${missing ? ` ${errorId}` : ""}`}>
          <legend className="text-[clamp(1.15rem,1rem+0.6vw,1.4rem)] font-bold">
            What&rsquo;s your birth month and year?
          </legend>
          <p id={hintId} className="mt-2 max-w-[54ch] text-[0.99rem] leading-relaxed text-graphite">
            We ask once, so we know whether a parent or guardian needs to say OK.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="nb-field">
              <label htmlFor={monthId} className="nb-label">
                Month
              </label>
              <select
                id={monthId}
                ref={monthRef}
                className="nb-input nb-select"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-invalid={(missing && !month) || undefined}
              >
                <option value="" disabled>
                  Pick a month
                </option>
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="nb-field">
              <label htmlFor={yearId} className="nb-label">
                Year
              </label>
              <select
                id={yearId}
                ref={yearRef}
                className="nb-input nb-select"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-invalid={(missing && !year) || undefined}
              >
                <option value="" disabled>
                  Pick a year
                </option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {missing && (
            <p id={errorId} className="nb-error mt-4" role="alert">
              Pick a month and a year.
            </p>
          )}

          <button type="button" className="nb-btn mt-6" onClick={toConfirm}>
            Continue
          </button>
        </fieldset>
      ) : (
        <div>
          <input type="hidden" name="birth_month" value={month} />
          <input type="hidden" name="birth_year" value={year} />
          <p
            ref={confirmRef}
            tabIndex={-1}
            className="text-[clamp(1.15rem,1rem+0.6vw,1.4rem)] font-bold outline-none"
          >
            You picked {monthYearLabel(Number(month), Number(year))}. Is that right?
          </p>

          {state?.error && (
            <p className="nb-error mt-4" role="alert" aria-live="assertive">
              {state.error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              name="confirmed"
              value="yes"
              className="nb-btn"
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? "Saving" : "Yes"}
            </button>
            <button type="button" className="nb-btn-ghost" onClick={changeIt} disabled={isPending}>
              Change it
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
