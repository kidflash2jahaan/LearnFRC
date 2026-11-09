import "server-only";
import { PUBLIC_CONTACT_EMAIL } from "@/lib/email";

/**
 * What each class refusal says, on the site and in the app. Re-exported by
 * src/lib/app/classes.ts, which is where everyone imports it from.
 *
 * It lives in this leaf module because modules that build their own sentence
 * tables from it at load time (classes-room.ts, class-chat.ts) sit in an
 * import cycle with classes.ts (classes.ts -> classes-teaching.ts ->
 * classes-room.ts -> classes.ts, for account deletion and cancelling a
 * suspended teacher's classes). Reading CLASS_SENTENCES through classes.ts
 * while that cycle loads throws "Cannot access before initialization" in the
 * production build, so those two import it from here.
 */
export const CLASS_SENTENCES = {
  hidden: "Live classes aren't open yet.",
  signedOut: "Sign in to join a class.",
  needsHandle: "Pick a username in Settings before you join a class.",
  deviceBlocked: `Live classes aren't available on this device. If that's a mistake, a parent or guardian can write to ${PUBLIC_CONTACT_EMAIL}.`,
  needsAge: "Answer one quick question before you join a class.",
  adult: "Live classes are for students 13 to 17. Lessons are all still yours.",
  needsParent: "Your parent or guardian needs to say OK before you join a class.",
  waitingParent: "Waiting for your parent or guardian. Resend in 24 hours.",
  parentDeclined: `Your parent or guardian didn't OK live classes. If that's changed, write to ${PUBLIC_CONTACT_EMAIL}.`,
  notFound: "That class doesn't exist.",
  closed: "Enrollment for this class has closed.",
  full: "This class is full.",
  removed: "You were removed from this class, so you can't join it again.",
  ownClass: "You're teaching this one.",
  blocked: "You can't join this class.",
  bio: "Take contact details out of your bio before you join a class.",
  username:
    "Change your username in Settings before you join a class. Usernames in a class can't carry app names or numbers that look like contact details.",
  rate: "That's a lot of tries. Wait a few minutes and try again.",
  save: "Couldn't save that. Try again.",
} as const;
