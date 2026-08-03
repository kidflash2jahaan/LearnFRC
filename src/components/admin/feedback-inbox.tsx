"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import {
  Inbox,
  Mail,
  MailCheck,
  MailX,
  Send,
  Loader2,
} from "lucide-react";
import { replyToFeedback, type ReplyState } from "@/app/actions/feedback";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FeedbackItem } from "@/lib/feedback";

/** Rows rendered before the "+N more" line. */
const MAX_ROWS = 6;

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

export function FeedbackInbox({ items }: { items: FeedbackItem[] }) {
  const open = items.filter((i) => i.status !== "replied").length;
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;

  return (
    <section className="ac-card rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Inbox className="h-4 w-4 text-primary" aria-hidden />
          Feedback inbox
        </h2>
        <span className="ac-chip text-xs tabular-nums">{open} open</span>
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No feedback yet.
        </p>
      ) : (
        <>
          <div className="divide-y divide-border/70">
            {shown.map((item) => (
              <FeedbackRow key={item.id} item={item} />
            ))}
          </div>
          {more > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              +{more} more
            </p>
          )}
        </>
      )}
    </section>
  );
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(
    replyToFeedback,
    undefined
  );
  const [composing, setComposing] = React.useState(false);

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Reply sent");
  }, [state]);

  const replied = item.status === "replied" || state?.success;

  return (
    <div className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {item.fromEmail ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Mail className="h-3.5 w-3.5 text-primary" aria-hidden />
            {item.fromEmail}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <MailX className="h-3.5 w-3.5" aria-hidden />
            anonymous
          </span>
        )}
        {item.page && <span>· {item.page}</span>}
        <span>· {timeAgo(item.createdAt)}</span>
        {replied && (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <MailCheck className="h-3.5 w-3.5" aria-hidden /> replied
          </span>
        )}
        {!replied && item.fromEmail && (
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            aria-expanded={composing}
            className="ml-auto cursor-pointer font-medium text-primary hover:underline"
          >
            {composing ? "Cancel" : "Reply"}
          </button>
        )}
      </div>

      <p
        className="mt-1 line-clamp-2 text-sm leading-snug text-foreground"
        title={item.message}
      >
        {item.message}
      </p>

      {replied && item.replyBody && (
        <p
          className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground"
          title={item.replyBody}
        >
          <span className="font-medium text-success">Your reply:</span>{" "}
          {item.replyBody}
        </p>
      )}

      {!replied && item.fromEmail && composing && (
        <form action={action} className="mt-2 flex items-start gap-2">
          <input type="hidden" name="id" value={item.id} />
          <Textarea
            name="reply"
            required
            minLength={2}
            rows={2}
            placeholder={`Reply to ${item.fromEmail}…`}
            aria-label="Reply"
            className="min-h-14 flex-1 py-2 text-sm"
          />
          <Button
            type="submit"
            variant="brand"
            size="sm"
            disabled={pending}
            aria-busy={pending}
            className="min-h-9 shrink-0 px-3 py-2 text-xs"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
