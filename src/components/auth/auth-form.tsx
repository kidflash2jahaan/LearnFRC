"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import { GoogleSignInButton } from "@/components/auth/google-button";

type Mode = "login" | "signup";

/**
 * The sign-in sheet, and the roster line you fill in to get on it.
 *
 * One component, two jobs, because the fields and the wiring are the same and
 * only the count differs: two lines to sign in, five to sign up.
 *
 * WHAT THE REBUILD CHANGED, AND WHY
 * ---------------------------------
 * There are no icons in the fields any more. A magnifier-shaped hint inside an
 * input is decoration that costs 40px of the field it sits in, and this system
 * writes what a control is above it in Space Mono instead. Every control is a
 * real `nb-field`: label, control, hint, in that order, with the hint present
 * in the markup rather than hidden in a placeholder.
 *
 * The show/hide password control moved out of the input and up into the label
 * row. Inside the field it was a 44px-wide button with `tabIndex={-1}`, i.e.
 * unreachable by keyboard, sitting on top of the text it reveals. In the label
 * row it is a plain mono toggle with a real focus stop and a real target.
 *
 * Nothing about the submission changed: same two server actions, same
 * `useActionState`, same hidden `next` / `ref` / `via`, same full page load on
 * success.
 */
export function AuthForm({
  mode,
  next,
  referrer,
  via,
  notice,
  defaultEmail,
}: {
  mode: Mode;
  next?: string;
  referrer?: string;
  /** Which share surface produced a referral link (?via=). */
  via?: string;
  notice?: "exists";
  defaultEmail?: string;
}) {
  const isSignup = mode === "signup";
  const action = isSignup ? signUp : signIn;

  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    action,
    undefined
  );

  // On success the action returns redirectTo and we do a FULL page load. A soft
  // client transition would leave the navbar showing "Log in" until the reader
  // manually refreshed.
  const redirecting = !!state?.redirectTo;
  React.useEffect(() => {
    if (state?.redirectTo) window.location.assign(state.redirectTo);
  }, [state?.redirectTo]);
  const busy = isPending || redirecting;

  const [showPassword, setShowPassword] = React.useState(false);

  const nextValue = next && next.startsWith("/") ? next : "";
  const switchHref = isSignup
    ? `/login${nextValue ? `?next=${encodeURIComponent(nextValue)}` : ""}`
    : `/signup${nextValue ? `?next=${encodeURIComponent(nextValue)}` : ""}`;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={nextValue} />
      {isSignup && referrer && <input type="hidden" name="ref" value={referrer} />}
      {/* Which share surface produced the referral. Only meaningful when a
          referrer is present, and the server allow-lists the value. */}
      {isSignup && referrer && via && <input type="hidden" name="via" value={via} />}

      {notice === "exists" && (
        <div className="nb-note" role="status">
          <p className="nb-slug">already on the roster</p>
          <p className="mt-1.5 text-[0.95rem] leading-snug">
            That email already has an account. Sign in below and you&rsquo;re
            straight back where you were.
          </p>
        </div>
      )}

      {state?.error && (
        <p className="nb-error" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}

      <GoogleSignInButton
        next={nextValue}
        referrer={isSignup ? referrer : undefined}
        via={isSignup ? via : undefined}
      />

      {/* A ruled break, the way a form on paper separates two ways of filling
          it in. The word sits in the rule rather than floating above it. */}
      <p className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 border-t border-dashed border-rule" />
        <span className="nb-slug">or write it in</span>
        <span className="h-px flex-1 border-t border-dashed border-rule" />
      </p>

      {isSignup && (
        <div className="nb-field">
          <label htmlFor="full_name" className="nb-label">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            disabled={busy}
            className="nb-input"
          />
          <p className="nb-hint">
            Private. It goes on your certificate and nowhere else, everyone on
            the site sees your username.
          </p>
        </div>
      )}

      <div className="nb-field">
        <label htmlFor={isSignup ? "email" : "identifier"} className="nb-label">
          {isSignup ? "Email" : "Email or username"}
        </label>
        <input
          id={isSignup ? "email" : "identifier"}
          name={isSignup ? "email" : "identifier"}
          type={isSignup ? "email" : "text"}
          inputMode={isSignup ? "email" : undefined}
          autoComplete={isSignup ? "email" : "username"}
          required
          defaultValue={!isSignup ? defaultEmail : undefined}
          disabled={busy}
          className="nb-input"
        />
        {!isSignup && (
          <p className="nb-hint">Either one works, whichever you remember.</p>
        )}
      </div>

      {isSignup && (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="nb-field">
            <label htmlFor="username" className="nb-label">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              // "nickname" (not "username") so browsers don't autofill the
              // saved login email here. This is a public handle, never an email.
              autoComplete="nickname"
              required
              minLength={3}
              pattern="[A-Za-z0-9_]+"
              disabled={busy}
              className="nb-input"
            />
            <p className="nb-hint">
              Public. Letters, numbers and underscores.
            </p>
          </div>
          <div className="nb-field">
            <label htmlFor="team_number" className="nb-label">
              Team #, optional
            </label>
            <input
              id="team_number"
              name="team_number"
              type="number"
              inputMode="numeric"
              min={1}
              disabled={busy}
              className="nb-input"
            />
            <p className="nb-hint">Like 254.</p>
          </div>
        </div>
      )}

      <div className="nb-field">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="nb-label">
            Password
          </label>
          {/* A real button in the flow, not a decoration parked inside the
              field: it takes focus, it has a 44px target, and it says which
              state it is in rather than leaving that to an eye glyph. */}
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            disabled={busy}
            aria-pressed={showPassword}
            aria-controls="password"
            className="nb-navlink"
          >
            {showPassword ? "hide it" : "show it"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={isSignup ? 8 : undefined}
          disabled={busy}
          className="nb-input"
        />
        {isSignup ? (
          <p className="nb-hint">At least 8 characters, letters and numbers.</p>
        ) : (
          <p className="nb-hint">
            Can&rsquo;t place it?{" "}
            <Link href="/forgot-password" className="nb-link">
              Get a reset link
            </Link>
            .
          </p>
        )}
      </div>

      <button
        type="submit"
        className="nb-btn mt-1 w-full"
        disabled={busy}
        aria-busy={isPending}
      >
        {isPending
          ? isSignup
            ? "Creating your account"
            : "Signing you in"
          : isSignup
            ? "Create my account"
            : "Sign in"}
      </button>

      {/* Disclosure at the point of collection. Accounts are enrolled in
          learning-reminder email by default (email_opt_in defaults true), and
          until this line existed nothing on the form said so. A real person
          reported receiving mail he never knowingly opted into. */}
      {isSignup && (
        <p className="nb-hint">
          We&rsquo;ll email you the occasional reminder, your next lesson or a
          streak about to lapse. Every one has a one-click unsubscribe and you
          can switch them off in Settings. Here&rsquo;s the{" "}
          <Link href="/privacy" className="nb-link">
            privacy policy
          </Link>
          .
        </p>
      )}

      <p className="nb-hair pt-4 text-[0.95rem] text-graphite">
        {isSignup ? "Already on the roster? " : "First time here? "}
        <Link href={switchHref} className="nb-link">
          {isSignup ? "Sign in instead" : "Create a free account"}
        </Link>
      </p>
    </form>
  );
}
