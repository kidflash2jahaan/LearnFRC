"use client";

import * as React from "react";
import { useActionState } from "react";
import { cancelClassAction, type ClassFormState } from "@/app/actions/classes";

/**
 * Cancel one upcoming class, with a confirm step, because it can't be undone
 * and every student who signed up gets an email (cancelClass in
 * src/lib/app/classes-teaching.ts).
 */
export function CancelClassButton({ classId, enrolled }: { classId: string; enrolled: number }) {
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(cancelClassAction, undefined);
  const [asking, setAsking] = React.useState(false);

  if (!asking) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" className="nb-btn-ghost nb-btn-sm" onClick={() => setAsking(true)}>
          Cancel class
        </button>
        {state?.error && (
          <p className="nb-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    );
  }
  return (
    <form action={formAction} className="nb-note flex max-w-[44ch] flex-col gap-3">
      <input type="hidden" name="classId" value={classId} />
      <p className="text-[0.95rem]">
        Cancel it for good?{" "}
        {enrolled > 0
          ? `The ${enrolled} ${enrolled === 1 ? "student" : "students"} who signed up get an email.`
          : "Nobody has signed up yet."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="nb-btn nb-btn-sm" disabled={pending}>
          {pending ? "Canceling..." : "Yes, cancel it"}
        </button>
        <button type="button" className="nb-btn-ghost nb-btn-sm" onClick={() => setAsking(false)} disabled={pending}>
          Keep it
        </button>
      </div>
      {state?.error && (
        <p className="nb-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
