"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AtSign, Hash, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { saveProfileSetup, skipProfileSetup } from "@/app/actions/profile";
import type { ProfileState } from "@/app/actions/profile";
import type { ProfileSetupMode } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SAVE_FORM_ID = "profile-setup-save";

/** Ghost "skip" control. `useFormStatus` reports the nearest ANCESTOR form, so
 *  this must render inside the skip form — not merely point at it. */
function SkipButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="md"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        "Skip for now"
      )}
    </Button>
  );
}

/**
 * Post-signup profile completion, shown on the dashboard.
 *
 * `username` mode is the Google case: the account has no handle (or a
 * machine-minted placeholder) and usually no team number. `team` mode is the
 * narrower ask for an account whose handle is its own but has no team.
 *
 * Always skippable — nothing here gates reading the site.
 */
export function ProfileSetupForm({
  mode,
  suggested,
}: {
  mode: ProfileSetupMode;
  suggested?: string;
}) {
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(
    saveProfileSetup,
    undefined
  );

  const needsUsername = mode === "username";
  const busy = isPending || !!state?.success;

  return (
    <section
      aria-labelledby="profile-setup-title"
      className="ac-card p-5 sm:p-6"
      style={{ "--a": "#2560e6" } as React.CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center">
          {needsUsername ? (
            <AtSign className="h-5 w-5" aria-hidden />
          ) : (
            <Hash className="h-5 w-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <h2
            id="profile-setup-title"
            className="font-display text-[17px] font-bold text-foreground"
          >
            {needsUsername
              ? "Finish setting up your account"
              : "Add your team number"}
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {needsUsername
              ? "You signed in with Google, so you skipped the signup form — pick a username and add your team number so your teammates can find you."
              : "Add your FRC team number so you show up alongside your teammates on the leaderboard and team pages."}
          </p>
        </div>
      </div>

      <form
        id={SAVE_FORM_ID}
        action={formAction}
        className={
          needsUsername
            ? "mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]"
            : "mt-4 grid gap-3 sm:max-w-[9rem]"
        }
      >
        {needsUsername && (
          <div className="min-w-0">
            <Label
              htmlFor="setup-username"
              className="text-sm font-medium text-foreground"
            >
              Username
            </Label>
            <div className="relative mt-1">
              <AtSign
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="setup-username"
                name="username"
                type="text"
                autoComplete="nickname"
                required
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_]+"
                defaultValue={suggested}
                placeholder="janebuilds"
                className="pl-9"
                disabled={busy}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Public — letters, numbers and underscores.
            </p>
          </div>
        )}

        <div className="min-w-0">
          <Label
            htmlFor="setup-team"
            className="text-sm font-medium text-foreground"
          >
            Team #{" "}
            {needsUsername && (
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            )}
          </Label>
          <div className="relative mt-1">
            <Hash
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="setup-team"
              name="team_number"
              type="number"
              inputMode="numeric"
              required={!needsUsername}
              min={1}
              max={99999}
              placeholder="254"
              className="pl-9"
              disabled={busy}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Reps your team.</p>
        </div>
      </form>

      {/* Actions sit outside the save form so the skip button can own its own
          form (forms cannot nest). The save button reaches back by id. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          form={SAVE_FORM_ID}
          variant="brand"
          size="md"
          disabled={busy}
          aria-busy={busy}
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
        <form action={skipProfileSetup}>
          <SkipButton disabled={busy} />
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
