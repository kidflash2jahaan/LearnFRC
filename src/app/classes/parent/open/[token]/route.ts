import { NextResponse, type NextRequest } from "next/server";
import { classesVisible } from "@/lib/classes/config";
import { openParentLink } from "@/lib/app/class-consent";
import {
  PARENT_COOKIE,
  PARENT_COOKIE_PATH,
  PARENT_COOKIE_SECONDS,
} from "@/lib/classes/consent-rules";

/**
 * The button in the parent email (classes-design.md section 5.1).
 *
 * The token never reaches a page: this handler checks it, leaves it in an
 * httpOnly cookie scoped to /classes/parent for an hour, and answers 303 to
 * the plain /classes/parent. So it never shows in analytics, the browser's
 * history or a Referer header. Nothing is decided on a GET: a mail scanner
 * that prefetches the link only gets a cookie it throws away, and the parent
 * decides with a POST from the page.
 *
 * A used, expired or unknown token gets no cookie and lands on the same page
 * with ?link=closed, which says so in plain words. Too many tries from one
 * network get ?link=busy.
 */

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!(await classesVisible())) {
    return new NextResponse("Not found", { status: 404, headers: NO_STORE });
  }
  const { token } = await params;
  const ip =
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const outcome = await openParentLink(token, { ip });
  const to = new URL(outcome === "open" ? "/classes/parent" : `/classes/parent?link=${outcome}`, request.url);
  const res = NextResponse.redirect(to, 303);
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v);
  if (outcome === "open") {
    res.cookies.set(PARENT_COOKIE, token, {
      path: PARENT_COOKIE_PATH,
      maxAge: PARENT_COOKIE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
