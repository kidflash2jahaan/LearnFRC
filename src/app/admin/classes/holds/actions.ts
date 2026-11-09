"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOT_CLASS_REVIEWER } from "@/lib/app/class-reviewers";
import {
  extendHold,
  holdRecordingLinks,
  noteHold,
  releaseHold,
  retryHoldCopy,
  type HeldRecordingLink,
} from "@/lib/classes/holds";

/**
 * The holds pages' door onto src/lib/classes/holds.ts. A "use server"
 * function is a public endpoint, so each shared function checks the caller
 * itself (a class reviewer, and the safety lead for anything restricted);
 * these only read the session and hand over the form.
 */

export type HoldFormState =
  | { error?: string; field?: "note" | "ncmecReportId"; message?: string }
  | undefined;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function asState(r: { ok: false; error: string; field?: string }): HoldFormState {
  const f = r.field === "note" || r.field === "ncmecReportId" ? r.field : undefined;
  return f ? { error: r.error, field: f } : { error: r.error };
}

export async function saveHoldNote(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_CLASS_REVIEWER };
  const r = await noteHold(user, {
    holdId: field(formData, "holdId"),
    note: field(formData, "note"),
    ncmecReportId: field(formData, "ncmecReportId"),
  });
  if (!r.ok) return asState(r);
  refresh();
  return { message: r.message };
}

export async function extendHoldAction(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_CLASS_REVIEWER };
  const r = await extendHold(user, { holdId: field(formData, "holdId"), note: field(formData, "note") });
  if (!r.ok) return asState(r);
  refresh();
  return { message: r.message };
}

export async function releaseHoldAction(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_CLASS_REVIEWER };
  const r = await releaseHold(user, { holdId: field(formData, "holdId"), note: field(formData, "note") });
  if (!r.ok) return asState(r);
  refresh();
  return { message: r.message };
}

export async function retryHoldCopyAction(_prev: HoldFormState, formData: FormData): Promise<HoldFormState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_CLASS_REVIEWER };
  const r = await retryHoldCopy(user, { holdId: field(formData, "holdId") });
  if (!r.ok) return asState(r);
  return { message: r.message };
}

/**
 * 15-minute links to a held recording. Returned to the page's player only:
 * never put in a URL the browser keeps, never stored.
 */
export async function holdRecordingLinksAction(
  holdId: string
): Promise<{ links?: HeldRecordingLink[]; error?: string }> {
  const user = await sessionUser();
  if (!user) return { error: NOT_CLASS_REVIEWER };
  const r = await holdRecordingLinks(user, { holdId });
  return r.ok ? { links: r.links } : { error: r.error };
}
