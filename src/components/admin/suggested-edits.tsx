"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, ChevronDown, PencilLine, ExternalLink, Loader2 } from "lucide-react";
import { reviewContentEdit } from "@/app/actions/content-edits";
import { lineDiff, collapseDiff } from "@/lib/diff";
import type { PendingEdit } from "@/lib/admin";

function Diff({ original, proposed }: { original: string; proposed: string }) {
  const lines = React.useMemo(
    () => collapseDiff(lineDiff(original, proposed)),
    [original, proposed]
  );
  return (
    <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed">
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            l.type === "add"
              ? "whitespace-pre-wrap bg-success/12 text-success"
              : l.type === "del"
                ? "whitespace-pre-wrap bg-destructive/12 text-destructive line-through decoration-destructive/40"
                : "whitespace-pre-wrap text-muted-foreground"
          }
        >
          <span className="mr-2 select-none opacity-50">
            {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
          </span>
          {l.text || " "}
        </div>
      ))}
    </div>
  );
}

function EditRow({ edit }: { edit: PendingEdit }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function decide(decision: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await reviewContentEdit(edit.id, decision);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="ac-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PencilLine className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <Link
              href={edit.lessonPath}
              target="_blank"
              className="truncate font-display font-semibold text-foreground hover:text-primary"
            >
              {edit.lessonTitle}
              <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" aria-hidden />
            </Link>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            from <span className="font-medium text-foreground">{edit.editor}</span>
          </p>
          {edit.note && (
            <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-foreground/90">
              “{edit.note}”
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
            Accept
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
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        {open ? "Hide changes" : "Review changes"}
      </button>

      {open && <Diff original={edit.original} proposed={edit.proposed} />}
    </div>
  );
}

export function SuggestedEdits({ edits }: { edits: PendingEdit[] }) {
  if (!edits.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No pending suggestions. When someone suggests an edit to a lesson, it shows up here for
        you to accept or deny.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {edits.map((e) => (
        <EditRow key={e.id} edit={e} />
      ))}
    </div>
  );
}
