/**
 * Short subteam names, shared by the server page and the client board.
 *
 * WHY THIS IS A PLAIN MODULE
 * subteam-board.tsx carries "use client", and every export of a client module
 * becomes a client reference in the server bundle. A Server Component that
 * imported this from there would typecheck cleanly and then throw "Attempted to
 * call subteamLabel() from the server" at request time. No directive in this
 * file, so both sides get the real function.
 *
 * WHAT IT IS FOR
 * The catalog titles are written to be found: "Mechanical, Build & Pneumatics",
 * "Programming, Controls & Sensors", "Business, Operations & Fundraising". A
 * pit board is written for somebody standing in front of it, and that person
 * calls those Mechanical, Programming and Business. /teams draws eleven ruled
 * lines that have to read as one column at 375px, so the line takes the short
 * name and the full title stays where it earns its keep, on /guides.
 */

/**
 * The name a team actually uses for a subteam.
 *
 * Two cuts, in this order:
 * - keep what comes before the first comma or ampersand, so
 *   "Business, Operations & Fundraising" is "Business"
 * - drop a leading article and a trailing "with FRC", so "The Impact Award" is
 *   "Impact Award" and "Getting Started with FRC" is "Getting Started"
 *
 * Names that are already short pass straight through: "Safety" stays "Safety",
 * and "Drive Team" keeps its second word because there is no separator to cut
 * at. Nothing here is a lookup table, so a twelfth department added to the
 * catalog gets a sensible label without anyone remembering to come back here.
 *
 * The result gets read aloud in aria-labels and dropped into the middle of
 * sentences, so a title that is nothing but separators falls back to the
 * trimmed original instead of returning an empty string.
 */
export function subteamLabel(name: string): string {
  const short = name
    .split(/[,&]/)[0]
    .replace(/^\s*the\s+/i, "")
    .replace(/\s+with\s+FRC\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return short || name.trim();
}
