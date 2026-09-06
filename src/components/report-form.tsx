"use client";

import * as React from "react";

/**
 * Anonymous, no-account report / contact form. POSTs to /api/report-error.
 *
 * This exists because the site had no reachable contact path at all: the domain
 * publishes no MX record, so every `mailto:` bounced, and the only "tell us
 * something is wrong" control on the site asks signed-out readers to create an
 * account first. Nothing here requires one — the email field is optional and
 * exists only so someone who wants an answer can get one.
 *
 * Deliberately plain: no motion (nothing to desync at hydration) and no
 * client-side URL sniffing (a value written in after mount would be a hydration
 * mismatch). It is now built out of `.nb-field` / `.nb-input` / `.nb-btn`
 * directly rather than through the shared Input/Button wrappers, so this form
 * is drawn by the same rules as everything else in the binder and does not
 * inherit whatever a wrapper decides a "variant" means.
 *
 * The submit logic, the focus move on success and the ARIA are unchanged.
 */
export function ReportForm({
  kind = "contact",
  pageLabel = "Page it's on",
  pagePlaceholder = "learnfrc.com/guides/…",
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
  const msgCountId = `${uid}-message-count`;
  const pageId = `${uid}-page`;
  const emailId = `${uid}-email`;
  const emailHintId = `${uid}-email-hint`;
  const errorId = `${uid}-error`;

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
        className="nb-box nb-tilt-4 p-[clamp(1.1rem,2.4vw,1.6rem)]"
      >
        <span className="nb-tape -top-3 left-[30%] rotate-[-3.2deg]" aria-hidden="true" />
        <p className="nb-slug">sent / logged</p>
        <p className="mt-2 font-semibold">Thank you. It arrived.</p>
        <p className="mt-2 max-w-[52ch] text-[0.95rem] leading-relaxed text-graphite">
          {kind === "error" ? (
            <>
              It goes straight to the maintainer&rsquo;s inbox. If a fact turns
              out to be wrong, the fix gets an entry in the corrections log
              whether or not you left an address.
            </>
          ) : (
            <>
              It goes straight to the maintainer&rsquo;s inbox. If you left an
              email you&rsquo;ll get a reply. If you didn&rsquo;t, the message
              still gets read.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="nb-btn-ghost nb-btn-sm mt-5"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="nb-field">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor={msgId} className="nb-label">
            {messageLabel}
          </label>
          <span id={msgCountId} className="nb-slug tabular-nums">
            {message.length} / {MAX}
          </span>
        </div>
        <textarea
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
          aria-describedby={msgCountId}
          className="nb-input"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="nb-field">
          <label htmlFor={pageId} className="nb-label">
            {pageLabel}, optional
          </label>
          <input
            id={pageId}
            name="page"
            type="text"
            inputMode="url"
            maxLength={300}
            disabled={pending}
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder={pagePlaceholder}
            className="nb-input"
          />
        </div>

        <div className="nb-field">
          <label htmlFor={emailId} className="nb-label">
            Email, optional
          </label>
          <input
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
            className="nb-input"
          />
          <p id={emailHintId} className="nb-hint">
            Only if you want a reply. Leave it blank to stay anonymous, the
            report counts either way.
          </p>
        </div>
      </div>

      {/* Announced without stealing focus; empty until something goes wrong. */}
      <div aria-live="polite">
        {error && (
          <p id={errorId} className="nb-error">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="nb-btn" disabled={pending} aria-busy={pending}>
          {pending ? "Sending" : submitLabel}
        </button>
        <span className="nb-hint">
          No account needed. Nothing here is published automatically.
        </span>
      </div>
    </form>
  );
}
