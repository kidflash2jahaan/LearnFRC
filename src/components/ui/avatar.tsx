"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

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

  // deterministic neon-family color from seed/name (lime / green / cyan / magenta / gold)
  const key = seed || name || "x";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  const NEON_HUES = [82, 150, 188, 320, 46];
  const h = NEON_HUES[hash % NEON_HUES.length];
  const h2 = NEON_HUES[(hash + 2) % NEON_HUES.length];

  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name ?? "avatar"}
          className="h-full w-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#06070b]"
        style={{
          backgroundImage: `linear-gradient(135deg, hsl(${h} 90% 62%), hsl(${h2} 90% 56%))`,
        }}
      >
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
