"use client";

import * as React from "react";
import type { CSSProperties } from "react";
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

  return (
    <section className="ac-card rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span
            className="ac-badge flex h-9 w-9 items-center justify-center"
            style={{ "--a": "var(--primary)" } as CSSProperties}
          >
            <Inbox className="h-[18px] w-[18px]" aria-hidden />
          </span>
          Feedback inbox
        </h2>
        <span className="ac-chip text-xs tabular-nums">{open} open</span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
          No feedback yet. Suggestions and topic requests from across the site
          land here.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <FeedbackRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(
    replyToFeedback,
    undefined
  );

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.success) toast.success("Reply sent");
  }, [state]);

  const replied = item.status === "replied" || state?.success;

  return (
    <div className="rounded-xl border border-border bg-white/60 p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {item.fromEmail ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Mail className="h-3.5 w-3.5 text-primary" aria-hidden />
            {item.fromEmail}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <MailX className="h-3.5 w-3.5" aria-hidden />
            anonymous — no reply address
          </span>
        )}
        {item.page && <span>· {item.page}</span>}
        <span>· {timeAgo(item.createdAt)}</span>
        {replied && (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <MailCheck className="h-3.5 w-3.5" aria-hidden /> replied
          </span>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {item.message}
      </p>

      {replied ? (
        item.replyBody ? (
          <div className="mt-3 rounded-lg border border-success/25 bg-success/5 p-3 text-sm">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Your reply
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
              {item.replyBody}
            </p>
          </div>
        ) : null
      ) : item.fromEmail ? (
        <form action={action} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={item.id} />
          <Textarea
            name="reply"
            required
            minLength={2}
            rows={2}
            placeholder={`Reply to ${item.fromEmail}…`}
            aria-label="Reply"
            className="text-sm"
          />
          <Button
            type="submit"
            variant="brand"
            size="sm"
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Send reply
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No reply address on this one — nothing to send to.
        </p>
      )}
    </div>
  );
}
