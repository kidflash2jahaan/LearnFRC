"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Mail, MailCheck, MailX, Send, Loader2 } from "lucide-react";
import { replyToFeedback, type ReplyState } from "@/app/actions/feedback";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FeedbackItem } from "@/lib/feedback";

/** Rows rendered before the "+N more" tail. Lives in a dropdown now, so we show more. */
const MAX_ROWS = 12;

/**
 * How many feedback items are still awaiting a reply. Exported so a panel can
 * badge the count without pulling in the list itself.
 */
export function openFeedbackCount(items: FeedbackItem[]): number {
  return items.filter((i) => i.status !== "replied").length;
}

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
 * Bare list — no card chrome, no heading. The parent disclosure panel supplies
 * the title, badge and padding, so this sits flush inside it.
 */
export function FeedbackInbox({ items }: { items: FeedbackItem[] }) {
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No feedback yet.</p>;
  }

  return (
    <div>
      <div className="divide-y divide-border/70">
        {shown.map((item) => (
          <FeedbackRow key={item.id} item={item} />
        ))}
      </div>
      {more > 0 && (
        <p className="pt-3 text-xs text-muted-foreground">
          +{more} more
        </p>
      )}
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

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Reply sent");
  }, [state]);

  const replied = item.status === "replied" || state?.success;
  const canReply = !replied && !!item.fromEmail;

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {item.fromEmail ? (
              <span
                className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-foreground"
                title={item.fromEmail}
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{item.fromEmail}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <MailX className="h-3.5 w-3.5 shrink-0" aria-hidden />
                anonymous
              </span>
            )}

            {item.page && (
              <span
                className="inline-flex min-w-0 max-w-full items-center gap-1"
                title={item.page}
              >
                <span aria-hidden>·</span>
                <span className="truncate">{item.page}</span>
              </span>
            )}

            <span className="whitespace-nowrap">
              <span aria-hidden>· </span>
              {timeAgo(item.createdAt)}
            </span>

            {replied && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-success">
                <MailCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                replied
              </span>
            )}
          </div>

          <p
            className="mt-1 line-clamp-2 break-words text-sm leading-snug text-foreground"
            title={item.message}
          >
            {item.message}
          </p>
        </div>

        {canReply && (
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            aria-expanded={composing}
            aria-controls={formId}
            aria-label={
              composing
                ? `Cancel reply to ${item.fromEmail}`
                : `Reply to ${item.fromEmail}`
            }
            className="-my-1 -mr-2 inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-xl px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
          >
            {composing ? "Cancel" : "Reply"}
          </button>
        )}
      </div>

      {replied && item.replyBody && (
        <p
          className="mt-1 line-clamp-2 break-words text-xs leading-snug text-muted-foreground"
          title={item.replyBody}
        >
          <span className="font-medium text-success">Your reply:</span>{" "}
          {item.replyBody}
        </p>
      )}

      {canReply && composing && (
        <form
          id={formId}
          action={action}
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start"
        >
          <input type="hidden" name="id" value={item.id} />
          <Textarea
            name="reply"
            required
            minLength={2}
            rows={2}
            placeholder={`Reply to ${item.fromEmail}…`}
            aria-label={`Reply to ${item.fromEmail}`}
            className="min-h-16 w-full flex-1 py-2 text-sm"
          />
          <Button
            type="submit"
            variant="brand"
            size="sm"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 px-3 text-xs sm:w-auto"
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
