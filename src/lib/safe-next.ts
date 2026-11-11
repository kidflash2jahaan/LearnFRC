/**
 * The one check for a `?next=` path before anything redirects to it: a
 * same-site path only. "//host" and "/\host" are other sites to a browser,
 * and browsers drop tabs and newlines from a URL before reading it, so
 * "/\t/host" is "//host" too.
 *
 * Every `next` check on the site goes through this: /auth/callback,
 * /auth/confirm, the sign-in and sign-up actions, the login and signup pages,
 * the auth form, the Google button and the username step. No imports, so the
 * client components can use it too. Don't keep a private copy of the rule: a
 * copy that only checked "//" and "/\" is how /auth/callback once sent
 * "/\t/host" to another site.
 */
export function safeNextPath(next: string | null | undefined): string | undefined {
  if (!next) return undefined;
  const n = next.replace(/[\t\n\r]/g, "");
  if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return undefined;
  return n;
}
