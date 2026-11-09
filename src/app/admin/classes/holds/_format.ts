/**
 * Dates on the holds pages: UTC and table-driven, the rule /admin and
 * /admin/team follow, so a Server Component's output never depends on the
 * server's ICU build. Holds are historical records, so the year always shows.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function utcDay(iso: string | null | undefined): string {
  if (!iso) return "not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not recorded";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function utcStamp(iso: string | null | undefined): string {
  if (!iso) return "not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "not recorded";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${utcDay(iso)}, ${hh}:${mm} UTC`;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Seconds into a session as [mm:ss], or [h:mm:ss] past an hour. */
export function clock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "[--:--]";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `[${h}:${String(m).padStart(2, "0")}:${sec}]` : `[${String(m).padStart(2, "0")}:${sec}]`;
}

export function megabytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
