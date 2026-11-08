"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fileReport } from "@/lib/app/reports";
import { blockUser, unblockUser } from "@/lib/app/blocks";
import {
  banReportedAccount,
  removeReportedContent,
  resolveReport,
} from "@/lib/app/admin-reports";
import { NOT_ADMIN } from "@/lib/app/admin-access";

/**
 * The website's door onto reporting, blocking and the reports desk.
 *
 * Every rule (the reasons, the lengths, the rate limits, the one-open-report
 * rule, the email to the owner, the role checks, the ban) lives in
 * src/lib/app/reports.ts, blocks.ts and admin-reports.ts, shared with the
 * app's /api/app/reports, /api/app/blocks and /api/app/admin/reports routes,
 * so the two doors can't drift. A "use server" function is a public endpoint:
 * each shared function checks the caller itself.
 */

export type ReportState =
  | {
      error?: string;
      /** Which control the error is about, when it is about one. */
      field?: "reason" | "details";
      /** The sentence to show once it's filed. */
      message?: string;
      success?: boolean;
    }
  | undefined;

export type SafetyResult = { error?: string; ok?: boolean };

export type DeskState = { error?: string; field?: "note"; message?: string } | undefined;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

/** The cookie session's verified user, or null. */
async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/* ── Reporting ───────────────────────────────────────────────────── */

export async function reportContent(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first, then report it." };
  const result = await fileReport(user, {
    username: field(formData, "username"),
    contentKind: field(formData, "contentKind"),
    contentId: field(formData, "contentId"),
    reason: field(formData, "reason"),
    details: field(formData, "details"),
    surface: field(formData, "surface"),
    platform: "web",
  });
  if (result.ok) return { success: true, message: result.message };
  const f = result.field === "reason" || result.field === "details" ? result.field : undefined;
  return f ? { error: result.error, field: f } : { error: result.error };
}

/* ── Blocking ────────────────────────────────────────────────────── */

export async function blockAccount(username: string): Promise<SafetyResult> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const result = await blockUser(user, { username });
  if (!result.ok) return { error: result.error };
  // Every page that shows people reads the viewer's blocks as it renders.
  refresh();
  return { ok: true };
}

export async function unblockAccount(username: string): Promise<SafetyResult> {
  const user = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const result = await unblockUser(user, { username });
  if (!result.ok) return { error: result.error };
  refresh();
  return { ok: true };
}

/* ── The reports desk (admins; ban is super admins only) ─────────── */

export async function answerReport(_prev: DeskState, formData: FormData): Promise<DeskState> {
  const user = await sessionUser();
  if (!user) return { error: NOT_ADMIN };
  const id = field(formData, "id");
  const note = field(formData, "note");
  const action = field(formData, "action");

  if (action === "resolve") {
    const r = await resolveReport(user, { id, note });
    if (!r.ok) return r.field === "note" ? { error: r.error, field: "note" } : { error: r.error };
    return { message: "Closed. Nothing was taken down." };
  }
  if (action === "remove") {
    const r = await removeReportedContent(user, {
      id,
      note,
      replaceUsername: formData.get("replaceUsername") === "on",
    });
    if (!r.ok) return r.field === "note" ? { error: r.error, field: "note" } : { error: r.error };
    return {
      message: r.newUsername
        ? `Taken down. The account is @${r.newUsername} now.`
        : "Taken down.",
    };
  }
  if (action === "ban") {
    const r = await banReportedAccount(user, { id, note });
    if (!r.ok) return r.field === "note" ? { error: r.error, field: "note" } : { error: r.error };
    return { message: "Banned. The account is deleted and its email is on the ban list." };
  }
  return { error: "That request wasn't in the format we expected." };
}
