/**
 * PAGES WITH A SIGNED-IN VERSION.
 *
 * A few public pages are written for someone who doesn't have an account yet,
 * and the site has a better page for the same job once you do. Someone signed
 * in who opens the left-hand page goes to the right-hand one instead.
 *
 * The redirect runs in the middleware (src/lib/supabase/middleware.ts), right
 * after the getUser() call it already makes on every request, so it costs no
 * extra auth or database call. It can't live in the pages: "/" and /for-teams
 * are static, cached for everyone, and reading cookies there would make them
 * render per request. The middleware runs in front of that cache, so
 * signed-out visitors and crawlers still get the cached page, exactly as
 * before, and a signed-in reader never reaches it.
 *
 * Keep this file free of imports: the middleware, /signup, the logo, the
 * footer and the unit tests all read it. The navbar's own "My team" swap
 * (components/navbar.tsx) is the same /for-teams pair.
 *
 * Rules for adding a pair:
 * - The left side has to be a page a signed-in person never needs, and the
 *   right side has to be what its own buttons would have sent them to.
 * - Only a session check decides it. Anything that needs a database read
 *   (a role, a team, a teacher's status) belongs in that page instead.
 * - The right side must never be a key here, and never a page that sends
 *   signed-in people somewhere else (/login, /signup, /forgot-password), so
 *   nothing can loop. The unit test checks both.
 */
export const SIGNED_IN_VERSION: Readonly<Record<string, string>> = {
  // The home page is the pitch to someone who hasn't signed up: both of its
  // big buttons go to /signup. Once you have an account, the dashboard is
  // home: where you left off, your plan, your team. This also covers every
  // link to "/" without touching it: the logo, the 404 and error pages,
  // breadcrumbs, typed URLs and bookmarks.
  "/": "/dashboard",

  // The pitch to mentors. Both of its own buttons say "Go to your team". The
  // navbar already swaps this tab for "My team" once it knows you're signed
  // in; this catches the links that can't swap (the footer before it loads,
  // "How teams use this" on /paths, shared links). /teams shows its own
  // "add your team number" card when there's no number yet.
  "/for-teams": "/teams",

  // "Check your inbox" after signing up. Once the confirm link has signed you
  // in, the old tab shouldn't keep telling you to check your email.
  "/auth/verify-email": "/dashboard",
};

/**
 * Pages that already send a signed-in visitor somewhere else from inside the
 * page (they need the `next` param or a HardRedirect, so they aren't in the
 * middleware map). A signed-in redirect must never land on one of these.
 */
export const SIGNED_OUT_ONLY: readonly string[] = ["/login", "/signup", "/forgot-password"];

/** Where a signed-in visitor goes when nothing else says where. */
export const SIGNED_IN_HOME = "/dashboard";

/**
 * Supabase sends people back to the site root with these when a redirect URL
 * isn't on its allow list (the project's Site URL is the root). Today "/"
 * ignores them, so a request carrying one is left exactly as it was.
 */
const AUTH_RETURN_PARAMS = ["code", "token_hash", "error", "error_code", "error_description"];

/**
 * Set on the redirect so no cache between the reader and the site ever keeps
 * it: the same URL is a page for one person and a redirect for the next.
 */
export const SIGNED_IN_REDIRECT_CACHE_CONTROL = "private, no-store";

function pathOnly(path: string): string {
  const cut = path.search(/[?#]/);
  const p = cut === -1 ? path : path.slice(0, cut);
  // "/for-teams/" is the same page as "/for-teams". The root stays "/".
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/**
 * The middleware's decision for a SIGNED-IN request: the path to send them
 * to, or null to let the request through. Only GET and HEAD: a Server Action
 * posts to the page it's on (the footer's newsletter form is one), and a
 * redirect would swallow it. Only the exact path, so /for-teams/anything and
 * every API route are untouched. The query string isn't carried over.
 */
export function signedInRedirect(req: {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
}): string | null {
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  const to = SIGNED_IN_VERSION[pathOnly(req.pathname)];
  if (!to) return null;
  if (AUTH_RETURN_PARAMS.some((p) => req.searchParams.has(p))) return null;
  return to;
}

/**
 * Where /signup sends someone who is already signed in. `next` must already
 * have been through safeNextPath (src/lib/safe-next.ts). It's honored, so a
 * stale "/signup?next=<lesson>" tab puts them back on the lesson, except that
 * a page with a signed-in version goes straight to that version, and the
 * sign-in pages themselves fall back to the dashboard. (/login does the same
 * with its own HardRedirect to `next`, and the middleware covers the rest.)
 */
export function signedInLanding(safeNext: string | undefined): string {
  if (!safeNext) return SIGNED_IN_HOME;
  const path = pathOnly(safeNext);
  const version = SIGNED_IN_VERSION[path];
  if (version) return version;
  if (SIGNED_OUT_ONLY.includes(path)) return SIGNED_IN_HOME;
  return safeNext;
}

/**
 * A link's target for a signed-in reader: its signed-in version when it has
 * one, otherwise the link as it is. The logo, the navbar and the footer use
 * this once they know who is reading, so they skip the redirect hop.
 */
export function signedInHref(href: string): string {
  return SIGNED_IN_VERSION[href] ?? href;
}
