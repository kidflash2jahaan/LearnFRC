/**
 * The adult behind live classes (section 8.1): Dhiren Pardhanani, the
 * volunteer coordinator who signs hours letters and the safety lead who gets
 * every urgent flag. Confirmed by Jahaan on Nov 8, 2026.
 *
 * Where his email is used for sending, CLASSES_SAFETY_EMAIL wins (so a dev
 * server mails a test address); the letters and pages print this one.
 */
export const COORDINATOR = {
  name: "Dhiren Pardhanani",
  title: "Volunteer Coordinator and Safety Lead",
  /** The title printed under the signature on hours letters. */
  letterTitle: "Volunteer Coordinator",
  email: "dpardhanani@gmail.com",
} as const;
