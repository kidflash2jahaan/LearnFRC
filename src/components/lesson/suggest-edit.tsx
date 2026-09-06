"use client";

import * as React from "react";
import Link from "next/link";
import { submitContentEdit } from "@/app/actions/content-edits";
import { Button } from "@/components/ui/button";

/**
 * "This is wrong" as a control the reader can actually use.
 *
 * A signed-in reader opens the page's raw markdown, edits it, and submits a
 * proposal an admin reviews. Everyone else is pointed at signup. The trigger is
 * one ruled line, because it lives at the bottom of the colophon and a second
 * framed box inside a section that is already ruled would be noise; the editor
 * is an `nb-surface`, the system's floating sheet, which is the only thing on
 * the site allowed to sit above the page.
 *
 * The scrim is a flat ink wash, not a blur. Depth in this system comes from a
 * misregistered second impression, never from frosted glass.
 *
 * The panel renders identically on the server (just the trigger row); the editor
 * only mounts on interaction, so the markdown body never ships to a reader who
 * did not ask to edit it.
 */
export function SuggestEdit({
  contentType = "lesson",
  targetId,
  title,
  path,
  content,
  isLoggedIn,
  dense = false,
}: {
  contentType?: "lesson" | "article";
  targetId: string;
  title: string;
  path: string;
  content: string;
  isLoggedIn: boolean;
  /**
   * Tightens the trigger row for use inside the colophon, where the section
   * already supplies the opening rule. Standalone it opens on the 2px ink rule
   * that separates one part of the binder from the next.
   */
  dense?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(content);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const editorRef = React.useRef<HTMLTextAreaElement>(null);
  const returnFocusTo = React.useRef<HTMLElement | null>(null);

  const noun = contentType === "article" ? "article" : "lesson";

  React.useEffect(() => {
    if (!open) return;
    // Lock background scroll while the editor is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Land the caret in the thing they came here to change.
    editorRef.current?.focus();
    // A dialog you cannot dismiss from the keyboard is a trap. Closing is
    // blocked mid-submit for the same reason the buttons are: the write is
    // already in flight and cancelling it here would lie about the outcome.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pending]);

  React.useEffect(() => {
    // Hand focus back where it came from, so closing does not dump a keyboard
    // reader at the top of the document.
    if (!open) returnFocusTo.current?.focus();
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
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${
        dense ? "nb-hair mt-5 pt-4" : "nb-rule mt-[clamp(2rem,4vw,3rem)] pt-4"
      }`}
    >
      <span className="nb-slug">found something wrong?</span>
      {isLoggedIn ? (
        <button
          type="button"
          onClick={(e) => {
            returnFocusTo.current = e.currentTarget;
            setValue(content);
            setNote("");
            setDone(false);
            setError(null);
            setOpen(true);
          }}
          className="nb-slug inline-flex min-h-11 cursor-pointer items-center font-bold text-blue underline decoration-2 underline-offset-4 hover:decoration-blue"
        >
          Suggest an edit
        </button>
      ) : (
        <Link
          href={`/signup?next=${encodeURIComponent(path)}`}
          className="nb-slug inline-flex min-h-11 items-center font-bold text-blue underline decoration-2 underline-offset-4"
        >
          Make a free account to suggest an edit
        </Link>
      )}
    </div>
  );

  if (!open) return trigger;

  return (
    <>
      {trigger}
      {/* z-50 sits under the page grain at z-90, so the sheet gets the same
          toner as everything else rather than looking freshly printed. */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,24,27,0.55)] p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !pending) setOpen(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggest-edit-title"
          className="nb-surface flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden"
        >
          <div className="flex items-start justify-between gap-4 border-b-2 border-ink px-[clamp(1rem,3vw,1.4rem)] py-3.5">
            <div className="min-w-0">
              <h2 id="suggest-edit-title" className="truncate text-[1.15rem]">
                Suggest an edit
              </h2>
              <p className="nb-slug truncate">{title}</p>
            </div>
            <button
              type="button"
              onClick={() => !pending && setOpen(false)}
              disabled={pending}
              className="nb-slug inline-flex min-h-11 shrink-0 cursor-pointer items-center font-bold text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-blue disabled:cursor-not-allowed disabled:text-graphite"
            >
              Close
            </button>
          </div>

          {done ? (
            <div className="px-[clamp(1.2rem,4vw,2.4rem)] py-[clamp(2.4rem,6vw,4rem)] text-center">
              <p className="nb-slug">filed</p>
              <h3 className="mt-1.5 text-[clamp(1.3rem,1.1rem+0.8vw,1.7rem)]">
                Thanks, that is in the queue
              </h3>
              <p className="mx-auto mt-2 max-w-[42ch] text-[0.95rem] leading-relaxed text-graphite">
                An admin reads every suggestion. If yours is right, the change
                goes live and the fix gets written up in the corrections log.
              </p>
              <Button variant="brand" onClick={() => setOpen(false)} className="mt-5">
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="nb-scroll flex-1 overflow-y-auto px-[clamp(1rem,3vw,1.4rem)] py-4">
                <div className="nb-field">
                  <label className="nb-label" htmlFor="suggest-edit-body">
                    The {noun}, in Markdown
                  </label>
                  <textarea
                    id="suggest-edit-body"
                    ref={editorRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    spellCheck
                    disabled={pending}
                    aria-invalid={error ? true : undefined}
                    className="nb-input h-[42dvh] resize-none font-mono text-[0.82rem] leading-relaxed"
                  />
                  <p className="nb-hint">
                    Edit it the way you would edit a shared doc. Only what you
                    change is up for review.
                  </p>
                </div>

                <div className="nb-field mt-5">
                  <label className="nb-label" htmlFor="suggest-edit-note">
                    What did you change, and why? Optional.
                  </label>
                  <input
                    id="suggest-edit-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={pending}
                    placeholder="Kraken X60 mounts with #10-32, not M5"
                    className="nb-input"
                    maxLength={1000}
                  />
                </div>

                {error && (
                  <p role="alert" className="nb-error mt-4">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t-2 border-ink px-[clamp(1rem,3vw,1.4rem)] py-3.5">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="brand" onClick={submit} disabled={pending} aria-busy={pending}>
                  {/* The word carries the pending state. A spinner would be a
                      seventh thing on a page made of ink and paper. */}
                  {pending ? "Sending…" : "Send suggestion"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
