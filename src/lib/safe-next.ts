/**
 * The one check for a `?next=` path before anything redirects to it: a
 * same-site path only. "//host" and "/\host" are other sites to a browser,
 * and browsers drop tabs and newlines from a URL before reading it, so
 * "/\t/host" is "//host" too.
 *
 * No imports, so the login and signup pages and the auth form (a client
 * component) all use it. src/app/actions/auth.ts and /auth/callback keep
 * their own copies of the same rule.
 */
export function safeNextPath(next: string | null | undefined): string | undefined {
  if (!next) return undefined;
  const n = next.replace(/[\t\n\r]/g, "");
  if (!n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return undefined;
  return n;
}
