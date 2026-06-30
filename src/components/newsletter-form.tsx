"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { subscribe } from "@/app/actions/subscribe";
import { cn } from "@/lib/utils";

export function NewsletterForm({ className }: { className?: string }) {
  const [state, action, pending] = useActionState(subscribe, undefined);

  if (state?.success) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-2 text-sm text-success",
          className
        )}
      >
        <CheckCircle2 className="h-4 w-4" /> You&apos;re on the list — check your inbox.
      </p>
    );
  }

  return (
    <form action={action} className={cn("w-full max-w-sm", className)}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-1.5 backdrop-blur-sm transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 focus-within:shadow-[var(--glow-primary)]">
        <input
          type="email"
          name="email"
          required
          placeholder="you@team.org"
          aria-label="Email address"
          className="h-9 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 font-mono text-sm font-semibold text-primary-foreground shadow-[var(--glow-primary)] transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Join <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
      {state?.error && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
