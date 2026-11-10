"use client";

import * as React from "react";
import { useActionState } from "react";
import { agreeTeacherCode, type TeachFormState } from "@/app/actions/class-teachers";
import { TEACHER_CODE } from "@/lib/classes/notice";

/**
 * A teacher agreeing to a new version of the teacher code. Scheduling waits
 * for it (teachingGate in src/lib/app/class-teachers.ts), and the agreement
 * is kept as a consent record. On success the page revalidates and shows the
 * teacher card instead.
 */
export function CodeAgreeForm({ codeVersion }: { codeVersion: string }) {
  const [state, formAction, isPending] = useActionState<TeachFormState, FormData>(agreeTeacherCode, undefined);
  const [agreed, setAgreed] = React.useState(false);
  return (
    <form action={formAction} className="mt-4">
      <div className="nb-prose">
        <ul>
          {TEACHER_CODE.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
      <label className="mt-3 flex min-h-[2.75rem] cursor-pointer items-center gap-3 text-[0.97rem] font-semibold">
        <input
          type="checkbox"
          name="code"
          value={codeVersion}
          className="size-4 shrink-0"
          checked={agreed}
          disabled={isPending}
          onChange={(e) => setAgreed(e.target.checked)}
          aria-invalid={state?.field === "code" || undefined}
        />
        I&rsquo;ve read the teacher code and agree to it.
      </label>
      {state?.error && (
        <p className="nb-error mt-2" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="nb-hint mt-2" role="status">
          Saved. You can schedule classes again.
        </p>
      )}
      <button type="submit" className="nb-btn nb-btn-sm mt-3" disabled={isPending} aria-busy={isPending}>
        {isPending ? "Saving" : "Agree to the code"}
      </button>
    </form>
  );
}
