"use client";

import * as React from "react";
import Link from "next/link";
import { PencilLine, X, Check, Loader2, AlertCircle } from "lucide-react";
import { submitContentEdit } from "@/app/actions/content-edits";
import { Button } from "@/components/ui/button";

/**
 * Reader-facing "suggest an edit" control (GitHub-PR-style). Logged-in users
 * open the lesson's raw markdown, edit it, and submit a proposal the admin
 * reviews. Anonymous users are pointed to log in. Renders identically on the
 * server (just the trigger row); the editor panel only mounts on interaction.
 */
export function SuggestEdit({
  contentType = "lesson",
  targetId,
  title,
  path,
  content,
  isLoggedIn,
}: {
  contentType?: "lesson" | "article";
  targetId: string;
  title: string;
  path: string;
  content: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(content);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Lock background scroll while the editor is open.
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await submitContentEdit({
      contentType,
      targetId,
      title,
      path,
      proposedContent: value,
      note: note.trim() || undefined,
    });
    setPending(false);
    if (res.error) setError(res.error);
    else setDone(true);
  }

  const trigger = (
    <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
      <PencilLine className="h-4 w-4 text-primary" aria-hidden />
      <span>Spot an error or something out of date?</span>
      {isLoggedIn ? (
        <button
          type="button"
          onClick={() => {
            setValue(content);
            setNote("");
            setDone(false);
            setError(null);
            setOpen(true);
          }}
          className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          Suggest an edit
        </button>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(path)}`}
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Log in to suggest an edit
        </Link>
      )}
    </div>
  );

  if (!open) return trigger;

  return (
    <>
      {trigger}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={`Suggest an edit to ${title}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !pending) setOpen(false);
        }}
      >
        <div className="ac-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold">Suggest an edit</h2>
              <p className="truncate text-sm text-muted-foreground">{title}</p>
            </div>
            <button
              type="button"
              onClick={() => !pending && setOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="font-display text-xl font-bold">Thanks — suggestion sent</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                An admin will review your change. If it&rsquo;s accepted, it goes live on the site.
              </p>
              <Button variant="brand" onClick={() => setOpen(false)} className="mt-2">
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Edit the lesson (Markdown)
                </label>
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  spellCheck
                  disabled={pending}
                  className="ac-input h-[46vh] w-full resize-none font-mono text-[13px] leading-relaxed"
                />
                <label className="mb-1.5 mt-4 block text-sm font-medium text-foreground">
                  What did you change and why? <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={pending}
                  placeholder="e.g. Kraken X60 mounts with #10-32, not M5"
                  className="ac-input w-full"
                  maxLength={1000}
                />
                {error && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="brand" onClick={submit} disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
                    </>
                  ) : (
                    "Submit suggestion"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
