import "server-only";
import { NextResponse } from "next/server";
import { getAppUser, type AppSession } from "@/lib/app/auth";
import type { AppErrorCode, Failure } from "@/lib/app/result";

/**
 * Response helpers for the /api/app/* routes, so every route answers in the
 * same shape: JSON, camelCase, `Cache-Control: no-store` for anything per-user,
 * and errors as `{ error, code }` with a matching HTTP status (429s carry
 * Retry-After). The contract is apple/docs/ARCHITECTURE.md section 7 and the
 * full reference is apple/docs/API.md.
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

const STATUS: Record<AppErrorCode, number> = {
  unauthorized: 401,
  validation: 400,
  rate_limited: 429,
  not_found: 404,
  conflict: 409,
  server: 500,
};

/** A per-user success response. Never cached anywhere. */
export function ok(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** A public success response the CDN may cache for `sMaxAge` seconds. */
export function publicOk(body: unknown, sMaxAge: number, swr = sMaxAge * 5): NextResponse {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    },
  });
}

export function apiError(
  code: AppErrorCode,
  error: string,
  opts: { status?: number; retryAfter?: number } = {}
): NextResponse {
  const headers: Record<string, string> = { ...NO_STORE };
  if (code === "rate_limited") headers["Retry-After"] = String(opts.retryAfter ?? 60);
  return NextResponse.json(
    { error, code },
    { status: opts.status ?? STATUS[code], headers }
  );
}

/** Turn a shared function's failure into the matching HTTP response. */
export function fromFailure(f: Failure): NextResponse {
  return apiError(f.code, f.error, { retryAfter: f.retryAfter });
}

export function unauthorized(): NextResponse {
  return apiError("unauthorized", "Sign in again to keep going.");
}

export function serverError(): NextResponse {
  return apiError("server", "Something went wrong on our side. Try again in a moment.");
}

/**
 * The verified caller, or a ready-made 401 response. Usage:
 *   const auth = await requireAppUser(req);
 *   if (auth instanceof Response) return auth;
 */
export async function requireAppUser(req: Request): Promise<AppSession | NextResponse> {
  const session = await getAppUser(req);
  return session ?? unauthorized();
}

/** The JSON body as a plain object, or null when it isn't one. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function badJson(): NextResponse {
  return apiError("validation", "That request wasn't in the format we expected.");
}

/** Run a handler and turn anything it throws into a plain 500. */
export async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    console.error("[api/app]", (e as Error)?.message ?? e);
    return serverError();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
