"use client";

import * as React from "react";
import { useActionState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { sendFeedback } from "@/app/actions/feedback";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function FeedbackForm({ page = "/" }: { page?: string }) {
  const [state, action, pending] = useActionState(sendFeedback, undefined);

  React.useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  if (state?.success) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <span>Thanks! Your suggestion was sent — we read every one.</span>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="page" value={page} />
      <Textarea
        name="message"
        required
        minLength={5}
        placeholder="Suggest a topic, resource, or improvement…"
        aria-label="Your suggestion"
      />
      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Send suggestion
      </Button>
    </form>
  );
}
