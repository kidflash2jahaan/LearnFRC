"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { replyToFeedback, type ReplyState } from "@/app/actions/feedback";
import type { FeedbackItem } from "@/lib/feedback";

/** Rows rendered before the "+N more" tail. */
const MAX_ROWS = 12;

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

/**
 * What people wrote in, and the box to write back from.
 *
 * A carbon-copy log: one message per ruled line, the sender and the page they
 * were on stamped above it in mono, the message itself in reading type. No
 * card chrome and no heading, because the drawer above supplies both.
 *
 * The old version leant on Lucide envelopes to say whether a message had an
 * address, had been answered, or was anonymous. This system has no icon set, so
 * every one of those states is now a WORD. That is not a downgrade: "anonymous"
 * and "replied" are unambiguous read aloud, printed in greyscale, or glanced at
 * by someone who has never seen the icon before.
 */
export function FeedbackInbox({ items }: { items: FeedbackItem[] }) {
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;

  if (items.length === 0) {
    return (
      <p className="nb-slug py-2">
        Nothing in the box. Feedback lands here the moment someone sends it.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <ul className="min-w-0">
        {shown.map((item) => (
          <FeedbackRow key={item.id} item={item} />
        ))}
      </ul>
      {more > 0 ? (
        <p className="nb-slug mt-3">
          {more} older {more === 1 ? "message" : "messages"} not shown
        </p>
      ) : null}
    </div>
  );
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(
    replyToFeedback,
    undefined
  );
  const [composing, setComposing] = React.useState(false);
  const formId = React.useId();
  const fieldId = `${formId}-reply`;

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Reply sent");
  }, [state]);

  const replied = item.status === "replied" || state?.success;
  const canReply = !replied && !!item.fromEmail;

  return (
    <li className="nb-hair py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* The stamp along the top of a filed message: who, where from, when,
              and whether it has been answered. Slug-shaped, like every other
              identifier on the site. */}
          <p className="nb-slug flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            {item.fromEmail ? (
              <span className="min-w-0 max-w-full truncate text-ink" title={item.fromEmail}>
                from / {item.fromEmail}
              </span>
            ) : (
              <span>from / anonymous, no address</span>
            )}
            {item.page ? (
              <span className="min-w-0 max-w-full truncate" title={item.page}>
                page / {item.page}
              </span>
            ) : null}
            <span className="whitespace-nowrap">{timeAgo(item.createdAt)}</span>
            {replied ? (
              <span className="whitespace-nowrap font-bold text-ink">replied</span>
            ) : null}
          </p>

          {/* Capped at the reading measure. The drawer is the full width of
              the page, and a message set 140 characters to the line is a
              message nobody finishes. */}
          <p
            className="mt-2 max-w-[68ch] break-words text-[0.98rem] leading-snug"
            title={item.message}
          >
            {item.message}
          </p>
        </div>

        {canReply ? (
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            aria-expanded={composing}
            aria-controls={formId}
            className="nb-btn-ghost nb-btn-sm shrink-0"
          >
            {composing ? "Cancel" : "Reply"}
          </button>
        ) : null}
      </div>

      {replied && item.replyBody ? (
        <div className="nb-note mt-3 max-w-[68ch]">
          <p className="nb-slug">what you sent back</p>
          <p className="mt-1.5 break-words text-[0.92rem] leading-snug text-graphite">
            {item.replyBody}
          </p>
        </div>
      ) : null}

      {canReply && composing ? (
        <form id={formId} action={action} className="nb-field mt-3 max-w-2xl">
          <input type="hidden" name="id" value={item.id} />
          <label className="nb-label" htmlFor={fieldId}>
            Reply to {item.fromEmail}
          </label>
          <textarea
            id={fieldId}
            name="reply"
            required
            minLength={2}
            rows={3}
            aria-invalid={state?.error ? true : undefined}
            className="nb-input min-h-[6rem]"
          />
          <p className="nb-hint">
            Goes straight to their inbox from LearnFRC. They cannot reply to it in the app.
          </p>
          {/* The toast is easy to miss if the drawer has scrolled: the failure
              is also printed against the field that caused it. */}
          {state?.error ? <p className="nb-error mt-1">{state.error}</p> : null}
          {/* One button, and no Cancel beside it: the control that opened this
              form is still on the row above and already reads "Cancel", so a
              second one would be two controls for one action. */}
          <div className="mt-1">
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="nb-btn nb-btn-sm"
            >
              {pending ? "Sending" : "Send reply"}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
