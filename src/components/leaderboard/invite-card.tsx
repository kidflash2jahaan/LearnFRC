"use client";

import * as React from "react";
import { UserPlus, Copy, Check } from "lucide-react";
import { ShareButton } from "@/components/share-button";

export function InviteCard({
  username,
  count,
}: {
  username: string;
  count: number;
}) {
  const link = `https://learnfrc.systemerr.com/signup?ref=${username}`;
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.05] p-5 backdrop-blur-md shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_14%,transparent),0_24px_60px_-46px_var(--primary)]">
      {/* corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-[var(--glow-primary)]">
          <UserPlus className="h-4 w-4" />
        </span>
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Invite friends, earn XP
        </h2>
      </div>
      <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
        You&apos;ve referred{" "}
        <span className="font-mono font-semibold text-primary">{count}</span>{" "}
        {count === 1 ? "person" : "people"} so far. Share your link — you earn{" "}
        <span className="font-mono font-semibold text-primary">+25 XP</span> for
        everyone who joins through it.
      </p>

      <div className="relative mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-background/80 px-3 py-2">
          <span className="truncate font-mono text-xs text-muted-foreground">
            <span className="text-primary/70">$ </span>
            {link}
          </span>
          <button
            onClick={copy}
            className="flex shrink-0 cursor-pointer items-center gap-1 font-mono text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <ShareButton
          variant="brand"
          label="Share invite"
          text="Learn every part of FRC, free — join me on LearnFRC:"
          url={link}
        />
      </div>
    </div>
  );
}
