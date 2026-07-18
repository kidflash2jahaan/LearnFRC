"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AtSign,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MailCheck,
} from "lucide-react";
import { requestPasswordReset, type ResetState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export function ForgotForm({ defaultEmail }: { defaultEmail?: string }) {
  const reduce = useReducedMotion();
  const [state, formAction, isPending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    undefined
  );

  // Success: we always report success (anti-enumeration), so show the same
  // "check your inbox" screen whether or not the address is registered.
  if (state?.success) {
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="text-center"
      >
        <span
          className="ac-badge mx-auto flex h-12 w-12 items-center justify-center"
          style={{ ["--a" as string]: "#12a150" }}
        >
          <MailCheck className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold">Check your inbox</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          If an account exists for that email, a password-reset link is on its
          way. It expires in an hour — open it on any device to choose a new
          password.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Not seeing it? Check your spam folder.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to login
        </Link>
      </motion.div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
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

      <div>
        <Label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </Label>
        <div className="relative">
          <AtSign
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={defaultEmail}
            placeholder="you@team.org"
            className="pl-10"
            disabled={isPending}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Enter the email you signed up with — we&rsquo;ll send a reset link.
        </p>
      </div>

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
            Sending link…
          </>
        ) : (
          <>
            Send reset link
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <p className="pt-1 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
        >
          Back to login
        </Link>
      </p>
    </form>
  );
}
