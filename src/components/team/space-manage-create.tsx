"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Hash,
  Link2,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { createSpaceAction } from "@/app/actions/team-space";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

const LABEL_CLS =
  "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

const PROGRAMS = [
  { value: "frc", label: "FRC — FIRST Robotics Competition" },
  { value: "ftc", label: "FTC — FIRST Tech Challenge" },
  { value: "fll", label: "FLL — FIRST LEGO League" },
] as const;

/**
 * What a lead can and cannot do, stated before anyone claims anything.
 *
 * This list is the feature's security model written in plain English, and it is
 * on the CREATE screen on purpose: someone who claims a space expecting to
 * manage accounts should find out here, not after they have invited fifteen
 * students. Every line is enforced in Postgres or in src/lib/team-space.ts —
 * none of it is a UI-level promise.
 */
const CAN: string[] = [
  "See which lessons each member has finished, and how far the team has got between you",
  "Share one invite link, and reset it whenever you want",
  "Suggest a subteam for someone to start on",
  "Remove someone from the space",
];

const CANNOT: string[] = [
  "See anyone's real name or email address — usernames only, for everyone",
  "See anything at all about someone who hasn't accepted your link",
  "Change, reset or delete anyone's account, progress, XP or badges",
  "Message anyone through LearnFRC — there is no chat, and no note field anywhere",
];

export function SpaceCreate({
  defaultTeamNumber,
  defaultClaimed,
  eligible,
}: {
  defaultTeamNumber: number | null;
  /** The team number already on this profile is taken. Prefilled guidance only. */
  defaultClaimed: boolean;
  /**
   * The account has completed at least one lesson. An anti-spam speed bump —
   * NOT verification, and never a signal that the creator is an adult.
   */
  eligible: boolean;
}) {
  const reduce = useReducedMotion();
  const [state, formAction, isPending] = useActionState(
    createSpaceAction,
    undefined
  );

  // The number the server refused, or the prefilled number we already know is
  // claimed. Either way the answer is the same: ask your team for the link.
  const takenNumber =
    state?.takenNumber ?? (defaultClaimed ? defaultTeamNumber : null);

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
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="mx-auto max-w-2xl"
    >
      <motion.div variants={item} className="text-center">
        <span className="ac-chip inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="ac-eyebrow">Team space</span>
        </span>
        <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.04] sm:text-5xl">
          Run your team&apos;s{" "}
          <span
            style={{
              background: "linear-gradient(120deg, #2560e6, #1aa9d6)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            training
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
          A team space is one shared link. People you send it to choose whether
          to join, and you see how the training is going across everyone who
          did.
        </p>
      </motion.div>

      {/* ── Not eligible yet ──────────────────────────────────────────── */}
      {!eligible ? (
        <motion.div variants={item} className="mt-8">
          <div className="ac-card p-6 sm:p-7">
            <div className="flex items-start gap-3">
              <span
                className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                style={{ "--a": "#1aa9d6" } as CSSProperties}
              >
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground">
                  Finish one lesson first
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Any lesson, and it takes a couple of minutes. It&apos;s only
                  there to stop throwaway accounts creating spaces in bulk —
                  it&apos;s not a check on who you are, and it doesn&apos;t
                  change what a space can do.
                </p>
                <Link href="/guides" className="ac-btn mt-5 text-sm">
                  Pick a lesson <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ── Already claimed ────────────────────────────────────────── */}
          <AnimatePresence initial={false}>
            {takenNumber != null && (
              <motion.div
                key="taken"
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }
                }
                animate={
                  reduce
                    ? { opacity: 1 }
                    : { opacity: 1, height: "auto", y: 0 }
                }
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <div
                  className="ac-tile mt-8 p-6 sm:p-7"
                  style={{ "--a": "#2560e6" } as CSSProperties}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="ac-badge flex h-11 w-11 shrink-0 items-center justify-center"
                      style={{ "--a": "#2560e6" } as CSSProperties}
                    >
                      <Users className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-foreground">
                        Team {takenNumber} already has a space
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
                        Someone on your team set it up first, so there&apos;s
                        nothing to create — you just need their link. Ask in
                        your team chat for the LearnFRC invite link; anyone
                        already in the space can send it to you, and
                        you&apos;ll get to read exactly what joining shares
                        before you accept.
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                        We don&apos;t show you who set it up, and we
                        can&apos;t hand it over to you.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Error ──────────────────────────────────────────────────── */}
          <AnimatePresence initial={false}>
            {state?.error && state.takenNumber == null && (
              <motion.div
                key="err"
                role="alert"
                aria-live="assertive"
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }
                }
                animate={
                  reduce
                    ? { opacity: 1 }
                    : { opacity: 1, height: "auto", y: 0 }
                }
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                className="overflow-hidden"
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="leading-relaxed">{state.error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── The form ───────────────────────────────────────────────── */}
          <motion.form
            variants={item}
            action={formAction}
            className="ac-glass mt-8 p-6 sm:p-8"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <Label htmlFor="program" className={LABEL_CLS}>
                  Program
                </Label>
                <div className="relative">
                  <select
                    id="program"
                    name="program"
                    defaultValue="frc"
                    disabled={isPending}
                    className={cn(
                      "ac-input h-11 w-full appearance-none pr-9 text-[15px] text-foreground",
                      "cursor-pointer disabled:cursor-not-allowed disabled:opacity-55"
                    )}
                  >
                    {PROGRAMS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
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
              </div>

              <div className="sm:w-44">
                <Label htmlFor="team_number" className={LABEL_CLS}>
                  Team number
                </Label>
                <div className="relative">
                  <Hash
                    className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="team_number"
                    name="team_number"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99999}
                    required
                    placeholder="254"
                    className="h-11 pl-10 tabular-nums"
                    defaultValue={defaultTeamNumber ?? ""}
                    disabled={isPending}
                    aria-describedby="team-help"
                  />
                </div>
              </div>
            </div>

            <p id="team-help" className="mt-3 text-xs text-muted-foreground">
              The space is named <strong>Team {defaultTeamNumber ?? "254"}</strong>{" "}
              automatically from this number. Names can&apos;t be typed or
              changed — nothing anyone writes is ever shown to anyone else here.
            </p>

            <div className="ac-divider my-6" />

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                  You&apos;ll be able to
                </h3>
                <ul className="mt-3 space-y-2">
                  {CAN.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                        aria-hidden
                      />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Lock className="h-4 w-4 text-primary" aria-hidden />
                  You won&apos;t be able to
                </h3>
                <ul className="mt-3 space-y-2">
                  {CANNOT.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span
                        className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                        aria-hidden
                      />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="brand"
                size="lg"
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Creating…
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" aria-hidden />
                    Create the space
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                One space per person. You can delete it at any time.
              </p>
            </div>
          </motion.form>
        </>
      )}
    </motion.div>
  );
}
