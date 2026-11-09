import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateSwitches,
  rtkAppFor,
  type ClassSwitches,
} from "@/lib/classes/constants";
import type { ClassSettingsRow, RtkApp } from "@/lib/classes/types";

export * from "@/lib/classes/constants";

/**
 * Live classes: everything that reads the environment or the settings row.
 * The pure limits are in ./constants.ts (client-safe) and re-exported here.
 *
 * The env vars are listed in classes-design.md section 13.1 and .env.example.
 * The six Cloudflare and AI names match `.claude-scratch/classes-dev/keys.env`
 * word for word.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://learnfrc.com").replace(/\/$/, "");

const isProductionBuild = () => process.env.NODE_ENV === "production";

/** CLASSES_DEV_SWITCHES=1 on a dev server (ignored by production builds). */
export function classesDevSwitches(): boolean {
  return !isProductionBuild() && process.env.CLASSES_DEV_SWITCHES === "1";
}

/** CLASSES_DEV_ALLOW_SOON=1: a test may schedule a class minutes ahead. */
export function classesDevAllowSoon(): boolean {
  return !isProductionBuild() && process.env.CLASSES_DEV_ALLOW_SOON === "1";
}

/* ── RealtimeKit ───────────────────────────────────────────────────── */

/** `prod` on Vercel Production, `dev` everywhere else (section 6.1). */
export function rtkApp(): RtkApp {
  return rtkAppFor(process.env.VERCEL_ENV);
}

/** The RealtimeKit app id for `app` (default: this deployment's). */
export function rtkAppId(app: RtkApp = rtkApp()): string | null {
  const id =
    app === "prod"
      ? process.env.CLOUDFLARE_REALTIMEKIT_APP_ID_PROD
      : process.env.CLOUDFLARE_REALTIMEKIT_APP_ID_DEV;
  return id?.trim() || null;
}

export function cloudflareAccountId(): string | null {
  return process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || null;
}

export function rtkApiToken(): string | null {
  return process.env.CLOUDFLARE_REALTIMEKIT_API_TOKEN?.trim() || null;
}

/**
 * True when this deployment can talk to its RealtimeKit app. When false,
 * pages say "Classes open soon" and every action refuses politely.
 */
export function classesConfigured(): boolean {
  return !!(cloudflareAccountId() && rtkApiToken() && rtkAppId());
}

/* ── Other services ────────────────────────────────────────────────── */

/** The private R2 bucket evidence holds go in (section 8.2). */
export function r2HoldsBucket(): string {
  return (
    process.env.R2_HOLDS_BUCKET?.trim() ||
    (rtkApp() === "prod" ? "learnfrc-class-holds" : "learnfrc-class-holds-dev")
  );
}

export function r2Credentials(): { accessKeyId: string; secretAccessKey: string } | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : null;
}

/** The AI Gateway model id for the review notes (section 7.3). */
export function reviewModel(): string {
  return process.env.CLASSES_REVIEW_MODEL?.trim() || "anthropic/claude-opus-5.5";
}

/**
 * Where safety email goes: Dhiren's address in production, a test address on
 * dev servers. Null when unset, and the caller falls back to the owner.
 */
export function safetyEmail(): string | null {
  return process.env.CLASSES_SAFETY_EMAIL?.trim() || null;
}

/** The owner's address (the first ADMIN_EMAILS entry), as reports use. */
export function ownerEmail(): string | null {
  const first = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  return first || null;
}

/** Account ids that never get an hours letter (Jahaan's accounts, section 9.1). */
export function noLetterUserIds(): Set<string> {
  return new Set(
    (process.env.CLASSES_NO_LETTER_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * The salt for IP hashes (HMAC). Production must set CLASSES_AUDIT_SALT; a dev
 * server without one uses a fixed dev value, so hashes still compare.
 */
export function auditSalt(): string {
  const salt = process.env.CLASSES_AUDIT_SALT?.trim();
  if (salt) return salt;
  if (isProductionBuild()) throw new Error("CLASSES_AUDIT_SALT is not set");
  return "learnfrc-classes-dev-salt";
}

/* ── The settings row and the two switches ─────────────────────────── */

export const DEFAULT_CLASS_SETTINGS: Omit<ClassSettingsRow, "updated_at"> = {
  id: true,
  classes_visible: false,
  joins_paused: true,
  paused_reason: "not launched yet",
  safety_lead_user_id: null,
  monthly_minute_cap: 40000,
  max_live_classes: 3,
  min_student_account_days: 7,
  rtk_webhook_ids: {},
  rtk_organization_id: null,
  last_daily_sweep_at: null,
  updated_by: null,
};

/**
 * The class_settings row, read once per request. A read error returns the
 * defaults (hidden and paused), so a database hiccup can only close classes,
 * never open them.
 */
export const getClassSettings = cache(async (): Promise<ClassSettingsRow> => {
  try {
    const { data, error } = await createAdminClient()
      .from("class_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_CLASS_SETTINGS, updated_at: new Date(0).toISOString() };
    return data as ClassSettingsRow;
  } catch {
    return { ...DEFAULT_CLASS_SETTINGS, updated_at: new Date(0).toISOString() };
  }
});

/** Both switches, after the dev override (section 1). */
export async function classSwitches(): Promise<ClassSwitches> {
  if (classesDevSwitches()) return { visible: true, joinsPaused: false };
  // Skip the database read when the env switch is off: hidden either way.
  if (process.env.CLASSES_VISIBLE !== "1") return { visible: false, joinsPaused: true };
  const s = await getClassSettings();
  return evaluateSwitches({
    nodeEnv: process.env.NODE_ENV,
    devSwitches: process.env.CLASSES_DEV_SWITCHES,
    envVisible: process.env.CLASSES_VISIBLE,
    dbVisible: s.classes_visible,
    dbJoinsPaused: s.joins_paused,
  });
}

/**
 * Whether anything about classes may show: the nav entry, the homepage
 * section, /classes, /apply/teach, the footer link, the sitemap entries and
 * the app's Classes card. Every class action and route refuses while false.
 */
export async function classesVisible(): Promise<boolean> {
  return (await classSwitches()).visible;
}

/** Whether joins are paused (staff skip the pause so they can test). */
export async function joinsPaused(): Promise<boolean> {
  return (await classSwitches()).joinsPaused;
}

/* ── URLs ──────────────────────────────────────────────────────────── */

export const classUrl = (id: string) => `${SITE_URL}/classes/${id}`;
export const classRoomUrl = (id: string) => `${SITE_URL}/classes/${id}/room`;
export const adminClassUrl = (id: string) => `${SITE_URL}/admin/classes/${id}`;
export const teachUrl = () => `${SITE_URL}/apply/teach`;
export const letterVerifyUrl = (code: string) => `${SITE_URL}/verify/${code}`;
export const playbookUrl = () => `${SITE_URL}/admin/classes/playbook`;
