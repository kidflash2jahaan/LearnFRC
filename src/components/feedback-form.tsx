"use client";

import * as React from "react";
import { useActionState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { sendFeedback } from "@/app/actions/feedback";
import { Textarea, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function FeedbackForm({ page = "/" }: { page?: string }) {
  const [state, action, pending] = useActionState(sendFeedback, undefined);

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  if (state?.success) {
    return (
      <div className="ac-card flex items-center gap-3 rounded-2xl border-success/30 bg-success/10 p-4 text-[15px]">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
        <span>Thanks! Your suggestion was sent — we read every one.</span>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="page" value={page} />
      <label htmlFor="feedback-message" className="sr-only">
        Your suggestion
      </label>
      <Textarea
        id="feedback-message"
        name="message"
        required
        minLength={5}
        placeholder="Suggest a topic, resource, or improvement…"
        aria-label="Your suggestion"
      />
      <div>
        <label htmlFor="feedback-email" className="sr-only">
          Email (optional)
        </label>
        <Input
          id="feedback-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email (optional — so we can reply)"
        />
      </div>
      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        Send suggestion
      </Button>
    </form>
  );
}
