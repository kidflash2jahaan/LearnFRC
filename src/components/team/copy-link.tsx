"use client";

import * as React from "react";

/**
 * The invite link, written out and copyable.
 *
 * The smallest possible client boundary on an otherwise server-rendered invite
 * panel: everything except the clipboard call renders on the server.
 *
 * Drawn as a slip of paper with the URL written on it in mono, because that is
 * what a link is in this system: an identifier, so it is Space Mono, and it is
 * shown in full rather than hidden behind a button, so somebody copying it by
 * hand onto a whiteboard can read every character.
 *
 * Hydration-safe: `copied` starts false on both server and client, so the first
 * client render is identical to the SSR output. The label reports back through
 * a live region, and it holds a fixed minimum width so the row cannot reflow
 * when "Copy" becomes "Copied".
 */
export function CopyLink({
  url,
  label = "Invite link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  // A pending timeout has to be cleared, or a click just before unmount sets
  // state on a component that is already gone.
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is written out above, and selectable */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span
        className="nb-box-sm nb-slug min-w-0 flex-1 basis-[16rem] truncate px-3 py-3 text-ink"
        aria-label={label}
      >
        {url}
      </span>
      <button
        type="button"
        onClick={copy}
        className="nb-btn-ghost nb-btn-sm shrink-0"
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      >
        <span aria-live="polite" className="min-w-[6ch] text-center">
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
    </div>
  );
}
