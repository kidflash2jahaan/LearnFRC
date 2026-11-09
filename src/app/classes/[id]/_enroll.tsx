"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { enrollAction, leaveAction, type ClassFormState } from "@/app/actions/classes";

/**
 * Sign up for a class, and give the seat back (/classes/[id]).
 *
 * Both are Server Actions (src/app/actions/classes.ts) over the shared rules
 * in src/lib/app/classes.ts: eligibility, blocks either way, the bio rule
 * and class_enroll, which locks the class row so two people can't take the
 * last seat. The page re-renders from the server on success (refresh()), so
 * the "you're in" state comes from the database, not from this component.
 */

export function EnrollButton({ classId, waitingParent }: { classId: string; waitingParent: boolean }) {
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(enrollAction, undefined);
  const errorId = React.useId();
  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <input type="hidden" name="classId" value={classId} />
      <button
        type="submit"
        className="nb-btn"
        disabled={pending}
        aria-describedby={state?.error ? errorId : undefined}
      >
        {pending ? "Signing you up..." : "Sign up for this class"}
      </button>
      {waitingParent && !state?.error && (
        <p className="nb-hint max-w-[52ch]">
          You can sign up now. Joining the class waits for your parent or guardian&rsquo;s OK.
        </p>
      )}
      {state?.error && (
        <p id={errorId} className="nb-error max-w-[56ch]" role="alert">
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
    </form>
  );
}

export function LeaveButton({ classId }: { classId: string }) {
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(leaveAction, undefined);
  const [asking, setAsking] = React.useState(false);

  if (!asking) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" className="nb-btn-ghost nb-btn-sm" onClick={() => setAsking(true)}>
          Leave this class
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
      <p className="text-[0.95rem]">Give your seat back? You can sign up again while there&rsquo;s room.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="nb-btn nb-btn-sm" disabled={pending}>
          {pending ? "Leaving..." : "Yes, leave it"}
        </button>
        <button type="button" className="nb-btn-ghost nb-btn-sm" onClick={() => setAsking(false)} disabled={pending}>
          Stay in
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
