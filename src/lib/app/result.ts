import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The shared shape every function in src/lib/app/* returns.
 *
 * WHY THIS FOLDER EXISTS. learnfrc.com has two front doors onto the same rules:
 * the website's Server Actions and route handlers (cookie session), and the
 * native app's /api/app/* routes (Bearer token). Every rule with a consequence,
 * the quiz gate, rate limits, username rules, XP readback, achievements, email
 * consent, account deletion, lives in this folder ONCE and both doors call it.
 * The repo has already shipped drift bugs between two auth doors (see
 * src/lib/signup-attribution.ts), so a rule added to only one door is a bug.
 *
 * The failure `error` strings are the website's user-facing copy, unchanged,
 * and the app shows them as sent. `code` is for the app's error handling only.
 */

export type AppErrorCode =
  | "unauthorized"
  /** Signed in, but the account's site role can't do this (HTTP 403). Never
      used for "signed out": the app treats a 401 as the session ending. */
  | "forbidden"
  | "validation"
  | "rate_limited"
  | "not_found"
  | "conflict"
  | "server";

export type Failure = {
  ok: false;
  code: AppErrorCode;
  /** Human sentence, the website's own copy. */
  error: string;
  /** Seconds, for a rate-limited failure: the length of the limit's window. */
  retryAfter?: number;
  /** The input the failure is about, when it is about one (the website's
      review form marks that control invalid; the app can do the same). */
  field?: string;
};

export type Success<T extends object = object> = { ok: true } & T;
export type Result<T extends object = object> = Success<T> | Failure;

export function fail(
  code: AppErrorCode,
  error: string,
  retryAfter?: number
): Failure {
  return retryAfter ? { ok: false, code, error, retryAfter } : { ok: false, code, error };
}

/**
 * The two database clients a shared function works with.
 *
 * `supabase` acts AS the signed-in user (the website's cookie client, or the
 * app's Bearer-token client), so anything read through it is limited by RLS to
 * that user's own rows. `admin` is the service-role client, used only for
 * writes and reads the user's role can't do, and always scoped by the id that
 * auth.getUser() verified against the auth server.
 */
export type AppClients = {
  supabase: SupabaseClient;
  admin: SupabaseClient;
};

export function clientsFor(supabase: SupabaseClient): AppClients {
  return { supabase, admin: createAdminClient() };
}

/** The verified caller, as both doors hand it to the shared functions. */
export type AppUser = Pick<User, "id" | "email" | "created_at">;
