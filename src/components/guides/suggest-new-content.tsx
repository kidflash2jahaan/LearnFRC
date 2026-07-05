"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, X, Check, Loader2, AlertCircle } from "lucide-react";
import { submitNewContent } from "@/app/actions/content-submissions";
import { Button } from "@/components/ui/button";

/**
 * Community authoring entry point on a department page. Logged-in users propose
 * a whole new lesson (into an existing module or a new one they name); the admin
 * reviews and, on accept, it becomes a real lesson.
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

  React.useEffect(() => {
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
      <Link
        href={loginPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <Plus className="h-4 w-4" aria-hidden /> Log in to contribute a lesson
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDone(false);
          setError(null);
          setOpen(true);
        }}
        className="ac-btn-ghost text-sm"
      >
        <Plus className="h-4 w-4" aria-hidden /> Contribute a lesson
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Contribute a lesson to ${departmentName}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="ac-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold">Contribute a lesson</h2>
                <p className="truncate text-sm text-muted-foreground">{departmentName}</p>
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
                <h3 className="font-display text-xl font-bold">Thanks — lesson submitted</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  An admin will review it. If accepted, it becomes a real lesson in this department.
                </p>
                <Button variant="brand" onClick={() => setOpen(false)} className="mt-2">
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Module</label>
                    <select
                      value={moduleId}
                      onChange={(e) => setModuleId(e.target.value)}
                      disabled={pending}
                      className="ac-input w-full"
                    >
                      {modules.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                      <option value="__new">➕ Propose a new module…</option>
                    </select>
                  </div>
                  {moduleId === "__new" && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">New module name</label>
                      <input
                        value={newModule}
                        onChange={(e) => setNewModule(e.target.value)}
                        disabled={pending}
                        placeholder="e.g. Advanced Swerve Tuning"
                        className="ac-input w-full"
                        maxLength={120}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Lesson title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={pending}
                      placeholder="e.g. Wiring the roboRIO safely"
                      className="ac-input w-full"
                      maxLength={160}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      One-line summary <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      disabled={pending}
                      className="ac-input w-full"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Lesson content (Markdown)</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      disabled={pending}
                      spellCheck
                      placeholder={"## Overview\n\nWrite the lesson here in Markdown…"}
                      className="ac-input h-[34vh] w-full resize-none font-mono text-[13px] leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      Note to the reviewer <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={pending}
                      className="ac-input w-full"
                      maxLength={1000}
                    />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
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
                      "Submit lesson"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
