/**
 * Closed. The marketing role was removed on 2026-11-09 (it may come back; git
 * history has it). Installed app copies still read this through
 * GET /api/app/apply and show their closed note. Teaching has its own page,
 * /apply/teach.
 */
export const APPLICATIONS_OPEN = false;

/**
 * What's left of /apply's old contract, for the app copies already installed.
 * This file now only feeds the closed GET /api/app/apply
 * (src/lib/app/admin-apply.ts) and the team desk's "what accepting hands
 * over" card, which those copies print as sent. Plain module, no
 * `server-only`: it is only strings, and nothing in it is private.
 *
 * The only role anyone can apply for is teaching live classes, on
 * /apply/teach (src/lib/app/class-teachers.ts).
 */

/**
 * FIRST's own disclaimer wording, from its "Policy on the Use of FIRST
 * Trademarks and Copyrighted Materials" (section IV.A), naming the marks an
 * hours letter uses. src/app/letters/[code]/page.tsx prints it. The footer's
 * FirstTrademarkNotice (src/components/footer.tsx), which the terms reuse, is
 * the same sentence with every mark the lessons use.
 */
export const FIRST_DISCLAIMER =
  "FIRST®, FIRST® Robotics Competition, and FRC® are registered trademarks of FIRST® (www.firstinspires.org) which is not overseeing, involved with, or responsible for this activity, product, or service.";

/**
 * The team desk's grant card on installed app copies. They print a non-empty
 * server list as is, so this one line reads true there: an old application
 * can only be turned down.
 */
export const CLOSED_GRANTS: { label: string; hint: string }[] = [
  { label: "Nothing", hint: "applying here is closed, so an old application can only be turned down" },
];

/**
 * The heading and the mono note GET /api/app/apply sends with each state.
 * Installed copies print them. Plain strings, with the site's typographic
 * apostrophe.
 */
export const HEADS = {
  "signed-out": {
    title: "Applying needs an account",
    slug: "free, and it takes a minute",
  },
  "on-the-team": {
    title: "You’re already on the team",
    slug: "nothing to apply for",
  },
  pending: { title: "Your application", slug: "waiting on a decision" },
  "no-handle": {
    title: "Pick a handle first",
    slug: "one step, then the three questions",
  },
  again: { title: "Apply again", slug: "three questions, nothing else" },
  new: { title: "Apply", slug: "three questions, nothing else" },
} as const;

export type ApplyMode = keyof typeof HEADS;

/** The limits installed copies show on their own form (it's closed, but they still read them). */
export const APPLY_LIMITS = { minChars: 40, maxChars: 3000, availabilityMax: 200 } as const;
