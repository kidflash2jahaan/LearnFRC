/**
 * Subteam naming, shared by the server page and the client board.
 *
 * Deliberately NOT in `subteam-board.tsx`: that file is `"use client"`, and
 * every export of a client module becomes a client *reference* in the server
 * bundle — a Server Component that imported this from there would typecheck
 * fine and then throw "Attempted to call subteamLabel() from the server" at
 * request time. Plain module, no directive, so both sides get the real
 * function.
 */

/**
 * "Mechanical, Build & Pneumatics" is a catalog title; "Mechanical" is what a
 * team actually calls the subteam. Cut at the first comma or ampersand and drop
 * a leading article so the board scans in one column at 375px.
 */
export function subteamLabel(name: string): string {
  const head = name.split(/[,&]/)[0].trim();
  const short = head.replace(/^the\s+/i, "");
  // "Getting Started with FRC" → "Getting Started"
  return short.replace(/\s+with\s+FRC$/i, "");
}
