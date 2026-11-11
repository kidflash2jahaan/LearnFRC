"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { saveProfileSetup, skipProfileSetup } from "@/app/actions/profile";
import type { ProfileState } from "@/app/actions/profile";
import type { ProfileSetupMode } from "@/lib/onboarding";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/usernames";
import { SignOutButton } from "@/components/auth/sign-out-button";

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
 * Post-signup profile completion, in two modes.
 *
 * `choose` is the username step on /account/username. Since 2026-11-11 the
 * database gives every account a username, and one that arrives without (a
 * Google sign-in) gets a generated handle like `gearbox_4821`. This step asks
 * once: the field holds that handle (never anything from the email), and the
 * person either saves a name of their own or presses "Keep @handle". Both
 * clear the flag, and the page goes on to `next`. It's required, so there is
 * no skip; signing out is the only other way off it.
 *
 * `team` is the dashboard's skippable card for an account with no team
 * number: putting one in is what shows them alongside their teammates.
 *
 * Nothing here gates READING the site. Guides and articles never needed an
 * account and still do not.
 *
 * The fields carry their labels above them, the error sits directly above the
 * fields it is about, and severity is an ink bar, because the palette has no
 * red. The buttons sit outside the save form and reach back to it by id,
 * because forms cannot nest and the skip button has to own one.
 */
export function ProfileSetupForm({
  mode,
  handle,
  next,
  classesVisible = false,
}: {
  mode: ProfileSetupMode;
  /** `choose`: the generated handle the account has now. */
  handle?: string | null;
  /** `choose`: the same-site path to go to after saving or keeping. */
  next?: string;
  /** `choose`: live classes are open, so the lede says classmates see it too. */
  classesVisible?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(
    saveProfileSetup,
    undefined
  );
  // Which button sent the form, so only that one says it's working.
  const [intent, setIntent] = React.useState<"save" | "keep">("save");
  // Controlled, because React resets a form after every action, even one
  // that comes back refused. Left to their defaults, a refused name (taken,
  // reserved) would snap back to the generated handle, and pressing Save
  // again would quietly keep the handle the person was trying to replace.
  const [username, setUsername] = React.useState(handle ?? "");
  const [teamNumber, setTeamNumber] = React.useState("");

  const choose = mode === "choose";
  const busy = isPending || !!state?.success;

  // The step is done: go where the person was headed. Replace, so Back
  // doesn't land on a step that would only send them on again.
  const destination = state?.next ?? next ?? "/dashboard";
  React.useEffect(() => {
    if (choose && state?.success) router.replace(destination);
  }, [choose, state?.success, destination, router]);

  const fields = (
    <>
      {state?.error && (
        <p className="nb-error mt-4" role="alert" aria-live="assertive">
          {state.error}
        </p>
      )}

      <form
        id={SAVE_FORM_ID}
        action={formAction}
        className={
          choose
            ? "mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]"
            : "mt-5 grid gap-4 sm:max-w-[13rem]"
        }
      >
        {choose && next ? <input type="hidden" name="next" value={next} /> : null}
        {choose && (
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
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={USERNAME_MIN}
              maxLength={USERNAME_MAX}
              pattern="[A-Za-z0-9_]+"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              aria-describedby="setup-username-hint"
              className="nb-input"
            />
            <p id="setup-username-hint" className="nb-hint">
              Letters, numbers and _, 3 to 20 characters. Don&rsquo;t use your
              real name, email or school.
            </p>
          </div>
        )}

        <div className="nb-field min-w-0">
          <label htmlFor="setup-team" className="nb-label">
            {choose ? "Team #, optional" : "Team #"}
          </label>
          <input
            id="setup-team"
            name="team_number"
            type="number"
            inputMode="numeric"
            required={!choose}
            min={1}
            max={99999}
            value={teamNumber}
            onChange={(e) => setTeamNumber(e.target.value)}
            disabled={busy}
            className="nb-input"
          />
          <p className="nb-hint">Like 254.</p>
        </div>
      </form>
    </>
  );

  if (choose) {
    return (
      <div>
        <p className="nb-marker">one thing first</p>
        <h1 id="profile-setup-title" className="text-[clamp(1.9rem,1.3rem+2vw,2.9rem)]">
          Choose your username
        </h1>
        <p className="nb-lede mt-[clamp(0.9rem,2vw,1.3rem)]">
          {handle ? (
            <>
              We gave your account the username{" "}
              <span className="font-semibold text-ink">@{handle}</span> so it
              works right away. Keep it, or pick one of your own.{" "}
            </>
          ) : null}
          It&rsquo;s the name people see on the leaderboard, your profile page
          and your team page.
          {classesVisible ? " In live classes, everyone in the class sees it too." : null}
        </p>

        <section
          aria-labelledby="profile-setup-title"
          className="nb-box mt-[clamp(1.4rem,2.6vw,2rem)] p-[clamp(1.05rem,2.2vw,1.5rem)]"
        >
          <span
            className="nb-tape -top-3 left-[8%] rotate-[-3.4deg]"
            aria-hidden="true"
          />
          <p className="nb-slug border-b border-dashed border-rule pb-3">
            profile / your username
          </p>

          {fields}

          <div className="nb-hair mt-5 flex flex-wrap items-center gap-3 pt-4">
            <button
              type="submit"
              form={SAVE_FORM_ID}
              className="nb-btn"
              disabled={busy}
              aria-busy={busy && intent === "save"}
              onClick={() => setIntent("save")}
            >
              {busy && intent === "save" ? "Saving" : "Save username"}
            </button>
            {handle ? (
              <button
                type="submit"
                form={SAVE_FORM_ID}
                name="keep"
                value="1"
                // Keeping needs nothing typed, so the field's rules don't
                // apply; the server keeps the handle it already has.
                formNoValidate
                className="nb-btn-ghost"
                disabled={busy}
                aria-busy={busy && intent === "keep"}
                onClick={() => setIntent("keep")}
              >
                {busy && intent === "keep" ? "Keeping" : `Keep @${handle}`}
              </button>
            ) : null}
          </div>
        </section>

        <div className="mt-[clamp(1.4rem,2.6vw,2rem)] flex flex-wrap items-center gap-3 text-[0.95rem] text-graphite">
          <span>Not you, or not now?</span>
          <SignOutButton className="nb-btn-sm" />
        </div>
      </div>
    );
  }

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
        profile / no team number
      </p>

      <h2
        id="profile-setup-title"
        className="mt-4 max-w-[24ch] text-[clamp(1.18rem,1.05rem+0.6vw,1.5rem)]"
      >
        Add your team number.
      </h2>

      <p className="mt-2.5 max-w-[56ch] text-[0.95rem] leading-snug text-graphite">
        Put your FRC team number in and you show up alongside your teammates on
        the team page and on the leaderboard.
      </p>

      {fields}

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
        <form action={skipProfileSetup}>
          <SkipButton disabled={busy} />
        </form>
      </div>
    </section>
  );
}
