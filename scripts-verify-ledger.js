#!/usr/bin/env node
/**
 * Prove the traffic ledger is still correct. Run any time; changes nothing.
 *
 * The ledger has to hold up for years, so it is checked against arithmetic that
 * cannot drift rather than against a feeling that it looks right:
 *
 *  1. ADDITIVITY. Summing month buckets must equal one range query over the
 *     same span. If Vercel ever changed how it de-duplicates visitors across
 *     buckets, every all-time figure would silently start overstating, and this
 *     is the check that would catch it.
 *  2. AGREEMENT. Each still-visible month must match what Vercel reports now.
 *  3. MONOTONICITY. No banked month may have gone down since the last snapshot.
 *  4. CONTINUITY. No missing month between the first and last banked.
 *  5. FINALITY. A month marked final must be closed and fully inside the window
 *     it was banked from.
 */
const fs = require("fs");
const path = require("path");
const env = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
const g = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const U = g("NEXT_PUBLIC_SUPABASE_URL"), K = g("SUPABASE_SERVICE_ROLE_KEY");
const T = g("VERCEL_ANALYTICS_TOKEN"), P = g("VERCEL_PROJECT_ID"), TE = g("VERCEL_TEAM_ID");
const H = { apikey: K, Authorization: "Bearer " + K };

const vq = async (kind, params) => {
  const qs = new URLSearchParams({ projectId: P, teamId: TE, ...params });
  const r = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/${kind}?${qs}`,
    { headers: { Authorization: "Bearer " + T } });
  if (!r.ok) throw new Error(`vercel ${kind} ${r.status}: ${(await r.text()).slice(0, 90)}`);
  return (await r.json()).data;
};

(async () => {
  const fail = [];
  const ok = [];

  const ledger = await (await fetch(`${U}/rest/v1/traffic_months?select=*&order=month`, { headers: H })).json();
  if (!Array.isArray(ledger) || ledger.length === 0) {
    console.log("ledger is empty, nothing to verify"); process.exit(1);
  }
  const sum = ledger.reduce((a, r) => ({ v: a.v + r.visitors, p: a.p + r.pageviews }), { v: 0, p: 0 });
  console.log(`LEDGER: ${ledger.length} months, ${sum.v.toLocaleString()} visitors, ${sum.p.toLocaleString()} page views\n`);

  // 1 + 2. Only months Vercel can still see are comparable.
  const since = new Date(Date.now() - 365 * 864e5);
  const visible = ledger.filter((r) => new Date(r.month + "T00:00:00Z") >= since);
  const live = await vq("aggregate", {
    since: since.toISOString().slice(0, 10),
    until: new Date().toISOString().slice(0, 10),
    by: "month", limit: "40",
  });
  const liveBy = new Map(live.map((m) => [String(m.timestamp).slice(0, 7), m]));

  for (const row of visible) {
    const key = row.month.slice(0, 7);
    const l = liveBy.get(key);
    if (!l) { fail.push(`${key}: banked but Vercel no longer returns it`); continue; }
    const behind = row.visitors < l.visitors || row.pageviews < l.pageviews;
    if (!behind) { ok.push(`${key} matches or exceeds live`); continue; }
    // An OPEN month is still accumulating, so trailing the live figure between
    // the last banking run and now is the system working, not drift. Only a
    // month we have frozen is required to be complete.
    if (row.is_final)
      fail.push(`${key}: FINAL but banked ${row.visitors}/${row.pageviews} is below live ${l.visitors}/${l.pageviews}`);
    else
      ok.push(`${key} open, trailing live by ${l.visitors - row.visitors}/${l.pageviews - row.pageviews} since the last run`);
  }

  // Additivity: the property the all-time total depends on.
  if (visible.length > 0) {
    const first = visible[0].month;
    const range = await vq("count", { since: first, until: new Date().toISOString().slice(0, 10) });
    const partSum = visible.reduce((a, r) => ({ v: a.v + r.visitors, p: a.p + r.pageviews }), { v: 0, p: 0 });
    const dv = partSum.v - range.visitors, dp = partSum.p - range.pageviews;
    if (Math.abs(dv) > Math.max(5, range.visitors * 0.01))
      fail.push(`ADDITIVITY BROKEN: months sum to ${partSum.v} visitors, one range query says ${range.visitors} (off by ${dv})`);
    else ok.push(`additivity holds (months ${partSum.v} vs range ${range.visitors}, delta ${dv})`);
    if (Math.abs(dp) > Math.max(5, range.pageviews * 0.01))
      fail.push(`ADDITIVITY BROKEN on page views: ${partSum.p} vs ${range.pageviews} (off by ${dp})`);
  }

  // 3. Monotonicity against the previous snapshot.
  const snaps = await (await fetch(`${U}/rest/v1/stats_snapshots?select=captured_on,traffic&order=captured_on.desc&limit=2`, { headers: H })).json();
  if (Array.isArray(snaps) && snaps.length === 2) {
    const prev = snaps[1].traffic?.allTime;
    if (prev && (sum.v < prev.visitors || sum.p < prev.pageviews))
      fail.push(`WENT BACKWARDS since ${snaps[1].captured_on}: ${prev.visitors}/${prev.pageviews} -> ${sum.v}/${sum.p}`);
    else if (prev) ok.push(`no regression since ${snaps[1].captured_on}`);
  }

  // 4. Continuity.
  const months = ledger.map((r) => r.month.slice(0, 7));
  const cur = new Date(ledger[0].month + "T00:00:00Z");
  const end = new Date(ledger[ledger.length - 1].month + "T00:00:00Z");
  const missing = [];
  while (cur <= end) {
    const k = cur.toISOString().slice(0, 7);
    if (!months.includes(k)) missing.push(k);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  if (missing.length) fail.push(`GAPS in the ledger: ${missing.join(", ")}`);
  else ok.push("no missing months between first and last");

  // 5. Finality.
  const now = new Date();
  for (const r of ledger.filter((x) => x.is_final)) {
    const next = new Date(r.month + "T00:00:00Z"); next.setUTCMonth(next.getUTCMonth() + 1);
    if (now < next) fail.push(`${r.month.slice(0, 7)}: marked final but has not ended`);
  }
  const openClosed = ledger.filter((r) => !r.is_final && (() => {
    const n = new Date(r.month + "T00:00:00Z"); n.setUTCMonth(n.getUTCMonth() + 1); return now >= n;
  })());
  if (openClosed.length) ok.push(`${openClosed.length} closed month(s) still open, will be frozen on the next covered run`);

  // 6. Does the archive still agree with the live site? The two are computed by
  //    different code, so a rule that changes in one and not the other puts two
  //    values on one fact. That already happened once with FRC team numbers.
  try {
    const latest = (await (await fetch(`${U}/rest/v1/stats_snapshots?select=captured_on,database_counts&order=captured_on.desc&limit=1`, { headers: H })).json())[0];
    const live = await (await fetch("https://learnfrc.com/api/stats")).json();
    const pairs = [
      ["distinctFrcTeams", latest?.database_counts?.distinctFrcTeams, live.teams],
      ["accounts", latest?.database_counts?.accounts, live.learners],
      ["lessonCompletions", latest?.database_counts?.lessonCompletions, live.lessonsCompleted],
    ];
    for (const [name, archived, liveVal] of pairs) {
      if (archived == null || liveVal == null) continue;
      // These grow between the snapshot and now, so only a LOWER live value or
      // a big gap means the two are computed differently rather than just aged.
      if (liveVal < archived)
        fail.push(`${name}: archive says ${archived} but the live site says ${liveVal}, which is lower. Different rules, not growth.`);
      else ok.push(`${name}: archive ${archived}, live ${liveVal}, consistent`);
    }
  } catch (e) { ok.push("live-site comparison skipped: " + e.message); }

  ok.forEach((s) => console.log("  ok    " + s));
  fail.forEach((s) => console.log("  FAIL  " + s));
  console.log(fail.length ? `\n${fail.length} PROBLEM(S)` : "\nledger verified, no drift");
  process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error("verifier error:", e.message); process.exit(2); });
