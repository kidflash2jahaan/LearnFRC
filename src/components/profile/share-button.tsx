"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Hand this page to someone.
 *
 * It uses the OS share sheet where there is one (which is where sharing a
 * profile actually happens, on a phone in a pit) and falls back to copying the
 * link. The label says what just happened rather than only changing an icon,
 * because "copied" is the whole confirmation and it has to survive being read
 * at arm's length.
 *
 * Drawn as the secondary button: on the record sheet the thing to press is the
 * link into the guides, not this.
 */
export function ShareButton({
  username,
  name,
}: {
  username: string;
  name: string;
}) {
  const [copied, setCopied] = React.useState(false);

  // A `setTimeout` that outlives the component would set state on an unmounted
  // tree, so the id is held and cleared.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onShare = async () => {
    const url = `${window.location.origin}/u/${username}`;
    const data = {
      title: `${name} on LearnFRC`,
      text: `Check out ${name}'s FRC learning profile on LearnFRC`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        return; // the share sheet was dismissed
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Profile link copied");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <button type="button" onClick={onShare} className="nb-btn-ghost">
      {copied ? "Link copied" : "Share this page"}
    </button>
  );
}
