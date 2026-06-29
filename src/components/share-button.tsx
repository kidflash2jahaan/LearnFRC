"use client";

import * as React from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Share/copy button: uses the native share sheet on mobile, falls back to
 * copying the message + link to the clipboard with "Copied!" feedback.
 */
export function ShareButton({
  text,
  url,
  label = "Share",
  variant = "outline",
}: {
  text: string;
  url: string;
  label?: string;
  variant?: "brand" | "outline" | "ghost";
}) {
  const [copied, setCopied] = React.useState(false);

  const onClick = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        /* cancelled or unsupported — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Button variant={variant} onClick={onClick} className="print:hidden">
      {copied ? (
        <Check className="h-4 w-4 text-success" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      {copied ? "Copied!" : label}
    </Button>
  );
}
