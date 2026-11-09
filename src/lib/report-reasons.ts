/**
 * The reasons a report can give, in the order the report form lists them.
 *
 * No imports and no `server-only`, so the report form (a client component)
 * and the class report panel can list them, and src/lib/app/reports.ts, which
 * re-exports everything here, checks every report against the same lists.
 *
 * REPORT_REASONS is the list the native app hard-codes (SafetyModels.swift)
 * and GET /api/app/reports sends. Don't change or reorder it.
 *
 * Live classes (classes-design.md section 10.2) put three class-only reasons
 * first and keep the six after them. fileReport accepts the class-only ids
 * only for a report with contentKind "class".
 */

export const REPORT_REASONS = [
  { id: "harassment", label: "Bullying or harassment" },
  { id: "offensive", label: "Offensive or inappropriate" },
  { id: "personal_info", label: "Sharing someone's personal information" },
  { id: "impersonation", label: "Pretending to be someone else" },
  { id: "spam", label: "Spam or cheating" },
  { id: "other", label: "Something else" },
] as const;

/** The reasons only a class report can give (user_reports.reason accepts them). */
export const CLASS_ONLY_REPORT_REASONS = [
  { id: "private_contact", label: "Asked me to talk privately or meet up" },
  { id: "sexual", label: "Sexual or inappropriate" },
  { id: "unsafe", label: "I feel unsafe" },
] as const;

/** What the class report panel lists: the class-only three, then the usual six. */
export const CLASS_REPORT_REASONS = [...CLASS_ONLY_REPORT_REASONS, ...REPORT_REASONS] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
export type ClassReportReason = (typeof CLASS_REPORT_REASONS)[number]["id"];

/** The words for a reason id, from either list. */
export function reasonLabel(id: string | null | undefined): string {
  return CLASS_REPORT_REASONS.find((r) => r.id === id)?.label ?? "Something else";
}
