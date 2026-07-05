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
  // Editable draft of the submitted content — the admin can tweak it before it
  // becomes a live lesson; what publishes is exactly what's in this box.
  const [draft, setDraft] = React.useState(sub.content);
  const touched = draft !== sub.content;

  function decide(decision: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await reviewContentSubmission(
        sub.id,
        decision,
        decision === "accepted" ? draft : undefined
      );
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
        {open ? "Hide content" : "Review & edit content"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {sub.summary && (
            <p className="rounded-lg bg-secondary/40 px-3 py-2 text-sm text-foreground/80">
              <span className="font-medium text-foreground">Summary:</span> {sub.summary}
            </p>
          )}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Lesson content — edit here to tweak it before you publish
              {touched && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  edited
                </span>
              )}
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              disabled={pending}
              className="h-72 w-full resize-y rounded-xl border border-border bg-card p-3 font-mono text-[12px] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
          </div>
        </div>
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
