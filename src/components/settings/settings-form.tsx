"use client";

import * as React from "react";
import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  User as UserIcon,
  AtSign,
  Hash,
  Link2,
  BadgeCheck,
  EyeOff,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  updateProfile,
  deleteAccount,
  type ProfileState,
} from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/** Terminal-style field label. */
const LABEL_CLS =
  "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "mentor", label: "Mentor" },
  { value: "alum", label: "Alum" },
  { value: "coach", label: "Coach" },
  { value: "other", label: "Other" },
] as const;

export function SettingsForm({
  profile,
  email,
}: {
  profile: Profile | null;
  email?: string | null;
}) {
  const reduce = useReducedMotion();
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined
  );

  // Live preview values for the avatar header
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "");
  const [username, setUsername] = React.useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatar_url ?? "");
  const [hideName, setHideName] = React.useState(profile?.hide_name ?? false);

  // Toast on success (fires once per successful submit)
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

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce ? { duration: 0 } : { duration: 0.45, ease: EASE },
    },
  };
  const container = {
    hidden: {},
    show: {
      transition: reduce
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: 0.06, delayChildren: 0.04 },
    },
  };

  return (
    <>
    <motion.form
      action={formAction}
      initial="hidden"
      animate="show"
      variants={container}
      className="space-y-5"
    >
      {/* Live avatar preview header */}
      <motion.div
        variants={item}
        className="flex items-center gap-4 rounded-2xl border border-border bg-secondary/40 p-4"
      >
        <Avatar
          name={fullName || username || email}
          src={avatarUrl || null}
          seed={username || email || undefined}
          className="h-16 w-16 ring-2 ring-border shadow-[var(--shadow-md)]"
        />
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">
            {fullName || username || "Your name"}
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {username ? `@${username}` : email || "Set a username below"}
          </div>
        </div>
      </motion.div>

      {/* Error alert */}
      <AnimatePresence initial={false}>
        {state?.error && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
            animate={
              reduce ? { opacity: 1 } : { opacity: 1, height: "auto", y: 0 }
            }
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{state.error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline success confirmation */}
      <AnimatePresence initial={false}>
        {state?.success && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
            animate={
              reduce ? { opacity: 1 } : { opacity: 1, height: "auto", y: 0 }
            }
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-relaxed">
                Saved. Your public profile and presence are now up to date.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email (read-only) */}
      <motion.div variants={item}>
        <Label htmlFor="email" className={LABEL_CLS}>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email ?? ""}
          readOnly
          disabled
          aria-describedby="email-help"
        />
        <p id="email-help" className="mt-1.5 text-xs text-muted-foreground">
          Your sign-in email. This can&apos;t be changed here.
        </p>
      </motion.div>

      {/* Full name */}
      <motion.div variants={item}>
        <Label htmlFor="full_name" className={LABEL_CLS}>
          Full name
        </Label>
        <Field icon={UserIcon}>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder="Jane Builder"
            className="pl-10"
            defaultValue={profile?.full_name ?? ""}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isPending}
          />
        </Field>
      </motion.div>

      {/* Username + Team number */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="username" className={LABEL_CLS}>
            Username
          </Label>
          <Field icon={AtSign}>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="janebuilds"
              className="pl-10"
              defaultValue={profile?.username ?? ""}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                )
              }
              aria-describedby="username-help"
              disabled={isPending}
            />
          </Field>
          <p id="username-help" className="mt-1.5 text-xs text-muted-foreground">
            Letters, numbers &amp; underscores. Powers your public page at
            /u/your-name.
          </p>
        </div>
        <div>
          <Label htmlFor="team_number" className={LABEL_CLS}>
            FRC team number
          </Label>
          <Field icon={Hash}>
            <Input
              id="team_number"
              name="team_number"
              type="number"
              inputMode="numeric"
              min={1}
              max={99999}
              placeholder="254"
              className="pl-10"
              defaultValue={profile?.team_number ?? ""}
              aria-describedby="team-help"
              disabled={isPending}
            />
          </Field>
          <p id="team-help" className="mt-1.5 text-xs text-muted-foreground">
            Optional. Shown as a badge on your profile.
          </p>
        </div>
      </motion.div>

      {/* Role */}
      <motion.div variants={item}>
        <Label htmlFor="role" className={LABEL_CLS}>
          Role on your team
        </Label>
        <div className="relative">
          <BadgeCheck className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            id="role"
            name="role"
            defaultValue={profile?.role ?? "student"}
            disabled={isPending}
            className={cn(
              "flex h-11 w-full appearance-none rounded-xl border border-input bg-background/60 pl-10 pr-9 text-sm",
              "transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </motion.div>

      {/* Avatar URL */}
      <motion.div variants={item}>
        <Label htmlFor="avatar_url" className={LABEL_CLS}>
          Avatar image URL
        </Label>
        <Field icon={Link2}>
          <Input
            id="avatar_url"
            name="avatar_url"
            type="url"
            inputMode="url"
            placeholder="https://example.com/you.png"
            className="pl-10"
            defaultValue={profile?.avatar_url ?? ""}
            onChange={(e) => setAvatarUrl(e.target.value)}
            aria-describedby="avatar-help"
            disabled={isPending}
          />
        </Field>
        <p id="avatar-help" className="mt-1.5 text-xs text-muted-foreground">
          Optional. Leave blank for a colorful generated avatar.
        </p>
      </motion.div>

      {/* Bio */}
      <motion.div variants={item}>
        <Label htmlFor="bio" className={LABEL_CLS}>
          Bio
        </Label>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={500}
          placeholder="Tell the community about your FRC journey — your role, what you build, what you're learning…"
          defaultValue={profile?.bio ?? ""}
          aria-describedby="bio-help"
          disabled={isPending}
        />
        <p id="bio-help" className="mt-1.5 text-xs text-muted-foreground">
          Up to 500 characters. Appears on your public profile.
        </p>
      </motion.div>

      {/* Privacy: hide full name */}
      <motion.div
        variants={item}
        className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/30 p-4"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <EyeOff className="h-4 w-4 text-muted-foreground" /> Hide my full name
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Show your username instead of your real name on the leaderboard and
            your public profile.
          </p>
        </div>
        <input type="hidden" name="hide_name" value={hideName ? "true" : "false"} />
        <button
          type="button"
          role="switch"
          aria-checked={hideName}
          aria-label="Hide my full name"
          onClick={() => setHideName((v) => !v)}
          disabled={isPending}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50",
            hideName ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              hideName ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </motion.div>

      {/* Submit */}
      <motion.div variants={item} className="pt-1">
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full sm:w-auto"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save changes
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>

      <DangerZone />
    </>
  );
}

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
    <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" /> Danger zone
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently delete your account along with your profile, progress, XP,
        and bookmarks. This cannot be undone.
      </p>
      {!confirming ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="h-4 w-4" /> Delete my account
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirming(false);
                setText("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onDelete}
              disabled={pending || text !== "DELETE"}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Permanently delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  icon: IconCmp,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <IconCmp className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}
