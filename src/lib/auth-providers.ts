/**
 * Sign-in providers that aren't an email and a password. Safe to import from
 * client and server code alike.
 *
 * SIGN IN WITH APPLE IS BUILT BUT SWITCHED OFF. It needs a paid Apple
 * Developer team, a Services ID and a Sign in with Apple key, and Supabase's
 * Apple provider set up with them. Until those exist the button would only
 * ever say "isn't set up yet", so it stays hidden: set
 * NEXT_PUBLIC_APPLE_SIGNIN=1 in Vercel (and redeploy, because NEXT_PUBLIC_
 * values are fixed at build time) once Supabase's Apple provider is on. The
 * server side (src/lib/app/apple-sign-in.ts) needs no flag: it only acts for
 * an account that actually has an Apple identity.
 */
export const APPLE_SIGN_IN_ENABLED = process.env.NEXT_PUBLIC_APPLE_SIGNIN === "1";

/**
 * True for an address from Apple's "Hide My Email": someone who signed in with
 * Apple and chose not to share their real address. Mail sent to it is
 * forwarded to their inbox, but only from a sender registered with Apple's
 * private email relay, so it's a real, working address and never something to
 * reject. It just isn't a handle anyone would pick, so nothing should be
 * suggested from it.
 */
export function isApplePrivateRelayEmail(email: string | null | undefined): boolean {
  return /@privaterelay\.appleid\.com$/i.test((email ?? "").trim());
}
