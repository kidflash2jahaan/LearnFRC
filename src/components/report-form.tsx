"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Anonymous, no-account report / contact form. POSTs to /api/report-error.
 *
 * This exists because the site had no reachable contact path at all: the domain
 * publishes no MX record, so every `mailto:` bounced, and the only "tell us
 * something is wrong" control on the site asks signed-out readers to create an
 * account first. Nothing here requires one — the email field is optional and
 * exists only so someone who wants an answer can get one.
 *
 * Deliberately plain: no motion hooks (nothing to desync at hydration), no
 * client-side URL sniffing (a value written in after mount would be a hydration
 * mismatch), and all layout on Tailwind utilities — the ac-* classes are skin
 * only.
 */
export function ReportForm({
  kind = "contact",
  pageLabel = "Page it's on",
  pagePlaceholder = "learnfrc.com/guides/… (optional)",
  messageLabel = "What's wrong?",
  messagePlaceholder = "Which page, what it says, and what it should say. A link or rule number helps.",
  submitLabel = "Send",
}: {
  /** Tags the stored row so the admin inbox can tell the two apart. */
  kind?: "error" | "contact";
  pageLabel?: string;
  pagePlaceholder?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  submitLabel?: string;
}) {
  const uid = React.useId();
  const sentRef = React.useRef<HTMLDivElement>(null);
  const [message, setMessage] = React.useState("");
  const [page, setPage] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The form is replaced by the confirmation panel, so keyboard focus would
  // otherwise land back at the top of the document. Move it to the panel — that
  // also guarantees the confirmation is announced, which a freshly-inserted
  // live region does not always do.
  React.useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  const MAX = 4000;
  const msgId = `${uid}-message`;
  const pageId = `${uid}-page`;
  const emailId = `${uid}-email`;
  const emailHintId = `${uid}-email-hint`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/report-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, page, email }),
      });
      // The endpoint always answers with JSON, but a proxy or an offline tab
      // can hand back something else — don't let that surface as a raw crash.
      const data: { ok?: boolean; error?: string } | null = await res
        .json()
        .catch(() => null);
      if (!res.ok) {
        setError(
          data?.error || `Couldn't send that (error ${res.status}). Please try again.`
        );
        return;
      }
      setSent(true);
      setMessage("");
      setPage("");
      setEmail("");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div
        ref={sentRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Sent — thank you.</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/75">
              {kind === "error" ? (
                <>
                  It goes straight to the maintainer&rsquo;s inbox. If a fact
                  turns out to be wrong, the fix gets an entry in the
                  corrections log whether or not you left an address.
                </>
              ) : (
                <>
                  It goes straight to the maintainer&rsquo;s inbox. If you left
                  an email you&rsquo;ll get a reply; if you didn&rsquo;t, the
                  message still gets read.
                </>
              )}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSent(false)}
          className="mt-1"
        >
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor={msgId} className="text-sm font-semibold text-foreground">
            {messageLabel}
          </label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {message.length}/{MAX}
          </span>
        </div>
        <Textarea
          id={msgId}
          name="message"
          required
          minLength={10}
          maxLength={MAX}
          rows={5}
          disabled={pending}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messagePlaceholder}
          className="mt-1.5"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={pageId} className="text-sm font-semibold text-foreground">
            {pageLabel}{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id={pageId}
            name="page"
            type="text"
            inputMode="url"
            maxLength={300}
            disabled={pending}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder={pagePlaceholder}
            className="mt-1.5"
          />
        </div>
        <div>
          <label htmlFor={emailId} className="text-sm font-semibold text-foreground">
            Email <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            disabled={pending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={emailHintId}
            placeholder="you@example.com"
            className="mt-1.5"
          />
          <p id={emailHintId} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Only if you want a reply. Leave it blank to stay anonymous — the
            report counts either way.
          </p>
        </div>
      </div>

      {/* Announced without stealing focus; empty until something goes wrong. */}
      <div aria-live="polite">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden /> {submitLabel}
            </>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          No account needed. Nothing here is published automatically.
        </span>
      </div>
    </form>
  );
}
