/**
 * Timestamps in /api/app/* responses all use one format, ISO 8601 in UTC with
 * milliseconds (`2026-10-13T16:20:00.000Z`), so the app needs one date parser.
 * Postgres hands back several shapes (`+00:00` offsets, zero to six fractional
 * digits), and the app's decoder shouldn't have to know that.
 */
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
