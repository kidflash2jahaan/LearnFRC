import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mix a hex color toward transparency for inline styles. */
export function alpha(hex: string, pct: number) {
  return `color-mix(in srgb, ${hex} ${pct}%, transparent)`;
}

export function pluralize(n: number, word: string, plural?: string) {
  return `${n} ${n === 1 ? word : plural ?? word + "s"}`;
}

export function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
