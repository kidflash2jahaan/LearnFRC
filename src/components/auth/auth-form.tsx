"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  Mail,
  Lock,
  User as UserIcon,
  AtSign,
  Hash,
} from "lucide-react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

type Mode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const reduce = useReducedMotion();
  const isSignup = mode === "signup";
  const action = isSignup ? signUp : signIn;

  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    action,
    undefined
  );

  const [showPassword, setShowPassword] = React.useState(false);

  const nextValue = next && next.startsWith("/") ? next : "";
  const switchHref = isSignup
    ? `/login${nextValue ? `?next=${encodeURIComponent(nextValue)}` : ""}`
    : `/signup${nextValue ? `?next=${encodeURIComponent(nextValue)}` : ""}`;

  // Stagger child fields in
  const fields = isSignup
    ? ["full_name", "email", "username", "team_number", "password"]
    : ["email", "password"];

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
  };
  const item = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
      };

  return (
    <motion.form
      action={formAction}
      initial="hidden"
      animate="show"
      variants={container}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="next" value={nextValue} />

      {/* Error alert */}
      <AnimatePresence initial={false}>
        {state?.error && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }
            }
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

      {isSignup && (
        <motion.div variants={item}>
          <Label htmlFor="full_name">Full name</Label>
          <Field icon={UserIcon}>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              placeholder="Jane Builder"
              className="pl-10"
              disabled={isPending}
            />
          </Field>
        </motion.div>
      )}

      <motion.div variants={item}>
        <Label htmlFor={isSignup ? "email" : "identifier"}>
          {isSignup ? "Email" : "Email or username"}
        </Label>
        <Field icon={isSignup ? Mail : AtSign}>
          <Input
            id={isSignup ? "email" : "identifier"}
            name={isSignup ? "email" : "identifier"}
            type={isSignup ? "email" : "text"}
            inputMode={isSignup ? "email" : undefined}
            autoComplete={isSignup ? "email" : "username"}
            required
            placeholder={isSignup ? "you@team.org" : "you@team.org or janebuilds"}
            className="pl-10"
            disabled={isPending}
          />
        </Field>
      </motion.div>

      {isSignup && (
        <motion.div variants={item} className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="username">Username</Label>
            <Field icon={AtSign}>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                pattern="[A-Za-z0-9_]+"
                placeholder="janebuilds"
                className="pl-10"
                disabled={isPending}
              />
            </Field>
          </div>
          <div>
            <Label htmlFor="team_number">
              Team #{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Field icon={Hash}>
              <Input
                id="team_number"
                name="team_number"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="254"
                className="pl-10"
                disabled={isPending}
              />
            </Field>
          </div>
        </motion.div>
      )}

      <motion.div variants={item}>
        <Label htmlFor="password">Password</Label>
        <Field icon={Lock}>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            placeholder={isSignup ? "At least 8 characters" : "••••••••"}
            className="pl-10 pr-11"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            disabled={isPending}
            className={cn(
              "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground",
              "transition-colors hover:text-foreground cursor-pointer",
              "focus-visible:outline-none focus-visible:text-foreground disabled:opacity-50"
            )}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </Field>
        {isSignup && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Use 8+ characters with a mix of letters and numbers.
          </p>
        )}
      </motion.div>

      <motion.div variants={item} className="pt-1">
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isSignup ? "Creating account…" : "Signing in…"}
            </>
          ) : (
            <>
              {isSignup ? "Create account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </motion.div>

      <motion.p
        variants={item}
        className="pt-1 text-center text-sm text-muted-foreground"
      >
        {isSignup ? "Already have an account?" : "New to LearnFRC?"}{" "}
        <Link
          href={switchHref}
          className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {isSignup ? "Log in" : "Create one free"}
        </Link>
      </motion.p>

      {/* Hidden fields placeholder for stagger key stability */}
      <span className="sr-only" aria-hidden>
        {fields.length}
      </span>
    </motion.form>
  );
}

/** Input wrapper that positions a leading icon and any trailing controls. */
function Field({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      {children}
    </div>
  );
}
