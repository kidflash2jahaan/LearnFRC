"use client";

import * as React from "react";
import { useActionState } from "react";
import { AtSign, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { claimUsername, type ProfileState } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One-time onboarding card shown on the dashboard when the account has no
 * username (Google sign-ins skip the signup form). Claims the handle inline,
 * then does a full reload so the navbar/leaderboard pick it up immediately.
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center">
            <AtSign className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="username-claim-title"
              className="font-display text-[17px] font-bold text-foreground"
            >
              Pick your username
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              You signed in with Google, so you don&apos;t have a handle yet —
              without one you show up as &ldquo;Learner&rdquo; on the
              leaderboard.
            </p>
          </div>
        </div>

        <form action={formAction} className="flex w-full shrink-0 items-start gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-56">
            <Label htmlFor="claim-username" className="sr-only">
              Username
            </Label>
            <div className="relative">
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
          </div>
          <Button type="submit" variant="brand" size="md" disabled={busy} aria-busy={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <>
                Claim
                <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </Button>
        </form>
      </div>

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
