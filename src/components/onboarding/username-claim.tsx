"use client";

import * as React from "react";
import { useActionState } from "react";
import { AtSign, Hash, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { claimUsername, type ProfileState } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One-time onboarding card shown on the dashboard when the account has no
 * username (Google sign-ins skip the signup form). Collects the same choices
 * the normal signup form offers — username + optional FRC team number (full
 * name already comes from the Google account) — then does a full reload so
 * the navbar/leaderboard pick the handle up immediately.
 */
export function UsernameClaim({ suggested }: { suggested?: string }) {
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(
    claimUsername,
    undefined
  );

  const done = !!state?.success;
  React.useEffect(() => {
    if (done) window.location.reload();
  }, [done]);
  const busy = isPending || done;

  return (
    <section
      aria-labelledby="username-claim-title"
      className="ac-card p-5 sm:p-6"
      style={{ "--a": "#2560e6" } as React.CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center">
          <AtSign className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2
            id="username-claim-title"
            className="font-display text-[17px] font-bold text-foreground"
          >
            Finish setting up your account
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            You signed in with Google, so you skipped the signup form — pick a
            username (and your team number, if you have one) so you show up
            properly on the leaderboard.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-52">
          <Label htmlFor="claim-username" className="text-sm font-medium text-foreground">
            Username
          </Label>
          <div className="relative mt-1">
            <AtSign
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="claim-username"
              name="username"
              type="text"
              autoComplete="nickname"
              required
              minLength={3}
              pattern="[A-Za-z0-9_]+"
              defaultValue={suggested}
              placeholder="janebuilds"
              className="pl-9"
              disabled={busy}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Public — this is how others see you.
          </p>
        </div>

        <div className="w-32 shrink-0">
          <Label htmlFor="claim-team" className="text-sm font-medium text-foreground">
            Team #{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative mt-1">
            <Hash
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="claim-team"
              name="team_number"
              type="number"
              inputMode="numeric"
              min={1}
              max={99999}
              placeholder="254"
              className="pl-9"
              disabled={busy}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Reps your team.</p>
        </div>

        <Button
          type="submit"
          variant="brand"
          size="md"
          disabled={busy}
          aria-busy={busy}
          className="mb-6"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              Save
              <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </form>

      {state?.error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
    </section>
  );
}
