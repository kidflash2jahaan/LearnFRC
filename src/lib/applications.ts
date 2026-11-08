import { TOUR_VIDEO_URL } from "@/lib/tour-video";

/**
 * Whether /apply takes new applications. Closed by the owner on 2026-10-05,
 * reopened for the marketing role only on 2026-11-08 (it goes live with the
 * release). The page explains a closed state, and submitApplication
 * (src/lib/app/admin-apply.ts) refuses on the server too. Flip to false to
 * close it again.
 */
export const APPLICATIONS_OPEN = true;

/**
 * The copy both doors print for the marketing role, kept here once so /apply,
 * /admin/team, the acceptance email and the app's /api/app/apply and
 * /api/app/admin/team can't drift. Plain module, no `server-only`: it is only
 * strings, and nothing in it is private.
 *
 * ONE ROLE. /apply used to describe four admin jobs (the feedback inbox,
 * suggested edits, verifying lessons, the numbers). Those came off the page on
 * 2026-11-08. The only thing anyone can apply for now is marketing, and
 * accepting someone gives their account a marketing tag (the `marketers`
 * table) and nothing else: no /admin, no site data, no feedback inbox. The
 * admin team is still managed on /admin/team, by hand, outside applications.
 */

/**
 * What a marketer does, in the order most people will do it. Slug left, the
 * work right.
 *
 * Four of them on purpose: the app copies already on people's phones print
 * this list under their own hardcoded "four jobs, and that is the list", so
 * the count has to stay true for them.
 */
export const JOBS: { slug: string; text: string }[] = [
  {
    slug: "your own team",
    text: "Show LearnFRC to the team you’re on. Put the link in your team’s Discord or group chat, bring it up at a meeting, and point new members at it when they join.",
  },
  {
    slug: "other teams",
    text: "Share it with teams you already know, at competitions, scrimmages and outreach events, or online. Post the trailer and the clips where FRC people will see them.",
  },
  {
    slug: "places to post",
    text: "Tell me where LearnFRC should show up and doesn’t yet: a Discord server, a forum, a subreddit, a newsletter, a league’s resource page.",
  },
  {
    slug: "your own videos",
    text: "Only if you want to: make a video, a clip or a short explainer of your own and send it to me. I may post it on LearnFRC’s official YouTube, Instagram and TikTok.",
  },
];

/**
 * Where anything a marketer makes ends up, said plainly. /apply prints it, the
 * acceptance email repeats it, and the app shows it under the jobs.
 */
export const OFFICIAL_POSTING =
  "Anything you make comes to me, and I may post it on LearnFRC’s official YouTube, Instagram and TikTok if I choose. Sending something in doesn’t mean it goes up.";

/**
 * The disclaimer the site prints on /about, /contact, /privacy and /terms,
 * word for word. Marketers put it on what they post.
 */
export const FIRST_DISCLAIMER =
  "LearnFRC is an independent educational project and is not affiliated with or endorsed by FIRST®. FIRST® and FRC® are trademarks of FIRST.";

/** The rules, printed on /apply and in the acceptance email. */
export const MARKETING_RULES: string[] = [
  "Don’t present LearnFRC as official FIRST material, or as something FIRST runs or recommends. It’s an independent project.",
  `Put the FIRST disclaimer on anything you post about it: “${FIRST_DISCLAIMER}”`,
  "Don’t name other teams without their permission.",
];

/**
 * The trailer. A placeholder until it is public: null means "not out yet", and
 * every surface that would link it says that instead of printing a dead link.
 * Set it to the trailer's public URL on the day it goes up.
 */
export const TRAILER_URL: string | null = null;

/**
 * The small brand kit in the acceptance email and on a marketer's /apply card.
 * Every URL is a file the site already serves: the logo is src/app/icon.svg,
 * the PNG is src/app/apple-icon.png, the share card is
 * src/app/opengraph-image.tsx. The colours are the tokens in
 * src/app/globals.css, and the fonts are the three in src/app/layout.tsx.
 */
export const BRAND_KIT = {
  logos: [
    { label: "Logo, SVG", url: "https://learnfrc.com/icon.svg" },
    { label: "Logo, 180px PNG", url: "https://learnfrc.com/apple-icon.png" },
    { label: "Share card, 1200 by 630 PNG", url: "https://learnfrc.com/opengraph-image" },
  ],
  colors: [
    { name: "Ink", hex: "#16181B", use: "type and borders" },
    { name: "Ballpoint blue", hex: "#1B36C8", use: "the one accent" },
    { name: "Card", hex: "#F5F6F2", use: "cards and raised surfaces" },
    { name: "Paper", hex: "#E6E8E3", use: "the background" },
    { name: "Graphite", hex: "#565C60", use: "secondary type" },
    { name: "Tape", hex: "#C4A77D", use: "decoration only, never text" },
  ],
  fonts: "Bricolage Grotesque for headings, Space Mono for labels, Caveat for handwritten notes.",
  clips: [
    { label: "The 60-second tour", url: TOUR_VIDEO_URL },
    { label: "Lesson videos", url: "https://learnfrc.com/videos" },
  ],
} as const;

/**
 * What an acceptance actually hands over, written out. The person deciding
 * should be able to read the grant without remembering what the tag does.
 */
export const GRANTS: { label: string; hint: string }[] = [
  { label: "A marketing tag", hint: "on their account, seen only on this page" },
  { label: "The welcome email", hint: "the trailer, their invite link, the brand kit and the rules" },
  { label: "A signup count", hint: "people who join through their invite link, shown here" },
  { label: "No admin access", hint: "no /admin, no site numbers, no feedback inbox" },
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
  marketer: {
    title: "You’re on the marketing team",
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
