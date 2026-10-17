/**
 * Whether /apply takes new applications to help run LearnFRC. Closed by the
 * owner on 2026-10-05: the page explains it, and submitApplication
 * (src/lib/app/admin-apply.ts) refuses on the server too. Flip to true to
 * reopen.
 */
export const APPLICATIONS_OPEN = false;

/**
 * The copy both doors print for the admin team, kept here once so /apply,
 * /admin/team and the app's /api/app/apply and /api/app/admin/team can't drift.
 * Plain module, no `server-only`: it is only strings.
 */

/** The four jobs, in the order they take up time. Slug left, the work right. */
export const JOBS: { slug: string; text: string }[] = [
  {
    slug: "the feedback",
    text: "Every message sent through the contact form lands in one inbox. Most want a short, specific answer. Some are a real bug report and need chasing down before you can reply.",
  },
  {
    slug: "suggested edits",
    text: "Anyone with an account can rewrite the markdown of a lesson. Somebody has to read the change, check it against the source it touches, and either merge it or say plainly why not.",
  },
  {
    slug: "verifying lessons",
    text: "Lessons are drafted with AI help and checked by hand. Marking one verified means you read it against the documents it cites, found it held up, and put your account behind that.",
  },
  {
    slug: "the numbers",
    text: "The same admin page I read: signups, lessons finished, where readers arrive from, which pages get opened and which ones never do.",
  },
];

/**
 * What an acceptance actually hands over, written out. The person deciding
 * should be able to read the grant without opening /admin to remember it.
 */
export const GRANTS: { label: string; hint: string }[] = [
  { label: "The numbers", hint: "every figure on /admin, read off the database" },
  { label: "The feedback inbox", hint: "read what people send in, and write back" },
  { label: "Edit review", hint: "approve or turn down suggested edits" },
  { label: "The verified mark", hint: "sign off a lesson as checked" },
];

/**
 * The heading and the mono note over whichever block a visit to /apply lands
 * on.
 *
 * Plain strings rather than JSX, so the apostrophe is the typographic one the
 * rest of the site uses rather than an HTML entity that would need escaping
 * around.
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

/** The limits on the three boxes, the same on both doors. */
export const APPLY_LIMITS = { minChars: 40, maxChars: 3000, availabilityMax: 200 } as const;
