"use client";

import * as React from "react";
import Link from "next/link";
import { submitNewContent } from "@/app/actions/content-submissions";

/**
 * Community authoring entry point on a department page. A signed-in reader
 * proposes a whole new lesson, into an existing module or a new one they name;
 * an admin reviews it and, on accept, it becomes a real lesson.
 *
 * The dialog is an `nb-surface`, the one floating sheet in this system: a
 * drawn sheet with an offset ink drop, laid over a flat ink scrim. Not a
 * blurred pane, because nothing here gets depth from a blur.
 *
 * Three things the old dialog was missing and a dialog has to have: Escape
 * closes it, focus moves into it on open and back to the trigger on close, and
 * the heading it is labelled by is the heading you can actually see.
 */
export function SuggestNewContent({
  departmentId,
  departmentName,
  modules,
  isLoggedIn,
  loginPath,
}: {
  departmentId: string;
  departmentName: string;
  modules: { id: string; title: string }[];
  isLoggedIn: boolean;
  loginPath: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [moduleId, setModuleId] = React.useState<string>(modules[0]?.id ?? "__new");
  const [newModule, setNewModule] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [content, setContent] = React.useState("");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const firstFieldRef = React.useRef<HTMLSelectElement>(null);

  /** Everything inside the sheet a keyboard can land on, in document order. */
  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  // Hold the page still behind the sheet, close on Escape, keep Tab inside it,
  // and hand focus in on open and back to the trigger on close. Escape is
  // ignored mid-submit for the same reason the close button is: the request is
  // already in flight.
  //
  // The Tab wrap is not optional decoration. `aria-modal` tells assistive tech
  // the rest of the page is inert, but it does nothing to the tab order, so
  // without this a keyboard user tabs straight out of the dialog and into the
  // department page behind it with no way of knowing they have left.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pending) return;
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = sheet.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;
      const inside = here instanceof Node && sheet.contains(here);

      // Wrapping at both ends, and pulling focus back in if it somehow escaped.
      if (e.shiftKey ? here === first || !inside : here === last || !inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pending]);

  function close() {
    if (pending) return;
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function submit() {
    setPending(true);
    setError(null);
    const res = await submitNewContent({
      departmentId,
      departmentName,
      moduleId: moduleId === "__new" ? undefined : moduleId,
      newModuleTitle: moduleId === "__new" ? newModule : undefined,
      title,
      summary: summary.trim() || undefined,
      content,
      note: note.trim() || undefined,
    });
    setPending(false);
    if (res.error) setError(res.error);
    else setDone(true);
  }

  if (!isLoggedIn) {
    return (
      <Link href={loginPath} className="nb-link">
        Log in to contribute a lesson
      </Link>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setDone(false);
          setError(null);
          setOpen(true);
        }}
        className="nb-btn-ghost nb-btn-sm"
      >
        Contribute a lesson
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,24,27,0.55)] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contribute-heading"
            className="nb-surface flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-5 py-4">
              <div className="min-w-0">
                <h2
                  id="contribute-heading"
                  className="truncate text-[1.15rem] font-extrabold tracking-[-0.025em]"
                >
                  Contribute a lesson
                </h2>
                <p className="nb-slug truncate">dept / {departmentName}</p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="nb-box-sm grid size-11 shrink-0 place-items-center font-mono text-lg leading-none disabled:cursor-not-allowed disabled:text-graphite"
                aria-label="Close"
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <svg
                  viewBox="0 0 40 40"
                  className="size-12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 21.5 15.5 31 34 9"
                    stroke="var(--blue)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 className="text-[1.2rem]">Lesson submitted</h3>
                <p className="max-w-[42ch] text-[0.95rem] text-graphite">
                  An admin reads every submission. If it is accepted it becomes a
                  real lesson in this department, with your name on it.
                </p>
                <button type="button" onClick={close} className="nb-btn mt-2">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
                  <div className="nb-field">
                    <label className="nb-label" htmlFor="contribute-module">
                      Module
                    </label>
                    <select
                      id="contribute-module"
                      ref={firstFieldRef}
                      value={moduleId}
                      onChange={(e) => setModuleId(e.target.value)}
                      disabled={pending}
                      className="nb-input nb-select"
                    >
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                      <option value="__new">Propose a new module</option>
                    </select>
                  </div>

                  {moduleId === "__new" && (
                    <div className="nb-field">
                      <label className="nb-label" htmlFor="contribute-new-module">
                        New module name
                      </label>
                      <input
                        id="contribute-new-module"
                        value={newModule}
                        onChange={(e) => setNewModule(e.target.value)}
                        disabled={pending}
                        placeholder="Advanced swerve tuning"
                        className="nb-input"
                        maxLength={120}
                      />
                    </div>
                  )}

                  <div className="nb-field">
                    <label className="nb-label" htmlFor="contribute-title">
                      Lesson title
                    </label>
                    <input
                      id="contribute-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={pending}
                      placeholder="Wiring the roboRIO safely"
                      className="nb-input"
                      maxLength={160}
                    />
                    <p className="nb-hint">
                      Name the thing someone would search for, not the topic.
                    </p>
                  </div>

                  <div className="nb-field">
                    <label className="nb-label" htmlFor="contribute-summary">
                      One-line summary, optional
                    </label>
                    <input
                      id="contribute-summary"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      disabled={pending}
                      className="nb-input"
                      maxLength={200}
                    />
                  </div>

                  <div className="nb-field">
                    <label className="nb-label" htmlFor="contribute-content">
                      Lesson content
                    </label>
                    <textarea
                      id="contribute-content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      disabled={pending}
                      spellCheck
                      placeholder={"## Overview\n\nWrite the lesson here."}
                      className="nb-input h-[34vh] min-h-[12rem] font-mono text-[0.83rem] leading-relaxed"
                    />
                    <p className="nb-hint">
                      Markdown. Headings, lists, tables and code blocks all render.
                    </p>
                  </div>

                  <div className="nb-field">
                    <label className="nb-label" htmlFor="contribute-note">
                      Note to the reviewer, optional
                    </label>
                    <input
                      id="contribute-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={pending}
                      className="nb-input"
                      maxLength={1000}
                    />
                    <p className="nb-hint">
                      Where the information came from, or what you were unsure about.
                    </p>
                  </div>

                  {error && (
                    <p className="nb-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t-2 border-ink px-5 py-4">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="nb-btn-ghost nb-btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={pending}
                    className="nb-btn nb-btn-sm"
                  >
                    {pending ? "Sending" : "Submit lesson"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
