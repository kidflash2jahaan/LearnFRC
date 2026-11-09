"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  checkRerunAs,
  decideClassAs,
  endLiveClass,
  findParentConsentsAs,
  holdByHandAs,
  pullFromCloudflareAs,
  releaseReview,
  revokeParentConsentAs,
  reviewerFor,
  setClassesVisibleAs,
  setPause,
  setSafetyLeadAs,
  updateClassSettingsAs,
  type ConsentLookupRow,
} from "@/lib/app/admin-classes";
import { runClassReview } from "@/lib/classes/review";

/**
 * The website's door onto /admin/classes and /admin/classes/[id]. Every rule
 * (who may, what each decision writes, the emails) is in
 * src/lib/app/admin-classes.ts. A "use server" function is a public
 * endpoint, so each one checks the session and the reviewer role first.
 */

export type ClassAdminState =
  | { error?: string; field?: string; message?: string; rows?: ConsentLookupRow[] }
  | undefined;

const SIGN_IN = "Sign in again, then try that.";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function reviewer() {
  const user = await sessionUser();
  if (!user) return { user: null, error: SIGN_IN } as const;
  const g = await reviewerFor(user);
  if (!g.ok) return { user, error: g.error } as const;
  return { user, reviewer: g.reviewer } as const;
}

function asState(res: { ok: boolean; error?: string; field?: string; message?: string }, fallback: string): ClassAdminState {
  if (!res.ok) return { error: res.error, field: res.field };
  return { message: res.message ?? fallback };
}

function wholeNumber(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/* ── The decision ──────────────────────────────────────────────────── */

export async function decideClassAction(_prev: ClassAdminState, formData: FormData): Promise<ClassAdminState> {
  const r = await reviewer();
  if (!("reviewer" in r) || !r.reviewer) return { error: r.error };
  const decision = text(formData, "decision");
  if (decision !== "approve" && decision !== "reject") return { error: "Pick Approve or Reject.", field: "decision" };
  const minutes = wholeNumber(text(formData, "minutes"));
  if (Number.isNaN(minutes)) return { error: "Minutes must be a whole number.", field: "minutes" };
  const res = await decideClassAs(r.reviewer, {
    classId: text(formData, "classId"),
    decision,
    minutesOverride: decision === "approve" ? minutes : null,
    excludeFlagged: formData.get("excludeFlagged") === "on",
    note: text(formData, "note") || null,
    tellTeacher: formData.get("tellTeacher") === "on",
    forSafety: formData.get("forSafety") === "on",
  });
  if (res.ok) refresh();
  return asState(res, "Saved.");
}

/* ── One-button tools ──────────────────────────────────────────────── */

/**
 * The buttons on the desk and the review page, by `tool`:
 * rerun, pull, hold, release, end, revoke, visible, pause.
 */
export async function classAdminTool(_prev: ClassAdminState, formData: FormData): Promise<ClassAdminState> {
  const r = await reviewer();
  if (!("reviewer" in r) || !r.reviewer || !r.user) return { error: r.error };
  const tool = text(formData, "tool");
  const classId = text(formData, "classId");

  switch (tool) {
    case "rerun": {
      const ok = await checkRerunAs(r.reviewer, classId);
      if (!ok.ok) return { error: ok.error };
      after(async () => {
        await runClassReview(classId, { force: true });
      });
      return { message: "Rerunning the notes. Refresh in a minute or two." };
    }
    case "pull": {
      const res = await pullFromCloudflareAs(r.reviewer, classId);
      if (res.ok) refresh();
      return asState(res, "Pulled.");
    }
    case "hold": {
      const res = await holdByHandAs(r.reviewer, classId, text(formData, "note") || null);
      if (res.ok) refresh();
      return asState(res, "Held.");
    }
    case "release": {
      const res = await releaseReview(r.user, classId);
      if (res.ok) refresh();
      return asState(res, "Released.");
    }
    case "end": {
      const res = await endLiveClass(r.user, classId);
      if (res.ok) refresh();
      return asState(res, "Ended for everyone.");
    }
    case "revoke": {
      const res = await revokeParentConsentAs(r.reviewer, text(formData, "consentId"));
      return asState(res, "Revoked.");
    }
    case "visible": {
      const res = await setClassesVisibleAs(r.reviewer, text(formData, "visible") === "1");
      if (res.ok) refresh();
      return asState(res, "Saved.");
    }
    case "pause": {
      const paused = text(formData, "paused") === "1";
      const reason = text(formData, "reason");
      if (paused && reason.length > 200) return { error: "Keep the reason under 200 characters.", field: "reason" };
      const res = await setPause(r.user, paused, reason || null);
      if (res.ok) refresh();
      return asState(res, paused ? "Joins are paused and live classes ended." : "Joins are open.");
    }
    default:
      return { error: "That isn't something this page can do." };
  }
}

/* ── Settings ──────────────────────────────────────────────────────── */

export async function classSettingsAction(_prev: ClassAdminState, formData: FormData): Promise<ClassAdminState> {
  const r = await reviewer();
  if (!("reviewer" in r) || !r.reviewer) return { error: r.error };
  const num = (k: string) => Number(text(formData, k));
  const res = await updateClassSettingsAs(r.reviewer, {
    monthlyMinuteCap: num("monthlyMinuteCap"),
    maxLiveClasses: num("maxLiveClasses"),
    minStudentAccountDays: num("minStudentAccountDays"),
  });
  if (res.ok) refresh();
  return asState(res, "Saved.");
}

export async function safetyLeadAction(_prev: ClassAdminState, formData: FormData): Promise<ClassAdminState> {
  const r = await reviewer();
  if (!("reviewer" in r) || !r.reviewer) return { error: r.error };
  const res = await setSafetyLeadAs(r.reviewer, text(formData, "handle"));
  if (res.ok) refresh();
  return asState(res, "Saved.");
}

export async function consentLookupAction(_prev: ClassAdminState, formData: FormData): Promise<ClassAdminState> {
  const r = await reviewer();
  if (!("reviewer" in r) || !r.reviewer) return { error: r.error };
  const res = await findParentConsentsAs(r.reviewer, text(formData, "handle"));
  if (!res.ok) return { error: res.error, field: res.field };
  return { rows: res.rows, message: res.rows.length ? undefined : "No parent requests for that username." };
}
