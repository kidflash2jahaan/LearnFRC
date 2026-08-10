"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { declineInviteAction, joinTeamSpaceAction, type JoinState } from "./actions";

/**
 * The consent control itself.
 *
 * There is exactly one way to become a member of a team space, and it is this
 * button. Opening the link, scanning the QR, signing up, coming back through
 * Google — none of those join anyone to anything. The POST that does it carries
 * Next's Server Action origin check, so it cannot be fired by a link, an image
 * tag or a form on someone else's site.
 *
 * The token is a hidden field rather than a bound argument only because it is
 * already in the URL bar; it confers nothing on its own. Authority is re-derived
 * server-side from auth.getUser() inside acceptInvite(), never from this form.
 */
export function JoinForm({
  token,
  teamName,
}: {
  token: string;
  /** Derived server-side (`Team 447`). Never a string anybody typed. */
  teamName: string;
}) {
  const [state, formAction, isPending] = useActionState<JoinState, FormData>(
    joinTeamSpaceAction,
    undefined
  );

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="token" value={token} />

      {state?.error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-foreground"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <span className="leading-relaxed">{state.error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="ac-btn flex w-full items-center justify-center gap-2 text-sm sm:flex-1"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          )}
          Yes — join {teamName}
        </button>

        <button
          type="submit"
          formAction={declineInviteAction}
          disabled={isPending}
          className="ac-btn-ghost flex w-full items-center justify-center text-sm sm:w-auto sm:shrink-0"
        >
          No thanks
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground sm:text-left">
        Nothing is shared until you press join.
      </p>
    </form>
  );
}
