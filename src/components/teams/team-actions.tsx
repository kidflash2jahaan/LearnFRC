"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, LogOut, Link2, Loader2 } from "lucide-react";
import { regenerateCode, leaveTeam } from "@/app/actions/team";
import { Button } from "@/components/ui/button";

export function JoinCodeCard({ code, teamId }: { code: string; teamId: string }) {
  const router = useRouter();
  const [copied, setCopied] = React.useState<"code" | "link" | null>(null);
  const [state, action, pending] = React.useActionState(regenerateCode, undefined);

  React.useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  const copy = async (what: "code" | "link") => {
    const text =
      what === "code"
        ? code
        : `${typeof window !== "undefined" ? window.location.origin : ""}/join/${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <h2 className="text-sm font-semibold text-muted-foreground">Invite your team</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Share this code or link. It works for new members and anyone who already has an account.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
        <span className="font-mono text-2xl font-bold tracking-[0.3em]">{code}</span>
        <button
          onClick={() => copy("code")}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          {copied === "code" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "code" ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => copy("link")}>
          {copied === "link" ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
          {copied === "link" ? "Link copied" : "Copy invite link"}
        </Button>
        <form action={action}>
          <input type="hidden" name="team_id" value={teamId} />
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            New code
          </Button>
        </form>
      </div>
      {state?.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
    </div>
  );
}

export function LeaveTeamButton({ owner }: { owner: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const onLeave = () => {
    const msg = owner
      ? "You own this team. Leaving will remove you from it (the team and its members stay). Continue?"
      : "Leave this team? Your account and progress stay — you'll just be removed from the roster.";
    if (!window.confirm(msg)) return;
    start(async () => {
      const res = await leaveTeam();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onLeave} disabled={pending} className="text-muted-foreground hover:text-destructive">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Leave team
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
