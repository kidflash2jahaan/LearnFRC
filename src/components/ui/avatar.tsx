"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

/** Deterministic angles for the hand-lettered initials. Six values, none
 *  repeating soon, so a roster reads as names written by hand rather than as
 *  one glyph stamped fifteen times. */
const TILTS = [-3.1, 1.9, -1.3, 2.7, -2.4, 1.1];

/**
 * A person. The circle is the single exception the system makes to its
 * hand-drawn radius, and it is spent here.
 *
 * The old avatar coloured itself from a hash of the name, which needed five
 * hues this palette does not have. Identity now comes from the initials and
 * from the angle they were written at, which survives greyscale and does not
 * spend blue, the one colour that means "you can click this".
 *
 * Only the initials tilt. A photograph stays upright, because a face rotated
 * inside a circular crop reads as a rendering bug rather than as a note.
 */
export function Avatar({
  name,
  src,
  className,
  seed,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
  seed?: string;
}) {
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const key = seed || name || "x";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  const tilt = TILTS[hash % TILTS.length];

  // `h-10 w-10` rather than `size-10`: tailwind-merge does not treat `size-*`
  // as conflicting with a caller's `h-* w-*`, so both classes would survive and
  // which one applied would come down to utility order in the sheet. Nine call
  // sites resize this, so the override has to be settled by the class list.
  return (
    <AvatarPrimitive.Root className={cn("nb-avatar h-10 w-10 shrink-0 text-[0.8rem]", className)}>
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name ?? "avatar"}
          className="size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        className="nb-tilt grid size-full place-items-center leading-none"
        style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
      >
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
