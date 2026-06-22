"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, KeyRound, Loader2, Plus, ArrowRight } from "lucide-react";
import { createTeam, joinTeam } from "@/app/actions/team";
import { Button } from "@/components/ui/button";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/40";

function CreateCard() {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(createTeam, undefined);
  React.useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Plus className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">Create a team</h2>
          <p className="text-xs text-muted-foreground">
            For mentors &amp; leads — you&apos;ll get a code to share.
          </p>
        </div>
      </div>
      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-xs font-medium text-muted-foreground">
            Team name
          </label>
          <input id="name" name="name" required maxLength={80} placeholder="e.g. Sage Hill Robotics" className={inputCls} />
        </div>
        <div>
          <label htmlFor="team_number" className="mb-1 block text-xs font-medium text-muted-foreground">
            FRC team number <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <input id="team_number" name="team_number" inputMode="numeric" placeholder="e.g. 5835" className={inputCls} />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" variant="brand" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Create team
        </Button>
      </form>
    </div>
  );
}

function JoinCard() {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(joinTeam, undefined);
  React.useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">Join a team</h2>
          <p className="text-xs text-muted-foreground">
            Got a code from your mentor? Your progress carries over.
          </p>
        </div>
      </div>
      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="code" className="mb-1 block text-xs font-medium text-muted-foreground">
            Join code
          </label>
          <input
            id="code"
            name="code"
            required
            autoCapitalize="characters"
            placeholder="e.g. 4F9A21"
            className={`${inputCls} font-mono uppercase tracking-widest`}
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" variant="outline" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Join team
        </Button>
      </form>
    </div>
  );
}

export function TeamOnboard() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <CreateCard />
      <JoinCard />
    </div>
  );
}
