/**
 * The recording notice everyone accepts before every join, and the teacher
 * code of conduct (section 10.1).
 *
 * Changing either text means bumping its version: joinClass refuses an old
 * CLASS_NOTICE_VERSION, so everyone accepts the new text on their next join,
 * and teachers agree to a new TEACHER_CODE_VERSION before they can schedule.
 * Each acceptance is a class_consents row with the version.
 *
 * Plain strings, no imports, so client components render them as they are.
 */

export const CLASS_NOTICE_VERSION = "2026-11-09";

/** The notice's paragraphs, in order. */
export const CLASS_NOTICE: readonly string[] = [
  "This class is recorded on video and transcribed. Cloudflare, our video service, records what's said and any camera or screen that's on, and turns the audio into a transcript. LearnFRC keeps the class chat. Anthropic's Claude AI reads the transcript and chat and writes notes so LearnFRC can check every class is safe and on topic. Recordings are deleted after 7 days unless there's a safety problem. Transcripts, chat and notes are kept up to a year. Details are in our privacy policy (learnfrc.com/privacy#classes).",
  "Everyone in the class sees your LearnFRC username. Make sure nobody else can be heard on your mic. Student cameras stay off, and there's no private messaging. The chat won't send links outside LearnFRC and the docs, @handles, emails, phone numbers or other apps' usernames. If anything feels wrong, press Report or leave.",
];

/** The required checkbox under the notice. */
export const CLASS_NOTICE_CHECKBOX = "I understand. This class is recorded on video and transcribed.";

/** The badge that stays on screen in the room. */
export const RECORDING_BADGE = {
  label: "Recorded",
  detail: "Recorded by Cloudflare and reviewed by LearnFRC.",
} as const;

export const TEACHER_CODE_VERSION = "2026-11-09";

/** The teacher code of conduct, one rule per line. */
export const TEACHER_CODE: readonly string[] = [
  "You're 13 to 17 years old.",
  "Teach the topic you scheduled.",
  "Keep everything in the class: no DMs, no other apps, no meeting up, and no contact details in your profile bio.",
  "Never ask a student's age, school, location or anything personal, and never ask anyone to turn a camera on.",
  "Your own camera is optional.",
  "If only one student comes, keep it on topic. LearnFRC looks at those classes more closely.",
  "Your messages go through the same chat filter as everyone's, so share lesson links from LearnFRC or the docs.",
  "Remove anyone who breaks the rules, and report it.",
  "Don't present classes as FIRST's or your team's official outreach.",
  "Report your hours honestly.",
];
