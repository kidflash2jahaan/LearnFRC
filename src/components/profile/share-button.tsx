"use client";

import * as React from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButton({
  username,
  name,
}: {
  username: string;
  name: string;
}) {
  const [copied, setCopied] = React.useState(false);

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
        return; // user cancelled the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Profile link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onShare}
      className="font-mono hover:border-primary/50 hover:text-primary hover:shadow-[var(--glow-primary)]"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "copied" : "share"}
    </Button>
  );
}
