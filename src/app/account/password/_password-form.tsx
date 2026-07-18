"use client";

import * as React from "react";
import { useActionState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { updatePassword, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export function PasswordForm() {
  const reduce = useReducedMotion();
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    updatePassword,
    undefined
  );
  const [show, setShow] = React.useState(false);

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
        <Label htmlFor="password" className="text-sm font-medium text-foreground">
          New password
        </Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="pl-10 pr-11"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            disabled={isPending}
            className={cn(
              "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground",
              "transition-colors hover:text-foreground cursor-pointer",
              "focus-visible:outline-none focus-visible:text-foreground disabled:opacity-50"
            )}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="confirm" className="text-sm font-medium text-foreground">
          Confirm new password
        </Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="confirm"
            name="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Re-enter it"
            className="pl-10"
            disabled={isPending}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Use 8+ characters with a mix of letters and numbers.
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
            Saving…
          </>
        ) : (
          <>
            Set new password
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
