"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X, ChevronDown, FilePlus2, Loader2 } from "lucide-react";
import { reviewContentSubmission } from "@/app/actions/content-submissions";
import type { PendingSubmission } from "@/lib/admin";

function SubmissionRow({ sub }: { sub: PendingSubmission }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function decide(decision: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await reviewContentSubmission(sub.id, decision);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="ac-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FilePlus2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate font-display font-semibold text-foreground">{sub.title}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sub.department} · {sub.moduleLabel} · from{" "}
            <span className="font-medium text-foreground">{sub.submitter}</span>
          </p>
          {sub.note && (
            <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-foreground/90">
              “{sub.note}”
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => decide("rejected")}
            disabled={pending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden /> Deny
          </button>
          <button
            type="button"
            onClick={() => decide("accepted")}
            disabled={pending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#12b565] px-3.5 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-105 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            Accept &amp; publish
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        {open ? "Hide content" : "Preview content"}
      </button>

      {open && (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed text-foreground/90">
          {sub.summary ? `${sub.summary}\n\n` : ""}
          {sub.content}
        </pre>
      )}
    </div>
  );
}

export function SubmissionsReview({ submissions }: { submissions: PendingSubmission[] }) {
  if (!submissions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending lesson submissions. When someone contributes a new lesson, it shows up here to
        accept (it becomes a real lesson) or deny.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {submissions.map((s) => (
        <SubmissionRow key={s.id} sub={s} />
      ))}
    </div>
  );
}
