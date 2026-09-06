"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import {
  updateProfile,
  deleteAccount,
  type ProfileState,
} from "@/app/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import type { Profile } from "@/lib/types";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "mentor", label: "Mentor" },
  { value: "alum", label: "Alum" },
  { value: "coach", label: "Coach" },
  { value: "other", label: "Other" },
] as const;

const BIO_MAX = 500;

/**
 * The profile form: the one place a member edits their own record.
 *
 * Rebuilt on `nb-field` / `nb-label` / `nb-input` / `nb-hint` directly rather
 * than through the shared Input and Button wrappers, for the same reason
 * ReportForm is: this is the binder's own paperwork, and it should be drawn by
 * the binder's rules instead of inheriting whatever a wrapper decides a
 * "variant" means.
 *
 * Two things are gone on purpose. The staggered entrance, because a settings
 * form that choreographs itself on every load is motion with nothing to say,
 * and it delayed the fields the visit exists to reach. And the icons parked
 * inside each input, because the notebook has no icon language: a label above
 * the field says what the field is, and a pictogram next to it says it again,
 * worse.
 *
 * Everything that talks to the server is untouched: the same action, the same
 * field names, the same validation, the same success toast.
 */
export function SettingsForm({
  profile,
  email,
}: {
  profile: Profile | null;
  email?: string | null;
}) {
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );

  // Preview values for the strip at the top of the form. The inputs stay
  // uncontrolled so a rejected submit keeps what was typed; these only mirror.
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "");
  const [username, setUsername] = React.useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatar_url ?? "");
  const [bioLength, setBioLength] = React.useState(profile?.bio?.length ?? 0);

  // Toast on success, once per successful submit.
  const lastSuccess = React.useRef(false);
  React.useEffect(() => {
    if (state?.success && !lastSuccess.current) {
      lastSuccess.current = true;
      toast.success("Profile saved", {
        description: "Your changes are live across LearnFRC.",
      });
    }
    if (!state?.success) lastSuccess.current = false;
  }, [state?.success]);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-5">
        {/* ---- what the rest of the site will see ---------------------- */}
        <div className="nb-hair flex items-center gap-4 pt-4">
          <Avatar
            name={fullName || username || email}
            src={avatarUrl || null}
            seed={username || email || undefined}
            className="h-14 w-14 shrink-0 text-[1.05rem]"
          />
          <div className="min-w-0">
            <p className="nb-slug">how you appear</p>
            <p className="mt-1 truncate font-semibold">
              {username ? `@${username}` : "no username yet"}
            </p>
          </div>
        </div>

        {/* Server-side validation failure. A stamped correction, not a red
            panel: this palette has no red, and the heavy ink bar carries the
            same weight through a greyscale photocopy. */}
        {state?.error && (
          <p role="alert" aria-live="assertive" className="nb-error">
            {state.error}
          </p>
        )}

        {state?.success && (
          <p role="status" aria-live="polite" className="nb-note">
            <span className="nb-slug">saved</span>
            <span className="mt-1 block text-[0.95rem]">
              Your public profile and presence are up to date.
            </span>
          </p>
        )}

        {/* ---- identity ------------------------------------------------- */}
        <div className="nb-field">
          <label htmlFor="email" className="nb-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email ?? ""}
            readOnly
            disabled
            aria-describedby="email-help"
            className="nb-input"
          />
          <p id="email-help" className="nb-hint">
            Your sign-in email. It can&rsquo;t be changed here.
          </p>
        </div>

        <div className="nb-field">
          <label htmlFor="full_name" className="nb-label">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="Jane Builder"
            defaultValue={profile?.full_name ?? ""}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isPending}
            aria-describedby="full-name-help"
            className="nb-input"
          />
          <p id="full-name-help" className="nb-hint">
            Private. Used only on your certificate, never shown publicly.
            Everyone else sees your username.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="nb-field">
            <label htmlFor="username" className="nb-label">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="janebuilds"
              defaultValue={profile?.username ?? ""}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                )
              }
              aria-describedby="username-help"
              disabled={isPending}
              className="nb-input"
            />
            <p id="username-help" className="nb-hint">
              Letters, numbers and underscores. Your public page is at
              /u/your-name.
            </p>
          </div>

          <div className="nb-field">
            <label htmlFor="team_number" className="nb-label">
              FRC team number
            </label>
            <input
              id="team_number"
              name="team_number"
              type="number"
              inputMode="numeric"
              min={1}
              max={99999}
              placeholder="254"
              defaultValue={profile?.team_number ?? ""}
              aria-describedby="team-help"
              disabled={isPending}
              className="nb-input"
            />
            <p id="team-help" className="nb-hint">
              Optional. It groups you with teammates who entered the same number.
            </p>
          </div>
        </div>

        <div className="nb-field">
          <label htmlFor="role" className="nb-label">
            Role on your team
          </label>
          <select
            id="role"
            name="role"
            defaultValue={profile?.role ?? "student"}
            disabled={isPending}
            className="nb-input nb-select"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="nb-field">
          <label htmlFor="avatar_url" className="nb-label">
            Avatar image URL
          </label>
          <input
            id="avatar_url"
            name="avatar_url"
            type="url"
            inputMode="url"
            placeholder="https://example.com/you.png"
            defaultValue={profile?.avatar_url ?? ""}
            onChange={(e) => setAvatarUrl(e.target.value)}
            aria-describedby="avatar-help"
            disabled={isPending}
            className="nb-input"
          />
          <p id="avatar-help" className="nb-hint">
            Optional. Leave it blank and your initials are used instead.
          </p>
        </div>

        <div className="nb-field">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <label htmlFor="bio" className="nb-label">
              Bio
            </label>
            <span id="bio-count" className="nb-slug tabular-nums">
              {bioLength} / {BIO_MAX}
            </span>
          </div>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={BIO_MAX}
            placeholder="Your role, what you build, what you're learning."
            defaultValue={profile?.bio ?? ""}
            onChange={(e) => setBioLength(e.target.value.length)}
            aria-describedby="bio-count bio-help"
            disabled={isPending}
            className="nb-input"
          />
          <p id="bio-help" className="nb-hint">
            Shown on your public profile.
          </p>
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="nb-btn w-full sm:w-auto"
          >
            {isPending ? "Saving" : "Save changes"}
          </button>
        </div>
      </form>

      <DangerZone />
    </>
  );
}

/**
 * Account deletion. Kept behind a typed confirmation because it takes the
 * profile, the progress, the XP and the bookmarks with it and there is no undo.
 *
 * There is no red in this palette, so severity is carried the way `nb-error`
 * carries it: a heavier ink edge, which survives being photocopied in grey
 * where a hue would not.
 */
function DangerZone() {
  const [confirming, setConfirming] = React.useState(false);
  const [text, setText] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const onDelete = () => {
    startTransition(async () => {
      const r = await deleteAccount();
      // On success the server action signs out and redirects; only errors return.
      if (r?.error) toast.error(r.error);
    });
  };

  return (
    <section
      aria-labelledby="danger"
      className="nb-box mt-10 border-[3px] p-[clamp(1.1rem,2.4vw,1.6rem)]"
    >
      <p className="nb-slug">account / permanent</p>
      <h3 id="danger" className="mt-2">
        Delete this account
      </h3>
      <p className="mt-2 max-w-[56ch] text-[0.95rem] leading-relaxed text-graphite">
        This removes your profile, your progress, your XP and your bookmarks.
        Certificates you have already downloaded stay on your machine, but
        nothing here can be restored.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="nb-btn-ghost mt-5 border-[3px]"
        >
          Delete my account
        </button>
      ) : (
        <div className="nb-hair mt-5 flex flex-col gap-4 pt-5">
          <div className="nb-field max-w-xs">
            <label htmlFor="confirm-delete" className="nb-label">
              Type DELETE to confirm
            </label>
            <input
              id="confirm-delete"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              autoCapitalize="characters"
              disabled={pending}
              className="nb-input font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onDelete}
              disabled={pending || text !== "DELETE"}
              aria-busy={pending}
              className="nb-btn-ghost border-[3px]"
            >
              {pending ? "Deleting" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setText("");
              }}
              disabled={pending}
              className="nb-btn-ghost"
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
