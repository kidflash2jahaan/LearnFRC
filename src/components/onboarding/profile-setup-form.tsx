"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveProfileSetup, skipProfileSetup } from "@/app/actions/profile";
import type { ProfileState } from "@/app/actions/profile";
import type { ProfileSetupMode } from "@/lib/onboarding";

const SAVE_FORM_ID = "profile-setup-save";

/** The way out. `useFormStatus` reports the nearest ANCESTOR form, so this has
 *  to render inside the skip form rather than merely point at it by id. Drawn
 *  rather than filled, because saving is the thing to do here and only one
 *  button in a view gets to look like the thing to do. */
function SkipButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="nb-btn-ghost"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? "Skipping" : "Skip for now"}
    </button>
  );
}

/**
 * Post-signup profile completion: the correction slip clipped to the dashboard.
 *
 * `username` mode is the Google case: the account has no handle (or a
 * machine-minted placeholder) and usually no team number. `team` mode is the
 * narrower ask for an account whose handle is its own but has no team.
 *
 * `required` is set only when the account has NO handle at all. That case is a
 * hard stop, because email signup cannot create an account without one and
 * Google sign-in should not either: with no handle there is no profile URL and
 * the learner shows up as a bare "Learner" everywhere.
 *
 * A machine-minted placeholder is NOT required. Those accounts work and their
 * profiles open; the person is only carrying a name they did not pick, so this
 * asks and can be dismissed. Hard-gating them would lock out active learners,
 * including the highest-XP account on the site, to force a cosmetic rename.
 *
 * Nothing here gates READING the site. Guides and articles never needed an
 * account and still do not.
 *
 * WHAT THE REBUILD CHANGED. The fields carry their labels above them instead of
 * an at-sign and a hash glyph parked inside the input, which cost 36px of every
 * field to repeat what the label already said. The error moved from the bottom
 * of the card to directly above the fields it is about, so it is next to the
 * thing you have to fix rather than below the buttons. Severity is an ink bar,
 * because the palette has no red and adding one for this would put a seventh
 * colour on the site to say what the sentence already says.
 *
 * Behaviour is untouched: same two server actions, same field names, same
 * validation attributes, and the buttons still sit outside the save form with
 * the save button reaching back by id, because forms cannot nest and the skip
 * button has to own one.
 */
export function ProfileSetupForm({
  mode,
  suggested,
  required = false,
}: {
  mode: ProfileSetupMode;
  suggested?: string;
  /** True only when the account has no handle at all. Hides the skip button. */
  required?: boolean;
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
      className="nb-box p-[clamp(1.05rem,2.2vw,1.5rem)]"
    >
      <span
        className="nb-tape -top-3 left-[8%] rotate-[-3.4deg]"
        aria-hidden="true"
      />

      <p className="nb-slug border-b border-dashed border-rule pb-3">
        {needsUsername ? "profile / no handle yet" : "profile / no team number"}
      </p>

      <h2
        id="profile-setup-title"
        className="mt-4 max-w-[24ch] text-[clamp(1.18rem,1.05rem+0.6vw,1.5rem)]"
      >
        {needsUsername
          ? required
            ? "Pick a username to finish the account."
            : "You're showing up under a name you didn't pick."
          : "Add your team number."}
      </h2>

      <p className="mt-2.5 max-w-[56ch] text-[0.95rem] leading-snug text-graphite">
        {needsUsername
          ? required
            ? "Signing in with Google skips the roster line, so an account can land without a handle. It is your profile link and it is how teammates find you. The team number is optional and can wait."
            : "Your handle was minted for you, so it is not really yours. Pick one you would want next to your name on the leaderboard. The team number is optional."
          : "Put your FRC team number in and you show up alongside your teammates on the team page and on the leaderboard."}
      </p>

      {state?.error && (
        <p className="nb-error mt-4" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}

      <form
        id={SAVE_FORM_ID}
        action={formAction}
        className={
          needsUsername
            ? "mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]"
            : "mt-5 grid gap-4 sm:max-w-[13rem]"
        }
      >
        {needsUsername && (
          <div className="nb-field min-w-0">
            <label htmlFor="setup-username" className="nb-label">
              Username
            </label>
            <input
              id="setup-username"
              name="username"
              type="text"
              // "nickname" so the browser does not autofill the saved login
              // email here. This is a public handle, never an address.
              autoComplete="nickname"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]+"
              defaultValue={suggested}
              disabled={busy}
              className="nb-input"
            />
            <p className="nb-hint">
              Public. Letters, numbers and underscores.
            </p>
          </div>
        )}

        <div className="nb-field min-w-0">
          <label htmlFor="setup-team" className="nb-label">
            {needsUsername ? "Team #, optional" : "Team #"}
          </label>
          <input
            id="setup-team"
            name="team_number"
            type="number"
            inputMode="numeric"
            required={!needsUsername}
            min={1}
            max={99999}
            disabled={busy}
            className="nb-input"
          />
          <p className="nb-hint">Like 254.</p>
        </div>
      </form>

      {/* The actions sit outside the save form so the skip button can own its
          own form. The save button reaches back to it by id. */}
      <div className="nb-hair mt-5 flex flex-wrap items-center gap-3 pt-4">
        <button
          type="submit"
          form={SAVE_FORM_ID}
          className="nb-btn"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Saving" : "Save it"}
        </button>
        {!required && (
          <form action={skipProfileSetup}>
            <SkipButton disabled={busy} />
          </form>
        )}
      </div>
    </section>
  );
}
