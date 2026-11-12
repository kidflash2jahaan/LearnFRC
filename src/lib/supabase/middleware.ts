import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SIGNED_IN_REDIRECT_CACHE_CONTROL,
  signedInRedirect,
} from "@/lib/signed-in-routes";

const PROTECTED = ["/dashboard", "/profile", "/settings", "/bookmarks", "/admin"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: keep getUser() right after client creation — refreshes tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Signed in, on a page that has a signed-in version (src/lib/signed-in-routes.ts):
  // "/" goes to /dashboard, /for-teams to /teams. Signed-out visitors and
  // crawlers never get here, so they keep getting the cached page.
  const to = user
    ? signedInRedirect({
        method: request.method,
        pathname: path,
        searchParams: request.nextUrl.searchParams,
      })
    : null;
  if (to) {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // getUser() may have just refreshed the tokens. Dropping the new cookies
    // here would leave the browser holding a refresh token that's already
    // been used, which signs the person out on a later request.
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    // The same URL is a page for one reader and a redirect for the next, so
    // nothing in between may keep this.
    redirect.headers.set("Cache-Control", SIGNED_IN_REDIRECT_CACHE_CONTROL);
    return redirect;
  }

  return supabaseResponse;
}
