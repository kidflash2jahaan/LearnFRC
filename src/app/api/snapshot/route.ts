import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Bank the numbers so they can never disappear.
 *
 * WHY THIS EXISTS. Vercel Web Analytics on the Pro plan serves only the latest
 * 366 days. Ask for anything older and it refuses outright: "the pro plan only
 * grants access to the latest 366 days". So every traffic figure the admin
 * panel shows is a ROLLING WINDOW, not a total, and a number quoted today stops
 * being reproducible about a year later. That is fine for running the site and
 * useless for anything that has to stay true for years.
 *
 * THE TRICK. A month's traffic is immutable once the month has closed. Bank
 * each closed month exactly once into `traffic_months` and all-time traffic
 * becomes the SUM of banked rows, which only ever grows. The rolling window
 * stops mattering the moment a month is safely stored.
 *
 * Runs daily rather than monthly on purpose. A monthly job that fails takes a
 * whole month with it, permanently, because the source data is gone by the time
 * anyone notices. Daily means ~30 chances to bank each month, and re-running is
 * free because closed months are skipped and open ones are upserted.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VERCEL_API = "https://api.vercel.com/v1/query/web-analytics";

type MonthRow = { timestamp: string; visitors: number; pageviews: number };
type DimRow = Record<string, string | number>;

/**
 * The dimensions worth keeping. Every one was probed against this project;
 * anything absent here is absent because the API rejects it (referrerUrl,
 * hostname, httpStatus) or the plan refuses it (every utm* field, 402).
 */
const DIMENSIONS = [
  "referrerHostname",
  "country",
  "deviceType",
  "browserName",
  "osName",
  "route",
  "requestPath",
] as const;

/** Hard cap from the API: `limit` should be <= 100. */
const DIM_LIMIT = 100;

/** First day of the month, UTC, as YYYY-MM-DD. */
function monthKey(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

/** A month is final once we are past its last day, so its numbers are frozen. */
function isClosed(monthStart: string, now: Date): boolean {
  const next = new Date(monthStart + "T00:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  return now >= next;
}

function creds() {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  return token && projectId ? { token, projectId, teamId } : null;
}

/** One month, exact bounds. `until` is INCLUSIVE, so it is the month's last day. */
function monthBounds(monthStart: string) {
  const end = new Date(monthStart + "T00:00:00Z");
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0); // last day of the month we started in
  return { since: monthStart, until: end.toISOString().slice(0, 10) };
}

async function vercelQuery(
  kind: "count" | "aggregate",
  params: Record<string, string>
): Promise<Record<string, unknown> | null> {
  const c = creds();
  if (!c) return null;
  const qs = new URLSearchParams({
    projectId: c.projectId,
    ...(c.teamId ? { teamId: c.teamId } : {}),
    ...params,
  });
  const res = await fetch(`${VERCEL_API}/visits/${kind}?${qs}`, {
    headers: { Authorization: `Bearer ${c.token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

async function vercelMonths(): Promise<MonthRow[] | null> {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) return null;

  // 365, not 366: asking for exactly the limit intermittently trips the
  // boundary check and returns 400 for the whole request.
  const until = new Date();
  const since = new Date(until.getTime() - 365 * 86_400_000);
  const params = new URLSearchParams({
    projectId,
    ...(teamId ? { teamId } : {}),
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
    by: "month",
    limit: "40",
  });

  const res = await fetch(`${VERCEL_API}/visits/aggregate?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: MonthRow[] };
  return json.data ?? null;
}

export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the query form is
  // there so it can be triggered by hand while testing.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const qs = new URL(req.url).searchParams.get("secret");
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // ---- 1. bank the months -------------------------------------------------
  const months = await vercelMonths();
  let banked = 0;
  let skipped = 0;
  const monthErrors: string[] = [];

  if (months) {
    const { data: existing } = await supabase
      .from("traffic_months")
      .select("month, is_final");
    const final = new Set(
      (existing ?? []).filter((r) => r.is_final).map((r) => r.month as string)
    );

    for (const m of months) {
      const key = monthKey(String(m.timestamp));
      // A closed month already banked is frozen. Never rewrite it: if Vercel
      // ever returns a truncated figure for an ageing month, overwriting would
      // silently destroy the very record this table exists to protect.
      if (final.has(key)) {
        skipped++;
        continue;
      }
      if (m.pageviews === 0 && m.visitors === 0) continue;

      const { error } = await supabase.from("traffic_months").upsert(
        {
          month: key,
          visitors: m.visitors,
          pageviews: m.pageviews,
          is_final: isClosed(key, now),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "month" }
      );
      if (error) monthErrors.push(`${key}: ${error.message}`);
      else banked++;
    }
  }

  // ---- 1b. bank each month's breakdowns -----------------------------------
  // Rows are stored verbatim. A period total is NEVER derived by summing the
  // visitors column across a dimension: one person who arrives via Google and
  // again directly appears in both rows, which measured 3,464 against a real
  // 3,025 for August. The authoritative total lives in traffic_months.
  let dimRows = 0;
  const checks: { month: string; dimension: string; delta: number }[] = [];

  if (months) {
    const { data: doneRows } = await supabase
      .from("traffic_breakdowns")
      .select("month, dimension")
      .eq("is_final", true);
    const done = new Set(
      (doneRows ?? []).map((r) => `${r.month}|${r.dimension}`)
    );

    for (const m of months) {
      const key = monthKey(String(m.timestamp));
      if (m.pageviews === 0) continue;
      const closed = isClosed(key, now);
      const { since, until } = monthBounds(key);

      const totalJson = await vercelQuery("count", { since, until });
      const periodViews =
        ((totalJson?.data as { pageviews?: number })?.pageviews ?? 0) | 0;

      for (const dim of DIMENSIONS) {
        if (done.has(`${key}|${dim}`)) continue;
        const json = await vercelQuery("aggregate", {
          since,
          until,
          by: dim,
          limit: String(DIM_LIMIT),
        });
        const rows = (json?.data as DimRow[]) ?? [];
        if (rows.length === 0) continue;

        let summed = 0;
        for (const r of rows) {
          const value = String(r[dim] ?? "");
          summed += Number(r.pageviews) || 0;
          const { error } = await supabase.from("traffic_breakdowns").upsert(
            {
              month: key,
              dimension: dim,
              // Empty hostname is Vercel's direct traffic. Name it, so the
              // row is not mistaken for a missing value later.
              value: value === "" ? "(direct)" : value,
              visitors: Number(r.visitors) || 0,
              pageviews: Number(r.pageviews) || 0,
              is_final: closed,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "month,dimension,value" }
          );
          if (!error) dimRows++;
        }

        // Keep the shortfall visible rather than letting it pass as data.
        await supabase.from("traffic_month_checks").upsert(
          {
            month: key,
            dimension: dim,
            period_pageviews: periodViews,
            summed_pageviews: summed,
            delta: summed - periodViews,
            checked_at: new Date().toISOString(),
          },
          { onConflict: "month,dimension" }
        );
        if (summed !== periodViews)
          checks.push({ month: key, dimension: dim, delta: summed - periodViews });
      }
    }
  }

  // ---- 2. the all-time total, summed from banked rows ---------------------
  const { data: ledger } = await supabase
    .from("traffic_months")
    .select("month, visitors, pageviews, is_final")
    .order("month", { ascending: true });

  const allTime = (ledger ?? []).reduce(
    (a, r) => ({
      visitors: a.visitors + (r.visitors ?? 0),
      pageviews: a.pageviews + (r.pageviews ?? 0),
    }),
    { visitors: 0, pageviews: 0 }
  );

  // ---- 3. the database side, which never expires --------------------------
  const count = async (table: string, filter?: [string, string]) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = q.not(filter[0], "is", null);
    const { count: n } = await q;
    return n ?? 0;
  };

  const { data: teamRows } = await supabase
    .from("profiles")
    .select("team_number")
    .not("team_number", "is", null);

  const { data: xpRows } = await supabase.from("profiles").select("xp");
  const totalXp = (xpRows ?? []).reduce((a, r) => a + (r.xp ?? 0), 0);

  const database = {
    accounts: await count("profiles"),
    accountsWithTeam: (teamRows ?? []).length,
    distinctFrcTeams: new Set((teamRows ?? []).map((t) => t.team_number)).size,
    lessonCompletions: await count("lesson_progress", ["completed_at", ""]),
    lessonsPublished: await count("lessons"),
    modules: await count("modules"),
    departments: await count("departments"),
    articles: await count("articles"),
    achievementsEarned: await count("user_achievements"),
    bookmarks: await count("bookmarks"),
    subscribers: await count("subscribers"),
    feedback: await count("feedback"),
    contentEdits: await count("content_edits"),
    contentSubmissions: await count("content_submissions"),
    guestProgressRows: await count("guest_progress"),
    totalXp,
  };

  const traffic = {
    allTime,
    months: ledger ?? [],
    vercelReachable: months !== null,
  };

  const { error: snapErr } = await supabase.from("stats_snapshots").upsert(
    { captured_on: today, traffic, database_counts: database },
    { onConflict: "captured_on" }
  );

  return NextResponse.json({
    ok: true,
    capturedOn: today,
    banked,
    breakdownRows: dimRows,
    reconciliationGaps: checks.length,
    skippedFinal: skipped,
    monthsOnRecord: (ledger ?? []).length,
    allTime,
    database,
    ...(monthErrors.length ? { monthErrors } : {}),
    ...(snapErr ? { snapshotError: snapErr.message } : {}),
    ...(months === null
      ? { warning: "Vercel unreachable, months not banked this run" }
      : {}),
  });
}
